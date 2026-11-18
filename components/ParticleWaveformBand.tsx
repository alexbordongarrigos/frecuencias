import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { OscillatorState, WaveType } from '../types';
import { computeOpticalOctaveNm } from '../utils/frequencyAnalysis';
import Icon from './Icon';

interface ParticleWaveformBandProps {
  oscillators: Partial<OscillatorState>[];
  isPlaying?: boolean;
  compact?: boolean;
  className?: string;
}

const LAYER_PALETTE = [
  '#22d3ee', // Cyan
  '#c084fc', // Violet
  '#fbbf24', // Amber Gold
  '#34d399', // Emerald
  '#f472b6', // Rose Magenta
  '#60a5fa', // Cobalt Blue
  '#fb7185', // Coral
  '#a3e635', // Lime
];

const WAVE_LABELS: Record<WaveType, string> = {
  sine: 'Senoidal',
  square: 'Cuadrada',
  sawtooth: 'Sierra',
  triangle: 'Triangular',
};

const SVG_WIDTH = 240;
const SVG_HEIGHT = 44;
const CENTER_Y = SVG_HEIGHT / 2;
const AMPLITUDE_PX = 17;
const SAMPLE_COUNT = 160;

interface ResolvedLayer {
  index: number;
  freq: number;
  type: WaveType;
  type2?: WaveType;
  typeMix: number;
  volume: number;
  phaseOffset: number;
  crestValleyRatio: number;
  dutyCycle: number;
  color: string;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function parseHexRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function isColorDistinct(hex: string, existing: string[]): boolean {
  const rgbA = parseHexRgb(hex);
  if (!rgbA) return !existing.some(e => e.toLowerCase() === hex.toLowerCase());
  for (let i = 0; i < existing.length; i++) {
    const rgbB = parseHexRgb(existing[i]);
    if (!rgbB) continue;
    const dist = Math.hypot(rgbA[0] - rgbB[0], rgbA[1] - rgbB[1], rgbA[2] - rgbB[2]);
    if (dist < 115) return false;
  }
  return true;
}

function evalWaveShape(shape: WaveType, phase01: number): number {
  const p = ((phase01 % 1) + 1) % 1;
  switch (shape) {
    case 'square':
      return p < 0.5 ? 1 : -1;
    case 'sawtooth':
      return 2 * p - 1;
    case 'triangle':
      if (p < 0.25) return p * 4;
      if (p < 0.75) return 2 - p * 4;
      return (p - 1) * 4;
    case 'sine':
    default:
      return Math.sin(p * Math.PI * 2);
  }
}

function sampleLayerAt(
  layer: ResolvedLayer,
  u: number,
  cycles: number,
  animCyclesShift: number
): number {
  const rawPhase = u * cycles + layer.phaseOffset / 360 + animCyclesShift;
  const frac = ((rawPhase % 1) + 1) % 1;

  // Apply duty-cycle asymmetry cleanly around the half-period split
  const duty = clamp(layer.dutyCycle, -0.9, 0.9);
  const split = 0.5 + duty * 0.42;
  const warped =
    frac < split
      ? (frac / split) * 0.5
      : 0.5 + ((frac - split) / Math.max(0.05, 1 - split)) * 0.5;

  const primary = evalWaveShape(layer.type, warped);
  let y = primary;
  if (layer.type2 && layer.type2 !== layer.type && layer.typeMix > 0.01) {
    const secondary = evalWaveShape(layer.type2, warped);
    y = primary * (1 - layer.typeMix) + secondary * layer.typeMix;
  }

  // Crest/Valley ratio modulation normalized within [-1, 1]
  const cv = clamp(layer.crestValleyRatio, 0.25, 4);
  if (Math.abs(cv - 1) > 0.01) {
    const k = Math.sqrt(cv);
    if (y >= 0) {
      y = Math.min(1, y * clamp(k, 0.65, 1.35));
    } else {
      y = Math.max(-1, y / clamp(k, 0.65, 1.35));
    }
  }

  return y;
}

const ParticleWaveformBand: React.FC<ParticleWaveformBandProps> = ({
  oscillators,
  isPlaying = false,
  compact = false,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const [showIndividual, setShowIndividual] = useState(false);
  const [activeLayerIdx, setActiveLayerIdx] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [animPhase, setAnimPhase] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying && !isHovered) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) * 0.001);
      last = now;
      setAnimPhase(prev => (prev + dt * (isPlaying ? 1.15 : 0.65)) % 1000);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, isHovered]);

  const layers = useMemo<ResolvedLayer[]>(() => {
    const source =
      oscillators && oscillators.length > 0
        ? oscillators
        : [{ frequency: 432, type: 'sine' as WaveType, volume: 0.5 }];

    const usedColors: string[] = [];

    return source.map((osc, idx) => {
      const freq = Math.max(0.05, Number(osc.frequency) || 432);
      const rawType = osc.type || 'sine';
      const type: WaveType = ['sine', 'square', 'sawtooth', 'triangle'].includes(rawType)
        ? (rawType as WaveType)
        : 'sine';
      const type2Raw = osc.type2;
      const type2: WaveType | undefined =
        type2Raw && ['sine', 'square', 'sawtooth', 'triangle'].includes(type2Raw)
          ? (type2Raw as WaveType)
          : undefined;

      // Guarantee distinct, readable vivid color per constituent frequency layer
      let chosenColor = '';
      const candidateCustom = osc.color?.trim();
      if (candidateCustom && isColorDistinct(candidateCustom, usedColors)) {
        chosenColor = candidateCustom;
      } else {
        const opticalHex = computeOpticalOctaveNm(freq).colorHex;
        if (idx > 0 && isColorDistinct(opticalHex, usedColors)) {
          chosenColor = opticalHex;
        } else {
          chosenColor =
            LAYER_PALETTE.find(c => isColorDistinct(c, usedColors)) ||
            LAYER_PALETTE[idx % LAYER_PALETTE.length];
        }
      }
      usedColors.push(chosenColor);

      return {
        index: idx,
        freq,
        type,
        type2,
        typeMix: clamp(Number(osc.typeMix ?? 0), 0, 1),
        volume: clamp(Number(osc.volume ?? 0.5), 0.05, 1),
        phaseOffset: Number(osc.phaseOffset ?? 0) || 0,
        crestValleyRatio: Number(osc.crestValleyRatio ?? 1.0) || 1.0,
        dutyCycle: Number(osc.dutyCycle ?? 0) || 0,
        color: chosenColor,
      };
    });
  }, [oscillators]);

  // Reset solo highlight if layer count shrinks
  useEffect(() => {
    if (activeLayerIdx !== null && activeLayerIdx >= layers.length) {
      setActiveLayerIdx(null);
    }
  }, [layers.length, activeLayerIdx]);

  const { combinedPath, areaPath, layerPaths } = useMemo(() => {
    const fMin = layers.reduce((min, l) => Math.min(min, l.freq), layers[0].freq);
    let baseCycles = Math.min(8.5, Math.max(1.6, 1.5 + Math.log2(Math.max(1, fMin)) * 0.48));

    // Scale cycle window gently if layers form a close beat differential (1 < rho < 1.15)
    let beatBoost = 1;
    for (let i = 0; i < layers.length; i++) {
      const rho = layers[i].freq / fMin;
      if (rho > 1.0005 && rho < 1.15) {
        beatBoost = Math.max(beatBoost, 1 + (rho - 1) * 16);
      }
    }
    const effectiveBase = Math.min(18, baseCycles * beatBoost);

    const perLayerCycles = layers.map(l => {
      const rho = l.freq / fMin;
      const ratioScaled = rho <= 6 ? rho : 6 + Math.log2(rho / 6) * 2.2;
      return effectiveBase * ratioScaled;
    });

    const layerSamples: number[][] = layers.map(() => new Array(SAMPLE_COUNT + 1).fill(0));
    const rawSum = new Array<number>(SAMPLE_COUNT + 1).fill(0);
    let totalAmp = 0;
    for (let k = 0; k < layers.length; k++) {
      totalAmp += layers[k].volume;
    }

    let maxAbsSum = 0.001;
    for (let i = 0; i <= SAMPLE_COUNT; i++) {
      const u = i / SAMPLE_COUNT;
      let s = 0;
      for (let k = 0; k < layers.length; k++) {
        const cycles = perLayerCycles[k];
        const rho = layers[k].freq / fMin;
        const speedFactor = rho <= 4 ? rho : 4 + Math.log2(rho / 4) * 0.6;
        const val = sampleLayerAt(layers[k], u, cycles, animPhase * speedFactor);
        layerSamples[k][i] = val;
        s += val * layers[k].volume;
      }
      rawSum[i] = s;
      const absS = Math.abs(s);
      if (absS > maxAbsSum) maxAbsSum = absS;
    }

    // Soft-normalize superposition while reflecting average volume energy cleanly
    const normDivisor = Math.max(0.15, maxAbsSum);
    const volPresence = clamp(0.45 + (totalAmp / layers.length) * 0.55, 0.35, 1);

    let cPath = '';
    for (let i = 0; i <= SAMPLE_COUNT; i++) {
      const x = ((i / SAMPLE_COUNT) * SVG_WIDTH).toFixed(2);
      const yNorm = clamp((rawSum[i] / normDivisor) * volPresence, -1, 1);
      const y = (CENTER_Y - yNorm * AMPLITUDE_PX).toFixed(2);
      cPath += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }

    const aPath = `${cPath} L ${SVG_WIDTH} ${CENTER_Y} L 0 ${CENTER_Y} Z`;

    const lPaths = layers.map((layer, k) => {
      let d = '';
      const layerAmp = AMPLITUDE_PX * clamp(0.42 + layer.volume * 0.58, 0.4, 1);
      for (let i = 0; i <= SAMPLE_COUNT; i++) {
        const x = ((i / SAMPLE_COUNT) * SVG_WIDTH).toFixed(2);
        const y = (CENTER_Y - layerSamples[k][i] * layerAmp).toFixed(2);
        d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
      }
      return d;
    });

    return { combinedPath: cPath, areaPath: aPath, layerPaths: lPaths };
  }, [layers, animPhase]);

  const multiGradientStops = useMemo(() => {
    if (layers.length === 1) {
      return [
        { offset: '0%', color: layers[0].color },
        { offset: '100%', color: layers[0].color },
      ];
    }
    return layers.map((l, idx) => ({
      offset: `${Math.round((idx / Math.max(1, layers.length - 1)) * 100)}%`,
      color: l.color,
    }));
  }, [layers]);

  return (
    <div
      className={`w-full flex flex-col gap-1.5 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Real Synthesized Waveform Canvas */}
      <div
        className={`relative w-full ${
          compact ? 'h-9' : 'h-11'
        } rounded-xl bg-black/55 border border-white/10 overflow-hidden px-1.5 py-0.5 shadow-[inset_0_0_16px_rgba(0,0,0,0.85)]`}
      >
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
          aria-label="Onda física real de la partícula"
        >
          <defs>
            <linearGradient id={`grad-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
              {multiGradientStops.map((stop, idx) => (
                <stop key={idx} offset={stop.offset} stopColor={stop.color} />
              ))}
            </linearGradient>
            <linearGradient id={`area-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={layers[0].color} stopOpacity="0.22" />
              <stop offset="50%" stopColor={layers[0].color} stopOpacity="0.03" />
              <stop offset="100%" stopColor={layers[layers.length - 1].color} stopOpacity="0.18" />
            </linearGradient>
          </defs>

          {/* Subtle zero-crossing baseline */}
          <line
            x1="0"
            y1={CENTER_Y}
            x2={SVG_WIDTH}
            y2={CENTER_Y}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="0.7"
            strokeDasharray="3 3"
          />

          {!showIndividual ? (
            <>
              <path d={areaPath} fill={`url(#area-${uid})`} />
              {layers.length > 1 &&
                layerPaths.map((d, idx) => (
                  <path
                    key={idx}
                    d={d}
                    fill="none"
                    stroke={layers[idx].color}
                    strokeWidth="0.85"
                    opacity="0.22"
                    strokeLinecap="round"
                  />
                ))}
              <path
                d={combinedPath}
                fill="none"
                stroke={`url(#grad-${uid})`}
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={
                  isPlaying || isHovered
                    ? { filter: `drop-shadow(0 0 6px ${layers[0].color}88)` }
                    : undefined
                }
              />
            </>
          ) : (
            <>
              <path
                d={combinedPath}
                fill="none"
                stroke="rgba(248,250,252,0.28)"
                strokeWidth="1.0"
                strokeDasharray="3 2.5"
                strokeLinecap="round"
              />
              {layerPaths.map((d, idx) => {
                const isSelected = activeLayerIdx === null || activeLayerIdx === idx;
                const layer = layers[idx];
                return (
                  <path
                    key={idx}
                    d={d}
                    fill="none"
                    stroke={layer.color}
                    strokeWidth={activeLayerIdx === idx ? 2.4 : 1.75}
                    opacity={isSelected ? 0.96 : 0.14}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={
                      isSelected
                        ? { filter: `drop-shadow(0 0 5px ${layer.color}88)` }
                        : undefined
                    }
                  />
                );
              })}
            </>
          )}
        </svg>
      </div>

      {/* Mode Toggle Button + Color Dots Preview */}
      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            setShowIndividual(v => !v);
            setActiveLayerIdx(null);
          }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold tracking-wide transition-all cursor-pointer ${
            showIndividual
              ? 'morph-tab-active'
              : 'morph-btn-glass text-slate-200'
          }`}
          title={
            showIndividual
              ? 'Volver a mostrar la onda física combinada'
              : 'Ver cada frecuencia constitutiva por su color real'
          }
        >
          <span className="inline-flex items-center -space-x-1 mr-0.5">
            {layers.slice(0, 5).map(l => (
              <span
                key={l.index}
                className="w-2 h-2 rounded-full border border-black/70 shrink-0"
                style={{ backgroundColor: l.color, boxShadow: `0 0 6px ${l.color}` }}
              />
            ))}
          </span>
          <Icon name={showIndividual ? 'Activity' : 'Layers'} size={11} />
          <span>
            {showIndividual
              ? 'Ver Onda Combinada'
              : layers.length > 1
                ? `Ver Ondas por Color (${layers.length})`
                : 'Ver Onda por Color'}
          </span>
        </button>
      </div>

      {/* Interactive Per-Color Frequency Layer Chips */}
      {showIndividual && (
        <div
          className="flex flex-wrap items-center justify-center gap-1 pt-0.5"
          onClick={e => e.stopPropagation()}
        >
          {layers.map((layer, idx) => {
            const isSolo = activeLayerIdx === idx;
            const isDimmed = activeLayerIdx !== null && activeLayerIdx !== idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveLayerIdx(prev => (prev === idx ? null : idx))}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-mono transition-all cursor-pointer ${
                  isSolo
                    ? 'bg-white/15 border-white/50 text-white scale-105'
                    : isDimmed
                      ? 'bg-black/45 border-white/10 text-slate-400 opacity-50 hover:opacity-90'
                      : 'bg-black/55 border-white/15 text-slate-200 hover:border-white/40'
                }`}
                style={
                  isSolo
                    ? { borderColor: layer.color, boxShadow: `0 0 10px ${layer.color}66` }
                    : undefined
                }
                title={`Clic para aislar la onda ${layer.freq} Hz (${WAVE_LABELS[layer.type]})`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: layer.color }}
                />
                <span className="font-bold">{Number(layer.freq.toFixed(2))} Hz</span>
                <span className="text-slate-400">· {WAVE_LABELS[layer.type]}</span>
                <span className="text-slate-400">· {Math.round(layer.volume * 100)}%</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ParticleWaveformBand;
