import { useEffect, useRef } from 'react';
import type Hls from 'hls.js';
import { useRadioStore } from '../store/useRadioStore';
import {
  isHlsStation,
  isInsecureHttpStream,
  registerStationClick,
  toHttpsStreamUrl,
} from '../services/radioBrowserApi';
import { isDirectLocalHost } from '../services/deviceContinuityService';
import {
  extractTextFromHlsId3Sample,
  parseRawStreamMetadata,
} from '../utils/cleanTrackMetadata';
import {
  claimMediaSession,
  releaseMediaSession,
  updateMediaSessionPlaybackState,
} from '../utils/mediaSessionManager';

export const MAX_AUTO_RETRIES = 2;
const MAX_SESSION_RECOVERIES = 3;
const STABLE_PLAYBACK_RESET_MS = 20_000;

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const lastClickedUuidRef = useRef<string | null>(null);

  const currentStation = useRadioStore((state) => state.currentStation);
  const currentStationRef = useRef(currentStation);
  currentStationRef.current = currentStation;
  const playerStatus = useRadioStore((state) => state.playerStatus);
  const volume = useRadioStore((state) => state.volume);
  const isMuted = useRadioStore((state) => state.isMuted);
  const usingHttpsUpgrade = useRadioStore((state) => state.usingHttpsUpgrade);
  const streamReloadToken = useRadioStore((state) => state.streamReloadToken);
  const nowPlayingMeta = useRadioStore((state) => state.nowPlayingMeta);

  const setPlayerStatus = useRadioStore((state) => state.setPlayerStatus);
  const setRetryAttempt = useRadioStore((state) => state.setRetryAttempt);
  const setNowPlayingTitle = useRadioStore((state) => state.setNowPlayingTitle);
  const setNowPlayingMeta = useRadioStore((state) => state.setNowPlayingMeta);
  const setUsingHttpsUpgrade = useRadioStore((state) => state.setUsingHttpsUpgrade);
  const playNextAvailableStation = useRadioStore((state) => state.playNextAvailableStation);
  const playPreviousStation = useRadioStore((state) => state.playPreviousStation);

  const normalizedStationRawUrl = currentStation
    ? (currentStation.url_resolved || currentStation.url || '')
        .trim()
        .replace(/\/\/live7digi\.antenaplay\.ro\//gi, '//live4ro.antenaplay.ro/')
    : '';
  const stationPlaybackKey = currentStation
    ? `${currentStation.stationuuid}::${normalizedStationRawUrl}`
    : '';

  // Initialize singleton Audio instance once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    try {
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      audio.setAttribute('x-webkit-airplay', 'allow');
    } catch {
      // ignore
    }
    audioRef.current = audio;

    return () => {
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Sync volume & mute state with HTMLAudioElement
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
    audio.muted = isMuted;
  }, [volume, isMuted]);

  // Handle pause / stop / idle when playerStatus or currentStation is updated by UI
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentStation || playerStatus === 'idle' || playerStatus === 'paused') {
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      audio.pause();
      if (!currentStation || playerStatus === 'idle') {
        audio.removeAttribute('src');
        audio.load();
      }
      updateMediaSessionPlaybackState(
        'radio',
        playerStatus === 'paused' ? 'paused' : 'none'
      );
    }
  }, [playerStatus, currentStation]);

  // Load and play stream whenever active station key or explicit streamReloadToken changes
  useEffect(() => {
    const audio = audioRef.current;
    const station = currentStationRef.current;
    if (!audio || !station || !stationPlaybackKey) return;

    const currentStatusSnapshot = useRadioStore.getState().playerStatus;
    if (currentStatusSnapshot === 'paused' || currentStatusSnapshot === 'idle') {
      return;
    }

    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Register station play click once per unique station selection
    if (lastClickedUuidRef.current !== station.stationuuid) {
      lastClickedUuidRef.current = station.stationuuid;
      registerStationClick(station.stationuuid);
    }

    let isCancelled = false;
    let localRetryCount = 0;
    let playingSinceMs = 0;
    let sessionRecoveries = 0;

    const rawUrl = normalizedStationRawUrl;
    const isPageHttps =
      typeof window !== 'undefined' && window.location.protocol === 'https:';
    const isLocalNodeProxy = isDirectLocalHost();

    const buildAudioProxyUrl = (
      target: string,
      withSkipAd: boolean,
      cacheBust = false
    ) =>
      `/api/tv-proxy?url=${encodeURIComponent(target)}${
        withSkipAd ? '&skipAd=1' : ''
      }${cacheBust ? `&_nc=${Date.now()}` : ''}`;

    const getEffectiveStreamUrl = (attempt: number, forceHttps: boolean) => {
      // On local Node/LAN server, use local proxy with 2x preroll ad-skipper & unlimited TCP pipe
      if (isLocalNodeProxy) {
        if (attempt === 0) {
          return buildAudioProxyUrl(rawUrl, true);
        }
        if (attempt === 1) {
          if (
            (forceHttps || isPageHttps) &&
            isInsecureHttpStream(rawUrl)
          ) {
            return toHttpsStreamUrl(rawUrl);
          }
          return rawUrl;
        }
        return isInsecureHttpStream(rawUrl)
          ? buildAudioProxyUrl(toHttpsStreamUrl(rawUrl), true)
          : buildAudioProxyUrl(rawUrl, true);
      }

      // On Cloud (Netlify Serverless / filmio.my): play HTTPS radio streams DIRECTLY so they never
      // hit Netlify Function timeouts, 302 query mutation, or Edge CDN caching.
      if (!isInsecureHttpStream(rawUrl)) {
        if (attempt === 0) {
          return rawUrl;
        }
        if (attempt === 1) {
          return isHlsStation(station, rawUrl)
            ? buildAudioProxyUrl(rawUrl, false)
            : rawUrl;
        }
        return buildAudioProxyUrl(rawUrl, false, true);
      }

      // HTTP-only station on HTTPS cloud page: try direct HTTPS upgrade first, then cache-busted no-store proxy
      if (attempt === 0) {
        return forceHttps || isPageHttps ? toHttpsStreamUrl(rawUrl) : rawUrl;
      }
      return buildAudioProxyUrl(rawUrl, false, true);
    };

    const scheduleRetryOrError = () => {
      if (isCancelled) return;
      if (
        playingSinceMs > 0 &&
        Date.now() - playingSinceMs >= STABLE_PLAYBACK_RESET_MS &&
        sessionRecoveries < MAX_SESSION_RECOVERIES
      ) {
        playingSinceMs = 0;
        localRetryCount = 0;
        sessionRecoveries += 1;
      }
      if (localRetryCount < MAX_AUTO_RETRIES) {
        localRetryCount += 1;
        setRetryAttempt(localRetryCount);
        setPlayerStatus('loading');

        // If original stream is HTTP, try upgrading to HTTPS on retry
        const shouldTryHttps =
          usingHttpsUpgrade || isInsecureHttpStream(rawUrl);
        if (shouldTryHttps && isInsecureHttpStream(rawUrl)) {
          setUsingHttpsUpgrade(true);
        }

        retryTimerRef.current = window.setTimeout(() => {
          if (!isCancelled) {
            startPlayback(
              getEffectiveStreamUrl(localRetryCount, shouldTryHttps)
            );
          }
        }, 1200 * localRetryCount);
      } else {
        setRetryAttempt(0);
        setPlayerStatus('error');
      }
    };

    const handlePlaying = () => {
      if (isCancelled) return;
      if (playingSinceMs === 0) {
        playingSinceMs = Date.now();
      }
      setRetryAttempt(0);
      setPlayerStatus('playing');
      updateMediaSessionPlaybackState('radio', 'playing');
    };

    const handleWaiting = () => {
      if (isCancelled) return;
      if (playingSinceMs === 0) {
        setPlayerStatus('loading');
      }
    };

    const handleError = () => {
      if (isCancelled) return;
      scheduleRetryOrError();
    };

    const handleEnded = () => {
      if (isCancelled) return;
      scheduleRetryOrError();
    };

    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);

    const startPlayback = async (streamUrl: string) => {
      if (isCancelled) return;

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      audio.pause();
      audio.removeAttribute('src');
      audio.load();

      const useHls = isHlsStation(station, streamUrl);
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
      const preferNativeAppleHls =
        Boolean(audio.canPlayType('application/vnd.apple.mpegurl')) &&
        /Safari/i.test(ua) &&
        !/Chrome|Chromium|Edg|OPR|Android/i.test(ua);

      if (useHls && !preferNativeAppleHls) {
        try {
          const { default: HlsLib } = await import('hls.js');
          if (isCancelled) return;

          if (HlsLib.isSupported()) {
            const hls = new HlsLib({
              enableWorker: true,
              lowLatencyMode: false,
              liveSyncDurationCount: 3,
              liveMaxLatencyDurationCount: 8,
              backBufferLength: 30,
            });
            hlsRef.current = hls;

            hls.loadSource(streamUrl);
            hls.attachMedia(audio);

            hls.on(HlsLib.Events.MANIFEST_PARSED, () => {
              if (isCancelled) return;
              audio.play().catch(() => {
                scheduleRetryOrError();
              });
            });

            // Listen for ID3 / ICY metadata embedded in HLS stream
            hls.on(HlsLib.Events.FRAG_PARSING_METADATA, (_event, data) => {
              if (isCancelled || !data?.samples) return;
              try {
                for (const sample of data.samples) {
                  const extracted = extractTextFromHlsId3Sample(sample.data);
                  if (extracted) {
                    const parsedLocal = parseRawStreamMetadata(
                      extracted,
                      station.name
                    );
                    if (parsedLocal && parsedLocal.title) {
                      setNowPlayingTitle(
                        parsedLocal.artist
                          ? `${parsedLocal.artist} — ${parsedLocal.title}`
                          : parsedLocal.title
                      );
                    }
                    void fetch(
                      `/api/radio-meta?rawTitle=${encodeURIComponent(
                        extracted
                      )}&name=${encodeURIComponent(station.name)}`
                    )
                      .then((r) => (r.ok ? r.json() : null))
                      .then((json) => {
                        if (!isCancelled && json?.track) {
                          setNowPlayingMeta(json.track);
                          setNowPlayingTitle(
                            json.track.artist
                              ? `${json.track.artist} — ${json.track.title}`
                              : json.track.title
                          );
                        }
                      })
                      .catch(() => { });
                  }
                }
              } catch {
                // Ignore metadata decoding issues
              }
            });

            hls.on(HlsLib.Events.ERROR, (_event, data) => {
              if (isCancelled) return;
              if (data.fatal) {
                switch (data.type) {
                  case HlsLib.ErrorTypes.NETWORK_ERROR:
                    scheduleRetryOrError();
                    break;
                  case HlsLib.ErrorTypes.MEDIA_ERROR:
                    hls.recoverMediaError();
                    break;
                  default:
                    scheduleRetryOrError();
                    break;
                }
              }
            });
            return;
          }
        } catch {
          // Fall through to native audio playback (e.g. Safari native HLS)
        }
      }

      audio.src = streamUrl;
      audio.play().catch(() => {
        scheduleRetryOrError();
      });
    };

    const initialUrl = getEffectiveStreamUrl(0, usingHttpsUpgrade);
    startPlayback(initialUrl);

    return () => {
      isCancelled = true;
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      audio.pause();
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationPlaybackKey, streamReloadToken]);

  // Poll live ICY / Icecast metadata & Deezer/iTunes cover + artist avatar only while station is actively playing/loading
  useEffect(() => {
    if (!currentStation || (playerStatus !== 'playing' && playerStatus !== 'loading')) {
      return;
    }

    const streamUrl = (currentStation.url_resolved || currentStation.url || '').trim();
    if (!streamUrl) return;

    let cancelled = false;
    let quickRetryTimer: number | null = null;
    let lastMetaFetchAt = 0;

    const fetchMetadata = async (isQuickRetry = false, force = false) => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      const now = Date.now();
      if (!force && !isQuickRetry && now - lastMetaFetchAt < 15_000) {
        return;
      }
      lastMetaFetchAt = now;
      try {
        const res = await fetch(
          `/api/radio-meta?url=${encodeURIComponent(
            streamUrl
          )}&name=${encodeURIComponent(currentStation.name)}&_t=${Date.now()}`
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (data?.track) {
          const prevRaw = useRadioStore.getState().nowPlayingMeta?.rawTitle || '';
          const nextRaw = String(data.track.rawTitle || '');
          const prevDates = prevRaw.match(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\b/g);
          const nextDates = nextRaw.match(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\b/g);
          const prevMaxIso = prevDates ? prevDates[prevDates.length - 1] : '';
          const nextMaxIso = nextDates ? nextDates[nextDates.length - 1] : '';
          if (prevMaxIso && nextMaxIso && nextMaxIso < prevMaxIso) {
            return;
          }
          setNowPlayingMeta(data.track);
          setNowPlayingTitle(
            data.track.artist
              ? `${data.track.artist} — ${data.track.title}`
              : data.track.title
          );
        } else if (!isQuickRetry && !useRadioStore.getState().nowPlayingMeta) {
          quickRetryTimer = window.setTimeout(() => {
            if (!cancelled) void fetchMetadata(true, true);
          }, 2500);
        }
      } catch {
        // Ignore transient metadata polling errors
      }
    };

    void fetchMetadata(false, true);
    const intervalId = window.setInterval(() => void fetchMetadata(false, false), 30_000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void fetchMetadata(false, false);
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      cancelled = true;
      if (quickRetryTimer) {
        window.clearTimeout(quickRetryTimer);
      }
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [currentStation, playerStatus, setNowPlayingMeta, setNowPlayingTitle]);

  // Configure Media Session API for Apple CarPlay, steering-wheel, lock-screen and headset controls
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    if (!currentStation) {
      releaseMediaSession('radio');
      return;
    }

    const artworkUrl =
      nowPlayingMeta?.coverUrl ||
      nowPlayingMeta?.artistAvatarUrl ||
      currentStation.favicon ||
      '/apple-touch-icon.png';
    const tagsSubtitle = currentStation.tags
      ? currentStation.tags
        .split(',')
        .slice(0, 3)
        .map((t) => t.trim())
        .filter(Boolean)
        .join(' • ')
      : currentStation.country || 'Filmio Radio Live';

    claimMediaSession(
      'radio',
      {
        title: nowPlayingMeta?.title || currentStation.name,
        artist:
          nowPlayingMeta?.artist ||
          (nowPlayingMeta?.title ? currentStation.name : tagsSubtitle || 'Filmio Radio'),
        album: nowPlayingMeta?.album || currentStation.name || 'Filmio Radio Live',
        artworkUrl,
      },
      {
        onPlay: () => {
          const handledByTvHome =
            typeof window !== 'undefined' &&
            !window.dispatchEvent(
              new CustomEvent('aether:tv-home-play-request', { cancelable: true })
            );
          if (handledByTvHome) {
            return;
          }
          const state = useRadioStore.getState();
          if (
            typeof document !== 'undefined' &&
            document.documentElement.classList.contains('smart-tv-mode') &&
            state.playerStatus !== 'playing'
          ) {
            return;
          }
          if (state.currentStation) {
            if (
              state.playerStatus === 'playing' ||
              state.playerStatus === 'loading'
            ) {
              const el = audioRef.current;
              if (el && el.paused && el.src) {
                el.play().catch(() => { });
              }
              return;
            }
            state.triggerStreamReload();
          }
        },
        onPause: () => {
          useRadioStore.getState().setPlayerStatus('paused');
        },
        onStop: () => {
          useRadioStore.getState().setPlayerStatus('paused');
        },
        onNext: () => {
          playNextAvailableStation();
        },
        onPrev: () => {
          playPreviousStation();
        },
        onSeekBackward: null,
        onSeekForward: null,
        onSeekTo: null,
      }
    );
    updateMediaSessionPlaybackState(
      'radio',
      playerStatus === 'playing' || playerStatus === 'loading'
        ? 'playing'
        : 'paused'
    );
  }, [
    currentStation,
    nowPlayingMeta,
    playerStatus,
    playNextAvailableStation,
    playPreviousStation,
  ]);
}
