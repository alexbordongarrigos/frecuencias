import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CymaticsConfig, CymaticsPalette, CymaticsMode, OscillatorState } from '../types';
import Icon from './Icon';
import OscillatorControls from './OscillatorControls';

interface Props {
  analyser: AnalyserNode | null;
  activeFrequencies?: number[];
  allOscillators?: OscillatorState[];
  onUpdateOscillator?: (id: string, updates: Partial<OscillatorState>) => void;
  onRemoveOscillator?: (id: string) => void;
  getOscillatorAnalyser?: (id: string) => AnalyserNode | null | undefined;
  isMasterPlaying?: boolean;
  height?: number;
  transparentBg?: boolean;
}

const DEFAULT_CONFIG: CymaticsConfig = {
  mode: 'chladni3d',
  n: 3,
  m: 5,
  particleCount: 1200,
  sensitivity: 1.2,
  palette: 'holographic',
  vibrationSpeed: 1.0,
  vibrationAmplitude: 1.0,
  plateMeshResolution: 38,
  autoRotate: true,
  showParticles: true,
  gravity: 0.06,
  particleDensity: 0.8,
  particleSize: 2.0,
  particleWeight: 0.9,
};

const MODE_OPTIONS: {
  id: CymaticsMode;
  label: string;
  shortLabel: string;
  icon: string;
  equation: (n: number, m: number) => string;
}[] = [
  {
    id: 'chladni3d',
    label: 'Placa Nodal 3D',
    shortLabel: 'Placa Nodal',
    icon: 'Grid',
    equation: (n, m) => `Z = sin(${n}πx)sin(${m}πy) − sin(${m}πx)sin(${n}πy)`,
  },
  {
    id: 'fluid3d',
    label: 'Esfera Armónica 3D',
    shortLabel: 'Esfera 3D',
    icon: 'Globe',
    equation: (n, m) => `R(θ,φ) = R₀·[1 + A·sin(${n}θ)cos(${m}φ + ωt)]`,
  },
  {
    id: 'quantum_lattice',
    label: 'Red Cristalina Cuántica 3D',
    shortLabel: 'Red Cuántica',
    icon: 'Hexagon',
    equation: (n, m) => `Ψ(x,y,z) = sin(${n}πx + ωt)·cos(${m}πy)·sin(${Math.round((n + m) / 2)}πz)`,
  },
  {
    id: 'particles3d',
    label: 'Toroide Vórtex 3D',
    shortLabel: 'Toroide 3D',
    icon: 'Orbit',
    equation: (n, m) => `T(u,v): r = r₀ + A·sin(${n}u + ${m}v − ωt)`,
  },
];

const PALETTE_OPTIONS: { id: CymaticsPalette; label: string }[] = [
  { id: 'holographic', label: 'Holográfico' },
  { id: 'quantum', label: 'Quantum Blue' },
  { id: 'neon', label: 'Neon Magenta' },
  { id: 'aurora', label: 'Aurora Green' },
  { id: 'gold', label: 'Gold Alquimia' },
];

export const CymaticsVisualizer3D: React.FC<Props> = ({
  analyser,
  activeFrequencies = [432],
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

  const [config, setConfig] = useState<CymaticsConfig>(DEFAULT_CONFIG);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInlineControls, setShowInlineControls] = useState(false);
  const [showFullscreenControls, setShowFullscreenControls] = useState(false);
  const [rotationX, setRotationX] = useState(0.55);
  const [rotationY, setRotationY] = useState(0.42);
  const [zoom3D, setZoom3D] = useState(1.0);

  // Refs for seamless simulation continuity across inline <-> fullscreen portal
  const configRef = useRef(config);
  const analyserRef = useRef(analyser);
  const activeFrequenciesRef = useRef(activeFrequencies);
  const allOscillatorsRef = useRef(allOscillators);
  const isMasterPlayingRef = useRef(isMasterPlaying);
  const rotXRef = useRef(rotationX);
  const rotYRef = useRef(rotationY);
  const angleYRef = useRef(rotationY);
  const zoomRef = useRef(zoom3D);
  const timeRef = useRef(0);
  const logicalSizeRef = useRef({ width: 640, height: 420, dpr: 1 });
  const particlesRef = useRef<{ x: number; y: number; z: number; vx: number; vy: number; u: number; v: number }[]>([]);

  const isDraggingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const downPosRef = useRef({ x: 0, y: 0 });
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const pinchDistRef = useRef<number | null>(null);
  const wasNativeFullscreenRef = useRef(false);

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { analyserRef.current = analyser; }, [analyser]);
  useEffect(() => { activeFrequenciesRef.current = activeFrequencies; }, [activeFrequencies]);
  useEffect(() => { allOscillatorsRef.current = allOscillators; }, [allOscillators]);
  useEffect(() => { isMasterPlayingRef.current = isMasterPlaying; }, [isMasterPlaying]);
  useEffect(() => { rotXRef.current = rotationX; }, [rotationX]);
  useEffect(() => {
    rotYRef.current = rotationY;
    if (!configRef.current.autoRotate) {
      angleYRef.current = rotationY;
    }
  }, [rotationY]);
  useEffect(() => { zoomRef.current = zoom3D; }, [zoom3D]);

  const enterFullscreen = useCallback(() => {
    setIsFullscreen(true);
    setShowFullscreenControls(false);
    try {
      const el = document.documentElement;
      if (el.requestFullscreen && !document.fullscreenElement) {
        el.requestFullscreen().catch(() => {});
      }
    } catch {
      // Fallback already active via React portal
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    setIsFullscreen(false);
    setShowFullscreenControls(false);
    wasNativeFullscreenRef.current = false;
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      // Ignore native exit errors
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
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
      if (e.key === 'Escape') {
        exitFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, exitFullscreen]);

  const resetConfig = () => {
    setConfig(DEFAULT_CONFIG);
    setRotationX(0.55);
    setRotationY(0.42);
    angleYRef.current = 0.42;
    setZoom3D(1.0);
  };

  const getPaletteColors = (palette: CymaticsPalette) => {
    switch (palette) {
      case 'quantum':
        return { plate: '#3b82f6', line: '#60a5fa', particles: '#93c5fd', glow: 'rgba(59, 130, 246, 0.55)', accent: 'rgba(147, 197, 253, 0.85)' };
      case 'neon':
        return { plate: '#f472b6', line: '#ec4899', particles: '#fb7185', glow: 'rgba(244, 114, 182, 0.55)', accent: 'rgba(244, 63, 94, 0.85)' };
      case 'aurora':
        return { plate: '#34d399', line: '#10b981', particles: '#6ee7b7', glow: 'rgba(52, 211, 153, 0.55)', accent: 'rgba(167, 243, 208, 0.85)' };
      case 'gold':
        return { plate: '#fbbf24', line: '#f59e0b', particles: '#fef08a', glow: 'rgba(251, 191, 36, 0.55)', accent: 'rgba(253, 224, 71, 0.85)' };
    case 'bw':
      return { plate: '#ffffff', line: '#e2e8f0', particles: '#cbd5e1', glow: 'rgba(255, 255, 255, 0.45)', accent: 'rgba(255, 255, 255, 0.85)' };
    case 'holographic':
    default:
      return { plate: '#22d3ee', line: '#a855f7', particles: '#f472b6', glow: 'rgba(34, 211, 238, 0.55)', accent: 'rgba(192, 132, 252, 0.85)' };
    }
  };

  // Smooth 1x Canvas Sizing & Main 3D Simulation Loop (no scroll-blocking wheel handler)
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

      if (canvas.width !== width || canvas.height !== heightPx) {
        canvas.width = width;
        canvas.height = heightPx;
      }
      logicalSizeRef.current = { width, height: heightPx, dpr: 1 };
    };

    updateCanvasSize();
    const resizeObserver = new ResizeObserver(() => updateCanvasSize());
    resizeObserver.observe(container);

    let animFrameId: number;
    let fftData = new Uint8Array(256);

    const ensureParticles = (targetCount: number) => {
      const arr = particlesRef.current;
      while (arr.length < targetCount) {
        arr.push({
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 2,
          z: (Math.random() - 0.5) * 2,
          vx: 0,
          vy: 0,
          u: Math.random() * Math.PI * 2,
          v: Math.random() * Math.PI * 2,
        });
      }
      if (arr.length > targetCount) {
        arr.length = targetCount;
      }
    };

    const render = () => {
      const cfg = configRef.current;
      const currentAnalyser = analyserRef.current;
      const oscs = allOscillatorsRef.current;
      const freqs = activeFrequenciesRef.current;

      ensureParticles(cfg.particleCount);

      const hasPlaying = oscs.length === 0 ? isMasterPlayingRef.current : oscs.some(o => o.isPlaying);
      const activeMotion = isMasterPlayingRef.current && hasPlaying;

      if (activeMotion) {
        timeRef.current += 0.025 * cfg.vibrationSpeed;
      }
      if (cfg.autoRotate && !isDraggingRef.current) {
        angleYRef.current += activeMotion ? 0.0055 : 0.0022;
      } else if (!isDraggingRef.current && !cfg.autoRotate) {
        angleYRef.current = rotYRef.current;
      }

      if (currentAnalyser && currentAnalyser.frequencyBinCount !== fftData.length) {
        fftData = new Uint8Array(currentAnalyser.frequencyBinCount);
      }

      let audioAmp = 0.28 * cfg.sensitivity;
      if (currentAnalyser && activeMotion) {
        currentAnalyser.getByteFrequencyData(fftData);
        let sum = 0;
        const bins = Math.min(64, fftData.length);
        for (let i = 0; i < bins; i++) sum += fftData[i];
        const measured = (sum / Math.max(1, bins) / 255) * cfg.sensitivity;
        audioAmp = Math.max(0.18 * cfg.sensitivity, measured);
      }

      const primaryFreq = freqs[0] || 432;
      const n = cfg.n + Math.floor((primaryFreq % 100) / 25);
      const m = cfg.m + Math.floor((primaryFreq % 50) / 10);

      const { width, height: hPx, dpr } = logicalSizeRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, hPx);

      const cx = width / 2;
      const cy = hPx / 2;
      const minDim = Math.min(width, hPx);
      const fov = minDim * 1.12 * zoomRef.current;
      const colors = getPaletteColors(cfg.palette);

      const cosY = Math.cos(angleYRef.current);
      const sinY = Math.sin(angleYRef.current);
      const cosX = Math.cos(rotXRef.current);
      const sinX = Math.sin(rotXRef.current);

      const project = (x: number, y: number, z: number) => {
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;
        const dist = Math.max(0.55, 3.6 + z2);
        const px = cx + (x1 * fov) / dist;
        const py = cy + (y2 * fov) / dist;
        return { px, py, scale2: 1 / dist, z2 };
      };

      const ampMult = 0.35 * cfg.vibrationAmplitude;
      const time = timeRef.current;
      const particles = particlesRef.current;

      if (cfg.mode === 'chladni3d') {
        const chladni = (x: number, y: number) =>
          Math.sin(n * Math.PI * x) * Math.sin(m * Math.PI * y) -
          Math.sin(m * Math.PI * x) * Math.sin(n * Math.PI * y);

        const res = Math.max(12, Math.min(80, cfg.plateMeshResolution));
        const step = 2 / res;
        const phasePulse = Math.cos(time * 0.9);

        ctx.lineWidth = 1;
        ctx.strokeStyle = colors.glow;

        for (let i = 0; i <= res; i++) {
          const x = -1 + i * step;
          ctx.beginPath();
          for (let j = 0; j <= res; j++) {
            const y = -1 + j * step;
            const amp = chladni(x, y) * audioAmp * ampMult * (0.7 + 0.3 * phasePulse);
            const p = project(x, amp, y);
            if (j === 0) ctx.moveTo(p.px, p.py);
            else ctx.lineTo(p.px, p.py);
          }
          ctx.stroke();
        }

        for (let j = 0; j <= res; j++) {
          const y = -1 + j * step;
          ctx.beginPath();
          for (let i = 0; i <= res; i++) {
            const x = -1 + i * step;
            const amp = chladni(x, y) * audioAmp * ampMult * (0.7 + 0.3 * phasePulse);
            const p = project(x, amp, y);
            if (i === 0) ctx.moveTo(p.px, p.py);
            else ctx.lineTo(p.px, p.py);
          }
          ctx.stroke();
        }

        if (cfg.showParticles) {
          ctx.fillStyle = colors.particles;
          const jitter = (1.05 - cfg.particleDensity) * 0.015;
          for (let i = 0; i < particles.length; i++) {
            const pt = particles[i];
            const val = chladni(pt.x, pt.y);
            const gradX = (chladni(pt.x + 0.015, pt.y) - chladni(pt.x - 0.015, pt.y)) / 0.03;
            const gradY = (chladni(pt.x, pt.y + 0.015) - chladni(pt.x, pt.y - 0.015)) / 0.03;

            const force = -val * audioAmp * cfg.gravity * 0.5;
            pt.vx += gradX * force + (Math.random() - 0.5) * Math.abs(val) * jitter;
            pt.vy += gradY * force + (Math.random() - 0.5) * Math.abs(val) * jitter;
            pt.vx *= cfg.particleWeight;
            pt.vy *= cfg.particleWeight;
            pt.x += pt.vx;
            pt.y += pt.vy;

            if (pt.x < -1) { pt.x = -1; pt.vx *= -0.5; }
            if (pt.x > 1) { pt.x = 1; pt.vx *= -0.5; }
            if (pt.y < -1) { pt.y = -1; pt.vy *= -0.5; }
            if (pt.y > 1) { pt.y = 1; pt.vy *= -0.5; }

            const ptAmp = val * audioAmp * ampMult * (0.7 + 0.3 * phasePulse);
            const p = project(pt.x, ptAmp, pt.y);
            const r = Math.max(0.6, cfg.particleSize * p.scale2 * 1.4);
            ctx.beginPath();
            ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Outer harmonic ring
        ctx.beginPath();
        ctx.strokeStyle = colors.line;
        ctx.lineWidth = 1.75;
        const ringSegs = 64;
        for (let s = 0; s <= ringSegs; s++) {
          const a = (s / ringSegs) * Math.PI * 2;
          const p = project(Math.cos(a), 0, Math.sin(a));
          if (s === 0) ctx.moveTo(p.px, p.py);
          else ctx.lineTo(p.px, p.py);
        }
        ctx.stroke();
      } else if (cfg.mode === 'fluid3d') {
        const lats = Math.max(10, Math.round(cfg.plateMeshResolution * 0.55));
        const lons = Math.max(14, Math.round(cfg.plateMeshResolution * 0.85));
        const rBase = 0.88;
        const modScale = 0.36 * ampMult * (0.35 + audioAmp);

        const spherePoint = (theta: number, phi: number) => {
          const wave = Math.sin(n * theta + time) * Math.cos(m * phi - time * 0.7);
          const r = rBase * (1 + modScale * wave);
          const sinT = Math.sin(theta);
          return project(r * sinT * Math.cos(phi), r * Math.cos(theta), r * sinT * Math.sin(phi));
        };

        ctx.lineWidth = 1;
        ctx.strokeStyle = colors.glow;
        for (let i = 1; i < lats; i++) {
          const theta = (i / lats) * Math.PI;
          ctx.beginPath();
          for (let j = 0; j <= lons; j++) {
            const phi = (j / lons) * Math.PI * 2;
            const p = spherePoint(theta, phi);
            if (j === 0) ctx.moveTo(p.px, p.py);
            else ctx.lineTo(p.px, p.py);
          }
          ctx.stroke();
        }

        ctx.strokeStyle = colors.line;
        ctx.lineWidth = 0.85;
        for (let j = 0; j < lons; j += 2) {
          const phi = (j / lons) * Math.PI * 2;
          ctx.beginPath();
          for (let i = 0; i <= lats; i++) {
            const theta = (i / lats) * Math.PI;
            const p = spherePoint(theta, phi);
            if (i === 0) ctx.moveTo(p.px, p.py);
            else ctx.lineTo(p.px, p.py);
          }
          ctx.stroke();
        }

        if (cfg.showParticles) {
          ctx.fillStyle = colors.particles;
          for (let i = 0; i < particles.length; i++) {
            const pt = particles[i];
            pt.u += (0.008 + cfg.gravity * 0.08) * (0.5 + audioAmp * 0.5);
            pt.v += 0.004 * Math.sin(n * pt.u + time);
            const theta = ((pt.x + 1) * 0.5) * Math.PI;
            const phi = pt.u;
            const wave = Math.sin(n * theta + time) * Math.cos(m * phi - time * 0.7);
            const r = rBase * (1.03 + modScale * wave);
            const sinT = Math.sin(theta);
            const p = project(r * sinT * Math.cos(phi), r * Math.cos(theta), r * sinT * Math.sin(phi));
            const rad = Math.max(0.6, cfg.particleSize * p.scale2 * 1.35);
            ctx.beginPath();
            ctx.arc(p.px, p.py, rad, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (cfg.mode === 'quantum_lattice') {
        const gridCount = Math.max(4, Math.min(8, Math.round(cfg.plateMeshResolution / 8)));
        const half = 0.82;
        const step = (half * 2) / (gridCount - 1);
        const dispAmt = 0.22 * ampMult * (0.35 + audioAmp);
        const kMid = Math.max(1, Math.round((n + m) / 2));

        const nodes: { px: number; py: number; scale2: number; energy: number }[][][] = [];
        for (let ix = 0; ix < gridCount; ix++) {
          nodes[ix] = [];
          const bx = -half + ix * step;
          for (let iy = 0; iy < gridCount; iy++) {
            nodes[ix][iy] = [];
            const by = -half + iy * step;
            for (let iz = 0; iz < gridCount; iz++) {
              const bz = -half + iz * step;
              const psi =
                Math.sin(n * Math.PI * bx + time) *
                Math.cos(m * Math.PI * by - time * 0.6) *
                Math.sin(kMid * Math.PI * bz);
              const dx = bx + psi * dispAmt * 0.6;
              const dy = by + Math.cos(m * Math.PI * bx + time) * dispAmt * 0.6;
              const dz = bz + psi * dispAmt * 0.6;
              const p = project(dx, dy, dz);
              nodes[ix][iy][iz] = { px: p.px, py: p.py, scale2: p.scale2, energy: Math.abs(psi) };
            }
          }
        }

        ctx.strokeStyle = colors.glow;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        for (let ix = 0; ix < gridCount; ix++) {
          for (let iy = 0; iy < gridCount; iy++) {
            for (let iz = 0; iz < gridCount; iz++) {
              const cur = nodes[ix][iy][iz];
              if (ix + 1 < gridCount) {
                const nx = nodes[ix + 1][iy][iz];
                ctx.moveTo(cur.px, cur.py);
                ctx.lineTo(nx.px, nx.py);
              }
              if (iy + 1 < gridCount) {
                const ny = nodes[ix][iy + 1][iz];
                ctx.moveTo(cur.px, cur.py);
                ctx.lineTo(ny.px, ny.py);
              }
              if (iz + 1 < gridCount) {
                const nz = nodes[ix][iy][iz + 1];
                ctx.moveTo(cur.px, cur.py);
                ctx.lineTo(nz.px, nz.py);
              }
            }
          }
        }
        ctx.stroke();

        ctx.fillStyle = colors.accent;
        for (let ix = 0; ix < gridCount; ix++) {
          for (let iy = 0; iy < gridCount; iy++) {
            for (let iz = 0; iz < gridCount; iz++) {
              const cur = nodes[ix][iy][iz];
              const nodeR = Math.max(1.2, (1.8 + cur.energy * 3.5) * cur.scale2 * 1.4);
              ctx.beginPath();
              ctx.arc(cur.px, cur.py, nodeR, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }

        if (cfg.showParticles) {
          ctx.fillStyle = colors.particles;
          const count = Math.min(particles.length, 900);
          for (let i = 0; i < count; i++) {
            const pt = particles[i];
            const psi =
              Math.sin(n * Math.PI * pt.x + time) *
              Math.cos(m * Math.PI * pt.y - time * 0.6) *
              Math.sin(kMid * Math.PI * pt.z);
            pt.x += Math.sin(time + i) * 0.005 * (1.05 - cfg.particleDensity) - psi * 0.015 * cfg.gravity * 10;
            pt.y += Math.cos(time * 0.8 + i) * 0.005 * (1.05 - cfg.particleDensity);
            pt.z += Math.sin(time * 0.6 + i * 0.5) * 0.005 * (1.05 - cfg.particleDensity);
            if (pt.x < -half) pt.x = half; if (pt.x > half) pt.x = -half;
            if (pt.y < -half) pt.y = half; if (pt.y > half) pt.y = -half;
            if (pt.z < -half) pt.z = half; if (pt.z > half) pt.z = -half;
            const p = project(pt.x, pt.y, pt.z);
            const r = Math.max(0.6, cfg.particleSize * p.scale2 * 1.3);
            ctx.beginPath();
            ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else {
        // particles3d -> Toroide Vórtex 3D
        const majorR = 0.78;
        const minorBase = 0.34;
        const rings = Math.max(14, Math.round(cfg.plateMeshResolution * 0.7));
        const segs = Math.max(16, Math.round(cfg.plateMeshResolution * 0.9));
        const modAmp = 0.16 * ampMult * (0.35 + audioAmp);

        const torusPoint = (u: number, v: number) => {
          const r = minorBase + modAmp * Math.sin(n * u + m * v - time * 1.4);
          const x = (majorR + r * Math.cos(v)) * Math.cos(u);
          const y = r * Math.sin(v);
          const z = (majorR + r * Math.cos(v)) * Math.sin(u);
          return project(x, y, z);
        };

        ctx.strokeStyle = colors.glow;
        ctx.lineWidth = 1;
        for (let i = 0; i < rings; i++) {
          const u = (i / rings) * Math.PI * 2;
          ctx.beginPath();
          for (let j = 0; j <= segs; j++) {
            const v = (j / segs) * Math.PI * 2;
            const p = torusPoint(u, v);
            if (j === 0) ctx.moveTo(p.px, p.py);
            else ctx.lineTo(p.px, p.py);
          }
          ctx.stroke();
        }

        ctx.strokeStyle = colors.line;
        ctx.lineWidth = 1.1;
        for (let j = 0; j < 10; j++) {
          const vBase = (j / 10) * Math.PI * 2;
          ctx.beginPath();
          for (let i = 0; i <= segs * 2; i++) {
            const u = (i / (segs * 2)) * Math.PI * 2;
            const v = vBase + u * 2;
            const p = torusPoint(u, v);
            if (i === 0) ctx.moveTo(p.px, p.py);
            else ctx.lineTo(p.px, p.py);
          }
          ctx.stroke();
        }

        if (cfg.showParticles) {
          ctx.fillStyle = colors.particles;
          for (let i = 0; i < particles.length; i++) {
            const pt = particles[i];
            const flowSpeed = (0.012 + cfg.gravity * 0.15) * (0.4 + audioAmp * 0.6);
            pt.u += flowSpeed;
            pt.v += flowSpeed * (m / Math.max(1, n)) * 0.9;
            const p = torusPoint(pt.u, pt.v);
            const r = Math.max(0.6, cfg.particleSize * p.scale2 * 1.4);
            ctx.beginPath();
            ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      animFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameId);
      resizeObserver.disconnect();
    };
  }, [isFullscreen]);

  // Mouse Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragMovedRef.current = false;
    downPosRef.current = { x: e.clientX, y: e.clientY };
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    setConfig(prev => (prev.autoRotate ? { ...prev, autoRotate: false } : prev));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    if (Math.hypot(e.clientX - downPosRef.current.x, e.clientY - downPosRef.current.y) > 8) {
      dragMovedRef.current = true;
    }
    const dx = e.clientX - lastPointerRef.current.x;
    const dy = e.clientY - lastPointerRef.current.y;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };

    setRotationY(prev => {
      const next = prev + dx * 0.01;
      angleYRef.current = next;
      return next;
    });
    setRotationX(prev => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, prev + dy * 0.01)));
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Touch Drag & Pinch-to-Zoom Handlers
  const getTouchDist = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      dragMovedRef.current = false;
      downPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      pinchDistRef.current = null;
      lastPointerRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setConfig(prev => (prev.autoRotate ? { ...prev, autoRotate: false } : prev));
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false;
      dragMovedRef.current = true;
      pinchDistRef.current = getTouchDist(e.touches[0], e.touches[1]);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDraggingRef.current) {
      if (Math.hypot(e.touches[0].clientX - downPosRef.current.x, e.touches[0].clientY - downPosRef.current.y) > 8) {
        dragMovedRef.current = true;
      }
      const dx = e.touches[0].clientX - lastPointerRef.current.x;
      const dy = e.touches[0].clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setRotationY(prev => {
        const next = prev + dx * 0.012;
        angleYRef.current = next;
        return next;
      });
      setRotationX(prev => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, prev + dy * 0.012)));
    } else if (e.touches.length === 2 && pinchDistRef.current !== null) {
      const newDist = getTouchDist(e.touches[0], e.touches[1]);
      const delta = (newDist - pinchDistRef.current) * 0.005;
      pinchDistRef.current = newDist;
      setZoom3D(prev => Math.min(2.5, Math.max(0.45, Number((prev + delta).toFixed(3)))));
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    pinchDistRef.current = null;
  };

  // Safe numeric + slider helper
  const renderNumberInput = (
    label: string,
    value: number,
    key: keyof CymaticsConfig,
    min: number,
    max: number,
    step: number,
    accentClass = '[&::-webkit-slider-thumb]:bg-cyan-400',
    displayMultiplier = 1,
    unitSuffix = ''
  ) => {
    const displayedVal = displayMultiplier === 1 ? value : Math.round(value * displayMultiplier);
    const displayedMin = displayMultiplier === 1 ? min : Math.round(min * displayMultiplier);
    const displayedMax = displayMultiplier === 1 ? max : Math.round(max * displayMultiplier);
    const displayedStep = displayMultiplier === 1 ? step : Math.max(1, Math.round(step * displayMultiplier));

    return (
      <div className="flex flex-col gap-1.5 bg-white/[0.03] p-2.5 rounded-xl border border-white/5 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-400 uppercase font-bold tracking-wider text-[9px] truncate" title={label}>
            {label}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="number"
              min={displayedMin}
              max={displayedMax}
              step={displayedStep}
              value={Number.isFinite(displayedVal) ? displayedVal : displayedMin}
              onChange={(e) => {
                const raw = parseFloat(e.target.value);
                if (!Number.isFinite(raw)) return;
                const mapped = displayMultiplier === 1 ? raw : raw / displayMultiplier;
                const clamped = Math.min(max, Math.max(min, mapped));
                setConfig(prev => ({ ...prev, [key]: clamped }));
              }}
              className="w-14 bg-black/80 border border-white/15 text-white font-mono text-[10px] rounded px-1.5 py-0.5 text-right focus:border-cyan-400 outline-none"
            />
            {unitSuffix && <span className="text-[9px] text-slate-500 font-mono">{unitSuffix}</span>}
          </div>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => setConfig(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
          className={`w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full ${accentClass}`}
        />
      </div>
    );
  };

  const activeModeInfo = MODE_OPTIONS.find(m => m.id === config.mode) || MODE_OPTIONS[0];
  const primaryFreqDisplay = activeFrequencies[0] || 432;
  const effN = config.n + Math.floor((primaryFreqDisplay % 100) / 25);
  const effM = config.m + Math.floor((primaryFreqDisplay % 50) / 10);

  const renderControlsPanel = (isModal = false) => (
    <div className="space-y-3">
      {/* Mode Selector Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {MODE_OPTIONS.map(modeOpt => {
          const active = config.mode === modeOpt.id;
          return (
            <button
              key={modeOpt.id}
              onClick={() => setConfig(prev => ({ ...prev, mode: modeOpt.id }))}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all ${
                active
                  ? 'bg-gradient-to-r from-cyan-500/25 to-purple-500/25 border-cyan-400/60 text-cyan-200 shadow-[0_0_15px_rgba(34,211,238,0.25)]'
                  : 'bg-black/50 border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon name={modeOpt.icon} size={14} className={active ? 'text-cyan-300' : 'text-slate-500'} />
              <span className="truncate">{modeOpt.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Parameter Sliders */}
      <div className={`grid grid-cols-2 ${isModal ? 'sm:grid-cols-3 md:grid-cols-4' : 'sm:grid-cols-4'} gap-2.5 bg-black/40 p-3 rounded-2xl border border-white/5`}>
        {renderNumberInput('Factor Modal N', config.n, 'n', 1, 12, 1, '[&::-webkit-slider-thumb]:bg-cyan-400')}
        {renderNumberInput('Factor Modal M', config.m, 'm', 1, 12, 1, '[&::-webkit-slider-thumb]:bg-purple-400')}
        {renderNumberInput('Amplitud', config.vibrationAmplitude, 'vibrationAmplitude', 0.1, 3.0, 0.1, '[&::-webkit-slider-thumb]:bg-amber-400')}
        {renderNumberInput('Sensibilidad', config.sensitivity, 'sensitivity', 0.2, 4.0, 0.1, '[&::-webkit-slider-thumb]:bg-emerald-400')}
        {renderNumberInput('Partículas', config.particleCount, 'particleCount', 200, 3500, 100, '[&::-webkit-slider-thumb]:bg-pink-400')}
        {renderNumberInput('Gravedad', config.gravity, 'gravity', 0.01, 0.25, 0.01, '[&::-webkit-slider-thumb]:bg-red-400')}
        {renderNumberInput('Tamaño Part.', config.particleSize, 'particleSize', 0.5, 6.0, 0.1, '[&::-webkit-slider-thumb]:bg-sky-400')}
        {renderNumberInput('Resolución Malla', config.plateMeshResolution, 'plateMeshResolution', 14, 72, 2, '[&::-webkit-slider-thumb]:bg-indigo-400')}
        {renderNumberInput('Velocidad Vib.', config.vibrationSpeed, 'vibrationSpeed', 0.1, 3.0, 0.1, '[&::-webkit-slider-thumb]:bg-teal-400')}
        {renderNumberInput('Peso Part.', config.particleWeight, 'particleWeight', 0.8, 0.99, 0.01, '[&::-webkit-slider-thumb]:bg-orange-400', 100, '%')}
        {renderNumberInput('Densidad Flujo', config.particleDensity, 'particleDensity', 0.1, 1.0, 0.1, '[&::-webkit-slider-thumb]:bg-emerald-400', 100, '%')}

        {/* Zoom 3D Slider */}
        <div className="flex flex-col gap-1.5 bg-white/[0.03] p-2.5 rounded-xl border border-white/5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400 uppercase font-bold tracking-wider text-[9px] truncate">Zoom 3D</span>
            <span className="text-[10px] text-cyan-300 font-mono">{Math.round(zoom3D * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.45"
            max="2.5"
            step="0.05"
            value={zoom3D}
            onChange={(e) => setZoom3D(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan-300 [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>
      </div>

      {/* Quick Action Toggles Row */}
      <div className="flex flex-wrap items-center justify-center sm:justify-between gap-2">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => setConfig(prev => ({ ...prev, autoRotate: !prev.autoRotate }))}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all ${
              config.autoRotate
                ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                : 'bg-black/50 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            {config.autoRotate ? 'Rotación 3D: On' : 'Rotación 3D: Pausa'}
          </button>

          <button
            onClick={() => setConfig(prev => ({ ...prev, showParticles: !prev.showParticles }))}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all ${
              config.showParticles
                ? 'bg-pink-950/60 border-pink-500/40 text-pink-300 shadow-[0_0_12px_rgba(244,114,182,0.25)]'
                : 'bg-black/50 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            {config.showParticles ? 'Partículas: On' : 'Partículas: Off'}
          </button>

          <select
            value={config.palette}
            onChange={(e) => setConfig(prev => ({ ...prev, palette: e.target.value as CymaticsPalette }))}
            className="bg-black/70 border border-white/15 rounded-xl px-3 py-1.5 text-[10px] font-bold text-cyan-200 uppercase tracking-wider focus:outline-none focus:border-cyan-400 cursor-pointer"
          >
            {PALETTE_OPTIONS.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={resetConfig}
          className="px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors flex items-center gap-1.5"
        >
          <Icon name="RefreshCw" size={12} /> Restablecer 3D
        </button>
      </div>
    </div>
  );

  const renderInteractiveCanvasSurface = (fullscreenMode: boolean) => (
    <div
      ref={canvasContainerRef}
      className={`relative w-full overflow-hidden touch-none cursor-grab active:cursor-grabbing pointer-events-auto ${
        transparentBg && !fullscreenMode
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
      onClick={() => {
        if (fullscreenMode && !dragMovedRef.current && !showFullscreenControls) {
          setShowFullscreenControls(true);
        }
      }}
    >
      <canvas ref={canvasRef} className="w-full h-full block pointer-events-auto bg-transparent" />

      {!transparentBg && !fullscreenMode && (
        <>
          {/* Equation & Mode Badge */}
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto flex flex-wrap items-center gap-2 pointer-events-none">
            <div className="text-[9px] sm:text-[10px] text-slate-300 font-mono tracking-wider bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 max-w-full truncate">
              <span className="morph-accent-text font-bold mr-2">{activeModeInfo.shortLabel}</span>
              {activeModeInfo.equation(effN, effM)}
            </div>
          </div>

          {/* Inline Quick Zoom Pill */}
          <div
            className="absolute bottom-3 right-3 z-10 flex items-center gap-1 bg-black/70 backdrop-blur-md border border-white/15 rounded-xl p-1 pointer-events-auto"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setZoom3D(prev => Math.max(0.45, Number((prev - 0.15).toFixed(2))))}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Alejar Zoom 3D"
            >
              <Icon name="Minus" size={12} />
            </button>
            <button
              onClick={() => setZoom3D(1.0)}
              className="px-2 py-0.5 text-[10px] font-mono morph-accent-text hover:text-white transition-colors"
              title="Restablecer Zoom"
            >
              {Math.round(zoom3D * 100)}%
            </button>
            <button
              onClick={() => setZoom3D(prev => Math.min(2.5, Number((prev + 0.15).toFixed(2))))}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Acercar Zoom 3D"
            >
              <Icon name="Plus" size={12} />
            </button>
          </div>
        </>
      )}
    </div>
  );

  // Fullscreen Portal (0 UI chrome by default; click screen to open centered Menu)
  if (isFullscreen && typeof document !== 'undefined') {
    return createPortal(
      <div className="fixed inset-0 z-[99999] w-screen h-[100dvh] bg-black flex flex-col overflow-hidden select-none">
        {/* Interactive 3D Canvas fills entire viewport cleanly with 0 overlays */}
        {renderInteractiveCanvasSurface(true)}

        {/* Centered Settings Menu Modal (Opens on canvas tap/click, hides cleanly) */}
        {showFullscreenControls && (
          <div
            className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-6 bg-black/45 backdrop-blur-sm"
            onClick={() => setShowFullscreenControls(false)}
          >
            <div
              className="pointer-events-auto w-full max-w-4xl max-h-[84dvh] overflow-y-auto custom-scrollbar mx-auto my-auto bg-black/88 backdrop-blur-2xl border border-cyan-500/35 p-4 sm:p-6 rounded-3xl shadow-[0_0_80px_rgba(0,0,0,0.95)] flex flex-col gap-5"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <Icon name="Settings" size={18} className="text-cyan-400" />
                  <h3 className="text-cyan-300 font-display font-bold uppercase tracking-widest text-xs sm:text-sm">
                    Menú Cimática 3D · {primaryFreqDisplay.toFixed(1)} Hz
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setShowFullscreenControls(false)}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-slate-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                  >
                    <Icon name="EyeOff" size={13} /> Ocultar Menú
                  </button>
                  <button
                    onClick={exitFullscreen}
                    className="px-3 py-2 rounded-xl bg-red-500/25 hover:bg-red-500/40 border border-red-400/50 text-red-100 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                  >
                    <Icon name="Minimize2" size={13} /> Salir de Pantalla Completa
                  </button>
                </div>
              </div>

              {renderControlsPanel(true)}

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
                        update={onUpdateOscillator || (() => {})}
                        remove={onRemoveOscillator || (() => {})}
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
    <div className="relative art-nouveau-frame rounded-3xl p-4 sm:p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl morph-pill">
            <Icon name="Orbit" size={20} className="morph-accent-text" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-display font-black starseed-text-gradient">
              Cimática 3D · {activeModeInfo.shortLabel}
            </h3>
            <p className="text-[10px] morph-accent-text font-bold uppercase tracking-widest opacity-85">
              Morfología de Ondas Estacionarias · Rotación Orbital y Escala 3D
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowInlineControls(prev => !prev)}
            className="px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider morph-btn-glass flex items-center gap-1.5"
          >
            <Icon name="Sliders" size={12} />
            {showInlineControls ? 'Ocultar Ajustes' : 'Niveladores 3D'}
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

      {showInlineControls && renderControlsPanel(false)}

      {renderInteractiveCanvasSurface(false)}
    </div>
  );
};

export default CymaticsVisualizer3D;
