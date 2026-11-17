
import React, { useRef, useEffect } from 'react';

export interface VisualizerSource {
  analyser: AnalyserNode | undefined | null;
  color: string;
}

interface VisualizerProps {
  // Support single source (legacy/simple) or multiple sources (master)
  analyser?: AnalyserNode | undefined | null;
  sources?: VisualizerSource[]; 
  width?: string;
  height?: number;
  color?: string; // Default color if not specified in source
  type?: 'line' | 'fill';
  transparentBg?: boolean;
  fallbackFrequencies?: number[];
  perspective3D?: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ 
  analyser, 
  sources,
  width = '100%', 
  height = 100, 
  color = '#38bdf8',
  type = 'line',
  transparentBg = false,
  fallbackFrequencies,
  perspective3D = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  const analyserRef = useRef(analyser);
  const sourcesRef = useRef(sources);
  const colorRef = useRef(color);
  const typeRef = useRef(type);
  const transparentBgRef = useRef(transparentBg);
  const fallbackFrequenciesRef = useRef(fallbackFrequencies);
  const perspective3DRef = useRef(perspective3D);

  useEffect(() => { analyserRef.current = analyser; }, [analyser]);
  useEffect(() => { sourcesRef.current = sources; }, [sources]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { typeRef.current = type; }, [type]);
  useEffect(() => { transparentBgRef.current = transparentBg; }, [transparentBg]);
  useEffect(() => { fallbackFrequenciesRef.current = fallbackFrequencies; }, [fallbackFrequencies]);
  useEffect(() => { perspective3DRef.current = perspective3D; }, [perspective3D]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const updateSize = () => {
      if (!canvas.parentElement) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      const targetW = Math.max(1, Math.floor(rect.width));
      const targetH = Math.max(1, Math.floor(rect.height));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    };
    updateSize();
    const resizeObserver = new ResizeObserver(() => updateSize());
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    let phase = 0;

    const draw = () => {
      requestRef.current = requestAnimationFrame(draw);
      phase += 0.035;

      if (canvas.width <= 1 || canvas.height <= 1) {
        updateSize();
      }
      const w = canvas.width;
      const h = canvas.height;
      canvasCtx.clearRect(0, 0, w, h);

      const curSources = sourcesRef.current;
      const curAnalyser = analyserRef.current;
      const curColor = colorRef.current;
      const curType = typeRef.current;
      const curFallback = fallbackFrequenciesRef.current;
      const cur3D = perspective3DRef.current;

      let activeSources: VisualizerSource[] = [];
      if (curSources && curSources.length > 0) {
        activeSources = curSources;
      } else if (curAnalyser) {
        activeSources = [{ analyser: curAnalyser, color: curColor }];
      }

      let maxAmplitude = 1.0;
      let hasLiveSignal = false;
      const sourceData: Float32Array[] = [];

      activeSources.forEach((source) => {
        if (!source.analyser) {
          sourceData.push(new Float32Array(0));
          return;
        }
        const bufferLength = source.analyser.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        source.analyser.getFloatTimeDomainData(dataArray);
        sourceData.push(dataArray);

        for (let i = 0; i < bufferLength; i++) {
          const absVal = Math.abs(dataArray[i]);
          if (absVal > 0.002) hasLiveSignal = true;
          if (absVal > maxAmplitude) {
            maxAmplitude = absVal;
          }
        }
      });

      maxAmplitude *= 1.1;

      if (hasLiveSignal) {
        const depthLayers = cur3D ? 3 : 1;
        for (let d = depthLayers - 1; d >= 0; d--) {
          const yShift = d * -6;
          const xScale = 1 - d * 0.04;
          const layerAlpha = d === 0 ? 1 : 0.28 / d;

          activeSources.forEach((source, index) => {
            if (!source.analyser) return;
            const dataArray = sourceData[index];
            const bufferLength = dataArray.length;
            if (bufferLength === 0) return;

            canvasCtx.save();
            canvasCtx.globalAlpha = layerAlpha;
            canvasCtx.lineWidth = d === 0 ? 2.2 : 1.4;
            canvasCtx.strokeStyle = source.color;
            if (cur3D && d === 0) {
              canvasCtx.shadowColor = source.color;
              canvasCtx.shadowBlur = 12;
            }

            if (curType === 'fill' && d === 0) {
              canvasCtx.fillStyle = source.color.replace(')', ', 0.1)').replace('rgb', 'rgba');
            }

            canvasCtx.beginPath();
            const sliceWidth = (w * xScale) / bufferLength;
            let x = (w * (1 - xScale)) / 2;

            for (let i = 0; i < bufferLength; i++) {
              const normalizedValue = dataArray[i] / maxAmplitude;
              const y = (1 - normalizedValue) * (h / 2) + yShift;
              if (i === 0) canvasCtx.moveTo(x, y);
              else canvasCtx.lineTo(x, y);
              x += sliceWidth;
            }

            canvasCtx.stroke();
            canvasCtx.restore();
          });
        }
      } else if (curFallback && curFallback.length > 0) {
        // Harmonic preview standing waves when audio is muted/not yet started
        const layers = cur3D ? 4 : 2;
        const palette = ['#22d3ee', '#fbbf24', '#c084fc', '#34d399'];
        for (let l = layers - 1; l >= 0; l--) {
          const freq = curFallback[l % curFallback.length] || 432;
          const cycles = 2 + ((freq % 90) / 18) + l * 0.65;
          const strokeColor = palette[l % palette.length];

          canvasCtx.save();
          canvasCtx.globalAlpha = l === 0 ? 0.95 : 0.42;
          canvasCtx.lineWidth = l === 0 ? 2.4 : 1.4;
          canvasCtx.strokeStyle = strokeColor;
          canvasCtx.shadowColor = strokeColor;
          canvasCtx.shadowBlur = l === 0 ? 14 : 6;
          canvasCtx.beginPath();

          const steps = 160;
          for (let i = 0; i <= steps; i++) {
            const u = i / steps;
            const envelope = Math.sin(u * Math.PI);
            const y =
              h / 2 +
              (Math.sin(u * Math.PI * 2 * cycles + phase * (1 + l * 0.25)) * 0.6 +
                Math.sin(u * Math.PI * 2 * cycles * 1.618 - phase * 0.7) * 0.4) *
                (h * 0.34) *
                envelope +
              (l - 1) * 4;
            const x = u * w;
            if (i === 0) canvasCtx.moveTo(x, y);
            else canvasCtx.lineTo(x, y);
          }
          canvasCtx.stroke();
          canvasCtx.restore();
        }
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(requestRef.current);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      className={`w-full relative ${transparentBg ? 'bg-transparent' : ''}`}
      style={{ width, height }}
    >
      <canvas 
        ref={canvasRef} 
        className="block w-full h-full bg-transparent"
      />
    </div>
  );
};

export default Visualizer;
