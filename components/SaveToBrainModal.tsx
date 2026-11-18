import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import { useFileSystem } from '../hooks/useFileSystem';
import { CATEGORIES, FileSystemNode, PresetContent } from '../types';
import { autoSuggestTechnicalRecommendation } from '../utils/frequencyAnalysis';
import { canWriteBrain } from '../services/starseedBrains';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fs: ReturnType<typeof useFileSystem>;
  initialName: string;
  initialCategory?: string;
  initialContent: PresetContent;
  sourceLabel?: string;
}

interface FlatFolder {
  id: string;
  label: string;
  depth: number;
}

const flattenFolders = (node: FileSystemNode, depth = 0, prefix = ''): FlatFolder[] => {
  const label = depth === 0 ? `${node.name} (Raíz)` : `${prefix}${node.name}`;
  const out: FlatFolder[] = [{ id: node.id, label, depth }];
  for (const child of node.children || []) {
    if (child.type === 'folder') {
      out.push(...flattenFolders(child, depth + 1, `${prefix}  `));
    }
  }
  return out;
};

export const SaveToBrainModal: React.FC<Props> = ({
  isOpen,
  onClose,
  fs,
  initialName,
  initialCategory = 'custom',
  initialContent,
  sourceLabel,
}) => {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState(initialCategory);
  const [folderId, setFolderId] = useState('root');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [saving, setSaving] = useState(false);
  const [switchingBrain, setSwitchingBrain] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setCategory(initialCategory || 'custom');
      setFolderId('root');
      setCreatingFolder(false);
      setNewFolderName('');
      setErrorMsg(null);
      setSavedSuccess(false);
    }
  }, [isOpen, initialName, initialCategory]);

  const flatFolders = useMemo(() => flattenFolders(fs.root), [fs.root]);

  const activeBrainWritable = fs.user ? canWriteBrain(fs.selectedBrain) : true;

  if (!isOpen) return null;

  const handleBrainChange = async (nextBrainId: string) => {
    setErrorMsg(null);
    setSwitchingBrain(true);
    try {
      await fs.selectBrain(nextBrainId);
      setFolderId('root');
    } finally {
      setSwitchingBrain(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Asigna un nombre a la partícula.');
      return;
    }
    if (!activeBrainWritable) {
      setErrorMsg('Este cerebro es de solo lectura. Selecciona un cerebro con acceso Admin o Escritura.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      const fullContent: PresetContent = {
        ...initialContent,
        category: category || initialContent.category || 'custom',
        dateCreated: initialContent.dateCreated || Date.now(),
        updatedAt: Date.now(),
        technicalRecommendation:
          initialContent.technicalRecommendation ||
          autoSuggestTechnicalRecommendation(initialContent.oscillators || [], category, name.trim()),
      };

      const res = await fs.saveParticleToBrainFolder({
        targetBrainId: fs.selectedBrainId,
        folderId,
        newFolderName: creatingFolder ? newFolderName.trim() : undefined,
        name: name.trim(),
        content: fullContent,
      });

      if (!res.ok) {
        setErrorMsg(res.error || 'No se pudo guardar la partícula.');
        setSaving(false);
        return;
      }

      setSavedSuccess(true);
      setTimeout(() => {
        onClose();
      }, 750);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#080d1a] border border-cyan-500/35 rounded-3xl shadow-[0_0_55px_rgba(34,211,238,0.22)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-cyan-500/15 border border-cyan-400/35 text-cyan-300 shrink-0">
              <Icon name="FolderPlus" size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white truncate">
                Guardar Partícula en Biblioteca
              </h3>
              <p className="text-[10px] uppercase tracking-widest text-cyan-300/75 truncate">
                {fs.user
                  ? `Cuenta StarSeed OS · ${fs.user.displayName}`
                  : sourceLabel || 'Almacenamiento Local del Dispositivo'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {errorMsg && (
            <div className="px-3.5 py-2.5 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
              <Icon name="AlertCircle" size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {savedSuccess && (
            <div className="px-3.5 py-2.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
              <Icon name="CheckCircle" size={15} className="shrink-0 text-emerald-400" />
              <span>
                Partícula guardada y sincronizada{' '}
                {fs.selectedBrain ? `en "${fs.selectedBrain.name}"` : 'localmente'}.
              </span>
            </div>
          )}

          {/* Brain Target Selector when logged into StarSeed OS */}
          {fs.user ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                  <Icon name="Brain" size={13} /> Cerebro StarSeed OS Destino
                </label>
                {fs.selectedBrain && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                      fs.selectedBrain.accessLevel === 'admin'
                        ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                        : fs.selectedBrain.accessLevel === 'escritura'
                        ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200'
                        : 'bg-amber-500/15 border-amber-400/40 text-amber-200'
                    }`}
                  >
                    Acceso: {fs.selectedBrain.accessLevel}
                  </span>
                )}
              </div>
              <select
                value={fs.selectedBrainId || ''}
                onChange={(e) => handleBrainChange(e.target.value)}
                disabled={switchingBrain || fs.brains.length === 0}
                className="w-full bg-black/60 border border-purple-500/35 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none"
              >
                {fs.brains.map((b) => (
                  <option key={b.id} value={b.id} className="bg-[#0a0f1f] text-white">
                    {b.name} ({b.accessLevel.toUpperCase()}
                    {b.isOwner ? ' · Propio' : ' · Compartido'})
                  </option>
                ))}
              </select>
              {!activeBrainWritable && (
                <p className="text-[11px] text-amber-300">
                  Este cerebro tiene permiso de Solo Lectura. Elige otro cerebro para guardar cambios.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-black/50 border border-cyan-500/25 p-3 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Icon name="HardDrive" size={15} className="text-cyan-400 shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-slate-200 truncate">
                    {fs.localLocationMeta
                      ? `Archivo Local: ${fs.localLocationMeta.label}`
                      : 'Almacenamiento Local del Dispositivo'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Modo sin sesión · importable luego a tu cuenta StarSeed OS
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fs.chooseLocalDeviceLocation('directory')}
                className="px-2.5 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-400/35 text-[10px] font-bold uppercase text-cyan-200 shrink-0 cursor-pointer"
              >
                Elegir Carpeta
              </button>
            </div>
          )}

          {/* Folder Selector + Inline New Folder */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Icon name="Folder" size={13} className="text-amber-400" /> Carpeta de Destino
              </label>
              <button
                type="button"
                onClick={() => setCreatingFolder(!creatingFolder)}
                disabled={!activeBrainWritable}
                className="text-[11px] font-bold text-cyan-300 hover:text-cyan-200 flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                <Icon name={creatingFolder ? 'X' : 'Plus'} size={12} />
                {creatingFolder ? 'Usar Existente' : 'Nueva Carpeta'}
              </button>
            </div>

            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              disabled={switchingBrain}
              className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none"
            >
              {flatFolders.map((f) => (
                <option key={f.id} value={f.id} className="bg-[#0a0f1f] text-white">
                  {f.label}
                </option>
              ))}
            </select>

            {creatingFolder && (
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nombre de la nueva subcarpeta (se creará dentro de la elegida)..."
                className="w-full bg-black/70 border border-cyan-500/40 rounded-xl px-3.5 py-2 text-xs text-white focus:border-cyan-300 focus:outline-none"
                autoFocus
              />
            )}
          </div>

          {/* Particle Name & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Nombre de la Partícula
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Armónico 432 Hz"
                required
                className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none"
              >
                <option value="custom" className="bg-[#0a0f1f]">Personalizado</option>
                {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#0a0f1f]">
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Oscillators preview summary */}
          <div className="rounded-xl bg-white/[0.03] border border-white/10 px-3.5 py-2.5 text-[11px] text-slate-300 flex items-center justify-between">
            <span>
              Osciladores incluidos:{' '}
              <strong className="text-cyan-300">{initialContent.oscillators?.length || 0}</strong>
            </span>
            <span className="font-mono text-[10px] text-slate-400 truncate max-w-[230px]">
              {(initialContent.oscillators || [])
                .slice(0, 3)
                .map((o) => `${o.frequency} Hz`)
                .join(' · ')}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-white/15 text-xs font-bold text-slate-300 hover:bg-white/5 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !activeBrainWritable || !name.trim()}
              className="px-6 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500 text-cyan-200 hover:text-black border border-cyan-400/50 text-xs font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving && <Icon name="Loader" size={14} className="animate-spin" />}
              <Icon name="Save" size={14} />
              Guardar Partícula
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default SaveToBrainModal;
