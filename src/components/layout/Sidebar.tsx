import React from 'react';
import { Home, Tv, Film, Globe, Heart, Settings, Radio, ChevronRight } from 'lucide-react';
import { useRadioStore } from '../../store/useRadioStore';
import { useTranslation } from '../../i18n/useTranslation';
import { EnrichedCountry } from '../../hooks/useCountries';
import { NavigationTab } from '../../types/radio';

interface SidebarProps {
  selectedCountry: EnrichedCountry;
}

export const Sidebar: React.FC<SidebarProps> = ({ selectedCountry }) => {
  const { t, format } = useTranslation();
  const activeTab = useRadioStore((state) => state.activeTab);
  const setActiveTab = useRadioStore((state) => state.setActiveTab);
  const favoritesCount = useRadioStore(
    (state) => state.favorites.length + state.favoriteTvChannels.length
  );
  const setCountryModalOpen = useRadioStore((state) => state.setCountryModalOpen);

  const navItems: { id: NavigationTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'home', label: t.nav.home, icon: <Home className="w-5 h-5" aria-hidden="true" /> },
    { id: 'tv', label: t.nav.tv, icon: <Tv className="w-5 h-5" aria-hidden="true" /> },
    { id: 'mediateca', label: t.nav.mediateca, icon: <Film className="w-5 h-5" aria-hidden="true" /> },
    { id: 'countries', label: t.nav.countries, icon: <Globe className="w-5 h-5" aria-hidden="true" /> },
    {
      id: 'favorites',
      label: t.nav.favorites,
      icon: <Heart className="w-5 h-5" aria-hidden="true" />,
      badge: favoritesCount > 0 ? favoritesCount : undefined,
    },
    { id: 'settings', label: t.nav.settings, icon: <Settings className="w-5 h-5" aria-hidden="true" /> },
  ];

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 bg-white dark:bg-zinc-900 border-r border-slate-200/80 dark:border-zinc-800/80 z-30 pb-24">
      {/* Brand Header (aligned to exact 64px / h-16 height to match Header border-b) */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-200/80 dark:border-zinc-800/80 shrink-0">
        <div
          aria-hidden="true"
          className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-600 to-brand-900 text-white flex items-center justify-center shadow-sm shrink-0"
        >
          <Radio className="w-4 h-4" />
        </div>
        <div>
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100 block leading-none">
            AetherRadio
          </span>
          <span className="text-xs text-slate-600 dark:text-zinc-400 font-medium mt-1 block">
            Global Stream Tuner
          </span>
        </div>
      </div>

      {/* Primary Desktop Navigation */}
      <nav aria-label={t.nav.primaryAria} className="flex-1 px-3 py-5 space-y-1.5">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full min-h-[46px] flex items-center justify-between px-4 py-2.5 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-700 text-white dark:bg-brand-600 dark:text-white shadow-sm'
                  : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/70'
              }`}
            >
              <span className="flex items-center gap-3">
                {item.icon}
                <span>{item.label}</span>
              </span>
              {item.badge !== undefined && (
                <span
                  className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-brand-100 dark:bg-brand-950 text-brand-800 dark:text-brand-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Active Country Quick Selector Card (Only shown on Radio / TV / Countries views, hidden on Mediatecă) */}
      {(activeTab === 'home' ||
        activeTab === 'tv' ||
        activeTab === 'countries') && (
        <div className="px-4 py-4 border-t border-slate-200/70 dark:border-zinc-800/70">
          <button
            type="button"
            onClick={() => setCountryModalOpen(true)}
            aria-label={`${t.header.changeCountry}: ${selectedCountry.localizedName}`}
            className="w-full min-h-[56px] px-4 py-3 rounded-full bg-slate-100/90 dark:bg-zinc-800/70 hover:bg-slate-200/70 dark:hover:bg-zinc-800 flex items-center justify-between gap-2.5 text-left transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-brand-600/15 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                  {selectedCountry.localizedName}
                </p>
                {(activeTab === 'home' || activeTab === 'countries') && (
                  <p className="text-xs text-slate-600 dark:text-zinc-400">
                    {format(t.countries.stationsLabel, {
                      count: selectedCountry.stationcount,
                    })}
                  </p>
                )}
              </div>
            </div>
            <ChevronRight
              className="w-4 h-4 text-slate-500 dark:text-zinc-400 flex-shrink-0"
              aria-hidden="true"
            />
          </button>
        </div>
      )}
    </aside>
  );
};

