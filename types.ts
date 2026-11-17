export type CategoryId =
  | 'all'
  | 'solfeggio'
  | 'planetary'
  | 'body'
  | 'bioresonance'
  | 'brain'
  | 'nature'
  | 'electromagnetic'
  | 'numerology'
  | 'pyramid'
  | 'chakras'
  | 'rhythms'
  | 'microtonal'
  | 'music'
  | 'synergy';

export type RadiationMedium =
  | 'acustica'
  | 'electromagnetica'
  | 'magnetica'
  | 'fotonica_nir'
  | 'fotonica_uv'
  | 'ionica_plasma'
  | 'multimedio';

export const RADIATION_MEDIUMS: {
  id: RadiationMedium;
  label: string;
  shortLabel: string;
  iconName: string;
  color: string;
  badgeClass: string;
  summary: string;
}[] = [
  {
    id: 'acustica',
    label: 'Acústica / Vibroacústica',
    shortLabel: 'Acústica',
    iconName: 'Volume2',
    color: 'text-cyan-300',
    badgeClass: 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200',
    summary: 'Altavoces, audífonos estéreo/binaurales o transductores vibroacústicos.'
  },
  {
    id: 'electromagnetica',
    label: 'Electromagnética (PEMF)',
    shortLabel: 'PEMF / EM',
    iconName: 'Radio',
    color: 'text-purple-300',
    badgeClass: 'bg-purple-500/15 border-purple-400/40 text-purple-200',
    summary: 'Campos electromagnéticos pulsados mediante bobinas de induccion o antenas.'
  },
  {
    id: 'magnetica',
    label: 'Magnética / Escalar',
    shortLabel: 'Magnética',
    iconName: 'Magnet',
    color: 'text-indigo-300',
    badgeClass: 'bg-indigo-500/15 border-indigo-400/40 text-indigo-200',
    summary: 'Bobinas toroidales, bifilares de Tesla o campos magnéticos de baja intensidad.'
  },
  {
    id: 'fotonica_nir',
    label: 'Fotónica Infrarroja (NIR)',
    shortLabel: 'Fotónica IR',
    iconName: 'Sun',
    color: 'text-rose-300',
    badgeClass: 'bg-rose-500/15 border-rose-400/40 text-rose-200',
    summary: 'Luz roja e infrarroja cercana (630–980 nm) modulada por pulsos armónicos.'
  },
  {
    id: 'fotonica_uv',
    label: 'Fotónica UV / Espectro Visible',
    shortLabel: 'Fotónica UV/Luz',
    iconName: 'Sparkles',
    color: 'text-violet-300',
    badgeClass: 'bg-violet-500/15 border-violet-400/40 text-violet-200',
    summary: 'Biofotónica de espectro visible y UV-A suave modulada en octavas ópticas.'
  },
  {
    id: 'ionica_plasma',
    label: 'Iónica / Tubo de Plasma',
    shortLabel: 'Iónica / Plasma',
    iconName: 'Zap',
    color: 'text-amber-300',
    badgeClass: 'bg-amber-500/15 border-amber-400/40 text-amber-200',
    summary: 'Tubos de plasma Rife/Phanotron, ionizadores o electrodos de microcorriente.'
  },
  {
    id: 'multimedio',
    label: 'Emisión Híbrida Multi-Medio',
    shortLabel: 'Multi-Medio',
    iconName: 'Atom',
    color: 'text-emerald-300',
    badgeClass: 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200',
    summary: 'Combinación sincronizada de audio, bobina PEMF y modulación fotónica.'
  }
];

export interface TechnicalRecommendation {
  recommendedMediums: RadiationMedium[];
  primaryMediumLabel: string;
  usageMode: string;
  frequencyScales: {
    hz: string;
    khz?: string;
    mhz?: string;
    opticalNm?: string;
  };
  recommendedVolume: string;
  recommendedVoltage?: string;
  recommendedAmperage?: string;
  recommendedWatts?: string;
  recommendedDuration?: string;
  numerologyRelation?: string;
  harmonicEquation?: string;
  naturalObjectResonance?: string;
}

export interface FrequencyItem {
  id: string;
  hz: string;
  numericalHz: number; // For sorting
  name: string;
  category: CategoryId;
  description: string;
  detailedUsage: string;
  evidence: string;
  location?: string;
  binauralBeatHz?: number;
  harmonics?: number[];
  cymaticPatternName?: string;
  oscillatorsConfig?: Partial<OscillatorState>[];
  technicalRecommendation?: TechnicalRecommendation;
}

export interface SortOption {
  label: string;
  value: 'hz-asc' | 'hz-desc' | 'name-asc' | 'location';
}

export const CATEGORIES: {
  id: CategoryId;
  label: string;
  iconName: string;
  color: string;
  description?: string;
}[] = [
  { id: 'all', label: 'Todas', iconName: 'Layers', color: 'text-slate-200', description: 'Espectro completo de partículas resonantes' },
  { id: 'solfeggio', label: 'Solfeggio & Armónicos', iconName: 'Music', color: 'text-purple-400', description: 'Escala sagrada teosófica 3-6-9 y armónicos' },
  { id: 'planetary', label: 'Cósmicas & Planetarias', iconName: 'Orbit', color: 'text-cyan-400', description: 'Octava Cósmica orbital de Hans Cousto y Schumann' },
  { id: 'nature', label: 'Naturaleza, Agua & Cristales', iconName: 'Waves', color: 'text-emerald-300', description: 'Agua EZ, minerales piezoeléctricos, plantas y fauna' },
  { id: 'body', label: 'Cuerpo, Celular & Biofísica', iconName: 'Activity', color: 'text-red-400', description: 'Resonancias de órganos, ADN y reparación tisular' },
  { id: 'bioresonance', label: 'Rife, Nogier & Bio-Resonancia', iconName: 'Shield', color: 'text-orange-400', description: 'Protocolos bioeléctricos de Rife, Clark y Paul Nogier' },
  { id: 'electromagnetic', label: 'PEMF, Fotónica & Plasma', iconName: 'Atom', color: 'text-sky-400', description: 'Ciclotrón iónico, biofotónica UV/IR y ondas escalares' },
  { id: 'brain', label: 'Neuroacústica & Cerebro', iconName: 'Brain', color: 'text-pink-400', description: 'Estados Epsilon, Delta, Theta, Alfa, Beta, Gamma y Lambda' },
  { id: 'numerology', label: 'Numerología, Fibonacci & Phi', iconName: 'Hexagon', color: 'text-amber-300', description: 'Constantes matemáticas, sólidos platónicos y proporción áurea' },
  { id: 'pyramid', label: 'Arqueoacústica & Megalitos', iconName: 'Pyramid', color: 'text-amber-500', description: 'Cámaras resonantes de Giza, Malta, Barabar y Stonehenge' },
  { id: 'chakras', label: 'Chakras & Vórtex', iconName: 'Sun', color: 'text-yellow-400', description: 'Escala védica y sistema bioenergético de 7 vórtex' },
  { id: 'rhythms', label: 'Ritmos & Isocrónicos', iconName: 'Volume2', color: 'text-emerald-400', description: 'Pulsos isocrónicos y arrastre rítmico sin auriculares' },
  { id: 'microtonal', label: 'Pitagóricas & Microtonales', iconName: 'Sliders', color: 'text-blue-400', description: 'Afinaciones justas 432 Hz, 444 Hz y comas armónicas' },
  { id: 'music', label: 'Música Sagrada', iconName: 'Headphones', color: 'text-indigo-400', description: 'Intervalos sagrados y armónicos consonantes' },
  { id: 'synergy', label: 'Sinergias & Ecuaciones', iconName: 'Zap', color: 'text-teal-400', description: 'Combinaciones multi-oscilador y ecuaciones resonantes' },
];

// --- Audio Engine Types ---

export type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface TransitionVariant {
  frequency: number;
  volume: number;
  panX: number;
  panY: number;
  panZ: number;
  type: WaveType;
  crestValleyRatio?: number;
  dutyCycle?: number;
}

export interface TransitionState {
  enabled: boolean;
  start: TransitionVariant;
  end: TransitionVariant;
  duration: number; // in seconds
  loopCount: number | 'infinite';
  isPlaying: boolean;
  progress: number; // 0 to 1
  currentLoop: number;
  direction: 'forward' | 'backward'; // For looping back and forth
}

export interface OscillatorState {
  id: string;
  frequency: number;
  type: WaveType;
  volume: number; // 0 to 1
  
  // Spatial Audio (3D)
  panX: number; // -1 (Left) to 1 (Right)
  panY: number; // -1 (Down) to 1 (Up)
  panZ: number; // -1 (Back) to 1 (Front)

  isPlaying: boolean;
  name?: string;

  // Crossfade for wave types
  type2?: WaveType;
  typeMix?: number; // 0 to 1 (0 = type, 1 = type2)

  // Wave Shaping & Modulation (Crest & Valley Leveling / Distance)
  crestValleyRatio?: number; // 0.1 (compresion valle) to 2.0 (expansión cresta) - default 1.0
  dutyCycle?: number; // -0.8 to 0.8 (wave asymmetry/shaping) - default 0
  harmonicDistortion?: number; // 0 to 1 (non-linear warping) - default 0
  phaseOffset?: number; // 0 to 360 degrees - default 0

  // Visualization & Routing
  isIndependent: boolean; // If true, routes directly to master (skipping combined bus) and visualizes separately
  color: string; // Hex color for the wave

  // Transition / Envelope
  transition?: TransitionState;
}

export interface AudioContextState {
  isPlaying: boolean;
  oscillators: OscillatorState[];
  masterVolume: number;
}

// --- Cymatics 3D Visualizer Types ---

export type CymaticsPalette = 'holographic' | 'quantum' | 'neon' | 'aurora' | 'gold';
export type CymaticsMode = 'chladni3d' | 'fluid3d' | 'quantum_lattice' | 'particles3d';

export interface CymaticsConfig {
  mode: CymaticsMode;
  n: number; // Chladni N modal factor
  m: number; // Chladni M modal factor
  particleCount: number;
  sensitivity: number;
  palette: CymaticsPalette;
  vibrationSpeed: number;
  vibrationAmplitude: number;
  plateMeshResolution: number;
  autoRotate: boolean;
  
  // Physics & Advanced Rendering
  showParticles: boolean;
  gravity: number; // Downward force
  particleDensity: number; // Resistance / spread
  particleSize: number; // Visual size
  particleWeight: number; // Inertia
}

export type BackgroundMode = 'solid' | 'gradient' | 'liquid-rainbow' | 'crystal-bubbles' | 'organic-fade' | 'morphing-colors';
export type SacredGeometryMode = 
  | 'goldenSpiral' | 'flowerOfLife' | 'quantumWave' | 'torus'
  | 'metatron' | 'merkaba' | 'platonicSolids' | 'sriYantra'
  | 'cymatics' | 'vectorEquilibrium' | 'treeOfLife' | 'yinYang'
  | 'mandala1' | 'mandala2' | 'mandala3' | 'holographicFractal'
  | 'chakras' | 'om' | 'lotus' | 'dharmaChakra';

export interface SpiralConfig {
  k: number;
  psi: number;
  z0_r: number;
  z0_i: number;
  iter: number;
  zoom: number;
  speedMultiplier: number;
  thickness: number;
  opacity: number;
  unifiedMode: boolean; // Draw one combined spiral vs one per frequency
  colorPalette: CymaticsPalette;
  
  // New Math / Depth options
  depthMode: boolean;
  depthSpeed: number;
  baseFrequencyRef: number;
  angleMultiplier: number;
  
  // Advanced Math Extensions
  waveStyle: boolean;      // Enable sine wave literal drawing instead of smooth curves
  waveAmplitude: number;   // Amplitude of the wave perturbation
  infiniteDepth: boolean;  // Continuous zoom tunnel effect
  illumination: number;    // Multiplier for brightness and glow reacting to sound
  
  
  autoPilot: boolean;
  sacredGeometryEnabled: boolean;
  sacredGeometryModes: SacredGeometryMode[];
  bgMode: BackgroundMode;
}

// --- Gemini AI Generator Types ---

export interface GeminiWavePreset {
  title: string;
  explanation: string;
  mathematicalConcept: string;
  oscillators: Partial<OscillatorState>[];
}

// --- File System Types ---

export interface PresetContent {
  oscillators: OscillatorState[];
  cymaticsConfig?: Partial<CymaticsConfig>;
  spiralConfig?: Partial<SpiralConfig>;
  dateCreated: number;
  updatedAt?: number;
  description?: string;
  authorId?: string; // Starseed OS account ID
  authorName?: string;
  isPublic?: boolean; // Starseed OS cloud sharing
  version?: string;
  tags?: string[];
  category?: CategoryId | string;
  downloads?: number;
  technicalRecommendation?: TechnicalRecommendation;
}

export interface FileSystemNode {
  id: string;
  parentId: string | null;
  name: string;
  type: 'folder' | 'file';
  children?: FileSystemNode[]; // Only for folders
  content?: PresetContent; // Only for files
  createdAt: number;
}

// --- Live Sessions (Entonación) ---

export interface SessionParticipant {
  id: string; // User ID
  displayName: string;
  avatar_url?: string;
  isMuted: boolean;
  isVideoEnabled: boolean;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface LiveSession {
  id: string;
  hostId: string;
  hostName: string;
  presetName: string;
  presetContent: PresetContent; // The currently playing preset
  isPublic: boolean;
  allowOpenModifications: boolean; // Anyone can change settings?
  createdAt: number;
  participantsCount?: number; // Added for UI
  useGlobalWebRTC?: boolean;
  useLocalMesh?: boolean;
  // Enhanced Metadata
  description?: string;
  cover_url?: string;
  avatar_url?: string;
  category?: string;
  fixedPermissions?: boolean; // If true, permissions don't change if host leaves
}

// --- Community Profiles & Resonances ---

export interface OmniProfile {
  id: string;
  displayName: string;
  avatar_url?: string;
  cover_url?: string;
  status: 'online' | 'offline';
  lastActive: number;
  resonancesCount: number; // Followers
  particlesCount: number; // Public presets
}

export interface OmniResonance {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: number;
}
