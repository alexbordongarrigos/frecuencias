
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
}

const Visualizer: React.FC<VisualizerProps> = ({ 
  analyser, 
  sources,
  width = '100%', 
  height = 100, 
  color = '#38bdf8',
  type = 'line'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    // Construct active sources list
    let activeSources: VisualizerSource[] = [];
    if (sources && sources.length > 0) {
      activeSources = sources;
    } else if (analyser) {
      activeSources = [{ analyser, color }];
    }

    if (activeSources.length === 0) return;

    // Resize handling
    const resizeObserver = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        canvas.width = width;
        canvas.height = height;
    });
    resizeObserver.observe(canvas.parentElement!);

    const draw = () => {
      requestRef.current = requestAnimationFrame(draw);
      
      const w = canvas.width;
      const h = canvas.height;
      canvasCtx.clearRect(0, 0, w, h);

      // Draw each source
      activeSources.forEach(source => {
        if (!source.analyser) return;

        const bufferLength = source.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        source.analyser.getByteTimeDomainData(dataArray);

        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = source.color;
        
        if (type === 'fill') {
          canvasCtx.fillStyle = source.color.replace(')', ', 0.1)').replace('rgb', 'rgba');
        }

        canvasCtx.beginPath();
        const sliceWidth = w * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = v * h / 2; // Center is h/2

          if (i === 0) {
            canvasCtx.moveTo(x, y);
          } else {
            canvasCtx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        canvasCtx.lineTo(w, h / 2);
        canvasCtx.stroke();
      });
    };

    draw();

    return () => {
      cancelAnimationFrame(requestRef.current);
      resizeObserver.disconnect();
    };
  }, [analyser, sources, color, type]);

  return (
    <div className="w-full relative" style={{ height }}>
      <canvas 
        ref={canvasRef} 
        className="block w-full h-full"
      />
    </div>
  );
};

export default Visualizer;
