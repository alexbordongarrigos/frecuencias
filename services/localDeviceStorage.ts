import { FileSystemNode } from '../types';

const DB_NAME = 'omni_device_storage_db_v1';
const STORE_NAME = 'handles';
const KEY_DIR_HANDLE = 'guest_dir_handle';
const KEY_FILE_HANDLE = 'guest_file_handle';
const META_STORAGE_KEY = 'omni_local_storage_meta_v1';

export const DEFAULT_LOCAL_ARCHIVE_FILENAME = 'omni-biblioteca-particulas.omni-library.json';

export interface LocalStorageLocationMeta {
  kind: 'directory' | 'file' | 'indexed_device_vault';
  label: string;
  configuredAt: number;
  lastWrittenAt?: number;
  autoSave: boolean;
}

export interface PickLocalLocationResult {
  ok: boolean;
  meta?: LocalStorageLocationMeta;
  importedJson?: string;
  cancelled?: boolean;
  error?: string;
}

const sanitizePathPart = (name: string): string =>
  (name || 'sin-nombre')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 96) || 'particula';

const openHandlesDB = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible en este entorno.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Error abriendo almacenamiento local IndexedDB.'));
  });

const putHandle = async (key: string, handle: any): Promise<void> => {
  const db = await openHandlesDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('No se pudo guardar la referencia de ubicación.'));
  });
  db.close();
};

const getHandle = async <T = any>(key: string): Promise<T | null> => {
  try {
    const db = await openHandlesDB();
    const value = await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result as T) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return value;
  } catch {
    return null;
  }
};

const deleteHandle = async (key: string): Promise<void> => {
  try {
    const db = await openHandlesDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    // Ignore cleanup errors
  }
};

export const supportsNativeFileSystemAccess = (): boolean => {
  if (typeof window === 'undefined') return false;
  return 'showDirectoryPicker' in window || 'showSaveFilePicker' in window;
};

export const getLocalStorageMeta = (): LocalStorageLocationMeta | null => {
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.label === 'string') {
      return parsed as LocalStorageLocationMeta;
    }
    return null;
  } catch {
    return null;
  }
};

export const setLocalStorageMeta = (meta: LocalStorageLocationMeta | null): void => {
  try {
    if (!meta) {
      localStorage.removeItem(META_STORAGE_KEY);
    } else {
      localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
    }
  } catch {
    // Ignore storage quota errors
  }
};

const ensurePermission = async (handle: any, promptIfNeeded: boolean): Promise<boolean> => {
  if (!handle) return false;
  try {
    if (typeof handle.queryPermission === 'function') {
      const current = await handle.queryPermission({ mode: 'readwrite' });
      if (current === 'granted') return true;
      if (promptIfNeeded && typeof handle.requestPermission === 'function') {
        const next = await handle.requestPermission({ mode: 'readwrite' });
        return next === 'granted';
      }
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

const mirrorFolderTreeToDirectory = async (
  dirHandle: any,
  folder: FileSystemNode
): Promise<void> => {
  const children = folder.children || [];
  for (const node of children) {
    if (node.type === 'folder') {
      try {
        const subDir = await dirHandle.getDirectoryHandle(sanitizePathPart(node.name), { create: true });
        await mirrorFolderTreeToDirectory(subDir, node);
      } catch {
        // Skip invalid subfolder name
      }
    } else if (node.type === 'file' && node.content) {
      try {
        const safeFileName = `${sanitizePathPart(node.name)}.omni.json`;
        const fileHandle = await dirHandle.getFileHandle(safeFileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(node, null, 2));
        await writable.close();
      } catch {
        // Skip individual file mirror errors so main archive succeeds
      }
    }
  }
};

const writeArchiveToDirHandle = async (
  dirHandle: any,
  archiveJson: string,
  rootTree?: FileSystemNode
): Promise<boolean> => {
  try {
    const fileHandle = await dirHandle.getFileHandle(DEFAULT_LOCAL_ARCHIVE_FILENAME, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(archiveJson);
    await writable.close();

    // Also mirror legacy filename so user sees clean JSON easily
    try {
      const legacyHandle = await dirHandle.getFileHandle('omni-biblioteca-particulas.json', { create: true });
      const legacyWritable = await legacyHandle.createWritable();
      await legacyWritable.write(archiveJson);
      await legacyWritable.close();
    } catch {
      // Optional secondary mirror
    }

    if (rootTree) {
      await mirrorFolderTreeToDirectory(dirHandle, rootTree);
    }
    return true;
  } catch {
    return false;
  }
};

const writeArchiveToFileHandle = async (fileHandle: any, archiveJson: string): Promise<boolean> => {
  try {
    const writable = await fileHandle.createWritable();
    await writable.write(archiveJson);
    await writable.close();
    return true;
  } catch {
    return false;
  }
};

export const pickLocalDirectoryOrFile = async (
  mode: 'directory' | 'file',
  customVaultName?: string
): Promise<PickLocalLocationResult> => {
  const win = typeof window !== 'undefined' ? (window as any) : null;

  if (mode === 'directory' && win && typeof win.showDirectoryPicker === 'function') {
    try {
      const dirHandle = await win.showDirectoryPicker({
        id: 'omni-frecuencias-library',
        mode: 'readwrite',
        startIn: 'documents',
      });
      await putHandle(KEY_DIR_HANDLE, dirHandle);
      await deleteHandle(KEY_FILE_HANDLE);

      let importedJson: string | undefined;
      for (const candidateName of [DEFAULT_LOCAL_ARCHIVE_FILENAME, 'omni-biblioteca-particulas.json']) {
        try {
          const existing = await dirHandle.getFileHandle(candidateName, { create: false });
          const file = await existing.getFile();
          const text = await file.text();
          if (text && text.trim().startsWith('{')) {
            importedJson = text;
            break;
          }
        } catch {
          // File doesn't exist yet in folder
        }
      }

      const meta: LocalStorageLocationMeta = {
        kind: 'directory',
        label: dirHandle.name || 'Carpeta Local Seleccionada',
        configuredAt: Date.now(),
        autoSave: true,
      };
      setLocalStorageMeta(meta);
      return { ok: true, meta, importedJson };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { ok: false, cancelled: true };
      }
      return { ok: false, error: err?.message || 'No se pudo seleccionar la carpeta local.' };
    }
  }

  if (mode === 'file' && win && typeof win.showSaveFilePicker === 'function') {
    try {
      const fileHandle = await win.showSaveFilePicker({
        suggestedName: DEFAULT_LOCAL_ARCHIVE_FILENAME,
        startIn: 'documents',
        types: [
          {
            description: 'Archivo de Biblioteca Omni-Frecuencias (.omni-library.json)',
            accept: { 'application/json': ['.omni-library.json', '.json'] },
          },
        ],
      });
      await putHandle(KEY_FILE_HANDLE, fileHandle);
      await deleteHandle(KEY_DIR_HANDLE);

      let importedJson: string | undefined;
      try {
        const file = await fileHandle.getFile();
        const text = await file.text();
        if (text && text.trim().startsWith('{')) {
          importedJson = text;
        }
      } catch {
        // New empty file
      }

      const meta: LocalStorageLocationMeta = {
        kind: 'file',
        label: fileHandle.name || DEFAULT_LOCAL_ARCHIVE_FILENAME,
        configuredAt: Date.now(),
        autoSave: true,
      };
      setLocalStorageMeta(meta);
      return { ok: true, meta, importedJson };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { ok: false, cancelled: true };
      }
      return { ok: false, error: err?.message || 'No se pudo seleccionar el archivo local.' };
    }
  }

  // Fallback for Safari / Mobile WebViews where File System Access picker is unavailable
  const fallbackLabel =
    (customVaultName && customVaultName.trim()) ||
    'Almacenamiento Local Recordado (Dispositivo)';
  const meta: LocalStorageLocationMeta = {
    kind: 'indexed_device_vault',
    label: fallbackLabel,
    configuredAt: Date.now(),
    lastWrittenAt: Date.now(),
    autoSave: true,
  };
  setLocalStorageMeta(meta);
  return { ok: true, meta };
};

export const writeLibraryArchiveToRememberedLocation = async (
  archiveJson: string,
  rootTree?: FileSystemNode,
  promptIfNeeded: boolean = false
): Promise<{ ok: boolean; needsPermission?: boolean; reason?: string }> => {
  const meta = getLocalStorageMeta();
  if (!meta || !meta.autoSave) {
    return { ok: false, reason: 'Sin ubicación local configurada.' };
  }

  if (meta.kind === 'indexed_device_vault') {
    setLocalStorageMeta({ ...meta, lastWrittenAt: Date.now() });
    return { ok: true };
  }

  if (meta.kind === 'directory') {
    const dirHandle = await getHandle(KEY_DIR_HANDLE);
    if (!dirHandle) {
      return { ok: false, reason: 'Referencia de carpeta local no encontrada en el dispositivo.' };
    }
    const allowed = await ensurePermission(dirHandle, promptIfNeeded);
    if (!allowed) {
      return { ok: false, needsPermission: true, reason: 'Se requiere permiso del navegador para escribir en la carpeta local.' };
    }
    const ok = await writeArchiveToDirHandle(dirHandle, archiveJson, rootTree);
    if (ok) {
      setLocalStorageMeta({ ...meta, lastWrittenAt: Date.now() });
    }
    return { ok };
  }

  if (meta.kind === 'file') {
    const fileHandle = await getHandle(KEY_FILE_HANDLE);
    if (!fileHandle) {
      return { ok: false, reason: 'Referencia de archivo local no encontrada en el dispositivo.' };
    }
    const allowed = await ensurePermission(fileHandle, promptIfNeeded);
    if (!allowed) {
      return { ok: false, needsPermission: true, reason: 'Se requiere permiso del navegador para escribir en el archivo local.' };
    }
    const ok = await writeArchiveToFileHandle(fileHandle, archiveJson);
    if (ok) {
      setLocalStorageMeta({ ...meta, lastWrittenAt: Date.now() });
    }
    return { ok };
  }

  return { ok: false };
};

export const readLibraryArchiveFromRememberedLocation = async (): Promise<{
  ok: boolean;
  json?: string;
  error?: string;
}> => {
  const meta = getLocalStorageMeta();
  if (!meta) {
    return { ok: false, error: 'No hay una ubicación local recordada en este dispositivo.' };
  }

  if (meta.kind === 'directory') {
    const dirHandle = await getHandle(KEY_DIR_HANDLE);
    if (!dirHandle) return { ok: false, error: 'Carpeta local no disponible.' };
    const allowed = await ensurePermission(dirHandle, true);
    if (!allowed) return { ok: false, error: 'Permiso denegado para leer la carpeta local.' };
    for (const candidateName of [DEFAULT_LOCAL_ARCHIVE_FILENAME, 'omni-biblioteca-particulas.json']) {
      try {
        const fh = await dirHandle.getFileHandle(candidateName, { create: false });
        const file = await fh.getFile();
        const text = await file.text();
        if (text && text.trim()) return { ok: true, json: text };
      } catch {
        // try next filename
      }
    }
    return { ok: false, error: 'No se encontró archivo de biblioteca dentro de la carpeta recordada.' };
  }

  if (meta.kind === 'file') {
    const fileHandle = await getHandle(KEY_FILE_HANDLE);
    if (!fileHandle) return { ok: false, error: 'Archivo local no disponible.' };
    const allowed = await ensurePermission(fileHandle, true);
    if (!allowed) return { ok: false, error: 'Permiso denegado para leer el archivo local.' };
    const file = await fileHandle.getFile();
    const text = await file.text();
    return text && text.trim() ? { ok: true, json: text } : { ok: false, error: 'El archivo local está vacío.' };
  }

  return { ok: false, error: 'Ubicación gestionada automáticamente en el almacenamiento local del dispositivo.' };
};

export const clearRememberedLocalLocation = async (): Promise<void> => {
  await deleteHandle(KEY_DIR_HANDLE);
  await deleteHandle(KEY_FILE_HANDLE);
  setLocalStorageMeta(null);
};
