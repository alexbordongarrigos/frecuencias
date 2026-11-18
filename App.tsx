import React, { useState, useMemo } from 'react';
import { frequencyData, getParticleOscillators } from './data/frequencies';
import {
  CATEGORIES,
  CategoryId,
  SortOption,
  FrequencyItem,
  OscillatorState,
  RADIATION_MEDIUMS,
  RadiationMedium,
  LiveSession,
  PresetContent
} from './types';
import FrequencyCard from './components/FrequencyCard';
import AdaptiveParticleGrid from './components/AdaptiveParticleGrid';
import Icon from './components/Icon';
import { useAudio } from './hooks/useAudio';
import Generator from './components/Generator';
import GlobalPlayer from './components/GlobalPlayer';
import LandingPage from './components/LandingPage';
import OnlineLibrary from './components/OnlineLibrary';
import StartLiveSessionModal from './components/StartLiveSessionModal';
import LiveSyncCall from './components/LiveSyncCall';
import Introduction from './components/Introduction';
import { LiquidCrystalBackground } from './components/LiquidCrystalBackground';
import { useChromaticMorph } from './hooks/useChromaticMorph';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  getCurrentStarseedUser,
  logoutStarseed,
  subscribeToStarseedAuth,
  StarseedUser,
  fetchLiveSessionById
} from './services/starseedAuth';
import { useScreenWakeLock } from './hooks/useScreenWakeLock';
import { autoUpdateService, AppReleaseInfo, CURRENT_APP_VERSION } from './services/autoUpdateService';
import { StarseedLoginModal } from './components/StarseedLoginModal';
import { autoSuggestTechnicalRecommendation } from './utils/frequencyAnalysis';
import LanguageSelector from './components/LanguageSelector';
import { LangCode, SUPPORTED_LANGUAGES, useReactiveTranslation } from './utils/i18n';
import { useFileSystem } from './hooks/useFileSystem';
import FileExplorer from './components/FileExplorer';
import SaveToBrainModal from './components/SaveToBrainModal';

export interface SessionPermissions {
  canEditFrequencies: boolean;
  canUseMic: boolean;
  canUseVideo: boolean;
  canChat: boolean;
}

type ViewMode = 'intro' | 'library' | 'generator' | 'online';

const normalizeLoadedOscillators = (oscs: Partial<OscillatorState>[]): OscillatorState[] =>
  oscs.map((o, idx) => ({
    id: o.id || crypto.randomUUID(),
    frequency: Number(o.frequency) || 432,
    type: o.type || 'sine',
    volume: o.volume !== undefined ? o.volume : 0.5,
    panX: o.panX ?? 0,
    panY: o.panY ?? 0,
    panZ: o.panZ ?? 0,
    isPlaying: o.isPlaying !== undefined ? o.isPlaying : true,
    name: o.name || `Frecuencia ${idx + 1}`,
    type2: o.type2,
    typeMix: o.typeMix,
    crestValleyRatio: o.crestValleyRatio ?? 1.0,
    dutyCycle: o.dutyCycle ?? 0,
    harmonicDistortion: o.harmonicDistortion ?? 0,
    phaseOffset: o.phaseOffset ?? 0,
    isIndependent: Boolean(o.isIndependent),
    color: o.color || '#38bdf8',
    transition: o.transition
  }));

const App: React.FC = () => {
  const [started, setStarted] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all');
  const [activeMedium, setActiveMedium] = useState<RadiationMedium | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOption['value']>('hz-asc');
  const [showFilters, setShowFilters] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('intro');
  const [currentUser, setCurrentUser] = useState<StarseedUser | null>(null);
  const [lang, setLang] = useState<LangCode>(() => {
    try {
      const saved = localStorage.getItem('omni_lang') as LangCode | null;
      if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) return saved;
      return 'es';
    } catch {
      return 'es';
    }
  });

  const handleChangeLang = (nextLang: LangCode) => {
    setLang(nextLang);
    try {
      localStorage.setItem('omni_lang', nextLang);
    } catch {
      // Ignore storage failures
    }
  };

  useReactiveTranslation(lang);

  // Audio Engine Hook
  const audio = useAudio();

  // Morphologic Chromatic Engine (Sound & Microphone -> Adaptive UI + Background)
  const chromaticMorph = useChromaticMorph(audio.oscillators, audio.isPlaying, audio.getMasterAnalyser);

  // Universal Screen Wake Lock (keeps display active across all OSs)
  useScreenWakeLock(true);

  // Auto Updates State
  const [availableUpdate, setAvailableUpdate] = useState<AppReleaseInfo | null>(null);
  const [showDownloadCenter, setShowDownloadCenter] = useState(false);

  // Session State
  const [activeSession, setActiveSession] = useState<LiveSession | null>(null);
  const [sessionPermissions, setSessionPermissions] = useState<SessionPermissions>({
    canEditFrequencies: true,
    canUseMic: true,
    canUseVideo: true,
    canChat: true
  });
  const [activeVizTab, setActiveVizTab] = useState<'2d' | '3d' | 'spiral'>('2d');

  const [showStartSessionModal, setShowStartSessionModal] = useState(false);
  const [presetToStart, setPresetToStart] = useState<PresetContent | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Unified Account / Brain & Local Device Explorer Store
  const fs = useFileSystem();
  const [showLibraryExplorer, setShowLibraryExplorer] = useState(false);
  const [saveModalPayload, setSaveModalPayload] = useState<{
    name: string;
    category?: string;
    content: PresetContent;
    sourceLabel?: string;
  } | null>(null);
  const [librarySyncNotice, setLibrarySyncNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const libraryFileInputRef = React.useRef<HTMLInputElement>(null);

  const flashLibraryNotice = (type: 'success' | 'error', text: string) => {
    setLibrarySyncNotice({ type, text });
    setTimeout(() => {
      setLibrarySyncNotice((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  React.useEffect(() => {
    getCurrentStarseedUser().then((user) => setCurrentUser(user));

    const unsubAuth = subscribeToStarseedAuth((user) => {
      setCurrentUser(user);
    });

    const unsubUpdate = autoUpdateService.subscribe((info) => {
      if (info && info.hasUpdate) {
        setAvailableUpdate(info);
      }
    });

    // Check for session invite link
    const searchParams = new URLSearchParams(window.location.search);
    const sessionId = searchParams.get('session');
    if (sessionId) {
      fetchLiveSessionById(sessionId).then((session) => {
        if (session) {
          setActiveSession(session as LiveSession);
          setViewMode('generator');
          audio.syncFromRemote(session.presetContent.oscillators);
        } else {
          console.error('Session not found or RLS blocked access.');
        }
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return () => {
      unsubAuth();
      unsubUpdate();
    };
  }, []);

  // Handler to add/load a library particle into the Spectrometer
  const handleAddToPlayer = (item: FrequencyItem, replace: boolean = false) => {
    const oscList = getParticleOscillators(item);

    if (replace) {
      const normalized = normalizeLoadedOscillators(oscList);
      audio.loadPreset({ oscillators: normalized });
    } else {
      oscList.forEach((oscParams) => {
        audio.addOscillator(oscParams);
      });
    }

    setViewMode('generator');
  };

  // Quick Tune from 4D Introduction Core
  const handleQuickTune = (hz: number, name: string) => {
    audio.addOscillator({
      name,
      frequency: hz,
      type: 'sine',
      volume: 0.5,
      panX: 0,
      panY: 0,
      panZ: 0,
      color: '#22d3ee'
    });
    setViewMode('generator');
  };

  // Category particle counts (respecting active medium filter)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    CATEGORIES.forEach((c) => {
      counts[c.id] = 0;
    });

    frequencyData.forEach((item) => {
      if (activeMedium !== 'all') {
        const tech =
          item.technicalRecommendation ||
          autoSuggestTechnicalRecommendation(getParticleOscillators(item), item.category, item.name);
        if (!tech.recommendedMediums.includes(activeMedium)) return;
      }
      counts.all += 1;
      counts[item.category] = (counts[item.category] || 0) + 1;
    });

    return counts;
  }, [activeMedium]);

  // Filter and Sort Logic
  const filteredData = useMemo(() => {
    let data = [...frequencyData];

    // 1. Filter by Category
    if (activeCategory !== 'all') {
      data = data.filter((item) => item.category === activeCategory);
    }

    // 2. Filter by Radiation Medium
    if (activeMedium !== 'all') {
      data = data.filter((item) => {
        const tech =
          item.technicalRecommendation ||
          autoSuggestTechnicalRecommendation(getParticleOscillators(item), item.category, item.name);
        return tech.recommendedMediums.includes(activeMedium);
      });
    }

    // 3. Filter by Search
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.trim().toLowerCase();
      data = data.filter((item) => {
        const tech = item.technicalRecommendation;
        return (
          item.name.toLowerCase().includes(lowerQuery) ||
          item.description.toLowerCase().includes(lowerQuery) ||
          item.hz.toLowerCase().includes(lowerQuery) ||
          item.detailedUsage.toLowerCase().includes(lowerQuery) ||
          item.evidence.toLowerCase().includes(lowerQuery) ||
          (item.location || '').toLowerCase().includes(lowerQuery) ||
          (item.cymaticPatternName || '').toLowerCase().includes(lowerQuery) ||
          (tech?.primaryMediumLabel || '').toLowerCase().includes(lowerQuery) ||
          (tech?.usageMode || '').toLowerCase().includes(lowerQuery) ||
          (tech?.numerologyRelation || '').toLowerCase().includes(lowerQuery) ||
          (tech?.naturalObjectResonance || '').toLowerCase().includes(lowerQuery) ||
          (tech?.frequencyScales?.khz || '').toLowerCase().includes(lowerQuery) ||
          (tech?.frequencyScales?.mhz || '').toLowerCase().includes(lowerQuery) ||
          (tech?.frequencyScales?.opticalNm || '').toLowerCase().includes(lowerQuery)
        );
      });
    }

    // 4. Sort
    data.sort((a, b) => {
      switch (sortOrder) {
        case 'hz-asc':
          return a.numericalHz - b.numericalHz;
        case 'hz-desc':
          return b.numericalHz - a.numericalHz;
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'location':
          if (a.location && !b.location) return -1;
          if (!a.location && b.location) return 1;
          return (a.location || '').localeCompare(b.location || '');
        default:
          return 0;
      }
    });

    return data;
  }, [activeCategory, activeMedium, searchQuery, sortOrder]);

  if (!started || showDownloadCenter) {
    return (
      <LandingPage
        onEnterWeb={() => {
          setStarted(true);
          setShowDownloadCenter(false);
        }}
        onClose={() => setShowDownloadCenter(false)}
      />
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-dvh relative overflow-x-clip selection:bg-cyan-500/30 selection:text-cyan-100">
        {/* --- In-App Auto Update Banner --- */}
        {availableUpdate && availableUpdate.hasUpdate && (
          <div className="sticky top-0 z-[120] bg-gradient-to-r from-purple-900/95 via-fuchsia-900/95 to-purple-900/95 backdrop-blur-2xl border-b border-fuchsia-400/50 p-2.5 px-4 shadow-[0_5px_30px_rgba(192,38,211,0.6)] flex items-center justify-between text-xs animate-fade-in">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping shrink-0"></span>
              <span className="font-bold text-white uppercase tracking-wider truncate">
                ¡Actualización {availableUpdate.latestVersion} disponible!
              </span>
              <span className="hidden md:inline text-purple-200 text-[11px] truncate max-w-md">
                {availableUpdate.releaseName}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => autoUpdateService.applyUpdate()}
                className="px-4 py-1.5 bg-cyan-400 hover:bg-cyan-300 text-black font-black uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(34,211,238,0.5)] cursor-pointer"
              >
                Actualizar
              </button>
              <button
                onClick={() => setAvailableUpdate(null)}
                className="text-purple-300 hover:text-white p-1 rounded hover:bg-white/10"
                title="Cerrar aviso"
              >
                <Icon name="X" size={14} />
              </button>
            </div>
          </div>
        )}

        {/* --- Living Solarpunk Liquid Crystal Background (Audio + Mic Morphologic) --- */}
        <LiquidCrystalBackground stateRef={chromaticMorph.stateRef} />

        <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-5 md:px-6 py-5 sm:py-8">
          {/* --- Unified Header (StarSeed OS × Omni-Frecuencias) --- */}
          <header className="relative z-30 text-center mb-8 sm:mb-10 animate-fade-in flex flex-col items-center justify-center">
            {/* Top Status, Mic & Ecosystem Bar */}
            <div className="relative z-40 flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-5 sm:mb-6">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full morph-pill backdrop-blur-md">
                <Icon name="Globe" size={14} className="morph-accent-text" />
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.22em] text-slate-100">
                  Omni-Frecuencias v{CURRENT_APP_VERSION}
                </span>
              </div>

              <LanguageSelector currentLang={lang} onChangeLang={handleChangeLang} />

              <button
                onClick={() => chromaticMorph.toggleMic()}
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${chromaticMorph.micEnabled
                  ? 'morph-tab-active'
                  : 'morph-btn-glass text-slate-100'
                  }`}
                title={
                  chromaticMorph.micError ||
                  'Sincronizar el campo espectral con las frecuencias acústicas del entorno en tiempo real'
                }
              >
                <Icon
                  name={chromaticMorph.micEnabled ? 'Mic' : 'MicOff'}
                  size={14}
                  className={chromaticMorph.micActive ? 'animate-pulse morph-accent-text' : ''}
                />
                <span>
                  {chromaticMorph.micEnabled
                    ? `Captación · ${Math.round(chromaticMorph.chromaticState.dominantHz)} Hz`
                    : 'Sensor Acústico'}
                </span>
              </button>

              <button
                onClick={() => setShowDownloadCenter(true)}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full morph-btn-glass text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-100 cursor-pointer"
                title="Descargar ejecutable nativo multiplataforma"
              >
                <Icon name="Download" size={14} className="morph-accent-text-2" />
                <span>Sistemas Nativos</span>
              </button>

              {currentUser ? (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full morph-pill backdrop-blur-md animate-fade-in">
                  <img
                    src="/starseed-symbol.png"
                    alt="StarSeed"
                    className="w-4 h-4 object-contain"
                  />
                  <span className="text-xs font-bold text-amber-200 max-w-[140px] truncate">
                    {currentUser.displayName || currentUser.handle || 'StarSeed'}
                  </span>
                  <button
                    onClick={async () => {
                      await logoutStarseed();
                      setCurrentUser(null);
                    }}
                    className="ml-0.5 p-1 rounded-full text-amber-300/70 hover:text-red-300 hover:bg-white/10 transition-colors cursor-pointer"
                    title="Cerrar sesión StarSeed OS"
                  >
                    <Icon name="LogOut" size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full morph-btn-glass text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-200 hover:text-white transition-all cursor-pointer"
                  title="Conectar con tu cuenta oficial de StarSeed OS"
                >
                  <img
                    src="/starseed-symbol.png"
                    alt="StarSeed OS"
                    className="w-4 h-4 object-contain"
                  />
                  <span>Conectar StarSeed OS</span>
                </button>
              )}
            </div>

            {chromaticMorph.micError && (
              <div className="mb-4 px-3.5 py-1.5 rounded-xl bg-amber-950/80 border border-amber-400/40 text-amber-200 text-xs">
                {chromaticMorph.micError}
              </div>
            )}

            {/* Brand Lockup (Pure centered emblem) */}
            <div className="relative inline-flex flex-col items-center">
              <div className="flex items-center justify-center mb-2.5">
                <div className="p-2 rounded-3xl art-nouveau-frame">
                  <img
                    src="/omnifrecuencias.png"
                    alt="Omni Frecuencias Logo"
                    className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_0_24px_rgba(34,211,238,0.45)]"
                  />
                </div>
              </div>

              <h1 className="font-display font-black tracking-tight starseed-text-gradient text-fluid-hero leading-none">
                Omni-Frecuencias
              </h1>
              <p className="mt-2 text-[11px] sm:text-xs uppercase tracking-[0.22em] text-slate-300 font-bold">
                Laboratorio de Síntesis Armónica, Física Ondulatoria y Resonancia Cuántica · <span className="starseed-gold-gradient">StarSeed OS</span>
              </p>
            </div>

            {/* Main Navigation Tabs (Centered & Balanced on Every Screen) */}
            <nav
              aria-label="Navegación Principal"
              className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 mt-7 sm:mt-8 w-full max-w-5xl mx-auto"
            >
              {[
                {
                  id: 'intro' as ViewMode,
                  label: 'Inicio',
                  sub: 'Fundamentos & Campo',
                  icon: 'Compass',
                },
                {
                  id: 'library' as ViewMode,
                  label: 'Librería',
                  sub: `${frequencyData.length} Frecuencias`,
                  icon: 'Library',
                },
                {
                  id: 'generator' as ViewMode,
                  label: 'Espectrómetro',
                  sub: audio.oscillators.length > 0 ? `${audio.oscillators.length} Osciladores` : 'Síntesis & Cimática',
                  icon: 'Zap',
                },
                {
                  id: 'online' as ViewMode,
                  label: 'Comunidad',
                  sub: 'Red P2P & Mesh',
                  icon: 'Globe',
                }
              ].map((tab) => {
                const isActive = viewMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setViewMode(tab.id)}
                    className={`relative overflow-hidden group flex items-center justify-center gap-2 sm:gap-2.5 px-3 py-3 sm:px-4 sm:py-3.5 rounded-2xl border transition-all duration-300 cursor-pointer ${isActive
                      ? 'morph-tab-active scale-[1.02]'
                      : 'morph-btn-glass text-slate-300 hover:text-white'
                      }`}
                  >
                    <div className="p-1.5 sm:p-2 rounded-xl bg-black/45 border border-white/10 shrink-0">
                      <Icon name={tab.icon} size={18} className={isActive ? 'morph-accent-text' : 'text-slate-300 group-hover:text-white'} />
                    </div>
                    <div className="text-left min-w-0">
                      <span className="block font-display font-bold uppercase tracking-wide text-[11px] sm:text-xs md:text-[13px] whitespace-nowrap text-white">
                        {tab.label}
                      </span>
                      <span className="block text-[9px] sm:text-[10px] font-medium text-slate-300/80 truncate">
                        {tab.sub}
                      </span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </header>

          {/* --- MAIN VIEWS --- */}
          <>
            {/* --- VIEW: INTRO --- */}
            {viewMode === 'intro' && (
              <Introduction
                onNavigate={(tab) => setViewMode(tab)}
                onQuickTune={handleQuickTune}
                audio={audio}
                micEnabled={chromaticMorph.micEnabled}
                micActive={chromaticMorph.micActive}
                micError={chromaticMorph.micError}
                onToggleMic={chromaticMorph.toggleMic}
                dominantHz={chromaticMorph.chromaticState.dominantHz}
                harmonicRatio={chromaticMorph.chromaticState.harmonicRatio}
                currentLang={lang}
                onChangeLang={handleChangeLang}
              />
            )}

            {/* --- VIEW: LIBRARY --- */}
            {viewMode === 'library' && (
              <div className="animate-fade-in">
                {/* --- Controls Panel --- */}
                <div className="mb-8">
                  <div className="art-nouveau-frame rounded-3xl p-4 sm:p-6 relative overflow-hidden">
                    {/* Top Row: Search, Counter & Sort */}
                    <div className="flex flex-col lg:flex-row gap-4 justify-between items-center relative z-10">
                      <div className="relative w-full lg:max-w-md group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-white transition-colors">
                          <Icon name="Search" size={18} />
                        </div>
                        <input
                          type="text"
                          placeholder="Buscar frecuencia (Hz), resonancia celular, mineral, ecuación armónica o medio físico..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-black/60 border border-white/15 rounded-2xl pl-12 pr-10 py-3 text-sm focus:outline-none focus:border-white/45 focus:bg-black/85 transition-all text-white placeholder-slate-400"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white rounded-lg"
                            title="Limpiar búsqueda"
                          >
                            <Icon name="X" size={14} />
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 w-full lg:w-auto">
                        <span className="px-3 py-1.5 rounded-xl morph-pill text-[10px] font-bold uppercase tracking-wider">
                          {filteredData.length} Partículas
                        </span>

                        <div className="flex items-center gap-1 bg-black/50 p-1 rounded-2xl border border-white/15">
                          {[
                            { label: 'Hz ↑', value: 'hz-asc' },
                            { label: 'Hz ↓', value: 'hz-desc' },
                            { label: 'A–Z', value: 'name-asc' },
                            { label: 'Origen', value: 'location' }
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => setSortOrder(opt.value as SortOption['value'])}
                              className={`px-3 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${sortOrder === opt.value
                                ? 'morph-tab-active'
                                : 'text-slate-300 border border-transparent hover:text-white hover:bg-white/10'
                                }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        <button
                          className="px-3 py-2 rounded-xl morph-btn-glass text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                          onClick={() => setShowFilters(!showFilters)}
                        >
                          <Icon name={showFilters ? 'ChevronUp' : 'ChevronDown'} size={14} />
                          <span>{showFilters ? 'Compactar Filtros' : 'Categorías y Medios'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Unified Brain / Local Device Library Synchronization Bar */}
                    <div className="mt-4 pt-4 border-t border-white/10 relative z-10 flex flex-col gap-2.5">
                      <div className="flex flex-col lg:flex-row items-center justify-between gap-2.5 bg-black/45 border border-white/10 rounded-2xl px-3.5 py-2.5">
                        {fs.user ? (
                          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 w-full lg:w-auto">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                              <Icon name="Brain" size={14} className="text-purple-400" />
                              Cerebro StarSeed OS:
                            </span>
                            <select
                              aria-label="Seleccionar Cerebro para Biblioteca de Partículas"
                              value={fs.selectedBrainId || ''}
                              onChange={(e) => fs.selectBrain(e.target.value)}
                              disabled={fs.isLoadingBrains || fs.brains.length === 0}
                              className="bg-black/70 border border-purple-500/35 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                            >
                              {fs.brains.map((b) => (
                                <option key={b.id} value={b.id} className="bg-[#0a0f1f] text-white">
                                  {b.name} ({b.accessLevel.toUpperCase()}
                                  {b.isOwner ? ' · Propio' : ' · Compartido'})
                                </option>
                              ))}
                            </select>

                            {fs.selectedBrain && (
                              <span
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase border ${
                                  fs.selectedBrain.accessLevel === 'admin'
                                    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                                    : fs.selectedBrain.accessLevel === 'escritura'
                                    ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200'
                                    : 'bg-amber-500/15 border-amber-400/40 text-amber-200'
                                }`}
                              >
                                {fs.selectedBrain.accessLevel}
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => fs.syncNow()}
                              className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-400/35 text-[10px] font-bold uppercase text-cyan-200 flex items-center gap-1 cursor-pointer"
                              title={fs.syncMessage || 'Sincronizar con la nube y dispositivos'}
                            >
                              <Icon
                                name={fs.syncState === 'syncing' ? 'Loader' : fs.isOnline ? 'CloudUpload' : 'WifiOff'}
                                size={11}
                                className={fs.syncState === 'syncing' ? 'animate-spin' : ''}
                              />
                              {fs.syncState === 'synced'
                                ? 'Sincronizado'
                                : fs.syncState === 'offline_queued'
                                ? 'Cola Offline'
                                : fs.syncState === 'read_only'
                                ? 'Solo Lectura'
                                : 'Sincronizar'}
                            </button>

                            {fs.hasLocalGuestData && fs.canWriteCurrentBrain && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const ok = await fs.importLocalGuestDataToCurrentBrain('merge');
                                  if (ok) {
                                    flashLibraryNotice(
                                      'success',
                                      `Carpetas locales agregadas al cerebro "${fs.selectedBrain?.name}".`
                                    );
                                  }
                                }}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/45 text-[10px] font-bold uppercase text-amber-200 flex items-center gap-1 cursor-pointer"
                                title="Agregar carpetas y partículas guardadas localmente antes de iniciar sesión"
                              >
                                <Icon name="HardDrive" size={11} />
                                + Agregar Locales ({fs.localGuestStats.files})
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 w-full lg:w-auto">
                            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                              <Icon name="HardDrive" size={14} className="text-cyan-400" />
                              {fs.localLocationMeta
                                ? `Almacenamiento recordado: ${fs.localLocationMeta.label}`
                                : 'Biblioteca Local del Dispositivo (sin cuenta StarSeed OS)'}
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await fs.chooseLocalDeviceLocation('directory');
                                if (res.ok && res.meta) {
                                  flashLibraryNotice('success', `Carpeta local recordada: ${res.meta.label}`);
                                } else if (res.error) {
                                  flashLibraryNotice('error', res.error);
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-400/35 text-[10px] font-bold uppercase text-cyan-200 flex items-center gap-1 cursor-pointer"
                            >
                              <Icon name="FolderOpen" size={11} /> Elegir Carpeta Local
                            </button>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
                          <input
                            ref={libraryFileInputRef}
                            type="file"
                            accept=".json,.omni,.omni-library.json"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                const text = ev.target?.result;
                                if (typeof text === 'string') {
                                  const ok = fs.importSystem(text, { mode: 'merge', targetFolderId: 'root' });
                                  if (ok) {
                                    flashLibraryNotice(
                                      'success',
                                      `"${file.name}" importado con todas sus carpetas y configuraciones.`
                                    );
                                    setShowLibraryExplorer(true);
                                  } else {
                                    flashLibraryNotice(
                                      'error',
                                      'Archivo no compatible o el cerebro actual es de solo lectura.'
                                    );
                                  }
                                }
                              };
                              reader.readAsText(file);
                              e.target.value = '';
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => libraryFileInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/30 border border-indigo-400/35 text-[10px] font-bold uppercase tracking-wider text-indigo-200 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Icon name="Upload" size={12} /> Importar Archivo
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowLibraryExplorer(true)}
                            className="px-3.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/35 border border-purple-400/45 text-[10px] font-bold uppercase tracking-wider text-purple-100 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Icon name="Folder" size={13} /> Abrir Carpetas ({fs.root.children?.length || 0})
                          </button>
                        </div>
                      </div>

                      {librarySyncNotice && (
                        <div
                          className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                            librarySyncNotice.type === 'success'
                              ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
                              : 'bg-red-950/70 border-red-500/40 text-red-200'
                          }`}
                        >
                          <span>{librarySyncNotice.text}</span>
                          <button
                            type="button"
                            onClick={() => setLibrarySyncNotice(null)}
                            className="text-white/60 hover:text-white cursor-pointer"
                          >
                            <Icon name="X" size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Filters: Radiation Mediums & Categories */}
                    {showFilters && (
                      <div className="mt-5 pt-5 border-t border-white/10 space-y-4 relative z-10">
                        {/* Radiation Medium Filter */}
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-[10px] uppercase tracking-[0.22em] text-slate-400 font-bold">
                            Medio Físico de Transducción y Radiación
                          </span>
                          <div className="flex flex-wrap gap-2 justify-center">
                            <button
                              onClick={() => setActiveMedium('all')}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${activeMedium === 'all'
                                ? 'bg-white/15 border-white/40 text-white shadow-[0_0_15px_rgba(255,255,255,0.12)]'
                                : 'bg-black/35 border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                              <Icon name="Layers" size={12} />
                              Todos los Medios
                            </button>
                            {RADIATION_MEDIUMS.map((med) => {
                              const selected = activeMedium === med.id;
                              return (
                                <button
                                  key={med.id}
                                  onClick={() => setActiveMedium(selected ? 'all' : med.id)}
                                  title={med.summary}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${selected
                                    ? `${med.badgeClass} shadow-[0_0_16px_rgba(34,211,238,0.2)] scale-[1.03]`
                                    : 'bg-black/35 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                    }`}
                                >
                                  <Icon name={med.iconName} size={12} className={selected ? med.color : ''} />
                                  {med.shortLabel}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Categories Grid / Pills */}
                        <div className="flex flex-col items-center gap-2 pt-2 border-t border-white/5">
                          <span className="text-[10px] uppercase tracking-[0.22em] text-slate-400 font-bold">
                            Taxonomía Espectral y Dominios de Resonancia
                          </span>
                          <div className="flex flex-wrap gap-2 justify-center w-full">
                            {CATEGORIES.map((cat) => {
                              const count = categoryCounts[cat.id] || 0;
                              const isActive = activeCategory === cat.id;
                              return (
                                <button
                                  key={cat.id}
                                  onClick={() => setActiveCategory(cat.id)}
                                  title={cat.description}
                                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all duration-300 border cursor-pointer ${isActive
                                    ? 'bg-white/15 border-cyan-400/50 text-white shadow-[0_0_20px_rgba(34,211,238,0.2)] scale-[1.03]'
                                    : 'bg-black/35 border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-200 hover:border-white/20'
                                    }`}
                                >
                                  <Icon
                                    name={cat.iconName}
                                    size={14}
                                    className={isActive ? `${cat.color} drop-shadow-[0_0_6px_currentColor]` : cat.color}
                                  />
                                  <span>{cat.label}</span>
                                  <span className="px-1.5 py-0.5 rounded-md bg-black/50 text-[9px] font-mono text-slate-300 border border-white/10">
                                    {count}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* --- Results Grid --- */}
                {filteredData.length > 0 ? (
                  <AdaptiveParticleGrid<FrequencyItem>
                    items={filteredData}
                    getItemKey={(item) => item.id}
                    columnsConfig={{ base: 1, md: 2, xl: 3 }}
                    gapPx={24}
                    className="pb-36"
                    renderItem={(item, index) => (
                      <FrequencyCard
                        item={item}
                        delay={Math.min(index, 12) * 35}
                        onAddToPlayer={handleAddToPlayer}
                        oscillatorsList={getParticleOscillators(item)}
                        onSaveToLibrary={(particle) => {
                          const rawOscs = getParticleOscillators(particle);
                          const normalized = normalizeLoadedOscillators(rawOscs);
                          setSaveModalPayload({
                            name: particle.name,
                            category: particle.category,
                            sourceLabel: 'Biblioteca Principal',
                            content: {
                              oscillators: normalized,
                              dateCreated: Date.now(),
                              category: particle.category,
                              description: particle.description,
                              technicalRecommendation:
                                particle.technicalRecommendation ||
                                autoSuggestTechnicalRecommendation(normalized, particle.category, particle.name),
                            },
                          });
                        }}
                      />
                    )}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 text-center text-slate-400 bg-black/40 border border-white/10 rounded-3xl animate-fade-in mb-28">
                    <Icon name="Activity" size={56} className="mb-4 opacity-30 text-cyan-400" />
                    <h3 className="text-xl font-bold text-white">No hay resonancia en este filtro</h3>
                    <p className="text-sm text-slate-400 mt-2 max-w-md">
                      Prueba ajustando la búsqueda, cambiando el medio de radiación o volviendo a Todas las categorías.
                    </p>
                    <button
                      onClick={() => {
                        setActiveCategory('all');
                        setActiveMedium('all');
                        setSearchQuery('');
                      }}
                      className="mt-5 px-5 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Restablecer Filtros
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* --- VIEW: GENERATOR / SPECTROMETER --- */}
            {viewMode === 'generator' && (
              <Generator
                audio={audio}
                isMasterPlaying={audio.isPlaying}
                activeVizTab={activeVizTab}
                onVizTabChange={setActiveVizTab}
                onStartLiveSession={(preset) => {
                  setPresetToStart(preset);
                  setShowStartSessionModal(true);
                }}
                sessionPermissions={
                  activeSession &&
                    (activeSession.hostId === currentUser?.id ||
                      (!currentUser && activeSession.hostId === 'local-host'))
                    ? { ...sessionPermissions, canEditFrequencies: true }
                    : sessionPermissions
                }
              />
            )}

            {/* --- VIEW: ONLINE COMMUNITY & MESH --- */}
            {viewMode === 'online' && (
              <div className="min-h-[70dvh] pb-36">
                <OnlineLibrary
                  currentOscillators={audio.oscillators}
                  onSavePresetToLibrary={(name, content, category) => {
                    setSaveModalPayload({
                      name,
                      category: category || content.category || 'custom',
                      sourceLabel: 'Comunidad StarSeed OS',
                      content: {
                        ...content,
                        oscillators: normalizeLoadedOscillators(content.oscillators || []),
                      },
                    });
                  }}
                  onLoadPreset={(node) => {
                    if (node.content?.oscillators) {
                      const normalized = normalizeLoadedOscillators(node.content.oscillators);
                      audio.loadPreset({ oscillators: normalized });
                      setViewMode('generator');
                    }
                  }}
                  onMixPreset={(node) => {
                    if (node.content?.oscillators) {
                      const normalized = normalizeLoadedOscillators(node.content.oscillators);
                      normalized.forEach((osc) => {
                        audio.addOscillator(osc);
                      });
                      setViewMode('generator');
                    }
                  }}
                  onJoinSession={(session) => {
                    setActiveSession(session);
                    if (session.presetContent?.oscillators?.length) {
                      audio.syncFromRemote(normalizeLoadedOscillators(session.presetContent.oscillators));
                    }
                    setViewMode('generator');
                  }}
                  onStartSessionRequest={() => {
                    setPresetToStart({
                      oscillators: audio.oscillators,
                      dateCreated: Date.now(),
                      description: 'Sintonización Cuántica en Vivo'
                    });
                    setShowStartSessionModal(true);
                  }}
                />
              </div>
            )}
          </>
        </div>

        {/* --- Global Player --- */}
        <GlobalPlayer audio={audio} />

        {/* --- Live Sync Call Overlay --- */}
        {activeSession && (
          <ErrorBoundary>
            <LiveSyncCall
              session={activeSession}
              currentUser={currentUser || ({ id: 'anonymous', displayName: 'Explorador', email: '' } as any)}
              audio={audio}
              onLeave={() => {
                setActiveSession(null);
                setSessionPermissions({
                  canEditFrequencies: true,
                  canUseMic: true,
                  canUseVideo: true,
                  canChat: true
                });
              }}
              currentOscillators={audio.oscillators}
              activeVizTab={activeVizTab}
              onSyncReceive={(oscillators) => {
                audio.syncFromRemote(oscillators);
              }}
              onPermissionsChange={(perms) => setSessionPermissions(perms)}
              onEndSession={() => setActiveSession(null)}
            />
          </ErrorBoundary>
        )}

        {/* --- Modals --- */}
        {showLibraryExplorer && (
          <FileExplorer
            mode="load"
            fs={fs}
            onClose={() => setShowLibraryExplorer(false)}
            onFileSelect={(content, mix) => {
              const normalized = normalizeLoadedOscillators(content.oscillators || []);
              if (mix) {
                normalized.forEach((osc) => audio.addOscillator(osc));
              } else {
                audio.loadPreset({ ...content, oscillators: normalized });
              }
              setShowLibraryExplorer(false);
              setViewMode('generator');
            }}
            currentConfig={{
              oscillators: audio.oscillators,
              dateCreated: Date.now(),
              description: 'Configuración desde Espectrómetro',
            }}
          />
        )}

        {saveModalPayload && (
          <SaveToBrainModal
            isOpen={Boolean(saveModalPayload)}
            onClose={() => setSaveModalPayload(null)}
            fs={fs}
            initialName={saveModalPayload.name}
            initialCategory={saveModalPayload.category}
            initialContent={saveModalPayload.content}
            sourceLabel={saveModalPayload.sourceLabel}
          />
        )}

        <StarseedLoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={(u) => {
            setCurrentUser(u);
            setShowLoginModal(false);
          }}
        />

        {showStartSessionModal && presetToStart && (
          <StartLiveSessionModal
            preset={presetToStart}
            onClose={() => {
              setShowStartSessionModal(false);
              setPresetToStart(null);
            }}
            onSessionStarted={(session) => {
              setShowStartSessionModal(false);
              setPresetToStart(null);
              setActiveSession(session);
              setViewMode('generator');
            }}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

export default App;
