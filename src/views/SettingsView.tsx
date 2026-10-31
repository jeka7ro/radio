import React, { useState } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  Languages,
  Database,
  Info,
  Check,
  Server,
} from 'lucide-react';
import { useRadioStore } from '../store/useRadioStore';
import { useTranslation } from '../i18n/useTranslation';
import { clearAllApiCache } from '../services/cacheService';
import { getActiveServerHost } from '../services/radioBrowserApi';
import { ThemeMode, LanguageCode } from '../types/radio';

export const SettingsView: React.FC = () => {
  const { t, language, setLanguage } = useTranslation();
  const theme = useRadioStore((state) => state.theme);
  const setTheme = useRadioStore((state) => state.setTheme);

  const [cacheMessage, setCacheMessage] = useState<string | null>(null);

  const handleClearCache = () => {
    clearAllApiCache();
    setCacheMessage(t.settings.cacheCleared);
    window.setTimeout(() => setCacheMessage(null), 4000);
  };

  const themeOptions: { id: ThemeMode; label: string; icon: React.ReactNode }[] =
    [
      {
        id: 'system',
        label: t.settings.themeSystem,
        icon: <Monitor className="w-5 h-5" aria-hidden="true" />,
      },
      {
        id: 'dark',
        label: t.settings.themeDark,
        icon: <Moon className="w-5 h-5" aria-hidden="true" />,
      },
      {
        id: 'light',
        label: t.settings.themeLight,
        icon: <Sun className="w-5 h-5" aria-hidden="true" />,
      },
    ];

  const langOptions: { id: LanguageCode; label: string; flag: string }[] = [
    { id: 'ro', label: t.settings.langRo, flag: '🇷🇴' },
    { id: 'en', label: t.settings.langEn, flag: '🇬🇧' },
  ];

  return (
    <section
      aria-labelledby="settings-page-heading"
      className="max-w-3xl space-y-3 sm:space-y-5"
    >
      <div className="bg-white dark:bg-zinc-900/90 px-3.5 py-2.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-zinc-800/80">
        <h1
          id="settings-page-heading"
          tabIndex={-1}
          className="text-base sm:text-2xl font-bold text-slate-900 dark:text-zinc-100"
        >
          {t.settings.title}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-0.5">
          {t.settings.subtitle}
        </p>
      </div>

      {/* Theme Selection Card */}
      <div className="bg-white dark:bg-zinc-900/80 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-zinc-800/80 space-y-3">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div
            aria-hidden="true"
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-brand-100 dark:bg-brand-950/70 text-brand-700 dark:text-brand-300 flex items-center justify-center flex-shrink-0"
          >
            <Monitor className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-lg font-semibold text-slate-900 dark:text-zinc-100">
              {t.settings.appearance}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400">
              {t.settings.appearanceDesc}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {themeOptions.map((opt) => {
            const isSelected = theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTheme(opt.id)}
                aria-pressed={isSelected}
                className={`min-h-[40px] sm:min-h-[48px] px-3 sm:px-5 py-2 rounded-full border flex items-center justify-center sm:justify-between gap-1.5 text-xs sm:text-sm font-semibold transition-all ${
                  isSelected
                    ? 'bg-brand-700 text-white border-brand-700 dark:bg-brand-600 dark:border-brand-500 shadow-sm'
                    : 'bg-slate-50 dark:bg-zinc-950/60 border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <span className="flex items-center gap-1.5 sm:gap-2">
                  {opt.icon}
                  <span className="truncate">{opt.label}</span>
                </span>
                {isSelected && (
                  <Check className="hidden sm:inline w-4 h-4 shrink-0" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Language Selection Card */}
      <div className="bg-white dark:bg-zinc-900/80 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-zinc-800/80 space-y-3">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div
            aria-hidden="true"
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-brand-100 dark:bg-brand-950/70 text-brand-700 dark:text-brand-300 flex items-center justify-center flex-shrink-0"
          >
            <Languages className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-lg font-semibold text-slate-900 dark:text-zinc-100">
              {t.settings.language}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400">
              {t.settings.languageDesc}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {langOptions.map((opt) => {
            const isSelected = language === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLanguage(opt.id)}
                aria-pressed={isSelected}
                className={`min-h-[40px] sm:min-h-[48px] px-3.5 sm:px-5 py-2 rounded-full border flex items-center justify-between gap-2 text-xs sm:text-sm font-semibold transition-all ${
                  isSelected
                    ? 'bg-brand-700 text-white border-brand-700 dark:bg-brand-600 dark:border-brand-500 shadow-sm'
                    : 'bg-slate-50 dark:bg-zinc-950/60 border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-base sm:text-xl" aria-hidden="true">
                    {opt.flag}
                  </span>
                  <span>{opt.label}</span>
                </span>
                {isSelected && <Check className="w-4 h-4" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cache & API Mirror Card */}
      <div className="bg-white dark:bg-zinc-900/80 p-5 rounded-3xl border border-slate-200/80 dark:border-zinc-800/80 space-y-4">
        <div className="flex items-start gap-3">
          <div
            aria-hidden="true"
            className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-950/70 text-brand-700 dark:text-brand-300 flex items-center justify-center flex-shrink-0"
          >
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
              {t.settings.cacheTitle}
            </h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              {t.settings.cacheDesc}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-medium text-slate-700 dark:text-zinc-300">
            <Server className="w-4 h-4 text-brand-700 dark:text-brand-400" aria-hidden="true" />
            <span>
              {t.header.activeServer}: <strong>{getActiveServerHost()}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={handleClearCache}
            className="min-h-[44px] px-5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-sm font-semibold transition-colors"
          >
            {t.settings.clearCacheBtn}
          </button>
        </div>

        {cacheMessage && (
          <p
            role="status"
            aria-live="polite"
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-400"
          >
            {cacheMessage}
          </p>
        )}
      </div>

      {/* About Card */}
      <div className="bg-white dark:bg-zinc-900/80 p-5 rounded-3xl border border-slate-200/80 dark:border-zinc-800/80 flex items-start gap-3">
        <div
          aria-hidden="true"
          className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-950/70 text-brand-700 dark:text-brand-300 flex items-center justify-center flex-shrink-0"
        >
          <Info className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
            {t.settings.aboutTitle}
          </h2>
          <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1">
            {t.settings.aboutDesc}
          </p>
        </div>
      </div>
    </section>
  );
};

