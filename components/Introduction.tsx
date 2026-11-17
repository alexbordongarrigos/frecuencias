import React, { useState } from 'react';
import Icon from './Icon';
import Visualizer from './Visualizer';
import CymaticsVisualizer3D from './CymaticsVisualizer3D';
import SpiralVisualizer from './SpiralVisualizer';
import { useAudio } from '../hooks/useAudio';
import { DOWNLOAD_LINKS, DetectedOS } from './LandingPage';
import LanguageSelector from './LanguageSelector';
import { LangCode } from '../utils/i18n';

export interface IntroductionProps {
  onNavigate?: (tab: 'library' | 'generator' | 'online') => void;
  onQuickTune?: (hz: number, name: string) => void;
  audio?: ReturnType<typeof useAudio>;
  micEnabled?: boolean;
  micActive?: boolean;
  micError?: string | null;
  onToggleMic?: () => void;
  dominantHz?: number;
  harmonicRatio?: number;
  currentLang?: LangCode;
  onChangeLang?: (lang: LangCode) => void;
}

interface HarmonicPreset {
  id: string;
  name: string;
  hz: number;
  hzLabel: string;
  formula: string;
}

const HARMONIC_PRESETS: HarmonicPreset[] = [
  { id: 'schumann', name: 'Cavidad Schumann', hz: 7.83, hzLabel: '7.83 Hz', formula: 'f₀ = c / (2π·R⊕)' },
  { id: 'diapason', name: 'Diapasón Cosmogónico', hz: 432, hzLabel: '432 Hz', formula: '2⁴ × 3³ · A₄' },
  { id: 'solfeggio', name: 'Tono de Regeneración', hz: 528, hzLabel: '528 Hz', formula: 'MI · 5+2+8 = 6' },
  { id: 'golden', name: 'Proporción Áurea φ', hz: 699, hzLabel: '699 Hz', formula: '432 × φ (1.618)' },
  { id: 'vortex', name: 'Armónico Vórtex 3-6-9', hz: 369, hzLabel: '369 Hz', formula: 'Terna 3 · 6 · 9' },
];

type StageViewMode = 'triad' | '2d' | '3d' | 'spiral';

interface SystemPillar {
  id: string;
  iconName: string;
  title: string;
  badge: string;
  description: string;
  highlights: string[];
  accentText: string;
  targetTab: 'library' | 'generator' | 'online';
  actionLabel: string;
}

const SYSTEM_PILLARS: SystemPillar[] = [
  {
    id: 'spectrometer',
    iconName: 'Activity',
    title: 'Espectrómetro & Síntesis Multi-Onda',
    badge: 'Dinámica Ondulatoria',
    description:
      'Sintetiza osciladores acoplados en tiempo real con modulación independiente de crestas y valles, asimetría de ciclo útil, proyección espacial 3D (X/Y/Z) y clasificación física automática de interferencia.',
    highlights: ['Asimetría Cresta / Valle', 'Campo Espacial 3D', 'Binaural, AM, Fase y Heterodino'],
    accentText: 'morph-accent-text',
    targetTab: 'generator',
    actionLabel: 'Abrir Espectrómetro'
  },
  {
    id: 'cymatics',
    iconName: 'Orbit',
    title: 'Morfología Nodal Chladni & Espiral φ',
    badge: 'Física de Ondas Estacionarias',
    description:
      'Calcula superficies nodales Chladni tridimensionales bajo excitación acústica y proyecta espirales logarítmicas áureas (φ) en el plano complejo sincronizadas con los armónicos activos.',
    highlights: ['Placas Nodales Chladni 3D', 'Progresión Áurea Compleja φ', 'Simetría de Fase'],
    accentText: 'morph-accent-text-2',
    targetTab: 'generator',
    actionLabel: 'Proyectar Cimática'
  },
  {
    id: 'particles',
    iconName: 'Atom',
    title: 'Taxonomía Espectral & Bio-Resonancia',
    badge: '15+ Dominios Frecuenciales',
    description:
      'Compendio de frecuencias Solfeggio, resonancias ionosféricas Schumann, octavas planetarias de Cousto, protocolos Nogier/Rife, biofísica celular, arqueoacústica megalítica y acoplamientos multi-oscilador.',
    highlights: ['Solfeggio & Schumann', 'Rife, Nogier y Biofísica', 'Acoplamientos Armónicos'],
    accentText: 'morph-accent-text',
    targetTab: 'library',
    actionLabel: 'Explorar Librería'
  },
  {
    id: 'radiation',
    iconName: 'Radio',
    title: 'Transducción Física & Espectro Óptico',
    badge: 'Telemetría Energética',
    description:
      'Calcula por transposición de octavas el medio físico idóneo (acústico, PEMF, escalar, biofotónico e iónico), su longitud de onda equivalente en nanómetros (nm) y rangos de tensión, corriente y potencia.',
    highlights: ['Acústica, PEMF y Toroidal', 'Equivalencia UV / NIR (nm)', 'Ionización y Plasma'],
    accentText: 'morph-accent-text-2',
    targetTab: 'library',
    actionLabel: 'Ver Parámetros Técnicos'
  },
  {
    id: 'mesh',
    iconName: 'Network',
    title: 'Sincronización Colectiva & Red Mesh P2P',
    badge: 'Coherencia Distribuida',
    description:
      'Establece enlaces WebRTC de sincronía de fase entre múltiples operadores, transmisión local sin red mediante nodos off-grid, enlace radio LoRa Meshtastic y entorno compartido en tiempo real.',
    highlights: ['LoRa Meshtastic & Off-Grid', 'Sincronía de Fase WebRTC', 'Campos Compartidos'],
    accentText: 'morph-accent-text',
    targetTab: 'online',
    actionLabel: 'Conectar a la Red'
  },
  {
    id: 'starseed',
    iconName: 'Sparkles',
    title: 'Identidad & Archivo Soberano StarSeed OS',
    badge: 'Metafísica Operativa',
    description:
      'Persiste jerarquías de presets personales en la nube soberana, publica configuraciones espectrales en el repositorio colectivo y vincula estados de coherencia con tu perfil StarSeed OS.',
    highlights: ['Repositorio Jerárquico', 'Partículas Colectivas', 'Vinculación StarSeed OS'],
    accentText: 'morph-accent-text-2',
    targetTab: 'online',
    actionLabel: 'Explorar Comunidad'
  }
];

interface PhysicalMediumSpec {
  id: 'acustica' | 'electromagnetica' | 'magnetica' | 'fotonica' | 'ionica_plasma';
  title: string;
  shortLabel: string;
  iconName: string;
  accentHex: string;
  badgeClass: string;
  hzRange: string;
  khzRange: string;
  mhzRange: string;
  nmRange: string;
  voltageRange: string;
  amperageRange: string;
  wattsRange: string;
  transducers: string;
  howToHarness: string;
  sampleHz: number;
  sampleName: string;
}

const PHYSICAL_MEDIUMS: PhysicalMediumSpec[] = [
  {
    id: 'acustica',
    title: 'Sonido / Acústica & Vibroacústica',
    shortLabel: 'Acústica',
    iconName: 'Volume2',
    accentHex: '#22d3ee',
    badgeClass: 'border-cyan-400/40 bg-cyan-950/40 text-cyan-200',
    hzRange: '0.5 Hz – 20 kHz',
    khzRange: '1 – 48 kHz (portadora)',
    mhzRange: 'Armónicos indirectos > 1 MHz',
    nmRange: 'Equiv. octava ~480–650 nm',
    voltageRange: '1.2 – 2.8 V RMS (línea / auricular)',
    amperageRange: '40 – 250 mA',
    wattsRange: '0.5 – 5 W (monitores / transductor)',
    transducers: 'Auriculares estéreo L/R (para binaural), monitores de campo cercano o transductores táctiles vibroacústicos.',
    howToHarness:
      'Ideal para frecuencias audibles y diferencias binaurales (< 40 Hz en separación L/R). Mantén un volumen confortable (48–62 dB SPL) y usa transductores sub-graves para ondas Delta/Schumann por debajo de 40 Hz.',
    sampleHz: 432,
    sampleName: '432 Hz · Acústica Armónica Natural'
  },
  {
    id: 'electromagnetica',
    title: 'Electromagnética Pulsada (PEMF)',
    shortLabel: 'PEMF / EM',
    iconName: 'Radio',
    accentHex: '#a855f7',
    badgeClass: 'border-purple-400/40 bg-purple-950/40 text-purple-200',
    hzRange: '0.5 Hz – 150 kHz',
    khzRange: '1 – 150 kHz',
    mhzRange: '1 – 27.12 MHz (RF ISM)',
    nmRange: 'Octava espectral ~450–780 nm',
    voltageRange: '5 – 24 V DC pulsado',
    amperageRange: '250 mA – 1.5 A',
    wattsRange: '3 – 18 W (driver bobina)',
    transducers: 'Bobinas de inducción plana o anillos Helmholtz excitados por amplificador de corriente continua pulsada.',
    howToHarness:
      'Excelente para frecuencias ultrabajas (7.83 Hz Gaia, Delta/Theta) y protocolos Nogier/Rife que requieren penetración tisular sin fatiga auditiva. Ajusta la señal en modo pulso cuadrado o asimétrico para transitorios inductivos nítidos.',
    sampleHz: 7.83,
    sampleName: '7.83 Hz · Pulso PEMF Gaia'
  },
  {
    id: 'magnetica',
    title: 'Magnética / Escalar Toroidal',
    shortLabel: 'Magnética',
    iconName: 'Magnet',
    accentHex: '#818cf8',
    badgeClass: 'border-indigo-400/40 bg-indigo-950/40 text-indigo-200',
    hzRange: '0.1 Hz – 10 kHz',
    khzRange: '1 – 64 kHz (octavas)',
    mhzRange: '1 – 13.56 MHz (armónicos)',
    nmRange: 'Equiv. octava ~490–620 nm',
    voltageRange: '3.3 – 12 V DC',
    amperageRange: '150 – 900 mA',
    wattsRange: '2 – 12 W',
    transducers: 'Bobinas toroidales, devanados bifilares de Tesla o pares de fase opuesta (acoplamiento de fase 180°).',
    howToHarness:
      'Aprovecha la función de desfase (0°–360°) e inversión de cresta/valle del generador para alimentar bobinas bifilares en cancelación vectorial, generando campos magnéticos de baja intensidad altamente coherentes para agua y cristales.',
    sampleHz: 136.1,
    sampleName: '136.10 Hz · Campo Toroidal OM'
  },
  {
    id: 'fotonica',
    title: 'Fotónica UV / Espectro Visible / NIR',
    shortLabel: 'Fotónica UV/NIR',
    iconName: 'Sun',
    accentHex: '#fb7185',
    badgeClass: 'border-rose-400/40 bg-rose-950/40 text-rose-200',
    hzRange: '1 Hz – 50 kHz (envolvente)',
    khzRange: '1 – 50 kHz (modulación PWM)',
    mhzRange: 'Octava RF 10–50 MHz',
    nmRange: '353–410 nm (UV-A) · 630–980 nm (NIR)',
    voltageRange: '3.0 – 12 V DC (driver LED)',
    amperageRange: '300 mA – 1.2 A',
    wattsRange: '3 – 15 W ópticos',
    transducers: 'Matrices LED de espectro estrecho (660 nm rojo, 850 nm infrarrojo cercano, 405 nm violeta) moduladas por audio.',
    howToHarness:
      'Convierte cualquier frecuencia de la librería en su octava óptica equivalente en nanómetros (nm) y úsala como pulso modulador sobre luz roja/NIR para fotobiomodulación mitocondrial o luz violeta/UV-A suave en medios biofotónicos.',
    sampleHz: 528,
    sampleName: '528 Hz · Modulación Biofotónica'
  },
  {
    id: 'ionica_plasma',
    title: 'Iónica / Tubo de Plasma',
    shortLabel: 'Iónica / Plasma',
    iconName: 'Zap',
    accentHex: '#fbbf24',
    badgeClass: 'border-amber-400/40 bg-amber-950/40 text-amber-200',
    hzRange: '10 Hz – 50 kHz (envolvente)',
    khzRange: '2 – 64 kHz (armónico audio)',
    mhzRange: '1 – 50 MHz (portadora RF)',
    nmRange: 'Emisión gas noble 380–750 nm',
    voltageRange: '12 – 24 V driver (HV en tubo)',
    amperageRange: '500 mA – 2.5 A',
    wattsRange: '15 – 45 W',
    transducers: 'Tubos de plasma Phanotron / gas noble (helio, argón, neón) o electrodos de microcorriente iónica modulada.',
    howToHarness:
      'Las frecuencias portadoras altas (> 2 kHz) de bio-resonancia Rife se modulan como envolvente cuadrada o de ciclo útil asimétrico sobre una portadora RF (MHz) que ioniza el gas del tubo, irradiando armónicos acústicos, luminosos y electromagnéticos simultáneos.',
    sampleHz: 369,
    sampleName: '369 Hz · Vórtex Plasma 3-6-9'
  }
];

const PLATFORM_DOWNLOAD_ORDER: { os: DetectedOS; label: string; sub: string; icon: string }[] = [
  { os: 'mac', label: 'macOS', sub: 'Apple Silicon & Intel (.dmg)', icon: 'Apple' },
  { os: 'windows', label: 'Windows', sub: 'Instalador 10/11 (.exe)', icon: 'Monitor' },
  { os: 'linux', label: 'Linux', sub: 'Portable (.AppImage)', icon: 'Terminal' },
  { os: 'android', label: 'Android', sub: 'Nativo Mesh (.apk)', icon: 'Smartphone' },
  { os: 'ios', label: 'iOS / iPadOS', sub: 'Guía PWA WebClip', icon: 'Apple' }
];

const Introduction: React.FC<IntroductionProps> = ({
  onNavigate,
  onQuickTune,
  audio,
  micEnabled = false,
  micActive = false,
  micError = null,
  onToggleMic,
  dominantHz = 432,
  harmonicRatio = 1.618,
  currentLang = 'es',
  onChangeLang,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<HarmonicPreset>(HARMONIC_PRESETS[1]);
  const [stageMode, setStageMode] = useState<StageViewMode>('triad');
  const [selectedMediumId, setSelectedMediumId] = useState<PhysicalMediumSpec['id']>('acustica');
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [showIosModal, setShowIosModal] = useState(false);

  const oscs = audio?.oscillators ?? [];
  const combinedAnalyser = audio ? audio.getCombinedAnalyser() : null;
  const isPlayingLive = Boolean(audio?.isPlaying);
  const playingFreqs = oscs.filter((o) => o.isPlaying).map((o) => o.frequency);
  const activeFreqs = playingFreqs.length > 0 ? playingFreqs : [selectedPreset.hz];

  const visualizerSources =
    oscs.length > 0 && audio
      ? [
          { analyser: combinedAnalyser, color: '#38bdf8' },
          ...oscs
            .filter((o) => o.isPlaying && o.isIndependent)
            .map((o) => ({ analyser: audio.getOscillatorAnalyser(o.id), color: o.color })),
        ]
      : [];

  const activeMedium =
    PHYSICAL_MEDIUMS.find((m) => m.id === selectedMediumId) ?? PHYSICAL_MEDIUMS[0];

  const showTempNotice = (msg: string) => {
    setFeedbackBanner(msg);
    window.setTimeout(() => {
      setFeedbackBanner((curr) => (curr === msg ? null : curr));
    }, 4000);
  };

  const handleNavigateTab = (tab: 'library' | 'generator' | 'online', fallbackLabel: string) => {
    if (onNavigate) {
      onNavigate(tab);
    } else {
      showTempNotice(`Selecciona la pestaña "${fallbackLabel}" en la barra superior para abrir este módulo.`);
    }
  };

  const handleTune = (hz: number, name: string) => {
    if (onQuickTune) {
      onQuickTune(hz, name);
    } else {
      showTempNotice(`Frecuencia seleccionada: ${name} (${hz} Hz). Abre "Espectrómetro" o "Librería" para activarla en el motor WebAudio.`);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 flex flex-col items-center text-center text-slate-200 space-y-14 sm:space-y-20 animate-fade-in">
      {/* ==================== 1. HERO INSTRUMENTACIÓN ONDULATORIA Y PROYECCIÓN 3D ==================== */}
      <section
        aria-labelledby="intro-hero-title"
        className="w-full relative rounded-[2rem] art-nouveau-frame p-5 sm:p-8 lg:p-11 flex flex-col items-center text-center"
      >
        {/* Top Emblem & Live Telemetry Strip */}
        <div className="relative z-20 flex flex-wrap items-center justify-center gap-2.5 mb-5">
          <div className="inline-flex items-center justify-center gap-2.5 px-4 py-1.5 rounded-full bg-black/55 border border-white/15 backdrop-blur-md">
            <img src="/starseed-symbol.png" alt="StarSeed OS" className="w-4 h-4 object-contain" />
            <span className="text-[11px] sm:text-xs font-display font-bold uppercase tracking-[0.18em] starseed-gold-gradient">
              StarSeed OS · Arquitectura de Resonancia Armónica y Biofísica
            </span>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full morph-pill text-[10px] sm:text-[11px] font-mono font-bold">
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            <span>
              {micActive ? 'Espectro Ambiental' : isPlayingLive ? 'Síntesis Activa' : 'Frecuencia Base'}: {Math.round(dominantHz)} Hz · Razón φ {harmonicRatio.toFixed(3)}
            </span>
          </div>

          {onChangeLang && (
            <LanguageSelector currentLang={currentLang} onChangeLang={onChangeLang} compact />
          )}
        </div>

        {/* Scientific / Metaphysical Hero Typography */}
        <div className="max-w-3xl mx-auto space-y-3 mb-6">
          <h2
            id="intro-hero-title"
            className="text-fluid-hero font-display font-black starseed-text-gradient text-balance"
          >
            Síntesis Multi-Onda, Geometría Cimática y Coherencia de Campo
          </h2>
          <p className="text-fluid-subtitle text-slate-200/90 max-w-2xl mx-auto text-pretty">
            Instrumentación acústica, electromagnética y biofotónica para la generación de ondas estacionarias, análisis de interferencia armónica, proyección nodal tridimensional y sincronización resonante colectiva.
          </p>
        </div>

        {/* Stage Mode Switcher */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
          {[
            { id: 'triad' as StageViewMode, label: 'Tríada Espectral', icon: 'Layers' },
            { id: '2d' as StageViewMode, label: 'Osciloscopio 2D', icon: 'Activity' },
            { id: '3d' as StageViewMode, label: 'Cimática Nodal 3D', icon: 'Orbit' },
            { id: 'spiral' as StageViewMode, label: 'Espiral Logarítmica φ', icon: 'Aperture' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setStageMode(m.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-display font-bold uppercase tracking-wider transition-all cursor-pointer ${
                stageMode === m.id ? 'morph-tab-active' : 'morph-btn-glass text-slate-200'
              }`}
            >
              <Icon name={m.icon} size={13} />
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {/* 3 Real Spectral & Nodal Graphs */}
        {stageMode === 'triad' ? (
          <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 items-center py-2">
            {/* 1. Osciloscopio 2D */}
            <div className="relative flex flex-col items-center w-full transition-transform duration-500 lg:[transform:perspective(1100px)_rotateY(7deg)] lg:hover:[transform:perspective(1100px)_rotateY(0deg)]">
              <button
                type="button"
                onClick={() => setStageMode('2d')}
                className="mb-2 inline-flex items-center gap-2 px-3 py-1 rounded-full morph-pill text-[10px] font-display font-bold uppercase tracking-widest hover:brightness-110 transition-all cursor-pointer"
              >
                <Icon name="Activity" size={12} />
                <span>Superposición Temporal 2D</span>
              </button>
              <div className="w-full h-[220px] flex items-center justify-center bg-transparent">
                <Visualizer
                  analyser={combinedAnalyser}
                  sources={visualizerSources}
                  height={210}
                  transparentBg
                  perspective3D
                  fallbackFrequencies={activeFreqs}
                />
              </div>
            </div>

            {/* 2. Cimática 3D */}
            <div className="relative flex flex-col items-center w-full transition-transform duration-500 lg:[transform:perspective(1100px)_translateZ(20px)]">
              <button
                type="button"
                onClick={() => setStageMode('3d')}
                className="mb-2 inline-flex items-center gap-2 px-3 py-1 rounded-full morph-pill text-[10px] font-display font-bold uppercase tracking-widest hover:brightness-110 transition-all cursor-pointer"
              >
                <Icon name="Orbit" size={12} />
                <span>Morfología Nodal Chladni 3D</span>
              </button>
              <div className="w-full bg-transparent">
                <CymaticsVisualizer3D
                  analyser={combinedAnalyser}
                  activeFrequencies={activeFreqs}
                  allOscillators={oscs}
                  isMasterPlaying={isPlayingLive}
                  height={230}
                  transparentBg
                />
              </div>
            </div>

            {/* 3. Espiral Holográfico */}
            <div className="relative flex flex-col items-center w-full transition-transform duration-500 lg:[transform:perspective(1100px)_rotateY(-7deg)] lg:hover:[transform:perspective(1100px)_rotateY(0deg)]">
              <button
                type="button"
                onClick={() => setStageMode('spiral')}
                className="mb-2 inline-flex items-center gap-2 px-3 py-1 rounded-full morph-pill text-[10px] font-display font-bold uppercase tracking-widest hover:brightness-110 transition-all cursor-pointer"
              >
                <Icon name="Aperture" size={12} />
                <span>Progresión Espiral Cuántica φ</span>
              </button>
              <div className="w-full bg-transparent">
                <SpiralVisualizer
                  analyser={combinedAnalyser}
                  activeOscillators={oscs}
                  activeFrequencies={activeFreqs}
                  isMasterPlaying={isPlayingLive}
                  height={230}
                  transparentBg
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-4xl mx-auto py-2 bg-transparent">
            {stageMode === '2d' && (
              <Visualizer
                analyser={combinedAnalyser}
                sources={visualizerSources}
                height={330}
                transparentBg
                perspective3D
                fallbackFrequencies={activeFreqs}
              />
            )}
            {stageMode === '3d' && (
              <CymaticsVisualizer3D
                analyser={combinedAnalyser}
                activeFrequencies={activeFreqs}
                allOscillators={oscs}
                isMasterPlaying={isPlayingLive}
                height={340}
                transparentBg
              />
            )}
            {stageMode === 'spiral' && (
              <SpiralVisualizer
                analyser={combinedAnalyser}
                activeOscillators={oscs}
                activeFrequencies={activeFreqs}
                isMasterPlaying={isPlayingLive}
                height={340}
                transparentBg
              />
            )}
          </div>
        )}

        {/* Harmonic Reference Presets (Golden-Ratio / Numerological Proportions) */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 max-w-4xl">
          {HARMONIC_PRESETS.map((preset) => {
            const isSelected = selectedPreset.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setSelectedPreset(preset)}
                className={`px-3.5 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'morph-tab-active'
                    : 'bg-black/45 hover:bg-white/10 border-white/15 text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-black morph-accent-text">{preset.hzLabel}</span>
                  <span className="text-[11px] font-bold text-white">{preset.name}</span>
                </div>
                <span className="block text-[9px] font-mono text-slate-400">{preset.formula}</span>
              </button>
            );
          })}
        </div>

        {/* Centered Hero Action CTAs + Acoustic Sensor */}
        <div className="mt-6 w-full max-w-4xl flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() =>
              handleTune(selectedPreset.hz, `${selectedPreset.hzLabel} · ${selectedPreset.name}`)
            }
            className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl font-display font-bold text-xs sm:text-sm uppercase tracking-wider morph-btn-primary hover:-translate-y-0.5 cursor-pointer"
          >
            <Icon name="Play" size={16} />
            <span>Sintonizar Frecuencia · {selectedPreset.hzLabel}</span>
          </button>

          {onToggleMic && (
            <button
              type="button"
              onClick={onToggleMic}
              className={`inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-display font-bold text-xs sm:text-sm uppercase tracking-wider transition-all duration-300 hover:-translate-y-0.5 cursor-pointer ${
                micEnabled ? 'morph-tab-active' : 'morph-btn-glass'
              }`}
              title="Analizar frecuencias acústicas ambientales mediante micrófono en tiempo real"
            >
              <Icon name="Mic" size={16} className={micActive ? 'animate-pulse morph-accent-text' : ''} />
              <span>{micEnabled ? 'Captación Acústica Activa' : 'Captación Acústica Ambiental'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleNavigateTab('library', 'Librería')}
            className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-display font-bold text-xs sm:text-sm uppercase tracking-wider morph-btn-glass hover:-translate-y-0.5 cursor-pointer"
          >
            <Icon name="Search" size={16} className="morph-accent-text" />
            <span>Explorar Catálogo Espectral</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigateTab('generator', 'Espectrómetro')}
            className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-display font-bold text-xs sm:text-sm uppercase tracking-wider morph-btn-glass hover:-translate-y-0.5 cursor-pointer"
          >
            <Icon name="Zap" size={16} className="morph-accent-text-2" />
            <span>Abrir Espectrómetro</span>
          </button>
        </div>

        {micError && (
          <div className="mt-4 px-4 py-2 rounded-xl bg-amber-950/75 border border-amber-400/40 text-amber-200 text-xs font-medium">
            {micError}
          </div>
        )}

        {/* Non-blocking status toast if mounted standalone without callbacks */}
        {feedbackBanner && (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 px-4 py-2.5 rounded-2xl bg-black/75 border border-white/20 text-white text-xs sm:text-sm font-medium max-w-xl animate-fade-in"
          >
            {feedbackBanner}
          </div>
        )}
      </section>

      {/* ==================== 2. PILARES DEL SISTEMA ==================== */}
      <section aria-labelledby="pillars-heading" className="w-full flex flex-col items-center text-center">
        <div className="max-w-2xl mx-auto space-y-3 mb-9">
          <span className="inline-block text-[11px] font-display font-bold uppercase tracking-[0.25em] morph-accent-text">
            Fundamentos Físicos y Metafísicos
          </span>
          <h3 id="pillars-heading" className="text-fluid-title font-display font-black text-white text-balance">
            Arquitectura de Transducción y Coherencia Armónica
          </h3>
          <p className="text-fluid-body text-slate-300/85 text-pretty">
            Seis subsistemas interconectados que integran síntesis espectral de precisión, física nodal cimática y redes distribuidas sin dependencias centralizadas.
          </p>
        </div>

        <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 items-stretch">
          {SYSTEM_PILLARS.map((pillar) => (
            <article
              key={pillar.id}
              className="group art-nouveau-frame rounded-3xl p-6 sm:p-7 flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-1"
            >
              <div className="w-16 h-16 rounded-2xl morph-pill flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-500">
                <Icon name={pillar.iconName} size={28} className="morph-accent-text" />
              </div>

              <span className={`text-[10px] font-display font-bold uppercase tracking-[0.2em] mb-2 ${pillar.accentText}`}>
                {pillar.badge}
              </span>

              <h4 className="text-lg sm:text-xl font-display font-bold text-white mb-3 text-balance">
                {pillar.title}
              </h4>

              <p className="text-xs sm:text-sm text-slate-300/85 leading-relaxed mb-5 flex-grow text-pretty">
                {pillar.description}
              </p>

              <div className="flex flex-wrap items-center justify-center gap-1.5 mb-5">
                {pillar.highlights.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/15 text-[10px] font-medium text-slate-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  handleNavigateTab(
                    pillar.targetTab,
                    pillar.targetTab === 'library'
                      ? 'Librería'
                      : pillar.targetTab === 'generator'
                        ? 'Espectrómetro'
                        : 'Comunidad'
                  )
                }
                className="inline-flex items-center justify-center gap-1.5 text-xs font-display font-bold uppercase tracking-wider text-slate-100 hover:opacity-80 transition-opacity cursor-pointer"
              >
                <span>{pillar.actionLabel}</span>
                <Icon name="ArrowRight" size={14} />
              </button>
            </article>
          ))}
        </div>
      </section>

      {/* ==================== 3. MEDIOS FÍSICOS DE EMISIÓN Y ACOPLAMIENTO ENERGÉTICO ==================== */}
      <section aria-labelledby="radiation-heading" className="w-full flex flex-col items-center text-center">
        <div className="max-w-3xl mx-auto space-y-3 mb-9">
          <div className="inline-flex items-center justify-center gap-2 px-3.5 py-1 rounded-full morph-pill text-[11px] font-display font-bold uppercase tracking-[0.2em]">
            <Icon name="Waves" size={14} />
            <span>Física Aplicada de Transducción</span>
          </div>
          <h3 id="radiation-heading" className="text-fluid-title font-display font-black text-white text-balance">
            Medios Físicos de Emisión y Acoplamiento Energético
          </h3>
          <p className="text-fluid-body text-slate-400 text-pretty">
            Selecciona un dominio de propagación para consultar sus bandas fundamentales en Hz, portadoras en kHz/MHz, longitud de onda óptica equivalente en nanómetros (nm) y rangos de excitación eléctrica (V, A y W).
          </p>
        </div>

        {/* 5 Interactive Medium Selector Cards */}
        <div
          className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-6"
          role="group"
          aria-label="Selector de medio físico de emisión"
        >
          {PHYSICAL_MEDIUMS.map((med) => {
            const isSelected = med.id === activeMedium.id;
            return (
              <button
                key={med.id}
                type="button"
                onClick={() => setSelectedMediumId(med.id)}
                aria-pressed={isSelected}
                className={`rounded-2xl p-4 flex flex-col items-center text-center transition-all duration-300 border cursor-pointer ${
                  isSelected
                    ? 'bg-black/80 text-white scale-[1.02]'
                    : 'bg-black/40 hover:bg-white/[0.05] text-slate-300 border-white/10 hover:border-white/25'
                }`}
                style={
                  isSelected
                    ? {
                        borderColor: `${med.accentHex}99`,
                        boxShadow: `0 0 28px -8px ${med.accentHex}70, inset 0 0 18px ${med.accentHex}1c`
                      }
                    : undefined
                }
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 border"
                  style={{
                    backgroundColor: `${med.accentHex}18`,
                    borderColor: `${med.accentHex}45`,
                    color: med.accentHex
                  }}
                >
                  <Icon name={med.iconName} size={22} />
                </div>
                <span className="font-display font-bold text-sm text-white mb-1">
                  {med.shortLabel}
                </span>
                <span className="text-[11px] font-mono text-slate-400">{med.hzRange}</span>
                <span className="text-[10px] font-mono mt-1" style={{ color: med.accentHex }}>
                  {med.wattsRange.split('(')[0].trim()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Interactive Medium Telemetry & Protocol Panel */}
        <div
          className="w-full quantum-glass rounded-3xl p-6 sm:p-8 border transition-colors duration-500 flex flex-col items-center text-center"
          style={{ borderColor: `${activeMedium.accentHex}4d` }}
        >
          <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
            <span className={`px-3.5 py-1 rounded-full text-xs font-bold border ${activeMedium.badgeClass}`}>
              {activeMedium.title}
            </span>
          </div>

          <p className="text-sm sm:text-base text-slate-200 max-w-3xl mx-auto leading-relaxed mb-6 text-pretty">
            {activeMedium.howToHarness}
          </p>

          {/* Reference Metrics Grid: Hz, kHz, MHz, nm, Voltios, Amperios, Watts */}
          <div className="w-full grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            {[
              { label: 'Banda Hz', value: activeMedium.hzRange },
              { label: 'Octava kHz', value: activeMedium.khzRange },
              { label: 'Banda MHz', value: activeMedium.mhzRange },
              { label: 'Óptica nm', value: activeMedium.nmRange },
              { label: 'Tensión (V)', value: activeMedium.voltageRange },
              { label: 'Corriente (A)', value: activeMedium.amperageRange },
              { label: 'Potencia (W)', value: activeMedium.wattsRange }
            ].map((spec) => (
              <div
                key={spec.label}
                className="rounded-2xl bg-black/55 border border-white/10 p-3 flex flex-col items-center justify-center text-center"
              >
                <span className="text-[10px] font-display font-bold uppercase tracking-wider text-slate-400 mb-1">
                  {spec.label}
                </span>
                <span className="text-xs font-semibold text-white leading-snug">
                  {spec.value}
                </span>
              </div>
            ))}
          </div>

          <div className="w-full max-w-3xl rounded-2xl bg-white/[0.03] border border-white/10 p-4 mb-6">
            <span className="block text-[10px] font-display font-bold uppercase tracking-[0.2em] text-amber-300 mb-1">
              Transductores Recomendados
            </span>
            <p className="text-xs sm:text-sm text-slate-300">{activeMedium.transducers}</p>
          </div>

          <button
            type="button"
            onClick={() => handleTune(activeMedium.sampleHz, activeMedium.sampleName)}
            className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl font-display font-bold text-xs uppercase tracking-wider text-white bg-white/10 hover:bg-white/15 border border-white/20 hover:border-amber-400/50 transition-all cursor-pointer"
          >
            <Icon name="Play" size={14} className="text-amber-300" />
            <span>Sintonizar Muestra ({activeMedium.sampleHz} Hz)</span>
          </button>
        </div>
      </section>

      {/* ==================== 4. CENTRO DE DESCARGAS NATIVAS & ECOSISTEMA ==================== */}
      <section aria-labelledby="downloads-heading" className="w-full space-y-8">
        {/* Native Apps Center */}
        <div className="quantum-glass-gold rounded-3xl p-6 sm:p-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-950/50 border border-emerald-400/35 flex items-center justify-center mb-5 shadow-[0_0_24px_rgba(52,211,153,0.22)]">
            <Icon name="Download" size={30} className="text-emerald-300" />
          </div>

          <h3 id="downloads-heading" className="text-fluid-title font-display font-black text-white mb-3">
            Ejecutables Nativos de Baja Latencia
          </h3>
          <p className="text-fluid-body text-slate-300/85 max-w-2xl mx-auto mb-8 text-pretty">
            Acceso directo a procesamiento por hardware para síntesis AudioWorklet de baja latencia, proyección nodal 3D, retención de pantalla y sincronización P2P local sin conexión.
          </p>

          <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {PLATFORM_DOWNLOAD_ORDER.map((platform) => {
              const dl = DOWNLOAD_LINKS[platform.os];
              const isIos = platform.os === 'ios';

              if (isIos) {
                return (
                  <button
                    key={platform.os}
                    type="button"
                    onClick={() => setShowIosModal(true)}
                    className="quantum-glass rounded-2xl p-4 flex flex-col items-center justify-between text-center hover:border-fuchsia-400/55 hover:-translate-y-0.5 transition-all cursor-pointer"
                  >
                    <div className="flex flex-col items-center gap-2 mb-3">
                      <div className="p-2.5 rounded-xl bg-fuchsia-500/15 border border-fuchsia-400/35 text-fuchsia-300">
                        <Icon name={platform.icon} size={20} />
                      </div>
                      <span className="font-display font-bold text-sm text-white">{platform.label}</span>
                      <span className="text-[11px] text-slate-400">{platform.sub}</span>
                    </div>
                    <span className="w-full py-1.5 rounded-xl bg-fuchsia-500/15 border border-fuchsia-400/30 text-[10px] font-bold uppercase tracking-wider text-fuchsia-200">
                      Ver Guía iOS
                    </span>
                  </button>
                );
              }

              return (
                <a
                  key={platform.os}
                  href={dl.url}
                  download={dl.file}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="quantum-glass rounded-2xl p-4 flex flex-col items-center justify-between text-center hover:border-cyan-400/55 hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex flex-col items-center gap-2 mb-3">
                    <div className="p-2.5 rounded-xl bg-cyan-500/12 border border-cyan-400/30 text-cyan-300">
                      <Icon name={platform.icon} size={20} />
                    </div>
                    <span className="font-display font-bold text-sm text-white">{platform.label}</span>
                    <span className="text-[11px] text-slate-400">{platform.sub}</span>
                  </div>
                  <span className="w-full py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-cyan-200">
                    Descargar
                  </span>
                </a>
              );
            })}
          </div>
        </div>

        {/* Official Ecosystem Links */}
        <div className="quantum-glass rounded-3xl p-6 sm:p-10 flex flex-col items-center text-center">
          <span className="text-[11px] font-display font-bold uppercase tracking-[0.24em] text-amber-300 mb-2">
            Ecosistema Abierto
          </span>
          <h3 className="text-xl sm:text-2xl font-display font-black text-white mb-3">
            Enlaces Oficiales StarSeed System
          </h3>
          <p className="text-fluid-body text-slate-400 max-w-2xl mx-auto mb-7 text-pretty">
            Explora el código fuente abierto de Omni-Frecuencias, accede al sistema operativo StarSeed OS o experimenta visualización aumentada con Audiomorphic AR.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <a
              href="https://github.com/alexbordongarrigos/omnifrecuencias"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 hover:border-cyan-400/45 text-sm font-bold text-white transition-all"
            >
              <Icon name="Github" size={18} />
              <span>Omni-Frecuencias GitHub</span>
              <Icon name="ExternalLink" size={14} className="text-slate-400" />
            </a>

            <a
              href="https://starseed-os.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-amber-950/45 hover:bg-amber-500/20 border border-amber-400/40 hover:border-amber-300 text-sm font-bold text-amber-200 transition-all"
            >
              <img src="/starseed-symbol.png" alt="StarSeed OS" className="w-5 h-5 object-contain" />
              <span>StarSeed OS App</span>
              <Icon name="ExternalLink" size={14} className="text-amber-300/80" />
            </a>

            <a
              href="https://github.com/StarSeedSystem/starseed-system"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-cyan-950/40 hover:bg-cyan-500/20 border border-cyan-400/35 hover:border-cyan-300 text-sm font-bold text-cyan-200 transition-all"
            >
              <Icon name="Github" size={18} />
              <span>StarSeed OS GitHub</span>
              <Icon name="ExternalLink" size={14} className="text-cyan-300/80" />
            </a>

            <a
              href="https://github.com/alexbordongarrigos/audiomorphic-ar"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-purple-950/40 hover:bg-purple-500/20 border border-purple-400/35 hover:border-purple-300 text-sm font-bold text-purple-200 transition-all"
            >
              <Icon name="Eye" size={18} />
              <span>Audiomorphic AR</span>
              <Icon name="ExternalLink" size={14} className="text-purple-300/80" />
            </a>
          </div>
        </div>
      </section>

      {/* iOS PWA Installation Modal */}
      {showIosModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="intro-ios-pwa-title"
        >
          <div className="quantum-glass-gold rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative text-left animate-fade-in-up">
            <button
              type="button"
              onClick={() => setShowIosModal(false)}
              aria-label="Cerrar instrucciones iOS"
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Icon name="X" size={18} />
            </button>

            <h4
              id="intro-ios-pwa-title"
              className="text-base font-display font-bold text-amber-300 uppercase tracking-wider mb-4 flex items-center gap-2.5 pr-8"
            >
              <Icon name="Smartphone" size={18} /> Instalar en iPhone / iPad
            </h4>

            <ol className="space-y-3 text-xs sm:text-sm text-slate-200 mb-6 list-decimal list-inside leading-relaxed">
              <li>Abre Omni-Frecuencias desde <strong>Safari</strong>.</li>
              <li>Toca el icono <strong>Compartir</strong> en la barra inferior o superior de Safari.</li>
              <li>Selecciona <strong>&ldquo;Añadir a la pantalla de inicio&rdquo;</strong>.</li>
              <li>Pulsa <strong>&ldquo;Añadir&rdquo;</strong> para ejecutar la PWA a pantalla completa.</li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIosModal(false)}
              className="w-full py-3 bg-gradient-to-r from-amber-400 to-fuchsia-600 hover:brightness-110 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Introduction;
