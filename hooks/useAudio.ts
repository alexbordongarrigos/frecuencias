
import { useRef, useState, useEffect } from 'react';
import { OscillatorState, WaveType } from '../types';
import { meshNetwork } from '../services/meshNetwork';

interface AudioNodeRefs {
  osc1: OscillatorNode;
  osc2: OscillatorNode;
  gain1: GainNode;
  gain2: GainNode;
  mainGain: GainNode;
  shaper: WaveShaperNode;
  dcBlocker: BiquadFilterNode;
  aaFilter: BiquadFilterNode;
  delay: DelayNode;
  panner: PannerNode;
  analyser: AnalyserNode;
  isIndependent: boolean;
}

export type LiveAudioAdjustmentCommand =
  | { type: 'harmonic_shift'; ratio?: number; deltaHz?: number; glideSec?: number }
  | { type: 'update_layer'; index?: number; id?: string; changes: Partial<OscillatorState>; glideSec?: number }
  | { type: 'add_layer'; oscillator: Partial<OscillatorState>; glideSec?: number }
  | { type: 'remove_layer'; index?: number; id?: string; glideSec?: number }
  | { type: 'set_master'; volume?: number; filter?: { type?: BiquadFilterType; frequency?: number; Q?: number } }
  | { type: 'toggle_playback'; playing?: boolean }
  | { type: 'set_spatial_spread'; spread: number; glideSec?: number }
  | { type: 'launch_transition'; duration?: number; endShiftRatio?: number; loopCount?: number | 'infinite' };

// Factor de escala para el espacio 3D.
const SPATIAL_SCALE = 10.0;

// Generador de curva de deformación armónica para valles, crestas y asimetría
const createShaperCurve = (crestValleyRatio: number = 1.0, dutyCycle: number = 0, harmonicDistortion: number = 0) => {
  const n = 1024;
  const curve = new Float32Array(n);
  const ratio = Math.max(0.1, Math.min(3.0, crestValleyRatio));
  const duty = Math.max(-0.8, Math.min(0.8, dutyCycle));
  const dist = Math.max(0, Math.min(1, harmonicDistortion));

  for (let i = 0; i < n; i++) {
    let x = (i / (n - 1)) * 2 - 1; // -1 to 1

    // Apply Duty Cycle (Asymmetry offset)
    x = Math.max(-1, Math.min(1, x + duty));

    // Crest vs Valley Distance & Leveling
    if (x >= 0) {
      x = Math.pow(x, 1 / ratio);
    } else {
      const invRatio = Math.max(0.05, 2 - ratio);
      x = -Math.pow(-x, 1 / invRatio);
    }

    // Non-linear Harmonic Distortion / Curve Saturation
    if (dist > 0) {
      const k = dist * 8;
      x = (1 + k) * x / (1 + k * Math.abs(x));
    }

    curve[i] = Math.max(-1, Math.min(1, x));
  }
  return curve;
};

export const useAudio = () => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const masterFilterRef = useRef<BiquadFilterNode | null>(null);
  const masterAnalyserRef = useRef<AnalyserNode | null>(null);
  
  // New: Combined Bus for "Main Resonance" visualization/binaural calculation
  const combinedGainRef = useRef<GainNode | null>(null);
  const combinedAnalyserRef = useRef<AnalyserNode | null>(null);

  // Map to store audio nodes for each active oscillator
  const nodesRef = useRef<Map<string, AudioNodeRefs>>(new Map());
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [oscillators, setOscillators] = useState<OscillatorState[]>([]);
  const oscillatorsRef = useRef<OscillatorState[]>([]);
  const [masterVolume, setMasterVolume] = useState(1.0);
  const [masterFilter, setMasterFilter] = useState({ type: 'allpass' as BiquadFilterType, frequency: 20000, Q: 1 });
  const [meshLatency, setMeshLatency] = useState(0);

  const commitOscillators = (
    updater: OscillatorState[] | ((prev: OscillatorState[]) => OscillatorState[])
  ): OscillatorState[] => {
    const next = typeof updater === 'function' ? updater(oscillatorsRef.current) : updater;
    oscillatorsRef.current = next;
    setOscillators(next);
    return next;
  };

  useEffect(() => {
    const unsub = meshNetwork.onNodesUpdate((nodes) => {
      if (nodes.length > 0) {
        const bestNode = nodes.reduce((prev, current) => (current.snr || -100) > (prev.snr || -100) ? current : prev);
        const baseLatency = 0.020; // 20ms in seconds
        const jitter = (0.010 / Math.max(bestNode.snr || 1, 1));
        setMeshLatency(baseLatency + jitter);
      } else {
        setMeshLatency(0);
      }
    });
    return () => unsub();
  }, []);

  // Update existing delays when mesh latency changes
  useEffect(() => {
    if (audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      nodesRef.current.forEach((nodes, id) => {
        const oscState = oscillators.find(o => o.id === id);
        if (oscState) {
          const phaseDeg = oscState.phaseOffset || 0;
          const baseDelayTime = phaseDeg > 0 ? (phaseDeg / 360) / Math.max(0.1, oscState.frequency) : 0;
          nodes.delay.delayTime.setTargetAtTime(baseDelayTime + meshLatency, ctx.currentTime, 0.05);
        }
      });
    }
  }, [meshLatency, oscillators]);

  // Initialize Audio Context
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      
      // Sync isPlaying state with context state
      ctx.onstatechange = () => {
        setIsPlaying(ctx.state === 'running');
      };

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
      masterGain.gain.value = masterVolume; // Default master volume
      
      const masterFilter = ctx.createBiquadFilter();
      masterFilter.type = 'allpass';
      masterFilter.frequency.value = 20000;
      masterFilter.Q.value = 1;
      
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
      
      // 2. Master -> Filter -> Analyser -> Speaker
      masterGain.connect(masterFilter);
      masterFilter.connect(masterAnalyser);
      masterAnalyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      masterGainRef.current = masterGain;
      masterFilterRef.current = masterFilter;
      masterAnalyserRef.current = masterAnalyser;
      combinedGainRef.current = combinedGain;
      combinedAnalyserRef.current = combinedAnalyser;
      
      setIsPlaying(ctx.state === 'running');
    }
  };

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      masterGainRef.current = null;
      masterFilterRef.current = null;
      masterAnalyserRef.current = null;
      combinedGainRef.current = null;
      combinedAnalyserRef.current = null;
      nodesRef.current.clear();
    };
  }, []);

  const updateMasterVolume = (vol: number) => {
    setMasterVolume(vol);
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.cancelScheduledValues(audioCtxRef.current.currentTime);
      masterGainRef.current.gain.setTargetAtTime(vol, audioCtxRef.current.currentTime, 0.02);
    }
  };

  const updateMasterFilter = (config: { type?: BiquadFilterType; frequency?: number; Q?: number }) => {
    setMasterFilter(prev => {
      const next = { ...prev, ...config };
      if (masterFilterRef.current && audioCtxRef.current) {
        const t = audioCtxRef.current.currentTime;
        if (config.type) masterFilterRef.current.type = config.type;
        if (config.frequency !== undefined) {
          masterFilterRef.current.frequency.cancelScheduledValues(t);
          masterFilterRef.current.frequency.setTargetAtTime(config.frequency, t, 0.05);
        }
        if (config.Q !== undefined) {
          masterFilterRef.current.Q.cancelScheduledValues(t);
          masterFilterRef.current.Q.setTargetAtTime(config.Q, t, 0.05);
        }
      }
      return next;
    });
  };

  const toggleMasterPlay = async () => {
    const wasInitialized = !!audioCtxRef.current;
    initAudio();
    if (!audioCtxRef.current) return;

    if (!wasInitialized) {
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
      setIsPlaying(audioCtxRef.current.state === 'running');
      return;
    }

    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    } else if (audioCtxRef.current.state === 'running') {
      await audioCtxRef.current.suspend();
    }
    setIsPlaying(audioCtxRef.current.state === 'running');
  };

  const addOscillator = (initialState?: Partial<OscillatorState>) => {
    initAudio();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    const newOsc: OscillatorState = {
      id: crypto.randomUUID(),
      frequency: initialState?.frequency || 432,
      type: initialState?.type || 'sine',
      volume: initialState?.volume !== undefined ? initialState.volume : 0.5,
      // 3D defaults
      panX: initialState?.panX !== undefined ? initialState.panX : 0,
      panY: initialState?.panY !== undefined ? initialState.panY : 0,
      panZ: initialState?.panZ !== undefined ? initialState.panZ : 0,
      
      // Wave Shaping & Modulation defaults
      crestValleyRatio: initialState?.crestValleyRatio !== undefined ? initialState.crestValleyRatio : 1.0,
      dutyCycle: initialState?.dutyCycle !== undefined ? initialState.dutyCycle : 0,
      harmonicDistortion: initialState?.harmonicDistortion !== undefined ? initialState.harmonicDistortion : 0,
      phaseOffset: initialState?.phaseOffset !== undefined ? initialState.phaseOffset : 0,

      isPlaying: true,
      name: initialState?.name || 'Oscilador',
      isIndependent: false,
      color: initialState?.color || '#38bdf8' 
    };

    commitOscillators(prev => [...prev, newOsc]);
    createOscillatorNodes(newOsc);
    return newOsc.id;
  };

  const removeOscillator = (id: string) => {
    commitOscillators(prev => prev.filter(o => o.id !== id));
    destroyOscillatorNodes(id);
  };

  const setAllOscillators = (newOscillatorsList: OscillatorState[], latencyMs: number = 0) => {
    initAudio();
    // Destroy obsolete ones
    nodesRef.current.forEach((_, id) => {
      if (!newOscillatorsList.some(o => o.id === id)) {
        destroyOscillatorNodes(id);
      }
    });
    
    // Apply latency compensation (quantum alignment)
    const compensatedList = newOscillatorsList.map(osc => {
      if (latencyMs > 0) {
        // Advance phase to compensate for lost time
        const phaseShift = osc.frequency * (latencyMs / 1000) * 360;
        return {
          ...osc,
          phaseOffset: ((osc.phaseOffset || 0) + phaseShift) % 360
        };
      }
      return osc;
    });

    // Add/update new ones
    compensatedList.forEach(osc => {
      if (nodesRef.current.has(osc.id)) {
        updateOscillatorNodes(osc);
      } else {
        createOscillatorNodes(osc);
      }
    });
    commitOscillators(compensatedList);
  };

  const updateOscillator = (id: string, changes: Partial<OscillatorState>) => {
    initAudio();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    commitOscillators(prev => prev.map(o => {
      if (o.id === id) {
        const updated = { ...o, ...changes };
        updateOscillatorNodes(updated);
        return updated;
      }
      return o;
    }));
  };

  // --- Internal Audio Node Management ---

  const createOscillatorNodes = (oscState: OscillatorState, fadeInTau = 0.035) => {
    if (!audioCtxRef.current || !masterGainRef.current || !combinedGainRef.current) return;
    const ctx = audioCtxRef.current;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();
    const mainGain = ctx.createGain();
    
    // WaveShaper for Crest/Valley modulation & symmetry
    const shaper = ctx.createWaveShaper();
    shaper.curve = createShaperCurve(
      oscState.crestValleyRatio ?? 1.0,
      oscState.dutyCycle ?? 0,
      oscState.harmonicDistortion ?? 0
    );
    shaper.oversample = '4x';

    // DC Blocker to remove DC offset caused by wave shaping
    const dcBlocker = ctx.createBiquadFilter();
    dcBlocker.type = 'highpass';
    dcBlocker.frequency.value = 1.0; 

    // Anti-Aliasing Filter (Lowpass) to reduce harmonic artifacts
    const aaFilter = ctx.createBiquadFilter();
    aaFilter.type = 'lowpass';
    // Gentle roll-off before Nyquist frequency to ensure wave purity
    aaFilter.frequency.value = Math.min(18000, ctx.sampleRate / 2.2);

    // DelayNode for Angular Phase Shift + Mesh Latency offset
    const delay = ctx.createDelay(2.0); // max 2 seconds
    const phaseDeg = oscState.phaseOffset || 0;
    const baseDelayTime = phaseDeg > 0 ? (phaseDeg / 360) / Math.max(0.1, oscState.frequency) : 0;
    delay.delayTime.setValueAtTime(baseDelayTime + meshLatency, ctx.currentTime);

    // PannerNode: Equal Power for Hard Panning capability
    const panner = ctx.createPanner();
    panner.panningModel = 'equalpower'; 
    panner.distanceModel = 'inverse';
    panner.rolloffFactor = 0; 
    panner.refDistance = 1;
    panner.maxDistance = 10000;
    
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512; 

    osc1.type = oscState.type;
    osc2.type = oscState.type2 || oscState.type;
    
    osc1.frequency.setValueAtTime(Math.max(0.1, Math.min(20000, oscState.frequency)), ctx.currentTime);
    osc2.frequency.setValueAtTime(Math.max(0.1, Math.min(20000, oscState.frequency)), ctx.currentTime);
    
    const mix = oscState.typeMix || 0;
    gain1.gain.setValueAtTime(Math.cos(mix * 0.5 * Math.PI), ctx.currentTime);
    gain2.gain.setValueAtTime(Math.sin(mix * 0.5 * Math.PI), ctx.currentTime);
    
    // Smooth clickless fade-in from near-zero
    mainGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    mainGain.gain.setTargetAtTime(oscState.isPlaying ? oscState.volume : 0, ctx.currentTime, fadeInTau);
    
    // Set 3D Position
    if (panner.positionX) {
      panner.positionX.setValueAtTime(oscState.panX * SPATIAL_SCALE, ctx.currentTime);
      panner.positionY.setValueAtTime(oscState.panY * SPATIAL_SCALE, ctx.currentTime);
      panner.positionZ.setValueAtTime(oscState.panZ * -SPATIAL_SCALE, ctx.currentTime);
    }

    // Graph Connection: osc -> gain -> mainGain -> shaper -> dcBlocker -> aaFilter -> delay -> panner -> analyser
    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(mainGain);
    gain2.connect(mainGain);
    mainGain.connect(shaper);
    shaper.connect(dcBlocker);
    dcBlocker.connect(aaFilter);
    aaFilter.connect(delay);
    delay.connect(panner);
    panner.connect(analyser);

    // Routing Logic: Independent vs Combined
    if (oscState.isIndependent) {
        analyser.connect(masterGainRef.current); // Direct to Master
    } else {
        analyser.connect(combinedGainRef.current); // To Combined Bus
    }

    osc1.start();
    osc2.start();

    nodesRef.current.set(oscState.id, {
      osc1,
      osc2,
      gain1,
      gain2,
      mainGain,
      shaper,
      dcBlocker,
      aaFilter,
      delay,
      panner,
      analyser,
      isIndependent: Boolean(oscState.isIndependent),
    });
  };

  const destroyOscillatorNodes = (id: string, fadeOutMs = 55) => {
    const nodes = nodesRef.current.get(id);
    if (nodes) {
      nodesRef.current.delete(id);
      try {
          if (audioCtxRef.current) {
            const tau = Math.max(0.01, fadeOutMs / 3000);
            nodes.mainGain.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, tau);
          }
          setTimeout(() => {
              try {
                nodes.osc1.stop();
                nodes.osc2.stop();
                nodes.osc1.disconnect();
                nodes.osc2.disconnect();
                nodes.gain1.disconnect();
                nodes.gain2.disconnect();
                nodes.mainGain.disconnect();
                nodes.shaper.disconnect();
                nodes.dcBlocker.disconnect();
                nodes.aaFilter.disconnect();
                nodes.delay.disconnect();
                nodes.panner.disconnect();
                nodes.analyser.disconnect();
              } catch { /* already stopped */ }
          }, fadeOutMs + 40);
      } catch(e) { console.error("Error disconnecting node", e)}
    }
  };

  const updateOscillatorNodes = (oscState: OscillatorState, rampSec = 0.025) => {
    const nodes = nodesRef.current.get(oscState.id);
    if (!nodes || !audioCtxRef.current || !masterGainRef.current || !combinedGainRef.current) return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    const tau = Math.max(0.012, rampSec);

    // Type
    if (nodes.osc1.type !== oscState.type) nodes.osc1.type = oscState.type;
    if (nodes.osc2.type !== (oscState.type2 || oscState.type)) nodes.osc2.type = oscState.type2 || oscState.type;
    
    // WaveShaper Update
    nodes.shaper.curve = createShaperCurve(
      oscState.crestValleyRatio ?? 1.0,
      oscState.dutyCycle ?? 0,
      oscState.harmonicDistortion ?? 0
    );

    // Angular Phase Shift Update (DelayNode)
    const phaseDeg = oscState.phaseOffset || 0;
    const delayTime = phaseDeg > 0 ? (phaseDeg / 360) / Math.max(0.1, oscState.frequency) : 0;
    nodes.delay.delayTime.setTargetAtTime(delayTime, now, tau);

    // Crossfade Mix (Equal Power)
    const mix = oscState.typeMix || 0;
    const gain1Value = Math.cos(mix * 0.5 * Math.PI);
    const gain2Value = Math.sin(mix * 0.5 * Math.PI);
    
    nodes.gain1.gain.setTargetAtTime(gain1Value, now, tau);
    nodes.gain2.gain.setTargetAtTime(gain2Value, now, tau);

    // Freq & Vol
    const clampedFreq = Math.max(0.1, Math.min(20000, oscState.frequency));
    nodes.osc1.frequency.setTargetAtTime(clampedFreq, now, tau);
    nodes.osc2.frequency.setTargetAtTime(clampedFreq, now, tau);
    
    nodes.mainGain.gain.setTargetAtTime(oscState.isPlaying ? oscState.volume : 0, now, tau);
    
    // 3D Position
    if (nodes.panner.positionX) {
      nodes.panner.positionX.setTargetAtTime(oscState.panX * SPATIAL_SCALE, now, tau);
      nodes.panner.positionY.setTargetAtTime(oscState.panY * SPATIAL_SCALE, now, tau);
      nodes.panner.positionZ.setTargetAtTime(oscState.panZ * -SPATIAL_SCALE, now, tau);
    }

    // Reconnect ONLY if independent routing actually changed (prevents micro-clicks during smooth modulation)
    const wantIndependent = Boolean(oscState.isIndependent);
    if (nodes.isIndependent !== wantIndependent) {
      try {
          nodes.analyser.disconnect();
          if (wantIndependent) {
              nodes.analyser.connect(masterGainRef.current);
          } else {
              nodes.analyser.connect(combinedGainRef.current);
          }
          nodes.isIndependent = wantIndependent;
      } catch (e) { console.error("Routing update error", e); }
    }
  };

  const getMasterAnalyser = () => masterAnalyserRef.current;
  const getCombinedAnalyser = () => combinedAnalyserRef.current;
  const getOscillatorAnalyser = (id: string) => nodesRef.current.get(id)?.analyser;

  // Global Adjustments
  const setGlobalVolume = (vol: number) => {
    commitOscillators(prev => prev.map(o => {
      const updated = { ...o, volume: vol };
      updateOscillatorNodes(updated);
      return updated;
    }));
  };

  const centerAllPositions = () => {
    commitOscillators(prev => prev.map(o => {
      const updated = { 
        ...o, 
        panX: 0, 
        panY: 0, 
        panZ: 0,
        crestValleyRatio: 1.0,
        dutyCycle: 0,
        harmonicDistortion: 0,
        phaseOffset: 0
      };
      updateOscillatorNodes(updated);
      return updated;
    }));
  };

  const setGlobalWaveType = (type: WaveType) => {
    commitOscillators(prev => prev.map(o => {
      const updated = { ...o, type };
      updateOscillatorNodes(updated);
      return updated;
    }));
  };

  const normalizeTargetOsc = (raw: Partial<OscillatorState>, idx: number): OscillatorState => ({
    id: raw.id || crypto.randomUUID(),
    frequency: Math.max(0.1, Math.min(20000, Number(raw.frequency) || 432)),
    type: raw.type || 'sine',
    volume: raw.volume !== undefined ? Math.max(0, Math.min(1, Number(raw.volume))) : 0.45,
    panX: raw.panX ?? 0,
    panY: raw.panY ?? 0,
    panZ: raw.panZ ?? 0,
    crestValleyRatio: raw.crestValleyRatio ?? 1.0,
    dutyCycle: raw.dutyCycle ?? 0,
    harmonicDistortion: raw.harmonicDistortion ?? 0,
    phaseOffset: raw.phaseOffset ?? 0,
    type2: raw.type2,
    typeMix: raw.typeMix,
    isPlaying: raw.isPlaying !== undefined ? raw.isPlaying : true,
    name: raw.name || `Capa ${idx + 1}`,
    isIndependent: Boolean(raw.isIndependent),
    color: raw.color || '#38bdf8',
    transition: raw.transition,
  });

  // Zero-interruption live oscillator morphing (smoothly glides frequencies, positions, gains)
  const morphOscillatorsLive = (
    incoming: Partial<OscillatorState>[],
    options?: { mode?: 'morph' | 'blend' | 'replace'; glideSec?: number; autoPlay?: boolean }
  ): OscillatorState[] => {
    initAudio();
    if (options?.autoPlay !== false && audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }

    const mode = options?.mode || 'morph';
    const glideSec = Math.max(0.08, Math.min(4.0, options?.glideSec ?? 0.65));
    const tau = Math.max(0.03, glideSec / 3);
    const current = oscillatorsRef.current;

    if (mode === 'blend') {
      const added = incoming.slice(0, Math.max(0, 21 - current.length)).map((o, i) =>
        normalizeTargetOsc(o, current.length + i)
      );
      added.forEach((osc) => createOscillatorNodes(osc, tau));
      const merged = [...current, ...added];
      commitOscillators(merged);
      return merged;
    }

    const nextList: OscillatorState[] = [];
    const targetSlice = incoming.slice(0, 21);
    const reuseCount = Math.min(current.length, targetSlice.length);

    for (let i = 0; i < reuseCount; i++) {
      const existing = current[i];
      const normalized = normalizeTargetOsc(targetSlice[i], i);
      const morphed: OscillatorState = {
        ...normalized,
        id: existing.id, // Reuse WebAudio AudioNodeRefs seamlessly without click!
      };
      if (nodesRef.current.has(morphed.id)) {
        updateOscillatorNodes(morphed, tau);
      } else {
        createOscillatorNodes(morphed, tau);
      }
      nextList.push(morphed);
    }

    for (let i = reuseCount; i < targetSlice.length; i++) {
      const added = normalizeTargetOsc(targetSlice[i], i);
      createOscillatorNodes(added, tau);
      nextList.push(added);
    }

    // Fade out surplus oscillators smoothly rather than hard-cutting them
    const fadeOutMs = Math.round(glideSec * 1000) + 80;
    for (let i = targetSlice.length; i < current.length; i++) {
      destroyOscillatorNodes(current[i].id, fadeOutMs);
    }

    commitOscillators(nextList);
    return nextList;
  };

  // Real-time uninterrupted adjustments dispatched by Cronos AI or live controls
  const applyLiveAdjustment = async (cmd: LiveAudioAdjustmentCommand): Promise<string> => {
    initAudio();
    const glideSec = 'glideSec' in cmd && cmd.glideSec ? cmd.glideSec : 0.45;
    const tau = Math.max(0.03, glideSec / 3);

    switch (cmd.type) {
      case 'toggle_playback': {
        if (!audioCtxRef.current) return 'Audio no disponible.';
        const wantPlay = cmd.playing !== undefined ? cmd.playing : audioCtxRef.current.state !== 'running';
        if (wantPlay && audioCtxRef.current.state !== 'running') {
          await audioCtxRef.current.resume();
          setIsPlaying(true);
          return 'Reproducción activada sin cortes.';
        }
        if (!wantPlay && audioCtxRef.current.state === 'running') {
          await audioCtxRef.current.suspend();
          setIsPlaying(false);
          return 'Audio en pausa.';
        }
        return wantPlay ? 'Audio en curso.' : 'Audio ya pausado.';
      }

      case 'set_master': {
        if (cmd.volume !== undefined) {
          const v = Math.max(0, Math.min(1.5, Number(cmd.volume)));
          setMasterVolume(v);
          if (masterGainRef.current && audioCtxRef.current) {
            masterGainRef.current.gain.setTargetAtTime(v, audioCtxRef.current.currentTime, 0.08);
          }
        }
        if (cmd.filter) {
          updateMasterFilter(cmd.filter);
        }
        return `Nivel maestro ajustado (${cmd.volume !== undefined ? `${Math.round(cmd.volume * 100)}%` : 'filtro'}).`;
      }

      case 'harmonic_shift': {
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          await audioCtxRef.current.resume().catch(() => {});
        }
        const ratio = cmd.ratio && cmd.ratio > 0 ? cmd.ratio : 1;
        const delta = cmd.deltaHz ?? 0;
        commitOscillators(prev => prev.map(o => {
          const nextFreq = Math.max(0.1, Math.min(20000, Number((o.frequency * ratio + delta).toFixed(3))));
          const updated = { ...o, frequency: nextFreq };
          updateOscillatorNodes(updated, tau);
          return updated;
        }));
        return `Frecuencias moduladas en vivo (×${ratio.toFixed(4)}${delta ? ` +${delta}Hz` : ''}).`;
      }

      case 'update_layer': {
        const list = oscillatorsRef.current;
        const target =
          (cmd.id && list.find(o => o.id === cmd.id)) ||
          (cmd.index !== undefined ? list[cmd.index] : list[0]);
        if (!target) return 'No hay oscilador destino.';
        commitOscillators(prev => prev.map(o => {
          if (o.id !== target.id) return o;
          const updated = { ...o, ...cmd.changes };
          updateOscillatorNodes(updated, tau);
          return updated;
        }));
        return `Capa "${target.name}" actualizada en tiempo real.`;
      }

      case 'add_layer': {
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          await audioCtxRef.current.resume().catch(() => {});
        }
        const layer = normalizeTargetOsc(cmd.oscillator, oscillatorsRef.current.length);
        createOscillatorNodes(layer, tau);
        commitOscillators(prev => [...prev, layer]);
        return `Capa ${layer.frequency} Hz agregada suavemente.`;
      }

      case 'remove_layer': {
        const list = oscillatorsRef.current;
        const target =
          (cmd.id && list.find(o => o.id === cmd.id)) ||
          (cmd.index !== undefined ? list[cmd.index] : list[list.length - 1]);
        if (!target) return 'No hay capa por retirar.';
        commitOscillators(prev => prev.filter(o => o.id !== target.id));
        destroyOscillatorNodes(target.id, Math.round(glideSec * 1000));
        return `Capa "${target.name}" desvanecida limpiamente.`;
      }

      case 'set_spatial_spread': {
        const spread = Math.max(0, Math.min(1, cmd.spread));
        const list = oscillatorsRef.current;
        commitOscillators(prev => prev.map((o, idx) => {
          const angle = list.length <= 1 ? 0 : (idx / list.length) * Math.PI * 2;
          const updated = {
            ...o,
            panX: Number((Math.cos(angle) * spread).toFixed(2)),
            panY: Number((Math.sin(angle * 2) * spread * 0.5).toFixed(2)),
            panZ: Number((Math.sin(angle) * spread * 0.8).toFixed(2)),
          };
          updateOscillatorNodes(updated, tau);
          return updated;
        }));
        return `Campo espacial 3D ajustado a dispersión ${Math.round(spread * 100)}%.`;
      }

      case 'launch_transition': {
        const dur = Math.max(2, Math.min(300, cmd.duration ?? 21));
        const ratio = cmd.endShiftRatio ?? 1.618;
        commitOscillators(prev => prev.map(o => ({
          ...o,
          transition: {
            enabled: true,
            isPlaying: true,
            duration: dur,
            loopCount: cmd.loopCount ?? 'infinite',
            progress: 0,
            currentLoop: 0,
            direction: 'forward',
            start: {
              frequency: o.frequency,
              volume: o.volume,
              panX: o.panX,
              panY: o.panY,
              panZ: o.panZ,
              type: o.type,
            },
            end: {
              frequency: Math.max(0.5, Math.min(20000, Number((o.frequency * ratio).toFixed(2)))),
              volume: o.volume,
              panX: -o.panX,
              panY: o.panY,
              panZ: -o.panZ,
              type: o.type2 || 'triangle',
            },
          },
        })));
        return `Transición evolutiva activada (${dur}s · relación ×${ratio}).`;
      }
    }
  };

  // --- Transition Loop ---
  const lastTimeRef = useRef<number>(0);
  const reqFrameRef = useRef<number>(0);

  useEffect(() => {
    const loop = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const dt = (time - lastTimeRef.current) / 1000; // in seconds
      lastTimeRef.current = time;

      setOscillators(prev => {
        let hasChanges = false;
        const next = prev.map(osc => {
          if (!osc.transition || !osc.transition.enabled || !osc.transition.isPlaying) {
            return osc;
          }

          const t = osc.transition;
          const step = dt / Math.max(t.duration, 0.1); // avoid division by zero
          let newProgress = t.progress + (t.direction === 'forward' ? step : -step);
          let newDirection = t.direction;
          let newLoop = t.currentLoop;
          let isPlaying = t.isPlaying;

          if (newProgress >= 1) {
            newProgress = 1;
            if (t.loopCount === 'infinite' || newLoop < t.loopCount) {
              newDirection = 'backward';
              newLoop++;
            } else {
              isPlaying = false;
            }
          } else if (newProgress <= 0) {
            newProgress = 0;
            if (t.loopCount === 'infinite' || newLoop < t.loopCount) {
              newDirection = 'forward';
              newLoop++;
            } else {
              isPlaying = false;
            }
          }

          if (
            newProgress !== t.progress || 
            newDirection !== t.direction || 
            newLoop !== t.currentLoop || 
            isPlaying !== t.isPlaying
          ) {
            hasChanges = true;
            
            const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
            
            const updatedOsc = {
              ...osc,
              frequency: lerp(t.start.frequency, t.end.frequency, newProgress),
              volume: lerp(t.start.volume, t.end.volume, newProgress),
              panX: lerp(t.start.panX, t.end.panX, newProgress),
              panY: lerp(t.start.panY, t.end.panY, newProgress),
              panZ: lerp(t.start.panZ, t.end.panZ, newProgress),
              type: t.start.type,
              type2: t.end.type,
              typeMix: newProgress,
              transition: {
                ...t,
                progress: newProgress,
                direction: newDirection,
                currentLoop: newLoop,
                isPlaying
              }
            };
            
            updateOscillatorNodes(updatedOsc);
            return updatedOsc;
          }

          return osc;
        });

        if (hasChanges) {
          oscillatorsRef.current = next;
          return next;
        }
        return prev;
      });

      reqFrameRef.current = requestAnimationFrame(loop);
    };

    reqFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(reqFrameRef.current);
  }, []);

  const syncFromRemote = (remoteOscillators: OscillatorState[]) => {
    initAudio();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    if (!Array.isArray(remoteOscillators)) return;

    const remoteIds = new Set(remoteOscillators.map(o => o.id));
    nodesRef.current.forEach((nodes, id) => {
      if (!remoteIds.has(id)) {
        try {
          nodes.osc1.stop();
          nodes.osc2.stop();
          nodes.osc1.disconnect();
          nodes.osc2.disconnect();
          nodes.gain1.disconnect();
          nodes.gain2.disconnect();
          nodes.mainGain.disconnect();
        } catch (e) {}
        nodesRef.current.delete(id);
      }
    });

    remoteOscillators.forEach(remoteOsc => {
      const existing = nodesRef.current.get(remoteOsc.id);
      if (!existing) {
        createOscillatorNodes(remoteOsc);
      } else {
        updateOscillatorNodes(remoteOsc);
      }
    });

    setOscillators(remoteOscillators);
    oscillatorsRef.current = remoteOscillators;
  };

  const loadPreset = (presetContent: { oscillators: OscillatorState[] }) => {
    if (presetContent && Array.isArray(presetContent.oscillators)) {
      syncFromRemote(presetContent.oscillators);
    }
  };

  return {
    isPlaying,
    oscillators,
    masterVolume,
    masterFilter,
    analyser: masterAnalyserRef.current,
    updateMasterVolume,
    updateMasterFilter,
    toggleMasterPlay,
    addOscillator,
    removeOscillator,
    updateOscillator,
    setAllOscillators,
    syncFromRemote,
    loadPreset,
    morphOscillatorsLive,
    applyLiveAdjustment,
    getMasterAnalyser,
    getCombinedAnalyser,
    getOscillatorAnalyser,
    setGlobalVolume,
    centerAllPositions,
    setGlobalWaveType
  };
};

