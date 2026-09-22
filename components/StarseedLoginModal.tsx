import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { 
  loginWithStarseed, 
  openStarseedRegister, 
  STARSEED_OS_OFFICIAL_URL,
  StarseedUser 
} from '../services/starseedAuth';

interface StarseedLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: StarseedUser) => void;
}

export const StarseedLoginModal: React.FC<StarseedLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset states on open/close
  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccessMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const user = await loginWithStarseed(identifier, password);
      if (user) {
        setSuccessMsg(`¡Bienvenido de vuelta, ${user.displayName}!`);
        setTimeout(() => {
          onLoginSuccess(user);
          onClose();
        }, 700);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al conectar con StarSeed OS.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="relative w-full max-w-md bg-slate-950/95 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(245,158,11,0.25)] backdrop-blur-2xl text-white overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-starseed-title"
      >
        {/* Decorative background glow */}
        <div className="absolute top-0 right-1/4 w-48 h-48 bg-amber-500/10 rounded-full filter blur-3xl pointer-events-none -z-10"></div>
        <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-purple-500/10 rounded-full filter blur-3xl pointer-events-none -z-10"></div>

        {/* Top-Right Exit / Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-transparent hover:border-white/10 cursor-pointer"
          title="Cerrar ventana (Esc)"
          aria-label="Cerrar ventana"
        >
          <Icon name="X" size={20} />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-3 group">
            <div className="absolute -inset-2 bg-gradient-to-tr from-amber-500 to-purple-500 rounded-full blur-md opacity-40 group-hover:opacity-70 transition-opacity"></div>
            <div className="relative w-16 h-16 rounded-full bg-black/80 border border-amber-500/40 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.4)]">
              <img 
                src="/starseed-symbol.png" 
                alt="StarSeed OS" 
                className="w-9 h-9 object-contain drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]"
                onError={(e) => {
                  // Fallback icon if image doesn't exist
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <Icon name="Radio" size={26} className="text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
            </div>
          </div>

          <h2 id="modal-starseed-title" className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-100">
            StarSeed OS
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Inicia sesión con tu cuenta oficial para sincronizar presets, transmitir en vivo y acceder a la red comunitaria.
          </p>
        </div>

        {/* Error / Success Feedback */}
        {error && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-500/40 rounded-xl flex items-start gap-2.5 text-xs text-red-200 animate-fade-in">
            <Icon name="AlertCircle" size={16} className="text-red-400 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center gap-2.5 text-xs text-emerald-200 animate-fade-in">
            <Icon name="Check" size={16} className="text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Usuario o Correo StarSeed OS
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="ej: alexbordon o usuario@star.seed"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoFocus
                required
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/60 focus:bg-black/70 transition-all"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Puedes ingresar tu nombre de usuario (ej. <span className="text-amber-400/80">alexbordon</span>) o tu correo completo.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-black/50 border border-white/10 rounded-xl pl-4 pr-11 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/60 focus:bg-black/70 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 p-1 transition-colors"
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                <Icon name={showPassword ? 'EyeOff' : 'Eye'} size={16} />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-black font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:shadow-[0_0_35px_rgba(245,158,11,0.6)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Icon name="Loader" size={16} className="animate-spin text-black" />
                  <span>Conectando a StarSeed OS...</span>
                </>
              ) : (
                <>
                  <Icon name="LogIn" size={16} />
                  <span>Conectar Cuenta</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Official Registration Section (Directs to official StarSeed OS site) */}
        <div className="mt-6 pt-5 border-t border-white/10">
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
              <Icon name="Globe" size={15} className="text-amber-400" />
              <span>¿Aún no tienes cuenta en StarSeed OS?</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Las identidades soberanas se crean en el portal oficial de StarSeed OS para conectar todo el ecosistema.
            </p>
            <button
              type="button"
              onClick={openStarseedRegister}
              className="mt-1 w-full py-2.5 px-3 bg-white/5 hover:bg-amber-500/15 border border-amber-500/30 hover:border-amber-500/60 rounded-xl text-amber-200 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer group"
            >
              <span>Crear Cuenta en starseed-os.vercel.app</span>
              <Icon name="ExternalLink" size={13} className="text-amber-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* Exit / Cancel Footer */}
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white transition-colors py-1.5 px-3 rounded-lg hover:bg-white/5"
          >
            Volver a Omni-Frecuencias
          </button>
        </div>
      </div>
    </div>
  );
};

export default StarseedLoginModal;
