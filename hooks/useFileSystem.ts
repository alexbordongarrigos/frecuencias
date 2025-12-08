
import { useState, useEffect, useCallback } from 'react';
import { FileSystemNode, PresetContent } from '../types';

const STORAGE_KEY = 'omni_holographic_fs_v1';

export const useFileSystem = () => {
  const [root, setRoot] = useState<FileSystemNode>({
    id: 'root',
    parentId: null,
    name: 'Raíz',
    type: 'folder',
    children: [],
    createdAt: Date.now()
  });

  // Load from Storage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setRoot(parsed);
      } catch (e) {
        console.error("Failed to load file system", e);
      }
    }
  }, []);

  // Save to Storage
  const persist = useCallback((newRoot: FileSystemNode) => {
    setRoot(newRoot);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newRoot));
  }, []);

  // --- Helpers ---

  // Recursive finder
  const findNode = (id: string, node: FileSystemNode): FileSystemNode | null => {
    if (node.id === id) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNode(id, child);
        if (found) return found;
      }
    }
    return null;
  };

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
    persist(addToFolder(root, parentId, newFolder));
    return newFolder.id;
  };

  const saveFile = (parentId: string, name: string, content: PresetContent) => {
    const newFile: FileSystemNode = {
      id: crypto.randomUUID(),
      parentId,
      name,
      type: 'file',
      content,
      createdAt: Date.now()
    };
    persist(addToFolder(root, parentId, newFile));
  };

  // SMART SAVE: Handles paths like "Folder/Subfolder/File"
  const saveFileWithPath = (path: string[], fileName: string, content: PresetContent) => {
    let currentFolderId = 'root';
    let currentTree = root;

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
    const newFile: FileSystemNode = {
        id: crypto.randomUUID(),
        parentId: currentFolderId,
        name: fileName,
        type: 'file',
        content,
        createdAt: Date.now()
    };
    persist(addToFolder(currentTree, currentFolderId, newFile));
  };

  const deleteNode = (id: string) => {
    persist(deleteFromTree(root, id));
  };

  const renameNode = (id: string, newName: string) => {
    persist(updateTree(root, id, (node) => ({ ...node, name: newName })));
  };

  const importSystem = (jsonString: string) => {
    try {
        const importedRoot = JSON.parse(jsonString);
        // Basic validation
        if (importedRoot.id === 'root' && Array.isArray(importedRoot.children)) {
            // Intelligent Merge: We keep our root ID, but if the imported root has children, we add them.
            // If folder names collide, we rename imported ones.
            let newRoot = { ...root };
            
            importedRoot.children.forEach((importedNode: FileSystemNode) => {
                // Check collision
                const exists = newRoot.children?.find(c => c.name === importedNode.name && c.type === importedNode.type);
                if (exists) {
                    // Rename imported
                    importedNode.name = `${importedNode.name} (Importado)`;
                }
                importedNode.parentId = 'root'; // Re-parent to our root
                newRoot = addToFolder(newRoot, 'root', importedNode);
            });
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
    return JSON.stringify(root, null, 2);
  };

  return {
    root,
    createFolder,
    saveFile,
    saveFileWithPath,
    deleteNode,
    renameNode,
    importSystem,
    exportSystem,
    findNode
  };
};
