
import React from 'react';
import { 
  Layers, Pyramid, Activity, Orbit, Music, Brain, Zap, Search, 
  ChevronDown, ChevronUp, MapPin, Shield, Radio,
  Folder, FileText, Save, Download, Upload, Trash2, Plus, 
  CornerUpLeft, MoreHorizontal, Edit2, X, Play
} from 'lucide-react';

export const icons = {
  Layers,
  Pyramid,
  Activity,
  Orbit,
  Music,
  Brain,
  Zap,
  Search,
  ChevronDown,
  ChevronUp,
  MapPin,
  Shield,
  Radio,
  Folder, 
  FileText, 
  Save, 
  Download, 
  Upload, 
  Trash2, 
  Plus,
  CornerUpLeft,
  MoreHorizontal,
  Edit2,
  X,
  Play
};

interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

const Icon: React.FC<IconProps> = ({ name, size = 20, className = "" }) => {
  const IconComponent = icons[name as keyof typeof icons];
  if (!IconComponent) return null;
  return <IconComponent size={size} className={className} />;
};

export default Icon;
