import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Home,
  Clapperboard,
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
  Download,
  CheckCircle2,
  HardDriveDownload,
} from 'lucide-react';
import {
  downloadHlsToOfflineDb,
  listOfflineItems,
  deleteOfflineItem,
  exportOfflineItemToDeviceFile,
  formatBytes,
  type OfflineMediaItem,
  type OfflineDownloadProgress,
} from '../services/offlineMediaService';
import { useRadioStore } from '../store/useRadioStore';
import {
  StreamingPlatformLogo,
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
  findPreferredOriginalAudioTrackIndex,
  resolveAudioTrackIndexByPreference,
  autoResolveAndFetchBestRoRuSubtitle,
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
  markProfileDeleted,
  unmarkProfileDeleted,
  normalizeProfile,
  isLocalHomeServer,
  isProfileRememberedOnDevice,
  rememberProfileOnDevice,
} from '../services/deviceContinuityService';
import { CrossDeviceHandoffModal } from '../components/tv/CrossDeviceHandoffModal';
import { TvPlayerModal } from '../components/tv/TvPlayerModal';
import { setActiveTvPlaylistContext } from '../components/tv/TvOsdChannelList';
import { RadioPipPlayer } from '../components/player/RadioPipPlayer';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

interface SmartTvLampaViewProps {
  onExitTvMode: () => void;
}

import { SmartTvDrawersAndModals } from "../components/tv/SmartTvDrawersAndModals";
import { SmartTvCatalogSections } from "../components/tv/SmartTvCatalogSections";
import { SmartTvSeriesCalendarSection } from "../components/tv/SmartTvSeriesCalendarSection";
import { IedemMediatekaSection } from "../components/tv/IedemMediatekaSection";
import { fetchIedemItemDetail } from "../services/iedemVodService";
import {
  SmartTvMusicSpotifySection,
  SpotifyTrackItem,
  INITIAL_SPOTIFY_TRACKS,
} from "../components/tv/SmartTvMusicSpotifySection";
import {
  TvSectionId,
  OriginCountryId,
  VodServerId,
  SubtitleLangId,
  CinemetaItem,
  FileListTorrentInfo,
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
  sanitizeDeviceName,
  loadWatchProgressMap,
  saveWatchProgressMap,
  loadSavedVodItems,
  saveSavedVodItems,
  buildVodEmbedUrl,
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

  const [isTvRadioPlayerOpen, setIsTvRadioPlayerOpen] =
    useState<boolean>(false);

  // ==========================================================================
  // SPOTIFY MUSIC MODULE STATE & PERSISTENT BACKGROUND AUDIO ENGINE
  // ==========================================================================
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const [currentMusicTrack, setCurrentMusicTrack] =
    useState<SpotifyTrackItem | null>(null);
  const [musicQueue, setMusicQueue] = useState<SpotifyTrackItem[]>(
    INITIAL_SPOTIFY_TRACKS
  );
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
  const [likedMusicTracks, setLikedMusicTracks] = useState<SpotifyTrackItem[]>(
    () => {
      try {
        const raw = localStorage.getItem('sc_spotify_liked_tracks_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {
        // ignore
      }
      return INITIAL_SPOTIFY_TRACKS.slice(0, 3);
    }
  );

  // If Radio Live or Live TV starts playing, stop and close Spotify Music completely so only the current source is active
  useEffect(() => {
    if (
      currentStation ||
      playerStatus === 'playing' ||
      playerStatus === 'loading' ||
      currentTvChannel
    ) {
      if (musicAudioRef.current) {
        musicAudioRef.current.pause();
        musicAudioRef.current.removeAttribute('src');
      }
      if (isMusicPlaying) {
        setIsMusicPlaying(false);
      }
      if (currentMusicTrack) {
        setCurrentMusicTrack(null);
        setMusicElapsedSec(0);
      }
    }
  }, [
    currentStation,
    playerStatus,
    currentTvChannel,
    isMusicPlaying,
    currentMusicTrack,
  ]);

  const handlePlayMusicTrack = useCallback(
    (track: SpotifyTrackItem, queueList?: SpotifyTrackItem[]) => {
      stopRadio();
      setIsTvRadioPlayerOpen(false);
      if (currentTvChannel) {
        closeTvPlayer();
      }
      if (queueList && queueList.length > 0) {
        setMusicQueue(queueList);
      }
      setCurrentMusicTrack(track);
      setMusicElapsedSec(0);
      setMusicDurationSec(track.durationSec || 200);
      setIsMusicPlaying(true);

      const audioEl = musicAudioRef.current;
      if (audioEl) {
        audioEl.src = track.fullAudioUrl;
        audioEl.volume = isMusicMuted ? 0 : musicVolume;
        audioEl.play().catch(() => {
          if (track.previewUrl && audioEl.src !== track.previewUrl) {
            audioEl.src = track.previewUrl;
            audioEl.play().catch(() => { });
          }
        });
      }
    },
    [stopRadio, currentTvChannel, closeTvPlayer, isMusicMuted, musicVolume]
  );

  const handleToggleMusicPlayPause = useCallback(() => {
    const audioEl = musicAudioRef.current;
    if (!audioEl) return;
    if (!currentMusicTrack) {
      handlePlayMusicTrack(INITIAL_SPOTIFY_TRACKS[0], INITIAL_SPOTIFY_TRACKS);
      return;
    }
    if (audioEl.paused) {
      stopRadio();
      setIsTvRadioPlayerOpen(false);
      if (currentTvChannel) {
        closeTvPlayer();
      }
      audioEl.play().catch(() => { });
      setIsMusicPlaying(true);
    } else {
      audioEl.pause();
      setIsMusicPlaying(false);
    }
  }, [
    currentMusicTrack,
    stopRadio,
    currentTvChannel,
    closeTvPlayer,
    handlePlayMusicTrack,
  ]);

  const handleNextMusicTrack = useCallback(() => {
    const list = musicQueue.length > 0 ? musicQueue : INITIAL_SPOTIFY_TRACKS;
    if (list.length === 0) return;
    if (isMusicShuffle && list.length > 1) {
      const candidates = list.filter((t) => t.id !== currentMusicTrack?.id);
      const pick =
        candidates[Math.floor(Math.random() * candidates.length)] || list[0];
      handlePlayMusicTrack(pick, list);
      return;
    }
    const idx = list.findIndex((t) => t.id === currentMusicTrack?.id);
    const nextTrack = list[(idx + 1) % list.length] || list[0];
    handlePlayMusicTrack(nextTrack, list);
  }, [musicQueue, isMusicShuffle, currentMusicTrack, handlePlayMusicTrack]);

  const handlePrevMusicTrack = useCallback(() => {
    const list = musicQueue.length > 0 ? musicQueue : INITIAL_SPOTIFY_TRACKS;
    if (list.length === 0) return;
    if (musicElapsedSec > 5 && musicAudioRef.current) {
      musicAudioRef.current.currentTime = 0;
      setMusicElapsedSec(0);
      return;
    }
    const idx = list.findIndex((t) => t.id === currentMusicTrack?.id);
    const prevIdx = idx <= 0 ? list.length - 1 : idx - 1;
    handlePlayMusicTrack(list[prevIdx] || list[0], list);
  }, [musicQueue, musicElapsedSec, currentMusicTrack, handlePlayMusicTrack]);

  const handleSeekMusic = useCallback((targetSec: number) => {
    const audioEl = musicAudioRef.current;
    if (!audioEl) return;
    const clamped = Math.max(0, targetSec);
    audioEl.currentTime = clamped;
    setMusicElapsedSec(clamped);
  }, []);

  const handleToggleLikeMusicTrack = useCallback((track: SpotifyTrackItem) => {
    setLikedMusicTracks((prev) => {
      const exists = prev.some((t) => t.id === track.id);
      const next = exists
        ? prev.filter((t) => t.id !== track.id)
        : [track, ...prev];
      try {
        localStorage.setItem('sc_spotify_liked_tracks_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleChangeMusicVolume = useCallback((nextVol: number) => {
    const clamped = Math.min(1, Math.max(0, Number(nextVol.toFixed(2))));
    setMusicVolume(clamped);
    setIsMusicMuted(clamped === 0);
    if (musicAudioRef.current) {
      musicAudioRef.current.volume = clamped;
    }
  }, []);

  const handleToggleMusicMute = useCallback(() => {
    setIsMusicMuted((prev) => {
      const next = !prev;
      if (musicAudioRef.current) {
        musicAudioRef.current.volume = next ? 0 : musicVolume;
      }
      return next;
    });
  }, [musicVolume]);

  const handleStopAndCloseMusic = useCallback(() => {
    if (musicAudioRef.current) {
      musicAudioRef.current.pause();
      musicAudioRef.current.removeAttribute('src');
    }
    setIsMusicPlaying(false);
    setCurrentMusicTrack(null);
    setMusicElapsedSec(0);
  }, []);

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

  // Clock & 2-line Date in top-right corner (localized by uiLang: RO / EN / RU)
  const [clockNow, setClockNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockNow(new Date());
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  // Main TV Navigation Section (Defaults to Lampa 'home' / Главная)
  const [section, setSection] = useState<TvSectionId>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

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
      unlockedPinProfileKey !== `${activeProfile.id}:${activeProfile.pin.trim()}`)
  );

  // Sync profiles list across LAN & Cloud devices via /api/tv-profiles (merging without losing local custom profiles)
  useEffect(() => {
    syncSharedProfilesFromServer().then((merged) => {
      if (Array.isArray(merged) && merged.length > 0) {
        setTvProfiles(merged);
      }
    });

    const onProfilesUpdated = () => {
      setTvProfiles(loadTvProfiles());
    };
    const onActiveProfileChanged = (e: Event) => {
      const custom = e as CustomEvent<string | { profileId?: string }>;
      const nextId =
        typeof custom.detail === 'string'
          ? custom.detail
          : custom.detail?.profileId || loadActiveProfileId();
      setActiveProfileId(nextId);
      setTvProfiles(loadTvProfiles());
    };
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === TV_PROFILES_STORAGE_KEY) {
        setTvProfiles(loadTvProfiles());
      }
      if (e.key === 'aether_smart_tv_active_profile_v1' && e.newValue) {
        setActiveProfileId(e.newValue);
      }
    };

    window.addEventListener('aether:profiles-updated', onProfilesUpdated);
    window.addEventListener('aether:active-profile-changed', onActiveProfileChanged);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('aether:profiles-updated', onProfilesUpdated);
      window.removeEventListener('aether:active-profile-changed', onActiveProfileChanged);
      window.removeEventListener('storage', onStorage);
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

  const updateTvSetting = useCallback(
    <K extends keyof SmartTvSettings>(key: K, value: SmartTvSettings[K]) => {
      setTvSettings((prev) => {
        const next = { ...prev, [key]: value };
        saveSmartTvSettings(next, activeProfileId);
        return next;
      });
      if (key === 'defaultSubLang' && value && value !== 'off') {
        setPreferredSubLang(value as SubtitleLangId);
      }
    },
    [activeProfileId]
  );

  // Sync tvSettings whenever activeProfileId changes or profile media prefs are updated from players
  useEffect(() => {
    const syncProfileSettings = () => {
      const next = loadSmartTvSettings(activeProfileId);
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
  }, [activeProfileId]);

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
  const [homeHeroIdx, setHomeHeroIdx] = useState<number>(0);
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

  // Enforce per-profile 18+ Adult Content access (managed exclusively by JEKA)
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
  }, [
    activeProfile,
    isPinLockRequired,
    adultContentEnabled,
    setAdultContentEnabled,
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

  // Watch Progress & Saved Items (Per-Profile Isolated)
  const [watchProgressMap, setWatchProgressMap] = useState<
    Record<string, VodWatchProgressEntry>
  >(() => loadWatchProgressMap(loadActiveProfileId()));
  const [savedVodItems, setSavedVodItems] = useState<CinemetaItem[]>(() =>
    loadSavedVodItems(loadActiveProfileId())
  );

  const handleSelectProfile = useCallback(
    (profileId: string) => {
      const latestStored = loadTvProfiles();
      const targetProfile =
        tvProfiles.find((p) => p.id === profileId) ||
        latestStored.find((p) => p.id === profileId) ||
        DEFAULT_TV_PROFILES[0];
      if (!tvProfiles.some((p) => p.id === targetProfile.id) && latestStored.length > 0) {
        setTvProfiles(latestStored);
      }
      rememberProfileOnDevice(targetProfile);
      const allowedAdult = canProfileAccessAdult(targetProfile);
      setAdultContentEnabled(allowedAdult);
      if (!allowedAdult) {
        setTvRegionId((prev) => (prev === 'ADULT' ? 'FAV' : prev));
        setTvCategoryId((prev) => (prev === 'ADULT' ? 'ALL' : prev));
        setSelectedGenre((prev) => (prev === 'Adult' ? 'top' : prev));
        if (currentTvChannel && isAdultTvChannel(currentTvChannel)) {
          closeTvPlayer();
        }
      }
      if (targetProfile.pin && targetProfile.pin.trim()) {
        setUnlockedPinProfileKey(`${profileId}:${targetProfile.pin.trim()}`);
      } else {
        setUnlockedPinProfileKey('');
      }
      setActiveProfileId(profileId);
      saveActiveProfileId(profileId);
      try {
        sessionStorage.setItem('aether_tv_profile_picked_v1', '1');
      } catch {
        // ignore
      }
      const nextSettings = loadSmartTvSettings(profileId);
      if (targetProfile.uiLang && !localStorage.getItem(getSmartTvSettingsKeyForProfile(profileId))) {
        nextSettings.uiLang = targetProfile.uiLang;
      }
      setTvSettings(nextSettings);
      setWatchProgressMap(loadWatchProgressMap(profileId));
      setSavedVodItems(loadSavedVodItems(profileId));
      setEditingProfileId(null);
      setIsProfilePickerOpen(false);
    },
    [tvProfiles]
  );

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
        handleSelectProfile('p1');
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
  const [isHandoffModalOpen, setIsHandoffModalOpen] = useState<boolean>(false);
  const [resolvedDirectStream, setResolvedDirectStream] =
    useState<ResolvedDirectVodStream | null>(null);
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
  const [fallbackYtVideoId, setFallbackYtVideoId] = useState<string | null>(null);
  const [activeServer, setActiveServer] = useState<VodServerId>(() =>
    tvSettings.defaultVodServer === 'auto_best' ||
      (tvSettings.defaultVodServer === 'filelist_torrent' && !isLocalHomeServer())
      ? 'kinogram_hls'
      : tvSettings.defaultVodServer
  );
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
  const [isVodOsdVisible, setIsVodOsdVisible] = useState<boolean>(true);
  const [isEpisodesDrawerOpen, setIsEpisodesDrawerOpen] =
    useState<boolean>(false);
  const [isInfoSheetOpen, setIsInfoSheetOpen] = useState<boolean>(false);
  const [isPlayingVod, setIsPlayingVod] = useState<boolean>(false);
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

  const effectiveAudioTrackIdx = useMemo(() => {
    const names = resolvedDirectStream?.audioNames || [];
    if (selectedAudioTrackIdx >= 0 && selectedAudioTrackIdx < names.length) {
      return selectedAudioTrackIdx;
    }
    return resolveAudioTrackIndexByPreference(
      names,
      tvSettings.defaultAudioPref
    );
  }, [
    resolvedDirectStream?.audioNames,
    selectedAudioTrackIdx,
    tvSettings.defaultAudioPref,
  ]);
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
      if (currentStation && (playerStatus === 'playing' || playerStatus === 'loading')) {
        stopRadio();
        setIsTvRadioPlayerOpen(false);
      }
      if (musicAudioRef.current && !musicAudioRef.current.paused) {
        musicAudioRef.current.pause();
      }
      if (isMusicPlaying) {
        setIsMusicPlaying(false);
      }
    }
  }, [
    isPlayingVod,
    isTrailerModalOpen,
    currentTvChannel,
    currentStation,
    playerStatus,
    stopRadio,
    isMusicPlaying,
  ]);

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
    if (tvSettings.osdAutoHideSec <= 0) {
      return;
    }
    const timeoutMs = Math.max(8, tvSettings.osdAutoHideSec) * 1000;
    osdTimerRef.current = window.setTimeout(() => {
      const hasOpenOverlay = Boolean(
        playerBoxRef.current?.querySelector(
          '[data-vod-menu-popover="true"], [data-vod-sheet-open="true"], [data-episodes-drawer="true"]'
        )
      );
      if (hasOpenOverlay) {
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
    }, timeoutMs);
  }, [tvSettings.osdAutoHideSec]);

  // Offline / Local Device Downloads (IndexedDB + Device Export)
  const [offlineItems, setOfflineItems] = useState<OfflineMediaItem[]>([]);
  const [selectedOfflineSeriesId, setSelectedOfflineSeriesId] = useState<string | null>(null);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState<boolean>(false);
  const [downloadQualityHeight, setDownloadQualityHeight] = useState<
    360 | 480 | 720 | 1080
  >(480);
  const [downloadModalSeason, setDownloadModalSeason] = useState<number>(1);
  const [selectedDownloadEpisodes, setSelectedDownloadEpisodes] = useState<
    number[]
  >([1]);
  const [activeDownloadProgress, setActiveDownloadProgress] =
    useState<OfflineDownloadProgress | null>(null);
  const [activeDownloadTargetId, setActiveDownloadTargetId] = useState<
    string | null
  >(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const downloadAbortRef = useRef<AbortController | null>(null);

  const refreshOfflineLibrary = useCallback(async () => {
    try {
      const list = await listOfflineItems();
      setOfflineItems(list);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void refreshOfflineLibrary();
  }, [refreshOfflineLibrary]);

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
      if (activeDownloadProgress) return;

      const targetHeight = preferredHeightOverride || downloadQualityHeight;
      const isSeries = activeVodItem.type === 'series';
      const targetSeason = isSeries
        ? (seasonOverride ?? downloadModalSeason ?? selectedSeason)
        : 1;
      const targetEpisodes = isSeries
        ? episodesOverride && episodesOverride.length > 0
          ? [...episodesOverride].sort((a, b) => a - b)
          : [selectedEpisode]
        : [1];

      setDownloadError(null);
      const controller = new AbortController();
      downloadAbortRef.current = controller;

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

      try {
        for (let idx = 0; idx < targetEpisodes.length; idx++) {
          if (controller.signal.aborted) break;
          const epNum = targetEpisodes[idx];
          const offlineId = isSeries
            ? `vod_${activeVodItem.id}_S${targetSeason}E${epNum}`
            : `vod_${activeVodItem.id}`;
          setActiveDownloadTargetId(offlineId);

          const batchPrefix =
            isSeries && targetEpisodes.length > 1
              ? `[${idx + 1}/${targetEpisodes.length} • S${targetSeason}:E${epNum}] `
              : isSeries
                ? `[S${targetSeason}:E${epNum}] `
                : '';

          setActiveDownloadProgress({
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

          let hlsTarget =
            !isSeries ||
              (targetSeason === selectedSeason && epNum === selectedEpisode)
              ? resolvedDirectStream?.hlsUrl
              : undefined;
          let epAudioNames = resolvedDirectStream?.audioNames;

          if (!hlsTarget) {
            const resolvedEp = await resolveDirectVodStreamClient({
              kp: kpId,
              imdb: imdbId,
              title: detailedMeta?.nameOriginal || activeVodItem.name,
              type: activeVodItem.type,
              year: yearStr,
              season: targetSeason,
              episode: epNum,
            });
            hlsTarget = resolvedEp?.hlsUrl || resolvedEp?.proxyHlsUrl;
            if (resolvedEp?.audioNames?.length) {
              epAudioNames = resolvedEp.audioNames;
            }
          }

          if (!hlsTarget) {
            throw new Error(
              isSeries
                ? tr(
                  `Streamul HLS nu este disponibil pentru S${targetSeason}:E${epNum}.`,
                  `HLS stream unavailable for S${targetSeason}:E${epNum}.`,
                  `Поток HLS недоступен для S${targetSeason}:E${epNum}.`
                )
                : tr(
                  'Streamul direct HLS nu este disponibil pentru descărcare locală la acest titlu.',
                  'Direct HLS stream is unavailable for offline download on this title.',
                  'Прямой поток HLS недоступен для скачивания.'
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

          const audioIdx = Math.max(0, selectedAudioTrackIdx);
          await downloadHlsToOfflineDb({
            id: offlineId,
            title: detailedMeta?.name || activeVodItem.name,
            subtitleLabel: subtitleText,
            poster:
              detailedMeta?.poster ||
              activeVodItem.poster ||
              `https://images.metahub.space/poster/medium/${activeVodItem.id}/img`,
            masterM3u8Url: hlsTarget,
            preferredHeight: targetHeight,
            audioTrackIndex: audioIdx,
            audioLabel:
              epAudioNames?.[audioIdx] ||
              resolvedDirectStream?.audioNames?.[audioIdx] ||
              'Original / Audio 1',
            savedSubCues: epSubCues.length > 0 ? epSubCues : undefined,
            savedSubLabel: epSubLabel || undefined,
            vodId: activeVodItem.id,
            mediaKind: activeVodItem.type,
            season: isSeries ? targetSeason : undefined,
            episode: isSeries ? epNum : undefined,
            signal: controller.signal,
            onProgress: (prog) =>
              setActiveDownloadProgress({
                ...prog,
                stage: `${batchPrefix}${prog.stage}`,
              }),
          });

          await refreshOfflineLibrary();
        }

        window.setTimeout(() => {
          setActiveDownloadProgress(null);
          setActiveDownloadTargetId(null);
        }, 1600);
      } catch (err) {
        setActiveDownloadProgress(null);
        setActiveDownloadTargetId(null);
        if (err instanceof DOMException && err.name === 'AbortError') {
          setDownloadError(
            tr(
              'Descărcarea a fost oprită.',
              'Download cancelled.',
              'Загрузка отменена.'
            )
          );
        } else {
          setDownloadError(
            err instanceof Error
              ? err.message
              : tr(
                'Eroare la descărcarea locală.',
                'Local download error.',
                'Ошибка загрузки.'
              )
          );
        }
      } finally {
        downloadAbortRef.current = null;
      }
    },
    [
      activeVodItem,
      activeDownloadProgress,
      resolvedDirectStream,
      downloadQualityHeight,
      downloadModalSeason,
      selectedSeason,
      selectedEpisode,
      detailedMeta,
      selectedAudioTrackIdx,
      activeSubCues,
      activeSubLabel,
      tvSettings.defaultSubLang,
      refreshOfflineLibrary,
      tr,
    ]
  );

  const handleCancelOfflineDownload = useCallback(() => {
    downloadAbortRef.current?.abort();
    downloadAbortRef.current = null;
    setActiveDownloadProgress(null);
    setActiveDownloadTargetId(null);
  }, []);

  const [isMobileCustomFullscreen, setIsMobileCustomFullscreen] = useState(false);
  const [isPortraitViewport, setIsPortraitViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false
  );
  const [isMobilePhone, setIsMobilePhone] = useState(() => {
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
    const syncViewportFlags = () => {
      setIsPortraitViewport(window.innerHeight > window.innerWidth);
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
      } else {
        setIsMobilePhone(
          window.innerWidth < 640 ||
            (window.innerHeight < 540 && window.innerWidth < 1024)
        );
      }
    };
    const onOpenHandoff = () => setIsHandoffModalOpen(true);
    window.addEventListener('resize', syncViewportFlags);
    window.addEventListener('orientationchange', syncViewportFlags);
    window.addEventListener('aether:open-handoff-modal', onOpenHandoff);
    return () => {
      window.removeEventListener('resize', syncViewportFlags);
      window.removeEventListener('orientationchange', syncViewportFlags);
      window.removeEventListener('aether:open-handoff-modal', onOpenHandoff);
    };
  }, []);

  useEffect(() => {
    if (!isPlayingVod) {
      setIsMobileCustomFullscreen(false);
    }
  }, [isPlayingVod]);

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

  const requestTvFullscreen = useCallback(() => {
    try {
      const box = playerBoxRef.current;

      if (typeof document !== 'undefined' && document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => { });
        setIsMobileCustomFullscreen(false);
        return;
      }

      const fsTarget = box || document.documentElement;
      if (fsTarget && typeof fsTarget.requestFullscreen === 'function') {
        fsTarget
          .requestFullscreen()
          .then(() => {
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
            setIsMobileCustomFullscreen((prev) => !prev);
          });
        return;
      }

      setIsMobileCustomFullscreen((prev) => !prev);
    } catch {
      // ignore
    }
  }, []);

  const handleFocusVodItem = useCallback(
    (item: CinemetaItem, isHeroBannerPreload = false) => {
      // SMART TV SMOOTH PERFORMANCE OPTIMIZATION (REVERSIBLE):
      // Avoid triggering full-view React re-renders and 3x API fetches on every D-pad poster focus.
      // Only fetch/update spotlight metadata when preloading for the Home Hero Banner.
      if (!isHeroBannerPreload) return;

      const posterUrl =
        item.poster ||
        `https://images.metahub.space/poster/medium/${item.id}/img`;
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

  // Auto-rotate Hero Billboard Banner every 10 seconds on Home Page
  useEffect(() => {
    if (
      section !== 'home' ||
      Boolean(activeVodItem) ||
      isPlayingVod ||
      heroBillboardItems.length <= 1
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      setHomeHeroIdx((prev) => (prev + 1) % heroBillboardItems.length);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [section, activeVodItem, isPlayingVod, heroBillboardItems.length]);

  // Pre-load description & metadata for the currently displayed Hero Banner slide
  useEffect(() => {
    if (section !== 'home' || Boolean(activeVodItem) || heroBillboardItems.length === 0) {
      return;
    }
    const curHero = heroBillboardItems[homeHeroIdx % heroBillboardItems.length];
    if (curHero) {
      handleFocusVodItem(curHero, true);
    }
  }, [section, activeVodItem, homeHeroIdx, heroBillboardItems, handleFocusVodItem]);

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
            (section === 'search' ||
              section === 'uhd_4k' ||
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
          if (activeVodItem?.id.startsWith('yt_')) {
            setActiveVodItem(null);
            setIsSidebarOpen(true);
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

      // Hardware TV Remote Play / Pause buttons when on Movie Detail Card (!isPlayingVod) or when Radio is active
      if (
        !isPlayingVod &&
        !isInputFocused &&
        (e.keyCode === 415 ||
          e.keyCode === 19 ||
          e.keyCode === 179 ||
          e.keyCode === 250 ||
          e.key === 'MediaPlay' ||
          e.key === 'MediaPause' ||
          e.key === 'MediaPlayPause' ||
          e.key === 'Play' ||
          e.key === 'Pause')
      ) {
        if (activeVodItem && e.keyCode !== 19 && e.key !== 'MediaPause' && e.key !== 'Pause') {
          e.preventDefault();
          e.stopPropagation();
          playVodBtnRef.current?.click();
          return;
        }
        if (currentStation && !activeVodItem) {
          e.preventDefault();
          e.stopPropagation();
          if (playerStatus === 'playing') {
            stopRadio();
          } else {
            playStation(currentStation, radioStations);
          }
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
        !isInputFocused
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

      // If user is typing inside <input> and presses Left/Right arrow, let the cursor move naturally inside the input
      if (
        isInputFocused &&
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
      ) {
        return;
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
          isInfoSheetOpen || isEpisodesDrawerOpen || isVodSubMenuOpen;
        const activeEl = document.activeElement as HTMLElement | null;
        const isOsdControlFocused =
          isVodOsdVisible &&
          Boolean(
            activeEl &&
            playerBoxRef.current?.contains(activeEl) &&
            activeEl !== playerBoxRef.current
          );

        // 1. YELLOW BUTTON (405 / F3 / ColorF2Yellow): Toggle Movie/Series Description Sheet with Poster, Synopsis & Cast
        if (kc === 405 || k === 'F3' || k === 'ColorF2Yellow') {
          e.preventDefault();
          e.stopPropagation();
          wakeVodOsd();
          window.dispatchEvent(new CustomEvent('aether:vod-close-menu'));
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
          return;
        }

        // 2. GREEN BUTTON (404 / F2 / ColorF1Green): Toggle Subtitles Menu directly
        if (kc === 404 || k === 'F2' || k === 'ColorF1Green') {
          e.preventDefault();
          e.stopPropagation();
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

        // 3. BLUE BUTTON (406 / F4 / ColorF3Blue): Toggle Audio Track / Source Menu directly
        if (kc === 406 || k === 'F4' || k === 'ColorF3Blue') {
          e.preventDefault();
          e.stopPropagation();
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
                  menu:
                    hasNativeAudioPopover &&
                      resolvedDirectStream?.audioNames &&
                      resolvedDirectStream.audioNames.length > 0
                      ? 'audio'
                      : 'server',
                },
              })
            );
          }
          return;
        }

        // 4. RED BUTTON (403 / F1 / ColorF0Red): Toggle Upcoming Episodes Drawer (Series) or Description Sheet (Movie)
        if (kc === 403 || k === 'F1' || k === 'ColorF0Red') {
          e.preventDefault();
          e.stopPropagation();
          wakeVodOsd();
          window.dispatchEvent(new CustomEvent('aether:vod-close-menu'));
          if (activeVodItem?.type === 'series') {
            setIsInfoSheetOpen(false);
            setIsEpisodesDrawerOpen((prev) => {
              const nextOpen = !prev;
              if (nextOpen) {
                window.setTimeout(() => {
                  const targetBtn =
                    playerBoxRef.current?.querySelector<HTMLElement>(
                      '[data-episodes-drawer="true"] [data-drawer-next-ep="true"]'
                    ) ||
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
              }
              return nextOpen;
            });
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
          ).filter((btn) => !btn.closest('[data-vod-menu-popover="true"]'));

        const skipIntroBtn =
          playerBoxRef.current?.querySelector<HTMLButtonElement>(
            '[data-vod-skip-intro-btn="true"]'
          ) || null;
        const skipIntroCloseBtn =
          playerBoxRef.current?.querySelector<HTMLButtonElement>(
            '[data-vod-skip-intro-close-btn="true"]'
          ) || null;
        const autoNextBtn =
          playerBoxRef.current?.querySelector<HTMLButtonElement>(
            '[data-vod-autonext-btn="true"]'
          ) || null;
        const floatingPrimaryBtn = skipIntroBtn || autoNextBtn;

        // Direct 1-Click Remote OK ("Enter") for "Sari peste Intro" / "Următorul Episod" when visible
        if (!isAnyVodOverlayOpen && floatingPrimaryBtn) {
          const isFocusedOnFloating =
            activeEl === skipIntroBtn ||
            activeEl === skipIntroCloseBtn ||
            activeEl === autoNextBtn;

          if (
            (e.key === 'Enter' || kc === 13) &&
            (isFocusedOnFloating || !isOsdControlFocused)
          ) {
            e.preventDefault();
            e.stopPropagation();
            if (skipIntroCloseBtn && activeEl === skipIntroCloseBtn) {
              skipIntroCloseBtn.click();
            } else if (autoNextBtn && activeEl === autoNextBtn) {
              autoNextBtn.click();
            } else {
              floatingPrimaryBtn.click();
            }
            return;
          }

          if (isFocusedOnFloating) {
            if (e.key === 'ArrowRight' && activeEl === skipIntroBtn && skipIntroCloseBtn) {
              e.preventDefault();
              e.stopPropagation();
              skipIntroCloseBtn.focus();
              return;
            }
            if (e.key === 'ArrowLeft' && activeEl === skipIntroCloseBtn && skipIntroBtn) {
              e.preventDefault();
              e.stopPropagation();
              skipIntroBtn.focus();
              return;
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
              e.preventDefault();
              e.stopPropagation();
              wakeVodOsd();
              const playBtn =
                playerBoxRef.current?.querySelector<HTMLButtonElement>(
                  '[data-vod-play-btn="true"]'
                );
              (playBtn || getBottomRowBtns()[0])?.focus();
              return;
            }
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
          wakeVodOsd();
          if (isVodOsdVisible) {
            const bottomBtns = getBottomRowBtns();
            const targetBtn =
              e.key === 'ArrowRight'
                ? bottomBtns[1] || bottomBtns[0]
                : bottomBtns[0];
            targetBtn?.focus();
            return;
          }
          window.dispatchEvent(
            new CustomEvent('aether:vod-seek', {
              detail: { deltaSec: e.key === 'ArrowRight' ? 15 : -15 },
            })
          );
          window.setTimeout(() => {
            const targetSeekBtn =
              playerBoxRef.current?.querySelector<HTMLButtonElement>(
                e.key === 'ArrowRight'
                  ? '[data-vod-seek-fwd-15="true"]'
                  : '[data-vod-seek-back-15="true"]'
              ) ||
              playerBoxRef.current?.querySelector<HTMLButtonElement>(
                '[data-vod-play-btn="true"]'
              );
            targetSeekBtn?.focus();
          }, 25);
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
              wakeVodOsd();
              window.dispatchEvent(
                new CustomEvent('aether:vod-seek', {
                  detail: { deltaSec: e.key === 'ArrowRight' ? 15 : -15 },
                })
              );
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
              (topEpisodesBtn || topBackBtn)?.focus();
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
              (floatingPrimaryBtn || timelineBtn || topEpisodesBtn || topBackBtn)?.focus();
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
                      '[data-episodes-drawer="true"] [data-drawer-next-ep="true"]'
                    ) ||
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

          // 3. When a Top Bar button is focused and user presses ArrowDown:
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
              playerBoxRef.current?.querySelector<HTMLButtonElement>(
                '[data-vod-play-btn="true"]'
              ) ||
              bottomBtns[0] ||
              timelineBtn
            )?.focus();
            return;
          }
        }

        wakeVodOsd();
      }

      // Lampa 2D Spatial D-Pad Navigation for TV Remote Arrows when in Catalog, Movie Card, VOD Player, Filter, or Settings Drawer
      if (
        !isSubFinderOpen &&
        (e.key === 'ArrowRight' ||
          e.key === 'ArrowLeft' ||
          e.key === 'ArrowDown' ||
          e.key === 'ArrowUp')
      ) {
        const root = isSettingsDrawerOpen
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
                    : !isPlayingVod && activeVodItem && openVodCompactPanel
                      ? rootContainerRef.current?.querySelector<HTMLElement>(
                        '[data-vod-compact-open-box="true"]'
                      ) || rootContainerRef.current
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
        const rawNodes = root.querySelectorAll<HTMLElement>(
          'input:not([disabled]), button:not([disabled]), select:not([disabled])'
        );
        for (let i = 0; i < rawNodes.length; i++) {
          const el = rawNodes[i];
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            focusablesWithRect.push({ el, rect: r });
          }
        }
        if (focusablesWithRect.length === 0) return;

        const headerEl = root.querySelector<HTMLElement>('header');
        const asideEl = root.querySelector<HTMLElement>('aside');
        const mainEl = root.querySelector<HTMLElement>('main');

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

          const r = targetRect || targetEl.getBoundingClientRect();

          // If navigating inside a scrollable modal/drawer (Episodes Drawer, Info Sheet, Settings, Filter, Catalog), keep target in view
          if (
            root !== rootContainerRef.current &&
            root !== playerBoxRef.current &&
            root.contains(targetEl)
          ) {
            const rootRect = root.getBoundingClientRect();
            const offsetInRoot = r.top - rootRect.top + root.scrollTop;
            if (r.top < rootRect.top + 28) {
              root.scrollTop = Math.max(0, offsetInRoot - 36);
            } else if (r.bottom > rootRect.bottom - 28) {
              root.scrollTop = Math.max(
                0,
                offsetInRoot - rootRect.height + r.height + 36
              );
            }
            return;
          }

          // Scroll ONLY <main> (never overflow-hidden parent containers via scrollIntoView)
          if (mainEl && mainEl.contains(targetEl)) {
            const mainRect = mainEl.getBoundingClientRect();
            const offsetInMain = r.top - mainRect.top + mainEl.scrollTop;
            const isTopHeroOrPlayer =
              offsetInMain < 450 ||
              Boolean(targetEl.closest('[data-top-hero-card="true"]'));

            if (isTopHeroOrPlayer) {
              if (mainEl.scrollTop > 0) {
                mainEl.scrollTop = 0;
              }
            } else if (r.top < mainRect.top + 36) {
              mainEl.scrollTop = Math.max(0, offsetInMain - 48);
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
        // Down returns cleanly to <main> or <aside>
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
              const firstPrimary = mainEl.querySelector<HTMLElement>(
                '[data-osd-channel-row="true"][aria-selected="true"], [data-osd-channel-row="true"], [data-watched-poster-btn="true"], [data-vod-card="true"]'
              );
              if (firstPrimary) {
                focusTvTarget(firstPrimary);
                return;
              }
              const firstMain = focusablesWithRect.find((item) =>
                mainEl.contains(item.el)
              );
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
        // - Right jumps in 1 single click directly to the first content item in <main>!
        if (
          asideEl &&
          asideEl.contains(current) &&
          !isSettingsDrawerOpen &&
          !isFilterDrawerOpen &&
          !isCatalogDrawerOpen
        ) {
          const sidebarItems = focusablesWithRect.filter(
            (item) => item.el.tagName === 'BUTTON' && asideEl.contains(item.el)
          );
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
            if (mainEl.scrollTop > 0 && (section === 'tv' || section === 'radio' || section === 'music' || section === 'home')) {
              mainEl.scrollTop = 0;
            }
            const firstPrimaryCard = mainEl.querySelector<HTMLElement>(
              '[data-watched-poster-btn="true"], [data-osd-channel-row="true"][aria-selected="true"], [data-osd-channel-row="true"], [data-tv-channel-card="true"], [data-vod-card="true"]'
            );
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

        // When inside <main> and pressing ArrowLeft, check if there is another item in <main> to the left;
        // if we are on the leftmost column of <main>, jump directly back to the active Category in <aside>!
        if (
          e.key === 'ArrowLeft' &&
          mainEl &&
          mainEl.contains(current) &&
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
            const dy = cy - curCy;
            if (dx >= -6) continue;
            // Must be roughly on the same row (within 120px vertically)
            if (Math.abs(dy) > 120) continue;
            const score = Math.abs(dx) + Math.abs(dy) * 3.2;
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
          const targetSidebarBtn =
            asideEl.querySelector<HTMLElement>('[data-sidebar-active="true"]') ||
            asideEl.querySelector<HTMLElement>('button');
          if (targetSidebarBtn) {
            e.preventDefault();
            focusTvTarget(targetSidebarBtn);
            return;
          }
        }

        let bestCandidate: { el: HTMLElement; rect: DOMRect } | null = null;
        let bestScore = Infinity;
        const isCurrentInMain = Boolean(mainEl && mainEl.contains(current));

        for (let i = 0; i < focusablesWithRect.length; i++) {
          const item = focusablesWithRect[i];
          if (item.el === current) continue;

          // When navigating Up or Down inside <main>, stay strictly inside <main> so scrolling down never jumps into <aside> or <header> prematurely
          if (
            isCurrentInMain &&
            (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
            !mainEl!.contains(item.el)
          ) {
            continue;
          }

          const r = item.rect;
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const dx = cx - curCx;
          const dy = cy - curCy;

          if (e.key === 'ArrowRight' && dx <= 6) continue;
          if (e.key === 'ArrowLeft' && dx >= -6) continue;
          if (e.key === 'ArrowDown' && dy <= 6) continue;
          if (e.key === 'ArrowUp' && dy >= -6) continue;

          const primaryDist =
            e.key === 'ArrowRight' || e.key === 'ArrowLeft'
              ? Math.abs(dx)
              : Math.abs(dy);
          const orthoDist =
            e.key === 'ArrowRight' || e.key === 'ArrowLeft'
              ? Math.abs(dy)
              : Math.abs(dx);

          // Strongly prefer elements in the same row/column
          const score = primaryDist + orthoDist * 3.2;
          if (score < bestScore) {
            bestScore = score;
            bestCandidate = item;
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
          savedVodItems.filter((x) => x.type === mediaType)
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
          if (sortedMerged[0]) {
            handleFocusVodItem(sortedMerged[0]);
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
            ? kpNewData.items.map(
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
              }) => {
                const isSeries =
                  f.type === 'TV_SERIES' ||
                  f.type === 'MINI_SERIES' ||
                  f.type === 'TV_SHOW';
                const validImdb =
                  f.imdbId && /^tt\d+$/.test(f.imdbId) ? f.imdbId : '';
                const ratingVal = f.ratingKinopoisk || f.ratingImdb;
                return {
                  id: validImdb || `kp_${f.kinopoiskId}`,
                  kpId: String(f.kinopoiskId),
                  type: isSeries ? 'series' : 'movie',
                  name:
                    f.nameOriginal ||
                    f.nameEn ||
                    f.nameRu ||
                    `Film #${f.kinopoiskId}`,
                  releaseInfo:
                    f.year && String(f.year) !== 'null'
                      ? String(f.year)
                      : '2026',
                  imdbRating: ratingVal ? String(ratingVal) : undefined,
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
          if (sortedWatchingNow[0]) {
            handleFocusVodItem(sortedWatchingNow[0]);
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
            }>;
          };

          const preferRu = originCountry === 'RU' && uiLang === 'ru';
          const mapped: CinemetaItem[] = (data.items || []).map((f) => {
            const title = preferRu
              ? f.nameRu || f.nameOriginal || f.nameEn || `Film #${f.kinopoiskId}`
              : f.nameOriginal || f.nameEn || f.nameRu || `Film #${f.kinopoiskId}`;
            const validImdb =
              f.imdbId && /^tt\d+$/.test(f.imdbId) ? f.imdbId : '';
            const ratingVal = f.ratingKinopoisk || f.ratingImdb;
            return {
              id: validImdb || `kp_${f.kinopoiskId}`,
              kpId: String(f.kinopoiskId),
              type: mediaType,
              name: title,
              releaseInfo:
                f.year && String(f.year) !== 'null' ? String(f.year) : undefined,
              imdbRating: ratingVal ? String(ratingVal) : undefined,
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

          const sortedMapped = sortVodItemsByProductionYear(mapped);

          setVodItems((prev) => {
            if (!append) return sortedMapped;
            const seen = new Set(prev.map((x) => x.id));
            return sortVodItemsByProductionYear([
              ...prev,
              ...sortedMapped.filter((x) => !seen.has(x.id)),
            ]);
          });
          setHasMoreVod(pageNum < (data.totalPages || 1));
          if (!append && sortedMapped[0]) {
            handleFocusVodItem(sortedMapped[0]);
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
          const list = sortVodItemsByProductionYear(
            (data.metas || []).map((m) => ({
              ...m,
              type: mediaType,
            }))
          );

          setVodItems((prev) => {
            if (!append) return list;
            const seen = new Set(prev.map((x) => x.id));
            return sortVodItemsByProductionYear([
              ...prev,
              ...list.filter((x) => !seen.has(x.id)),
            ]);
          });
          setHasMoreVod(list.length >= 30);
          if (!append && list[0]) {
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
      handleFocusVodItem,
      savedVodItems,
    ]
  );

  useEffect(() => {
    if (
      section === 'home' ||
      section === 'movies' ||
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
    if (window.scrollY !== 0 || window.scrollX !== 0) {
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
        const top = stations.slice(0, 150);
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

  // Search execution (both Kinopoisk & Cinemeta)
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
        const [kpRes, movieRes, seriesRes] = await Promise.allSettled([
          fetch(
            `https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(
              q
            )}&page=1`,
            {
              headers: {
                'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
              },
            }
          ).then((r) => (r.ok ? r.json() : { films: [] })),
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
        ]);

        if (cancelled) return;

        const combined: CinemetaItem[] = [];
        if (kpRes.status === 'fulfilled' && Array.isArray(kpRes.value.films)) {
          for (const f of kpRes.value.films.slice(0, 16)) {
            const isSeries =
              f.type === 'TV_SERIES' ||
              f.type === 'MINI_SERIES' ||
              f.type === 'TV_SHOW';
            combined.push({
              id: `kp_${f.filmId}`,
              kpId: String(f.filmId),
              type: isSeries ? 'series' : 'movie',
              name: f.nameRu || f.nameEn || `Film #${f.filmId}`,
              releaseInfo: f.year && f.year !== 'null' ? f.year : undefined,
              imdbRating:
                f.rating && f.rating !== 'null' && !f.rating.includes('%')
                  ? f.rating
                  : undefined,
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

        setSearchResults(sortVodItemsByProductionYear(combined));
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
          setFlItems(items);
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
      if (tvSettings.autoFullscreenOnPlay) {
        requestTvFullscreen();
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
      setIsPlayingVod(true);
      wakeVodOsd();
    },
    [tvSettings.autoFullscreenOnPlay, requestTvFullscreen, wakeVodOsd]
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
        typeof window !== 'undefined' &&
        window.innerWidth >= 640
      ) {
        requestTvFullscreen();
      }
      const saved = watchProgressMap[item.id];
      const relMatch = String(item.releaseTitle || item.name || '').match(
        /\bS(\d{1,2})[.\s_-]*E(\d{1,2})\b/i
      );
      const useExplicitTorrentEp = Boolean(relMatch && section === 'torrents');
      const targetSeason =
        typeof explicitSeason === 'number' && explicitSeason > 0
          ? explicitSeason
          : useExplicitTorrentEp
            ? Number(relMatch![1])
            : saved?.season || (relMatch ? Number(relMatch[1]) : 1);
      const targetEpisode =
        typeof explicitEpisode === 'number' && explicitEpisode > 0
          ? explicitEpisode
          : useExplicitTorrentEp
            ? Number(relMatch![2])
            : saved?.episode || (relMatch ? Number(relMatch[2]) : 1);
      const epKey = `S${targetSeason}E${targetEpisode}`;
      const epSaved = saved?.episodeProgressMap?.[epKey];
      const startSec =
        item.type === 'series'
          ? (epSaved?.currentTime ??
            (saved?.season === targetSeason && saved?.episode === targetEpisode
              ? saved?.currentTime ?? 0
              : 0))
          : (saved?.currentTime ?? 0);

      const initialTorrentMatchesEp =
        item.type !== 'series' ||
        !relMatch ||
        (Number(relMatch[1]) === targetSeason &&
          Number(relMatch[2]) === targetEpisode);
      userSelectedFlTorrentIdRef.current =
        initialTorrentMatchesEp && item.flTorrentId && isLocalHomeServer()
          ? Number(item.flTorrentId)
          : null;
      const normalizedItem: CinemetaItem =
        item.type === 'series'
          ? {
            ...item,
            name:
              item.name
                .replace(/\s*\(S\d+[^)]*\)\s*/gi, '')
                .trim() || item.name,
          }
          : item;
      setIsDirectStreamLoading(true);
      setResolvedDirectStream(null);
      setResolvedFileListStream(null);
      setFallbackYtVideoId(null);
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
      const canUseLocalFl = isLocalHomeServer();
      const savedSrv =
        saved?.server === 'kinogram_hls' ||
          (saved?.server === 'filelist_torrent' && canUseLocalFl)
          ? saved.server
          : undefined;
      const defaultSrv =
        tvSettings.defaultVodServer === 'auto_best' ||
          (tvSettings.defaultVodServer === 'filelist_torrent' && !canUseLocalFl)
          ? 'kinogram_hls'
          : tvSettings.defaultVodServer;
      setActiveServer(
        item.iedemFid || item.id.startsWith('iedem_')
          ? 'kinogram_hls'
          : item.flTorrentId && canUseLocalFl
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
      wakeVodOsd();

      if (startSec > 10) {
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
      }
    },
    [
      watchProgressMap,
      section,
      requestTvFullscreen,
      wakeVodOsd,
      tvSettings.autoFullscreenOnPlay,
      tvSettings.defaultVodServer,
      tvSettings.defaultSubLang,
    ]
  );

  const handleStartVodPlayback = useCallback(
    (customStartSec?: number, openAudioSheet = false) => {
      if (
        tvSettings.autoFullscreenOnPlay &&
        typeof window !== 'undefined' &&
        window.innerWidth >= 640
      ) {
        requestTvFullscreen();
      }
      if (typeof customStartSec === 'number') {
        setResumeStartSeconds(customStartSec);
        if (customStartSec === 0) {
          setPendingResumePromptSec(null);
        }
      } else if (activeVodItem) {
        const saved = watchProgressMap[activeVodItem.id];
        const epKey = `S${selectedSeason}E${selectedEpisode}`;
        const epSaved = saved?.episodeProgressMap?.[epKey];
        const latestSec =
          activeVodItem.type === 'series'
            ? (epSaved?.currentTime ?? saved?.currentTime ?? 0)
            : (saved?.currentTime ?? 0);
        if (latestSec > 10) {
          setResumeStartSeconds(latestSec);
          setPendingResumePromptSec(latestSec);
        }
      }
      setIsSidebarOpen(false);
      setIsPlayingVod(true);
      setIsInfoSheetOpen(openAudioSheet);
      wakeVodOsd();
      window.setTimeout(() => {
        if (openAudioSheet) {
          const firstAudioBtn =
            playerBoxRef.current?.querySelector<HTMLButtonElement>(
              '[data-sheet-audio-btn="true"]'
            );
          (firstAudioBtn || vodAudioBtnRef.current)?.focus();
        } else {
          const playBtn =
            playerBoxRef.current?.querySelector<HTMLButtonElement>(
              '[data-vod-play-btn="true"]'
            );
          playBtn?.focus();
        }
      }, 90);
    },
    [
      activeVodItem,
      watchProgressMap,
      selectedSeason,
      selectedEpisode,
      requestTvFullscreen,
      wakeVodOsd,
      tvSettings.autoFullscreenOnPlay,
    ]
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
            match.url
          );
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
      return;
    }

    if (activeVodItem.id.startsWith('yt_')) {
      setDetailedMeta({ ...activeVodItem });
      setIsDirectStreamLoading(false);
      setIsFileListStreamLoading(false);
      return;
    }

    const itemKey = activeVodItem.id;
    const epKey = `S${selectedSeason}E${selectedEpisode}`;
    setFallbackYtVideoId(null);
    if (lastResolvedItemKeyRef.current !== itemKey) {
      lastResolvedItemKeyRef.current = itemKey;
      lastResolvedEpKeyRef.current = epKey;
      userManuallySelectedServerRef.current = Boolean(
        activeVodItem.flTorrentId && isLocalHomeServer()
      );
      const relMatch = String(
        activeVodItem.releaseTitle || activeVodItem.name || ''
      ).match(/\bS(\d{1,2})[.\s_-]*E(\d{1,2})\b/i);
      const matchesCurrentEp =
        activeVodItem.type !== 'series' ||
        !relMatch ||
        (Number(relMatch[1]) === selectedSeason &&
          Number(relMatch[2]) === selectedEpisode);
      userSelectedFlTorrentIdRef.current =
        matchesCurrentEp && activeVodItem.flTorrentId && isLocalHomeServer()
          ? Number(activeVodItem.flTorrentId)
          : null;
    } else if (lastResolvedEpKeyRef.current !== epKey) {
      lastResolvedEpKeyRef.current = epKey;
      userSelectedFlTorrentIdRef.current = null;
      setResolvedFileListStream(null);
      setResolvedDirectStream(null);
    }

    let cancelled = false;
    setIsDirectStreamLoading(true);
    setDetailedMeta({ ...activeVodItem });

    const isIedemItem = Boolean(
      activeVodItem.iedemFid || activeVodItem.id.startsWith('iedem_')
    );
    const iedemFid =
      activeVodItem.iedemFid ||
      (activeVodItem.id.startsWith('iedem_')
        ? Number(activeVodItem.id.replace(/^iedem_/, ''))
        : 0);

    if (isIedemItem && iedemFid > 0) {
      userManuallySelectedServerRef.current = true;
      setActiveServer('kinogram_hls');
      const iedemQualityLabel = activeVodItem.qualityBadge?.includes('4K')
        ? '4K UHD'
        : '1080p Full HD';

      if (activeVodItem.iedemStreamUrl && activeVodItem.type !== 'series') {
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
            const chosenEp =
              epList.find((e) => e.episode === selectedEpisode) || epList[0];
            const streamTarget = chosenEp?.rawUrl || activeVodItem.iedemStreamUrl || '';
            setResolvedDirectStream({
              ok: Boolean(streamTarget),
              type: 'series',
              sourcePath: `iEdem Mediateka VIP • ${iedemQualityLabel}`,
              title: activeVodItem.name,
              hlsUrl: streamTarget
                ? `/api/tv-proxy?url=${encodeURIComponent(streamTarget)}`
                : undefined,
              audioNames: [`Русский (iEdem VIP • ${iedemQualityLabel})`],
              seasons: [
                {
                  season: selectedSeason || 1,
                  episodes: epList.map((e) => ({
                    episode: e.episode,
                    title: e.title,
                    duration: 0,
                  })),
                },
              ],
            });
          } else {
            const directTarget =
              detail.url ||
              detail.variants?.['auto'] ||
              detail.variants?.['1080'] ||
              activeVodItem.iedemStreamUrl ||
              '';
            if (directTarget) {
              setResolvedDirectStream({
                ok: true,
                type: 'movie',
                sourcePath: `iEdem Mediateka VIP • ${iedemQualityLabel}`,
                title: activeVodItem.name,
                hlsUrl: `/api/tv-proxy?url=${encodeURIComponent(directTarget)}`,
                audioNames: [`Русский (iEdem VIP • ${iedemQualityLabel})`],
              });
            }
          }
        })
        .catch(() => { })
        .finally(() => {
          if (!cancelled) setIsDirectStreamLoading(false);
        });

      // Enrich iEdem item with Kinopoisk metadata (ratings, genres, cast, related movies, trailer)
      const searchCleanTitle = activeVodItem.name
        .replace(/\(\d{4}\)/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/4K|UHD|HDR|FHD|1080p/gi, '')
        .trim();
      if (searchCleanTitle) {
        fetch(
          `https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(
            searchCleanTitle
          )}&page=1`,
          {
            headers: {
              'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
            },
          }
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((searchData) => {
            if (cancelled || !Array.isArray(searchData?.films) || !searchData.films.length) {
              return;
            }
            const targetYear = (activeVodItem.releaseInfo || '').slice(0, 4);
            const matchedFilm =
              searchData.films.find(
                (f: any) =>
                  targetYear &&
                  String(f.year || '').slice(0, 4) === targetYear
              ) || searchData.films[0];
            if (!matchedFilm?.filmId) return;
            const foundKpId = String(matchedFilm.filmId);
            return fetch(
              `https://kinopoiskapiunofficial.tech/api/v2.2/films/${foundKpId}`,
              {
                headers: {
                  'X-API-KEY': '8c8e1a50-6322-4135-8875-5d40a5420d86',
                },
              }
            )
              .then((r) => (r.ok ? r.json() : null))
              .then((kpData) => {
                if (cancelled || !kpData) return;
                const resolvedImdb =
                  typeof kpData.imdbId === 'string' &&
                    kpData.imdbId.startsWith('tt')
                    ? kpData.imdbId
                    : undefined;
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
                const ageStr = kpData.ratingAgeLimits
                  ? `${String(kpData.ratingAgeLimits).replace(/^age/i, '')}+`
                  : undefined;
                const runtimeStr = kpData.filmLength
                  ? `${kpData.filmLength} min`
                  : undefined;
                setDetailedMeta((prev) => {
                  const base = prev || { ...activeVodItem };
                  return {
                    ...base,
                    kpId: foundKpId,
                    imdbId: resolvedImdb || base.imdbId,
                    nameOriginal:
                      kpData.nameOriginal || kpData.nameEn || base.nameOriginal,
                    description:
                      base.description ||
                      kpData.description ||
                      kpData.shortDescription,
                    slogan: kpData.slogan || base.slogan,
                    ratingKinopoisk: kpData.ratingKinopoisk
                      ? String(kpData.ratingKinopoisk)
                      : base.ratingKinopoisk,
                    imdbRating: kpData.ratingImdb
                      ? String(kpData.ratingImdb)
                      : base.imdbRating,
                    country: countriesStr || base.country,
                    genres: genresArr?.length ? genresArr : base.genres,
                    ageRating: ageStr || base.ageRating,
                    runtime: runtimeStr || base.runtime,
                    background:
                      kpData.coverUrl ||
                      base.background ||
                      kpData.posterUrl ||
                      base.poster,
                  };
                });
              });
          })
          .catch(() => { });
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
      fetch(
        `https://v3-cinemeta.strem.io/meta/${activeVodItem.type}/${imdb}.json`
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled && d?.meta) {
            setDetailedMeta((prev) => ({
              ...prev,
              ...d.meta,
              imdbId: imdb,
              kpId: kp || prev?.kpId,
            }));
          }
        })
        .catch(() => { });
    } else if (!kp && activeVodItem.name) {
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

    if (kp) {
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
              return {
                ...base,
                name:
                  uiLang !== 'ru' && origName ? origName : base.name,
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
                  uiLang === 'ru'
                    ? kpData.posterUrl || kpData.posterUrlPreview || base.poster
                    : resolvedImdb
                      ? `https://images.metahub.space/poster/medium/${resolvedImdb}/img`
                      : base.poster || kpData.posterUrl || kpData.posterUrlPreview,
                background:
                  kpData.coverUrl || base.background || kpData.posterUrl,
              };
            });

            // If item was opened by Kinopoisk ID (no initial 'tt') and kpData has imdbId, enrich Cinemeta + FileList + Subtitles
            if (
              !imdb &&
              typeof kpData.imdbId === 'string' &&
              kpData.imdbId.startsWith('tt')
            ) {
              const resolvedTt = kpData.imdbId;
              fetch(
                `https://v3-cinemeta.strem.io/meta/${activeVodItem.type}/${resolvedTt}.json`
              )
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => {
                  if (!cancelled && d?.meta) {
                    setDetailedMeta((prev) => ({
                      ...prev,
                      ...d.meta,
                      name:
                        uiLang !== 'ru'
                          ? d.meta.name || prev?.nameOriginal || prev?.name
                          : prev?.name || d.meta.name,
                      poster:
                        uiLang !== 'ru'
                          ? d.meta.poster ||
                          `https://images.metahub.space/poster/medium/${resolvedTt}/img`
                          : prev?.poster || d.meta.poster,
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
                      imdbId: resolvedTt,
                      kpId: kp || prev?.kpId,
                    }));
                  }
                })
                .catch(() => { });

              if (isLocalHomeServer()) {
                const extraFlParams = new URLSearchParams({
                  type: activeVodItem.type,
                  s: String(selectedSeason),
                  e: String(selectedEpisode),
                  imdb: resolvedTt,
                  q:
                    kpData.nameOriginal ||
                    kpData.nameEn ||
                    activeVodItem.name ||
                    '',
                });
                if (userSelectedFlTorrentIdRef.current) {
                  extraFlParams.set(
                    'id',
                    String(userSelectedFlTorrentIdRef.current)
                  );
                }
                fetch(`/api/filelist/resolve?${extraFlParams.toString()}`)
                  .then((r) => (r.ok ? r.json() : null))
                  .then((flData: ResolvedFileListStream | null) => {
                    if (!cancelled && flData?.ok) {
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
                    }
                  })
                  .catch(() => { });
              }

              if (tvSettings.defaultSubLang !== 'off') {
                autoResolveAndFetchBestRoRuSubtitle({
                  imdbId: resolvedTt,
                  title: activeVodItem.name,
                  nameOriginal: kpData.nameOriginal || kpData.nameEn,
                  type: activeVodItem.type,
                  season: selectedSeason,
                  episode: selectedEpisode,
                  preferredLang: tvSettings.defaultSubLang,
                })
                  .then((subRes) => {
                    if (cancelled || !subRes) return;
                    setActiveSubVttUrl(subRes.vttBlobUrl);
                    setActiveSubLabel(subRes.track.langLabel);
                    setActiveSubCues(subRes.cues);
                    if (
                      subRes.track.langCode2 === 'ro' ||
                      subRes.track.langCode2 === 'ru' ||
                      subRes.track.langCode2 === 'en'
                    ) {
                      setPreferredSubLang(subRes.track.langCode2);
                    }
                  })
                  .catch(() => { });
              }
            }
          }
        })
        .catch(() => { });
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
          if (cancelled || !subRes) return;
          setActiveSubVttUrl(subRes.vttBlobUrl);
          setActiveSubLabel(subRes.track.langLabel);
          setActiveSubCues(subRes.cues);
          if (
            subRes.track.langCode2 === 'ro' ||
            subRes.track.langCode2 === 'ru' ||
            subRes.track.langCode2 === 'en'
          ) {
            setPreferredSubLang(subRes.track.langCode2);
          }
          if (subRes.resolvedImdbId) {
            setDetailedMeta((prev) =>
              prev
                ? { ...prev, imdbId: prev.imdbId || subRes.resolvedImdbId }
                : prev
            );
          }
        })
        .catch(() => { });
    }

    let directResolvedOk = false;
    let flResolvedOk = false;

    resolveDirectVodStreamClient({
      imdb,
      kp,
      title: activeVodItem.name,
      type: activeVodItem.type,
      year: (activeVodItem.releaseInfo || '').slice(0, 4),
      season: selectedSeason,
      episode: selectedEpisode,
    })
      .then((data) => {
        if (cancelled) return;
        setResolvedDirectStream(data);
        directResolvedOk = Boolean(data?.ok && (data.dashUrl || data.hlsUrl));
        if (
          !directResolvedOk &&
          !isLocalHomeServer() &&
          (imdb === 'tt10295772' ||
            activeVodItem.isRo ||
            Boolean(activeVodItem.flTorrentId))
        ) {
          const ytQuery =
            activeVodItem.type === 'series'
              ? `${activeVodItem.name} Sezonul ${selectedSeason} Episodul ${selectedEpisode}`
              : `${activeVodItem.name} ${activeVodItem.releaseInfo || ''} film complet`;
          fetch(`/api/youtube/search?q=${encodeURIComponent(ytQuery.trim())}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((ytData) => {
              if (cancelled || !Array.isArray(ytData?.items) || ytData.items.length === 0) {
                return;
              }
              const bestYt =
                ytData.items.find((x: { durationSec?: number }) => (x.durationSec || 0) >= 600) ||
                ytData.items[0];
              if (bestYt?.videoId) {
                setFallbackYtVideoId(String(bestYt.videoId));
              }
            })
            .catch(() => { });
        }
        // Never override activeServer or audio track if user already picked FileList or another server!
        if (
          userManuallySelectedServerRef.current ||
          userSelectedFlTorrentIdRef.current !== null ||
          (activeVodItem.flTorrentId && isLocalHomeServer())
        ) {
          return;
        }
        if (directResolvedOk) {
          const prefTrackIdx = resolveAudioTrackIndexByPreference(
            data.audioNames || [],
            tvSettings.defaultAudioPref
          );
          setSelectedAudioTrackIdx(prefTrackIdx);
          if (
            tvSettings.defaultVodServer !== 'auto_best' &&
            tvSettings.defaultVodServer !== 'nontongo' &&
            (tvSettings.defaultVodServer !== 'filelist_torrent' || isLocalHomeServer())
          ) {
            setActiveServer(tvSettings.defaultVodServer);
          } else {
            // Always use Native 1080p DASH/HLS Player when direct stream is resolved!
            setActiveServer('kinogram_hls');
          }
        } else if (flResolvedOk && isLocalHomeServer()) {
          setActiveServer('filelist_torrent');
        } else if (
          tvSettings.defaultVodServer !== 'auto_best' &&
          tvSettings.defaultVodServer !== 'kinogram_hls' &&
          tvSettings.defaultVodServer !== 'nontongo' &&
          (tvSettings.defaultVodServer !== 'filelist_torrent' || isLocalHomeServer())
        ) {
          setActiveServer(tvSettings.defaultVodServer);
        } else {
          // Fallback to FileList on local server while loading, or VidSpark/Kinogram Embed
          setActiveServer(
            isLocalHomeServer()
              ? 'filelist_torrent'
              : imdb
                ? 'vidspark'
                : 'kinogram_embed'
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedDirectStream({ ok: false });
          if (
            userManuallySelectedServerRef.current ||
            userSelectedFlTorrentIdRef.current !== null ||
            (activeVodItem.flTorrentId && isLocalHomeServer())
          ) {
            return;
          }
          if (flResolvedOk || isLocalHomeServer()) {
            setActiveServer('filelist_torrent');
            return;
          }
          setActiveServer(
            tvSettings.defaultVodServer !== 'auto_best' &&
              tvSettings.defaultVodServer !== 'kinogram_hls' &&
              tvSettings.defaultVodServer !== 'nontongo' &&
              tvSettings.defaultVodServer !== 'filelist_torrent'
              ? tvSettings.defaultVodServer
              : imdb
                ? 'vidspark'
                : 'kinogram_embed'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsDirectStreamLoading(false);
      });

    // Resolve FileList.io Live Torrents in parallel (Option B: Only on Local Home Server)
    if (isLocalHomeServer()) {
      setIsFileListStreamLoading(true);
      const rawFlQuery = activeVodItem.nameOriginal || activeVodItem.name || '';
      const cleanFlQuery =
        activeVodItem.type === 'series'
          ? rawFlQuery
            .replace(/\s*\(S\d+[^)]*\)\s*/gi, ' ')
            .replace(/\bS\d{1,2}[.\s_-]*E\d{1,2}\b/gi, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim() || rawFlQuery
          : rawFlQuery;
      const flParams = new URLSearchParams({
        type: activeVodItem.type,
        s: String(selectedSeason),
        e: String(selectedEpisode),
        q: cleanFlQuery,
      });
      if (userSelectedFlTorrentIdRef.current) {
        flParams.set('id', String(userSelectedFlTorrentIdRef.current));
      } else if (activeVodItem.flTorrentId && activeVodItem.type !== 'series') {
        flParams.set('id', String(activeVodItem.flTorrentId));
      }
      if (imdb) {
        flParams.set('imdb', imdb);
      }

      fetch(`/api/filelist/resolve?${flParams.toString()}`)
        .then((r) => (r.ok ? r.json() : { ok: false }))
        .then((flData: ResolvedFileListStream) => {
          if (cancelled) return;
          flResolvedOk = Boolean(flData?.ok);
          setResolvedFileListStream(flData);
          if (
            flData?.ok &&
            !userManuallySelectedServerRef.current &&
            (activeVodItem.flTorrentId ||
              userSelectedFlTorrentIdRef.current !== null ||
              !directResolvedOk)
          ) {
            setActiveServer('filelist_torrent');
          } else if (
            !flData?.ok &&
            !userManuallySelectedServerRef.current &&
            userSelectedFlTorrentIdRef.current === null
          ) {
            if (directResolvedOk) {
              setActiveServer('kinogram_hls');
            } else if (!activeVodItem.flTorrentId || imdb) {
              setActiveServer(imdb ? 'vidspark' : 'kinogram_embed');
            }
          }
        })
        .catch(() => {
          if (!cancelled && !userSelectedFlTorrentIdRef.current) {
            setResolvedFileListStream({ ok: false });
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsFileListStreamLoading(false);
          }
        });
    } else {
      setIsFileListStreamLoading(false);
      setResolvedFileListStream(null);
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
  ]);

  // Automatically translate movie/series description & country into the selected UI language (RO / EN / RU)
  useEffect(() => {
    const rawDesc = detailedMeta?.description;
    if (!rawDesc) return;
    let cancelled = false;
    translateTextToLang(rawDesc, uiLang)
      .then((translated) => {
        if (!cancelled && translated && translated !== rawDesc) {
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
      setIsFileListStreamLoading(true);
      setActiveServer('filelist_torrent');
      if (isPlayingVod) {
        const curSaved = watchProgressMap[activeVodItem.id]?.currentTime || 0;
        if (curSaved > 10) {
          setResumeStartSeconds(curSaved);
        }
      }
      if (autoPlay) {
        if (tvSettings.autoFullscreenOnPlay) {
          requestTvFullscreen();
        }
        setIsPlayingVod(true);
      }
      const p = new URLSearchParams({
        id: String(torrentId),
        type: activeVodItem.type,
        s: String(selectedSeason),
        e: String(selectedEpisode),
        q: activeVodItem.nameOriginal || activeVodItem.name || '',
      });
      if (activeVodItem.id.startsWith('tt')) {
        p.set('imdb', activeVodItem.id);
      }
      if (typeof fileIdx === 'number') {
        p.set('fileIdx', String(fileIdx));
      }
      fetch(`/api/filelist/resolve?${p.toString()}`)
        .then((r) => (r.ok ? r.json() : { ok: false }))
        .then((flData: ResolvedFileListStream) => {
          if (
            userSelectedFlTorrentIdRef.current &&
            userSelectedFlTorrentIdRef.current !== torrentId
          ) {
            return;
          }
          const selRel = flData?.selectedTorrent?.releaseTitle || '';
          const seMatch = selRel.match(/\bS(\d{1,2})[.\s_-]*E(\d{1,2})\b/i);
          if (seMatch) {
            const parsedS = Number(seMatch[1]);
            const parsedE = Number(seMatch[2]);
            if (parsedS > 0 && parsedE > 0) {
              setSelectedSeason(parsedS);
              setSelectedEpisode(parsedE);
            }
          }
          setResolvedFileListStream((prev) => ({
            ...flData,
            torrents:
              flData.torrents && flData.torrents.length > 0
                ? flData.torrents
                : prev?.torrents,
          }));
        })
        .catch(() => { })
        .finally(() => {
          setIsFileListStreamLoading(false);
        });
    },
    [
      activeVodItem,
      isPlayingVod,
      watchProgressMap,
      selectedSeason,
      selectedEpisode,
      tvSettings.autoFullscreenOnPlay,
      requestTvFullscreen,
    ]
  );

  const flQualityOptions = useMemo<VodExternalQualityOption[]>(() => {
    const flList =
      resolvedFileListStream?.torrents &&
        resolvedFileListStream.torrents.length > 0
        ? resolvedFileListStream.torrents
        : resolvedFileListStream?.selectedTorrent
          ? [resolvedFileListStream.selectedTorrent]
          : [];
    return flList.map((tor) => ({
      id: `fl_q_${tor.id}`,
      label: `${tor.quality || '1080p Full HD'}${tor.isRo ? ' • 🇷🇴 RO' : ''}${tor.source === 'torrentio' ? ' • Torrentio' : ' • FileList'
        }`,
      badge: `▲ ${tor.seeders} • 💾 ${tor.sizeFormatted}${tor.audioInfo ? ` • ${tor.audioInfo}` : ''
        }`,
      subLabel: tor.releaseTitle || tor.name,
      active:
        activeServer === 'filelist_torrent' &&
        resolvedFileListStream?.torrentId === tor.id,
      onSelect: () => {
        handleSelectFileListTorrent(tor.id, tor.fileIdx, true);
      },
    }));
  }, [resolvedFileListStream, activeServer, handleSelectFileListTorrent]);

  // Seasons & Episodes list for Series
  const seasonsMap = useMemo(() => {
    const cleanEpisodeTitle = (rawTitle?: string, epNum?: number): string => {
      const t = (rawTitle || '').trim();
      if (!t) return '';
      if (/\(\s*\d+\s*сезон\s*\)/i.test(t) || /\d+\s*серия/i.test(t)) {
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

    const metaVideos = detailedMeta?.videos || [];
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

    const map = new Map<number, SeriesEpisode[]>();
    if (
      resolvedDirectStream?.seasons &&
      resolvedDirectStream.seasons.length > 0
    ) {
      for (const s of resolvedDirectStream.seasons) {
        map.set(
          s.season,
          s.episodes.map((ep) => {
            const metaEp = metaVideoMap.get(`${s.season}_${ep.episode}`);
            return {
              ...metaEp,
              id: metaEp?.id || `kp_${s.season}_${ep.episode}`,
              name:
                metaEp?.name ||
                cleanEpisodeTitle(ep.title, ep.episode),
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
      const enriched: SeriesEpisode = {
        ...v,
        name: cleanEpisodeTitle(v.name, epNum) || list[existingIdx]?.name || '',
        season: sNum,
        episode: epNum,
      };
      if (existingIdx >= 0) {
        list[existingIdx] = { ...list[existingIdx], ...enriched };
      } else {
        list.push(enriched);
      }
      list.sort((a, b) => a.episode - b.episode);
      map.set(sNum, list);
    }

    // Also include any higher season/episode numbers discovered on FileList.io (e.g. Asia Express S07E19..S07E35)
    const flTorrents = resolvedFileListStream?.torrents || [];
    for (const tor of flTorrents) {
      const m = String(tor.releaseTitle || '').match(
        /\bS(\d{1,2})[.\s_-]*E(\d{1,2})\b/i
      );
      if (!m) continue;
      const sNum = Number(m[1]);
      const eMax = Number(m[2]);
      if (!sNum || !eMax || eMax > 100) continue;
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

    return map;
  }, [detailedMeta, resolvedDirectStream, resolvedFileListStream]);

  const availableSeasons = useMemo(
    () => Array.from(seasonsMap.keys()).sort((a, b) => a - b),
    [seasonsMap]
  );

  const episodesForSeason = useMemo(
    () => seasonsMap.get(selectedSeason) || [],
    [seasonsMap, selectedSeason]
  );

  const updateWatchProgress = useCallback(
    (
      item: CinemetaItem,
      season: number,
      episode: number,
      currentTime: number,
      duration: number
    ) => {
      const cleanTime = Math.max(0, Math.floor(currentTime || 0));
      const cleanDur =
        duration && Number.isFinite(duration) && duration > 60
          ? Math.floor(duration)
          : item.type === 'series'
            ? 2700
            : 5400;

      const seasonEpsCount = seasonsMap.get(season)?.length || 0;
      const totalSeasonsCount = availableSeasons.length || 0;

      setWatchProgressMap((prev) => {
        const existing = prev[item.id];
        const epKey = `S${season}E${episode}`;
        const mergedItem: CinemetaItem = { ...existing?.item, ...item };
        if (mergedItem.type === 'series') {
          mergedItem.name =
            mergedItem.name.replace(/\s*\(S\d+[^)]*\)\s*/gi, '').trim() ||
            mergedItem.name;
          if (
            activeServer === 'filelist_torrent' &&
            resolvedFileListStream?.ok &&
            resolvedFileListStream.torrentId
          ) {
            mergedItem.flTorrentId = resolvedFileListStream.torrentId;
            if (resolvedFileListStream.selectedTorrent?.releaseTitle) {
              mergedItem.releaseTitle =
                resolvedFileListStream.selectedTorrent.releaseTitle;
            }
          }
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
          isPlayingNow: true,
          totalEpisodesInSeason:
            seasonEpsCount > 0
              ? seasonEpsCount
              : existing?.totalEpisodesInSeason,
          totalSeasons:
            totalSeasonsCount > 0 ? totalSeasonsCount : existing?.totalSeasons,
          episodeProgressMap: {
            ...(existing?.episodeProgressMap || {}),
            [epKey]: {
              currentTime: cleanTime,
              duration: cleanDur,
              updatedAt: Date.now(),
            },
          },
        };
        const next = { ...prev, [item.id]: nextEntry };
        saveWatchProgressMap(next, activeProfileId);
        return next;
      });
    },
    [
      activeProfileId,
      activeServer,
      preferredSubLang,
      seasonsMap,
      availableSeasons.length,
      resolvedFileListStream,
    ]
  );

  // Real-time Cross-Device Playback Heartbeat while a video is playing on this device
  useEffect(() => {
    if (!isPlayingVod || !activeVodItem) return;
    const activeId = activeVodItem.id;
    const curDevName = detectCurrentDeviceName();
    const curDevId = getOrCreateCurrentDeviceId();

    const markPlayingState = (playing: boolean) => {
      setWatchProgressMap((prev) => {
        const cur = prev[activeId];
        if (!cur) return prev;
        const next: Record<string, VodWatchProgressEntry> = {
          ...prev,
          [activeId]: {
            ...cur,
            deviceName: curDevName,
            deviceId: curDevId,
            isPlayingNow: playing,
            updatedAt: Date.now(),
          },
        };
        saveWatchProgressMap(next, activeProfileId);
        return next;
      });
    };

    markPlayingState(true);
    const hb = window.setInterval(() => {
      markPlayingState(true);
    }, 5000);

    const handlePageUnload = () => {
      markPlayingState(false);
    };
    window.addEventListener('beforeunload', handlePageUnload);
    window.addEventListener('pagehide', handlePageUnload);

    return () => {
      window.clearInterval(hb);
      window.removeEventListener('beforeunload', handlePageUnload);
      window.removeEventListener('pagehide', handlePageUnload);
      markPlayingState(false);
    };
  }, [isPlayingVod, activeVodItem?.id, activeProfileId]);

  // Auto-hide resume prompt after 6 seconds so it never clutters the video screen
  useEffect(() => {
    if (pendingResumePromptSec === null) return;
    const t = window.setTimeout(() => setPendingResumePromptSec(null), 6000);
    return () => window.clearTimeout(t);
  }, [pendingResumePromptSec]);

  // Sync watch progress & saved favorites across devices (4s on Home Wi-Fi, 120s smart sync on Netlify / 4G / 5G)
  useEffect(() => {
    const syncProgressAndSaved = () => {
      const local = loadWatchProgressMap(activeProfileId);
      fetch(
        `/api/tv-progress?profileId=${encodeURIComponent(activeProfileId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(local),
        }
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((remote: Record<string, VodWatchProgressEntry> | null) => {
          if (!remote || typeof remote !== 'object') return;
          setWatchProgressMap((prev) => {
            const merged = { ...prev };
            let changed = false;
            const localFl = isLocalHomeServer();
            for (const [k, v] of Object.entries(remote)) {
              if (!v || typeof v !== 'object' || !v.item) continue;
              const cleanEntry: VodWatchProgressEntry = {
                ...v,
                deviceName: v.deviceName
                  ? sanitizeDeviceName(v.deviceName)
                  : v.deviceName,
                server:
                  !localFl &&
                    (v.server === 'filelist_torrent' || v.server === 'vidspark')
                    ? 'kinogram_hls'
                    : v.server,
              };
              const existing = merged[k];
              if (
                !existing ||
                (cleanEntry.updatedAt || 0) > (existing.updatedAt || 0) ||
                existing.deviceName !== sanitizeDeviceName(existing.deviceName)
              ) {
                merged[k] = cleanEntry;
                changed = true;
              }
            }
            if (changed) {
              try {
                localStorage.setItem(
                  getWatchProgressKeyForProfile(activeProfileId),
                  JSON.stringify(merged)
                );
              } catch {
                // ignore
              }
              return merged;
            }
            return prev;
          });
        })
        .catch(() => { });

      const localSaved = loadSavedVodItems(activeProfileId);
      fetch(`/api/tv-saved?profileId=${encodeURIComponent(activeProfileId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localSaved),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((remoteSaved: CinemetaItem[] | null) => {
          if (Array.isArray(remoteSaved) && remoteSaved.length > 0) {
            setSavedVodItems((prev) => {
              const seen = new Set(prev.map((x) => x.id));
              const merged = [...prev];
              let changed = false;
              for (const item of remoteSaved) {
                if (item && item.id && !seen.has(item.id)) {
                  seen.add(item.id);
                  merged.push(item);
                  changed = true;
                }
              }
              if (changed) {
                try {
                  localStorage.setItem(
                    getSavedVodKeyForProfile(activeProfileId),
                    JSON.stringify(merged)
                  );
                } catch {
                  // ignore
                }
                return merged;
              }
              return prev;
            });
          }
        })
        .catch(() => { });
    };

    syncProgressAndSaved();
    const intervalMs = isLocalHomeServer() ? 4000 : 120000;
    const timer = window.setInterval(syncProgressAndSaved, intervalMs);
    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        syncProgressAndSaved();
      }
    };
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
  }, [activeProfileId]);

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
      handleSelectProfile(urlProf);
    }
    setIsProfilePickerOpen(false);
    const sNum = Number(params.get('s')) || 1;
    const eNum = Number(params.get('e')) || 1;
    const tSec = Number(params.get('t')) || 0;
    const mType = params.get('type') === 'series' ? 'series' : 'movie';

    const existingEntry = watchProgressMap[resumeId];
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

  const toggleSaveVodItem = (item: CinemetaItem) => {
    setSavedVodItems((prev) => {
      const exists = prev.some((x) => x.id === item.id);
      const next = exists
        ? prev.filter((x) => x.id !== item.id)
        : [item, ...prev];
      saveSavedVodItems(next, activeProfileId);
      return next;
    });
  };

  const historyList = useMemo(() => {
    return Object.values(watchProgressMap)
      .filter((e) => e && e.item && e.currentTime >= 5)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [watchProgressMap]);

  const handleRemoveWatchProgressItem = useCallback(
    (vodId: string) => {
      setWatchProgressMap((prev) => {
        const cur = prev[vodId];
        if (!cur) return prev;
        const next: Record<string, VodWatchProgressEntry> = {
          ...prev,
          [vodId]: {
            ...cur,
            currentTime: 0,
            updatedAt: Date.now(),
            episodeProgressMap: {},
          },
        };
        saveWatchProgressMap(next, activeProfileId);
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
          next[k] = {
            ...v,
            currentTime: 0,
            updatedAt: now,
            episodeProgressMap: {},
          };
        }
      }
      saveWatchProgressMap(next, activeProfileId);
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

  // Automatically enrich watch history entries with exact episode count (Ep. X din Y) & runtime duration
  const enrichedHistoryIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const entry of historyList) {
      const id = entry.item.id;
      const needsSeriesEps =
        entry.item.type === 'series' && !entry.totalEpisodesInSeason;
      const needsMovieDur =
        entry.item.type === 'movie' &&
        (!entry.duration || entry.duration === 5400);
      if (
        (!needsSeriesEps && !needsMovieDur) ||
        enrichedHistoryIdsRef.current.has(id)
      ) {
        continue;
      }
      enrichedHistoryIdsRef.current.add(id);

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
              const next: Record<string, VodWatchProgressEntry> = {
                ...prev,
                [id]: {
                  ...cur,
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
    if (!entry || entry.currentTime <= 5) return null;
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
      <div className="absolute inset-x-0 bottom-0 z-10 pt-8 pb-2 px-2.5 bg-gradient-to-t from-black/95 via-black/80 to-transparent flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-1">
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-extrabold tabular-nums transition-colors ${isLiveActive
              ? 'bg-[#1e3a8a] text-white border border-[#3b82f6]/50 shadow-[0_2px_12px_rgba(96,165,250,0.55)] ring-1 ring-blue-300'
              : 'bg-white text-[#141414] shadow'
              }`}
          >
            ▶ {formatWatchSeconds(entry.currentTime)} /{' '}
            {formatWatchSeconds(totalDur)}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold tabular-nums ${isLiveActive
              ? 'bg-[#0d1f38]/95 border border-[#60a5fa]/50 text-[#93c5fd]'
              : 'bg-[#0b182b]/90 border border-[#60a5fa]/35 text-[#93c5fd]'
              }`}
          >
            {pct}%
          </span>
        </div>
        {isSeries && (
          <div className="flex items-center justify-between gap-1 text-[10px] font-extrabold text-[#bfdbfe] bg-[#0d1f38]/90 border border-[#60a5fa]/40 rounded-md px-2 py-0.5">
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

  return (
    <div
      ref={rootContainerRef}
      data-tv-theme={tvSettings.tvTheme || 'dark'}
      onScroll={(e) => {
        if (e.currentTarget === e.target) {
          if (e.currentTarget.scrollTop !== 0) e.currentTarget.scrollTop = 0;
          if (e.currentTarget.scrollLeft !== 0) e.currentTarget.scrollLeft = 0;
        }
      }}
      className="fixed inset-0 z-40 bg-[#181818] text-zinc-100 flex flex-col overflow-hidden select-none transition-colors duration-300"
    >
      {/* Full-Bleed Sharp Lampa Movie Backdrop when viewing Movie Content Page */}
      {(activeVodItem?.background ||
        detailedMeta?.background ||
        activeVodItem?.poster) &&
        !isPlayingVod && (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#10141d] transition-opacity duration-500"
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

      {/* TOP FULL-WIDTH LAMPA HEADER BAR (Identical to Lampa screenshot) */}
      {!isAnyFullModePlayer && (
        <header
          className={`relative z-20 h-14 sm:h-16 px-3 sm:px-7 flex items-center justify-between gap-2 sm:gap-4 shrink-0 ${activeVodItem ? 'bg-transparent' : 'bg-[#141414]'
            }`}
        >
          {/* Left: < Back (when viewing movie/series) + ☰ Menu + Section Name */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            {activeVodItem && (
              <button
                type="button"
                title={tr(
                  'Înapoi la catalog',
                  'Back to catalog',
                  'Назад к списку'
                )}
                onClick={() => {
                  setIsPlayingVod(false);
                  setIsInfoSheetOpen(false);
                  setActiveVodItem(null);
                  if (typeof window === 'undefined' || window.innerWidth >= 768) {
                    setIsSidebarOpen(true);
                  }
                }}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-zinc-100 hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.4]" />
              </button>
            )}
            <button
              type="button"
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
              title={tr('Meniu Lateral (☰)', 'Sidebar Menu (☰)', 'Меню (☰)')}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${isSidebarOpen && activeVodItem
                ? 'bg-white text-[#141414]'
                : 'text-zinc-200 hover:bg-white/10 focus:bg-white focus:text-zinc-950'
                }`}
            >
              <Menu className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
            </button>

            <SmartCinemaLogo size="md" className="ml-0.5 sm:ml-1 shrink-0" />
          </div>

          {/* Right: Lampa Utility Icons + Clock + 2-Line Date */}
          <div className="flex items-center gap-1.5 sm:gap-3.5 shrink-0">
            {currentStation && (
              <div className="inline-flex items-center rounded-full bg-blue-500/20 border border-blue-500/40 overflow-hidden shadow">
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
                  className="h-8 pl-2 pr-2 sm:pr-2.5 text-blue-300 hover:bg-blue-500/30 focus:bg-white focus:text-[#141414] focus:outline-none text-xs font-bold inline-flex items-center gap-1.5 sm:gap-2 transition-colors cursor-pointer"
                >
                  {activeRadioTrack?.coverUrl ? (
                    <img
                      src={activeRadioTrack.coverUrl}
                      alt=""
                      className="w-5 h-5 rounded-full object-cover shrink-0 border border-white/20"
                    />
                  ) : (
                    <Volume2
                      className={`w-3.5 h-3.5 shrink-0 ${playerStatus === 'playing' ? 'animate-pulse' : ''
                        }`}
                    />
                  )}
                  <span className="hidden sm:inline max-w-[190px] truncate">
                    {activeRadioTrack
                      ? `${currentStation.name} • ${activeRadioTrack.artist
                        ? `${activeRadioTrack.artist} - ${activeRadioTrack.title}`
                        : activeRadioTrack.title
                      }`
                      : currentStation.name}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => playStation(currentStation)}
                  title={
                    playerStatus === 'playing' || playerStatus === 'loading'
                      ? tr('Pauză Radio', 'Pause Radio', 'Пауза радио')
                      : tr('Redă Radio', 'Play Radio', 'Включить радио')
                  }
                  className="h-8 px-2 sm:px-2.5 border-l border-blue-500/30 text-blue-300 hover:bg-blue-400 hover:text-[#141414] focus:bg-white focus:text-[#141414] focus:outline-none inline-flex items-center justify-center transition-colors cursor-pointer"
                >
                  {playerStatus === 'loading' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : playerStatus === 'playing' ? (
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
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
                  className="h-8 px-2 sm:px-2.5 border-l border-blue-500/30 text-rose-300 hover:bg-rose-500 hover:text-white focus:bg-rose-500 focus:text-white focus:outline-none inline-flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {!currentStation && currentMusicTrack && (
              <div
                className={`${section === 'music' && !activeVodItem
                    ? 'hidden sm:inline-flex'
                    : 'inline-flex'
                  } items-center rounded-full bg-[#2563eb]/20 border border-[#60a5fa]/45 overflow-hidden shadow`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveVodItem(null);
                    setSection('music');
                    rootContainerRef.current
                      ?.querySelector('main')
                      ?.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  title={tr(
                    'Deschide Spotify Music Player',
                    'Open Spotify Music Player',
                    'Открыть Spotify Музыку'
                  )}
                  className="h-8 pl-2 pr-2 sm:pr-2.5 text-[#60a5fa] hover:bg-[#2563eb]/30 focus:bg-white focus:text-[#141414] focus:outline-none text-xs font-bold inline-flex items-center gap-1.5 sm:gap-2 transition-colors cursor-pointer"
                >
                  <img
                    src={currentMusicTrack.coverSmall || currentMusicTrack.cover}
                    alt=""
                    className={`w-5 h-5 rounded-full object-cover shrink-0 border border-[#60a5fa]/40 ${isMusicPlaying ? 'animate-[spin_6s_linear_infinite]' : ''
                      }`}
                  />
                  <span className="hidden sm:inline max-w-[180px] truncate">
                    {currentMusicTrack.artist} — {currentMusicTrack.title}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleToggleMusicPlayPause}
                  title={
                    isMusicPlaying
                      ? tr('Pauză Muzică', 'Pause Music', 'Пауза')
                      : tr('Redă Muzică', 'Play Music', 'Слушать')
                  }
                  className="h-8 px-2 sm:px-2.5 border-l border-[#60a5fa]/30 text-[#60a5fa] hover:bg-[#1e3a8a] hover:text-white focus:bg-white focus:text-[#141414] focus:outline-none inline-flex items-center justify-center transition-colors cursor-pointer"
                >
                  {isMusicPlaying ? (
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleNextMusicTrack}
                  title={tr('Piesa următoare', 'Next track', 'Следующий трек')}
                  className="hidden sm:inline-flex h-8 px-2 border-l border-[#60a5fa]/30 text-[#60a5fa] hover:bg-[#1e3a8a] hover:text-white focus:bg-white focus:text-[#141414] focus:outline-none items-center justify-center transition-colors cursor-pointer"
                >
                  <SkipForward className="w-3.5 h-3.5 fill-current" />
                </button>
                <button
                  type="button"
                  onClick={handleStopAndCloseMusic}
                  title={tr(
                    'Oprește Muzica și închide',
                    'Stop Music and close',
                    'Остановить музыку и закрыть'
                  )}
                  className="h-8 px-2 sm:px-2.5 border-l border-[#60a5fa]/30 text-rose-300 hover:bg-rose-500 hover:text-white focus:bg-rose-500 focus:text-white focus:outline-none inline-flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

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
              title={tr('Căutare', 'Search', 'Поиск')}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 focus:bg-white focus:text-zinc-950 focus:outline-none transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Bell Icon with Red Dot -> Opens New Episodes Calendar */}
            <button
              type="button"
              onClick={() => {
                setActiveVodItem(null);
                setSection('calendar');
              }}
              title={tr('Calendar Episoade Noi (Seriale Favorite)', 'New Episodes Calendar (Favorite Series)', 'Календарь новых серий (Избранное)')}
              className="hidden sm:flex relative w-9 h-9 rounded-full items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 focus:bg-white focus:text-zinc-950 focus:outline-none transition-colors cursor-pointer"
            >
              <Bell className="w-5 h-5" />
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
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full border flex items-center justify-center transition-all focus:bg-white focus:!text-zinc-950 focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer ${tvSettings.tvTheme === 'ambient'
                  ? 'bg-amber-400/20 border-amber-300/50 text-amber-200 hover:bg-amber-400/30 shadow-sm'
                  : 'bg-white/10 border-white/15 text-zinc-300 hover:text-white hover:bg-white/15'
                }`}
            >
              {tvSettings.tvTheme === 'ambient' ? (
                <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300 shrink-0" />
              ) : (
                <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-300 shrink-0" />
              )}
            </button>

            {/* Active Profile Icon-Only Button ("Who's watching? / Conturi & PIN") */}
            <button
              type="button"
              onClick={() => {
                setIsHandoffModalOpen(true);
              }}
              title={tr(
                `Cont activ: ${activeProfile.name} (Click pentru a schimba sau crea un cont cu Poză & PIN)`,
                `Active Account: ${activeProfile.name} (Click to switch or create account with Photo & PIN)`,
                `Аккаунт: ${activeProfile.name} (Нажмите для смены или создания профиля с фото и PIN)`
              )}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full p-0.5 bg-white/10 hover:bg-white/25 focus:ring-2 focus:ring-white focus:outline-none border border-white/20 flex items-center justify-center transition-all cursor-pointer shrink-0"
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
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Fullscreen Icon */}
            <button
              type="button"
              onClick={() => {
                if (
                  !document.fullscreenElement &&
                  document.documentElement.requestFullscreen
                ) {
                  document.documentElement.requestFullscreen().catch(() => { });
                } else if (document.exitFullscreen) {
                  document.exitFullscreen().catch(() => { });
                }
              }}
              title="Ecran Complet TV"
              className="hidden sm:flex w-9 h-9 rounded-full items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 focus:bg-white focus:text-zinc-950 focus:outline-none transition-colors cursor-pointer"
            >
              <Maximize2 className="w-5 h-5" />
            </button>

            {/* Reload Icon */}
            <button
              type="button"
              onClick={() => window.location.reload()}
              title="Reîncarcă Aplicația TV"
              className="hidden sm:flex w-9 h-9 rounded-full items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 focus:bg-white focus:text-zinc-950 focus:outline-none transition-colors cursor-pointer"
            >
              <RefreshCw className="w-5 h-5" />
            </button>

            {/* Lampa 3-Dot Status Indicator */}
            <div className="hidden md:flex flex-col items-center gap-1 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span className="w-1 h-1 rounded-full bg-zinc-500" />
              <span className="w-1 h-1 rounded-full bg-zinc-500" />
            </div>

            {/* Lampa Clock + 2-Line Date */}
            <div className="hidden sm:flex items-center gap-2.5 pl-1">
              <div className="text-xl sm:text-[26px] font-bold tracking-tight text-white tabular-nums leading-none">
                {clockText}
              </div>
              <div className="hidden lg:flex flex-col text-[11px] leading-tight text-zinc-300 font-normal">
                <span>{dateLine1}</span>
                <span className="text-zinc-400">{dateLine2}</span>
              </div>
            </div>
          </div>
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
        {/* Mobile Backdrop for Slide-Over Menu Drawer */}
        {!isAnyFullModePlayer && isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden fixed inset-0 z-30 bg-black/70 backdrop-blur-xs"
          />
        )}

        {/* LEFT LAMPA NAVIGATION SIDEBAR (Slide-over drawer on mobile with full labels; fixed sidebar on Desktop/TV) */}
        {!isAnyFullModePlayer && isSidebarOpen && (
          <aside
            aria-label="Meniu Principal Smart TV Lampa"
            className={`fixed md:static top-15 bottom-15 left-2 z-40 w-60 md:w-56 md:my-2 md:ml-3 py-2.5 px-3 rounded-[28px] overflow-y-auto shrink-0 no-scrollbar tahoe-glass flex flex-col justify-between shadow-2xl md:shadow-none ${activeVodItem
              ? 'z-40'
              : ''
              }`}
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
                    label: tr('iEdem', 'iEdem', 'iEdem'),
                    Icon: Film,
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
              ).map(({ id, label, Icon }) => {
                const isActive = section === id && !activeVodItem;
                return (
                  <button
                    key={id}
                    type="button"
                    data-sidebar-active={isActive ? 'true' : undefined}
                    onClick={() => {
                      setActiveVodItem(null);
                      if (typeof window !== 'undefined' && window.innerWidth < 768) {
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
                    ) : (
                      <Icon className="w-5 h-5 mr-3.5 shrink-0 stroke-[1.8]" />
                    )}
                    <span className="inline truncate flex-1 text-left">
                      {label}
                    </span>
                    {id === 'downloads' &&
                      (activeDownloadProgress ? (
                        <Loader2 className="w-4 h-4 ml-1.5 text-blue-400 animate-spin shrink-0" />
                      ) : offlineItems.length > 0 ? (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-blue-500/25 border border-blue-400/40 text-blue-200 text-[10px] font-extrabold tabular-nums shrink-0">
                          {offlineItems.length}
                        </span>
                      ) : null)}
                  </button>
                );
              })}

              {/* Compact Streaming Platforms Hub in Left Sidebar (1 single row + mini badge pills when active, instead of 7 stretched vertical rows) */}
              <div className="pt-1.5 pb-1.5 my-1 border-y border-white/10 space-y-1.5">
                {(() => {
                  const isAnyPlatActive =
                    (isStreamingPlatformSection(section) ||
                      section === 'youtube') &&
                    !activeVodItem;
                  const activePlatObj = STREAMING_PLATFORMS.find(
                    (p) => p.id === section
                  );
                  return (
                    <>
                      <button
                        type="button"
                        data-sidebar-active={isAnyPlatActive ? 'true' : undefined}
                        onClick={() => {
                          setActiveVodItem(null);
                          if (typeof window !== 'undefined' && window.innerWidth < 768) {
                            setIsSidebarOpen(false);
                          } else {
                            setIsSidebarOpen(true);
                          }
                          setIsFilterDrawerOpen(false);
                          setIsCatalogDrawerOpen(false);
                          if (
                            !isStreamingPlatformSection(section) &&
                            section !== 'youtube'
                          ) {
                            setPlatformMediaTab('series');
                            setSection('netflix');
                          }
                        }}
                        className={`w-full min-h-[42px] px-4 py-2 rounded-full overflow-hidden flex items-center justify-between gap-2 text-[15px] transition-none focus:outline-none cursor-pointer ${isAnyPlatActive
                          ? 'bg-white text-[#141414] font-semibold group-focus-within/sidebar:bg-transparent group-focus-within/sidebar:text-zinc-300 focus:!bg-white focus:!text-[#141414]'
                          : 'text-zinc-300 hover:bg-white/10 hover:text-white focus:bg-white focus:text-[#141414] focus:font-semibold'
                          }`}
                      >
                        <span className="flex items-center gap-3.5 min-w-0">
                          <Layers className="w-5 h-5 shrink-0 stroke-[1.8]" />
                          <span className="inline truncate">
                            {tr('Platforme', 'Platforms', 'Платформы')}
                          </span>
                        </span>
                        {section === 'youtube' || activePlatObj ? (
                          <StreamingPlatformLogo
                            platformId={
                              section === 'youtube'
                                ? 'youtube'
                                : activePlatObj!.id
                            }
                            size="xs"
                            className="inline-flex"
                          />
                        ) : (
                          <span className="inline-flex min-w-[26px] h-5 px-1.5 rounded-md text-[10px] font-black tracking-tight items-center justify-center shrink-0 shadow-sm bg-white/15 text-zinc-200 border border-white/15">
                            7
                          </span>
                        )}
                      </button>

                      {/* Compact 2-Row Original Brand Logos Grid inside Sidebar */}
                      <div className="grid grid-cols-4 gap-1.5 px-2 pt-0.5">
                        {STREAMING_PLATFORMS.map((plat) => {
                          const isActive =
                            section === plat.id && !activeVodItem;
                          return (
                            <button
                              key={plat.id}
                              type="button"
                              title={plat.label}
                              onClick={() => {
                                setActiveVodItem(null);
                                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                                  setIsSidebarOpen(false);
                                } else {
                                  setIsSidebarOpen(true);
                                }
                                setIsFilterDrawerOpen(false);
                                setIsCatalogDrawerOpen(false);
                                setPlatformMediaTab('series');
                                setSection(plat.id);
                              }}
                              className={`rounded-lg inline-flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer ${isActive
                                ? 'ring-2 ring-white scale-105 shadow-[0_0_14px_rgba(255,255,255,0.45)]'
                                : 'opacity-90 hover:opacity-100 hover:scale-105'
                                }`}
                            >
                              <StreamingPlatformLogo
                                platformId={plat.id}
                                size="sm"
                                className="w-full"
                              />
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          title="YouTube Premium"
                          onClick={() => {
                            setActiveVodItem(null);
                            if (typeof window !== 'undefined' && window.innerWidth < 768) {
                              setIsSidebarOpen(false);
                            } else {
                              setIsSidebarOpen(true);
                            }
                            setIsFilterDrawerOpen(false);
                            setIsCatalogDrawerOpen(false);
                            setSection('youtube');
                          }}
                          className={`col-span-2 rounded-lg inline-flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer ${section === 'youtube' && !activeVodItem
                            ? 'ring-2 ring-white scale-105 shadow-[0_0_14px_rgba(255,255,255,0.45)]'
                            : 'opacity-90 hover:opacity-100 hover:scale-105'
                            }`}
                        >
                          <StreamingPlatformLogo
                            platformId="youtube"
                            size="sm"
                            className="w-full"
                          />
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Smart TV Settings inside Lampa Left Sidebar */}
              <div className="pt-2 mt-2 border-t border-white/10 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined' && window.innerWidth < 768) {
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
                    if (typeof window !== 'undefined' && window.innerWidth < 768) {
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
              const posterUrl =
                activeEntry.item.poster ||
                `https://images.metahub.space/poster/medium/${activeEntry.item.id}/img`;

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
            className={
              isPlayingVod
                ? 'flex-1 min-h-0 overflow-hidden p-0 m-0'
                : section === 'tv' && !activeVodItem
                  ? 'flex-1 min-h-0 overflow-y-auto px-2 sm:px-6 pt-1.5 pb-2 sm:pb-4 space-y-3'
                  : 'flex-1 min-h-0 overflow-y-auto px-3 sm:px-8 pt-2 pb-5 space-y-5 sm:space-y-6'
            }
          >
            {/* 1A. ACTIVE MOVIE / SERIES 100% FULL MODE CINEMA PLAYER (WHEN PLAYING) */}
            {activeVodItem && isPlayingVod ? (
              <div
                ref={playerBoxRef}
                onMouseMove={() => {
                  if (Date.now() - lastBackHideOsdAtRef.current < 700) {
                    return;
                  }
                  wakeVodOsd();
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
                onClick={wakeVodOsd}
                data-vod-full-player="true"
                className={
                  isMobileCustomFullscreen && isPortraitViewport
                    ? "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100dvh] h-[100vw] rotate-90 z-[9999] bg-black flex flex-col overflow-hidden"
                    : "fixed inset-0 z-[200] w-full h-[100dvh] sm:w-screen sm:h-screen bg-[#090b10] flex flex-col overflow-hidden"
                }
              >
                {/* MINIMAL FLOATING TOP CONTROLS (No duplicated title/poster — Cinema Card is in Bottom Dock) */}
                <div
                  onMouseEnter={wakeVodOsd}
                  className={`absolute top-3 sm:top-5 inset-x-3 sm:inset-x-7 z-30 flex items-center justify-between gap-2 sm:gap-3 transition-all duration-300 pointer-events-none ${isVodOsdVisible ||
                    isEpisodesDrawerOpen ||
                    isInfoSheetOpen ||
                    (!activeVodItem.id.startsWith('yt_') &&
                      activeServer !== 'kinogram_hls' &&
                      activeServer !== 'filelist_torrent') ||
                    (!activeVodItem.id.startsWith('yt_') &&
                      activeServer === 'kinogram_hls' &&
                      !isDirectStreamLoading &&
                      !(
                        resolvedDirectStream?.ok &&
                        (resolvedDirectStream.dashUrl ||
                          resolvedDirectStream.hlsUrl)
                      )) ||
                    (!activeVodItem.id.startsWith('yt_') &&
                      activeServer === 'filelist_torrent' &&
                      !isFileListStreamLoading &&
                      !(
                        resolvedFileListStream?.ok &&
                        resolvedFileListStream.streamUrl
                      ))
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 -translate-y-2'
                    }`}
                >
                  {/* Left: Clean Floating Back Button + Mobile Title */}
                  <div className="flex items-center gap-2 min-w-0 pointer-events-auto">
                    <button
                      type="button"
                      data-vod-top-back-btn="true"
                      onClick={() => {
                        setIsPlayingVod(false);
                        if (activeVodItem.id.startsWith('yt_')) {
                          setActiveVodItem(null);
                          setIsSidebarOpen(true);
                        }
                      }}
                      className="h-9 sm:h-11 px-3.5 sm:px-5 rounded-full tahoe-emerald-card hover:bg-[#193144] focus:bg-[#1e3a8a] focus:text-white focus:outline-none focus:ring-4 focus:ring-[#60a5fa] text-white font-extrabold text-xs sm:text-sm inline-flex items-center gap-1.5 sm:gap-2 transition-all shrink-0 cursor-pointer group"
                    >
                      <ArrowLeft className="w-4 h-4 text-[#60a5fa] group-focus:text-[#081220]" />
                      <span>
                        {tr('Înapoi', 'Back', 'Назад')}
                      </span>
                    </button>

                    {/* Mobile-Only Title + Episode Badge in Top Bar */}
                    <div className={`${isMobilePhone ? 'flex' : 'flex sm:hidden'} items-center gap-1.5 min-w-0 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/10`}>
                      <span className="text-xs font-extrabold text-white truncate max-w-[180px]">
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
                  <div className="flex items-center gap-2 shrink-0 pointer-events-auto">
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

                    {!isMobilePhone && (
                      <button
                        type="button"
                        onClick={() => {
                          setSettingsSubMenu(null);
                          setIsSettingsDrawerOpen(true);
                        }}
                        title={tr('Setări Smart TV', 'Smart TV Settings', 'Настройки')}
                        className="hidden sm:inline-flex h-10 w-10 rounded-full tahoe-emerald-card hover:bg-[#193144] focus:bg-[#1e3a8a] focus:text-white text-[#60a5fa] items-center justify-center cursor-pointer"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={requestTvFullscreen}
                      title={tr('Ecran Complet', 'Fullscreen', 'Полный экран')}
                      className={`${isMobilePhone ? 'inline-flex h-9 w-9' : 'hidden sm:inline-flex h-10 w-10'} rounded-full tahoe-emerald-card hover:bg-[#193144] focus:bg-[#1e3a8a] focus:text-white text-[#60a5fa] items-center justify-center cursor-pointer`}
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 100% Fullscreen Video Area */}
                <div className="relative flex-1 w-full h-full min-h-0 bg-[#090b10] overflow-hidden">
                  {/* Ambient Cinema Glow Backdrop for Loading & Iframe Fallbacks */}
                  {(detailedMeta?.background ||
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
                            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                            allowFullScreen
                            className="relative z-10 w-full h-full border-0 bg-transparent"
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
                        onHideOsd={() => {
                          lastBackHideOsdAtRef.current = Date.now();
                          setIsVodOsdVisible(false);
                        }}
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
                  ) : activeServer === 'filelist_torrent' &&
                    isLocalHomeServer() &&
                    (isFileListStreamLoading ||
                      (resolvedFileListStream?.ok &&
                        resolvedFileListStream.streamUrl)) ? (
                    isFileListStreamLoading ? (
                      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center gap-3 text-zinc-200">
                        <Loader2 className="w-10 h-10 text-[#60a5fa] animate-spin" />
                        <p className="text-sm font-bold">
                          {tr(
                            'Pornire stream live din FileList.io (jeka7ro)...',
                            'Starting live stream from FileList.io (jeka7ro)...',
                            'Запуск прямого потока с FileList.io (jeka7ro)...'
                          )}
                        </p>
                      </div>
                    ) : resolvedFileListStream?.ok &&
                      resolvedFileListStream.streamUrl ? (
                      <VodNativeHlsPlayer
                        hlsUrl={resolvedFileListStream.streamUrl}
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
                            watchProgressMap[activeVodItem.id]?.duration;
                          if (savedDur && savedDur > 60) return savedDur;
                          return activeVodItem.type === 'series' ? 2700 : 7200;
                        })()}
                        audioTrackLabels={resolvedFileListStream.audioNames}
                        initialAudioTrackIndex={
                          selectedAudioTrackIdx >= 0
                            ? selectedAudioTrackIdx
                            : resolveAudioTrackIndexByPreference(
                              resolvedFileListStream.audioNames || [],
                              tvSettings.defaultAudioPref
                            )
                        }
                        preferredQuality={tvSettings.defaultVideoQuality}
                        initialSubFontSize={tvSettings.defaultSubFontSize}
                        preferredSubLang={tvSettings.defaultSubLang}
                        startAtSeconds={resumeStartSeconds}
                        poster={
                          detailedMeta?.poster ||
                          activeVodItem.poster ||
                          detailedMeta?.background ||
                          activeVodItem.background
                        }
                        backdropUrl={
                          detailedMeta?.background ||
                          activeVodItem.background ||
                          detailedMeta?.poster ||
                          activeVodItem.poster
                        }
                        title={
                          uiLang !== 'ru'
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
                        isOsdVisible={isVodOsdVisible}
                        activeServerId={activeServer}
                        serverOptions={VOD_SERVERS}
                        sourceQualityBadge={
                          resolvedFileListStream.selectedTorrent?.quality ||
                          activeVodItem.qualityBadge
                        }
                        externalQualityOptions={flQualityOptions}
                        onResolutionChange={setLiveVodResolution}
                        onWakeOsd={wakeVodOsd}
                        onHideOsd={() => {
                          lastBackHideOsdAtRef.current = Date.now();
                          setIsVodOsdVisible(false);
                        }}
                        prevEpisodeLabel={
                          activeVodItem.type === 'series' && selectedEpisode > 1
                            ? `Ep. ${selectedEpisode - 1}`
                            : undefined
                        }
                        nextEpisodeLabel={
                          activeVodItem.type === 'series'
                            ? `Ep. ${selectedEpisode + 1}`
                            : undefined
                        }
                        onPrevEpisode={
                          activeVodItem.type === 'series' && selectedEpisode > 1
                            ? () => {
                              userSelectedFlTorrentIdRef.current = null;
                              setSelectedEpisode(selectedEpisode - 1);
                              setResumeStartSeconds(0);
                            }
                            : undefined
                        }
                        onNextEpisode={
                          activeVodItem.type === 'series'
                            ? () => {
                              userSelectedFlTorrentIdRef.current = null;
                              setSelectedEpisode(selectedEpisode + 1);
                              setResumeStartSeconds(0);
                            }
                            : undefined
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
                                        '[data-episodes-drawer="true"] [data-drawer-next-ep="true"]'
                                      ) ||
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
                          userManuallySelectedServerRef.current = true;
                          if (srvId !== 'filelist_torrent') {
                            userSelectedFlTorrentIdRef.current = null;
                          }
                          setActiveServer(srvId as VodServerId);
                        }}
                        onSelectAudioTrackIndex={(idx) =>
                          setSelectedAudioTrackIdx(idx)
                        }
                        onApplyAutoSubtitle={({ vttBlobUrl, label, cues }) => {
                          setActiveSubVttUrl(vttBlobUrl);
                          setActiveSubLabel(label);
                          setActiveSubCues(cues);
                        }}
                        onOpenSubtitleFinder={() => setIsSubFinderOpen(true)}
                        onClearSubtitle={() => {
                          setActiveSubVttUrl(null);
                          setActiveSubLabel('');
                          setActiveSubCues([]);
                        }}
                        onTimeUpdate={(cur, dur) => {
                          const prevCur =
                            watchProgressMap[activeVodItem.id]?.currentTime || 0;
                          if (
                            cur > 3 &&
                            (Math.floor(cur) % 3 === 0 ||
                              Math.abs(cur - prevCur) >= 8)
                          ) {
                            updateWatchProgress(
                              activeVodItem,
                              selectedSeason,
                              selectedEpisode,
                              cur,
                              dur
                            );
                          }
                        }}
                      />
                    ) : (
                      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center text-zinc-300">
                        <p className="text-sm font-bold text-rose-400">
                          {resolvedFileListStream?.error ||
                            tr(
                              'Nu s-a găsit un torrent FileList activ pentru acest titlu. Comută pe S1 sau S2!',
                              'No active FileList torrent found for this title. Switch to S1 or S2!',
                              'Торрент FileList не найден. Переключите сервер!'
                            )}
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          {VOD_SERVERS.filter(
                            (s) => s.id !== 'filelist_torrent'
                          ).map((srv) => (
                            <button
                              key={srv.id}
                              type="button"
                              onClick={() => setActiveServer(srv.id)}
                              className="h-10 px-4 rounded-xl bg-[#1e3a8a] text-white border border-[#3b82f6]/50 font-extrabold text-xs cursor-pointer"
                            >
                              {srv.label.split('(')[0]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  ) : activeServer === 'kinogram_hls' ||
                    activeServer === 'filelist_torrent' ||
                    Boolean(matchedOfflineVodItem) ? (
                    isDirectStreamLoading && !matchedOfflineVodItem ? (
                      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center gap-3 text-zinc-200">
                        <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
                        <p className="text-sm font-bold">
                          Pornire automată Full Mode HD pentru Smart TV...
                        </p>
                      </div>
                    ) : matchedOfflineVodItem ||
                      (resolvedDirectStream?.ok &&
                        (resolvedDirectStream.dashUrl ||
                          resolvedDirectStream.hlsUrl)) ? (
                      <VodNativeHlsPlayer
                        offlineItem={matchedOfflineVodItem}
                        dashUrl={resolvedDirectStream?.dashUrl}
                        hlsUrl={resolvedDirectStream?.hlsUrl}
                        onStreamError={() => {
                          if (!resolvedDirectStream?.ok && !matchedOfflineVodItem) {
                            setActiveServer('vidspark');
                          }
                        }}
                        durationHintSec={(() => {
                          if (
                            matchedOfflineVodItem?.duration &&
                            matchedOfflineVodItem.duration > 60
                          ) {
                            return matchedOfflineVodItem.duration;
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
                            watchProgressMap[activeVodItem.id]?.duration;
                          if (savedDur && savedDur > 60) return savedDur;
                          return activeVodItem.type === 'series' ? 2700 : 7200;
                        })()}
                        audioTrackLabels={resolvedDirectStream?.audioNames}
                        initialAudioTrackIndex={effectiveAudioTrackIdx}
                        preferredQuality={tvSettings.defaultVideoQuality}
                        initialSubFontSize={tvSettings.defaultSubFontSize}
                        preferredSubLang={tvSettings.defaultSubLang}
                        startAtSeconds={resumeStartSeconds}
                        poster={
                          detailedMeta?.poster ||
                          activeVodItem.poster ||
                          detailedMeta?.background ||
                          activeVodItem.background
                        }
                        backdropUrl={
                          detailedMeta?.background ||
                          activeVodItem.background ||
                          detailedMeta?.poster ||
                          activeVodItem.poster
                        }
                        title={
                          uiLang !== 'ru'
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
                          activeSubLabel ||
                          matchedOfflineVodItem?.savedSubLabel ||
                          ''
                        }
                        subtitleCues={
                          activeSubCues.length > 0
                            ? activeSubCues
                            : matchedOfflineVodItem?.savedSubCues || []
                        }
                        isOsdVisible={isVodOsdVisible}
                        activeServerId={activeServer}
                        serverOptions={VOD_SERVERS}
                        externalQualityOptions={flQualityOptions}
                        onResolutionChange={setLiveVodResolution}
                        onWakeOsd={wakeVodOsd}
                        onHideOsd={() => {
                          lastBackHideOsdAtRef.current = Date.now();
                          setIsVodOsdVisible(false);
                        }}
                        prevEpisodeLabel={
                          activeVodItem.type === 'series' && selectedEpisode > 1
                            ? `Ep. ${selectedEpisode - 1}`
                            : undefined
                        }
                        nextEpisodeLabel={
                          activeVodItem.type === 'series'
                            ? `Ep. ${selectedEpisode + 1}`
                            : undefined
                        }
                        onPrevEpisode={
                          activeVodItem.type === 'series' && selectedEpisode > 1
                            ? () => {
                              userSelectedFlTorrentIdRef.current = null;
                              setSelectedEpisode(selectedEpisode - 1);
                              setResumeStartSeconds(0);
                            }
                            : undefined
                        }
                        onNextEpisode={
                          activeVodItem.type === 'series'
                            ? () => {
                              userSelectedFlTorrentIdRef.current = null;
                              setSelectedEpisode(selectedEpisode + 1);
                              setResumeStartSeconds(0);
                            }
                            : undefined
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
                                        '[data-episodes-drawer="true"] [data-drawer-next-ep="true"]'
                                      ) ||
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
                          userManuallySelectedServerRef.current = true;
                          if (srvId !== 'filelist_torrent') {
                            userSelectedFlTorrentIdRef.current = null;
                          }
                          setActiveServer(srvId as VodServerId);
                        }}
                        onSelectAudioTrackIndex={(idx) =>
                          setSelectedAudioTrackIdx(idx)
                        }
                        onApplyAutoSubtitle={({ vttBlobUrl, label, cues }) => {
                          setActiveSubVttUrl(vttBlobUrl);
                          setActiveSubLabel(label);
                          setActiveSubCues(cues);
                        }}
                        onOpenSubtitleFinder={() => setIsSubFinderOpen(true)}
                        onClearSubtitle={() => {
                          setActiveSubVttUrl(null);
                          setActiveSubLabel('');
                          setActiveSubCues([]);
                        }}
                        onTimeUpdate={(cur, dur) => {
                          const prevCur =
                            watchProgressMap[activeVodItem.id]?.currentTime || 0;
                          if (
                            cur > 3 &&
                            (Math.floor(cur) % 3 === 0 ||
                              Math.abs(cur - prevCur) >= 8)
                          ) {
                            updateWatchProgress(
                              activeVodItem,
                              selectedSeason,
                              selectedEpisode,
                              cur,
                              dur
                            );
                          }
                        }}
                      />
                    ) : fallbackYtVideoId ? (
                      <iframe
                        key={`yt_fallback_${fallbackYtVideoId}`}
                        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(
                          fallbackYtVideoId
                        )}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                        title={activeVodItem.name}
                        className="relative z-10 w-full h-full border-0"
                        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <iframe
                        src={buildVodEmbedUrl(
                          'vidspark',
                          detailedMeta || activeVodItem,
                          selectedSeason,
                          selectedEpisode,
                          preferredSubLang,
                          resumeStartSeconds,
                          detailedMeta?.imdbId
                        )}
                        title={activeVodItem.name}
                        className="relative z-10 w-full h-full border-0"
                        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                        allowFullScreen
                      />
                    )
                  ) : fallbackYtVideoId && activeServer === 'vidspark' ? (
                    <iframe
                      key={`yt_fallback_srv_${fallbackYtVideoId}`}
                      src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(
                        fallbackYtVideoId
                      )}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                      title={activeVodItem.name}
                      className="relative z-10 w-full h-full border-0"
                      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <iframe
                      src={buildVodEmbedUrl(
                        activeServer,
                        detailedMeta || activeVodItem,
                        selectedSeason,
                        selectedEpisode,
                        preferredSubLang,
                        resumeStartSeconds,
                        detailedMeta?.imdbId
                      )}
                      title={activeVodItem.name}
                      className="relative z-10 w-full h-full border-0"
                      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
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
                        resolvedDirectStream.hlsUrl)
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
                              data-vod-play-btn="true"
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
                              selectedEpisode > 1 && (
                                <button
                                  type="button"
                                  data-vod-prev-ep-btn="true"
                                  onFocus={wakeVodOsd}
                                  onClick={() => {
                                    wakeVodOsd();
                                    userSelectedFlTorrentIdRef.current = null;
                                    setSelectedEpisode(selectedEpisode - 1);
                                    setResumeStartSeconds(0);
                                  }}
                                  className="h-9 max-sm:h-8 px-3.5 max-sm:px-2.5 rounded-full tahoe-emerald-card hover:bg-white/20 text-white/95 text-xs max-sm:text-[11px] font-medium inline-flex items-center gap-1.5 max-sm:gap-1 transition-all focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
                                >
                                  <span>Ep. {selectedEpisode - 1}</span>
                                </button>
                              )}

                            {activeVodItem.type === 'series' && (
                              <button
                                type="button"
                                data-vod-next-ep-btn="true"
                                onFocus={wakeVodOsd}
                                onClick={() => {
                                  wakeVodOsd();
                                  userSelectedFlTorrentIdRef.current = null;
                                  setSelectedEpisode(selectedEpisode + 1);
                                  setResumeStartSeconds(0);
                                }}
                                className="h-9 max-sm:h-8 px-3.5 max-sm:px-2.5 rounded-full tahoe-emerald-card hover:bg-white/20 text-white/95 text-xs max-sm:text-[11px] font-medium inline-flex items-center gap-1.5 max-sm:gap-1 transition-all focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
                              >
                                <span>Ep. {selectedEpisode + 1}</span>
                              </button>
                            )}

                            {activeVodItem.type === 'series' && (
                              <button
                                type="button"
                                onFocus={wakeVodOsd}
                                onClick={() => {
                                  wakeVodOsd();
                                  setIsInfoSheetOpen(false);
                                  setIsEpisodesDrawerOpen((v) => !v);
                                }}
                                className="h-9 max-sm:h-8 px-3.5 max-sm:px-2.5 rounded-full tahoe-emerald-card hover:bg-white/20 text-white/95 text-xs max-sm:text-[11px] font-medium inline-flex items-center gap-1.5 max-sm:gap-1 transition-all focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
                              >
                                <span className="w-2.5 h-2.5 max-sm:w-2 max-sm:h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] shrink-0 mr-1 max-sm:mr-0.5" />
                                <span>Episoade</span>
                                <span className="hidden sm:inline text-white/60 text-[11px] ml-1">
                                  S{selectedSeason}·E{selectedEpisode} (⬇×2)
                                </span>
                              </button>
                            )}

                            <button
                              type="button"
                              onFocus={wakeVodOsd}
                              onClick={() => {
                                wakeVodOsd();
                                setIsEpisodesDrawerOpen(false);
                                setIsInfoSheetOpen((v) => !v);
                              }}
                              className="h-9 max-sm:h-8 px-3.5 max-sm:px-2.5 rounded-full tahoe-emerald-card hover:bg-white/20 text-white/95 text-xs max-sm:text-[11px] font-medium inline-flex items-center gap-1.5 max-sm:gap-1 transition-all focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
                            >
                              <span className="w-2.5 h-2.5 max-sm:w-2 max-sm:h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.95)] shrink-0 mr-1 max-sm:mr-0.5" />
                              <span className="sm:hidden">Info</span>
                              <span className="hidden sm:inline">
                                {activeVodItem.type === 'series'
                                  ? 'Descriere Serial'
                                  : 'Descriere Film'}
                              </span>
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <button
                              type="button"
                              onFocus={wakeVodOsd}
                              onClick={() => {
                                wakeVodOsd();
                                setIsEpisodesDrawerOpen(false);
                                setIsInfoSheetOpen((v) => !v);
                              }}
                              className="h-9 max-sm:h-8 px-3.5 max-sm:px-2.5 rounded-full tahoe-emerald-card hover:bg-white/20 text-white/95 text-xs max-sm:text-[11px] font-medium inline-flex items-center gap-1.5 max-sm:gap-1 transition-all focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
                            >
                              <span className="w-2.5 h-2.5 max-sm:w-2 max-sm:h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.95)] shrink-0 mr-0.5" />
                              <Layers className="w-3.5 h-3.5 max-sm:w-3 max-sm:h-3 shrink-0 opacity-80" />
                              <span className="sm:hidden">Sursă</span>
                              <span className="hidden sm:inline">Pistă Audio & Sursă</span>
                            </button>
                            <button
                              type="button"
                              onFocus={wakeVodOsd}
                              onClick={() => {
                                wakeVodOsd();
                                setIsSubFinderOpen(true);
                              }}
                              className="h-9 max-sm:h-8 px-3.5 max-sm:px-2.5 rounded-full tahoe-emerald-card hover:bg-white/20 text-white/95 text-xs max-sm:text-[11px] font-medium inline-flex items-center gap-1.5 max-sm:gap-1 transition-all focus:outline-none focus:bg-white focus:text-zinc-950 cursor-pointer"
                            >
                              <span className="w-2.5 h-2.5 max-sm:w-2 max-sm:h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.95)] shrink-0 mr-0.5" />
                              <span>Subtitrări</span>
                            </button>
                            <button
                              type="button"
                              onClick={requestTvFullscreen}
                              className="sm:hidden h-8 px-2.5 rounded-full bg-blue-600/90 hover:bg-blue-500 text-white text-[11px] font-bold inline-flex items-center gap-1 shadow-md cursor-pointer"
                            >
                              <Maximize2 className="w-3 h-3 shrink-0" />
                              <span>Ecran Complet</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                  {/* APPLE macOS TAHOE FLOATING INFORMATION SHEET OVERLAY IN FULLSCREEN PLAYER (YELLOW BUTTON: DESCRIERE FILM CU POZĂ & ACTORI) */}
                  {isInfoSheetOpen && (
                    <div
                      data-vod-sheet-open="true"
                      className="absolute bottom-4 inset-x-4 sm:inset-x-8 z-30 max-h-[76vh] overflow-y-auto p-5 sm:p-7 rounded-[32px] tahoe-glass shadow-[0_24px_64px_rgba(0,0,0,0.85)] transition-all duration-300"
                    >
                      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row gap-5 sm:gap-6">
                        {/* Left Poster Photo — Always visible with rich shadow */}
                        <div className="w-32 h-48 sm:w-44 sm:h-64 rounded-[24px] overflow-hidden bg-zinc-900 border border-white/20 shrink-0 shadow-[0_18px_48px_rgba(0,0,0,0.85)] mx-auto sm:mx-0">
                          <img
                            src={
                              detailedMeta?.poster ||
                              activeVodItem.poster ||
                              `https://images.metahub.space/poster/medium/${activeVodItem.id}/img`
                            }
                            alt={activeVodItem.name}
                            onError={(e) => {
                              const fallback =
                                detailedMeta?.background ||
                                activeVodItem.background ||
                                '';
                              if (
                                fallback &&
                                e.currentTarget.src !== fallback
                              ) {
                                e.currentTarget.src = fallback;
                              }
                            }}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Right Metadata Details */}
                        <div className="flex-1 min-w-0 space-y-3.5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-zinc-950 text-xs font-extrabold uppercase inline-flex items-center gap-1.5 shadow">
                                  <span>
                                    {activeVodItem.type === 'series'
                                      ? 'Serial TV'
                                      : 'Film HD'}
                                  </span>
                                </span>
                                {(detailedMeta?.imdbRating ||
                                  activeVodItem.imdbRating) && (
                                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-extrabold inline-flex items-center gap-1">
                                      ★ IMDb{' '}
                                      {detailedMeta?.imdbRating ||
                                        activeVodItem.imdbRating}
                                    </span>
                                  )}
                                {detailedMeta?.ratingKinopoisk && (
                                  <span className="px-2.5 py-0.5 rounded-full bg-orange-500/20 border border-orange-400/40 text-orange-300 text-xs font-extrabold">
                                    KP {detailedMeta.ratingKinopoisk}
                                  </span>
                                )}
                                {detailedMeta?.ageRating && (
                                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-extrabold">
                                    {detailedMeta.ageRating}
                                  </span>
                                )}
                                {(detailedMeta?.releaseInfo ||
                                  activeVodItem.releaseInfo) && (
                                    <span className="text-xs font-bold text-zinc-200">
                                      {detailedMeta?.releaseInfo ||
                                        activeVodItem.releaseInfo}
                                    </span>
                                  )}
                                {detailedMeta?.runtime && (
                                  <span className="text-xs font-bold text-zinc-200">
                                    • {detailedMeta.runtime}
                                  </span>
                                )}
                                {detailedMeta?.country && (
                                  <span className="text-xs font-bold text-blue-300">
                                    • {detailedMeta.country}
                                  </span>
                                )}
                              </div>

                              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                                {detailedMeta?.name || activeVodItem.name}
                              </h2>
                              {detailedMeta?.nameOriginal &&
                                detailedMeta.nameOriginal !==
                                (detailedMeta?.name || activeVodItem.name) && (
                                  <div className="text-xs sm:text-sm font-semibold text-zinc-400">
                                    {tr(
                                      'Titlu original:',
                                      'Original title:',
                                      'Оригинальное название:'
                                    )}{' '}
                                    {detailedMeta.nameOriginal}
                                  </div>
                                )}
                            </div>

                            <button
                              type="button"
                              data-sheet-close-btn="true"
                              onClick={() => setIsInfoSheetOpen(false)}
                              className="h-9 px-4 rounded-full bg-white/15 hover:bg-white/25 focus:outline-none focus:ring-4 focus:ring-white focus:bg-white focus:text-[#141414] text-zinc-100 text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                            >
                              <span>{tr('Închide', 'Close', 'Закрыть')}</span>
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Genres & Audio Dubbing Pills */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {(
                              detailedMeta?.genres ||
                              activeVodItem.genres ||
                              []
                            ).map((g) => (
                              <span
                                key={g}
                                className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-zinc-200 text-xs font-bold"
                              >
                                {g}
                              </span>
                            ))}
                            {resolvedDirectStream?.audioNames &&
                              resolvedDirectStream.audioNames.length > 0 && (
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                                  Audio:{' '}
                                  {resolvedDirectStream.audioNames
                                    .slice(0, 4)
                                    .join(', ')}
                                </span>
                              )}
                          </div>

                          {detailedMeta?.slogan && (
                            <p className="text-xs italic text-amber-300/90">
                              „{detailedMeta.slogan}”
                            </p>
                          )}

                          {/* Current Episode Info (if Series) */}
                          {activeVodItem.type === 'series' &&
                            (() => {
                              const curEp = episodesForSeason.find(
                                (ep) => ep.episode === selectedEpisode
                              );
                              if (!curEp) return null;
                              const epOverview = (
                                curEp.overview ||
                                curEp.description ||
                                ''
                              ).trim();
                              return (
                                <div className="p-3 rounded-2xl bg-blue-500/15 border border-blue-400/30 space-y-1">
                                  <div className="text-xs sm:text-sm font-extrabold text-blue-200">
                                    Sezonul {selectedSeason} • Episodul{' '}
                                    {selectedEpisode}
                                    {curEp.name ? ` — ${curEp.name}` : ''}
                                  </div>
                                  {epOverview && (
                                    <p className="text-xs text-zinc-200 leading-relaxed">
                                      {epOverview}
                                    </p>
                                  )}
                                </div>
                              );
                            })()}

                          {/* Full Description / Synopsis */}
                          <div className="p-3.5 rounded-2xl bg-white/[0.06] border border-white/15 space-y-1.5">
                            <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
                              {tr(
                                'Descrierea Filmului / Sinopsis',
                                'Movie Description / Synopsis',
                                'Описание фильма / Синопсис'
                              )}
                            </div>
                            <p className="text-xs sm:text-sm text-zinc-100 leading-relaxed max-w-4xl">
                              {detailedMeta?.description ||
                                activeVodItem.description ||
                                'Descrierea completă se încarcă...'}
                            </p>
                          </div>

                          {/* Director & Cast with Photos */}
                          {(detailedMeta?.director?.length ||
                            detailedMeta?.cast?.length ||
                            castMembers.length > 0) && (
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-300">
                                  {detailedMeta?.director &&
                                    detailedMeta.director.length > 0 && (
                                      <div>
                                        <span className="text-zinc-400 font-bold">
                                          Regia:{' '}
                                        </span>
                                        <span className="font-extrabold text-white">
                                          {detailedMeta.director.join(', ')}
                                        </span>
                                      </div>
                                    )}
                                  {detailedMeta?.cast &&
                                    detailedMeta.cast.length > 0 && (
                                      <div className="inline-flex items-center gap-1">
                                        <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                        <span className="text-zinc-400 font-bold">
                                          Actori:{' '}
                                        </span>
                                        <span className="font-semibold text-zinc-100">
                                          {detailedMeta.cast.slice(0, 8).join(', ')}
                                        </span>
                                      </div>
                                    )}
                                </div>

                                {castMembers.length > 0 && (
                                  <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                                    {castMembers.slice(0, 8).map((actor) => (
                                      <div
                                        key={`${actor.staffId}_${actor.name}`}
                                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-2xl bg-white/[0.07] border border-white/15 shrink-0"
                                      >
                                        {actor.photoUrl && (
                                          <img
                                            src={actor.photoUrl}
                                            alt={actor.nameEn || actor.name}
                                            loading="lazy"
                                            className="w-8 h-10 rounded-lg object-cover bg-zinc-800 shrink-0"
                                          />
                                        )}
                                        <div className="min-w-0 max-w-[130px]">
                                          <div className="text-xs font-extrabold text-white truncate">
                                            {actor.nameEn || actor.name}
                                          </div>
                                          {actor.role && (
                                            <div className="text-[10px] text-zinc-400 truncate">
                                              {actor.role}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
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
                        className="absolute top-16 inset-x-4 sm:inset-x-8 z-40 max-h-[60vh] overflow-y-auto p-5 rounded-[32px] tahoe-glass shadow-[0_24px_64px_rgba(0,0,0,0.85)] space-y-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 mr-2">
                              Sezoane:
                            </span>
                            {availableSeasons.map((sNum) => (
                              <button
                                key={sNum}
                                type="button"
                                onClick={() => {
                                  userSelectedFlTorrentIdRef.current = null;
                                  setSelectedSeason(sNum);
                                  setSelectedEpisode(1);
                                  setResumeStartSeconds(0);
                                }}
                                className={`h-9 px-4 rounded-full text-xs sm:text-sm font-extrabold shrink-0 transition-all focus:outline-none focus:ring-4 focus:ring-white focus:bg-white focus:text-[#141414] cursor-pointer ${selectedSeason === sNum
                                  ? 'bg-white text-[#141414] shadow-md'
                                  : 'bg-white/10 hover:bg-white/20 text-zinc-200 border border-white/15'
                                  }`}
                              >
                                Sezonul {sNum}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsEpisodesDrawerOpen(false)}
                            className="h-9 px-4 rounded-full bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-white focus:bg-white focus:text-[#141414] text-zinc-100 text-xs font-bold shrink-0 cursor-pointer"
                          >
                            Închide
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {episodesForSeason.map((ep) => {
                            const isCurrent = selectedEpisode === ep.episode;
                            const epCleanName = (ep.name || '').trim();
                            const isGeneric =
                              !epCleanName ||
                              /^Episod(ul|e)?\s*\d+$/i.test(epCleanName) ||
                              /^S\d+E\d+$/i.test(epCleanName);
                            const epKey = `S${selectedSeason}E${ep.episode}`;
                            const epProg =
                              watchProgressMap[activeVodItem.id]
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
                            const isWatched =
                              epPct >= 85 ||
                              (selectedEpisode > ep.episode &&
                                Boolean(watchProgressMap[activeVodItem.id]));
                            const resolvedImdb = activeVodItem.id.startsWith(
                              'tt'
                            )
                              ? activeVodItem.id
                              : detailedMeta?.imdbId || '';
                            const epThumb =
                              ep.thumbnail ||
                              (resolvedImdb
                                ? `https://episodes.metahub.space/${resolvedImdb}/${selectedSeason}/${ep.episode}/w780.jpg`
                                : '') ||
                              detailedMeta?.background ||
                              activeVodItem.background ||
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
                                data-drawer-initial-focus={
                                  isCurrent ? 'true' : undefined
                                }
                                data-drawer-next-ep={
                                  ep.episode === selectedEpisode + 1
                                    ? 'true'
                                    : undefined
                                }
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
                                  {epThumb && (
                                    <img
                                      src={epThumb}
                                      alt={`Ep ${ep.episode}`}
                                      loading="lazy"
                                      onError={(e) => {
                                        const fallback =
                                          detailedMeta?.background ||
                                          activeVodItem.poster ||
                                          '';
                                        if (
                                          fallback &&
                                          e.currentTarget.src !== fallback
                                        ) {
                                          e.currentTarget.src = fallback;
                                        }
                                      }}
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                  <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-black text-white">
                                    E{ep.episode}
                                  </span>
                                  {isWatched && (
                                    <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-[#1e3a8a] text-white text-[9px] font-black">
                                      ✓ Văzut
                                    </span>
                                  )}
                                  {epPct > 0 && (
                                    <div className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
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
            ) : activeVodItem ? (
              /* 1B. APPLE macOS TAHOE LIQUID GLASS MOVIE / SERIES CARD */
              <div className="relative z-10 pb-16 pt-1 px-2 sm:px-4 space-y-7">
                {/* HERO SECTION: Left Main Column (Poster + Actions + Synopsis immediately under Poster) + Right Compact Selectors */}
                <div
                  data-top-hero-card="true"
                  className="flex flex-col lg:flex-row items-start w-full"
                >
                  {/* Left Main Column: Poster + Metadata/Actions on top, and Detalii & Sinopsis immediately underneath Poster */}
                  <div className="flex-1 min-w-0 space-y-5 max-sm:space-y-3.5 w-full lg:mr-8 mb-6 max-sm:mb-4 lg:mb-0">
                    <div className="flex flex-row items-start w-full">
                      {/* Left Poster (macOS Tahoe Super-Rounded Squircle Poster with Specular Ring — compact side-by-side on mobile) */}
                      <div className="w-28 sm:w-52 lg:w-[225px] shrink-0 mr-3.5 sm:mr-7 lg:mr-8 mb-0">
                        <div className="aspect-[2/3] w-full rounded-2xl sm:rounded-[28px] overflow-hidden bg-[#1e1e1e] ring-1 ring-white/25 shadow-[0_24px_60px_rgba(0,0,0,0.75)] relative">
                          <img
                            src={
                              detailedMeta?.poster ||
                              activeVodItem.poster ||
                              `https://images.metahub.space/poster/medium/${activeVodItem.id}/img`
                            }
                            alt={activeVodItem.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>

                      {/* Middle Column: Year/Country + Single Original Provider Logo, Huge Title, TMDB/IMDB/KP Row, Runtime/Genres, Action Pills */}
                      <div className="flex-1 min-w-0 space-y-3.5 max-sm:space-y-2 pt-1 max-sm:pt-0 w-full">
                        {/* Line 1: Year, Country + Single Original Streaming Provider Logo (above the Title) */}
                        <div className="flex flex-wrap items-center">
                          <span className="text-xs sm:text-[15px] text-zinc-200 font-medium mr-2.5 sm:mr-3 mb-1 sm:mb-1.5">
                            {[
                              detailedMeta?.releaseInfo ||
                              activeVodItem.releaseInfo ||
                              '2026',
                              detailedMeta?.country ||
                              tr('SUA, Europa', 'USA, Europe', 'США, Европа'),
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          </span>

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
                                  className="inline-flex items-center pl-1.5 pr-3 py-1 mb-1 sm:mb-1.5 rounded-full bg-black/55 hover:bg-white/20 focus:bg-white focus:text-[#141414] backdrop-blur-xl border border-white/25 shadow-[0_6px_20px_rgba(0,0,0,0.45)] text-[11px] sm:text-xs font-extrabold text-white transition-all cursor-pointer"
                                >
                                  <StreamingPlatformLogo
                                    platformId={activeVodDetectedProvider}
                                    size="xs"
                                  />
                                  <span className="ml-2 tracking-wide">
                                    {platMeta?.label || activeVodDetectedProvider}
                                  </span>
                                </button>
                              );
                            })()
                          ) : activeVodDetectedStudios[0] ? (
                            <ProducerStudioLogoBadge
                              studio={activeVodDetectedStudios[0]}
                              size="sm"
                              className="mb-1 sm:mb-1.5"
                            />
                          ) : null}
                        </div>

                        {/* Line 2: Huge Bold Title */}
                        <h1 className="text-xl sm:text-5xl font-bold text-white tracking-tight leading-tight line-clamp-2 sm:line-clamp-none">
                          {detailedMeta?.name || activeVodItem.name}
                        </h1>

                        {/* Line 3: TMDB / IMDB / KP Ratings + Age Rating + Status */}
                        <div className="flex flex-wrap items-center pt-0.5">
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
                                <span className="inline-flex items-baseline mr-1.5 sm:mr-2.5 mb-1.5 sm:mb-2 px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] text-white">
                                  <strong className="text-xs sm:text-[15px] font-bold mr-1 sm:mr-1.5">
                                    {displayRating}
                                  </strong>
                                  <span className="text-[9px] sm:text-[10px] text-zinc-300 uppercase font-semibold tracking-wider">
                                    TMDB
                                  </span>
                                </span>

                                <span className="inline-flex items-baseline mr-1.5 sm:mr-2.5 mb-1.5 sm:mb-2 px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] text-white">
                                  <strong className="text-xs sm:text-[15px] font-bold mr-1 sm:mr-1.5">
                                    {displayRating}
                                  </strong>
                                  <span className="text-[9px] sm:text-[10px] text-amber-400 uppercase font-extrabold tracking-wider">
                                    IMDb
                                  </span>
                                </span>

                                {numKp > 0 && (
                                  <span className="inline-flex items-baseline mr-1.5 sm:mr-2.5 mb-1.5 sm:mb-2 px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] text-white">
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

                          <span className="mr-1.5 sm:mr-2.5 mb-1.5 sm:mb-2 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-white/10 backdrop-blur-xl border border-white/30 text-[11px] sm:text-xs text-white font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
                            {detailedMeta?.ageRating || '16+'}
                          </span>

                          <span className="hidden sm:inline-flex mb-2 px-3.5 py-1 rounded-full bg-white/10 backdrop-blur-xl border border-white/30 text-xs text-white font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
                            {tr('Lansat', 'Released', 'Выпущенный')}
                          </span>
                        </div>

                        {/* Line 4: Runtime • Genres separated by | */}
                        <div className="text-xs sm:text-[15px] text-zinc-200 font-normal pt-0.5 line-clamp-1 sm:line-clamp-none">
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

                        {/* Line 5: Action Buttons Row (macOS Tahoe Pill Buttons — NO fake emoji reactions) */}
                        <div className="flex flex-wrap items-center pt-1.5 sm:pt-2">
                          {/* Primary White Play Pill ("Play") */}
                          {(() => {
                            const savedProg = watchProgressMap[activeVodItem.id];
                            const epKey = `S${selectedSeason}E${selectedEpisode}`;
                            const epTime =
                              savedProg?.episodeProgressMap?.[epKey]?.currentTime;
                            const liveResumeSec =
                              activeVodItem.type === 'series'
                                ? (epTime ??
                                  (savedProg?.season === selectedSeason &&
                                    savedProg?.episode === selectedEpisode
                                    ? savedProg?.currentTime
                                    : 0) ??
                                  pendingResumePromptSec ??
                                  0)
                                : (savedProg?.currentTime ??
                                  pendingResumePromptSec ??
                                  0);
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
                                className="group/vodplay mr-2 sm:mr-2.5 mb-2 sm:mb-2.5 h-10 sm:h-12 px-4 sm:px-7 rounded-full bg-[#1e3a8a] hover:bg-[#1d4ed8] focus:bg-[#1e3a8a] text-white hover:text-white focus:text-white border-2 border-white/90 focus:border-white focus:ring-4 focus:ring-white font-extrabold text-xs sm:text-[15px] inline-flex items-center shadow-[0_8px_25px_rgba(30,58,138,0.55)] cursor-pointer"
                              >
                                <Play
                                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2.5 fill-current text-white shrink-0"
                                  style={{ color: '#ffffff' }}
                                />
                                <span
                                  className="text-white font-extrabold"
                                  style={{ color: '#ffffff' }}
                                >
                                  {liveResumeSec > 10
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

                          {/* Clapperboard Icon Pill — Official Trailer (Fără text) */}
                          <button
                            type="button"
                            title={tr('Trailer', 'Trailer', 'Трейлер')}
                            aria-label={tr('Trailer', 'Trailer', 'Трейлер')}
                            onClick={() => void handleOpenTrailer()}
                            className="mr-2 sm:mr-2.5 mb-2 sm:mb-2.5 h-10 w-10 sm:h-12 sm:w-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-white flex items-center justify-center transition-all cursor-pointer"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="w-4 h-4 sm:w-5 sm:h-5 shrink-0"
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

                          {/* Local / Offline Download Icon Pill (Fără text) */}
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
                              setSelectedDownloadEpisodes([selectedEpisode]);
                              setIsDownloadModalOpen(true);
                            }}
                            className={`mr-2 sm:mr-2.5 mb-2 sm:mb-2.5 h-10 w-10 sm:h-12 sm:w-14 rounded-full border flex items-center justify-center transition-all cursor-pointer ${matchedOfflineVodItem ||
                                offlineItems.some(
                                  (x) => x.vodId === activeVodItem.id
                                )
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
                              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin shrink-0" />
                            ) : matchedOfflineVodItem ||
                              offlineItems.some(
                                (x) => x.vodId === activeVodItem.id
                              ) ? (
                              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                            ) : (
                              <Download className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                            )}
                          </button>

                          {/* Bookmark Icon Pill (Избранное / Favorite) */}
                          <button
                            type="button"
                            title={tr('Adaugă la Favorite', 'Add to Favorites', 'В Избранное')}
                            onClick={() => toggleSaveVodItem(activeVodItem)}
                            className={`mr-2 sm:mr-2.5 mb-2 sm:mb-2.5 h-10 w-10 sm:h-12 sm:w-14 rounded-full border flex items-center justify-center transition-all cursor-pointer ${savedVodItems.some((x) => x.id === activeVodItem.id)
                              ? 'bg-white text-[#141414] border-white shadow-md'
                              : 'bg-white/10 backdrop-blur-xl border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-white'
                              }`}
                          >
                            <Bookmark
                              className={`w-4 h-4 sm:w-5 sm:h-5 ${savedVodItems.some((x) => x.id === activeVodItem.id)
                                ? 'fill-current'
                                : ''
                                }`}
                            />
                          </button>

                          {/* Subtitles / Ticket Icon Pill */}
                          <button
                            type="button"
                            title={tr('Subtitrări Online', 'Online Subtitles', 'Субтитры')}
                            onClick={() => setIsSubFinderOpen(true)}
                            className={`mb-2 sm:mb-2.5 h-10 w-10 sm:h-12 sm:w-14 rounded-full border flex items-center justify-center transition-all cursor-pointer ${activeSubLabel || activeSubCues.length > 0
                              ? 'bg-white text-[#141414] border-white'
                              : 'bg-white/10 backdrop-blur-xl border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] text-white'
                              }`}
                          >
                            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                        </div>
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
                        const audioTrackList =
                          resolvedDirectStream?.audioNames &&
                            resolvedDirectStream.audioNames.length > 0
                            ? resolvedDirectStream.audioNames
                            : ['Original / Audio 1'];

                        return (
                          <div
                            className="fixed inset-0 z-[260] bg-black/80 backdrop-blur-xl flex items-center justify-center p-2.5 sm:p-4"
                            onClick={(e) => {
                              if (e.target === e.currentTarget) {
                                setIsDownloadModalOpen(false);
                              }
                            }}
                          >
                            <div className="w-full max-w-xl max-h-[88vh] flex flex-col rounded-2xl sm:rounded-3xl bg-[#10141d]/98 border border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.85)] overflow-hidden">
                              {/* Ultra-Compact Modal Header */}
                              <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between gap-2 bg-white/[0.03]">
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
                              <div className="p-3.5 sm:p-4 overflow-y-auto space-y-3">
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
                                          h: 360 as const,
                                          label: '360p',
                                          size: isSeriesVod
                                            ? '~110MB'
                                            : '~280MB',
                                        },
                                        {
                                          h: 480 as const,
                                          label: '480p',
                                          size: isSeriesVod
                                            ? '~180MB'
                                            : '~450MB',
                                        },
                                        {
                                          h: 720 as const,
                                          label: '720p',
                                          size: isSeriesVod
                                            ? '~320MB'
                                            : '~750MB',
                                        },
                                        {
                                          h: 1080 as const,
                                          label: '1080p',
                                          size: isSeriesVod
                                            ? '~650MB'
                                            : '~1.5GB',
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
                                    {audioTrackList.map((aName, idx) => {
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
                                              S{sNum}
                                            </button>
                                          );
                                        })}
                                      </div>

                                      <div className="flex items-center gap-1">
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

                                    {/* Compact Episode Grid */}
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-44 overflow-y-auto pr-0.5">
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
                                            className={`px-2.5 py-1.5 rounded-xl border text-left flex items-center justify-between gap-1.5 transition-all cursor-pointer ${isChecked
                                                ? 'bg-[#2563eb]/30 border-blue-400 text-white'
                                                : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-zinc-300'
                                              }`}
                                          >
                                            <div className="min-w-0">
                                              <div className="flex items-center gap-1">
                                                <span className="text-xs font-extrabold text-white">
                                                  E{ep.episode}
                                                </span>
                                                {isAlreadySaved && (
                                                  <span className="px-1 py-0.2 rounded bg-blue-500/35 text-[8px] font-bold text-blue-200">
                                                    OK
                                                  </span>
                                                )}
                                              </div>
                                              <div className="text-[10px] text-zinc-400 truncate">
                                                {ep.title ||
                                                  `Ep. ${ep.episode}`}
                                              </div>
                                            </div>
                                            <CheckCircle2
                                              className={`w-3.5 h-3.5 shrink-0 ${isChecked
                                                  ? 'text-blue-400'
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
                              <div className="px-4 py-2.5 border-t border-white/10 bg-white/[0.03] flex items-center justify-between gap-2">
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
                                      isDirectStreamLoading && !isSeriesVod
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
                      })()}

                    {/* "Подробно" DETAILS SECTION — Placed IMMEDIATELY under the Movie Poster ("poza") in a macOS Tahoe Liquid Glass Container */}
                    <div className="p-4 sm:p-6 rounded-2xl sm:rounded-[28px] tahoe-glass space-y-3 sm:space-y-4 max-w-4xl">
                      <div className="flex flex-wrap items-center justify-between">
                        <h2 className="text-xl sm:text-[22px] font-semibold text-white tracking-tight">
                          {tr('Detalii & Sinopsis', 'Details & Synopsis', 'Подробно')}
                        </h2>
                      </div>

                      <p className="text-sm sm:text-[16px] text-zinc-100 leading-relaxed font-normal">
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
                  </div>

                  {/* Right Column (Compact Accordion Selectors — macOS Tahoe Liquid Glass & Pill Buttons, NO Emojis) */}
                  <div className="w-full lg:w-[320px] xl:w-[345px] shrink-0 space-y-2 pt-1">
                    {/* Watch Progress Line (Time + Episodes Count) on the Right Side */}
                    {(() => {
                      const prog = watchProgressMap[activeVodItem.id];
                      if (!prog || prog.currentTime <= 5) return null;
                      const totalDur =
                        prog.duration && prog.duration > 60
                          ? prog.duration
                          : activeVodItem.type === 'series'
                            ? 2700
                            : 5400;
                      const pct = Math.min(
                        100,
                        Math.max(
                          3,
                          Math.round((prog.currentTime / totalDur) * 100)
                        )
                      );
                      const totalEps =
                        episodesForSeason.length ||
                        prog.totalEpisodesInSeason ||
                        0;
                      const epPct =
                        activeVodItem.type === 'series' && totalEps > 0
                          ? Math.min(
                            100,
                            Math.max(
                              5,
                              Math.round((selectedEpisode / totalEps) * 100)
                            )
                          )
                          : 0;

                      const cleanDeviceName = sanitizeDeviceName(prog.deviceName);
                      const flTorList =
                        resolvedFileListStream?.torrents &&
                          resolvedFileListStream.torrents.length > 0
                          ? resolvedFileListStream.torrents
                          : resolvedFileListStream?.selectedTorrent
                            ? [resolvedFileListStream.selectedTorrent]
                            : [];
                      const activeFlTor =
                        flTorList.find(
                          (t) => t.id === resolvedFileListStream?.torrentId
                        ) || flTorList[0];
                      const resumeSourceLabel =
                        activeServer === 'filelist_torrent'
                          ? activeFlTor
                            ? `FileList.io • ${activeFlTor.quality || '1080p'}${activeFlTor.isRo ? ' RO' : ''}`
                            : 'FileList.io Torrents'
                          : activeServer === 'kinogram_hls'
                            ? `S1: Player Nativ 1080p${resolvedDirectStream?.audioNames?.[
                              effectiveAudioTrackIdx
                            ]
                              ? ` • ${resolvedDirectStream.audioNames[effectiveAudioTrackIdx]}`
                              : ''
                            }`
                            : (
                              VOD_SERVERS.find((s) => s.id === activeServer)
                                ?.label || 'S1: Player Nativ 1080p'
                            )
                              .split('(')[0]
                              .trim();

                      return (
                        <div className="w-full p-4 rounded-[28px] tahoe-glass space-y-2.5">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-semibold text-zinc-200 tabular-nums">
                              <span>
                                {tr('Progres:', 'Progress:', 'Прогресс:')}{' '}
                                <strong className="text-[#60a5fa]">
                                  {formatWatchSeconds(prog.currentTime)}
                                </strong>{' '}
                                / {formatWatchSeconds(totalDur)}
                              </span>
                              <span className="text-[#60a5fa] font-bold">
                                {pct}%
                              </span>
                            </div>
                            <div className="text-[11px] font-semibold text-zinc-300 truncate">

                              <span className="text-[#60a5fa] font-bold">
                                {tr('Sursă:', 'Source:', 'Источник:')}{' '}
                                {resumeSourceLabel}
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#60a5fa] to-[#bfdbfe] transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          {activeVodItem.type === 'series' && (
                            <div className="space-y-1 pt-1.5 border-t border-white/10">
                              <div className="flex items-center justify-between text-[11px] font-semibold text-[#bfdbfe]">
                                <span>
                                  {tr(
                                    `Sezonul ${selectedSeason}`,
                                    `Season ${selectedSeason}`,
                                    `Сезон ${selectedSeason}`
                                  )}{' '}
                                  •{' '}
                                  {totalEps > 0
                                    ? tr(
                                      `Ep. ${selectedEpisode} din ${totalEps}`,
                                      `Ep. ${selectedEpisode} of ${totalEps}`,
                                      `Серия ${selectedEpisode} из ${totalEps}`
                                    )
                                    : tr(
                                      `Episodul ${selectedEpisode}`,
                                      `Episode ${selectedEpisode}`,
                                      `Серия ${selectedEpisode}`
                                    )}
                                </span>
                              </div>
                              {totalEps > 0 && (
                                <div className="w-full h-1 rounded-full bg-white/15 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-[#6ee7b7] to-[#bfdbfe] transition-all"
                                    style={{ width: `${epPct}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-white/10">
                            <button
                              type="button"
                              onClick={() =>
                                handleStartVodPlayback(prog.currentTime)
                              }
                              className="h-8 px-4 rounded-full bg-[#1e3a8a] text-white border border-[#3b82f6]/50 font-extrabold text-xs inline-flex items-center gap-1.5 focus:outline-none focus:ring-4 focus:ring-white shadow-md cursor-pointer"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>
                                {tr(
                                  `Continuă (${formatWatchSeconds(prog.currentTime)})`,
                                  `Resume (${formatWatchSeconds(prog.currentTime)})`,
                                  `Продолжить (${formatWatchSeconds(prog.currentTime)})`
                                )}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartVodPlayback(0)}
                              className="h-8 px-3.5 rounded-full bg-white/10 hover:bg-white/20 focus:bg-white focus:text-[#141414] text-zinc-200 font-bold text-xs inline-flex items-center gap-1 focus:outline-none focus:ring-4 focus:ring-white cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>
                                {tr('De la 00:00', 'From 00:00', 'С 00:00')}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveWatchProgressItem(activeVodItem.id)
                              }
                              title={tr(
                                'Șterge din istoric / vizionate',
                                'Remove from Watch History',
                                'Удалить из истории'
                              )}
                              className="h-8 px-3.5 rounded-full bg-rose-500/15 hover:bg-rose-600 focus:bg-rose-600 text-rose-300 hover:text-white focus:text-white border border-rose-500/30 font-bold text-xs inline-flex items-center gap-1 focus:outline-none focus:ring-4 focus:ring-white cursor-pointer transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>
                                {tr(
                                  'Șterge din istoric',
                                  'Remove history',
                                  'Удалить'
                                )}
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 1. COMPACT AUDIO TRACK SELECTOR (MOD RESTRÂNS - macOS Tahoe Liquid Glass & Pill Buttons) */}
                    {resolvedDirectStream?.audioNames &&
                      resolvedDirectStream.audioNames.length > 0 &&
                      (() => {
                        const names = resolvedDirectStream.audioNames || [];
                        const prefIdx = resolveAudioTrackIndexByPreference(
                          names,
                          tvSettings.defaultAudioPref
                        );
                        const ordered = names
                          .map((aName, idx) => ({ aName, idx }))
                          .sort((a, b) => {
                            if (a.idx === prefIdx) return -1;
                            if (b.idx === prefIdx) return 1;
                            return a.idx - b.idx;
                          });
                        const currentAudioName =
                          names[effectiveAudioTrackIdx] ||
                          ordered[0]?.aName ||
                          'Original';
                        const isAudioOpen = openVodCompactPanel === 'audio';

                        return (
                          <div
                            data-vod-compact-open-box={
                              isAudioOpen ? 'true' : undefined
                            }
                            className={`w-full rounded-2xl tahoe-glass transition-all ${isAudioOpen
                              ? 'border-[#60a5fa]/60 p-2.5 space-y-2'
                              : 'p-1'
                              }`}
                          >
                            <button
                              type="button"
                              data-vod-compact-trigger="audio"
                              onClick={() => toggleVodCompactPanel('audio')}
                              className={`w-full px-3.5 py-2 rounded-xl flex items-center justify-between gap-2 text-left transition-all focus:outline-none focus:ring-4 focus:ring-[#60a5fa] focus:bg-white focus:text-[#141414] cursor-pointer group ${isAudioOpen
                                ? 'bg-white/15 text-white'
                                : 'hover:bg-white/10 text-zinc-100'
                                }`}
                            >
                              <div className="min-w-0 flex items-center gap-2">
                                <Languages className="w-3.5 h-3.5 text-[#60a5fa] group-focus:text-blue-700 shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-[9px] font-extrabold uppercase tracking-wider text-[#60a5fa] group-focus:text-blue-700 leading-none">
                                    {tr(
                                      'Limba Audio',
                                      'Audio Track',
                                      'Озвучка / Аудио'
                                    )}
                                  </div>
                                  <div className="text-xs font-extrabold truncate leading-tight mt-0.5">
                                    {currentAudioName} ✓
                                  </div>
                                </div>
                              </div>
                              <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-[#60a5fa]/20 text-[#60a5fa] group-focus:bg-zinc-900 group-focus:text-[#60a5fa] text-[10px] font-extrabold inline-flex items-center gap-1 whitespace-nowrap">
                                <span>
                                  {isAudioOpen
                                    ? tr('Închide', 'Close', 'Закрыть')
                                    : `${names.length} ${tr('piste', 'tracks', 'дор.')}`}
                                </span>
                                <span>{isAudioOpen ? '▲' : '▾'}</span>
                              </span>
                            </button>

                            {isAudioOpen && (
                              <div className="grid grid-cols-2 gap-1.5 pt-0.5 max-h-44 overflow-y-auto no-scrollbar">
                                {ordered.map(({ aName, idx }) => {
                                  const isSel = effectiveAudioTrackIdx === idx;
                                  return (
                                    <button
                                      key={`card_aud_${aName}_${idx}`}
                                      type="button"
                                      data-vod-compact-option="true"
                                      data-vod-compact-active-item={
                                        isSel ? 'true' : undefined
                                      }
                                      onClick={() => {
                                        userManuallySelectedServerRef.current = true;
                                        userSelectedFlTorrentIdRef.current = null;
                                        setActiveServer('kinogram_hls');
                                        setSelectedAudioTrackIdx(idx);
                                        setOpenVodCompactPanel(null);
                                        handleStartVodPlayback();
                                      }}
                                      className={`h-8 px-3 rounded-xl text-[11px] font-extrabold inline-flex items-center justify-between gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer truncate ${isSel
                                        ? 'bg-[#1e3a8a] text-white border border-[#3b82f6]/50 shadow-md'
                                        : 'bg-white/10 hover:bg-white/20 focus:bg-white focus:text-[#141414] text-zinc-200 border border-white/10'
                                        }`}
                                    >
                                      <span className="truncate">{aName}</span>
                                      {isSel && <span className="shrink-0">✓</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                    {/* 2. COMPACT VIDEO SOURCE / SERVER SELECTOR (MOD RESTRÂNS - macOS Tahoe Liquid Glass & Pill Buttons) */}
                    {(() => {
                      const currentSrvObj =
                        VOD_SERVERS.find((s) => s.id === activeServer) ||
                        VOD_SERVERS[0];
                      const currentSrvLabel = currentSrvObj.label
                        .split('(')[0]
                        .trim();
                      const isServerOpen = openVodCompactPanel === 'server';

                      return (
                        <div
                          data-vod-compact-open-box={
                            isServerOpen ? 'true' : undefined
                          }
                          className={`w-full rounded-2xl tahoe-glass transition-all ${isServerOpen
                            ? 'border-[#60a5fa]/60 p-2.5 space-y-2'
                            : 'p-1'
                            }`}
                        >
                          <button
                            type="button"
                            data-vod-compact-trigger="server"
                            onClick={() => toggleVodCompactPanel('server')}
                            className={`w-full px-3.5 py-2 rounded-xl flex items-center justify-between gap-2 text-left transition-all focus:outline-none focus:ring-4 focus:ring-[#60a5fa] focus:bg-white focus:text-[#141414] cursor-pointer group ${isServerOpen
                              ? 'bg-white/15 text-white'
                              : 'hover:bg-white/10 text-zinc-100'
                              }`}
                          >
                            <div className="min-w-0 flex items-center gap-2">
                              <Layers className="w-3.5 h-3.5 text-[#60a5fa] group-focus:text-blue-700 shrink-0" />
                              <div className="min-w-0">
                                <div className="text-[9px] font-extrabold uppercase tracking-wider text-[#60a5fa] group-focus:text-blue-700 leading-none">
                                  {tr(
                                    'Sursa Video / Server',
                                    'Video Source / Server',
                                    'Источник видео / Сервер'
                                  )}
                                </div>
                                <div className="text-xs font-extrabold truncate leading-tight mt-0.5">
                                  {currentSrvLabel} ✓
                                </div>
                              </div>
                            </div>
                            <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-[#60a5fa]/20 text-[#60a5fa] group-focus:bg-zinc-900 group-focus:text-[#60a5fa] text-[10px] font-extrabold inline-flex items-center gap-1 whitespace-nowrap">
                              <span>
                                {isServerOpen
                                  ? tr('Închide', 'Close', 'Закрыть')
                                  : `${VOD_SERVERS.length} ${tr('surse', 'servers', 'серв.')}`}
                              </span>
                              <span>{isServerOpen ? '▲' : '▾'}</span>
                            </span>
                          </button>

                          {isServerOpen && (
                            <div className="flex flex-col gap-1 pt-0.5 max-h-48 overflow-y-auto no-scrollbar">
                              {VOD_SERVERS.map((srv) => {
                                const isSrv = activeServer === srv.id;
                                return (
                                  <button
                                    key={`card_srv_${srv.id}`}
                                    type="button"
                                    data-vod-compact-option="true"
                                    data-vod-compact-active-item={
                                      isSrv ? 'true' : undefined
                                    }
                                    onClick={() => {
                                      userManuallySelectedServerRef.current = true;
                                      if (srv.id !== 'filelist_torrent') {
                                        userSelectedFlTorrentIdRef.current = null;
                                      }
                                      setActiveServer(srv.id);
                                      setOpenVodCompactPanel(null);
                                      handleStartVodPlayback();
                                    }}
                                    className={`h-8 px-3.5 rounded-xl text-[11px] font-extrabold flex items-center justify-between gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer ${isSrv
                                      ? 'bg-[#1e3a8a] text-white border border-[#3b82f6]/50 shadow-md'
                                      : 'bg-white/10 hover:bg-white/20 focus:bg-white focus:text-[#141414] text-zinc-200 border border-white/10'
                                      }`}
                                  >
                                    <span className="truncate">
                                      {srv.label.split('(')[0].trim()}
                                    </span>
                                    {isSrv && <span className="shrink-0">✓</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* 3. STREMIO STREAM SELECTOR (Direct HLS + FileList.io VIP + Torrentio 4K/1080p) */}
                    {(isFileListStreamLoading ||
                      isDirectStreamLoading ||
                      Boolean(
                        resolvedDirectStream?.ok &&
                        (resolvedDirectStream.dashUrl ||
                          resolvedDirectStream.hlsUrl)
                      ) ||
                      (resolvedFileListStream?.torrents &&
                        resolvedFileListStream.torrents.length > 0) ||
                      resolvedFileListStream?.selectedTorrent) &&
                      (() => {
                        const flList =
                          resolvedFileListStream?.torrents &&
                            resolvedFileListStream.torrents.length > 0
                            ? resolvedFileListStream.torrents
                            : resolvedFileListStream?.selectedTorrent
                              ? [resolvedFileListStream.selectedTorrent]
                              : [];
                        const activeTor =
                          flList.find(
                            (t) => t.id === resolvedFileListStream?.torrentId
                          ) || flList[0];
                        const hasDirectHls = Boolean(
                          resolvedDirectStream?.ok &&
                          (resolvedDirectStream.dashUrl ||
                            resolvedDirectStream.hlsUrl)
                        );
                        const totalStreamsCount =
                          flList.length + (hasDirectHls ? 1 : 0);
                        const isFlOpen = openVodCompactPanel === 'filelist';

                        return (
                          <div
                            data-vod-compact-open-box={
                              isFlOpen ? 'true' : undefined
                            }
                            className={`w-full rounded-2xl tahoe-glass transition-all ${isFlOpen
                                ? 'border border-[#60a5fa]/60 p-2.5 space-y-2'
                                : 'p-1'
                              }`}
                          >
                            <button
                              type="button"
                              data-vod-compact-trigger="filelist"
                              onClick={() => toggleVodCompactPanel('filelist')}
                              className={`w-full px-3.5 py-2 rounded-xl flex items-center justify-between gap-2 text-left transition-all focus:outline-none focus:ring-4 focus:ring-[#60a5fa] focus:bg-white focus:text-[#141414] cursor-pointer group ${isFlOpen
                                  ? 'bg-white/15 text-white'
                                  : 'hover:bg-white/10 text-zinc-100'
                                }`}
                            >
                              <div className="min-w-0 flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5 text-[#60a5fa] group-focus:text-blue-700 shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-[9px] font-extrabold uppercase tracking-wider text-[#60a5fa] group-focus:text-blue-700 flex items-center gap-1.5 leading-none whitespace-nowrap">
                                    <span>Stream-uri</span>
                                    <span className="px-1.5 py-0.2 rounded-full bg-[#60a5fa]/20 text-[#60a5fa] group-focus:bg-zinc-900 group-focus:text-[#60a5fa] text-[8.5px]">
                                      FileList + Torrentio
                                    </span>
                                  </div>
                                  <div className="text-xs font-extrabold truncate leading-tight mt-0.5">
                                    {activeServer === 'kinogram_hls' &&
                                      hasDirectHls
                                      ? `Instant HLS • 1080p • ${resolvedDirectStream?.audioNames?.[
                                      effectiveAudioTrackIdx
                                      ] || 'Multi-Audio'
                                      }`
                                      : activeTor
                                        ? `${activeTor.quality || '1080p'}${activeTor.isRo ? ' • 🇷🇴 RO' : ''} • ▲ ${activeTor.seeders} • ${activeTor.sizeFormatted}`
                                        : tr(
                                          'Se caută stream-uri 4K / 1080p...',
                                          'Searching 4K / 1080p streams...',
                                          'Поиск потоков 4K / 1080p...'
                                        )}
                                  </div>
                                </div>
                              </div>
                              <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-[#60a5fa]/20 text-[#60a5fa] group-focus:bg-zinc-900 group-focus:text-[#60a5fa] text-[10px] font-extrabold inline-flex items-center gap-1 whitespace-nowrap">
                                {isFileListStreamLoading ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <>
                                    <span>
                                      {totalStreamsCount}{' '}
                                      {tr('surse', 'streams', 'пот.')}
                                    </span>
                                    <span>{isFlOpen ? '▲' : '▾'}</span>
                                  </>
                                )}
                              </span>
                            </button>

                            {isFlOpen && (
                              <div className="max-h-52 overflow-y-auto no-scrollbar space-y-1.5 pt-0.5 pr-0.5">
                                {/* Stream 0: Server 1 Instant Direct HLS/DASH */}
                                {hasDirectHls && (
                                  <button
                                    type="button"
                                    data-vod-compact-option="true"
                                    onClick={() => {
                                      userManuallySelectedServerRef.current = true;
                                      userSelectedFlTorrentIdRef.current = null;
                                      setActiveServer('kinogram_hls');
                                      setOpenVodCompactPanel(null);
                                      handleStartVodPlayback();
                                    }}
                                    className={`w-full px-3 py-2 rounded-xl text-left border transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer ${activeServer === 'kinogram_hls'
                                      ? 'bg-[#1e3a8a] text-white border-[#60a5fa] font-extrabold shadow-md'
                                      : 'bg-white/[0.07] hover:bg-white/15 focus:bg-white focus:text-[#141414] text-zinc-100 border-white/10'
                                      }`}
                                  >
                                    <div className="flex items-center justify-between gap-2 text-[10px] font-extrabold">
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className={`px-1.5 py-0.5 rounded-md text-[9.5px] ${activeServer === 'kinogram_hls'
                                            ? 'bg-zinc-950 text-[#60a5fa]'
                                            : 'bg-sky-500/25 text-sky-300'
                                            }`}
                                        >
                                          1080p INSTANT
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded-md bg-blue-500/25 text-blue-300 text-[9.5px]">
                                          Direct HLS
                                        </span>
                                      </div>
                                      <span className="text-[9.5px] font-black uppercase tracking-wider opacity-85">
                                        ⚡ Fără Buffer
                                      </span>
                                    </div>
                                    <div className="text-[10.5px] truncate mt-0.5 opacity-90 font-semibold">
                                      🔊{' '}
                                      {(
                                        resolvedDirectStream?.audioNames || [
                                          'Original Multi-Audio',
                                        ]
                                      )
                                        .slice(0, 3)
                                        .join(' • ')}
                                    </div>
                                  </button>
                                )}

                                {/* All FileList.io VIP & Torrentio P2P Streams */}
                                {flList.map((flTor) => {
                                  const isSelectedTor =
                                    activeServer === 'filelist_torrent' &&
                                    resolvedFileListStream?.torrentId ===
                                    flTor.id;
                                  const is4K = (flTor.quality || '')
                                    .toUpperCase()
                                    .includes('4K');
                                  const isTorrentio =
                                    flTor.source === 'torrentio' ||
                                    flTor.id < 0;

                                  return (
                                    <button
                                      key={`fl_tor_${flTor.id}`}
                                      type="button"
                                      data-vod-compact-option="true"
                                      data-vod-compact-active-item={
                                        isSelectedTor ? 'true' : undefined
                                      }
                                      onClick={() => {
                                        setOpenVodCompactPanel(null);
                                        handleSelectFileListTorrent(
                                          flTor.id,
                                          flTor.fileIdx,
                                          true
                                        );
                                      }}
                                      className={`w-full px-3 py-2 rounded-xl text-left border transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer ${isSelectedTor
                                        ? 'bg-[#1e3a8a] text-white border-[#60a5fa] font-extrabold shadow-md'
                                        : 'bg-white/[0.07] hover:bg-white/15 focus:bg-white focus:text-[#141414] text-zinc-100 border-white/10'
                                        }`}
                                    >
                                      <div className="flex items-center justify-between gap-2 text-[10px] font-extrabold">
                                        <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                                          <span
                                            className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-black shrink-0 ${isSelectedTor
                                              ? 'bg-zinc-950 text-[#60a5fa]'
                                              : is4K
                                                ? 'bg-amber-400 text-zinc-950'
                                                : 'bg-[#60a5fa]/20 text-[#60a5fa]'
                                              }`}
                                          >
                                            {flTor.quality || '1080p'}
                                          </span>
                                          <span
                                            className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-bold truncate ${isSelectedTor
                                              ? 'bg-zinc-900/20 text-zinc-950'
                                              : isTorrentio
                                                ? 'bg-sky-500/25 text-sky-200 border border-sky-400/30'
                                                : 'bg-blue-500/25 text-emerald-200 border border-blue-400/30'
                                              }`}
                                          >
                                            {isTorrentio
                                              ? `Torrentio${flTor.tracker ? ` • ${flTor.tracker}` : ''}`
                                              : 'FileList VIP'}
                                          </span>
                                          {flTor.isRo && (
                                            <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-zinc-950 text-[9.5px] font-black shrink-0">
                                              🇷🇴 RO
                                            </span>
                                          )}
                                          {flTor.freeleech && !isTorrentio && (
                                            <span className="px-1.5 py-0.5 rounded-md bg-[#1e3a8a] text-white text-[9px] font-black shrink-0">
                                              FL
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0 tabular-nums text-[10px]">
                                          <span
                                            className={
                                              isSelectedTor
                                                ? 'text-zinc-950 font-black'
                                                : 'text-blue-400 font-extrabold'
                                            }
                                          >
                                            ▲ {flTor.seeders}
                                          </span>
                                          <span>{flTor.sizeFormatted}</span>
                                        </div>
                                      </div>
                                      <div className="text-[10.5px] truncate mt-0.5 opacity-85 font-medium">
                                        {flTor.audioInfo
                                          ? `🔊 ${flTor.audioInfo} • `
                                          : ''}
                                        {flTor.releaseTitle}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                  </div>
                </div>

                {/* For Series: Full Lampa Seasons & Episodes Section right on the Card (macOS Tahoe Liquid Glass) */}
                {activeVodItem.type === 'series' &&
                  availableSeasons.length > 0 && (
                    <div className="p-5 sm:p-6 rounded-[28px] tahoe-glass space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black uppercase tracking-wider text-amber-400 mr-2">
                          {tr(
                            'Sezoane & Episoade:',
                            'Seasons & Episodes:',
                            'Сезоны и серии:'
                          )}
                        </span>
                        {availableSeasons.map((sNum) => (
                          <button
                            key={sNum}
                            type="button"
                            onClick={() => {
                              userSelectedFlTorrentIdRef.current = null;
                              setSelectedSeason(sNum);
                              setSelectedEpisode(1);
                              setResumeStartSeconds(0);
                            }}
                            className={`h-10 px-5 rounded-full text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${selectedSeason === sNum
                              ? 'bg-white text-zinc-950 shadow-md'
                              : 'bg-white/10 hover:bg-white/20 focus:bg-white focus:text-zinc-950 text-zinc-200 border border-white/15'
                              }`}
                          >
                            {tr(`Sezonul ${sNum}`, `Season ${sNum}`, `Сезон ${sNum}`)}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 py-2">
                        {episodesForSeason.map((ep) => {
                          const isCurrent = selectedEpisode === ep.episode;
                          const epKey = `S${selectedSeason}E${ep.episode}`;
                          const epProg =
                            watchProgressMap[activeVodItem.id]
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
                          const isWatched =
                            epPct >= 85 ||
                            (selectedEpisode > ep.episode &&
                              Boolean(watchProgressMap[activeVodItem.id]));
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
                          const epThumb =
                            ep.thumbnail ||
                            (resolvedImdb
                              ? `https://episodes.metahub.space/${resolvedImdb}/${selectedSeason}/${ep.episode}/w780.jpg`
                              : '') ||
                            detailedMeta?.background ||
                            activeVodItem.background ||
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
                              className={`group w-full rounded-2xl overflow-hidden text-left flex flex-col border transition-all focus:outline-none focus:ring-4 focus:ring-white cursor-pointer ${isCurrent
                                ? 'bg-blue-500/20 border-blue-400 shadow-[0_12px_32px_rgba(37, 99, 235,0.28)]'
                                : 'bg-white/[0.06] hover:bg-white/15 focus:bg-white focus:text-zinc-950 text-zinc-100 border-white/15'
                                }`}
                            >
                              <div className="relative w-full h-36 bg-zinc-900 overflow-hidden shrink-0">
                                {epThumb && (
                                  <img
                                    src={epThumb}
                                    alt={epLabel}
                                    loading="lazy"
                                    onError={(e) => {
                                      const fallback =
                                        detailedMeta?.background ||
                                        activeVodItem.poster ||
                                        '';
                                      if (
                                        fallback &&
                                        e.currentTarget.src !== fallback
                                      ) {
                                        e.currentTarget.src = fallback;
                                      }
                                    }}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                                <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/80 backdrop-blur-md border border-white/15 text-[11px] font-black text-white">
                                  S{selectedSeason}:E{ep.episode}
                                </span>
                                {isWatched && (
                                  <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-[#1e3a8a] text-white text-[10px] font-black shadow">
                                    ✓ {tr('Văzut', 'Watched', 'Просмотрено')}
                                  </span>
                                )}
                                <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 text-zinc-950 text-[11px] font-extrabold shadow">
                                    <Play className="w-3 h-3 fill-current" />
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
                                  <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/60">
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
                                      `Sezonul ${selectedSeason}`,
                                      `Season ${selectedSeason}`,
                                      `Сезон ${selectedSeason}`
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
                        {/* NETFLIX-STYLE WIDESCREEN HERO BILLBOARD BANNER (Newest 2025–2026 Release with Very High IMDb Rating) */}
                        {heroBillboardItems.length > 0 &&
                          (() => {
                            const safeIdx =
                              homeHeroIdx % heroBillboardItems.length;
                            const heroItem =
                              heroBillboardItems[safeIdx] ||
                              heroBillboardItems[0];
                            const heroBackdrop =
                              heroItem.background ||
                              `https://images.metahub.space/background/medium/${heroItem.id}/img`;
                            const heroLogoUrl = `https://images.metahub.space/logo/medium/${heroItem.id}/img`;
                            const heroYear =
                              extractVodProductionYear(heroItem) || 2026;
                            const cachedHeroMeta =
                              spotlightMetaCacheRef.current[
                              `${heroItem.id}_${uiLang}`
                              ];

                            return (
                              <div
                                data-top-hero-card="true"
                                className="relative w-full min-h-[245px] sm:min-h-[395px] rounded-2xl sm:rounded-[28px] overflow-hidden border border-white/15 shadow-[0_24px_60px_rgba(0,0,0,0.85)] bg-[#111318] flex flex-col justify-between p-4 sm:p-9"
                              >
                                {/* Full-Bleed Widescreen Backdrop */}
                                <img
                                  key={`hero_bg_${heroItem.id}`}
                                  src={heroBackdrop}
                                  alt={heroItem.name}
                                  onError={(e) => {
                                    const fallback =
                                      heroItem.poster ||
                                      `https://images.metahub.space/poster/medium/${heroItem.id}/img`;
                                    if (e.currentTarget.src !== fallback) {
                                      e.currentTarget.src = fallback;
                                    }
                                  }}
                                  className="pointer-events-none absolute inset-0 w-full h-full object-cover object-center scale-[1.01] transition-all duration-700"
                                />
                                {/* Netflix Vignette Gradients (Left & Bottom) */}
                                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/95 via-black/55 to-transparent" />
                                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-black/20" />

                                {/* Top Row: Brand Emblem + Top Spotlight Selector Dots */}
                                <div className="relative z-10 flex items-center justify-between gap-3">
                                  {(() => {
                                    const heroPlatId =
                                      lookupPlatformByImdbId(heroItem.id) ||
                                      detectStreamingPlatformFromTexts([
                                        heroItem.releaseTitle,
                                      ]) ||
                                      'netflix';
                                    const heroPlatLabel =
                                      STREAMING_PLATFORMS.find(
                                        (p) => p.id === heroPlatId
                                      )?.label || 'Netflix';
                                    return (
                                      <div className="flex items-center gap-2.5">
                                        <StreamingPlatformLogo
                                          platformId={heroPlatId}
                                          size="sm"
                                        />
                                        <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.22em] text-zinc-200 drop-shadow">
                                          {heroPlatLabel} •{' '}
                                          {heroItem.type === 'series'
                                            ? tr(
                                              'SERIAL RECOMANDAT',
                                              'FEATURED SERIES',
                                              'СЕРИАЛ • ПРЕМЬЕРА'
                                            )
                                            : tr(
                                              'FILM RECOMANDAT',
                                              'FEATURED MOVIE',
                                              'ФИЛЬМ • ПРЕМЬЕРА'
                                            )}
                                        </span>
                                      </div>
                                    );
                                  })()}

                                  {heroBillboardItems.length > 1 && (
                                    <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15">
                                      {heroBillboardItems.map((hItem, idx) => {
                                        const isCurrentHero = idx === safeIdx;
                                        return (
                                          <button
                                            key={`hero_dot_${hItem.id}`}
                                            type="button"
                                            title={`${hItem.name} (★ ${hItem.imdbRating || '8.5'})`}
                                            onClick={() => {
                                              setHomeHeroIdx(idx);
                                              handleFocusVodItem(hItem);
                                            }}
                                            className={`h-2.5 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer ${isCurrentHero
                                              ? 'w-7 bg-[#E50914]'
                                              : 'w-2.5 bg-white/35 hover:bg-white/70'
                                              }`}
                                          />
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                {/* Middle & Bottom: Display Title/Logo + Metadata + Play & More Info + Bottom-Right Badges */}
                                <div className="relative z-10 mt-5 sm:mt-12 flex flex-col gap-3 sm:gap-4">
                                  <div className="max-w-2xl space-y-2 sm:space-y-2.5">
                                    {!failedHeroLogoIds[heroItem.id] ? (
                                      <img
                                        key={`hero_logo_${heroItem.id}`}
                                        src={heroLogoUrl}
                                        alt={heroItem.name}
                                        onError={() =>
                                          setFailedHeroLogoIds((prev) => ({
                                            ...prev,
                                            [heroItem.id]: true,
                                          }))
                                        }
                                        className="max-h-12 sm:max-h-24 max-w-[220px] sm:max-w-[420px] w-auto object-contain object-left drop-shadow-[0_8px_24px_rgba(0,0,0,0.95)]"
                                      />
                                    ) : (
                                      <h2 className="text-2xl sm:text-5xl font-black uppercase tracking-tight text-white leading-none drop-shadow-[0_6px_24px_rgba(0,0,0,0.95)] line-clamp-2">
                                        {heroItem.name}
                                      </h2>
                                    )}

                                    {/* Metadata Line: Movie/Series • Genres • Year • IMDb Rating • 16+ • 4K */}
                                    <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-bold text-zinc-200 drop-shadow">
                                      <span className="text-white font-extrabold">
                                        {heroItem.type === 'series'
                                          ? tr('Serial', 'Series', 'Сериал')
                                          : tr('Film', 'Movie', 'Фильм')}
                                      </span>
                                      {heroItem.genres &&
                                        heroItem.genres.length > 0 && (
                                          <>
                                            <span className="text-zinc-500">
                                              •
                                            </span>
                                            <span>
                                              {heroItem.genres
                                                .slice(0, 2)
                                                .join(' • ')}
                                            </span>
                                          </>
                                        )}
                                      <span className="text-zinc-500">•</span>
                                      <span className="text-white font-extrabold">
                                        {heroItem.releaseInfo || heroYear}
                                      </span>
                                      {heroItem.imdbRating && (
                                        <>
                                          <span className="text-zinc-500">
                                            •
                                          </span>
                                          <span className="px-2 py-0.5 rounded-md bg-amber-400 text-zinc-950 text-xs font-black shadow">
                                            ★ IMDb {heroItem.imdbRating}
                                          </span>
                                        </>
                                      )}
                                      <span className="text-zinc-500">•</span>
                                      <span className="px-2 py-0.5 rounded-md bg-white/15 border border-white/25 text-[11px] font-extrabold text-white">
                                        4K UHD
                                      </span>
                                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-[11px] font-bold text-zinc-300">
                                        16+
                                      </span>
                                    </div>

                                    {(cachedHeroMeta?.description ||
                                      heroItem.description) && (
                                        <p className="text-xs sm:text-sm text-zinc-200/90 line-clamp-2 max-w-xl leading-relaxed drop-shadow">
                                          {cachedHeroMeta?.description ||
                                            heroItem.description}
                                        </p>
                                      )}
                                  </div>

                                  {/* Bottom Action Bar: Left (Play + More Info) & Right (Recently Added + TOP 10 #1) */}
                                  <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 pt-1">
                                    <div className="flex flex-row items-center gap-2 sm:gap-3">
                                      <button
                                        type="button"
                                        onFocus={() =>
                                          handleFocusVodItem(heroItem)
                                        }
                                        onMouseEnter={() =>
                                          handleFocusVodItem(heroItem)
                                        }
                                        onClick={() =>
                                          handleOpenVod(heroItem, true)
                                        }
                                        className="group/heroplay w-auto shrink-0 h-10 sm:h-12 px-5 sm:px-8 rounded-full bg-white hover:bg-zinc-200 focus:bg-[#1e3a8a] text-[#081220] hover:text-[#081220] focus:text-white border border-white/80 focus:border-[#3b82f6]/50 text-xs sm:text-base font-extrabold inline-flex flex-row items-center justify-center gap-2 sm:gap-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.6)] transition-all focus:outline-none focus:ring-4 focus:ring-white focus:scale-105 cursor-pointer whitespace-nowrap"
                                      >
                                        <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current text-[#081220] group-focus/heroplay:text-white shrink-0" />
                                        <span className="text-[#081220] group-focus/heroplay:text-white font-extrabold">
                                          {tr('Redă', 'Play', 'Смотреть')}
                                        </span>
                                      </button>

                                      <button
                                        type="button"
                                        onFocus={() =>
                                          handleFocusVodItem(heroItem)
                                        }
                                        onMouseEnter={() =>
                                          handleFocusVodItem(heroItem)
                                        }
                                        onClick={() =>
                                          handleOpenVod(heroItem, false)
                                        }
                                        className="w-auto shrink-0 h-10 sm:h-12 px-4 sm:px-7 rounded-full bg-zinc-700/75 hover:bg-zinc-600/85 focus:bg-white focus:text-[#141414] backdrop-blur-xl border border-white/25 text-white text-xs sm:text-base font-extrabold inline-flex flex-row items-center justify-center gap-2 shadow-lg transition-all focus:outline-none focus:ring-4 focus:ring-white cursor-pointer whitespace-nowrap"
                                      >
                                        <span>
                                          {tr(
                                            'Mai multe detalii',
                                            'More Info',
                                            'Подробнее'
                                          )}
                                        </span>
                                      </button>
                                    </div>

                                    <div className="hidden sm:flex flex-wrap items-center gap-2.5">
                                      <span className="h-9 px-3.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/15 text-xs font-extrabold text-white inline-flex items-center gap-2 shadow-lg">
                                        <Flame className="w-4 h-4 text-[#E50914] fill-[#E50914]" />
                                        <span>
                                          {tr(
                                            'Adăugat Recent',
                                            'Recently Added',
                                            'Недавно добавлено'
                                          )}
                                        </span>
                                      </span>

                                      <span className="h-9 px-3.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/15 text-xs font-extrabold text-white inline-flex items-center gap-2 shadow-lg">
                                        <span className="px-1.5 py-0.5 rounded bg-[#E50914] text-white text-[9px] font-black leading-none uppercase">
                                          TOP 10
                                        </span>
                                        <span>
                                          #{safeIdx + 1}{' '}
                                          {heroItem.type === 'series'
                                            ? tr(
                                              'în Seriale',
                                              'in Series',
                                              'в Сериалах'
                                            )
                                            : tr(
                                              'în Filme',
                                              'in Movies',
                                              'в Фильмах'
                                            )}{' '}
                                          {heroItem.imdbRating
                                            ? `(★ ${heroItem.imdbRating})`
                                            : ''}
                                        </span>
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                        {/* Optional Shelf 0: Продолжить просмотр (Continue Watching Movies & Series — Strictly 1 Single Row on Home Page + TV Remote Delete Button) */}
                        {historyList.length > 0 && (
                          <div className="space-y-3.5">
                            <h2 className="text-xl sm:text-[22px] font-normal text-zinc-100 tracking-tight">
                              {tr(
                                `Continuă vizionarea — ${activeProfile.name}`,
                                `Continue Watching for ${activeProfile.name}`,
                                `Продолжить просмотр — ${activeProfile.name}`
                              )}
                            </h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                              {historyList.slice(0, 5).map((entry, idx) => {
                                const item = entry.item;
                                const isLiveCard = false;
                                const devLabel =
                                  sanitizeDeviceName(entry.deviceName) || 'TV';
                                const rawPosterUrl =
                                  item.poster ||
                                  `https://images.metahub.space/poster/medium/${item.id}/img`;
                                const posterUrl = rawPosterUrl.replace(
                                  '/posters/kp_small/',
                                  '/posters/kp/'
                                );
                                const responsiveRowVisibility =
                                  idx === 2
                                    ? 'hidden sm:flex'
                                    : idx === 3
                                      ? 'hidden md:flex'
                                      : idx === 4
                                        ? 'hidden lg:flex'
                                        : 'flex';
                                return (
                                  <div
                                    key={`home_hist_${item.id}`}
                                    className={`${responsiveRowVisibility} w-full flex-col gap-2`}
                                  >
                                    <button
                                      type="button"
                                      data-watched-poster-btn="true"
                                      data-vod-card="true"
                                      onFocus={() => handleFocusVodItem(item)}
                                      onMouseEnter={() => handleFocusVodItem(item)}
                                      onClick={() => handleOpenVod(item)}
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
                                          className="absolute inset-0 w-full h-full object-cover"
                                        />
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
                                        <span
                                          className={`absolute top-2.5 right-2.5 z-10 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shadow ${item.type === 'series'
                                            ? 'bg-[#172554]/95 text-white border border-[#2563eb]/50'
                                            : 'bg-amber-500/90 text-zinc-950'
                                            }`}
                                        >
                                          {item.type === 'series'
                                            ? tr(
                                              `SERIAL S${entry.season}:E${entry.episode}`,
                                              `SERIES S${entry.season}:E${entry.episode}`,
                                              `СЕРИАЛ S${entry.season}:E${entry.episode}`
                                            )
                                            : tr('FILM', 'MOVIE', 'ФИЛЬМ')}
                                        </span>
                                        {item.imdbRating && (
                                          <span className="absolute bottom-3.5 right-2.5 px-2 py-0.5 rounded-lg bg-black/75 backdrop-blur-sm text-white text-xs font-bold tracking-tight shadow-md">
                                            {item.imdbRating}
                                          </span>
                                        )}
                                        {renderPosterProgressOverlay(
                                          entry,
                                          isLiveCard
                                        )}
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
                                          <span>{item.releaseInfo || '2026'}</span>
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
                              {homeShelves.watchingNowMix.map((item) => {
                                const isFav = savedVodItems.some(
                                  (x) => x.id === item.id
                                );
                                const posterUrl =
                                  item.poster ||
                                  `https://images.metahub.space/poster/medium/${item.id}/img`;
                                return (
                                  <button
                                    key={`home_watch_${item.id}`}
                                    type="button"
                                    data-vod-card="true"
                                    onFocus={() => handleFocusVodItem(item)}
                                    onMouseEnter={() => handleFocusVodItem(item)}
                                    onClick={() => handleOpenVod(item)}
                                    className="group w-full block text-left focus:outline-none cursor-pointer"
                                  >
                                    <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                      <img
                                        src={posterUrl}
                                        alt={item.name}
                                        loading="lazy"
                                        className="w-full h-full object-cover"
                                      />
                                      <span
                                        className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shadow ${item.type === 'series'
                                          ? 'bg-[#172554]/95 text-white border border-[#2563eb]/50'
                                          : 'bg-amber-500/90 text-zinc-950'
                                          }`}
                                      >
                                        {item.type === 'series'
                                          ? tr('SERIAL', 'SERIES', 'СЕРИАЛ')
                                          : tr('FILM', 'MOVIE', 'ФИЛЬМ')}
                                      </span>
                                      {isFav && (
                                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-rose-500 text-xs font-bold">
                                          ❤
                                        </span>
                                      )}
                                      {item.imdbRating && (
                                        <span className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-lg bg-black/75 backdrop-blur-sm text-white text-xs sm:text-sm font-bold tracking-tight shadow-md">
                                          {item.imdbRating}
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-2.5 px-0.5">
                                      <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                        {item.name}
                                      </div>
                                      <div className="text-xs text-zinc-400 mt-0.5">
                                        {item.releaseInfo || '2026'} •{' '}
                                        {item.type === 'series'
                                          ? tr('Serial', 'TV Series', 'Сериал')
                                          : tr('Film', 'Movie', 'Фильм')}
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
                              {homeShelves.newlyAddedMix.map((item) => {
                                const isFav = savedVodItems.some(
                                  (x) => x.id === item.id
                                );
                                const posterUrl =
                                  item.poster ||
                                  `https://images.metahub.space/poster/medium/${item.id}/img`;
                                return (
                                  <button
                                    key={`home_new_${item.id}`}
                                    type="button"
                                    data-vod-card="true"
                                    onFocus={() => handleFocusVodItem(item)}
                                    onMouseEnter={() => handleFocusVodItem(item)}
                                    onClick={() => handleOpenVod(item)}
                                    className="group w-full block text-left focus:outline-none cursor-pointer"
                                  >
                                    <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                      <img
                                        src={posterUrl}
                                        alt={item.name}
                                        loading="lazy"
                                        className="w-full h-full object-cover"
                                      />
                                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-[#1e3a8a] text-white text-[10px] font-extrabold uppercase tracking-wider shadow">
                                        NEW
                                      </span>
                                      <span
                                        className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shadow ${item.type === 'series'
                                          ? 'bg-[#172554]/95 text-white border border-[#2563eb]/50'
                                          : 'bg-amber-500/90 text-zinc-950'
                                          }`}
                                      >
                                        {item.type === 'series'
                                          ? tr('SERIAL', 'SERIES', 'СЕРИАЛ')
                                          : tr('FILM', 'MOVIE', 'ФИЛЬМ')}
                                      </span>
                                      {isFav && (
                                        <span className="absolute top-9 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-rose-500 text-xs font-bold">
                                          ❤
                                        </span>
                                      )}
                                      {item.imdbRating && (
                                        <span className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-lg bg-black/75 backdrop-blur-sm text-white text-xs sm:text-sm font-bold tracking-tight shadow-md">
                                          {item.imdbRating}
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-2.5 px-0.5">
                                      <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                        {item.name}
                                      </div>
                                      <div className="text-xs text-zinc-400 mt-0.5">
                                        {item.releaseInfo || '2026'} •{' '}
                                        {item.type === 'series'
                                          ? tr('Serial', 'TV Series', 'Сериал')
                                          : tr('Film', 'Movie', 'Фильм')}
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
                              {homeShelves.popularSeries.map((item) => {
                                const isFav = savedVodItems.some(
                                  (x) => x.id === item.id
                                );
                                const posterUrl =
                                  item.poster ||
                                  `https://images.metahub.space/poster/medium/${item.id}/img`;
                                return (
                                  <button
                                    key={`home_ser_${item.id}`}
                                    type="button"
                                    data-vod-card="true"
                                    onFocus={() => handleFocusVodItem(item)}
                                    onMouseEnter={() => handleFocusVodItem(item)}
                                    onClick={() => handleOpenVod(item)}
                                    className="group w-full block text-left focus:outline-none cursor-pointer"
                                  >
                                    <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                      <img
                                        src={posterUrl}
                                        alt={item.name}
                                        loading="lazy"
                                        className="w-full h-full object-cover"
                                      />
                                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-[#172554]/95 text-white border border-[#2563eb]/50 text-[10px] font-extrabold uppercase tracking-wider shadow">
                                        {tr('SERIAL', 'SERIES', 'СЕРИАЛ')}
                                      </span>
                                      {isFav && (
                                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-rose-500 text-xs font-bold">
                                          ❤
                                        </span>
                                      )}
                                      {item.imdbRating && (
                                        <span className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-lg bg-black/75 backdrop-blur-sm text-white text-xs sm:text-sm font-bold tracking-tight shadow-md">
                                          {item.imdbRating}
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-2.5 px-0.5">
                                      <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                        {item.name}
                                      </div>
                                      <div className="text-xs text-zinc-400 mt-0.5">
                                        {item.releaseInfo || '2026'} •{' '}
                                        {tr('Serial', 'TV Series', 'Сериал')}
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
                              {homeShelves.popularMovies.map((item) => {
                                const isFav = savedVodItems.some(
                                  (x) => x.id === item.id
                                );
                                const posterUrl =
                                  item.poster ||
                                  `https://images.metahub.space/poster/medium/${item.id}/img`;
                                return (
                                  <button
                                    key={`home_mov_${item.id}`}
                                    type="button"
                                    data-vod-card="true"
                                    onFocus={() => handleFocusVodItem(item)}
                                    onMouseEnter={() => handleFocusVodItem(item)}
                                    onClick={() => handleOpenVod(item)}
                                    className="group w-full block text-left focus:outline-none cursor-pointer"
                                  >
                                    <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                      <img
                                        src={posterUrl}
                                        alt={item.name}
                                        loading="lazy"
                                        className="w-full h-full object-cover"
                                      />
                                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-amber-500/90 text-zinc-950 text-[10px] font-extrabold uppercase tracking-wider shadow">
                                        {tr('FILM', 'MOVIE', 'ФИЛЬМ')}
                                      </span>
                                      {isFav && (
                                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-rose-500 text-xs font-bold">
                                          ❤
                                        </span>
                                      )}
                                      {item.imdbRating && (
                                        <span className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-lg bg-black/75 backdrop-blur-sm text-white text-xs sm:text-sm font-bold tracking-tight shadow-md">
                                          {item.imdbRating}
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-2.5 px-0.5">
                                      <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                        {item.name}
                                      </div>
                                      <div className="text-xs text-zinc-400 mt-0.5">
                                        {item.releaseInfo || '2026'} •{' '}
                                        {tr('Film', 'Movie', 'Фильм')}
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
                              {homeShelves.cartoons.map((item) => {
                                const isFav = savedVodItems.some(
                                  (x) => x.id === item.id
                                );
                                const posterUrl =
                                  item.poster ||
                                  `https://images.metahub.space/poster/medium/${item.id}/img`;
                                return (
                                  <button
                                    key={`home_cart_${item.id}`}
                                    type="button"
                                    data-vod-card="true"
                                    onFocus={() => handleFocusVodItem(item)}
                                    onMouseEnter={() => handleFocusVodItem(item)}
                                    onClick={() => handleOpenVod(item)}
                                    className="group w-full block text-left focus:outline-none cursor-pointer"
                                  >
                                    <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                      <img
                                        src={posterUrl}
                                        alt={item.name}
                                        loading="lazy"
                                        className="w-full h-full object-cover"
                                      />
                                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-sky-500/90 text-zinc-950 text-[10px] font-extrabold uppercase tracking-wider shadow">
                                        {tr('ANIMAȚIE', 'CARTOON', 'МУЛЬТ')}
                                      </span>
                                      {isFav && (
                                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-rose-500 text-xs font-bold">
                                          ❤
                                        </span>
                                      )}
                                      {item.imdbRating && (
                                        <span className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-lg bg-black/75 backdrop-blur-sm text-white text-xs sm:text-sm font-bold tracking-tight shadow-md">
                                          {item.imdbRating}
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-2.5 px-0.5">
                                      <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                        {item.name}
                                      </div>
                                      <div className="text-xs text-zinc-400 mt-0.5">
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
                              {vodItems.map((item) => {
                                const isFav = savedVodItems.some(
                                  (x) => x.id === item.id
                                );
                                const posterUrl =
                                  item.poster ||
                                  `https://images.metahub.space/poster/medium/${item.id}/img`;
                                return (
                                  <button
                                    key={`home_rec_${item.id}`}
                                    type="button"
                                    data-vod-card="true"
                                    onFocus={() => handleFocusVodItem(item)}
                                    onMouseEnter={() => handleFocusVodItem(item)}
                                    onClick={() => handleOpenVod(item)}
                                    className="group w-full block text-left focus:outline-none cursor-pointer"
                                  >
                                    <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                                      <img
                                        src={posterUrl}
                                        alt={item.name}
                                        loading="lazy"
                                        className="w-full h-full object-cover"
                                      />
                                      <span
                                        className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider shadow ${item.type === 'series'
                                          ? 'bg-[#172554]/95 text-white border border-[#2563eb]/50'
                                          : 'bg-amber-500/90 text-zinc-950'
                                          }`}
                                      >
                                        {item.type === 'series'
                                          ? tr('SERIAL', 'SERIES', 'СЕРИАЛ')
                                          : tr('FILM', 'MOVIE', 'ФИЛЬМ')}
                                      </span>
                                      {isFav && (
                                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-rose-500 text-xs font-bold">
                                          ❤
                                        </span>
                                      )}
                                      {item.imdbRating && (
                                        <span className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-lg bg-black/75 backdrop-blur-sm text-white text-xs sm:text-sm font-bold tracking-tight shadow-md">
                                          {item.imdbRating}
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-2.5 px-0.5">
                                      <div className="text-sm sm:text-[15px] font-normal text-zinc-100 group-focus:text-white leading-snug line-clamp-2">
                                        {item.name}
                                      </div>
                                      <div className="text-xs text-zinc-400 mt-0.5">
                                        {item.releaseInfo || '2026'} •{' '}
                                        {item.type === 'series'
                                          ? tr('Serial', 'TV Series', 'Сериал')
                                          : tr('Film', 'Movie', 'Фильм')}
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

                {section === 'iedem_vod' && (
                  <IedemMediatekaSection
                    uiLang={uiLang}
                    onOpenVodItem={handleOpenVod}
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
                    likedTracks={likedMusicTracks}
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
                      isSeries: boolean;
                      qualityLabel: string;
                      totalBytes: number;
                      items: OfflineMediaItem[];
                    }
                  >();

                  for (const item of offlineItems) {
                    const cleanVodId =
                      item.vodId ||
                      item.id.replace(/^vod_/, '').replace(/_S\d+E\d+$/, '');
                    const isSeries =
                      item.mediaKind === 'series' || Boolean(item.season);
                    const existing = groupsMap.get(cleanVodId);
                    if (existing) {
                      existing.items.push(item);
                      existing.totalBytes += item.sizeBytes || 0;
                      if (!existing.poster && item.poster) {
                        existing.poster = item.poster;
                      }
                    } else {
                      groupsMap.set(cleanVodId, {
                        cleanVodId,
                        title: item.title,
                        poster: item.poster || '',
                        isSeries,
                        qualityLabel: item.qualityLabel || 'HD',
                        totalBytes: item.sizeBytes || 0,
                        items: [item],
                      });
                    }
                  }

                  const groupedList = Array.from(groupsMap.values()).map((g) => ({
                    ...g,
                    items: [...g.items].sort((a, b) => {
                      const sDiff = (a.season || 1) - (b.season || 1);
                      if (sDiff !== 0) return sDiff;
                      return (a.episode || 1) - (b.episode || 1);
                    }),
                  }));

                  const activeSeriesGroup = selectedOfflineSeriesId
                    ? groupedList.find((g) => g.cleanVodId === selectedOfflineSeriesId) || null
                    : null;

                  return (
                    <div className="space-y-6 pb-20">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                            <HardDriveDownload className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400 shrink-0" />
                            <span>
                              {tr(
                                `Descărcate Offline (${groupedList.length})`,
                                `Offline Downloads (${groupedList.length})`,
                                `Скачанные офлайн (${groupedList.length})`
                              )}
                            </span>
                          </h1>
                          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                            {tr(
                              `${offlineItems.length} fișiere salvate • Spațiu ocupat: ${formatBytes(offlineItems.reduce((acc, it) => acc + (it.sizeBytes || 0), 0))}`,
                              `${offlineItems.length} files • Used: ${formatBytes(offlineItems.reduce((acc, it) => acc + (it.sizeBytes || 0), 0))}`,
                              `${offlineItems.length} файлов • Занято: ${formatBytes(offlineItems.reduce((acc, it) => acc + (it.sizeBytes || 0), 0))}`
                            )}
                          </p>
                        </div>

                        {offlineItems.length > 0 && (
                          <button
                            type="button"
                            onClick={async () => {
                              for (const it of offlineItems) {
                                await deleteOfflineItem(it.id);
                              }
                              setSelectedOfflineSeriesId(null);
                              await refreshOfflineLibrary();
                            }}
                            className="h-9 sm:h-10 px-4 rounded-xl bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-500/40 text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>
                              {tr('Șterge tot', 'Delete All', 'Удалить все')}
                            </span>
                          </button>
                        )}
                      </div>

                      {activeDownloadProgress && (
                        <div className="p-4 rounded-2xl bg-[#111726] border border-blue-500/35 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs sm:text-sm font-extrabold text-blue-300 flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                              <span>
                                {tr(
                                  'Descărcare în curs...',
                                  'Downloading...',
                                  'Загрузка...'
                                )}
                              </span>
                            </div>
                            {downloadAbortRef.current && (
                              <button
                                type="button"
                                onClick={() => {
                                  downloadAbortRef.current?.abort();
                                  downloadAbortRef.current = null;
                                  setActiveDownloadProgress(null);
                                  setActiveDownloadTargetId(null);
                                }}
                                className="h-7 px-3 rounded-lg bg-rose-900/70 hover:bg-rose-800 text-white text-[11px] font-bold cursor-pointer"
                              >
                                {tr('Oprește', 'Stop', 'Стоп')}
                              </button>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs text-zinc-300 font-bold">
                              <span className="truncate">
                                {activeDownloadTargetId || 'Descărcare'}
                              </span>
                              <span className="tabular-nums text-blue-300">
                                {activeDownloadProgress.percent}% •{' '}
                                {formatBytes(activeDownloadProgress.downloadedBytes)}
                              </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                              <div
                                style={{ width: `${activeDownloadProgress.percent}%` }}
                                className="h-full bg-[#2563eb] rounded-full transition-all"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {groupedList.length === 0 ? (
                        <div className="p-10 rounded-3xl bg-[#111622] border border-white/10 text-center space-y-3">
                          <HardDriveDownload className="w-12 h-12 text-zinc-500 mx-auto" />
                          <div className="text-base sm:text-lg font-extrabold text-white">
                            {tr(
                              'Nu ai niciun film sau serial descărcat',
                              'No downloaded movies or series yet',
                              'Нет скачанных фильмов или сериалов'
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
                            {tr(
                              'Deschide orice film sau serial și apasă iconița de descărcare pentru a salva episoadele offline.',
                              'Open any movie or series and tap the download icon to save episodes offline.',
                              'Откройте любой фильм или сериал и нажмите иконку скачивания.'
                            )}
                          </p>
                        </div>
                      ) : activeSeriesGroup ? (
                        /* INSIDE A DOWNLOADED SERIES CARD: PICK EPISODE TO PLAY OR DELETE */
                        <div className="space-y-4 p-4 sm:p-6 rounded-3xl bg-[#111622] border border-white/12 shadow-2xl">
                          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                            <div className="flex items-center gap-3 min-w-0">
                              <button
                                type="button"
                                onClick={() => setSelectedOfflineSeriesId(null)}
                                className="h-9 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                              >
                                <ArrowLeft className="w-4 h-4 text-blue-400" />
                                <span>{tr('Înapoi', 'Back', 'Назад')}</span>
                              </button>
                              <div className="min-w-0">
                                <h2 className="text-base sm:text-xl font-black text-white truncate">
                                  {activeSeriesGroup.title}
                                </h2>
                                <p className="text-xs text-blue-300 font-bold">
                                  {activeSeriesGroup.items.length} episoade descărcate •{' '}
                                  {formatBytes(activeSeriesGroup.totalBytes)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenVod(
                                    {
                                      id: activeSeriesGroup.cleanVodId,
                                      name: activeSeriesGroup.title,
                                      type: 'series',
                                      poster: activeSeriesGroup.poster,
                                    },
                                    false,
                                    activeSeriesGroup.items[0]?.season || 1,
                                    activeSeriesGroup.items[0]?.episode || 1
                                  )
                                }
                                className="h-9 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <span>{tr('Detalii Serial', 'Series Page', 'О сериале')}</span>
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  for (const epItem of activeSeriesGroup.items) {
                                    await deleteOfflineItem(epItem.id);
                                  }
                                  setSelectedOfflineSeriesId(null);
                                  await refreshOfflineLibrary();
                                }}
                                className="h-9 px-3.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-500/30 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{tr('Șterge serialul', 'Delete Series', 'Удалить сериал')}</span>
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {activeSeriesGroup.items.map((epItem) => (
                              <div
                                key={epItem.id}
                                className="p-3 rounded-2xl bg-[#171d2b] border border-white/10 hover:border-blue-500/45 flex items-center justify-between gap-3 transition-colors"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenVod(
                                      {
                                        id: activeSeriesGroup.cleanVodId,
                                        name: activeSeriesGroup.title,
                                        type: 'series',
                                        poster: activeSeriesGroup.poster,
                                      },
                                      true,
                                      epItem.season || 1,
                                      epItem.episode || 1
                                    )
                                  }
                                  className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer"
                                >
                                  <div className="w-10 h-10 rounded-xl bg-[#2563eb] text-white font-black text-xs flex items-center justify-center shrink-0 shadow">
                                    E{epItem.episode || 1}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                                      Sezonul {epItem.season || 1} • Episodul {epItem.episode || 1}
                                    </div>
                                    <div className="text-[11px] text-zinc-400 font-semibold flex items-center gap-2 mt-0.5">
                                      <span className="text-blue-300 font-bold">{epItem.qualityLabel}</span>
                                      <span>•</span>
                                      <span>{formatBytes(epItem.sizeBytes)}</span>
                                    </div>
                                  </div>
                                </button>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenVod(
                                        {
                                          id: activeSeriesGroup.cleanVodId,
                                          name: activeSeriesGroup.title,
                                          type: 'series',
                                          poster: activeSeriesGroup.poster,
                                        },
                                        true,
                                        epItem.season || 1,
                                        epItem.episode || 1
                                      )
                                    }
                                    className="h-8 px-3 rounded-lg bg-[#2563eb] hover:bg-blue-500 text-white text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Play className="w-3 h-3 fill-current" />
                                    <span>Play</span>
                                  </button>
                                  <button
                                    type="button"
                                    title={tr('Salvează în Fișiere', 'Save File', 'Сохранить файл')}
                                    onClick={() => void exportOfflineItemToDeviceFile(epItem)}
                                    className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 text-white inline-flex items-center justify-center cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    title={tr('Șterge episodul', 'Delete Episode', 'Удалить серию')}
                                    onClick={async () => {
                                      await deleteOfflineItem(epItem.id);
                                      await refreshOfflineLibrary();
                                    }}
                                    className="h-8 w-8 rounded-lg bg-rose-950/70 hover:bg-rose-900 text-rose-300 inline-flex items-center justify-center cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        /* MAIN DOWNLOADS GRID: 1 SINGLE CARD PER SERIES OR MOVIE */
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                          {groupedList.map((group) => {
                            const firstItem = group.items[0];
                            return (
                              <div
                                key={`dl_group_${group.cleanVodId}`}
                                className="p-2.5 sm:p-3 rounded-2xl bg-[#141923] border border-white/10 hover:border-blue-500/40 flex flex-col justify-between gap-2.5 shadow-lg transition-colors"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (group.isSeries) {
                                      setSelectedOfflineSeriesId(group.cleanVodId);
                                    } else {
                                      handleOpenVod(
                                        {
                                          id: group.cleanVodId,
                                          name: group.title,
                                          type: 'movie',
                                          poster: group.poster,
                                        },
                                        true,
                                        1,
                                        1
                                      );
                                    }
                                  }}
                                  className="group text-left focus:outline-none cursor-pointer"
                                >
                                  <div className="aspect-[2/3] w-full rounded-xl bg-zinc-900 relative overflow-hidden mb-2">
                                    {group.poster ? (
                                      <img
                                        src={group.poster}
                                        alt={group.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                      />
                                    ) : null}
                                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-[#2563eb] text-white text-[10px] font-black uppercase shadow">
                                      {group.isSeries
                                        ? `${group.items.length} EP. • ${group.qualityLabel}`
                                        : group.qualityLabel}
                                    </span>
                                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 text-white text-[10px] font-bold tabular-nums">
                                      {formatBytes(group.totalBytes)}
                                    </span>
                                  </div>
                                  <div className="text-xs sm:text-sm font-bold text-white line-clamp-1">
                                    {group.title}
                                  </div>
                                  <div className="text-[11px] text-blue-300 font-semibold truncate mt-0.5">
                                    {group.isSeries
                                      ? `Sezonul ${firstItem?.season || 1} • ${group.items.length} episoade`
                                      : 'Film salvat offline'}
                                  </div>
                                </button>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (group.isSeries) {
                                        setSelectedOfflineSeriesId(group.cleanVodId);
                                      } else {
                                        handleOpenVod(
                                          {
                                            id: group.cleanVodId,
                                            name: group.title,
                                            type: 'movie',
                                            poster: group.poster,
                                          },
                                          true,
                                          1,
                                          1
                                        );
                                      }
                                    }}
                                    className="flex-1 h-8 rounded-lg bg-[#2563eb] hover:bg-blue-500 text-white text-[11px] font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <Play className="w-3 h-3 fill-current" />
                                    <span>
                                      {group.isSeries
                                        ? `Episoade (${group.items.length})`
                                        : 'Play'}
                                    </span>
                                  </button>

                                  {!group.isSeries && firstItem && (
                                    <button
                                      type="button"
                                      title={tr('Salvează în Fișiere', 'Save File', 'Сохранить файл')}
                                      onClick={() => void exportOfflineItemToDeviceFile(firstItem)}
                                      className="h-8 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold inline-flex items-center justify-center cursor-pointer"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    title={tr('Șterge', 'Delete', 'Удалить')}
                                    onClick={async () => {
                                      for (const it of group.items) {
                                        await deleteOfflineItem(it.id);
                                      }
                                      await refreshOfflineLibrary();
                                    }}
                                    className="h-8 px-2.5 rounded-lg bg-rose-950/70 hover:bg-rose-900 text-rose-300 text-[11px] font-bold inline-flex items-center justify-center cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <SmartTvCatalogSections
                  section={section}
                  platformMediaTab={platformMediaTab}
                  setPlatformMediaTab={setPlatformMediaTab}
                  tr={tr}
                  isVodLoading={isVodLoading}
                  vodItems={vodItems}
                  savedVodItems={savedVodItems}
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
                />
              </>
            )}
          </main>
        </div>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR (Clean 1-tap switching on phones < 768px) */}
      {!isAnyFullModePlayer && (
        <nav
          aria-label="Navigare Mobilă"
          className="md:hidden relative z-30 h-14 px-1 bg-[#0d111a]/95 backdrop-blur-xl border-t border-white/10 flex items-center justify-around shrink-0 select-none"
        >
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
                label: tr('Filme', 'Movies', 'Фильмы'),
                Icon: Clapperboard,
              },
              {
                id: 'series',
                label: tr('Seriale', 'Series', 'Сериалы'),
                Icon: Tv,
              },
              {
                id: 'music',
                label: tr('Muzică', 'Music', 'Музыка'),
                Icon: Music,
              },
            ] as const
          ).map(({ id, label, Icon }) => {
            const isActive = section === id && !activeVodItem && !isSidebarOpen;
            return (
              <button
                key={`mob_nav_${id}`}
                type="button"
                onClick={() => {
                  setActiveVodItem(null);
                  setIsSidebarOpen(false);
                  setIsFilterDrawerOpen(false);
                  setIsCatalogDrawerOpen(false);
                  setSection(id);
                  const mainEl =
                    rootContainerRef.current?.querySelector<HTMLElement>('main');
                  if (mainEl) {
                    mainEl.scrollTop = 0;
                  }
                  if (id === 'tv') {
                    setTvRegionId('FAV');
                    setTvCategoryId('ALL');
                  }
                }}
                className={`flex-1 h-full flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-sky-400 font-extrabold'
                    : 'text-zinc-400 hover:text-zinc-200 font-semibold'
                }`}
              >
                <Icon className="w-5 h-5 stroke-[2]" />
                <span className="text-[10px] leading-none truncate max-w-[60px]">
                  {label}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className={`flex-1 h-full flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
              isSidebarOpen
                ? 'text-sky-400 font-extrabold'
                : 'text-zinc-400 hover:text-zinc-200 font-semibold'
            }`}
          >
            <Menu className="w-5 h-5 stroke-[2]" />
            <span className="text-[10px] leading-none truncate max-w-[60px]">
              {tr('Meniu', 'Menu', 'Меню')}
            </span>
          </button>
        </nav>
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
      />

      {/* Persistent Spotify Music Background Audio Engine */}
      <audio
        ref={musicAudioRef}
        preload="auto"
        onTimeUpdate={(e) => {
          const ct = e.currentTarget.currentTime || 0;
          setMusicElapsedSec(ct);
        }}
        onLoadedMetadata={(e) => {
          const dur = e.currentTarget.duration;
          if (dur && Number.isFinite(dur) && dur > 5) {
            setMusicDurationSec(dur);
          }
        }}
        onPlay={() => setIsMusicPlaying(true)}
        onPause={() => setIsMusicPlaying(false)}
        onEnded={() => {
          if (isMusicRepeat && musicAudioRef.current) {
            musicAudioRef.current.currentTime = 0;
            musicAudioRef.current.play().catch(() => {});
          } else {
            handleNextMusicTrack();
          }
        }}
        onError={(e) => {
          const el = e.currentTarget;
          if (
            currentMusicTrack?.previewUrl &&
            el.src !== currentMusicTrack.previewUrl
          ) {
            el.src = currentMusicTrack.previewUrl;
            el.play().catch(() => {});
          }
        }}
        className="hidden"
      />

      {/* Floating Picture-in-Picture Radio Player (outside the browser page) */}
      <RadioPipPlayer />
    </div>
  );
};
