import React, { useEffect, useRef, useState } from 'react';

export type ProtomoleculaForma =
  | 'merkaba'
  | 'jitterbug'
  | 'teseracto'
  | 'dodecaedro'
  | 'matriz'
  | 'icosaedro'
  | 'semilla';

export type ProtomoleculaEstado =
  | 'reposo'
  | 'investigando'
  | 'sintetizando'
  | 'modulando'
  | 'audiomorphic'
  | 'escuchando'
  | 'cargando';

type Vec3 = [number, number, number];
type Vec4 = [number, number, number, number];
type Arista = [number, number];

const PHI = (1 + Math.sqrt(5)) / 2;
const ANGULO_AUREO = Math.PI * (3 - Math.sqrt(5));

const PALETAS: Record<ProtomoleculaEstado, { colores: string[]; brillo: string; halo: string; label: string }> = {
  reposo: { colores: ['#10B981', '#A855F7', '#00F0FF', '#D4AF37'], brillo: '#F8F9FA', halo: '#10B981', label: 'Reposo Coherente' },
  investigando: { colores: ['#06B6D4', '#67E8F9', '#10B981', '#0C4A6E'], brillo: '#F8F9FA', halo: '#06B6D4', label: 'Exploración Red Viva' },
  sintetizando: { colores: ['#00F0FF', '#007FFF', '#A78BFA'], brillo: '#F8F9FA', halo: '#00F0FF', label: 'Síntesis Astraura' },
  modulando: { colores: ['#FFBF00', '#D4AF37', '#E9C46A', '#10B981'], brillo: '#F8F9FA', halo: '#FFBF00', label: 'Modulación en Vivo' },
  audiomorphic: { colores: ['#A855F7', '#D4AF37', '#2DD29B'], brillo: '#F8F9FA', halo: '#A855F7', label: 'Sinestesia Audiomorphic' },
  escuchando: { colores: ['#22D3EE', '#A78BFA', '#FBBF24'], brillo: '#F8F9FA', halo: '#22D3EE', label: 'Atención Armónica' },
  cargando: { colores: ['#10B981', '#A855F7', '#00F0FF'], brillo: '#F8F9FA', halo: '#00F0FF', label: 'Sincronizando Capas' },
};

const FORMA_FICHAS: Record<ProtomoleculaForma, { nombre: string; numero: string; sentido: string }> = {
  merkaba: { nombre: 'Merkaba', numero: '8 vértices · 2×4', sentido: 'Contra-rotación dual solar/lunar' },
  jitterbug: { nombre: 'Equilibrio Vectorial', numero: '12 vértices · 8△', sentido: 'Plegado geodésico de Buckminster Fuller' },
  teseracto: { nombre: 'Teseracto 4D', numero: '16 vértices · 32 aristas', sentido: 'Hipercubo tetradimensional en rotación XW/YW' },
  dodecaedro: { nombre: 'Dodecaedro Áureo', numero: '12 caras · φ', sentido: 'Resonancia del éter y simetría pentagonal' },
  matriz: { nombre: 'Matriz Isotrópica', numero: '55 nodos · f=2', sentido: 'Red FCC de equilibrio tetraédrico' },
  icosaedro: { nombre: 'Icosaedro Fluido', numero: '20 caras · 12 vértices', sentido: 'Propagación ondulatoria coherente' },
  semilla: { nombre: 'Semilla Fibonacci', numero: '144 = 12² nodos', sentido: 'Filotaxis esférica en ángulo áureo' },
};

const STATE_DEFAULT_FORM: Record<ProtomoleculaEstado, ProtomoleculaForma> = {
  reposo: 'merkaba',
  investigando: 'teseracto',
  sintetizando: 'matriz',
  modulando: 'jitterbug',
  audiomorphic: 'dodecaedro',
  escuchando: 'icosaedro',
  cargando: 'semilla',
};

const FORM_SEQUENCE: ProtomoleculaForma[] = [
  'merkaba',
  'jitterbug',
  'teseracto',
  'dodecaedro',
  'matriz',
  'icosaedro',
  'semilla',
];

const len3 = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);
const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const normalize3 = (verts: Vec3[], radio = 1): Vec3[] => {
  const max = verts.reduce((m, v) => Math.max(m, len3(v)), 0) || 1;
  const k = radio / max;
  return verts.map((v) => [v[0] * k, v[1] * k, v[2] * k]);
};

const edgesByMinDistance = (verts: Vec3[], tolerance = 0.03): Arista[] => {
  let minD = Infinity;
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      const d = dist3(verts[i], verts[j]);
      if (d > 1e-5 && d < minD) minD = d;
    }
  }
  const out: Arista[] = [];
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      if (Math.abs(dist3(verts[i], verts[j]) - minD) <= minD * tolerance) {
        out.push([i, j]);
      }
    }
  }
  return out;
};

const buildMerkaba = (giro: number): { vertices: Vec3[]; aristas: Arista[] } => {
  const base: Vec3[] = [
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
  ];
  const rotY = (v: Vec3, a: number): Vec3 => [
    v[0] * Math.cos(a) + v[2] * Math.sin(a),
    v[1],
    -v[0] * Math.sin(a) + v[2] * Math.cos(a),
  ];
  const solar = base.map((v) => rotY(v, giro));
  const lunar = base.map((v) => rotY([-v[0], -v[1], -v[2]], -giro));
  const vertices = normalize3([...solar, ...lunar]);
  const aristas: Arista[] = [];
  for (const offset of [0, 4]) {
    for (let a = 0; a < 4; a++) {
      for (let b = a + 1; b < 4; b++) aristas.push([offset + a, offset + b]);
    }
  }
  return { vertices, aristas };
};

const buildJitterbug = (r: number): { vertices: Vec3[]; aristas: Arista[] } => {
  const k = Math.max(-1, Math.min(1, r));
  const b = 1 / Math.sqrt(1 + k * k + (k - 1) * (k - 1));
  const a = k * b;
  const signs: [number, number][] = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  const raw: Vec3[] = [
    ...signs.map(([s1, s2]): Vec3 => [0, s1 * a, s2 * b]),
    ...signs.map(([s1, s2]): Vec3 => [s2 * b, 0, s1 * a]),
    ...signs.map(([s1, s2]): Vec3 => [s1 * a, s2 * b, 0]),
  ];
  const vertices = normalize3(raw);
  const idx = (s1: number, s2: number) => (s1 > 0 ? 0 : 2) + (s2 > 0 ? 0 : 1);
  const aristas: Arista[] = [];
  const seen = new Set<string>();
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      for (const sz of [1, -1]) {
        const tri: [number, number, number] = [idx(sy, sz), 4 + idx(sz, sx), 8 + idx(sx, sy)];
        for (const [p, q] of [
          [tri[0], tri[1]],
          [tri[1], tri[2]],
          [tri[2], tri[0]],
        ] as Arista[]) {
          const key = p < q ? `${p}-${q}` : `${q}-${p}`;
          if (!seen.has(key)) {
            seen.add(key);
            aristas.push(p < q ? [p, q] : [q, p]);
          }
        }
      }
    }
  }
  return { vertices, aristas };
};

const TESSERACT_VERTICES: Vec4[] = Array.from({ length: 16 }, (_, i) => [
  i & 1 ? 1 : -1,
  i & 2 ? 1 : -1,
  i & 4 ? 1 : -1,
  i & 8 ? 1 : -1,
]);

const TESSERACT_EDGES: Arista[] = (() => {
  const out: Arista[] = [];
  for (let i = 0; i < 16; i++) {
    for (let b = 0; b < 4; b++) {
      const j = i ^ (1 << b);
      if (i < j) out.push([i, j]);
    }
  }
  return out;
})();

const buildTeseracto = (xw: number, yw: number): { vertices: Vec3[]; aristas: Arista[] } => {
  const cx = Math.cos(xw), sx = Math.sin(xw);
  const cy = Math.cos(yw), sy = Math.sin(yw);
  const distW = 3.0;
  const maxScale = 2.66;
  const vertices: Vec3[] = TESSERACT_VERTICES.map((v) => {
    const x1 = v[0] * cx - v[3] * sx;
    const w1 = v[0] * sx + v[3] * cx;
    const y2 = v[1] * cy - w1 * sy;
    const w2 = v[1] * sy + w1 * cy;
    const f = distW / (distW - w2);
    return [(x1 * f) / maxScale, (y2 * f) / maxScale, (v[2] * f) / maxScale];
  });
  return { vertices, aristas: TESSERACT_EDGES };
};

const ICOSAHEDRON_VERTS: Vec3[] = (() => {
  const v: Vec3[] = [];
  for (const a of [-1, 1]) {
    for (const b of [-PHI, PHI]) {
      v.push([0, a, b], [a, b, 0], [b, 0, a]);
    }
  }
  return normalize3(v);
})();
const ICOSAHEDRON_EDGES = edgesByMinDistance(ICOSAHEDRON_VERTS);

const DODECAHEDRON_VERTS: Vec3[] = (() => {
  const v: Vec3[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]);
  const inv = 1 / PHI;
  for (const a of [-inv, inv]) {
    for (const b of [-PHI, PHI]) {
      v.push([0, a, b], [a, b, 0], [b, 0, a]);
    }
  }
  return normalize3(v);
})();
const DODECAHEDRON_EDGES = edgesByMinDistance(DODECAHEDRON_VERTS);

const MATRIZ_FCC = (() => {
  const v: Vec3[] = [];
  for (let x = -4; x <= 4; x++) {
    for (let y = -4; y <= 4; y++) {
      for (let z = -4; z <= 4; z++) {
        if ((x + y + z) % 2 !== 0) continue;
        const capa = Math.max((Math.abs(x) + Math.abs(y) + Math.abs(z)) / 2, Math.abs(x), Math.abs(y), Math.abs(z));
        if (capa <= 2) v.push([x, y, z]);
      }
    }
  }
  const norm = normalize3(v);
  return { vertices: norm, aristas: edgesByMinDistance(norm, 0.02) };
})();

const FIB_SPHERE_55: Vec3[] = normalize3(
  Array.from({ length: 55 }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / 55;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const t = i * ANGULO_AUREO;
    return [Math.cos(t) * r, y, Math.sin(t) * r];
  })
);

interface Props {
  estado?: ProtomoleculaEstado;
  forma?: ProtomoleculaForma;
  analyser?: AnalyserNode | null;
  size?: number;
  compact?: boolean;
  onFormaChange?: (forma: ProtomoleculaForma) => void;
  className?: string;
}

export const ProtomoleculaOrb: React.FC<Props> = ({
  estado = 'reposo',
  forma,
  analyser,
  size = 180,
  compact = false,
  onFormaChange,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [manualForma, setManualForma] = useState<ProtomoleculaForma | null>(null);
  const dragRef = useRef<{ active: boolean; lastX: number; lastY: number; rotX: number; rotY: number; velX: number; velY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
    rotX: 0.35,
    rotY: 0.4,
    velX: 0,
    velY: 0,
  });

  const activeForma = manualForma || forma || STATE_DEFAULT_FORM[estado] || 'merkaba';
  const palette = PALETAS[estado] || PALETAS.reposo;
  const ficha = FORMA_FICHAS[activeForma];

  useEffect(() => {
    setManualForma(null);
  }, [estado]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let reducedMotion = mql ? mql.matches : false;
    const onMq = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
    };
    mql?.addEventListener?.('change', onMq);

    const freqBins = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    const particleCount = compact ? 55 : 144;
    const particles = Array.from({ length: particleCount }, (_, i) => ({
      edgeSeed: i,
      phase: (i * (PHI - 1)) % 1,
      size: 1.0 + (i % 3) * 0.45,
    }));

    let rafId = 0;
    let startTime = performance.now();

    const draw = (now: number) => {
      const elapsed = reducedMotion ? 0 : (now - startTime) / 1000;

      let audioEnergy = 0;
      let bassEnergy = 0;
      if (analyser && freqBins) {
        analyser.getByteFrequencyData(freqBins);
        let sum = 0;
        let bassSum = 0;
        const n = Math.min(freqBins.length, 64);
        for (let i = 0; i < n; i++) {
          sum += freqBins[i];
          if (i < 12) bassSum += freqBins[i];
        }
        audioEnergy = sum / (n * 255);
        bassEnergy = bassSum / (12 * 255);
      }

      const energy =
        (estado === 'sintetizando' || estado === 'modulando' ? PHI : 1.05) +
        audioEnergy * 1.4;

      if (!reducedMotion && !dragRef.current.active) {
        dragRef.current.rotY += (0.008 * energy) + dragRef.current.velX;
        dragRef.current.rotX += dragRef.current.velY;
        dragRef.current.velX *= 0.92;
        dragRef.current.velY *= 0.92;
      }

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * (0.31 + bassEnergy * 0.045);

      ctx.clearRect(0, 0, w, h);

      // Golden-ratio ambient halo (φ signature)
      const haloRad = radius * PHI * (1 + Math.sin(elapsed * 1.4) * 0.04 + audioEnergy * 0.15);
      const grad = ctx.createRadialGradient(cx, cy, radius * 0.12, cx, cy, haloRad);
      grad.addColorStop(0, `${palette.halo}55`);
      grad.addColorStop(0.5, `${palette.colores[0]}20`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, haloRad, 0, Math.PI * 2);
      ctx.fill();

      // Build active Sacred 4D geometry
      let geom: { vertices: Vec3[]; aristas: Arista[] };
      switch (activeForma) {
        case 'merkaba':
          geom = buildMerkaba(elapsed * 0.45 * energy);
          break;
        case 'jitterbug':
          geom = buildJitterbug(Math.cos(elapsed * 0.75 * energy));
          break;
        case 'teseracto':
          geom = buildTeseracto(elapsed * 0.48 * energy, elapsed * 0.29 * energy);
          break;
        case 'dodecaedro':
          geom = { vertices: DODECAHEDRON_VERTS, aristas: DODECAHEDRON_EDGES };
          break;
        case 'icosaedro':
          geom = { vertices: ICOSAHEDRON_VERTS, aristas: ICOSAHEDRON_EDGES };
          break;
        case 'matriz':
          geom = MATRIZ_FCC;
          break;
        case 'semilla':
        default:
          geom = { vertices: FIB_SPHERE_55, aristas: [] };
          break;
      }

      const ry = dragRef.current.rotY;
      const rx = dragRef.current.rotX;
      const cry = Math.cos(ry), sry = Math.sin(ry);
      const crx = Math.cos(rx), srx = Math.sin(rx);

      const projected: [number, number, number][] = geom.vertices.map((v) => {
        const x1 = v[0] * cry + v[2] * sry;
        const z1 = -v[0] * sry + v[2] * cry;
        const y2 = v[1] * crx - z1 * srx;
        const z2 = v[1] * srx + z1 * crx;
        const persp = 3.2 / (3.2 - z2 * 0.65);
        return [cx + x1 * radius * persp, cy + y2 * radius * persp, z2];
      });

      // Edges
      ctx.lineWidth = Math.max(1, dpr * (1.05 + audioEnergy * 0.7));
      for (let i = 0; i < geom.aristas.length; i++) {
        const [a, b] = geom.aristas[i];
        const pa = projected[a];
        const pb = projected[b];
        if (!pa || !pb) continue;
        const depthAlpha = Math.max(0.22, Math.min(0.95, 0.52 + (pa[2] + pb[2]) * 0.18));
        ctx.strokeStyle = palette.colores[i % palette.colores.length];
        ctx.globalAlpha = depthAlpha;
        ctx.beginPath();
        ctx.moveTo(pa[0], pa[1]);
        ctx.lineTo(pb[0], pb[1]);
        ctx.stroke();
      }

      // Vertices glow
      ctx.fillStyle = palette.brillo;
      for (let i = 0; i < projected.length; i++) {
        const [px, py, pz] = projected[i];
        ctx.globalAlpha = Math.max(0.35, Math.min(1, 0.68 + pz * 0.2));
        ctx.beginPath();
        ctx.arc(px, py, dpr * (geom.aristas.length === 0 ? 1.8 : 1.5), 0, Math.PI * 2);
        ctx.fill();
      }

      // 144 Fibonacci particles flowing along golden edges
      const edgeLen = geom.aristas.length;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const col = palette.colores[i % palette.colores.length];
        let x = cx, y = cy, z = 0;
        if (edgeLen > 0) {
          const [ea, eb] = geom.aristas[p.edgeSeed % edgeLen];
          const pa = projected[ea];
          const pb = projected[eb];
          if (pa && pb) {
            const u = (p.phase + elapsed * 0.28 * energy) % 1;
            x = pa[0] + (pb[0] - pa[0]) * u;
            y = pa[1] + (pb[1] - pa[1]) * u;
            z = pa[2] + (pb[2] - pa[2]) * u;
          }
        } else if (projected.length > 0) {
          const pv = projected[i % projected.length];
          x = pv[0];
          y = pv[1];
          z = pv[2];
        }
        ctx.globalAlpha = Math.max(0.3, Math.min(1, 0.65 + z * 0.25 + audioEnergy * 0.25));
        ctx.fillStyle = i % 5 === 0 ? palette.brillo : col;
        ctx.beginPath();
        ctx.arc(x, y, dpr * p.size * (0.85 + audioEnergy * 0.35), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      mql?.removeEventListener?.('change', onMq);
    };
  }, [activeForma, estado, size, compact, analyser, palette]);

  const handleCycleForma = () => {
    const idx = FORM_SEQUENCE.indexOf(activeForma);
    const next = FORM_SEQUENCE[(idx + 1) % FORM_SEQUENCE.length];
    setManualForma(next);
    onFormaChange?.(next);
  };

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <div
        className="relative flex items-center justify-center rounded-full cursor-grab active:cursor-grabbing"
        style={{ width: size, height: size }}
        title="Arrastra para rotar en 4D · Clic para transformar geometría"
        onPointerDown={(e) => {
          dragRef.current.active = true;
          dragRef.current.lastX = e.clientX;
          dragRef.current.lastY = e.clientY;
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragRef.current.active) return;
          const dx = e.clientX - dragRef.current.lastX;
          const dy = e.clientY - dragRef.current.lastY;
          dragRef.current.rotY += dx * 0.012;
          dragRef.current.rotX += dy * 0.012;
          dragRef.current.velX = dx * 0.002;
          dragRef.current.velY = dy * 0.002;
          dragRef.current.lastX = e.clientX;
          dragRef.current.lastY = e.clientY;
        }}
        onPointerUp={(e) => {
          const moved = Math.hypot(e.clientX - dragRef.current.lastX, e.clientY - dragRef.current.lastY);
          dragRef.current.active = false;
          if (moved < 2) {
            // Short click cycles Sacred Form
          }
        }}
        onClick={handleCycleForma}
      >
        <canvas
          ref={canvasRef}
          data-testid="protomolecula-orb-canvas"
          style={{ width: size, height: size }}
          className="block rounded-full"
        />
      </div>

      {!compact && (
        <div className="mt-1.5 text-center space-y-0.5 px-2">
          <div className="flex items-center justify-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: palette.halo }}
            />
            <span className="text-[11px] font-bold text-white tracking-wide">
              {ficha.nombre}
            </span>
            <span className="text-[9px] font-mono text-cyan-300/80 border border-cyan-500/25 bg-cyan-500/10 px-1.5 py-0.5 rounded">
              {ficha.numero}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 leading-tight">{ficha.sentido}</p>
        </div>
      )}
    </div>
  );
};

export default ProtomoleculaOrb;
