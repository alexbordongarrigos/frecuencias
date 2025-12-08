
import React from 'react';
import { OscillatorState, WaveType } from '../types';
import Icon from './Icon';
import Visualizer from './Visualizer';

interface Props {
  osc: OscillatorState;
  update: (id: string, changes: Partial<OscillatorState>) => void;
  remove: (id: string) => void;
  analyser: AnalyserNode | undefined;
}

const OscillatorControls: React.FC<Props> = ({ osc, update, remove, analyser }) => {
  return (
    <div className="bg-black/30 border border-white/10 rounded-xl p-4 flex flex-col gap-4 hover:border-cyan-500/30 transition-all shadow-lg">
      
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 flex-1">
            <button 
                onClick={() => update(osc.id, { isPlaying: !osc.isPlaying })}
                className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${osc.isPlaying ? 'bg-cyan-500 text-black border-cyan-400' : 'bg-transparent text-slate-500 border-slate-600'}`}
                title={osc.isPlaying ? "Silenciar" : "Activar"}
            >
                <Icon name={osc.isPlaying ? 'Radio' : 'Shield'} size={14} />
            </button>
            <input 
                type="text" 
                value={osc.name} 
                onChange={(e) => update(osc.id, { name: e.target.value })}
                className="bg-transparent text-white font-medium text-sm focus:outline-none border-b border-transparent focus:border-cyan-500 w-full"
            />
        </div>
        
        <div className="flex items-center gap-2">
            <select 
                value={osc.type} 
                onChange={(e) => update(osc.id, { type: e.target.value as WaveType })}
                className="bg-black/40 text-[10px] text-cyan-300 border border-white/10 rounded px-2 py-1 outline-none focus:border-cyan-500 uppercase"
            >
                <option value="sine">Senoidal</option>
                <option value="square">Cuadrada</option>
                <option value="sawtooth">Diente</option>
                <option value="triangle">Triangular</option>
            </select>
            <button onClick={() => remove(osc.id)} className="text-slate-500 hover:text-red-400 p-1">
                <Icon name="ChevronDown" className="rotate-45" size={16} /> 
            </button>
        </div>
      </div>

      {/* Visualizer Mini + Color/Layer Config */}
      <div className="relative group/vis">
          <div className="h-16 bg-black/40 rounded-lg overflow-hidden border border-white/5 relative mb-2">
            <Visualizer analyser={analyser} height={64} color={osc.color} />
            {!osc.isPlaying && <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500 uppercase tracking-widest bg-black/60 backdrop-blur-sm">Silenciado</div>}
          </div>
          
          <div className="flex items-center justify-between px-1">
             <label className="flex items-center gap-2 cursor-pointer group select-none">
                <div className={`w-3 h-3 rounded border flex items-center justify-center transition-colors ${osc.isIndependent ? 'bg-amber-500 border-amber-500' : 'border-slate-600 bg-transparent'}`}>
                    {osc.isIndependent && <div className="w-1.5 h-1.5 bg-black rounded-sm" />}
                </div>
                <input 
                    type="checkbox" 
                    checked={osc.isIndependent}
                    onChange={(e) => update(osc.id, { isIndependent: e.target.checked })}
                    className="hidden"
                />
                <span className="text-[10px] text-slate-400 uppercase tracking-wider group-hover:text-amber-300 transition-colors">Onda Independiente</span>
             </label>

             <div className="flex items-center gap-2">
                 <span className="text-[10px] text-slate-500 uppercase">Color</span>
                 <input 
                    type="color" 
                    value={osc.color}
                    onChange={(e) => update(osc.id, { color: e.target.value })}
                    className="w-4 h-4 rounded-full border-none p-0 overflow-hidden cursor-pointer"
                 />
             </div>
          </div>
      </div>

      <div className="h-px bg-white/5 my-1"></div>

      {/* Main Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        
        {/* Frequency */}
        <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-400 uppercase">
                <span>Frecuencia (Hz)</span>
                <input 
                    type="number" 
                    value={osc.frequency}
                    onChange={(e) => update(osc.id, { frequency: Number(e.target.value) })}
                    className="w-16 bg-transparent text-right text-cyan-300 focus:outline-none border-b border-white/10 focus:border-cyan-500"
                />
            </div>
            <input 
                type="range" min="1" max="1000" step="0.1" value={osc.frequency}
                onChange={(e) => update(osc.id, { frequency: Number(e.target.value) })}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
        </div>

        {/* Volume */}
        <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-400 uppercase">
                <span>Volumen</span>
                <span>{Math.round(osc.volume * 100)}%</span>
            </div>
            <input 
                type="range" min="0" max="1" step="0.01" value={osc.volume}
                onChange={(e) => update(osc.id, { volume: Number(e.target.value) })}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-400"
            />
        </div>

        {/* 3D Spatial Audio Controls */}
        <div className="md:col-span-2 space-y-3 pt-2 bg-white/5 rounded-lg p-3 border border-white/5">
            <h4 className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-2">
                <Icon name="Orbit" size={10} />
                Posicionamiento Espacial 3D (Equal Power)
            </h4>
            
            <div className="grid grid-cols-3 gap-4">
                {/* L/R - PanX */}
                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>L</span>
                        <span className="text-cyan-500">X</span>
                        <span>R</span>
                    </div>
                    <input 
                        type="range" min="-1" max="1" step="0.1" value={osc.panX}
                        onChange={(e) => update(osc.id, { panX: Number(e.target.value) })}
                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                        title="Izquierda / Derecha"
                    />
                </div>

                {/* Back/Front - PanZ */}
                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>Atrás</span>
                        <span className="text-cyan-500">Z</span>
                        <span>Frente</span>
                    </div>
                    <input 
                        type="range" min="-1" max="1" step="0.1" value={osc.panZ}
                        onChange={(e) => update(osc.id, { panZ: Number(e.target.value) })}
                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                        title="Profundidad"
                    />
                </div>

                {/* Down/Up - PanY */}
                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>Abajo</span>
                        <span className="text-cyan-500">Y</span>
                        <span>Arriba</span>
                    </div>
                    <input 
                        type="range" min="-1" max="1" step="0.1" value={osc.panY}
                        onChange={(e) => update(osc.id, { panY: Number(e.target.value) })}
                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                        title="Altura"
                    />
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default OscillatorControls;
