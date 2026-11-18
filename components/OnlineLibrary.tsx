import React, { useState, useEffect, useRef, useMemo } from 'react';
import Icon from './Icon';
import {
  logoutStarseed,
  getCurrentStarseedUser,
  subscribeToStarseedAuth,
  fetchCommunityPresets,
  fetchLiveSessions,
  deleteCommunityPreset,
  updateLiveSession,
  deleteLiveSession,
  StarseedUser
} from '../services/starseedAuth';
import {
  fetchCommunityProfiles,
  checkResonance,
  resonateWithUser,
  unresonateWithUser
} from '../services/omniCommunity';
import {
  FileSystemNode,
  LiveSession,
  CATEGORIES,
  RADIATION_MEDIUMS,
  OmniProfile,
  OscillatorState,
  WaveType
} from '../types';
import { autoSuggestTechnicalRecommendation } from '../utils/frequencyAnalysis';
import PublishParticleModal from './PublishParticleModal';
import MeshSignalMap from './MeshSignalMap';
import { StarseedLoginModal } from './StarseedLoginModal';
import ParticleWaveformBand from './ParticleWaveformBand';
import AdaptiveParticleGrid from './AdaptiveParticleGrid';

interface Props {
  onLoadPreset: (node: FileSystemNode) => void;
  onMixPreset?: (node: FileSystemNode) => void;
  onJoinSession: (session: LiveSession) => void;
  currentOscillators?: OscillatorState[];
  onStartSessionRequest?: () => void;
}

const EDITABLE_CATEGORIES = CATEGORIES.filter(c => c.id !== 'all');

const OnlineLibrary: React.FC<Props> = ({
  onLoadPreset,
  onMixPreset,
  onJoinSession,
  currentOscillators = [],
  onStartSessionRequest
}) => {
  const [user, setUser] = useState<StarseedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [presets, setPresets] = useState<FileSystemNode[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [profiles, setProfiles] = useState<OmniProfile[]>([]);
  const [resonancesCache, setResonancesCache] = useState<Record<string, boolean>>({});
  const [showLoginModal, setShowLoginModal] = useState(false);

  const [activeTab, setActiveTab] = useState<'vibras' | 'entonacion' | 'perfiles' | 'radar'>('vibras');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');
  const [searchQuery, setSearchQuery] = useState('');

  const [networkPreference, setNetworkPreference] = useState<'mixed' | 'mesh' | 'server' | 'private'>(
    (localStorage.getItem('globalNetworkPreference') as any) || 'mixed'
  );

  const handleNetworkPrefChange = (pref: 'mixed' | 'mesh' | 'server' | 'private') => {
    setNetworkPreference(pref);
    localStorage.setItem('globalNetworkPreference', pref);
  };

  // Publish / Edit Particle Modal
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [editingCommunityPreset, setEditingCommunityPreset] = useState<FileSystemNode | undefined>(undefined);

  // Edit Live Session Modal
  const [editingSession, setEditingSession] = useState<LiveSession | null>(null);
  const [editSessionName, setEditSessionName] = useState('');
  const [editSessionDescription, setEditSessionDescription] = useState('');
  const [editSessionCategory, setEditSessionCategory] = useState('solfeggio');
  const [editSessionPublic, setEditSessionPublic] = useState(true);
  const [editSessionOpenMod, setEditSessionOpenMod] = useState(false);
  const [editSessionFixedPerms, setEditSessionFixedPerms] = useState(false);
  const [savingSessionEdit, setSavingSessionEdit] = useState(false);

  // Expanded detail panels per preset/session card
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const previewAudioContextRef = useRef<AudioContext | null>(null);
  const previewMasterGainRef = useRef<GainNode | null>(null);
  const previewOscillatorsRef = useRef<OscillatorNode[]>([]);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBanner = (type: 'success' | 'error', text: string) => {
    setFeedbackBanner({ type, text });
    setTimeout(() => {
      setFeedbackBanner(prev => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const stopPreview = () => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }

    const ctx = previewAudioContextRef.current;
    const masterGain = previewMasterGainRef.current;
    const oscs = previewOscillatorsRef.current;

    previewAudioContextRef.current = null;
    previewMasterGainRef.current = null;
    previewOscillatorsRef.current = [];
    setPreviewingId(null);

    if (ctx && masterGain) {
      try {
        const now = ctx.currentTime;
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setValueAtTime(masterGain.gain.value, now);
        masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.12);
        setTimeout(() => {
          oscs.forEach(osc => {
            try {
              osc.stop();
              osc.disconnect();
            } catch {
              /* ignore */
            }
          });
          try {
            masterGain.disconnect();
            if (ctx.state !== 'closed') ctx.close();
          } catch {
            /* ignore */
          }
        }, 140);
      } catch {
        try {
          if (ctx.state !== 'closed') ctx.close();
        } catch {
          /* ignore */
        }
      }
    }
  };

  const loadData = async () => {
    try {
      const [presetsData, sessionsData, profilesData] = await Promise.all([
        fetchCommunityPresets(),
        fetchLiveSessions(),
        fetchCommunityProfiles()
      ]);
      setPresets(presetsData);
      setSessions(sessionsData);
      setProfiles(profilesData);

      const currentUser = await getCurrentStarseedUser();
      if (currentUser) {
        const cache: Record<string, boolean> = {};
        for (const p of profilesData) {
          cache[p.id] = await checkResonance(currentUser.id, p.id);
        }
        setResonancesCache(cache);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const init = async () => {
      const currentUser = await getCurrentStarseedUser();
      setUser(currentUser);
      await loadData();
      setLoading(false);
    };
    init();

    const unsubAuth = subscribeToStarseedAuth(updatedUser => {
      setUser(updatedUser);
      loadData();
    });

    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      previewOscillatorsRef.current.forEach(osc => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          /* ignore */
        }
      });
      if (previewAudioContextRef.current && previewAudioContextRef.current.state !== 'closed') {
        try {
          previewAudioContextRef.current.close();
        } catch {
          /* ignore */
        }
      }
      unsubAuth();
    };
  }, []);

  const handleLogout = async () => {
    await logoutStarseed();
    setUser(null);
    await loadData();
  };

  const handleProtectedAction = (action: () => void) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    action();
  };

  const togglePreview = (itemId: string, oscillators: OscillatorState[]) => {
    if (previewingId === itemId) {
      stopPreview();
      return;
    }
    stopPreview();
    if (!oscillators || oscillators.length === 0) return;

    setPreviewingId(itemId);

    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new Ctx();
      if (ctx.state === 'suspended') ctx.resume();

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.15);
      masterGain.connect(ctx.destination);

      const createdOscs: OscillatorNode[] = [];
      const count = Math.max(1, oscillators.length);

      oscillators.forEach(oscData => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const rawType = oscData.type as string;
        osc.type = (['sine', 'square', 'sawtooth', 'triangle'].includes(rawType) ? rawType : 'sine') as OscillatorType;
        osc.frequency.setValueAtTime(Math.max(0.5, Math.min(20000, Number(oscData.frequency) || 432)), ctx.currentTime);
        gain.gain.setValueAtTime(((oscData.volume ?? 0.5) * 0.7) / Math.sqrt(count), ctx.currentTime);

        if (typeof ctx.createStereoPanner === 'function') {
          const panner = ctx.createStereoPanner();
          panner.pan.setValueAtTime(Math.max(-1, Math.min(1, oscData.panX ?? 0)), ctx.currentTime);
          osc.connect(gain);
          gain.connect(panner);
          panner.connect(masterGain);
        } else {
          osc.connect(gain);
          gain.connect(masterGain);
        }

        osc.start();
        createdOscs.push(osc);
      });

      previewAudioContextRef.current = ctx;
      previewMasterGainRef.current = masterGain;
      previewOscillatorsRef.current = createdOscs;

      previewTimerRef.current = setTimeout(() => {
        if (previewAudioContextRef.current === ctx) {
          stopPreview();
        }
      }, 7000);
    } catch (e) {
      console.error('Error en pre-escucha comunitaria:', e);
      stopPreview();
    }
  };

  const toggleExpandCard = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const profileMap = useMemo(() => {
    const map: Record<string, OmniProfile> = {};
    profiles.forEach(p => {
      map[p.id] = p;
    });
    return map;
  }, [profiles]);

  const activeTabCategories = useMemo(() => {
    const sourceCategories =
      activeTab === 'vibras'
        ? presets.map(p => p.content?.category || 'Varios')
        : sessions.map(s => s.category || s.presetContent?.category || 'Varios');

    const counts: Record<string, number> = { all: sourceCategories.length };
    sourceCategories.forEach(c => {
      counts[c] = (counts[c] || 0) + 1;
    });

    const knownKeys: string[] = CATEGORIES.filter(c => c.id === 'all' || counts[c.id] > 0).map(c => c.id);
    const customKeys: string[] = Array.from(new Set<string>(sourceCategories)).filter(
      c => c !== 'all' && !CATEGORIES.some(known => known.id === c)
    ).sort();

    return [...knownKeys, ...customKeys].map(catId => {
      const known = CATEGORIES.find(c => c.id === catId);
      return {
        id: catId,
        label: known ? known.label : catId,
        iconName: known ? known.iconName : 'Layers',
        color: known ? known.color : 'text-cyan-300',
        count: counts[catId] || 0
      };
    });
  }, [activeTab, presets, sessions]);

  const filteredPresets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list =
      selectedCategory === 'all'
        ? [...presets]
        : presets.filter(p => (p.content?.category || 'Varios') === selectedCategory);

    if (q) {
      list = list.filter(p => {
        const nameMatch = p.name.toLowerCase().includes(q);
        const descMatch = (p.content?.description || '').toLowerCase().includes(q);
        const catMatch = (p.content?.category || '').toLowerCase().includes(q);
        const authorName =
          p.content?.authorName ||
          (p.content?.authorId ? profileMap[p.content.authorId]?.displayName : '') ||
          '';
        const authorMatch = authorName.toLowerCase().includes(q);
        const tagsMatch = (p.content?.tags || []).some(t => t.toLowerCase().includes(q));
        return nameMatch || descMatch || catMatch || authorMatch || tagsMatch;
      });
    }

    if (sortBy === 'recent') {
      list.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sortBy === 'popular') {
      list.sort((a, b) => (b.content?.downloads || 0) - (a.content?.downloads || 0));
    }
    return list;
  }, [presets, selectedCategory, searchQuery, sortBy, profileMap]);

  const sortedSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list =
      selectedCategory === 'all'
        ? [...sessions]
        : sessions.filter(s => (s.category || s.presetContent?.category || 'Varios') === selectedCategory);

    if (q) {
      list = list.filter(
        s =>
          s.presetName.toLowerCase().includes(q) ||
          s.hostName.toLowerCase().includes(q) ||
          (s.description || s.presetContent?.description || '').toLowerCase().includes(q) ||
          (s.category || s.presetContent?.category || '').toLowerCase().includes(q)
      );
    }

    if (sortBy === 'recent') {
      list.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sortBy === 'popular') {
      list.sort((a, b) => (b.participantsCount || 0) - (a.participantsCount || 0));
    }
    return list;
  }, [sessions, selectedCategory, searchQuery, sortBy]);

  const sortedProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = [...profiles];
    if (q) {
      list = list.filter(p => p.displayName.toLowerCase().includes(q));
    }
    if (sortBy === 'recent') {
      list.sort((a, b) => b.lastActive - a.lastActive);
    } else if (sortBy === 'popular') {
      list.sort((a, b) => b.resonancesCount - a.resonancesCount);
    }
    return list;
  }, [profiles, searchQuery, sortBy]);

  const handleDeleteCommunityPreset = async (preset: FileSystemNode) => {
    if (!user) return;
    if (!confirm(`¿Eliminar definitivamente la partícula "${preset.name}" de la comunidad?`)) return;
    try {
      await deleteCommunityPreset(preset.id, user.id);
      showBanner('success', `Partícula "${preset.name}" eliminada.`);
      await loadData();
    } catch (err: any) {
      console.error(err);
      showBanner('error', err?.message || 'No se pudo eliminar la partícula.');
    }
  };

  const openEditSessionModal = (session: LiveSession) => {
    setEditingSession(session);
    setEditSessionName(session.presetName);
    setEditSessionDescription(session.description || session.presetContent?.description || '');
    setEditSessionCategory(session.category || session.presetContent?.category || 'solfeggio');
    setEditSessionPublic(session.isPublic);
    setEditSessionOpenMod(session.allowOpenModifications);
    setEditSessionFixedPerms(Boolean(session.fixedPermissions));
  };

  const handleSaveSessionEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;
    setSavingSessionEdit(true);
    try {
      await updateLiveSession(editingSession.id, editingSession.hostId, {
        presetName: editSessionName.trim() || editingSession.presetName,
        isPublic: editSessionPublic,
        allowOpenModifications: editSessionOpenMod,
        metadata: {
          description: editSessionDescription.trim() || undefined,
          category: editSessionCategory,
          fixedPermissions: editSessionFixedPerms,
          cover_url: editingSession.cover_url,
          avatar_url: editingSession.avatar_url
        }
      });
      setEditingSession(null);
      showBanner('success', 'Transmisión actualizada correctamente.');
      await loadData();
    } catch (err: any) {
      console.error(err);
      showBanner('error', err?.message || 'Error al actualizar la transmisión.');
    } finally {
      setSavingSessionEdit(false);
    }
  };

  const handleDeleteSession = async (session: LiveSession) => {
    if (!confirm(`¿Finalizar y eliminar la transmisión "${session.presetName}"?`)) return;
    try {
      await deleteLiveSession(session.id);
      showBanner('success', `Transmisión "${session.presetName}" finalizada.`);
      await loadData();
    } catch (err: any) {
      console.error(err);
      showBanner('error', err?.message || 'No se pudo finalizar la transmisión.');
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-3 text-cyan-400">
        <Icon name="Loader" size={32} className="animate-spin" />
        <span className="text-xs uppercase tracking-widest text-slate-400">Conectando con StarSeed Nexus...</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-6 min-h-full lg:h-full flex flex-col relative overflow-y-auto lg:overflow-hidden">
      {/* Status Banner */}
      {feedbackBanner && (
        <div
          className={`mb-4 px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 shrink-0 ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/70 border-red-500/40 text-red-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <Icon name={feedbackBanner.type === 'success' ? 'Check' : 'AlertCircle'} size={14} />
            {feedbackBanner.text}
          </span>
          <button onClick={() => setFeedbackBanner(null)} className="opacity-70 hover:opacity-100">
            <Icon name="X" size={14} />
          </button>
        </div>
      )}

      {/* Top StarSeed OS Account & Network Banner */}
      <div className="relative flex flex-col md:flex-row justify-between items-center gap-4 mb-5 border border-white/10 p-4 rounded-2xl backdrop-blur-md shrink-0 overflow-hidden bg-black/40">
        {user?.cover_url && (
          <img
            src={user.cover_url}
            alt="Cover"
            className="absolute inset-0 w-full h-full object-cover opacity-35 pointer-events-none mix-blend-screen"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/40 pointer-events-none" />

        {user ? (
          <>
            <div className="flex items-center gap-3.5 relative z-10 w-full md:w-auto justify-center md:justify-start">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.displayName}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.45)] object-cover shrink-0"
                />
              ) : (
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-cyan-500 to-amber-500 flex items-center justify-center font-bold text-lg text-black shadow-[0_0_15px_rgba(245,158,11,0.45)] shrink-0">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-left">
                <h3 className="font-bold text-white text-base sm:text-lg">{user.displayName}</h3>
                <p className="text-xs text-amber-400 font-bold">Conectado a StarSeed OS</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-2.5 relative z-10 w-full md:w-auto">
              <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-xl border border-white/10">
                <Icon name="Radio" size={14} className="text-cyan-400" />
                <select
                  value={networkPreference}
                  onChange={e => handleNetworkPrefChange(e.target.value as any)}
                  className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="mixed" className="bg-slate-900 text-white">Conexión: Mixta (Internet + Mesh)</option>
                  <option value="mesh" className="bg-slate-900 text-white">Conexión: Solo Mesh Local</option>
                  <option value="server" className="bg-slate-900 text-white">Conexión: Solo Servidores Públicos</option>
                  <option value="private" className="bg-slate-900 text-white">Conexión: Privada (Local)</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 border border-red-500/30 cursor-pointer"
              >
                <Icon name="LogOut" size={14} /> Salir
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3.5 relative z-10 w-full md:w-auto justify-center md:justify-start">
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shrink-0">
                <Icon name="Users" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm sm:text-base">Modo Invitado / P2P</h3>
                <p className="text-xs text-slate-400">Acceso a red pública, Mesh y sintonizaciones en línea</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-2.5 relative z-10 w-full md:w-auto">
              <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-xl border border-white/10">
                <Icon name="Radio" size={14} className="text-cyan-400" />
                <select
                  value={networkPreference}
                  onChange={e => handleNetworkPrefChange(e.target.value as any)}
                  className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="mixed" className="bg-slate-900 text-white">Conexión: Mixta (Internet + Mesh)</option>
                  <option value="mesh" className="bg-slate-900 text-white">Conexión: Solo Mesh Local</option>
                  <option value="server" className="bg-slate-900 text-white">Conexión: Solo Servidores Públicos</option>
                  <option value="private" className="bg-slate-900 text-white">Conexión: Privada (Local)</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => setShowLoginModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-amber-500/25 to-amber-600/25 hover:from-amber-500/35 hover:to-amber-600/35 text-amber-200 border border-amber-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.2)] cursor-pointer"
              >
                <Icon name="LogIn" size={15} />
                Conectar StarSeed OS
              </button>
            </div>
          </>
        )}
      </div>

      <StarseedLoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={loggedUser => {
          setUser(loggedUser);
          setShowLoginModal(false);
          loadData();
        }}
      />

      {/* Tabs & Search */}
      <div className="flex flex-col lg:flex-row gap-3 mb-5 shrink-0 w-full justify-between items-center">
        <div className="grid grid-cols-2 sm:flex bg-black/50 p-1 rounded-2xl border border-white/10 w-full lg:w-auto gap-1">
          <button
            type="button"
            className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'vibras' ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => {
              setActiveTab('vibras');
              setSelectedCategory('all');
            }}
          >
            <Icon name="Library" size={16} /> Partículas
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'entonacion' ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => {
              setActiveTab('entonacion');
              setSelectedCategory('all');
            }}
          >
            <Icon name="Radio" size={16} /> Sintonización
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'perfiles' ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('perfiles')}
          >
            <Icon name="Users" size={16} /> Perfiles
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'radar'
                ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(34,211,238,0.4)]'
                : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('radar')}
          >
            <Icon name="Activity" size={16} className="animate-pulse" /> Radar Mesh
          </button>
        </div>

        <div className="relative w-full lg:w-72">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Icon name="Search" size={15} className="text-slate-500" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar partícula, autor, tag..."
            className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-400/60 transition-colors placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* TAB 1: VIBRAS / PARTICULAS PUBLICAS */}
      {activeTab === 'vibras' && (
        <div className="lg:flex-1 lg:overflow-y-auto lg:pr-1 custom-scrollbar">
          <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-3 text-center sm:text-left">
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-cyan-300">
              <Icon name="Globe" size={22} /> Librería Comunitaria de Partículas
            </h2>
            <div className="flex flex-wrap gap-2 items-center justify-center">
              <div className="flex bg-black/50 border border-white/10 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setSortBy('recent')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer ${
                    sortBy === 'recent' ? 'bg-white/15 text-white' : 'text-slate-400'
                  }`}
                >
                  Recientes
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('popular')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer ${
                    sortBy === 'popular' ? 'bg-white/15 text-white' : 'text-slate-400'
                  }`}
                >
                  Populares
                </button>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleProtectedAction(() => {
                    setEditingCommunityPreset(undefined);
                    setShowPublishModal(true);
                  })
                }
                className="px-3.5 py-1.5 bg-amber-500/20 text-amber-200 hover:bg-amber-500 hover:text-black rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-amber-500/30 cursor-pointer"
              >
                <Icon name="Upload" size={14} /> Publicar Partícula
              </button>
              <button
                type="button"
                onClick={loadData}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 border border-white/10 cursor-pointer"
                title="Actualizar"
              >
                <Icon name="RefreshCw" size={16} />
              </button>
            </div>
          </div>

          {/* Categories Chips with Icons & Counts */}
          <div className="flex flex-wrap justify-center sm:justify-start gap-2 pb-4 mb-2">
            {activeTabCategories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-cyan-500/20 border-cyan-400/60 text-white shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                    : 'bg-black/45 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon name={cat.iconName} size={13} className={cat.color} />
                <span>{cat.label}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-slate-300 font-mono">
                  {cat.count}
                </span>
              </button>
            ))}
          </div>

          {/* Presets Grid */}
          {filteredPresets.length === 0 ? (
            <div className="py-12 mb-8 text-center text-slate-500 border border-dashed border-white/10 rounded-2xl">
              <Icon name="Inbox" size={32} className="mx-auto mb-2 opacity-50" />
              <p>No hay partículas en esta categoría o búsqueda.</p>
            </div>
          ) : (
            <AdaptiveParticleGrid<FileSystemNode>
              items={filteredPresets}
              getItemKey={(p) => p.id}
              columnsConfig={{ base: 1, md: 2, lg: 3 }}
              gapPx={16}
              className="pb-8"
              renderItem={(preset) => {
                const oscs = preset.content?.oscillators || [];
                const catKey = preset.content?.category || 'Varios';
                const knownCat = CATEGORIES.find(c => c.id === catKey);
                const authorId = preset.content?.authorId;
                const authorName =
                  preset.content?.authorName ||
                  (authorId ? profileMap[authorId]?.displayName : undefined) ||
                  'Explorador StarSeed';
                const isOwn = Boolean(user && authorId && user.id === authorId);
                const tech =
                  preset.content?.technicalRecommendation ||
                  autoSuggestTechnicalRecommendation(oscs, catKey, preset.name);
                const mediumBadges = tech.recommendedMediums
                  .map(id => RADIATION_MEDIUMS.find(m => m.id === id))
                  .filter((m): m is (typeof RADIATION_MEDIUMS)[number] => Boolean(m));
                const isExpanded = Boolean(expandedCards[`preset-${preset.id}`]);
                const isPreviewing = previewingId === `preset-${preset.id}`;

                return (
                  <div className="bg-gradient-to-br from-black/80 to-slate-900/80 border border-white/10 p-5 rounded-2xl hover:border-cyan-500/45 transition-all flex flex-col h-fit gap-3 shadow-lg">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider ${
                          knownCat?.color || 'text-cyan-300'
                        }`}
                      >
                        <Icon name={knownCat?.iconName || 'Layers'} size={11} />
                        {knownCat?.label || catKey}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider bg-white/10 px-2.5 py-1 rounded-full text-slate-200 font-mono shrink-0">
                        {oscs.length} Osc
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-white text-base sm:text-lg leading-snug">{preset.name}</h4>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 mt-1">
                        <span className="truncate">
                          por <strong className="text-cyan-300">{authorName}</strong>
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 shrink-0">
                          {new Date(preset.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <ParticleWaveformBand oscillators={oscs} isPlaying={isPreviewing} compact />

                    <p className="text-xs text-slate-300 font-light line-clamp-3">
                      {preset.content?.description || 'Sin descripción'}
                    </p>

                    {/* Radiation Medium Badges */}
                    <div className="flex flex-wrap gap-1">
                      {mediumBadges.map(m => (
                        <span
                          key={m.id}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${m.badgeClass}`}
                        >
                          <Icon name={m.iconName} size={10} />
                          {m.shortLabel}
                        </span>
                      ))}
                    </div>

                    {preset.content?.tags && preset.content.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {preset.content.tags.map(tag => (
                          <span key={tag} className="text-[9px] bg-white/5 px-2 py-0.5 rounded-full text-slate-300">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Collapsible Frequencies & Technical Recommendations */}
                    <div className="rounded-xl bg-black/50 border border-white/10 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleExpandCard(`preset-${preset.id}`)}
                        className="w-full px-3 py-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-cyan-300 cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <Icon name="Sliders" size={12} className="text-amber-400" />
                          Frecuencias y Ficha Técnica
                        </span>
                        <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={13} />
                      </button>

                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1.5 border-t border-white/5 space-y-2 text-[11px]">
                          <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                            {oscs.map((osc, i) => (
                              <div
                                key={osc.id || i}
                                className="flex flex-wrap items-center justify-between gap-1 bg-white/[0.03] rounded-lg px-2 py-1 font-mono text-[10px] text-slate-200 border border-white/5"
                              >
                                <span className="text-cyan-300 font-bold">{osc.frequency} Hz</span>
                                <span className="text-purple-300">{osc.type}</span>
                                <span className="text-emerald-300">{Math.round((osc.volume ?? 0.5) * 100)}%</span>
                                <span className="text-slate-400">
                                  ({Number(osc.panX ?? 0).toFixed(1)},{Number(osc.panY ?? 0).toFixed(1)},{Number(osc.panZ ?? 0).toFixed(1)})
                                </span>
                                <span className="text-pink-300">C/V {Number(osc.crestValleyRatio ?? 1).toFixed(1)}</span>
                              </div>
                            ))}
                          </div>

                          <div className="bg-cyan-950/30 border border-cyan-500/20 rounded-lg p-2 space-y-1">
                            <span className="block text-[10px] font-bold text-cyan-200">{tech.primaryMediumLabel}</span>
                            <p className="text-[10px] text-slate-300 leading-relaxed">{tech.usageMode}</p>
                            <div className="grid grid-cols-2 gap-1 pt-1 text-[10px] font-mono text-slate-300">
                              <span>Vol: {tech.recommendedVolume}</span>
                              <span>Dur: {tech.recommendedDuration || '20–45 min'}</span>
                              <span>V: {tech.recommendedVoltage || '1.2–12V'}</span>
                              <span>A: {tech.recommendedAmperage || '40–300mA'}</span>
                              <span>W: {tech.recommendedWatts || '0.5–5W'}</span>
                              <span>{tech.frequencyScales.khz || '—'}</span>
                              <span>{tech.frequencyScales.mhz || '—'}</span>
                              <span>{tech.frequencyScales.opticalNm || '—'}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => togglePreview(`preset-${preset.id}`, oscs)}
                          className={`p-2 rounded-xl border transition-colors flex items-center justify-center shrink-0 cursor-pointer ${
                            isPreviewing
                              ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                              : 'bg-black/50 border-white/10 hover:border-white/25 text-slate-300 hover:text-white'
                          }`}
                          title={isPreviewing ? 'Detener pre-escucha' : 'Pre-escuchar partícula'}
                        >
                          <Icon name={isPreviewing ? 'Square' : 'Play'} size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            stopPreview();
                            if (onMixPreset) onMixPreset(preset);
                            else onLoadPreset(preset);
                          }}
                          className="flex-1 py-2 px-3 bg-purple-500/20 hover:bg-purple-500/40 text-purple-200 border border-purple-500/35 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          + Mezclar
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            stopPreview();
                            onLoadPreset(preset);
                          }}
                          className="flex-1 py-2 px-3 bg-cyan-500/20 hover:bg-cyan-500 text-cyan-200 hover:text-black border border-cyan-500/40 rounded-xl text-xs font-bold transition-all shadow-[0_0_12px_rgba(34,211,238,0.18)] cursor-pointer"
                        >
                          Cargar
                        </button>
                      </div>

                      {isOwn && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommunityPreset(preset);
                              setShowPublishModal(true);
                            }}
                            className="flex-1 py-1.5 px-3 bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Icon name="Edit3" size={12} /> Editar / Modificar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCommunityPreset(preset)}
                            className="py-1.5 px-3 bg-red-500/15 hover:bg-red-500/30 border border-red-500/30 text-red-300 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Icon name="Trash2" size={12} /> Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }}
            />
          )}
        </div>
      )}

      {/* TAB 2: ENTONACION / SINTONIZACIONES EN VIVO */}
      {activeTab === 'entonacion' && (
        <div className="lg:flex-1 lg:overflow-y-auto lg:pr-1 custom-scrollbar">
          <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-3 text-center sm:text-left">
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-purple-300">
              <Icon name="Radio" size={22} /> Sintonizaciones Cuánticas en Vivo
            </h2>
            <div className="flex flex-wrap gap-2 items-center justify-center">
              <div className="flex bg-black/50 border border-white/10 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setSortBy('recent')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer ${
                    sortBy === 'recent' ? 'bg-white/15 text-white' : 'text-slate-400'
                  }`}
                >
                  Nuevas
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('popular')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer ${
                    sortBy === 'popular' ? 'bg-white/15 text-white' : 'text-slate-400'
                  }`}
                >
                  Más Activas
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onStartSessionRequest) onStartSessionRequest();
                }}
                className="px-3.5 py-1.5 bg-purple-500/25 text-purple-200 hover:bg-purple-500 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.25)] cursor-pointer"
              >
                <Icon name="Radio" size={14} className="animate-pulse" /> Transmitir
              </button>
              <button
                type="button"
                onClick={loadData}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 border border-white/10 cursor-pointer"
                title="Actualizar"
              >
                <Icon name="RefreshCw" size={16} />
              </button>
            </div>
          </div>

          {/* Categories Chips */}
          <div className="flex flex-wrap justify-center sm:justify-start gap-2 pb-4 mb-2">
            {activeTabCategories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-purple-500/25 border-purple-400/60 text-white shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                    : 'bg-black/45 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon name={cat.iconName} size={13} className={cat.color} />
                <span>{cat.label}</span>
                <span className="text-[10px] px-1.5 rounded-full bg-white/10 text-slate-300 font-mono">
                  {cat.count}
                </span>
              </button>
            ))}
          </div>

          {sortedSessions.length === 0 ? (
            <div className="py-16 mb-8 text-center text-slate-500 border border-dashed border-white/10 rounded-2xl">
              <Icon name="MicOff" size={32} className="mx-auto mb-3 opacity-40" />
              <p className="mb-1 text-white/70">No hay sintonizaciones activas.</p>
              <p className="text-xs">Inicia una sesión local o global y transmite al universo cuántico.</p>
            </div>
          ) : (
            <AdaptiveParticleGrid<LiveSession>
              items={sortedSessions}
              getItemKey={(s) => s.id}
              columnsConfig={{ base: 1, md: 2 }}
              gapPx={16}
              className="pb-8"
              renderItem={(session) => {
                const oscs = session.presetContent?.oscillators || [];
                const catKey = session.category || session.presetContent?.category || 'Varios';
                const knownCat = CATEGORIES.find(c => c.id === catKey);
                const tech =
                  session.presetContent?.technicalRecommendation ||
                  autoSuggestTechnicalRecommendation(oscs, catKey, session.presetName);
                const isOwn =
                  (user?.id && user.id === session.hostId) ||
                  session.hostId === 'local-host';
                const isExpanded = Boolean(expandedCards[`session-${session.id}`]);
                const isPreviewing = previewingId === `session-${session.id}`;
                const avgFreq =
                  oscs.length > 0
                    ? (oscs.reduce((acc, o) => acc + (Number(o.frequency) || 0), 0) / oscs.length).toFixed(2)
                    : '0.00';

                return (
                  <div className="bg-gradient-to-br from-black/85 to-[#1b152c]/85 border border-purple-500/35 rounded-2xl hover:border-purple-400 transition-all relative overflow-hidden flex flex-col h-fit shadow-lg">
                    <div className="absolute inset-0 z-0 pointer-events-none">
                      {session.cover_url ? (
                        <img src={session.cover_url} alt="" className="w-full h-full object-cover opacity-20 mix-blend-screen" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-500/10 to-transparent blur-2xl" />
                      )}
                    </div>

                    <div className="relative z-10 flex flex-col h-fit p-5 gap-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full border-2 border-purple-500/50 overflow-hidden bg-black/60 shrink-0 flex items-center justify-center">
                            {session.avatar_url ? (
                              <img src={session.avatar_url} alt={session.hostName} className="w-full h-full object-cover" />
                            ) : (
                              <Icon name="User" size={18} className="text-purple-300" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-bold text-white leading-tight truncate">
                              {session.presetName}
                            </h3>
                            <p className="text-xs text-slate-400 truncate">
                              por <span className="text-purple-300 font-bold">{session.hostName}</span>
                            </p>
                          </div>
                        </div>
                        <span className="flex items-center gap-1 text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 px-2.5 py-1 rounded-full font-bold animate-pulse whitespace-nowrap shrink-0">
                          <Icon name="Radio" size={10} /> EN VIVO
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold ${
                            knownCat?.color || 'text-purple-300'
                          }`}
                        >
                          <Icon name={knownCat?.iconName || 'Layers'} size={10} />
                          {knownCat?.label || catKey}
                        </span>
                        {session.useLocalMesh && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                            Mesh Local
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 line-clamp-2 font-light">
                        {session.description || session.presetContent?.description || 'Sin descripción.'}
                      </p>

                      <div className="bg-black/55 rounded-xl p-2.5 text-xs text-slate-300 flex flex-col gap-1 border border-white/10">
                        <div className="flex justify-between items-center">
                          <span>Frecuencias Activas:</span>
                          <span className="text-white font-mono font-bold">{oscs.length}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Promedio Armónico:</span>
                          <span className="text-cyan-300 font-mono font-bold">{avgFreq} Hz</span>
                        </div>
                      </div>

                      <ParticleWaveformBand oscillators={oscs} isPlaying={isPreviewing} compact />

                      {/* Collapsible Live Session Inspector */}
                      <div className="rounded-xl bg-black/50 border border-white/10 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleExpandCard(`session-${session.id}`)}
                          className="w-full px-3 py-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-purple-300 cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <Icon name="Sliders" size={12} className="text-cyan-400" />
                            Inspeccionar Frecuencias y Recomendación
                          </span>
                          <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={13} />
                        </button>

                        {isExpanded && (
                          <div className="px-3 pb-3 pt-1.5 border-t border-white/5 space-y-2 text-[11px]">
                            <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                              {oscs.map((osc, i) => (
                                <div
                                  key={osc.id || i}
                                  className="flex flex-wrap items-center justify-between gap-1 bg-white/[0.03] rounded-lg px-2 py-1 font-mono text-[10px] text-slate-200 border border-white/5"
                                >
                                  <span className="text-cyan-300 font-bold">{osc.frequency} Hz</span>
                                  <span className="text-purple-300">{osc.type}</span>
                                  <span className="text-emerald-300">{Math.round((osc.volume ?? 0.5) * 100)}%</span>
                                  <span className="text-slate-400">Pan {Number(osc.panX ?? 0).toFixed(1)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="bg-purple-950/30 border border-purple-500/20 rounded-lg p-2 space-y-1">
                              <span className="block text-[10px] font-bold text-purple-200">{tech.primaryMediumLabel}</span>
                              <p className="text-[10px] text-slate-300">{tech.usageMode}</p>
                              <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-slate-300 pt-1">
                                <span>Vol: {tech.recommendedVolume}</span>
                                <span>V: {tech.recommendedVoltage || '1.2–12V'}</span>
                                <span>W: {tech.recommendedWatts || '0.5–5W'}</span>
                                <span>{tech.frequencyScales.opticalNm || '—'}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 bg-black/45 px-3 py-1.5 rounded-full border border-white/10 justify-between">
                        <span className="flex items-center gap-1">
                          <Icon name="Users" size={12} className="text-fuchsia-400" />
                          {session.participantsCount || 1} Mentes
                        </span>
                        <span className="flex items-center gap-1">
                          <Icon
                            name={session.allowOpenModifications ? 'Unlock' : 'Lock'}
                            size={12}
                            className={session.allowOpenModifications ? 'text-green-400' : 'text-red-400'}
                          />
                          {session.allowOpenModifications ? 'Abierto' : 'Solo Host'}
                        </span>
                        {session.fixedPermissions && (
                          <span className="flex items-center gap-1 text-amber-400" title="Host Persistente">
                            <Icon name="Anchor" size={12} /> Fijo
                          </span>
                        )}
                      </div>

                      {isOwn && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEditSessionModal(session)}
                            className="flex-1 py-1.5 px-3 bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Icon name="Edit3" size={12} /> Editar Sala
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSession(session)}
                            className="py-1.5 px-3 bg-red-500/15 hover:bg-red-500/30 border border-red-500/30 text-red-300 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Icon name="Trash2" size={12} /> Finalizar
                          </button>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => togglePreview(`session-${session.id}`, oscs)}
                          className={`p-2.5 rounded-xl border transition-colors flex items-center justify-center shrink-0 cursor-pointer ${
                            isPreviewing
                              ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                              : 'bg-black/50 border-white/10 hover:border-white/25 text-slate-300 hover:text-white'
                          }`}
                          title={isPreviewing ? 'Detener pre-escucha' : 'Pre-escuchar sonido'}
                        >
                          <Icon name={isPreviewing ? 'Square' : 'Play'} size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            stopPreview();
                            onJoinSession(session);
                          }}
                          className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)] flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Icon name="Headphones" size={15} /> {isOwn ? 'Entrar como Host' : 'Sincronizar'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
          )}
        </div>
      )}

      {/* TAB 3: PERFILES */}
      {activeTab === 'perfiles' && (
        <div className="lg:flex-1 lg:overflow-y-auto lg:pr-1 custom-scrollbar">
          <div className="flex flex-col sm:flex-row items-center justify-between mb-5 gap-3 text-center sm:text-left">
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-amber-400">
              <Icon name="Users" size={22} /> Exploradores Cuánticos
            </h2>
            <div className="flex flex-wrap gap-2 items-center justify-center">
              <div className="flex bg-black/50 border border-white/10 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setSortBy('recent')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer ${
                    sortBy === 'recent' ? 'bg-white/15 text-white' : 'text-slate-400'
                  }`}
                >
                  Recientes
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('popular')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer ${
                    sortBy === 'popular' ? 'bg-white/15 text-white' : 'text-slate-400'
                  }`}
                >
                  Más Resonantes
                </button>
              </div>
              <button
                type="button"
                onClick={loadData}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 border border-white/10 cursor-pointer"
              >
                <Icon name="RefreshCw" size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
            {sortedProfiles.map(p => (
              <div
                key={p.id}
                className="bg-black/60 border border-white/10 rounded-2xl overflow-hidden relative group hover:border-amber-500/50 transition-colors"
              >
                <div className="h-20 bg-gradient-to-br from-slate-900 to-black relative">
                  {p.cover_url && (
                    <img src={p.cover_url} className="w-full h-full object-cover opacity-60 mix-blend-screen" alt="Cover" />
                  )}
                  {p.status === 'online' && (
                    <span className="absolute top-2 right-2 bg-green-500/20 text-green-400 border border-green-500/50 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> Activo
                    </span>
                  )}
                </div>

                <div className="p-4 pt-0 relative">
                  <div className="w-16 h-16 rounded-full border-4 border-black bg-gradient-to-tr from-cyan-500 to-amber-500 -mt-8 mb-2 flex items-center justify-center font-bold text-xl overflow-hidden text-black">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} className="w-full h-full object-cover" alt="Avatar" />
                    ) : (
                      p.displayName.charAt(0).toUpperCase()
                    )}
                  </div>

                  <h3 className="font-bold text-white mb-1">{p.displayName}</h3>

                  <div className="flex gap-4 text-xs text-slate-400 mb-4">
                    <span className="flex items-center gap-1">
                      <Icon name="Activity" size={12} className="text-cyan-400" /> {p.particlesCount} Partículas
                    </span>
                    <span className="flex items-center gap-1">
                      <Icon name="Radio" size={12} className="text-amber-400" /> {p.resonancesCount} Resonancias
                    </span>
                  </div>

                  {user && user.id !== p.id ? (
                    <button
                      type="button"
                      onClick={() =>
                        handleProtectedAction(async () => {
                          try {
                            if (resonancesCache[p.id]) {
                              await unresonateWithUser(user.id, p.id);
                              setResonancesCache(prev => ({ ...prev, [p.id]: false }));
                            } else {
                              await resonateWithUser(user.id, p.id);
                              setResonancesCache(prev => ({ ...prev, [p.id]: true }));
                            }
                            loadData();
                          } catch (e) {
                            console.error(e);
                          }
                        })
                      }
                      className={`w-full py-2 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                        resonancesCache[p.id]
                          ? 'bg-white/10 text-slate-300 hover:bg-red-500/20 hover:text-red-400'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500 hover:text-black'
                      }`}
                    >
                      <Icon name="Radio" size={16} /> {resonancesCache[p.id] ? 'Dejar de Resonar' : 'Resonar'}
                    </button>
                  ) : (
                    <div className="w-full py-2 text-center text-xs text-slate-500">
                      {user?.id === p.id ? 'Este es tu avatar cuántico' : 'Inicia sesión para resonar'}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: RADAR MESH */}
      {activeTab === 'radar' && (
        <div className="lg:flex-1 lg:overflow-y-auto lg:pr-1 custom-scrollbar pb-8">
          <MeshSignalMap />
        </div>
      )}

      {/* Publish / Edit Community Particle Modal */}
      {showPublishModal && user && (
        <PublishParticleModal
          onClose={() => {
            setShowPublishModal(false);
            setEditingCommunityPreset(undefined);
            loadData();
          }}
          oscillators={currentOscillators}
          user={user}
          editingPreset={editingCommunityPreset}
        />
      )}

      {/* Edit Live Session Modal */}
      {editingSession && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setEditingSession(null)}
        >
          <form
            onSubmit={handleSaveSessionEdit}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-[#0a0f1f] border border-purple-500/40 rounded-3xl p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Icon name="Edit3" size={16} className="text-purple-400" />
                Editar Sintonización en Vivo
              </h3>
              <button type="button" onClick={() => setEditingSession(null)} className="text-slate-400 hover:text-white">
                <Icon name="X" size={18} />
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nombre de la Sala</label>
              <input
                type="text"
                required
                value={editSessionName}
                onChange={e => setEditSessionName(e.target.value)}
                className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white focus:border-purple-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Categoría</label>
              <select
                value={editSessionCategory}
                onChange={e => setEditSessionCategory(e.target.value)}
                className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white focus:border-purple-400 focus:outline-none"
              >
                {EDITABLE_CATEGORIES.map(c => (
                  <option key={c.id} value={c.id} className="bg-slate-900">
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Descripción</label>
              <textarea
                value={editSessionDescription}
                onChange={e => setEditSessionDescription(e.target.value)}
                rows={3}
                className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white focus:border-purple-400 focus:outline-none resize-none"
              />
            </div>

            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2.5 bg-white/[0.03] border border-white/10 rounded-xl p-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editSessionPublic}
                  onChange={e => setEditSessionPublic(e.target.checked)}
                  className="accent-purple-500"
                />
                <span className="text-slate-200 font-semibold">Sesión Pública (visible en Sintonización)</span>
              </label>

              <label className="flex items-center gap-2.5 bg-white/[0.03] border border-white/10 rounded-xl p-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editSessionOpenMod}
                  onChange={e => setEditSessionOpenMod(e.target.checked)}
                  className="accent-purple-500"
                />
                <span className="text-slate-200 font-semibold">Modificaciones Abiertas a participantes</span>
              </label>

              <label className="flex items-center gap-2.5 bg-white/[0.03] border border-white/10 rounded-xl p-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editSessionFixedPerms}
                  onChange={e => setEditSessionFixedPerms(e.target.checked)}
                  className="accent-purple-500"
                />
                <span className="text-slate-200 font-semibold">Persistencia de Host</span>
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingSession(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/15 text-xs font-bold text-slate-300 hover:bg-white/5 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingSessionEdit}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {savingSessionEdit && <Icon name="Loader" size={14} className="animate-spin" />}
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default OnlineLibrary;
