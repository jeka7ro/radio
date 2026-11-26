import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import * as dashjs from 'dashjs';
import {
  Loader2,
  VolumeX,
  Check,
  Search,
  Type,
  Clock,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Sparkles,
  Maximize2,
  Minimize2,
  ArrowDown,
  X,
} from 'lucide-react';
import {
  SfVideoCameraIcon,
  SfCaptionsBubbleIcon,
  SfSpeakerWaveIcon,
  SfAirPlayIcon,
} from '../common/AppleSfIcons';
import { FilmioStartupLoader } from '../common/FilmioStartupLoader';
import {
  OfflineMediaItem,
  createOfflineAwareHlsLoader,
  getBlobChunk,
  getOfflineFileBlob,
  buildIosNativeOfflineHlsBlobUrl,
} from '../../services/offlineMediaService';
import {
  SubtitleCue,
  OnlineSubtitleTrack,
  AudioTrackPreference,
  fetchOnlineSubtitlesByImdb,
  downloadSubtitleAsVttBlobUrl,
  resolveAudioTrackIndexByPreference,
  inferAudioPrefFromTrackName,
  filterDisplayAudioItems,
} from '../../services/subtitleSearchService';
import type { EmbeddedSubtitleTrack } from '../../views/smartTvLampaHelpers';
import {
  getActiveProfileMediaPrefs,
  getDefaultSubFontPxForCurrentDevice,
  saveActiveProfileMediaPrefs,
} from '../../services/deviceContinuityService';
import {
  claimMediaSession,
  releaseMediaSession,
  updateMediaSessionPlaybackState,
  updateMediaSessionPosition,
  loadPreferredVideoFitMode,
  savePreferredVideoFitMode,
  acquirePlaybackWakeLock,
  releasePlaybackWakeLock,
  resolveCinemaFitClass,
  isSmartTvDevice,
  isMobilePhoneDevice,
  type VideoFitMode,
} from '../../utils/mediaSessionManager';

export type TvSubFontSize = 'normal' | 'large' | 'xlarge';
export type TvPreferredQuality = 'max' | '1080' | '720' | '480' | 'auto';

export interface VodExternalQualityOption {
  id: string;
  label: string;
  badge?: string;
  subLabel?: string;
  active: boolean;
  onSelect: () => void;
}

export interface SeekHudData {
  direction: 'fwd' | 'rew';
  deltaLabel: string;
  targetTimeStr: string;
  targetSec: number;
  totalTimeStr: string;
  totalSec: number;
  remainingTimeStr: string;
  percent: number;
}

export interface VodResolutionReport {
  width: number;
  height: number;
  normHeight: number;
  badgeLabel: string;
  dimsLabel: string;
  fullLabel: string;
  isAuto: boolean;
  activeQualityIndex: number;
  availableLevels: Array<{
    index: number;
    height: number;
    label: string;
    active: boolean;
  }>;
}

function normalizeVideoQualityHeight(width = 0, height = 0): number {
  if (width >= 3200 || height >= 1800) return 2160;
  if (width >= 2200 || height >= 1300) return 1440;
  if (width >= 1600 || height >= 950) return 1080;
  if (width >= 1100 || height >= 650) return 720;
  if (width >= 760 || height >= 440) return 480;
  if (width >= 560 || height >= 320) return 360;
  return height || 0;
}

function parseQualityHeightFromString(raw = ''): number {
  const s = raw.toLowerCase();
  if (s.includes('2160') || s.includes('4k') || s.includes('uhd')) return 2160;
  if (s.includes('1440') || s.includes('2k') || s.includes('qhd')) return 1440;
  if (s.includes('1080') || s.includes('fhd') || s.includes('full hd')) return 1080;
  if (s.includes('720')) return 720;
  if (s.includes('480')) return 480;
  if (s.includes('360')) return 360;
  return 0;
}

export function formatQualityTierLabel(height: number): string {
  if (height >= 2160) return '4K UHD';
  if (height >= 1440) return '2K QHD';
  if (height >= 1080) return '1080p Full HD';
  if (height >= 720) return '720p HD';
  if (height >= 480) return '480p SD';
  if (height > 0) return `${height}p SD`;
  return 'HD Auto';
}

function defaultDimsForHeight(height: number): string {
  if (height >= 2160) return '3840×2160';
  if (height >= 1440) return '2560×1440';
  if (height >= 1080) return '1920×1080';
  if (height >= 720) return '1280×720';
  if (height >= 480) return '854×480';
  if (height >= 360) return '640×360';
  return '';
}

function pickQualityLevelByPreference(
  sortedLevels: Array<{ index: number; height: number }>,
  pref: TvPreferredQuality = 'max'
): number {
  if (sortedLevels.length === 0) return -1;
  if (pref === 'max' || pref === 'auto') return sortedLevels[0].index;
  const targetH = Number(pref) || 1080;
  const match =
    sortedLevels.find((l) => l.height <= targetH) || sortedLevels[0];
  return match.index;
}

interface VodNativeHlsPlayerProps {
  dashUrl?: string;
  hlsUrl?: string;
  fallbackHlsUrl?: string;
  durationHintSec?: number;
  offlineItem?: OfflineMediaItem | null;
  isForeign?: boolean;
  preferredAudioLang?: 'original' | 'ro' | 'ru' | 'uk' | 'first';
  audioTrackLabels?: string[];
  initialAudioTrackIndex?: number;
  preferredQuality?: TvPreferredQuality;
  initialSubFontSize?: TvSubFontSize;
  startAtSeconds?: number;
  poster?: string;
  backdropUrl?: string;
  title?: string;
  subtitle?: string;
  imdbId?: string;
  tmdbId?: string | number;
  mediaType?: 'movie' | 'series';
  season?: number;
  episode?: number;
  preferredSubLang?: string;
  subtitleVttUrl?: string | null;
  subtitleLabel?: string;
  subtitleCues?: SubtitleCue[];
  embeddedSubtitleTracks?: EmbeddedSubtitleTrack[];
  onSelectEmbeddedSubtitle?: (track: EmbeddedSubtitleTrack) => void;
  onApplyAutoSubtitle?: (payload: {
    vttBlobUrl: string;
    label: string;
    cues: SubtitleCue[];
  }) => void;
  onOpenSubtitleFinder?: () => void;
  onClearSubtitle?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number, flushNow?: boolean) => void;
  onStreamError?: () => void;
  onSelectAudioTrackIndex?: (index: number) => void;
  onRequestOriginalAudio?: () => void;
  activeServerId?: string;
  serverOptions?: Array<{ id: string; label: string }>;
  onSelectServer?: (serverId: string) => void;
  isOsdVisible?: boolean;
  sourceQualityBadge?: string;
  externalQualityOptions?: VodExternalQualityOption[];
  onResolutionChange?: (report: VodResolutionReport) => void;
  onWakeOsd?: () => void;
  onHideOsd?: () => void;
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
  onOpenEpisodesDrawer?: () => void;
  onOpenInfoSheet?: () => void;
  onClosePlayer?: () => void;
  prevEpisodeLabel?: string;
  nextEpisodeLabel?: string;
}

const QUICK_SUB_LANGS = [
  { code: 'ro', flag: 'RO', countryIso: 'ro', label: 'Română' },
  { code: 'ru', flag: 'RU', countryIso: 'ru', label: 'Русский' },
  { code: 'en', flag: 'EN', countryIso: 'gb', label: 'English' },
  { code: 'es', flag: 'ES', countryIso: 'es', label: 'Español' },
  { code: 'fr', flag: 'FR', countryIso: 'fr', label: 'Français' },
  { code: 'de', flag: 'DE', countryIso: 'de', label: 'Deutsch' },
];

function resolveSubtitleFlagBadge(rawLabel?: string): {
  countryIso: string | null;
  trackNum: string;
} {
  const s = (rawLabel || '').trim();
  const lower = s.toLowerCase();
  const numMatch = s.match(/#\d+/);
  const trackNum = numMatch ? numMatch[0] : '';
  if (/\b(rom|ro|rum)\b|român|romana/i.test(lower)) {
    return { countryIso: 'ro', trackNum };
  }
  if (/\b(rus|ru)\b|рус|rusă|rusa/i.test(lower)) {
    return { countryIso: 'ru', trackNum };
  }
  if (/\b(eng|en)\b|english|englez/i.test(lower)) {
    return { countryIso: 'gb', trackNum };
  }
  if (/\b(esp|spa|es)\b|español|spaniol/i.test(lower)) {
    return { countryIso: 'es', trackNum };
  }
  if (/\b(fra|fre|fr)\b|français|francez/i.test(lower)) {
    return { countryIso: 'fr', trackNum };
  }
  if (/\b(deu|ger|de)\b|deutsch|german/i.test(lower)) {
    return { countryIso: 'de', trackNum };
  }
  if (/\b(ita|it)\b|italian/i.test(lower)) {
    return { countryIso: 'it', trackNum };
  }
  return { countryIso: null, trackNum };
}

export const VodNativeHlsPlayer: React.FC<VodNativeHlsPlayerProps> = ({
  dashUrl,
  hlsUrl,
  fallbackHlsUrl,
  durationHintSec = 0,
  offlineItem,
  isForeign = false,
  preferredAudioLang,
  audioTrackLabels = [],
  initialAudioTrackIndex,
  preferredQuality = 'max',
  initialSubFontSize,
  startAtSeconds = 0,
  poster,
  backdropUrl,
  title,
  subtitle,
  imdbId,
  tmdbId,
  mediaType = 'movie',
  season = 1,
  episode = 1,
  preferredSubLang = 'ro',
  subtitleVttUrl,
  subtitleLabel,
  subtitleCues = [],
  embeddedSubtitleTracks = [],
  onSelectEmbeddedSubtitle,
  onApplyAutoSubtitle,
  onOpenSubtitleFinder,
  onClearSubtitle,
  onTimeUpdate,
  onStreamError,
  onSelectAudioTrackIndex,
  onRequestOriginalAudio,
  activeServerId,
  serverOptions = [],
  onSelectServer,
  isOsdVisible = true,
  sourceQualityBadge,
  externalQualityOptions = [],
  onResolutionChange,
  onWakeOsd,
  onHideOsd,
  onPrevEpisode,
  onNextEpisode,
  onOpenEpisodesDrawer,
  onOpenInfoSheet,
  onClosePlayer,
  prevEpisodeLabel,
  nextEpisodeLabel,
}) => {
  const detectIpadTablet = (): boolean => {
    if (typeof window === 'undefined') return false;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    if (/iPhone|iPod/i.test(ua)) return false;
    return (
      /iPad/i.test(ua) ||
      (typeof navigator !== 'undefined' &&
        navigator.platform === 'MacIntel' &&
        (navigator.maxTouchPoints || 0) > 1) ||
      (typeof document !== 'undefined' &&
        document.documentElement.classList.contains('ipad-pwa-standalone'))
    );
  };
  const [isIpadTablet, setIsIpadTablet] = useState<boolean>(() =>
    detectIpadTablet()
  );
  const [isMobilePhone, setIsMobilePhone] = useState<boolean>(
    () => isMobilePhoneDevice() && !detectIpadTablet()
  );

  useEffect(() => {
    const syncIsMobilePhone = () => {
      const ipad = detectIpadTablet();
      setIsIpadTablet(ipad);
      setIsMobilePhone(isMobilePhoneDevice() && !ipad);
    };
    window.addEventListener('resize', syncIsMobilePhone);
    window.addEventListener('orientationchange', syncIsMobilePhone);
    return () => {
      window.removeEventListener('resize', syncIsMobilePhone);
      window.removeEventListener('orientationchange', syncIsMobilePhone);
    };
  }, []);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastHlsFragActivityMsRef = useRef<number>(0);
  const dashRef = useRef<dashjs.MediaPlayerClass | null>(null);
  const flStreamAbortRef = useRef<AbortController | null>(null);
  const flMediaSourceRef = useRef<MediaSource | null>(null);
  const flSourceBufferRef = useRef<SourceBuffer | null>(null);
  const flMseUrlRef = useRef<string | null>(null);
  const flSeekDebounceRef = useRef<number | null>(null);
  const isSeekingFileListRef = useRef<boolean>(false);
  const streamOffsetRef = useRef<number>(0);
  const qualityBtnRef = useRef<HTMLButtonElement | null>(null);
  const highestLevelIndexRef = useRef<number>(-1);
  const appliedStartRef = useRef<boolean>(false);
  const lastSeekAttemptMsRef = useRef<number>(0);
  const startAtSecondsRef = useRef<number>(startAtSeconds);
  const hasNotifiedInitialPlayOsdRef = useRef<boolean>(false);
  const hasRenderedFirstFrameRef = useRef<boolean>(false);
  const frozenFrameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isFrozenFrameVisible, setIsFrozenFrameVisible] = useState<boolean>(false);
  const frozenFrameFadeTimerRef = useRef<number | null>(null);

  const captureFrozenFrame = useCallback(() => {
    const v = videoRef.current;
    if (!v || v.readyState < 2) return;
    const canvas = frozenFrameCanvasRef.current;
    if (!canvas) return;
    const w = v.videoWidth || v.clientWidth || 1920;
    const h = v.videoHeight || v.clientHeight || 1080;
    if (w > 0 && h > 0) {
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext('2d');
      if (ctx) {
        try {
          ctx.drawImage(v, 0, 0, w, h);
          setIsFrozenFrameVisible(true);
          if (frozenFrameFadeTimerRef.current) {
            window.clearTimeout(frozenFrameFadeTimerRef.current);
          }
          // Safety timeout: never leave frozen frame stuck longer than 4.5 seconds
          frozenFrameFadeTimerRef.current = window.setTimeout(() => {
            setIsFrozenFrameVisible(false);
          }, 4500);
        } catch {
          // ignore cross-origin taint
        }
      }
    }
  }, []);

  const hideFrozenFrame = useCallback(() => {
    if (frozenFrameFadeTimerRef.current) {
      window.clearTimeout(frozenFrameFadeTimerRef.current);
      frozenFrameFadeTimerRef.current = null;
    }
    setIsFrozenFrameVisible(false);
  }, []);
  const nativeHlsFallbackTimerRef = useRef<number | null>(null);
  const watchedTicksInEpisodeRef = useRef<number>(0);
  const activeEpisodeMediaKeyRef = useRef<string>(
    `${season}_${episode}_${hlsUrl || ''}_${dashUrl || ''}`
  );
  useEffect(() => {
    startAtSecondsRef.current = startAtSeconds || 0;
  }, [startAtSeconds]);

  const effectiveAudioPref = useMemo<AudioTrackPreference>(() => {
    if (isForeign) {
      return preferredAudioLang === 'ro' ? 'ro' : 'original';
    }
    return preferredAudioLang || getActiveProfileMediaPrefs().defaultAudioPref;
  }, [isForeign, preferredAudioLang]);

  const [forcedAudioIdx, setForcedAudioIdx] = useState<number>(() => {
    if (
      typeof initialAudioTrackIndex === 'number' &&
      initialAudioTrackIndex >= 0
    ) {
      return initialAudioTrackIndex;
    }
    return audioTrackLabels.length > 1
      ? resolveAudioTrackIndexByPreference(audioTrackLabels, effectiveAudioPref)
      : -1;
  });

  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>(
    'loading'
  );
  const [isAutoMuted, setIsAutoMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const userIntentionallyPausedRef = useRef<boolean>(false);
  const lastTimeUpdateWallMsRef = useRef<number>(Date.now());
  const lastTimeUpdateMediaSecRef = useRef<number>(0);
  const lastAutoRecoverWallMsRef = useRef<number>(0);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(startAtSeconds || 0);
  const [videoDurationSec, setVideoDurationSec] = useState<number>(0);
  const [bufferedEndSec, setBufferedEndSec] = useState<number>(0);
  const [scrubPreviewSec, setScrubPreviewSec] = useState<number | null>(null);
  const [hoverPreview, setHoverPreview] = useState<{
    sec: number;
    pct: number;
  } | null>(null);
  const [streamOffsetSec, setStreamOffsetSec] = useState<number>(0);
  const [subOffsetSec, setSubOffsetSec] = useState<number>(0);
  const [subFontSize, setSubFontSize] = useState<TvSubFontSize>(() => {
    const profilePrefs = getActiveProfileMediaPrefs();
    if (profilePrefs.defaultSubFontSize) return profilePrefs.defaultSubFontSize;
    if (initialSubFontSize) return initialSubFontSize;
    return 'large';
  });
  const [subFontPx, setSubFontPx] = useState<number>(() => {
    const profilePrefs = getActiveProfileMediaPrefs();
    if (
      Number.isFinite(profilePrefs.defaultSubFontPx) &&
      profilePrefs.defaultSubFontPx >= 12 &&
      profilePrefs.defaultSubFontPx <= 56
    ) {
      return profilePrefs.defaultSubFontPx;
    }
    return initialSubFontSize === 'xlarge'
      ? 32
      : initialSubFontSize === 'normal'
        ? 20
        : 26;
  });

  const updateSubFontPx = (nextPx: number) => {
    const clamped = Math.max(14, Math.min(48, Math.round(nextPx)));
    setSubFontPx(clamped);
    const tier: TvSubFontSize =
      clamped >= 30 ? 'xlarge' : clamped >= 23 ? 'large' : 'normal';
    setSubFontSize(tier);
    saveActiveProfileMediaPrefs({
      defaultSubFontPx: clamped,
      defaultSubFontSize: tier,
    });
  };

  useEffect(() => {
    const syncFromProfile = () => {
      const prefs = getActiveProfileMediaPrefs();
      if (prefs.defaultSubFontSize) {
        setSubFontSize(prefs.defaultSubFontSize);
      }
      if (
        Number.isFinite(prefs.defaultSubFontPx) &&
        prefs.defaultSubFontPx >= 12 &&
        prefs.defaultSubFontPx <= 56
      ) {
        setSubFontPx(prefs.defaultSubFontPx);
      }
    };
    window.addEventListener('aether:active-profile-changed', syncFromProfile);
    window.addEventListener(
      'aether:profile-media-prefs-changed',
      syncFromProfile
    );
    return () => {
      window.removeEventListener(
        'aether:active-profile-changed',
        syncFromProfile
      );
      window.removeEventListener(
        'aether:profile-media-prefs-changed',
        syncFromProfile
      );
    };
  }, []);

  // Lampa-style in-player quick menus
  const [openMenu, setOpenMenu] = useState<
    'none' | 'subtitles' | 'audio' | 'server' | 'quality'
  >('none');
  const prevOpenMenuRef = useRef<
    'none' | 'subtitles' | 'audio' | 'server' | 'quality'
  >('none');
  useEffect(() => {
    const prev = prevOpenMenuRef.current;
    prevOpenMenuRef.current = openMenu;
    if (prev !== 'none' && openMenu === 'none') {
      window.setTimeout(() => {
        const rootEl = playerRootRef.current;
        if (!rootEl) return;
        const activeEl = document.activeElement as HTMLElement | null;
        if (!activeEl || activeEl === document.body || !rootEl.contains(activeEl)) {
          const triggerBtn = rootEl.querySelector<HTMLButtonElement>(
            `[data-vod-primary-${prev}-btn="true"]`
          );
          triggerBtn?.focus();
        }
      }, 25);
    }
  }, [openMenu]);
  const [availableSubs, setAvailableSubs] = useState<OnlineSubtitleTrack[]>([]);
  const [isLoadingSubsList, setIsLoadingSubsList] = useState<boolean>(false);
  const [loadingSubTrackId, setLoadingSubTrackId] = useState<string | null>(
    null
  );
  const [activeSubTrackId, setActiveSubTrackId] = useState<string | null>(null);

  // Smart Intro & Recap Detection ("Sari peste Recapitulare" / "Sari peste Intro") & Next Episode Prompt
  const [autoNextDismissed, setAutoNextDismissed] = useState<boolean>(false);
  const [showNextEpisodePrompt, setShowNextEpisodePrompt] =
    useState<boolean>(false);
  const hasTriggeredAutoNextRef = useRef<boolean>(false);
  const hasAutoFocusedNextEpRef = useRef<boolean>(false);

  const [dismissedSegmentIds, setDismissedSegmentIds] = useState<string[]>([]);
  const [apiSkipSegments, setApiSkipSegments] = useState<
    Array<{
      id: string;
      type: 'recap' | 'intro';
      startSec: number;
      endSec: number;
      label: string;
      toastLabel: string;
    }>
  >([]);
  const [apiOutroStartSec, setApiOutroStartSec] = useState<number | null>(null);
  const [apiOutroEndSec, setApiOutroEndSec] = useState<number | null>(null);
  const [apiPostCreditsStartSec, setApiPostCreditsStartSec] = useState<
    number | null
  >(null);
  const [apiNoIntro, setApiNoIntro] = useState<boolean>(false);
  const [isIntroApiSettled, setIsIntroApiSettled] = useState<boolean>(false);
  const hasAutoFocusedSkipIntroRef = useRef<string | null>(null);

  const [torrentLiveStats, setTorrentLiveStats] = useState<{
    downloadSpeedText: string;
    numPeers: number;
    source: string;
  } | null>(null);

  useEffect(() => {
    setAutoNextDismissed(false);
    setShowNextEpisodePrompt(false);
    hasTriggeredAutoNextRef.current = false;
    hasAutoFocusedNextEpRef.current = false;
    watchedTicksInEpisodeRef.current = 0;
    setDismissedSegmentIds([]);
    setApiSkipSegments([]);
    setApiOutroStartSec(null);
    setApiOutroEndSec(null);
    setApiPostCreditsStartSec(null);
    setApiNoIntro(false);
    setIsIntroApiSettled(false);
    hasAutoFocusedSkipIntroRef.current = null;
    setVideoDurationSec(0);
    setBufferedEndSec(0);
    setScrubPreviewSec(null);
    const safeStart = startAtSeconds || 0;
    startAtSecondsRef.current = safeStart;
    streamOffsetRef.current = safeStart;
    setStreamOffsetSec(safeStart);
    setCurrentTimeSec(safeStart);
    appliedStartRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, episode]);

  useEffect(() => {
    setAutoNextDismissed(false);
    setShowNextEpisodePrompt(false);
    hasTriggeredAutoNextRef.current = false;
    hasAutoFocusedNextEpRef.current = false;
    watchedTicksInEpisodeRef.current = 0;
    hasAutoFocusedSkipIntroRef.current = null;
    flStallStrikeRef.current = 0;
    setVideoDurationSec(0);
  }, [hlsUrl, dashUrl]);

  // Query BOTH IntroDB.app (curated consensus Recap + Intro + Outro) and TheIntroDB v2 in parallel for Netflix/Lampa-level accuracy on both Series and Movies
  useEffect(() => {
    const cleanImdb =
      imdbId && imdbId.startsWith('tt')
        ? imdbId.match(/^(tt\d+)/)?.[1] || ''
        : '';
    const rawTmdb = tmdbId !== undefined && tmdbId !== null ? String(tmdbId).trim() : '';
    const cleanTmdb = /^\d+$/.test(rawTmdb) ? rawTmdb : '';

    if (!cleanImdb && !cleanTmdb) {
      setApiSkipSegments([]);
      setApiOutroStartSec(null);
      setApiOutroEndSec(null);
      setApiPostCreditsStartSec(null);
      setApiNoIntro(false);
      setIsIntroApiSettled(true);
      return;
    }

    let active = true;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 4500);

    const fetchIntroDbApp = async (): Promise<any | null> => {
      if (!cleanImdb) return null;
      const sParam = mediaType === 'series' ? season : 0;
      const eParam = mediaType === 'series' ? episode : 0;
      const targetUrl = `https://api.introdb.app/segments?imdb_id=${encodeURIComponent(cleanImdb)}&season=${sParam}&episode=${eParam}`;
      try {
        const res = await fetch(
          `/api/tv-proxy?raw=1&url=${encodeURIComponent(targetUrl)}&ref=${encodeURIComponent('https://introdb.app/')}`,
          { signal: ctrl.signal }
        );
        if (res.ok) {
          const d = await res.json();
          if (d && typeof d === 'object') return d;
        }
      } catch {
        // fallback to direct fetch
      }
      try {
        const resDirect = await fetch(targetUrl, { signal: ctrl.signal });
        if (resDirect.ok) {
          const d = await resDirect.json();
          if (d && typeof d === 'object') return d;
        }
      } catch {
        // ignore
      }
      return null;
    };

    const fetchTheIntroDbV2 = async (): Promise<any | null> => {
      const idQuery = cleanImdb
        ? `imdb_id=${encodeURIComponent(cleanImdb)}`
        : `tmdb_id=${encodeURIComponent(cleanTmdb)}`;
      const epQuery =
        mediaType === 'series' ? `&season=${season}&episode=${episode}` : '';
      try {
        const res = await fetch(
          `https://api.theintrodb.org/v2/media?${idQuery}${epQuery}`,
          { signal: ctrl.signal }
        );
        if (!res.ok) return null;
        const d = await res.json();
        return d && typeof d === 'object' ? d : null;
      } catch {
        return null;
      }
    };

    void (async () => {
      try {
        const [resApp, resV2] = await Promise.allSettled([
          fetchIntroDbApp(),
          fetchTheIntroDbV2(),
        ]);
        if (!active) return;

        const dApp = resApp.status === 'fulfilled' ? resApp.value : null;
        const dV2 = resV2.status === 'fulfilled' ? resV2.value : null;

        const segments: Array<{
          id: string;
          type: 'recap' | 'intro';
          startSec: number;
          endSec: number;
          label: string;
          toastLabel: string;
        }> = [];
        let recapAdded = false;
        let introAdded = false;
        const explicitNoIntro = dApp?.no_intro === true;

        if (mediaType === 'series') {
          // Parse valid segments from TheIntroDB v2 intro array (used for multi-segment recap+intro disambiguation & fallback)
          const v2IntroValid: Array<{ s: number; e: number }> = Array.isArray(
            dV2?.intro
          )
            ? dV2.intro
              .map((seg: any) => ({
                s:
                  typeof seg?.start_ms === 'number'
                    ? seg.start_ms / 1000
                    : 0,
                e: typeof seg?.end_ms === 'number' ? seg.end_ms / 1000 : 0,
              }))
              .filter(
                (seg: { s: number; e: number }) =>
                  seg.e > seg.s + 10 &&
                  seg.s < 1500 &&
                  !(seg.s <= 3 && seg.e - seg.s <= 22)
              )
            : [];

          // 1. RECAP from IntroDB.app or TheIntroDB v2
          if (dApp?.recap && typeof dApp.recap === 'object') {
            const s =
              typeof dApp.recap.start_sec === 'number'
                ? dApp.recap.start_sec
                : (dApp.recap.start_ms || 0) / 1000;
            const e =
              typeof dApp.recap.end_sec === 'number'
                ? dApp.recap.end_sec
                : (dApp.recap.end_ms || 0) / 1000;
            if (e > s + 8 && s < 300) {
              const startSec = Math.max(1, Math.floor(s));
              const endSec = Math.ceil(e);
              segments.push({
                id: `recap_${startSec}_${endSec}`,
                type: 'recap',
                startSec,
                endSec,
                label: 'Sari peste Recapitulare',
                toastLabel: 'Recapitulare Omisă',
              });
              recapAdded = true;
            }
          } else if (Array.isArray(dV2?.recap) && dV2.recap.length > 0) {
            const lastRec = dV2.recap[dV2.recap.length - 1];
            const s = (lastRec?.start_ms || 0) / 1000;
            const e = (lastRec?.end_ms || 0) / 1000;
            if (e > s + 8 && s < 300) {
              const startSec = Math.max(1, Math.floor(s));
              const endSec = Math.ceil(e);
              segments.push({
                id: `recap_${startSec}_${endSec}`,
                type: 'recap',
                startSec,
                endSec,
                label: 'Sari peste Recapitulare',
                toastLabel: 'Recapitulare Omisă',
              });
              recapAdded = true;
            }
          }

          // 2. INTRO from IntroDB.app (primary consensus) + smart disambiguation if an early recap was tagged as intro
          if (
            !explicitNoIntro &&
            dApp?.intro &&
            typeof dApp.intro === 'object'
          ) {
            const s =
              typeof dApp.intro.start_sec === 'number'
                ? dApp.intro.start_sec
                : (dApp.intro.start_ms || 0) / 1000;
            const e =
              typeof dApp.intro.end_sec === 'number'
                ? dApp.intro.end_sec
                : (dApp.intro.end_ms || 0) / 1000;
            if (e > s + 10 && s < 1500 && !(s <= 3 && e - s <= 22)) {
              const startSec = Math.max(2, Math.floor(s));
              const endSec = Math.ceil(e);
              const hasLaterV2Intro =
                !recapAdded &&
                startSec < 20 &&
                v2IntroValid.length >= 2 &&
                v2IntroValid[0].s < 20 &&
                v2IntroValid[v2IntroValid.length - 1].s >= 60;

              if (hasLaterV2Intro) {
                segments.push({
                  id: `recap_${startSec}_${endSec}`,
                  type: 'recap',
                  startSec,
                  endSec,
                  label: 'Sari peste Recapitulare',
                  toastLabel: 'Recapitulare Omisă',
                });
                recapAdded = true;

                const trueIntro = v2IntroValid[v2IntroValid.length - 1];
                const iStart = Math.max(2, Math.floor(trueIntro.s));
                const iEnd = Math.ceil(trueIntro.e);
                segments.push({
                  id: `intro_${iStart}_${iEnd}`,
                  type: 'intro',
                  startSec: iStart,
                  endSec: iEnd,
                  label: 'Sari peste Intro',
                  toastLabel: 'Intro Omis',
                });
                introAdded = true;
              } else {
                segments.push({
                  id: `intro_${startSec}_${endSec}`,
                  type: 'intro',
                  startSec,
                  endSec,
                  label: 'Sari peste Intro',
                  toastLabel: 'Intro Omis',
                });
                introAdded = true;
              }
            }
          }

          // 3. Fallback / Supplement from TheIntroDB v2 when IntroDB.app didn't have the intro
          if (!explicitNoIntro && !introAdded && v2IntroValid.length > 0) {
            if (
              v2IntroValid.length >= 2 &&
              v2IntroValid[0].s < 20 &&
              v2IntroValid[v2IntroValid.length - 1].s >= 60
            ) {
              if (!recapAdded) {
                const rStart = Math.max(1, Math.floor(v2IntroValid[0].s));
                const rEnd = Math.ceil(v2IntroValid[0].e);
                segments.push({
                  id: `recap_${rStart}_${rEnd}`,
                  type: 'recap',
                  startSec: rStart,
                  endSec: rEnd,
                  label: 'Sari peste Recapitulare',
                  toastLabel: 'Recapitulare Omisă',
                });
                recapAdded = true;
              }
              const last = v2IntroValid[v2IntroValid.length - 1];
              const iStart = Math.max(2, Math.floor(last.s));
              const iEnd = Math.ceil(last.e);
              segments.push({
                id: `intro_${iStart}_${iEnd}`,
                type: 'intro',
                startSec: iStart,
                endSec: iEnd,
                label: 'Sari peste Intro',
                toastLabel: 'Intro Omis',
              });
              introAdded = true;
            } else {
              const best = v2IntroValid[v2IntroValid.length - 1];
              const overlapsRecap = segments.some(
                (seg) =>
                  seg.type === 'recap' &&
                  Math.abs(seg.startSec - best.s) < 15
              );
              if (!overlapsRecap) {
                const iStart = Math.max(2, Math.floor(best.s));
                const iEnd = Math.ceil(best.e);
                segments.push({
                  id: `intro_${iStart}_${iEnd}`,
                  type: 'intro',
                  startSec: iStart,
                  endSec: iEnd,
                  label: 'Sari peste Intro',
                  toastLabel: 'Intro Omis',
                });
                introAdded = true;
              }
            }
          }
        }

        // 4. OUTRO / CREDITS & POST-CREDITS timestamps (Series & Movies)
        const minValidOutroSec = mediaType === 'series' ? 300 : 1200;
        const outroStartCandidates: number[] = [];
        const outroEndCandidates: number[] = [];

        if (dApp?.outro && typeof dApp.outro === 'object') {
          const oStart =
            typeof dApp.outro.start_sec === 'number'
              ? dApp.outro.start_sec
              : (dApp.outro.start_ms || 0) / 1000;
          const oEnd =
            typeof dApp.outro.end_sec === 'number'
              ? dApp.outro.end_sec
              : (dApp.outro.end_ms || 0) / 1000;
          if (oStart > minValidOutroSec) {
            outroStartCandidates.push(Math.floor(oStart));
            if (oEnd > oStart + 5) {
              outroEndCandidates.push(Math.ceil(oEnd));
            }
          }
        }
        if (Array.isArray(dV2?.credits)) {
          for (const cred of dV2.credits) {
            const cStart =
              typeof cred?.start_ms === 'number' ? cred.start_ms / 1000 : 0;
            const cEnd =
              typeof cred?.end_ms === 'number' ? cred.end_ms / 1000 : 0;
            if (cStart > minValidOutroSec) {
              outroStartCandidates.push(Math.floor(cStart));
              if (cEnd > cStart + 5) {
                outroEndCandidates.push(Math.ceil(cEnd));
              }
            }
          }
        }
        if (Array.isArray(dV2?.outro)) {
          for (const out of dV2.outro) {
            const uStart =
              typeof out?.start_ms === 'number' ? out.start_ms / 1000 : 0;
            const uEnd =
              typeof out?.end_ms === 'number' ? out.end_ms / 1000 : 0;
            if (uStart > minValidOutroSec) {
              outroStartCandidates.push(Math.floor(uStart));
              if (uEnd > uStart + 5) {
                outroEndCandidates.push(Math.ceil(uEnd));
              }
            }
          }
        }

        let resolvedPostCreditsSec: number | null = null;
        if (dApp?.post_credits && typeof dApp.post_credits === 'object') {
          const pStart =
            typeof dApp.post_credits.start_sec === 'number'
              ? dApp.post_credits.start_sec
              : (dApp.post_credits.start_ms || 0) / 1000;
          if (pStart > minValidOutroSec) {
            resolvedPostCreditsSec = Math.floor(pStart);
          }
        } else if (
          Array.isArray(dV2?.post_credits) &&
          dV2.post_credits.length > 0
        ) {
          const firstPc = dV2.post_credits[0];
          const pStart =
            typeof firstPc?.start_ms === 'number'
              ? firstPc.start_ms / 1000
              : 0;
          if (pStart > minValidOutroSec) {
            resolvedPostCreditsSec = Math.floor(pStart);
          }
        }

        segments.sort((a, b) => a.startSec - b.startSec);
        setApiSkipSegments(segments);
        setApiNoIntro(explicitNoIntro && segments.length === 0);
        if (outroStartCandidates.length > 0) {
          setApiOutroStartSec(Math.min(...outroStartCandidates));
        }
        if (outroEndCandidates.length > 0) {
          setApiOutroEndSec(Math.max(...outroEndCandidates));
        }
        if (resolvedPostCreditsSec) {
          setApiPostCreditsStartSec(resolvedPostCreditsSec);
        }
      } finally {
        window.clearTimeout(timer);
        if (active) {
          setIsIntroApiSettled(true);
        }
      }
    })();

    return () => {
      active = false;
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [mediaType, imdbId, tmdbId, season, episode]);

  const isOsdVisibleRef = useRef<boolean>(isOsdVisible);
  isOsdVisibleRef.current = isOsdVisible;
  const videoDurationSecRef = useRef<number>(videoDurationSec);
  videoDurationSecRef.current = videoDurationSec;
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;
  const currentTimeSecRef = useRef<number>(currentTimeSec);
  currentTimeSecRef.current = currentTimeSec;
  const durationHintSecRef = useRef<number | undefined>(durationHintSec);
  durationHintSecRef.current = durationHintSec;

  // Flush final playback progress on unmount / player close (avoid doubling streamOffsetRef + currentTimeSecRef)
  useEffect(() => {
    return () => {
      const v = videoRef.current;
      const hasLiveVideoTime = Boolean(
        v && Number.isFinite(v.currentTime) && v.currentTime > 0
      );
      const rawEffTime = hasLiveVideoTime
        ? streamOffsetRef.current + (v!.currentTime || 0)
        : currentTimeSecRef.current || streamOffsetRef.current || 0;
      const totalDur = Math.floor(
        videoDurationSecRef.current || durationHintSecRef.current || 2700
      );
      const floorCur =
        totalDur > 60
          ? Math.min(Math.floor(rawEffTime), Math.max(0, totalDur - 5))
          : Math.floor(rawEffTime);
      if (floorCur > 1) {
        onTimeUpdateRef.current?.(floorCur, totalDur);
      }
    };
  }, []);

  useEffect(() => {
    if (!hlsUrl || !hlsUrl.includes('/api/filelist/stream')) {
      setTorrentLiveStats(null);
      return;
    }
    let active = true;
    const idMatch = hlsUrl.match(/[?&]id=(-?\d+)/);
    const fileIdxMatch = hlsUrl.match(/[?&]fileIdx=(\d+)/);
    const queryParts: string[] = [];
    if (idMatch) queryParts.push(`id=${idMatch[1]}`);
    if (fileIdxMatch) queryParts.push(`fileIdx=${fileIdxMatch[1]}`);
    const idQuery = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    let statsOrigin = '';
    if (hlsUrl.startsWith('http://') || hlsUrl.startsWith('https://')) {
      try {
        statsOrigin = new URL(hlsUrl).origin;
      } catch {
        statsOrigin = '';
      }
    }
    const fetchStats = () => {
      if (!isOsdVisibleRef.current && videoDurationSecRef.current > 60) {
        return;
      }
      fetch(`${statsOrigin}/api/filelist/stats${idQuery}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (active && d && d.ok && d.active) {
            const nextSpeed = d.downloadSpeedText || 'Buffer HD';
            const nextPeers = Number(d.numPeers || 0);
            const nextSource = d.source || 'FileList.io';
            if (isOsdVisibleRef.current) {
              setTorrentLiveStats((prev) =>
                prev &&
                  prev.downloadSpeedText === nextSpeed &&
                  prev.numPeers === nextPeers &&
                  prev.source === nextSource
                  ? prev
                  : {
                    downloadSpeedText: nextSpeed,
                    numPeers: nextPeers,
                    source: nextSource,
                  }
              );
            }
            const probedDur = Number(d.durationSec || 0);
            if (Number.isFinite(probedDur) && probedDur > 60) {
              setVideoDurationSec((prev) =>
                Math.abs(prev - probedDur) < 1 ? prev : probedDur
              );
            }
          }
        })
        .catch(() => { });
    };
    fetchStats();
    const timer = window.setInterval(fetchStats, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [hlsUrl]);
  const [seekToast, setSeekToast] = useState<string | null>(null);
  const seekToastTimerRef = useRef<number | null>(null);
  const [seekHudData, setSeekHudData] = useState<SeekHudData | null>(null);
  const [isSeekBuffering, setIsSeekBuffering] = useState<boolean>(false);
  const seekHudTimerRef = useRef<number | null>(null);
  const cumulativeSeekDeltaSecRef = useRef<number>(0);
  const lastSeekTriggerWallMsRef = useRef<number>(0);
  const lastLiveScrubMsRef = useRef<number>(0);

  const [audioTracks, setAudioTracks] = useState<
    Array<{ id: number; name: string }>
  >(() =>
    audioTrackLabels.map((name, idx) => ({
      id: idx,
      name,
    }))
  );
  const [activeAudioTrack, setActiveAudioTrack] = useState<number>(() =>
    forcedAudioIdx >= 0 ? forcedAudioIdx : 0
  );
  const [qualityLevels, setQualityLevels] = useState<
    Array<{ index: number; height: number }>
  >([]);
  const [activeQuality, setActiveQuality] = useState<number>(-1);
  const [liveVideoDims, setLiveVideoDims] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });

  const syncVideoDims = (v?: HTMLVideoElement | null) => {
    const el = v || videoRef.current;
    if (!el) return;
    const w = el.videoWidth || 0;
    const h = el.videoHeight || 0;
    if (w > 0 && h > 0) {
      setLiveVideoDims((prev) =>
        prev.width === w && prev.height === h ? prev : { width: w, height: h }
      );
      if (!hasNotifiedInitialPlayOsdRef.current) {
        hasNotifiedInitialPlayOsdRef.current = true;
        onWakeOsd?.();
      }
      hasNotifiedInitialPlayOsdRef.current = true;
    }
  };

  const resolutionReport = useMemo<VodResolutionReport>(() => {
    const selectedLevelObj =
      activeQuality >= 0
        ? qualityLevels.find((q) => q.index === activeQuality)
        : undefined;
    const rawW = liveVideoDims.width;
    const rawH = liveVideoDims.height;
    const badgeHeight = parseQualityHeightFromString(sourceQualityBadge);
    const fallbackH =
      selectedLevelObj?.height ||
      qualityLevels[0]?.height ||
      badgeHeight ||
      1080;
    const detectedH =
      rawH > 0 ? normalizeVideoQualityHeight(rawW, rawH) : fallbackH;
    const normHeight =
      qualityLevels.length === 0 && badgeHeight >= 2160
        ? Math.max(detectedH, badgeHeight)
        : detectedH;
    const badgeLabel = formatQualityTierLabel(normHeight);
    const dimsLabel =
      rawW > 0 && rawH > 0
        ? `${rawW}×${rawH}`
        : defaultDimsForHeight(normHeight);
    const fullLabel = dimsLabel ? `${badgeLabel} (${dimsLabel})` : badgeLabel;

    return {
      width: rawW,
      height: rawH,
      normHeight,
      badgeLabel,
      dimsLabel,
      fullLabel,
      isAuto: activeQuality === -1,
      activeQualityIndex: activeQuality,
      availableLevels: qualityLevels.map((q, idx) => ({
        index: q.index,
        height: q.height,
        label: `${formatQualityTierLabel(q.height)}${idx === 0 && qualityLevels.length > 1 ? ' (Maxim)' : ''
          }`,
        active: activeQuality === q.index,
      })),
    };
  }, [liveVideoDims, activeQuality, qualityLevels, sourceQualityBadge]);

  useEffect(() => {
    onResolutionChange?.(resolutionReport);
  }, [resolutionReport, onResolutionChange]);

  const handleSelectQualityLevel = (levelIdx: number) => {
    setActiveQuality(levelIdx);
    highestLevelIndexRef.current = levelIdx;

    if (dashRef.current) {
      if (levelIdx === -1) {
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
          levelIdx,
          true
        );
      }
    }

    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIdx;
      if (levelIdx >= 0) {
        hlsRef.current.nextLevel = levelIdx;
        hlsRef.current.loadLevel = levelIdx;
        hlsRef.current.nextLoadLevel = levelIdx;
      }
    }

    const pickedLvl =
      levelIdx >= 0
        ? qualityLevels.find((q) => q.index === levelIdx)
        : undefined;
    if (pickedLvl?.height) {
      const approxW = Math.round((pickedLvl.height * 16) / 9);
      setLiveVideoDims({ width: approxW, height: pickedLvl.height });
    }
    const toastLabel = pickedLvl
      ? `${formatQualityTierLabel(pickedLvl.height)} (${defaultDimsForHeight(pickedLvl.height)})`
      : `Auto (${resolutionReport.badgeLabel})`;
    setSeekToast(`Rezoluție: ${toastLabel}`);
    if (seekToastTimerRef.current) {
      window.clearTimeout(seekToastTimerRef.current);
    }
    seekToastTimerRef.current = window.setTimeout(() => {
      setSeekToast(null);
    }, 1800);
    onWakeOsd?.();
  };

  const handleSelectQualityLevelRef = useRef(handleSelectQualityLevel);
  handleSelectQualityLevelRef.current = handleSelectQualityLevel;

  useEffect(() => {
    if (audioTrackLabels.length > 0 && audioTracks.length === 0) {
      setAudioTracks(
        audioTrackLabels.map((name, idx) => ({
          id: idx,
          name,
        }))
      );
    }
  }, [audioTrackLabels, audioTracks.length]);

  const ensureAutoPlay = (video: HTMLVideoElement) => {
    video.muted = false;
    video
      .play()
      .then(() => {
        if (!video.muted) {
          setIsAutoMuted(false);
        }
        setStatus('playing');
      })
      .catch((err: unknown) => {
        const errName = (err as { name?: string })?.name || '';
        // Only mute if the browser explicitly blocked unmuted autoplay (never on AbortError when switching src)
        if (errName === 'NotAllowedError') {
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
        }
      });
  };

  const flBufferingTimerRef = useRef<number | null>(null);

  const cleanupFileListMse = () => {
    if (flBufferingTimerRef.current) {
      window.clearTimeout(flBufferingTimerRef.current);
      flBufferingTimerRef.current = null;
    }
    if (flSeekDebounceRef.current) {
      window.clearTimeout(flSeekDebounceRef.current);
      flSeekDebounceRef.current = null;
    }
    if (flStreamAbortRef.current) {
      try {
        flStreamAbortRef.current.abort();
      } catch {
        // ignore
      }
      flStreamAbortRef.current = null;
    }
    if (flSourceBufferRef.current && flMediaSourceRef.current) {
      try {
        if (flMediaSourceRef.current.readyState === 'open') {
          flSourceBufferRef.current.abort();
          flMediaSourceRef.current.removeSourceBuffer(
            flSourceBufferRef.current
          );
        }
      } catch {
        // ignore
      }
    }
    flSourceBufferRef.current = null;
    flMediaSourceRef.current = null;
    if (flMseUrlRef.current) {
      try {
        URL.revokeObjectURL(flMseUrlRef.current);
      } catch {
        // ignore
      }
      flMseUrlRef.current = null;
    }
  };

  const flMseReaderDoneRef = useRef<boolean>(false);
  const flRetryCountRef = useRef<number>(0);
  const flStallStrikeRef = useRef<number>(0);

  const loadFileListStreamIntoVideo = (
    video: HTMLVideoElement,
    rawFlStreamUrl: string
  ) => {
    cleanupFileListMse();
    flMseReaderDoneRef.current = false;
    appliedStartRef.current = true;
    lastTimeUpdateWallMsRef.current = Date.now();

    const isHardwareTv = isSmartTvDevice();
    const supports4kAvcLevel51 =
      !isHardwareTv &&
      typeof window !== 'undefined' &&
      typeof window.MediaSource !== 'undefined' &&
      typeof window.MediaSource.isTypeSupported === 'function' &&
      window.MediaSource.isTypeSupported(
        'video/mp4; codecs="avc1.640033, mp4a.40.2"'
      );
    const flStreamUrl =
      !supports4kAvcLevel51 &&
        rawFlStreamUrl.includes('/api/filelist/stream') &&
        !/[?&]maxw=\d+/.test(rawFlStreamUrl)
        ? `${rawFlStreamUrl}${rawFlStreamUrl.includes('?') ? '&' : '?'}maxw=1920`
        : rawFlStreamUrl;

    const isIosWebKit =
      typeof navigator !== 'undefined' &&
      (/iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
        (/Safari/i.test(navigator.userAgent) &&
          !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Opera|Vivaldi|YaBrowser|Brave/i.test(
            navigator.userAgent
          )));

    const startMsePump = () => {
      if (
        typeof window === 'undefined' ||
        typeof window.MediaSource === 'undefined'
      ) {
        video.src = flStreamUrl;
        ensureAutoPlay(video);
        return;
      }

      try {
        video.pause();
      } catch {
        // ignore
      }

      const controller = new AbortController();
      flStreamAbortRef.current = controller;
      const ms = new window.MediaSource();
      flMediaSourceRef.current = ms;
      const mseUrl = URL.createObjectURL(ms);
      flMseUrlRef.current = mseUrl;
      video.src = mseUrl;

      let hasFiredPlaying = false;
      const onStreamPlaying = () => {
        if (flBufferingTimerRef.current) {
          window.clearTimeout(flBufferingTimerRef.current);
          flBufferingTimerRef.current = null;
        }
        hasFiredPlaying = true;
        isSeekingFileListRef.current = false;
        setIsSeekBuffering(false);
        setSeekHudData(null);
        hideFrozenFrame();
        setStatus('playing');
      };
      video.addEventListener('playing', onStreamPlaying, { once: true });

      ms.addEventListener(
        'sourceopen',
        async () => {
          let receivedFirstChunk = false;
          try {
            const res = await fetch(flStreamUrl, {
              signal: controller.signal,
            });
            const durHeader = Number(res.headers.get('X-Content-Duration') || 0);
            if (durHeader > 5) {
              setVideoDurationSec(durHeader);
            }
            if (res.status >= 500) {
              isSeekingFileListRef.current = false;
              setIsSeekBuffering(false);
              setSeekHudData(null);
              hideFrozenFrame();
              onStreamError?.();
              return;
            }
            if (
              !res.ok ||
              !res.body ||
              typeof res.body.getReader !== 'function'
            ) {
              isSeekingFileListRef.current = false;
              setIsSeekBuffering(false);
              setSeekHudData(null);
              video.src = flStreamUrl;
              ensureAutoPlay(video);
              return;
            }

            const reader = res.body.getReader();
            const readChunkWithTimeout = async (timeoutMs: number) => {
              let timerId: number | null = null;
              try {
                const timeoutPromise = new Promise<never>((_, reject) => {
                  timerId = window.setTimeout(() => {
                    reject(new Error('__FL_STALL_TIMEOUT__'));
                  }, timeoutMs);
                });
                return await Promise.race([reader.read(), timeoutPromise]);
              } finally {
                if (timerId !== null) {
                  window.clearTimeout(timerId);
                }
              }
            };

            const first = await readChunkWithTimeout(14000);
            if (!first.done && first.value) {
              receivedFirstChunk = true;
            }
            if (first.done || !first.value) {
              if (!controller.signal.aborted) {
                isSeekingFileListRef.current = false;
                flMseReaderDoneRef.current = true;
                if (flRetryCountRef.current < 2) {
                  flRetryCountRef.current += 1;
                  window.setTimeout(() => {
                    if (!controller.signal.aborted && videoRef.current === video) {
                      loadFileListStreamIntoVideo(video, flStreamUrl);
                    }
                  }, 1000);
                } else if (onStreamError && !userIntentionallyPausedRef.current) {
                  hideFrozenFrame();
                  onStreamError();
                }
              }
              return;
            }

            flRetryCountRef.current = 0;
            let initBuf = new Uint8Array(first.value);
            while (initBuf.length < 1536 && !controller.signal.aborted) {
              const nextPart = await readChunkWithTimeout(8000);
              if (nextPart.done || !nextPart.value) break;
              const merged = new Uint8Array(
                initBuf.length + nextPart.value.length
              );
              merged.set(initBuf, 0);
              merged.set(nextPart.value, initBuf.length);
              initBuf = merged;
            }
            let avcHex = '640028';
            for (let i = 0; i < initBuf.length - 8; i++) {
              if (
                initBuf[i] === 0x61 &&
                initBuf[i + 1] === 0x76 &&
                initBuf[i + 2] === 0x63 &&
                initBuf[i + 3] === 0x43
              ) {
                const p = initBuf[i + 5].toString(16).padStart(2, '0');
                const c = initBuf[i + 6].toString(16).padStart(2, '0');
                const l = initBuf[i + 7].toString(16).padStart(2, '0');
                avcHex = `${p}${c}${l}`;
                break;
              }
            }

            const candidateCodec = `video/mp4; codecs="avc1.${avcHex}, mp4a.40.2"`;
            const avcLevelByte = parseInt(avcHex.slice(4, 6), 16) || 0x28;
            if (
              avcLevelByte >= 0x32 &&
              !window.MediaSource.isTypeSupported(candidateCodec) &&
              flStreamUrl.includes('/api/filelist/stream') &&
              !/[?&]vtranscode=1/.test(flStreamUrl)
            ) {
              // Sony Bravia / MediaTek Android TV H.264 decoders max out at 1080p Level 4.1/4.2;
              // never feed a 4K Level 5.1 stream into a fake avc1.640028 SourceBuffer (causes audio-only black screen).
              try {
                await reader.cancel();
              } catch {
                // ignore
              }
              const retry1080Url = `${flStreamUrl.replace(/([?&])maxw=\d+/g, '')}${flStreamUrl.includes('?') ? '&' : '?'
                }maxw=1920&vtranscode=1`;
              loadFileListStreamIntoVideo(video, retry1080Url);
              return;
            }
            const fallbackCodec =
              'video/mp4; codecs="avc1.640028, mp4a.40.2"';
            const mime = window.MediaSource.isTypeSupported(candidateCodec)
              ? candidateCodec
              : fallbackCodec;

            let sb: SourceBuffer;
            try {
              sb = ms.addSourceBuffer(mime);
            } catch {
              try {
                reader.cancel();
              } catch {
                // ignore
              }
              isSeekingFileListRef.current = false;
              video.src = flStreamUrl;
              ensureAutoPlay(video);
              return;
            }
            flSourceBufferRef.current = sb;
            const waitUpdate = () =>
              new Promise<void>((resolve) => {
                if (!sb.updating) {
                  resolve();
                  return;
                }
                sb.addEventListener('updateend', () => resolve(), {
                  once: true,
                });
              });

            try {
              sb.appendBuffer(initBuf);
              await waitUpdate();
            } catch {
              try {
                reader.cancel();
              } catch {
                // ignore
              }
              isSeekingFileListRef.current = false;
              video.src = flStreamUrl;
              ensureAutoPlay(video);
              return;
            }
            let startedPlay = false;
            let didAlignInitialStart = false;
            let maxAheadSec = isHardwareTv ? 55 : 95;
            const keepBehindMaxSec = isHardwareTv ? 50 : 85;
            const keepBehindTargetSec = isHardwareTv ? 32 : 55;
            let lastEvictMediaSec = -999;
            let bytesAppendedSinceOpen = 0;

            const getContigAheadSec = () => {
              if (sb.buffered.length === 0) return 0;
              const curT = video.currentTime || 0;
              for (let i = 0; i < sb.buffered.length; i++) {
                const rStart = sb.buffered.start(i);
                const rEnd = sb.buffered.end(i);
                if (curT >= rStart - 0.5 && curT <= rEnd + 0.5) {
                  return Math.max(0, rEnd - curT);
                }
              }
              return sb.buffered.length === 1
                ? Math.max(0, sb.buffered.end(0) - curT)
                : 0;
            };

            const checkAndStartPlayback = () => {
              if (sb.buffered.length > 0) {
                const bStart = sb.buffered.start(0);
                const bEnd = sb.buffered.end(sb.buffered.length - 1);
                if (!startedPlay && !didAlignInitialStart) {
                  const expectedMinAbs =
                    streamOffsetRef.current >= 20
                      ? Math.max(10, streamOffsetRef.current * 0.5)
                      : Math.max(5, streamOffsetRef.current - 12);
                  if (
                    streamOffsetRef.current >= 10 &&
                    bStart >= expectedMinAbs
                  ) {
                    // FFmpeg preserved absolute container tfdt timestamps; avoid doubling streamOffsetRef + video.currentTime!
                    streamOffsetRef.current = 0;
                    setStreamOffsetSec(0);
                  }
                }
                if (
                  !startedPlay &&
                  !didAlignInitialStart &&
                  bStart > 0.04 &&
                  video.currentTime < bStart - 0.01
                ) {
                  didAlignInitialStart = true;
                  try {
                    video.currentTime = bStart + 0.02;
                  } catch {
                    // ignore
                  }
                }
                if (
                  !startedPlay &&
                  (video.readyState >= 2 || bEnd - bStart >= 0.45)
                ) {
                  startedPlay = true;
                  appliedStartRef.current = true;
                  lastTimeUpdateWallMsRef.current = Date.now();
                  isSeekingFileListRef.current = false;
                  syncVideoDims(video);
                  ensureAutoPlay(video);
                  setStatus('playing');
                  onWakeOsd?.();
                } else if (
                  startedPlay &&
                  !hasFiredPlaying &&
                  video.paused &&
                  video.readyState >= 2 &&
                  !userIntentionallyPausedRef.current
                ) {
                  ensureAutoPlay(video);
                }
              } else if (!startedPlay && video.readyState >= 2) {
                startedPlay = true;
                appliedStartRef.current = true;
                lastTimeUpdateWallMsRef.current = Date.now();
                isSeekingFileListRef.current = false;
                syncVideoDims(video);
                ensureAutoPlay(video);
                setStatus('playing');
                onWakeOsd?.();
              }
            };

            checkAndStartPlayback();

            while (!controller.signal.aborted) {
              const curBefore = video.currentTime || 0;
              if (sb.buffered.length > 0) {
                const bStart = sb.buffered.start(0);
                if (
                  curBefore - bStart > keepBehindMaxSec &&
                  curBefore - lastEvictMediaSec >= 4.0
                ) {
                  const trimTo = curBefore - keepBehindTargetSec;
                  if (trimTo > bStart + 2.0) {
                    lastEvictMediaSec = curBefore;
                    try {
                      sb.remove(bStart, trimTo);
                      await waitUpdate();
                    } catch {
                      // ignore
                    }
                  }
                }
              }

              while (
                !controller.signal.aborted &&
                getContigAheadSec() > maxAheadSec
              ) {
                if (
                  !hasFiredPlaying &&
                  video.paused &&
                  video.readyState >= 2 &&
                  !userIntentionallyPausedRef.current
                ) {
                  ensureAutoPlay(video);
                }
                await new Promise((r) => window.setTimeout(r, 250));
              }
              if (controller.signal.aborted) break;

              const contigAhead = getContigAheadSec();
              const readTimeoutMs =
                contigAhead < 3.0 && !userIntentionallyPausedRef.current
                  ? 24000
                  : 45000;
              const { done, value } = await readChunkWithTimeout(readTimeoutMs);
              if (done || !value) {
                flMseReaderDoneRef.current = true;
                isSeekingFileListRef.current = false;
                if (!controller.signal.aborted) {
                  try {
                    if (sb.buffered.length > 0) {
                      const exactEnd =
                        streamOffsetRef.current +
                        sb.buffered.end(sb.buffered.length - 1);
                      const knownTotalDur =
                        durHeader > 60
                          ? durHeader
                          : videoDurationSec > 60
                            ? videoDurationSec
                            : durationHintSec && durationHintSec > 60
                              ? durationHintSec
                              : 0;
                      const isNearRealEnd =
                        exactEnd > 300 &&
                        (knownTotalDur > 300
                          ? exactEnd >= knownTotalDur - 45
                          : exactEnd > 1800);
                      if (isNearRealEnd) {
                        setVideoDurationSec((prev) =>
                          prev > exactEnd ? prev : exactEnd
                        );
                        await waitUpdate();
                        if (ms.readyState === 'open') {
                          ms.endOfStream();
                        }
                      } else {
                        // Premature EOF mid-episode: play remaining MSE buffer down to 2s, then reconnect or fail over!
                        while (
                          !controller.signal.aborted &&
                          getContigAheadSec() > 2.0
                        ) {
                          await new Promise((r) => window.setTimeout(r, 300));
                        }
                        if (
                          !controller.signal.aborted &&
                          !userIntentionallyPausedRef.current &&
                          videoRef.current === video
                        ) {
                          const resumeAt = Math.max(
                            0,
                            Math.floor(
                              streamOffsetRef.current +
                              (video.currentTime || 0)
                            )
                          );
                          if (flStallStrikeRef.current >= 2 && onStreamError) {
                            hideFrozenFrame();
                            onStreamError();
                          } else if (resumeAt > 5) {
                            flStallStrikeRef.current += 1;
                            const cleanBase = flStreamUrl
                              .replace(/([?&])start=\d+/g, '')
                              .replace(/([?&])audio=\d+/g, '');
                            const sep = cleanBase.includes('?') ? '&' : '?';
                            const audioParam =
                              forcedAudioIdx >= 0 ? forcedAudioIdx : 0;
                            streamOffsetRef.current = resumeAt;
                            setStreamOffsetSec(resumeAt);
                            loadFileListStreamIntoVideo(
                              video,
                              `${cleanBase}${sep}start=${resumeAt}&audio=${audioParam}`
                            );
                          } else if (onStreamError) {
                            hideFrozenFrame();
                            onStreamError();
                          }
                        }
                      }
                    } else if (onStreamError && !userIntentionallyPausedRef.current) {
                      hideFrozenFrame();
                      onStreamError();
                    }
                  } catch {
                    // ignore
                  }
                }
                break;
              }

              // Lossless MSE append loop: NEVER discard `value` when hardware Smart TV hits QuotaExceededError!
              let appendedOk = false;
              let quotaRetries = 0;
              while (!controller.signal.aborted && !appendedOk) {
                try {
                  sb.appendBuffer(value);
                  await waitUpdate();
                  appendedOk = true;
                } catch (appendErr: unknown) {
                  if (ms.readyState !== 'open') {
                    break;
                  }
                  const errName = (appendErr as { name?: string })?.name || '';
                  const errCode = (appendErr as { code?: number })?.code;
                  const isQuota =
                    errName === 'QuotaExceededError' ||
                    errName === 'QuotaExceeded' ||
                    errCode === 22 ||
                    String(appendErr).toLowerCase().includes('quota');
                  if (!isQuota) {
                    break;
                  }
                  if (!userIntentionallyPausedRef.current) {
                    quotaRetries += 1;
                  }
                  checkAndStartPlayback();

                  const curNow = video.currentTime || 0;
                  if (sb.buffered.length > 0) {
                    const b0 = sb.buffered.start(0);
                    const bEnd = sb.buffered.end(sb.buffered.length - 1);
                    const aheadNow = Math.max(0, bEnd - curNow);
                    if (aheadNow > 4) {
                      maxAheadSec = Math.max(
                        5,
                        Math.min(maxAheadSec, Math.floor(aheadNow * 0.8))
                      );
                    }
                    const safeMargin = quotaRetries <= 2 ? 4.0 : 2.0;
                    const evictTo = curNow - safeMargin;
                    if (evictTo > b0 + 0.4) {
                      try {
                        sb.remove(b0, evictTo);
                        await waitUpdate();
                        continue;
                      } catch {
                        // fall through to short wait
                      }
                    }
                  }

                  if (quotaRetries > 60) {
                    break;
                  }
                  if (
                    video.paused &&
                    video.readyState >= 2 &&
                    !userIntentionallyPausedRef.current
                  ) {
                    ensureAutoPlay(video);
                  }
                  await new Promise((r) => window.setTimeout(r, 250));
                }
              }

              if (!appendedOk) {
                if (!controller.signal.aborted) {
                  try {
                    await reader.cancel();
                  } catch {
                    // ignore
                  }
                }
                break;
              }

              bytesAppendedSinceOpen += value.byteLength;
              if (bytesAppendedSinceOpen >= 1024 * 1024 && hasFiredPlaying) {
                flStallStrikeRef.current = 0;
              }

              checkAndStartPlayback();
            }
          } catch (pumpErr: unknown) {
            if (!controller.signal.aborted) {
              flMseReaderDoneRef.current = true;
              isSeekingFileListRef.current = false;
              const isStallTimeout =
                (pumpErr as { message?: string })?.message ===
                '__FL_STALL_TIMEOUT__';
              const resumeAt = Math.max(
                0,
                Math.floor(
                  streamOffsetRef.current + (video.currentTime || 0) ||
                  startAtSecondsRef.current ||
                  0
                )
              );
              const durReport =
                videoDurationSec > 60
                  ? videoDurationSec
                  : durationHintSec > 60
                    ? durationHintSec
                    : Math.max(resumeAt + 30, 3600);
              if (resumeAt > 5) {
                onTimeUpdate?.(resumeAt, Math.floor(durReport));
              }
              if (isStallTimeout && !userIntentionallyPausedRef.current) {
                if (
                  receivedFirstChunk &&
                  flStallStrikeRef.current < 2 &&
                  videoRef.current === video
                ) {
                  flStallStrikeRef.current += 1;
                  const cleanBase = flStreamUrl
                    .replace(/([?&])start=\d+/g, '')
                    .replace(/([?&])audio=\d+/g, '');
                  const sep = cleanBase.includes('?') ? '&' : '?';
                  const audioParam = forcedAudioIdx >= 0 ? forcedAudioIdx : 0;
                  streamOffsetRef.current = resumeAt;
                  setStreamOffsetSec(resumeAt);
                  loadFileListStreamIntoVideo(
                    video,
                    `${cleanBase}${sep}start=${resumeAt}&audio=${audioParam}`
                  );
                } else {
                  hideFrozenFrame();
                  onStreamError?.();
                }
              }
            }
          }
        },
        { once: true }
      );
    };

    if (
      !isIosWebKit &&
      flStreamUrl.includes('/api/filelist/stream') &&
      typeof window !== 'undefined' &&
      typeof window.MediaSource !== 'undefined'
    ) {
      startMsePump();
      return;
    }

    const effectiveFlUrl =
      isIosWebKit && flStreamUrl.includes('/api/filelist/stream')
        ? flStreamUrl.replace('/api/filelist/stream', '/api/filelist/hls.m3u8')
        : flStreamUrl;

    let retriedAltFormat = false;
    let retriedSameFormat = false;
    const clearSafariSeekOverlays = () => {
      if (flBufferingTimerRef.current) {
        window.clearTimeout(flBufferingTimerRef.current);
        flBufferingTimerRef.current = null;
      }
      isSeekingFileListRef.current = false;
      setIsSeekBuffering(false);
      setSeekHudData(null);
      hideFrozenFrame();
      setStatus('playing');
    };
    video.addEventListener('playing', clearSafariSeekOverlays, { once: true });
    video.addEventListener('canplay', clearSafariSeekOverlays, { once: true });
    video.src = effectiveFlUrl;
    video.onloadedmetadata = () => {
      isSeekingFileListRef.current = false;
      appliedStartRef.current = true;
      lastTimeUpdateWallMsRef.current = Date.now();
      syncVideoDims(video);
      ensureAutoPlay(video);
      setStatus('playing');
      onWakeOsd?.();
    };
    video.onerror = () => {
      video.removeEventListener('playing', clearSafariSeekOverlays);
      video.removeEventListener('canplay', clearSafariSeekOverlays);
      if (!retriedSameFormat) {
        retriedSameFormat = true;
        window.setTimeout(() => {
          if (videoRef.current === video) {
            video.addEventListener('playing', clearSafariSeekOverlays, { once: true });
            video.src = effectiveFlUrl;
            ensureAutoPlay(video);
          }
        }, 700);
        return;
      }
      if (!retriedAltFormat) {
        retriedAltFormat = true;
        if (effectiveFlUrl.includes('/api/filelist/hls.m3u8') && !isIosWebKit) {
          video.addEventListener('playing', clearSafariSeekOverlays, { once: true });
          video.src = effectiveFlUrl.replace(
            '/api/filelist/hls.m3u8',
            '/api/filelist/stream'
          );
          ensureAutoPlay(video);
          return;
        }
        if (
          !isIosWebKit &&
          flStreamUrl.includes('/api/filelist/stream') &&
          typeof window !== 'undefined' &&
          typeof window.MediaSource !== 'undefined'
        ) {
          startMsePump();
          return;
        }
      }
      if (flBufferingTimerRef.current) {
        window.clearTimeout(flBufferingTimerRef.current);
        flBufferingTimerRef.current = null;
      }
      isSeekingFileListRef.current = false;
      setIsSeekBuffering(false);
      setSeekHudData(null);
      hideFrozenFrame();
      setStatus('error');
      onStreamError?.();
    };
    ensureAutoPlay(video);
  };

  const hasActiveSubtitleRef = useRef<boolean>(false);
  const hasEmbeddedMkvSubPending = Boolean(
    embeddedSubtitleTracks &&
    embeddedSubtitleTracks.length > 0 &&
    (preferredSubLang || 'ro') !== 'off' &&
    hlsUrl &&
    (hlsUrl.includes('/api/filelist/stream') || hlsUrl.includes('/api/filelist/hls'))
  );
  hasActiveSubtitleRef.current =
    Boolean(subtitleVttUrl) ||
    Boolean(subtitleLabel) ||
    (subtitleCues && subtitleCues.length > 0) ||
    hasEmbeddedMkvSubPending;
  const subtitleLabelRef = useRef<string | undefined>(subtitleLabel);
  subtitleLabelRef.current = subtitleLabel;
  const openMenuRef = useRef(openMenu);
  openMenuRef.current = openMenu;
  const preferredSubLangRef = useRef<string>(preferredSubLang || 'ro');
  preferredSubLangRef.current = preferredSubLang || 'ro';
  const applyAutoSubCbRef = useRef(onApplyAutoSubtitle);
  applyAutoSubCbRef.current = onApplyAutoSubtitle;

  // Fetch available subtitles automatically in the background (Lampa style) & auto-enable RO -> EN -> RU
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

        // Automatically activate subtitle by default according to profile's preferredSubLang ('ro' | 'en' | 'ru' | 'es' | 'fr' | 'de' | 'off')
        const effSubLang =
          preferredSubLangRef.current || getActiveProfileMediaPrefs().defaultSubLang || 'ro';
        if (
          effSubLang !== 'off' &&
          !hasActiveSubtitleRef.current &&
          list.length > 0 &&
          applyAutoSubCbRef.current
        ) {
          const allLangs = ['ro', 'en', 'ru', 'es', 'fr', 'de'];
          const prefOrder = [
            effSubLang,
            ...allLangs.filter((l) => l !== effSubLang),
          ];
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
              if (!cancelled && cues.length > 0 && !hasActiveSubtitleRef.current) {
                setActiveSubTrackId(autoTrack.id);
                applyAutoSubCbRef.current?.({
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
      if (video && video.paused && !userIntentionallyPausedRef.current) {
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

    const normalizedHlsKey = (hlsUrl || '')
      .replace(/([?&])(subLang|subIdx)=[^&]*/gi, '')
      .replace(/[?&]+$/, '');
    const nextMediaKey = `${season}_${episode}_${normalizedHlsKey}_${dashUrl || ''}`;
    const isSameEpisodeStream =
      activeEpisodeMediaKeyRef.current === nextMediaKey;
    activeEpisodeMediaKeyRef.current = nextMediaKey;

    if (isSameEpisodeStream && (streamOffsetRef.current + video.currentTime) > 3) {
      startAtSecondsRef.current = Math.floor(
        streamOffsetRef.current + video.currentTime
      );
    } else if (!isSameEpisodeStream) {
      const safeStart = startAtSeconds || 0;
      startAtSecondsRef.current = safeStart;
      streamOffsetRef.current = 0;
      setStreamOffsetSec(0);
      setCurrentTimeSec(safeStart);
      watchedTicksInEpisodeRef.current = 0;
    }
    appliedStartRef.current = false;
    hasNotifiedInitialPlayOsdRef.current = false;
    hasRenderedFirstFrameRef.current = false;
    lastTimeUpdateWallMsRef.current = Date.now();
    setIsSeekBuffering(false);
    setStatus('loading');
    setIsAutoMuted(false);
    setLiveVideoDims({ width: 0, height: 0 });
    if (offlineItem) {
      setAudioTracks([
        {
          id: 0,
          name: offlineItem.audioLabel || audioTrackLabels[0] || 'Audio Offline',
        },
      ]);
      setActiveAudioTrack(0);
      setForcedAudioIdx(0);
    } else if (audioTrackLabels.length > 0) {
      setAudioTracks(
        audioTrackLabels.map((name, idx) => ({
          id: idx,
          name,
        }))
      );
    } else {
      setAudioTracks([]);
    }
    setQualityLevels([]);
    setActiveQuality(-1);

    let objectUrlToRevoke: string | null = null;
    let cancelled = false;

    const cleanup = () => {
      if (nativeHlsFallbackTimerRef.current !== null) {
        window.clearTimeout(nativeHlsFallbackTimerRef.current);
        nativeHlsFallbackTimerRef.current = null;
      }
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
      cleanupFileListMse();
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
        objectUrlToRevoke = null;
      }
      if (video) {
        video.onloadedmetadata = null;
        video.onerror = null;
        if (video.getAttribute('src')) {
          try {
            video.pause();
            video.removeAttribute('src');
            video.load();
          } catch {
            // ignore
          }
        }
      }
    };

    const applyInitialSeek = () => {
      const targetStart = startAtSecondsRef.current;
      if (
        !appliedStartRef.current &&
        targetStart > 5 &&
        video &&
        Number.isFinite(video.duration) &&
        video.duration > 10
      ) {
        const clampedTarget = Math.min(
          targetStart,
          Math.max(0, video.duration - 5)
        );
        if (Math.abs(video.currentTime - clampedTarget) <= 15) {
          if (!video.seeking && video.readyState >= 2) {
            appliedStartRef.current = true;
          }
        } else if (
          Date.now() - lastSeekAttemptMsRef.current >=
          (hlsRef.current ? 16000 : 2500)
        ) {
          lastSeekAttemptMsRef.current = Date.now();
          try {
            video.currentTime = clampedTarget;
            if (hlsRef.current) {
              hlsRef.current.startLoad(clampedTarget);
            }
          } catch {
            // ignore
          }
        }
      }
    };

    const isHardwareSmartTv = isSmartTvDevice();

    const isSmartTvEnv =
      typeof window !== 'undefined' &&
      (document.documentElement.classList.contains('smart-tv-mode') ||
        window.location.pathname.toLowerCase().startsWith('/tv') ||
        isHardwareSmartTv);

    const isLocalDevLog =
      typeof window !== 'undefined' &&
      (window.location.port === '8769' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1');

    const logTvVod = (evt: string, detail = '') => {
      if (!isSmartTvEnv || !isLocalDevLog) return;
      try {
        fetch(
          `/api/tv-log?vod=${encodeURIComponent(evt)}&d=${encodeURIComponent(
            detail.slice(0, 180)
          )}`
        ).catch(() => { });
      } catch {
        // ignore
      }
    };

    const switchToNativeVideoHls = (targetUrl: string, reason: string) => {
      if (cancelled || !video) return;
      logTvVod('native_hls_fallback', reason);
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {
          // ignore
        }
        hlsRef.current = null;
      }
      let retriedNative = false;
      try {
        if (typeof document !== 'undefined' && document.head) {
          let meta = document.head.querySelector<HTMLMetaElement>(
            'meta[name="referrer"]'
          );
          if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'referrer';
            document.head.appendChild(meta);
          }
          if (meta.content !== 'no-referrer') {
            meta.content = 'no-referrer';
          }
        }
        video.setAttribute('referrerpolicy', 'no-referrer');
      } catch {
        // ignore
      }
      const initialFragSec =
        !appliedStartRef.current && startAtSecondsRef.current > 5
          ? Math.floor(startAtSecondsRef.current)
          : 0;
      const nativeSrcUrl =
        initialFragSec > 0 && !targetUrl.includes('#')
          ? `${targetUrl}#t=${initialFragSec}`
          : targetUrl;
      video.src = nativeSrcUrl;
      video.onloadedmetadata = () => {
        logTvVod('native_loadedmetadata', String(video.duration));
        syncVideoDims(video);
        // Populate & select native iOS / WebKit audio tracks if present
        const nativeAudioList = (video as unknown as {
          audioTracks?: {
            length: number;
            [index: number]: {
              id?: string;
              label?: string;
              language?: string;
              enabled?: boolean;
            };
          };
        }).audioTracks;
        if (nativeAudioList && nativeAudioList.length > 0) {
          const list: Array<{ id: number; name: string }> = [];
          for (let i = 0; i < nativeAudioList.length; i++) {
            const nt = nativeAudioList[i];
            list.push({
              id: i,
              name:
                audioTrackLabels[i] ||
                nt?.label ||
                (nt?.language
                  ? `Pista Audio ${i + 1} (${nt.language.toUpperCase()})`
                  : `Pista Audio ${i + 1}`),
            });
          }
          setAudioTracks(list);
          const profileAudioPref =
            getActiveProfileMediaPrefs().defaultAudioPref;
          const autoPrefIdx = resolveAudioTrackIndexByPreference(
            list.map((x) => x.name),
            profileAudioPref
          );
          const targetIdx =
            typeof initialAudioTrackIndex === 'number' &&
              initialAudioTrackIndex >= 0 &&
              initialAudioTrackIndex < list.length
              ? initialAudioTrackIndex
              : autoPrefIdx;
          for (let i = 0; i < nativeAudioList.length; i++) {
            if (nativeAudioList[i]) {
              nativeAudioList[i].enabled = i === targetIdx;
            }
          }
          setActiveAudioTrack(targetIdx);
        } else if (audioTrackLabels.length > 0) {
          setAudioTracks(
            audioTrackLabels.map((lbl, idx) => ({ id: idx, name: lbl }))
          );
        }
        applyInitialSeek();
        ensureAutoPlay(video);
        setStatus('playing');
      };
      video.onerror = () => {
        if (cancelled) return;
        const errCode = video.error ? video.error.code : 0;
        logTvVod('native_video_error', `code=${errCode}`);
        if (
          fallbackHlsUrl &&
          targetUrl !== fallbackHlsUrl &&
          (errCode === 4 ||
            reason === 'direct_mp4_stream' ||
            /(vkuser\.net|okcdn\.ru|mycdn\.me|vkuservideo\.net)/i.test(
              targetUrl
            ))
        ) {
          video.onerror = null;
          video.removeAttribute('src');
          video.load();
          startHlsPlayback(fallbackHlsUrl);
          return;
        }
        if (!retriedNative) {
          retriedNative = true;
          window.setTimeout(() => {
            if (!cancelled && video) {
              const initialFragSec =
                !appliedStartRef.current && startAtSecondsRef.current > 5
                  ? Math.floor(startAtSecondsRef.current)
                  : 0;
              const nativeSrcUrl =
                initialFragSec > 0 && !targetUrl.includes('#')
                  ? `${targetUrl}#t=${initialFragSec}`
                  : targetUrl;
              video.src = nativeSrcUrl;
              ensureAutoPlay(video);
            }
          }, 600);
          return;
        }
        setStatus('error');
        onStreamError?.();
      };
      ensureAutoPlay(video);
    };

    const isRealIosWebKit =
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('-webkit-touch-callout', 'none');
    const isIosMobile =
      typeof navigator !== 'undefined' &&
      isRealIosWebKit &&
      (/iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

    const startHlsPlayback = (targetUrl: string) => {
      if (!targetUrl) {
        setStatus('error');
        onStreamError?.();
        return;
      }

      logTvVod('start_hls', targetUrl);

      // Direct progressive MP4 / WebM / MKV URLs (e.g. Klubnichka 18+ or VK Video Direct MP4 with explicit vkq= height) must play natively via <video src> rather than hls.js.
      // Never route VK HLS playlists (ct=6 / m3u8 / without vkq=) to <video src> on Chromium/Android TV!
      const isExplicitVkMp4 =
        /(vkuser\.net|okcdn\.ru|mycdn\.me|vkuservideo\.net)/i.test(targetUrl) &&
        (/[?&]vkq=\d+/i.test(targetUrl) ||
          /(?:[?&]|%3F|%26)ct=[0145](?:[&%]|$)/i.test(targetUrl)) &&
        !/(?:[?&]|%3F|%26)ct=6(?:[&%]|$)/i.test(targetUrl);
      if (
        !offlineItem &&
        (/\.(mp4|webm|mkv)(\?|$)/i.test(targetUrl) || isExplicitVkMp4) &&
        !/\.m3u8(\?|%3F|&|$)/i.test(targetUrl) &&
        !/video\.m3u8/i.test(targetUrl)
      ) {
        switchToNativeVideoHls(targetUrl, 'direct_mp4_stream');
        return;
      }

      const canVideoPlayNativeHls = Boolean(
        video.canPlayType('application/vnd.apple.mpegurl') ||
        video.canPlayType('audio/mpegurl')
      );

      if (isIosMobile && canVideoPlayNativeHls) {
        if (offlineItem && offlineItem.mediaType === 'hls') {
          void buildIosNativeOfflineHlsBlobUrl(offlineItem)
            .then(({ masterBlobUrl }) => {
              if (cancelled) return;
              switchToNativeVideoHls(masterBlobUrl, 'ios_offline_blob_hls');
            })
            .catch(() => {
              if (!cancelled) setStatus('error');
            });
          return;
        }
        if (!offlineItem) {
          switchToNativeVideoHls(targetUrl, 'ios_native_hls');
          return;
        }
      }

      if (Hls.isSupported()) {
        try {
          video.disableRemotePlayback = false;
        } catch {
          // ignore
        }
        const hlsConfig: NonNullable<ConstructorParameters<typeof Hls>[0]> = {
          autoStartLoad: false,
          enableWorker: !isHardwareSmartTv,
          capLevelToPlayerSize: false,
          abrEwmaDefaultEstimate: 25_000_000,
          fragLoadPolicy: {
            default: {
              maxTimeToFirstByteMs: 18000,
              maxLoadTimeMs: 45000,
              timeoutRetry: {
                maxNumRetry: 4,
                retryDelayMs: 500,
                maxRetryDelayMs: 2000,
              },
              errorRetry: {
                maxNumRetry: 4,
                retryDelayMs: 500,
                maxRetryDelayMs: 3000,
              },
            },
          },
          playlistLoadPolicy: {
            default: {
              maxTimeToFirstByteMs: 15000,
              maxLoadTimeMs: 25000,
              timeoutRetry: {
                maxNumRetry: 3,
                retryDelayMs: 500,
                maxRetryDelayMs: 2000,
              },
              errorRetry: {
                maxNumRetry: 3,
                retryDelayMs: 500,
                maxRetryDelayMs: 2000,
              },
            },
          },
          enableCEA708Captions: false,
          enableWebVTT: false,
          enableIMSC1: false,
          startPosition:
            startAtSecondsRef.current > 5 ? startAtSecondsRef.current : -1,
          maxBufferLength: isHardwareSmartTv ? 45 : 75,
          maxMaxBufferLength: isHardwareSmartTv ? 90 : 150,
          maxBufferSize: isHardwareSmartTv ? 60 * 1000 * 1000 : 100 * 1000 * 1000,
          backBufferLength: isHardwareSmartTv ? 30 : 60,
        };
        if (offlineItem) {
          hlsConfig.loader = createOfflineAwareHlsLoader();
        }
        const hls = new Hls(hlsConfig);
        hls.subtitleDisplay = false;
        hls.subtitleTrack = -1;
        hlsRef.current = hls;
        let errorRetries = 0;

        hls.loadSource(targetUrl);
        hls.attachMedia(video);

        // Smart TV native HLS fallback: ONLY invoke <video src> if the browser natively supports M3U8
        // (never on WebOS/Chromium where canPlayType('application/vnd.apple.mpegurl') === '', which would cause MEDIA_ERR_SRC_NOT_SUPPORTED)
        if (nativeHlsFallbackTimerRef.current !== null) {
          window.clearTimeout(nativeHlsFallbackTimerRef.current);
          nativeHlsFallbackTimerRef.current = null;
        }
        if (canVideoPlayNativeHls && !offlineItem) {
          nativeHlsFallbackTimerRef.current = window.setTimeout(() => {
            nativeHlsFallbackTimerRef.current = null;
            if (
              !cancelled &&
              video &&
              video.currentTime === 0 &&
              video.readyState === 0 &&
              (!video.buffered || video.buffered.length === 0) &&
              !offlineItem &&
              canVideoPlayNativeHls
            ) {
              switchToNativeVideoHls(targetUrl, 'mse_stall_timeout');
            }
          }, 18000);
        }

        hls.on(Hls.Events.FRAG_LOADING, () => {
          lastHlsFragActivityMsRef.current = Date.now();
        });

        hls.on(Hls.Events.FRAG_LOADED, () => {
          lastHlsFragActivityMsRef.current = Date.now();
        });

        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          lastHlsFragActivityMsRef.current = Date.now();
          if (nativeHlsFallbackTimerRef.current !== null) {
            window.clearTimeout(nativeHlsFallbackTimerRef.current);
            nativeHlsFallbackTimerRef.current = null;
          }
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_ev, data) => {
          if (cancelled) return;
          const lvl = hls.levels?.[data.level];
          if (lvl && (lvl.width || lvl.height)) {
            setLiveVideoDims({
              width: lvl.width || 0,
              height: lvl.height || 0,
            });
          }
          syncVideoDims(video);
        });

        hls.on(Hls.Events.MANIFEST_PARSED, (_ev, data) => {
          if (cancelled) {
            if (nativeHlsFallbackTimerRef.current !== null) {
              window.clearTimeout(nativeHlsFallbackTimerRef.current);
              nativeHlsFallbackTimerRef.current = null;
            }
            return;
          }
          logTvVod('manifest_parsed', `levels=${data.levels.length}`);
          hls.subtitleDisplay = false;
          hls.subtitleTrack = -1;

          // Filter out duplicate failover-audio levels so audio0 track switches never drop video quality
          const hasPrimaryLevels = data.levels.some(
            (l) =>
              !String(
                (l as { attrs?: Record<string, string> }).attrs?.AUDIO || ''
              ).startsWith('failover-')
          );

          const isLevelVideoCodecSupported = (lvl: (typeof data.levels)[number]): boolean => {
            const vCodec = String(
              lvl.videoCodec ||
              ((lvl as { attrs?: Record<string, string> }).attrs?.CODECS || '')
                .split(',')
                .map((c) => c.trim())
                .find((c) => /^(avc1|hvc1|hev1|dvh1|dvhe|vp09|vp9|av01)/i.test(c)) ||
              ''
            ).trim();
            const normHeight = normalizeVideoQualityHeight(lvl.width, lvl.height);
            // MediaTek / Sony Bravia / Android TV hardware H.264 decoders max out at 1080p (Level 4.1/4.2);
            // selecting 2160p/1440p H.264 in MSE plays AAC audio only with a black video surface.
            if (
              isHardwareSmartTv &&
              normHeight > 1080 &&
              (!vCodec || /^avc1/i.test(vCodec))
            ) {
              const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
              const isWebOsOrTizen4kAvc =
                /Web0S|WebOS|Tizen/i.test(ua) &&
                typeof window.MediaSource?.isTypeSupported === 'function' &&
                window.MediaSource.isTypeSupported(
                  `video/mp4; codecs="${vCodec || 'avc1.640033'}"`
                );
              if (!isWebOsOrTizen4kAvc) return false;
            }
            if (!vCodec || typeof window.MediaSource?.isTypeSupported !== 'function') {
              return true;
            }
            const container = /^(vp09|vp9)/i.test(vCodec) ? 'video/webm' : 'video/mp4';
            return window.MediaSource.isTypeSupported(
              `${container}; codecs="${vCodec}"`
            );
          };
          const hasCodecSupportedLevels = data.levels.some((l) =>
            isLevelVideoCodecSupported(l)
          );

          const bestByHeight = new Map<
            number,
            { index: number; height: number; width: number; bitrate: number }
          >();
          data.levels.forEach((lvl, idx) => {
            const audioGroup = String(
              (lvl as { attrs?: Record<string, string> }).attrs?.AUDIO || ''
            );
            if (hasPrimaryLevels && audioGroup.startsWith('failover-')) return;
            if (hasCodecSupportedLevels && !isLevelVideoCodecSupported(lvl)) return;
            const normH = normalizeVideoQualityHeight(lvl.width, lvl.height);
            if (!normH) return;
            const prev = bestByHeight.get(normH);
            if (!prev || (lvl.bitrate || 0) > prev.bitrate) {
              bestByHeight.set(normH, {
                index: idx,
                height: normH,
                width: lvl.width || Math.round((normH * 16) / 9),
                bitrate: lvl.bitrate || 0,
              });
            }
          });
          const allSortedFull = Array.from(bestByHeight.values()).sort(
            (a, b) => b.height - a.height || b.bitrate - a.bitrate
          );
          const hdOnlyFull = allSortedFull.filter((x) => x.height >= 720);
          const sortedFull =
            hdOnlyFull.length > 0 ? hdOnlyFull : allSortedFull;
          const sortedLevels = sortedFull.map(({ index, height }) => ({
            index,
            height,
          }));

          setQualityLevels(sortedLevels);

          // Select quality according to user's preferredQuality ('max' = 4K/1080p, '1080', '720', '480', or 'auto')
          if (sortedLevels.length > 0) {
            const targetIdx = pickQualityLevelByPreference(
              sortedLevels,
              preferredQuality
            );
            highestLevelIndexRef.current = targetIdx;
            if (targetIdx >= 0) {
              hls.startLevel = targetIdx;
              hls.currentLevel = targetIdx;
              hls.nextLevel = targetIdx;
              hls.loadLevel = targetIdx;
              hls.nextLoadLevel = targetIdx;
            } else {
              hls.currentLevel = targetIdx;
            }
            setActiveQuality(targetIdx);

            const pickedMeta =
              sortedFull.find((x) => x.index === targetIdx) || sortedFull[0];
            if (pickedMeta) {
              setLiveVideoDims({
                width: pickedMeta.width,
                height: pickedMeta.height,
              });
            }
          }

          lastSeekAttemptMsRef.current = Date.now();
          lastHlsFragActivityMsRef.current = Date.now();
          hls.startLoad(
            startAtSecondsRef.current > 5 ? startAtSecondsRef.current : -1
          );
          lastTimeUpdateWallMsRef.current = Date.now();
          ensureAutoPlay(video);
          setStatus('playing');
          onWakeOsd?.();
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

          // Default to active profile's preferred Audio Language (or explicit forcedAudioIdx / initialAudioTrackIndex if valid)
          const autoPrefIdx = resolveAudioTrackIndexByPreference(
            list.map((x) => x.name),
            effectiveAudioPref
          );
          const targetIdx =
            forcedAudioIdx >= 0 && forcedAudioIdx < list.length
              ? forcedAudioIdx
              : typeof initialAudioTrackIndex === 'number' &&
                initialAudioTrackIndex >= 0 &&
                initialAudioTrackIndex < list.length
                ? initialAudioTrackIndex
                : autoPrefIdx;

          if (list[targetIdx]) {
            if (hls.audioTrack !== list[targetIdx].id) {
              hls.audioTrack = list[targetIdx].id;
              if (!appliedStartRef.current && startAtSecondsRef.current > 5) {
                try {
                  hls.startLoad(startAtSecondsRef.current);
                } catch {
                  // ignore
                }
              }
            }
            setActiveAudioTrack(list[targetIdx].id);
          } else {
            setActiveAudioTrack(hls.audioTrack >= 0 ? hls.audioTrack : 0);
          }

          // Re-lock highest video level after switching audio track so hls.js never resets to 270p/360p
          if (highestLevelIndexRef.current >= 0) {
            if (
              hls.levels.length > 1 &&
              hls.currentLevel !== highestLevelIndexRef.current
            ) {
              hls.currentLevel = highestLevelIndexRef.current;
            }
            hls.nextLevel = highestLevelIndexRef.current;
            hls.loadLevel = highestLevelIndexRef.current;
            hls.nextLoadLevel = highestLevelIndexRef.current;
          }
        });

        hls.on(Hls.Events.ERROR, (_ev, data) => {
          logTvVod(
            data.fatal ? 'hls_fatal_error' : 'hls_warn',
            `${data.type}:${data.details}:${data.response?.code || ''}`
          );
          if (
            !data.fatal &&
            (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR ||
              data.details === Hls.ErrorDetails.BUFFER_NUDGE_ON_STALL)
          ) {
            try {
              const sc = (
                hls as unknown as {
                  streamController?: { state?: string; fragCurrent?: unknown };
                }
              ).streamController;
              const isActivelyLoadingFrag =
                Boolean(sc?.fragCurrent) ||
                sc?.state === 'FRAG_LOADING' ||
                sc?.state === 'PARSING' ||
                Date.now() - lastHlsFragActivityMsRef.current < 16000;
              if (!isActivelyLoadingFrag) {
                hls.startLoad();
              }
              if (video && !userIntentionallyPausedRef.current) {
                video.play().catch(() => { });
              }
            } catch {
              // ignore
            }
            return;
          }
          if (data.fatal) {
            errorRetries += 1;
            if (errorRetries <= 4 && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad();
            } else if (
              errorRetries <= 4 &&
              data.type === Hls.ErrorTypes.MEDIA_ERROR
            ) {
              hls.recoverMediaError();
              if (highestLevelIndexRef.current >= 0) {
                hls.currentLevel = highestLevelIndexRef.current;
                hls.nextLevel = highestLevelIndexRef.current;
                hls.loadLevel = highestLevelIndexRef.current;
                hls.nextLoadLevel = highestLevelIndexRef.current;
              }
            } else if (!offlineItem && canVideoPlayNativeHls) {
              if (nativeHlsFallbackTimerRef.current !== null) {
                window.clearTimeout(nativeHlsFallbackTimerRef.current);
                nativeHlsFallbackTimerRef.current = null;
              }
              switchToNativeVideoHls(targetUrl, `fatal_${data.details}`);
            } else {
              if (nativeHlsFallbackTimerRef.current !== null) {
                window.clearTimeout(nativeHlsFallbackTimerRef.current);
                nativeHlsFallbackTimerRef.current = null;
              }
              setStatus('error');
              onStreamError?.();
            }
          }
        });
      } else if (!offlineItem && canVideoPlayNativeHls) {
        switchToNativeVideoHls(targetUrl, 'hls_not_supported');
      } else if (
        offlineItem &&
        offlineItem.mediaType === 'hls' &&
        video.canPlayType('application/vnd.apple.mpegurl')
      ) {
        void buildIosNativeOfflineHlsBlobUrl(offlineItem)
          .then(({ masterBlobUrl }) => {
            if (cancelled) return;
            switchToNativeVideoHls(masterBlobUrl, 'ios_offline_blob_hls');
          })
          .catch(() => {
            if (!cancelled) setStatus('error');
          });
      } else {
        setStatus('error');
      }
    };

    const init = async () => {
      cleanup();
      highestLevelIndexRef.current = -1;
      streamOffsetRef.current = 0;
      setStreamOffsetSec(0);

      // Case 0: Live Remuxed FileList.io Torrent Stream or YouTube Premium Stream (/api/filelist/stream | /api/youtube/stream)
      if (
        !offlineItem &&
        hlsUrl &&
        (hlsUrl.includes('/api/filelist/stream') ||
          hlsUrl.includes('/api/youtube/stream'))
      ) {
        const hintedDur = durationHintSec && durationHintSec > 60 ? durationHintSec : 0;
        const rawInitialSeek =
          startAtSecondsRef.current > 5
            ? Math.floor(startAtSecondsRef.current)
            : 0;
        const initialSeek =
          hintedDur > 0 && rawInitialSeek >= hintedDur - 15
            ? 0
            : rawInitialSeek;
        if (initialSeek !== rawInitialSeek) {
          startAtSecondsRef.current = 0;
        }
        streamOffsetRef.current = initialSeek;
        setStreamOffsetSec(initialSeek);
        appliedStartRef.current = true;

        let cleanBase = hlsUrl
          .replace(/([?&])start=\d+/g, '')
          .replace(/([?&])audio=\d+/g, '');
        if (isForeign && !cleanBase.includes('orig=')) {
          const sep0 = cleanBase.includes('?') ? '&' : '?';
          cleanBase = `${cleanBase}${sep0}orig=1`;
        }
        const sep = cleanBase.includes('?') ? '&' : '?';
        const flStreamUrl =
          forcedAudioIdx >= 0
            ? `${cleanBase}${sep}start=${initialSeek}&audio=${forcedAudioIdx}`
            : `${cleanBase}${sep}start=${initialSeek}`;

        logTvVod('start_filelist_stream', flStreamUrl);
        loadFileListStreamIntoVideo(video, flStreamUrl);
        return;
      }

      // Case 1: Offline Blob file (.mp4 / .mkv / .webm / chunked FileList or VK MP4) or pre-built MP4 from HLS offline download
      if (offlineItem) {
        const fileBlob = await getOfflineFileBlob(offlineItem);
        if (cancelled) return;
        if (fileBlob) {
          objectUrlToRevoke = URL.createObjectURL(fileBlob);
          let triedOfflineMse = false;
          const tryPlayBlobViaMse = () => {
            if (
              triedOfflineMse ||
              cancelled ||
              typeof window === 'undefined' ||
              typeof window.MediaSource === 'undefined'
            ) {
              return false;
            }
            triedOfflineMse = true;
            try {
              const ms = new window.MediaSource();
              const mseUrl = URL.createObjectURL(ms);
              const prevUrl = objectUrlToRevoke;
              objectUrlToRevoke = mseUrl;
              if (prevUrl) {
                try {
                  URL.revokeObjectURL(prevUrl);
                } catch {
                  // ignore
                }
              }
              video.onerror = null;
              video.src = mseUrl;
              ms.addEventListener(
                'sourceopen',
                () => {
                  void (async () => {
                    try {
                      const mimeCandidates = [
                        'video/mp4; codecs="avc1.640028, mp4a.40.2"',
                        'video/mp4; codecs="avc1.4d401f, mp4a.40.2"',
                        'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
                        'video/mp4',
                      ];
                      const chosenMime =
                        mimeCandidates.find((m) =>
                          window.MediaSource.isTypeSupported(m)
                        ) || mimeCandidates[0];
                      const sb = ms.addSourceBuffer(chosenMime);
                      const waitUpdate = () =>
                        new Promise<void>((res) => {
                          if (!sb.updating) {
                            res();
                            return;
                          }
                          sb.addEventListener('updateend', () => res(), {
                            once: true,
                          });
                        });
                      const CHUNK = 2 * 1024 * 1024;
                      let offset = 0;
                      while (offset < fileBlob.size && !cancelled && ms.readyState === 'open') {
                        const sliceAb = await fileBlob
                          .slice(offset, Math.min(fileBlob.size, offset + CHUNK))
                          .arrayBuffer();
                        if (cancelled || ms.readyState !== 'open') break;
                        await waitUpdate();
                        sb.appendBuffer(sliceAb);
                        await waitUpdate();
                        offset += CHUNK;
                        // Keep ahead buffer bounded during playback
                        if (offset > 24 * 1024 * 1024 && video.readyState >= 2) {
                          while (
                            !cancelled &&
                            ms.readyState === 'open' &&
                            sb.buffered.length > 0 &&
                            sb.buffered.end(sb.buffered.length - 1) - video.currentTime > 60
                          ) {
                            await new Promise((r) => setTimeout(r, 400));
                          }
                        }
                      }
                      if (!cancelled && ms.readyState === 'open') {
                        await waitUpdate();
                        try {
                          ms.endOfStream();
                        } catch {
                          // ignore
                        }
                      }
                    } catch {
                      if (!cancelled) setStatus('error');
                    }
                  })();
                },
                { once: true }
              );
              return true;
            } catch {
              return false;
            }
          };
          video.onerror = () => {
            if (cancelled) return;
            if (!tryPlayBlobViaMse()) {
              setStatus('error');
            }
          };
          video.src = objectUrlToRevoke;
          video.onloadedmetadata = () => {
            syncVideoDims(video);
            applyInitialSeek();
            ensureAutoPlay(video);
            setStatus('playing');
            onWakeOsd?.();
          };
          return;
        }
        if (offlineItem.mediaType === 'blob') {
          setStatus('error');
          return;
        }
      }

      // Case 2: Online 1080p Full HD DASH (.mpd) stream (Desktop/Laptop/Tablet + Smart TVs supporting VP9/Opus MSE)
      const canPlayDashWebm =
        !isHardwareSmartTv &&
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
            dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED,
            () => {
              if (!cancelled) syncVideoDims(video);
            }
          );

          dashPlayer.on(
            dashjs.MediaPlayer.events.STREAM_INITIALIZED,
            () => {
              if (cancelled || dashRef.current !== dashPlayer) return;
              appliedStartRef.current = true;

              const reps = dashPlayer.getRepresentationsByType('video') || [];
              const bestByHeight = new Map<
                number,
                { index: number; height: number; width: number; bitrate: number }
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
                    width: rep.width || Math.round((normH * 16) / 9),
                    bitrate: bw,
                  });
                }
              });

              const allSortedFull = Array.from(bestByHeight.values()).sort(
                (a, b) => b.height - a.height || b.bitrate - a.bitrate
              );
              const hdOnlyFull = allSortedFull.filter((x) => x.height >= 720);
              const sortedFull =
                hdOnlyFull.length > 0 ? hdOnlyFull : allSortedFull;
              const sortedLevels = sortedFull.map(({ index, height }) => ({
                index,
                height,
              }));

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

                const pickedMeta =
                  sortedFull.find((x) => x.index === targetIdx) ||
                  sortedFull[0];
                if (pickedMeta) {
                  setLiveVideoDims({
                    width: pickedMeta.width,
                    height: pickedMeta.height,
                  });
                }
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

                const autoPrefIdx = resolveAudioTrackIndexByPreference(
                  list.map((x) => x.name),
                  effectiveAudioPref
                );
                const targetIdx =
                  typeof initialAudioTrackIndex === 'number' &&
                    initialAudioTrackIndex >= 0 &&
                    initialAudioTrackIndex < list.length
                    ? initialAudioTrackIndex
                    : autoPrefIdx;

                if (dashAudio[targetIdx]) {
                  dashPlayer.setCurrentTrack(dashAudio[targetIdx]);
                  setActiveAudioTrack(targetIdx);
                }
              }

              ensureAutoPlay(video);
              setStatus('playing');
              onWakeOsd?.();
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
      let targetUrl = offlineItem
        ? `https://offline.local/${encodeURIComponent(offlineItem.id)}/master.m3u8`
        : hlsUrl || '';
      if (
        targetUrl &&
        targetUrl.includes('/api/tv-proxy')
      ) {
        let cleanBase = targetUrl.replace(/([?&])audioIdx=\d+/g, '');
        if (isForeign && !cleanBase.includes('orig=')) {
          const sep0 = cleanBase.includes('?') ? '&' : '?';
          cleanBase = `${cleanBase}${sep0}orig=1`;
        }
        const sep = cleanBase.includes('?') ? '&' : '?';
        targetUrl =
          forcedAudioIdx >= 0
            ? `${cleanBase}${sep}audioIdx=${forcedAudioIdx}`
            : cleanBase;
      }

      startHlsPlayback(targetUrl);
    };

    void init();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashUrl, hlsUrl, offlineItem?.id, forcedAudioIdx]);

  // If initialAudioTrackIndex changes dynamically, switch DASH or reload HLS with forcedAudioIdx
  useEffect(() => {
    if (
      typeof initialAudioTrackIndex !== 'number' ||
      initialAudioTrackIndex < 0
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

    const hlsPlayer = hlsRef.current;
    const requiresUrlAudioReload = Boolean(
      hlsUrl &&
      (hlsUrl.includes('/api/filelist/stream') ||
        hlsUrl.includes('/api/tv-proxy'))
    );

    if (!requiresUrlAudioReload) {
      if (hlsPlayer) {
        hlsPlayer.audioTrack = initialAudioTrackIndex;
      } else {
        const v = videoRef.current as unknown as {
          audioTracks?: {
            length: number;
            [index: number]: { enabled?: boolean };
          };
        } | null;
        if (v?.audioTracks && v.audioTracks.length > 0) {
          for (let i = 0; i < v.audioTracks.length; i++) {
            if (v.audioTracks[i]) {
              v.audioTracks[i].enabled = i === initialAudioTrackIndex;
            }
          }
        }
      }
      setActiveAudioTrack(initialAudioTrackIndex);
      return;
    }

    if (initialAudioTrackIndex !== forcedAudioIdx) {
      const isFlStream = Boolean(
        hlsUrl && hlsUrl.includes('/api/filelist/stream')
      );
      if (
        isFlStream &&
        (audioTrackLabels.length <= 1 ||
          (forcedAudioIdx === -1 &&
            initialAudioTrackIndex === 0 &&
            !isForeign))
      ) {
        setActiveAudioTrack(initialAudioTrackIndex);
        return;
      }
      const v = videoRef.current;
      if (v && v.currentTime > 3) {
        const isFl = Boolean(
          hlsUrl &&
          (hlsUrl.includes('/api/filelist/stream') ||
            hlsUrl.includes('/api/youtube/stream'))
        );
        startAtSecondsRef.current = Math.floor(
          isFl ? streamOffsetRef.current + v.currentTime : v.currentTime
        );
        if (!isFl) {
          appliedStartRef.current = false;
        }
      }
      setActiveAudioTrack(initialAudioTrackIndex);
      setForcedAudioIdx(initialAudioTrackIndex);
    }
  }, [initialAudioTrackIndex, forcedAudioIdx, hlsUrl]);

  const prevStartAtPropRef = useRef<number>(startAtSeconds);
  // If startAtSeconds changes dynamically (e.g. user clicks "De la început 00:00" or resume position syncs), seek and play immediately
  useEffect(() => {
    const prevStart = prevStartAtPropRef.current;
    prevStartAtPropRef.current = startAtSeconds;
    const video = videoRef.current;
    if (!video || status !== 'playing') return;
    const isFl = Boolean(
      hlsUrl &&
      (hlsUrl.includes('/api/filelist/stream') ||
        hlsUrl.includes('/api/youtube/stream'))
    );
    if (startAtSeconds === 0 && prevStart > 0 && video.currentTime > 2) {
      appliedStartRef.current = true;
      setStreamOffsetSec(0);
      if (isFl && hlsUrl) {
        let cleanBase = hlsUrl.replace(/([?&])start=\d+/g, '$1').replace(/[?&]+$/, '');
        if (forcedAudioIdx >= 0) {
          cleanBase = cleanBase.replace(/([?&])audio=\d+/g, '$1').replace(/[?&]+$/, '');
        }
        const sep = cleanBase.includes('?') ? '&' : '?';
        const audioTail = forcedAudioIdx >= 0 ? `&audio=${forcedAudioIdx}` : '';
        loadFileListStreamIntoVideo(
          video,
          `${cleanBase}${sep}start=0${audioTail}`
        );
      } else {
        video.currentTime = 0;
        ensureAutoPlay(video);
      }
    } else if (
      !isFl &&
      startAtSeconds > 5 &&
      !appliedStartRef.current &&
      Math.abs(video.currentTime + streamOffsetSec - startAtSeconds) > 15 &&
      Date.now() - lastSeekAttemptMsRef.current >=
      (hlsRef.current ? 16000 : 2500)
    ) {
      lastSeekAttemptMsRef.current = Date.now();
      try {
        video.currentTime = startAtSeconds;
        hlsRef.current?.startLoad(startAtSeconds);
      } catch {
        // ignore
      }
      ensureAutoPlay(video);
    }
  }, [startAtSeconds, status, hlsUrl, forcedAudioIdx, streamOffsetSec]);

  // When a subtitle track changes (URL or label), reset timing offset (never on incremental live SSE cue updates)
  useEffect(() => {
    setSubOffsetSec(0);
    const video = videoRef.current;
    if (!video) return;
    if (subtitleVttUrl || subtitleLabel) {
      if (video.paused && status === 'playing' && !userIntentionallyPausedRef.current) {
        ensureAutoPlay(video);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitleVttUrl, subtitleLabel]);

  // Compute active subtitle text for current timestamp (supports simultaneous dual-speaker cues)
  const activeSubtitleText = useMemo(() => {
    if (!subtitleCues || subtitleCues.length === 0) return null;
    const effectiveTime = currentTimeSec - subOffsetSec;
    const activeLines: string[] = [];
    for (let i = 0; i < subtitleCues.length; i++) {
      const c = subtitleCues[i];
      if (effectiveTime >= c.start && effectiveTime <= c.end) {
        if (c.text && !activeLines.includes(c.text)) {
          activeLines.push(c.text);
        }
      }
    }
    return activeLines.length > 0 ? activeLines.join('\n') : null;
  }, [subtitleCues, currentTimeSec, subOffsetSec]);

  const hasActiveSubtitle =
    (subtitleCues && subtitleCues.length > 0) ||
    Boolean(subtitleVttUrl) ||
    Boolean(subtitleLabel);

  const subFontClass =
    subFontSize === 'xlarge'
      ? 'text-lg sm:text-2xl md:text-3xl px-5 py-2.5'
      : subFontSize === 'large'
        ? 'text-base sm:text-xl md:text-2xl px-4 py-2'
        : 'text-sm sm:text-base md:text-lg px-3.5 py-1.5';

  const formatSeekTime = (sec: number) => {
    if (!Number.isFinite(sec) || sec < 0) return '00:00';
    const total = Math.floor(sec);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isFileListStream = Boolean(
    hlsUrl &&
    (hlsUrl.includes('/api/filelist/stream') ||
      hlsUrl.includes('/api/youtube/stream'))
  );
  const displayTimeSec =
    scrubPreviewSec !== null ? scrubPreviewSec : currentTimeSec;
  const hasVerifiedDuration =
    Number.isFinite(videoDurationSec) && videoDurationSec > 60;
  const rawBaseDurationSec = hasVerifiedDuration
    ? videoDurationSec
    : apiOutroEndSec && apiOutroEndSec > 300
      ? apiOutroEndSec
      : durationHintSec && durationHintSec > 60
        ? durationHintSec
        : mediaType === 'series'
          ? 3600
          : 7200;
  const isVideoElementEnded = Boolean(videoRef.current?.ended);
  const effectiveDurationSec = (() => {
    const maxKnownPos = Math.max(
      displayTimeSec,
      streamOffsetSec,
      startAtSeconds || 0
    );
    if (
      !hasVerifiedDuration &&
      maxKnownPos >= rawBaseDurationSec - 90 &&
      !isVideoElementEnded
    ) {
      // Expand estimated duration smoothly in 15-min blocks so the scrubber never hits 00:00 while video is still playing
      return Math.max(
        rawBaseDurationSec,
        Math.ceil((maxKnownPos + 600) / 900) * 900
      );
    }
    if (maxKnownPos >= rawBaseDurationSec - 1 && !isVideoElementEnded) {
      return Math.max(rawBaseDurationSec, Math.floor(maxKnownPos) + 60);
    }
    return rawBaseDurationSec;
  })();

  const remainingTimeSec = Math.max(0, effectiveDurationSec - displayTimeSec);

  // Smart Intro & Recap Segments Detection:
  // 1) Exact IntroDB.app + TheIntroDB v2 community consensus timestamps (always wait until API settles before fallback!)
  // 2) Subtitle Explicit Theme/Opening Marker (or dialogue gap ONLY when backed by an explicit music/theme cue)
  // 3) Explicit long-form reality TV shows fallback ONLY (Asia Express tt10295772, America Express, Survivor, etc.) —
  //    NEVER invent blind fake Intro/Recap timestamps on normal scripted series not indexed in IntroDB!
  const detectedSkipSegments = useMemo<
    Array<{
      id: string;
      type: 'recap' | 'intro';
      startSec: number;
      endSec: number;
      label: string;
      toastLabel: string;
    }>
  >(() => {
    if (mediaType !== 'series') return [];
    if (apiSkipSegments.length > 0) return apiSkipSegments;
    if (apiNoIntro) return [];
    // Wait for IntroDB.app / TheIntroDB v2 before considering subtitle/reality fallbacks
    if ((imdbId || tmdbId) && !isIntroApiSettled) return [];

    if (subtitleCues && subtitleCues.length >= 12) {
      const isExplicitThemeMarker = (text: string): boolean => {
        const t = (text || '').toLowerCase();
        return (
          t.includes('theme music') ||
          t.includes('opening theme') ||
          t.includes('theme song') ||
          t.includes('[theme') ||
          t.includes('(theme') ||
          t.includes('[opening') ||
          t.includes('(opening') ||
          t.includes('[intro') ||
          t.includes('(intro') ||
          t.includes('[generic') ||
          t.includes('(generic')
        );
      };

      const themeCues = subtitleCues.filter(
        (c) =>
          c.end > c.start &&
          c.start >= 2 &&
          c.start <= 720 &&
          isExplicitThemeMarker(c.text)
      );

      if (themeCues.length > 0) {
        const firstTheme = themeCues[0];
        const nextSpoken = subtitleCues.find(
          (c) =>
            c.start > firstTheme.start + 12 &&
            c.start <= firstTheme.start + 105 &&
            !isExplicitThemeMarker(c.text)
        );
        const startSec = Math.max(2, Math.floor(firstTheme.start));
        const endSec = nextSpoken
          ? Math.floor(nextSpoken.start - 1)
          : Math.ceil(Math.max(firstTheme.end, firstTheme.start + 45));
        if (endSec > startSec + 14 && endSec - startSec <= 105) {
          return [
            {
              id: `sub_intro_${startSec}_${endSec}`,
              type: 'intro',
              startSec,
              endSec,
              label: 'Sari peste Intro',
              toastLabel: 'Intro Omis',
            },
          ];
        }
      }

      // Music-backed Opening Theme gap ONLY (never guess on silent action/suspense scenes without music cue)
      const cleanCues = subtitleCues.filter((c) => {
        const t = (c.text || '').toLowerCase();
        return (
          c.end > c.start &&
          !t.includes('opensubtitles') &&
          !t.includes('subtitrare') &&
          !t.includes('traducere') &&
          !t.includes('synced by') &&
          !t.includes('www.') &&
          !t.includes('http')
        );
      });

      const isMusicOrThemeCue = (text: string): boolean => {
        const t = (text || '').toLowerCase();
        return (
          t.includes('[music') ||
          t.includes('(music') ||
          isExplicitThemeMarker(t)
        );
      };

      const spokenCues = cleanCues.filter((c) => !isMusicOrThemeCue(c.text));
      if (spokenCues.length >= 12) {
        let bestGap: {
          startSec: number;
          endSec: number;
          score: number;
        } | null = null;
        for (let i = 0; i < spokenCues.length - 3; i++) {
          const cur = spokenCues[i];
          const nxt = spokenCues[i + 1];
          if (cur.end > 480) break;
          const gap = nxt.start - cur.end;
          if (gap >= 30 && gap <= 95 && cur.end >= 10) {
            const hasMusicInGap = cleanCues.some(
              (c) =>
                c.start >= cur.end - 2 &&
                c.end <= nxt.start + 2 &&
                isMusicOrThemeCue(c.text)
            );
            if (!hasMusicInGap) continue;
            const score = 100 + gap;
            if (!bestGap || score > bestGap.score) {
              bestGap = {
                startSec: Math.floor(cur.end + 1),
                endSec: Math.floor(nxt.start - 1),
                score,
              };
            }
          }
        }
        if (bestGap) {
          return [
            {
              id: `sub_gap_intro_${bestGap.startSec}_${bestGap.endSec}`,
              type: 'intro',
              startSec: bestGap.startSec,
              endSec: bestGap.endSec,
              label: 'Sari peste Intro',
              toastLabel: 'Intro Omis',
            },
          ];
        }
      }
    }

    // Explicit fallback ONLY for known long-form reality TV shows not indexed in IntroDB (e.g. Asia Express tt10295772)
    const combinedTitle = `${title || ''} ${subtitle || ''} ${imdbId || ''}`;
    const isLongFormRealityOrShow =
      /\btt10295772\b/i.test(combinedTitle) ||
      /asia\s*express|america\s*express|power\s*couple|insula\s*iubirii|survivor|chefi\s*la\s*cu|зв[её]зды\s*в\s*(африке|джунглях)|сокровища\s*императора|выжить\s*в|титаны|выживалити|большое\s*шоу|пацанки|четыре\s*свадьбы|адский\s*шеф|битва\s*шефов/i.test(
        combinedTitle
      );

    if (isLongFormRealityOrShow) {
      return [
        {
          id: 'fallback_reality_recap_1_105',
          type: 'recap',
          startSec: 1,
          endSec: 105,
          label: 'Sari peste Recapitulare',
          toastLabel: 'Recapitulare Omisă',
        },
        {
          id: 'fallback_reality_intro_105_210',
          type: 'intro',
          startSec: 105,
          endSec: 210,
          label: 'Sari peste Intro',
          toastLabel: 'Intro Omis',
        },
      ];
    }

    return [];
  }, [
    mediaType,
    apiSkipSegments,
    apiNoIntro,
    isIntroApiSettled,
    subtitleCues,
    title,
    subtitle,
    imdbId,
    tmdbId,
  ]);

  const activeSkipSegment = useMemo(() => {
    if (mediaType !== 'series' || detectedSkipSegments.length === 0) {
      return null;
    }
    for (const seg of detectedSkipSegments) {
      if (
        !dismissedSegmentIds.includes(seg.id) &&
        displayTimeSec >= seg.startSec &&
        displayTimeSec < seg.endSec - 2
      ) {
        return seg;
      }
    }
    return null;
  }, [mediaType, detectedSkipSegments, dismissedSegmentIds, displayTimeSec]);

  const isSkipIntroVisible = Boolean(
    activeSkipSegment && !showNextEpisodePrompt
  );

  const skipIntroRemainingPct = useMemo(() => {
    if (!activeSkipSegment) return 0;
    const totalDur = Math.max(
      1,
      activeSkipSegment.endSec - activeSkipSegment.startSec
    );
    const elapsed = Math.max(0, displayTimeSec - activeSkipSegment.startSec);
    return Math.max(0, Math.min(100, (elapsed / totalDur) * 100));
  }, [activeSkipSegment, displayTimeSec]);

  // If user rewinds/seeks backward before a dismissed segment, un-dismiss it so the button appears again
  useEffect(() => {
    if (
      mediaType !== 'series' ||
      dismissedSegmentIds.length === 0 ||
      detectedSkipSegments.length === 0
    ) {
      return;
    }
    const stillDismissed = dismissedSegmentIds.filter((id) => {
      const seg = detectedSkipSegments.find((s) => s.id === id);
      if (!seg) return false;
      return displayTimeSec >= seg.startSec - 2;
    });
    if (stillDismissed.length !== dismissedSegmentIds.length) {
      setDismissedSegmentIds(stillDismissed);
    }
  }, [mediaType, detectedSkipSegments, dismissedSegmentIds, displayTimeSec]);

  // Manual-only Skip Intro & Recap prompt (never auto-skip — always propose and auto-focus the pill for 1-click OK/Enter)
  useEffect(() => {
    if (!isSkipIntroVisible || !activeSkipSegment || openMenu !== 'none') {
      return;
    }
    hasAutoFocusedSkipIntroRef.current = activeSkipSegment.id;
    const focusSkipBtn = () => {
      if (openMenu !== 'none') return;
      if (
        document.querySelector(
          '[data-vod-sheet-open="true"], [data-episodes-drawer="true"]'
        )
      ) {
        return;
      }
      const btn = playerRootRef.current?.querySelector<HTMLButtonElement>(
        '[data-vod-skip-intro-btn="true"]'
      );
      try {
        btn?.focus({ preventScroll: true });
      } catch {
        btn?.focus();
      }
    };
    focusSkipBtn();
    const timer1 = window.setTimeout(focusSkipBtn, 45);
    const timer2 = window.setTimeout(focusSkipBtn, 180);
    return () => {
      window.clearTimeout(timer1);
      window.clearTimeout(timer2);
    };
  }, [isSkipIntroVisible, activeSkipSegment?.id, isOsdVisible, openMenu, status]);

  // Smart End-of-Episode (Series) & End-of-Movie (Movies) Credits Detection:
  // Compares displayTimeSec >= resolvedOutroStartSec directly (identical to Skip Intro/Recap):
  // 1) Exact IntroDB.app + TheIntroDB v2 consensus credits/outro start timestamp
  // 2) Subtitle explicit [end credits] / [closing theme] marker or end-of-dialogue detection
  // 3) Verified duration fallback (last 90s for series, last 180s for movies)
  const resolvedOutroStartSec = useMemo<number | null>(() => {
    const minValidSec = mediaType === 'series' ? 300 : 1200;

    // 1. Exact API Outro / Credits start timestamp
    if (apiOutroStartSec && apiOutroStartSec > minValidSec) {
      if (
        hasVerifiedDuration &&
        videoDurationSec > minValidSec &&
        apiOutroStartSec >= videoDurationSec - 10
      ) {
        return Math.max(
          minValidSec,
          Math.floor(
            videoDurationSec - (mediaType === 'series' ? 90 : 180)
          )
        );
      }
      return apiOutroStartSec;
    }

    // 2. Subtitle credits marker or end-of-dialogue detection
    if (subtitleCues && subtitleCues.length >= 15) {
      const minSubCreditsSec = mediaType === 'series' ? 600 : 1800;
      const isExplicitCreditsMarker = (text: string): boolean => {
        const t = (text || '').toLowerCase();
        return (
          t.includes('[end credits') ||
          t.includes('(end credits') ||
          t.includes('[closing theme') ||
          t.includes('(closing theme') ||
          t.includes('[ending theme') ||
          t.includes('(ending theme') ||
          t.includes('[credits') ||
          t.includes('(credits') ||
          t.includes('generic final')
        );
      };

      const explicitCreditsCue = subtitleCues.find(
        (c) =>
          c.start >= minSubCreditsSec &&
          (!hasVerifiedDuration ||
            c.start >=
            videoDurationSec - (mediaType === 'series' ? 360 : 600)) &&
          isExplicitCreditsMarker(c.text)
      );
      if (explicitCreditsCue) {
        return Math.floor(explicitCreditsCue.start);
      }

      if (hasVerifiedDuration && videoDurationSec > minValidSec) {
        const cleanCues = subtitleCues.filter((c) => {
          const t = (c.text || '').toLowerCase();
          return (
            !t.includes('opensubtitles') &&
            !t.includes('subtitrare') &&
            !t.includes('traducere') &&
            !t.includes('subtitles by') &&
            !t.includes('synced by') &&
            !t.includes('www.')
          );
        });
        const lastCue = cleanCues[cleanCues.length - 1];
        if (lastCue && lastCue.end > minValidSec) {
          const remAfterLastCue = videoDurationSec - lastCue.end;
          const minRem = mediaType === 'series' ? 25 : 35;
          const maxRem = mediaType === 'series' ? 240 : 480;
          if (remAfterLastCue >= minRem && remAfterLastCue <= maxRem) {
            return Math.ceil(lastCue.end + 2);
          }
        }
      }
    }

    // 3. Verified duration or reliable runtime fallback
    if (hasVerifiedDuration && videoDurationSec > minValidSec) {
      return Math.floor(
        videoDurationSec - (mediaType === 'series' ? 90 : 180)
      );
    }
    if (!isFileListStream && durationHintSec && durationHintSec > minValidSec) {
      return Math.floor(
        durationHintSec - (mediaType === 'series' ? 90 : 180)
      );
    }

    return null;
  }, [
    mediaType,
    apiOutroStartSec,
    subtitleCues,
    hasVerifiedDuration,
    videoDurationSec,
    isFileListStream,
    durationHintSec,
  ]);

  const outroEffectiveEndSec = useMemo(() => {
    if (
      apiOutroEndSec &&
      resolvedOutroStartSec !== null &&
      apiOutroEndSec > resolvedOutroStartSec + 10
    ) {
      return apiOutroEndSec;
    }
    if (
      hasVerifiedDuration &&
      resolvedOutroStartSec !== null &&
      videoDurationSec > resolvedOutroStartSec + 10
    ) {
      return Math.floor(videoDurationSec);
    }
    if (resolvedOutroStartSec !== null) {
      return Math.max(
        resolvedOutroStartSec + (mediaType === 'series' ? 60 : 180),
        effectiveDurationSec
      );
    }
    return effectiveDurationSec;
  }, [
    apiOutroEndSec,
    resolvedOutroStartSec,
    hasVerifiedDuration,
    videoDurationSec,
    mediaType,
    effectiveDurationSec,
  ]);

  const outroRemainingSec = Math.max(
    0,
    Math.ceil(outroEffectiveEndSec - displayTimeSec)
  );

  const outroProgressRemainingPct = useMemo(() => {
    if (resolvedOutroStartSec === null) return 0;
    const totalDur = Math.max(10, outroEffectiveEndSec - resolvedOutroStartSec);
    const elapsed = Math.max(0, displayTimeSec - resolvedOutroStartSec);
    return Math.max(0, Math.min(100, (elapsed / totalDur) * 100));
  }, [resolvedOutroStartSec, outroEffectiveEndSec, displayTimeSec]);

  // Propose Next Episode (Series) or End-of-Movie Actions (Movies) as soon as displayTimeSec >= resolvedOutroStartSec
  useEffect(() => {
    const canShowEndPrompt =
      Boolean(onNextEpisode) || mediaType === 'movie';
    if (
      !canShowEndPrompt ||
      autoNextDismissed ||
      hasTriggeredAutoNextRef.current ||
      resolvedOutroStartSec === null
    ) {
      return;
    }

    if (
      displayTimeSec >= resolvedOutroStartSec &&
      watchedTicksInEpisodeRef.current >= 6
    ) {
      if (!showNextEpisodePrompt) {
        setShowNextEpisodePrompt(true);
      }
      if (
        onNextEpisode &&
        status === 'playing' &&
        watchedTicksInEpisodeRef.current >= 15 &&
        ((hasVerifiedDuration && remainingTimeSec <= 2) ||
          (apiOutroEndSec !== null &&
            apiOutroEndSec > resolvedOutroStartSec + 15 &&
            displayTimeSec >= apiOutroEndSec - 1))
      ) {
        hasTriggeredAutoNextRef.current = true;
        setShowNextEpisodePrompt(false);
        onNextEpisode();
      }
    } else if (
      displayTimeSec < resolvedOutroStartSec - 5 &&
      showNextEpisodePrompt
    ) {
      // User seeked backward before the end credits
      setShowNextEpisodePrompt(false);
      hasAutoFocusedNextEpRef.current = false;
    }
  }, [
    mediaType,
    onNextEpisode,
    autoNextDismissed,
    hasVerifiedDuration,
    displayTimeSec,
    remainingTimeSec,
    resolvedOutroStartSec,
    apiOutroEndSec,
    showNextEpisodePrompt,
  ]);

  // Auto-focus the Next Episode / End-of-Movie primary button when it appears and no menu is open
  useEffect(() => {
    if (
      !showNextEpisodePrompt ||
      autoNextDismissed ||
      openMenu !== 'none' ||
      (mediaType === 'series' && !onNextEpisode)
    ) {
      return;
    }
    const focusAutoNextBtn = () => {
      if (openMenu !== 'none') return;
      if (
        document.querySelector(
          '[data-vod-sheet-open="true"], [data-episodes-drawer="true"]'
        )
      ) {
        return;
      }
      const btn = playerRootRef.current?.querySelector<HTMLButtonElement>(
        '[data-vod-autonext-btn="true"]'
      );
      try {
        btn?.focus({ preventScroll: true });
      } catch {
        btn?.focus();
      }
    };
    if (!hasAutoFocusedNextEpRef.current) {
      hasAutoFocusedNextEpRef.current = true;
      focusAutoNextBtn();
    }
    const timer1 = window.setTimeout(focusAutoNextBtn, 45);
    const timer2 = window.setTimeout(focusAutoNextBtn, 180);
    return () => {
      window.clearTimeout(timer1);
      window.clearTimeout(timer2);
    };
  }, [
    showNextEpisodePrompt,
    autoNextDismissed,
    mediaType,
    onNextEpisode,
    isOsdVisible,
    openMenu,
    status,
  ]);
  const progressPct = Math.min(
    100,
    Math.max(0, (displayTimeSec / Math.max(1, effectiveDurationSec)) * 100)
  );
  const bufferedPct = Math.min(
    100,
    Math.max(
      progressPct,
      (bufferedEndSec / Math.max(1, effectiveDurationSec)) * 100
    )
  );

  const isTargetInsideVideoBuffer = (
    v: HTMLVideoElement,
    absTargetSec: number
  ): { inBuffer: boolean; relSec: number } => {
    const relSec = absTargetSec - streamOffsetRef.current;
    if (relSec < 0 || v.readyState < 2 || !v.buffered || v.buffered.length === 0) {
      return { inBuffer: false, relSec };
    }
    try {
      for (let i = 0; i < v.buffered.length; i++) {
        const bStart = v.buffered.start(i);
        const bEnd = v.buffered.end(i);
        if (relSec >= bStart && relSec <= bEnd - 0.35) {
          return { inBuffer: true, relSec };
        }
      }
    } catch {
      // ignore
    }
    return { inBuffer: false, relSec };
  };

  const seekToAbsoluteSeconds = (
    targetSec: number,
    labelPrefix?: string,
    explicitDirection?: 'fwd' | 'rew'
  ) => {
    const v = videoRef.current;
    if (!v) return;

    // Live Remuxed FileList Torrent or YouTube Premium Stream seeking:
    // 1) If target timestamp is ALREADY buffered in RAM (MSE SourceBuffer), jump natively in 0ms with live frame & zero refresh!
    // 2) Only reconnect via server-side -ss offset when jumping outside the RAM buffer (never triggering full-screen FilmioStartupLoader).
    if (
      hlsUrl &&
      (hlsUrl.includes('/api/filelist/stream') ||
        hlsUrl.includes('/api/youtube/stream'))
    ) {
      const totalDur = hasVerifiedDuration
        ? effectiveDurationSec
        : Math.max(effectiveDurationSec, Math.floor(targetSec) + 600);
      const nextSec = Math.max(
        0,
        hasVerifiedDuration
          ? Math.min(totalDur - 5, Math.floor(targetSec))
          : Math.floor(targetSec)
      );

      const bufCheck = isTargetInsideVideoBuffer(v, nextSec);
      if (bufCheck.inBuffer && !isSeekingFileListRef.current) {
        try {
          v.currentTime = bufCheck.relSec;
        } catch {
          // ignore
        }
        setCurrentTimeSec(nextSec);
        setScrubPreviewSec(null);
        setIsSeekBuffering(false);
        hideFrozenFrame();
        onTimeUpdate?.(Math.floor(nextSec), Math.floor(totalDur));
      } else {
        isSeekingFileListRef.current = true;
        appliedStartRef.current = true;
        lastTimeUpdateWallMsRef.current = Date.now();
        startAtSecondsRef.current = nextSec;
        streamOffsetRef.current = nextSec;
        setStreamOffsetSec(nextSec);
        setCurrentTimeSec(nextSec);
        setScrubPreviewSec(null);
        onTimeUpdate?.(Math.floor(nextSec), Math.floor(totalDur));

        let cleanBase = hlsUrl.replace(/([?&])start=\d+/g, '$1').replace(/[?&]+$/, '');
        if (forcedAudioIdx >= 0) {
          cleanBase = cleanBase.replace(/([?&])audio=\d+/g, '$1').replace(/[?&]+$/, '');
        }
        const sep = cleanBase.includes('?') ? '&' : '?';
        const audioTail = forcedAudioIdx >= 0 ? `&audio=${forcedAudioIdx}` : '';
        if (flSeekDebounceRef.current) {
          window.clearTimeout(flSeekDebounceRef.current);
          flSeekDebounceRef.current = null;
        }
        captureFrozenFrame();
        loadFileListStreamIntoVideo(
          v,
          `${cleanBase}${sep}start=${nextSec}${audioTail}`
        );
        if (flBufferingTimerRef.current) {
          window.clearTimeout(flBufferingTimerRef.current);
        }
        flBufferingTimerRef.current = window.setTimeout(() => {
          if (isSeekingFileListRef.current) {
            setIsSeekBuffering(true);
          }
        }, 400);
      }

      const remSec = Math.max(0, totalDur - nextSec);
      const dir: 'fwd' | 'rew' =
        explicitDirection || (labelPrefix?.includes('-') ? 'rew' : 'fwd');
      const pct =
        totalDur > 0 ? Math.min(100, Math.max(0, (nextSec / totalDur) * 100)) : 0;

      if (labelPrefix && labelPrefix !== 'Reluare') {
        setSeekHudData({
          direction: dir,
          deltaLabel: labelPrefix,
          targetTimeStr: formatSeekTime(nextSec),
          targetSec: Math.floor(nextSec),
          totalTimeStr: formatSeekTime(totalDur),
          totalSec: Math.floor(totalDur),
          remainingTimeStr: `-${formatSeekTime(remSec)}`,
          percent: Math.round(pct),
        });

        if (seekHudTimerRef.current) {
          window.clearTimeout(seekHudTimerRef.current);
        }
        seekHudTimerRef.current = window.setTimeout(() => {
          if (!isSeekingFileListRef.current) {
            setSeekHudData(null);
          }
        }, 1500);
      }
      return;
    }

    const totalDur = Number.isFinite(v.duration) && v.duration > 10
      ? v.duration
      : effectiveDurationSec;
    const nextSec = Math.max(0, Math.min(totalDur, targetSec));
    hideFrozenFrame();
    setIsSeekBuffering(false);
    try {
      v.currentTime = nextSec;
    } catch {
      // ignore
    }
    setCurrentTimeSec(nextSec);
    setScrubPreviewSec(null);
    if (nextSec > 1 && Number.isFinite(totalDur)) {
      onTimeUpdate?.(Math.floor(nextSec), Math.floor(totalDur));
    }
    const remSec = Math.max(0, totalDur - nextSec);
    const dir: 'fwd' | 'rew' =
      explicitDirection || (labelPrefix?.includes('-') ? 'rew' : 'fwd');
    const pct =
      totalDur > 0 ? Math.min(100, Math.max(0, (nextSec / totalDur) * 100)) : 0;

    if (labelPrefix && labelPrefix !== 'Reluare') {
      setSeekHudData({
        direction: dir,
        deltaLabel: labelPrefix,
        targetTimeStr: formatSeekTime(nextSec),
        targetSec: Math.floor(nextSec),
        totalTimeStr: formatSeekTime(totalDur),
        totalSec: Math.floor(totalDur),
        remainingTimeStr: `-${formatSeekTime(remSec)}`,
        percent: Math.round(pct),
      });

      if (seekHudTimerRef.current) {
        window.clearTimeout(seekHudTimerRef.current);
      }
      seekHudTimerRef.current = window.setTimeout(() => {
        setSeekHudData(null);
      }, 1500);
    }
  };

  const pendingSeekTargetSecRef = useRef<number | null>(null);
  const pendingSeekMetaRef = useRef<{ prefix: string; direction: 'fwd' | 'rew' } | null>(null);
  const pendingSeekTimerRef = useRef<number | null>(null);

  const triggerSeek = (deltaSec: number) => {
    const now = Date.now();
    if (now - lastSeekTriggerWallMsRef.current < 50) {
      return; // Ignore duplicate event within 50ms
    }
    lastSeekTriggerWallMsRef.current = now;

    const v = videoRef.current;
    if (!v) return;

    const isServerSeekStream = Boolean(
      hlsUrl &&
        (hlsUrl.includes('/api/filelist/stream') ||
          hlsUrl.includes('/api/youtube/stream'))
    );
    const currentEff = isServerSeekStream
      ? isSeekingFileListRef.current
        ? streamOffsetRef.current
        : streamOffsetRef.current + (v.currentTime || 0)
      : v.currentTime || currentTimeSec;

    const baseSec =
      pendingSeekTargetSecRef.current !== null
        ? pendingSeekTargetSecRef.current
        : currentEff;
    const targetSec = Math.max(0, baseSec + deltaSec);

    const prevAccum = cumulativeSeekDeltaSecRef.current;
    const newAccum =
      (prevAccum > 0 && deltaSec > 0) || (prevAccum < 0 && deltaSec < 0)
        ? prevAccum + deltaSec
        : deltaSec;
    cumulativeSeekDeltaSecRef.current = newAccum;

    const absAccum = Math.abs(newAccum);
    const timeStr =
      absAccum >= 60
        ? absAccum % 60 === 0
          ? `${Math.round(absAccum / 60)} min`
          : `${Math.floor(absAccum / 60)}m ${absAccum % 60}s`
        : `${absAccum}s`;
    const prefix = newAccum >= 0 ? `+${timeStr}` : `-${timeStr}`;
    const direction: 'fwd' | 'rew' = newAccum >= 0 ? 'fwd' : 'rew';

    const totalDur = hasVerifiedDuration
      ? effectiveDurationSec
      : (v.duration && Number.isFinite(v.duration) && v.duration > 10 ? v.duration : effectiveDurationSec);
    const clampedTarget =
      totalDur > 10 ? Math.min(totalDur - 2, targetSec) : targetSec;
    const remSec = Math.max(0, totalDur - clampedTarget);
    const pct = totalDur > 0 ? Math.min(100, Math.max(0, (clampedTarget / totalDur) * 100)) : 0;

    setSeekHudData({
      direction,
      deltaLabel: prefix,
      targetTimeStr: formatSeekTime(clampedTarget),
      targetSec: Math.floor(clampedTarget),
      totalTimeStr: formatSeekTime(totalDur),
      totalSec: Math.floor(totalDur),
      remainingTimeStr: `-${formatSeekTime(remSec)}`,
      percent: Math.round(pct),
    });

    if (seekHudTimerRef.current) {
      window.clearTimeout(seekHudTimerRef.current);
    }
    seekHudTimerRef.current = window.setTimeout(() => {
      if (!isSeekingFileListRef.current) {
        setSeekHudData(null);
      }
      cumulativeSeekDeltaSecRef.current = 0;
      keySeekCountRef.current = 0;
      lastKeySeekDirRef.current = 0;
    }, 1500);

    // 1. Live Instant Visual Frame Jump for HLS / MP4 / Offline OR FileList targets already in RAM buffer!
    // Video frame updates immediately on screen with ZERO freeze and ZERO refresh.
    const canInstantLiveJump =
      !isServerSeekStream ||
      (!isSeekingFileListRef.current &&
        isTargetInsideVideoBuffer(v, clampedTarget).inBuffer);

    if (canInstantLiveJump) {
      if (pendingSeekTimerRef.current) {
        window.clearTimeout(pendingSeekTimerRef.current);
        pendingSeekTimerRef.current = null;
      }
      pendingSeekTargetSecRef.current = null;
      const targetRel = isServerSeekStream
        ? clampedTarget - streamOffsetRef.current
        : clampedTarget;
      hideFrozenFrame();
      setIsSeekBuffering(false);
      try {
        v.currentTime = Math.max(0, targetRel);
      } catch {
        // ignore
      }
      setCurrentTimeSec(clampedTarget);
      setScrubPreviewSec(null);
      if (clampedTarget > 1 && Number.isFinite(totalDur)) {
        onTimeUpdate?.(Math.floor(clampedTarget), Math.floor(totalDur));
      }
      return;
    }

    // 2. Out-of-buffer FileList / YouTube server seek: keep live video playing smoothly while holding or multi-tapping,
    // then perform ONE single fast server jump once the user stops tapping/holding!
    pendingSeekTargetSecRef.current = clampedTarget;
    pendingSeekMetaRef.current = { prefix, direction };
    setScrubPreviewSec(clampedTarget);

    if (pendingSeekTimerRef.current) {
      window.clearTimeout(pendingSeekTimerRef.current);
      pendingSeekTimerRef.current = null;
    }
    // While holding ArrowLeft/ArrowRight/FF/RW, NEVER kill & respawn the stream mid-hold — commit on keyup!
    if (isHoldingSeekRef.current) {
      return;
    }
    pendingSeekTimerRef.current = window.setTimeout(() => {
      pendingSeekTimerRef.current = null;
      const finalTarget = pendingSeekTargetSecRef.current;
      const meta = pendingSeekMetaRef.current;
      pendingSeekTargetSecRef.current = null;
      pendingSeekMetaRef.current = null;
      cumulativeSeekDeltaSecRef.current = 0;
      keySeekCountRef.current = 0;
      lastKeySeekDirRef.current = 0;
      if (typeof finalTarget === 'number') {
        seekToAbsoluteSeconds(
          finalTarget,
          meta?.prefix || prefix,
          meta?.direction || direction
        );
      }
    }, 550);
  };

  const triggerSeekRef = useRef(triggerSeek);
  triggerSeekRef.current = triggerSeek;

  const showTransportToast = (label: string) => {
    setSeekToast(label);
    if (seekToastTimerRef.current) {
      window.clearTimeout(seekToastTimerRef.current);
    }
    seekToastTimerRef.current = window.setTimeout(() => {
      setSeekToast(null);
    }, 1400);
  };

  const resumeOrRecoverPlayback = (v: HTMLVideoElement, showToast = true) => {
    userIntentionallyPausedRef.current = false;
    setIsPaused(false);
    const now = Date.now();
    const currentEff = Math.max(
      0,
      Math.floor(
        isFileListStream
          ? isSeekingFileListRef.current
            ? streamOffsetRef.current
            : Math.max(currentTimeSec, streamOffsetRef.current + (v.currentTime || 0))
          : v.currentTime || currentTimeSec
      )
    );

    // Check if the stream buffer is exhausted / MSE ended / connection dropped mid-movie
    let bufferedAhead = 0;
    try {
      for (let i = 0; i < v.buffered.length; i++) {
        if (
          v.currentTime >= v.buffered.start(i) - 0.5 &&
          v.currentTime <= v.buffered.end(i) + 0.5
        ) {
          bufferedAhead = Math.max(0, v.buffered.end(i) - v.currentTime);
          break;
        }
      }
    } catch {
      // ignore
    }

    const isMidMovie = remainingTimeSec > 35;
    const isMseClosedEarly =
      Boolean(flMediaSourceRef.current) &&
      flMediaSourceRef.current?.readyState !== 'open' &&
      bufferedAhead < 1.5 &&
      isMidMovie;
    const isStalledLong =
      now - lastTimeUpdateWallMsRef.current > 3500 &&
      (bufferedAhead < 0.8 || v.readyState < 3 || v.ended || v.networkState === 3) &&
      isMidMovie;

    if (
      isFileListStream &&
      (v.ended ||
        Boolean(v.error) ||
        flMseReaderDoneRef.current ||
        isMseClosedEarly ||
        v.readyState === 0 ||
        v.networkState === 3)
    ) {
      lastTimeUpdateWallMsRef.current = now;
      seekToAbsoluteSeconds(currentEff, showToast ? 'Reluare' : undefined);
      return;
    }
    if (isFileListStream) {
      v.play()
        .then(() => {
          setIsPaused(false);
          setStatus('playing');
        })
        .catch(() => {
          if (
            !userIntentionallyPausedRef.current &&
            (v.ended || Boolean(v.error) || flMseReaderDoneRef.current)
          ) {
            seekToAbsoluteSeconds(
              currentEff,
              showToast ? 'Reluare' : undefined
            );
          }
        });
      if (showToast) {
        showTransportToast('Redare');
      }
      return;
    }

    if (hlsRef.current && (v.ended || isStalledLong)) {
      lastTimeUpdateWallMsRef.current = now;
      lastHlsFragActivityMsRef.current = now;
      try {
        hlsRef.current.startLoad(currentEff);
        if (v.readyState < 2) {
          hlsRef.current.recoverMediaError();
        }
        v.currentTime = Math.max(0, v.currentTime + 0.05);
      } catch {
        // ignore
      }
    } else if (dashRef.current && (v.ended || isStalledLong)) {
      lastTimeUpdateWallMsRef.current = now;
      try {
        dashRef.current.seek(currentEff);
        dashRef.current.play();
      } catch {
        // ignore
      }
    } else if (v.ended || isStalledLong) {
      lastTimeUpdateWallMsRef.current = now;
      try {
        v.currentTime = Math.max(0, currentEff);
      } catch {
        // ignore
      }
    }

    v.play()
      .then(() => {
        setIsPaused(false);
        setStatus('playing');
      })
      .catch(() => {
        if (isFileListStream && currentEff > 5 && isMidMovie) {
          seekToAbsoluteSeconds(currentEff, showToast ? 'Reluare' : undefined);
        }
      });

    if (showToast) {
      showTransportToast('Redare');
    }
  };

  const resumeOrRecoverPlaybackRef = useRef(resumeOrRecoverPlayback);
  resumeOrRecoverPlaybackRef.current = resumeOrRecoverPlayback;
  const remainingTimeSecRef = useRef<number>(remainingTimeSec);
  remainingTimeSecRef.current = remainingTimeSec;

  // Automatic Stall Watchdog: if the movie freezes mid-playback without user pausing, auto-reconnect at exact second
  useEffect(() => {
    const watchdog = window.setInterval(() => {
      const v = videoRef.current;
      if (
        !v ||
        userIntentionallyPausedRef.current ||
        remainingTimeSecRef.current <= 35
      ) {
        return;
      }
      const now = Date.now();
      const stalledMs = now - lastTimeUpdateWallMsRef.current;
      if (isSeekingFileListRef.current) {
        if (
          isFileListStream &&
          stalledMs >= 16000 &&
          now - lastAutoRecoverWallMsRef.current >= 14000
        ) {
          isSeekingFileListRef.current = false;
          lastAutoRecoverWallMsRef.current = now;
          resumeOrRecoverPlaybackRef.current(v, false);
        }
        return;
      }
      if (status !== 'playing') {
        if (
          status === 'loading' &&
          !v.paused &&
          v.readyState >= 2 &&
          v.currentTime > 0.25
        ) {
          setStatus('playing');
        }
        return;
      }
      // Audio-Only Self-Healing Watchdog: if audio advances (> 2.2s) while video dimensions stay 0x0 on Smart TV / MSE,
      // automatically step down from unsupported 4K/HEVC/VP9 track to 1080p H.264!
      if (
        !v.paused &&
        !v.seeking &&
        v.currentTime > 2.2 &&
        v.videoWidth === 0 &&
        v.videoHeight === 0 &&
        now - lastAutoRecoverWallMsRef.current >= 4500
      ) {
        if (
          isFileListStream &&
          hlsUrl &&
          hlsUrl.includes('/api/filelist/stream') &&
          !/[?&]vtranscode=1/.test(hlsUrl)
        ) {
          lastAutoRecoverWallMsRef.current = now;
          const resumeAt = Math.max(
            0,
            Math.floor(streamOffsetRef.current + (v.currentTime || 0))
          );
          const cleanBase = hlsUrl
            .replace(/([?&])start=\d+/g, '')
            .replace(/([?&])maxw=\d+/g, '')
            .replace(/([?&])vtranscode=\d+/g, '');
          const sep = cleanBase.includes('?') ? '&' : '?';
          loadFileListStreamIntoVideo(
            v,
            `${cleanBase}${sep}start=${resumeAt}&maxw=1920&vtranscode=1`
          );
          return;
        }
        const hlsInst = hlsRef.current;
        if (hlsInst && hlsInst.levels && hlsInst.levels.length > 1) {
          const curLvl = hlsInst.levels[hlsInst.currentLevel];
          const fallback1080Idx = hlsInst.levels.findIndex(
            (l, idx) =>
              idx !== hlsInst.currentLevel &&
              (l.height || 0) > 0 &&
              (l.height || 0) <= 1080 &&
              !/^(hvc1|hev1|dvh1|dvhe|vp09|av01)/i.test(l.videoCodec || '')
          );
          if (
            fallback1080Idx >= 0 &&
            (!curLvl || (curLvl.height || 0) > 1080 || /^(hvc1|hev1|dvh1|vp09|av01)/i.test(curLvl.videoCodec || ''))
          ) {
            lastAutoRecoverWallMsRef.current = now;
            highestLevelIndexRef.current = fallback1080Idx;
            hlsInst.currentLevel = fallback1080Idx;
            hlsInst.nextLevel = fallback1080Idx;
            hlsInst.loadLevel = fallback1080Idx;
            setActiveQuality(fallback1080Idx);
            return;
          }
        }
      }
      if (isFileListStream) {
        const sb = flSourceBufferRef.current;
        if (sb && stalledMs >= 2600 && !v.seeking && !v.paused) {
          try {
            if (
              sb.buffered.length > 0 &&
              v.currentTime < 1.5 &&
              v.currentTime < sb.buffered.start(0) - 0.15
            ) {
              v.currentTime = sb.buffered.start(0) + 0.02;
              v.play().catch(() => { });
              return;
            }
            for (let k = 0; k < (sb.buffered?.length || 0) - 1; k++) {
              const gStart = sb.buffered.end(k);
              const gEnd = sb.buffered.start(k + 1);
              if (
                gEnd - gStart <= 4.5 &&
                v.currentTime >= gStart - 0.08 &&
                v.currentTime < gEnd - 0.01
              ) {
                v.currentTime = gEnd + 0.02;
                v.play().catch(() => { });
                return;
              }
            }
          } catch {
            // ignore
          }
        }
        // For FileList torrent streams, never kill an active ffmpeg stream during normal P2P piece buffering;
        // only reconnect if the HTTP stream genuinely ended/errored early, or if completely dead for >= 35s.
        const streamDiedEarly =
          v.ended ||
          Boolean(v.error) ||
          flMseReaderDoneRef.current ||
          v.networkState === 3;
        if (
          (streamDiedEarly && stalledMs >= 4500) ||
          stalledMs >= 35000
        ) {
          if (now - lastAutoRecoverWallMsRef.current >= 12000) {
            lastAutoRecoverWallMsRef.current = now;
            resumeOrRecoverPlaybackRef.current(v, false);
          }
        } else if (v.paused && v.readyState >= 2) {
          v.play().catch(() => { });
        }
        return;
      }
      const stallThresholdMs = hasRenderedFirstFrameRef.current ? 18000 : 26000;
      const activeHls = hlsRef.current as
        | (Hls & {
          streamController?: { state?: string; fragCurrent?: unknown };
        })
        | null;
      const isHlsActivelyLoadingFrag = Boolean(
        activeHls &&
        (activeHls.streamController?.fragCurrent ||
          activeHls.streamController?.state === 'FRAG_LOADING' ||
          now - lastHlsFragActivityMsRef.current < 22000)
      );
      if (isHlsActivelyLoadingFrag) {
        if (v.paused && v.readyState >= 2) {
          v.play().catch(() => { });
        }
        return;
      }
      if (
        stalledMs >= stallThresholdMs &&
        now - lastAutoRecoverWallMsRef.current >= 16000
      ) {
        lastAutoRecoverWallMsRef.current = now;
        resumeOrRecoverPlaybackRef.current(v, false);
      }
    }, 2500);
    return () => window.clearInterval(watchdog);
  }, [status, isFileListStream]);

  useEffect(() => {
    if (!isOsdVisible) return;
    const v = videoRef.current;
    if (!v) return;
    const eff = streamOffsetRef.current + (v.currentTime || 0);
    if (eff > 0) {
      setCurrentTimeSec(eff);
    }
    try {
      if (v.buffered && v.buffered.length > 0) {
        setBufferedEndSec(
          streamOffsetRef.current + v.buffered.end(v.buffered.length - 1)
        );
      }
    } catch {
      // ignore
    }
  }, [isOsdVisible]);

  const handleRemotePlayPause = (mode: 'play' | 'pause' | 'toggle') => {
    const v = videoRef.current;
    if (!v) return;
    onWakeOsd?.();

    const isCurrentlyFrozen =
      !userIntentionallyPausedRef.current &&
      Date.now() - lastTimeUpdateWallMsRef.current > 2800 &&
      (v.readyState < 3 || v.ended || v.paused);

    const shouldPlay =
      mode === 'play'
        ? true
        : mode === 'pause'
          ? false
          : v.paused || userIntentionallyPausedRef.current || isCurrentlyFrozen;

    if (shouldPlay) {
      resumeOrRecoverPlayback(v, true);
    } else {
      userIntentionallyPausedRef.current = true;
      v.pause();
      setIsPaused(true);
      showTransportToast('Pauză');
    }
  };

  const handleRemotePlayPauseRef = useRef(handleRemotePlayPause);
  handleRemotePlayPauseRef.current = handleRemotePlayPause;

  const audioTracksRef = useRef(audioTracks);
  audioTracksRef.current = audioTracks;
  const activeAudioTrackRef = useRef(activeAudioTrack);
  activeAudioTrackRef.current = activeAudioTrack;
  const availableSubsRef = useRef(availableSubs);
  availableSubsRef.current = availableSubs;
  const subtitleVttUrlRef = useRef(subtitleVttUrl);
  subtitleVttUrlRef.current = subtitleVttUrl;
  const subtitleCuesRef = useRef(subtitleCues);
  subtitleCuesRef.current = subtitleCues;
  const onClearSubtitleRef = useRef(onClearSubtitle);
  onClearSubtitleRef.current = onClearSubtitle;
  const onApplyAutoSubtitleRef = useRef(onApplyAutoSubtitle);
  onApplyAutoSubtitleRef.current = onApplyAutoSubtitle;
  const onSelectAudioTrackIndexRef = useRef(onSelectAudioTrackIndex);
  onSelectAudioTrackIndexRef.current = onSelectAudioTrackIndex;

  const handleCycleAudioTrack = () => {
    const list = audioTracksRef.current;
    if (!list || list.length === 0) {
      showTransportToast('Pistă unică');
      return;
    }
    if (list.length === 1) {
      showTransportToast(`Audio: ${list[0].name || 'Pistă unică'}`);
      return;
    }
    const visibleList = filterDisplayAudioItems(
      list.map((trk, idx) => ({ trk, idx })),
      (item) => item.trk.name,
      isForeign
    );
    const currentId = activeAudioTrackRef.current;
    const curPos = visibleList.findIndex((x) => x.trk.id === currentId);
    const nextEntry = visibleList[curPos >= 0 ? (curPos + 1) % visibleList.length : 0];
    if (!nextEntry) return;
    const trk = nextEntry.trk;
    const nextIdx = nextEntry.idx;

    const needsServerAudioReload = Boolean(
      hlsUrl && (hlsUrl.includes('/api/filelist/') || hlsUrl.includes('/api/tv-proxy'))
    );
    const v = videoRef.current;
    if (v && (streamOffsetRef.current + v.currentTime) > 3 && needsServerAudioReload) {
      startAtSecondsRef.current = Math.floor(streamOffsetRef.current + v.currentTime);
      appliedStartRef.current = false;
    }
    setActiveAudioTrack(trk.id);
    if (needsServerAudioReload) {
      setForcedAudioIdx(nextIdx);
    }
    if (!isForeign) {
      saveActiveProfileMediaPrefs({
        defaultAudioPref: inferAudioPrefFromTrackName(trk.name),
      });
    }
    onSelectAudioTrackIndexRef.current?.(nextIdx);
    if (dashRef.current) {
      const dashTracks = dashRef.current.getTracksFor('audio') || [];
      if (dashTracks[trk.id]) {
        dashRef.current.setCurrentTrack(dashTracks[trk.id]);
      }
    } else if (hlsRef.current && (!hlsUrl || !hlsUrl.includes('/api/tv-proxy'))) {
      hlsRef.current.audioTrack = trk.id;
    } else if (!hlsRef.current && (!hlsUrl || !hlsUrl.includes('/api/tv-proxy'))) {
      const vAny = videoRef.current as any;
      if (vAny?.audioTracks && vAny.audioTracks.length > 0) {
        for (let i = 0; i < vAny.audioTracks.length; i++) {
          if (vAny.audioTracks[i]) {
            vAny.audioTracks[i].enabled = i === trk.id;
          }
        }
      }
    }
    showTransportToast(`Audio: ${trk.name}`);
  };

  const handleToggleSubtitles = async () => {
    const hasActive =
      Boolean(subtitleVttUrlRef.current) ||
      Boolean(subtitleLabelRef.current) ||
      Boolean(subtitleCuesRef.current && subtitleCuesRef.current.length > 0);
    if (hasActive) {
      onClearSubtitleRef.current?.();
      setActiveSubTrackId(null);
      showTransportToast('Subtitrări: Oprite');
      return;
    }
    const subs = availableSubsRef.current;
    if (!subs || subs.length === 0) {
      showTransportToast('Nicio subtitrare disponibilă');
      return;
    }
    const prefCode = preferredSubLangRef.current && preferredSubLangRef.current !== 'off' ? preferredSubLangRef.current : 'ro';
    const roTrack = subs.find((t) => t.langCode2 === prefCode) || subs.find((t) => t.langCode2 === 'ro') || subs[0];
    if (roTrack) {
      try {
        const { vttBlobUrl, cues } = await downloadSubtitleAsVttBlobUrl(roTrack.url);
        setActiveSubTrackId(roTrack.id);
        onApplyAutoSubtitleRef.current?.({
          vttBlobUrl,
          label: roTrack.langLabel,
          cues,
        });
        showTransportToast(`Subtitrări: ${roTrack.langLabel || 'Română'}`);
      } catch {
        showTransportToast('Eroare la activarea subtitrării');
      }
    }
  };

  const handleCycleAudioTrackRef = useRef(handleCycleAudioTrack);
  handleCycleAudioTrackRef.current = handleCycleAudioTrack;
  const handleToggleSubtitlesRef = useRef(handleToggleSubtitles);
  handleToggleSubtitlesRef.current = handleToggleSubtitles;

  const lastKeySeekTimeRef = useRef<number>(0);
  const keySeekCountRef = useRef<number>(0);
  const lastKeySeekDirRef = useRef<number>(0);
  const seekHoldTimerRef = useRef<number | null>(null);
  const seekHoldIntervalRef = useRef<number | null>(null);
  const isHoldingSeekRef = useRef<boolean>(false);
  const hasHandledPointerSeekRef = useRef<boolean>(false);

  const getSmartSeekStep = (dir: 1 | -1): number => {
    const now = Date.now();
    let count = 1;
    if (lastKeySeekDirRef.current === dir && now - lastKeySeekTimeRef.current < 1100) {
      count = keySeekCountRef.current + 1;
    } else {
      count = 1;
    }
    lastKeySeekTimeRef.current = now;
    lastKeySeekDirRef.current = dir;
    keySeekCountRef.current = count;

    // Pas smart derulare accelerat (la apăsare repetată sau ținut apăsat continuu):
    // 1-ul pas: 15 secunde (total: 15s)
    // al 2-lea pas: încă 15 secunde (total: 30s)
    // al 3-lea pas: pas de 30 secunde (total: 60s / 1 min)
    // al 4-lea pas și următoarele: câte 1 minut (60 secunde) per pas continuu
    if (count === 1) return 15;
    if (count === 2) return 15;
    if (count === 3) return 30;
    return 60;
  };

  const handleSingleSeekTap = (dir: 1 | -1) => {
    triggerSeekRef.current(dir * 15);
  };

  const startSmartSeekHold = (dir: 1 | -1) => {
    // Mark holding BEFORE first tick so out-of-buffer server seek waits cleanly until release (never kills stream mid-hold)
    isHoldingSeekRef.current = true;
    // 1. Execută primul tick instantaneu la apăsare (+15s sau -15s)
    keySeekCountRef.current = 1;
    lastKeySeekDirRef.current = dir;
    triggerSeekRef.current(dir * 15);

    if (seekHoldTimerRef.current !== null) {
      window.clearTimeout(seekHoldTimerRef.current);
      seekHoldTimerRef.current = null;
    }
    if (seekHoldIntervalRef.current !== null) {
      window.clearInterval(seekHoldIntervalRef.current);
      seekHoldIntervalRef.current = null;
    }

    // 2. După 400ms de menținere apăsat (hold delay), execută al 2-lea pas (+15s -> total 30s)
    seekHoldTimerRef.current = window.setTimeout(() => {
      seekHoldTimerRef.current = null;
      if (!isHoldingSeekRef.current) return;

      keySeekCountRef.current = 2;
      triggerSeekRef.current(dir * 15);

      // 3. Apoi la fiecare 350ms execută pașii următori: pas de 30s (total 1 min), apoi câte 60s (1 min) continuu
      seekHoldIntervalRef.current = window.setInterval(() => {
        if (!isHoldingSeekRef.current) {
          if (seekHoldIntervalRef.current !== null) {
            window.clearInterval(seekHoldIntervalRef.current);
            seekHoldIntervalRef.current = null;
          }
          return;
        }
        keySeekCountRef.current = Math.min(20, (keySeekCountRef.current || 2) + 1);
        const count = keySeekCountRef.current;
        const step = count === 3 ? 30 : 60;
        triggerSeekRef.current(dir * step);
      }, 350);
    }, 400);
  };

  const stopSmartSeekHold = () => {
    const wasHolding = isHoldingSeekRef.current;
    isHoldingSeekRef.current = false;
    if (seekHoldTimerRef.current !== null) {
      window.clearTimeout(seekHoldTimerRef.current);
      seekHoldTimerRef.current = null;
    }
    if (seekHoldIntervalRef.current !== null) {
      window.clearInterval(seekHoldIntervalRef.current);
      seekHoldIntervalRef.current = null;
    }
    // Commit accumulated out-of-buffer server seek once after key release (short window allows quick follow-up taps without double-reloading)
    if (wasHolding && pendingSeekTargetSecRef.current !== null) {
      if (pendingSeekTimerRef.current) {
        window.clearTimeout(pendingSeekTimerRef.current);
      }
      const commitDelayMs = (keySeekCountRef.current || 1) >= 2 ? 180 : 480;
      pendingSeekTimerRef.current = window.setTimeout(() => {
        pendingSeekTimerRef.current = null;
        const finalTarget = pendingSeekTargetSecRef.current;
        const meta = pendingSeekMetaRef.current;
        pendingSeekTargetSecRef.current = null;
        pendingSeekMetaRef.current = null;
        cumulativeSeekDeltaSecRef.current = 0;
        keySeekCountRef.current = 0;
        lastKeySeekDirRef.current = 0;
        if (typeof finalTarget === 'number') {
          seekToAbsoluteSeconds(
            finalTarget,
            meta?.prefix,
            meta?.direction
          );
        }
      }, commitDelayMs);
    }
  };

  const cycleVideoFitModeRef = useRef<() => void>(() => { });

  const triggerSeekWithStep = (dir: 1 | -1) => {
    handleSingleSeekTap(dir);
  };

  useEffect(() => {
    const onExternalSeek = (ev: Event) => {
      const customEv = ev as CustomEvent<{ deltaSec?: number }>;
      const delta = customEv.detail?.deltaSec;
      if (typeof delta === 'number') {
        triggerSeekRef.current(delta);
      }
    };
    const onExternalTransport = (ev: Event) => {
      const customEv = ev as CustomEvent<{
        action?: 'play' | 'pause' | 'toggle' | 'rw' | 'ff';
      }>;
      const act = customEv.detail?.action;
      if (act === 'play' || act === 'pause' || act === 'toggle') {
        handleRemotePlayPauseRef.current(act);
      } else if (act === 'rw') {
        onHideOsd?.();
        triggerSeekWithStep(-1);
      } else if (act === 'ff') {
        onHideOsd?.();
        triggerSeekWithStep(1);
      }
    };
    const onMediaKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      const kc = e.keyCode || e.which;
      const k = e.key;

      // Remote ArrowLeft / ArrowRight -> Instant Smart Seek during video playback when watching
      const isSeekBtn =
        activeTag === 'BUTTON' &&
        Boolean(
          (document.activeElement as HTMLElement | null)?.closest(
            '[data-vod-seek-back-15="true"], [data-vod-seek-fwd-15="true"], [data-vod-seek-fwd-60="true"]'
          )
        );

      if (
        (k === 'ArrowLeft' || k === 'ArrowRight') &&
        (activeTag !== 'BUTTON' || isSeekBtn) &&
        activeTag !== 'INPUT' &&
        activeTag !== 'SELECT' &&
        activeTag !== 'TEXTAREA' &&
        openMenuRef.current === 'none'
      ) {
        e.preventDefault();
        e.stopPropagation();
        onHideOsd?.();
        const dir = k === 'ArrowRight' ? 1 : -1;
        if (!e.repeat) {
          startSmartSeekHold(dir);
        }
        return;
      }

      // Play button on LG webOS / Samsung Tizen / Sony / Philips / Android TV remotes (415, 250, MediaPlay)
      if (
        kc === 415 ||
        kc === 250 ||
        k === 'MediaPlay' ||
        k === 'Play'
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleRemotePlayPauseRef.current('play');
        return;
      }

      // Pause button on Smart TV remotes (19, MediaPause, Pause)
      if (
        kc === 19 ||
        k === 'MediaPause' ||
        k === 'Pause'
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleRemotePlayPauseRef.current('pause');
        return;
      }

      // Combined Play/Pause button on remotes & keyboards (179, MediaPlayPause, Spacebar when not focused on a button)
      if (
        kc === 179 ||
        k === 'MediaPlayPause' ||
        (k === ' ' && activeTag !== 'BUTTON' && activeTag !== 'SELECT')
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleRemotePlayPauseRef.current('toggle');
        return;
      }

      // Stop button on Smart TV remotes (413, 178, MediaStop) -> Pause playback & show OSD
      if (kc === 413 || kc === 178 || k === 'MediaStop') {
        e.preventDefault();
        e.stopPropagation();
        const v = videoRef.current;
        userIntentionallyPausedRef.current = true;
        if (v && !v.paused) {
          v.pause();
          setIsPaused(true);
          showTransportToast('Pauză');
        }
        onWakeOsd?.();
        return;
      }

      // Rewind << button on Smart TV remotes (412, 227, MediaRewind)
      if (kc === 412 || kc === 227 || k === 'MediaRewind') {
        e.preventDefault();
        e.stopPropagation();
        onHideOsd?.();
        if (!e.repeat) {
          startSmartSeekHold(-1);
        }
        return;
      }

      // Fast-Forward >> button on Smart TV remotes (417, 228, MediaFastForward)
      if (kc === 417 || kc === 228 || k === 'MediaFastForward') {
        e.preventDefault();
        e.stopPropagation();
        onHideOsd?.();
        if (!e.repeat) {
          startSmartSeekHold(1);
        }
        return;
      }

      // Hardware Color Buttons during standalone video playback (when inside SmartTvLampaViewCore,
      // SmartTvLampaViewCore is the single source of truth for Red/Green/Yellow/Blue to prevent double-firing):
      if (document.querySelector('[data-lampa-root="true"]')) {
        return;
      }

      // Red button (403, 183, F1, ColorF0Red, Red, 'r') -> Sursă & Calitate Video
      if (
        kc === 403 ||
        kc === 183 ||
        k === 'F1' ||
        k === 'ColorF0Red' ||
        k === 'Red' ||
        ((k === 'r' || k === 'R') && activeTag !== 'BUTTON')
      ) {
        e.preventDefault();
        e.stopPropagation();
        onWakeOsd?.();
        setOpenMenu((prev) => (prev === 'quality' || prev === 'server' ? 'none' : 'quality'));
        return;
      }

      // Green button (404, 184, F2, ColorF1Green, Green, 'g') -> Subtitrări
      if (
        kc === 404 ||
        kc === 184 ||
        k === 'F2' ||
        k === 'ColorF1Green' ||
        k === 'Green' ||
        ((k === 'g' || k === 'G') && activeTag !== 'BUTTON')
      ) {
        e.preventDefault();
        e.stopPropagation();
        onWakeOsd?.();
        setOpenMenu((prev) => (prev === 'subtitles' ? 'none' : 'subtitles'));
        return;
      }

      // Blue button (406, 186, F4, ColorF3Blue, Blue, 'b') -> Pistă Audio
      if (
        kc === 406 ||
        kc === 186 ||
        k === 'F4' ||
        k === 'ColorF3Blue' ||
        k === 'Blue' ||
        ((k === 'b' || k === 'B') && activeTag !== 'BUTTON')
      ) {
        e.preventDefault();
        e.stopPropagation();
        onWakeOsd?.();
        setOpenMenu((prev) => (prev === 'audio' ? 'none' : 'audio'));
        return;
      }

      // Yellow button (405, 185, F3, ColorF2Yellow, Yellow, 'y') -> Cycle Video Format (Original 16:9 / Zoom Cinema 21:9 / Ecran Plin 100%)
      if (
        kc === 405 ||
        kc === 185 ||
        k === 'F3' ||
        k === 'ColorF2Yellow' ||
        k === 'Yellow' ||
        ((k === 'y' || k === 'Y') && activeTag !== 'BUTTON')
      ) {
        e.preventDefault();
        e.stopPropagation();
        cycleVideoFitModeRef.current();
        return;
      }
    };

    // MediaSession metadata & CarPlay / steering-wheel / remote handlers are bound in dedicated reactive effect below

    const onCloseMenu = () => {
      setOpenMenu('none');
    };
    const onSelectQualityEv = (ev: Event) => {
      const customEv = ev as CustomEvent<{ index?: number }>;
      const idx = customEv.detail?.index;
      if (typeof idx === 'number') {
        handleSelectQualityLevelRef.current(idx);
        setOpenMenu('none');
      }
    };
    const onOpenQualityMenuEv = () => {
      setOpenMenu((prev) => {
        const next = prev === 'quality' ? 'none' : 'quality';
        if (next === 'quality') {
          window.setTimeout(() => {
            const container = qualityBtnRef.current?.parentElement;
            const activeBtn =
              container?.querySelector<HTMLButtonElement>(
                '[data-quality-opt-active="true"]'
              ) ||
              container?.querySelector<HTMLButtonElement>(
                '[data-quality-opt="true"]'
              );
            activeBtn?.focus();
          }, 40);
        }
        return next;
      });
    };
    const onOpenMenuEv = (ev: Event) => {
      const customEv = ev as CustomEvent<{
        menu?: 'subtitles' | 'audio' | 'server' | 'quality';
      }>;
      const rawTargetMenu = customEv.detail?.menu;
      if (!rawTargetMenu) return;
      const targetMenu =
        rawTargetMenu === 'server' ? 'quality' : rawTargetMenu;
      onWakeOsd?.();
      setOpenMenu((prev) => {
        const currentNormalized = prev === 'server' ? 'quality' : prev;
        const next = currentNormalized === targetMenu ? 'none' : targetMenu;
        if (next !== 'none') {
          window.setTimeout(() => {
            const rootEl = playerRootRef.current;
            const popover = rootEl?.querySelector<HTMLElement>(
              '[data-vod-menu-popover="true"]'
            );
            const activeBtn =
              popover?.querySelector<HTMLButtonElement>(
                '[data-sub-track-active="true"], [data-audio-track-active="true"], [data-server-opt-active="true"], [data-quality-opt-active="true"]'
              ) ||
              popover?.querySelector<HTMLButtonElement>(
                '[data-sub-track-opt="true"], [data-audio-track-opt="true"], [data-server-opt="true"], [data-quality-opt="true"], button:not([disabled])'
              );
            activeBtn?.focus();
          }, 45);
        }
        return next;
      });
    };

    const onToggleAudioEv = () => {
      handleCycleAudioTrackRef.current();
    };
    const onToggleSubEv = () => {
      handleToggleSubtitlesRef.current();
    };
    const onToastEv = (ev: Event) => {
      const customEv = ev as CustomEvent<{ message?: string }>;
      const msg = customEv.detail?.message;
      if (msg) {
        showTransportToast(msg);
      }
    };

    const onMediaKeyUp = (e: KeyboardEvent) => {
      const k = e.key;
      const kc = e.keyCode || e.which;
      if (
        k === 'ArrowLeft' ||
        k === 'ArrowRight' ||
        kc === 412 ||
        kc === 227 ||
        k === 'MediaRewind' ||
        kc === 417 ||
        kc === 228 ||
        k === 'MediaFastForward'
      ) {
        stopSmartSeekHold();
      }
    };

    window.addEventListener('aether:vod-seek', onExternalSeek);
    window.addEventListener('aether:vod-transport', onExternalTransport);
    window.addEventListener('keydown', onMediaKeyDown, true);
    window.addEventListener('keyup', onMediaKeyUp, true);
    window.addEventListener('blur', stopSmartSeekHold);
    window.addEventListener('aether:vod-close-menu', onCloseMenu);
    window.addEventListener('aether:vod-select-quality', onSelectQualityEv);
    window.addEventListener(
      'aether:vod-open-quality-menu',
      onOpenQualityMenuEv
    );
    window.addEventListener('aether:vod-open-menu', onOpenMenuEv);
    window.addEventListener('aether:vod-toggle-audio', onToggleAudioEv);
    window.addEventListener('aether:vod-toggle-subtitle', onToggleSubEv);
    window.addEventListener('aether:vod-toast', onToastEv);
    return () => {
      stopSmartSeekHold();
      window.removeEventListener('aether:vod-seek', onExternalSeek);
      window.removeEventListener('aether:vod-transport', onExternalTransport);
      window.removeEventListener('keydown', onMediaKeyDown, true);
      window.removeEventListener('keyup', onMediaKeyUp, true);
      window.removeEventListener('blur', stopSmartSeekHold);
      window.removeEventListener('aether:vod-close-menu', onCloseMenu);
      window.removeEventListener(
        'aether:vod-select-quality',
        onSelectQualityEv
      );
      window.removeEventListener(
        'aether:vod-open-quality-menu',
        onOpenQualityMenuEv
      );
      window.removeEventListener('aether:vod-open-menu', onOpenMenuEv);
      window.removeEventListener('aether:vod-toggle-audio', onToggleAudioEv);
      window.removeEventListener('aether:vod-toggle-subtitle', onToggleSubEv);
      window.removeEventListener('aether:vod-toast', onToastEv);
    };
  }, []);

  const playerRootRef = useRef<HTMLDivElement | null>(null);
  const [isCustomFullscreen, setIsCustomFullscreen] = useState<boolean>(false);
  const [videoFitMode, setVideoFitMode] = useState<VideoFitMode>(() =>
    loadPreferredVideoFitMode()
  );
  const lastMediaSessionPosSyncMsRef = useRef<number>(0);
  const seekToAbsoluteSecondsRef = useRef<(sec: number) => void>(() => { });
  seekToAbsoluteSecondsRef.current = (sec: number) => {
    seekToAbsoluteSeconds(sec);
  };
  const onPrevEpisodeRef = useRef(onPrevEpisode);
  onPrevEpisodeRef.current = onPrevEpisode;
  const onNextEpisodeRef = useRef(onNextEpisode);
  onNextEpisodeRef.current = onNextEpisode;
  const onClosePlayerRef = useRef(onClosePlayer);
  onClosePlayerRef.current = onClosePlayer;

  const cycleVideoFitMode = () => {
    onWakeOsd?.();
    setVideoFitMode((prev) => {
      const next: VideoFitMode =
        prev === 'contain' ? 'cinema' : prev === 'cinema' ? 'cover' : 'contain';
      savePreferredVideoFitMode(next);
      showTransportToast(
        next === 'cover'
          ? 'Ecran Plin 100% (Fără Margini)'
          : next === 'cinema'
            ? 'Zoom Cinema 21:9'
            : 'Format Original 16:9'
      );
      return next;
    });
  };
  cycleVideoFitModeRef.current = cycleVideoFitMode;

  useEffect(() => {
    const onCarModeChanged = (ev: Event) => {
      const enabled = Boolean((ev as CustomEvent<{ enabled?: boolean }>).detail?.enabled);
      if (enabled) {
        setVideoFitMode('cover');
      }
    };
    window.addEventListener('aether:car-mode-change', onCarModeChanged);
    return () =>
      window.removeEventListener('aether:car-mode-change', onCarModeChanged);
  }, []);

  // Reactive Apple CarPlay Now Playing + Steering-Wheel + Smart TV MediaSession binding
  useEffect(() => {
    const artistLabel =
      mediaType === 'series'
        ? `S${season}:E${episode}${subtitle ? ` • ${subtitle}` : ''}`
        : subtitle || sourceQualityBadge || 'Filmio Cinema';

    claimMediaSession(
      'vod',
      {
        title: title || 'Filmio Cinema',
        artist: artistLabel,
        album: 'Filmio Cinema',
        artworkUrl: poster || backdropUrl || '/apple-touch-icon.png',
      },
      {
        onPlay: () => {
          const v = videoRef.current;
          userIntentionallyPausedRef.current = false;
          if (v) {
            v.play().catch(() => { });
            setIsPaused(false);
            showTransportToast('Redare');
          }
        },
        onPause: () => {
          const v = videoRef.current;
          userIntentionallyPausedRef.current = true;
          if (v) {
            v.pause();
            setIsPaused(true);
            showTransportToast('Pauză');
          }
        },
        onStop: () => {
          if (onClosePlayerRef.current) {
            onClosePlayerRef.current();
          } else {
            userIntentionallyPausedRef.current = true;
            videoRef.current?.pause();
          }
        },
        onPrev: () => {
          if (onPrevEpisodeRef.current) {
            onPrevEpisodeRef.current();
          } else {
            triggerSeekRef.current(-15);
          }
        },
        onNext: () => {
          if (onNextEpisodeRef.current) {
            onNextEpisodeRef.current();
          } else {
            triggerSeekRef.current(15);
          }
        },
        onSeekBackward: (offset) => {
          triggerSeekRef.current(-(offset || 15));
        },
        onSeekForward: (offset) => {
          triggerSeekRef.current(offset || 15);
        },
        onSeekTo: (sec) => {
          seekToAbsoluteSecondsRef.current(sec);
        },
      }
    );
  }, [
    title,
    subtitle,
    poster,
    backdropUrl,
    mediaType,
    season,
    episode,
    sourceQualityBadge,
  ]);

  useEffect(() => {
    updateMediaSessionPlaybackState('vod', isPaused ? 'paused' : 'playing');
    if (!isPaused) {
      acquirePlaybackWakeLock('vod');
    } else if (userIntentionallyPausedRef.current) {
      releasePlaybackWakeLock('vod');
    }
  }, [isPaused]);

  const prevOpenMenuForOsdRef = useRef(openMenu);
  useEffect(() => {
    const prev = prevOpenMenuForOsdRef.current;
    prevOpenMenuForOsdRef.current = openMenu;
    if (prev !== 'none' && openMenu === 'none' && isOsdVisible) {
      onWakeOsd?.();
    }
  }, [openMenu, isOsdVisible, onWakeOsd]);

  useEffect(() => {
    acquirePlaybackWakeLock('vod');
    return () => {
      releasePlaybackWakeLock('vod');
      releaseMediaSession('vod');
    };
  }, []);

  // iOS CarPlay Lock-Screen / Waze Background Audio Continuity Guard
  useEffect(() => {
    if (typeof document === 'undefined' || typeof navigator === 'undefined') {
      return;
    }
    const isIosDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    if (!isIosDevice) return;
    let resumeTimer: number | null = null;
    const onVisibilityChange = () => {
      if (document.hidden && !userIntentionallyPausedRef.current) {
        resumeTimer = window.setTimeout(() => {
          const v = videoRef.current;
          if (
            v &&
            v.paused &&
            !v.ended &&
            !userIntentionallyPausedRef.current
          ) {
            v.play().catch(() => { });
          }
        }, 180);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      if (resumeTimer !== null) window.clearTimeout(resumeTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
  const [isIosNativeFullscreen, setIsIosNativeFullscreen] = useState<boolean>(false);
  const [isLandscapeMobile, setIsLandscapeMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false
  );
  const hasInitialPlayWokenOsdRef = useRef<boolean>(false);

  useEffect(() => {
    hasInitialPlayWokenOsdRef.current = false;
  }, [hlsUrl, dashUrl]);

  useEffect(() => {
    const syncOrientation = () => {
      setIsLandscapeMobile(window.innerWidth > window.innerHeight);
    };
    let orientT1: number | null = null;
    let orientT2: number | null = null;
    const syncOrientationDelayed = () => {
      syncOrientation();
      if (orientT1 !== null) window.clearTimeout(orientT1);
      if (orientT2 !== null) window.clearTimeout(orientT2);
      orientT1 = window.setTimeout(syncOrientation, 80);
      orientT2 = window.setTimeout(syncOrientation, 280);
    };
    const onCustomFs = (ev: Event) => {
      const customEv = ev as CustomEvent<{ force?: boolean }>;
      if (typeof customEv.detail?.force === 'boolean') {
        setIsCustomFullscreen(customEv.detail.force);
      } else {
        setIsCustomFullscreen((prev) => !prev);
      }
    };
    const onNativeFsChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      const inFs = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
      setIsCustomFullscreen(inFs);
      syncOrientationDelayed();
    };
    window.addEventListener('resize', syncOrientation);
    window.addEventListener('orientationchange', syncOrientationDelayed);
    window.addEventListener('aether:vod-custom-fullscreen-toggle', onCustomFs);
    document.addEventListener('fullscreenchange', onNativeFsChange);
    document.addEventListener('webkitfullscreenchange', onNativeFsChange);
    return () => {
      if (orientT1 !== null) window.clearTimeout(orientT1);
      if (orientT2 !== null) window.clearTimeout(orientT2);
      window.removeEventListener('resize', syncOrientation);
      window.removeEventListener('orientationchange', syncOrientationDelayed);
      window.removeEventListener('aether:vod-custom-fullscreen-toggle', onCustomFs);
      document.removeEventListener('fullscreenchange', onNativeFsChange);
      document.removeEventListener('webkitfullscreenchange', onNativeFsChange);
    };
  }, []);

  const pinchStartDistRef = useRef<number | null>(null);

  const isRealHardwareTv =
    typeof document !== 'undefined' &&
    (document.documentElement.classList.contains('hardware-tv-gpu') ||
      /Web0S|WebOS|NetCast|SmartTV|SMART-TV|Tizen|BRAVIA|Android TV|GoogleTV|VIDAA|HbbTV/i.test(
        typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
      ));

  const handleToggleVodFullscreen = () => {
    setOpenMenu('none');

    // On real hardware Smart TVs (LG webOS / Samsung Tizen / Sony Android TV), the player is already fullscreen,
    // so the Yellow Format/Fullscreen button directly cycles video aspect ratio (16:9 -> 21:9 -> Ecran Plin 100%).
    if (isRealHardwareTv) {
      cycleVideoFitMode();
      return;
    }

    onHideOsd?.();

    const v = videoRef.current;
    if (v && v.muted && isAutoMuted) {
      v.muted = false;
      v.volume = 1;
      setIsAutoMuted(false);
    }

    const toggleMobileSinglePlayerFullscreen = () => {
      const isPortraitNow =
        typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
      if (isPortraitNow) {
        const nextFs = !isCustomFullscreen;
        setIsCustomFullscreen(nextFs);
        if (!nextFs) {
          setVideoFitMode('contain');
        }
        window.dispatchEvent(
          new CustomEvent('aether:vod-custom-fullscreen-toggle', {
            detail: { force: nextFs },
          })
        );
        showTransportToast(
          nextFs ? 'Ecran Complet (Landscape)' : 'Mod Portret'
        );
      } else {
        cycleVideoFitMode();
      }
    };

    const docElTarget =
      typeof document !== 'undefined' && !isMobilePhone
        ? (document.documentElement as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void> | void;
        })
        : null;

    const rootTarget =
      docElTarget ||
      (playerRootRef.current?.closest(
        '[data-vod-full-player="true"]'
      ) as (HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
      }) | null) ||
      (playerRootRef.current as
        | (HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void> | void;
        })
        | null);

    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };

    if (typeof document !== 'undefined' && (doc.fullscreenElement || doc.webkitFullscreenElement)) {
      const isTouchIpad =
        typeof navigator !== 'undefined' &&
        (/iPad|iPhone|iPod/i.test(navigator.userAgent || '') ||
          (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1));
      if (isTouchIpad) {
        cycleVideoFitMode();
        return;
      }
      if (typeof doc.exitFullscreen === 'function') {
        void doc.exitFullscreen().catch(() => { });
      } else if (typeof doc.webkitExitFullscreen === 'function') {
        void Promise.resolve(doc.webkitExitFullscreen()).catch(() => { });
      }
      setIsCustomFullscreen(false);
      window.dispatchEvent(
        new CustomEvent('aether:vod-custom-fullscreen-toggle', {
          detail: { force: false },
        })
      );
      return;
    }

    if (rootTarget) {
      const reqFn =
        rootTarget.requestFullscreen || rootTarget.webkitRequestFullscreen;
      if (typeof reqFn === 'function') {
        Promise.resolve(reqFn.call(rootTarget))
          .then(() => {
            setIsCustomFullscreen(true);
            window.dispatchEvent(
              new CustomEvent('aether:vod-custom-fullscreen-toggle', {
                detail: { force: true },
              })
            );
            try {
              (
                screen.orientation as unknown as {
                  lock?: (mode: string) => Promise<void>;
                }
              )
                ?.lock?.('landscape')
                ?.catch(() => { });
            } catch {
              // ignore
            }
          })
          .catch(() => {
            toggleMobileSinglePlayerFullscreen();
          });
        return;
      }
    }

    toggleMobileSinglePlayerFullscreen();
  };

  const handleTriggerAirPlay = () => {
    onWakeOsd?.();
    const v = videoRef.current as
      | (HTMLVideoElement & {
        webkitShowPlaybackTargetPicker?: () => void;
        remote?: { prompt?: () => Promise<void> };
      })
      | null;
    if (!v) return;
    try {
      v.disableRemotePlayback = false;
      v.setAttribute('x-webkit-airplay', 'allow');
      v.setAttribute('airplay', 'allow');
    } catch {
      // ignore
    }
    if (typeof v.webkitShowPlaybackTargetPicker === 'function') {
      try {
        if (
          hlsRef.current &&
          hlsUrl &&
          !offlineItem &&
          v.canPlayType('application/vnd.apple.mpegurl')
        ) {
          const savedTime = v.currentTime || 0;
          const wasPaused = v.paused;
          try {
            hlsRef.current.destroy();
          } catch {
            // ignore
          }
          hlsRef.current = null;
          v.src = hlsUrl;
          v.addEventListener(
            'loadedmetadata',
            () => {
              if (savedTime > 2) {
                try {
                  v.currentTime = savedTime;
                } catch {
                  // ignore
                }
              }
              if (!wasPaused) {
                void v.play().catch(() => { });
              }
            },
            { once: true }
          );
        }
        v.webkitShowPlaybackTargetPicker();
        return;
      } catch {
        // fallback below
      }
    }

    const triggerPresentationCast = () => {
      try {
        const PresReq = (
          window as unknown as {
            PresentationRequest?: new (
              urls: string | string[]
            ) => { start: () => Promise<unknown> };
          }
        ).PresentationRequest;
        if (typeof PresReq === 'function') {
          const castUrls: string[] = ['cast:CC1AD845'];
          if (hlsUrl && /^https?:/i.test(hlsUrl)) {
            castUrls.push(hlsUrl);
          } else if (typeof window !== 'undefined' && window.location?.href) {
            castUrls.push(window.location.href);
          }
          const req = new PresReq(castUrls);
          req.start().catch(() => { });
          return true;
        }
      } catch {
        // ignore
      }
      return false;
    };

    const isBlobMediaSource =
      Boolean(hlsRef.current || dashRef.current) ||
      String(v.currentSrc || v.src || '').startsWith('blob:');

    if (!isBlobMediaSource && v.remote && typeof v.remote.prompt === 'function') {
      v.remote.prompt().catch(() => {
        triggerPresentationCast();
      });
      return;
    }

    if (triggerPresentationCast()) {
      return;
    }

    if (v.remote && typeof v.remote.prompt === 'function') {
      v.remote.prompt().catch(() => { });
    }
  };

  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.setAttribute('x-webkit-airplay', 'allow');
      v.setAttribute('airplay', 'allow');
    }
  }, [hlsUrl, dashUrl]);

  const handleToggleVodFullscreenRef = useRef(handleToggleVodFullscreen);
  handleToggleVodFullscreenRef.current = handleToggleVodFullscreen;

  useEffect(() => {
    const onToggleFsEv = () => {
      handleToggleVodFullscreenRef.current();
    };
    const onCycleFormatEv = () => {
      cycleVideoFitModeRef.current();
    };
    window.addEventListener('aether:vod-toggle-fullscreen', onToggleFsEv);
    window.addEventListener('aether:vod-cycle-format', onCycleFormatEv);
    return () => {
      window.removeEventListener('aether:vod-toggle-fullscreen', onToggleFsEv);
      window.removeEventListener('aether:vod-cycle-format', onCycleFormatEv);
    };
  }, []);

  // Keep native <video> textTracks disabled during inline playback so only the custom Filmio subtitle box renders (never double subtitles).
  // Only enable our custom Romanian <track> while iOS native fullscreen (webkitDisplayingFullscreen) is active.
  useEffect(() => {
    const v = videoRef.current as
      | (HTMLVideoElement & { webkitDisplayingFullscreen?: boolean })
      | null;
    if (!v) return;
    const syncNativeTracks = () => {
      const inIosFs = Boolean(v.webkitDisplayingFullscreen);
      setIsIosNativeFullscreen(inIosFs);
      if (!v.textTracks) return;
      for (let i = 0; i < v.textTracks.length; i++) {
        try {
          const track = v.textTracks[i];
          const isOurRoTrack =
            inIosFs &&
            Boolean(subtitleVttUrl && hasActiveSubtitle) &&
            (track.language === 'ro' ||
              track.label === (subtitleLabel || 'Română'));
          const desiredMode = isOurRoTrack ? 'showing' : 'disabled';
          if (track.mode !== desiredMode) {
            track.mode = desiredMode;
          }
        } catch {
          // ignore
        }
      }
    };
    const onWebkitBeginFs = () => {
      setIsIosNativeFullscreen(true);
      onHideOsd?.();
      syncNativeTracks();
    };
    const onWebkitEndFs = () => {
      setIsIosNativeFullscreen(false);
      syncNativeTracks();
    };
    syncNativeTracks();
    const tt = v.textTracks;
    tt?.addEventListener?.('addtrack', syncNativeTracks);
    tt?.addEventListener?.('change', syncNativeTracks);
    v.addEventListener('loadedmetadata', syncNativeTracks);
    v.addEventListener('canplay', syncNativeTracks);
    v.addEventListener('webkitbeginfullscreen', onWebkitBeginFs);
    v.addEventListener('webkitendfullscreen', onWebkitEndFs);
    return () => {
      tt?.removeEventListener?.('addtrack', syncNativeTracks);
      tt?.removeEventListener?.('change', syncNativeTracks);
      v.removeEventListener('loadedmetadata', syncNativeTracks);
      v.removeEventListener('canplay', syncNativeTracks);
      v.removeEventListener('webkitbeginfullscreen', onWebkitBeginFs);
      v.removeEventListener('webkitendfullscreen', onWebkitEndFs);
    };
  }, [hlsUrl, subtitleVttUrl, hasActiveSubtitle, subtitleLabel, onHideOsd]);

  // Ensure that whenever the OSD is visible, a button on the OSD has focus so the white highlight is always visible and ready for Left/Right arrows
  useEffect(() => {
    if (!isOsdVisible || openMenu !== 'none' || pendingSeekTargetSecRef.current !== null) return;
    const timer = window.setTimeout(() => {
      if (pendingSeekTargetSecRef.current !== null) return;
      const rootEl = playerRootRef.current;
      if (!rootEl) return;
      const skipBtn = rootEl.querySelector<HTMLButtonElement>(
        '[data-vod-skip-intro-btn="true"]'
      );
      if (skipBtn) {
        try {
          skipBtn.focus({ preventScroll: true });
        } catch {
          skipBtn.focus();
        }
        return;
      }
      const autoNextBtn = rootEl.querySelector<HTMLButtonElement>(
        '[data-vod-autonext-btn="true"]'
      );
      if (autoNextBtn) {
        try {
          autoNextBtn.focus({ preventScroll: true });
        } catch {
          autoNextBtn.focus();
        }
        return;
      }
      const active = document.activeElement as HTMLElement | null;
      const isAlreadyFocusedInside =
        active &&
        active !== document.body &&
        (rootEl.contains(active) ||
          Boolean(active.closest('[data-vod-top-back-btn="true"]')));
      if (!isAlreadyFocusedInside && !isMobilePhone) {
        const playBtn = rootEl.querySelector<HTMLButtonElement>(
          '[data-vod-play-btn="true"]'
        );
        playBtn?.focus();
      }
    }, 30);
    return () => window.clearTimeout(timer);
  }, [isOsdVisible, openMenu, status, isMobilePhone]);

  const isSameAspectAsScreen = (() => {
    if (typeof window === 'undefined') return false;
    const vw = window.innerWidth || 1920;
    const vh = window.innerHeight || 1080;
    const screenAspect = vw / Math.max(1, vh);
    if (!liveVideoDims.width || !liveVideoDims.height) {
      return screenAspect >= 1.65 && screenAspect <= 1.9;
    }
    const videoAspect = liveVideoDims.width / liveVideoDims.height;
    return Math.abs(videoAspect - screenAspect) < 0.14;
  })();

  const resolvedVideoFitClass =
    videoFitMode === 'cover'
      ? isSameAspectAsScreen && !isMobilePhone
        ? 'vod-fit-cover-letterbox'
        : isMobilePhone && !isLandscapeMobile
          ? 'object-cover object-center'
          : 'object-cover object-[50%_28%]'
      : videoFitMode === 'cinema'
        ? resolveCinemaFitClass(liveVideoDims.width, liveVideoDims.height)
        : 'object-contain';

  const isNarrowPortraitMobile =
    isMobilePhone && !isLandscapeMobile && !isCustomFullscreen;

  const handleStageTapToggleOsd = (e: React.MouseEvent) => {
    e.stopPropagation();
    const vid = videoRef.current;
    if (vid && vid.muted && isAutoMuted) {
      vid.muted = false;
      vid.volume = 1;
      setIsAutoMuted(false);
    }
    if (openMenu !== 'none') {
      setOpenMenu('none');
    } else if ((isMobilePhone || isIpadTablet) && isOsdVisible && onHideOsd) {
      onHideOsd();
    } else {
      onWakeOsd?.();
    }
  };

  return (
    <div
      ref={playerRootRef}
      data-vod-open-menu={openMenu}
      className="relative z-10 w-full h-full bg-black flex flex-col select-none"
    >
      <div
        onClick={handleStageTapToggleOsd}
        className="relative flex-1 w-full h-full bg-black flex items-center justify-center overflow-hidden"
      >
        <video
          ref={videoRef}
          controls={false}
          playsInline
          webkit-playsinline="true"
          {...({ 'x-webkit-airplay': 'allow' } as Record<string, string>)}
          autoPlay
          poster={
            (title?.toLowerCase().includes('zvyozdy') ||
              title?.toLowerCase().includes('звёзд') ||
              poster?.includes('tt31712367') ||
              poster?.includes('5508530'))
              ? '/posters/zvyozdy.jpg'
              : poster
          }
          onTouchStart={(e) => {
            if (e.touches.length === 2) {
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              pinchStartDistRef.current = Math.hypot(dx, dy);
            }
          }}
          onTouchMove={(e) => {
            if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              const dist = Math.hypot(dx, dy);
              if (dist - pinchStartDistRef.current > 35) {
                pinchStartDistRef.current = null;
                setVideoFitMode('cover');
                savePreferredVideoFitMode('cover');
                showTransportToast('Ecran Plin 100% (Fără Margini)');
              } else if (pinchStartDistRef.current - dist > 35) {
                pinchStartDistRef.current = null;
                setVideoFitMode('contain');
                savePreferredVideoFitMode('contain');
                showTransportToast('Format Original 16:9');
              }
            }
          }}
          onTouchEnd={() => {
            pinchStartDistRef.current = null;
          }}
          onClick={handleStageTapToggleOsd}
          onPlay={(e) => {
            userIntentionallyPausedRef.current = false;
            lastTimeUpdateWallMsRef.current = Date.now();
            setIsPaused(false);
            if (!e.currentTarget.muted && e.currentTarget.volume > 0) {
              setIsAutoMuted(false);
            }
          }}
          onPause={(e) => {
            const vid = e.currentTarget;
            if (
              !userIntentionallyPausedRef.current &&
              isFileListStream &&
              (vid.ended || flMseReaderDoneRef.current) &&
              remainingTimeSec > 180 &&
              currentTimeSec > 5
            ) {
              resumeOrRecoverPlayback(vid, false);
              return;
            }
            setIsPaused(true);
            const effTime = streamOffsetRef.current + (vid.currentTime || 0);
            const floorCur = Math.floor(effTime);
            const dur = Math.floor(
              videoDurationSecRef.current ||
              durationHintSecRef.current ||
              2700
            );
            if (floorCur > 1) {
              onTimeUpdateRef.current?.(floorCur, dur, true);
            }
          }}
          onDurationChange={(e) => {
            if (isFileListStream) return;
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 60) {
              setVideoDurationSec(d);
            }
          }}
          onProgress={(e) => {
            if (!isOsdVisible && openMenu === 'none') return;
            const v = e.currentTarget;
            try {
              if (v.buffered && v.buffered.length > 0) {
                const nextEnd =
                  streamOffsetSec + v.buffered.end(v.buffered.length - 1);
                setBufferedEndSec((prev) =>
                  Math.abs(prev - nextEnd) < 2 ? prev : nextEnd
                );
              }
            } catch {
              // ignore
            }
          }}
          onSeeked={(e) => {
            hideFrozenFrame();
            const vid = e.currentTarget;
            const effTime = streamOffsetRef.current + (vid.currentTime || 0);
            const floorCur = Math.floor(effTime);
            const dur = Math.floor(
              videoDurationSecRef.current ||
              durationHintSecRef.current ||
              2700
            );
            if (floorCur > 1) {
              onTimeUpdateRef.current?.(floorCur, dur, true);
            }
          }}
          onResize={(e) => {
            syncVideoDims(e.currentTarget);
          }}
          onLoadedMetadata={() => {
            const targetStart = startAtSecondsRef.current;
            const v = videoRef.current;
            syncVideoDims(v);
            if (!isFileListStream && v && Number.isFinite(v.duration) && v.duration > 60) {
              setVideoDurationSec(v.duration);
            }
            if (
              !isFileListStream &&
              !appliedStartRef.current &&
              targetStart > 5 &&
              v &&
              Number.isFinite(v.duration) &&
              v.duration > 10
            ) {
              const clampedTarget = Math.min(
                targetStart,
                Math.max(0, v.duration - 5)
              );
              if (Math.abs(v.currentTime - clampedTarget) <= 15) {
                if (!v.seeking && v.readyState >= 2) {
                  appliedStartRef.current = true;
                }
              } else if (Date.now() - lastSeekAttemptMsRef.current >= (hlsRef.current ? 16000 : 2500)) {
                lastSeekAttemptMsRef.current = Date.now();
                try {
                  v.currentTime = clampedTarget;
                  hlsRef.current?.startLoad(clampedTarget);
                } catch {
                  // ignore
                }
              }
            }
          }}
          onCanPlay={(e) => {
            if (nativeHlsFallbackTimerRef.current !== null) {
              window.clearTimeout(nativeHlsFallbackTimerRef.current);
              nativeHlsFallbackTimerRef.current = null;
            }
            const targetStart = startAtSecondsRef.current;
            const v = e.currentTarget;
            syncVideoDims(v);
            if (
              !isFileListStream &&
              !appliedStartRef.current &&
              targetStart > 5 &&
              Number.isFinite(v.duration) &&
              v.duration > 10
            ) {
              const clampedTarget = Math.min(
                targetStart,
                Math.max(0, v.duration - 5)
              );
              if (Math.abs(v.currentTime - clampedTarget) <= 15) {
                if (!v.seeking && v.readyState >= 2) {
                  appliedStartRef.current = true;
                }
              } else if (Date.now() - lastSeekAttemptMsRef.current >= (hlsRef.current ? 16000 : 2500)) {
                lastSeekAttemptMsRef.current = Date.now();
                try {
                  v.currentTime = clampedTarget;
                  hlsRef.current?.startLoad(clampedTarget);
                } catch {
                  // ignore
                }
              }
            }
            if (status === 'loading') {
              ensureAutoPlay(e.currentTarget);
            }
          }}
          onPlaying={(e) => {
            hideFrozenFrame();
            if (nativeHlsFallbackTimerRef.current !== null) {
              window.clearTimeout(nativeHlsFallbackTimerRef.current);
              nativeHlsFallbackTimerRef.current = null;
            }
            const targetStart = startAtSecondsRef.current;
            const v = e.currentTarget;
            if (v.readyState >= 3) {
              hasRenderedFirstFrameRef.current = true;
            }
            lastTimeUpdateWallMsRef.current = Date.now();
            syncVideoDims(v);
            if (
              !isFileListStream &&
              !appliedStartRef.current &&
              targetStart > 5 &&
              Number.isFinite(v.duration) &&
              v.duration > 10
            ) {
              const clampedTarget = Math.min(
                targetStart,
                Math.max(0, v.duration - 5)
              );
              if (Math.abs(v.currentTime - clampedTarget) <= 15) {
                if (!v.seeking && v.readyState >= 2) {
                  appliedStartRef.current = true;
                }
              } else if (Date.now() - lastSeekAttemptMsRef.current >= (hlsRef.current ? 16000 : 2500)) {
                lastSeekAttemptMsRef.current = Date.now();
                try {
                  v.currentTime = clampedTarget;
                  hlsRef.current?.startLoad(clampedTarget);
                } catch {
                  // ignore
                }
              }
            }
            if (!v.muted && v.volume > 0) {
              setIsAutoMuted(false);
            }
            setStatus('playing');
            if (!hasInitialPlayWokenOsdRef.current) {
              hasInitialPlayWokenOsdRef.current = true;
              onWakeOsd?.();
            }
            hasInitialPlayWokenOsdRef.current = true;
            if (
              typeof window !== 'undefined' &&
              (window.location.port === '8769' ||
                window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1') &&
              (document.documentElement.classList.contains('smart-tv-mode') ||
                window.location.pathname.toLowerCase().startsWith('/tv'))
            ) {
              fetch(
                `/api/tv-log?vod=video_playing&d=${v.videoWidth || 0}x${v.videoHeight || 0}`
              ).catch(() => { });
            }
          }}
          onVolumeChange={(e) => {
            if (!e.currentTarget.muted && e.currentTarget.volume > 0) {
              setIsAutoMuted(false);
            }
          }}
          onTimeUpdate={(e) => {
            const vid = e.currentTarget as HTMLVideoElement & {
              webkitDisplayingFullscreen?: boolean;
            };
            if (
              !vid.webkitDisplayingFullscreen &&
              vid.textTracks &&
              vid.textTracks.length > 0
            ) {
              for (let i = 0; i < vid.textTracks.length; i++) {
                if (vid.textTracks[i].mode !== 'disabled') {
                  try {
                    vid.textTracks[i].mode = 'disabled';
                  } catch {
                    // ignore
                  }
                }
              }
            }
            if (!vid.muted && vid.volume > 0 && isAutoMuted) {
              setIsAutoMuted(false);
            }
            if (status === 'loading' && !vid.paused && vid.currentTime > 0.15) {
              setStatus('playing');
            }
            const targetStart = startAtSecondsRef.current;
            if (!isFileListStream && !appliedStartRef.current && targetStart > 5) {
              if (Number.isFinite(vid.duration) && vid.duration > 10) {
                const clampedTarget = Math.min(
                  targetStart,
                  Math.max(0, vid.duration - 5)
                );
                if (Math.abs(vid.currentTime - clampedTarget) <= 15) {
                  if (!vid.seeking && vid.readyState >= 2) {
                    appliedStartRef.current = true;
                  } else {
                    return;
                  }
                } else {
                  if (Date.now() - lastSeekAttemptMsRef.current >= (hlsRef.current ? 16000 : 2500)) {
                    lastSeekAttemptMsRef.current = Date.now();
                    try {
                      vid.currentTime = clampedTarget;
                      hlsRef.current?.startLoad(clampedTarget);
                    } catch {
                      // ignore
                    }
                  }
                  return;
                }
              } else if (vid.currentTime < targetStart - 15) {
                return;
              }
            }
            if (isSeekingFileListRef.current) {
              return;
            }
            const effectiveTime = streamOffsetRef.current + vid.currentTime;
            if (Math.abs(effectiveTime - lastTimeUpdateMediaSecRef.current) >= 0.15) {
              lastTimeUpdateMediaSecRef.current = effectiveTime;
              lastTimeUpdateWallMsRef.current = Date.now();
              if (vid.readyState >= 3) {
                hasRenderedFirstFrameRef.current = true;
              }
              if (!vid.paused && !vid.seeking) {
                watchedTicksInEpisodeRef.current += 1;
              }
            }
            if (!isFileListStream && Number.isFinite(vid.duration) && vid.duration > 60) {
              setVideoDurationSec(vid.duration);
            }
            if (isOsdVisible || openMenu !== 'none') {
              try {
                if (vid.buffered && vid.buffered.length > 0) {
                  const end = streamOffsetSec + vid.buffered.end(vid.buffered.length - 1);
                  setBufferedEndSec((prev) =>
                    Math.abs(prev - end) < 2 ? prev : end
                  );
                }
              } catch {
                // ignore
              }
            }
            const reportedDuration = hasVerifiedDuration
              ? Math.floor(videoDurationSec)
              : durationHintSec && durationHintSec > 60
                ? Math.floor(durationHintSec)
                : Math.max(effectiveDurationSec, Math.floor(effectiveTime) + 30);
            if (Date.now() - lastMediaSessionPosSyncMsRef.current >= 2000) {
              lastMediaSessionPosSyncMsRef.current = Date.now();
              updateMediaSessionPosition(
                'vod',
                effectiveTime,
                reportedDuration,
                vid.playbackRate || 1
              );
            }
            setCurrentTimeSec((prev) => {
              if (isOsdVisible || openMenu !== 'none' || showNextEpisodePrompt) {
                return Math.abs(prev - effectiveTime) < 0.5 ? prev : effectiveTime;
              }
              if (subtitleCues && subtitleCues.length > 0) {
                const prevSubT = prev - subOffsetSec;
                const nextSubT = effectiveTime - subOffsetSec;
                let prevText: string | null = null;
                let nextText: string | null = null;
                for (let i = 0; i < subtitleCues.length; i++) {
                  const c = subtitleCues[i];
                  if (prevText === null && prevSubT >= c.start && prevSubT <= c.end) {
                    prevText = c.text;
                  }
                  if (nextText === null && nextSubT >= c.start && nextSubT <= c.end) {
                    nextText = c.text;
                  }
                  if (prevText !== null && nextText !== null) break;
                }
                if (prevText !== nextText) {
                  return effectiveTime;
                }
              }
              return Math.abs(prev - effectiveTime) < 2.5 ? prev : effectiveTime;
            });
            const floorCur = Math.floor(effectiveTime);
            if (
              watchedTicksInEpisodeRef.current >= 4 &&
              floorCur > 1 &&
              Number.isFinite(reportedDuration) &&
              reportedDuration > 10
            ) {
              onTimeUpdate?.(
                floorCur,
                Math.floor(reportedDuration)
              );
            }
          }}
          onEnded={() => {
            if (
              isFileListStream &&
              remainingTimeSec > 180 &&
              currentTimeSec > 5 &&
              !userIntentionallyPausedRef.current &&
              videoRef.current
            ) {
              resumeOrRecoverPlayback(videoRef.current, false);
              return;
            }
            if (
              onNextEpisode &&
              !autoNextDismissed &&
              !hasTriggeredAutoNextRef.current &&
              (watchedTicksInEpisodeRef.current >= 4 || currentTimeSec >= 15)
            ) {
              hasTriggeredAutoNextRef.current = true;
              setShowNextEpisodePrompt(false);
              onNextEpisode();
            } else if (mediaType === 'movie') {
              setAutoNextDismissed(false);
              setShowNextEpisodePrompt(true);
            }
          }}
          onDoubleClick={() => {
            if (!isMobilePhone) {
              handleToggleVodFullscreen();
            }
          }}
          className={`relative z-10 w-full h-full transition-transform duration-200 ease-out ${resolvedVideoFitClass} bg-black`}
        >
          {subtitleVttUrl && hasActiveSubtitle && (
            <track
              key={subtitleVttUrl}
              kind="subtitles"
              src={subtitleVttUrl}
              srcLang="ro"
              label={subtitleLabel || 'Română'}
            />
          )}
        </video>
        {/* Seamless Freeze-Frame Canvas Overlay: Keeps the exact video frame rendering during seeking so image NEVER cuts off to black */}
        <canvas
          ref={frozenFrameCanvasRef}
          aria-hidden="true"
          className={`absolute inset-0 z-15 w-full h-full pointer-events-none transition-opacity duration-300 ${isFrozenFrameVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            } ${resolvedVideoFitClass}`}
        />
        {!isIosNativeFullscreen && (
          <style>{`
            video::-webkit-media-text-track-container,
            video::-webkit-media-text-track-display,
            video::-webkit-media-text-track-background,
            video::-webkit-media-text-track-region,
            video::-webkit-media-text-track-region-container,
            video::cue {
              display: none !important;
              opacity: 0 !important;
              visibility: hidden !important;
              color: transparent !important;
              background: transparent !important;
              font-size: 0 !important;
              line-height: 0 !important;
              max-height: 0 !important;
              pointer-events: none !important;
            }
          `}</style>
        )}

        {/* CLEAN FRAMELESS SKIP INTRO / RECAP PILL BUTTON ("Sari peste Recapitulare" / "Sari peste Intro") */}
        {isSkipIntroVisible &&
          activeSkipSegment &&
          !showNextEpisodePrompt && (
            <div
              data-vod-floating-bar="true"
              className={`absolute right-5 sm:right-8 z-40 flex items-center transition-all duration-300 ${isOsdVisible || openMenu !== 'none'
                ? 'bottom-48 sm:bottom-56'
                : 'bottom-8 sm:bottom-10'
                }`}
            >
              <button
                type="button"
                data-vod-skip-intro-btn="true"
                onClick={() => {
                  const targetSeg = activeSkipSegment;
                  setDismissedSegmentIds((prev) =>
                    prev.includes(targetSeg.id) ? prev : [...prev, targetSeg.id]
                  );
                  seekToAbsoluteSeconds(
                    targetSeg.endSec,
                    targetSeg.toastLabel
                  );
                }}
                className="relative overflow-hidden h-11 sm:h-12 px-5 sm:px-6 mr-2 rounded-full bg-zinc-400/70 hover:bg-zinc-300/85 text-zinc-950 font-extrabold text-xs sm:text-sm inline-flex items-center shadow-[0_14px_38px_rgba(0,0,0,0.88)] backdrop-blur-md ring-4 ring-[#2563eb] focus:outline-none focus:ring-4 focus:ring-[#3b82f6] scale-[1.03] focus:scale-105 transition-transform cursor-pointer"
              >
                {/* Live progress fill showing remaining Intro/Recap duration */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-0 bg-white transition-[width] duration-200 ease-linear"
                  style={{ width: `${skipIntroRemainingPct}%` }}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 left-0 h-1 bg-[#2563eb] transition-[width] duration-200 ease-linear"
                  style={{ width: `${skipIntroRemainingPct}%` }}
                />
                <SkipForward className="relative z-10 w-4 h-4 fill-current shrink-0 mr-2 text-zinc-950" />
                <span className="relative z-10 text-zinc-950">
                  {activeSkipSegment.label}
                </span>
              </button>

              <button
                type="button"
                data-vod-skip-intro-close-btn="true"
                title="Ascunde butonul"
                onClick={() => {
                  const targetSeg = activeSkipSegment;
                  setDismissedSegmentIds((prev) =>
                    prev.includes(targetSeg.id) ? prev : [...prev, targetSeg.id]
                  );
                }}
                className="h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-black/75 hover:bg-black/90 text-white/90 border border-white/25 inline-flex items-center justify-center shadow-[0_12px_32px_rgba(0,0,0,0.85)] focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

        {/* CLEAN FRAMELESS NEXT EPISODE PILL BUTTON (SERIES — TRIGGERED AT EXACT CREDITS / OUTRO START) */}
        {mediaType === 'series' &&
          onNextEpisode &&
          !autoNextDismissed &&
          showNextEpisodePrompt && (
            <div
              data-vod-floating-bar="true"
              className={`absolute right-5 sm:right-8 z-40 flex items-center transition-all duration-300 ${isOsdVisible || openMenu !== 'none'
                ? 'bottom-48 sm:bottom-56'
                : 'bottom-8 sm:bottom-10'
                }`}
            >
              <button
                type="button"
                data-vod-autonext-btn="true"
                onClick={() => {
                  hasTriggeredAutoNextRef.current = true;
                  setShowNextEpisodePrompt(false);
                  onNextEpisode();
                }}
                className="relative overflow-hidden h-11 sm:h-12 px-5 sm:px-6 mr-2 rounded-full bg-zinc-400/70 hover:bg-zinc-300/85 text-zinc-950 font-extrabold text-xs sm:text-sm inline-flex items-center shadow-[0_14px_38px_rgba(0,0,0,0.88)] backdrop-blur-md ring-4 ring-[#2563eb] focus:outline-none focus:ring-4 focus:ring-[#3b82f6] scale-[1.03] focus:scale-105 transition-transform cursor-pointer"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-0 bg-white transition-[width] duration-200 ease-linear"
                  style={{ width: `${outroProgressRemainingPct}%` }}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 left-0 h-1 bg-[#2563eb] transition-[width] duration-200 ease-linear"
                  style={{ width: `${outroProgressRemainingPct}%` }}
                />
                <SkipForward className="relative z-10 w-4 h-4 fill-current shrink-0 mr-2 text-zinc-950" />
                <span className="relative z-10 text-zinc-950">
                  Următorul Episod · {nextEpisodeLabel || `Ep. ${episode + 1}`}
                </span>
                <span className="relative z-10 ml-2 px-2 py-0.5 rounded-full bg-zinc-900/15 text-zinc-900 tabular-nums text-[11px] font-bold tabular-nums">
                  -{formatSeekTime(outroRemainingSec)}
                </span>
              </button>

              <button
                type="button"
                data-vod-skip-intro-close-btn="true"
                title="Rămâi la generic"
                onClick={() => {
                  setAutoNextDismissed(true);
                  setShowNextEpisodePrompt(false);
                }}
                className="h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-black/75 hover:bg-black/90 text-white/90 border border-white/25 inline-flex items-center justify-center shadow-[0_12px_32px_rgba(0,0,0,0.85)] focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

        {/* CLEAN FRAMELESS END OF MOVIE PILL BAR (MOVIES — TRIGGERED AT EXACT CREDITS / OUTRO START) */}
        {mediaType === 'movie' &&
          !autoNextDismissed &&
          showNextEpisodePrompt && (
            <div
              data-vod-floating-bar="true"
              className={`absolute right-5 sm:right-8 z-40 flex items-center gap-2 transition-all duration-300 ${isOsdVisible || openMenu !== 'none'
                ? 'bottom-48 sm:bottom-56'
                : 'bottom-8 sm:bottom-10'
                }`}
            >
              {apiPostCreditsStartSec !== null &&
                displayTimeSec < apiPostCreditsStartSec - 5 ? (
                <button
                  type="button"
                  data-vod-autonext-btn="true"
                  onClick={() => {
                    seekToAbsoluteSeconds(
                      apiPostCreditsStartSec,
                      'Scenă Post-Credits'
                    );
                  }}
                  className="relative overflow-hidden h-11 sm:h-12 px-5 sm:px-6 rounded-full bg-zinc-400/70 hover:bg-zinc-300/85 text-zinc-950 font-extrabold text-xs sm:text-sm inline-flex items-center shadow-[0_14px_38px_rgba(0,0,0,0.88)] backdrop-blur-md ring-4 ring-[#2563eb] focus:outline-none focus:ring-4 focus:ring-[#3b82f6] scale-[1.03] focus:scale-105 transition-transform cursor-pointer"
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-0 bg-white transition-[width] duration-200 ease-linear"
                    style={{ width: `${outroProgressRemainingPct}%` }}
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-0 left-0 h-1 bg-[#2563eb] transition-[width] duration-200 ease-linear"
                    style={{ width: `${outroProgressRemainingPct}%` }}
                  />
                  <SkipForward className="relative z-10 w-4 h-4 fill-current shrink-0 mr-2 text-zinc-950" />
                  <span className="relative z-10 text-zinc-950">
                    Sari la Scena Post-Credits
                  </span>
                </button>
              ) : null}

              {onClosePlayer && (
                <button
                  type="button"
                  data-vod-autonext-btn={
                    apiPostCreditsStartSec !== null &&
                      displayTimeSec < apiPostCreditsStartSec - 5
                      ? undefined
                      : 'true'
                  }
                  onClick={() => {
                    setShowNextEpisodePrompt(false);
                    onClosePlayer();
                  }}
                  className="relative overflow-hidden min-h-[44px] h-11 sm:h-12 px-5 sm:px-6 rounded-full bg-zinc-400/70 hover:bg-zinc-300/85 text-zinc-950 font-extrabold text-xs sm:text-sm inline-flex items-center shadow-[0_14px_38px_rgba(0,0,0,0.88)] backdrop-blur-md ring-4 ring-[#2563eb] focus:outline-none focus:ring-4 focus:ring-[#3b82f6] scale-[1.03] focus:scale-105 transition-transform cursor-pointer touch-manipulation"
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-0 bg-white transition-[width] duration-200 ease-linear"
                    style={{ width: `${outroProgressRemainingPct}%` }}
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-0 left-0 h-1 bg-[#2563eb] transition-[width] duration-200 ease-linear"
                    style={{ width: `${outroProgressRemainingPct}%` }}
                  />
                  <span className="relative z-10 text-zinc-950">
                    Închide Filmul · Înapoi la Detalii
                  </span>
                  <span className="relative z-10 ml-2 px-2 py-0.5 rounded-full bg-zinc-900/15 text-zinc-900 tabular-nums text-[11px] font-bold tabular-nums">
                    -{formatSeekTime(outroRemainingSec)}
                  </span>
                </button>
              )}

              <button
                type="button"
                title="Reia filmul de la început"
                onClick={() => {
                  setShowNextEpisodePrompt(false);
                  hasAutoFocusedNextEpRef.current = false;
                  seekToAbsoluteSeconds(0, 'De la început');
                }}
                className="h-11 sm:h-12 px-4 sm:px-5 rounded-full bg-black/80 hover:bg-black/95 text-white font-extrabold text-xs sm:text-sm border border-white/25 inline-flex items-center shadow-[0_12px_32px_rgba(0,0,0,0.85)] focus:outline-none focus:bg-white focus:text-zinc-950 focus:ring-4 focus:ring-[#3b82f6] cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 shrink-0 mr-1.5" />
                <span>De la început</span>
              </button>

              <button
                type="button"
                data-vod-skip-intro-close-btn="true"
                title="Rămâi la generic"
                onClick={() => {
                  setAutoNextDismissed(true);
                  setShowNextEpisodePrompt(false);
                }}
                className="h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-black/75 hover:bg-black/90 text-white/90 border border-white/25 inline-flex items-center justify-center shadow-[0_12px_32px_rgba(0,0,0,0.85)] focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

        {/* APPLE TV+ / tvOS 26 LIQUID GLASS SEEK HUD CAPSULE */}
        {seekHudData ? (
          <div
            data-vod-seek-hud="true"
            className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center animate-in fade-in zoom-in-95 duration-150 transition-all"
          >
            <div className="relative overflow-hidden w-auto min-w-[240px] max-w-[90vw] sm:max-w-md px-5 sm:px-6 py-2.5 sm:py-3 rounded-[26px] apple-vod-liquid-dock flex flex-col gap-2 text-center">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent"
              />
              {/* Row 1: Apple SF Seek Icon + Frosted Delta Capsule + SF Tabular Timestamp */}
              <div className="relative z-10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  {isSeekBuffering ? (
                    <Loader2
                      className="w-4 h-4 text-white/95 animate-spin shrink-0"
                      strokeWidth={2.2}
                      aria-hidden="true"
                    />
                  ) : seekHudData.direction === 'rew' ? (
                    <RotateCcw
                      className="w-4 h-4 text-white/95 shrink-0"
                      strokeWidth={2.2}
                      aria-hidden="true"
                    />
                  ) : (
                    <RotateCw
                      className="w-4 h-4 text-white/95 shrink-0"
                      strokeWidth={2.2}
                      aria-hidden="true"
                    />
                  )}
                  <span className="px-2.5 py-0.5 rounded-full apple-vod-liquid-badge text-white text-[11px] sm:text-xs font-semibold tracking-[-0.01em] tabular-nums">
                    {seekHudData.deltaLabel}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs sm:text-[13.5px] font-semibold text-white tabular-nums tracking-[-0.01em]">
                  <span>{seekHudData.targetTimeStr}</span>
                  <span className="text-white/35 font-normal">/</span>
                  <span className="text-white/60 font-normal">{seekHudData.totalTimeStr}</span>
                  <span className="ml-0.5 px-2 py-0.5 rounded-full apple-vod-liquid-badge text-[10.5px] font-medium text-white/85 tabular-nums">
                    {seekHudData.remainingTimeStr}
                  </span>
                </div>
              </div>

              {/* Row 2: Luminous Apple White Liquid Glass Progress Bar */}
              <div className="relative z-10 w-full h-1.5 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.75)] transition-all duration-150"
                  style={{ width: `${Math.max(2, seekHudData.percent)}%` }}
                />
              </div>
            </div>
          </div>
        ) : isSeekBuffering ? (
          <div
            data-vod-seek-hud="true"
            className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center animate-in fade-in duration-150"
          >
            <div className="w-12 h-12 rounded-full apple-vod-liquid-dock flex items-center justify-center">
              <Loader2
                className="w-5 h-5 text-white/95 animate-spin"
                strokeWidth={2.2}
                aria-hidden="true"
              />
            </div>
          </div>
        ) : null}

        {/* Generic Transport Toast (Redare / Pauză / Format Video / Audio Track) — Apple Liquid Glass */}
        {!seekHudData && !isSeekBuffering && seekToast && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <div className="px-5 py-2.5 rounded-full apple-vod-liquid-dock text-white text-base sm:text-lg font-semibold tracking-[-0.015em] flex items-center gap-2.5">
              {seekToast.includes('Redare') ? (
                <Play className="w-5 h-5 text-white fill-current shrink-0" />
              ) : seekToast.includes('Pauză') ? (
                <Pause className="w-5 h-5 text-white fill-current shrink-0" />
              ) : null}
              <span>{seekToast.replace(/^[▶️⏸️⏩⏪⏭️⏮️\s]+/, '')}</span>
            </div>
          </div>
        )}

        {/* Custom High-Contrast Lampa Cinema Subtitle Overlay */}
        {activeSubtitleText && (
          <div
            className={`pointer-events-none absolute inset-x-4 z-20 flex justify-center transition-all duration-300 ${isMobilePhone
              ? isOsdVisible || openMenu !== 'none'
                ? 'bottom-24'
                : 'bottom-3'
              : isOsdVisible || openMenu !== 'none'
                ? 'bottom-60 sm:bottom-64'
                : 'bottom-14 sm:bottom-16'
              }`}
          >
            <div
              className={`${isMobilePhone
                ? 'max-w-[88%] px-2.5 py-0.5 rounded-lg bg-black/65 font-semibold'
                : `max-w-4xl rounded-2xl bg-black/80 font-extrabold ${subFontClass}`
                } text-white text-center leading-snug whitespace-pre-line shadow-2xl border border-white/10`}
              style={{
                fontSize: `${subFontPx}px`,
                textShadow:
                  '0 2px 4px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.95)',
              }}
            >
              {activeSubtitleText}
            </div>
          </div>
        )}

        {/* Unmute pill ONLY when browser genuinely forced muted autoplay and video is still muted */}
        {isAutoMuted &&
          status === 'playing' &&
          Boolean(videoRef.current?.muted) && (
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
              className={
                isMobilePhone
                  ? 'absolute top-2 right-3 z-30 h-8 px-3 rounded-full apple-vod-liquid-dock text-white text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all active:scale-95'
                  : 'absolute top-5 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full apple-vod-liquid-dock text-white/95 hover:text-white text-xs sm:text-[13px] font-semibold tracking-[-0.01em] inline-flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-95'
              }
            >
              <VolumeX className="w-3.5 h-3.5 shrink-0" />
              <span>
                {isMobilePhone
                  ? 'Apasă pentru Sunet'
                  : 'Sunet oprit de browser — Apasă pentru Sunet'}
              </span>
            </button>
          )}

        {status === 'loading' && !hasRenderedFirstFrameRef.current && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-2 bg-black/60">
            <Loader2 className="w-9 h-9 text-zinc-300 animate-spin" />
            <span className="text-xs sm:text-sm font-bold text-zinc-200">
              {offlineItem
                ? 'Se încarcă filmul din memoria Offline a dispozitivului...'
                : 'Pornire automată stream HD (Fără reclame)...'}
            </span>
          </div>
        )}
        {status === 'loading' && !hasRenderedFirstFrameRef.current && <FilmioStartupLoader />}
        {status === 'loading' && hasRenderedFirstFrameRef.current && !seekHudData && !isSeekBuffering && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full apple-vod-liquid-dock flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-white animate-spin" aria-hidden="true" />
            </div>
          </div>
        )}

        {status === 'error' && <FilmioStartupLoader />}

        {/* PORTRAIT MOBILE TOP-RIGHT UTILITY PILL (AirPlay — hidden on real Smart TVs) */}
        {isNarrowPortraitMobile && !isRealHardwareTv && (
          <div
            data-vod-portrait-topright-tools="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              top: 'max(8px, calc(var(--safe-top, env(safe-area-inset-top, 0px)) + 6px))',
              right:
                'max(10px, var(--safe-right, env(safe-area-inset-right, 0px)))',
            }}
            className={`absolute z-30 flex items-center gap-1.5 transition-all duration-300 ${(isOsdVisible && status !== 'loading') || openMenu !== 'none'
              ? 'opacity-100 translate-y-0 pointer-events-auto visible'
              : 'opacity-0 -translate-y-2 pointer-events-none invisible'
              }`}
          >
            <button
              type="button"
              data-vod-airplay-btn="true"
              onClick={handleTriggerAirPlay}
              title="AirPlay / Redare pe TV"
              aria-label="AirPlay / Redare pe TV"
              className="h-9 w-9 rounded-full apple-vod-liquid-pill text-white inline-flex items-center justify-center shrink-0 shadow-md cursor-pointer"
            >
              <SfAirPlayIcon className="w-4 h-4 shrink-0" />
            </button>
          </div>
        )}

        {/* APPLE TV+ / tvOS 26 LIQUID GLASS FLOATING BOTTOM DOCK */}
        <div
          data-vod-bottom-dock="true"
          onClick={(e) => e.stopPropagation()}
          style={
            isMobilePhone
              ? isCustomFullscreen && !isLandscapeMobile
                ? {
                  bottom: '12px',
                  left: 'max(52px, calc(var(--safe-top, env(safe-area-inset-top, 0px)) + 12px))',
                  right:
                    'max(28px, calc(var(--safe-bottom, env(safe-area-inset-bottom, 0px)) + 12px))',
                }
                : isLandscapeMobile
                  ? {
                    bottom:
                      'max(10px, var(--safe-bottom, env(safe-area-inset-bottom, 0px)))',
                    left: 'max(18px, var(--safe-left, env(safe-area-inset-left, 0px)))',
                    right:
                      'max(18px, var(--safe-right, env(safe-area-inset-right, 0px)))',
                  }
                  : {
                    bottom:
                      'max(8px, var(--safe-bottom, env(safe-area-inset-bottom, 0px)))',
                    left: 'max(10px, var(--safe-left, env(safe-area-inset-left, 0px)))',
                    right:
                      'max(10px, var(--safe-right, env(safe-area-inset-right, 0px)))',
                  }
              : isIpadTablet
                ? {
                  bottom:
                    'max(22px, calc(var(--safe-bottom, env(safe-area-inset-bottom, 0px)) + 12px))',
                  left: 'max(16px, var(--safe-left, env(safe-area-inset-left, 0px)))',
                  right:
                    'max(16px, var(--safe-right, env(safe-area-inset-right, 0px)))',
                }
                : undefined
          }
          className={`absolute ${isMobilePhone
            ? 'inset-x-2.5 rounded-[22px] px-3 py-2 gap-1.5'
            : isIpadTablet
              ? 'inset-x-4 rounded-[26px] px-4 py-3 gap-2.5'
              : 'inset-x-2 sm:inset-x-8 bottom-2 sm:bottom-6 rounded-[26px] sm:rounded-[32px] px-3.5 sm:px-6 py-2.5 sm:py-4 gap-2 sm:gap-3.5'
            } z-30 overflow-visible apple-vod-liquid-dock flex flex-col transition-all duration-300 ${(isOsdVisible && status !== 'loading') || openMenu !== 'none'
              ? 'opacity-100 translate-y-0 pointer-events-auto visible'
              : 'opacity-0 translate-y-2 pointer-events-none invisible'
            }`}
        >
          {/* Apple Liquid Glass Specular Refraction Sheen Layer (clipped cleanly without hiding pop-out poster) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden"
          >
            <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" />
            <div className="absolute -top-24 inset-x-10 h-32 rounded-full bg-white/[0.08] blur-2xl" />
          </div>

          {/* ROW 1: POSTER & TITLE + APPLE LIQUID GLASS TIMELINE SCRUBBER */}
          <div
            className={`relative z-10 w-full flex items-center ${isMobilePhone ? 'gap-2 mb-0' : isIpadTablet ? 'gap-2.5 mb-1.5' : 'gap-2 sm:gap-5 mb-0.5 sm:mb-3.5'
              }`}
          >
            {/* Clean Apple TV+ Large Pop-Out Poster & Title + Episode Name (Desktop, iPad & Smart TV) */}
            {!isMobilePhone && (poster || title) && (
              <div
                className={`hidden sm:flex items-center overflow-visible ${isIpadTablet
                  ? 'gap-3 pr-3 mr-1 shrink min-w-0 max-w-[280px] lg:max-w-[360px]'
                  : 'gap-4 pr-6 mr-2 shrink-0 max-w-[540px]'
                  }`}
              >
                {poster ? (
                  <div
                    onClick={
                      onOpenInfoSheet
                        ? () => {
                          onWakeOsd?.();
                          setOpenMenu('none');
                          onOpenInfoSheet();
                        }
                        : undefined
                    }
                    title={onOpenInfoSheet ? 'Descriere & Detalii (Săgeată Sus)' : undefined}
                    className={`relative ${isIpadTablet
                      ? 'w-16 h-24 lg:w-20 lg:h-28 -mt-10 lg:-mt-12 mr-2.5 mb-0.5 rounded-[14px]'
                      : 'w-20 h-28 sm:w-24 sm:h-36 -mt-12 sm:-mt-16 mr-4 sm:mr-5 mb-1 rounded-[18px]'
                      } overflow-hidden border border-white/30 ring-1 ring-white/20 shadow-[0_24px_56px_rgba(0,0,0,0.72),0_4px_14px_rgba(0,0,0,0.45)] shrink-0 bg-zinc-900 ${onOpenInfoSheet ? 'cursor-pointer hover:scale-[1.03] transition-transform' : ''
                      }`}
                  >
                    <img
                      src={
                        (title?.toLowerCase().includes('zvyozdy') ||
                          title?.toLowerCase().includes('звёзд') ||
                          poster?.includes('tt31712367') ||
                          poster?.includes('5508530'))
                          ? '/posters/zvyozdy.jpg'
                          : poster
                      }
                      alt={title || ''}
                      onError={(e) => {
                        const target = e.currentTarget;
                        const zvyozdyCdn = 'https://avatars.mds.yandex.net/get-kinopoisk-image/4486454/c06e5be9-ca78-479e-bfae-0f24e43bb452/360';
                        const isZv = title?.toLowerCase().includes('zvyozdy') || title?.toLowerCase().includes('звёзд') || poster?.includes('tt31712367') || poster?.includes('5508530');
                        if (isZv) {
                          if (!target.src.includes('avatars.mds.yandex.net')) {
                            target.src = zvyozdyCdn;
                            return;
                          } else if (!target.src.includes('/posters/zvyozdy.jpg')) {
                            target.src = '/posters/zvyozdy.jpg';
                            return;
                          }
                        }
                        if (
                          backdropUrl &&
                          target.src !== backdropUrl &&
                          !backdropUrl.includes('tt31712367') &&
                          !backdropUrl.includes('5508530')
                        ) {
                          target.src = backdropUrl;
                        } else if (!target.src.includes('/posters/zvyozdy.jpg')) {
                          target.src = '/posters/zvyozdy.jpg';
                        }
                      }}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex flex-col justify-center gap-1 py-1">
                  <div
                    className={`${isIpadTablet
                      ? 'text-base lg:text-xl'
                      : 'text-xl sm:text-2xl md:text-[28px]'
                      } font-bold text-white truncate leading-tight tracking-[-0.025em] drop-shadow-[0_1px_12px_rgba(0,0,0,0.4)] mb-0.5`}
                  >
                    {title || 'În redare'}
                  </div>
                  <div
                    onClick={
                      mediaType === 'series' && onOpenEpisodesDrawer
                        ? () => {
                          onWakeOsd?.();
                          setOpenMenu('none');
                          onOpenEpisodesDrawer();
                        }
                        : undefined
                    }
                    title={
                      mediaType === 'series' && onOpenEpisodesDrawer
                        ? 'Apasă sau Săgeată Jos pentru Episoade'
                        : undefined
                    }
                    className={`flex items-center gap-1.5 min-w-0 ${isIpadTablet
                      ? 'text-xs lg:text-[13px]'
                      : 'text-sm sm:text-[15px]'
                      } font-medium text-white/90 tracking-[-0.01em] ${mediaType === 'series' && onOpenEpisodesDrawer
                      ? 'cursor-pointer hover:text-white transition-colors'
                      : ''
                      }`}
                  >
                    {mediaType === 'series' && (
                      <>
                        <span className="text-white font-semibold shrink-0 mr-1.5">
                          S{season} · E{episode}
                        </span>
                        <span className="text-white/40 mr-1.5">•</span>
                      </>
                    )}
                    <span className="truncate text-white/80">
                      {subtitle ||
                        (mediaType === 'series'
                          ? `Episodul ${episode}`
                          : 'Cinema 4K')}
                    </span>
                    <span className="px-2 py-0.5 rounded-full apple-vod-liquid-badge text-[10.5px] font-semibold text-white/95 tracking-[0.02em] shrink-0">
                      {resolutionReport.badgeLabel}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Elapsed Time (Clean SF Tabular Nums, No Box) */}
            <span className="text-[11px] sm:text-xs font-medium text-white/80 tabular-nums shrink-0 w-10 sm:w-12 text-right mr-1.5 sm:mr-3">
              {formatSeekTime(
                scrubPreviewSec !== null ? scrubPreviewSec : displayTimeSec
              )}
            </span>

            {/* Apple macOS Tahoe / Apple TV+ Liquid Glass Timeline Scrubber (Click + Smooth Drag) */}
            <button
              type="button"
              data-vod-timeline-slider="true"
              aria-label="Derulare video (Săgeți Stânga/Dreapta -15s / +15s)"
              onFocus={() => onWakeOsd?.()}
              onPointerDown={(e) => {
                onWakeOsd?.();
                const el = e.currentTarget;
                el.setPointerCapture?.(e.pointerId);
                const rect = el.getBoundingClientRect();
                const isRotated90 = rect.height > rect.width;
                const span = isRotated90 ? rect.height : rect.width;
                if (span > 0) {
                  const pos = isRotated90
                    ? e.clientY - rect.top
                    : e.clientX - rect.left;
                  const ratio = Math.min(1, Math.max(0, pos / span));
                  setScrubPreviewSec(Math.floor(ratio * effectiveDurationSec));
                }
              }}
              onPointerMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const isRotated90 = rect.height > rect.width;
                const span = isRotated90 ? rect.height : rect.width;
                if (span <= 0) return;
                const pos = isRotated90
                  ? e.clientY - rect.top
                  : e.clientX - rect.left;
                const ratio = Math.min(1, Math.max(0, pos / span));
                const targetSec = Math.floor(ratio * effectiveDurationSec);
                if (e.buttons === 1 || e.currentTarget.hasPointerCapture?.(e.pointerId)) {
                  setScrubPreviewSec(targetSec);
                  // Live visual frame scrubbing when dragging slider (HLS/MP4/Offline or within FileList RAM buffer)
                  const nowMs = Date.now();
                  const vid = videoRef.current;
                  if (vid && nowMs - lastLiveScrubMsRef.current >= 110) {
                    const isServerStream = Boolean(
                      hlsUrl &&
                        (hlsUrl.includes('/api/filelist/stream') ||
                          hlsUrl.includes('/api/youtube/stream'))
                    );
                    if (!isServerStream) {
                      lastLiveScrubMsRef.current = nowMs;
                      try {
                        vid.currentTime = targetSec;
                      } catch {
                        // ignore
                      }
                    } else if (!isSeekingFileListRef.current) {
                      const bCheck = isTargetInsideVideoBuffer(vid, targetSec);
                      if (bCheck.inBuffer) {
                        lastLiveScrubMsRef.current = nowMs;
                        try {
                          vid.currentTime = bCheck.relSec;
                        } catch {
                          // ignore
                        }
                      }
                    }
                  }
                }
                setHoverPreview({
                  sec: targetSec,
                  pct: ratio * 100,
                });
              }}
              onPointerUp={(e) => {
                const el = e.currentTarget;
                if (el.hasPointerCapture?.(e.pointerId)) {
                  el.releasePointerCapture(e.pointerId);
                }
                const rect = el.getBoundingClientRect();
                const isRotated90 = rect.height > rect.width;
                const span = isRotated90 ? rect.height : rect.width;
                if (span > 0) {
                  const pos = isRotated90
                    ? e.clientY - rect.top
                    : e.clientX - rect.left;
                  const ratio = Math.min(1, Math.max(0, pos / span));
                  seekToAbsoluteSeconds(
                    Math.floor(ratio * effectiveDurationSec)
                  );
                }
                if (e.pointerType === 'touch') {
                  setHoverPreview(null);
                }
              }}
              onMouseLeave={() => setHoverPreview(null)}
              onClick={(e) => {
                // Keyboard Enter/OK fallback when clientX === 0
                if (e.clientX === 0) {
                  triggerSeek(15);
                }
              }}
              className={`relative flex-1 ${isMobilePhone ? 'h-5' : 'h-7'
                } flex items-center group cursor-pointer bg-transparent focus:outline-none`}
            >
              {/* Floating Liquid Glass Scrub Preview Bubble */}
              {(hoverPreview !== null || scrubPreviewSec !== null) && (
                <div
                  style={{
                    left: `${scrubPreviewSec !== null
                      ? (scrubPreviewSec / Math.max(1, effectiveDurationSec)) * 100
                      : hoverPreview?.pct ?? progressPct
                      }%`,
                  }}
                  className="pointer-events-none absolute -top-9 -translate-x-1/2 px-3 py-1 rounded-full apple-vod-liquid-bubble text-white text-xs font-semibold tabular-nums whitespace-nowrap z-40"
                >
                  {formatSeekTime(
                    scrubPreviewSec !== null
                      ? scrubPreviewSec
                      : hoverPreview?.sec ?? displayTimeSec
                  )}
                </div>
              )}

              {/* Slim Apple Liquid Glass Track (expands smoothly on hover/focus) */}
              <div className="relative w-full h-1.5 group-hover:h-2 group-focus:h-2.5 rounded-full bg-white/35 ring-1 ring-white/15 overflow-hidden transition-all duration-200 group-focus:ring-4 group-focus:ring-[#60a5fa]">
                {/* Buffered Range */}
                <div
                  style={{ width: `${bufferedPct}%` }}
                  className="absolute inset-y-0 left-0 bg-white/55 rounded-full transition-all"
                />
                {/* Recap & Intro Segment Highlights on Timeline Track */}
                {effectiveDurationSec > 60 &&
                  detectedSkipSegments.map((seg) => {
                    const leftPct = Math.min(
                      100,
                      Math.max(0, (seg.startSec / effectiveDurationSec) * 100)
                    );
                    const widthPct = Math.min(
                      100 - leftPct,
                      Math.max(
                        0.4,
                        ((seg.endSec - seg.startSec) / effectiveDurationSec) *
                        100
                      )
                    );
                    return (
                      <div
                        key={seg.id}
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        className="pointer-events-none absolute inset-y-0 bg-[#0A84FF]/85 rounded-full z-10"
                      />
                    );
                  })}
                {/* Luminous White Progress Fill */}
                <div
                  style={{
                    width: `${scrubPreviewSec !== null
                      ? Math.min(
                        100,
                        Math.max(
                          0,
                          (scrubPreviewSec /
                            Math.max(1, effectiveDurationSec)) *
                          100
                        )
                      )
                      : progressPct
                      }%`,
                  }}
                  className="absolute inset-y-0 left-0 bg-white rounded-full shadow-[0_0_14px_rgba(255,255,255,0.72)]"
                />
              </div>

              {/* Refined Apple Playhead Thumb */}
              <div
                style={{
                  left: `calc(${scrubPreviewSec !== null
                    ? Math.min(
                      100,
                      Math.max(
                        0,
                        (scrubPreviewSec /
                          Math.max(1, effectiveDurationSec)) *
                        100
                      )
                    )
                    : progressPct
                    }% - 7px)`,
                }}
                className="pointer-events-none absolute w-3.5 h-3.5 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.48),0_0_0_1px_rgba(255,255,255,0.45)] scale-95 group-hover:scale-125 group-focus:scale-150 group-focus:ring-4 group-focus:ring-[#60a5fa] transition-transform duration-150"
              />
            </button>

            {/* Remaining Time (Clean SF Tabular Nums, No Box) */}
            <span
              className="text-[11px] sm:text-xs font-medium text-white/75 tabular-nums shrink-0 w-12 sm:w-14 ml-1.5 sm:ml-3"
              title={`Durată totală: ${formatSeekTime(effectiveDurationSec)}`}
            >
              -{formatSeekTime(remainingTimeSec)}
            </span>

            {/* Active Resolution Badge in Timeline Row */}
            {!isMobilePhone && (
              <div
                title="Rezoluție video activă"
                className="hidden sm:inline-flex px-2.5 py-1 rounded-full apple-vod-liquid-badge text-white/95 text-[11px] font-semibold tracking-[0.02em] shrink-0 items-center"
              >
                <span>
                  {activeQuality === -1 && qualityLevels.length > 1
                    ? `Auto · ${resolutionReport.badgeLabel}`
                    : resolutionReport.badgeLabel}
                </span>
              </div>
            )}

            {/* Subtle Torrent Speed Pill (Styled Vector Icon — Zero Emojis) */}
            {torrentLiveStats && (
              <div
                title={`Sursă Torrent: ${torrentLiveStats.source}`}
                className="hidden lg:inline-flex px-2.5 py-1 rounded-full apple-vod-liquid-badge text-white/90 text-[11px] font-medium tabular-nums shrink-0 items-center gap-1.5"
              >
                <ArrowDown
                  className="w-3 h-3 text-white/80 shrink-0 stroke-[2.2]"
                  aria-hidden="true"
                />
                <span>{torrentLiveStats.downloadSpeedText}</span>
              </div>
            )}
          </div>

          {/* ROW 2: APPLE LIQUID GLASS TRANSPORT CONTROLS (LEFT) + AUDIO / SERVER / SUBTITLES / QUALITY (RIGHT) — STRICTLY 1 SINGLE ROW */}
          <div
            data-vod-bottom-row="true"
            className={`relative z-10 w-full flex items-center justify-between flex-nowrap ${isMobilePhone ? 'gap-2' : isIpadTablet ? 'gap-1.5' : 'gap-2 lg:gap-2.5'
              }`}
          >
            {/* Left Transport & Episode Controls */}
            <div
              className={`flex items-center flex-nowrap shrink-0 ${isMobilePhone ? 'gap-2.5 sm:gap-3' : isIpadTablet ? 'gap-1.5' : 'gap-2 lg:gap-2.5'
                }`}
            >
              <button
                type="button"
                data-vod-play-btn="true"
                onFocus={() => onWakeOsd?.()}
                onClick={() => {
                  handleRemotePlayPause('toggle');
                }}
                className={`${isMobilePhone
                  ? 'h-10 w-10 sm:h-11 sm:w-11 justify-center'
                  : isIpadTablet
                    ? 'h-9 w-9 lg:w-auto lg:px-3.5 justify-center'
                    : 'h-9 w-9 sm:h-10 sm:w-auto sm:px-4 justify-center sm:justify-start'
                  } rounded-full apple-vod-liquid-pill-primary active:scale-95 text-white text-xs sm:text-[13px] font-semibold tracking-[-0.01em] inline-flex items-center gap-1.5 focus:outline-none focus:bg-white focus:text-zinc-950 shrink-0 whitespace-nowrap cursor-pointer touch-manipulation`}
              >
                {isPaused ? (
                  <Play className={`${isMobilePhone ? 'w-4 h-4 sm:w-[18px] sm:h-[18px] ml-0.5' : 'w-3.5 h-3.5'} fill-current shrink-0`} />
                ) : (
                  <Pause className={`${isMobilePhone ? 'w-4 h-4 sm:w-[18px] sm:h-[18px]' : 'w-3.5 h-3.5'} fill-current shrink-0`} />
                )}
                {!isMobilePhone && (
                  <span className="hidden lg:inline">
                    {isPaused ? 'Redare' : 'Pauză'}
                  </span>
                )}
              </button>

              <button
                type="button"
                data-vod-seek-back-15="true"
                onFocus={() => onWakeOsd?.()}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  hasHandledPointerSeekRef.current = true;
                  startSmartSeekHold(-1);
                }}
                onPointerUp={() => {
                  stopSmartSeekHold();
                  window.setTimeout(() => {
                    hasHandledPointerSeekRef.current = false;
                  }, 250);
                }}
                onPointerLeave={() => {
                  stopSmartSeekHold();
                  window.setTimeout(() => {
                    hasHandledPointerSeekRef.current = false;
                  }, 250);
                }}
                onPointerCancel={() => {
                  stopSmartSeekHold();
                  window.setTimeout(() => {
                    hasHandledPointerSeekRef.current = false;
                  }, 250);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!e.repeat) startSmartSeekHold(-1);
                  }
                }}
                onKeyUp={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    stopSmartSeekHold();
                  }
                }}
                onClick={(e) => {
                  e.preventDefault();
                  if (hasHandledPointerSeekRef.current) return;
                  handleSingleSeekTap(-1);
                }}
                title="Înapoi (Smart Seek: 15s -> 15s -> 30s -> 1 min)"
                aria-label="Înapoi cu 15 secunde"
                className={`${isMobilePhone
                  ? 'h-10 sm:h-11 px-3 sm:px-3.5 text-xs sm:text-[13px] gap-1.5'
                  : 'h-9 sm:h-10 px-2.5 sm:px-3.5 text-xs gap-1'
                  } rounded-full apple-vod-liquid-pill active:scale-95 text-white/95 font-semibold tracking-[-0.01em] inline-flex items-center transition-all focus:outline-none focus:bg-white focus:text-zinc-950 shrink-0 whitespace-nowrap cursor-pointer select-none touch-manipulation`}
              >
                <RotateCcw className={`${isMobilePhone ? 'w-4 h-4' : 'w-3.5 h-3.5'} shrink-0`} aria-hidden="true" />
                <span>15s</span>
              </button>

              <button
                type="button"
                data-vod-seek-fwd-15="true"
                onFocus={() => onWakeOsd?.()}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  hasHandledPointerSeekRef.current = true;
                  startSmartSeekHold(1);
                }}
                onPointerUp={() => {
                  stopSmartSeekHold();
                  window.setTimeout(() => {
                    hasHandledPointerSeekRef.current = false;
                  }, 250);
                }}
                onPointerLeave={() => {
                  stopSmartSeekHold();
                  window.setTimeout(() => {
                    hasHandledPointerSeekRef.current = false;
                  }, 250);
                }}
                onPointerCancel={() => {
                  stopSmartSeekHold();
                  window.setTimeout(() => {
                    hasHandledPointerSeekRef.current = false;
                  }, 250);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!e.repeat) startSmartSeekHold(1);
                  }
                }}
                onKeyUp={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    stopSmartSeekHold();
                  }
                }}
                onClick={(e) => {
                  e.preventDefault();
                  if (hasHandledPointerSeekRef.current) return;
                  handleSingleSeekTap(1);
                }}
                title="Înainte (Smart Seek: 15s -> 15s -> 30s -> 1 min)"
                aria-label="Înainte cu 15 secunde"
                className={`${isMobilePhone
                  ? 'h-10 sm:h-11 px-3 sm:px-3.5 text-xs sm:text-[13px] gap-1.5'
                  : 'h-9 sm:h-10 px-2.5 sm:px-3.5 text-xs gap-1'
                  } rounded-full apple-vod-liquid-pill active:scale-95 text-white/95 font-semibold tracking-[-0.01em] inline-flex items-center transition-all focus:outline-none focus:bg-white focus:text-zinc-950 shrink-0 whitespace-nowrap cursor-pointer select-none touch-manipulation`}
              >
                <RotateCw className={`${isMobilePhone ? 'w-4 h-4' : 'w-3.5 h-3.5'} shrink-0`} aria-hidden="true" />
                <span>{isNarrowPortraitMobile ? '15s' : '+15s'}</span>
              </button>

              {!isMobilePhone && (
                <button
                  type="button"
                  data-vod-seek-fwd-60="true"
                  onFocus={() => onWakeOsd?.()}
                  onClick={() => triggerSeek(60)}
                  title="Înainte cu 1 minut (+1 min)"
                  className={`hidden sm:inline-flex ${isIpadTablet ? 'h-9 px-2.5' : 'h-9 sm:h-10 px-3.5'} rounded-full apple-vod-liquid-pill active:scale-95 text-white/95 text-xs font-medium tracking-[-0.01em] items-center gap-1 transition-all focus:outline-none focus:bg-white focus:text-zinc-950 shrink-0 whitespace-nowrap cursor-pointer`}
                >
                  <RotateCw className="w-3.5 h-3.5 shrink-0" />
                  <span>+1 min</span>
                </button>
              )}

              {!isMobilePhone && onPrevEpisode && (
                <button
                  type="button"
                  data-vod-prev-ep-btn="true"
                  onFocus={() => onWakeOsd?.()}
                  onClick={() => {
                    onWakeOsd?.();
                    onPrevEpisode();
                  }}
                  title="Episodul precedent"
                  className={`hidden sm:inline-flex ${isIpadTablet ? 'h-9 px-2.5' : 'h-9 sm:h-10 px-3.5'} rounded-full apple-vod-liquid-pill active:scale-95 text-white/95 text-xs font-medium tracking-[-0.01em] items-center gap-1 transition-all focus:outline-none focus:bg-white focus:text-zinc-950 shrink-0 whitespace-nowrap cursor-pointer`}
                >
                  <SkipBack className="w-3.5 h-3.5 shrink-0" />
                  <span className={isIpadTablet ? 'hidden xl:inline' : 'hidden lg:inline'}>{prevEpisodeLabel || 'Ep. Prec.'}</span>
                </button>
              )}

              {!isMobilePhone && onNextEpisode && (
                <button
                  type="button"
                  data-vod-next-ep-btn="true"
                  onFocus={() => onWakeOsd?.()}
                  onClick={() => {
                    onWakeOsd?.();
                    onNextEpisode();
                  }}
                  title="Episodul următor"
                  className={`hidden sm:inline-flex ${isIpadTablet ? 'h-9 px-2.5' : 'h-9 sm:h-10 px-3.5'} rounded-full apple-vod-liquid-pill active:scale-95 text-white/95 text-xs font-medium tracking-[-0.01em] items-center gap-1 transition-all focus:outline-none focus:bg-white focus:text-zinc-950 shrink-0 whitespace-nowrap cursor-pointer`}
                >
                  <span className={isIpadTablet ? 'hidden xl:inline' : 'hidden lg:inline'}>{nextEpisodeLabel || 'Ep. Urm.'}</span>
                  <SkipForward className="w-3.5 h-3.5 shrink-0" />
                </button>
              )}
            </div>

            {/* Right Apple Liquid Glass Controls (Roșu: Sursă Video, Verde: Subtitrări, Galben: Descriere, Albastru: Audio + AirPlay) */}
            <div
              className={`flex items-center justify-end flex-nowrap shrink-0 ${isMobilePhone ? 'gap-1' : 'gap-1.5 lg:gap-2'
                }`}
            >
              {/* 1. Red Remote Button: Sursă & Calitate Video (Apple SF Symbol — video.fill) */}
              <div className="relative">
                <button
                  ref={qualityBtnRef}
                  type="button"
                  data-vod-primary-quality-btn="true"
                  data-vod-primary-server-btn="true"
                  onFocus={() => onWakeOsd?.()}
                  onClick={(e) => {
                    onWakeOsd?.();
                    const next =
                      openMenu === 'quality' || openMenu === 'server'
                        ? 'none'
                        : 'quality';
                    setOpenMenu(next);
                    if (next === 'quality') {
                      const container = e.currentTarget.parentElement;
                      window.setTimeout(() => {
                        const activeBtn =
                          container?.querySelector<HTMLButtonElement>(
                            '[data-quality-opt-active="true"]'
                          ) ||
                          container?.querySelector<HTMLButtonElement>(
                            '[data-quality-opt="true"]'
                          );
                        activeBtn?.focus();
                      }, 40);
                    }
                  }}
                  title={`Sursă & Calitate Video · ${resolutionReport.badgeLabel} (Butonul Roșu)`}
                  aria-label="Sursă & Calitate Video (Butonul Roșu)"
                  className={`${isMobilePhone ? 'h-8 w-8' : 'h-9 w-9 sm:h-10 sm:w-10'
                    } relative rounded-full inline-flex items-center justify-center transition-all hover:scale-105 active:scale-95 focus:outline-none focus:bg-white focus:text-zinc-950 shrink-0 cursor-pointer ${openMenu === 'quality' || openMenu === 'server'
                      ? 'bg-white text-zinc-950 border border-white shadow-[0_6px_20px_rgba(255,255,255,0.32)]'
                      : 'apple-vod-liquid-pill text-white/95'
                    }`}
                >
                  <SfVideoCameraIcon className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0" />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-[3.5px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#FF453A]"
                  />
                </button>

                {(openMenu === 'quality' || openMenu === 'server') && (
                  <div
                    data-vod-menu-popover="true"
                    className={`${isMobilePhone
                      ? 'fixed inset-x-3 bottom-20 w-auto max-w-sm mx-auto max-h-[65vh]'
                      : 'max-sm:fixed max-sm:inset-x-3 max-sm:bottom-32 max-sm:w-auto sm:absolute sm:right-0 sm:bottom-full sm:mb-3 sm:w-80 max-h-[72vh]'
                      } overflow-y-auto rounded-[24px] apple-vod-liquid-popover p-3.5 space-y-2.5 z-50`}
                  >
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-semibold text-white/75">
                        Calitate & Sursă Video · {resolutionReport.badgeLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpenMenu('none')}
                        className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-white/80 inline-flex items-center justify-center focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* 1. External Source Resolution Variants (4K UHD -> 1080p Full HD -> 720p HD) */}
                    {!offlineItem && externalQualityOptions.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="px-2 py-0.5 text-[11px] font-semibold text-white/60">
                          Calitate Video Disponibilă
                        </div>
                        {externalQualityOptions.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            data-quality-opt="true"
                            data-quality-opt-active={
                              opt.active ? 'true' : undefined
                            }
                            onClick={() => {
                              opt.onSelect();
                              setOpenMenu('none');
                            }}
                            className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-medium flex items-center justify-between gap-2 transition-colors focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer ${opt.active
                              ? 'bg-white text-zinc-950 font-semibold'
                              : 'text-white/90 hover:bg-white/15'
                              }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate leading-snug">{opt.label}</span>
                                {opt.badge && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${opt.active
                                      ? 'bg-zinc-950/15 text-zinc-950'
                                      : 'bg-white/15 text-white'
                                      }`}
                                  >
                                    {opt.badge}
                                  </span>
                                )}
                              </div>
                            </div>
                            {opt.active && (
                              <Check className="w-3.5 h-3.5 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 2. Native Stream Resolutions (HLS / DASH Levels) */}
                    {qualityLevels.length > 0 &&
                      (qualityLevels.length > 1 ||
                        externalQualityOptions.length === 0) && (
                        <div
                          className={`space-y-1 ${!offlineItem && externalQualityOptions.length > 0
                            ? 'pt-1.5 border-t border-white/10'
                            : ''
                            }`}
                        >
                          {qualityLevels.map((q) => {
                            const active = activeQuality === q.index;
                            const tierText = formatQualityTierLabel(q.height);
                            return (
                              <button
                                key={q.index}
                                type="button"
                                data-quality-opt="true"
                                data-quality-opt-active={
                                  active ? 'true' : undefined
                                }
                                onClick={() => {
                                  handleSelectQualityLevel(q.index);
                                  setOpenMenu('none');
                                }}
                                className={`w-full px-3 py-2 rounded-xl text-left text-xs font-medium flex items-center justify-between gap-2 transition-colors focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer ${active
                                  ? 'bg-white text-zinc-950 font-semibold'
                                  : 'text-white/90 hover:bg-white/15'
                                  }`}
                              >
                                <span className="truncate">{tierText}</span>
                                {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                              </button>
                            );
                          })}

                          {qualityLevels.length > 1 && (
                            <button
                              type="button"
                              data-quality-opt="true"
                              data-quality-opt-active={
                                activeQuality === -1 ? 'true' : undefined
                              }
                              onClick={() => {
                                handleSelectQualityLevel(-1);
                                setOpenMenu('none');
                              }}
                              className={`w-full px-3 py-2 rounded-xl text-left text-xs font-medium flex items-center justify-between gap-2 transition-colors focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer ${activeQuality === -1
                                ? 'bg-white text-zinc-950 font-semibold'
                                : 'text-white/90 hover:bg-white/15'
                                }`}
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                <span>Auto ({resolutionReport.badgeLabel})</span>
                              </span>
                              {activeQuality === -1 && (
                                <Check className="w-3.5 h-3.5 shrink-0" />
                              )}
                            </button>
                          )}
                        </div>
                      )}

                    {/* 3. Video Servers (Only shown when multiple servers are actually available) */}
                    {!offlineItem && serverOptions.length > 1 && onSelectServer && (
                      <div className="space-y-1 pt-1.5 border-t border-white/10">
                        <div className="px-2 py-0.5 text-[11px] font-semibold text-white/60">
                          Schimbă Sursa Video
                        </div>
                        {serverOptions.map((srv) => {
                          const active = srv.id === activeServerId;
                          return (
                            <button
                              key={srv.id}
                              type="button"
                              data-quality-opt="true"
                              data-server-opt="true"
                              data-server-opt-active={active ? 'true' : undefined}
                              onClick={() => {
                                onSelectServer(srv.id);
                                setOpenMenu('none');
                              }}
                              className={`w-full px-3 py-2 rounded-xl text-left text-xs font-medium flex items-center justify-between gap-2 transition-colors focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer ${active
                                ? 'bg-white text-zinc-950 font-semibold'
                                : 'text-white/90 hover:bg-white/15'
                                }`}
                            >
                              <span className="truncate leading-snug">
                                {srv.label.replace(/^[^\w\d\s]+\s*/, '')}
                              </span>
                              {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Green Remote Button: Subtitles (Apple SF Symbol — captions.bubble.fill) */}
              {(onApplyAutoSubtitle ||
                onOpenSubtitleFinder ||
                hasActiveSubtitle) && (
                  <div className="relative">
                    <button
                      type="button"
                      data-vod-primary-subtitles-btn="true"
                      onFocus={() => onWakeOsd?.()}
                      onClick={(e) => {
                        const next =
                          openMenu === 'subtitles' ? 'none' : 'subtitles';
                        setOpenMenu(next);
                        if (next === 'subtitles') {
                          const container = e.currentTarget.parentElement;
                          window.setTimeout(() => {
                            const activeBtn =
                              container?.querySelector<HTMLButtonElement>(
                                '[data-sub-track-active="true"]'
                              ) ||
                              container?.querySelector<HTMLButtonElement>(
                                '[data-sub-track-opt="true"]'
                              );
                            activeBtn?.focus();
                          }, 40);
                        }
                      }}
                      title="Subtitrări (Butonul Verde)"
                      aria-label="Subtitrări"
                      className={`${isMobilePhone ? 'h-8 w-8' : 'h-9 w-9 sm:h-10 sm:w-10'
                        } relative rounded-full inline-flex items-center justify-center transition-all hover:scale-105 active:scale-95 focus:outline-none focus:bg-white focus:text-zinc-950 shrink-0 cursor-pointer ${openMenu === 'subtitles'
                          ? 'bg-white text-zinc-950 border border-white shadow-[0_6px_20px_rgba(255,255,255,0.32)]'
                          : 'apple-vod-liquid-pill text-white/95'
                        }`}
                    >
                      <SfCaptionsBubbleIcon className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0" />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute bottom-[3.5px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#30D158]"
                      />
                    </button>

                    {openMenu === 'subtitles' && (
                      <div
                        data-vod-menu-popover="true"
                        className={`${isMobilePhone
                          ? 'fixed inset-x-3 bottom-20 w-auto max-w-sm mx-auto max-h-[65vh]'
                          : 'max-sm:fixed max-sm:inset-x-3 max-sm:bottom-32 max-sm:w-auto sm:absolute sm:right-0 sm:bottom-full sm:mb-3 sm:w-[340px] max-h-[70vh] sm:max-h-[78vh]'
                          } overflow-y-auto rounded-[24px] apple-vod-liquid-popover p-3.5 space-y-2 z-50`}
                      >
                        <div
                          data-vod-popover-row="true"
                          className="flex items-center justify-between px-1"
                        >
                          <span className="text-xs font-semibold text-white/70">
                            Subtitrări (Sus/Jos = Rând, Stânga/Dreapta = Opțiune)
                          </span>
                          <button
                            type="button"
                            onFocus={() => onWakeOsd?.()}
                            onClick={() => setOpenMenu('none')}
                            className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-white/80 inline-flex items-center justify-center focus:outline-none focus:bg-white focus:text-zinc-950 focus:ring-2 focus:ring-white cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Off Button */}
                        <div data-vod-popover-row="true">
                          <button
                            type="button"
                            data-sub-track-opt="true"
                            data-sub-track-active={
                              !hasActiveSubtitle ? 'true' : undefined
                            }
                            onFocus={() => onWakeOsd?.()}
                            onClick={() => {
                              setActiveSubTrackId(null);
                              onClearSubtitle?.();
                              setOpenMenu('none');
                            }}
                            className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-all focus:outline-none focus:bg-white focus:text-zinc-950 focus:ring-2 focus:ring-white cursor-pointer ${!hasActiveSubtitle
                              ? 'bg-white/25 text-white border border-white/30'
                              : 'bg-white/10 hover:bg-white/15 text-white/90'
                              }`}
                          >
                            <span>Fără subtitrare</span>
                            {!hasActiveSubtitle && (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Embedded MKV Text Subtitles (Frame-Exact 100% Sync) */}
                        {embeddedSubtitleTracks.length > 0 && onSelectEmbeddedSubtitle && (() => {
                          const priorityLangs = ['ro', 'en', 'ru', 'es', 'fr', 'de', 'it'];
                          const picked: EmbeddedSubtitleTrack[] = [];
                          const seenLang = new Set<string>();
                          for (const code of priorityLangs) {
                            const best =
                              embeddedSubtitleTracks.find((t) => t.isText && t.langCode2 === code && !t.forced && !t.sdh) ||
                              embeddedSubtitleTracks.find((t) => t.isText && t.langCode2 === code && !t.forced) ||
                              embeddedSubtitleTracks.find((t) => t.isText && t.langCode2 === code);
                            if (best && !seenLang.has(best.langCode2)) {
                              seenLang.add(best.langCode2);
                              picked.push(best);
                            }
                          }
                          if (picked.length === 0) return null;
                          return (
                            <div className="p-2 rounded-xl bg-emerald-500/12 border border-emerald-400/30 space-y-1.5">
                              <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                                <Sparkles className="w-3 h-3 shrink-0" aria-hidden="true" />
                                <span>Din fișier MKV (Sincron 100%)</span>
                              </div>
                              {Array.from({ length: Math.ceil(picked.length / 4) }, (_, rowIdx) => (
                                <div key={`mkv_row_${rowIdx}`} data-vod-popover-row="true" className="flex items-center gap-1.5">
                                  {picked.slice(rowIdx * 4, rowIdx * 4 + 4).map((trk) => {
                                    const isSel = Boolean(subtitleLabel && subtitleLabel.includes(trk.label));
                                    return (
                                      <button
                                        key={`mkv_sub_${trk.index}`}
                                        type="button"
                                        data-sub-track-opt="true"
                                        data-sub-track-active={isSel ? 'true' : undefined}
                                        onFocus={() => onWakeOsd?.()}
                                        onClick={() => {
                                          setActiveSubTrackId(null);
                                          onSelectEmbeddedSubtitle(trk);
                                          showTransportToast(`Subtitrare MKV: ${trk.langLabel} (Sincron 100%)`);
                                          setOpenMenu('none');
                                        }}
                                        className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all focus:outline-none focus:bg-white focus:text-zinc-950 focus:ring-2 focus:ring-white cursor-pointer ${isSel
                                          ? 'bg-emerald-400 text-zinc-950 font-black shadow-sm'
                                          : 'bg-white/12 hover:bg-white/20 text-white'
                                          }`}
                                      >
                                        {trk.langLabel}
                                      </button>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          );
                        })()}

                        {/* 1-Click Language Rows (Compact Single-Line Rows for Deterministic Remote Navigation) */}
                        {isLoadingSubsList ? (
                          <div className="py-3 flex items-center justify-center gap-2 text-xs text-white/70">
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Se încarcă subtitrările...</span>
                          </div>
                        ) : availableSubs.length > 0 ? (
                          <div className="space-y-1.5">
                            {QUICK_SUB_LANGS.map((lang) => {
                              const tracks = subsByLang[lang.code] || [];
                              if (tracks.length === 0) return null;
                              return (
                                <div
                                  key={lang.code}
                                  data-vod-popover-row="true"
                                  className="px-2.5 py-1.5 rounded-xl bg-white/[0.07] border border-white/10 flex items-center justify-between gap-2"
                                >
                                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white shrink-0">
                                    <span className="px-1.5 py-0.5 rounded bg-white/15 text-[10px] font-bold text-white inline-flex items-center gap-1.5">
                                      <img
                                        src={`https://flagcdn.com/w40/${lang.countryIso}.png`}
                                        alt={lang.flag}
                                        className="w-4 h-3 rounded-[2px] object-cover shrink-0"
                                      />
                                      <span>{lang.flag}</span>
                                    </span>
                                    <span>{lang.label}</span>
                                  </span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {tracks.map((trk, idx) => {
                                      const isSelected =
                                        activeSubTrackId === trk.id;
                                      const isDownloading =
                                        loadingSubTrackId === trk.id;
                                      return (
                                        <button
                                          key={trk.id}
                                          type="button"
                                          data-sub-track-opt="true"
                                          data-sub-track-active={
                                            isSelected ? 'true' : undefined
                                          }
                                          disabled={isDownloading}
                                          onFocus={() => onWakeOsd?.()}
                                          onClick={() =>
                                            void handleSelectQuickSubTrack(trk)
                                          }
                                          className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 transition-all focus:outline-none focus:bg-white focus:text-zinc-950 focus:ring-2 focus:ring-white focus:scale-105 cursor-pointer ${isSelected
                                            ? 'bg-emerald-400 text-zinc-950 font-bold shadow-sm'
                                            : 'bg-white/12 hover:bg-white/20 text-white/95'
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

                        {/* Subtitle Font Size Controls (A- / A+ & Presets) */}
                        <div className="pt-2 border-t border-white/10 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-medium text-white/75">
                            <span className="inline-flex items-center gap-1.5">
                              <Type className="w-3.5 h-3.5" />
                              <span>Mărime Font Subtitrare:</span>
                            </span>
                            <span className="tabular-nums text-white font-bold">
                              {subFontPx}px
                            </span>
                          </div>

                          {/* A- / Reset / A+ Fine Step Buttons */}
                          <div
                            data-vod-popover-row="true"
                            className="grid grid-cols-3 gap-1.5"
                          >
                            <button
                              type="button"
                              onFocus={() => onWakeOsd?.()}
                              onClick={() => {
                                const next = Math.max(14, subFontPx - 2);
                                updateSubFontPx(next);
                                showTransportToast(`Mărime subtitrare: ${next}px`);
                              }}
                              className="py-1.5 rounded-full bg-white/12 hover:bg-white/20 text-white text-xs font-semibold transition-all focus:outline-none focus:bg-white focus:text-zinc-950 focus:ring-2 focus:ring-white focus:scale-[1.03] cursor-pointer"
                            >
                              A- Micșorează
                            </button>
                            <button
                              type="button"
                              onFocus={() => onWakeOsd?.()}
                              onClick={() => {
                                const defPx = getDefaultSubFontPxForCurrentDevice();
                                updateSubFontPx(defPx);
                                showTransportToast(`Mărime subtitrare: ${defPx}px`);
                              }}
                              className="py-1.5 rounded-full bg-white/12 hover:bg-white/20 text-white/90 text-xs font-medium transition-all focus:outline-none focus:bg-white focus:text-zinc-950 focus:ring-2 focus:ring-white focus:scale-[1.03] cursor-pointer"
                            >
                              Reset ({getDefaultSubFontPxForCurrentDevice()}px)
                            </button>
                            <button
                              type="button"
                              onFocus={() => onWakeOsd?.()}
                              onClick={() => {
                                const next = Math.min(48, subFontPx + 2);
                                updateSubFontPx(next);
                                showTransportToast(`Mărime subtitrare: ${next}px`);
                              }}
                              className="py-1.5 rounded-full bg-white/12 hover:bg-white/20 text-white text-xs font-semibold transition-all focus:outline-none focus:bg-white focus:text-zinc-950 focus:ring-2 focus:ring-white focus:scale-[1.03] cursor-pointer"
                            >
                              A+ Mărește
                            </button>
                          </div>

                          {/* Quick Presets (Normal / Mare / Max) */}
                          <div
                            data-vod-popover-row="true"
                            className="grid grid-cols-3 gap-1.5"
                          >
                            {(
                              [
                                { id: 'normal', label: 'Normal', px: 20 },
                                { id: 'large', label: 'Mare', px: 26 },
                                { id: 'xlarge', label: 'Max', px: 34 },
                              ] as const
                            ).map((sz) => (
                              <button
                                key={sz.id}
                                type="button"
                                onFocus={() => onWakeOsd?.()}
                                onClick={() => {
                                  updateSubFontPx(sz.px);
                                  showTransportToast(
                                    `Mărime subtitrare: ${sz.label} (${sz.px}px)`
                                  );
                                }}
                                className={`py-1.5 rounded-full text-xs font-semibold transition-all focus:outline-none focus:bg-white focus:text-zinc-950 focus:ring-2 focus:ring-white focus:scale-[1.03] cursor-pointer ${subFontSize === sz.id
                                  ? 'bg-emerald-400 text-zinc-950 font-bold'
                                  : 'bg-white/12 hover:bg-white/20 text-white/90'
                                  }`}
                              >
                                {sz.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Subtitle Timing Offset (-0.5s / 0s / +0.5s) */}
                        <div className="pt-2 border-t border-white/10 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-medium text-white/75">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              Sincronizare Timp:
                            </span>
                            <span className="tabular-nums text-white font-bold">
                              {subOffsetSec > 0
                                ? `+${subOffsetSec}s`
                                : `${subOffsetSec}s`}
                            </span>
                          </div>
                          <div
                            data-vod-popover-row="true"
                            className="grid grid-cols-5 gap-1"
                          >
                            {([-10, -1, 0, 1, 10] as const).map((delta) => (
                              <button
                                key={`sub_sync_${delta}`}
                                type="button"
                                onFocus={() => onWakeOsd?.()}
                                onClick={() => {
                                  if (delta === 0) {
                                    setSubOffsetSec(0);
                                    showTransportToast('Sincronizare subtitrare: 0s');
                                    return;
                                  }
                                  setSubOffsetSec((prev) => {
                                    const next = Number((prev + delta).toFixed(1));
                                    showTransportToast(
                                      `Sincronizare subtitrare: ${next > 0 ? `+${next}s` : `${next}s`}`
                                    );
                                    return next;
                                  });
                                }}
                                className="py-1.5 rounded-full bg-white/12 hover:bg-white/20 text-white text-[11px] tabular-nums font-semibold transition-all focus:outline-none focus:bg-white focus:text-zinc-950 focus:ring-2 focus:ring-white focus:scale-[1.03] cursor-pointer"
                              >
                                {delta === 0 ? '0s' : delta > 0 ? `+${delta}s` : `${delta}s`}
                              </button>
                            ))}
                          </div>
                          <div
                            data-vod-popover-row="true"
                            className="grid grid-cols-2 gap-1.5"
                          >
                            {([-0.5, 0.5] as const).map((delta) => (
                              <button
                                key={`sub_sync_fine_${delta}`}
                                type="button"
                                onFocus={() => onWakeOsd?.()}
                                onClick={() => {
                                  setSubOffsetSec((prev) => {
                                    const next = Number((prev + delta).toFixed(1));
                                    showTransportToast(
                                      `Sincronizare subtitrare: ${next > 0 ? `+${next}s` : `${next}s`}`
                                    );
                                    return next;
                                  });
                                }}
                                className="py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/90 text-[11px] tabular-nums font-semibold transition-all focus:outline-none focus:bg-white focus:text-zinc-950 focus:ring-2 focus:ring-white focus:scale-[1.03] cursor-pointer"
                              >
                                {delta > 0 ? `+${delta}s (fin)` : `${delta}s (fin)`}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Open Full Subtitle Search Modal */}
                        {onOpenSubtitleFinder && (
                          <div data-vod-popover-row="true">
                            <button
                              type="button"
                              onFocus={() => onWakeOsd?.()}
                              onClick={() => {
                                setOpenMenu('none');
                                onOpenSubtitleFinder();
                              }}
                              className="w-full py-2 px-3 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 border border-white/15 transition-all focus:outline-none focus:bg-white focus:text-zinc-950 focus:ring-2 focus:ring-white cursor-pointer"
                            >
                              <Search className="w-3.5 h-3.5" />
                              <span>Căutare Avansată / .SRT</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

              {/* 3. Yellow Remote Button: Format Video / Ecran Complet (aligned 🔴 🟢 🟡 🔵 with TV remote) */}
              <button
                type="button"
                data-vod-fullscreen-btn="true"
                onFocus={() => onWakeOsd?.()}
                onClick={handleToggleVodFullscreen}
                title={
                  isRealHardwareTv
                    ? 'Format Video: 16:9 / 21:9 / Ecran Plin (Butonul Galben)'
                    : isCustomFullscreen
                      ? 'Ieșire din Ecran Complet (Butonul Galben / Esc)'
                      : 'Ecran Complet / Format Video (Butonul Galben)'
                }
                aria-label={
                  isRealHardwareTv
                    ? 'Schimbă Format Video (Butonul Galben)'
                    : isCustomFullscreen
                      ? 'Ieșire din Ecran Complet'
                      : 'Ecran Complet / Format Video (Butonul Galben)'
                }
                className={`${isMobilePhone ? 'h-9 w-9 min-h-[36px] min-w-[36px]' : 'h-9 w-9 sm:h-10 sm:w-10'
                  } relative rounded-full apple-vod-liquid-pill text-white/95 inline-flex items-center justify-center shrink-0 transition-all hover:scale-105 active:scale-95 focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer touch-manipulation`}
              >
                {isCustomFullscreen && !isRealHardwareTv ? (
                  <Minimize2
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <Maximize2
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-[3.5px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#FFD60A]"
                />
              </button>

              {/* 4. Blue Remote Button: Audio Track (Apple SF Symbol — speaker.wave.2.fill) */}
              {audioTracks.length > 0 ? (
                <div className="relative">
                  <button
                    type="button"
                    data-vod-primary-audio-btn="true"
                    onFocus={() => onWakeOsd?.()}
                    onClick={(e) => {
                      const next = openMenu === 'audio' ? 'none' : 'audio';
                      setOpenMenu(next);
                      if (next === 'audio') {
                        const container = e.currentTarget.parentElement;
                        window.setTimeout(() => {
                          const activeBtn =
                            container?.querySelector<HTMLButtonElement>(
                              '[data-audio-track-active="true"]'
                            ) ||
                            container?.querySelector<HTMLButtonElement>(
                              '[data-audio-track-opt="true"]'
                            );
                          activeBtn?.focus();
                        }, 40);
                      }
                    }}
                    title="Pistă Audio (Butonul Albastru)"
                    aria-label="Pistă Audio"
                    className={`${isMobilePhone ? 'h-8 w-8' : 'h-9 w-9 sm:h-10 sm:w-10'
                      } relative rounded-full inline-flex items-center justify-center transition-all hover:scale-105 active:scale-95 focus:outline-none focus:bg-white focus:text-zinc-950 shrink-0 cursor-pointer ${openMenu === 'audio'
                        ? 'bg-white text-zinc-950 border border-white shadow-[0_6px_20px_rgba(255,255,255,0.32)]'
                        : 'apple-vod-liquid-pill text-white/95'
                      }`}
                  >
                    <SfSpeakerWaveIcon className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0" />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute bottom-[3.5px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#0A84FF]"
                    />
                  </button>

                  {openMenu === 'audio' && (
                    <div
                      data-vod-menu-popover="true"
                      className={`${isMobilePhone
                        ? 'fixed inset-x-3 bottom-20 w-auto max-w-sm mx-auto max-h-[65vh]'
                        : 'max-sm:fixed max-sm:inset-x-3 max-sm:bottom-32 max-sm:w-auto sm:absolute sm:right-0 sm:bottom-full sm:mb-3 sm:w-64 max-h-72'
                        } overflow-y-auto rounded-[24px] apple-vod-liquid-popover p-3 space-y-1 z-50`}
                    >
                      <div className="px-3 py-1 text-[11px] font-semibold text-white/60 flex items-center gap-1.5">
                        <SfSpeakerWaveIcon className="w-3.5 h-3.5 text-[#0A84FF] shrink-0" />
                        <span>Pistă Audio</span>
                      </div>
                      {filterDisplayAudioItems(
                        audioTracks.map((trk, idx) => ({ trk, idx })),
                        (item) => item.trk.name,
                        isForeign
                      ).map(({ trk, idx }) => {
                        const active =
                          trk.id === activeAudioTrack || idx === forcedAudioIdx;
                        return (
                          <button
                            key={`${trk.id}_${idx}`}
                            type="button"
                            data-audio-track-opt="true"
                            data-audio-track-active={active ? 'true' : undefined}
                            onClick={() => {
                              const needsServerReload = Boolean(
                                hlsUrl && (hlsUrl.includes('/api/filelist/') || hlsUrl.includes('/api/tv-proxy'))
                              );
                              const v = videoRef.current;
                              if (v && (streamOffsetRef.current + v.currentTime) > 3 && needsServerReload) {
                                startAtSecondsRef.current = Math.floor(
                                  streamOffsetRef.current + v.currentTime
                                );
                                appliedStartRef.current = false;
                              }
                              setActiveAudioTrack(trk.id);
                              if (needsServerReload) {
                                setForcedAudioIdx(idx);
                              }
                              if (!isForeign) {
                                saveActiveProfileMediaPrefs({
                                  defaultAudioPref: inferAudioPrefFromTrackName(
                                    trk.name
                                  ),
                                });
                              }
                              onSelectAudioTrackIndex?.(idx);
                              if (dashRef.current) {
                                const dashTracks =
                                  dashRef.current.getTracksFor('audio') || [];
                                if (dashTracks[trk.id]) {
                                  dashRef.current.setCurrentTrack(
                                    dashTracks[trk.id]
                                  );
                                }
                              } else if (
                                hlsRef.current &&
                                (!hlsUrl || !hlsUrl.includes('/api/tv-proxy'))
                              ) {
                                hlsRef.current.audioTrack = trk.id;
                              } else if (
                                !hlsRef.current &&
                                (!hlsUrl || !hlsUrl.includes('/api/tv-proxy'))
                              ) {
                                const v = videoRef.current as unknown as {
                                  audioTracks?: {
                                    length: number;
                                    [index: number]: { enabled?: boolean };
                                  };
                                } | null;
                                if (v?.audioTracks && v.audioTracks.length > 0) {
                                  for (
                                    let i = 0;
                                    i < v.audioTracks.length;
                                    i++
                                  ) {
                                    if (v.audioTracks[i]) {
                                      v.audioTracks[i].enabled = i === trk.id;
                                    }
                                  }
                                }
                              }
                              setOpenMenu('none');
                            }}
                            className={`w-full px-3 py-2 rounded-xl text-left text-xs font-medium flex items-center justify-between gap-2 transition-colors focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer ${active
                              ? 'bg-white text-zinc-950 font-semibold'
                              : 'text-white/90 hover:bg-white/15'
                              }`}
                          >
                            <span className="truncate">{trk.name}</span>
                            {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                          </button>
                        );
                      })}
                      {!offlineItem &&
                        onRequestOriginalAudio &&
                        !audioTracks.some((t) =>
                          /orig|eng|english|ориг|англ/i.test(t.name)
                        ) && (
                          <button
                            type="button"
                            data-audio-track-opt="true"
                            onClick={() => {
                              saveActiveProfileMediaPrefs({
                                defaultAudioPref: 'original',
                              });
                              setOpenMenu('none');
                              onRequestOriginalAudio();
                            }}
                            className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors bg-[#1e3a8a]/80 hover:bg-[#2563eb] text-white border border-blue-400/40 focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
                          >
                            <span className="truncate">
                              Original (English) • 1080p / 4K
                            </span>
                          </button>
                        )}
                      {isMobilePhone &&
                        serverOptions.length > 1 &&
                        onSelectServer && (
                          <div className="pt-1.5 mt-1.5 border-t border-white/10 space-y-1">
                            <div className="px-3 py-0.5 text-[10px] font-semibold text-white/55 uppercase tracking-wider">
                              Schimbă Sursa Video
                            </div>
                            {serverOptions.map((srv) => {
                              const active = srv.id === activeServerId;
                              return (
                                <button
                                  key={`mob_srv_${srv.id}`}
                                  type="button"
                                  data-audio-track-opt="true"
                                  onClick={() => {
                                    onSelectServer(srv.id);
                                    setOpenMenu('none');
                                  }}
                                  className={`w-full px-3 py-1.5 rounded-xl text-left text-xs font-medium flex items-center justify-between gap-2 transition-colors focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer ${active
                                    ? 'bg-white text-zinc-950 font-semibold'
                                    : 'text-white/85 hover:bg-white/15'
                                    }`}
                                >
                                  <span className="truncate">
                                    {srv.label.replace(/^[^\w\d\s]+\s*/, '')}
                                  </span>
                                  {active && (
                                    <Check className="w-3.5 h-3.5 shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                    </div>
                  )}
                </div>
              ) : onOpenInfoSheet ? (
                <button
                  type="button"
                  data-vod-primary-audio-btn="true"
                  onFocus={() => onWakeOsd?.()}
                  onClick={() => {
                    onWakeOsd?.();
                    setOpenMenu('none');
                    onOpenInfoSheet();
                  }}
                  title="Pistă Audio & Sursă (Butonul Albastru)"
                  aria-label="Pistă Audio & Sursă"
                  className={`${isMobilePhone ? 'h-8 w-8' : 'h-9 w-9 sm:h-10 sm:w-10'
                    } relative rounded-full apple-vod-liquid-pill text-white/95 inline-flex items-center justify-center transition-all hover:scale-105 active:scale-95 focus:outline-none focus:bg-white focus:text-zinc-950 shrink-0 cursor-pointer`}
                >
                  <SfSpeakerWaveIcon className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0" />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-[3.5px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#0A84FF]"
                  />
                </button>
              ) : null}

              {/* 5. Apple TV / AirPlay (Last icon — visible ONLY on non-TV devices: iPad, iPhone, Mac, PC, Android; hidden on LG webOS / Smart TV) */}
              {!isNarrowPortraitMobile && !isRealHardwareTv && (
                <button
                  type="button"
                  data-vod-airplay-btn="true"
                  onFocus={() => onWakeOsd?.()}
                  onClick={handleTriggerAirPlay}
                  title="AirPlay / Apple TV"
                  aria-label="AirPlay / Apple TV"
                  className={`${isMobilePhone ? 'h-8 w-8' : 'h-9 w-9 sm:h-10 sm:w-10'
                    } rounded-full apple-vod-liquid-pill text-white/95 inline-flex items-center justify-center shrink-0 transition-all hover:scale-105 active:scale-95 focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer`}
                >
                  <SfAirPlayIcon className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
