import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Heart,
  X,
  Tv,
  Radio,
  Clapperboard,
  Trophy,
  Globe,
  Newspaper,
  Sparkles,
  Smile,
  Music,
  MapPin,
  Layers,
  Star,
  Rewind,
} from 'lucide-react';
import { EpgProgramme, TvChannel } from '../../types/radio';
import { useRadioStore } from '../../store/useRadioStore';
import {
  useChannelEpg,
  useEpgRevision,
  resolveChannelEpg,
  getEpgTimingStats,
  fetchEpgForCountry,
  fetchChannelEpgArchive,
  formatEpgTime,
  getEpgDayKey,
  formatEpgDayLabel,
} from '../../services/epgService';
import {
  fetchTvChannelsByCountry,
  fetchAdultTvChannels,
  isAdultTvChannel,
} from '../../services/tvApi';

const OSD_COUNTRY_TABS: Array<{
  id: string;
  label: string;
  country: string;
}> = [
  { id: 'IEDEM', label: 'iEdem / Playlist M3U', country: 'IEDEM' },
  { id: 'RO', label: 'RO • România', country: 'RO' },
  { id: 'MD', label: 'MD • Moldova', country: 'MD' },
  { id: 'RU', label: 'RU • Rusia', country: 'RU' },
  { id: 'US', label: 'US • SUA', country: 'US' },
  { id: 'GB', label: 'UK • Marea Britanie', country: 'GB' },
  { id: 'DE', label: 'DE • Germania', country: 'DE' },
  { id: 'FR', label: 'FR • Franța', country: 'FR' },
  { id: 'IT', label: 'IT • Italia', country: 'IT' },
  { id: 'ES', label: 'ES • Spania', country: 'ES' },
  { id: 'TR', label: 'TR • Turcia', country: 'TR' },
  { id: 'UA', label: 'UA • Ucraina', country: 'UA' },
  { id: 'HU', label: 'HU • Ungaria', country: 'HU' },
  { id: 'BG', label: 'BG • Bulgaria', country: 'BG' },
  { id: 'ALL_GLOBAL', label: 'Toate Țările', country: 'ALL' },
  { id: 'ADULT', label: '18+ Adulți', country: 'ADULT' },
];

export interface ThematicCategoryDef {
  id: string;
  title: string;
  shortLabel: string;
  Icon: React.ComponentType<{ className?: string }>;
  test: (group: string, name: string) => boolean;
}

const THEMATIC_CATEGORIES: ThematicCategoryDef[] = [
  {
    id: 'general',
    title: 'Generale & Naționale',
    shortLabel: 'Generale',
    Icon: Radio,
    test: (g, n) =>
      /основные|общие|general|федеральные|national/i.test(g) ||
      /^(первый|россия 1|нтв|pro tv|antena 1|tvr 1|kanal d|prima tv|jurnal tv|moldova 1)\b/i.test(
        n
      ),
  },
  {
    id: 'cinema',
    title: 'Filme & Seriale',
    shortLabel: 'Filme & Seriale',
    Icon: Clapperboard,
    test: (g, n) =>
      /кино|фильм|сериал|cinema|movie|film|series|serial/i.test(g) ||
      /кино|фильм|сериал|cinema|movie|film|hbo|amedia|viju|tv1000|kinoprem|kinohit|kinomix|kinokom|kinosvid|kinosem|kinouzh|kinosat|sci-fi|fantast|bollywood|dorama|hollywood|paramount|axn|diva|epic drama/i.test(
        n
      ),
  },
  {
    id: 'sport',
    title: 'Sport & Competiții',
    shortLabel: 'Sport',
    Icon: Trophy,
    test: (g, n) =>
      /спорт|sport/i.test(g) ||
      /спорт|sport|football|футбол|ufc|mma|fight|khl|кхл|матч|match|eurosport|digi sport|prima sport|pro arena|setanta|bt sport|sky sports/i.test(
        n
      ),
  },
  {
    id: 'documentaries',
    title: 'Documentare & Știință',
    shortLabel: 'Documentare',
    Icon: Globe,
    test: (g, n) =>
      /познавательные|documentar|docu|science|наука|educational/i.test(g) ||
      /discovery|nat geo|national geographic|viasat explore|viasat history|viasat nature|animal planet|bbc earth|docubox|history|история|наука|моя планета|живая планета|terra|da vinci/i.test(
        n
      ),
  },
  {
    id: 'news',
    title: 'Știri & Informații',
    shortLabel: 'Știri',
    Icon: Newspaper,
    test: (g, n) =>
      /новости|news|info|информационные|business|бизнес/i.test(g) ||
      /euronews|digi 24|digi24|antena 3|romania tv|realitatea|b1 tv|tvr info|bbc world|cnn|россия 24|рбк|известия|мир 24|360 новости/i.test(
        n
      ),
  },
  {
    id: 'entertainment',
    title: 'Divertisment & Lifestyle',
    shortLabel: 'Divertisment',
    Icon: Sparkles,
    test: (g, n) =>
      /развлекательные|хобби|lifestyle|entertainment|fashion|auto|travel|кулинария/i.test(
        g
      ) ||
      /тнт|стс|пятница|суббота|че!|ю-тв|квн|comedy|food network|tlc|e!|fashion|auto motor|extreme sports|охота|рыбалка|кухня|телекафе|сарафан/i.test(
        n
      ),
  },
  {
    id: 'kids',
    title: 'Copii & Familie',
    shortLabel: 'Copii',
    Icon: Smile,
    test: (g, n) =>
      /детские|kids|children|copii|family/i.test(g) ||
      /cartoon|disney|nickelodeon|nick|карусель|мульт|ani|gulli|jimjam|minimax|duck tv|boing|tiji|baby|детский|рыжий|о!/i.test(
        n
      ),
  },
  {
    id: 'music',
    title: 'Muzică',
    shortLabel: 'Muzică',
    Icon: Music,
    test: (g, n) =>
      /музыка|музыкальные|music/i.test(g) ||
      /mtv|муз-тв|муз тв|muz tv|bridge|europa plus|ru\.tv|ру тв|шансон|shanson|mezzo|vh1|kiss tv|utv|zutv|taraf|favorit tv|etno|balkan/i.test(
        n
      ),
  },
  {
    id: 'regional',
    title: 'Regionale & Internaționale',
    shortLabel: 'Regionale',
    Icon: MapPin,
    test: (g) => /региональные|regional|local|мир|international|снг/i.test(g),
  },
];

export function classifyChannelThematic(channel: TvChannel): string {
  const g = channel.group || '';
  const n = channel.name || '';
  for (const cat of THEMATIC_CATEGORIES) {
    if (cat.test(g, n)) {
      return cat.id;
    }
  }
  return 'other';
}

type OsdSortMode = 'default' | 'az';

let lastTvPlaylistContext: {
  countryId: string;
  themeId: string;
} | null = null;

export function setActiveTvPlaylistContext(
  regionId: string,
  categoryId: string = 'ALL'
): void {
  if (regionId === 'FAV' || categoryId === 'FAV') {
    lastTvPlaylistContext = {
      countryId: lastTvPlaylistContext?.countryId || 'RO',
      themeId: 'FAV',
    };
    return;
  }

  const catUpper = (categoryId || 'ALL').toUpperCase();
  let mappedTheme = 'ALL';
  if (categoryId.startsWith('GRP:')) {
    mappedTheme = categoryId;
  } else if (catUpper === 'GENERAL') {
    mappedTheme = 'general';
  } else if (catUpper === 'MOVIES') {
    mappedTheme = 'cinema';
  } else if (catUpper === 'SPORT' || catUpper === 'SPORTS') {
    mappedTheme = 'sport';
  } else if (catUpper === 'NEWS') {
    mappedTheme = 'news';
  } else if (catUpper === 'DOC' || catUpper === 'DOCUMENTARY') {
    mappedTheme = 'documentaries';
  } else if (catUpper === 'KIDS') {
    mappedTheme = 'kids';
  } else if (catUpper === 'MUSIC') {
    mappedTheme = 'music';
  }

  const normalizedCountry = regionId === 'UK' ? 'GB' : regionId;
  lastTvPlaylistContext = {
    countryId: normalizedCountry || 'RO',
    themeId: mappedTheme,
  };
}

interface TvOsdChannelListProps {
  currentChannel: TvChannel;
  channels: TvChannel[];
  isOverlayMode?: boolean;
  initialViewMode?: 'channels' | 'epg';
  onToggleOverlayMode?: () => void;
  onToggleInfoPanel?: () => void;
  isInfoPanelOpen?: boolean;
  onCloseOverlay?: () => void;
  onPlayArchiveProgramme?: (channel: TvChannel, prog: EpgProgramme | null) => void;
}

export const TvOsdChannelList: React.FC<TvOsdChannelListProps> = ({
  currentChannel,
  channels,
  isOverlayMode = false,
  initialViewMode = 'channels',
  onCloseOverlay,
  onToggleInfoPanel,
  onPlayArchiveProgramme,
}) => {
  const playTvChannel = useRadioStore((state) => state.playTvChannel);
  const favoriteTvChannels = useRadioStore((state) => state.favoriteTvChannels);
  const toggleFavoriteTvChannel = useRadioStore(
    (state) => state.toggleFavoriteTvChannel
  );
  const recentTvChannels = useRadioStore((state) => state.recentTvChannels);
  const customTvChannels = useRadioStore((state) => state.customTvChannels);
  const adultContentEnabled = useRadioStore(
    (state) => state.adultContentEnabled
  );

  // Subscribe to EPG service updates so rows re-render immediately when EPG XML feeds finish loading
  useChannelEpg(currentChannel);
  const epgRev = useEpgRevision();

  const [viewMode, setViewMode] = useState<'channels' | 'epg'>(initialViewMode);
  const [isGroupPickerOpen, setIsGroupPickerOpen] = useState<boolean>(true);
  const [isSearchBarOpen, setIsSearchBarOpen] = useState<boolean>(false);
  const [hasSwitchedCountry, setHasSwitchedCountry] = useState<boolean>(false);

  const isQueueFavorites = useMemo(() => {
    if (favoriteTvChannels.length === 0 || channels.length === 0) return false;
    if (channels.length > favoriteTvChannels.length) return false;
    const favIds = new Set(favoriteTvChannels.map((f) => f.id));
    const favUrls = new Set(favoriteTvChannels.map((f) => f.url));
    return channels.every((c) => favIds.has(c.id) || favUrls.has(c.url));
  }, [channels, favoriteTvChannels]);

  const [selectedCountryId, setSelectedCountryId] = useState<string>(() => {
    if (
      lastTvPlaylistContext?.countryId &&
      OSD_COUNTRY_TABS.some((t) => t.id === lastTvPlaylistContext?.countryId)
    ) {
      return lastTvPlaylistContext.countryId;
    }
    if (
      customTvChannels.length > 0 &&
      customTvChannels.some(
        (c) => c.id === currentChannel?.id || c.url === currentChannel?.url
      )
    ) {
      return 'IEDEM';
    }
    const code = (currentChannel?.countryCode || '').toUpperCase();
    const mappedCode = code === 'UK' ? 'GB' : code;
    if (OSD_COUNTRY_TABS.some((t) => t.id === mappedCode)) {
      return mappedCode;
    }
    if (channels.length > 300) {
      return 'RU';
    }
    return 'RO';
  });
  const [countryChannels, setCountryChannels] = useState<TvChannel[] | null>(
    null
  );
  const [isLoadingCountry, setIsLoadingCountry] = useState<boolean>(false);

  const [selectedThemeId, setSelectedThemeId] = useState<string>(() => {
    if (lastTvPlaylistContext?.themeId === 'FAV' || isQueueFavorites) {
      return 'FAV';
    }
    if (lastTvPlaylistContext?.themeId) {
      return lastTvPlaylistContext.themeId;
    }
    return 'ALL';
  });

  useEffect(() => {
    lastTvPlaylistContext = {
      countryId: selectedCountryId,
      themeId: selectedThemeId,
    };
  }, [selectedCountryId, selectedThemeId]);
  const [sortMode, setSortMode] = useState<OsdSortMode>('default');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isOsdKeyboardOpen, setIsOsdKeyboardOpen] = useState<boolean>(false);
  const [osdKeyboardLang, setOsdKeyboardLang] = useState<'LAT' | 'CYR'>('LAT');
  const [renderLimit, setRenderLimit] = useState<number>(120);

  // Track which channel row is currently highlighted in the Smart IPTV single-column list
  const [focusedRowIdx, setFocusedRowIdx] = useState<number>(0);

  // Smart IPTV EPG / Catch-up Archive View State (Photo 3)
  const [epgChannel, setEpgChannel] = useState<TvChannel>(currentChannel);
  const [epgProgrammes, setEpgProgrammes] = useState<EpgProgramme[]>([]);
  const [isEpgLoading, setIsEpgLoading] = useState<boolean>(false);
  const [selectedEpgDay, setSelectedEpgDay] = useState<string>('');
  const [focusedEpgIdx, setFocusedEpgIdx] = useState<number>(0);

  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const epgListContainerRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const epgRowRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const mountedAtRef = useRef<number>(Date.now());
  const lastSelectAtRef = useRef<number>(0);

  useEffect(() => {
    setViewMode(initialViewMode);
  }, [initialViewMode]);

  useEffect(() => {
    void fetchEpgForCountry('RO');
    void fetchEpgForCountry('RU');
    const epgCountry =
      selectedCountryId === 'IEDEM' || selectedCountryId === 'ALL_GLOBAL'
        ? currentChannel?.countryCode || 'RO'
        : selectedCountryId;
    if (
      epgCountry &&
      epgCountry !== 'ADULT' &&
      epgCountry !== 'RO' &&
      epgCountry !== 'RU'
    ) {
      void fetchEpgForCountry(epgCountry);
    }
  }, [selectedCountryId, currentChannel?.countryCode]);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingCountry(true);

    if (selectedCountryId === 'ADULT') {
      const customAdult = customTvChannels.filter((c) => isAdultTvChannel(c));
      fetchAdultTvChannels()
        .then((fetched) => {
          if (cancelled) return;
          const seen = new Set(customAdult.map((c) => c.url));
          setCountryChannels([
            ...customAdult,
            ...fetched.filter((c) => !seen.has(c.url)),
          ]);
        })
        .catch(() => {
          if (!cancelled) setCountryChannels(customAdult);
        })
        .finally(() => {
          if (!cancelled) setIsLoadingCountry(false);
        });
      return () => {
        cancelled = true;
      };
    }

    if (selectedCountryId === 'IEDEM') {
      const customList = adultContentEnabled
        ? customTvChannels
        : customTvChannels.filter((c) => !isAdultTvChannel(c));
      fetchTvChannelsByCountry('RU')
        .then((ruList) => {
          if (cancelled) return;
          const filteredRu = adultContentEnabled
            ? ruList
            : ruList.filter((c) => !isAdultTvChannel(c));
          const seen = new Set<string>();
          const merged: TvChannel[] = [];
          for (const ch of [...customList, ...filteredRu]) {
            if (!ch.url || seen.has(ch.url)) continue;
            seen.add(ch.url);
            merged.push(ch);
          }
          setCountryChannels(merged.slice(0, 1200));
        })
        .catch(() => {
          if (!cancelled) setCountryChannels(customList);
        })
        .finally(() => {
          if (!cancelled) setIsLoadingCountry(false);
        });
      return () => {
        cancelled = true;
      };
    }

    const targetCountry =
      selectedCountryId === 'ALL_GLOBAL' ? 'ALL' : selectedCountryId;
    fetchTvChannelsByCountry(targetCountry)
      .then((list) => {
        if (cancelled) return;
        const base = list.slice(0, 1200);
        const filtered = adultContentEnabled
          ? base
          : base.filter((c) => !isAdultTvChannel(c));
        setCountryChannels(filtered);
      })
      .catch(() => {
        if (!cancelled) setCountryChannels(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCountry(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCountryId, customTvChannels, adultContentEnabled]);

  const pool = useMemo(() => {
    if (countryChannels && countryChannels.length > 0) {
      return countryChannels;
    }
    if (!hasSwitchedCountry && !isQueueFavorites && channels.length > 0) {
      return channels;
    }
    if (channels.length > 0) return channels;
    const combined = [
      currentChannel,
      ...favoriteTvChannels,
      ...recentTvChannels,
    ];
    const seen = new Set<string>();
    return combined.filter((ch) => {
      if (!ch || seen.has(ch.id)) return false;
      seen.add(ch.id);
      return true;
    });
  }, [
    hasSwitchedCountry,
    isQueueFavorites,
    countryChannels,
    channels,
    currentChannel,
    favoriteTvChannels,
    recentTvChannels,
  ]);

  const thematicBuckets = useMemo(() => {
    const map = new Map<string, TvChannel[]>();
    for (const cat of THEMATIC_CATEGORIES) {
      map.set(cat.id, []);
    }
    map.set('other', []);

    for (const ch of pool) {
      const themeId = classifyChannelThematic(ch);
      const arr = map.get(themeId) || map.get('other')!;
      arr.push(ch);

      const rawGroup = (ch.group || '').trim();
      if (rawGroup) {
        const grpKey = `GRP:${rawGroup}`;
        if (!map.has(grpKey)) {
          map.set(grpKey, []);
        }
        map.get(grpKey)!.push(ch);
      }
    }

    return map;
  }, [pool]);

  const themeTabs = useMemo(() => {
    const tabs: Array<{
      id: string;
      title: string;
      shortLabel: string;
      Icon: React.ComponentType<{ className?: string }>;
      count: number;
    }> = [
      {
        id: 'FAV',
        title: '★ Favorite TV',
        shortLabel: '★ Favorite',
        Icon: Star,
        count: favoriteTvChannels.length,
      },
      {
        id: 'ALL',
        title: 'Toate Canalele',
        shortLabel: 'Toate Canalele',
        Icon: Tv,
        count: pool.length,
      },
    ];

    for (const cat of THEMATIC_CATEGORIES) {
      const count = thematicBuckets.get(cat.id)?.length || 0;
      if (count > 0) {
        tabs.push({
          id: cat.id,
          title: cat.title,
          shortLabel: cat.shortLabel,
          Icon: cat.Icon,
          count,
        });
      }
    }

    // Include custom M3U playlist groups if active
    if (customTvChannels.length > 0) {
      for (const [key, list] of thematicBuckets.entries()) {
        if (key.startsWith('GRP:') && list.length > 0) {
          const grpName = key.slice(4);
          if (!adultContentEnabled && /взросл|adult|xxx|18\+|эротик/i.test(grpName)) {
            continue;
          }
          tabs.push({
            id: key,
            title: grpName,
            shortLabel: grpName,
            Icon: Layers,
            count: list.length,
          });
        }
      }
    }

    const otherCount = thematicBuckets.get('other')?.length || 0;
    if (otherCount > 0) {
      tabs.push({
        id: 'other',
        title: 'Alte Canale TV',
        shortLabel: 'Altele',
        Icon: Layers,
        count: otherCount,
      });
    }

    return tabs;
  }, [
    pool.length,
    favoriteTvChannels.length,
    thematicBuckets,
    customTvChannels.length,
    adultContentEnabled,
  ]);

  // Flat, clean single-column numbered channel list (1 .. N) just like Smart IPTV (Photo 1)
  const flatChannels = useMemo<TvChannel[]>(() => {
    const q = searchQuery.trim().toLowerCase();

    const matchesFilters = (ch: TvChannel): boolean => {
      if (!q) return true;
      const epg = resolveChannelEpg(ch);
      const nameMatch = ch.name.toLowerCase().includes(q);
      const groupMatch = (ch.group || '').toLowerCase().includes(q);
      const epgMatch =
        epg?.now?.title?.toLowerCase().includes(q) ||
        epg?.now?.desc?.toLowerCase().includes(q);
      return Boolean(nameMatch || groupMatch || epgMatch);
    };

    let baseList: TvChannel[] = [];
    if (selectedThemeId === 'FAV') {
      baseList = favoriteTvChannels.filter(matchesFilters);
    } else if (selectedThemeId === 'ALL') {
      baseList = pool.filter(matchesFilters);
    } else {
      baseList = (thematicBuckets.get(selectedThemeId) || []).filter(
        matchesFilters
      );
    }

    if (sortMode === 'az') {
      return [...baseList].sort((a, b) => a.name.localeCompare(b.name));
    }

    if (selectedThemeId !== 'FAV' && !q && baseList.length > 35) {
      const topCurated = baseList.slice(0, 35);
      const rest = baseList.slice(35);
      const withEpg: TvChannel[] = [];
      const withoutEpg: TvChannel[] = [];
      for (const ch of rest) {
        if (resolveChannelEpg(ch)?.now) {
          withEpg.push(ch);
        } else {
          withoutEpg.push(ch);
        }
      }
      return [...topCurated, ...withEpg, ...withoutEpg];
    }

    return baseList;
  }, [
    selectedThemeId,
    favoriteTvChannels,
    pool,
    thematicBuckets,
    searchQuery,
    sortMode,
    epgRev,
  ]);

  // Active channel index in flatChannels
  const currentChannelIdx = useMemo(() => {
    const idx = flatChannels.findIndex((c) => c.id === currentChannel.id);
    return idx >= 0 ? idx : 0;
  }, [flatChannels, currentChannel.id]);

  // Sync focusedRowIdx when currentChannel or group changes
  useEffect(() => {
    setFocusedRowIdx(currentChannelIdx);
  }, [currentChannelIdx, selectedThemeId, selectedCountryId]);

  useEffect(() => {
    if (focusedRowIdx + 30 > renderLimit) {
      setRenderLimit(focusedRowIdx + 100);
    }
  }, [focusedRowIdx, renderLimit]);

  // Auto-focus and center the active/focused row in Smart IPTV Channel List
  useEffect(() => {
    if (viewMode !== 'channels') return;
    const timer = window.setTimeout(() => {
      const btn = rowRefs.current.get(focusedRowIdx);
      const container = listContainerRef.current;
      if (btn && container) {
        const targetTop =
          btn.offsetTop - container.clientHeight / 2 + btn.clientHeight / 2;
        container.scrollTo({
          top: Math.max(0, targetTop),
          behavior: 'auto',
        });
        if (!isSearchBarOpen && !isOsdKeyboardOpen) {
          btn.focus();
        }
      }
    }, 25);
    return () => window.clearTimeout(timer);
  }, [
    focusedRowIdx,
    viewMode,
    selectedThemeId,
    selectedCountryId,
    isSearchBarOpen,
    isOsdKeyboardOpen,
  ]);

  // Load EPG Archive whenever viewMode === 'epg'
  useEffect(() => {
    if (viewMode !== 'epg') return;
    let cancelled = false;
    setIsEpgLoading(true);
    void fetchChannelEpgArchive(epgChannel)
      .then((list) => {
        if (cancelled) return;
        setEpgProgrammes(list);
        const todayKey = getEpgDayKey(Date.now());
        const days = Array.from(new Set(list.map((p) => getEpgDayKey(p.start)))).sort();
        if (days.includes(todayKey)) {
          setSelectedEpgDay(todayKey);
        } else if (days.length > 0) {
          setSelectedEpgDay(days[days.length - 1]);
        } else {
          setSelectedEpgDay('');
        }
      })
      .finally(() => {
        if (!cancelled) setIsEpgLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewMode, epgChannel]);

  const epgDays = useMemo(() => {
    return Array.from(
      new Set(epgProgrammes.map((p) => getEpgDayKey(p.start)))
    ).sort();
  }, [epgProgrammes]);

  const dayProgrammes = useMemo(() => {
    if (!selectedEpgDay) {
      const chEpg = resolveChannelEpg(epgChannel);
      const fallback: EpgProgramme[] = [];
      if (chEpg?.now) fallback.push(chEpg.now);
      if (chEpg?.upcoming) fallback.push(...chEpg.upcoming);
      return fallback;
    }
    return epgProgrammes.filter(
      (p) => getEpgDayKey(p.start) === selectedEpgDay
    );
  }, [epgProgrammes, selectedEpgDay, epgChannel]);

  // Find current live programme index in dayProgrammes
  useEffect(() => {
    if (viewMode !== 'epg') return;
    const nowMs = Date.now();
    const liveIdx = dayProgrammes.findIndex(
      (p) => p.start <= nowMs && p.stop > nowMs
    );
    setFocusedEpgIdx(liveIdx >= 0 ? liveIdx : Math.max(0, dayProgrammes.length - 1));
  }, [viewMode, dayProgrammes]);

  useEffect(() => {
    if (viewMode !== 'epg') return;
    const timer = window.setTimeout(() => {
      const btn = epgRowRefs.current.get(focusedEpgIdx);
      const container = epgListContainerRef.current;
      if (btn && container) {
        const targetTop =
          btn.offsetTop - container.clientHeight / 2 + btn.clientHeight / 2;
        container.scrollTo({
          top: Math.max(0, targetTop),
          behavior: 'auto',
        });
        btn.focus();
      }
    }, 30);
    return () => window.clearTimeout(timer);
  }, [focusedEpgIdx, viewMode, selectedEpgDay]);

  const visibleChannels = useMemo(
    () => flatChannels.slice(0, renderLimit),
    [flatChannels, renderLimit]
  );

  const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (
      el.scrollTop + el.clientHeight >= el.scrollHeight - 260 &&
      renderLimit < flatChannels.length
    ) {
      setRenderLimit((prev) => Math.min(flatChannels.length, prev + 140));
    }
  };

  const activeThemeTab =
    themeTabs.find((t) => t.id === selectedThemeId) || themeTabs[0];
  const activeCountryTab = OSD_COUNTRY_TABS.find(
    (c) => c.id === selectedCountryId
  );

  const cycleThemeGroup = (dir: -1 | 1) => {
    if (themeTabs.length <= 1) return;
    const curIdx = themeTabs.findIndex((t) => t.id === selectedThemeId);
    const nextIdx =
      (curIdx + dir + themeTabs.length) % themeTabs.length;
    setSelectedThemeId(themeTabs[nextIdx].id);
  };

  const cycleEpgDay = (dir: -1 | 1) => {
    if (epgDays.length <= 1) return;
    const curIdx = epgDays.indexOf(selectedEpgDay);
    const nextIdx = Math.max(
      0,
      Math.min(epgDays.length - 1, (curIdx >= 0 ? curIdx : 0) + dir)
    );
    setSelectedEpgDay(epgDays[nextIdx]);
  };

  const openEpgForFocusedChannel = () => {
    const targetCh = flatChannels[focusedRowIdx] || currentChannel;
    setEpgChannel(targetCh);
    setViewMode('epg');
  };

  const toggleFavForFocusedChannel = () => {
    const targetCh = flatChannels[focusedRowIdx] || currentChannel;
    if (targetCh) {
      toggleFavoriteTvChannel(targetCh);
    }
  };

  const selectChannelRow = (targetCh: TvChannel | undefined) => {
    if (!targetCh) return;
    const now = Date.now();
    if (now - mountedAtRef.current < 300) return;
    if (now - lastSelectAtRef.current < 300) return;
    lastSelectAtRef.current = now;
    const activePlaylistQueue =
      flatChannels.length > 0 ? flatChannels : pool;
    playTvChannel(targetCh, activePlaylistQueue);
    if (isOverlayMode && onCloseOverlay) {
      onCloseOverlay();
    }
  };

  // Dedicated Smart IPTV Keyboard Handler inside OSD (100% deterministic Up/Down/Left/Right/OK/Colors)
  const handleOsdKeyEvent = (
    e: KeyboardEvent | React.KeyboardEvent<HTMLDivElement>
  ) => {
    const target = e.target as HTMLElement | null;
    const isInsideInput =
      target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

    const isOkKey =
      e.key === 'Enter' ||
      e.key === 'Select' ||
      e.key === 'Execute' ||
      e.key === ' ' ||
      e.keyCode === 13 ||
      e.keyCode === 29443;

    if (viewMode === 'epg') {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedEpgIdx((prev) =>
          Math.min(Math.max(0, dayProgrammes.length - 1), prev + 1)
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedEpgIdx((prev) => Math.max(0, prev - 1));
        return;
      }
      if (e.key === 'ArrowLeft' || e.keyCode === 405) {
        e.preventDefault();
        e.stopPropagation();
        cycleEpgDay(-1);
        return;
      }
      if (e.key === 'ArrowRight' || e.keyCode === 406) {
        e.preventDefault();
        e.stopPropagation();
        cycleEpgDay(1);
        return;
      }
      if (isOkKey) {
        e.preventDefault();
        e.stopPropagation();
        if (Date.now() - mountedAtRef.current < 300) return;
        const prog = dayProgrammes[focusedEpgIdx];
        if (prog) {
          const nowMs = Date.now();
          const isLiveNow = prog.start <= nowMs && prog.stop > nowMs;
          if (onPlayArchiveProgramme) {
            onPlayArchiveProgramme(epgChannel, isLiveNow ? null : prog);
          } else {
            playTvChannel(
              {
                ...epgChannel,
                archiveProgram: isLiveNow ? undefined : prog,
              },
              pool
            );
          }
          if (onCloseOverlay) onCloseOverlay();
        }
        return;
      }
      if (
        e.key === 'Escape' ||
        e.key === 'Backspace' ||
        e.keyCode === 461 ||
        e.keyCode === 10009 ||
        e.keyCode === 403
      ) {
        e.preventDefault();
        e.stopPropagation();
        setViewMode('channels');
        return;
      }
      return;
    }

    // When Search/Keyboard is open, let standard focus handle it unless pressing Escape/Back
    if (isSearchBarOpen || isOsdKeyboardOpen) {
      if (e.key === 'Escape' || (e.key === 'Backspace' && !isInsideInput)) {
        e.preventDefault();
        e.stopPropagation();
        setIsSearchBarOpen(false);
        setIsOsdKeyboardOpen(false);
      }
      return;
    }

    if (isOkKey) {
      const activeEl = document.activeElement as HTMLElement | null;
      const isActionBtn =
        activeEl?.getAttribute('data-osd-action-btn') === 'true';
      if (!isActionBtn) {
        e.preventDefault();
        e.stopPropagation();
        selectChannelRow(flatChannels[focusedRowIdx]);
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setFocusedRowIdx((prev) =>
        flatChannels.length > 0 ? (prev + 1) % flatChannels.length : 0
      );
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setFocusedRowIdx((prev) =>
        flatChannels.length > 0
          ? (prev - 1 + flatChannels.length) % flatChannels.length
          : 0
      );
      return;
    }

    if (e.key === 'PageDown' || e.keyCode === 34 || e.keyCode === 428) {
      e.preventDefault();
      e.stopPropagation();
      setFocusedRowIdx((prev) =>
        Math.min(Math.max(0, flatChannels.length - 1), prev + 15)
      );
      return;
    }

    if (e.key === 'PageUp' || e.keyCode === 33 || e.keyCode === 427) {
      e.preventDefault();
      e.stopPropagation();
      setFocusedRowIdx((prev) => Math.max(0, prev - 15));
      return;
    }

    // Left / Right Arrow in Smart IPTV switches Category / Group immediately!
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      cycleThemeGroup(-1);
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      cycleThemeGroup(1);
      return;
    }

    // Color keys & shortcuts (Red = Fav, Green = EPG, Yellow = A-Z, Blue = Groups)
    if (e.keyCode === 403 || e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      e.stopPropagation();
      toggleFavForFocusedChannel();
      return;
    }
    if (e.keyCode === 404 || e.key === 'e' || e.key === 'E') {
      e.preventDefault();
      e.stopPropagation();
      openEpgForFocusedChannel();
      return;
    }
    if (e.keyCode === 405 || e.key === 's' || e.key === 'S') {
      e.preventDefault();
      e.stopPropagation();
      setSortMode((prev) => (prev === 'default' ? 'az' : 'default'));
      return;
    }
    if (e.keyCode === 406 || e.key === 'g' || e.key === 'G') {
      e.preventDefault();
      e.stopPropagation();
      setIsGroupPickerOpen((v) => !v);
      return;
    }
  };

  useEffect(() => {
    if (!isOverlayMode) return;
    const onWinKeyDown = (e: KeyboardEvent) => {
      handleOsdKeyEvent(e);
    };
    window.addEventListener('keydown', onWinKeyDown, true);
    return () => window.removeEventListener('keydown', onWinKeyDown, true);
  });

  const handleOsdKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isOverlayMode) return;
    handleOsdKeyEvent(e);
  };

  // ============================================================================
  // VIEW MODE 2: SMART IPTV EPG & CATCH-UP ARCHIVE WINDOW (PHOTO 3)
  // ============================================================================
  if (viewMode === 'epg') {
    const epgChInfo = resolveChannelEpg(epgChannel);
    const epgLogo =
      !epgChannel.logo || /imgur\.com|wikia\.nocookie\.net/i.test(epgChannel.logo)
        ? epgChInfo?.icon || epgChannel.logo
        : epgChannel.logo;

    return (
      <div
        onKeyDown={handleOsdKeyDown}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        className="w-full h-full min-h-0 flex flex-col select-none text-white"
      >
        {/* Top-Right Protruding Folder Tab: [Logo] Channel Name EPG (Exact match to Photo 3) */}
        <div className="flex items-end justify-between shrink-0 px-0">
          <div className="flex items-center gap-1.5 pb-1">
            {epgDays.map((dayKey) => {
              const activeDay = dayKey === selectedEpgDay;
              return (
                <button
                  key={dayKey}
                  type="button"
                  data-osd-action-btn="true"
                  onClick={() => setSelectedEpgDay(dayKey)}
                  className={`px-2.5 py-0.5 text-xs font-bold border transition-none cursor-pointer ${
                    activeDay
                      ? 'bg-[#0284c7] text-white border-[#7dd3fc]'
                      : 'bg-black/90 text-zinc-300 border-white/20 hover:text-white'
                  }`}
                >
                  {formatEpgDayLabel(dayKey)}
                </button>
              );
            })}
          </div>

          <div
            style={{
              backgroundColor: 'rgba(10, 14, 22, 0.96)',
              borderTop: '2px solid #7dd3fc',
              borderLeft: '2px solid #7dd3fc',
              borderRight: '2px solid #7dd3fc',
            }}
            className="bg-black/95 px-5 py-1.5 inline-flex items-center gap-2.5"
          >
            {epgLogo && (
              <img
                src={epgLogo}
                alt=""
                className="w-6 h-5 object-contain shrink-0"
              />
            )}
            <span className="text-base sm:text-lg font-bold text-white tracking-tight">
              {epgChannel.name} EPG
            </span>
          </div>
        </div>

        {/* Main Framed EPG Programme List Box */}
        <div
          style={{
            flex: '1 1 0%',
            minHeight: 0,
            backgroundColor: 'rgba(10, 14, 22, 0.94)',
            border: '2px solid #7dd3fc',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          className="flex-1 min-h-0 bg-black/95 shadow-2xl flex flex-col overflow-hidden"
        >
          <div
            ref={epgListContainerRef}
            style={{
              flex: '1 1 0%',
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
            className="flex-1 min-h-0 overflow-y-auto divide-y divide-white/[0.06]"
          >
            {isEpgLoading ? (
              <div className="py-20 text-center text-sm font-semibold text-zinc-300">
                Se încarcă programul EPG și Arhiva TV...
              </div>
            ) : dayProgrammes.length === 0 ? (
              <div className="py-20 text-center text-sm text-zinc-400">
                Nu există program EPG disponibil pentru acest canal.
              </div>
            ) : (
              dayProgrammes.map((prog, idx) => {
                const nowMs = Date.now();
                const isPast = prog.stop <= nowMs;
                const isLiveNow = prog.start <= nowMs && prog.stop > nowMs;
                const isFocused = idx === focusedEpgIdx;

                return (
                  <button
                    key={`${prog.start}_${idx}`}
                    type="button"
                    ref={(el) => {
                      if (el) epgRowRefs.current.set(idx, el);
                      else epgRowRefs.current.delete(idx);
                    }}
                    onFocus={() => setFocusedEpgIdx(idx)}
                    onClick={() => {
                      if (onPlayArchiveProgramme) {
                        onPlayArchiveProgramme(
                          epgChannel,
                          isLiveNow ? null : prog
                        );
                      } else {
                        playTvChannel(
                          {
                            ...epgChannel,
                            archiveProgram: isLiveNow ? undefined : prog,
                          },
                          pool
                        );
                      }
                      if (onCloseOverlay) onCloseOverlay();
                    }}
                    className={`w-full h-[40px] px-4 flex items-center justify-between gap-4 text-left transition-none cursor-pointer outline-none ${
                      isFocused
                        ? 'bg-[#0284c7]/45 border-y-2 border-[#38bdf8] text-white'
                        : isLiveNow
                          ? 'bg-white/10 text-white'
                          : 'hover:bg-white/[0.06] text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <span className="w-32 shrink-0 text-[15px] sm:text-base font-bold text-zinc-200 tabular-nums">
                        {formatEpgTime(prog.start)} - {formatEpgTime(prog.stop)}
                      </span>
                      <span className="text-[15px] sm:text-base font-semibold text-white truncate">
                        {prog.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isLiveNow && (
                        <span className="px-2 py-0.5 text-[11px] font-extrabold bg-emerald-500 text-zinc-950 uppercase">
                          LIVE
                        </span>
                      )}
                      {(isPast || isLiveNow) && (
                        <span
                          title="Disponibil în Arhiva Catch-up"
                          className="px-1.5 py-0.5 border border-[#7dd3fc]/70 bg-white/10 text-sky-200 inline-flex items-center justify-center"
                        >
                          <Rewind className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Bottom-Right Protruding Legend Tab: [ • Canale | • Day - | • Day + ] (Exact match to Photo 3) */}
        <div className="self-end border-2 border-t-0 border-[#7dd3fc]/85 bg-black/90 px-4 py-1 flex items-center gap-5 text-xs sm:text-[13px] font-bold text-white shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('channels')}
            className="inline-flex items-center gap-1.5 hover:text-sky-300 cursor-pointer"
          >
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
            <span>Canale</span>
          </button>
          <button
            type="button"
            onClick={() => cycleEpgDay(-1)}
            className="inline-flex items-center gap-1.5 hover:text-sky-300 cursor-pointer"
          >
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 inline-block" />
            <span>Day -</span>
          </button>
          <button
            type="button"
            onClick={() => cycleEpgDay(1)}
            className="inline-flex items-center gap-1.5 hover:text-sky-300 cursor-pointer"
          >
            <span className="w-2.5 h-2.5 rounded-xs bg-blue-500 inline-block" />
            <span>Day +</span>
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW MODE 1: SMART IPTV SINGLE-COLUMN CHANNEL LIST WINDOW (PHOTO 1)
  // ============================================================================
  return (
    <div
      onKeyDown={handleOsdKeyDown}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      className="w-full h-full min-h-0 flex flex-col select-none text-white"
    >
      {/* Top Row: Protruding Folder Tab on the Left (Exact match to `[ ★ Favourites ]` in Photo 1) */}
      <div className="flex items-end justify-between gap-2 shrink-0">
        <button
          type="button"
          data-osd-action-btn="true"
          onClick={() => setIsGroupPickerOpen((v) => !v)}
          style={{
            backgroundColor: 'rgba(10, 14, 22, 0.96)',
            borderTop: '2px solid #7dd3fc',
            borderLeft: '2px solid #7dd3fc',
            borderRight: '2px solid #7dd3fc',
          }}
          className="bg-black/95 px-5 py-1.5 inline-flex items-center gap-2.5 text-white hover:bg-zinc-900 focus:bg-[#0284c7] focus:outline-none cursor-pointer"
          title="Schimbă Playlist-ul / Categoria (Săgeți Stânga / Dreapta)"
        >
          {selectedThemeId === 'FAV' ? (
            <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
          ) : (
            <Tv className="w-4 h-4 text-[#7dd3fc] shrink-0" />
          )}
          <span className="text-base sm:text-lg font-bold tracking-tight">
            {selectedThemeId === 'FAV'
              ? '★ Favorite TV'
              : activeThemeTab.shortLabel}
          </span>
          <span className="text-xs font-semibold text-zinc-300">
            {selectedThemeId === 'FAV'
              ? `• Lista ta (${flatChannels.length} canale)`
              : `• ${activeCountryTab?.label || selectedCountryId} (${flatChannels.length})`}
          </span>
          {isLoadingCountry && selectedThemeId !== 'FAV' && (
            <span className="text-[11px] text-sky-300 font-normal">
              (Se încarcă...)
            </span>
          )}
        </button>

        {/* Subtle Right-Side Quick Controls */}
        <div className="flex items-center gap-1.5 pb-1">
          <button
            type="button"
            data-osd-action-btn="true"
            onClick={() => cycleThemeGroup(-1)}
            className="px-2.5 py-1 bg-black/90 border border-white/20 hover:border-[#7dd3fc] text-xs font-bold text-zinc-200 cursor-pointer"
            title="Playlist-ul anterior (Săgeată Stânga)"
          >
            ◀ Playlist
          </button>
          <button
            type="button"
            data-osd-action-btn="true"
            onClick={() => cycleThemeGroup(1)}
            className="px-2.5 py-1 bg-black/90 border border-white/20 hover:border-[#7dd3fc] text-xs font-bold text-zinc-200 cursor-pointer"
            title="Playlist-ul următor (Săgeată Dreapta)"
          >
            Playlist ▶
          </button>
          <button
            type="button"
            data-osd-action-btn="true"
            onClick={() => setIsSearchBarOpen((v) => !v)}
            className={`px-2.5 py-1 border text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
              isSearchBarOpen || searchQuery
                ? 'bg-[#0284c7] border-[#7dd3fc] text-white'
                : 'bg-black/90 border-white/20 text-zinc-200 hover:border-[#7dd3fc]'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Caută</span>
          </button>
          {isOverlayMode && onCloseOverlay && (
            <button
              type="button"
              data-osd-action-btn="true"
              onClick={onCloseOverlay}
              aria-label="Închide lista"
              className="px-2.5 py-1 bg-black/90 border border-white/20 hover:bg-rose-600 text-xs font-bold text-zinc-200 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Framed Smart IPTV Box */}
      <div
        style={{
          flex: '1 1 0%',
          minHeight: 0,
          backgroundColor: 'rgba(10, 14, 22, 0.94)',
          border: '2px solid #7dd3fc',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        className="flex-1 min-h-0 bg-black/95 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Always-Visible Playlists, Countries & Categories Bar */}
        {isGroupPickerOpen && (
          <div className="p-2.5 bg-zinc-950/95 border-b border-[#7dd3fc]/40 space-y-2 shrink-0">
            {/* Row 1: Favorite + M3U + Country Playlists */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                type="button"
                data-osd-action-btn="true"
                onClick={() => {
                  setSelectedThemeId('FAV');
                }}
                className={`h-7 px-3 text-xs font-extrabold whitespace-nowrap shrink-0 border transition-none cursor-pointer inline-flex items-center gap-1.5 focus:bg-white focus:text-black ${
                  selectedThemeId === 'FAV'
                    ? 'bg-amber-400 text-zinc-950 border-amber-200 shadow-sm'
                    : 'bg-zinc-900 text-amber-300 border-amber-400/35 hover:bg-zinc-800'
                }`}
              >
                <Star className="w-3.5 h-3.5 fill-current shrink-0" />
                <span>Favorite ({favoriteTvChannels.length})</span>
              </button>

              {OSD_COUNTRY_TABS.filter(
                (reg) => adultContentEnabled || reg.id !== 'ADULT'
              ).map((reg) => {
                const active =
                  selectedThemeId !== 'FAV' && selectedCountryId === reg.id;
                return (
                  <button
                    key={`osd_country_${reg.id}`}
                    type="button"
                    data-osd-action-btn="true"
                    onClick={() => {
                      setHasSwitchedCountry(true);
                      setSelectedCountryId(reg.id);
                      setSelectedThemeId('ALL');
                    }}
                    className={`h-7 px-3 text-xs font-bold whitespace-nowrap shrink-0 border transition-none cursor-pointer focus:bg-white focus:text-black ${
                      active
                        ? 'bg-[#0284c7] text-white border-[#7dd3fc]'
                        : 'bg-zinc-900 text-zinc-300 border-white/15 hover:text-white'
                    }`}
                  >
                    {reg.label}
                  </button>
                );
              })}
            </div>

            {/* Row 2: Thematic Category Playlists */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {themeTabs.map((tab) => {
                const active = selectedThemeId === tab.id;
                const isFavTab = tab.id === 'FAV';
                return (
                  <button
                    key={tab.id}
                    type="button"
                    data-osd-action-btn="true"
                    onClick={() => {
                      setSelectedThemeId(tab.id);
                    }}
                    className={`h-7 px-3 text-xs font-bold whitespace-nowrap shrink-0 border transition-none cursor-pointer focus:bg-white focus:text-black ${
                      active
                        ? isFavTab
                          ? 'bg-amber-400 text-zinc-950 border-amber-200 font-extrabold'
                          : 'bg-[#0284c7] text-white border-[#7dd3fc]'
                        : isFavTab
                          ? 'bg-zinc-900 text-amber-300 border-amber-400/30 hover:text-amber-200'
                          : 'bg-zinc-900 text-zinc-300 border-white/15 hover:text-white'
                    }`}
                  >
                    {tab.shortLabel} ({tab.count})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Optional Expandable Search & TV Keyboard Bar */}
        {isSearchBarOpen && (
          <div className="p-2.5 bg-zinc-950/95 border-b border-[#7dd3fc]/40 space-y-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  tabIndex={-1}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Caută canal sau emisiune EPG..."
                  className="w-full h-8 pl-8 pr-8 bg-black border border-white/25 text-xs font-bold text-white placeholder:text-zinc-500 outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="w-6 h-6 absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsOsdKeyboardOpen((v) => !v)}
                className="h-8 px-3 bg-zinc-900 border border-white/20 text-xs font-bold text-white focus:bg-white focus:text-black cursor-pointer"
              >
                Tastatură TV
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSearchBarOpen(false);
                  setIsOsdKeyboardOpen(false);
                }}
                className="h-8 px-3 bg-zinc-900 border border-white/20 text-xs font-bold text-zinc-300 focus:bg-white focus:text-black cursor-pointer"
              >
                Închide
              </button>
            </div>

            {isOsdKeyboardOpen && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setOsdKeyboardLang((l) => (l === 'LAT' ? 'CYR' : 'LAT'))
                    }
                    className="h-7 px-2.5 bg-zinc-800 focus:bg-white focus:text-black text-[11px] font-bold text-white cursor-pointer"
                  >
                    {osdKeyboardLang === 'LAT' ? 'АБВ (RU)' : 'ABC (RO/EN)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchQuery((q) => q + ' ')}
                    className="h-7 px-3 bg-zinc-800 focus:bg-white focus:text-black text-[11px] font-bold text-white cursor-pointer"
                  >
                    Spațiu
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchQuery((q) => q.slice(0, -1))}
                    className="h-7 px-2.5 bg-zinc-800 focus:bg-rose-600 text-[11px] font-bold text-rose-300 focus:text-white cursor-pointer"
                  >
                    ⌫ Șterge
                  </button>
                </div>
                <div className="grid grid-cols-12 gap-1">
                  {(osdKeyboardLang === 'LAT'
                    ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')
                    : 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЫЭЮЯ0123456789'.split('')
                  ).map((ch) => (
                    <button
                      key={`osd_kb_${ch}`}
                      type="button"
                      onClick={() => setSearchQuery((q) => q + ch)}
                      className="h-7 bg-zinc-900 focus:bg-white focus:text-black text-white font-bold text-xs border border-white/10 cursor-pointer"
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STRICT SINGLE-COLUMN NUMBERED CHANNEL LIST (1..15 visible per view, exact match to Photo 1) */}
        <div
          ref={listContainerRef}
          onScroll={handleListScroll}
          role="listbox"
          aria-label="Canale TV Smart IPTV"
          style={{
            flex: '1 1 0%',
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
          className="flex-1 min-h-0 overflow-y-auto divide-y divide-white/[0.06]"
        >
          {visibleChannels.length === 0 ? (
            <div className="py-16 px-4 text-center text-sm text-zinc-400 space-y-3">
              <p>
                {selectedThemeId === 'FAV'
                  ? 'Nu ai încă niciun canal TV la Favourites. Apasă butonul Roșu (Fav) pe orice canal!'
                  : 'Niciun canal găsit în această categorie.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedThemeId('ALL');
                  setSearchQuery('');
                }}
                className="px-4 py-1.5 bg-white text-black text-xs font-bold cursor-pointer"
              >
                Afișează Toate Canalele
              </button>
            </div>
          ) : (
            visibleChannels.map((ch, idx) => {
              const isFocused = idx === focusedRowIdx;
              const isCurrent = ch.id === currentChannel.id;
              const isFav = favoriteTvChannels.some((f) => f.id === ch.id);
              const chEpg = resolveChannelEpg(ch);
              const nowProg = chEpg?.now;
              const stats = getEpgTimingStats(nowProg);

              const effectiveLogo =
                !ch.logo || /imgur\.com|wikia\.nocookie\.net/i.test(ch.logo)
                  ? chEpg?.icon || ch.logo
                  : ch.logo;

              const shortBadge = ch.name
                .replace(/[^a-zA-Z0-9А-Яа-яЁё]/g, '')
                .slice(0, 2)
                .toUpperCase();

              return (
                <button
                  key={`${ch.id}_${idx}`}
                  type="button"
                  data-osd-channel-row="true"
                  ref={(el) => {
                    if (el) rowRefs.current.set(idx, el);
                    else rowRefs.current.delete(idx);
                  }}
                  role="option"
                  aria-selected={isCurrent}
                  onFocus={() => setFocusedRowIdx(idx)}
                  onClick={() => selectChannelRow(ch)}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '40px',
                    minHeight: '40px',
                    maxHeight: '40px',
                    paddingLeft: '12px',
                    paddingRight: '12px',
                    backgroundColor: isFocused
                      ? 'rgba(2, 132, 199, 0.65)'
                      : isCurrent
                        ? 'rgba(255, 255, 255, 0.14)'
                        : 'transparent',
                    borderTop: isFocused
                      ? '2px solid #38bdf8'
                      : '1px solid transparent',
                    borderBottom: isFocused
                      ? '2px solid #38bdf8'
                      : '1px solid rgba(255, 255, 255, 0.07)',
                  }}
                  className="w-full text-left transition-none cursor-pointer outline-none"
                >
                  <div
                    style={{
                      display: 'table',
                      tableLayout: 'fixed',
                      width: '100%',
                      height: '36px',
                    }}
                  >
                    {/* COLUMN 1 (36%): Channel Number + Logo + Channel Name */}
                    <div
                      style={{
                        display: 'table-cell',
                        width: '36%',
                        verticalAlign: 'middle',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        paddingRight: '8px',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          width: '30px',
                          textAlign: 'right',
                          marginRight: '10px',
                          fontSize: '16px',
                          fontWeight: 700,
                          color: '#ffffff',
                          verticalAlign: 'middle',
                        }}
                      >
                        {idx + 1}
                      </span>

                      <span
                        style={{
                          display: 'inline-block',
                          width: '28px',
                          height: '22px',
                          marginRight: '10px',
                          backgroundColor: 'rgba(0, 0, 0, 0.75)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          textAlign: 'center',
                          lineHeight: '20px',
                          verticalAlign: 'middle',
                          overflow: 'hidden',
                          fontSize: '10px',
                          fontWeight: 800,
                          color: '#7dd3fc',
                        }}
                      >
                        {effectiveLogo ? (
                          <img
                            src={effectiveLogo}
                            alt=""
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              display: 'block',
                            }}
                          />
                        ) : (
                          <span>{shortBadge || 'TV'}</span>
                        )}
                      </span>

                      {isFav && (
                        <span
                          style={{
                            color: '#fbbf24',
                            marginRight: '6px',
                            fontSize: '14px',
                            verticalAlign: 'middle',
                          }}
                        >
                          ★
                        </span>
                      )}

                      <span
                        style={{
                          fontSize: '16px',
                          fontWeight: 700,
                          color: '#ffffff',
                          verticalAlign: 'middle',
                        }}
                      >
                        {ch.name}
                      </span>
                    </div>

                    {/* COLUMN 2 (50%): Green EPG Dot + Live Programme Title (What is playing right now) */}
                    <div
                      style={{
                        display: 'table-cell',
                        width: '50%',
                        verticalAlign: 'middle',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        paddingLeft: '6px',
                        paddingRight: '8px',
                      }}
                    >
                      {nowProg ? (
                        <>
                          <span
                            style={{
                              display: 'inline-block',
                              width: '8px',
                              height: '8px',
                              borderRadius: '9999px',
                              backgroundColor: '#34d399',
                              verticalAlign: 'middle',
                              marginRight: '8px',
                            }}
                          />
                          <span
                            style={{
                              fontSize: '15px',
                              fontWeight: 600,
                              color: isFocused ? '#fef08a' : '#f1f5f9',
                              verticalAlign: 'middle',
                            }}
                          >
                            {nowProg.title}
                          </span>
                        </>
                      ) : null}
                    </div>

                    {/* COLUMN 3 (14%): +Remaining Minutes + Compact Progress Bar */}
                    <div
                      style={{
                        display: 'table-cell',
                        width: '14%',
                        verticalAlign: 'middle',
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {nowProg ? (
                        <>
                          <span
                            style={{
                              display: 'inline-block',
                              verticalAlign: 'middle',
                              marginRight: '6px',
                              fontSize: '14px',
                              fontWeight: 600,
                              color: '#e2e8f0',
                            }}
                          >
                            +{stats.remainingMin}
                          </span>
                          <span
                            style={{
                              display: 'inline-block',
                              verticalAlign: 'middle',
                              width: '28px',
                              height: '8px',
                              backgroundColor: 'rgba(255, 255, 255, 0.22)',
                              border: '1px solid rgba(255, 255, 255, 0.6)',
                              overflow: 'hidden',
                            }}
                          >
                            <span
                              style={{
                                display: 'block',
                                height: '100%',
                                backgroundColor: '#ffffff',
                                width: `${stats.progress}%`,
                              }}
                            />
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom-Right Protruding Legend Tab: [ i Info | • Edit | • EPG | • A-Z | • Groups ] (Exact match to Photo 1) */}
      <div
        style={{
          backgroundColor: 'rgba(10, 14, 22, 0.96)',
          borderBottom: '2px solid #7dd3fc',
          borderLeft: '2px solid #7dd3fc',
          borderRight: '2px solid #7dd3fc',
        }}
        className="self-end bg-black/95 px-4 py-1 flex items-center gap-4 sm:gap-5 text-xs sm:text-[13px] font-bold text-white shrink-0"
      >
        <button
          type="button"
          data-osd-action-btn="true"
          onClick={() => {
            if (onToggleInfoPanel) onToggleInfoPanel();
            if (onCloseOverlay) onCloseOverlay();
          }}
          className="inline-flex items-center gap-1.5 hover:text-sky-300 cursor-pointer"
          title="Afișează bara Info jos"
        >
          <span className="px-1 py-0.2 bg-sky-200 text-black text-[10px] font-black">
            i
          </span>
          <span>Info</span>
        </button>

        <button
          type="button"
          data-osd-action-btn="true"
          onClick={toggleFavForFocusedChannel}
          className="inline-flex items-center gap-1.5 hover:text-sky-300 cursor-pointer"
          title="Adaugă / Elimină canalul selectat la Favorite (Tasta Roșie / F)"
        >
          <span className="w-2.5 h-2.5 bg-rose-500 inline-block" />
          <span>Fav</span>
        </button>

        <button
          type="button"
          data-osd-action-btn="true"
          onClick={openEpgForFocusedChannel}
          className="inline-flex items-center gap-1.5 hover:text-sky-300 cursor-pointer"
          title="Deschide EPG și Arhiva Catch-up (Tasta Verde / E)"
        >
          <span className="w-2.5 h-2.5 bg-emerald-400 inline-block" />
          <span>EPG</span>
        </button>

        <button
          type="button"
          data-osd-action-btn="true"
          onClick={() =>
            setSortMode((prev) => (prev === 'default' ? 'az' : 'default'))
          }
          className="inline-flex items-center gap-1.5 hover:text-sky-300 cursor-pointer"
          title="Sortează alfabetic A-Z (Tasta Galbenă / S)"
        >
          <span className="w-2.5 h-2.5 bg-amber-400 inline-block" />
          <span>{sortMode === 'az' ? 'A-Z ✓' : 'A-Z'}</span>
        </button>

        <button
          type="button"
          data-osd-action-btn="true"
          onClick={() => setIsGroupPickerOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 hover:text-sky-300 cursor-pointer"
          title="Alege Categoria sau Țara (Tasta Albastră / G / Săgeți Stânga-Dreapta)"
        >
          <span className="w-2.5 h-2.5 bg-blue-500 inline-block" />
          <span>Groups</span>
        </button>
      </div>
    </div>
  );
};
