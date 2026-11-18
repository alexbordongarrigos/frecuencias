import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FrequencyItem,
  CATEGORIES,
  RADIATION_MEDIUMS,
  OscillatorState,
  WaveType
} from '../types';
import {
  autoSuggestTechnicalRecommendation,
  computeAcousticWavelengths,
  computeOpticalOctaveNm
} from '../utils/frequencyAnalysis';
import Icon from './Icon';
import ParticleWaveformBand from './ParticleWaveformBand';

interface Props {
  item: FrequencyItem;
  delay: number;
  onAddToPlayer: (item: FrequencyItem, replace?: boolean) => void;
  oscillatorsList?: Partial<OscillatorState>[];
  onSaveToLibrary?: (item: FrequencyItem) => void;
}

type SectionKey = 'properties' | 'technical' | 'oscillators';

const WAVE_LABELS: Record<WaveType, string> = {
  sine: 'Senoidal',
  square: 'Cuadrada',
  sawtooth: 'Sierra',
  triangle: 'Triangular'
};

const FrequencyCard: React.FC<Props> = ({ item, delay, onAddToPlayer, oscillatorsList, onSaveToLibrary }) => {
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    properties: false,
    technical: false,
    oscillators: false
  });
  const [isPreviewing, setIsPreviewing] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const oscNodesRef = useRef<OscillatorNode[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categoryInfo = CATEGORIES.find(c => c.id === item.category);
  const colorClass = categoryInfo ? categoryInfo.color : 'text-cyan-400';

  const resolvedOscillators = useMemo<Partial<OscillatorState>[]>(() => {
    if (oscillatorsList && oscillatorsList.length > 0) return oscillatorsList;
    if (item.oscillatorsConfig && item.oscillatorsConfig.length > 0) return item.oscillatorsConfig;

    if (item.hz.includes('-')) {
      const parts = item.hz
        .split('-')
        .map(p => parseFloat(p.replace(/[^\d.]/g, '')))
        .filter(n => Number.isFinite(n) && n > 0);
      if (parts.length > 1) {
        return parts.map((freq, idx) => ({
          frequency: freq,
          type: 'sine' as WaveType,
          volume: Number((0.45 / Math.sqrt(parts.length) + 0.15).toFixed(2)),
          panX: parts.length === 2 ? (idx === 0 ? -0.5 : 0.5) : idx === 0 ? -0.5 : idx === parts.length - 1 ? 0.5 : 0,
          panY: 0,
          panZ: 0,
          crestValleyRatio: 1.0,
          dutyCycle: 0,
          phaseOffset: 0,
          name: `${item.name} · Capa ${idx + 1}`
        }));
      }
    }

    const baseFreq =
      item.numericalHz && item.numericalHz > 0
        ? item.numericalHz
        : parseFloat(item.hz.match(/[\d.]+/)?.[0] || '432') || 432;

    const baseList: Partial<OscillatorState>[] = [
      {
        frequency: baseFreq,
        type: 'sine',
        volume: 0.5,
        panX: item.binauralBeatHz ? -0.7 : 0,
        panY: 0,
        panZ: 0,
        crestValleyRatio: 1.0,
        dutyCycle: 0,
        phaseOffset: 0,
        name: item.name
      }
    ];

    if (item.binauralBeatHz && item.binauralBeatHz > 0) {
      baseList.push({
        frequency: Number((baseFreq + item.binauralBeatHz).toFixed(3)),
        type: 'sine',
        volume: 0.5,
        panX: 0.7,
        panY: 0,
        panZ: 0,
        crestValleyRatio: 1.0,
        dutyCycle: 0,
        phaseOffset: 0,
        name: `Diferencial Binaural (+${item.binauralBeatHz} Hz)`
      });
    }

    return baseList;
  }, [oscillatorsList, item]);

  const primaryFreq = useMemo(() => {
    const first = resolvedOscillators[0]?.frequency;
    if (typeof first === 'number' && first > 0) return first;
    return item.numericalHz > 0 ? item.numericalHz : 432;
  }, [resolvedOscillators, item.numericalHz]);

  const optics = useMemo(() => computeOpticalOctaveNm(primaryFreq), [primaryFreq]);
  const wavelengths = useMemo(() => computeAcousticWavelengths(primaryFreq), [primaryFreq]);

  const tech = useMemo(
    () =>
      item.technicalRecommendation ||
      autoSuggestTechnicalRecommendation(resolvedOscillators, item.category, item.name),
    [item.technicalRecommendation, resolvedOscillators, item.category, item.name]
  );

  const mediumMetaList = useMemo(
    () =>
      tech.recommendedMediums
        .map(id => RADIATION_MEDIUMS.find(m => m.id === id))
        .filter((m): m is (typeof RADIATION_MEDIUMS)[number] => Boolean(m)),
    [tech.recommendedMediums]
  );

  const stopPreview = () => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }

    const ctx = audioCtxRef.current;
    const masterGain = masterGainRef.current;
    const nodes = oscNodesRef.current;

    audioCtxRef.current = null;
    masterGainRef.current = null;
    oscNodesRef.current = [];
    setIsPreviewing(false);

    if (ctx && masterGain) {
      try {
        const now = ctx.currentTime;
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setValueAtTime(masterGain.gain.value, now);
        masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.14);
        setTimeout(() => {
          nodes.forEach(o => {
            try {
              o.stop();
              o.disconnect();
            } catch {
              /* ignore */
            }
          });
          try {
            masterGain.disconnect();
            if (ctx.state !== 'closed') ctx.close();
          } catch {
            /* ignore */
          }
        }, 160);
      } catch {
        try {
          if (ctx.state !== 'closed') ctx.close();
        } catch {
          /* ignore */
        }
      }
    }
  };

  useEffect(() => {
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      oscNodesRef.current.forEach(o => {
        try {
          o.stop();
          o.disconnect();
        } catch {
          /* ignore */
        }
      });
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try {
          audioCtxRef.current.close();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  const togglePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPreviewing) {
      stopPreview();
      return;
    }

    stopPreview();

    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new Ctx();
      if (ctx.state === 'suspended') ctx.resume();

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 0.18);
      masterGain.connect(ctx.destination);

      const createdOscs: OscillatorNode[] = [];
      const count = Math.max(1, resolvedOscillators.length);

      resolvedOscillators.forEach(oscData => {
        const freq = Math.max(0.5, Math.min(20000, Number(oscData.frequency) || 432));
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const rawType = oscData.type || 'sine';
        osc.type = (['sine', 'square', 'sawtooth', 'triangle'].includes(rawType) ? rawType : 'sine') as OscillatorType;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(((oscData.volume ?? 0.5) * 0.7) / Math.sqrt(count), ctx.currentTime);

        if (typeof ctx.createStereoPanner === 'function') {
          const panner = ctx.createStereoPanner();
          panner.pan.setValueAtTime(Math.max(-1, Math.min(1, oscData.panX ?? 0)), ctx.currentTime);
          osc.connect(gain);
          gain.connect(panner);
          panner.connect(masterGain);
        } else {
          osc.connect(gain);
          gain.connect(masterGain);
        }

        osc.start();
        createdOscs.push(osc);
      });

      audioCtxRef.current = ctx;
      masterGainRef.current = masterGain;
      oscNodesRef.current = createdOscs;
      setIsPreviewing(true);

      stopTimerRef.current = setTimeout(() => {
        if (audioCtxRef.current === ctx) {
          stopPreview();
        }
      }, 8000);
    } catch (err) {
      console.error('Error en pre-escucha de partícula:', err);
      stopPreview();
    }
  };

  const toggleSection = (key: SectionKey) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div
      className="
        relative group overflow-hidden
        bg-black/50 backdrop-blur-xl border border-white/10 hover:border-cyan-400/40
        rounded-3xl p-5 sm:p-6 transition-all duration-500 ease-out
        hover:shadow-[0_12px_45px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(34,211,238,0.06)] hover:-translate-y-1.5
        flex flex-col h-fit animate-fade-in
      "
      style={{ animationDelay: `${Math.min(delay, 500)}ms` }}
    >
      {/* Top Accent Line */}
      <div
        className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-60 ${colorClass} group-hover:opacity-100 transition-opacity duration-500`}
      />

      {/* Ambient Glow */}
      <div
        className={`absolute -inset-24 bg-gradient-to-br from-transparent via-current to-transparent opacity-0 group-hover:opacity-10 blur-3xl transition-opacity duration-700 pointer-events-none ${colorClass}`}
      />

      {/* Header Centered & Luminous */}
      <div className="relative z-10 flex flex-col items-center text-center mb-4">
        <div className="w-full flex items-center justify-between gap-2 mb-3">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase font-bold tracking-[0.18em] ${colorClass}`}
          >
            <Icon name={categoryInfo?.iconName || 'Layers'} size={12} />
            <span className="truncate max-w-[160px]">{categoryInfo?.label || item.category}</span>
          </span>

          <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300">
            {resolvedOscillators.length} {resolvedOscillators.length === 1 ? 'Capa' : 'Capas'}
          </span>
        </div>

        {/* Main Hz Display */}
        <div className="flex items-baseline justify-center gap-1.5">
          <span
            className={`font-display font-black text-3xl sm:text-4xl tracking-tighter ${colorClass} drop-shadow-[0_0_16px_currentColor] transition-all duration-500`}
          >
            {item.hz}
          </span>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Hz</span>
        </div>

        {/* Quick Equivalences (kHz / nm) */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
          <span className="px-2 py-0.5 rounded-md bg-black/50 border border-white/10 text-[10px] font-mono text-cyan-200/90">
            {wavelengths.khzOctave}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/50 border border-white/10 text-[10px] font-mono text-slate-200">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: optics.colorHex, boxShadow: `0 0 8px ${optics.colorHex}` }}
            />
            {optics.nm} nm
          </span>
        </div>

        {/* Real Synthesized Multi-Layer Waveform Band */}
        <div className="w-full mt-3">
          <ParticleWaveformBand
            oscillators={resolvedOscillators}
            isPlaying={isPreviewing}
          />
        </div>

        {/* Radiation Medium Badges */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
          {mediumMetaList.map(med => (
            <span
              key={med.id}
              title={med.summary}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wide ${med.badgeClass}`}
            >
              <Icon name={med.iconName} size={10} />
              {med.shortLabel}
            </span>
          ))}
        </div>
      </div>

      {/* Title, Location & Description */}
      <div className="w-full relative z-10 text-center flex flex-col items-center">
        <h3 className="text-lg sm:text-xl font-bold text-white mb-2 leading-snug group-hover:text-cyan-100 transition-colors">
          {item.name}
        </h3>

        {item.location && (
          <div className="inline-flex items-center gap-1.5 text-amber-200/90 text-[10px] uppercase tracking-widest font-bold mb-3 bg-amber-900/30 border border-amber-500/25 px-2.5 py-1 rounded-lg">
            <Icon name="MapPin" size={11} className="text-amber-400" />
            {item.location}
          </div>
        )}

        <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-4 font-light">
          {item.description}
        </p>
      </div>

      {/* Primary Action Controls */}
      <div className="relative z-10 flex flex-col gap-2.5 pt-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePreview}
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer ${
              isPreviewing
                ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.35)]'
                : 'bg-black/50 border-white/10 hover:border-cyan-400/40 text-slate-300 hover:text-cyan-200'
            }`}
            title={isPreviewing ? 'Detener pre-escucha' : 'Pre-escucha instantánea'}
          >
            <Icon name={isPreviewing ? 'Square' : 'Play'} size={14} className={isPreviewing ? 'animate-pulse' : ''} />
            <span className="hidden sm:inline">{isPreviewing ? 'Detener' : 'Escuchar'}</span>
          </button>

          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              stopPreview();
              onAddToPlayer(item, false);
            }}
            className="relative overflow-hidden group/btn flex-1 py-2.5 px-4 bg-gradient-to-r from-cyan-950/60 to-purple-950/60 hover:from-cyan-900/70 hover:to-purple-900/70 border border-cyan-500/30 hover:border-cyan-400/70 rounded-xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-100 transition-all duration-300 shadow-[0_0_15px_rgba(34,211,238,0.12)] hover:shadow-[0_0_24px_rgba(34,211,238,0.35)] cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-400/15 to-cyan-500/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700" />
            <Icon name="Zap" size={15} className="text-cyan-300" />
            <span>Cargar en Espectrómetro</span>
          </button>

          {onSaveToLibrary && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onSaveToLibrary(item);
              }}
              className="p-2.5 rounded-xl bg-black/50 border border-white/10 hover:border-purple-400/50 text-slate-300 hover:text-purple-200 transition-all shrink-0 cursor-pointer flex items-center justify-center"
              title="Guardar partícula en Cerebro / Carpeta"
              aria-label="Guardar partícula en Cerebro o Carpeta"
            >
              <Icon name="FolderPlus" size={15} />
            </button>
          )}
        </div>

        {/* 3 Clear Collapsible Sections */}
        <div className="flex flex-col gap-1.5 mt-1">
          {/* Section 1: Propiedades, Resonancia y Numerología */}
          <div className="rounded-xl bg-black/45 border border-white/10 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('properties')}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-left text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Icon name="Sparkles" size={13} className="text-purple-400" />
                Propiedades, Resonancia y Numerología
              </span>
              <Icon name={openSections.properties ? 'ChevronUp' : 'ChevronDown'} size={14} />
            </button>
            {openSections.properties && (
              <div className="px-3.5 pb-3.5 pt-1 text-left space-y-2.5 border-t border-white/5 text-xs">
                <p className="text-slate-300 leading-relaxed font-light">{item.detailedUsage}</p>

                {tech.naturalObjectResonance && (
                  <div className="bg-white/[0.03] rounded-lg p-2.5 border border-white/5">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-emerald-300 mb-0.5">
                      Resonancia Natural / Física
                    </span>
                    <span className="text-slate-300 text-[11px]">{tech.naturalObjectResonance}</span>
                  </div>
                )}

                {tech.numerologyRelation && (
                  <div className="bg-white/[0.03] rounded-lg p-2.5 border border-white/5">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-amber-300 mb-0.5">
                      Relación Numerológica & Espectro
                    </span>
                    <span className="text-slate-300 text-[11px]">{tech.numerologyRelation}</span>
                  </div>
                )}

                {tech.harmonicEquation && (
                  <div className="bg-white/[0.03] rounded-lg p-2.5 border border-white/5">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-cyan-300 mb-0.5">
                      Ecuación Armónica
                    </span>
                    <span className="text-cyan-100 font-mono text-[11px]">{tech.harmonicEquation}</span>
                  </div>
                )}

                {item.cymaticPatternName && (
                  <div className="flex items-center justify-between text-[11px] text-purple-200 bg-purple-950/30 border border-purple-500/20 rounded-lg px-2.5 py-1.5">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-purple-300">Patrón Cimático</span>
                    <span className="font-semibold">{item.cymaticPatternName}</span>
                  </div>
                )}

                <div className="text-[10px] text-slate-400 italic border-t border-white/5 pt-2 flex items-center justify-between">
                  <span className="uppercase tracking-wider text-[9px] text-slate-500">Evidencia / Fuente</span>
                  <span className="text-slate-300">{item.evidence}</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Recomendación Técnica Multi-Medio */}
          <div className="rounded-xl bg-black/45 border border-white/10 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('technical')}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-left text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Icon name="Cpu" size={13} className="text-cyan-400" />
                Recomendación Técnica Multi-Medio
              </span>
              <Icon name={openSections.technical ? 'ChevronUp' : 'ChevronDown'} size={14} />
            </button>
            {openSections.technical && (
              <div className="px-3.5 pb-3.5 pt-1 text-left space-y-2.5 border-t border-white/5 text-xs">
                <div className="bg-cyan-950/30 border border-cyan-500/25 rounded-lg p-2.5">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-cyan-300 mb-0.5">
                    Medio Principal Recomendado
                  </span>
                  <span className="text-white font-semibold text-xs">{tech.primaryMediumLabel}</span>
                  <p className="text-slate-300 text-[11px] mt-1 leading-relaxed">{tech.usageMode}</p>
                </div>

                {/* Scales Table */}
                <div className="rounded-lg border border-white/10 overflow-hidden bg-black/40">
                  <div className="px-2.5 py-1 bg-white/5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Escalas Frecuenciales & Ópticas
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-white/5 text-[11px]">
                    <div className="bg-black/60 p-2">
                      <span className="block text-[9px] text-slate-500 uppercase">Fundamental (Hz)</span>
                      <span className="font-mono text-cyan-300">{tech.frequencyScales.hz}</span>
                    </div>
                    <div className="bg-black/60 p-2">
                      <span className="block text-[9px] text-slate-500 uppercase">Octava kHz</span>
                      <span className="font-mono text-purple-300">{tech.frequencyScales.khz || wavelengths.khzOctave}</span>
                    </div>
                    <div className="bg-black/60 p-2">
                      <span className="block text-[9px] text-slate-500 uppercase">Armónico RF (MHz)</span>
                      <span className="font-mono text-amber-300">{tech.frequencyScales.mhz || wavelengths.mhzHarmonic}</span>
                    </div>
                    <div className="bg-black/60 p-2">
                      <span className="block text-[9px] text-slate-500 uppercase">Espectro Óptico (nm)</span>
                      <span className="font-mono text-rose-300">{tech.frequencyScales.opticalNm || `${optics.nm} nm`}</span>
                    </div>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <div className="bg-white/[0.03] rounded-lg p-2 border border-white/5">
                    <span className="block text-[9px] text-slate-500 uppercase">Volumen</span>
                    <span className="text-slate-200 font-medium">{tech.recommendedVolume}</span>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-2 border border-white/5">
                    <span className="block text-[9px] text-slate-500 uppercase">Duración</span>
                    <span className="text-slate-200 font-medium">{tech.recommendedDuration || '20 – 45 min'}</span>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-2 border border-white/5">
                    <span className="block text-[9px] text-slate-500 uppercase">Voltaje</span>
                    <span className="text-slate-200 font-medium">{tech.recommendedVoltage || '1.2 V – 12 V'}</span>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-2 border border-white/5">
                    <span className="block text-[9px] text-slate-500 uppercase">Amperaje</span>
                    <span className="text-slate-200 font-medium">{tech.recommendedAmperage || '40 – 300 mA'}</span>
                  </div>
                  <div className="col-span-2 bg-white/[0.03] rounded-lg p-2 border border-white/5 flex items-center justify-between">
                    <span className="text-[9px] text-slate-500 uppercase font-bold">Potencia (Watts)</span>
                    <span className="text-emerald-300 font-mono font-semibold">{tech.recommendedWatts || '0.5 W – 5 W'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Frecuencias y Configuraciones de la Partícula */}
          <div className="rounded-xl bg-black/45 border border-white/10 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('oscillators')}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-left text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Icon name="Sliders" size={13} className="text-amber-400" />
                Frecuencias y Configuraciones ({resolvedOscillators.length})
              </span>
              <Icon name={openSections.oscillators ? 'ChevronUp' : 'ChevronDown'} size={14} />
            </button>
            {openSections.oscillators && (
              <div className="px-3.5 pb-3.5 pt-1 text-left space-y-2 border-t border-white/5">
                {resolvedOscillators.map((osc, idx) => {
                  const freqVal = typeof osc.frequency === 'number' ? osc.frequency : primaryFreq;
                  const waveType = (osc.type || 'sine') as WaveType;
                  const volPct = Math.round((osc.volume ?? 0.5) * 100);
                  const panX = Number(osc.panX ?? 0).toFixed(2);
                  const panY = Number(osc.panY ?? 0).toFixed(2);
                  const panZ = Number(osc.panZ ?? 0).toFixed(2);
                  const crest = Number(osc.crestValleyRatio ?? 1.0).toFixed(2);
                  const asym = Number(osc.dutyCycle ?? 0).toFixed(2);
                  const phase = Math.round(osc.phaseOffset ?? 0);

                  return (
                    <div
                      key={osc.id || idx}
                      className="rounded-lg bg-black/60 border border-white/10 p-2.5 space-y-1.5 text-[11px]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white truncate flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: osc.color || '#38bdf8' }}
                          />
                          {osc.name || `Capa ${idx + 1}`}
                        </span>
                        <span className="font-mono font-bold text-cyan-300 shrink-0">
                          {freqVal} Hz
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-[10px] text-slate-300 font-mono">
                        <div className="bg-white/5 rounded px-1.5 py-0.5">
                          Onda: <span className="text-purple-300">{WAVE_LABELS[waveType] || waveType}</span>
                        </div>
                        <div className="bg-white/5 rounded px-1.5 py-0.5">
                          Vol: <span className="text-emerald-300">{volPct}%</span>
                        </div>
                        <div className="bg-white/5 rounded px-1.5 py-0.5">
                          Fase: <span className="text-amber-300">{phase}°</span>
                        </div>
                        <div className="bg-white/5 rounded px-1.5 py-0.5 col-span-2 sm:col-span-2">
                          3D (X,Y,Z): <span className="text-cyan-200">{panX}, {panY}, {panZ}</span>
                        </div>
                        <div className="bg-white/5 rounded px-1.5 py-0.5">
                          C/V: <span className="text-pink-300">{crest}</span>
                        </div>
                        <div className="bg-white/5 rounded px-1.5 py-0.5 col-span-2 sm:col-span-3">
                          Asimetría (Duty): <span className="text-slate-200">{asym}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FrequencyCard;
