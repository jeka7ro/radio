import { getCurrentPlatformCapabilities } from './platformCapabilities';

export type MediaSessionOwner = 'radio' | 'music' | 'tv' | 'vod';

export interface MediaSessionMetadataInput {
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string | null;
}

export interface MediaSessionHandlersInput {
  onPlay?: (() => void) | null;
  onPause?: (() => void) | null;
  onStop?: (() => void) | null;
  onPrev?: (() => void) | null;
  onNext?: (() => void) | null;
  onSeekBackward?: ((offsetSec?: number) => void) | null;
  onSeekForward?: ((offsetSec?: number) => void) | null;
  onSeekTo?: ((timeSec: number) => void) | null;
}

declare global {
  interface Window {
    __IS_SMART_TV_DEVICE__?: boolean;
    __aetherMediaSessionOwner?: MediaSessionOwner | null;
    __aetherWakeLockStatus?: {
      activeOwners: string[];
      hasSentinel: boolean;
      requestCount: number;
    };
    PalmSystem?: {
      keepAlive?: (keepAlive: boolean) => void;
    };
  }
}

function getOwner(): MediaSessionOwner | null {
  if (typeof window === 'undefined') return null;
  return window.__aetherMediaSessionOwner ?? null;
}

function setOwner(owner: MediaSessionOwner | null): void {
  if (typeof window === 'undefined') return;
  window.__aetherMediaSessionOwner = owner;
}

function resolveAbsoluteArtworkUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed)) {
    return trimmed;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    try {
      return new URL(trimmed, window.location.origin).href;
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

function inferImageMimeType(url: string): string {
  if (/\.png(?:\?|$)/i.test(url)) return 'image/png';
  if (/\.webp(?:\?|$)/i.test(url)) return 'image/webp';
  if (/\.svg(?:\?|$)/i.test(url)) return 'image/svg+xml';
  return 'image/jpeg';
}

function safeSetActionHandler(
  action: MediaSessionAction,
  handler: MediaSessionActionHandler | null
): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch {
    // Ignore actions unsupported on older WebKit / Smart TV engines
  }
}

export function claimMediaSession(
  owner: MediaSessionOwner,
  meta: MediaSessionMetadataInput,
  handlers: MediaSessionHandlersInput
): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
    return;
  }
  setOwner(owner);

  try {
    if (typeof MediaMetadata !== 'undefined') {
      const artworkList: MediaImage[] = [];
      const primaryArt = resolveAbsoluteArtworkUrl(meta.artworkUrl);
      if (primaryArt) {
        const mime = inferImageMimeType(primaryArt);
        artworkList.push(
          { src: primaryArt, sizes: '512x512', type: mime },
          { src: primaryArt, sizes: '256x256', type: mime }
        );
      }
      const fallbackTouchIcon = resolveAbsoluteArtworkUrl('/apple-touch-icon.png');
      if (fallbackTouchIcon) {
        artworkList.push({
          src: fallbackTouchIcon,
          sizes: '180x180',
          type: 'image/png',
        });
      }
      const fallbackSvg = resolveAbsoluteArtworkUrl('/icons/icon-512.svg');
      if (fallbackSvg) {
        artworkList.push({
          src: fallbackSvg,
          sizes: '512x512',
          type: 'image/svg+xml',
        });
      }

      navigator.mediaSession.metadata = new MediaMetadata({
        title: meta.title || 'Filmio',
        artist: meta.artist || 'Filmio',
        album: meta.album || 'Filmio',
        artwork: artworkList,
      });
    }
  } catch {
    // Ignore metadata constructor failures
  }

  safeSetActionHandler(
    'play',
    handlers.onPlay ? () => handlers.onPlay?.() : null
  );
  safeSetActionHandler(
    'pause',
    handlers.onPause ? () => handlers.onPause?.() : null
  );
  safeSetActionHandler(
    'stop',
    handlers.onStop ? () => handlers.onStop?.() : null
  );
  safeSetActionHandler(
    'previoustrack',
    handlers.onPrev ? () => handlers.onPrev?.() : null
  );
  safeSetActionHandler(
    'nexttrack',
    handlers.onNext ? () => handlers.onNext?.() : null
  );
  safeSetActionHandler(
    'seekbackward',
    handlers.onSeekBackward
      ? (details) => handlers.onSeekBackward?.(details?.seekOffset ?? 15)
      : null
  );
  safeSetActionHandler(
    'seekforward',
    handlers.onSeekForward
      ? (details) => handlers.onSeekForward?.(details?.seekOffset ?? 15)
      : null
  );
  safeSetActionHandler(
    'seekto',
    handlers.onSeekTo
      ? (details) => {
          if (
            typeof details?.seekTime === 'number' &&
            Number.isFinite(details.seekTime)
          ) {
            handlers.onSeekTo?.(Math.max(0, details.seekTime));
          }
        }
      : null
  );
}

export function updateMediaSessionPlaybackState(
  owner: MediaSessionOwner,
  state: 'playing' | 'paused' | 'none'
): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  if (getOwner() !== owner) return;
  try {
    navigator.mediaSession.playbackState = state;
  } catch {
    // ignore
  }
}

export function updateMediaSessionPosition(
  owner: MediaSessionOwner,
  positionSec: number,
  durationSec: number,
  playbackRate = 1
): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  if (getOwner() !== owner) return;
  if (typeof navigator.mediaSession.setPositionState !== 'function') return;
  try {
    if (
      !Number.isFinite(durationSec) ||
      durationSec <= 0 ||
      !Number.isFinite(positionSec)
    ) {
      navigator.mediaSession.setPositionState();
      return;
    }
    const clampedPos = Math.min(durationSec, Math.max(0, positionSec));
    navigator.mediaSession.setPositionState({
      duration: durationSec,
      position: clampedPos,
      playbackRate: playbackRate > 0 ? playbackRate : 1,
    });
  } catch {
    // ignore
  }
}

export function releaseMediaSession(owner: MediaSessionOwner): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  if (getOwner() !== owner) return;
  setOwner(null);
  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
    safeSetActionHandler('play', null);
    safeSetActionHandler('pause', null);
    safeSetActionHandler('stop', null);
    safeSetActionHandler('previoustrack', null);
    safeSetActionHandler('nexttrack', null);
    safeSetActionHandler('seekbackward', null);
    safeSetActionHandler('seekforward', null);
    safeSetActionHandler('seekto', null);
    if (typeof navigator.mediaSession.setPositionState === 'function') {
      navigator.mediaSession.setPositionState();
    }
  } catch {
    // ignore
  }
}

export type VideoFitMode = 'contain' | 'cinema' | 'cover';

const CAR_MODE_STORAGE_KEY = 'aether_car_widescreen_mode_v1';
const CAR_ONLY_VIDEO_FIT_STORAGE_KEY = 'aether_car_video_fit_mode_v2';
const LEGACY_GLOBAL_VIDEO_FIT_KEY = 'aether_video_fit_mode_v1';

let sessionVideoFitMode: VideoFitMode | null = null;

export function isAutomotiveWidescreenMode(): boolean {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.classList.contains('car-widescreen-mode')) {
    return true;
  }
  const pathname = window.location.pathname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  if (
    pathname === '/car' ||
    pathname.startsWith('/car/') ||
    params.get('car') === '1' ||
    params.get('gle') === '1'
  ) {
    return true;
  }
  if (params.get('car') === '0') {
    return false;
  }
  try {
    if (localStorage.getItem(CAR_MODE_STORAGE_KEY) === '1') {
      return true;
    }
    if (localStorage.getItem(CAR_MODE_STORAGE_KEY) === '0') {
      return false;
    }
  } catch {
    // ignore
  }
  // Auto-detect Mercedes MBUX 12.3" 1920x720 / 1280x480 8:3 automotive ultra-wide screens
  const w = window.innerWidth || 0;
  const h = window.innerHeight || 0;
  if (w >= 1200 && h >= 420 && h <= 760 && w / h >= 2.35) {
    return true;
  }
  return false;
}

export function setAutomotiveWidescreenMode(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CAR_MODE_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // ignore
  }
  if (enabled) {
    document.documentElement.classList.add('car-widescreen-mode');
    sessionVideoFitMode = 'cover';
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('car');
      if (!url.pathname.toLowerCase().startsWith('/car')) {
        url.pathname = '/car';
      }
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    } catch {
      // ignore
    }
  } else {
    document.documentElement.classList.remove('car-widescreen-mode');
    sessionVideoFitMode = 'contain';
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('car');
      url.searchParams.delete('gle');
      if (url.pathname.toLowerCase().startsWith('/car')) {
        url.pathname = '/';
      }
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    } catch {
      // ignore
    }
  }
  window.dispatchEvent(
    new CustomEvent('aether:car-mode-change', { detail: { enabled } })
  );
}

export function loadPreferredVideoFitMode(): VideoFitMode {
  if (typeof window === 'undefined') return 'contain';
  try {
    // Remove legacy global key that accidentally forced 'cinema' (21:9) across reboots on 16:9 Smart TVs
    localStorage.removeItem(LEGACY_GLOBAL_VIDEO_FIT_KEY);
  } catch {
    // ignore
  }
  if (sessionVideoFitMode) {
    return sessionVideoFitMode;
  }
  if (isAutomotiveWidescreenMode()) {
    try {
      const saved = localStorage.getItem(CAR_ONLY_VIDEO_FIT_STORAGE_KEY);
      if (saved === 'contain' || saved === 'cinema' || saved === 'cover') {
        sessionVideoFitMode = saved;
        return saved;
      }
    } catch {
      // ignore
    }
    return 'cover';
  }
  return 'contain';
}

export function savePreferredVideoFitMode(mode: VideoFitMode): void {
  sessionVideoFitMode = mode;
  if (typeof window === 'undefined') return;
  if (!isAutomotiveWidescreenMode()) return;
  try {
    localStorage.setItem(CAR_ONLY_VIDEO_FIT_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

/* ============================================================================
   SMART TV (LG webOS / Tizen) & MOBILE ANTI-STANDBY / SCREEN WAKE LOCK ENGINE
   + IDEMPOTENT PERSISTENT DOCUMENT FULLSCREEN HELPERS
   ============================================================================ */

export type WakeLockOwner = 'vod' | 'vod-session' | 'tv';

interface WakeLockSentinelLike {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
}

const activeWakeLockOwners = new Set<WakeLockOwner>();
let activeWakeSentinel: WakeLockSentinelLike | null = null;
let wakeLockRequestInFlight = false;
let wakeLockListenersBound = false;
let wakeLockRequestCount = 0;

function syncWakeLockDebugStatus(): void {
  if (typeof window === 'undefined') return;
  window.__aetherWakeLockStatus = {
    activeOwners: Array.from(activeWakeLockOwners),
    hasSentinel: Boolean(activeWakeSentinel && !activeWakeSentinel.released),
    requestCount: wakeLockRequestCount,
  };
}

function setPalmKeepAlive(keepAlive: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (typeof window.PalmSystem?.keepAlive === 'function') {
      window.PalmSystem.keepAlive(keepAlive);
    }
  } catch {
    // ignore
  }
}

function requestNativeScreenWakeLock(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (activeWakeLockOwners.size === 0) {
    syncWakeLockDebugStatus();
    return;
  }
  setPalmKeepAlive(true);

  if (document.visibilityState === 'hidden') {
    syncWakeLockDebugStatus();
    return;
  }
  if (activeWakeSentinel && !activeWakeSentinel.released) {
    syncWakeLockDebugStatus();
    return;
  }
  if (wakeLockRequestInFlight) return;

  const nav = navigator as Navigator & {
    wakeLock?: {
      request?: (type: 'screen') => Promise<WakeLockSentinelLike>;
    };
  };
  if (typeof nav?.wakeLock?.request !== 'function') {
    syncWakeLockDebugStatus();
    return;
  }

  wakeLockRequestInFlight = true;
  wakeLockRequestCount += 1;
  syncWakeLockDebugStatus();

  // Fire-and-forget: NEVER await on main playback path (some older webOS builds can stall the Promise)
  try {
    Promise.resolve(nav.wakeLock.request('screen'))
      .then((sentinel) => {
        wakeLockRequestInFlight = false;
        if (!sentinel) {
          syncWakeLockDebugStatus();
          return;
        }
        if (activeWakeLockOwners.size === 0) {
          void Promise.resolve(sentinel.release()).catch(() => {});
          syncWakeLockDebugStatus();
          return;
        }
        activeWakeSentinel = sentinel;
        try {
          sentinel.addEventListener?.('release', () => {
            if (activeWakeSentinel === sentinel) {
              activeWakeSentinel = null;
            }
            syncWakeLockDebugStatus();
            if (
              activeWakeLockOwners.size > 0 &&
              typeof document !== 'undefined' &&
              document.visibilityState === 'visible'
            ) {
              window.setTimeout(() => {
                if (activeWakeLockOwners.size > 0) {
                  requestNativeScreenWakeLock();
                }
              }, 350);
            }
          });
        } catch {
          // ignore
        }
        syncWakeLockDebugStatus();
      })
      .catch(() => {
        wakeLockRequestInFlight = false;
        syncWakeLockDebugStatus();
      });
  } catch {
    wakeLockRequestInFlight = false;
    syncWakeLockDebugStatus();
  }
}

function ensureWakeLockListenersBound(): void {
  if (wakeLockListenersBound || typeof document === 'undefined') return;
  wakeLockListenersBound = true;
  const onReacquireCheck = () => {
    if (
      activeWakeLockOwners.size > 0 &&
      document.visibilityState === 'visible'
    ) {
      requestNativeScreenWakeLock();
    }
  };
  document.addEventListener('visibilitychange', onReacquireCheck);
  document.addEventListener('fullscreenchange', onReacquireCheck);
  document.addEventListener('webkitfullscreenchange', onReacquireCheck);
}

export function acquirePlaybackWakeLock(owner: WakeLockOwner): void {
  ensureWakeLockListenersBound();
  activeWakeLockOwners.add(owner);
  requestNativeScreenWakeLock();
}

export function releasePlaybackWakeLock(owner: WakeLockOwner): void {
  activeWakeLockOwners.delete(owner);
  if (activeWakeLockOwners.size > 0) {
    syncWakeLockDebugStatus();
    return;
  }
  setPalmKeepAlive(false);
  const current = activeWakeSentinel;
  activeWakeSentinel = null;
  syncWakeLockDebugStatus();
  if (current && !current.released) {
    try {
      void Promise.resolve(current.release()).catch(() => {});
    } catch {
      // ignore
    }
  }
}

export function isNativeDocumentFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
  };
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

/**
 * Strictly IDEMPOTENT fullscreen entry on `document.documentElement`.
 * - NEVER exits fullscreen if already active (prevents toggling out of fullscreen when switching episodes/torrents!).
 * - Targets `document.documentElement` so fullscreen is NEVER lost when `<VodNativeHlsPlayer>` or modal containers remount.
 */
export function ensureNativeDocumentFullscreen(onEntered?: () => void): void {
  if (typeof document === 'undefined') return;
  if (isNativeDocumentFullscreen()) {
    onEntered?.();
    return;
  }
  const docEl = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  if (!docEl) return;

  const afterEntered = () => {
    onEntered?.();
    try {
      (
        screen.orientation as unknown as {
          lock?: (mode: string) => Promise<void>;
        }
      )
        ?.lock?.('landscape')
        ?.catch(() => {});
    } catch {
      // ignore
    }
  };

  try {
    if (typeof docEl.requestFullscreen === 'function') {
      Promise.resolve(docEl.requestFullscreen({ navigationUI: 'hide' }))
        .then(afterEntered)
        .catch(() => {
          try {
            Promise.resolve(docEl.requestFullscreen())
              .then(afterEntered)
              .catch(() => {});
          } catch {
            // ignore
          }
        });
      return;
    }
    if (typeof docEl.webkitRequestFullscreen === 'function') {
      Promise.resolve(docEl.webkitRequestFullscreen())
        .then(afterEntered)
        .catch(() => {});
    }
  } catch {
    // ignore
  }
}

export function exitNativeDocumentFullscreen(): void {
  if (typeof document === 'undefined') return;
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void> | void;
  };
  if (!doc.fullscreenElement && !doc.webkitFullscreenElement) return;
  try {
    if (typeof doc.exitFullscreen === 'function') {
      void doc.exitFullscreen().catch(() => {});
    } else if (typeof doc.webkitExitFullscreen === 'function') {
      void Promise.resolve(doc.webkitExitFullscreen()).catch(() => {});
    }
  } catch {
    // ignore
  }
}

export function isSmartTvDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return getCurrentPlatformCapabilities().isSmartTv;
}

export function isMobilePhoneDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return getCurrentPlatformCapabilities().isMobilePhone;
}

export function resolveCinemaFitClass(
  videoWidth?: number,
  videoHeight?: number
): 'vod-fit-cinema-x' | 'vod-fit-cinema-y' | 'vod-fit-cinema-xy' {
  if (
    typeof window === 'undefined' ||
    !videoWidth ||
    !videoHeight ||
    videoWidth <= 0 ||
    videoHeight <= 0
  ) {
    return isAutomotiveWidescreenMode() ? 'vod-fit-cinema-y' : 'vod-fit-cinema-xy';
  }
  const vw = window.innerWidth || 1920;
  const vh = window.innerHeight || 1080;
  const screenAspect = vw / Math.max(1, vh);
  const videoAspect = videoWidth / videoHeight;
  if (videoAspect > screenAspect + 0.06) {
    return 'vod-fit-cinema-x';
  }
  if (screenAspect > videoAspect + 0.06) {
    return 'vod-fit-cinema-y';
  }
  return 'vod-fit-cinema-xy';
}

