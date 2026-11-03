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
      favorites: [],
      recentlyPlayed: [],
      favoriteTvChannels: [],
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
      adultContentEnabled: true,

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
          const exists = state.favorites.some(
            (s) => s.stationuuid === station.stationuuid
          );
          if (exists) {
            return {
              favorites: state.favorites.filter(
                (s) => s.stationuuid !== station.stationuuid
              ),
            };
          }
          return {
            favorites: [station, ...state.favorites],
          };
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
          const existingMap = new Map(
            state.favorites.map((s) => [s.stationuuid, s])
          );
          for (const st of validStations) {
            existingMap.set(st.stationuuid, {
              ...st,
              url_resolved: st.url_resolved || st.url,
              votes: Number(st.votes) || 0,
              bitrate: Number(st.bitrate) || 0,
              hls: Number(st.hls) || 0,
              clickcount: Number(st.clickcount) || 0,
            });
          }
          return { favorites: Array.from(existingMap.values()) };
        });

        return validStations.length;
      },

      addRecentlyPlayed: (station) =>
        set((state) => {
          const filtered = state.recentlyPlayed.filter(
            (s) => s.stationuuid !== station.stationuuid
          );
          return {
            recentlyPlayed: [station, ...filtered].slice(0, 20),
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
              // If customTvChannels is huge and exceeds 5MB localStorage quota, keep all adult ("взрослые") channels + top 1200 channels so iEdem adult channels at the end of the playlist are never cut off!
              try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed?.state?.customTvChannels) && parsed.state.customTvChannels.length > 600) {
                  const allCustom: TvChannel[] = parsed.state.customTvChannels;
                  const adultChannels = allCustom.filter((c) =>
                    /(?:взросл|для взрослых|эротик|шалун|русская ночь|brazzers|hustler|redlight|dorcel|penthouse|playboy|xxx|adult|18\+)/i.test(
                      `${c.group || ''} ${c.name || ''}`
                    )
                  );
                  const otherChannels = allCustom
                    .filter((c) => !adultChannels.includes(c))
                    .slice(0, 1200);
                  parsed.state.customTvChannels = [
                    ...otherChannels,
                    ...adultChannels,
                  ];
                  localStorage.setItem(name, JSON.stringify(parsed));
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
    }
  )
);

