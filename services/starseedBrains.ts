import { FileSystemNode, OscillatorState, PresetContent } from '../types';
import { autoSuggestTechnicalRecommendation } from '../utils/frequencyAnalysis';
import { normalizeOscillators, StarseedUser, supabase } from './starseedAuth';

export type BrainAccessLevel = 'admin' | 'escritura' | 'lectura';

export interface BrainStorageMethod {
  id: string;
  kind: string;
  name: string;
  status: string;
  enabled: boolean;
  isPrimary: boolean;
}

export interface BrainNeuronDevice {
  id: string;
  name: string;
  kind: string;
  lastSeenAt?: string;
}

export interface StarseedBrain {
  id: string;
  owner: string;
  ownerHandle?: string;
  name: string;
  scope: string;
  scopeRef?: string | null;
  description?: string;
  accessLevel: BrainAccessLevel;
  isOwner: boolean;
  storageMethods: BrainStorageMethod[];
  devices: BrainNeuronDevice[];
  updatedAt: number;
  isVirtualFallback?: boolean;
}

export interface OmniLibraryArchiveV2 {
  schema: 'omnifrecuencias.library.v2';
  exportedAt: number;
  source: 'starseed_brain' | 'local_device' | 'community_export';
  accountId?: string | null;
  brainId?: string | null;
  brainName?: string | null;
  revision: number;
  root: FileSystemNode;
}

export type SyncState =
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'offline_queued'
  | 'read_only'
  | 'local_only'
  | 'error';

export const OMNI_CONTEXT = 'omnifrecuencias';
export const OMNI_CONTEXT_REF = 'particle_library';
const OS_FILES_BUCKET = 'os-files';
const MEMORY_FILE_NAME = 'omnifrecuencias_library.omni.json';
const VIRTUAL_DEFAULT_BRAIN_PREFIX = 'omni-personal-';

const cacheKeyForBrains = (uid: string) => `omni_brains_cache_v1_${uid}`;
const selectionKeyForUser = (uid: string) => `omni_selected_brain_v1_${uid}`;
const pendingQueueKeyForBrain = (uid: string, brainId: string) => `omni_brain_sync_queue_v1_${uid}_${brainId}`;
const initAttemptKeyForUser = (uid: string) => `omni_brain_init_attempted_v1_${uid}`;

export const getBrainLibraryStoragePath = (brainOwnerId: string, brainId: string) =>
  `${brainOwnerId}/cerebros/${brainId}/${OMNI_CONTEXT}/_library_tree.omni.json`;

export const getEmptyRootNode = (rootName: string = 'Biblioteca Raíz'): FileSystemNode => ({
  id: 'root',
  parentId: null,
  name: rootName,
  type: 'folder',
  children: [],
  createdAt: Date.now(),
});

export const canWriteBrain = (brain: StarseedBrain | null): boolean => {
  if (!brain) return true; // Guest local mode is always writable
  return brain.accessLevel === 'admin' || brain.accessLevel === 'escritura';
};

export const countTreeStats = (node: FileSystemNode): { folders: number; files: number } => {
  let folders = 0;
  let files = 0;
  const walk = (n: FileSystemNode) => {
    for (const child of n.children || []) {
      if (child.type === 'folder') {
        folders += 1;
        walk(child);
      } else if (child.type === 'file') {
        files += 1;
      }
    }
  };
  walk(node);
  return { folders, files };
};

const sanitizeIdentifier = (s?: string | null) =>
  (s || '').toLowerCase().trim().replace(/^@/, '');

export const resolveUserBrainPermission = (row: any, user: StarseedUser): BrainAccessLevel => {
  if (!row) return 'lectura';
  if (row.owner === user.id) return 'admin';

  const userKeys = new Set(
    [
      sanitizeIdentifier(user.id),
      sanitizeIdentifier(user.email),
      sanitizeIdentifier(user.handle),
      sanitizeIdentifier(user.displayName),
    ].filter(Boolean)
  );

  const perms = Array.isArray(row?.includes?.permissions) ? row.includes.permissions : [];
  for (const entry of perms) {
    const candidates = [
      sanitizeIdentifier(entry?.who),
      sanitizeIdentifier(entry?.user_id),
      sanitizeIdentifier(entry?.userId),
      sanitizeIdentifier(entry?.email),
      sanitizeIdentifier(entry?.handle),
    ].filter(Boolean);

    const matches = candidates.some((c) => userKeys.has(c) || c === '*' || c === 'all');
    if (matches) {
      const rawLevel = sanitizeIdentifier(entry?.level || entry?.role || entry?.access || 'lectura');
      if (rawLevel === 'admin' || rawLevel === 'owner' || rawLevel === 'administrador') return 'admin';
      if (
        rawLevel === 'escritura' ||
        rawLevel === 'write' ||
        rawLevel === 'edit' ||
        rawLevel === 'editor' ||
        rawLevel === 'read_write'
      ) {
        return 'escritura';
      }
      return 'lectura';
    }
  }

  // Shared brain visible via RLS without explicit write entry defaults to read-only
  return 'lectura';
};

const normalizeBackend = (b: any): BrainStorageMethod => ({
  id: String(b?.id || crypto.randomUUID()),
  kind: String(b?.kind || 'cloud_supabase'),
  name: String(b?.name || b?.kind || 'Nube StarSeed OS'),
  status: String(b?.status || (b?.enabled === false ? 'offline' : 'active')),
  enabled: b?.enabled !== false,
  isPrimary: Boolean(b?.is_primary),
});

const defaultStorageMethods = (): BrainStorageMethod[] => [
  {
    id: 'starseed-cloud',
    kind: 'cloud_supabase',
    name: 'Nube StarSeed OS (os-files + memoria)',
    status: 'active',
    enabled: true,
    isPrimary: true,
  },
];

export const getCachedBrains = (uid: string): StarseedBrain[] => {
  try {
    const raw = localStorage.getItem(cacheKeyForBrains(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const setCachedBrains = (uid: string, brains: StarseedBrain[]): void => {
  try {
    localStorage.setItem(cacheKeyForBrains(uid), JSON.stringify(brains));
  } catch {
    // ignore storage quota errors
  }
};

export const getRememberedSelectedBrainId = (uid: string): string | null => {
  try {
    return localStorage.getItem(selectionKeyForUser(uid));
  } catch {
    return null;
  }
};

export const setRememberedSelectedBrainId = (uid: string, brainId: string): void => {
  try {
    localStorage.setItem(selectionKeyForUser(uid), brainId);
  } catch {
    // ignore
  }
};

export const fetchUserBrains = async (user: StarseedUser): Promise<{
  brains: StarseedBrain[];
  selectedBrainId: string;
  offline: boolean;
}> => {
  const buildFallbackBrain = (): StarseedBrain => ({
    id: `${VIRTUAL_DEFAULT_BRAIN_PREFIX}${user.id.slice(0, 12)}`,
    owner: user.id,
    ownerHandle: user.handle || user.displayName,
    name: `Cerebro Principal · ${user.displayName || 'StarSeed'}`,
    scope: 'app',
    scopeRef: OMNI_CONTEXT,
    description: 'Cerebro personal de Omni-Frecuencias sincronizado con tu cuenta StarSeed OS.',
    accessLevel: 'admin',
    isOwner: true,
    storageMethods: defaultStorageMethods(),
    devices: [],
    updatedAt: Date.now(),
    isVirtualFallback: true,
  });

  try {
    const [brainsRes, backendsRes, devicesRes, selectionRes] = await Promise.all([
      supabase.from('brains').select('*').order('updated_at', { ascending: false }),
      supabase.from('storage_backends').select('*').eq('owner', user.id),
      supabase.from('neuron_devices').select('id, name, kind, last_seen_at').limit(30),
      supabase
        .from('brain_selections')
        .select('brain_id')
        .eq('owner', user.id)
        .eq('context', OMNI_CONTEXT)
        .limit(1)
        .maybeSingle(),
    ]);

    if (brainsRes.error) {
      throw brainsRes.error;
    }

    let rows = Array.isArray(brainsRes.data) ? brainsRes.data : [];

    // Mirror StarSeed OS single-init guard: only create default cloud brain once if empty
    const hasOwned = rows.some((r: any) => r.owner === user.id);
    if (rows.length === 0 && !hasOwned && !localStorage.getItem(initAttemptKeyForUser(user.id))) {
      localStorage.setItem(initAttemptKeyForUser(user.id), '1');
      try {
        const { data: created, error: createErr } = await supabase
          .from('brains')
          .insert({
            owner: user.id,
            name: 'Cerebro Principal · Omni-Frecuencias',
            scope: 'app',
            scope_ref: OMNI_CONTEXT,
            description: 'Cerebro inicial para carpetas y partículas cuánticas de Omni-Frecuencias.',
            config: { app: OMNI_CONTEXT },
            includes: { app: OMNI_CONTEXT, backends: [], permissions: [] },
          })
          .select('*')
          .single();
        if (!createErr && created) {
          rows = [created];
        }
      } catch {
        // Fallback below handles read/RLS limitations gracefully
      }
    }

    const userBackends: BrainStorageMethod[] = Array.isArray(backendsRes.data) && backendsRes.data.length > 0
      ? backendsRes.data.map(normalizeBackend)
      : defaultStorageMethods();

    const devices: BrainNeuronDevice[] = Array.isArray(devicesRes.data)
      ? devicesRes.data.map((d: any) => ({
          id: String(d.id),
          name: String(d.name || 'Dispositivo'),
          kind: String(d.kind || 'web'),
          lastSeenAt: d.last_seen_at,
        }))
      : [];

    let mapped: StarseedBrain[] = rows.map((row: any) => {
      const accessLevel = resolveUserBrainPermission(row, user);
      const isOwner = row.owner === user.id;
      const backendIds: string[] = Array.isArray(row?.includes?.backends) ? row.includes.backends : [];
      const brainBackends =
        isOwner && backendIds.length > 0
          ? userBackends.filter((b) => backendIds.includes(b.id) || b.isPrimary)
          : isOwner
          ? userBackends
          : defaultStorageMethods();

      return {
        id: String(row.id),
        owner: String(row.owner || user.id),
        ownerHandle: row?.includes?.owner_handle || (isOwner ? user.handle || user.displayName : 'Compartido'),
        name: String(row.name || 'Cerebro StarSeed OS'),
        scope: String(row.scope || 'global'),
        scopeRef: row.scope_ref || null,
        description: row.description || undefined,
        accessLevel,
        isOwner,
        storageMethods: brainBackends.length > 0 ? brainBackends : defaultStorageMethods(),
        devices,
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
      };
    });

    if (mapped.length === 0) {
      mapped = [buildFallbackBrain()];
    }

    setCachedBrains(user.id, mapped);

    const cloudSelected = selectionRes?.data?.brain_id;
    const localSelected = getRememberedSelectedBrainId(user.id);
    const chosenId =
      (cloudSelected && mapped.some((b) => b.id === cloudSelected) && cloudSelected) ||
      (localSelected && mapped.some((b) => b.id === localSelected) && localSelected) ||
      mapped[0].id;

    setRememberedSelectedBrainId(user.id, chosenId);
    return { brains: mapped, selectedBrainId: chosenId, offline: false };
  } catch {
    const cached = getCachedBrains(user.id);
    const brains = cached.length > 0 ? cached : [buildFallbackBrain()];
    const localSelected = getRememberedSelectedBrainId(user.id);
    const selectedBrainId =
      (localSelected && brains.some((b) => b.id === localSelected) && localSelected) || brains[0].id;
    return { brains, selectedBrainId, offline: true };
  }
};

export const persistBrainSelection = async (user: StarseedUser, brainId: string): Promise<void> => {
  setRememberedSelectedBrainId(user.id, brainId);
  if (brainId.startsWith(VIRTUAL_DEFAULT_BRAIN_PREFIX)) return;
  try {
    await supabase.from('brain_selections').upsert(
      {
        owner: user.id,
        context: OMNI_CONTEXT,
        context_ref: OMNI_CONTEXT_REF,
        brain_id: brainId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner,context,context_ref' }
    );
  } catch {
    // Non-blocking if offline or table schema differs
  }
};

export const createStarseedBrain = async (
  user: StarseedUser,
  name: string,
  description?: string
): Promise<{ ok: boolean; brain?: StarseedBrain; error?: string }> => {
  const cleanName = name.trim();
  if (!cleanName) return { ok: false, error: 'Ingresa un nombre para el cerebro.' };

  try {
    const { data, error } = await supabase
      .from('brains')
      .insert({
        owner: user.id,
        name: cleanName,
        scope: 'app',
        scope_ref: OMNI_CONTEXT,
        description: description?.trim() || 'Biblioteca de carpetas y partículas de Omni-Frecuencias',
        config: { app: OMNI_CONTEXT },
        includes: { app: OMNI_CONTEXT, backends: [], permissions: [] },
      })
      .select('*')
      .single();

    if (error || !data) {
      throw error || new Error('No se pudo crear el cerebro en StarSeed OS.');
    }

    const newBrain: StarseedBrain = {
      id: String(data.id),
      owner: user.id,
      ownerHandle: user.handle || user.displayName,
      name: String(data.name || cleanName),
      scope: String(data.scope || 'app'),
      scopeRef: data.scope_ref || OMNI_CONTEXT,
      description: data.description || undefined,
      accessLevel: 'admin',
      isOwner: true,
      storageMethods: defaultStorageMethods(),
      devices: [],
      updatedAt: Date.now(),
    };

    const existing = getCachedBrains(user.id).filter((b) => !b.isVirtualFallback);
    setCachedBrains(user.id, [newBrain, ...existing]);
    await persistBrainSelection(user, newBrain.id);
    return { ok: true, brain: newBrain };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error al crear el cerebro en StarSeed OS.' };
  }
};

export const buildOmniLibraryArchive = (
  root: FileSystemNode,
  opts: {
    source: OmniLibraryArchiveV2['source'];
    accountId?: string | null;
    brainId?: string | null;
    brainName?: string | null;
    revision?: number;
  }
): OmniLibraryArchiveV2 => ({
  schema: 'omnifrecuencias.library.v2',
  exportedAt: Date.now(),
  source: opts.source,
  accountId: opts.accountId || null,
  brainId: opts.brainId || null,
  brainName: opts.brainName || null,
  revision: opts.revision || Date.now(),
  root,
});

const sanitizeImportedNode = (node: any, parentId: string | null): FileSystemNode | null => {
  if (!node || typeof node !== 'object') return null;

  if (node.type === 'folder' || Array.isArray(node.children)) {
    const id = String(node.id || crypto.randomUUID());
    const rawChildren = Array.isArray(node.children) ? node.children : [];
    const children = rawChildren
      .map((child: any) => sanitizeImportedNode(child, id))
      .filter((c: FileSystemNode | null): c is FileSystemNode => c !== null);

    return {
      id,
      parentId,
      name: String(node.name || 'Carpeta'),
      type: 'folder',
      children,
      createdAt: Number(node.createdAt) || Date.now(),
    };
  }

  // File / Particle node
  const rawContent = node.content || (Array.isArray(node.oscillators) ? node : null);
  const rawOscs =
    rawContent?.oscillators ||
    (Array.isArray(node.oscillatorsConfig) ? node.oscillatorsConfig : null);

  if (!Array.isArray(rawOscs)) return null;

  const normalizedOscs: OscillatorState[] = normalizeOscillators(rawOscs);
  const name = String(node.name || node.title || rawContent?.name || 'Partícula Importada');
  const category = String(rawContent?.category || node.category || 'custom');
  const content: PresetContent = {
    ...(rawContent || {}),
    oscillators: normalizedOscs,
    dateCreated: Number(rawContent?.dateCreated) || Date.now(),
    updatedAt: Number(rawContent?.updatedAt) || Date.now(),
    category,
    description: rawContent?.description || node.description || '',
    technicalRecommendation:
      rawContent?.technicalRecommendation ||
      autoSuggestTechnicalRecommendation(normalizedOscs, category, name),
  };

  return {
    id: String(node.id || crypto.randomUUID()),
    parentId,
    name,
    type: 'file',
    content,
    createdAt: Number(node.createdAt) || Date.now(),
  };
};

export interface ParsedLibraryImport {
  ok: boolean;
  mode: 'full_tree' | 'nodes' | 'os_presets' | 'single_particle';
  root?: FileSystemNode;
  nodes?: FileSystemNode[];
  revision?: number;
  error?: string;
}

export const parseAnyImportedLibraryOrParticle = (rawText: string): ParsedLibraryImport => {
  try {
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, mode: 'nodes', error: 'El archivo no contiene un JSON válido.' };
    }

    // 1. Canonical V2 archive
    if (parsed.schema === 'omnifrecuencias.library.v2' && parsed.root) {
      const rootNode = sanitizeImportedNode({ ...parsed.root, id: 'root', parentId: null }, null);
      if (rootNode && rootNode.type === 'folder') {
        return {
          ok: true,
          mode: 'full_tree',
          root: rootNode,
          revision: Number(parsed.revision || parsed.exportedAt) || Date.now(),
        };
      }
    }

    // 2. Direct root folder export (Explorer exportSystem or old omni_holographic_fs_v1)
    if (
      (parsed.id === 'root' || parsed.type === 'folder') &&
      Array.isArray(parsed.children)
    ) {
      const rootNode = sanitizeImportedNode({ ...parsed, id: 'root', parentId: null }, null);
      if (rootNode) {
        return { ok: true, mode: 'full_tree', root: rootNode, revision: Number(parsed.updatedAt) || Date.now() };
      }
    }

    // 3. StarSeed OS Library preset export ({ presets: [...] })
    if (Array.isArray(parsed.presets)) {
      const importedFiles: FileSystemNode[] = [];
      for (const item of parsed.presets) {
        const sanitized = sanitizeImportedNode(item, 'root');
        if (sanitized) importedFiles.push(sanitized);
      }
      if (importedFiles.length > 0) {
        return { ok: true, mode: 'os_presets', nodes: importedFiles };
      }
    }

    // 4. Array of FileSystemNode / FrequencyItems
    if (Array.isArray(parsed)) {
      const nodes: FileSystemNode[] = [];
      for (const item of parsed) {
        const sanitized = sanitizeImportedNode(item, 'root');
        if (sanitized) nodes.push(sanitized);
      }
      if (nodes.length > 0) {
        return { ok: true, mode: 'nodes', nodes };
      }
    }

    // 5. Single FileSystemNode or PresetContent
    const singleNode = sanitizeImportedNode(parsed, 'root');
    if (singleNode) {
      if (singleNode.type === 'folder') {
        return { ok: true, mode: 'nodes', nodes: [singleNode] };
      }
      return { ok: true, mode: 'single_particle', nodes: [singleNode] };
    }

    return {
      ok: false,
      mode: 'nodes',
      error: 'Formato JSON no reconocido. Debe ser un archivo .omni-library.json, carpeta o partícula válida.',
    };
  } catch (err: any) {
    return {
      ok: false,
      mode: 'nodes',
      error: err?.message || 'Error al analizar el archivo JSON.',
    };
  }
};

export const mergeFolderTreesPreservingAll = (
  targetRoot: FileSystemNode,
  incomingRoot: FileSystemNode
): FileSystemNode => {
  const cloneNode = (node: FileSystemNode, newParentId: string | null): FileSystemNode => ({
    ...node,
    id: node.id === 'root' ? 'root' : crypto.randomUUID(),
    parentId: newParentId,
    children: node.children ? node.children.map((c) => cloneNode(c, node.id)) : undefined,
  });

  const mergeIntoFolder = (dst: FileSystemNode, srcChildren: FileSystemNode[]): FileSystemNode => {
    const nextChildren = [...(dst.children || [])];

    for (const incoming of srcChildren) {
      if (incoming.type === 'folder') {
        const existingFolderIdx = nextChildren.findIndex(
          (c) => c.type === 'folder' && c.name.trim().toLowerCase() === incoming.name.trim().toLowerCase()
        );
        if (existingFolderIdx >= 0) {
          nextChildren[existingFolderIdx] = mergeIntoFolder(
            nextChildren[existingFolderIdx],
            incoming.children || []
          );
        } else {
          const newFolderId = crypto.randomUUID();
          const clonedChildren = (incoming.children || []).map((c) => cloneNode(c, newFolderId));
          nextChildren.push({
            ...incoming,
            id: newFolderId,
            parentId: dst.id,
            children: clonedChildren,
          });
        }
      } else if (incoming.type === 'file') {
        const dupIdx = nextChildren.findIndex(
          (c) => c.type === 'file' && c.name.trim().toLowerCase() === incoming.name.trim().toLowerCase()
        );
        if (dupIdx >= 0) {
          nextChildren[dupIdx] = {
            ...nextChildren[dupIdx],
            content: incoming.content,
          };
        } else {
          nextChildren.push({
            ...incoming,
            id: crypto.randomUUID(),
            parentId: dst.id,
          });
        }
      }
    }

    return {
      ...dst,
      children: nextChildren,
    };
  };

  return mergeIntoFolder(targetRoot, incomingRoot.children || []);
};

export const queuePendingBrainSync = (
  uid: string,
  brainId: string,
  archive: OmniLibraryArchiveV2
): void => {
  try {
    localStorage.setItem(pendingQueueKeyForBrain(uid, brainId), JSON.stringify(archive));
  } catch {
    // ignore storage limits
  }
};

export const getPendingBrainSync = (uid: string, brainId: string): OmniLibraryArchiveV2 | null => {
  try {
    const raw = localStorage.getItem(pendingQueueKeyForBrain(uid, brainId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.schema === 'omnifrecuencias.library.v2' ? parsed : null;
  } catch {
    return null;
  }
};

export const clearPendingBrainSync = (uid: string, brainId: string): void => {
  try {
    localStorage.removeItem(pendingQueueKeyForBrain(uid, brainId));
  } catch {
    // ignore
  }
};

export const pullBrainLibraryFromOS = async (
  user: StarseedUser,
  brain: StarseedBrain
): Promise<{ found: boolean; archive?: OmniLibraryArchiveV2; offline?: boolean; error?: string }> => {
  if (brain.isVirtualFallback) {
    return { found: false };
  }

  let bestArchive: OmniLibraryArchiveV2 | null = null;
  const considerRaw = (rawText?: string | null) => {
    if (!rawText) return;
    const parsed = parseAnyImportedLibraryOrParticle(rawText);
    if (parsed.ok && parsed.root) {
      const candidateRev = parsed.revision || 0;
      if (!bestArchive || candidateRev > bestArchive.revision) {
        bestArchive = buildOmniLibraryArchive(parsed.root, {
          source: 'starseed_brain',
          accountId: user.id,
          brainId: brain.id,
          brainName: brain.name,
          revision: candidateRev || Date.now(),
        });
      }
    }
  };

  try {
    // 1. Check brain_memory_files (works cleanly across devices and shared brains)
    const { data: memRows } = await supabase
      .from('brain_memory_files')
      .select('content, updated_at')
      .eq('brain_id', brain.id)
      .eq('name', MEMORY_FILE_NAME)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (Array.isArray(memRows) && memRows[0]?.content) {
      considerRaw(memRows[0].content);
    }

    // 2. Check os-files storage bucket canonical archive
    const canonicalPath = getBrainLibraryStoragePath(brain.owner, brain.id);
    const { data: blobData } = await supabase.storage.from(OS_FILES_BUCKET).download(canonicalPath);
    if (blobData) {
      const text = await blobData.text();
      considerRaw(text);
    }

    // 3. Fallback check os_files metadata in case shared collaborator wrote under their own owner prefix
    if (!bestArchive && !brain.isOwner) {
      const sharedPath = getBrainLibraryStoragePath(user.id, brain.id);
      const { data: sharedBlob } = await supabase.storage.from(OS_FILES_BUCKET).download(sharedPath);
      if (sharedBlob) {
        const text = await sharedBlob.text();
        considerRaw(text);
      }
    }

    if (bestArchive) {
      return { found: true, archive: bestArchive };
    }
    return { found: false };
  } catch (err: any) {
    return {
      found: false,
      offline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
      error: err?.message,
    };
  }
};

export const pushBrainLibraryToOS = async (
  user: StarseedUser,
  brain: StarseedBrain,
  root: FileSystemNode,
  revision: number = Date.now()
): Promise<{
  ok: boolean;
  syncState: SyncState;
  error?: string;
}> => {
  if (!canWriteBrain(brain)) {
    return {
      ok: false,
      syncState: 'read_only',
      error: `Tu acceso al cerebro "${brain.name}" es de solo lectura.`,
    };
  }

  const archive = buildOmniLibraryArchive(root, {
    source: 'starseed_brain',
    accountId: user.id,
    brainId: brain.id,
    brainName: brain.name,
    revision,
  });

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    queuePendingBrainSync(user.id, brain.id, archive);
    return { ok: false, syncState: 'offline_queued', error: 'Sin conexión: cambios en cola para auto-sincronizar.' };
  }

  if (brain.isVirtualFallback) {
    return { ok: true, syncState: 'local_only' };
  }

  const jsonPayload = JSON.stringify(archive, null, 2);
  const stats = countTreeStats(root);
  let anyChannelSucceeded = false;

  // Channel A: Upload to Storage bucket 'os-files' & upsert 'os_files' catalog row
  const preferredPath = getBrainLibraryStoragePath(brain.isOwner ? user.id : brain.owner, brain.id);
  const fallbackSharedPath = getBrainLibraryStoragePath(user.id, brain.id);

  for (const pathCandidate of preferredPath === fallbackSharedPath ? [preferredPath] : [preferredPath, fallbackSharedPath]) {
    try {
      const blob = new Blob([jsonPayload], { type: 'application/json' });
      const { error: uploadErr } = await supabase.storage
        .from(OS_FILES_BUCKET)
        .upload(pathCandidate, blob, { upsert: true, contentType: 'application/json' });

      if (!uploadErr) {
        anyChannelSucceeded = true;
        const { data: pubData } = supabase.storage.from(OS_FILES_BUCKET).getPublicUrl(pathCandidate);
        try {
          const { data: existingRow } = await supabase
            .from('os_files')
            .select('id')
            .eq('path', pathCandidate)
            .limit(1)
            .maybeSingle();

          const fileRow = {
            owner: brain.isOwner ? user.id : brain.owner,
            profile_id: user.id,
            name: '_library_tree.omni.json',
            mime: 'application/json',
            size: blob.size,
            path: pathCandidate,
            url: pubData?.publicUrl || null,
            is_public: false,
            meta: {
              app: OMNI_CONTEXT,
              brain_id: brain.id,
              brain_name: brain.name,
              revision,
              folders: stats.folders,
              files: stats.files,
              updated_by: user.id,
            },
          };

          if (existingRow?.id) {
            await supabase.from('os_files').update(fileRow).eq('id', existingRow.id);
          } else {
            await supabase.from('os_files').insert(fileRow);
          }
        } catch {
          // os_files row index is best-effort once blob uploaded
        }
        break;
      }
    } catch {
      // try fallback path
    }
  }

  // Channel B: Mirror to brain_memory_files so multi-device/collaborator StarSeed OS brains stay synchronized
  try {
    const { data: existingMem } = await supabase
      .from('brain_memory_files')
      .select('id')
      .eq('brain_id', brain.id)
      .eq('name', MEMORY_FILE_NAME)
      .limit(1)
      .maybeSingle();

    const memPayload = {
      owner: brain.owner || user.id,
      brain_id: brain.id,
      name: MEMORY_FILE_NAME,
      content: jsonPayload,
      source: OMNI_CONTEXT,
      meta: {
        app: OMNI_CONTEXT,
        revision,
        folders: stats.folders,
        files: stats.files,
        updated_by: user.id,
      },
      sync: {
        mode: 'realtime',
        app: OMNI_CONTEXT,
        revision,
      },
      updated_at: new Date().toISOString(),
    };

    if (existingMem?.id) {
      const { error: updErr } = await supabase
        .from('brain_memory_files')
        .update(memPayload)
        .eq('id', existingMem.id);
      if (!updErr) anyChannelSucceeded = true;
    } else {
      const { error: insErr } = await supabase.from('brain_memory_files').insert(memPayload);
      if (!insErr) anyChannelSucceeded = true;
    }
  } catch {
    // Non-blocking if brain_memory_files RLS denies guest write
  }

  if (anyChannelSucceeded) {
    clearPendingBrainSync(user.id, brain.id);
    return { ok: true, syncState: 'synced' };
  }

  queuePendingBrainSync(user.id, brain.id, archive);
  return {
    ok: false,
    syncState: 'offline_queued',
    error: 'Sincronización diferida en cola local; se reintentará automáticamente al conectar.',
  };
};
