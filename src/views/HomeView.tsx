import React, { useEffect, useRef, useId, useMemo } from 'react';
import {
  Search,
  X,
  RefreshCw,
  Clock,
  Trash2,
  Radio,
  WifiOff,
  SlidersHorizontal,
  Globe,
} from 'lucide-react';
import { useRadioStore } from '../store/useRadioStore';
import { useTranslation } from '../i18n/useTranslation';
import { useStations } from '../hooks/useStations';
import { EnrichedCountry } from '../hooks/useCountries';
import { StationCard } from '../components/stations/StationCard';
import { StationSkeleton } from '../components/stations/StationSkeleton';
import { TagFilterBar } from '../components/stations/TagFilterBar';
import { EmptyState } from '../components/common/EmptyState';
import { StationAvatar } from '../components/common/StationAvatar';
import { SortOption, Station } from '../types/radio';
import {
  getCountryFlagEmoji,
  getLocalizedCountryName,
} from '../services/geoLanguageService';

interface HomeViewProps {
  selectedCountry: EnrichedCountry;
}

export const HomeView: React.FC<HomeViewProps> = ({ selectedCountry }) => {
  const { t, language, format } = useTranslation();
  const searchInputId = useId();
  const sortSelectId = useId();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const recentlyPlayed = useRadioStore((state) => state.recentlyPlayed);
  const clearRecentlyPlayed = useRadioStore(
    (state) => state.clearRecentlyPlayed
  );
  const currentStation = useRadioStore((state) => state.currentStation);
  const playerStatus = useRadioStore((state) => state.playerStatus);
  const playStation = useRadioStore((state) => state.playStation);
  const setCountryModalOpen = useRadioStore(
    (state) => state.setCountryModalOpen
  );
  const recentRadioSearches = useRadioStore(
    (state) => state.recentRadioSearches
  );
  const addRecentRadioSearch = useRadioStore(
    (state) => state.addRecentRadioSearch
  );
  const removeRecentRadioSearch = useRadioStore(
    (state) => state.removeRecentRadioSearch
  );
  const clearRecentRadioSearches = useRadioStore(
    (state) => state.clearRecentRadioSearches
  );

  const {
    filteredStations,
    visibleStations,
    popularTags,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    searchScope,
    setSearchScope,
    selectedTag,
    setSelectedTag,
    sortBy,
    setSortBy,
    hasMore,
    loadMore,
    resetFilters,
    refreshStations,
  } = useStations(selectedCountry.iso_3166_1);

  const isGlobalSelected =
    selectedCountry.iso_3166_1 === 'ALL' || searchScope === 'all';

  // Group stations by country and sort by localized country name when searching/browsing globally
  const groupedByCountry = useMemo(() => {
    if (!isGlobalSelected) return [];

    const groupsMap = new Map<
      string,
      {
        countryCode: string;
        countryName: string;
        flag: string;
        stations: Station[];
      }
    >();

    for (const st of filteredStations) {
      const code = (st.countrycode || 'XX').toUpperCase();
      let group = groupsMap.get(code);
      if (!group) {
        const localizedName = getLocalizedCountryName(
          code,
          st.country || code,
          language
        );
        group = {
          countryCode: code,
          countryName: localizedName,
          flag: getCountryFlagEmoji(code),
          stations: [],
        };
        groupsMap.set(code, group);
      }
      group.stations.push(st);
    }

    const sortedGroups = Array.from(groupsMap.values()).sort((a, b) =>
      a.countryName.localeCompare(b.countryName, language)
    );

    // If user is actively searching globally, show all matching country groups;
    // otherwise cap total rendered cards to visibleStations.length for smooth infinite scroll
    if (searchQuery.trim().length > 0) {
      return sortedGroups;
    }

    let remaining = visibleStations.length;
    const slicedGroups: typeof sortedGroups = [];
    for (const grp of sortedGroups) {
      if (remaining <= 0) break;
      const take = grp.stations.slice(0, remaining);
      slicedGroups.push({ ...grp, stations: take });
      remaining -= take.length;
    }
    return slicedGroups;
  }, [
    isGlobalSelected,
    filteredStations,
    visibleStations.length,
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

  return (
    <div className="space-y-8">
      {/* Recently Played Horizontal Strip (Last 20 stations) */}
      {recentlyPlayed.length > 0 && (
        <section aria-labelledby="recent-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2
              id="recent-heading"
              className="text-xl font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2"
            >
              <Clock
                className="w-5 h-5 text-brand-700 dark:text-brand-400"
                aria-hidden="true"
              />
              <span>{t.home.recentlyPlayed}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                {recentlyPlayed.length}
              </span>
            </h2>

            <button
              type="button"
              onClick={clearRecentlyPlayed}
              aria-label={t.home.clearRecent}
              className="min-h-[44px] px-3.5 py-1.5 rounded-full text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-zinc-900 inline-flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.home.clearRecent}</span>
            </button>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-0.5 no-scrollbar">
            {recentlyPlayed.map((station) => {
              const isCurrent =
                currentStation?.stationuuid === station.stationuuid;
              const isPlaying = isCurrent && playerStatus === 'playing';
              return (
                <button
                  key={station.stationuuid}
                  type="button"
                  onClick={() => playStation(station, recentlyPlayed)}
                  aria-label={format(
                    isPlaying ? t.player.pause : t.player.play,
                    { name: station.name }
                  )}
                  className={`group flex-shrink-0 w-36 p-3 rounded-2xl border text-left transition-all ${
                    isCurrent
                      ? 'bg-brand-50/90 dark:bg-brand-950/40 border-brand-500/70'
                      : 'bg-white dark:bg-zinc-900/80 border-slate-200/80 dark:border-zinc-800/80 hover:border-brand-400/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <StationAvatar
                      name={station.name}
                      favicon={station.favicon}
                      homepage={station.homepage}
                      size="sm"
                      isPlaying={isPlaying}
                    />
                    <span className="text-[11px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                      {station.countrycode || 'FM'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                    {station.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                    {station.tags
                      ? station.tags.split(',')[0].trim()
                      : station.codec || 'Live'}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Country Stations Section */}
      <section aria-labelledby="country-stations-heading" className="space-y-4">
        {/* Hero / Country Title Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900/90 p-5 rounded-3xl border border-slate-200/80 dark:border-zinc-800/80 shadow-xs">
          <div className="flex items-center gap-3.5">
            <span className="text-4xl leading-none select-none" aria-hidden="true">
              {isGlobalSelected ? '🌍' : selectedCountry.flag}
            </span>
            <div>
              <h1
                id="country-stations-heading"
                tabIndex={-1}
                className="text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight"
              >
                {isGlobalSelected
                  ? t.home.globalStationsTitle
                  : `${t.home.stationsIn} ${selectedCountry.localizedName}`}
              </h1>
              <p className="text-sm text-slate-600 dark:text-zinc-400 mt-0.5">
                {format(t.home.stationsCount, {
                  count: filteredStations.length,
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCountryModalOpen(true)}
              className="min-h-[44px] px-4 py-2 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-sm font-medium inline-flex items-center gap-2 transition-colors"
            >
              <Globe className="w-4 h-4" aria-hidden="true" />
              <span>{t.header.changeCountry}</span>
            </button>

            <button
              type="button"
              onClick={refreshStations}
              aria-label={t.home.refreshList}
              title={t.home.refreshList}
              className="min-w-[44px] min-h-[44px] rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 flex items-center justify-center transition-colors"
            >
              <RefreshCw
                aria-hidden="true"
                className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Search, Scope Toggle (Current Country vs All Countries) & Sort Controls */}
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <label htmlFor={searchInputId} className="visually-hidden">
              {t.header.searchPlaceholder}
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
                  addRecentRadioSearch(searchQuery.trim());
                }
              }}
              placeholder={t.header.searchPlaceholder}
              className="w-full min-h-[46px] pl-10 pr-10 py-2.5 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-400 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label={t.header.clearSearch}
                className="min-w-[40px] min-h-[40px] rounded-full absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Scope Toggle: Current Country vs. All Countries */}
            {selectedCountry.iso_3166_1 !== 'ALL' && (
              <div
                role="group"
                aria-label={t.header.changeCountry}
                className="inline-flex p-1 rounded-full bg-slate-200/80 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"
              >
                <button
                  type="button"
                  onClick={() => setSearchScope('country')}
                  aria-pressed={searchScope === 'country'}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-all ${
                    searchScope === 'country'
                      ? 'bg-brand-700 text-white dark:bg-brand-600 shadow-xs'
                      : 'text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span aria-hidden="true">{selectedCountry.flag}</span>
                  <span>
                    {format(t.home.searchScopeCountry, {
                      country: selectedCountry.localizedName,
                    })}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSearchScope('all')}
                  aria-pressed={searchScope === 'all'}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-all ${
                    searchScope === 'all'
                      ? 'bg-brand-700 text-white dark:bg-brand-600 shadow-xs'
                      : 'text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span aria-hidden="true">🌍</span>
                  <span>{t.home.searchScopeAll}</span>
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <label
                htmlFor={sortSelectId}
                className="text-xs font-medium text-slate-600 dark:text-zinc-400 whitespace-nowrap flex items-center gap-1.5 pl-1"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t.home.sortBy}</span>
              </label>
              <select
                id={sortSelectId}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="min-h-[46px] px-4 py-2 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-sm font-medium text-slate-900 dark:text-zinc-100 shadow-2xs cursor-pointer"
              >
                <option value="votes">{t.home.sortVotes}</option>
                <option value="clickcount">{t.home.sortClicks}</option>
                <option value="bitrate">{t.home.sortBitrate}</option>
                <option value="name">{t.home.sortName}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Recent Radio Searches Chips */}
        {recentRadioSearches.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400 flex items-center gap-1 flex-shrink-0">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Căutări:</span>
            </span>
            {recentRadioSearches.map((term) => {
              const isSelected =
                searchQuery.trim().toLowerCase() === term.toLowerCase();
              return (
                <div
                  key={term}
                  className={`inline-flex items-center rounded-full border text-xs font-medium flex-shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-brand-100 dark:bg-brand-950/70 border-brand-500 text-brand-900 dark:text-brand-200'
                      : 'bg-white dark:bg-zinc-900 border-slate-200/80 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSearchQuery(term)}
                    className="px-3 py-1 rounded-l-full hover:text-brand-700 dark:hover:text-brand-300"
                  >
                    {term}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRecentRadioSearch(term)}
                    aria-label={`Șterge căutarea ${term}`}
                    className="pr-2.5 pl-0.5 py-1 rounded-r-full text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={clearRecentRadioSearches}
              className="text-xs rounded-full text-slate-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 px-2.5 py-1 flex-shrink-0"
            >
              Șterge
            </button>
          </div>
        )}

        {/* Genre / Tag Chips */}
        <TagFilterBar
          tags={popularTags}
          selectedTag={selectedTag}
          onSelectTag={setSelectedTag}
        />

        {/* Stations List / States */}
        {isLoading ? (
          <StationSkeleton count={12} />
        ) : error ? (
          <EmptyState
            icon={<WifiOff className="w-7 h-7" />}
            title={t.home.networkErrorTitle}
            description={t.home.networkErrorDesc}
            actionLabel={t.home.retryFetch}
            onAction={refreshStations}
          />
        ) : filteredStations.length === 0 ? (
          <EmptyState
            icon={<Radio className="w-7 h-7" />}
            title={t.home.noStationsTitle}
            description={t.home.noStationsDesc}
            actionLabel={
              searchQuery || selectedTag ? t.home.resetFilters : undefined
            }
            onAction={
              searchQuery || selectedTag ? resetFilters : undefined
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
                        {format(t.countries.stationsLabel, {
                          count: group.stations.length,
                        })}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                      {group.stations.map((station, index) => (
                        <StationCard
                          key={station.stationuuid}
                          station={station}
                          queue={filteredStations}
                          isDeferred={index >= 12}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {visibleStations.map((station, index) => (
                  <StationCard
                    key={station.stationuuid}
                    station={station}
                    queue={filteredStations}
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
                  shown: visibleStations.length,
                  total: filteredStations.length,
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

