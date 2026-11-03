import React, { useEffect, useState } from 'react';
import { useRadioStore } from './store/useRadioStore';
import { useTheme } from './hooks/useTheme';
import { useCountries } from './hooks/useCountries';
import { useTranslation } from './i18n/useTranslation';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { Header } from './components/layout/Header';
import { GlobalPlayer } from './components/player/GlobalPlayer';
import { TvPlayerModal } from './components/tv/TvPlayerModal';
import { CountryModal } from './components/countries/CountryModal';
import { HomeView } from './views/HomeView';
import { TvOnlineView } from './views/TvOnlineView';
import { MediatecaView } from './views/MediatecaView';
import { CountriesView } from './views/CountriesView';
import { FavoritesView } from './views/FavoritesView';
import { SettingsView } from './views/SettingsView';
import { SmartTvLampaView } from './views/SmartTvLampaView';

export const App: React.FC = () => {
  useTheme();
  const { t } = useTranslation();
  const { countries, selectedCountry, isLoading: isCountriesLoading } = useCountries();

  const activeTab = useRadioStore((state) => state.activeTab);
  const setActiveTab = useRadioStore((state) => state.setActiveTab);
  const currentStation = useRadioStore((state) => state.currentStation);
  const playerStatus = useRadioStore((state) => state.playerStatus);

  const [isSmartTvMode, setIsSmartTvMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    const inIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();
    return (
      params.get('tvmode') === '1' ||
      inIframe ||
      /Web0S|WebOS|NetCast|SmartTV|Tizen|Large Screen/i.test(
        navigator.userAgent
      )
    );
  });

  useEffect(() => {
    const handleEnterSmartTv = () => {
      document.documentElement.classList.add('smart-tv-mode');
      setIsSmartTvMode(true);
    };
    window.addEventListener('aether:enter-smart-tv', handleEnterSmartTv);
    return () =>
      window.removeEventListener('aether:enter-smart-tv', handleEnterSmartTv);
  }, []);

  // Support deep-link URL query parameters (?tab=mediateca|tv|home|countries|favorites|settings & ?tvmode=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (
      tabParam === 'home' ||
      tabParam === 'tv' ||
      tabParam === 'mediateca' ||
      tabParam === 'countries' ||
      tabParam === 'favorites' ||
      tabParam === 'settings'
    ) {
      setActiveTab(tabParam);
    }

    const isTvMode =
      params.get('tvmode') === '1' ||
      /Web0S|WebOS|NetCast|SmartTV|Tizen|Large Screen/i.test(
        navigator.userAgent
      );
    if (isTvMode) {
      document.documentElement.classList.add('smart-tv-mode');
    }

    // Smart TV Remote D-Pad spatial navigation & LG webOS Back key (461)
    const handleTvRemoteKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      // LG webOS Back button (461) or Samsung Tizen Back button (10009)
      if (e.keyCode === 461 || e.keyCode === 10009) {
        e.preventDefault();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        return;
      }

      if (isTextInput) return;

      if (
        e.key === 'ArrowRight' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowUp'
      ) {
        const focusables = Array.from(
          document.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });

        if (focusables.length === 0) return;

        const current = document.activeElement as HTMLElement | null;
        if (!current || !focusables.includes(current)) {
          e.preventDefault();
          focusables[0].focus();
          return;
        }

        const curRect = current.getBoundingClientRect();
        const curCx = curRect.left + curRect.width / 2;
        const curCy = curRect.top + curRect.height / 2;

        let bestCandidate: HTMLElement | null = null;
        let bestScore = Infinity;

        for (const el of focusables) {
          if (el === current) continue;
          const r = el.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const dx = cx - curCx;
          const dy = cy - curCy;

          let isDirectionMatch = false;
          let primaryDist = 0;
          let orthoDist = 0;

          if (e.key === 'ArrowRight' && dx > 12) {
            isDirectionMatch = true;
            primaryDist = dx;
            orthoDist = Math.abs(dy);
          } else if (e.key === 'ArrowLeft' && dx < -12) {
            isDirectionMatch = true;
            primaryDist = -dx;
            orthoDist = Math.abs(dy);
          } else if (e.key === 'ArrowDown' && dy > 12) {
            isDirectionMatch = true;
            primaryDist = dy;
            orthoDist = Math.abs(dx);
          } else if (e.key === 'ArrowUp' && dy < -12) {
            isDirectionMatch = true;
            primaryDist = -dy;
            orthoDist = Math.abs(dx);
          }

          if (isDirectionMatch) {
            const score = primaryDist + orthoDist * 2.5;
            if (score < bestScore) {
              bestScore = score;
              bestCandidate = el;
            }
          }
        }

        if (bestCandidate) {
          e.preventDefault();
          bestCandidate.focus();
          bestCandidate.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      }
    };

    window.addEventListener('keydown', handleTvRemoteKeyDown);
    return () => window.removeEventListener('keydown', handleTvRemoteKeyDown);
  }, [setActiveTab]);

  // Dynamically update document title per active view & playing station
  useEffect(() => {
    const viewTitles = {
      home: `${selectedCountry.localizedName} | ${t.appTitle}`,
      tv: `${t.nav.tv} — ${selectedCountry.localizedName} | ${t.appTitle}`,
      mediateca: `${t.nav.mediateca} — Filme & Seriale | ${t.appTitle}`,
      countries: `${t.nav.countries} | ${t.appTitle}`,
      favorites: `${t.nav.favorites} | ${t.appTitle}`,
      settings: `${t.nav.settings} | ${t.appTitle}`,
    };

    if (currentStation && playerStatus === 'playing') {
      document.title = `▶ ${currentStation.name} — AetherRadio`;
    } else {
      document.title = viewTitles[activeTab] || t.appTitle;
    }
  }, [activeTab, selectedCountry.localizedName, currentStation, playerStatus, t]);

  if (isSmartTvMode) {
    return (
      <SmartTvLampaView
        onExitTvMode={() => {
          document.documentElement.classList.remove('smart-tv-mode');
          setIsSmartTvMode(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden flex flex-col bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100">
      {/* Skip Link for Keyboard Accessibility */}
      <a
        href="#main-content"
        className="visually-hidden focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:rounded-xl focus:bg-brand-700 focus:text-white focus:font-semibold focus:shadow-lg"
      >
        {t.skipToContent}
      </a>

      {/* Desktop Left Sidebar */}
      <Sidebar selectedCountry={selectedCountry} />

      {/* Main Content Column */}
      <div className="flex-1 min-w-0 w-full overflow-x-hidden flex flex-col lg:pl-64">
        <Header selectedCountry={selectedCountry} />

        <main
          id="main-content"
          tabIndex={-1}
          className={`flex-1 min-w-0 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-2.5 sm:pt-5 overflow-x-hidden outline-none ${
            currentStation ? 'pb-44 lg:pb-28' : 'pb-24 lg:pb-12'
          }`}
        >
          {activeTab === 'home' && (
            <HomeView selectedCountry={selectedCountry} />
          )}
          {activeTab === 'tv' && (
            <TvOnlineView selectedCountry={selectedCountry} />
          )}
          {activeTab === 'mediateca' && (
            <MediatecaView selectedCountry={selectedCountry} />
          )}
          {activeTab === 'countries' && (
            <CountriesView
              countries={countries}
              isLoading={isCountriesLoading}
            />
          )}
          {activeTab === 'favorites' && <FavoritesView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Country Quick Selector Dialog */}
      <CountryModal countries={countries} />

      {/* Live HLS TV Video Player Modal */}
      <TvPlayerModal />

      {/* Unified Fixed Bottom Dock: MiniPlayer sits directly ABOVE BottomNav so they NEVER overlap! */}
      <div className="fixed bottom-0 inset-x-0 lg:left-64 z-40 flex flex-col">
        <GlobalPlayer />
        <BottomNav />
      </div>
    </div>
  );
};

export default App;

