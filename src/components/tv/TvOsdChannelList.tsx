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
} from 'lucide-react';
import { TvChannel } from '../../types/radio';
import { useRadioStore } from '../../store/useRadioStore';
import {
  resolveChannelEpg,
  getEpgTimingStats,
  fetchEpgForCountry,
} from '../../services/epgService';

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
    shortLabel: 'Filme',
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

type OsdListRow =
  | {
      type: 'header';
      key: string;
      categoryId: string;
      title: string;
      count: number;
      rowNumber: number;
    }
  | {
      type: 'channel';
      key: string;
      channel: TvChannel;
      rowNumber: number;
      categoryId: string;
    };

interface TvOsdChannelListProps {
  currentChannel: TvChannel;
  channels: TvChannel[];
  isOverlayMode?: boolean;
  onToggleOverlayMode?: () => void;
  onToggleInfoPanel?: () => void;
  isInfoPanelOpen?: boolean;
  onCloseOverlay?: () => void;
}

export const TvOsdChannelList: React.FC<TvOsdChannelListProps> = ({
  currentChannel,
  channels,
  isOverlayMode = false,
  onCloseOverlay,
}) => {
  const playTvChannel = useRadioStore((state) => state.playTvChannel);
  const favoriteTvChannels = useRadioStore((state) => state.favoriteTvChannels);
  const toggleFavoriteTvChannel = useRadioStore(
    (state) => state.toggleFavoriteTvChannel
  );
  const recentTvChannels = useRadioStore((state) => state.recentTvChannels);

  const [selectedThemeId, setSelectedThemeId] = useState<string>('ALL');
  const [onlyWithEpg, setOnlyWithEpg] = useState<boolean>(false);
  const [sortMode, setSortMode] = useState<OsdSortMode>('default');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [renderLimit, setRenderLimit] = useState<number>(180);

  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const activeRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (currentChannel?.countryCode) {
      void fetchEpgForCountry(currentChannel.countryCode);
    }
  }, [currentChannel?.countryCode]);

  // Ensure complete pool of channels
  const pool = useMemo(() => {
    if (channels.length > 1) return channels;
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
  }, [channels, currentChannel, favoriteTvChannels, recentTvChannels]);

  // Group all channels into Thematic Buckets + Favorites Bucket
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
    }

    return map;
  }, [pool]);

  // Build list of available thematic tabs with counts
  const themeTabs = useMemo(() => {
    const tabs: Array<{
      id: string;
      title: string;
      shortLabel: string;
      Icon: React.ComponentType<{ className?: string }>;
      count: number;
    }> = [
      {
        id: 'ALL',
        title: 'Toate canalele',
        shortLabel: 'Toate',
        Icon: Tv,
        count: pool.length,
      },
      {
        id: 'FAV',
        title: 'Canale Favorite',
        shortLabel: 'Favorite',
        Icon: Heart,
        count: favoriteTvChannels.length,
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
  }, [pool.length, favoriteTvChannels.length, thematicBuckets]);

  // Build the numbered Smart IPTV rows (including `•●★Tematică★●•` separator rows!)
  const osdRows = useMemo<OsdListRow[]>(() => {
    const q = searchQuery.trim().toLowerCase();

    const matchesFilters = (ch: TvChannel): boolean => {
      const epg = resolveChannelEpg(ch);
      if (onlyWithEpg && !epg?.now) return false;
      if (q) {
        const nameMatch = ch.name.toLowerCase().includes(q);
        const groupMatch = (ch.group || '').toLowerCase().includes(q);
        const epgMatch =
          epg?.now?.title?.toLowerCase().includes(q) ||
          epg?.now?.desc?.toLowerCase().includes(q);
        if (!nameMatch && !groupMatch && !epgMatch) return false;
      }
      return true;
    };

    const sortChannelArray = (arr: TvChannel[]): TvChannel[] => {
      if (sortMode === 'az') {
        return [...arr].sort((a, b) => a.name.localeCompare(b.name));
      }
      return arr;
    };

    const rows: OsdListRow[] = [];
    let rowCounter = 1;

    // If user selected a single group or Favourite
    if (selectedThemeId === 'FAV') {
      const favList = sortChannelArray(
        favoriteTvChannels.filter(matchesFilters)
      );
      rows.push({
        type: 'header',
        key: 'hdr_fav',
        categoryId: 'FAV',
        title: 'Canale TV Favorite',
        count: favList.length,
        rowNumber: rowCounter++,
      });
      for (const ch of favList) {
        rows.push({
          type: 'channel',
          key: `fav_${ch.id}`,
          channel: ch,
          rowNumber: rowCounter++,
          categoryId: 'FAV',
        });
      }
      return rows;
    }

    if (selectedThemeId !== 'ALL') {
      const catDef = THEMATIC_CATEGORIES.find((c) => c.id === selectedThemeId);
      const rawList = thematicBuckets.get(selectedThemeId) || [];
      const filtered = sortChannelArray(rawList.filter(matchesFilters));

      rows.push({
        type: 'header',
        key: `hdr_${selectedThemeId}`,
        categoryId: selectedThemeId,
        title: catDef ? catDef.title : 'Alte Canale TV',
        count: filtered.length,
        rowNumber: rowCounter++,
      });

      for (const ch of filtered) {
        rows.push({
          type: 'channel',
          key: `${selectedThemeId}_${ch.id}`,
          channel: ch,
          rowNumber: rowCounter++,
          categoryId: selectedThemeId,
        });
      }
      return rows;
    }

    // "ALL" mode: Organized by Thematic Categories
    // If total pool is small (<= 15 channels), show a clean flat numbered list without cluttering headers
    if (pool.length <= 15) {
      const flat = sortChannelArray(pool.filter(matchesFilters));
      for (const ch of flat) {
        rows.push({
          type: 'channel',
          key: `flat_${ch.id}`,
          channel: ch,
          rowNumber: rowCounter++,
          categoryId: 'ALL',
        });
      }
      return rows;
    }

    // 1. First section: Favorite TV Channels (if any exist)
    const filteredFavs = sortChannelArray(
      favoriteTvChannels.filter(matchesFilters)
    );
    if (filteredFavs.length > 0 && !q) {
      rows.push({
        type: 'header',
        key: 'hdr_all_fav',
        categoryId: 'FAV',
        title: 'Canale Favorite',
        count: filteredFavs.length,
        rowNumber: rowCounter++,
      });
      for (const ch of filteredFavs) {
        rows.push({
          type: 'channel',
          key: `all_fav_${ch.id}`,
          channel: ch,
          rowNumber: rowCounter++,
          categoryId: 'FAV',
        });
      }
    }

    // 2. Each Thematic Category in order
    const allCats: Array<{ id: string; title: string }> = [
      ...THEMATIC_CATEGORIES.map((c) => ({ id: c.id, title: c.title })),
      { id: 'other', title: 'Alte Canale TV' },
    ];

    for (const cat of allCats) {
      const rawList = thematicBuckets.get(cat.id) || [];
      const filtered = sortChannelArray(rawList.filter(matchesFilters));
      if (filtered.length === 0) continue;

      rows.push({
        type: 'header',
        key: `hdr_${cat.id}`,
        categoryId: cat.id,
        title: cat.title,
        count: filtered.length,
        rowNumber: rowCounter++,
      });

      for (const ch of filtered) {
        rows.push({
          type: 'channel',
          key: `ch_${cat.id}_${ch.id}`,
          channel: ch,
          rowNumber: rowCounter++,
          categoryId: cat.id,
        });
      }
    }

    return rows;
  }, [
    selectedThemeId,
    favoriteTvChannels,
    thematicBuckets,
    onlyWithEpg,
    searchQuery,
    sortMode,
  ]);

  // Find index of currently playing channel in osdRows (preferring its thematic section row)
  const activeRowIndex = useMemo(() => {
    // First look in the non-fav thematic section unless selectedThemeId === 'FAV'
    const idx = osdRows.findIndex(
      (r) =>
        r.type === 'channel' &&
        r.channel.id === currentChannel.id &&
        (selectedThemeId === 'FAV' || r.categoryId !== 'FAV')
    );
    if (idx >= 0) return idx;
    return osdRows.findIndex(
      (r) => r.type === 'channel' && r.channel.id === currentChannel.id
    );
  }, [osdRows, currentChannel.id, selectedThemeId]);

  useEffect(() => {
    if (activeRowIndex >= 0 && activeRowIndex + 40 > renderLimit) {
      setRenderLimit(activeRowIndex + 90);
    }
  }, [activeRowIndex, renderLimit]);

  // Auto-scroll active channel row into the center of the Smart IPTV OSD list
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (activeRowRef.current && listContainerRef.current) {
        const container = listContainerRef.current;
        const row = activeRowRef.current;
        const targetTop =
          row.offsetTop - container.clientHeight / 2 + row.clientHeight / 2;
        container.scrollTo({
          top: Math.max(0, targetTop),
          behavior: 'smooth',
        });
      }
    }, 60);
    return () => window.clearTimeout(timer);
  }, [currentChannel.id, selectedThemeId, onlyWithEpg]);

  const visibleRows = useMemo(
    () => osdRows.slice(0, renderLimit),
    [osdRows, renderLimit]
  );

  const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (
      el.scrollTop + el.clientHeight >= el.scrollHeight - 260 &&
      renderLimit < osdRows.length
    ) {
      setRenderLimit((prev) => Math.min(osdRows.length, prev + 140));
    }
  };

  return (
    <div className="w-full h-full min-h-0 flex flex-col select-none text-white">
      {/* Main Clean Smart IPTV Channel List Box */}
      <div
        className={`relative rounded-2xl border border-zinc-700/80 shadow-xl overflow-hidden flex-1 min-h-0 flex flex-col ${
          isOverlayMode
            ? 'bg-zinc-950/85 backdrop-blur-md'
            : 'bg-zinc-950'
        }`}
      >
        {/* Row 1: Search Input + Quick Sort (A-Z) & EPG Filter */}
        <div className="p-2 bg-zinc-900 border-b border-zinc-800 flex items-center gap-1.5 shrink-0">
          <div className="relative flex-1 min-w-0">
            <Search
              className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Caută canal sau emisiune..."
              className="w-full h-8 pl-8 pr-7 rounded-full bg-zinc-950 border border-zinc-700 focus:border-brand-500 text-xs text-white placeholder:text-zinc-400 outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Șterge căutarea"
                className="w-6 h-6 rounded-full absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              setSortMode((prev) => (prev === 'default' ? 'az' : 'default'))
            }
            className={`h-8 px-2.5 rounded-full text-xs font-semibold shrink-0 transition-colors border ${
              sortMode === 'az'
                ? 'bg-amber-500 text-zinc-950 border-amber-400 font-bold'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
            }`}
            title="Sortează alfabetic A–Z"
          >
            A–Z
          </button>

          <button
            type="button"
            onClick={() => setOnlyWithEpg((v) => !v)}
            className={`h-8 px-2.5 rounded-full text-xs font-semibold shrink-0 transition-colors border ${
              onlyWithEpg
                ? 'bg-emerald-600 text-white border-emerald-500 font-bold'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
            }`}
            title="Filtrează doar canalele cu EPG activ"
          >
            EPG
          </button>

          {isOverlayMode && onCloseOverlay && (
            <button
              type="button"
              onClick={onCloseOverlay}
              aria-label="Închide lista"
              className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-rose-600 text-zinc-200 hover:text-white flex items-center justify-center shrink-0 transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Row 2: Single Clean Horizontal Category Strip with SVG Icons (Zero Emojis) */}
        <div className="px-2 py-1.5 bg-zinc-900/95 border-b border-zinc-800 flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
          {themeTabs.map((tab) => {
            const active = selectedThemeId === tab.id;
            const TabIcon = tab.Icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedThemeId(tab.id)}
                title={`${tab.title} (${tab.count})`}
                className={`h-7 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap inline-flex items-center gap-1 shrink-0 transition-colors ${
                  active
                    ? 'bg-brand-600 text-white font-bold shadow-xs'
                    : tab.id === 'FAV'
                      ? 'bg-rose-950/60 text-rose-300 border border-rose-800/60 hover:bg-rose-900/60'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                }`}
              >
                <TabIcon className="w-3 h-3 shrink-0" />
                <span>{tab.shortLabel}</span>
                <span className="opacity-70 text-[10px]">({tab.count})</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Channel List */}
        <div
          ref={listContainerRef}
          onScroll={handleListScroll}
          role="listbox"
          aria-label="Canale TV"
          className={`${
            isOverlayMode
              ? 'max-h-[36vh] sm:max-h-[42vh] lg:max-h-[48vh]'
              : 'flex-1 min-h-0'
          } overflow-y-auto divide-y divide-zinc-800/40`}
        >
          {visibleRows.length === 0 ? (
            <div className="py-8 px-4 text-center text-xs sm:text-sm text-zinc-400 space-y-2">
              <p>
                {selectedThemeId === 'FAV'
                  ? 'Nu ai încă niciun canal TV la Favorite. Apasă pe ♥ lângă orice canal!'
                  : 'Niciun canal găsit pentru filtrul selectat.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedThemeId('ALL');
                  setOnlyWithEpg(false);
                  setSearchQuery('');
                }}
                className="px-4 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-xs font-semibold"
              >
                Afișează toate canalele
              </button>
            </div>
          ) : (
            visibleRows.map((row, idx) => {
              if (row.type === 'header') {
                return (
                  <div
                    key={row.key}
                    onClick={() =>
                      setSelectedThemeId(
                        selectedThemeId === row.categoryId
                          ? 'ALL'
                          : row.categoryId
                      )
                    }
                    className="flex items-center justify-between gap-2 px-3 py-1.5 bg-zinc-900/90 hover:bg-zinc-800 border-y border-zinc-800 cursor-pointer transition-colors"
                  >
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider truncate">
                      {row.title}
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      {row.count} canale
                    </span>
                  </div>
                );
              }

              const ch = row.channel;
              const isSelectedRow = idx === activeRowIndex;
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
                <div
                  key={row.key}
                  ref={isSelectedRow ? activeRowRef : undefined}
                  role="option"
                  aria-selected={isCurrent}
                  onClick={() => {
                    if (isCurrent && isOverlayMode && onCloseOverlay) {
                      onCloseOverlay();
                    } else {
                      playTvChannel(ch, pool);
                    }
                  }}
                  className={`group flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                    isCurrent
                      ? 'bg-brand-950/70 border-l-4 border-l-brand-500'
                      : 'hover:bg-zinc-900/80'
                  }`}
                >
                  {/* 1. Channel Number */}
                  <span
                    className={`w-6 text-right font-mono text-xs tabular-nums shrink-0 ${
                      isCurrent ? 'text-brand-300 font-bold' : 'text-zinc-400'
                    }`}
                  >
                    {row.rowNumber}
                  </span>

                  {/* 2. Channel Logo */}
                  <div className="w-7 h-6 rounded bg-zinc-800 overflow-hidden flex items-center justify-center shrink-0 text-zinc-200 font-bold text-[10px]">
                    {effectiveLogo ? (
                      <img
                        src={effectiveLogo}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                        className="w-full h-full object-contain p-0.5"
                      />
                    ) : (
                      <span>{shortBadge || 'TV'}</span>
                    )}
                  </div>

                  {/* 3. Channel Name + Live EPG Title */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-white truncate">
                        {ch.name}
                      </span>
                    </div>
                    {nowProg && (
                      <p className="text-[11px] text-amber-200/90 truncate mt-0.5">
                        {nowProg.title}
                      </p>
                    )}
                  </div>

                  {/* 4. Right Side: Remaining Minutes + Progress + Favorite Heart */}
                  <div className="flex items-center gap-2 shrink-0">
                    {nowProg && (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
                          +{stats.remainingMin}m
                        </span>
                        <div className="w-10 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full bg-brand-400 rounded-full"
                            style={{ width: `${stats.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavoriteTvChannel(ch);
                      }}
                      aria-label={
                        isFav ? 'Elimină de la Favorite' : 'Adaugă la Favorite'
                      }
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                        isFav
                          ? 'text-rose-500'
                          : 'text-zinc-500 hover:text-rose-400'
                      }`}
                    >
                      <Heart
                        className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
