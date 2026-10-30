import React from 'react';
import { Radio, ChevronDown, Sun, Moon, Monitor } from 'lucide-react';
import { useRadioStore } from '../../store/useRadioStore';
import { useTranslation } from '../../i18n/useTranslation';
import { EnrichedCountry } from '../../hooks/useCountries';
import { ThemeMode } from '../../types/radio';

interface HeaderProps {
  selectedCountry: EnrichedCountry;
}

export const Header: React.FC<HeaderProps> = ({ selectedCountry }) => {
  const { t, language, setLanguage } = useTranslation();
  const theme = useRadioStore((state) => state.theme);
  const setTheme = useRadioStore((state) => state.setTheme);
  const setCountryModalOpen = useRadioStore((state) => state.setCountryModalOpen);
  const setActiveTab = useRadioStore((state) => state.setActiveTab);

  const cycleTheme = () => {
    const order: ThemeMode[] = ['system', 'dark', 'light'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  };

  const themeIcon =
    theme === 'dark' ? (
      <Moon className="w-4 h-4" aria-hidden="true" />
    ) : theme === 'light' ? (
      <Sun className="w-4 h-4" aria-hidden="true" />
    ) : (
      <Monitor className="w-4 h-4" aria-hidden="true" />
    );

  const themeLabel =
    theme === 'dark'
      ? t.settings.themeDark
      : theme === 'light'
        ? t.settings.themeLight
        : t.settings.themeSystem;

  return (
    <header className="sticky top-0 z-20 h-16 sm:h-20 bg-slate-50/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
      {/* Left: Mobile Logo or Desktop Country Trigger */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          aria-label="AetherRadio Home"
          className="lg:hidden flex items-center gap-2.5 text-left rounded-xl py-1 pr-2"
        >
          <div
            aria-hidden="true"
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-brand-900 text-white flex items-center justify-center shadow-sm flex-shrink-0"
          >
            <Radio className="w-5 h-5" />
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-zinc-100 hidden xs:inline">
            AetherRadio
          </span>
        </button>

        {/* Country selector pill button */}
        <button
          type="button"
          onClick={() => setCountryModalOpen(true)}
          aria-label={`${t.header.changeCountry}: ${selectedCountry.localizedName}`}
          className="min-h-[44px] px-4 py-2 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-brand-500/60 dark:hover:border-brand-500/60 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-zinc-100 shadow-sm transition-colors"
        >
          <span className="text-lg leading-none" aria-hidden="true">
            {selectedCountry.flag}
          </span>
          <span className="truncate max-w-[130px] sm:max-w-[200px]">
            {selectedCountry.localizedName}
          </span>
          {selectedCountry.stationcount > 0 && (
            <span className="hidden sm:inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
              {selectedCountry.stationcount}
            </span>
          )}
          <ChevronDown
            className="w-4 h-4 text-slate-500 dark:text-zinc-400"
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Right: Language & Theme controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setLanguage(language === 'ro' ? 'en' : 'ro')}
          aria-label={`${t.settings.language}: ${language.toUpperCase()}`}
          className="min-h-[44px] min-w-[44px] px-3.5 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200 transition-colors"
        >
          {language.toUpperCase()}
        </button>

        <button
          type="button"
          onClick={cycleTheme}
          aria-label={`${t.settings.appearance}: ${themeLabel}`}
          title={themeLabel}
          className="min-h-[44px] min-w-[44px] px-3.5 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center gap-1.5 text-slate-800 dark:text-zinc-200 transition-colors"
        >
          {themeIcon}
          <span className="hidden md:inline text-xs font-medium">
            {theme === 'system' ? 'Auto' : theme === 'dark' ? 'Dark' : 'Light'}
          </span>
        </button>
      </div>
    </header>
  );
};

