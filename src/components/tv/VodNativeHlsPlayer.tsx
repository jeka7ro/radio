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
  Layers,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Sparkles,
  Maximize2,
  Airplay,
  X,
} from 'lucide-react';
import {
  OfflineMediaItem,
  createOfflineAwareHlsLoader,
  getBlobChunk,
  buildIosNativeOfflineHlsBlobUrl,
} from '../../services/offlineMediaService';
import {
  SubtitleCue,
  OnlineSubtitleTrack,
  fetchOnlineSubtitlesByImdb,
  downloadSubtitleAsVttBlobUrl,
  resolveAudioTrackIndexByPreference,
  inferAudioPrefFromTrackName,
} from '../../services/subtitleSearchService';
import {
  getActiveProfileMediaPrefs,
  saveActiveProfileMediaPrefs,
} from '../../services/deviceContinuityService';

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
  if (height >= 2160) return '4K UHD • 2160p';
  if (height >= 1440) return '2K QHD • 1440p';
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
  durationHintSec?: number;
  offlineItem?: OfflineMediaItem | null;
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
  onApplyAutoSubtitle?: (payload: {
    vttBlobUrl: string;
    label: string;
    cues: SubtitleCue[];
  }) => void;
  onOpenSubtitleFinder?: () => void;
  onClearSubtitle?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onStreamError?: () => void;
  onSelectAudioTrackIndex?: (index: number) => void;
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

export const VodNativeHlsPlayer: React.FC<VodNativeHlsPlayerProps> = ({
  dashUrl,
  hlsUrl,
  durationHintSec = 0,
  offlineItem,
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
  onApplyAutoSubtitle,
  onOpenSubtitleFinder,
  onClearSubtitle,
  onTimeUpdate,
  onStreamError,
  onSelectAudioTrackIndex,
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
  prevEpisodeLabel,
  nextEpisodeLabel,
}) => {
  const [isMobilePhone, setIsMobilePhone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (
      document.documentElement.classList.contains('smart-tv-mode') ||
      window.location.pathname.toLowerCase().startsWith('/tv')
    ) {
      return false;
    }
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIpadOs =
      /iPad/i.test(ua) ||
      (typeof navigator !== 'undefined' &&
        navigator.platform === 'MacIntel' &&
        navigator.maxTouchPoints > 1);
    if (/iPhone|iPod|Android.*Mobile/i.test(ua) || isIpadOs) return true;
    return (
      window.innerWidth < 640 ||
      (window.innerHeight < 540 && window.innerWidth < 1024)
    );
  });

  useEffect(() => {
    const syncIsMobilePhone = () => {
      if (
        document.documentElement.classList.contains('smart-tv-mode') ||
        window.location.pathname.toLowerCase().startsWith('/tv')
      ) {
        setIsMobilePhone(false);
        return;
      }
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const isIpadOs =
        /iPad/i.test(ua) ||
        (typeof navigator !== 'undefined' &&
          navigator.platform === 'MacIntel' &&
          navigator.maxTouchPoints > 1);
      if (/iPhone|iPod|Android.*Mobile/i.test(ua) || isIpadOs) {
        setIsMobilePhone(true);
        return;
      }
      setIsMobilePhone(
        window.innerWidth < 640 ||
          (window.innerHeight < 540 && window.innerWidth < 1024)
      );
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
  useEffect(() => {
    if (startAtSeconds === 0 || startAtSeconds > startAtSecondsRef.current) {
      startAtSecondsRef.current = startAtSeconds;
    }
  }, [startAtSeconds]);

  const [forcedAudioIdx, setForcedAudioIdx] = useState<number>(() => {
    if (
      typeof initialAudioTrackIndex === 'number' &&
      initialAudioTrackIndex >= 0
    ) {
      return initialAudioTrackIndex;
    }
    const profileAudioPref = getActiveProfileMediaPrefs().defaultAudioPref;
    return audioTrackLabels.length > 0
      ? resolveAudioTrackIndexByPreference(audioTrackLabels, profileAudioPref)
      : 0;
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
    setDismissedSegmentIds([]);
    setApiSkipSegments([]);
    setApiOutroStartSec(null);
    setApiNoIntro(false);
    setIsIntroApiSettled(false);
    hasAutoFocusedSkipIntroRef.current = null;
    setVideoDurationSec(0);
  }, [season, episode, hlsUrl, dashUrl]);

  // Query BOTH IntroDB.app (curated consensus Recap + Intro + Outro) and TheIntroDB v2 in parallel for Netflix/Lampa-level accuracy
  useEffect(() => {
    const cleanImdb =
      imdbId && imdbId.startsWith('tt')
        ? imdbId.match(/^(tt\d+)/)?.[1] || ''
        : '';
    const rawTmdb = tmdbId !== undefined && tmdbId !== null ? String(tmdbId).trim() : '';
    const cleanTmdb = /^\d+$/.test(rawTmdb) ? rawTmdb : '';

    if (mediaType !== 'series' || (!cleanImdb && !cleanTmdb)) {
      setApiSkipSegments([]);
      setApiOutroStartSec(null);
      setApiNoIntro(false);
      setIsIntroApiSettled(true);
      return;
    }

    let active = true;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 4500);

    const fetchIntroDbApp = async (): Promise<any | null> => {
      if (!cleanImdb) return null;
      const targetUrl = `https://api.introdb.app/segments?imdb_id=${encodeURIComponent(cleanImdb)}&season=${season}&episode=${episode}`;
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
      try {
        const res = await fetch(
          `https://api.theintrodb.org/v2/media?${idQuery}&season=${season}&episode=${episode}`,
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

        // Parse valid segments from TheIntroDB v2 intro array (used for multi-segment recap+intro disambiguation & fallback)
        const v2IntroValid: Array<{ s: number; e: number }> = Array.isArray(
          dV2?.intro
        )
          ? dV2.intro
              .map((seg: any) => ({
                s: typeof seg?.start_ms === 'number' ? seg.start_ms / 1000 : 0,
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
              toastLabel: '⏭ Recapitulare Omisă',
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
              toastLabel: '⏭ Recapitulare Omisă',
            });
            recapAdded = true;
          }
        }

        // 2. INTRO from IntroDB.app (primary consensus) + smart disambiguation if an early recap was tagged as intro
        if (!explicitNoIntro && dApp?.intro && typeof dApp.intro === 'object') {
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
              // The <20s segment is the "Previously on..." Recap, and the later segment is the real Opening Intro
              segments.push({
                id: `recap_${startSec}_${endSec}`,
                type: 'recap',
                startSec,
                endSec,
                label: 'Sari peste Recapitulare',
                toastLabel: '⏭ Recapitulare Omisă',
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
                toastLabel: '⏭ Intro Omis',
              });
              introAdded = true;
            } else {
              segments.push({
                id: `intro_${startSec}_${endSec}`,
                type: 'intro',
                startSec,
                endSec,
                label: 'Sari peste Intro',
                toastLabel: '⏭ Intro Omis',
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
                toastLabel: '⏭ Recapitulare Omisă',
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
              toastLabel: '⏭ Intro Omis',
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
                toastLabel: '⏭ Intro Omis',
              });
              introAdded = true;
            }
          }
        }

        // 4. OUTRO / CREDITS timestamp
        let resolvedOutroSec: number | null = null;
        if (dApp?.outro && typeof dApp.outro === 'object') {
          const oSec =
            typeof dApp.outro.start_sec === 'number'
              ? dApp.outro.start_sec
              : (dApp.outro.start_ms || 0) / 1000;
          if (oSec > 300) resolvedOutroSec = Math.floor(oSec);
        }
        if (!resolvedOutroSec && Array.isArray(dV2?.credits) && dV2.credits.length > 0) {
          const lastCred = dV2.credits[dV2.credits.length - 1];
          if (typeof lastCred?.start_ms === 'number' && lastCred.start_ms > 300000) {
            resolvedOutroSec = Math.floor(lastCred.start_ms / 1000);
          }
        }
        if (!resolvedOutroSec && Array.isArray(dV2?.outro) && dV2.outro.length > 0) {
          const lastOut = dV2.outro[dV2.outro.length - 1];
          if (typeof lastOut?.start_ms === 'number' && lastOut.start_ms > 300000) {
            resolvedOutroSec = Math.floor(lastOut.start_ms / 1000);
          }
        }

        segments.sort((a, b) => a.startSec - b.startSec);
        setApiSkipSegments(segments);
        setApiNoIntro(explicitNoIntro && segments.length === 0);
        if (resolvedOutroSec) {
          setApiOutroStartSec(resolvedOutroSec);
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
    const fetchStats = () => {
      fetch(`/api/filelist/stats${idQuery}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (active && d && d.ok && d.active) {
            setTorrentLiveStats({
              downloadSpeedText: d.downloadSpeedText || 'Buffer HD',
              numPeers: Number(d.numPeers || 0),
              source: d.source || 'FileList.io',
            });
            const probedDur = Number(d.durationSec || 0);
            if (Number.isFinite(probedDur) && probedDur > 60) {
              setVideoDurationSec(probedDur);
            }
          }
        })
        .catch(() => {});
    };
    fetchStats();
    const timer = window.setInterval(fetchStats, 2000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [hlsUrl]);
  const [seekToast, setSeekToast] = useState<string | null>(null);
  const seekToastTimerRef = useRef<number | null>(null);

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
    }
  };

  const resolutionReport = useMemo<VodResolutionReport>(() => {
    const selectedLevelObj =
      activeQuality >= 0
        ? qualityLevels.find((q) => q.index === activeQuality)
        : undefined;
    const rawW = liveVideoDims.width;
    const rawH = liveVideoDims.height;
    const fallbackH =
      selectedLevelObj?.height ||
      qualityLevels[0]?.height ||
      parseQualityHeightFromString(sourceQualityBadge) ||
      1080;
    const normHeight =
      rawH > 0 ? normalizeVideoQualityHeight(rawW, rawH) : fallbackH;
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
        label: `${formatQualityTierLabel(q.height)}${
          idx === 0 && qualityLevels.length > 1 ? ' (Maxim)' : ''
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

  const cleanupFileListMse = () => {
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

  const loadFileListStreamIntoVideo = (
    video: HTMLVideoElement,
    flStreamUrl: string
  ) => {
    cleanupFileListMse();

    const isHardwareTv =
      typeof window !== 'undefined' &&
      /Web0S|WebOS|NetCast|SmartTV|Tizen|Large Screen|MSX/i.test(
        navigator.userAgent
      );

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
        hasFiredPlaying = true;
        isSeekingFileListRef.current = false;
      };
      video.addEventListener('playing', onStreamPlaying, { once: true });

      ms.addEventListener(
        'sourceopen',
        async () => {
          try {
            const res = await fetch(flStreamUrl, {
              signal: controller.signal,
            });
            const durHeader = Number(res.headers.get('X-Content-Duration') || 0);
            if (durHeader > 5) {
              setVideoDurationSec(durHeader);
            }
            if (
              !res.ok ||
              !res.body ||
              typeof res.body.getReader !== 'function'
            ) {
              video.src = flStreamUrl;
              ensureAutoPlay(video);
              return;
            }

            const reader = res.body.getReader();
            const first = await reader.read();
            if (first.done || !first.value) return;

            let initBuf = first.value;
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
            const fallbackCodec =
              'video/mp4; codecs="avc1.640028, mp4a.40.2"';
            const mime = window.MediaSource.isTypeSupported(candidateCodec)
              ? candidateCodec
              : fallbackCodec;

            const sb = ms.addSourceBuffer(mime);
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

            sb.appendBuffer(initBuf);
            await waitUpdate();
            let startedPlay = false;

            const checkAndStartPlayback = () => {
              if (sb.buffered.length > 0) {
                const bStart = sb.buffered.start(0);
                const bEnd = sb.buffered.end(sb.buffered.length - 1);
                if (bStart > 0.01 && video.currentTime < bStart) {
                  try {
                    video.currentTime = bStart + 0.02;
                  } catch {
                    // ignore
                  }
                }
                if (
                  !startedPlay &&
                  (video.readyState >= 2 || bEnd - bStart >= 0.35)
                ) {
                  startedPlay = true;
                  isSeekingFileListRef.current = false;
                  syncVideoDims(video);
                  ensureAutoPlay(video);
                  setStatus('playing');
                  onWakeOsd?.();
                } else if (
                  startedPlay &&
                  !hasFiredPlaying &&
                  video.paused &&
                  video.readyState >= 2
                ) {
                  ensureAutoPlay(video);
                }
              } else if (!startedPlay && video.readyState >= 2) {
                startedPlay = true;
                isSeekingFileListRef.current = false;
                syncVideoDims(video);
                ensureAutoPlay(video);
                setStatus('playing');
                onWakeOsd?.();
              }
            };

            checkAndStartPlayback();

            while (!controller.signal.aborted) {
              if (video.currentTime > 25 && sb.buffered.length > 0) {
                const bStart = sb.buffered.start(0);
                if (bStart < video.currentTime - 15) {
                  try {
                    sb.remove(bStart, video.currentTime - 10);
                    await waitUpdate();
                  } catch {
                    // ignore
                  }
                }
              }

              while (
                !controller.signal.aborted &&
                sb.buffered.length > 0 &&
                sb.buffered.end(sb.buffered.length - 1) - video.currentTime >
                  22
              ) {
                if (!hasFiredPlaying && video.paused && video.readyState >= 2) {
                  ensureAutoPlay(video);
                }
                await new Promise((r) => window.setTimeout(r, 350));
              }
              if (controller.signal.aborted) break;

              const { done, value } = await reader.read();
              if (done || !value) {
                if (!controller.signal.aborted) {
                  try {
                    if (sb.buffered.length > 0) {
                      const exactEnd =
                        streamOffsetRef.current +
                        sb.buffered.end(sb.buffered.length - 1);
                      const isNearRealEnd =
                        exactEnd > 300 &&
                        (!durationHintSec || exactEnd >= durationHintSec * 0.85);
                      if (isNearRealEnd) {
                        setVideoDurationSec((prev) =>
                          prev > exactEnd ? prev : exactEnd
                        );
                        await waitUpdate();
                        if (ms.readyState === 'open') {
                          ms.endOfStream();
                        }
                      }
                    }
                  } catch {
                    // ignore
                  }
                }
                break;
              }

              try {
                sb.appendBuffer(value);
                await waitUpdate();
              } catch {
                // Evict old buffer if QuotaExceededError on Smart TV
                if (sb.buffered.length > 0 && video.currentTime > 5) {
                  try {
                    sb.remove(0, Math.max(0, video.currentTime - 3));
                    await waitUpdate();
                    sb.appendBuffer(value);
                    await waitUpdate();
                  } catch {
                    // ignore
                  }
                }
              }

              checkAndStartPlayback();
            }
          } catch {
            // Aborted or stream closed
          }
        },
        { once: true }
      );
    };

    if (isHardwareTv) {
      startMsePump();
      return;
    }

    video.src = flStreamUrl;
    video.onloadedmetadata = () => {
      isSeekingFileListRef.current = false;
      try {
        if (
          video.buffered &&
          video.buffered.length > 0 &&
          video.buffered.start(0) > 0.01 &&
          video.currentTime < video.buffered.start(0)
        ) {
          video.currentTime = video.buffered.start(0) + 0.02;
        }
      } catch {
        // ignore
      }
      syncVideoDims(video);
      ensureAutoPlay(video);
      setStatus('playing');
      onWakeOsd?.();
    };
    video.onerror = () => {
      isSeekingFileListRef.current = false;
      setStatus('error');
      onStreamError?.();
    };
    ensureAutoPlay(video);
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

        // Automatically activate subtitle by default according to profile's preferredSubLang ('ro' | 'ru' | 'en' | 'es' | 'fr' | 'de' | 'off')
        const effSubLang =
          preferredSubLang || getActiveProfileMediaPrefs().defaultSubLang || 'ro';
        const alreadyHasSub =
          Boolean(subtitleVttUrl) || (subtitleCues && subtitleCues.length > 0);
        if (
          effSubLang !== 'off' &&
          !alreadyHasSub &&
          list.length > 0 &&
          onApplyAutoSubtitle
        ) {
          const allLangs = ['ro', 'ru', 'en', 'es', 'fr', 'de'];
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
    if (
      track.langCode2 === 'ro' ||
      track.langCode2 === 'ru' ||
      track.langCode2 === 'en' ||
      track.langCode2 === 'es' ||
      track.langCode2 === 'fr' ||
      track.langCode2 === 'de'
    ) {
      saveActiveProfileMediaPrefs({ defaultSubLang: track.langCode2 });
    }
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

    if (video.currentTime > 3) {
      startAtSecondsRef.current = Math.floor(
        streamOffsetRef.current + video.currentTime
      );
    }
    appliedStartRef.current = false;
    hasNotifiedInitialPlayOsdRef.current = false;
    setStatus('loading');
    setIsAutoMuted(false);
    setLiveVideoDims({ width: 0, height: 0 });
    if (audioTrackLabels.length > 0) {
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
        if (
          Math.abs(video.currentTime - clampedTarget) <= 15 &&
          !video.seeking &&
          video.readyState >= 2
        ) {
          appliedStartRef.current = true;
        } else if (Date.now() - lastSeekAttemptMsRef.current >= 900) {
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

    const isHardwareSmartTv =
      typeof window !== 'undefined' &&
      /Web0S|WebOS|NetCast|SmartTV|Tizen|Large Screen|MSX/i.test(
        navigator.userAgent
      );

    const isSmartTvEnv =
      typeof window !== 'undefined' &&
      (document.documentElement.classList.contains('smart-tv-mode') ||
        window.location.pathname.toLowerCase().startsWith('/tv') ||
        isHardwareSmartTv);

    const logTvVod = (evt: string, detail = '') => {
      if (!isSmartTvEnv) return;
      try {
        fetch(
          `/api/tv-log?vod=${encodeURIComponent(evt)}&d=${encodeURIComponent(
            detail.slice(0, 180)
          )}`
        ).catch(() => {});
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
      video.src = targetUrl;
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
        if (!retriedNative) {
          retriedNative = true;
          window.setTimeout(() => {
            if (!cancelled && video) {
              video.src = targetUrl;
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

    const isIosMobile =
      typeof navigator !== 'undefined' &&
      /iPhone|iPod/i.test(navigator.userAgent);

    const startHlsPlayback = (targetUrl: string) => {
      if (!targetUrl) {
        setStatus('error');
        onStreamError?.();
        return;
      }

      logTvVod('start_hls', targetUrl);

      if (
        isIosMobile &&
        video.canPlayType('application/vnd.apple.mpegurl')
      ) {
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
          if ('ManagedMediaSource' in window && !('MediaSource' in window)) {
            video.disableRemotePlayback = true;
          }
        } catch {
          // ignore
        }
        const hlsConfig: Partial<ConstructorParameters<typeof Hls>[0]> = {
          enableWorker: !isHardwareSmartTv,
          capLevelToPlayerSize: false,
          startPosition:
            startAtSecondsRef.current > 5 ? startAtSecondsRef.current : -1,
          maxBufferLength: isHardwareSmartTv ? 25 : 45,
          maxMaxBufferLength: isHardwareSmartTv ? 50 : 90,
        };
        if (offlineItem) {
          hlsConfig.loader = createOfflineAwareHlsLoader();
        }
        const hls = new Hls(hlsConfig);
        hlsRef.current = hls;
        let errorRetries = 0;

        hls.loadSource(targetUrl);
        hls.attachMedia(video);

        // Smart TV fallback: if MSE stalls at 0:00 for 4.5s, switch to native <video src>
        const nativeHlsFallbackTimer = window.setTimeout(() => {
          if (
            !cancelled &&
            video &&
            video.currentTime === 0 &&
            video.readyState < 3 &&
            !offlineItem &&
            (isHardwareSmartTv ||
              video.canPlayType('application/vnd.apple.mpegurl'))
          ) {
            switchToNativeVideoHls(targetUrl, 'mse_stall_timeout');
          }
        }, 4500);

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
            window.clearTimeout(nativeHlsFallbackTimer);
            return;
          }
          logTvVod('manifest_parsed', `levels=${data.levels.length}`);

          // Filter out duplicate failover-audio levels so audio0 track switches never drop video quality
          const hasPrimaryLevels = data.levels.some(
            (l) =>
              !String(
                (l as { attrs?: Record<string, string> }).attrs?.AUDIO || ''
              ).startsWith('failover-')
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
          const sortedFull = Array.from(bestByHeight.values()).sort(
            (a, b) => b.height - a.height || b.bitrate - a.bitrate
          );
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
            hls.currentLevel = targetIdx;
            if (targetIdx >= 0) {
              hls.nextLevel = targetIdx;
              hls.loadLevel = targetIdx;
              hls.nextLoadLevel = targetIdx;
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
          const profileAudioPref = getActiveProfileMediaPrefs().defaultAudioPref;
          const autoPrefIdx = resolveAudioTrackIndexByPreference(
            list.map((x) => x.name),
            profileAudioPref
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
            hls.currentLevel = highestLevelIndexRef.current;
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
              hls.startLoad();
              if (video && !userIntentionallyPausedRef.current) {
                video.play().catch(() => {});
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
            } else if (
              !offlineItem &&
              (isHardwareSmartTv ||
                video.canPlayType('application/vnd.apple.mpegurl'))
            ) {
              window.clearTimeout(nativeHlsFallbackTimer);
              switchToNativeVideoHls(targetUrl, `fatal_${data.details}`);
            } else {
              window.clearTimeout(nativeHlsFallbackTimer);
              setStatus('error');
              onStreamError?.();
            }
          }
        });
      } else if (
        !offlineItem &&
        (isHardwareSmartTv ||
          video.canPlayType('application/vnd.apple.mpegurl'))
      ) {
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
        const initialSeek =
          startAtSecondsRef.current > 5
            ? Math.floor(startAtSecondsRef.current)
            : 0;
        streamOffsetRef.current = initialSeek;
        setStreamOffsetSec(initialSeek);
        appliedStartRef.current = true;

        const cleanBase = hlsUrl
          .replace(/([?&])start=\d+/g, '')
          .replace(/([?&])audio=\d+/g, '');
        const sep = cleanBase.includes('?') ? '&' : '?';
        const audioParam = forcedAudioIdx >= 0 ? forcedAudioIdx : 0;
        const flStreamUrl = `${cleanBase}${sep}start=${initialSeek}&audio=${audioParam}`;

        logTvVod('start_filelist_stream', flStreamUrl);
        loadFileListStreamIntoVideo(video, flStreamUrl);
        return;
      }

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
          syncVideoDims(video);
          applyInitialSeek();
          ensureAutoPlay(video);
          setStatus('playing');
          onWakeOsd?.();
        };
        return;
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

              const sortedFull = Array.from(bestByHeight.values()).sort(
                (a, b) => b.height - a.height || b.bitrate - a.bitrate
              );
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
        targetUrl.includes('/api/tv-proxy') &&
        forcedAudioIdx >= 0
      ) {
        const cleanBase = targetUrl.replace(/([?&])audioIdx=\d+/g, '');
        const sep = cleanBase.includes('?') ? '&' : '?';
        targetUrl = `${cleanBase}${sep}audioIdx=${forcedAudioIdx}`;
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
      const v = videoRef.current;
      if (v && v.currentTime > 3) {
        startAtSecondsRef.current = Math.floor(v.currentTime);
        appliedStartRef.current = false;
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
    if (startAtSeconds === 0 && prevStart > 0 && video.currentTime > 2) {
      appliedStartRef.current = true;
      setStreamOffsetSec(0);
      if (
        hlsUrl &&
        (hlsUrl.includes('/api/filelist/stream') ||
          hlsUrl.includes('/api/youtube/stream'))
      ) {
        const cleanBase = hlsUrl
          .replace(/([?&])start=\d+/g, '')
          .replace(/([?&])audio=\d+/g, '');
        const sep = cleanBase.includes('?') ? '&' : '?';
        const audioParam = forcedAudioIdx >= 0 ? forcedAudioIdx : 0;
        loadFileListStreamIntoVideo(
          video,
          `${cleanBase}${sep}start=0&audio=${audioParam}`
        );
      } else {
        video.currentTime = 0;
        ensureAutoPlay(video);
      }
    } else if (
      startAtSeconds > 5 &&
      !appliedStartRef.current &&
      Math.abs(video.currentTime + streamOffsetSec - startAtSeconds) > 15
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
    : durationHintSec && durationHintSec > 60
      ? durationHintSec
      : mediaType === 'series'
        ? 3600
        : 7200;
  const isVideoElementEnded = Boolean(videoRef.current?.ended);
  const effectiveDurationSec = (() => {
    if (!hasVerifiedDuration && displayTimeSec >= rawBaseDurationSec - 90 && !isVideoElementEnded) {
      // Expand estimated duration smoothly in 15-min blocks so the scrubber never hits 00:00 while video is still playing
      return Math.max(
        rawBaseDurationSec,
        Math.ceil((displayTimeSec + 600) / 900) * 900
      );
    }
    if (displayTimeSec >= rawBaseDurationSec - 1 && !isVideoElementEnded) {
      return Math.max(rawBaseDurationSec, Math.floor(displayTimeSec) + 60);
    }
    return rawBaseDurationSec;
  })();

  const remainingTimeSec = Math.max(0, effectiveDurationSec - displayTimeSec);

  // Smart Intro & Recap Segments Detection:
  // 1) Exact IntroDB.app + TheIntroDB v2 community consensus timestamps (supports both Recap & Intro in the same episode)
  // 2) Strict Subtitle Theme-Song Marker Fallback (ONLY if explicit [theme music]/[opening theme]/[intro] tags exist; NEVER guesses on silent dialogue scenes)
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
    if (apiNoIntro || !isIntroApiSettled) return [];

    if (subtitleCues && subtitleCues.length >= 15) {
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
        // Find the next non-music spoken cue after firstTheme
        const nextSpoken = subtitleCues.find(
          (c) =>
            c.start > firstTheme.start + 12 &&
            c.start <= firstTheme.start + 105 &&
            !isExplicitThemeMarker(c.text) &&
            !(c.text || '').includes('♪') &&
            !(c.text || '').includes('♫')
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
              toastLabel: '⏭ Intro Omis',
            },
          ];
        }
      }
    }

    return [];
  }, [
    mediaType,
    apiSkipSegments,
    apiNoIntro,
    isIntroApiSettled,
    subtitleCues,
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
    if (!activeSkipSegment) return 100;
    const totalDur = Math.max(
      1,
      activeSkipSegment.endSec - activeSkipSegment.startSec
    );
    const elapsed = Math.max(0, displayTimeSec - activeSkipSegment.startSec);
    return Math.max(0, Math.min(100, 100 - (elapsed / totalDur) * 100));
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

  // Auto-focus "Sari peste Intro / Recapitulare" whenever a segment becomes active and no menu is open
  useEffect(() => {
    if (!isSkipIntroVisible || !activeSkipSegment || openMenu !== 'none') {
      return;
    }
    hasAutoFocusedSkipIntroRef.current = activeSkipSegment.id;
    const focusSkipBtn = () => {
      if (openMenu === 'none') {
        const btn = playerRootRef.current?.querySelector<HTMLButtonElement>(
          '[data-vod-skip-intro-btn="true"]'
        );
        try {
          btn?.focus({ preventScroll: true });
        } catch {
          btn?.focus();
        }
      }
    };
    focusSkipBtn();
    const timer = window.setTimeout(focusSkipBtn, 45);
    return () => window.clearTimeout(timer);
  }, [isSkipIntroVisible, activeSkipSegment?.id, isOsdVisible, openMenu, status]);

  // Smart End-of-Episode / Credits Detection:
  // 1) Exact IntroDB / TheIntroDB credits timestamp (if available)
  // 2) Subtitle end-of-dialogue detection within the last 3.5 minutes (210s)
  // 3) Default 2 minutes (120s) remaining threshold
  const smartOutroRemainingThresholdSec = useMemo(() => {
    if (
      mediaType === 'series' &&
      apiOutroStartSec &&
      effectiveDurationSec > apiOutroStartSec + 15
    ) {
      const remAtApiOutro = effectiveDurationSec - apiOutroStartSec;
      if (remAtApiOutro >= 30 && remAtApiOutro <= 260) {
        return Math.max(120, Math.ceil(remAtApiOutro));
      }
    }
    if (
      mediaType === 'series' &&
      subtitleCues &&
      subtitleCues.length >= 15 &&
      effectiveDurationSec > 300
    ) {
      const cleanCues = subtitleCues.filter((c) => {
        const t = (c.text || '').toLowerCase();
        return (
          !t.includes('opensubtitles') &&
          !t.includes('subtitrare') &&
          !t.includes('traducere') &&
          !t.includes('synced by') &&
          !t.includes('www.')
        );
      });
      const lastCue = cleanCues[cleanCues.length - 1];
      if (lastCue) {
        const remAfterLastCue = effectiveDurationSec - lastCue.end;
        if (remAfterLastCue >= 120 && remAfterLastCue <= 210) {
          return Math.ceil(remAfterLastCue - 2);
        }
      }
    }
    return 120;
  }, [mediaType, apiOutroStartSec, subtitleCues, effectiveDurationSec]);

  // Propose moving to the Next Episode when 2 minutes (or smart credits threshold) remain, and auto-advance when the episode finishes
  useEffect(() => {
    if (
      mediaType !== 'series' ||
      !onNextEpisode ||
      autoNextDismissed ||
      hasTriggeredAutoNextRef.current ||
      (!hasVerifiedDuration && !(durationHintSec && durationHintSec > 180))
    ) {
      return;
    }
    if (
      displayTimeSec > 45 &&
      effectiveDurationSec > 180 &&
      remainingTimeSec <= smartOutroRemainingThresholdSec &&
      remainingTimeSec > 0
    ) {
      if (!showNextEpisodePrompt) {
        setShowNextEpisodePrompt(true);
      }
      if (hasVerifiedDuration && remainingTimeSec <= 2) {
        hasTriggeredAutoNextRef.current = true;
        setShowNextEpisodePrompt(false);
        onNextEpisode();
      }
    } else if (
      remainingTimeSec > smartOutroRemainingThresholdSec + 5 &&
      showNextEpisodePrompt
    ) {
      // User seeked backward away from the end credits
      setShowNextEpisodePrompt(false);
      hasAutoFocusedNextEpRef.current = false;
    }
  }, [
    mediaType,
    onNextEpisode,
    autoNextDismissed,
    hasVerifiedDuration,
    durationHintSec,
    displayTimeSec,
    effectiveDurationSec,
    remainingTimeSec,
    smartOutroRemainingThresholdSec,
    showNextEpisodePrompt,
  ]);

  // Auto-focus the Next Episode button once when it first appears at 2 minutes remaining
  useEffect(() => {
    if (
      !showNextEpisodePrompt ||
      autoNextDismissed ||
      mediaType !== 'series' ||
      !onNextEpisode ||
      hasAutoFocusedNextEpRef.current
    ) {
      return;
    }
    hasAutoFocusedNextEpRef.current = true;
    const timer = window.setTimeout(() => {
      if (openMenu === 'none') {
        const btn = playerRootRef.current?.querySelector<HTMLButtonElement>(
          '[data-vod-autonext-btn="true"]'
        );
        btn?.focus();
      }
    }, 35);
    return () => window.clearTimeout(timer);
  }, [
    showNextEpisodePrompt,
    autoNextDismissed,
    mediaType,
    onNextEpisode,
    openMenu,
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

  const seekToAbsoluteSeconds = (targetSec: number, labelPrefix?: string) => {
    const v = videoRef.current;
    if (!v) return;
    onWakeOsd?.();

    // Live Remuxed FileList Torrent or YouTube Premium Stream seeking via server-side -ss offset
    if (
      hlsUrl &&
      (hlsUrl.includes('/api/filelist/stream') ||
        hlsUrl.includes('/api/youtube/stream'))
    ) {
      const totalDur = effectiveDurationSec;
      const nextSec = Math.max(
        0,
        Math.min(totalDur - 5, Math.floor(targetSec))
      );
      isSeekingFileListRef.current = true;
      appliedStartRef.current = true;
      startAtSecondsRef.current = nextSec;
      streamOffsetRef.current = nextSec;
      setStreamOffsetSec(nextSec);
      setCurrentTimeSec(nextSec);
      setScrubPreviewSec(null);
      onTimeUpdate?.(Math.floor(nextSec), Math.floor(totalDur));

      const cleanBase = hlsUrl
        .replace(/([?&])start=\d+/g, '')
        .replace(/([?&])audio=\d+/g, '');
      const sep = cleanBase.includes('?') ? '&' : '?';
      const audioParam = forcedAudioIdx >= 0 ? forcedAudioIdx : 0;
      if (flSeekDebounceRef.current) {
        window.clearTimeout(flSeekDebounceRef.current);
      }
      flSeekDebounceRef.current = window.setTimeout(() => {
        flSeekDebounceRef.current = null;
        const targetVideo = videoRef.current;
        if (!targetVideo) return;
        loadFileListStreamIntoVideo(
          targetVideo,
          `${cleanBase}${sep}start=${nextSec}&audio=${audioParam}`
        );
      }, 220);

      const remSec = Math.max(0, totalDur - nextSec);
      setSeekToast(
        `${labelPrefix ? `${labelPrefix}  •  ` : ''}${formatSeekTime(nextSec)} / ${formatSeekTime(totalDur)}  (-${formatSeekTime(remSec)})`
      );
      if (seekToastTimerRef.current) {
        window.clearTimeout(seekToastTimerRef.current);
      }
      seekToastTimerRef.current = window.setTimeout(() => {
        setSeekToast(null);
      }, 1500);
      return;
    }

    const totalDur = Number.isFinite(v.duration) && v.duration > 10
      ? v.duration
      : effectiveDurationSec;
    const nextSec = Math.max(0, Math.min(totalDur, targetSec));
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
    setSeekToast(
      `${labelPrefix ? `${labelPrefix}  •  ` : ''}${formatSeekTime(nextSec)} / ${formatSeekTime(totalDur)}  (-${formatSeekTime(remSec)})`
    );
    if (seekToastTimerRef.current) {
      window.clearTimeout(seekToastTimerRef.current);
    }
    seekToastTimerRef.current = window.setTimeout(() => {
      setSeekToast(null);
    }, 1300);
  };

  const triggerSeek = (deltaSec: number) => {
    const v = videoRef.current;
    if (!v) return;
    const currentEff =
      hlsUrl &&
      (hlsUrl.includes('/api/filelist/stream') ||
        hlsUrl.includes('/api/youtube/stream'))
        ? isSeekingFileListRef.current
          ? streamOffsetRef.current
          : streamOffsetRef.current + (v.currentTime || 0)
        : v.currentTime || currentTimeSec;
    const prefix = deltaSec > 0 ? `+${deltaSec}s` : `${deltaSec}s`;
    seekToAbsoluteSeconds(currentEff + deltaSec, prefix);
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
    }, 1100);
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

    if (isFileListStream && (v.ended || isMseClosedEarly || isStalledLong)) {
      lastTimeUpdateWallMsRef.current = now;
      seekToAbsoluteSeconds(currentEff, showToast ? '▶ Reluare' : undefined);
      return;
    }

    if (hlsRef.current && (v.ended || isStalledLong)) {
      lastTimeUpdateWallMsRef.current = now;
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
          seekToAbsoluteSeconds(currentEff, showToast ? '▶ Reluare' : undefined);
        }
      });

    if (showToast) {
      showTransportToast('▶ Redare');
    }
  };

  const resumeOrRecoverPlaybackRef = useRef(resumeOrRecoverPlayback);
  resumeOrRecoverPlaybackRef.current = resumeOrRecoverPlayback;

  // Automatic Stall Watchdog: if the movie freezes mid-playback without user pausing, auto-reconnect at exact second
  useEffect(() => {
    const watchdog = window.setInterval(() => {
      const v = videoRef.current;
      if (
        !v ||
        status !== 'playing' ||
        userIntentionallyPausedRef.current ||
        isSeekingFileListRef.current ||
        remainingTimeSec <= 35
      ) {
        return;
      }
      const now = Date.now();
      const stalledMs = now - lastTimeUpdateWallMsRef.current;
      if (
        stalledMs >= 6500 &&
        now - lastAutoRecoverWallMsRef.current >= 8000
      ) {
        lastAutoRecoverWallMsRef.current = now;
        resumeOrRecoverPlaybackRef.current(v, false);
      }
    }, 2500);
    return () => window.clearInterval(watchdog);
  }, [status, remainingTimeSec]);

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
      showTransportToast('❚❚ Pauză');
    }
  };

  const handleRemotePlayPauseRef = useRef(handleRemotePlayPause);
  handleRemotePlayPauseRef.current = handleRemotePlayPause;

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
        triggerSeekRef.current(-15);
      } else if (act === 'ff') {
        triggerSeekRef.current(15);
      }
    };
    const onMediaKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      const kc = e.keyCode || e.which;
      const k = e.key;

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
        if (v && !v.paused) {
          v.pause();
          setIsPaused(true);
          showTransportToast('❚❚ Pauză');
        }
        onWakeOsd?.();
        return;
      }

      // Rewind << button on Smart TV remotes (412, 227, MediaRewind)
      if (kc === 412 || kc === 227 || k === 'MediaRewind') {
        e.preventDefault();
        e.stopPropagation();
        triggerSeekRef.current(-15);
        return;
      }

      // Fast-Forward >> button on Smart TV remotes (417, 228, MediaFastForward)
      if (kc === 417 || kc === 228 || k === 'MediaFastForward') {
        e.preventDefault();
        e.stopPropagation();
        triggerSeekRef.current(15);
        return;
      }
    };

    // Bind navigator.mediaSession so hardware remote buttons intercepted by Chromium/webOS MediaSession control the video
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('play', () => {
          const v = videoRef.current;
          if (v) {
            v.play().catch(() => {});
            setIsPaused(false);
            showTransportToast('▶ Redare');
          }
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          const v = videoRef.current;
          if (v) {
            v.pause();
            setIsPaused(true);
            showTransportToast('❚❚ Pauză');
          }
        });
        navigator.mediaSession.setActionHandler('seekbackward', () => {
          triggerSeekRef.current(-15);
        });
        navigator.mediaSession.setActionHandler('seekforward', () => {
          triggerSeekRef.current(15);
        });
      } catch {
        // ignore unsupported mediaSession actions
      }
    }

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
      const targetMenu = customEv.detail?.menu;
      if (!targetMenu) return;
      onWakeOsd?.();
      setOpenMenu((prev) => {
        const next = prev === targetMenu ? 'none' : targetMenu;
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
    window.addEventListener('aether:vod-seek', onExternalSeek);
    window.addEventListener('aether:vod-transport', onExternalTransport);
    window.addEventListener('keydown', onMediaKeyDown, true);
    window.addEventListener('aether:vod-close-menu', onCloseMenu);
    window.addEventListener('aether:vod-select-quality', onSelectQualityEv);
    window.addEventListener(
      'aether:vod-open-quality-menu',
      onOpenQualityMenuEv
    );
    window.addEventListener('aether:vod-open-menu', onOpenMenuEv);
    return () => {
      window.removeEventListener('aether:vod-seek', onExternalSeek);
      window.removeEventListener('aether:vod-transport', onExternalTransport);
      window.removeEventListener('keydown', onMediaKeyDown, true);
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
    };
  }, []);

  const playerRootRef = useRef<HTMLDivElement | null>(null);

  const handleToggleVodFullscreen = () => {
    const v = videoRef.current;
    if (v && v.muted && isAutoMuted) {
      v.muted = false;
      v.volume = 1;
      setIsAutoMuted(false);
    }

    const rootTarget =
      (playerRootRef.current?.closest(
        '[data-vod-full-player="true"]'
      ) as HTMLElement | null) || playerRootRef.current;

    if (typeof document !== 'undefined' && document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {});
      window.dispatchEvent(
        new CustomEvent('aether:vod-custom-fullscreen-toggle', {
          detail: { force: false },
        })
      );
      return;
    }

    if (rootTarget && typeof rootTarget.requestFullscreen === 'function') {
      rootTarget
        .requestFullscreen()
        .then(() => {
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
        })
        .catch(() => {
          window.dispatchEvent(
            new CustomEvent('aether:vod-custom-fullscreen-toggle')
          );
        });
      return;
    }

    window.dispatchEvent(
      new CustomEvent('aether:vod-custom-fullscreen-toggle')
    );
  };

  const handleTriggerAirPlay = () => {
    onWakeOsd?.();
    const v = videoRef.current as
      | (HTMLVideoElement & {
          webkitShowPlaybackTargetPicker?: () => void;
          remote?: { prompt?: () => Promise<void> };
        })
      | null;
    if (v && typeof v.webkitShowPlaybackTargetPicker === 'function') {
      try {
        v.webkitShowPlaybackTargetPicker();
        return;
      } catch {
        // fallback below
      }
    }
    if (v?.remote && typeof v.remote.prompt === 'function') {
      v.remote.prompt().catch(() => {
        window.dispatchEvent(new CustomEvent('aether:open-handoff-modal'));
      });
      return;
    }
    window.dispatchEvent(new CustomEvent('aether:open-handoff-modal'));
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
    window.addEventListener('aether:vod-toggle-fullscreen', onToggleFsEv);
    return () => {
      window.removeEventListener('aether:vod-toggle-fullscreen', onToggleFsEv);
    };
  }, []);

  // Keep native <track> hidden during inline playback (so custom HTML subtitle box renders) and enable it automatically inside iOS native fullscreen
  useEffect(() => {
    const v = videoRef.current as
      | (HTMLVideoElement & { webkitDisplayingFullscreen?: boolean })
      | null;
    if (!v) return;
    const syncNativeTrackMode = () => {
      const inIosFs = Boolean(v.webkitDisplayingFullscreen);
      if (v.textTracks) {
        for (let i = 0; i < v.textTracks.length; i++) {
          v.textTracks[i].mode =
            inIosFs && hasActiveSubtitle ? 'showing' : 'hidden';
        }
      }
    };
    const onBeginIosFs = () => {
      if (v.textTracks) {
        for (let i = 0; i < v.textTracks.length; i++) {
          v.textTracks[i].mode = hasActiveSubtitle ? 'showing' : 'disabled';
        }
      }
    };
    const onEndIosFs = () => {
      if (v.textTracks) {
        for (let i = 0; i < v.textTracks.length; i++) {
          v.textTracks[i].mode = 'hidden';
        }
      }
      if (!userIntentionallyPausedRef.current && v.paused) {
        v.play().catch(() => {});
      }
    };
    syncNativeTrackMode();
    v.addEventListener('webkitbeginfullscreen', onBeginIosFs);
    v.addEventListener('webkitendfullscreen', onEndIosFs);
    return () => {
      v.removeEventListener('webkitbeginfullscreen', onBeginIosFs);
      v.removeEventListener('webkitendfullscreen', onEndIosFs);
    };
  }, [subtitleVttUrl, hasActiveSubtitle]);

  // Ensure that whenever the OSD is visible, a button on the OSD has focus so the white highlight is always visible and ready for Left/Right arrows
  useEffect(() => {
    if (!isOsdVisible || openMenu !== 'none') return;
    const timer = window.setTimeout(() => {
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
      if (!isAlreadyFocusedInside) {
        const playBtn = rootEl.querySelector<HTMLButtonElement>(
          '[data-vod-play-btn="true"]'
        );
        playBtn?.focus();
      }
    }, 30);
    return () => window.clearTimeout(timer);
  }, [isOsdVisible, openMenu, status]);

  return (
    <div
      ref={playerRootRef}
      data-vod-open-menu={openMenu}
      className="relative z-10 w-full h-full bg-[#090b10] flex flex-col select-none"
    >
      <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden">
        {/* AMBIENT CINEMA GLOW BACKDROP (Eliminates dead pitch-black 21:9 letterbox bars) */}
        {(backdropUrl || poster) && (
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <img
              src={backdropUrl || poster}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover blur-3xl opacity-55 scale-115 saturate-150"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/45 via-zinc-950/20 to-zinc-950/55" />
          </div>
        )}
        <video
          ref={videoRef}
          playsInline
          autoPlay
          poster={poster}
          onClick={(e) => {
            e.stopPropagation();
            const vid = e.currentTarget;
            if (vid.muted && isAutoMuted) {
              vid.muted = false;
              vid.volume = 1;
              setIsAutoMuted(false);
            }
            if (openMenu !== 'none') {
              setOpenMenu('none');
            } else if (isMobilePhone && isOsdVisible && onHideOsd) {
              onHideOsd();
            } else {
              onWakeOsd?.();
            }
          }}
          onPlay={(e) => {
            setIsPaused(false);
            if (!e.currentTarget.muted && e.currentTarget.volume > 0) {
              setIsAutoMuted(false);
            }
          }}
          onPause={() => setIsPaused(true)}
          onDurationChange={(e) => {
            if (isFileListStream) return;
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 60) {
              setVideoDurationSec(d);
            }
          }}
          onProgress={(e) => {
            const v = e.currentTarget;
            try {
              if (v.buffered && v.buffered.length > 0) {
                const end = v.buffered.end(v.buffered.length - 1);
                setBufferedEndSec(streamOffsetSec + end);
              }
            } catch {
              // ignore
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
              if (
                Math.abs(v.currentTime - clampedTarget) <= 15 &&
                !v.seeking &&
                v.readyState >= 2
              ) {
                appliedStartRef.current = true;
              } else if (Date.now() - lastSeekAttemptMsRef.current >= 900) {
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
            const targetStart = startAtSecondsRef.current;
            const v = e.currentTarget;
            syncVideoDims(v);
            if (
              !appliedStartRef.current &&
              targetStart > 5 &&
              Number.isFinite(v.duration) &&
              v.duration > 10
            ) {
              const clampedTarget = Math.min(
                targetStart,
                Math.max(0, v.duration - 5)
              );
              if (
                Math.abs(v.currentTime - clampedTarget) <= 15 &&
                !v.seeking &&
                v.readyState >= 2
              ) {
                appliedStartRef.current = true;
              } else if (Date.now() - lastSeekAttemptMsRef.current >= 900) {
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
            const targetStart = startAtSecondsRef.current;
            const v = e.currentTarget;
            syncVideoDims(v);
            if (
              !appliedStartRef.current &&
              targetStart > 5 &&
              Number.isFinite(v.duration) &&
              v.duration > 10
            ) {
              const clampedTarget = Math.min(
                targetStart,
                Math.max(0, v.duration - 5)
              );
              if (
                Math.abs(v.currentTime - clampedTarget) <= 15 &&
                !v.seeking &&
                v.readyState >= 2
              ) {
                appliedStartRef.current = true;
              } else if (Date.now() - lastSeekAttemptMsRef.current >= 900) {
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
            onWakeOsd?.();
            if (
              typeof window !== 'undefined' &&
              (document.documentElement.classList.contains('smart-tv-mode') ||
                window.location.pathname.toLowerCase().startsWith('/tv'))
            ) {
              fetch(
                `/api/tv-log?vod=video_playing&d=${v.videoWidth || 0}x${v.videoHeight || 0}`
              ).catch(() => {});
            }
          }}
          onVolumeChange={(e) => {
            if (!e.currentTarget.muted && e.currentTarget.volume > 0) {
              setIsAutoMuted(false);
            }
          }}
          onTimeUpdate={(e) => {
            const vid = e.currentTarget;
            if (!vid.muted && vid.volume > 0 && isAutoMuted) {
              setIsAutoMuted(false);
            }
            const targetStart = startAtSecondsRef.current;
            if (!appliedStartRef.current && targetStart > 5) {
              if (Number.isFinite(vid.duration) && vid.duration > 10) {
                const clampedTarget = Math.min(
                  targetStart,
                  Math.max(0, vid.duration - 5)
                );
                if (
                  Math.abs(vid.currentTime - clampedTarget) <= 15 &&
                  !vid.seeking &&
                  vid.readyState >= 2
                ) {
                  appliedStartRef.current = true;
                } else {
                  if (Date.now() - lastSeekAttemptMsRef.current >= 900) {
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
            }
            if (!isFileListStream && Number.isFinite(vid.duration) && vid.duration > 60) {
              setVideoDurationSec(vid.duration);
            }
            try {
              if (vid.buffered && vid.buffered.length > 0) {
                const end = vid.buffered.end(vid.buffered.length - 1);
                setBufferedEndSec(streamOffsetSec + end);
              }
            } catch {
              // ignore
            }
            const reportedDuration = Math.max(
              effectiveDurationSec,
              Math.floor(effectiveTime) + 30
            );
            setCurrentTimeSec(effectiveTime);
            if (
              effectiveTime > 1 &&
              Number.isFinite(reportedDuration) &&
              reportedDuration > 10
            ) {
              onTimeUpdate?.(
                Math.floor(effectiveTime),
                Math.floor(reportedDuration)
              );
            }
          }}
          onEnded={() => {
            if (
              mediaType === 'series' &&
              onNextEpisode &&
              !autoNextDismissed &&
              !hasTriggeredAutoNextRef.current
            ) {
              hasTriggeredAutoNextRef.current = true;
              setShowNextEpisodePrompt(false);
              onNextEpisode();
            }
          }}
          className="relative z-10 w-full h-full object-contain bg-transparent"
        >
          {subtitleVttUrl && (
            <track
              key={subtitleVttUrl}
              kind="subtitles"
              src={subtitleVttUrl}
              srcLang={preferredSubLang || 'ro'}
              label={subtitleLabel || 'Română'}
              default
            />
          )}
        </video>

        {/* CLEAN FRAMELESS SKIP INTRO / RECAP PILL BUTTON ("Sari peste Recapitulare" / "Sari peste Intro") */}
        {isSkipIntroVisible &&
          activeSkipSegment &&
          !showNextEpisodePrompt && (
            <div
              className={`absolute right-5 sm:right-8 z-40 flex items-center transition-all duration-300 ${
                isOsdVisible || openMenu !== 'none'
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

        {/* CLEAN FRAMELESS NEXT EPISODE PILL BUTTON (PROPOSED WHEN 2 MINUTES REMAIN OR CREDITS START) */}
        {mediaType === 'series' &&
          onNextEpisode &&
          !autoNextDismissed &&
          showNextEpisodePrompt && (
            <div
              className={`absolute right-5 sm:right-8 z-40 flex items-center transition-all duration-300 ${
                isOsdVisible || openMenu !== 'none'
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
                className="h-11 sm:h-12 px-5 sm:px-6 mr-2 rounded-full bg-white hover:bg-zinc-100 text-zinc-950 font-extrabold text-xs sm:text-sm inline-flex items-center shadow-[0_14px_38px_rgba(0,0,0,0.88)] focus:outline-none focus:ring-4 focus:ring-blue-500 focus:scale-105 transition-transform cursor-pointer"
              >
                <SkipForward className="w-4 h-4 fill-current shrink-0 mr-2 text-zinc-950" />
                <span className="text-zinc-950">
                  Următorul Episod · {nextEpisodeLabel || `Ep. ${episode + 1}`}
                </span>
                <span className="ml-2 px-2 py-0.5 rounded-full bg-zinc-900/12 text-zinc-800 font-mono text-[11px] font-bold tabular-nums">
                  -{formatSeekTime(remainingTimeSec)}
                </span>
              </button>

              <button
                type="button"
                title="Ascunde butonul"
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
                ? 'bottom-44 sm:bottom-48'
                : 'bottom-14 sm:bottom-16'
            }`}
          >
            <div
              className={`max-w-4xl rounded-2xl bg-black/80 text-white text-center font-extrabold leading-snug whitespace-pre-line shadow-2xl border border-white/10 ${subFontClass}`}
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
              className="absolute top-14 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 shadow-2xl cursor-pointer"
            >
              <VolumeX className="w-4 h-4" />
              <span>Sunet oprit de browser — Apasă pentru Sunet</span>
            </button>
          )}

        {status === 'loading' && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-2 bg-black/60">
            <Loader2 className="w-9 h-9 text-zinc-300 animate-spin" />
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

        {/* APPLE macOS TAHOE LIQUID GLASS FLOATING BOTTOM DOCK */}
        <div
          data-vod-bottom-dock="true"
          onClick={(e) => e.stopPropagation()}
          className={`absolute ${
            isMobilePhone
              ? 'inset-x-2 bottom-2 rounded-2xl px-3 py-2 gap-1.5'
              : 'inset-x-2 sm:inset-x-8 bottom-2 sm:bottom-6 rounded-2xl sm:rounded-[28px] px-3 sm:px-6 py-2 sm:py-4 gap-1.5 sm:gap-3'
          } z-30 overflow-visible tahoe-emerald-osd flex flex-col transition-all duration-300 ${
            isOsdVisible || openMenu !== 'none'
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
        >
          {/* ROW 1: POSTER & TITLE + APPLE LIQUID GLASS TIMELINE SCRUBBER */}
          <div
            className={`w-full flex items-center ${
              isMobilePhone ? 'gap-2 mb-0.5' : 'gap-2 sm:gap-5 mb-0.5 sm:mb-4'
            }`}
          >
            {/* Clean Apple TV+ Large Pop-Out Poster & Title + Episode Name (Desktop & Smart TV only) */}
            {!isMobilePhone && (poster || title) && (
              <div className="hidden sm:flex items-center gap-4 pr-6 mr-2 shrink-0 max-w-[540px] overflow-visible">
                {poster ? (
                  <div className="relative w-20 h-28 sm:w-24 sm:h-36 -mt-12 sm:-mt-16 mr-4 sm:mr-5 mb-1 rounded-2xl overflow-hidden border border-white/25 shadow-[0_22px_54px_rgba(0,0,0,0.9)] shrink-0 bg-zinc-900">
                    <img
                      src={poster}
                      alt={title || ''}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex flex-col justify-center gap-1 py-1">
                  <div className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white truncate leading-tight tracking-tight drop-shadow mb-1">
                    {title || 'În redare'}
                  </div>
                  <div className="flex items-center gap-2 min-w-0 text-sm sm:text-base font-semibold text-white/90">
                    {mediaType === 'series' && (
                      <>
                        <span className="text-white font-bold shrink-0 mr-2">
                          S{season} · E{episode}
                        </span>
                        <span className="text-white/40 mr-2">•</span>
                      </>
                    )}
                    <span className="truncate text-white/85">
                      {subtitle ||
                        (mediaType === 'series'
                          ? `Episodul ${episode}`
                          : 'Cinema 4K')}
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
                if (rect.width > 0) {
                  const ratio = Math.min(
                    1,
                    Math.max(0, (e.clientX - rect.left) / rect.width)
                  );
                  setScrubPreviewSec(Math.floor(ratio * effectiveDurationSec));
                }
              }}
              onPointerMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                if (rect.width <= 0) return;
                const ratio = Math.min(
                  1,
                  Math.max(0, (e.clientX - rect.left) / rect.width)
                );
                const targetSec = Math.floor(ratio * effectiveDurationSec);
                if (e.buttons === 1 || e.currentTarget.hasPointerCapture?.(e.pointerId)) {
                  setScrubPreviewSec(targetSec);
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
                if (rect.width > 0) {
                  const ratio = Math.min(
                    1,
                    Math.max(0, (e.clientX - rect.left) / rect.width)
                  );
                  seekToAbsoluteSeconds(
                    Math.floor(ratio * effectiveDurationSec)
                  );
                }
              }}
              onMouseLeave={() => setHoverPreview(null)}
              onClick={(e) => {
                // Keyboard Enter/OK fallback when clientX === 0
                if (e.clientX === 0) {
                  triggerSeek(15);
                }
              }}
              className="relative flex-1 h-7 flex items-center group cursor-pointer bg-transparent focus:outline-none"
            >
              {/* Floating Liquid Glass Scrub Preview Bubble */}
              {(hoverPreview !== null || scrubPreviewSec !== null) && (
                <div
                  style={{
                    left: `${
                      scrubPreviewSec !== null
                        ? (scrubPreviewSec / Math.max(1, effectiveDurationSec)) * 100
                        : hoverPreview?.pct ?? progressPct
                    }%`,
                  }}
                  className="pointer-events-none absolute -top-9 -translate-x-1/2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-2xl border border-white/25 text-white text-xs font-semibold tabular-nums whitespace-nowrap shadow-xl z-40"
                >
                  {formatSeekTime(
                    scrubPreviewSec !== null
                      ? scrubPreviewSec
                      : hoverPreview?.sec ?? displayTimeSec
                  )}
                </div>
              )}

              {/* Slim Apple Liquid Glass Track (expands smoothly on hover/focus) */}
              <div className="relative w-full h-1.5 group-hover:h-2.5 group-focus:h-2.5 rounded-full bg-white/20 backdrop-blur-md overflow-hidden transition-all duration-200 group-focus:ring-2 group-focus:ring-white/60">
                {/* Buffered Range */}
                <div
                  style={{ width: `${bufferedPct}%` }}
                  className="absolute inset-y-0 left-0 bg-white/25 rounded-full transition-all"
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
                        className="pointer-events-none absolute inset-y-0 bg-[#3b82f6]/80 rounded-full z-10"
                      />
                    );
                  })}
                {/* Luminous White Progress Fill */}
                <div
                  style={{
                    width: `${
                      scrubPreviewSec !== null
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
                  className="absolute inset-y-0 left-0 bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.7)]"
                />
              </div>

              {/* Refined Apple Playhead Thumb */}
              <div
                style={{
                  left: `calc(${
                    scrubPreviewSec !== null
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
                className="pointer-events-none absolute w-3.5 h-3.5 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.55)] scale-90 group-hover:scale-125 group-focus:scale-125 transition-transform duration-150"
              />
            </button>

            {/* Remaining Time (Clean SF Tabular Nums, No Box) */}
            <span
              className="text-[11px] sm:text-xs font-medium text-white/65 tabular-nums shrink-0 w-12 sm:w-14 ml-1.5 sm:ml-3"
              title={`Durată totală: ${formatSeekTime(effectiveDurationSec)}`}
            >
              -{formatSeekTime(remainingTimeSec)}
            </span>

            {/* Subtle Torrent Speed Pill (only if active) */}
            {torrentLiveStats && (
              <div
                title={`Sursă Torrent: ${torrentLiveStats.source}`}
                className="hidden lg:inline-flex px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white/80 text-[11px] font-medium tabular-nums shrink-0 items-center gap-1.5"
              >
                <span>⬇ {torrentLiveStats.downloadSpeedText}</span>
              </div>
            )}
          </div>

          {/* ROW 2: APPLE LIQUID GLASS TRANSPORT CONTROLS (LEFT) + AUDIO / SERVER / SUBTITLES / QUALITY (RIGHT) */}
          <div
            data-vod-bottom-row="true"
            className={`w-full flex items-center justify-between ${
              isMobilePhone
                ? 'flex-nowrap gap-1'
                : 'flex-nowrap sm:flex-wrap gap-1 sm:gap-2'
            }`}
          >
            {/* Left Transport & Episode Controls */}
            <div
              className={`flex items-center shrink-0 ${
                isMobilePhone
                  ? 'flex-nowrap gap-1'
                  : 'flex-nowrap sm:flex-wrap gap-1 sm:gap-2'
              }`}
            >
              <button
                type="button"
                data-vod-play-btn="true"
                onFocus={() => onWakeOsd?.()}
                onClick={() => {
                  handleRemotePlayPause('toggle');
                }}
                className={`${
                  isMobilePhone
                    ? 'h-8 w-8 justify-center'
                    : 'h-8 w-8 sm:h-9 sm:w-auto sm:px-4 justify-center sm:justify-start'
                } rounded-full tahoe-emerald-card hover:bg-white/20 text-white/95 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 shadow-md focus:outline-none focus:bg-white focus:text-zinc-950 shrink-0 cursor-pointer`}
              >
                {isPaused ? (
                  <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                ) : (
                  <Pause className="w-3.5 h-3.5 fill-current shrink-0" />
                )}
                {!isMobilePhone && (
                  <span className="hidden sm:inline">
                    {isPaused ? 'Redare' : 'Pauză'}
                  </span>
                )}
              </button>

              {!isMobilePhone && (
                <button
                  type="button"
                  data-vod-seek-back-15="true"
                  onFocus={() => onWakeOsd?.()}
                  onClick={() => triggerSeek(-15)}
                  title="Înapoi cu 15 secunde (-15s)"
                  className="h-8 sm:h-9 px-2 sm:px-3.5 text-[11px] sm:text-xs gap-1 sm:gap-1.5 rounded-full tahoe-emerald-card hover:bg-white/20 text-white/95 font-medium inline-flex items-center transition-all focus:outline-none focus:bg-white focus:text-zinc-950 shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                  <span>15s</span>
                </button>
              )}

              {!isMobilePhone && (
                <button
                  type="button"
                  data-vod-seek-fwd-15="true"
                  onFocus={() => onWakeOsd?.()}
                  onClick={() => triggerSeek(15)}
                  title="Înainte cu 15 secunde (+15s)"
                  className="h-8 sm:h-9 px-2 sm:px-3.5 text-[11px] sm:text-xs gap-1 sm:gap-1.5 rounded-full tahoe-emerald-card hover:bg-white/20 text-white/95 font-medium inline-flex items-center transition-all focus:outline-none focus:bg-white focus:text-zinc-950 shrink-0 cursor-pointer"
                >
                  <RotateCw className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                  <span>+15s</span>
                </button>
              )}

              {!isMobilePhone && (
                <button
                  type="button"
                  data-vod-seek-fwd-60="true"
                  onFocus={() => onWakeOsd?.()}
                  onClick={() => triggerSeek(60)}
                  title="Înainte cu 1 minut (+1 min)"
                  className="hidden sm:inline-flex h-9 px-3.5 rounded-full tahoe-emerald-card hover:bg-white/20 text-white/95 text-xs font-medium items-center gap-1.5 transition-all focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
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
                  className="hidden sm:inline-flex h-9 px-3.5 rounded-full tahoe-emerald-card hover:bg-white/20 text-white/95 text-xs font-medium items-center gap-1.5 transition-all focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
                >
                  <SkipBack className="w-3.5 h-3.5 shrink-0" />
                  <span>{prevEpisodeLabel || 'Ep. Prec.'}</span>
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
                  className="hidden sm:inline-flex h-9 px-3.5 rounded-full tahoe-emerald-card hover:bg-white/20 text-white/95 text-xs font-medium items-center gap-1.5 transition-all focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
                >
                  <span>{nextEpisodeLabel || 'Ep. Urm.'}</span>
                  <SkipForward className="w-3.5 h-3.5 shrink-0" />
                </button>
              )}

              {mediaType === 'series' && onOpenEpisodesDrawer && (
                <button
                  type="button"
                  data-vod-bottom-episodes-btn="true"
                  onFocus={() => onWakeOsd?.()}
                  onClick={() => {
                    onWakeOsd?.();
                    onOpenEpisodesDrawer();
                  }}
                  title="Lista de sezoane și episoade (Apasă Jos de 2 ori sau Butonul Roșu)"
                  className={`${
                    isMobilePhone
                      ? 'h-8 px-2 text-[11px] gap-1'
                      : 'h-8 sm:h-9 px-2 sm:px-3.5 text-[11px] sm:text-xs gap-1 sm:gap-1.5'
                  } rounded-full tahoe-emerald-card hover:bg-white/20 text-white/95 font-medium inline-flex items-center transition-all focus:outline-none focus:bg-white focus:text-zinc-950 shrink-0 cursor-pointer`}
                >
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] shrink-0" />
                  {isMobilePhone ? (
                    <span>Ep.</span>
                  ) : (
                    <>
                      <span className="sm:hidden">Ep.</span>
                      <span className="hidden sm:inline">Episoade</span>
                      <span className="hidden sm:inline text-white/60 text-[11px] ml-1">
                        S{season}·E{episode} (⬇×2)
                      </span>
                    </>
                  )}
                </button>
              )}

              {!isMobilePhone && onOpenInfoSheet && (
                <button
                  type="button"
                  data-vod-bottom-info-btn="true"
                  onFocus={() => onWakeOsd?.()}
                  onClick={() => {
                    onWakeOsd?.();
                    setOpenMenu('none');
                    onOpenInfoSheet();
                  }}
                  title="Descrierea Filmului / Serialului cu Poză și Actori (Butonul Galben)"
                  className="hidden sm:inline-flex h-9 px-3.5 rounded-full tahoe-emerald-card hover:bg-white/20 text-white/95 text-xs font-medium items-center gap-1.5 transition-all focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.95)] shrink-0 mr-1" />
                  <span>
                    {mediaType === 'series' ? 'Descriere Serial' : 'Descriere Film'}
                  </span>
                </button>
              )}
            </div>

            {/* Right Apple Liquid Glass Controls (Audio, Server, Subtitles, Resolution + Mobile Fullscreen) */}
            <div
              className={`flex items-center justify-end shrink-0 ${
                isMobilePhone
                  ? 'flex-nowrap gap-1'
                  : 'flex-nowrap sm:flex-wrap gap-1 sm:gap-2'
              }`}
            >
              {/* 1. Audio Track Pill (Blue Remote Button) */}
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
                    className={`${
                      isMobilePhone
                        ? 'h-8 px-2 text-[11px] gap-1'
                        : 'h-8 sm:h-9 px-2 sm:px-3.5 text-[11px] sm:text-xs gap-1 sm:gap-2'
                    } rounded-full font-medium inline-flex items-center transition-all focus:outline-none focus:bg-white focus:text-zinc-950 shrink-0 cursor-pointer ${
                      openMenu === 'audio'
                        ? 'bg-white text-zinc-950 font-semibold shadow-md'
                        : 'tahoe-emerald-card hover:bg-white/20 text-white/95'
                    }`}
                  >
                    <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.95)] shrink-0" />
                    {isMobilePhone ? (
                      <span>Audio</span>
                    ) : (
                      <>
                        <Languages className="hidden sm:block w-3.5 h-3.5 shrink-0 opacity-80" />
                        <span className="sm:hidden">Audio</span>
                        <span className="hidden sm:inline max-w-[130px] truncate">
                          {audioTracks.find((t) => t.id === activeAudioTrack)
                            ?.name ||
                            audioTracks[forcedAudioIdx]?.name ||
                            'Pistă Audio'}
                        </span>
                      </>
                    )}
                  </button>

                  {openMenu === 'audio' && (
                    <div
                      data-vod-menu-popover="true"
                      className={`${
                        isMobilePhone
                          ? 'fixed inset-x-3 bottom-20 w-auto max-h-[65dvh]'
                          : 'max-sm:fixed max-sm:inset-x-3 max-sm:bottom-32 max-sm:w-auto sm:absolute sm:right-0 sm:bottom-full sm:mb-3 sm:w-64 max-h-72'
                      } overflow-y-auto rounded-2xl tahoe-emerald-osd p-2.5 shadow-2xl space-y-1 z-50`}
                    >
                      <div className="px-3 py-1 text-[11px] font-semibold text-white/60 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-400 inline-block shrink-0" />
                        <span>Pistă Audio</span>
                      </div>
                      {audioTracks.map((trk, idx) => {
                        const active =
                          trk.id === activeAudioTrack || idx === forcedAudioIdx;
                        return (
                          <button
                            key={`${trk.id}_${idx}`}
                            type="button"
                            data-audio-track-opt="true"
                            data-audio-track-active={active ? 'true' : undefined}
                            onClick={() => {
                              const v = videoRef.current;
                              if (v && v.currentTime > 3) {
                                startAtSecondsRef.current = Math.floor(
                                  v.currentTime
                                );
                                appliedStartRef.current = false;
                              }
                              setActiveAudioTrack(trk.id);
                              setForcedAudioIdx(idx);
                              saveActiveProfileMediaPrefs({
                                defaultAudioPref: inferAudioPrefFromTrackName(
                                  trk.name
                                ),
                              });
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
                            className={`w-full px-3 py-2 rounded-xl text-left text-xs font-medium flex items-center justify-between gap-2 transition-colors focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer ${
                              active
                                ? 'bg-white text-zinc-950 font-semibold'
                                : 'text-white/90 hover:bg-white/15'
                            }`}
                          >
                            <span className="truncate">{trk.name}</span>
                            {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                          </button>
                        );
                      })}
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
                  className={`${
                    isMobilePhone
                      ? 'h-8 px-2 text-[11px] gap-1'
                      : 'h-8 sm:h-9 px-2 sm:px-3.5 text-[11px] sm:text-xs gap-1 sm:gap-2'
                  } rounded-full tahoe-emerald-card hover:bg-white/20 text-white/95 font-medium inline-flex items-center transition-all focus:outline-none focus:bg-white focus:text-zinc-950 shrink-0 cursor-pointer`}
                >
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.95)] shrink-0" />
                  {isMobilePhone ? (
                    <span>Audio</span>
                  ) : (
                    <>
                      <Languages className="hidden sm:block w-3.5 h-3.5 shrink-0 opacity-80" />
                      <span className="sm:hidden">Audio</span>
                      <span className="hidden sm:inline">Pistă Audio</span>
                    </>
                  )}
                </button>
              ) : null}

              {/* 1B. Video Source / Server Pill (Desktop & Smart TV only) */}
              {!isMobilePhone && serverOptions.length > 0 && onSelectServer && (
                <div className="hidden sm:block relative">
                  <button
                    type="button"
                    data-vod-primary-server-btn="true"
                    onFocus={() => onWakeOsd?.()}
                    onClick={(e) => {
                      const next = openMenu === 'server' ? 'none' : 'server';
                      setOpenMenu(next);
                      if (next === 'server') {
                        const container = e.currentTarget.parentElement;
                        window.setTimeout(() => {
                          const activeBtn =
                            container?.querySelector<HTMLButtonElement>(
                              '[data-server-opt-active="true"]'
                            ) ||
                            container?.querySelector<HTMLButtonElement>(
                              '[data-server-opt="true"]'
                            );
                          activeBtn?.focus();
                        }, 40);
                      }
                    }}
                    className={`h-9 max-sm:h-8 px-3.5 max-sm:px-2.5 rounded-full text-xs max-sm:text-[11px] font-medium inline-flex items-center gap-2 max-sm:gap-1 transition-all focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer ${
                      openMenu === 'server'
                        ? 'bg-white text-zinc-950 font-semibold shadow-md'
                        : 'tahoe-emerald-card hover:bg-white/20 text-white/95'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 max-sm:w-3 max-sm:h-3 shrink-0 opacity-80" />
                    <span className="max-w-[120px] max-sm:max-w-[72px] truncate">
                      {(
                        serverOptions
                          .find((s) => s.id === activeServerId)
                          ?.label.split(':')[0] || 'S1'
                      ).replace(/^[^\w\d\s]+\s*/, '')}
                    </span>
                  </button>

                  {openMenu === 'server' && (
                    <div
                      data-vod-menu-popover="true"
                      className="max-sm:fixed max-sm:inset-x-3 max-sm:bottom-32 max-sm:w-auto sm:absolute sm:right-0 sm:bottom-full sm:mb-3 sm:w-72 max-h-72 overflow-y-auto rounded-2xl tahoe-emerald-osd p-2.5 shadow-2xl space-y-1 z-50"
                    >
                      <div className="px-3 py-1 text-[11px] font-semibold text-white/60">
                        Sursă Video
                      </div>
                      {serverOptions.map((srv) => {
                        const active = srv.id === activeServerId;
                        return (
                          <button
                            key={srv.id}
                            type="button"
                            data-server-opt="true"
                            data-server-opt-active={active ? 'true' : undefined}
                            onClick={() => {
                              onSelectServer(srv.id);
                              setOpenMenu('none');
                            }}
                            className={`w-full px-3 py-2 rounded-xl text-left text-xs font-medium flex items-center justify-between gap-2 transition-colors focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer ${
                              active
                                ? 'bg-white text-zinc-950 font-semibold'
                                : 'text-white/90 hover:bg-white/15'
                            }`}
                          >
                            <span className="truncate">
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

              {/* 2. Subtitles Pill (Green Remote Button — All Size & Sync Controls Inside Popover) */}
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
                    className={`${
                      isMobilePhone
                        ? 'h-8 px-2 text-[11px] gap-1'
                        : 'h-8 sm:h-9 px-2 sm:px-3.5 text-[11px] sm:text-xs gap-1 sm:gap-2'
                    } rounded-full font-medium inline-flex items-center transition-all focus:outline-none focus:bg-white focus:text-zinc-950 shrink-0 cursor-pointer ${
                      openMenu === 'subtitles'
                        ? 'bg-white text-zinc-950 font-semibold shadow-md'
                        : hasActiveSubtitle
                          ? 'bg-white/25 border border-white/30 text-white font-semibold'
                          : 'tahoe-emerald-card hover:bg-white/20 text-white/95'
                    }`}
                  >
                    <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.95)] shrink-0" />
                    {isMobilePhone ? (
                      <span>Sub</span>
                    ) : (
                      <>
                        <Subtitles className="hidden sm:block w-3.5 h-3.5 shrink-0 opacity-85" />
                        <span className="sm:hidden">Sub</span>
                        <span className="hidden sm:inline max-w-[140px] truncate">
                          {hasActiveSubtitle
                            ? `${subtitleLabel || 'Subtitrări'}${
                                subOffsetSec !== 0
                                  ? ` (${subOffsetSec > 0 ? `+${subOffsetSec.toFixed(1)}s` : `${subOffsetSec.toFixed(1)}s`})`
                                  : ''
                              }`
                            : 'Subtitrări'}
                        </span>
                      </>
                    )}
                  </button>

                  {openMenu === 'subtitles' && (
                    <div
                      data-vod-menu-popover="true"
                      className={`${
                        isMobilePhone
                          ? 'fixed inset-x-3 bottom-20 w-auto max-h-[68dvh]'
                          : 'max-sm:fixed max-sm:inset-x-3 max-sm:bottom-32 max-sm:w-auto sm:absolute sm:right-0 sm:bottom-full sm:mb-3 sm:w-[340px] max-h-[70vh] sm:max-h-[78vh]'
                      } overflow-y-auto rounded-2xl tahoe-emerald-osd p-3 shadow-2xl space-y-2 z-50`}
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
                            saveActiveProfileMediaPrefs({
                              defaultSubLang: 'off',
                            });
                            onClearSubtitle?.();
                            setOpenMenu('none');
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-all focus:outline-none focus:bg-white focus:text-zinc-950 focus:ring-2 focus:ring-white cursor-pointer ${
                            !hasActiveSubtitle
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
                                        className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 transition-all focus:outline-none focus:bg-white focus:text-zinc-950 focus:ring-2 focus:ring-white focus:scale-105 cursor-pointer ${
                                          isSelected
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
                              updateSubFontPx(24);
                              showTransportToast('Mărime subtitrare: 24px');
                            }}
                            className="py-1.5 rounded-full bg-white/12 hover:bg-white/20 text-white/90 text-xs font-medium transition-all focus:outline-none focus:bg-white focus:text-zinc-950 focus:ring-2 focus:ring-white focus:scale-[1.03] cursor-pointer"
                          >
                            Reset (24px)
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
                              className={`py-1.5 rounded-full text-xs font-semibold transition-all focus:outline-none focus:bg-white focus:text-zinc-950 focus:ring-2 focus:ring-white focus:scale-[1.03] cursor-pointer ${
                                subFontSize === sz.id
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
                          className="grid grid-cols-3 gap-1.5"
                        >
                          <button
                            type="button"
                            onFocus={() => onWakeOsd?.()}
                            onClick={() => {
                              setSubOffsetSec((s) => {
                                const next = Number((s - 0.5).toFixed(1));
                                showTransportToast(
                                  `Sincronizare subtitrare: ${next > 0 ? `+${next}s` : `${next}s`}`
                                );
                                return next;
                              });
                            }}
                            className="py-1.5 rounded-full bg-white/12 hover:bg-white/20 text-white text-xs tabular-nums font-semibold transition-all focus:outline-none focus:bg-white focus:text-zinc-950 focus:ring-2 focus:ring-white focus:scale-[1.03] cursor-pointer"
                          >
                            -0.5s
                          </button>
                          <button
                            type="button"
                            onFocus={() => onWakeOsd?.()}
                            onClick={() => {
                              setSubOffsetSec(0);
                              showTransportToast('Sincronizare subtitrare: 0s');
                            }}
                            className="py-1.5 rounded-full bg-white/12 hover:bg-white/20 text-white/90 text-xs font-medium transition-all focus:outline-none focus:bg-white focus:text-zinc-950 focus:ring-2 focus:ring-white focus:scale-[1.03] cursor-pointer"
                          >
                            Reset 0s
                          </button>
                          <button
                            type="button"
                            onFocus={() => onWakeOsd?.()}
                            onClick={() => {
                              setSubOffsetSec((s) => {
                                const next = Number((s + 0.5).toFixed(1));
                                showTransportToast(
                                  `Sincronizare subtitrare: ${next > 0 ? `+${next}s` : `${next}s`}`
                                );
                                return next;
                              });
                            }}
                            className="py-1.5 rounded-full bg-white/12 hover:bg-white/20 text-white text-xs tabular-nums font-semibold transition-all focus:outline-none focus:bg-white focus:text-zinc-950 focus:ring-2 focus:ring-white focus:scale-[1.03] cursor-pointer"
                          >
                            +0.5s
                          </button>
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

              {/* 3. Video Quality / Resolution Pill (Desktop & Smart TV only) */}
              {!isMobilePhone && (
                <div className="hidden sm:block relative">
                  <button
                    ref={qualityBtnRef}
                    type="button"
                    data-vod-primary-quality-btn="true"
                    onFocus={() => onWakeOsd?.()}
                    onClick={(e) => {
                      const next = openMenu === 'quality' ? 'none' : 'quality';
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
                    className={`h-9 max-sm:h-8 px-3.5 max-sm:px-2.5 rounded-full text-xs max-sm:text-[11px] font-medium inline-flex items-center gap-2 max-sm:gap-1 transition-all focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer ${
                      openMenu === 'quality'
                        ? 'bg-white text-zinc-950 font-semibold shadow-md'
                        : 'tahoe-emerald-card hover:bg-white/20 text-white/95'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 max-sm:w-3 max-sm:h-3 shrink-0 opacity-80" />
                    <span>
                      {activeQuality === -1 && qualityLevels.length > 1
                        ? `Auto · ${resolutionReport.badgeLabel}`
                        : resolutionReport.badgeLabel}
                    </span>
                  </button>

                  {openMenu === 'quality' && (
                    <div
                      data-vod-menu-popover="true"
                      className="max-sm:fixed max-sm:inset-x-3 max-sm:bottom-32 max-sm:w-auto sm:absolute sm:right-0 sm:bottom-full sm:mb-3 sm:w-72 max-h-[70vh] overflow-y-auto rounded-2xl tahoe-emerald-osd p-3 shadow-2xl space-y-2 z-50"
                    >
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-semibold text-white/70">
                          Calitate Video
                        </span>
                        <button
                          type="button"
                          onClick={() => setOpenMenu('none')}
                          className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-white/80 inline-flex items-center justify-center focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* 1. Native Stream Resolutions (HLS / DASH Levels) */}
                      {qualityLevels.length > 0 && (
                        <div className="space-y-1">
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
                                className={`w-full px-3 py-2 rounded-xl text-left text-xs font-medium flex items-center justify-between gap-2 transition-colors focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer ${
                                  active
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
                              className={`w-full px-3 py-2 rounded-xl text-left text-xs font-medium flex items-center justify-between gap-2 transition-colors focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer ${
                                activeQuality === -1
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

                      {/* 2. External Source Resolution Variants */}
                      {externalQualityOptions.length > 0 && (
                        <div className="space-y-1 pt-1.5 border-t border-white/10">
                          <div className="px-2 py-0.5 text-[11px] font-medium text-white/60">
                            Sursă ({externalQualityOptions.length})
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
                              className={`w-full px-3 py-2 rounded-xl text-left text-xs font-medium flex items-center justify-between gap-2 transition-colors focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer ${
                                opt.active
                                  ? 'bg-white text-zinc-950 font-semibold'
                                  : 'text-white/90 hover:bg-white/15'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="truncate">{opt.label}</span>
                                  {opt.badge && (
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                        opt.active
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
                    </div>
                  )}
                </div>
              )}

              {/* 4. Mobile & iPad Only: AirPlay Icon Button + Fullscreen Icon Button */}
              {isMobilePhone && (
                <>
                  <button
                    type="button"
                    onClick={handleTriggerAirPlay}
                    title="AirPlay / Redare pe TV"
                    aria-label="AirPlay / Redare pe TV"
                    className="h-8 w-8 rounded-full tahoe-emerald-card hover:bg-white/20 text-white/95 inline-flex items-center justify-center shrink-0 shadow-md cursor-pointer"
                  >
                    <Airplay className="w-3.5 h-3.5 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleVodFullscreen}
                    title="Ecran Complet"
                    aria-label="Ecran Complet"
                    className="h-8 w-8 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white inline-flex items-center justify-center shrink-0 shadow-md cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
