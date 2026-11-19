import { createClient } from '@supabase/supabase-js';
import { PresetContent, FileSystemNode, LiveSession, OscillatorState, WaveType } from '../types';

// ── Cuenta StarSeed OS: a qué base de datos se conecta (2026-10-10) ─────────────────────────────
// El login fallaba con «exceed_egress_quota»: la app seguía apuntando a pqzdpmedcsgcedkvndzl, el
// proyecto viejo del OS que Supabase restringió por tráfico. El OS vive ahora en jhgvhkypqadfdkkqoxta.
// Regla de vinculación de apps (StarSeed Link): la app NO fija el proyecto para siempre. Usa, por
// orden: lo que diga el propio OS en /api/vinculo/config (guardado de la última vez), el proyecto
// del entorno si no está retirado, y por último el activo conocido. Las claves anon son públicas
// por diseño (van en el navegador); nunca se pone aquí una clave de servicio.
const PROYECTO_ACTIVO = { url: 'https://jhgvhkypqadfdkkqoxta.supabase.co', anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpoZ3Zoa3lwcWFkZmRra3FveHRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NDUzNTcsImV4cCI6MjEwNjIyMTM1N30.egttZeqJm7quC962Hk5Lq_nInGmsCml6n0G37N6y4V0' };
const PROYECTOS_RETIRADOS = ['pqzdpmedcsgcedkvndzl', 'nxstilnyidvkqeosofuh'];
export const STARSEED_VINCULO_URL = 'https://starseed-os.vercel.app/api/vinculo/config';
const CLAVE_VINCULO = 'starseed.vinculo.config.v1';

function configGuardada(): { url: string; anonKey: string } | null {
  try {
    if (typeof window === 'undefined') return null;
    const j = JSON.parse(window.localStorage.getItem(CLAVE_VINCULO) || 'null');
    if (j && typeof j.url === 'string' && /^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(j.url) && typeof j.anonKey === 'string' && j.anonKey.startsWith('eyJ')) return j;
  } catch { /* sin almacenamiento */ }
  return null;
}

function configInicial(): { url: string; anonKey: string } {
  const guardada = configGuardada();
  if (guardada && !PROYECTOS_RETIRADOS.some((r) => guardada.url.includes(r))) return guardada;
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '';
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '';
  if (envUrl && envKey && !PROYECTOS_RETIRADOS.some((r) => envUrl.includes(r))) return { url: envUrl, anonKey: envKey };
  return PROYECTO_ACTIVO;
}

const CONFIG = configInicial();
const supabaseUrl = CONFIG.url;
const supabaseAnonKey = CONFIG.anonKey;

// Pregunta al OS si su base de datos cambió; si cambió, se usa en el próximo arranque.
if (typeof window !== 'undefined' && typeof fetch === 'function') {
  fetch(STARSEED_VINCULO_URL, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      const sb = j && j.supabase;
      if (sb && typeof sb.url === 'string' && typeof sb.anonKey === 'string' && sb.url !== supabaseUrl) {
        window.localStorage.setItem(CLAVE_VINCULO, JSON.stringify({ url: sb.url, anonKey: sb.anonKey }));
      }
    })
    .catch(() => { /* sin red o el OS aún no tiene la ruta: se sigue con la config actual */ });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }
});

export const STARSEED_OS_OFFICIAL_URL = 'https://starseed-os.vercel.app/login';

export const openStarseedRegister = () => {
  if (typeof window !== 'undefined') {
    window.open(STARSEED_OS_OFFICIAL_URL, '_blank', 'noopener,noreferrer');
  }
};

export interface StarseedUser {
  id: string;
  email: string;
  displayName: string;
  avatar_url?: string;
  cover_url?: string;
  handle?: string;
}

export const loginWithStarseed = async (identifier: string, password: string): Promise<StarseedUser | null> => {
  const trimmed = identifier.trim();
  if (!trimmed) {
    throw new Error("Por favor, ingresa tu correo o usuario de StarSeed OS.");
  }
  if (!password) {
    throw new Error("Por favor, ingresa tu contraseña.");
  }

  let email = trimmed;

  // Si el usuario introdujo solo su nombre/handle (sin '@'), buscar o autocompletar con @star.seed
  if (!email.includes('@')) {
    try {
      const { data: handleProfile } = await supabase
        .from('os_profiles')
        .select('user_id, handle')
        .eq('handle', trimmed.toLowerCase())
        .maybeSingle();

      if (handleProfile && handleProfile.handle) {
        email = `${handleProfile.handle}@star.seed`;
      } else {
        email = `${trimmed.toLowerCase()}@star.seed`;
      }
    } catch {
      email = `${trimmed.toLowerCase()}@star.seed`;
    }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("StarSeed OS Login Error:", error);
    const msg = error.message.toLowerCase();
    if (msg.includes('invalid login credentials') || msg.includes('invalid_grant')) {
      throw new Error("Credenciales inválidas. Comprueba tu usuario/correo y contraseña registrados en StarSeed OS.");
    } else if (msg.includes('email not confirmed')) {
      throw new Error("Este correo no ha sido confirmado aún en StarSeed OS.");
    } else if (msg.includes('rate limit')) {
      throw new Error("Demasiados intentos. Espera unos minutos e inténtalo de nuevo.");
    } else if (msg.includes('failed to fetch') || msg.includes('network')) {
      throw new Error("Error de conexión con el servidor de StarSeed OS. Comprueba tu conexión a internet.");
    }
    throw new Error(error.message || "Error al conectar con StarSeed OS.");
  }

  if (!data.user) {
    throw new Error("No se pudo obtener la sesión desde StarSeed OS.");
  }

  // Cargar perfil soberano desde os_profiles
  let profile = null;
  try {
    const { data: p } = await supabase
      .from('os_profiles')
      .select('avatar_url, cover_url, display_name, handle')
      .eq('user_id', data.user.id)
      .maybeSingle();
    profile = p;
  } catch (e) {
    console.warn("No se pudo cargar os_profiles:", e);
  }

  return {
    id: data.user.id,
    email: data.user.email || '',
    displayName: profile?.display_name || profile?.handle || data.user.user_metadata?.full_name || email.split('@')[0] || 'Starseed Explorer',
    avatar_url: profile?.avatar_url,
    cover_url: profile?.cover_url,
    handle: profile?.handle,
  };
};

export const signUpWithStarseed = async (email: string, password: string, displayName: string = 'Starseed Explorer'): Promise<StarseedUser | null> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: displayName
      }
    }
  });

  if (error || !data.user) {
    console.error("Starseed OS SignUp Error:", error?.message);
    throw new Error(error?.message || "Registro fallido en StarSeed OS");
  }

  // Ensure os_profile exists
  const { error: profileError } = await supabase
    .from('os_profiles')
    .insert({
      user_id: data.user.id,
      display_name: displayName
    });
    
  if (profileError) {
    console.error("Error creating profile:", profileError);
  }

  return {
    id: data.user.id,
    email: data.user.email || '',
    displayName: displayName,
  };
};

export const logoutStarseed = async () => {
  await supabase.auth.signOut();
};

export const subscribeToStarseedAuth = (callback: (user: StarseedUser | null) => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    // Defer DB reads out of the Supabase auth lock callback to prevent navigator.locks deadlock
    setTimeout(async () => {
      try {
        if (session?.user) {
          const user = await getCurrentStarseedUser();
          callback(user);
        } else {
          callback(null);
        }
      } catch {
        callback(null);
      }
    }, 0);
  });

  return () => {
    subscription.unsubscribe();
  };
};

export const getCurrentStarseedUser = async (): Promise<StarseedUser | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    let profile = null;
    try {
      const { data: p } = await supabase
        .from('os_profiles')
        .select('avatar_url, cover_url, display_name, handle')
        .eq('user_id', session.user.id)
        .maybeSingle();
      profile = p;
    } catch (e) {
      console.warn("Error leyendo perfil de sesión:", e);
    }

    return {
      id: session.user.id,
      email: session.user.email || '',
      displayName: profile?.display_name || profile?.handle || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Starseed Explorer',
      avatar_url: profile?.avatar_url,
      cover_url: profile?.cover_url,
      handle: profile?.handle,
    };
  }
  return null;
};

// --- Normalization & Local Sessions Helpers ---

const LOCAL_SESSIONS_KEY = 'omni_local_sessions_v1';
const VALID_WAVE_TYPES: WaveType[] = ['sine', 'square', 'sawtooth', 'triangle'];

export const normalizeOscillators = (raw: any[]): OscillatorState[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, idx) => {
    if (typeof item === 'number') {
      return {
        id: crypto.randomUUID(),
        frequency: Number.isFinite(item) && item > 0 ? item : 432,
        type: 'sine',
        volume: 0.5,
        panX: 0,
        panY: 0,
        panZ: 0,
        crestValleyRatio: 1.0,
        dutyCycle: 0,
        harmonicDistortion: 0,
        phaseOffset: 0,
        isPlaying: true,
        name: `Frecuencia ${idx + 1}`,
        isIndependent: false,
        color: '#38bdf8',
      };
    }

    const rawFreq = Number(item?.frequency ?? item?.freq ?? item?.hz ?? 432);
    const rawType = item?.type ?? item?.waveform ?? 'sine';
    const type: WaveType = VALID_WAVE_TYPES.includes(rawType) ? rawType : 'sine';

    return {
      id: item?.id || crypto.randomUUID(),
      frequency: Number.isFinite(rawFreq) && rawFreq > 0 ? rawFreq : 432,
      type,
      volume: typeof item?.volume === 'number' ? item.volume : (typeof item?.gain === 'number' ? item.gain : 0.5),
      panX: typeof item?.panX === 'number' ? item.panX : (typeof item?.pan === 'number' ? item.pan : 0),
      panY: typeof item?.panY === 'number' ? item.panY : 0,
      panZ: typeof item?.panZ === 'number' ? item.panZ : 0,
      crestValleyRatio: typeof item?.crestValleyRatio === 'number' ? item.crestValleyRatio : 1.0,
      dutyCycle: typeof item?.dutyCycle === 'number' ? item.dutyCycle : 0,
      harmonicDistortion: typeof item?.harmonicDistortion === 'number' ? item.harmonicDistortion : 0,
      phaseOffset: typeof item?.phaseOffset === 'number' ? item.phaseOffset : 0,
      isPlaying: item?.isPlaying !== undefined ? Boolean(item.isPlaying) : true,
      name: item?.name || `Oscilador ${idx + 1}`,
      isIndependent: Boolean(item?.isIndependent),
      color: item?.color || '#38bdf8',
      ...(item?.type2 && VALID_WAVE_TYPES.includes(item.type2) ? { type2: item.type2 as WaveType } : {}),
      ...(typeof item?.typeMix === 'number' ? { typeMix: item.typeMix } : {}),
      ...(item?.transition ? { transition: item.transition } : {}),
    };
  });
};

const normalizePresetContent = (rawContent: any): PresetContent => {
  const safe = rawContent && typeof rawContent === 'object' ? rawContent : {};
  const rawList = Array.isArray(safe.oscillators)
    ? safe.oscillators
    : Array.isArray(safe.frequencies)
    ? safe.frequencies
    : [];

  return {
    ...safe,
    oscillators: normalizeOscillators(rawList),
    dateCreated: typeof safe.dateCreated === 'number' ? safe.dateCreated : Date.now(),
  };
};

export const getLocalLiveSessions = (): LiveSession[] => {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(LOCAL_SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persistLocalLiveSessions = (sessions: LiveSession[]) => {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.warn('No se pudo persistir sesiones locales:', e);
  }
};

export const saveLocalLiveSession = (session: LiveSession): LiveSession => {
  const existing = getLocalLiveSessions();
  const next = [session, ...existing.filter((s) => s.id !== session.id)];
  persistLocalLiveSessions(next);
  return session;
};

const mapSessionRow = (row: any): LiveSession => {
  const parsedContent = normalizePresetContent(row.preset_content);
  const meta = (row.preset_content && row.preset_content.sessionMetadata) || {};

  return {
    id: row.id,
    hostId: row.host_id,
    hostName: row.host_name,
    presetName: row.preset_name,
    presetContent: parsedContent,
    isPublic: row.is_public,
    allowOpenModifications: row.allow_open_modifications,
    createdAt: new Date(row.created_at).getTime(),
    description: meta.description ?? parsedContent.description,
    cover_url: meta.cover_url,
    avatar_url: meta.avatar_url,
    category: meta.category ?? parsedContent.category,
    fixedPermissions: meta.fixedPermissions,
    useGlobalWebRTC: meta.useGlobalWebRTC,
    useLocalMesh: meta.useLocalMesh,
  };
};

// --- Cloud Presets ---

export const publishPresetToCloud = async (node: FileSystemNode, userId: string, isPublic: boolean = false) => {
  if (!node.content) throw new Error("Solo se pueden subir presets (no carpetas puras)");
  
  const presetContent: PresetContent = {
    ...node.content,
    authorId: userId,
    isPublic: isPublic,
    updatedAt: Date.now(),
  };

  const resolvedCategory = presetContent.category || node.content.oscillators[0]?.type || 'synergy';

  const { data, error } = await supabase
    .from('omni_presets')
    .upsert({ 
      id: node.id, 
      name: node.name,
      content: presetContent,
      author_id: userId,
      is_public: isPublic,
      category: resolvedCategory
    })
    .select();

  if (error) {
    console.error("Error publishing preset:", error);
    throw error;
  }
  return data;
};

export const updateCommunityPreset = async (
  presetId: string,
  userId: string,
  updates: { name?: string; category?: string; content?: PresetContent }
): Promise<FileSystemNode> => {
  const { data: existing, error: fetchError } = await supabase
    .from('omni_presets')
    .select('*')
    .eq('id', presetId)
    .eq('author_id', userId)
    .maybeSingle();

  if (fetchError) {
    console.error("Error leyendo partícula comunitaria para actualizar:", fetchError);
    throw fetchError;
  }

  const baseContent = normalizePresetContent(existing?.content || {});
  const nextCategory = updates.category ?? updates.content?.category ?? existing?.category ?? baseContent.category ?? 'synergy';

  const mergedContent: PresetContent = {
    ...baseContent,
    ...(updates.content || {}),
    authorId: userId,
    isPublic: true,
    category: nextCategory,
    updatedAt: Date.now(),
  };

  const payload: Record<string, any> = {
    content: mergedContent,
    category: nextCategory,
  };
  if (updates.name !== undefined && updates.name.trim()) {
    payload.name = updates.name.trim();
  }

  const { data, error } = await supabase
    .from('omni_presets')
    .update(payload)
    .eq('id', presetId)
    .eq('author_id', userId)
    .select()
    .single();

  if (error) {
    console.error("Error actualizando partícula comunitaria:", error);
    throw error;
  }

  return {
    id: data.id,
    parentId: 'cloud_community',
    name: data.name,
    type: 'file',
    content: normalizePresetContent(data.content),
    createdAt: new Date(data.created_at).getTime(),
  };
};

export const deleteCommunityPreset = async (presetId: string, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('omni_presets')
    .delete()
    .eq('id', presetId)
    .eq('author_id', userId);

  if (error) {
    console.error("Error eliminando partícula comunitaria:", error);
    throw error;
  }
};

export const fetchCommunityPresets = async (): Promise<FileSystemNode[]> => {
  const { data, error } = await supabase
    .from('omni_presets')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching community presets:", error);
    return [];
  }

  return data.map(item => ({
    id: item.id,
    parentId: 'cloud_community',
    name: item.name,
    type: 'file',
    content: {
      ...normalizePresetContent(item.content),
      authorId: item.content?.authorId || item.author_id,
      category: item.content?.category || item.category,
    },
    createdAt: new Date(item.created_at).getTime()
  }));
};

// --- Live Sessions (Entonación) ---

export const createLiveSession = async (
  presetContent: PresetContent, 
  hostId: string, 
  hostName: string, 
  presetName: string, 
  isPublic: boolean, 
  allowOpenModifications: boolean,
  metadata?: {
    description?: string;
    cover_url?: string;
    avatar_url?: string;
    category?: string;
    fixedPermissions?: boolean;
    useGlobalWebRTC?: boolean;
    useLocalMesh?: boolean;
  }
) => {
  const contentWithMetadata = {
    ...presetContent,
    category: metadata?.category ?? presetContent.category,
    description: metadata?.description ?? presetContent.description,
    sessionMetadata: metadata,
  };

  const { data, error } = await supabase
    .from('omni_sessions')
    .insert({
      host_id: hostId,
      host_name: hostName,
      preset_name: presetName,
      preset_content: contentWithMetadata,
      is_public: isPublic,
      allow_open_modifications: allowOpenModifications
    })
    .select();
  
  if (error) throw error;
  
  return mapSessionRow(data[0]);
};

export const updateLiveSession = async (
  sessionId: string,
  hostId: string,
  updates: {
    presetName?: string;
    isPublic?: boolean;
    allowOpenModifications?: boolean;
    presetContent?: PresetContent;
    metadata?: any;
  }
): Promise<LiveSession | null> => {
  // 1. Check local / mesh sessions first
  const localSessions = getLocalLiveSessions();
  const localIdx = localSessions.findIndex((s) => s.id === sessionId);
  if (localIdx >= 0) {
    const current = localSessions[localIdx];
    const currentMeta = (current.presetContent as any)?.sessionMetadata || {};
    const mergedMeta = {
      ...currentMeta,
      ...(updates.metadata || {}),
    };
    const mergedContent: PresetContent & { sessionMetadata?: any } = {
      ...current.presetContent,
      ...(updates.presetContent || {}),
      category: mergedMeta.category ?? updates.presetContent?.category ?? current.category ?? current.presetContent?.category,
      description: mergedMeta.description ?? updates.presetContent?.description ?? current.description ?? current.presetContent?.description,
      updatedAt: Date.now(),
      sessionMetadata: mergedMeta,
    };

    const updatedLocal: LiveSession = {
      ...current,
      ...(updates.presetName !== undefined ? { presetName: updates.presetName } : {}),
      ...(updates.isPublic !== undefined ? { isPublic: updates.isPublic } : {}),
      ...(updates.allowOpenModifications !== undefined ? { allowOpenModifications: updates.allowOpenModifications } : {}),
      presetContent: mergedContent,
      description: mergedMeta.description ?? current.description,
      cover_url: mergedMeta.cover_url ?? current.cover_url,
      avatar_url: mergedMeta.avatar_url ?? current.avatar_url,
      category: mergedMeta.category ?? current.category,
      fixedPermissions: mergedMeta.fixedPermissions ?? current.fixedPermissions,
    };

    const nextLocals = [...localSessions];
    nextLocals[localIdx] = updatedLocal;
    persistLocalLiveSessions(nextLocals);

    if (hostId === 'local-host' || hostId === 'anonymous') {
      return updatedLocal;
    }
  }

  if (hostId === 'local-host' || hostId === 'anonymous') {
    return null;
  }

  // 2. Update remote Supabase session
  const { data: existingRow } = await supabase
    .from('omni_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('host_id', hostId)
    .maybeSingle();

  const existingContent = (existingRow?.preset_content || {}) as any;
  const existingMeta = existingContent.sessionMetadata || {};
  const mergedMeta = {
    ...existingMeta,
    ...(updates.metadata || {}),
  };
  const mergedContent = {
    ...existingContent,
    ...(updates.presetContent || {}),
    category: mergedMeta.category ?? updates.presetContent?.category ?? existingContent.category,
    description: mergedMeta.description ?? updates.presetContent?.description ?? existingContent.description,
    updatedAt: Date.now(),
    sessionMetadata: mergedMeta,
  };

  const payload: Record<string, any> = {
    preset_content: mergedContent,
  };
  if (updates.presetName !== undefined) payload.preset_name = updates.presetName;
  if (updates.isPublic !== undefined) payload.is_public = updates.isPublic;
  if (updates.allowOpenModifications !== undefined) payload.allow_open_modifications = updates.allowOpenModifications;

  const { data, error } = await supabase
    .from('omni_sessions')
    .update(payload)
    .eq('id', sessionId)
    .eq('host_id', hostId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("Error actualizando sesión en vivo:", error);
    throw error;
  }

  return data ? mapSessionRow(data) : null;
};

export const fetchLiveSessionById = async (sessionId: string): Promise<LiveSession | null> => {
  const localMatch = getLocalLiveSessions().find((s) => s.id === sessionId);

  try {
    const { data, error } = await supabase
      .from('omni_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (!error && data) {
      return mapSessionRow(data);
    }
  } catch (err) {
    console.warn("Fallback local al buscar sesión:", err);
  }

  return localMatch || null;
};

export const fetchLiveSessions = async (): Promise<LiveSession[]> => {
  const localPublic = getLocalLiveSessions().filter((s) => s.isPublic !== false || s.useLocalMesh);

  let remoteSessions: LiveSession[] = [];
  try {
    const { data, error } = await supabase
      .from('omni_sessions')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching live sessions:", error);
    } else if (Array.isArray(data)) {
      remoteSessions = data.map(mapSessionRow);
    }
  } catch (err) {
    console.warn("Error de red al obtener sesiones en vivo:", err);
  }

  const mergedMap = new Map<string, LiveSession>();
  remoteSessions.forEach((s) => mergedMap.set(s.id, s));
  localPublic.forEach((s) => {
    if (!mergedMap.has(s.id)) mergedMap.set(s.id, s);
  });

  return Array.from(mergedMap.values()).sort((a, b) => b.createdAt - a.createdAt);
};

// --- OS Files Library Sync ---

export const exportPresetToOSLibrary = async (node: FileSystemNode, userId: string) => {
  if (!node.content) throw new Error("Solo se pueden subir presets (no carpetas puras)");
  
  const presetContent = {
    ...node.content,
    authorId: userId,
  };

  const jsonBlob = new Blob([JSON.stringify(presetContent, null, 2)], { type: 'application/json' });
  const filename = `${node.name}.json`;
  const storagePath = `${userId}/omnifrecuencias_presets/${filename}`;

  // 1. Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('os-files')
    .upload(storagePath, jsonBlob, {
      contentType: 'application/json',
      upsert: true
    });

  if (uploadError) {
    console.error("Error uploading to os-files storage:", uploadError);
    throw uploadError;
  }

  // 2. Insert/Update os_files table
  const { data: dbData, error: dbError } = await supabase
    .from('os_files')
    .upsert({
      owner: userId,
      name: filename,
      mime: 'application/json',
      size: jsonBlob.size,
      path: storagePath,
      is_public: false,
      meta: { type: 'omnifrecuencias_preset', category: (node.content as any).category || 'synergy' }
    }, { onConflict: 'path' })
    .select();

  if (dbError) {
    console.error("Error saving to os_files table:", dbError);
    throw dbError;
  }
  
  return dbData;
};

export interface OSImportedPreset {
  pathSegments: string[];
  name: string;
  content: PresetContent;
}

export const importPresetsFromOSLibrary = async (userId: string): Promise<OSImportedPreset[]> => {
  const { data, error } = await supabase
    .from('os_files')
    .select('*')
    .eq('owner', userId)
    .eq('mime', 'application/json');

  if (error) {
    console.error("Error fetching presets from OS Library:", error);
    return [];
  }

  const importedPresets: OSImportedPreset[] = [];
  
  for (const item of data) {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('os-files')
      .download(item.path);

    if (downloadError || !fileData) {
      console.error("Failed to download preset:", item.name);
      continue;
    }

    try {
      const text = await fileData.text();
      const content = JSON.parse(text) as Partial<PresetContent> & { frequencies?: any[] };
      
      // Validar inteligentemente si el JSON es un preset compatible de Omni-Frecuencias (actual o legado)
      if (content && (Array.isArray(content.oscillators) || Array.isArray(content.frequencies))) {
        const rawList = Array.isArray(content.oscillators)
          ? content.oscillators
          : (content.frequencies as any[]);

        const normalizedContent: PresetContent = {
          ...(content as PresetContent),
          oscillators: normalizeOscillators(rawList),
          dateCreated: typeof content.dateCreated === 'number' ? content.dateCreated : Date.now(),
        };

        // Extraer estructura de carpetas de la ruta original del OS
        // Rutas comunes: {userId}/carpeta1/carpeta2/archivo.json
        const pathParts = item.path.split('/');
        // Remover userId (inicio) y nombre de archivo (fin)
        let folders = pathParts.slice(1, -1);
        
        // Si no está en ninguna carpeta, asignarlo a "Biblioteca OS"
        if (folders.length === 0) folders = ['Biblioteca OS'];
        
        importedPresets.push({
          pathSegments: folders,
          name: item.name.replace(/\.json$/i, ''),
          content: normalizedContent
        });
      }
    } catch (e) {
      // Silenciosamente ignorar archivos JSON que no sean presets válidos
    }
  }

  return importedPresets;
};

export const deleteLiveSession = async (sessionId: string) => {
  const localSessions = getLocalLiveSessions();
  if (localSessions.some((s) => s.id === sessionId)) {
    persistLocalLiveSessions(localSessions.filter((s) => s.id !== sessionId));
  }

  try {
    await supabase.from('omni_sessions').delete().eq('id', sessionId);
  } catch (e) {
    console.warn("No se pudo eliminar sesión remota (puede ser solo local/mesh):", e);
  }
};
