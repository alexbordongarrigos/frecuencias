
import React, { useState } from 'react';
import { FrequencyItem, CATEGORIES } from '../types';
import Icon from './Icon';

interface Props {
  item: FrequencyItem;
  delay: number;
  onAddToPlayer: (item: FrequencyItem) => void;
}

const FrequencyCard: React.FC<Props> = ({ item, delay, onAddToPlayer }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const categoryInfo = CATEGORIES.find(c => c.id === item.category);
  const colorClass = categoryInfo ? categoryInfo.color : 'text-slate-400';
  
  return (
    <div 
      className={`
        relative group overflow-hidden
        bg-white/[0.03] backdrop-blur-lg border border-white/10 hover:border-white/20
        rounded-2xl p-6 transition-all duration-500 ease-out
        hover:shadow-[0_0_30px_rgba(0,0,0,0.5)] hover:-translate-y-1
        flex flex-col h-full animate-fade-in
      `}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Top Accent Line */}
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-50 ${colorClass}`} />

      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col">
          <span className={`font-display font-bold text-3xl tracking-wider ${colorClass} drop-shadow-lg`}>
            {item.hz} <span className="text-sm font-light opacity-50">Hz</span>
          </span>
          <div className="flex items-center gap-2 mt-1">
             <span className={`text-[10px] uppercase tracking-[0.2em] opacity-70 ${colorClass}`}>
                {categoryInfo?.label}
             </span>
          </div>
        </div>
        <div className={`p-2 rounded-full bg-white/5 border border-white/5 ${colorClass}`}>
           <Icon name={categoryInfo?.iconName || 'Layers'} size={20} />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow">
        <h3 className="text-xl font-medium text-slate-100 mb-2 leading-tight group-hover:text-white transition-colors">
          {item.name}
        </h3>
        
        {item.location && (
          <div className="flex items-center gap-1.5 text-amber-200/70 text-xs font-mono mb-3 bg-amber-900/20 w-fit px-2 py-1 rounded">
            <Icon name="MapPin" size={12} />
            {item.location}
          </div>
        )}

        <p className="text-slate-400 text-sm leading-relaxed mb-4 font-light">
          {item.description}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-white/5">
        
        <button 
            onClick={(e) => {
                e.stopPropagation();
                onAddToPlayer(item);
            }}
            className="w-full py-2 bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/50 rounded-lg flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-300 hover:text-cyan-300 transition-all mb-2"
        >
            <Icon name="Zap" size={14} />
            Añadir al Player
        </button>

        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-xs uppercase tracking-widest text-slate-500 hover:text-cyan-300 transition-colors"
        >
          <span>{isExpanded ? 'Menos Información' : 'Propiedades y Uso'}</span>
          <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={14} />
        </button>

        <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                <h4 className="text-cyan-400 text-xs uppercase font-bold mb-2">Usos Detallados</h4>
                <p className="text-slate-300 text-sm font-light leading-relaxed mb-3">
                  {item.detailedUsage}
                </p>
                <div className="text-[10px] text-slate-500 italic text-right">
                  Fuente: {item.evidence}
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FrequencyCard;
