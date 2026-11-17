import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useWebRTC, RemoteStream } from '../hooks/useWebRTC';
import { useMeshSync } from '../hooks/useMeshSync';
import Icon from './Icon';
import {
  StarseedUser,
  fetchCommunityPresets,
  updateLiveSession,
  deleteLiveSession,
  normalizeOscillators
} from '../services/starseedAuth';
import {
  LiveSession,
  OscillatorState,
  FileSystemNode,
  CATEGORIES,
  RADIATION_MEDIUMS,
  RadiationMedium,
  TechnicalRecommendation
} from '../types';
import { autoSuggestTechnicalRecommendation } from '../utils/frequencyAnalysis';
import MeshSignalMap from './MeshSignalMap';
import VirtualVRRoom from './VirtualVRRoom';
import Visualizer from './Visualizer';
import { CymaticsVisualizer3D } from './CymaticsVisualizer3D';
import { SpiralVisualizer } from './SpiralVisualizer';
import OscillatorControls from './OscillatorControls';
import { useFileSystem } from '../hooks/useFileSystem';

const EDITABLE_CATEGORIES = CATEGORIES.filter(c => c.id !== 'all');

interface Props {
  session: LiveSession;
  currentUser: StarseedUser;
  audio?: any;
  onLeave: () => void;
  currentOscillators: OscillatorState[];
  activeVizTab?: '2d' | '3d' | 'spiral';
  onSyncReceive: (oscillators: any[], latencyMs?: number, vizTab?: string) => void;
  onPermissionsChange?: (perms: any) => void;
  onEndSession?: () => void;
}

const VideoPlayer: React.FC<{ stream: MediaStream; isLocal?: boolean; displayName: string }> = ({
  stream,
  isLocal,
  displayName
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black/90 border border-cyan-500/40 group aspect-video shadow-[0_0_25px_rgba(0,0,0,0.9)]">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
      />
      <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-bold text-white border border-white/10 flex items-center gap-2 shadow-lg">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        {displayName} {isLocal && '(Tú)'}
      </div>
    </div>
  );
};

const LiveSyncCall: React.FC<Props> = ({
  session,
  currentUser,
  audio,
  onLeave,
  currentOscillators,
  activeVizTab,
  onSyncReceive,
  onPermissionsChange,
  onEndSession
}) => {
  const [liveSession, setLiveSession] = useState<LiveSession>(session);
  useEffect(() => {
    setLiveSession(session);
  }, [session]);

  const isHost =
    liveSession.hostId === currentUser.id ||
    (liveSession.hostId === 'local-host' && (currentUser.id === 'anonymous' || !currentUser.id));

  const lastSentState = useRef<string>('');

  const [viewMode, setViewMode] = useState<'studio' | 'compact'>('studio');
  const [studioTab, setStudioTab] = useState<
    'visualizers' | 'generator' | 'video' | 'private_groups' | 'radar' | 'host' | 'filter'
  >('visualizers');

  const [showVRRoom, setShowVRRoom] = useState(false);
  const [compactPopup, setCompactPopup] = useState<'none' | 'graphics' | 'matrix' | 'radar' | 'privacy'>('none');

  // Mix & Load Preset Modal
  const [showMixModal, setShowMixModal] = useState(false);
  const [mixTab, setMixTab] = useState<'private' | 'community'>('private');
  const [mixCategory, setMixCategory] = useState<string>('all');
  const [mixSearch, setMixSearch] = useState<string>('');
  const [expandedMixIds, setExpandedMixIds] = useState<Record<string, boolean>>({});
  const [communityPresets, setCommunityPresets] = useState<FileSystemNode[]>([]);
  const [isLoadingCommunity, setIsLoadingCommunity] = useState(false);

  // Exit confirmation modal + Personal scope
  const [showExitModal, setShowExitModal] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [personalOffset, setPersonalOffset] = useState<number>(0);
  const [userTransmissionScope, setUserTransmissionScope] = useState<'public' | 'select' | 'listen_only'>('public');
  const [expandedViz, setExpandedViz] = useState<'2d' | '3d' | 'spiral' | null>(null);

  // Private Sub-Call states
  const [activePrivatePeer, setActivePrivatePeer] = useState<string | null>(null);
  const [privateGroupUserIds, setPrivateGroupUserIds] = useState<string[]>([]);

  // Host Permissions State
  const [localPermissions, setLocalPermissions] = useState({
    canEditFrequencies: liveSession.allowOpenModifications ?? true,
    canUseMic: true,
    canUseVideo: true,
    canChat: true
  });

  // Host Session Live Editor State
  const [hostTitle, setHostTitle] = useState(liveSession.presetName);
  const [hostCategory, setHostCategory] = useState(
    liveSession.category || liveSession.presetContent?.category || 'solfeggio'
  );
  const [hostDescription, setHostDescription] = useState(
    liveSession.description || liveSession.presetContent?.description || ''
  );
  const [hostIsPublic, setHostIsPublic] = useState(liveSession.isPublic);
  const [hostAllowOpenMod, setHostAllowOpenMod] = useState(liveSession.allowOpenModifications);
  const [hostFixedPerms, setHostFixedPerms] = useState(Boolean(liveSession.fixedPermissions));
  const [hostTechRec, setHostTechRec] = useState<TechnicalRecommendation>(() => {
    if (liveSession.presetContent?.technicalRecommendation) {
      return {
        ...liveSession.presetContent.technicalRecommendation,
        frequencyScales: { ...liveSession.presetContent.technicalRecommendation.frequencyScales }
      };
    }
    return autoSuggestTechnicalRecommendation(
      currentOscillators,
      liveSession.category || liveSession.presetContent?.category,
      liveSession.presetName
    );
  });
  const [savingHostMeta, setSavingHostMeta] = useState(false);
  const [hostSaveStatus, setHostSaveStatus] = useState<string | null>(null);

  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fs = useFileSystem();

  useEffect(() => {
    if (showMixModal && mixTab === 'community') {
      setIsLoadingCommunity(true);
      fetchCommunityPresets()
        .then(data => {
          setCommunityPresets(data);
        })
        .catch(err => console.error('Error cargando partículas comunitarias:', err))
        .finally(() => setIsLoadingCommunity(false));
    }
  }, [showMixModal, mixTab]);

  const handleSyncReceive = (oscillators: any[], latencyMs: number = 0, vizTab?: string) => {
    const adjustedOscillators =
      personalOffset !== 0
        ? oscillators.map(osc => ({
            ...osc,
            frequency: Math.max(0.1, Number(osc.frequency) + personalOffset)
          }))
        : oscillators;

    lastSentState.current = JSON.stringify({ oscillators: adjustedOscillators, vizTab });
    onSyncReceive(adjustedOscillators, latencyMs, vizTab);
  };

  const {
    localStream,
    remoteStreams,
    participants,
    isVideoEnabled,
    isAudioEnabled,
    toggleVideo,
    toggleAudio,
    chatMessages,
    sendChatMessage,
    broadcastOscillatorSync,
    permissions: remotePermissions,
    broadcastPermissions
  } = useWebRTC(
    liveSession.id,
    currentUser.id,
    currentUser.displayName,
    liveSession.useGlobalWebRTC !== false,
    handleSyncReceive
  );

  const activePermissions = isHost ? localPermissions : remotePermissions;

  useEffect(() => {
    if (onPermissionsChange) {
      onPermissionsChange(activePermissions);
    }
  }, [activePermissions, onPermissionsChange]);

  const updateHostPermissions = (changes: any) => {
    if (!isHost) return;
    const newPerms = { ...localPermissions, ...changes };
    setLocalPermissions(newPerms);
    broadcastPermissions(newPerms);
  };

  const {
    connectionState: meshState,
    latencyDelta,
    broadcastData: broadcastMeshOscillators
  } = useMeshSync(payload => {
    if (payload.type === 'oscillator_sync' && payload.sender !== currentUser.id) {
      const latency = payload.timestamp ? Date.now() - payload.timestamp : latencyDelta;
      handleSyncReceive(payload.oscillators, latency, payload.vizTab);
    }
  });

  useEffect(() => {
    const currentState = JSON.stringify({ oscillators: currentOscillators, vizTab: activeVizTab });
    if (currentState !== lastSentState.current) {
      lastSentState.current = currentState;
      const timeoutId = setTimeout(() => {
        broadcastOscillatorSync(currentOscillators, activeVizTab);
        broadcastMeshOscillators({
          type: 'oscillator_sync',
          sender: currentUser.id,
          oscillators: currentOscillators,
          vizTab: activeVizTab
        });
      }, 150);
      return () => clearTimeout(timeoutId);
    }
  }, [currentOscillators, activeVizTab, broadcastOscillatorSync, broadcastMeshOscillators, currentUser.id]);

  useEffect(() => {
    if (showChat) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showChat]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      sendChatMessage(chatInput.trim());
      setChatInput('');
    }
  };

  const togglePrivateGroupUser = (userId: string) => {
    setPrivateGroupUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const activeFrequenciesList = currentOscillators.map(o => o.frequency);
  const analyserNode = audio?.getCombinedAnalyser?.() || audio?.analyser || null;

  // Mix / Replace Presets Logic (Preserving ALL OscillatorState properties)
  const handleApplyPresetToLive = (presetOscillators: OscillatorState[], mode: 'replace' | 'mix') => {
    if (!audio || !Array.isArray(presetOscillators)) return;
    const normalized = normalizeOscillators(presetOscillators);

    if (mode === 'replace') {
      if (typeof audio.loadPreset === 'function') {
        audio.loadPreset({ oscillators: normalized });
      } else if (typeof audio.syncFromRemote === 'function') {
        audio.syncFromRemote(normalized);
      }
    } else {
      normalized.forEach(osc => {
        const { id: _ignoreId, ...rest } = osc;
        audio.addOscillator({
          ...rest,
          frequency: osc.frequency,
          type: osc.type,
          volume: osc.volume,
          panX: osc.panX,
          panY: osc.panY,
          panZ: osc.panZ,
          name: osc.name,
          color: osc.color,
          crestValleyRatio: osc.crestValleyRatio,
          dutyCycle: osc.dutyCycle,
          harmonicDistortion: osc.harmonicDistortion,
          phaseOffset: osc.phaseOffset,
          isIndependent: osc.isIndependent,
          isPlaying: osc.isPlaying,
          ...(osc.type2 ? { type2: osc.type2 } : {}),
          ...(typeof osc.typeMix === 'number' ? { typeMix: osc.typeMix } : {}),
          ...(osc.transition ? { transition: osc.transition } : {})
        });
      });
    }
    setShowMixModal(false);
  };

  const getPrivateFiles = (node: FileSystemNode): FileSystemNode[] => {
    let res: FileSystemNode[] = [];
    if (node.type === 'file') res.push(node);
    if (node.children) {
      node.children.forEach(c => {
        res = res.concat(getPrivateFiles(c));
      });
    }
    return res;
  };

  const privateFiles = useMemo(() => getPrivateFiles(fs.root), [fs.root]);

  const filteredMixItems = useMemo(() => {
    const source = mixTab === 'private' ? privateFiles : communityPresets;
    const q = mixSearch.trim().toLowerCase();
    return source.filter(item => {
      const cat = item.content?.category || 'synergy';
      const matchCat = mixCategory === 'all' || cat === mixCategory;
      const matchQ =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.content?.description || '').toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [mixTab, privateFiles, communityPresets, mixCategory, mixSearch]);

  // Generator Helper Actions inside Live Studio
  const handleAddOscillator = () => {
    if (audio?.addOscillator) {
      audio.addOscillator();
    }
  };

  const handleUpdateOscillator = (id: string, updates: Partial<OscillatorState>) => {
    if (audio?.updateOscillator) {
      audio.updateOscillator(id, updates);
    }
  };

  const handleRemoveOscillator = (id: string) => {
    if (audio?.removeOscillator) {
      audio.removeOscillator(id);
    }
  };

  const handleSolfeggioAdd = (freq: number, label: string) => {
    if (audio?.addOscillator) {
      audio.addOscillator({
        frequency: freq,
        type: 'sine',
        volume: 0.5,
        panX: 0,
        panY: 0,
        panZ: 0,
        name: label,
        isIndependent: false,
        color: '#fbbf24'
      });
    }
  };

  const handleSaveHostSessionDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHost) return;
    setSavingHostMeta(true);
    setHostSaveStatus(null);

    try {
      const updatedContent = {
        ...liveSession.presetContent,
        oscillators: currentOscillators.length > 0 ? currentOscillators : liveSession.presetContent.oscillators,
        category: hostCategory,
        description: hostDescription.trim() || undefined,
        technicalRecommendation: hostTechRec,
        updatedAt: Date.now()
      };

      const updated = await updateLiveSession(liveSession.id, liveSession.hostId, {
        presetName: hostTitle.trim() || liveSession.presetName,
        isPublic: hostIsPublic,
        allowOpenModifications: hostAllowOpenMod,
        presetContent: updatedContent,
        metadata: {
          description: hostDescription.trim() || undefined,
          category: hostCategory,
          fixedPermissions: hostFixedPerms,
          cover_url: liveSession.cover_url,
          avatar_url: liveSession.avatar_url,
          useGlobalWebRTC: liveSession.useGlobalWebRTC,
          useLocalMesh: liveSession.useLocalMesh
        }
      });

      if (updated) {
        setLiveSession(updated);
      } else {
        setLiveSession(prev => ({
          ...prev,
          presetName: hostTitle.trim() || prev.presetName,
          category: hostCategory,
          description: hostDescription.trim(),
          isPublic: hostIsPublic,
          allowOpenModifications: hostAllowOpenMod,
          fixedPermissions: hostFixedPerms,
          presetContent: updatedContent
        }));
      }

      updateHostPermissions({ canEditFrequencies: hostAllowOpenMod });
      setHostSaveStatus('Cambios de la transmisión guardados.');
      setTimeout(() => setHostSaveStatus(null), 4000);
    } catch (err: any) {
      console.error(err);
      setHostSaveStatus(err?.message || 'No se pudo actualizar la sesión.');
    } finally {
      setSavingHostMeta(false);
    }
  };

  const handleEndTransmissionForAll = async () => {
    setIsEndingSession(true);
    try {
      await deleteLiveSession(liveSession.id);
    } catch (e) {
      console.warn('Error al cerrar sesión en servidor:', e);
    } finally {
      setIsEndingSession(false);
      setShowExitModal(false);
      if (onEndSession) onEndSession();
      else onLeave();
    }
  };

  const toggleHostMedium = (mediumId: RadiationMedium) => {
    setHostTechRec(prev => {
      const exists = prev.recommendedMediums.includes(mediumId);
      const next = exists
        ? prev.recommendedMediums.filter(m => m !== mediumId)
        : [...prev.recommendedMediums, mediumId];
      return {
        ...prev,
        recommendedMediums: next.length > 0 ? next : ['acustica']
      };
    });
  };

  const renderExitModal = () => {
    if (!showExitModal) return null;
    return (
      <div
        className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-lg flex items-center justify-center p-4 animate-fade-in"
        onClick={() => !isEndingSession && setShowExitModal(false)}
      >
        <div
          className="w-full max-w-md bg-[#0a0f1f] border border-red-500/40 rounded-3xl p-6 space-y-5 shadow-[0_0_50px_rgba(239,68,68,0.25)]"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-300">
                <Icon name="LogOut" size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Salir de la Transmisión</h3>
                <p className="text-xs text-slate-400">Eres el anfitrión de "{liveSession.presetName}"</p>
              </div>
            </div>
            <button
              type="button"
              disabled={isEndingSession}
              onClick={() => setShowExitModal(false)}
              className="text-slate-400 hover:text-white p-1"
            >
              <Icon name="X" size={18} />
            </button>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Elige si deseas desconectarte manteniendo la sala viva para los demás participantes, o finalizar y cerrar la transmisión para todos.
          </p>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              disabled={isEndingSession}
              onClick={() => {
                setShowExitModal(false);
                onLeave();
              }}
              className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              Solo Salir (Mantener Sesión Activa)
            </button>

            <button
              type="button"
              disabled={isEndingSession}
              onClick={handleEndTransmissionForAll}
              className="w-full py-3 px-4 rounded-xl bg-red-600/80 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isEndingSession ? (
                <Icon name="Loader" size={14} className="animate-spin" />
              ) : (
                <Icon name="Trash2" size={14} />
              )}
              Finalizar Transmisión para Todos
            </button>

            <button
              type="button"
              disabled={isEndingSession}
              onClick={() => setShowExitModal(false)}
              className="w-full py-2.5 px-4 rounded-xl text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // FULL STUDIO VIEW (VENTANA COMPLETA)
  // -------------------------------------------------------------
  if (viewMode === 'studio') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-2xl animate-fade-in">
        {renderExitModal()}

        <div className="bg-[#070a14] border border-cyan-500/40 rounded-3xl w-full max-w-7xl h-[95vh] sm:h-[92vh] flex flex-col shadow-[0_0_90px_rgba(34,211,238,0.22)] overflow-hidden relative">
          {showVRRoom && (
            <VirtualVRRoom
              participants={participants.map(p => ({
                id: p.id,
                name: p.displayName,
                color: p.id === currentUser.id ? '#22d3ee' : '#a855f7'
              }))}
              currentUserId={currentUser.id}
              analyser={analyserNode}
              frequencies={activeFrequenciesList}
              onClose={() => setShowVRRoom(false)}
            />
          )}

          {/* Preset Mix & Load Modal */}
          {showMixModal && (
            <div
              className="absolute inset-0 z-[130] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
              onClick={() => setShowMixModal(false)}
            >
              <div
                className="bg-[#0b1224] border border-amber-500/45 p-4 sm:p-6 rounded-3xl max-w-3xl w-full shadow-[0_0_60px_rgba(245,158,11,0.25)] flex flex-col gap-4 max-h-[88vh]"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-amber-500/25 pb-3 gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-amber-300 flex items-center gap-2">
                    <Icon name="Folder" size={18} /> Mezclar / Cargar Partículas en Vivo
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowMixModal(false)}
                    className="text-slate-400 hover:text-white p-1 cursor-pointer"
                  >
                    <Icon name="X" size={18} />
                  </button>
                </div>

                {/* Source Tabs & Search */}
                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMixTab('private')}
                      className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        mixTab === 'private' ? 'bg-amber-500 text-black' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      Mi Biblioteca ({privateFiles.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMixTab('community')}
                      className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        mixTab === 'community' ? 'bg-cyan-500 text-black' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      Comunidad Vibras
                    </button>
                  </div>

                  <div className="relative flex-1 sm:max-w-xs">
                    <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={mixSearch}
                      onChange={e => setMixSearch(e.target.value)}
                      placeholder="Buscar partícula..."
                      className="w-full bg-black/60 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Category Chips */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar shrink-0">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setMixCategory(cat.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border transition-colors cursor-pointer ${
                        mixCategory === cat.id
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                          : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Icon name={cat.iconName} size={11} className={cat.color} />
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5 pr-1">
                  {mixTab === 'community' && isLoadingCommunity ? (
                    <p className="text-xs text-cyan-400 font-bold py-10 text-center flex items-center justify-center gap-2">
                      <Icon name="Loader" size={16} className="animate-spin" /> Cargando Partículas Públicas...
                    </p>
                  ) : filteredMixItems.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-10 text-center">
                      No hay partículas disponibles con este filtro.
                    </p>
                  ) : (
                    filteredMixItems.map(item => {
                      const oscs = item.content?.oscillators || [];
                      const catInfo = CATEGORIES.find(c => c.id === item.content?.category);
                      const tech =
                        item.content?.technicalRecommendation ||
                        autoSuggestTechnicalRecommendation(oscs, item.content?.category, item.name);
                      const isExpanded = Boolean(expandedMixIds[item.id]);

                      return (
                        <div
                          key={item.id}
                          className="p-3.5 bg-white/[0.04] border border-white/10 rounded-2xl flex flex-col gap-2.5"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-white truncate">{item.name}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-cyan-300 font-mono">
                                  {oscs.length} Osc
                                </span>
                                <span className={`text-[10px] font-bold ${catInfo?.color || 'text-purple-300'}`}>
                                  {catInfo?.label || item.content?.category || 'Sinergia'}
                                </span>
                              </div>
                              {item.content?.description && (
                                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                                  {item.content.description}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setExpandedMixIds(p => ({ ...p, [item.id]: !p[item.id] }))}
                                className="px-2.5 py-1.5 bg-white/5 hover:bg-white/15 border border-white/10 rounded-xl text-[11px] font-bold text-slate-300 flex items-center gap-1 cursor-pointer"
                              >
                                <Icon name="Sliders" size={12} />
                                <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplyPresetToLive(oscs, 'mix')}
                                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black rounded-xl text-xs font-bold transition-all border border-amber-500/40 cursor-pointer"
                              >
                                + Mezclar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplyPresetToLive(oscs, 'replace')}
                                className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-black rounded-xl text-xs font-bold transition-all border border-cyan-500/40 cursor-pointer"
                              >
                                Reemplazar
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="pt-2 border-t border-white/10 space-y-2 text-[11px]">
                              <div className="flex flex-wrap gap-1.5">
                                {oscs.map((o, idx) => (
                                  <span
                                    key={o.id || idx}
                                    className="px-2 py-1 rounded-lg bg-black/60 border border-white/10 font-mono text-[10px] text-cyan-200"
                                  >
                                    {o.frequency} Hz · {o.type} · {Math.round((o.volume ?? 0.5) * 100)}%
                                  </span>
                                ))}
                              </div>
                              <div className="bg-black/50 border border-white/5 rounded-xl p-2 text-[10px] text-slate-300">
                                <strong className="text-cyan-300 block">{tech.primaryMediumLabel}</strong>
                                <span>{tech.usageMode}</span>
                                <span className="block mt-1 font-mono text-slate-400">
                                  Vol: {tech.recommendedVolume} · {tech.recommendedVoltage || '1.2–12V'} · {tech.frequencyScales.opticalNm || ''}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Studio Top Header Bar */}
          <div className="p-3 sm:p-4 border-b border-white/10 flex flex-col lg:flex-row items-center justify-between bg-black/60 shrink-0 gap-3">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-ping shrink-0" />
              <div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h2 className="text-sm sm:text-lg font-bold text-white tracking-wide">{liveSession.presetName}</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    Estudio Holofónico
                  </span>
                </div>
                <p className="text-xs text-amber-400 font-bold">
                  Host: {liveSession.hostName} {isHost && '(Tú)'} · {participants.length || 1} Entonadores
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 w-full lg:w-auto">
              <button
                type="button"
                onClick={() => setShowVRRoom(true)}
                className="px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-black font-extrabold rounded-xl text-xs transition-all shadow-[0_0_20px_rgba(34,211,238,0.4)] flex items-center gap-1.5 cursor-pointer"
              >
                <Icon name="Compass" size={15} />
                <span>Sala VR/3D</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('compact')}
                className="px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-black rounded-xl text-xs font-bold transition-all border border-cyan-500/40 flex items-center gap-1.5 cursor-pointer"
                title="Cambiar a Widget Flotante"
              >
                <Icon name="Minimize2" size={15} />
                <span>Widget Flotante</span>
              </button>

              <button
                type="button"
                onClick={() => (isHost ? setShowExitModal(true) : onLeave())}
                className="px-3 py-2 bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-red-500/40 flex items-center gap-1.5 cursor-pointer"
              >
                <Icon name="LogOut" size={14} />
                <span>Desconectar</span>
              </button>
            </div>
          </div>

          {/* Studio Navigation Tabs Bar */}
          <div className="flex items-center gap-2 px-3 sm:px-6 py-2.5 border-b border-white/5 bg-black/40 overflow-x-auto custom-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => setStudioTab('visualizers')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                studioTab === 'visualizers' ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(34,211,238,0.4)]' : 'text-slate-400 hover:text-white bg-white/5'
              }`}
            >
              <Icon name="Activity" size={15} /> 3 Gráficas Simultáneas
            </button>

            <button
              type="button"
              onClick={() => setStudioTab('generator')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                studioTab === 'generator' ? 'bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)]' : 'text-slate-400 hover:text-white bg-white/5'
              }`}
            >
              <Icon name="Sliders" size={15} /> Matriz ({currentOscillators.length})
            </button>

            <button
              type="button"
              onClick={() => setStudioTab('video')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                studioTab === 'video' ? 'bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]' : 'text-slate-400 hover:text-white bg-white/5'
              }`}
            >
              <Icon name="Video" size={15} /> Audio/Video
            </button>

            <button
              type="button"
              onClick={() => setStudioTab('private_groups')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                studioTab === 'private_groups' ? 'bg-fuchsia-500 text-white shadow-[0_0_20px_rgba(217,70,239,0.4)]' : 'text-slate-400 hover:text-white bg-white/5'
              }`}
            >
              <Icon name="Users" size={15} /> Sub-Grupos
            </button>

            <button
              type="button"
              onClick={() => setStudioTab('radar')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                studioTab === 'radar' ? 'bg-green-500 text-black shadow-[0_0_20px_rgba(34,197,94,0.4)]' : 'text-slate-400 hover:text-white bg-white/5'
              }`}
            >
              <Icon name="Radio" size={15} className="animate-pulse" /> Radar Mesh
            </button>

            {isHost && (
              <button
                type="button"
                onClick={() => setStudioTab('host')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  studioTab === 'host' ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.4)]' : 'text-slate-400 hover:text-white bg-white/5'
                }`}
              >
                <Icon name="Shield" size={15} /> Panel Anfitrión
              </button>
            )}

            <button
              type="button"
              onClick={() => setStudioTab('filter')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                studioTab === 'filter' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white bg-white/5'
              }`}
            >
              <Icon name="Lock" size={15} /> Privacidad y Filtros
            </button>
          </div>

          {/* Studio Main Content Area */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 custom-scrollbar flex flex-col gap-6 relative">
            {/* TAB 1: 3 VISUALIZERS SIMULTANEOUS GRID */}
            {studioTab === 'visualizers' && (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
                  <h3 className="text-xs sm:text-sm uppercase tracking-wider font-bold text-cyan-300 flex items-center gap-2">
                    <Icon name="Activity" size={18} /> Visualización Simultánea Multidimensional
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    Activas: {activeFrequenciesList.length > 0 ? `${activeFrequenciesList.join(', ')} Hz` : 'Ninguna'}
                  </span>
                </div>

                <div className={`grid gap-4 ${expandedViz ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-3'}`}>
                  {/* 1. ONDAS 2D */}
                  {(!expandedViz || expandedViz === '2d') && (
                    <div className="bg-black/60 border border-cyan-500/30 rounded-3xl p-4 flex flex-col gap-3 relative shadow-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-cyan-400 flex items-center gap-2">
                          <Icon name="Activity" size={14} /> Ondas 2D Resonantes
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedViz(expandedViz === '2d' ? null : '2d')}
                          className="p-1.5 rounded-lg bg-white/5 text-slate-300 hover:text-white cursor-pointer"
                        >
                          <Icon name={expandedViz === '2d' ? 'Minimize2' : 'Maximize2'} size={14} />
                        </button>
                      </div>
                      <div className="bg-black/80 rounded-2xl overflow-hidden border border-white/5 relative">
                        <Visualizer analyser={analyserNode} height={expandedViz === '2d' ? 380 : 256} color="#22d3ee" type="fill" />
                      </div>
                    </div>
                  )}

                  {/* 2. CIMÁTICA 3D */}
                  {(!expandedViz || expandedViz === '3d') && (
                    <div className="bg-black/60 border border-purple-500/30 rounded-3xl p-4 flex flex-col gap-3 relative shadow-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-400 flex items-center gap-2">
                          <Icon name="Hexagon" size={14} /> Cimática 3D (Patrones Chladni)
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedViz(expandedViz === '3d' ? null : '3d')}
                          className="p-1.5 rounded-lg bg-white/5 text-slate-300 hover:text-white cursor-pointer"
                        >
                          <Icon name={expandedViz === '3d' ? 'Minimize2' : 'Maximize2'} size={14} />
                        </button>
                      </div>
                      <div className="bg-black/80 rounded-2xl border border-white/5 relative overflow-visible">
                        <CymaticsVisualizer3D
                          analyser={analyserNode}
                          activeFrequencies={activeFrequenciesList}
                          allOscillators={currentOscillators}
                          onUpdateOscillator={handleUpdateOscillator}
                          onRemoveOscillator={handleRemoveOscillator}
                          getOscillatorAnalyser={audio?.getOscillatorAnalyser}
                          isMasterPlaying={audio?.isPlaying ?? true}
                          height={expandedViz === '3d' ? 400 : 256}
                        />
                      </div>
                    </div>
                  )}

                  {/* 3. ESPIRAL CUÁNTICA */}
                  {(!expandedViz || expandedViz === 'spiral') && (
                    <div className="bg-black/60 border border-pink-500/30 rounded-3xl p-4 flex flex-col gap-3 relative shadow-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-pink-400 flex items-center gap-2">
                          <Icon name="Aperture" size={14} /> Espiral Cuántica Armónica
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedViz(expandedViz === 'spiral' ? null : 'spiral')}
                          className="p-1.5 rounded-lg bg-white/5 text-slate-300 hover:text-white cursor-pointer"
                        >
                          <Icon name={expandedViz === 'spiral' ? 'Minimize2' : 'Maximize2'} size={14} />
                        </button>
                      </div>
                      <div className="bg-black/80 rounded-2xl border border-white/5 relative overflow-visible">
                        <SpiralVisualizer
                          analyser={analyserNode}
                          activeOscillators={currentOscillators}
                          allOscillators={currentOscillators}
                          onUpdateOscillator={handleUpdateOscillator}
                          onRemoveOscillator={handleRemoveOscillator}
                          getOscillatorAnalyser={audio?.getOscillatorAnalyser}
                          isMasterPlaying={audio?.isPlaying ?? true}
                          height={expandedViz === 'spiral' ? 400 : 256}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: EMBEDDED GENERATOR MATRIX */}
            {studioTab === 'generator' && (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row items-center justify-between bg-black/60 p-4 rounded-2xl border border-amber-500/30 gap-3 text-center sm:text-left">
                  <div>
                    <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center justify-center sm:justify-start gap-2">
                      <Icon name="Sliders" size={18} /> Matriz de Frecuencias en Vivo
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {isHost || activePermissions.canEditFrequencies
                        ? 'Edita y mezcla frecuencias armónicas en tiempo real para todos los entonadores conectados.'
                        : 'Visualizando configuración activa. Edición restringida por el anfitrión.'}
                    </p>
                  </div>

                  {(isHost || activePermissions.canEditFrequencies) && (
                    <div className="flex flex-wrap gap-2 justify-center w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setShowMixModal(true)}
                        className="px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500 text-amber-200 hover:text-black font-extrabold rounded-2xl text-xs transition-all border border-amber-500/40 flex items-center gap-2 cursor-pointer"
                      >
                        <Icon name="Folder" size={15} />
                        <span>Mezclar Partículas</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleAddOscillator}
                        className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-2xl text-xs transition-all shadow-[0_0_20px_rgba(245,158,11,0.4)] flex items-center gap-2 cursor-pointer"
                      >
                        <Icon name="Plus" size={15} />
                        <span>+ Agregar Frecuencia</span>
                      </button>
                    </div>
                  )}
                </div>

                {(isHost || activePermissions.canEditFrequencies) && (
                  <div className="bg-black/40 p-4 rounded-2xl border border-white/10 flex flex-col gap-3">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider text-center sm:text-left">
                      Inyectar Frecuencia Armónica Solfeggio / Sagrada:
                    </span>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                      {[
                        { f: 432, l: '432 Hz Sol' },
                        { f: 528, l: '528 Hz ADN' },
                        { f: 639, l: '639 Hz Conexión' },
                        { f: 741, l: '741 Hz Limpieza' },
                        { f: 852, l: '852 Hz Intuición' },
                        { f: 963, l: '963 Hz Corona' }
                      ].map(item => (
                        <button
                          key={item.f}
                          type="button"
                          onClick={() => handleSolfeggioAdd(item.f, item.l)}
                          className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          + {item.l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentOscillators.map(osc => (
                    <OscillatorControls
                      key={osc.id}
                      osc={osc}
                      update={handleUpdateOscillator}
                      remove={handleRemoveOscillator}
                      analyser={audio?.getOscillatorAnalyser?.(osc.id) || analyserNode || undefined}
                    />
                  ))}
                  {currentOscillators.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-500 bg-black/40 rounded-3xl border border-white/5">
                      <Icon name="Activity" size={40} className="mx-auto mb-2 opacity-30 text-amber-400" />
                      <p className="text-xs">No hay osciladores en la sesión actual. Presiona "+ Agregar Frecuencia".</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: OPEN VIDEO & AUDIO GALLERY */}
            {studioTab === 'video' && (
              <div className="flex flex-col gap-5 h-full">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-black/60 p-4 rounded-2xl border border-white/10">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="flex items-center gap-1.5 text-xs font-mono text-cyan-300 bg-cyan-500/10 px-3 py-1 rounded-xl border border-cyan-500/20">
                      <Icon name="Radio" size={14} /> {meshState === 'connected' ? 'Red Híbrida P2P' : 'WebRTC Servidor'}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-mono text-amber-300 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">
                      <Icon name="Activity" size={14} /> Δ {Math.round(latencyDelta)}ms Desfase
                    </span>
                  </div>

                  {!isHost && (
                    <button
                      type="button"
                      onClick={() => setHandRaised(!handRaised)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                        handRaised
                          ? 'bg-amber-500 text-black border border-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.5)]'
                          : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40'
                      }`}
                    >
                      <Icon name="Hand" size={16} />
                      {handRaised ? 'Mano Levantada' : 'Pedir Palabra al Host'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
                  {localStream && isVideoEnabled && (
                    <VideoPlayer stream={localStream} isLocal displayName={currentUser.displayName} />
                  )}
                  {remoteStreams.map((rs: RemoteStream) => (
                    <VideoPlayer key={rs.userId} stream={rs.stream} displayName={rs.displayName} />
                  ))}

                  {(!localStream || !isVideoEnabled) && remoteStreams.length === 0 && (
                    <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-500 bg-black/40 rounded-3xl border border-white/5 text-center px-4">
                      <Icon name="VideoOff" size={48} className="mb-3 opacity-30 text-cyan-400" />
                      <h4 className="text-base font-bold text-slate-300">Cámara Desactivada</h4>
                      <p className="text-xs text-slate-500 mt-1">Usa los botones inferiores para activar micrófono o cámara.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: PRIVATE CALLS AND SUB-GROUPS */}
            {studioTab === 'private_groups' && (
              <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
                <div className="bg-black/60 p-5 sm:p-6 rounded-3xl border border-fuchsia-500/40 flex flex-col gap-6 shadow-xl">
                  <div className="border-b border-fuchsia-500/30 pb-3">
                    <h3 className="text-sm sm:text-base font-bold text-fuchsia-300 uppercase tracking-wider flex items-center gap-2">
                      <Icon name="Users" size={18} /> Llamadas Privadas y Sub-Grupos P2P
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Inicia llamadas 1-a-1 o selecciona grupos específicos para entonaciones privadas.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs uppercase font-bold text-slate-300 tracking-wider mb-3">
                      Sub-Grupo de Entonación Privado ({privateGroupUserIds.length} seleccionados)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {participants.map(p => (
                        <div
                          key={p.id}
                          onClick={() => togglePrivateGroupUser(p.id)}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                            privateGroupUserIds.includes(p.id)
                              ? 'bg-fuchsia-500/20 border-fuchsia-500 text-white shadow-[0_0_15px_rgba(217,70,239,0.25)]'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0" />
                            <span className="text-xs font-bold truncate">
                              {p.displayName} {p.id === currentUser.id && '(Tú)'}
                            </span>
                          </div>
                          <Icon name={privateGroupUserIds.includes(p.id) ? 'CheckCircle' : 'Circle'} size={16} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs uppercase font-bold text-slate-300 tracking-wider mb-3">
                      Llamadas Directas 1-a-1
                    </h4>
                    <div className="space-y-3">
                      {participants
                        .filter(p => p.id !== currentUser.id)
                        .map(p => (
                          <div
                            key={p.id}
                            className={`flex flex-wrap items-center justify-between gap-2 p-3.5 border rounded-2xl ${
                              activePrivatePeer === p.id
                                ? 'bg-cyan-500/15 border-cyan-400/50'
                                : 'bg-white/5 border-white/10'
                            }`}
                          >
                            <span className="text-xs font-bold text-white">{p.displayName}</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setActivePrivatePeer(activePrivatePeer === p.id ? null : p.id)}
                                className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-black rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-cyan-500/40 cursor-pointer"
                              >
                                <Icon name="Phone" size={14} /> Audio 1-a-1
                              </button>
                              <button
                                type="button"
                                onClick={() => setActivePrivatePeer(activePrivatePeer === p.id ? null : p.id)}
                                className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500 text-purple-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-purple-500/40 cursor-pointer"
                              >
                                <Icon name="Video" size={14} /> Video 1-a-1
                              </button>
                            </div>
                          </div>
                        ))}
                      {participants.filter(p => p.id !== currentUser.id).length === 0 && (
                        <p className="text-xs text-slate-500 italic">No hay otros entonadores conectados por el momento.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: RADAR MESH */}
            {studioTab === 'radar' && (
              <div className="flex-1">
                <MeshSignalMap />
              </div>
            )}

            {/* TAB 6: HOST ADMIN PANEL (PERMISSIONS + LIVE METADATA EDITING) */}
            {studioTab === 'host' && isHost && (
              <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
                {/* Permissions */}
                <div className="bg-black/60 p-5 sm:p-6 rounded-3xl border border-purple-500/40 flex flex-col gap-4 shadow-xl">
                  <h3 className="text-sm sm:text-base font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2 border-b border-purple-500/30 pb-3">
                    <Icon name="Shield" size={18} /> Permisos de Sala en Tiempo Real
                  </h3>

                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                      <span className="text-xs sm:text-sm text-slate-200 font-bold">Permitir Modificar Frecuencias</span>
                      <input
                        type="checkbox"
                        checked={activePermissions.canEditFrequencies}
                        onChange={e => updateHostPermissions({ canEditFrequencies: e.target.checked })}
                        className="accent-purple-500 w-5 h-5"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                      <span className="text-xs sm:text-sm text-slate-200 font-bold">Uso de Micrófono</span>
                      <input
                        type="checkbox"
                        checked={activePermissions.canUseMic}
                        onChange={e => updateHostPermissions({ canUseMic: e.target.checked })}
                        className="accent-purple-500 w-5 h-5"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                      <span className="text-xs sm:text-sm text-slate-200 font-bold">Uso de Cámara</span>
                      <input
                        type="checkbox"
                        checked={activePermissions.canUseVideo}
                        onChange={e => updateHostPermissions({ canUseVideo: e.target.checked })}
                        className="accent-purple-500 w-5 h-5"
                      />
                    </label>
                  </div>
                </div>

                {/* Live Session Details & Technical Recommendations Editor */}
                <form
                  onSubmit={handleSaveHostSessionDetails}
                  className="bg-black/60 p-5 sm:p-6 rounded-3xl border border-cyan-500/35 flex flex-col gap-4 shadow-xl"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/25 pb-3">
                    <h3 className="text-sm sm:text-base font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                      <Icon name="Edit3" size={18} /> Editar Sesión en Vivo
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setHostTechRec(
                          autoSuggestTechnicalRecommendation(currentOscillators, hostCategory, hostTitle)
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/35 border border-purple-400/40 text-purple-200 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Icon name="Sparkles" size={12} /> Auto-calcular Recomendación
                    </button>
                  </div>

                  {hostSaveStatus && (
                    <div className="px-3.5 py-2.5 rounded-xl bg-cyan-950/50 border border-cyan-500/40 text-cyan-200 text-xs font-semibold flex items-center gap-2">
                      <Icon name="Check" size={14} />
                      {hostSaveStatus}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Título de la Sesión</label>
                      <input
                        type="text"
                        required
                        value={hostTitle}
                        onChange={e => setHostTitle(e.target.value)}
                        className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Categoría</label>
                      <select
                        value={hostCategory}
                        onChange={e => setHostCategory(e.target.value)}
                        className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                      >
                        {EDITABLE_CATEGORIES.map(c => (
                          <option key={c.id} value={c.id} className="bg-slate-900">
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Descripción</label>
                    <textarea
                      value={hostDescription}
                      onChange={e => setHostDescription(e.target.value)}
                      rows={2}
                      className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none resize-none"
                    />
                  </div>

                  <div className="space-y-2 text-xs">
                    <span className="block text-[10px] font-bold uppercase text-slate-400">Medios Recomendados</span>
                    <div className="flex flex-wrap gap-1.5">
                      {RADIATION_MEDIUMS.map(m => {
                        const active = hostTechRec.recommendedMediums.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => toggleHostMedium(m.id)}
                            className={`px-2.5 py-1 rounded-full border text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                              active ? m.badgeClass : 'bg-white/5 border-white/10 text-slate-400'
                            }`}
                          >
                            <Icon name={m.iconName} size={10} />
                            {m.shortLabel}
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <input
                        type="text"
                        value={hostTechRec.primaryMediumLabel}
                        onChange={e => setHostTechRec(p => ({ ...p, primaryMediumLabel: e.target.value }))}
                        placeholder="Medio principal"
                        className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                      />
                      <input
                        type="text"
                        value={hostTechRec.recommendedVolume}
                        onChange={e => setHostTechRec(p => ({ ...p, recommendedVolume: e.target.value }))}
                        placeholder="Volumen recomendado"
                        className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <label className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-xl p-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hostIsPublic}
                        onChange={e => setHostIsPublic(e.target.checked)}
                        className="accent-cyan-500"
                      />
                      <span className="text-slate-200 font-semibold">Sala Pública</span>
                    </label>
                    <label className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-xl p-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hostAllowOpenMod}
                        onChange={e => setHostAllowOpenMod(e.target.checked)}
                        className="accent-cyan-500"
                      />
                      <span className="text-slate-200 font-semibold">Edición Abierta</span>
                    </label>
                    <label className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-xl p-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hostFixedPerms}
                        onChange={e => setHostFixedPerms(e.target.checked)}
                        className="accent-cyan-500"
                      />
                      <span className="text-slate-200 font-semibold">Persistencia Host</span>
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowExitModal(true)}
                      className="px-4 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white border border-red-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Icon name="Trash2" size={14} /> Finalizar Transmisión
                    </button>
                    <button
                      type="submit"
                      disabled={savingHostMeta}
                      className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                    >
                      {savingHostMeta && <Icon name="Loader" size={14} className="animate-spin" />}
                      Guardar Cambios en Vivo
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 7: PRIVACY AND FILTERS */}
            {studioTab === 'filter' && (
              <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
                <div className="bg-black/60 p-5 sm:p-6 rounded-3xl border border-cyan-500/40 flex flex-col gap-5 shadow-xl">
                  <h3 className="text-sm sm:text-base font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2 border-b border-cyan-500/30 pb-3">
                    <Icon name="Lock" size={18} /> Ajustes de Privacidad y Ámbito Personal
                  </h3>

                  <div>
                    <label className="block text-xs uppercase font-bold text-slate-400 tracking-wider mb-2">
                      Mi Ámbito de Transmisión Personal
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setUserTransmissionScope('public')}
                        className={`p-3 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center gap-2 cursor-pointer ${
                          userTransmissionScope === 'public'
                            ? 'bg-cyan-500/30 border-cyan-500 text-cyan-200'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <Icon name="Globe" size={18} />
                        <span>Público</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserTransmissionScope('select')}
                        className={`p-3 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center gap-2 cursor-pointer ${
                          userTransmissionScope === 'select'
                            ? 'bg-purple-500/30 border-purple-500 text-purple-200'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <Icon name="UserCheck" size={18} />
                        <span>Selección</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserTransmissionScope('listen_only')}
                        className={`p-3 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center gap-2 cursor-pointer ${
                          userTransmissionScope === 'listen_only'
                            ? 'bg-amber-500/30 border-amber-500 text-amber-200'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <Icon name="EyeOff" size={18} />
                        <span>Solo Escuchar</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center justify-between text-xs sm:text-sm text-slate-200 font-bold mb-2">
                      <span>Sintonización Fina Personal (± Δ Hz)</span>
                      <span className="text-cyan-400 font-mono text-base">
                        {personalOffset > 0 ? `+${personalOffset}` : personalOffset} Hz
                      </span>
                    </label>
                    <input
                      type="range"
                      min="-20"
                      max="20"
                      step="0.5"
                      value={personalOffset}
                      onChange={e => setPersonalOffset(Number(e.target.value))}
                      className="w-full accent-cyan-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Studio Bottom Master Controls Bar */}
          <div className="p-3 sm:p-4 border-t border-white/10 bg-black/90 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleAudio}
                disabled={!activePermissions.canUseMic && !isHost}
                className={`px-3.5 h-10 sm:h-11 rounded-2xl flex items-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                  !activePermissions.canUseMic && !isHost
                    ? 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-500'
                    : isAudioEnabled
                    ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(34,211,238,0.4)]'
                    : 'bg-red-500/20 text-red-400 border border-red-500/40'
                }`}
              >
                <Icon name={isAudioEnabled ? 'Mic' : 'MicOff'} size={16} />
                <span className="hidden sm:inline">{isAudioEnabled ? 'Micrófono Activo' : 'Llamada de Audio'}</span>
              </button>

              <button
                type="button"
                onClick={toggleVideo}
                disabled={!activePermissions.canUseVideo && !isHost}
                className={`px-3.5 h-10 sm:h-11 rounded-2xl flex items-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                  !activePermissions.canUseVideo && !isHost
                    ? 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-500'
                    : isVideoEnabled
                    ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(34,211,238,0.4)]'
                    : 'bg-red-500/20 text-red-400 border border-red-500/40'
                }`}
              >
                <Icon name={isVideoEnabled ? 'Video' : 'VideoOff'} size={16} />
                <span className="hidden sm:inline">{isVideoEnabled ? 'Cámara Activa' : 'Encender Cámara'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowChat(!showChat)}
                className={`px-3.5 h-10 sm:h-11 rounded-2xl flex items-center gap-2 text-xs font-bold transition-all border relative cursor-pointer ${
                  showChat
                    ? 'bg-purple-500 text-white border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)]'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
              >
                <Icon name="MessageSquare" size={16} />
                <span>Chat</span>
                {chatMessages.length > 0 && !showChat && (
                  <span className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-ping" />
                )}
              </button>
            </div>

            {showChat && (
              <div className="absolute bottom-20 right-3 sm:right-6 w-[calc(100vw-2rem)] sm:w-80 bg-black/95 backdrop-blur-2xl border border-purple-500/40 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 h-72 z-50">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-bold text-purple-300">Chat de Sintonización</span>
                  <button type="button" onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white">
                    <Icon name="X" size={14} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.senderId === currentUser.id ? 'items-end' : 'items-start'}`}>
                      <span className="text-[9px] text-slate-400">{msg.senderName}</span>
                      <div
                        className={`px-3 py-1.5 rounded-xl text-xs ${
                          msg.senderId === currentUser.id ? 'bg-cyan-500/30 text-cyan-200' : 'bg-white/10 text-slate-200'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={handleSendChat} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="Mensaje..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                  <button type="submit" className="px-3 py-1.5 bg-purple-500 text-white rounded-xl text-xs font-bold">
                    <Icon name="Send" size={14} />
                  </button>
                </form>
              </div>
            )}

            <button
              type="button"
              onClick={() => (isHost ? setShowExitModal(true) : onLeave())}
              className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white rounded-2xl text-xs font-bold border border-red-500/40 transition-all cursor-pointer ml-auto"
            >
              Salir de la Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // COMPACT FLOATING WIDGET VIEW (WIDGET COMPACTO ANCLADO)
  // -------------------------------------------------------------
  return (
    <>
      {renderExitModal()}
      <div className="fixed bottom-24 right-3 sm:right-5 z-[90] w-[calc(100vw-1.5rem)] max-w-[390px] flex flex-col gap-3 p-4 bg-[#070a14]/95 backdrop-blur-2xl border border-cyan-500/50 rounded-3xl shadow-[0_0_50px_rgba(34,211,238,0.3)] animate-fade-in">
        {/* Widget Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
            <span className="text-xs font-bold text-white truncate">{liveSession.presetName}</span>
          </div>

          <button
            type="button"
            onClick={() => setViewMode('studio')}
            className="px-2.5 py-1.5 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-black font-black rounded-xl text-[11px] transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            title="Abrir Ventana Completa de Entonación"
          >
            <Icon name="Maximize2" size={13} />
            <span>Estudio Completo</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 px-1">
          <span className="truncate">Anfitrión: {liveSession.hostName}</span>
          <span className="text-cyan-400 font-bold shrink-0">Δ {Math.round(latencyDelta)}ms</span>
        </div>

        {/* QUICK LAUNCH POPUPS BAR */}
        <div className="grid grid-cols-4 gap-1.5 bg-black/50 p-1.5 rounded-2xl border border-white/5">
          <button
            type="button"
            onClick={() => setCompactPopup(compactPopup === 'graphics' ? 'none' : 'graphics')}
            className={`py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              compactPopup === 'graphics' ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Icon name="Activity" size={12} /> Gráficas
          </button>
          <button
            type="button"
            onClick={() => setCompactPopup(compactPopup === 'matrix' ? 'none' : 'matrix')}
            className={`py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              compactPopup === 'matrix' ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Icon name="Sliders" size={12} /> Matriz
          </button>
          <button
            type="button"
            onClick={() => setCompactPopup(compactPopup === 'radar' ? 'none' : 'radar')}
            className={`py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              compactPopup === 'radar' ? 'bg-green-500 text-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Icon name="Radio" size={12} /> Radar
          </button>
          <button
            type="button"
            onClick={() => setCompactPopup(compactPopup === 'privacy' ? 'none' : 'privacy')}
            className={`py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              compactPopup === 'privacy' ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Icon name="Lock" size={12} /> Filtro
          </button>
        </div>

        {compactPopup === 'graphics' && (
          <div className="h-36 bg-black/80 rounded-2xl overflow-hidden border border-cyan-500/30 p-2">
            <Visualizer analyser={analyserNode} height={128} color="#22d3ee" type="fill" />
          </div>
        )}

        {compactPopup === 'matrix' && (
          <div className="max-h-44 overflow-y-auto custom-scrollbar p-2.5 bg-black/80 rounded-2xl border border-amber-500/30 space-y-1.5">
            <span className="text-[10px] font-bold text-amber-300 uppercase block">
              Frecuencias Activas ({currentOscillators.length}):
            </span>
            {currentOscillators.map(o => (
              <div key={o.id} className="text-xs text-white font-mono flex justify-between bg-white/5 p-2 rounded-xl">
                <span>
                  {o.frequency} Hz ({o.type})
                </span>
                <span>Vol: {Math.round((o.volume ?? 0.5) * 100)}%</span>
              </div>
            ))}
          </div>
        )}

        {compactPopup === 'radar' && (
          <div className="h-44 overflow-y-auto bg-black/80 rounded-2xl border border-green-500/30 p-2">
            <MeshSignalMap />
          </div>
        )}

        {compactPopup === 'privacy' && (
          <div className="p-3 bg-black/80 rounded-2xl border border-purple-500/30 space-y-2">
            <span className="text-[10px] font-bold text-purple-300 uppercase block">Sintonización Fina Personal:</span>
            <input
              type="range"
              min="-20"
              max="20"
              step="0.5"
              value={personalOffset}
              onChange={e => setPersonalOffset(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
            <div className="text-[10px] text-cyan-400 font-mono text-right">
              {personalOffset > 0 ? `+${personalOffset}` : personalOffset} Hz
            </div>
          </div>
        )}

        {/* COMPACT WIDGET ACTION CONTROLS */}
        <div className="flex items-center justify-between pt-1 gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleAudio}
              disabled={!activePermissions.canUseMic && !isHost}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                isAudioEnabled
                  ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(34,211,238,0.45)]'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
              title={isAudioEnabled ? 'Silenciar Micrófono' : 'Activar Audio'}
            >
              <Icon name={isAudioEnabled ? 'Mic' : 'MicOff'} size={16} />
            </button>

            <button
              type="button"
              onClick={toggleVideo}
              disabled={!activePermissions.canUseVideo && !isHost}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                isVideoEnabled
                  ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(34,211,238,0.45)]'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
              title={isVideoEnabled ? 'Apagar Cámara' : 'Encender Cámara'}
            >
              <Icon name={isVideoEnabled ? 'Video' : 'VideoOff'} size={16} />
            </button>

            <button
              type="button"
              onClick={() => {
                setViewMode('studio');
                setShowChat(true);
              }}
              className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center transition-all hover:bg-purple-500/40 relative cursor-pointer"
              title="Abrir Chat"
            >
              <Icon name="MessageSquare" size={16} />
              {chatMessages.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-purple-500 rounded-full animate-ping" />
              )}
            </button>

            {!isHost && (
              <button
                type="button"
                onClick={() => setHandRaised(!handRaised)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  handRaised
                    ? 'bg-amber-500 text-black border border-amber-300'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
                title="Pedir Palabra"
              >
                <Icon name="Hand" size={16} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => (isHost ? setShowExitModal(true) : onLeave())}
            className="px-3 py-2 bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-red-500/40 cursor-pointer"
          >
            Desconectar
          </button>
        </div>
      </div>
    </>
  );
};

export default LiveSyncCall;
