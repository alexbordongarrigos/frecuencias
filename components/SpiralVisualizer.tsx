import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { SpiralConfig, CymaticsPalette, SacredGeometryMode, OscillatorState } from '../types';
import Icon from './Icon';
import * as GeometryDrawers from './geometryDrawers';
import OscillatorControls from './OscillatorControls';

interface Props {
  analyser: AnalyserNode | null;
  activeOscillators?: OscillatorState[];
  activeFrequencies?: number[];
  allOscillators?: OscillatorState[];
  onUpdateOscillator?: (id: string, updates: Partial<OscillatorState>) => void;
  onRemoveOscillator?: (id: string) => void;
  getOscillatorAnalyser?: (id: string) => AnalyserNode | null | undefined;
  isMasterPlaying?: boolean;
  height?: number;
  transparentBg?: boolean;
}

const DEFAULT_CONFIG: SpiralConfig = {
  k: 1.002,
  psi: 2.399,
  z0_r: 0,
  z0_i: 0,
  iter: 10000,
  zoom: 0.001,
  speedMultiplier: 1.0,
  thickness: 2.0,
  opacity: 0.8,
  unifiedMode: true,
  colorPalette: 'holographic',
  depthMode: false,
  depthSpeed: 1.0,
  baseFrequencyRef: 432,
  angleMultiplier: 1.0,
  waveStyle: false,
  waveAmplitude: 0.5,
  infiniteDepth: true,
  illumination: 0.0,
  autoPilot: true,
  sacredGeometryEnabled: false,
  sacredGeometryModes: [],
  bgMode: 'solid',
};

const SACRED_GEOMETRY_OPTIONS: { id: SacredGeometryMode; label: string }[] = [
  { id: 'flowerOfLife', label: 'Flor de la Vida' },
  { id: 'metatron', label: 'Cubo de Metatrón' },
  { id: 'torus', label: 'Toroide Cósmico' },
  { id: 'merkaba', label: 'Merkaba' },
  { id: 'sriYantra', label: 'Sri Yantra' },
  { id: 'goldenSpiral', label: 'Espiral Áurea φ' },
  { id: 'platonicSolids', label: 'Sólidos Platónicos' },
  { id: 'vectorEquilibrium', label: 'Equilibrio Vectorial' },
  { id: 'cymatics', label: 'Cimática Polar' },
  { id: 'holographicFractal', label: 'Fractal Holográfico' },
  { id: 'chakras', label: 'Chakras' },
  { id: 'lotus', label: 'Loto Sagrado' },
  { id: 'om', label: 'Símbolo Om' },
  { id: 'yinYang', label: 'Yin-Yang' },
  { id: 'treeOfLife', label: 'Árbol de la Vida' },
  { id: 'dharmaChakra', label: 'Rueda Dharma' },
  { id: 'mandala1', label: 'Mandala Bhupura' },
  { id: 'mandala2', label: 'Mandala Orbital' },
  { id: 'mandala3', label: 'Mandala Bindu' },
  { id: 'quantumWave', label: 'Onda Cuántica' },
];

const PALETTE_OPTIONS: { id: CymaticsPalette; label: string }[] = [
  { id: 'holographic', label: 'Holográfico' },
  { id: 'quantum', label: 'Quantum Blue' },
  { id: 'neon', label: 'Neon Magenta' },
  { id: 'aurora', label: 'Aurora Green' },
  { id: 'gold', label: 'Gold Alquimia' },
];

const drawGoldenSpiralOverlay = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  rotation: number,
  lineOpacity: number,
  hue: number,
  vol: number,
  thickness: number
) => {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.strokeStyle = `hsla(${hue}, 90%, 65%, ${lineOpacity})`;
  ctx.lineWidth = (1.2 + vol * 1.8) * thickness * 0.7;

  const phi = 1.61803398875;
  const b = Math.log(phi) / (Math.PI / 2);
  const startScale = r * 0.04;
  const maxTheta = Math.PI * 5.2;

  for (let arm = 0; arm < 2; arm++) {
    ctx.save();
    ctx.rotate(arm * Math.PI);
    ctx.beginPath();
    for (let theta = 0; theta <= maxTheta; theta += 0.08) {
      const rad = startScale * Math.exp(b * theta);
      if (rad > r * 1.45) break;
      const x = Math.cos(theta) * rad;
      const y = Math.sin(theta) * rad;
      if (theta === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Concentric Phi circles
  for (let i = 0; i < 4; i++) {
    const cr = r * 1.15 / Math.pow(phi, i);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1, cr), 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${(hue + i * 25) % 360}, 85%, 65%, ${lineOpacity * 0.45})`;
    ctx.stroke();
  }

  ctx.restore();
};

const drawQuantumWaveOverlay = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  rotation: number,
  lineOpacity: number,
  hue: number,
  time: number,
  vol: number,
  thickness: number
) => {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.lineWidth = (1.1 + vol * 1.5) * thickness * 0.65;

  const rings = 5;
  for (let ring = 1; ring <= rings; ring++) {
    const baseRad = (r * 1.25 * ring) / rings;
    const lobes = 4 + ring * 2;
    ctx.strokeStyle = `hsla(${(hue + ring * 22) % 360}, 95%, 65%, ${lineOpacity * (0.9 - ring * 0.1)})`;
    ctx.beginPath();
    for (let deg = 0; deg <= 360; deg += 3) {
      const a = (deg * Math.PI) / 180;
      const mod = Math.sin(lobes * a + time * (ring % 2 === 0 ? 1.4 : -1.2)) * (r * 0.08 * (0.5 + vol));
      const rad = Math.max(1, baseRad + mod);
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad;
      if (deg === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
};

export const SpiralVisualizer: React.FC<Props> = ({
  analyser,
  activeOscillators = [],
  activeFrequencies,
  allOscillators = [],
  onUpdateOscillator,
  onRemoveOscillator,
  getOscillatorAnalyser,
  isMasterPlaying = true,
  height = 420,
  transparentBg = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  const [config, setConfig] = useState<SpiralConfig>(DEFAULT_CONFIG);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenControls, setShowFullscreenControls] = useState(false);
  const [showInlineControls, setShowInlineControls] = useState(false);
  const [openSections, setOpenSections] = useState({
    fractal: false,
    modulation: false,
    geometry: false,
  });
  const [viewZoom, setViewZoom] = useState(1.0);
  const [manualRotation, setManualRotation] = useState(0);

  // Refs to preserve animation continuity across inline <-> portal fullscreen transitions
  const configRef = useRef(config);
  const analyserRef = useRef(analyser);
  const activeOscillatorsRef = useRef(activeOscillators);
  const activeFrequenciesRef = useRef(activeFrequencies);
  const isMasterPlayingRef = useRef(isMasterPlaying);
  const transparentBgRef = useRef(transparentBg);
  const viewZoomRef = useRef(viewZoom);
  const manualRotationRef = useRef(manualRotation);
  const timeRef = useRef(0);
  const smoothedVolRef = useRef(0);
  const smoothedFreqRef = useRef(432);
  const logicalSizeRef = useRef({ width: 640, height: 420, dpr: 1 });

  const isDraggingRef = useRef(false);
  const lastPointerXRef = useRef(0);
  const pinchDistRef = useRef<number | null>(null);
  const wasNativeFullscreenRef = useRef(false);

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { analyserRef.current = analyser; }, [analyser]);
  useEffect(() => { activeOscillatorsRef.current = activeOscillators; }, [activeOscillators]);
  useEffect(() => { activeFrequenciesRef.current = activeFrequencies; }, [activeFrequencies]);
  useEffect(() => { isMasterPlayingRef.current = isMasterPlaying; }, [isMasterPlaying]);
  useEffect(() => { transparentBgRef.current = transparentBg; }, [transparentBg]);
  useEffect(() => { viewZoomRef.current = viewZoom; }, [viewZoom]);
  useEffect(() => { manualRotationRef.current = manualRotation; }, [manualRotation]);

  const enterFullscreen = useCallback(() => {
    setIsFullscreen(true);
    setShowFullscreenControls(false);
    try {
      const el = document.documentElement;
      if (el.requestFullscreen && !document.fullscreenElement) {
        el.requestFullscreen().catch(() => { });
      }
    } catch {
      // Portal fullscreen already active
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    setIsFullscreen(false);
    setShowFullscreenControls(false);
    wasNativeFullscreenRef.current = false;
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => { });
      }
    } catch {
      // Ignore native exit errors
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) exitFullscreen();
    else enterFullscreen();
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        wasNativeFullscreenRef.current = true;
      } else if (wasNativeFullscreenRef.current) {
        wasNativeFullscreenRef.current = false;
        setIsFullscreen(false);
        setShowFullscreenControls(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitFullscreen();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, exitFullscreen]);

  const resetToDefaults = () => {
    setConfig(DEFAULT_CONFIG);
    setViewZoom(1.0);
    setManualRotation(0);
  };

  const getPaletteColors = (palette: CymaticsPalette): [string, string] => {
    switch (palette) {
      case 'quantum': return ['#3b82f6', '#60a5fa'];
      case 'neon': return ['#f472b6', '#ec4899'];
      case 'aurora': return ['#34d399', '#10b981'];
      case 'gold': return ['#fbbf24', '#f59e0b'];
      case 'holographic':
      default: return ['#22d3ee', '#a855f7'];
    }
  };

  // ResizeObserver, DPR scaling, Wheel zoom, and Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateCanvasSize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const heightPx = Math.max(1, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      const targetW = Math.floor(width * dpr);
      const targetH = Math.floor(heightPx * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      logicalSizeRef.current = { width, height: heightPx, dpr };
    };

    updateCanvasSize();
    const resizeObserver = new ResizeObserver(() => updateCanvasSize());
    resizeObserver.observe(container);

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.0014;
      setViewZoom(prev => Math.min(3.5, Math.max(0.35, Number((prev + delta).toFixed(3)))));
    };
    container.addEventListener('wheel', handleWheel, { passive: false });

    let animFrameId: number;
    let fftData = new Uint8Array(256);

    const render = () => {
      const currentAnalyser = analyserRef.current;
      const currentConfig = configRef.current;
      const providedOscs = activeOscillatorsRef.current || [];
      const fallbackFreqs = activeFrequenciesRef.current || [];

      const effectiveOscs: OscillatorState[] =
        providedOscs.length > 0
          ? providedOscs
          : fallbackFreqs.map((f, idx) => ({
            id: `fallback-${idx}`,
            frequency: f,
            type: 'sine',
            volume: 0.6,
            panX: 0,
            panY: 0,
            panZ: 0,
            isPlaying: isMasterPlayingRef.current,
            isIndependent: false,
            color: '#22d3ee',
          }));

      if (currentAnalyser && currentAnalyser.frequencyBinCount !== fftData.length) {
        fftData = new Uint8Array(currentAnalyser.frequencyBinCount);
      }

      const { width, height: hPx, dpr } = logicalSizeRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cx = width / 2;
      const cy = hPx / 2;
      const minDim = Math.min(width, hPx);

      const hasPlaying = effectiveOscs.some(o => o.isPlaying);
      let audioAmp = 0;
      if (currentAnalyser && hasPlaying && isMasterPlayingRef.current) {
        currentAnalyser.getByteFrequencyData(fftData);
        let sum = 0;
        const bins = Math.min(64, fftData.length);
        for (let i = 0; i < bins; i++) sum += fftData[i];
        audioAmp = sum / Math.max(1, bins) / 255;
      }

      const primaryFreq = effectiveOscs.length > 0 ? effectiveOscs[0].frequency : 432;
      if (!hasPlaying || !isMasterPlayingRef.current) {
        smoothedVolRef.current += (0 - smoothedVolRef.current) * 0.1;
      } else {
        smoothedVolRef.current += (audioAmp - smoothedVolRef.current) * 0.12;
      }
      smoothedFreqRef.current += (primaryFreq - smoothedFreqRef.current) * 0.1;

      if (isMasterPlayingRef.current && hasPlaying) {
        timeRef.current += 0.02 * currentConfig.speedMultiplier;
      }

      const time = timeRef.current;
      const smoothedVol = smoothedVolRef.current;
      const smoothedFreq = smoothedFreqRef.current;

      // Clean dark trail (default classic look) or fully transparent canvas for 3D showcase
      if (transparentBgRef.current) {
        ctx.clearRect(0, 0, width, hPx);
      } else {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, width, hPx);
      }

      const colors = getPaletteColors(currentConfig.colorPalette);
      const isHeroTransparent = transparentBgRef.current;
      // In backgroundless single-frame clearRect mode, cap iterations to 1800 and crisp zoom so 528Hz / arbitrary angles reveal delicate vortex arms cleanly instead of solid dense fill
      const iter = isHeroTransparent
        ? Math.min(1800, Math.max(100, currentConfig.iter))
        : Math.max(100, currentConfig.iter);
      const baseZoom = (isHeroTransparent ? currentConfig.zoom * 1.8 : currentConfig.zoom) * viewZoomRef.current;
      const manualRot = manualRotationRef.current;

      const drawSpiral = (
        osc: OscillatorState | null,
        freq: number,
        vol: number,
        baseColor: string,
        isUnified: boolean
      ) => {
        let k = currentConfig.k * (osc?.crestValleyRatio ?? 1.0);
        if (isHeroTransparent) {
          k = Math.max(1.0035, k);
        }
        if (currentConfig.autoPilot && hasPlaying) {
          k = (isHeroTransparent ? 1.004 : 1.002) + Math.sin(time * 0.1) * 0.004 + vol * 0.004;
        }
        k = Math.max(0.5, Math.min(1.5, k));

        const angleMult = currentConfig.angleMultiplier * (osc?.dutyCycle ? 1.0 + osc.dutyCycle : 1.0);
        const psi = (freq * Math.PI / 180) * angleMult;
        const rotReal = Math.cos(psi);
        const rotImag = Math.sin(psi);

        const z0_r = currentConfig.z0_r !== 0 ? currentConfig.z0_r : 1.0 + vol * 0.45;
        const z0_i = currentConfig.z0_i !== 0 ? currentConfig.z0_i : 0.0;

        let zReal = z0_r;
        let zImag = z0_i;
        const loopStart = currentConfig.infiniteDepth ? -iter : 0;
        const loopEnd = iter;

        if (currentConfig.infiniteDepth) {
          const startMag = Math.pow(k, -iter);
          const startAngle = -iter * psi;
          const rotStartR = Math.cos(startAngle);
          const rotStartI = Math.sin(startAngle);
          zReal = (z0_r * rotStartR - z0_i * rotStartI) * startMag;
          zImag = (z0_r * rotStartI + z0_i * rotStartR) * startMag;
        }

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(manualRot);

        const currentZoom = baseZoom * minDim;

        if (currentConfig.infiniteDepth) {
          const safePsi = Math.abs(psi) > 0.0001 ? psi : 0.0001;
          const iterPerTurn = (2 * Math.PI) / Math.abs(safePsi);
          const growthPerTurn = Math.pow(k, iterPerTurn);
          const zoomPhase = ((time * currentConfig.depthSpeed * 0.1) % 1 + 1) % 1;
          const continuousScale = Math.pow(growthPerTurn, zoomPhase);
          const rotationOffset = 2 * Math.PI * zoomPhase * Math.sign(safePsi);
          if (Number.isFinite(continuousScale) && continuousScale > 0 && continuousScale < 1e6) {
            ctx.scale(continuousScale, continuousScale);
          }
          ctx.rotate(rotationOffset);
        } else if (currentConfig.depthMode) {
          const zF = 1 + ((time * currentConfig.depthSpeed) % 12);
          ctx.scale(zF, zF);
        }

        ctx.beginPath();
        let moved = false;
        const maxBound = isHeroTransparent ? minDim * 0.48 : Math.max(width, hPx) * 4;

        for (let n = loopStart; n < loopEnd; n++) {
          const zrK = zReal * k;
          const ziK = zImag * k;
          const nextReal = zrK * rotReal - ziK * rotImag;
          const nextImag = zrK * rotImag + ziK * rotReal;
          zReal = nextReal;
          zImag = nextImag;

          let px = zReal * currentZoom;
          let py = -zImag * currentZoom;

          if (currentConfig.waveStyle) {
            const wavePhase = n * 0.1 + time * (freq / 100);
            const mag = Math.hypot(zReal, zImag) || 1;
            const nx = -zImag / mag;
            const ny = -zReal / mag;
            const waveOffset = Math.sin(wavePhase) * currentConfig.waveAmplitude * 18 * (vol + 0.25);
            px += nx * waveOffset;
            py += ny * waveOffset;
          }

          if (!Number.isFinite(px) || !Number.isFinite(py)) break;
          if (Math.abs(px) > maxBound || Math.abs(py) > maxBound) {
            if (n > 0) break;
            continue;
          }

          if (!moved) {
            ctx.moveTo(px, py);
            moved = true;
          } else {
            ctx.lineTo(px, py);
          }
        }

        if (isUnified) {
          const gradient = ctx.createLinearGradient(-minDim / 2, -minDim / 2, minDim / 2, minDim / 2);
          gradient.addColorStop(0, colors[0]);
          gradient.addColorStop(1, colors[1]);
          ctx.strokeStyle = gradient;
          ctx.shadowColor = colors[0];
        } else {
          ctx.strokeStyle = baseColor;
          ctx.shadowColor = baseColor;
        }

        ctx.lineWidth = isHeroTransparent
          ? Math.max(0.45, Math.min(1.4, (currentConfig.thickness + vol * 1.4) * 0.34))
          : Math.max(0.28, (currentConfig.thickness + vol * 2.2) * (0.14 + currentConfig.illumination * 0.45));
        ctx.shadowBlur = currentConfig.illumination > 0 ? (10 + vol * 30) * currentConfig.illumination : 0;
        ctx.globalAlpha = currentConfig.opacity;
        ctx.stroke();

        ctx.restore();
      };

      if (effectiveOscs.length === 0) {
        drawSpiral(null, smoothedFreq, smoothedVol, colors[0], true);
      } else {
        const independentOscs = effectiveOscs.filter(o => o.isIndependent);
        const unifiedOscs = effectiveOscs.filter(o => !o.isIndependent);

        if (unifiedOscs.length > 0) {
          const avgFreq = unifiedOscs.reduce((a, b) => a + b.frequency, 0) / unifiedOscs.length;
          const maxVol = unifiedOscs.some(o => o.isPlaying) ? smoothedVol : 0;
          drawSpiral(null, avgFreq, maxVol, colors[0], true);
        }

        independentOscs.forEach((osc, idx) => {
          const vol = osc.isPlaying ? smoothedVol * osc.volume : 0;
          drawSpiral(osc, osc.frequency, vol, osc.color || colors[idx % colors.length], false);
        });
      }

      // Sacred Geometry Overlays (ALL modes supported & properly centered/scaled)
      if (currentConfig.sacredGeometryEnabled && currentConfig.sacredGeometryModes.length > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, currentConfig.opacity * 0.72);
        const baseHue = (time * 20 + smoothedFreq * 0.25) % 360;
        const baseR = (minDim * 0.145 + smoothedVol * minDim * 0.025) * viewZoomRef.current;
        const rot = time * 0.22 + manualRot;
        const lineOp = 0.65;
        const bgOp = 0.08;
        const thick = Math.max(0.6, currentConfig.thickness * 0.6);

        currentConfig.sacredGeometryModes.forEach((mode, idx) => {
          const hue = (baseHue + idx * 35) % 360;
          switch (mode) {
            case 'flowerOfLife':
              GeometryDrawers.drawFlowerOfLife(ctx, cx, cy, baseR * 0.85, rot, lineOp, bgOp, hue, 95, 60, smoothedVol, thick);
              break;
            case 'metatron':
              GeometryDrawers.drawMetatron(ctx, cx, cy, baseR * 0.85, rot, lineOp, bgOp, hue, 95, 60, smoothedVol, thick);
              break;
            case 'torus':
              GeometryDrawers.drawTorus(ctx, cx, cy, baseR * 0.8, rot, lineOp, bgOp, hue, 95, 60, time, smoothedVol, thick);
              break;
            case 'merkaba':
              GeometryDrawers.drawMerkaba(ctx, cx, cy, baseR * 0.9, rot, lineOp, bgOp, hue, 95, 60, time, smoothedVol, thick);
              break;
            case 'sriYantra':
              GeometryDrawers.drawSriYantra(ctx, cx, cy, baseR * 0.62, rot, lineOp, bgOp, hue, 95, 60, smoothedVol, thick);
              break;
            case 'goldenSpiral':
              drawGoldenSpiralOverlay(ctx, cx, cy, baseR * 1.9, rot, lineOp, hue, smoothedVol, thick);
              break;
            case 'platonicSolids':
              GeometryDrawers.drawPlatonicSolids(ctx, cx, cy, baseR * 0.9, rot, lineOp, bgOp, hue, 95, 60, time, smoothedVol, thick);
              break;
            case 'vectorEquilibrium':
              GeometryDrawers.drawVectorEquilibrium(ctx, cx, cy, baseR * 0.9, rot, lineOp, bgOp, hue, 95, 60, time, smoothedVol, thick);
              break;
            case 'cymatics':
              GeometryDrawers.drawCymatics(ctx, cx, cy, baseR * 0.68, rot, lineOp, bgOp, hue, 95, 60, time, smoothedVol, thick);
              break;
            case 'holographicFractal':
              GeometryDrawers.drawHolographicFractal(ctx, cx, cy, baseR * 0.62, rot, lineOp, bgOp, hue, 95, 60, time, smoothedVol, thick);
              break;
            case 'chakras':
              GeometryDrawers.drawChakras(ctx, cx, cy, baseR * 0.72, rot, lineOp, bgOp, hue, 95, 60, time, smoothedVol, thick);
              break;
            case 'lotus':
              GeometryDrawers.drawLotus(ctx, cx, cy, baseR * 0.76, rot, lineOp, bgOp, hue, 95, 60, time, smoothedVol, thick);
              break;
            case 'om':
              GeometryDrawers.drawOm(ctx, cx, cy, baseR * 0.42, rot, lineOp, bgOp, hue, 95, 60, smoothedVol, thick);
              break;
            case 'yinYang':
              GeometryDrawers.drawYinYang(ctx, cx, cy, baseR * 0.9, rot, lineOp, bgOp, hue, 95, 60, time, smoothedVol, thick);
              break;
            case 'treeOfLife':
              GeometryDrawers.drawTreeOfLife(ctx, cx, cy, baseR * 0.75, rot, lineOp, bgOp, hue, 95, 60, smoothedVol, thick);
              break;
            case 'dharmaChakra':
              GeometryDrawers.drawDharmaChakra(ctx, cx, cy, baseR * 0.9, rot, lineOp, bgOp, hue, 95, 60, time, smoothedVol, thick);
              break;
            case 'mandala1':
              GeometryDrawers.drawMandala1(ctx, cx, cy, baseR * 0.62, rot, lineOp, bgOp, hue, 95, 60, smoothedVol, thick);
              break;
            case 'mandala2':
              GeometryDrawers.drawMandala2(ctx, cx, cy, baseR * 0.9, rot, lineOp, bgOp, hue, 95, 60, time, smoothedVol, thick);
              break;
            case 'mandala3':
              GeometryDrawers.drawMandala3(ctx, cx, cy, baseR * 0.65, rot, lineOp, bgOp, hue, 95, 60, time, smoothedVol, thick);
              break;
            case 'quantumWave':
              drawQuantumWaveOverlay(ctx, cx, cy, baseR * 1.6, rot, lineOp, hue, time, smoothedVol, thick);
              break;
            default:
              break;
          }
        });
        ctx.restore();
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
      animFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameId);
      resizeObserver.disconnect();
      container.removeEventListener('wheel', handleWheel);
    };
  }, [isFullscreen]);

  // Interactive Mouse & Touch Canvas Controls (Drag rotation + Pinch zoom)
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastPointerXRef.current = e.clientX;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastPointerXRef.current;
    lastPointerXRef.current = e.clientX;
    setManualRotation(prev => prev + dx * 0.008);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const getTouchDist = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      pinchDistRef.current = null;
      lastPointerXRef.current = e.touches[0].clientX;
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false;
      pinchDistRef.current = getTouchDist(e.touches[0], e.touches[1]);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDraggingRef.current) {
      const dx = e.touches[0].clientX - lastPointerXRef.current;
      lastPointerXRef.current = e.touches[0].clientX;
      setManualRotation(prev => prev + dx * 0.01);
    } else if (e.touches.length === 2 && pinchDistRef.current !== null) {
      const newDist = getTouchDist(e.touches[0], e.touches[1]);
      const delta = (newDist - pinchDistRef.current) * 0.006;
      pinchDistRef.current = newDist;
      setViewZoom(prev => Math.min(3.5, Math.max(0.35, Number((prev + delta).toFixed(3)))));
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    pinchDistRef.current = null;
  };

  const toggleGeometryMode = (modeId: SacredGeometryMode) => {
    setConfig(prev => {
      const exists = prev.sacredGeometryModes.includes(modeId);
      const nextModes = exists
        ? prev.sacredGeometryModes.filter(m => m !== modeId)
        : [...prev.sacredGeometryModes, modeId];
      return {
        ...prev,
        sacredGeometryEnabled: nextModes.length > 0,
        sacredGeometryModes: nextModes,
      };
    });
  };

  const toggleSection = (key: 'fractal' | 'modulation' | 'geometry') => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderNumberInput = (
    label: string,
    value: number,
    key: keyof SpiralConfig,
    min: number,
    max: number,
    step: number,
    disabled = false
  ) => (
    <div className="flex flex-col gap-1.5 min-w-0 bg-white/[0.03] p-2.5 rounded-xl border border-white/5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-400 uppercase font-bold tracking-wider text-[9px] truncate" title={label}>
          {label}
        </span>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(value) ? value : min}
          disabled={disabled}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isFinite(v)) return;
            setConfig(prev => ({ ...prev, [key]: Math.min(max, Math.max(min, v)) }));
          }}
          className={`w-14 shrink-0 bg-black/75 border border-white/15 rounded px-1.5 py-0.5 text-[10px] text-white font-mono text-right focus:outline-none focus:border-cyan-400 ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => setConfig(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
        className={`w-full h-1.5 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:rounded-full ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
      />
    </div>
  );

  const renderCollapsibleControls = () => (
    <div className="space-y-2.5">
      {/* Quick Global Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-black/40 p-2.5 rounded-2xl border border-white/10">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setConfig(prev => ({ ...prev, autoPilot: !prev.autoPilot }))}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-colors ${config.autoPilot
              ? 'bg-purple-500/25 text-purple-200 border-purple-400/50'
              : 'bg-black/60 text-slate-400 border-white/10 hover:text-white'
              }`}
          >
            Auto {config.autoPilot ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() =>
              setConfig(prev => {
                const nextVal = !prev.infiniteDepth;
                return {
                  ...prev,
                  infiniteDepth: nextVal,
                  iter: nextVal ? 10000 : 1200,
                  zoom: nextVal ? 0.001 : 0.04,
                };
              })
            }
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-colors ${config.infiniteDepth
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-black/60 text-slate-400 border-white/10 hover:text-white'
              }`}
          >
            Túnel {config.infiniteDepth ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() => setConfig(prev => ({ ...prev, waveStyle: !prev.waveStyle }))}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-colors ${config.waveStyle
              ? 'bg-pink-500/20 text-pink-300 border-pink-500/40'
              : 'bg-black/60 text-slate-400 border-white/10 hover:text-white'
              }`}
          >
            Trazo: {config.waveStyle ? 'Ondas' : 'Liso'}
          </button>

          <select
            value={config.colorPalette}
            onChange={(e) => setConfig(prev => ({ ...prev, colorPalette: e.target.value as CymaticsPalette }))}
            className="bg-black/70 border border-white/15 rounded-xl px-2.5 py-1.5 text-[10px] font-bold text-purple-200 uppercase tracking-wider focus:outline-none focus:border-purple-400 cursor-pointer"
          >
            {PALETTE_OPTIONS.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={resetToDefaults}
          className="px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/30 transition-colors flex items-center gap-1.5"
        >
          <Icon name="RefreshCw" size={12} /> Restablecer
        </button>
      </div>

      {/* Section 1: Fractal Core Parameters */}
      <div className="bg-black/40 rounded-2xl border border-white/10 overflow-hidden">
        <button
          onClick={() => toggleSection('fractal')}
          className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-purple-300 flex items-center gap-2">
            <Icon name="Aperture" size={13} /> Parámetros Fractales & Óptica
          </span>
          <Icon name={openSections.fractal ? 'ChevronUp' : 'ChevronDown'} size={14} className="text-slate-400" />
        </button>
        {openSections.fractal && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 p-3 pt-1 border-t border-white/5">
            {renderNumberInput('Iteraciones', config.iter, 'iter', 200, 10000, 100)}
            {renderNumberInput('Zoom Fractal', config.zoom, 'zoom', 0.001, 0.25, 0.001)}
            {renderNumberInput('Factor K', config.k, 'k', 0.9, 1.15, 0.001, config.autoPilot)}
            {renderNumberInput('Mult. Ángulo', config.angleMultiplier, 'angleMultiplier', 0.1, 10.0, 0.1, config.autoPilot)}
            {renderNumberInput('Velocidad', config.speedMultiplier, 'speedMultiplier', 0.1, 4.0, 0.1)}
          </div>
        )}
      </div>

      {/* Section 2: Modulation, Wave & Visual Style */}
      <div className="bg-black/40 rounded-2xl border border-white/10 overflow-hidden">
        <button
          onClick={() => toggleSection('modulation')}
          className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-pink-300 flex items-center gap-2">
            <Icon name="Sliders" size={13} /> Modulación Ondular, Brillo y Zoom Vista
          </span>
          <Icon name={openSections.modulation ? 'ChevronUp' : 'ChevronDown'} size={14} className="text-slate-400" />
        </button>
        {openSections.modulation && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 p-3 pt-1 border-t border-white/5">
            {renderNumberInput('Vel. Profundidad', config.depthSpeed, 'depthSpeed', 0.1, 5.0, 0.1)}
            {renderNumberInput('Amplitud Onda', config.waveAmplitude, 'waveAmplitude', 0.1, 2.5, 0.1, !config.waveStyle)}
            {renderNumberInput('Iluminación', config.illumination, 'illumination', 0, 3.0, 0.1)}
            {renderNumberInput('Grosor Línea', config.thickness, 'thickness', 0.5, 8.0, 0.5)}
            {renderNumberInput('Opacidad', config.opacity, 'opacity', 0.1, 1.0, 0.05)}
          </div>
        )}
      </div>

      {/* Section 3: Sacred Geometry Multi-Mode Selector */}
      <div className="bg-black/40 rounded-2xl border border-white/10 overflow-hidden">
        <button
          onClick={() => toggleSection('geometry')}
          className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-300 flex items-center gap-2">
            <Icon name="Hexagon" size={13} /> Geometría Sagrada ({config.sacredGeometryEnabled ? `${config.sacredGeometryModes.length} activas` : 'Desactivada'})
          </span>
          <Icon name={openSections.geometry ? 'ChevronUp' : 'ChevronDown'} size={14} className="text-slate-400" />
        </button>
        {openSections.geometry && (
          <div className="p-3 pt-2 border-t border-white/5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() =>
                  setConfig(prev => ({
                    ...prev,
                    sacredGeometryEnabled: !prev.sacredGeometryEnabled,
                    sacredGeometryModes:
                      !prev.sacredGeometryEnabled && prev.sacredGeometryModes.length === 0
                        ? ['flowerOfLife']
                        : prev.sacredGeometryModes,
                  }))
                }
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all ${config.sacredGeometryEnabled
                  ? 'bg-cyan-500/25 border-cyan-400/60 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                  : 'bg-black/60 border-white/10 text-slate-400 hover:text-white'
                  }`}
              >
                {config.sacredGeometryEnabled ? 'Capa Sagrada: Activa' : 'Activar Geometría Sagrada'}
              </button>

              {config.sacredGeometryModes.length > 0 && (
                <button
                  onClick={() => setConfig(prev => ({ ...prev, sacredGeometryEnabled: false, sacredGeometryModes: [] }))}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-slate-400 hover:text-white"
                >
                  Limpiar Capas
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {SACRED_GEOMETRY_OPTIONS.map(opt => {
                const selected = config.sacredGeometryEnabled && config.sacredGeometryModes.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggleGeometryMode(opt.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide border transition-all ${selected
                      ? 'bg-gradient-to-r from-cyan-500/30 to-purple-500/30 border-cyan-400/60 text-cyan-100 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                      : 'bg-black/50 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5'
                      }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderInteractiveCanvasSurface = (fullscreenMode: boolean) => (
    <div
      ref={canvasContainerRef}
      className={`relative w-full overflow-hidden touch-none cursor-grab active:cursor-grabbing pointer-events-auto ${transparentBg && !fullscreenMode
        ? 'bg-transparent border-0 rounded-none'
        : fullscreenMode
          ? 'bg-black/95 flex-1 h-full rounded-none border-0'
          : 'bg-black/95 rounded-2xl border border-white/10 shadow-[inset_0_0_40px_rgba(0,0,0,0.9)]'
        }`}
      style={
        fullscreenMode
          ? undefined
          : {
            minHeight: `${Math.min(240, height)}px`,
            height: height < 300 ? `${height}px` : `clamp(300px, 52dvh, ${Math.max(height, 460)}px)`,
          }
      }
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <canvas ref={canvasRef} className="w-full h-full block pointer-events-auto bg-transparent" />

      {!transparentBg && (
        <>
          {/* Equation Pill */}
          <div className="absolute bottom-3 left-3 right-28 sm:right-auto pointer-events-none">
            <div className="text-[9px] sm:text-[10px] text-slate-300 font-mono tracking-wider bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 truncate">
              Zₙ₊₁ = Zₙ · (k · e^iΨ) | Ψ = f·(π/180)·{config.angleMultiplier.toFixed(1)}
            </div>
          </div>

          {/* Zoom Controls Pill */}
          <div
            className="absolute bottom-3 right-3 z-10 flex items-center gap-1 bg-black/70 backdrop-blur-md border border-white/15 rounded-xl p-1 pointer-events-auto"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setViewZoom(prev => Math.max(0.35, Number((prev - 0.15).toFixed(2))))}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Alejar Zoom"
            >
              <Icon name="Minus" size={12} />
            </button>
            <button
              onClick={() => setViewZoom(1.0)}
              className="px-2 py-0.5 text-[10px] font-mono morph-accent-text-2 hover:text-white transition-colors"
              title="Restablecer Zoom"
            >
              {Math.round(viewZoom * 100)}%
            </button>
            <button
              onClick={() => setViewZoom(prev => Math.min(3.5, Number((prev + 0.15).toFixed(2))))}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Acercar Zoom"
            >
              <Icon name="Plus" size={12} />
            </button>
          </div>
        </>
      )}
    </div>
  );

  // Fullscreen Portal View
  if (isFullscreen && typeof document !== 'undefined') {
    const primaryFreq = activeOscillators[0]?.frequency ?? activeFrequencies?.[0] ?? 432;
    return createPortal(
      <div className="fixed inset-0 z-[99999] w-screen h-[100dvh] bg-black flex flex-col overflow-hidden select-none">
        {renderInteractiveCanvasSurface(true)}

        {/* Always-Visible Floating Top HUD Bar */}
        <div className="fixed top-3 left-0 right-0 z-30 flex items-center justify-center sm:justify-between px-3 sm:px-6 pointer-events-none">
          <div className="hidden sm:flex items-center gap-2.5 bg-black/65 backdrop-blur-xl border border-white/15 px-3.5 py-2 rounded-2xl pointer-events-auto shadow-xl">
            <Icon name="Aperture" size={16} className="text-purple-400" />
            <span className="text-xs font-display font-bold text-white tracking-wider">Espiral Holográfica</span>
            <span className="text-[10px] font-mono text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-lg">
              {primaryFreq.toFixed(1)} Hz
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 bg-black/70 backdrop-blur-xl border border-white/15 p-1.5 rounded-2xl pointer-events-auto shadow-[0_8px_30px_rgba(0,0,0,0.85)]">
            <button
              onClick={() => setShowFullscreenControls(prev => !prev)}
              className={`px-3 sm:px-4 py-2 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border transition-all ${showFullscreenControls
                ? 'bg-purple-500/25 border-purple-400/60 text-purple-200'
                : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/15'
                }`}
            >
              <Icon name="Sliders" size={14} />
              <span>{showFullscreenControls ? 'Ocultar Ajustes' : 'Abrir Ajustes'}</span>
            </button>

            <button
              onClick={exitFullscreen}
              className="px-3 sm:px-4 py-2 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 bg-red-500/25 hover:bg-red-500/40 border border-red-400/50 text-red-100 transition-all shadow-[0_0_15px_rgba(239,68,68,0.25)]"
            >
              <Icon name="Minimize2" size={14} />
              <span>Salir Pantalla Completa (Esc)</span>
            </button>
          </div>
        </div>

        {/* Centered Floating Settings Modal */}
        {showFullscreenControls && (
          <div className="fixed inset-0 z-20 flex items-center justify-center p-3 sm:p-6 pt-20 pb-6 pointer-events-none">
            <div
              className="pointer-events-auto w-full max-w-4xl max-h-[80dvh] overflow-y-auto custom-scrollbar mx-auto my-auto bg-black/85 backdrop-blur-2xl border border-purple-500/30 p-4 sm:p-6 rounded-3xl shadow-[0_0_80px_rgba(0,0,0,0.95)] flex flex-col gap-5"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <Icon name="Settings" size={18} className="text-purple-400" />
                  <h3 className="text-purple-300 font-display font-bold uppercase tracking-widest text-xs sm:text-sm">
                    Ajustes de Espiral Holográfica y Geometría Sagrada
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowFullscreenControls(false)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-slate-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                  >
                    <Icon name="EyeOff" size={12} /> Ocultar
                  </button>
                  <button
                    onClick={exitFullscreen}
                    className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/35 border border-red-500/40 text-red-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                  >
                    <Icon name="X" size={12} /> Salir (Esc)
                  </button>
                </div>
              </div>

              {renderCollapsibleControls()}

              {allOscillators.length > 0 && (
                <div className="border-t border-white/10 pt-4">
                  <h4 className="text-cyan-400 font-bold uppercase tracking-wider text-[10px] mb-3 flex items-center gap-2">
                    <Icon name="Activity" size={14} /> Generadores Activos ({allOscillators.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allOscillators.map(osc => (
                      <OscillatorControls
                        key={osc.id}
                        osc={osc}
                        update={onUpdateOscillator || (() => { })}
                        remove={onRemoveOscillator || (() => { })}
                        analyser={getOscillatorAnalyser ? getOscillatorAnalyser(osc.id) : null}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>,
      document.body
    );
  }

  // Pure backgroundless 3D view for showcase / Hero embed
  if (transparentBg) {
    return (
      <div className="relative w-full bg-transparent">
        {renderInteractiveCanvasSurface(false)}
      </div>
    );
  }

  // Inline Embedded Card View
  return (
    <div className="relative flex flex-col gap-4 art-nouveau-frame rounded-3xl p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 rounded-xl morph-pill">
            <Icon name="Aperture" size={20} className="morph-accent-text-2" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-display font-black starseed-text-gradient">
              Espiral Holográfica
            </h3>
            <p className="text-[9px] sm:text-[10px] morph-accent-text-2 font-bold uppercase tracking-widest opacity-85">
              Progresión Logarítmica Compleja · Dominio de Fase y Armónicos
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowInlineControls(prev => !prev)}
            className="px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider morph-btn-glass flex items-center gap-1.5"
          >
            <Icon name="Sliders" size={12} />
            {showInlineControls ? 'Ocultar Ajustes' : 'Niveladores Espiral'}
          </button>

          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider morph-btn-primary flex items-center gap-1.5"
          >
            <Icon name="Maximize2" size={13} />
            Pantalla Completa
          </button>
        </div>
      </div>

      {showInlineControls && renderCollapsibleControls()}

      {renderInteractiveCanvasSurface(false)}
    </div>
  );
};

export default SpiralVisualizer;
