import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAudio } from '../hooks/useAudio';
import { useFileSystem } from '../hooks/useFileSystem';
import { GeminiWavePreset, OscillatorState } from '../types';
import {
  AUDIOMORPHIC_WEB_URL,
  buildCronosPresetContent,
  CRONOS_PERSONALITY_ID,
  ConsciousnessLayerId,
  CronosFullContext,
  CronosLiveAction,
  CronosResponse,
  CronosSettings,
  DEFAULT_CRONOS_SETTINGS,
  ensureCronosPersonalityRegistered,
  gatherCronosFullContext,
  invokeCronosAstraura,
  loadCronosSettings,
  saveCronosSettings,
} from '../services/cronosAstraura';
import Icon from './Icon';
import ProtomoleculaOrb, { ProtomoleculaEstado } from './ProtomoleculaOrb';
import SaveToBrainModal from './SaveToBrainModal';

interface Props {
  onClose: () => void;
  onApplyPreset: (oscillators: Partial<OscillatorState>[], mode?: 'morph' | 'blend') => void;
  audio?: ReturnType<typeof useAudio>;
  fs?: ReturnType<typeof useFileSystem>;
  activeVizTab?: '2d' | '3d' | 'spiral';
  onVizTabChange?: (tab: '2d' | '3d' | 'spiral') => void;
  canEdit?: boolean;
}

interface CronosMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  response?: CronosResponse;
  executedLabels?: string[];
}

const LAYER_LABELS: { id: ConsciousnessLayerId; label: string; hint: string }[] = [
  { id: 'reflejo', label: 'Reflejo', hint: 'Control DSP <20 ms sin interrupciones' },
  { id: 'memoria', label: 'Memoria', hint: 'Cerebros StarSeed OS, carpetas y experiencia' },
  { id: 'red_viva', label: 'Red Viva', hint: 'OpenAlex, EuropePMC, Wiki, Noticias & OS' },
  { id: 'sintesis', label: 'Síntesis', hint: 'Astraura (OpenRouter :free / BitNet / Núcleo)' },
  { id: 'colectiva', label: 'Colectiva', hint: 'Comunidad Omni, Salas y Audiomorphic' },
];

const QUICK_PROMPTS = [
  {
    tag: 'En Vivo',
    text: 'Afina lo que suena ahora a relación 432 Hz, expande el campo espacial 3D y abre el Espiral Holográfico',
  },
  {
    tag: 'Ciencia + 21 Capas',
    text: 'Investiga neuroplasticidad y arrastre Gamma 40 Hz y sintetiza una matriz armónica completa de 21 capas',
  },
  {
    tag: 'Audiomorphic + Tesla',
    text: 'Diseña una arquitectura Vórtex 3-6-9 con 528 Hz, 7.83 Hz Schumann y geometría sagrada Audiomorphic',
  },
  {
    tag: 'Modulación Suave',
    text: 'Agrega una capa binaural Theta 5.5 Hz y baja suavemente el volumen al 65%',
  },
];

const renderFormattedText = (text: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
};

export const AIGeneratorModal: React.FC<Props> = ({
  onClose,
  onApplyPreset,
  audio,
  fs,
  activeVizTab = '2d',
  onVizTabChange,
  canEdit = true,
}) => {
  const [settings, setSettings] = useState<CronosSettings>(() => loadCronosSettings());
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [orbEstado, setOrbEstado] = useState<ProtomoleculaEstado>('reposo');
  const [personaStatus, setPersonaStatus] = useState<{ local: boolean; cloud: boolean }>({
    local: true,
    cloud: false,
  });
  const [contextSnapshot, setContextSnapshot] = useState<CronosFullContext | null>(null);
  const [savePresetModal, setSavePresetModal] = useState<GeminiWavePreset | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const resolvedVizTab = (activeVizTab === '3d' || activeVizTab === 'spiral' ? activeVizTab : '2d') as '2d' | '3d' | 'spiral';

  const [messages, setMessages] = useState<CronosMessage[]>(() => [
    {
      id: 'cronos-welcome',
      role: 'assistant',
      timestamp: Date.now(),
      content:
        'Soy **Cronos**, personalidad especializada de **Astraura · StarSeed OS** para física ondulatoria, bio-resonancia, **Omni-Frecuencias** y **Audiomorphic**. Puedo investigar artículos científicos recientes en tiempo real, leer el estado de tus Cerebros y modular directamente tus osciladores sin interrumpir el sonido.',
    },
  ]);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  const updateSettings = (patch: Partial<CronosSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveCronosSettings(next);
      return next;
    });
  };

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    ensureCronosPersonalityRegistered(fs?.user || null).then((res) => {
      setPersonaStatus(res);
    });
  }, [fs?.user?.id]);

  useEffect(() => {
    let cancelled = false;
    const loadCtx = async () => {
      if (!fs) return;
      const ctx = await gatherCronosFullContext({
        user: fs.user,
        brains: fs.brains,
        selectedBrain: fs.selectedBrain,
        root: fs.root,
        activeOscillators: audio?.oscillators || [],
        isPlaying: Boolean(audio?.isPlaying),
        masterVolume: audio?.masterVolume ?? 1.0,
        activeVizTab: resolvedVizTab,
        activeSourceLabel: fs.activeSourceNode
          ? `${fs.activeSourceNode.folderPath} / ${fs.activeSourceNode.name}`
          : null,
      });
      if (!cancelled) setContextSnapshot(ctx);
    };
    loadCtx();
    return () => {
      cancelled = true;
    };
  }, [
    fs?.user?.id,
    fs?.selectedBrainId,
    fs?.root,
    audio?.oscillators?.length,
    audio?.isPlaying,
    activeVizTab,
  ]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const executeLiveActions = async (actions: CronosLiveAction[]): Promise<string[]> => {
    const executed: string[] = [];
    if (!canEdit) return executed;

    for (const act of actions) {
      if (act.type === 'morph_oscillators') {
        if (audio?.morphOscillatorsLive) {
          audio.morphOscillatorsLive(act.oscillators, {
            mode: act.mode || 'morph',
            glideSec: act.glideSec ?? 0.7,
            autoPlay: true,
          });
        } else {
          onApplyPreset(act.oscillators, act.mode || 'morph');
        }
        executed.push(act.label);
      } else if (act.type === 'audio_adjustment' && audio?.applyLiveAdjustment) {
        const msg = await audio.applyLiveAdjustment(act.command);
        executed.push(msg || act.label);
      } else if (act.type === 'set_visualizer' && onVizTabChange) {
        onVizTabChange(act.tab);
        executed.push(act.label);
      } else if (act.type === 'update_source_file' && fs) {
        const res = fs.updateSourceNodeInPlace({
          content: {
            oscillators: audio?.oscillators || [],
            updatedAt: Date.now(),
          },
        });
        executed.push(res.ok ? `Origen actualizado: ${res.updatedPath}` : res.error || 'Origen no actualizado');
      }
    }
    return executed;
  };

  const handleSend = async (customText?: string) => {
    const text = (customText !== undefined ? customText : prompt).trim();
    if (!text || isLoading) return;

    const userMsg: CronosMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    if (customText === undefined) setPrompt('');
    setIsLoading(true);
    setOrbEstado(settings.webResearchEnabled ? 'investigando' : 'sintetizando');

    try {
      const freshCtx: CronosFullContext =
        fs
          ? await gatherCronosFullContext({
              user: fs.user,
              brains: fs.brains,
              selectedBrain: fs.selectedBrain,
              root: fs.root,
              activeOscillators: audio?.oscillators || [],
              isPlaying: Boolean(audio?.isPlaying),
              masterVolume: audio?.masterVolume ?? 1.0,
              activeVizTab: resolvedVizTab,
              activeSourceLabel: fs.activeSourceNode
                ? `${fs.activeSourceNode.folderPath} / ${fs.activeSourceNode.name}`
                : null,
            })
          : contextSnapshot || {
              user: null,
              selectedBrain: null,
              brains: [],
              treeStats: { folders: 0, files: 0 },
              savedItemsSummary: [],
              activeOscillators: audio?.oscillators || [],
              isPlaying: Boolean(audio?.isPlaying),
              masterVolume: audio?.masterVolume ?? 1.0,
              activeVizTab: resolvedVizTab,
              activeSourceLabel: null,
              communityCount: 0,
              communitySample: [],
              liveSessionsCount: 0,
              liveSessionsSample: [],
              installedLibraryTools: [],
              audiomorphicUrl: AUDIOMORPHIC_WEB_URL,
            };

      setContextSnapshot(freshCtx);

      const response = await invokeCronosAstraura({
        prompt: text,
        history: nextMessages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        settings,
        context: freshCtx,
      });

      setOrbEstado('modulando');

      let executedLabels: string[] = [];
      if (settings.liveControlEnabled && response.actions.length > 0) {
        executedLabels = await executeLiveActions(response.actions);
      }

      const assistantMsg: CronosMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.reply,
        timestamp: Date.now(),
        response,
        executedLabels,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Se produjo una interrupción temporal (${err?.message || 'error'}). Puedes reintentar sin perder tu audio activo.`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => setOrbEstado('reposo'), 1600);
    }
  };

  const activeOscCount = audio?.oscillators?.length || 0;
  const activeHzBadge = useMemo(() => {
    const oscs = audio?.oscillators || [];
    if (oscs.length === 0) return 'Sin ondas activas';
    return oscs
      .slice(0, 3)
      .map((o) => `${Number(o.frequency).toFixed(o.frequency % 1 === 0 ? 0 : 1)} Hz`)
      .join(' · ') + (oscs.length > 3 ? ` (+${oscs.length - 3})` : '');
  }, [audio?.oscillators]);

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-stretch sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-black/90 backdrop-blur-xl overflow-hidden"
      onClick={onClose}
    >
      <div
        className="relative z-10 w-full max-w-5xl h-full sm:h-[90dvh] sm:max-h-[90dvh] bg-[#050915]/95 border border-cyan-500/35 rounded-none sm:rounded-3xl shadow-[0_0_80px_rgba(34,211,238,0.22),inset_0_0_30px_rgba(34,211,238,0.05)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Luminous Hairline */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent shrink-0" />

        {/* Header */}
        <div className="px-3 sm:px-6 py-2 sm:py-3.5 border-b border-white/10 bg-black/55 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-initial order-1">
            <div className="p-1.5 sm:p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-400/35 text-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.25)] shrink-0">
              <Icon name="Sparkles" size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2 className="text-xs sm:text-lg font-display font-black text-white truncate">
                  Cronos · Astraura StarSeed OS
                </h2>
                <span className="hidden xs:inline-block px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-400/35 text-[9px] font-bold uppercase tracking-wider text-purple-200">
                  {personaStatus.cloud ? 'Astraura Sync' : 'Personalidad Activa'}
                </span>
              </div>
              <p className="hidden sm:block text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200/65 truncate">
                Síntesis Multicapa · Red Viva · Control Real-Time · Audiomorphic
              </p>
            </div>
          </div>

          {/* Optional Feature Switches */}
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto sm:ml-auto order-3 sm:order-2">
            {/* Protomolecule Optional Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={settings.protomoleculeEnabled}
              onClick={() => updateSettings({ protomoleculeEnabled: !settings.protomoleculeEnabled })}
              className={`px-2.5 py-1 sm:py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all ${
                settings.protomoleculeEnabled
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                  : 'bg-white/5 border-white/15 text-slate-400 hover:text-white'
              }`}
              title="Activar / desactivar visualización 4D de Protomolécula StarSeed"
            >
              <Icon name="Atom" size={12} />
              <span>Protomolécula</span>
            </button>

            {/* Live Control Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={settings.liveControlEnabled}
              onClick={() => updateSettings({ liveControlEnabled: !settings.liveControlEnabled })}
              className={`px-2.5 py-1 sm:py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all ${
                settings.liveControlEnabled
                  ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                  : 'bg-white/5 border-white/15 text-slate-400 hover:text-white'
              }`}
              title="Permitir que Cronos module el sonido y visualizadores en tiempo real sin cortes"
            >
              <Icon name="Radio" size={12} />
              <span>En Vivo</span>
            </button>

            {/* Live Internet Research Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={settings.webResearchEnabled}
              onClick={() => updateSettings({ webResearchEnabled: !settings.webResearchEnabled })}
              className={`px-2.5 py-1 sm:py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all ${
                settings.webResearchEnabled
                  ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-200'
                  : 'bg-white/5 border-white/15 text-slate-400 hover:text-white'
              }`}
              title="Consultar artículos OpenAlex, EuropePMC, Wiki, Noticias y Biblioteca StarSeed"
            >
              <Icon name="Globe" size={12} />
              <span>Red Viva</span>
            </button>
          </div>

          {/* Utility Controls (Always top-right on Row 1) */}
          <div className="flex items-center gap-1.5 shrink-0 order-2 sm:order-3">
            <button
              type="button"
              onClick={() => setShowSettingsDrawer((v) => !v)}
              aria-label="Ajustes de Capas Astraura"
              className={`p-1.5 sm:p-2 rounded-xl border cursor-pointer transition-colors ${
                showSettingsDrawer
                  ? 'bg-purple-500/25 border-purple-400/50 text-purple-100'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              <Icon name="Sliders" size={15} />
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar Cronos"
              className="p-1.5 sm:p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-cyan-400/40 cursor-pointer"
            >
              <Icon name="X" size={16} />
            </button>
          </div>
        </div>

        {/* Collapsible Astraura Layers & API Drawer */}
        {showSettingsDrawer && (
          <div className="px-3 sm:px-6 py-3 border-b border-white/10 bg-[#080d1c] space-y-3 shrink-0 max-h-[42dvh] overflow-y-auto custom-scrollbar">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
                Capas de Conciencia StarSeed OS Activas
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-[10px] text-slate-200 cursor-pointer bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                  <input
                    type="checkbox"
                    checked={settings.multiAgentEnabled}
                    onChange={(e) => updateSettings({ multiAgentEnabled: e.target.checked })}
                    className="accent-cyan-400"
                  />
                  Multi-Agente
                </label>
                <label className="inline-flex items-center gap-1.5 text-[10px] text-slate-200 cursor-pointer bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                  <input
                    type="checkbox"
                    checked={settings.localBitnetEnabled}
                    onChange={(e) => updateSettings({ localBitnetEnabled: e.target.checked })}
                    className="accent-emerald-400"
                  />
                  BitNet 1.58-bit Local
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {LAYER_LABELS.map((layer) => {
                const active = settings.activeLayers[layer.id];
                return (
                  <button
                    key={layer.id}
                    type="button"
                    onClick={() =>
                      updateSettings({
                        activeLayers: { ...settings.activeLayers, [layer.id]: !active },
                      })
                    }
                    title={layer.hint}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-cyan-500/15 border-cyan-400/40 text-white'
                        : 'bg-black/40 border-white/10 text-slate-500'
                    }`}
                  >
                    <div className="text-[11px] font-bold flex items-center justify-between">
                      <span>{layer.label}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                    </div>
                    <div className="text-[9px] text-slate-400 truncate mt-0.5">{layer.hint}</div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <input
                type="password"
                value={settings.customApiKey}
                onChange={(e) => updateSettings({ customApiKey: e.target.value })}
                placeholder="Clave API opcional (OpenRouter sk-or-..., Groq gsk_..., o Gemini)"
                className="bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
              />
              <input
                type="text"
                value={settings.localBitnetUrl}
                onChange={(e) => updateSettings({ localBitnetUrl: e.target.value })}
                placeholder="Endpoint BitNet/Ollama local (http://127.0.0.1:8790/v1/chat/completions)"
                className="bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
              <span>
                Personalidad registrada en StarSeed OS: <strong className="text-cyan-200">Cronos</strong> (ID: {CRONOS_PERSONALITY_ID_SHORT})
              </span>
              <button
                type="button"
                onClick={() => updateSettings(DEFAULT_CRONOS_SETTINGS)}
                className="text-slate-400 hover:text-white underline cursor-pointer"
              >
                Restablecer Ajustes Astraura
              </button>
            </div>
          </div>
        )}

        {/* Main Responsive Body: Optional Protomolecule Pane + Full Flex Chat */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {settings.protomoleculeEnabled && (
            <>
              {/* Mobile Compact Protomolecule Strip */}
              <div className="md:hidden px-3 py-2 border-b border-white/10 bg-black/50 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <ProtomoleculaOrb
                    estado={orbEstado}
                    analyser={audio?.getCombinedAnalyser?.()}
                    size={52}
                    compact
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-white truncate">
                      Protomolécula 4D · {activeOscCount} capas
                    </div>
                    <div className="text-[10px] font-mono text-cyan-300 truncate">{activeHzBadge}</div>
                  </div>
                </div>
                <a
                  href={AUDIOMORPHIC_WEB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-purple-500/20 border border-purple-400/35 text-[10px] font-bold text-purple-200 shrink-0 flex items-center gap-1"
                >
                  <Icon name="ExternalLink" size={11} />
                  Audiomorphic
                </a>
              </div>

              {/* Desktop Proportional Left Protomolecule & Telemetry Column */}
              <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 border-r border-white/10 bg-black/40 p-4 flex-col justify-between gap-3 overflow-y-auto custom-scrollbar">
                <div className="flex flex-col items-center">
                  <ProtomoleculaOrb
                    estado={orbEstado}
                    analyser={audio?.getCombinedAnalyser?.()}
                    size={168}
                  />
                </div>

                <div className="space-y-2.5 text-[11px]">
                  <div className="rounded-xl bg-white/[0.03] border border-white/10 p-2.5 space-y-1">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-cyan-300 flex items-center justify-between">
                      <span>Motor en Vivo</span>
                      <span className={audio?.isPlaying ? 'text-emerald-300' : 'text-slate-400'}>
                        {audio?.isPlaying ? 'ACTIVO' : 'LISTO'}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-white truncate">{activeHzBadge}</div>
                    <div className="text-[10px] text-slate-400">
                      Vol: {Math.round((audio?.masterVolume ?? 1) * 100)}% · Vista: {activeVizTab.toUpperCase()}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/[0.03] border border-white/10 p-2.5 space-y-1">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-purple-300">
                      Contexto StarSeed OS
                    </div>
                    <div className="text-[10px] text-slate-200 truncate">
                      {fs?.user
                        ? `Cerebro: ${fs.selectedBrain?.name || 'Personal'}`
                        : `Local: ${fs?.localLocationMeta?.label || 'Dispositivo'}`}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {contextSnapshot?.treeStats.folders || 0} carp. · {contextSnapshot?.treeStats.files || 0} partículas
                    </div>
                    {fs?.activeSourceNode && (
                      <div className="text-[10px] text-emerald-300 truncate" title={fs.activeSourceNode.name}>
                        Origen: {fs.activeSourceNode.name}
                      </div>
                    )}
                  </div>

                  <a
                    href={AUDIOMORPHIC_WEB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-3 rounded-xl bg-purple-500/15 hover:bg-purple-500/30 border border-purple-400/35 text-[10px] font-bold uppercase tracking-wider text-purple-100 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Icon name="ExternalLink" size={12} />
                    Abrir Audiomorphic AR/XR
                  </a>
                </div>
              </aside>
            </>
          )}

          {/* Right Flex Column: Interactive Cronos Conversation + Real-Time Dispatch */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            {statusNotice && (
              <div className="mx-3 sm:mx-5 mt-2 px-3 py-1.5 rounded-xl bg-emerald-950/75 border border-emerald-500/40 text-xs text-emerald-200 flex items-center justify-between shrink-0">
                <span>{statusNotice}</span>
                <button onClick={() => setStatusNotice(null)} className="cursor-pointer opacity-70 hover:opacity-100">
                  <Icon name="X" size={13} />
                </button>
              </div>
            )}

            {/* Chat Feed */}
            <div
              ref={chatScrollRef}
              className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-3.5 custom-scrollbar"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[94%] sm:max-w-[88%] rounded-2xl p-3 sm:p-4 border text-xs sm:text-sm space-y-2.5 ${
                      msg.role === 'user'
                        ? 'bg-cyan-950/55 border-cyan-400/40 text-cyan-50'
                        : 'bg-black/60 border-white/12 text-slate-200'
                    }`}
                  >
                    {msg.role === 'assistant' && msg.response && (
                      <div className="flex flex-wrap items-center gap-1.5 pb-1.5 border-b border-white/10">
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/35 text-[9px] font-bold uppercase tracking-wider text-cyan-300">
                          {msg.response.providerLabel}
                        </span>
                        {msg.response.layersUsed.map((lid) => (
                          <span
                            key={lid}
                            className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] text-slate-300 uppercase"
                          >
                            {lid}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="leading-relaxed whitespace-pre-wrap">{renderFormattedText(msg.content)}</div>

                    {/* Executed Live Audio / Visualizer Actions */}
                    {msg.executedLabels && msg.executedLabels.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {msg.executedLabels.map((lbl, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-[10px] font-bold text-emerald-200"
                          >
                            <Icon name="Check" size={11} />
                            {lbl}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Multi-agent contrast notes */}
                    {msg.response?.multiAgentNotes && msg.response.multiAgentNotes.length > 0 && (
                      <div className="rounded-xl bg-purple-950/30 border border-purple-500/25 p-2.5 space-y-1 text-[11px] text-purple-100">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-purple-300">
                          Contraste Multi-Agente Astraura
                        </div>
                        {msg.response.multiAgentNotes.map((n, idx) => (
                          <div key={idx}>• {n}</div>
                        ))}
                      </div>
                    )}

                    {/* Synthesized Preset Card */}
                    {msg.response?.preset && (
                      <div className="rounded-xl bg-[#070d1d] border border-cyan-500/35 p-3 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-cyan-200">
                              {msg.response.preset.title}
                            </h4>
                            <p className="text-[10px] text-purple-300">
                              {msg.response.preset.mathematicalConcept}
                            </p>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-[10px] font-mono font-bold text-cyan-300">
                            {msg.response.preset.oscillators.length} capas
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                          {msg.response.preset.oscillators.map((osc, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px]"
                            >
                              <span className="flex items-center gap-1.5 truncate pr-2">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: osc.color || '#38bdf8' }}
                                />
                                <span className="truncate text-white font-semibold">{osc.name}</span>
                              </span>
                              <span className="font-mono text-cyan-300 font-bold shrink-0">
                                {osc.frequency} Hz
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => {
                              onApplyPreset(msg.response!.preset!.oscillators, 'morph');
                              setStatusNotice('Sinergia aplicada suavemente al Espectrómetro en tiempo real.');
                              setTimeout(() => setStatusNotice(null), 3500);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500 text-cyan-100 hover:text-black border border-cyan-400/45 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                          >
                            <Icon name="Zap" size={12} /> Modular En Vivo
                          </button>

                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => {
                              onApplyPreset(msg.response!.preset!.oscillators, 'blend');
                              setStatusNotice('Capas mezcladas sobre la sesión activa sin cortes.');
                              setTimeout(() => setStatusNotice(null), 3500);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/40 text-purple-100 border border-purple-400/45 text-[10px] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-40"
                          >
                            + Mezclar
                          </button>

                          {fs && (
                            <button
                              type="button"
                              onClick={() => setSavePresetModal(msg.response!.preset!)}
                              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-200 border border-white/15 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                            >
                              <Icon name="FolderPlus" size={12} /> Guardar en Cerebro
                            </button>
                          )}

                          {fs?.activeSourceNode && fs.canWriteCurrentBrain && (
                            <button
                              type="button"
                              onClick={() => {
                                const res = fs.updateSourceNodeInPlace({
                                  content: buildCronosPresetContent(msg.response!.preset!),
                                });
                                setStatusNotice(
                                  res.ok
                                    ? `Archivo origen actualizado en "${res.updatedPath}".`
                                    : res.error || 'No se pudo actualizar.'
                                );
                                setTimeout(() => setStatusNotice(null), 4000);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/40 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                            >
                              <Icon name="Save" size={12} /> Actualizar Origen
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Audiomorphic Sync Card */}
                    {msg.response?.audiomorphic && (
                      <div className="rounded-xl bg-purple-950/25 border border-purple-500/30 p-2.5 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                        <div className="space-y-0.5 min-w-0">
                          <div className="font-bold text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
                            <Icon name="Aperture" size={12} />
                            Sinestesia Audiomorphic · {msg.response.audiomorphic.sacredGeometryMode}
                          </div>
                          <div className="text-slate-300 font-mono">
                            AutoPilot: {msg.response.audiomorphic.autoPilotMode} · Régimen {msg.response.audiomorphic.regime} · k={msg.response.audiomorphic.k} · ψ={msg.response.audiomorphic.psiDeg}°
                          </div>
                        </div>
                        <a
                          href={msg.response.audiomorphic.launchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-purple-500/25 hover:bg-purple-500 text-purple-100 hover:text-black border border-purple-400/40 font-bold uppercase shrink-0 flex items-center gap-1"
                        >
                          <Icon name="ExternalLink" size={11} /> Abrir Audiomorphic
                        </a>
                      </div>
                    )}

                    {/* Live Scientific & Web Research Citations */}
                    {msg.response?.research &&
                      (msg.response.research.papers.length > 0 ||
                        msg.response.research.wiki.length > 0 ||
                        msg.response.research.news.length > 0) && (
                        <div className="rounded-xl bg-black/50 border border-indigo-500/25 p-2.5 space-y-1.5 text-[10px]">
                          <div className="font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Icon name="Globe" size={11} />
                            Fuentes Vivas Consultadas (Ciencia, Web & StarSeed)
                          </div>
                          <div className="space-y-1 max-h-28 overflow-y-auto custom-scrollbar">
                            {msg.response.research.papers.slice(0, 3).map((p, idx) => (
                              <div key={`p-${idx}`} className="truncate text-slate-300">
                                <span className="text-cyan-300 font-bold">[{p.source} {p.year || ''}]</span>{' '}
                                {p.url ? (
                                  <a
                                    href={p.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline hover:text-cyan-200"
                                  >
                                    {p.title}
                                  </a>
                                ) : (
                                  p.title
                                )}
                              </div>
                            ))}
                            {msg.response.research.news.slice(0, 2).map((n, idx) => (
                              <div key={`n-${idx}`} className="truncate text-slate-300">
                                <span className="text-amber-300 font-bold">[Noticia]</span>{' '}
                                <a
                                  href={n.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline hover:text-amber-200"
                                >
                                  {n.title}
                                </a>
                              </div>
                            ))}
                            {msg.response.research.wiki.slice(0, 2).map((w, idx) => (
                              <div key={`w-${idx}`} className="truncate text-slate-300">
                                <span className="text-emerald-300 font-bold">[Wiki]</span>{' '}
                                <a
                                  href={w.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline hover:text-emerald-200"
                                >
                                  {w.title}
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center gap-2 text-xs text-cyan-300 px-3 py-2 rounded-xl bg-cyan-950/30 border border-cyan-500/25 w-fit">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                  <span>
                    Cronos procesando capas de conciencia
                    {settings.webResearchEnabled ? ', consultando red viva' : ''} y preparando modulación...
                  </span>
                </div>
              )}
            </div>

            {/* Compact Scrollable Quick Suggestions Bar */}
            <div className="px-3 sm:px-5 py-1.5 border-t border-white/10 bg-black/50 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              {QUICK_PROMPTS.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(q.text)}
                  disabled={isLoading}
                  className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-cyan-500/15 border border-white/10 hover:border-cyan-400/40 text-[10px] text-slate-300 hover:text-cyan-100 whitespace-nowrap shrink-0 cursor-pointer transition-colors disabled:opacity-40"
                >
                  <strong className="text-cyan-300 mr-1">{q.tag}:</strong>
                  {q.text.slice(0, 52)}...
                </button>
              ))}
            </div>

            {/* Bottom Prompt Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="p-2.5 sm:p-4 border-t border-white/10 bg-black/80 flex items-end gap-2 shrink-0"
            >
              <textarea
                rows={2}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Pídele a Cronos sintetizar capas, investigar o modular en vivo..."
                className="flex-1 bg-black/60 border border-white/15 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 resize-none"
              />
              <button
                type="submit"
                disabled={isLoading || !prompt.trim()}
                className="px-4 sm:px-5 py-3 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500 text-cyan-200 hover:text-black border border-cyan-400/50 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-all"
              >
                <Icon name="Send" size={15} />
                <span className="hidden sm:inline">Enviar</span>
              </button>
            </form>
          </div>
        </div>

        {/* Save Preset to Brain Modal directly from Cronos */}
        {savePresetModal && fs && (
          <SaveToBrainModal
            isOpen={Boolean(savePresetModal)}
            onClose={() => setSavePresetModal(null)}
            fs={fs}
            initialName={savePresetModal.title}
            initialCategory="synergy"
            initialContent={buildCronosPresetContent(savePresetModal, 'synergy')}
            sourceLabel="Síntesis Cronos · Astraura"
          />
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

const CRONOS_PERSONALITY_ID_SHORT = CRONOS_PERSONALITY_ID.slice(0, 8);

export default AIGeneratorModal;
