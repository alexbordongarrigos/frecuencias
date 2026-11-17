import React, { useState, useRef, useEffect, useMemo } from 'react';
import Icon from './Icon';
import { LangCode, SUPPORTED_LANGUAGES } from '../utils/i18n';

interface LanguageSelectorProps {
  currentLang: LangCode;
  onChangeLang: (lang: LangCode) => void;
  compact?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLang,
  onChangeLang,
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const active = useMemo(
    () => SUPPORTED_LANGUAGES.find((l) => l.code === currentLang) || SUPPORTED_LANGUAGES[0],
    [currentLang]
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return SUPPORTED_LANGUAGES;
    return SUPPORTED_LANGUAGES.filter(
      (l) =>
        l.nativeName.toLowerCase().includes(q) ||
        l.englishName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    );
  }, [filter]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Seleccionar idioma"
        className={`inline-flex items-center gap-2 rounded-full morph-btn-glass text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-100 cursor-pointer ${
          compact ? 'px-3 py-1.5' : 'px-3.5 py-1.5'
        }`}
      >
        <Icon name="Languages" size={14} className="morph-accent-text" />
        <span data-no-translate="true">{active.nativeName}</span>
        <span className="text-[9px] font-mono opacity-70" data-no-translate="true">
          {active.regionLabel}
        </span>
        <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={12} />
      </button>

      {open && (
        <div
          data-no-translate="true"
          className="absolute right-0 sm:left-1/2 sm:-translate-x-1/2 mt-2 w-64 max-w-[90vw] z-[200] rounded-2xl art-nouveau-frame p-2.5 shadow-[0_20px_60px_rgba(0,0,0,0.9)] animate-fade-in"
        >
          <div className="relative mb-2">
            <Icon
              name="Search"
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar idioma..."
              autoFocus
              className="w-full bg-black/70 border border-white/15 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-white/40"
            />
          </div>

          <div
            role="listbox"
            className="max-h-64 overflow-y-auto custom-scrollbar space-y-0.5 pr-1"
          >
            {filtered.map((lang) => {
              const selected = lang.code === currentLang;
              return (
                <button
                  key={lang.code}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChangeLang(lang.code);
                    setOpen(false);
                    setFilter('');
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                    selected
                      ? 'morph-tab-active font-bold text-white'
                      : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <span className="truncate">{lang.nativeName}</span>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {lang.regionLabel}
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="py-4 text-center text-[11px] text-slate-400">
                Sin coincidencias
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
