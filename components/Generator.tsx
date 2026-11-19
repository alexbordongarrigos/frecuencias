import React, { useMemo, useState } from 'react';
import { useAudio } from '../hooks/useAudio';
import { useFileSystem } from '../hooks/useFileSystem';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { PresetContent, OscillatorState, WaveType } from '../types';
import { classifyPairResonance, SpectrometerResonance } from '../utils/frequencyAnalysis';
import OscillatorControls from './OscillatorControls';
import Visualizer, { VisualizerSource } from './Visualizer';
import CymaticsVisualizer3D from './CymaticsVisualizer3D';
import SpiralVisualizer from './SpiralVisualizer';
import AIGeneratorModal from './AIGeneratorModal';
import Icon from './Icon';
import FileExplorer from './FileExplorer';
import AdaptiveParticleGrid from './AdaptiveParticleGrid';

interface Props {
  audio: ReturnType<typeof useAudio>;
  isMasterPlaying: boolean;
  onStartLiveSession?: (preset: PresetContent) => void;
  sessionPermissions?: {
    canEditFrequencies: boolean;
  };
  activeVizTab?: '2d' | '3d' | 'spiral';
  onVizTabChange?: (tab: '2d' | '3d' | 'spiral') => void;
}

const ACCENT_STYLES: Record<
  SpectrometerResonance['accentColor'],
  { card: string; iconBg: string; iconText: string; badge: string }
> = {
  purple: {
    card: 'bg-purple-950/35 border-purple-500/35 hover:border-purple-400/60 shadow-[inset_0_0_20px_rgba(168,85,247,0.12)]',
    iconBg: 'bg-purple-500/15 border-purple-400/35',
    iconText: 'text-purple-300',
    badge: 'bg-purple-500/20 border-purple-400/40 text-purple-200',
  },
  cyan: {
    card: 'bg-cyan-950/35 border-cyan-500/35 hover:border-cyan-400/60 shadow-[inset_0_0_20px_rgba(34,211,238,0.12)]',
    iconBg: 'bg-cyan-500/15 border-cyan-400/35',
    iconText: 'text-cyan-300',
    badge: 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200',
  },
  emerald: {
    card: 'bg-emerald-950/35 border-emerald-500/35 hover:border-emerald-400/60 shadow-[inset_0_0_20px_rgba(16,185,129,0.12)]',
    iconBg: 'bg-emerald-500/15 border-emerald-400/35',
    iconText: 'text-emerald-300',
    badge: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200',
  },
  amber: {
    card: 'bg-amber-950/35 border-amber-500/35 hover:border-amber-400/60 shadow-[inset_0_0_20px_rgba(245,158,11,0.12)]',
    iconBg: 'bg-amber-500/15 border-amber-400/35',
    iconText: 'text-amber-300',
    badge: 'bg-amber-500/20 border-amber-400/40 text-amber-200',
  },
  pink: {
    card: 'bg-pink-950/35 border-pink-500/35 hover:border-pink-400/60 shadow-[inset_0_0_20px_rgba(236,72,153,0.12)]',
    iconBg: 'bg-pink-500/15 border-pink-400/35',
    iconText: 'text-pink-300',
    badge: 'bg-pink-500/20 border-pink-400/40 text-pink-200',
  },
};

const CLASSIFICATION_ICONS: Record<SpectrometerResonance['classification'], string> = {
  interferencia_binaural: 'Headphones',
  modulacion_amplitud: 'Waves',
  acoplamiento_fase: 'Compass',
  consonancia_armonica: 'Sparkles',
  heterodino_diferencial: 'Zap',
};

const Generator: React.FC<Props> = ({
  audio,
  isMasterPlaying,
  onStartLiveSession,
  sessionPermissions,
  activeVizTab = '2d',
  onVizTabChange,
}) => {
  const {
    oscillators,
    addOscillator,
    removeOscillator,
    updateOscillator,
    setAllOscillators,
    getCombinedAnalyser,
    getOscillatorAnalyser,
  } = audio;

  const canEdit = sessionPermissions ? sessionPermissions.canEditFrequencies : true;
  const history = useUndoRedo(oscillators, setAllOscillators);
  const fs = useFileSystem();

  const [showExplorer, setShowExplorer] = useState(false);
  const [explorerMode, setExplorerMode] = useState<'save' | 'load'>('save');
  const [showAIModal, setShowAIModal] = useState(false);
  const [expandAllOscillators, setExpandAllOscillators] = useState(false);
  const [showGlobalControls, setShowGlobalControls] = useState(false);
  const [globalVolumeSlider, setGlobalVolumeSlider] = useState(0.5);
  const [sourceUpdateFeedback, setSourceUpdateFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isSourceModified = useMemo(
    () => fs.isSourceModified(oscillators),
    [fs.activeSourceNode, oscillators]
  );

  const handleAddOscillator = (initialState?: Partial<OscillatorState>) => {
    if (!canEdit) return;
    history.pushState(oscillators);
    addOscillator(initialState);
  };

  const handleRemoveOscillator = (id: string) => {
    if (!canEdit) return;
    history.pushState(oscillators);
    removeOscillator(id);
  };

  const handleUpdateOscillator = (id: string, changes: Partial<OscillatorState>) => {
    if (!canEdit) return;
    history.pushState(oscillators);
    updateOscillator(id, changes);
  };

  const handleApplyAIPreset = (
    aiOscillators: Partial<OscillatorState>[],
    mode: 'morph' | 'blend' = 'morph'
  ) => {
    if (!canEdit) return;
    history.pushState(oscillators);
    audio.morphOscillatorsLive(aiOscillators, {
      mode,
      glideSec: 0.7,
      autoPlay: true,
    });
  };

  const loadPreset = (
    preset: PresetContent,
    mix = false,
    sourceNode?: import('../types').FileSystemNode
  ) => {
    if (!canEdit) return;
    history.pushState(oscillators);
    if (!mix) {
      fs.setActiveSourceNode(sourceNode || null);
    }
    audio.morphOscillatorsLive(preset.oscillators || [], {
      mode: mix ? 'blend' : 'morph',
      glideSec: 0.45,
      autoPlay: true,
    });
  };

  const handleExport = () => {
    const data = fs.exportSystem();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omni_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        const success = fs.importSystem(ev.target.result as string);
        if (success) alert('Backup importado correctamente. Las carpetas se han fusionado.');
        else alert('Error al importar el archivo.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Physical-Scientific Spectrometer Analysis via classifyPairResonance
  const resonanceResults = useMemo(() => {
    const active = oscillators.filter(o => o.isPlaying);
    const results: SpectrometerResonance[] = [];

    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const res = classifyPairResonance(active[i], active[j]);
        if (res) {
          results.push(res);
        }
      }
    }
    return results;
  }, [oscillators]);

  const visualizerSources: VisualizerSource[] = useMemo(() => {
    const sources: VisualizerSource[] = [];
    const combined = getCombinedAnalyser();
    if (combined) {
      sources.push({ analyser: combined, color: '#475569' });
    }

    oscillators.forEach(osc => {
      if (osc.isPlaying && osc.isIndependent) {
        const oscAnalyser = getOscillatorAnalyser(osc.id);
        if (oscAnalyser) {
          sources.push({ analyser: oscAnalyser, color: osc.color });
        }
      }
    });

    if (sources.length === 1 && sources[0].color === '#475569') {
      sources[0].color = '#22d3ee';
    }
    return sources;
  }, [oscillators, getCombinedAnalyser, getOscillatorAnalyser]);

  const activeFreqsList = useMemo(() => {
    return oscillators.filter(o => o.isPlaying).map(o => o.frequency);
  }, [oscillators]);

  return (
    <div className="animate-fade-in space-y-6 pb-24">
      {/* --- Toolbar --- */}
      <div className="flex flex-col items-center justify-center gap-3.5 sm:gap-5 art-nouveau-frame p-3 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl relative">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-center gap-2 sm:gap-3.5 relative z-10 w-full">
          <button
            onClick={audio.toggleMasterPlay}
            className={`col-span-2 sm:col-span-1 group relative flex items-center justify-center w-full sm:w-16 h-12 sm:h-16 rounded-2xl transition-all duration-300 cursor-pointer ${
              audio.isPlaying
                ? 'morph-btn-primary scale-[1.02]'
                : 'morph-btn-glass morph-accent-text'
            }`}
            title={audio.isPlaying ? 'Pausar Todo' : 'Reproducir Todo'}
          >
            <Icon name={audio.isPlaying ? 'Pause' : 'Play'} size={24} className={audio.isPlaying ? '' : 'ml-0.5'} />
            <span className="sm:hidden ml-2 text-xs font-bold uppercase tracking-widest">
              {audio.isPlaying ? 'Pausar Todo' : 'Reproducir Todo'}
            </span>
          </button>

          {/* Undo / Redo */}
          <div className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 bg-black/50 p-1.5 rounded-2xl border border-white/10">
            <button
              onClick={history.undo}
              disabled={!history.canUndo || !canEdit}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all ${
                history.canUndo && canEdit
                  ? 'bg-cyan-950/50 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-900/60 cursor-pointer'
                  : 'text-slate-600 border border-transparent cursor-not-allowed opacity-50'
              }`}
              title="Deshacer (Ctrl+Z / Cmd+Z)"
            >
              <Icon name="CornerUpLeft" size={14} />
              <span>Deshacer</span>
            </button>

            <button
              onClick={history.redo}
              disabled={!history.canRedo || !canEdit}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all ${
                history.canRedo && canEdit
                  ? 'bg-purple-950/50 text-purple-300 border border-purple-500/40 hover:bg-purple-900/60 cursor-pointer'
                  : 'text-slate-600 border border-transparent cursor-not-allowed opacity-50'
              }`}
              title="Rehacer (Ctrl+Y / Cmd+Shift+Z)"
            >
              <Icon name="CornerUpRight" size={14} />
              <span>Rehacer</span>
            </button>
          </div>

          <button
            onClick={() => setShowAIModal(true)}
            disabled={!canEdit}
            className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 px-3.5 sm:px-5 py-3 sm:py-3.5 w-full sm:w-auto bg-gradient-to-r from-cyan-950/70 via-purple-950/70 to-pink-950/70 hover:from-cyan-900/80 hover:to-purple-900/80 text-cyan-100 rounded-2xl text-xs sm:text-sm font-bold uppercase tracking-wider sm:tracking-widest transition-all border-2 border-cyan-400/50 shadow-[0_0_25px_rgba(34,211,238,0.25)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Icon name="Sparkles" size={17} className="text-cyan-300 shrink-0" />
            <span className="whitespace-nowrap">Cronos · Astraura IA</span>
          </button>

          <button
            onClick={() => { setExplorerMode('save'); setShowExplorer(true); }}
            className="flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 sm:py-3.5 w-full sm:w-auto bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-200 rounded-2xl text-[11px] sm:text-sm font-bold uppercase tracking-wider sm:tracking-widest transition-all border-2 border-cyan-500/30 hover:border-cyan-400/50 cursor-pointer"
          >
            <Icon name="Save" size={16} />
            <span className="whitespace-nowrap truncate">Guardar Preset</span>
          </button>

          <button
            onClick={() => { setExplorerMode('load'); setShowExplorer(true); }}
            disabled={!canEdit}
            className="flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 sm:py-3.5 w-full sm:w-auto bg-purple-950/40 hover:bg-purple-900/60 text-purple-200 rounded-2xl text-[11px] sm:text-sm font-bold uppercase tracking-wider sm:tracking-widest transition-all border-2 border-purple-500/30 hover:border-purple-400/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Icon name="Folder" size={16} />
            <span className="whitespace-nowrap truncate">Cargar Preset</span>
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/40 border border-white/10 text-[9px] font-mono text-cyan-300 max-w-[140px] truncate">
              {fs.user ? (fs.selectedBrain?.name || 'Cerebro') : (fs.localLocationMeta?.label || 'Local')}
            </span>
          </button>

          <button
            onClick={() => {
              if (onStartLiveSession) {
                onStartLiveSession({
                  oscillators,
                  dateCreated: Date.now(),
                  description: 'Sesión en vivo de Omni-Frecuencias',
                });
              }
            }}
            className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3.5 w-full sm:w-auto bg-red-950/40 hover:bg-red-900/60 text-red-200 rounded-2xl text-[11px] sm:text-sm font-bold uppercase tracking-wider sm:tracking-widest transition-all border-2 border-red-500/30 hover:border-red-400/50 cursor-pointer"
          >
            <Icon name="Radio" size={16} />
            <span className="whitespace-nowrap">Transmitir en Vivo</span>
          </button>
        </div>

        {/* Active Source File Status & In-Place Folder Update Bar */}
        {fs.activeSourceNode && (
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-black/55 border border-emerald-500/30 relative z-10 text-xs">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <Icon name="FolderOpen" size={15} className="text-emerald-300 shrink-0" />
              <span className="text-slate-300 truncate">
                Archivo origen: <strong className="text-white">{fs.activeSourceNode.folderPath} / {fs.activeSourceNode.name}</strong>
              </span>
              {fs.activeSourceNode.brainName && (
                <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-400/30 text-[10px] font-bold text-purple-200">
                  {fs.activeSourceNode.brainName}
                </span>
              )}
              {isSourceModified && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/45 text-[10px] font-bold uppercase tracking-wider text-amber-200 animate-pulse">
                  Modificado
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={!canEdit || (fs.user ? !fs.canWriteCurrentBrain : false)}
                onClick={() => {
                  const res = fs.updateSourceNodeInPlace({
                    content: {
                      oscillators,
                      updatedAt: Date.now(),
                    },
                  });
                  if (res.ok) {
                    setSourceUpdateFeedback({
                      type: 'success',
                      text: `Archivo origen actualizado en "${res.updatedPath}"`,
                    });
                  } else {
                    setSourceUpdateFeedback({
                      type: 'error',
                      text: res.error || 'No se pudo actualizar el archivo origen.',
                    });
                  }
                  setTimeout(() => setSourceUpdateFeedback(null), 4000);
                }}
                className={`px-3.5 py-1.5 rounded-xl font-bold uppercase tracking-wider text-[10px] border flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  isSourceModified
                    ? 'bg-emerald-500 text-black border-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.45)]'
                    : 'bg-emerald-950/60 hover:bg-emerald-500/30 text-emerald-200 border-emerald-500/40'
                }`}
              >
                <Icon name="Save" size={12} />
                <span>Actualizar Origen</span>
              </button>
              <button
                type="button"
                onClick={() => fs.setActiveSourceNode(null)}
                title="Desvincular archivo origen"
                aria-label="Desvincular archivo origen"
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white cursor-pointer"
              >
                <Icon name="X" size={13} />
              </button>
            </div>
          </div>
        )}

        {sourceUpdateFeedback && (
          <div
            className={`w-full px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 relative z-10 ${
              sourceUpdateFeedback.type === 'success'
                ? 'bg-emerald-950/75 border-emerald-500/45 text-emerald-200'
                : 'bg-red-950/75 border-red-500/45 text-red-200'
            }`}
          >
            <span>{sourceUpdateFeedback.text}</span>
            <button onClick={() => setSourceUpdateFeedback(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
              <Icon name="X" size={13} />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 pt-3 border-t border-white/10 w-full max-w-md relative z-10">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-xl transition-colors border border-white/5"
            title="Exportar Backup v.7"
          >
            <Icon name="Download" size={14} className="text-cyan-500/80" /> Exportar v.7
          </button>
          <label
            className={`flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-xl cursor-pointer transition-colors border border-white/5 ${
              !canEdit ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title="Importar Backup"
          >
            <Icon name="Upload" size={14} className="text-purple-500/80" /> Importar
            <input type="file" accept=".json" onChange={handleImport} disabled={!canEdit} className="hidden" />
          </label>
        </div>
      </div>

      {showAIModal && (
        <AIGeneratorModal
          onClose={() => setShowAIModal(false)}
          onApplyPreset={(oscs, mode) => handleApplyAIPreset(oscs, mode)}
          audio={audio}
          fs={fs}
          activeVizTab={activeVizTab}
          onVizTabChange={onVizTabChange}
          canEdit={canEdit}
        />
      )}

      {showExplorer && (
        <FileExplorer
          mode={explorerMode}
          fs={fs}
          onClose={() => setShowExplorer(false)}
          onFileSelect={loadPreset}
          currentConfig={{
            oscillators,
            dateCreated: Date.now(),
            description: 'Configuración generada',
          }}
        />
      )}

      {/* --- ESPECTRÓMETRO (No overflow-hidden so Portals/Visualizers adapt freely) --- */}
      <div className="relative p-4 sm:p-6 rounded-3xl art-nouveau-frame space-y-5">
        <div className="flex flex-col items-center text-center gap-4 border-b border-white/10 pb-5">
          {/* Centered Spectrometer Title & Mode Tabs */}
          <div className="flex flex-col items-center gap-3 w-full">
            <div className="flex items-center justify-center gap-3">
              <div className="p-2.5 rounded-xl morph-pill">
                <Icon name="Activity" size={22} className="morph-accent-text" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-display font-black starseed-text-gradient tracking-wide">
                  Espectrómetro
                </h2>
                <p className="text-[10px] text-slate-300 uppercase tracking-widest font-bold">
                  Análisis de Interferencia Constructiva, Diferenciales de Frecuencia (Δf) y Coherencia de Fase
                </p>
              </div>
            </div>

            {/* Spectrometer Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 quantum-glass p-1.5 rounded-2xl">
              <button
                onClick={() => onVizTabChange && onVizTabChange('2d')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeVizTab === '2d'
                    ? 'morph-tab-active'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 border border-transparent'
                }`}
              >
                <Icon name="Activity" size={14} />
                <span>Ondas 2D</span>
              </button>
              <button
                onClick={() => onVizTabChange && onVizTabChange('3d')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeVizTab === '3d'
                    ? 'morph-tab-active'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 border border-transparent'
                }`}
              >
                <Icon name="Hexagon" size={14} />
                <span>Cimática 3D</span>
              </button>
              <button
                onClick={() => onVizTabChange && onVizTabChange('spiral')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeVizTab === 'spiral'
                    ? 'morph-tab-active'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 border border-transparent'
                }`}
              >
                <Icon name="Aperture" size={14} />
                <span>Espiral Holográfico</span>
              </button>
            </div>
          </div>

          {/* Physical-Scientific Resonance Interactions Display */}
          <div className="w-full bg-black/60 rounded-2xl border border-white/10 p-3.5 sm:p-4 max-h-72 overflow-y-auto custom-scrollbar shadow-[inset_0_0_30px_rgba(0,0,0,0.85)]">
            {resonanceResults.length === 0 ? (
              <div className="py-5 flex flex-col items-center justify-center text-center text-xs text-slate-400 gap-2">
                <Icon name="Waves" size={24} className="text-cyan-500/50" />
                <span className="font-bold uppercase tracking-widest text-[11px] text-slate-300">
                  Sin interacciones espectrales entre pares activos
                </span>
                <span className="text-[11px] text-slate-500 max-w-lg">
                  Activa al menos 2 osciladores dentro de un rango de diferencia ≤ 250 Hz o con proporción armónica exacta para observar interferencia binaural, modulación Δf, fase o consonancia.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                {resonanceResults.map(res => {
                  const style = ACCENT_STYLES[res.accentColor];
                  const iconName = CLASSIFICATION_ICONS[res.classification];
                  const deltaFormatted = res.deltaHz < 1 ? res.deltaHz.toFixed(3) : res.deltaHz.toFixed(2);
                  return (
                    <div
                      key={res.id}
                      className={`rounded-2xl border p-3.5 transition-all duration-300 flex flex-col gap-2.5 ${style.card}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className={`p-2 rounded-xl border shrink-0 ${style.iconBg}`}>
                            <Icon name={iconName} size={17} className={style.iconText} />
                          </div>
                          <div className="min-w-0">
                            <div className={`text-xs font-black uppercase tracking-wider leading-tight ${style.iconText}`}>
                              {res.label}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                              {res.subtitle}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-base font-display font-black text-white leading-none">
                            Δf {deltaFormatted} <span className="text-[10px] text-slate-400">Hz</span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 mt-1">
                            f₁+f₂ = {res.sumHz.toFixed(2)} Hz
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 text-[10px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-md border font-mono font-bold ${style.badge}`}>
                            f₂:f₁ = {res.ratio}
                          </span>
                          {res.intervalName && (
                            <span className="px-2 py-0.5 rounded-md border border-white/15 bg-white/5 text-white font-bold">
                              {res.intervalName}
                            </span>
                          )}
                        </div>
                        <span className="text-slate-300 font-semibold">
                          {res.sourceA} ({res.freqA.toFixed(1)} Hz) ↔ {res.sourceB} ({res.freqB.toFixed(1)} Hz)
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
                        <span className="font-bold text-slate-200">{res.bandName}</span>
                        <span className="truncate">{res.bandDescription}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Visualizer Canvas Area */}
        <div className="w-full">
          {activeVizTab === '2d' && (
            <div className="w-full min-h-[280px] sm:min-h-[340px] bg-black/85 rounded-2xl border border-white/10 overflow-hidden relative shadow-[inset_0_0_40px_rgba(0,0,0,0.9)]">
              <Visualizer sources={visualizerSources} height={340} />
              <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end pointer-events-none z-20">
                <div className="flex items-center gap-2.5 px-3 py-1.5 bg-black/70 rounded-xl text-[10px] text-slate-300 border border-white/10 backdrop-blur-md">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-500 border border-slate-400" />
                  <span className="font-bold uppercase tracking-widest">Onda Combinada</span>
                </div>
                {oscillators.filter(o => o.isPlaying && o.isIndependent).map(osc => (
                  <div key={osc.id} className="flex items-center gap-2.5 px-3 py-1.5 bg-black/70 rounded-xl text-[10px] text-white border border-white/10 backdrop-blur-md">
                    <div className="w-2.5 h-2.5 rounded-full border border-white/50" style={{ background: osc.color }} />
                    <span className="font-bold uppercase tracking-widest" style={{ color: osc.color }}>
                      {osc.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeVizTab === '3d' && (
            <CymaticsVisualizer3D
              analyser={getCombinedAnalyser()}
              activeFrequencies={activeFreqsList}
              allOscillators={oscillators}
              onUpdateOscillator={handleUpdateOscillator}
              onRemoveOscillator={handleRemoveOscillator}
              getOscillatorAnalyser={getOscillatorAnalyser}
              isMasterPlaying={isMasterPlaying}
              height={420}
            />
          )}

          {activeVizTab === 'spiral' && (
            <SpiralVisualizer
              analyser={getCombinedAnalyser()}
              activeOscillators={oscillators}
              allOscillators={oscillators}
              onUpdateOscillator={handleUpdateOscillator}
              onRemoveOscillator={handleRemoveOscillator}
              getOscillatorAnalyser={getOscillatorAnalyser}
              isMasterPlaying={isMasterPlaying}
              height={420}
            />
          )}
        </div>
      </div>

      {/* --- Global Controls & Oscillator List Header (Collapsible Levelers) --- */}
      {oscillators.length > 0 && (
        <div className="art-nouveau-frame p-3.5 sm:p-4 rounded-2xl flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <button
              onClick={() => setShowGlobalControls(prev => !prev)}
              className="flex items-center gap-2 text-xs sm:text-sm morph-accent-text font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              <Icon name="Settings" size={16} />
              <span>Ajustes Globales ({oscillators.length})</span>
              <Icon name={showGlobalControls ? 'ChevronUp' : 'ChevronDown'} size={15} />
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowGlobalControls(prev => !prev)}
                className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border transition-all ${
                  showGlobalControls ? 'morph-tab-active' : 'morph-btn-glass'
                }`}
              >
                <Icon name="Sliders" size={13} />
                <span>{showGlobalControls ? 'Ocultar Nivelador Global' : 'Niveladores Globales'}</span>
              </button>

              <button
                onClick={() => setExpandAllOscillators(prev => !prev)}
                className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border transition-all ${
                  expandAllOscillators ? 'morph-tab-active' : 'morph-btn-glass'
                }`}
              >
                <Icon name={expandAllOscillators ? 'ChevronUp' : 'ChevronDown'} size={14} />
                <span>{expandAllOscillators ? 'Compactar Todas' : 'Desplegar Todas'}</span>
              </button>
            </div>
          </div>

          {showGlobalControls && (
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 pt-3 border-t border-white/10 animate-fade-in">
              <div className="flex items-center gap-3 bg-white/5 px-3.5 py-2 rounded-xl border border-white/10">
                <span className="text-[11px] text-slate-300 uppercase font-bold tracking-wider">Volumen Global</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={globalVolumeSlider}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setGlobalVolumeSlider(v);
                    audio.setGlobalVolume(v);
                  }}
                  className="w-28 sm:w-36 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:rounded-full"
                />
                <span className="text-[11px] font-mono morph-accent-text w-9 text-right">{Math.round(globalVolumeSlider * 100)}%</span>
              </div>

              <button
                onClick={() => {
                  history.pushState(oscillators);
                  audio.centerAllPositions();
                }}
                className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-4 py-2 morph-btn-glass rounded-xl"
              >
                <Icon name="Compass" size={14} className="morph-accent-text" />
                <span>Centrar Posiciones</span>
              </button>

              <div className="flex items-center gap-2.5 bg-white/5 px-3.5 py-2 rounded-xl border border-white/10">
                <span className="text-[11px] text-slate-300 uppercase font-bold tracking-wider">Onda Global</span>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      history.pushState(oscillators);
                      audio.setGlobalWaveType(e.target.value as WaveType);
                      e.target.value = '';
                    }
                  }}
                  className="bg-black/60 border border-white/15 rounded-lg text-xs morph-accent-text font-bold uppercase tracking-wider px-2.5 py-1 focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="">(Cambiar todas)</option>
                  <option value="sine">Senoidal</option>
                  <option value="square">Cuadrada</option>
                  <option value="sawtooth">Diente de sierra</option>
                  <option value="triangle">Triangular</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- Oscillator List --- */}
      <AdaptiveParticleGrid<OscillatorState | { id: '__add_oscillator__'; isAddCard: true }>
        items={[...oscillators, { id: '__add_oscillator__', isAddCard: true }]}
        getItemKey={(entry) => entry.id}
        columnsConfig={{ base: 1, lg: 2, xl: 3 }}
        gapPx={24}
        renderItem={(entry) => {
          if ('isAddCard' in entry) {
            return (
              <button
                onClick={() => handleAddOscillator()}
                disabled={!canEdit}
                className="w-full group relative min-h-[260px] rounded-2xl border-2 border-dashed border-cyan-500/30 hover:border-cyan-400 bg-black/25 hover:bg-cyan-950/30 flex flex-col items-center justify-center gap-4 p-6 transition-all duration-300 shadow-[0_0_30px_rgba(0,0,0,0.3)] hover:shadow-[0_0_40px_rgba(34,211,238,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-16 h-16 rounded-full bg-cyan-950/60 border border-cyan-500/35 group-hover:border-cyan-400 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                  <Icon name="Plus" className="text-cyan-400/80 group-hover:text-cyan-200 w-7 h-7 transition-colors" />
                </div>

                <div className="text-center">
                  <h3 className="text-base sm:text-lg font-display font-black text-cyan-400/80 group-hover:text-cyan-200 tracking-widest uppercase mb-1 transition-colors">
                    Añadir Frecuencia
                  </h3>
                  <p className="text-[11px] text-slate-500 group-hover:text-cyan-400/70 uppercase tracking-widest font-bold transition-colors">
                    Nueva capa armónica
                  </p>
                </div>
              </button>
            );
          }

          return (
            <OscillatorControls
              osc={entry}
              update={handleUpdateOscillator}
              remove={handleRemoveOscillator}
              analyser={getOscillatorAnalyser(entry.id)}
              forceExpanded={expandAllOscillators}
            />
          );
        }}
      />
    </div>
  );
};

export default Generator;
