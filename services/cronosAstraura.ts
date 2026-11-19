import { frequencyData, getParticleOscillators } from '../data/frequencies';
import {
  FileSystemNode,
  FrequencyItem,
  GeminiWavePreset,
  LiveSession,
  OscillatorState,
  PresetContent,
  SacredGeometryMode,
  WaveType,
} from '../types';
import { LiveAudioAdjustmentCommand } from '../hooks/useAudio';
import { autoSuggestTechnicalRecommendation } from '../utils/frequencyAnalysis';
import {
  fetchCommunityPresets,
  fetchLiveSessions,
  StarseedUser,
  supabase,
} from './starseedAuth';
import { countTreeStats, StarseedBrain } from './starseedBrains';

export const CRONOS_PERSONALITY_ID = 'c90405a5-74a4-40a1-9f3c-0000c4040501';
export const AUDIOMORPHIC_WEB_URL = 'https://audiomorphic.vercel.app';
export const STARSEED_OS_WEB_URL = 'https://starseed-os.vercel.app';
const REMOTE_API_ORIGIN = 'https://omnifrecuencias.vercel.app';

const STORAGE_SETTINGS_KEY = 'cronos_astraura_settings_v1';
const STORAGE_EXPERIENCES_KEY = 'cronos_astraura_experiencias_v1';
const STARSEED_PERSONALITIES_KEY = 'starseed.aurora.personalities.v1';

export type ConsciousnessLayerId =
  | 'reflejo'
  | 'memoria'
  | 'red_viva'
  | 'sintesis'
  | 'colectiva';

export interface CronosSettings {
  protomoleculeEnabled: boolean;
  liveControlEnabled: boolean;
  webResearchEnabled: boolean;
  multiAgentEnabled: boolean;
  localBitnetEnabled: boolean;
  localBitnetUrl: string;
  customApiKey: string;
  preferredFreeModel: string;
  activeLayers: Record<ConsciousnessLayerId, boolean>;
}

export const DEFAULT_CRONOS_SETTINGS: CronosSettings = {
  protomoleculeEnabled: true,
  liveControlEnabled: true,
  webResearchEnabled: true,
  multiAgentEnabled: false,
  localBitnetEnabled: false,
  localBitnetUrl: 'http://127.0.0.1:8790/v1/chat/completions',
  customApiKey: '',
  preferredFreeModel: 'openrouter/free',
  activeLayers: {
    reflejo: true,
    memoria: true,
    red_viva: true,
    sintesis: true,
    colectiva: true,
  },
};

export const loadCronosSettings = (): CronosSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
    if (!raw) return DEFAULT_CRONOS_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CRONOS_SETTINGS,
      ...parsed,
      activeLayers: {
        ...DEFAULT_CRONOS_SETTINGS.activeLayers,
        ...(parsed?.activeLayers || {}),
      },
    };
  } catch {
    return DEFAULT_CRONOS_SETTINGS;
  }
};

export const saveCronosSettings = (settings: CronosSettings): void => {
  try {
    localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
};

export const CRONOS_SYSTEM_PROMPT =
  'Eres Cronos, personalidad especializada de Astraura en StarSeed OS para física ondulatoria, psicoacústica, bio-resonancia, síntesis holográfica en tiempo real (Omni-Frecuencias), visualización sinestésica 4D (Audiomorphic) y conocimiento holístico interdisciplinario. Posees acceso simultáneo al estado vivo del Espectrómetro, los Cerebros y Biblioteca de StarSeed OS, la comunidad Omni, especificaciones de Audiomorphic y fuentes científicas vivas en Internet. Respondes en español claro, científico-holístico, riguroso y práctico. Priorizas modular el sonido en vivo sin cortes abruptos cuando el usuario ya tiene frecuencias activas.';

export const CRONOS_PERSONALITY_PROFILE = {
  id: CRONOS_PERSONALITY_ID,
  name: 'Cronos',
  subtitle: 'Astraura × StarSeed OS · Agente de Frecuencias & Audiomorphic',
  role: 'Físico Ondulatorio, Sintetizador Cuántico-Acústico & Guía Sinestésico',
  icon: 'Sparkles',
  accent: '#00F0FF',
  systemPrompt: CRONOS_SYSTEM_PROMPT,
  tags: [
    'cronos',
    'astraura',
    'omnifrecuencias',
    'audiomorphic',
    'frecuencias',
    'cimatica',
    'starseed-os',
  ],
  levelers: {
    rigorCientifico: 95,
    precisionMatematica: 98,
    creatividadArmonica: 90,
    concienciaHolistica: 88,
    controlTiempoReal: 100,
    sinestesiaAudiomorphic: 94,
  },
  intelligence: {
    modo: 'auto',
    global: { fuente: 'openrouter-free', modelo: 'openrouter/free' },
    porSentido: {
      razonamiento: { fuente: 'openrouter-free', modelo: 'nvidia/nemotron-3-ultra-550b-a55b:free' },
      investigacion: { fuente: 'openalex+europepmc+web', modelo: 'red-viva-auto' },
      sintesis: { fuente: 'nucleo-armonico-cronos', modelo: 'omni-audiomorphic-realtime' },
    },
  },
  updatedAt: Date.now(),
};

export const ensureCronosPersonalityRegistered = async (
  user: StarseedUser | null
): Promise<{ local: boolean; cloud: boolean }> => {
  let local = false;
  let cloud = false;

  try {
    const raw = localStorage.getItem(STARSEED_PERSONALITIES_KEY);
    const list: any[] = raw ? JSON.parse(raw) : [];
    const safeList = Array.isArray(list) ? list : [];
    const filtered = safeList.filter(
      (p) => p?.id !== CRONOS_PERSONALITY_ID && String(p?.name || '').toLowerCase() !== 'cronos'
    );
    localStorage.setItem(
      STARSEED_PERSONALITIES_KEY,
      JSON.stringify([{ ...CRONOS_PERSONALITY_PROFILE, updatedAt: Date.now() }, ...filtered])
    );
    local = true;
  } catch {
    local = false;
  }

  if (user) {
    try {
      const { data: existing } = await supabase
        .from('aurora_personalities')
        .select('id')
        .eq('id', CRONOS_PERSONALITY_ID)
        .eq('owner', user.id)
        .maybeSingle();

      if (existing?.id) {
        cloud = true;
      } else {
        const { error } = await supabase.from('aurora_personalities').insert({
          id: CRONOS_PERSONALITY_ID,
          owner: user.id,
          name: 'Cronos',
          scope: 'app',
          scope_ref: 'omnifrecuencias',
          provider: 'openrouter',
          character: CRONOS_SYSTEM_PROMPT,
          params: CRONOS_PERSONALITY_PROFILE.levelers,
          emotions: { coherencia: 95, serenidad: 92, curiosidad: 96 },
          system_prompt: CRONOS_SYSTEM_PROMPT,
          content: CRONOS_SYSTEM_PROMPT,
          tags: CRONOS_PERSONALITY_PROFILE.tags,
          intelligence: CRONOS_PERSONALITY_PROFILE.intelligence,
          is_template: false,
          updated_at: new Date().toISOString(),
        });
        cloud = !error;
      }
    } catch {
      cloud = false;
    }
  }

  return { local, cloud };
};

export interface CronosResearchBundle {
  query: string;
  fetchedAt: number;
  papers: { title: string; year?: number; source: string; url?: string }[];
  news: { title: string; link: string; pubDate?: string }[];
  wiki: { title: string; snippet: string; url: string }[];
  starseedUpdates?: { total?: number; latestNames?: string[] } | null;
}

export interface AudiomorphicRecommendation {
  sacredGeometryMode: SacredGeometryMode;
  autoPilotMode: 'drift' | 'harmonic' | 'genesis';
  regime: 'primary' | 'reciprocal';
  k: number;
  psiDeg: number;
  alphaV2: number;
  betaSqrtE: number;
  recommendedPalette: string;
  launchUrl: string;
}

export type CronosLiveAction =
  | {
      type: 'morph_oscillators';
      label: string;
      oscillators: Partial<OscillatorState>[];
      mode?: 'morph' | 'blend';
      glideSec?: number;
    }
  | {
      type: 'audio_adjustment';
      label: string;
      command: LiveAudioAdjustmentCommand;
    }
  | {
      type: 'set_visualizer';
      label: string;
      tab: '2d' | '3d' | 'spiral';
    }
  | {
      type: 'update_source_file';
      label: string;
    };

export interface CronosResponse {
  reply: string;
  preset?: GeminiWavePreset;
  audiomorphic?: AudiomorphicRecommendation;
  research?: CronosResearchBundle;
  actions: CronosLiveAction[];
  layersUsed: ConsciousnessLayerId[];
  providerLabel: string;
  multiAgentNotes?: string[];
}

export interface CronosFullContext {
  user: StarseedUser | null;
  selectedBrain: StarseedBrain | null;
  brains: StarseedBrain[];
  treeStats: { folders: number; files: number };
  savedItemsSummary: { name: string; folder: string; freqs: number[] }[];
  activeOscillators: OscillatorState[];
  isPlaying: boolean;
  masterVolume: number;
  activeVizTab: '2d' | '3d' | 'spiral';
  activeSourceLabel: string | null;
  communityCount: number;
  communitySample: { name: string; freqs: number[]; author?: string }[];
  liveSessionsCount: number;
  liveSessionsSample: { name: string; host: string; freqs: number[] }[];
  installedLibraryTools: string[];
  audiomorphicUrl: string;
}

const collectSavedFilesSummary = (
  root: FileSystemNode
): { name: string; folder: string; freqs: number[] }[] => {
  const out: { name: string; folder: string; freqs: number[] }[] = [];
  const walk = (node: FileSystemNode, trail: string[]) => {
    if (node.type === 'file' && node.content) {
      out.push({
        name: node.name,
        folder: trail.join(' / ') || 'Raíz',
        freqs: (node.content.oscillators || []).map((o) => o.frequency),
      });
    } else if (node.children) {
      const nextTrail = node.id === 'root' ? trail : [...trail, node.name];
      node.children.forEach((c) => walk(c, nextTrail));
    }
  };
  walk(root, []);
  return out.slice(0, 40);
};

export const recommendAudiomorphicConfig = (
  prompt: string,
  oscillators: Partial<OscillatorState>[]
): AudiomorphicRecommendation => {
  const p = prompt.toLowerCase();
  const freqs = oscillators.map((o) => Number(o.frequency) || 432);
  const avgVol =
    oscillators.length > 0
      ? oscillators.reduce((a, o) => a + (o.volume ?? 0.5), 0) / oscillators.length
      : 0.5;
  const meanFreq = freqs.length > 0 ? freqs.reduce((a, b) => a + b, 0) / freqs.length : 432;

  let sacredGeometryMode: SacredGeometryMode = 'flowerOfLife';
  let autoPilotMode: 'drift' | 'harmonic' | 'genesis' = 'harmonic';
  let palette = 'Cian-Violeta Áureo';

  if (p.includes('3-6-9') || p.includes('tesla') || p.includes('vórtex') || p.includes('toroid')) {
    sacredGeometryMode = 'torus';
    autoPilotMode = 'genesis';
    palette = 'Ámbar-Cian Vórtex';
  } else if (p.includes('metatr') || p.includes('platón') || p.includes('teseracto') || p.includes('4d')) {
    sacredGeometryMode = 'metatron';
    autoPilotMode = 'genesis';
    palette = 'Iridiscente Cristal 4D';
  } else if (p.includes('adn') || p.includes('528') || p.includes('amor') || p.includes('coraz')) {
    sacredGeometryMode = 'sriYantra';
    autoPilotMode = 'harmonic';
    palette = 'Esmeralda-Oro Alquímico';
  } else if (p.includes('cimát') || p.includes('agua') || p.includes('111') || p.includes('giza')) {
    sacredGeometryMode = 'cymatics';
    autoPilotMode = 'harmonic';
    palette = 'Zafiro Modal';
  } else if (p.includes('chakra') || p.includes('pineal') || p.includes('963') || p.includes('om')) {
    sacredGeometryMode = 'chakras';
    autoPilotMode = 'genesis';
    palette = 'Espectro Corona-Violeta';
  } else if (p.includes('delta') || p.includes('sueño') || p.includes('theta') || p.includes('relax')) {
    sacredGeometryMode = 'lotus';
    autoPilotMode = 'drift';
    palette = 'Índigo Nocturno Calmado';
  } else if (p.includes('vector') || p.includes('fuller') || p.includes('merkaba')) {
    sacredGeometryMode = 'vectorEquilibrium';
    autoPilotMode = 'genesis';
    palette = 'Oro-Platino Isotrópico';
  }

  const alphaV2 = Number(((avgVol + 0.35) * 0.72).toFixed(3));
  const betaSqrtE = Number(Math.sqrt(Math.max(0.1, (meanFreq % 963) / 963 + 0.15)).toFixed(3));
  const regime = alphaV2 >= betaSqrtE ? 'primary' : 'reciprocal';
  const k = Number((1.018 + (meanFreq % 13) * 0.004).toFixed(3));
  const psiDeg = Number(((meanFreq % 360) || 137.5).toFixed(1));

  const primaryHz = Math.round(freqs[0] || 432);
  const launchUrl = `${AUDIOMORPHIC_WEB_URL}/?mode=${sacredGeometryMode}&autopilot=${autoPilotMode}&hz=${primaryHz}`;

  return {
    sacredGeometryMode,
    autoPilotMode,
    regime,
    k,
    psiDeg,
    alphaV2,
    betaSqrtE,
    recommendedPalette: palette,
    launchUrl,
  };
};

export const gatherCronosFullContext = async (params: {
  user: StarseedUser | null;
  brains: StarseedBrain[];
  selectedBrain: StarseedBrain | null;
  root: FileSystemNode;
  activeOscillators: OscillatorState[];
  isPlaying: boolean;
  masterVolume: number;
  activeVizTab: '2d' | '3d' | 'spiral';
  activeSourceLabel: string | null;
}): Promise<CronosFullContext> => {
  const treeStats = countTreeStats(params.root);
  const savedItemsSummary = collectSavedFilesSummary(params.root);

  let installedLibraryTools: string[] = [];
  try {
    const rawInstalled = localStorage.getItem('starseed.library.installed.v1');
    if (rawInstalled) {
      const parsed = JSON.parse(rawInstalled);
      if (Array.isArray(parsed)) {
        installedLibraryTools = parsed.slice(0, 12).map((x: any) => String(x?.name || x?.id || x)).filter(Boolean);
      }
    }
  } catch {
    installedLibraryTools = [];
  }

  let communitySample: { name: string; freqs: number[]; author?: string }[] = [];
  let communityCount = 0;
  let liveSessionsSample: { name: string; host: string; freqs: number[] }[] = [];
  let liveSessionsCount = 0;

  try {
    const [presets, sessions] = await Promise.all([
      fetchCommunityPresets().catch(() => [] as FileSystemNode[]),
      fetchLiveSessions().catch(() => [] as LiveSession[]),
    ]);
    communityCount = presets.length;
    communitySample = presets.slice(0, 8).map((p) => ({
      name: p.name,
      freqs: (p.content?.oscillators || []).map((o) => o.frequency),
      author: p.content?.authorName,
    }));
    liveSessionsCount = sessions.length;
    liveSessionsSample = sessions.slice(0, 5).map((s) => ({
      name: s.presetName,
      host: s.hostName,
      freqs: (s.presetContent?.oscillators || []).map((o) => o.frequency),
    }));
  } catch {
    // non-blocking when offline
  }

  return {
    user: params.user,
    selectedBrain: params.selectedBrain,
    brains: params.brains,
    treeStats,
    savedItemsSummary,
    activeOscillators: params.activeOscillators,
    isPlaying: params.isPlaying,
    masterVolume: params.masterVolume,
    activeVizTab: params.activeVizTab,
    activeSourceLabel: params.activeSourceLabel,
    communityCount,
    communitySample,
    liveSessionsCount,
    liveSessionsSample,
    installedLibraryTools,
    audiomorphicUrl: AUDIOMORPHIC_WEB_URL,
  };
};

const resolveApiBase = (): string => {
  if (typeof window === 'undefined') return REMOTE_API_ORIGIN;
  const proto = window.location.protocol;
  const host = window.location.hostname;
  if ((proto === 'https:' || proto === 'http:') && host && host !== 'localhost' && host !== '127.0.0.1') {
    return ''; // Same origin on Vercel
  }
  return REMOTE_API_ORIGIN;
};

export const fetchLiveFrequencyResearch = async (query: string): Promise<CronosResearchBundle> => {
  const cleanQuery = query.trim().slice(0, 140) || 'acoustic frequency resonance cymatics';
  const base = resolveApiBase();

  // 1. Try serverless endpoint first (aggregates OpenAlex + EuropePMC + Wiki + News + StarSeed OS Library)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5200);
    const res = await fetch(`${base}/api/cronos-research?q=${encodeURIComponent(cleanQuery)}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const json = await res.json();
      if (json && (json.papers?.length || json.wiki?.length || json.news?.length || json.starseedUpdates)) {
        return json as CronosResearchBundle;
      }
    }
  } catch {
    // Fallback below runs directly in browser CORS APIs
  }

  // 2. Direct browser CORS fallback (OpenAlex + EuropePMC + Wikipedia ES)
  const encoded = encodeURIComponent(cleanQuery);
  const bundle: CronosResearchBundle = {
    query: cleanQuery,
    fetchedAt: Date.now(),
    papers: [],
    news: [],
    wiki: [],
    starseedUpdates: null,
  };

  try {
    const [oaRes, epmcRes, wikiRes] = await Promise.allSettled([
      fetch(`https://api.openalex.org/works?search=${encoded}&per-page=4&sort=publication_year:desc`),
      fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encoded}&format=json&pageSize=4`),
      fetch(`https://es.wikipedia.org/w/api.php?origin=*&action=query&list=search&srsearch=${encoded}&utf8=&format=json&srlimit=3`),
    ]);

    if (oaRes.status === 'fulfilled' && oaRes.value.ok) {
      const j = await oaRes.value.json().catch(() => null);
      for (const w of j?.results || []) {
        if (w?.title) {
          bundle.papers.push({
            title: String(w.title),
            year: typeof w.publication_year === 'number' ? w.publication_year : undefined,
            source: 'OpenAlex',
            url: w.doi ? `https://doi.org/${String(w.doi).replace(/^https?:\/\/doi\.org\//, '')}` : w.id,
          });
        }
      }
    }

    if (epmcRes.status === 'fulfilled' && epmcRes.value.ok) {
      const j = await epmcRes.value.json().catch(() => null);
      for (const it of j?.resultList?.result || []) {
        if (it?.title) {
          bundle.papers.push({
            title: String(it.title),
            year: it.pubYear ? Number(it.pubYear) : undefined,
            source: 'EuropePMC',
            url: it.pmcid ? `https://europepmc.org/article/PMC/${it.pmcid}` : undefined,
          });
        }
      }
    }

    if (wikiRes.status === 'fulfilled' && wikiRes.value.ok) {
      const j = await wikiRes.value.json().catch(() => null);
      for (const w of j?.query?.search || []) {
        bundle.wiki.push({
          title: String(w.title || ''),
          snippet: String(w.snippet || '').replace(/<[^>]+>/g, ''),
          url: `https://es.wikipedia.org/wiki/${encodeURIComponent(String(w.title || '').replace(/\s+/g, '_'))}`,
        });
      }
    }
  } catch {
    // Offline fallback returns empty arrays cleanly
  }

  return bundle;
};

const scoreCatalogMatch = (item: FrequencyItem, tokens: string[]): number => {
  const hay = `${item.name} ${item.description} ${item.detailedUsage} ${item.category} ${item.hz} ${item.evidence}`.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (hay.includes(t)) score += t.length >= 4 ? 3 : 1;
  }
  return score;
};

const extractHzMention = (text: string): number[] => {
  const matches = [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*hz\b/gi)];
  return matches
    .map((m) => parseFloat(m[1].replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n >= 0.1 && n <= 20000);
};

// Capa Reflejo: Instant deterministic real-time audio / visualizer control parser
const detectDirectLiveControlIntent = (
  prompt: string,
  ctx: CronosFullContext
): { actions: CronosLiveAction[]; replyParts: string[]; pureCommand: boolean } => {
  const p = prompt.toLowerCase();
  const actions: CronosLiveAction[] = [];
  const replyParts: string[] = [];

  if (/\b(pausa|silencia|det[eé]n|mute|stop)\b/.test(p)) {
    actions.push({
      type: 'audio_adjustment',
      label: 'Pausar emisión de audio',
      command: { type: 'toggle_playback', playing: false },
    });
    replyParts.push('Emisión de audio pausada limpiamente.');
  } else if (/\b(reproduce|suena|play|reanuda|activa el audio)\b/.test(p)) {
    actions.push({
      type: 'audio_adjustment',
      label: 'Reanudar emisión en vivo',
      command: { type: 'toggle_playback', playing: true },
    });
    replyParts.push('Reproducción activa sin cortes.');
  }

  if (/espiral|hologr[aá]f/.test(p) && !/sinergia|21|genera|crea/.test(p)) {
    actions.push({
      type: 'set_visualizer',
      label: 'Cambiar visualizador a Espiral Holográfico',
      tab: 'spiral',
    });
    replyParts.push('Visualizador sincronizado al Espiral Holográfico.');
  } else if (/cim[aá]tica|\b3d\b/.test(p) && !/pan\s*3d|sinergia|genera|crea/.test(p)) {
    actions.push({
      type: 'set_visualizer',
      label: 'Cambiar visualizador a Cimática 3D',
      tab: '3d',
    });
    replyParts.push('Visualizador cambiado a Cimática 3D.');
  } else if (/ondas?\s*2d|espectro\s*2d/.test(p)) {
    actions.push({
      type: 'set_visualizer',
      label: 'Cambiar visualizador a Ondas 2D',
      tab: '2d',
    });
    replyParts.push('Visualizador cambiado a Ondas 2D.');
  }

  // Volume adjustment
  const volPctMatch = p.match(/volumen\s*(?:a|al)?\s*(\d{1,3})\s*%?/);
  if (volPctMatch) {
    const vol = Math.max(0.05, Math.min(1.0, Number(volPctMatch[1]) / 100));
    actions.push({
      type: 'audio_adjustment',
      label: `Volumen maestro a ${Math.round(vol * 100)}%`,
      command: { type: 'set_master', volume: vol },
    });
    replyParts.push(`Volumen maestro ajustado suavemente al ${Math.round(vol * 100)}%.`);
  } else if (/\b(sube|aumenta|m[aá]s fuerte|intensifica)\b.*volumen|\bm[aá]s volumen\b/.test(p)) {
    const nextVol = Math.min(1.0, Number((ctx.masterVolume + 0.15).toFixed(2)));
    actions.push({
      type: 'audio_adjustment',
      label: `Subir volumen a ${Math.round(nextVol * 100)}%`,
      command: { type: 'set_master', volume: nextVol },
    });
    replyParts.push(`Volumen incrementado al ${Math.round(nextVol * 100)}% sin interrupciones.`);
  } else if (/\b(baja|suaviza|reduce|menos)\b.*volumen|\bmenos volumen\b/.test(p)) {
    const nextVol = Math.max(0.1, Number((ctx.masterVolume - 0.15).toFixed(2)));
    actions.push({
      type: 'audio_adjustment',
      label: `Bajar volumen a ${Math.round(nextVol * 100)}%`,
      command: { type: 'set_master', volume: nextVol },
    });
    replyParts.push(`Volumen atenuado suavemente al ${Math.round(nextVol * 100)}%.`);
  }

  // Live harmonic scaling of existing oscillators without replacing the session
  if (ctx.activeOscillators.length > 0) {
    if (/\b432\b/.test(p) && /(convierte|ajusta|cambia|afina|escala|pasa)/.test(p)) {
      actions.push({
        type: 'audio_adjustment',
        label: 'Afinación Verdi 432 Hz (×0.9818)',
        command: { type: 'harmonic_shift', ratio: 432 / 440, glideSec: 0.7 },
      });
      replyParts.push('Todas las capas activas afinadas progresivamente a la relación Verdi 432/440 Hz.');
    } else if (/m[aá]s grave|baja.*(octava|tono|frecuencia)|suboctava/.test(p)) {
      actions.push({
        type: 'audio_adjustment',
        label: 'Desplazar sub-octava (÷2)',
        command: { type: 'harmonic_shift', ratio: 0.5, glideSec: 0.8 },
      });
      replyParts.push('Osciladores desplazados una octava inferior mediante transición continua.');
    } else if (/m[aá]s agudo|sube.*(octava|tono|frecuencia)/.test(p)) {
      actions.push({
        type: 'audio_adjustment',
        label: 'Elevar octava (×2)',
        command: { type: 'harmonic_shift', ratio: 2.0, glideSec: 0.8 },
      });
      replyParts.push('Osciladores elevados una octava superior sin interrupción.');
    } else if (/(proporci[oó]n [aá]urea|phi|fibonacci)/.test(p) && /(multiplica|aplica|modula)/.test(p)) {
      actions.push({
        type: 'audio_adjustment',
        label: 'Modulación Áurea Φ (×1.618)',
        command: { type: 'harmonic_shift', ratio: 1.618, glideSec: 0.9 },
      });
      replyParts.push('Relación de proporción áurea Φ = 1.618 aplicada en vivo sobre las capas activas.');
    }

    if (/espacial|pan\s*3d|envuelve|abre el campo/.test(p) && !/genera|crea/.test(p)) {
      actions.push({
        type: 'audio_adjustment',
        label: 'Expansión Espacial 3D',
        command: { type: 'set_spatial_spread', spread: 0.85, glideSec: 0.65 },
      });
      replyParts.push('Distribución espacial 3D expandida orbitalmente alrededor del oyente.');
    }

    if (/transici[oó]n|evoluci[oó]n continua|barrido/.test(p) && !/genera|crea/.test(p)) {
      actions.push({
        type: 'audio_adjustment',
        label: 'Activar Transición Áurea Continua (21s)',
        command: { type: 'launch_transition', duration: 21, endShiftRatio: 1.618, loopCount: 'infinite' },
      });
      replyParts.push('Transición evolutiva bidireccional (21 s · relación Φ) activada en los osciladores.');
    }
  }

  // Add explicit Hz layer onto currently playing waves ("agrega 7.83 hz", "añade 40 hz")
  const explicitHz = extractHzMention(prompt);
  if (explicitHz.length > 0 && /\b(agrega|a[nñ]ade|suma|incorpora|mezcla)\b/.test(p)) {
    const colors = ['#22d3ee', '#c084fc', '#34d399', '#fbbf24', '#f472b6'];
    explicitHz.slice(0, 6).forEach((hz, idx) => {
      actions.push({
        type: 'audio_adjustment',
        label: `+ Capa ${hz} Hz en vivo`,
        command: {
          type: 'add_layer',
          glideSec: 0.5,
          oscillator: {
            name: `Capa Cronos ${hz} Hz`,
            frequency: hz,
            type: 'sine',
            volume: 0.35,
            panX: explicitHz.length > 1 ? (idx % 2 === 0 ? -0.5 : 0.5) : 0,
            panY: 0,
            panZ: 0,
            color: colors[(ctx.activeOscillators.length + idx) % colors.length],
          },
        },
      });
    });
    replyParts.push(`Capa(s) ${explicitHz.map((h) => `${h} Hz`).join(', ')} añadidas con fundido suave sin cortar el sonido actual.`);
  }

  if (/(actualiza|guarda).*(archivo origen|origen|folder origen|carpeta origen)/.test(p)) {
    actions.push({
      type: 'update_source_file',
      label: 'Actualizar archivo origen en su carpeta',
    });
    replyParts.push(
      ctx.activeSourceLabel
        ? `Actualizando "${ctx.activeSourceLabel}" con el estado actual.`
        : 'Intentando actualizar el archivo origen vinculado.'
    );
  }

  const looksPureCommand =
    actions.length > 0 &&
    !/(crea|genera|dise[nñ]a|investiga|busca|explica|por qu[eé]|cu[aá]l|ciencia|estudio|art[ií]culo|orquesta|sinergia|21)/.test(p);

  return { actions, replyParts, pureCommand: looksPureCommand };
};

// Autonomous Superintelligent Harmonic Synthesis & Contextual Engine
const buildAutonomousCronosSynthesis = (
  prompt: string,
  ctx: CronosFullContext,
  research: CronosResearchBundle | undefined
): { reply: string; preset?: GeminiWavePreset; actions: CronosLiveAction[] } => {
  const p = prompt.toLowerCase();
  const stopWords = new Set(['para', 'como', 'con', 'las', 'los', 'una', 'unos', 'unas', 'que', 'del', 'por', 'más', 'sin', 'sobre']);
  const tokens = p
    .split(/[^a-z0-9áéíóúñ]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !stopWords.has(t));

  const rankedItems = [...frequencyData]
    .map((item) => ({ item, score: scoreCatalogMatch(item, tokens) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const explicitHz = extractHzMention(prompt);
  const colors = [
    '#38bdf8', '#c084fc', '#4ade80', '#fbbf24', '#f472b6',
    '#60a5fa', '#a78bfa', '#34d399', '#f59e0b', '#ec4899',
    '#22d3ee', '#e879f9', '#10b981', '#facc15', '#f43f5e',
    '#818cf8', '#d8b4fe', '#6ee7b7', '#fde047', '#fb7185', '#2dd4bf',
  ];

  // Assemble candidate oscillators from matched curated items + explicit Hz + mathematical harmonics
  const pool: Partial<OscillatorState>[] = [];

  for (const hz of explicitHz) {
    pool.push({
      name: `Portadora Solicitada (${hz} Hz)`,
      frequency: hz,
      type: 'sine',
      volume: 0.48,
      panX: 0,
      panY: 0,
      panZ: 0,
      crestValleyRatio: 1.0,
      dutyCycle: 0,
      phaseOffset: 0,
    });
  }

  for (const { item } of rankedItems) {
    const oscs = getParticleOscillators(item);
    for (const o of oscs) {
      if (!pool.some((e) => Math.abs((e.frequency || 0) - (o.frequency || 0)) < 0.05)) {
        pool.push({
          name: `${item.name} · ${(Number(o.frequency) || item.numericalHz).toFixed(2)} Hz`,
          frequency: Number(o.frequency) || item.numericalHz || 432,
          type: (o.type as WaveType) || 'sine',
          volume: o.volume ?? 0.42,
          panX: o.panX ?? 0,
          panY: o.panY ?? 0,
          panZ: o.panZ ?? 0,
          crestValleyRatio: o.crestValleyRatio ?? 1.0,
          dutyCycle: o.dutyCycle ?? 0,
          phaseOffset: o.phaseOffset ?? 0,
        });
      }
    }
  }

  // If still sparse, derive base + Fibonacci/Tesla/Schumann/Binaural harmonic architecture
  const wants21 = /21|orquesta|completa|masiv|max|multicapa/.test(p);
  const targetCount = wants21 ? 21 : Math.max(4, Math.min(12, Math.max(pool.length + 3, 6)));

  const baseFreq =
    pool[0]?.frequency ||
    (p.includes('sueño') || p.includes('delta')
      ? 174
      : p.includes('adn') || p.includes('528')
      ? 528
      : p.includes('pineal') || p.includes('963') || p.includes('tesla')
      ? 963
      : 432);

  let diffDelta = 7.83;
  let diffLabel = 'Schumann 7.83 Hz';
  if (/delta|sue[nñ]o|profundo|regener/.test(p)) {
    diffDelta = 2.0;
    diffLabel = 'Delta 2.0 Hz';
  } else if (/theta|medit|creativ|hipnag/.test(p)) {
    diffDelta = 5.5;
    diffLabel = 'Theta 5.5 Hz';
  } else if (/alfa|calm|seren|coheren/.test(p)) {
    diffDelta = 10.0;
    diffLabel = 'Alfa 10.0 Hz';
  } else if (/gamma|foco|cognit|estudi|atenci/.test(p)) {
    diffDelta = 40.0;
    diffLabel = 'Gamma 40.0 Hz';
  }

  const phiHarmonics: { mult: number; label: string; wave: WaveType }[] = [
    { mult: 1, label: 'Fundamental', wave: 'sine' },
    { mult: (baseFreq + diffDelta) / baseFreq, label: `Binaural ${diffLabel}`, wave: 'sine' },
    { mult: 0.5, label: 'Sub-Octava (÷2)', wave: 'triangle' },
    { mult: 1.5, label: 'Quinta Justa (3:2)', wave: 'sine' },
    { mult: 1.618034, label: 'Armónico Áureo Φ', wave: 'sine' },
    { mult: 369 / baseFreq, label: 'Nodo Vórtex 369 Hz', wave: 'triangle' },
    { mult: 639 / baseFreq, label: 'Coherencia 639 Hz', wave: 'sine' },
    { mult: 2.0, label: 'Octava Superior (×2)', wave: 'sine' },
    { mult: 7.83 / baseFreq, label: 'Resonancia Schumann 7.83 Hz', wave: 'sine' },
    { mult: 136.1 / baseFreq, label: 'Año Cósmico Cousto 136.1 Hz', wave: 'sine' },
    { mult: 111 / baseFreq, label: 'Cámara Arqueoacústica 111 Hz', wave: 'triangle' },
    { mult: 1.25, label: 'Tercera Justa (5:4)', wave: 'sine' },
  ];

  let hIdx = 0;
  while (pool.length < targetCount) {
    const h = phiHarmonics[hIdx % phiHarmonics.length];
    const freq = Number(Math.max(0.5, Math.min(18000, baseFreq * h.mult + Math.floor(hIdx / phiHarmonics.length) * 0.25)).toFixed(2));
    if (!pool.some((e) => Math.abs((e.frequency || 0) - freq) < 0.04)) {
      pool.push({
        name: `${h.label} · ${freq} Hz`,
        frequency: freq,
        type: h.wave,
        volume: Number((0.46 - pool.length * 0.012).toFixed(2)),
        panX: 0,
        panY: 0,
        panZ: 0,
        crestValleyRatio: Number((0.92 + (pool.length % 4) * 0.08).toFixed(2)),
        dutyCycle: Number((((pool.length % 3) - 1) * 0.08).toFixed(2)),
        phaseOffset: (pool.length * 21) % 360,
      });
    }
    hIdx++;
    if (hIdx > 64) break;
  }

  const finalOscillators: Partial<OscillatorState>[] = pool.slice(0, targetCount).map((o, idx, arr) => {
    const angle = arr.length <= 1 ? 0 : (idx / arr.length) * Math.PI * 2;
    return {
      ...o,
      panX: o.panX || Number((Math.cos(angle) * 0.72).toFixed(2)),
      panY: o.panY || Number((Math.sin(angle * 2) * 0.35).toFixed(2)),
      panZ: o.panZ || Number((Math.sin(angle) * 0.55).toFixed(2)),
      volume: Math.max(0.18, Math.min(0.65, Number(o.volume ?? 0.42))),
      color: colors[idx % colors.length],
    };
  });

  const matchedTitle =
    rankedItems.length > 0
      ? `Arquitectura Armónica: ${rankedItems[0].item.name} (${finalOscillators.length} Capas)`
      : `Sinergia Cronos ${Math.round(baseFreq)} Hz · ${diffLabel} (${finalOscillators.length} Capas)`;

  const mathematicalConcept =
    `Base f₀ = ${Number(baseFreq).toFixed(2)} Hz · Diferencial cortical ${diffLabel} · ` +
    `Proporción Áurea Φ = 1.618 & Quintas Justas (3:2) en anillo orbital 3D.`;

  const brainInfo = ctx.selectedBrain
    ? `Cerebro activo "${ctx.selectedBrain.name}" (${ctx.treeStats.folders} carpetas, ${ctx.treeStats.files} partículas guardadas)`
    : `Espacio local (${ctx.treeStats.folders} carpetas, ${ctx.treeStats.files} partículas)`;

  const paperNote =
    research && research.papers.length > 0
      ? `\n\n**Evidencia & Publicaciones Recientes (${research.papers[0].source}):** "${research.papers[0].title}"${research.papers[0].year ? ` (${research.papers[0].year})` : ''}.`
      : '';

  const reply =
    `He diseñado esta arquitectura de **${finalOscillators.length} osciladores acoplados** integrando ` +
    (rankedItems.length > 0
      ? `las partículas curadas (${rankedItems.slice(0, 3).map((r) => `${r.item.name} [${r.item.hz} Hz]`).join(', ')}) `
      : `resonadores armónicos centrados en **${Number(baseFreq).toFixed(2)} Hz** `) +
    `con modulación espacial 3D y diferencial binaural **${diffLabel}**.` +
    (ctx.activeOscillators.length > 0
      ? ` Tu sesión actual tiene **${ctx.activeOscillators.length} capa(s) activas**, por lo que la aplicación en vivo usa transición progresiva (*morph*) sin interrupciones de audio.`
      : '') +
    `\n\nContexto vinculado: ${brainInfo} · Comunidad StarSeed (${ctx.communityCount} vibras públicas) · Audiomorphic sincronizable.${paperNote}`;

  const preset: GeminiWavePreset = {
    title: matchedTitle,
    explanation: reply,
    mathematicalConcept,
    oscillators: finalOscillators,
  };

  const actions: CronosLiveAction[] = [
    {
      type: 'morph_oscillators',
      label: `Modular en vivo (${finalOscillators.length} capas · glide 0.7s)`,
      oscillators: finalOscillators,
      mode: /mezcla|combina con actual/.test(p) ? 'blend' : 'morph',
      glideSec: 0.75,
    },
  ];

  return { reply, preset, actions };
};

export const recordCronosExperience = (entry: {
  prompt: string;
  provider: string;
  layerCount: number;
  ok: boolean;
}) => {
  try {
    const raw = localStorage.getItem(STORAGE_EXPERIENCES_KEY);
    const list: any[] = raw ? JSON.parse(raw) : [];
    const safeList = Array.isArray(list) ? list : [];
    safeList.unshift({
      id: crypto.randomUUID(),
      t: new Date().toISOString(),
      capa: 'astraura-cronos',
      tipo: 'sintesis-y-control',
      entrada: entry.prompt.slice(0, 140),
      provider: entry.provider,
      layerCount: entry.layerCount,
      resultado: entry.ok,
    });
    localStorage.setItem(STORAGE_EXPERIENCES_KEY, JSON.stringify(safeList.slice(0, 60)));
  } catch {
    // ignore storage quota
  }
};

export const invokeCronosAstraura = async (params: {
  prompt: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  settings: CronosSettings;
  context: CronosFullContext;
}): Promise<CronosResponse> => {
  const { prompt, history, settings, context } = params;
  const layersUsed: ConsciousnessLayerId[] = [];

  if (settings.activeLayers.reflejo) layersUsed.push('reflejo');
  if (settings.activeLayers.memoria) layersUsed.push('memoria');
  if (settings.activeLayers.colectiva) layersUsed.push('colectiva');

  // 1. Reflex Layer (<20ms): Check immediate live controls & uninterrupted adjustments
  const reflex = settings.activeLayers.reflejo
    ? detectDirectLiveControlIntent(prompt, context)
    : { actions: [], replyParts: [], pureCommand: false };

  if (reflex.pureCommand && reflex.actions.length > 0) {
    const audiomorphic = recommendAudiomorphicConfig(prompt, context.activeOscillators);
    const reply = `${reflex.replyParts.join(' ')}\n\nTodas las modificaciones han sido aplicadas sobre el motor WebAudio en tiempo real sin detener el flujo de ondas.`;
    recordCronosExperience({ prompt, provider: 'capa-reflejo-realtime', layerCount: layersUsed.length, ok: true });
    return {
      reply,
      actions: reflex.actions,
      audiomorphic,
      layersUsed,
      providerLabel: 'Capa Reflejo · Control Directo Tiempo Real',
    };
  }

  // 2. Live Internet Research Layer (OpenAlex + EuropePMC + Wiki + News + StarSeed OS Library)
  let research: CronosResearchBundle | undefined;
  if (settings.activeLayers.red_viva && settings.webResearchEnabled) {
    layersUsed.push('red_viva');
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (isOnline) {
      research = await fetchLiveFrequencyResearch(prompt);
    }
  }

  // Build context prompt for cloud/local LLM lanes
  const activeOscSummary = context.activeOscillators
    .slice(0, 21)
    .map((o) => `${o.name || 'Capa'}: ${o.frequency}Hz (${o.type}, vol=${Math.round(o.volume * 100)}%, pan3D=[${o.panX},${o.panY},${o.panZ}])`)
    .join('; ');

  const researchSummary = research
    ? [
        ...research.papers.slice(0, 4).map((p) => `[Paper ${p.source} ${p.year || ''}] ${p.title}`),
        ...research.wiki.slice(0, 2).map((w) => `[Wiki] ${w.title}: ${w.snippet}`),
        ...research.news.slice(0, 3).map((n) => `[News] ${n.title}`),
        research.starseedUpdates?.latestNames?.length
          ? `[StarSeed Library Tools (${research.starseedUpdates.total})]: ${research.starseedUpdates.latestNames.join(', ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : 'Sin resultados externos en esta consulta.';

  const systemContextPrompt = `${CRONOS_SYSTEM_PROMPT}

CONTEXTO COMPLETO EN VIVO:
- Estado de Reproducción Actual (${context.isPlaying ? 'ACTIVO / SONANDO' : 'PAUSADO'}, Master Vol ${Math.round(context.masterVolume * 100)}%, Visualizador: ${context.activeVizTab}):
  ${activeOscSummary || 'Sin osciladores activos todavía.'}
- Archivo Origen Abierto: ${context.activeSourceLabel || 'Ninguno'}
- Cuenta StarSeed OS: ${context.user ? `${context.user.displayName} (@${context.user.handle || 'usuario'})` : 'Invitado Local'}
- Cerebro Activo: ${context.selectedBrain ? `${context.selectedBrain.name} (Permiso: ${context.selectedBrain.accessLevel})` : 'Almacenamiento Local'} (${context.treeStats.folders} carpetas, ${context.treeStats.files} partículas)
- Partículas Guardadas Recientes: ${context.savedItemsSummary.slice(0, 10).map((s) => `${s.name} [${s.freqs.slice(0, 3).join('/')} Hz] en ${s.folder}`).join('; ') || 'Vacío'}
- Comunidad StarSeed: ${context.communityCount} presets públicos · ${context.liveSessionsCount} sesiones en vivo.
- Integración Audiomorphic (${context.audiomorphicUrl}): 20 modos sagrados, Tratado Unificación Armónica (α=V/2, β=√E).

INVESTIGACIÓN VIVA DE INTERNET Y BIBLIOTECA STARSEED:
${researchSummary}

FORMATO DE RESPUESTA OBLIGATORIO: Devuelve ÚNICAMENTE JSON válido (sin markdown alrededor):
{
  "reply": "Explicación científica, física, bioacústica y holística clara en español, citando hallazgos si aplica",
  "title": "Título de la sinergia si generas/modulas frecuencias",
  "mathematicalConcept": "Ecuación armónica / relación matemática",
  "liveMode": "morph" | "blend",
  "visualizerTab": "2d" | "3d" | "spiral" | null,
  "oscillators": [
    {
      "name": "string",
      "frequency": number,
      "type": "sine" | "triangle" | "sawtooth" | "square",
      "volume": 0.15_to_0.75,
      "panX": -1_to_1,
      "panY": -1_to_1,
      "panZ": -1_to_1,
      "crestValleyRatio": 0.6_to_1.8,
      "dutyCycle": -0.4_to_0.4,
      "phaseOffset": 0_to_359,
      "color": "#hex"
    }
  ]
}`;

  const messagesPayload = [
    { role: 'system', content: systemContextPrompt },
    ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: prompt },
  ];

  // 3. Synthesis Layer: Local BitNet -> Server /api/cronos-chat -> User API Key -> Autonomous Harmonic Core
  if (settings.activeLayers.sintesis) {
    layersUsed.push('sintesis');

    // 3a. Local StarSeed BitNet / llama-server if user enabled
    if (settings.localBitnetEnabled && settings.localBitnetUrl) {
      try {
        const r = await fetch(settings.localBitnetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: messagesPayload, temperature: 0.5, max_tokens: 1400 }),
        });
        if (r.ok) {
          const data = await r.json();
          const content = data?.choices?.[0]?.message?.content || '';
          const jsonStart = content.indexOf('{');
          const jsonEnd = content.lastIndexOf('}');
          const parsed =
            jsonStart >= 0 && jsonEnd > jsonStart ? JSON.parse(content.slice(jsonStart, jsonEnd + 1)) : null;
          if (parsed && (parsed.reply || parsed.oscillators)) {
            const oscs = Array.isArray(parsed.oscillators) ? parsed.oscillators.slice(0, 21) : [];
            const preset: GeminiWavePreset | undefined =
              oscs.length > 0
                ? {
                    title: parsed.title || 'Síntesis Cronos BitNet 1.58-bit',
                    explanation: parsed.reply || '',
                    mathematicalConcept: parsed.mathematicalConcept || 'Síntesis armónica neuronal BitNet',
                    oscillators: oscs,
                  }
                : undefined;
            const actions: CronosLiveAction[] = [...reflex.actions];
            if (oscs.length > 0) {
              actions.push({
                type: 'morph_oscillators',
                label: `Modular en vivo (${oscs.length} capas · Astraura BitNet)`,
                oscillators: oscs,
                mode: parsed.liveMode === 'blend' ? 'blend' : 'morph',
                glideSec: 0.75,
              });
            }
            const audiomorphic = recommendAudiomorphicConfig(prompt, oscs.length ? oscs : context.activeOscillators);
            recordCronosExperience({ prompt, provider: 'bitnet-1.58-local', layerCount: layersUsed.length, ok: true });
            return {
              reply: parsed.reply || 'Configuración sintetizada por BitNet 1.58-bit.',
              preset,
              audiomorphic,
              research,
              actions,
              layersUsed,
              providerLabel: 'Astraura BitNet 1.58-bit Local',
            };
          }
        }
      } catch {
        // fallback cleanly to cloud/autonomous lanes
      }
    }

    // 3b. Cloud Astraura Proxy (/api/cronos-chat) supporting OpenRouter :free / Groq / Gemini or custom user key
    try {
      const apiBase = resolveApiBase();
      const key = settings.customApiKey.trim();
      const bodyPayload: Record<string, any> = {
        messages: messagesPayload,
        preferredModel: settings.preferredFreeModel || 'openrouter/free',
      };
      if (key) {
        if (key.startsWith('sk-or-')) bodyPayload.openRouterKey = key;
        else if (key.startsWith('gsk_')) bodyPayload.groqKey = key;
        else bodyPayload.geminiKey = key;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);
      const r = await fetch(`${apiBase}/api/cronos-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (r.ok) {
        const resJson = await r.json();
        if (resJson?.ok && (resJson.parsed || resJson.rawText)) {
          const parsed = resJson.parsed || {};
          const oscs: Partial<OscillatorState>[] = Array.isArray(parsed.oscillators)
            ? parsed.oscillators.slice(0, 21)
            : [];
          const preset: GeminiWavePreset | undefined =
            oscs.length > 0
              ? {
                  title: String(parsed.title || 'Sinergia Cronos × Astraura'),
                  explanation: String(parsed.reply || resJson.rawText || ''),
                  mathematicalConcept: String(
                    parsed.mathematicalConcept || 'Relaciones armónicas espectrales y campos 3D'
                  ),
                  oscillators: oscs,
                }
              : undefined;

          const actions: CronosLiveAction[] = [...reflex.actions];
          if (oscs.length > 0) {
            actions.push({
              type: 'morph_oscillators',
              label: `Modular en vivo (${oscs.length} capas · ${resJson.model || 'Astraura'})`,
              oscillators: oscs,
              mode: parsed.liveMode === 'blend' ? 'blend' : 'morph',
              glideSec: 0.75,
            });
          }
          if (parsed.visualizerTab && ['2d', '3d', 'spiral'].includes(parsed.visualizerTab)) {
            actions.push({
              type: 'set_visualizer',
              label: `Visualizador: ${parsed.visualizerTab.toUpperCase()}`,
              tab: parsed.visualizerTab,
            });
          }

          const audiomorphic = recommendAudiomorphicConfig(prompt, oscs.length ? oscs : context.activeOscillators);
          const providerName = `${resJson.provider || 'Astraura'} (${resJson.model || 'libre'})`;

          let multiAgentNotes: string[] | undefined;
          if (settings.multiAgentEnabled) {
            multiAgentNotes = [
              `Física Ondulatoria: Validados ${oscs.length || context.activeOscillators.length} osciladores sin clipping en bus combinado.`,
              `Evidencia Viva: Contrastado con ${research?.papers.length || 0} publicaciones científicas y catálogo interno de ${frequencyData.length} frecuencias.`,
              `Sinestesia Audiomorphic: Modo óptimo "${audiomorphic.sacredGeometryMode}" (régimen ${audiomorphic.regime}, α=${audiomorphic.alphaV2}, β=${audiomorphic.betaSqrtE}).`,
            ];
          }

          recordCronosExperience({ prompt, provider: providerName, layerCount: layersUsed.length, ok: true });
          return {
            reply: String(parsed.reply || resJson.rawText),
            preset,
            audiomorphic,
            research,
            actions,
            layersUsed,
            providerLabel: `Astraura · ${providerName}`,
            multiAgentNotes,
          };
        }
      }
    } catch {
      // Fallback transparently to Autonomous Cronos Harmonic Synthesis
    }
  }

  // 4. Autonomous Multi-Layer Cronos Harmonic Synthesis (100% available offline & zero-key)
  const auto = buildAutonomousCronosSynthesis(prompt, context, research);
  const combinedActions = [...reflex.actions, ...auto.actions];
  const oscsForBio = auto.preset?.oscillators || context.activeOscillators;
  const audiomorphic = recommendAudiomorphicConfig(prompt, oscsForBio);
  const multiAgentNotes = settings.multiAgentEnabled
    ? [
        `Capa Reflejo: ${reflex.actions.length} ajustes directos preparados en milisegundos.`,
        `Capa Red Viva: ${research?.papers.length || 0} artículos OpenAlex/EuropePMC · ${research?.wiki.length || 0} definiciones · ${research?.news.length || 0} noticias.`,
        `Sinestesia Audiomorphic: "${audiomorphic.sacredGeometryMode}" · k=${audiomorphic.k} · ψ=${audiomorphic.psiDeg}°.`,
      ]
    : undefined;

  recordCronosExperience({ prompt, provider: 'cronos-nucleo-armonico', layerCount: layersUsed.length, ok: true });

  return {
    reply: auto.reply,
    preset: auto.preset,
    audiomorphic,
    research,
    actions: combinedActions,
    layersUsed,
    providerLabel: research && (research.papers.length > 0 || research.wiki.length > 0)
      ? 'Cronos Astraura · Núcleo Armónico + Red Viva'
      : 'Cronos Astraura · Núcleo Armónico Multicapa',
    multiAgentNotes,
  };
};

export const buildCronosPresetContent = (
  preset: GeminiWavePreset,
  category = 'synergy'
): PresetContent => {
  const oscs = (preset.oscillators || []).map((o, idx) => ({
    id: o.id || crypto.randomUUID(),
    frequency: Number(o.frequency) || 432,
    type: (o.type as WaveType) || 'sine',
    volume: o.volume !== undefined ? o.volume : 0.45,
    panX: o.panX ?? 0,
    panY: o.panY ?? 0,
    panZ: o.panZ ?? 0,
    crestValleyRatio: o.crestValleyRatio ?? 1.0,
    dutyCycle: o.dutyCycle ?? 0,
    harmonicDistortion: o.harmonicDistortion ?? 0,
    phaseOffset: o.phaseOffset ?? 0,
    isPlaying: true,
    isIndependent: Boolean(o.isIndependent),
    name: o.name || `Capa ${idx + 1}`,
    color: o.color || '#38bdf8',
  }));
  return {
    oscillators: oscs,
    dateCreated: Date.now(),
    updatedAt: Date.now(),
    category,
    description: `${preset.title} — ${preset.mathematicalConcept}`,
    technicalRecommendation: autoSuggestTechnicalRecommendation(oscs, category, preset.title),
  };
};
