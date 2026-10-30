import React, { useState, useMemo, useId } from 'react';
import { Search, MapPin, Globe, Check, X } from 'lucide-react';
import { useRadioStore } from '../store/useRadioStore';
import { useTranslation } from '../i18n/useTranslation';
import { EnrichedCountry } from '../hooks/useCountries';
import { detectUserCountryCode } from '../services/geoLanguageService';
import { EmptyState } from '../components/common/EmptyState';

interface CountriesViewProps {
  countries: EnrichedCountry[];
  isLoading: boolean;
}

export const CountriesView: React.FC<CountriesViewProps> = ({
  countries,
  isLoading,
}) => {
  const { t, format } = useTranslation();
  const searchId = useId();

  const selectedCountryCode = useRadioStore(
    (state) => state.selectedCountryCode
  );
  const setSelectedCountryCode = useRadioStore(
    (state) => state.setSelectedCountryCode
  );
  const lastMediaTab = useRadioStore((state) => state.lastMediaTab);
  const setActiveTab = useRadioStore((state) => state.setActiveTab);

  const [query, setQuery] = useState('');

  const filteredCountries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) =>
        c.localizedName.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.iso_3166_1.toLowerCase().includes(q)
    );
  }, [countries, query]);

  const handleChooseCountry = (isoCode: string) => {
    setSelectedCountryCode(isoCode);
    setActiveTab(lastMediaTab);
  };

  const handleAutoDetect = () => {
    const detected = detectUserCountryCode();
    handleChooseCountry(detected);
  };

  return (
    <section aria-labelledby="countries-page-heading" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900/90 p-5 rounded-3xl border border-slate-200/80 dark:border-zinc-800/80">
        <div>
          <h1
            id="countries-page-heading"
            tabIndex={-1}
            className="text-2xl font-bold text-slate-900 dark:text-zinc-100"
          >
            {t.countries.title}
          </h1>
          <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1">
            {t.countries.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={handleAutoDetect}
          className="min-h-[44px] px-5 py-2.5 rounded-full bg-brand-700 hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-colors flex-shrink-0"
        >
          <MapPin className="w-4 h-4" aria-hidden="true" />
          <span>{t.countries.autoDetectBtn}</span>
        </button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <label htmlFor={searchId} className="visually-hidden">
          {t.countries.searchPlaceholder}
        </label>
        <Search
          aria-hidden="true"
          className="w-4 h-4 text-slate-500 dark:text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
        />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.countries.searchPlaceholder}
          className="w-full min-h-[48px] pl-10 pr-10 py-2.5 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-400 shadow-2xs"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t.header.clearSearch}
            className="min-w-[40px] min-h-[40px] rounded-full absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* "All Countries (Global)" Featured Option */}
      <button
        type="button"
        onClick={() => handleChooseCountry('ALL')}
        className={`w-full p-4 sm:p-5 rounded-2xl border flex items-center justify-between gap-4 text-left transition-all ${
          selectedCountryCode.toUpperCase() === 'ALL'
            ? 'bg-brand-50/90 dark:bg-brand-950/45 border-brand-500/80 shadow-sm'
            : 'bg-white dark:bg-zinc-900/90 border-brand-300/70 dark:border-brand-800/70 hover:border-brand-500 hover:shadow-sm'
        }`}
      >
        <div className="flex items-center gap-4 min-w-0">
          <span className="text-4xl leading-none" aria-hidden="true">
            🌍
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100 truncate">
              {t.countries.allCountries}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-0.5">
              {t.countries.allCountriesSubtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-brand-100 dark:bg-brand-950 text-brand-800 dark:text-brand-300">
            ALL
          </span>
          {selectedCountryCode.toUpperCase() === 'ALL' && (
            <span
              aria-label={t.countries.selectedBadge}
              className="w-6 h-6 rounded-full bg-brand-700 text-white flex items-center justify-center"
            >
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          )}
        </div>
      </button>

      {/* Countries Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {Array.from({ length: 16 }).map((_, idx) => (
            <div
              key={idx}
              className="h-20 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800/70 p-4 flex items-center gap-3.5"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-zinc-800 skeleton-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-zinc-800 skeleton-pulse" />
                <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-zinc-800 skeleton-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredCountries.length === 0 ? (
        <EmptyState
          icon={<Globe className="w-7 h-7" />}
          title={t.countries.emptyTitle}
          description={t.countries.emptyDesc}
          actionLabel={t.home.resetFilters}
          onAction={() => setQuery('')}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filteredCountries.map((country, idx) => {
            const isSelected =
              country.iso_3166_1 === selectedCountryCode.toUpperCase();
            return (
              <button
                key={country.iso_3166_1}
                type="button"
                onClick={() => handleChooseCountry(country.iso_3166_1)}
                className={`min-h-[72px] p-4 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all ${
                  idx >= 24 ? 'station-card-deferred' : ''
                } ${
                  isSelected
                    ? 'bg-brand-50/90 dark:bg-brand-950/40 border-brand-500/80 shadow-sm'
                    : 'bg-white dark:bg-zinc-900/80 border-slate-200/80 dark:border-zinc-800/80 hover:border-brand-400/60 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="text-3xl leading-none" aria-hidden="true">
                    {country.flag}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100 truncate">
                      {country.localizedName}
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
                      {format(t.countries.stationsLabel, {
                        count: country.stationcount,
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                    {country.iso_3166_1}
                  </span>
                  {isSelected && (
                    <span
                      aria-label={t.countries.selectedBadge}
                      className="w-6 h-6 rounded-full bg-brand-700 text-white flex items-center justify-center"
                    >
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

