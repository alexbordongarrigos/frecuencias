import React, { useState, useMemo } from 'react';
import { supabase, StarseedUser, updateCommunityPreset } from '../services/starseedAuth';
import Icon from './Icon';
import {
  OscillatorState,
  FileSystemNode,
  PresetContent,
  CATEGORIES,
  RADIATION_MEDIUMS,
  RadiationMedium,
  TechnicalRecommendation
} from '../types';
import { autoSuggestTechnicalRecommendation } from '../utils/frequencyAnalysis';
import FileExplorer from './FileExplorer';
import { useFileSystem } from '../hooks/useFileSystem';

const EDITABLE_CATEGORIES = CATEGORIES.filter(c => c.id !== 'all');

const getAllFiles = (node: FileSystemNode): FileSystemNode[] => {
  let files: FileSystemNode[] = [];
  if (node.type === 'file') {
    files.push(node);
  }
  if (node.children) {
    node.children.forEach(child => {
      files = files.concat(getAllFiles(child));
    });
  }
  return files;
};

interface Props {
  onClose: () => void;
  oscillators: OscillatorState[];
  user: StarseedUser;
  editingPreset?: FileSystemNode;
}

const PublishParticleModal: React.FC<Props> = ({ onClose, oscillators, user, editingPreset }) => {
  const isEditMode = Boolean(editingPreset);
  const initialCategory = editingPreset?.content?.category || EDITABLE_CATEGORIES[0]?.id || 'solfeggio';
  const isKnownInitCat = EDITABLE_CATEGORIES.some(c => c.id === initialCategory);

  const [title, setTitle] = useState(editingPreset?.name || '');
  const [description, setDescription] = useState(editingPreset?.content?.description || '');
  const [sourceMode, setSourceMode] = useState<'current' | 'library'>('current');
  const [useCurrentForEdit, setUseCurrentForEdit] = useState(false);
  const [selectedFileContent, setSelectedFileContent] = useState<PresetContent | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [category, setCategory] = useState<string>(isKnownInitCat ? initialCategory : '__custom__');
  const [customCategory, setCustomCategory] = useState<string>(isKnownInitCat ? '' : initialCategory);

  const [showOscPreview, setShowOscPreview] = useState(false);
  const [showTechSection, setShowTechSection] = useState(Boolean(editingPreset?.content?.technicalRecommendation));

  const initialOscs = useMemo(() => {
    if (isEditMode && editingPreset?.content?.oscillators) {
      return editingPreset.content.oscillators;
    }
    return oscillators;
  }, [isEditMode, editingPreset, oscillators]);

  const [techRec, setTechRec] = useState<TechnicalRecommendation>(() => {
    if (editingPreset?.content?.technicalRecommendation) {
      return {
        ...editingPreset.content.technicalRecommendation,
        frequencyScales: { ...editingPreset.content.technicalRecommendation.frequencyScales }
      };
    }
    return autoSuggestTechnicalRecommendation(initialOscs, initialCategory, editingPreset?.name || '');
  });

  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fs = useFileSystem();

  const effectiveCategory =
    category === '__custom__' ? customCategory.trim() || 'synergy' : category;

  const activeOscillators = useMemo<OscillatorState[]>(() => {
    if (isEditMode) {
      if (useCurrentForEdit && oscillators.length > 0) return oscillators;
      return editingPreset?.content?.oscillators || oscillators;
    }
    if (sourceMode === 'library') {
      return selectedFileContent?.oscillators || [];
    }
    return oscillators;
  }, [isEditMode, useCurrentForEdit, editingPreset, oscillators, sourceMode, selectedFileContent]);

  const handleAutoFillTech = () => {
    const suggested = autoSuggestTechnicalRecommendation(activeOscillators, effectiveCategory, title);
    setTechRec(suggested);
    setShowTechSection(true);
  };

  const toggleMedium = (mediumId: RadiationMedium) => {
    setTechRec(prev => {
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

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('El título es obligatorio.');
      return;
    }

    if (!isEditMode && sourceMode === 'library' && (!selectedFileContent || !selectedFileContent.oscillators)) {
      setError('Selecciona un archivo de tu biblioteca para publicar.');
      return;
    }

    if (activeOscillators.length === 0) {
      setError('No hay frecuencias para publicar.');
      return;
    }

    setIsPublishing(true);
    setError(null);

    try {
      const finalTech = showTechSection
        ? techRec
        : autoSuggestTechnicalRecommendation(activeOscillators, effectiveCategory, title.trim());

      const baseContent: PresetContent = isEditMode
        ? (editingPreset?.content || { oscillators: activeOscillators, dateCreated: Date.now() })
        : sourceMode === 'library' && selectedFileContent
        ? selectedFileContent
        : { oscillators: activeOscillators, dateCreated: Date.now() };

      const contentPayload: PresetContent = {
        ...baseContent,
        oscillators: activeOscillators,
        description: description.trim(),
        tags: baseContent.tags && baseContent.tags.length > 0 ? baseContent.tags : ['omni', 'frecuencias'],
        category: effectiveCategory,
        authorId: user.id,
        authorName: user.displayName,
        isPublic: true,
        technicalRecommendation: finalTech,
        dateCreated: baseContent.dateCreated || Date.now(),
        updatedAt: Date.now()
      };

      if (isEditMode && editingPreset) {
        await updateCommunityPreset(editingPreset.id, user.id, {
          name: title.trim(),
          category: effectiveCategory,
          content: contentPayload
        });
      } else {
        const payload = {
          id: crypto.randomUUID(),
          name: title.trim(),
          content: contentPayload,
          author_id: user.id,
          is_public: true,
          category: effectiveCategory
        };

        const { error: dbError } = await supabase.from('omni_presets').insert([payload]);
        if (dbError) throw dbError;
      }

      onClose();
    } catch (err: any) {
      console.error('Error al publicar/actualizar:', err);
      setError(err?.message || 'Error desconocido al publicar la partícula.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md">
      <div className="bg-[#091022] border border-cyan-500/30 rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(34,211,238,0.2)] animate-fade-in">
        <div className="p-4 sm:p-5 border-b border-white/10 flex justify-between items-center bg-black/40 shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Icon name={isEditMode ? 'Edit3' : 'Upload'} size={18} className="text-cyan-400" />
            {isEditMode ? 'Editar Partícula Pública' : 'Publicar Partícula en Vibras'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        <form onSubmit={handlePublish} className="p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-4">
          <p className="text-xs sm:text-sm text-slate-300">
            {isEditMode
              ? 'Actualiza los metadatos, categoría, descripción o recomendaciones técnicas de tu partícula comunitaria.'
              : <>Comparte tu configuración frecuencial (<strong>{activeOscillators.length} osciladores</strong>) con la red StarSeed OS.</>}
          </p>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-medium">
              {error}
            </div>
          )}

          {!isEditMode ? (
            <div className="flex gap-2 p-1 bg-black/50 border border-white/10 rounded-xl">
              <button
                type="button"
                onClick={() => setSourceMode('current')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  sourceMode === 'current' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:bg-white/5'
                }`}
              >
                Frecuencias Actuales ({oscillators.length})
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('library')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  sourceMode === 'library' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-slate-400 hover:bg-white/5'
                }`}
              >
                Desde mi Biblioteca
              </button>
            </div>
          ) : (
            oscillators.length > 0 && (
              <label className="flex items-center gap-2.5 bg-cyan-950/25 border border-cyan-500/25 rounded-xl p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCurrentForEdit}
                  onChange={e => setUseCurrentForEdit(e.target.checked)}
                  className="accent-cyan-500 w-4 h-4"
                />
                <span className="text-xs text-cyan-100">
                  Reemplazar frecuencias publicadas con los <strong>{oscillators.length} osciladores activos</strong> del generador
                </span>
              </label>
            )
          )}

          {!isEditMode && sourceMode === 'library' && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Seleccionar Archivo
              </label>
              <div className="flex items-center gap-3 bg-black/50 border border-white/10 rounded-xl px-4 py-2.5">
                <Icon name="FileText" size={18} className={selectedFileName ? 'text-purple-400' : 'text-slate-500'} />
                <span className="flex-1 text-xs sm:text-sm font-medium text-slate-300 truncate">
                  {selectedFileName || 'Ningún archivo seleccionado'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowFileExplorer(true)}
                  className="px-3 py-1.5 bg-purple-500/20 text-purple-200 text-xs font-bold rounded-lg hover:bg-purple-500/30 transition-colors border border-purple-500/30 cursor-pointer"
                >
                  Explorar
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Título de la Partícula
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ej. Frecuencia Pineal 936Hz"
              className="w-full bg-black/50 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400 transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Categoría
            </label>
            <div className="relative">
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-black/50 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400 transition-colors appearance-none cursor-pointer"
              >
                {EDITABLE_CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id} className="bg-slate-900 text-white">
                    {cat.label}
                  </option>
                ))}
                <option value="__custom__" className="bg-slate-900 text-white">
                  Categoría Personalizada...
                </option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400">
                <Icon name="ChevronDown" size={16} />
              </div>
            </div>
            {category === '__custom__' && (
              <input
                type="text"
                value={customCategory}
                onChange={e => setCustomCategory(e.target.value)}
                placeholder="Escribe la categoría..."
                className="mt-2 w-full bg-black/50 border border-cyan-500/30 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              />
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Descripción (Opcional)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Propósito, efectos esperados o notas sobre esta configuración..."
              className="w-full bg-black/50 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400 transition-colors h-20 resize-none"
            />
          </div>

          {/* Collapsible Frequencies Preview */}
          <div className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowOscPreview(v => !v)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-200 hover:text-cyan-300 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Icon name="Sliders" size={14} className="text-amber-400" />
                Vista Previa de Frecuencias ({activeOscillators.length})
              </span>
              <Icon name={showOscPreview ? 'ChevronUp' : 'ChevronDown'} size={14} />
            </button>

            {showOscPreview && (
              <div className="px-4 pb-3 pt-1 border-t border-white/5 space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                {activeOscillators.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">No hay osciladores cargados.</p>
                ) : (
                  activeOscillators.map((osc, i) => (
                    <div
                      key={osc.id || i}
                      className="flex flex-wrap items-center justify-between gap-2 bg-white/[0.03] border border-white/5 rounded-lg px-2.5 py-1.5 text-[11px] font-mono"
                    >
                      <span className="text-white font-sans font-semibold truncate max-w-[140px]">
                        {osc.name || `Capa ${i + 1}`}
                      </span>
                      <span className="text-cyan-300 font-bold">{osc.frequency} Hz</span>
                      <span className="text-purple-300">{osc.type}</span>
                      <span className="text-emerald-300">{Math.round((osc.volume ?? 0.5) * 100)}%</span>
                      <span className="text-slate-400">Pan {Number(osc.panX ?? 0).toFixed(1)}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Collapsible Optional Technical Recommendations */}
          <div className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <button
                type="button"
                onClick={() => setShowTechSection(v => !v)}
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300 hover:text-cyan-200 cursor-pointer"
              >
                <Icon name="Cpu" size={14} />
                <span>Recomendaciones Técnicas (Opcional)</span>
                <Icon name={showTechSection ? 'ChevronUp' : 'ChevronDown'} size={14} />
              </button>
              <button
                type="button"
                onClick={handleAutoFillTech}
                className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/35 border border-purple-400/40 text-purple-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Icon name="Sparkles" size={11} />
                Autocompletar desde Frecuencias
              </button>
            </div>

            {showTechSection && (
              <div className="p-4 pt-2 border-t border-white/10 space-y-3 text-xs">
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">
                    Medios de Radiación Recomendados
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {RADIATION_MEDIUMS.map(m => {
                      const active = techRec.recommendedMediums.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleMedium(m.id)}
                          className={`px-2.5 py-1 rounded-full border text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                            active
                              ? m.badgeClass
                              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                          }`}
                        >
                          <Icon name={m.iconName} size={10} />
                          {m.shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase text-slate-400 mb-1">Medio Principal</label>
                    <input
                      type="text"
                      value={techRec.primaryMediumLabel}
                      onChange={e => setTechRec(p => ({ ...p, primaryMediumLabel: e.target.value }))}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase text-slate-400 mb-1">Volumen Recomendado</label>
                    <input
                      type="text"
                      value={techRec.recommendedVolume}
                      onChange={e => setTechRec(p => ({ ...p, recommendedVolume: e.target.value }))}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase text-slate-400 mb-1">Voltaje</label>
                    <input
                      type="text"
                      value={techRec.recommendedVoltage || ''}
                      onChange={e => setTechRec(p => ({ ...p, recommendedVoltage: e.target.value }))}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase text-slate-400 mb-1">Amperios</label>
                    <input
                      type="text"
                      value={techRec.recommendedAmperage || ''}
                      onChange={e => setTechRec(p => ({ ...p, recommendedAmperage: e.target.value }))}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase text-slate-400 mb-1">Watts</label>
                    <input
                      type="text"
                      value={techRec.recommendedWatts || ''}
                      onChange={e => setTechRec(p => ({ ...p, recommendedWatts: e.target.value }))}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase text-slate-400 mb-1">Duración</label>
                    <input
                      type="text"
                      value={techRec.recommendedDuration || ''}
                      onChange={e => setTechRec(p => ({ ...p, recommendedDuration: e.target.value }))}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] uppercase text-slate-400 mb-1">Modo de Uso</label>
                  <textarea
                    value={techRec.usageMode}
                    onChange={e => setTechRec(p => ({ ...p, usageMode: e.target.value }))}
                    rows={2}
                    className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase text-slate-400 mb-1">Hz</label>
                    <input
                      type="text"
                      value={techRec.frequencyScales.hz}
                      onChange={e =>
                        setTechRec(p => ({
                          ...p,
                          frequencyScales: { ...p.frequencyScales, hz: e.target.value }
                        }))
                      }
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-cyan-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase text-slate-400 mb-1">kHz</label>
                    <input
                      type="text"
                      value={techRec.frequencyScales.khz || ''}
                      onChange={e =>
                        setTechRec(p => ({
                          ...p,
                          frequencyScales: { ...p.frequencyScales, khz: e.target.value }
                        }))
                      }
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-purple-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase text-slate-400 mb-1">MHz</label>
                    <input
                      type="text"
                      value={techRec.frequencyScales.mhz || ''}
                      onChange={e =>
                        setTechRec(p => ({
                          ...p,
                          frequencyScales: { ...p.frequencyScales, mhz: e.target.value }
                        }))
                      }
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-amber-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase text-slate-400 mb-1">Óptica (nm)</label>
                    <input
                      type="text"
                      value={techRec.frequencyScales.opticalNm || ''}
                      onChange={e =>
                        setTechRec(p => ({
                          ...p,
                          frequencyScales: { ...p.frequencyScales, opticalNm: e.target.value }
                        }))
                      }
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-rose-200 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-white/15 text-slate-300 font-bold text-xs uppercase tracking-wider hover:bg-white/5 transition-colors cursor-pointer"
              disabled={isPublishing}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPublishing || !title.trim()}
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-black font-bold text-xs uppercase tracking-wider hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(6,182,212,0.35)] flex justify-center items-center gap-2 cursor-pointer"
            >
              {isPublishing ? (
                <>
                  <Icon name="Loader" size={16} className="animate-spin" />
                  {isEditMode ? 'Guardando...' : 'Publicando...'}
                </>
              ) : (
                <>
                  <Icon name={isEditMode ? 'Check' : 'Rocket'} size={16} />
                  {isEditMode ? 'Guardar Cambios' : 'Publicar al Nexus'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {showFileExplorer && (
        <FileExplorer
          mode="load"
          fs={fs}
          onClose={() => setShowFileExplorer(false)}
          onFileSelect={content => {
            setSelectedFileContent(content);
            const fileNode = getAllFiles(fs.root).find(f => f.content === content);
            if (fileNode) {
              setSelectedFileName(fileNode.name);
              if (!title.trim()) setTitle(fileNode.name);
            } else {
              setSelectedFileName('Archivo Seleccionado');
            }
            if (content.description && !description.trim()) setDescription(content.description);
            if (content.category && EDITABLE_CATEGORIES.some(c => c.id === content.category)) {
              setCategory(content.category);
            }
            if (content.technicalRecommendation) {
              setTechRec(content.technicalRecommendation);
              setShowTechSection(true);
            }
          }}
        />
      )}
    </div>
  );
};

export default PublishParticleModal;
