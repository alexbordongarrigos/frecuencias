import { useEffect, useState } from 'react';
import { FileSystemNode, PresetContent } from '../types';
import {
  getCurrentStarseedUser,
  normalizeOscillators,
  StarseedUser,
  subscribeToStarseedAuth,
  supabase,
} from '../services/starseedAuth';
import {
  buildOmniLibraryArchive,
  canWriteBrain,
  countTreeStats,
  createStarseedBrain,
  fetchUserBrains,
  getEmptyRootNode,
  getPendingBrainSync,
  mergeFolderTreesPreservingAll,
  OmniLibraryArchiveV2,
  parseAnyImportedLibraryOrParticle,
  persistBrainSelection,
  pullBrainLibraryFromOS,
  pushBrainLibraryToOS,
  StarseedBrain,
  SyncState,
} from '../services/starseedBrains';
import {
  clearRememberedLocalLocation,
  getLocalStorageMeta,
  LocalStorageLocationMeta,
  pickLocalDirectoryOrFile,
  readLibraryArchiveFromRememberedLocation,
  writeLibraryArchiveToRememberedLocation,
} from '../services/localDeviceStorage';

const LEGACY_STORAGE_KEY = 'omni_holographic_fs_v1';
const GUEST_STORAGE_KEY = 'omni_holographic_fs_local_device_v2';

const accountBrainStorageKey = (uid: string, brainId: string) =>
  `omni_holographic_fs_account_${uid}_brain_${brainId}`;

export interface SharedFileSystemStoreState {
  root: FileSystemNode;
  user: StarseedUser | null;
  brains: StarseedBrain[];
  selectedBrainId: string | null;
  selectedBrain: StarseedBrain | null;
  canWriteCurrentBrain: boolean;
  syncState: SyncState;
  syncMessage: string | null;
  lastSyncedAt: number | null;
  isOnline: boolean;
  isLoadingBrains: boolean;
  hasLocalGuestData: boolean;
  localGuestStats: { folders: number; files: number };
  localLocationMeta: LocalStorageLocationMeta | null;
}

const loadGuestRootFromStorage = (): FileSystemNode => {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.type === 'folder') return parsed;
    }
    // Migrate legacy v1 local library strictly to GUEST local device vault (never to freshly logged-in accounts)
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsedLegacy = JSON.parse(legacy);
      if (parsedLegacy && parsedLegacy.type === 'folder') {
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(parsedLegacy));
        return parsedLegacy;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return getEmptyRootNode('Biblioteca Local del Dispositivo');
};

const saveGuestRootToStorage = (rootNode: FileSystemNode): void => {
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(rootNode));
  } catch {
    // Ignore storage quota errors
  }
};

const loadAccountBrainRoot = (uid: string, brainId: string, brainName?: string): FileSystemNode | null => {
  try {
    const raw = localStorage.getItem(accountBrainStorageKey(uid, brainId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.type === 'folder') return parsed;
  } catch {
    // Ignore
  }
  return null;
};

const saveAccountBrainRoot = (uid: string, brainId: string, rootNode: FileSystemNode): void => {
  try {
    localStorage.setItem(accountBrainStorageKey(uid, brainId), JSON.stringify(rootNode));
  } catch {
    // Ignore
  }
};

const findNodeRecursive = (id: string, node: FileSystemNode): FileSystemNode | null => {
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeRecursive(id, child);
      if (found) return found;
    }
  }
  return null;
};

const cloneSubtreeWithNewIds = (node: FileSystemNode, newParentId: string | null): FileSystemNode => {
  const newId = node.id === 'root' ? 'root' : crypto.randomUUID();
  return {
    ...node,
    id: newId,
    parentId: newParentId,
    createdAt: Date.now(),
    children: node.children ? node.children.map((c) => cloneSubtreeWithNewIds(c, newId)) : undefined,
  };
};

// --- MODULE-LEVEL SHARED REACTIVE STORE ---

const initialGuestRoot = loadGuestRootFromStorage();
const initialGuestStats = countTreeStats(initialGuestRoot);

let storeState: SharedFileSystemStoreState = {
  root: initialGuestRoot,
  user: null,
  brains: [],
  selectedBrainId: null,
  selectedBrain: null,
  canWriteCurrentBrain: true,
  syncState: 'local_only',
  syncMessage: 'Almacenamiento local en este dispositivo (sin sesión StarSeed OS)',
  lastSyncedAt: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isLoadingBrains: false,
  hasLocalGuestData: initialGuestStats.files > 0 || initialGuestStats.folders > 0,
  localGuestStats: initialGuestStats,
  localLocationMeta: getLocalStorageMeta(),
};

const subscribers = new Set<(state: SharedFileSystemStoreState) => void>();
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let realtimeChannel: any = null;
let initializedStore = false;

const emitState = () => {
  subscribers.forEach((cb) => {
    try {
      cb(storeState);
    } catch {
      // Isolate listener errors
    }
  });
};

const setStoreState = (patch: Partial<SharedFileSystemStoreState>) => {
  storeState = { ...storeState, ...patch };
  emitState();
};

const refreshGuestStatsInStore = () => {
  const guest = loadGuestRootFromStorage();
  const stats = countTreeStats(guest);
  setStoreState({
    localGuestStats: stats,
    hasLocalGuestData: stats.files > 0 || stats.folders > 0,
  });
};

const cleanupRealtimeSubscription = () => {
  if (realtimeChannel) {
    try {
      supabase.removeChannel(realtimeChannel);
    } catch {
      // Ignore cleanup errors
    }
    realtimeChannel = null;
  }
};

const setupRealtimeForBrain = (user: StarseedUser, brain: StarseedBrain) => {
  cleanupRealtimeSubscription();
  if (brain.isVirtualFallback) return;

  try {
    realtimeChannel = supabase
      .channel(`omni-brain-sync-${brain.id}-${Math.random().toString(36).slice(2, 7)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'brain_memory_files',
          filter: `brain_id=eq.${brain.id}`,
        },
        (payload: any) => {
          const row = payload?.new;
          if (!row || row.name !== 'omnifrecuencias_library.omni.json') return;
          if (row?.meta?.updated_by === user.id && syncDebounceTimer) return;
          if (typeof row.content === 'string') {
            const parsed = parseAnyImportedLibraryOrParticle(row.content);
            if (parsed.ok && parsed.root && storeState.selectedBrainId === brain.id) {
              saveAccountBrainRoot(user.id, brain.id, parsed.root);
              setStoreState({
                root: parsed.root,
                syncState: canWriteBrain(brain) ? 'synced' : 'read_only',
                syncMessage: `Actualizado automáticamente desde otro dispositivo (${brain.name})`,
                lastSyncedAt: Date.now(),
              });
            }
          }
        }
      )
      .subscribe();
  } catch {
    // Realtime optional when offline
  }
};

const activateBrainInStore = async (user: StarseedUser, brain: StarseedBrain) => {
  // Immediately check existing cached brain library OR open completely EMPTY (never auto-copy guest!)
  const cachedAccountRoot = loadAccountBrainRoot(user.id, brain.id, brain.name);
  const emptyBrainRoot = getEmptyRootNode(brain.name || 'Biblioteca del Cerebro');
  const initialRoot = cachedAccountRoot || emptyBrainRoot;

  if (!cachedAccountRoot) {
    saveAccountBrainRoot(user.id, brain.id, emptyBrainRoot);
  }

  const writable = canWriteBrain(brain);
  setStoreState({
    root: initialRoot,
    selectedBrainId: brain.id,
    selectedBrain: brain,
    canWriteCurrentBrain: writable,
    syncState: storeState.isOnline ? 'syncing' : writable ? 'offline_queued' : 'read_only',
    syncMessage: `Sincronizando cerebro "${brain.name}"...`,
  });

  persistBrainSelection(user, brain.id).catch(() => {});

  setupRealtimeForBrain(user, brain);

  // Flush offline queue first if internet is back
  const pending = getPendingBrainSync(user.id, brain.id);
  if (pending && storeState.isOnline && writable) {
    const pushRes = await pushBrainLibraryToOS(user, brain, pending.root, pending.revision);
    if (pushRes.ok) {
      saveAccountBrainRoot(user.id, brain.id, pending.root);
      setStoreState({
        root: pending.root,
        syncState: 'synced',
        syncMessage: `Cola offline sincronizada con "${brain.name}"`,
        lastSyncedAt: Date.now(),
      });
      return;
    }
  }

  // Pull latest from StarSeed OS storage / brain_memory_files
  const pullRes = await pullBrainLibraryFromOS(user, brain);
  if (storeState.user?.id !== user.id || storeState.selectedBrainId !== brain.id) return;

  if (pullRes.found && pullRes.archive) {
    saveAccountBrainRoot(user.id, brain.id, pullRes.archive.root);
    setStoreState({
      root: pullRes.archive.root,
      syncState: writable ? 'synced' : 'read_only',
      syncMessage: writable
        ? `Sincronizado con "${brain.name}" (${brain.storageMethods.map((m) => m.name).join(' · ')})`
        : `Solo lectura en "${brain.name}"`,
      lastSyncedAt: Date.now(),
    });
  } else {
    // Keep empty (or existing cached account tree) — NEVER auto-import guest storage
    setStoreState({
      syncState: !writable ? 'read_only' : storeState.isOnline ? 'synced' : 'offline_queued',
      syncMessage: !writable
        ? `Acceso de solo lectura a "${brain.name}"`
        : cachedAccountRoot
        ? `Biblioteca cargada en "${brain.name}"`
        : `Cerebro "${brain.name}" abierto vacío y listo`,
      lastSyncedAt: Date.now(),
    });
  }
};

const handleAuthTransition = async (user: StarseedUser | null) => {
  if (!user) {
    cleanupRealtimeSubscription();
    const guestRoot = loadGuestRootFromStorage();
    const stats = countTreeStats(guestRoot);
    setStoreState({
      user: null,
      brains: [],
      selectedBrainId: null,
      selectedBrain: null,
      canWriteCurrentBrain: true,
      root: guestRoot,
      syncState: 'local_only',
      syncMessage: storeState.localLocationMeta
        ? `Guardado automático local: ${storeState.localLocationMeta.label}`
        : 'Modo local del dispositivo (sin sesión StarSeed OS)',
      isLoadingBrains: false,
      hasLocalGuestData: stats.files > 0 || stats.folders > 0,
      localGuestStats: stats,
    });
    return;
  }

  // Reset immediately to EMPTY account root while resolving brains so guest items never bleed into view!
  setStoreState({
    user,
    root: getEmptyRootNode('Cargando Cerebro StarSeed OS...'),
    isLoadingBrains: true,
    syncState: 'syncing',
    syncMessage: 'Conectando con tus Cerebros de StarSeed OS...',
  });

  refreshGuestStatsInStore();

  const res = await fetchUserBrains(user);
  if (storeState.user?.id !== user.id) return;

  const chosen = res.brains.find((b) => b.id === res.selectedBrainId) || res.brains[0] || null;
  setStoreState({
    brains: res.brains,
    selectedBrainId: chosen?.id || null,
    selectedBrain: chosen,
    isLoadingBrains: false,
  });

  if (chosen) {
    await activateBrainInStore(user, chosen);
  }
};

const persistAndSyncRoot = (nextRoot: FileSystemNode) => {
  const { user, selectedBrain, localLocationMeta } = storeState;

  if (user && selectedBrain) {
    if (!canWriteBrain(selectedBrain)) {
      setStoreState({
        syncState: 'read_only',
        syncMessage: `Permiso de solo lectura en "${selectedBrain.name}": no se puede modificar.`,
      });
      return;
    }

    saveAccountBrainRoot(user.id, selectedBrain.id, nextRoot);
    setStoreState({
      root: nextRoot,
      syncState: storeState.isOnline ? 'syncing' : 'offline_queued',
      syncMessage: storeState.isOnline
        ? `Guardando en "${selectedBrain.name}"...`
        : `Cambios guardados offline en "${selectedBrain.name}" (se sincronizarán al conectar)`,
    });

    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(async () => {
      syncDebounceTimer = null;
      const u = storeState.user;
      const b = storeState.selectedBrain;
      if (!u || !b) return;
      const result = await pushBrainLibraryToOS(u, b, storeState.root, Date.now());
      if (storeState.user?.id === u.id && storeState.selectedBrainId === b.id) {
        setStoreState({
          syncState: result.syncState,
          syncMessage:
            result.error ||
            (result.ok ? `Sincronizado con "${b.name}" en todos tus medios` : 'Sincronización pendiente'),
          lastSyncedAt: result.ok ? Date.now() : storeState.lastSyncedAt,
        });
      }
    }, 600);
  } else {
    // Guest / local device mode
    saveGuestRootToStorage(nextRoot);
    const stats = countTreeStats(nextRoot);
    setStoreState({
      root: nextRoot,
      hasLocalGuestData: stats.files > 0 || stats.folders > 0,
      localGuestStats: stats,
      syncState: 'local_only',
      syncMessage: localLocationMeta
        ? `Guardado localmente en "${localLocationMeta.label}"`
        : 'Guardado en almacenamiento interno del navegador',
    });

    if (localLocationMeta?.autoSave) {
      const archive = buildOmniLibraryArchive(nextRoot, {
        source: 'local_device',
        revision: Date.now(),
      });
      writeLibraryArchiveToRememberedLocation(JSON.stringify(archive, null, 2), nextRoot, false).then(
        (res) => {
          setStoreState({
            localLocationMeta: getLocalStorageMeta(),
            lastSyncedAt: res.ok ? Date.now() : storeState.lastSyncedAt,
          });
        }
      );
    }
  }
};

const ensureStoreInitialized = () => {
  if (initializedStore) return;
  initializedStore = true;

  getCurrentStarseedUser().then((user) => {
    handleAuthTransition(user);
  });

  subscribeToStarseedAuth((user) => {
    handleAuthTransition(user);
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('online', async () => {
      setStoreState({ isOnline: true });
      const { user, selectedBrain, root } = storeState;
      if (user && selectedBrain && canWriteBrain(selectedBrain)) {
        const pending = getPendingBrainSync(user.id, selectedBrain.id);
        const rootToSync = pending?.root || root;
        setStoreState({ syncState: 'syncing', syncMessage: `Reconectado · sincronizando "${selectedBrain.name}"...` });
        const res = await pushBrainLibraryToOS(user, selectedBrain, rootToSync, Date.now());
        setStoreState({
          syncState: res.syncState,
          syncMessage: res.ok
            ? `Conexión restaurada · "${selectedBrain.name}" sincronizado automáticamente`
            : res.error || 'Pendiente de sincronización',
          lastSyncedAt: res.ok ? Date.now() : storeState.lastSyncedAt,
        });
      }
    });

    window.addEventListener('offline', () => {
      setStoreState({
        isOnline: false,
        syncState: storeState.user ? 'offline_queued' : 'local_only',
        syncMessage: storeState.user
          ? 'Modo sin conexión · cambios en cola automática'
          : 'Modo local offline del dispositivo',
      });
    });
  }
};

// --- CORE MUTATION ACTIONS ---

const assertWritable = (): boolean => {
  if (storeState.user && storeState.selectedBrain && !canWriteBrain(storeState.selectedBrain)) {
    setStoreState({
      syncState: 'read_only',
      syncMessage: `No tienes permiso de escritura en "${storeState.selectedBrain.name}" (Solo Lectura).`,
    });
    return false;
  }
  return true;
};

export const useFileSystem = () => {
  const [state, setState] = useState<SharedFileSystemStoreState>(() => {
    ensureStoreInitialized();
    return storeState;
  });

  useEffect(() => {
    ensureStoreInitialized();
    subscribers.add(setState);
    setState(storeState);
    return () => {
      subscribers.delete(setState);
    };
  }, []);

  const findNode = (id: string, currentNode: FileSystemNode = storeState.root): FileSystemNode | null =>
    findNodeRecursive(id, currentNode);

  const createFolder = (parentId: string, name: string): string => {
    if (!assertWritable()) return '';
    const newId = crypto.randomUUID();
    const newFolder: FileSystemNode = {
      id: newId,
      parentId,
      name: name.trim() || 'Nueva Carpeta',
      type: 'folder',
      children: [],
      createdAt: Date.now(),
    };

    const insertRecursive = (node: FileSystemNode): FileSystemNode => {
      if (node.id === parentId && node.type === 'folder') {
        return { ...node, children: [...(node.children || []), newFolder] };
      }
      if (node.children) {
        return { ...node, children: node.children.map(insertRecursive) };
      }
      return node;
    };

    persistAndSyncRoot(insertRecursive(storeState.root));
    return newId;
  };

  const saveFile = (parentId: string, name: string, content: PresetContent): string => {
    if (!assertWritable()) return '';
    const newId = crypto.randomUUID();
    const normalizedContent: PresetContent = {
      ...content,
      oscillators: normalizeOscillators(content.oscillators || []),
      dateCreated: content.dateCreated || Date.now(),
      updatedAt: Date.now(),
    };
    const newFile: FileSystemNode = {
      id: newId,
      parentId,
      name: name.trim() || 'Partícula Sin Nombre',
      type: 'file',
      content: normalizedContent,
      createdAt: Date.now(),
    };

    const insertRecursive = (node: FileSystemNode): FileSystemNode => {
      if (node.id === parentId && node.type === 'folder') {
        return { ...node, children: [...(node.children || []), newFile] };
      }
      if (node.children) {
        return { ...node, children: node.children.map(insertRecursive) };
      }
      return node;
    };

    persistAndSyncRoot(insertRecursive(storeState.root));
    return newId;
  };

  const saveFileWithPath = (pathSegments: string[], name: string, content: PresetContent): string => {
    if (!assertWritable()) return '';
    let workingTree: FileSystemNode = structuredClone(storeState.root);
    let currentFolder = workingTree;

    for (const segment of pathSegments) {
      const cleanSeg = (segment || '').trim();
      if (!cleanSeg) continue;
      if (!currentFolder.children) currentFolder.children = [];
      let nextFolder = currentFolder.children.find(
        (c) => c.type === 'folder' && c.name.toLowerCase() === cleanSeg.toLowerCase()
      );
      if (!nextFolder) {
        nextFolder = {
          id: crypto.randomUUID(),
          parentId: currentFolder.id,
          name: cleanSeg,
          type: 'folder',
          children: [],
          createdAt: Date.now(),
        };
        currentFolder.children.push(nextFolder);
      }
      currentFolder = nextFolder;
    }

    if (!currentFolder.children) currentFolder.children = [];
    const newId = crypto.randomUUID();
    currentFolder.children.push({
      id: newId,
      parentId: currentFolder.id,
      name: name.trim() || 'Partícula Importada',
      type: 'file',
      content: {
        ...content,
        oscillators: normalizeOscillators(content.oscillators || []),
        dateCreated: content.dateCreated || Date.now(),
        updatedAt: Date.now(),
      },
      createdAt: Date.now(),
    });

    persistAndSyncRoot(workingTree);
    return newId;
  };

  const deleteNode = (id: string) => {
    if (id === 'root' || !assertWritable()) return;
    const removeRecursive = (node: FileSystemNode): FileSystemNode => {
      if (!node.children) return node;
      return {
        ...node,
        children: node.children.filter((c) => c.id !== id).map(removeRecursive),
      };
    };
    persistAndSyncRoot(removeRecursive(storeState.root));
  };

  const renameNode = (id: string, newName: string) => {
    const clean = newName.trim();
    if (!clean || !assertWritable()) return;
    const renameRecursive = (node: FileSystemNode): FileSystemNode => {
      if (node.id === id) return { ...node, name: clean };
      if (node.children) return { ...node, children: node.children.map(renameRecursive) };
      return node;
    };
    persistAndSyncRoot(renameRecursive(storeState.root));
  };

  const updateFileNode = (
    id: string,
    updates: { name?: string; content?: PresetContent }
  ) => {
    if (!assertWritable()) return;
    const updateRecursive = (node: FileSystemNode): FileSystemNode => {
      if (node.id === id && node.type === 'file') {
        return {
          ...node,
          name: updates.name !== undefined && updates.name.trim() ? updates.name.trim() : node.name,
          content: updates.content
            ? {
                ...(node.content || {}),
                ...updates.content,
                oscillators: normalizeOscillators(updates.content.oscillators || node.content?.oscillators || []),
                updatedAt: Date.now(),
              }
            : node.content,
        };
      }
      if (node.children) return { ...node, children: node.children.map(updateRecursive) };
      return node;
    };
    persistAndSyncRoot(updateRecursive(storeState.root));
  };

  const duplicateNode = (id: string): string | null => {
    if (id === 'root' || !assertWritable()) return null;
    const original = findNodeRecursive(id, storeState.root);
    if (!original || !original.parentId) return null;

    const cloned = cloneSubtreeWithNewIds(original, original.parentId);
    cloned.name = `${original.name} (Copia)`;

    const insertRecursive = (node: FileSystemNode): FileSystemNode => {
      if (node.id === original.parentId && node.type === 'folder') {
        return { ...node, children: [...(node.children || []), cloned] };
      }
      if (node.children) return { ...node, children: node.children.map(insertRecursive) };
      return node;
    };
    persistAndSyncRoot(insertRecursive(storeState.root));
    return cloned.id;
  };

  const moveNode = (id: string, targetFolderId: string): boolean => {
    if (id === 'root' || id === targetFolderId || !assertWritable()) return false;
    const targetFolder = findNodeRecursive(targetFolderId, storeState.root);
    const sourceNode = findNodeRecursive(id, storeState.root);
    if (!targetFolder || targetFolder.type !== 'folder' || !sourceNode) return false;
    if (sourceNode.type === 'folder' && findNodeRecursive(targetFolderId, sourceNode)) return false;

    const removeRecursive = (node: FileSystemNode): FileSystemNode => ({
      ...node,
      children: node.children?.filter((c) => c.id !== id).map(removeRecursive),
    });

    const insertRecursive = (node: FileSystemNode): FileSystemNode => {
      if (node.id === targetFolderId && node.type === 'folder') {
        return {
          ...node,
          children: [...(node.children || []), { ...sourceNode, parentId: targetFolderId }],
        };
      }
      if (node.children) return { ...node, children: node.children.map(insertRecursive) };
      return node;
    };

    const withoutSource = removeRecursive(storeState.root);
    persistAndSyncRoot(insertRecursive(withoutSource));
    return true;
  };

  const exportSystem = (): string => {
    const archive = buildOmniLibraryArchive(storeState.root, {
      source: storeState.user ? 'starseed_brain' : 'local_device',
      accountId: storeState.user?.id || null,
      brainId: storeState.selectedBrain?.id || null,
      brainName: storeState.selectedBrain?.name || null,
      revision: Date.now(),
    });
    return JSON.stringify(archive, null, 2);
  };

  const importSystem = (
    jsonString: string,
    options?: { mode?: 'merge' | 'replace'; targetFolderId?: string }
  ): boolean => {
    if (!assertWritable()) return false;
    const parsed = parseAnyImportedLibraryOrParticle(jsonString);
    if (!parsed.ok) return false;

    const targetFolderId = options?.targetFolderId || 'root';
    const mergeMode = options?.mode || 'merge';

    if (parsed.mode === 'full_tree' && parsed.root) {
      if (mergeMode === 'replace') {
        persistAndSyncRoot(parsed.root);
      } else {
        const merged = mergeFolderTreesPreservingAll(storeState.root, parsed.root);
        persistAndSyncRoot(merged);
      }
      return true;
    }

    if (parsed.nodes && parsed.nodes.length > 0) {
      const incomingFolder: FileSystemNode = {
        id: 'incoming-wrapper',
        parentId: null,
        name: 'Importado',
        type: 'folder',
        children: parsed.nodes,
        createdAt: Date.now(),
      };
      if (targetFolderId === 'root') {
        const merged = mergeFolderTreesPreservingAll(storeState.root, incomingFolder);
        persistAndSyncRoot(merged);
      } else {
        const targetFolder = findNodeRecursive(targetFolderId, storeState.root);
        if (targetFolder && targetFolder.type === 'folder') {
          const insertNodes = (node: FileSystemNode): FileSystemNode => {
            if (node.id === targetFolderId) {
              return mergeFolderTreesPreservingAll(node, incomingFolder);
            }
            if (node.children) return { ...node, children: node.children.map(insertNodes) };
            return node;
          };
          persistAndSyncRoot(insertNodes(storeState.root));
        } else {
          persistAndSyncRoot(mergeFolderTreesPreservingAll(storeState.root, incomingFolder));
        }
      }
      return true;
    }

    return false;
  };

  // --- STARSEED OS BRAINS & LOCAL STORAGE ACTIONS ---

  const selectBrain = async (brainId: string): Promise<void> => {
    if (!storeState.user) return;
    const target = storeState.brains.find((b) => b.id === brainId);
    if (!target) return;
    await activateBrainInStore(storeState.user, target);
  };

  const refreshBrains = async (): Promise<void> => {
    if (!storeState.user) return;
    setStoreState({ isLoadingBrains: true });
    const res = await fetchUserBrains(storeState.user);
    const chosen =
      res.brains.find((b) => b.id === storeState.selectedBrainId) ||
      res.brains.find((b) => b.id === res.selectedBrainId) ||
      res.brains[0] ||
      null;
    setStoreState({
      brains: res.brains,
      selectedBrainId: chosen?.id || null,
      selectedBrain: chosen,
      isLoadingBrains: false,
    });
    if (chosen) {
      await activateBrainInStore(storeState.user, chosen);
    }
  };

  const createBrain = async (name: string, description?: string) => {
    if (!storeState.user) {
      return { ok: false, error: 'Inicia sesión en StarSeed OS para crear cerebros en la nube.' };
    }
    const res = await createStarseedBrain(storeState.user, name, description);
    if (res.ok && res.brain) {
      const updated = [res.brain, ...storeState.brains.filter((b) => b.id !== res.brain!.id && !b.isVirtualFallback)];
      setStoreState({ brains: updated });
      await activateBrainInStore(storeState.user, res.brain);
    }
    return res;
  };

  const syncNow = async (): Promise<{ ok: boolean; error?: string }> => {
    if (!storeState.user || !storeState.selectedBrain) {
      if (storeState.localLocationMeta) {
        const res = await writeLibraryArchiveToRememberedLocation(exportSystem(), storeState.root, true);
        setStoreState({
          localLocationMeta: getLocalStorageMeta(),
          lastSyncedAt: res.ok ? Date.now() : storeState.lastSyncedAt,
          syncMessage: res.ok
            ? `Guardado en "${storeState.localLocationMeta.label}"`
            : res.reason || 'No se pudo escribir en la ubicación local.',
        });
        return { ok: res.ok, error: res.reason };
      }
      return { ok: true };
    }

    const writable = canWriteBrain(storeState.selectedBrain);
    setStoreState({ syncState: 'syncing', syncMessage: `Sincronizando "${storeState.selectedBrain.name}"...` });

    if (!writable) {
      const pull = await pullBrainLibraryFromOS(storeState.user, storeState.selectedBrain);
      if (pull.found && pull.archive) {
        saveAccountBrainRoot(storeState.user.id, storeState.selectedBrain.id, pull.archive.root);
        setStoreState({
          root: pull.archive.root,
          syncState: 'read_only',
          syncMessage: `Actualizado (solo lectura) desde "${storeState.selectedBrain.name}"`,
          lastSyncedAt: Date.now(),
        });
        return { ok: true };
      }
      setStoreState({ syncState: 'read_only' });
      return { ok: true };
    }

    const res = await pushBrainLibraryToOS(
      storeState.user,
      storeState.selectedBrain,
      storeState.root,
      Date.now()
    );
    setStoreState({
      syncState: res.syncState,
      syncMessage: res.ok
        ? `Cerebro "${storeState.selectedBrain.name}" sincronizado correctamente`
        : res.error || 'Pendiente de sincronización',
      lastSyncedAt: res.ok ? Date.now() : storeState.lastSyncedAt,
    });
    return { ok: res.ok, error: res.error };
  };

  const importLocalGuestDataToCurrentBrain = async (mode: 'merge' | 'replace' = 'merge'): Promise<boolean> => {
    if (!assertWritable()) return false;
    const guestRoot = loadGuestRootFromStorage();
    const stats = countTreeStats(guestRoot);
    if (stats.files === 0 && stats.folders === 0) return false;

    const nextRoot =
      mode === 'replace' ? guestRoot : mergeFolderTreesPreservingAll(storeState.root, guestRoot);
    persistAndSyncRoot(nextRoot);
    return true;
  };

  const chooseLocalDeviceLocation = async (mode: 'directory' | 'file') => {
    const res = await pickLocalDirectoryOrFile(mode);
    if (res.ok && res.meta) {
      setStoreState({ localLocationMeta: res.meta });
      if (res.importedJson) {
        const parsed = parseAnyImportedLibraryOrParticle(res.importedJson);
        if (parsed.ok) {
          const statsCurrent = countTreeStats(storeState.root);
          if (statsCurrent.files === 0 && statsCurrent.folders === 0 && parsed.root) {
            persistAndSyncRoot(parsed.root);
          }
        }
      }
      // Immediately flush current local tree to chosen folder/file
      await writeLibraryArchiveToRememberedLocation(exportSystem(), storeState.root, true);
      setStoreState({
        localLocationMeta: getLocalStorageMeta(),
        lastSyncedAt: Date.now(),
        syncMessage: `Ubicación local recordada: ${res.meta.label}`,
      });
    }
    return res;
  };

  const importFromRememberedLocalLocation = async (mode: 'merge' | 'replace' = 'merge') => {
    const readRes = await readLibraryArchiveFromRememberedLocation();
    if (!readRes.ok || !readRes.json) return { ok: false, error: readRes.error };
    const imported = importSystem(readRes.json, { mode });
    return { ok: imported, error: imported ? undefined : 'No se pudo interpretar el archivo guardado.' };
  };

  const forgetLocalLocation = async () => {
    await clearRememberedLocalLocation();
    setStoreState({ localLocationMeta: null });
  };

  const saveParticleToBrainFolder = async (params: {
    targetBrainId?: string | null;
    folderId?: string;
    newFolderName?: string;
    name: string;
    content: PresetContent;
  }): Promise<{ ok: boolean; error?: string }> => {
    const { targetBrainId, folderId, newFolderName, name, content } = params;

    if (storeState.user && targetBrainId && targetBrainId !== storeState.selectedBrainId) {
      const brain = storeState.brains.find((b) => b.id === targetBrainId);
      if (!brain) return { ok: false, error: 'Cerebro destino no encontrado.' };
      if (!canWriteBrain(brain)) {
        return { ok: false, error: `El cerebro "${brain.name}" es de solo lectura.` };
      }

      // Load target brain tree (account cache or remote), insert folder/file, push immediately!
      await selectBrain(brain.id);
    }

    if (!assertWritable()) {
      return { ok: false, error: 'El cerebro actual es de solo lectura.' };
    }

    let destinationFolderId = folderId || 'root';
    if (newFolderName && newFolderName.trim()) {
      destinationFolderId = createFolder(destinationFolderId, newFolderName.trim());
    }
    const createdFileId = saveFile(destinationFolderId || 'root', name, content);
    return { ok: Boolean(createdFileId) };
  };

  return {
    root: state.root,
    user: state.user,
    brains: state.brains,
    selectedBrainId: state.selectedBrainId,
    selectedBrain: state.selectedBrain,
    canWriteCurrentBrain: state.canWriteCurrentBrain,
    syncState: state.syncState,
    syncMessage: state.syncMessage,
    lastSyncedAt: state.lastSyncedAt,
    isOnline: state.isOnline,
    isLoadingBrains: state.isLoadingBrains,
    hasLocalGuestData: state.hasLocalGuestData,
    localGuestStats: state.localGuestStats,
    localLocationMeta: state.localLocationMeta,
    createFolder,
    saveFile,
    saveFileWithPath,
    deleteNode,
    renameNode,
    updateFileNode,
    duplicateNode,
    moveNode,
    importSystem,
    exportSystem,
    findNode,
    selectBrain,
    refreshBrains,
    createBrain,
    syncNow,
    importLocalGuestDataToCurrentBrain,
    chooseLocalDeviceLocation,
    importFromRememberedLocalLocation,
    forgetLocalLocation,
    saveParticleToBrainFolder,
  };
};
