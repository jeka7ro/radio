import React, { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import * as dashjs from 'dashjs';
import {
  Languages,
  Loader2,
  AlertCircle,
  SlidersHorizontal,
  VolumeX,
  Subtitles,
  Check,
  Search,
  Type,
  Clock,
} from 'lucide-react';
import {
  OfflineMediaItem,
  createOfflineAwareHlsLoader,
  getBlobChunk,
} from '../../services/offlineMediaService';
import {
  SubtitleCue,
  OnlineSubtitleTrack,
  fetchOnlineSubtitlesByImdb,
  downloadSubtitleAsVttBlobUrl,
  findPreferredOriginalAudioTrackIndex,
} from '../../services/subtitleSearchService';

export type TvSubFontSize = 'normal' | 'large' | 'xlarge';
export type TvPreferredQuality = 'max' | '1080' | '720' | '480' | 'auto';

function normalizeVideoQualityHeight(width = 0, height = 0): number {
  if (width >= 3200 || height >= 1800) return 2160;
  if (width >= 2200 || height >= 1300) return 1440;
  if (width >= 1600 || height >= 950) return 1080;
  if (width >= 1100 || height >= 650) return 720;
  if (width >= 760 || height >= 440) return 480;
  if (width >= 560 || height >= 320) return 360;
  return height || 240;
}

function pickQualityLevelByPreference(
  sortedLevels: Array<{ index: number; height: number }>,
  pref: TvPreferredQuality = 'max'
): number {
  if (sortedLevels.length === 0) return -1;
  if (pref === 'auto') return -1;
  if (pref === 'max') return sortedLevels[0].index;
  const targetH = Number(pref) || 1080;
  const match =
    sortedLevels.find((l) => l.height <= targetH) || sortedLevels[0];
  return match.index;
}

interface VodNativeHlsPlayerProps {
  dashUrl?: string;
  hlsUrl?: string;
  offlineItem?: OfflineMediaItem | null;
  audioTrackLabels?: string[];
  initialAudioTrackIndex?: number;
  preferredQuality?: TvPreferredQuality;
  initialSubFontSize?: TvSubFontSize;
  startAtSeconds?: number;
  poster?: string;
  imdbId?: string;
  mediaType?: 'movie' | 'series';
  season?: number;
  episode?: number;
  preferredSubLang?: string;
  subtitleVttUrl?: string | null;
  subtitleLabel?: string;
  subtitleCues?: SubtitleCue[];
  onApplyAutoSubtitle?: (payload: {
    vttBlobUrl: string;
    label: string;
    cues: SubtitleCue[];
  }) => void;
  onOpenSubtitleFinder?: () => void;
  onClearSubtitle?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onStreamError?: () => void;
  isOsdVisible?: boolean;
}

const QUICK_SUB_LANGS = [
  { code: 'ro', flag: '🇷🇴', label: 'Română' },
  { code: 'ru', flag: '🇷🇺', label: 'Русский' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
];

export const VodNativeHlsPlayer: React.FC<VodNativeHlsPlayerProps> = ({
  dashUrl,
  hlsUrl,
  offlineItem,
  audioTrackLabels = [],
  initialAudioTrackIndex,
  preferredQuality = 'max',
  initialSubFontSize,
  startAtSeconds = 0,
  poster,
  imdbId,
  mediaType = 'movie',
  season = 1,
  episode = 1,
  preferredSubLang = 'ro',
  subtitleVttUrl,
  subtitleLabel,
  subtitleCues = [],
  onApplyAutoSubtitle,
  onOpenSubtitleFinder,
  onClearSubtitle,
  onTimeUpdate,
  onStreamError,
  isOsdVisible = true,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const dashRef = useRef<dashjs.MediaPlayerClass | null>(null);
  const highestLevelIndexRef = useRef<number>(-1);
  const appliedStartRef = useRef<boolean>(false);

  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>(
    'loading'
  );
  const [isAutoMuted, setIsAutoMuted] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [subOffsetSec, setSubOffsetSec] = useState<number>(0);
  const [subFontSize, setSubFontSize] = useState<TvSubFontSize>(() => {
    if (initialSubFontSize) return initialSubFontSize;
    try {
      const saved = localStorage.getItem('aether_tv_sub_font_size');
      if (saved === 'normal' || saved === 'large' || saved === 'xlarge') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'large';
  });

  useEffect(() => {
    if (initialSubFontSize) {
      setSubFontSize(initialSubFontSize);
    }
  }, [initialSubFontSize]);

  // Lampa-style in-player quick menus
  const [openMenu, setOpenMenu] = useState<'none' | 'subtitles' | 'audio'>(
    'none'
  );
  const [availableSubs, setAvailableSubs] = useState<OnlineSubtitleTrack[]>([]);
  const [isLoadingSubsList, setIsLoadingSubsList] = useState<boolean>(false);
  const [loadingSubTrackId, setLoadingSubTrackId] = useState<string | null>(
    null
  );
  const [activeSubTrackId, setActiveSubTrackId] = useState<string | null>(null);
  const [seekToast, setSeekToast] = useState<string | null>(null);
  const seekToastTimerRef = useRef<number | null>(null);

  const [audioTracks, setAudioTracks] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [activeAudioTrack, setActiveAudioTrack] = useState<number>(0);
  const [qualityLevels, setQualityLevels] = useState<
    Array<{ index: number; height: number }>
  >([]);
  const [activeQuality, setActiveQuality] = useState<number>(-1);

  const ensureAutoPlay = (video: HTMLVideoElement) => {
    video
      .play()
      .then(() => {
        setStatus('playing');
      })
      .catch(() => {
        // Fallback: if browser blocks unmuted autoplay, mute and play immediately
        video.muted = true;
        setIsAutoMuted(true);
        video
          .play()
          .then(() => {
            setStatus('playing');
          })
          .catch(() => {
            // Wait for user gesture
          });
      });
  };

  // Fetch available subtitles automatically in the background (Lampa style) & auto-enable RO or RU by default
  useEffect(() => {
    if (!imdbId || !imdbId.startsWith('tt')) {
      setAvailableSubs([]);
      return;
    }

    let cancelled = false;
    setIsLoadingSubsList(true);
    setActiveSubTrackId(null);

    fetchOnlineSubtitlesByImdb({
      imdbId,
      type: mediaType,
      season,
      episode,
    })
      .then(async (list) => {
        if (cancelled) return;
        setAvailableSubs(list);

        // Automatically activate subtitle by default according to preferredSubLang ('ro' | 'ru' | 'en' | 'off')
        const alreadyHasSub =
          Boolean(subtitleVttUrl) || (subtitleCues && subtitleCues.length > 0);
        if (
          preferredSubLang !== 'off' &&
          !alreadyHasSub &&
          list.length > 0 &&
          onApplyAutoSubtitle
        ) {
          const prefOrder =
            preferredSubLang === 'ru'
              ? ['ru', 'ro', 'en']
              : preferredSubLang === 'en'
                ? ['en', 'ro', 'ru']
                : ['ro', 'ru', 'en'];
          let autoTrack: OnlineSubtitleTrack | undefined;
          for (const code of prefOrder) {
            autoTrack = list.find((t) => t.langCode2 === code);
            if (autoTrack) break;
          }
          if (autoTrack) {
            try {
              const { vttBlobUrl, cues } = await downloadSubtitleAsVttBlobUrl(
                autoTrack.url
              );
              if (!cancelled && cues.length > 0) {
                setActiveSubTrackId(autoTrack.id);
                onApplyAutoSubtitle({
                  vttBlobUrl,
                  label: autoTrack.langLabel,
                  cues,
                });
              }
            } catch {
              // ignore
            }
          }
        }
      })
      .catch(() => {
        if (!cancelled) setAvailableSubs([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSubsList(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imdbId, mediaType, season, episode]);

  const handleSelectQuickSubTrack = async (track: OnlineSubtitleTrack) => {
    setLoadingSubTrackId(track.id);
    try {
      const { vttBlobUrl, cues } = await downloadSubtitleAsVttBlobUrl(
        track.url
      );
      setActiveSubTrackId(track.id);
      onApplyAutoSubtitle?.({
        vttBlobUrl,
        label: track.langLabel,
        cues,
      });
      setOpenMenu('none');
      const video = videoRef.current;
      if (video && video.paused) {
        ensureAutoPlay(video);
      }
    } catch {
      // ignore
    } finally {
      setLoadingSubTrackId(null);
    }
  };

  // Group available subtitles by language code (top 3 per language for clean TV UI)
  const subsByLang = useMemo(() => {
    const map: Record<string, OnlineSubtitleTrack[]> = {};
    for (const s of availableSubs) {
      if (!map[s.langCode2]) map[s.langCode2] = [];
      if (map[s.langCode2].length < 4) {
        map[s.langCode2].push(s);
      }
    }
    return map;
  }, [availableSubs]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    appliedStartRef.current = false;
    setStatus('loading');
    setIsAutoMuted(false);
    setAudioTracks([]);
    setQualityLevels([]);
    setActiveQuality(-1);

    let objectUrlToRevoke: string | null = null;
    let cancelled = false;

    const cleanup = () => {
      if (dashRef.current) {
        try {
          dashRef.current.destroy();
        } catch {
          // ignore
        }
        dashRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
        objectUrlToRevoke = null;
      }
    };

    const applyInitialSeek = () => {
      if (
        !appliedStartRef.current &&
        startAtSeconds > 5 &&
        video &&
        Number.isFinite(video.duration) &&
        startAtSeconds < video.duration - 15
      ) {
        appliedStartRef.current = true;
        video.currentTime = startAtSeconds;
      }
    };

    const startHlsPlayback = (targetUrl: string) => {
      if (!targetUrl) {
        setStatus('error');
        return;
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
          loader: createOfflineAwareHlsLoader(),
          enableWorker: true,
          capLevelToPlayerSize: false,
          startPosition: startAtSeconds > 5 ? startAtSeconds : -1,
          maxBufferLength: 45,
          maxMaxBufferLength: 90,
        });
        hlsRef.current = hls;

        hls.loadSource(targetUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (_ev, data) => {
          if (cancelled) return;
          appliedStartRef.current = true;

          // Filter out duplicate failover-audio levels so audio0 track switches never drop video quality
          const hasPrimaryLevels = data.levels.some(
            (l) =>
              !String(
                (l as { attrs?: Record<string, string> }).attrs?.AUDIO || ''
              ).startsWith('failover-')
          );

          const bestByHeight = new Map<
            number,
            { index: number; height: number; bitrate: number }
          >();
          data.levels.forEach((lvl, idx) => {
            const audioGroup = String(
              (lvl as { attrs?: Record<string, string> }).attrs?.AUDIO || ''
            );
            if (hasPrimaryLevels && audioGroup.startsWith('failover-')) return;
            const normH = normalizeVideoQualityHeight(lvl.width, lvl.height);
            if (!normH) return;
            const prev = bestByHeight.get(normH);
            if (!prev || (lvl.bitrate || 0) > prev.bitrate) {
              bestByHeight.set(normH, {
                index: idx,
                height: normH,
                bitrate: lvl.bitrate || 0,
              });
            }
          });
          const sortedLevels = Array.from(bestByHeight.values())
            .sort((a, b) => b.height - a.height || b.bitrate - a.bitrate)
            .map(({ index, height }) => ({ index, height }));

          setQualityLevels(sortedLevels);

          // Select quality according to user's preferredQuality ('max' = 4K/1080p, '1080', '720', '480', or 'auto')
          if (sortedLevels.length > 0) {
            const targetIdx = pickQualityLevelByPreference(
              sortedLevels,
              preferredQuality
            );
            highestLevelIndexRef.current = targetIdx;
            hls.currentLevel = targetIdx;
            if (targetIdx >= 0) {
              hls.nextLevel = targetIdx;
              hls.loadLevel = targetIdx;
            }
            setActiveQuality(targetIdx);
          }

          ensureAutoPlay(video);
          setStatus('playing');
        });

        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_ev, data) => {
          if (cancelled) return;
          const nonFailover = data.audioTracks.filter(
            (t) => !t.groupId?.startsWith('failover-')
          );
          const list = (
            nonFailover.length > 0 ? nonFailover : data.audioTracks
          ).map((trk, idx) => ({
            id: trk.id,
            name:
              audioTrackLabels[idx] ||
              (trk.name && trk.name !== 'default'
                ? trk.name
                : `Pista Audio ${idx + 1} (${(trk.lang || 'ORIG').toUpperCase()})`),
          }));
          setAudioTracks(list);

          // Default to Original Language audio track (or explicit initialAudioTrackIndex if valid)
          const autoOrigIdx = findPreferredOriginalAudioTrackIndex(
            list.map((x) => x.name)
          );
          const targetIdx =
            typeof initialAudioTrackIndex === 'number' &&
            initialAudioTrackIndex >= 0 &&
            initialAudioTrackIndex < list.length
              ? initialAudioTrackIndex
              : autoOrigIdx;

          if (list[targetIdx]) {
            hls.audioTrack = list[targetIdx].id;
            setActiveAudioTrack(list[targetIdx].id);
          } else {
            setActiveAudioTrack(hls.audioTrack >= 0 ? hls.audioTrack : 0);
          }

          // Re-lock highest video level after switching audio track so hls.js never resets to 270p/360p
          if (highestLevelIndexRef.current >= 0) {
            hls.currentLevel = highestLevelIndexRef.current;
            hls.nextLevel = highestLevelIndexRef.current;
            hls.loadLevel = highestLevelIndexRef.current;
          }
        });

        hls.on(Hls.Events.ERROR, (_ev, data) => {
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            } else {
              setStatus('error');
              onStreamError?.();
            }
          }
        });
      } else if (
        !offlineItem &&
        video.canPlayType('application/vnd.apple.mpegurl')
      ) {
        video.src = targetUrl;
        video.onloadedmetadata = () => {
          applyInitialSeek();
          ensureAutoPlay(video);
          setStatus('playing');
        };
      } else {
        setStatus('error');
      }
    };

    const init = async () => {
      cleanup();
      highestLevelIndexRef.current = -1;

      // Case 1: Offline Blob file (.mp4 / .mkv / .webm)
      if (offlineItem && offlineItem.mediaType === 'blob') {
        const chunk = await getBlobChunk(`${offlineItem.id}::file`);
        if (cancelled) return;
        if (!chunk) {
          setStatus('error');
          return;
        }
        const blob =
          chunk instanceof Blob
            ? chunk
            : new Blob([chunk], { type: offlineItem.mimeType || 'video/mp4' });
        objectUrlToRevoke = URL.createObjectURL(blob);
        video.src = objectUrlToRevoke;
        video.onloadedmetadata = () => {
          applyInitialSeek();
          ensureAutoPlay(video);
          setStatus('playing');
        };
        return;
      }

      // Case 2: Online 1080p Full HD DASH (.mpd) stream (contains 1920x1080 / 1920x800 up to 25 Mbps!)
      const canPlayDashWebm =
        !offlineItem &&
        Boolean(dashUrl) &&
        typeof window !== 'undefined' &&
        typeof window.MediaSource !== 'undefined' &&
        typeof window.MediaSource.isTypeSupported === 'function' &&
        window.MediaSource.isTypeSupported(
          'video/webm; codecs="vp09.00.40.08"'
        ) &&
        window.MediaSource.isTypeSupported('audio/webm; codecs="opus"');

      if (canPlayDashWebm && dashUrl) {
        try {
          const dashPlayer = dashjs.MediaPlayer().create();
          dashRef.current = dashPlayer;

          dashPlayer.updateSettings({
            debug: {
              logLevel: dashjs.Debug.LOG_LEVEL_NONE,
            },
            streaming: {
              abr: {
                autoSwitchBitrate: { video: false, audio: false },
                initialBitrate: { video: 50000, audio: 500 },
              },
              buffer: {
                bufferTimeAtTopQuality: 60,
                bufferTimeAtTopQualityLongForm: 90,
                fastSwitchEnabled: true,
              },
              trackSwitchMode: {
                audio: 'alwaysReplace',
                video: 'alwaysReplace',
              },
              selectionModeForInitialTrack: 'highestBitrate',
            },
          });

          dashPlayer.initialize(
            video,
            dashUrl,
            true,
            startAtSeconds > 5 ? startAtSeconds : 0
          );

          dashPlayer.on(
            dashjs.MediaPlayer.events.STREAM_INITIALIZED,
            () => {
              if (cancelled || dashRef.current !== dashPlayer) return;
              appliedStartRef.current = true;

              const reps = dashPlayer.getRepresentationsByType('video') || [];
              const bestByHeight = new Map<
                number,
                { index: number; height: number; bitrate: number }
              >();
              reps.forEach((rep, idx) => {
                const repIdx =
                  typeof rep.index === 'number' ? rep.index : idx;
                const normH = normalizeVideoQualityHeight(
                  rep.width,
                  rep.height
                );
                const bw = rep.bandwidth || 0;
                const prev = bestByHeight.get(normH);
                if (!prev || bw > prev.bitrate) {
                  bestByHeight.set(normH, {
                    index: repIdx,
                    height: normH,
                    bitrate: bw,
                  });
                }
              });

              const sortedLevels = Array.from(bestByHeight.values())
                .sort((a, b) => b.height - a.height || b.bitrate - a.bitrate)
                .map(({ index, height }) => ({ index, height }));

              setQualityLevels(sortedLevels);

              // Select quality according to user's preferredQuality ('max' = 1080p Full HD / 4K, '1080', '720', '480', or 'auto')
              if (sortedLevels.length > 0) {
                const targetIdx = pickQualityLevelByPreference(
                  sortedLevels,
                  preferredQuality
                );
                highestLevelIndexRef.current = targetIdx;
                if (targetIdx === -1) {
                  dashPlayer.updateSettings({
                    streaming: {
                      abr: { autoSwitchBitrate: { video: true } },
                    },
                  });
                } else {
                  dashPlayer.setRepresentationForTypeByIndex(
                    'video',
                    targetIdx,
                    true
                  );
                }
                setActiveQuality(targetIdx);
              }

              // Configure Audio Tracks & select Original Language ("Eng.Original") by default
              const dashAudio = dashPlayer.getTracksFor('audio') || [];
              if (dashAudio.length > 0) {
                const list = dashAudio.map((trk, idx) => ({
                  id: idx,
                  name:
                    audioTrackLabels[idx] ||
                    (trk.lang
                      ? `Pista Audio ${idx + 1} (${String(trk.lang).toUpperCase()})`
                      : `Pista Audio ${idx + 1}`),
                }));
                setAudioTracks(list);

                const autoOrigIdx = findPreferredOriginalAudioTrackIndex(
                  list.map((x) => x.name)
                );
                const targetIdx =
                  typeof initialAudioTrackIndex === 'number' &&
                  initialAudioTrackIndex >= 0 &&
                  initialAudioTrackIndex < list.length
                    ? initialAudioTrackIndex
                    : autoOrigIdx;

                if (dashAudio[targetIdx]) {
                  dashPlayer.setCurrentTrack(dashAudio[targetIdx]);
                  setActiveAudioTrack(targetIdx);
                }
              }

              ensureAutoPlay(video);
              setStatus('playing');
            }
          );

          dashPlayer.on(
            dashjs.MediaPlayer.events.ERROR,
            (err: { error?: { code?: number; message?: string } }) => {
              if (cancelled || dashRef.current !== dashPlayer) return;
              // If DASH manifest or source fails, seamlessly fallback to HLS
              if (err?.error && hlsUrl) {
                try {
                  dashPlayer.destroy();
                } catch {
                  // ignore
                }
                dashRef.current = null;
                startHlsPlayback(hlsUrl);
              }
            }
          );

          return;
        } catch {
          dashRef.current = null;
        }
      }

      // Case 3: Offline HLS item or Live/Online HLS URL fallback
      const targetUrl = offlineItem
        ? `https://offline.local/${encodeURIComponent(offlineItem.id)}/master.m3u8`
        : hlsUrl || '';

      startHlsPlayback(targetUrl);
    };

    void init();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashUrl, hlsUrl, offlineItem?.id]);

  // If initialAudioTrackIndex changes dynamically, switch DASH or HLS audioTrack immediately
  useEffect(() => {
    if (
      typeof initialAudioTrackIndex !== 'number' ||
      initialAudioTrackIndex < 0 ||
      initialAudioTrackIndex >= audioTracks.length
    ) {
      return;
    }

    const dashPlayer = dashRef.current;
    if (dashPlayer) {
      const dashTracks = dashPlayer.getTracksFor('audio') || [];
      if (dashTracks[initialAudioTrackIndex]) {
        dashPlayer.setCurrentTrack(dashTracks[initialAudioTrackIndex]);
        setActiveAudioTrack(initialAudioTrackIndex);
        if (highestLevelIndexRef.current >= 0) {
          dashPlayer.setRepresentationForTypeByIndex(
            'video',
            highestLevelIndexRef.current,
            false
          );
        }
      }
      return;
    }

    const hls = hlsRef.current;
    if (!hls) return;
    const targetId = audioTracks[initialAudioTrackIndex].id;
    if (hls.audioTrack !== targetId) {
      hls.audioTrack = targetId;
      setActiveAudioTrack(targetId);
      if (highestLevelIndexRef.current >= 0) {
        hls.currentLevel = highestLevelIndexRef.current;
        hls.nextLevel = highestLevelIndexRef.current;
        hls.loadLevel = highestLevelIndexRef.current;
      }
    }
  }, [initialAudioTrackIndex, audioTracks]);

  // If startAtSeconds changes dynamically (e.g. user clicks "De la început 00:00"), seek and play immediately
  useEffect(() => {
    const video = videoRef.current;
    if (!video || status !== 'playing') return;
    if (startAtSeconds === 0 && video.currentTime > 5) {
      video.currentTime = 0;
      ensureAutoPlay(video);
    }
  }, [startAtSeconds, status]);

  // When a subtitle is applied or changed, reset offset and resume playback automatically
  useEffect(() => {
    setSubOffsetSec(0);
    const video = videoRef.current;
    if (!video) return;
    if ((subtitleCues && subtitleCues.length > 0) || subtitleVttUrl) {
      if (video.paused && status === 'playing') {
        ensureAutoPlay(video);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitleVttUrl, subtitleCues]);

  // Compute active subtitle text for current timestamp
  const activeSubtitleText = useMemo(() => {
    if (!subtitleCues || subtitleCues.length === 0) return null;
    const effectiveTime = currentTimeSec - subOffsetSec;
    for (let i = 0; i < subtitleCues.length; i++) {
      const c = subtitleCues[i];
      if (effectiveTime >= c.start && effectiveTime <= c.end) {
        return c.text;
      }
    }
    return null;
  }, [subtitleCues, currentTimeSec, subOffsetSec]);

  const hasActiveSubtitle =
    (subtitleCues && subtitleCues.length > 0) || Boolean(subtitleVttUrl);

  const subFontClass =
    subFontSize === 'xlarge'
      ? 'text-lg sm:text-2xl md:text-3xl px-5 py-2.5'
      : subFontSize === 'large'
        ? 'text-base sm:text-xl md:text-2xl px-4 py-2'
        : 'text-sm sm:text-base md:text-lg px-3.5 py-1.5';

  const triggerSeek = (deltaSec: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + deltaSec));
    setSeekToast(deltaSec > 0 ? `⏩ +${deltaSec}s` : `⏪ ${deltaSec}s`);
    if (seekToastTimerRef.current) {
      window.clearTimeout(seekToastTimerRef.current);
    }
    seekToastTimerRef.current = window.setTimeout(() => {
      setSeekToast(null);
    }, 1000);
  };

  return (
    <div
      className="relative w-full h-full bg-black flex flex-col select-none"
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.stopPropagation();
          triggerSeek(-15);
        } else if (e.key === 'ArrowRight') {
          e.stopPropagation();
          triggerSeek(15);
        }
      }}
    >
      <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          controls
          playsInline
          autoPlay
          crossOrigin="anonymous"
          poster={poster}
          onClick={() => {
            if (openMenu !== 'none') setOpenMenu('none');
          }}
          onCanPlay={(e) => {
            if (status === 'loading') {
              ensureAutoPlay(e.currentTarget);
            }
          }}
          onPlaying={() => setStatus('playing')}
          onVolumeChange={(e) => {
            if (!e.currentTarget.muted && isAutoMuted) {
              setIsAutoMuted(false);
            }
          }}
          onTimeUpdate={(e) => {
            const vid = e.currentTarget;
            setCurrentTimeSec(vid.currentTime);
            if (vid.currentTime > 1 && Number.isFinite(vid.duration)) {
              onTimeUpdate?.(
                Math.floor(vid.currentTime),
                Math.floor(vid.duration)
              );
            }
          }}
          className="w-full h-full object-contain bg-black"
        />

        {/* Lampa Seek Toast (-15s / +15s) */}
        {seekToast && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <div className="px-6 py-3 rounded-2xl bg-black/80 border border-white/15 text-white text-xl sm:text-2xl font-extrabold shadow-2xl backdrop-blur-md">
              {seekToast}
            </div>
          </div>
        )}

        {/* Custom High-Contrast Lampa Cinema Subtitle Overlay */}
        {activeSubtitleText && (
          <div
            className={`pointer-events-none absolute inset-x-4 z-20 flex justify-center transition-all duration-300 ${
              isOsdVisible || openMenu !== 'none'
                ? 'bottom-36 sm:bottom-40'
                : 'bottom-14 sm:bottom-16'
            }`}
          >
            <div
              className={`max-w-4xl rounded-2xl bg-black/80 text-white text-center font-extrabold leading-snug whitespace-pre-line shadow-2xl border border-white/10 ${subFontClass}`}
              style={{
                textShadow:
                  '0 2px 4px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.95)',
              }}
            >
              {activeSubtitleText}
            </div>
          </div>
        )}

        {/* Unmute pill when browser forced muted autoplay */}
        {isAutoMuted && status === 'playing' && (
          <button
            type="button"
            onClick={() => {
              const v = videoRef.current;
              if (v) {
                v.muted = false;
                v.volume = 1;
                setIsAutoMuted(false);
              }
            }}
            className="absolute top-14 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 shadow-2xl animate-pulse cursor-pointer"
          >
            <VolumeX className="w-4 h-4" />
            <span>Sunet oprit de browser — Apasă pentru Sunet</span>
          </button>
        )}

        {status === 'loading' && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-2 bg-black/60">
            <Loader2 className="w-9 h-9 text-amber-400 animate-spin" />
            <span className="text-xs sm:text-sm font-bold text-zinc-200">
              {offlineItem
                ? 'Se încarcă filmul din memoria Offline a dispozitivului...'
                : 'Pornire automată stream HD (Fără reclame)...'}
            </span>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center bg-zinc-950/90">
            <AlertCircle className="w-8 h-8 text-rose-400" />
            <p className="text-xs sm:text-sm font-semibold text-zinc-200">
              Acest titlu nu are stream direct pe acest server. Selectează Server 2, 3 sau 4 din bara de sus!
            </p>
          </div>
        )}

        {/* LAMPA-STYLE IN-PLAYER BOTTOM-RIGHT CONTROLS: 1-CLICK AUDIO DUBBING + 1-CLICK SUBTITLES + QUALITY (Placed above native video controls bar) */}
        <div
          className={`absolute bottom-24 sm:bottom-28 right-4 sm:right-6 z-30 flex flex-wrap items-center justify-end gap-2 transition-opacity duration-300 ${
            isOsdVisible || openMenu !== 'none'
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* 1. Lampa Quick Audio / Dubbing Track Button */}
          {audioTracks.length > 1 && (
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setOpenMenu((m) => (m === 'audio' ? 'none' : 'audio'))
                }
                className={`h-9 sm:h-10 px-3.5 rounded-full border text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 shadow-lg backdrop-blur-md transition-all focus:outline-none focus:ring-4 focus:ring-white cursor-pointer ${
                  openMenu === 'audio'
                    ? 'bg-amber-500 text-zinc-950 border-amber-400'
                    : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-100 border-white/15'
                }`}
              >
                <Languages className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="max-w-[160px] truncate">
                  {audioTracks.find((t) => t.id === activeAudioTrack)?.name ||
                    'Pistă Audio'}
                </span>
              </button>

              {openMenu === 'audio' && (
                <div className="absolute right-0 bottom-full mb-2 w-64 max-h-72 overflow-y-auto rounded-2xl bg-zinc-950/95 border border-white/15 p-2 shadow-2xl backdrop-blur-xl space-y-1 z-40">
                  <div className="px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">
                    🎙 Alege Pista Audio / Dublajul
                  </div>
                  {audioTracks.map((trk) => {
                    const active = trk.id === activeAudioTrack;
                    return (
                      <button
                        key={trk.id}
                        type="button"
                        onClick={() => {
                          setActiveAudioTrack(trk.id);
                          if (dashRef.current) {
                            const dashTracks =
                              dashRef.current.getTracksFor('audio') || [];
                            if (dashTracks[trk.id]) {
                              dashRef.current.setCurrentTrack(
                                dashTracks[trk.id]
                              );
                            }
                          }
                          if (hlsRef.current) {
                            hlsRef.current.audioTrack = trk.id;
                            if (highestLevelIndexRef.current >= 0) {
                              hlsRef.current.currentLevel =
                                highestLevelIndexRef.current;
                            }
                          }
                          setOpenMenu('none');
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          active
                            ? 'bg-amber-500 text-zinc-950'
                            : 'text-zinc-200 hover:bg-white/10'
                        }`}
                      >
                        <span className="truncate">{trk.name}</span>
                        {active && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. Lampa Quick Subtitles Button & 1-Click Language / Font / Sync Popover */}
          {(onApplyAutoSubtitle || onOpenSubtitleFinder || hasActiveSubtitle) && (
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setOpenMenu((m) => (m === 'subtitles' ? 'none' : 'subtitles'))
                }
                className={`h-9 sm:h-10 px-3.5 rounded-full border text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 shadow-lg backdrop-blur-md transition-all focus:outline-none focus:ring-4 focus:ring-white cursor-pointer ${
                  hasActiveSubtitle
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                    : openMenu === 'subtitles'
                      ? 'bg-amber-500 text-zinc-950 border-amber-400'
                      : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-100 border-white/15'
                }`}
              >
                <Subtitles className="w-4 h-4 shrink-0" />
                <span className="max-w-[160px] truncate">
                  {hasActiveSubtitle
                    ? `CC: ${subtitleLabel || 'Activă'}`
                    : 'CC Subtitrare'}
                </span>
              </button>

              {openMenu === 'subtitles' && (
                <div className="absolute right-0 bottom-full mb-2 w-72 sm:w-80 max-h-[72vh] overflow-y-auto rounded-2xl bg-zinc-950/95 border border-white/15 p-3 shadow-2xl backdrop-blur-xl space-y-3 z-40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                      💬 Subtitrări Rapide (Lampa)
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpenMenu('none')}
                      className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-xs font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Off Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSubTrackId(null);
                      onClearSubtitle?.();
                      setOpenMenu('none');
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-left text-xs font-extrabold flex items-center justify-between transition-colors cursor-pointer ${
                      !hasActiveSubtitle
                        ? 'bg-rose-600 text-white'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    <span>✕ Oprit (Fără subtitrare)</span>
                    {!hasActiveSubtitle && <Check className="w-4 h-4" />}
                  </button>

                  {/* 1-Click Language Rows */}
                  {isLoadingSubsList ? (
                    <div className="py-4 flex items-center justify-center gap-2 text-xs text-zinc-400">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                      <span>Se încarcă subtitrările automate...</span>
                    </div>
                  ) : availableSubs.length > 0 ? (
                    <div className="space-y-1.5">
                      {QUICK_SUB_LANGS.map((lang) => {
                        const tracks = subsByLang[lang.code] || [];
                        if (tracks.length === 0) return null;
                        return (
                          <div
                            key={lang.code}
                            className="p-2 rounded-xl bg-zinc-900/90 border border-white/5 space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-xs font-bold text-zinc-200">
                              <span>
                                {lang.flag} {lang.label}
                              </span>
                              <span className="text-[10px] text-zinc-400">
                                {tracks.length} variante
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {tracks.map((trk, idx) => {
                                const isSelected = activeSubTrackId === trk.id;
                                const isDownloading =
                                  loadingSubTrackId === trk.id;
                                return (
                                  <button
                                    key={trk.id}
                                    type="button"
                                    disabled={isDownloading}
                                    onClick={() =>
                                      void handleSelectQuickSubTrack(trk)
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold inline-flex items-center gap-1 transition-all cursor-pointer ${
                                      isSelected
                                        ? 'bg-emerald-500 text-zinc-950 shadow-md'
                                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                                    }`}
                                  >
                                    {isDownloading ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : null}
                                    <span>#{idx + 1}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {/* TV Font Size Selector */}
                  <div className="pt-2 border-t border-white/10 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400">
                      <Type className="w-3.5 h-3.5 text-amber-400" />
                      <span>Mărime Text pe TV:</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'normal', label: 'Normal' },
                          { id: 'large', label: 'Mare TV' },
                          { id: 'xlarge', label: 'Uriaș TV' },
                        ] as const
                      ).map((sz) => (
                        <button
                          key={sz.id}
                          type="button"
                          onClick={() => {
                            setSubFontSize(sz.id);
                            try {
                              localStorage.setItem(
                                'aether_tv_sub_font_size',
                                sz.id
                              );
                            } catch {
                              // ignore
                            }
                          }}
                          className={`py-1.5 rounded-lg text-xs font-extrabold cursor-pointer ${
                            subFontSize === sz.id
                              ? 'bg-amber-500 text-zinc-950'
                              : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          {sz.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Subtitle Timing Offset (-0.5s / +0.5s) */}
                  {hasActiveSubtitle && (
                    <div className="pt-2 border-t border-white/10 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-emerald-400" />
                          Sincronizare:
                        </span>
                        <span className="font-mono text-amber-300">
                          {subOffsetSec > 0
                            ? `+${subOffsetSec}s`
                            : `${subOffsetSec}s`}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setSubOffsetSec((s) => Number((s - 0.5).toFixed(1)))
                          }
                          className="py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-mono font-bold cursor-pointer"
                        >
                          -0.5s
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubOffsetSec(0)}
                          className="py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-bold cursor-pointer"
                        >
                          Reset 0s
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSubOffsetSec((s) => Number((s + 0.5).toFixed(1)))
                          }
                          className="py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-mono font-bold cursor-pointer"
                        >
                          +0.5s
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Open Full Subtitle Search Modal */}
                  {onOpenSubtitleFinder && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenu('none');
                        onOpenSubtitleFinder();
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-emerald-300 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 border border-white/10 cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Căutare Avansată / Încarcă .SRT...</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 3. Video Quality Selector */}
          {qualityLevels.length > 1 && (
            <div className="h-8 sm:h-9 px-3 rounded-full bg-zinc-900/90 border border-white/15 text-xs text-zinc-100 inline-flex items-center gap-1.5 shadow-lg backdrop-blur-md">
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <select
                aria-label="Calitate video"
                value={activeQuality}
                onChange={(e) => {
                  const lvl = Number(e.target.value);
                  setActiveQuality(lvl);
                  if (dashRef.current) {
                    if (lvl === -1) {
                      dashRef.current.updateSettings({
                        streaming: {
                          abr: { autoSwitchBitrate: { video: true } },
                        },
                      });
                    } else {
                      dashRef.current.updateSettings({
                        streaming: {
                          abr: { autoSwitchBitrate: { video: false } },
                        },
                      });
                      dashRef.current.setRepresentationForTypeByIndex(
                        'video',
                        lvl,
                        true
                      );
                    }
                  }
                  if (hlsRef.current) {
                    hlsRef.current.currentLevel = lvl;
                  }
                }}
                className="bg-transparent text-zinc-100 font-extrabold outline-none cursor-pointer"
              >
                {qualityLevels.map((q, idx) => (
                  <option
                    key={q.index}
                    value={q.index}
                    className="bg-zinc-900 text-zinc-100"
                  >
                    {q.height}p {idx === 0 ? '(MAX HD)' : ''}
                  </option>
                ))}
                <option value={-1} className="bg-zinc-900 text-zinc-100">
                  Auto HD
                </option>
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
