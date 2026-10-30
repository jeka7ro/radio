import { useState, useEffect, useMemo, useCallback } from 'react';
import { TvChannel, TvSortOption } from '../types/radio';
import {
  fetchTvChannelsByCountry,
  fetchAllGlobalTvChannels,
} from '../services/tvApi';
import {
  fetchEpgForCountry,
  enrichChannelsWithEpgLogos,
} from '../services/epgService';
import { useRadioStore } from '../store/useRadioStore';
import { SearchScope } from './useStations';

const PAGE_SIZE = 24;
const CATALOG_REVISION = 13;

export function useTvChannels(countryCode: string) {
  const customTvChannels = useRadioStore((state) => state.customTvChannels);
  const favoriteTvChannels = useRadioStore((state) => state.favoriteTvChannels);
  const searchQuery = useRadioStore((state) => state.tvSearchQuery);
  const setSearchQuery = useRadioStore((state) => state.setTvSearchQuery);
  const addRecentTvSearch = useRadioStore((state) => state.addRecentTvSearch);

  const [countryChannels, setCountryChannels] = useState<TvChannel[]>([]);
  const [globalChannels, setGlobalChannels] = useState<TvChannel[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGlobalLoading, setIsGlobalLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [searchScope, setSearchScope] = useState<SearchScope>(
    countryCode.toUpperCase() === 'ALL' ? 'all' : 'country'
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [onlyCustom, setOnlyCustom] = useState<boolean>(false);
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<TvSortOption>('quality');
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  // Automatically record non-empty searches into recentTvSearches after a short pause
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) return;
    const timer = window.setTimeout(() => {
      addRecentTvSearch(trimmed);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [searchQuery, addRecentTvSearch]);

  const loadCountryTv = useCallback(
    async (force = false) => {
      if (!countryCode) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchTvChannelsByCountry(countryCode, force);
        setCountryChannels(enrichChannelsWithEpgLogos(data));
        void fetchEpgForCountry(countryCode).then(() => {
          setCountryChannels((prev) => enrichChannelsWithEpgLogos(prev));
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load TV channels'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [countryCode]
  );

  useEffect(() => {
    setSelectedCategory('');
    setOnlyFavorites(false);
    setOnlyCustom(false);
    setSearchScope(countryCode.toUpperCase() === 'ALL' ? 'all' : 'country');
    setVisibleCount(PAGE_SIZE);
    void loadCountryTv(true);
  }, [countryCode, loadCountryTv, CATALOG_REVISION]);

  // Load full global TV index when user selects 'all' scope
  useEffect(() => {
    const isGlobalMode =
      searchScope === 'all' || countryCode.toUpperCase() === 'ALL';
    if (!isGlobalMode) return;

    let isCancelled = false;
    setIsGlobalLoading(true);

    fetchAllGlobalTvChannels(true)
      .then((all) => {
        if (!isCancelled) {
          setGlobalChannels(enrichChannelsWithEpgLogos(all));
          void fetchEpgForCountry('ALL').then(() => {
            if (!isCancelled) {
              setGlobalChannels((prev) =>
                prev ? enrichChannelsWithEpgLogos(prev) : prev
              );
            }
          });
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setGlobalChannels([]);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsGlobalLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [searchScope, countryCode, CATALOG_REVISION]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, selectedCategory, sortBy, searchScope]);

  const activeSourceChannels = useMemo(() => {
    if (onlyFavorites) {
      return favoriteTvChannels;
    }
    if (onlyCustom && customTvChannels.length > 0) {
      return customTvChannels;
    }
    const isGlobalMode =
      searchScope === 'all' || countryCode.toUpperCase() === 'ALL';
    const base = isGlobalMode && globalChannels ? globalChannels : countryChannels;
    if (customTvChannels.length === 0) return base;
    return [...customTvChannels, ...base];
  }, [
    onlyFavorites,
    favoriteTvChannels,
    onlyCustom,
    searchScope,
    countryCode,
    globalChannels,
    countryChannels,
    customTvChannels,
  ]);

  const popularCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ch of activeSourceChannels) {
      if (!ch.group) continue;
      counts.set(ch.group, (counts.get(ch.group) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([cat]) => cat);
  }, [activeSourceChannels]);

  const filteredAndSortedChannels = useMemo(() => {
    const normalizeText = (str: string) =>
      str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const q = normalizeText(searchQuery.trim());
    const qCompact = q.replace(/[\s\-_]+/g, '');
    const qTokens = q.split(/\s+/).filter(Boolean);
    const catFilter = selectedCategory.trim().toLowerCase();

    const filtered = activeSourceChannels.filter((ch) => {
      if (q) {
        const searchable = normalizeText(
          `${ch.name} ${ch.group} ${ch.countryCode}`
        );
        const searchableCompact = searchable.replace(/[\s\-_]+/g, '');
        const tokenMatch = qTokens.every((t) => searchable.includes(t));
        const compactMatch =
          qCompact.length >= 3 && searchableCompact.includes(qCompact);
        if (!tokenMatch && !compactMatch) return false;
      }
      if (catFilter === '__cinema__') {
        if (
          !/movies|series|cinema|film|кино|сериал|дорама|amedia|viju|cinemaraton|happy|hollywood|mosfilm|мосфильм|бестселлер|детектив|комедия|роман/i.test(
            `${ch.group} ${ch.name}`
          )
        ) {
          return false;
        }
      } else if (catFilter && ch.group.toLowerCase() !== catFilter) {
        return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'quality') {
        if (b.resolutionHeight !== a.resolutionHeight) {
          return b.resolutionHeight - a.resolutionHeight;
        }
        return a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
  }, [activeSourceChannels, searchQuery, selectedCategory, sortBy]);

  const visibleChannels = useMemo(() => {
    return filteredAndSortedChannels.slice(0, visibleCount);
  }, [filteredAndSortedChannels, visibleCount]);

  const hasMore = visibleCount < filteredAndSortedChannels.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) =>
      Math.min(prev + PAGE_SIZE, filteredAndSortedChannels.length)
    );
  }, [filteredAndSortedChannels.length]);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCategory('');
    setOnlyFavorites(false);
    setOnlyCustom(false);
  }, [setSearchQuery]);

  return {
    allChannels: activeSourceChannels,
    filteredChannels: filteredAndSortedChannels,
    visibleChannels,
    popularCategories,
    isLoading: isLoading || isGlobalLoading,
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
    refreshChannels: () => loadCountryTv(true),
  };
}

