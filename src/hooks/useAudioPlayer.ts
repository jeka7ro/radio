import { useEffect, useRef } from 'react';
import type Hls from 'hls.js';
import { useRadioStore } from '../store/useRadioStore';
import {
  isHlsStation,
  isInsecureHttpStream,
  registerStationClick,
  toHttpsStreamUrl,
} from '../services/radioBrowserApi';

export const MAX_AUTO_RETRIES = 2;

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const lastClickedUuidRef = useRef<string | null>(null);

  const currentStation = useRadioStore((state) => state.currentStation);
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

  // Initialize singleton Audio instance once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
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

  // Handle pause / resume when playerStatus is toggled by UI
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentStation) return;

    if (playerStatus === 'paused') {
      audio.pause();
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    }
  }, [playerStatus, currentStation]);

  // Load and play stream whenever currentStation or streamReloadToken changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentStation) return;

    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Register station play click once per unique station selection
    if (lastClickedUuidRef.current !== currentStation.stationuuid) {
      lastClickedUuidRef.current = currentStation.stationuuid;
      registerStationClick(currentStation.stationuuid);
    }

    let isCancelled = false;
    let localRetryCount = 0;

    const rawUrl = (currentStation.url_resolved || currentStation.url || '').trim();
    const isPageHttps =
      typeof window !== 'undefined' && window.location.protocol === 'https:';

    const getEffectiveStreamUrl = (attempt: number, forceHttps: boolean) => {
      if (
        (forceHttps || (isPageHttps && attempt > 0)) &&
        isInsecureHttpStream(rawUrl)
      ) {
        return toHttpsStreamUrl(rawUrl);
      }
      return rawUrl;
    };

    const scheduleRetryOrError = () => {
      if (isCancelled) return;
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
      setRetryAttempt(0);
      setPlayerStatus('playing');
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    };

    const handleWaiting = () => {
      if (isCancelled) return;
      setPlayerStatus('loading');
    };

    const handleError = () => {
      if (isCancelled) return;
      scheduleRetryOrError();
    };

    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('error', handleError);

    const startPlayback = async (streamUrl: string) => {
      if (isCancelled) return;

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      audio.pause();
      audio.removeAttribute('src');
      audio.load();

      const useHls = isHlsStation(currentStation, streamUrl);

      if (useHls) {
        try {
          const { default: HlsLib } = await import('hls.js');
          if (isCancelled) return;

          if (HlsLib.isSupported()) {
            const hls = new HlsLib({
              enableWorker: true,
              lowLatencyMode: true,
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
                  const text = new TextDecoder('utf-8')
                    .decode(sample.data)
                    .replace(/[^\x20-\x7E\u00A0-\u024F\u0400-\u04FF]/g, ' ')
                    .trim();
                  if (text && text.length > 3) {
                    const sliced = text.slice(0, 120);
                    setNowPlayingTitle(sliced);
                    void fetch(
                      `/api/radio-meta?rawTitle=${encodeURIComponent(
                        sliced
                      )}&name=${encodeURIComponent(currentStation.name)}`
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
                      .catch(() => {});
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
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('error', handleError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStation, streamReloadToken]);

  // Poll live ICY / Icecast metadata & Deezer/iTunes cover + artist avatar while playing
  useEffect(() => {
    if (!currentStation || (playerStatus !== 'playing' && playerStatus !== 'loading')) {
      return;
    }

    const streamUrl = (currentStation.url_resolved || currentStation.url || '').trim();
    if (!streamUrl) return;

    let cancelled = false;

    const fetchMetadata = async () => {
      try {
        const res = await fetch(
          `/api/radio-meta?url=${encodeURIComponent(
            streamUrl
          )}&name=${encodeURIComponent(currentStation.name)}`
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (data?.track) {
          setNowPlayingMeta(data.track);
          setNowPlayingTitle(
            data.track.artist
              ? `${data.track.artist} — ${data.track.title}`
              : data.track.title
          );
        }
      } catch {
        // Ignore transient metadata polling errors
      }
    };

    void fetchMetadata();
    const intervalId = window.setInterval(fetchMetadata, 18000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [currentStation, playerStatus, setNowPlayingMeta, setNowPlayingTitle]);

  // Configure Media Session API for lock-screen and headset controls
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    if (!currentStation) {
      navigator.mediaSession.metadata = null;
      return;
    }

    const artworkUrl =
      nowPlayingMeta?.coverUrl ||
      nowPlayingMeta?.artistAvatarUrl ||
      currentStation.favicon ||
      '/icons/icon-192.svg';
    const tagsSubtitle = currentStation.tags
      ? currentStation.tags
          .split(',')
          .slice(0, 3)
          .map((t) => t.trim())
          .filter(Boolean)
          .join(' • ')
      : currentStation.country || 'AetherRadio Live';

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: nowPlayingMeta?.title || currentStation.name,
        artist:
          nowPlayingMeta?.artist ||
          (nowPlayingMeta?.title ? currentStation.name : tagsSubtitle || 'AetherRadio'),
        album: nowPlayingMeta?.album || currentStation.name || 'Live Radio',
        artwork: [
          { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' },
          { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
        ],
      });

      navigator.mediaSession.setActionHandler('play', () => {
        const state = useRadioStore.getState();
        if (state.currentStation) {
          state.triggerStreamReload();
        }
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        useRadioStore.getState().setPlayerStatus('paused');
      });

      navigator.mediaSession.setActionHandler('stop', () => {
        useRadioStore.getState().setPlayerStatus('paused');
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        playNextAvailableStation();
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        playPreviousStation();
      });
    } catch {
      // Ignore unsupported MediaSession handlers on older browsers
    }
  }, [currentStation, nowPlayingMeta, playNextAvailableStation, playPreviousStation]);
}
