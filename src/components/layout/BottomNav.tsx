import React from 'react';
import { Home, Tv, Film, Globe, Heart, Settings } from 'lucide-react';
import { useRadioStore } from '../../store/useRadioStore';
import { useTranslation } from '../../i18n/useTranslation';
import { NavigationTab } from '../../types/radio';

export const BottomNav: React.FC = () => {
  const { t } = useTranslation();
  const activeTab = useRadioStore((state) => state.activeTab);
  const setActiveTab = useRadioStore((state) => state.setActiveTab);
  const favoritesCount = useRadioStore(
    (state) => state.favorites.length + state.favoriteTvChannels.length
  );

  const navItems: {
    id: NavigationTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      id: 'home',
      label: t.nav.home,
      icon: <Home className="w-5 h-5" aria-hidden="true" />,
    },
    {
      id: 'tv',
      label: t.nav.tv,
      icon: <Tv className="w-5 h-5" aria-hidden="true" />,
    },
    {
      id: 'mediateca',
      label: t.nav.mediateca,
      icon: <Film className="w-5 h-5" aria-hidden="true" />,
    },
    {
      id: 'countries',
      label: t.nav.countries,
      icon: <Globe className="w-5 h-5" aria-hidden="true" />,
    },
    {
      id: 'favorites',
      label: t.nav.favorites,
      icon: <Heart className="w-5 h-5" aria-hidden="true" />,
      badge: favoritesCount > 0 ? favoritesCount : undefined,
    },
    {
      id: 'settings',
      label: t.nav.settings,
      icon: <Settings className="w-5 h-5" aria-hidden="true" />,
    },
  ];

  return (
    <nav
      aria-label={t.nav.mobileAria}
      className="lg:hidden w-full bg-white/98 dark:bg-zinc-900/98 backdrop-blur-md border-t border-slate-200/90 dark:border-zinc-800/90 px-1 pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="grid grid-cols-6 gap-0.5 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative h-[52px] flex flex-col items-center justify-center py-1 rounded-full text-[11px] sm:text-xs font-medium transition-colors min-w-0 ${
                isActive
                  ? 'text-brand-700 dark:text-brand-400 font-semibold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <div className="relative">
                {item.icon}
                {item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-3 px-1.5 py-0.2 min-w-[18px] text-[10px] font-bold rounded-full bg-brand-700 text-white text-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="mt-0.5 truncate max-w-full px-0.5">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

