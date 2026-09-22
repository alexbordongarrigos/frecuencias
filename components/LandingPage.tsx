import React, { useState, useEffect } from 'react';
import Icon from './Icon';

interface Props {
  onEnterWeb: () => void;
  onClose?: () => void;
}

const AppIcon = () => (
  <div className="relative flex items-center justify-center w-28 h-28 md:w-32 md:h-32 mb-6 group">
    <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500 via-purple-500 to-pink-500 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition-opacity duration-700 animate-pulse"></div>
    <svg viewBox="0 0 100 100" className="w-full h-full relative z-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] transform group-hover:scale-105 transition-transform duration-500">
      <defs>
        <linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      {/* Outer Rings */}
      <circle cx="50" cy="50" r="46" fill="none" stroke="url(#iconGrad)" strokeWidth="1" opacity="0.3" strokeDasharray="4 4" className="animate-[spin_20s_linear_infinite]" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="url(#iconGrad)" strokeWidth="2" opacity="0.5" className="animate-[spin_15s_linear_infinite_reverse]" />
      <circle cx="50" cy="50" r="30" fill="none" stroke="url(#iconGrad)" strokeWidth="3" opacity="0.8" filter="url(#glow)" />
      
      {/* Infinity / Wave symbol */}
      <path d="M 25 50 C 25 20, 50 20, 50 50 C 50 80, 75 80, 75 50 C 75 20, 50 20, 50 50 C 50 80, 25 80, 25 50 Z" fill="none" stroke="#ffffff" strokeWidth="3" filter="url(#glow)" className="animate-pulse" />
      
      {/* Center Core */}
      <circle cx="50" cy="50" r="6" fill="#ffffff" filter="url(#glow)" />
    </svg>
  </div>
);

export type DetectedOS = 'android' | 'ios' | 'mac' | 'windows' | 'linux' | 'unknown';

const GITHUB_REPO = 'alexbordongarrigos/omnifrecuencias';
const RELEASE_BASE = `https://github.com/${GITHUB_REPO}/releases/latest/download`;

export const DOWNLOAD_LINKS: Record<DetectedOS, { label: string; file: string; url: string; icon: string; desc: string }> = {
  android: {
    label: 'Android (APK)',
    file: 'OmniFrequency.apk',
    url: `${RELEASE_BASE}/OmniFrequency.apk`,
    icon: 'Smartphone',
    desc: 'Paquete instalable para teléfonos y tablets Android con permisos de Mesh y audio continuo.'
  },
  mac: {
    label: 'macOS (DMG)',
    file: 'OmniFrequency.dmg',
    url: `${RELEASE_BASE}/OmniFrequency.dmg`,
    icon: 'Monitor',
    desc: 'Instalador universal para Apple Silicon (M1/M2/M3/M4) e Intel.'
  },
  windows: {
    label: 'Windows (EXE)',
    file: 'OmniFrequency-Setup.exe',
    url: `${RELEASE_BASE}/OmniFrequency-Setup.exe`,
    icon: 'Cpu',
    desc: 'Instalador oficial para Windows 10/11 con aceleración por hardware.'
  },
  linux: {
    label: 'Linux (AppImage)',
    file: 'OmniFrequency.AppImage',
    url: `${RELEASE_BASE}/OmniFrequency.AppImage`,
    icon: 'Terminal',
    desc: 'Ejecutable portátil sin dependencias para Ubuntu, Debian, Fedora y Arch.'
  },
  ios: {
    label: 'iOS / iPadOS (PWA)',
    file: 'PWA WebClip',
    url: '#pwa-ios',
    icon: 'Smartphone',
    desc: 'Instalable a pantalla completa mediante el menú Compartir > Añadir a la pantalla de inicio.'
  },
  unknown: {
    label: 'Todas las Plataformas',
    file: 'GitHub Releases',
    url: `https://github.com/${GITHUB_REPO}/releases`,
    icon: 'Globe',
    desc: 'Repositorio oficial con todas las arquitecturas y binarios disponibles.'
  }
};

const LandingPage: React.FC<Props> = ({ onEnterWeb, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [os, setOs] = useState<DetectedOS>('unknown');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [autoDownloaded, setAutoDownloaded] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // 1. Detect OS
    const userAgent = window.navigator.userAgent.toLowerCase();
    let detected: DetectedOS = 'unknown';

    if (userAgent.includes('android')) detected = 'android';
    else if (userAgent.includes('iphone') || userAgent.includes('ipad') || userAgent.includes('ipod')) detected = 'ios';
    else if (userAgent.includes('mac') && !userAgent.includes('iphone')) detected = 'mac';
    else if (userAgent.includes('win')) detected = 'windows';
    else if (userAgent.includes('linux')) detected = 'linux';

    setOs(detected);

    // 2. Online listener
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // 3. PWA check
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. Auto download detection from query param or hash: ?download=auto or #download
    const searchParams = new URLSearchParams(window.location.search);
    const shouldAutoDownload = searchParams.get('download') === 'auto' || window.location.hash === '#download';

    if (shouldAutoDownload && !autoDownloaded) {
      setAutoDownloaded(true);
      setTimeout(() => {
        triggerDownload(detected);
      }, 800);
    }

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const triggerDownload = (targetOs: DetectedOS) => {
    const config = DOWNLOAD_LINKS[targetOs] || DOWNLOAD_LINKS.unknown;
    if (targetOs === 'ios') {
      setShowIosGuide(true);
      return;
    }
    
    // Trigger direct file download
    const link = document.createElement('a');
    link.href = config.url;
    link.setAttribute('download', config.file);
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else if (os === 'ios') {
      setShowIosGuide(true);
    } else {
      alert("Para instalar en tu dispositivo: Toca el menú de tu navegador (tres puntos o compartir) y selecciona 'Instalar aplicación' o 'Añadir a la pantalla de inicio'.");
    }
  };

  const currentDownload = DOWNLOAD_LINKS[os] || DOWNLOAD_LINKS.unknown;

  return (
    <div className="min-h-screen bg-[#030712] text-slate-200 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-x-hidden font-sans">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-[url('/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay z-0"></div>
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-600/20 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none"></div>

      {onClose && (
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-50 text-slate-400 hover:text-white p-2.5 rounded-full bg-white/5 border border-white/10 hover:border-cyan-500/50 transition-all"
        >
          <Icon name="X" size={20} />
        </button>
      )}

      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center animate-fade-in py-8">
        <AppIcon />
        
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-purple-300 drop-shadow-[0_0_20px_rgba(34,211,238,0.4)] mb-3 text-center tracking-tight">
          OmniFrequency
        </h1>
        <p className="text-sm sm:text-base md:text-lg text-slate-400 font-medium tracking-wide text-center max-w-2xl mb-6">
          Sintonización cuántica, física cimática 3D, espirales fractales y red mesh inteligente con transmisión sin conexión.
        </p>

        {/* Network Status & Detected OS Badge */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <div className="px-4 py-1.5 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            Dispositivo detectado: <strong className="text-white">{currentDownload.label}</strong>
          </div>

          {!isOnline && (
            <div className="px-4 py-1.5 rounded-full bg-amber-950/40 border border-amber-500/50 text-amber-300 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <Icon name="WifiOff" size={14} /> Modo Offline Autónomo Activo
            </div>
          )}
        </div>

        {/* Main 2 Cards: Auto Detected Direct Download vs Web App */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-10">
          
          {/* 1. Recommended Native App for Detected OS */}
          <div className="group relative bg-black/50 border-2 border-purple-500/40 p-6 sm:p-8 rounded-3xl backdrop-blur-xl shadow-[0_10px_40px_rgba(168,85,247,0.2),inset_0_0_20px_rgba(168,85,247,0.05)] hover:border-purple-400 transition-all duration-500 flex flex-col items-center text-center">
            <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-widest border border-purple-500/40">
              Recomendado
            </div>

            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mb-5 shadow-[inset_0_0_20px_rgba(168,85,247,0.2)] group-hover:scale-110 transition-transform duration-500">
              <Icon name="Download" size={36} className="text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
            </div>
            
            <h2 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-wide">
              Instalar para {currentDownload.label}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mb-6 flex-grow">
              {currentDownload.desc}
            </p>
            
            <div className="w-full flex flex-col gap-3">
              <button 
                onClick={() => triggerDownload(os)}
                className="w-full relative flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-purple-600 hover:from-purple-500 hover:to-fuchsia-500 text-white rounded-2xl text-xs sm:text-sm font-bold uppercase tracking-widest transition-all duration-500 shadow-[0_0_30px_rgba(168,85,247,0.4)] hover:shadow-[0_0_40px_rgba(168,85,247,0.8)] hover:-translate-y-0.5"
              >
                <Icon name="Download" size={18} />
                <span>Descargar {currentDownload.file}</span>
              </button>

              <button 
                onClick={handleInstallPWA}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-[11px] font-bold uppercase tracking-wider text-purple-300/80 hover:text-purple-200 transition-colors"
              >
                <Icon name="Smartphone" size={14} />
                <span>O instalar como PWA nativa en pantalla de inicio</span>
              </button>
            </div>
          </div>

          {/* 2. Web Version Card */}
          <div className="group relative bg-black/40 border border-white/10 p-6 sm:p-8 rounded-3xl backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.5),inset_0_0_20px_rgba(255,255,255,0.02)] hover:border-cyan-500/40 hover:shadow-[0_10px_50px_rgba(34,211,238,0.2)] transition-all duration-500 flex flex-col items-center text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-5 shadow-[inset_0_0_20px_rgba(34,211,238,0.2)] group-hover:scale-110 transition-transform duration-500">
              <Icon name="Globe" size={36} className="text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            </div>
            
            <h2 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-wide">
              Ejecutar en la Web
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mb-6 flex-grow">
              Acceso instantáneo sin descargas en cualquier navegador. Incluye síntesis offline con AudioWorklets, pantalla siempre activa y red mesh inter-pestañas.
            </p>
            
            <button 
              onClick={onEnterWeb}
              className="w-full relative flex items-center justify-center gap-3 px-6 py-4 bg-cyan-950/60 hover:bg-cyan-500 text-cyan-200 hover:text-black rounded-2xl text-xs sm:text-sm font-bold uppercase tracking-widest transition-all duration-500 border border-cyan-500/50 hover:border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:shadow-[0_0_30px_rgba(34,211,238,0.6)] hover:-translate-y-0.5"
            >
              <Icon name="Play" size={18} />
              <span>Entrar a la Aplicación Web</span>
              <Icon name="ArrowRight" size={18} />
            </button>
          </div>

        </div>

        {/* All Operating System Downloads Grid */}
        <div className="w-full border-t border-white/10 pt-8">
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-200/80 mb-6 text-center">
            Descargas directas para todos los sistemas operativos
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(['android', 'windows', 'mac', 'linux'] as DetectedOS[]).map((osKey) => {
              const item = DOWNLOAD_LINKS[osKey];
              return (
                <div 
                  key={osKey}
                  className="bg-black/30 border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-cyan-500/40 hover:bg-white/[0.02] transition-all"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-cyan-400">
                      <Icon name={item.icon as any} size={18} />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold text-white">{item.label}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{item.file}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => triggerDownload(osKey)}
                    className="mt-3 w-full py-2 bg-white/5 hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-100 border border-white/10 hover:border-cyan-500/40 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                  >
                    <Icon name="Download" size={12} />
                    Descargar
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* iOS PWA Installation Guide Modal */}
        {showIosGuide && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#0a0f1d] border border-fuchsia-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl relative">
              <button 
                onClick={() => setShowIosGuide(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <Icon name="X" size={18} />
              </button>

              <h4 className="text-base font-bold text-fuchsia-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Icon name="Smartphone" size={18} /> Instalar en iPhone / iPad
              </h4>

              <ol className="space-y-3 text-xs text-slate-300 mb-6 list-decimal list-inside">
                <li>Abre esta página en <strong>Safari</strong>.</li>
                <li>Toca el botón <strong>Compartir</strong> (el icono del cuadrado con una flecha hacia arriba en la barra de Safari).</li>
                <li>Desplázate hacia abajo y selecciona <strong>"Añadir a la pantalla de inicio"</strong>.</li>
                <li>Confirma con <strong>"Añadir"</strong> en la esquina superior derecha.</li>
              </ol>

              <button 
                onClick={() => setShowIosGuide(false)}
                className="w-full py-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default LandingPage;
