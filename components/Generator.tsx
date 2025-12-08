
import React, { useMemo, useState } from 'react';
import { useAudio } from '../hooks/useAudio';
import { useFileSystem } from '../hooks/useFileSystem';
import { PresetContent, OscillatorState } from '../types';
import OscillatorControls from './OscillatorControls';
import Visualizer, { VisualizerSource } from './Visualizer';
import Icon from './Icon';
import FileExplorer from './FileExplorer';

interface Props {
  audio: ReturnType<typeof useAudio>;
}

// Helper to get brainwave name
const getWaveName = (hz: number) => {
    if (hz < 0.5) return 'Epsilon';
    if (hz < 4) return 'Delta';
    if (hz < 8) return 'Theta';
    if (hz < 12) return 'Alfa';
    if (hz < 30) return 'Beta';
    if (hz < 100) return 'Gamma';
    return 'Lambda';
};

interface ResonanceResult {
    id: string;
    type: 'binaural' | 'beat';
    hz: string;
    waveName: string;
    sourceA: string;
    sourceB: string;
}

const Generator: React.FC<Props> = ({ audio }) => {
  const { oscillators, addOscillator, removeOscillator, updateOscillator, getCombinedAnalyser, getOscillatorAnalyser } = audio;
  
  // File System Integration
  const fs = useFileSystem();
  const [showExplorer, setShowExplorer] = useState(false);
  const [explorerMode, setExplorerMode] = useState<'save' | 'load'>('save');

  // Logic to remove all and load new
  const loadPreset = (preset: PresetContent) => {
    // Clear existing
    oscillators.forEach(osc => removeOscillator(osc.id));
    // Add new (small timeout to ensure clean state or just add direct)
    setTimeout(() => {
        preset.oscillators.forEach(osc => {
             // We strip ID to generate new ones to avoid collision or stale refs
             // But we keep properties
             const { id, ...props } = osc;
             addOscillator(props);
        });
    }, 50);
  };

  const handleExport = () => {
    const data = fs.exportSystem();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omni_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  // Advanced Resonance Calculation (Combinatorial Analysis)
  const resonanceResults = useMemo(() => {
    // Only verify non-independent waves for resonance calculation
    const active = oscillators.filter(o => o.isPlaying && !o.isIndependent);
    const results: ResonanceResult[] = [];

    // Compare every oscillator with every other oscillator
    for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
            const oscA = active[i];
            const oscB = active[j];
            
            const diff = Math.abs(oscA.frequency - oscB.frequency);

            if (diff > 0.1 && diff < 120) {
                const waveName = getWaveName(diff);
                const hzFormatted = diff.toFixed(2);

                // 1. Mono Beat Check
                results.push({
                    id: `beat-${oscA.id}-${oscB.id}`,
                    type: 'beat',
                    hz: hzFormatted,
                    waveName,
                    sourceA: oscA.name || 'Freq A',
                    sourceB: oscB.name || 'Freq B'
                });

                // 2. Stereo Binaural Check
                const isOpposite = (oscA.panX <= -0.1 && oscB.panX >= 0.1) || (oscA.panX >= 0.1 && oscB.panX <= -0.1);
                
                if (isOpposite) {
                     results.push({
                        id: `bin-${oscA.id}-${oscB.id}`,
                        type: 'binaural',
                        hz: hzFormatted,
                        waveName,
                        sourceA: oscA.name || 'Freq A',
                        sourceB: oscB.name || 'Freq B'
                    });
                }
            }
        }
    }

    return results;
  }, [oscillators]);

  // Construct Visualizer Sources
  const visualizerSources: VisualizerSource[] = useMemo(() => {
    const sources: VisualizerSource[] = [];
    
    // 1. Background: Combined Bus
    const combined = getCombinedAnalyser();
    if (combined) {
        sources.push({ analyser: combined, color: '#475569' });
    }

    // 2. Overlays: Independent Waves
    oscillators.forEach(osc => {
        if (osc.isPlaying && osc.isIndependent) {
            const analyser = getOscillatorAnalyser(osc.id);
            if (analyser) {
                sources.push({ analyser, color: osc.color });
            }
        }
    });
    
    if (sources.length === 1 && sources[0].color === '#475569') {
        sources[0].color = '#22d3ee';
    }

    return sources;
  }, [oscillators, getCombinedAnalyser, getOscillatorAnalyser]);

  return (
    <div className="animate-fade-in space-y-6 pb-24">
      
      {/* --- Toolbar --- */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/5 border border-white/10 p-3 rounded-xl backdrop-blur-md">
         <div className="flex items-center gap-2">
            <button 
                onClick={() => { setExplorerMode('save'); setShowExplorer(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border border-cyan-500/30"
            >
                <Icon name="Save" size={14} /> Guardar Preset
            </button>
            <button 
                onClick={() => { setExplorerMode('load'); setShowExplorer(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border border-purple-500/30"
            >
                <Icon name="Folder" size={14} /> Cargar Preset
            </button>
         </div>

         <div className="flex items-center gap-2 border-l border-white/10 pl-4">
             <button onClick={handleExport} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg" title="Exportar Backup">
                 <Icon name="Download" size={16} />
             </button>
             <label className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer" title="Importar Backup">
                 <Icon name="Upload" size={16} />
                 <input type="file" accept=".json" onChange={handleImport} className="hidden" />
             </label>
         </div>
      </div>

      {/* --- File Explorer Modal --- */}
      {showExplorer && (
          <FileExplorer 
             mode={explorerMode}
             fs={fs}
             onClose={() => setShowExplorer(false)}
             onFileSelect={loadPreset}
             currentConfig={{
                 oscillators,
                 dateCreated: Date.now(),
                 description: 'Configuración generada'
             }}
          />
      )}

      {/* Master Visualizer & Info */}
      <div className="glass-panel p-6 rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/50 to-black/50 shadow-2xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-stretch justify-between mb-6 gap-6 border-b border-white/5 pb-4">
            
            {/* Header Title */}
            <div className="flex flex-col gap-2 min-w-[200px]">
                <div className="flex items-center gap-2 mb-1">
                    <Icon name="Activity" className="text-cyan-400" />
                    <h2 className="text-xl font-display font-bold text-white">
                        Resonancia Maestra
                    </h2>
                </div>
                <div className="text-xs text-slate-500 font-mono flex items-center h-8">
                    {oscillators.filter(o => o.isPlaying && !o.isIndependent).length} Fuentes en Mezcla
                </div>
            </div>

            {/* Results Display */}
            <div className="flex-1 w-full bg-black/40 rounded-xl border border-white/5 p-2 max-h-32 overflow-y-auto">
                {resonanceResults.length === 0 ? (
                     <div className="h-full flex items-center justify-center text-xs text-slate-600 italic">
                        No se detectan interacciones resonantes activas.
                     </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {resonanceResults.map(res => (
                            <div key={res.id} className={`
                                flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs
                                ${res.type === 'binaural' 
                                    ? 'bg-purple-500/10 border-purple-500/30' 
                                    : 'bg-amber-500/10 border-amber-500/30'}
                            `}>
                                <div className="flex items-center gap-2">
                                    <Icon name={res.type === 'binaural' ? 'Brain' : 'Zap'} size={12} className={res.type === 'binaural' ? 'text-purple-400' : 'text-amber-400'} />
                                    <div className="flex flex-col">
                                        <span className={`font-bold uppercase tracking-wider ${res.type === 'binaural' ? 'text-purple-300' : 'text-amber-300'}`}>
                                            {res.type === 'binaural' ? 'Binaural' : 'Batido'}
                                        </span>
                                        <span className="text-[10px] text-slate-400 opacity-70">
                                            {res.sourceA} + {res.sourceB}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-display font-bold text-white text-sm">{res.hz} Hz</div>
                                    <div className={`text-[9px] uppercase tracking-wide ${res.type === 'binaural' ? 'text-purple-200/60' : 'text-amber-200/60'}`}>
                                        {res.waveName}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
        
        <div className="h-64 w-full bg-black/50 rounded-2xl border border-white/10 overflow-hidden relative shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
            <Visualizer sources={visualizerSources} height={256} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10 pointer-events-none"></div>
            
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none mix-blend-overlay"></div>
            
            <div className="absolute top-4 right-4 flex flex-col gap-2 items-end pointer-events-none">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-full text-[10px] text-slate-400 border border-white/5">
                    <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                    <span className="font-medium tracking-wide">Onda Combinada</span>
                </div>
                {oscillators.filter(o => o.isPlaying && o.isIndependent).map(osc => (
                    <div key={osc.id} className="flex items-center gap-2 px-3 py-1.5 bg-black/80 rounded-full text-[10px] text-white border border-white/5 backdrop-blur-md shadow-lg">
                        <div className="w-2 h-2 rounded-full shadow-[0_0_5px_currentColor]" style={{ background: osc.color, color: osc.color }}></div>
                        <span className="font-medium tracking-wide">{osc.name}</span>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* Oscillator List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {oscillators.map(osc => (
            <OscillatorControls 
                key={osc.id} 
                osc={osc} 
                update={updateOscillator} 
                remove={removeOscillator}
                analyser={getOscillatorAnalyser(osc.id)}
            />
        ))}

        <button 
            onClick={() => addOscillator()}
            className="group min-h-[400px] rounded-xl border-2 border-dashed border-white/10 hover:border-cyan-500/50 hover:bg-white/[0.02] flex flex-col items-center justify-center gap-4 transition-all duration-300"
        >
            <div className="w-16 h-16 rounded-full bg-white/5 group-hover:bg-cyan-500/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-[0_0_20px_rgba(0,0,0,0.2)] group-hover:shadow-[0_0_30px_rgba(34,211,238,0.2)]">
                <Icon name="Zap" className="text-slate-500 group-hover:text-cyan-400 w-8 h-8" />
            </div>
            <span className="text-sm font-bold text-slate-400 group-hover:text-white uppercase tracking-widest transition-colors">
                Añadir Frecuencia
            </span>
        </button>
      </div>

    </div>
  );
};

export default Generator;
