import { useState, useEffect, useMemo, useCallback } from 'react';
import { Station, SortOption } from '../types/radio';
import {
  fetchStationsByCountry,
  searchStationsGlobal,
} from '../services/radioBrowserApi';
import { useRadioStore } from '../store/useRadioStore';

const PAGE_SIZE = 24;

export type SearchScope = 'country' | 'all';

export function useStations(countryCode: string) {
  const [countryStations, setCountryStations] = useState<Station[]>([]);
  const [globalSearchResults, setGlobalSearchResults] = useState<Station[] | null>(
    null
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGlobalSearching, setIsGlobalSearching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const searchQuery = useRadioStore((state) => state.radioSearchQuery);
  const setSearchQuery = useRadioStore((state) => state.setRadioSearchQuery);
  const addRecentRadioSearch = useRadioStore(
    (state) => state.addRecentRadioSearch
  );
  const [searchScope, setSearchScope] = useState<SearchScope>(
    countryCode.toUpperCase() === 'ALL' ? 'all' : 'country'
  );
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('votes');
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  const setStationQueue = useRadioStore((state) => state.setStationQueue);

  // Automatically record non-empty searches into recentRadioSearches after a short pause
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) return;
    const timer = window.setTimeout(() => {
      addRecentRadioSearch(trimmed);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [searchQuery, addRecentRadioSearch]);

  const loadStations = useCallback(
    async (force = false) => {
      if (!countryCode) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchStationsByCountry(countryCode, force);
        setCountryStations(data);
        setStationQueue(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load radio stations'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [countryCode, setStationQueue]
  );

  useEffect(() => {
    setSelectedTag('');
    setGlobalSearchResults(null);
    setSearchScope(countryCode.toUpperCase() === 'ALL' ? 'all' : 'country');
    setVisibleCount(PAGE_SIZE);
    loadStations(false);
  }, [countryCode, loadStations]);

  // Trigger live global search across all countries when scope is 'all' (or countryCode === 'ALL') and searchQuery is non-empty
  useEffect(() => {
    const isGlobalMode =
      searchScope === 'all' || countryCode.toUpperCase() === 'ALL';
    const trimmed = searchQuery.trim();

    if (!isGlobalMode || trimmed.length < 2) {
      setGlobalSearchResults(null);
      setIsGlobalSearching(false);
      return;
    }

    let isCancelled = false;
    setIsGlobalSearching(true);

    const timer = window.setTimeout(async () => {
      try {
        const results = await searchStationsGlobal(trimmed);
        if (!isCancelled) {
          setGlobalSearchResults(results);
          setStationQueue(results);
        }
      } catch {
        if (!isCancelled) {
          setGlobalSearchResults([]);
        }
      } finally {
        if (!isCancelled) {
          setIsGlobalSearching(false);
        }
      }
    }, 280);

    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery, searchScope, countryCode, setStationQueue]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, selectedTag, sortBy, searchScope]);

  const activeSourceStations = useMemo(() => {
    const isGlobalMode =
      searchScope === 'all' || countryCode.toUpperCase() === 'ALL';
    if (isGlobalMode && searchQuery.trim().length >= 2 && globalSearchResults) {
      return globalSearchResults;
    }
    return countryStations;
  }, [
    searchScope,
    countryCode,
    searchQuery,
    globalSearchResults,
    countryStations,
  ]);

  // Extract top 18 popular tags/genres from the active station pool
  const popularTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const station of activeSourceStations) {
      if (!station.tags) continue;
      const tags = station.tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length >= 2 && t.length <= 22);
      for (const tag of tags) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 18)
      .map(([tag]) => tag);
  }, [activeSourceStations]);

  const filteredAndSortedStations = useMemo(() => {
    const normalizeText = (str: string) =>
      str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const q = normalizeText(searchQuery.trim());
    const qCompact = q.replace(/[\s\-_]+/g, '');
    const qTokens = q.split(/\s+/).filter(Boolean);
    const tagFilter = selectedTag.trim().toLowerCase();

    const filtered = activeSourceStations.filter((st) => {
      if (q) {
        const searchable = normalizeText(
          `${st.name} ${st.tags} ${st.homepage} ${st.url} ${st.country}`
        );
        const searchableCompact = searchable.replace(/[\s\-_]+/g, '');

        const tokenMatch = qTokens.every((token) => searchable.includes(token));
        const compactMatch =
          qCompact.length >= 3 && searchableCompact.includes(qCompact);

        if (!tokenMatch && !compactMatch) return false;
      }
      if (tagFilter) {
        const stationTags = st.tags
          .split(',')
          .map((t) => t.trim().toLowerCase());
        if (!stationTags.includes(tagFilter)) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'votes':
          return (b.votes || 0) - (a.votes || 0);
        case 'clickcount':
          return (b.clickcount || 0) - (a.clickcount || 0);
        case 'bitrate':
          return (b.bitrate || 0) - (a.bitrate || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
  }, [activeSourceStations, searchQuery, selectedTag, sortBy]);

  const visibleStations = useMemo(() => {
    return filteredAndSortedStations.slice(0, visibleCount);
  }, [filteredAndSortedStations, visibleCount]);

  const hasMore = visibleCount < filteredAndSortedStations.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) =>
      Math.min(prev + PAGE_SIZE, filteredAndSortedStations.length)
    );
  }, [filteredAndSortedStations.length]);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedTag('');
  }, [setSearchQuery]);

  return {
    allStations: activeSourceStations,
    filteredStations: filteredAndSortedStations,
    visibleStations,
    popularTags,
    isLoading: isLoading || isGlobalSearching,
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
    refreshStations: () => loadStations(true),
  };
}
