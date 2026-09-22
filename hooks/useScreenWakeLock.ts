import { useEffect, useRef, useState } from 'react';

/**
 * Universal Screen Wake Lock Hook
 * Keeps device screen awake continuously across any browser, mobile device, or desktop OS.
 * - Uses modern Screen Wake Lock API (Chrome, Edge, Safari 16.4+, Android WebView).
 * - Automatically re-acquires lock on 'visibilitychange' (when returning to the app).
 * - Fallback for older iOS Safari / legacy browsers using looping silent inline video.
 */
export const useScreenWakeLock = (enabled: boolean = true) => {
  const [isLocked, setIsLocked] = useState(false);
  const wakeLockSentinelRef = useRef<any>(null);
  const fallbackVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!enabled) {
      releaseWakeLock();
      return;
    }

    let isMounted = true;

    // 1. Standard Screen Wake Lock API
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && navigator.wakeLock) {
        try {
          // Release previous if any
          if (wakeLockSentinelRef.current && !wakeLockSentinelRef.current.released) {
            await wakeLockSentinelRef.current.release();
          }

          const sentinel = await (navigator.wakeLock as any).request('screen');
          if (!isMounted) {
            sentinel.release();
            return;
          }

          wakeLockSentinelRef.current = sentinel;
          setIsLocked(true);

          sentinel.addEventListener('release', () => {
            if (isMounted) {
              setIsLocked(false);
            }
          });
          console.log('[ScreenWakeLock] Pantalla mantenida encendida activamente (API nativa).');
          return;
        } catch (err: any) {
          console.warn('[ScreenWakeLock] API nativa denegada o no disponible:', err?.message);
        }
      }

      // 2. Fallback for iOS Safari / Legacy browsers (Silent tiny loop video)
      initFallbackVideo();
    };

    const initFallbackVideo = () => {
      try {
        if (!fallbackVideoRef.current) {
          const video = document.createElement('video');
          video.setAttribute('playsinline', '');
          video.setAttribute('loop', '');
          video.setAttribute('muted', '');
          video.muted = true;
          video.style.position = 'fixed';
          video.style.top = '-9999px';
          video.style.left = '-9999px';
          video.style.width = '1px';
          video.style.height = '1px';
          video.style.opacity = '0';
          video.style.pointerEvents = 'none';

          // Base64 1x1 black webm/mp4 frame loop to keep screen alive without bandwidth
          video.src = 'data:video/mp4;base64,AAAAHGZ0eXBpc29tAAAAAGlzb21tcDQxAAAACHZpZGVvAAAAAA==';
          document.body.appendChild(video);
          fallbackVideoRef.current = video;

          video.play().then(() => {
            if (isMounted) setIsLocked(true);
            console.log('[ScreenWakeLock] Fallback video loop activo para mantener pantalla encendida.');
          }).catch(() => {
            // User gesture required on some browsers; will retry on first touch/click
            const retryOnInteraction = () => {
              video.play().then(() => {
                if (isMounted) setIsLocked(true);
              }).catch(() => {});
              window.removeEventListener('click', retryOnInteraction);
              window.removeEventListener('touchstart', retryOnInteraction);
            };
            window.addEventListener('click', retryOnInteraction);
            window.addEventListener('touchstart', retryOnInteraction);
          });
        }
      } catch (e) {
        console.warn('[ScreenWakeLock] Error inicializando fallback:', e);
      }
    };

    const releaseWakeLock = () => {
      if (wakeLockSentinelRef.current) {
        try {
          wakeLockSentinelRef.current.release();
        } catch (_) {}
        wakeLockSentinelRef.current = null;
      }
      if (fallbackVideoRef.current) {
        try {
          fallbackVideoRef.current.pause();
          fallbackVideoRef.current.remove();
        } catch (_) {}
        fallbackVideoRef.current = null;
      }
      setIsLocked(false);
    };

    // Re-acquire wake lock when app comes back to foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        requestWakeLock();
      }
    };

    requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [enabled]);

  return { isLocked };
};
export default useScreenWakeLock;
