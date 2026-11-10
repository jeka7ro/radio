import React, { useEffect, useRef, useState, useMemo, useId } from 'react';
import { X, Search, MapPin, Check } from 'lucide-react';
import { useRadioStore } from '../../store/useRadioStore';
import { useTranslation } from '../../i18n/useTranslation';
import { EnrichedCountry } from '../../hooks/useCountries';
import { detectUserCountryCode } from '../../services/geoLanguageService';

interface CountryModalProps {
  countries: EnrichedCountry[];
}

export const CountryModal: React.FC<CountryModalProps> = ({ countries }) => {
  const { t, format } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();
  const searchId = useId();

  const isOpen = useRadioStore((state) => state.isCountryModalOpen);
  const setCountryModalOpen = useRadioStore((state) => state.setCountryModalOpen);
  const selectedCountryCode = useRadioStore((state) => state.selectedCountryCode);
  const setSelectedCountryCode = useRadioStore(
    (state) => state.setSelectedCountryCode
  );
  const activeTab = useRadioStore((state) => state.activeTab);
  const lastMediaTab = useRadioStore((state) => state.lastMediaTab);
  const setActiveTab = useRadioStore((state) => state.setActiveTab);

  const [query, setQuery] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
      setQuery('');
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Fallback for browsers without native <dialog closedby="any"> support
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      setCountryModalOpen(false);
    };

    const handleBackdropClick = (event: MouseEvent) => {
      if ('closedBy' in HTMLDialogElement.prototype) return;
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isDialogContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (isDialogContent) return;
      dialog.close();
    };

    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('click', handleBackdropClick);

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [setCountryModalOpen]);

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

  const handleSelectCountry = (isoCode: string) => {
    setSelectedCountryCode(isoCode);
    setCountryModalOpen(false);
    // Keep the user on TV Online if they are on 'tv', or Radio if they are on 'home';
    // if they opened the modal from another tab (e.g. countries/favorites/settings), return to their last media tab ('tv' or 'home').
    if (activeTab !== 'home' && activeTab !== 'tv') {
      setActiveTab(lastMediaTab);
    }
  };

  const handleAutoDetect = () => {
    const detected = detectUserCountryCode();
    handleSelectCountry(detected);
  };

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      aria-labelledby={titleId}
      className="w-full max-w-xl rounded-3xl p-0 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-2xl border border-slate-200 dark:border-zinc-800 backdrop:bg-black/60 backdrop:backdrop-blur-xs"
    >
      <div className="flex flex-col max-h-[82vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-800">
          <h2 id={titleId} className="text-xl font-bold">
            {t.countries.modalTitle}
          </h2>
          <button
            type="button"
            onClick={() => setCountryModalOpen(false)}
            aria-label={t.countries.closeModal}
            className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Search & Auto-detect bar */}
        <div className="p-4 space-y-3 border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/60 dark:bg-zinc-950/40">
          <div className="relative">
            <label htmlFor={searchId} className="visually-hidden">
              {t.countries.searchPlaceholder}
            </label>
            <Search
              aria-hidden="true"
              className="w-4 h-4 text-slate-500 dark:text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              ref={searchInputRef}
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.countries.searchPlaceholder}
              className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-400"
            />
          </div>

          <button
            type="button"
            onClick={handleAutoDetect}
            className="w-full min-h-[44px] px-4 py-2 rounded-full bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 dark:hover:bg-brand-950/80 text-brand-800 dark:text-brand-300 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <MapPin className="w-4 h-4" aria-hidden="true" />
            <span>{t.countries.autoDetectBtn}</span>
          </button>
        </div>

        {/* Country List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {/* "All Countries (Global)" prominent option */}
          <button
            type="button"
            onClick={() => handleSelectCountry('ALL')}
            className={`w-full min-h-[52px] px-3.5 py-2.5 mb-2 rounded-xl flex items-center justify-between gap-3 text-left transition-colors border ${
              selectedCountryCode.toUpperCase() === 'ALL'
                ? 'bg-brand-700 text-white border-brand-600 dark:bg-brand-600'
                : 'bg-brand-50/60 dark:bg-brand-950/30 border-brand-200/80 dark:border-brand-800/60 hover:bg-brand-100/70 dark:hover:bg-brand-950/50 text-slate-900 dark:text-zinc-100'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl leading-none" aria-hidden="true">
                </span>
              <div className="min-w-0">
                <span className="text-sm font-bold block truncate">
                  {t.countries.allCountries}
                </span>
                <span
                  className={`text-xs block truncate ${
                    selectedCountryCode.toUpperCase() === 'ALL'
                      ? 'text-white/85'
                      : 'text-slate-600 dark:text-zinc-400'
                  }`}
                >
                  {t.countries.allCountriesSubtitle}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className={`text-xs tabular-nums px-2 py-0.5 rounded ${
                  selectedCountryCode.toUpperCase() === 'ALL'
                    ? 'bg-white/20 text-white'
                    : 'bg-brand-100 dark:bg-brand-900/60 text-brand-800 dark:text-brand-300'
                }`}
              >
                ALL
              </span>
              {selectedCountryCode.toUpperCase() === 'ALL' && (
                <Check className="w-4 h-4" aria-hidden="true" />
              )}
            </div>
          </button>

          {filteredCountries.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-600 dark:text-zinc-400">
              {t.countries.emptyTitle}
            </div>
          ) : (
            filteredCountries.map((country) => {
              const isSelected =
                country.iso_3166_1 === selectedCountryCode.toUpperCase();
              return (
                <button
                  key={country.iso_3166_1}
                  type="button"
                  onClick={() => handleSelectCountry(country.iso_3166_1)}
                  className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 text-left transition-colors ${
                    isSelected
                      ? 'bg-brand-700 text-white dark:bg-brand-600'
                      : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-900 dark:text-zinc-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl leading-none" aria-hidden="true">
                      {country.flag}
                    </span>
                    <div className="min-w-0">
                      <span className="text-sm font-semibold block truncate">
                        {country.localizedName}
                      </span>
                      <span
                        className={`text-xs ${
                          isSelected
                            ? 'text-white/85'
                            : 'text-slate-600 dark:text-zinc-400'
                        }`}
                      >
                        {format(t.countries.stationsLabel, {
                          count: country.stationcount,
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-xs tabular-nums px-2 py-0.5 rounded ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                      }`}
                    >
                      {country.iso_3166_1}
                    </span>
                    {isSelected && (
                      <Check className="w-4 h-4" aria-hidden="true" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </dialog>
  );
};

