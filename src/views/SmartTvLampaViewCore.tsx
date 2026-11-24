import { createPortal } from 'react-dom';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Home,
  Clapperboard,
  Star,
  Smile,
  SlidersHorizontal,
  Bookmark,
  Folder,
  ChevronLeft,
  Menu,
  Bell,
  Settings,
  User,
  RefreshCw,
  Film,
  Tv,
  Radio,
  Search,
  Clock,
  Heart,
  Play,
  RotateCcw,
  RotateCw,
  ArrowLeft,
  Maximize2,
  Minimize2,
  ExternalLink,
  Monitor,
  Loader2,
  Sparkles,
  Volume2,
  VolumeX,
  Pause,
  SkipBack,
  SkipForward,
  Music,
  Disc,
  Delete,
  Layers,
  Users,
  X,
  Languages,
  Globe,
  Trash2,
  ShieldAlert,
  Flame,
  Calendar,
  Sun,
  Moon,
  ArrowDownToLine,
  Download,
  Check,
  CheckCircle2,
  ChevronDown,
  HardDriveDownload,
  Airplay,
  Car,
  PictureInPicture2,
} from 'lucide-react';
import {
  clearAllOfflineMusic,
  formatOfflineMusicBytes,
  isTrackOfflineSync,
  resolveOfflineMusicObjectUrl,
  useOfflineMusicState,
} from '../services/offlineMusicService';
import {
  buildDirectFullAudioUrl,
  canUseResidentialDirectAudio,
  pauseYoutubeMusicTrack,
  playYoutubeMusicTrack,
  prewarmNextMusicTrack,
  prewarmYoutubeMusicEngine,
  resumeYoutubeMusicTrack,
  seekYoutubeMusicTrack,
  setYoutubeMusicVolume,
  stopYoutubeMusicTrack,
} from '../services/musicStreamEngine';
import { OfflineDownloadedBadgeIcon } from '../components/tv/spotifyMusicPremiumViews';
import {
  downloadHlsToOfflineDb,
  listOfflineItems,
  deleteOfflineItem,
  exportOfflineItemToDeviceFile,
  formatBytes,
  useOfflineVideoDownloadState,
  enqueueOfflineVideoDownloadJob,
  cancelActiveOfflineVideoDownload,
  clearOfflineVideoDownloadError,
  type OfflineMediaItem,
} from '../services/offlineMediaService';
import {
  resolveKlubnichkaDirectStream,
  fetchKlubnichkaCatalog,
  type KlubnichkaVideoCard,
} from '../services/klubnichkaService';
import {
  persistedKlubCache,
  mapKlubCardToCinemetaItem,
} from '../components/tv/SmartTvKlubnichkaSection';
import { HeaderWeatherWidget } from '../components/tv/HeaderWeatherWidget';
import {
  SfCaptionsBubbleIcon,
  SfInfoIcon,
  SfSpeakerWaveIcon,
  SfVideoCameraIcon,
  SfAirPlayIcon,
  SfBookmarkIcon,
  SfRestartIcon,
  SfTrashIcon,
} from '../components/common/AppleSfIcons';
import { useRadioStore } from '../store/useRadioStore';
import {
  claimMediaSession,
  releaseMediaSession,
  updateMediaSessionPlaybackState,
  updateMediaSessionPosition,
  isAutomotiveWidescreenMode,
  setAutomotiveWidescreenMode,
  acquirePlaybackWakeLock,
  releasePlaybackWakeLock,
  ensureNativeDocumentFullscreen,
  exitNativeDocumentFullscreen,
  isNativeDocumentFullscreen,
  isMobilePhoneDevice,
} from '../utils/mediaSessionManager';
import {
  StreamingPlatformLogo,
  PlatformLogoId,
  ProducerStudioLogoBadge,
  ProducerStudioItem,
  ResolvedVodProviderAndStudios,
  detectStreamingPlatformFromTexts,
  lookupPlatformByImdbId,
  preloadAllPlatformCatalogIds,
  registerPlatformCatalogItems,
  fetchVodProviderAndStudiosByImdb,
  getDefaultStudioForPlatform,
} from '../components/common/StreamingPlatformLogo';
import {
  fetchTvChannelsByCountry,
  fetchAdultTvChannels,
  isAdultTvChannel,
} from '../services/tvApi';
import {
  useEpgRevision,
  resolveChannelEpg,
  getEpgTimingStats,
  fetchEpgForCountry,
} from '../services/epgService';
import { fetchStationsByCountry } from '../services/radioBrowserApi';
import { TvChannel, Station } from '../types/radio';
import { StationAvatar } from '../components/common/StationAvatar';
import { SmartCinemaLogo } from '../components/common/SmartCinemaLogo';
import { resolveDisplayTrack } from '../utils/cleanTrackMetadata';
import { getCountryFlagEmoji } from '../services/geoLanguageService';
import {
  SubtitleCue,
  AudioTrackPreference,
  fetchOnlineSubtitlesByImdb,
  downloadSubtitleAsVttBlobUrl,
  findExplicitOriginalAudioTrackIndex,
  resolveAudioTrackIndexByPreference,
  autoResolveAndFetchBestRoRuSubtitle,
  isRussianAudioDubLabel,
  filterDisplayAudioItems,
} from '../services/subtitleSearchService';
import { resolveDirectVodStreamClient } from '../services/vodStreamClient';
import {
  VodNativeHlsPlayer,
  TvPreferredQuality,
  TvSubFontSize,
  VodResolutionReport,
  VodExternalQualityOption,
} from '../components/tv/VodNativeHlsPlayer';
import { OnlineSubtitleFinderModal } from '../components/tv/OnlineSubtitleFinderModal';
import { HomeHeroBillboard } from '../components/tv/HomeHeroBillboard';
import {
  ActorProfileModal,
  CastCardsSection,
  RelatedVodSuggestionsSection,
} from '../components/tv/ActorProfileModal';
import {
  CastMemberCard,
  fetchCastForVodItem,
  translateTextToLang,
} from '../services/actorService';
import {
  detectCurrentDeviceName,
  getOrCreateCurrentDeviceId,
  loadSharedProfiles,
  saveSharedProfiles,
  saveSharedActiveProfileId,
  syncSharedProfilesFromServer,
  loadDeletedProfileIds,
  markProfileDeleted,
  unmarkProfileDeleted,
  normalizeProfile,
  isLocalHomeServer,
  isLocalBridgeProbePending,
  waitForLocalBridgeProbe,
  isFileListExclusiveRomanianTitle,
  buildFileListApiUrl,
  normalizeFileListResolveData,
  isProfileRememberedOnDevice,
  rememberProfileOnDevice,
} from '../services/deviceContinuityService';
import { CrossDeviceHandoffModal } from '../components/tv/CrossDeviceHandoffModal';
import { TvPlayerModal } from '../components/tv/TvPlayerModal';
import { FilmioStartupLoader } from '../components/common/FilmioStartupLoader';
import { VodCardProducerBadge } from '../components/common/VodCardProducerBadge';
import { VodPosterWatchedControl } from '../components/common/VodPosterWatchedControl';
import { setActiveTvPlaylistContext } from '../components/tv/TvOsdChannelList';
import { RadioPipPlayer } from '../components/player/RadioPipPlayer';
import { MusicPipPlayer, toggleMusicPip } from '../components/player/MusicPipPlayer';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

interface SmartTvLampaViewProps {
  onExitTvMode: () => void;
}

import { SmartTvDrawersAndModals } from "../components/tv/SmartTvDrawersAndModals";
import { SmartTvCatalogSections } from "../components/tv/SmartTvCatalogSections";
import { SmartTvSeriesCalendarSection } from "../components/tv/SmartTvSeriesCalendarSection";
import { IedemMediatekaSection } from "../components/tv/IedemMediatekaSection";
import { SmartTvAdult18Section } from '../components/tv/SmartTvAdult18Section';
import {
  fetchIedemItemDetail,
  searchIedemVod,
  resolveIedemKinopoiskMeta,
} from "../services/iedemVodService";
import {
  SmartTvMusicSpotifySection,
  SpotifyTrackItem,
  INITIAL_SPOTIFY_TRACKS,
} from "../components/tv/SmartTvMusicSpotifySection";
import {
  loadLocalProfileMusicState,
  saveLocalProfileMusicState,
  pullAndMergeProfileMusicState,
  pushProfileMusicState,
  ProfileMusicSyncState,
} from "../services/musicProfileSyncService";
import {
  TvSectionId,
  OriginCountryId,
  VodServerId,
  SubtitleLangId,
  CinemetaItem,
  FileListTorrentInfo,
  type EmbeddedSubtitleTrack,
  ResolvedFileListStream,
  SeriesEpisode,
  TrailerItem,
  DetailedMeta,
  ResolvedDirectVodStream,
  EpisodeProgress,
  VodWatchProgressEntry,
  SAVED_VOD_STORAGE_KEY,
  WATCH_PROGRESS_STORAGE_KEY,
  TV_PROFILES_STORAGE_KEY,
  ACTIVE_TV_PROFILE_STORAGE_KEY,
  TvUiLang,
  SmartTvProfile,
  DEFAULT_TV_PROFILES,
  PROFILE_AVATAR_PRESETS,
  loadTvProfiles,
  saveTvProfiles,
  loadActiveProfileId,
  saveActiveProfileId,
  TV_ORIGIN_COUNTRIES,
  TV_GENRE_PILLS,
  LAMPA_FILTER_RATINGS,
  LAMPA_FILTER_YEARS,
  TV_LIVE_REGIONS,
  TV_LIVE_CATEGORIES,
  RADIO_COUNTRIES,
  VOD_SERVERS,
  ON_SCREEN_KEYS_LATIN,
  ON_SCREEN_KEYS_CYRILLIC,
  formatWatchSeconds,
  getWatchProgressKeyForProfile,
  getSavedVodKeyForProfile,
  getVodCanonicalKey,
  areVodItemsSame,
  findWatchProgressEntry,
  deduplicateProgressMap,
  isAdult18WatchItem,
  sanitizeDeviceName,
  resolveSafeVodPosterUrl,
  handleVodPosterImgError,
  loadWatchProgressMap,
  saveWatchProgressMap,
  loadSeriesEpisodeSortDesc,
  saveSeriesEpisodeSortDesc,
  loadSavedVodItems,
  saveSavedVodItems,
  loadRemovedSavedVodMap,
  markSavedVodRemoved,
  isEpisodeProgressWatched,
  getSeriesWatchedEpisodesCount,
  isVodEntryWatched,
  SMART_TV_SETTINGS_STORAGE_KEY,
  SmartTvSettings,
  DEFAULT_SMART_TV_SETTINGS,
  SMART_TV_AUDIO_OPTIONS,
  SMART_TV_SUB_LANG_OPTIONS,
  SMART_TV_SUB_SIZE_OPTIONS,
  SMART_TV_QUALITY_OPTIONS,
  SMART_TV_SERVER_OPTIONS,
  SMART_TV_OSD_OPTIONS,
  getSmartTvSettingsKeyForProfile,
  loadSmartTvSettings,
  saveSmartTvSettings,
  STREAMING_PLATFORMS,
  isStreamingPlatformSection,
  extractVodProductionYear,
  extractProductionYear,
  sortVodItemsByProductionYear,
  YOUTUBE_CATEGORIES,
  YouTubeVideoCardItem,
  isAdminJekaProfile,
  canProfileAccessAdult,
  canProfileAccessIedem,
  SeriesEpisodeStats,
  resolveSeriesEpisodeStats,
  formatSeriesCardBadgeText,
  formatSeriesCardSubtitleText,
  isRussianVodItem,
  isRussianTvShowItem,
  isRomanianVodItem,
  isVkDirectSourcePath,
  getVodCardRatingInfo,
  deduplicateVodItems,
  deduplicateFileListItems,
} from "./smartTvLampaHelpers";

export const SmartTvLampaView: React.FC<SmartTvLampaViewProps> = ({
  onExitTvMode,
}) => {
  // Mount headless HTML5 Audio + HLS engine directly without MiniPlayer/ExpandedPlayer/RadioPipPlayer
  useAudioPlayer();

  const currentTvChannel = useRadioStore((state) => state.currentTvChannel);
  const playTvChannel = useRadioStore((state) => state.playTvChannel);
  const closeTvPlayer = useRadioStore((state) => state.closeTvPlayer);
  const favoriteTvChannels = useRadioStore((state) => state.favoriteTvChannels);
  const toggleFavoriteTvChannel = useRadioStore(
    (state) => state.toggleFavoriteTvChannel
  );
  const customTvChannels = useRadioStore((state) => state.customTvChannels);
  const adultContentEnabled = useRadioStore(
    (state) => state.adultContentEnabled
  );
  const setAdultContentEnabled = useRadioStore(
    (state) => state.setAdultContentEnabled
  );
  const currentStation = useRadioStore((state) => state.currentStation);
  const playerStatus = useRadioStore((state) => state.playerStatus);
  const nowPlayingTitle = useRadioStore((state) => state.nowPlayingTitle);
  const nowPlayingMeta = useRadioStore((state) => state.nowPlayingMeta);
  const volume = useRadioStore((state) => state.volume);
  const isMuted = useRadioStore((state) => state.isMuted);
  const playStation = useRadioStore((state) => state.playStation);
  const stopRadio = useRadioStore((state) => state.stopRadio);
  const setVolume = useRadioStore((state) => state.setVolume);
  const toggleMute = useRadioStore((state) => state.toggleMute);
  const playNextAvailableStation = useRadioStore(
    (state) => state.playNextAvailableStation
  );
  const playPreviousStation = useRadioStore(
    (state) => state.playPreviousStation
  );
  const triggerStreamReload = useRadioStore(
    (state) => state.triggerStreamReload
  );
  const favorites = useRadioStore((state) => state.favorites);
  const toggleFavorite = useRadioStore((state) => state.toggleFavorite);
  const switchRadioFavoritesProfile = useRadioStore(
    (state) => state.switchRadioFavoritesProfile
  );
  const syncTvChannelFavoritesWithServer = useRadioStore(
    (state) => state.syncTvChannelFavoritesWithServer
  );
  const syncRadioFavoritesWithServer = useRadioStore(
    (state) => state.syncRadioFavoritesWithServer
  );

  const [isAppFullscreen, setIsAppFullscreen] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    const doc = document as Document & { webkitFullscreenElement?: Element | null };
    return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
  });

  const [isStandaloneAppWindow, setIsStandaloneAppWindow] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const mq = window.matchMedia?.(
        '(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)'
      );
      const winBar = (window as Window & { menubar?: { visible?: boolean } }).menubar;
      return Boolean(
        mq?.matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true ||
        (winBar && winBar.visible === false) ||
        new URLSearchParams(window.location.search).get('appwin') === '1'
      );
    } catch {
      return false;
    }
  });

  const deferredPwaPromptRef = useRef<{
    prompt: () => Promise<void>;
    userChoice?: Promise<{ outcome: string }>;
  } | null>(null);

  useEffect(() => {
    const syncFs = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      setIsAppFullscreen(Boolean(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    const onBeforeInstall = (ev: Event) => {
      const pEv = ev as Event & {
        prompt?: () => Promise<void>;
        userChoice?: Promise<{ outcome: string }>;
      };
      if (typeof pEv.prompt === 'function') {
        ev.preventDefault();
        deferredPwaPromptRef.current = {
          prompt: pEv.prompt.bind(pEv),
          userChoice: pEv.userChoice,
        };
      }
    };
    const mq = window.matchMedia?.(
      '(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)'
    );
    const onDisplayMode = () => {
      if (mq?.matches) setIsStandaloneAppWindow(true);
    };
    document.addEventListener('fullscreenchange', syncFs);
    document.addEventListener('webkitfullscreenchange', syncFs);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    mq?.addEventListener?.('change', onDisplayMode);
    return () => {
      document.removeEventListener('fullscreenchange', syncFs);
      document.removeEventListener('webkitfullscreenchange', syncFs);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      mq?.removeEventListener?.('change', onDisplayMode);
    };
  }, []);

  const handleToggleBrowserFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const rootEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      if (typeof doc.exitFullscreen === 'function') {
        doc.exitFullscreen().catch(() => { });
      } else if (typeof doc.webkitExitFullscreen === 'function') {
        Promise.resolve(doc.webkitExitFullscreen()).catch(() => { });
      }
    } else if (typeof rootEl.requestFullscreen === 'function') {
      rootEl.requestFullscreen().catch(() => { });
    } else if (typeof rootEl.webkitRequestFullscreen === 'function') {
      Promise.resolve(rootEl.webkitRequestFullscreen()).catch(() => { });
    }
  }, []);

  const [isRefreshingApp, setIsRefreshingApp] = useState<boolean>(false);
  const isRefreshingAppRef = useRef<boolean>(false);

  const handleHardRefreshTvApp = useCallback((fallbackReload?: () => void) => {
    if (typeof window === 'undefined' || isRefreshingAppRef.current) return;
    isRefreshingAppRef.current = true;
    setIsRefreshingApp(true);

    // Immediately pause & detach active media streams and abort in-flight sockets
    // so LG webOS Chromium 68 (6-connection limit per LAN origin) never stalls the reload.
    try {
      const mediaEls = document.querySelectorAll<HTMLMediaElement>('video, audio');
      for (let i = 0; i < mediaEls.length; i++) {
        try {
          mediaEls[i].pause();
        } catch {
          // ignore
        }
      }
      if (typeof window.stop === 'function') {
        window.stop();
      }
    } catch {
      // ignore
    }

    // Safety unlock in case a TV WebView host intercepts navigation
    window.setTimeout(() => {
      isRefreshingAppRef.current = false;
      setIsRefreshingApp(false);
    }, 6000);

    try {
      const url = new URL(window.location.href);
      url.searchParams.set('_r', String(Date.now()));
      window.location.replace(url.toString());
    } catch {
      if (fallbackReload) {
        fallbackReload();
      }
    }
  }, []);

  const handleOpenInFullAppWindow = useCallback(() => {
    if (typeof window === 'undefined') return;
    const targetUrl = new URL(window.location.href);
    targetUrl.searchParams.set('appwin', '1');
    const availW = window.screen?.availWidth || 1920;
    const availH = window.screen?.availHeight || 1080;
    const features = `popup=yes,width=${availW},height=${availH},left=0,top=0,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`;
    const opened = window.open(targetUrl.toString(), 'FilmioFullWindow', features);
    if (!opened) {
      if (deferredPwaPromptRef.current) {
        const promptObj = deferredPwaPromptRef.current;
        deferredPwaPromptRef.current = null;
        promptObj.prompt().catch(() => { });
      } else {
        handleToggleBrowserFullscreen();
      }
    }
  }, [handleToggleBrowserFullscreen]);

  const [isTvRadioPlayerOpen, setIsTvRadioPlayerOpen] =
    useState<boolean>(false);

  // ==========================================================================
  // SPOTIFY MUSIC MODULE STATE & PERSISTENT BACKGROUND AUDIO ENGINE
  // ==========================================================================
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const [currentMusicTrack, setCurrentMusicTrack] =
    useState<SpotifyTrackItem | null>(null);
  const [musicQueue, setMusicQueue] = useState<SpotifyTrackItem[]>(() => {
    const pid = loadActiveProfileId();
    try {
      const raw = localStorage.getItem(`filmio_music_queue_${pid}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    const init = loadLocalProfileMusicState(pid);
    if (init && init.likedTracks.length > 0) return init.likedTracks;
    return INITIAL_SPOTIFY_TRACKS;
  });
  const [isMusicPlaying, setIsMusicPlaying] = useState<boolean>(false);
  const [musicElapsedSec, setMusicElapsedSec] = useState<number>(0);
  const [musicDurationSec, setMusicDurationSec] = useState<number>(0);
  const [musicVolume, setMusicVolume] = useState<number>(0.85);
  const [isMusicMuted, setIsMusicMuted] = useState<boolean>(false);
  const [isMusicShuffle, setIsMusicShuffle] = useState<boolean>(false);
  const [isMusicRepeat, setIsMusicRepeat] = useState<boolean>(false);
  const [pendingMusicQuery, setPendingMusicQuery] = useState<{
    query: string;
    label?: string;
    album?: string;
    artist?: string;
    ts: number;
  } | null>(null);
  const activeProfileIdForMusicRef = useRef<string>(loadActiveProfileId());
  const removedMusicMapRef = useRef<Record<string, number>>({});
  const initialLocalMusicRef = useRef<ProfileMusicSyncState | null>(null);
  if (initialLocalMusicRef.current === null) {
    const loadedInit = loadLocalProfileMusicState(activeProfileIdForMusicRef.current);
    initialLocalMusicRef.current = loadedInit;
    removedMusicMapRef.current = loadedInit.removedMap || {};
  }
  const [likedMusicTracks, setLikedMusicTracks] = useState<SpotifyTrackItem[]>(() => {
    const init = initialLocalMusicRef.current;
    if (init && init.likedTracks.length > 0) {
      return init.likedTracks;
    }
    if (init && Object.keys(init.removedMap || {}).length > 0) {
      return [];
    }
    return INITIAL_SPOTIFY_TRACKS.slice(0, 3);
  });
  const [recentMusicTracks, setRecentMusicTracks] = useState<SpotifyTrackItem[]>(
    () => initialLocalMusicRef.current?.recentTracks || []
  );

  const likedMusicTracksRef = useRef(likedMusicTracks);
  likedMusicTracksRef.current = likedMusicTracks;
  const recentMusicTracksRef = useRef(recentMusicTracks);
  recentMusicTracksRef.current = recentMusicTracks;
  const currentMusicTrackRef = useRef(currentMusicTrack);
  currentMusicTrackRef.current = currentMusicTrack;
  const isMusicPlayingRef = useRef(isMusicPlaying);
  isMusicPlayingRef.current = isMusicPlaying;
  const musicElapsedSecRef = useRef(musicElapsedSec);
  musicElapsedSecRef.current = musicElapsedSec;
  const musicDurationSecRef = useRef(musicDurationSec);
  musicDurationSecRef.current = musicDurationSec;

  const persistAndSyncMusicState = useCallback(
    (
      overrides?: Partial<ProfileMusicSyncState>,
      opts?: { forceCloud?: boolean }
    ) => {
      const targetProfId = activeProfileIdForMusicRef.current || 'p1';
      const now = Date.now();
      const hasPlaybackOverride = Boolean(
        overrides &&
          Object.prototype.hasOwnProperty.call(overrides, 'playbackState')
      );
      const curTrack = hasPlaybackOverride
        ? overrides?.playbackState?.track
        : currentMusicTrackRef.current;
      const fallbackPlayback = curTrack
        ? {
            track: curTrack,
            elapsedSec: Math.max(0, Math.floor(musicElapsedSecRef.current || 0)),
            durationSec: Math.max(
              1,
              Math.floor(
                musicDurationSecRef.current || curTrack.durationSec || 200
              )
            ),
            updatedAt: now,
          }
        : null;
      const nextState: ProfileMusicSyncState = {
        updatedAt: now,
        likedTracks: overrides?.likedTracks ?? likedMusicTracksRef.current,
        removedMap: overrides?.removedMap ?? removedMusicMapRef.current,
        recentTracks: overrides?.recentTracks ?? recentMusicTracksRef.current,
        playbackState: hasPlaybackOverride
          ? (overrides?.playbackState ?? null)
          : fallbackPlayback,
      };
      saveLocalProfileMusicState(targetProfId, nextState);
      void pushProfileMusicState(
        targetProfId,
        nextState,
        opts?.forceCloud ? { force: true } : undefined
      );
    },
    []
  );

  const activeMusicBackendRef = useRef<'none' | 'audio' | 'yt'>('none');
  const audioFallbackOnlyRef = useRef<boolean>(false);
  const isMusicRepeatRef = useRef<boolean>(isMusicRepeat);
  isMusicRepeatRef.current = isMusicRepeat;
  const musicQueueRef = useRef<SpotifyTrackItem[]>(musicQueue);
  musicQueueRef.current = musicQueue;
  const handleUpdateMusicQueue = useCallback((nextQueue: SpotifyTrackItem[]) => {
    if (!nextQueue || nextQueue.length === 0) return;
    musicQueueRef.current = nextQueue;
    setMusicQueue(nextQueue);
    try {
      const pid = activeProfileIdForMusicRef.current || 'p1';
      localStorage.setItem(`filmio_music_queue_${pid}`, JSON.stringify(nextQueue.slice(0, 200)));
    } catch {
      // ignore storage quota errors
    }
  }, []);
  const isMusicShuffleRef = useRef<boolean>(isMusicShuffle);
  isMusicShuffleRef.current = isMusicShuffle;
  const handleNextMusicTrackRef = useRef<() => void>(() => {});
  const handlePrevMusicTrackRef = useRef<() => void>(() => {});
  const handleSeekMusicRef = useRef<(sec: number) => void>(() => {});
  const handleStopAndCloseMusicRef = useRef<() => void>(() => {});
  const lastMusicPosSyncMsRef = useRef<number>(0);

  // If Radio Live or Live TV starts playing, stop and close Spotify Music completely so only the current source is active
  useEffect(() => {
    if (
      currentStation ||
      playerStatus === 'playing' ||
      playerStatus === 'loading' ||
      currentTvChannel
    ) {
      activeMusicBackendRef.current = 'none';
      audioFallbackOnlyRef.current = false;
      stopYoutubeMusicTrack();
      if (musicAudioRef.current) {
        musicAudioRef.current.pause();
        musicAudioRef.current.removeAttribute('src');
      }
      if (isMusicPlaying) {
        setIsMusicPlaying(false);
      }
      if (currentMusicTrack) {
        currentMusicTrackRef.current = null;
        isMusicPlayingRef.current = false;
        musicElapsedSecRef.current = 0;
        setCurrentMusicTrack(null);
        setMusicElapsedSec(0);
        persistAndSyncMusicState(
          {
            playbackState: {
              track: null,
              elapsedSec: 0,
              durationSec: 0,
              updatedAt: Date.now(),
              closed: true,
            },
          },
          { forceCloud: true }
        );
      }
    }
  }, [
    currentStation,
    playerStatus,
    currentTvChannel,
    isMusicPlaying,
    currentMusicTrack,
    persistAndSyncMusicState,
  ]);

  const musicPlaybackSeqRef = useRef<number>(0);
  const musicAudioRetryRef = useRef<number>(0);
  const lastMusicAudioProgressMsRef = useRef<number>(0);
  const lastMusicAudioTimeSecRef = useRef<number>(-1);
  const consecutiveMusicFailCountRef = useRef<number>(0);
  const nextTrackPrefetchTimerRef = useRef<number | null>(null);
  const musicStallTimeoutRef = useRef<number | null>(null);
  const musicDoubleDurCapRef = useRef<number>(0);

  const startYtTrackPlayback = useCallback(
    (track: SpotifyTrackItem, startSec = 0) => {
      activeMusicBackendRef.current = 'yt';
      audioFallbackOnlyRef.current = false;
      if (musicAudioRef.current) {
        musicAudioRef.current.pause();
        musicAudioRef.current.removeAttribute('src');
      }
      setYoutubeMusicVolume(musicVolume, isMusicMuted);
      void playYoutubeMusicTrack(
        track,
        {
          onProgress: (ct, dur) => {
            if (ct > 2) consecutiveMusicFailCountRef.current = 0;
            lastMusicAudioProgressMsRef.current = Date.now();
            setMusicElapsedSec(ct);
            if (dur >= 45) {
              setMusicDurationSec(dur);
            }
            if (Date.now() - lastMusicPosSyncMsRef.current >= 2000) {
              lastMusicPosSyncMsRef.current = Date.now();
              updateMediaSessionPosition(
                'music',
                ct,
                dur >= 45 ? dur : track.durationSec || musicDurationSecRef.current || 200
              );
            }
          },
          onStateChange: (playing) => {
            setIsMusicPlaying(playing);
            updateMediaSessionPlaybackState('music', playing ? 'playing' : 'paused');
          },
          onEnded: () => {
            if (isMusicRepeatRef.current) {
              seekYoutubeMusicTrack(0);
              resumeYoutubeMusicTrack();
            } else {
              handleNextMusicTrackRef.current();
            }
          },
          onAllCandidatesFailed: () => {
            // STRICT POLICY: Never fall back to 30-second Deezer/iTunes previewUrl!
            consecutiveMusicFailCountRef.current += 1;
            if (
              consecutiveMusicFailCountRef.current <= 3 &&
              musicQueueRef.current.length > 1
            ) {
              handleNextMusicTrackRef.current();
              return;
            }
            activeMusicBackendRef.current = 'none';
            setIsMusicPlaying(false);
          },
        },
        { startSec }
      );
    },
    [isMusicMuted, musicVolume]
  );

  const handlePlayMusicTrack = useCallback(
    (track: SpotifyTrackItem, queueList?: SpotifyTrackItem[]) => {
      prewarmYoutubeMusicEngine();
      stopYoutubeMusicTrack();
      activeMusicBackendRef.current = 'none';
      audioFallbackOnlyRef.current = false;
      stopRadio();
      setIsTvRadioPlayerOpen(false);
      if (currentTvChannel) {
        closeTvPlayer();
      }
      if (queueList && queueList.length > 0) {
        handleUpdateMusicQueue(queueList);
      }
      currentMusicTrackRef.current = track;
      musicElapsedSecRef.current = 0;
      musicDurationSecRef.current = track.durationSec || 200;
      isMusicPlayingRef.current = true;
      setCurrentMusicTrack(track);
      setMusicElapsedSec(0);
      setMusicDurationSec(track.durationSec || 200);
      setIsMusicPlaying(true);

      claimMediaSession(
        "music",
        {
          title: track.title,
          artist: track.artist || "Filmio Music",
          album: track.album || "Filmio Music",
          artworkUrl: track.cover || track.coverSmall || "/apple-touch-icon.png",
        },
        {
          onPlay: () => {
            stopRadio();
            setIsTvRadioPlayerOpen(false);
            if (currentTvChannel) closeTvPlayer();
            if (activeMusicBackendRef.current === "yt") {
              resumeYoutubeMusicTrack();
              setIsMusicPlaying(true);
              return;
            }
            const el = musicAudioRef.current;
            if (el) {
              el.play().catch(() => {});
              setIsMusicPlaying(true);
            }
          },
          onPause: () => {
            if (activeMusicBackendRef.current === "yt") {
              pauseYoutubeMusicTrack();
            } else {
              musicAudioRef.current?.pause();
            }
            setIsMusicPlaying(false);
          },
          onStop: () => handleStopAndCloseMusicRef.current(),
          onPrev: () => handlePrevMusicTrackRef.current(),
          onNext: () => handleNextMusicTrackRef.current(),
          onSeekBackward: null,
          onSeekForward: null,
          onSeekTo: (sec) => handleSeekMusicRef.current(sec),
        }
      );
      updateMediaSessionPlaybackState("music", "playing");
      updateMediaSessionPosition("music", 0, track.durationSec || 200);

      const now = Date.now();
      const normTrackKey = `${String(track.artist || '').toLowerCase().trim()}::${String(track.title || '').toLowerCase().trim()}`;
      const nextRecent = [
        { ...track, playedAt: now },
        ...recentMusicTracksRef.current.filter(
          (t) =>
            t.id !== track.id &&
            `${String(t.artist || '').toLowerCase().trim()}::${String(t.title || '').toLowerCase().trim()}` !== normTrackKey
        ),
      ].slice(0, 40);
      recentMusicTracksRef.current = nextRecent;
      setRecentMusicTracks(nextRecent);
      persistAndSyncMusicState({
        recentTracks: nextRecent,
        playbackState: {
          track: { ...track, playedAt: now },
          elapsedSec: 0,
          durationSec: Math.max(1, Math.floor(track.durationSec || 200)),
          updatedAt: now,
        },
      });

      musicAudioRetryRef.current = 0;
      musicDoubleDurCapRef.current = 0;
      lastMusicAudioProgressMsRef.current = Date.now();
      lastMusicAudioTimeSecRef.current = -1;
      const playbackSeq = ++musicPlaybackSeqRef.current;
      if (nextTrackPrefetchTimerRef.current !== null) {
        window.clearTimeout(nextTrackPrefetchTimerRef.current);
        nextTrackPrefetchTimerRef.current = null;
      }
      const effectiveQueueForPrefetch =
        queueList && queueList.length > 0 ? queueList : musicQueueRef.current;
      if (effectiveQueueForPrefetch.length > 1) {
        const curQIdx = effectiveQueueForPrefetch.findIndex((t) => t.id === track.id);
        const upcomingTrack =
          curQIdx >= 0
            ? effectiveQueueForPrefetch[(curQIdx + 1) % effectiveQueueForPrefetch.length]
            : effectiveQueueForPrefetch[0];
        if (upcomingTrack && upcomingTrack.id !== track.id) {
          nextTrackPrefetchTimerRef.current = window.setTimeout(() => {
            nextTrackPrefetchTimerRef.current = null;
            if (musicPlaybackSeqRef.current === playbackSeq) {
              prewarmNextMusicTrack(upcomingTrack);
            }
          }, 1100);
        }
      }
      const audioEl = musicAudioRef.current;
      const startOnlinePlayback = () => {
        if (musicPlaybackSeqRef.current !== playbackSeq) return;
        const launchResolvedOnlineAudio = () => {
          if (musicPlaybackSeqRef.current !== playbackSeq) return;
          if (!canUseResidentialDirectAudio()) {
            startYtTrackPlayback(track, 0);
            return;
          }
          if (audioEl) {
            activeMusicBackendRef.current = 'audio';
            audioFallbackOnlyRef.current = false;
            musicAudioRetryRef.current = 0;
            audioEl.src = buildDirectFullAudioUrl(track, 0);
            audioEl.volume = isMusicMuted ? 0 : musicVolume;
            const playPromise = audioEl.play();
            if (playPromise !== undefined) {
              playPromise.catch(() => {
                if (musicPlaybackSeqRef.current !== playbackSeq) return;
                startYtTrackPlayback(track, 0);
              });
            }
            return;
          }
          startYtTrackPlayback(track, 0);
        };
        if (!canUseResidentialDirectAudio() && isLocalBridgeProbePending()) {
          if (audioEl) {
            try {
              audioEl.load();
            } catch {
              // preserve iOS Safari gesture unlock while HTTPS bridge finishes probing
            }
          }
          void waitForLocalBridgeProbe(2000).then(() => launchResolvedOnlineAudio());
          return;
        }
        launchResolvedOnlineAudio();
      };

      if (!isTrackOfflineSync(track)) {
        startOnlinePlayback();
      } else {
        if (audioEl) {
          try {
            audioEl.load();
          } catch {
            // ignore gesture unlock load errors
          }
        }
        void resolveOfflineMusicObjectUrl(track).then((offlineBlobUrl) => {
          if (musicPlaybackSeqRef.current !== playbackSeq) return;
          if (offlineBlobUrl && audioEl) {
            activeMusicBackendRef.current = 'audio';
            audioFallbackOnlyRef.current = false;
            audioEl.src = offlineBlobUrl;
            audioEl.volume = isMusicMuted ? 0 : musicVolume;
            audioEl.play().catch(() => {
              if (musicPlaybackSeqRef.current !== playbackSeq) return;
              startOnlinePlayback();
            });
          } else {
            startOnlinePlayback();
          }
        });
      }
    },
    [
      stopRadio,
      currentTvChannel,
      closeTvPlayer,
      isMusicMuted,
      musicVolume,
      persistAndSyncMusicState,
      startYtTrackPlayback,
      handleUpdateMusicQueue,
    ]
  );

  const handleToggleMusicPlayPause = useCallback(() => {
    const audioEl = musicAudioRef.current;
    if (!currentMusicTrack) {
      const initList =
        musicQueueRef.current.length > 0
          ? musicQueueRef.current
          : likedMusicTracksRef.current.length > 0
            ? likedMusicTracksRef.current
            : INITIAL_SPOTIFY_TRACKS;
      handlePlayMusicTrack(initList[0], initList);
      return;
    }

    if (activeMusicBackendRef.current === 'yt') {
      if (isMusicPlayingRef.current) {
        pauseYoutubeMusicTrack();
        setIsMusicPlaying(false);
        persistAndSyncMusicState();
      } else {
        stopRadio();
        setIsTvRadioPlayerOpen(false);
        if (currentTvChannel) {
          closeTvPlayer();
        }
        setYoutubeMusicVolume(musicVolume, isMusicMuted);
        resumeYoutubeMusicTrack();
        setIsMusicPlaying(true);
      }
      return;
    }

    if (!audioEl) return;
    if (audioEl.paused) {
      stopRadio();
      setIsTvRadioPlayerOpen(false);
      if (currentTvChannel) {
        closeTvPlayer();
      }
      if (!audioEl.getAttribute('src')) {
        const seq = ++musicPlaybackSeqRef.current;
        const resumeAt = Math.max(0, Math.floor(musicElapsedSecRef.current || 0));
        musicAudioRetryRef.current = 0;
        const resumeOnline = () => {
          if (musicPlaybackSeqRef.current !== seq) return;
          const launchResumeOnline = () => {
            if (musicPlaybackSeqRef.current !== seq) return;
            if (!canUseResidentialDirectAudio()) {
              startYtTrackPlayback(currentMusicTrack, resumeAt);
              return;
            }
            activeMusicBackendRef.current = 'audio';
            audioFallbackOnlyRef.current = false;
            musicAudioRetryRef.current = 0;
            audioEl.src = buildDirectFullAudioUrl(currentMusicTrack, 0);
            audioEl.volume = isMusicMuted ? 0 : musicVolume;
            if (resumeAt > 2) {
              const seekOnce = () => {
                try {
                  audioEl.currentTime = resumeAt;
                } catch {
                  // ignore seek before ready
                }
              };
              audioEl.addEventListener('loadedmetadata', seekOnce, { once: true });
            }
            audioEl.play().catch(() => {
              if (musicPlaybackSeqRef.current !== seq) return;
              startYtTrackPlayback(currentMusicTrack, resumeAt);
            });
          };
          if (!canUseResidentialDirectAudio() && isLocalBridgeProbePending()) {
            try {
              audioEl.load();
            } catch {
              // preserve iOS Safari gesture unlock while HTTPS bridge finishes probing
            }
            void waitForLocalBridgeProbe(2000).then(() => launchResumeOnline());
            return;
          }
          launchResumeOnline();
        };

        if (!isTrackOfflineSync(currentMusicTrack)) {
          resumeOnline();
        } else {
          try {
            audioEl.load();
          } catch {
            // ignore
          }
          void resolveOfflineMusicObjectUrl(currentMusicTrack).then((offlineBlobUrl) => {
            if (musicPlaybackSeqRef.current !== seq) return;
            if (offlineBlobUrl) {
              activeMusicBackendRef.current = 'audio';
              audioFallbackOnlyRef.current = false;
              audioEl.src = offlineBlobUrl;
              audioEl.volume = isMusicMuted ? 0 : musicVolume;
              if (resumeAt > 2) {
                const seekOnce = () => {
                  try {
                    audioEl.currentTime = resumeAt;
                  } catch {
                    // ignore
                  }
                };
                audioEl.addEventListener('loadedmetadata', seekOnce, { once: true });
              }
              audioEl.play().catch(() => {
                if (musicPlaybackSeqRef.current !== seq) return;
                resumeOnline();
              });
            } else {
              resumeOnline();
            }
          });
        }
        setIsMusicPlaying(true);
        return;
      }
      activeMusicBackendRef.current = 'audio';
      audioEl.play().catch(() => {
        startYtTrackPlayback(currentMusicTrack, Math.floor(musicElapsedSecRef.current || 0));
      });
      setIsMusicPlaying(true);
    } else {
      audioEl.pause();
      setIsMusicPlaying(false);
      persistAndSyncMusicState();
    }
  }, [
    currentMusicTrack,
    stopRadio,
    currentTvChannel,
    closeTvPlayer,
    handlePlayMusicTrack,
    isMusicMuted,
    musicVolume,
    persistAndSyncMusicState,
    startYtTrackPlayback,
  ]);

  const handleNextMusicTrack = useCallback(() => {
    const likedFallback = likedMusicTracksRef.current;
    const rawQ = musicQueueRef.current;
    const cur = currentMusicTrackRef.current;
    const qMatchesCur =
      !cur || rawQ.length === 0 || rawQ.some((t) => t.id === cur.id);
    const list =
      !qMatchesCur && likedFallback.some((t) => t.id === cur?.id)
        ? likedFallback
        : rawQ.length > 0
          ? rawQ
          : likedFallback.length > 0
            ? likedFallback
            : INITIAL_SPOTIFY_TRACKS;
    if (list.length === 0) return;
    if (isMusicShuffleRef.current && list.length > 1) {
      const candidates = list.filter((t) => t.id !== cur?.id);
      const pick =
        candidates[Math.floor(Math.random() * candidates.length)] || list[0];
      handlePlayMusicTrack(pick, list);
      return;
    }
    const idx = list.findIndex((t) => t.id === cur?.id);
    const nextTrack = list[(idx + 1) % list.length] || list[0];
    handlePlayMusicTrack(nextTrack, list);
  }, [handlePlayMusicTrack]);
  handleNextMusicTrackRef.current = handleNextMusicTrack;

  const clearMusicStallTimer = useCallback(() => {
    if (musicStallTimeoutRef.current !== null) {
      window.clearTimeout(musicStallTimeoutRef.current);
      musicStallTimeoutRef.current = null;
    }
  }, []);

  const scheduleMusicStallRecovery = useCallback(() => {
    if (activeMusicBackendRef.current !== 'audio') return;
    if (musicStallTimeoutRef.current !== null) return;
    const el = musicAudioRef.current;
    const snapTime = Number(el?.currentTime || 0);
    const snapSeq = musicPlaybackSeqRef.current;
    musicStallTimeoutRef.current = window.setTimeout(() => {
      musicStallTimeoutRef.current = null;
      if (
        musicPlaybackSeqRef.current !== snapSeq ||
        activeMusicBackendRef.current !== 'audio'
      ) {
        return;
      }
      const curEl = musicAudioRef.current;
      const curTrack = currentMusicTrackRef.current;
      if (!curEl || !curTrack || curEl.paused) return;
      const ct = Number(curEl.currentTime || 0);
      if (Math.abs(ct - snapTime) >= 0.35) return;
      const dur = Number(curEl.duration || 0);
      if (dur > 30 && Number.isFinite(dur) && ct >= dur - 2.5) {
        if (isMusicRepeatRef.current) {
          curEl.currentTime = 0;
          curEl.play().catch(() => {});
        } else {
          handleNextMusicTrackRef.current();
        }
        return;
      }
      const resumeAt = Math.max(0, Math.floor(ct));
      if (musicAudioRetryRef.current < 2) {
        musicAudioRetryRef.current += 1;
        curEl.src = buildDirectFullAudioUrl(curTrack, musicAudioRetryRef.current);
        if (resumeAt > 2) {
          const seekOnReady = () => {
            try {
              curEl.currentTime = resumeAt;
            } catch {
              // ignore
            }
          };
          curEl.addEventListener('loadedmetadata', seekOnReady, { once: true });
        }
        curEl.play().catch(() => {
          startYtTrackPlayback(curTrack, resumeAt);
        });
      } else {
        curEl.pause();
        curEl.removeAttribute('src');
        startYtTrackPlayback(curTrack, resumeAt);
      }
    }, 9000);
  }, [startYtTrackPlayback]);

  const handlePrevMusicTrack = useCallback(() => {
    const likedFallback = likedMusicTracksRef.current;
    const rawQ = musicQueueRef.current;
    const cur = currentMusicTrackRef.current;
    const qMatchesCur =
      !cur || rawQ.length === 0 || rawQ.some((t) => t.id === cur.id);
    const list =
      !qMatchesCur && likedFallback.some((t) => t.id === cur?.id)
        ? likedFallback
        : rawQ.length > 0
          ? rawQ
          : likedFallback.length > 0
            ? likedFallback
            : INITIAL_SPOTIFY_TRACKS;
    if (list.length === 0) return;
    if ((musicElapsedSecRef.current || 0) > 5) {
      if (activeMusicBackendRef.current === 'yt') {
        seekYoutubeMusicTrack(0);
        musicElapsedSecRef.current = 0;
        setMusicElapsedSec(0);
        return;
      }
      if (musicAudioRef.current) {
        musicAudioRef.current.currentTime = 0;
        musicElapsedSecRef.current = 0;
        setMusicElapsedSec(0);
        return;
      }
    }
    const idx = list.findIndex((t) => t.id === cur?.id);
    const prevIdx = idx <= 0 ? list.length - 1 : idx - 1;
    handlePlayMusicTrack(list[prevIdx] || list[0], list);
  }, [handlePlayMusicTrack]);
  handlePrevMusicTrackRef.current = handlePrevMusicTrack;

  const handleSeekMusic = useCallback(
    (targetSec: number) => {
      const clamped = Math.max(0, targetSec);
      if (activeMusicBackendRef.current === 'yt') {
        seekYoutubeMusicTrack(clamped);
      } else {
        const audioEl = musicAudioRef.current;
        if (audioEl && audioEl.getAttribute('src')) {
          audioEl.currentTime = clamped;
        }
      }
      setMusicElapsedSec(clamped);
      musicElapsedSecRef.current = clamped;
      if (currentMusicTrackRef.current) {
        persistAndSyncMusicState({
          playbackState: {
            track: currentMusicTrackRef.current,
            elapsedSec: Math.floor(clamped),
            durationSec: Math.max(
              1,
              Math.floor(
                musicDurationSecRef.current ||
                  currentMusicTrackRef.current.durationSec ||
                  200
              )
            ),
            updatedAt: Date.now(),
          },
        });
      }
    },
    [persistAndSyncMusicState]
  );
  handleSeekMusicRef.current = handleSeekMusic;

  const handleToggleLikeMusicTrack = useCallback(
    (track: SpotifyTrackItem) => {
      const now = Date.now();
      const prev = likedMusicTracksRef.current;
      const exists = prev.some((t) => t.id === track.id);
      const nextRemovedMap = { ...removedMusicMapRef.current };
      let nextLiked: SpotifyTrackItem[];
      if (exists) {
        nextRemovedMap[track.id] = now;
        nextLiked = prev.filter((t) => t.id !== track.id);
      } else {
        delete nextRemovedMap[track.id];
        nextLiked = [{ ...track, likedAt: now }, ...prev];
      }
      removedMusicMapRef.current = nextRemovedMap;
      likedMusicTracksRef.current = nextLiked;
      setLikedMusicTracks(nextLiked);
      persistAndSyncMusicState({
        likedTracks: nextLiked,
        removedMap: nextRemovedMap,
      });
    },
    [persistAndSyncMusicState]
  );

  const handleChangeMusicVolume = useCallback((nextVol: number) => {
    const clamped = Math.min(1, Math.max(0, Number(nextVol.toFixed(2))));
    setMusicVolume(clamped);
    setIsMusicMuted(clamped === 0);
    setYoutubeMusicVolume(clamped, clamped === 0);
    if (musicAudioRef.current) {
      musicAudioRef.current.volume = clamped;
    }
  }, []);

  const handleToggleMusicMute = useCallback(() => {
    setIsMusicMuted((prev) => {
      const next = !prev;
      setYoutubeMusicVolume(musicVolume, next);
      if (musicAudioRef.current) {
        musicAudioRef.current.volume = next ? 0 : musicVolume;
      }
      return next;
    });
  }, [musicVolume]);

  const handleStopAndCloseMusic = useCallback(() => {
    activeMusicBackendRef.current = 'none';
    audioFallbackOnlyRef.current = false;
    stopYoutubeMusicTrack();
    if (musicAudioRef.current) {
      musicAudioRef.current.pause();
      musicAudioRef.current.removeAttribute('src');
    }
    currentMusicTrackRef.current = null;
    isMusicPlayingRef.current = false;
    musicElapsedSecRef.current = 0;
    setIsMusicPlaying(false);
    setCurrentMusicTrack(null);
    setMusicElapsedSec(0);
    releaseMediaSession('music');
    persistAndSyncMusicState(
      {
        playbackState: {
          track: null,
          elapsedSec: 0,
          durationSec: 0,
          updatedAt: Date.now(),
          closed: true,
        },
      },
      { forceCloud: true }
    );
  }, [persistAndSyncMusicState]);
  handleStopAndCloseMusicRef.current = handleStopAndCloseMusic;

  // Apple CarPlay Now Playing + Mercedes GLE Steering-Wheel & Cluster MediaSession for Music
  useEffect(() => {
    if (
      !currentMusicTrack ||
      (!isMusicPlaying && activeMusicBackendRef.current === 'none') ||
      currentStation ||
      currentTvChannel ||
      isPlayingVodRef.current
    ) {
      releaseMediaSession('music');
      return;
    }
    claimMediaSession(
      'music',
      {
        title: currentMusicTrack.title,
        artist: currentMusicTrack.artist || 'Filmio Music',
        album: currentMusicTrack.album || 'Filmio Music',
        artworkUrl:
          currentMusicTrack.cover ||
          currentMusicTrack.coverSmall ||
          '/apple-touch-icon.png',
      },
      {
        onPlay: () => {
          stopRadio();
          setIsTvRadioPlayerOpen(false);
          if (currentTvChannel) closeTvPlayer();
          if (activeMusicBackendRef.current === 'yt') {
            resumeYoutubeMusicTrack();
            setIsMusicPlaying(true);
            return;
          }
          const el = musicAudioRef.current;
          if (el) {
            el.play().catch(() => { });
            setIsMusicPlaying(true);
          }
        },
        onPause: () => {
          if (activeMusicBackendRef.current === 'yt') {
            pauseYoutubeMusicTrack();
          } else {
            musicAudioRef.current?.pause();
          }
          setIsMusicPlaying(false);
        },
        onStop: () => {
          handleStopAndCloseMusic();
        },
        onPrev: () => {
          handlePrevMusicTrack();
        },
        onNext: () => {
          handleNextMusicTrack();
        },
        onSeekBackward: null,
        onSeekForward: null,
        onSeekTo: (sec) => {
          handleSeekMusic(sec);
        },
      }
    );
    updateMediaSessionPlaybackState(
      'music',
      isMusicPlaying ? 'playing' : 'paused'
    );
  }, [
    currentMusicTrack,
    isMusicPlaying,
    stopRadio,
    currentTvChannel,
    closeTvPlayer,
    handleStopAndCloseMusic,
    handlePrevMusicTrack,
    handleNextMusicTrack,
    handleSeekMusic,
  ]);

  const activeRadioTrack = useMemo(
    () =>
      currentStation
        ? resolveDisplayTrack(
          nowPlayingMeta,
          nowPlayingTitle,
          currentStation.name
        )
        : null,
    [currentStation, nowPlayingMeta, nowPlayingTitle]
  );

  const isPlayingVodRef = useRef<boolean>(false);

  // Clock & 2-line Date in top-right corner (localized by uiLang: RO / EN / RU)
  const [clockNow, setClockNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (isPlayingVodRef.current) return;
      const next = new Date();
      setClockNow((prev) =>
        prev.getMinutes() === next.getMinutes() &&
          prev.getHours() === next.getHours()
          ? prev
          : next
      );
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  // Main TV Navigation Section (Defaults to Lampa 'home' / Главная)
  const [section, setSection] = useState<TvSectionId>('home');
  const [isCarMode, setIsCarMode] = useState<boolean>(() =>
    isAutomotiveWidescreenMode()
  );
  const [isMobileChromeHidden, setIsMobileChromeHidden] = useState<boolean>(false);
  const isMobileChromeHiddenRef = useRef<boolean>(false);
  const lastMainScrollTopRef = useRef<number>(0);
  const scrollDeltaAccumRef = useRef<number>(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    if (isAutomotiveWidescreenMode() || isMobilePhoneDevice()) return false;
    return window.innerWidth >= 768;
  });

  useEffect(() => {
    if (isCarMode) {
      document.documentElement.classList.add('car-widescreen-mode');
    } else {
      document.documentElement.classList.remove('car-widescreen-mode');
    }
  }, [isCarMode]);

  useEffect(() => {
    const onCarModeEvent = (ev: Event) => {
      const enabled = Boolean(
        (ev as CustomEvent<{ enabled?: boolean }>).detail?.enabled
      );
      setIsCarMode(enabled);
      if (enabled) {
        setIsSidebarOpen(false);
      } else if (
        typeof window !== 'undefined' &&
        !isMobilePhoneDevice() &&
        window.innerWidth >= 768
      ) {
        setIsSidebarOpen(true);
      }
    };
    const onResizeAutoCar = () => {
      const autoDetected = isAutomotiveWidescreenMode();
      setIsCarMode((prev) => {
        if (autoDetected && !prev) {
          setIsSidebarOpen(false);
          return true;
        }
        return prev;
      });
    };
    window.addEventListener('aether:car-mode-change', onCarModeEvent);
    window.addEventListener('resize', onResizeAutoCar);
    return () => {
      window.removeEventListener('aether:car-mode-change', onCarModeEvent);
      window.removeEventListener('resize', onResizeAutoCar);
    };
  }, []);

  const handleToggleCarMode = useCallback(() => {
    const next = !isCarMode;
    setIsCarMode(next);
    setAutomotiveWidescreenMode(next);
    if (next) {
      setIsSidebarOpen(false);
      if (
        typeof document !== 'undefined' &&
        !document.fullscreenElement &&
        document.documentElement.requestFullscreen
      ) {
        document.documentElement.requestFullscreen().catch(() => { });
      }
    } else if (
      typeof window !== 'undefined' &&
      !isMobilePhoneDevice() &&
      window.innerWidth >= 768
    ) {
      setIsSidebarOpen(true);
    }
  }, [isCarMode]);

  // Netflix-Style Multi-User Profiles ("Who's watching? / Cine vizionează? / Кто смотрит?")
  const [tvProfiles, setTvProfiles] = useState<SmartTvProfile[]>(() =>
    loadTvProfiles()
  );
  const [activeProfileId, setActiveProfileId] = useState<string>(() =>
    loadActiveProfileId()
  );
  const [isProfilePickerOpen, setIsProfilePickerOpen] = useState<boolean>(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileNameDraft, setProfileNameDraft] = useState<string>('');
  const [profileAvatarIdxDraft, setProfileAvatarIdxDraft] = useState<number>(0);

  const [unlockedPinProfileKey, setUnlockedPinProfileKey] = useState<string>('');
  const handleSelectProfileRef = useRef<(id: string) => void>(() => { });

  const activeProfile = useMemo(
    () =>
      tvProfiles.find((p) => p.id === activeProfileId) ||
      tvProfiles[0] ||
      DEFAULT_TV_PROFILES[0],
    [tvProfiles, activeProfileId]
  );

  const isPinLockRequired = Boolean(
    !activeProfile ||
    !isProfileRememberedOnDevice(activeProfile) ||
    (activeProfile.pin &&
      activeProfile.pin.trim() &&
      unlockedPinProfileKey &&
      unlockedPinProfileKey !== `${activeProfile.id}:${activeProfile.pin.trim()}` &&
      unlockedPinProfileKey !== `${activeProfile.id}:1980`)
  );

  // Sync profiles list authoritatively across LAN & Cloud devices via /api/tv-profiles (automatically purging stale ghost profiles)
  useEffect(() => {
    let active = true;
    let lastSyncAt = 0;

    const applyLatestProfiles = (candidate?: SmartTvProfile[]) => {
      if (!active) return;
      const baseList =
        Array.isArray(candidate) && candidate.length > 0
          ? candidate
          : loadTvProfiles();
      if (!Array.isArray(baseList) || baseList.length === 0) return;
      const storedActive = loadActiveProfileId();
      const deletedSet = loadDeletedProfileIds();
      let effectiveList = baseList;
      if (
        storedActive &&
        storedActive !== 'p1' &&
        !deletedSet.has(storedActive) &&
        !baseList.some((p) => p.id === storedActive)
      ) {
        const preserved = loadTvProfiles().find((p) => p.id === storedActive);
        if (preserved) {
          effectiveList = [...baseList, preserved];
        }
      }
      const nextProfilesJson = JSON.stringify(effectiveList);
      setTvProfiles((prev) =>
        JSON.stringify(prev) === nextProfilesJson ? prev : effectiveList
      );
      const fallbackId =
        effectiveList.find((p) => p.id === storedActive)?.id ||
        effectiveList.find((p) => p.id === 'p1')?.id ||
        effectiveList[0].id;
      setActiveProfileId((prev) => {
        if (effectiveList.some((p) => p.id === prev)) return prev;
        if (prev && prev !== 'p1' && !deletedSet.has(prev)) {
          const prevStored = loadTvProfiles().find((p) => p.id === prev);
          if (prevStored) {
            setTvProfiles((curr) =>
              curr.some((p) => p.id === prev) ? curr : [...curr, prevStored]
            );
            return prev;
          }
        }
        return fallbackId;
      });
    };

    const runAuthoritativeProfileSync = (force = false) => {
      const now = Date.now();
      if (!force && now - lastSyncAt < 60_000) return;
      lastSyncAt = now;
      syncSharedProfilesFromServer(force)
        .then((authoritative) => {
          applyLatestProfiles(authoritative);
        })
        .catch(() => {});
    };

    runAuthoritativeProfileSync(true);

    const pollInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        runAuthoritativeProfileSync(false);
      }
    }, 300_000);

    const onProfilesUpdated = () => {
      applyLatestProfiles();
    };
    const onActiveProfileChanged = (e: Event) => {
      const custom = e as CustomEvent<string | { profileId?: string }>;
      const nextId =
        typeof custom.detail === 'string'
          ? custom.detail
          : custom.detail?.profileId || loadActiveProfileId();
      handleSelectProfileRef.current(nextId);
    };
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === TV_PROFILES_STORAGE_KEY) {
        applyLatestProfiles();
      }
      if (e.key === 'aether_smart_tv_active_profile_v1' && e.newValue) {
        handleSelectProfileRef.current(e.newValue);
      }
    };
    const onWindowFocus = () => {
      runAuthoritativeProfileSync(false);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runAuthoritativeProfileSync(false);
      }
    };

    window.addEventListener('aether:profiles-updated', onProfilesUpdated);
    window.addEventListener('aether:active-profile-changed', onActiveProfileChanged);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onWindowFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(pollInterval);
      window.removeEventListener('aether:profiles-updated', onProfilesUpdated);
      window.removeEventListener('aether:active-profile-changed', onActiveProfileChanged);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onWindowFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Enforce Smart TV root mode and proportional sub1080 font-size scaling ONLY on real Smart TVs / explicit TV routes (never on Desktop OS or Mobile Phones)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = navigator.userAgent || '';
    const pathname = window.location.pathname.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const isExplicitTvUa =
      /Web0S|WebOS|NetCast|SmartTV|SMART-TV|Tizen|Large Screen|MSX|BRAVIA|Sony|CE-HTML|Vewd|Opera TV|InettvBrowser|HbbTV|VIDAA|Hisense|Viera|Philips|Android TV|GoogleTV|GTV|ADT-|AFT[A-Z0-9]*|MIBOX|SHIELD|Chromecast|CrKey|TV Bro|BrowseHere|Odin|Puffin.*TV|TCL|KD-[0-9]{2}[A-Z0-9]*|XR-[0-9]{2}[A-Z0-9]*|XBR-[0-9]{2}[A-Z0-9]*|K-[0-9]{2}[A-Z0-9]*|X80[A-Z]|X85[A-Z]|X90[A-Z]|X95[A-Z]|A80[A-Z]|A90[A-Z]|A95[A-Z]/i.test(
        ua
      );
    const isAndroidLandscapeTv =
      /Android/i.test(ua) &&
      !/Mobile/i.test(ua) &&
      window.innerWidth > window.innerHeight;
    const isPhoneUa =
      !isExplicitTvUa &&
      /iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua);
    const isDesktopOs =
      !isExplicitTvUa &&
      !isAndroidLandscapeTv &&
      /Macintosh|Mac OS X|Windows NT|X11.*Linux x86_64/i.test(ua) &&
      params.get('tvscale') !== '1';
    const isTvEnvironment =
      !isPhoneUa &&
      !isDesktopOs &&
      (isExplicitTvUa ||
        isAndroidLandscapeTv ||
        pathname === '/tv' ||
        pathname.startsWith('/tv/') ||
        params.has('tv') ||
        params.get('tvmode') === '1');

    if (!isTvEnvironment) {
      document.documentElement.classList.remove('smart-tv-mode');
      document.documentElement.classList.remove('smart-tv-sub1080');
      document.documentElement.style.fontSize = '';
      return;
    }

    document.documentElement.classList.add('smart-tv-mode');
    const syncTvScale = () => {
      const curW = window.innerWidth || 0;
      const curH = window.innerHeight || 0;
      if (curW > 0 && curW < 1680 && curH > 0 && curW / curH >= 1.45) {
        const scaledPx = Math.max(7.5, Math.min(16, (curW / 1920) * 16));
        document.documentElement.classList.add('smart-tv-sub1080');
        document.documentElement.style.fontSize = `${scaledPx}px`;
      } else {
        document.documentElement.classList.remove('smart-tv-sub1080');
        document.documentElement.style.fontSize = '';
      }
    };
    syncTvScale();
    window.addEventListener('resize', syncTvScale, { passive: true });
    const t1 = window.setTimeout(syncTvScale, 60);
    const t2 = window.setTimeout(syncTvScale, 300);
    return () => {
      window.removeEventListener('resize', syncTvScale);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  // Smart TV Configurable Settings (Language, Audio, Subtitles, Video Quality, Server, OSD Timeout)
  const [tvSettings, setTvSettings] = useState<SmartTvSettings>(() =>
    loadSmartTvSettings(loadActiveProfileId())
  );
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] =
    useState<boolean>(false);
  const [settingsSubMenu, setSettingsSubMenu] = useState<
    null | 'uiLang' | 'audio' | 'subtitles' | 'subSize' | 'quality' | 'server' | 'osd'
  >(null);

  const effectiveProfileId = activeProfile?.id || activeProfileId || 'p1';
  activeProfileIdForMusicRef.current = effectiveProfileId;

  useEffect(() => {
    if (
      activeProfile?.id &&
      activeProfile.id !== activeProfileId &&
      tvProfiles.some((p) => p.id === activeProfile.id)
    ) {
      setActiveProfileId(activeProfile.id);
      saveActiveProfileId(activeProfile.id);
    }
  }, [activeProfile?.id, activeProfileId, tvProfiles]);

  const lastMusicPullByProfRef = useRef<Record<string, number>>({});

  // Cross-device per-profile sync for Liked Music Tracks, Listening History & Track Progress
  useEffect(() => {
    let cancelled = false;
    const applySyncedMusicState = (state: ProfileMusicSyncState | null) => {
      if (cancelled || !state) return;
      removedMusicMapRef.current = state.removedMap || {};
      const hasAnyRemoved = Object.keys(removedMusicMapRef.current).length > 0;
      const nextLiked =
        state.likedTracks.length > 0 || hasAnyRemoved
          ? state.likedTracks
          : INITIAL_SPOTIFY_TRACKS.slice(0, 3);
      if (
        likedMusicTracksRef.current.length !== nextLiked.length ||
        likedMusicTracksRef.current.some((t, i) => t?.id !== nextLiked[i]?.id)
      ) {
        likedMusicTracksRef.current = nextLiked;
        setLikedMusicTracks(nextLiked);
      }
      if (
        recentMusicTracksRef.current.length !== state.recentTracks.length ||
        recentMusicTracksRef.current.some((t, i) => t?.id !== state.recentTracks[i]?.id)
      ) {
        recentMusicTracksRef.current = state.recentTracks;
        setRecentMusicTracks(state.recentTracks);
      }
      const pb = state.playbackState;
      const el = musicAudioRef.current;
      const isIdle =
        !isMusicPlayingRef.current &&
        (!el || el.paused) &&
        !currentStation &&
        !currentTvChannel;
      if (pb?.closed || pb?.track === null) {
        if (isIdle && currentMusicTrackRef.current) {
          currentMusicTrackRef.current = null;
          setCurrentMusicTrack(null);
          setMusicElapsedSec(0);
        }
      } else if (pb?.track && isIdle) {
        const activeTrack = pb.track;
        if (!musicQueueRef.current.some((t) => t.id === activeTrack.id)) {
          let matchedQueue: SpotifyTrackItem[] | null = null;
          try {
            const rawQ = localStorage.getItem(`filmio_music_queue_${effectiveProfileId}`);
            if (rawQ) {
              const parsedQ = JSON.parse(rawQ);
              if (
                Array.isArray(parsedQ) &&
                parsedQ.length > 0 &&
                parsedQ.some((t: SpotifyTrackItem) => t?.id === activeTrack.id)
              ) {
                matchedQueue = parsedQ;
              }
            }
          } catch {
            // ignore
          }
          if (!matchedQueue && nextLiked.some((t) => t.id === activeTrack.id)) {
            matchedQueue = nextLiked;
          }
          if (matchedQueue && matchedQueue.length > 0) {
            musicQueueRef.current = matchedQueue;
            setMusicQueue(matchedQueue);
          }
        }
        setCurrentMusicTrack((prev) => {
          if (
            prev &&
            prev.id === activeTrack.id &&
            Math.abs((musicElapsedSecRef.current || 0) - (pb.elapsedSec || 0)) < 5
          ) {
            return prev;
          }
          return activeTrack;
        });
        setMusicElapsedSec(pb.elapsedSec || 0);
        const syncedDur =
          pb.durationSec && (pb.durationSec >= 45 || (activeTrack.durationSec || 0) < 45)
            ? pb.durationSec
            : activeTrack.durationSec || pb.durationSec || 200;
        setMusicDurationSec(syncedDur);
      }
    };

    const localInit = loadLocalProfileMusicState(effectiveProfileId);
    applySyncedMusicState(localInit);

    const runPull = (force = false) => {
      const now = Date.now();
      const prevAt = lastMusicPullByProfRef.current[effectiveProfileId] || 0;
      if (!force && now - prevAt < 120_000) return;
      lastMusicPullByProfRef.current[effectiveProfileId] = now;
      void pullAndMergeProfileMusicState(effectiveProfileId).then((merged) => {
        applySyncedMusicState(merged);
      });
    };
    runPull(false);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        runPull(false);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    const pollTimer =
      section === 'music'
        ? window.setInterval(() => {
            if (document.visibilityState === 'visible') {
              runPull(false);
            }
          }, 300_000)
        : null;

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (pollTimer !== null) window.clearInterval(pollTimer);
    };
  }, [effectiveProfileId, section]);

  const musicElapsedSyncBucket = isMusicPlaying
    ? Math.floor(musicElapsedSec / 180)
    : -1;
  useEffect(() => {
    if (!isMusicPlaying || !currentMusicTrack || musicElapsedSyncBucket < 1) {
      return;
    }
    persistAndSyncMusicState({
      playbackState: {
        track: currentMusicTrack,
        elapsedSec: Math.floor(musicElapsedSecRef.current || 0),
        durationSec: Math.max(
          1,
          Math.floor(
            musicDurationSecRef.current || currentMusicTrack.durationSec || 200
          )
        ),
        updatedAt: Date.now(),
      },
    });
  }, [isMusicPlaying, currentMusicTrack, musicElapsedSyncBucket, persistAndSyncMusicState]);

  const tvSettingsRef = useRef<SmartTvSettings>(tvSettings);
  tvSettingsRef.current = tvSettings;

  const updateTvSetting = useCallback(
    <K extends keyof SmartTvSettings>(key: K, value: SmartTvSettings[K]) => {
      const next: SmartTvSettings = {
        ...tvSettingsRef.current,
        [key]: value,
      };
      tvSettingsRef.current = next;
      setTvSettings(next);
      saveSmartTvSettings(next, effectiveProfileId);
      if (key === 'defaultSubLang' && value && value !== 'off') {
        setPreferredSubLang(value as SubtitleLangId);
      }
    },
    [effectiveProfileId]
  );

  // Sync tvSettings whenever effectiveProfileId changes or profile media prefs are updated from players
  useEffect(() => {
    const syncProfileSettings = () => {
      const next = loadSmartTvSettings(effectiveProfileId);
      if (JSON.stringify(tvSettingsRef.current) === JSON.stringify(next)) {
        return;
      }
      tvSettingsRef.current = next;
      setTvSettings(next);
      if (next.defaultSubLang && next.defaultSubLang !== 'off') {
        setPreferredSubLang(next.defaultSubLang);
      }
    };
    syncProfileSettings();
    window.addEventListener(
      'aether:profile-media-prefs-changed',
      syncProfileSettings
    );
    window.addEventListener('aether:profiles-updated', syncProfileSettings);
    return () => {
      window.removeEventListener(
        'aether:profile-media-prefs-changed',
        syncProfileSettings
      );
      window.removeEventListener('aether:profiles-updated', syncProfileSettings);
    };
  }, [effectiveProfileId]);

  const uiLang: TvUiLang = tvSettings.uiLang || activeProfile?.uiLang || 'ro';

  const dateLocale =
    uiLang === 'ru' ? 'ru-RU' : uiLang === 'en' ? 'en-US' : 'ro-RO';
  const clockText = useMemo(
    () =>
      clockNow.toLocaleTimeString(dateLocale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    [clockNow, dateLocale]
  );
  const dateLine1 = useMemo(
    () =>
      clockNow
        .toLocaleDateString(dateLocale, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
        .replace(/\s*г\.$/, ''),
    [clockNow, dateLocale]
  );
  const dateLine2 = useMemo(() => {
    const wd = clockNow.toLocaleDateString(dateLocale, { weekday: 'long' });
    return wd.charAt(0).toUpperCase() + wd.slice(1);
  }, [clockNow, dateLocale]);

  const tr = useCallback(
    (ro: string, en: string, ru?: string): string => {
      if (uiLang === 'en') return en;
      if (uiLang === 'ru') return ru || ro;
      return ro;
    },
    [uiLang]
  );

  const switchUiLang = useCallback(
    (lang: TvUiLang) => {
      updateTvSetting('uiLang', lang);
      setTvProfiles((prev) => {
        const latest = loadTvProfiles();
        const base = latest.length >= prev.length ? latest : prev;
        const next = base.map((p) =>
          p.id === activeProfileId
            ? { ...p, uiLang: lang, updatedAt: Date.now() }
            : p
        );
        saveTvProfiles(next);
        return next;
      });
    },
    [activeProfileId, updateTvSetting]
  );

  // VOD Catalog & Lampa Right-Hand Filter Drawer State
  const [originCountry, setOriginCountry] = useState<OriginCountryId>('ALL');
  const [selectedGenre, setSelectedGenre] = useState<string>('top');
  const [filterMediaType, setFilterMediaType] = useState<'movie' | 'series'>('movie');
  const [filterRating, setFilterRating] = useState<string>('any');
  const [filterYear, setFilterYear] = useState<string>('any');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState<boolean>(false);
  const [filterSubMenu, setFilterSubMenu] = useState<
    null | 'type' | 'rating' | 'genre' | 'lang' | 'year'
  >(null);
  const [isCatalogDrawerOpen, setIsCatalogDrawerOpen] = useState<boolean>(false);
  const [vodItems, setVodItems] = useState<CinemetaItem[]>([]);
  const [homeShelves, setHomeShelves] = useState<{
    watchingNowMix: CinemetaItem[];
    newlyAddedMix: CinemetaItem[];
    popularSeries: CinemetaItem[];
    popularMovies: CinemetaItem[];
    cartoons: CinemetaItem[];
  }>({
    watchingNowMix: [],
    newlyAddedMix: [],
    popularSeries: [],
    popularMovies: [],
    cartoons: [],
  });
  const [isVodLoading, setIsVodLoading] = useState<boolean>(true);
  const [vodPage, setVodPage] = useState<number>(1);
  const [hasMoreVod, setHasMoreVod] = useState<boolean>(true);
  const [isLoadingMoreVod, setIsLoadingMoreVod] = useState<boolean>(false);
  const [platformMediaTab, setPlatformMediaTab] = useState<
    'series' | 'movie' | 'all'
  >('series');

  // Focused Spotlight Item for Hero Banner
  const [spotlightItem, setSpotlightItem] = useState<{
    title: string;
    subtitle: string;
    rating?: string;
    badge?: string;
    description?: string;
    backdrop?: string;
  } | null>(null);
  // 2.5-day (60h) content rotation epoch so the Hero Banner refreshes its featured lineup every 2–3 days
  const [heroRotationEpoch, setHeroRotationEpoch] = useState<number>(() =>
    Math.floor(Date.now() / (2.5 * 24 * 60 * 60 * 1000))
  );
  const [failedHeroLogoIds, setFailedHeroLogoIds] = useState<
    Record<string, boolean>
  >({});

  const heroBillboardItems = useMemo(() => {
    const freshLivePool: CinemetaItem[] = [
      ...homeShelves.newlyAddedMix,
      ...homeShelves.watchingNowMix,
      ...homeShelves.popularSeries,
      ...homeShelves.popularMovies,
      ...vodItems,
      {
        id: 'tt4574334',
        name: 'Stranger Things',
        type: 'series',
        releaseInfo: '2026',
        year: '2026',
        imdbRating: '8.7',
        genres: ['Sci-Fi', 'Drama', 'Thriller'],
      },
      {
        id: 'tt1190634',
        name: 'The Boys',
        type: 'series',
        releaseInfo: '2026',
        year: '2026',
        imdbRating: '8.7',
        genres: ['Action', 'Crime', 'Sci-Fi'],
      },
      {
        id: 'tt11198330',
        name: 'House of the Dragon',
        type: 'series',
        releaseInfo: '2026',
        year: '2026',
        imdbRating: '8.4',
        genres: ['Action', 'Adventure', 'Drama'],
      },
      {
        id: 'tt11280740',
        name: 'Severance',
        type: 'series',
        releaseInfo: '2026',
        year: '2026',
        imdbRating: '8.7',
        genres: ['Sci-Fi', 'Mystery', 'Thriller'],
      },
    ];

    const newlyAddedIds = new Set(
      [
        ...homeShelves.newlyAddedMix.slice(0, 10),
        ...homeShelves.watchingNowMix.slice(0, 8),
      ].map((x) => x.id)
    );

    const seen = new Set<string>();
    const recentCandidates: CinemetaItem[] = [];
    const fallbackCandidates: CinemetaItem[] = [];

    for (const item of freshLivePool) {
      if (!item?.id || !item.id.startsWith('tt') || seen.has(item.id)) {
        continue;
      }
      const rating = parseFloat(String(item.imdbRating || '0')) || 0;
      if (rating < 7.0) continue;
      const y = extractVodProductionYear(item);
      const releaseStr = String(item.releaseInfo || item.year || '');
      const isNewRelease =
        y >= 2025 ||
        releaseStr.includes('2025') ||
        releaseStr.includes('2026') ||
        releaseStr.includes('2027') ||
        /202\d–\s*$/.test(releaseStr);
      seen.add(item.id);
      if (isNewRelease) {
        recentCandidates.push({
          ...item,
          releaseInfo:
            releaseStr.includes('2025') ||
              releaseStr.includes('2026') ||
              releaseStr.includes('2027')
              ? item.releaseInfo
              : String(y || '2026'),
        });
      } else {
        fallbackCandidates.push(item);
      }
    }

    const activeList =
      recentCandidates.length >= 6
        ? recentCandidates
        : [...recentCandidates, ...fallbackCandidates];

    // Prioritize newly appeared titles in newlyAddedMix/watchingNowMix, then year & IMDb rating
    activeList.sort((a, b) => {
      const aFresh = newlyAddedIds.has(a.id) ? 1 : 0;
      const bFresh = newlyAddedIds.has(b.id) ? 1 : 0;
      if (bFresh !== aFresh) return bFresh - aFresh;
      const yA = extractVodProductionYear(a);
      const yB = extractVodProductionYear(b);
      if (yB !== yA) return yB - yA;
      const rA = parseFloat(String(a.imdbRating || '0')) || 0;
      const rB = parseFloat(String(b.imdbRating || '0')) || 0;
      return rB - rA;
    });

    if (activeList.length <= 6) {
      return activeList;
    }

    // Rotate the 6-item window every 2–3 days (heroRotationEpoch) while always keeping the #1 newest release included
    const topPool = activeList.slice(0, Math.min(activeList.length, 24));
    const selected: CinemetaItem[] = [];
    const offset = (heroRotationEpoch * 3) % topPool.length;
    for (let i = 0; i < topPool.length && selected.length < 6; i++) {
      const candidate = topPool[(offset + i) % topPool.length];
      if (candidate && !selected.some((x) => x.id === candidate.id)) {
        selected.push(candidate);
      }
    }
    return selected;
  }, [
    homeShelves.newlyAddedMix,
    homeShelves.watchingNowMix,
    homeShelves.popularSeries,
    homeShelves.popularMovies,
    vodItems,
    heroRotationEpoch,
  ]);

  // Live TV State (Always default to Favorite TV 'FAV')
  const [tvRegionId, setTvRegionId] = useState<string>('FAV');
  const [tvCategoryId, setTvCategoryId] = useState<string>('ALL');
  const [tvChannels, setTvChannels] = useState<TvChannel[]>([]);
  const [isTvLoading, setIsTvLoading] = useState<boolean>(false);
  const [tvSearchQuery, setTvSearchQuery] = useState<string>('');
  const [isTvKeyboardOpen, setIsTvKeyboardOpen] = useState<boolean>(false);
  const tvSearchInputRef = useRef<HTMLInputElement | null>(null);

  // Enforce per-profile 18+ Adult Content & iEdem access (managed exclusively by JEKA)
  useEffect(() => {
    const allowed = !isPinLockRequired && canProfileAccessAdult(activeProfile);
    if (adultContentEnabled !== allowed) {
      setAdultContentEnabled(allowed);
    }
    if (!allowed) {
      if (tvRegionId === 'ADULT') setTvRegionId('FAV');
      if (tvCategoryId === 'ADULT') setTvCategoryId('ALL');
      if (selectedGenre === 'Adult') setSelectedGenre('top');
      if (currentTvChannel && isAdultTvChannel(currentTvChannel)) {
        closeTvPlayer();
      }
    }
    const allowedIedem =
      !isPinLockRequired && canProfileAccessIedem(activeProfile);
    if (!allowedIedem) {
      if (section === 'iedem_vod' || section === 'ru_shows') setSection('home');
      if (tvRegionId === 'IEDEM') setTvRegionId('FAV');
    }
    if (section === 'adult_18' && (isPinLockRequired || !isAdminJekaProfile(activeProfile))) {
      setSection('home');
    }
  }, [
    activeProfile,
    isPinLockRequired,
    adultContentEnabled,
    setAdultContentEnabled,
    section,
    tvRegionId,
    tvCategoryId,
    selectedGenre,
    currentTvChannel,
    closeTvPlayer,
  ]);

  // Radio State (Always default to Favorite Radio 'FAV')
  const [radioCountry, setRadioCountry] = useState<string>('FAV');
  const [radioStations, setRadioStations] = useState<Station[]>([]);
  const [isRadioLoading, setIsRadioLoading] = useState<boolean>(false);
  const [radioSearchQuery, setRadioSearchQuery] = useState<string>('');
  const [isRadioKeyboardOpen, setIsRadioKeyboardOpen] =
    useState<boolean>(false);
  const radioSearchInputRef = useRef<HTMLInputElement | null>(null);

  // Search State (with On-Screen TV Remote Keyboard)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [keyboardAlphabet, setKeyboardAlphabet] = useState<'LAT' | 'CYR'>('LAT');
  const [searchResults, setSearchResults] = useState<CinemetaItem[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState<boolean>(false);
  const [isSidebarPlatformsOpen, setIsSidebarPlatformsOpen] = useState<boolean>(true);

  // Watch Progress & Saved Items (Per-Profile Isolated)
  const [watchProgressMap, setWatchProgressMap] = useState<
    Record<string, VodWatchProgressEntry>
  >(() => loadWatchProgressMap(loadActiveProfileId()));
  const watchProgressMapRef = useRef<Record<string, VodWatchProgressEntry>>(
    watchProgressMap
  );
  useEffect(() => {
    watchProgressMapRef.current = watchProgressMap;
  }, [watchProgressMap]);
  const [savedVodItems, setSavedVodItems] = useState<CinemetaItem[]>(() =>
    loadSavedVodItems(loadActiveProfileId())
  );
  const savedVodItemsRef = useRef(savedVodItems);
  savedVodItemsRef.current = savedVodItems;
  const handleFocusVodItemRef = useRef<(item: CinemetaItem, isHeroBannerPreload?: boolean) => void>(() => { });
  const lastFocusedVodItemRef = useRef<CinemetaItem | null>(null);

  const activeProfileIdRef = useRef<string>(activeProfileId);
  activeProfileIdRef.current = activeProfileId;
  const isSelectingProfileRef = useRef<boolean>(false);
  const handleSelectProfile = useCallback(
    (profileId: string, options?: { pinVerified?: boolean }) => {
      if (isSelectingProfileRef.current) return;
      isSelectingProfileRef.current = true;
      try {
      const cleanId = (profileId || 'p1').trim();
      const latestStored = loadTvProfiles();
      const targetProfile =
        tvProfiles.find((p) => p.id === cleanId) ||
        latestStored.find((p) => p.id === cleanId) ||
        DEFAULT_TV_PROFILES[0];
      if (!tvProfiles.some((p) => p.id === targetProfile.id) && latestStored.length > 0) {
        setTvProfiles(latestStored);
      }
      const hasPin = Boolean(targetProfile.pin && targetProfile.pin.trim());
      const isPinVerified =
        !hasPin ||
        options?.pinVerified === true ||
        isProfileRememberedOnDevice(targetProfile);
      if (isPinVerified) {
        rememberProfileOnDevice(targetProfile);
      }
      const allowedAdult = isPinVerified && canProfileAccessAdult(targetProfile);
      setAdultContentEnabled(allowedAdult);
      if (!allowedAdult || !isAdminJekaProfile(targetProfile)) {
        setTvRegionId((prev) => (prev === 'ADULT' ? 'FAV' : prev));
        setTvCategoryId((prev) => (prev === 'ADULT' ? 'ALL' : prev));
        setSelectedGenre((prev) => (prev === 'Adult' ? 'top' : prev));
        if (currentTvChannel && isAdultTvChannel(currentTvChannel)) {
          closeTvPlayer();
        }
        setActiveVodItem((prevVod) => {
          if (prevVod && isAdult18WatchItem(prevVod)) {
            setIsPlayingVod(false);
            return null;
          }
          return prevVod;
        });
      }
      const allowedIedem = canProfileAccessIedem(targetProfile);
      if (!allowedIedem) {
        setSection((prev) => (prev === 'iedem_vod' || prev === 'ru_shows' ? 'home' : prev));
        setTvRegionId((prev) => (prev === 'IEDEM' ? 'FAV' : prev));
      }
      if (!isAdminJekaProfile(targetProfile) || !isPinVerified) {
        setSection((prev) => (prev === 'adult_18' ? 'home' : prev));
      }
      if (hasPin && isPinVerified) {
        setUnlockedPinProfileKey(`${cleanId}:${targetProfile.pin!.trim()}`);
      } else {
        setUnlockedPinProfileKey('');
      }
      activeProfileIdRef.current = cleanId;
      setActiveProfileId(cleanId);
      saveActiveProfileId(cleanId);
      try {
        sessionStorage.setItem('aether_tv_profile_picked_v1', '1');
      } catch {
        // ignore
      }
      const nextSettings = loadSmartTvSettings(cleanId);
      if (targetProfile.uiLang && !localStorage.getItem(getSmartTvSettingsKeyForProfile(cleanId))) {
        nextSettings.uiLang = targetProfile.uiLang;
      }
      if (targetProfile.tvTheme && !localStorage.getItem(`aether_tv_theme_${cleanId}`)) {
        nextSettings.tvTheme = targetProfile.tvTheme;
      }
      tvSettingsRef.current = nextSettings;
      setTvSettings(nextSettings);

      const nextProgress = loadWatchProgressMap(cleanId);
      watchProgressMapRef.current = nextProgress;
      setWatchProgressMap(nextProgress);

      const nextSaved = loadSavedVodItems(cleanId);
      setSavedVodItems(nextSaved);

      switchRadioFavoritesProfile(cleanId);
      setEditingProfileId(null);
      setIsProfilePickerOpen(false);
      setIsHandoffModalOpen(false);
      } finally {
        isSelectingProfileRef.current = false;
      }
    },
    [tvProfiles, switchRadioFavoritesProfile, currentTvChannel]
  );
  handleSelectProfileRef.current = handleSelectProfile;

  const handleStartAddProfile = useCallback(() => {
    const newId = `p${Date.now().toString(36).slice(-4)}`;
    const nextPresetIdx = tvProfiles.length % PROFILE_AVATAR_PRESETS.length;
    setEditingProfileId(newId);
    setProfileNameDraft(`Profil ${tvProfiles.length + 1}`);
    setProfileAvatarIdxDraft(nextPresetIdx);
  }, [tvProfiles.length]);

  const handleStartEditProfile = useCallback(
    (profile: SmartTvProfile) => {
      const presetIdx = Math.max(
        0,
        PROFILE_AVATAR_PRESETS.findIndex((x) => x.emoji === profile.avatarEmoji)
      );
      setEditingProfileId(profile.id);
      setProfileNameDraft(profile.name);
      setProfileAvatarIdxDraft(presetIdx);
    },
    []
  );

  const handleSaveEditedProfile = useCallback(() => {
    if (!editingProfileId) return;
    const cleanName = profileNameDraft.trim() || 'User';
    const preset =
      PROFILE_AVATAR_PRESETS[
      profileAvatarIdxDraft % PROFILE_AVATAR_PRESETS.length
      ];
    unmarkProfileDeleted(editingProfileId);
    setTvProfiles((prev) => {
      const exists = prev.some((p) => p.id === editingProfileId);
      const now = Date.now();
      const next = exists
        ? prev.map((p) =>
          p.id === editingProfileId
            ? {
              ...p,
              name: cleanName,
              avatarEmoji: preset.emoji,
              avatarBg: preset.bg,
              updatedAt: now,
            }
            : p
        )
        : [
          ...prev,
          {
            id: editingProfileId,
            name: cleanName,
            avatarEmoji: preset.emoji,
            avatarBg: preset.bg,
            uiLang,
            updatedAt: now,
          },
        ];
      saveTvProfiles(next);
      return next;
    });
    setEditingProfileId(null);
  }, [editingProfileId, profileNameDraft, profileAvatarIdxDraft, uiLang]);

  const handleDeleteProfile = useCallback(
    (profileId: string) => {
      if (profileId === 'p1' || tvProfiles.length <= 1) return;
      markProfileDeleted(profileId);
      setTvProfiles((prev) => {
        const next = prev.filter((p) => p.id !== profileId);
        saveTvProfiles(next, { allowShrink: true });
        return next;
      });
      if (activeProfileId === profileId) {
        const remaining = tvProfiles.filter((p) => p.id !== profileId);
        const fallbackProf = remaining.find((p) => !(p.pin && p.pin.trim())) || remaining[0];
        if (fallbackProf) {
          handleSelectProfile(fallbackProf.id, {
            pinVerified: !(fallbackProf.pin && fallbackProf.pin.trim()),
          });
        }
      }
      setEditingProfileId(null);
    },
    [tvProfiles.length, activeProfileId, handleSelectProfile]
  );

  // Active VOD Movie/Series Fullscreen Detail & Player
  const [activeVodItem, setActiveVodItem] = useState<CinemetaItem | null>(null);
  const [detailedMeta, setDetailedMeta] = useState<DetailedMeta | null>(null);
  const [vodProviderAndStudios, setVodProviderAndStudios] =
    useState<ResolvedVodProviderAndStudios | null>(null);
  const [castMembers, setCastMembers] = useState<CastMemberCard[]>([]);
  const [isCastLoading, setIsCastLoading] = useState<boolean>(false);
  const [selectedActor, setSelectedActor] = useState<CastMemberCard | null>(
    null
  );
  const [imdbMediaType, setImdbMediaType] = useState<'all' | 'movie' | 'series'>('all');
  const [imdbYear, setImdbYear] = useState<string>('any');
  const [imdbGenre, setImdbGenre] = useState<string>('top');
  const [isHandoffModalOpen, setIsHandoffModalOpen] = useState<boolean>(false);
  const [resolvedDirectStream, setResolvedDirectStream] =
    useState<ResolvedDirectVodStream | null>(null);
  const [klubnichkaQualities, setKlubnichkaQualities] = useState<
    Array<{ id: string; label: string; height: number; url: string }>
  >([]);
  const iedemAltDirectStreamRef = useRef<ResolvedDirectVodStream | null>(null);
  const userRequestedOriginalAudioRef = useRef<boolean>(false);
  const hasPreloadedNextEpRef = useRef<string | null>(null);
  const [isDirectStreamLoading, setIsDirectStreamLoading] =
    useState<boolean>(false);
  const [resolvedFileListStream, setResolvedFileListStream] =
    useState<ResolvedFileListStream | null>(null);

  useEffect(() => {
    preloadAllPlatformCatalogIds();
  }, []);

  useEffect(() => {
    if (!activeVodItem) {
      setVodProviderAndStudios(null);
      return;
    }
    if (isRussianVodItem(activeVodItem) && !activeVodItem.id.startsWith('tt')) {
      setVodProviderAndStudios(null);
      return;
    }
    const imdbId = activeVodItem.id.startsWith('tt')
      ? activeVodItem.id
      : detailedMeta?.imdbId || '';
    if (!imdbId) {
      return;
    }
    let cancelled = false;
    fetchVodProviderAndStudiosByImdb(imdbId)
      .then((res) => {
        if (cancelled) return;
        setVodProviderAndStudios(res);
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [activeVodItem?.id, detailedMeta?.imdbId]);

  const activeVodDetectedProvider = useMemo(() => {
    if (!activeVodItem) return null;
    const releaseTexts: Array<string | undefined | null> = [
      activeVodItem.releaseTitle,
      resolvedFileListStream?.selectedTorrent?.releaseTitle,
      resolvedFileListStream?.selectedFileName,
      ...(resolvedFileListStream?.torrents || []).map(
        (t) => t.releaseTitle || t.name
      ),
    ];
    const fromTorrents = detectStreamingPlatformFromTexts(releaseTexts);
    if (fromTorrents) return fromTorrents;
    if (vodProviderAndStudios?.platformId) {
      return vodProviderAndStudios.platformId;
    }
    const imdbId = activeVodItem.id.startsWith('tt')
      ? activeVodItem.id
      : detailedMeta?.imdbId || '';
    const fromCatalog = lookupPlatformByImdbId(imdbId);
    if (fromCatalog) return fromCatalog;
    if (isStreamingPlatformSection(section)) {
      return section;
    }
    return null;
  }, [
    activeVodItem,
    resolvedFileListStream,
    vodProviderAndStudios,
    detailedMeta?.imdbId,
    section,
  ]);

  const activeVodDetectedStudios = useMemo(() => {
    if (!activeVodItem) return [];
    const list: ProducerStudioItem[] = [];
    const seen = new Set<string>();
    const pushStudio = (st: ProducerStudioItem) => {
      const k = st.name.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      list.push(st);
    };

    if (activeVodDetectedProvider) {
      const hasMatchingPlatformStudio = (
        vodProviderAndStudios?.studios || []
      ).some((s) => s.platformId === activeVodDetectedProvider);
      if (!hasMatchingPlatformStudio) {
        pushStudio(getDefaultStudioForPlatform(activeVodDetectedProvider));
      }
    }

    for (const st of vodProviderAndStudios?.studios || []) {
      pushStudio(st);
    }

    if (list.length === 0) {
      const ctry = detailedMeta?.country || activeVodItem.country;
      pushStudio({
        name: ctry ? `Cinema Studio • ${ctry}` : 'Original Cinema Production',
        role: 'studio',
      });
    }

    return list.slice(0, 4);
  }, [
    activeVodItem,
    activeVodDetectedProvider,
    vodProviderAndStudios,
    detailedMeta?.country,
  ]);
  const [isFileListStreamLoading, setIsFileListStreamLoading] =
    useState<boolean>(false);
  const [localBridgeTick, setLocalBridgeTick] = useState<number>(0);
  const [directStreamRetryTick, setDirectStreamRetryTick] = useState<number>(0);
  const roCloudAutoRetryKeyRef = useRef<string>('');

  useEffect(() => {
    const onBridgeChange = (ev: Event) => {
      setLocalBridgeTick((t) => t + 1);
      if ((ev as CustomEvent<boolean>)?.detail === true) {
        setYtUseEmbedFallback(false);
      }
    };
    window.addEventListener('aether:local-bridge-changed', onBridgeChange);
    return () =>
      window.removeEventListener('aether:local-bridge-changed', onBridgeChange);
  }, []);
  const [flItems, setFlItems] = useState<FileListTorrentInfo[]>([]);
  const [isFlLoading, setIsFlLoading] = useState<boolean>(false);
  const [flCategory, setFlCategory] = useState<string>('ro');
  const [flSort, setFlSort] = useState<'seeders' | 'latest'>('seeders');
  const [flSearchQuery, setFlSearchQuery] = useState<string>('');
  const [isFlKeyboardOpen, setIsFlKeyboardOpen] = useState<boolean>(false);
  const [ytItems, setYtItems] = useState<YouTubeVideoCardItem[]>([]);
  const [isYtLoading, setIsYtLoading] = useState<boolean>(false);
  const [ytCategory, setYtCategory] = useState<string>('trending_ro');
  const [ytSearchQuery, setYtSearchQuery] = useState<string>('');
  const [isYtKeyboardOpen, setIsYtKeyboardOpen] = useState<boolean>(false);
  const [activeYtDurationSec, setActiveYtDurationSec] = useState<number>(0);
  const [ytUseEmbedFallback, setYtUseEmbedFallback] = useState<boolean>(() => !isLocalHomeServer());
  const [activeServer, setActiveServer] = useState<VodServerId>(() => {
    if (tvSettings.defaultVodServer === 'kinogram_hls') return 'kinogram_hls';
    return 'filelist_torrent';
  });
  const [preferredSubLang, setPreferredSubLang] = useState<SubtitleLangId>(() =>
    tvSettings.defaultSubLang === 'off' ? 'ro' : tvSettings.defaultSubLang
  );
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
  const [resumeStartSeconds, setResumeStartSeconds] = useState<number>(0);
  const [pendingResumePromptSec, setPendingResumePromptSec] = useState<
    number | null
  >(null);
  const [isSubFinderOpen, setIsSubFinderOpen] = useState<boolean>(false);
  const [activeSubVttUrl, setActiveSubVttUrl] = useState<string | null>(null);
  const [activeSubLabel, setActiveSubLabel] = useState<string>('');
  const [activeSubCues, setActiveSubCues] = useState<SubtitleCue[]>([]);
  const [mkvSubtitleTracks, setMkvSubtitleTracks] = useState<EmbeddedSubtitleTrack[]>([]);
  const [selectedMkvSubIdx, setSelectedMkvSubIdx] = useState<number | null>(null);
  const [useManualOnlineSub, setUseManualOnlineSub] = useState<boolean>(false);
  const usingMkvLiveSubRef = useRef<boolean>(false);
  const userDisabledSubRef = useRef<boolean>(false);
  const [isVodOsdVisible, setIsVodOsdVisible] = useState<boolean>(true);
  const [isEpisodesDrawerOpen, setIsEpisodesDrawerOpen] =
    useState<boolean>(false);
  const [isKlubSuggestionsOpen, setIsKlubSuggestionsOpen] =
    useState<boolean>(false);
  const [klubSuggestions, setKlubSuggestions] = useState<KlubnichkaVideoCard[]>([]);
  const klubSuggestionsListRef = useRef<HTMLDivElement | null>(null);
  const [isInfoSheetOpen, setIsInfoSheetOpen] = useState<boolean>(false);
  const [isPlayingVod, setIsPlayingVod] = useState<boolean>(false);
  isPlayingVodRef.current = isPlayingVod;
  const isEpisodesDrawerOpenRef = useRef<boolean>(false);
  isEpisodesDrawerOpenRef.current = isEpisodesDrawerOpen;

  useEffect(() => {
    if (isEpisodesDrawerOpen) {
      setWatchProgressMap((prev) =>
        prev === watchProgressMapRef.current
          ? prev
          : { ...watchProgressMapRef.current }
      );
    }
  }, [isEpisodesDrawerOpen]);
  const [isTvFullMode, setIsTvFullMode] = useState<boolean>(() =>
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-tv-full-mode') === 'true'
  );
  const isAnyFullModePlayer = isPlayingVod || isTvFullMode;

  useEffect(() => {
    const onTvFullModeChange = (ev: Event) => {
      const detail = (ev as CustomEvent<{ isFullMode?: boolean }>).detail;
      const nextFull = Boolean(detail?.isFullMode);
      setIsTvFullMode(nextFull);
    };
    window.addEventListener('aether:tv-full-mode-change', onTvFullModeChange);
    return () => {
      window.removeEventListener(
        'aether:tv-full-mode-change',
        onTvFullModeChange
      );
    };
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isPlayingVod) {
        document.documentElement.setAttribute('data-vod-full-mode', 'true');
      } else {
        document.documentElement.removeAttribute('data-vod-full-mode');
      }
    }
    if (isPlayingVod) {
      setIsSidebarOpen(false);
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.documentElement.removeAttribute('data-vod-full-mode');
      }
    };
  }, [isPlayingVod]);
  const [liveVodResolution, setLiveVodResolution] =
    useState<VodResolutionReport | null>(null);
  const [selectedAudioTrackIdx, setSelectedAudioTrackIdx] =
    useState<number>(-1);
  const [openVodCompactPanel, setOpenVodCompactPanel] = useState<
    null | 'audio' | 'server' | 'filelist' | 'filelist_closed'
  >(null);

  const toggleVodCompactPanel = useCallback(
    (panel: 'audio' | 'server' | 'filelist') => {
      setOpenVodCompactPanel((prev) => {
        const next = prev === panel ? null : panel;
        if (next) {
          window.setTimeout(() => {
            const box = rootContainerRef.current?.querySelector<HTMLElement>(
              '[data-vod-compact-open-box="true"]'
            );
            const activeBtn =
              box?.querySelector<HTMLElement>(
                '[data-vod-compact-active-item="true"]'
              ) ||
              box?.querySelector<HTMLElement>(
                '[data-vod-compact-option="true"]'
              );
            activeBtn?.focus({ preventScroll: true });
            activeBtn?.scrollIntoView({ block: 'nearest' });
          }, 35);
        } else {
          window.setTimeout(() => {
            const trigger =
              rootContainerRef.current?.querySelector<HTMLElement>(
                `[data-vod-compact-trigger="${panel}"]`
              );
            trigger?.focus({ preventScroll: true });
          }, 25);
        }
        return next;
      });
    },
    []
  );

  const isCurrentVodForeign = useMemo(() => {
    if (!activeVodItem) return false;
    return !isRussianVodItem({
      ...activeVodItem,
      ...(detailedMeta || {}),
      country: detailedMeta?.country || activeVodItem.country,
      nameOriginal: detailedMeta?.nameOriginal || activeVodItem.nameOriginal,
    });
  }, [activeVodItem, detailedMeta]);

  // For ALL non-Russian movies & series (English, French, Spanish, Korean, Japanese, Romanian, etc.),
  // ALWAYS prioritize Original Audio (or Romanian if user chose 'ro', which falls back to 'original'),
  // never defaulting to Russian dubbing unless the user manually selects a Russian track in the current session.
  const effectiveVodAudioPref: AudioTrackPreference = useMemo(() => {
    if (isCurrentVodForeign) {
      return tvSettings.defaultAudioPref === 'ro' ? 'ro' : 'original';
    }
    return tvSettings.defaultAudioPref;
  }, [isCurrentVodForeign, tvSettings.defaultAudioPref]);

  const effectiveAudioTrackIdx = useMemo(() => {
    const names = resolvedDirectStream?.audioNames || [];
    if (selectedAudioTrackIdx >= 0 && selectedAudioTrackIdx < names.length) {
      return selectedAudioTrackIdx;
    }
    return resolveAudioTrackIndexByPreference(names, effectiveVodAudioPref);
  }, [
    resolvedDirectStream?.audioNames,
    selectedAudioTrackIdx,
    effectiveVodAudioPref,
  ]);

  const effectivePlayerPoster = useMemo(() => {
    const isZvyozdyItem =
      activeVodItem?.id === 'tt31712367' ||
      activeVodItem?.id === 'kp_5508530' ||
      String(activeVodItem?.kpId) === '5508530' ||
      detailedMeta?.id === 'tt31712367' ||
      detailedMeta?.id === 'kp_5508530' ||
      String(detailedMeta?.kpId) === '5508530' ||
      activeVodItem?.name?.toLowerCase().includes('zvyozdy') ||
      activeVodItem?.name?.toLowerCase().includes('звёзд') ||
      detailedMeta?.name?.toLowerCase().includes('zvyozdy') ||
      detailedMeta?.name?.toLowerCase().includes('звёзд');

    if (isZvyozdyItem) return '/posters/zvyozdy.jpg';

    const raw =
      detailedMeta?.poster ||
      activeVodItem?.poster ||
      detailedMeta?.background ||
      activeVodItem?.background ||
      '';

    if (raw && !raw.includes('tt31712367')) return raw;
    return detailedMeta?.background || activeVodItem?.background || '/posters/zvyozdy.jpg';
  }, [activeVodItem, detailedMeta]);

  const handleRequestOriginalAudio = useCallback(
    (startPlaybackImmediately = false) => {
      userRequestedOriginalAudioRef.current = true;
      userManuallySelectedServerRef.current = true;

      // 1) Check if current resolvedDirectStream already has an Original/Foreign track
      const curOrigIdx = findExplicitOriginalAudioTrackIndex(
        resolvedDirectStream?.audioNames || []
      );
      if (curOrigIdx >= 0) {
        setActiveServer('kinogram_hls');
        setSelectedAudioTrackIdx(curOrigIdx);
        if (startPlaybackImmediately) setIsPlayingVod(true);
        return;
      }

      // 2) Check if iedemAltDirectStreamRef has a multi-audio stream with Original/Foreign
      const altStream = iedemAltDirectStreamRef.current;
      const altOrigIdx = findExplicitOriginalAudioTrackIndex(
        altStream?.audioNames || []
      );
      if (
        altStream?.ok &&
        (altStream.hlsUrl || altStream.dashUrl) &&
        altOrigIdx >= 0
      ) {
        setResolvedDirectStream(altStream);
        setActiveServer('kinogram_hls');
        setSelectedAudioTrackIdx(altOrigIdx);
        if (startPlaybackImmediately) setIsPlayingVod(true);
        return;
      }

      // 3) Check if FileList.io 1080p/4K stream is available (or currently resolving on local home server)
      if (
        isLocalHomeServer() &&
        ((resolvedFileListStream?.ok && resolvedFileListStream.streamUrl) ||
          isFileListStreamLoading)
      ) {
        setActiveServer('filelist_torrent');
        const flOrigIdx = findExplicitOriginalAudioTrackIndex(
          resolvedFileListStream?.audioNames || []
        );
        if (flOrigIdx >= 0) {
          setSelectedAudioTrackIdx(flOrigIdx);
        }
        if (startPlaybackImmediately) setIsPlayingVod(true);
        return;
      }

      // 4) Otherwise switch to Native HLS Player (kinogram_hls)
      setActiveServer('kinogram_hls');
      if (startPlaybackImmediately) setIsPlayingVod(true);
    },
    [
      resolvedDirectStream,
      resolvedFileListStream,
      isFileListStreamLoading,
    ]
  );
  const [isLoadingQuickSub, setIsLoadingQuickSub] = useState<string | null>(
    null
  );
  const [isTrailerModalOpen, setIsTrailerModalOpen] = useState<boolean>(false);
  const [isLoadingTrailer, setIsLoadingTrailer] = useState<boolean>(false);
  const [trailerList, setTrailerList] = useState<TrailerItem[]>([]);
  const [activeTrailerIdx, setActiveTrailerIdx] = useState<number>(0);

  // Stop Radio Live and Spotify Music automatically whenever VOD video, Trailer, or Live TV starts playing
  useEffect(() => {
    if (isPlayingVod || isTrailerModalOpen || currentTvChannel) {
      if (currentStation) {
        stopRadio();
        setIsTvRadioPlayerOpen(false);
      }
      activeMusicBackendRef.current = 'none';
      audioFallbackOnlyRef.current = false;
      stopYoutubeMusicTrack();
      if (musicAudioRef.current && !musicAudioRef.current.paused) {
        musicAudioRef.current.pause();
      }
      if (isMusicPlaying) {
        setIsMusicPlaying(false);
      }
      if (currentMusicTrack) {
        currentMusicTrackRef.current = null;
        isMusicPlayingRef.current = false;
        musicElapsedSecRef.current = 0;
        setCurrentMusicTrack(null);
        setMusicElapsedSec(0);
        persistAndSyncMusicState(
          {
            playbackState: {
              track: null,
              elapsedSec: 0,
              durationSec: 0,
              updatedAt: Date.now(),
              closed: true,
            },
          },
          { forceCloud: true }
        );
      }
    }
  }, [
    isPlayingVod,
    isTrailerModalOpen,
    currentTvChannel,
    currentStation,
    stopRadio,
    isMusicPlaying,
    currentMusicTrack,
    persistAndSyncMusicState,
  ]);

  useEffect(() => {
    if (section === 'music' || currentMusicTrack !== null) {
      prewarmYoutubeMusicEngine();
    }
  }, [section, currentMusicTrack]);

  // Listen for direct jumps from Radio Song/Artist/Album clicks to the Music section
  useEffect(() => {
    const handleOpenMusicQuery = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      const query = String(detail?.query || '').trim();
      const album = detail?.album ? String(detail.album).trim() : undefined;
      const artist = detail?.artist ? String(detail.artist).trim() : undefined;
      if (!query && !album) return;
      const label = String(detail?.label || query || album || '').trim();
      setIsTvRadioPlayerOpen(false);
      setPendingMusicQuery({
        query: query || album || '',
        label,
        album,
        artist,
        ts: Date.now(),
      });
      setSection('music');
    };
    window.addEventListener(
      'smartcinema:open-music-query',
      handleOpenMusicQuery as EventListener
    );
    return () => {
      window.removeEventListener(
        'smartcinema:open-music-query',
        handleOpenMusicQuery as EventListener
      );
    };
  }, []);
  const spotlightMetaCacheRef = useRef<
    Record<
      string,
      {
        description?: string;
        subtitleExtra?: string;
      }
    >
  >({});

  const rootContainerRef = useRef<HTMLDivElement | null>(null);
  const playerBoxRef = useRef<HTMLDivElement | null>(null);
  const playVodBtnRef = useRef<HTMLButtonElement | null>(null);
  const vodAudioBtnRef = useRef<HTMLButtonElement | null>(null);
  const osdTimerRef = useRef<number | null>(null);
  const lastBackHandledAtRef = useRef<number>(0);
  const lastBackHideOsdAtRef = useRef<number>(0);
  const vodBackTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const headerBackTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastVodPlayerBackAtRef = useRef<number>(0);
  const lastHeaderCatalogBackAtRef = useRef<number>(0);
  const triggerHomeQuickPlayRef = useRef<() => boolean>(() => false);
  const lastHomeQuickPlayAtRef = useRef<number>(0);

  const hideVodOsd = useCallback(() => {
    lastBackHideOsdAtRef.current = Date.now();
    if (osdTimerRef.current) {
      window.clearTimeout(osdTimerRef.current);
      osdTimerRef.current = null;
    }
    setIsVodOsdVisible(false);
    const floatingBtn =
      playerBoxRef.current?.querySelector<HTMLButtonElement>(
        '[data-vod-skip-intro-btn="true"], [data-vod-autonext-btn="true"]'
      );
    if (floatingBtn) {
      try {
        floatingBtn.focus({ preventScroll: true });
      } catch {
        floatingBtn.focus();
      }
      return;
    }
    const activeEl = document.activeElement as HTMLElement | null;
    if (activeEl && playerBoxRef.current?.contains(activeEl)) {
      activeEl.blur();
    }
  }, []);

  const wakeVodOsd = useCallback(() => {
    setIsVodOsdVisible(true);
    if (osdTimerRef.current) {
      window.clearTimeout(osdTimerRef.current);
    }
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isMobileTouch =
      /iPhone|iPod|iPad|Android|Mobile/i.test(ua) ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
    if (!isMobileTouch && tvSettings.osdAutoHideSec <= 0) {
      return;
    }
    const timeoutMs = isMobileTouch
      ? 4500
      : Math.max(8, tvSettings.osdAutoHideSec) * 1000;
    const runAutoHideCheck = () => {
      const hasOpenOverlay = Boolean(
        playerBoxRef.current?.querySelector(
          '[data-vod-menu-popover="true"], [data-vod-sheet-open="true"], [data-episodes-drawer="true"]'
        )
      );
      if (hasOpenOverlay) {
        // Re-arm instead of dying so OSD always hides cleanly once the subtitle/audio/episode menu closes
        osdTimerRef.current = window.setTimeout(runAutoHideCheck, 3000);
        return;
      }
      setIsVodOsdVisible(false);
      const floatingBtn =
        playerBoxRef.current?.querySelector<HTMLButtonElement>(
          '[data-vod-skip-intro-btn="true"], [data-vod-autonext-btn="true"]'
        );
      if (floatingBtn) {
        try {
          floatingBtn.focus({ preventScroll: true });
        } catch {
          floatingBtn.focus();
        }
        return;
      }
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && playerBoxRef.current?.contains(activeEl)) {
        activeEl.blur();
      }
    };
    osdTimerRef.current = window.setTimeout(runAutoHideCheck, timeoutMs);
  }, [tvSettings.osdAutoHideSec]);

  // Offline / Local Device Downloads (IndexedDB + Device Export)
  const offlineMusicState = useOfflineMusicState();
  const [offlineItems, setOfflineItems] = useState<OfflineMediaItem[]>([]);
  const [downloadsFilterTab, setDownloadsFilterTab] = useState<'all' | 'movies' | 'series' | 'music'>('all');
  const [isDownloadsEditMode, setIsDownloadsEditMode] = useState<boolean>(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState<boolean>(false);

  useEffect(() => {
    setIsDownloadModalOpen(false);
    setIsInfoSheetOpen(false);
    setIsEpisodesDrawerOpen(false);
    setIsDownloadsEditMode(false);
  }, [activeVodItem?.id, section]);

  useEffect(() => {
    if (!isDownloadModalOpen) return;
    const onEsc = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.stopPropagation();
        setIsDownloadModalOpen(false);
      }
    };
    window.addEventListener('keydown', onEsc, true);
    return () => window.removeEventListener('keydown', onEsc, true);
  }, [isDownloadModalOpen]);
  const [downloadQualityHeight, setDownloadQualityHeight] = useState<
    360 | 480 | 720 | 1080
  >(480);
  const [downloadModalSeason, setDownloadModalSeason] = useState<number>(1);
  const [selectedDownloadEpisodes, setSelectedDownloadEpisodes] = useState<
    number[]
  >([1]);
  const offlineVideoDl = useOfflineVideoDownloadState();
  const activeDownloadProgress = offlineVideoDl.activeProgress;
  const activeDownloadTargetId = offlineVideoDl.activeTargetId;
  const downloadError = offlineVideoDl.lastError;
  const setDownloadError = useCallback((val: string | null) => {
    if (val === null) clearOfflineVideoDownloadError();
  }, []);

  const refreshOfflineLibrary = useCallback(async () => {
    try {
      const list = await listOfflineItems();
      setOfflineItems(list);
      if (
        list.length > 0 &&
        typeof navigator !== 'undefined' &&
        navigator.onLine === false
      ) {
        setSection('downloads');
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void refreshOfflineLibrary();
    const onOffline = () => {
      void refreshOfflineLibrary();
    };
    window.addEventListener('offline', onOffline);
    return () => window.removeEventListener('offline', onOffline);
  }, [refreshOfflineLibrary, offlineVideoDl.libraryRevision]);

  const currentVodOfflineId = useMemo(() => {
    if (!activeVodItem) return '';
    return activeVodItem.type === 'series'
      ? `vod_${activeVodItem.id}_S${selectedSeason}E${selectedEpisode}`
      : `vod_${activeVodItem.id}`;
  }, [activeVodItem, selectedSeason, selectedEpisode]);

  const matchedOfflineVodItem = useMemo(
    () =>
      currentVodOfflineId
        ? offlineItems.find((x) => x.id === currentVodOfflineId) || null
        : null,
    [offlineItems, currentVodOfflineId]
  );

  const handleStartOfflineDownload = useCallback(
    async (
      preferredHeightOverride?: 360 | 480 | 720 | 1080,
      seasonOverride?: number,
      episodesOverride?: number[]
    ) => {
      if (!activeVodItem) return;

      // All render-scope props/state (activeVodItem, detailedMeta, resolvedDirectStream, etc.)
      // are immutable closure snapshots for this job, so switching pages or cards NEVER affects it!
      const snapVod = activeVodItem;
      const targetHeight = preferredHeightOverride || downloadQualityHeight;
      const isSeries = snapVod.type === 'series';
      const targetSeason = isSeries
        ? (seasonOverride ?? downloadModalSeason ?? selectedSeason)
        : 1;
      const targetEpisodes = isSeries
        ? episodesOverride && episodesOverride.length > 0
          ? [...episodesOverride].sort((a, b) => a - b)
          : [selectedEpisode]
        : [1];
      const snapTitle = detailedMeta?.name || snapVod.name;

      clearOfflineVideoDownloadError();

      const kpId =
        activeVodItem.kpId ||
        detailedMeta?.kpId ||
        (activeVodItem.id.startsWith('kp_')
          ? activeVodItem.id.replace('kp_', '')
          : '');
      const imdbId = activeVodItem.id.startsWith('tt')
        ? activeVodItem.id
        : detailedMeta?.imdbId || '';
      const yearStr = String(
        detailedMeta?.releaseInfo || activeVodItem.releaseInfo || ''
      ).slice(0, 4);

      const canUseLocalFl = isLocalHomeServer();
      const preferFileList =
        canUseLocalFl &&
        (activeServer === 'filelist_torrent' || isCurrentVodForeign);
      const iedemFid =
        activeVodItem.iedemFid ||
        (activeVodItem.id.startsWith('iedem_')
          ? Number(activeVodItem.id.replace(/^iedem_/, ''))
          : 0);
      const iedemCardSeason = (() => {
        const rawLabel = String(
          activeVodItem.releaseTitle || activeVodItem.name || ''
        );
        const sm = rawLabel.match(/(?:Сезон|Season|\bS)0*(\d{1,2})\b/i);
        return sm ? Number(sm[1]) || 1 : 1;
      })();

      type DownloadCandidate = {
        url: string;
        sourceLabel: string;
        audioNames?: string[];
        estimatedSizeBytes?: number;
        estimatedDurationSec?: number;
        forceDirectVideo?: boolean;
      };

      const pickBestVkUrl = (
        vkQuals?: ResolvedDirectVodStream['vkQualities']
      ): string | undefined => {
        if (!vkQuals || vkQuals.length === 0) return undefined;
        const withinCap = vkQuals.filter((q) => q.height <= targetHeight + 60);
        const pool = withinCap.length > 0 ? withinCap : vkQuals;
        const sorted = [...pool].sort(
          (a, b) =>
            Math.abs(a.height - targetHeight) - Math.abs(b.height - targetHeight)
        );
        return sorted[0]?.url;
      };

      const appendDirectCandidates = (
        list: DownloadCandidate[],
        streamObj: ResolvedDirectVodStream | null | undefined,
        fallbackLabel: string
      ) => {
        if (!streamObj) return;
        const srcLabel = streamObj.sourcePath || fallbackLabel;
        const vkPicked = pickBestVkUrl(streamObj.vkQualities);
        const rawUrls = [
          vkPicked,
          streamObj.hlsUrl,
          streamObj.proxyHlsUrl,
          streamObj.fallbackHlsUrl,
          ...(streamObj.backupHlsUrls || []),
        ].filter((u): u is string => Boolean(u && typeof u === 'string'));
        for (const u of rawUrls) {
          if (!list.some((x) => x.url === u)) {
            list.push({
              url: u,
              sourceLabel: srcLabel,
              audioNames: streamObj.audioNames,
              estimatedDurationSec: streamObj.duration || 0,
            });
          }
        }
      };

      enqueueOfflineVideoDownloadJob({
        vodId: snapVod.id,
        title: snapTitle,
        run: async ({ signal, setTargetId, setProgress, notifyItemSaved }) => {
        const controller = { signal };
        // Cache iEdem VIP episode URL map once for the entire download batch (fixes all iEdem series like Вор в законе!)
        let cachedIedemDetail: Awaited<
          ReturnType<typeof fetchIedemItemDetail>
        > | null = null;
        if (iedemFid > 0 && !isCurrentVodForeign) {
          try {
            cachedIedemDetail = await fetchIedemItemDetail(iedemFid);
          } catch {
            cachedIedemDetail = null;
          }
        }

        const resolveFileListCandidate = async (
          epNum: number
        ): Promise<DownloadCandidate | null> => {
          if (!canUseLocalFl) return null;
          const isSameSelectedEp =
            !isSeries ||
            (targetSeason === selectedSeason && epNum === selectedEpisode);

          const buildFlStreamUrl = (
            rawStreamUrl: string,
            audioNames?: string[]
          ): string => {
            const absUrl = /^https?:\/\//i.test(rawStreamUrl)
              ? rawStreamUrl
              : buildFileListApiUrl(rawStreamUrl);
            let out = absUrl;
            if (!/[?&]orig=/.test(out)) {
              out += `${out.includes('?') ? '&' : '?'}orig=${isCurrentVodForeign ? '1' : '0'}`;
            }
            const flAudioIdx =
              selectedAudioTrackIdx >= 0 &&
              audioNames &&
              selectedAudioTrackIdx < audioNames.length
                ? selectedAudioTrackIdx
                : -1;
            if (flAudioIdx >= 0 && !/[?&]audio=/.test(out)) {
              out += `&audio=${flAudioIdx}`;
            }
            if (targetHeight <= 1080 && !/[?&]maxw=/.test(out)) {
              const targetMaxW =
                targetHeight <= 360
                  ? 640
                  : targetHeight <= 480
                    ? 854
                    : targetHeight <= 720
                      ? 1280
                      : 1920;
              out += `&maxw=${targetMaxW}`;
            }
            if (!/[?&]download=1/.test(out)) {
              out += '&download=1';
            }
            return out;
          };

          const pickCompactOfflineTorrent = (
            torrents?: ResolvedFileListStream['torrents'],
            currentTor?: ResolvedFileListStream['selectedTorrent']
          ) => {
            if (!torrents || torrents.length <= 1) return null;
            const curBytes = currentTor?.sizeBytes || 0;
            const curTitle = String(currentTor?.releaseTitle || '');
            const curIsHugeOr4k =
              curBytes > 6 * 1024 * 1024 * 1024 ||
              /2160p|4k|uhd|remux/i.test(curTitle);
            if (!curIsHugeOr4k && targetHeight >= 1080) return null;
            const cleanPool = torrents.filter((t) => {
              const rel = String(t.releaseTitle || t.name || '');
              if (/(EXTRAS|BONUS|SAMPLE|TRAILER|FEATURETTES)/i.test(rel)) {
                return false;
              }
              return (t.sizeBytes || 0) > 150 * 1024 * 1024 && (t.seeders || 0) >= 3;
            });
            if (cleanPool.length === 0) return null;
            // Prefer non-4K compact x264/WEB-DL release matching requested targetHeight (avoids 80GB Remux OOM on iPad!)
            const non4k = cleanPool.filter(
              (t) => !/2160p|4k|uhd|remux/i.test(String(t.releaseTitle || ''))
            );
            const preferred =
              targetHeight <= 720
                ? non4k.filter((t) => /720p|480p|webrip|bdrip/i.test(String(t.releaseTitle || '')))
                : non4k;
            const candidatesPool =
              preferred.length > 0
                ? preferred
                : non4k.length > 0
                  ? non4k
                  : cleanPool;
            const best = [...candidatesPool].sort(
              (a, b) => (a.sizeBytes || 0) - (b.sizeBytes || 0)
            )[0];
            if (
              best &&
              best.id &&
              best.id !== currentTor?.id &&
              (!curBytes || (best.sizeBytes || 0) < curBytes * 0.75)
            ) {
              return best;
            }
            return null;
          };

          const estimateFlOfflineBytes = (
            tor?: ResolvedFileListStream['selectedTorrent'],
            filesCount = 1,
            durSec = 0
          ): number => {
            const rawBytes = tor?.sizeBytes || 0;
            const perFile =
              rawBytes > 0
                ? isSeries && filesCount > 1
                  ? Math.round(rawBytes / filesCount)
                  : rawBytes
                : 0;
            const isTranscoded4k = /2160p|4k|uhd|hevc|x265|h\.?265/i.test(
              String(tor?.releaseTitle || '')
            );
            if (isTranscoded4k && durSec > 60) {
              // maxw=1920 Hardware VideoToolbox transcode targets ~8 Mbps (~1 MB/s)
              return Math.min(perFile || Infinity, Math.round(durSec * 1_050_000));
            }
            return perFile;
          };

          const compactMovieTor = !isSeries
            ? pickCompactOfflineTorrent(
                resolvedFileListStream?.torrents,
                resolvedFileListStream?.selectedTorrent
              )
            : null;

          if (
            isSameSelectedEp &&
            !compactMovieTor &&
            resolvedFileListStream?.ok &&
            resolvedFileListStream.streamUrl
          ) {
            const filesCount = Math.max(
              1,
              resolvedFileListStream.files?.length || 1
            );
            return {
              url: buildFlStreamUrl(
                resolvedFileListStream.streamUrl,
                resolvedFileListStream.audioNames
              ),
              sourceLabel: isCurrentVodForeign
                ? 'FileList.io Local'
                : 'Kinozal / FileList Local',
              audioNames: resolvedFileListStream.audioNames,
              estimatedSizeBytes: estimateFlOfflineBytes(
                resolvedFileListStream.selectedTorrent,
                filesCount,
                resolvedFileListStream.durationSec || 0
              ),
              estimatedDurationSec: resolvedFileListStream.durationSec || 0,
              forceDirectVideo: true,
            };
          }

          const flQueryTitle = isCurrentVodForeign
            ? detailedMeta?.nameOriginal ||
              activeVodItem.nameOriginal ||
              detailedMeta?.name ||
              activeVodItem.name ||
              ''
            : activeVodItem.name ||
              detailedMeta?.name ||
              detailedMeta?.nameOriginal ||
              '';
          const flParams = new URLSearchParams({
            q: flQueryTitle,
            type: activeVodItem.type,
            ru: isCurrentVodForeign ? '0' : '1',
            ...(yearStr ? { year: yearStr } : {}),
            ...(imdbId ? { imdb: imdbId } : {}),
            ...(isSeries
              ? { s: String(targetSeason), e: String(epNum) }
              : {}),
          });
          if (compactMovieTor?.id) {
            flParams.set('id', String(compactMovieTor.id));
            flParams.set('strictId', '1');
          } else if (resolvedFileListStream?.torrentId) {
            flParams.set('id', String(resolvedFileListStream.torrentId));
          }

          try {
            const r = await fetch(
              buildFileListApiUrl(`/api/filelist/resolve?${flParams.toString()}`),
              { signal: controller.signal }
            );
            if (!r.ok) return null;
            const rawFl = (await r.json()) as ResolvedFileListStream;
            const flData = normalizeFileListResolveData(rawFl);
            if (flData?.ok && flData.streamUrl) {
              const filesCount = Math.max(1, flData.files?.length || 1);
              return {
                url: buildFlStreamUrl(flData.streamUrl, flData.audioNames),
                sourceLabel: isCurrentVodForeign
                  ? 'FileList.io Local'
                  : 'Kinozal / FileList Local',
                audioNames: flData.audioNames,
                estimatedSizeBytes: estimateFlOfflineBytes(
                  flData.selectedTorrent,
                  filesCount,
                  flData.durationSec || 0
                ),
                estimatedDurationSec: flData.durationSec || 0,
                forceDirectVideo: true,
              };
            }
          } catch (err) {
            if (controller.signal.aborted) throw err;
          }
          return null;
        };

        const resolveDirectCandidates = async (
          epNum: number
        ): Promise<DownloadCandidate[]> => {
          const list: DownloadCandidate[] = [];
          const isSameSelectedEp =
            !isSeries ||
            (targetSeason === selectedSeason && epNum === selectedEpisode);

          // 1. iEdem VIP direct episode / movie map (instant, zero balancer failure!)
          if (
            !isCurrentVodForeign &&
            (!isSeries || targetSeason === iedemCardSeason)
          ) {
            if (
              cachedIedemDetail?.type === 'multistream' &&
              Array.isArray(cachedIedemDetail.items) &&
              cachedIedemDetail.items.length > 0
            ) {
              const matchedEp =
                cachedIedemDetail.items[epNum - 1] ||
                cachedIedemDetail.items.find((it) => {
                  const m = String(it.title || '').match(/(?:Серия|Эпизод|Ep\.?|E)\s*0*(\d+)/i);
                  return m ? Number(m[1]) === epNum : false;
                });
              if (matchedEp?.url) {
                list.push({
                  url: `/api/tv-proxy?url=${encodeURIComponent(matchedEp.url)}`,
                  sourceLabel: 'iEdem VIP',
                  audioNames: resolvedDirectStream?.audioNames?.length
                    ? resolvedDirectStream.audioNames
                    : ['Русский (iEdem VIP)'],
                });
              }
            } else if (!isSeries) {
              const directIedemTarget =
                cachedIedemDetail?.variants?.['1080'] ||
                cachedIedemDetail?.url ||
                cachedIedemDetail?.variants?.['auto'] ||
                activeVodItem.iedemStreamUrl ||
                '';
              if (directIedemTarget) {
                list.push({
                  url: `/api/tv-proxy?url=${encodeURIComponent(directIedemTarget)}`,
                  sourceLabel: 'iEdem VIP',
                  audioNames: resolvedDirectStream?.audioNames?.length
                    ? resolvedDirectStream.audioNames
                    : ['Русский (iEdem VIP)'],
                });
              }
            }
          }

          // 2. Currently resolved direct stream (if same episode or movie)
          if (isSameSelectedEp && resolvedDirectStream?.ok) {
            appendDirectCandidates(list, resolvedDirectStream, 'Direct HLS');
          }

          // 3. Fresh resolveDirectVodStreamClient (with correct ru=0/1 & Russian vs Original title!)
          if (list.length === 0) {
            try {
              const resolvedEp = await resolveDirectVodStreamClient({
                kp: kpId,
                imdb: imdbId,
                title: isCurrentVodForeign
                  ? detailedMeta?.nameOriginal ||
                    activeVodItem.nameOriginal ||
                    activeVodItem.name
                  : activeVodItem.name ||
                    detailedMeta?.name ||
                    detailedMeta?.nameOriginal,
                type: activeVodItem.type,
                year: yearStr,
                season: targetSeason,
                episode: epNum,
                ru: isCurrentVodForeign ? '0' : '1',
              });
              if (resolvedEp?.ok) {
                appendDirectCandidates(list, resolvedEp, 'Direct HLS');
              }
            } catch (err) {
              if (controller.signal.aborted) throw err;
            }
          }

          return list;
        };

        for (let idx = 0; idx < targetEpisodes.length; idx++) {
          if (controller.signal.aborted) break;
          const epNum = targetEpisodes[idx];
          const offlineId = isSeries
            ? `vod_${activeVodItem.id}_S${targetSeason}E${epNum}`
            : `vod_${activeVodItem.id}`;
          setTargetId(offlineId);

          const batchPrefix =
            isSeries && targetEpisodes.length > 1
              ? `[${idx + 1}/${targetEpisodes.length} • S${targetSeason}:E${epNum}] `
              : isSeries
                ? `[S${targetSeason}:E${epNum}] `
                : '';

          setProgress({
            title: snapTitle,
            percent: 1,
            downloadedBytes: 0,
            totalSegments: 0,
            completedSegments: 0,
            stage: `${batchPrefix}${tr(
              'Se rezolvă streamul video...',
              'Resolving video stream...',
              'Поиск видеопотока...'
            )}`,
          });

          const candidates: DownloadCandidate[] = [];
          const pushUnique = (c: DownloadCandidate | null) => {
            if (c && c.url && !candidates.some((x) => x.url === c.url)) {
              candidates.push(c);
            }
          };

          if (preferFileList) {
            pushUnique(await resolveFileListCandidate(epNum));
            if (candidates.length === 0) {
              const directList = await resolveDirectCandidates(epNum);
              for (const c of directList) pushUnique(c);
            }
          } else {
            const directList = await resolveDirectCandidates(epNum);
            for (const c of directList) pushUnique(c);
            if (candidates.length === 0 && canUseLocalFl) {
              pushUnique(await resolveFileListCandidate(epNum));
            }
          }

          if (candidates.length === 0) {
            if (!canUseLocalFl && isCurrentVodForeign) {
              throw new Error(
                tr(
                  'Pentru descărcarea locală la acest titlu străin, conectează aplicația la serverul local FileList (LAN / Tunel).',
                  'To download this foreign title locally, connect to your local FileList server (LAN / Tunnel).',
                  'Для скачивания этого зарубежного тайтла подключитесь к локальному серверу FileList (LAN / Туннель).'
                )
              );
            }
            throw new Error(
              isSeries
                ? tr(
                  `Nu s-a găsit un stream descărcabil pentru S${targetSeason}:E${epNum}.`,
                  `No downloadable stream found for S${targetSeason}:E${epNum}.`,
                  `Не найден доступный поток для скачивания S${targetSeason}:E${epNum}.`
                )
                : tr(
                  'Nu s-a găsit un stream descărcabil pentru acest titlu.',
                  'No downloadable video stream found for this title.',
                  'Не найден доступный поток для скачивания.'
                )
            );
          }

          let epSubCues =
            !isSeries ||
              (targetSeason === selectedSeason && epNum === selectedEpisode)
              ? activeSubCues
              : [];
          let epSubLabel =
            !isSeries ||
              (targetSeason === selectedSeason && epNum === selectedEpisode)
              ? activeSubLabel
              : '';

          if (
            isSeries &&
            epSubCues.length === 0 &&
            tvSettings.defaultSubLang !== 'off'
          ) {
            try {
              const autoSub = await autoResolveAndFetchBestRoRuSubtitle({
                imdbId,
                title: detailedMeta?.name || activeVodItem.name,
                nameOriginal: detailedMeta?.nameOriginal || activeVodItem.name,
                type: 'series',
                season: targetSeason,
                episode: epNum,
                preferredLang:
                  tvSettings.defaultSubLang === 'ru'
                    ? 'ru'
                    : tvSettings.defaultSubLang === 'en'
                      ? 'en'
                      : 'ro',
              });
              if (autoSub?.cues?.length) {
                epSubCues = autoSub.cues;
                epSubLabel = autoSub.track?.langLabel || 'Subtitrare';
              }
            } catch {
              // ignore subtitle fetch error
            }
          }

          const subtitleText = isSeries
            ? `Sezonul ${targetSeason} • Episodul ${epNum}`
            : detailedMeta?.releaseInfo || activeVodItem.releaseInfo || 'Film';

          let downloadedThisEp = false;
          let lastAttemptErr: unknown = null;

          // If all initial direct candidates fail on a local home server, lazily append FileList fallback once
          let appendedFlFallback = preferFileList;

          for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
            const cand = candidates[cIdx];
            if (controller.signal.aborted) {
              throw new DOMException('Descărcare anulată', 'AbortError');
            }
            const epAudioNames =
              cand.audioNames?.length
                ? cand.audioNames
                : resolvedDirectStream?.audioNames?.length
                  ? resolvedDirectStream.audioNames
                  : resolvedFileListStream?.audioNames;
            const audioIdx =
              selectedAudioTrackIdx >= 0
                ? selectedAudioTrackIdx
                : epAudioNames?.length
                  ? resolveAudioTrackIndexByPreference(
                    epAudioNames,
                    effectiveVodAudioPref
                  )
                  : Math.max(0, effectiveAudioTrackIdx);
            try {
              await downloadHlsToOfflineDb({
                id: offlineId,
                title: detailedMeta?.name || activeVodItem.name,
                subtitleLabel: subtitleText,
                poster:
                  detailedMeta?.poster ||
                  activeVodItem.poster ||
                  `https://images.metahub.space/poster/medium/${activeVodItem.id}/img`,
                masterM3u8Url: cand.url,
                preferredHeight: targetHeight,
                audioTrackIndex: audioIdx,
                audioLabel:
                  epAudioNames?.[audioIdx] ||
                  epAudioNames?.[0] ||
                  'Original / Audio 1',
                sourceLabel: cand.sourceLabel,
                estimatedSizeBytes: cand.estimatedSizeBytes,
                estimatedDurationSec: cand.estimatedDurationSec,
                forceDirectVideo: cand.forceDirectVideo,
                profileId: activeProfileId,
                isAdult18: isAdult18WatchItem(activeVodItem),
                savedSubCues: epSubCues.length > 0 ? epSubCues : undefined,
                savedSubLabel: epSubLabel || undefined,
                vodId: activeVodItem.id,
                mediaKind: activeVodItem.type,
                season: isSeries ? targetSeason : undefined,
                episode: isSeries ? epNum : undefined,
                overview: detailedMeta?.description || activeVodItem.description || undefined,
                releaseYear: yearStr || undefined,
                rating: detailedMeta?.imdbRating || activeVodItem.imdbRating || undefined,
                backdrop: detailedMeta?.background || activeVodItem.background || undefined,
                signal: controller.signal,
                onProgress: (prog) =>
                  setProgress({
                    ...prog,
                    title: prog.title || snapTitle,
                    stage: `${batchPrefix}${prog.stage}`,
                  }),
              });
              downloadedThisEp = true;
              break;
            } catch (attemptErr) {
              if (
                controller.signal.aborted ||
                (attemptErr instanceof DOMException &&
                  attemptErr.name === 'AbortError')
              ) {
                throw attemptErr;
              }
              lastAttemptErr = attemptErr;
              if (
                cIdx === candidates.length - 1 &&
                !appendedFlFallback &&
                canUseLocalFl
              ) {
                appendedFlFallback = true;
                const flFallback = await resolveFileListCandidate(epNum);
                pushUnique(flFallback);
              }
            }
          }

          if (!downloadedThisEp) {
            throw (
              lastAttemptErr ||
              new Error(
                tr(
                  'Nu s-a putut descărca acest stream video.',
                  'Could not download this video stream.',
                  'Не удалось скачать видеопоток.'
                )
              )
            );
          }

          notifyItemSaved();
        }
        },
      });
    },
    [
      activeVodItem,
      activeServer,
      isCurrentVodForeign,
      resolvedDirectStream,
      resolvedFileListStream,
      downloadQualityHeight,
      downloadModalSeason,
      selectedSeason,
      selectedEpisode,
      detailedMeta,
      selectedAudioTrackIdx,
      effectiveAudioTrackIdx,
      effectiveVodAudioPref,
      activeSubCues,
      activeSubLabel,
      tvSettings.defaultSubLang,
      tr,
    ]
  );

  const handleCancelOfflineDownload = useCallback(() => {
    cancelActiveOfflineVideoDownload();
  }, []);

  const [isMobileCustomFullscreen, setIsMobileCustomFullscreen] = useState(false);
  const [vvRect, setVvRect] = useState(() => ({
    width: typeof window !== 'undefined' ? (window.visualViewport?.width || window.innerWidth) : 1920,
    height: typeof window !== 'undefined' ? (window.visualViewport?.height || window.innerHeight) : 1080,
    offsetTop: typeof window !== 'undefined' ? (window.visualViewport?.offsetTop || 0) : 0,
    offsetLeft: typeof window !== 'undefined' ? (window.visualViewport?.offsetLeft || 0) : 0,
  }));
  const [isPortraitViewport, setIsPortraitViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false
  );
  const [isMobilePhone, setIsMobilePhone] = useState(() => isMobilePhoneDevice());

  useEffect(() => {
    const syncViewportFlags = () => {
      const vv = window.visualViewport;
      const w = vv ? vv.width : window.innerWidth;
      const h = vv ? vv.height : window.innerHeight;
      const top = vv ? vv.offsetTop : 0;
      const left = vv ? vv.offsetLeft : 0;
      setVvRect((prev) =>
        Math.abs(prev.width - w) > 0.5 ||
          Math.abs(prev.height - h) > 0.5 ||
          Math.abs(prev.offsetTop - top) > 0.5 ||
          Math.abs(prev.offsetLeft - left) > 0.5
          ? { width: w, height: h, offsetTop: top, offsetLeft: left }
          : prev
      );
      setIsPortraitViewport(h > w);
      setIsMobilePhone(isMobilePhoneDevice());
    };
    let orientT1: number | null = null;
    let orientT2: number | null = null;
    const syncOrientationDelayed = () => {
      syncViewportFlags();
      if (orientT1 !== null) window.clearTimeout(orientT1);
      if (orientT2 !== null) window.clearTimeout(orientT2);
      orientT1 = window.setTimeout(syncViewportFlags, 80);
      orientT2 = window.setTimeout(syncViewportFlags, 280);
    };
    const onOpenHandoff = () => setIsHandoffModalOpen(true);
    syncViewportFlags();
    window.addEventListener('resize', syncViewportFlags);
    window.addEventListener('orientationchange', syncOrientationDelayed);
    document.addEventListener('fullscreenchange', syncOrientationDelayed);
    document.addEventListener('webkitfullscreenchange', syncOrientationDelayed);
    window.visualViewport?.addEventListener('resize', syncViewportFlags);
    window.visualViewport?.addEventListener('scroll', syncViewportFlags);
    window.addEventListener('aether:open-handoff-modal', onOpenHandoff);
    return () => {
      if (orientT1 !== null) window.clearTimeout(orientT1);
      if (orientT2 !== null) window.clearTimeout(orientT2);
      window.removeEventListener('resize', syncViewportFlags);
      window.removeEventListener('orientationchange', syncOrientationDelayed);
      document.removeEventListener('fullscreenchange', syncOrientationDelayed);
      document.removeEventListener('webkitfullscreenchange', syncOrientationDelayed);
      window.visualViewport?.removeEventListener('resize', syncViewportFlags);
      window.visualViewport?.removeEventListener('scroll', syncViewportFlags);
      window.removeEventListener('aether:open-handoff-modal', onOpenHandoff);
    };
  }, []);

  useEffect(() => {
    setIsMobileCustomFullscreen(false);
  }, [isPlayingVod]);

  useEffect(() => {
    isMobileChromeHiddenRef.current = false;
    lastMainScrollTopRef.current = 0;
    scrollDeltaAccumRef.current = 0;
    setIsMobileChromeHidden(false);
  }, [
    section,
    activeVodItem,
    isPlayingVod,
    isPortraitViewport,
    isSidebarOpen,
    isSettingsDrawerOpen,
    isFilterDrawerOpen,
    isCatalogDrawerOpen,
  ]);

  const handleMobileMainScroll = useCallback(
    (el: HTMLElement) => {
      if (typeof window === 'undefined') return;
      if (
        (!isMobilePhone && window.innerWidth >= 768) ||
        document.documentElement.classList.contains('smart-tv-mode')
      ) {
        if (isMobileChromeHiddenRef.current) {
          isMobileChromeHiddenRef.current = false;
          setIsMobileChromeHidden(false);
        }
        return;
      }
      if (
        isSidebarOpen ||
        isSettingsDrawerOpen ||
        isFilterDrawerOpen ||
        isCatalogDrawerOpen
      ) {
        if (isMobileChromeHiddenRef.current) {
          isMobileChromeHiddenRef.current = false;
          setIsMobileChromeHidden(false);
        }
        lastMainScrollTopRef.current = Math.max(0, el.scrollTop);
        scrollDeltaAccumRef.current = 0;
        return;
      }
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
        lastMainScrollTopRef.current = Math.max(0, el.scrollTop);
        return;
      }

      const curTop = Math.max(0, el.scrollTop);
      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      if (curTop <= 20) {
        if (isMobileChromeHiddenRef.current) {
          isMobileChromeHiddenRef.current = false;
          setIsMobileChromeHidden(false);
        }
        lastMainScrollTopRef.current = curTop;
        scrollDeltaAccumRef.current = 0;
        return;
      }
      if (curTop >= maxScroll - 16 && curTop > lastMainScrollTopRef.current) {
        lastMainScrollTopRef.current = curTop;
        return;
      }

      const delta = curTop - lastMainScrollTopRef.current;
      lastMainScrollTopRef.current = curTop;
      if (Math.abs(delta) < 1.5) return;

      if (
        (delta > 0 && scrollDeltaAccumRef.current < 0) ||
        (delta < 0 && scrollDeltaAccumRef.current > 0)
      ) {
        scrollDeltaAccumRef.current = 0;
      }
      scrollDeltaAccumRef.current += delta;

      if (
        scrollDeltaAccumRef.current > 18 &&
        curTop > 44 &&
        !isMobileChromeHiddenRef.current
      ) {
        isMobileChromeHiddenRef.current = true;
        setIsMobileChromeHidden(true);
        scrollDeltaAccumRef.current = 0;
        const activeEl = document.activeElement as HTMLElement | null;
        if (
          activeEl &&
          (activeEl.closest('header') ||
            activeEl.closest('nav[aria-label="Navigare Mobilă"]'))
        ) {
          activeEl.blur?.();
          el.focus?.({ preventScroll: true });
        }
      } else if (
        scrollDeltaAccumRef.current < -10 &&
        isMobileChromeHiddenRef.current
      ) {
        isMobileChromeHiddenRef.current = false;
        setIsMobileChromeHidden(false);
        scrollDeltaAccumRef.current = 0;
      }
    },
    [
      isMobilePhone,
      isSidebarOpen,
      isSettingsDrawerOpen,
      isFilterDrawerOpen,
      isCatalogDrawerOpen,
    ]
  );


  useEffect(() => {
    const onCustomFsToggle = (ev: Event) => {
      const customEv = ev as CustomEvent<{ force?: boolean }>;
      if (typeof customEv.detail?.force === 'boolean') {
        setIsMobileCustomFullscreen(customEv.detail.force);
      } else {
        setIsMobileCustomFullscreen((prev) => !prev);
      }
    };
    window.addEventListener(
      'aether:vod-custom-fullscreen-toggle',
      onCustomFsToggle
    );
    return () => {
      window.removeEventListener(
        'aether:vod-custom-fullscreen-toggle',
        onCustomFsToggle
      );
    };
  }, []);

  // Hold continuous Screen Wake Lock across the entire active VOD viewing session
  // (including brief episode-transition / FileList stream loading spinners where <VodNativeHlsPlayer> remounts)
  useEffect(() => {
    if (isPlayingVod && activeVodItem) {
      acquirePlaybackWakeLock('vod-session');
      return () => {
        releasePlaybackWakeLock('vod-session');
      };
    }
    releasePlaybackWakeLock('vod-session');
  }, [isPlayingVod, activeVodItem]);

  // Idempotent native fullscreen entry on `document.documentElement` (NEVER exits if already fullscreen!)
  const ensureTvFullscreen = useCallback(() => {
    try {
      acquirePlaybackWakeLock('vod-session');
      if (isNativeDocumentFullscreen()) {
        return;
      }
      ensureNativeDocumentFullscreen(() => {
        window.dispatchEvent(
          new CustomEvent('aether:vod-custom-fullscreen-toggle', {
            detail: { force: true },
          })
        );
      });
    } catch {
      // ignore
    }
  }, []);

  const requestTvFullscreen = useCallback(() => {
    try {
      hideVodOsd();
      const box = playerBoxRef.current;
      const vid = box?.querySelector('video') as
        | (HTMLVideoElement & {
          webkitDisplayingFullscreen?: boolean;
          webkitExitFullscreen?: () => void;
        })
        | null;

      if (isNativeDocumentFullscreen()) {
        exitNativeDocumentFullscreen();
        window.dispatchEvent(
          new CustomEvent('aether:vod-custom-fullscreen-toggle', {
            detail: { force: false },
          })
        );
        return;
      }

      if (vid?.webkitDisplayingFullscreen && typeof vid.webkitExitFullscreen === 'function') {
        try {
          vid.webkitExitFullscreen();
        } catch {
          // ignore
        }
        window.dispatchEvent(
          new CustomEvent('aether:vod-custom-fullscreen-toggle', {
            detail: { force: false },
          })
        );
        return;
      }

      window.dispatchEvent(
        new CustomEvent('aether:vod-custom-fullscreen-toggle', {
          detail: { force: true },
        })
      );
      ensureNativeDocumentFullscreen();
    } catch {
      // ignore
    }
  }, [hideVodOsd]);

  const handleFocusVodItem = useCallback(
    (item: CinemetaItem, isHeroBannerPreload = false) => {
      lastFocusedVodItemRef.current = item;
      // SMART TV SMOOTH PERFORMANCE OPTIMIZATION (REVERSIBLE):
      // Avoid triggering full-view React re-renders and 3x API fetches on every D-pad poster focus.
      // Only fetch/update spotlight metadata when preloading for the Home Hero Banner.
      if (!isHeroBannerPreload) return;

      const posterUrl = resolveSafeVodPosterUrl(item);
      const baseSub = [
        item.releaseInfo || '',
        (item.genres || []).slice(0, 3).join(', '),
      ]
        .filter(Boolean)
        .join(' • ');
      const cached = spotlightMetaCacheRef.current[`${item.id}_${uiLang}`];

      if (cached) return;

      const imdbId = item.id.startsWith('tt') ? item.id : '';
      const kpId =
        item.kpId ||
        (item.id.startsWith('kp_') ? item.id.replace(/^kp_/, '') : '');
      const mType = item.type === 'series' ? 'series' : 'movie';

      void (async () => {
        let desc = item.description || '';
        let runtime = '';
        let country = '';

        try {
          if (imdbId) {
            const res = await fetch(
              `https://v3-cinemeta.strem.io/meta/${mType}/${imdbId}.json`
            );
            if (res.ok) {
              const data = (await res.json()) as { meta?: DetailedMeta };
              if (data.meta) {
                desc = data.meta.description || desc;
                runtime = data.meta.runtime || '';
                country = data.meta.country || '';
              }
            }
          }
          if (kpId && (!desc || !runtime)) {
            const kpRes = await fetch(
              `https://kinopoiskapiunofficial.tech/api/v2.2/films/${kpId}`,
              {
                headers: {
                  'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
                },
              }
            );
            if (kpRes.ok) {
              const kpData = (await kpRes.json()) as {
                description?: string | null;
                shortDescription?: string | null;
                filmLength?: number | null;
                countries?: Array<{ country: string }>;
              };
              desc =
                desc || kpData.description || kpData.shortDescription || '';
              if (!runtime && kpData.filmLength) {
                runtime = `${kpData.filmLength} min`;
              }
              if (!country && kpData.countries?.length && uiLang === 'ru') {
                country = kpData.countries
                  .map((c) => c.country)
                  .slice(0, 2)
                  .join(', ');
              }
            }
          }
          if (desc) {
            desc = await translateTextToLang(desc, uiLang);
          }
        } catch {
          // ignore
        }

        const subtitleExtra = [country, runtime].filter(Boolean).join(' • ');
        spotlightMetaCacheRef.current[`${item.id}_${uiLang}`] = {
          description: desc || undefined,
          subtitleExtra: subtitleExtra || undefined,
        };

        setSpotlightItem({
          title: item.name,
          subtitle: subtitleExtra
            ? [baseSub, subtitleExtra].filter(Boolean).join(' • ')
            : baseSub,
          rating: item.imdbRating,
          description: desc || item.description,
          backdrop: item.background || posterUrl,
        });
      })();
    },
    [uiLang]
  );
  handleFocusVodItemRef.current = handleFocusVodItem;

  // When entering TV Online (section === 'tv'), ALWAYS start automatically from the FIRST channel in Favorites
  // in Fixed Split-View Mode (Player on the left + Channel Grid on the right).
  // When leaving TV Online to another section, stop the TV stream cleanly.
  const prevSectionRef = useRef<TvSectionId>(section);
  useEffect(() => {
    const prevSec = prevSectionRef.current;
    prevSectionRef.current = section;

    if (section === 'tv') {
      const favPool = favoriteTvChannels.filter(
        (c) => adultContentEnabled || !isAdultTvChannel(c)
      );
      const fallbackPool = tvChannels.filter(
        (c) => adultContentEnabled || !isAdultTvChannel(c)
      );
      const firstFav = favPool[0] || fallbackPool[0];
      if (firstFav) {
        setActiveTvPlaylistContext('FAV', 'FAV');
        playTvChannel(firstFav, favPool.length > 0 ? favPool : fallbackPool);
      }
    } else if (prevSec === 'tv' && currentTvChannel) {
      closeTvPlayer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  // Auto-rotate Hero Billboard Banner is now encapsulated inside <HomeHeroBillboard />
  // with smooth crossfade and zero page re-renders!

// Hero banner metadata is served directly from pre-cached heroBillboardItems (zero re-render cascade)


  // Refresh the Hero Banner rotation epoch every 2–3 days (and periodically check for newly released titles)
  useEffect(() => {
    const checkRotation = () => {
      const nextEpoch = Math.floor(Date.now() / (2.5 * 24 * 60 * 60 * 1000));
      setHeroRotationEpoch((prev) => (prev !== nextEpoch ? nextEpoch : prev));
    };
    const timer = window.setInterval(checkRotation, 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Lampa-style History Trap ("это чтоб не выходило с приложения"):
  // Keep a dummy history entry on the stack at all times so pressing Back on a Smart TV remote
  // inside Media Station X / LG webOS / Samsung Tizen never pops out of the application!
  useEffect(() => {
    try {
      const curUrl = new URL(window.location.href);
      if (curUrl.searchParams.has('_r')) {
        curUrl.searchParams.delete('_r');
        const cleanQs = curUrl.searchParams.toString();
        window.history.replaceState(
          {},
          '',
          `${curUrl.pathname}${cleanQs ? `?${cleanQs}` : ''}${curUrl.hash || ''}`
        );
      }
      window.history.pushState({ lmp: 1 }, '', window.location.href);
      window.history.pushState({ lmp: 2 }, '', window.location.href);
    } catch {
      // ignore
    }
  }, []);

  // Support Browser Back / TV Remote Back popstate to navigate back internally without exiting MSX
  useEffect(() => {
    const onPopState = () => {
      // Immediately replenish dummy history state so the browser never exits to Media Station X
      try {
        window.history.pushState({ lmp: Date.now() }, '', window.location.href);
      } catch {
        // ignore
      }

      if (Date.now() - lastBackHandledAtRef.current < 320) {
        return;
      }
      lastBackHandledAtRef.current = Date.now();

      if (document.querySelector('[data-weather-modal="true"]')) {
        window.dispatchEvent(new CustomEvent('aether:close-weather-modal'));
        return;
      }
      if (isHandoffModalOpen && !isPinLockRequired) {
        setIsHandoffModalOpen(false);
        return;
      }
      if (isProfilePickerOpen) {
        if (editingProfileId) {
          setEditingProfileId(null);
        } else {
          setIsProfilePickerOpen(false);
        }
        return;
      }
      if (selectedActor) {
        setSelectedActor(null);
        return;
      }
      if (currentTvChannel) {
        window.dispatchEvent(new CustomEvent('aether:tv-player-back'));
        return;
      }
      if (isTvRadioPlayerOpen) {
        setIsTvRadioPlayerOpen(false);
        return;
      }
      if (isTrailerModalOpen) {
        setIsTrailerModalOpen(false);
        return;
      }
      if (isSettingsDrawerOpen) {
        if (settingsSubMenu) {
          setSettingsSubMenu(null);
        } else {
          setIsSettingsDrawerOpen(false);
        }
        return;
      }
      if (isFilterDrawerOpen) {
        if (filterSubMenu) {
          setFilterSubMenu(null);
        } else {
          setIsFilterDrawerOpen(false);
        }
        return;
      }
      if (isCatalogDrawerOpen) {
        setIsCatalogDrawerOpen(false);
        return;
      }
      if (isSubFinderOpen) {
        setIsSubFinderOpen(false);
        return;
      }
      if (isDownloadModalOpen) {
        setIsDownloadModalOpen(false);
        return;
      }
      if (document.querySelector('[data-iedem-detail-modal="true"]')) {
        window.dispatchEvent(new CustomEvent('aether:close-iedem-detail'));
        return;
      }
      if (document.querySelector('[data-music-fullscreen-modal="true"]')) {
        window.dispatchEvent(new CustomEvent('aether:close-music-fullscreen'));
        return;
      }
      if (document.querySelector('[data-tv-keyboard-open="true"]')) {
        setIsFlKeyboardOpen(false);
        setIsTvKeyboardOpen(false);
        setIsRadioKeyboardOpen(false);
        setIsYtKeyboardOpen(false);
        window.dispatchEvent(new CustomEvent('aether:close-tv-keyboard'));
        return;
      }
      if (
        rootContainerRef.current?.querySelector(
          '[data-imdb-dropdown-popover="true"]'
        )
      ) {
        window.dispatchEvent(new CustomEvent('aether:imdb-close-dropdown'));
        return;
      }
      if (isPlayingVod) {
        const vodMenuEl = playerBoxRef.current?.querySelector(
          '[data-vod-open-menu]'
        );
        const vodMenuState = vodMenuEl?.getAttribute('data-vod-open-menu');
        const openPopover = playerBoxRef.current?.querySelector(
          '[data-vod-menu-popover="true"]'
        );
        if (openPopover || (vodMenuState && vodMenuState !== 'none')) {
          window.dispatchEvent(new CustomEvent('aether:vod-close-menu'));
          return;
        }
        if (isKlubSuggestionsOpen) {
          setIsKlubSuggestionsOpen(false);
          return;
        }
        if (isInfoSheetOpen) {
          setIsInfoSheetOpen(false);
          vodAudioBtnRef.current?.focus();
          return;
        }
        if (isEpisodesDrawerOpen) {
          setIsEpisodesDrawerOpen(false);
          playerBoxRef.current
            ?.querySelector<HTMLButtonElement>(
              '[data-vod-top-episodes-btn="true"]'
            )
            ?.focus();
          return;
        }
        if (pendingResumePromptSec !== null) {
          setPendingResumePromptSec(null);
          return;
        }
        if (isVodOsdVisible) {
          hideVodOsd();
          return;
        }
        setIsPlayingVod(false);
        setIsInfoSheetOpen(false);
        if (activeVodItem?.id.startsWith('yt_') || activeVodItem?.isAdultKlubnichka) {
          setActiveVodItem(null);
          if (!activeVodItem?.isAdultKlubnichka) {
            setIsSidebarOpen(true);
          }
          return;
        }
        window.setTimeout(() => {
          playVodBtnRef.current?.focus();
        }, 60);
        return;
      }
      if (activeVodItem) {
        if (openVodCompactPanel) {
          const prevPanel = openVodCompactPanel;
          setOpenVodCompactPanel(null);
          window.setTimeout(() => {
            rootContainerRef.current
              ?.querySelector<HTMLElement>(
                `[data-vod-compact-trigger="${prevPanel}"]`
              )
              ?.focus();
          }, 25);
          return;
        }
        setActiveVodItem(null);
        setIsSidebarOpen(true);
        return;
      }
      if (section !== 'home') {
        const klubExitBtn = document.querySelector<HTMLElement>('[data-klub-exit-btn="true"]');
        if (klubExitBtn) {
          klubExitBtn.click();
          return;
        }
        setSection('home');
        setIsSidebarOpen(true);
        return;
      }
      // On home screen, Back opens/focuses the left sidebar instead of exiting the app
      setIsSidebarOpen(true);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [
    isHandoffModalOpen,
    isPinLockRequired,
    isProfilePickerOpen,
    editingProfileId,
    selectedActor,
    currentTvChannel,
    isTvRadioPlayerOpen,
    activeVodItem,
    openVodCompactPanel,
    isPlayingVod,
    isVodOsdVisible,
    hideVodOsd,
    pendingResumePromptSec,
    isInfoSheetOpen,
    isEpisodesDrawerOpen,
    isKlubSuggestionsOpen,
    isTrailerModalOpen,
    isSettingsDrawerOpen,
    settingsSubMenu,
    isFilterDrawerOpen,
    filterSubMenu,
    isCatalogDrawerOpen,
    isSubFinderOpen,
    section,
  ]);

  // Handle Escape / Backspace / Back button AND 2D Spatial D-Pad Remote Navigation (ArrowUp/Down/Left/Right)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const activeTag = (
        document.activeElement as HTMLElement | null
      )?.tagName?.toLowerCase();
      const isInputFocused =
        activeTag === 'input' || activeTag === 'textarea';
      const isBackKey =
        e.key === 'Escape' ||
        e.key === 'GoBack' ||
        e.key === 'BrowserBack' ||
        e.keyCode === 27 ||
        e.keyCode === 461 ||
        e.keyCode === 10009 ||
        e.keyCode === 166 ||
        ((e.key === 'Backspace' || e.keyCode === 8) &&
          !isInputFocused &&
          !document.querySelector('[data-tv-osd-search-open="true"]') &&
          !(
            !activeVodItem &&
            !document.querySelector('[data-klubnichka-root="true"]') &&
            (section === 'search' ||
              section === 'torrents' ||
              section === 'radio')
          ));

      if (isBackKey) {
        e.preventDefault();
        e.stopPropagation();

        if (Date.now() - lastBackHandledAtRef.current < 320) {
          return;
        }
        lastBackHandledAtRef.current = Date.now();

        if (document.querySelector('[data-weather-modal="true"]')) {
          window.dispatchEvent(new CustomEvent('aether:close-weather-modal'));
          return;
        }
        if (isHandoffModalOpen || isPinLockRequired) {
          if (!isPinLockRequired) {
            setIsHandoffModalOpen(false);
          }
          return;
        }
        if (isProfilePickerOpen) {
          if (editingProfileId) {
            setEditingProfileId(null);
          } else {
            setIsProfilePickerOpen(false);
          }
          return;
        }
        if (selectedActor) {
          setSelectedActor(null);
          return;
        }
        if (currentTvChannel) {
          window.dispatchEvent(new CustomEvent('aether:tv-player-back'));
          return;
        }
        if (isTvRadioPlayerOpen) {
          setIsTvRadioPlayerOpen(false);
          return;
        }
        if (isTrailerModalOpen) {
          setIsTrailerModalOpen(false);
          return;
        }
        if (isSettingsDrawerOpen) {
          if (settingsSubMenu) {
            setSettingsSubMenu(null);
          } else {
            setIsSettingsDrawerOpen(false);
          }
          return;
        }
        if (isFilterDrawerOpen) {
          if (filterSubMenu) {
            setFilterSubMenu(null);
          } else {
            setIsFilterDrawerOpen(false);
          }
          return;
        }
        if (isCatalogDrawerOpen) {
          setIsCatalogDrawerOpen(false);
          return;
        }
        if (isSubFinderOpen) {
          setIsSubFinderOpen(false);
          return;
        }
        if (isDownloadModalOpen) {
          setIsDownloadModalOpen(false);
          return;
        }
        if (document.querySelector('[data-iedem-detail-modal="true"]')) {
          window.dispatchEvent(new CustomEvent('aether:close-iedem-detail'));
          return;
        }
        if (document.querySelector('[data-music-fullscreen-modal="true"]')) {
          window.dispatchEvent(new CustomEvent('aether:close-music-fullscreen'));
          return;
        }
        if (document.querySelector('[data-tv-keyboard-open="true"]')) {
          setIsFlKeyboardOpen(false);
          setIsTvKeyboardOpen(false);
          setIsRadioKeyboardOpen(false);
          setIsYtKeyboardOpen(false);
          window.dispatchEvent(new CustomEvent('aether:close-tv-keyboard'));
          return;
        }
        if (
          rootContainerRef.current?.querySelector(
            '[data-imdb-dropdown-popover="true"]'
          )
        ) {
          window.dispatchEvent(new CustomEvent('aether:imdb-close-dropdown'));
          return;
        }
        if (isPlayingVod) {
          const vodMenuEl = playerBoxRef.current?.querySelector(
            '[data-vod-open-menu]'
          );
          const vodMenuState = vodMenuEl?.getAttribute('data-vod-open-menu');
          const openPopover = playerBoxRef.current?.querySelector(
            '[data-vod-menu-popover="true"]'
          );
          if (openPopover || (vodMenuState && vodMenuState !== 'none')) {
            window.dispatchEvent(new CustomEvent('aether:vod-close-menu'));
            return;
          }
          if (isKlubSuggestionsOpen) {
            setIsKlubSuggestionsOpen(false);
            window.setTimeout(() => {
              playerBoxRef.current
                ?.querySelector<HTMLButtonElement>('[data-vod-play-btn="true"]')
                ?.focus();
            }, 35);
            return;
          }
          if (isInfoSheetOpen) {
            setIsInfoSheetOpen(false);
            vodAudioBtnRef.current?.focus();
            return;
          }
          if (isEpisodesDrawerOpen) {
            setIsEpisodesDrawerOpen(false);
            playerBoxRef.current
              ?.querySelector<HTMLButtonElement>(
                '[data-vod-top-episodes-btn="true"]'
              )
              ?.focus();
            return;
          }
          if (pendingResumePromptSec !== null) {
            setPendingResumePromptSec(null);
            return;
          }
          if (isVodOsdVisible) {
            hideVodOsd();
            return;
          }
          flushPlaybackOnClose();
          setIsPlayingVod(false);
          setIsInfoSheetOpen(false);
          if (activeVodItem?.id.startsWith('yt_') || activeVodItem?.isAdultKlubnichka) {
            setActiveVodItem(null);
            if (!activeVodItem?.isAdultKlubnichka) {
              setIsSidebarOpen(true);
            }
            return;
          }
          window.setTimeout(() => {
            playVodBtnRef.current?.focus();
          }, 60);
          return;
        }
        if (activeVodItem) {
          if (openVodCompactPanel) {
            const prevPanel = openVodCompactPanel;
            setOpenVodCompactPanel(null);
            window.setTimeout(() => {
              rootContainerRef.current
                ?.querySelector<HTMLElement>(
                  `[data-vod-compact-trigger="${prevPanel}"]`
                )
                ?.focus();
            }, 25);
            return;
          }
          setActiveVodItem(null);
          setIsPlayingVod(false);
          setIsSidebarOpen(true);
          return;
        }
        if (section !== 'home') {
          if (section === 'music') {
            const musicBackEv = new CustomEvent('aether:music-back', {
              detail: { handled: false },
            });
            window.dispatchEvent(musicBackEv);
            if ((musicBackEv.detail as { handled?: boolean })?.handled) {
              return;
            }
          }
          const klubExitBtn = document.querySelector<HTMLElement>('[data-klub-exit-btn="true"]');
          if (klubExitBtn) {
            klubExitBtn.click();
            return;
          }
          setSection('home');
          setIsSidebarOpen(true);
          return;
        }
        // Even on home screen, intercept Back so MSX never closes the app; focus the sidebar
        setIsSidebarOpen(true);
        const firstNav =
          rootContainerRef.current?.querySelector<HTMLElement>('aside button');
        firstNav?.focus();
        return;
      }

      // If Live TV Player Modal is open, let TvPlayerModal & TvOsdChannelList handle all keys directly (Smart IPTV OSD),
      // EXCEPT when in embedded TV Online (section === 'tv') in Split-View and focus is currently in the Left Sidebar (<aside>) or Top Header (<header>).
      const focusedNow = document.activeElement as HTMLElement | null;
      const isTvInFullMode = Boolean(
        document.querySelector('#aether-tv-player-modal[data-full-mode="true"]')
      );
      const isFocusInSidebarOrHeader = Boolean(
        !isTvInFullMode &&
        (focusedNow?.closest('aside') || focusedNow?.closest('header'))
      );
      if (currentTvChannel && (section !== 'tv' || !isFocusInSidebarOrHeader)) {
        return;
      }

      // Hardware TV Remote Play / Pause buttons when on Home Screen, Movie Detail Card (!isPlayingVod), or when Radio is active
      if (
        !isPlayingVod &&
        !isInputFocused &&
        (e.keyCode === 415 ||
          e.keyCode === 19 ||
          e.keyCode === 179 ||
          e.keyCode === 250 ||
          e.keyCode === 10252 ||
          e.key === 'MediaPlay' ||
          e.key === 'MediaPause' ||
          e.key === 'MediaPlayPause' ||
          e.key === 'Play' ||
          e.key === 'Pause')
      ) {
        const isPurePauseKey =
          e.keyCode === 19 || e.key === 'MediaPause' || e.key === 'Pause';

        const activeEl = document.activeElement as HTMLElement | null;

        // 1. If an episode card is focused (either in Series Detail or Episodes Drawer), start playback of that episode
        const focusedEpisode = activeEl?.closest(
          '[data-episode-card="true"]'
        ) as HTMLElement | null;
        if (focusedEpisode && !isPurePauseKey && activeVodItem) {
          e.preventDefault();
          e.stopPropagation();
          const epNum = Number(focusedEpisode.getAttribute('data-episode-num')) || selectedEpisode;
          const sNum = Number(focusedEpisode.getAttribute('data-season-num')) || selectedSeason;
          userSelectedFlTorrentIdRef.current = null;
          setSelectedSeason(sNum);
          setSelectedEpisode(epNum);
          const epKey = `S${sNum}E${epNum}`;
          const epProg = (findWatchProgressEntry(watchProgressMapRef.current, activeVodItem) || findWatchProgressEntry(watchProgressMap, activeVodItem))?.episodeProgressMap?.[epKey];
          const epDur = epProg?.duration && epProg.duration > 60 ? epProg.duration : 2700;
          const epPct = epProg && epProg.currentTime > 10 ? Math.min(100, Math.max(5, Math.round((epProg.currentTime / epDur) * 100))) : 0;
          const startAt = epProg && epProg.currentTime > 10 && epPct < 92 ? epProg.currentTime : 0;
          handleStartVodPlayback(startAt);
          return;
        }

        // 2. If already viewing a movie/series detail card and not pure pause:
        if (activeVodItem && !isPurePauseKey) {
          e.preventDefault();
          e.stopPropagation();
          playVodBtnRef.current?.click();
          return;
        }

        // 3. If focused on a VOD poster / card / button anywhere:
        const focusedCard = activeEl?.closest(
          '[data-watched-poster-btn="true"], [data-vod-card="true"], [data-klub-card="true"], [data-vod-id]'
        ) as HTMLElement | null;

        if (focusedCard && !isPurePauseKey) {
          e.preventDefault();
          e.stopPropagation();
          if (playerStatus === 'playing' || playerStatus === 'loading') {
            stopRadio();
          }
          const vodId = focusedCard.getAttribute('data-vod-id');
          let targetItem: CinemetaItem | null = null;
          if (vodId) {
            targetItem =
              historyList.find((h) => h.item.id === vodId)?.item ||
              homeShelves.watchingNowMix.find((i) => i.id === vodId) ||
              homeShelves.newlyAddedMix.find((i) => i.id === vodId) ||
              homeShelves.popularSeries.find((i) => i.id === vodId) ||
              homeShelves.popularMovies.find((i) => i.id === vodId) ||
              homeShelves.cartoons.find((i) => i.id === vodId) ||
              vodItems.find((i) => i.id === vodId) ||
              heroBillboardItems.find((i) => i.id === vodId) ||
              null;
          }
          if (!targetItem) {
            targetItem = lastFocusedVodItemRef.current;
          }
          if (targetItem) {
            const progress = findWatchProgressEntry(watchProgressMapRef.current, targetItem) || findWatchProgressEntry(watchProgressMap, targetItem);
            const resumeSeason =
              targetItem.type === 'series'
                ? Math.max(1, Number(progress?.season) || 1)
                : 1;
            const resumeEpisode =
              targetItem.type === 'series'
                ? Math.max(1, Number(progress?.episode) || 1)
                : 1;
            handleOpenVod(targetItem, true, resumeSeason, resumeEpisode);
            return;
          }
        }

        // 4. If focus is inside <main> (browsing cards / shelves / grids), DO NOT fallback to playing random last watched!
        const isInsideMainContent = Boolean(activeEl?.closest('main'));
        if (isInsideMainContent) {
          return;
        }

        // 5. Only if in an empty/sidebar area on home screen, quick-resume last watched:
        if (!activeVodItem && !isPurePauseKey && triggerHomeQuickPlayRef.current()) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (
          currentStation &&
          !activeVodItem &&
          (playerStatus === 'playing' ||
            section === 'radio' ||
            isTvRadioPlayerOpen)
        ) {
          e.preventDefault();
          e.stopPropagation();
          if (playerStatus === 'playing') {
            stopRadio();
          } else if (!isPurePauseKey) {
            playStation(currentStation, radioStations);
          }
          return;
        }
      }

      // Hardware TV Remote Color Buttons when NOT playing video (!isPlayingVod)
      // Yellow Button (405 / F3 / ColorF2Yellow / Yellow / 'y' / 'Y'): Mark current Movie, Episode, or Series as Watched / Unwatched
      const isYellowKey =
        (e.keyCode === 405 ||
          e.key === 'F3' ||
          e.key === 'ColorF2Yellow' ||
          e.key === 'Yellow' ||
          ((e.key === 'y' || e.key === 'Y') && !isInputFocused));

      if (!isPlayingVod && isYellowKey && !isSettingsDrawerOpen && !isSubFinderOpen) {
        e.preventDefault();
        e.stopPropagation();

        const activeEl = document.activeElement as HTMLElement | null;
        const focusedEpBtn = activeEl?.closest('[data-episode-card="true"]');
        if (focusedEpBtn) {
          const sNum = Number(focusedEpBtn.getAttribute('data-season-num') || focusedEpBtn.getAttribute('data-season')) || selectedSeason || 1;
          const epNum = Number(focusedEpBtn.getAttribute('data-episode-num') || focusedEpBtn.getAttribute('data-episode')) || selectedEpisode || 1;
          handleToggleWatchedStatus(activeVodItem, sNum, epNum);
          return;
        }

        if (activeVodItem) {
          handleToggleWatchedStatus(activeVodItem, selectedSeason, selectedEpisode);
          return;
        }

        const focusedCard = activeEl?.closest(
          '[data-watched-poster-btn="true"], [data-vod-card="true"], [data-klub-card="true"]'
        );
        if (focusedCard && lastFocusedVodItemRef.current) {
          handleToggleWatchedStatus(lastFocusedVodItemRef.current);
          return;
        }
      }

      // Allow physical PC keyboard typing anywhere in Search, YouTube, Torrents, TV, or Radio section even when <input> is not focused
      if (
        (section === 'search' ||
          section === 'youtube' ||
          section === 'torrents' ||
          section === 'tv' ||
          section === 'radio') &&
        !activeVodItem &&
        !isPlayingVod &&
        !currentTvChannel &&
        !isTvRadioPlayerOpen &&
        !isSubFinderOpen &&
        !isSettingsDrawerOpen &&
        !isInputFocused &&
        !document.querySelector('[data-klubnichka-root="true"]')
      ) {
        if (e.key === 'Backspace') {
          e.preventDefault();
          if (section === 'tv') {
            setTvSearchQuery((q) => q.slice(0, -1));
          } else if (section === 'radio') {
            setRadioSearchQuery((q) => q.slice(0, -1));
          } else if (section === 'torrents') {
            setFlSearchQuery((q) => q.slice(0, -1));
          } else if (section === 'youtube') {
            setYtSearchQuery((q) => q.slice(0, -1));
          } else {
            setSearchQuery((q) => q.slice(0, -1));
          }
          return;
        }
        if (
          e.key.length === 1 &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey
        ) {
          e.preventDefault();
          if (section === 'tv') {
            setTvSearchQuery((q) => q + e.key);
          } else if (section === 'radio') {
            setRadioSearchQuery((q) => q + e.key);
          } else if (section === 'torrents') {
            setFlSearchQuery((q) => q + e.key);
          } else if (section === 'youtube') {
            setYtSearchQuery((q) => q + e.key);
          } else {
            setSearchQuery((q) => q + e.key);
          }
          return;
        }
      }

      // If user is typing inside <input>, allow escaping with Up/Down or Left/Right at text boundaries
      if (isInputFocused) {
        const inp = document.activeElement as HTMLInputElement | null;
        const val = String(inp?.value || '');
        if (e.key === 'ArrowLeft' && val.length > 0 && (inp?.selectionStart ?? 0) > 0) {
          return;
        }
        if (e.key === 'ArrowRight' && val.length > 0 && (inp?.selectionEnd ?? val.length) < val.length) {
          return;
        }
        if (
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown' ||
          e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight'
        ) {
          inp?.blur();
        }
      }

      // If VOD Fullscreen Player is active:
      // - Deterministic TV Remote navigation between Top Bar, Timeline Slider, and Bottom Controls (Play, -15s, +15s, Next Episode, Audio, Subtitles, Quality)
      if (isPlayingVod && !isSettingsDrawerOpen && !isSubFinderOpen) {
        const kc = e.keyCode || e.which;
        const k = e.key;
        const vodMenuEl = playerBoxRef.current?.querySelector(
          '[data-vod-open-menu]'
        );
        const vodMenuState = vodMenuEl?.getAttribute('data-vod-open-menu');
        const isVodSubMenuOpen =
          Boolean(vodMenuState) && vodMenuState !== 'none';
        const isAnyVodOverlayOpen =
          isInfoSheetOpen || isEpisodesDrawerOpen || isKlubSuggestionsOpen || isVodSubMenuOpen;
        const activeEl = document.activeElement as HTMLElement | null;
        const isOsdControlFocused =
          isVodOsdVisible &&
          Boolean(
            activeEl &&
            playerBoxRef.current?.contains(activeEl) &&
            activeEl !== playerBoxRef.current &&
            (activeEl.tagName === 'BUTTON' ||
              activeEl.tagName === 'INPUT' ||
              activeEl.tagName === 'SELECT' ||
              activeEl.hasAttribute('data-vod-timeline-slider'))
          );

        // 1. YELLOW BUTTON (405 / 185 / F3 / ColorF2Yellow / Yellow / 'y'): Cycle Video Format (Original 16:9 / Zoom Cinema 21:9 / Ecran Plin 100%)
        if (
          kc === 405 ||
          kc === 185 ||
          k === 'F3' ||
          k === 'ColorF2Yellow' ||
          k === 'Yellow' ||
          ((k === 'y' || k === 'Y') && !isInputFocused)
        ) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          wakeVodOsd();
          window.dispatchEvent(new CustomEvent('aether:vod-close-menu'));
          window.dispatchEvent(new CustomEvent('aether:vod-cycle-format'));
          return;
        }

        // 2. GREEN BUTTON (404 / 184 / F2 / ColorF1Green / Green / 'g'): Toggle Subtitles Menu directly
        if (
          kc === 404 ||
          kc === 184 ||
          k === 'F2' ||
          k === 'ColorF1Green' ||
          k === 'Green' ||
          ((k === 'g' || k === 'G') && !isInputFocused)
        ) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          wakeVodOsd();
          setIsEpisodesDrawerOpen(false);
          if (vodMenuEl) {
            setIsInfoSheetOpen(false);
            window.dispatchEvent(
              new CustomEvent('aether:vod-open-menu', {
                detail: { menu: 'subtitles' },
              })
            );
          } else {
            setIsInfoSheetOpen((prev) => {
              const nextOpen = !prev;
              if (nextOpen) {
                window.setTimeout(() => {
                  const subBtn =
                    playerBoxRef.current?.querySelector<HTMLElement>(
                      '[data-vod-sheet-open="true"] [data-sheet-sub-btn="true"]'
                    ) ||
                    playerBoxRef.current?.querySelector<HTMLElement>(
                      '[data-vod-sheet-open="true"] button'
                    );
                  subBtn?.focus();
                }, 45);
              }
              return nextOpen;
            });
          }
          return;
        }

        // 3. BLUE BUTTON (406 / 186 / F4 / ColorF3Blue / Blue / 'b'): Toggle Audio Track / Source Menu directly
        if (
          kc === 406 ||
          kc === 186 ||
          k === 'F4' ||
          k === 'ColorF3Blue' ||
          k === 'Blue' ||
          ((k === 'b' || k === 'B') && !isInputFocused)
        ) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          wakeVodOsd();
          setIsEpisodesDrawerOpen(false);
          setIsInfoSheetOpen(false);
          const hasNativeAudioPopover = Boolean(
            vodMenuEl &&
            (resolvedDirectStream?.audioNames?.length ||
              playerBoxRef.current?.querySelector(
                '[data-vod-primary-audio-btn="true"]'
              ))
          );
          if (vodMenuEl) {
            window.dispatchEvent(
              new CustomEvent('aether:vod-open-menu', {
                detail: {
                  menu: hasNativeAudioPopover ? 'audio' : 'server',
                },
              })
            );
          }
          return;
        }

        // 4. RED BUTTON (403 / 183 / F1 / ColorF0Red / Red / 'r'): Toggle Video Source & Quality Menu directly
        if (
          kc === 403 ||
          kc === 183 ||
          k === 'F1' ||
          k === 'ColorF0Red' ||
          k === 'Red' ||
          ((k === 'r' || k === 'R') && !isInputFocused)
        ) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          wakeVodOsd();
          setIsEpisodesDrawerOpen(false);
          if (vodMenuEl) {
            setIsInfoSheetOpen(false);
            window.dispatchEvent(
              new CustomEvent('aether:vod-open-menu', {
                detail: { menu: 'quality' },
              })
            );
          } else {
            setIsInfoSheetOpen((prev) => !prev);
          }
          return;
        }

        const getBottomRowBtns = () =>
          Array.from(
            playerBoxRef.current?.querySelectorAll<HTMLButtonElement>(
              '[data-vod-bottom-row="true"] button:not([disabled])'
            ) || []
          ).filter(
            (btn) =>
              btn.offsetParent !== null &&
              !btn.closest('[data-vod-menu-popover="true"]')
          );
        const getTopBarBtns = () =>
          Array.from(
            playerBoxRef.current?.querySelectorAll<HTMLButtonElement>(
              '[data-vod-top-bar="true"] button:not([disabled])'
            ) || []
          ).filter((btn) => btn.offsetParent !== null);

        const floatingBarEl =
          playerBoxRef.current?.querySelector<HTMLElement>(
            '[data-vod-floating-bar="true"]'
          ) || null;
        const floatingBtns = floatingBarEl
          ? Array.from(
            floatingBarEl.querySelectorAll<HTMLButtonElement>(
              'button:not([disabled])'
            )
          )
          : [];
        const skipIntroBtn =
          playerBoxRef.current?.querySelector<HTMLButtonElement>(
            '[data-vod-skip-intro-btn="true"]'
          ) || null;
        const autoNextBtn =
          playerBoxRef.current?.querySelector<HTMLButtonElement>(
            '[data-vod-autonext-btn="true"]'
          ) || null;
        const floatingPrimaryBtn =
          skipIntroBtn || autoNextBtn || floatingBtns[0] || null;

        // Direct 1-Click Remote OK ("Enter") and Left/Right navigation for "Sari peste Intro" / "Următorul Episod" / "Sfârșit Film" when visible
        if (!isAnyVodOverlayOpen && floatingPrimaryBtn) {
          const isFocusedOnFloating =
            Boolean(floatingBarEl && activeEl && floatingBarEl.contains(activeEl));

          if (
            (e.key === 'Enter' || kc === 13) &&
            (isFocusedOnFloating || !isOsdControlFocused)
          ) {
            e.preventDefault();
            e.stopPropagation();
            if (isFocusedOnFloating && activeEl instanceof HTMLButtonElement) {
              activeEl.click();
            } else {
              floatingPrimaryBtn.click();
            }
            return;
          }

          if (isFocusedOnFloating && floatingBtns.length > 0) {
            const curFloatIdx = floatingBtns.indexOf(
              activeEl as HTMLButtonElement
            );
            if (e.key === 'ArrowRight' && curFloatIdx >= 0 && curFloatIdx + 1 < floatingBtns.length) {
              e.preventDefault();
              e.stopPropagation();
              floatingBtns[curFloatIdx + 1]?.focus();
              return;
            }
            if (e.key === 'ArrowLeft' && curFloatIdx > 0) {
              e.preventDefault();
              e.stopPropagation();
              floatingBtns[curFloatIdx - 1]?.focus();
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              e.stopPropagation();
              wakeVodOsd();
              const topBtns = getTopBarBtns();
              (topBtns[topBtns.length - 1] || topBtns[0])?.focus();
              return;
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
              e.preventDefault();
              e.stopPropagation();
              wakeVodOsd();
              const timelineSlider =
                playerBoxRef.current?.querySelector<HTMLElement>(
                  '[data-vod-timeline-slider="true"]'
                );
              const playBtn =
                playerBoxRef.current?.querySelector<HTMLButtonElement>(
                  '[data-vod-play-btn="true"]'
                );
              (timelineSlider || playBtn || getBottomRowBtns()[0])?.focus();
              return;
            }
          }
        }

        // Klubnichka 18+ Suggestions Drawer Remote Navigation (ArrowDown opens, ArrowLeft/Right cycles, ArrowUp closes, OK / PLAY starts video)
        if (activeVodItem?.isAdultKlubnichka) {
          if (isKlubSuggestionsOpen) {
            const cards = Array.from(
              playerBoxRef.current?.querySelectorAll<HTMLButtonElement>(
                '[data-klub-suggestion-card="true"]'
              ) || []
            );
            const curIdx = cards.indexOf(activeEl as HTMLButtonElement);

            if (e.key === 'ArrowRight') {
              e.preventDefault();
              e.stopPropagation();
              const nextCard = cards[curIdx + 1] || cards[0];
              nextCard?.focus();
              nextCard?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
              return;
            }
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              e.stopPropagation();
              const prevCard = curIdx > 0 ? cards[curIdx - 1] : cards[cards.length - 1];
              prevCard?.focus();
              prevCard?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              e.stopPropagation();
              setIsKlubSuggestionsOpen(false);
              window.setTimeout(() => {
                playerBoxRef.current
                  ?.querySelector<HTMLButtonElement>('[data-vod-play-btn="true"]')
                  ?.focus();
              }, 35);
              return;
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            if (
              e.key === 'Enter' ||
              e.key === 'Play' ||
              kc === 13 ||
              kc === 415 ||
              kc === 179
            ) {
              if (curIdx >= 0 && klubSuggestions[curIdx]) {
                e.preventDefault();
                e.stopPropagation();
                const selectedCard = klubSuggestions[curIdx];
                const mapped = mapKlubCardToCinemetaItem(selectedCard);
                persistedKlubCache.lastClickedCardId = selectedCard.id;
                setIsKlubSuggestionsOpen(false);
                handleOpenVod(mapped, true);
                return;
              }
            }
          } else if (
            e.key === 'ArrowDown' &&
            !isVodSubMenuOpen &&
            !isInfoSheetOpen &&
            !isEpisodesDrawerOpen &&
            (!isOsdControlFocused ||
              Boolean(
                playerBoxRef.current
                  ?.querySelector('[data-vod-bottom-row="true"]')
                  ?.contains(activeEl)
              ))
          ) {
            e.preventDefault();
            e.stopPropagation();
            setIsKlubSuggestionsOpen(true);
            window.setTimeout(() => {
              const firstCard = playerBoxRef.current?.querySelector<HTMLButtonElement>(
                '[data-klub-suggestion-card="true"]'
              );
              firstCard?.focus();
              firstCard?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
            }, 50);
            return;
          }
        }

        // Deterministic Row-by-Row TV Remote Navigation inside VOD Popover Menus (Subtitles, Audio, Server, Quality)
        const vodPopoverEl =
          playerBoxRef.current?.querySelector<HTMLElement>(
            '[data-vod-menu-popover="true"]'
          ) || null;
        if (
          vodPopoverEl &&
          (e.key === 'ArrowUp' ||
            e.key === 'ArrowDown' ||
            e.key === 'ArrowLeft' ||
            e.key === 'ArrowRight')
        ) {
          e.preventDefault();
          e.stopPropagation();
          wakeVodOsd();

          const allPopoverBtns = Array.from(
            vodPopoverEl.querySelectorAll<HTMLButtonElement>(
              'button:not([disabled])'
            )
          );
          if (allPopoverBtns.length === 0) return;

          // Group buttons into explicit logical rows (using data-vod-popover-row="true" or 1-button-per-row)
          const rows: HTMLButtonElement[][] = [];
          const rowContainerMap = new Map<HTMLElement, HTMLButtonElement[]>();
          for (const btn of allPopoverBtns) {
            const rowContainer = btn.closest<HTMLElement>(
              '[data-vod-popover-row="true"]'
            );
            if (rowContainer && vodPopoverEl.contains(rowContainer)) {
              let grp = rowContainerMap.get(rowContainer);
              if (!grp) {
                grp = [];
                rowContainerMap.set(rowContainer, grp);
                rows.push(grp);
              }
              grp.push(btn);
            } else {
              rows.push([btn]);
            }
          }

          let curRowIdx = -1;
          let curColIdx = -1;
          for (let r = 0; r < rows.length; r++) {
            const c = rows[r].indexOf(activeEl as HTMLButtonElement);
            if (c !== -1) {
              curRowIdx = r;
              curColIdx = c;
              break;
            }
          }

          if (curRowIdx === -1) {
            const initialBtn =
              vodPopoverEl.querySelector<HTMLButtonElement>(
                '[data-sub-track-active="true"], [data-audio-track-active="true"], [data-server-opt-active="true"], [data-quality-opt-active="true"], [data-sub-track-opt="true"]'
              ) || allPopoverBtns[0];
            initialBtn?.focus();
            initialBtn?.scrollIntoView({
              block: 'nearest',
              behavior: 'smooth',
            });
            return;
          }

          let targetBtn: HTMLButtonElement | undefined;
          if (e.key === 'ArrowDown') {
            const nextRow = rows[curRowIdx + 1];
            if (nextRow && nextRow.length > 0) {
              targetBtn = nextRow[Math.min(curColIdx, nextRow.length - 1)];
            } else {
              window.dispatchEvent(new CustomEvent('aether:vod-close-menu'));
              return;
            }
          } else if (e.key === 'ArrowUp') {
            const prevRow = rows[curRowIdx - 1];
            if (prevRow && prevRow.length > 0) {
              targetBtn = prevRow[Math.min(curColIdx, prevRow.length - 1)];
            }
          } else if (e.key === 'ArrowRight') {
            const curRow = rows[curRowIdx];
            if (curRow && curColIdx + 1 < curRow.length) {
              targetBtn = curRow[curColIdx + 1];
            }
          } else if (e.key === 'ArrowLeft') {
            const curRow = rows[curRowIdx];
            if (curRow && curColIdx - 1 >= 0) {
              targetBtn = curRow[curColIdx - 1];
            }
          }

          if (targetBtn) {
            targetBtn.focus();
            targetBtn.scrollIntoView({
              block: 'nearest',
              behavior: 'smooth',
            });
          }
          return;
        }

        if (
          !isAnyVodOverlayOpen &&
          !isOsdControlFocused &&
          (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
        ) {
          e.preventDefault();
          e.stopPropagation();
          hideVodOsd();
          window.dispatchEvent(
            new CustomEvent('aether:vod-transport', {
              detail: { action: e.key === 'ArrowRight' ? 'ff' : 'rw' },
            })
          );
          return;
        }

        if (
          !isAnyVodOverlayOpen &&
          !isOsdControlFocused &&
          (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter')
        ) {
          e.preventDefault();
          e.stopPropagation();
          wakeVodOsd();
          // During playback when not on OSD: ArrowUp opens Info / Details sheet
          if (e.key === 'ArrowUp') {
            window.dispatchEvent(new CustomEvent('aether:vod-close-menu'));
            setIsEpisodesDrawerOpen(false);
            setIsInfoSheetOpen(true);
            window.setTimeout(() => {
              const targetBtn =
                playerBoxRef.current?.querySelector<HTMLElement>(
                  '[data-vod-sheet-open="true"] [data-sheet-close-btn="true"]'
                ) ||
                playerBoxRef.current?.querySelector<HTMLElement>(
                  '[data-vod-sheet-open="true"] button'
                );
              targetBtn?.focus();
            }, 45);
            return;
          }
          // On a series, pressing ArrowDown on the TV remote immediately opens the Episodes shelf
          if (e.key === 'ArrowDown' && activeVodItem?.type === 'series') {
            window.dispatchEvent(new CustomEvent('aether:vod-close-menu'));
            setIsInfoSheetOpen(false);
            setIsEpisodesDrawerOpen(true);
            window.setTimeout(() => {
              const targetBtn =
                playerBoxRef.current?.querySelector<HTMLElement>(
                  '[data-episodes-drawer="true"] [data-drawer-initial-focus="true"]'
                ) ||
                playerBoxRef.current?.querySelector<HTMLElement>(
                  '[data-episodes-drawer="true"] button'
                );
              targetBtn?.focus();
              targetBtn?.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth',
              });
            }, 45);
            return;
          }
          window.setTimeout(() => {
            const playBtn =
              playerBoxRef.current?.querySelector<HTMLButtonElement>(
                '[data-vod-play-btn="true"]'
              );
            const seekFwdBtn =
              playerBoxRef.current?.querySelector<HTMLButtonElement>(
                '[data-vod-seek-fwd-15="true"]'
              );
            const nextEpBtn =
              playerBoxRef.current?.querySelector<HTMLButtonElement>(
                '[data-vod-next-ep-btn="true"]'
              );
            const topEpisodesBtn =
              playerBoxRef.current?.querySelector<HTMLButtonElement>(
                '[data-vod-top-episodes-btn="true"]'
              );
            const topBackBtn =
              playerBoxRef.current?.querySelector<HTMLButtonElement>(
                '[data-vod-top-back-btn="true"]'
              );
            const bottomBtns = getBottomRowBtns();
            if (e.key === 'ArrowUp') {
              (
                floatingPrimaryBtn ||
                topEpisodesBtn ||
                topBackBtn ||
                playBtn ||
                bottomBtns[0] ||
                vodAudioBtnRef.current
              )?.focus();
            } else {
              (
                floatingPrimaryBtn ||
                playBtn ||
                seekFwdBtn ||
                nextEpBtn ||
                bottomBtns[0] ||
                topEpisodesBtn ||
                vodAudioBtnRef.current
              )?.focus();
            }
          }, 25);
          return;
        }

        if (!isAnyVodOverlayOpen && isOsdControlFocused && activeEl) {
          const bottomRowEl = playerBoxRef.current?.querySelector<HTMLElement>(
            '[data-vod-bottom-row="true"]'
          );
          const timelineBtn =
            playerBoxRef.current?.querySelector<HTMLElement>(
              '[data-vod-timeline-slider="true"]'
            );
          const topEpisodesBtn =
            playerBoxRef.current?.querySelector<HTMLButtonElement>(
              '[data-vod-top-episodes-btn="true"]'
            );
          const topBackBtn =
            playerBoxRef.current?.querySelector<HTMLButtonElement>(
              '[data-vod-top-back-btn="true"]'
            );

          // 1. When Timeline Seek Bar is focused:
          if (activeEl === timelineBtn) {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              e.stopPropagation();
              window.dispatchEvent(
                new CustomEvent('aether:vod-transport', {
                  detail: { action: e.key === 'ArrowRight' ? 'ff' : 'rw' },
                })
              );
              wakeVodOsd();
              return;
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              e.stopPropagation();
              wakeVodOsd();
              const bottomBtns = getBottomRowBtns();
              (
                playerBoxRef.current?.querySelector<HTMLButtonElement>(
                  '[data-vod-play-btn="true"]'
                ) || bottomBtns[0]
              )?.focus();
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              e.stopPropagation();
              wakeVodOsd();
              const topBtns = getTopBarBtns();
              (floatingPrimaryBtn || topBtns[0] || topEpisodesBtn || topBackBtn)?.focus();
              return;
            }
          }

          // 2. When any button inside Bottom Row is focused:
          if (bottomRowEl && bottomRowEl.contains(activeEl)) {
            const bottomBtns = getBottomRowBtns();
            const curIdx = bottomBtns.indexOf(activeEl as HTMLButtonElement);
            if (e.key === 'ArrowRight' && curIdx >= 0) {
              e.preventDefault();
              e.stopPropagation();
              wakeVodOsd();
              const nextBtn = bottomBtns[curIdx + 1] || bottomBtns[0];
              nextBtn?.focus();
              return;
            }
            if (e.key === 'ArrowLeft' && curIdx >= 0) {
              e.preventDefault();
              e.stopPropagation();
              wakeVodOsd();
              const prevBtn =
                bottomBtns[curIdx - 1] || bottomBtns[bottomBtns.length - 1];
              prevBtn?.focus();
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              e.stopPropagation();
              wakeVodOsd();
              const topBtns = getTopBarBtns();
              (timelineBtn || floatingPrimaryBtn || topBtns[0] || topEpisodesBtn || topBackBtn)?.focus();
              return;
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              e.stopPropagation();
              wakeVodOsd();
              window.dispatchEvent(new CustomEvent('aether:vod-close-menu'));
              if (activeVodItem?.type === 'series') {
                setIsInfoSheetOpen(false);
                setIsEpisodesDrawerOpen(true);
                window.setTimeout(() => {
                  const targetBtn =
                    playerBoxRef.current?.querySelector<HTMLElement>(
                      '[data-episodes-drawer="true"] [data-drawer-initial-focus="true"]'
                    ) ||
                    playerBoxRef.current?.querySelector<HTMLElement>(
                      '[data-episodes-drawer="true"] button'
                    );
                  targetBtn?.focus();
                  targetBtn?.scrollIntoView({
                    block: 'nearest',
                    behavior: 'smooth',
                  });
                }, 45);
              } else {
                setIsEpisodesDrawerOpen(false);
                setIsInfoSheetOpen(true);
                window.setTimeout(() => {
                  const targetBtn =
                    playerBoxRef.current?.querySelector<HTMLElement>(
                      '[data-vod-sheet-open="true"] [data-sheet-close-btn="true"]'
                    ) ||
                    playerBoxRef.current?.querySelector<HTMLElement>(
                      '[data-vod-sheet-open="true"] button'
                    );
                  targetBtn?.focus();
                }, 45);
              }
              return;
            }
          }

          // 3. When a Top Bar button is focused: Left/Right cycles top bar buttons, Down goes to Floating/Timeline/Bottom Row:
          const topBarBtns = getTopBarBtns();
          const topIdx = topBarBtns.indexOf(activeEl as HTMLButtonElement);
          if (topIdx >= 0) {
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              e.stopPropagation();
              wakeVodOsd();
              const nextTop = topBarBtns[topIdx + 1] || topBarBtns[0];
              nextTop?.focus();
              return;
            }
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              e.stopPropagation();
              wakeVodOsd();
              const prevTop =
                topBarBtns[topIdx - 1] || topBarBtns[topBarBtns.length - 1];
              prevTop?.focus();
              return;
            }
          }
          if (
            e.key === 'ArrowDown' &&
            (!bottomRowEl || !bottomRowEl.contains(activeEl)) &&
            activeEl !== timelineBtn
          ) {
            e.preventDefault();
            e.stopPropagation();
            wakeVodOsd();
            const bottomBtns = getBottomRowBtns();
            (
              floatingPrimaryBtn ||
              timelineBtn ||
              playerBoxRef.current?.querySelector<HTMLButtonElement>(
                '[data-vod-play-btn="true"]'
              ) ||
              bottomBtns[0]
            )?.focus();
            return;
          }
        }

        wakeVodOsd();
      }

      // Lampa 2D Spatial D-Pad Navigation for TV Remote Arrows across Catalog, Drawers, Portaled Modals & VOD Player
      if (
        e.key === 'ArrowRight' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowUp'
      ) {
        const portaledOverlayRoot =
          document.querySelector<HTMLElement>('[data-weather-modal="true"]') ||
          (isSubFinderOpen ? document.querySelector<HTMLElement>('[data-sub-finder-modal="true"]') : null) ||
          (isDownloadModalOpen ? document.querySelector<HTMLElement>('[data-download-modal="true"]') : null) ||
          (isTrailerModalOpen ? document.querySelector<HTMLElement>('[data-trailer-fullscreen-box="true"]') : null) ||
          document.querySelector<HTMLElement>('[data-iedem-detail-modal="true"]') ||
          document.querySelector<HTMLElement>('[data-music-fullscreen-modal="true"]');
        const root = portaledOverlayRoot
          ? portaledOverlayRoot
          : isSettingsDrawerOpen
          ? rootContainerRef.current?.querySelector<HTMLElement>(
            '[data-settings-drawer="true"]'
          ) || rootContainerRef.current
          : isFilterDrawerOpen
            ? rootContainerRef.current?.querySelector<HTMLElement>(
              '[data-filter-drawer="true"]'
            ) || rootContainerRef.current
            : isCatalogDrawerOpen
              ? rootContainerRef.current?.querySelector<HTMLElement>(
                '[data-catalog-drawer="true"]'
              ) || rootContainerRef.current
              : isHandoffModalOpen || isPinLockRequired
                ? document.querySelector<HTMLElement>(
                  '[data-handoff-modal="true"]'
                ) || rootContainerRef.current
                : isProfilePickerOpen
                  ? rootContainerRef.current?.querySelector<HTMLElement>(
                    '[data-profile-picker-modal="true"]'
                  ) || rootContainerRef.current
                  : selectedActor
                    ? rootContainerRef.current?.querySelector<HTMLElement>(
                      '[data-actor-profile-modal="true"]'
                    ) || rootContainerRef.current
                    : rootContainerRef.current?.querySelector<HTMLElement>(
                        '[data-imdb-dropdown-popover="true"]'
                      )
                      ? rootContainerRef.current.querySelector<HTMLElement>(
                        '[data-imdb-dropdown-popover="true"]'
                      )
                    : isPlayingVod && !isSettingsDrawerOpen
                      ? playerBoxRef.current?.querySelector<HTMLElement>(
                        '[data-vod-menu-popover="true"]'
                      ) ||
                      playerBoxRef.current?.querySelector<HTMLElement>(
                        '[data-vod-sheet-open="true"]'
                      ) ||
                      playerBoxRef.current?.querySelector<HTMLElement>(
                        '[data-episodes-drawer="true"]'
                      ) ||
                      playerBoxRef.current
                      : rootContainerRef.current;
        if (!root) return;
        // SMART TV SMOOTH PERFORMANCE OPTIMIZATION (REVERSIBLE):
        // Single-pass bounding box cache + smart viewport scroll check so rapid D-Pad navigation
        // does not trigger 3x layout reflows or queue overlapping smooth-scroll animations.
        const focusablesWithRect: Array<{ el: HTMLElement; rect: DOMRect }> = [];
        const focusSelector =
          root === rootContainerRef.current
            ? 'button:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), input[data-tv-focusable="true"]:not([disabled]):not([tabindex="-1"])'
            : 'input:not([disabled]):not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"])';
        const rawNodes = root.querySelectorAll<HTMLElement>(focusSelector);
        const vhLimit = typeof window !== 'undefined' ? (window.innerHeight || 1080) : 1080;
        for (let i = 0; i < rawNodes.length; i++) {
          const el = rawNodes[i];
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            if (r.top < vhLimit * 2.2 && r.bottom > -vhLimit * 1.2) {
              focusablesWithRect.push({ el, rect: r });
            }
          }
        }
        if (focusablesWithRect.length === 0) return;

        const headerEl = root.querySelector<HTMLElement>('header');
        const asideEl = root.querySelector<HTMLElement>('aside');
        const mainEl = root.querySelector<HTMLElement>('main');
        const findFirstNonBillboardVodCard = (
          container: HTMLElement | null
        ): HTMLElement | null => {
          if (!container) return null;
          const cards = container.querySelectorAll<HTMLElement>(
            '[data-vod-card="true"]'
          );
          for (let i = 0; i < cards.length; i++) {
            if (!cards[i].closest('[data-home-billboard="true"]')) {
              return cards[i];
            }
          }
          return cards[0] || null;
        };

        const focusTvTarget = (targetEl: HTMLElement, targetRect?: DOMRect) => {
          try {
            targetEl.focus({ preventScroll: true });
          } catch {
            targetEl.focus();
          }
          // Ensure non-scrolling overflow-hidden root layout container never accumulates programmatic scrollTop
          if (root === rootContainerRef.current) {
            if (root.scrollTop !== 0) root.scrollTop = 0;
            if (root.scrollLeft !== 0) root.scrollLeft = 0;
          }
          if (window.scrollY !== 0 || window.scrollX !== 0) {
            window.scrollTo(0, 0);
          }

          // Scroll any horizontal overflow-x-auto strip (category pills, filter chips, horizontal shelves) so focused button is always visible
          let hParent = targetEl.parentElement;
          while (hParent && hParent !== mainEl && hParent !== root) {
            if (hParent.scrollWidth > hParent.clientWidth + 4) {
              const hpStyle = window.getComputedStyle(hParent);
              if (hpStyle.overflowX === 'auto' || hpStyle.overflowX === 'scroll') {
                const hpRect = hParent.getBoundingClientRect();
                const elRect = targetEl.getBoundingClientRect();
                if (elRect.left < hpRect.left + 24) {
                  hParent.scrollLeft = Math.max(
                    0,
                    hParent.scrollLeft - (hpRect.left + 32 - elRect.left)
                  );
                } else if (elRect.right > hpRect.right - 24) {
                  hParent.scrollLeft = Math.min(
                    hParent.scrollWidth - hParent.clientWidth,
                    hParent.scrollLeft + (elRect.right - (hpRect.right - 32))
                  );
                }
                break;
              }
            }
            hParent = hParent.parentElement;
          }

          const r = targetRect || targetEl.getBoundingClientRect();

          // If navigating inside a scrollable modal/drawer (Episodes, Info, Settings, Filter, Catalog, Actor), find inner overflow-y-auto container
          if (
            root !== rootContainerRef.current &&
            root !== playerBoxRef.current &&
            root.contains(targetEl)
          ) {
            let scrollHost: HTMLElement = root;
            let probeEl: HTMLElement | null = targetEl.parentElement;
            while (probeEl && probeEl !== root) {
              if (probeEl.scrollHeight > probeEl.clientHeight + 2) {
                const st = window.getComputedStyle(probeEl);
                if (st.overflowY === 'auto' || st.overflowY === 'scroll') {
                  scrollHost = probeEl;
                  break;
                }
              }
              probeEl = probeEl.parentElement;
            }
            const hostRect = scrollHost.getBoundingClientRect();
            const offsetInHost = r.top - hostRect.top + scrollHost.scrollTop;
            if (r.top < hostRect.top + 28) {
              scrollHost.scrollTop = Math.max(0, offsetInHost - 36);
            } else if (r.bottom > hostRect.bottom - 28) {
              scrollHost.scrollTop = Math.max(
                0,
                offsetInHost - hostRect.height + r.height + 36
              );
            }
            return;
          }

          // Scroll ONLY <main> (never overflow-hidden parent containers via scrollIntoView)
          if (mainEl && mainEl.contains(targetEl)) {
            if (targetEl.closest('[data-bottom-player-bar="true"]')) {
              return;
            }
            const mainRect = mainEl.getBoundingClientRect();
            const offsetInMain = r.top - mainRect.top + mainEl.scrollTop;
            const isHeroBillboard = Boolean(targetEl.closest('[data-home-billboard="true"]'));
            const isTopHeroOrPlayer =
              isHeroBillboard ||
              Boolean(targetEl.closest('[data-top-hero-card="true"]')) ||
              Boolean(targetEl.closest('[data-music-top-bar="true"]')) ||
              Boolean(targetEl.getAttribute('data-top-pill') === 'true');

            if (isHeroBillboard) {
              if (mainEl.scrollTop > 0) {
                mainEl.scrollTop = 0;
              }
            } else if (
              isTopHeroOrPlayer &&
              offsetInMain + r.height <= mainRect.height - 56
            ) {
              if (mainEl.scrollTop > 0) {
                mainEl.scrollTop = 0;
              }
            } else if (r.top < mainRect.top + 52) {
              mainEl.scrollTop = Math.max(0, offsetInMain - 68);
            } else if (r.bottom > mainRect.bottom - 36) {
              mainEl.scrollTop = Math.max(
                0,
                offsetInMain - mainRect.height + r.height + 48
              );
            }
            return;
          }

          // Scroll ONLY <aside> when navigating inside the left sidebar
          if (asideEl && asideEl.contains(targetEl)) {
            const asideRect = asideEl.getBoundingClientRect();
            const offsetInAside = r.top - asideRect.top + asideEl.scrollTop;
            if (offsetInAside < 110) {
              if (asideEl.scrollTop > 0) {
                asideEl.scrollTop = 0;
              }
            } else if (r.top < asideRect.top + 20) {
              asideEl.scrollTop = Math.max(0, offsetInAside - 24);
            } else if (r.bottom > asideRect.bottom - 20) {
              asideEl.scrollTop = Math.max(
                0,
                offsetInAside - asideRect.height + r.height + 24
              );
            }
          }
        };

        const current = document.activeElement as HTMLElement | null;
        if (!current || !root.contains(current)) {
          e.preventDefault();
          if (
            isPlayingVod &&
            !isSettingsDrawerOpen &&
            vodAudioBtnRef.current &&
            focusablesWithRect.some((f) => f.el === vodAudioBtnRef.current)
          ) {
            vodAudioBtnRef.current.focus();
          } else {
            const initialDrawerBtn = root.querySelector<HTMLElement>(
              '[data-drawer-initial-focus="true"]'
            );
            const activeSidebarBtn =
              asideEl?.querySelector<HTMLElement>(
                '[data-sidebar-active="true"]'
              ) || asideEl?.querySelector<HTMLElement>('button');
            (initialDrawerBtn || activeSidebarBtn || focusablesWithRect[0].el).focus();
          }
          return;
        }

        // Dedicated Top Header Bar (<header>) Navigation:
        // Left/Right stays strictly inside <header> (Menu, Search, Calendar, Language RO/EN/RU, Light/Dark Mode, Profile, Settings, Fullscreen, Reload)
        // Down returns cleanly to the topmost row of <main> or <aside>
        if (
          headerEl &&
          headerEl.contains(current) &&
          !isSettingsDrawerOpen &&
          !isFilterDrawerOpen &&
          !isCatalogDrawerOpen
        ) {
          const headerItems = focusablesWithRect.filter(
            (item) => item.el.tagName === 'BUTTON' && headerEl.contains(item.el)
          );
          const hIdx = headerItems.findIndex((item) => item.el === current);

          if (e.key === 'ArrowRight') {
            e.preventDefault();
            const nextH = headerItems[(hIdx + 1) % headerItems.length];
            if (nextH) focusTvTarget(nextH.el, nextH.rect);
            return;
          }
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (hIdx > 0) {
              const prevH = headerItems[hIdx - 1];
              if (prevH) focusTvTarget(prevH.el, prevH.rect);
            } else if (asideEl) {
              const firstSidebarBtn =
                asideEl.querySelector<HTMLElement>(
                  '[data-sidebar-active="true"]'
                ) || asideEl.querySelector<HTMLElement>('button');
              if (firstSidebarBtn) focusTvTarget(firstSidebarBtn);
            }
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (hIdx === 0 && asideEl) {
              const activeAside =
                asideEl.querySelector<HTMLElement>(
                  '[data-sidebar-active="true"]'
                ) || asideEl.querySelector<HTMLElement>('button');
              if (activeAside) {
                focusTvTarget(activeAside);
                return;
              }
            }
            if (mainEl) {
              const preferredCard =
                mainEl.querySelector<HTMLElement>('[data-top-pill="true"]') ||
                mainEl.querySelector<HTMLElement>('[data-watched-poster-btn="true"]') ||
                findFirstNonBillboardVodCard(mainEl) ||
                mainEl.querySelector<HTMLElement>('[data-klub-card="true"]');
              if (preferredCard) {
                focusTvTarget(preferredCard);
                return;
              }
              const firstMain =
                focusablesWithRect.find(
                  (item) =>
                    mainEl.contains(item.el) && item.el.tagName !== 'INPUT'
                ) ||
                focusablesWithRect.find((item) => mainEl.contains(item.el));
              if (firstMain) {
                focusTvTarget(firstMain.el, firstMain.rect);
                return;
              }
            }
            if (asideEl) {
              const firstAside = asideEl.querySelector<HTMLElement>('button');
              if (firstAside) focusTvTarget(firstAside);
            }
            return;
          }
        }

        // Fast 1-Click TV Remote Navigation when inside Left Categories Sidebar (<aside>):
        // - Up/Down stays strictly inside the Categories list (and Up at index 0 jumps to <header> controls!)
        // - Right jumps in 1 single click directly to the first primary content item in <main>!
        if (
          asideEl &&
          asideEl.contains(current) &&
          !isSettingsDrawerOpen &&
          !isFilterDrawerOpen &&
          !isCatalogDrawerOpen
        ) {
          const sidebarItems: Array<{ el: HTMLElement; rect: DOMRect }> = [];
          const rawSidebarBtns = asideEl.querySelectorAll<HTMLElement>(
            'button:not([disabled])'
          );
          for (let i = 0; i < rawSidebarBtns.length; i++) {
            const btn = rawSidebarBtns[i];
            const rect = btn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              sidebarItems.push({ el: btn, rect });
            }
          }
          const curIdx = sidebarItems.findIndex((item) => item.el === current);

          if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextItem = sidebarItems[curIdx + 1] || sidebarItems[0];
            if (nextItem) focusTvTarget(nextItem.el, nextItem.rect);
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (curIdx > 0) {
              const prevItem = sidebarItems[curIdx - 1];
              if (prevItem) focusTvTarget(prevItem.el, prevItem.rect);
            } else {
              // At top of sidebar ("Acasă"), ArrowUp focuses the top bar utility buttons (Search / Language / Theme / Settings)
              const headerBtn =
                root.querySelector<HTMLElement>(
                  'header [data-header-lang-btn="true"]'
                ) ||
                root.querySelector<HTMLElement>(
                  'header [data-header-search-btn="true"]'
                ) ||
                root.querySelector<HTMLElement>('header button');
              headerBtn?.focus({ preventScroll: true });
            }
            return;
          }
          if (e.key === 'ArrowRight' && mainEl) {
            if (activeVodItem) {
              setIsSidebarOpen(false);
            }
            if (
              mainEl.scrollTop > 0 &&
              (section === 'tv' ||
                section === 'radio' ||
                section === 'music' ||
                section === 'home')
            ) {
              mainEl.scrollTop = 0;
            }
            const firstPrimaryCard =
              (section === 'home' && !activeVodItem
                ? mainEl.querySelector<HTMLElement>('[data-watched-poster-btn="true"]') ||
                  findFirstNonBillboardVodCard(mainEl)
                : null) ||
              ((section === 'torrents' || section === 'adult_18') && !activeVodItem
                ? findFirstNonBillboardVodCard(mainEl) ||
                  mainEl.querySelector<HTMLElement>('[data-klub-active-cat="true"]') ||
                  mainEl.querySelector<HTMLElement>('[data-klub-card="true"]') ||
                  mainEl.querySelector<HTMLElement>('[data-top-pill="true"]')
                : null) ||
              mainEl.querySelector<HTMLElement>('[data-watched-poster-btn="true"]') ||
              mainEl.querySelector<HTMLElement>(
                '[data-osd-channel-row="true"][aria-selected="true"]'
              ) ||
              mainEl.querySelector<HTMLElement>('[data-osd-channel-row="true"]') ||
              mainEl.querySelector<HTMLElement>('[data-tv-channel-card="true"]') ||
              findFirstNonBillboardVodCard(mainEl);
            if (firstPrimaryCard) {
              e.preventDefault();
              focusTvTarget(firstPrimaryCard);
              return;
            }
            const firstMainItem = focusablesWithRect.find((item) =>
              mainEl.contains(item.el)
            );
            if (firstMainItem) {
              e.preventDefault();
              focusTvTarget(firstMainItem.el, firstMainItem.rect);
              return;
            }
          }
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            return;
          }
        }

        const curEntry = focusablesWithRect.find((item) => item.el === current);
        const curRect = curEntry ? curEntry.rect : current.getBoundingClientRect();
        const curCx = curRect.left + curRect.width / 2;
        const curCy = curRect.top + curRect.height / 2;
        const isCurrentInMain = Boolean(mainEl && mainEl.contains(current));

        // Helper: check if two rects are on the same visual horizontal row
        const isSameHorizontalRow = (a: DOMRect, b: DOMRect): boolean => {
          const aCy = a.top + a.height / 2;
          const bCy = b.top + b.height / 2;
          const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (overlapY >= Math.min(a.height, b.height) * 0.35) return true;
          return Math.abs(aCy - bCy) <= Math.max(26, Math.min(a.height, b.height) * 0.72);
        };

        // 1. ArrowLeft inside <main>: stay strictly on the same horizontal row, or if at leftmost item of the row, jump to <aside>!
        if (
          e.key === 'ArrowLeft' &&
          isCurrentInMain &&
          mainEl &&
          asideEl &&
          !isSettingsDrawerOpen &&
          !isFilterDrawerOpen &&
          !isCatalogDrawerOpen
        ) {
          let bestMainLeft: { el: HTMLElement; rect: DOMRect } | null = null;
          let bestMainScore = Infinity;
          for (let i = 0; i < focusablesWithRect.length; i++) {
            const item = focusablesWithRect[i];
            if (item.el === current || !mainEl.contains(item.el)) continue;
            const r = item.rect;
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const dx = cx - curCx;
            if (dx >= -4) continue;
            if (!isSameHorizontalRow(curRect, r)) continue;
            const edgeGap = Math.max(0, curRect.left - r.right);
            const score = edgeGap + Math.abs(dx) * 0.35 + Math.abs(cy - curCy) * 2;
            if (score < bestMainScore) {
              bestMainScore = score;
              bestMainLeft = item;
            }
          }
          if (bestMainLeft) {
            e.preventDefault();
            focusTvTarget(bestMainLeft.el, bestMainLeft.rect);
            return;
          }
          // Check if there is a left column inside <main> (e.g. when in Right Column of Movie/Series details page)
          let bestColLeft: { el: HTMLElement; rect: DOMRect } | null = null;
          let bestColLeftScore = Infinity;
          for (let i = 0; i < focusablesWithRect.length; i++) {
            const item = focusablesWithRect[i];
            if (item.el === current || !mainEl.contains(item.el)) continue;
            const r = item.rect;
            if (r.right <= curRect.left + 12) {
              const cy = r.top + r.height / 2;
              const vDiff = Math.abs(cy - curCy);
              if (vDiff <= 380) {
                const hGap = Math.max(0, curRect.left - r.right);
                const score = vDiff * 1.4 + hGap * 0.5;
                if (score < bestColLeftScore) {
                  bestColLeftScore = score;
                  bestColLeft = item;
                }
              }
            }
          }
          if (bestColLeft) {
            e.preventDefault();
            focusTvTarget(bestColLeft.el, bestColLeft.rect);
            return;
          }
          const targetSidebarBtn =
            asideEl.querySelector<HTMLElement>('[data-sidebar-active="true"]') ||
            asideEl.querySelector<HTMLElement>('button');
          if (targetSidebarBtn) {
            e.preventDefault();
            focusTvTarget(targetSidebarBtn);
            return;
          }
        }

        // 2. ArrowRight inside <main>: prefer the next item to the right on the SAME horizontal row;
        //    or jump across to the Right Column (e.g. Continue / Audio / Server / Torrents on Movie details page);
        //    otherwise wrap to the leftmost item of the next row right below!
        if (
          e.key === 'ArrowRight' &&
          isCurrentInMain &&
          mainEl &&
          !isSettingsDrawerOpen &&
          !isFilterDrawerOpen &&
          !isCatalogDrawerOpen
        ) {
          let bestSameRowRight: { el: HTMLElement; rect: DOMRect } | null = null;
          let bestSameRowScore = Infinity;
          for (let i = 0; i < focusablesWithRect.length; i++) {
            const item = focusablesWithRect[i];
            if (item.el === current || !mainEl.contains(item.el)) continue;
            const r = item.rect;
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const dx = cx - curCx;
            if (dx <= 4) continue;
            if (!isSameHorizontalRow(curRect, r)) continue;
            const edgeGap = Math.max(0, r.left - curRect.right);
            const score = edgeGap + Math.abs(dx) * 0.35 + Math.abs(cy - curCy) * 2;
            if (score < bestSameRowScore) {
              bestSameRowScore = score;
              bestSameRowRight = item;
            }
          }
          if (bestSameRowRight) {
            e.preventDefault();
            focusTvTarget(bestSameRowRight.el, bestSameRowRight.rect);
            return;
          }
          // Check if there is a Right Column inside <main> (e.g. Watch Progress / Audio / Server / FileList on Movie/Series details page)
          let bestColRight: { el: HTMLElement; rect: DOMRect } | null = null;
          let bestColRightScore = Infinity;
          for (let i = 0; i < focusablesWithRect.length; i++) {
            const item = focusablesWithRect[i];
            if (item.el === current || !mainEl.contains(item.el)) continue;
            const r = item.rect;
            if (r.left >= curRect.right - 12) {
              const cy = r.top + r.height / 2;
              const vDiff = Math.abs(cy - curCy);
              if (vDiff <= 380) {
                const hGap = Math.max(0, r.left - curRect.right);
                const score = vDiff * 1.4 + hGap * 0.6;
                if (score < bestColRightScore) {
                  bestColRightScore = score;
                  bestColRight = item;
                }
              }
            }
          }
          if (bestColRight) {
            e.preventDefault();
            focusTvTarget(bestColRight.el, bestColRight.rect);
            return;
          }
          // Wrap to the first item of the immediately following row (within 85px below)
          let wrapCandidates: Array<{ el: HTMLElement; rect: DOMRect }> = [];
          let minWrapCy = Infinity;
          for (let i = 0; i < focusablesWithRect.length; i++) {
            const item = focusablesWithRect[i];
            if (item.el === current || !mainEl.contains(item.el)) continue;
            const r = item.rect;
            const cy = r.top + r.height / 2;
            if (isSameHorizontalRow(curRect, r)) continue;
            if (cy > curCy + 14 && r.top <= curRect.bottom + 85) {
              wrapCandidates.push(item);
              if (cy < minWrapCy) minWrapCy = cy;
            }
          }
          if (wrapCandidates.length > 0) {
            const nextRowItems = wrapCandidates.filter(
              (item) => item.rect.top + item.rect.height / 2 <= minWrapCy + 36
            );
            nextRowItems.sort((a, b) => a.rect.left - b.rect.left);
            if (nextRowItems[0]) {
              e.preventDefault();
              focusTvTarget(nextRowItems[0].el, nextRowItems[0].rect);
              return;
            }
          }
          e.preventDefault();
          return;
        }

        // 3. ArrowUp & ArrowDown (and Drawer/Modal ArrowLeft/ArrowRight):
        //    Two-Pass Row-First Selection for Up/Down so no row (Category Pills, Klubnichka 18+, Hero Buttons, Search Controls) is ever skipped!
        let bestCandidate: { el: HTMLElement; rect: DOMRect } | null = null;
        let bestScore = Infinity;

        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          const minVertSep = Math.max(16, Math.min(curRect.height, 44) * 0.5);
          const vertCandidates: Array<{
            item: { el: HTMLElement; rect: DOMRect };
            vertDist: number;
            horizEdgeGap: number;
            centerDiff: number;
          }> = [];

          for (let i = 0; i < focusablesWithRect.length; i++) {
            const item = focusablesWithRect[i];
            if (item.el === current) continue;
            if (isCurrentInMain && !mainEl!.contains(item.el)) continue;

            const r = item.rect;
            if (isSameHorizontalRow(curRect, r)) continue;

            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const dy = cy - curCy;

            if (e.key === 'ArrowDown' && dy <= minVertSep) continue;
            if (e.key === 'ArrowUp' && dy >= -minVertSep) continue;

            const vertDist = Math.abs(dy);
            const horizEdgeGap = Math.max(
              0,
              r.left - curRect.right,
              curRect.left - r.right
            );
            const centerDiff = Math.abs(cx - curCx);
            vertCandidates.push({ item, vertDist, horizEdgeGap, centerDiff });
          }

          if (vertCandidates.length > 0) {
            // Find the closest vertical row overall
            let minOverallVert = Infinity;
            for (const c of vertCandidates) {
              if (c.vertDist < minOverallVert) minOverallVert = c.vertDist;
            }

            // Pass 1: Look for horizontally aligned candidates (same column / overlapping X) on the adjacent row without leaping over intermediate rows
            const aligned = vertCandidates.filter(
              (c) =>
                c.horizEdgeGap <= 130 &&
                c.vertDist <= minOverallVert + 44
            );

            if (aligned.length > 0) {
              let minAlignedVert = Infinity;
              for (const c of aligned) {
                if (c.vertDist < minAlignedVert) minAlignedVert = c.vertDist;
              }
              const alignedRow = aligned.filter(
                (c) => c.vertDist <= minAlignedVert + 24
              );
              for (const c of alignedRow) {
                const score =
                  c.horizEdgeGap * 2.0 + c.centerDiff * 0.4 + c.vertDist * 0.5;
                if (score < bestScore) {
                  bestScore = score;
                  bestCandidate = c.item;
                }
              }
            }

            // Pass 2: Fallback to the immediately adjacent row (even if horizontally offset, e.g. Category Pills on left when coming up from right card)
            if (!bestCandidate) {
              const closestRow = vertCandidates.filter(
                (c) => c.vertDist <= minOverallVert + 24
              );
              for (const c of closestRow) {
                const score =
                  c.horizEdgeGap * 1.2 + c.centerDiff * 0.35 + c.vertDist * 0.5;
                if (score < bestScore) {
                  bestScore = score;
                  bestCandidate = c.item;
                }
              }
            }
          } else if (e.key === 'ArrowUp' && isCurrentInMain && headerEl) {
            const headerBtns = focusablesWithRect.filter(
              (item) => item.el.tagName === 'BUTTON' && headerEl.contains(item.el)
            );
            if (headerBtns.length > 0) {
              let closestHeader = headerBtns[0];
              let minHeaderDist = Infinity;
              for (const hb of headerBtns) {
                const hCx = hb.rect.left + hb.rect.width / 2;
                const d = Math.abs(hCx - curCx);
                if (d < minHeaderDist) {
                  minHeaderDist = d;
                  closestHeader = hb;
                }
              }
              bestCandidate = closestHeader;
            }
          }
        } else {
          // Drawer / Modal Left & Right
          for (let i = 0; i < focusablesWithRect.length; i++) {
            const item = focusablesWithRect[i];
            if (item.el === current) continue;
            const r = item.rect;
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const dx = cx - curCx;
            const dy = cy - curCy;
            if (e.key === 'ArrowRight' && dx <= 6) continue;
            if (e.key === 'ArrowLeft' && dx >= -6) continue;
            const score = Math.abs(dx) + Math.abs(dy) * 3.2;
            if (score < bestScore) {
              bestScore = score;
              bestCandidate = item;
            }
          }
        }

        if (bestCandidate) {
          e.preventDefault();
          focusTvTarget(bestCandidate.el, bestCandidate.rect);
        } else if (e.key === 'ArrowUp' && isCurrentInMain && mainEl) {
          e.preventDefault();
          if (mainEl.scrollTop > 4) {
            mainEl.scrollTop = 0;
          } else {
            const headerBtn =
              root.querySelector<HTMLElement>(
                'header [data-header-lang-btn="true"]'
              ) ||
              root.querySelector<HTMLElement>(
                'header [data-header-search-btn="true"]'
              ) ||
              root.querySelector<HTMLElement>('header button');
            headerBtn?.focus({ preventScroll: true });
          }
        } else if (
          e.key === 'ArrowLeft' &&
          (isSettingsDrawerOpen || isFilterDrawerOpen || isCatalogDrawerOpen)
        ) {
          e.preventDefault();
          if (isSettingsDrawerOpen && settingsSubMenu) {
            setSettingsSubMenu(null);
            return;
          }
          if (isFilterDrawerOpen && filterSubMenu) {
            setFilterSubMenu(null);
            return;
          }
          setIsSettingsDrawerOpen(false);
          setIsFilterDrawerOpen(false);
          setIsCatalogDrawerOpen(false);
          window.setTimeout(() => {
            const firstNav =
              rootContainerRef.current?.querySelector<HTMLElement>(
                'aside [data-sidebar-active="true"]'
              ) ||
              rootContainerRef.current?.querySelector<HTMLElement>(
                'aside button'
              );
            firstNav?.focus();
          }, 40);
        } else if (
          e.key === 'ArrowLeft' &&
          activeVodItem &&
          !isPlayingVod &&
          !isSidebarOpen &&
          !isSettingsDrawerOpen
        ) {
          e.preventDefault();
          setIsSidebarOpen(true);
          window.setTimeout(() => {
            const firstNav =
              rootContainerRef.current?.querySelector<HTMLElement>(
                'aside [data-sidebar-active="true"]'
              ) ||
              rootContainerRef.current?.querySelector<HTMLElement>(
                'aside button'
              );
            firstNav?.focus();
          }, 50);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    currentTvChannel,
    isTvRadioPlayerOpen,
    section,
    activeVodItem,
    openVodCompactPanel,
    selectedActor,
    isSidebarOpen,
    isPlayingVod,
    isVodOsdVisible,
    hideVodOsd,
    pendingResumePromptSec,
    isInfoSheetOpen,
    isEpisodesDrawerOpen,
    isKlubSuggestionsOpen,
    klubSuggestions,
    wakeVodOsd,
    isSubFinderOpen,
    isSettingsDrawerOpen,
    settingsSubMenu,
    isFilterDrawerOpen,
    filterSubMenu,
    isCatalogDrawerOpen,
    isTrailerModalOpen,
    isHandoffModalOpen,
    isPinLockRequired,
    isProfilePickerOpen,
    editingProfileId,
    tvSearchQuery,
    radioSearchQuery,
  ]);

  // Auto-focus the first interactive option inside Setări Smart TV, Filtru, or Catalog drawer when opened or changing sub-menu
  useEffect(() => {
    if (!isSettingsDrawerOpen && !isFilterDrawerOpen && !isCatalogDrawerOpen) {
      return;
    }
    const timer = window.setTimeout(() => {
      const selector = isSettingsDrawerOpen
        ? '[data-settings-drawer="true"]'
        : isFilterDrawerOpen
          ? '[data-filter-drawer="true"]'
          : '[data-catalog-drawer="true"]';
      const drawerEl =
        rootContainerRef.current?.querySelector<HTMLElement>(selector);
      if (!drawerEl) return;
      const targetBtn =
        drawerEl.querySelector<HTMLElement>(
          '[data-drawer-initial-focus="true"]'
        ) ||
        drawerEl.querySelector<HTMLElement>(
          'button:not([data-drawer-close="true"]):not([disabled])'
        ) ||
        drawerEl.querySelector<HTMLElement>('button:not([disabled])');
      targetBtn?.focus();
      targetBtn?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 35);
    return () => window.clearTimeout(timer);
  }, [
    isSettingsDrawerOpen,
    settingsSubMenu,
    isFilterDrawerOpen,
    filterSubMenu,
    isCatalogDrawerOpen,
  ]);

  // Immediately focus the active category in the Left Sidebar on initial load (and when returning from a Movie Card or closing a drawer)
  // so LG webOS / Media Station X users start directly on the Categories without pressing Right Arrow 2-3 times!
  useEffect(() => {
    if (
      isPlayingVod ||
      activeVodItem ||
      !isSidebarOpen ||
      isSettingsDrawerOpen ||
      isFilterDrawerOpen ||
      isCatalogDrawerOpen
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      const activeEl = document.activeElement as HTMLElement | null;
      const inRoot =
        activeEl &&
        activeEl !== document.body &&
        rootContainerRef.current?.contains(activeEl);
      if (!inRoot) {
        const activeSidebarBtn =
          rootContainerRef.current?.querySelector<HTMLElement>(
            'aside [data-sidebar-active="true"]'
          ) ||
          rootContainerRef.current?.querySelector<HTMLElement>('aside button');
        activeSidebarBtn?.focus();
      }
    }, 60);
    return () => window.clearTimeout(timer);
  }, [
    isPlayingVod,
    activeVodItem,
    isSidebarOpen,
    isSettingsDrawerOpen,
    isFilterDrawerOpen,
    isCatalogDrawerOpen,
  ]);

  // Fetch Kinopoisk or Cinemeta catalog for Movies / Series / Cartoons / Home / Filter / Catalog
  const fetchVodCatalog = useCallback(
    async (pageNum: number, append: boolean) => {
      const isCatalogOrFilter = section === 'catalog' || section === 'filter';
      const mediaType: 'movie' | 'series' =
        section === 'series'
          ? 'series'
          : section === 'filter'
            ? filterMediaType
            : 'movie';
      const effectiveCountry = isCatalogOrFilter ? originCountry : 'ALL';
      const effectiveGenre =
        section === 'cartoons'
          ? 'Animation'
          : isCatalogOrFilter
            ? selectedGenre
            : 'top';

      if (effectiveCountry === 'FAV') {
        const favFiltered = sortVodItemsByProductionYear(
          savedVodItemsRef.current.filter((x) => x.type === mediaType)
        );
        setVodItems(favFiltered);
        setHasMoreVod(false);
        setIsVodLoading(false);
        setIsLoadingMoreVod(false);
        return;
      }

      const countryObj = TV_ORIGIN_COUNTRIES.find(
        (c) => c.id === effectiveCountry
      );
      const genreObj = TV_GENRE_PILLS.find((g) => g.id === effectiveGenre);
      const ratingObj = LAMPA_FILTER_RATINGS.find((r) => r.id === filterRating);
      const yearObj = LAMPA_FILTER_YEARS.find((y) => y.id === filterYear);

      const useKinopoisk =
        effectiveCountry !== 'ALL' ||
        effectiveGenre === 'Adult' ||
        (section === 'filter' &&
          (filterRating !== 'any' || filterYear !== 'any'));

      if (append) {
        setIsLoadingMoreVod(true);
      } else {
        setIsVodLoading(true);
      }

      try {
        if (isStreamingPlatformSection(section)) {
          const platDef =
            STREAMING_PLATFORMS.find((p) => p.id === section) ||
            STREAMING_PLATFORMS[0];
          const baseAddonUrl =
            'https://7a82163c306e-stremio-netflix-catalog-addon.baby-beamup.club/catalog';

          const fetchPromises: Array<Promise<{ metas?: CinemetaItem[] }>> = [];
          if (platformMediaTab === 'series' || platformMediaTab === 'all') {
            fetchPromises.push(
              fetch(`${baseAddonUrl}/series/${platDef.addonCode}.json`)
                .then((r) => (r.ok ? r.json() : { metas: [] }))
                .catch(() => ({ metas: [] }))
            );
          } else {
            fetchPromises.push(Promise.resolve({ metas: [] }));
          }

          if (platformMediaTab === 'movie' || platformMediaTab === 'all') {
            fetchPromises.push(
              fetch(`${baseAddonUrl}/movie/${platDef.addonCode}.json`)
                .then((r) => (r.ok ? r.json() : { metas: [] }))
                .catch(() => ({ metas: [] }))
            );
          } else {
            fetchPromises.push(Promise.resolve({ metas: [] }));
          }

          const [seriesData, movieData] = await Promise.all(fetchPromises);
          const liveSeries: CinemetaItem[] = Array.isArray(seriesData?.metas)
            ? seriesData.metas.map((s) => ({
              ...s,
              type: 'series' as const,
            }))
            : [];
          const liveMovies: CinemetaItem[] = Array.isArray(movieData?.metas)
            ? movieData.metas.map((m) => ({
              ...m,
              type: 'movie' as const,
            }))
            : [];

          const flagshipsWithPosters: CinemetaItem[] =
            platformMediaTab === 'movie'
              ? []
              : platDef.flagshipSeries.map((f) => ({
                ...f,
                poster:
                  f.poster ||
                  `https://images.metahub.space/poster/medium/${f.id}/img`,
                background:
                  f.background ||
                  `https://images.metahub.space/background/medium/${f.id}/img`,
              }));

          const merged: CinemetaItem[] = [];
          const seenIds = new Set<string>();
          for (const item of [
            ...flagshipsWithPosters,
            ...liveSeries,
            ...liveMovies,
          ]) {
            if (!item?.id || seenIds.has(item.id)) continue;
            seenIds.add(item.id);
            merged.push(item);
          }

          const sortedMerged = sortVodItemsByProductionYear(merged);
          registerPlatformCatalogItems(
            section,
            sortedMerged.map((x) => x.id)
          );
          setVodItems(sortedMerged);
          setHasMoreVod(false);
          if (sortedMerged[0] && !lastFocusedVodItemRef.current) {
            handleFocusVodItem(sortedMerged[0]);
          }
          return;
        }

        if (section === 'imdb') {
          const skip = (pageNum - 1) * 50;
          const targetType = imdbMediaType || 'all';
          const effGenre = imdbGenre && imdbGenre !== 'top' ? imdbGenre : '';
          const genreQuery = effGenre ? `&genre=${encodeURIComponent(effGenre)}` : '';
          const movieUrl =
            skip > 0
              ? `https://v3-cinemeta.strem.io/catalog/movie/imdbRating/skip=${skip}.json?${genreQuery}`
              : `https://v3-cinemeta.strem.io/catalog/movie/imdbRating${effGenre ? `/genre=${encodeURIComponent(effGenre)}` : ''}.json`;
          const seriesUrl =
            skip > 0
              ? `https://v3-cinemeta.strem.io/catalog/series/imdbRating/skip=${skip}.json?${genreQuery}`
              : `https://v3-cinemeta.strem.io/catalog/series/imdbRating${effGenre ? `/genre=${encodeURIComponent(effGenre)}` : ''}.json`;

          const fetchPromises: Array<Promise<{ metas?: CinemetaItem[] }>> = [];
          if (targetType === 'movie' || targetType === 'all') {
            fetchPromises.push(
              fetch(movieUrl)
                .then((r) => (r.ok ? r.json() : { metas: [] }))
                .catch(() => ({ metas: [] }))
            );
          } else {
            fetchPromises.push(Promise.resolve({ metas: [] }));
          }
          if (targetType === 'series' || targetType === 'all') {
            fetchPromises.push(
              fetch(seriesUrl)
                .then((r) => (r.ok ? r.json() : { metas: [] }))
                .catch(() => ({ metas: [] }))
            );
          } else {
            fetchPromises.push(Promise.resolve({ metas: [] }));
          }

          const [mData, sData] = await Promise.all(fetchPromises);
          const mList: CinemetaItem[] = (mData?.metas || []).map((m: any) => ({ ...m, type: 'movie' }));
          const sList: CinemetaItem[] = (sData?.metas || []).map((s: any) => ({ ...s, type: 'series' }));

          let combined = [...mList, ...sList];
          if (imdbYear && imdbYear !== 'any') {
            combined = combined.filter((it) => {
              const y = parseInt(it.releaseInfo || it.year || '0', 10);
              if (imdbYear === '<1990') return y > 0 && y < 1990;
              if (imdbYear === '1990-1999') return y >= 1990 && y <= 1999;
              if (imdbYear === '2000-2009') return y >= 2000 && y <= 2009;
              if (imdbYear === '2010-2019') return y >= 2010 && y <= 2019;
              if (imdbYear === '2020-2027') return y >= 2020 && y <= 2027;
              return String(y) === imdbYear;
            });
          }

          combined.sort((a, b) => {
            const rA = parseFloat(a.imdbRating || '0') || 0;
            const rB = parseFloat(b.imdbRating || '0') || 0;
            return rB - rA;
          });

          const deduped = deduplicateVodItems(combined);
          setVodItems((prev) => (append ? deduplicateVodItems([...prev, ...deduped]) : deduped));
          setHasMoreVod(deduped.length >= 20);
          if (!append && deduped[0] && !lastFocusedVodItemRef.current) {
            handleFocusVodItemRef.current(deduped[0]);
          }
          return;
        }

        if (section === 'home') {
          const skip = (pageNum - 1) * 50;
          const movieTopUrl =
            skip > 0
              ? `https://v3-cinemeta.strem.io/catalog/movie/top/skip=${skip}.json`
              : `https://v3-cinemeta.strem.io/catalog/movie/top.json`;
          const seriesTopUrl =
            skip > 0
              ? `https://v3-cinemeta.strem.io/catalog/series/top/skip=${skip}.json`
              : `https://v3-cinemeta.strem.io/catalog/series/top.json`;

          if (append) {
            const [mData, sData] = await Promise.all([
              fetch(movieTopUrl)
                .then((r) => (r.ok ? r.json() : { metas: [] }))
                .catch(() => ({ metas: [] })),
              fetch(seriesTopUrl)
                .then((r) => (r.ok ? r.json() : { metas: [] }))
                .catch(() => ({ metas: [] })),
            ]);
            const mList: CinemetaItem[] = Array.isArray(mData?.metas)
              ? mData.metas.map((m: CinemetaItem) => ({
                ...m,
                type: 'movie',
              }))
              : [];
            const sList: CinemetaItem[] = Array.isArray(sData?.metas)
              ? sData.metas.map((s: CinemetaItem) => ({
                ...s,
                type: 'series',
              }))
              : [];
            const interleaved: CinemetaItem[] = [];
            const maxLen = Math.max(mList.length, sList.length);
            for (let i = 0; i < maxLen; i++) {
              if (sList[i]) interleaved.push(sList[i]);
              if (mList[i]) interleaved.push(mList[i]);
            }
            const sortedInterleaved = sortVodItemsByProductionYear(interleaved);
            setVodItems((prev) => {
              const seen = new Set(prev.map((x) => x.id));
              return sortVodItemsByProductionYear([
                ...prev,
                ...sortedInterleaved.filter((x) => !seen.has(x.id)),
              ]);
            });
            setHasMoreVod(interleaved.length >= 20);
            return;
          }

          const [
            mTopData,
            sTopData,
            kpNewData,
            cartoonsData,
            mImdbData,
            sImdbData,
          ] = await Promise.all([
            fetch(movieTopUrl)
              .then((r) => (r.ok ? r.json() : { metas: [] }))
              .catch(() => ({ metas: [] })),
            fetch(seriesTopUrl)
              .then((r) => (r.ok ? r.json() : { metas: [] }))
              .catch(() => ({ metas: [] })),
            fetch(
              `https://kinopoiskapiunofficial.tech/api/v2.2/films?type=ALL&order=NUM_VOTE&yearFrom=2025&yearTo=2026&page=1`,
              {
                headers: {
                  'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
                },
              }
            )
              .then((r) => (r.ok ? r.json() : { items: [] }))
              .catch(() => ({ items: [] })),
            fetch(
              `https://v3-cinemeta.strem.io/catalog/movie/top/genre=Animation.json`
            )
              .then((r) => (r.ok ? r.json() : { metas: [] }))
              .catch(() => ({ metas: [] })),
            fetch(
              `https://v3-cinemeta.strem.io/catalog/movie/imdbRating.json`
            )
              .then((r) => (r.ok ? r.json() : { metas: [] }))
              .catch(() => ({ metas: [] })),
            fetch(
              `https://v3-cinemeta.strem.io/catalog/series/imdbRating.json`
            )
              .then((r) => (r.ok ? r.json() : { metas: [] }))
              .catch(() => ({ metas: [] })),
          ]);

          const movieTop: CinemetaItem[] = Array.isArray(mTopData?.metas)
            ? mTopData.metas.map((m: CinemetaItem) => ({
              ...m,
              type: 'movie',
            }))
            : [];
          const seriesTop: CinemetaItem[] = Array.isArray(sTopData?.metas)
            ? sTopData.metas.map((s: CinemetaItem) => ({
              ...s,
              type: 'series',
            }))
            : [];
          const cartoonsList: CinemetaItem[] = Array.isArray(
            cartoonsData?.metas
          )
            ? cartoonsData.metas.map((c: CinemetaItem) => ({
              ...c,
              type: 'movie',
            }))
            : [];
          const movieImdb: CinemetaItem[] = Array.isArray(mImdbData?.metas)
            ? mImdbData.metas.map((m: CinemetaItem) => ({
              ...m,
              type: 'movie',
            }))
            : [];
          const seriesImdb: CinemetaItem[] = Array.isArray(sImdbData?.metas)
            ? sImdbData.metas.map((s: CinemetaItem) => ({
              ...s,
              type: 'series',
            }))
            : [];

          const kpNewMapped: CinemetaItem[] = Array.isArray(kpNewData?.items)
            ? kpNewData.items
              .filter((f: any) => {
                const countryStr = Array.isArray(f.countries)
                  ? f.countries.map((c: any) => c.country).filter(Boolean).join(', ')
                  : '';
                return isRussianVodItem({
                  country: countryStr,
                  name: f.nameRu || f.nameOriginal,
                  nameOriginal: f.nameOriginal,
                  kpId: String(f.kinopoiskId),
                });
              })
              .map(
              (f: {
                kinopoiskId: number;
                imdbId?: string | null;
                type?: string;
                nameRu?: string | null;
                nameEn?: string | null;
                nameOriginal?: string | null;
                year?: number | string | null;
                ratingKinopoisk?: number | null;
                ratingImdb?: number | null;
                posterUrlPreview?: string;
                posterUrl?: string;
                genres?: Array<{ genre: string }>;
                countries?: Array<{ country: string }>;
              }) => {
                const isSeries =
                  f.type === 'TV_SERIES' ||
                  f.type === 'MINI_SERIES' ||
                  f.type === 'TV_SHOW';
                const validImdb =
                  f.imdbId && /^tt\d+$/.test(f.imdbId) ? f.imdbId : '';
                const ratingVal = f.ratingImdb || f.ratingKinopoisk;
                const countryStr = Array.isArray(f.countries)
                  ? f.countries.map((c) => c.country).filter(Boolean).join(', ')
                  : undefined;
                return {
                  id: validImdb || `kp_${f.kinopoiskId}`,
                  kpId: String(f.kinopoiskId),
                  type: isSeries ? 'series' : 'movie',
                  name:
                    f.nameOriginal ||
                    f.nameEn ||
                    f.nameRu ||
                    `Film #${f.kinopoiskId}`,
                  nameOriginal: f.nameOriginal || f.nameEn || undefined,
                  releaseInfo:
                    f.year && String(f.year) !== 'null'
                      ? String(f.year)
                      : '2026',
                  imdbRating: ratingVal ? String(ratingVal) : undefined,
                  ratingKinopoisk: f.ratingKinopoisk ? String(f.ratingKinopoisk) : undefined,
                  country: countryStr,
                  poster:
                    uiLang !== 'ru' && validImdb
                      ? `https://images.metahub.space/poster/medium/${validImdb}/img`
                      : f.posterUrlPreview || f.posterUrl,
                  background:
                    uiLang !== 'ru' && validImdb
                      ? `https://images.metahub.space/background/medium/${validImdb}/img`
                      : f.posterUrl || f.posterUrlPreview,
                  genres:
                    uiLang === 'ru'
                      ? f.genres?.map((g) => g.genre).filter(Boolean)
                      : undefined,
                };
              }
            )
            : [];

          // 1. Сейчас смотрят (Mixed Top Movies + Top Series: 12 items)
          const watchingNowMix: CinemetaItem[] = [];
          const usedIds = new Set<string>();
          for (let i = 0; i < 16 && watchingNowMix.length < 12; i++) {
            const m = movieTop[i];
            if (m && !usedIds.has(m.id)) {
              usedIds.add(m.id);
              watchingNowMix.push(m);
            }
            const s = seriesTop[i];
            if (s && !usedIds.has(s.id) && watchingNowMix.length < 12) {
              usedIds.add(s.id);
              watchingNowMix.push(s);
            }
          }

          // 2. Новинки / Adăugate Noi 2025-2026 (Mixed New Series + New Movies: 12 items)
          const newPool: CinemetaItem[] = [];
          const cmRecentMovies = movieTop.filter((m) =>
            /^(2026|2025)/.test(String(m.releaseInfo || ''))
          );
          const cmRecentSeries = seriesTop.filter((s) =>
            /^(2026|2025)|–\s*$/.test(String(s.releaseInfo || ''))
          );
          const maxNewLen = Math.max(
            kpNewMapped.length,
            cmRecentSeries.length,
            cmRecentMovies.length
          );
          for (let i = 0; i < maxNewLen; i++) {
            if (cmRecentSeries[i]) newPool.push(cmRecentSeries[i]);
            if (cmRecentMovies[i]) newPool.push(cmRecentMovies[i]);
            if (kpNewMapped[i]) newPool.push(kpNewMapped[i]);
          }
          const newlyAddedMix: CinemetaItem[] = [];
          for (const item of newPool) {
            if (!usedIds.has(item.id)) {
              usedIds.add(item.id);
              newlyAddedMix.push(item);
              if (newlyAddedMix.length >= 12) break;
            }
          }

          // 3. Популярные сериалы / Seriale Populare (12 items)
          const popularSeries: CinemetaItem[] = [];
          for (const s of seriesTop) {
            if (!usedIds.has(s.id)) {
              usedIds.add(s.id);
              popularSeries.push(s);
              if (popularSeries.length >= 12) break;
            }
          }

          // 4. Популярные фильмы / Filme Populare (12 items)
          const popularMovies: CinemetaItem[] = [];
          for (const m of movieTop) {
            if (!usedIds.has(m.id)) {
              usedIds.add(m.id);
              popularMovies.push(m);
              if (popularMovies.length >= 12) break;
            }
          }

          // 5. Мультфильмы / Desene & Animație (12 items)
          const cartoons: CinemetaItem[] = [];
          for (const c of cartoonsList) {
            if (!usedIds.has(c.id)) {
              usedIds.add(c.id);
              cartoons.push(c);
              if (cartoons.length >= 12) break;
            }
          }

          // 6. Рекомендуем посмотреть — Топ IMDb (Mixed Top IMDb Series + Movies)
          const recommendedMix: CinemetaItem[] = [];
          const maxRec = Math.max(
            seriesImdb.length,
            movieImdb.length,
            seriesTop.length,
            movieTop.length
          );
          for (let i = 0; i < maxRec && recommendedMix.length < 20; i++) {
            for (const candidate of [
              seriesImdb[i],
              movieImdb[i],
              seriesTop[i + 10],
              movieTop[i + 10],
            ]) {
              if (
                candidate &&
                !usedIds.has(candidate.id) &&
                recommendedMix.length < 20
              ) {
                usedIds.add(candidate.id);
                recommendedMix.push(candidate);
              }
            }
          }

          const sortedWatchingNow = sortVodItemsByProductionYear(watchingNowMix);
          const sortedNewlyAdded = sortVodItemsByProductionYear(newlyAddedMix);
          const sortedPopularSeries = sortVodItemsByProductionYear(popularSeries);
          const sortedPopularMovies = sortVodItemsByProductionYear(popularMovies);
          const sortedCartoons = sortVodItemsByProductionYear(cartoons);
          const sortedRecommended = sortVodItemsByProductionYear(recommendedMix);

          setHomeShelves({
            watchingNowMix: sortedWatchingNow,
            newlyAddedMix: sortedNewlyAdded,
            popularSeries: sortedPopularSeries,
            popularMovies: sortedPopularMovies,
            cartoons: sortedCartoons,
          });
          setVodItems(sortedRecommended);
          setHasMoreVod(true);
          if (sortedWatchingNow[0] && !lastFocusedVodItemRef.current) {
            handleFocusVodItemRef.current(sortedWatchingNow[0]);
          }
        } else if (useKinopoisk) {
          const kpType = mediaType === 'series' ? 'TV_SERIES' : 'FILM';
          const order =
            effectiveGenre === 'imdbRating' || filterRating !== 'any'
              ? 'RATING'
              : 'NUM_VOTE';
          const qs = new URLSearchParams();
          qs.set('type', kpType);
          qs.set('order', order);
          qs.set('page', String(pageNum));
          if (countryObj?.kpCountryId) {
            qs.set('countries', String(countryObj.kpCountryId));
          }
          if (genreObj?.kpGenreId) {
            qs.set('genres', String(genreObj.kpGenreId));
          }
          if (section === 'filter' && ratingObj?.minRating) {
            qs.set('ratingFrom', String(ratingObj.minRating));
          }
          if (section === 'filter' && yearObj?.yearFrom) {
            qs.set('yearFrom', String(yearObj.yearFrom));
            qs.set('yearTo', String(yearObj.yearTo || yearObj.yearFrom));
          }

          const res = await fetch(
            `https://kinopoiskapiunofficial.tech/api/v2.2/films?${qs.toString()}`,
            {
              headers: {
                'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
              },
            }
          );
          if (!res.ok) throw new Error('KP error');
          const data = (await res.json()) as {
            totalPages?: number;
            items?: Array<{
              kinopoiskId: number;
              imdbId?: string | null;
              nameRu?: string | null;
              nameEn?: string | null;
              nameOriginal?: string | null;
              year?: number | string | null;
              ratingKinopoisk?: number | null;
              ratingImdb?: number | null;
              posterUrlPreview?: string;
              posterUrl?: string;
              genres?: Array<{ genre: string }>;
              countries?: Array<{ country: string }>;
            }>;
          };

          const preferRu = originCountry === 'RU' && uiLang === 'ru';
          const mapped: CinemetaItem[] = (data.items || []).map((f) => {
            const title = preferRu
              ? f.nameRu || f.nameOriginal || f.nameEn || `Film #${f.kinopoiskId}`
              : f.nameOriginal || f.nameEn || f.nameRu || `Film #${f.kinopoiskId}`;
            const validImdb =
              f.imdbId && /^tt\d+$/.test(f.imdbId) ? f.imdbId : '';
            const ratingVal = f.ratingImdb || f.ratingKinopoisk;
            const countryStr = Array.isArray(f.countries)
              ? f.countries.map((c) => c.country).filter(Boolean).join(', ')
              : originCountry === 'RU'
                ? 'Россия'
                : undefined;
            return {
              id: validImdb || `kp_${f.kinopoiskId}`,
              kpId: String(f.kinopoiskId),
              type: mediaType,
              name: title,
              nameOriginal: f.nameOriginal || f.nameEn || undefined,
              releaseInfo:
                f.year && String(f.year) !== 'null' ? String(f.year) : undefined,
              imdbRating: ratingVal ? String(ratingVal) : undefined,
              ratingKinopoisk: f.ratingKinopoisk ? String(f.ratingKinopoisk) : undefined,
              country: countryStr,
              poster:
                !preferRu && validImdb
                  ? `https://images.metahub.space/poster/medium/${validImdb}/img`
                  : f.posterUrlPreview || f.posterUrl,
              background:
                !preferRu && validImdb
                  ? `https://images.metahub.space/background/medium/${validImdb}/img`
                  : f.posterUrl || f.posterUrlPreview,
              genres:
                uiLang === 'ru'
                  ? f.genres?.map((g) => g.genre).filter(Boolean)
                  : undefined,
            };
          });

          const sortedMapped = deduplicateVodItems(mapped);

          setVodItems((prev) => {
            if (!append) return sortedMapped;
            return deduplicateVodItems([...prev, ...sortedMapped]);
          });
          setHasMoreVod(pageNum < (data.totalPages || 1));
          if (!append && sortedMapped[0] && !lastFocusedVodItemRef.current) {
            handleFocusVodItemRef.current(sortedMapped[0]);
          }
        } else {
          const skip = (pageNum - 1) * 50;
          let url = '';
          if (effectiveGenre === 'top') {
            url =
              skip > 0
                ? `https://v3-cinemeta.strem.io/catalog/${mediaType}/top/skip=${skip}.json`
                : `https://v3-cinemeta.strem.io/catalog/${mediaType}/top.json`;
          } else if (effectiveGenre === 'imdbRating') {
            url =
              skip > 0
                ? `https://v3-cinemeta.strem.io/catalog/${mediaType}/imdbRating/skip=${skip}.json`
                : `https://v3-cinemeta.strem.io/catalog/${mediaType}/imdbRating.json`;
          } else {
            url =
              skip > 0
                ? `https://v3-cinemeta.strem.io/catalog/${mediaType}/top/genre=${encodeURIComponent(effectiveGenre)}&skip=${skip}.json`
                : `https://v3-cinemeta.strem.io/catalog/${mediaType}/top/genre=${encodeURIComponent(effectiveGenre)}.json`;
          }

          const res = await fetch(url);
          const data = (await res.json()) as { metas?: CinemetaItem[] };
          const list = deduplicateVodItems(
            (data.metas || []).map((m) => ({
              ...m,
              type: mediaType,
            }))
          );

          setVodItems((prev) => {
            if (!append) return list;
            return deduplicateVodItems([...prev, ...list]);
          });
          setHasMoreVod(list.length >= 30);
          if (!append && list[0] && !lastFocusedVodItemRef.current) {
            handleFocusVodItem(list[0]);
          }
        }
      } catch {
        if (!append) setVodItems([]);
      } finally {
        setIsVodLoading(false);
        setIsLoadingMoreVod(false);
      }
    },
    [
      section,
      originCountry,
      selectedGenre,
      filterMediaType,
      filterRating,
      filterYear,
      platformMediaTab,
      imdbMediaType,
      imdbYear,
      imdbGenre,
    ]
  );

  useEffect(() => {
    if (
      section === 'home' ||
      section === 'movies' ||
      section === 'imdb' ||
      section === 'cartoons' ||
      section === 'series' ||
      section === 'catalog' ||
      section === 'filter' ||
      isStreamingPlatformSection(section)
    ) {
      setVodPage(1);
      void fetchVodCatalog(1, false);
    }
  }, [
    section,
    originCountry,
    selectedGenre,
    filterMediaType,
    filterRating,
    filterYear,
    platformMediaTab,
    imdbMediaType,
    imdbYear,
    imdbGenre,
    fetchVodCatalog,
  ]);

  // Always default to Favorites ('FAV') whenever entering TV Online or Radio Live
  useEffect(() => {
    if (section === 'tv') {
      setTvRegionId('FAV');
      setTvCategoryId('ALL');
    } else if (section === 'radio') {
      setRadioCountry('FAV');
    }
  }, [section]);

  // Reset <main> scroll position to top (0) whenever switching sections or opening/closing a Movie/Series Detail Card
  useEffect(() => {
    const root = rootContainerRef.current;
    if (root) {
      root.scrollTop = 0;
      root.scrollLeft = 0;
    }
    if (!isPlayingVod && (window.scrollY !== 0 || window.scrollX !== 0)) {
      window.scrollTo(0, 0);
    }
    const mainEl = root?.querySelector<HTMLElement>('main');
    if (mainEl) {
      mainEl.scrollTop = 0;
      mainEl.scrollTo({ top: 0 });
    }
  }, [section, activeVodItem?.id, isPlayingVod]);

  // When entering TV Online (section === 'tv'), automatically focus the first TV channel card once loaded without scrolling the top Search/Filter bars out of view
  useEffect(() => {
    if (section !== 'tv' || isTvLoading || tvChannels.length === 0) return;
    const timer = window.setTimeout(() => {
      const mainEl = rootContainerRef.current?.querySelector<HTMLElement>('main');
      if (mainEl && mainEl.scrollTop > 12) return;
      const active = document.activeElement as HTMLElement | null;
      const isAlreadyInMain = Boolean(active && mainEl?.contains(active));
      if (!isAlreadyInMain) {
        const firstCard =
          rootContainerRef.current?.querySelector<HTMLElement>(
            '[data-osd-channel-row="true"][aria-selected="true"], [data-osd-channel-row="true"], [data-tv-channel-card="true"]'
          );
        firstCard?.focus({ preventScroll: true });
        if (mainEl && mainEl.scrollTop !== 0) {
          mainEl.scrollTop = 0;
        }
      }
    }, 45);
    return () => window.clearTimeout(timer);
  }, [section, isTvLoading, tvChannels.length]);

  // Subscribe to EPG updates so TV Online cards show live EPG programme titles
  useEpgRevision();

  // Fetch Live TV channels when in TV section (supports 'FAV', 'IEDEM' M3U playlist, 'ADULT' 18+, + 13 Countries)
  useEffect(() => {
    if (section !== 'tv') return;
    void fetchEpgForCountry('RO');
    void fetchEpgForCountry('RU');
    if (
      tvRegionId &&
      tvRegionId !== 'FAV' &&
      tvRegionId !== 'IEDEM' &&
      tvRegionId !== 'ADULT' &&
      tvRegionId !== 'RO' &&
      tvRegionId !== 'RU'
    ) {
      void fetchEpgForCountry(tvRegionId);
    }
    if (tvRegionId === 'FAV') {
      const favList = adultContentEnabled
        ? favoriteTvChannels
        : favoriteTvChannels.filter((c) => !isAdultTvChannel(c));
      setTvChannels(favList);
      setIsTvLoading(false);
      return;
    }

    let cancelled = false;
    setIsTvLoading(true);

    if (tvRegionId === 'ADULT' || tvCategoryId === 'ADULT') {
      if (!adultContentEnabled) {
        setTvChannels([]);
        setIsTvLoading(false);
        return;
      }
      const customAdult = customTvChannels.filter((c) => isAdultTvChannel(c));
      fetchAdultTvChannels()
        .then((fetchedAdult) => {
          if (cancelled) return;
          const seen = new Set(customAdult.map((c) => c.url));
          const merged = [
            ...customAdult,
            ...fetchedAdult.filter((c) => !seen.has(c.url)),
          ];
          setTvChannels(merged);
        })
        .catch(() => {
          if (!cancelled) setTvChannels(customAdult);
        })
        .finally(() => {
          if (!cancelled) setIsTvLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    if (tvRegionId === 'IEDEM') {
      const customList = adultContentEnabled
        ? customTvChannels
        : customTvChannels.filter((c) => !isAdultTvChannel(c));
      Promise.all([
        fetchTvChannelsByCountry('RU').catch(() => []),
        adultContentEnabled ? fetchAdultTvChannels().catch(() => []) : Promise.resolve([]),
      ])
        .then(([ruList, adultList]) => {
          if (cancelled) return;
          const filteredRu = adultContentEnabled
            ? ruList
            : ruList.filter((c) => !isAdultTvChannel(c));
          const seen = new Set<string>();
          const merged: TvChannel[] = [];
          for (const ch of [...customList, ...filteredRu, ...adultList]) {
            if (!ch.url || seen.has(ch.url)) continue;
            seen.add(ch.url);
            merged.push(ch);
          }
          setTvChannels(merged.slice(0, 1200));
        })
        .finally(() => {
          if (!cancelled) setIsTvLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    const region =
      TV_LIVE_REGIONS.find(
        (r) => r.id === tvRegionId && r.id !== 'IEDEM' && r.id !== 'ADULT'
      ) || TV_LIVE_REGIONS.find((r) => r.id === 'RO')!;

    fetchTvChannelsByCountry(region.country)
      .then((channels) => {
        if (cancelled) return;
        const base = channels.slice(0, 1200);
        const filtered = adultContentEnabled
          ? base
          : base.filter((c) => !isAdultTvChannel(c));
        setTvChannels(filtered);
      })
      .catch(() => {
        if (!cancelled) setTvChannels([]);
      })
      .finally(() => {
        if (!cancelled) setIsTvLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    section,
    tvRegionId,
    tvCategoryId,
    favoriteTvChannels,
    customTvChannels,
    adultContentEnabled,
  ]);

  // Fetch Radio stations when in Radio section (supports 'FAV' Favorite Radio + 14 Countries)
  useEffect(() => {
    if (section !== 'radio') return;
    if (radioCountry === 'FAV') {
      setRadioStations(favorites);
      setIsRadioLoading(false);
      return;
    }

    let cancelled = false;
    setIsRadioLoading(true);

    fetchStationsByCountry(radioCountry)
      .then((stations) => {
        if (cancelled) return;
        const top = stations.slice(0, 400);
        setRadioStations(top);
      })
      .catch(() => {
        if (!cancelled) setRadioStations([]);
      })
      .finally(() => {
        if (!cancelled) setIsRadioLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [section, radioCountry, favorites]);

  // Search execution (both Kinopoisk & Cinemeta, with strict cross-source deduplication)
  useEffect(() => {
    if (section !== 'search') return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsSearchLoading(true);
      try {
        const isRussianSearchQuery =
          /[а-яёА-ЯЁ]/.test(q) ||
          /\b(kstati|zvezdy|zvezdi|tnt|piatnica|piatnitsa|pyatnitsa|pyatnica|kvn|stendap|standup|holop|major|mazhor|brigada|slovo\s*pacana|kuhnya|interny|univer|metod|trigger|fiser|fisher|nevskiy|sklif|bitva)\b/i.test(
            q
          );
        const [kpRes, movieRes, seriesRes, kzIedemRes, flCatalogRes] = await Promise.allSettled([
          fetch(
            `https://kinopoiskapiunofficial.tech/api/v2.2/films?keyword=${encodeURIComponent(
              q
            )}&page=1`,
            {
              headers: {
                'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
              },
            }
          ).then((r) => (r.ok ? r.json() : { items: [] })),
          fetch(
            `https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(
              q
            )}.json`
          ).then((r) => (r.ok ? r.json() : { metas: [] })),
          fetch(
            `https://v3-cinemeta.strem.io/catalog/series/top/search=${encodeURIComponent(
              q
            )}.json`
          ).then((r) => (r.ok ? r.json() : { metas: [] })),
          isRussianSearchQuery ? searchIedemVod(q).catch(() => []) : Promise.resolve([]),
          isLocalHomeServer() && !/^[а-яёА-ЯЁ\s\d]+$/.test(q)
            ? fetch(buildFileListApiUrl(`/api/filelist/catalog?q=${encodeURIComponent(q)}`))
                .then((r) => (r.ok ? r.json() : { items: [] }))
                .catch(() => ({ items: [] }))
            : Promise.resolve({ items: [] }),
        ]);

        if (cancelled) return;

        const combined: CinemetaItem[] = [];
        if (
          isRussianSearchQuery &&
          kzIedemRes.status === 'fulfilled' &&
          Array.isArray(kzIedemRes.value)
        ) {
          for (const item of kzIedemRes.value) {
            const isSeries = item.type === 'multistream';
            combined.push({
              id:
                item.fid > 0
                  ? `iedem_${item.fid}`
                  : item.kpId
                    ? `kp_${item.kpId}`
                    : `kinozal_${Math.abs(item.fid)}`,
              iedemFid: item.fid > 0 ? item.fid : undefined,
              kpId: item.kpId ? String(item.kpId) : undefined,
              type: isSeries ? 'series' : 'movie',
              name: item.title,
              releaseInfo: String(item.year || '2026'),
              ratingKinopoisk: item.ratingKinopoisk,
              country: 'Россия',
              poster: item.img || undefined,
              networkBadge:
                item.networkBadge ||
                (item.fid < 0 ? 'Kinozal VIP' : 'iEdem RU'),
              genres: item.tvShowNetwork ? ['ТВ-Шоу'] : undefined,
            });
          }
        }
        if (kpRes.status === 'fulfilled' && Array.isArray(kpRes.value.items)) {
          for (const f of kpRes.value.items.slice(0, 16)) {
            const cStr = Array.isArray(f.countries)
              ? f.countries.map((c: any) => c.country).filter(Boolean).join(', ')
              : '';
            const isRuShow = isRussianVodItem({
              country: cStr,
              name: f.nameRu || f.nameOriginal,
              nameOriginal: f.nameOriginal,
              kpId: String(f.kinopoiskId || f.filmId || ''),
            });
            // Never inject foreign movies/series from Kinopoisk search; foreign content comes exclusively from Cinemeta/FileList
            if (!isRuShow) continue;
            const kpId = String(f.kinopoiskId || f.filmId || '').trim();
            if (!kpId) continue;
            const isSeries =
              f.type === 'TV_SERIES' ||
              f.type === 'MINI_SERIES' ||
              f.type === 'TV_SHOW';
            const rawImdb = typeof f.imdbId === 'string' ? f.imdbId.trim() : '';
            const validImdb = /^tt\d+$/i.test(rawImdb) ? rawImdb : '';
            const yearStr =
              f.year && String(f.year) !== 'null' ? String(f.year) : undefined;
            const ratingNum =
              typeof f.ratingImdb === 'number' && f.ratingImdb > 0
                ? String(f.ratingImdb)
                : typeof f.ratingKinopoisk === 'number' && f.ratingKinopoisk > 0
                  ? String(f.ratingKinopoisk)
                  : undefined;
            const kpRatingNum =
              typeof f.ratingKinopoisk === 'number' && f.ratingKinopoisk > 0
                ? String(f.ratingKinopoisk)
                : undefined;
            const countryStr = Array.isArray(f.countries)
              ? f.countries.map((c: any) => c.country).filter(Boolean).join(', ')
              : undefined;
            const genresArr = Array.isArray(f.genres)
              ? f.genres.map((g: any) => g.genre).filter(Boolean)
              : undefined;
            combined.push({
              id: validImdb || `kp_${kpId}`,
              kpId,
              type: isSeries ? 'series' : 'movie',
              name:
                f.nameOriginal ||
                f.nameEn ||
                f.nameRu ||
                `Film #${kpId}`,
              nameOriginal: f.nameOriginal || f.nameEn || undefined,
              releaseInfo: yearStr,
              imdbRating: ratingNum,
              ratingKinopoisk: kpRatingNum,
              country: countryStr,
              genres: genresArr,
              poster: f.posterUrlPreview || f.posterUrl,
              description: f.description,
            });
          }
        }
        if (
          movieRes.status === 'fulfilled' &&
          Array.isArray(movieRes.value.metas)
        ) {
          for (const m of movieRes.value.metas.slice(0, 16)) {
            combined.push({ ...m, type: 'movie' });
          }
        }
        if (
          seriesRes.status === 'fulfilled' &&
          Array.isArray(seriesRes.value.metas)
        ) {
          for (const s of seriesRes.value.metas.slice(0, 16)) {
            combined.push({ ...s, type: 'series' });
          }
        }
        if (
          flCatalogRes.status === 'fulfilled' &&
          Array.isArray(flCatalogRes.value?.items) &&
          flCatalogRes.value.items.length > 0
        ) {
          const dedupFl = deduplicateFileListItems(
            flCatalogRes.value.items as FileListTorrentInfo[]
          );
          for (const flItem of dedupFl.slice(0, 16)) {
            const cleanImdb =
              flItem.imdbId && /^tt\d+$/.test(flItem.imdbId.trim())
                ? flItem.imdbId.trim()
                : '';
            combined.push({
              id: cleanImdb || `fl:${flItem.id}`,
              imdbId: cleanImdb || undefined,
              flTorrentId: flItem.id,
              type: flItem.type,
              name: flItem.name,
              releaseTitle: flItem.releaseTitle,
              releaseInfo: flItem.year || '2026',
              poster: flItem.poster || undefined,
              qualityBadge: flItem.quality,
            });
          }
        }

        setSearchResults(deduplicateVodItems(combined, q));
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setIsSearchLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [section, searchQuery]);

  // Fetch FileList.io Torrents when in 'torrents' section
  useEffect(() => {
    if (section !== 'torrents') return;
    let cancelled = false;
    setIsFlLoading(true);

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        section: flCategory,
        sort: flSort,
        q: flSearchQuery.trim(),
      });
      fetch(`/api/filelist/catalog?${params.toString()}`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((data) => {
          if (cancelled) return;
          const items: FileListTorrentInfo[] = Array.isArray(data?.items)
            ? data.items
            : [];
          setFlItems(deduplicateFileListItems(items));
        })
        .catch(() => {
          if (!cancelled) setFlItems([]);
        })
        .finally(() => {
          if (!cancelled) setIsFlLoading(false);
        });
    }, flSearchQuery.trim() ? 300 : 10);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [section, flCategory, flSort, flSearchQuery]);

  // Fetch YouTube Premium catalog / search results when in 'youtube' section
  useEffect(() => {
    if (section !== 'youtube') return;
    let cancelled = false;
    setIsYtLoading(true);

    const catObj =
      YOUTUBE_CATEGORIES.find((c) => c.id === ytCategory) ||
      YOUTUBE_CATEGORIES[0];
    const effectiveQuery = ytSearchQuery.trim() || catObj.query;

    const timer = window.setTimeout(
      () => {
        fetch(`/api/youtube/search?q=${encodeURIComponent(effectiveQuery)}`)
          .then((r) => (r.ok ? r.json() : { items: [] }))
          .then((data) => {
            if (cancelled) return;
            const list: YouTubeVideoCardItem[] = Array.isArray(data?.items)
              ? data.items
              : [];
            setYtItems(list);
          })
          .catch(() => {
            if (!cancelled) setYtItems([]);
          })
          .finally(() => {
            if (!cancelled) setIsYtLoading(false);
          });
      },
      ytSearchQuery.trim() ? 320 : 10
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [section, ytCategory, ytSearchQuery]);

  const handlePlayYouTubeVideo = useCallback(
    (ytVideo: YouTubeVideoCardItem) => {
      if (tvSettings.autoFullscreenOnPlay && !isMobilePhone) {
        ensureTvFullscreen();
      }
      setYtUseEmbedFallback(!isLocalHomeServer());
      setActiveYtDurationSec(ytVideo.durationSec || 0);
      setResumeStartSeconds(0);
      setPendingResumePromptSec(null);
      setActiveSubVttUrl(null);
      setActiveSubLabel('');
      setActiveSubCues([]);
      setActiveVodItem({
        id: `yt_${ytVideo.videoId}`,
        type: 'movie',
        name: ytVideo.title,
        releaseInfo: ytVideo.channel,
        poster: ytVideo.thumb,
        background: ytVideo.thumb,
        qualityBadge: 'YT PREMIUM • 1080p',
      });
      setIsSidebarOpen(false);
      if (osdTimerRef.current) {
        window.clearTimeout(osdTimerRef.current);
        osdTimerRef.current = null;
      }
      setIsVodOsdVisible(false);
      setIsPlayingVod(true);
    },
    [tvSettings.autoFullscreenOnPlay, isMobilePhone, ensureTvFullscreen]
  );

  // Open Movie/Series in Lampa Full Detail Card (Карточка фильма)
  const handleOpenVod = useCallback(
    (
      item: CinemetaItem,
      autoPlayImmediately = false,
      explicitSeason?: number,
      explicitEpisode?: number
    ) => {
      if (
        autoPlayImmediately &&
        tvSettings.autoFullscreenOnPlay &&
        !isMobilePhone
      ) {
        ensureTvFullscreen();
      }
      const saved = findWatchProgressEntry(watchProgressMapRef.current, item) || findWatchProgressEntry(watchProgressMap, item);
      const relMatch = String(item.releaseTitle || item.name || '').match(
        /\bS(\d{1,2})[.\s_-]*E(\d{1,2})\b/i
      );
      const seasonPackOnlyMatch = !relMatch
        ? String(item.releaseTitle || item.name || '').match(/\bS(\d{1,2})\b/i)
        : null;
      const useExplicitTorrentEp = Boolean(relMatch && section === 'torrents');
      const targetSeason =
        typeof explicitSeason === 'number' && explicitSeason > 0
          ? explicitSeason
          : useExplicitTorrentEp
            ? Number(relMatch![1])
            : saved?.season ||
            (relMatch
              ? Number(relMatch[1])
              : seasonPackOnlyMatch
                ? Number(seasonPackOnlyMatch[1])
                : 1);
      const targetEpisode =
        typeof explicitEpisode === 'number' && explicitEpisode > 0
          ? explicitEpisode
          : useExplicitTorrentEp
            ? Number(relMatch![2])
            : saved?.episode || (relMatch ? Number(relMatch[2]) : 1);
      const epKey = `S${targetSeason}E${targetEpisode}`;
      const epSaved = saved?.episodeProgressMap?.[epKey];
      const topMatchesTargetEp =
        saved?.season === targetSeason && saved?.episode === targetEpisode;
      const startSec =
        item.type === 'series'
          ? topMatchesTargetEp
            ? (saved?.updatedAt || 0) >= (epSaved?.updatedAt || 0) &&
              (saved?.currentTime ?? 0) > 0
              ? (saved?.currentTime ?? 0)
              : (epSaved?.currentTime ?? saved?.currentTime ?? 0)
            : (epSaved?.currentTime ?? 0)
          : (saved?.currentTime ?? 0);

      const relTitleInit = String(item.releaseTitle || item.name || '');
      const isSeasonPackInit =
        !relMatch &&
        new RegExp(`\\bS0*${targetSeason}\\b`, 'i').test(relTitleInit) &&
        !/\bE\d{1,2}\b/i.test(relTitleInit);
      const initialTorrentMatchesEp =
        item.type !== 'series' ||
        isSeasonPackInit ||
        Boolean(
          relMatch &&
          Number(relMatch[1]) === targetSeason &&
          Number(relMatch[2]) === targetEpisode
        );
      const isExplicitTorrentCardOpen =
        section === 'torrents' ||
        item.id.startsWith('fl:') ||
        item.id.startsWith('kinozal_');
      userSelectedFlTorrentIdRef.current =
        isExplicitTorrentCardOpen &&
        initialTorrentMatchesEp &&
        item.flTorrentId &&
        isLocalHomeServer()
          ? Number(item.flTorrentId)
          : null;
      const isOpenedFromAdult18 = Boolean(
        isAdult18WatchItem(item) || isAdult18WatchItem(saved?.item) || section === 'adult_18'
      );
      const normalizedItem: CinemetaItem =
        item.type === 'series'
          ? {
            ...item,
            ...(isOpenedFromAdult18 ? { isAdult18: true } : {}),
            releaseTitle: item.releaseTitle || item.name,
            name:
              item.name
                .replace(/\s*\(S\d+[^)]*\)\s*/gi, '')
                .replace(/[.\s•-]*Сезон\s*\d+.*$/i, '')
                .trim() || item.name,
          }
          : isOpenedFromAdult18
            ? { ...item, isAdult18: true }
            : item;
      if (normalizedItem.type === 'series' && !isExplicitTorrentCardOpen) {
        delete normalizedItem.flTorrentId;
        if (/^Stream\s*#/i.test(String(normalizedItem.releaseTitle || ''))) {
          delete normalizedItem.releaseTitle;
        }
      }
      if (
        normalizedItem.id === 'tt27636698' ||
        normalizedItem.imdbId === 'tt27636698' ||
        String(normalizedItem.kpId || '') === '5354824'
      ) {
        normalizedItem.name = 'Шоу Воли (ТНТ)';
        normalizedItem.kpId = '5354824';
        delete normalizedItem.nameOriginal;
        if (!isExplicitTorrentCardOpen) {
          delete normalizedItem.flTorrentId;
          if (/^Stream\s*#/i.test(String(normalizedItem.releaseTitle || ''))) {
            delete normalizedItem.releaseTitle;
          }
        }
      }
      if (
        !/^мама$|^mama$/i.test(String(normalizedItem.name || "").trim()) &&
        (String(normalizedItem.poster || "").includes("11303084") ||
          normalizedItem.imdbId === "tt43353255" ||
          normalizedItem.nameOriginal === "MAMA")
      ) {
        if (/жизнь\s+заново/i.test(String(normalizedItem.name || ""))) {
          normalizedItem.kpId = "7958160";
          normalizedItem.poster = "https://kinopoiskapiunofficial.tech/images/posters/kp/7958160.jpg";
          normalizedItem.background = "https://kinopoiskapiunofficial.tech/images/posters/kp/7958160.jpg";
          normalizedItem.description = "2026 год. Жизнь сорокалетнего врача скорой помощи Димы пошла под откос: жена ушла, коллеги презирают, а сам он живёт у деспотичной матери.";
        }
        delete normalizedItem.imdbId;
        delete normalizedItem.nameOriginal;
      }
      setIsDirectStreamLoading(true);
      setResolvedDirectStream(null);
      setResolvedFileListStream(null);
      setActiveVodItem(normalizedItem);
      setIsSidebarOpen(false);
      setIsPlayingVod(autoPlayImmediately);
      try {
        window.history.pushState({ lampaCard: item.id }, '');
      } catch {
        // ignore
      }
      setSelectedAudioTrackIdx(-1);
      setSelectedSeason(targetSeason);
      setSelectedEpisode(targetEpisode);
      setEpisodesSortDesc(loadSeriesEpisodeSortDesc(item.id, saved));
      const canUseLocalFl = isLocalHomeServer();
      const isAdultKlubOnly = Boolean(
        (normalizedItem.klubnichkaRawId ||
          normalizedItem.id.startsWith('klub_') ||
          normalizedItem.isAdultKlubnichka) &&
        !normalizedItem.flTorrentId
      );
      const isRoShow =
        isRomanianVodItem(normalizedItem) ||
        isFileListExclusiveRomanianTitle(normalizedItem);
      const isRuTvShow = !isRoShow && isRussianTvShowItem(normalizedItem);
      const isForeignItem = !isRoShow && !isRussianVodItem(normalizedItem);
      const prefersTorrentFirst = !isAdultKlubOnly && !isRuTvShow && !isRoShow;
      const savedSrv =
        saved?.server === 'filelist_torrent' && canUseLocalFl
          ? 'filelist_torrent'
          : saved?.server === 'kinogram_hls' && (!prefersTorrentFirst || !canUseLocalFl) && (!isForeignItem || !canUseLocalFl)
            ? 'kinogram_hls'
            : undefined;
      const defaultSrv: VodServerId =
        tvSettings.defaultVodServer === 'auto_best'
          ? (prefersTorrentFirst && canUseLocalFl)
            ? 'filelist_torrent'
            : 'kinogram_hls'
          : tvSettings.defaultVodServer === 'filelist_torrent' && !canUseLocalFl
            ? 'kinogram_hls'
            : tvSettings.defaultVodServer;
      setActiveServer(
        isAdultKlubOnly
          ? 'kinogram_hls'
          : isRoShow
            ? (canUseLocalFl &&
              (savedSrv === 'filelist_torrent' ||
                ((isExplicitTorrentCardOpen || isFileListExclusiveRomanianTitle(normalizedItem)) &&
                  normalizedItem.flTorrentId))
                ? 'filelist_torrent'
                : 'kinogram_hls')
            : isRuTvShow
              ? 'kinogram_hls'
              : isForeignItem
                ? (canUseLocalFl ? 'filelist_torrent' : 'kinogram_hls')
                : (item.flTorrentId || item.id.startsWith('kinozal_') || prefersTorrentFirst) &&
                  canUseLocalFl &&
                  (tvSettings.defaultVodServer === 'auto_best' ||
                    tvSettings.defaultVodServer === 'filelist_torrent')
                  ? 'filelist_torrent'
                  : savedSrv || defaultSrv
      );
      if (tvSettings.defaultSubLang !== 'off') {
        setPreferredSubLang(tvSettings.defaultSubLang);
      }
      setActiveSubVttUrl(null);
      setActiveSubLabel('');
      setActiveSubCues([]);
      setIsEpisodesDrawerOpen(false);
      setIsInfoSheetOpen(false);
      if (autoPlayImmediately && !isMobilePhone) {
        if (osdTimerRef.current) {
          window.clearTimeout(osdTimerRef.current);
          osdTimerRef.current = null;
        }
        setIsVodOsdVisible(false);
      } else {
        wakeVodOsd();
      }

      if (startSec > 5) {
        setPendingResumePromptSec(startSec);
        setResumeStartSeconds(startSec);
      } else {
        setPendingResumePromptSec(null);
        setResumeStartSeconds(0);
      }

      if (!autoPlayImmediately) {
        window.requestAnimationFrame(() => {
          playVodBtnRef.current?.focus({ preventScroll: true });
        });
        window.setTimeout(() => {
          const mainEl =
            rootContainerRef.current?.querySelector<HTMLElement>('main');
          if (mainEl) {
            mainEl.scrollTop = 0;
            mainEl.scrollTo({ top: 0 });
          }
          playVodBtnRef.current?.focus({ preventScroll: true });
        }, 80);
      } else {
        window.setTimeout(() => {
          const playBtn =
            playerBoxRef.current?.querySelector<HTMLButtonElement>(
              '[data-vod-play-btn="true"]'
            );
          playBtn?.focus();
        }, 90);
      }
    },
    [
      watchProgressMap,
      section,
      isMobilePhone,
      ensureTvFullscreen,
      wakeVodOsd,
      tvSettings.autoFullscreenOnPlay,
      tvSettings.defaultVodServer,
      tvSettings.defaultSubLang,
    ]
  );

  const handledDeepLinkVodRef = useRef<boolean>(false);
  useEffect(() => {
    if (handledDeepLinkVodRef.current || typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const playVodId = (sp.get('playVod') || '').trim();
    if (!playVodId) return;
    const savedEntry = findWatchProgressEntry(watchProgressMap, playVodId);
    const nameParam = (sp.get('name') || '').trim();
    const typeParam = sp.get('type') === 'movie' ? 'movie' : 'series';
    const cleanTt = playVodId.startsWith('tt') ? playVodId.split(':')[0] : '';
    const targetItem: CinemetaItem | undefined =
      savedEntry?.item ||
      (nameParam || cleanTt
        ? {
          id: playVodId,
          imdbId: cleanTt || undefined,
          name: nameParam || playVodId,
          type: typeParam,
          poster: cleanTt
            ? `https://images.metahub.space/poster/medium/${cleanTt}/img`
            : '',
        }
        : undefined);
    if (!targetItem) return;
    handledDeepLinkVodRef.current = true;
    const sParam = Number(sp.get('s') || savedEntry?.season || 1) || 1;
    const eParam = Number(sp.get('e') || savedEntry?.episode || 1) || 1;
    const tParam = Number(sp.get('t') || 0);
    handleOpenVod(targetItem, true, sParam, eParam);
    if (tParam > 5) {
      setResumeStartSeconds(tParam);
    }
    try {
      sp.delete('playVod');
      sp.delete('s');
      sp.delete('e');
      sp.delete('t');
      sp.delete('name');
      sp.delete('type');
      const nextQs = sp.toString();
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}${nextQs ? `?${nextQs}` : ''}`
      );
    } catch {
      // ignore
    }
  }, [watchProgressMap, handleOpenVod]);

  const handleStartVodPlayback = useCallback(
    (customStartSec?: number, openAudioSheet = false) => {
      if (tvSettings.autoFullscreenOnPlay && !isMobilePhone) {
        ensureTvFullscreen();
      }
      if (typeof customStartSec === 'number') {
        setResumeStartSeconds(customStartSec);
        if (customStartSec === 0) {
          setPendingResumePromptSec(null);
        }
      } else if (activeVodItem) {
        const saved =
          findWatchProgressEntry(watchProgressMapRef.current, activeVodItem) ||
          findWatchProgressEntry(watchProgressMap, activeVodItem);
        const epKey = `S${selectedSeason}E${selectedEpisode}`;
        const epSaved = saved?.episodeProgressMap?.[epKey];
        const latestSec =
          activeVodItem.type === 'series'
            ? (epSaved?.currentTime ??
              (saved?.season === selectedSeason &&
                saved?.episode === selectedEpisode
                ? saved?.currentTime ?? 0
                : 0))
            : (saved?.currentTime ?? 0);
        if (latestSec > 10) {
          setResumeStartSeconds(latestSec);
          setPendingResumePromptSec(latestSec);
        } else if (resumeStartSeconds > 10) {
          setPendingResumePromptSec(resumeStartSeconds);
        } else {
          setResumeStartSeconds(0);
          setPendingResumePromptSec(null);
        }
      }
      if (
        resolvedDirectStream?.ok &&
        (resolvedDirectStream.dashUrl ||
          resolvedDirectStream.hlsUrl ||
          resolvedDirectStream.proxyHlsUrl)
      ) {
        if (!isCurrentVodForeign && (activeServer !== 'filelist_torrent' || !resolvedFileListStream?.streamUrl)) {
          setActiveServer('kinogram_hls');
        }
      }
      setIsSidebarOpen(false);
      setIsPlayingVod(true);
      setIsInfoSheetOpen(openAudioSheet);
      if (openAudioSheet) {
        wakeVodOsd();
        window.setTimeout(() => {
          const firstAudioBtn =
            playerBoxRef.current?.querySelector<HTMLButtonElement>(
              '[data-sheet-audio-btn="true"]'
            );
          (firstAudioBtn || vodAudioBtnRef.current)?.focus();
        }, 90);
      } else if (isMobilePhone) {
        wakeVodOsd();
      } else {
        if (osdTimerRef.current) {
          window.clearTimeout(osdTimerRef.current);
          osdTimerRef.current = null;
        }
        setIsVodOsdVisible(false);
      }
    },
    [
      activeVodItem,
      watchProgressMap,
      selectedSeason,
      selectedEpisode,
      resumeStartSeconds,
      ensureTvFullscreen,
      isMobilePhone,
      wakeVodOsd,
      tvSettings.autoFullscreenOnPlay,
    ]
  );

  const toggleSaveVodItemRef = useRef<(item: CinemetaItem) => void>(() => {});

  const handleCardPlayKey = useCallback(
    (
      e: React.KeyboardEvent,
      item: CinemetaItem,
      explicitSeason?: number,
      explicitEpisode?: number
    ) => {
      const isRedButton =
        e.keyCode === 403 ||
        e.key === 'ColorF0Red' ||
        e.key === 'Red' ||
        e.code === 'ColorF0Red';
      const isFavKey =
        (e.key === 'f' || e.key === 'F' || e.key === 'r' || e.key === 'R') &&
        !(
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA'
        );

      if (isRedButton || isFavKey) {
        e.preventDefault();
        e.stopPropagation();
        toggleSaveVodItemRef.current(item);
        return;
      }

      if (
        e.keyCode === 415 ||
        e.keyCode === 179 ||
        e.keyCode === 250 ||
        e.keyCode === 10252 ||
        e.key === 'MediaPlay' ||
        e.key === 'MediaPlayPause' ||
        e.key === 'Play' ||
        ((e.key === 'p' || e.key === 'P') &&
          !(
            document.activeElement?.tagName === 'INPUT' ||
            document.activeElement?.tagName === 'TEXTAREA'
          ))
      ) {
        e.preventDefault();
        e.stopPropagation();
        lastFocusedVodItemRef.current = item;
        if (playerStatus === 'playing' || playerStatus === 'loading') {
          stopRadio();
        }
        const prog = (findWatchProgressEntry(watchProgressMapRef.current, item) || findWatchProgressEntry(watchProgressMap, item) || {}) as Partial<VodWatchProgressEntry>;
        const s =
          explicitSeason ??
          (item.type === 'series' ? Math.max(1, Number(prog.season) || 1) : 1);
        const ep =
          explicitEpisode ??
          (item.type === 'series' ? Math.max(1, Number(prog.episode) || 1) : 1);
        handleOpenVod(item, true, s, ep);
      }
    },
    [handleOpenVod, playerStatus, stopRadio, watchProgressMap]
  );

  const handleEpisodePlayKey = useCallback(
    (e: React.KeyboardEvent, ep: { episode: number }, seasonNum?: number) => {
      if (
        e.keyCode === 415 ||
        e.keyCode === 179 ||
        e.keyCode === 250 ||
        e.keyCode === 10252 ||
        e.key === 'MediaPlay' ||
        e.key === 'MediaPlayPause' ||
        e.key === 'Play' ||
        ((e.key === 'p' || e.key === 'P') &&
          !(
            document.activeElement?.tagName === 'INPUT' ||
            document.activeElement?.tagName === 'TEXTAREA'
          ))
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (playerStatus === 'playing' || playerStatus === 'loading') {
          stopRadio();
        }
        userSelectedFlTorrentIdRef.current = null;
        const targetSeason = typeof seasonNum === 'number' ? seasonNum : selectedSeason;
        setSelectedSeason(targetSeason);
        setSelectedEpisode(ep.episode);
        const epKey = `S${targetSeason}E${ep.episode}`;
        const epProg = activeVodItem
          ? (findWatchProgressEntry(watchProgressMapRef.current, activeVodItem) || findWatchProgressEntry(watchProgressMap, activeVodItem))?.episodeProgressMap?.[epKey]
          : null;
        const epDur = epProg?.duration && epProg.duration > 60 ? epProg.duration : 2700;
        const epPct =
          epProg && epProg.currentTime > 10
            ? Math.min(100, Math.max(5, Math.round((epProg.currentTime / epDur) * 100)))
            : 0;
        const startAt =
          epProg && epProg.currentTime > 10 && epPct < 92
            ? epProg.currentTime
            : 0;
        handleStartVodPlayback(startAt);
      }
    },
    [activeVodItem, handleStartVodPlayback, playerStatus, selectedSeason, stopRadio, watchProgressMap]
  );

  // Open Official Movie / Series Trailer in Lampa Fullscreen Modal
  const handleOpenTrailer = useCallback(async () => {
    if (!activeVodItem) return;
    setIsTrailerModalOpen(true);
    setIsLoadingTrailer(true);
    setActiveTrailerIdx(0);

    const found: TrailerItem[] = [];
    const seenUrls = new Set<string>();
    const addTrailer = (id: string, title: string, embedUrl: string) => {
      if (!embedUrl || seenUrls.has(embedUrl)) return;
      seenUrls.add(embedUrl);
      found.push({ id, title, embedUrl });
    };

    try {
      // 1. Check already loaded Cinemeta trailers on detailedMeta
      if (Array.isArray(detailedMeta?.trailerStreams)) {
        for (const ts of detailedMeta.trailerStreams) {
          if (ts.ytId) {
            addTrailer(
              ts.ytId,
              ts.title || `${activeVodItem.name} — Trailer`,
              `https://www.youtube.com/embed/${ts.ytId}?autoplay=1&rel=0`
            );
          }
        }
      }
      if (Array.isArray(detailedMeta?.trailers)) {
        for (const tr of detailedMeta.trailers) {
          if (tr.source) {
            addTrailer(
              tr.source,
              `${activeVodItem.name} — Official Trailer`,
              `https://www.youtube.com/embed/${tr.source}?autoplay=1&rel=0`
            );
          }
        }
      }

      // 2. If no Cinemeta trailer yet, resolve IMDb ID (by ID or title search) and fetch Cinemeta meta
      let imdbId = activeVodItem.id.startsWith('tt')
        ? activeVodItem.id
        : detailedMeta?.imdbId || '';

      if (!imdbId && found.length === 0) {
        const qTitle = detailedMeta?.nameOriginal || activeVodItem.name;
        const searchRes = await fetch(
          `https://v3-cinemeta.strem.io/catalog/${activeVodItem.type}/top/search=${encodeURIComponent(
            qTitle
          )}.json`
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        const firstMatch = searchRes?.metas?.[0];
        if (firstMatch?.id && String(firstMatch.id).startsWith('tt')) {
          imdbId = String(firstMatch.id);
        }
      }

      if (imdbId && found.length === 0) {
        const cmData = await fetch(
          `https://v3-cinemeta.strem.io/meta/${activeVodItem.type}/${imdbId}.json`
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        const meta = cmData?.meta;
        if (Array.isArray(meta?.trailerStreams)) {
          for (const ts of meta.trailerStreams) {
            if (ts?.ytId) {
              addTrailer(
                ts.ytId,
                ts.title || `${activeVodItem.name} — Trailer`,
                `https://www.youtube.com/embed/${ts.ytId}?autoplay=1&rel=0`
              );
            }
          }
        }
        if (Array.isArray(meta?.trailers)) {
          for (const tr of meta.trailers) {
            if (tr?.source) {
              addTrailer(
                tr.source,
                `${activeVodItem.name} — Official Trailer`,
                `https://www.youtube.com/embed/${tr.source}?autoplay=1&rel=0`
              );
            }
          }
        }
      }

      // 3. Also check Kinopoisk /videos for Russian/Original trailers
      const kp =
        activeVodItem.kpId ||
        detailedMeta?.kpId ||
        (activeVodItem.id.startsWith('kp_')
          ? activeVodItem.id.replace(/^kp_/, '')
          : '');
      if (kp) {
        const kpVideos = await fetch(
          `https://kinopoiskapiunofficial.tech/api/v2.2/films/${kp}/videos`,
          {
            headers: {
              'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
            },
          }
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);

        if (Array.isArray(kpVideos?.items)) {
          for (const item of kpVideos.items) {
            const url = String(item?.url || '');
            const name = String(item?.name || 'Трейлер');
            const ytMatch = url.match(
              /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
            );
            if (ytMatch?.[1]) {
              addTrailer(
                ytMatch[1],
                name,
                `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`
              );
            } else if (url.includes('widgets.kinopoisk.ru/discovery/trailer/')) {
              addTrailer(url, `${name} (КП)`, url);
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // 4. Fallback if no explicit trailer ID was found
    if (found.length === 0) {
      const q = `${detailedMeta?.nameOriginal || activeVodItem.name
        } ${activeVodItem.releaseInfo || ''} official trailer`.trim();
      addTrailer(
        'yt_search',
        `${activeVodItem.name} — Official Trailer`,
        `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(
          q
        )}&autoplay=1`
      );
    }

    setTrailerList(found);
    setIsLoadingTrailer(false);
  }, [activeVodItem, detailedMeta]);

  // Lampa 1-Click Quick Subtitle Language Switcher (RO / RU / EN / Off)
  const handleQuickSubLangSwitch = useCallback(
    async (lang: 'off' | SubtitleLangId) => {
      if (lang === 'off') {
        usingMkvLiveSubRef.current = false;
        userDisabledSubRef.current = true;
        setUseManualOnlineSub(true);
        setActiveSubVttUrl(null);
        setActiveSubLabel('');
        setActiveSubCues([]);
        return;
      }

      setPreferredSubLang(lang);
      if (!activeVodItem) return;

      const imdbId = activeVodItem.id.startsWith('tt')
        ? activeVodItem.id
        : detailedMeta?.imdbId || '';
      if (!imdbId) {
        setIsSubFinderOpen(true);
        return;
      }

      setIsLoadingQuickSub(lang);
      try {
        const tracks = await fetchOnlineSubtitlesByImdb({
          imdbId,
          type: activeVodItem.type,
          season: selectedSeason,
          episode: selectedEpisode,
        });
        const match = tracks.find((t) => t.langCode2 === lang);
        if (match) {
          const { vttBlobUrl, cues } = await downloadSubtitleAsVttBlobUrl(
            match.url,
            0,
            match.langCode2
          );
          userDisabledSubRef.current = false;
          usingMkvLiveSubRef.current = false;
          setUseManualOnlineSub(true);
          setActiveSubVttUrl(vttBlobUrl);
          setActiveSubLabel(match.langLabel);
          setActiveSubCues(cues);
        } else {
          setIsSubFinderOpen(true);
        }
      } catch {
        setIsSubFinderOpen(true);
      } finally {
        setIsLoadingQuickSub(null);
      }
    },
    [activeVodItem, selectedSeason, selectedEpisode]
  );

  const userManuallySelectedServerRef = useRef<boolean>(false);
  const userSelectedFlTorrentIdRef = useRef<number | null>(null);
  const lastResolvedItemKeyRef = useRef<string>('');
  const lastResolvedEpKeyRef = useRef<string>('');
  const cachedSeriesSeasonsRef = useRef<{
    itemKey: string;
    seasons: NonNullable<ResolvedDirectVodStream['seasons']>;
  }>({ itemKey: '', seasons: [] });

  // Fetch detailed Lampa meta (Cinemeta + Kinopoisk) & direct HLS stream when activeVodItem changes
  useEffect(() => {
    setOpenVodCompactPanel(null);
    if (!activeVodItem) {
      setDetailedMeta(null);
      setResolvedDirectStream(null);
      userManuallySelectedServerRef.current = false;
      userSelectedFlTorrentIdRef.current = null;
      lastResolvedItemKeyRef.current = '';
      lastResolvedEpKeyRef.current = '';
      cachedSeriesSeasonsRef.current = { itemKey: '', seasons: [] };
      return;
    }

    if (activeVodItem.id.startsWith('yt_')) {
      setDetailedMeta({ ...activeVodItem });
      setIsDirectStreamLoading(false);
      setIsFileListStreamLoading(false);
      return;
    }

    const mergeSeasonsLists = (
      baseList?: ResolvedDirectVodStream['seasons'],
      incomingList?: ResolvedDirectVodStream['seasons']
    ): NonNullable<ResolvedDirectVodStream['seasons']> => {
      const sMap = new Map<
        number,
        Map<number, NonNullable<ResolvedDirectVodStream['seasons']>[number]['episodes'][number]>
      >();
      const ingest = (list?: ResolvedDirectVodStream['seasons']) => {
        if (!Array.isArray(list)) return;
        for (const s of list) {
          const sNum = Number(s?.season);
          if (!sNum || sNum <= 0 || !Array.isArray(s.episodes)) continue;
          if (!sMap.has(sNum)) sMap.set(sNum, new Map());
          const eMap = sMap.get(sNum)!;
          for (const ep of s.episodes) {
            const epNum = Number(ep?.episode);
            if (!epNum || epNum <= 0) continue;
            const prevEp = eMap.get(epNum);
            if (!prevEp) {
              eMap.set(epNum, { ...ep, episode: epNum });
            } else {
              const isPrevGeneric =
                !prevEp.title ||
                /^(?:Episodul|Episode|Серия|Выпуск)\s*\d+$/i.test(prevEp.title) ||
                /\(\d+\s*сезон\)\s*-\s*\d+\s*(?:серия|выпуск)/i.test(prevEp.title);
              const isNewGeneric =
                !ep.title ||
                /^(?:Episodul|Episode|Серия|Выпуск)\s*\d+$/i.test(ep.title) ||
                /\(\d+\s*сезон\)\s*-\s*\d+\s*(?:серия|выпуск)/i.test(ep.title);
              eMap.set(epNum, {
                ...prevEp,
                ...ep,
                title:
                  isPrevGeneric && !isNewGeneric
                    ? ep.title
                    : !isPrevGeneric && isNewGeneric
                      ? prevEp.title
                      : ep.title || prevEp.title,
                thumbnail: ep.thumbnail || prevEp.thumbnail,
                duration: ep.duration || prevEp.duration || 0,
              });
            }
          }
        }
      };
      ingest(baseList);
      ingest(incomingList);
      return [...sMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([season, eMap]) => ({
          season,
          episodes: [...eMap.values()].sort((a, b) => a.episode - b.episode),
        }))
        .filter((s) => s.episodes.length > 0);
    };

    const itemKey = activeVodItem.id;
    const epKey = `S${selectedSeason}E${selectedEpisode}`;
    const isNewVodItem = lastResolvedItemKeyRef.current !== itemKey;
    if (isNewVodItem) {
      lastResolvedItemKeyRef.current = itemKey;
      lastResolvedEpKeyRef.current = epKey;
      cachedSeriesSeasonsRef.current = { itemKey, seasons: [] };
      const relTitleCur = String(
        activeVodItem.releaseTitle || activeVodItem.name || ''
      );
      const relMatch = relTitleCur.match(/\bS(\d{1,2})[.\s_-]*E(\d{1,2})\b/i);
      const isSeasonPackCur =
        !relMatch &&
        new RegExp(`\\bS0*${selectedSeason}\\b`, 'i').test(relTitleCur) &&
        !/\bE\d{1,2}\b/i.test(relTitleCur);
      const matchesCurrentEp =
        activeVodItem.type !== 'series' ||
        isSeasonPackCur ||
        Boolean(
          relMatch &&
          Number(relMatch[1]) === selectedSeason &&
          Number(relMatch[2]) === selectedEpisode
        );
      const isExplicitTorrentActiveCard =
        section === 'torrents' ||
        activeVodItem.id.startsWith('fl:') ||
        activeVodItem.id.startsWith('kinozal_');
      userSelectedFlTorrentIdRef.current =
        isExplicitTorrentActiveCard &&
        matchesCurrentEp &&
        activeVodItem.flTorrentId &&
        isLocalHomeServer()
          ? Number(activeVodItem.flTorrentId)
          : null;
      userManuallySelectedServerRef.current = Boolean(
        userSelectedFlTorrentIdRef.current !== null && isLocalHomeServer()
      );
      setResolvedFileListStream(null);
      setResolvedDirectStream(null);
    } else if (lastResolvedEpKeyRef.current !== epKey) {
      lastResolvedEpKeyRef.current = epKey;
      userSelectedFlTorrentIdRef.current = null;
      userManuallySelectedServerRef.current = false;
      iedemAltDirectStreamRef.current = null;
      userRequestedOriginalAudioRef.current = false;
      setResolvedFileListStream(null);
      setResolvedDirectStream((prev) => {
        const keptSeasons = mergeSeasonsLists(
          cachedSeriesSeasonsRef.current.itemKey === itemKey
            ? cachedSeriesSeasonsRef.current.seasons
            : undefined,
          prev?.seasons
        );
        if (keptSeasons.length > 0) {
          cachedSeriesSeasonsRef.current = { itemKey, seasons: keptSeasons };
          return {
            ok: false,
            type: prev?.type || 'series',
            seasons: keptSeasons,
          };
        }
        return null;
      });
    }

    let cancelled = false;
    setIsDirectStreamLoading(true);
    const isPoisonedMamaMeta =
      !/^мама$|^mama$/i.test(String(activeVodItem.name || "").trim()) &&
      (String(activeVodItem.poster || "").includes("11303084") ||
        activeVodItem.imdbId === "tt43353255" ||
        activeVodItem.nameOriginal === "MAMA");
    const isPoisonedVolyaTitle =
      String(activeVodItem.kpId || "") === "5354824" ||
      String(activeVodItem.id || "").includes("5354824") ||
      activeVodItem.id === "tt27636698" ||
      activeVodItem.imdbId === "tt27636698";
    const sanitizedVodItem = isPoisonedMamaMeta
      ? {
        ...activeVodItem,
        kpId: /жизнь\s+заново/i.test(activeVodItem.name) ? "7958160" : activeVodItem.kpId,
        poster: /жизнь\s+заново/i.test(activeVodItem.name)
          ? "https://kinopoiskapiunofficial.tech/images/posters/kp/7958160.jpg"
          : activeVodItem.iedemFid
            ? `/api/iedem-vod?poster=${encodeURIComponent(`http://895890bd73a7.jmeekos.com/posters/h/p_${String(activeVodItem.iedemFid).padStart(8, "0")}.jpg`)}`
            : undefined,
        background: /жизнь\s+заново/i.test(activeVodItem.name)
          ? "https://kinopoiskapiunofficial.tech/images/posters/kp/7958160.jpg"
          : undefined,
        imdbId: undefined,
        nameOriginal: undefined,
      }
      : isPoisonedVolyaTitle
        ? {
          ...activeVodItem,
          name: "Шоу Воли (ТНТ)",
          kpId: "5354824",
          nameOriginal: undefined,
          releaseTitle: /^Stream\s*#/i.test(String(activeVodItem.releaseTitle || ""))
            ? undefined
            : activeVodItem.releaseTitle,
        }
        : activeVodItem;
    setDetailedMeta((prev) => {
      const next =
        !isNewVodItem && prev && prev.id === sanitizedVodItem.id
          ? { ...sanitizedVodItem, ...prev }
          : { ...sanitizedVodItem };
      return isPoisonedVolyaTitle
        ? { ...next, name: "Шоу Воли (ТНТ)", kpId: "5354824", nameOriginal: undefined }
        : next;
    });

    const isKlubnichkaStream = Boolean(
      activeVodItem.klubnichkaRawId ||
      (activeVodItem.id.startsWith('klub_') && !activeVodItem.flTorrentId)
    );
    if (isKlubnichkaStream) {
      userManuallySelectedServerRef.current = true;
      setActiveServer('kinogram_hls');
      setKlubnichkaQualities([]);
      const rawId = activeVodItem.klubnichkaRawId || activeVodItem.id;
      resolveKlubnichkaDirectStream(rawId)
        .then((res) => {
          if (cancelled) return;
          const directPlayableUrl = res.bestMp4Url || res.hlsUrl || '';
          setKlubnichkaQualities(res.qualities || []);
          setResolvedDirectStream({
            ok: Boolean(directPlayableUrl),
            type: 'movie',
            sourcePath: `Klubnichka 18+ • ${res.qualityBadge || activeVodItem.qualityBadge || '1080p HD'}`,
            title: activeVodItem.name,
            hlsUrl: directPlayableUrl || undefined,
            audioNames: ['Original Stereo • Klubnichka 18+'],
          });
          setIsDirectStreamLoading(false);
        })
        .catch(() => {
          if (!cancelled) setIsDirectStreamLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }
    setKlubnichkaQualities([]);

    const isIedemItem = Boolean(
      activeVodItem.iedemFid || activeVodItem.id.startsWith('iedem_')
    );
    const iedemFid =
      activeVodItem.iedemFid ||
      (activeVodItem.id.startsWith('iedem_')
        ? Number(activeVodItem.id.replace(/^iedem_/, ''))
        : 0);

    if (isIedemItem && iedemFid > 0) {
      const isEarlyRuIedem = isRussianVodItem(activeVodItem);
      let isRuTvShowIedem = isRussianTvShowItem(activeVodItem);
      let iedemVkDirectOk = false;
      let iedemVkFinished = false;
      let iedemFlOk = false;
      const canUseLocalTorrent =
        isLocalHomeServer() &&
        (tvSettings.defaultVodServer === 'auto_best' ||
          tvSettings.defaultVodServer === 'filelist_torrent');
      if (
        !userManuallySelectedServerRef.current &&
        userSelectedFlTorrentIdRef.current === null
      ) {
        if (!isEarlyRuIedem) {
          // Foreign series / movie: NEVER switch to kinogram_hls! Always prioritize filelist_torrent
          setActiveServer('filelist_torrent');
        } else {
          setActiveServer(
            !isRuTvShowIedem && canUseLocalTorrent
              ? 'filelist_torrent'
              : 'kinogram_hls'
          );
        }
      }
      const iedemQualityLabel = activeVodItem.qualityBadge?.includes('4K')
        ? '4K UHD'
        : '1080p Full HD';
      const iedemCardSeason = (() => {
        const rawLabel = String(
          activeVodItem.releaseTitle || activeVodItem.name || ''
        );
        const sm = rawLabel.match(/(?:Сезон|Season|\bS)0*(\d{1,2})\b/i);
        return sm ? Number(sm[1]) || 1 : 1;
      })();
      const isMatchingIedemCardSeason =
        activeVodItem.type !== 'series' ||
        (selectedSeason || 1) === iedemCardSeason;

      if (isEarlyRuIedem && activeVodItem.iedemStreamUrl && activeVodItem.type !== 'series') {
        setResolvedDirectStream({
          ok: true,
          type: 'movie',
          sourcePath: `iEdem Mediateka VIP • ${iedemQualityLabel}`,
          title: activeVodItem.name,
          hlsUrl: `/api/tv-proxy?url=${encodeURIComponent(activeVodItem.iedemStreamUrl)}`,
          audioNames: [`Русский (iEdem VIP • ${iedemQualityLabel})`],
        });
        setIsDirectStreamLoading(false);
      }

      if (isMatchingIedemCardSeason) {
        fetchIedemItemDetail(iedemFid)
          .then((detail) => {
            if (cancelled || !detail) return;
            if (
              detail.type === 'multistream' &&
              Array.isArray(detail.items) &&
              detail.items.length > 0
            ) {
              const epList = detail.items.map((ep, idx) => ({
                episode: idx + 1,
                title: ep.title || `Серия ${idx + 1}`,
                rawUrl: ep.url || '',
              }));
              const chosenEp = epList.find(
                (e) => e.episode === selectedEpisode
              );
              const streamTarget =
                chosenEp?.rawUrl ||
                (selectedEpisode === 1
                  ? epList[0]?.rawUrl || activeVodItem.iedemStreamUrl || ''
                  : '');
              const iedemSeasonEntry: NonNullable<
                ResolvedDirectVodStream['seasons']
              > = [
                  {
                    season: iedemCardSeason,
                    episodes: epList.map((e) => ({
                      episode: e.episode,
                      title: e.title,
                      duration: 0,
                    })),
                  },
                ];
              setResolvedDirectStream((prev) => {
                const mergedSeasons = mergeSeasonsLists(
                  cachedSeriesSeasonsRef.current.itemKey === itemKey
                    ? cachedSeriesSeasonsRef.current.seasons
                    : prev?.seasons,
                  iedemSeasonEntry
                );
                if (mergedSeasons.length > 0) {
                  cachedSeriesSeasonsRef.current = {
                    itemKey,
                    seasons: mergedSeasons,
                  };
                }
                if (!isEarlyRuIedem) {
                  // Foreign series: DO NOT load iEdem Russian stream! Only save merged seasons for episode navigation
                  return prev
                    ? { ...prev, seasons: mergedSeasons }
                    : { ok: false, type: 'series', seasons: mergedSeasons };
                }
                if (
                  prev?.audioNames &&
                  findExplicitOriginalAudioTrackIndex(prev.audioNames) >= 0
                ) {
                  return { ...prev, seasons: mergedSeasons };
                }
                return {
                  ok: Boolean(streamTarget),
                  type: 'series',
                  season: iedemCardSeason,
                  episode: chosenEp?.episode || selectedEpisode,
                  sourcePath: `iEdem Mediateka VIP • ${iedemQualityLabel}`,
                  title: chosenEp?.title || activeVodItem.name,
                  hlsUrl: streamTarget
                    ? `/api/tv-proxy?url=${encodeURIComponent(streamTarget)}`
                    : undefined,
                  audioNames: [`Русский (iEdem VIP • ${iedemQualityLabel})`],
                  seasons: mergedSeasons,
                };
              });
            } else {
              const directTarget =
                detail.variants?.['2160'] ||
                detail.variants?.['4k'] ||
                detail.variants?.['1080'] ||
                detail.url ||
                detail.variants?.['auto'] ||
                activeVodItem.iedemStreamUrl ||
                '';
              if (
                directTarget &&
                isEarlyRuIedem &&
                (activeVodItem.type !== 'series' || selectedEpisode === 1)
              ) {
                setResolvedDirectStream((prev) => {
                  if (
                    prev?.audioNames &&
                    findExplicitOriginalAudioTrackIndex(prev.audioNames) >= 0
                  ) {
                    return prev;
                  }
                  return {
                    ok: true,
                    type: 'movie',
                    sourcePath: `iEdem Mediateka VIP • ${iedemQualityLabel}`,
                    title: activeVodItem.name,
                    hlsUrl: `/api/tv-proxy?url=${encodeURIComponent(directTarget)}`,
                    audioNames: [`Русский (iEdem VIP • ${iedemQualityLabel})`],
                  };
                });
              }
            }
          })
          .catch(() => { })
          .finally(() => {
            if (!cancelled) setIsDirectStreamLoading(false);
          });
      }

      // Enrich iEdem item with Kinopoisk + Cinemeta metadata AND resolve Original English streams (Kinogram Multi-Audio + FileList.io + VidSpark)
      const searchCleanTitle = activeVodItem.name
        .replace(/\(\d{4}\)/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/4K|UHD|HDR|FHD|1080p/gi, '')
        .replace(/[.\s-]*Сезон\s*\d+\.?/gi, '')
        .replace(/[.\s-]*Выпуск\s*\d+\.?/gi, '')
        .replace(/[.\s-]+$/g, '')
        .trim();
      if (searchCleanTitle) {
        const targetYear = (activeVodItem.releaseInfo || activeVodItem.year || '').slice(0, 4);
        const normCleanTitle = searchCleanTitle
          .toLowerCase()
          .replace(/ё/g, 'е')
          .replace(/[^\p{L}\p{N}]+/gu, '');

        // Resolve Kinozal VIP 4K/1080p Russian torrent immediately in parallel (Priority #1 for Russian Movies & Series, Priority #2 after VK Видео for Russian TV Shows)
        if (isLocalHomeServer()) {
          setIsFileListStreamLoading(true);
          const isLikelyForeign =
            /[a-zA-Z]{2,}/.test(activeVodItem.name || '') ||
            /[a-zA-Z]{2,}/.test(activeVodItem.nameOriginal || '') ||
            !isRussianVodItem(activeVodItem);
          const earlyFlParams = new URLSearchParams({
            q: searchCleanTitle,
            year: targetYear,
            type: activeVodItem.type,
            ...(activeVodItem.type === 'series'
              ? { s: String(selectedSeason), e: String(selectedEpisode) }
              : {}),
            ru: isLikelyForeign ? '0' : '1',
          });
          if (userSelectedFlTorrentIdRef.current) {
            earlyFlParams.set('id', String(userSelectedFlTorrentIdRef.current));
            earlyFlParams.set('strictId', '1');
          }
          fetch(buildFileListApiUrl(`/api/filelist/resolve?${earlyFlParams.toString()}`))
            .then((r) => (r.ok ? r.json() : null))
            .then((rawFlData: ResolvedFileListStream | null) => {
              const flData = normalizeFileListResolveData(rawFlData);
              if (cancelled) return;
              iedemFlOk = Boolean(flData?.ok && flData.streamUrl);
              if (flData) {
                setResolvedFileListStream((prev) => {
                  if (
                    userSelectedFlTorrentIdRef.current &&
                    prev?.ok &&
                    prev.torrentId === userSelectedFlTorrentIdRef.current
                  ) {
                    return prev;
                  }
                  return !flData.ok && prev?.ok && prev.streamUrl ? prev : flData;
                });
              }
              if (
                userManuallySelectedServerRef.current ||
                userSelectedFlTorrentIdRef.current !== null
              ) {
                return;
              }
              if (!isEarlyRuIedem) {
                // Foreign content: Keep filelist_torrent!
                setActiveServer('filelist_torrent');
              } else if (!isRuTvShowIedem) {
                if (iedemFlOk && canUseLocalTorrent) {
                  setActiveServer('filelist_torrent');
                } else {
                  setActiveServer('kinogram_hls');
                }
              } else if (!iedemVkDirectOk && iedemVkFinished) {
                setActiveServer(
                  iedemFlOk && canUseLocalTorrent
                    ? 'filelist_torrent'
                    : 'kinogram_hls'
                );
              }
            })
            .catch(() => {
              if (
                !cancelled &&
                !userManuallySelectedServerRef.current &&
                userSelectedFlTorrentIdRef.current === null
              ) {
                if (isEarlyRuIedem) {
                  setActiveServer('kinogram_hls');
                } else {
                  setActiveServer('filelist_torrent');
                }
              }
            })
            .finally(() => {
              if (!cancelled) setIsFileListStreamLoading(false);
            });
        }
        void (async () => {
          let foundKpId = activeVodItem.kpId || '';
          let resolvedImdb = '';
          let origName = '';
          let kpResolvedCountry = '';
          try {
            const kpSearchRes = await fetch(
              `https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(
                searchCleanTitle
              )}&page=1`,
              {
                headers: {
                  'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
                },
              }
            );
            const searchData = kpSearchRes.ok ? await kpSearchRes.json() : null;
            if (!cancelled && Array.isArray(searchData?.films) && searchData.films.length > 0) {
              const normF = (s?: string) =>
                String(s || '')
                  .toLowerCase()
                  .replace(/ё/g, 'е')
                  .replace(/[^\p{L}\p{N}]+/gu, '');
              const wantSeries = activeVodItem.type === 'series';
              const isSeriesFilm = (f: any) =>
                f?.type === 'TV_SERIES' ||
                f?.type === 'MINI_SERIES' ||
                f?.type === 'TV_SHOW';
              const matchesYr = (fy: any) => {
                if (!fy || fy === 'null') return false;
                if (!targetYear) return true;
                const py = Number(String(fy).slice(0, 4));
                const ty = Number(targetYear);
                return Number.isFinite(py) && Number.isFinite(ty) ? Math.abs(py - ty) <= 1 : true;
              };
              const matchedFilm =
                searchData.films.find(
                  (f: any) =>
                    normF(f.nameRu) === normCleanTitle &&
                    isSeriesFilm(f) === wantSeries &&
                    matchesYr(f.year)
                ) ||
                searchData.films.find(
                  (f: any) =>
                    normF(f.nameRu) === normCleanTitle &&
                    isSeriesFilm(f) === wantSeries &&
                    (!f.year || f.year === "null")
                ) ||
                searchData.films.find(
                  (f: any) =>
                    normF(f.nameRu) === normCleanTitle &&
                    isSeriesFilm(f) === wantSeries
                ) ||
                searchData.films.find(
                  (f: any) =>
                    normF(f.nameRu) === normCleanTitle &&
                    matchesYr(f.year)
                ) ||
                searchData.films.find(
                  (f: any) =>
                    normF(f.nameRu) === normCleanTitle &&
                    (!f.year || f.year === "null")
                );
              if (matchedFilm?.filmId) {
                foundKpId = String(matchedFilm.filmId);
                if (typeof matchedFilm.nameEn === 'string' && matchedFilm.nameEn.trim()) {
                  origName = matchedFilm.nameEn.trim();
                }
                const kpDetailRes = await fetch(
                  `https://kinopoiskapiunofficial.tech/api/v2.2/films/${foundKpId}`,
                  {
                    headers: {
                      'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
                    },
                  }
                );
                const kpData = kpDetailRes.ok ? await kpDetailRes.json() : null;
                if (!cancelled && kpData) {
                  if (typeof kpData.imdbId === 'string' && kpData.imdbId.startsWith('tt')) {
                    resolvedImdb = kpData.imdbId.trim();
                  }
                  if (typeof kpData.nameOriginal === 'string' && kpData.nameOriginal.trim()) {
                    origName = kpData.nameOriginal.trim();
                  } else if (typeof kpData.nameEn === 'string' && kpData.nameEn.trim()) {
                    origName = kpData.nameEn.trim();
                  }
                  const kpYearStr =
                    kpData.year && String(kpData.year) !== 'null'
                      ? String(kpData.year).slice(0, 4)
                      : matchedFilm.year && String(matchedFilm.year) !== 'null'
                        ? String(matchedFilm.year).slice(0, 4)
                        : undefined;
                  const countriesStr = Array.isArray(kpData.countries)
                    ? kpData.countries
                      .map((c: { country: string }) => c.country)
                      .filter(Boolean)
                      .join(', ')
                    : undefined;
                  if (countriesStr) {
                    kpResolvedCountry = countriesStr;
                  }
                  const genresArr = Array.isArray(kpData.genres)
                    ? kpData.genres
                      .map((g: { genre: string }) => g.genre)
                      .filter(Boolean)
                    : undefined;
                  const ageStr = kpData.ratingAgeLimits
                    ? `${String(kpData.ratingAgeLimits).replace(/^age/i, '')}+`
                    : undefined;
                  const runtimeStr = kpData.filmLength
                    ? `${kpData.filmLength} min`
                    : undefined;
                  setDetailedMeta((prev) => {
                    const base = prev || { ...sanitizedVodItem };
                    const hasTechnicalTorrentDesc = /Kinozal VIP|сидов|semințe|WEB-DL|WEBRip/i.test(
                      String(base.description || "")
                    );
                    return {
                      ...base,
                      kpId: foundKpId,
                      imdbId:
                        resolvedImdb ||
                        (base.id.startsWith("tt") ? base.id : undefined),
                      nameOriginal: origName || undefined,
                      releaseInfo: kpYearStr || base.releaseInfo,
                      year: kpYearStr || base.year,
                      poster:
                        kpData.posterUrl ||
                        kpData.posterUrlPreview ||
                        base.poster,
                      description:
                        hasTechnicalTorrentDesc
                          ? kpData.description ||
                          kpData.shortDescription ||
                          base.description
                          : base.description ||
                          kpData.description ||
                          kpData.shortDescription,
                      slogan: kpData.slogan || base.slogan,
                      ratingKinopoisk: kpData.ratingKinopoisk
                        ? String(kpData.ratingKinopoisk)
                        : base.ratingKinopoisk,
                      imdbRating: kpData.ratingImdb
                        ? String(kpData.ratingImdb)
                        : base.imdbRating,
                      country:
                        countriesStr ||
                        base.country ||
                        (origName ? undefined : "Россия"),
                      genres: genresArr?.length ? genresArr : base.genres,
                      ageRating: ageStr || base.ageRating,
                      runtime: runtimeStr || base.runtime,
                      background:
                        kpData.coverUrl ||
                        kpData.posterUrl ||
                        kpData.posterUrlPreview ||
                        base.poster,
                    };
                  });
                }
              }
            }
          } catch {
            // ignore KP error
          }

          if (cancelled) return;

          const isForeignIedemItem = !isRussianVodItem({
            ...activeVodItem,
            country: kpResolvedCountry || activeVodItem.country,
            nameOriginal: origName || activeVodItem.nameOriginal,
          });
          const iedemAudioPref: AudioTrackPreference = isForeignIedemItem
            ? tvSettings.defaultAudioPref === 'ro'
              ? 'ro'
              : 'original'
            : tvSettings.defaultAudioPref;

          // 1) Resolve multi-audio Kinogram / VK / iEdem multi-season stream (enriches all seasons + handles other seasons when user switches away from iedemCardSeason)
          if (foundKpId || resolvedImdb || origName || searchCleanTitle) {
            resolveDirectVodStreamClient({
              kp: foundKpId,
              imdb: resolvedImdb,
              title: origName || searchCleanTitle,
              type: activeVodItem.type,
              year: targetYear,
              season: selectedSeason,
              episode: selectedEpisode,
              ru: isForeignIedemItem ? '0' : '1',
            })
              .then((altDirect) => {
                if (
                  altDirect?.seasons?.length &&
                  lastResolvedItemKeyRef.current === itemKey
                ) {
                  const earlyMerged = mergeSeasonsLists(
                    cachedSeriesSeasonsRef.current.itemKey === itemKey
                      ? cachedSeriesSeasonsRef.current.seasons
                      : undefined,
                    altDirect.seasons
                  );
                  if (earlyMerged.length > 0) {
                    cachedSeriesSeasonsRef.current = {
                      itemKey,
                      seasons: earlyMerged,
                    };
                    if (cancelled) {
                      setResolvedDirectStream((prev) =>
                        prev
                          ? {
                            ...prev,
                            seasons: mergeSeasonsLists(prev.seasons, earlyMerged),
                          }
                          : { ok: false, type: "series", seasons: earlyMerged }
                      );
                    }
                  }
                }
                if (cancelled || !altDirect) return;
                const mergedSeasons = mergeSeasonsLists(
                  cachedSeriesSeasonsRef.current.itemKey === itemKey
                    ? cachedSeriesSeasonsRef.current.seasons
                    : undefined,
                  altDirect.seasons
                );
                if (mergedSeasons.length > 0) {
                  cachedSeriesSeasonsRef.current = {
                    itemKey,
                    seasons: mergedSeasons,
                  };
                }
                const enrichedAlt: ResolvedDirectVodStream =
                  mergedSeasons.length > 0
                    ? { ...altDirect, seasons: mergedSeasons }
                    : altDirect;
                iedemVkFinished = true;
                const hasPlayableAlt = Boolean(
                  enrichedAlt.ok && (enrichedAlt.hlsUrl || enrichedAlt.dashUrl)
                );
                if (hasPlayableAlt) {
                  iedemAltDirectStreamRef.current = enrichedAlt;
                }
                const isVkAlt =
                  hasPlayableAlt && isVkDirectSourcePath(enrichedAlt.sourcePath);
                if (isRuTvShowIedem && isVkAlt) {
                  iedemVkDirectOk = true;
                  setResolvedDirectStream(enrichedAlt);
                  if (
                    !userManuallySelectedServerRef.current &&
                    userSelectedFlTorrentIdRef.current === null
                  ) {
                    setActiveServer('kinogram_hls');
                  }
                  setIsDirectStreamLoading(false);
                  return;
                }
                if (
                  isRuTvShowIedem &&
                  !isVkAlt &&
                  iedemFlOk &&
                  canUseLocalTorrent &&
                  !userManuallySelectedServerRef.current &&
                  userSelectedFlTorrentIdRef.current === null
                ) {
                  setActiveServer('filelist_torrent');
                }
                const origIdx = findExplicitOriginalAudioTrackIndex(
                  enrichedAlt.audioNames || []
                );
                if (!isMatchingIedemCardSeason) {
                  setResolvedDirectStream(enrichedAlt);
                  if (hasPlayableAlt) {
                    const prefIdx =
                      (isForeignIedemItem ||
                        userRequestedOriginalAudioRef.current) &&
                        origIdx >= 0
                        ? origIdx
                        : resolveAudioTrackIndexByPreference(
                          enrichedAlt.audioNames || [],
                          iedemAudioPref
                        );
                    setSelectedAudioTrackIdx(prefIdx);
                    if (
                      !(!isRuTvShowIedem && iedemFlOk && canUseLocalTorrent) &&
                      !userManuallySelectedServerRef.current
                    ) {
                      setActiveServer('kinogram_hls');
                    }
                  }
                  setIsDirectStreamLoading(false);
                } else if (
                  hasPlayableAlt &&
                  (isForeignIedemItem ||
                    userRequestedOriginalAudioRef.current) &&
                  origIdx >= 0
                ) {
                  setResolvedDirectStream(enrichedAlt);
                  setSelectedAudioTrackIdx(origIdx);
                  if (
                    userRequestedOriginalAudioRef.current ||
                    (!(!isRuTvShowIedem && iedemFlOk && canUseLocalTorrent) &&
                      !userManuallySelectedServerRef.current)
                  ) {
                    setActiveServer('kinogram_hls');
                  }
                } else if (hasPlayableAlt && isEarlyRuIedem) {
                  setResolvedDirectStream((prev) =>
                    prev?.ok && prev.hlsUrl && prev.episode === selectedEpisode
                      ? { ...prev, seasons: mergedSeasons }
                      : enrichedAlt
                  );
                  if (
                    !userManuallySelectedServerRef.current &&
                    !(!isRuTvShowIedem && iedemFlOk && canUseLocalTorrent)
                  ) {
                    setActiveServer('kinogram_hls');
                  }
                } else if (mergedSeasons.length > 0) {
                  setResolvedDirectStream((prev) =>
                    prev
                      ? {
                        ...prev,
                        seasons: mergeSeasonsLists(
                          prev.seasons,
                          mergedSeasons
                        ),
                      }
                      : {
                        ok: false,
                        type: 'series',
                        seasons: mergedSeasons,
                      }
                  );
                }
              })
              .catch(() => {
                iedemVkFinished = true;
                if (!cancelled && !isMatchingIedemCardSeason) {
                  setIsDirectStreamLoading(false);
                }
                if (
                  !cancelled &&
                  isRuTvShowIedem &&
                  iedemFlOk &&
                  canUseLocalTorrent &&
                  !userManuallySelectedServerRef.current &&
                  userSelectedFlTorrentIdRef.current === null
                ) {
                  setActiveServer('filelist_torrent');
                }
              });
          } else {
            iedemVkFinished = true;
            if (!isMatchingIedemCardSeason) {
              setIsDirectStreamLoading(false);
            }
          }

          // 2) If Kinopoisk unlocked a foreign/IMDB ID and early Kinozal search didn't match yet (or foreign item needs FileList.io original stream), enrich with FileList.io by IMDb ID
          if (
            isLocalHomeServer() &&
            resolvedImdb &&
            (!iedemFlOk || isForeignIedemItem)
          ) {
            setIsFileListStreamLoading(true);
            const flParams = new URLSearchParams({
              imdb: resolvedImdb,
              q: origName || searchCleanTitle,
              year: targetYear,
              type: activeVodItem.type,
              ...(activeVodItem.type === 'series'
                ? { s: String(selectedSeason), e: String(selectedEpisode) }
                : {}),
              ru: isForeignIedemItem ? '0' : '1',
            });
            fetch(buildFileListApiUrl(`/api/filelist/resolve?${flParams.toString()}`))
              .then((r) => (r.ok ? r.json() : null))
              .then((rawFlData: ResolvedFileListStream | null) => {
                const flData = normalizeFileListResolveData(rawFlData);
                if (cancelled) return;
                if (flData) {
                  if (flData.ok && flData.streamUrl) {
                    iedemFlOk = true;
                  }
                  setResolvedFileListStream((prev) => {
                    if (
                      userSelectedFlTorrentIdRef.current &&
                      prev?.ok &&
                      prev.torrentId === userSelectedFlTorrentIdRef.current
                    ) {
                      return prev;
                    }
                    return !flData.ok && prev?.ok && prev.streamUrl ? prev : flData;
                  });
                  if (
                    flData.ok &&
                    flData.streamUrl &&
                    canUseLocalTorrent &&
                    !userManuallySelectedServerRef.current &&
                    userSelectedFlTorrentIdRef.current === null &&
                    (!isRuTvShowIedem || (!iedemVkDirectOk && iedemVkFinished))
                  ) {
                    setActiveServer('filelist_torrent');
                  } else if (
                    userRequestedOriginalAudioRef.current &&
                    flData.ok &&
                    flData.streamUrl &&
                    !(
                      iedemAltDirectStreamRef.current?.ok &&
                      findExplicitOriginalAudioTrackIndex(
                        iedemAltDirectStreamRef.current.audioNames || []
                      ) >= 0
                    )
                  ) {
                    setActiveServer('filelist_torrent');
                  }
                }
              })
              .catch(() => { })
              .finally(() => {
                if (!cancelled) setIsFileListStreamLoading(false);
              });
          }

          // 3) Auto-fetch Romanian / English subtitles for Original audio playback
          if (resolvedImdb && tvSettings.defaultSubLang !== 'off') {
            autoResolveAndFetchBestRoRuSubtitle({
              imdbId: resolvedImdb,
              type: activeVodItem.type,
              season: selectedSeason,
              episode: selectedEpisode,
              preferredLang:
                tvSettings.defaultSubLang === 'en'
                  ? 'en'
                  : tvSettings.defaultSubLang === 'ru'
                    ? 'ru'
                    : 'ro',
            })
              .then((subRes) => {
                if (cancelled || !subRes || usingMkvLiveSubRef.current || userDisabledSubRef.current) return;
                setActiveSubVttUrl(subRes.vttBlobUrl);
                setActiveSubLabel(subRes.track.langLabel);
                setActiveSubCues(subRes.cues);
              })
              .catch(() => { });
          }
        })();
      }

      return () => {
        cancelled = true;
      };
    }

    const kp =
      activeVodItem.kpId ||
      (activeVodItem.id.startsWith('kp_')
        ? activeVodItem.id.replace(/^kp_/, '')
        : '');
    const rawImdbFromItem = String(
      (activeVodItem as { imdbId?: string; imdb_id?: string }).imdbId ||
      (activeVodItem as { imdbId?: string; imdb_id?: string }).imdb_id ||
      ''
    ).trim();
    const imdb = activeVodItem.id.startsWith('tt')
      ? activeVodItem.id.split(':')[0]
      : rawImdbFromItem.startsWith('tt')
        ? rawImdbFromItem.split(':')[0]
        : '';

    if (imdb) {
      const isRuItemForCinemeta = isRussianVodItem(sanitizedVodItem);
      fetch(
        `https://v3-cinemeta.strem.io/meta/${activeVodItem.type}/${imdb}.json`
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled && d?.meta) {
            setDetailedMeta((prev) =>
              isRuItemForCinemeta
                ? {
                  ...prev,
                  poster: prev?.poster || d.meta.poster,
                  background: prev?.background || d.meta.background,
                  imdbRating: prev?.imdbRating || d.meta.imdbRating,
                  imdbId: imdb,
                  kpId: kp || prev?.kpId,
                }
                : {
                  ...prev,
                  ...d.meta,
                  imdbId: imdb,
                  kpId: kp || prev?.kpId,
                }
            );
          }
        })
        .catch(() => { });
    } else if (!kp && activeVodItem.name && isRussianVodItem(activeVodItem)) {
      void resolveIedemKinopoiskMeta({
        fid: 0,
        title: activeVodItem.name,
        year: Number((activeVodItem.releaseInfo || '2026').slice(0, 4)) || 2026,
        type: activeVodItem.type === 'series' ? 'multistream' : 'stream',
        img: activeVodItem.poster || '',
      }).then((meta) => {
        if (cancelled || !meta) return;
        const resolvedKpIdStr = meta.kpId ? String(meta.kpId) : undefined;
        setDetailedMeta((prev) => {
          const base = prev || { ...activeVodItem };
          return {
            ...base,
            kpId: resolvedKpIdStr || base.kpId,
            poster: meta.posterUrl || base.poster,
            background: meta.posterUrl || base.background,
            ratingKinopoisk: meta.ratingKinopoisk || base.ratingKinopoisk,
            country: base.country || 'Россия',
          };
        });
        if (resolvedKpIdStr) {
          fetch(`https://kinopoiskapiunofficial.tech/api/v2.2/films/${resolvedKpIdStr}`, {
            headers: {
              'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
            },
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((kpData) => {
              if (cancelled || !kpData) return;
              const countriesStr = Array.isArray(kpData.countries)
                ? kpData.countries
                  .map((c: { country: string }) => c.country)
                  .filter(Boolean)
                  .join(', ')
                : undefined;
              const genresArr = Array.isArray(kpData.genres)
                ? kpData.genres
                  .map((g: { genre: string }) => g.genre)
                  .filter(Boolean)
                : undefined;
              setDetailedMeta((prev) => {
                const base = prev || { ...sanitizedVodItem };
                const hasTechnicalTorrentDesc = /Kinozal VIP|сидов|semințe|WEB-DL|WEBRip/i.test(
                  String(base.description || "")
                );
                return {
                  ...base,
                  kpId: resolvedKpIdStr,
                  poster:
                    kpData.posterUrl ||
                    kpData.posterUrlPreview ||
                    meta.posterUrl ||
                    base.poster,
                  background:
                    kpData.coverUrl ||
                    kpData.posterUrl ||
                    kpData.posterUrlPreview ||
                    meta.posterUrl ||
                    base.poster,
                  description:
                    hasTechnicalTorrentDesc
                      ? kpData.description ||
                      kpData.shortDescription ||
                      base.description
                      : base.description ||
                      kpData.description ||
                      kpData.shortDescription,
                  ratingKinopoisk: kpData.ratingKinopoisk
                    ? String(kpData.ratingKinopoisk)
                    : base.ratingKinopoisk,
                  imdbRating: kpData.ratingImdb
                    ? String(kpData.ratingImdb)
                    : base.imdbRating,
                  country: countriesStr || base.country || 'Россия',
                  genres: genresArr?.length ? genresArr : base.genres,
                };
              });
            })
            .catch(() => { });
          if (activeVodItem.type === 'series') {
            fetch(`https://kinopoiskapiunofficial.tech/api/v2.2/films/${resolvedKpIdStr}/seasons`, {
              headers: {
                'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
              },
            })
              .then((r) => (r.ok ? r.json() : null))
              .then((kpSeasonsData) => {
                if (cancelled || !Array.isArray(kpSeasonsData?.items) || kpSeasonsData.items.length === 0) {
                  return;
                }
                const kpVideos: SeriesEpisode[] = [];
                for (const sItem of kpSeasonsData.items) {
                  const sNum = Number(sItem?.number);
                  if (!sNum || sNum <= 0 || !Array.isArray(sItem?.episodes)) continue;
                  for (const epItem of sItem.episodes) {
                    const epNum = Number(epItem?.episodeNumber);
                    if (!epNum || epNum <= 0) continue;
                    kpVideos.push({
                      id: `kp_ep_${sNum}_${epNum}`,
                      season: sNum,
                      episode: epNum,
                      name: String(epItem.nameRu || epItem.nameEn || '').trim(),
                      overview: String(epItem.synopsis || '').trim() || undefined,
                      released: epItem.releaseDate ? String(epItem.releaseDate) : undefined,
                    });
                  }
                }
                if (kpVideos.length > 0) {
                  setDetailedMeta((prev) => {
                    const base = prev || { ...activeVodItem };
                    return {
                      ...base,
                      videos: Array.isArray(base.videos) && base.videos.length > kpVideos.length ? base.videos : kpVideos,
                    };
                  });
                }
              })
              .catch(() => { });
          }
        }
      });
    } else if (!kp && activeVodItem.name && !isRussianVodItem(activeVodItem)) {
      const cleanName = activeVodItem.name
        .replace(/\(\d{4}\)/g, '')
        .replace(/\bS\d{1,2}.*$/i, '')
        .trim();
      if (cleanName.length >= 2) {
        fetch(
          `https://v3-cinemeta.strem.io/catalog/${activeVodItem.type}/top/search=${encodeURIComponent(
            cleanName
          )}.json`
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((searchRes) => {
            const firstMatch = searchRes?.metas?.[0];
            const foundTt =
              firstMatch?.id && String(firstMatch.id).startsWith('tt')
                ? String(firstMatch.id)
                : '';
            if (!cancelled && foundTt) {
              setDetailedMeta((prev) =>
                prev ? { ...prev, imdbId: prev.imdbId || foundTt } : prev
              );
              return fetch(
                `https://v3-cinemeta.strem.io/meta/${activeVodItem.type}/${foundTt}.json`
              )
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => {
                  if (!cancelled && d?.meta) {
                    setDetailedMeta((prev) => ({
                      ...prev,
                      ...d.meta,
                      imdbId: foundTt,
                    }));
                  }
                });
            }
          })
          .catch(() => { });
      }
    }

    const isRoVod = isRomanianVodItem(activeVodItem);
    let isForeignVod = !isRoVod && !isRussianVodItem(activeVodItem);
    let isRuTvShow = !isRoVod && isRussianTvShowItem(activeVodItem);
    let directResolvedOk = false;
    let directResolvedSourcePath = '';
    let directIsVk = false;
    let directFinished = false;
    let flResolvedOk = false;
    let flFinished = !isLocalHomeServer() && !isLocalBridgeProbePending();

    const syncPreferredVodServer = (prefTrackIdx?: number) => {
      if (
        userManuallySelectedServerRef.current ||
        userSelectedFlTorrentIdRef.current !== null
      ) {
        return;
      }
      const canUseLocalTorrent =
        isLocalHomeServer() &&
        (tvSettings.defaultVodServer === 'auto_best' ||
          tvSettings.defaultVodServer === 'filelist_torrent');

      if (isRoVod) {
        const directIsFullHdPlus = /1080p|2160p|4k|uhd/i.test(
          directResolvedSourcePath
        );
        const preferFlOnLan =
          canUseLocalTorrent &&
          flResolvedOk &&
          (watchProgressMap[itemKey]?.server === 'filelist_torrent' ||
            !directResolvedOk ||
            !directIsFullHdPlus);
        if (preferFlOnLan) {
          setActiveServer('filelist_torrent');
          return;
        }
        // Fallback/Cloud: 1) România Cloud HD (Vidmoly direct) -> 2) FileList.io RO Torrent
        if (directResolvedOk) {
          setActiveServer('kinogram_hls');
          return;
        }
        if (directFinished && canUseLocalTorrent && (flResolvedOk || !flFinished)) {
          setActiveServer('filelist_torrent');
          return;
        }
        setActiveServer('kinogram_hls');
        return;
      }

      if (isRuTvShow) {
        // Russian TV Shows: 1) VK Видео Direct (4K/1080p) -> 2) Kinozal VIP Torrent -> 3) iEdem MediaLibrary
        if (directIsVk || !directFinished) {
          if (typeof prefTrackIdx === 'number' && prefTrackIdx >= 0) {
            setSelectedAudioTrackIdx(prefTrackIdx);
          }
          setActiveServer('kinogram_hls');
          return;
        }
        if (canUseLocalTorrent && (flResolvedOk || !flFinished)) {
          setActiveServer('filelist_torrent');
          return;
        }
        if (typeof prefTrackIdx === 'number' && prefTrackIdx >= 0) {
          setSelectedAudioTrackIdx(prefTrackIdx);
        }
        setActiveServer('kinogram_hls');
        return;
      }

      // Prefer FileList on LAN Home Server for foreign content; on Cloud LTE/Mobile default to Direct HLS if available
      if (isForeignVod) {
        setActiveServer(
          canUseLocalTorrent
            ? 'filelist_torrent'
            : directResolvedOk
              ? 'kinogram_hls'
              : 'filelist_torrent'
        );
        return;
      }

      // Russian Movies & Series (Kinozal VIP #1 -> iEdem #2)
      if (canUseLocalTorrent && (flResolvedOk || !flFinished)) {
        setActiveServer('filelist_torrent');
        return;
      }
      if (directResolvedOk) {
        if (isForeignVod) {
          const hasOrigAudio =
            resolvedDirectStream?.audioNames &&
            findExplicitOriginalAudioTrackIndex(resolvedDirectStream.audioNames) >= 0;
          if (isVkDirectSourcePath(resolvedDirectStream?.sourcePath) || !hasOrigAudio) {
            if (canUseLocalTorrent) {
              setActiveServer('filelist_torrent');
              return;
            }
          }
        }
        if (typeof prefTrackIdx === 'number' && prefTrackIdx >= 0) {
          setSelectedAudioTrackIdx(prefTrackIdx);
        }
        setActiveServer('kinogram_hls');
        return;
      }
      setActiveServer(canUseLocalTorrent ? 'filelist_torrent' : 'kinogram_hls');
    };

    if (kp && !(Number(kp) >= 9001000 && Number(kp) <= 9001999)) {
      fetch(`https://kinopoiskapiunofficial.tech/api/v2.2/films/${kp}`, {
        headers: {
          'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
        },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((kpData) => {
          if (!cancelled && kpData) {
            setDetailedMeta((prev) => {
              const base = prev || { ...activeVodItem };
              const resolvedImdb =
                typeof kpData.imdbId === 'string' &&
                  kpData.imdbId.startsWith('tt')
                  ? kpData.imdbId
                  : base.imdbId || imdb;
              const countriesStr = Array.isArray(kpData.countries)
                ? kpData.countries
                  .map((c: { country: string }) => c.country)
                  .filter(Boolean)
                  .join(', ')
                : base.country;
              const genresArr = Array.isArray(kpData.genres)
                ? kpData.genres
                  .map((g: { genre: string }) => g.genre)
                  .filter(Boolean)
                : base.genres;
              const ageStr = kpData.ratingAgeLimits
                ? `${String(kpData.ratingAgeLimits).replace(/^age/i, '')}+`
                : base.ageRating;
              const runtimeStr = kpData.filmLength
                ? `${kpData.filmLength} min`
                : base.runtime;
              const origName =
                kpData.nameOriginal || kpData.nameEn || base.nameOriginal;
              const isRuKpForTitle = isRussianVodItem({
                ...base,
                kpId: String(kp),
                country: countriesStr,
                nameOriginal: origName,
              });
              return {
                ...base,
                name: isRuKpForTitle
                  ? kpData.nameRu && !/[а-яёА-ЯЁ]/i.test(base.name || '')
                    ? kpData.nameRu
                    : base.name || kpData.nameRu
                  : !base.id.startsWith('kp_') &&
                      !base.id.startsWith('kinozal_') &&
                      uiLang !== 'ru' &&
                      origName
                    ? origName
                    : base.name,
                imdbId: resolvedImdb,
                nameOriginal: origName,
                description:
                  uiLang === 'ru'
                    ? kpData.description ||
                    kpData.shortDescription ||
                    base.description
                    : base.description ||
                    kpData.description ||
                    kpData.shortDescription,
                slogan:
                  uiLang === 'ru'
                    ? kpData.slogan || base.slogan
                    : base.slogan,
                ratingKinopoisk: kpData.ratingKinopoisk
                  ? String(kpData.ratingKinopoisk)
                  : base.ratingKinopoisk,
                imdbRating: kpData.ratingImdb
                  ? String(kpData.ratingImdb)
                  : base.imdbRating,
                country:
                  uiLang === 'ru'
                    ? countriesStr || base.country
                    : base.country || countriesStr,
                genres:
                  uiLang === 'ru'
                    ? genresArr?.length
                      ? genresArr
                      : base.genres
                    : base.genres?.length
                      ? base.genres
                      : genresArr,
                ageRating: ageStr,
                runtime: runtimeStr,
                poster:
                  base.id.startsWith('kp_')
                    ? base.poster || kpData.posterUrl || kpData.posterUrlPreview
                    : uiLang === 'ru'
                      ? kpData.posterUrl || kpData.posterUrlPreview || base.poster
                      : resolvedImdb
                        ? `https://images.metahub.space/poster/medium/${resolvedImdb}/img`
                        : base.poster || kpData.posterUrl || kpData.posterUrlPreview,
                background:
                  kpData.coverUrl ||
                  kpData.posterUrl ||
                  kpData.posterUrlPreview ||
                  base.background,
              };
            });

            const kpCountriesStr = Array.isArray(kpData.countries)
              ? kpData.countries
                .map((c: { country: string }) => c.country)
                .filter(Boolean)
                .join(', ')
              : activeVodItem.country;
            const kpOrigName =
              kpData.nameOriginal || kpData.nameEn || activeVodItem.nameOriginal;
            const kpGenresArr = Array.isArray(kpData.genres)
              ? kpData.genres
                .map((g: { genre: string }) => g.genre)
                .filter(Boolean)
              : activeVodItem.genres;
            isForeignVod = !isRussianVodItem({
              ...activeVodItem,
              country: kpCountriesStr,
              nameOriginal: kpOrigName,
            });
            isRuTvShow = isRussianTvShowItem({
              ...activeVodItem,
              country: kpCountriesStr,
              nameOriginal: kpOrigName,
              genres: kpGenresArr,
            });
            syncPreferredVodServer();

            // If item was opened by Kinopoisk ID (no initial 'tt'), enrich Cinemeta + Direct Original Stream + FileList + Subtitles using resolved IMDb ID OR Latin original title
            const resolvedTt =
              typeof kpData.imdbId === 'string' && kpData.imdbId.startsWith('tt')
                ? kpData.imdbId
                : '';
            const resolvedLatinTitle = (
              kpData.nameOriginal ||
              kpData.nameEn ||
              ''
            ).trim();
            const kpYearStr = String(
              kpData.year || activeVodItem.releaseInfo || ''
            ).slice(0, 4);

            const applyCinemetaEnrichment = (ttId: string) => {
              fetch(
                `https://v3-cinemeta.strem.io/meta/${activeVodItem.type}/${ttId}.json`
              )
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => {
                  if (!cancelled && d?.meta) {
                    setDetailedMeta((prev) => ({
                      ...prev,
                      ...d.meta,
                      name:
                        !isForeignVod || uiLang === 'ru'
                          ? kpData.nameRu || prev?.name || d.meta.name
                          : d.meta.name || prev?.nameOriginal || prev?.name,
                      poster:
                        !isForeignVod || uiLang === 'ru'
                          ? kpData.posterUrl ||
                          kpData.posterUrlPreview ||
                          prev?.poster ||
                          d.meta.poster
                          : d.meta.poster ||
                          `https://images.metahub.space/poster/medium/${ttId}/img`,
                      description:
                        uiLang !== 'ru'
                          ? d.meta.description || prev?.description
                          : prev?.description || d.meta.description,
                      country:
                        uiLang !== 'ru'
                          ? d.meta.country || prev?.country
                          : prev?.country || d.meta.country,
                      genres:
                        uiLang !== 'ru'
                          ? d.meta.genres || prev?.genres
                          : prev?.genres || d.meta.genres,
                      videos: d.meta.videos || prev?.videos,
                      cast: d.meta.cast || prev?.cast,
                      director: d.meta.director || prev?.director,
                      imdbId: ttId,
                      kpId: kp || prev?.kpId,
                    }));
                  }
                })
                .catch(() => { });
            };

            if (!imdb && (resolvedTt || resolvedLatinTitle)) {
              if (isForeignVod) {
                resolveDirectVodStreamClient({
                  imdb: resolvedTt || undefined,
                  kp,
                  title: resolvedLatinTitle || activeVodItem.name,
                  type: activeVodItem.type,
                  year: kpYearStr,
                  season: selectedSeason,
                  episode: selectedEpisode,
                  ru: '0',
                })
                  .then((upgradedDirect) => {
                    if (cancelled || !upgradedDirect?.ok) return;
                    const upgradedOrigIdx = findExplicitOriginalAudioTrackIndex(
                      upgradedDirect.audioNames || []
                    );
                    if (upgradedOrigIdx >= 0) {
                      setResolvedDirectStream((prev) => {
                        const prevOrigIdx = findExplicitOriginalAudioTrackIndex(
                          prev?.audioNames || []
                        );
                        if (prev?.ok && prevOrigIdx >= 0) {
                          return prev;
                        }
                        const merged = mergeSeasonsLists(
                          prev?.seasons,
                          upgradedDirect.seasons
                        );
                        return merged.length > 0
                          ? { ...upgradedDirect, seasons: merged }
                          : upgradedDirect;
                      });
                      setSelectedAudioTrackIdx((prevIdx) =>
                        prevIdx >= 0 ? prevIdx : upgradedOrigIdx
                      );
                    }
                  })
                  .catch(() => { });
              }

              if (isForeignVod && resolvedTt) {
                applyCinemetaEnrichment(resolvedTt);
              } else if (isForeignVod && resolvedLatinTitle) {
                fetch(
                  `https://v3-cinemeta.strem.io/catalog/${activeVodItem.type}/top/search=${encodeURIComponent(resolvedLatinTitle)}.json`
                )
                  .then((r) => (r.ok ? r.json() : null))
                  .then(
                    (searchData: {
                      metas?: Array<{
                        id?: string;
                        name?: string;
                        releaseInfo?: string;
                        year?: string | number;
                      }>;
                    } | null) => {
                      if (cancelled || !Array.isArray(searchData?.metas)) return;
                      const normTarget = resolvedLatinTitle
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '');
                      const targetYr = parseInt(kpYearStr, 10) || 0;
                      const bestMeta =
                        searchData.metas.find((m) => {
                          if (!m?.id?.startsWith('tt')) return false;
                          const normName = String(m.name || '')
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '');
                          if (normName !== normTarget) return false;
                          if (!targetYr) return true;
                          const mYr =
                            parseInt(
                              String(m.year || m.releaseInfo || '').slice(0, 4),
                              10
                            ) || 0;
                          return !mYr || Math.abs(mYr - targetYr) <= 1;
                        }) ||
                        searchData.metas.find((m) => {
                          if (!m?.id?.startsWith('tt')) return false;
                          const normName = String(m.name || '')
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '');
                          return normName === normTarget;
                        });
                      if (bestMeta?.id) {
                        applyCinemetaEnrichment(bestMeta.id);
                      }
                    }
                  )
                  .catch(() => { });
              }

              if (isForeignVod && isLocalHomeServer()) {
                setIsFileListStreamLoading(true);
                const extraFlParams = new URLSearchParams({
                  type: activeVodItem.type,
                  ...(activeVodItem.type === 'series'
                    ? { s: String(selectedSeason), e: String(selectedEpisode) }
                    : {}),
                  q: resolvedLatinTitle || activeVodItem.name || '',
                });
                if (resolvedTt) {
                  extraFlParams.set('imdb', resolvedTt);
                }
                if (userSelectedFlTorrentIdRef.current) {
                  extraFlParams.set(
                    'id',
                    String(userSelectedFlTorrentIdRef.current)
                  );
                }
                fetch(buildFileListApiUrl(`/api/filelist/resolve?${extraFlParams.toString()}`))
                  .then((r) => (r.ok ? r.json() : null))
                  .then((rawFlData: ResolvedFileListStream | null) => {
                    const flData = normalizeFileListResolveData(rawFlData);
                    if (cancelled) return;
                    flFinished = true;
                    if (flData?.ok) {
                      flResolvedOk = true;
                      setResolvedFileListStream((prev) => {
                        if (
                          userSelectedFlTorrentIdRef.current &&
                          prev?.ok &&
                          prev.torrentId === userSelectedFlTorrentIdRef.current
                        ) {
                          return {
                            ...prev,
                            torrents:
                              flData.torrents && flData.torrents.length > 0
                                ? flData.torrents
                                : prev.torrents,
                          };
                        }
                        return flData;
                      });
                      if (!userManuallySelectedServerRef.current && !isRuTvShow) {
                        setActiveServer('filelist_torrent');
                      } else {
                        syncPreferredVodServer();
                      }
                    } else if (flData) {
                      setResolvedFileListStream((prev) =>
                        prev?.ok && prev.streamUrl ? prev : flData
                      );
                      syncPreferredVodServer();
                    }
                  })
                  .catch(() => { })
                  .finally(() => {
                    if (!cancelled) setIsFileListStreamLoading(false);
                  });
              }

              if (tvSettings.defaultSubLang !== 'off') {
                autoResolveAndFetchBestRoRuSubtitle({
                  imdbId: resolvedTt || undefined,
                  title: resolvedLatinTitle || activeVodItem.name,
                  nameOriginal: resolvedLatinTitle || undefined,
                  type: activeVodItem.type,
                  season: selectedSeason,
                  episode: selectedEpisode,
                  preferredLang: tvSettings.defaultSubLang,
                })
                  .then((subRes) => {
                    if (cancelled || !subRes || usingMkvLiveSubRef.current || userDisabledSubRef.current) return;
                    setActiveSubVttUrl(subRes.vttBlobUrl);
                    setActiveSubLabel(subRes.track.langLabel);
                    setActiveSubCues(subRes.cues);
                  })
                  .catch(() => { });
              }
            }
          }
        })
        .catch(() => { });
      if (activeVodItem.type === 'series') {
        fetch(`https://kinopoiskapiunofficial.tech/api/v2.2/films/${kp}/seasons`, {
          headers: {
            'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
          },
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((kpSeasonsData) => {
            if (cancelled || !Array.isArray(kpSeasonsData?.items) || kpSeasonsData.items.length === 0) {
              return;
            }
            const kpVideos: SeriesEpisode[] = [];
            for (const sItem of kpSeasonsData.items) {
              const sNum = Number(sItem?.number);
              if (!sNum || sNum <= 0 || !Array.isArray(sItem?.episodes)) continue;
              for (const epItem of sItem.episodes) {
                const epNum = Number(epItem?.episodeNumber);
                if (!epNum || epNum <= 0) continue;
                kpVideos.push({
                  id: `kp_ep_${sNum}_${epNum}`,
                  season: sNum,
                  episode: epNum,
                  name: String(epItem.nameRu || epItem.nameEn || '').trim(),
                  overview: String(epItem.synopsis || '').trim() || undefined,
                  released: epItem.releaseDate ? String(epItem.releaseDate) : undefined,
                });
              }
            }
            if (kpVideos.length > 0) {
              setDetailedMeta((prev) => {
                const base = prev || { ...activeVodItem };
                const existingVids = Array.isArray(base.videos) ? base.videos : [];
                const mergedMap = new Map<string, SeriesEpisode>();
                for (const kv of kpVideos) {
                  mergedMap.set(`${kv.season}_${kv.episode}`, kv);
                }
                for (const ev of existingVids) {
                  const sN = Number(ev.season);
                  const eN = Number(ev.episode ?? ev.number);
                  if (!sN || !eN) continue;
                  const key = `${sN}_${eN}`;
                  const prevKp = mergedMap.get(key);
                  mergedMap.set(key, {
                    ...prevKp,
                    ...ev,
                    season: sN,
                    episode: eN,
                    name: ev.name || prevKp?.name || '',
                    overview: ev.overview || ev.description || prevKp?.overview,
                  });
                }
                return {
                  ...base,
                  videos: Array.from(mergedMap.values()),
                };
              });
            }
          })
          .catch(() => { });
      }
    }

    // Automatically fetch & activate subtitle according to Smart TV Settings (unless 'off')
    if (tvSettings.defaultSubLang === 'off') {
      setActiveSubVttUrl(null);
      setActiveSubLabel('');
      setActiveSubCues([]);
    } else {
      autoResolveAndFetchBestRoRuSubtitle({
        imdbId: imdb,
        title: activeVodItem.name,
        nameOriginal: activeVodItem.nameOriginal,
        type: activeVodItem.type,
        season: selectedSeason,
        episode: selectedEpisode,
        preferredLang: tvSettings.defaultSubLang,
      })
        .then((subRes) => {
          if (cancelled || !subRes || usingMkvLiveSubRef.current || userDisabledSubRef.current) return;
          setActiveSubVttUrl(subRes.vttBlobUrl);
          setActiveSubLabel(subRes.track.langLabel);
          setActiveSubCues(subRes.cues);
          if (subRes.resolvedImdbId && isForeignVod) {
            setDetailedMeta((prev) =>
              prev
                ? { ...prev, imdbId: prev.imdbId || subRes.resolvedImdbId }
                : prev
            );
          }
        })
        .catch(() => { });
    }

    resolveDirectVodStreamClient({
      imdb,
      kp,
      title: activeVodItem.nameOriginal || activeVodItem.name,
      type: activeVodItem.type,
      year: (activeVodItem.releaseInfo || '').slice(0, 4),
      season: selectedSeason,
      episode: selectedEpisode,
      ru: isForeignVod ? '0' : '1',
    })
      .then((data) => {
        if (
          data?.seasons?.length &&
          lastResolvedItemKeyRef.current === itemKey
        ) {
          const earlyMerged = mergeSeasonsLists(
            cachedSeriesSeasonsRef.current.itemKey === itemKey
              ? cachedSeriesSeasonsRef.current.seasons
              : undefined,
            data.seasons
          );
          if (earlyMerged.length > 0) {
            cachedSeriesSeasonsRef.current = {
              itemKey,
              seasons: earlyMerged,
            };
            if (cancelled) {
              setResolvedDirectStream((prev) =>
                prev
                  ? {
                    ...prev,
                    seasons: mergeSeasonsLists(prev.seasons, earlyMerged),
                  }
                  : { ok: false, type: "series", seasons: earlyMerged }
              );
            }
          }
        }
        if (cancelled) return;
        directFinished = true;
        const mergedSeasons = mergeSeasonsLists(
          cachedSeriesSeasonsRef.current.itemKey === itemKey
            ? cachedSeriesSeasonsRef.current.seasons
            : undefined,
          data?.seasons
        );
        if (mergedSeasons.length > 0) {
          cachedSeriesSeasonsRef.current = {
            itemKey,
            seasons: mergedSeasons,
          };
        }
        const mergedData: ResolvedDirectVodStream =
          mergedSeasons.length > 0
            ? { ...data, seasons: mergedSeasons }
            : data;
        setResolvedDirectStream(mergedData);
        directResolvedOk = Boolean(
          mergedData?.ok &&
          (mergedData.dashUrl ||
            mergedData.hlsUrl ||
            mergedData.proxyHlsUrl)
        );
        directResolvedSourcePath = directResolvedOk
          ? String(mergedData?.sourcePath || '')
          : '';
        directIsVk = Boolean(
          directResolvedOk && isVkDirectSourcePath(mergedData.sourcePath)
        );

        const audioPrefForItem: AudioTrackPreference = isForeignVod
          ? tvSettings.defaultAudioPref === 'ro'
            ? 'ro'
            : 'original'
          : tvSettings.defaultAudioPref;
        const prefTrackIdx = directResolvedOk
          ? resolveAudioTrackIndexByPreference(
            data.audioNames || [],
            audioPrefForItem
          )
          : undefined;
        if (
          typeof prefTrackIdx === 'number' &&
          prefTrackIdx >= 0 &&
          (data.audioNames?.length || 0) > 1 &&
          activeServer !== 'filelist_torrent' &&
          !flResolvedOk
        ) {
          setSelectedAudioTrackIdx((prevIdx) =>
            prevIdx >= 0 ? prevIdx : prefTrackIdx
          );
        }
        syncPreferredVodServer(prefTrackIdx);
        if (
          isRoVod &&
          !directResolvedOk &&
          !mergedData?.embedUrl &&
          !isLocalHomeServer()
        ) {
          const retryKey = `${itemKey}_${epKey}`;
          if (roCloudAutoRetryKeyRef.current !== retryKey) {
            roCloudAutoRetryKeyRef.current = retryKey;
            window.setTimeout(() => {
              if (!cancelled) {
                setIsDirectStreamLoading(true);
                setDirectStreamRetryTick((t) => t + 1);
              }
            }, 900);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          directFinished = true;
          directResolvedOk = false;
          directResolvedSourcePath = '';
          directIsVk = false;
          const keptSeasons =
            cachedSeriesSeasonsRef.current.itemKey === itemKey &&
              cachedSeriesSeasonsRef.current.seasons.length > 0
              ? cachedSeriesSeasonsRef.current.seasons
              : undefined;
          setResolvedDirectStream({
            ok: false,
            ...(keptSeasons ? { type: 'series', seasons: keptSeasons } : {}),
          });
          syncPreferredVodServer();
          if (isRoVod && !isLocalHomeServer()) {
            const retryKey = `${itemKey}_${epKey}`;
            if (roCloudAutoRetryKeyRef.current !== retryKey) {
              roCloudAutoRetryKeyRef.current = retryKey;
              window.setTimeout(() => {
                if (!cancelled) {
                  setIsDirectStreamLoading(true);
                  setDirectStreamRetryTick((t) => t + 1);
                }
              }, 900);
            }
          }
        }
      })
      .finally(() => {
        if (!cancelled) setIsDirectStreamLoading(false);
      });

    // Resolve Kinozal (for Russian VOD) + FileList.io Live Torrents in parallel (Only on Local Home Server)
    if (isLocalHomeServer()) {
      const isRuVod = !isRoVod && (!isForeignVod || isRussianVodItem(activeVodItem));
      const rawFlQuery = isRuVod
        ? activeVodItem.name ||
        detailedMeta?.name ||
        detailedMeta?.nameOriginal ||
        activeVodItem.nameOriginal ||
        ''
        : detailedMeta?.nameOriginal ||
        activeVodItem.nameOriginal ||
        detailedMeta?.name ||
        activeVodItem.name ||
        '';
      const isPureCyrillicQuery =
        /[а-яА-ЯёЁ]/.test(rawFlQuery) && !/[a-zA-Z]/.test(rawFlQuery);
      if (
        !isRuVod &&
        isPureCyrillicQuery &&
        !imdb &&
        !activeVodItem.flTorrentId &&
        !userSelectedFlTorrentIdRef.current
      ) {
        // Wait for kpData / detailedMeta enrichment above to resolve the Latin title or IMDb ID for foreign VOD
        if (!kp) {
          flFinished = true;
          setIsFileListStreamLoading(false);
          syncPreferredVodServer();
        }
      } else {
        setIsFileListStreamLoading(true);
        const cleanFlQuery =
          activeVodItem.type === 'series'
            ? rawFlQuery
              .replace(/\s*\([^)]*\)\s*/gi, ' ')
              .replace(/•.*$/g, ' ')
              .replace(/\bS\d{1,2}[.\s_-]*E\d{1,2}\b/gi, ' ')
              .replace(/[.\s-]*Сезон\s*\d+\.?/gi, ' ')
              .replace(/\s{2,}/g, ' ')
              .trim() || rawFlQuery
            : rawFlQuery;
        const flParams = new URLSearchParams({
          type: activeVodItem.type,
          ...(activeVodItem.type === 'series'
            ? { s: String(selectedSeason), e: String(selectedEpisode) }
            : {}),
          q: cleanFlQuery,
          ru: isRuVod ? '1' : '0',
        });
        if (userSelectedFlTorrentIdRef.current) {
          flParams.set('id', String(userSelectedFlTorrentIdRef.current));
          flParams.set('strictId', '1');
        } else if (
          activeVodItem.flTorrentId &&
          activeVodItem.type !== 'series'
        ) {
          flParams.set('id', String(activeVodItem.flTorrentId));
        }
        if (imdb) {
          flParams.set('imdb', imdb);
        }
        if (kp) {
          flParams.set('kp', String(kp));
        }

        fetch(buildFileListApiUrl(`/api/filelist/resolve?${flParams.toString()}`))
          .then((r) => (r.ok ? r.json() : { ok: false }))
          .then((rawFlData: ResolvedFileListStream) => {
            const flData = normalizeFileListResolveData(rawFlData);
            if (cancelled) return;
            flFinished = true;
            flResolvedOk = Boolean(flData?.ok);
            setResolvedFileListStream((prev) => {
              if (
                userSelectedFlTorrentIdRef.current &&
                prev?.ok &&
                prev.torrentId === userSelectedFlTorrentIdRef.current &&
                flData?.torrentId !== userSelectedFlTorrentIdRef.current
              ) {
                return prev;
              }
              return !flData?.ok && prev?.ok && prev.streamUrl ? prev : flData;
            });
            if (userSelectedFlTorrentIdRef.current !== null && flData?.ok) {
              setActiveServer('filelist_torrent');
            } else {
              syncPreferredVodServer();
            }
          })
          .catch(() => {
            if (!cancelled) {
              flFinished = true;
              flResolvedOk = false;
              if (!userSelectedFlTorrentIdRef.current) {
                setResolvedFileListStream({ ok: false });
                syncPreferredVodServer();
              }
            }
          })
          .finally(() => {
            if (!cancelled) {
              setIsFileListStreamLoading(false);
            }
          });
      }
    } else if (isLocalBridgeProbePending()) {
      setIsFileListStreamLoading(true);
      void waitForLocalBridgeProbe(2800).then((bridgeOk) => {
        if (cancelled) return;
        if (!bridgeOk) {
          userSelectedFlTorrentIdRef.current = null;
          setIsFileListStreamLoading(false);
          setResolvedFileListStream(null);
          if (!isForeignVod && isRussianVodItem(activeVodItem)) {
            setActiveServer((prev) =>
              prev === 'filelist_torrent' ? 'kinogram_hls' : prev
            );
          }
        }
      });
    } else {
      userSelectedFlTorrentIdRef.current = null;
      setIsFileListStreamLoading(false);
      setResolvedFileListStream(null);
      if (!isForeignVod && isRussianVodItem(activeVodItem)) {
        setActiveServer((prev) =>
          prev === 'filelist_torrent' ? 'kinogram_hls' : prev
        );
      }
    }

    return () => {
      cancelled = true;
    };
  }, [
    activeVodItem,
    selectedSeason,
    selectedEpisode,
    tvSettings.defaultSubLang,
    tvSettings.defaultAudioPref,
    tvSettings.defaultVodServer,
    uiLang,
    localBridgeTick,
    directStreamRetryTick,
  ]);

  // Reset per-episode embedded MKV subtitle selection when item/episode/torrent changes
  useEffect(() => {
    setSelectedMkvSubIdx(null);
    setUseManualOnlineSub(false);
    usingMkvLiveSubRef.current = false;
    userDisabledSubRef.current = false;
    setMkvSubtitleTracks(
      Array.isArray(resolvedFileListStream?.subtitleTracks)
        ? resolvedFileListStream.subtitleTracks
        : []
    );
  }, [
    activeVodItem?.id,
    selectedSeason,
    selectedEpisode,
    resolvedFileListStream?.torrentId,
    resolvedFileListStream?.selectedFileIdx,
  ]);

  // Keep discovered MKV subtitle tracks synced if resolve finishes after mount
  useEffect(() => {
    const incoming = resolvedFileListStream?.subtitleTracks;
    if (Array.isArray(incoming) && incoming.length > 0) {
      setMkvSubtitleTracks(incoming);
    }
  }, [resolvedFileListStream?.subtitleTracks]);

  // Live Embedded MKV Subtitles via instant-flush long-poll (/api/filelist/live-sub?since=N&wait=15): 0ms sync on localhost, LAN, iPad Safari & Cloudflare Tunnel!
  useEffect(() => {
    if (
      !isPlayingVod ||
      activeServer !== 'filelist_torrent' ||
      matchedOfflineVodItem ||
      !resolvedFileListStream?.ok ||
      !resolvedFileListStream.torrentId ||
      useManualOnlineSub ||
      userDisabledSubRef.current ||
      (tvSettings.defaultSubLang === 'off' && selectedMkvSubIdx === null)
    ) {
      return;
    }

    const tid = resolvedFileListStream.torrentId;
    const fIdx =
      typeof resolvedFileListStream.selectedFileIdx === 'number'
        ? resolvedFileListStream.selectedFileIdx
        : 0;
    const subLang = preferredSubLang || tvSettings.defaultSubLang || 'ro';

    let closed = false;
    let activeCtrl: AbortController | null = null;
    const liveCues: SubtitleCue[] = [];
    const seenKeys = new Set<string>();
    let serverTotal = 0;
    let initializedTrack = false;

    const runLoop = async () => {
      let consecutiveErrors = 0;
      let probeRetries = 0;
      while (!closed && !userDisabledSubRef.current) {
        const qs = new URLSearchParams({
          id: String(tid),
          fileIdx: String(fIdx),
          subLang,
          since: String(serverTotal),
          wait: initializedTrack ? '15' : '4',
          ...(selectedMkvSubIdx !== null ? { subIdx: String(selectedMkvSubIdx) } : {}),
        });
        const url = buildFileListApiUrl(`/api/filelist/live-sub?${qs.toString()}`);
        activeCtrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        try {
          const res = await fetch(url, activeCtrl ? { signal: activeCtrl.signal } : undefined);
          if (closed || userDisabledSubRef.current) return;
          if (!res.ok) {
            consecutiveErrors++;
            if (consecutiveErrors >= 4) return;
            await new Promise((r) => window.setTimeout(r, 1500));
            continue;
          }
          const msg = (await res.json()) as {
            ok?: boolean;
            probing?: boolean;
            track?: EmbeddedSubtitleTrack;
            tracks?: EmbeddedSubtitleTrack[];
            total?: number;
            cues?: SubtitleCue[];
          };
          consecutiveErrors = 0;
          if (closed || userDisabledSubRef.current) return;
          if (Array.isArray(msg.tracks) && msg.tracks.length > 0) {
            setMkvSubtitleTracks(msg.tracks);
          }
          if (!msg.ok || !msg.track) {
            if (msg.probing && probeRetries < 8) {
              probeRetries += 1;
              await new Promise((r) => window.setTimeout(r, 900));
              continue;
            }
            usingMkvLiveSubRef.current = false;
            return;
          }
          usingMkvLiveSubRef.current = true;
          if (!initializedTrack) {
            initializedTrack = true;
            setActiveSubVttUrl(null);
            setActiveSubLabel(`${msg.track.label} (Sincron)`);
          }
          let added = false;
          if (Array.isArray(msg.cues)) {
            for (const c of msg.cues) {
              const k = `${Math.round(c.start * 10)}|${Math.round(c.end * 10)}|${c.text}`;
              if (!seenKeys.has(k)) {
                seenKeys.add(k);
                liveCues.push(c);
                added = true;
              }
            }
          }
          if (typeof msg.total === 'number' && msg.total > serverTotal) {
            serverTotal = msg.total;
          } else if (liveCues.length > serverTotal) {
            serverTotal = liveCues.length;
          }
          if (added || serverTotal === 0) {
            setActiveSubCues([...liveCues]);
          }
        } catch {
          if (closed) return;
          consecutiveErrors++;
          if (consecutiveErrors >= 4) return;
          await new Promise((r) => window.setTimeout(r, 1500));
        }
      }
    };

    void runLoop();

    return () => {
      closed = true;
      try {
        activeCtrl?.abort();
      } catch {
        // ignore
      }
    };
  }, [
    isPlayingVod,
    activeServer,
    matchedOfflineVodItem,
    resolvedFileListStream?.ok,
    resolvedFileListStream?.torrentId,
    resolvedFileListStream?.selectedFileIdx,
    preferredSubLang,
    tvSettings.defaultSubLang,
    selectedMkvSubIdx,
    useManualOnlineSub,
  ]);

  // Auto-clamp stale/polluted saved season or episode numbers on series (guarded against active stream discovery)
  useEffect(() => {
    if (!activeVodItem || activeVodItem.type !== 'series') return;
    if (isRussianTvShowItem(activeVodItem) || isRussianVodItem(activeVodItem)) return;
    if (isFileListStreamLoading || isDirectStreamLoading) return;
    if (resolvedFileListStream?.ok && resolvedFileListStream.streamUrl) return;

    const metaVideos = Array.isArray(detailedMeta?.videos)
      ? detailedMeta.videos.filter((v) => Number(v.season) > 0)
      : [];
    const directSeasons = Array.isArray(resolvedDirectStream?.seasons)
      ? resolvedDirectStream.seasons.filter((s) => Number(s.season) > 0)
      : [];

    const validSeasons =
      metaVideos.length > 0
        ? Array.from(new Set(metaVideos.map((v) => Number(v.season)))).sort(
          (a, b) => a - b
        )
        : directSeasons.length > 0
          ? Array.from(
            new Set(directSeasons.map((s) => Number(s.season)))
          ).sort((a, b) => a - b)
          : [];

    if (validSeasons.length === 0) return;

    if (!validSeasons.includes(selectedSeason)) {
      setSelectedSeason(validSeasons[0]);
      setSelectedEpisode(1);
      return;
    }

    const validEpisodes =
      metaVideos.length > 0
        ? metaVideos
          .filter((v) => Number(v.season) === selectedSeason && Number(v.episode) > 0)
          .map((v) => Number(v.episode))
          .sort((a, b) => a - b)
        : (
          directSeasons.find((s) => Number(s.season) === selectedSeason)
            ?.episodes || []
        )
          .map((ep) => Number(ep.episode))
          .filter((n) => n > 0)
          .sort((a, b) => a - b);

    if (validEpisodes.length > 0 && !validEpisodes.includes(selectedEpisode)) {
      setSelectedEpisode(validEpisodes[0] || 1);
    }
  }, [
    activeVodItem,
    detailedMeta?.videos,
    resolvedDirectStream?.seasons,
    resolvedFileListStream?.ok,
    resolvedFileListStream?.streamUrl,
    isFileListStreamLoading,
    selectedSeason,
    selectedEpisode,
  ]);

  const lastTranslatedDescRef = useRef<string>('');
  // Automatically translate movie/series description & country into the selected UI language (RO / EN / RU)
  useEffect(() => {
    const rawDesc = detailedMeta?.description;
    if (!rawDesc || lastTranslatedDescRef.current === `${uiLang}:${rawDesc}`) return;
    let cancelled = false;
    translateTextToLang(rawDesc, uiLang)
      .then((translated) => {
        if (!cancelled && translated && translated !== rawDesc) {
          lastTranslatedDescRef.current = `${uiLang}:${translated}`;
          setDetailedMeta((prev) =>
            prev ? { ...prev, description: translated } : prev
          );
        }
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [detailedMeta?.description, uiLang]);

  // Fetch Cast & Actors (with photos, roles & biographies) whenever activeVodItem or detailedMeta updates
  useEffect(() => {
    if (!activeVodItem || activeVodItem.id.startsWith('yt_')) {
      setCastMembers([]);
      setIsCastLoading(false);
      return;
    }
    let cancelled = false;
    setIsCastLoading(true);
    const imdbId = activeVodItem.id.startsWith('tt')
      ? activeVodItem.id
      : detailedMeta?.imdbId || '';
    const kpId =
      activeVodItem.kpId ||
      detailedMeta?.kpId ||
      (activeVodItem.id.startsWith('kp_')
        ? activeVodItem.id.replace(/^kp_/, '')
        : '');

    fetchCastForVodItem({
      imdbId,
      kpId,
      fallbackCast: detailedMeta?.cast,
      fallbackDirectors: detailedMeta?.director,
      lang: uiLang,
    })
      .then((list) => {
        if (!cancelled) {
          setCastMembers(list);
        }
      })
      .catch(() => { })
      .finally(() => {
        if (!cancelled) {
          setIsCastLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeVodItem?.id,
    activeVodItem?.kpId,
    detailedMeta?.imdbId,
    detailedMeta?.kpId,
    detailedMeta?.cast,
    uiLang,
  ]);

  const handleSelectFileListTorrent = useCallback(
    (torrentId: number, fileIdx?: number, autoPlay = true) => {
      if (!activeVodItem) return;
      userManuallySelectedServerRef.current = true;
      userSelectedFlTorrentIdRef.current = torrentId;
      setSelectedAudioTrackIdx(0);
      setResolvedFileListStream((prev) => {
        if (!prev) return prev;
        const clickedTor = prev.torrents?.find((t) => t.id === torrentId);
        if (!clickedTor) return prev;
        return {
          ...prev,
          ok: true,
          torrentId,
          selectedTorrent: clickedTor,
          streamUrl: buildFileListApiUrl(`/api/filelist/stream?id=${torrentId}&fileIdx=${typeof fileIdx === 'number' ? fileIdx : 0}&orig=${isCurrentVodForeign ? '1' : '0'}`),
        };
      });
      setIsFileListStreamLoading(true);
      setActiveServer('filelist_torrent');
      if (isPlayingVod) {
        const savedProg =
          findWatchProgressEntry(watchProgressMapRef.current, activeVodItem) ||
          findWatchProgressEntry(watchProgressMap, activeVodItem);
        const isSameEpProg =
          activeVodItem.type !== 'series' ||
          (savedProg?.season === selectedSeason &&
            savedProg?.episode === selectedEpisode);
        const curSaved = isSameEpProg ? savedProg?.currentTime || 0 : 0;
        if (curSaved > 45) {
          setResumeStartSeconds(curSaved);
        } else {
          setResumeStartSeconds(0);
        }
      }
      if (autoPlay) {
        if (tvSettings.autoFullscreenOnPlay && !isMobilePhone) {
          ensureTvFullscreen();
        }
        if (osdTimerRef.current) {
          window.clearTimeout(osdTimerRef.current);
          osdTimerRef.current = null;
        }
        setIsVodOsdVisible(false);
        setIsPlayingVod(true);
      }
      const resolvedImdb = activeVodItem.id.startsWith('tt')
        ? activeVodItem.id
        : detailedMeta?.imdbId ||
        resolvedFileListStream?.selectedTorrent?.imdbId ||
        '';
      const p = new URLSearchParams({
        id: String(torrentId),
        strictId: '1',
        ru: isRussianVodItem(activeVodItem) ? '1' : '0',
        type: activeVodItem.type,
        ...(activeVodItem.type === 'series'
          ? { s: String(selectedSeason), e: String(selectedEpisode) }
          : {}),
        q:
          detailedMeta?.nameOriginal ||
          activeVodItem.nameOriginal ||
          detailedMeta?.name ||
          activeVodItem.name ||
          '',
      });
      if (resolvedImdb) {
        p.set('imdb', resolvedImdb);
      }
      if (typeof fileIdx === 'number') {
        p.set('fileIdx', String(fileIdx));
      }
      fetch(buildFileListApiUrl(`/api/filelist/resolve?${p.toString()}`))
        .then((r) => (r.ok ? r.json() : { ok: false }))
        .then((rawFlData: ResolvedFileListStream) => {
          const flData = normalizeFileListResolveData(rawFlData);
          if (
            userSelectedFlTorrentIdRef.current &&
            userSelectedFlTorrentIdRef.current !== torrentId
          ) {
            return;
          }
          const selRel = flData?.selectedTorrent?.releaseTitle || '';
          const seMatch = selRel.match(/\bS(\d{1,2})[.\s_-]*E(\d{1,2})\b/i);
          if (seMatch && section === 'torrents') {
            const parsedS = Number(seMatch[1]);
            const parsedE = Number(seMatch[2]);
            if (parsedS > 0 && parsedE > 0) {
              setSelectedSeason(parsedS);
              setSelectedEpisode(parsedE);
            }
          }
          setResolvedFileListStream((prev) => {
            const mergedTorrents =
              flData.torrents && flData.torrents.length > 0
                ? flData.torrents
                : prev?.torrents;
            const richSelected =
              mergedTorrents?.find((t) => t.id === flData.torrentId) ||
              flData.selectedTorrent;
            return {
              ...flData,
              selectedTorrent: richSelected,
              torrents: mergedTorrents,
            };
          });
        })
        .catch(() => { })
        .finally(() => {
          setIsFileListStreamLoading(false);
        });
    },
    [
      activeVodItem,
      detailedMeta,
      resolvedFileListStream?.selectedTorrent?.imdbId,
      isPlayingVod,
      watchProgressMap,
      selectedSeason,
      selectedEpisode,
      tvSettings.autoFullscreenOnPlay,
      ensureTvFullscreen,
      isMobilePhone,
      section,
    ]
  );

  const currentServerOptions = useMemo<Array<{ id: VodServerId; label: string }>>(() => {
    const hasFlSource =
      isLocalHomeServer() &&
      Boolean(resolvedFileListStream?.ok && resolvedFileListStream.streamUrl);
    const hasDirectSource = Boolean(
      resolvedDirectStream?.ok &&
      (resolvedDirectStream.dashUrl ||
        resolvedDirectStream.hlsUrl ||
        resolvedDirectStream.proxyHlsUrl)
    );
    const isRoItem = Boolean(
      activeVodItem &&
      (isRomanianVodItem(detailedMeta || activeVodItem) ||
        isFileListExclusiveRomanianTitle(detailedMeta || activeVodItem))
    );
    const opts: Array<{ id: VodServerId; label: string }> = [];

    if (isRoItem) {
      if (hasDirectSource) {
        opts.push({
          id: 'kinogram_hls',
          label: 'Cloud România HD (Instant)',
        });
      }
      if (hasFlSource) {
        opts.push({
          id: 'filelist_torrent',
          label: 'FileList România (1080p / 720p)',
        });
      }
      if (opts.length === 0) {
        opts.push({
          id: 'kinogram_hls',
          label: 'Cloud România HD (Instant)',
        });
      }
      return opts;
    }

    if (isCurrentVodForeign) {
      if (hasFlSource) {
        opts.push({
          id: 'filelist_torrent',
          label: 'FileList / P2P (4K UHD & Full HD)',
        });
      }
      const directHasOriginal =
        findExplicitOriginalAudioTrackIndex(
          resolvedDirectStream?.audioNames || []
        ) >= 0;
      if (hasDirectSource && (directHasOriginal || !hasFlSource)) {
        opts.push({
          id: 'kinogram_hls',
          label: 'Cloud Rapid (HD Instant)',
        });
      }
      return opts;
    }

    if (hasFlSource) {
      opts.push({
        id: 'filelist_torrent',
        label: 'Kinozal (4K UHD & Full HD)',
      });
    }
    if (hasDirectSource) {
      opts.push({
        id: 'kinogram_hls',
        label: 'VK / Cloud Direct (4K & Full HD)',
      });
    }
    return opts;
  }, [
    isCurrentVodForeign,
    activeVodItem,
    detailedMeta,
    resolvedFileListStream?.ok,
    resolvedFileListStream?.streamUrl,
    resolvedDirectStream?.ok,
    resolvedDirectStream?.dashUrl,
    resolvedDirectStream?.hlsUrl,
    resolvedDirectStream?.proxyHlsUrl,
    resolvedDirectStream?.audioNames,
  ]);

  const flQualityOptions = useMemo<VodExternalQualityOption[]>(() => {
    if (klubnichkaQualities.length > 0 && activeVodItem?.isAdultKlubnichka) {
      return klubnichkaQualities.map((q) => ({
        id: q.id,
        label: `${q.label} • Direct MP4`,
        badge:
          q.height >= 2160
            ? '4K UHD'
            : q.height >= 1440
              ? '2K QHD'
              : q.height >= 1080
                ? 'Full HD'
                : 'HD',
        subLabel: activeVodItem.name,
        active: resolvedDirectStream?.hlsUrl === q.url,
        onSelect: () => {
          setResolvedDirectStream((prev) =>
            prev
              ? {
                ...prev,
                hlsUrl: q.url,
                sourcePath: `Klubnichka 18+ • ${q.label}`,
              }
              : prev
          );
        },
      }));
    }
    const parseHeightRank = (txt = ''): number => {
      const s = txt.toLowerCase();
      if (s.includes('2160') || s.includes('4k')) return 2160;
      if (s.includes('1440') || s.includes('2k') || s.includes('qhd')) return 1440;
      if (s.includes('1080') || s.includes('full hd') || s.includes('fhd')) return 1080;
      if (s.includes('720')) return 720;
      if (/\buhd\b/.test(s)) return 2160;
      if (s.includes('480')) return 480;
      if (s.includes('360')) return 360;
      return 1080;
    };
    const isActuallyPlayingFl =
      activeServer === 'filelist_torrent' &&
      Boolean(resolvedFileListStream?.ok && resolvedFileListStream.streamUrl);
    const hasFlSource =
      isLocalHomeServer() &&
      Boolean(resolvedFileListStream?.ok && resolvedFileListStream.streamUrl);
    const hasDirectSource = Boolean(
      resolvedDirectStream?.ok &&
      (resolvedDirectStream.dashUrl ||
        resolvedDirectStream.hlsUrl ||
        resolvedDirectStream.proxyHlsUrl)
    );
    const directHasOriginal =
      findExplicitOriginalAudioTrackIndex(
        resolvedDirectStream?.audioNames || []
      ) >= 0;

    const rawVkQuals = isCurrentVodForeign
      ? []
      : (resolvedDirectStream?.vkQualities || []).filter((q) => q.height >= 720);
    const vkOptsWithRank = rawVkQuals.map((q, idx) => ({
      heightRank: q.height || parseHeightRank(q.label),
      seedRank: 5,
      sourcePriority: 1,
      opt: {
        id: q.id,
        label: `${q.label} • VK Direct`,
        badge:
          q.height >= 2160
            ? '4K UHD'
            : q.height >= 1440
              ? '2K QHD'
              : q.height >= 1080
                ? 'Full HD'
                : 'HD',
        subLabel: resolvedDirectStream?.title || activeVodItem?.name || '',
        active:
          !isActuallyPlayingFl &&
          (resolvedDirectStream?.hlsUrl === q.url ||
            (idx === 0 &&
              /video\.m3u8/i.test(String(resolvedDirectStream?.hlsUrl || '')))),
        onSelect: () => {
          userManuallySelectedServerRef.current = true;
          userSelectedFlTorrentIdRef.current = null;
          setActiveServer('kinogram_hls');
          setResolvedDirectStream((prev) =>
            prev
              ? {
                ...prev,
                hlsUrl: q.url,
                sourcePath: `VK Видео Direct (${q.label})`,
              }
              : prev
          );
        },
      } as VodExternalQualityOption,
    }));

    const directHlsOptsWithRank: Array<{
      heightRank: number;
      seedRank: number;
      sourcePriority: number;
      opt: VodExternalQualityOption;
    }> = [];
    if (
      hasDirectSource &&
      vkOptsWithRank.length === 0 &&
      (!isCurrentVodForeign || !hasFlSource || directHasOriginal)
    ) {
      const sp = String(resolvedDirectStream?.sourcePath || '');
      const hUrl = String(
        resolvedDirectStream?.proxyHlsUrl ||
        resolvedDirectStream?.hlsUrl ||
        ''
      );
      const dHeight =
        /2160|4k/i.test(sp) || (/\buhd\b/i.test(sp) && !/\b(1080p|720p)\b/i.test(sp))
          ? 2160
          : /1080|rutube|iedem/i.test(sp) || /1080_/i.test(hUrl)
            ? 1080
            : 720;
      const dLabel =
        dHeight >= 2160
          ? '4K UHD (2160p)'
          : dHeight >= 1080
            ? '1080p Full HD'
            : '720p HD';
      const directOrigIdx = findExplicitOriginalAudioTrackIndex(
        resolvedDirectStream?.audioNames || []
      );
      const isRoLabelTarget = Boolean(
        activeVodItem &&
        (isRomanianVodItem(detailedMeta || activeVodItem) ||
          isFileListExclusiveRomanianTitle(detailedMeta || activeVodItem))
      );
      directHlsOptsWithRank.push({
        heightRank: dHeight,
        seedRank: 1,
        sourcePriority: 1,
        opt: {
          id: 'direct_hls_primary',
          label: `${dLabel} • Cloud Rapid`,
          badge: 'Instant',
          subLabel: isRoLabelTarget
            ? 'Audio Română'
            : isCurrentVodForeign
              ? 'Audio Original'
              : filterDisplayAudioItems(
                  resolvedDirectStream?.audioNames || ['Original'],
                  (n) => n,
                  isCurrentVodForeign
                )
                  .slice(0, 2)
                  .join(' • '),
          active: !isActuallyPlayingFl,
          onSelect: () => {
            userManuallySelectedServerRef.current = true;
            userSelectedFlTorrentIdRef.current = null;
            if (isCurrentVodForeign && directOrigIdx >= 0) {
              setSelectedAudioTrackIdx(directOrigIdx);
            }
            setActiveServer('kinogram_hls');
          },
        },
      });
    }

    const rawFlList =
      resolvedFileListStream?.torrents &&
      resolvedFileListStream.torrents.length > 0
        ? resolvedFileListStream.torrents
        : resolvedFileListStream?.selectedTorrent
          ? [resolvedFileListStream.selectedTorrent]
          : [];

    const rankedFlRaw = rawFlList
      .map((tor) => {
        const qStr = tor.quality || '1080p Full HD';
        const heightRank = parseHeightRank(qStr);
        const torProvider =
          tor.provider ||
          tor.source ||
          (tor.flId?.startsWith('kz:')
            ? 'kinozal'
            : tor.flId?.startsWith('tio:')
              ? 'torrentio'
              : 'filelist');
        const sourcePriority =
          torProvider === 'filelist' || torProvider === 'kinozal' ? 3 : 2;
        const relT = tor.releaseTitle || tor.name || '';
        const fmtParts = [
          /\bimax\b/i.test(relT) ? 'IMAX' : '',
          /\bhdr/i.test(relT) ? 'HDR' : '',
          /\b(blu-?ray|remux)\b/i.test(relT)
            ? 'BluRay'
            : /\bweb[-.]?dl\b/i.test(relT)
              ? 'WEB-DL'
              : '',
        ]
          .filter(Boolean)
          .slice(0, 2);
        const tierLabel = qStr === '4K UHD' ? '4K UHD (2160p)' : qStr;
        const srcTag =
          torProvider === 'kinozal'
            ? 'Kinozal'
            : torProvider === 'torrentio'
              ? 'P2P Global'
              : tor.isRo
                ? 'FileList RO'
                : 'FileList';
        return {
          torId: tor.id,
          torProvider,
          heightRank,
          seedRank: Number(tor.seeders) || 0,
          sourcePriority,
          opt: {
            id: `fl_q_${tor.id}`,
            label: `${tierLabel} • ${srcTag}`,
            badge: `${fmtParts.length > 0 ? `${fmtParts.join(' ')} • ` : ''}${tor.sizeFormatted}`,
            subLabel: relT,
            active:
              isActuallyPlayingFl &&
              resolvedFileListStream?.torrentId === tor.id,
            onSelect: () => {
              handleSelectFileListTorrent(tor.id, tor.fileIdx, true);
            },
          } as VodExternalQualityOption,
        };
      })
      .sort(
        (a, b) =>
          b.heightRank - a.heightRank ||
          b.sourcePriority - a.sourcePriority ||
          b.seedRank - a.seedRank
      );

    // Keep top 2 FileList/Kinozal streams per resolution tier + top 1 P2P Global backup per tier if FileList has none
    const flTierCounts = new Map<number, number>();
    const tioTierCounts = new Map<number, number>();
    const curatedFlOpts = rankedFlRaw.filter((entry) => {
      if (isActuallyPlayingFl && entry.torId === resolvedFileListStream?.torrentId) {
        return true;
      }
      if (entry.torProvider === 'torrentio') {
        if ((flTierCounts.get(entry.heightRank) || 0) > 0) return false;
        const tc = tioTierCounts.get(entry.heightRank) || 0;
        if (tc >= 1) return false;
        tioTierCounts.set(entry.heightRank, tc + 1);
        return true;
      }
      const fc = flTierCounts.get(entry.heightRank) || 0;
      if (fc >= 2) return false;
      flTierCounts.set(entry.heightRank, fc + 1);
      return true;
    });

    return [...curatedFlOpts, ...vkOptsWithRank, ...directHlsOptsWithRank]
      .sort(
        (a, b) =>
          b.heightRank - a.heightRank ||
          b.sourcePriority - a.sourcePriority ||
          b.seedRank - a.seedRank
      )
      .map((x) => x.opt);
  }, [
    resolvedFileListStream,
    activeServer,
    handleSelectFileListTorrent,
    klubnichkaQualities,
    activeVodItem,
    resolvedDirectStream,
    isCurrentVodForeign,
  ]);

  // Seasons & Episodes list for Series
  const seasonsMap = useMemo(() => {
    const cleanEpisodeTitle = (rawTitle?: string, epNum?: number): string => {
      const t = (rawTitle || '').trim();
      if (!t) return '';
      if (/^\s*\d+\s*серия(\s*\(\s*\d+\s*сезон\s*\))?\s*$/i.test(t)) {
        return '';
      }
      if (
        /^(episodul|episode|ep\.?|серия|seria|part|partea)\s*#?\d+$/i.test(t)
      ) {
        return '';
      }
      if (epNum && t === String(epNum)) return '';
      return t;
    };

    const rawKpNum = Number(
      activeVodItem?.kpId ||
      detailedMeta?.kpId ||
      (activeVodItem?.id.startsWith('kp_')
        ? activeVodItem.id.replace(/^kp_/, '')
        : 0)
    );
    const isSyntheticVkShow =
      (rawKpNum >= 9001000 && rawKpNum <= 9001999) ||
      Boolean(
        (activeVodItem?.id.startsWith('iedem_') ||
          isRussianTvShowItem(activeVodItem)) &&
        resolvedDirectStream?.seasons &&
        resolvedDirectStream.seasons.length > 0
      );
    const metaVideos = isSyntheticVkShow ? [] : detailedMeta?.videos || [];
    const metaVideoMap = new Map<string, SeriesEpisode>();
    for (const v of metaVideos) {
      const sNum = Number(v.season);
      const epNum = Number(v.episode ?? v.number);
      if (!sNum || !epNum) continue;
      metaVideoMap.set(`${sNum}_${epNum}`, {
        ...v,
        name: cleanEpisodeTitle(v.name, epNum),
        season: sNum,
        episode: epNum,
      });
    }

    const isRuSeriesForMeta = isRussianVodItem(activeVodItem);
    const directProvidedSeasons = new Set<number>();
    const map = new Map<number, SeriesEpisode[]>();
    if (
      resolvedDirectStream?.seasons &&
      resolvedDirectStream.seasons.length > 0
    ) {
      for (const s of resolvedDirectStream.seasons) {
        directProvidedSeasons.add(s.season);
        map.set(
          s.season,
          s.episodes.map((ep) => {
            const metaEp = metaVideoMap.get(`${s.season}_${ep.episode}`);
            const directCleanName = cleanEpisodeTitle(ep.title, ep.episode);
            const hasRichDirectRuTitle = Boolean(
              isRuSeriesForMeta &&
              directCleanName &&
              !/^(?:Episodul|Episode|Серия|Выпуск)\s*\d+$/i.test(
                directCleanName
              ) &&
              !/\(\d+\s*сезон\)\s*-\s*\d+\s*(?:серия|выпуск)/i.test(
                String(ep.title || '')
              )
            );
            return {
              ...metaEp,
              id: metaEp?.id || `kp_${s.season}_${ep.episode}`,
              name: hasRichDirectRuTitle
                ? directCleanName
                : metaEp?.name || directCleanName,
              thumbnail: ep.thumbnail || metaEp?.thumbnail,
              season: s.season,
              episode: ep.episode,
            };
          })
        );
      }
    }

    for (const v of metaVideos) {
      const sNum = Number(v.season);
      const epNum = Number(v.episode ?? v.number);
      if (!sNum || sNum <= 0 || !epNum) continue;
      const list = map.get(sNum) || [];
      const existingIdx = list.findIndex((x) => x.episode === epNum);
      const prevEp = existingIdx >= 0 ? list[existingIdx] : undefined;
      const metaCleanName = cleanEpisodeTitle(v.name, epNum);
      const keepPrevRuTitle = Boolean(
        isRuSeriesForMeta &&
        directProvidedSeasons.has(sNum) &&
        prevEp?.name &&
        /[а-яёА-ЯЁ]/.test(prevEp.name) &&
        !/\(\d+\s*сезон\)\s*-\s*\d+\s*(?:серия|выпуск)/i.test(prevEp.name)
      );
      const enriched: SeriesEpisode = {
        ...v,
        name: keepPrevRuTitle
          ? prevEp!.name
          : metaCleanName || prevEp?.name || '',
        thumbnail:
          isRuSeriesForMeta && prevEp?.thumbnail
            ? prevEp.thumbnail
            : v.thumbnail || prevEp?.thumbnail,
        season: sNum,
        episode: epNum,
      };
      if (existingIdx >= 0) {
        list[existingIdx] = { ...prevEp, ...enriched };
      } else if (!(isRuSeriesForMeta && directProvidedSeasons.has(sNum))) {
        list.push(enriched);
      }
      list.sort((a, b) => a.episode - b.episode);
      map.set(sNum, list);
    }

    // Also include any higher season/episode numbers discovered on FileList.io / Kinozal VIP
    const flTorrents = isSyntheticVkShow
      ? []
      : resolvedFileListStream?.torrents || [];
    for (const tor of flTorrents) {
      const rel = String(tor.releaseTitle || '');
      const mEn = rel.match(/\bS(\d{1,2})[.\s_-]*E(\d{1,2})\b/i);
      const mBracket = rel.match(/\[(?:S0*(\d+)x|0*(\d+)x)\d+-0*(\d+)\]/i);
      const mIz = rel.match(/\[0*1\s*[-–]\s*0*(\d+)(?:\s*из\s*\d+)?\]/i);
      const mRu = rel.match(/(?:(\d+)\s*сезон[^)]*?)?1\s*[-–]\s*0*(\d+)\s*(?:сери|выпуск)/i);
      const sexplicit = rel.match(/(?:\[S0*(\d+)\]|\[S0*(\d+)|\b0*(\d+)\s*сезон)/i);
      const sNum = mEn
        ? Number(mEn[1])
        : mBracket
          ? Number(mBracket[1] || mBracket[2])
          : mRu && mRu[1]
            ? Number(mRu[1])
            : sexplicit
              ? Number(sexplicit[1] || sexplicit[2] || sexplicit[3])
              : selectedSeason || 1;
      const eMax = mEn
        ? Number(mEn[2])
        : mBracket
          ? Number(mBracket[3])
          : mIz
            ? Number(mIz[1])
            : mRu
              ? Number(mRu[2])
              : sexplicit
                ? 15
                : 0;
      if (!sNum || !eMax || eMax > 120) continue;
      const list = map.get(sNum) || [];
      const existingEps = new Set(list.map((x) => x.episode));
      for (let ep = 1; ep <= eMax; ep++) {
        if (!existingEps.has(ep)) {
          existingEps.add(ep);
          list.push({
            id: `fl_${sNum}_${ep}`,
            name: '',
            season: sNum,
            episode: ep,
          });
        }
      }
      list.sort((a, b) => a.episode - b.episode);
      map.set(sNum, list);
    }

    if (
      activeVodItem?.type === 'series' &&
      resolvedFileListStream?.files &&
      resolvedFileListStream.files.length > 1
    ) {
      const sNum = selectedSeason || 1;
      const fCount = Math.min(120, resolvedFileListStream.files.length);
      const list = map.get(sNum) || [];
      const existingEps = new Set(list.map((x) => x.episode));
      for (let ep = 1; ep <= fCount; ep++) {
        if (!existingEps.has(ep)) {
          existingEps.add(ep);
          list.push({
            id: `fl_file_${sNum}_${ep}`,
            name: '',
            season: sNum,
            episode: ep,
          });
        }
      }
      list.sort((a, b) => a.episode - b.episode);
      map.set(sNum, list);
    }

    if (
      activeVodItem?.type === 'series' &&
      (activeVodItem?.seasonsCount || 0) > 1 &&
      map.size < Number(activeVodItem.seasonsCount)
    ) {
      const totalS = Math.min(30, Number(activeVodItem.seasonsCount) || 1);
      const perSeasonEp = Math.min(
        120,
        Math.max(
          8,
          Math.round((Number(activeVodItem.episodesCount) || totalS * 12) / totalS)
        )
      );
      for (let s = 1; s <= totalS; s++) {
        if (!map.has(s)) {
          const list: SeriesEpisode[] = [];
          for (let ep = 1; ep <= perSeasonEp; ep++) {
            list.push({
              id: `cnt_${s}_${ep}`,
              name: '',
              season: s,
              episode: ep,
            });
          }
          map.set(s, list);
        }
      }
    }

    if (map.size === 0 && activeVodItem?.type === 'series') {
      const sNum = selectedSeason || 1;
      const epMax = Math.min(
        120,
        Math.max(
          Number(activeVodItem.episodesCount) || 12,
          selectedEpisode || 1
        )
      );
      const list: SeriesEpisode[] = [];
      for (let ep = 1; ep <= epMax; ep++) {
        list.push({
          id: `fl_cnt_${sNum}_${ep}`,
          name: '',
          season: sNum,
          episode: ep,
        });
      }
      map.set(sNum, list);
    }

    if (activeVodItem?.type === 'series') {
      const savedProg = findWatchProgressEntry(watchProgressMapRef.current, activeVodItem);
      const progSeasons = Object.keys(savedProg?.episodeProgressMap || {}).map(
        (k) => Number(k.match(/^S(\d+)E/i)?.[1] || 0)
      );
      const knownMaxSeason = Math.min(
        50,
        Math.max(
          selectedSeason || 1,
          Number(activeVodItem.seasonsCount || 0),
          Number(savedProg?.totalSeasons || 0),
          Number(savedProg?.season || 0),
          ...progSeasons
        )
      );
      for (let sIdx = 1; sIdx <= knownMaxSeason; sIdx++) {
        if (!map.has(sIdx)) {
          const epMax =
            sIdx === selectedSeason
              ? Math.min(120, Math.max(1, selectedEpisode || 1))
              : 1;
          const list: SeriesEpisode[] = [];
          for (let ep = 1; ep <= epMax; ep++) {
            list.push({
              id: `pending_${sIdx}_${ep}`,
              name: '',
              season: sIdx,
              episode: ep,
            });
          }
          map.set(sIdx, list);
        }
      }

      // Ensure every offline-downloaded episode for this series is always present in seasonsMap (works 100% in Airplane Mode!)
      const offlineForActive = offlineItems.filter(
        (it) =>
          it.vodId === activeVodItem.id ||
          it.id.startsWith(`vod_${activeVodItem.id}_`)
      );
      for (const offIt of offlineForActive) {
        const sNum = offIt.season || 1;
        const epNum = offIt.episode || 1;
        const existingList = map.get(sNum) || [];
        if (!existingList.some((e) => e.episode === epNum)) {
          const nextList = [
            ...existingList,
            {
              id: `offline_${sNum}_${epNum}`,
              name: offIt.subtitleLabel || `Episodul ${epNum}`,
              thumbnail: offIt.backdrop || offIt.poster,
              season: sNum,
              episode: epNum,
            },
          ].sort((a, b) => a.episode - b.episode);
          map.set(sNum, nextList);
        }
      }
    }

    return map;
  }, [
    activeVodItem,
    detailedMeta,
    resolvedDirectStream,
    resolvedFileListStream,
    selectedSeason,
    selectedEpisode,
    offlineItems,
  ]);

  const availableSeasons = useMemo(
    () => Array.from(seasonsMap.keys()).sort((a, b) => a - b),
    [seasonsMap]
  );

  const seasonYearsMap = useMemo(() => {
    const yMap = new Map<number, string>();
    const currentYear = new Date().getFullYear();

    // 1. Extract from episode release dates (Cinemeta / TMDB) or episode titles
    for (const sNum of availableSeasons) {
      const eps = seasonsMap.get(sNum) || [];
      for (const ep of eps) {
        if (ep.released) {
          const m = String(ep.released).match(/\b(19\d{2}|20[0-3]\d)\b/);
          if (m) {
            yMap.set(sNum, m[1]);
            break;
          }
        }
      }
      if (!yMap.has(sNum)) {
        for (const ep of eps) {
          const m = String(ep.name || "").match(/\b(?:\d{2}\.\d{2}\.)?(20[0-3]\d)\b/);
          if (m && Number(m[1]) <= currentYear + 1) {
            yMap.set(sNum, m[1]);
            break;
          }
        }
      }
    }

    // 2. Extract from Kinozal VIP / FileList.io single-season torrent titles
    const flTorrents = resolvedFileListStream?.torrents || [];
    for (const sNum of availableSeasons) {
      if (yMap.has(sNum)) continue;
      for (const tor of flTorrents) {
        const t = String(tor.name || "");
        if (/\bS\d{1,2}\s*-\s*S?\d{1,2}\b|\b\d{1,2}\s*-\s*\d{1,2}\s*сезон/i.test(t)) {
          continue;
        }
        const sRe = new RegExp(
          `(?:\\bS0*${sNum}(?:\\b|E)|\\bSeason\\s*0*${sNum}\\b|(?:^|[^\\d])0*${sNum}\\s*сезон)`,
          "i"
        );
        if (sRe.test(t)) {
          const ym =
            t.match(/\/\s*(19\d{2}|20[0-3]\d)\s*\//) ||
            t.match(/[.(/\s](19\d{2}|20[0-3]\d)[.)/\s]/);
          if (ym && Number(ym[1]) <= currentYear + 1) {
            yMap.set(sNum, ym[1]);
            break;
          }
        }
      }
    }

    // 3. Fallback from series releaseInfo start year for any remaining season
    const rawRel = String(
      detailedMeta?.releaseInfo || activeVodItem?.releaseInfo || ""
    );
    const baseYearMatch = rawRel.match(/\b(19\d{2}|20[0-3]\d)\b/);
    const baseYear = baseYearMatch ? Number(baseYearMatch[1]) : 0;
    if (baseYear > 1950) {
      for (const sNum of availableSeasons) {
        if (!yMap.has(sNum)) {
          const prevY = sNum > 1 && yMap.has(sNum - 1) ? Number(yMap.get(sNum - 1)) : 0;
          const estYear = prevY > 0
            ? Math.min(currentYear, prevY + 1)
            : Math.min(currentYear, baseYear + (sNum - 1));
          yMap.set(sNum, String(estYear));
        }
      }
    }

    return yMap;
  }, [availableSeasons, seasonsMap, resolvedFileListStream, detailedMeta, activeVodItem]);

  const [episodesSortDesc, setEpisodesSortDesc] = useState<boolean>(false);

  useEffect(() => {
    if (!activeVodItem) return;
    const saved =
      findWatchProgressEntry(watchProgressMapRef.current, activeVodItem) ||
      findWatchProgressEntry(watchProgressMap, activeVodItem);
    setEpisodesSortDesc(loadSeriesEpisodeSortDesc(activeVodItem.id, saved));
  }, [activeVodItem?.id]);

  const handleSetSeriesEpisodesSortDesc = useCallback(
    (desc: boolean) => {
      setEpisodesSortDesc(desc);
      if (!activeVodItem) return;
      saveSeriesEpisodeSortDesc(activeVodItem.id, desc);
      setWatchProgressMap((prev) => {
        const existing = prev[activeVodItem.id];
        if (!existing) return prev;
        const next: Record<string, VodWatchProgressEntry> = {
          ...prev,
          [activeVodItem.id]: {
            ...existing,
            episodesSortDesc: desc,
            updatedAt: Date.now(),
          },
        };
        saveWatchProgressMap(next, activeProfileId);
        return next;
      });
    },
    [activeVodItem, activeProfileId]
  );

  const episodesForSeason = useMemo(
    () =>
      seasonsMap.get(selectedSeason) ||
      (selectedSeason <= 0 && availableSeasons.length > 0
        ? seasonsMap.get(availableSeasons[0]) || []
        : []),
    [seasonsMap, selectedSeason, availableSeasons]
  );

  const displayedEpisodesForSeason = useMemo(
    () =>
      episodesSortDesc
        ? [...episodesForSeason].sort((a, b) => b.episode - a.episode)
        : [...episodesForSeason].sort((a, b) => a.episode - b.episode),
    [episodesForSeason, episodesSortDesc]
  );

  const displayedSeasons = useMemo(
    () =>
      episodesSortDesc
        ? [...availableSeasons].sort((a, b) => b - a)
        : [...availableSeasons].sort((a, b) => a - b),
    [availableSeasons, episodesSortDesc]
  );

  const nextEpisodeInfo = useMemo((): {
    season: number;
    episode: number;
    label: string;
  } | null => {
    if (!activeVodItem || activeVodItem.type !== 'series') return null;
    // Always advance chronologically forward in story (1 -> 2 -> 3)
    const ascList = [...episodesForSeason].sort(
      (a, b) => a.episode - b.episode
    );
    const nextAscInSeason = ascList.find(
      (ep) => ep.episode > selectedEpisode
    );
    if (nextAscInSeason) {
      return {
        season: selectedSeason,
        episode: nextAscInSeason.episode,
        label: `Ep. ${nextAscInSeason.episode}`,
      };
    }
    const isLastInKnownSeason =
      ascList.length > 0 &&
      selectedEpisode >= ascList[ascList.length - 1].episode;
    const nextSeason = isLastInKnownSeason
      ? availableSeasons.find((s) => s > selectedSeason)
      : undefined;
    if (nextSeason) {
      return {
        season: nextSeason,
        episode: 1,
        label: `Sezonul ${nextSeason} · Ep. 1`,
      };
    }
    if (ascList.length === 0) {
      return {
        season: selectedSeason,
        episode: selectedEpisode + 1,
        label: `Ep. ${selectedEpisode + 1}`,
      };
    }
    return null;
  }, [
    activeVodItem,
    episodesSortDesc,
    episodesForSeason,
    selectedEpisode,
    selectedSeason,
    availableSeasons,
    seasonsMap,
  ]);

  const prevEpisodeInfo = useMemo((): {
    season: number;
    episode: number;
    label: string;
  } | null => {
    if (!activeVodItem || activeVodItem.type !== 'series') return null;
    if (selectedEpisode > 1) {
      const descList = [...episodesForSeason].sort(
        (a, b) => b.episode - a.episode
      );
      const prevInAsc = descList.find((ep) => ep.episode < selectedEpisode);
      const targetEp = prevInAsc ? prevInAsc.episode : selectedEpisode - 1;
      return {
        season: selectedSeason,
        episode: targetEp,
        label: `Ep. ${targetEp}`,
      };
    }
    return null;
  }, [
    activeVodItem,
    episodesSortDesc,
    episodesForSeason,
    selectedEpisode,
    selectedSeason,
  ]);

  const lastPlaybackTimeRef = useRef<{ cur: number; dur: number } | null>(null);

  const updateWatchProgress = useCallback(
    (
      item: CinemetaItem,
      season: number,
      episode: number,
      currentTime: number,
      duration: number,
      forcePlayingState?: boolean
    ) => {
      if (item.isAdultKlubnichka || item.id.startsWith('klub_')) {
        return;
      }
      const cleanTime = Math.max(0, Math.floor(currentTime || 0));
      const cleanDur =
        duration && Number.isFinite(duration) && duration > 60
          ? Math.floor(duration)
          : item.type === 'series'
            ? 2700
            : 5400;

      const seasonEpsCount = seasonsMap.get(season)?.length || 0;
      const totalSeasonsCount = availableSeasons.length || 0;

      const prev = watchProgressMapRef.current;
      const existing = findWatchProgressEntry(prev, item);
      const resolvedImdb = item.imdbId || item.imdb_id || existing?.item?.imdbId || existing?.item?.imdb_id;
      const canonicalKey = (resolvedImdb && resolvedImdb.startsWith('tt'))
        ? resolvedImdb
        : (getVodCanonicalKey(item, prev) || getVodCanonicalKey(existing, prev) || item.id);
      const epKey = `S${season}E${episode}`;
      const detailMatch =
        detailedMeta &&
          (detailedMeta.id === item.id ||
            detailedMeta.imdbId === item.imdbId ||
            activeVodItem?.id === item.id ||
            areVodItemsSame(detailedMeta as any, item))
          ? {
            name: detailedMeta.name || item.name,
            nameOriginal: detailedMeta.nameOriginal || item.nameOriginal,
            poster: detailedMeta.poster || item.poster,
            background: detailedMeta.background || item.background,
            imdbRating: detailedMeta.imdbRating || item.imdbRating,
            imdbId: detailedMeta.imdbId || item.imdbId,
          }
          : {};
      const mergedIsAdult18 = Boolean(
        isAdult18WatchItem(item) || isAdult18WatchItem(existing?.item) || section === 'adult_18'
      );
      const mergedItem: CinemetaItem = {
        ...existing?.item,
        ...item,
        ...detailMatch,
        ...(mergedIsAdult18 ? { isAdult18: true } : {}),
        id: canonicalKey,
        imdbId:
          canonicalKey.startsWith('tt')
            ? canonicalKey
            : (item.imdbId || existing?.item.imdbId),
      };
      if (mergedItem.type === 'series') {
        mergedItem.name =
          mergedItem.name.replace(/\s*\(S\d+[^)]*\)\s*/gi, '').trim() ||
          mergedItem.name;
        delete mergedItem.flTorrentId;
        if (/^Stream\s*#/i.test(String(mergedItem.releaseTitle || ''))) {
          delete mergedItem.releaseTitle;
        }
      }
      if (
        String(mergedItem.kpId || '') === '5354824' ||
        mergedItem.id === 'tt27636698' ||
        mergedItem.imdbId === 'tt27636698'
      ) {
        mergedItem.name = 'Шоу Воли (ТНТ)';
        mergedItem.kpId = '5354824';
        delete mergedItem.nameOriginal;
      }
      const isEpDoneNow = cleanDur > 60 && cleanTime >= cleanDur * 0.85;
      const existingEpProg = existing?.episodeProgressMap?.[epKey];
      const nextEpWatched = isEpDoneNow
        ? true
        : cleanTime >= 15
          ? false
          : existingEpProg?.isWatched;
      const updatedEpProgressMap: Record<string, EpisodeProgress> = {
        ...(existing?.episodeProgressMap || {}),
        [epKey]: {
          currentTime: cleanTime,
          duration: cleanDur,
          updatedAt: Date.now(),
          ...(typeof nextEpWatched === 'boolean' ? { isWatched: nextEpWatched } : {}),
        },
      };
      let nextWholeWatched: boolean | undefined = existing?.isWatched;
      if (mergedItem.type === 'series') {
        if (
          seasonsMap.size > 0 &&
          detailedMeta &&
          (detailedMeta.id === mergedItem.id || areVodItemsSame(detailedMeta as any, mergedItem))
        ) {
          let totalKnown = 0;
          let watchedKnown = 0;
          seasonsMap.forEach((epsList, sN) => {
            for (const epItem of epsList) {
              totalKnown += 1;
              if (isEpisodeProgressWatched(updatedEpProgressMap[`S${sN}E${epItem.episode}`])) {
                watchedKnown += 1;
              }
            }
          });
          nextWholeWatched = totalKnown > 0 && watchedKnown >= totalKnown;
        } else if (nextEpWatched === false && cleanTime >= 15) {
          nextWholeWatched = false;
        }
      } else {
        nextWholeWatched = isEpDoneNow
          ? true
          : cleanTime >= 15
            ? false
            : existing?.isWatched;
      }

      const nextEntry: VodWatchProgressEntry = {
        item: mergedItem,
        season,
        episode,
        currentTime: cleanTime,
        duration: cleanDur,
        server: activeServer,
        subLang: preferredSubLang,
        updatedAt: Date.now(),
        deviceName: detectCurrentDeviceName(),
        deviceId: getOrCreateCurrentDeviceId(),
        isPlayingNow: typeof forcePlayingState === 'boolean' ? forcePlayingState : isPlayingVodRef.current,
        ...(typeof nextWholeWatched === 'boolean' ? { isWatched: nextWholeWatched } : {}),
        totalEpisodesInSeason:
          seasonEpsCount > 0
            ? seasonEpsCount
            : existing?.totalEpisodesInSeason,
        totalSeasons:
          totalSeasonsCount > 0 ? totalSeasonsCount : existing?.totalSeasons,
        episodesSortDesc:
          typeof episodesSortDesc === 'boolean'
            ? episodesSortDesc
            : existing?.episodesSortDesc,
        episodeProgressMap: updatedEpProgressMap,
      };
      const next: Record<string, VodWatchProgressEntry> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!v || typeof v !== 'object') continue;
        if (k !== canonicalKey && (k === item.id || areVodItemsSame(v.item, item))) {
          continue; // prune duplicate alias
        }
        next[k] = v;
      }
      next[canonicalKey] = nextEntry;
      const cleanMap = deduplicateProgressMap(next);
      watchProgressMapRef.current = cleanMap;
      const isStillPlaying = typeof forcePlayingState === 'boolean' ? forcePlayingState : isPlayingVodRef.current;
      saveWatchProgressMap(cleanMap, activeProfileId, { immediateCloud: !isStillPlaying });
      if (
        !isStillPlaying ||
        !isPlayingVodRef.current ||
        isEpisodesDrawerOpenRef.current ||
        !existing?.isPlayingNow
      ) {
        setWatchProgressMap(cleanMap);
      }
    },
    [
      activeProfileId,
      activeServer,
      preferredSubLang,
      seasonsMap,
      availableSeasons.length,
      resolvedFileListStream,
      episodesSortDesc,
      section,
    ]
  );

  const flushPlaybackOnClose = useCallback(() => {
    if (activeVodItem && lastPlaybackTimeRef.current) {
      const { cur, dur } = lastPlaybackTimeRef.current;
      if (cur > 1) {
        updateWatchProgress(
          activeVodItem,
          selectedSeason,
          selectedEpisode,
          cur,
          dur,
          false // forcePlayingState = false
        );
      }
    }
  }, [activeVodItem, selectedSeason, selectedEpisode, updateWatchProgress]);

  const handleCloseVodPlayerBack = useCallback(() => {
    const now = Date.now();
    if (now - lastVodPlayerBackAtRef.current < 420) return;
    lastVodPlayerBackAtRef.current = now;
    flushPlaybackOnClose();
    exitNativeDocumentFullscreen();
    window.dispatchEvent(
      new CustomEvent('aether:vod-custom-fullscreen-toggle', {
        detail: { force: false },
      })
    );
    setIsMobileCustomFullscreen(false);
    setIsEpisodesDrawerOpen(false);
    setIsInfoSheetOpen(false);
    setIsPlayingVod(false);
    if (activeVodItem?.id.startsWith('yt_') || activeVodItem?.isAdultKlubnichka) {
      setActiveVodItem(null);
      if (!activeVodItem?.isAdultKlubnichka && !isMobilePhone) {
        setIsSidebarOpen(true);
      }
    }
  }, [activeVodItem, flushPlaybackOnClose, isMobilePhone]);

  const handleHeaderCatalogBack = useCallback(() => {
    const now = Date.now();
    if (now - lastHeaderCatalogBackAtRef.current < 420) return;
    lastHeaderCatalogBackAtRef.current = now;
    isMobileChromeHiddenRef.current = false;
    scrollDeltaAccumRef.current = 0;
    lastMainScrollTopRef.current = 0;
    setIsMobileChromeHidden(false);
    setIsPlayingVod(false);
    setIsInfoSheetOpen(false);
    setIsDownloadModalOpen(false);
    setActiveVodItem(null);
    if (
      !isCarMode &&
      !isMobilePhone &&
      (typeof window === 'undefined' || window.innerWidth >= 768)
    ) {
      setIsSidebarOpen(true);
    }
  }, [isCarMode, isMobilePhone]);

  // Real-time Cross-Device Playback Heartbeat & Watch Progress Tracking while a video is playing on this device
  useEffect(() => {
    if (!isPlayingVod || !activeVodItem) return;
    if (activeVodItem.isAdultKlubnichka || activeVodItem.id.startsWith('klub_')) return;
    const activeId = getVodCanonicalKey(activeVodItem) || activeVodItem.id;
    const curDevName = detectCurrentDeviceName();
    const curDevId = getOrCreateCurrentDeviceId();

    // Ensure watch progress entry exists immediately when playback starts (e.g. searched shows like Comedy Club or any VOD)
    const initialSec = Math.max(5, Math.floor(resumeStartSeconds || 0));
    const estimatedDur = activeVodItem.type === 'series' ? 2700 : 5400;
    if (!findWatchProgressEntry(watchProgressMapRef.current, activeVodItem)) {
      updateWatchProgress(activeVodItem, selectedSeason, selectedEpisode, initialSec, estimatedDur);
    }

    const isNativeHls = (activeServer === 'filelist_torrent' && resolvedFileListStream?.ok && resolvedFileListStream.streamUrl) ||
      Boolean(matchedOfflineVodItem) ||
      Boolean(
        resolvedDirectStream?.ok &&
        (resolvedDirectStream.dashUrl ||
          resolvedDirectStream.hlsUrl ||
          resolvedDirectStream.proxyHlsUrl)
      );

    let iframeElapsed = initialSec;

    const markPlayingState = (playing: boolean, fromHeartbeat = false) => {
      const latestMap = watchProgressMapRef.current;
      const cur = findWatchProgressEntry(latestMap, activeVodItem);
      if (!cur) {
        if (playing) {
          updateWatchProgress(activeVodItem, selectedSeason, selectedEpisode, iframeElapsed, estimatedDur);
        }
        return;
      }
      if (
        playing &&
        fromHeartbeat &&
        cur.isPlayingNow &&
        Date.now() - (cur.updatedAt || 0) < 12000
      ) {
        return;
      }
      if (!isNativeHls && playing && fromHeartbeat) {
        iframeElapsed += 15;
        updateWatchProgress(activeVodItem, selectedSeason, selectedEpisode, iframeElapsed, cur.duration || estimatedDur);
        return;
      }
      const next: Record<string, VodWatchProgressEntry> = {};
      for (const [k, v] of Object.entries(latestMap)) {
        if (!v || typeof v !== 'object') continue;
        if (k !== activeId && areVodItemsSame(v.item, activeVodItem)) {
          continue;
        }
        next[k] = v;
      }
      const effCurTime =
        lastPlaybackTimeRef.current?.cur && lastPlaybackTimeRef.current.cur > 1
          ? Math.max(cur.currentTime || 0, lastPlaybackTimeRef.current.cur)
          : cur.currentTime;
      next[activeId] = {
        ...cur,
        currentTime: effCurTime,
        deviceName: curDevName,
        deviceId: curDevId,
        isPlayingNow: playing,
        updatedAt: Date.now(),
      };
      const cleanNext = deduplicateProgressMap(next);
      watchProgressMapRef.current = cleanNext;
      saveWatchProgressMap(cleanNext, activeProfileId, {
        immediateCloud: !playing || !fromHeartbeat,
      });
      if (!playing || !fromHeartbeat) {
        setWatchProgressMap(cleanNext);
      }
    };

    markPlayingState(true, false);
    const hb = window.setInterval(() => {
      markPlayingState(true, true);
    }, 30000);

    const handlePageUnload = () => {
      markPlayingState(false, false);
    };
    window.addEventListener('beforeunload', handlePageUnload);
    window.addEventListener('pagehide', handlePageUnload);

    return () => {
      window.clearInterval(hb);
      window.removeEventListener('beforeunload', handlePageUnload);
      window.removeEventListener('pagehide', handlePageUnload);
      markPlayingState(false, false);
    };
  }, [isPlayingVod, activeVodItem?.id, activeProfileId]);

  // Auto-hide resume prompt after 6 seconds of active video playback so it never clutters the video screen
  useEffect(() => {
    if (pendingResumePromptSec === null || !isPlayingVod) return;
    const t = window.setTimeout(() => setPendingResumePromptSec(null), 6000);
    return () => window.clearTimeout(t);
  }, [pendingResumePromptSec, isPlayingVod]);

  const lastSyncedProgressHashRef = useRef<Record<string, string>>({});
  const lastSyncedSavedHashRef = useRef<Record<string, string>>({});
  const lastFullSyncAtRef = useRef<Record<string, number>>({});

  // Sync watch progress & saved favorites across devices (GET when unchanged, 300s cloud poll, 120s focus cooldown)
  useEffect(() => {
    let syncEffectCancelled = false;
    const applyRemoteProgress = (
      remote: Record<string, VodWatchProgressEntry> | null,
      targetProfileId = activeProfileId
    ) => {
      if (syncEffectCancelled || !remote || typeof remote !== 'object') return;
      if (activeProfileIdRef.current !== targetProfileId) return;
      setWatchProgressMap((prev) => {
        const currentLocal = loadWatchProgressMap(targetProfileId);
        const merged = { ...currentLocal };
        let changed = false;
        const localFl = isLocalHomeServer();
        for (const [k, v] of Object.entries(remote)) {
          if (!v || typeof v !== 'object' || !v.item) continue;
          const existing = merged[k];
          const vCleared =
            (v.currentTime || 0) === 0 &&
            (!v.episodeProgressMap ||
              Object.keys(v.episodeProgressMap).length === 0);
          const mergedEpMap = vCleared
            ? {}
            : {
              ...(existing?.episodeProgressMap || {}),
              ...(v.episodeProgressMap || {}),
            };
          if (
            !vCleared &&
            existing?.episodeProgressMap &&
            v.episodeProgressMap
          ) {
            for (const [epK, epV] of Object.entries(v.episodeProgressMap)) {
              const prevEp = existing.episodeProgressMap[epK];
              if (!prevEp || (epV?.updatedAt || 0) >= (prevEp?.updatedAt || 0)) {
                mergedEpMap[epK] = epV;
              } else {
                mergedEpMap[epK] = prevEp;
              }
            }
          }
          const keepAdult18OnMerge =
            isAdult18WatchItem(existing?.item) || isAdult18WatchItem(v.item);
          const cleanEntry: VodWatchProgressEntry = {
            ...existing,
            ...v,
            item: {
              ...(existing?.item || {}),
              ...v.item,
              ...(keepAdult18OnMerge ? { isAdult18: true } : {}),
            },
            deviceName: v.deviceName
              ? sanitizeDeviceName(v.deviceName)
              : v.deviceName,
            server:
              !localFl &&
                (v.server === 'filelist_torrent' || v.server === 'vidspark')
                ? 'kinogram_hls'
                : v.server,
            episodeProgressMap: mergedEpMap,
          };
          if (
            !existing ||
            (cleanEntry.updatedAt || 0) > (existing.updatedAt || 0) ||
            Object.keys(mergedEpMap).length >
            Object.keys(existing.episodeProgressMap || {}).length ||
            existing.deviceName !== sanitizeDeviceName(existing.deviceName)
          ) {
            merged[k] =
              !existing || (cleanEntry.updatedAt || 0) >= (existing.updatedAt || 0)
                ? cleanEntry
                : {
                    ...existing,
                    ...(keepAdult18OnMerge
                      ? { item: { ...existing.item, isAdult18: true } }
                      : {}),
                    episodeProgressMap: mergedEpMap,
                  };
            changed = true;
          }
        }
        if (!changed) {
          return prev;
        }
        try {
          localStorage.setItem(
            getWatchProgressKeyForProfile(targetProfileId),
            JSON.stringify(merged)
          );
        } catch {
          // ignore
        }
        watchProgressMapRef.current = merged;
        return merged;
      });
    };

    const syncProgressAndSaved = (force = false) => {
      if (
        isPlayingVodRef.current ||
        (typeof document !== 'undefined' && document.visibilityState === 'hidden')
      ) {
        return;
      }
      const currentProf = activeProfileId;
      const now = Date.now();
      const lastAt = lastFullSyncAtRef.current[currentProf] || 0;
      if (!force && now - lastAt < 120_000) {
        return;
      }
      lastFullSyncAtRef.current[currentProf] = now;

      const cleanProf = encodeURIComponent(currentProf);
      const local = loadWatchProgressMap(currentProf);
      const bodyStr = JSON.stringify(local);
      const progressDirty = lastSyncedProgressHashRef.current[currentProf] !== bodyStr;
      const servedByLocalNode =
        typeof window !== 'undefined' && window.location.port === '8769';
      fetch(`/api/tv-progress?profileId=${cleanProf}`, {
        ...(progressDirty
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: bodyStr,
            }
          : { cache: 'no-store' as RequestCache }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((remote: Record<string, VodWatchProgressEntry> | null) => {
          if (activeProfileId !== currentProf) return;
          if (remote && typeof remote === 'object') {
            lastSyncedProgressHashRef.current[currentProf] = bodyStr;
          }
          applyRemoteProgress(remote, currentProf);
          if (isLocalHomeServer() && !servedByLocalNode) {
            const payloadToCloud = JSON.stringify(
              remote && typeof remote === 'object' ? remote : local
            );
            const cloudDirty = progressDirty || payloadToCloud !== bodyStr;
            fetch(`https://filmio.my/api/tv-progress?profileId=${cleanProf}`, {
              ...(cloudDirty
                ? {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payloadToCloud,
                  }
                : { cache: 'no-store' as RequestCache }),
            })
              .then((cr) => (cr.ok ? cr.json() : null))
              .then((cloudRemote) => {
                if (activeProfileId !== currentProf) return;
                applyRemoteProgress(cloudRemote, currentProf);
              })
              .catch(() => { });
          }
        })
        .catch(() => { });

      const localSaved = loadSavedVodItems(currentProf);
      const removedSavedMap = loadRemovedSavedVodMap(currentProf);
      const removedSavedStr = JSON.stringify(removedSavedMap);
      const savedBodyStr = JSON.stringify(localSaved);
      const savedSyncSignature = `${savedBodyStr}|${removedSavedStr}`;
      const savedDirty = lastSyncedSavedHashRef.current[currentProf] !== savedSyncSignature;
      let serverRemovedSavedMap: Record<string, number> = {};
      fetch(`/api/tv-saved?profileId=${cleanProf}`, {
        ...(savedDirty
          ? {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Removed-Vod-Ids': removedSavedStr,
              },
              body: savedBodyStr,
            }
          : { cache: 'no-store' as RequestCache }),
      })
        .then(async (r) => {
          if (!r.ok) return null;
          try {
            const rawRem = r.headers.get('X-Server-Removed-Vod-Ids');
            if (rawRem) {
              const parsed = JSON.parse(rawRem);
              if (parsed && typeof parsed === 'object') {
                serverRemovedSavedMap = parsed;
              }
            }
          } catch {
            // ignore
          }
          return r.json();
        })
        .then((remoteSaved: CinemetaItem[] | null) => {
          if (syncEffectCancelled || activeProfileIdRef.current !== currentProf) return;
          if (Array.isArray(remoteSaved)) {
            lastSyncedSavedHashRef.current[currentProf] = savedSyncSignature;
            setSavedVodItems((prev) => {
              const currentLocalSaved = loadSavedVodItems(currentProf);
              const mergedRemoved: Record<string, number> = {
                ...loadRemovedSavedVodMap(currentProf),
                ...serverRemovedSavedMap,
              };
              const seen = new Set<string>();
              const nextMerged: CinemetaItem[] = [];
              for (const item of remoteSaved) {
                if (!item || !item.id || seen.has(item.id)) continue;
                const remTs = mergedRemoved[item.id] || 0;
                const itemTs = item.savedAt || 0;
                if (remTs > 0 && remTs > itemTs) continue;
                seen.add(item.id);
                nextMerged.push(item);
              }
              for (const item of currentLocalSaved) {
                if (!item || !item.id || seen.has(item.id)) continue;
                const remTs = serverRemovedSavedMap[item.id] || 0;
                const itemTs = item.savedAt || 0;
                if (remTs > 0 && remTs > itemTs) continue;
                seen.add(item.id);
                nextMerged.push(item);
              }
              const prevIds = prev.map((x) => x.id).join(',');
              const nextIds = nextMerged.map((x) => x.id).join(',');
              if (prevIds === nextIds && prev.length === nextMerged.length) {
                return prev;
              }
              try {
                localStorage.setItem(
                  getSavedVodKeyForProfile(currentProf),
                  JSON.stringify(nextMerged)
                );
              } catch {
                // ignore
              }
              return nextMerged;
            });
          }
        })
        .catch(() => { });

      void syncRadioFavoritesWithServer(currentProf);
    };

    switchRadioFavoritesProfile(activeProfileId);
    syncProgressAndSaved(true);
    const intervalMs = isLocalHomeServer() ? 90_000 : 300_000;
    const timer = window.setInterval(() => syncProgressAndSaved(false), intervalMs);
    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        syncProgressAndSaved(false);
      }
    };
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);
    return () => {
      syncEffectCancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
  }, [
    activeProfileId,
    switchRadioFavoritesProfile,
    syncRadioFavoritesWithServer,
  ]);

  // Handle cross-device handoff URL parameters (?profile=...&resume=tt...&s=...&e=...&t=...)
  const handledUrlResumeRef = useRef<boolean>(false);
  useEffect(() => {
    if (handledUrlResumeRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const resumeId = params.get('resume');
    if (!resumeId) return;
    handledUrlResumeRef.current = true;
    const urlProf = params.get('profile');
    if (urlProf && urlProf !== activeProfileId) {
      handleSelectProfile(urlProf, { pinVerified: false });
      const targetProfObj = loadTvProfiles().find((p) => p.id === urlProf);
      if (targetProfObj?.pin?.trim() && !isProfileRememberedOnDevice(targetProfObj)) {
        return;
      }
    }
    setIsProfilePickerOpen(false);
    const sNum = Number(params.get('s')) || 1;
    const eNum = Number(params.get('e')) || 1;
    const tSec = Number(params.get('t')) || 0;
    const mType = params.get('type') === 'series' ? 'series' : 'movie';

    const existingEntry = findWatchProgressEntry(watchProgressMap, resumeId);
    if (existingEntry?.item) {
      handleOpenVod(existingEntry.item, false);
      setSelectedSeason(sNum);
      setSelectedEpisode(eNum);
      if (tSec > 5) {
        setResumeStartSeconds(tSec);
        setPendingResumePromptSec(tSec);
      }
      return;
    }

    if (resumeId.startsWith('tt')) {
      fetch(`https://v3-cinemeta.strem.io/meta/${mType}/${resumeId}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.meta) {
            handleOpenVod({ ...d.meta, id: resumeId, type: mType }, false);
            setSelectedSeason(sNum);
            setSelectedEpisode(eNum);
            if (tSec > 5) {
              setResumeStartSeconds(tSec);
              setPendingResumePromptSec(tSec);
            }
          }
        })
        .catch(() => { });
    }
  }, [activeProfileId, handleOpenVod, handleSelectProfile, watchProgressMap]);

  const [favToast, setFavToast] = useState<{
    message: string;
    isFav: boolean;
    kind?: 'fav' | 'watched';
  } | null>(null);
  const favToastTimerRef = useRef<number | null>(null);

  const showVodActionToast = useCallback(
    (message: string, isActive = true, kind: 'fav' | 'watched' = 'fav') => {
      if (favToastTimerRef.current) {
        window.clearTimeout(favToastTimerRef.current);
      }
      setFavToast({ message, isFav: isActive, kind });
      favToastTimerRef.current = window.setTimeout(() => {
        setFavToast(null);
      }, 1900);
    },
    []
  );

  const toggleSaveVodItem = useCallback((item: CinemetaItem) => {
    setSavedVodItems((prev) => {
      const exists = prev.some((x) => x.id === item.id);
      const stampedItem: CinemetaItem = exists
        ? item
        : { ...item, savedAt: Date.now() };
      const next = exists
        ? prev.filter((x) => x.id !== item.id)
        : [stampedItem, ...prev];
      const nextRemovedMap = markSavedVodRemoved(item.id, exists, activeProfileId);
      saveSavedVodItems(next, activeProfileId, nextRemovedMap);

      showVodActionToast(
        exists
          ? tr(
              `Eliminat din Favorite · ${item.name}`,
              `Removed from Favorites · ${item.name}`,
              `Удалено из избранного · ${item.name}`
            )
          : tr(
              `Salvat la Favorite · ${item.name}`,
              `Saved to Favorites · ${item.name}`,
              `В избранном · ${item.name}`
            ),
        !exists,
        'fav'
      );

      return next;
    });
  }, [activeProfileId, tr, showVodActionToast]);

  toggleSaveVodItemRef.current = toggleSaveVodItem;

  const historyList = useMemo<VodWatchProgressEntry[]>(() => {
    const isAdultAllowed = activeProfile?.id === 'p1' || (activeProfile as any)?.role === 'admin' || (activeProfile as any)?.allowAdult;
    const cleanMap: Record<string, VodWatchProgressEntry> = deduplicateProgressMap(watchProgressMap);
    return Object.values(cleanMap)
      .filter(
        (e) =>
          e &&
          e.item &&
          (e.isWatched === true ||
            e.currentTime > 0 ||
            (e.episodeProgressMap &&
              Object.values(e.episodeProgressMap).some(
                (epProg) => isEpisodeProgressWatched(epProg) || (epProg?.currentTime || 0) > 0
              ))) &&
          !isAdult18WatchItem(e.item) &&
          (isAdultAllowed ||
            (!e.item?.isAdultKlubnichka &&
              !e.item?.id?.startsWith('klub_') &&
              !e.item?.genres?.includes('Adult') &&
              !e.item?.genres?.includes('18+ Adult')))
      )
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [watchProgressMap, activeProfile]);

  // Isolated Watch History strictly for Cinema 18+ (JEKA only — never shown on Home or general Istoric)
  const adult18HistoryList = useMemo<VodWatchProgressEntry[]>(() => {
    if (!isAdminJekaProfile(activeProfile)) return [];
    const cleanMap: Record<string, VodWatchProgressEntry> = deduplicateProgressMap(watchProgressMap);
    return Object.values(cleanMap)
      .filter(
        (e) =>
          e &&
          e.item &&
          isAdult18WatchItem(e.item) &&
          (e.isWatched === true ||
            e.currentTime > 0 ||
            (e.episodeProgressMap &&
              Object.values(e.episodeProgressMap).some(
                (epProg) => isEpisodeProgressWatched(epProg) || (epProg?.currentTime || 0) > 0
              )))
      )
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [watchProgressMap, activeProfile]);

  // Load suggestions from same theme/category when watching Klubnichka 18+
  useEffect(() => {
    if (!activeVodItem?.isAdultKlubnichka || !isPlayingVod) {
      setIsKlubSuggestionsOpen(false);
      return;
    }

    const currentRawId = activeVodItem.klubnichkaRawId;
    const currentId = activeVodItem.id;
    const cachedItems = (persistedKlubCache.items || []).filter(
      (c) => c.id !== currentId && (!currentRawId || c.rawVideoId !== currentRawId)
    );

    if (cachedItems.length > 0) {
      setKlubSuggestions(cachedItems.slice(0, 18));
    }

    let isCancelled = false;
    const src = persistedKlubCache.selectedSource || 'pornhub';
    const cat = persistedKlubCache.selectedCategory || 'trending';

    fetchKlubnichkaCatalog({
      source: src,
      category: cat,
      page: 1,
    })
      .then((res) => {
        if (isCancelled || !res?.items || res.items.length === 0) return;
        const filtered = res.items.filter(
          (c) => c.id !== currentId && (!currentRawId || c.rawVideoId !== currentRawId)
        );
        if (filtered.length > 0) {
          setKlubSuggestions(filtered.slice(0, 18));
        }
      })
      .catch(() => { });

    return () => {
      isCancelled = true;
    };
  }, [activeVodItem?.id, activeVodItem?.isAdultKlubnichka, isPlayingVod]);

  const nextKlubCard = useMemo<KlubnichkaVideoCard | null>(() => {
    if (!activeVodItem?.isAdultKlubnichka) return null;
    const allItems = persistedKlubCache.items || [];
    const curIdx = allItems.findIndex(
      (c) =>
        c.id === activeVodItem.id ||
        (activeVodItem.klubnichkaRawId && c.rawVideoId === activeVodItem.klubnichkaRawId)
    );
    if (curIdx >= 0 && curIdx + 1 < allItems.length) {
      return allItems[curIdx + 1];
    }
    if (klubSuggestions.length > 0) {
      return klubSuggestions[0];
    }
    if (allItems.length > 0 && allItems[0].id !== activeVodItem.id) {
      return allItems[0];
    }
    return null;
  }, [activeVodItem?.id, activeVodItem?.isAdultKlubnichka, klubSuggestions]);

  triggerHomeQuickPlayRef.current = () => {
    if (
      section !== 'home' ||
      isPlayingVod ||
      Boolean(activeVodItem) ||
      Boolean(currentTvChannel) ||
      isTvRadioPlayerOpen ||
      isProfilePickerOpen ||
      isPinLockRequired ||
      isHandoffModalOpen ||
      isSettingsDrawerOpen ||
      isFilterDrawerOpen ||
      isCatalogDrawerOpen ||
      isSubFinderOpen ||
      Boolean(selectedActor) ||
      isTrailerModalOpen
    ) {
      return false;
    }
    const activeEl = document.activeElement as HTMLElement | null;
    const activeTag = activeEl?.tagName?.toLowerCase();
    if (activeTag === 'input' || activeTag === 'textarea') {
      return false;
    }
    if (activeEl?.closest('main')) {
      return false;
    }
    const fallbackHistory =
      historyList.length > 0
        ? historyList
        : Object.values(watchProgressMapRef.current)
          .filter(
            (e) =>
              e &&
              e.item &&
              !isAdult18WatchItem(e.item) &&
              (e.currentTime > 0 ||
                (e.episodeProgressMap &&
                  Object.keys(e.episodeProgressMap).length > 0))
          )
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const latestEntry = fallbackHistory[0];
    if (!latestEntry?.item) {
      return false;
    }
    const now = Date.now();
    if (now - lastHomeQuickPlayAtRef.current < 500) {
      return true;
    }
    lastHomeQuickPlayAtRef.current = now;
    if (playerStatus === 'playing' || playerStatus === 'loading') {
      stopRadio();
    }
    const resumeSeason =
      latestEntry.item.type === 'series'
        ? Math.max(1, Number(latestEntry.season) || 1)
        : 1;
    const resumeEpisode =
      latestEntry.item.type === 'series'
        ? Math.max(1, Number(latestEntry.episode) || 1)
        : 1;
    handleOpenVod(latestEntry.item, true, resumeSeason, resumeEpisode);
    return true;
  };

  useEffect(() => {
    const onHomePlayRequest = (ev: Event) => {
      if (triggerHomeQuickPlayRef.current()) {
        ev.preventDefault();
      }
    };
    window.addEventListener('aether:tv-home-play-request', onHomePlayRequest);
    const isDedicatedSmartTv =
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('smart-tv-mode');
    let registeredTvHomePlay = false;
    if (
      isDedicatedSmartTv &&
      typeof navigator !== 'undefined' &&
      'mediaSession' in navigator &&
      section === 'home' &&
      !currentMusicTrack &&
      !isPlayingVod &&
      !activeVodItem &&
      !currentTvChannel &&
      playerStatus !== 'playing' &&
      playerStatus !== 'loading' &&
      historyList.length > 0
    ) {
      try {
        navigator.mediaSession.setActionHandler('play', () => {
          triggerHomeQuickPlayRef.current();
        });
        registeredTvHomePlay = true;
      } catch {
        // ignore unsupported MediaSession handlers
      }
    }
    return () => {
      window.removeEventListener(
        'aether:tv-home-play-request',
        onHomePlayRequest
      );
      if (
        registeredTvHomePlay &&
        typeof navigator !== 'undefined' &&
        'mediaSession' in navigator &&
        !window.__aetherMediaSessionOwner
      ) {
        try {
          navigator.mediaSession.setActionHandler('play', null);
        } catch {
          // ignore
        }
      }
    };
  }, [
    section,
    currentMusicTrack,
    isPlayingVod,
    activeVodItem,
    currentTvChannel,
    playerStatus,
    historyList.length,
  ]);

  const [seriesEpStatsMap, setSeriesEpStatsMap] = useState<
    Record<string, SeriesEpisodeStats>
  >({});

  const continueWatchingList = useMemo<VodWatchProgressEntry[]>(() => {
    return historyList.filter((e) => {
      const stats =
        seriesEpStatsMap[e.item.id] ||
        (e.item.imdbId ? seriesEpStatsMap[e.item.imdbId] : undefined);
      return !isVodEntryWatched(e, stats);
    });
  }, [historyList, seriesEpStatsMap]);
  const attemptedSeriesStatsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const candidates: CinemetaItem[] = [];
    const seen = new Set<string>();
    const pushIfSeries = (it?: CinemetaItem | null) => {
      if (!it || it.type !== 'series' || !it.id || seen.has(it.id)) return;
      seen.add(it.id);
      if (!attemptedSeriesStatsRef.current.has(it.id)) {
        candidates.push(it);
      }
    };

    for (const e of historyList.slice(0, 16)) pushIfSeries(e.item);
    for (const it of homeShelves.watchingNowMix) pushIfSeries(it);
    for (const it of homeShelves.newlyAddedMix) pushIfSeries(it);
    for (const it of homeShelves.popularSeries) pushIfSeries(it);
    for (const it of vodItems.slice(0, 48)) pushIfSeries(it);
    for (const it of savedVodItems.slice(0, 36)) pushIfSeries(it);
    for (const it of searchResults.slice(0, 36)) pushIfSeries(it);

    const toFetch = candidates.slice(0, 36);
    if (toFetch.length === 0) return;

    let cancelled = false;
    const debounceTimer = window.setTimeout(() => {
      if (cancelled) return;
      for (const it of toFetch) {
        attemptedSeriesStatsRef.current.add(it.id);
      }
      void (async () => {
        const collected: Record<string, SeriesEpisodeStats> = {};
        const batchSize = 6;
        for (let i = 0; i < toFetch.length; i += batchSize) {
          if (cancelled) break;
          const batch = toFetch.slice(i, i + batchSize);
          const results = await Promise.all(
            batch.map(async (it) => ({
              id: it.id,
              stats: await resolveSeriesEpisodeStats(it),
            }))
          );
          if (cancelled) break;
          for (const r of results) {
            collected[r.id] = r.stats || { episodesCount: 0, seasonsCount: 0 };
          }
        }
        if (cancelled) return;
        const collectedEntries = Object.entries(collected);
        if (collectedEntries.length === 0) return;
        setSeriesEpStatsMap((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const [id, st] of collectedEntries) {
            const cur = prev[id];
            if (
              !cur ||
              cur.episodesCount !== st.episodesCount ||
              cur.seasonsCount !== st.seasonsCount
            ) {
              next[id] = st;
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      })();
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(debounceTimer);
    };
  }, [
    historyList,
    homeShelves.watchingNowMix,
    homeShelves.newlyAddedMix,
    homeShelves.popularSeries,
    vodItems,
    savedVodItems,
    searchResults,
  ]);

  const handleToggleWatchedStatus = useCallback(
    (
      targetItem?: CinemetaItem | null,
      targetSeason?: number,
      targetEpisode?: number,
      options?: { wholeSeries?: boolean }
    ) => {
      const item = targetItem || activeVodItem || lastFocusedVodItemRef.current;
      if (!item || item.isAdultKlubnichka || String(item.id || '').startsWith('klub_')) return;

      const isSeries = item.type === 'series';
      const isWholeSeries = isSeries && Boolean(options?.wholeSeries);
      const prevSnapshot = watchProgressMapRef.current;
      const existingSnap = findWatchProgressEntry(prevSnapshot, item);
      const statsSnap =
        seriesEpStatsMap[item.id] ||
        (item.imdbId ? seriesEpStatsMap[item.imdbId] : undefined);

      let toastMsg = '';
      let toastActive = false;

      if (isWholeSeries) {
        const wasWatched = isVodEntryWatched(existingSnap, statsSnap);
        toastActive = !wasWatched;
        toastMsg = wasWatched
          ? tr(
              `Anulat din văzute · ${item.name}`,
              `Unmarked watched · ${item.name}`,
              `Снята отметка · ${item.name}`
            )
          : tr(
              `Serial marcat văzut ✓ · ${item.name}`,
              `Series marked watched ✓ · ${item.name}`,
              `Сериал просмотрен ✓ · ${item.name}`
            );
      } else if (isSeries) {
        const sNum = targetSeason ?? selectedSeason ?? 1;
        const epNum = targetEpisode ?? selectedEpisode ?? 1;
        const epProg = existingSnap?.episodeProgressMap?.[`S${sNum}E${epNum}`];
        const wasEpWatched = isEpisodeProgressWatched(epProg);
        toastActive = !wasEpWatched;
        toastMsg = wasEpWatched
          ? tr(
              `S${sNum}:E${epNum} anulat din văzute · ${item.name}`,
              `S${sNum}:E${epNum} unmarked · ${item.name}`,
              `S${sNum}:E${epNum} снято · ${item.name}`
            )
          : tr(
              `S${sNum}:E${epNum} marcat văzut ✓ · ${item.name}`,
              `S${sNum}:E${epNum} watched ✓ · ${item.name}`,
              `S${sNum}:E${epNum} просмотрено ✓ · ${item.name}`
            );
      } else {
        const wasMovieWatched = isVodEntryWatched(existingSnap);
        toastActive = !wasMovieWatched;
        toastMsg = wasMovieWatched
          ? tr(
              `Anulat din văzute · ${item.name}`,
              `Unmarked watched · ${item.name}`,
              `Снята отметка · ${item.name}`
            )
          : tr(
              `Marcat ca văzut ✓ · ${item.name}`,
              `Marked as watched ✓ · ${item.name}`,
              `Отмечено просмотренным ✓ · ${item.name}`
            );
      }

      setWatchProgressMap((prev) => {
        const existing = findWatchProgressEntry(prev, item);
        const now = Date.now();
        const resolvedImdb =
          item.imdbId ||
          item.imdb_id ||
          existing?.item?.imdbId ||
          existing?.item?.imdb_id;
        const canonicalKey =
          resolvedImdb && resolvedImdb.startsWith('tt')
            ? resolvedImdb
            : getVodCanonicalKey(item, prev) ||
              getVodCanonicalKey(existing, prev) ||
              item.id;

        const keepAdult18 = Boolean(
          isAdult18WatchItem(item) || isAdult18WatchItem(existing?.item) || section === 'adult_18'
        );
        const baseItem: CinemetaItem = {
          ...(existing?.item || item),
          ...item,
          ...(keepAdult18 ? { isAdult18: true } : {}),
          id: canonicalKey,
          imdbId: canonicalKey.startsWith('tt')
            ? canonicalKey
            : item.imdbId || existing?.item?.imdbId,
        };
        if (baseItem.type === 'series') {
          baseItem.name =
            baseItem.name.replace(/\s*\(S\d+[^)]*\)\s*/gi, '').trim() ||
            baseItem.name;
        }

        const isActiveDetailedSeries =
          isSeries &&
          seasonsMap.size > 0 &&
          (activeVodItem?.id === item.id ||
            (detailedMeta &&
              (detailedMeta.id === item.id || areVodItemsSame(detailedMeta as any, item))));

        let nextEntry: VodWatchProgressEntry;

        if (isWholeSeries) {
          const wasSeriesWatched = isVodEntryWatched(existing, statsSnap);
          const nextWatchedFlag = !wasSeriesWatched;
          const updatedEpMap: Record<string, EpisodeProgress> = {};
          if (existing?.episodeProgressMap) {
            for (const [k, prevEp] of Object.entries(existing.episodeProgressMap)) {
              const d = prevEp?.duration && prevEp.duration > 60 ? prevEp.duration : 2700;
              updatedEpMap[k] = {
                currentTime: nextWatchedFlag ? d : 0,
                duration: d,
                updatedAt: now,
                isWatched: nextWatchedFlag,
              };
            }
          }
          if (isActiveDetailedSeries) {
            seasonsMap.forEach((epsList, sN) => {
              for (const epItem of epsList) {
                const k = `S${sN}E${epItem.episode}`;
                const prevEp = updatedEpMap[k] || existing?.episodeProgressMap?.[k];
                const d = prevEp?.duration && prevEp.duration > 60 ? prevEp.duration : 2700;
                updatedEpMap[k] = {
                  currentTime: nextWatchedFlag ? d : 0,
                  duration: d,
                  updatedAt: now,
                  isWatched: nextWatchedFlag,
                };
              }
            });
          }
          const lastEpDur = existing?.duration && existing.duration > 60 ? existing.duration : 2700;
          nextEntry = {
            ...(existing || {
              item: baseItem,
              season: 1,
              episode: 1,
              server: activeServer,
              subLang: preferredSubLang,
              deviceName: detectCurrentDeviceName(),
              deviceId: getOrCreateCurrentDeviceId(),
            }),
            item: baseItem,
            season: nextWatchedFlag ? existing?.season || 1 : 1,
            episode: nextWatchedFlag ? existing?.episode || 1 : 1,
            currentTime: nextWatchedFlag ? lastEpDur : 0,
            duration: lastEpDur,
            isWatched: nextWatchedFlag,
            isPlayingNow: false,
            updatedAt: now,
            deviceName: detectCurrentDeviceName(),
            deviceId: getOrCreateCurrentDeviceId(),
            episodeProgressMap: updatedEpMap,
          };
        } else if (isSeries) {
          const s = targetSeason ?? selectedSeason ?? 1;
          const ep = targetEpisode ?? selectedEpisode ?? 1;
          const epKey = `S${s}E${ep}`;
          const currentEpProg = existing?.episodeProgressMap?.[epKey];
          const epDur =
            currentEpProg?.duration && currentEpProg.duration > 60
              ? currentEpProg.duration
              : 2700;
          const isCurrentlyWatched = isEpisodeProgressWatched(currentEpProg);
          const nextEpWatched = !isCurrentlyWatched;
          const newEpTime = nextEpWatched ? epDur : 0;

          const updatedEpMap: Record<string, EpisodeProgress> = {
            ...(existing?.episodeProgressMap || {}),
            [epKey]: {
              currentTime: newEpTime,
              duration: epDur,
              updatedAt: now,
              isWatched: nextEpWatched,
            },
          };

          let wholeSeriesWatched = false;
          if (isActiveDetailedSeries) {
            let totalKnown = 0;
            let watchedKnown = 0;
            seasonsMap.forEach((epsList, sN) => {
              for (const epItem of epsList) {
                totalKnown += 1;
                if (isEpisodeProgressWatched(updatedEpMap[`S${sN}E${epItem.episode}`])) {
                  watchedKnown += 1;
                }
              }
            });
            wholeSeriesWatched = totalKnown > 0 && watchedKnown >= totalKnown;
          }

          let pointerSeason = s;
          let pointerEpisode = ep;
          let pointerCurrentTime = newEpTime;
          if (nextEpWatched && isActiveDetailedSeries) {
            const sortedSeasons = [...availableSeasons].sort((a, b) => a - b);
            const curSeasonEps = seasonsMap.get(s) || [];
            const nextInSeason = curSeasonEps.find(
              (cand) => cand.episode > ep && !isEpisodeProgressWatched(updatedEpMap[`S${s}E${cand.episode}`])
            );
            if (nextInSeason) {
              pointerSeason = s;
              pointerEpisode = nextInSeason.episode;
              pointerCurrentTime = updatedEpMap[`S${s}E${nextInSeason.episode}`]?.currentTime || 0;
            } else {
              for (const sN of sortedSeasons.filter((x) => x > s)) {
                const eps = seasonsMap.get(sN) || [];
                const nextUnwatched = eps.find(
                  (cand) => !isEpisodeProgressWatched(updatedEpMap[`S${sN}E${cand.episode}`])
                );
                if (nextUnwatched) {
                  pointerSeason = sN;
                  pointerEpisode = nextUnwatched.episode;
                  pointerCurrentTime = updatedEpMap[`S${sN}E${nextUnwatched.episode}`]?.currentTime || 0;
                  break;
                }
              }
            }
          }

          nextEntry = {
            ...(existing || {
              item: baseItem,
              season: pointerSeason,
              episode: pointerEpisode,
              currentTime: pointerCurrentTime,
              duration: epDur,
              server: activeServer,
              subLang: preferredSubLang,
              deviceName: detectCurrentDeviceName(),
              deviceId: getOrCreateCurrentDeviceId(),
            }),
            item: baseItem,
            season: pointerSeason,
            episode: pointerEpisode,
            currentTime: pointerCurrentTime,
            duration: epDur,
            isWatched: wholeSeriesWatched,
            isPlayingNow: false,
            updatedAt: now,
            deviceName: detectCurrentDeviceName(),
            deviceId: getOrCreateCurrentDeviceId(),
            episodeProgressMap: updatedEpMap,
          };
        } else {
          const movDur =
            existing?.duration && existing.duration > 60 ? existing.duration : 5400;
          const isCurrentlyWatched = isVodEntryWatched(existing);
          const nextMovieWatched = !isCurrentlyWatched;
          const newTime = nextMovieWatched ? movDur : 0;

          nextEntry = {
            ...(existing || {
              item: baseItem,
              season: 1,
              episode: 1,
              server: activeServer,
              subLang: preferredSubLang,
              deviceName: detectCurrentDeviceName(),
              deviceId: getOrCreateCurrentDeviceId(),
            }),
            item: baseItem,
            currentTime: newTime,
            duration: movDur,
            isWatched: nextMovieWatched,
            isPlayingNow: false,
            updatedAt: now,
            deviceName: detectCurrentDeviceName(),
            deviceId: getOrCreateCurrentDeviceId(),
          };
        }

        const next: Record<string, VodWatchProgressEntry> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (!v || typeof v !== 'object') continue;
          if (k !== canonicalKey && (k === item.id || areVodItemsSame(v.item, item))) {
            continue;
          }
          next[k] = v;
        }
        next[canonicalKey] = nextEntry;
        const cleanMap = deduplicateProgressMap(next);
        watchProgressMapRef.current = cleanMap;
        saveWatchProgressMap(cleanMap, activeProfileId, { immediateCloud: true });
        return cleanMap;
      });

      if (!toastActive && activeVodItem && (activeVodItem.id === item.id || areVodItemsSame(activeVodItem, item))) {
        setResumeStartSeconds(0);
        setPendingResumePromptSec(null);
      }
      if (toastMsg) {
        showVodActionToast(toastMsg, toastActive, 'watched');
      }
    },
    [
      activeVodItem,
      detailedMeta,
      seasonsMap,
      availableSeasons,
      seriesEpStatsMap,
      selectedSeason,
      selectedEpisode,
      activeServer,
      preferredSubLang,
      activeProfileId,
      section,
      tr,
      showVodActionToast,
    ]
  );

  const handleToggleSeasonWatched = useCallback(
    (targetItem?: CinemetaItem | null, targetSeason?: number) => {
      const item = targetItem || activeVodItem;
      if (!item || item.type !== 'series') return;

      const sNum = targetSeason ?? selectedSeason ?? 1;
      const seasonEpisodes =
        seasonsMap.get(sNum) || (sNum === selectedSeason ? episodesForSeason : []);
      if (!seasonEpisodes || seasonEpisodes.length === 0) return;

      setWatchProgressMap((prev) => {
        const existing = findWatchProgressEntry(prev, item);
        const now = Date.now();
        const resolvedImdb =
          item.imdbId ||
          item.imdb_id ||
          existing?.item?.imdbId ||
          existing?.item?.imdb_id;
        const canonicalKey =
          resolvedImdb && resolvedImdb.startsWith('tt')
            ? resolvedImdb
            : getVodCanonicalKey(item, prev) ||
              getVodCanonicalKey(existing, prev) ||
              item.id;

        const existingEpMap: Record<string, EpisodeProgress> = {
          ...(existing?.episodeProgressMap || {}),
        };
        const allCurrentlyWatched = seasonEpisodes.every((ep) => {
          const k = `S${sNum}E${ep.episode}`;
          return isEpisodeProgressWatched(existingEpMap[k]);
        });

        const updatedEpMap: Record<string, EpisodeProgress> = {
          ...existingEpMap,
        };
        for (const ep of seasonEpisodes) {
          const k = `S${sNum}E${ep.episode}`;
          const prevEp = existingEpMap[k];
          const d = prevEp?.duration && prevEp.duration > 60 ? prevEp.duration : 2700;
          updatedEpMap[k] = {
            currentTime: allCurrentlyWatched ? 0 : d,
            duration: d,
            updatedAt: now,
            isWatched: !allCurrentlyWatched,
          };
        }

        const sortedSeasons = [...availableSeasons].sort((a, b) => a - b);
        const isEpWatchedInMap = (s: number, e: number): boolean => {
          return isEpisodeProgressWatched(updatedEpMap[`S${s}E${e}`]);
        };
        const isWholeSeriesNowWatched =
          !allCurrentlyWatched &&
          sortedSeasons.length > 0 &&
          sortedSeasons.every((sCheck) => {
            const sList = seasonsMap.get(sCheck) || [];
            return (
              sList.length > 0 &&
              sList.every((epItem) => isEpWatchedInMap(sCheck, epItem.episode))
            );
          });

        let pointerSeason = sNum;
        let pointerEpisode = 1;
        let pointerCurrentTime = 0;
        let pointerDuration = 2700;
        let pointerTotalEps = seasonEpisodes.length;

        if (!allCurrentlyWatched) {
          const candidateSeasons = [
            ...sortedSeasons.filter((x) => x > sNum),
            ...sortedSeasons.filter((x) => x < sNum),
          ];
          let foundNext: {
            season: number;
            episode: number;
            currentTime: number;
            duration: number;
            totalEps: number;
          } | null = null;
          for (const candS of candidateSeasons) {
            const candEps = [...(seasonsMap.get(candS) || [])].sort(
              (a, b) => a.episode - b.episode
            );
            const nextUnwatched = candEps.find(
              (ep) => !isEpWatchedInMap(candS, ep.episode)
            );
            if (nextUnwatched) {
              const epP = updatedEpMap[`S${candS}E${nextUnwatched.episode}`];
              const epD = epP?.duration && epP.duration > 60 ? epP.duration : 2700;
              foundNext = {
                season: candS,
                episode: nextUnwatched.episode,
                currentTime: epP?.currentTime || 0,
                duration: epD,
                totalEps: candEps.length || seasonEpisodes.length,
              };
              break;
            }
          }
          if (foundNext) {
            pointerSeason = foundNext.season;
            pointerEpisode = foundNext.episode;
            pointerCurrentTime = foundNext.currentTime;
            pointerDuration = foundNext.duration;
            pointerTotalEps = foundNext.totalEps;
          } else {
            const sortedSeasonEps = [...seasonEpisodes].sort(
              (a, b) => a.episode - b.episode
            );
            const lastEp = sortedSeasonEps[sortedSeasonEps.length - 1];
            const lastP = updatedEpMap[`S${sNum}E${lastEp.episode}`];
            const lastD =
              lastP?.duration && lastP.duration > 60 ? lastP.duration : 2700;
            pointerSeason = sNum;
            pointerEpisode = lastEp.episode;
            pointerDuration = lastD;
            pointerCurrentTime = Math.max(1, lastD - 1);
            pointerTotalEps = seasonEpisodes.length;
          }
        } else {
          const hasAnyOtherProgress = Object.values(updatedEpMap).some(
            (epP) => (epP?.currentTime || 0) > 0
          );
          if (hasAnyOtherProgress) {
            for (const candS of sortedSeasons) {
              if (candS === sNum) continue;
              const candEps = [...(seasonsMap.get(candS) || [])].sort(
                (a, b) => a.episode - b.episode
              );
              const anyInCand = candEps.some(
                (ep) =>
                  isEpWatchedInMap(candS, ep.episode) ||
                  (updatedEpMap[`S${candS}E${ep.episode}`]?.currentTime || 0) > 0
              );
              if (anyInCand) {
                const firstUnwatched = candEps.find(
                  (ep) => !isEpWatchedInMap(candS, ep.episode)
                );
                const targetEp = firstUnwatched || candEps[candEps.length - 1];
                if (targetEp) {
                  const epP = updatedEpMap[`S${candS}E${targetEp.episode}`];
                  const epD =
                    epP?.duration && epP.duration > 60 ? epP.duration : 2700;
                  pointerSeason = candS;
                  pointerEpisode = targetEp.episode;
                  pointerCurrentTime = firstUnwatched
                    ? epP?.currentTime || 0
                    : Math.max(1, epD - 1);
                  pointerDuration = epD;
                  pointerTotalEps = candEps.length || seasonEpisodes.length;
                  break;
                }
              }
            }
          }
        }

        const detailMatch =
          detailedMeta &&
          (detailedMeta.id === item.id ||
            detailedMeta.imdbId === item.imdbId ||
            activeVodItem?.id === item.id ||
            areVodItemsSame(detailedMeta as any, item))
            ? {
                name: detailedMeta.name || item.name,
                nameOriginal: detailedMeta.nameOriginal || item.nameOriginal,
                poster: detailedMeta.poster || item.poster,
                background: detailedMeta.background || item.background,
                imdbRating: detailedMeta.imdbRating || item.imdbRating,
                imdbId: detailedMeta.imdbId || item.imdbId,
              }
            : {};

        const keepSeasonAdult18 = Boolean(
          isAdult18WatchItem(item) || isAdult18WatchItem(existing?.item) || section === 'adult_18'
        );
        const mergedItem: CinemetaItem = {
          ...existing?.item,
          ...item,
          ...detailMatch,
          ...(keepSeasonAdult18 ? { isAdult18: true } : {}),
          id: canonicalKey,
          imdbId: canonicalKey.startsWith('tt')
            ? canonicalKey
            : item.imdbId || existing?.item.imdbId,
        };
        if (mergedItem.type === 'series') {
          mergedItem.name =
            mergedItem.name.replace(/\s*\(S\d+[^)]*\)\s*/gi, '').trim() ||
            mergedItem.name;
        }

        const nextEntry: VodWatchProgressEntry = {
          ...(existing || {
            item: mergedItem,
            season: pointerSeason,
            episode: pointerEpisode,
            currentTime: pointerCurrentTime,
            duration: pointerDuration,
            server: activeServer,
            subLang: preferredSubLang,
            updatedAt: now,
            deviceName: detectCurrentDeviceName(),
            deviceId: getOrCreateCurrentDeviceId(),
          }),
          item: mergedItem,
          season: pointerSeason,
          episode: pointerEpisode,
          currentTime: pointerCurrentTime,
          duration: pointerDuration,
          isWatched: isWholeSeriesNowWatched,
          isPlayingNow: false,
          server: existing?.server || activeServer,
          subLang: existing?.subLang || preferredSubLang,
          updatedAt: now,
          deviceName: detectCurrentDeviceName(),
          deviceId: getOrCreateCurrentDeviceId(),
          totalEpisodesInSeason:
            pointerTotalEps > 0
              ? pointerTotalEps
              : existing?.totalEpisodesInSeason,
          totalSeasons:
            availableSeasons.length > 0
              ? availableSeasons.length
              : existing?.totalSeasons,
          episodeProgressMap: updatedEpMap,
        };

        const next: Record<string, VodWatchProgressEntry> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (!v || typeof v !== 'object') continue;
          if (k !== canonicalKey && (k === item.id || areVodItemsSame(v.item, item))) {
            continue;
          }
          next[k] = v;
        }
        next[canonicalKey] = nextEntry;
        const cleanMap = deduplicateProgressMap(next);
        watchProgressMapRef.current = cleanMap;
        saveWatchProgressMap(cleanMap, activeProfileId, { immediateCloud: true });
        return cleanMap;
      });
      setResumeStartSeconds(0);
      setPendingResumePromptSec(null);
    },
    [
      activeVodItem,
      selectedSeason,
      seasonsMap,
      episodesForSeason,
      availableSeasons,
      detailedMeta,
      activeServer,
      preferredSubLang,
      activeProfileId,
      section,
    ]
  );

  const handleRemoveWatchProgressItem = useCallback(
    (vodId: string) => {
      setWatchProgressMap((prev) => {
        const now = Date.now();
        let touched = false;
        const next: Record<string, VodWatchProgressEntry> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (
            v &&
            typeof v === 'object' &&
            (k === vodId || v.item?.id === vodId || v.item?.imdbId === vodId)
          ) {
            touched = true;
            next[k] = {
              ...v,
              currentTime: 0,
              isWatched: false,
              isPlayingNow: false,
              updatedAt: now,
              episodeProgressMap: {},
            };
          } else {
            next[k] = v;
          }
        }
        if (!touched) return prev;
        watchProgressMapRef.current = next;
        saveWatchProgressMap(next, activeProfileId, { immediateCloud: true });
        return next;
      });
      window.setTimeout(() => {
        const activeEl = document.activeElement as HTMLElement | null;
        if (!activeEl || activeEl === document.body) {
          const nextCardBtn =
            rootContainerRef.current?.querySelector<HTMLElement>(
              'main [data-watched-poster-btn="true"]'
            ) ||
            rootContainerRef.current?.querySelector<HTMLElement>(
              'main button:not([disabled])'
            ) ||
            rootContainerRef.current?.querySelector<HTMLElement>(
              'aside [data-sidebar-active="true"]'
            );
          nextCardBtn?.focus();
        }
      }, 45);
    },
    [activeProfileId]
  );

  const handleClearAllWatchProgress = useCallback(() => {
    setWatchProgressMap((prev) => {
      const now = Date.now();
      const next: Record<string, VodWatchProgressEntry> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (v && typeof v === 'object') {
          next[k] = isAdult18WatchItem(v.item)
            ? v
            : {
                ...v,
                currentTime: 0,
                isWatched: false,
                isPlayingNow: false,
                updatedAt: now,
                episodeProgressMap: {},
              };
        }
      }
      watchProgressMapRef.current = next;
      saveWatchProgressMap(next, activeProfileId, { immediateCloud: true });
      return next;
    });
    window.setTimeout(() => {
      const activeSidebarBtn =
        rootContainerRef.current?.querySelector<HTMLElement>(
          'aside [data-sidebar-active="true"]'
        ) ||
        rootContainerRef.current?.querySelector<HTMLElement>('aside button');
      activeSidebarBtn?.focus();
    }, 45);
  }, [activeProfileId]);

  const handleClearAdult18History = useCallback(() => {
    setWatchProgressMap((prev) => {
      const now = Date.now();
      const next: Record<string, VodWatchProgressEntry> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (v && typeof v === 'object') {
          next[k] = isAdult18WatchItem(v.item)
            ? {
                ...v,
                currentTime: 0,
                isWatched: false,
                updatedAt: now,
                episodeProgressMap: {},
              }
            : v;
        }
      }
      saveWatchProgressMap(next, activeProfileId);
      return next;
    });
  }, [activeProfileId]);

  // Sync watch history card poster & title with detailedMeta so the card in "Continuă vizionarea" and the detail view are 100% identical
  useEffect(() => {
    if (!activeVodItem || !detailedMeta) return;
    const id = activeVodItem.id;
    setWatchProgressMap((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      const nextName = detailedMeta.name || cur.item.name;
      const nextPoster = detailedMeta.poster || cur.item.poster;
      const nextBg = detailedMeta.background || cur.item.background;
      const nextImdb = detailedMeta.imdbRating || cur.item.imdbRating;
      const nextOrig = detailedMeta.nameOriginal || cur.item.nameOriginal;
      if (
        cur.item.name === nextName &&
        cur.item.poster === nextPoster &&
        cur.item.imdbRating === nextImdb
      ) {
        return prev;
      }
      const next: Record<string, VodWatchProgressEntry> = {
        ...prev,
        [id]: {
          ...cur,
          item: {
            ...cur.item,
            name: nextName,
            nameOriginal: nextOrig,
            poster: nextPoster,
            background: nextBg,
            imdbRating: nextImdb,
            imdbId: detailedMeta.imdbId || cur.item.imdbId,
          },
        },
      };
      saveWatchProgressMap(next, activeProfileId);
      return next;
    });
  }, [
    activeVodItem?.id,
    detailedMeta?.name,
    detailedMeta?.poster,
    detailedMeta?.background,
    detailedMeta?.imdbRating,
    detailedMeta?.imdbId,
    detailedMeta?.nameOriginal,
    activeProfileId,
  ]);

  // Automatically enrich watch history entries with exact episode count (Ep. X din Y), runtime duration & localized poster/title
  const enrichedHistoryIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const entry of historyList) {
      const id = entry.item.id;
      const needsSeriesEps =
        entry.item.type === 'series' && !entry.totalEpisodesInSeason;
      const needsMovieDur =
        entry.item.type === 'movie' &&
        (!entry.duration || entry.duration === 5400);
      const needsLocalizedCard =
        uiLang !== 'ru' && /[А-Яа-яЁё]/.test(entry.item.name || '');
      const needsPoster =
        !entry.item.poster ||
        /no-poster/i.test(entry.item.poster) ||
        (entry.item.poster.includes('metahub.space/poster/medium/') &&
          !/\/poster\/medium\/tt\d+/i.test(entry.item.poster));
      if (
        (!needsSeriesEps && !needsMovieDur && !needsLocalizedCard && !needsPoster) ||
        enrichedHistoryIdsRef.current.has(`${id}_${uiLang}`)
      ) {
        continue;
      }
      enrichedHistoryIdsRef.current.add(`${id}_${uiLang}`);

      if (needsPoster && !id.startsWith('tt') && entry.item.name) {
        void resolveIedemKinopoiskMeta({
          fid: 0,
          title: entry.item.name,
          year:
            Number(
              String(entry.item.releaseInfo || entry.item.year || '2026').slice(
                0,
                4
              )
            ) || 2026,
          type: entry.item.type === 'series' ? 'multistream' : 'stream',
          img: '',
        })
          .then((meta) => {
            if (!meta?.posterUrl) return;
            setWatchProgressMap((prev) => {
              const cur = prev[id];
              if (!cur) return prev;
              if (
                cur.item.poster === meta.posterUrl &&
                (!meta.kpId || cur.item.kpId === String(meta.kpId))
              ) {
                return prev;
              }
              const next: Record<string, VodWatchProgressEntry> = {
                ...prev,
                [id]: {
                  ...cur,
                  item: {
                    ...cur.item,
                    poster: meta.posterUrl,
                    kpId:
                      cur.item.kpId ||
                      (meta.kpId ? String(meta.kpId) : undefined),
                    ratingKinopoisk:
                      cur.item.ratingKinopoisk || meta.ratingKinopoisk,
                  },
                },
              };
              saveWatchProgressMap(next, activeProfileId);
              return next;
            });
          })
          .catch(() => {});
      }

      if (id.startsWith('kp_') && needsLocalizedCard) {
        const kpNum = id.replace(/^kp_/, '');
        fetch(`https://kinopoiskapiunofficial.tech/api/v2.2/films/${kpNum}`, {
          headers: { 'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86' },
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((kpData) => {
            if (!kpData) return;
            const resolvedTt =
              typeof kpData.imdbId === 'string' && kpData.imdbId.startsWith('tt')
                ? kpData.imdbId
                : '';
            const origName = kpData.nameOriginal || kpData.nameEn || '';
            if (resolvedTt) {
              return fetch(
                `https://v3-cinemeta.strem.io/meta/${entry.item.type}/${resolvedTt}.json`
              )
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => {
                  const meta = d?.meta;
                  setWatchProgressMap((prev) => {
                    const cur = prev[id];
                    if (!cur) return prev;
                    const next: Record<string, VodWatchProgressEntry> = {
                      ...prev,
                      [id]: {
                        ...cur,
                        item: {
                          ...cur.item,
                          name: meta?.name || origName || cur.item.name,
                          nameOriginal: origName || meta?.name || cur.item.nameOriginal,
                          poster:
                            meta?.poster ||
                            `https://images.metahub.space/poster/medium/${resolvedTt}/img`,
                          background: meta?.background || cur.item.background,
                          imdbRating:
                            meta?.imdbRating ||
                            (kpData.ratingImdb ? String(kpData.ratingImdb) : cur.item.imdbRating),
                          imdbId: resolvedTt,
                        },
                      },
                    };
                    saveWatchProgressMap(next, activeProfileId);
                    return next;
                  });
                });
            }
          })
          .catch(() => { });
      }

      if (id.startsWith('tt')) {
        fetch(
          `https://v3-cinemeta.strem.io/meta/${entry.item.type}/${id}.json`
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            const meta = d?.meta as DetailedMeta | undefined;
            if (!meta) return;
            let epCount = 0;
            let sCount = 0;
            if (entry.item.type === 'series' && Array.isArray(meta.videos)) {
              const sSet = new Set<number>();
              for (const v of meta.videos) {
                const sNum = Number(v.season);
                const eNum = Number(v.episode ?? v.number);
                if (sNum > 0 && eNum > 0) {
                  sSet.add(sNum);
                  if (sNum === entry.season) epCount++;
                }
              }
              sCount = sSet.size;
            }
            const rtMatch = String(meta.runtime || '').match(/(\d+)/);
            const parsedRuntimeSec = rtMatch
              ? Number(rtMatch[1]) * 60
              : entry.item.type === 'series'
                ? 2700
                : 5400;

            setWatchProgressMap((prev) => {
              const cur = prev[id];
              if (!cur) return prev;
              const isRuEntry =
                isRussianVodItem(cur.item) ||
                id === 'tt27636698' ||
                String(cur.item.kpId || '') === '5354824';
              const isVolyaEntry =
                id === 'tt27636698' || String(cur.item.kpId || '') === '5354824';
              const healedItem: CinemetaItem = { ...cur.item };
              if (healedItem.type === 'series' && 'flTorrentId' in healedItem) {
                delete healedItem.flTorrentId;
                if (/^Stream\s*#/i.test(String(healedItem.releaseTitle || ''))) {
                  delete healedItem.releaseTitle;
                }
              }
              if (isVolyaEntry) {
                healedItem.name = 'Шоу Воли (ТНТ)';
                healedItem.kpId = '5354824';
                delete healedItem.nameOriginal;
              } else if (!isRuEntry && uiLang !== 'ru' && meta.name) {
                healedItem.name = meta.name || healedItem.name;
              }
              healedItem.poster = isRuEntry
                ? healedItem.poster || meta.poster
                : meta.poster || healedItem.poster;
              healedItem.background = isRuEntry
                ? healedItem.background || meta.background
                : meta.background || healedItem.background;
              healedItem.imdbRating = meta.imdbRating || healedItem.imdbRating;
              const next: Record<string, VodWatchProgressEntry> = {
                ...prev,
                [id]: {
                  ...cur,
                  item: healedItem,
                  totalEpisodesInSeason:
                    epCount > 0 ? epCount : cur.totalEpisodesInSeason,
                  totalSeasons: sCount > 0 ? sCount : cur.totalSeasons,
                  duration:
                    cur.duration && cur.duration !== 5400
                      ? cur.duration
                      : parsedRuntimeSec > 600
                        ? parsedRuntimeSec
                        : cur.duration,
                },
              };
              saveWatchProgressMap(next, activeProfileId);
              return next;
            });
          })
          .catch(() => { });
      }
    }
  }, [historyList, activeProfileId]);

  const renderPosterProgressOverlay = (
    entry?: VodWatchProgressEntry,
    isLiveActive = false
  ) => {
    if (!entry) return null;
    const entryStats =
      seriesEpStatsMap[entry.item.id] ||
      (entry.item.imdbId ? seriesEpStatsMap[entry.item.imdbId] : undefined);
    if (isVodEntryWatched(entry, entryStats) && !isLiveActive) {
      return (
        <div className="absolute inset-x-0 bottom-0 z-10 h-1 bg-emerald-500/95 shadow-[0_0_8px_rgba(16,185,129,0.65)]" />
      );
    }
    if (entry.currentTime <= 5) return null;
    const rawDur =
      entry.duration && entry.duration > 60
        ? entry.duration
        : entry.item.type === 'series'
          ? 2700
          : 5400;
    const totalDur =
      entry.currentTime >= rawDur
        ? Math.ceil((entry.currentTime + 600) / 900) * 900
        : rawDur;
    const pct = Math.min(
      100,
      Math.max(4, Math.round((entry.currentTime / totalDur) * 100))
    );
    const isSeries = entry.item.type === 'series';
    const totalEps = entry.totalEpisodesInSeason || 0;

    return (
      <div className="absolute inset-x-0 bottom-0 z-10 pt-8 pb-2 px-2 bg-gradient-to-t from-black/95 via-black/80 to-transparent flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-1 flex-nowrap min-w-0">
          <span
            className={`px-2 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-extrabold tabular-nums tracking-tight whitespace-nowrap truncate transition-colors ${isLiveActive
              ? 'bg-[#1e3a8a] text-white border border-[#3b82f6]/50 shadow-[0_2px_12px_rgba(96,165,250,0.55)] ring-1 ring-blue-300'
              : 'bg-white text-[#141414] shadow'
              }`}
          >
            ▶ {formatWatchSeconds(entry.currentTime)} / {formatWatchSeconds(totalDur)}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-extrabold tabular-nums whitespace-nowrap shrink-0 ${isLiveActive
              ? 'bg-[#0d1f38]/95 border border-[#60a5fa]/50 text-[#93c5fd]'
              : 'bg-[#0b182b]/90 border border-[#60a5fa]/35 text-[#93c5fd]'
              }`}
          >
            {pct}%
          </span>
        </div>
        {isSeries && (
          <div className="flex items-center justify-between gap-1 flex-nowrap whitespace-nowrap text-[9.5px] sm:text-[10px] font-extrabold text-[#bfdbfe] bg-[#0d1f38]/90 border border-[#60a5fa]/40 rounded-full px-2 py-0.5">
            <span>
              S{entry.season}:E{entry.episode}
            </span>
            <span>
              {totalEps > 0
                ? `Ep. ${entry.episode} din ${totalEps}`
                : `Episodul ${entry.episode}`}
            </span>
          </div>
        )}
        {/* Visual Progress Line (Bar) inside the card */}
        <div className="w-full h-1.5 rounded-full bg-white/25 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isLiveActive
              ? 'bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#2563eb] shadow-[0_0_10px_rgba(96,165,250,0.9)]'
              : 'bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#2563eb]'
              }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  const showMobileSubHeaderRadio = Boolean(
    currentStation && (section !== 'radio' || Boolean(activeVodItem))
  );
  const showMobileSubHeaderMusic = Boolean(
    !currentStation &&
      currentMusicTrack &&
      (section !== 'music' || Boolean(activeVodItem))
  );
  const hasMobileSubHeaderPlayer =
    !isAnyFullModePlayer &&
    (showMobileSubHeaderRadio || showMobileSubHeaderMusic);

  return (
    <div
      ref={rootContainerRef}
      data-lampa-root="true"
      data-mobile-phone={isMobilePhone ? 'true' : 'false'}
      data-mobile-landscape={isMobilePhone && !isPortraitViewport ? 'true' : 'false'}
      data-mobile-chrome-hidden={isMobileChromeHidden ? 'true' : 'false'}
      data-mobile-subheader-player={hasMobileSubHeaderPlayer ? 'true' : 'false'}
      data-tv-theme={tvSettings.tvTheme || 'dark'}
      onScroll={(e) => {
        if (e.currentTarget === e.target) {
          if (e.currentTarget.scrollTop !== 0) e.currentTarget.scrollTop = 0;
          if (e.currentTarget.scrollLeft !== 0) e.currentTarget.scrollLeft = 0;
        }
      }}
      className="fixed inset-0 z-40 w-full max-w-[100vw] bg-[#080b12] text-slate-100 flex flex-col overflow-hidden select-none transition-colors duration-300"
    >
      {/* Full-Bleed Sharp Lampa Movie Backdrop when viewing Movie Content Page */}
      {(activeVodItem?.background ||
        detailedMeta?.background ||
        activeVodItem?.poster) &&
        !isPlayingVod && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#10141d] transition-opacity duration-500"
          >
            <img
              src={
                detailedMeta?.background ||
                activeVodItem?.background ||
                `https://images.metahub.space/background/medium/${activeVodItem?.id}/img`
              }
              onError={(e) => {
                if (activeVodItem?.poster && e.currentTarget.src !== activeVodItem.poster) {
                  e.currentTarget.src = activeVodItem.poster;
                }
              }}
              alt=""
              className="w-full h-full object-cover object-top opacity-65"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#10141d] via-[#10141d]/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#10141d] via-[#10141d]/55 to-transparent" />
          </div>
        )}

      {/* TOP FULL-WIDTH LAMPA HEADER BAR (Identical to Lampa screenshot, safe-area aware for iPhone Home Screen PWA) */}
      {!isAnyFullModePlayer && (
        <header
          style={{
            paddingTop:
              'calc(var(--safe-top, env(safe-area-inset-top, 0px)) + var(--ios-portrait-header-pad, 0px))',
            paddingLeft: 'var(--safe-left, env(safe-area-inset-left, 0px))',
            paddingRight: 'var(--safe-right, env(safe-area-inset-right, 0px))',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
          }}
          className={`relative z-30 md:z-20 w-full shrink-0 ${
            activeVodItem
              ? isMobilePhone
                ? 'bg-[#080b12]'
                : 'bg-[#080b12] md:bg-transparent'
              : isMobilePhone
                ? 'bg-[#080b12]'
                : 'bg-[#080b12] md:bg-black'
          }`}
        >
          <div className={`${isMobilePhone && !isPortraitViewport ? 'h-11 px-3' : 'h-12 sm:h-16 px-3 sm:px-7'} w-full flex items-center justify-between gap-2 sm:gap-4`}>
            {/* Left: < Back (when viewing movie/series) + Menu + Section Name */}
            <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
              {activeVodItem && (
                <button
                  type="button"
                  data-header-back-btn="true"
                  aria-label={tr(
                    'Înapoi la catalog',
                    'Back to catalog',
                    'Назад к списку'
                  )}
                  title={tr(
                    'Înapoi la catalog',
                    'Back to catalog',
                    'Назад к списку'
                  )}
                  onTouchStart={(e) => {
                    const t = e.touches?.[0];
                    if (t) {
                      headerBackTouchStartRef.current = { x: t.clientX, y: t.clientY };
                    }
                  }}
                  onTouchEnd={(e) => {
                    const start = headerBackTouchStartRef.current;
                    headerBackTouchStartRef.current = null;
                    const t = e.changedTouches?.[0];
                    if (
                      start &&
                      t &&
                      (Math.abs(t.clientX - start.x) > 18 ||
                        Math.abs(t.clientY - start.y) > 18)
                    ) {
                      return;
                    }
                    e.preventDefault();
                    e.stopPropagation();
                    handleHeaderCatalogBack();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleHeaderCatalogBack();
                  }}
                  className={`w-11 h-11 min-w-[44px] min-h-[44px] ${isMobilePhone ? '' : 'sm:w-10 sm:h-10'} rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 touch-manipulation select-none relative z-20 ${
                    isMobilePhone
                      ? 'bg-zinc-900/90 border border-white/20 text-white shadow-lg active:scale-95'
                      : 'text-zinc-100 hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414]'
                  }`}
                >
                  <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.4]" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                data-header-sidebar-btn="true"
                aria-label={tr('Meniu Lateral', 'Sidebar Menu', 'Боковое меню')}
                aria-expanded={isSidebarOpen}
                onClick={() => {
                  setIsSidebarOpen((prev) => {
                    const next = !prev;
                    if (next) {
                      window.setTimeout(() => {
                        const firstNav =
                          rootContainerRef.current?.querySelector<HTMLElement>(
                            'aside [data-sidebar-active="true"]'
                          ) ||
                          rootContainerRef.current?.querySelector<HTMLElement>(
                            'aside button'
                          );
                        firstNav?.focus();
                      }, 50);
                    }
                    return next;
                  });
                }}
                title={tr('Meniu Lateral ()', 'Sidebar Menu ()', 'Меню ()')}
                className={`w-11 h-11 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${isSidebarOpen && activeVodItem
                  ? 'bg-white text-[#141414]'
                  : 'text-zinc-200 hover:bg-white/10 focus:bg-white focus:text-zinc-950'
                  }`}
              >
                <Menu className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" aria-hidden="true" />
              </button>

              <button
                type="button"
                data-header-logo-btn="true"
                aria-label={tr('Acasă Filmio', 'Filmio Home', 'Главная Filmio')}
                title={tr('Acasă Filmio', 'Filmio Home', 'На главную')}
                onClick={() => {
                  isMobileChromeHiddenRef.current = false;
                  scrollDeltaAccumRef.current = 0;
                  lastMainScrollTopRef.current = 0;
                  setIsMobileChromeHidden(false);
                  setActiveVodItem(null);
                  if (
                    isCarMode ||
                    isMobilePhone ||
                    (typeof window !== 'undefined' && window.innerWidth < 768)
                  ) {
                    setIsSidebarOpen(false);
                  }
                  setIsFilterDrawerOpen(false);
                  setIsCatalogDrawerOpen(false);
                  setSection('home');
                  rootContainerRef.current
                    ?.querySelector<HTMLElement>('main')
                    ?.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="ml-0.5 sm:ml-1 shrink-0 inline-flex items-center rounded-xl px-1 py-0.5 hover:bg-white/10 active:scale-95 transition-all cursor-pointer touch-manipulation focus:outline-none focus:ring-2 focus:ring-white/40"
              >
                <SmartCinemaLogo size="md" />
              </button>
              {isCarMode && (
                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600/25 border border-blue-400/50 text-[10px] font-black tracking-wider uppercase text-blue-300 shrink-0">
                  <Car className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>GLE 8:3</span>
                </span>
              )}
            </div>

            {/* Mercedes-Benz GLE 2022 1920x720 (8:3) Driver-Safe Quick-Nav Cockpit Bar */}
            {isCarMode && (
              <nav
                data-car-cockpit-nav="true"
                aria-label={tr(
                  'Navigare Rapidă Mod Auto',
                  'Car Mode Quick Navigation',
                  'Быстрая навигация Авто'
                )}
                className="hidden lg:flex items-center gap-1.5 overflow-x-auto no-scrollbar px-1"
              >
                {(
                  [
                    {
                      id: 'home',
                      label: tr('Acasă', 'Home', 'Главная'),
                      Icon: Home,
                    },
                    {
                      id: 'radio',
                      label: tr('Radio', 'Radio', 'Радио'),
                      Icon: Radio,
                    },
                    {
                      id: 'music',
                      label: tr('Muzică', 'Music', 'Музыка'),
                      Icon: Music,
                    },
                    {
                      id: 'tv',
                      label: tr('TV Live', 'TV Live', 'ТВ'),
                      Icon: Monitor,
                    },
                    {
                      id: 'movies',
                      label: tr('Filme', 'Movies', 'Фильмы'),
                      Icon: Clapperboard,
                    },
                    {
                      id: 'imdb',
                      label: tr('Top IMDb', 'Top IMDb', 'Топ IMDb'),
                      Icon: Star,
                    },
                    {
                      id: 'series',
                      label: tr('Seriale', 'Series', 'Сериалы'),
                      Icon: Tv,
                    },
                  ] as const
                ).map(({ id, label, Icon }) => {
                  const isActive = section === id && !activeVodItem;
                  return (
                    <button
                      key={`car_nav_${id}`}
                      type="button"
                      data-car-nav-id={id}
                      onClick={() => {
                        setActiveVodItem(null);
                        setIsSidebarOpen(false);
                        setIsFilterDrawerOpen(false);
                        setIsCatalogDrawerOpen(false);
                        setSection(id);
                        const mainEl =
                          rootContainerRef.current?.querySelector<HTMLElement>(
                            'main'
                          );
                        if (mainEl) {
                          mainEl.scrollTop = 0;
                        }
                        if (id === 'tv') {
                          setTvRegionId(
                            favoriteTvChannels.length > 0 ? 'FAV' : 'RO'
                          );
                          setTvCategoryId('ALL');
                        } else if (id === 'radio') {
                          setRadioCountry(favorites.length > 0 ? 'FAV' : 'RO');
                        }
                      }}
                      className={`min-h-[44px] px-3.5 rounded-full text-xs xl:text-sm font-extrabold inline-flex items-center gap-2 transition-all shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-400 ${isActive
                        ? 'bg-white text-[#141414] shadow-lg'
                        : 'bg-white/[0.08] text-zinc-200 hover:bg-white/15 hover:text-white border border-white/10'
                        }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </nav>
            )}

            {/* Right: Lampa Utility Icons + Clock + 2-Line Date */}
            <div className="flex items-center gap-1.5 sm:gap-3.5 shrink-0">
              {currentStation && (
                <div className={`relative ${isMobilePhone ? 'hidden' : 'hidden sm:inline-flex'} items-center h-9 sm:h-[40px] pl-1.5 pr-1.5 rounded-full bg-[#0e121b]/90 hover:bg-[#141926]/95 backdrop-blur-2xl border border-white/[0.12] shadow-[0_6px_24px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] transition-colors`}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveVodItem(null);
                      setIsTvRadioPlayerOpen(false);
                      setSection('radio');
                      rootContainerRef.current
                        ?.querySelector('main')
                        ?.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    title={tr(
                      'Deschide Playerul Radio cu Poză & Info Piesă',
                      'Open Radio Player with Artwork & Track Info',
                      'Открыть радиоплеер с обложкой и треком'
                    )}
                    className="h-full pr-1.5 sm:pr-2 inline-flex items-center gap-2 rounded-full focus:outline-none focus:ring-1 focus:ring-white/40 cursor-pointer"
                  >
                    {activeRadioTrack?.coverUrl ? (
                      <img
                        src={activeRadioTrack.coverUrl}
                        alt=""
                        className="w-6 h-6 sm:w-[26px] sm:h-[26px] rounded-[7px] object-cover shrink-0 ring-1 ring-white/15 shadow-sm"
                      />
                    ) : (
                      <div className="w-6 h-6 sm:w-[26px] sm:h-[26px] rounded-[7px] bg-white/[0.08] ring-1 ring-white/15 flex items-center justify-center shrink-0">
                        <Radio
                          className={`w-3.5 h-3.5 text-slate-200 ${playerStatus === 'playing' ? 'animate-pulse' : ''}`}
                        />
                      </div>
                    )}
                    <div className="hidden sm:flex flex-col items-start justify-center min-w-0 max-w-[145px] md:max-w-[180px] text-left leading-none">
                      <span className="text-[11.5px] font-semibold text-white/95 truncate w-full leading-[1.18]">
                        {activeRadioTrack
                          ? activeRadioTrack.title || currentStation.name
                          : currentStation.name}
                      </span>
                      <span className="text-[10px] font-medium text-[#94a3b8] truncate w-full leading-[1.18] mt-[1px]">
                        {activeRadioTrack?.artist
                          ? `${activeRadioTrack.artist} · ${currentStation.name}`
                          : playerStatus === 'playing'
                            ? 'Live Radio'
                            : currentStation.name}
                      </span>
                    </div>
                  </button>
                  <div className="flex items-center gap-0.5 ml-0.5 sm:ml-1">
                    <button
                      type="button"
                      onClick={() => playStation(currentStation)}
                      title={
                        playerStatus === 'playing' || playerStatus === 'loading'
                          ? tr('Pauză Radio', 'Pause Radio', 'Пауза радио')
                          : tr('Redă Radio', 'Play Radio', 'Включить радио')
                      }
                      className="w-7 h-7 rounded-full bg-white/[0.11] hover:bg-white/20 text-white focus:bg-white focus:text-zinc-950 focus:outline-none inline-flex items-center justify-center transition-colors cursor-pointer"
                    >
                      {playerStatus === 'loading' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : playerStatus === 'playing' ? (
                        <Pause className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current ml-[1px]" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        stopRadio();
                        setIsTvRadioPlayerOpen(false);
                      }}
                      title={tr(
                        'Oprește Radio și închide',
                        'Stop Radio and close',
                        'Остановить радио и закрыть'
                      )}
                      className="w-7 h-7 rounded-full text-[#94a3b8] hover:text-white hover:bg-white/[0.12] focus:bg-rose-500 focus:text-white focus:outline-none inline-flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {!currentStation && currentMusicTrack && (() => {
                const totalDur = Math.max(
                  0,
                  musicDurationSec || currentMusicTrack.durationSec || 0
                );
                const elapsedClamped =
                  totalDur > 0
                    ? Math.min(totalDur, Math.max(0, musicElapsedSec || 0))
                    : Math.max(0, musicElapsedSec || 0);
                const remainingSec =
                  totalDur > 0 ? Math.max(0, totalDur - elapsedClamped) : 0;
                const musicProgressPct =
                  totalDur > 0
                    ? Math.min(100, Math.max(0, (elapsedClamped / totalDur) * 100))
                    : 0;
                const formatMiniTime = (secVal: number) => {
                  const safe = Math.max(0, Math.floor(secVal || 0));
                  const hrs = Math.floor(safe / 3600);
                  const mins = Math.floor((safe % 3600) / 60);
                  const secs = safe % 60;
                  return hrs > 0
                    ? `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
                    : `${mins}:${String(secs).padStart(2, '0')}`;
                };
                const elapsedLabel = formatMiniTime(elapsedClamped);
                const remainingLabel =
                  totalDur > 0 ? '-' + formatMiniTime(remainingSec) : '--:--';
                return (
                  <div
                    className={`relative ${(section === 'music' && !activeVodItem) || isMobilePhone
                      ? 'hidden'
                      : 'hidden sm:inline-flex'
                      } items-center h-9 sm:h-[40px] pl-1.5 pr-1.5 rounded-full bg-[#0e121b]/90 hover:bg-[#141926]/95 backdrop-blur-2xl border border-white/[0.12] shadow-[0_6px_24px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] transition-colors`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveVodItem(null);
                        setSection('music');
                        window.dispatchEvent(
                          new CustomEvent('filmio:open-music-song-view')
                        );
                        rootContainerRef.current
                          ?.querySelector('main')
                          ?.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      title={tr(
                        'Deschide Studio Piesă',
                        'Open Track Studio',
                        'Открыть трек'
                      )}
                      className="h-full pr-1.5 sm:pr-2 inline-flex items-center gap-2 rounded-full focus:outline-none focus:ring-1 focus:ring-white/40 cursor-pointer"
                    >
                      {currentMusicTrack.coverSmall || currentMusicTrack.cover ? (
                        <img
                          src={currentMusicTrack.coverSmall || currentMusicTrack.cover}
                          alt=""
                          className="w-6 h-6 sm:w-[26px] sm:h-[26px] rounded-[7px] object-cover shrink-0 ring-1 ring-white/15 shadow-sm"
                        />
                      ) : (
                        <div className="w-6 h-6 sm:w-[26px] sm:h-[26px] rounded-[7px] bg-white/[0.08] ring-1 ring-white/15 flex items-center justify-center shrink-0">
                          <Music className="w-3.5 h-3.5 text-slate-300" />
                        </div>
                      )}
                      <div className="hidden sm:flex flex-col items-start justify-center min-w-0 max-w-[140px] md:max-w-[165px] text-left leading-none">
                        <span className="text-[11.5px] font-semibold text-white/95 truncate w-full leading-[1.18]">
                          {currentMusicTrack.title}
                        </span>
                        <span className="text-[10px] font-medium text-[#94a3b8] truncate w-full leading-[1.18] mt-[1px]">
                          {currentMusicTrack.artist}
                          <span className="md:hidden tabular-nums">
                            {` · ${elapsedLabel} / ${remainingLabel}`}
                          </span>
                        </span>
                      </div>
                    </button>

                    <div className="hidden md:flex items-center gap-2 px-2 shrink-0">
                      <span className="text-[10.5px] font-medium text-[#94a3b8] tabular-nums select-none">
                        {elapsedLabel}
                      </span>
                      <div
                        role="slider"
                        tabIndex={-1}
                        aria-label="Progres melodie"
                        aria-valuemin={0}
                        aria-valuemax={Math.floor(totalDur)}
                        aria-valuenow={Math.floor(elapsedClamped)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (totalDur <= 0) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          if (rect.width > 0) {
                            const ratio = Math.min(
                              1,
                              Math.max(0, (e.clientX - rect.left) / rect.width)
                            );
                            handleSeekMusic(ratio * totalDur);
                          }
                        }}
                        className="relative w-16 lg:w-24 xl:w-28 h-5 flex items-center cursor-pointer group/hdrscrub"
                      >
                        <div className="w-full h-[3.5px] rounded-full bg-white/[0.14] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#60a5fa] group-hover/hdrscrub:bg-[#93c5fd] transition-[width] duration-300 ease-linear"
                            style={{ width: `${musicProgressPct}%` }}
                          />
                        </div>
                        <div
                          className="pointer-events-none absolute w-2.5 h-2.5 rounded-full bg-white shadow -ml-[5px] opacity-0 group-hover/hdrscrub:opacity-100 transition-opacity"
                          style={{ left: `${musicProgressPct}%` }}
                        />
                      </div>
                      <span className="text-[10.5px] font-medium text-[#94a3b8] tabular-nums select-none">
                        {remainingLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5 ml-0.5 sm:ml-1">
                      <button
                        type="button"
                        onClick={handlePrevMusicTrack}
                        title={tr('Piesa anterioară', 'Previous track', 'Предыдущий трек')}
                        className="hidden md:inline-flex w-7 h-7 rounded-full text-slate-300 hover:text-white hover:bg-white/[0.12] focus:bg-white focus:text-zinc-950 focus:outline-none items-center justify-center transition-colors cursor-pointer"
                      >
                        <SkipBack className="w-3.5 h-3.5 fill-current" />
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleMusicPlayPause}
                        title={
                          isMusicPlaying
                            ? tr('Pauză Muzică', 'Pause Music', 'Пауза')
                            : tr('Redă Muzică', 'Play Music', 'Слушать')
                        }
                        className="w-7 h-7 rounded-full bg-white/[0.11] hover:bg-white/20 text-white focus:bg-white focus:text-zinc-950 focus:outline-none inline-flex items-center justify-center transition-colors cursor-pointer"
                      >
                        {isMusicPlaying ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current ml-[1px]" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleNextMusicTrack}
                        title={tr('Piesa următoare', 'Next track', 'Следующий трек')}
                        className="hidden sm:inline-flex w-7 h-7 rounded-full text-slate-300 hover:text-white hover:bg-white/[0.12] focus:bg-white focus:text-zinc-950 focus:outline-none items-center justify-center transition-colors cursor-pointer"
                      >
                        <SkipForward className="w-3.5 h-3.5 fill-current" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleMusicPip()}
                        title={tr(
                          'MiniPlayer Picture-in-Picture (fereastră flotantă în afara paginii)',
                          'Picture-in-Picture MiniPlayer (floating window outside page)',
                          'Мини-плеер Картинка-в-картинке'
                        )}
                        className="hidden md:inline-flex w-7 h-7 rounded-full text-slate-300 hover:text-white hover:bg-white/[0.12] focus:bg-white focus:text-zinc-950 focus:outline-none items-center justify-center transition-colors cursor-pointer"
                      >
                        <PictureInPicture2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleStopAndCloseMusic}
                        title={tr(
                          'Oprește Muzica și închide',
                          'Stop Music and close',
                          'Остановить музыку и закрыть'
                        )}
                        className="w-7 h-7 rounded-full text-[#94a3b8] hover:text-white hover:bg-white/[0.12] focus:bg-rose-500 focus:text-white focus:outline-none inline-flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Search Icon */}
              <button
                type="button"
                data-header-search-btn="true"
                onClick={() => {
                  if (section === 'uhd_4k' && !activeVodItem) {
                    const uhdInput = document.querySelector<HTMLInputElement>(
                      '[data-uhd-search-input="true"]'
                    );
                    if (uhdInput) {
                      uhdInput.focus();
                      return;
                    }
                  }
                  if (section === 'torrents' && !activeVodItem) {
                    setIsFlKeyboardOpen((prev) => !prev);
                    return;
                  }
                  if (section === 'tv' && !activeVodItem) {
                    setIsTvKeyboardOpen((prev) => !prev);
                    window.setTimeout(() => {
                      tvSearchInputRef.current?.focus();
                    }, 40);
                    return;
                  }
                  if (section === 'radio' && !activeVodItem) {
                    setIsRadioKeyboardOpen((prev) => !prev);
                    window.setTimeout(() => {
                      radioSearchInputRef.current?.focus();
                    }, 40);
                    return;
                  }
                  setActiveVodItem(null);
                  setSection('search');
                }}
                aria-label={tr('Căutare', 'Search', 'Поиск')}
                title={tr('Căutare', 'Search', 'Поиск')}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 focus:bg-white focus:text-zinc-950 focus:outline-none transition-colors cursor-pointer"
              >
                <Search className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
              </button>

              {/* Bell Icon with Red Dot -> Opens New Episodes Calendar */}
              <button
                type="button"
                onClick={() => {
                  setActiveVodItem(null);
                  setSection('calendar');
                }}
                aria-label={tr('Calendar Episoade Noi (Seriale Favorite)', 'New Episodes Calendar (Favorite Series)', 'Календарь новых серий (Избранное)')}
                title={tr('Calendar Episoade Noi (Seriale Favorite)', 'New Episodes Calendar (Favorite Series)', 'Календарь новых серий (Избранное)')}
                className="hidden sm:flex relative w-9 h-9 rounded-full items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 focus:bg-white focus:text-zinc-950 focus:outline-none transition-colors cursor-pointer"
              >
                <Bell className="w-5 h-5" aria-hidden="true" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
              </button>

              {/* 1-Click Cycle Interface Language Switcher (Shows only active language: RO / EN / RU) */}
              <button
                type="button"
                data-header-lang-btn="true"
                onClick={() => {
                  const order: Array<'ro' | 'en' | 'ru'> = ['ro', 'en', 'ru'];
                  const nextLang =
                    order[(order.indexOf(uiLang) + 1) % order.length];
                  switchUiLang(nextLang);
                }}
                title={tr(
                  `Limbă interfață: ${uiLang.toUpperCase()} (Apasă pentru a schimba RO / EN / RU)`,
                  `Interface Language: ${uiLang.toUpperCase()} (Click to cycle RO / EN / RU)`,
                  `Язык интерфейса: ${uiLang.toUpperCase()} (Нажмите для смены RO / EN / RU)`
                )}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-[11px] sm:text-xs font-extrabold tracking-wider text-white transition-all focus:bg-white focus:!text-zinc-950 focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer shrink-0"
              >
                {uiLang.toUpperCase()}
              </button>

              {/* 1-Click Smart TV Theme Toggle (Icon-only): Cinema Dark vs Ambient Slate (Soft Light for TV) */}
              <button
                type="button"
                data-header-theme-btn="true"
                onClick={() =>
                  updateTvSetting(
                    'tvTheme',
                    tvSettings.tvTheme === 'ambient' ? 'dark' : 'ambient'
                  )
                }
                title={
                  tvSettings.tvTheme === 'ambient'
                    ? tr(
                      'Temă activă: Deschisă (Ambient Slate TV) — Click pentru Întunecat',
                      'Active Theme: Ambient Slate TV — Click for Dark Mode',
                      'Тема: Светлая (Ambient Slate TV) — Нажмите для Темной'
                    )
                    : tr(
                      'Temă activă: Întunecată (Cinema Dark) — Click pentru Deschisă (Ambient TV)',
                      'Active Theme: Cinema Dark — Click for Ambient Light TV',
                      'Тема: Темная (Cinema Dark) — Нажмите для Светлой (Ambient TV)'
                    )
                }
                aria-label={tr('Schimbă tema', 'Toggle theme', 'Сменить тему')}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full border flex items-center justify-center transition-all focus:bg-white focus:!text-zinc-950 focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer ${tvSettings.tvTheme === 'ambient'
                  ? 'bg-amber-400/20 border-amber-300/50 text-amber-200 hover:bg-amber-400/30 shadow-sm'
                  : 'bg-white/10 border-white/15 text-zinc-300 hover:text-white hover:bg-white/15'
                  }`}
              >
                {tvSettings.tvTheme === 'ambient' ? (
                  <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300 shrink-0" aria-hidden="true" />
                ) : (
                  <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-300 shrink-0" aria-hidden="true" />
                )}
              </button>

              {/* Active Profile Avatar-Only Button ("Who's watching? / Conturi & PIN") */}
              <button
                type="button"
                data-header-profile-btn="true"
                aria-label={tr(
                  `Cont activ: ${activeProfile.name}`,
                  `Active Account: ${activeProfile.name}`,
                  `Аккаунт: ${activeProfile.name}`
                )}
                onClick={() => {
                  setIsHandoffModalOpen(true);
                }}
                title={tr(
                  `Cont activ: ${activeProfile.name} (Click pentru a schimba sau crea un cont cu Poză & PIN)`,
                  `Active Account: ${activeProfile.name} (Click to switch or create account with Photo & PIN)`,
                  `Аккаунт: ${activeProfile.name} (Нажмите для смены или создания профиля с фото и PIN)`
                )}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full p-0.5 bg-white/10 hover:bg-white/25 focus:ring-4 focus:ring-white focus:scale-110 focus:outline-none border border-white/20 flex items-center justify-center transition-all cursor-pointer shrink-0"
              >
                <span
                  className={`relative w-full h-full rounded-full bg-gradient-to-br ${activeProfile.avatarBg} flex items-center justify-center text-xs font-black text-white shadow overflow-hidden`}
                >
                  {activeProfile.avatarUrl ? (
                    <img
                      src={activeProfile.avatarUrl}
                      alt={activeProfile.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    activeProfile.name.slice(0, 1).toUpperCase() || 'E'
                  )}
                </span>
              </button>

              {/* Smart TV Settings Icon (Настройки / Setări Smart TV) */}
              <button
                type="button"
                data-header-settings-btn="true"
                aria-label={tr('Setări', 'Settings', 'Настройки')}
                onClick={() => {
                  setIsFilterDrawerOpen(false);
                  setIsCatalogDrawerOpen(false);
                  setSettingsSubMenu(null);
                  setIsSettingsDrawerOpen((prev) => !prev);
                }}
                title={tr(
                  'Setări Smart TV (Limbă, Audio, Subtitrări, Calitate)',
                  'Smart TV Settings (Language, Audio, Subtitles, Quality)',
                  'Настройки Smart TV'
                )}
                className={`flex w-8 h-8 sm:w-9 sm:h-9 rounded-full items-center justify-center transition-colors cursor-pointer ${isSettingsDrawerOpen
                  ? 'bg-white text-[#141414] shadow'
                  : 'text-zinc-300 hover:text-white hover:bg-white/10 focus:bg-white focus:text-zinc-950 focus:outline-none'
                  }`}
              >
                <Settings className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
              </button>



              {/* Fullscreen Icon (100% Borderless Full Screen) */}
              <button
                type="button"
                data-header-fullscreen-btn="true"
                aria-pressed={isAppFullscreen}
                aria-label={tr(
                  isAppFullscreen ? 'Ieșire din Ecran Complet' : 'Ecran Complet (Full Screen)',
                  isAppFullscreen ? 'Exit Full Screen' : 'Full Screen',
                  isAppFullscreen ? 'Выйти из полного экрана' : 'Полный экран'
                )}
                onClick={handleToggleBrowserFullscreen}
                title={tr(
                  isAppFullscreen
                    ? 'Ieșire din Ecran Complet (Esc)'
                    : 'Ecran Complet 100% pe tot monitorul (Full Screen)',
                  isAppFullscreen ? 'Exit Full Screen (Esc)' : '100% Full Screen',
                  isAppFullscreen ? 'Выйти из полного экрана' : 'Полный экран'
                )}
                className={`${isMobilePhone ? 'hidden' : 'hidden sm:flex'} w-9 h-9 rounded-full border items-center justify-center transition-all focus:bg-white focus:text-zinc-950 focus:outline-none cursor-pointer shrink-0 ${isAppFullscreen
                  ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_16px_rgba(37,99,235,0.5)]'
                  : 'bg-white/10 border-white/15 text-zinc-200 hover:text-white hover:bg-blue-600 hover:border-blue-400'
                  }`}
              >
                {isAppFullscreen ? (
                  <Minimize2 className="w-4 h-4 sm:w-[18px] sm:h-[18px]" aria-hidden="true" />
                ) : (
                  <Maximize2 className="w-4 h-4 sm:w-[18px] sm:h-[18px]" aria-hidden="true" />
                )}
              </button>

              {/* Reload / Refresh Button */}
              <button
                type="button"
                data-header-refresh-btn="true"
                aria-label={tr('Reîncarcă Aplicația TV', 'Reload TV App', 'Обновить')}
                onClick={() => handleHardRefreshTvApp(() => window.location.reload())}
                onKeyDown={(e) => {
                  const kc = e.keyCode || e.which;
                  if (e.key === 'Enter' || kc === 13 || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleHardRefreshTvApp(() => {
                      const next = `${window.location.pathname}?_r=${Date.now()}${window.location.hash || ''}`;
                      window.location.href = next;
                    });
                  }
                }}
                title={tr('Reîncarcă Aplicația TV', 'Reload TV App', 'Обновить')}
                className={`hidden sm:flex w-9 h-9 rounded-full items-center justify-center transition-colors cursor-pointer shrink-0 focus:!bg-white focus:!text-zinc-950 focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                  isRefreshingApp
                    ? 'bg-white text-zinc-950'
                    : 'text-zinc-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <RefreshCw
                  className={`w-4 h-4 sm:w-5 sm:h-5 ${isRefreshingApp ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
              </button>

              {/* Lampa 3-Dot Status Indicator */}
              <div className={`${isMobilePhone ? 'hidden' : 'hidden md:flex'} flex-col items-center gap-1 px-1`}>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span className="w-1 h-1 rounded-full bg-zinc-500" />
                <span className="w-1 h-1 rounded-full bg-zinc-500" />
              </div>

              {/* Local Weather Icon + Live Temp (Opens 5-day forecast & city picker) */}
              <HeaderWeatherWidget uiLang={uiLang} isMobilePhone={isMobilePhone} />

              {/* Lampa Clock + 2-Line Date */}
              <div className={`${isMobilePhone ? 'hidden lg:flex' : 'hidden sm:flex'} items-center gap-2.5 pl-1`}>
                <div className="text-xl sm:text-[26px] font-bold tracking-tight text-white tabular-nums leading-none">
                  {clockText}
                </div>
                <div className="hidden lg:flex flex-col text-[11px] leading-tight text-zinc-300 font-normal">
                  <span>{dateLine1}</span>
                  <span className="text-zinc-400">{dateLine2}</span>
                </div>
              </div>
            </div>
          </div>

          {hasMobileSubHeaderPlayer && (
            <div
              data-mobile-subheader-player="true"
              className={`${isMobilePhone ? 'flex' : 'flex sm:hidden'} relative w-full ${isMobilePhone && !isPortraitViewport ? 'h-10' : 'h-12'} px-3 bg-[#0b0f1a] border-t border-white/[0.12] items-center justify-between gap-2.5`}
            >
              {showMobileSubHeaderRadio && currentStation ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveVodItem(null);
                      setIsTvRadioPlayerOpen(false);
                      setSection('radio');
                      rootContainerRef.current
                        ?.querySelector('main')
                        ?.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex-1 min-w-0 flex items-center gap-2.5 text-left cursor-pointer focus:outline-none"
                  >
                    {activeRadioTrack?.coverUrl ? (
                      <img
                        src={activeRadioTrack.coverUrl}
                        alt=""
                        className="w-8 h-8 rounded-lg object-cover shrink-0 ring-1 ring-white/15 bg-[#111726]"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-white/[0.08] ring-1 ring-white/15 flex items-center justify-center shrink-0">
                        <Radio
                          className={`w-4 h-4 text-[#60a5fa] ${playerStatus === 'playing' ? 'animate-pulse' : ''}`}
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="text-[13px] font-semibold text-white truncate">
                        {activeRadioTrack?.title || currentStation.name}
                      </div>
                      <div className="text-[11px] font-medium text-[#94a3b8] truncate">
                        {activeRadioTrack?.artist
                          ? `${activeRadioTrack.artist} · ${currentStation.name}`
                          : playerStatus === 'playing'
                            ? `Live Radio · ${currentStation.name}`
                            : currentStation.name}
                      </div>
                    </div>
                  </button>
                  <div className="shrink-0 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => playStation(currentStation)}
                      aria-label={
                        playerStatus === 'playing' || playerStatus === 'loading'
                          ? tr('Pauză Radio', 'Pause Radio', 'Пауза радио')
                          : tr('Redă Radio', 'Play Radio', 'Включить радио')
                      }
                      style={{ backgroundColor: '#ffffff', color: '#000000' }}
                      className="w-8 h-8 rounded-full bg-white text-black inline-flex items-center justify-center shadow cursor-pointer"
                    >
                      {playerStatus === 'loading' ? (
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                      ) : playerStatus === 'playing' ? (
                        <Pause className="w-4 h-4 fill-current text-black" />
                      ) : (
                        <Play className="w-4 h-4 fill-current text-black ml-0.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        stopRadio();
                        setIsTvRadioPlayerOpen(false);
                      }}
                      aria-label={tr('Oprește Radio și închide', 'Stop Radio and close', 'Закрыть')}
                      className="w-8 h-8 rounded-full text-[#94a3b8] hover:text-white inline-flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : showMobileSubHeaderMusic && currentMusicTrack ? (() => {
                const totalDur = Math.max(0, musicDurationSec || currentMusicTrack.durationSec || 0);
                const elapsedClamped =
                  totalDur > 0 ? Math.min(totalDur, Math.max(0, musicElapsedSec || 0)) : Math.max(0, musicElapsedSec || 0);
                const remainingSec = totalDur > 0 ? Math.max(0, totalDur - elapsedClamped) : 0;
                const musicProgressPct = totalDur > 0 ? Math.min(100, Math.max(0, (elapsedClamped / totalDur) * 100)) : 0;
                const fmtSub = (v: number) => {
                  const s = Math.max(0, Math.floor(v || 0));
                  const m = Math.floor(s / 60);
                  const r = s % 60;
                  return `${m}:${r < 10 ? '0' : ''}${r}`;
                };
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveVodItem(null);
                        setSection('music');
                        window.dispatchEvent(new CustomEvent('filmio:open-music-song-view'));
                        rootContainerRef.current?.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="flex-1 min-w-0 flex items-center gap-2.5 text-left cursor-pointer focus:outline-none"
                    >
                      {currentMusicTrack.coverSmall || currentMusicTrack.cover ? (
                        <img
                          src={currentMusicTrack.coverSmall || currentMusicTrack.cover}
                          alt={currentMusicTrack.title}
                          className="w-8 h-8 rounded-lg object-cover shrink-0 ring-1 ring-white/15 bg-[#111726]"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-white/[0.08] ring-1 ring-white/15 flex items-center justify-center shrink-0">
                          <Music className="w-4 h-4 text-[#60a5fa]" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 leading-tight">
                        <div className="text-[13px] font-semibold text-white truncate">
                          {currentMusicTrack.title}
                        </div>
                        <div className="text-[11px] font-medium text-[#94a3b8] truncate tabular-nums">
                          {currentMusicTrack.artist}
                          {totalDur > 0 ? ` · ${fmtSub(elapsedClamped)} / -${fmtSub(remainingSec)}` : ''}
                        </div>
                      </div>
                    </button>
                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePrevMusicTrack}
                        aria-label={tr('Piesa anterioară', 'Previous track', 'Предыдущий трек')}
                        className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/15 active:scale-95 text-white inline-flex items-center justify-center cursor-pointer touch-manipulation"
                      >
                        <SkipBack className="w-[18px] h-[18px] fill-current" />
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleMusicPlayPause}
                        aria-label={isMusicPlaying ? tr('Pauză', 'Pause', 'Пауза') : tr('Redă', 'Play', 'Играть')}
                        style={{ backgroundColor: '#ffffff', color: '#000000' }}
                        className="w-9 h-9 mx-0.5 rounded-full bg-white text-black active:scale-95 inline-flex items-center justify-center shadow cursor-pointer touch-manipulation"
                      >
                        {isMusicPlaying ? (
                          <Pause className="w-[18px] h-[18px] fill-current text-black" />
                        ) : (
                          <Play className="w-[18px] h-[18px] fill-current text-black ml-0.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleNextMusicTrack}
                        aria-label={tr('Următoarea piesă', 'Next track', 'Следующий трек')}
                        className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/15 active:scale-95 text-white inline-flex items-center justify-center cursor-pointer touch-manipulation"
                      >
                        <SkipForward className="w-[18px] h-[18px] fill-current" />
                      </button>
                      <button
                        type="button"
                        onClick={handleStopAndCloseMusic}
                        aria-label={tr('Închide playerul', 'Close player', 'Закрыть')}
                        className="w-8 h-8 rounded-full text-[#94a3b8] hover:text-white inline-flex items-center justify-center cursor-pointer touch-manipulation"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-[#60a5fa] transition-[width] duration-300 ease-linear"
                        style={{ width: `${musicProgressPct}%` }}
                      />
                    </div>
                  </>
                );
              })() : null}
            </div>
          )}
        </header>
      )}

      {/* BODY CONTAINER: LEFT LAMPA SIDEBAR + RIGHT CONTENT AREA */}
      <div
        onScroll={(e) => {
          if (e.currentTarget === e.target) {
            if (e.currentTarget.scrollTop !== 0) e.currentTarget.scrollTop = 0;
            if (e.currentTarget.scrollLeft !== 0) e.currentTarget.scrollLeft = 0;
          }
        }}
        className="relative flex-1 min-h-0 flex overflow-hidden"
      >
        {/* Backdrop for Slide-Over Menu Drawer (Mobile + GLE Car Mode) */}
        {!isAnyFullModePlayer && isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            className={`${isCarMode || isMobilePhone ? 'block' : 'md:hidden'
              } absolute inset-0 z-[46] bg-black/70`}
          />
        )}

        {/* LEFT LAMPA NAVIGATION SIDEBAR (Slide-over drawer on mobile & Car Mode; fixed sidebar on Desktop/TV) */}
        {!isAnyFullModePlayer && isSidebarOpen && (
          <aside
            aria-label="Meniu Principal Smart TV Lampa"
            className={`absolute ${isCarMode || isMobilePhone
              ? isMobilePhone && !isPortraitViewport
                ? 'top-2 bottom-[calc(4.1rem+var(--safe-bottom,env(safe-area-inset-bottom,0px))*0.65)] z-[48]'
                : 'top-2 bottom-[calc(4.9rem+var(--safe-bottom,env(safe-area-inset-bottom,0px))*0.65)] z-[48]'
              : 'md:static md:my-2 md:ml-3 md:shadow-none top-2 bottom-[4.75rem] md:top-2 md:bottom-2 z-[48] md:z-40'
              } left-[max(0.5rem,var(--safe-left,env(safe-area-inset-left,0px)))] w-64 ${isMobilePhone ? '' : 'md:w-56'} py-2.5 px-3 rounded-[28px] overflow-y-auto overflow-x-hidden shrink-0 no-scrollbar tahoe-glass flex flex-col justify-between shadow-2xl`}
          >
            <nav className="space-y-1 group/sidebar">
              {(
                [
                  {
                    id: 'home',
                    label: tr('Acasă', 'Home', 'Главная'),
                    Icon: Home,
                  },
                  {
                    id: 'movies',
                    label: tr('Filme', 'Movies', 'Фильмы'),
                    Icon: Clapperboard,
                  },
                  {
                    id: 'imdb',
                    label: tr('Top IMDb', 'Top IMDb', 'Топ IMDb'),
                    Icon: Star,
                  },
                  {
                    id: 'series',
                    label: tr('Seriale', 'TV Series', 'Сериалы'),
                    Icon: Tv,
                  },
                  {
                    id: 'uhd_4k',
                    label: tr('4K UHD', '4K UHD', '4K UHD'),
                    Icon: Sparkles,
                  },
                  {
                    id: 'iedem_vod',
                    label: tr('Kinozal', 'Kinozal', 'Kinozal'),
                    Icon: Film,
                  },
                  {
                    id: 'ru_shows',
                    label: tr('Emisiuni RU', 'RU TV Shows', 'ТВ-Шоу RU'),
                    Icon: Flame,
                  },
                  {
                    id: 'adult_18',
                    label: tr('Cinema 18+', '18+ Cinema', 'Кино 18+'),
                    Icon: Flame,
                  },
                  {
                    id: 'tv',
                    label: tr('TV Online', 'Live TV', 'ТВ Онлайн'),
                    Icon: Monitor,
                  },
                  {
                    id: 'radio',
                    label: tr('Radio Live', 'Live Radio', 'Радио'),
                    Icon: Radio,
                  },
                  {
                    id: 'music',
                    label: tr('Muzică', 'Music', 'Музыка'),
                    Icon: Music,
                  },
                  {
                    id: 'history',
                    label: tr('Istoric', 'History', 'История'),
                    Icon: Clock,
                  },
                  {
                    id: 'saved',
                    label: tr('Favorite', 'My List', 'Избранное'),
                    Icon: Bookmark,
                  },
                  {
                    id: 'downloads',
                    label: tr('Descărcate', 'Downloads', 'Скачанное'),
                    Icon: HardDriveDownload,
                  },
                  {
                    id: 'calendar',
                    label: tr('Calendar', 'Calendar', 'Календарь'),
                    Icon: Calendar,
                  },
                  {
                    id: 'filter',
                    label: tr('Filtru', 'Filter', 'Фильтр'),
                    Icon: SlidersHorizontal,
                  },
                  {
                    id: 'catalog',
                    label: tr('Catalog', 'Catalog', 'Каталог'),
                    Icon: Folder,
                  },
                  {
                    id: 'search',
                    label: tr('Căutare', 'Search', 'Поиск'),
                    Icon: Search,
                  },
                  {
                    id: 'torrents',
                    label: tr(
                      'Torrente FL',
                      'FileList Torrents',
                      'Торренты FL'
                    ),
                    Icon: Sparkles,
                  },
                ] as const
              )
                .filter(
                  (item) =>
                    (item.id !== 'iedem_vod' &&
                      item.id !== 'ru_shows' &&
                      item.id !== 'adult_18') ||
                    (item.id === 'adult_18'
                      ? !isPinLockRequired && isAdminJekaProfile(activeProfile)
                      : !isPinLockRequired && canProfileAccessIedem(activeProfile))
                )
                .map(({ id, label, Icon }) => {
                  const isActive = section === id && !activeVodItem;
                  return (
                    <button
                      key={id}
                      type="button"
                      data-sidebar-active={isActive ? 'true' : undefined}
                      onClick={() => {
                        setActiveVodItem(null);
                        if (
                          isCarMode ||
                          isMobilePhone ||
                          (typeof window !== 'undefined' && window.innerWidth < 768)
                        ) {
                          setIsSidebarOpen(false);
                        } else {
                          setIsSidebarOpen(true);
                        }
                        if (id === 'filter') {
                          setIsCatalogDrawerOpen(false);
                          setFilterSubMenu(null);
                          setIsFilterDrawerOpen(true);
                          return;
                        }
                        if (id === 'catalog') {
                          setIsFilterDrawerOpen(false);
                          setIsCatalogDrawerOpen(true);
                          return;
                        }
                        setIsFilterDrawerOpen(false);
                        setIsCatalogDrawerOpen(false);
                        setSection(id);
                        const mainEl =
                          rootContainerRef.current?.querySelector<HTMLElement>('main');
                        if (mainEl) {
                          mainEl.scrollTop = 0;
                          mainEl.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                        if (id === 'tv') {
                          setTvRegionId('FAV');
                          setTvCategoryId('ALL');
                          window.dispatchEvent(
                            new CustomEvent('aether:tv-enter-full-mode')
                          );
                        } else if (id === 'radio') {
                          setRadioCountry('FAV');
                        }
                      }}
                      className={`w-full min-h-[42px] px-4 py-2 rounded-full overflow-hidden flex items-center justify-start text-[15px] transition-none focus:outline-none cursor-pointer ${isActive
                        ? 'bg-white text-[#141414] font-semibold group-focus-within/sidebar:bg-transparent group-focus-within/sidebar:text-zinc-300 focus:!bg-white focus:!text-[#141414]'
                        : 'text-zinc-300 hover:bg-white/10 hover:text-white focus:bg-white focus:text-[#141414] focus:font-semibold'
                        }`}
                    >
                      {id === 'uhd_4k' ? (
                        <span className="w-6 h-5 mr-3 shrink-0 rounded bg-gradient-to-r from-amber-400 to-yellow-300 text-zinc-950 font-black text-[10px] flex items-center justify-center tracking-tighter shadow-sm">
                          4K
                        </span>
                      ) : id === 'adult_18' ? (
                        <span className="w-6 h-5 mr-3 shrink-0 rounded bg-rose-600 text-white font-black text-[10px] flex items-center justify-center tracking-tighter shadow-sm">
                          18+
                        </span>
                      ) : (
                        <Icon className="w-5 h-5 mr-3.5 shrink-0 stroke-[1.8]" />
                      )}
                      <span className="inline truncate flex-1 text-left">
                        {label}
                      </span>
                      {id === 'downloads' &&
                        (activeDownloadProgress || offlineMusicState.batchStats.active ? (
                          <Loader2 className="w-4 h-4 ml-1.5 text-[#60a5fa] animate-spin shrink-0" />
                        ) : offlineItems.length + offlineMusicState.recordsCount > 0 ? (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-blue-500/25 border border-blue-400/40 text-blue-200 text-[10px] font-extrabold tabular-nums shrink-0">
                            {offlineItems.length + offlineMusicState.recordsCount}
                          </span>
                        ) : null)}
                    </button>
                  );
                })}

              {/* Collapsible Dark-Glass Streaming Platforms Hub in Left Sidebar */}
              <div className="pt-2 mt-1.5 space-y-1.5 border-t border-white/10">
                {(() => {
                  const isAnyPlatActive =
                    (isStreamingPlatformSection(section) ||
                      section === 'youtube') &&
                    !activeVodItem;
                  const activePlatObj = STREAMING_PLATFORMS.find(
                    (p) => p.id === section
                  );
                  const isExpanded = isSidebarPlatformsOpen;
                  const renderMiniBrandMark = (platId: PlatformLogoId) => {
                    switch (platId) {
                      case 'netflix':
                        return (
                          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
                            <path fill="#B1060F" d="M5 2h4.2v20L5 21.5V2zm9.8 0H19v20l-4.2-.5V2z" />
                            <path fill="#E50914" d="M5 2h4.3l9.7 20h-4.3L5 2z" />
                          </svg>
                        );
                      case 'hbo':
                        return (
                          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
                            <circle cx="12" cy="12" r="8.5" fill="none" stroke="#8b5cf6" strokeWidth="4.2" />
                            <circle cx="12" cy="12" r="2.6" fill="#a78bfa" />
                          </svg>
                        );
                      case 'apple':
                        return (
                          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
                            <path
                              fill="currentColor"
                              d="M15.8 12.7c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.2.8-.7 0-1.7-.8-2.8-.7-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7 1.3 0 1.7.7 2.8.7 1.2 0 1.9-1 2.6-2.1.8-1.2 1.2-2.4 1.2-2.5-.1 0-2.5-1-2.5-3.4zM13.6 6.5c.6-.7 1-1.7.9-2.7-.9 0-2 .6-2.6 1.3-.5.6-1 1.6-.9 2.6 1 .1 2-.5 2.6-1.2z"
                            />
                          </svg>
                        );
                      case 'disney':
                        return (
                          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
                            <path d="M4 13c4.5-4.5 11.5-4.5 16 0" fill="none" stroke="#0ea5e9" strokeWidth="2.2" strokeLinecap="round" />
                            <path d="M12 5v10M7 10h10" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" />
                          </svg>
                        );
                      case 'prime':
                        return (
                          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
                            <path d="M4 12.5c4.5 3.6 11.2 3.6 15.5-.2" fill="none" stroke="#00A8E1" strokeWidth="2.3" strokeLinecap="round" />
                            <path d="M16.5 10.6l3.2 1.4-1.3 3.2" fill="none" stroke="#00A8E1" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        );
                      case 'paramount':
                        return (
                          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
                            <circle cx="12" cy="12" r="7.5" fill="none" stroke="#6366f1" strokeWidth="2.4" />
                            <circle cx="12" cy="12" r="3" fill="#818cf8" />
                          </svg>
                        );
                      case 'youtube':
                        return (
                          <svg viewBox="0 0 24 20" className="w-4 h-3 shrink-0" aria-hidden="true">
                            <rect width="24" height="20" rx="5" fill="#E50914" />
                            <path d="M10 6l6.5 4L10 14V6z" fill="#FFFFFF" />
                          </svg>
                        );
                    }
                  };

                  return (
                    <>
                      <button
                        type="button"
                        data-sidebar-active={
                          !isExpanded && isAnyPlatActive ? 'true' : undefined
                        }
                        onClick={() => {
                          setIsSidebarPlatformsOpen((prev) => !prev);
                        }}
                        className={`w-full min-h-[42px] px-4 py-2 rounded-full overflow-hidden flex items-center justify-between gap-2 text-[15px] transition-none focus:outline-none cursor-pointer ${
                          !isExpanded && isAnyPlatActive
                            ? 'bg-white text-[#141414] font-semibold group-focus-within/sidebar:bg-transparent group-focus-within/sidebar:text-zinc-300 focus:!bg-white focus:!text-[#141414]'
                            : isAnyPlatActive
                              ? 'bg-white/[0.08] text-white font-semibold hover:bg-white/[0.12] focus:bg-white focus:text-[#141414]'
                              : 'text-zinc-300 hover:bg-white/10 hover:text-white focus:bg-white focus:text-[#141414] focus:font-semibold'
                        }`}
                      >
                        <span className="flex items-center gap-3.5 min-w-0">
                          <Layers className="w-5 h-5 shrink-0 stroke-[1.8]" />
                          <span className="inline truncate">
                            {tr('Platforme', 'Platforms', 'Платформы')}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 shrink-0">
                          {!isExpanded && (section === 'youtube' || activePlatObj) ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight max-w-[92px] truncate ${
                                isAnyPlatActive
                                  ? 'bg-[#141414]/15 text-[#141414]'
                                  : 'bg-white/15 text-zinc-200'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                              <span className="truncate">
                                {section === 'youtube' ? 'YouTube' : activePlatObj?.label}
                              </span>
                            </span>
                          ) : null}
                          <ChevronDown
                            className={`w-4 h-4 shrink-0 opacity-70 transition-transform duration-200 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </span>
                      </button>

                      {/* Calm 2-Column Dark-Glass Sub-Grid inside Sidebar */}
                      {isExpanded && (
                        <div className="grid grid-cols-2 gap-1.5 px-2 pt-0.5 pb-1">
                          {STREAMING_PLATFORMS.map((plat) => {
                            const isActive =
                              section === plat.id && !activeVodItem;
                            const shortLabel =
                              plat.id === 'prime'
                                ? 'Prime'
                                : plat.id === 'paramount'
                                  ? 'Sky'
                                  : plat.label;
                            return (
                              <button
                                key={plat.id}
                                type="button"
                                title={plat.label}
                                data-sidebar-active={isActive ? 'true' : undefined}
                                onClick={() => {
                                  setActiveVodItem(null);
                                  if (
                                    isMobilePhone ||
                                    (typeof window !== 'undefined' && window.innerWidth < 768)
                                  ) {
                                    setIsSidebarOpen(false);
                                  } else {
                                    setIsSidebarOpen(true);
                                  }
                                  setIsFilterDrawerOpen(false);
                                  setIsCatalogDrawerOpen(false);
                                  setPlatformMediaTab('series');
                                  setSection(plat.id);
                                }}
                                className={`h-[34px] px-2.5 rounded-xl border inline-flex items-center justify-start gap-2 text-[12px] leading-none transition-colors focus:outline-none cursor-pointer ${
                                  isActive
                                    ? 'bg-white text-[#141414] border-white font-semibold shadow-sm group-focus-within/sidebar:bg-white/[0.08] group-focus-within/sidebar:text-white focus:!bg-white focus:!text-[#141414]'
                                    : 'bg-white/[0.045] hover:bg-white/[0.10] border-white/[0.07] text-zinc-300 hover:text-white focus:bg-white focus:text-[#141414] focus:border-white focus:font-semibold'
                                }`}
                              >
                                {renderMiniBrandMark(plat.id)}
                                <span className="truncate">{shortLabel}</span>
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            title="YouTube Premium"
                            data-sidebar-active={
                              section === 'youtube' && !activeVodItem
                                ? 'true'
                                : undefined
                            }
                            onClick={() => {
                              setActiveVodItem(null);
                              if (
                                isMobilePhone ||
                                (typeof window !== 'undefined' && window.innerWidth < 768)
                              ) {
                                setIsSidebarOpen(false);
                              } else {
                                setIsSidebarOpen(true);
                              }
                              setIsFilterDrawerOpen(false);
                              setIsCatalogDrawerOpen(false);
                              setSection('youtube');
                            }}
                            className={`col-span-2 h-[34px] px-2.5 rounded-xl border inline-flex items-center justify-start gap-2 text-[12px] leading-none transition-colors focus:outline-none cursor-pointer ${
                              section === 'youtube' && !activeVodItem
                                ? 'bg-white text-[#141414] border-white font-semibold shadow-sm group-focus-within/sidebar:bg-white/[0.08] group-focus-within/sidebar:text-white focus:!bg-white focus:!text-[#141414]'
                                : 'bg-white/[0.045] hover:bg-white/[0.10] border-white/[0.07] text-zinc-300 hover:text-white focus:bg-white focus:text-[#141414] focus:border-white focus:font-semibold'
                            }`}
                          >
                            {renderMiniBrandMark('youtube')}
                            <span className="truncate">YouTube Premium</span>
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Smart TV Settings inside Lampa Left Sidebar */}
              <div className="pt-2 mt-2 border-t border-white/10 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    if (isMobilePhone || (typeof window !== 'undefined' && window.innerWidth < 768)) {
                      setIsSidebarOpen(false);
                    }
                    setIsFilterDrawerOpen(false);
                    setIsCatalogDrawerOpen(false);
                    setSettingsSubMenu(null);
                    setIsSettingsDrawerOpen(true);
                  }}
                  className={`w-full min-h-[42px] px-4 py-2 rounded-full overflow-hidden flex items-center justify-start gap-3.5 text-[15px] transition-none focus:outline-none cursor-pointer ${isSettingsDrawerOpen
                    ? 'bg-white text-[#141414] font-semibold'
                    : 'text-zinc-300 hover:bg-white/10 hover:text-white focus:bg-white focus:text-[#141414] focus:font-semibold'
                    }`}
                >
                  <Settings className="w-5 h-5 shrink-0 stroke-[1.8]" />
                  <span className="inline truncate">
                    {tr('Setări TV', 'TV Settings', 'Настройки')}
                  </span>
                </button>

                <button
                  type="button"
                  data-sidebar-active={
                    section === 'cartoons' && !activeVodItem ? 'true' : undefined
                  }
                  onClick={() => {
                    setActiveVodItem(null);
                    if (isMobilePhone || (typeof window !== 'undefined' && window.innerWidth < 768)) {
                      setIsSidebarOpen(false);
                    } else {
                      setIsSidebarOpen(true);
                    }
                    setIsFilterDrawerOpen(false);
                    setIsCatalogDrawerOpen(false);
                    setSection('cartoons');
                  }}
                  className={`w-full min-h-[42px] px-4 py-2 rounded-full overflow-hidden flex items-center justify-start gap-3.5 text-[15px] transition-none focus:outline-none cursor-pointer ${section === 'cartoons' && !activeVodItem
                    ? 'bg-white text-[#141414] font-semibold group-focus-within/sidebar:bg-transparent group-focus-within/sidebar:text-zinc-300 focus:!bg-white focus:!text-[#141414]'
                    : 'text-zinc-300 hover:bg-white/10 hover:text-white focus:bg-white focus:text-[#141414] focus:font-semibold'
                    }`}
                >
                  <Smile className="w-5 h-5 shrink-0 stroke-[1.8]" />
                  <span className="inline truncate">
                    {tr('Desene Animate', 'Cartoons', 'Мультфильмы')}
                  </span>
                </button>


              </div>
            </nav>

            {/* Bottom Sidebar Cross-Device Active Video Widget ("Rulează acum pe alt device") */}
            {(() => {
              if (historyList.length === 0) return null;
              const curDevId = getOrCreateCurrentDeviceId();
              const curDevName = sanitizeDeviceName(detectCurrentDeviceName());
              const isOtherDev = (e: VodWatchProgressEntry) => {
                if (e.deviceId && e.deviceId !== curDevId) return true;
                const dName = sanitizeDeviceName(e.deviceName);
                return Boolean(dName && dName !== curDevName);
              };

              // Strictly show ONLY when a video is actively playing RIGHT NOW on another device (isPlayingNow === true + heartbeat < 20s)
              const activeEntry = historyList.find(
                (e) =>
                  isOtherDev(e) &&
                  e.isPlayingNow === true &&
                  Date.now() - (e.updatedAt || 0) < 20000
              );
              if (!activeEntry?.item) return null;

              const isLiveNow = true;
              const isFromAnotherDevice = true;
              const devLabel =
                sanitizeDeviceName(activeEntry.deviceName) ||
                (curDevName === 'Smart TV' ? 'Mac / Laptop' : 'Smart TV');
              const totalDur =
                activeEntry.duration && activeEntry.duration > 60
                  ? activeEntry.duration
                  : activeEntry.item.type === 'series'
                    ? 2700
                    : 5400;
              const pct = Math.min(
                100,
                Math.max(
                  4,
                  Math.round((activeEntry.currentTime / totalDur) * 100)
                )
              );
              const posterUrl = resolveSafeVodPosterUrl(activeEntry.item);

              return (
                <div className="mt-auto pt-2.5 border-t border-white/10">
                  <button
                    type="button"
                    title={tr(
                      `Continuă pe acest ecran: ${activeEntry.item.name} (${formatWatchSeconds(activeEntry.currentTime)})`,
                      `Continue on this screen: ${activeEntry.item.name} (${formatWatchSeconds(activeEntry.currentTime)})`,
                      `Продолжить здесь: ${activeEntry.item.name} (${formatWatchSeconds(activeEntry.currentTime)})`
                    )}
                    onClick={() => {
                      handleOpenVod(
                        activeEntry.item,
                        true,
                        activeEntry.item.type === 'series'
                          ? activeEntry.season
                          : undefined,
                        activeEntry.item.type === 'series'
                          ? activeEntry.episode
                          : undefined
                      );
                    }}
                    className="group/remotecard w-full p-1.5 sm:p-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] focus:bg-white focus:text-[#141414] border border-white/15 text-left transition-all focus:outline-none cursor-pointer shadow-lg"
                  >
                    {/* Header Status Badge (Hidden on narrow 64px sidebar, shown on sm:w-56) */}
                    <div className="hidden sm:flex items-center justify-between gap-1.5 mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span
                            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-90 ${isLiveNow ? 'bg-emerald-400' : 'bg-blue-400'
                              }`}
                          />
                          <span
                            className={`relative inline-flex rounded-full h-2 w-2 ${isLiveNow ? 'bg-emerald-400' : 'bg-blue-400'
                              }`}
                          />
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 group-focus/remotecard:text-[#1e3a8a] truncate">
                          {isLiveNow
                            ? tr(
                              `Rulează • ${devLabel}`,
                              `Playing • ${devLabel}`,
                              `Играет • ${devLabel}`
                            )
                            : isFromAnotherDevice
                              ? tr(
                                `Alt device • ${devLabel}`,
                                `Other device • ${devLabel}`,
                                `Устройство • ${devLabel}`
                              )
                              : tr(
                                `Activ • ${devLabel}`,
                                `Active • ${devLabel}`,
                                `Активно • ${devLabel}`
                              )}
                        </span>
                      </div>
                      <Monitor className="w-3.5 h-3.5 text-zinc-400 group-focus/remotecard:text-[#141414] shrink-0" />
                    </div>

                    {/* Poster + Title + Timestamp */}
                    <div className="flex items-center justify-center sm:justify-start gap-2.5">
                      <div className="relative w-9 h-12 sm:w-10 sm:h-14 rounded-lg overflow-hidden bg-zinc-900 border border-white/15 shrink-0">
                        <img
                          src={posterUrl}
                          alt={activeEntry.item.name}
                          onError={(e) => handleVodPosterImgError(e, activeEntry.item)}
                          className="w-full h-full object-cover"
                        />
                        <span className="sm:hidden absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-black" />
                      </div>

                      <div className="hidden sm:flex flex-col min-w-0 flex-1 gap-1">
                        <div className="text-xs font-extrabold text-white group-focus/remotecard:text-[#141414] truncate leading-tight">
                          {activeEntry.item.name}
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-300 group-focus/remotecard:text-zinc-700 tabular-nums">
                          {activeEntry.item.type === 'series' && (
                            <span className="px-1.5 py-0.5 rounded bg-[#1e3a8a] text-white group-focus/remotecard:bg-[#141414] group-focus/remotecard:text-white text-[9px] font-black">
                              S{activeEntry.season}:E{activeEntry.episode}
                            </span>
                          )}
                          <span className="truncate">
                            ▶ {formatWatchSeconds(activeEntry.currentTime)}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-1 rounded-full bg-white/20 group-focus/remotecard:bg-black/20 overflow-hidden mt-0.5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-blue-400 group-focus/remotecard:from-[#1e3a8a] group-focus/remotecard:to-[#2563eb]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })()}
          </aside>
        )}

        {/* MAIN RIGHT SMART TV CANVAS */}
        <div
          onScroll={(e) => {
            if (e.currentTarget === e.target) {
              if (e.currentTarget.scrollTop !== 0) e.currentTarget.scrollTop = 0;
              if (e.currentTarget.scrollLeft !== 0) e.currentTarget.scrollLeft = 0;
            }
          }}
          className="relative flex-1 min-w-0 min-h-0 flex flex-col h-full overflow-hidden"
        >

          {/* MAIN SCROLLABLE CONTENT AREA */}
          <main
            tabIndex={-1}
            onScroll={(e) => {
              if (e.currentTarget.scrollLeft !== 0) {
                e.currentTarget.scrollLeft = 0;
              }
              handleMobileMainScroll(e.currentTarget);
            }}
            style={
              !isPlayingVod && isMobilePhone && !isPortraitViewport
                ? {
                  paddingLeft:
                    'max(0.75rem, var(--safe-left, env(safe-area-inset-left, 0px)))',
                  paddingRight:
                    'max(0.75rem, var(--safe-right, env(safe-area-inset-right, 0px)))',
                }
                : undefined
            }
            className={
              isAnyFullModePlayer
                ? 'flex-1 min-h-0 overflow-hidden p-0 m-0'
                : section === 'tv' && !activeVodItem
                  ? isCarMode
                    ? 'flex-1 min-h-0 w-full max-w-full overflow-y-auto overflow-x-hidden overscroll-x-none px-2 sm:px-3 pt-1 pb-2 space-y-2 outline-none'
                    : isMobilePhone
                      ? `flex-1 min-h-0 w-full max-w-full overflow-y-auto overflow-x-hidden overscroll-x-none px-2 pt-2 ${!isPortraitViewport ? 'pb-24' : 'pb-24'} space-y-3 outline-none`
                      : 'flex-1 min-h-0 w-full max-w-full overflow-y-auto overflow-x-hidden overscroll-x-none px-2 sm:px-6 pt-2 md:pt-1.5 max-md:pb-24 pb-2 sm:pb-4 space-y-3 outline-none'
                  : section === 'music' && !activeVodItem
                    ? isCarMode
                      ? 'flex-1 min-h-0 w-full max-w-full overflow-y-auto overflow-x-hidden overscroll-x-none p-0 m-0 flex flex-col outline-none'
                      : isMobilePhone
                        ? 'flex-1 min-h-0 w-full max-w-full overflow-y-auto overflow-x-hidden overscroll-x-none pt-0 pb-0 m-0 outline-none'
                        : 'flex-1 min-h-0 w-full max-w-full overflow-y-auto overflow-x-hidden overscroll-x-none pt-0 pb-0 m-0 md:flex md:flex-col outline-none'
                    : isCarMode
                      ? 'flex-1 min-h-0 w-full max-w-full overflow-y-auto overflow-x-hidden overscroll-x-none px-2.5 sm:px-4 pt-1.5 pb-3 space-y-3 outline-none'
                      : isMobilePhone
                        ? `flex-1 min-h-0 w-full max-w-full overflow-y-auto overflow-x-hidden overscroll-x-none px-3 pt-2.5 pb-24 space-y-5 outline-none`
                        : 'flex-1 min-h-0 w-full max-w-full overflow-y-auto overflow-x-hidden overscroll-x-none px-3 sm:px-8 pt-2.5 sm:pt-3.5 max-md:pb-24 pb-5 space-y-5 sm:space-y-6 outline-none'
            }
          >
            {/* 1A. ACTIVE MOVIE / SERIES 100% FULL MODE CINEMA PLAYER (WHEN PLAYING) */}
            {activeVodItem && isPlayingVod ? (
              <>
                <div
                  aria-hidden="true"
                  className="fixed inset-[-100px] z-[199] bg-black pointer-events-none"
                />
                <div
                  ref={playerBoxRef}
                  onMouseMove={() => {
                    if (isMobilePhone) return;
                    if (Date.now() - lastBackHideOsdAtRef.current < 700) {
                      return;
                    }
                    wakeVodOsd();
                  }}
                  onKeyDownCapture={(e) => {
                    if (
                      e.key === 'Escape' ||
                      e.key === 'GoBack' ||
                      e.key === 'BrowserBack' ||
                      e.key === 'Backspace' ||
                      e.keyCode === 27 ||
                      e.keyCode === 461 ||
                      e.keyCode === 10009
                    ) {
                      return;
                    }
                    const targetEl = e.target as HTMLElement | null;
                    if (
                      targetEl?.closest(
                        '[data-vod-fullscreen-btn="true"], [data-vod-top-back-btn="true"]'
                      )
                    ) {
                      return;
                    }
                    if (
                      !isMobilePhone &&
                      tvSettings.autoFullscreenOnPlay &&
                      typeof document !== 'undefined' &&
                      document.documentElement.classList.contains('smart-tv-mode') &&
                      !isNativeDocumentFullscreen()
                    ) {
                      ensureTvFullscreen();
                    }
                  }}
                  onClickCapture={(e) => {
                    const targetEl = e.target as HTMLElement | null;
                    if (
                      targetEl?.closest(
                        '[data-vod-fullscreen-btn="true"], [data-vod-top-back-btn="true"]'
                      )
                    ) {
                      return;
                    }
                    if (
                      !isMobilePhone &&
                      tvSettings.autoFullscreenOnPlay &&
                      typeof document !== 'undefined' &&
                      document.documentElement.classList.contains('smart-tv-mode') &&
                      !isNativeDocumentFullscreen()
                    ) {
                      ensureTvFullscreen();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Escape' ||
                      e.key === 'GoBack' ||
                      e.key === 'BrowserBack' ||
                      e.key === 'Backspace' ||
                      e.keyCode === 27 ||
                      e.keyCode === 461 ||
                      e.keyCode === 10009
                    ) {
                      return;
                    }
                    wakeVodOsd();
                  }}
                  onClick={() => {
                    if (!isMobilePhone) {
                      wakeVodOsd();
                    }
                  }}
                  data-vod-full-player="true"
                  style={
                    isMobilePhone && isMobileCustomFullscreen && isPortraitViewport
                      ? {
                        position: 'fixed',
                        top: `${vvRect.offsetTop + vvRect.height / 2}px`,
                        left: `${vvRect.offsetLeft + vvRect.width / 2}px`,
                        width: `${vvRect.height}px`,
                        height: `${vvRect.width}px`,
                        maxWidth: `${vvRect.height}px`,
                        maxHeight: `${vvRect.width}px`,
                        transform: 'translate(-50%, -50%) rotate(90deg)',
                        transformOrigin: 'center center',
                        zIndex: 9999,
                      }
                      : isMobilePhone
                        ? {
                          position: 'fixed',
                          inset: 0,
                          width: '100%',
                          height: '100vh',
                          maxWidth: '100vw',
                          maxHeight: '100vh',
                          zIndex: 9999,
                        }
                        : {
                          height: '100vh',
                          maxHeight: '100vh',
                        }
                  }
                  className="fixed inset-0 z-[200] w-full h-full bg-black flex flex-col overflow-hidden"
                >
                  {/* MINIMAL FLOATING TOP CONTROLS (No duplicated title/poster — Cinema Card is in Bottom Dock) */}
                  <div
                    onMouseEnter={() => {
                      if (!isMobilePhone) {
                        wakeVodOsd();
                      }
                    }}
                    style={
                      isMobilePhone
                        ? isMobileCustomFullscreen && isPortraitViewport
                          ? {
                            top: '14px',
                            left: 'max(52px, calc(var(--safe-top, env(safe-area-inset-top, 0px)) + 12px))',
                            right:
                              'max(28px, calc(var(--safe-bottom, env(safe-area-inset-bottom, 0px)) + 12px))',
                          }
                          : !isPortraitViewport
                            ? {
                              top: 'max(12px, calc(var(--safe-top, env(safe-area-inset-top, 0px)) + 8px))',
                              left: 'max(18px, var(--safe-left, env(safe-area-inset-left, 0px)))',
                              right:
                                'max(18px, var(--safe-right, env(safe-area-inset-right, 0px)))',
                            }
                            : {
                              top: 'max(8px, calc(var(--safe-top, env(safe-area-inset-top, 0px)) + 6px))',
                              left: 'max(12px, var(--safe-left, env(safe-area-inset-left, 0px)))',
                              right:
                                'max(12px, var(--safe-right, env(safe-area-inset-right, 0px)))',
                            }
                        : {
                          top: 'max(14px, calc(var(--safe-top, env(safe-area-inset-top, 0px)) + 8px))',
                        }
                    }
                    data-vod-top-bar="true"
                    className={`group/vodtopbar absolute ${isMobilePhone
                      ? 'top-2 inset-x-3'
                      : 'top-3 sm:top-5 inset-x-3 sm:inset-x-7'
                      } z-[150] flex items-center justify-between gap-2 sm:gap-3 transition-all duration-300 ${isVodOsdVisible ||
                        isEpisodesDrawerOpen ||
                        isInfoSheetOpen ||
                        isDirectStreamLoading ||
                        isFileListStreamLoading ||
                        (activeVodItem.id.startsWith('yt_') && ytUseEmbedFallback) ||
                        (!activeVodItem.id.startsWith('yt_') &&
                          activeServer !== 'kinogram_hls' &&
                          activeServer !== 'filelist_torrent') ||
                        (!activeVodItem.id.startsWith('yt_') &&
                          activeServer === 'kinogram_hls' &&
                          !(
                            resolvedDirectStream?.ok &&
                            (resolvedDirectStream.dashUrl ||
                              resolvedDirectStream.hlsUrl ||
                              resolvedDirectStream.proxyHlsUrl)
                          )) ||
                        (!activeVodItem.id.startsWith('yt_') &&
                          activeServer === 'filelist_torrent' &&
                          !(
                            resolvedFileListStream?.ok &&
                            resolvedFileListStream.streamUrl
                          ))
                        ? 'opacity-100 translate-y-0 pointer-events-none visible'
                        : 'opacity-0 -translate-y-2 pointer-events-none invisible'
                      }`}
                  >
                    {/* Left: Clean Apple Liquid Glass Back Button (auto-hidden in iPadOS native fullscreen where system [X] sits top-left) + Mobile Title */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={() => {
                        if (isMobilePhone) wakeVodOsd();
                      }}
                      className="flex items-center gap-2 min-w-0 pointer-events-auto group-[.invisible]/vodtopbar:pointer-events-none"
                    >
                      {!(
                        isAppFullscreen &&
                        !isMobilePhone &&
                        typeof navigator !== 'undefined' &&
                        (/iPad|iPhone|iPod/i.test(navigator.userAgent || '') ||
                          (navigator.platform === 'MacIntel' &&
                            (navigator.maxTouchPoints || 0) > 1))
                      ) && (
                        <button
                          type="button"
                          data-vod-top-back-btn="true"
                          onTouchStart={(e) => {
                            wakeVodOsd();
                            const t = e.touches?.[0];
                            if (t) {
                              vodBackTouchStartRef.current = { x: t.clientX, y: t.clientY };
                            }
                          }}
                          onTouchEnd={(e) => {
                            const start = vodBackTouchStartRef.current;
                            vodBackTouchStartRef.current = null;
                            const t = e.changedTouches?.[0];
                            if (
                              start &&
                              t &&
                              (Math.abs(t.clientX - start.x) > 20 ||
                                Math.abs(t.clientY - start.y) > 20)
                            ) {
                              return;
                            }
                            e.preventDefault();
                            e.stopPropagation();
                            handleCloseVodPlayerBack();
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloseVodPlayerBack();
                          }}
                          className={`${isMobilePhone
                            ? 'min-h-[44px] min-w-[44px] h-11 px-4 text-xs gap-1.5'
                            : 'h-9 sm:h-10 px-3.5 sm:px-4 text-xs sm:text-[13px] gap-1.5'
                            } rounded-full apple-vod-liquid-dock active:scale-95 text-white/95 hover:text-white focus:outline-none focus:ring-4 focus:ring-white/40 font-semibold tracking-[-0.01em] inline-flex items-center transition-all shrink-0 cursor-pointer touch-manipulation select-none group`}
                        >
                          <ChevronLeft className="w-4 h-4 text-white/90 shrink-0 stroke-[2.2]" />
                          <span>
                            {tr('Înapoi', 'Back', 'Назад')}
                          </span>
                        </button>
                      )}

                      {/* Mobile-Only Title + Episode Badge in Top Bar */}
                      <div className={`${isMobilePhone ? 'flex' : 'flex sm:hidden'} items-center gap-1.5 min-w-0 px-3 py-1.5 rounded-full bg-zinc-950/85 border border-white/20 shadow-lg`}>
                        <span className="text-xs font-extrabold text-white truncate max-w-[125px] sm:max-w-[180px]">
                          {detailedMeta?.name || activeVodItem.name}
                        </span>
                        {activeVodItem.type === 'series' && (
                          <span className="px-1.5 py-0.5 rounded bg-[#2563eb]/35 text-[10px] font-black text-blue-200 shrink-0">
                            S{selectedSeason}:E{selectedEpisode}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Minimal Utility Pills */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={() => {
                        if (isMobilePhone) wakeVodOsd();
                      }}
                      className="flex items-center gap-2 shrink-0 pointer-events-auto group-[.invisible]/vodtopbar:pointer-events-none"
                    >
                      {pendingResumePromptSec !== null &&
                        pendingResumePromptSec > 10 && (
                          <button
                            type="button"
                            onClick={() => {
                              setResumeStartSeconds(0);
                              setPendingResumePromptSec(null);
                            }}
                            className="h-9 sm:h-10 px-3 sm:px-4 rounded-full bg-[#1e3a8a] hover:bg-[#1d4ed8] focus:bg-white focus:text-[#081220] text-white border border-[#3b82f6]/50 font-extrabold text-xs inline-flex items-center gap-1.5 shadow-lg cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>
                              {tr(
                                'De la 00:00',
                                'From 00:00',
                                'С 00:00'
                              )}
                            </span>
                          </button>
                        )}

                      {/* Only show Audio & Source Sheet button in Top Bar when using an external iframe server */}
                      {!activeVodItem.id.startsWith('yt_') &&
                        activeServer !== 'kinogram_hls' &&
                        activeServer !== 'filelist_torrent' && (
                          <button
                            ref={vodAudioBtnRef}
                            type="button"
                            onClick={() => {
                              const nextOpen = !isInfoSheetOpen;
                              setIsInfoSheetOpen(nextOpen);
                              setIsEpisodesDrawerOpen(false);
                              if (nextOpen) {
                                window.setTimeout(() => {
                                  const firstAudioOrSrvBtn =
                                    playerBoxRef.current?.querySelector<HTMLButtonElement>(
                                      '[data-sheet-quality-btn="true"], [data-sheet-audio-btn="true"], [data-sheet-server-btn="true"]'
                                    );
                                  firstAudioOrSrvBtn?.focus();
                                }, 50);
                              }
                            }}
                            className={`h-9 sm:h-10 px-3.5 sm:px-4 rounded-full text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-4 focus:ring-[#60a5fa] focus:bg-[#1e3a8a] focus:text-white cursor-pointer ${isInfoSheetOpen
                              ? 'bg-[#1e3a8a] text-white border border-[#3b82f6]/50 border border-[#bfdbfe]'
                              : 'tahoe-emerald-card hover:bg-[#193144] text-white'
                              }`}
                          >
                            <Layers className="w-3.5 h-3.5 text-[#60a5fa]" />
                            <span>
                              {tr('Audio & Sursă', 'Audio & Source', 'Аудио и Сервер')}
                            </span>
                          </button>
                        )}
                    </div>
                  </div>

                  {/* 100% Fullscreen Video Area */}
                  <div className="relative flex-1 w-full h-full min-h-0 bg-black overflow-hidden">
                    {/* Ambient Cinema Glow Backdrop for Iframe Fallbacks (hidden during startup loading & Smart TV playback to keep pure #000000 black) */}
                    {!isFileListStreamLoading &&
                      !isDirectStreamLoading &&
                      (typeof document === 'undefined' ||
                        !document.documentElement.classList.contains('smart-tv-mode')) &&
                      (detailedMeta?.background ||
                        activeVodItem.background ||
                        detailedMeta?.poster ||
                        activeVodItem.poster) && (
                        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
                          <img
                            src={
                              detailedMeta?.background ||
                              activeVodItem.background ||
                              detailedMeta?.poster ||
                              activeVodItem.poster
                            }
                            alt=""
                            aria-hidden="true"
                            className="w-full h-full object-cover blur-3xl opacity-45 scale-115 saturate-150"
                          />
                          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/50 via-zinc-950/25 to-zinc-950/60" />
                        </div>
                      )}

                    {activeVodItem.id.startsWith('yt_') ? (
                      (() => {
                        const ytVideoId = activeVodItem.id.slice(3);
                        const curYtIdx = ytItems.findIndex(
                          (v) => v.videoId === ytVideoId
                        );
                        const prevYt =
                          curYtIdx > 0 ? ytItems[curYtIdx - 1] : undefined;
                        const nextYt =
                          curYtIdx >= 0 && curYtIdx < ytItems.length - 1
                            ? ytItems[curYtIdx + 1]
                            : ytItems[0];

                        if (ytUseEmbedFallback) {
                          return (
                            <iframe
                              key={`yt_embed_${ytVideoId}`}
                              src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(
                                ytVideoId
                              )}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                              title={activeVodItem.name}
                              referrerPolicy="strict-origin-when-cross-origin"
                              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                              allowFullScreen
                              style={{ backgroundColor: '#000000', colorScheme: 'dark' }}
                              className="relative z-10 w-full h-full border-0 bg-black"
                            />
                          );
                        }

                        return (
                          <VodNativeHlsPlayer
                            hlsUrl={`/api/youtube/stream?id=${encodeURIComponent(
                              ytVideoId
                            )}`}
                            durationHintSec={
                              activeYtDurationSec > 5 ? activeYtDurationSec : 600
                            }
                            preferredQuality={tvSettings.defaultVideoQuality}
                            initialSubFontSize={tvSettings.defaultSubFontSize}
                            preferredSubLang="off"
                            startAtSeconds={0}
                            poster={activeVodItem.poster}
                            backdropUrl={activeVodItem.background || activeVodItem.poster}
                            title={activeVodItem.name}
                            subtitle="YouTube Premium"
                            mediaType="movie"
                            isOsdVisible={isVodOsdVisible}
                            sourceQualityBadge="YT PREMIUM • 1080p • FĂRĂ RECLAME"
                            onResolutionChange={setLiveVodResolution}
                            onWakeOsd={wakeVodOsd}
                            onHideOsd={hideVodOsd}
                            onClosePlayer={handleCloseVodPlayerBack}
                            prevEpisodeLabel={prevYt ? '◀ Clip Anterior' : undefined}
                            nextEpisodeLabel={nextYt ? 'Clip Următor ▶' : undefined}
                            onPrevEpisode={
                              prevYt
                                ? () => handlePlayYouTubeVideo(prevYt)
                                : undefined
                            }
                            onNextEpisode={
                              nextYt
                                ? () => handlePlayYouTubeVideo(nextYt)
                                : undefined
                            }
                            onStreamError={() => setYtUseEmbedFallback(true)}
                          />
                        );
                      })()
                    ) : (activeServer === 'filelist_torrent' ||
                        (!isDirectStreamLoading &&
                          !(
                            resolvedDirectStream?.ok &&
                            (resolvedDirectStream.dashUrl ||
                              resolvedDirectStream.hlsUrl ||
                              resolvedDirectStream.proxyHlsUrl)
                          ))) &&
                      !matchedOfflineVodItem &&
                      (isFileListStreamLoading ||
                        Boolean(
                          resolvedFileListStream?.ok &&
                            resolvedFileListStream.streamUrl
                        )) ? (
                      isFileListStreamLoading ? (
                        <FilmioStartupLoader />
                      ) : resolvedFileListStream?.ok &&
                        resolvedFileListStream.streamUrl ? (
                        <VodNativeHlsPlayer
                          key={`vod_fl_${activeVodItem.id}_${resolvedFileListStream.torrentId || 0}_${selectedSeason}_${selectedEpisode}`}
                          hlsUrl={(() => {
                            const base = resolvedFileListStream.streamUrl || '';
                            if (!base) return base;
                            const effSubLang =
                              tvSettings.defaultSubLang === 'off' && selectedMkvSubIdx === null
                                ? 'off'
                                : preferredSubLang || tvSettings.defaultSubLang || 'ro';
                            const sep = base.includes('?') ? '&' : '?';
                            return `${base}${sep}subLang=${encodeURIComponent(effSubLang)}${
                              selectedMkvSubIdx !== null ? `&subIdx=${selectedMkvSubIdx}` : ''
                            }`;
                          })()}
                          durationHintSec={(() => {
                            if (
                              resolvedFileListStream.durationSec &&
                              resolvedFileListStream.durationSec > 60
                            ) {
                              return resolvedFileListStream.durationSec;
                            }
                            const rawRt = String(detailedMeta?.runtime || '');
                            const hmMatch = rawRt.match(/^(\d{1,2}):(\d{2})$/);
                            if (hmMatch) {
                              return (
                                Number(hmMatch[1]) * 3600 + Number(hmMatch[2]) * 60
                              );
                            }
                            const minMatch = rawRt.match(/(\d+)\s*min/i) || rawRt.match(/^(\d+)$/);
                            if (minMatch && Number(minMatch[1]) > 5) {
                              return Number(minMatch[1]) * 60;
                            }
                            const savedDur =
                              (findWatchProgressEntry(watchProgressMap, activeVodItem) ||
                               findWatchProgressEntry(watchProgressMapRef.current, activeVodItem))?.duration;
                            if (savedDur && savedDur > 60) return savedDur;
                            return activeVodItem.type === 'series' ? 2700 : 7200;
                          })()}
                          audioTrackLabels={resolvedFileListStream.audioNames}
                          initialAudioTrackIndex={
                            selectedAudioTrackIdx >= 0 &&
                              selectedAudioTrackIdx <
                              (resolvedFileListStream.audioNames?.length || 1)
                              ? selectedAudioTrackIdx
                              : (resolvedFileListStream.audioNames?.length || 0) > 1
                                ? resolveAudioTrackIndexByPreference(
                                  resolvedFileListStream.audioNames || [],
                                  effectiveVodAudioPref
                                )
                                : -1
                          }
                          isForeign={isCurrentVodForeign}
                          preferredAudioLang={effectiveVodAudioPref}
                          preferredQuality={tvSettings.defaultVideoQuality}
                          initialSubFontSize={tvSettings.defaultSubFontSize}
                          preferredSubLang={tvSettings.defaultSubLang}
                          startAtSeconds={resumeStartSeconds}
                          poster={effectivePlayerPoster}
                          backdropUrl={
                            detailedMeta?.background ||
                            activeVodItem.background ||
                            detailedMeta?.poster ||
                            activeVodItem.poster
                          }
                          title={
                            isCurrentVodForeign && uiLang !== 'ru'
                              ? detailedMeta?.nameOriginal ||
                              detailedMeta?.name ||
                              activeVodItem.nameOriginal ||
                              activeVodItem.name
                              : detailedMeta?.name || activeVodItem.name
                          }
                          subtitle={
                            (activeVodItem.type === 'series'
                              ? episodesForSeason.find(
                                (ep) => ep.episode === selectedEpisode
                              )?.name
                              : '') ||
                            detailedMeta?.releaseInfo ||
                            activeVodItem.releaseInfo
                          }
                          imdbId={
                            activeVodItem.id.startsWith('tt')
                              ? activeVodItem.id
                              : detailedMeta?.imdbId ||
                              resolvedFileListStream.selectedTorrent?.imdbId ||
                              activeVodItem.id
                          }
                          tmdbId={
                            detailedMeta?.moviedb_id || activeVodItem.moviedb_id
                          }
                          mediaType={activeVodItem.type}
                          season={selectedSeason}
                          episode={selectedEpisode}
                          subtitleVttUrl={activeSubVttUrl}
                          subtitleLabel={activeSubLabel}
                          subtitleCues={activeSubCues}
                          embeddedSubtitleTracks={mkvSubtitleTracks}
                          onSelectEmbeddedSubtitle={(trk) => {
                            const curPos = Math.floor(lastPlaybackTimeRef.current?.cur || 0);
                            if (curPos > 3) setResumeStartSeconds(curPos);
                            userDisabledSubRef.current = false;
                            setUseManualOnlineSub(false);
                            usingMkvLiveSubRef.current = true;
                            setSelectedMkvSubIdx(trk.index);
                            setActiveSubVttUrl(null);
                            setActiveSubCues([]);
                            setActiveSubLabel(`${trk.label} (Sincron)`);
                          }}
                          isOsdVisible={isVodOsdVisible}
                          activeServerId={activeServer}
                          serverOptions={currentServerOptions}
                          sourceQualityBadge={
                            resolvedFileListStream.selectedTorrent?.quality ||
                            activeVodItem.qualityBadge
                          }
                          externalQualityOptions={flQualityOptions}
                          onStreamError={() => {
                            const curPos = Math.floor(
                              lastPlaybackTimeRef.current?.cur ||
                                resumeStartSeconds ||
                                0
                            );
                            if (curPos > 5) {
                              setResumeStartSeconds(curPos);
                            }
                            if (
                              resolvedDirectStream?.ok &&
                              (resolvedDirectStream.dashUrl ||
                                resolvedDirectStream.hlsUrl ||
                                resolvedDirectStream.proxyHlsUrl)
                            ) {
                              userManuallySelectedServerRef.current = true;
                              setActiveServer('kinogram_hls');
                            }
                          }}
                          onResolutionChange={setLiveVodResolution}
                          onWakeOsd={wakeVodOsd}
                          onHideOsd={hideVodOsd}
                          onClosePlayer={handleCloseVodPlayerBack}
                          prevEpisodeLabel={prevEpisodeInfo?.label}
                          nextEpisodeLabel={
                            activeVodItem.isAdultKlubnichka
                              ? (nextKlubCard ? tr(`Următorul: ${nextKlubCard.title.slice(0, 24)}...`, `Next: ${nextKlubCard.title.slice(0, 24)}...`, `Следующее: ${nextKlubCard.title.slice(0, 24)}...`) : undefined)
                              : nextEpisodeInfo?.label
                          }
                          onPrevEpisode={
                            prevEpisodeInfo
                              ? () => {
                                userSelectedFlTorrentIdRef.current = null;
                                if (prevEpisodeInfo.season !== selectedSeason) {
                                  setSelectedSeason(prevEpisodeInfo.season);
                                }
                                setSelectedEpisode(prevEpisodeInfo.episode);
                                setResumeStartSeconds(0);
                              }
                              : undefined
                          }
                          onNextEpisode={
                            activeVodItem.isAdultKlubnichka
                              ? (nextKlubCard
                                ? () => {
                                  const mapped = mapKlubCardToCinemetaItem(nextKlubCard);
                                  persistedKlubCache.lastClickedCardId = nextKlubCard.id;
                                  setIsKlubSuggestionsOpen(false);
                                  handleOpenVod(mapped, true);
                                }
                                : undefined)
                              : (nextEpisodeInfo
                                ? () => {
                                  userSelectedFlTorrentIdRef.current = null;
                                  if (nextEpisodeInfo.season !== selectedSeason) {
                                    setSelectedSeason(nextEpisodeInfo.season);
                                  }
                                  setSelectedEpisode(nextEpisodeInfo.episode);
                                  setResumeStartSeconds(0);
                                }
                                : undefined)
                          }
                          onOpenEpisodesDrawer={
                            activeVodItem.type === 'series'
                              ? () => {
                                setIsInfoSheetOpen(false);
                                setIsEpisodesDrawerOpen((prev) => {
                                  const nextOpen = !prev;
                                  if (nextOpen) {
                                    window.setTimeout(() => {
                                      const targetBtn =
                                        playerBoxRef.current?.querySelector<HTMLElement>(
                                          '[data-episodes-drawer="true"] [data-drawer-initial-focus="true"]'
                                        ) ||
                                        playerBoxRef.current?.querySelector<HTMLElement>(
                                          '[data-episodes-drawer="true"] button'
                                        );
                                      targetBtn?.focus();
                                    }, 45);
                                  }
                                  return nextOpen;
                                });
                              }
                              : undefined
                          }
                          onOpenInfoSheet={() => {
                            setIsEpisodesDrawerOpen(false);
                            setIsInfoSheetOpen((prev) => {
                              const nextOpen = !prev;
                              if (nextOpen) {
                                window.setTimeout(() => {
                                  const targetBtn =
                                    playerBoxRef.current?.querySelector<HTMLElement>(
                                      '[data-vod-sheet-open="true"] [data-sheet-close-btn="true"]'
                                    ) ||
                                    playerBoxRef.current?.querySelector<HTMLElement>(
                                      '[data-vod-sheet-open="true"] button'
                                    );
                                  targetBtn?.focus();
                                }, 45);
                              }
                              return nextOpen;
                            });
                          }}
                          onSelectServer={(srvId) => {
                            const curPos = Math.floor(lastPlaybackTimeRef.current?.cur || 0);
                            if (curPos > 3) setResumeStartSeconds(curPos);
                            userManuallySelectedServerRef.current = true;
                            const safeSrv: VodServerId =
                              srvId === 'filelist_torrent' ? 'filelist_torrent' : 'kinogram_hls';
                            if (safeSrv !== 'filelist_torrent') {
                              userSelectedFlTorrentIdRef.current = null;
                            }
                            setActiveServer(safeSrv);
                          }}
                          onSelectAudioTrackIndex={(idx) =>
                            setSelectedAudioTrackIdx(idx)
                          }
                          onRequestOriginalAudio={() =>
                            handleRequestOriginalAudio(false)
                          }
                          onApplyAutoSubtitle={({ vttBlobUrl, label, cues }) => {
                            userDisabledSubRef.current = false;
                            usingMkvLiveSubRef.current = false;
                            setUseManualOnlineSub(true);
                            setActiveSubVttUrl(vttBlobUrl);
                            setActiveSubLabel(label);
                            setActiveSubCues(cues);
                          }}
                          onOpenSubtitleFinder={() => setIsSubFinderOpen(true)}
                          onClearSubtitle={() => {
                            usingMkvLiveSubRef.current = false;
                            userDisabledSubRef.current = true;
                            setUseManualOnlineSub(true);
                            setActiveSubVttUrl(null);
                            setActiveSubLabel('');
                            setActiveSubCues([]);
                          }}
                          onTimeUpdate={(cur, dur) => {
                            lastPlaybackTimeRef.current = { cur, dur };
                            const prevEntry = findWatchProgressEntry(
                              watchProgressMapRef.current,
                              activeVodItem
                            );
                            const prevCur = prevEntry?.currentTime || 0;
                            if (
                              cur > 1 &&
                              (!prevEntry?.isPlayingNow ||
                                Math.abs(cur - prevCur) >= 4)
                            ) {
                              updateWatchProgress(
                                activeVodItem,
                                selectedSeason,
                                selectedEpisode,
                                cur,
                                dur
                              );
                            }

                            // Invisible Pre-buffering of next episode when < 120s remaining
                            if (
                              activeVodItem.type === 'series' &&
                              nextEpisodeInfo &&
                              dur > 120 &&
                              (dur - cur) <= 120
                            ) {
                              const nextKey = `${activeVodItem.id}_s${nextEpisodeInfo.season}_e${nextEpisodeInfo.episode}`;
                              if (hasPreloadedNextEpRef.current !== nextKey) {
                                hasPreloadedNextEpRef.current = nextKey;
                                const nextFlParams = new URLSearchParams({
                                  name: activeVodItem.name,
                                  type: 'series',
                                  s: String(nextEpisodeInfo.season),
                                  e: String(nextEpisodeInfo.episode),
                                  ru: isCurrentVodForeign ? '0' : '1',
                                });
                                fetch(buildFileListApiUrl(`/api/filelist/resolve?${nextFlParams.toString()}`)).catch(() => { });
                                const foundKpId = activeVodItem.kpId || (detailedMeta as any)?.kinopoiskId;
                                const resolvedImdb = activeVodItem.imdbId || detailedMeta?.imdbId;
                                resolveDirectVodStreamClient({
                                  kp: foundKpId,
                                  imdb: resolvedImdb,
                                  title: detailedMeta?.nameOriginal || activeVodItem.name,
                                  type: 'series',
                                  season: nextEpisodeInfo.season,
                                  episode: nextEpisodeInfo.episode,
                                }).catch(() => { });
                              }
                            }
                          }}
                        />
                      ) : (
                        <FilmioStartupLoader />
                      )
                    ) : activeServer === 'kinogram_hls' ||
                      activeServer === 'filelist_torrent' ||
                      Boolean(matchedOfflineVodItem) ||
                      ((isRomanianVodItem(detailedMeta || activeVodItem) ||
                        isFileListExclusiveRomanianTitle(
                          detailedMeta || activeVodItem
                        )) &&
                        (isDirectStreamLoading ||
                          Boolean(
                            resolvedDirectStream?.ok &&
                            (resolvedDirectStream.dashUrl ||
                              resolvedDirectStream.hlsUrl ||
                              resolvedDirectStream.proxyHlsUrl)
                          ))) ? (
                      isDirectStreamLoading && !matchedOfflineVodItem ? (
                        <FilmioStartupLoader />
                      ) : matchedOfflineVodItem ||
                        (resolvedDirectStream?.ok &&
                          (resolvedDirectStream.dashUrl ||
                            resolvedDirectStream.hlsUrl ||
                            resolvedDirectStream.proxyHlsUrl)) ? (
                        <VodNativeHlsPlayer
                          key={`vod_direct_${activeVodItem.id}_${selectedSeason}_${selectedEpisode}_${matchedOfflineVodItem?.id || resolvedDirectStream?.sourcePath || 'direct'}`}
                          offlineItem={matchedOfflineVodItem}
                          dashUrl={matchedOfflineVodItem ? undefined : resolvedDirectStream?.dashUrl}
                          hlsUrl={
                            matchedOfflineVodItem
                              ? undefined
                              : resolvedDirectStream?.hlsUrl ||
                                resolvedDirectStream?.proxyHlsUrl
                          }
                          fallbackHlsUrl={
                            matchedOfflineVodItem
                              ? undefined
                              : resolvedDirectStream?.fallbackHlsUrl ||
                                (resolvedDirectStream?.proxyHlsUrl &&
                                resolvedDirectStream.proxyHlsUrl !==
                                  resolvedDirectStream.hlsUrl
                                  ? resolvedDirectStream.proxyHlsUrl
                                  : undefined)
                          }
                          onStreamError={() => {
                            const curPos = Math.floor(
                              lastPlaybackTimeRef.current?.cur ||
                                resumeStartSeconds ||
                                0
                            );
                            if (curPos > 5) {
                              setResumeStartSeconds(curPos);
                            }
                            if (activeVodItem.isAdultKlubnichka && klubnichkaQualities.length > 1) {
                              const curIdx = klubnichkaQualities.findIndex(
                                (q) => q.url === resolvedDirectStream?.hlsUrl
                              );
                              const nextLower =
                                curIdx >= 0 && curIdx + 1 < klubnichkaQualities.length
                                  ? klubnichkaQualities[curIdx + 1]
                                  : klubnichkaQualities.find((q) => q.height <= 720);
                              if (nextLower && nextLower.url !== resolvedDirectStream?.hlsUrl) {
                                setResolvedDirectStream((prev) =>
                                  prev ? { ...prev, hlsUrl: nextLower.url } : prev
                                );
                                return;
                              }
                            }
                            if (
                              resolvedDirectStream?.backupHlsUrls &&
                              resolvedDirectStream.backupHlsUrls.length > 0
                            ) {
                              const [nextBackup, ...restBackups] =
                                resolvedDirectStream.backupHlsUrls;
                              if (nextBackup && nextBackup !== resolvedDirectStream.hlsUrl) {
                                setResolvedDirectStream((prev) =>
                                  prev
                                    ? {
                                      ...prev,
                                      hlsUrl: nextBackup,
                                      backupHlsUrls: restBackups,
                                    }
                                    : prev
                                );
                                return;
                              }
                            }
                            if (
                              isLocalHomeServer() &&
                              resolvedFileListStream?.ok &&
                              resolvedFileListStream.streamUrl
                            ) {
                              userManuallySelectedServerRef.current = true;
                              setActiveServer('filelist_torrent');
                            }
                          }}
                          durationHintSec={(() => {
                            if (
                              matchedOfflineVodItem?.duration &&
                              matchedOfflineVodItem.duration > 60
                            ) {
                              return matchedOfflineVodItem.duration;
                            }
                            if (
                              resolvedDirectStream?.duration &&
                              resolvedDirectStream.duration > 60
                            ) {
                              return resolvedDirectStream.duration;
                            }
                            const rawRt = String(detailedMeta?.runtime || '');
                            const hmMatch = rawRt.match(/^(\d{1,2}):(\d{2})$/);
                            if (hmMatch) {
                              return (
                                Number(hmMatch[1]) * 3600 + Number(hmMatch[2]) * 60
                              );
                            }
                            const minMatch =
                              rawRt.match(/(\d+)\s*min/i) || rawRt.match(/^(\d+)$/);
                            if (minMatch && Number(minMatch[1]) > 5) {
                              return Number(minMatch[1]) * 60;
                            }
                            const savedDur =
                              (findWatchProgressEntry(watchProgressMap, activeVodItem) ||
                               findWatchProgressEntry(watchProgressMapRef.current, activeVodItem))?.duration;
                            if (savedDur && savedDur > 60) return savedDur;
                            return activeVodItem.type === 'series' ? 2700 : 7200;
                          })()}
                          audioTrackLabels={
                            matchedOfflineVodItem
                              ? [matchedOfflineVodItem.audioLabel || 'Audio Offline']
                              : resolvedDirectStream?.audioNames
                          }
                          initialAudioTrackIndex={
                            matchedOfflineVodItem ? 0 : effectiveAudioTrackIdx
                          }
                          isForeign={isCurrentVodForeign}
                          preferredAudioLang={effectiveVodAudioPref}
                          preferredQuality={tvSettings.defaultVideoQuality}
                          initialSubFontSize={tvSettings.defaultSubFontSize}
                          preferredSubLang={tvSettings.defaultSubLang}
                          startAtSeconds={resumeStartSeconds}
                          poster={effectivePlayerPoster}
                          backdropUrl={
                            detailedMeta?.background ||
                            activeVodItem.background ||
                            detailedMeta?.poster ||
                            activeVodItem.poster
                          }
                          title={
                            isCurrentVodForeign && uiLang !== 'ru'
                              ? detailedMeta?.nameOriginal ||
                              detailedMeta?.name ||
                              activeVodItem.nameOriginal ||
                              activeVodItem.name
                              : detailedMeta?.name || activeVodItem.name
                          }
                          subtitle={
                            (activeVodItem.type === 'series'
                              ? episodesForSeason.find(
                                (ep) => ep.episode === selectedEpisode
                              )?.name
                              : '') ||
                            detailedMeta?.releaseInfo ||
                            activeVodItem.releaseInfo
                          }
                          imdbId={
                            activeVodItem.id.startsWith('tt')
                              ? activeVodItem.id
                              : detailedMeta?.imdbId ||
                              resolvedFileListStream?.selectedTorrent?.imdbId ||
                              activeVodItem.id
                          }
                          tmdbId={
                            detailedMeta?.moviedb_id || activeVodItem.moviedb_id
                          }
                          mediaType={activeVodItem.type}
                          season={selectedSeason}
                          episode={selectedEpisode}
                          subtitleVttUrl={activeSubVttUrl}
                          subtitleLabel={
                            userDisabledSubRef.current
                              ? ''
                              : activeSubLabel ||
                                matchedOfflineVodItem?.savedSubLabel ||
                                ''
                          }
                          subtitleCues={
                            userDisabledSubRef.current
                              ? []
                              : activeSubCues.length > 0
                                ? activeSubCues
                                : matchedOfflineVodItem?.savedSubCues || []
                          }
                          isOsdVisible={isVodOsdVisible}
                          activeServerId="kinogram_hls"
                          serverOptions={matchedOfflineVodItem ? [] : currentServerOptions}
                          sourceQualityBadge={
                            matchedOfflineVodItem?.qualityLabel ||
                            (resolvedDirectStream?.vkQualities?.[0]?.height &&
                            resolvedDirectStream.vkQualities[0].height >= 2160
                              ? '4K UHD'
                              : /2160|4k/i.test(String(resolvedDirectStream?.sourcePath || ''))
                                ? '4K UHD'
                                : /1080|rutube|iedem/i.test(String(resolvedDirectStream?.sourcePath || ''))
                                  ? '1080p Full HD'
                                  : undefined)
                          }
                          externalQualityOptions={matchedOfflineVodItem ? [] : flQualityOptions}
                          onResolutionChange={setLiveVodResolution}
                          onWakeOsd={wakeVodOsd}
                          onHideOsd={hideVodOsd}
                          onClosePlayer={handleCloseVodPlayerBack}
                          prevEpisodeLabel={prevEpisodeInfo?.label}
                          nextEpisodeLabel={
                            activeVodItem.isAdultKlubnichka
                              ? (nextKlubCard ? tr(`Următorul: ${nextKlubCard.title.slice(0, 24)}...`, `Next: ${nextKlubCard.title.slice(0, 24)}...`, `Следующее: ${nextKlubCard.title.slice(0, 24)}...`) : undefined)
                              : nextEpisodeInfo?.label
                          }
                          onPrevEpisode={
                            prevEpisodeInfo
                              ? () => {
                                userSelectedFlTorrentIdRef.current = null;
                                if (prevEpisodeInfo.season !== selectedSeason) {
                                  setSelectedSeason(prevEpisodeInfo.season);
                                }
                                setSelectedEpisode(prevEpisodeInfo.episode);
                                setResumeStartSeconds(0);
                              }
                              : undefined
                          }
                          onNextEpisode={
                            activeVodItem.isAdultKlubnichka
                              ? (nextKlubCard
                                ? () => {
                                  const mapped = mapKlubCardToCinemetaItem(nextKlubCard);
                                  persistedKlubCache.lastClickedCardId = nextKlubCard.id;
                                  setIsKlubSuggestionsOpen(false);
                                  handleOpenVod(mapped, true);
                                }
                                : undefined)
                              : (nextEpisodeInfo
                                ? () => {
                                  userSelectedFlTorrentIdRef.current = null;
                                  if (nextEpisodeInfo.season !== selectedSeason) {
                                    setSelectedSeason(nextEpisodeInfo.season);
                                  }
                                  setSelectedEpisode(nextEpisodeInfo.episode);
                                  setResumeStartSeconds(0);
                                }
                                : undefined)
                          }
                          onOpenEpisodesDrawer={
                            activeVodItem.type === 'series'
                              ? () => {
                                setIsInfoSheetOpen(false);
                                setIsEpisodesDrawerOpen((prev) => {
                                  const nextOpen = !prev;
                                  if (nextOpen) {
                                    window.setTimeout(() => {
                                      const targetBtn =
                                        playerBoxRef.current?.querySelector<HTMLElement>(
                                          '[data-episodes-drawer="true"] [data-drawer-initial-focus="true"]'
                                        ) ||
                                        playerBoxRef.current?.querySelector<HTMLElement>(
                                          '[data-episodes-drawer="true"] button'
                                        );
                                      targetBtn?.focus();
                                    }, 45);
                                  }
                                  return nextOpen;
                                });
                              }
                              : undefined
                          }
                          onOpenInfoSheet={() => {
                            setIsEpisodesDrawerOpen(false);
                            setIsInfoSheetOpen((prev) => {
                              const nextOpen = !prev;
                              if (nextOpen) {
                                window.setTimeout(() => {
                                  const targetBtn =
                                    playerBoxRef.current?.querySelector<HTMLElement>(
                                      '[data-vod-sheet-open="true"] [data-sheet-close-btn="true"]'
                                    ) ||
                                    playerBoxRef.current?.querySelector<HTMLElement>(
                                      '[data-vod-sheet-open="true"] button'
                                    );
                                  targetBtn?.focus();
                                }, 45);
                              }
                              return nextOpen;
                            });
                          }}
                          onSelectServer={(srvId) => {
                            const curPos = Math.floor(lastPlaybackTimeRef.current?.cur || 0);
                            if (curPos > 3) setResumeStartSeconds(curPos);
                            userManuallySelectedServerRef.current = true;
                            const safeSrv: VodServerId =
                              srvId === 'filelist_torrent' ? 'filelist_torrent' : 'kinogram_hls';
                            if (safeSrv !== 'filelist_torrent') {
                              userSelectedFlTorrentIdRef.current = null;
                            }
                            setActiveServer(safeSrv);
                          }}
                          onSelectAudioTrackIndex={(idx) =>
                            setSelectedAudioTrackIdx(idx)
                          }
                          onRequestOriginalAudio={() =>
                            handleRequestOriginalAudio(false)
                          }
                          onApplyAutoSubtitle={({ vttBlobUrl, label, cues }) => {
                            userDisabledSubRef.current = false;
                            setActiveSubVttUrl(vttBlobUrl);
                            setActiveSubLabel(label);
                            setActiveSubCues(cues);
                          }}
                          onOpenSubtitleFinder={() => setIsSubFinderOpen(true)}
                          onClearSubtitle={() => {
                            userDisabledSubRef.current = true;
                            setActiveSubVttUrl(null);
                            setActiveSubLabel('');
                            setActiveSubCues([]);
                          }}
                          onTimeUpdate={(cur, dur) => {
                            lastPlaybackTimeRef.current = { cur, dur };
                            const prevEntry = findWatchProgressEntry(
                              watchProgressMapRef.current,
                              activeVodItem
                            );
                            const prevCur = prevEntry?.currentTime || 0;
                            if (
                              cur > 1 &&
                              (!prevEntry?.isPlayingNow ||
                                Math.abs(cur - prevCur) >= 4)
                            ) {
                              updateWatchProgress(
                                activeVodItem,
                                selectedSeason,
                                selectedEpisode,
                                cur,
                                dur
                              );
                            }

                            // Invisible Pre-buffering of next episode when < 120s remaining
                            if (
                              activeVodItem.type === 'series' &&
                              nextEpisodeInfo &&
                              dur > 120 &&
                              (dur - cur) <= 120
                            ) {
                              const nextKey = `${activeVodItem.id}_s${nextEpisodeInfo.season}_e${nextEpisodeInfo.episode}`;
                              if (hasPreloadedNextEpRef.current !== nextKey) {
                                hasPreloadedNextEpRef.current = nextKey;
                                const nextFlParams = new URLSearchParams({
                                  name: activeVodItem.name,
                                  type: 'series',
                                  s: String(nextEpisodeInfo.season),
                                  e: String(nextEpisodeInfo.episode),
                                  ru: isCurrentVodForeign ? '0' : '1',
                                });
                                fetch(buildFileListApiUrl(`/api/filelist/resolve?${nextFlParams.toString()}`)).catch(() => { });
                                const foundKpId = activeVodItem.kpId || (detailedMeta as any)?.kinopoiskId;
                                const resolvedImdb = activeVodItem.imdbId || detailedMeta?.imdbId;
                                resolveDirectVodStreamClient({
                                  kp: foundKpId,
                                  imdb: resolvedImdb,
                                  title: detailedMeta?.nameOriginal || activeVodItem.name,
                                  type: 'series',
                                  season: nextEpisodeInfo.season,
                                  episode: nextEpisodeInfo.episode,
                                }).catch(() => { });
                              }
                            }
                          }}
                        />
                      ) : (
                        <FilmioStartupLoader />
                      )
                    ) : (
                      <FilmioStartupLoader />
                    )}

                    {/* FLOATING BOTTOM CONTROL BAR FOR IFRAME FALLBACK STREAMS (Time Seek + Next Episode + Source) */}
                    {!(
                      activeServer === 'filelist_torrent' &&
                      resolvedFileListStream?.ok &&
                      resolvedFileListStream.streamUrl
                    ) &&
                      !(
                        (activeServer === 'kinogram_hls' ||
                          activeServer === 'filelist_torrent') &&
                        resolvedDirectStream?.ok &&
                        (resolvedDirectStream.dashUrl ||
                          resolvedDirectStream.hlsUrl ||
                          resolvedDirectStream.proxyHlsUrl)
                      ) &&
                      !isFileListStreamLoading &&
                      !isDirectStreamLoading && (
                        <div
                          data-vod-bottom-dock="true"
                          className={`absolute inset-x-2 sm:inset-x-8 bottom-2 sm:bottom-6 z-30 overflow-visible rounded-2xl sm:rounded-[28px] tahoe-emerald-osd px-3 sm:px-6 py-2.5 sm:py-4 flex flex-col gap-2 sm:gap-3 transition-all duration-300 ${isVodOsdVisible
                            ? 'opacity-100 translate-y-0 pointer-events-auto'
                            : 'opacity-0 translate-y-2 pointer-events-none'
                            }`}
                        >
                          <div
                            data-vod-bottom-row="true"
                            className="w-full flex flex-wrap items-center justify-between gap-1.5 sm:gap-3"
                          >
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
                              {/* Clean Apple TV+ Large Pop-Out Poster & Title + Episode Name inside Bottom Dock */}
                              {(detailedMeta?.poster ||
                                activeVodItem.poster ||
                                detailedMeta?.background ||
                                activeVodItem.background) && (
                                  <div className="hidden sm:flex items-center gap-4 pr-6 mr-2 mb-2 shrink-0 max-w-[540px] overflow-visible">
                                    <div className="relative w-20 h-28 sm:w-24 sm:h-36 -mt-12 sm:-mt-16 mr-4 sm:mr-5 mb-1 rounded-2xl overflow-hidden border border-white/25 shadow-[0_22px_54px_rgba(0,0,0,0.9)] shrink-0 bg-zinc-900">
                                      <img
                                        src={
                                          detailedMeta?.poster ||
                                          activeVodItem.poster ||
                                          detailedMeta?.background ||
                                          activeVodItem.background
                                        }
                                        alt={activeVodItem.name}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className="min-w-0 flex flex-col justify-center gap-1 py-1">
                                      <div className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white truncate leading-tight tracking-tight drop-shadow mb-1">
                                        {uiLang !== 'ru'
                                          ? detailedMeta?.nameOriginal ||
                                          detailedMeta?.name ||
                                          activeVodItem.nameOriginal ||
                                          activeVodItem.name
                                          : detailedMeta?.name || activeVodItem.name}
                                      </div>
                                      <div className="flex items-center gap-2 min-w-0 text-sm sm:text-base font-semibold text-white/90">
                                        {activeVodItem.type === 'series' && (
                                          <>
                                            <span className="text-white font-bold shrink-0 mr-2">
                                              S{selectedSeason} · E{selectedEpisode}
                                            </span>
                                            <span className="text-white/40 mr-2">•</span>
                                          </>
                                        )}
                                        <span className="truncate text-white/85">
                                          {(activeVodItem.type === 'series'
                                            ? episodesForSeason.find(
                                              (ep) =>
                                                ep.episode === selectedEpisode
                                            )?.name
                                            : '') ||
                                            detailedMeta?.releaseInfo ||
                                            activeVodItem.releaseInfo ||
                                            'Cinema 4K'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                              <button
                                type="button"
                                data-vod-seek-back-15="true"
                                onFocus={wakeVodOsd}
                                onClick={() => {
                                  wakeVodOsd();
                                  setResumeStartSeconds((s) =>
                                    Math.max(0, s - 15)
                                  );
                                }}
                                className="h-9 max-sm:h-8 px-3.5 max-sm:px-2.5 rounded-full tahoe-emerald-card hover:bg-white/20 text-white/95 text-xs max-sm:text-[11px] font-medium inline-flex items-center gap-1.5 max-sm:gap-1 transition-all focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5 max-sm:w-3 max-sm:h-3 shrink-0" />
                                <span>15s</span>
                              </button>

                              <button
                                type="button"
                                data-vod-seek-fwd-15="true"
                                onFocus={wakeVodOsd}
                                onClick={() => {
                                  wakeVodOsd();
                                  setResumeStartSeconds((s) => s + 15);
                                }}
                                className="h-9 max-sm:h-8 px-3.5 max-sm:px-2.5 rounded-full tahoe-emerald-card hover:bg-white/20 text-white/95 text-xs max-sm:text-[11px] font-medium inline-flex items-center gap-1.5 max-sm:gap-1 transition-all focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
                              >
                                <RotateCw className="w-3.5 h-3.5 max-sm:w-3 max-sm:h-3 shrink-0" />
                                <span>+15s</span>
                              </button>

                              <button
                                type="button"
                                data-vod-seek-fwd-60="true"
                                onFocus={wakeVodOsd}
                                onClick={() => {
                                  wakeVodOsd();
                                  setResumeStartSeconds((s) => s + 60);
                                }}
                                className="h-9 max-sm:h-8 px-3.5 max-sm:px-2.5 rounded-full tahoe-emerald-card hover:bg-white/20 text-white/95 text-xs max-sm:text-[11px] font-medium inline-flex items-center gap-1.5 max-sm:gap-1 transition-all focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
                              >
                                <RotateCw className="w-3.5 h-3.5 max-sm:w-3 max-sm:h-3 shrink-0" />
                                <span>+1 min</span>
                              </button>

                              {activeVodItem.type === 'series' &&
                                prevEpisodeInfo && (
                                  <button
                                    type="button"
                                    data-vod-prev-ep-btn="true"
                                    onFocus={wakeVodOsd}
                                    onClick={() => {
                                      wakeVodOsd();
                                      userSelectedFlTorrentIdRef.current = null;
                                      if (prevEpisodeInfo.season !== selectedSeason) {
                                        setSelectedSeason(prevEpisodeInfo.season);
                                      }
                                      setSelectedEpisode(prevEpisodeInfo.episode);
                                      setResumeStartSeconds(0);
                                    }}
                                    className="h-9 max-sm:h-8 px-3.5 max-sm:px-2.5 rounded-full tahoe-emerald-card hover:bg-white/20 text-white/95 text-xs max-sm:text-[11px] font-medium inline-flex items-center gap-1.5 max-sm:gap-1 transition-all focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
                                  >
                                    <span>{prevEpisodeInfo.label}</span>
                                  </button>
                                )}

                              {activeVodItem.type === 'series' && (
                                <>
                                  {nextEpisodeInfo && (
                                    <button
                                      type="button"
                                      data-vod-next-ep-btn="true"
                                      onFocus={wakeVodOsd}
                                      onClick={() => {
                                        wakeVodOsd();
                                        userSelectedFlTorrentIdRef.current = null;
                                        if (nextEpisodeInfo.season !== selectedSeason) {
                                          setSelectedSeason(nextEpisodeInfo.season);
                                        }
                                        setSelectedEpisode(nextEpisodeInfo.episode);
                                        setResumeStartSeconds(0);
                                      }}
                                      className="h-9 max-sm:h-8 px-3.5 max-sm:px-2.5 rounded-full apple-vod-liquid-pill text-white/95 text-xs max-sm:text-[11px] font-medium inline-flex items-center gap-1.5 max-sm:gap-1 transition-all focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
                                    >
                                      <span>{nextEpisodeInfo.label}</span>
                                    </button>
                                  )}
                                </>
                              )}

                            </div>

                            <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 ml-auto">
                              <button
                                type="button"
                                onFocus={wakeVodOsd}
                                onClick={() => {
                                  wakeVodOsd();
                                  setIsEpisodesDrawerOpen(false);
                                  setIsInfoSheetOpen((v) => !v);
                                }}
                                title="Sursă & Calitate Video (Butonul Roșu)"
                                aria-label="Sursă & Calitate Video (Butonul Roșu)"
                                className="relative h-9 w-9 max-sm:h-8 max-sm:w-8 rounded-full apple-vod-liquid-pill text-white/95 inline-flex items-center justify-center transition-all hover:scale-105 active:scale-95 focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
                              >
                                <SfVideoCameraIcon className="w-[18px] h-[18px] max-sm:w-4 max-sm:h-4 shrink-0" />
                                <span aria-hidden="true" className="pointer-events-none absolute bottom-[3.5px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#FF453A]" />
                              </button>
                              <button
                                type="button"
                                onFocus={wakeVodOsd}
                                onClick={() => {
                                  wakeVodOsd();
                                  setIsSubFinderOpen(true);
                                }}
                                title="Subtitrări (Butonul Verde)"
                                aria-label="Subtitrări"
                                className="relative h-9 w-9 max-sm:h-8 max-sm:w-8 rounded-full apple-vod-liquid-pill text-white/95 inline-flex items-center justify-center transition-all hover:scale-105 active:scale-95 focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
                              >
                                <SfCaptionsBubbleIcon className="w-[18px] h-[18px] max-sm:w-4 max-sm:h-4 shrink-0" />
                                <span aria-hidden="true" className="pointer-events-none absolute bottom-[3.5px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#30D158]" />
                              </button>
                              <button
                                type="button"
                                onClick={requestTvFullscreen}
                                title="Ecran Complet / Format Video (Butonul Galben)"
                                aria-label="Ecran Complet / Format Video"
                                className="sm:hidden relative h-8 w-8 rounded-full apple-vod-liquid-pill text-white/95 inline-flex items-center justify-center cursor-pointer"
                              >
                                <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                                <span aria-hidden="true" className="pointer-events-none absolute bottom-[3px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#FFD60A]" />
                              </button>
                              <button
                                type="button"
                                onFocus={wakeVodOsd}
                                onClick={() => {
                                  wakeVodOsd();
                                  setIsEpisodesDrawerOpen(false);
                                  setIsInfoSheetOpen((v) => !v);
                                }}
                                title="Pistă Audio & Sursă (Butonul Albastru)"
                                aria-label="Pistă Audio & Sursă"
                                className="relative h-9 w-9 max-sm:h-8 max-sm:w-8 rounded-full apple-vod-liquid-pill text-white/95 inline-flex items-center justify-center transition-all hover:scale-105 active:scale-95 focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
                              >
                                <SfSpeakerWaveIcon className="w-[18px] h-[18px] max-sm:w-4 max-sm:h-4 shrink-0" />
                                <span aria-hidden="true" className="pointer-events-none absolute bottom-[3.5px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#0A84FF]" />
                              </button>
                              {!(
                                typeof document !== 'undefined' &&
                                document.documentElement.classList.contains('hardware-tv-gpu')
                              ) && (
                                <button
                                  type="button"
                                  onFocus={wakeVodOsd}
                                  onClick={() => {
                                    wakeVodOsd();
                                    const vid = playerBoxRef.current?.querySelector('video') as
                                      | (HTMLVideoElement & {
                                        webkitShowPlaybackTargetPicker?: () => void;
                                        remote?: { prompt?: () => Promise<void> };
                                      })
                                      | null;
                                    if (vid && typeof vid.webkitShowPlaybackTargetPicker === 'function') {
                                      try {
                                        vid.webkitShowPlaybackTargetPicker();
                                        return;
                                      } catch {
                                        // ignore
                                      }
                                    }
                                    if (vid?.remote && typeof vid.remote.prompt === 'function') {
                                      vid.remote.prompt().catch(() => { });
                                    }
                                  }}
                                  title="AirPlay / Apple TV"
                                  aria-label="AirPlay / Apple TV"
                                  className="h-9 w-9 max-sm:h-8 max-sm:w-8 rounded-full apple-vod-liquid-pill text-white/95 inline-flex items-center justify-center shrink-0 transition-all hover:scale-105 active:scale-95 focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
                                >
                                  <SfAirPlayIcon className="w-[18px] h-[18px] max-sm:w-4 max-sm:h-4 shrink-0" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                    {/* APPLE macOS TAHOE FLOATING INFORMATION SHEET OVERLAY IN FULLSCREEN PLAYER (YELLOW BUTTON: DESCRIERE FILM CU POZĂ & ACTORI) */}
                    {isInfoSheetOpen && (
                      <div
                        data-vod-sheet-open="true"
                        style={
                          isMobilePhone && !(isMobileCustomFullscreen && isPortraitViewport)
                            ? {
                              bottom: 'max(0.75rem, var(--safe-bottom, env(safe-area-inset-bottom, 0px)))',
                              left: 'max(0.75rem, var(--safe-left, env(safe-area-inset-left, 0px)))',
                              right: 'max(0.75rem, var(--safe-right, env(safe-area-inset-right, 0px)))',
                              maxHeight:
                                'calc(100% - var(--safe-top, env(safe-area-inset-top, 0px)) - var(--safe-bottom, env(safe-area-inset-bottom, 0px)) - 4.25rem)',
                            }
                            : undefined
                        }
                        className={`absolute bottom-4 inset-x-4 sm:inset-x-8 z-30 max-h-[calc(100%-5rem)] overflow-y-auto overflow-x-hidden ${isMobilePhone && !isPortraitViewport ? 'p-4 sm:p-5 rounded-2xl' : 'p-5 sm:p-8 rounded-[32px]'} tahoe-glass shadow-[0_24px_64px_rgba(0,0,0,0.85)] transition-all duration-300`}
                      >
                        <div className={`max-w-6xl mx-auto flex flex-col sm:flex-row items-start ${isMobilePhone && !isPortraitViewport ? 'gap-4' : 'gap-6 sm:gap-8'}`}>
                          {/* Left Poster Photo — Clean Apple TV+ Proportions */}
                          <div className={`relative ${isMobilePhone && !isPortraitViewport ? 'w-24 h-36 sm:w-28 sm:h-42 rounded-2xl' : 'w-32 h-48 sm:w-44 sm:h-64 rounded-[24px]'} overflow-hidden bg-zinc-900/90 border border-white/15 shrink-0 shadow-[0_20px_50px_rgba(0,0,0,0.85)] mx-auto sm:mx-0`}>
                            <img
                              src={resolveSafeVodPosterUrl({
                                ...activeVodItem,
                                ...(detailedMeta || {}),
                                poster:
                                  (detailedMeta?.poster && !detailedMeta.poster.includes('pl.img.gg')
                                    ? detailedMeta.poster
                                    : activeVodItem.poster && !activeVodItem.poster.includes('pl.img.gg')
                                      ? activeVodItem.poster
                                      : detailedMeta?.poster || activeVodItem.poster) ||
                                  detailedMeta?.poster,
                              })}
                              alt={detailedMeta?.name || activeVodItem.name}
                              onError={(e) =>
                                handleVodPosterImgError(e, {
                                  ...activeVodItem,
                                  ...(detailedMeta || {}),
                                })
                              }
                              className="relative z-10 w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-gradient-to-b from-[#172554]/50 to-[#0f172a]">
                              <Clapperboard className="w-8 h-8 mb-2 text-[#60a5fa]/60" />
                              <span className="text-xs font-bold text-zinc-200 line-clamp-3">
                                {detailedMeta?.name || activeVodItem.name}
                              </span>
                            </div>
                          </div>

                          {/* Right Metadata Details — Clean Apple TV+ / macOS Tahoe Hierarchy */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between space-y-4 w-full">
                            {/* Row 1: Title + Year/Country + Series Episode Pill + Close Button */}
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
                                    {detailedMeta?.name || activeVodItem.name}
                                  </h2>
                                  {(detailedMeta?.releaseInfo ||
                                    activeVodItem.releaseInfo ||
                                    detailedMeta?.country) && (
                                      <span className="text-xs sm:text-sm text-zinc-300 font-medium">
                                        {[
                                          detailedMeta?.releaseInfo ||
                                          activeVodItem.releaseInfo,
                                          detailedMeta?.country,
                                        ]
                                          .filter(Boolean)
                                          .join(', ')}
                                      </span>
                                    )}
                                  {activeVodItem.type === 'series' && (
                                    <span className="px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-semibold text-white">
                                      S{selectedSeason}:E{selectedEpisode}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                data-sheet-close-btn="true"
                                onClick={() => setIsInfoSheetOpen(false)}
                                className="h-9 px-4 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/15 focus:outline-none focus:ring-2 focus:ring-white focus:bg-white focus:text-[#141414] text-zinc-100 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition"
                              >
                                <span>{tr('Închide', 'Close', 'Закрыть')}</span>
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Row 2: Frosted Glass Ratings + Runtime & Genres */}
                            <div className="flex flex-wrap items-center gap-2">
                              {(detailedMeta?.imdbRating ||
                                activeVodItem.imdbRating) && (
                                  <span className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-white font-semibold inline-flex items-center gap-1.5">
                                    <span>
                                      {detailedMeta?.imdbRating ||
                                        activeVodItem.imdbRating}
                                    </span>
                                    <span className="text-[10px] text-amber-400 font-bold tracking-wider uppercase">
                                      IMDb
                                    </span>
                                  </span>
                                )}
                              {detailedMeta?.ratingKinopoisk && (
                                <span className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-white font-semibold inline-flex items-center gap-1.5">
                                  <span>{detailedMeta.ratingKinopoisk}</span>
                                  <span className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase">
                                    KP
                                  </span>
                                </span>
                              )}
                              {detailedMeta?.ageRating && (
                                <span className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-zinc-200 font-semibold">
                                  {detailedMeta.ageRating}
                                </span>
                              )}
                              {(detailedMeta?.runtime ||
                                (
                                  detailedMeta?.genres ||
                                  activeVodItem.genres ||
                                  []
                                ).length > 0) && (
                                  <span className="text-xs sm:text-sm text-zinc-300 font-medium pl-1">
                                    {[
                                      detailedMeta?.runtime,
                                      (
                                        detailedMeta?.genres ||
                                        activeVodItem.genres ||
                                        []
                                      )
                                        .slice(0, 4)
                                        .join(' | '),
                                    ]
                                      .filter(Boolean)
                                      .join(' • ')}
                                  </span>
                                )}
                            </div>

                            {/* Row 3: Airy Apple TV+ Synopsis (No cluttered box or neon headers) */}
                            <div className="space-y-1.5">
                              <p className="text-sm sm:text-[15px] text-zinc-100/95 leading-relaxed max-w-4xl font-normal line-clamp-4">
                                {detailedMeta?.description ||
                                  activeVodItem.description ||
                                  tr(
                                    'Descrierea completă se încarcă...',
                                    'Loading full description...',
                                    'Загрузка полного описания...'
                                  )}
                              </p>
                            </div>

                            {/* Row 4: Single Clean Horizontal Row of Director & Cast Glass Pills */}
                            {castMembers.length > 0 && (
                              <div className="flex items-center gap-3 overflow-x-auto pt-1 pb-1 no-scrollbar">
                                {castMembers.slice(0, 8).map((actor) => {
                                  const displayName = actor.nameEn || actor.name;
                                  const hasValidPhoto =
                                    typeof actor.photoUrl === 'string' &&
                                    actor.photoUrl.length > 0 &&
                                    !actor.photoUrl.includes('no-poster') &&
                                    !actor.photoUrl.includes('pl.img.gg');
                                  const initials = displayName
                                    .split(/\s+/)
                                    .filter(Boolean)
                                    .slice(0, 2)
                                    .map((part) => part[0])
                                    .join('')
                                    .toUpperCase();
                                  return (
                                    <div
                                      key={`${actor.staffId}_${actor.name}`}
                                      className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/15 shrink-0"
                                    >
                                      {hasValidPhoto ? (
                                        <img
                                          src={actor.photoUrl}
                                          alt={displayName}
                                          loading="lazy"
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                          }}
                                          className="w-9 h-11 rounded-xl object-cover bg-zinc-800 shrink-0"
                                        />
                                      ) : (
                                        <div className="w-9 h-11 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0">
                                          {initials || '•'}
                                        </div>
                                      )}
                                      <div className="min-w-0 max-w-[140px]">
                                        <div className="text-xs font-semibold text-white truncate">
                                          {displayName}
                                        </div>
                                        {actor.role && (
                                          <div className="text-[11px] text-zinc-400 truncate">
                                            {actor.role}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Floating Seasons & Episodes Drawer for Series */}
                    {activeVodItem.type === 'series' &&
                      isEpisodesDrawerOpen &&
                      availableSeasons.length > 0 && (
                        <div
                          data-episodes-drawer="true"
                          style={
                            isMobilePhone && !(isMobileCustomFullscreen && isPortraitViewport)
                              ? {
                                top: 'calc(var(--safe-top, env(safe-area-inset-top, 0px)) + 3.5rem)',
                                left: 'max(1rem, var(--safe-left, env(safe-area-inset-left, 0px)))',
                                right: 'max(1rem, var(--safe-right, env(safe-area-inset-right, 0px)))',
                                maxHeight:
                                  'calc(100% - var(--safe-top, env(safe-area-inset-top, 0px)) - var(--safe-bottom, env(safe-area-inset-bottom, 0px)) - 5rem)',
                              }
                              : undefined
                          }
                          className="absolute top-14 sm:top-16 inset-x-4 sm:inset-x-8 z-40 max-h-[calc(100%-5rem)] overflow-y-auto overflow-x-hidden p-5 rounded-[32px] tahoe-glass shadow-[0_24px_64px_rgba(0,0,0,0.85)] space-y-4"
                        >
                          {(() => {
                            const drawerSavedProg = findWatchProgressEntry(
                              watchProgressMap,
                              activeVodItem
                            );
                            const drawerEpMap = drawerSavedProg?.episodeProgressMap || {};
                            const drawerWatchedInCur = episodesForSeason.filter((ep) => {
                              const p = drawerEpMap[`S${selectedSeason}E${ep.episode}`];
                              return isEpisodeProgressWatched(p);
                            }).length;
                            const drawerIsCurWatched =
                              episodesForSeason.length > 0 &&
                              drawerWatchedInCur === episodesForSeason.length;
                            return (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                              <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 mr-2">
                                Sezoane:
                              </span>
                              {displayedSeasons.map((sNum) => {
                                const sEps = seasonsMap.get(sNum) || [];
                                const isSeasonDone =
                                  sEps.length > 0 &&
                                  sEps.every((ep) => {
                                    const p = drawerEpMap[`S${sNum}E${ep.episode}`];
                                    return isEpisodeProgressWatched(p);
                                  });
                                return (
                                <button
                                  key={sNum}
                                  type="button"
                                  onClick={() => {
                                    userSelectedFlTorrentIdRef.current = null;
                                    userManuallySelectedServerRef.current = false;
                                    setSelectedSeason(sNum);
                                    setSelectedEpisode(1);
                                    setResumeStartSeconds(0);
                                    setPendingResumePromptSec(null);
                                  }}
                                  className={`h-9 px-4 rounded-full text-xs sm:text-sm font-extrabold shrink-0 inline-flex items-center gap-1.5 transition-all focus:outline-none focus:ring-4 focus:ring-white focus:bg-white focus:text-[#141414] cursor-pointer ${selectedSeason === sNum
                                    ? 'bg-white text-[#141414] shadow-md'
                                    : 'bg-white/10 hover:bg-white/20 text-zinc-200 border border-white/15'
                                    }`}
                                >
                                  {isSeasonDone && (
                                    <CheckCircle2
                                      className={`w-3.5 h-3.5 shrink-0 ${
                                        selectedSeason === sNum
                                          ? 'text-[#2563eb]'
                                          : 'text-emerald-400'
                                      }`}
                                    />
                                  )}
                                  <span>
                                    {tr(
                                      `Sezonul ${sNum}${seasonYearsMap.get(sNum) ? ` (${seasonYearsMap.get(sNum)})` : ""}`,
                                      `Season ${sNum}${seasonYearsMap.get(sNum) ? ` (${seasonYearsMap.get(sNum)})` : ""}`,
                                      `Сезон ${sNum}${seasonYearsMap.get(sNum) ? ` (${seasonYearsMap.get(sNum)})` : ""}`
                                    )}
                                  </span>
                                </button>
                                );
                              })}
                              {episodesForSeason.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleSeasonWatched(activeVodItem, selectedSeason)
                                  }
                                  title={
                                    drawerIsCurWatched
                                      ? tr(
                                          'Anulează sezonul văzut',
                                          'Unmark season as watched',
                                          'Снять отметку с сезона'
                                        )
                                      : tr(
                                          'Marchează tot sezonul ca vizionat',
                                          'Mark entire season as watched',
                                          'Отметить весь сезон просмотренным'
                                        )
                                  }
                                  className={`h-9 px-3.5 rounded-full text-xs font-extrabold shrink-0 inline-flex items-center gap-1.5 border transition-all focus:outline-none focus:ring-4 focus:ring-white focus:bg-white focus:text-[#141414] cursor-pointer ${
                                    drawerIsCurWatched
                                      ? 'bg-[#1e3a8a]/90 hover:bg-[#1e3a8a] border-blue-400/60 text-white shadow-sm'
                                      : 'bg-white/[0.08] hover:bg-white/20 border-white/15 hover:border-white/30 text-zinc-200 hover:text-white'
                                  }`}
                                >
                                  <CheckCircle2
                                    className={`w-3.5 h-3.5 shrink-0 ${
                                      drawerIsCurWatched ? 'text-sky-300' : 'text-zinc-400'
                                    }`}
                                  />
                                  <span>
                                    {drawerIsCurWatched
                                      ? tr('Sezon văzut', 'Season watched', 'Сезон просмотрен')
                                      : drawerWatchedInCur > 0
                                        ? tr(
                                            `Marchează sezonul văzut (${drawerWatchedInCur}/${episodesForSeason.length})`,
                                            `Mark season watched (${drawerWatchedInCur}/${episodesForSeason.length})`,
                                            `Отметить сезон (${drawerWatchedInCur}/${episodesForSeason.length})`
                                          )
                                        : tr(
                                            'Marchează sezonul văzut',
                                            'Mark season watched',
                                            'Отметить сезон'
                                          )}
                                  </span>
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {episodesForSeason.length > 1 && (
                                <div className="flex items-center gap-1 bg-white/[0.06] p-1 rounded-full border border-white/15">
                                  <button
                                    type="button"
                                    onClick={() => handleSetSeriesEpisodesSortDesc(false)}
                                    className={`h-7 px-3 rounded-full text-xs font-extrabold transition-all cursor-pointer focus:outline-none focus:ring-4 focus:ring-white ${!episodesSortDesc
                                      ? 'bg-white text-[#141414] shadow-sm'
                                      : 'text-zinc-300 hover:text-white focus:bg-white focus:text-[#141414]'
                                      }`}
                                  >
                                    De la primul (1 - {episodesForSeason.length})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSetSeriesEpisodesSortDesc(true)}
                                    className={`h-7 px-3 rounded-full text-xs font-extrabold transition-all cursor-pointer focus:outline-none focus:ring-4 focus:ring-white ${episodesSortDesc
                                      ? 'bg-white text-[#141414] shadow-sm'
                                      : 'text-zinc-300 hover:text-white focus:bg-white focus:text-[#141414]'
                                      }`}
                                  >
                                    De la ultimul ({episodesForSeason.length} - 1)
                                  </button>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => setIsEpisodesDrawerOpen(false)}
                                className="h-9 px-4 rounded-full bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-white focus:bg-white focus:text-[#141414] text-zinc-100 text-xs font-bold shrink-0 cursor-pointer"
                              >
                                Închide
                              </button>
                            </div>
                          </div>
                            );
                          })()}

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {displayedEpisodesForSeason.map((ep) => {
                              const isCurrent = selectedEpisode === ep.episode;
                              const epCleanName = (ep.name || '').trim();
                              const isGeneric =
                                !epCleanName ||
                                /^Episod(ul|e)?\s*\d+$/i.test(epCleanName) ||
                                /^S\d+E\d+$/i.test(epCleanName);
                              const epKey = `S${selectedSeason}E${ep.episode}`;
                              const epProg =
                                findWatchProgressEntry(watchProgressMap, activeVodItem)
                                  ?.episodeProgressMap?.[epKey];
                              const epDur =
                                epProg?.duration && epProg.duration > 60
                                  ? epProg.duration
                                  : 2700;
                              const epPct =
                                epProg && epProg.currentTime > 10
                                  ? Math.min(
                                    100,
                                    Math.max(
                                      5,
                                      Math.round(
                                        (epProg.currentTime / epDur) * 100
                                      )
                                    )
                                  )
                                  : 0;
                              const isWatched = isEpisodeProgressWatched(epProg);
                              const resolvedImdb = activeVodItem.id.startsWith(
                                'tt'
                              )
                                ? activeVodItem.id
                                : detailedMeta?.imdbId || '';
                              const isRuSeriesEp = isRussianVodItem(activeVodItem);
                              const epThumb =
                                ((ep.thumbnail || "")) ||
                                (!isRuSeriesEp && resolvedImdb
                                  ? `https://episodes.metahub.space/${resolvedImdb}/${selectedSeason}/${ep.episode}/w780.jpg`
                                  : '') ||
                                detailedMeta?.background ||
                                activeVodItem.background ||
                                detailedMeta?.poster ||
                                activeVodItem.poster ||
                                '';
                              const epSynopsis = (
                                ep.overview ||
                                ep.description ||
                                ''
                              ).trim();
                              const epDate = ep.released
                                ? String(ep.released).slice(0, 10)
                                : '';

                              return (
                                <button
                                  key={ep.id || ep.episode}
                                  type="button"
                                  data-episode-card="true"
                                  data-episode-num={ep.episode}
                                  data-season-num={selectedSeason}
                                  data-drawer-initial-focus={
                                    isCurrent ? 'true' : undefined
                                  }
                                  data-drawer-next-ep={
                                    nextEpisodeInfo &&
                                      nextEpisodeInfo.season === selectedSeason &&
                                      ep.episode === nextEpisodeInfo.episode
                                      ? 'true'
                                      : undefined
                                  }
                                  onKeyDown={(e) => handleEpisodePlayKey(e, ep, selectedSeason)}
                                  onClick={() => {
                                    userSelectedFlTorrentIdRef.current = null;
                                    setSelectedEpisode(ep.episode);
                                    setResumeStartSeconds(
                                      epProg &&
                                        epProg.currentTime > 10 &&
                                        epPct < 92
                                        ? epProg.currentTime
                                        : 0
                                    );
                                    setIsEpisodesDrawerOpen(false);
                                  }}
                                  className={`group flex items-center gap-3 p-2.5 rounded-2xl text-left transition-all border focus:outline-none focus:ring-4 focus:ring-white focus:bg-white focus:text-[#141414] cursor-pointer ${isCurrent
                                    ? 'bg-blue-500/20 text-white border-blue-400 shadow-lg'
                                    : 'bg-white/[0.07] hover:bg-white/15 text-zinc-100 border-white/15'
                                    }`}
                                >
                                  <div className="relative w-28 h-16 rounded-xl overflow-hidden bg-zinc-900 shrink-0 border border-white/10">
                                    <div className="absolute inset-0 flex items-center justify-center text-[#60a5fa]/40">
                                      <Clapperboard className="w-5 h-5" />
                                    </div>
                                    {epThumb && (
                                      <img
                                        src={epThumb}
                                        alt={`Ep ${ep.episode}`}
                                        loading="lazy"
                                        onError={(e) => {
                                          const fallback =
                                            detailedMeta?.background ||
                                            detailedMeta?.poster ||
                                            '';
                                          if (
                                            fallback &&
                                            e.currentTarget.src !== fallback &&
                                            !e.currentTarget.dataset.triedFallback
                                          ) {
                                            e.currentTarget.dataset.triedFallback = '1';
                                            e.currentTarget.src = fallback;
                                          } else {
                                            e.currentTarget.style.display = 'none';
                                          }
                                        }}
                                        className="relative z-10 w-full h-full object-cover"
                                      />
                                    )}
                                    <span className="absolute top-1 left-1 z-20 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-black text-white">
                                      E{ep.episode}
                                    </span>
                                    <span
                                      role="button"
                                      tabIndex={-1}
                                      data-ep-watched-toggle="true"
                                      title={
                                        isWatched
                                          ? tr(
                                              'Marcat văzut (apasă pentru a anula)',
                                              'Watched (click to unmark)',
                                              'Просмотрено (снять)'
                                            )
                                          : tr(
                                              'Marchează episodul văzut',
                                              'Mark episode watched',
                                              'Отметить серию просмотренной'
                                            )
                                      }
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleToggleWatchedStatus(
                                          activeVodItem,
                                          selectedSeason,
                                          ep.episode
                                        );
                                      }}
                                      className={`absolute top-1 right-1 z-20 inline-flex items-center justify-center rounded-full transition-all cursor-pointer ${
                                        isWatched
                                          ? 'w-5 h-5 bg-emerald-600/95 hover:bg-emerald-500 text-white border border-emerald-300/70 shadow'
                                          : 'p-1 bg-black/70 hover:bg-emerald-600 text-zinc-300 hover:text-white border border-white/20 opacity-0 group-hover:opacity-100 max-md:opacity-85'
                                      }`}
                                    >
                                      <Check className="w-3 h-3 stroke-[3]" aria-hidden="true" />
                                    </span>
                                    {epPct > 0 && (
                                      <div className="absolute inset-x-0 bottom-0 z-20 h-1 bg-black/60">
                                        <div
                                          className="h-full bg-blue-400"
                                          style={{ width: `${epPct}%` }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs sm:text-sm font-extrabold truncate">
                                      {isGeneric
                                        ? `Episodul ${ep.episode}`
                                        : `${ep.episode}. ${epCleanName}`}
                                    </div>
                                    {epDate && (
                                      <div className="text-[10px] text-zinc-400 group-focus:text-zinc-600 font-semibold">
                                        {epDate}
                                      </div>
                                    )}
                                    {epSynopsis && (
                                      <div className="text-[11px] text-zinc-300 group-focus:text-zinc-700 line-clamp-2 mt-0.5 leading-snug">
                                        {epSynopsis}
                                      </div>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </>
            ) : activeVodItem ? (
              /* 1B. APPLE macOS TAHOE LIQUID GLASS MOVIE / SERIES CARD */
              <div className="relative z-10 pb-24 pt-1 px-2 sm:px-4 space-y-6 sm:space-y-7">
                {/* HERO SECTION: Left Main Column (Poster + Actions) + Right Detalii & Sinopsis (3-col on xl >= 1280px, clean 2-row on iPad/Phone landscape) */}
                <div
                  data-top-hero-card="true"
                  data-vod-detail-hero="true"
                  className="flex flex-col xl:flex-row xl:items-stretch w-full"
                >
                  {/* Left Main Column: Poster + Airy Full-Height Metadata/Actions Column */}
                  <div className="inline-flex flex-col items-stretch min-w-0 w-full xl:w-fit max-w-full shrink-0 xl:mr-6 mb-4 sm:mb-5 xl:mb-0">
                    <div className="flex flex-row items-stretch sm:items-start w-full xl:w-fit max-w-full">
                      {/* Left Poster (macOS Tahoe Super-Rounded Squircle Poster with Specular Ring — compact side-by-side on mobile/tablet landscape) */}
                      <div className={`${isMobilePhone && !isPortraitViewport ? 'w-32 md:w-44 xl:w-[225px] xl:h-[337px] mr-3.5 md:mr-5' : 'w-28 sm:w-48 xl:w-[225px] sm:h-[288px] xl:h-[337px] mr-3.5 sm:mr-6 xl:mr-7'} shrink-0 mb-0`}>
                        <div className="aspect-[2/3] w-full rounded-2xl sm:rounded-[28px] overflow-hidden bg-[#1e1e1e] ring-1 ring-white/25 shadow-[0_24px_60px_rgba(0,0,0,0.75)] relative">
                          <img
                            src={resolveSafeVodPosterUrl({
                              ...activeVodItem,
                              ...(detailedMeta || {}),
                              poster: detailedMeta?.poster || activeVodItem.poster,
                            })}
                            alt={activeVodItem.name}
                            onError={(e) =>
                              handleVodPosterImgError(e, {
                                ...activeVodItem,
                                ...(detailedMeta || {}),
                              })
                            }
                            className="relative z-10 w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-[#172554]/50 to-[#0f172a]">
                            <Clapperboard className="w-10 h-10 mb-2 text-[#60a5fa]/60" />
                            <span className="text-xs sm:text-sm font-bold text-zinc-200 line-clamp-4">
                              {detailedMeta?.name || activeVodItem.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Middle Column Card (tahoe-glass card matching Detalii & Sinopsis):
                          Row 1: Title + Provider/Studio Badge on same row
                          Row 2: Year, Country right under Title
                          Row 3: Runtime • Genres
                          Row 4: TMDB / IMDb / KP / 16+ / Lansat
                          Row 5: Action Buttons (and Watch Progress Bar if started) */}
                      <div className={`inline-flex flex-col items-start justify-between flex-1 xl:flex-initial min-w-0 ${isMobilePhone && !isPortraitViewport ? 'min-h-[192px] md:min-h-[264px] h-auto xl:h-[337px] p-3.5 md:p-5 space-y-2' : 'min-h-0 h-auto sm:min-h-[288px] xl:h-[337px] p-4 sm:p-5 space-y-2.5 sm:space-y-2'} rounded-2xl sm:rounded-[28px] tahoe-glass overflow-hidden`}>
                        {/* Row 1: Title + Provider / Studio Badge on the exact same row */}
                        <div className="w-full xl:w-0 xl:min-w-full flex items-center gap-x-2.5 flex-nowrap overflow-hidden">
                          <h1
                            title={detailedMeta?.name || activeVodItem.name}
                            className="text-xl sm:text-2xl lg:text-[26px] font-bold text-white tracking-tight leading-tight truncate min-w-0"
                          >
                            {String(detailedMeta?.name || activeVodItem.name || '')
                              .replace(/[.\s-]*Сезон\s*\d+\.?$/i, '')
                              .trim()}
                          </h1>

                          {activeVodDetectedProvider ? (
                            (() => {
                              const platMeta = STREAMING_PLATFORMS.find(
                                (p) => p.id === activeVodDetectedProvider
                              );
                              return (
                                <button
                                  type="button"
                                  title={tr(
                                    `Vezi catalogul ${platMeta?.label || ''}`,
                                    `View ${platMeta?.label || ''} catalog`,
                                    `Открыть каталог ${platMeta?.label || ''}`
                                  )}
                                  onClick={() => {
                                    setSection(activeVodDetectedProvider);
                                    setActiveVodItem(null);
                                  }}
                                  className="inline-flex items-center pl-1.5 pr-3 py-0.5 rounded-full bg-black/55 hover:bg-white/20 focus:bg-white focus:text-[#141414] backdrop-blur-xl border border-white/25 shadow-[0_6px_20px_rgba(0,0,0,0.45)] text-[11px] sm:text-xs font-extrabold text-white transition-all shrink-0 cursor-pointer"
                                >
                                  <StreamingPlatformLogo
                                    platformId={activeVodDetectedProvider}
                                    size="xs"
                                  />
                                  <span className="ml-2 tracking-wide whitespace-nowrap">
                                    {platMeta?.label || activeVodDetectedProvider}
                                  </span>
                                </button>
                              );
                            })()
                          ) : activeVodDetectedStudios[0] ? (
                            <div className="shrink-0">
                              <ProducerStudioLogoBadge
                                studio={activeVodDetectedStudios[0]}
                                size="sm"
                              />
                            </div>
                          ) : null}
                        </div>

                        {/* Row 2: Year & Country right under the Title */}
                        <div className="w-full xl:w-0 xl:min-w-full text-xs sm:text-sm text-zinc-300 font-medium truncate">
                          {[
                            detailedMeta?.releaseInfo ||
                              activeVodItem.releaseInfo ||
                              '2026',
                            detailedMeta?.country ||
                              tr('SUA, Europa', 'USA, Europe', 'США, Европа'),
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </div>

                        {/* Row 3: Runtime • Genres separated by | */}
                        <div className="w-full xl:w-0 xl:min-w-full text-xs sm:text-[15px] text-zinc-200 font-normal truncate">
                          {[
                            detailedMeta?.runtime || '01:43',
                            (
                              detailedMeta?.genres ||
                              activeVodItem.genres || [
                                tr('Dramă', 'Drama', 'Драма'),
                                tr('Thriller', 'Thriller', 'Триллер'),
                              ]
                            ).join(' | '),
                          ]
                            .filter(Boolean)
                            .join(' • ')}
                        </div>

                        {/* Row 4: TMDB / IMDB / KP Ratings + Age Rating + Status */}
                        <div className="w-full xl:w-0 xl:min-w-full flex flex-wrap items-center gap-1.5 sm:gap-2">
                          {(() => {
                            const rawImdb =
                              detailedMeta?.imdbRating ||
                              activeVodItem.imdbRating ||
                              '';
                            const numImdb = parseFloat(String(rawImdb)) || 0;
                            const displayRating =
                              numImdb > 0 ? String(rawImdb) : '7.7';
                            const rawKp = detailedMeta?.ratingKinopoisk || '';
                            const numKp = parseFloat(String(rawKp)) || 0;

                            return (
                              <>
                                <span className="inline-flex items-baseline px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] text-white">
                                  <strong className="text-xs sm:text-[15px] font-bold mr-1 sm:mr-1.5">
                                    {displayRating}
                                  </strong>
                                  <span className="text-[9px] sm:text-[10px] text-zinc-300 uppercase font-semibold tracking-wider">
                                    TMDB
                                  </span>
                                </span>

                                <span className="inline-flex items-baseline px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] text-white">
                                  <strong className="text-xs sm:text-[15px] font-bold mr-1 sm:mr-1.5">
                                    {displayRating}
                                  </strong>
                                  <span className="text-[9px] sm:text-[10px] text-amber-400 uppercase font-extrabold tracking-wider">
                                    IMDb
                                  </span>
                                </span>

                                {numKp > 0 && (
                                  <span className="inline-flex items-baseline px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] text-white">
                                    <strong className="text-xs sm:text-[15px] font-bold mr-1 sm:mr-1.5">
                                      {rawKp}
                                    </strong>
                                    <span className="text-[9px] sm:text-[10px] text-zinc-300 uppercase font-semibold tracking-wider">
                                      KP
                                    </span>
                                  </span>
                                )}
                              </>
                            );
                          })()}

                          <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-white/10 backdrop-blur-xl border border-white/30 text-[11px] sm:text-xs text-white font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
                            {detailedMeta?.ageRating || '16+'}
                          </span>

                          <span className="hidden sm:inline-flex px-3.5 py-1 rounded-full bg-white/10 backdrop-blur-xl border border-white/30 text-xs text-white font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
                            {tr('Lansat', 'Released', 'Выпущенный')}
                          </span>
                        </div>

                        {/* Line 4: Action Buttons Row (Wraps cleanly on phone/tablet landscape; single row on xl desktop/TV) */}
                        <div className="flex flex-wrap xl:flex-nowrap items-center gap-1.5 sm:gap-2">
                          {/* Primary Play Pill (Compact) */}
                          {(() => {
                            const savedProg = findWatchProgressEntry(watchProgressMap, activeVodItem);
                            const epKey = `S${selectedSeason}E${selectedEpisode}`;
                            const epTime =
                              savedProg?.episodeProgressMap?.[epKey]?.currentTime;
                            const liveResumeSec =
                              activeVodItem.type === 'series'
                                ? (epTime ??
                                  (savedProg?.season === selectedSeason &&
                                    savedProg?.episode === selectedEpisode
                                    ? savedProg?.currentTime
                                    : undefined) ??
                                  pendingResumePromptSec ??
                                  (resumeStartSeconds > 10 ? resumeStartSeconds : 0))
                                : (savedProg?.currentTime ??
                                  pendingResumePromptSec ??
                                  (resumeStartSeconds > 10 ? resumeStartSeconds : 0));
                            return (
                              <button
                                ref={playVodBtnRef}
                                type="button"
                                autoFocus
                                onClick={() =>
                                  handleStartVodPlayback(
                                    liveResumeSec > 10 ? liveResumeSec : undefined
                                  )
                                }
                                style={{
                                  backgroundColor: '#1e3a8a',
                                  color: '#ffffff',
                                }}
                                className="group/vodplay h-9 sm:h-11 px-3.5 sm:px-5 rounded-full bg-[#1e3a8a] hover:bg-[#1d4ed8] focus:bg-[#1e3a8a] text-white hover:text-white focus:text-white border-2 border-white/90 focus:border-white focus:ring-4 focus:ring-white font-extrabold text-xs sm:text-sm inline-flex items-center shadow-[0_8px_25px_rgba(30,58,138,0.55)] shrink-0 whitespace-nowrap cursor-pointer"
                              >
                                <Play
                                  className="w-3.5 h-3.5 mr-1.5 sm:mr-2 fill-current text-white shrink-0"
                                  style={{ color: '#ffffff' }}
                                />
                                <span
                                  className="text-white font-extrabold"
                                  style={{ color: '#ffffff' }}
                                >
                                  {matchedOfflineVodItem
                                    ? liveResumeSec > 10
                                      ? activeVodItem.type === 'series'
                                        ? `Play Offline (S${selectedSeason}:E${selectedEpisode} • ${formatWatchSeconds(liveResumeSec)})`
                                        : `Play Offline (${formatWatchSeconds(liveResumeSec)})`
                                      : activeVodItem.type === 'series'
                                        ? `Play Offline (S${selectedSeason}:E${selectedEpisode})`
                                        : 'Play Offline'
                                    : liveResumeSec > 10
                                      ? activeVodItem.type === 'series'
                                        ? `Play (S${selectedSeason}:E${selectedEpisode} • ${formatWatchSeconds(liveResumeSec)})`
                                        : `Play (${formatWatchSeconds(liveResumeSec)})`
                                      : activeVodItem.type === 'series'
                                        ? `Play (S${selectedSeason}:E${selectedEpisode})`
                                        : 'Play'}
                                </span>
                              </button>
                            );
                          })()}

                          {/* Clapperboard Icon Pill — Official Trailer */}
                          <button
                            type="button"
                            title={tr('Trailer', 'Trailer', 'Трейлер')}
                            aria-label={tr('Trailer', 'Trailer', 'Трейлер')}
                            onClick={() => void handleOpenTrailer()}
                            className="h-9 w-9 sm:h-11 sm:w-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-white flex items-center justify-center shrink-0 transition-all cursor-pointer"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0"
                              aria-hidden="true"
                            >
                              <path d="M3.6 9.5 18.8 4.6l1.1 3.3L4.7 12.8" />
                              <path d="m7.8 8.1 2.1 2.6" />
                              <path d="m12.3 6.7 2.1 2.6" />
                              <path d="m16.7 5.3 2.1 2.6" />
                              <circle cx="3.8" cy="11.8" r="1.5" />
                              <path d="M5.2 12.8H20a1 1 0 0 1 1 1v6.2a1.2 1.2 0 0 1-1.2 1.2H5.2A1.2 1.2 0 0 1 4 20v-6.2" />
                              <path d="M4 16h17" />
                              <path d="m8.5 12.8-1.8 3.2" />
                              <path d="m13.2 12.8-1.8 3.2" />
                              <path d="m17.9 12.8-1.8 3.2" />
                            </svg>
                          </button>

                          {/* Local / Offline Download Icon Pill */}
                          {(() => {
                            const isSeriesItem = activeVodItem.type === 'series';
                            const downloadedForSeason = isSeriesItem
                              ? offlineItems.filter(
                                  (x) =>
                                    x.vodId === activeVodItem.id &&
                                    (x.season || 1) === selectedSeason
                                )
                              : [];
                            const totalSeasonEps = isSeriesItem
                              ? Math.max(episodesForSeason.length, 2)
                              : 1;
                            const isFullyDownloaded = isSeriesItem
                              ? episodesForSeason.length > 0 &&
                                episodesForSeason.every((ep) =>
                                  downloadedForSeason.some(
                                    (x) => x.episode === ep.episode
                                  )
                                )
                              : Boolean(matchedOfflineVodItem) ||
                                offlineItems.some(
                                  (x) => x.vodId === activeVodItem.id
                                );
                            const hasPartialSeriesDownloads =
                              isSeriesItem &&
                              !isFullyDownloaded &&
                              downloadedForSeason.length > 0;

                            return (
                              <button
                                type="button"
                                title={tr(
                                  'Descarcă Local (Offline)',
                                  'Download Locally (Offline)',
                                  'Скачать локально (Офлайн)'
                                )}
                                aria-label={tr(
                                  'Descarcă Local (Offline)',
                                  'Download Locally (Offline)',
                                  'Скачать локально (Офлайн)'
                                )}
                                onClick={() => {
                                  setDownloadError(null);
                                  setDownloadModalSeason(selectedSeason);
                                  if (isSeriesItem && episodesForSeason.length > 0) {
                                    const isCurrentEpSaved = downloadedForSeason.some(
                                      (x) => x.episode === selectedEpisode
                                    );
                                    const nextUndownloaded = episodesForSeason.find(
                                      (ep) =>
                                        !downloadedForSeason.some(
                                          (x) => x.episode === ep.episode
                                        )
                                    );
                                    setSelectedDownloadEpisodes([
                                      !isCurrentEpSaved
                                        ? selectedEpisode
                                        : nextUndownloaded
                                          ? nextUndownloaded.episode
                                          : selectedEpisode,
                                    ]);
                                  } else {
                                    setSelectedDownloadEpisodes([selectedEpisode]);
                                  }
                                  setIsDownloadModalOpen(true);
                                }}
                                className={`relative h-9 w-9 sm:h-11 sm:w-12 rounded-full border flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                                  isFullyDownloaded
                                    ? 'bg-[#2563eb] text-white border-blue-400 shadow-[0_6px_20px_rgba(37,99,235,0.45)]'
                                    : activeDownloadProgress &&
                                        activeDownloadTargetId?.startsWith(
                                          `vod_${activeVodItem.id}`
                                        )
                                      ? 'bg-blue-600 text-white border-blue-400 shadow-lg'
                                      : 'bg-white/10 backdrop-blur-xl border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-white'
                                }`}
                              >
                                {activeDownloadProgress &&
                                activeDownloadTargetId?.startsWith(
                                  `vod_${activeVodItem.id}`
                                ) ? (
                                  <Loader2 className="w-4 h-4 sm:w-[18px] sm:h-[18px] animate-spin shrink-0" />
                                ) : isFullyDownloaded ? (
                                  <CheckCircle2 className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0" />
                                ) : (
                                  <Download className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0" />
                                )}
                                {hasPartialSeriesDownloads && (
                                  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-[#2563eb] border border-white/30 text-[9px] font-black text-white leading-none tabular-nums shadow">
                                    {downloadedForSeason.length}/{totalSeasonEps}
                                  </span>
                                )}
                              </button>
                            );
                          })()}

                          {/* Watched Status Toggle Pill */}
                          {(() => {
                            const detailProg = findWatchProgressEntry(
                              watchProgressMap,
                              activeVodItem
                            );
                            const detailStats =
                              seriesEpStatsMap[activeVodItem.id] ||
                              (activeVodItem.imdbId
                                ? seriesEpStatsMap[activeVodItem.imdbId]
                                : undefined);
                            const isDetailWatched = isVodEntryWatched(
                              detailProg,
                              detailStats
                            );
                            const detailWatchedEps =
                              activeVodItem.type === 'series'
                                ? getSeriesWatchedEpisodesCount(detailProg)
                                : 0;
                            return (
                              <button
                                type="button"
                                data-vod-watched-btn="true"
                                title={
                                  isDetailWatched
                                    ? tr(
                                        'Marcat ca văzut (apasă pentru a anula)',
                                        'Marked as watched (click to unmark)',
                                        'Просмотрено (нажмите, чтобы снять)'
                                      )
                                    : tr(
                                        activeVodItem.type === 'series'
                                          ? 'Marchează tot serialul ca văzut'
                                          : 'Marchează filmul ca văzut',
                                        activeVodItem.type === 'series'
                                          ? 'Mark entire series as watched'
                                          : 'Mark movie as watched',
                                        activeVodItem.type === 'series'
                                          ? 'Отметить весь сериал просмотренным'
                                          : 'Отметить фильм просмотренным'
                                      )
                                }
                                aria-label={tr(
                                  isDetailWatched ? 'Văzut' : 'Marchează văzut',
                                  isDetailWatched ? 'Watched' : 'Mark watched',
                                  isDetailWatched ? 'Просмотрено' : 'Отметить'
                                )}
                                onClick={() =>
                                  handleToggleWatchedStatus(
                                    activeVodItem,
                                    undefined,
                                    undefined,
                                    { wholeSeries: activeVodItem.type === 'series' }
                                  )
                                }
                                className={`h-9 sm:h-11 px-3 sm:px-4 rounded-full border flex items-center justify-center gap-1.5 shrink-0 text-xs sm:text-sm font-bold transition-all cursor-pointer focus:outline-none focus:ring-4 focus:ring-white ${
                                  isDetailWatched
                                    ? 'bg-emerald-600/95 hover:bg-emerald-500 text-white border-emerald-300/75 shadow-[0_6px_20px_rgba(16,185,129,0.35)]'
                                    : 'bg-white/10 backdrop-blur-xl border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-white'
                                }`}
                              >
                                <CheckCircle2 className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0" />
                                <span>
                                  {isDetailWatched
                                    ? tr('Văzut', 'Watched', 'Просм.')
                                    : detailWatchedEps > 0 && activeVodItem.type === 'series'
                                      ? tr(
                                          `Văzut (${detailWatchedEps})`,
                                          `Watched (${detailWatchedEps})`,
                                          `Просм. (${detailWatchedEps})`
                                        )
                                      : tr('Marchează văzut', 'Mark watched', 'Просмотрено')}
                                </span>
                              </button>
                            );
                          })()}

                          {/* Bookmark Icon Pill */}
                          <button
                            type="button"
                            title={tr('Adaugă la Favorite', 'Add to Favorites', 'В Избранное')}
                            onClick={() => toggleSaveVodItem(activeVodItem)}
                            className={`h-9 w-9 sm:h-11 sm:w-12 rounded-full border flex items-center justify-center shrink-0 transition-all cursor-pointer ${savedVodItems.some((x) => x.id === activeVodItem.id)
                              ? 'bg-white text-[#141414] border-white shadow-md'
                              : 'bg-white/10 backdrop-blur-xl border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-white'
                              }`}
                          >
                            <SfBookmarkIcon
                              className="w-4 h-4 sm:w-[18px] sm:h-[18px]"
                              filled={savedVodItems.some((x) => x.id === activeVodItem.id)}
                            />
                          </button>

                          {/* Subtitles Icon Pill */}
                          <button
                            type="button"
                            title={tr('Subtitrări Online', 'Online Subtitles', 'Субтитры')}
                            aria-label={tr('Subtitrări Online', 'Online Subtitles', 'Субтитры')}
                            onClick={() => setIsSubFinderOpen(true)}
                            className={`h-9 w-9 sm:h-11 sm:w-12 rounded-full border flex items-center justify-center shrink-0 transition-all cursor-pointer ${isSubFinderOpen
                              ? 'bg-white text-[#141414] border-white shadow-md'
                              : 'bg-white/10 backdrop-blur-xl border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-white'
                              }`}
                          >
                            <SfCaptionsBubbleIcon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                          </button>

                          {/* Audio Track Icon Pill (hide leaked RU dub tracks on non-Russian titles) */}
                          {(() => {
                            const rawAud = resolvedDirectStream?.audioNames || [];
                            const visAud = filterDisplayAudioItems(
                              rawAud,
                              (n) => n,
                              isCurrentVodForeign
                            );
                            const canOpenAudio = isCurrentVodForeign
                              ? visAud.length >= 2 ||
                                (rawAud.length > 0 &&
                                  visAud.some((n) => !isRussianAudioDubLabel(n)) === false)
                              : visAud.length > 0;
                            if (!canOpenAudio) return null;
                            const activeAudLabel =
                              rawAud[effectiveAudioTrackIdx] &&
                              (!isCurrentVodForeign ||
                                !isRussianAudioDubLabel(rawAud[effectiveAudioTrackIdx]))
                                ? rawAud[effectiveAudioTrackIdx]
                                : visAud[0] || 'Original';
                            return (
                              <button
                                type="button"
                                data-vod-compact-trigger="audio"
                                title={`${tr('Limba Audio', 'Audio Track', 'Озвучка / Аудио')}: ${activeAudLabel} (${visAud.length})`}
                                aria-label={tr('Limba Audio', 'Audio Track', 'Озвучка / Аудио')}
                                onClick={() => toggleVodCompactPanel('audio')}
                                className={`h-9 w-9 sm:h-11 sm:w-12 rounded-full border flex items-center justify-center shrink-0 transition-all cursor-pointer ${openVodCompactPanel === 'audio'
                                  ? 'bg-white text-[#141414] border-white shadow-md'
                                  : 'bg-white/10 backdrop-blur-xl border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-white'
                                  }`}
                              >
                                <SfSpeakerWaveIcon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                              </button>
                            );
                          })()}

                          {/* Unified Video Streams & Server Icon Pill */}
                          <button
                            type="button"
                            data-vod-compact-trigger="filelist"
                            data-vod-compact-trigger-server="true"
                            title={tr(
                              'Calitate & Sursă Video (FileList + Torrentio + Servere)',
                              'Video Quality & Source (FileList + Torrentio + Servers)',
                              'Качество и источник видео'
                            )}
                            aria-label={tr(
                              'Calitate & Sursă Video',
                              'Video Quality & Source',
                              'Качество и источник видео'
                            )}
                            onClick={() => toggleVodCompactPanel('filelist')}
                            className={`h-9 w-9 sm:h-11 sm:w-12 rounded-full border flex items-center justify-center shrink-0 transition-all cursor-pointer ${openVodCompactPanel === 'filelist' || openVodCompactPanel === 'server'
                              ? 'bg-white text-[#141414] border-white shadow-md'
                              : 'bg-white/10 backdrop-blur-xl border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-white'
                              }`}
                          >
                            {isFileListStreamLoading ? (
                              <Loader2 className="w-4 h-4 sm:w-[18px] sm:h-[18px] animate-spin" />
                            ) : (
                              <SfVideoCameraIcon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                            )}
                          </button>
                        </div>

                        {/* Line 5: Single-Row Watch Progress Bar + Reluare de la 00:00 + Ștergere din istoric (EXACT same width as the icon row above) */}
                        {(() => {
                          const prog = findWatchProgressEntry(watchProgressMap, activeVodItem);
                          if (!prog) return null;
                          const epKeyForBox = `S${selectedSeason}E${selectedEpisode}`;
                          const epSavedForBox = prog.episodeProgressMap?.[epKeyForBox];
                          const effectiveProgSec =
                            activeVodItem.type === 'series'
                              ? (epSavedForBox?.currentTime ??
                                (prog.season === selectedSeason &&
                                  prog.episode === selectedEpisode
                                  ? prog.currentTime
                                  : 0))
                              : prog.currentTime;
                          if (effectiveProgSec <= 5 && prog.currentTime <= 5) return null;
                          const rawBoxDur =
                            activeVodItem.type === 'series'
                              ? (epSavedForBox?.duration ??
                                (prog.season === selectedSeason &&
                                  prog.episode === selectedEpisode
                                  ? prog.duration
                                  : 2700))
                              : prog.duration;
                          const totalDur =
                            rawBoxDur && rawBoxDur > 60
                              ? rawBoxDur
                              : activeVodItem.type === 'series'
                                ? 2700
                                : 5400;
                          const pct =
                            effectiveProgSec > 5
                              ? Math.min(
                                  100,
                                  Math.max(
                                    3,
                                    Math.round((effectiveProgSec / totalDur) * 100)
                                  )
                                )
                              : 0;

                          return (
                            <div className="w-full sm:w-0 sm:min-w-full flex items-center gap-1.5 sm:gap-2 flex-nowrap pt-0.5">
                              <div className="flex-1 min-w-0 h-9 sm:h-11 px-3.5 sm:px-4 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] flex items-center gap-2.5 sm:gap-3">
                                <span className="text-[11px] sm:text-xs font-extrabold text-white tabular-nums shrink-0 whitespace-nowrap">
                                  <strong className="text-[#60a5fa]">
                                    {formatWatchSeconds(effectiveProgSec)}
                                  </strong>{' '}
                                  <span className="text-white/60">/ {formatWatchSeconds(totalDur)}</span>
                                </span>
                                <div className="flex-1 min-w-[40px] h-1.5 rounded-full bg-white/15 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-[#0A84FF] to-[#60a5fa] transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-[11px] sm:text-xs font-extrabold text-[#60a5fa] tabular-nums shrink-0">
                                  {pct}%
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleStartVodPlayback(0)}
                                title={tr('Reluare de la început (00:00)', 'Restart from 00:00', 'Сначала (00:00)')}
                                aria-label={tr('Reluare de la început (00:00)', 'Restart from 00:00', 'Сначала (00:00)')}
                                className="h-9 w-9 sm:h-11 sm:w-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-white inline-flex items-center justify-center transition-all shrink-0 cursor-pointer"
                              >
                                <SfRestartIcon className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRemoveWatchProgressItem(activeVodItem.id)}
                                title={tr('Șterge din istoric', 'Remove from Watch History', 'Удалить из истории')}
                                aria-label={tr('Șterge din istoric', 'Remove from Watch History', 'Удалить из истории')}
                                className="h-9 w-9 sm:h-11 sm:w-12 rounded-full bg-[#FF453A]/18 hover:bg-[#FF453A] focus:bg-[#FF453A] text-[#FF453A] hover:text-white focus:text-white border border-[#FF453A]/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-xl inline-flex items-center justify-center transition-all shrink-0 cursor-pointer"
                              >
                                <SfTrashIcon className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0" />
                              </button>
                            </div>
                          );
                        })()}

                      </div>
                    </div>

                    {/* LOCAL / OFFLINE DOWNLOAD MODAL OVERLAY (Sezon & Episoade + Piste Audio + Calitate Video) */}
                    {isDownloadModalOpen &&
                      (() => {
                        const isSeriesVod = activeVodItem.type === 'series';
                        const modalSeasonsList =
                          availableSeasons.length > 0 ? availableSeasons : [1];
                        const activeModalSeason = modalSeasonsList.includes(
                          downloadModalSeason
                        )
                          ? downloadModalSeason
                          : modalSeasonsList[0];
                        const modalSeasonEpisodes =
                          seasonsMap.get(activeModalSeason) || [
                            {
                              season: activeModalSeason,
                              episode: 1,
                              title: 'Episodul 1',
                            },
                          ];
                        const savedForThisVod = offlineItems.filter(
                          (x) =>
                            x.vodId === activeVodItem.id ||
                            x.id === `vod_${activeVodItem.id}` ||
                            x.id.startsWith(`vod_${activeVodItem.id}_`)
                        );
                        const isDownloadingThisVod = Boolean(
                          activeDownloadProgress &&
                          activeDownloadTargetId?.startsWith(
                            `vod_${activeVodItem.id}`
                          )
                        );
                        const modalAudioSource =
                          activeServer === 'filelist_torrent' &&
                          resolvedFileListStream?.audioNames &&
                          resolvedFileListStream.audioNames.length > 0
                            ? resolvedFileListStream.audioNames
                            : resolvedDirectStream?.audioNames &&
                                resolvedDirectStream.audioNames.length > 0
                              ? resolvedDirectStream.audioNames
                              : resolvedFileListStream?.audioNames &&
                                  resolvedFileListStream.audioNames.length > 0
                                ? resolvedFileListStream.audioNames
                                : ['Original / Audio 1'];
                        const rawAudioIndexed = modalAudioSource.map(
                          (aName, idx) => ({ aName, idx })
                        );
                        const displayModalAudioTracks = filterDisplayAudioItems(
                          rawAudioIndexed,
                          (x) => x.aName,
                          isCurrentVodForeign
                        );
                        const vodWatchEntry = findWatchProgressEntry(
                          watchProgressMap,
                          activeVodItem
                        );
                        const unwatchedModalEpNums = modalSeasonEpisodes
                          .filter((ep) => {
                            const epProg =
                              vodWatchEntry?.episodeProgressMap?.[
                                `S${activeModalSeason}E${ep.episode}`
                              ];
                            return !isEpisodeProgressWatched(epProg);
                          })
                          .map((ep) => ep.episode);

                        const modalOverlay = (
                          <div
                            data-download-modal="true"
                            role="dialog"
                            aria-modal="true"
                            style={{
                              paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
                              paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
                              paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))',
                              paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
                            }}
                            className="fixed inset-0 z-[260] bg-black/80 flex items-center justify-center p-2 sm:p-4"
                            onClick={(e) => {
                              if (e.target === e.currentTarget) {
                                setIsDownloadModalOpen(false);
                              }
                            }}
                          >
                            <div className="w-full max-w-2xl max-h-[min(94vh,760px)] flex flex-col rounded-2xl sm:rounded-3xl bg-[#10141d] border border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.92)] overflow-hidden text-white">
                              {/* Ultra-Compact Modal Header */}
                              <div className="shrink-0 px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2 bg-white/[0.03]">
                                <div className="flex items-center gap-2 min-w-0">
                                  <HardDriveDownload className="w-4 h-4 text-blue-400 shrink-0" />
                                  <h3 className="text-xs sm:text-sm font-extrabold text-white truncate">
                                    {detailedMeta?.name || activeVodItem.name}
                                  </h3>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setIsDownloadModalOpen(false)}
                                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white inline-flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Compact Scrollable Body: 1. Quality -> 2. Audio/Sub -> 3. Season & Episodes */}
                              <div className="flex-1 min-h-0 p-3.5 sm:p-4 overflow-y-auto overflow-x-hidden space-y-3">
                                {/* 1. VIDEO QUALITY (Compact Single-Line 4-Column Row) */}
                                <div className="space-y-1.5">
                                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 block">
                                    {tr(
                                      '1. Calitate Video',
                                      '1. Video Quality',
                                      '1. Качество видео'
                                    )}
                                  </span>
                                  <div className="grid grid-cols-4 gap-1.5">
                                    {(
                                      [
                                        {
                                          h: 1080 as const,
                                          label: '1080p',
                                          size: isSeriesVod
                                            ? '~650MB'
                                            : '~1.5GB',
                                        },
                                        {
                                          h: 720 as const,
                                          label: '720p',
                                          size: isSeriesVod
                                            ? '~320MB'
                                            : '~750MB',
                                        },
                                        {
                                          h: 480 as const,
                                          label: '480p',
                                          size: isSeriesVod
                                            ? '~180MB'
                                            : '~450MB',
                                        },
                                        {
                                          h: 360 as const,
                                          label: '360p',
                                          size: isSeriesVod
                                            ? '~110MB'
                                            : '~280MB',
                                        },
                                      ]
                                    ).map((qOpt) => {
                                      const active =
                                        downloadQualityHeight === qOpt.h;
                                      return (
                                        <button
                                          key={qOpt.h}
                                          type="button"
                                          onClick={() =>
                                            setDownloadQualityHeight(qOpt.h)
                                          }
                                          className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer ${active
                                              ? 'bg-[#2563eb] border-blue-400 text-white shadow-sm'
                                              : 'bg-white/[0.05] hover:bg-white/[0.1] border-white/10 text-zinc-300'
                                            }`}
                                        >
                                          <div className="text-xs font-extrabold text-white leading-tight">
                                            {qOpt.label}
                                          </div>
                                          <div
                                            className={`text-[10px] font-bold tabular-nums leading-tight mt-0.5 ${
                                              active
                                                ? 'text-blue-100'
                                                : 'text-zinc-400'
                                            }`}
                                          >
                                            {qOpt.size}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* 2. AUDIO & SUBTITLE (Wrapped Grid — Never Cut Off) */}
                                <div className="space-y-1.5">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">
                                      {tr(
                                        'Audio & Subtitrare',
                                        'Audio & Subtitle',
                                        'Озвучка и субтитры'
                                      )}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setIsSubFinderOpen(true)}
                                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-[11px] font-bold text-blue-300 cursor-pointer"
                                    >
                                      <Languages className="w-3.5 h-3.5 shrink-0" />
                                      <span className="truncate max-w-[180px]">
                                        {activeSubLabel ||
                                          tr(
                                            'Subtitrare Auto',
                                            'Auto Subtitle',
                                            'Авто-субтитры'
                                          )}
                                      </span>
                                    </button>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {displayModalAudioTracks.map(({ aName, idx }) => {
                                      const active =
                                        Math.max(0, selectedAudioTrackIdx) ===
                                        idx;
                                      return (
                                        <button
                                          key={`${aName}-${idx}`}
                                          type="button"
                                          onClick={() =>
                                            setSelectedAudioTrackIdx(idx)
                                          }
                                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                                            active
                                              ? 'bg-[#2563eb] text-white border-blue-400 shadow-sm'
                                              : 'bg-white/[0.05] hover:bg-white/10 text-zinc-300 border-white/10'
                                            }`}
                                        >
                                          <Volume2 className="w-3 h-3 shrink-0" />
                                          <span className="truncate max-w-[200px]">
                                            {aName}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* 3. SERIES: Season & Episode Multi-Selector (Placed AFTER Quality) */}
                                {isSeriesVod && (
                                  <div className="space-y-2 pt-1 border-t border-white/10">
                                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 mr-1">
                                          {tr(
                                            '2. Episoade',
                                            '2. Episodes',
                                            '2. Серии'
                                          )}
                                        </span>
                                        {modalSeasonsList.map((sNum) => {
                                          const active =
                                            activeModalSeason === sNum;
                                          return (
                                            <button
                                              key={sNum}
                                              type="button"
                                              onClick={() => {
                                                setDownloadModalSeason(sNum);
                                                const firstEp =
                                                  seasonsMap.get(sNum)?.[0]
                                                    ?.episode || 1;
                                                setSelectedDownloadEpisodes([
                                                  firstEp,
                                                ]);
                                              }}
                                              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold shrink-0 border transition-all cursor-pointer ${active
                                                  ? 'bg-white text-zinc-950 border-white'
                                                  : 'bg-white/[0.06] hover:bg-white/12 text-zinc-300 border-white/15'
                                                }`}
                                            >
                                              S{sNum}{seasonYearsMap.get(sNum) ? ` (${seasonYearsMap.get(sNum)})` : ""}
                                            </button>
                                          );
                                        })}
                                      </div>

                                      <div className="flex flex-wrap items-center gap-1">
                                        {unwatchedModalEpNums.length > 0 &&
                                          unwatchedModalEpNums.length <
                                            modalSeasonEpisodes.length && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setSelectedDownloadEpisodes(
                                                  unwatchedModalEpNums
                                                )
                                              }
                                              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/45 text-[10px] font-bold text-emerald-200 cursor-pointer"
                                            >
                                              {tr(
                                                `Nevăzute (${unwatchedModalEpNums.length})`,
                                                `Unwatched (${unwatchedModalEpNums.length})`,
                                                `Новые (${unwatchedModalEpNums.length})`
                                              )}
                                            </button>
                                          )}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setSelectedDownloadEpisodes(
                                              modalSeasonEpisodes.map(
                                                (ep) => ep.episode
                                              )
                                            )
                                          }
                                          className="px-2.5 py-1 rounded-lg bg-[#2563eb]/25 hover:bg-[#2563eb]/40 border border-blue-400/40 text-[10px] font-bold text-blue-200 cursor-pointer"
                                        >
                                          {tr(
                                            `Tot S${activeModalSeason} (${modalSeasonEpisodes.length})`,
                                            `All S${activeModalSeason} (${modalSeasonEpisodes.length})`,
                                            `Все (${modalSeasonEpisodes.length})`
                                          )}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setSelectedDownloadEpisodes([
                                              selectedEpisode,
                                            ])
                                          }
                                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-[10px] font-semibold text-zinc-200 cursor-pointer"
                                        >
                                          {tr(
                                            `Doar E${selectedEpisode}`,
                                            `Only E${selectedEpisode}`,
                                            `Сер. ${selectedEpisode}`
                                          )}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Compact Episode Grid with Watched / Progress Badges */}
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-56 overflow-y-auto pr-0.5">
                                      {modalSeasonEpisodes.map((ep) => {
                                        const isChecked =
                                          selectedDownloadEpisodes.includes(
                                            ep.episode
                                          );
                                        const epOfflineId = `vod_${activeVodItem.id}_S${activeModalSeason}E${ep.episode}`;
                                        const isAlreadySaved =
                                          offlineItems.some(
                                            (x) => x.id === epOfflineId
                                          );
                                        const epProg =
                                          vodWatchEntry?.episodeProgressMap?.[
                                            `S${activeModalSeason}E${ep.episode}`
                                          ];
                                        const isWatchedEp =
                                          isEpisodeProgressWatched(epProg);
                                        const epDur =
                                          epProg?.duration && epProg.duration > 60
                                            ? epProg.duration
                                            : 2700;
                                        const epPct =
                                          !isWatchedEp &&
                                          epProg &&
                                          epProg.currentTime > 15
                                            ? Math.min(
                                                95,
                                                Math.max(
                                                  5,
                                                  Math.round(
                                                    (epProg.currentTime / epDur) * 100
                                                  )
                                                )
                                              )
                                            : 0;
                                        return (
                                          <button
                                            key={ep.episode}
                                            type="button"
                                            onClick={() => {
                                              setSelectedDownloadEpisodes(
                                                (prev) =>
                                                  prev.includes(ep.episode)
                                                    ? prev.length > 1
                                                      ? prev.filter(
                                                        (n) =>
                                                          n !== ep.episode
                                                      )
                                                      : prev
                                                    : [...prev, ep.episode]
                                              );
                                            }}
                                            className={`px-2.5 py-1.5 rounded-xl border text-left flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
                                              isChecked
                                                ? 'bg-[#2563eb]/30 border-blue-400 text-white'
                                                : isWatchedEp
                                                  ? 'bg-emerald-950/35 hover:bg-emerald-950/55 border-emerald-500/35 text-zinc-200'
                                                  : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-zinc-300'
                                            }`}
                                          >
                                            <div className="min-w-0">
                                              <div className="flex flex-wrap items-center gap-1">
                                                <span className="text-xs font-extrabold text-white">
                                                  E{ep.episode}
                                                </span>
                                                {isWatchedEp && (
                                                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-[9px] font-extrabold text-emerald-300 leading-tight">
                                                    ✓ {tr('Văzut', 'Seen', 'Просм.')}
                                                  </span>
                                                )}
                                                {epPct > 0 && (
                                                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500/25 border border-amber-400/40 text-[9px] font-bold text-amber-200 tabular-nums leading-tight">
                                                    {epPct}%
                                                  </span>
                                                )}
                                                {isAlreadySaved && (
                                                  <span className="px-1 py-0.2 rounded bg-blue-500/35 text-[8px] font-bold text-blue-200 leading-tight">
                                                    OFFLINE
                                                  </span>
                                                )}
                                              </div>
                                              <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                                                {ep.title ||
                                                  `Ep. ${ep.episode}`}
                                              </div>
                                            </div>
                                            <CheckCircle2
                                              className={`w-3.5 h-3.5 shrink-0 ${
                                                isChecked
                                                  ? 'text-blue-400'
                                                  : isWatchedEp
                                                    ? 'text-emerald-400/70'
                                                    : 'text-white/15'
                                              }`}
                                            />
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Live Progress Bar while downloading */}
                                {isDownloadingThisVod &&
                                  activeDownloadProgress && (
                                    <div className="space-y-1.5 p-2.5 rounded-xl bg-blue-950/50 border border-blue-400/40">
                                      <div className="flex items-center justify-between text-[11px] font-bold text-white tabular-nums">
                                        <span className="truncate">
                                          {activeDownloadProgress.stage}
                                        </span>
                                        <span className="shrink-0 ml-2 text-blue-300">
                                          {activeDownloadProgress.percent}% •{' '}
                                          {formatBytes(
                                            activeDownloadProgress.downloadedBytes
                                          )}
                                        </span>
                                      </div>
                                      <div className="w-full h-2 rounded-full bg-white/15 overflow-hidden">
                                        <div
                                          className="h-full bg-[#2563eb] transition-all duration-200"
                                          style={{
                                            width: `${activeDownloadProgress.percent}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  )}

                                {downloadError && (
                                  <div className="p-2 rounded-xl bg-rose-950/60 border border-rose-500/40 text-[11px] font-semibold text-rose-200">
                                    {downloadError}
                                  </div>
                                )}

                                {/* Already Downloaded Items for this Movie / Series */}
                                {savedForThisVod.length > 0 && (
                                  <div className="space-y-1.5 pt-2 border-t border-white/10">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-300 block">
                                      {tr(
                                        `Salvate Local (${savedForThisVod.length})`,
                                        `Saved Locally (${savedForThisVod.length})`,
                                        `Сохранено (${savedForThisVod.length})`
                                      )}
                                    </span>
                                    <div className="space-y-1 max-h-28 overflow-y-auto pr-0.5">
                                      {savedForThisVod.map((savedItem) => (
                                        <div
                                          key={savedItem.id}
                                          className="px-2.5 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-between gap-2"
                                        >
                                          <div className="min-w-0 text-[11px] font-bold text-white truncate">
                                            {savedItem.subtitleLabel ||
                                              savedItem.title}{' '}
                                            <span className="text-blue-300">
                                              • {savedItem.qualityLabel} (
                                              {formatBytes(savedItem.sizeBytes)}
                                              )
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (
                                                  typeof savedItem.season ===
                                                  'number' &&
                                                  typeof savedItem.episode ===
                                                  'number'
                                                ) {
                                                  setSelectedSeason(
                                                    savedItem.season
                                                  );
                                                  setSelectedEpisode(
                                                    savedItem.episode
                                                  );
                                                }
                                                setIsDownloadModalOpen(false);
                                                handleStartVodPlayback();
                                              }}
                                              className="h-7 px-2.5 rounded-lg bg-[#2563eb] hover:bg-blue-500 text-white text-[10px] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                                            >
                                              <Play className="w-3 h-3 fill-current" />
                                              <span>
                                                {tr('Redă', 'Play', 'Играть')}
                                              </span>
                                            </button>
                                            <button
                                              type="button"
                                              title={tr(
                                                'Salvează Fișier',
                                                'Save File',
                                                'Файл'
                                              )}
                                              onClick={() =>
                                                void exportOfflineItemToDeviceFile(
                                                  savedItem
                                                )
                                              }
                                              className="h-7 w-7 rounded-lg bg-white/10 hover:bg-white/20 text-blue-300 inline-flex items-center justify-center border border-white/15 cursor-pointer"
                                            >
                                              <HardDriveDownload className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              title={tr(
                                                'Șterge',
                                                'Delete',
                                                'Удалить'
                                              )}
                                              onClick={async () => {
                                                await deleteOfflineItem(
                                                  savedItem.id
                                                );
                                                await refreshOfflineLibrary();
                                              }}
                                              className="h-7 w-7 rounded-lg bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-500/35 inline-flex items-center justify-center cursor-pointer"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Compact Modal Footer Actions */}
                              <div className="shrink-0 px-4 py-3 border-t border-white/10 bg-white/[0.03] flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => setIsDownloadModalOpen(false)}
                                  className="h-9 px-3.5 rounded-full bg-white/10 hover:bg-white/15 text-zinc-200 text-xs font-bold cursor-pointer"
                                >
                                  {tr('Închide', 'Close', 'Закрыть')}
                                </button>

                                {isDownloadingThisVod ? (
                                  <button
                                    type="button"
                                    onClick={handleCancelOfflineDownload}
                                    className="h-9 px-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>
                                      {tr(
                                        'Oprește',
                                        'Stop',
                                        'Остановить'
                                      )}
                                    </span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={
                                      isDirectStreamLoading &&
                                      !isSeriesVod &&
                                      !(resolvedFileListStream?.ok && resolvedFileListStream.streamUrl)
                                    }
                                    onClick={() =>
                                      void handleStartOfflineDownload(
                                        downloadQualityHeight,
                                        activeModalSeason,
                                        selectedDownloadEpisodes
                                      )
                                    }
                                    className="h-9 px-5 rounded-full bg-[#2563eb] hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-[0_6px_20px_rgba(37,99,235,0.45)] cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5 shrink-0" />
                                    <span>
                                      {isSeriesVod
                                        ? tr(
                                          `Copiază (${selectedDownloadEpisodes.length} ep. • S${activeModalSeason} • ${downloadQualityHeight}p)`,
                                          `Download (${selectedDownloadEpisodes.length} ep. • S${activeModalSeason} • ${downloadQualityHeight}p)`,
                                          `Скачать (${selectedDownloadEpisodes.length} сер. • S${activeModalSeason} • ${downloadQualityHeight}p)`
                                        )
                                        : tr(
                                          `Copiază (${downloadQualityHeight}p)`,
                                          `Download (${downloadQualityHeight}p)`,
                                          `Скачать (${downloadQualityHeight}p)`
                                        )}
                                    </span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                        return typeof document !== 'undefined'
                          ? createPortal(modalOverlay, document.body)
                          : modalOverlay;
                      })()}

                  </div>

                  {/* Right-Side Column (Immediately to the right of Card + Buttons & Icons): Shows Detalii & Sinopsis by default, or Audio / Video Sources when clicked */}
                  <div className="flex-1 min-w-0 w-full flex flex-col">
                    {openVodCompactPanel ? (
                      <div className="w-full">

                      {openVodCompactPanel === 'audio' &&
                        resolvedDirectStream?.audioNames &&
                        resolvedDirectStream.audioNames.length > 0 &&
                        (() => {
                          const names = resolvedDirectStream.audioNames || [];
                          const prefIdx = resolveAudioTrackIndexByPreference(
                            names,
                            effectiveVodAudioPref
                          );
                          const filteredAudio = filterDisplayAudioItems(
                            names.map((aName, idx) => ({ aName, idx })),
                            (x) => x.aName,
                            isCurrentVodForeign
                          );
                          const ordered = [...filteredAudio].sort((a, b) => {
                              if (a.idx === prefIdx) return -1;
                              if (b.idx === prefIdx) return 1;
                              return a.idx - b.idx;
                            });
                          return (
                            <div
                              data-vod-compact-open-box="true"
                              className="w-full rounded-[28px] tahoe-glass border border-[#60a5fa]/60 p-4 space-y-3 shadow-2xl"
                            >
                              <div className="flex items-center justify-between px-1">
                                <span className="text-xs font-extrabold uppercase tracking-wider text-[#60a5fa]">
                                  {tr('Limba Audio', 'Audio Track', 'Озвучка / Аудио')} ({ordered.length})
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setOpenVodCompactPanel(null)}
                                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-zinc-200 inline-flex items-center justify-center cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto no-scrollbar p-1">
                                {ordered.map(({ aName, idx }) => {
                                  const isSel = effectiveAudioTrackIdx === idx;
                                  return (
                                    <button
                                      key={`card_aud_${aName}_${idx}`}
                                      type="button"
                                      data-vod-compact-option="true"
                                      data-vod-compact-active-item={isSel ? 'true' : undefined}
                                      onClick={() => {
                                        userManuallySelectedServerRef.current = true;
                                        userSelectedFlTorrentIdRef.current = null;
                                        setActiveServer('kinogram_hls');
                                        setSelectedAudioTrackIdx(idx);
                                        setOpenVodCompactPanel(null);
                                        handleStartVodPlayback();
                                      }}
                                      className={`min-h-[42px] py-2.5 px-3.5 rounded-xl text-xs leading-snug font-bold inline-flex items-center justify-between gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer ${isSel
                                        ? 'bg-[#1e3a8a] text-white border border-[#60a5fa] shadow-md'
                                        : 'bg-white/10 hover:bg-white/20 focus:bg-white focus:text-[#141414] text-zinc-100 border border-white/10'
                                        }`}
                                    >
                                      <span className="truncate leading-normal">{aName}</span>
                                      {isSel && <span className="shrink-0"></span>}
                                    </button>
                                  );
                                })}
                                {findExplicitOriginalAudioTrackIndex(names) < 0 && (
                                  <button
                                    type="button"
                                    data-vod-compact-option="true"
                                    onClick={() => {
                                      setOpenVodCompactPanel(null);
                                      handleRequestOriginalAudio(true);
                                    }}
                                    className="sm:col-span-2 min-h-[42px] py-2.5 px-3.5 rounded-xl text-xs leading-snug font-bold inline-flex items-center justify-between gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer bg-[#1e3a8a]/85 hover:bg-[#1e3a8a] focus:bg-white focus:text-[#141414] text-white border border-[#3b82f6]/60"
                                  >
                                    <span className="truncate leading-normal">
                                      {tr(
                                        'Original (English) • 1080p / 4K',
                                        'Original (English) • 1080p / 4K',
                                        'Оригинал (English) • 1080p / 4K'
                                      )}
                                    </span>
                                    <span className="shrink-0 text-[10px] font-black text-[#93c5fd]">
                                      EN
                                    </span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                      {(openVodCompactPanel === 'filelist' || openVodCompactPanel === 'server') &&
                        (() => {
                          const rawFlList =
                            resolvedFileListStream?.torrents &&
                            resolvedFileListStream.torrents.length > 0
                              ? resolvedFileListStream.torrents
                              : resolvedFileListStream?.selectedTorrent
                                ? [resolvedFileListStream.selectedTorrent]
                                : [];
                          const flList = rawFlList.filter((t) => {
                            const prov =
                              t.provider ||
                              t.source ||
                              (t.flId?.startsWith('kz:')
                                ? 'kinozal'
                                : t.flId?.startsWith('tio:')
                                  ? 'torrentio'
                                  : 'filelist');
                            return !(isCurrentVodForeign && prov === 'kinozal');
                          });
                          const isRoTitle = Boolean(
                            activeVodItem &&
                            (isRomanianVodItem(detailedMeta || activeVodItem) ||
                              isFileListExclusiveRomanianTitle(
                                detailedMeta || activeVodItem
                              ))
                          );
                          const directOrigIdx = findExplicitOriginalAudioTrackIndex(
                            resolvedDirectStream?.audioNames || []
                          );
                          const hasDirectRaw = Boolean(
                            resolvedDirectStream?.ok &&
                              (resolvedDirectStream.dashUrl ||
                                resolvedDirectStream.hlsUrl ||
                                resolvedDirectStream.proxyHlsUrl)
                          );
                          const hasDirectHls =
                            hasDirectRaw &&
                            (!isCurrentVodForeign ||
                              isRoTitle ||
                              directOrigIdx >= 0 ||
                              !isLocalHomeServer() ||
                              flList.length === 0);
                          const panelHeaderText = isRoTitle
                            ? tr(
                                'Calitate & Sursă Video (Cloud România • FileList)',
                                'Video Quality & Source (Cloud RO • FileList)',
                                'Качество и источник видео'
                              )
                            : isCurrentVodForeign
                              ? tr(
                                  'Calitate & Sursă Video (FileList)',
                                  'Video Quality & Source (FileList)',
                                  'Качество и источник (FileList)'
                                )
                              : tr(
                                  'Sursă Video (Kinozal • VK • Cloud RU)',
                                  'Video Source (Kinozal • VK • Cloud RU)',
                                  'Источник видео (Kinozal • VK • RU)'
                                );
                          const totalStreamsCount =
                            flList.length + (hasDirectHls ? 1 : 0);
                          return (
                            <div
                              data-vod-compact-open-box="true"
                              className="w-full rounded-[28px] tahoe-glass border border-[#60a5fa]/60 p-4 space-y-3 shadow-2xl"
                            >
                              <div className="flex items-center justify-between px-1">
                                <span className="text-xs font-extrabold uppercase tracking-wider text-[#60a5fa]">
                                  {panelHeaderText} ({totalStreamsCount})
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setOpenVodCompactPanel(null)}
                                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-zinc-200 inline-flex items-center justify-center cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="max-h-[460px] xl:max-h-[500px] overflow-y-auto no-scrollbar space-y-2 p-1">
                                {[...flList]
                                  .sort((a, b) => {
                                    const rankQ = (q = ''): number => {
                                      const u = q.toUpperCase();
                                      if (u.includes('2160') || u.includes('4K')) return 2160;
                                      if (u.includes('1440') || u.includes('2K')) return 1440;
                                      if (u.includes('1080') || u.includes('FULL HD')) return 1080;
                                      if (u.includes('720')) return 720;
                                      if (u.includes('UHD')) return 2160;
                                      if (u.includes('480')) return 480;
                                      return 1080;
                                    };
                                    return (
                                      rankQ(b.quality) - rankQ(a.quality) ||
                                      (Number(b.seeders) || 0) - (Number(a.seeders) || 0)
                                    );
                                  })
                                  .map((flTor) => {
                                  const torProv =
                                    flTor.provider ||
                                    flTor.source ||
                                    (flTor.flId?.startsWith('kz:')
                                      ? 'kinozal'
                                      : flTor.flId?.startsWith('tio:')
                                        ? 'torrentio'
                                        : 'filelist');
                                  const isSelectedTor =
                                    activeServer === 'filelist_torrent' &&
                                    resolvedFileListStream?.torrentId === flTor.id;
                                  const is4K = (flTor.quality || '')
                                    .toUpperCase()
                                    .includes('4K');
                                  const isTorrentio =
                                    torProv === 'torrentio' ||
                                    (flTor.id < 0 && torProv !== 'kinozal');
                                  const isKinozal = torProv === 'kinozal';
                                  return (
                                    <button
                                      key={`fl_tor_${flTor.id}`}
                                      type="button"
                                      data-vod-compact-option="true"
                                      data-vod-compact-active-item={isSelectedTor ? 'true' : undefined}
                                      onClick={() => {
                                        setOpenVodCompactPanel(null);
                                        handleSelectFileListTorrent(
                                          flTor.id,
                                          flTor.fileIdx,
                                          true
                                        );
                                      }}
                                      className={`w-full px-3.5 py-2.5 rounded-xl text-left border transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer ${isSelectedTor
                                        ? 'bg-[#1e3a8a] text-white border-[#60a5fa] font-extrabold shadow-md'
                                        : 'bg-white/[0.07] hover:bg-white/15 focus:bg-white focus:text-[#141414] text-zinc-100 border-white/10'
                                        }`}
                                    >
                                      <div className="flex items-center justify-between gap-2 text-[11px] font-extrabold leading-snug">
                                        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                                          <span
                                            className={`px-2 py-0.5 rounded-md text-[10px] font-black shrink-0 ${isSelectedTor
                                              ? 'bg-white/20 text-white'
                                              : is4K
                                                ? 'bg-amber-400 text-zinc-950'
                                                : 'bg-[#60a5fa]/25 text-[#93c5fd]'
                                              }`}
                                          >
                                            {flTor.quality || '1080p'}
                                          </span>
                                          <span
                                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold truncate ${isSelectedTor
                                              ? 'bg-white/20 text-white'
                                              : isKinozal
                                                ? 'bg-amber-500/25 text-amber-200 border border-amber-400/40'
                                                : isTorrentio
                                                  ? 'bg-sky-500/25 text-sky-200 border border-sky-400/30'
                                                  : 'bg-blue-500/25 text-emerald-200 border border-blue-400/30'
                                              }`}
                                          >
                                            {isKinozal
                                              ? `Kinozal VIP${flTor.tracker ? ` • ${flTor.tracker}` : ''}`
                                              : isTorrentio
                                                ? `P2P Global${flTor.tracker ? ` • ${flTor.tracker}` : ''}`
                                                : flTor.isRo
                                                  ? 'FileList RO'
                                                  : 'FileList'}
                                          </span>
                                          {flTor.isRo && (
                                            <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-zinc-950 text-[10px] font-black shrink-0">
                                              RO
                                            </span>
                                          )}
                                          {flTor.freeleech && !isTorrentio && !isKinozal && (
                                            <span className="px-1.5 py-0.5 rounded-md bg-white/15 text-white text-[9.5px] font-black shrink-0">
                                              FL
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 tabular-nums text-[11px]">
                                          <span
                                            className={
                                              isSelectedTor
                                                ? 'text-sky-300 font-black'
                                                : 'text-blue-400 font-extrabold'
                                            }
                                          >
                                            ▲ {flTor.seeders}
                                          </span>
                                          <span>{flTor.sizeFormatted}</span>
                                        </div>
                                      </div>
                                      <div className="text-xs leading-normal truncate mt-1 opacity-90 font-medium">
                                        {flTor.audioInfo && !isCurrentVodForeign
                                          ? `${flTor.audioInfo} • `
                                          : ''}
                                        {flTor.releaseTitle}
                                      </div>
                                    </button>
                                  );
                                })}
                                {hasDirectHls && (
                                  <button
                                    type="button"
                                    data-vod-compact-option="true"
                                    data-vod-compact-active-item={activeServer === 'kinogram_hls' ? 'true' : undefined}
                                    onClick={() => {
                                      userManuallySelectedServerRef.current = true;
                                      userSelectedFlTorrentIdRef.current = null;
                                      if (isCurrentVodForeign && directOrigIdx >= 0) {
                                        setSelectedAudioTrackIdx(directOrigIdx);
                                      }
                                      setActiveServer('kinogram_hls');
                                      setOpenVodCompactPanel(null);
                                      handleStartVodPlayback();
                                    }}
                                    className={`w-full px-3.5 py-2.5 rounded-xl text-left border transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer ${activeServer === 'kinogram_hls'
                                      ? 'bg-[#1e3a8a] text-white border-[#60a5fa] font-extrabold shadow-md'
                                      : 'bg-white/[0.07] hover:bg-white/15 focus:bg-white focus:text-[#141414] text-zinc-100 border-white/10'
                                      }`}
                                  >
                                    <div className="flex items-center justify-between gap-2 text-[11px] font-extrabold leading-snug">
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className={`px-2 py-0.5 rounded-md text-[10px] ${activeServer === 'kinogram_hls'
                                            ? 'bg-white/20 text-white'
                                            : 'bg-sky-500/25 text-sky-300'
                                            }`}
                                        >
                                          {/2160|4k/i.test(String(resolvedDirectStream?.sourcePath || ''))
                                            ? '4K UHD INSTANT'
                                            : /1080|rutube|iedem/i.test(String(resolvedDirectStream?.sourcePath || '')) ||
                                                /1080_/i.test(String(resolvedDirectStream?.hlsUrl || ''))
                                              ? '1080p INSTANT'
                                              : '720p HD INSTANT'}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-md bg-blue-500/25 text-blue-200 text-[10px]">
                                          Cloud Rapid
                                        </span>
                                      </div>
                                      <span className="text-[10px] font-black uppercase tracking-wider opacity-90">
                                        Instant
                                      </span>
                                    </div>
                                    <div className="text-xs leading-normal truncate mt-1 opacity-90 font-semibold">
                                      {isRoTitle
                                        ? 'Audio Română • Cloud Rapid'
                                        : isCurrentVodForeign
                                          ? 'Audio Original • Cloud Rapid'
                                          : (
                                              resolvedDirectStream?.audioNames || [
                                                'Original Multi-Audio',
                                              ]
                                            )
                                              .slice(0, 3)
                                              .join(' • ')}
                                    </div>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="w-full h-auto xl:h-[337px] p-4 sm:p-5 xl:p-6 rounded-2xl sm:rounded-[28px] tahoe-glass flex flex-col justify-between gap-3 overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between">
                        <h2 className="text-xl sm:text-[22px] font-semibold text-white tracking-tight">
                          {tr('Detalii & Sinopsis', 'Details & Synopsis', 'Подробно')}
                        </h2>
                      </div>

                      <p className="text-sm sm:text-[15px] text-zinc-100 leading-relaxed font-normal line-clamp-3 sm:line-clamp-4">
                        {detailedMeta?.description ||
                          activeVodItem.description ||
                          vodProviderAndStudios?.fallbackDescription ||
                          (!isDirectStreamLoading
                            ? `${detailedMeta?.name || activeVodItem.name} (${detailedMeta?.releaseInfo ||
                            activeVodItem.releaseInfo ||
                            '2026'
                            }) — ${activeVodItem.type === 'series'
                              ? tr(
                                'serial original',
                                'original series',
                                'оригинальный сериал'
                              )
                              : tr(
                                'producție cinematografică',
                                'feature film',
                                'художественный фильм'
                              )
                            }${detailedMeta?.country
                              ? ` (${detailedMeta.country})`
                              : ''
                            }${detailedMeta?.director?.length
                              ? `, ${tr('regia', 'directed by', 'режиссер')} ${detailedMeta.director.join(', ')}`
                              : ''
                            }.`
                            : tr(
                              'Se încarcă descrierea...',
                              'Loading synopsis...',
                              'Описание загружается...'
                            ))}
                      </p>

                      {/* Metadata Columns Row: Дата релиза | Страны | Режиссер */}
                      <div className="flex flex-wrap items-start pt-1">
                        <div className="mr-10 sm:mr-14 mb-3">
                          <div className="text-xs text-zinc-400 font-semibold">
                            {tr('Data lansării', 'Release Date', 'Дата релиза')}
                          </div>
                          <div className="text-sm sm:text-[15px] text-zinc-100 mt-0.5">
                            {detailedMeta?.releaseInfo ||
                              activeVodItem.releaseInfo ||
                              '2026'}
                          </div>
                        </div>

                        <div className="mr-10 sm:mr-14 mb-3">
                          <div className="text-xs text-zinc-400 font-semibold">
                            {tr('Țări', 'Countries', 'Страны')}
                          </div>
                          <div className="text-sm sm:text-[15px] text-zinc-100 mt-0.5">
                            {detailedMeta?.country || 'USA'}
                          </div>
                        </div>

                        {detailedMeta?.director &&
                          detailedMeta.director.length > 0 && (
                            <div className="mb-3">
                              <div className="text-xs text-zinc-400 font-semibold">
                                {tr('Regizor', 'Director', 'Режиссер')}
                              </div>
                              <div className="text-sm sm:text-[15px] text-zinc-100 mt-0.5">
                                {detailedMeta.director.join(', ')}
                              </div>
                            </div>
                          )}
                      </div>

                      {/* Bottom Count Badges Row (macOS Tahoe Pill Buttons): Жанр [2] | Теги [11] */}
                      <div className="flex flex-wrap items-center pt-1">
                        <button
                          type="button"
                          onClick={() => setIsInfoSheetOpen((v) => !v)}
                          className="inline-flex items-center mr-3 mb-2 pl-4 pr-1.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 focus:bg-white focus:text-[#141414] border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] text-xs sm:text-sm text-zinc-100 transition-all cursor-pointer"
                        >
                          <span className="mr-2.5">{tr('Genuri', 'Genres', 'Жанр')}</span>
                          <span className="px-2.5 py-0.5 rounded-full bg-white text-[#141414] font-bold text-xs">
                            {(detailedMeta?.genres || activeVodItem.genres || [])
                              .length || 2}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsInfoSheetOpen((v) => !v)}
                          className="inline-flex items-center mb-2 pl-4 pr-1.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 focus:bg-white focus:text-[#141414] border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] text-xs sm:text-sm text-zinc-100 transition-all cursor-pointer"
                        >
                          <span className="mr-2.5">{tr('Etichete', 'Tags', 'Теги')}</span>
                          <span className="px-2.5 py-0.5 rounded-full bg-white text-[#141414] font-bold text-xs">
                            11
                          </span>
                        </button>
                      </div>
                    </div>
                    )}
                  </div>
                </div>



                {/* For Series: Full Lampa Seasons & Episodes Section right on the Card (macOS Tahoe Liquid Glass) */}
                {activeVodItem.type === 'series' &&
                  availableSeasons.length > 0 && (
                    <div className="p-5 sm:p-6 rounded-[28px] tahoe-glass space-y-4">
                      {(() => {
                        const savedSeriesProg = findWatchProgressEntry(
                          watchProgressMap,
                          activeVodItem
                        );
                        const epProgressMap =
                          savedSeriesProg?.episodeProgressMap || {};
                        const watchedInCurrentSeason = episodesForSeason.filter(
                          (ep) => {
                            const p =
                              epProgressMap[`S${selectedSeason}E${ep.episode}`];
                            return isEpisodeProgressWatched(p);
                          }
                        ).length;
                        const isCurrentSeasonWatched =
                          episodesForSeason.length > 0 &&
                          watchedInCurrentSeason === episodesForSeason.length;
                        return (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black uppercase tracking-wider text-amber-400 mr-2">
                          {tr(
                            'Sezoane & Episoade:',
                            'Seasons & Episodes:',
                            'Сезоны и серии:'
                          )}
                        </span>
                        {displayedSeasons.map((sNum) => {
                          const sEps = seasonsMap.get(sNum) || [];
                          const isThisSeasonWatched =
                            sEps.length > 0 &&
                            sEps.every((ep) => {
                              const p = epProgressMap[`S${sNum}E${ep.episode}`];
                              return isEpisodeProgressWatched(p);
                            });
                          return (
                          <button
                            key={sNum}
                            type="button"
                            onClick={() => {
                              userSelectedFlTorrentIdRef.current = null;
                              userManuallySelectedServerRef.current = false;
                              setSelectedSeason(sNum);
                              setSelectedEpisode(1);
                              setResumeStartSeconds(0);
                              setPendingResumePromptSec(null);
                            }}
                            className={`h-10 px-5 rounded-full text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 transition-all cursor-pointer ${selectedSeason === sNum
                              ? 'bg-white text-zinc-950 shadow-md'
                              : 'bg-white/10 hover:bg-white/20 focus:bg-white focus:text-zinc-950 text-zinc-200 border border-white/15'
                              }`}
                          >
                            {isThisSeasonWatched && (
                              <CheckCircle2
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  selectedSeason === sNum
                                    ? 'text-[#2563eb]'
                                    : 'text-emerald-400'
                                }`}
                              />
                            )}
                            <span>
                              {tr(
                                `Sezonul ${sNum}${seasonYearsMap.get(sNum) ? ` (${seasonYearsMap.get(sNum)})` : ""}`,
                                `Season ${sNum}${seasonYearsMap.get(sNum) ? ` (${seasonYearsMap.get(sNum)})` : ""}`,
                                `Сезон ${sNum}${seasonYearsMap.get(sNum) ? ` (${seasonYearsMap.get(sNum)})` : ""}`
                              )}
                            </span>
                          </button>
                          );
                        })}
                        {episodesForSeason.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleSeasonWatched(activeVodItem, selectedSeason)
                            }
                            title={
                              isCurrentSeasonWatched
                                ? tr(
                                    'Anulează sezonul văzut',
                                    'Unmark season as watched',
                                    'Снять отметку с сезона'
                                  )
                                : tr(
                                    'Marchează tot sezonul ca vizionat',
                                    'Mark entire season as watched',
                                    'Отметить весь сезон просмотренным'
                                  )
                            }
                            className={`h-10 px-4 rounded-full text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition-all cursor-pointer focus:outline-none focus:ring-4 focus:ring-white focus:bg-white focus:text-zinc-950 ${
                              isCurrentSeasonWatched
                                ? 'bg-[#1e3a8a]/90 hover:bg-[#1e3a8a] border border-blue-400/60 text-white shadow-[0_4px_16px_rgba(30,58,138,0.4)]'
                                : 'bg-white/[0.08] hover:bg-white/20 border border-white/15 hover:border-white/30 text-zinc-200 hover:text-white'
                            }`}
                          >
                            <CheckCircle2
                              className={`w-4 h-4 shrink-0 ${
                                isCurrentSeasonWatched ? 'text-sky-300' : 'text-zinc-400'
                              }`}
                            />
                            <span>
                              {isCurrentSeasonWatched
                                ? tr('Sezon văzut', 'Season watched', 'Сезон просмотрен')
                                : watchedInCurrentSeason > 0
                                  ? tr(
                                      `Marchează sezonul văzut (${watchedInCurrentSeason}/${episodesForSeason.length})`,
                                      `Mark season watched (${watchedInCurrentSeason}/${episodesForSeason.length})`,
                                      `Отметить сезон (${watchedInCurrentSeason}/${episodesForSeason.length})`
                                    )
                                  : tr(
                                      'Marchează sezonul văzut',
                                      'Mark season watched',
                                      'Отметить сезон'
                                    )}
                            </span>
                          </button>
                        )}
                        {episodesForSeason.length > 1 && (
                          <div className="ml-auto flex items-center gap-1.5 bg-white/[0.06] p-1 rounded-full border border-white/15">
                            <button
                              type="button"
                              onClick={() => handleSetSeriesEpisodesSortDesc(false)}
                              className={`h-8 px-3.5 rounded-full text-xs font-extrabold transition-all cursor-pointer focus:outline-none focus:ring-4 focus:ring-white ${!episodesSortDesc
                                ? 'bg-white text-zinc-950 shadow-sm'
                                : 'text-zinc-300 hover:text-white focus:bg-white focus:text-zinc-950'
                                }`}
                            >
                              {tr(
                                `De la primul (1 - ${episodesForSeason.length})`,
                                `First to last (1 - ${episodesForSeason.length})`,
                                `С первой (1 - ${episodesForSeason.length})`
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetSeriesEpisodesSortDesc(true)}
                              className={`h-8 px-3.5 rounded-full text-xs font-extrabold transition-all cursor-pointer focus:outline-none focus:ring-4 focus:ring-white ${episodesSortDesc
                                ? 'bg-white text-zinc-950 shadow-sm'
                                : 'text-zinc-300 hover:text-white focus:bg-white focus:text-zinc-950'
                                }`}
                            >
                              {tr(
                                `De la ultimul (${episodesForSeason.length} - 1)`,
                                `Last to first (${episodesForSeason.length} - 1)`,
                                `С последней (${episodesForSeason.length} - 1)`
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                        );
                      })()}

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 py-2">
                        {displayedEpisodesForSeason.map((ep) => {
                          const isCurrent = selectedEpisode === ep.episode;
                          const epKey = `S${selectedSeason}E${ep.episode}`;
                          const epProg =
                            findWatchProgressEntry(watchProgressMap, activeVodItem)
                              ?.episodeProgressMap?.[epKey];
                          const epDur =
                            epProg?.duration && epProg.duration > 60
                              ? epProg.duration
                              : 2700;
                          const epPct =
                            epProg && epProg.currentTime > 10
                              ? Math.min(
                                100,
                                Math.max(
                                  5,
                                  Math.round(
                                    (epProg.currentTime / epDur) * 100
                                  )
                                )
                              )
                              : 0;
                          const isWatched = isEpisodeProgressWatched(epProg);
                          const epLabel = tr(
                            `Episodul ${ep.episode}`,
                            `Episode ${ep.episode}`,
                            `Серия ${ep.episode}`
                          );
                          const hasCustomTitle =
                            Boolean(ep.name) &&
                            ep.name.toLowerCase() !== epLabel.toLowerCase();
                          const resolvedImdb = activeVodItem.id.startsWith('tt')
                            ? activeVodItem.id
                            : detailedMeta?.imdbId || '';
                          const isRuSeriesEp = isRussianVodItem(activeVodItem);
                          const epThumb =
                            ((ep.thumbnail || "")) ||
                            (!isRuSeriesEp && resolvedImdb
                              ? `https://episodes.metahub.space/${resolvedImdb}/${selectedSeason}/${ep.episode}/w780.jpg`
                              : '') ||
                            detailedMeta?.background ||
                            activeVodItem.background ||
                            detailedMeta?.poster ||
                            activeVodItem.poster ||
                            '';
                          const epSynopsis = (
                            ep.overview ||
                            ep.description ||
                            ''
                          ).trim();
                          const epDate = ep.released
                            ? String(ep.released).slice(0, 10)
                            : '';

                          return (
                            <button
                              key={ep.id || ep.episode}
                              type="button"
                              data-episode-card="true"
                              data-episode-num={ep.episode}
                              data-season-num={selectedSeason}
                              onKeyDown={(e) => handleEpisodePlayKey(e, ep, selectedSeason)}
                              onClick={() => {
                                userSelectedFlTorrentIdRef.current = null;
                                setSelectedEpisode(ep.episode);
                                const startAt =
                                  epProg &&
                                    epProg.currentTime > 10 &&
                                    epPct < 92
                                    ? epProg.currentTime
                                    : 0;
                                handleStartVodPlayback(startAt);
                              }}
                              className={`group w-full rounded-2xl overflow-hidden text-left flex flex-col border transition-all focus:outline-none focus:ring-4 focus:ring-white focus:bg-white focus:text-zinc-950 cursor-pointer ${isCurrent
                                ? 'bg-blue-500/20 border-blue-400 shadow-[0_12px_32px_rgba(37, 99, 235,0.28)]'
                                : 'bg-white/[0.06] hover:bg-white/15 text-zinc-100 border-white/15'
                                }`}
                            >
                              <div className="relative w-full h-36 bg-gradient-to-br from-[#172554]/50 to-[#0f172a] overflow-hidden shrink-0">
                                <div className="absolute inset-0 flex items-center justify-center text-[#60a5fa]/35">
                                  <Clapperboard className="w-8 h-8" />
                                </div>
                                {epThumb && (
                                  <img
                                    src={epThumb}
                                    alt={epLabel}
                                    loading="lazy"
                                    onError={(e) => {
                                      const fallback =
                                        detailedMeta?.background ||
                                        detailedMeta?.poster ||
                                        '';
                                      if (
                                        fallback &&
                                        e.currentTarget.src !== fallback &&
                                        !e.currentTarget.dataset.triedFallback
                                      ) {
                                        e.currentTarget.dataset.triedFallback = '1';
                                        e.currentTarget.src = fallback;
                                      } else {
                                        e.currentTarget.style.display = 'none';
                                      }
                                    }}
                                    className="relative z-10 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                )}
                                <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/80 via-black/15 to-transparent pointer-events-none" />
                                <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5">
                                  <span className="px-2.5 py-0.5 rounded-full bg-black/80 backdrop-blur-md border border-white/15 text-[11px] font-black text-white">
                                    S{selectedSeason}:E{ep.episode}
                                  </span>
                                  {offlineItems.some(
                                    (x) =>
                                      x.id ===
                                        `vod_${activeVodItem.id}_S${selectedSeason}E${ep.episode}` ||
                                      (x.vodId === activeVodItem.id &&
                                        (x.season || 1) === selectedSeason &&
                                        (x.episode || 1) === ep.episode)
                                  ) && (
                                    <span className="px-2 py-0.5 rounded-full bg-[#2563eb]/90 backdrop-blur-md border border-blue-300/50 text-[10px] font-extrabold text-white inline-flex items-center gap-1 shadow">
                                      <HardDriveDownload className="w-2.5 h-2.5 shrink-0" />
                                      <span>Offline</span>
                                    </span>
                                  )}
                                </div>
                                <span
                                  role="button"
                                  tabIndex={-1}
                                  data-ep-watched-toggle="true"
                                  title={
                                    isWatched
                                      ? tr(
                                          'Marcat văzut (apasă pentru a anula)',
                                          'Watched (click to unmark)',
                                          'Просмотрено (снять)'
                                        )
                                      : tr(
                                          'Marchează episodul văzut',
                                          'Mark episode watched',
                                          'Отметить серию просмотренной'
                                        )
                                  }
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleToggleWatchedStatus(
                                      activeVodItem,
                                      selectedSeason,
                                      ep.episode
                                    );
                                  }}
                                  className={`absolute top-2.5 right-2.5 z-20 inline-flex items-center justify-center rounded-full transition-all cursor-pointer shadow-lg ${
                                    isWatched
                                      ? 'w-7 h-7 bg-emerald-600/95 hover:bg-emerald-500 text-white border border-emerald-300/70'
                                      : 'w-7 h-7 bg-black/75 hover:bg-emerald-600 text-zinc-200 hover:text-white border border-white/25 opacity-0 group-hover:opacity-100 max-md:opacity-90'
                                  }`}
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
                                </span>
                                <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between gap-2">
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/95 text-zinc-950 text-[11px] font-extrabold shadow">
                                    <span>
                                      {epProg &&
                                        epProg.currentTime > 10 &&
                                        epPct < 92
                                        ? formatWatchSeconds(epProg.currentTime)
                                        : tr('Redă', 'Play', 'Смотреть')}
                                    </span>
                                  </span>
                                  {epDate && (
                                    <span className="text-[10px] font-bold text-zinc-300 bg-black/60 px-2 py-0.5 rounded-full">
                                      {epDate}
                                    </span>
                                  )}
                                </div>
                                {epPct > 0 && (
                                  <div className="absolute inset-x-0 bottom-0 z-20 h-1.5 bg-black/60">
                                    <div
                                      className="h-full bg-gradient-to-r from-[#1e3a8a] to-[#2563eb]"
                                      style={{ width: `${epPct}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                              <div className="p-3 flex-1 flex flex-col justify-between gap-1">
                                <div className="text-xs sm:text-sm font-extrabold truncate">
                                  {hasCustomTitle
                                    ? `${ep.episode}. ${ep.name}`
                                    : epLabel}
                                </div>
                                {epSynopsis ? (
                                  <p className="text-[11px] text-zinc-300 group-focus:text-zinc-700 line-clamp-2 leading-snug font-normal">
                                    {epSynopsis}
                                  </p>
                                ) : (
                                  <p className="text-[11px] text-zinc-400 group-focus:text-zinc-600 truncate font-medium">
                                    {detailedMeta?.name || activeVodItem.name} •{' '}
                                    {tr(
                                      `Sezonul ${selectedSeason}${seasonYearsMap.get(selectedSeason) ? ` (${seasonYearsMap.get(selectedSeason)})` : ""}`,
                                      `Season ${selectedSeason}${seasonYearsMap.get(selectedSeason) ? ` (${seasonYearsMap.get(selectedSeason)})` : ""}`,
                                      `Сезон ${selectedSeason}${seasonYearsMap.get(selectedSeason) ? ` (${seasonYearsMap.get(selectedSeason)})` : ""}`
                                    )}
                                  </p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                {/* Cast & Actors Section (Photos, Roles, Short Biographies + Click Actor for Full Bio, Movies & TV Series) */}
                <CastCardsSection
                  castList={castMembers}
                  isLoading={isCastLoading}
                  uiLang={uiLang}
                  onSelectActor={(actor) => setSelectedActor(actor)}
                />

                {/* Related Movies / Trilogy / Universe / Series Suggestions Section below Actors */}
                <RelatedVodSuggestionsSection
                  vodId={
                    activeVodItem.id.startsWith('tt')
                      ? activeVodItem.id
                      : detailedMeta?.imdbId || activeVodItem.id
                  }
                  kpId={activeVodItem.kpId || detailedMeta?.kpId}
                  type={activeVodItem.type}
                  name={detailedMeta?.name || activeVodItem.name}
                  nameOriginal={
                    detailedMeta?.nameOriginal || activeVodItem.nameOriginal
                  }
                  genres={detailedMeta?.genres || activeVodItem.genres}
                  director={
                    detailedMeta?.director ||
                    castMembers
                      .filter((c) => c.professionKey === 'DIRECTOR')
                      .map((c) => c.nameEn || c.name)
                  }
                  cast={
                    detailedMeta?.cast ||
                    castMembers
                      .filter((c) => c.professionKey !== 'DIRECTOR')
                      .slice(0, 4)
                      .map((c) => c.nameEn || c.name)
                  }
                  uiLang={uiLang}
                  onSelectVodItem={(sug) =>
                    handleOpenVod(
                      {
                        id: sug.id,
                        kpId: sug.kpId,
                        type: sug.type,
                        name: sug.name,
                        nameOriginal: sug.nameOriginal,
                        releaseInfo: sug.releaseInfo,
                        imdbRating: sug.imdbRating,
                        poster: sug.poster,
                      },
                      false
                    )
                  }
                />
              </div>
            ) : (
              <>
                {/* SECTION 0A: LAMPA MAIN PAGE ("Главная" — Mixed Series, Movies, Newly Added 2025-2026, Cartoons & Top IMDb) */}
                {section === 'home' && (
                  <div className="space-y-8 pb-16">
                    {isVodLoading ? (
                      <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
                        <Loader2 className="w-10 h-10 text-white animate-spin" />
                        <span className="text-sm font-medium">
                          {tr(
                            'Se încarcă Acasă (Filme, Seriale, Noutăți)...',
                            'Loading Home (Movies, TV Series, New Releases)...',
                            'Загрузка Главная (Фильмы, Сериалы, Новинки)...'
                          )}
                        </span>
                      </div>
                    ) : (
                      <>
                        {/* NETFLIX-STYLE WIDESCREEN HERO BILLBOARD BANNER (Zero-flicker crossfade, strict height containment & zero page re-renders) */}
                        {!isMobilePhone && heroBillboardItems.length > 0 && (
                          <HomeHeroBillboard
                            heroBillboardItems={heroBillboardItems}
                            isCarMode={isCarMode}
                            uiLang={uiLang}
                            tr={tr}
                            handleFocusVodItem={handleFocusVodItem}
                            handleCardPlayKey={handleCardPlayKey}
                            handleOpenVod={handleOpenVod}
                            spotlightMetaCacheRef={spotlightMetaCacheRef}
                          />
                        )}

                        {/* Optional Shelf 0: Continuă vizionarea (doar titlurile nefinalizate; cele văzute rămân în Istoric) */}
                        {continueWatchingList.length > 0 && (
                          <div className="space-y-3.5">
                            <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                              {tr(
                                `Continuă vizionarea — ${activeProfile.name} (${continueWatchingList.length})`,
                                `Continue Watching for ${activeProfile.name} (${continueWatchingList.length})`,
                                `Продолжить просмотр — ${activeProfile.name} (${continueWatchingList.length})`
                              )}
                            </h2>
                            <div className="flex items-start gap-3 sm:gap-4 overflow-x-auto pt-2 pb-4 px-3 -mx-3 no-scrollbar scroll-smooth">
                              {continueWatchingList.map((entry) => {
                                const item = entry.item;
                                const isLiveCard = false;
                                const devLabel =
                                  sanitizeDeviceName(entry.deviceName) || 'TV';
                                const posterUrl = resolveSafeVodPosterUrl(item);
                                return (
                                  <div
                                    key={`home_hist_${item.id}`}
                                    className="flex w-[145px] sm:w-[175px] md:w-[195px] shrink-0 flex-col gap-2"
                                  >
                                    <button
                                      type="button"
                                      data-watched-poster-btn="true"
                                      data-vod-card="true"
                                      data-vod-id={item.id}
                                      onFocus={(e) => {
                                        handleFocusVodItem(item);
                                        const container = e.currentTarget.closest('.overflow-x-auto') as HTMLElement | null;
                                        if (container) {
                                          const cardRect = e.currentTarget.getBoundingClientRect();
                                          const contRect = container.getBoundingClientRect();
                                          const targetScroll = container.scrollLeft + (cardRect.left - contRect.left) - (contRect.width / 2 - cardRect.width / 2);
                                          container.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
                                        }
                                      }}
                                      onMouseEnter={() => handleFocusVodItem(item)}
                                      onKeyDown={(e) => handleCardPlayKey(e, item, entry.season, entry.episode)}
                                      onClick={() => handleOpenVod(item, false, entry.season, entry.episode)}
                                      className="group w-full block text-left focus:outline-none cursor-pointer flex-1"
                                    >
                                      <div
                                        className={`aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden transition-all duration-200 group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] ${isLiveCard
                                          ? 'ring-2 ring-blue-400 shadow-[0_0_28px_rgba(37, 99, 235,0.42)]'
                                          : 'shadow-lg'
                                          }`}
                                      >
                                        <img
                                          src={posterUrl}
                                          alt={item.name}
                                          loading="lazy"
                                          onError={(e) => handleVodPosterImgError(e, item)}
                                          className="absolute inset-0 w-full h-full object-cover"
                                        />
                                        {!isLiveCard && (
                                          <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 pointer-events-none">
                                            <VodCardProducerBadge item={item} />
                                          </div>
                                        )}
                                        {isLiveCard && (
                                          <div className="absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded-md bg-zinc-950/90 border border-blue-400/75 backdrop-blur-md shadow-[0_2px_12px_rgba(0,0,0,0.7)] inline-flex items-center gap-1.5 max-w-[66%]">
                                            <span className="relative flex h-2 w-2 shrink-0">
                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-90" />
                                              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
                                            </span>
                                            <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wide text-[#60a5fa] truncate">
                                              {tr(
                                                `RULEAZĂ • ${devLabel}`,
                                                `LIVE • ${devLabel}`,
                                                `СМОТРЯТ • ${devLabel}`
                                              )}
                                            </span>
                                          </div>
                                        )}
                                        {(() => {
                                          const rInfo = getVodCardRatingInfo(item);
                                          return (
                                            <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 pointer-events-none">
                                              <span className="px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-sm border border-white/15 text-white text-[10px] font-extrabold tracking-tight shadow inline-flex items-center gap-1">
                                                <span className={rInfo.isRussian ? 'text-[#ff5500]' : 'text-amber-400'}>
                                                  {rInfo.source}
                                                </span>
                                                <span>{rInfo.value}</span>
                                              </span>
                                              <span
                                                className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider shadow whitespace-nowrap truncate ${item.type === 'series'
                                                  ? 'bg-[#172554]/95 text-white border border-[#2563eb]/50'
                                                  : 'bg-amber-500/90 text-zinc-950'
                                                  }`}
                                              >
                                                {item.type === 'series'
                                                  ? `S${entry.season || 1}:E${entry.episode || 1}`
                                                  : tr('FILM', 'MOVIE', 'ФИЛЬМ')}
                                              </span>
                                            </div>
                                          );
                                        })()}
                                        {renderPosterProgressOverlay(
                                          entry,
                                          isLiveCard
                                        )}
                                        <VodPosterWatchedControl
                                          item={item}
                                          entry={entry}
                                          stats={seriesEpStatsMap[item.id] || (item.imdbId ? seriesEpStatsMap[item.imdbId] : undefined)}
                                          onToggleWatched={handleToggleWatchedStatus}
                                          tr={tr}
                                          positionClass="top-9 left-2.5"
                                        />
                                      </div>
                                      <div className="mt-2 px-0.5">
                                        <div
                                          className={`text-sm sm:text-[15px] leading-snug line-clamp-1 ${isLiveCard
                                            ? 'font-bold text-[#60a5fa] group-focus:text-white'
                                            : 'font-normal text-zinc-100 group-focus:text-white'
                                            }`}
                                        >
                                          {item.name}
                                        </div>
                                        <div className="text-xs text-zinc-400 mt-0.5 flex items-center justify-between gap-1">
                                          <span>{formatSeriesCardSubtitleText(item, seriesEpStatsMap[item.id], tr)}</span>
                                          {isLiveCard && (
                                            <span className="text-[11px] font-bold text-blue-400 truncate">
                                              ● {devLabel}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Shelf 1: Сейчас смотрят — Фильмы и Сериалы (Mixed Movies & Series — Clean posters without Continue Watching overlay) */}
                        {homeShelves.watchingNowMix.length > 0 && (
                          <div className="space-y-3.5">
                            <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                              {tr(
                                'În tendințe acum — Filme și Seriale',
                                'Trending Now — Movies & TV Series',
                                'Сейчас смотрят — Фильмы и Сериалы'
                              )}
                            </h2>
                            <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-3 sm:gap-4">
                              {homeShelves.watchingNowMix.slice(0, 18).map((item) => {
                                const isFav = savedVodItems.some(
                                  (x) => x.id === item.id
                                );
                                const posterUrl = resolveSafeVodPosterUrl(item);
                                return (
                                  <button
                                    key={`home_watch_${item.id}`}
                                    type="button"
                                    data-vod-card="true"
                                    data-vod-id={item.id}
                                    onFocus={() => handleFocusVodItem(item)}
                                    onMouseEnter={() => handleFocusVodItem(item)}
                                    onKeyDown={(e) => handleCardPlayKey(e, item)}
                                    onClick={() => handleOpenVod(item)}
                                    className="group w-full block text-left focus:outline-none cursor-pointer"
                                  >
                                    <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                      <img
                                        src={posterUrl}
                                        alt={item.name}
                                        loading="lazy"
                                        onError={(e) => handleVodPosterImgError(e, item)}
                                        className="w-full h-full object-cover"
                                      />
                                      {(() => {
                                        const rInfo = getVodCardRatingInfo(item);
                                        return (
                                          <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 pointer-events-none">
                                            <span className="px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-sm border border-white/15 text-white text-[10px] font-extrabold tracking-tight shadow inline-flex items-center gap-1">
                                              <span className={rInfo.isRussian ? 'text-[#ff5500]' : 'text-amber-400'}>
                                                {rInfo.source}
                                              </span>
                                              <span>{rInfo.value}</span>
                                            </span>
                                            <span
                                              className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider shadow whitespace-nowrap truncate ${item.type === 'series'
                                                ? 'bg-[#172554]/95 text-white border border-[#2563eb]/50'
                                                : 'bg-amber-500/90 text-zinc-950'
                                                }`}
                                            >
                                              {item.type === 'series'
                                                ? formatSeriesCardBadgeText(item, seriesEpStatsMap[item.id], tr)
                                                : tr('FILM', 'MOVIE', 'ФИЛЬМ')}
                                            </span>
                                          </div>
                                        );
                                      })()}
                                      <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 pointer-events-none">
                                        <VodCardProducerBadge item={item} />
                                      </div>
                                      <span role="button" tabIndex={-1} data-fav-btn="true"
                                        title={
                                          isFav
                                            ? tr('Elimină din favorite (🔴 / F)', 'Remove from favorites (🔴 / F)', 'Удалить из избранного (🔴 / F)')
                                            : tr('Adaugă la favorite (🔴 / F)', 'Add to favorites (🔴 / F)', 'Добавить в избранное (🔴 / F)')
                                        }
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          toggleSaveVodItem(item);
                                        }}
                                        className={`absolute bottom-2.5 right-2.5 z-20 p-2 rounded-full backdrop-blur-md border transition-all cursor-pointer shadow-lg ${
                                          isFav
                                            ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-400 opacity-100 scale-100'
                                            : 'bg-black/60 hover:bg-black/90 text-zinc-300 hover:text-white border-white/20 opacity-0 group-hover:opacity-100 group-focus:opacity-100 focus:opacity-100 max-md:opacity-85'
                                        }`}
                                      >
                                        <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-white text-white' : ''}`} />
                                      </span>
                                      <VodPosterWatchedControl
                                        item={item}
                                        entry={findWatchProgressEntry(watchProgressMap, item)}
                                        stats={seriesEpStatsMap[item.id] || (item.imdbId ? seriesEpStatsMap[item.imdbId] : undefined)}
                                        onToggleWatched={handleToggleWatchedStatus}
                                        tr={tr}
                                      />
                                    </div>
                                    <div className="mt-2.5 px-0.5 h-[58px] flex flex-col justify-start overflow-hidden">
                                      <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2 h-[40px] flex items-start">
                                        {item.name}
                                      </div>
                                      <div className="text-xs text-zinc-400 mt-0.5 h-[16px] truncate">
                                        {formatSeriesCardSubtitleText(item, seriesEpStatsMap[item.id], tr)}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Shelf 2: Новинки 2026 — Недавно добавленные (Newly Added Movies & Series) */}
                        {homeShelves.newlyAddedMix.length > 0 && (
                          <div className="space-y-3.5 pt-1">
                            <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                              {tr(
                                'Noutăți 2026 — Adăugate recent (Filme și Seriale)',
                                'New Releases 2026 — Recently Added (Movies & Series)',
                                'Новинки 2026 — Недавно добавленные (Фильмы и Сериалы)'
                              )}
                            </h2>
                            <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-3 sm:gap-4">
                              {homeShelves.newlyAddedMix.slice(0, 18).map((item) => {
                                const isFav = savedVodItems.some(
                                  (x) => x.id === item.id
                                );
                                const posterUrl = resolveSafeVodPosterUrl(item);
                                return (
                                  <button
                                    key={`home_new_${item.id}`}
                                    type="button"
                                    data-vod-card="true"
                                    data-vod-id={item.id}
                                    onFocus={() => handleFocusVodItem(item)}
                                    onMouseEnter={() => handleFocusVodItem(item)}
                                    onKeyDown={(e) => handleCardPlayKey(e, item)}
                                    onClick={() => handleOpenVod(item)}
                                    className="group w-full block text-left focus:outline-none cursor-pointer"
                                  >
                                    <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                      <img
                                        src={posterUrl}
                                        alt={item.name}
                                        loading="lazy"
                                        onError={(e) => handleVodPosterImgError(e, item)}
                                        className="w-full h-full object-cover"
                                      />
                                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-[#1e3a8a] text-white text-[9px] font-extrabold uppercase tracking-wider shadow whitespace-nowrap truncate">
                                        NEW
                                      </span>
                                      {(() => {
                                        const rInfo = getVodCardRatingInfo(item);
                                        return (
                                          <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 pointer-events-none">
                                            <span className="px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-sm border border-white/15 text-white text-[10px] font-extrabold tracking-tight shadow inline-flex items-center gap-1">
                                              <span className={rInfo.isRussian ? 'text-[#ff5500]' : 'text-amber-400'}>
                                                {rInfo.source}
                                              </span>
                                              <span>{rInfo.value}</span>
                                            </span>
                                            <span
                                              className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider shadow whitespace-nowrap truncate ${item.type === 'series'
                                                ? 'bg-[#172554]/95 text-white border border-[#2563eb]/50'
                                                : 'bg-amber-500/90 text-zinc-950'
                                                }`}
                                            >
                                              {item.type === 'series'
                                                ? formatSeriesCardBadgeText(item, seriesEpStatsMap[item.id], tr)
                                                : tr('FILM', 'MOVIE', 'ФИЛЬМ')}
                                            </span>
                                          </div>
                                        );
                                      })()}
                                      {isFav && (
                                        <span className="absolute top-9 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-rose-500 text-xs font-bold">
                                          </span>
                                      )}
                                      <VodPosterWatchedControl
                                        item={item}
                                        entry={findWatchProgressEntry(watchProgressMap, item)}
                                        stats={seriesEpStatsMap[item.id] || (item.imdbId ? seriesEpStatsMap[item.imdbId] : undefined)}
                                        onToggleWatched={handleToggleWatchedStatus}
                                        tr={tr}
                                      />
                                    </div>
                                    <div className="mt-2.5 px-0.5 h-[58px] flex flex-col justify-start overflow-hidden">
                                      <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2 h-[40px] flex items-start">
                                        {item.name}
                                      </div>
                                      <div className="text-xs text-zinc-400 mt-0.5 h-[16px] truncate">
                                        {formatSeriesCardSubtitleText(item, seriesEpStatsMap[item.id], tr)}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Shelf 3: Популярные сериалы (Popular TV Series) */}
                        {homeShelves.popularSeries.length > 0 && (
                          <div className="space-y-3.5 pt-1">
                            <div className="flex items-center justify-between gap-3">
                              <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                                {tr(
                                  'Seriale Populare',
                                  'Popular TV Series',
                                  'Популярные сериалы'
                                )}
                              </h2>
                              <button
                                type="button"
                                onClick={() => setSection('series')}
                                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-xs font-semibold text-zinc-200 transition-colors cursor-pointer"
                              >
                                {tr(
                                  'Toate serialele →',
                                  'All TV Series →',
                                  'Все сериалы →'
                                )}
                              </button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-3 sm:gap-4">
                              {homeShelves.popularSeries.slice(0, 18).map((item) => {
                                const isFav = savedVodItems.some(
                                  (x) => x.id === item.id
                                );
                                const posterUrl = resolveSafeVodPosterUrl(item);
                                return (
                                  <button
                                    key={`home_ser_${item.id}`}
                                    type="button"
                                    data-vod-card="true"
                                    data-vod-id={item.id}
                                    onFocus={() => handleFocusVodItem(item)}
                                    onMouseEnter={() => handleFocusVodItem(item)}
                                    onKeyDown={(e) => handleCardPlayKey(e, item)}
                                    onClick={() => handleOpenVod(item)}
                                    className="group w-full block text-left focus:outline-none cursor-pointer"
                                  >
                                    <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                      <img
                                        src={posterUrl}
                                        alt={item.name}
                                        loading="lazy"
                                        onError={(e) => handleVodPosterImgError(e, item)}
                                        className="w-full h-full object-cover"
                                      />
                                      {(() => {
                                        const rInfo = getVodCardRatingInfo(item);
                                        return (
                                          <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 pointer-events-none">
                                            <span className="px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-sm border border-white/15 text-white text-[10px] font-extrabold tracking-tight shadow inline-flex items-center gap-1">
                                              <span className={rInfo.isRussian ? 'text-[#ff5500]' : 'text-amber-400'}>
                                                {rInfo.source}
                                              </span>
                                              <span>{rInfo.value}</span>
                                            </span>
                                            <span className="px-2 py-0.5 rounded-md bg-[#172554]/95 text-white border border-[#2563eb]/50 text-[9px] font-extrabold uppercase tracking-wider shadow whitespace-nowrap truncate">
                                              {formatSeriesCardBadgeText(item, seriesEpStatsMap[item.id], tr)}
                                            </span>
                                          </div>
                                        );
                                      })()}
                                      <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 pointer-events-none">
                                        <VodCardProducerBadge item={item} />
                                      </div>
                                      <span role="button" tabIndex={-1} data-fav-btn="true"
                                        title={
                                          isFav
                                            ? tr('Elimină din favorite (🔴 / F)', 'Remove from favorites (🔴 / F)', 'Удалить из избранного (🔴 / F)')
                                            : tr('Adaugă la favorite (🔴 / F)', 'Add to favorites (🔴 / F)', 'Добавить в избранное (🔴 / F)')
                                        }
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          toggleSaveVodItem(item);
                                        }}
                                        className={`absolute bottom-2.5 right-2.5 z-20 p-2 rounded-full backdrop-blur-md border transition-all cursor-pointer shadow-lg ${
                                          isFav
                                            ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-400 opacity-100 scale-100'
                                            : 'bg-black/60 hover:bg-black/90 text-zinc-300 hover:text-white border-white/20 opacity-0 group-hover:opacity-100 group-focus:opacity-100 focus:opacity-100 max-md:opacity-85'
                                        }`}
                                      >
                                        <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-white text-white' : ''}`} />
                                      </span>
                                      <VodPosterWatchedControl
                                        item={item}
                                        entry={findWatchProgressEntry(watchProgressMap, item)}
                                        stats={seriesEpStatsMap[item.id] || (item.imdbId ? seriesEpStatsMap[item.imdbId] : undefined)}
                                        onToggleWatched={handleToggleWatchedStatus}
                                        tr={tr}
                                      />
                                    </div>
                                    <div className="mt-2.5 px-0.5 h-[58px] flex flex-col justify-start overflow-hidden">
                                      <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2 h-[40px] flex items-start">
                                        {item.name}
                                      </div>
                                      <div className="text-xs text-zinc-400 mt-0.5 h-[16px] truncate">
                                        {formatSeriesCardSubtitleText(item, seriesEpStatsMap[item.id], tr)}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Shelf 4: Популярные фильмы (Popular Movies) */}
                        {homeShelves.popularMovies.length > 0 && (
                          <div className="space-y-3.5 pt-1">
                            <div className="flex items-center justify-between gap-3">
                              <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                                {tr(
                                  'Filme Populare',
                                  'Popular Movies',
                                  'Популярные фильмы'
                                )}
                              </h2>
                              <button
                                type="button"
                                onClick={() => setSection('movies')}
                                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-xs font-semibold text-zinc-200 transition-colors cursor-pointer"
                              >
                                {tr(
                                  'Toate filmele →',
                                  'All Movies →',
                                  'Все фильмы →'
                                )}
                              </button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-3 sm:gap-4">
                              {homeShelves.popularMovies.slice(0, 18).map((item) => {
                                const isFav = savedVodItems.some(
                                  (x) => x.id === item.id
                                );
                                const posterUrl = resolveSafeVodPosterUrl(item);
                                return (
                                  <button
                                    key={`home_mov_${item.id}`}
                                    type="button"
                                    data-vod-card="true"
                                    data-vod-id={item.id}
                                    onFocus={() => handleFocusVodItem(item)}
                                    onMouseEnter={() => handleFocusVodItem(item)}
                                    onKeyDown={(e) => handleCardPlayKey(e, item)}
                                    onClick={() => handleOpenVod(item)}
                                    className="group w-full block text-left focus:outline-none cursor-pointer"
                                  >
                                    <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                      <img
                                        src={posterUrl}
                                        alt={item.name}
                                        loading="lazy"
                                        onError={(e) => handleVodPosterImgError(e, item)}
                                        className="w-full h-full object-cover"
                                      />
                                      {(() => {
                                        const rInfo = getVodCardRatingInfo(item);
                                        return (
                                          <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 pointer-events-none">
                                            <span className="px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-sm border border-white/15 text-white text-[10px] font-extrabold tracking-tight shadow inline-flex items-center gap-1">
                                              <span className={rInfo.isRussian ? 'text-[#ff5500]' : 'text-amber-400'}>
                                                {rInfo.source}
                                              </span>
                                              <span>{rInfo.value}</span>
                                            </span>
                                            <span className="px-2 py-0.5 rounded-md bg-amber-500/90 text-zinc-950 text-[9px] font-extrabold uppercase tracking-wider shadow whitespace-nowrap truncate">
                                              {tr('FILM', 'MOVIE', 'ФИЛЬМ')}
                                            </span>
                                          </div>
                                        );
                                      })()}
                                      <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 pointer-events-none">
                                        <VodCardProducerBadge item={item} />
                                      </div>
                                      <span role="button" tabIndex={-1} data-fav-btn="true"
                                        title={
                                          isFav
                                            ? tr('Elimină din favorite (🔴 / F)', 'Remove from favorites (🔴 / F)', 'Удалить из избранного (🔴 / F)')
                                            : tr('Adaugă la favorite (🔴 / F)', 'Add to favorites (🔴 / F)', 'Добавить в избранное (🔴 / F)')
                                        }
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          toggleSaveVodItem(item);
                                        }}
                                        className={`absolute bottom-2.5 right-2.5 z-20 p-2 rounded-full backdrop-blur-md border transition-all cursor-pointer shadow-lg ${
                                          isFav
                                            ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-400 opacity-100 scale-100'
                                            : 'bg-black/60 hover:bg-black/90 text-zinc-300 hover:text-white border-white/20 opacity-0 group-hover:opacity-100 group-focus:opacity-100 focus:opacity-100 max-md:opacity-85'
                                        }`}
                                      >
                                        <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-white text-white' : ''}`} />
                                      </span>
                                      <VodPosterWatchedControl
                                        item={item}
                                        entry={findWatchProgressEntry(watchProgressMap, item)}
                                        stats={seriesEpStatsMap[item.id] || (item.imdbId ? seriesEpStatsMap[item.imdbId] : undefined)}
                                        onToggleWatched={handleToggleWatchedStatus}
                                        tr={tr}
                                      />
                                    </div>
                                    <div className="mt-2.5 px-0.5 h-[58px] flex flex-col justify-start overflow-hidden">
                                      <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2 h-[40px] flex items-start">
                                        {item.name}
                                      </div>
                                      <div className="text-xs text-zinc-400 mt-0.5 h-[16px] truncate">
                                        {formatSeriesCardSubtitleText(item, seriesEpStatsMap[item.id], tr)}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Shelf 5: Мультфильмы и Анимация (Cartoons & Animation) */}
                        {homeShelves.cartoons.length > 0 && (
                          <div className="space-y-3.5 pt-1">
                            <div className="flex items-center justify-between gap-3">
                              <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                                {tr(
                                  'Desene Animate & Animație',
                                  'Cartoons & Animation',
                                  'Мультфильмы и Анимация'
                                )}
                              </h2>
                              <button
                                type="button"
                                onClick={() => setSection('cartoons')}
                                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-xs font-semibold text-zinc-200 transition-colors cursor-pointer"
                              >
                                {tr(
                                  'Toate desenele →',
                                  'All Cartoons →',
                                  'Все мультфильмы →'
                                )}
                              </button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-3 sm:gap-4">
                              {homeShelves.cartoons.slice(0, 18).map((item) => {
                                const isFav = savedVodItems.some(
                                  (x) => x.id === item.id
                                );
                                const posterUrl = resolveSafeVodPosterUrl(item);
                                return (
                                  <button
                                    key={`home_cart_${item.id}`}
                                    type="button"
                                    data-vod-card="true"
                                    data-vod-id={item.id}
                                    onFocus={() => handleFocusVodItem(item)}
                                    onMouseEnter={() => handleFocusVodItem(item)}
                                    onKeyDown={(e) => handleCardPlayKey(e, item)}
                                    onClick={() => handleOpenVod(item)}
                                    className="group w-full block text-left focus:outline-none cursor-pointer"
                                  >
                                    <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                      <img
                                        src={posterUrl}
                                        alt={item.name}
                                        loading="lazy"
                                        onError={(e) => handleVodPosterImgError(e, item)}
                                        className="w-full h-full object-cover"
                                      />
                                      {(() => {
                                        const rInfo = getVodCardRatingInfo(item);
                                        return (
                                          <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 pointer-events-none">
                                            <span className="px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-sm border border-white/15 text-white text-[10px] font-extrabold tracking-tight shadow inline-flex items-center gap-1">
                                              <span className={rInfo.isRussian ? 'text-[#ff5500]' : 'text-amber-400'}>
                                                {rInfo.source}
                                              </span>
                                              <span>{rInfo.value}</span>
                                            </span>
                                            <span className="px-2 py-0.5 rounded-md bg-sky-500/90 text-zinc-950 text-[9px] font-extrabold uppercase tracking-wider shadow whitespace-nowrap truncate">
                                              {tr('ANIMAȚIE', 'CARTOON', 'МУЛЬТ')}
                                            </span>
                                          </div>
                                        );
                                      })()}
                                      <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 pointer-events-none">
                                        <VodCardProducerBadge item={item} />
                                      </div>
                                      <span role="button" tabIndex={-1} data-fav-btn="true"
                                        title={
                                          isFav
                                            ? tr('Elimină din favorite (🔴 / F)', 'Remove from favorites (🔴 / F)', 'Удалить из избранного (🔴 / F)')
                                            : tr('Adaugă la favorite (🔴 / F)', 'Add to favorites (🔴 / F)', 'Добавить в избранное (🔴 / F)')
                                        }
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          toggleSaveVodItem(item);
                                        }}
                                        className={`absolute bottom-2.5 right-2.5 z-20 p-2 rounded-full backdrop-blur-md border transition-all cursor-pointer shadow-lg ${
                                          isFav
                                            ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-400 opacity-100 scale-100'
                                            : 'bg-black/60 hover:bg-black/90 text-zinc-300 hover:text-white border-white/20 opacity-0 group-hover:opacity-100 group-focus:opacity-100 focus:opacity-100 max-md:opacity-85'
                                        }`}
                                      >
                                        <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-white text-white' : ''}`} />
                                      </span>
                                      <VodPosterWatchedControl
                                        item={item}
                                        entry={findWatchProgressEntry(watchProgressMap, item)}
                                        stats={seriesEpStatsMap[item.id] || (item.imdbId ? seriesEpStatsMap[item.imdbId] : undefined)}
                                        onToggleWatched={handleToggleWatchedStatus}
                                        tr={tr}
                                      />
                                    </div>
                                    <div className="mt-2.5 px-0.5 h-[58px] flex flex-col justify-start overflow-hidden">
                                      <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2 h-[40px] flex items-start">
                                        {item.name}
                                      </div>
                                      <div className="text-xs text-zinc-400 mt-0.5 h-[16px] truncate">
                                        {item.releaseInfo || '2026'} •{' '}
                                        {tr('Animație', 'Cartoon', 'Мультфильм')}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Shelf 6: Рекомендуем посмотреть — Топ IMDb (Фильмы и Сериалы) */}
                        {vodItems.length > 0 && (
                          <div className="space-y-3.5 pt-2">
                            <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                              {tr(
                                'Recomandate — Top IMDb (Filme și Seriale)',
                                'Recommended — Top Rated on IMDb (Movies & Series)',
                                'Рекомендуем посмотреть — Топ IMDb (Фильмы и Сериалы)'
                              )}
                            </h2>
                            <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-x-3 sm:gap-x-4 gap-y-5 sm:gap-y-6">
                              {vodItems.slice(0, 24).map((item) => {
                                const isFav = savedVodItems.some(
                                  (x) => x.id === item.id
                                );
                                const posterUrl = resolveSafeVodPosterUrl(item);
                                return (
                                  <button
                                    key={`home_rec_${item.id}`}
                                    type="button"
                                    data-vod-card="true"
                                    data-vod-id={item.id}
                                    onFocus={() => handleFocusVodItem(item)}
                                    onMouseEnter={() => handleFocusVodItem(item)}
                                    onKeyDown={(e) => handleCardPlayKey(e, item)}
                                    onClick={() => handleOpenVod(item)}
                                    className="group w-full block text-left focus:outline-none cursor-pointer"
                                  >
                                    <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                      <img
                                        src={posterUrl}
                                        alt={item.name}
                                        loading="lazy"
                                        onError={(e) => handleVodPosterImgError(e, item)}
                                        className="w-full h-full object-cover"
                                      />
                                      {(() => {
                                        const rInfo = getVodCardRatingInfo(item);
                                        return (
                                          <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 pointer-events-none">
                                            <span className="px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-sm border border-white/15 text-white text-[10px] font-extrabold tracking-tight shadow inline-flex items-center gap-1">
                                              <span className={rInfo.isRussian ? 'text-[#ff5500]' : 'text-amber-400'}>
                                                {rInfo.source}
                                              </span>
                                              <span>{rInfo.value}</span>
                                            </span>
                                            <span
                                              className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider shadow whitespace-nowrap truncate ${item.type === 'series'
                                                ? 'bg-[#172554]/95 text-white border border-[#2563eb]/50'
                                                : 'bg-amber-500/90 text-zinc-950'
                                                }`}
                                            >
                                              {item.type === 'series'
                                                ? formatSeriesCardBadgeText(item, seriesEpStatsMap[item.id], tr)
                                                : tr('FILM', 'MOVIE', 'ФИЛЬМ')}
                                            </span>
                                          </div>
                                        );
                                      })()}
                                      <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 pointer-events-none">
                                        <VodCardProducerBadge item={item} />
                                      </div>
                                      <span role="button" tabIndex={-1} data-fav-btn="true"
                                        title={
                                          isFav
                                            ? tr('Elimină din favorite (🔴 / F)', 'Remove from favorites (🔴 / F)', 'Удалить из избранного (🔴 / F)')
                                            : tr('Adaugă la favorite (🔴 / F)', 'Add to favorites (🔴 / F)', 'Добавить в избранное (🔴 / F)')
                                        }
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          toggleSaveVodItem(item);
                                        }}
                                        className={`absolute bottom-2.5 right-2.5 z-20 p-2 rounded-full backdrop-blur-md border transition-all cursor-pointer shadow-lg ${
                                          isFav
                                            ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-400 opacity-100 scale-100'
                                            : 'bg-black/60 hover:bg-black/90 text-zinc-300 hover:text-white border-white/20 opacity-0 group-hover:opacity-100 group-focus:opacity-100 focus:opacity-100 max-md:opacity-85'
                                        }`}
                                      >
                                        <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-white text-white' : ''}`} />
                                      </span>
                                      <VodPosterWatchedControl
                                        item={item}
                                        entry={findWatchProgressEntry(watchProgressMap, item)}
                                        stats={seriesEpStatsMap[item.id] || (item.imdbId ? seriesEpStatsMap[item.imdbId] : undefined)}
                                        onToggleWatched={handleToggleWatchedStatus}
                                        tr={tr}
                                      />
                                    </div>
                                    <div className="mt-2.5 px-0.5 h-[58px] flex flex-col justify-start overflow-hidden">
                                      <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2 h-[40px] flex items-start">
                                        {item.name}
                                      </div>
                                      <div className="text-xs text-zinc-400 mt-0.5 h-[16px] truncate">
                                        {formatSeriesCardSubtitleText(item, seriesEpStatsMap[item.id], tr)}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {hasMoreVod && (
                          <div className="pt-4 flex justify-center">
                            <button
                              type="button"
                              disabled={isLoadingMoreVod}
                              onClick={() => {
                                const next = vodPage + 1;
                                setVodPage(next);
                                void fetchVodCatalog(next, true);
                              }}
                              className="h-11 px-8 rounded-xl bg-gradient-to-r from-[#d4d4d4] via-[#ffffff] to-[#c8c8c8] text-[#141414] focus:outline-none focus:ring-4 focus:ring-white font-semibold text-sm inline-flex items-center gap-2 shadow-lg cursor-pointer"
                            >
                              {isLoadingMoreVod ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  {tr('Se încarcă...', 'Loading...', 'Загрузка...')}
                                </>
                              ) : (
                                <>
                                  {tr(
                                    'Afișează mai multe (Filme și Seriale)',
                                    'Load More (Movies & TV Series)',
                                    'Показать ещё (Фильмы и Сериалы)'
                                  )}
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {section === 'iedem_vod' &&
                  !isPinLockRequired &&
                  canProfileAccessIedem(activeProfile) && (
                    <IedemMediatekaSection
                      key="kinozal_tab"
                      uiLang={uiLang}
                      onOpenVodItem={handleOpenVod}
                    />
                  )}

                {section === 'ru_shows' &&
                  !isPinLockRequired &&
                  canProfileAccessIedem(activeProfile) && (
                    <IedemMediatekaSection
                      key="ru_shows_tab"
                      uiLang={uiLang}
                      initialCategoryId="tvshows_ru"
                      dedicatedShowsMode
                      onOpenVodItem={handleOpenVod}
                    />
                  )}

                {section === 'adult_18' &&
                  !isPinLockRequired &&
                  isAdminJekaProfile(activeProfile) && (
                    <SmartTvAdult18Section
                      tr={tr}
                      uiLang={uiLang}
                      savedVodItems={savedVodItems}
                      watchProgressMap={watchProgressMap}
                      adult18HistoryList={adult18HistoryList}
                      seriesEpStatsMap={seriesEpStatsMap}
                      renderPosterProgressOverlay={renderPosterProgressOverlay}
                      onFocusVodItem={handleFocusVodItem}
                      onOpenVodItem={handleOpenVod}
                      onCardPlayKey={handleCardPlayKey}
                      onToggleWatched={handleToggleWatchedStatus}
                      onRemoveHistoryItem={handleRemoveWatchProgressItem}
                      onClearAdult18History={handleClearAdult18History}
                    />
                  )}

                {section === 'music' && (
                  <SmartTvMusicSpotifySection
                    tr={tr}
                    currentTrack={currentMusicTrack}
                    isPlaying={isMusicPlaying}
                    elapsedSec={musicElapsedSec}
                    durationSec={musicDurationSec}
                    volume={musicVolume}
                    isMuted={isMusicMuted}
                    isShuffle={isMusicShuffle}
                    isRepeat={isMusicRepeat}
                    queue={musicQueue}
                    onUpdateQueue={handleUpdateMusicQueue}
                    likedTracks={likedMusicTracks}
                    recentTracksProp={recentMusicTracks}
                    onRecordRecentTrack={() => {}}
                    externalSearchRequest={pendingMusicQuery}
                    onPlayTrack={handlePlayMusicTrack}
                    onTogglePlayPause={handleToggleMusicPlayPause}
                    onNextTrack={handleNextMusicTrack}
                    onPrevTrack={handlePrevMusicTrack}
                    onSeek={handleSeekMusic}
                    onToggleShuffle={() => setIsMusicShuffle((v) => !v)}
                    onToggleRepeat={() => setIsMusicRepeat((v) => !v)}
                    onToggleLikeTrack={handleToggleLikeMusicTrack}
                    onChangeVolume={handleChangeMusicVolume}
                    onToggleMute={handleToggleMusicMute}
                    onCloseMusic={handleStopAndCloseMusic}
                  />
                )}

                {section === 'calendar' && (
                  <SmartTvSeriesCalendarSection
                    tr={tr}
                    uiLang={uiLang}
                    activeProfileName={activeProfile.name}
                    savedVodItems={savedVodItems}
                    watchProgressMap={watchProgressMap}
                    onOpenVodEpisode={(item, autoPlay, seasonNum, episodeNum) =>
                      handleOpenVod(item, autoPlay, seasonNum, episodeNum)
                    }
                    onToggleSaveVodItem={toggleSaveVodItem}
                    onNavigateToSection={setSection}
                  />
                )}

                {section === 'downloads' && (() => {
                  // Group downloaded items by series/movie cleanVodId so a series appears as ONE SINGLE CARD
                  const groupsMap = new Map<
                    string,
                    {
                      cleanVodId: string;
                      title: string;
                      poster: string;
                      backdrop: string;
                      overview: string;
                      releaseYear: string;
                      rating: string;
                      isSeries: boolean;
                      qualityLabel: string;
                      totalBytes: number;
                      latestCreatedAt: number;
                      items: OfflineMediaItem[];
                    }
                  >();

                  const canSeeAdultOffline = !isPinLockRequired && isAdminJekaProfile(activeProfile);
                  const visibleOfflineItems = offlineItems.filter((it) => {
                    if (it.isAdult18 && !canSeeAdultOffline) return false;
                    if (it.profileId && it.profileId !== activeProfileId) return false;
                    return true;
                  });
                  for (const item of visibleOfflineItems) {
                    const cleanVodId =
                      item.vodId ||
                      item.id.replace(/^vod_/, '').replace(/_S\d+E\d+$/, '');
                    const isSeries =
                      item.mediaKind === 'series' || Boolean(item.season);
                    const existing = groupsMap.get(cleanVodId);
                    if (existing) {
                      existing.items.push(item);
                      existing.totalBytes += item.sizeBytes || 0;
                      existing.latestCreatedAt = Math.max(
                        existing.latestCreatedAt,
                        item.createdAt || 0
                      );
                      if (!existing.poster && item.poster) existing.poster = item.poster;
                      if (!existing.backdrop && item.backdrop) existing.backdrop = item.backdrop;
                      if (!existing.overview && item.overview) existing.overview = item.overview;
                      if (!existing.releaseYear && item.releaseYear) existing.releaseYear = item.releaseYear;
                      if (!existing.rating && item.rating) existing.rating = item.rating;
                    } else {
                      groupsMap.set(cleanVodId, {
                        cleanVodId,
                        title: item.title,
                        poster: item.poster || '',
                        backdrop: item.backdrop || '',
                        overview: item.overview || '',
                        releaseYear: item.releaseYear || '',
                        rating: item.rating || '',
                        isSeries,
                        qualityLabel: item.qualityLabel || 'HD',
                        totalBytes: item.sizeBytes || 0,
                        latestCreatedAt: item.createdAt || 0,
                        items: [item],
                      });
                    }
                  }

                  const groupedList = Array.from(groupsMap.values())
                    .map((g) => ({
                      ...g,
                      items: [...g.items].sort((a, b) => {
                        const sDiff = (a.season || 1) - (b.season || 1);
                        if (sDiff !== 0) return sDiff;
                        return (a.episode || 1) - (b.episode || 1);
                      }),
                    }))
                    .sort((a, b) => b.latestCreatedAt - a.latestCreatedAt);

                  const movieGroups = groupedList.filter((g) => !g.isSeries);
                  const seriesGroups = groupedList.filter((g) => g.isSeries);
                  const totalVideoBytes = offlineItems.reduce(
                    (acc, it) => acc + (it.sizeBytes || 0),
                    0
                  );
                  const totalAllBytes =
                    totalVideoBytes + (offlineMusicState.totalBytes || 0);
                  const compactQualityTag = (raw: string): string => {
                    if (/1080|full hd/i.test(raw)) return '1080p';
                    if (/720/i.test(raw)) return '720p';
                    if (/480/i.test(raw)) return '480p';
                    if (/360/i.test(raw)) return '360p';
                    if (/4k|2160/i.test(raw)) return '4K';
                    return 'HD';
                  };

                  const buildVodItemFromOfflineGroup = (
                    group: (typeof groupedList)[number]
                  ): CinemetaItem => ({
                    id: group.cleanVodId,
                    name: group.title,
                    type: group.isSeries ? 'series' : 'movie',
                    poster: group.poster || undefined,
                    background: group.backdrop || group.poster || undefined,
                    description: group.overview || undefined,
                    releaseInfo: group.releaseYear || undefined,
                    imdbRating: group.rating || undefined,
                  });

                  const renderAppleOfflineVodCard = (
                    group: (typeof groupedList)[number]
                  ) => {
                    const vodCardItem = buildVodItemFromOfflineGroup(group);
                    const progEntry = findWatchProgressEntry(
                      watchProgressMap,
                      vodCardItem
                    );
                    const firstItem = group.items[0];
                    // Resume smart episode: prefer last watched downloaded episode, else first unwatched downloaded episode, else first downloaded
                    const targetEpItem = group.isSeries
                      ? group.items.find(
                          (it) =>
                            progEntry?.season === (it.season || 1) &&
                            progEntry?.episode === (it.episode || 1)
                        ) ||
                        group.items.find((it) => {
                          const epP =
                            progEntry?.episodeProgressMap?.[
                              `S${it.season || 1}E${it.episode || 1}`
                            ];
                          return !isEpisodeProgressWatched(epP);
                        }) ||
                        firstItem
                      : firstItem;
                    const targetSeasonNum = targetEpItem?.season || 1;
                    const targetEpisodeNum = targetEpItem?.episode || 1;
                    const watchPct = (() => {
                      if (!progEntry) return 0;
                      if (group.isSeries) {
                        const epP =
                          progEntry.episodeProgressMap?.[
                            `S${targetSeasonNum}E${targetEpisodeNum}`
                          ];
                        if (epP?.duration && epP.duration > 30) {
                          return Math.min(
                            100,
                            Math.round((epP.currentTime / epP.duration) * 100)
                          );
                        }
                        return 0;
                      }
                      if (progEntry.duration && progEntry.duration > 30) {
                        return Math.min(
                          100,
                          Math.round((progEntry.currentTime / progEntry.duration) * 100)
                        );
                      }
                      return 0;
                    })();
                    const isMovieWatched = !group.isSeries && watchPct >= 88;
                    const qBadge = compactQualityTag(group.qualityLabel);
                    const seasonNumbers = Array.from(
                      new Set(group.items.map((it) => it.season || 1))
                    ).sort((a, b) => a - b);
                    const subtitleLine = group.isSeries
                      ? `${
                          seasonNumbers.length > 1
                            ? `${seasonNumbers.length} sez.`
                            : `Sezonul ${seasonNumbers[0] || 1}`
                        } • ${group.items.length} ep. • ${formatBytes(group.totalBytes)}`
                      : `${qBadge}${group.releaseYear ? ` • ${group.releaseYear}` : ''} • ${formatBytes(group.totalBytes)}`;

                    return (
                      <article
                        key={`dl_group_${group.cleanVodId}`}
                        data-vod-card="true"
                        className="group relative flex flex-col max-w-[225px] w-full focus-within:outline-none"
                      >
                        <div className="aspect-[2/3] w-full rounded-2xl bg-[#161b26] relative overflow-hidden shadow-[0_14px_34px_rgba(0,0,0,0.55)] ring-1 ring-white/10 group-hover:ring-2 group-hover:ring-white/80 group-focus-within:ring-4 group-focus-within:ring-white group-hover:-translate-y-0.5 transition-all duration-200">
                          {group.poster ? (
                            <img
                              src={group.poster}
                              alt={group.title}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1b2438] to-[#0b0f18] text-zinc-500">
                              <Film className="w-10 h-10 opacity-40" />
                            </div>
                          )}

                          {/* Subtle Apple cinematic bottom vignette */}
                          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />

                          {/* Top-Left: Crisp Apple Offline Badge */}
                          <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none flex items-center gap-1">
                            <span className="px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-md border border-blue-400/45 text-blue-200 text-[10px] font-extrabold tracking-tight inline-flex items-center gap-1 shadow">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                              <span>Offline</span>
                            </span>
                          </div>

                          {/* Top-Right: Filmio Type/Episode Pill OR Apple Edit-Mode Delete Button */}
                          {isDownloadsEditMode ? (
                            <button
                              type="button"
                              title={tr('Șterge din descărcate', 'Remove download', 'Удалить')}
                              aria-label={tr('Șterge din descărcate', 'Remove download', 'Удалить')}
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                for (const it of group.items) {
                                  await deleteOfflineItem(it.id);
                                }
                                await refreshOfflineLibrary();
                              }}
                              className="absolute top-2 right-2 z-30 h-8 w-8 rounded-full bg-rose-600/95 hover:bg-rose-500 text-white border border-white/30 inline-flex items-center justify-center cursor-pointer shadow-lg transition-transform active:scale-95"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none flex items-center gap-1">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shadow ${
                                  group.isSeries
                                    ? 'bg-[#172554]/95 text-white border border-[#3b82f6]/55'
                                    : 'bg-black/80 backdrop-blur-md text-zinc-100 border border-white/15'
                                }`}
                              >
                                {group.isSeries
                                  ? `${group.items.length} EP.`
                                  : qBadge}
                              </span>
                            </div>
                          )}

                          {/* Bottom Quick-Play Circle (elevated independent button) + Watched indicator */}
                          {!isDownloadsEditMode && (
                            <div className="absolute bottom-2.5 inset-x-2.5 z-20 flex items-center justify-between gap-2 pointer-events-none">
                              <button
                                type="button"
                                title={tr('Redă instant offline', 'Play offline now', 'Смотреть офлайн')}
                                aria-label={tr('Redă instant offline', 'Play offline now', 'Смотреть офлайн')}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleOpenVod(
                                    vodCardItem,
                                    true,
                                    targetSeasonNum,
                                    targetEpisodeNum
                                  );
                                }}
                                className="pointer-events-auto h-9 w-9 rounded-full bg-white/92 hover:bg-white text-zinc-950 shadow-[0_6px_18px_rgba(0,0,0,0.55)] inline-flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-95 transition-all cursor-pointer active:scale-95"
                              >
                                <Play className="w-4 h-4 fill-current ml-0.5" />
                              </button>

                              {isMovieWatched ? (
                                <span
                                  title={tr('Văzut', 'Watched', 'Просмотрено')}
                                  aria-label={tr('Văzut', 'Watched', 'Просмотрено')}
                                  className="w-6 h-6 rounded-full bg-emerald-600/95 border border-emerald-300/70 text-white inline-flex items-center justify-center shadow"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
                                </span>
                              ) : group.rating ? (
                                <span className="px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/15 text-amber-300 text-[10px] font-extrabold tabular-nums">
                                  ★ {group.rating}
                                </span>
                              ) : null}
                            </div>
                          )}

                          {/* Subtle Apple Watch Progress Bar */}
                          {watchPct > 2 && watchPct < 92 && (
                            <div className="absolute inset-x-0 bottom-0 z-20 h-1 bg-white/20 pointer-events-none">
                              <div
                                className="h-full bg-white"
                                style={{ width: `${watchPct}%` }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Stretched Primary Card Trigger: Opens the EXACT SAME Movie / Series Detail Experience as all other pages! */}
                        <button
                          type="button"
                          onFocus={() => handleFocusVodItem(vodCardItem)}
                          onMouseEnter={() => handleFocusVodItem(vodCardItem)}
                          onClick={() =>
                            handleOpenVod(
                              vodCardItem,
                              false,
                              targetSeasonNum,
                              targetEpisodeNum
                            )
                          }
                          className="mt-2.5 px-0.5 text-left focus:outline-none cursor-pointer after:content-[''] after:absolute after:inset-0 after:z-10"
                        >
                          <div className="text-sm sm:text-[15px] font-semibold text-zinc-100 group-hover:text-white group-focus-within:text-white leading-snug line-clamp-2">
                            {group.title}
                          </div>
                          <div className="text-xs text-zinc-400 mt-0.5 truncate tabular-nums">
                            {subtitleLine}
                          </div>
                        </button>
                      </article>
                    );
                  };

                  const showMoviesSection =
                    (downloadsFilterTab === 'all' ||
                      downloadsFilterTab === 'movies') &&
                    movieGroups.length > 0;
                  const showSeriesSection =
                    (downloadsFilterTab === 'all' ||
                      downloadsFilterTab === 'series') &&
                    seriesGroups.length > 0;
                  const showMusicSection =
                    (downloadsFilterTab === 'all' ||
                      downloadsFilterTab === 'music') &&
                    offlineMusicState.recordsCount > 0;

                  const filterOptions: Array<{
                    id: 'all' | 'movies' | 'series' | 'music';
                    label: string;
                    count: number;
                  }> = [
                    {
                      id: 'all',
                      label: tr('Toate', 'All', 'Все'),
                      count: groupedList.length + (offlineMusicState.recordsCount > 0 ? 1 : 0),
                    },
                    ...(movieGroups.length > 0
                      ? [
                          {
                            id: 'movies' as const,
                            label: tr('Filme', 'Movies', 'Фильмы'),
                            count: movieGroups.length,
                          },
                        ]
                      : []),
                    ...(seriesGroups.length > 0
                      ? [
                          {
                            id: 'series' as const,
                            label: tr('Seriale', 'Series', 'Сериалы'),
                            count: seriesGroups.length,
                          },
                        ]
                      : []),
                    ...(offlineMusicState.recordsCount > 0
                      ? [
                          {
                            id: 'music' as const,
                            label: tr('Muzică', 'Music', 'Музыка'),
                            count: offlineMusicState.recordsCount,
                          },
                        ]
                      : []),
                  ];

                  return (
                    <div className="space-y-7 pb-24">
                      {/* Apple TV+ / Tahoe Editorial Header + Segmented Filter Control */}
                      <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-5">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <div className="space-y-1">
                            <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
                              {tr('Descărcate', 'Downloads', 'Загрузки')}
                            </h1>
                            <p className="text-xs sm:text-sm text-zinc-400 font-medium tabular-nums">
                              {groupedList.length > 0 || offlineMusicState.recordsCount > 0
                                ? tr(
                                    `${groupedList.length} ${groupedList.length === 1 ? 'titlu video' : 'titluri video'}${offlineMusicState.recordsCount > 0 ? ` • ${offlineMusicState.recordsCount} piese` : ''} • ${formatBytes(totalAllBytes)} pe dispozitiv`,
                                    `${groupedList.length} video ${groupedList.length === 1 ? 'title' : 'titles'}${offlineMusicState.recordsCount > 0 ? ` • ${offlineMusicState.recordsCount} tracks` : ''} • ${formatBytes(totalAllBytes)} on device`,
                                    `${groupedList.length} видео${offlineMusicState.recordsCount > 0 ? ` • ${offlineMusicState.recordsCount} треков` : ''} • ${formatBytes(totalAllBytes)} на устройстве`
                                  )
                                : tr(
                                    'Filmele, serialele și muzica salvate pentru redare fără internet',
                                    'Movies, series and music saved for offline playback',
                                    'Фильмы, сериалы и музыка для просмотра без интернета'
                                  )}
                            </p>
                          </div>

                          {(groupedList.length > 0 || offlineMusicState.recordsCount > 0) && (
                            <div className="flex items-center gap-2">
                              {isDownloadsEditMode && offlineItems.length > 0 && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    for (const it of offlineItems) {
                                      await deleteOfflineItem(it.id);
                                    }
                                    setIsDownloadsEditMode(false);
                                    await refreshOfflineLibrary();
                                  }}
                                  className="h-9 px-3.5 rounded-full bg-rose-600/20 hover:bg-rose-600/35 text-rose-200 border border-rose-500/40 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>{tr('Șterge video', 'Clear videos', 'Удалить видео')}</span>
                                </button>
                              )}
                              {groupedList.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setIsDownloadsEditMode((v) => !v)}
                                  className={`h-9 px-4 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                                    isDownloadsEditMode
                                      ? 'bg-white text-zinc-950 border-white'
                                      : 'bg-white/[0.07] hover:bg-white/[0.14] text-zinc-100 border-white/12'
                                  }`}
                                >
                                  {isDownloadsEditMode
                                    ? tr('Gata', 'Done', 'Готово')
                                    : tr('Editează', 'Edit', 'Изменить')}
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {filterOptions.length > 2 && (
                          <div
                            role="tablist"
                            aria-label={tr('Filtrează descărcările', 'Filter downloads', 'Фильтр загрузок')}
                            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-full bg-white/[0.06] border border-white/10 w-fit"
                          >
                            {filterOptions.map((tab) => {
                              const isActive = downloadsFilterTab === tab.id;
                              return (
                                <button
                                  key={tab.id}
                                  type="button"
                                  role="tab"
                                  aria-selected={isActive}
                                  onClick={() => setDownloadsFilterTab(tab.id)}
                                  className={`h-8 px-3.5 rounded-full text-xs font-semibold border border-transparent transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                                    isActive
                                      ? 'bg-white text-zinc-950 shadow-sm'
                                      : 'text-zinc-300 hover:text-white hover:bg-white/[0.06]'
                                  }`}
                                >
                                  <span>{tab.label}</span>
                                  {tab.id !== 'all' && (
                                    <span
                                      className={`text-[10px] tabular-nums ${
                                        isActive ? 'text-zinc-600' : 'text-zinc-500'
                                      }`}
                                    >
                                      {tab.count}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Active Background Download Card (Apple Liquid Glass) */}
                      {activeDownloadProgress && (
                        <div className="p-4 sm:p-5 rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-blue-400/30 shadow-[0_14px_40px_rgba(0,0,0,0.45)] space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-2xl bg-blue-500/20 border border-blue-400/35 flex items-center justify-center shrink-0">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-300" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-white truncate">
                                    {activeDownloadProgress.title ||
                                      offlineVideoDl.activeTitle ||
                                      activeDownloadTargetId ||
                                      'Descărcare'}
                                  </span>
                                  {offlineVideoDl.queueCount > 0 && (
                                    <span className="px-2 py-0.5 rounded-full bg-blue-500/25 border border-blue-400/35 text-[10px] font-bold text-blue-200 shrink-0 tabular-nums">
                                      +{offlineVideoDl.queueCount}{' '}
                                      {tr('în coadă', 'queued', 'в очереди')}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-zinc-400 truncate tabular-nums">
                                  {activeDownloadProgress.stage ||
                                    tr('Se descarcă în fundal...', 'Downloading in background...', 'Загрузка...')}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs sm:text-sm font-semibold text-blue-300 tabular-nums">
                                {activeDownloadProgress.percent}% •{' '}
                                {formatBytes(activeDownloadProgress.downloadedBytes)}
                              </span>
                              <button
                                type="button"
                                onClick={handleCancelOfflineDownload}
                                className="h-8 px-3.5 rounded-full bg-white/10 hover:bg-rose-600/85 text-zinc-100 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                              >
                                {tr('Oprește', 'Stop', 'Стоп')}
                              </button>
                            </div>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              style={{ width: `${Math.max(2, activeDownloadProgress.percent)}%` }}
                              className="h-full bg-gradient-to-r from-[#2563eb] to-[#60a5fa] rounded-full transition-all duration-200"
                            />
                          </div>
                        </div>
                      )}

                      {/* Empty State (Apple Minimalist Glass) */}
                      {groupedList.length === 0 && offlineMusicState.recordsCount === 0 && !activeDownloadProgress && (
                        <div className="py-16 px-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] text-center space-y-3">
                          <div className="w-16 h-16 rounded-3xl bg-white/[0.06] border border-white/10 flex items-center justify-center mx-auto">
                            <HardDriveDownload className="w-8 h-8 text-zinc-400" />
                          </div>
                          <div className="text-lg sm:text-xl font-bold text-white tracking-tight">
                            {tr(
                              'Nicio descărcare încă',
                              'No Downloads Yet',
                              'Пока нет загрузок'
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
                            {tr(
                              'Deschide orice film sau serial și apasă butonul de descărcare. Titlurile salvate vor apărea aici ca în bibliotecă, gata de vizionat fără internet.',
                              'Open any movie or series and tap Download. Saved titles appear here with the exact same library card experience, ready offline.',
                              'Откройте любой фильм или сериал и нажмите «Скачать».'
                            )}
                          </p>
                        </div>
                      )}

                      {/* MOVIES SECTION (Identical Apple TV+ Cinema Poster Grid) */}
                      {showMoviesSection && (
                        <section className="space-y-4">
                          <div className="flex items-center justify-between gap-2">
                            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                              <span>{tr('Filme', 'Movies', 'Фильмы')}</span>
                              <span className="text-sm font-medium text-zinc-500 tabular-nums">
                                {movieGroups.length}
                              </span>
                            </h2>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
                            {movieGroups.map((group) => renderAppleOfflineVodCard(group))}
                          </div>
                        </section>
                      )}

                      {/* SERIES SECTION (Identical Apple TV+ Cinema Poster Grid) */}
                      {showSeriesSection && (
                        <section className="space-y-4">
                          <div className="flex items-center justify-between gap-2">
                            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                              <span>{tr('Seriale', 'Series', 'Сериалы')}</span>
                              <span className="text-sm font-medium text-zinc-500 tabular-nums">
                                {seriesGroups.length}
                              </span>
                            </h2>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
                            {seriesGroups.map((group) => renderAppleOfflineVodCard(group))}
                          </div>
                        </section>
                      )}

                      {/* OFFLINE MUSIC SHELF (Apple Music Glass Card) */}
                      {showMusicSection && (
                        <section className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                              <span>{tr('Muzică Offline', 'Offline Music', 'Музыка офлайн')}</span>
                              <span className="text-sm font-medium text-zinc-500 tabular-nums">
                                {offlineMusicState.recordsCount}
                              </span>
                            </h2>
                          </div>
                          <div className="p-4 sm:p-5 rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 shadow-[0_14px_38px_rgba(0,0,0,0.45)] space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-11 h-11 rounded-2xl bg-[#1e3a8a]/40 border border-[#60a5fa]/35 flex items-center justify-center shrink-0">
                                  <OfflineDownloadedBadgeIcon className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm sm:text-base font-semibold text-white truncate">
                                    {tr(
                                      `${offlineMusicState.recordsCount} piese salvate`,
                                      `${offlineMusicState.recordsCount} saved tracks`,
                                      `${offlineMusicState.recordsCount} треков`
                                    )}
                                  </div>
                                  <p className="text-xs text-zinc-400 font-medium truncate tabular-nums">
                                    {formatOfflineMusicBytes(offlineMusicState.totalBytes)} •{' '}
                                    {tr(
                                      'Disponibile fără internet',
                                      'Ready without internet',
                                      'Доступно без интернета'
                                    )}
                                  </p>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const tracks = offlineMusicState.recordsList.map((r) => r.track);
                                    if (tracks[0]) {
                                      handlePlayMusicTrack(tracks[0], tracks);
                                    }
                                  }}
                                  className="h-9 px-4 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                  <span>{tr('Redă', 'Play', 'Слушать')}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    try {
                                      window.sessionStorage.setItem('filmio_open_music_offline', '1');
                                    } catch {
                                      // ignore
                                    }
                                    setSection('music');
                                    window.setTimeout(() => {
                                      window.dispatchEvent(new CustomEvent('filmio:open-music-offline-view'));
                                    }, 80);
                                  }}
                                  className="h-9 px-4 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                                >
                                  <Music className="w-3.5 h-3.5 text-blue-400" />
                                  <span>{tr('Deschide în Muzică', 'Open in Music', 'Открыть в Музыке')}</span>
                                </button>

                                {isDownloadsEditMode && (
                                  <button
                                    type="button"
                                    title={tr('Șterge muzica offline', 'Clear offline music', 'Удалить музыку')}
                                    onClick={() => void clearAllOfflineMusic()}
                                    className="h-9 w-9 rounded-full bg-rose-600/25 hover:bg-rose-600/45 border border-rose-500/40 text-rose-200 inline-flex items-center justify-center cursor-pointer transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {offlineMusicState.recordsList.slice(0, 6).map((rec) => (
                                <button
                                  key={rec.offlineKey}
                                  type="button"
                                  onClick={() =>
                                    handlePlayMusicTrack(
                                      rec.track,
                                      offlineMusicState.recordsList.map((r) => r.track)
                                    )
                                  }
                                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] flex items-center gap-2.5 text-left transition-colors cursor-pointer"
                                >
                                  <img
                                    src={rec.track.coverSmall || rec.track.cover}
                                    alt=""
                                    className="w-9 h-9 rounded-lg object-cover shrink-0 bg-zinc-900"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-semibold text-white truncate">
                                      {rec.track.title}
                                    </div>
                                    <div className="text-[11px] text-zinc-400 truncate">
                                      {rec.track.artist}
                                    </div>
                                  </div>
                                  <OfflineDownloadedBadgeIcon className="w-3.5 h-3.5 shrink-0" />
                                </button>
                              ))}
                            </div>
                          </div>
                        </section>
                      )}
                    </div>
                  );
                })()}

                <SmartTvCatalogSections
                  section={section}
                  imdbMediaType={imdbMediaType}
                  setImdbMediaType={setImdbMediaType}
                  imdbYear={imdbYear}
                  setImdbYear={setImdbYear}
                  imdbGenre={imdbGenre}
                  setImdbGenre={setImdbGenre}
                  watchProgressMap={watchProgressMap}
                  platformMediaTab={platformMediaTab}
                  setPlatformMediaTab={setPlatformMediaTab}
                  tr={tr}
                  isVodLoading={isVodLoading}
                  vodItems={vodItems}
                  savedVodItems={savedVodItems}
                  toggleSaveVodItem={toggleSaveVodItem}
                  handleToggleWatchedStatus={handleToggleWatchedStatus}
                  isPinLockRequired={isPinLockRequired}
                  handleFocusVodItem={handleFocusVodItem}
                  handleOpenVod={handleOpenVod}
                  hasMoreVod={hasMoreVod}
                  isLoadingMoreVod={isLoadingMoreVod}
                  vodPage={vodPage}
                  setVodPage={setVodPage}
                  fetchVodCatalog={fetchVodCatalog}
                  setIsCatalogDrawerOpen={setIsCatalogDrawerOpen}
                  setFilterSubMenu={setFilterSubMenu}
                  setIsFilterDrawerOpen={setIsFilterDrawerOpen}
                  originCountry={originCountry}
                  tvSearchInputRef={tvSearchInputRef}
                  tvSearchQuery={tvSearchQuery}
                  setTvSearchQuery={setTvSearchQuery}
                  setIsTvKeyboardOpen={setIsTvKeyboardOpen}
                  isTvKeyboardOpen={isTvKeyboardOpen}
                  setKeyboardAlphabet={setKeyboardAlphabet}
                  keyboardAlphabet={keyboardAlphabet}
                  adultContentEnabled={adultContentEnabled}
                  tvRegionId={tvRegionId}
                  setTvRegionId={setTvRegionId}
                  setTvCategoryId={setTvCategoryId}
                  favoriteTvChannels={favoriteTvChannels}
                  customTvChannels={customTvChannels}
                  tvCategoryId={tvCategoryId}
                  isTvLoading={isTvLoading}
                  tvChannels={tvChannels}
                  playTvChannel={playTvChannel}
                  toggleFavoriteTvChannel={toggleFavoriteTvChannel}
                  currentStation={currentStation}
                  radioStations={radioStations}
                  favorites={favorites}
                  playerStatus={playerStatus}
                  activeRadioTrack={activeRadioTrack}
                  isMuted={isMuted}
                  volume={volume}
                  playStation={playStation}
                  setIsTvRadioPlayerOpen={setIsTvRadioPlayerOpen}
                  nowPlayingTitle={nowPlayingTitle}
                  playPreviousStation={playPreviousStation}
                  stopRadio={stopRadio}
                  playNextAvailableStation={playNextAvailableStation}
                  toggleFavorite={toggleFavorite}
                  toggleMute={toggleMute}
                  setVolume={setVolume}
                  radioSearchInputRef={radioSearchInputRef}
                  radioSearchQuery={radioSearchQuery}
                  setRadioSearchQuery={setRadioSearchQuery}
                  setIsRadioKeyboardOpen={setIsRadioKeyboardOpen}
                  isRadioKeyboardOpen={isRadioKeyboardOpen}
                  radioCountry={radioCountry}
                  setRadioCountry={setRadioCountry}
                  isRadioLoading={isRadioLoading}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  setFlSearchQuery={setFlSearchQuery}
                  setSection={setSection}
                  requestTvFullscreen={requestTvFullscreen}
                  isSearchLoading={isSearchLoading}
                  searchResults={searchResults}
                  ytCategory={ytCategory}
                  ytSearchQuery={ytSearchQuery}
                  setYtSearchQuery={setYtSearchQuery}
                  setYtCategory={setYtCategory}
                  setIsYtKeyboardOpen={setIsYtKeyboardOpen}
                  isYtKeyboardOpen={isYtKeyboardOpen}
                  isYtLoading={isYtLoading}
                  ytItems={ytItems}
                  handlePlayYouTubeVideo={handlePlayYouTubeVideo}
                  flCategory={flCategory}
                  flSearchQuery={flSearchQuery}
                  setFlCategory={setFlCategory}
                  setFlSort={setFlSort}
                  flSort={flSort}
                  setIsFlKeyboardOpen={setIsFlKeyboardOpen}
                  isFlKeyboardOpen={isFlKeyboardOpen}
                  isFlLoading={isFlLoading}
                  flItems={flItems}
                  activeProfile={activeProfile}
                  historyList={historyList}
                  handleClearAllWatchProgress={handleClearAllWatchProgress}
                  handleRemoveWatchProgressItem={handleRemoveWatchProgressItem}
                  renderPosterProgressOverlay={renderPosterProgressOverlay}
                  likedMusicTracks={likedMusicTracks}
                  currentMusicTrack={currentMusicTrack}
                  isMusicPlaying={isMusicPlaying}
                  handlePlayMusicTrack={handlePlayMusicTrack}
                  handleToggleMusicPlayPause={handleToggleMusicPlayPause}
                  handleToggleLikeMusicTrack={handleToggleLikeMusicTrack}
                  seriesEpStatsMap={seriesEpStatsMap}
                />
              </>
            )}
          </main>
        </div>
      </div>

      {/* MOBILE FLOATING FACEBOOK-STYLE CAPSULE NAVIGATION BAR (Auto-hides on scroll down, reappears on scroll up) */}
      {!isAnyFullModePlayer && (
        <>
          <div
            aria-hidden="true"
            className={`${isMobilePhone ? 'block' : 'md:hidden'} pointer-events-none absolute inset-x-0 bottom-0 transition-opacity duration-300 ${isMobileChromeHidden && !isSidebarOpen ? 'opacity-0' : 'opacity-100'} ${section === 'music' && !activeVodItem ? (!isPortraitViewport ? 'h-24 via-[#080b12]/95' : 'h-28 via-[#080b12]/95') : 'h-16 via-[#080b12]/90'} z-30 bg-gradient-to-t from-black to-transparent`}
          />
          <nav
          aria-label="Navigare Mobilă"
          style={{
            bottom: 'max(8px, calc(var(--safe-bottom, env(safe-area-inset-bottom, 0px)) * 0.65 + 4px))',
          }}
          className={`${isMobilePhone ? 'block' : 'md:hidden'} absolute left-3 right-3 ${isMobilePhone && !isPortraitViewport ? 'max-w-sm' : 'max-w-md'} mx-auto ${isSidebarOpen ? 'z-[47]' : 'z-40'} select-none transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
            isMobileChromeHidden && !isSidebarOpen
              ? 'translate-y-[calc(100%+24px)] opacity-0 pointer-events-none'
              : 'translate-y-0 opacity-100 pointer-events-auto'
          }`}
        >
          <div className={`${isMobilePhone && !isPortraitViewport ? 'h-[46px] p-[3px]' : 'h-[54px] p-1.5'} w-full rounded-full bg-[#1c1e24]/95 border border-white/[0.14] shadow-[0_12px_36px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.1)] flex items-center justify-between gap-1`}>
            {(
              [
                {
                  id: 'home',
                  label: tr('Acasă', 'Home', 'Главная'),
                  Icon: Home,
                },
                {
                  id: 'tv',
                  label: tr('TV Live', 'Live TV', 'ТВ'),
                  Icon: Monitor,
                },
                {
                  id: 'movies',
                  label: tr('Filme/Seriale', 'Movies/Series', 'Кино/Сериалы'),
                  Icon: Clapperboard,
                },
                {
                  id: 'radio',
                  label: tr('Radio', 'Radio', 'Радио'),
                  Icon: Radio,
                },
                {
                  id: 'music',
                  label: tr('Muzică', 'Music', 'Музыка'),
                  Icon: Music,
                },
              ] as const
            ).map(({ id, label, Icon }) => {
              const isActive =
                (id === 'movies'
                  ? section === 'movies' || section === 'series'
                  : section === id) &&
                !activeVodItem &&
                !isSidebarOpen;
              return (
                <button
                  key={`mob_nav_${id}`}
                  type="button"
                  aria-label={label}
                  title={label}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => {
                    isMobileChromeHiddenRef.current = false;
                    scrollDeltaAccumRef.current = 0;
                    lastMainScrollTopRef.current = 0;
                    setIsMobileChromeHidden(false);
                    setActiveVodItem(null);
                    setIsSidebarOpen(false);
                    setIsFilterDrawerOpen(false);
                    setIsCatalogDrawerOpen(false);
                    if (id === 'movies') {
                      setSection(section === 'series' ? 'series' : 'movies');
                    } else {
                      if (id === 'music' && section === 'music' && !activeVodItem) {
                        window.dispatchEvent(new CustomEvent('filmio:music-go-home'));
                      }
                      setSection(id);
                    }
                    const mainEl =
                      rootContainerRef.current?.querySelector<HTMLElement>('main');
                    if (mainEl) {
                      mainEl.scrollTop = 0;
                    }
                    if (id === 'tv') {
                      setTvRegionId('FAV');
                      setTvCategoryId('ALL');
                    } else if (id === 'radio') {
                      setRadioCountry('FAV');
                    }
                  }}
                  className={`flex-1 ${isMobilePhone && !isPortraitViewport ? 'h-[40px]' : 'min-h-[44px] h-[44px]'} rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer touch-manipulation ${
                    isActive
                      ? 'bg-[#32353e] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
                      : 'text-[#cfd4dc] hover:text-white active:scale-95'
                  }`}
                >
                  <Icon className={isActive ? 'w-[22px] h-[22px] stroke-[2.3]' : 'w-[21px] h-[21px] stroke-[2]'} />
                </button>
              );
            })}
            <button
              type="button"
              aria-label={tr('Meniu', 'Menu', 'Меню')}
              title={tr('Meniu', 'Menu', 'Меню')}
              aria-expanded={isSidebarOpen}
              onClick={() => {
                isMobileChromeHiddenRef.current = false;
                setIsMobileChromeHidden(false);
                setIsSidebarOpen((prev) => !prev);
              }}
              className={`flex-1 ${isMobilePhone && !isPortraitViewport ? 'h-[40px]' : 'min-h-[44px] h-[44px]'} rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer touch-manipulation ${
                isSidebarOpen
                  ? 'bg-[#32353e] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
                  : 'text-[#cfd4dc] hover:text-white active:scale-95'
              }`}
            >
              <Menu
                className={isSidebarOpen ? 'w-[22px] h-[22px] stroke-[2.3]' : 'w-[21px] h-[21px] stroke-[2]'}
                aria-hidden="true"
              />
            </button>
          </div>
          </nav>
        </>
      )}

      <SmartTvDrawersAndModals
        setVodPage={setVodPage}
        fetchVodCatalog={fetchVodCatalog}
        section={section}
        activeProfile={activeProfile}
        setEditingProfileId={setEditingProfileId}
        setIsProfilePickerOpen={setIsProfilePickerOpen}
        handleClearAllWatchProgress={handleClearAllWatchProgress}
        historyList={historyList}
        setPreferredSubLang={setPreferredSubLang}
        setSelectedAudioTrackIdx={setSelectedAudioTrackIdx}
        handleQuickSubLangSwitch={handleQuickSubLangSwitch}
        setActiveServer={setActiveServer}
        resolvedDirectStream={resolvedDirectStream}
        isFilterDrawerOpen={isFilterDrawerOpen}
        filterSubMenu={filterSubMenu}
        setFilterSubMenu={setFilterSubMenu}
        setIsFilterDrawerOpen={setIsFilterDrawerOpen}
        tr={tr}
        setSection={setSection}
        filterMediaType={filterMediaType}
        setFilterMediaType={setFilterMediaType}
        filterRating={filterRating}
        setFilterRating={setFilterRating}
        selectedGenre={selectedGenre}
        setSelectedGenre={setSelectedGenre}
        originCountry={originCountry}
        setOriginCountry={setOriginCountry}
        filterYear={filterYear}
        setFilterYear={setFilterYear}
        isCatalogDrawerOpen={isCatalogDrawerOpen}
        setIsCatalogDrawerOpen={setIsCatalogDrawerOpen}
        isSettingsDrawerOpen={isSettingsDrawerOpen}
        settingsSubMenu={settingsSubMenu}
        setSettingsSubMenu={setSettingsSubMenu}
        setIsSettingsDrawerOpen={setIsSettingsDrawerOpen}
        uiLang={uiLang}
        switchUiLang={switchUiLang}
        tvSettings={tvSettings}
        updateTvSetting={updateTvSetting}
        adultContentEnabled={adultContentEnabled}
        setAdultContentEnabled={setAdultContentEnabled}
        tvRegionId={tvRegionId}
        setTvRegionId={setTvRegionId}
        tvCategoryId={tvCategoryId}
        setTvCategoryId={setTvCategoryId}
        setTvSettings={setTvSettings}
        activeProfileId={activeProfileId}
        onExitTvMode={onExitTvMode}
        isTvRadioPlayerOpen={isTvRadioPlayerOpen}
        setIsTvRadioPlayerOpen={setIsTvRadioPlayerOpen}
        currentStation={currentStation}
        activeRadioTrack={activeRadioTrack}
        nowPlayingTitle={nowPlayingTitle}
        playPreviousStation={playPreviousStation}
        playerStatus={playerStatus}
        stopRadio={stopRadio}
        playStation={playStation}
        radioStations={radioStations}
        playNextAvailableStation={playNextAvailableStation}
        triggerStreamReload={triggerStreamReload}
        toggleFavorite={toggleFavorite}
        favorites={favorites}
        toggleMute={toggleMute}
        isMuted={isMuted}
        volume={volume}
        setVolume={setVolume}
        isTrailerModalOpen={isTrailerModalOpen}
        setIsTrailerModalOpen={setIsTrailerModalOpen}
        activeVodItem={activeVodItem}
        trailerList={trailerList}
        activeTrailerIdx={activeTrailerIdx}
        setActiveTrailerIdx={setActiveTrailerIdx}
        isLoadingTrailer={isLoadingTrailer}
        isHandoffModalOpen={isHandoffModalOpen}
        setIsHandoffModalOpen={setIsHandoffModalOpen}
        isPinLockRequired={isPinLockRequired}
        tvProfiles={tvProfiles}
        handleSelectProfile={handleSelectProfile}
        setTvProfiles={setTvProfiles}
        selectedSeason={selectedSeason}
        selectedEpisode={selectedEpisode}
        resumeStartSeconds={resumeStartSeconds}
        selectedActor={selectedActor}
        setSelectedActor={setSelectedActor}
        handleOpenVod={handleOpenVod}
        isSubFinderOpen={isSubFinderOpen}
        setIsSubFinderOpen={setIsSubFinderOpen}
        detailedMeta={detailedMeta}
        preferredSubLang={preferredSubLang}
        setActiveSubVttUrl={setActiveSubVttUrl}
        setActiveSubLabel={setActiveSubLabel}
        setActiveSubCues={setActiveSubCues}
        setUseManualOnlineSub={setUseManualOnlineSub}
      />

      {/* Persistent Spotify Music Background Audio Engine */}
      <audio
        ref={musicAudioRef}
        preload="auto"
        playsInline
        {...({
          'webkit-playsinline': 'true',
          'x-webkit-airplay': 'allow',
        } as Record<string, string>)}
        onWaiting={() => {
          scheduleMusicStallRecovery();
        }}
        onStalled={() => {
          scheduleMusicStallRecovery();
        }}
        onPlaying={() => {
          clearMusicStallTimer();
        }}
        onTimeUpdate={(e) => {
          if (activeMusicBackendRef.current !== 'audio') return;
          const ct = e.currentTarget.currentTime || 0;
          if (Math.abs(ct - lastMusicAudioTimeSecRef.current) >= 0.2) {
            lastMusicAudioTimeSecRef.current = ct;
            lastMusicAudioProgressMsRef.current = Date.now();
            clearMusicStallTimer();
            if (ct > 2) consecutiveMusicFailCountRef.current = 0;
          }
          const capDur = musicDoubleDurCapRef.current;
          if (capDur >= 45 && ct >= capDur - 0.5) {
            musicDoubleDurCapRef.current = 0;
            if (isMusicRepeatRef.current) {
              e.currentTarget.currentTime = 0;
              e.currentTarget.play().catch(() => {});
            } else {
              handleNextMusicTrackRef.current();
            }
            return;
          }
          setMusicElapsedSec(ct);
          if (Date.now() - lastMusicPosSyncMsRef.current >= 2000) {
            lastMusicPosSyncMsRef.current = Date.now();
            const dur =
              e.currentTarget.duration && Number.isFinite(e.currentTarget.duration)
                ? e.currentTarget.duration
                : musicDurationSec;
            updateMediaSessionPosition('music', ct, dur);
          }
        }}
        onLoadedMetadata={(e) => {
          if (activeMusicBackendRef.current !== 'audio') return;
          const dur = e.currentTarget.duration;
          const expDur = currentMusicTrackRef.current?.durationSec || 0;
          const curTrack = currentMusicTrackRef.current;
          if (
            !audioFallbackOnlyRef.current &&
            dur &&
            Number.isFinite(dur) &&
            dur > 0 &&
            dur < 42 &&
            expDur >= 75 &&
            curTrack
          ) {
            if (musicAudioRetryRef.current < 2) {
              musicAudioRetryRef.current += 1;
              e.currentTarget.src = buildDirectFullAudioUrl(curTrack, musicAudioRetryRef.current);
              e.currentTarget.play().catch(() => {});
              return;
            }
            e.currentTarget.pause();
            e.currentTarget.removeAttribute('src');
            startYtTrackPlayback(curTrack, 0);
            return;
          }
          if (dur && Number.isFinite(dur) && dur > 5) {
            // Safety guard for Apple Safari 2x DASH duration bug (e.g. 6:53 for a 3:27 track in Airplane Mode)
            const isDoubleCoreMediaDur =
              expDur >= 60 && dur >= expDur * 1.82 && dur <= expDur * 2.25;
            const effectiveDur = isDoubleCoreMediaDur
              ? Math.round(dur / 2)
              : dur;
            musicDoubleDurCapRef.current = isDoubleCoreMediaDur
              ? effectiveDur
              : 0;
            setMusicDurationSec(effectiveDur);
            updateMediaSessionPosition(
              'music',
              e.currentTarget.currentTime || 0,
              effectiveDur
            );
          }
        }}
        onPlay={() => {
          if (activeMusicBackendRef.current !== 'audio') return;
          lastMusicAudioProgressMsRef.current = Date.now();
          setIsMusicPlaying(true);
          updateMediaSessionPlaybackState('music', 'playing');
        }}
        onPause={() => {
          clearMusicStallTimer();
          if (activeMusicBackendRef.current !== 'audio') return;
          setIsMusicPlaying(false);
          updateMediaSessionPlaybackState('music', 'paused');
        }}
        onEnded={(e) => {
          if (activeMusicBackendRef.current !== 'audio') return;
          const ct = e.currentTarget.currentTime || 0;
          const mediaDur =
            e.currentTarget.duration && Number.isFinite(e.currentTarget.duration)
              ? e.currentTarget.duration
              : 0;
          const expDur = currentMusicTrackRef.current?.durationSec || 0;
          const curTrack = currentMusicTrackRef.current;
          if (
            !audioFallbackOnlyRef.current &&
            expDur >= 75 &&
            ct < 42 &&
            (mediaDur <= 0 || ct < mediaDur - 5) &&
            curTrack
          ) {
            if (musicAudioRetryRef.current < 2) {
              musicAudioRetryRef.current += 1;
              e.currentTarget.src = buildDirectFullAudioUrl(curTrack, musicAudioRetryRef.current);
              e.currentTarget.play().catch(() => {});
              return;
            }
            e.currentTarget.pause();
            e.currentTarget.removeAttribute('src');
            startYtTrackPlayback(curTrack, ct > 3 && ct < 40 ? ct : 0);
            return;
          }
          if (isMusicRepeatRef.current && musicAudioRef.current) {
            musicAudioRef.current.currentTime = 0;
            musicAudioRef.current.play().catch(() => {});
          } else {
            handleNextMusicTrackRef.current();
          }
        }}
        onError={(e) => {
          if (activeMusicBackendRef.current !== 'audio') return;
          const el = e.currentTarget;
          const curTrack = currentMusicTrackRef.current;
          if (!audioFallbackOnlyRef.current && curTrack) {
            if (musicAudioRetryRef.current < 2) {
              musicAudioRetryRef.current += 1;
              el.src = buildDirectFullAudioUrl(curTrack, musicAudioRetryRef.current);
              el.play().catch(() => {});
              return;
            }
            el.pause();
            el.removeAttribute('src');
            startYtTrackPlayback(curTrack, Math.floor(musicElapsedSecRef.current || 0));
            return;
          }
          // STRICT POLICY: Never fall back to 30-second previewUrl!
          consecutiveMusicFailCountRef.current += 1;
          if (
            consecutiveMusicFailCountRef.current <= 3 &&
            musicQueueRef.current.length > 1
          ) {
            handleNextMusicTrackRef.current();
            return;
          }
          activeMusicBackendRef.current = 'none';
          setIsMusicPlaying(false);
        }}
        className="hidden"
      />

      {/* Persistent Floating Background Video Download Indicator (visible across ALL pages & sections!) */}
      {(activeDownloadProgress || offlineVideoDl.lastCompletedTitle) &&
        !isDownloadModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-bg-download-pill="true"
            style={{
              bottom:
                'calc(max(12px, env(safe-area-inset-bottom, 0px)) + 70px)',
              right: 'max(12px, env(safe-area-inset-right, 0px))',
            }}
            className="fixed z-[195] max-w-[min(92vw,340px)] sm:!bottom-5 sm:!right-5 pointer-events-auto"
          >
            {activeDownloadProgress ? (
              <div className="rounded-2xl bg-[#0e1526]/95 backdrop-blur-2xl border border-blue-400/40 shadow-[0_16px_44px_rgba(0,0,0,0.82),inset_0_1px_0_rgba(255,255,255,0.14)] px-3.5 py-2.5 text-white space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveVodItem(null);
                      setSection('downloads');
                    }}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-extrabold text-white truncate">
                          {activeDownloadProgress.title || offlineVideoDl.activeTitle || 'Descărcare'}
                        </span>
                        {offlineVideoDl.queueCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-blue-500/30 border border-blue-400/40 text-[9px] font-black text-blue-200 shrink-0 tabular-nums">
                            +{offlineVideoDl.queueCount}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-semibold text-blue-200/90 truncate tabular-nums">
                        {activeDownloadProgress.percent}% • {formatBytes(activeDownloadProgress.downloadedBytes)}
                        {activeDownloadProgress.stage ? ` • ${activeDownloadProgress.stage}` : ''}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    title={tr('Oprește descărcarea', 'Stop download', 'Остановить загрузку')}
                    aria-label={tr('Oprește descărcarea', 'Stop download', 'Остановить загрузку')}
                    onClick={handleCancelOfflineDownload}
                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-rose-600/85 text-zinc-200 hover:text-white inline-flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-200"
                    style={{ width: `${Math.max(2, activeDownloadProgress.percent)}%` }}
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setActiveVodItem(null);
                  setSection('downloads');
                }}
                className="rounded-2xl bg-emerald-950/95 backdrop-blur-2xl border border-emerald-400/45 shadow-[0_14px_40px_rgba(0,0,0,0.8)] px-3.5 py-2.5 text-white flex items-center gap-2.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="min-w-0 text-left">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                    {tr('Descărcat Offline', 'Saved Offline', 'Сохранено офлайн')}
                  </div>
                  <div className="text-xs font-bold text-white truncate max-w-[240px]">
                    {offlineVideoDl.lastCompletedTitle}
                  </div>
                </div>
              </button>
            )}
          </div>,
          document.body
        )}

      {/* Subtle Apple TV+ / Tahoe Liquid-Glass Capsule Notification for Favorite Toggle */}
      {favToast && (
        <div className="fixed bottom-7 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none transition-all duration-200 animate-in fade-in slide-in-from-bottom-2">
          <div className="h-10 px-4 rounded-full bg-[#12151e]/92 backdrop-blur-2xl border border-white/[0.14] shadow-[0_14px_40px_rgba(0,0,0,0.78),inset_0_1px_0_rgba(255,255,255,0.14)] flex items-center gap-2.5 max-w-[min(90vw,440px)]">
            {favToast.kind === 'watched' ? (
              <CheckCircle2
                className={`w-4 h-4 shrink-0 ${favToast.isFav ? 'text-emerald-400' : 'text-zinc-400'}`}
              />
            ) : (
              <SfBookmarkIcon
                className={`w-4 h-4 shrink-0 ${favToast.isFav ? 'text-[#60a5fa]' : 'text-zinc-400'}`}
                filled={favToast.isFav}
              />
            )}
            <span className="text-[13px] font-semibold tracking-tight text-zinc-100 truncate">
              {favToast.message}
            </span>
          </div>
        </div>
      )}

      {/* Floating Picture-in-Picture Radio & Music MiniPlayers (outside the browser page) */}
      <RadioPipPlayer />
      <MusicPipPlayer
        track={currentMusicTrack}
        isPlaying={isMusicPlaying}
        elapsedSec={musicElapsedSec}
        durationSec={musicDurationSec}
        volume={musicVolume}
        isMuted={isMusicMuted}
        isShuffle={isMusicShuffle}
        isRepeat={isMusicRepeat}
        isLiked={Boolean(
          currentMusicTrack &&
            likedMusicTracks.some((t) => t.id === currentMusicTrack.id)
        )}
        onTogglePlayPause={handleToggleMusicPlayPause}
        onPrevTrack={handlePrevMusicTrack}
        onNextTrack={handleNextMusicTrack}
        onSeek={handleSeekMusic}
        onToggleShuffle={() => setIsMusicShuffle((v) => !v)}
        onToggleRepeat={() => setIsMusicRepeat((v) => !v)}
        onToggleLike={() => {
          if (currentMusicTrack) handleToggleLikeMusicTrack(currentMusicTrack);
        }}
        onChangeVolume={handleChangeMusicVolume}
        onToggleMute={handleToggleMusicMute}
        onRestoreNormalPlayer={() => {
          setActiveVodItem(null);
          setSection('music');
          window.dispatchEvent(new CustomEvent('filmio:open-music-song-view'));
        }}
        queueIndex={
          currentMusicTrack
            ? musicQueue.findIndex((t) => t.id === currentMusicTrack.id)
            : -1
        }
        queueTotal={musicQueue.length}
        tr={tr}
      />
    </div>
  );
};
