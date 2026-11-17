
import { useState, useEffect, useCallback, useRef } from 'react';
import { FileSystemNode, PresetContent } from '../types';

const STORAGE_KEY = 'omni_holographic_fs_v1';

const INITIAL_ROOT: FileSystemNode = {
  id: 'root',
  parentId: null,
  name: 'Raíz',
  type: 'folder',
  children: [],
  createdAt: Date.now()
};

export const useFileSystem = () => {
  const [root, setRoot] = useState<FileSystemNode>(INITIAL_ROOT);
  const rootRef = useRef<FileSystemNode>(INITIAL_ROOT);

  // Load from Storage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id === 'root') {
          rootRef.current = parsed;
          setRoot(parsed);
        }
      } catch (e) {
        console.error("Failed to load file system", e);
      }
    }
  }, []);

  // Save to Storage
  const persist = useCallback((newRoot: FileSystemNode) => {
    rootRef.current = newRoot;
    setRoot(newRoot);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newRoot));
    } catch (e) {
      console.error("Failed to save file system", e);
    }
  }, []);

  // --- Helpers ---

  // Recursive finder
  const findNode = useCallback((id: string, node: FileSystemNode = rootRef.current): FileSystemNode | null => {
    if (node.id === id) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNode(id, child);
        if (found) return found;
      }
    }
    return null;
  }, []);

  // Recursive updater
  const updateTree = (node: FileSystemNode, targetId: string, transform: (n: FileSystemNode) => FileSystemNode): FileSystemNode => {
    if (node.id === targetId) {
      return transform(node);
    }
    if (node.children) {
      return {
        ...node,
        children: node.children.map(child => updateTree(child, targetId, transform))
      };
    }
    return node;
  };

  // Recursive adder
  const addToFolder = (node: FileSystemNode, folderId: string, newNode: FileSystemNode): FileSystemNode => {
    if (node.id === folderId && node.type === 'folder') {
      return {
        ...node,
        children: [...(node.children || []), newNode]
      };
    }
    if (node.children) {
      return {
        ...node,
        children: node.children.map(child => addToFolder(child, folderId, newNode))
      };
    }
    return node;
  };

  // Recursive deleter
  const deleteFromTree = (node: FileSystemNode, targetId: string): FileSystemNode => {
    if (node.children) {
      return {
        ...node,
        children: node.children
          .filter(child => child.id !== targetId)
          .map(child => deleteFromTree(child, targetId))
      };
    }
    return node;
  };

  // --- Actions ---

  const createFolder = (parentId: string, name: string) => {
    const newFolder: FileSystemNode = {
      id: crypto.randomUUID(),
      parentId,
      name,
      type: 'folder',
      children: [],
      createdAt: Date.now()
    };
    persist(addToFolder(rootRef.current, parentId, newFolder));
    return newFolder.id;
  };

  const saveFile = (parentId: string, name: string, content: PresetContent) => {
    const currentTree = rootRef.current;
    const parentNode = findNode(parentId, currentTree);
    if (parentNode && parentNode.children) {
      const existingFile = parentNode.children.find(c => c.type === 'file' && c.name === name);
      if (existingFile) {
        // Overwrite existing file
        persist(
          updateTree(currentTree, existingFile.id, (node) => ({
            ...node,
            content: { ...content, updatedAt: Date.now() },
            createdAt: node.createdAt || Date.now()
          }))
        );
        return;
      }
    }

    const newFile: FileSystemNode = {
      id: crypto.randomUUID(),
      parentId,
      name,
      type: 'file',
      content: { ...content, dateCreated: content.dateCreated || Date.now(), updatedAt: Date.now() },
      createdAt: Date.now()
    };
    persist(addToFolder(currentTree, parentId, newFile));
  };

  // SMART SAVE: Handles paths like "Folder/Subfolder/File"
  const saveFileWithPath = (path: string[], fileName: string, content: PresetContent) => {
    let currentFolderId = 'root';
    let currentTree = rootRef.current;

    // Traverse or create path
    for (const folderName of path) {
      // Find folder in current context
      const folderNode = findNode(currentFolderId, currentTree);
      if (!folderNode || !folderNode.children) break;

      const existing = folderNode.children.find(c => c.type === 'folder' && c.name === folderName);
      
      if (existing) {
        currentFolderId = existing.id;
      } else {
        // Create it
        const newId = crypto.randomUUID();
        const newFolder: FileSystemNode = {
          id: newId,
          parentId: currentFolderId,
          name: folderName,
          type: 'folder',
          children: [],
          createdAt: Date.now()
        };
        currentTree = addToFolder(currentTree, currentFolderId, newFolder);
        currentFolderId = newId;
      }
    }

    // Finally save file
    const folderNode = findNode(currentFolderId, currentTree);
    const existingFile = folderNode?.children?.find(c => c.type === 'file' && c.name === fileName);
    
    if (existingFile) {
      currentTree = updateTree(currentTree, existingFile.id, (node) => ({
        ...node,
        content: { ...content, updatedAt: Date.now() },
        createdAt: node.createdAt || Date.now()
      }));
    } else {
      const newFile: FileSystemNode = {
          id: crypto.randomUUID(),
          parentId: currentFolderId,
          name: fileName,
          type: 'file',
          content: { ...content, dateCreated: content.dateCreated || Date.now(), updatedAt: Date.now() },
          createdAt: Date.now()
      };
      currentTree = addToFolder(currentTree, currentFolderId, newFile);
    }
    persist(currentTree);
  };

  const deleteNode = (id: string) => {
    if (id === 'root') return;
    persist(deleteFromTree(rootRef.current, id));
  };

  const renameNode = (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    persist(updateTree(rootRef.current, id, (node) => ({ ...node, name: trimmed })));
  };

  const updateFileNode = (id: string, updates: { name?: string; content?: PresetContent }) => {
    const currentTree = rootRef.current;
    const target = findNode(id, currentTree);
    if (!target) return false;

    const nextTree = updateTree(currentTree, id, (node) => {
      const nextName = updates.name !== undefined && updates.name.trim() ? updates.name.trim() : node.name;
      const nextContent = updates.content
        ? {
            ...node.content,
            ...updates.content,
            dateCreated: updates.content.dateCreated ?? node.content?.dateCreated ?? Date.now(),
            updatedAt: Date.now(),
          }
        : node.content;

      return {
        ...node,
        name: nextName,
        content: nextContent,
      };
    });

    persist(nextTree);
    return true;
  };

  const regenerateIds = (node: FileSystemNode, parentId: string | null): FileSystemNode => {
    const newId = crypto.randomUUID();
    return {
      ...node,
      id: newId,
      parentId,
      createdAt: Date.now(),
      content: node.content
        ? {
            ...node.content,
            oscillators: (node.content.oscillators || []).map((osc) => ({
              ...osc,
              id: crypto.randomUUID(),
            })),
            dateCreated: Date.now(),
            updatedAt: Date.now(),
          }
        : undefined,
      children: node.children?.map(c => regenerateIds(c, newId))
    };
  };

  const duplicateNode = (id: string): string | null => {
    if (id === 'root') return null;
    const currentTree = rootRef.current;
    const target = findNode(id, currentTree);
    if (!target) return null;

    const parentId = target.parentId || 'root';
    const cloned = regenerateIds(target, parentId);
    cloned.name = `${target.name} (Copia)`;

    persist(addToFolder(currentTree, parentId, cloned));
    return cloned.id;
  };

  const moveNode = (nodeId: string, targetFolderId: string): boolean => {
    if (nodeId === 'root' || nodeId === targetFolderId) return false;
    const currentTree = rootRef.current;
    const nodeToMove = findNode(nodeId, currentTree);
    const targetFolder = findNode(targetFolderId, currentTree);

    if (!nodeToMove || !targetFolder || targetFolder.type !== 'folder') return false;
    if (nodeToMove.parentId === targetFolderId) return false;
    // Prevent moving a folder inside one of its own descendants
    if (nodeToMove.type === 'folder' && findNode(targetFolderId, nodeToMove)) return false;

    const treeWithoutNode = deleteFromTree(currentTree, nodeId);
    const updatedNode: FileSystemNode = {
      ...nodeToMove,
      parentId: targetFolderId,
    };

    persist(addToFolder(treeWithoutNode, targetFolderId, updatedNode));
    return true;
  };

  const importSystem = (jsonString: string) => {
    try {
        const importedRoot = JSON.parse(jsonString);
        const currentTree = rootRef.current;
        // Basic validation
        if (importedRoot.id === 'root' && Array.isArray(importedRoot.children)) {
            
            const mergeChildren = (existingChildren: FileSystemNode[], importedChildren: FileSystemNode[], parentId: string): FileSystemNode[] => {
                const result = [...existingChildren];
                
                importedChildren.forEach(importedChild => {
                  const existingIndex = result.findIndex(c => c.name === importedChild.name && c.type === importedChild.type);
                  
                  if (existingIndex >= 0) {
                    if (importedChild.type === 'folder') {
                      result[existingIndex] = {
                        ...result[existingIndex],
                        children: mergeChildren(result[existingIndex].children || [], importedChild.children || [], result[existingIndex].id)
                      };
                    } else {
                      const newFile = regenerateIds(importedChild, parentId);
                      newFile.name = `${newFile.name} (Importado)`;
                      result.push(newFile);
                    }
                  } else {
                    result.push(regenerateIds(importedChild, parentId));
                  }
                });
                
                return result;
            };

            const newRoot = {
                ...currentTree,
                children: mergeChildren(currentTree.children || [], importedRoot.children, 'root')
            };
            
            persist(newRoot);
            return true;
        }
    } catch (e) {
        console.error("Import failed", e);
        return false;
    }
    return false;
  };

  const exportSystem = () => {
    return JSON.stringify(rootRef.current, null, 2);
  };

  return {
    root,
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
    findNode
  };
};
