import React, { useEffect } from 'react';
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

export const App: React.FC = () => {
  useTheme();
  const { t } = useTranslation();
  const { countries, selectedCountry, isLoading: isCountriesLoading } = useCountries();

  const activeTab = useRadioStore((state) => state.activeTab);
  const currentStation = useRadioStore((state) => state.currentStation);
  const playerStatus = useRadioStore((state) => state.playerStatus);

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

