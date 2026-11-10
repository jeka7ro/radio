import { useState, useEffect, useMemo, useCallback } from 'react';
import { Country } from '../types/radio';
import { fetchCountries } from '../services/radioBrowserApi';
import { useRadioStore } from '../store/useRadioStore';
import {
  getCountryFlagEmoji,
  getLocalizedCountryName,
} from '../services/geoLanguageService';
import { translations } from '../i18n/translations';

export interface EnrichedCountry extends Country {
  localizedName: string;
  flag: string;
}

export function useCountries() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const selectedCountryCode = useRadioStore((state) => state.selectedCountryCode);
  const language = useRadioStore((state) => state.language);

  const loadCountries = useCallback(async (force = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCountries(force);
      setCountries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load countries');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCountries(false);
  }, [loadCountries]);

  const totalGlobalStations = useMemo(() => {
    return countries.reduce((sum, c) => sum + (c.stationcount || 0), 0);
  }, [countries]);

  const enrichedCountries = useMemo<EnrichedCountry[]>(() => {
    return countries
      .map((c) => ({
        ...c,
        localizedName: getLocalizedCountryName(c.iso_3166_1, c.name, language),
        flag: getCountryFlagEmoji(c.iso_3166_1),
      }))
      .sort((a, b) =>
        a.localizedName.localeCompare(b.localizedName, language)
      );
  }, [countries, language]);

  const selectedCountry = useMemo<EnrichedCountry>(() => {
    const code = selectedCountryCode.toUpperCase();
    const dict = translations[language] ?? translations.ro;

    if (code === 'ALL') {
      return {
        iso_3166_1: 'ALL',
        name: 'All Countries',
        localizedName: dict.countries.allCountries,
        stationcount: totalGlobalStations || 45000,
        flag: '',
      };
    }

    const found = enrichedCountries.find((c) => c.iso_3166_1 === code);
    if (found) return found;
    return {
      iso_3166_1: code,
      name: code,
      localizedName: getLocalizedCountryName(code, code, language),
      stationcount: 0,
      flag: getCountryFlagEmoji(code),
    };
  }, [enrichedCountries, selectedCountryCode, language, totalGlobalStations]);

  return {
    countries: enrichedCountries,
    totalGlobalStations,
    selectedCountry,
    isLoading,
    error,
    reloadCountries: () => loadCountries(true),
  };
}

