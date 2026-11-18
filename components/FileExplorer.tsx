import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FileSystemNode,
  PresetContent,
  CATEGORIES,
  RADIATION_MEDIUMS,
  RadiationMedium,
  OscillatorState,
  TechnicalRecommendation,
  WaveType
} from '../types';
import { useFileSystem } from '../hooks/useFileSystem';
import { autoSuggestTechnicalRecommendation } from '../utils/frequencyAnalysis';
import Icon from './Icon';
import {
  publishPresetToCloud,
  getCurrentStarseedUser,
  exportPresetToOSLibrary,
  importPresetsFromOSLibrary
} from '../services/starseedAuth';
import ParticleWaveformBand from './ParticleWaveformBand';
import AdaptiveParticleGrid from './AdaptiveParticleGrid';

interface Props {
  mode: 'save' | 'load';
  onFileSelect: (content: PresetContent, mix?: boolean) => void;
  onClose: () => void;
  fs: ReturnType<typeof useFileSystem>;
  currentConfig?: PresetContent;
}

const EDITABLE_CATEGORIES = CATEGORIES.filter(c => c.id !== 'all');

const WAVE_OPTIONS: { value: WaveType; label: string }[] = [
  { value: 'sine', label: 'Senoidal' },
  { value: 'square', label: 'Cuadrada' },
  { value: 'sawtooth', label: 'Sierra' },
  { value: 'triangle', label: 'Triangular' }
];

const collectAllFolders = (node: FileSystemNode, prefix = ''): { id: string; label: string }[] => {
  if (node.type !== 'folder') return [];
  const currentLabel = prefix ? `${prefix} / ${node.name}` : node.name;
  let result = [{ id: node.id, label: currentLabel }];
  if (node.children) {
    node.children.forEach(child => {
      if (child.type === 'folder') {
        result = result.concat(collectAllFolders(child, currentLabel));
      }
    });
  }
  return result;
};

const collectTreeFiles = (
  node: FileSystemNode,
  pathNames: string[] = []
): { node: FileSystemNode; pathLabel: string }[] => {
  let files: { node: FileSystemNode; pathLabel: string }[] = [];
  if (node.type === 'file') {
    files.push({ node, pathLabel: pathNames.join(' / ') || 'Raíz' });
  } else if (node.children) {
    const nextPath = node.id === 'root' ? pathNames : [...pathNames, node.name];
    node.children.forEach(child => {
      files = files.concat(collectTreeFiles(child, nextPath));
    });
  }
  return files;
};

const FileExplorer: React.FC<Props> = ({ mode, onFileSelect, onClose, fs, currentConfig }) => {
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const explorerArchiveInputRef = useRef<HTMLInputElement>(null);
  const [showCreateBrainBox, setShowCreateBrainBox] = useState(false);
  const [newBrainName, setNewBrainName] = useState('');
  const [newBrainDesc, setNewBrainDesc] = useState('');
  const [creatingBrain, setCreatingBrain] = useState(false);

  useEffect(() => {
    setCurrentFolderId('root');
    setSelectedId(null);
  }, [fs.selectedBrainId, fs.user?.id]);

  // Folder creation & inline rename
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState('');

  // Search, filter & view mode
  const [searchQuery, setSearchQuery] = useState('');
  const [searchGlobalTree, setSearchGlobalTree] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
  const [expandedInspectorIds, setExpandedInspectorIds] = useState<Record<string, boolean>>({});

  // Save mode state
  const [saveFileName, setSaveFileName] = useState('');
  const [saveFileCategory, setSaveFileCategory] = useState<string>('synergy');
  const [saveFileDescription, setSaveFileDescription] = useState('');
  const [showSaveTechPanel, setShowSaveTechPanel] = useState(false);
  const [saveTechRec, setSaveTechRec] = useState<TechnicalRecommendation>(() =>
    autoSuggestTechnicalRecommendation(currentConfig?.oscillators || [], 'synergy', '')
  );

  // Full particle editor modal state
  const [editingParticle, setEditingParticle] = useState<FileSystemNode | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('synergy');
  const [editCustomCategory, setEditCustomCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editOscillators, setEditOscillators] = useState<OscillatorState[]>([]);
  const [editTechRec, setEditTechRec] = useState<TechnicalRecommendation>(() =>
    autoSuggestTechnicalRecommendation([], 'synergy', '')
  );

  // Move modal state
  const [movingNode, setMovingNode] = useState<FileSystemNode | null>(null);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string>('root');

  // Publish-to-Vibras internal modal state
  const [publishingNode, setPublishingNode] = useState<FileSystemNode | null>(null);
  const [publishCategory, setPublishCategory] = useState<string>('synergy');
  const [publishCustomCategory, setPublishCustomCategory] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState(false);

  // Status banner feedback
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const notify = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage(prev => (prev?.text === text ? null : prev));
    }, 4500);
  };

  // Current folder lookup
  const currentFolder = fs.findNode(currentFolderId, fs.root) || fs.root;

  // Breadcrumbs
  const breadcrumbs = useMemo(() => {
    const crumbs: { id: string; name: string }[] = [];
    let curr: FileSystemNode | null = currentFolder;
    while (curr && curr.id !== 'root') {
      crumbs.unshift({ id: curr.id, name: curr.name });
      curr = curr.parentId ? fs.findNode(curr.parentId, fs.root) : null;
    }
    return [{ id: 'root', name: 'Raíz' }, ...crumbs];
  }, [currentFolder, fs]);

  const allFolders = useMemo(() => collectAllFolders(fs.root), [fs.root]);

  const displayedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    if (searchGlobalTree && q) {
      return collectTreeFiles(fs.root)
        .filter(({ node }) => {
          const cat = (node.content?.category || '').toLowerCase();
          const desc = (node.content?.description || '').toLowerCase();
          const matchText = node.name.toLowerCase().includes(q) || desc.includes(q) || cat.includes(q);
          const matchCat = categoryFilter === 'all' || node.content?.category === categoryFilter;
          return matchText && matchCat;
        })
        .map(({ node, pathLabel }) => ({ node, pathLabel }));
    }

    const children = [...(currentFolder?.children || [])].sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'folder' ? -1 : 1;
    });

    return children
      .filter(node => {
        if (node.type === 'folder') {
          if (!q) return categoryFilter === 'all';
          return node.name.toLowerCase().includes(q);
        }
        const cat = (node.content?.category || '').toLowerCase();
        const desc = (node.content?.description || '').toLowerCase();
        const matchQuery = !q || node.name.toLowerCase().includes(q) || desc.includes(q) || cat.includes(q);
        const matchCat = categoryFilter === 'all' || node.content?.category === categoryFilter;
        return matchQuery && matchCat;
      })
      .map(node => ({ node, pathLabel: '' }));
  }, [currentFolder, fs.root, searchQuery, searchGlobalTree, categoryFilter]);

  const selectedNode = useMemo(() => {
    if (!selectedId) return null;
    return fs.findNode(selectedId, fs.root);
  }, [selectedId, fs]);

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      fs.createFolder(currentFolder.id, newFolderName.trim());
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };

  const handleAutoDetectSaveTech = () => {
    const suggested = autoSuggestTechnicalRecommendation(
      currentConfig?.oscillators || [],
      saveFileCategory,
      saveFileName
    );
    setSaveTechRec(suggested);
    setShowSaveTechPanel(true);
  };

  const handleSave = () => {
    if (saveFileName.trim() && currentConfig) {
      const resolvedTech = showSaveTechPanel
        ? saveTechRec
        : autoSuggestTechnicalRecommendation(currentConfig.oscillators || [], saveFileCategory, saveFileName.trim());

      const newConfig: PresetContent = {
        ...currentConfig,
        category: saveFileCategory,
        description: saveFileDescription.trim(),
        technicalRecommendation: resolvedTech,
        dateCreated: currentConfig.dateCreated || Date.now(),
        updatedAt: Date.now()
      };
      fs.saveFile(currentFolder.id, saveFileName.trim(), newConfig);
      onClose();
    }
  };

  const openParticleEditor = (node: FileSystemNode) => {
    if (node.type !== 'file' || !node.content) return;
    const cat = node.content.category || 'synergy';
    const isKnownCat = EDITABLE_CATEGORIES.some(c => c.id === cat);
    const oscs = (node.content.oscillators || []).map(o => ({ ...o }));
    const tech =
      node.content.technicalRecommendation ||
      autoSuggestTechnicalRecommendation(oscs, cat, node.name);

    setEditingParticle(node);
    setEditName(node.name);
    setEditCategory(isKnownCat ? cat : '__custom__');
    setEditCustomCategory(isKnownCat ? '' : cat);
    setEditDescription(node.content.description || '');
    setEditOscillators(oscs);
    setEditTechRec({
      ...tech,
      frequencyScales: { ...tech.frequencyScales }
    });
  };

  const handleSaveParticleEdits = () => {
    if (!editingParticle || !editName.trim()) return;
    const finalCategory =
      editCategory === '__custom__' ? editCustomCategory.trim() || 'synergy' : editCategory;

    const updatedContent: PresetContent = {
      ...(editingParticle.content || { oscillators: [], dateCreated: Date.now() }),
      oscillators: editOscillators,
      category: finalCategory,
      description: editDescription.trim(),
      technicalRecommendation: editTechRec,
      updatedAt: Date.now()
    };

    fs.updateFileNode(editingParticle.id, {
      name: editName.trim(),
      content: updatedContent
    });
    setEditingParticle(null);
    notify('success', `Partícula "${editName.trim()}" actualizada.`);
  };

  const toggleSaveMedium = (mediumId: RadiationMedium) => {
    setSaveTechRec(prev => {
      const exists = prev.recommendedMediums.includes(mediumId);
      const next = exists
        ? prev.recommendedMediums.filter(m => m !== mediumId)
        : [...prev.recommendedMediums, mediumId];
      return {
        ...prev,
        recommendedMediums: next.length > 0 ? next : ['acustica']
      };
    });
  };

  const toggleEditMedium = (mediumId: RadiationMedium) => {
    setEditTechRec(prev => {
      const exists = prev.recommendedMediums.includes(mediumId);
      const next = exists
        ? prev.recommendedMediums.filter(m => m !== mediumId)
        : [...prev.recommendedMediums, mediumId];
      return {
        ...prev,
        recommendedMediums: next.length > 0 ? next : ['acustica']
      };
    });
  };

  const toggleInspector = (id: string) => {
    setExpandedInspectorIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleImportOS = async () => {
    const user = await getCurrentStarseedUser();
    if (!user) {
      notify('error', 'Inicia sesión en StarSeed OS (Comunidad) para importar presets.');
      return;
    }
    try {
      const osPresets = await importPresetsFromOSLibrary(user.id);
      osPresets.forEach(preset => {
        fs.saveFileWithPath(preset.pathSegments, preset.name, preset.content);
      });
      notify(
        'success',
        `Se importaron ${osPresets.length} partículas desde tu biblioteca de StarSeed OS.`
      );
    } catch (err) {
      console.error(err);
      notify('error', 'Error al sincronizar presets desde StarSeed OS.');
    }
  };

  const handleExportOS = async (node: FileSystemNode) => {
    if (node.type !== 'file' || !node.content) return;
    const user = await getCurrentStarseedUser();
    if (!user) {
      notify('error', 'Inicia sesión con StarSeed OS para exportar a la nube.');
      return;
    }
    try {
      await exportPresetToOSLibrary(node, user.id);
      notify('success', `"${node.name}" guardado en tu Biblioteca de StarSeed OS.`);
    } catch (err) {
      console.error(err);
      notify('error', 'Error al exportar a StarSeed OS.');
    }
  };

  const openPublishConfirm = async (node: FileSystemNode) => {
    if (node.type !== 'file' || !node.content) return;
    const user = await getCurrentStarseedUser();
    if (!user) {
      notify('error', 'Inicia sesión con StarSeed OS para publicar en Vibras.');
      return;
    }
    const existingCat = node.content.category || 'synergy';
    const isKnown = EDITABLE_CATEGORIES.some(c => c.id === existingCat);
    setPublishCategory(isKnown ? existingCat : '__custom__');
    setPublishCustomCategory(isKnown ? '' : existingCat);
    setPublishingNode(node);
  };

  const handleConfirmPublish = async () => {
    if (!publishingNode || !publishingNode.content) return;
    const user = await getCurrentStarseedUser();
    if (!user) {
      notify('error', 'Sesión StarSeed OS expirada.');
      return;
    }
    setIsPublishing(true);
    try {
      const finalCategory =
        publishCategory === '__custom__'
          ? publishCustomCategory.trim() || 'synergy'
          : publishCategory;
      const tech =
        publishingNode.content.technicalRecommendation ||
        autoSuggestTechnicalRecommendation(
          publishingNode.content.oscillators || [],
          finalCategory,
          publishingNode.name
        );

      const enrichedContent: PresetContent = {
        ...publishingNode.content,
        category: finalCategory,
        authorId: user.id,
        authorName: user.displayName,
        technicalRecommendation: tech
      };

      await publishPresetToCloud(
        { ...publishingNode, content: enrichedContent },
        user.id,
        true
      );
      fs.updateFileNode(publishingNode.id, { content: enrichedContent });
      notify('success', `"${publishingNode.name}" publicado en Vibras (${finalCategory}).`);
      setPublishingNode(null);
    } catch (err) {
      console.error(err);
      notify('error', 'Error al publicar la partícula en la comunidad.');
    } finally {
      setIsPublishing(false);
    }
  };

  const renderExplorerNodeCard = (node: FileSystemNode, pathLabel: string) => {
    if (node.type === 'folder') {
      return (
        <div
          key={node.id}
          onClick={() => setCurrentFolderId(node.id)}
          className="group cursor-pointer rounded-2xl border bg-black/45 border-white/10 hover:border-amber-400/40 hover:bg-black/65 transition-all p-4 flex items-center justify-between gap-3 h-fit"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-xl bg-amber-950/40 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Icon name="FolderOpen" size={22} />
            </div>
            <div className="min-w-0 flex-1">
              {renamingNodeId === node.id ? (
                <input
                  autoFocus
                  type="text"
                  value={renamingName}
                  onChange={e => setRenamingName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      if (renamingName.trim()) fs.renameNode(node.id, renamingName.trim());
                      setRenamingNodeId(null);
                    } else if (e.key === 'Escape') {
                      setRenamingNodeId(null);
                    }
                  }}
                  onBlur={() => {
                    if (renamingName.trim()) fs.renameNode(node.id, renamingName.trim());
                    setRenamingNodeId(null);
                  }}
                  onClick={e => e.stopPropagation()}
                  className="w-full bg-black/80 border border-cyan-500/50 text-white text-xs font-bold rounded-lg px-2 py-1 focus:outline-none"
                />
              ) : (
                <>
                  <h4 className="font-bold text-sm text-white truncate">{node.name}</h4>
                  <span className="text-[10px] text-slate-400">
                    {node.children?.length || 0} elementos
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                setRenamingNodeId(node.id);
                setRenamingName(node.name);
              }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-200 cursor-pointer"
              title="Renombrar carpeta"
            >
              <Icon name="Edit2" size={13} />
            </button>
            <button
              type="button"
              onClick={() => {
                setMovingNode(node);
                setMoveTargetFolderId(node.parentId || 'root');
              }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-purple-500/20 text-slate-300 hover:text-purple-200 cursor-pointer"
              title="Mover carpeta"
            >
              <Icon name="Move" size={13} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`¿Eliminar la carpeta "${node.name}" y todo su contenido?`)) {
                  fs.deleteNode(node.id);
                }
              }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/25 text-slate-300 hover:text-red-300 cursor-pointer"
              title="Eliminar carpeta"
            >
              <Icon name="Trash2" size={13} />
            </button>
          </div>
        </div>
      );
    }

    const oscs = node.content?.oscillators || [];
    const catInfo = CATEGORIES.find(c => c.id === node.content?.category);
    const tech =
      node.content?.technicalRecommendation ||
      autoSuggestTechnicalRecommendation(oscs, node.content?.category, node.name);
    const mediumBadges = tech.recommendedMediums
      .map(id => RADIATION_MEDIUMS.find(m => m.id === id))
      .filter((m): m is (typeof RADIATION_MEDIUMS)[number] => Boolean(m));
    const isSelected = selectedId === node.id;
    const isInspected = !!expandedInspectorIds[node.id];

    return (
      <div
        key={node.id}
        onClick={() => setSelectedId(node.id)}
        onDoubleClick={() => {
          if (node.content && mode === 'load') {
            onFileSelect(node.content, false);
            onClose();
          }
        }}
        className={`rounded-2xl border p-4 transition-all flex flex-col h-fit gap-3 cursor-pointer ${
          isSelected
            ? 'bg-cyan-950/35 border-cyan-400/60 shadow-[0_0_24px_rgba(34,211,238,0.18)]'
            : 'bg-black/45 border-white/10 hover:border-white/25 hover:bg-black/60'
        }`}
      >
        {/* Card Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <div className="p-2 rounded-xl bg-purple-950/40 text-purple-300 border border-purple-500/25 shrink-0">
              <Icon name="FileAudio" size={16} />
            </div>
            <div className="min-w-0 flex-1">
              {renamingNodeId === node.id ? (
                <input
                  autoFocus
                  type="text"
                  value={renamingName}
                  onChange={e => setRenamingName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      if (renamingName.trim()) fs.renameNode(node.id, renamingName.trim());
                      setRenamingNodeId(null);
                    } else if (e.key === 'Escape') {
                      setRenamingNodeId(null);
                    }
                  }}
                  onBlur={() => {
                    if (renamingName.trim()) fs.renameNode(node.id, renamingName.trim());
                    setRenamingNodeId(null);
                  }}
                  onClick={e => e.stopPropagation()}
                  className="w-full bg-black/80 border border-cyan-500/50 text-white text-xs font-bold rounded-lg px-2 py-1 focus:outline-none"
                />
              ) : (
                <h4 className="font-bold text-white text-sm truncate">{node.name}</h4>
              )}
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ${
                    catInfo?.color || 'text-cyan-300'
                  }`}
                >
                  <Icon name={catInfo?.iconName || 'Layers'} size={10} />
                  {catInfo?.label || node.content?.category || 'Sinergia'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/10">
                  {oscs.length} Osc
                </span>
                {pathLabel && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-200 border border-amber-500/20">
                    {pathLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Real Synthesized Waveform Band */}
        <ParticleWaveformBand oscillators={oscs} compact />

        {/* Description */}
        <p className="text-xs text-slate-300 line-clamp-2 font-light">
          {node.content?.description || 'Sin descripción'}
        </p>

        {/* Radiation Medium Badges */}
        <div className="flex flex-wrap gap-1">
          {mediumBadges.map(m => (
            <span
              key={m.id}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${m.badgeClass}`}
            >
              <Icon name={m.iconName} size={9} />
              {m.shortLabel}
            </span>
          ))}
        </div>

        {/* Integrated Collapsible Inspector */}
        <div
          className="rounded-xl bg-black/50 border border-white/10 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => toggleInspector(node.id)}
            className="w-full px-3 py-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-cyan-300 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Icon name="Sliders" size={12} className="text-cyan-400" />
              Frecuencias y Recomendación ({oscs.length})
            </span>
            <Icon name={isInspected ? 'ChevronUp' : 'ChevronDown'} size={13} />
          </button>

          {isInspected && (
            <div className="px-3 pb-3 pt-1 space-y-2 border-t border-white/5 text-[11px]">
              <div className="bg-cyan-950/30 border border-cyan-500/20 rounded-lg p-2">
                <span className="block text-[9px] uppercase font-bold text-cyan-300">
                  {tech.primaryMediumLabel}
                </span>
                <p className="text-slate-300 text-[10px] mt-0.5">{tech.usageMode}</p>
                <div className="grid grid-cols-2 gap-1 mt-1.5 text-[10px] font-mono text-slate-300">
                  <span>Vol: {tech.recommendedVolume}</span>
                  <span>{tech.recommendedVoltage || '1.2–12V'}</span>
                  <span>{tech.frequencyScales.khz || '—'}</span>
                  <span>{tech.frequencyScales.opticalNm || '—'}</span>
                </div>
              </div>

              <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                {oscs.map((osc, i) => (
                  <div
                    key={osc.id || i}
                    className="flex flex-wrap items-center justify-between gap-1 bg-white/[0.03] rounded-lg px-2 py-1.5 font-mono text-[10px] text-slate-200 border border-white/5"
                  >
                    <span className="font-bold text-cyan-300">
                      {osc.frequency} Hz
                    </span>
                    <span className="text-purple-300">{osc.type}</span>
                    <span className="text-emerald-300">
                      {Math.round((osc.volume ?? 0.5) * 100)}%
                    </span>
                    <span className="text-slate-400">
                      Pan({Number(osc.panX ?? 0).toFixed(1)}, {Number(osc.panY ?? 0).toFixed(1)}, {Number(osc.panZ ?? 0).toFixed(1)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Toolbar */}
        <div
          className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-white/10"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => openParticleEditor(node)}
              className="px-2 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              title="Editar partícula completa (frecuencias, categoría y recomendación)"
            >
              <Icon name="Edit3" size={12} />
              Editar
            </button>
            <button
              type="button"
              onClick={() => {
                const newId = fs.duplicateNode(node.id);
                if (newId) notify('success', `Partícula "${node.name}" duplicada.`);
              }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer"
              title="Duplicar"
            >
              <Icon name="Copy" size={12} />
            </button>
            <button
              type="button"
              onClick={() => {
                setMovingNode(node);
                setMoveTargetFolderId(node.parentId || 'root');
              }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-purple-500/20 text-slate-300 hover:text-purple-200 cursor-pointer"
              title="Mover a carpeta"
            >
              <Icon name="Move" size={12} />
            </button>
            <button
              type="button"
              onClick={() => handleExportOS(node)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-amber-500/25 text-slate-300 hover:text-amber-200 cursor-pointer"
              title="Exportar a Starseed OS"
            >
              <Icon name="Cloud" size={12} />
            </button>
            <button
              type="button"
              onClick={() => openPublishConfirm(node)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/25 text-slate-300 hover:text-cyan-200 cursor-pointer"
              title="Publicar en Comunidad (Vibras)"
            >
              <Icon name="Globe" size={12} />
            </button>
            <button
              type="button"
              onClick={() => {
                setRenamingNodeId(node.id);
                setRenamingName(node.name);
              }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer"
              title="Renombrar"
            >
              <Icon name="Edit2" size={12} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`¿Borrar la partícula "${node.name}"?`)) {
                  fs.deleteNode(node.id);
                  if (selectedId === node.id) setSelectedId(null);
                }
              }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/25 text-slate-300 hover:text-red-300 cursor-pointer"
              title="Eliminar"
            >
              <Icon name="Trash2" size={12} />
            </button>
          </div>

          {mode === 'load' && node.content && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onFileSelect(node.content!, true);
                  onClose();
                }}
                className="px-2.5 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/40 text-purple-200 border border-purple-500/30 text-[10px] font-bold cursor-pointer"
              >
                + Mezclar
              </button>
              <button
                type="button"
                onClick={() => {
                  onFileSelect(node.content!, false);
                  onClose();
                }}
                className="px-2.5 py-1.5 rounded-lg bg-cyan-500/25 hover:bg-cyan-500 text-cyan-100 hover:text-black border border-cyan-500/40 text-[10px] font-bold cursor-pointer"
              >
                Cargar
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-xl p-2 sm:p-5 animate-fade-in">
      <div className="w-full max-w-6xl bg-[#060913]/95 border border-cyan-500/25 rounded-3xl shadow-[0_0_60px_rgba(0,0,0,0.95),inset_0_0_30px_rgba(34,211,238,0.06)] flex flex-col max-h-[94vh] sm:h-[90vh] overflow-hidden relative backdrop-blur-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 via-purple-500/5 to-pink-500/8 pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10 bg-black/50 relative z-10 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`p-2.5 sm:p-3 rounded-2xl border shrink-0 ${
                mode === 'save'
                  ? 'bg-cyan-950/50 border-cyan-500/40 text-cyan-300'
                  : 'bg-purple-950/50 border-purple-500/40 text-purple-300'
              }`}
            >
              <Icon name={mode === 'save' ? 'Save' : 'Folder'} size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-2xl font-display font-black text-white truncate">
                {mode === 'save' ? 'Guardar Partícula Personal' : 'Explorador de Partículas y Carpetas'}
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200/60">
                Archivo Cuántico Local & Sincronía StarSeed OS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar explorador"
            title="Cerrar explorador"
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white cursor-pointer shrink-0"
          >
            <Icon name="X" size={22} />
          </button>
        </div>

        {/* StarSeed OS Brain & Storage Synchronization Bar */}
        <div className="px-4 sm:px-6 py-2.5 border-b border-white/10 bg-[#080e1d]/90 relative z-10 shrink-0 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {fs.user ? (
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <div className="flex items-center gap-1.5 bg-black/60 border border-purple-500/35 rounded-xl px-2.5 py-1.5">
                  <Icon name="Brain" size={14} className="text-purple-300 shrink-0" />
                  <select
                    aria-label="Seleccionar Cerebro StarSeed OS"
                    value={fs.selectedBrainId || ''}
                    onChange={(e) => fs.selectBrain(e.target.value)}
                    disabled={fs.isLoadingBrains || fs.brains.length === 0}
                    className="bg-transparent text-xs font-bold text-white focus:outline-none max-w-[200px] sm:max-w-[260px] cursor-pointer"
                  >
                    {fs.brains.map((b) => (
                      <option key={b.id} value={b.id} className="bg-[#0a0f1f] text-white">
                        {b.name} ({b.accessLevel.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                {fs.selectedBrain && (
                  <span
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                      fs.selectedBrain.accessLevel === 'admin'
                        ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                        : fs.selectedBrain.accessLevel === 'escritura'
                        ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200'
                        : 'bg-amber-500/15 border-amber-400/40 text-amber-200'
                    }`}
                  >
                    {fs.selectedBrain.isOwner ? 'Admin' : `Compartido · ${fs.selectedBrain.accessLevel}`}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setShowCreateBrainBox(!showCreateBrainBox)}
                  className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/30 border border-purple-400/35 text-[10px] font-bold uppercase text-purple-200 flex items-center gap-1 cursor-pointer"
                  title="Crear un nuevo cerebro en tu cuenta StarSeed OS"
                >
                  <Icon name="Plus" size={11} /> Cerebro
                </button>

                <button
                  type="button"
                  onClick={() => fs.syncNow()}
                  disabled={fs.syncState === 'syncing'}
                  className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase flex items-center gap-1.5 cursor-pointer transition-colors ${
                    fs.syncState === 'synced'
                      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                      : fs.syncState === 'offline_queued'
                      ? 'bg-amber-500/15 border-amber-400/40 text-amber-200'
                      : fs.syncState === 'read_only'
                      ? 'bg-slate-800 border-white/15 text-slate-300'
                      : 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200'
                  }`}
                  title={fs.syncMessage || 'Sincronizar biblioteca ahora'}
                >
                  <Icon
                    name={fs.syncState === 'syncing' ? 'Loader' : fs.isOnline ? 'CloudUpload' : 'WifiOff'}
                    size={11}
                    className={fs.syncState === 'syncing' ? 'animate-spin' : ''}
                  />
                  <span>
                    {fs.syncState === 'synced'
                      ? 'Sincronizado'
                      : fs.syncState === 'syncing'
                      ? 'Sincronizando...'
                      : fs.syncState === 'offline_queued'
                      ? 'En cola offline'
                      : fs.syncState === 'read_only'
                      ? 'Solo lectura'
                      : 'Sincronizar'}
                  </span>
                </button>

                {fs.selectedBrain && fs.selectedBrain.storageMethods.slice(0, 2).map((m) => (
                  <span
                    key={m.id}
                    className="hidden xl:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-[10px] text-slate-300"
                    title={`Medio de almacenamiento vinculado (${m.kind})`}
                  >
                    <Icon name="Database" size={10} className="text-cyan-400" />
                    {m.name}
                  </span>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/60 border border-cyan-500/30 text-[11px] font-semibold text-cyan-200">
                  <Icon name="HardDrive" size={13} className="text-cyan-400" />
                  <span className="truncate max-w-[230px]">
                    {fs.localLocationMeta
                      ? `Local: ${fs.localLocationMeta.label}`
                      : 'Local del Dispositivo (Sin cuenta StarSeed OS)'}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={async () => {
                    const res = await fs.chooseLocalDeviceLocation('directory');
                    if (res.ok && res.meta) {
                      notify('success', `Carpeta local recordada: ${res.meta.label}`);
                    } else if (res.error) {
                      notify('error', res.error);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-400/35 text-[10px] font-bold uppercase text-cyan-200 flex items-center gap-1 cursor-pointer"
                >
                  <Icon name="FolderOpen" size={11} /> Elegir Carpeta Local
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const res = await fs.chooseLocalDeviceLocation('file');
                    if (res.ok && res.meta) {
                      notify('success', `Archivo local recordado: ${res.meta.label}`);
                    } else if (res.error) {
                      notify('error', res.error);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-[10px] font-bold uppercase text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <Icon name="Save" size={11} /> Archivo Destino
                </button>
              </div>
            )}

            {/* Universal Import / Export Full Library Archive */}
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                ref={explorerArchiveInputRef}
                type="file"
                accept=".json,.omni,.omni-library.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const text = ev.target?.result;
                    if (typeof text === 'string') {
                      const ok = fs.importSystem(text, { mode: 'merge', targetFolderId: currentFolderId });
                      if (ok) {
                        notify('success', `Importado "${file.name}" preservando carpetas y configuración completa.`);
                      } else {
                        notify('error', 'Formato no compatible o cerebro de solo lectura.');
                      }
                    }
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => explorerArchiveInputRef.current?.click()}
                disabled={fs.user ? !fs.canWriteCurrentBrain : false}
                className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/30 border border-indigo-400/35 text-[10px] font-bold uppercase text-indigo-200 flex items-center gap-1 cursor-pointer disabled:opacity-40"
                title="Importar carpetas y partículas completas desde archivo .omni-library.json o .json"
              >
                <Icon name="Upload" size={11} /> Importar Archivo
              </button>
              <button
                type="button"
                onClick={() => {
                  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(fs.exportSystem());
                  const link = document.createElement('a');
                  const safeName = (fs.selectedBrain?.name || 'biblioteca-local')
                    .toLowerCase()
                    .replace(/[^a-z0-9-_]+/gi, '-');
                  link.setAttribute('href', dataStr);
                  link.setAttribute('download', `${safeName}.omni-library.json`);
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  notify('success', 'Biblioteca completa exportada en formato .omni-library.json.');
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-400/35 text-[10px] font-bold uppercase text-emerald-200 flex items-center gap-1 cursor-pointer"
                title="Exportar todas las carpetas y configuraciones completas de partículas"
              >
                <Icon name="Download" size={11} /> Exportar Todo
              </button>
            </div>
          </div>

          {/* Inline Create New Brain Box */}
          {fs.user && showCreateBrainBox && (
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-white/10">
              <input
                type="text"
                value={newBrainName}
                onChange={(e) => setNewBrainName(e.target.value)}
                placeholder="Nombre del nuevo Cerebro StarSeed OS..."
                className="w-full sm:flex-1 bg-black/60 border border-purple-500/35 rounded-lg px-3 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
              />
              <input
                type="text"
                value={newBrainDesc}
                onChange={(e) => setNewBrainDesc(e.target.value)}
                placeholder="Descripción (opcional)..."
                className="w-full sm:flex-1 bg-black/60 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={creatingBrain || !newBrainName.trim()}
                  onClick={async () => {
                    setCreatingBrain(true);
                    const res = await fs.createBrain(newBrainName, newBrainDesc);
                    setCreatingBrain(false);
                    if (res.ok) {
                      setNewBrainName('');
                      setNewBrainDesc('');
                      setShowCreateBrainBox(false);
                      notify('success', `Cerebro "${res.brain?.name}" creado y vinculado.`);
                    } else {
                      notify('error', res.error || 'No se pudo crear el cerebro.');
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold cursor-pointer disabled:opacity-40"
                >
                  {creatingBrain ? 'Creando...' : 'Crear'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateBrainBox(false)}
                  className="px-2.5 py-1.5 rounded-lg border border-white/15 text-[11px] text-slate-300 hover:bg-white/5 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Explicit Import Banner for Previously Saved Local Device Folders/Particles */}
          {fs.user && fs.hasLocalGuestData && fs.canWriteCurrentBrain && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-950/40 border border-amber-500/35 text-[11px] text-amber-100">
              <div className="flex items-center gap-2">
                <Icon name="HardDrive" size={14} className="text-amber-300 shrink-0" />
                <span>
                  Tu biblioteca del cerebro se abrió aislada/vacía. Tienes{' '}
                  <strong>{fs.localGuestStats.folders} carpetas</strong> y{' '}
                  <strong>{fs.localGuestStats.files} partículas</strong> guardadas localmente en este dispositivo.
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const ok = await fs.importLocalGuestDataToCurrentBrain('merge');
                  if (ok) {
                    notify(
                      'success',
                      `Carpetas y partículas locales agregadas al cerebro "${fs.selectedBrain?.name || 'actual'}".`
                    );
                  }
                }}
                className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-[10px] uppercase tracking-wider shrink-0 cursor-pointer"
              >
                + Agregar Locales a este Cerebro
              </button>
            </div>
          )}
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div
            className={`mx-4 sm:mx-6 mt-3 px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 relative z-10 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
                : 'bg-red-950/70 border-red-500/40 text-red-200'
            }`}
          >
            <span className="flex items-center gap-2">
              <Icon name={statusMessage.type === 'success' ? 'Check' : 'AlertCircle'} size={14} />
              {statusMessage.text}
            </span>
            <button onClick={() => setStatusMessage(null)} className="opacity-70 hover:opacity-100">
              <Icon name="X" size={14} />
            </button>
          </div>
        )}

        {/* Toolbar: Breadcrumbs & Top Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-black/40 border-b border-white/10 relative z-10 shrink-0">
          {/* Interactive Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs sm:text-sm overflow-x-auto no-scrollbar py-1">
            {breadcrumbs.map((crumb, idx, arr) => (
              <div key={crumb.id} className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentFolderId(crumb.id);
                    setSearchGlobalTree(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-colors font-semibold cursor-pointer ${
                    idx === arr.length - 1
                      ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {crumb.name}
                </button>
                {idx < arr.length - 1 && <Icon name="ChevronRight" size={14} className="text-slate-600" />}
              </div>
            ))}
          </div>

          {/* Search, Category, View & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 sm:flex-none sm:w-52">
              <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar partícula o carpeta..."
                className="w-full bg-black/60 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400/50 placeholder:text-slate-500"
              />
            </div>

            <button
              type="button"
              onClick={() => setSearchGlobalTree(v => !v)}
              className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
                searchGlobalTree
                  ? 'bg-purple-500/20 border-purple-400/50 text-purple-200'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}
              title="Buscar en todo el árbol de carpetas"
            >
              Todo el árbol
            </button>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400/50 cursor-pointer"
            >
              <option value="all" className="bg-slate-900">Todas las categorías</option>
              {EDITABLE_CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id} className="bg-slate-900">
                  {cat.label}
                </option>
              ))}
            </select>

            {/* Grid / List Toggle */}
            <div className="flex bg-black/60 border border-white/10 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setViewLayout('grid')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewLayout === 'grid' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
                }`}
                title="Vista cuadrícula"
              >
                <Icon name="LayoutGrid" size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('list')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewLayout === 'list' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
                }`}
                title="Vista lista"
              >
                <Icon name="List" size={14} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleImportOS}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/40 hover:bg-amber-900/50 text-[11px] font-bold uppercase tracking-wider text-amber-300 border border-amber-500/30 transition-all cursor-pointer"
              title="Sincronizar carpetas y presets desde StarSeed OS"
            >
              <Icon name="CloudDownload" size={14} />
              <span className="hidden sm:inline">Importar OS</span>
            </button>

            {!isCreatingFolder && (
              <button
                type="button"
                onClick={() => setIsCreatingFolder(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/50 text-[11px] font-bold uppercase tracking-wider text-cyan-300 border border-cyan-500/30 transition-all cursor-pointer"
              >
                <Icon name="Plus" size={14} />
                <span>Carpeta</span>
              </button>
            )}
          </div>
        </div>

        {/* Create Folder Bar */}
        {isCreatingFolder && (
          <div className="px-4 sm:px-6 py-3 bg-cyan-950/20 border-b border-cyan-500/20 flex flex-wrap items-center gap-3 relative z-10 shrink-0">
            <Icon name="Folder" size={18} className="text-cyan-400" />
            <input
              autoFocus
              type="text"
              placeholder="Nombre de la nueva carpeta..."
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
              className="bg-black/60 border border-cyan-500/30 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-cyan-400 flex-1 min-w-[180px] py-2 px-3"
            />
            <button
              type="button"
              onClick={handleCreateFolder}
              className="text-xs font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-200 px-4 py-2 rounded-xl hover:bg-cyan-500/35 border border-cyan-500/40 cursor-pointer"
            >
              Crear
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingFolder(false)}
              className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white px-3 py-2 rounded-xl hover:bg-white/5 cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 custom-scrollbar relative z-0">
          {displayedItems.length === 0 ? (
            <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-slate-500 text-center py-8">
              <div className="p-5 rounded-full bg-white/5 border border-white/10 mb-4">
                <Icon name="Folder" size={40} className="opacity-30" />
              </div>
              <p className="text-xs font-bold tracking-widest uppercase">
                {searchQuery ? 'Sin coincidencias para tu búsqueda' : 'Carpeta vacía'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {mode === 'save'
                  ? 'Crea una carpeta nueva o guarda tu partícula directamente aquí.'
                  : 'Importa desde StarSeed OS o guarda partículas desde el Generador.'}
              </p>
            </div>
          ) : viewLayout === 'grid' ? (
            <AdaptiveParticleGrid
              items={displayedItems}
              getItemKey={({ node }) => node.id}
              columnsConfig={{ base: 1, sm: 2, lg: 3 }}
              gapPx={16}
              renderItem={({ node, pathLabel }) => renderExplorerNodeCard(node, pathLabel)}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {displayedItems.map(({ node, pathLabel }) => renderExplorerNodeCard(node, pathLabel))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-black/70 backdrop-blur-xl relative z-10 shrink-0 max-h-[48vh] overflow-y-auto custom-scrollbar">
          {mode === 'save' ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-4 relative">
                  <input
                    type="text"
                    placeholder="Nombre de la partícula..."
                    value={saveFileName}
                    onChange={e => setSaveFileName(e.target.value)}
                    className="w-full bg-black/60 border border-cyan-500/40 rounded-xl pl-3.5 pr-14 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none placeholder:text-slate-500"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-cyan-500/60 text-xs font-mono font-bold">
                    .omni
                  </span>
                </div>

                <div className="md:col-span-4">
                  <select
                    value={saveFileCategory}
                    onChange={e => setSaveFileCategory(e.target.value)}
                    className="w-full bg-black/60 border border-cyan-500/30 rounded-xl px-3 py-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  >
                    {EDITABLE_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id} className="bg-slate-900">
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-4">
                  <input
                    type="text"
                    placeholder="Breve descripción o propósito..."
                    value={saveFileDescription}
                    onChange={e => setSaveFileDescription(e.target.value)}
                    className="w-full bg-black/60 border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* Optional Collapsible Technical Recommendations in Save Mode */}
              <div className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
                  <button
                    type="button"
                    onClick={() => setShowSaveTechPanel(v => !v)}
                    className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300 hover:text-cyan-200 cursor-pointer"
                  >
                    <Icon name="Cpu" size={14} />
                    <span>Recomendaciones Técnicas y Medio de Emisión (Opcional)</span>
                    <Icon name={showSaveTechPanel ? 'ChevronUp' : 'ChevronDown'} size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoDetectSaveTech}
                    className="px-3 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/35 border border-purple-400/40 text-purple-200 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Icon name="Sparkles" size={12} />
                    Auto-detectar Recomendación
                  </button>
                </div>

                {showSaveTechPanel && (
                  <div className="p-3.5 border-t border-white/10 space-y-3 text-xs">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Medios de Radiación Recomendados
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {RADIATION_MEDIUMS.map(m => {
                          const active = saveTechRec.recommendedMediums.includes(m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => toggleSaveMedium(m.id)}
                              className={`px-2.5 py-1 rounded-full border text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                                active
                                  ? `${m.badgeClass} shadow-[0_0_10px_rgba(34,211,238,0.2)]`
                                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                              }`}
                            >
                              <Icon name={m.iconName} size={11} />
                              {m.shortLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        value={saveTechRec.primaryMediumLabel}
                        onChange={e => setSaveTechRec(prev => ({ ...prev, primaryMediumLabel: e.target.value }))}
                        placeholder="Medio principal (ej. Auriculares Estéreo)"
                        className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={saveTechRec.recommendedVolume}
                        onChange={e => setSaveTechRec(prev => ({ ...prev, recommendedVolume: e.target.value }))}
                        placeholder="Volumen recomendado"
                        className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={saveTechRec.recommendedVoltage || ''}
                        onChange={e => setSaveTechRec(prev => ({ ...prev, recommendedVoltage: e.target.value }))}
                        placeholder="Voltaje (ej. 5 V - 12 V)"
                        className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={saveTechRec.recommendedAmperage || ''}
                        onChange={e => setSaveTechRec(prev => ({ ...prev, recommendedAmperage: e.target.value }))}
                        placeholder="Amperaje (ej. 250 mA)"
                        className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={saveTechRec.recommendedWatts || ''}
                        onChange={e => setSaveTechRec(prev => ({ ...prev, recommendedWatts: e.target.value }))}
                        placeholder="Watts (ej. 2 W - 12 W)"
                        className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={saveTechRec.recommendedDuration || ''}
                        onChange={e => setSaveTechRec(prev => ({ ...prev, recommendedDuration: e.target.value }))}
                        placeholder="Duración (ej. 20 - 45 min)"
                        className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                    <textarea
                      value={saveTechRec.usageMode}
                      onChange={e => setSaveTechRec(prev => ({ ...prev, usageMode: e.target.value }))}
                      placeholder="Modo de uso / protocolo técnico..."
                      rows={2}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none resize-none"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                  {fs.user && fs.brains.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 bg-black/50 border border-purple-500/30 rounded-lg px-2 py-1">
                      <Icon name="Brain" size={12} className="text-purple-300" />
                      <select
                        aria-label="Cerebro destino al guardar"
                        value={fs.selectedBrainId || ''}
                        onChange={(e) => fs.selectBrain(e.target.value)}
                        className="bg-transparent text-[11px] font-bold text-purple-200 focus:outline-none cursor-pointer"
                      >
                        {fs.brains.map((b) => (
                          <option key={b.id} value={b.id} className="bg-[#0a0f1f] text-white">
                            {b.name} ({b.accessLevel.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </span>
                  )}
                  <span>
                    Carpeta destino: <strong className="text-cyan-300">{currentFolder.name}</strong> ·{' '}
                    {currentConfig?.oscillators?.length || 0} osciladores activos
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!saveFileName.trim() || (fs.user ? !fs.canWriteCurrentBrain : false)}
                  className="w-full sm:w-auto px-8 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs transition-all border bg-cyan-500/20 hover:bg-cyan-500 text-cyan-200 hover:text-black border-cyan-400/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Guardar Partícula
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-400 truncate max-w-full">
                {selectedNode?.type === 'file' ? (
                  <>
                    Seleccionado: <strong className="text-cyan-300">{selectedNode.name}</strong> (
                    {selectedNode.content?.oscillators?.length || 0} osciladores)
                  </>
                ) : (
                  'Selecciona una partícula para cargar, mezclar o editar'
                )}
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedNode?.type === 'file' && selectedNode.content) {
                      onFileSelect(selectedNode.content, true);
                      onClose();
                    }
                  }}
                  disabled={!selectedNode || selectedNode.type !== 'file'}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs border bg-purple-950/40 text-purple-200 border-purple-500/50 hover:bg-purple-900/60 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  + Mezclar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedNode?.type === 'file' && selectedNode.content) {
                      onFileSelect(selectedNode.content, false);
                      onClose();
                    }
                  }}
                  disabled={!selectedNode || selectedNode.type !== 'file'}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs border bg-cyan-950/50 text-cyan-200 border-cyan-500/50 hover:bg-cyan-500 hover:text-black disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Cargar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* INTERNAL MODAL: FULL PARTICLE EDITOR */}
        {editingParticle && (
          <div
            className="absolute inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6"
            onClick={() => setEditingParticle(null)}
          >
            <div
              className="w-full max-w-3xl bg-[#0a0f1f] border border-cyan-500/40 rounded-3xl shadow-[0_0_50px_rgba(34,211,238,0.25)] flex flex-col max-h-[88vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-black/40 shrink-0">
                <div className="flex items-center gap-2.5">
                  <Icon name="Edit3" size={18} className="text-cyan-400" />
                  <h3 className="text-base font-bold text-white">Editar Partícula Personal</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingParticle(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                >
                  <Icon name="X" size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Categoría
                    </label>
                    <select
                      value={editCategory}
                      onChange={e => setEditCategory(e.target.value)}
                      className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                    >
                      {EDITABLE_CATEGORIES.map(c => (
                        <option key={c.id} value={c.id} className="bg-slate-900">
                          {c.label}
                        </option>
                      ))}
                      <option value="__custom__" className="bg-slate-900">
                        Categoría Personalizada...
                      </option>
                    </select>
                  </div>
                </div>

                {editCategory === '__custom__' && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Nombre de Categoría Personalizada
                    </label>
                    <input
                      type="text"
                      value={editCustomCategory}
                      onChange={e => setEditCustomCategory(e.target.value)}
                      placeholder="Ej. Meditación Solar"
                      className="w-full bg-black/60 border border-cyan-500/30 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Descripción
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    rows={2}
                    className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none resize-none"
                  />
                </div>

                {/* Oscillators Editor */}
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <Icon name="Sliders" size={14} />
                      Osciladores ({editOscillators.length})
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {currentConfig && currentConfig.oscillators && currentConfig.oscillators.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setEditOscillators(
                              currentConfig.oscillators.map(o => ({ ...o, id: o.id || crypto.randomUUID() }))
                            )
                          }
                          className="px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-200 border border-cyan-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Icon name="Zap" size={12} />
                          Reemplazar con activos actuales ({currentConfig.oscillators.length})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setEditOscillators(prev => [
                            ...prev,
                            {
                              id: crypto.randomUUID(),
                              frequency: 432,
                              type: 'sine',
                              volume: 0.5,
                              panX: 0,
                              panY: 0,
                              panZ: 0,
                              isPlaying: true,
                              isIndependent: false,
                              color: '#38bdf8',
                              name: `Capa ${prev.length + 1}`
                            }
                          ])
                        }
                        className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Icon name="Plus" size={12} />
                        Agregar Capa
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {editOscillators.map((osc, idx) => (
                      <div
                        key={osc.id || idx}
                        className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center bg-white/[0.03] border border-white/10 rounded-xl p-2.5 text-xs"
                      >
                        <input
                          type="text"
                          value={osc.name || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setEditOscillators(prev =>
                              prev.map((item, i) => (i === idx ? { ...item, name: val } : item))
                            );
                          }}
                          placeholder={`Capa ${idx + 1}`}
                          className="col-span-2 sm:col-span-3 bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs"
                        />
                        <div className="col-span-1 sm:col-span-3 flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={osc.frequency}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0.1;
                              setEditOscillators(prev =>
                                prev.map((item, i) => (i === idx ? { ...item, frequency: val } : item))
                              );
                            }}
                            className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-cyan-300 font-mono text-xs"
                          />
                          <span className="text-[10px] text-slate-400">Hz</span>
                        </div>
                        <select
                          value={osc.type}
                          onChange={e => {
                            const val = e.target.value as WaveType;
                            setEditOscillators(prev =>
                              prev.map((item, i) => (i === idx ? { ...item, type: val } : item))
                            );
                          }}
                          className="col-span-1 sm:col-span-2 bg-black/60 border border-white/10 rounded-lg px-1.5 py-1.5 text-purple-200 text-xs"
                        >
                          {WAVE_OPTIONS.map(w => (
                            <option key={w.value} value={w.value} className="bg-slate-900">
                              {w.label}
                            </option>
                          ))}
                        </select>
                        <div className="col-span-1 sm:col-span-2 flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">Vol</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={Math.round((osc.volume ?? 0.5) * 100)}
                            onChange={e => {
                              const pct = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                              setEditOscillators(prev =>
                                prev.map((item, i) => (i === idx ? { ...item, volume: pct / 100 } : item))
                              );
                            }}
                            className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-emerald-300 font-mono text-xs"
                          />
                        </div>
                        <div className="col-span-1 sm:col-span-2 flex items-center justify-between gap-1">
                          <input
                            type="number"
                            step="0.1"
                            min="-1"
                            max="1"
                            value={osc.panX ?? 0}
                            onChange={e => {
                              const pan = Math.max(-1, Math.min(1, parseFloat(e.target.value) || 0));
                              setEditOscillators(prev =>
                                prev.map((item, i) => (i === idx ? { ...item, panX: pan } : item))
                              );
                            }}
                            title="Pan X (-1 a 1)"
                            className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-slate-200 font-mono text-xs"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setEditOscillators(prev => prev.filter((_, i) => i !== idx))
                            }
                            disabled={editOscillators.length <= 1}
                            className="p-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/35 text-red-300 disabled:opacity-30 cursor-pointer"
                            title="Quitar capa"
                          >
                            <Icon name="Trash2" size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Technical Recommendations Editor */}
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                      <Icon name="Cpu" size={14} />
                      Recomendaciones Técnicas
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const finalCat =
                          editCategory === '__custom__' ? editCustomCategory : editCategory;
                        setEditTechRec(
                          autoSuggestTechnicalRecommendation(editOscillators, finalCat, editName)
                        );
                      }}
                      className="px-3 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/35 border border-purple-400/40 text-purple-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Icon name="Sparkles" size={12} />
                      Auto-calcular por frecuencias
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {RADIATION_MEDIUMS.map(m => {
                      const active = editTechRec.recommendedMediums.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleEditMedium(m.id)}
                          className={`px-2.5 py-1 rounded-full border text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                            active
                              ? m.badgeClass
                              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                          }`}
                        >
                          <Icon name={m.iconName} size={11} />
                          {m.shortLabel}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[9px] uppercase text-slate-400 mb-1">Medio Principal</label>
                      <input
                        type="text"
                        value={editTechRec.primaryMediumLabel}
                        onChange={e =>
                          setEditTechRec(prev => ({ ...prev, primaryMediumLabel: e.target.value }))
                        }
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase text-slate-400 mb-1">Volumen Recomendado</label>
                      <input
                        type="text"
                        value={editTechRec.recommendedVolume}
                        onChange={e =>
                          setEditTechRec(prev => ({ ...prev, recommendedVolume: e.target.value }))
                        }
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase text-slate-400 mb-1">Voltaje</label>
                      <input
                        type="text"
                        value={editTechRec.recommendedVoltage || ''}
                        onChange={e =>
                          setEditTechRec(prev => ({ ...prev, recommendedVoltage: e.target.value }))
                        }
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase text-slate-400 mb-1">Amperaje</label>
                      <input
                        type="text"
                        value={editTechRec.recommendedAmperage || ''}
                        onChange={e =>
                          setEditTechRec(prev => ({ ...prev, recommendedAmperage: e.target.value }))
                        }
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase text-slate-400 mb-1">Watts</label>
                      <input
                        type="text"
                        value={editTechRec.recommendedWatts || ''}
                        onChange={e =>
                          setEditTechRec(prev => ({ ...prev, recommendedWatts: e.target.value }))
                        }
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase text-slate-400 mb-1">Duración</label>
                      <input
                        type="text"
                        value={editTechRec.recommendedDuration || ''}
                        onChange={e =>
                          setEditTechRec(prev => ({ ...prev, recommendedDuration: e.target.value }))
                        }
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase text-slate-400 mb-1">Modo de Uso</label>
                    <textarea
                      value={editTechRec.usageMode}
                      onChange={e => setEditTechRec(prev => ({ ...prev, usageMode: e.target.value }))}
                      rows={2}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[9px] uppercase text-slate-400 mb-1">Escala Hz</label>
                      <input
                        type="text"
                        value={editTechRec.frequencyScales.hz}
                        onChange={e =>
                          setEditTechRec(prev => ({
                            ...prev,
                            frequencyScales: { ...prev.frequencyScales, hz: e.target.value }
                          }))
                        }
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-cyan-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase text-slate-400 mb-1">Escala kHz</label>
                      <input
                        type="text"
                        value={editTechRec.frequencyScales.khz || ''}
                        onChange={e =>
                          setEditTechRec(prev => ({
                            ...prev,
                            frequencyScales: { ...prev.frequencyScales, khz: e.target.value }
                          }))
                        }
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-purple-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase text-slate-400 mb-1">Escala MHz</label>
                      <input
                        type="text"
                        value={editTechRec.frequencyScales.mhz || ''}
                        onChange={e =>
                          setEditTechRec(prev => ({
                            ...prev,
                            frequencyScales: { ...prev.frequencyScales, mhz: e.target.value }
                          }))
                        }
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-amber-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase text-slate-400 mb-1">Óptica (nm)</label>
                      <input
                        type="text"
                        value={editTechRec.frequencyScales.opticalNm || ''}
                        onChange={e =>
                          setEditTechRec(prev => ({
                            ...prev,
                            frequencyScales: { ...prev.frequencyScales, opticalNm: e.target.value }
                          }))
                        }
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-rose-200 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 border-t border-white/10 bg-black/50 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingParticle(null)}
                  className="px-4 py-2 rounded-xl border border-white/15 text-xs font-bold text-slate-300 hover:bg-white/5 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveParticleEdits}
                  disabled={!editName.trim()}
                  className="px-6 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase tracking-wider disabled:opacity-40 cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        )}

        {/* INTERNAL MODAL: MOVE NODE */}
        {movingNode && (
          <div
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setMovingNode(null)}
          >
            <div
              className="w-full max-w-md bg-[#0a0f1f] border border-purple-500/40 rounded-2xl p-5 space-y-4 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Icon name="Move" size={16} className="text-purple-400" />
                  Mover "{movingNode.name}"
                </h3>
                <button onClick={() => setMovingNode(null)} className="text-slate-400 hover:text-white">
                  <Icon name="X" size={16} />
                </button>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">
                  Carpeta de destino
                </label>
                <select
                  value={moveTargetFolderId}
                  onChange={e => setMoveTargetFolderId(e.target.value)}
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400"
                >
                  {allFolders
                    .filter(f => f.id !== movingNode.id)
                    .map(f => (
                      <option key={f.id} value={f.id} className="bg-slate-900">
                        {f.label}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMovingNode(null)}
                  className="px-4 py-2 rounded-xl border border-white/10 text-xs font-bold text-slate-300 hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const ok = fs.moveNode(movingNode.id, moveTargetFolderId);
                    if (ok) {
                      notify('success', `"${movingNode.name}" movido correctamente.`);
                    } else {
                      notify('error', 'No se puede mover a esa carpeta.');
                    }
                    setMovingNode(null);
                  }}
                  className="px-5 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white text-xs font-bold"
                >
                  Mover
                </button>
              </div>
            </div>
          </div>
        )}

        {/* INTERNAL MODAL: PUBLISH TO COMMUNITY VIBRAS */}
        {publishingNode && (
          <div
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setPublishingNode(null)}
          >
            <div
              className="w-full max-w-md bg-[#0a0f1f] border border-cyan-500/40 rounded-2xl p-5 space-y-4 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Icon name="Globe" size={16} className="text-cyan-400" />
                  Publicar en Comunidad (Vibras)
                </h3>
                <button onClick={() => setPublishingNode(null)} className="text-slate-400 hover:text-white">
                  <Icon name="X" size={16} />
                </button>
              </div>
              <p className="text-xs text-slate-300">
                Se publicará <strong className="text-cyan-200">{publishingNode.name}</strong> con{' '}
                {publishingNode.content?.oscillators?.length || 0} osciladores y su recomendación técnica.
              </p>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Categoría Pública</label>
                <select
                  value={publishCategory}
                  onChange={e => setPublishCategory(e.target.value)}
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                >
                  {EDITABLE_CATEGORIES.map(c => (
                    <option key={c.id} value={c.id} className="bg-slate-900">
                      {c.label}
                    </option>
                  ))}
                  <option value="__custom__" className="bg-slate-900">
                    Otra categoría...
                  </option>
                </select>
                {publishCategory === '__custom__' && (
                  <input
                    type="text"
                    value={publishCustomCategory}
                    onChange={e => setPublishCustomCategory(e.target.value)}
                    placeholder="Nombre de categoría..."
                    className="mt-2 w-full bg-black/60 border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white"
                  />
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPublishingNode(null)}
                  className="px-4 py-2 rounded-xl border border-white/10 text-xs font-bold text-slate-300 hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isPublishing}
                  onClick={handleConfirmPublish}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isPublishing && <Icon name="Loader" size={12} className="animate-spin" />}
                  Publicar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default FileExplorer;
