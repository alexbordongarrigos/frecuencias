// services/autoUpdateService.ts
// Automatic update checking service connected to GitHub Releases and Service Worker

export interface AppReleaseInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
  downloadUrl: string;
  htmlUrl: string;
}

export const CURRENT_APP_VERSION = '2.0.0';
const GITHUB_REPO = 'alexbordongarrigos/omnifrecuencias';

class AutoUpdateService {
  private listeners: ((info: AppReleaseInfo | null) => void)[] = [];
  public lastReleaseInfo: AppReleaseInfo | null = null;
  private isChecking = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Check on startup if online
      if (navigator.onLine) {
        setTimeout(() => this.checkForUpdates(), 3000);
      }

      // Check automatically whenever internet is connected/restored
      window.addEventListener('online', () => {
        console.log('[AutoUpdate] Conexión a Internet detectada. Buscando actualizaciones...');
        this.checkForUpdates();
      });

      // Periodic check every 30 minutes if online
      setInterval(() => {
        if (navigator.onLine) {
          this.checkForUpdates();
        }
      }, 30 * 60 * 1000);
    }
  }

  public subscribe(listener: (info: AppReleaseInfo | null) => void) {
    this.listeners.push(listener);
    if (this.lastReleaseInfo) {
      listener(this.lastReleaseInfo);
    }
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(info: AppReleaseInfo | null) {
    this.lastReleaseInfo = info;
    this.listeners.forEach(fn => fn(info));
  }

  /**
   * Compares semver versions (returns true if latest is strictly greater than current)
   */
  private isNewer(latest: string, current: string): boolean {
    const cleanLatest = latest.replace(/^v/, '').trim();
    const cleanCurrent = current.replace(/^v/, '').trim();
    const [lMaj = 0, lMin = 0, lPatch = 0] = cleanLatest.split('.').map(n => parseInt(n, 10) || 0);
    const [cMaj = 0, cMin = 0, cPatch = 0] = cleanCurrent.split('.').map(n => parseInt(n, 10) || 0);

    if (lMaj > cMaj) return true;
    if (lMaj === cMaj && lMin > cMin) return true;
    if (lMaj === cMaj && lMin === cMin && lPatch > cPatch) return true;
    return false;
  }

  /**
   * Detect current platform installer asset URL
   */
  private getPlatformAssetUrl(assets: any[]): string {
    const userAgent = (typeof window !== 'undefined' ? window.navigator.userAgent : '').toLowerCase();
    
    if (userAgent.includes('android')) {
      const apk = assets.find(a => a.name.endsWith('.apk'));
      if (apk) return apk.browser_download_url;
    } else if (userAgent.includes('win')) {
      const exe = assets.find(a => a.name.endsWith('.exe'));
      if (exe) return exe.browser_download_url;
    } else if (userAgent.includes('mac') && !userAgent.includes('iphone') && !userAgent.includes('ipad')) {
      const dmg = assets.find(a => a.name.endsWith('.dmg'));
      if (dmg) return dmg.browser_download_url;
    } else if (userAgent.includes('linux')) {
      const appImage = assets.find(a => a.name.endsWith('.AppImage') || a.name.endsWith('.deb'));
      if (appImage) return appImage.browser_download_url;
    }
    
    return assets[0]?.browser_download_url || `https://github.com/${GITHUB_REPO}/releases/latest`;
  }

  /**
   * Check GitHub Releases API for new updates
   */
  public async checkForUpdates(): Promise<AppReleaseInfo | null> {
    if (this.isChecking || !navigator.onLine) return null;
    this.isChecking = true;

    try {
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API returned status ${response.status}`);
      }

      const release = await response.json();
      const tagName = release.tag_name || 'v0.0.0';
      const hasUpdate = this.isNewer(tagName, CURRENT_APP_VERSION);

      const info: AppReleaseInfo = {
        hasUpdate,
        currentVersion: CURRENT_APP_VERSION,
        latestVersion: tagName,
        releaseName: release.name || tagName,
        releaseNotes: release.body || 'Nuevas optimizaciones y mejoras cuánticas disponibles.',
        publishedAt: release.published_at || new Date().toISOString(),
        downloadUrl: this.getPlatformAssetUrl(release.assets || []),
        htmlUrl: release.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`
      };

      if (hasUpdate) {
        console.log(`[AutoUpdate] Nueva versión detectada: ${tagName} (actual: ${CURRENT_APP_VERSION})`);
        this.notify(info);
      } else {
        console.log(`[AutoUpdate] La aplicación está al día (versión ${CURRENT_APP_VERSION}).`);
      }

      return info;
    } catch (err) {
      console.warn('[AutoUpdate] No se pudo verificar actualización en GitHub (posible modo offline o límite de API):', err);
      return null;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Triggers download or installation of the update
   */
  public applyUpdate() {
    if (this.lastReleaseInfo?.downloadUrl) {
      window.open(this.lastReleaseInfo.downloadUrl, '_blank');
    }
  }
}

export const autoUpdateService = new AutoUpdateService();
export default autoUpdateService;
