import React, { useEffect, useRef, useId, useMemo, useState } from 'react';
import {
  Search,
  X,
  RefreshCw,
  Clock,
  Trash2,
  Tv,
  WifiOff,
  SlidersHorizontal,
  Globe,
  Upload,
  Download,
  Link2,
  Heart,
} from 'lucide-react';
import { useRadioStore } from '../store/useRadioStore';
import { useTranslation } from '../i18n/useTranslation';
import { useTvChannels } from '../hooks/useTvChannels';
import {
  parseM3uPlaylist,
  exportTvChannelsToM3u,
  downloadM3uFile,
} from '../services/tvApi';
import { EnrichedCountry } from '../hooks/useCountries';
import { TvChannelCard } from '../components/tv/TvChannelCard';
import { StationSkeleton } from '../components/stations/StationSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { StationAvatar } from '../components/common/StationAvatar';
import { TvChannel, TvSortOption } from '../types/radio';
import {
  getCountryFlagEmoji,
  getLocalizedCountryName,
} from '../services/geoLanguageService';

interface TvOnlineViewProps {
  selectedCountry: EnrichedCountry;
}

export const TvOnlineView: React.FC<TvOnlineViewProps> = ({
  selectedCountry,
}) => {
  const { t, language, format } = useTranslation();
  const searchInputId = useId();
  const sortSelectId = useId();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const recentTvChannels = useRadioStore((state) => state.recentTvChannels);
  const clearRecentTvChannels = useRadioStore(
    (state) => state.clearRecentTvChannels
  );
  const currentTvChannel = useRadioStore((state) => state.currentTvChannel);
  const playTvChannel = useRadioStore((state) => state.playTvChannel);
  const setCountryModalOpen = useRadioStore(
    (state) => state.setCountryModalOpen
  );
  const setSelectedCountryCode = useRadioStore(
    (state) => state.setSelectedCountryCode
  );
  const customTvChannels = useRadioStore((state) => state.customTvChannels);
  const importCustomTvChannels = useRadioStore(
    (state) => state.importCustomTvChannels
  );
  const clearCustomTvChannels = useRadioStore(
    (state) => state.clearCustomTvChannels
  );
  const favoriteTvChannels = useRadioStore((state) => state.favoriteTvChannels);
  const adultContentEnabled = useRadioStore(
    (state) => state.adultContentEnabled
  );
  const recentTvSearches = useRadioStore((state) => state.recentTvSearches);
  const addRecentTvSearch = useRadioStore((state) => state.addRecentTvSearch);
  const removeRecentTvSearch = useRadioStore(
    (state) => state.removeRecentTvSearch
  );
  const clearRecentTvSearches = useRadioStore(
    (state) => state.clearRecentTvSearches
  );

  const [isM3uPanelOpen, setIsM3uPanelOpen] = useState(false);
  const [m3uUrlInput, setM3uUrlInput] = useState('');
  const [m3uRawTextInput, setM3uRawTextInput] = useState('');
  const [showRawPaste, setShowRawPaste] = useState(false);
  const [m3uFeedback, setM3uFeedback] = useState<string | null>(null);
  const m3uFileRef = useRef<HTMLInputElement | null>(null);

  const {
    filteredChannels,
    visibleChannels,
    popularCategories,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    searchScope,
    setSearchScope,
    selectedCategory,
    setSelectedCategory,
    onlyCustom,
    setOnlyCustom,
    onlyFavorites,
    setOnlyFavorites,
    sortBy,
    setSortBy,
    hasMore,
    loadMore,
    resetFilters,
    refreshChannels,
  } = useTvChannels(selectedCountry.iso_3166_1);

  const isGlobalSelected =
    selectedCountry.iso_3166_1 === 'ALL' || searchScope === 'all';

  // Group TV channels by country and sort by localized country name when in global mode
  const groupedByCountry = useMemo(() => {
    if (!isGlobalSelected) return [];

    const groupsMap = new Map<
      string,
      {
        countryCode: string;
        countryName: string;
        flag: string;
        channels: TvChannel[];
      }
    >();

    for (const ch of filteredChannels) {
      const code = (ch.countryCode || 'INT').toUpperCase();
      let group = groupsMap.get(code);
      if (!group) {
        const localizedName =
          code === 'INT'
            ? 'International'
            : getLocalizedCountryName(code, code, language);
        group = {
          countryCode: code,
          countryName: localizedName,
          flag: code === 'INT' ? '🌐' : getCountryFlagEmoji(code),
          channels: [],
        };
        groupsMap.set(code, group);
      }
      group.channels.push(ch);
    }

    const sortedGroups = Array.from(groupsMap.values()).sort((a, b) =>
      a.countryName.localeCompare(b.countryName, language)
    );

    if (searchQuery.trim().length > 0) {
      return sortedGroups;
    }

    let remaining = visibleChannels.length;
    const slicedGroups: typeof sortedGroups = [];
    for (const grp of sortedGroups) {
      if (remaining <= 0) break;
      const take = grp.channels.slice(0, remaining);
      slicedGroups.push({ ...grp, channels: take });
      remaining -= take.length;
    }
    return slicedGroups;
  }, [
    isGlobalSelected,
    filteredChannels,
    visibleChannels.length,
    searchQuery,
    language,
  ]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '280px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMore]);

  const cleanRecentTvSearches = useMemo(() => {
    const out: string[] = [];
    for (const raw of recentTvSearches) {
      const term = raw.trim();
      if (term.length < 2) continue;
      const lower = term.toLowerCase();
      const isPrefixOfOther = recentTvSearches.some((other) => {
        const oLower = other.trim().toLowerCase();
        return oLower !== lower && oLower.startsWith(lower);
      });
      if (!isPrefixOfOther && !out.some((x) => x.toLowerCase() === lower)) {
        out.push(term);
      }
    }
    return out.slice(0, 6);
  }, [recentTvSearches]);

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="space-y-2.5 sm:space-y-5">
      {/* Favorite TV Channels Strip — hidden on mobile when searching */}
      {favoriteTvChannels.length > 0 && !onlyFavorites && (
        <section
          aria-labelledby="favorite-tv-strip-heading"
          className={`space-y-1.5 sm:space-y-2 ${isSearching ? 'hidden sm:block' : ''}`}
        >
          <div className="flex items-center justify-between">
            <h2
              id="favorite-tv-strip-heading"
              className="text-xs sm:text-base font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5"
            >
              <Heart
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600 dark:text-rose-400 fill-current"
                aria-hidden="true"
              />
              <span>{t.tv.favoriteTvTitle}</span>
              <span className="text-[10px] sm:text-[11px] font-semibold px-1.5 py-0.2 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                {favoriteTvChannels.length}
              </span>
            </h2>

            <button
              type="button"
              onClick={() => {
                setOnlyFavorites(true);
                setOnlyCustom(false);
              }}
              className="min-h-[26px] sm:min-h-[32px] px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              Vezi toate →
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto pb-1 no-scrollbar">
            {favoriteTvChannels.map((channel) => {
              const isCurrent = currentTvChannel?.id === channel.id;
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() =>
                    playTvChannel(channel, favoriteTvChannels)
                  }
                  aria-label={format(t.tv.watchChannel, { name: channel.name })}
                  className={`group flex-shrink-0 flex items-center gap-2 max-w-[165px] sm:max-w-none sm:w-44 px-2.5 py-1.5 sm:p-2.5 rounded-full sm:rounded-2xl border text-left transition-all ${
                    isCurrent
                      ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-500/70'
                      : 'bg-white dark:bg-zinc-900/80 border-rose-200/80 dark:border-rose-900/50 hover:border-rose-400'
                  }`}
                >
                  <div className="shrink-0">
                    <StationAvatar
                      name={channel.name}
                      favicon={channel.logo}
                      size="sm"
                      isPlaying={isCurrent}
                    />
                  </div>
                  <div className="min-w-0 flex-1 pr-1">
                    <p className="text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate">
                      {channel.name}
                    </p>
                    <p className="hidden sm:block text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                      {channel.group ? channel.group.split(';')[0] : 'Live TV'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Recently Watched TV Strip — on mobile only shown if favoriteTvChannels is empty and not searching, to avoid double horizontal strips */}
      {recentTvChannels.length > 0 && (
        <section
          aria-labelledby="recent-tv-heading"
          className={`space-y-1.5 sm:space-y-2 ${
            isSearching || favoriteTvChannels.length > 0 ? 'hidden sm:block' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <h2
              id="recent-tv-heading"
              className="text-xs sm:text-base font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5"
            >
              <Clock
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-700 dark:text-brand-400"
                aria-hidden="true"
              />
              <span>{t.tv.recentlyWatched}</span>
              <span className="text-[10px] sm:text-[11px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                {recentTvChannels.length}
              </span>
            </h2>

            <button
              type="button"
              onClick={clearRecentTvChannels}
              aria-label={t.home.clearRecent}
              className="min-h-[26px] sm:min-h-[32px] px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" aria-hidden="true" />
              <span>{t.home.clearRecent}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto pb-1 no-scrollbar">
            {recentTvChannels.map((channel) => {
              const isCurrent = currentTvChannel?.id === channel.id;
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() =>
                    playTvChannel(
                      channel,
                      filteredChannels.length > 0
                        ? filteredChannels
                        : recentTvChannels
                    )
                  }
                  aria-label={format(t.tv.watchChannel, { name: channel.name })}
                  className={`group flex-shrink-0 flex items-center gap-2 max-w-[165px] sm:max-w-none sm:w-44 px-2.5 py-1.5 sm:p-2.5 rounded-full sm:rounded-2xl border text-left transition-all ${
                    isCurrent
                      ? 'bg-brand-50/90 dark:bg-brand-950/40 border-brand-500/70'
                      : 'bg-white dark:bg-zinc-900/80 border-slate-200/80 dark:border-zinc-800/80 hover:border-brand-400/60'
                  }`}
                >
                  <div className="shrink-0">
                    <StationAvatar
                      name={channel.name}
                      favicon={channel.logo}
                      size="sm"
                      isPlaying={isCurrent}
                    />
                  </div>
                  <div className="min-w-0 flex-1 pr-1">
                    <p className="text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate">
                      {channel.name}
                    </p>
                    <p className="hidden sm:block text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                      {channel.group ? channel.group.split(';')[0] : 'Live TV'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Main TV Channels Section */}
      <section aria-labelledby="tv-channels-heading" className="space-y-2 sm:space-y-3.5">
        {/* Quick Toolbar (on mobile just the 1-line scrollable action pills; on desktop also includes Country Title) */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 sm:bg-white sm:dark:bg-zinc-900/90 sm:px-4 sm:py-3 sm:rounded-2xl sm:border sm:border-slate-200/80 sm:dark:border-zinc-800/80 sm:shadow-xs overflow-hidden">
          <div className="hidden sm:flex items-center gap-3 min-w-0">
            <span className="text-3xl leading-none select-none shrink-0" aria-hidden="true">
              {isGlobalSelected ? '🌍' : selectedCountry.flag}
            </span>
            <div className="min-w-0 flex-1">
              <h1
                id="tv-channels-heading"
                tabIndex={-1}
                className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight truncate"
              >
                {isGlobalSelected
                  ? t.tv.globalChannelsTitle
                  : `${t.tv.channelsIn} ${selectedCountry.localizedName}`}
              </h1>
              <p className="text-xs text-slate-600 dark:text-zinc-400 truncate">
                {format(t.tv.channelsCount, {
                  count: filteredChannels.length,
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
            {[
              { code: 'RO', flag: '🇷🇴', label: 'RO HD' },
              { code: 'MD', flag: '🇲🇩', label: 'MD HD' },
              { code: 'RU', flag: '🇷🇺', label: 'RU HD' },
            ].map((item) => {
              const isSelectedCountry =
                selectedCountry.iso_3166_1 === item.code &&
                searchScope === 'country' &&
                !onlyFavorites &&
                !onlyCustom;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    setSelectedCountryCode(item.code);
                    setSearchScope('country');
                    setOnlyFavorites(false);
                    setOnlyCustom(false);
                  }}
                  className={`min-h-[30px] sm:min-h-[36px] px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors border ${
                    isSelectedCountry
                      ? 'bg-brand-700 text-white border-brand-700 shadow-xs'
                      : 'bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 dark:hover:bg-brand-900/60 border-brand-200 dark:border-brand-800 text-brand-800 dark:text-brand-200'
                  }`}
                >
                  <span aria-hidden="true">{item.flag}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}

            {favoriteTvChannels.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const next = !onlyFavorites;
                  setOnlyFavorites(next);
                  if (next) setOnlyCustom(false);
                }}
                aria-pressed={onlyFavorites}
                className={`min-h-[30px] sm:min-h-[36px] px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors border ${
                  onlyFavorites
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100'
                }`}
              >
                <Heart
                  className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${onlyFavorites ? 'fill-current' : ''}`}
                  aria-hidden="true"
                />
                <span>Fav ({favoriteTvChannels.length})</span>
              </button>
            )}

            {customTvChannels.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const next = !onlyCustom;
                  setOnlyCustom(next);
                  if (next) setOnlyFavorites(false);
                }}
                aria-pressed={onlyCustom}
                className={`min-h-[30px] sm:min-h-[36px] px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors border ${
                  onlyCustom
                    ? 'bg-brand-700 text-white border-brand-700 dark:bg-brand-600 dark:border-brand-500 shadow-xs'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <Tv className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
                <span>Playlist ({customTvChannels.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsM3uPanelOpen((v) => !v)}
              aria-expanded={isM3uPanelOpen}
              className={`min-h-[30px] sm:min-h-[36px] px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors border ${
                isM3uPanelOpen
                  ? 'bg-brand-700 text-white border-brand-700'
                  : 'bg-brand-50/80 dark:bg-brand-950/40 hover:bg-brand-100 dark:hover:bg-brand-900/50 text-brand-800 dark:text-brand-200 border-brand-200 dark:border-brand-800'
              }`}
            >
              <Upload className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
              <span>Import M3U</span>
            </button>

            {filteredChannels.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const m3uContent = exportTvChannelsToM3u(filteredChannels);
                  const dateStr = new Date().toISOString().slice(0, 10);
                  const suffix = onlyFavorites
                    ? 'favorite-tv'
                    : onlyCustom
                      ? 'custom-tv'
                      : selectedCountry.iso_3166_1.toLowerCase();
                  downloadM3uFile(m3uContent, `aether-tv-${suffix}-${dateStr}.m3u`);
                }}
                title="Descarcă lista curentă în format .m3u"
                className="min-h-[30px] sm:min-h-[36px] px-2.5 sm:px-3 py-1 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
              >
                <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
                <span>.M3U</span>
              </button>
            )}

            <button
              type="button"
              onClick={refreshChannels}
              aria-label={t.home.refreshList}
              title={t.home.refreshList}
              className="hidden sm:flex min-w-[36px] min-h-[36px] rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 items-center justify-center shrink-0 transition-colors"
            >
              <RefreshCw
                aria-hidden="true"
                className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Custom M3U / IEdem.TV Playlist Importer Panel */}
        {isM3uPanelOpen && (
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-brand-300 dark:border-brand-800/80 space-y-3.5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100">
                  Importă Playlist M3U / M3U8 (iEdem.TV, Edem, IPTV cu abonament sau listă proprie)
                </h2>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
                  1) Din contul tău <strong>iEdem.TV</strong> descarcă fișierul <code>edem_pl.m3u8</code> (sau copiază link-ul direct către playlist) și încarcă-l mai jos. Toate grupurile (<code>#EXTGRP</code>), variantele <em>Первый канал (+2/+4/HD/4K)</em> și logo-urile sunt detectate automat!
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRawPaste((v) => !v)}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  {showRawPaste ? 'Ascunde editorul text' : 'Lipește text #EXTM3U'}
                </button>
                {customTvChannels.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearCustomTvChannels();
                      setOnlyCustom(false);
                      setM3uFeedback('Playlistul personalizat a fost șters.');
                    }}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    Șterge playlistul ({customTvChannels.length})
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                ref={m3uFileRef}
                type="file"
                accept=".m3u,.m3u8,audio/x-mpegurl,application/vnd.apple.mpegurl,text/plain"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  const parsed = parseM3uPlaylist(
                    text,
                    selectedCountry.iso_3166_1 === 'ALL'
                      ? 'RU'
                      : selectedCountry.iso_3166_1,
                    { isCustomImport: true }
                  );
                  const count = importCustomTvChannels(parsed);
                  if (count > 0) {
                    setOnlyCustom(true);
                    setSelectedCategory('');
                  }
                  setM3uFeedback(
                    count > 0
                      ? `✅ Am importat ${count} canale TV din fișierul "${file.name}"! Afișez acum playlistul tău.`
                      : `⚠️ Nu am găsit canale valide în fișierul "${file.name}".`
                  );
                  e.target.value = '';
                }}
                className="visually-hidden"
              />
              <button
                type="button"
                onClick={() => m3uFileRef.current?.click()}
                className="min-h-[44px] px-4 py-2 rounded-full bg-brand-700 hover:bg-brand-600 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <Upload className="w-4 h-4" aria-hidden="true" />
                <span>Încarcă fișierul .m3u / .m3u8 (edem_pl.m3u8)</span>
              </button>

              <div className="relative flex-1">
                <Link2
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="url"
                  value={m3uUrlInput}
                  onChange={(e) => setM3uUrlInput(e.target.value)}
                  placeholder="Sau lipește link-ul direct către playlistul tău .m3u8 / iEdem.TV..."
                  className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs sm:text-sm text-slate-900 dark:text-zinc-100"
                />
              </div>

              <button
                type="button"
                onClick={async () => {
                  const url = m3uUrlInput.trim();
                  if (!url) return;
                  try {
                    setM3uFeedback('Se descarcă playlistul...');
                    const res = await fetch(
                      `/api/tv-proxy?raw=1&url=${encodeURIComponent(url)}`
                    );
                    if (!res.ok) {
                      throw new Error(`HTTP ${res.status}`);
                    }
                    const rawText = await res.text();
                    const parsed = parseM3uPlaylist(
                      rawText,
                      selectedCountry.iso_3166_1 === 'ALL'
                        ? 'RU'
                        : selectedCountry.iso_3166_1,
                      { isCustomImport: true }
                    );
                    const count = importCustomTvChannels(parsed);
                    if (count > 0) {
                      setOnlyCustom(true);
                      setSelectedCategory('');
                    }
                    setM3uFeedback(
                      count > 0
                        ? `✅ Am importat ${count} canale TV din link! Afișez acum playlistul tău.`
                        : '⚠️ Link-ul a răspuns, dar nu conține canale #EXTINF valide.'
                    );
                    if (count > 0) setM3uUrlInput('');
                  } catch {
                    setM3uFeedback(
                      '⚠️ Nu am putut descărca link-ul M3U. Descarcă fișierul .m3u8 în calculator și apasă pe „Încarcă fișierul .m3u / .m3u8”.'
                    );
                  }
                }}
                className="min-h-[44px] px-4 py-2 rounded-full bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-zinc-900 text-xs sm:text-sm font-semibold transition-colors"
              >
                Importă din URL
              </button>
            </div>

            {showRawPaste && (
              <div className="space-y-2 pt-1">
                <textarea
                  rows={4}
                  value={m3uRawTextInput}
                  onChange={(e) => setM3uRawTextInput(e.target.value)}
                  placeholder={'#EXTM3U\n#EXTINF:0,Первый канал HD\n#EXTGRP:Общие\nhttp://.../index.m3u8'}
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-mono text-slate-900 dark:text-zinc-100"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!m3uRawTextInput.trim()) return;
                    const parsed = parseM3uPlaylist(
                      m3uRawTextInput,
                      selectedCountry.iso_3166_1 === 'ALL'
                        ? 'RU'
                        : selectedCountry.iso_3166_1,
                      { isCustomImport: true }
                    );
                    const count = importCustomTvChannels(parsed);
                    if (count > 0) {
                      setOnlyCustom(true);
                      setSelectedCategory('');
                      setM3uRawTextInput('');
                      setShowRawPaste(false);
                    }
                    setM3uFeedback(
                      count > 0
                        ? `✅ Am importat ${count} canale TV din textul M3U!`
                        : '⚠️ Nu am găsit linii #EXTINF + http:// valide în text.'
                    );
                  }}
                  className="min-h-[38px] px-4 py-1.5 rounded-full bg-brand-700 hover:bg-brand-600 text-white text-xs font-semibold transition-colors"
                >
                  Importă textul M3U lipit
                </button>
              </div>
            )}

            {m3uFeedback && (
              <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">
                {m3uFeedback}
              </p>
            )}

            {/* Export M3U section for other devices */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                Exportă playlist <code>.m3u</code> pentru Smart TV, TiviMate, OTT Navigator, VLC sau telefon:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {filteredChannels.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const m3u = exportTvChannelsToM3u(filteredChannels);
                      const dateStr = new Date().toISOString().slice(0, 10);
                      downloadM3uFile(
                        m3u,
                        `aether-tv-${selectedCountry.iso_3166_1.toLowerCase()}-${dateStr}.m3u`
                      );
                    }}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-full bg-brand-50 dark:bg-brand-950/60 hover:bg-brand-100 text-brand-800 dark:text-brand-200 border border-brand-200 dark:border-brand-800 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Lista curentă ({filteredChannels.length})</span>
                  </button>
                )}

                {favoriteTvChannels.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const m3u = exportTvChannelsToM3u(favoriteTvChannels);
                      const dateStr = new Date().toISOString().slice(0, 10);
                      downloadM3uFile(m3u, `aether-tv-favorites-${dateStr}.m3u`);
                    }}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-200 border border-rose-200 dark:border-rose-800 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Favorite TV ({favoriteTvChannels.length})</span>
                  </button>
                )}

                {customTvChannels.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const m3u = exportTvChannelsToM3u(customTvChannels);
                      const dateStr = new Date().toISOString().slice(0, 10);
                      downloadM3uFile(m3u, `aether-tv-my-playlist-${dateStr}.m3u`);
                    }}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Playlistul meu ({customTvChannels.length})</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Search, Scope Toggle & Sort Controls */}
        <div className="flex flex-col lg:flex-row gap-1.5 sm:gap-2.5">
          <div className="flex items-center gap-1.5 flex-1">
            <div className="relative flex-1">
              <label htmlFor={searchInputId} className="visually-hidden">
                {t.tv.searchPlaceholder}
              </label>
              <Search
                aria-hidden="true"
                className="w-4 h-4 text-slate-500 dark:text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                id={searchInputId}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim().length >= 2) {
                    addRecentTvSearch(searchQuery.trim());
                    e.currentTarget.blur();
                  }
                }}
                placeholder={t.tv.searchPlaceholder}
                className="w-full min-h-[38px] sm:min-h-[42px] pl-9 pr-9 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-400 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={t.header.clearSearch}
                  className="min-w-[32px] min-h-[32px] rounded-full absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={refreshChannels}
              aria-label={t.home.refreshList}
              title={t.home.refreshList}
              className="sm:hidden w-9 h-9 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center shrink-0"
            >
              <RefreshCw
                aria-hidden="true"
                className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-1.5 overflow-x-auto no-scrollbar">
            {selectedCountry.iso_3166_1 !== 'ALL' && (
              <div
                role="group"
                aria-label={t.header.changeCountry}
                className="inline-flex p-0.5 rounded-full bg-slate-200/80 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shrink-0"
              >
                <button
                  type="button"
                  onClick={() => setSearchScope('country')}
                  aria-pressed={searchScope === 'country'}
                  className={`min-h-[30px] sm:min-h-[34px] px-2.5 sm:px-3 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap transition-all ${
                    searchScope === 'country'
                      ? 'bg-brand-700 text-white dark:bg-brand-600 shadow-xs'
                      : 'text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span aria-hidden="true">{selectedCountry.flag}</span>
                  <span className="truncate max-w-[95px] sm:max-w-none">
                    {selectedCountry.localizedName}
                  </span>
                  {searchScope === 'country' && (
                    <span className="text-[10px] opacity-85">
                      ({filteredChannels.length})
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSearchScope('all')}
                  aria-pressed={searchScope === 'all'}
                  className={`min-h-[30px] sm:min-h-[34px] px-2.5 sm:px-3 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap transition-all ${
                    searchScope === 'all'
                      ? 'bg-brand-700 text-white dark:bg-brand-600 shadow-xs'
                      : 'text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span aria-hidden="true">🌍</span>
                  <span>{t.home.searchScopeAll}</span>
                  {searchScope === 'all' && (
                    <span className="text-[10px] opacity-85">
                      ({filteredChannels.length})
                    </span>
                  )}
                </button>
              </div>
            )}

            <div className="flex items-center gap-1.5 shrink-0">
              <label
                htmlFor={sortSelectId}
                className="hidden sm:flex text-xs font-medium text-slate-600 dark:text-zinc-400 whitespace-nowrap items-center gap-1 pl-1"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t.home.sortBy}</span>
              </label>
              <select
                id={sortSelectId}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as TvSortOption)}
                className="min-h-[32px] sm:min-h-[36px] px-2.5 sm:px-3 py-1 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-900 dark:text-zinc-100 shadow-2xs cursor-pointer"
              >
                <option value="quality">{t.tv.sortQuality}</option>
                <option value="name">{t.tv.sortName}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Recent TV Searches Chips — shown only when not actively searching */}
        {!isSearching && cleanRecentTvSearches.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 flex items-center gap-1 flex-shrink-0">
              <Clock className="w-3 h-3" aria-hidden="true" />
              <span>Căutări TV:</span>
            </span>
            {cleanRecentTvSearches.map((term) => (
              <div
                key={term}
                className="inline-flex items-center rounded-full border bg-white dark:bg-zinc-900 border-slate-200/80 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 text-[11px] font-medium flex-shrink-0"
              >
                <button
                  type="button"
                  onClick={() => setSearchQuery(term)}
                  className="px-2.5 py-0.5 rounded-l-full hover:text-brand-700 dark:hover:text-brand-300"
                >
                  {term}
                </button>
                <button
                  type="button"
                  onClick={() => removeRecentTvSearch(term)}
                  aria-label={`Șterge căutarea ${term}`}
                  className="pr-2 pl-0.5 py-0.5 rounded-r-full text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={clearRecentTvSearches}
              className="text-[11px] rounded-full text-slate-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 px-2 py-0.5 flex-shrink-0"
            >
              Șterge
            </button>
          </div>
        )}

        {/* Category Filter Bar */}
        {popularCategories.length > 0 && (
          <div
            role="region"
            aria-label={t.tv.allCategories}
            className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar"
          >
            <button
              type="button"
              onClick={() => setSelectedCategory('')}
              aria-pressed={selectedCategory === ''}
              className={`min-h-[30px] sm:min-h-[36px] px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === ''
                  ? 'bg-brand-700 text-white dark:bg-brand-600 shadow-xs'
                  : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-800/80 hover:border-brand-400'
              }`}
            >
              {t.tv.allCategories}
            </button>

            <button
              type="button"
              onClick={() =>
                setSelectedCategory(
                  selectedCategory === '__cinema__' ? '' : '__cinema__'
                )
              }
              aria-pressed={selectedCategory === '__cinema__'}
              className={`min-h-[30px] sm:min-h-[36px] px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors inline-flex items-center gap-1 ${
                selectedCategory === '__cinema__'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800/80 hover:bg-amber-100'
              }`}
            >
              <span aria-hidden="true">🎬</span>
              <span>Cinema</span>
            </button>

            {adultContentEnabled && (
              <button
                type="button"
                onClick={() =>
                  setSelectedCategory(
                    selectedCategory === '__adult__' ? '' : '__adult__'
                  )
                }
                aria-pressed={selectedCategory === '__adult__'}
                className={`min-h-[30px] sm:min-h-[36px] px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors inline-flex items-center gap-1 ${
                  selectedCategory === '__adult__'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-300/80 dark:border-rose-800/80 hover:bg-rose-100'
                }`}
              >
                <span aria-hidden="true">🔞</span>
                <span>18+ Adulți / Для взрослых</span>
              </button>
            )}

            {popularCategories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(active ? '' : cat)}
                  aria-pressed={active}
                  className={`min-h-[30px] sm:min-h-[36px] px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-full text-xs font-medium whitespace-nowrap capitalize transition-colors ${
                    active
                      ? 'bg-brand-700 text-white dark:bg-brand-600 shadow-xs'
                      : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-800/80 hover:border-brand-400'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}

        {/* Channels Grid / States */}
        {isLoading ? (
          <StationSkeleton count={12} />
        ) : error ? (
          <EmptyState
            icon={<WifiOff className="w-7 h-7" />}
            title={t.home.networkErrorTitle}
            description={t.home.networkErrorDesc}
            actionLabel={t.home.retryFetch}
            onAction={refreshChannels}
          />
        ) : filteredChannels.length === 0 ? (
          <EmptyState
            icon={<Tv className="w-7 h-7" />}
            title={t.tv.noChannelsTitle}
            description={t.tv.noChannelsDesc}
            actionLabel={
              searchQuery || selectedCategory
                ? t.home.resetFilters
                : t.home.searchScopeAll
            }
            onAction={
              searchQuery || selectedCategory
                ? resetFilters
                : () => setSearchScope('all')
            }
          />
        ) : (
          <>
            {isGlobalSelected ? (
              <div className="space-y-8">
                {groupedByCountry.map((group) => (
                  <div key={group.countryCode} className="space-y-3.5">
                    <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-zinc-800/80 pb-2.5">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2.5">
                        <span className="text-2xl leading-none" aria-hidden="true">
                          {group.flag}
                        </span>
                        <span>{group.countryName}</span>
                      </h2>
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-100 dark:bg-brand-950/70 text-brand-800 dark:text-brand-300">
                        {group.channels.length} TV
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3.5">
                      {group.channels.map((channel, index) => (
                        <TvChannelCard
                          key={channel.id}
                          channel={channel}
                          queue={filteredChannels}
                          isDeferred={index >= 12}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3.5">
                {visibleChannels.map((channel, index) => (
                  <TvChannelCard
                    key={channel.id}
                    channel={channel}
                    queue={filteredChannels}
                    isDeferred={index >= 12}
                  />
                ))}
              </div>
            )}

            {/* Pagination / Infinite Scroll Sentinel */}
            <div
              ref={sentinelRef}
              className="pt-4 pb-2 flex flex-col items-center justify-center gap-3"
            >
              <p className="text-xs text-slate-600 dark:text-zinc-400">
                {format(t.home.showingCount, {
                  shown: visibleChannels.length,
                  total: filteredChannels.length,
                })}
              </p>
              {hasMore && (
                <button
                  type="button"
                  onClick={loadMore}
                  className="min-h-[44px] px-6 py-2.5 rounded-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 hover:border-brand-500 text-sm font-semibold text-slate-800 dark:text-zinc-200 shadow-xs transition-colors"
                >
                  {t.home.loadMore}
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
};
