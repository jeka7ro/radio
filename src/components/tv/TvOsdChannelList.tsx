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
import {
  loadSharedProfiles,
  loadSharedActiveProfileId,
  canProfileAccessIedem,
} from '../../services/deviceContinuityService';

const OSD_COUNTRY_TABS: Array<{
  id: string;
  label: string;
  country: string;
}> = [
  { id: 'IEDEM', label: 'iEdem / Playlist M3U', country: 'IEDEM' },
  { id: 'RO', label: 'RO • România', country: 'RO' },
  { id: 'MD', label: 'MD • Moldova', country: 'MD' },
  { id: 'RU', label: 'RU • Rusia', country: 'RU' },
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
  initialViewMode?: 'channels' | 'groups' | 'epg_detail' | 'epg';
  onToggleOverlayMode?: () => void;
  onToggleInfoPanel?: () => void;
  isInfoPanelOpen?: boolean;
  onCloseOverlay?: () => void;
  onSelectChannel?: (channel: TvChannel) => void;
  onPlayArchiveProgramme?: (channel: TvChannel, prog: EpgProgramme | null) => void;
}

export const TvOsdChannelList: React.FC<TvOsdChannelListProps> = ({
  currentChannel,
  channels,
  isOverlayMode = false,
  initialViewMode = 'channels',
  onCloseOverlay,
  onSelectChannel,
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
  const [iedemContentEnabled, setIedemContentEnabled] = useState<boolean>(() => {
    const profiles = loadSharedProfiles();
    const activeId = loadSharedActiveProfileId();
    const active = profiles.find((p) => p.id === activeId) || profiles[0];
    return canProfileAccessIedem(active);
  });

  useEffect(() => {
    const syncIedemPerm = () => {
      const profiles = loadSharedProfiles();
      const activeId = loadSharedActiveProfileId();
      const active = profiles.find((p) => p.id === activeId) || profiles[0];
      const allowed = canProfileAccessIedem(active);
      setIedemContentEnabled(allowed);
      if (!allowed) {
        setSelectedCountryId((prev) => (prev === 'IEDEM' ? 'RO' : prev));
      }
    };
    window.addEventListener('aether:active-profile-changed', syncIedemPerm);
    window.addEventListener('aether:profiles-updated', syncIedemPerm);
    return () => {
      window.removeEventListener('aether:active-profile-changed', syncIedemPerm);
      window.removeEventListener('aether:profiles-updated', syncIedemPerm);
    };
  }, []);

  // Subscribe to EPG service updates so rows re-render immediately when EPG XML feeds finish loading
  useChannelEpg(currentChannel);
  const epgRev = useEpgRevision();

  const [viewMode, setViewMode] = useState<
    'channels' | 'groups' | 'epg_detail' | 'epg'
  >(initialViewMode);
  const [, setIsGroupPickerOpen] = useState<boolean>(false);
  const [enteredFromGroups, setEnteredFromGroups] = useState<boolean>(false);
  const [focusedGroupIdx, setFocusedGroupIdx] = useState<number>(0);
  const [pendingDeleteFavChannel, setPendingDeleteFavChannel] =
    useState<TvChannel | null>(null);
  const [confirmFavBtnFocus, setConfirmFavBtnFocus] = useState<
    'confirm' | 'cancel'
  >('confirm');
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
    if (isQueueFavorites) {
      setSelectedThemeId('FAV');
    }
  }, [isQueueFavorites]);

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
  const [renderLimit, setRenderLimit] = useState<number>(45);
  const favoriteIdSet = useMemo(
    () => new Set(favoriteTvChannels.map((f) => f.id)),
    [favoriteTvChannels]
  );

  // Track which zone and channel row is currently highlighted in the Smart IPTV OSD
  const [focusZone, setFocusZone] = useState<
    'channels' | 'themes' | 'countries'
  >('channels');
  const [focusedRowIdx, setFocusedRowIdx] = useState<number>(0);

  // Smart IPTV EPG / Catch-up Archive View State (Photo 3)
  const [epgChannel, setEpgChannel] = useState<TvChannel>(currentChannel);
  const [epgProgrammes, setEpgProgrammes] = useState<EpgProgramme[]>([]);
  const [isEpgLoading, setIsEpgLoading] = useState<boolean>(false);
  const [selectedEpgDay, setSelectedEpgDay] = useState<string>('');
  const [focusedEpgIdx, setFocusedEpgIdx] = useState<number>(0);

  const countryRowRef = useRef<HTMLDivElement | null>(null);
  const themeRowRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const groupListContainerRef = useRef<HTMLDivElement | null>(null);
  const epgListContainerRef = useRef<HTMLDivElement | null>(null);
  const epgDetailContainerRef = useRef<HTMLDivElement | null>(null);
  const osdRootRef = useRef<HTMLDivElement | null>(null);
  const lastWheelStepAtRef = useRef<number>(0);
  const rowRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const groupRowRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const epgRowRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const confirmDeleteBtnRef = useRef<HTMLButtonElement | null>(null);
  const cancelDeleteBtnRef = useRef<HTMLButtonElement | null>(null);
  const mountedAtRef = useRef<number>(Date.now());
  const lastSelectAtRef = useRef<number>(0);
  const shouldAutoScrollRef = useRef<boolean>(true);
  const forceInitialFocusRef = useRef<boolean>(true);
  const clickedChannelIdRef = useRef<string>('');

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
          setCountryChannels(merged.slice(0, 4500));
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
        const base = list.slice(0, 4500);
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
      if (
        (ch.countryCode === 'RO' || ch.countryCode === 'MD') &&
        /rossteleccom\.net|iedem\.com/i.test(ch.url)
      ) {
        const roMdKey = 'GRP:RO / MD (moldovenească)';
        if (!map.has(roMdKey)) {
          map.set(roMdKey, []);
        }
        map.get(roMdKey)!.push(ch);
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
        title: 'Favourites',
        shortLabel: 'Favourites',
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

    const IEDEM_GROUP_ORDER = [
      'HD Orig',
      'новости',
      'кино',
      'музыка',
      'познавательные',
      'детские',
      'развлекательные',
      'спорт',
      'HD',
      '4K',
      'moldovenească',
      'другие',
      'взрослые',
    ];

    // Show official iEdem channel groups first when in IEDEM / RU / ALL_GLOBAL
    if (
      selectedCountryId === 'IEDEM' ||
      selectedCountryId === 'RU' ||
      selectedCountryId === 'ALL_GLOBAL' ||
      customTvChannels.length > 0
    ) {
      const addedGrpKeys = new Set<string>();
      for (const grpName of IEDEM_GROUP_ORDER) {
        const key = `GRP:${grpName}`;
        const list = thematicBuckets.get(key);
        if (list && list.length > 0) {
          if (!adultContentEnabled && /взросл|adult|xxx|18\+|эротик/i.test(grpName)) {
            continue;
          }
          addedGrpKeys.add(key);
          tabs.push({
            id: key,
            title: grpName,
            shortLabel: grpName,
            Icon: Layers,
            count: list.length,
          });
        }
      }
      for (const [key, list] of thematicBuckets.entries()) {
        if (key.startsWith('GRP:') && !addedGrpKeys.has(key) && list.length > 0) {
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
    } else {
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
    }

    return tabs;
  }, [
    pool.length,
    favoriteTvChannels.length,
    thematicBuckets,
    selectedCountryId,
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

    if (selectedThemeId !== 'FAV') {
      return [...baseList].sort(
        (a, b) => (b.resolutionHeight || 0) - (a.resolutionHeight || 0)
      );
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

  // Sync focusedRowIdx when currentChannel or group changes (without yanking scroll position on click!)
  useEffect(() => {
    if (clickedChannelIdRef.current === currentChannel.id) {
      clickedChannelIdRef.current = '';
      shouldAutoScrollRef.current = false;
    } else {
      shouldAutoScrollRef.current = true;
    }
    setFocusedRowIdx(currentChannelIdx);
  }, [currentChannel.id, selectedThemeId, selectedCountryId]);

  useEffect(() => {
    const onFocusFirstChannel = () => {
      forceInitialFocusRef.current = true;
      shouldAutoScrollRef.current = true;
      setViewMode('channels');
      setFocusZone('channels');
      setFocusedRowIdx(0);
      window.setTimeout(() => {
        const btn = rowRefs.current.get(0);
        btn?.focus({ preventScroll: true });
      }, 30);
    };
    window.addEventListener('aether:tv-enter-full-mode', onFocusFirstChannel);
    return () =>
      window.removeEventListener(
        'aether:tv-enter-full-mode',
        onFocusFirstChannel
      );
  }, []);

  useEffect(() => {
    if (focusedRowIdx + 30 > renderLimit) {
      setRenderLimit(focusedRowIdx + 100);
    }
  }, [focusedRowIdx, renderLimit]);

  // Auto-focus and keep focused row visible ONLY if it goes outside the visible viewport (never center-yank the list!)
  useEffect(() => {
    if (viewMode !== 'channels') return;
    const timer = window.setTimeout(() => {
      if (focusZone === 'countries' && countryRowRef.current) {
        const activeBtn = countryRowRef.current.querySelector<HTMLElement>(
          '[data-osd-country-active="true"]'
        );
        if (activeBtn) {
          activeBtn.scrollIntoView({ inline: 'center', block: 'nearest' });
          if (!isSearchBarOpen && !isOsdKeyboardOpen) {
            activeBtn.focus({ preventScroll: true });
          }
        }
        return;
      }
      if (focusZone === 'themes' && themeRowRef.current) {
        const activeBtn = themeRowRef.current.querySelector<HTMLElement>(
          '[data-osd-theme-active="true"]'
        );
        if (activeBtn) {
          activeBtn.scrollIntoView({ inline: 'center', block: 'nearest' });
          if (!isSearchBarOpen && !isOsdKeyboardOpen) {
            activeBtn.focus({ preventScroll: true });
          }
        }
        return;
      }
      if (!shouldAutoScrollRef.current) {
        return;
      }
      shouldAutoScrollRef.current = false;
      const btn = rowRefs.current.get(focusedRowIdx);
      const container = listContainerRef.current;
      if (btn && container) {
        const btnTop = btn.offsetTop;
        const btnBottom = btnTop + btn.offsetHeight;
        const viewTop = container.scrollTop;
        const viewBottom = viewTop + container.clientHeight;
        if (btnTop < viewTop + 4) {
          container.scrollTop = Math.max(0, btnTop - 6);
        } else if (btnBottom > viewBottom - 4) {
          container.scrollTop = btnBottom - container.clientHeight + 6;
        }
        const activeEl = document.activeElement as HTMLElement | null;
        const isInSidebarOrHeader = Boolean(
          !isOverlayMode &&
            !forceInitialFocusRef.current &&
            (activeEl?.closest('aside') || activeEl?.closest('header'))
        );
        if (
          !isSearchBarOpen &&
          !isOsdKeyboardOpen &&
          focusZone === 'channels' &&
          !isInSidebarOrHeader
        ) {
          forceInitialFocusRef.current = false;
          btn.focus({ preventScroll: true });
        }
      }
    }, 25);
    return () => window.clearTimeout(timer);
  }, [
    focusZone,
    focusedRowIdx,
    viewMode,
    selectedThemeId,
    selectedCountryId,
    isSearchBarOpen,
    isOsdKeyboardOpen,
  ]);

  // Load EPG Archive whenever viewMode === 'epg' or 'epg_detail'
  useEffect(() => {
    if (viewMode !== 'epg' && viewMode !== 'epg_detail') return;
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

  // Keep focusedGroupIdx synced when opening 'groups' viewMode
  useEffect(() => {
    if (viewMode !== 'groups') return;
    const idx = themeTabs.findIndex((t) => t.id === selectedThemeId);
    setFocusedGroupIdx(idx >= 0 ? idx : 0);
  }, [viewMode, themeTabs, selectedThemeId]);

  // Auto-scroll and focus active group row + active country pill when in 'groups' viewMode
  useEffect(() => {
    if (viewMode !== 'groups') return;
    const timer = window.setTimeout(() => {
      if (countryRowRef.current) {
        const activeCountryBtn =
          countryRowRef.current.querySelector<HTMLElement>(
            '[data-osd-country-active="true"]'
          );
        activeCountryBtn?.scrollIntoView({
          inline: 'center',
          block: 'nearest',
        });
      }
      const btn = groupRowRefs.current.get(focusedGroupIdx);
      const container = groupListContainerRef.current;
      if (btn && container) {
        const targetTop =
          btn.offsetTop - container.clientHeight / 2 + btn.clientHeight / 2;
        container.scrollTo({
          top: Math.max(0, targetTop),
          behavior: 'auto',
        });
        btn.focus();
      }
    }, 25);
    return () => window.clearTimeout(timer);
  }, [focusedGroupIdx, viewMode, selectedCountryId]);

  // Focus confirm/cancel button when Favorite Deletion Confirmation Modal is open
  useEffect(() => {
    if (!pendingDeleteFavChannel) return;
    const timer = window.setTimeout(() => {
      if (confirmFavBtnFocus === 'confirm') {
        confirmDeleteBtnRef.current?.focus();
      } else {
        cancelDeleteBtnRef.current?.focus();
      }
    }, 25);
    return () => window.clearTimeout(timer);
  }, [pendingDeleteFavChannel, confirmFavBtnFocus]);

  // Intercept TV Remote Back ('aether:tv-player-back') when inside modal / sub-view / group channels
  useEffect(() => {
    const onTvPlayerBackCapture = (e: Event) => {
      if (pendingDeleteFavChannel) {
        e.stopImmediatePropagation();
        setPendingDeleteFavChannel(null);
        return;
      }
      if (isSearchBarOpen || isOsdKeyboardOpen) {
        e.stopImmediatePropagation();
        setIsSearchBarOpen(false);
        setIsOsdKeyboardOpen(false);
        return;
      }
      if (viewMode === 'epg_detail' || viewMode === 'epg') {
        e.stopImmediatePropagation();
        setViewMode('channels');
        return;
      }
      if (viewMode === 'groups') {
        e.stopImmediatePropagation();
        setEnteredFromGroups(false);
        setViewMode('channels');
        return;
      }
      if (viewMode === 'channels' && enteredFromGroups) {
        e.stopImmediatePropagation();
        setViewMode('groups');
        return;
      }
    };
    window.addEventListener('aether:tv-player-back', onTvPlayerBackCapture, true);
    return () =>
      window.removeEventListener(
        'aether:tv-player-back',
        onTvPlayerBackCapture,
        true
      );
  }, [
    pendingDeleteFavChannel,
    isSearchBarOpen,
    isOsdKeyboardOpen,
    viewMode,
    enteredFromGroups,
  ]);

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

  const visibleCountryTabs = useMemo(
    () =>
      OSD_COUNTRY_TABS.filter(
        (reg) =>
          (adultContentEnabled || reg.id !== 'ADULT') &&
          (iedemContentEnabled || reg.id !== 'IEDEM')
      ),
    [adultContentEnabled, iedemContentEnabled]
  );

  const cycleCountrySource = (dir: -1 | 1) => {
    if (visibleCountryTabs.length <= 1) return;
    const curIdx = Math.max(
      0,
      visibleCountryTabs.findIndex((c) => c.id === selectedCountryId)
    );
    const nextIdx =
      (curIdx + dir + visibleCountryTabs.length) % visibleCountryTabs.length;
    setHasSwitchedCountry(true);
    setSelectedCountryId(visibleCountryTabs[nextIdx].id);
  };

  const pageSize = 10;
  const totalGroupPages = Math.max(1, Math.ceil(flatChannels.length / pageSize));
  const currentGroupPage = Math.min(
    totalGroupPages,
    Math.floor(focusedRowIdx / pageSize) + 1
  );

  const changeGroupPage = (dir: -1 | 1) => {
    if (flatChannels.length === 0) return;
    shouldAutoScrollRef.current = true;
    setFocusZone('channels');
    setFocusedRowIdx((prev) => {
      let nextIdx = prev + dir * pageSize;
      if (dir > 0) {
        if (prev >= flatChannels.length - 1) {
          nextIdx = 0;
        } else if (nextIdx >= flatChannels.length) {
          nextIdx = flatChannels.length - 1;
        }
      } else {
        if (prev <= 0) {
          nextIdx = flatChannels.length - 1;
        } else if (nextIdx < 0) {
          nextIdx = 0;
        }
      }
      if (nextIdx + 30 > renderLimit && renderLimit < flatChannels.length) {
        setRenderLimit((lim) =>
          Math.min(flatChannels.length, Math.max(lim + 140, nextIdx + 100))
        );
      }
      return nextIdx;
    });
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

  // Green Button (404 / E): Detailed EPG for focused channel
  const openDetailedEpgForFocusedChannel = () => {
    const targetCh = flatChannels[focusedRowIdx] || currentChannel;
    setEpgChannel(targetCh);
    setViewMode('epg_detail');
  };

  // Yellow Button (405 / Y / A): 7-Day Catch-Up TV Archive for focused channel
  const openArchiveForFocusedChannel = () => {
    const targetCh = flatChannels[focusedRowIdx] || currentChannel;
    setEpgChannel(targetCh);
    setViewMode('epg');
  };

  // Blue Button (406 / G / B): Open Playlists & Groups list
  const openGroupsView = () => {
    const idx = themeTabs.findIndex((t) => t.id === selectedThemeId);
    setFocusedGroupIdx(idx >= 0 ? idx : 0);
    setViewMode((prev) => (prev === 'groups' ? 'channels' : 'groups'));
  };

  // Red Button (403 / R / F): Remove from Favorites with Confirmation (or Add to Favorites if not favorite)
  const triggerRedFavActionForFocusedChannel = () => {
    const targetCh = flatChannels[focusedRowIdx] || currentChannel;
    if (!targetCh) return;
    const isFav = favoriteTvChannels.some(
      (f) => f.id === targetCh.id || f.url === targetCh.url
    );
    if (isFav) {
      setConfirmFavBtnFocus('confirm');
      setPendingDeleteFavChannel(targetCh);
    } else {
      toggleFavoriteTvChannel(targetCh);
    }
  };

  const selectChannelRow = (
    targetCh: TvChannel | undefined,
    fromMouseClick = false
  ) => {
    if (!targetCh) return;
    const now = Date.now();
    if (isOverlayMode && !fromMouseClick && now - mountedAtRef.current < 300) return;
    if (!fromMouseClick && now - lastSelectAtRef.current < 250) return;
    lastSelectAtRef.current = now;
    const isSameLiveChannel =
      targetCh.id === currentChannel.id &&
      !targetCh.archiveProgram &&
      !currentChannel.archiveProgram;
    if (!isSameLiveChannel) {
      const activePlaylistQueue =
        flatChannels.length > 0 ? flatChannels : pool;
      playTvChannel(targetCh, activePlaylistQueue);
    }
    if (onSelectChannel) {
      onSelectChannel(targetCh);
    }
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

    // In fixed split-view mode, let sidebar and top header handle their own navigation when focused
    if (
      !isOverlayMode &&
      !pendingDeleteFavChannel &&
      (target?.closest('aside') || target?.closest('header'))
    ) {
      return;
    }

    const isOkKey =
      e.key === 'Enter' ||
      e.key === 'Select' ||
      e.key === 'Execute' ||
      e.key === ' ' ||
      e.keyCode === 13 ||
      e.keyCode === 29443;

    const isBackKey =
      e.key === 'Escape' ||
      (e.key === 'Backspace' && !isInsideInput) ||
      e.keyCode === 461 ||
      e.keyCode === 10009;

    // 0. Favorite Deletion Confirmation Modal Intercept
    if (pendingDeleteFavChannel) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        setConfirmFavBtnFocus((prev) =>
          prev === 'confirm' ? 'cancel' : 'confirm'
        );
        return;
      }
      if (isOkKey) {
        e.preventDefault();
        e.stopPropagation();
        if (confirmFavBtnFocus === 'confirm') {
          toggleFavoriteTvChannel(pendingDeleteFavChannel);
        }
        setPendingDeleteFavChannel(null);
        return;
      }
      if (isBackKey || e.keyCode === 403) {
        e.preventDefault();
        e.stopPropagation();
        setPendingDeleteFavChannel(null);
        return;
      }
      return;
    }

    // 1. EPG DETAIL VIEW (Green Button)
    if (viewMode === 'epg_detail') {
      if (
        isBackKey ||
        e.keyCode === 404 ||
        e.key === 'e' ||
        e.key === 'E'
      ) {
        e.preventDefault();
        e.stopPropagation();
        setViewMode('channels');
        return;
      }
      if (
        e.keyCode === 405 ||
        e.key === 'y' ||
        e.key === 'Y' ||
        e.key === 'a' ||
        e.key === 'A'
      ) {
        e.preventDefault();
        e.stopPropagation();
        setViewMode('epg');
        return;
      }
      if (
        e.keyCode === 406 ||
        e.key === 'g' ||
        e.key === 'G' ||
        e.key === 'b' ||
        e.key === 'B'
      ) {
        e.preventDefault();
        e.stopPropagation();
        openGroupsView();
        return;
      }
      return;
    }

    // 2. ARCHIVE EPG VIEW (Yellow Button)
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
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        cycleEpgDay(-1);
        return;
      }
      if (e.key === 'ArrowRight') {
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
        isBackKey ||
        e.keyCode === 405 ||
        e.key === 'y' ||
        e.key === 'Y' ||
        e.key === 'a' ||
        e.key === 'A'
      ) {
        e.preventDefault();
        e.stopPropagation();
        setViewMode('channels');
        return;
      }
      if (e.keyCode === 404 || e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        e.stopPropagation();
        setViewMode('epg_detail');
        return;
      }
      return;
    }

    // 3. GROUPS / PLAYLISTS VIEW (Blue Button)
    if (viewMode === 'groups') {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedGroupIdx((prev) =>
          themeTabs.length > 0 ? (prev + 1) % themeTabs.length : 0
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedGroupIdx((prev) =>
          themeTabs.length > 0
            ? (prev - 1 + themeTabs.length) % themeTabs.length
            : 0
        );
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        cycleCountrySource(-1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        cycleCountrySource(1);
        return;
      }
      if (isOkKey) {
        e.preventDefault();
        e.stopPropagation();
        const targetGroup = themeTabs[focusedGroupIdx];
        if (targetGroup) {
          setSelectedThemeId(targetGroup.id);
          setEnteredFromGroups(true);
          setFocusZone('channels');
          setFocusedRowIdx(0);
          shouldAutoScrollRef.current = true;
          setViewMode('channels');
        }
        return;
      }
      if (
        isBackKey ||
        e.keyCode === 406 ||
        e.key === 'g' ||
        e.key === 'G' ||
        e.key === 'b' ||
        e.key === 'B'
      ) {
        e.preventDefault();
        e.stopPropagation();
        setEnteredFromGroups(false);
        setViewMode('channels');
        return;
      }
      return;
    }

    // When Search/Keyboard is open, let standard focus handle it unless pressing Escape/Back
    if (isSearchBarOpen || isOsdKeyboardOpen) {
      if (isBackKey) {
        e.preventDefault();
        e.stopPropagation();
        setIsSearchBarOpen(false);
        setIsOsdKeyboardOpen(false);
      }
      return;
    }

    // Back key inside channel list when entered from a Group -> return to Groups list!
    if (isBackKey && enteredFromGroups) {
      e.preventDefault();
      e.stopPropagation();
      setViewMode('groups');
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
      shouldAutoScrollRef.current = true;
      setFocusZone('channels');
      setFocusedRowIdx((prev) =>
        flatChannels.length > 0 ? (prev + 1) % flatChannels.length : 0
      );
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      if (!isOverlayMode && focusedRowIdx === 0) {
        const headerBtn =
          document.querySelector<HTMLElement>(
            'header [data-header-lang-btn="true"]'
          ) ||
          document.querySelector<HTMLElement>(
            'header [data-header-search-btn="true"]'
          ) ||
          document.querySelector<HTMLElement>('header button');
        if (headerBtn) {
          headerBtn.focus({ preventScroll: true });
          return;
        }
      }
      shouldAutoScrollRef.current = true;
      setFocusZone('channels');
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
      changeGroupPage(1);
      return;
    }

    if (e.key === 'PageUp' || e.keyCode === 33 || e.keyCode === 427) {
      e.preventDefault();
      e.stopPropagation();
      changeGroupPage(-1);
      return;
    }

    // Left / Right Arrow changes Page within the current Group (never switches the group itself)
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      changeGroupPage(-1);
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      changeGroupPage(1);
      return;
    }

    // Color keys & shortcuts:
    // RED (403 / R / F) = Delete from Favorites with confirmation (or Add to Favorites)
    if (
      e.keyCode === 403 ||
      e.key === 'f' ||
      e.key === 'F' ||
      e.key === 'r' ||
      e.key === 'R'
    ) {
      e.preventDefault();
      e.stopPropagation();
      triggerRedFavActionForFocusedChannel();
      return;
    }
    // GREEN (404 / E) = Detailed EPG
    if (e.keyCode === 404 || e.key === 'e' || e.key === 'E') {
      e.preventDefault();
      e.stopPropagation();
      openDetailedEpgForFocusedChannel();
      return;
    }
    // YELLOW (405 / Y / A) = 7-Day Catch-Up TV Archive
    if (
      e.keyCode === 405 ||
      e.key === 'y' ||
      e.key === 'Y' ||
      e.key === 'a' ||
      e.key === 'A'
    ) {
      e.preventDefault();
      e.stopPropagation();
      openArchiveForFocusedChannel();
      return;
    }
    // BLUE (406 / G / B) = Groups / Playlists
    if (
      e.keyCode === 406 ||
      e.key === 'g' ||
      e.key === 'G' ||
      e.key === 'b' ||
      e.key === 'B'
    ) {
      e.preventDefault();
      e.stopPropagation();
      openGroupsView();
      return;
    }
  };

  const handleOsdWheelEvent = (e: WheelEvent) => {
    if (pendingDeleteFavChannel) return;
    const target = e.target as HTMLElement | null;
    const isTvFullModeActive = Boolean(
      document.querySelector('#aether-tv-player-modal[data-full-mode="true"]')
    );
    const isInsideOsd = Boolean(
      osdRootRef.current && target && osdRootRef.current.contains(target)
    );
    const isInsideTvModal = Boolean(
      target?.closest('#aether-tv-player-modal')
    );

    if (!isInsideOsd && !isInsideTvModal && !isTvFullModeActive && !isOverlayMode) {
      return;
    }
    if (
      !isTvFullModeActive &&
      !isOverlayMode &&
      (target?.closest('aside') || target?.closest('header'))
    ) {
      return;
    }

    const legacyWheelDelta = (e as unknown as { wheelDelta?: number }).wheelDelta;
    const rawDelta =
      Math.abs(e.deltaY) >= Math.abs(e.deltaX) && e.deltaY !== 0
        ? e.deltaY
        : e.deltaX !== 0
          ? e.deltaX
          : typeof legacyWheelDelta === 'number'
            ? -legacyWheelDelta
            : 0;

    if (rawDelta === 0) return;

    e.preventDefault();
    e.stopPropagation();

    const now = Date.now();
    if (now - lastWheelStepAtRef.current < 28) {
      return;
    }
    lastWheelStepAtRef.current = now;

    const dir: 1 | -1 = rawDelta > 0 ? 1 : -1;
    const step = Math.abs(rawDelta) > 150 ? 2 : 1;

    if (viewMode === 'epg_detail') {
      if (epgDetailContainerRef.current) {
        epgDetailContainerRef.current.scrollTop += dir * 96;
      }
      return;
    }

    if (viewMode === 'groups') {
      if (themeTabs.length > 0) {
        setFocusedGroupIdx((prev) =>
          Math.max(0, Math.min(themeTabs.length - 1, prev + dir * step))
        );
      }
      return;
    }

    if (viewMode === 'epg') {
      if (dayProgrammes.length > 0) {
        setFocusedEpgIdx((prev) =>
          Math.max(0, Math.min(dayProgrammes.length - 1, prev + dir * step))
        );
      }
      return;
    }

    // Default viewMode === 'channels'
    if (flatChannels.length > 0) {
      shouldAutoScrollRef.current = true;
      setFocusZone('channels');
      setFocusedRowIdx((prev) => {
        const next = Math.max(
          0,
          Math.min(flatChannels.length - 1, prev + dir * step)
        );
        if (next + 30 > renderLimit && renderLimit < flatChannels.length) {
          setRenderLimit((lim) =>
            Math.min(flatChannels.length, Math.max(lim + 140, next + 100))
          );
        }
        return next;
      });
    }
  };

  const osdHandlersRef = useRef<{
    key: (e: KeyboardEvent) => void;
    wheel: (e: WheelEvent) => void;
  }>({
    key: () => {},
    wheel: () => {},
  });
  osdHandlersRef.current.key = handleOsdKeyEvent;
  osdHandlersRef.current.wheel = handleOsdWheelEvent;

  useEffect(() => {
    const onWinKeyDown = (e: KeyboardEvent) => {
      osdHandlersRef.current.key(e);
    };
    const onWinWheel = (e: WheelEvent) => {
      osdHandlersRef.current.wheel(e);
    };
    window.addEventListener('keydown', onWinKeyDown, true);
    window.addEventListener('wheel', onWinWheel, {
      passive: false,
      capture: true,
    });
    return () => {
      window.removeEventListener('keydown', onWinKeyDown, true);
      window.removeEventListener('wheel', onWinWheel, true);
    };
  }, []);

  const handleOsdKeyDown = (_e: React.KeyboardEvent<HTMLDivElement>) => {
    // Handled via window capture listener above for both overlay and fixed split-view
  };

  // ============================================================================
  // VIEW MODE 4: DETAILED EPG VIEW (GREEN BUTTON)
  // ============================================================================
  if (viewMode === 'epg_detail') {
    const epgChInfo = resolveChannelEpg(epgChannel);
    const epgLogo =
      !epgChannel.logo || /imgur\.com|wikia\.nocookie\.net/i.test(epgChannel.logo)
        ? epgChInfo?.icon || epgChannel.logo
        : epgChannel.logo;
    const nowProg = epgChInfo?.now;
    const stats = getEpgTimingStats(nowProg);
    const upcomingList = epgChInfo?.upcoming || [];

    return (
      <div
        ref={osdRootRef}
        data-osd-subview="true"
        onKeyDown={handleOsdKeyDown}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: isOverlayMode ? '24px' : '0px',
          backgroundColor: isOverlayMode ? 'rgba(10, 15, 28, 0.94)' : '#090d16',
          border: isOverlayMode ? '1px solid rgba(148, 163, 184, 0.22)' : 'none',
          boxShadow: isOverlayMode ? '0 28px 80px rgba(0, 0, 0, 0.85)' : 'none',
        }}
        className={`w-full h-full min-h-0 ${
          isOverlayMode ? 'rounded-3xl backdrop-blur-2xl' : 'rounded-none'
        } flex flex-col select-none text-white overflow-hidden`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-white/[0.04] border-b border-white/10 shrink-0">
          <div className="inline-flex items-center gap-3 min-w-0">
            {epgLogo && (
              <div className="w-9 h-7 rounded-lg bg-white/10 border border-white/15 p-1 flex items-center justify-center shrink-0">
                <img
                  src={epgLogo}
                  alt=""
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-base font-extrabold text-white tracking-tight truncate">
                {epgChannel.name}
              </div>
              <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                EPG Detaliat • Informații Emisiune
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setViewMode('channels')}
            className="px-3.5 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/15 border border-white/15 text-xs font-bold text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            ← Înapoi
          </button>
        </div>

        {/* Detailed Current Show & Upcoming Schedule */}
        <div
          ref={epgDetailContainerRef}
          className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-5 space-y-5"
        >
          {nowProg ? (
            <div className="rounded-2xl bg-gradient-to-br from-emerald-500/15 via-sky-500/10 to-white/[0.03] border border-emerald-400/30 p-5 space-y-3.5 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500 text-zinc-950 uppercase">
                  ● ACUM ÎN DIRECT
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-sky-300 tabular-nums">
                  {formatEpgTime(nowProg.start)} – {formatEpgTime(nowProg.stop)}{' '}
                  <span className="text-emerald-300 ml-1">
                    (+{stats.remainingMin} min rămase)
                  </span>
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-extrabold text-white leading-snug">
                {nowProg.title}
              </h3>

              {nowProg.category && (
                <div className="inline-block px-2.5 py-0.5 rounded-md bg-white/10 text-zinc-200 text-xs font-semibold">
                  {nowProg.category}
                </div>
              )}

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-all"
                  style={{ width: `${stats.progress}%` }}
                />
              </div>

              {nowProg.desc ? (
                <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-line pt-1">
                  {nowProg.desc}
                </p>
              ) : (
                <p className="text-xs italic text-zinc-400 pt-1">
                  Nu există descriere suplimentară pentru această emisiune în grila EPG.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-6 text-center text-sm text-zinc-400">
              Nu există informații EPG pentru emisiunea curentă pe acest canal.
            </div>
          )}

          {/* Upcoming Today */}
          {upcomingList.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 px-1">
                Urmează în program ({upcomingList.length})
              </h4>
              <div className="space-y-2">
                {upcomingList.map((prog, idx) => (
                  <div
                    key={`${prog.start}_${idx}`}
                    className="rounded-xl bg-white/[0.04] border border-white/10 p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-sky-300 tabular-nums">
                        {formatEpgTime(prog.start)} – {formatEpgTime(prog.stop)}
                      </span>
                      {prog.category && (
                        <span className="text-[11px] font-semibold text-zinc-400">
                          {prog.category}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-bold text-white">
                      {prog.title}
                    </div>
                    {prog.desc && (
                      <p className="text-xs text-zinc-300/90 leading-relaxed">
                        {prog.desc}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Legend Bar */}
        <div className="border-t border-white/10 bg-black/40 px-4 py-2.5 flex items-center justify-between gap-2 text-xs font-bold text-zinc-200 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('channels')}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.08] hover:bg-white/15 text-white whitespace-nowrap cursor-pointer"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
            <span>Înapoi la Canale</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('epg')}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.08] hover:bg-white/15 text-white whitespace-nowrap cursor-pointer"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            <span>Deschide Arhiva TV</span>
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW MODE 3: GROUPS / PLAYLISTS MODAL VIEW (BLUE BUTTON)
  // ============================================================================
  if (viewMode === 'groups') {
    return (
      <div
        ref={osdRootRef}
        data-osd-subview="true"
        onKeyDown={handleOsdKeyDown}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: isOverlayMode ? '24px' : '0px',
          backgroundColor: isOverlayMode ? 'rgba(10, 15, 28, 0.94)' : '#090d16',
          border: isOverlayMode ? '1px solid rgba(148, 163, 184, 0.22)' : 'none',
          boxShadow: isOverlayMode ? '0 28px 80px rgba(0, 0, 0, 0.85)' : 'none',
        }}
        className={`w-full h-full min-h-0 ${
          isOverlayMode ? 'rounded-3xl backdrop-blur-2xl' : 'rounded-none'
        } flex flex-col select-none text-white overflow-hidden`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 bg-white/[0.04] border-b border-white/10 shrink-0">
          <div className="inline-flex items-center gap-2.5 min-w-0">
            <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
            <span className="text-sm sm:text-base font-extrabold text-white truncate">
              Grupuri & Playlist-uri TV
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setEnteredFromGroups(false);
              setViewMode('channels');
            }}
            className="px-3 py-1 rounded-full bg-white/[0.08] hover:bg-white/15 border border-white/15 text-xs font-bold text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            ← Înapoi
          </button>
        </div>

        {/* Country / Source Row (Switchable with Left / Right Arrows or Click) */}
        <div className="px-4 py-2.5 bg-black/30 border-b border-white/10 shrink-0">
          <div className="text-[11px] font-bold text-zinc-400 mb-1.5 flex items-center justify-between">
            <span>Sursa / Țara (Săgeți ◀ ▶):</span>
            {isLoadingCountry && (
              <span className="text-sky-400">Se încarcă...</span>
            )}
          </div>
          <div
            ref={countryRowRef}
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar"
          >
            {visibleCountryTabs.map((reg) => {
              const active = selectedCountryId === reg.id;
              return (
                <button
                  key={`grp_country_${reg.id}`}
                  type="button"
                  data-osd-country-active={active ? 'true' : undefined}
                  onClick={() => {
                    setHasSwitchedCountry(true);
                    setSelectedCountryId(reg.id);
                    setFocusedGroupIdx(0);
                  }}
                  className={`h-8 px-3.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 border transition-all cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-blue-600 to-sky-500 text-white border-sky-300/60 shadow-[0_0_14px_rgba(56,189,248,0.35)]'
                      : 'bg-white/[0.06] text-zinc-300 border-white/10 hover:bg-white/[0.12] hover:text-white'
                  }`}
                >
                  {reg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Numbered List of Groups / Categories */}
        <div
          ref={groupListContainerRef}
          className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-2 space-y-1"
        >
          {themeTabs.map((grp, idx) => {
            const isFocused = idx === focusedGroupIdx;
            const isSelected = grp.id === selectedThemeId;
            const isFavGrp = grp.id === 'FAV';

            return (
              <button
                key={`group_item_${grp.id}`}
                type="button"
                ref={(el) => {
                  if (el) groupRowRefs.current.set(idx, el);
                  else groupRowRefs.current.delete(idx);
                }}
                onFocus={() => setFocusedGroupIdx(idx)}
                onClick={() => {
                  setSelectedThemeId(grp.id);
                  setEnteredFromGroups(true);
                  setFocusZone('channels');
                  setFocusedRowIdx(0);
                  shouldAutoScrollRef.current = true;
                  setViewMode('channels');
                }}
                className={`w-full h-[44px] px-4 rounded-xl flex items-center justify-between gap-3 text-left transition-all cursor-pointer outline-none border ${
                  isFocused
                    ? 'bg-gradient-to-r from-blue-600/85 to-sky-500/75 border-sky-300/80 text-white shadow-[0_6px_20px_rgba(14,165,233,0.3)]'
                    : isSelected
                      ? 'bg-white/10 border-white/20 text-white'
                      : 'bg-transparent border-transparent hover:bg-white/[0.06] text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 text-right text-xs font-bold text-zinc-400 tabular-nums shrink-0">
                    {idx + 1}
                  </span>
                  {isFavGrp ? (
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                  ) : (
                    <Tv className="w-4 h-4 text-sky-400 shrink-0" />
                  )}
                  <span className="text-[15px] font-bold truncate">
                    {grp.shortLabel}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold tabular-nums ${
                      isFocused
                        ? 'bg-white/25 text-white'
                        : 'bg-white/[0.08] text-sky-300'
                    }`}
                  >
                    {grp.count} canale
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom Footer */}
        <div className="border-t border-white/10 bg-black/40 px-4 py-2.5 flex items-center justify-between gap-2 text-xs font-bold text-zinc-300 shrink-0">
          <span className="text-[11px] text-zinc-400 truncate">
            ▲▼ Alege grupul • OK intră în canale • Back iese înapoi
          </span>
          <button
            type="button"
            onClick={() => {
              setEnteredFromGroups(false);
              setViewMode('channels');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.08] hover:bg-white/15 text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            <span>Închide Grupuri</span>
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW MODE 2: MODERN ROUNDED LIQUID GLASS EPG & CATCH-UP ARCHIVE WINDOW (YELLOW BUTTON)
  // ============================================================================
  if (viewMode === 'epg') {
    const epgChInfo = resolveChannelEpg(epgChannel);
    const epgLogo =
      !epgChannel.logo || /imgur\.com|wikia\.nocookie\.net/i.test(epgChannel.logo)
        ? epgChInfo?.icon || epgChannel.logo
        : epgChannel.logo;

    return (
      <div
        ref={osdRootRef}
        data-osd-subview="true"
        onKeyDown={handleOsdKeyDown}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: isOverlayMode ? '24px' : '0px',
          backgroundColor: isOverlayMode ? 'rgba(10, 15, 28, 0.94)' : '#090d16',
          border: isOverlayMode ? '1px solid rgba(148, 163, 184, 0.22)' : 'none',
          boxShadow: isOverlayMode ? '0 28px 80px rgba(0, 0, 0, 0.85)' : 'none',
        }}
        className={`w-full h-full min-h-0 ${
          isOverlayMode ? 'rounded-3xl backdrop-blur-2xl' : 'rounded-none'
        } flex flex-col select-none text-white overflow-hidden`}
      >
        {/* Top Header Bar: Channel Name + Day Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-white/[0.04] border-b border-white/10 shrink-0">
          <div className="inline-flex items-center gap-3 min-w-0">
            {epgLogo && (
              <div className="w-9 h-7 rounded-lg bg-white/10 border border-white/15 p-1 flex items-center justify-center shrink-0">
                <img
                  src={epgLogo}
                  alt=""
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            <span className="text-base sm:text-lg font-extrabold text-white tracking-tight truncate">
              {epgChannel.name} • 🟡 Arhivă TV
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {epgDays.map((dayKey) => {
              const activeDay = dayKey === selectedEpgDay;
              return (
                <button
                  key={dayKey}
                  type="button"
                  data-osd-action-btn="true"
                  onClick={() => setSelectedEpgDay(dayKey)}
                  className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap shrink-0 border transition-all cursor-pointer ${
                    activeDay
                      ? 'bg-gradient-to-r from-blue-600 to-sky-500 text-white border-sky-300/60 shadow-[0_0_14px_rgba(56,189,248,0.35)]'
                      : 'bg-white/[0.06] text-zinc-300 border-white/10 hover:bg-white/[0.12] hover:text-white'
                  }`}
                >
                  {formatEpgDayLabel(dayKey)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main EPG Programme List */}
        <div
          ref={epgListContainerRef}
          style={{
            flex: '1 1 0%',
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '8px',
          }}
          className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-1"
        >
          {isEpgLoading ? (
            <div className="py-20 text-center text-sm font-semibold text-zinc-300">
              Se încarcă programul EPG și Arhiva TV...
            </div>
          ) : dayProgrammes.length === 0 ? (
            <div className="py-20 text-center text-sm text-zinc-400">
              Nu există arhivă disponibilă pentru acest canal.
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
                  className={`w-full h-[42px] px-4 rounded-xl flex items-center justify-between gap-4 text-left transition-all cursor-pointer outline-none border ${
                    isFocused
                      ? 'bg-gradient-to-r from-blue-600/80 to-sky-500/70 border-sky-300/70 text-white shadow-[0_4px_16px_rgba(14,165,233,0.3)]'
                      : isLiveNow
                        ? 'bg-white/10 border-white/15 text-white'
                        : 'bg-transparent border-transparent hover:bg-white/[0.06] text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <span className="w-32 shrink-0 text-[14px] sm:text-[15px] font-bold text-sky-200/90 tabular-nums">
                      {formatEpgTime(prog.start)} - {formatEpgTime(prog.stop)}
                    </span>
                    <span className="text-[15px] sm:text-base font-semibold text-white truncate">
                      {prog.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isLiveNow && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500 text-zinc-950 uppercase">
                        LIVE
                      </span>
                    )}
                    {(isPast || isLiveNow) && (
                      <span
                        title="Disponibil în Arhiva Catch-up"
                        className="px-2 py-1 rounded-full border border-sky-400/40 bg-sky-500/15 text-sky-200 inline-flex items-center justify-center"
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

        {/* Bottom Footer Bar */}
        <div className="border-t border-white/10 bg-black/40 px-5 py-2.5 flex items-center justify-end gap-4 text-xs sm:text-[13px] font-bold text-zinc-200 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('channels')}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/15 text-white whitespace-nowrap cursor-pointer"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            <span>Înapoi la Canale</span>
          </button>
          <button
            type="button"
            onClick={() => cycleEpgDay(-1)}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/15 text-white whitespace-nowrap cursor-pointer"
          >
            <span>◀ Ziua -</span>
          </button>
          <button
            type="button"
            onClick={() => cycleEpgDay(1)}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/15 text-white whitespace-nowrap cursor-pointer"
          >
            <span>Ziua + ▶</span>
          </button>
        </div>
      </div>
    );
  }

  // Determine focused channel favorite state for the bottom Red button label
  const focusedChannelObj = flatChannels[focusedRowIdx] || currentChannel;
  const isFocusedChannelFav = Boolean(
    focusedChannelObj &&
      favoriteTvChannels.some(
        (f) => f.id === focusedChannelObj.id || f.url === focusedChannelObj.url
      )
  );

  // ============================================================================
  // VIEW MODE 1: MODERN ROUNDED LIQUID GLASS CHANNEL LIST WINDOW
  // ============================================================================
  return (
    <div
      ref={osdRootRef}
      data-osd-subview={
        pendingDeleteFavChannel ||
        isSearchBarOpen ||
        isOsdKeyboardOpen ||
        enteredFromGroups
          ? 'true'
          : 'false'
      }
      data-tv-osd-search-open={
        isSearchBarOpen || isOsdKeyboardOpen ? 'true' : 'false'
      }
      onKeyDown={handleOsdKeyDown}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: isOverlayMode ? '24px' : '0px',
        backgroundColor: isOverlayMode ? 'rgba(10, 15, 28, 0.94)' : '#090d16',
        border: isOverlayMode ? '1px solid rgba(148, 163, 184, 0.22)' : 'none',
        boxShadow: isOverlayMode ? '0 28px 80px rgba(0, 0, 0, 0.85)' : 'none',
        position: 'relative',
      }}
      className={`w-full h-full min-h-0 ${
        isOverlayMode ? 'rounded-3xl backdrop-blur-2xl' : 'rounded-none'
      } flex flex-col select-none text-white overflow-hidden relative`}
    >
      {/* Top Integrated Single-Row Header Bar */}
      <div className="flex items-center justify-between gap-1.5 px-3.5 py-2.5 bg-white/[0.04] border-b border-white/10 shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 min-w-0 shrink-0">
          {enteredFromGroups && (
            <button
              type="button"
              data-osd-action-btn="true"
              onClick={() => setViewMode('groups')}
              className="h-8 px-2.5 rounded-full bg-blue-500/20 hover:bg-blue-500/35 border border-blue-400/40 text-xs font-extrabold text-blue-200 whitespace-nowrap shrink-0 inline-flex items-center gap-1 transition-all cursor-pointer"
              title="Înapoi la Grupuri (Back)"
            >
              <span>← Grupuri</span>
            </button>
          )}

          <button
            type="button"
            data-osd-action-btn="true"
            onClick={openGroupsView}
            className="h-8 px-3 rounded-full bg-white/[0.07] hover:bg-white/[0.14] border border-white/15 inline-flex items-center gap-2 text-white whitespace-nowrap shrink-0 focus:bg-blue-600 focus:outline-none transition-all cursor-pointer"
            title="Deschide Grupuri & Playlist-uri (Butonul Albastru)"
          >
            {selectedThemeId === 'FAV' ? (
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
            ) : (
              <Tv className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            )}
            <span className="text-xs sm:text-sm font-extrabold tracking-tight whitespace-nowrap">
              {selectedThemeId === 'FAV'
                ? 'Favorite TV'
                : activeThemeTab.shortLabel.replace(/^\s*/, '')}
            </span>
            <span className="text-[11px] font-bold text-sky-300/90 whitespace-nowrap">
              • {flatChannels.length}
            </span>
          </button>
        </div>

        {/* Right-Side Single-Row Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            data-osd-action-btn="true"
            onClick={() => changeGroupPage(-1)}
            className="hidden sm:inline-flex h-8 px-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 text-xs font-bold text-zinc-200 whitespace-nowrap shrink-0 items-center justify-center transition-all cursor-pointer"
            title="Pagina anterioară din grup (Săgeată Stânga)"
          >
            ◀ Pag
          </button>
          <span className="hidden sm:inline-flex h-8 px-2.5 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-extrabold text-sky-300 tabular-nums whitespace-nowrap shrink-0 items-center justify-center">
            {currentGroupPage}/{totalGroupPages}
          </span>
          <button
            type="button"
            data-osd-action-btn="true"
            onClick={() => changeGroupPage(1)}
            className="hidden sm:inline-flex h-8 px-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 text-xs font-bold text-zinc-200 whitespace-nowrap shrink-0 items-center justify-center transition-all cursor-pointer"
            title="Pagina următoare din grup (Săgeată Dreapta)"
          >
            Pag ▶
          </button>
          <button
            type="button"
            data-osd-action-btn="true"
            onClick={() => setIsSearchBarOpen((v) => !v)}
            className={`h-8 px-3 rounded-full border text-xs font-bold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-all cursor-pointer ${
              isSearchBarOpen || searchQuery
                ? 'bg-gradient-to-r from-blue-600 to-sky-500 border-sky-300/60 text-white shadow-[0_0_14px_rgba(56,189,248,0.35)]'
                : 'bg-white/[0.06] border-white/10 text-zinc-200 hover:bg-white/[0.14]'
            }`}
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span>Caută</span>
          </button>
          {isOverlayMode && onCloseOverlay && (
            <button
              type="button"
              data-osd-action-btn="true"
              onClick={onCloseOverlay}
              aria-label="Închide lista"
              className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 hover:bg-rose-600 text-xs font-bold text-zinc-200 hover:text-white shrink-0 inline-flex items-center justify-center transition-all cursor-pointer"
            >
              </button>
          )}
        </div>
      </div>

      {/* Main Content Container */}
      <div
        style={{
          flex: '1 1 0%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        className="flex-1 min-h-0 flex flex-col overflow-hidden"
      >
        {/* Optional Expandable Search & TV Keyboard Bar */}
        {isSearchBarOpen && (
          <div className="px-4 py-3 bg-black/40 border-b border-white/10 space-y-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  tabIndex={-1}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Caută canal sau emisiune EPG..."
                  className="w-full h-9 pl-9 pr-8 rounded-full bg-white/[0.07] border border-white/15 focus:border-sky-400 text-xs font-bold text-white placeholder:text-zinc-400 outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="w-6 h-6 rounded-full absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsOsdKeyboardOpen((v) => !v)}
                className="hidden sm:inline-flex items-center h-9 px-3.5 rounded-full bg-white/[0.08] border border-white/15 text-xs font-bold text-white whitespace-nowrap shrink-0 focus:bg-white focus:text-black cursor-pointer"
              >
                Tastatură TV
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSearchBarOpen(false);
                  setIsOsdKeyboardOpen(false);
                }}
                className="h-9 px-3.5 rounded-full bg-white/[0.08] border border-white/15 text-xs font-bold text-zinc-300 whitespace-nowrap shrink-0 focus:bg-white focus:text-black cursor-pointer"
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
                    className="h-7 px-3 rounded-full bg-white/10 focus:bg-white focus:text-black text-[11px] font-bold text-white cursor-pointer"
                  >
                    {osdKeyboardLang === 'LAT' ? 'АБВ (RU)' : 'ABC (RO/EN)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchQuery((q) => q + ' ')}
                    className="h-7 px-3.5 rounded-full bg-white/10 focus:bg-white focus:text-black text-[11px] font-bold text-white cursor-pointer"
                  >
                    Spațiu
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchQuery((q) => q.slice(0, -1))}
                    className="h-7 px-3 rounded-full bg-rose-500/20 focus:bg-rose-600 text-[11px] font-bold text-rose-300 focus:text-white cursor-pointer"
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
                      className="h-7 rounded-lg bg-white/[0.07] focus:bg-white focus:text-black text-white font-bold text-xs border border-white/10 cursor-pointer"
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ROUNDED MODERN CHANNEL LIST */}
        <div
          ref={listContainerRef}
          onScroll={handleListScroll}
          role="listbox"
          aria-label="Canale TV"
          style={{
            flex: '1 1 0%',
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '6px 8px',
          }}
          className="flex-1 min-h-0 overflow-y-auto no-scrollbar"
        >
          {visibleChannels.length === 0 ? (
            <div className="py-16 px-4 text-center text-sm text-zinc-400 space-y-3">
              <p>
                {selectedThemeId === 'FAV'
                  ? 'Nu ai încă niciun canal TV la Favorite. Apasă butonul Albastru (Grupuri) pentru a alege un canal!'
                  : 'Niciun canal găsit în această categorie.'}
              </p>
              <button
                type="button"
                onClick={openGroupsView}
                className="px-4 py-1.5 rounded-full bg-blue-600 text-white text-xs font-bold cursor-pointer"
              >
                Deschide Grupuri (Butonul Albastru)
              </button>
            </div>
          ) : (
            visibleChannels.map((ch, idx) => {
              const isFocused =
                focusZone === 'channels' && idx === focusedRowIdx;
              const isCurrent = ch.id === currentChannel.id;
              const isFav = favoriteIdSet.has(ch.id);
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
                  onFocus={() => {
                    setFocusZone('channels');
                    setFocusedRowIdx(idx);
                  }}
                  onMouseDown={() => {
                    clickedChannelIdRef.current = ch.id;
                    shouldAutoScrollRef.current = false;
                  }}
                  onClick={() => {
                    clickedChannelIdRef.current = ch.id;
                    shouldAutoScrollRef.current = false;
                    setFocusZone('channels');
                    setFocusedRowIdx(idx);
                    selectChannelRow(ch, true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    width: '100%',
                    height: '48px',
                    minHeight: '48px',
                    maxHeight: '48px',
                    marginBottom: '3px',
                    paddingLeft: '10px',
                    paddingRight: '10px',
                    borderRadius: '14px',
                    background: isFocused
                      ? 'linear-gradient(90deg, rgba(37, 99, 235, 0.82) 0%, rgba(14, 165, 233, 0.65) 100%)'
                      : isCurrent
                        ? 'rgba(255, 255, 255, 0.10)'
                        : 'transparent',
                    border: isFocused
                      ? '1px solid rgba(125, 211, 252, 0.78)'
                      : isCurrent
                        ? '1px solid rgba(255, 255, 255, 0.14)'
                        : '1px solid transparent',
                    boxShadow: isFocused
                      ? '0 6px 20px rgba(14, 165, 233, 0.28)'
                      : 'none',
                  }}
                  className="w-full text-left transition-none cursor-pointer outline-none hover:bg-white/[0.06]"
                >
                  {/* LEFT: Channel Number + Logo with crisp fallback badge */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`w-6 text-right text-xs font-extrabold tabular-nums ${
                        isFocused ? 'text-white' : 'text-slate-400'
                      }`}
                    >
                      {idx + 1}
                    </span>

                    <div className="relative w-8 h-6 rounded-md bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden shrink-0">
                      <span className="text-[10px] font-extrabold text-sky-300 select-none">
                        {shortBadge || 'TV'}
                      </span>
                      {effectiveLogo && (
                        <img
                          src={effectiveLogo}
                          alt=""
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                          className="absolute inset-0 w-full h-full object-contain bg-slate-900 p-0.5"
                        />
                      )}
                    </div>
                  </div>

                  {/* CENTER: Full Readable Channel Name (Line 1) + Live EPG Show (Line 2) */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isFav && selectedThemeId !== 'FAV' && (
                        <span className="text-amber-400 text-xs leading-none shrink-0">
                          </span>
                      )}
                      <span className="text-[14px] font-extrabold text-white truncate leading-tight">
                        {ch.name}
                      </span>
                    </div>

                    {nowProg && (
                      <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        <span
                          className={`text-[12px] font-semibold truncate leading-tight ${
                            isFocused ? 'text-amber-200' : 'text-slate-300'
                          }`}
                        >
                          {nowProg.title}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* RIGHT: +Remaining Minutes + Progress Pill */}
                  {nowProg && (
                    <div className="flex items-center gap-1.5 shrink-0 pl-1">
                      <span
                        className={`text-[11px] font-bold tabular-nums ${
                          isFocused ? 'text-white' : 'text-slate-400'
                        }`}
                      >
                        +{stats.remainingMin}m
                      </span>
                      <span className="w-8 h-1.5 rounded-full bg-white/20 overflow-hidden inline-block">
                        <span
                          className={`block h-full rounded-full ${
                            isFocused ? 'bg-white' : 'bg-sky-400'
                          }`}
                          style={{ width: `${stats.progress}%` }}
                        />
                      </span>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Confirmation Modal for Deleting Favorite Channel (Red Button) */}
      {pendingDeleteFavChannel && (
        <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-5">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-white/20 p-5 shadow-2xl space-y-4 text-center">
            <div className="w-11 h-11 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 mx-auto flex items-center justify-center text-lg font-black">
              </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-white">
                Șterge din Favorite?
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Sigur vrei să ștergi canalul{' '}
                <span className="font-extrabold text-white">
                  «{pendingDeleteFavChannel.name}»
                </span>{' '}
                din lista de Favorite?
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                ref={confirmDeleteBtnRef}
                type="button"
                onFocus={() => setConfirmFavBtnFocus('confirm')}
                onClick={() => {
                  toggleFavoriteTvChannel(pendingDeleteFavChannel);
                  setPendingDeleteFavChannel(null);
                }}
                className={`px-4 py-2 rounded-full text-xs font-extrabold transition-all cursor-pointer outline-none ${
                  confirmFavBtnFocus === 'confirm'
                    ? 'bg-rose-600 text-white ring-2 ring-white shadow-lg scale-105'
                    : 'bg-rose-600/40 text-rose-200 hover:bg-rose-600/70'
                }`}
              >
                Da, șterge
              </button>
              <button
                ref={cancelDeleteBtnRef}
                type="button"
                onFocus={() => setConfirmFavBtnFocus('cancel')}
                onClick={() => setPendingDeleteFavChannel(null)}
                className={`px-4 py-2 rounded-full text-xs font-extrabold transition-all cursor-pointer outline-none ${
                  confirmFavBtnFocus === 'cancel'
                    ? 'bg-white text-slate-950 ring-2 ring-sky-400 shadow-lg scale-105'
                    : 'bg-white/10 text-zinc-200 hover:bg-white/20'
                }`}
              >
                Anulează
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Integrated 4-Color Remote Legend Bar */}
      <div className="border-t border-white/10 bg-black/40 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs font-bold text-zinc-200 shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 sm:gap-2 mx-auto sm:mx-0 sm:ml-auto whitespace-nowrap">
          <button
            type="button"
            data-osd-action-btn="true"
            onClick={triggerRedFavActionForFocusedChannel}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/15 text-white whitespace-nowrap shrink-0 cursor-pointer"
            title="Butonul Roșu: Șterge din Favorite (cu confirmare) / Adaugă la Favorite"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shrink-0" />
            <span>{isFocusedChannelFav ? 'Șterge Fav' : '+Fav'}</span>
          </button>

          <button
            type="button"
            data-osd-action-btn="true"
            onClick={openDetailedEpgForFocusedChannel}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/15 text-white whitespace-nowrap shrink-0 cursor-pointer"
            title="Butonul Verde: EPG Detaliat pentru canalul selectat"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shrink-0" />
            <span>EPG Detaliat</span>
          </button>

          <button
            type="button"
            data-osd-action-btn="true"
            onClick={openArchiveForFocusedChannel}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/15 text-white whitespace-nowrap shrink-0 cursor-pointer"
            title="Butonul Galben: Arhivă TV Catch-up"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shrink-0" />
            <span>Arhivă</span>
          </button>

          <button
            type="button"
            data-osd-action-btn="true"
            onClick={openGroupsView}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/15 text-white whitespace-nowrap shrink-0 cursor-pointer"
            title="Butonul Albastru: Grupuri & Playlist-uri"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block shrink-0" />
            <span>Grupuri</span>
          </button>
        </div>
      </div>
    </div>
  );
};
