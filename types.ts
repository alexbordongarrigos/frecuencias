
export type CategoryId = 'all' | 'pyramid' | 'body' | 'planetary' | 'solfeggio' | 'brain' | 'synergy' | 'bioresonance' | 'music';

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
}

export interface SortOption {
  label: string;
  value: 'hz-asc' | 'hz-desc' | 'name-asc' | 'location';
}

export const CATEGORIES: { id: CategoryId; label: string; iconName: string; color: string }[] = [
  { id: 'all', label: 'Todas', iconName: 'Layers', color: 'text-slate-200' },
  { id: 'solfeggio', label: 'Solfeggio', iconName: 'Music', color: 'text-purple-400' },
  { id: 'planetary', label: 'Cósmicas', iconName: 'Orbit', color: 'text-cyan-400' },
  { id: 'body', label: 'Cuerpo & Nogier', iconName: 'Activity', color: 'text-red-400' },
  { id: 'bioresonance', label: 'Rife & Patógenos', iconName: 'Shield', color: 'text-orange-400' },
  { id: 'brain', label: 'Neuroacústica', iconName: 'Brain', color: 'text-pink-400' },
  { id: 'pyramid', label: 'Megalitos', iconName: 'Pyramid', color: 'text-amber-500' },
  { id: 'music', label: 'Música Sagrada', iconName: 'Radio', color: 'text-indigo-400' },
  { id: 'synergy', label: 'Sinergias', iconName: 'Zap', color: 'text-emerald-400' },
];

// --- Audio Engine Types ---

export type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle';

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

  // Visualization & Routing
  isIndependent: boolean; // If true, routes directly to master (skipping combined bus) and visualizes separately
  color: string; // Hex color for the wave
}

export interface AudioContextState {
  isPlaying: boolean;
  oscillators: OscillatorState[];
  masterVolume: number;
}

// --- File System Types ---

export interface PresetContent {
  oscillators: OscillatorState[];
  dateCreated: number;
  description?: string;
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
