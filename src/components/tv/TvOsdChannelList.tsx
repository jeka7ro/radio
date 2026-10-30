import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  List,
  Search,
  Heart,
  X,
} from 'lucide-react';
import { TvChannel } from '../../types/radio';
import { useRadioStore } from '../../store/useRadioStore';
import {
  resolveChannelEpg,
  getEpgTimingStats,
  formatEpgTime,
  fetchEpgForCountry,
} from '../../services/epgService';

export interface ThematicCategoryDef {
  id: string;
  title: string;
  shortLabel: string;
  icon: string;
  test: (group: string, name: string) => boolean;
}

const THEMATIC_CATEGORIES: ThematicCategoryDef[] = [
  {
    id: 'general',
    title: 'Generale & Naționale',
    shortLabel: 'Generale',
    icon: '📡',
    test: (g, n) =>
      /основные|общие|general|федеральные|national/i.test(g) ||
      /^(первый|россия 1|нтв|pro tv|antena 1|tvr 1|kanal d|prima tv|jurnal tv|moldova 1)\b/i.test(
        n
      ),
  },
  {
    id: 'cinema',
    title: 'Filme & Seriale (Cinema)',
    shortLabel: 'Filme & Seriale',
    icon: '🎬',
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
    icon: '⚽',
    test: (g, n) =>
      /спорт|sport/i.test(g) ||
      /спорт|sport|football|футбол|ufc|mma|fight|khl|кхл|матч|match|eurosport|digi sport|prima sport|pro arena|setanta|bt sport|sky sports/i.test(
        n
      ),
  },
  {
    id: 'documentaries',
    title: 'Documentaries & Știință',
    shortLabel: 'Documentaries',
    icon: '🌍',
    test: (g, n) =>
      /познавательные|documentar|docu|science|наука|educational/i.test(g) ||
      /discovery|nat geo|national geographic|viasat explore|viasat history|viasat nature|animal planet|bbc earth|docubox|history|история|наука|моя планета|живая планета|terra|da vinci/i.test(
        n
      ),
  },
  {
    id: 'news',
    title: 'Știri & Informații (News)',
    shortLabel: 'Știri / News',
    icon: '📰',
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
    icon: '🎭',
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
    title: 'Copii & Familie (Kids)',
    shortLabel: 'Copii / Kids',
    icon: '🧸',
    test: (g, n) =>
      /детские|kids|children|copii|family/i.test(g) ||
      /cartoon|disney|nickelodeon|nick|карусель|мульт|ani|gulli|jimjam|minimax|duck tv|boing|tiji|baby|детский|рыжий|о!/i.test(
        n
      ),
  },
  {
    id: 'music',
    title: 'Muzică (Music)',
    shortLabel: 'Muzică',
    icon: '🎵',
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
    icon: '📍',
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
  onToggleOverlayMode,
  onToggleInfoPanel,
  isInfoPanelOpen = true,
  onCloseOverlay,
}) => {
  const playTvChannel = useRadioStore((state) => state.playTvChannel);
  const favoriteTvChannels = useRadioStore((state) => state.favoriteTvChannels);
  const toggleFavoriteTvChannel = useRadioStore(
    (state) => state.toggleFavoriteTvChannel
  );
  const recentTvChannels = useRadioStore((state) => state.recentTvChannels);

  const [selectedThemeId, setSelectedThemeId] = useState<string>('ALL');
  const [showGroupsModal, setShowGroupsModal] = useState<boolean>(false);
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
    const tabs: Array<{ id: string; title: string; shortLabel: string; icon: string; count: number }> = [
      {
        id: 'ALL',
        title: 'All channels (Pe tematici)',
        shortLabel: 'All channels',
        icon: '📺',
        count: pool.length,
      },
      {
        id: 'FAV',
        title: 'Canale Favorite',
        shortLabel: 'Favourite',
        icon: '❤️',
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
          icon: cat.icon,
          count,
        });
      }
    }

    const otherCount = thematicBuckets.get('other')?.length || 0;
    if (otherCount > 0) {
      tabs.push({
        id: 'other',
        title: 'Alte Canale TV',
        shortLabel: 'Alte Canale',
        icon: '📡',
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

    // "ALL" mode: Organized by Thematic Categories with "•●★Tematică★●•" headers!
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

  const activeTabInfo =
    themeTabs.find((t) => t.id === selectedThemeId) || themeTabs[0];

  const isCurrentFavorite = favoriteTvChannels.some(
    (f) => f.id === currentChannel.id
  );

  return (
    <div className="w-full h-full flex flex-col select-none text-white">
      {/* Top Folder Tab ("☰ All channels / United Kingdom / Cinema") + Search */}
      <div className="flex flex-wrap items-end justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setShowGroupsModal((v) => !v)}
          title="Alege categoria tematică (Groups)"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-zinc-900/95 hover:bg-zinc-800 border-t-2 border-x-2 border-zinc-400/80 rounded-t-lg text-xs sm:text-sm font-bold text-zinc-100 -mb-[2px] z-10 shadow-md transition-colors"
        >
          <List className="w-4 h-4 text-amber-400" aria-hidden="true" />
          <span>{activeTabInfo.shortLabel}</span>
          <span className="text-xs text-zinc-400 font-normal">
            ({activeTabInfo.count})
          </span>
        </button>

        <div className="flex items-center gap-1.5 pb-1.5 ml-auto">
          {/* Quick search inside OSD */}
          <div className="relative w-36 sm:w-48">
            <Search
              className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Caută canal / EPG..."
              className="w-full min-h-[30px] pl-7 pr-6 py-1 rounded-full bg-zinc-900/90 border border-zinc-500/70 focus:border-amber-400 text-xs text-white placeholder:text-zinc-400 outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Șterge căutarea"
                className="w-5 h-5 rounded-full absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            )}
          </div>

          {onToggleOverlayMode && (
            <button
              type="button"
              onClick={onToggleOverlayMode}
              title={
                isOverlayMode
                  ? 'Mută lista de canale în panoul din dreapta'
                  : 'Afișează lista OSD transparentă direct peste video (stil Smart TV)'
              }
              className="min-h-[30px] px-3 py-1 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-500/70 text-[11px] font-semibold text-amber-300 transition-colors whitespace-nowrap"
            >
              {isOverlayMode ? 'Panou lateral ⇥' : 'OSD peste video ↗'}
            </button>
          )}

          {isOverlayMode && onCloseOverlay && (
            <button
              type="button"
              onClick={onCloseOverlay}
              aria-label="Ascunde lista OSD"
              className="w-7 h-7 rounded-full bg-zinc-900/90 hover:bg-rose-600 border border-zinc-500/70 text-zinc-200 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Main Semi-Transparent Smart IPTV OSD Box */}
      <div
        className={`relative border-2 border-zinc-400/80 shadow-2xl overflow-hidden flex flex-col ${
          isOverlayMode
            ? 'bg-zinc-950/75 backdrop-blur-[3px]'
            : 'bg-zinc-950/95'
        }`}
      >
        {/* Thematic Groups Bar (when "Groups" or top tab is clicked) */}
        {showGroupsModal && (
          <div className="p-2 bg-zinc-900/95 border-b border-zinc-600/80 flex flex-wrap items-center gap-1.5 shrink-0">
            {themeTabs.map((tab) => {
              const active = selectedThemeId === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setSelectedThemeId(tab.id);
                    setShowGroupsModal(false);
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                    active
                      ? 'bg-[#ff3b1f] text-white font-bold shadow-xs'
                      : tab.id === 'FAV'
                        ? 'bg-rose-950/80 text-rose-200 border border-rose-700/70 hover:bg-rose-900'
                        : 'bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700'
                  }`}
                >
                  <span aria-hidden="true">{tab.icon}</span>
                  <span>{tab.shortLabel}</span>
                  <span className="text-[11px] opacity-80">({tab.count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Quick Thematic Strip (Always accessible for 1-click switching between All, Favorite, Cinema, Sport, Docs, News...) */}
        <div className="px-2.5 py-1.5 bg-black/50 border-b border-zinc-700/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {themeTabs.map((tab) => {
            const active = selectedThemeId === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedThemeId(tab.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap inline-flex items-center gap-1 shrink-0 transition-colors ${
                  active
                    ? 'bg-zinc-100 text-zinc-950 font-bold'
                    : tab.id === 'FAV'
                      ? 'bg-rose-950/60 text-rose-300 border border-rose-800/60 hover:bg-rose-900/60'
                      : 'bg-zinc-900/75 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <span aria-hidden="true">{tab.icon}</span>
                <span>{tab.shortLabel}</span>
                <span className="opacity-70">({tab.count})</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Smart IPTV Channel List */}
        <div
          ref={listContainerRef}
          onScroll={handleListScroll}
          role="listbox"
          aria-label="Canale TV"
          className={`${
            isOverlayMode
              ? 'max-h-[32vh] sm:max-h-[38vh] lg:max-h-[44vh]'
              : 'max-h-[360px] lg:max-h-[calc(88vh-230px)] min-h-[280px]'
          } overflow-y-auto divide-y divide-zinc-800/30`}
        >
          {visibleRows.length === 0 ? (
            <div className="py-10 px-4 text-center text-sm text-zinc-300 space-y-2">
              <p>
                {selectedThemeId === 'FAV'
                  ? 'Nu ai încă niciun canal TV la Favorite. Apasă pe inimioară sau pe butonul roșu Favourite!'
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
                // Exact Smart IPTV Thematic Header Row: `96 [••] •●★Documentaries★●•`
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
                    title="Click pentru a filtra doar această tematică"
                    className="flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-1.5 bg-zinc-900/65 hover:bg-zinc-800/75 border-y border-zinc-700/40 cursor-pointer transition-colors"
                  >
                    <span className="w-8 sm:w-10 text-right font-mono text-xs sm:text-sm text-zinc-400 tabular-nums shrink-0">
                      {row.rowNumber}
                    </span>
                    <span className="w-6 h-5 rounded-xs bg-zinc-200 text-zinc-900 font-extrabold text-[10px] flex items-center justify-center shrink-0 tracking-tighter">
                      ••
                    </span>
                    <span className="text-xs sm:text-[15px] font-bold text-white tracking-wide truncate">
                      •●★{row.title}★●•
                    </span>
                    <span className="text-xs text-zinc-400 font-mono ml-auto">
                      ({row.count})
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
                  className={`group flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-1.5 cursor-pointer transition-colors ${
                    isCurrent
                      ? 'border-y-2 border-[#ff3b1f] bg-black/55'
                      : 'border-y border-transparent hover:bg-white/10'
                  }`}
                >
                  {/* 1. Channel Number */}
                  <span
                    className={`w-8 sm:w-10 text-right font-mono text-xs sm:text-[15px] tabular-nums shrink-0 ${
                      isCurrent ? 'text-white font-bold' : 'text-zinc-200'
                    }`}
                  >
                    {row.rowNumber}
                  </span>

                  {/* 2. Channel Icon / Square Badge (like `LO`, `BB`, `★` in Smart IPTV) */}
                  <div className="w-6 h-5 rounded-xs overflow-hidden flex items-center justify-center shrink-0 bg-zinc-200/90 text-zinc-900 font-extrabold text-[10px]">
                    {effectiveLogo ? (
                      <img
                        src={effectiveLogo}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                        className="w-full h-full object-contain bg-zinc-900 p-[1px]"
                      />
                    ) : (
                      <span>{shortBadge || 'TV'}</span>
                    )}
                  </div>

                  {/* 3. Channel Name (Bold White) + Live EPG Programme Title (Warm Gold / Coral) */}
                  <div className="flex-1 min-w-0 flex items-baseline gap-2.5 overflow-hidden">
                    <span className="text-xs sm:text-[15px] font-bold text-white truncate shrink-0 max-w-[145px] sm:max-w-[240px]">
                      {ch.name}
                    </span>

                    {nowProg && (
                      <span
                        className="text-xs sm:text-[14px] font-medium text-[#e6d992] group-hover:text-amber-200 truncate flex-1"
                        title={`${formatEpgTime(nowProg.start)}–${formatEpgTime(
                          nowProg.stop
                        )} • ${nowProg.title}${
                          nowProg.desc ? ` — ${nowProg.desc}` : ''
                        }`}
                      >
                        {nowProg.title}
                      </span>
                    )}
                  </div>

                  {/* 4. Right Side: "+Minutes Left" + Framed Progress Bar (only when EPG is active, just like Smart IPTV!) */}
                  <div className="flex items-center gap-2 shrink-0">
                    {nowProg && (
                      <>
                        <span
                          className="text-xs sm:text-[14px] font-mono font-semibold text-zinc-100 tabular-nums text-right"
                          title={stats.remainingShort}
                        >
                          +{stats.remainingMin}
                        </span>
                        <div
                          className="w-9 sm:w-11 h-2.5 border border-zinc-200 bg-black/70 p-[1px] flex items-center"
                          title={`${stats.progress}% (${stats.elapsedMin}/${stats.totalMin} min)`}
                        >
                          <div
                            className="h-full bg-zinc-100 transition-all duration-300"
                            style={{ width: `${stats.progress}%` }}
                          />
                        </div>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavoriteTvChannel(ch);
                      }}
                      title={
                        isFav ? 'Elimină de la Favorite' : 'Adaugă la Favorite'
                      }
                      aria-label={
                        isFav ? 'Elimină de la Favorite' : 'Adaugă la Favorite'
                      }
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                        isFav
                          ? 'text-rose-500'
                          : 'text-zinc-400 opacity-40 group-hover:opacity-100 hover:text-rose-400'
                      }`}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`}
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

      {/* Bottom Smart IPTV Legend Bar: [i Info] [Red: Favourite] [Green: EPG] [Yellow: A-Z] [Blue: Groups] */}
      <div className="flex justify-end pr-3">
        <div className="inline-flex flex-wrap items-center gap-2 sm:gap-3 px-4 py-1.5 bg-zinc-900/95 border-b-2 border-x-2 border-zinc-400/75 rounded-b-lg shadow-xl -mt-[2px] z-10 text-xs sm:text-sm font-semibold">
          {/* Info */}
          {onToggleInfoPanel && (
            <button
              type="button"
              onClick={onToggleInfoPanel}
              className="px-2 py-0.5 rounded-full hover:bg-zinc-800 inline-flex items-center gap-1.5 text-zinc-100 transition-colors"
              title="Afișează / ascunde detaliile EPG"
            >
              <span className="w-3 h-3 rounded-[2px] bg-zinc-200 text-zinc-950 font-black text-[9px] flex items-center justify-center">
                i
              </span>
              <span>Info</span>
            </button>
          )}

          {/* RED: Favourite (Toggles favorite on current channel or filters Favorite group) */}
          <button
            type="button"
            onClick={() =>
              setSelectedThemeId((prev) => (prev === 'FAV' ? 'ALL' : 'FAV'))
            }
            onContextMenu={(e) => {
              e.preventDefault();
              toggleFavoriteTvChannel(currentChannel);
            }}
            className={`px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 transition-colors ${
              selectedThemeId === 'FAV'
                ? 'bg-rose-600 text-white'
                : 'text-zinc-100 hover:bg-zinc-800'
            }`}
            title="Vezi canalele Favorite (sau apasă pe ♥ lângă orice canal)"
          >
            <span className="w-2.5 h-2.5 rounded-[2px] bg-[#ff3b1f] inline-block" />
            <span>Favourite ({favoriteTvChannels.length})</span>
          </button>

          {/* Quick +Fav for current channel */}
          <button
            type="button"
            onClick={() => toggleFavoriteTvChannel(currentChannel)}
            className={`px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 text-xs transition-colors ${
              isCurrentFavorite
                ? 'bg-rose-950/90 text-rose-300 border border-rose-700/70'
                : 'bg-zinc-800 text-zinc-300 hover:text-white'
            }`}
            title="Adaugă sau scoate canalul curent de la Favorite"
          >
            <Heart
              className={`w-3 h-3 ${
                isCurrentFavorite ? 'fill-current text-rose-400' : ''
              }`}
              aria-hidden="true"
            />
            <span>{isCurrentFavorite ? 'În Favorite' : '+Fav'}</span>
          </button>

          {/* GREEN: EPG */}
          <button
            type="button"
            onClick={() => setOnlyWithEpg((v) => !v)}
            className={`px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 transition-colors ${
              onlyWithEpg
                ? 'bg-emerald-600 text-white'
                : 'text-zinc-100 hover:bg-zinc-800'
            }`}
            title="Filtrează canalele care au program EPG activ acum"
          >
            <span className="w-2.5 h-2.5 rounded-[2px] bg-[#22c55e] inline-block" />
            <span>EPG</span>
          </button>

          {/* YELLOW: A-Z */}
          <button
            type="button"
            onClick={() =>
              setSortMode((prev) => (prev === 'default' ? 'az' : 'default'))
            }
            className={`px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 transition-colors ${
              sortMode === 'az'
                ? 'bg-amber-500 text-zinc-950 font-bold'
                : 'text-zinc-100 hover:bg-zinc-800'
            }`}
            title="Sortează alfabetic A–Z"
          >
            <span className="w-2.5 h-2.5 rounded-[2px] bg-[#eab308] inline-block" />
            <span>A-Z</span>
          </button>

          {/* BLUE: Groups */}
          <button
            type="button"
            onClick={() => setShowGroupsModal((v) => !v)}
            className={`px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 transition-colors ${
              showGroupsModal || selectedThemeId !== 'ALL'
                ? 'bg-blue-600 text-white'
                : 'text-zinc-100 hover:bg-zinc-800'
            }`}
            title="Alege categoria tematică (Filme, Sport, Documentare, Știri, Muzică, Copii...)"
          >
            <span className="w-2.5 h-2.5 rounded-[2px] bg-[#3b82f6] inline-block" />
            <span>Groups</span>
          </button>
        </div>
      </div>
    </div>
  );
};
