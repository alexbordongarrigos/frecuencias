
import React from 'react';
import { useAudio } from '../hooks/useAudio';
import Icon from './Icon';
import Visualizer from './Visualizer';

interface Props {
  audio: ReturnType<typeof useAudio>;
}

const GlobalPlayer: React.FC<Props> = ({ audio }) => {
  const { isPlaying, toggleMasterPlay, oscillators, getMasterAnalyser } = audio;
  const activeCount = oscillators.filter(o => o.isPlaying).length;

  // Don't show if nothing is set up
  if (oscillators.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 w-full z-50 animate-fade-in">
      <div className="max-w-7xl mx-auto px-4 pb-4">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] p-3 md:p-4 flex items-center gap-4 md:gap-6">
            
            {/* Play/Pause Button */}
            <button 
                onClick={toggleMasterPlay}
                className={`flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${isPlaying ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-cyan-500/20' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
                {isPlaying ? (
                    <div className="w-4 h-4 bg-current rounded-sm" /> 
                ) : (
                    <Icon name="Radio" className="ml-1" />
                )}
            </button>

            {/* Info Area */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs uppercase tracking-widest text-cyan-400 font-bold">
                        {isPlaying ? 'Reproduciendo' : 'Pausado'}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" style={{ opacity: isPlaying ? 1 : 0}}></span>
                </div>
                <div className="text-sm text-white truncate font-light">
                    {activeCount === 0 ? 'Silencio Total' : 
                     activeCount === 1 ? `${oscillators.find(o => o.isPlaying)?.name || 'Frecuencia'}` : 
                     `${activeCount} Frecuencias combinadas`}
                </div>
            </div>

            {/* Mini Visualizer */}
            <div className="hidden md:block w-32 h-10 bg-black/50 rounded overflow-hidden border border-white/5 opacity-80">
                <Visualizer analyser={getMasterAnalyser()} height={40} color={isPlaying ? '#a855f7' : '#475569'} />
            </div>

             {/* Volume Indicator (Visual only for now) */}
             <div className="hidden md:flex flex-col gap-1 w-20">
                <div className="text-[10px] text-slate-500 uppercase text-right">Master</div>
                <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 w-1/2"></div>
                </div>
             </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalPlayer;
