
import React, { useState } from 'react';
import { FileSystemNode, PresetContent } from '../types';
import { useFileSystem } from '../hooks/useFileSystem';
import Icon from './Icon';

interface Props {
  mode: 'save' | 'load';
  onFileSelect: (content: PresetContent) => void;
  onClose: () => void;
  fs: ReturnType<typeof useFileSystem>;
  currentConfig?: PresetContent; // For saving
}

const FileExplorer: React.FC<Props> = ({ mode, onFileSelect, onClose, fs, currentConfig }) => {
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [saveFileName, setSaveFileName] = useState('');
  
  // Navigation Helper
  const currentFolder = fs.findNode(currentFolderId, fs.root);
  
  // Breadcrumbs
  const getBreadcrumbs = () => {
    const crumbs = [];
    let curr = currentFolder;
    while (curr && curr.id !== 'root') {
      crumbs.unshift(curr);
      curr = fs.findNode(curr.parentId!, fs.root);
    }
    return [{ id: 'root', name: 'Raíz' }, ...crumbs];
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      fs.createFolder(currentFolderId, newFolderName);
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };

  const handleSave = () => {
    if (saveFileName.trim() && currentConfig) {
      fs.saveFile(currentFolderId, saveFileName, currentConfig);
      onClose();
    }
  };

  // Sorting: Folders first, then Files
  const sortedChildren = [...(currentFolder?.children || [])].sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'folder' ? -1 : 1;
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-4xl bg-[#0a0a12] border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(34,211,238,0.1)] flex flex-col h-[80vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-r from-slate-900 to-black">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${mode === 'save' ? 'bg-amber-500/20 text-amber-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
               <Icon name={mode === 'save' ? 'Save' : 'Folder'} size={24} />
            </div>
            <div>
                <h2 className="text-xl font-display font-bold text-white">
                    {mode === 'save' ? 'Guardar Preset' : 'Cargar Preset'}
                </h2>
                <p className="text-xs text-slate-400">Sistema de Archivos Holográfico</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <Icon name="X" />
          </button>
        </div>

        {/* Toolbar & Breadcrumbs */}
        <div className="flex items-center justify-between px-6 py-3 bg-white/5 border-b border-white/5">
           {/* Breadcrumbs */}
           <div className="flex items-center gap-2 text-sm overflow-x-auto no-scrollbar">
              {getBreadcrumbs().map((crumb, idx, arr) => (
                <div key={crumb.id} className="flex items-center gap-2 shrink-0">
                   <button 
                     onClick={() => setCurrentFolderId(crumb.id)}
                     className={`hover:text-cyan-300 transition-colors ${idx === arr.length - 1 ? 'text-white font-bold' : 'text-slate-500'}`}
                   >
                     {crumb.name}
                   </button>
                   {idx < arr.length - 1 && <Icon name="ChevronDown" size={12} className="-rotate-90 text-slate-700" />}
                </div>
              ))}
           </div>

           {/* Actions */}
           <div className="flex gap-2">
             {!isCreatingFolder && (
               <button 
                 onClick={() => setIsCreatingFolder(true)}
                 className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 border border-white/10"
               >
                 <Icon name="Plus" size={14} />
                 Nueva Carpeta
               </button>
             )}
           </div>
        </div>

        {/* Create Folder Input */}
        {isCreatingFolder && (
          <div className="px-6 py-3 bg-cyan-900/10 border-b border-cyan-500/20 flex items-center gap-3 animate-fade-in">
            <Icon name="Folder" size={18} className="text-cyan-400" />
            <input 
              autoFocus
              type="text" 
              placeholder="Nombre de la carpeta..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              className="bg-transparent border-b border-cyan-500/50 text-white text-sm focus:outline-none flex-1 py-1"
            />
            <button onClick={handleCreateFolder} className="text-xs bg-cyan-500/20 text-cyan-300 px-3 py-1 rounded hover:bg-cyan-500/40">Crear</button>
            <button onClick={() => setIsCreatingFolder(false)} className="text-xs text-slate-500 hover:text-white">Cancelar</button>
          </div>
        )}

        {/* Grid Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-black/40">
           {sortedChildren.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-slate-600">
               <Icon name="Folder" size={48} className="opacity-20 mb-4" />
               <p>Carpeta vacía</p>
             </div>
           ) : (
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {sortedChildren.map(node => (
                  <div 
                    key={node.id}
                    onClick={() => {
                        if (node.type === 'folder') {
                            setCurrentFolderId(node.id);
                            setSelectedId(null);
                        } else {
                            setSelectedId(node.id);
                        }
                    }}
                    onDoubleClick={() => {
                        if (node.type === 'file' && node.content) {
                            onFileSelect(node.content);
                            onClose();
                        }
                    }}
                    className={`
                      group relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col items-center text-center gap-3
                      ${selectedId === node.id 
                        ? 'bg-cyan-500/20 border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.1)]' 
                        : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'}
                    `}
                  >
                     <div className={`
                       w-12 h-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-110
                       ${node.type === 'folder' ? 'bg-amber-500/10 text-amber-400' : 'bg-purple-500/10 text-purple-400'}
                     `}>
                        <Icon name={node.type === 'folder' ? 'Folder' : 'FileText'} size={24} />
                     </div>
                     <span className="text-xs text-slate-300 font-medium break-words w-full line-clamp-2 leading-tight">
                        {node.name}
                     </span>
                     
                     {/* Hover Actions */}
                     <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             if(confirm('¿Borrar este elemento?')) fs.deleteNode(node.id);
                           }}
                           className="p-1.5 bg-black/50 hover:bg-red-500/50 rounded-md text-white backdrop-blur-sm"
                        >
                            <Icon name="Trash2" size={12} />
                        </button>
                     </div>
                  </div>
                ))}
             </div>
           )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/10 bg-white/5 flex flex-col md:flex-row gap-4 items-center justify-between">
           <div className="text-xs text-slate-500">
             {selectedId ? 'Elemento seleccionado' : 'Selecciona un archivo o carpeta'}
           </div>

           <div className="flex gap-4 w-full md:w-auto">
             {mode === 'save' && (
               <div className="flex-1 md:w-64 relative">
                  <input 
                    type="text" 
                    placeholder="Nombre del archivo..."
                    value={saveFileName}
                    onChange={(e) => setSaveFileName(e.target.value)}
                    className="w-full bg-black/50 border border-white/20 rounded-lg pl-3 pr-10 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                  />
                  <div className="absolute right-3 top-2.5 text-slate-500 pointer-events-none text-xs">.json</div>
               </div>
             )}

             <button 
                onClick={() => {
                    if (mode === 'save') handleSave();
                    else if (selectedId) {
                        const node = sortedChildren.find(n => n.id === selectedId);
                        if (node && node.content) {
                            onFileSelect(node.content);
                            onClose();
                        }
                    }
                }}
                disabled={mode === 'save' ? !saveFileName : !selectedId}
                className={`
                  px-6 py-2 rounded-lg font-bold uppercase tracking-widest text-xs transition-all
                  ${(mode === 'save' ? saveFileName : selectedId) 
                    ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)]' 
                    : 'bg-white/10 text-slate-500 cursor-not-allowed'}
                `}
             >
               {mode === 'save' ? 'Guardar' : 'Cargar'}
             </button>
           </div>
        </div>

      </div>
    </div>
  );
};

export default FileExplorer;
