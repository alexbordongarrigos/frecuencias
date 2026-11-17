import { useState, useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import { OscillatorState } from '../types';

const PHI = 1.618033988749895;
const GOLDEN_ANGLE = 137.50776405003785; // 360 / phi^2

export interface ChromaticState {
  hue1: number;          // 0..360 primary harmonic hue
  hue2: number;          // 0..360 golden-angle secondary hue
  hue3: number;          // 0..360 conjugate golden-angle tertiary hue
  energy: number;        // 0..1 normalized instantaneous audio energy
  playerEnergy: number;  // 0..1 synthesizer player energy
  micEnergy: number;     // 0..1 live microphone energy
  dominantHz: number;    // Estimated dominant/centroid Hz driving color
  harmonicRatio: number; // Ratio between peak & secondary harmonic (or phi drift)
}

export interface UseChromaticMorphReturn {
  micEnabled: boolean;
  micActive: boolean;
  micError: string | null;
  toggleMic: () => Promise<void>;
  chromaticState: ChromaticState;
  stateRef: MutableRefObject<ChromaticState>;
}

// Convert HSL (h: 0..360, s: 0..100, l: 0..100) to WCAG relative luminance (0..1)
function hslLuminance(h: number, s: number, l: number): number {
  const sn = s / 100;
  const ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return color <= 0.03928 ? color / 12.92 : Math.pow((color + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(0) + 0.7152 * f(8) + 0.0722 * f(4);
}

// Shortest-path circular hue interpolation (0..360) with calm angular velocity cap
function lerpHue(current: number, target: number, alpha: number, maxStep = 1.8): number {
  const diff = ((target - current + 540) % 360) - 180;
  const rawStep = diff * alpha;
  const step = Math.max(-maxStep, Math.min(maxStep, rawStep));
  return (current + step + 360) % 360;
}

// Perceptually safe pastel/neon lightness on dark obsidian-glass surfaces (>= 7:1 contrast)
function safeNeonTextLightness(hue: number): number {
  const lumAt70 = hslLuminance(hue, 88, 70);
  if (lumAt70 < 0.35) return 78; // Blue / violet / crimson get brighter boost
  if (lumAt70 > 0.62) return 66; // Yellow-green / cyan stay saturated without blowing out
  return 72;
}

// Frequency (Hz) -> Harmonic Hue with vivid octave dispersion anchored at 432 Hz -> 175°
function frequencyToHue(hz: number, phaseOffset: number): number {
  const safeHz = Math.max(1, Math.min(22000, hz));
  const harmonicAngle = Math.log2(safeHz / 432) * 412 + 175;
  return (((harmonicAngle + phaseOffset) % 360) + 360) % 360;
}

export function useChromaticMorph(
  oscillators: OscillatorState[],
  isMasterPlaying: boolean,
  getPlayerAnalyser: () => AnalyserNode | null
): UseChromaticMorphReturn {
  const [micEnabled, setMicEnabled] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const initialState: ChromaticState = {
    hue1: 168,
    hue2: (168 + GOLDEN_ANGLE) % 360,
    hue3: (168 + GOLDEN_ANGLE * PHI) % 360,
    energy: 0.18,
    playerEnergy: 0,
    micEnergy: 0,
    dominantHz: 432,
    harmonicRatio: PHI,
  };

  const [chromaticState, setChromaticState] = useState<ChromaticState>(initialState);
  const stateRef = useRef<ChromaticState>(initialState);

  const oscillatorsRef = useRef(oscillators);
  oscillatorsRef.current = oscillators;

  const isMasterPlayingRef = useRef(isMasterPlaying);
  isMasterPlayingRef.current = isMasterPlaying;

  const getPlayerAnalyserRef = useRef(getPlayerAnalyser);
  getPlayerAnalyserRef.current = getPlayerAnalyser;

  const micStreamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micFreqBufRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const micTimeBufRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const playerFreqBufRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const smoothedMicHzRef = useRef<number>(432);
  const lastMicActiveTimeRef = useRef<number>(0);
  const heldMicHzRef = useRef<number>(0);
  const heldMicEnergyRef = useRef<number>(0);

  const stopMic = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (micCtxRef.current) {
      micCtxRef.current.close().catch(() => {});
      micCtxRef.current = null;
    }
    micAnalyserRef.current = null;
    micFreqBufRef.current = null;
    micTimeBufRef.current = null;
    lastMicActiveTimeRef.current = 0;
    heldMicHzRef.current = 0;
    heldMicEnergyRef.current = 0;
    setMicActive(false);
    setMicEnabled(false);
  }, []);

  const toggleMic = useCallback(async () => {
    if (micEnabled) {
      stopMic();
      setMicError(null);
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMicError('Micrófono no disponible en este navegador.');
      return;
    }

    try {
      setMicError(null);
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.80;
      source.connect(analyser);

      micStreamRef.current = stream;
      micCtxRef.current = ctx;
      micAnalyserRef.current = analyser;
      micFreqBufRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      micTimeBufRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));
      setMicEnabled(true);
      setMicActive(true);
    } catch (err) {
      stopMic();
      const msg = err instanceof Error ? err.message : 'Permiso de micrófono denegado';
      setMicError(msg.includes('Permission') || msg.includes('NotAllowed')
        ? 'Permiso de micrófono denegado'
        : 'No se pudo activar el micrófono');
    }
  }, [micEnabled, stopMic]);

  useEffect(() => {
    return () => {
      stopMic();
    };
  }, [stopMic]);

  useEffect(() => {
    let rafId = 0;
    let lastReactSync = 0;
    let lastCssSync = 0;
    const startTime = performance.now();

    const applyCssVariables = (s: ChromaticState) => {
      const root = document.documentElement.style;
      const h1 = s.hue1.toFixed(1);
      const h2 = s.hue2.toFixed(1);
      const h3 = s.hue3.toFixed(1);
      const textL1 = safeNeonTextLightness(s.hue1);
      const textL2 = safeNeonTextLightness(s.hue2);

      // Compute safe foreground color on solid filled accent surfaces (L=45%, S=86%)
      const accentBgLum = hslLuminance(s.hue1, 86, 45);
      const onAccent = accentBgLum > 0.34 ? '#050811' : '#f8fafc';

      root.setProperty('--morph-hue-1', h1);
      root.setProperty('--morph-hue-2', h2);
      root.setProperty('--morph-hue-3', h3);
      root.setProperty('--morph-energy', s.energy.toFixed(3));
      root.setProperty('--morph-text-l1', `${textL1}%`);
      root.setProperty('--morph-text-l2', `${textL2}%`);
      root.setProperty('--morph-on-accent', onAccent);
      root.setProperty('--morph-glow-alpha', (0.22 + s.energy * 0.34).toFixed(3));
    };

    // Apply initial variables immediately
    applyCssVariables(stateRef.current);

    const tick = (now: number) => {
      const elapsedSec = (now - startTime) * 0.001;

      // 1. Analyze active oscillators from synthesizer (only when master player is actively playing)
      const activeOscs = isMasterPlayingRef.current
        ? oscillatorsRef.current.filter((o) => o.isPlaying && !o.isMuted)
        : [];
      let oscWeightedHz = 0;
      let oscTotalWeight = 0;
      for (let i = 0; i < activeOscs.length; i++) {
        const w = Math.max(0.05, activeOscs[i].volume);
        oscWeightedHz += activeOscs[i].frequency * w;
        oscTotalWeight += w;
      }
      const oscCentroidHz = oscTotalWeight > 0 ? oscWeightedHz / oscTotalWeight : 0;

      // 2. Sample player FFT analyser if playing
      let playerEnergy = 0;
      let playerFftHz = 0;
      const playerAnalyser = getPlayerAnalyserRef.current?.();
      if (playerAnalyser && (isMasterPlayingRef.current || activeOscs.length > 0)) {
        if (!playerFreqBufRef.current || playerFreqBufRef.current.length !== playerAnalyser.frequencyBinCount) {
          playerFreqBufRef.current = new Uint8Array(new ArrayBuffer(playerAnalyser.frequencyBinCount));
        }
        const buf = playerFreqBufRef.current;
        playerAnalyser.getByteFrequencyData(buf);
        let sumSq = 0;
        let maxVal = 0;
        let maxIdx = 0;
        const binHz = (playerAnalyser.context?.sampleRate || 44100) / (playerAnalyser.fftSize || 2048);
        for (let i = 1; i < buf.length; i++) {
          const v = buf[i] / 255;
          sumSq += v * v;
          if (buf[i] > maxVal) {
            maxVal = buf[i];
            maxIdx = i;
          }
        }
        playerEnergy = Math.min(1, Math.sqrt(sumSq / Math.max(1, buf.length * 0.16)) * 2.2);
        if (maxVal > 8) {
          playerFftHz = maxIdx * binHz;
        }
      }
      if (activeOscs.length > 0 && playerEnergy < 0.15) {
        playerEnergy = Math.max(playerEnergy, Math.min(1, oscTotalWeight / Math.max(1, activeOscs.length)));
      }

      // 3. Sample microphone FFT & time-domain RMS analyser if enabled
      let micEnergy = 0;
      let micDominantHz = 0;
      const micAnalyser = micAnalyserRef.current;
      const micBuf = micFreqBufRef.current;
      const micTimeBuf = micTimeBufRef.current;
      if (micAnalyser && micBuf) {
        micAnalyser.getByteFrequencyData(micBuf);
        const sampleRate = micCtxRef.current?.sampleRate || 48000;
        const binHz = sampleRate / micAnalyser.fftSize;
        let sumEnergy = 0;
        let weightedHz = 0;
        let maxMag = 0;
        let peakIdx = 0;
        // Focus on 40 Hz .. 6000 Hz musical/vocal range
        const minBin = Math.max(1, Math.floor(40 / binHz));
        const maxBin = Math.min(micBuf.length - 1, Math.ceil(6000 / binHz));
        for (let i = minBin; i <= maxBin; i++) {
          const v = micBuf[i] / 255;
          if (v > 0.02) {
            const p = v * v;
            sumEnergy += p;
            weightedHz += i * binHz * p;
            if (v > maxMag) {
              maxMag = v;
              peakIdx = i;
            }
          }
        }

        let timeRms = 0;
        if (micTimeBuf) {
          micAnalyser.getByteTimeDomainData(micTimeBuf);
          let tSum = 0;
          for (let i = 0; i < micTimeBuf.length; i++) {
            const norm = (micTimeBuf[i] - 128) / 128;
            tSum += norm * norm;
          }
          timeRms = Math.sqrt(tSum / Math.max(1, micTimeBuf.length));
        }

        const fftRms = Math.min(1, Math.sqrt(sumEnergy / Math.max(1, (maxBin - minBin) * 0.06)) * 2.4);
        const combinedMicRms = Math.min(1, Math.max(fftRms, timeRms * 3.5));

        if (combinedMicRms > 0.015 && (sumEnergy > 0.004 || timeRms > 0.012)) {
          micEnergy = combinedMicRms;
          let peakHz = peakIdx > 0 ? peakIdx * binHz : smoothedMicHzRef.current;
          if (peakIdx > minBin && peakIdx < maxBin) {
            const left = micBuf[peakIdx - 1];
            const center = micBuf[peakIdx];
            const right = micBuf[peakIdx + 1];
            const denom = 2 * (2 * center - left - right);
            if (Math.abs(denom) > 0.001) {
              const delta = (left - right) / denom;
              peakHz = (peakIdx + Math.max(-0.5, Math.min(0.5, delta))) * binHz;
            }
          }
          const centroidHz = sumEnergy > 0 ? weightedHz / sumEnergy : peakHz;
          const rawMicHz = peakIdx > 0 ? peakHz * 0.65 + centroidHz * 0.35 : centroidHz;
          smoothedMicHzRef.current += (rawMicHz - smoothedMicHzRef.current) * 0.18;
          micDominantHz = smoothedMicHzRef.current;
          lastMicActiveTimeRef.current = now;
          heldMicHzRef.current = micDominantHz;
          heldMicEnergyRef.current = micEnergy;
        } else if (lastMicActiveTimeRef.current > 0 && now - lastMicActiveTimeRef.current < 4000 && heldMicHzRef.current > 0) {
          // Hold mic chromatic tone gracefully between pauses/syllables for liquid calm UX
          const decay = 1 - (now - lastMicActiveTimeRef.current) / 4000;
          micDominantHz = heldMicHzRef.current;
          micEnergy = heldMicEnergyRef.current * decay * 0.55;
        }
      }

      // 4. Derive calm, organic + audio-driven target hues using Solarpunk Solfeggio/Golden-Ratio progression
      const idlePhase =
        (elapsedSec * 2.4 +
          Math.sin(elapsedSec * 0.11) * 28 +
          Math.cos(elapsedSec * 0.11 / PHI) * 18 +
          175) %
        360;

      const combinedEnergy = Math.min(1, Math.max(playerEnergy, micEnergy * 1.15) + Math.min(playerEnergy, micEnergy) * 0.25);
      const effectivePlayerHz = oscCentroidHz > 0 ? oscCentroidHz : playerFftHz;

      let targetHz = stateRef.current.dominantHz;
      let targetHue1 = (idlePhase + 360) % 360;

      if (effectivePlayerHz > 0 && micDominantHz > 0) {
        const pWeight = Math.max(0.25, playerEnergy);
        const mWeight = Math.max(0.3, micEnergy * 1.3);
        targetHz = (effectivePlayerHz * pWeight + micDominantHz * mWeight) / (pWeight + mWeight);
        targetHue1 = frequencyToHue(targetHz, Math.sin(elapsedSec * 0.22) * 10);
      } else if (micDominantHz > 0) {
        targetHz = micDominantHz;
        targetHue1 = frequencyToHue(targetHz, Math.sin(elapsedSec * 0.24) * 12);
      } else if (effectivePlayerHz > 0) {
        targetHz = effectivePlayerHz;
        targetHue1 = frequencyToHue(targetHz, Math.sin(elapsedSec * 0.20) * 8);
      } else {
        targetHz = 432 + Math.sin(elapsedSec * 0.15) * 48;
      }

      // Harmonic ratio (pair ratio or phi modulation)
      let harmonicRatio = PHI;
      if (activeOscs.length >= 2) {
        const low = Math.min(activeOscs[0].frequency, activeOscs[1].frequency);
        const high = Math.max(activeOscs[0].frequency, activeOscs[1].frequency);
        harmonicRatio = low > 0 ? high / low : PHI;
      } else if (effectivePlayerHz > 0 && micDominantHz > 0) {
        const low = Math.min(effectivePlayerHz, micDominantHz);
        const high = Math.max(effectivePlayerHz, micDominantHz);
        harmonicRatio = low > 0 ? high / low : PHI;
      }

      // Golden-angle harmonic spread modulated calmly by harmonic ratio & energy
      const harmonicSpreadShift = Math.sin(harmonicRatio * Math.PI) * (14 + combinedEnergy * 16);
      const targetHue2 = (targetHue1 + GOLDEN_ANGLE + harmonicSpreadShift + 360) % 360;
      const targetHue3 = (targetHue1 + GOLDEN_ANGLE * PHI - harmonicSpreadShift * 0.5 + 360) % 360;

      const prev = stateRef.current;
      const isAudioActive = combinedEnergy > 0.04 || micDominantHz > 0 || effectivePlayerHz > 0;
      const hueSmoothing = isAudioActive ? 0.045 : 0.012;
      const maxStep = isAudioActive ? 1.85 : 0.35;
      const nextHue1 = lerpHue(prev.hue1, targetHue1, hueSmoothing, maxStep);
      const nextHue2 = lerpHue(prev.hue2, targetHue2, hueSmoothing * 0.92, maxStep * 0.92);
      const nextHue3 = lerpHue(prev.hue3, targetHue3, hueSmoothing * 0.86, maxStep * 0.86);
      const nextEnergy = prev.energy + (Math.max(0.14, combinedEnergy) - prev.energy) * 0.12;

      const nextState: ChromaticState = {
        hue1: nextHue1,
        hue2: nextHue2,
        hue3: nextHue3,
        energy: nextEnergy,
        playerEnergy,
        micEnergy,
        dominantHz: prev.dominantHz + (targetHz - prev.dominantHz) * 0.14,
        harmonicRatio,
      };
      stateRef.current = nextState;

      // Update CSS variables at ~30fps for silky fluid UI morphing
      if (now - lastCssSync > 32) {
        lastCssSync = now;
        applyCssVariables(nextState);
      }

      // Sync React HUD state cleanly (~4.5fps, CSS vars animate smoothly at 30fps without React overhead)
      if (now - lastReactSync > 220) {
        lastReactSync = now;
        setChromaticState(nextState);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return {
    micEnabled,
    micActive,
    micError,
    toggleMic,
    chromaticState,
    stateRef,
  };
}
