import { createClient } from '@supabase/supabase-js';
import { PresetContent, FileSystemNode } from '../types';

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
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      const user = await getCurrentStarseedUser();
      callback(user);
    } else {
      callback(null);
    }
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

// --- Cloud Presets ---

export const publishPresetToCloud = async (node: FileSystemNode, userId: string, isPublic: boolean = false) => {
  if (!node.content) throw new Error("Solo se pueden subir presets (no carpetas puras)");
  
  const presetContent = {
    ...node.content,
    authorId: userId,
    isPublic: isPublic,
  };

  const { data, error } = await supabase
    .from('omni_presets')
    .upsert({ 
      id: node.id, 
      name: node.name,
      content: presetContent,
      author_id: userId,
      is_public: isPublic,
      category: (node.content as any).category || node.content.oscillators[0]?.type || 'synergy'
    })
    .select();

  if (error) {
    console.error("Error publishing preset:", error);
    throw error;
  }
  return data;
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
    content: item.content as PresetContent,
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
  metadata?: { description?: string; cover_url?: string; avatar_url?: string; fixedPermissions?: boolean }
) => {
  const contentWithMetadata = { ...presetContent, sessionMetadata: metadata };

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
  
  const row = data[0];
  const parsedContent = row.preset_content as any;
  const meta = parsedContent.sessionMetadata || {};

  return {
    id: row.id,
    hostId: row.host_id,
    hostName: row.host_name,
    presetName: row.preset_name,
    presetContent: parsedContent,
    isPublic: row.is_public,
    allowOpenModifications: row.allow_open_modifications,
    createdAt: new Date(row.created_at).getTime(),
    description: meta.description,
    cover_url: meta.cover_url,
    avatar_url: meta.avatar_url,
    fixedPermissions: meta.fixedPermissions
  };
};

export const fetchLiveSessionById = async (sessionId: string) => {
  const { data, error } = await supabase
    .from('omni_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error || !data) {
    console.error("Error fetching live session by ID:", error);
    return null;
  }

  const row = data;
  const parsedContent = row.preset_content as any;
  const meta = parsedContent.sessionMetadata || {};

  return {
    id: row.id,
    hostId: row.host_id,
    hostName: row.host_name,
    presetName: row.preset_name,
    presetContent: parsedContent,
    isPublic: row.is_public,
    allowOpenModifications: row.allow_open_modifications,
    createdAt: new Date(row.created_at).getTime(),
    description: meta.description,
    cover_url: meta.cover_url,
    avatar_url: meta.avatar_url,
    fixedPermissions: meta.fixedPermissions
  };
};

export const fetchLiveSessions = async () => {
  const { data, error } = await supabase
    .from('omni_sessions')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching live sessions:", error);
    return [];
  }

  return data.map(row => {
    const parsedContent = row.preset_content as any;
    const meta = parsedContent.sessionMetadata || {};
    return {
      id: row.id,
      hostId: row.host_id,
      hostName: row.host_name,
      presetName: row.preset_name,
      presetContent: parsedContent,
      isPublic: row.is_public,
      allowOpenModifications: row.allow_open_modifications,
      createdAt: new Date(row.created_at).getTime(),
      description: meta.description,
      cover_url: meta.cover_url,
      avatar_url: meta.avatar_url,
      fixedPermissions: meta.fixedPermissions
    };
  });
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
      const content = JSON.parse(text) as Partial<PresetContent>;
      
      // Validar inteligentemente si el JSON es un preset compatible de Omni-Frecuencias
      if (content && Array.isArray(content.frequencies)) {
        
        // Extraer estructura de carpetas de la ruta original del OS
        // Rutas comunes: {userId}/carpeta1/carpeta2/archivo.json
        const pathParts = item.path.split('/');
        // Remover userId (inicio) y nombre de archivo (fin)
        let folders = pathParts.slice(1, -1);
        
        // Si no está en ninguna carpeta, asignarlo a "Biblioteca OS"
        if (folders.length === 0) folders = ['Biblioteca OS'];
        
        importedPresets.push({
          pathSegments: folders,
          name: item.name.replace('.json', ''),
          content: content as PresetContent
        });
      }
    } catch (e) {
      // Silenciosamente ignorar archivos JSON que no sean presets válidos
    }
  }

  return importedPresets;
};

export const deleteLiveSession = async (sessionId: string) => {
  await supabase.from('omni_sessions').delete().eq('id', sessionId);
};
