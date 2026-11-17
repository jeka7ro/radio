import React, { useEffect, useRef, useState } from 'react';
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
  const [hiddenOnScroll, setHiddenOnScroll] = useState(false);
  const lastYRef = useRef(0);

  useEffect(() => {
    setHiddenOnScroll(false);
    lastYRef.current = typeof window !== 'undefined' ? window.scrollY : 0;
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => {
      const y = Math.max(0, window.scrollY || 0);
      if (y <= 20) {
        setHiddenOnScroll(false);
        lastYRef.current = y;
        return;
      }
      const delta = y - lastYRef.current;
      lastYRef.current = y;
      if (delta > 10 && y > 48) {
        setHiddenOnScroll(true);
      } else if (delta < -8) {
        setHiddenOnScroll(false);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItems: {
    id: NavigationTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      id: 'home',
      label: t.nav.home,
      icon: <Home className="w-[21px] h-[21px]" aria-hidden="true" />,
    },
    {
      id: 'tv',
      label: t.nav.tv,
      icon: <Tv className="w-[21px] h-[21px]" aria-hidden="true" />,
    },
    {
      id: 'mediateca',
      label: t.nav.mediateca,
      icon: <Film className="w-[21px] h-[21px]" aria-hidden="true" />,
    },
    {
      id: 'countries',
      label: t.nav.countries,
      icon: <Globe className="w-[21px] h-[21px]" aria-hidden="true" />,
    },
    {
      id: 'favorites',
      label: t.nav.favorites,
      icon: <Heart className="w-[21px] h-[21px]" aria-hidden="true" />,
      badge: favoritesCount > 0 ? favoritesCount : undefined,
    },
    {
      id: 'settings',
      label: t.nav.settings,
      icon: <Settings className="w-[21px] h-[21px]" aria-hidden="true" />,
    },
  ];

  return (
    <nav
      aria-label={t.nav.mobileAria}
      style={{
        marginBottom: 'max(8px, calc(env(safe-area-inset-bottom, 0px) * 0.32))',
      }}
      className={`lg:hidden mx-3 max-w-md sm:mx-auto select-none touch-none transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        hiddenOnScroll
          ? 'translate-y-[calc(100%+24px)] opacity-0 pointer-events-none'
          : 'translate-y-0 opacity-100 pointer-events-auto'
      }`}
    >
      <div className="h-[54px] w-full rounded-full bg-[#1c1e24]/95 border border-white/[0.14] shadow-[0_12px_36px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.1)] p-1.5 flex items-center justify-between gap-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              title={item.label}
              onClick={() => {
                setHiddenOnScroll(false);
                setActiveTab(item.id);
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex-1 h-[42px] rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer min-w-0 ${
                isActive
                  ? 'bg-[#32353e] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
                  : 'text-[#cfd4dc] hover:text-white active:scale-95'
              }`}
            >
              <div className="relative flex items-center justify-center">
                {item.icon}
                {item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 px-1.5 py-0.5 min-w-[16px] text-[9px] font-bold rounded-full bg-rose-500 text-white text-center leading-none">
                    {item.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

