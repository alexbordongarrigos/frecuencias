import React, { useState, useMemo } from 'react';
import Icon from './Icon';
import {
  PresetContent,
  CATEGORIES,
  RADIATION_MEDIUMS,
  RadiationMedium,
  TechnicalRecommendation
} from '../types';
import {
  createLiveSession,
  getCurrentStarseedUser,
  saveLocalLiveSession
} from '../services/starseedAuth';
import { autoSuggestTechnicalRecommendation } from '../utils/frequencyAnalysis';

const EDITABLE_CATEGORIES = CATEGORIES.filter(c => c.id !== 'all');

interface Props {
  preset: PresetContent | any;
  onClose: () => void;
  onSessionStarted: (session: any) => void;
}

const StartLiveSessionModal: React.FC<Props> = ({ preset, onClose, onSessionStarted }) => {
  const normalizedPreset: PresetContent = useMemo(() => {
    if (Array.isArray(preset?.oscillators)) {
      return preset;
    }
    if (preset?.content && Array.isArray(preset.content.oscillators)) {
      return {
        ...preset.content,
        dateCreated: preset.content.dateCreated || Date.now()
      };
    }
    return { oscillators: [], dateCreated: Date.now() };
  }, [preset]);

  const initialCategory =
    normalizedPreset.category && EDITABLE_CATEGORIES.some(c => c.id === normalizedPreset.category)
      ? normalizedPreset.category
      : EDITABLE_CATEGORIES[0]?.id || 'solfeggio';

  const [presetName, setPresetName] = useState(
    (typeof preset?.name === 'string' && preset.name.trim()) || 'Sesión de Entonación'
  );
  const [isPublic, setIsPublic] = useState(true);
  const [allowOpenModifications, setAllowOpenModifications] = useState(false);
  const [networkMode, setNetworkMode] = useState<'mixed' | 'mesh' | 'server'>('mixed');

  const [description, setDescription] = useState(normalizedPreset.description || '');
  const [coverUrl, setCoverUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [category, setCategory] = useState<string>(initialCategory);
  const [fixedPermissions, setFixedPermissions] = useState(false);

  const [showOscPreview, setShowOscPreview] = useState(false);
  const [showTechSection, setShowTechSection] = useState(Boolean(normalizedPreset.technicalRecommendation));
  const [techRec, setTechRec] = useState<TechnicalRecommendation>(() => {
    if (normalizedPreset.technicalRecommendation) {
      return {
        ...normalizedPreset.technicalRecommendation,
        frequencyScales: { ...normalizedPreset.technicalRecommendation.frequencyScales }
      };
    }
    return autoSuggestTechnicalRecommendation(
      normalizedPreset.oscillators || [],
      initialCategory,
      'Sesión de Entonación'
    );
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAutoFillTech = () => {
    const suggested = autoSuggestTechnicalRecommendation(
      normalizedPreset.oscillators || [],
      category,
      presetName
    );
    setTechRec(suggested);
    setShowTechSection(true);
  };

  const toggleMedium = (mediumId: RadiationMedium) => {
    setTechRec(prev => {
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

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await getCurrentStarseedUser();
      const useGlobalWebRTC = networkMode === 'mixed' || networkMode === 'server';
      const useLocalMesh = networkMode === 'mixed' || networkMode === 'mesh';

      if (!user && useGlobalWebRTC) {
        throw new Error('Debes iniciar sesión con StarSeed OS para transmitir en la red global (o elige "Solo Mesh Local").');
      }

      const finalTech = showTechSection
        ? techRec
        : autoSuggestTechnicalRecommendation(normalizedPreset.oscillators || [], category, presetName);

      const enrichedPreset: PresetContent = {
        ...normalizedPreset,
        category,
        description: description.trim() || normalizedPreset.description,
        technicalRecommendation: finalTech
      };

      const metadata = {
        description: description.trim() || undefined,
        cover_url: coverUrl.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
        category,
        fixedPermissions,
        useGlobalWebRTC,
        useLocalMesh
      };

      let session = null;

      if (useGlobalWebRTC && user) {
        session = await createLiveSession(
          enrichedPreset,
          user.id,
          user.displayName,
          presetName.trim() || 'Sesión de Entonación',
          isPublic,
          allowOpenModifications,
          metadata
        );
      } else {
        session = saveLocalLiveSession({
          id: crypto.randomUUID(),
          presetName: presetName.trim() || 'Sesión Mesh Local',
          hostId: user ? user.id : 'local-host',
          hostName: user ? user.displayName : 'Explorador Mesh',
          presetContent: { ...enrichedPreset, sessionMetadata: metadata } as any,
          isPublic,
          allowOpenModifications,
          createdAt: Date.now(),
          ...metadata
        });
      }

      onSessionStarted({ ...session, useGlobalWebRTC, useLocalMesh, networkMode });
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión.');
    }
    setLoading(false);
  };

  const oscList = normalizedPreset.oscillators || [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md">
      <div className="bg-[#091022] border border-fuchsia-500/30 rounded-3xl w-full max-w-xl shadow-[0_0_50px_rgba(192,38,211,0.2)] animate-fade-in flex flex-col max-h-[92vh] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-white/10 flex justify-between items-center bg-black/40 shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Icon name="Radio" size={18} className="text-fuchsia-400" />
            Transmitir Vibras (Red Híbrida)
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        <form onSubmit={handleStart} className="p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-4">
          <p className="text-xs sm:text-sm text-slate-300">
            Configura los canales de transmisión cuántica ({oscList.length} osciladores activos). Puedes operar de manera híbrida o off-grid en Mesh.
          </p>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Nombre de la Sesión
            </label>
            <input
              type="text"
              required
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              placeholder="Ej. Meditación Pineal Global"
              className="w-full bg-black/50 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-400 transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Categoría
            </label>
            <div className="relative">
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-black/50 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-400 transition-colors appearance-none cursor-pointer"
              >
                {EDITABLE_CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id} className="bg-slate-900 text-white">
                    {cat.label}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400">
                <Icon name="ChevronDown" size={16} />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Descripción (Opcional)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe el propósito de esta sintonización..."
              className="w-full bg-black/50 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-400 transition-colors h-20 resize-none custom-scrollbar"
            />
          </div>

          {/* Collapsible Frequencies Preview */}
          <div className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowOscPreview(v => !v)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-200 hover:text-fuchsia-300 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Icon name="Sliders" size={14} className="text-amber-400" />
                Frecuencias a Transmitir ({oscList.length})
              </span>
              <Icon name={showOscPreview ? 'ChevronUp' : 'ChevronDown'} size={14} />
            </button>

            {showOscPreview && (
              <div className="px-4 pb-3 pt-1 border-t border-white/5 space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                {oscList.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">
                    Aún no hay osciladores activos (puedes añadirlos dentro de la transmisión).
                  </p>
                ) : (
                  oscList.map((osc, i) => (
                    <div
                      key={osc.id || i}
                      className="flex flex-wrap items-center justify-between gap-2 bg-white/[0.03] border border-white/5 rounded-lg px-2.5 py-1.5 text-[11px] font-mono"
                    >
                      <span className="text-white font-sans font-semibold truncate max-w-[140px]">
                        {osc.name || `Capa ${i + 1}`}
                      </span>
                      <span className="text-cyan-300 font-bold">{osc.frequency} Hz</span>
                      <span className="text-purple-300">{osc.type}</span>
                      <span className="text-emerald-300">{Math.round((osc.volume ?? 0.5) * 100)}%</span>
                      <span className="text-slate-400">Pan {Number(osc.panX ?? 0).toFixed(1)}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Collapsible Optional Technical Recommendations */}
          <div className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <button
                type="button"
                onClick={() => setShowTechSection(v => !v)}
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300 hover:text-cyan-200 cursor-pointer"
              >
                <Icon name="Cpu" size={14} />
                <span>Recomendaciones Técnicas (Opcional)</span>
                <Icon name={showTechSection ? 'ChevronUp' : 'ChevronDown'} size={14} />
              </button>
              <button
                type="button"
                onClick={handleAutoFillTech}
                className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/35 border border-purple-400/40 text-purple-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Icon name="Sparkles" size={11} />
                Autocompletar desde Frecuencias
              </button>
            </div>

            {showTechSection && (
              <div className="p-4 pt-2 border-t border-white/10 space-y-3 text-xs">
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">
                    Medios Recomendados
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {RADIATION_MEDIUMS.map(m => {
                      const active = techRec.recommendedMediums.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleMedium(m.id)}
                          className={`px-2.5 py-1 rounded-full border text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                            active
                              ? m.badgeClass
                              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                          }`}
                        >
                          <Icon name={m.iconName} size={10} />
                          {m.shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase text-slate-400 mb-1">Medio Principal</label>
                    <input
                      type="text"
                      value={techRec.primaryMediumLabel}
                      onChange={e => setTechRec(p => ({ ...p, primaryMediumLabel: e.target.value }))}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase text-slate-400 mb-1">Volumen Recomendado</label>
                    <input
                      type="text"
                      value={techRec.recommendedVolume}
                      onChange={e => setTechRec(p => ({ ...p, recommendedVolume: e.target.value }))}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase text-slate-400 mb-1">Voltaje</label>
                    <input
                      type="text"
                      value={techRec.recommendedVoltage || ''}
                      onChange={e => setTechRec(p => ({ ...p, recommendedVoltage: e.target.value }))}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase text-slate-400 mb-1">Amperios</label>
                    <input
                      type="text"
                      value={techRec.recommendedAmperage || ''}
                      onChange={e => setTechRec(p => ({ ...p, recommendedAmperage: e.target.value }))}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase text-slate-400 mb-1">Watts</label>
                    <input
                      type="text"
                      value={techRec.recommendedWatts || ''}
                      onChange={e => setTechRec(p => ({ ...p, recommendedWatts: e.target.value }))}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase text-slate-400 mb-1">Duración</label>
                    <input
                      type="text"
                      value={techRec.recommendedDuration || ''}
                      onChange={e => setTechRec(p => ({ ...p, recommendedDuration: e.target.value }))}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] uppercase text-slate-400 mb-1">Modo de Uso</label>
                  <textarea
                    value={techRec.usageMode}
                    onChange={e => setTechRec(p => ({ ...p, usageMode: e.target.value }))}
                    rows={2}
                    className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-white resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase text-slate-400 mb-1">Hz</label>
                    <input
                      type="text"
                      value={techRec.frequencyScales.hz}
                      onChange={e =>
                        setTechRec(p => ({
                          ...p,
                          frequencyScales: { ...p.frequencyScales, hz: e.target.value }
                        }))
                      }
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-cyan-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase text-slate-400 mb-1">kHz</label>
                    <input
                      type="text"
                      value={techRec.frequencyScales.khz || ''}
                      onChange={e =>
                        setTechRec(p => ({
                          ...p,
                          frequencyScales: { ...p.frequencyScales, khz: e.target.value }
                        }))
                      }
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-purple-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase text-slate-400 mb-1">MHz</label>
                    <input
                      type="text"
                      value={techRec.frequencyScales.mhz || ''}
                      onChange={e =>
                        setTechRec(p => ({
                          ...p,
                          frequencyScales: { ...p.frequencyScales, mhz: e.target.value }
                        }))
                      }
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-amber-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase text-slate-400 mb-1">Óptica (nm)</label>
                    <input
                      type="text"
                      value={techRec.frequencyScales.opticalNm || ''}
                      onChange={e =>
                        setTechRec(p => ({
                          ...p,
                          frequencyScales: { ...p.frequencyScales, opticalNm: e.target.value }
                        }))
                      }
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-rose-200 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                URL Portada (Opcional)
              </label>
              <input
                type="url"
                value={coverUrl}
                onChange={e => setCoverUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-fuchsia-400 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                URL Avatar (Opcional)
              </label>
              <input
                type="url"
                value={avatarUrl}
                onChange={e => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-fuchsia-400 text-xs"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <label className="flex items-start gap-3 bg-black/35 border border-white/10 p-3 rounded-xl hover:border-white/20 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={e => setIsPublic(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-fuchsia-500"
              />
              <span className="flex-1">
                <span className="block text-sm font-bold text-white">Sesión Pública</span>
                <span className="block text-xs text-slate-400">
                  {isPublic
                    ? 'Aparecerá en la pestaña "Sintonización" para toda la comunidad.'
                    : 'Será PRIVADA. Solo podrán unirse quienes reciban tu enlace de invitación.'}
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 bg-black/35 border border-white/10 p-3 rounded-xl hover:border-white/20 cursor-pointer">
              <input
                type="checkbox"
                checked={allowOpenModifications}
                onChange={e => setAllowOpenModifications(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-fuchsia-500"
              />
              <span className="flex-1">
                <span className="block text-sm font-bold text-white">Modificaciones Abiertas</span>
                <span className="block text-xs text-slate-400">
                  Permitir a los participantes modificar los parámetros de las frecuencias.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 bg-fuchsia-950/20 border border-fuchsia-500/25 p-3 rounded-xl hover:border-fuchsia-500/45 cursor-pointer">
              <input
                type="checkbox"
                checked={fixedPermissions}
                onChange={e => setFixedPermissions(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-fuchsia-500"
              />
              <span className="flex-1">
                <span className="block text-sm font-bold text-fuchsia-300">Persistencia de Host</span>
                <span className="block text-xs text-slate-400">
                  Si sales de la sesión, los permisos actuales permanecerán activos para la sala.
                </span>
              </span>
            </label>
          </div>

          <div className="pt-2 border-t border-white/10">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              Topología de Red
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <label
                className={`cursor-pointer border rounded-xl p-3 flex flex-col gap-1 transition-all ${
                  networkMode === 'mixed'
                    ? 'bg-cyan-500/20 border-cyan-500 text-white'
                    : 'bg-black/35 border-white/10 text-slate-400 hover:border-white/30'
                }`}
              >
                <input
                  type="radio"
                  name="networkMode"
                  value="mixed"
                  checked={networkMode === 'mixed'}
                  onChange={() => setNetworkMode('mixed')}
                  className="hidden"
                />
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <Icon name="Globe" size={14} className={networkMode === 'mixed' ? 'text-cyan-400' : 'text-slate-500'} />
                  Mixto (Global + Mesh)
                </div>
                <div className="text-[11px] opacity-75">Transmite por internet y antena P2P simultáneamente.</div>
              </label>

              <label
                className={`cursor-pointer border rounded-xl p-3 flex flex-col gap-1 transition-all ${
                  networkMode === 'mesh'
                    ? 'bg-emerald-500/20 border-emerald-500 text-white'
                    : 'bg-black/35 border-white/10 text-slate-400 hover:border-white/30'
                }`}
              >
                <input
                  type="radio"
                  name="networkMode"
                  value="mesh"
                  checked={networkMode === 'mesh'}
                  onChange={() => setNetworkMode('mesh')}
                  className="hidden"
                />
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <Icon
                    name="RadioReceiver"
                    size={14}
                    className={networkMode === 'mesh' ? 'text-emerald-400' : 'text-slate-500'}
                  />
                  Solo Mesh Local
                </div>
                <div className="text-[11px] opacity-75">Sin servidor remoto. Ideal para modo off-grid.</div>
              </label>

              <label
                className={`cursor-pointer border rounded-xl p-3 flex flex-col gap-1 transition-all ${
                  networkMode === 'server'
                    ? 'bg-purple-500/20 border-purple-500 text-white'
                    : 'bg-black/35 border-white/10 text-slate-400 hover:border-white/30'
                }`}
              >
                <input
                  type="radio"
                  name="networkMode"
                  value="server"
                  checked={networkMode === 'server'}
                  onChange={() => setNetworkMode('server')}
                  className="hidden"
                />
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <Icon
                    name="Server"
                    size={14}
                    className={networkMode === 'server' ? 'text-purple-400' : 'text-slate-500'}
                  />
                  Solo Servidor
                </div>
                <div className="text-[11px] opacity-75">Solo a través de internet (WebRTC).</div>
              </label>
            </div>
          </div>

          {error && <p className="text-red-400 text-xs font-bold text-center bg-red-500/10 border border-red-500/25 rounded-xl p-2.5">{error}</p>}

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-white/15 text-slate-300 font-bold text-xs uppercase tracking-wider hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-bold text-xs uppercase tracking-wider hover:from-fuchsia-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(192,38,211,0.35)] flex justify-center items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <Icon name="Loader" size={16} className="animate-spin" />
              ) : (
                <>
                  <Icon name="Radio" size={16} className={networkMode !== 'mesh' ? 'animate-pulse' : ''} />
                  Iniciar Sintonización
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StartLiveSessionModal;
