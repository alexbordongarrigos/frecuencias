import React, { useState, useEffect } from 'react';
import Icon from './Icon';

interface Props {
  onEnterWeb: () => void;
  onClose?: () => void;
}

const FusedAppIcon: React.FC = () => (
  <div className="relative flex items-center justify-center w-[clamp(6rem,16vw,8.25rem)] aspect-square mb-5 group select-none">
    {/* Multi-Spectral Solarpunk Liquid Halo */}
    <div
      className="absolute inset-0 rounded-full blur-2xl opacity-55 group-hover:opacity-85 transition-opacity duration-700 pointer-events-none"
      style={{
        background:
          'radial-gradient(circle, hsla(var(--morph-hue-1) 90% 60% / 0.45) 0%, hsla(var(--morph-hue-2) 88% 62% / 0.35) 55%, transparent 100%)'
      }}
    />

    {/* Core Emblem */}
    <div className="relative z-10 flex items-center justify-center w-[88%] h-[88%] rounded-full art-nouveau-frame transform group-hover:scale-105 transition-transform duration-500">
      <img
        src="/omnifrecuencias.png"
        alt="Omni-Frecuencias"
        className="w-[74%] h-[74%] object-contain drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]"
      />
    </div>
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
    <div className="min-h-dvh w-full bg-[#03050d] text-slate-200 flex flex-col items-center justify-center px-[clamp(1rem,3.5vw,2.5rem)] py-[clamp(1.5rem,4dvh,3.25rem)] relative overflow-x-clip font-sans">
      {/* Ambient StarSeed OS + Omni-Frecuencias Background Layers */}
      <div className="fixed inset-0 bg-[url('/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay z-0" />
      <div className="fixed -top-[18dvh] left-[8%] w-[42vw] max-w-[520px] aspect-square bg-cyan-500/18 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed -bottom-[18dvh] right-[8%] w-[42vw] max-w-[520px] aspect-square bg-purple-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50vw] max-w-[620px] aspect-square bg-amber-500/10 blur-[140px] rounded-full pointer-events-none" />

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar centro de descargas"
          className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50 text-slate-300 hover:text-white p-2.5 rounded-full quantum-glass hover:border-amber-400/50 transition-all cursor-pointer"
        >
          <Icon name="X" size={20} />
        </button>
      )}

      <main className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center justify-center text-center animate-fade-in">
        {/* Fused Emblem Pill */}
        <div className="inline-flex items-center justify-center gap-2.5 px-4 py-1.5 rounded-full bg-black/55 border border-amber-400/30 shadow-[0_0_24px_rgba(251,191,36,0.18)] backdrop-blur-md mb-5">
          <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
          <span className="text-[11px] font-display font-bold uppercase tracking-[0.22em] text-amber-200">
            StarSeed OS × Omni-Frecuencias
          </span>
        </div>

        <FusedAppIcon />

        <h1
          className="text-fluid-hero font-display font-black starseed-text-gradient mb-3 text-center text-balance"
          style={{ filter: 'drop-shadow(0 8px 26px rgba(34,211,238,0.22))' }}
        >
          OmniFrequency
        </h1>

        <p className="text-fluid-subtitle text-slate-300/85 font-normal tracking-wide text-center max-w-2xl mx-auto mb-6 text-pretty">
          Plataforma de síntesis multi-oscilador, espectrometría de interferencia armónica, morfología cimática tridimensional y sincronización en red P2P.
        </p>

        {/* Network Status, PWA Mode & Detected OS Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 mb-8">
          <div className="px-4 py-1.5 rounded-full bg-cyan-950/45 border border-cyan-400/35 text-cyan-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_18px_rgba(34,211,238,0.2)]">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>
              Dispositivo: <strong className="text-white">{currentDownload.label}</strong>
            </span>
          </div>

          {isStandalone && (
            <div className="px-4 py-1.5 rounded-full bg-emerald-950/45 border border-emerald-400/35 text-emerald-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <Icon name="CheckCircle" size={14} className="text-emerald-400" />
              <span>App Instalada</span>
            </div>
          )}

          {!isOnline && (
            <div className="px-4 py-1.5 rounded-full bg-amber-950/50 border border-amber-400/50 text-amber-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 2l20 20" />
                <path d="M8.5 16.5a5 5 0 0 1 7 0" />
                <path d="M5 12.859a10 10 0 0 1 5.17-2.69" />
                <path d="M19 12.859a10 10 0 0 0-2.007-1.523" />
                <path d="M2 8.82a15 15 0 0 1 4.177-2.643" />
                <path d="M22 8.82a15 15 0 0 0-11.288-3.764" />
                <line x1="12" y1="20" x2="12.01" y2="20" />
              </svg>
              <span>Modo Offline Autónomo Activo</span>
            </div>
          )}
        </div>

        {/* Main 2 Cards: Auto Detected Direct Download vs Web App */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 w-full max-w-4xl mx-auto mb-10 items-stretch">
          {/* 1. Recommended Native App for Detected OS */}
          <div className="group relative quantum-glass-gold p-6 sm:p-8 rounded-3xl hover:border-amber-300/60 transition-all duration-500 flex flex-col items-center text-center">
            <div className="absolute top-3.5 right-3.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-200 text-[10px] font-black uppercase tracking-widest border border-amber-400/40">
              Recomendado
            </div>

            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl morph-pill flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-500">
              <Icon name="Download" size={32} className="morph-accent-text" />
            </div>

            <h2 className="text-xl sm:text-2xl font-display font-black text-white mb-2 tracking-wide">
              Instalar para {currentDownload.label}
            </h2>
            <p className="text-fluid-body text-slate-300/80 mb-6 flex-grow max-w-sm">
              {currentDownload.desc}
            </p>

            <div className="w-full flex flex-col gap-3">
              <button
                type="button"
                onClick={() => triggerDownload(os)}
                className="w-full relative flex items-center justify-center gap-3 px-6 py-4 morph-btn-primary rounded-2xl text-xs sm:text-sm font-bold uppercase tracking-widest cursor-pointer"
              >
                <Icon name="Download" size={18} />
                <span>Descargar {currentDownload.file}</span>
              </button>

              <button
                type="button"
                onClick={handleInstallPWA}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-[11px] font-bold uppercase tracking-wider morph-accent-text hover:opacity-85 transition-opacity cursor-pointer"
              >
                <Icon name="Smartphone" size={14} />
                <span>O instalar como PWA nativa en pantalla de inicio</span>
              </button>
            </div>
          </div>

          {/* 2. Web Version Card */}
          <div className="group relative art-nouveau-frame p-6 sm:p-8 rounded-3xl transition-all duration-500 flex flex-col items-center text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl morph-pill flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-500">
              <Icon name="Activity" size={32} className="morph-accent-text-2" />
            </div>

            <h2 className="text-xl sm:text-2xl font-display font-black text-white mb-2 tracking-wide">
              Ejecutar en la Web
            </h2>
            <p className="text-fluid-body text-slate-300/80 mb-6 flex-grow max-w-sm">
              Acceso instantáneo sin descargas en cualquier navegador. Incluye síntesis offline con AudioWorklets, pantalla siempre activa y red mesh inter-pestañas.
            </p>

            <button
              type="button"
              onClick={onEnterWeb}
              className="w-full relative flex items-center justify-center gap-3 px-6 py-4 bg-cyan-950/70 hover:bg-cyan-400 text-cyan-100 hover:text-slate-950 rounded-2xl text-xs sm:text-sm font-bold uppercase tracking-widest transition-all duration-300 border border-cyan-400/50 shadow-[0_0_22px_rgba(34,211,238,0.22)] hover:shadow-[0_0_32px_rgba(34,211,238,0.6)] hover:-translate-y-0.5 cursor-pointer"
            >
              <Icon name="Play" size={18} />
              <span>Entrar a la Aplicación Web</span>
              <Icon name="ArrowRight" size={18} />
            </button>
          </div>
        </div>

        {/* All Operating System Downloads Grid */}
        <div className="w-full max-w-4xl mx-auto border-t border-white/10 pt-8">
          <h3 className="text-xs sm:text-sm font-display font-bold uppercase tracking-[0.22em] text-cyan-200/85 mb-6 text-center">
            Descargas directas para todos los sistemas operativos
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(['android', 'windows', 'mac', 'linux'] as DetectedOS[]).map((osKey) => {
              const item = DOWNLOAD_LINKS[osKey];
              const isCurrent = os === osKey;
              return (
                <div
                  key={osKey}
                  className={`quantum-glass rounded-2xl p-4 flex flex-col items-center justify-between text-center transition-all duration-300 ${
                    isCurrent
                      ? 'border-amber-400/50 shadow-[0_0_22px_rgba(251,191,36,0.16)]'
                      : 'hover:border-cyan-400/45'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2 mb-3">
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-cyan-300">
                      <Icon name={item.icon} size={20} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{item.label}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.file}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerDownload(osKey)}
                    className="w-full py-2 bg-white/5 hover:bg-cyan-500/20 text-cyan-200 hover:text-white border border-white/10 hover:border-cyan-400/45 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Icon name="Download" size={12} />
                    <span>Descargar</span>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() => triggerDownload('ios')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-fuchsia-400/45 text-[11px] font-semibold text-slate-300 hover:text-fuchsia-200 transition-all cursor-pointer"
            >
              <Icon name="Smartphone" size={14} className="text-fuchsia-300" />
              <span>¿Usas iPhone o iPad? Ver guía de instalación PWA para iOS</span>
            </button>
          </div>
        </div>
      </main>

      {/* iOS PWA Installation Guide Modal */}
      {showIosGuide && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-pwa-title"
        >
          <div className="quantum-glass-gold rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative text-left animate-fade-in-up">
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              aria-label="Cerrar guía iOS"
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Icon name="X" size={18} />
            </button>

            <h4
              id="ios-pwa-title"
              className="text-base font-display font-bold text-amber-300 uppercase tracking-wider mb-4 flex items-center gap-2.5 pr-8"
            >
              <Icon name="Smartphone" size={18} /> Instalar en iPhone / iPad
            </h4>

            <ol className="space-y-3 text-xs sm:text-sm text-slate-200 mb-6 list-decimal list-inside leading-relaxed">
              <li>Abre esta página en <strong>Safari</strong>.</li>
              <li>Toca el botón <strong>Compartir</strong> (el icono del cuadrado con una flecha hacia arriba en la barra de Safari).</li>
              <li>Desplázate hacia abajo y selecciona <strong>&ldquo;Añadir a la pantalla de inicio&rdquo;</strong>.</li>
              <li>Confirma con <strong>&ldquo;Añadir&rdquo;</strong> en la esquina superior derecha.</li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full py-3 bg-gradient-to-r from-amber-400 to-fuchsia-600 hover:brightness-110 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
