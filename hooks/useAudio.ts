
import { useRef, useState, useEffect } from 'react';
import { OscillatorState } from '../types';

interface AudioNodeRefs {
  osc: OscillatorNode;
  gain: GainNode;
  panner: PannerNode;
  analyser: AnalyserNode;
}

// Factor de escala para el espacio 3D.
const SPATIAL_SCALE = 10.0;

export const useAudio = () => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const masterAnalyserRef = useRef<AnalyserNode | null>(null);
  
  // New: Combined Bus for "Main Resonance" visualization/binaural calculation
  const combinedGainRef = useRef<GainNode | null>(null);
  const combinedAnalyserRef = useRef<AnalyserNode | null>(null);

  // Map to store audio nodes for each active oscillator
  const nodesRef = useRef<Map<string, AudioNodeRefs>>(new Map());
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [oscillators, setOscillators] = useState<OscillatorState[]>([]);

  // Initialize Audio Context
  useEffect(() => {
    const initAudio = () => {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new Ctx();
        
        // Listener set to center
        const listener = ctx.listener;
        if (listener.positionX) {
          listener.positionX.value = 0;
          listener.positionY.value = 0;
          listener.positionZ.value = 0;
          listener.forwardX.value = 0;
          listener.forwardY.value = 0;
          listener.forwardZ.value = -1;
          listener.upX.value = 0;
          listener.upY.value = 1;
          listener.upZ.value = 0;
        }

        // Master Output
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0.5; // Default master volume
        const masterAnalyser = ctx.createAnalyser();
        masterAnalyser.fftSize = 2048;

        // Combined Bus (For binaural resonance calculation)
        const combinedGain = ctx.createGain();
        const combinedAnalyser = ctx.createAnalyser();
        combinedAnalyser.fftSize = 2048;

        // Routing: 
        // 1. Combined Bus -> Master
        combinedGain.connect(combinedAnalyser);
        combinedAnalyser.connect(masterGain);
        
        // 2. Master -> Speaker
        masterGain.connect(masterAnalyser);
        masterAnalyser.connect(ctx.destination);

        audioCtxRef.current = ctx;
        masterGainRef.current = masterGain;
        masterAnalyserRef.current = masterAnalyser;
        combinedGainRef.current = combinedGain;
        combinedAnalyserRef.current = combinedAnalyser;
      }
    };
    initAudio();

    return () => {
      audioCtxRef.current?.close();
    };
  }, []);

  const toggleMasterPlay = async () => {
    if (!audioCtxRef.current) return;

    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }

    if (isPlaying) {
      await audioCtxRef.current.suspend();
    } else {
      await audioCtxRef.current.resume();
    }
    setIsPlaying(!isPlaying);
  };

  const addOscillator = (initialState?: Partial<OscillatorState>) => {
    const newOsc: OscillatorState = {
      id: crypto.randomUUID(),
      frequency: initialState?.frequency || 432,
      type: initialState?.type || 'sine',
      volume: initialState?.volume !== undefined ? initialState.volume : 0.5,
      // 3D defaults
      panX: initialState?.panX !== undefined ? initialState.panX : 0,
      panY: initialState?.panY !== undefined ? initialState.panY : 0,
      panZ: initialState?.panZ !== undefined ? initialState.panZ : 0,
      
      isPlaying: true,
      name: initialState?.name || 'Oscilador',
      isIndependent: false,
      color: initialState?.color || '#38bdf8' 
    };

    setOscillators(prev => [...prev, newOsc]);
    createOscillatorNodes(newOsc);
  };

  const removeOscillator = (id: string) => {
    setOscillators(prev => prev.filter(o => o.id !== id));
    destroyOscillatorNodes(id);
  };

  const updateOscillator = (id: string, changes: Partial<OscillatorState>) => {
    setOscillators(prev => prev.map(o => {
      if (o.id === id) {
        const updated = { ...o, ...changes };
        updateOscillatorNodes(updated);
        return updated;
      }
      return o;
    }));
  };

  // --- Internal Audio Node Management ---

  const createOscillatorNodes = (oscState: OscillatorState) => {
    if (!audioCtxRef.current || !masterGainRef.current || !combinedGainRef.current) return;
    const ctx = audioCtxRef.current;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // PannerNode: Equal Power for Hard Panning capability
    const panner = ctx.createPanner();
    panner.panningModel = 'equalpower'; 
    panner.distanceModel = 'inverse';
    panner.rolloffFactor = 0; 
    panner.refDistance = 1;
    panner.maxDistance = 10000;
    
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512; 

    osc.type = oscState.type;
    osc.frequency.setValueAtTime(oscState.frequency, ctx.currentTime);
    gain.gain.setValueAtTime(oscState.volume, ctx.currentTime);
    
    // Set 3D Position
    if (panner.positionX) {
      panner.positionX.setValueAtTime(oscState.panX * SPATIAL_SCALE, ctx.currentTime);
      panner.positionY.setValueAtTime(oscState.panY * SPATIAL_SCALE, ctx.currentTime);
      panner.positionZ.setValueAtTime(oscState.panZ * -SPATIAL_SCALE, ctx.currentTime);
    }

    // Graph Connection
    osc.connect(gain);
    gain.connect(panner);
    panner.connect(analyser);

    // Routing Logic: Independent vs Combined
    if (oscState.isIndependent) {
        analyser.connect(masterGainRef.current); // Direct to Master
    } else {
        analyser.connect(combinedGainRef.current); // To Combined Bus
    }

    osc.start();

    nodesRef.current.set(oscState.id, { osc, gain, panner, analyser });
  };

  const destroyOscillatorNodes = (id: string) => {
    const nodes = nodesRef.current.get(id);
    if (nodes) {
      try {
          if (audioCtxRef.current) {
            nodes.gain.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.01);
          }
          setTimeout(() => {
              nodes.osc.stop();
              nodes.osc.disconnect();
              nodes.gain.disconnect();
              nodes.panner.disconnect();
              nodes.analyser.disconnect();
          }, 50);
      } catch(e) { console.error("Error disconnecting node", e)}
      
      nodesRef.current.delete(id);
    }
  };

  const updateOscillatorNodes = (oscState: OscillatorState) => {
    const nodes = nodesRef.current.get(oscState.id);
    if (!nodes || !audioCtxRef.current || !masterGainRef.current || !combinedGainRef.current) return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;

    // Type
    if (nodes.osc.type !== oscState.type) nodes.osc.type = oscState.type;
    
    // Freq & Vol
    nodes.osc.frequency.setTargetAtTime(oscState.frequency, now, 0.02);
    nodes.gain.gain.setTargetAtTime(oscState.isPlaying ? oscState.volume : 0, now, 0.02);
    
    // 3D Position
    if (nodes.panner.positionX) {
      nodes.panner.positionX.setTargetAtTime(oscState.panX * SPATIAL_SCALE, now, 0.02);
      nodes.panner.positionY.setTargetAtTime(oscState.panY * SPATIAL_SCALE, now, 0.02);
      nodes.panner.positionZ.setTargetAtTime(oscState.panZ * -SPATIAL_SCALE, now, 0.02);
    }

    // Routing update
    // We disconnect and reconnect to switch buses
    try {
        nodes.analyser.disconnect();
        if (oscState.isIndependent) {
            nodes.analyser.connect(masterGainRef.current);
        } else {
            nodes.analyser.connect(combinedGainRef.current);
        }
    } catch (e) { console.error("Routing update error", e); }
  };

  const getMasterAnalyser = () => masterAnalyserRef.current;
  const getCombinedAnalyser = () => combinedAnalyserRef.current;
  const getOscillatorAnalyser = (id: string) => nodesRef.current.get(id)?.analyser;

  return {
    isPlaying,
    oscillators,
    toggleMasterPlay,
    addOscillator,
    removeOscillator,
    updateOscillator,
    getMasterAnalyser,
    getCombinedAnalyser,
    getOscillatorAnalyser
  };
};
