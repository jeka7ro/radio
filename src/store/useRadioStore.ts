import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  Station,
  TvChannel,
  PlayerStatus,
  NavigationTab,
  LanguageCode,
  ThemeMode,
  NowPlayingTrackMeta,
} from '../types/radio';
import { detectUserCountryCode } from '../services/geoLanguageService';
import { detectInitialLanguage } from '../i18n/translations';
import { DEFAULT_SMART_FAVORITE_TV_CHANNELS } from '../services/tvApi';
import {
  loadSharedProfiles,
  loadSharedActiveProfileId,
  canProfileAccessAdult,
} from '../services/deviceContinuityService';

function detectInitialAdultAccess(): boolean {
  try {
    const profiles = loadSharedProfiles();
    const activeId = loadSharedActiveProfileId();
    const active = profiles.find((p) => p.id === activeId) || profiles[0];
    return canProfileAccessAdult(active);
  } catch {
    return false;
  }
}

export const DEFAULT_SMART_FAVORITE_RADIO_STATIONS: Station[] = [
  {
    stationuuid: 'fav-radio-kissfm-ro',
    name: 'Kiss FM Romania',
    url: 'https://live.kissfm.ro/kissfm.aacp',
    url_resolved: 'https://live.kissfm.ro/kissfm.aacp',
    homepage: 'https://www.kissfm.ro',
    favicon: 'https://www.kissfm.ro/apple-touch-icon.png',
    tags: 'pop,dance,top 40,hits',
    country: 'Romania',
    countrycode: 'RO',
    language: 'romanian',
    votes: 12500,
    codec: 'AAC+',
    bitrate: 128,
    hls: 0,
    clickcount: 9800,
  },
  {
    stationuuid: 'fav-radio-zu-ro',
    name: 'Radio ZU',
    url: 'https://live4ro.antenaplay.ro/radiozu/radiozu-48000.m3u8',
    url_resolved: 'https://live4ro.antenaplay.ro/radiozu/radiozu-48000.m3u8',
    homepage: 'https://radiozu.ro',
    favicon: 'https://radiozu.ro/favicon-96x96.png',
    tags: 'pop,hits,romania,top 40',
    country: 'Romania',
    countrycode: 'RO',
    language: 'romanian',
    votes: 11200,
    codec: 'AAC',
    bitrate: 128,
    hls: 1,
    clickcount: 9100,
  },
  {
    stationuuid: 'fav-radio-europafm-ro',
    name: 'Europa FM',
    url: 'https://astreaming.edi.ro:8443/EuropaFM_aac',
    url_resolved: 'https://astreaming.edi.ro:8443/EuropaFM_aac',
    homepage: 'https://www.europafm.ro',
    favicon: 'https://www.europafm.ro/icons/apple-touch-icon.png',
    tags: 'pop,rock,news,adult contemporary',
    country: 'Romania',
    countrycode: 'RO',
    language: 'romanian',
    votes: 10400,
    codec: 'AAC',
    bitrate: 128,
    hls: 0,
    clickcount: 8500,
  },
  {
    stationuuid: 'fav-radio-magicfm-ro',
    name: 'Magic FM',
    url: 'https://live.magicfm.ro/magicfm.aacp',
    url_resolved: 'https://live.magicfm.ro/magicfm.aacp',
    homepage: 'https://www.magicfm.ro',
    favicon: 'https://www.magicfm.ro/apple-touch-icon.png',
    tags: 'soft pop,oldies,80s,90s,love songs',
    country: 'Romania',
    countrycode: 'RO',
    language: 'romanian',
    votes: 9400,
    codec: 'AAC+',
    bitrate: 128,
    hls: 0,
    clickcount: 7800,
  },
  {
    stationuuid: 'fav-radio-digifm-ro',
    name: 'Digi FM',
    url: 'https://edge76.rcs-rds.ro/digifm/digifm.mp3',
    url_resolved: 'https://edge76.rcs-rds.ro/digifm/digifm.mp3',
    homepage: 'https://www.digi-fm.ro',
    favicon: 'https://www.digi-fm.ro/static/theme-repo/apple-touch-icon.png',
    tags: 'news,pop,hits,romania',
    country: 'Romania',
    countrycode: 'RO',
    language: 'romanian',
    votes: 8800,
    codec: 'MP3',
    bitrate: 128,
    hls: 0,
    clickcount: 7200,
  },
  {
    stationuuid: 'fav-radio-virgin-ro',
    name: 'Virgin Radio Romania',
    url: 'https://astreaming.edi.ro:8443/VirginRadio_aac',
    url_resolved: 'https://astreaming.edi.ro:8443/VirginRadio_aac',
    homepage: 'https://virginradio.ro',
    favicon: 'https://virginradio.ro/icons/apple-touch-icon.png',
    tags: 'pop,dance,hip-hop,top 40',
    country: 'Romania',
    countrycode: 'RO',
    language: 'romanian',
    votes: 8200,
    codec: 'AAC',
    bitrate: 128,
    hls: 0,
    clickcount: 6800,
  },
  {
    stationuuid: 'fav-radio-profm-ro',
    name: 'ProFM',
    url: 'https://edge126.rcs-rds.ro/profm/profm.mp3',
    url_resolved: 'https://edge126.rcs-rds.ro/profm/profm.mp3',
    homepage: 'https://www.profm.ro',
    favicon: 'https://www.profm.ro/static/theme-repo/apple-touch-icon.png',
    tags: 'pop,dance,hits',
    country: 'Romania',
    countrycode: 'RO',
    language: 'romanian',
    votes: 7900,
    codec: 'MP3',
    bitrate: 128,
    hls: 0,
    clickcount: 6400,
  },
  {
    stationuuid: 'fav-radio-rockfm-ro',
    name: 'Rock FM',
    url: 'https://live.rockfm.ro/rockfm.aacp',
    url_resolved: 'https://live.rockfm.ro/rockfm.aacp',
    homepage: 'https://www.rockfm.ro',
    favicon: 'https://www.rockfm.ro/apple-touch-icon.png',
    tags: 'rock,classic rock,hard rock',
    country: 'Romania',
    countrycode: 'RO',
    language: 'romanian',
    votes: 7600,
    codec: 'AAC+',
    bitrate: 128,
    hls: 0,
    clickcount: 6100,
  },
  {
    stationuuid: 'fav-radio-rmc-it',
    name: 'Radio Monte Carlo',
    url: 'https://icy.unitedradio.it/RMC.mp3',
    url_resolved: 'https://icy.unitedradio.it/RMC.mp3',
    homepage: 'https://www.radiomontecarlo.net',
    favicon: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly9yYWRpbzMub21ueXMuY29tL3dwLWNvbnRlbnQvdXBsb2Fkcy8yMDI1LzA2L2RlZmF1bHQtMS5qcGc/-/0/0?r=91587740ec678bd2765cf54837744f04',
    tags: 'lounge,pop,jazz,chillout,monte carlo',
    country: 'Italy',
    countrycode: 'IT',
    language: 'italian',
    votes: 9200,
    codec: 'MP3',
    bitrate: 128,
    hls: 0,
    clickcount: 7400,
  },
  {
    stationuuid: '96253329-0601-11e8-ae97-52543be04c81',
    name: 'RMC Hits',
    url: 'https://icy.unitedradio.it/rmcweb001',
    url_resolved: 'https://icy.unitedradio.it/rmcweb001',
    homepage: 'https://www.radiomontecarlo.net',
    favicon: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfSElUU19XZWJSYWRpby0xNjAxNTI4MjA4MzE4LTMuanBnLXJtY19oaXRzLTMuanBn/-/0/0?r=e03719966665665d902cd409e6162b62',
    tags: 'pop,hits,top 40,monte carlo,rmc',
    country: 'Italy',
    countrycode: 'IT',
    language: 'italian',
    votes: 9350,
    codec: 'MP3',
    bitrate: 128,
    hls: 0,
    clickcount: 7600,
  },
  {
    stationuuid: 'fav-radio-europaplus-ru',
    name: 'Европа Плюс (Europa Plus)',
    url: 'https://ep256.hostingradio.ru:8052/europaplus256.mp3',
    url_resolved: 'https://ep256.hostingradio.ru:8052/europaplus256.mp3',
    homepage: 'https://europaplus.ru',
    favicon: 'https://top-radio.ru/assets/image/radio/180/europa-plus.png',
    tags: 'pop,dance,hits,top 40',
    country: 'Russia',
    countrycode: 'RU',
    language: 'russian',
    votes: 9500,
    codec: 'MP3',
    bitrate: 256,
    hls: 0,
    clickcount: 7900,
  },
];

export const RMC_HITS_STATION: Station = {
  stationuuid: '96253329-0601-11e8-ae97-52543be04c81',
  name: 'RMC Hits',
  url: 'https://icy.unitedradio.it/rmcweb001',
  url_resolved: 'https://icy.unitedradio.it/rmcweb001',
  homepage: 'https://www.radiomontecarlo.net',
  favicon:
    'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfSElUU19XZWJSYWRpby0xNjAxNTI4MjA4MzE4LTMuanBnLXJtY19oaXRzLTMuanBn/-/0/0?r=e03719966665665d902cd409e6162b62',
  tags: 'pop,hits,top 40,monte carlo,rmc',
  country: 'Italy',
  countrycode: 'IT',
  language: 'italian',
  votes: 9350,
  codec: 'MP3',
  bitrate: 128,
  hls: 0,
  clickcount: 7600,
};

export function normalizeRadioStreamKey(rawUrl?: string): string {
  if (!rawUrl) return '';
  return rawUrl
    .trim()
    .toLowerCase()
    .replace(/^http:\/\/edge\.radiomontecarlo\.net\//i, 'https://icy.unitedradio.it/')
    .replace(/\/\/live7digi\.antenaplay\.ro\//gi, '//live4ro.antenaplay.ro/')
    .replace(/^http:\/\//i, 'https://')
    .replace(/\?listening-from-radio-garden=.*$/i, '')
    .replace(/\/+$/, '');
}

export function isSameRadioStation(
  a?: Station | null,
  b?: Station | null
): boolean {
  if (!a || !b) return false;
  if (a.stationuuid && b.stationuuid && a.stationuuid === b.stationuuid) {
    return true;
  }
  const urlA = normalizeRadioStreamKey(a.url_resolved || a.url);
  const urlB = normalizeRadioStreamKey(b.url_resolved || b.url);
  return Boolean(urlA && urlB && urlA === urlB);
}

function migrateRadioStationEntry(st: Station): Station {
  const fixUrl = (u?: string) =>
    (u || '')
      .replace(/^http:\/\/edge\.radiomontecarlo\.net\//i, 'https://icy.unitedradio.it/')
      .replace(/\/\/live7digi\.antenaplay\.ro\//gi, '//live4ro.antenaplay.ro/');
  const nextUrl = fixUrl(st.url);
  const nextResolved = fixUrl(st.url_resolved || st.url);
  const isRmcHits =
    /\brmc\s*hits\b/i.test(st.name || '') ||
    /\/rmcweb001\b/i.test(nextResolved);
  return {
    ...st,
    url: nextUrl,
    url_resolved: nextResolved,
    favicon: isRmcHits && !st.favicon ? RMC_HITS_STATION.favicon : st.favicon,
  };
}

interface StoredProfileRadioFavs {
  updatedAt: number;
  stations: Station[];
}

function getProfileRadioFavsStorageKey(profileId: string): string {
  const cleanId = (profileId || 'p1').replace(/[^a-zA-Z0-9_-]/g, '') || 'p1';
  return `aether_radio_favorites_v2_${cleanId}`;
}

function evictNonEssentialLocalStorageCaches(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith('aether_cache_') ||
          k.startsWith('radio_cache_') ||
          k.startsWith('aether_epg_') ||
          k.includes('global_search_'))
      ) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}

function readProfileRadioFavsFromLocalStorage(
  profileId: string
): StoredProfileRadioFavs | null {
  try {
    const raw = localStorage.getItem(getProfileRadioFavsStorageKey(profileId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.stations)) {
      return {
        updatedAt: Number(parsed.updatedAt) || 0,
        stations: parsed.stations.map(migrateRadioStationEntry),
      };
    }
  } catch {
    // ignore
  }
  return null;
}

function writeProfileRadioFavsToLocalStorage(
  profileId: string,
  payload: StoredProfileRadioFavs
): void {
  const key = getProfileRadioFavsStorageKey(profileId);
  const serialized = JSON.stringify({
    updatedAt: payload.updatedAt,
    stations: payload.stations.map(migrateRadioStationEntry),
  });
  try {
    localStorage.setItem(key, serialized);
  } catch {
    evictNonEssentialLocalStorageCaches();
    try {
      localStorage.setItem(key, serialized);
    } catch {
      // ignore
    }
  }
}

function pushProfileRadioFavsToRemote(
  profileId: string,
  payload: StoredProfileRadioFavs
): void {
  if (typeof window === 'undefined') return;
  const cleanProf = encodeURIComponent(
    (profileId || 'p1').replace(/[^a-zA-Z0-9_-]/g, '') || 'p1'
  );
  const body = JSON.stringify(payload);
  fetch(`/api/tv-radio-favorites?profileId=${cleanProf}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => {});
  const isLanNonDevPort =
    /^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
      window.location.hostname
    ) && window.location.port !== '8769';
  if (isLanNonDevPort) {
    fetch(`https://filmio.my/api/tv-radio-favorites?profileId=${cleanProf}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => {});
  }
}

interface RadioState {
  // Persisted state
  selectedCountryCode: string;
  favorites: Station[];
  recentlyPlayed: Station[];
  favoriteTvChannels: TvChannel[];
  recentTvChannels: TvChannel[];
  customTvChannels: TvChannel[];
  radioSearchQuery: string;
  tvSearchQuery: string;
  recentRadioSearches: string[];
  recentTvSearches: string[];
  favoritesSubTab: 'radio' | 'tv';
  volume: number;
  isMuted: boolean;
  language: LanguageCode;
  theme: ThemeMode;
  adultContentEnabled: boolean;

  // UI & Navigation state
  activeTab: NavigationTab;
  lastMediaTab: 'home' | 'tv';
  isExpandedPlayerOpen: boolean;
  isRadioPipOpen: boolean;
  isCountryModalOpen: boolean;

  // Player state
  currentStation: Station | null;
  stationQueue: Station[];
  playerStatus: PlayerStatus;
  retryAttempt: number;
  nowPlayingTitle: string | null;
  nowPlayingMeta: NowPlayingTrackMeta | null;
  usingHttpsUpgrade: boolean;
  streamReloadToken: number;

  // TV Player state
  currentTvChannel: TvChannel | null;
  tvQueue: TvChannel[];

  // Actions
  setSelectedCountryCode: (code: string) => void;
  setActiveTab: (tab: NavigationTab) => void;
  setExpandedPlayerOpen: (open: boolean) => void;
  setRadioPipOpen: (open: boolean) => void;
  setCountryModalOpen: (open: boolean) => void;

  // Player actions
  playStation: (station: Station, queue?: Station[]) => void;
  stopRadio: () => void;
  setStationQueue: (queue: Station[]) => void;
  setPlayerStatus: (status: PlayerStatus) => void;
  setRetryAttempt: (attempt: number) => void;
  setNowPlayingTitle: (title: string | null) => void;
  setNowPlayingMeta: (meta: NowPlayingTrackMeta | null) => void;
  setUsingHttpsUpgrade: (useHttps: boolean) => void;
  triggerStreamReload: (forceHttps?: boolean) => void;
  playNextAvailableStation: () => void;
  playPreviousStation: () => void;

  // TV actions
  playTvChannel: (channel: TvChannel, queue?: TvChannel[]) => void;
  closeTvPlayer: () => void;
  playNextTvChannel: () => void;
  playPreviousTvChannel: () => void;
  toggleFavoriteTvChannel: (channel: TvChannel) => void;
  moveFavoriteTvChannel: (fromIndex: number, toIndex: number) => void;
  importFavoriteTvChannels: (channels: TvChannel[]) => number;
  clearRecentTvChannels: () => void;
  importCustomTvChannels: (channels: TvChannel[]) => number;
  clearCustomTvChannels: () => void;

  // Search memory actions
  setRadioSearchQuery: (q: string) => void;
  setTvSearchQuery: (q: string) => void;
  addRecentRadioSearch: (q: string) => void;
  removeRecentRadioSearch: (q: string) => void;
  clearRecentRadioSearches: () => void;
  addRecentTvSearch: (q: string) => void;
  removeRecentTvSearch: (q: string) => void;
  clearRecentTvSearches: () => void;
  setFavoritesSubTab: (tab: 'radio' | 'tv') => void;

  // Volume actions
  setVolume: (volume: number) => void;
  toggleMute: () => void;

  // Favorites actions
  toggleFavorite: (station: Station) => void;
  moveFavorite: (fromIndex: number, toIndex: number) => void;
  importFavorites: (stations: Station[]) => number;
  switchRadioFavoritesProfile: (profileId: string) => void;
  syncRadioFavoritesWithServer: (profileId?: string) => Promise<void>;

  // Recently played actions
  addRecentlyPlayed: (station: Station) => void;
  clearRecentlyPlayed: () => void;

  // Preferences actions
  setLanguage: (lang: LanguageCode) => void;
  setTheme: (theme: ThemeMode) => void;
  setAdultContentEnabled: (enabled: boolean) => void;
}

export const useRadioStore = create<RadioState>()(
  persist(
    (set, get) => ({
      selectedCountryCode: detectUserCountryCode(),
      favorites: DEFAULT_SMART_FAVORITE_RADIO_STATIONS,
      recentlyPlayed: [],
      favoriteTvChannels: DEFAULT_SMART_FAVORITE_TV_CHANNELS,
      recentTvChannels: [],
      customTvChannels: [],
      radioSearchQuery: '',
      tvSearchQuery: '',
      recentRadioSearches: [],
      recentTvSearches: [],
      favoritesSubTab: 'radio',
      volume: 0.8,
      isMuted: false,
      language: detectInitialLanguage(),
      theme: 'system',
      adultContentEnabled: detectInitialAdultAccess(),

      activeTab: 'home',
      lastMediaTab: 'home',
      isExpandedPlayerOpen: false,
      isRadioPipOpen: false,
      isCountryModalOpen: false,

      currentStation: null,
      stationQueue: [],
      playerStatus: 'idle',
      retryAttempt: 0,
      nowPlayingTitle: null,
      nowPlayingMeta: null,
      usingHttpsUpgrade: false,
      streamReloadToken: 0,

      currentTvChannel: null,
      tvQueue: [],

      setSelectedCountryCode: (code) =>
        set({ selectedCountryCode: code.toUpperCase() }),

      setActiveTab: (tab) =>
        set((state) => ({
          activeTab: tab,
          lastMediaTab:
            tab === 'home' || tab === 'tv' ? tab : state.lastMediaTab,
          favoritesSubTab:
            tab === 'favorites'
              ? state.activeTab === 'tv'
                ? 'tv'
                : state.activeTab === 'home'
                  ? 'radio'
                  : state.favoritesSubTab
              : state.favoritesSubTab,
        })),

      setExpandedPlayerOpen: (open) => set({ isExpandedPlayerOpen: open }),

      setRadioPipOpen: (open) => set({ isRadioPipOpen: open }),

      setCountryModalOpen: (open) => set({ isCountryModalOpen: open }),

      playStation: (station, queue) => {
        const current = get().currentStation;
        const currentStatus = get().playerStatus;
        const activeSearch = get().radioSearchQuery.trim();
        if (activeSearch.length >= 2) {
          get().addRecentRadioSearch(activeSearch);
        }

        if (queue && queue.length > 0) {
          set({ stationQueue: queue });
        }

        // If same station is clicked while playing, pause it; if paused/error, resume/reload
        if (current && current.stationuuid === station.stationuuid) {
          if (currentStatus === 'playing' || currentStatus === 'loading') {
            set({ playerStatus: 'paused' });
            return;
          }
          set((state) => ({
            currentTvChannel: null,
            playerStatus: 'loading',
            retryAttempt: 0,
            streamReloadToken: state.streamReloadToken + 1,
          }));
          get().addRecentlyPlayed(station);
          return;
        }

        set((state) => ({
          currentStation: station,
          currentTvChannel: null,
          playerStatus: 'loading',
          retryAttempt: 0,
          nowPlayingTitle: null,
          nowPlayingMeta: null,
          usingHttpsUpgrade: false,
          streamReloadToken: state.streamReloadToken + 1,
        }));

        get().addRecentlyPlayed(station);
      },

      stopRadio: () =>
        set({
          currentStation: null,
          playerStatus: 'idle',
          nowPlayingTitle: null,
          nowPlayingMeta: null,
          isExpandedPlayerOpen: false,
        }),

      setStationQueue: (queue) => set({ stationQueue: queue }),

      setPlayerStatus: (status) => set({ playerStatus: status }),

      setRetryAttempt: (attempt) => set({ retryAttempt: attempt }),

      setNowPlayingTitle: (title) => set({ nowPlayingTitle: title }),

      setNowPlayingMeta: (meta) => set({ nowPlayingMeta: meta }),

      setUsingHttpsUpgrade: (useHttps) => set({ usingHttpsUpgrade: useHttps }),

      triggerStreamReload: (forceHttps) =>
        set((state) => ({
          currentTvChannel: null,
          playerStatus: 'loading',
          retryAttempt: 0,
          usingHttpsUpgrade: forceHttps ?? state.usingHttpsUpgrade,
          streamReloadToken: state.streamReloadToken + 1,
        })),

      playNextAvailableStation: () => {
        const { currentStation, stationQueue, favorites, recentlyPlayed } = get();
        const pool =
          stationQueue.length > 0
            ? stationQueue
            : favorites.length > 0
              ? favorites
              : recentlyPlayed;

        if (pool.length === 0) return;

        if (!currentStation) {
          get().playStation(pool[0], pool);
          return;
        }

        const currentIndex = pool.findIndex(
          (s) => s.stationuuid === currentStation.stationuuid
        );
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % pool.length : 0;
        const nextStation = pool[nextIndex];
        if (nextStation) {
          set((state) => ({
            currentStation: nextStation,
            currentTvChannel: null,
            playerStatus: 'loading',
            retryAttempt: 0,
            nowPlayingTitle: null,
            nowPlayingMeta: null,
            usingHttpsUpgrade: false,
            streamReloadToken: state.streamReloadToken + 1,
          }));
          get().addRecentlyPlayed(nextStation);
        }
      },

      playPreviousStation: () => {
        const { currentStation, stationQueue, favorites, recentlyPlayed } = get();
        const pool =
          stationQueue.length > 0
            ? stationQueue
            : favorites.length > 0
              ? favorites
              : recentlyPlayed;

        if (pool.length === 0) return;

        if (!currentStation) {
          get().playStation(pool[0], pool);
          return;
        }

        const currentIndex = pool.findIndex(
          (s) => s.stationuuid === currentStation.stationuuid
        );
        const prevIndex =
          currentIndex > 0 ? currentIndex - 1 : pool.length - 1;
        const prevStation = pool[prevIndex];
        if (prevStation) {
          set((state) => ({
            currentStation: prevStation,
            currentTvChannel: null,
            playerStatus: 'loading',
            retryAttempt: 0,
            nowPlayingTitle: null,
            nowPlayingMeta: null,
            usingHttpsUpgrade: false,
            streamReloadToken: state.streamReloadToken + 1,
          }));
          get().addRecentlyPlayed(prevStation);
        }
      },

      playTvChannel: (channel, queue) => {
        const activeSearch = get().tvSearchQuery.trim();
        if (activeSearch.length >= 2) {
          get().addRecentTvSearch(activeSearch);
        }
        if (queue && queue.length > 0) {
          set({ tvQueue: queue });
        }
        set((state) => {
          const filteredRecent = state.recentTvChannels.filter(
            (c) => c.id !== channel.id
          );
          return {
            currentTvChannel: channel,
            recentTvChannels: [channel, ...filteredRecent].slice(0, 20),
            currentStation: null,
            playerStatus: 'idle',
            nowPlayingTitle: null,
            nowPlayingMeta: null,
            isExpandedPlayerOpen: false,
          };
        });
      },

      closeTvPlayer: () => set({ currentTvChannel: null }),

      playNextTvChannel: () => {
        const { currentTvChannel, tvQueue, favoriteTvChannels, recentTvChannels } =
          get();
        const pool =
          tvQueue.length > 0
            ? tvQueue
            : favoriteTvChannels.length > 0
              ? favoriteTvChannels
              : recentTvChannels;
        if (pool.length === 0) return;

        if (!currentTvChannel) {
          get().playTvChannel(pool[0], pool);
          return;
        }

        const currentIndex = pool.findIndex((c) => c.id === currentTvChannel.id);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % pool.length : 0;
        const nextChannel = pool[nextIndex];
        if (nextChannel) {
          get().playTvChannel(nextChannel);
        }
      },

      playPreviousTvChannel: () => {
        const { currentTvChannel, tvQueue, favoriteTvChannels, recentTvChannels } =
          get();
        const pool =
          tvQueue.length > 0
            ? tvQueue
            : favoriteTvChannels.length > 0
              ? favoriteTvChannels
              : recentTvChannels;
        if (pool.length === 0) return;

        if (!currentTvChannel) {
          get().playTvChannel(pool[0], pool);
          return;
        }

        const currentIndex = pool.findIndex((c) => c.id === currentTvChannel.id);
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : pool.length - 1;
        const prevChannel = pool[prevIndex];
        if (prevChannel) {
          get().playTvChannel(prevChannel);
        }
      },

      toggleFavoriteTvChannel: (channel) =>
        set((state) => {
          const exists = state.favoriteTvChannels.some(
            (c) => c.id === channel.id
          );
          if (exists) {
            return {
              favoriteTvChannels: state.favoriteTvChannels.filter(
                (c) => c.id !== channel.id
              ),
            };
          }
          return {
            favoriteTvChannels: [channel, ...state.favoriteTvChannels],
          };
        }),

      clearRecentTvChannels: () => set({ recentTvChannels: [] }),

      moveFavoriteTvChannel: (fromIndex, toIndex) =>
        set((state) => {
          if (
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= state.favoriteTvChannels.length ||
            toIndex >= state.favoriteTvChannels.length ||
            fromIndex === toIndex
          ) {
            return state;
          }
          const updated = [...state.favoriteTvChannels];
          const [moved] = updated.splice(fromIndex, 1);
          updated.splice(toIndex, 0, moved);
          return { favoriteTvChannels: updated };
        }),

      importFavoriteTvChannels: (channels) => {
        if (!Array.isArray(channels)) return 0;
        const valid = channels.filter(
          (c): c is TvChannel =>
            Boolean(c && typeof c === 'object' && typeof c.name === 'string' && typeof c.url === 'string')
        );
        if (valid.length === 0) return 0;
        set((state) => {
          const map = new Map(state.favoriteTvChannels.map((c) => [c.id || c.url, c]));
          for (const ch of valid) {
            const key = ch.id || `${ch.name}_${ch.url}`;
            map.set(key, {
              ...ch,
              id: key,
              group: ch.group || 'General',
              countryCode: ch.countryCode || 'TV',
              resolution: ch.resolution || 'HD',
              resolutionHeight: Number(ch.resolutionHeight) || 1080,
            });
          }
          return { favoriteTvChannels: Array.from(map.values()) };
        });
        return valid.length;
      },

      setRadioSearchQuery: (q) => set({ radioSearchQuery: q }),

      setTvSearchQuery: (q) => set({ tvSearchQuery: q }),

      addRecentRadioSearch: (q) =>
        set((state) => {
          const trimmed = q.trim();
          if (trimmed.length < 2) return state;
          const lower = trimmed.toLowerCase();
          // Remove exact duplicates AND shorter partial prefixes (e.g. "Mon", "Monte" when "Monte carlo" is added)
          const combined = [trimmed, ...state.recentRadioSearches];
          const deduped: string[] = [];
          for (const item of combined) {
            const itemLower = item.trim().toLowerCase();
            if (itemLower.length < 2) continue;
            const isRedundant = deduped.some((kept) => {
              const keptLower = kept.toLowerCase();
              return (
                keptLower === itemLower ||
                keptLower.startsWith(itemLower) ||
                (itemLower.startsWith(keptLower) && itemLower === lower)
              );
            });
            if (!isRedundant) {
              deduped.push(item.trim());
            }
          }
          return {
            recentRadioSearches: deduped.slice(0, 8),
          };
        }),

      removeRecentRadioSearch: (q) =>
        set((state) => ({
          recentRadioSearches: state.recentRadioSearches.filter(
            (item) => item !== q
          ),
        })),

      clearRecentRadioSearches: () => set({ recentRadioSearches: [] }),

      addRecentTvSearch: (q) =>
        set((state) => {
          const trimmed = q.trim();
          if (trimmed.length < 2) return state;
          const lower = trimmed.toLowerCase();
          const combined = [trimmed, ...state.recentTvSearches];
          const deduped: string[] = [];
          for (const item of combined) {
            const itemLower = item.trim().toLowerCase();
            if (itemLower.length < 2) continue;
            const isRedundant = deduped.some((kept) => {
              const keptLower = kept.toLowerCase();
              return (
                keptLower === itemLower ||
                keptLower.startsWith(itemLower) ||
                (itemLower.startsWith(keptLower) && itemLower === lower)
              );
            });
            if (!isRedundant) {
              deduped.push(item.trim());
            }
          }
          return {
            recentTvSearches: deduped.slice(0, 8),
          };
        }),

      removeRecentTvSearch: (q) =>
        set((state) => ({
          recentTvSearches: state.recentTvSearches.filter((item) => item !== q),
        })),

      clearRecentTvSearches: () => set({ recentTvSearches: [] }),

      setFavoritesSubTab: (tab) => set({ favoritesSubTab: tab }),

      importCustomTvChannels: (channels) => {
        if (!Array.isArray(channels) || channels.length === 0) return 0;
        set((state) => {
          const map = new Map(state.customTvChannels.map((c) => [c.url, c]));
          for (const ch of channels) {
            if (ch && ch.url && ch.name) {
              map.set(ch.url, ch);
            }
          }
          return { customTvChannels: Array.from(map.values()).slice(0, 5000) };
        });
        return channels.length;
      },

      clearCustomTvChannels: () => set({ customTvChannels: [] }),

      setVolume: (val) => {
        const clamped = Math.max(0, Math.min(1, val));
        set({ volume: clamped, isMuted: clamped === 0 });
      },

      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

      toggleFavorite: (station) =>
        set((state) => {
          const cleanIncoming = migrateRadioStationEntry({
            ...station,
            url_resolved: station.url_resolved || station.url,
          });
          const exists = state.favorites.some((s) =>
            isSameRadioStation(s, cleanIncoming)
          );
          const next = exists
            ? state.favorites.filter((s) => !isSameRadioStation(s, cleanIncoming))
            : [cleanIncoming, ...state.favorites];
          const activeId = loadSharedActiveProfileId() || 'p1';
          const payload: StoredProfileRadioFavs = {
            updatedAt: Date.now(),
            stations: next,
          };
          writeProfileRadioFavsToLocalStorage(activeId, payload);
          pushProfileRadioFavsToRemote(activeId, payload);
          return { favorites: next };
        }),

      moveFavorite: (fromIndex, toIndex) =>
        set((state) => {
          if (
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= state.favorites.length ||
            toIndex >= state.favorites.length ||
            fromIndex === toIndex
          ) {
            return state;
          }
          const updated = [...state.favorites];
          const [moved] = updated.splice(fromIndex, 1);
          updated.splice(toIndex, 0, moved);
          const activeId = loadSharedActiveProfileId() || 'p1';
          const payload: StoredProfileRadioFavs = {
            updatedAt: Date.now(),
            stations: updated,
          };
          writeProfileRadioFavsToLocalStorage(activeId, payload);
          pushProfileRadioFavsToRemote(activeId, payload);
          return { favorites: updated };
        }),

      importFavorites: (stations) => {
        if (!Array.isArray(stations)) return 0;
        const validStations = stations.filter(
          (item): item is Station =>
            Boolean(
              item &&
                typeof item === 'object' &&
                typeof item.stationuuid === 'string' &&
                typeof item.name === 'string' &&
                (typeof item.url_resolved === 'string' || typeof item.url === 'string')
            )
        );

        if (validStations.length === 0) return 0;

        set((state) => {
          const mergedList = [...state.favorites];
          for (const st of validStations) {
            const normalized = migrateRadioStationEntry({
              ...st,
              url_resolved: st.url_resolved || st.url,
              votes: Number(st.votes) || 0,
              bitrate: Number(st.bitrate) || 0,
              hls: Number(st.hls) || 0,
              clickcount: Number(st.clickcount) || 0,
            });
            const idx = mergedList.findIndex((x) =>
              isSameRadioStation(x, normalized)
            );
            if (idx >= 0) {
              mergedList[idx] = normalized;
            } else {
              mergedList.push(normalized);
            }
          }
          const activeId = loadSharedActiveProfileId() || 'p1';
          const payload: StoredProfileRadioFavs = {
            updatedAt: Date.now(),
            stations: mergedList,
          };
          writeProfileRadioFavsToLocalStorage(activeId, payload);
          pushProfileRadioFavsToRemote(activeId, payload);
          return { favorites: mergedList };
        });

        return validStations.length;
      },

      switchRadioFavoritesProfile: (profileId) => {
        const cleanId =
          (profileId || 'p1').replace(/[^a-zA-Z0-9_-]/g, '') || 'p1';
        const stored = readProfileRadioFavsFromLocalStorage(cleanId);
        if (stored) {
          set({ favorites: stored.stations });
        } else {
          const initialStations = [...DEFAULT_SMART_FAVORITE_RADIO_STATIONS];
          const initPayload: StoredProfileRadioFavs = {
            updatedAt: 1000,
            stations: initialStations,
          };
          writeProfileRadioFavsToLocalStorage(cleanId, initPayload);
          set({ favorites: initialStations });
        }
        void get().syncRadioFavoritesWithServer(cleanId);
      },

      syncRadioFavoritesWithServer: async (explicitProfileId) => {
        if (typeof window === 'undefined') return;
        const cleanId =
          (explicitProfileId || loadSharedActiveProfileId() || 'p1').replace(
            /[^a-zA-Z0-9_-]/g,
            ''
          ) || 'p1';
        const localPayload = readProfileRadioFavsFromLocalStorage(cleanId) || {
          updatedAt: 1000,
          stations: get().favorites.map(migrateRadioStationEntry),
        };
        try {
          const res = await fetch(
            `/api/tv-radio-favorites?profileId=${encodeURIComponent(cleanId)}`
          );
          if (!res.ok) return;
          const remote = (await res.json()) as {
            updatedAt?: number;
            stations?: Station[];
          } | null;
          const remoteTs = Number(remote?.updatedAt) || 0;
          const remoteStations = Array.isArray(remote?.stations)
            ? remote!.stations.map(migrateRadioStationEntry)
            : [];

          if (remoteTs > localPayload.updatedAt && Array.isArray(remote?.stations)) {
            const nextPayload: StoredProfileRadioFavs = {
              updatedAt: remoteTs,
              stations: remoteStations,
            };
            writeProfileRadioFavsToLocalStorage(cleanId, nextPayload);
            const currentActive =
              (loadSharedActiveProfileId() || 'p1').replace(
                /[^a-zA-Z0-9_-]/g,
                ''
              ) || 'p1';
            if (currentActive === cleanId) {
              set({ favorites: remoteStations });
            }
          } else if (
            localPayload.updatedAt > remoteTs &&
            localPayload.stations.length > 0
          ) {
            pushProfileRadioFavsToRemote(cleanId, localPayload);
          }
        } catch {
          // ignore network errors
        }
      },

      addRecentlyPlayed: (station) =>
        set((state) => {
          const filtered = state.recentlyPlayed.filter(
            (s) => !isSameRadioStation(s, station)
          );
          return {
            recentlyPlayed: [
              migrateRadioStationEntry(station),
              ...filtered,
            ].slice(0, 20),
          };
        }),

      clearRecentlyPlayed: () => set({ recentlyPlayed: [] }),

      setLanguage: (lang) => set({ language: lang }),

      setTheme: (theme) => set({ theme }),

      setAdultContentEnabled: (enabled) =>
        set({ adultContentEnabled: enabled }),
    }),
    {
      name: 'aether-radio-storage',
      storage: createJSONStorage(() => {
        const memoryFallback = new Map<string, string>();
        return {
          getItem: (name) => {
            try {
              return localStorage.getItem(name) ?? memoryFallback.get(name) ?? null;
            } catch {
              return memoryFallback.get(name) ?? null;
            }
          },
          setItem: (name, value) => {
            memoryFallback.set(name, value);
            try {
              localStorage.setItem(name, value);
            } catch {
              // Evict caches & progressively shrink customTvChannels so localStorage quota NEVER drops Radio favorites!
              evictNonEssentialLocalStorageCaches();
              try {
                localStorage.setItem(name, value);
                return;
              } catch {
                // continue to progressive trim
              }
              try {
                const parsed = JSON.parse(value);
                if (parsed?.state) {
                  const allCustom: TvChannel[] = Array.isArray(
                    parsed.state.customTvChannels
                  )
                    ? parsed.state.customTvChannels
                    : [];
                  const adultChannels = allCustom.filter((c) =>
                    /(?:взросл|для взрослых|эротик|шалун|русская ночь|brazzers|hustler|redlight|dorcel|penthouse|playboy|xxx|adult|18\+)/i.test(
                      `${c.group || ''} ${c.name || ''}`
                    )
                  );
                  const otherChannels = allCustom.filter(
                    (c) => !adultChannels.includes(c)
                  );
                  for (const cap of [400, 120, 0]) {
                    try {
                      parsed.state.customTvChannels =
                        cap > 0
                          ? [
                              ...otherChannels.slice(0, cap),
                              ...adultChannels.slice(0, 80),
                            ]
                          : [];
                      localStorage.setItem(name, JSON.stringify(parsed));
                      break;
                    } catch {
                      // try smaller cap
                    }
                  }
                }
              } catch {
                // ignore
              }
            }
          },
          removeItem: (name) => {
            memoryFallback.delete(name);
            try {
              localStorage.removeItem(name);
            } catch {
              // ignore
            }
          },
        };
      }),
      partialize: (state) => ({
        selectedCountryCode: state.selectedCountryCode,
        activeTab: state.activeTab,
        lastMediaTab: state.lastMediaTab,
        favorites: state.favorites,
        recentlyPlayed: state.recentlyPlayed,
        favoriteTvChannels: state.favoriteTvChannels,
        recentTvChannels: state.recentTvChannels,
        customTvChannels: state.customTvChannels,
        radioSearchQuery: state.radioSearchQuery,
        tvSearchQuery: state.tvSearchQuery,
        recentRadioSearches: state.recentRadioSearches,
        recentTvSearches: state.recentTvSearches,
        favoritesSubTab: state.favoritesSubTab,
        volume: state.volume,
        isMuted: state.isMuted,
        language: state.language,
        theme: state.theme,
        adultContentEnabled: state.adultContentEnabled,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<RadioState>) || {};
        const merged = {
          ...currentState,
          ...persisted,
          adultContentEnabled: detectInitialAdultAccess(),
        };
        const existingFavs = (
          Array.isArray(persisted.favoriteTvChannels)
            ? persisted.favoriteTvChannels
            : []
        ).map((ch) =>
          /пятница/i.test(ch.name) &&
          /\/(2006|9207|503|5031)\/index\.m3u8/i.test(ch.url)
            ? {
                ...ch,
                id: 'Пятница! HD_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/5031/index.m3u8',
                name: 'Пятница! HD',
                group: 'HD',
                url: ch.url.replace(
                  /\/(2006|9207|503|5031)\/index\.m3u8/i,
                  '/5031/index.m3u8'
                ),
              }
            : ch
        );
        const hasPaidSmartFavs =
          existingFavs.length >= 30 &&
          existingFavs[0]?.url === DEFAULT_SMART_FAVORITE_TV_CHANNELS[0]?.url &&
          existingFavs[4]?.url === DEFAULT_SMART_FAVORITE_TV_CHANNELS[4]?.url &&
          existingFavs[14]?.url === DEFAULT_SMART_FAVORITE_TV_CHANNELS[14]?.url &&
          existingFavs[15]?.url === DEFAULT_SMART_FAVORITE_TV_CHANNELS[15]?.url &&
          existingFavs[29]?.url === DEFAULT_SMART_FAVORITE_TV_CHANNELS[29]?.url;
        if (!hasPaidSmartFavs) {
          merged.favoriteTvChannels = [...DEFAULT_SMART_FAVORITE_TV_CHANNELS];
        } else {
          merged.favoriteTvChannels = existingFavs;
        }

        const activeProfileId =
          (loadSharedActiveProfileId() || 'p1').replace(
            /[^a-zA-Z0-9_-]/g,
            ''
          ) || 'p1';
        const perProfileFavs = readProfileRadioFavsFromLocalStorage(activeProfileId);
        if (perProfileFavs) {
          merged.favorites = perProfileFavs.stations;
        } else {
          let migratedFavs =
            Array.isArray(persisted.favorites) && persisted.favorites.length > 0
              ? persisted.favorites.map(migrateRadioStationEntry)
              : [...DEFAULT_SMART_FAVORITE_RADIO_STATIONS];
          // Ensure JEKA (p1) has RMC Hits restored on first migration if previous quota drops lost it
          if (
            activeProfileId === 'p1' &&
            !migratedFavs.some((s) => isSameRadioStation(s, RMC_HITS_STATION))
          ) {
            migratedFavs = [RMC_HITS_STATION, ...migratedFavs];
          }
          writeProfileRadioFavsToLocalStorage(activeProfileId, {
            updatedAt: 1000,
            stations: migratedFavs,
          });
          merged.favorites = migratedFavs;
        }

        if (Array.isArray(persisted.recentlyPlayed)) {
          merged.recentlyPlayed = persisted.recentlyPlayed.map(
            migrateRadioStationEntry
          );
        }
        return merged;
      },
    }
  )
);

