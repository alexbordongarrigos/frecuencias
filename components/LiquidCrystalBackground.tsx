import React, { useEffect, useRef } from 'react';
import { ChromaticState } from '../hooks/useChromaticMorph';

interface LiquidCrystalBackgroundProps {
  stateRef: React.MutableRefObject<ChromaticState>;
}

const PHI = 1.618033988749895;

interface FluidNode {
  freqX: number;
  freqY: number;
  phaseX: number;
  phaseY: number;
  radiusRatio: number;
  hueSlot: 1 | 2 | 3;
  sat: number;
  light: number;
  alpha: number;
}

// Golden-ratio distributed fluid nodes for non-repeating organic Solarpunk flow
const FLUID_NODES: FluidNode[] = [
  { freqX: 0.13, freqY: 0.19, phaseX: 0.2, phaseY: 1.4, radiusRatio: 0.56, hueSlot: 1, sat: 88, light: 48, alpha: 0.34 },
  { freqX: 0.17, freqY: 0.11, phaseX: 2.1, phaseY: 3.7, radiusRatio: 0.52, hueSlot: 2, sat: 90, light: 50, alpha: 0.30 },
  { freqX: 0.11, freqY: 0.23, phaseX: 4.3, phaseY: 0.8, radiusRatio: 0.48, hueSlot: 3, sat: 86, light: 48, alpha: 0.28 },
  { freqX: 0.21, freqY: 0.14, phaseX: 1.1, phaseY: 5.1, radiusRatio: 0.42, hueSlot: 1, sat: 94, light: 56, alpha: 0.24 },
  { freqX: 0.09, freqY: 0.16, phaseX: 3.5, phaseY: 2.4, radiusRatio: 0.50, hueSlot: 2, sat: 85, light: 44, alpha: 0.28 },
  { freqX: 0.15, freqY: 0.26, phaseX: 5.4, phaseY: 1.9, radiusRatio: 0.38, hueSlot: 3, sat: 92, light: 58, alpha: 0.22 },
  // Warm Solarpunk gold-emerald harmonic core accent
  { freqX: 0.12 * PHI, freqY: 0.12, phaseX: 0.7, phaseY: 4.2, radiusRatio: 0.36, hueSlot: 2, sat: 92, light: 60, alpha: 0.20 },
];

export const LiquidCrystalBackground: React.FC<LiquidCrystalBackgroundProps> = ({ stateRef }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let rafId = 0;
    let virtualPhase = 0;
    let lastTime = performance.now();

    const handleResize = () => {
      // Lower backing resolution slightly (0.75..1.0x) for silky buttery blur gradients at 60fps
      const dpr = Math.min(1.25, Math.max(0.75, window.devicePixelRatio * 0.65));
      width = Math.max(320, Math.floor(window.innerWidth * dpr));
      height = Math.max(240, Math.floor(window.innerHeight * dpr));
      canvas.width = width;
      canvas.height = height;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) * 0.001);
      lastTime = now;

      const s = stateRef.current;
      const speedScale = prefersReducedMotion ? 0.06 : 0.32 + s.energy * 0.25;
      virtualPhase += dt * speedScale;
      const t = virtualPhase;

      const hues = [s.hue1, s.hue2, s.hue3];
      const h1 = s.hue1;
      const h2 = s.hue2;
      const h3 = s.hue3;

      // 1. Deep chromatic crystal substrate (preserves high legibility while richly colored)
      const baseGrad = ctx.createLinearGradient(0, 0, width, height);
      baseGrad.addColorStop(0, `hsl(${h1.toFixed(0)}, 64%, ${(11 + s.energy * 4.5).toFixed(1)}%)`);
      baseGrad.addColorStop(0.5, `hsl(${h3.toFixed(0)}, 56%, ${(8 + s.energy * 3.5).toFixed(1)}%)`);
      baseGrad.addColorStop(1, `hsl(${h2.toFixed(0)}, 66%, ${(11 + s.energy * 4.5).toFixed(1)}%)`);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, width, height);

      const minDim = Math.min(width, height);
      const maxDim = Math.max(width, height);

      // 2. Organic Solarpunk liquid-crystal fluid blobs in screen blend
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < FLUID_NODES.length; i++) {
        const node = FLUID_NODES[i];
        const cx =
          width * (0.5 + 0.36 * Math.sin(t * node.freqX + node.phaseX) * Math.cos(t * 0.07 + i));
        const cy =
          height * (0.5 + 0.38 * Math.cos(t * node.freqY + node.phaseY) * Math.sin(t * 0.05 + i * PHI));
        const pulse = 1 + s.energy * 0.14 * Math.sin(t * 0.8 + i);
        const r = maxDim * node.radiusRatio * pulse;

        const nodeHue = (hues[node.hueSlot - 1] + Math.sin(t * 0.15 + i) * 10 + 360) % 360;
        const alpha = Math.min(0.58, node.alpha + s.energy * 0.16);

        const grad = ctx.createRadialGradient(cx, cy, r * 0.04, cx, cy, r);
        grad.addColorStop(0, `hsla(${nodeHue.toFixed(0)}, ${node.sat}%, ${node.light + 8}%, ${alpha.toFixed(3)})`);
        grad.addColorStop(0.45, `hsla(${((nodeHue + 24) % 360).toFixed(0)}, ${node.sat - 6}%, ${node.light - 6}%, ${(alpha * 0.45).toFixed(3)})`);
        grad.addColorStop(1, `hsla(${nodeHue.toFixed(0)}, ${node.sat}%, 15%, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Art Nouveau iridescent metallic liquid ribbons (smooth curved harmonic currents)
      const ribbonCount = 5;
      for (let rIdx = 0; rIdx < ribbonCount; rIdx++) {
        const ratio = rIdx / (ribbonCount - 1);
        const ribbonHue = (h1 + ratio * 137.508 + t * 4) % 360;
        const ribbonHue2 = (ribbonHue + 52) % 360;
        const yBase = height * (0.16 + ratio * 0.68);
        const amp = minDim * (0.055 + s.energy * 0.045);
        const freq = 1.1 + (s.harmonicRatio % 2.5) * 0.25 + rIdx * 0.22;

        const strokeGrad = ctx.createLinearGradient(0, yBase - amp, width, yBase + amp);
        strokeGrad.addColorStop(0, `hsla(${ribbonHue.toFixed(0)}, 90%, 68%, 0.02)`);
        strokeGrad.addColorStop(0.35, `hsla(${ribbonHue.toFixed(0)}, 94%, 72%, ${(0.1 + s.energy * 0.07).toFixed(3)})`);
        strokeGrad.addColorStop(0.65, `hsla(${ribbonHue2.toFixed(0)}, 92%, 76%, ${(0.12 + s.energy * 0.08).toFixed(3)})`);
        strokeGrad.addColorStop(1, `hsla(${ribbonHue2.toFixed(0)}, 90%, 66%, 0.02)`);

        ctx.strokeStyle = strokeGrad;
        ctx.lineWidth = Math.max(1.2, minDim * (0.002 + s.energy * 0.0012));
        ctx.beginPath();
        const steps = 28;
        for (let step = 0; step <= steps; step++) {
          const u = step / steps;
          const x = u * width;
          const wave =
            Math.sin(u * Math.PI * freq + t * (0.55 + rIdx * 0.12) + rIdx) * amp +
            Math.cos(u * Math.PI * freq * PHI - t * 0.35 + rIdx) * (amp * 0.42);
          const y = yBase + wave;
          if (step === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // 4. Subtle pearl-obsidian contrast scrim so typography and floating 3D graphs pop cleanly
      ctx.globalCompositeOperation = 'source-over';
      const scrim = ctx.createRadialGradient(
        width * 0.5,
        height * 0.42,
        minDim * 0.12,
        width * 0.5,
        height * 0.5,
        maxDim * 0.85
      );
      scrim.addColorStop(0, 'rgba(4, 7, 15, 0.12)');
      scrim.addColorStop(0.65, 'rgba(3, 5, 13, 0.30)');
      scrim.addColorStop(1, 'rgba(2, 4, 10, 0.52)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, width, height);

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
    };
  }, [stateRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full z-0 pointer-events-none select-none"
    />
  );
};
