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
    <section aria-labelledby="countries-page-heading" className="space-y-3 sm:space-y-5">
      <div className="flex items-center justify-between gap-2.5 bg-white dark:bg-zinc-900/90 px-3.5 py-2.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-zinc-800/80">
        <div className="min-w-0">
          <h1
            id="countries-page-heading"
            tabIndex={-1}
            className="text-base sm:text-2xl font-bold text-slate-900 dark:text-zinc-100 truncate"
          >
            {t.countries.title}
          </h1>
          <p className="hidden sm:block text-sm text-slate-600 dark:text-zinc-400 mt-1">
            {t.countries.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={handleAutoDetect}
          className="min-h-[34px] sm:min-h-[42px] px-3 sm:px-5 py-1.5 sm:py-2 rounded-full bg-brand-700 hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 shadow-xs transition-colors flex-shrink-0"
        >
          <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
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
          className="w-full min-h-[38px] sm:min-h-[44px] pl-9 pr-9 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-400 shadow-2xs"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t.header.clearSearch}
            className="min-w-[32px] min-h-[32px] rounded-full absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* "All Countries (Global)" Featured Option */}
      <button
        type="button"
        onClick={() => handleChooseCountry('ALL')}
        className={`w-full p-3 sm:p-4 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all ${
          selectedCountryCode.toUpperCase() === 'ALL'
            ? 'bg-brand-50/90 dark:bg-brand-950/45 border-brand-500/80 shadow-sm'
            : 'bg-white dark:bg-zinc-900/90 border-brand-300/70 dark:border-brand-800/70 hover:border-brand-500 hover:shadow-sm'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl sm:text-3xl leading-none" aria-hidden="true">
            </span>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100 truncate">
              {t.countries.allCountries}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-600 dark:text-zinc-400 truncate">
              {t.countries.allCountriesSubtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[11px] tabular-nums font-bold px-2 py-0.5 rounded-lg bg-brand-100 dark:bg-brand-950 text-brand-800 dark:text-brand-300">
            ALL
          </span>
          {selectedCountryCode.toUpperCase() === 'ALL' && (
            <span
              aria-label={t.countries.selectedBadge}
              className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-brand-700 text-white flex items-center justify-center"
            >
              <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
            </span>
          )}
        </div>
      </button>

      {/* Countries Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3.5">
          {Array.from({ length: 16 }).map((_, idx) => (
            <div
              key={idx}
              className="h-14 sm:h-20 rounded-2xl bg-white dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800/70 p-3 flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-zinc-800 skeleton-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-2/3 rounded bg-slate-200 dark:bg-zinc-800 skeleton-pulse" />
                <div className="h-2.5 w-1/3 rounded bg-slate-200 dark:bg-zinc-800 skeleton-pulse" />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3.5">
          {filteredCountries.map((country, idx) => {
            const isSelected =
              country.iso_3166_1 === selectedCountryCode.toUpperCase();
            return (
              <button
                key={country.iso_3166_1}
                type="button"
                onClick={() => handleChooseCountry(country.iso_3166_1)}
                className={`min-h-[54px] sm:min-h-[68px] px-3 py-2.5 sm:p-4 rounded-2xl border flex items-center justify-between gap-2.5 text-left transition-all ${
                  idx >= 24 ? 'station-card-deferred' : ''
                } ${
                  isSelected
                    ? 'bg-brand-50/90 dark:bg-brand-950/40 border-brand-500/80 shadow-sm'
                    : 'bg-white dark:bg-zinc-900/80 border-slate-200/80 dark:border-zinc-800/80 hover:border-brand-400/60 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                  <span className="text-2xl sm:text-3xl leading-none" aria-hidden="true">
                    {country.flag}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-zinc-100 truncate">
                      {country.localizedName}
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-600 dark:text-zinc-400">
                      {format(t.countries.stationsLabel, {
                        count: country.stationcount,
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[11px] tabular-nums px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                    {country.iso_3166_1}
                  </span>
                  {isSelected && (
                    <span
                      aria-label={t.countries.selectedBadge}
                      className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-brand-700 text-white flex items-center justify-center"
                    >
                      <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
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

