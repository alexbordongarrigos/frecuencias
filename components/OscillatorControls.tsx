import React, { useRef, useState, useEffect, useMemo } from 'react';
import { OscillatorState, WaveType } from '../types';
import { computeAcousticWavelengths, computeOpticalOctaveNm } from '../utils/frequencyAnalysis';
import Icon from './Icon';
import Visualizer from './Visualizer';

interface Props {
  osc: OscillatorState;
  update: (id: string, changes: Partial<OscillatorState>) => void;
  remove: (id: string) => void;
  analyser: AnalyserNode | null | undefined;
  forceExpanded?: boolean;
}

const PHI = 1.61803398875;

const WAVE_LABELS: Record<WaveType, string> = {
  sine: 'Senoidal',
  square: 'Cuadrada',
  sawtooth: 'Diente',
  triangle: 'Triangular',
};

const OscillatorControls: React.FC<Props> = ({ osc, update, remove, analyser, forceExpanded }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(forceExpanded ?? false);
  const prevForceExpandedRef = useRef<boolean | undefined>(forceExpanded);

  useEffect(() => {
    if (forceExpanded !== undefined && forceExpanded !== prevForceExpandedRef.current) {
      prevForceExpandedRef.current = forceExpanded;
      setIsExpanded(forceExpanded);
    }
  }, [forceExpanded]);

  // Frequency History State
  const historyRef = useRef<{ list: number[]; index: number }>({ list: [osc.frequency], index: 0 });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitToHistory = (freq: number) => {
    const { list, index } = historyRef.current;
    if (list[index] === freq) return;

    const newList = list.slice(0, index + 1);
    newList.push(freq);
    if (newList.length > 50) newList.shift();

    historyRef.current = { list: newList, index: newList.length - 1 };
    setCanUndo(historyRef.current.index > 0);
    setCanRedo(historyRef.current.index < historyRef.current.list.length - 1);
  };

  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      commitToHistory(osc.frequency);
    }, 500);
    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [osc.frequency]);

  const undoFreq = () => {
    const { list, index } = historyRef.current;
    if (index > 0) {
      const newIndex = index - 1;
      historyRef.current.index = newIndex;
      setCanUndo(newIndex > 0);
      setCanRedo(newIndex < list.length - 1);
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      update(osc.id, { frequency: list[newIndex] });
    }
  };

  const redoFreq = () => {
    const { list, index } = historyRef.current;
    if (index < list.length - 1) {
      const newIndex = index + 1;
      historyRef.current.index = newIndex;
      setCanUndo(newIndex > 0);
      setCanRedo(newIndex < list.length - 1);
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      update(osc.id, { frequency: list[newIndex] });
    }
  };

  const adjustFrequency = (nextRaw: number) => {
    if (!Number.isFinite(nextRaw)) return;
    const clamped = Math.max(0.01, Math.min(24000, Math.round(nextRaw * 1000) / 1000));
    update(osc.id, { frequency: clamped });
  };

  // Telemetry Calculations
  const wavelengths = useMemo(() => computeAcousticWavelengths(osc.frequency), [osc.frequency]);
  const opticalOctave = useMemo(() => computeOpticalOctaveNm(osc.frequency), [osc.frequency]);

  // Compact Status Badges
  const panSummary = useMemo(() => {
    const x = osc.panX || 0;
    const y = osc.panY || 0;
    const z = osc.panZ || 0;
    if (Math.abs(x) < 0.02 && Math.abs(y) < 0.02 && Math.abs(z) < 0.02) return null;
    if (Math.abs(y) < 0.02 && Math.abs(z) < 0.02) {
      return x < 0 ? `Pan Izq ${x.toFixed(2)}` : `Pan Der +${x.toFixed(2)}`;
    }
    return `3D (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`;
  }, [osc.panX, osc.panY, osc.panZ]);

  const crestValleyActive =
    Math.abs((osc.crestValleyRatio ?? 1.0) - 1.0) > 0.01 ||
    Math.abs(osc.dutyCycle ?? 0) > 0.01 ||
    (osc.harmonicDistortion ?? 0) > 0.01 ||
    (osc.phaseOffset ?? 0) > 0;

  const dualWaveActive = Boolean(osc.type2 && osc.type2 !== osc.type && (osc.typeMix ?? 0) > 0.01);
  const freqSliderMax = osc.frequency > 1000 ? Math.ceil(osc.frequency * 1.4) : 1000;
  const freqPercent = Math.min(100, Math.max(0, (osc.frequency / freqSliderMax) * 100));
  const volPercent = Math.round(Math.min(1, Math.max(0, osc.volume)) * 100);

  return (
    <div
      className="bg-black/45 border border-white/10 rounded-2xl p-4 flex flex-col gap-3.5 hover:border-cyan-500/35 transition-all shadow-[0_8px_32px_rgba(0,0,0,0.65)] relative overflow-hidden"
      style={{
        borderColor: osc.isPlaying ? `${osc.color}40` : undefined,
      }}
    >
      {/* Subtle Top Color Accent */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-75 pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent, ${osc.color}, transparent)` }}
      />

      {/* COMPACT VIEW (Always Visible & Centered) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 flex-1 min-w-[160px]">
          <button
            onClick={() => update(osc.id, { isPlaying: !osc.isPlaying })}
            className="w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all shrink-0"
            style={{
              borderColor: osc.isPlaying ? osc.color : 'rgba(100,116,139,0.5)',
              backgroundColor: osc.isPlaying ? `${osc.color}25` : 'rgba(0,0,0,0.5)',
              color: osc.isPlaying ? osc.color : '#64748b',
              boxShadow: osc.isPlaying ? `0 0 18px ${osc.color}66` : undefined,
            }}
            title={osc.isPlaying ? 'Silenciar oscilador' : 'Activar oscilador'}
          >
            <Icon name={osc.isPlaying ? 'Radio' : 'VolumeX'} size={15} />
          </button>

          <input
            type="text"
            value={osc.name ?? ''}
            onChange={(e) => update(osc.id, { name: e.target.value })}
            placeholder="Frecuencia"
            className="bg-transparent text-white font-semibold text-sm focus:outline-none border-b border-transparent focus:border-cyan-400 w-full min-w-0 truncate"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <select
            value={osc.type}
            onChange={(e) => update(osc.id, { type: e.target.value as WaveType })}
            className="bg-black/60 text-[10px] font-bold text-cyan-300 border border-white/15 rounded-lg px-2 py-1.5 outline-none focus:border-cyan-400 uppercase cursor-pointer"
            title="Forma de onda primaria"
          >
            <option value="sine">Senoidal</option>
            <option value="square">Cuadrada</option>
            <option value="sawtooth">Diente</option>
            <option value="triangle">Triangular</option>
          </select>

          <label
            className="relative w-7 h-7 rounded-full overflow-hidden border-2 border-white/25 cursor-pointer hover:scale-110 transition-transform shrink-0"
            style={{ backgroundColor: osc.color, boxShadow: `0 0 10px ${osc.color}88` }}
            title="Cambiar color de onda"
          >
            <input
              type="color"
              value={osc.color}
              onChange={(e) => update(osc.id, { color: e.target.value })}
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
            />
          </label>

          <button
            onClick={() => remove(osc.id)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-colors"
            title="Eliminar frecuencia"
          >
            <Icon name="Trash2" size={15} />
          </button>
        </div>
      </div>

      {/* Live Mini Oscilloscope */}
      <div className="h-12 bg-black/70 rounded-xl overflow-hidden border border-white/10 relative shadow-[inset_0_0_20px_rgba(0,0,0,0.85)]">
        <Visualizer analyser={analyser} height={48} color={osc.color} transparentBg />
        {!osc.isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-black/75 backdrop-blur-sm">
            Silenciado
          </div>
        )}
      </div>

      {/* Compact Metrics Strip (Sliders stay collapsed inside drawer) */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-black/40 px-3 py-2 rounded-xl border border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm sm:text-base font-mono font-black morph-accent-text tabular-nums">
            {osc.frequency.toFixed(2)} <span className="text-[10px] font-bold text-slate-400">Hz</span>
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-200">
            {WAVE_LABELS[osc.type]}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold morph-accent-text-2 px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
            Vol {volPercent}%
          </span>
        </div>
      </div>

      {/* Compact Informative Badges */}
      {(panSummary || crestValleyActive || dualWaveActive || osc.isIndependent || osc.transition?.enabled) && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {panSummary && (
            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-cyan-500/15 border border-cyan-500/30 text-cyan-200">
              {panSummary}
            </span>
          )}
          {crestValleyActive && (
            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-500/30 text-amber-200">
              Cresta/Valle {(osc.crestValleyRatio ?? 1.0).toFixed(2)}x
            </span>
          )}
          {dualWaveActive && (
            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-purple-500/15 border border-purple-500/30 text-purple-200">
              Onda Dual {WAVE_LABELS[osc.type2!]} {Math.round((osc.typeMix ?? 0) * 100)}%
            </span>
          )}
          {osc.isIndependent && (
            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-200">
              Independiente
            </span>
          )}
          {osc.transition?.enabled && (
            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-pink-500/15 border border-pink-500/30 text-pink-200 ${osc.transition.isPlaying ? 'animate-pulse' : ''}`}>
              Transición {osc.transition.isPlaying ? 'Activa' : 'Lista'}
            </span>
          )}
        </div>
      )}

      {/* Prominent Expand / Collapse Configuration Button */}
      <button
        onClick={() => setIsExpanded(prev => !prev)}
        className={`w-full py-2 px-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${
          isExpanded
            ? 'morph-tab-active'
            : 'morph-btn-glass text-slate-200'
        }`}
      >
        <Icon name="Sliders" size={13} />
        <span>{isExpanded ? 'Ocultar Niveladores y Ajustes' : 'Desplegar Niveladores y Ajustes'}</span>
        <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={14} />
      </button>

      {/* COLLAPSIBLE LEVELERS & ADVANCED CONFIGURATION PANEL */}
      {isExpanded && (
        <div className="space-y-4 pt-2 border-t border-white/10 animate-fade-in">
          {/* 0. Nivelador de Frecuencia (Hz) y Nivelador de Volumen (%) */}
          <div className="space-y-2.5">
            <div className="space-y-2 bg-black/45 p-3 rounded-xl border border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Frecuencia (Hz)</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0.01"
                    max="24000"
                    step="any"
                    value={osc.frequency}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (Number.isFinite(val)) adjustFrequency(val);
                    }}
                    className="w-24 bg-black/75 text-right morph-accent-text font-mono text-sm font-bold rounded-lg px-2.5 py-1 border border-white/20 focus:outline-none focus:border-cyan-400"
                  />
                  <span className="text-[10px] font-bold text-slate-400">Hz</span>
                </div>
              </div>

              <input
                type="range"
                min="0.5"
                max={freqSliderMax}
                step="0.1"
                value={Math.min(freqSliderMax, osc.frequency)}
                onChange={(e) => adjustFrequency(parseFloat(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer border border-white/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(34,211,238,0.85)]"
                style={{
                  background: `linear-gradient(to right, rgba(34,211,238,0.45) ${freqPercent}%, rgba(15,23,42,0.85) ${freqPercent}%)`,
                }}
              />

              <div className="flex flex-wrap items-center justify-center gap-1 pt-0.5">
                {[
                  { label: '-1', fn: () => adjustFrequency(osc.frequency - 1) },
                  { label: '-0.1', fn: () => adjustFrequency(osc.frequency - 0.1) },
                  { label: '+0.1', fn: () => adjustFrequency(osc.frequency + 0.1) },
                  { label: '+1', fn: () => adjustFrequency(osc.frequency + 1) },
                  { label: '÷2', fn: () => adjustFrequency(osc.frequency / 2) },
                  { label: '×2', fn: () => adjustFrequency(osc.frequency * 2) },
                  { label: '×φ', fn: () => adjustFrequency(osc.frequency * PHI) },
                ].map(btn => (
                  <button
                    key={btn.label}
                    onClick={btn.fn}
                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] font-mono font-bold text-slate-200 transition-colors"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 bg-black/45 px-3 py-2.5 rounded-xl border border-white/10">
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="text-slate-300 font-bold uppercase tracking-widest">Volumen</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={volPercent}
                    onChange={(e) => {
                      const raw = parseFloat(e.target.value);
                      if (!Number.isFinite(raw)) return;
                      update(osc.id, { volume: Math.min(1, Math.max(0, raw / 100)) });
                    }}
                    className="w-14 bg-black/75 text-right morph-accent-text-2 font-mono text-xs font-bold rounded-lg px-2 py-0.5 border border-white/20 focus:outline-none focus:border-purple-400"
                  />
                  <span className="morph-accent-text-2 font-mono font-bold">%</span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={osc.volume}
                onChange={(e) => update(osc.id, { volume: parseFloat(e.target.value) })}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer border border-white/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(168,85,247,0.85)]"
                style={{
                  background: `linear-gradient(to right, rgba(168,85,247,0.45) ${volPercent}%, rgba(15,23,42,0.85) ${volPercent}%)`,
                }}
              />
            </div>
          </div>

          {/* 1. Onda Dual y Ruta */}
          <div className="bg-black/45 rounded-2xl p-3.5 border border-white/10 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-[10px] text-purple-300 uppercase font-black tracking-widest flex items-center gap-2">
                <Icon name="Waves" size={13} className="text-purple-400" />
                Onda Dual y Ruta
              </h4>
              <div className="flex items-center gap-1 bg-black/60 rounded-lg border border-white/10 overflow-hidden">
                <button
                  onClick={undoFreq}
                  disabled={!canUndo}
                  className={`p-1.5 transition-colors ${canUndo ? 'text-cyan-400 hover:bg-cyan-500/20' : 'text-slate-700 cursor-not-allowed'}`}
                  title="Frecuencia anterior"
                >
                  <Icon name="CornerUpLeft" size={13} />
                </button>
                <div className="w-px h-4 bg-white/10" />
                <button
                  onClick={redoFreq}
                  disabled={!canRedo}
                  className={`p-1.5 transition-colors ${canRedo ? 'text-cyan-400 hover:bg-cyan-500/20' : 'text-slate-700 cursor-not-allowed'}`}
                  title="Frecuencia siguiente"
                >
                  <Icon name="CornerUpRight" size={13} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[10px]">
              <div className="flex items-center justify-between gap-2 bg-black/50 px-3 py-2 rounded-xl border border-white/5">
                <span className="text-slate-400 font-bold uppercase">Primaria</span>
                <select
                  value={osc.type}
                  onChange={(e) => update(osc.id, { type: e.target.value as WaveType })}
                  className="bg-black/70 text-cyan-200 border border-white/15 rounded-lg px-2 py-1 uppercase font-bold outline-none focus:border-cyan-400"
                >
                  <option value="sine">Senoidal</option>
                  <option value="square">Cuadrada</option>
                  <option value="sawtooth">Diente</option>
                  <option value="triangle">Triangular</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-2 bg-black/50 px-3 py-2 rounded-xl border border-white/5">
                <span className="text-slate-400 font-bold uppercase">Secundaria</span>
                <select
                  value={osc.type2 || osc.type}
                  onChange={(e) => update(osc.id, { type2: e.target.value as WaveType })}
                  className="bg-black/70 text-purple-200 border border-white/15 rounded-lg px-2 py-1 uppercase font-bold outline-none focus:border-purple-400"
                >
                  <option value="sine">Senoidal</option>
                  <option value="square">Cuadrada</option>
                  <option value="sawtooth">Diente</option>
                  <option value="triangle">Triangular</option>
                </select>
              </div>
            </div>

            <div className="space-y-1 bg-black/50 p-2.5 rounded-xl border border-white/5 text-[10px]">
              <div className="flex justify-between text-slate-400 font-bold uppercase">
                <span>Mezcla Crossfade (1 ↔ 2)</span>
                <span className="text-purple-300 font-mono">{Math.round((osc.typeMix ?? 0) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={osc.typeMix ?? 0}
                onChange={(e) => update(osc.id, { typeMix: parseFloat(e.target.value), type2: osc.type2 || osc.type })}
                className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>

            <label className="flex items-center justify-center gap-3 cursor-pointer select-none bg-black/50 px-3 py-2 rounded-xl border border-white/10 hover:bg-white/5 transition-colors">
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                  osc.isIndependent ? 'bg-amber-500 border-amber-400' : 'border-slate-600 bg-black'
                }`}
              >
                {osc.isIndependent && <Icon name="Check" size={11} className="text-black" />}
              </div>
              <input
                type="checkbox"
                checked={osc.isIndependent}
                onChange={(e) => update(osc.id, { isIndependent: e.target.checked })}
                className="hidden"
              />
              <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">
                Onda Independiente (Directo al Master)
              </span>
            </label>
          </div>

          {/* 2. Posicionamiento Espacial 3D */}
          <div className="bg-black/45 rounded-2xl p-3.5 border border-white/10 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-[10px] text-cyan-300 uppercase font-black tracking-widest flex items-center gap-2">
                <Icon name="Orbit" size={13} className="text-cyan-400" />
                Posicionamiento Espacial 3D
              </h4>
              <div className="flex flex-wrap gap-1">
                {[
                  { label: 'Centro', vals: { panX: 0, panY: 0, panZ: 0 } },
                  { label: 'Izq -0.85', vals: { panX: -0.85, panY: 0, panZ: 0 } },
                  { label: 'Der +0.85', vals: { panX: 0.85, panY: 0, panZ: 0 } },
                  { label: 'Cénit', vals: { panX: 0, panY: 1, panZ: 0 } },
                ].map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => update(osc.id, preset.vals)}
                    className="px-2 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 text-[9px] font-bold uppercase text-cyan-200 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[10px]">
              {[
                { key: 'panX' as const, left: 'L', right: 'R', val: osc.panX, color: 'text-cyan-400', thumb: '[&::-webkit-slider-thumb]:bg-cyan-400' },
                { key: 'panY' as const, left: 'Abajo', right: 'Arriba', val: osc.panY, color: 'text-pink-400', thumb: '[&::-webkit-slider-thumb]:bg-pink-400' },
                { key: 'panZ' as const, left: 'Atrás', right: 'Frente', val: osc.panZ, color: 'text-purple-400', thumb: '[&::-webkit-slider-thumb]:bg-purple-400' },
              ].map(axis => (
                <div key={axis.key} className="bg-black/50 p-2.5 rounded-xl border border-white/5 space-y-2">
                  <div className="flex items-center justify-between gap-1 font-bold uppercase">
                    <span className="text-slate-400">{axis.left}</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="-1"
                        max="1"
                        step="0.05"
                        value={axis.val}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isFinite(v)) update(osc.id, { [axis.key]: Math.min(1, Math.max(-1, v)) });
                        }}
                        className={`w-12 bg-black/70 text-center font-mono rounded border border-white/15 py-0.5 ${axis.color} outline-none`}
                      />
                      <button
                        onClick={() => update(osc.id, { [axis.key]: 0 })}
                        className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-[9px] text-slate-400 hover:text-white"
                        title="Centrar eje"
                      >
                        0
                      </button>
                    </div>
                    <span className="text-slate-400">{axis.right}</span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.05"
                    value={axis.val}
                    onChange={(e) => update(osc.id, { [axis.key]: parseFloat(e.target.value) })}
                    className={`w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full ${axis.thumb}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 3. Morfología de Crestas, Valles y Fase */}
          <div className="bg-black/45 rounded-2xl p-3.5 border border-white/10 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-[10px] text-amber-300 uppercase font-black tracking-widest flex items-center gap-2">
                <Icon name="Sliders" size={13} className="text-amber-400" />
                Morfología de Crestas, Valles y Fase
              </h4>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const f = osc.frequency;
                    const magicRatio = Number((1.0 + 0.4 * Math.sin((f * Math.PI) / 180)).toFixed(2));
                    const magicDuty = Number((0.2 * Math.cos((f * Math.PI) / 180)).toFixed(2));
                    const magicHarmonic = Number(((f % 100) / 200).toFixed(2));
                    update(osc.id, {
                      crestValleyRatio: magicRatio,
                      dutyCycle: magicDuty,
                      harmonicDistortion: magicHarmonic,
                    });
                  }}
                  className="text-[9px] font-bold uppercase tracking-wider text-amber-200 bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/40 rounded-lg px-2.5 py-1 transition-colors"
                >
                  ⚡ Alinear con Frecuencia
                </button>
                <button
                  onClick={() =>
                    update(osc.id, {
                      crestValleyRatio: 1.0,
                      dutyCycle: 0,
                      harmonicDistortion: 0,
                      phaseOffset: 0,
                    })
                  }
                  className="text-[9px] font-bold uppercase tracking-wider text-slate-300 bg-white/5 hover:bg-white/15 border border-white/15 rounded-lg px-2.5 py-1 transition-colors"
                >
                  Centrar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[10px]">
              <div className="bg-black/50 p-2.5 rounded-xl border border-white/5 space-y-1.5">
                <div className="flex justify-between text-slate-400 font-bold uppercase">
                  <span>Valles ↔ Crestas</span>
                  <span className="text-amber-400 font-mono">{(osc.crestValleyRatio ?? 1.0).toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.05"
                  value={osc.crestValleyRatio ?? 1.0}
                  onChange={(e) => update(osc.id, { crestValleyRatio: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>

              <div className="bg-black/50 p-2.5 rounded-xl border border-white/5 space-y-1.5">
                <div className="flex justify-between text-slate-400 font-bold uppercase">
                  <span>Asimetría (Duty)</span>
                  <span className="text-cyan-400 font-mono">{(osc.dutyCycle ?? 0).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="-0.8"
                  max="0.8"
                  step="0.05"
                  value={osc.dutyCycle ?? 0}
                  onChange={(e) => update(osc.id, { dutyCycle: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>

              <div className="bg-black/50 p-2.5 rounded-xl border border-white/5 space-y-1.5">
                <div className="flex justify-between text-slate-400 font-bold uppercase">
                  <span>Saturación Armónica</span>
                  <span className="text-pink-400 font-mono">{Math.round((osc.harmonicDistortion ?? 0) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={osc.harmonicDistortion ?? 0}
                  onChange={(e) => update(osc.id, { harmonicDistortion: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-pink-400 [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>

              <div className="bg-black/50 p-2.5 rounded-xl border border-white/5 space-y-1.5">
                <div className="flex justify-between text-slate-400 font-bold uppercase">
                  <span>Desfase Angular</span>
                  <span className="text-purple-400 font-mono">{osc.phaseOffset ?? 0}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="5"
                  value={osc.phaseOffset ?? 0}
                  onChange={(e) => update(osc.id, { phaseOffset: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>
            </div>
          </div>

          {/* 4. Transición Automática A <-> B */}
          <div className="bg-black/45 rounded-2xl p-3.5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-[10px] text-cyan-200 uppercase font-black tracking-widest flex items-center gap-2">
                <Icon name="Activity" size={13} className="text-cyan-400" />
                Transición Automática A ↔ B
              </h4>
              <label className="flex items-center gap-2 cursor-pointer select-none bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/10">
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${osc.transition?.enabled ? 'bg-cyan-500 border-cyan-300' : 'border-slate-500 bg-black'}`}>
                  {osc.transition?.enabled && <Icon name="Check" size={10} className="text-black" />}
                </div>
                <input
                  type="checkbox"
                  checked={!!osc.transition?.enabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    if (enabled && !osc.transition) {
                      update(osc.id, {
                        transition: {
                          enabled: true,
                          start: { frequency: osc.frequency, volume: osc.volume, panX: osc.panX, panY: osc.panY, panZ: osc.panZ, type: osc.type },
                          end: { frequency: osc.frequency + 10, volume: osc.volume, panX: osc.panX, panY: osc.panY, panZ: osc.panZ, type: osc.type },
                          duration: 5,
                          loopCount: 'infinite',
                          isPlaying: false,
                          progress: 0,
                          currentLoop: 0,
                          direction: 'forward',
                        },
                      });
                    } else if (osc.transition) {
                      update(osc.id, { transition: { ...osc.transition, enabled } });
                    }
                  }}
                  className="hidden"
                />
                <span className="text-[10px] text-slate-300 font-bold uppercase">Activar</span>
              </label>
            </div>

            {osc.transition?.enabled && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px]">
                  {/* Variante A */}
                  <div className="space-y-2.5 bg-black/50 p-3 rounded-xl border border-cyan-500/25">
                    <div className="text-center font-black uppercase tracking-widest text-cyan-300 border-b border-cyan-500/20 pb-1.5">
                      Variante A (Inicio)
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold">Freq (Hz)</span>
                      <input
                        type="number"
                        step="any"
                        value={osc.transition.start.frequency}
                        onChange={(e) => update(osc.id, { transition: { ...osc.transition!, start: { ...osc.transition!.start, frequency: Number(e.target.value) } } })}
                        className="w-20 bg-black/70 text-cyan-200 text-right border border-cyan-500/30 rounded px-2 py-1 outline-none"
                      />
                    </div>
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-slate-400 font-bold">Vol</span>
                      <input
                        type="range" min="0" max="1" step="0.01"
                        value={osc.transition.start.volume}
                        onChange={(e) => update(osc.id, { transition: { ...osc.transition!, start: { ...osc.transition!.start, volume: Number(e.target.value) } } })}
                        className="flex-1 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-slate-400 font-bold">Pan X</span>
                      <input
                        type="range" min="-1" max="1" step="0.05"
                        value={osc.transition.start.panX}
                        onChange={(e) => update(osc.id, { transition: { ...osc.transition!, start: { ...osc.transition!.start, panX: Number(e.target.value) } } })}
                        className="flex-1 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold">Onda</span>
                      <select
                        value={osc.transition.start.type}
                        onChange={(e) => update(osc.id, { transition: { ...osc.transition!, start: { ...osc.transition!.start, type: e.target.value as WaveType } } })}
                        className="bg-black/70 text-cyan-200 border border-cyan-500/30 rounded px-2 py-1 uppercase text-[9px] outline-none"
                      >
                        <option value="sine">Senoidal</option>
                        <option value="square">Cuadrada</option>
                        <option value="sawtooth">Diente</option>
                        <option value="triangle">Triangular</option>
                      </select>
                    </div>
                    <button
                      onClick={() => update(osc.id, { transition: { ...osc.transition!, start: { frequency: osc.frequency, volume: osc.volume, panX: osc.panX, panY: osc.panY, panZ: osc.panZ, type: osc.type } } })}
                      className="w-full py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-bold uppercase text-[9px]"
                    >
                      Capturar Actual
                    </button>
                  </div>

                  {/* Variante B */}
                  <div className="space-y-2.5 bg-black/50 p-3 rounded-xl border border-purple-500/25">
                    <div className="text-center font-black uppercase tracking-widest text-purple-300 border-b border-purple-500/20 pb-1.5">
                      Variante B (Fin)
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold">Freq (Hz)</span>
                      <input
                        type="number"
                        step="any"
                        value={osc.transition.end.frequency}
                        onChange={(e) => update(osc.id, { transition: { ...osc.transition!, end: { ...osc.transition!.end, frequency: Number(e.target.value) } } })}
                        className="w-20 bg-black/70 text-purple-200 text-right border border-purple-500/30 rounded px-2 py-1 outline-none"
                      />
                    </div>
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-slate-400 font-bold">Vol</span>
                      <input
                        type="range" min="0" max="1" step="0.01"
                        value={osc.transition.end.volume}
                        onChange={(e) => update(osc.id, { transition: { ...osc.transition!, end: { ...osc.transition!.end, volume: Number(e.target.value) } } })}
                        className="flex-1 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-slate-400 font-bold">Pan X</span>
                      <input
                        type="range" min="-1" max="1" step="0.05"
                        value={osc.transition.end.panX}
                        onChange={(e) => update(osc.id, { transition: { ...osc.transition!, end: { ...osc.transition!.end, panX: Number(e.target.value) } } })}
                        className="flex-1 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold">Onda</span>
                      <select
                        value={osc.transition.end.type}
                        onChange={(e) => update(osc.id, { transition: { ...osc.transition!, end: { ...osc.transition!.end, type: e.target.value as WaveType } } })}
                        className="bg-black/70 text-purple-200 border border-purple-500/30 rounded px-2 py-1 uppercase text-[9px] outline-none"
                      >
                        <option value="sine">Senoidal</option>
                        <option value="square">Cuadrada</option>
                        <option value="sawtooth">Diente</option>
                        <option value="triangle">Triangular</option>
                      </select>
                    </div>
                    <button
                      onClick={() => update(osc.id, { transition: { ...osc.transition!, end: { frequency: osc.frequency, volume: osc.volume, panX: osc.panX, panY: osc.panY, panZ: osc.panZ, type: osc.type } } })}
                      className="w-full py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 font-bold uppercase text-[9px]"
                    >
                      Capturar Actual
                    </button>
                  </div>
                </div>

                {/* Playback Progress Bar */}
                <div className="flex flex-col sm:flex-row items-center gap-3 bg-black/50 p-3 rounded-xl border border-white/10">
                  <button
                    onClick={() => update(osc.id, { transition: { ...osc.transition!, isPlaying: !osc.transition!.isPlaying } })}
                    className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all shrink-0 ${
                      osc.transition.isPlaying
                        ? 'bg-cyan-500 text-black border-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.5)]'
                        : 'bg-black/70 text-cyan-400 border-cyan-500/40 hover:border-cyan-300'
                    }`}
                  >
                    <Icon name={osc.transition.isPlaying ? 'Pause' : 'Play'} size={18} className={osc.transition.isPlaying ? '' : 'ml-0.5'} />
                  </button>

                  <div className="flex-1 w-full space-y-2 text-[10px]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-bold uppercase">Duración:</span>
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={osc.transition.duration}
                          onChange={(e) => update(osc.id, { transition: { ...osc.transition!, duration: Math.max(0.1, Number(e.target.value)) } })}
                          className="w-16 bg-black/70 text-cyan-200 text-right border border-white/15 rounded px-1.5 py-0.5 outline-none"
                        />
                        <span className="text-slate-500">s</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-bold uppercase">Loops:</span>
                        <select
                          value={osc.transition.loopCount === 'infinite' ? 'infinite' : osc.transition.loopCount}
                          onChange={(e) => update(osc.id, { transition: { ...osc.transition!, loopCount: e.target.value === 'infinite' ? 'infinite' : Number(e.target.value) } })}
                          className="bg-black/70 text-cyan-200 border border-white/15 rounded px-2 py-0.5 outline-none cursor-pointer"
                        >
                          <option value="infinite">Infinito</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="5">5</option>
                          <option value="10">10</option>
                        </select>
                      </div>
                    </div>

                    <div className="w-full h-2 bg-black/70 rounded-full overflow-hidden border border-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 transition-all duration-75"
                        style={{ width: `${Math.round(osc.transition.progress * 100)}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                      <span>{osc.transition.loopCount === 'infinite' ? '∞ Ciclos' : `Ciclo ${osc.transition.currentLoop}/${osc.transition.loopCount}`}</span>
                      <span>{Math.round(osc.transition.progress * 100)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 5. Telemetría Física */}
          <div className="bg-black/45 rounded-2xl p-3.5 border border-white/10 space-y-2.5">
            <h4 className="text-[10px] text-emerald-300 uppercase font-black tracking-widest flex items-center gap-2">
              <Icon name="Atom" size={13} className="text-emerald-400" />
              Telemetría Física y Octava Óptica
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
              <div className="bg-black/55 p-2.5 rounded-xl border border-white/5 flex flex-col gap-0.5">
                <span className="text-[9px] text-slate-400 uppercase font-bold">λ Aire (343 m/s)</span>
                <span className="text-cyan-300 font-mono font-bold text-xs">{wavelengths.airMeters}</span>
              </div>
              <div className="bg-black/55 p-2.5 rounded-xl border border-white/5 flex flex-col gap-0.5">
                <span className="text-[9px] text-slate-400 uppercase font-bold">λ Agua (1480 m/s)</span>
                <span className="text-sky-300 font-mono font-bold text-xs">{wavelengths.waterMeters}</span>
              </div>
              <div className="bg-black/55 p-2.5 rounded-xl border border-white/5 flex flex-col gap-0.5">
                <span className="text-[9px] text-slate-400 uppercase font-bold">Octava Óptica</span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/40"
                    style={{ backgroundColor: opticalOctave.colorHex }}
                  />
                  <span className="text-white font-mono font-bold text-xs truncate">{opticalOctave.nm} nm</span>
                </div>
                <span className="text-[9px] text-slate-400 truncate">{opticalOctave.band}</span>
              </div>
              <div className="bg-black/55 p-2.5 rounded-xl border border-white/5 flex flex-col gap-0.5">
                <span className="text-[9px] text-slate-400 uppercase font-bold">Equivalencia kHz</span>
                <span className="text-purple-300 font-mono font-bold text-xs">{wavelengths.khzOctave}</span>
                <span className="text-[9px] text-slate-500 font-mono truncate">{wavelengths.mhzHarmonic}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OscillatorControls;
