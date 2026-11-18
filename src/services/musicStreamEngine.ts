import type { SpotifyTrackItem } from '../components/tv/spotifyMusicPremiumViews';
import {
  buildFileListApiUrl,
  getFileListServerBase,
  hasLocalLoopbackBridge,
  isDirectLocalHost,
} from './deviceContinuityService';

export interface YoutubeMusicCallbacks {
  onProgress: (currentTimeSec: number, durationSec: number) => void;
  onStateChange: (isPlaying: boolean) => void;
  onEnded: () => void;
  onAllCandidatesFailed: () => void;
}

interface YtSearchResultItem {
  videoId?: string;
  title?: string;
  channel?: string;
  durationSec?: number;
  isLive?: boolean;
}

interface YtPlayerInstance {
  loadVideoById: (arg: { videoId: string; startSeconds?: number } | string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
}

type YtWindow = Window & {
  YT?: {
    Player?: new (
      el: HTMLElement | string,
      opts: Record<string, unknown>
    ) => YtPlayerInstance;
    PlayerState?: {
      UNSTARTED: number;
      ENDED: number;
      PLAYING: number;
      PAUSED: number;
      BUFFERING: number;
      CUED: number;
    };
  };
  onYouTubeIframeAPIReady?: () => void;
};

const YT_CANDIDATES_STORAGE_KEY = 'aether_yt_music_candidates_v1';
const YT_CANDIDATES_TTL_MS = 24 * 60 * 60 * 1000;
const SHORT_SNIPPET_RE = /\b(shorts?|teaser|preview|snippet|ringtone|15\s*sec|30\s*sec)\b/i;
const PENALTY_VERSION_RE = /\b(karaoke|8d|nightcore|slowed|reverb\s*only)\b/i;
const BONUS_OFFICIAL_RE = /\b(official\s*audio|topic|lyrics?|audio)\b/i;

const memCandidateCache = new Map<string, { ids: string[]; ts: number }>();
const inFlightCandidateResolves = new Map<string, Promise<string[]>>();
let candidatesHydrated = false;

function normalizeCandidateCacheKey(track: Pick<SpotifyTrackItem, 'id' | 'artist' | 'title'>): string {
  const norm = (s: string) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\u0400-\u04ff\uac00-\ud7af]+/g, ' ')
      .trim();
  const a = norm(track.artist);
  const t = norm(track.title);
  return a && t ? `${a}::${t}` : String(track.id || '');
}

function extractVideoIdFromAudioUrl(rawUrl?: string): string {
  const m = String(rawUrl || '').match(/[?&]id=([a-zA-Z0-9_-]{11})(?:&|$)/);
  return m?.[1] || '';
}

function hydrateCandidateCache(): void {
  if (candidatesHydrated) return;
  candidatesHydrated = true;
  if (typeof sessionStorage === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(YT_CANDIDATES_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, { ids?: string[]; ts?: number }>;
    if (!parsed || typeof parsed !== 'object') return;
    const now = Date.now();
    for (const [k, v] of Object.entries(parsed)) {
      if (
        Array.isArray(v?.ids) &&
        v.ids.length > 0 &&
        typeof v.ts === 'number' &&
        now - v.ts < YT_CANDIDATES_TTL_MS
      ) {
        memCandidateCache.set(k, { ids: v.ids, ts: v.ts });
      }
    }
  } catch {
    // ignore storage errors
  }
}

function saveCandidatesToStorage(key: string, ids: string[]): void {
  hydrateCandidateCache();
  const entry = { ids, ts: Date.now() };
  memCandidateCache.set(key, entry);
  if (typeof sessionStorage === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(YT_CANDIDATES_STORAGE_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as Record<string, { ids: string[]; ts: number }>)
      : {};
    parsed[key] = entry;
    const entries = Object.entries(parsed);
    if (entries.length > 220) {
      entries.sort((a, b) => (b[1]?.ts || 0) - (a[1]?.ts || 0));
      sessionStorage.setItem(
        YT_CANDIDATES_STORAGE_KEY,
        JSON.stringify(Object.fromEntries(entries.slice(0, 180)))
      );
    } else {
      sessionStorage.setItem(YT_CANDIDATES_STORAGE_KEY, JSON.stringify(parsed));
    }
  } catch {
    // ignore quota errors
  }
}

export function canUseResidentialDirectAudio(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).get('cloudmusic') === '1') {
      return false;
    }
  } catch {
    // ignore URL search errors
  }
  if (isDirectLocalHost()) {
    return true;
  }
  if (!hasLocalLoopbackBridge()) {
    return false;
  }
  const bridgeBase = getFileListServerBase();
  return (
    bridgeBase.startsWith('http://localhost:') ||
    bridgeBase.startsWith('http://127.0.0.1:') ||
    bridgeBase.startsWith('https://')
  );
}

export function buildResidentialFullAudioUrl(track: SpotifyTrackItem): string {
  const qs = new URLSearchParams();
  const seedId =
    track.videoId && /^[a-zA-Z0-9_-]{11}$/.test(track.videoId)
      ? track.videoId
      : extractVideoIdFromAudioUrl(track.fullAudioUrl);
  if (seedId) {
    qs.set('id', seedId);
  }
  const cleanQuery = `${track.artist || ''} - ${track.title || ''} Official Audio`.trim();
  if (cleanQuery) {
    qs.set('q', cleanQuery);
  }
  if (track.durationSec > 0) {
    qs.set('dur', String(Math.round(track.durationSec)));
  }
  return buildFileListApiUrl(`/api/youtube/audio?${qs.toString()}`);
}

export function promoteWorkingCandidate(
  track: SpotifyTrackItem | null,
  workingVideoId: string
): void {
  if (!track || !/^[a-zA-Z0-9_-]{11}$/.test(workingVideoId)) return;
  hydrateCandidateCache();
  const key = normalizeCandidateCacheKey(track);
  if (!key) return;
  const existing = memCandidateCache.get(key)?.ids || [];
  if (existing[0] === workingVideoId) return;
  const promoted = [
    workingVideoId,
    ...existing.filter((id) => id !== workingVideoId),
  ].slice(0, 10);
  saveCandidatesToStorage(key, promoted);
}

export async function resolveTrackYoutubeCandidates(
  track: SpotifyTrackItem
): Promise<string[]> {
  hydrateCandidateCache();
  const key = normalizeCandidateCacheKey(track);
  const cached = memCandidateCache.get(key);
  if (cached && Date.now() - cached.ts < YT_CANDIDATES_TTL_MS && cached.ids.length > 0) {
    return cached.ids;
  }

  const inflight = inFlightCandidateResolves.get(key);
  if (inflight) return inflight;

  const task = (async (): Promise<string[]> => {
    const out: string[] = [];
    const seen = new Set<string>();
    const pushUniqueId = (vid?: string) => {
      const clean = String(vid || '').trim();
      if (/^[a-zA-Z0-9_-]{11}$/.test(clean) && !seen.has(clean)) {
        seen.add(clean);
        out.push(clean);
      }
    };

    pushUniqueId(track.videoId);
    pushUniqueId(extractVideoIdFromAudioUrl(track.fullAudioUrl));

    const expectedDur = Math.max(0, Math.round(track.durationSec || 0));
    const minAcceptableDur =
      expectedDur >= 75 ? Math.max(48, Math.floor(expectedDur * 0.45)) : 45;
    const maxAcceptableDur = Math.max(expectedDur * 2.8, 960);

    type ScoredCandidate = { id: string; score: number; restrictedLikely: boolean };

    const fetchAndScore = async (searchQuery: string): Promise<ScoredCandidate[]> => {
      try {
        const res = await fetch(
          `/api/youtube/search?q=${encodeURIComponent(searchQuery)}`
        );
        if (!res.ok) return [];
        const data = (await res.json()) as { items?: YtSearchResultItem[] };
        const items = Array.isArray(data?.items) ? data.items : [];
        const scored: ScoredCandidate[] = [];

        for (const item of items) {
          const vid = String(item?.videoId || '').trim();
          const title = String(item?.title || '');
          const ch = String(item?.channel || '');
          const dur = Number(item?.durationSec || 0);
          if (!/^[a-zA-Z0-9_-]{11}$/.test(vid)) continue;
          if (item?.isLive || dur === 0) continue;
          if (SHORT_SNIPPET_RE.test(title)) continue;
          if (dur < minAcceptableDur || dur > maxAcceptableDur) continue;

          const isTopicOrVevo = /\b(-\s*Topic|VEVO|Official)\b/i.test(ch);
          let score = 0;
          if (expectedDur > 0) {
            const diff = Math.abs(dur - expectedDur);
            if (diff <= 5) score += 60;
            else if (diff <= 15) score += 40;
            else if (diff <= 35) score += 20;
            else if (diff > 120) score -= 20;
          }
          if (BONUS_OFFICIAL_RE.test(title) || /\bTopic\b/i.test(ch)) {
            score += 25;
          }
          if (PENALTY_VERSION_RE.test(title)) {
            score -= 35;
          }
          scored.push({ id: vid, score, restrictedLikely: isTopicOrVevo });
        }

        scored.sort((a, b) => b.score - a.score);
        return scored;
      } catch {
        return [];
      }
    };

    const baseTrackName =
      track.videoQuery && track.videoQuery.trim()
        ? track.videoQuery.trim()
        : `${track.artist || ''} - ${track.title || ''}`.trim();
    const primaryQuery = `${baseTrackName} Official Audio`.trim();
    const primaryRanked = await fetchAndScore(primaryQuery);
    const mergedRanked: ScoredCandidate[] = [...primaryRanked];

    const allTopRestrictedLikely =
      primaryRanked.length > 0 &&
      primaryRanked.every((item) => item.restrictedLikely);

    if (primaryRanked.length < 6 || allTopRestrictedLikely) {
      const lyricsQuery = `${baseTrackName} lyrics`.trim();
      const plainQuery = `${track.artist || ''} - ${track.title || ''}`.trim();
      const secondaryQuery =
        lyricsQuery && lyricsQuery !== primaryQuery ? lyricsQuery : plainQuery;
      if (secondaryQuery && secondaryQuery !== primaryQuery) {
        const secondaryRanked = await fetchAndScore(secondaryQuery);
        const existingSet = new Set(mergedRanked.map((c) => c.id));
        for (const item of secondaryRanked) {
          if (!existingSet.has(item.id)) {
            existingSet.add(item.id);
            mergedRanked.push(item);
          }
        }
      }
      if (mergedRanked.length < 4 && plainQuery && plainQuery !== primaryQuery && plainQuery !== secondaryQuery) {
        const plainRanked = await fetchAndScore(plainQuery);
        const existingSet = new Set(mergedRanked.map((c) => c.id));
        for (const item of plainRanked) {
          if (!existingSet.has(item.id)) {
            existingSet.add(item.id);
            mergedRanked.push(item);
          }
        }
      }
    }

    for (const item of mergedRanked) {
      pushUniqueId(item.id);
      if (out.length >= 10) break;
    }

    const finalIds = out.slice(0, 10);
    if (finalIds.length > 0) {
      saveCandidatesToStorage(key, finalIds);
    }
    return finalIds;
  })().finally(() => {
    inFlightCandidateResolves.delete(key);
  });

  inFlightCandidateResolves.set(key, task);
  return task;
}

// Singleton in-viewport 200x200 invisible YouTube IFrame Player for full-track music playback in Cloud
let ytApiLoadPromise: Promise<void> | null = null;
let ytPlayerInitPromise: Promise<YtPlayerInstance | null> | null = null;
let ytPlayerInstance: YtPlayerInstance | null = null;
let ytPlayerReady = false;
let ytHostElement: HTMLDivElement | null = null;

let activeSeq = 0;
let activeTrack: SpotifyTrackItem | null = null;
let activeCallbacks: YoutubeMusicCallbacks | null = null;
let activeCandidates: string[] = [];
let activeCandidateIdx = 0;
let activeVolume01 = 0.85;
let activeMuted = false;
let shouldBePlaying = false;
let hasCandidateReachedPlaying = false;
let promotedForActiveSeq = false;
let progressTickerId: number | null = null;
let candidateNudgeTimer: number | null = null;
let candidateWatchdogTimer: number | null = null;
let lastLoadedAtMs = 0;

function stopProgressTicker(): void {
  if (progressTickerId !== null && typeof window !== 'undefined') {
    window.clearInterval(progressTickerId);
    progressTickerId = null;
  }
}

function clearCandidateTimers(): void {
  if (typeof window === 'undefined') return;
  if (candidateNudgeTimer !== null) {
    window.clearTimeout(candidateNudgeTimer);
    candidateNudgeTimer = null;
  }
  if (candidateWatchdogTimer !== null) {
    window.clearTimeout(candidateWatchdogTimer);
    candidateWatchdogTimer = null;
  }
}

function applyYtPlayerVolume(player: YtPlayerInstance | null): void {
  if (!player) return;
  try {
    player.setVolume(Math.round(Math.min(1, Math.max(0, activeVolume01)) * 100));
    if (activeMuted || activeVolume01 <= 0) {
      player.mute();
    } else {
      player.unMute();
    }
  } catch {
    // ignore player not ready errors
  }
}

function loadCandidateAtIndex(
  player: YtPlayerInstance,
  idx: number,
  startSeconds = 0,
  seq = activeSeq
): void {
  clearCandidateTimers();
  if (seq !== activeSeq || !activeCallbacks) {
    return;
  }
  if (idx >= activeCandidates.length) {
    stopProgressTicker();
    const cb = activeCallbacks;
    activeCallbacks = null;
    shouldBePlaying = false;
    cb?.onAllCandidatesFailed();
    return;
  }
  activeCandidateIdx = idx;
  hasCandidateReachedPlaying = false;
  promotedForActiveSeq = false;
  lastLoadedAtMs = Date.now();
  const safeStart = Math.max(0, Math.floor(startSeconds));
  try {
    applyYtPlayerVolume(player);
    player.loadVideoById({
      videoId: activeCandidates[idx],
      startSeconds: safeStart,
    });
    player.playVideo();

    if (typeof window !== 'undefined') {
      candidateNudgeTimer = window.setTimeout(() => {
        candidateNudgeTimer = null;
        if (seq !== activeSeq || !shouldBePlaying || hasCandidateReachedPlaying) {
          return;
        }
        try {
          const st = player.getPlayerState();
          if (st === -1 || st === 2 || st === 5) {
            applyYtPlayerVolume(player);
            player.playVideo();
          }
        } catch {
          // ignore transient state read error
        }
      }, 1300);

      candidateWatchdogTimer = window.setTimeout(() => {
        candidateWatchdogTimer = null;
        if (seq !== activeSeq || !shouldBePlaying || hasCandidateReachedPlaying) {
          return;
        }
        loadCandidateAtIndex(player, idx + 1, safeStart, seq);
      }, 5500);
    }
  } catch {
    loadCandidateAtIndex(player, idx + 1, safeStart, seq);
  }
}

function startProgressTicker(player: YtPlayerInstance, seq: number): void {
  stopProgressTicker();
  if (typeof window === 'undefined') return;
  const emitProgress = () => {
    if (seq !== activeSeq || !activeCallbacks) {
      stopProgressTicker();
      return;
    }
    try {
      const ct = Number(player.getCurrentTime() || 0);
      const rawDur = Number(player.getDuration() || 0);
      const expectedDur = activeTrack?.durationSec || 0;
      if (rawDur > 0 && rawDur < 45 && expectedDur >= 75 && Date.now() - lastLoadedAtMs > 1200) {
        loadCandidateAtIndex(player, activeCandidateIdx + 1, 0, seq);
        return;
      }
      if (rawDur >= 45 && hasCandidateReachedPlaying && !promotedForActiveSeq) {
        const curVid = activeCandidates[activeCandidateIdx];
        if (curVid) {
          promotedForActiveSeq = true;
          promoteWorkingCandidate(activeTrack, curVid);
        }
      }
      const effectiveDur = rawDur >= 45 ? rawDur : expectedDur || rawDur;
      activeCallbacks.onProgress(ct, effectiveDur);
    } catch {
      // ignore transient player read errors
    }
  };
  emitProgress();
  progressTickerId = window.setInterval(emitProgress, 500);
}

function ensureYoutubeIframeApiLoaded(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const win = window as YtWindow;
  if (win.YT && typeof win.YT.Player === 'function') {
    return Promise.resolve();
  }
  if (ytApiLoadPromise) return ytApiLoadPromise;

  ytApiLoadPromise = new Promise<void>((resolve) => {
    const prevReady = win.onYouTubeIframeAPIReady;
    win.onYouTubeIframeAPIReady = () => {
      try {
        prevReady?.();
      } catch {
        // ignore previous listener error
      }
      resolve();
    };
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src*="youtube.com/iframe_api"]'
    );
    if (!existingScript) {
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.onerror = () => resolve();
      document.head.appendChild(s);
    }
    window.setTimeout(resolve, 6000);
  });

  return ytApiLoadPromise;
}

function lockHostIframeFromFocus(): void {
  if (!ytHostElement) return;
  const iframe = ytHostElement.querySelector('iframe');
  if (iframe) {
    iframe.tabIndex = -1;
    iframe.setAttribute('aria-hidden', 'true');
  }
}

async function ensureYoutubePlayerReady(): Promise<YtPlayerInstance | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  if (ytPlayerInstance && ytPlayerReady) return ytPlayerInstance;
  if (ytPlayerInitPromise) return ytPlayerInitPromise;

  ytPlayerInitPromise = (async () => {
    await ensureYoutubeIframeApiLoaded();
    const win = window as YtWindow;
    if (!win.YT || typeof win.YT.Player !== 'function') {
      ytPlayerInitPromise = null;
      return null;
    }

    if (!ytHostElement || !ytHostElement.isConnected) {
      ytHostElement = document.createElement('div');
      ytHostElement.id = 'filmio-yt-music-engine-host';
      ytHostElement.tabIndex = -1;
      ytHostElement.setAttribute('aria-hidden', 'true');
      ytHostElement.style.cssText =
        'position:fixed;right:2px;bottom:2px;width:200px;height:200px;opacity:0.002;pointer-events:none;z-index:0;overflow:hidden;';
      document.body.appendChild(ytHostElement);
    }

    const innerId = 'filmio-yt-music-player-node';
    let innerNode = document.getElementById(innerId);
    if (!innerNode) {
      innerNode = document.createElement('div');
      innerNode.id = innerId;
      ytHostElement.appendChild(innerNode);
    }

    return new Promise<YtPlayerInstance | null>((resolve) => {
      let settled = false;
      const finish = (player: YtPlayerInstance | null) => {
        if (settled) return;
        settled = true;
        resolve(player);
      };

      const PlayerCtor = win.YT!.Player!;
      const player = new PlayerCtor(innerId, {
        width: '200',
        height: '200',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            ytPlayerInstance = player;
            ytPlayerReady = true;
            lockHostIframeFromFocus();
            applyYtPlayerVolume(player);
            finish(player);
          },
          onStateChange: (ev: { data?: number }) => {
            const state = ev?.data;
            const cb = activeCallbacks;
            if (!cb) return;
            const seqNow = activeSeq;
            if (state === 1) {
              if (!shouldBePlaying) {
                try {
                  player.pauseVideo();
                } catch {
                  // ignore pause errors
                }
                return;
              }
              hasCandidateReachedPlaying = true;
              clearCandidateTimers();
              applyYtPlayerVolume(player);
              try {
                const durNow = Number(player.getDuration() || 0);
                if (durNow >= 45 && !promotedForActiveSeq) {
                  const curVid = activeCandidates[activeCandidateIdx];
                  if (curVid) {
                    promotedForActiveSeq = true;
                    promoteWorkingCandidate(activeTrack, curVid);
                  }
                }
              } catch {
                // ignore duration read error
              }
              cb.onStateChange(true);
              startProgressTicker(player, seqNow);
            } else if (state === 2) {
              stopProgressTicker();
              if (!shouldBePlaying || hasCandidateReachedPlaying) {
                cb.onStateChange(false);
              }
            } else if (state === 0) {
              stopProgressTicker();
              clearCandidateTimers();
              const ct = Number(player.getCurrentTime() || 0);
              const expDur = activeTrack?.durationSec || 0;
              if (ct > 0 && ct < 42 && expDur >= 75 && activeCandidateIdx + 1 < activeCandidates.length) {
                loadCandidateAtIndex(player, activeCandidateIdx + 1, 0, seqNow);
                return;
              }
              shouldBePlaying = false;
              cb.onEnded();
            } else if (state === 3) {
              applyYtPlayerVolume(player);
            }
          },
          onError: () => {
            if (!activeCallbacks) return;
            clearCandidateTimers();
            loadCandidateAtIndex(player, activeCandidateIdx + 1, 0, activeSeq);
          },
        },
      });
      lockHostIframeFromFocus();

      window.setTimeout(() => {
        if (!settled) {
          ytPlayerInitPromise = null;
          finish(ytPlayerReady ? player : null);
        }
      }, 7000);
    });
  })();

  return ytPlayerInitPromise;
}

export function prewarmYoutubeMusicEngine(): void {
  if (typeof window === 'undefined') return;
  void ensureYoutubePlayerReady();
}

export async function playYoutubeMusicTrack(
  track: SpotifyTrackItem,
  callbacks: YoutubeMusicCallbacks,
  opts?: { startSec?: number }
): Promise<void> {
  const seq = ++activeSeq;
  activeTrack = track;
  activeCallbacks = callbacks;
  shouldBePlaying = true;
  hasCandidateReachedPlaying = false;
  promotedForActiveSeq = false;
  clearCandidateTimers();
  stopProgressTicker();

  if (ytPlayerInstance && ytPlayerReady) {
    applyYtPlayerVolume(ytPlayerInstance);
  }

  const [candidates, player] = await Promise.all([
    resolveTrackYoutubeCandidates(track),
    ensureYoutubePlayerReady(),
  ]);

  if (seq !== activeSeq || !activeCallbacks) {
    return;
  }

  activeCandidates = candidates;
  if (!player || candidates.length === 0) {
    activeCallbacks = null;
    shouldBePlaying = false;
    stopProgressTicker();
    callbacks.onAllCandidatesFailed();
    return;
  }

  loadCandidateAtIndex(player, 0, opts?.startSec || 0, seq);
}

export function pauseYoutubeMusicTrack(): void {
  shouldBePlaying = false;
  clearCandidateTimers();
  stopProgressTicker();
  try {
    ytPlayerInstance?.pauseVideo();
  } catch {
    // ignore
  }
}

export function resumeYoutubeMusicTrack(): void {
  shouldBePlaying = true;
  try {
    if (ytPlayerInstance && ytPlayerReady) {
      applyYtPlayerVolume(ytPlayerInstance);
      ytPlayerInstance.playVideo();
      if (activeCallbacks) {
        startProgressTicker(ytPlayerInstance, activeSeq);
      }
    }
  } catch {
    // ignore
  }
}

export function stopYoutubeMusicTrack(): void {
  activeSeq += 1;
  shouldBePlaying = false;
  hasCandidateReachedPlaying = false;
  promotedForActiveSeq = false;
  activeCallbacks = null;
  activeTrack = null;
  activeCandidates = [];
  activeCandidateIdx = 0;
  clearCandidateTimers();
  stopProgressTicker();
  try {
    ytPlayerInstance?.pauseVideo();
    ytPlayerInstance?.stopVideo();
  } catch {
    // ignore
  }
}

export function seekYoutubeMusicTrack(sec: number): void {
  try {
    ytPlayerInstance?.seekTo(Math.max(0, sec), true);
  } catch {
    // ignore
  }
}

export function setYoutubeMusicVolume(vol0to1: number, muted: boolean): void {
  activeVolume01 = Math.min(1, Math.max(0, Number.isFinite(vol0to1) ? vol0to1 : 0.85));
  activeMuted = Boolean(muted);
  applyYtPlayerVolume(ytPlayerInstance);
}
