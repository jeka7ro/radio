import React, { useEffect, useState } from 'react';
import { ChevronDown, Sun, Moon, Monitor, Globe } from 'lucide-react';
import { useRadioStore } from '../../store/useRadioStore';
import { useTranslation } from '../../i18n/useTranslation';
import { EnrichedCountry } from '../../hooks/useCountries';
import { ThemeMode } from '../../types/radio';
import { SmartCinemaLogo } from '../common/SmartCinemaLogo';
import {
  TvUserProfile,
  loadSharedProfiles,
  saveSharedProfiles,
  syncSharedProfilesFromServer,
  loadSharedActiveProfileId,
  saveSharedActiveProfileId,
  isProfileRememberedOnDevice,
  rememberProfileOnDevice,
} from '../../services/deviceContinuityService';
import { CrossDeviceHandoffModal } from '../tv/CrossDeviceHandoffModal';

interface HeaderProps {
  selectedCountry: EnrichedCountry;
}

export const Header: React.FC<HeaderProps> = ({ selectedCountry }) => {
  const { t, language, setLanguage } = useTranslation();
  const theme = useRadioStore((state) => state.theme);
  const setTheme = useRadioStore((state) => state.setTheme);
  const setCountryModalOpen = useRadioStore((state) => state.setCountryModalOpen);
  const activeTab = useRadioStore((state) => state.activeTab);
  const setActiveTab = useRadioStore((state) => state.setActiveTab);

  const [profiles, setProfiles] = useState<TvUserProfile[]>(() => loadSharedProfiles());
  const [activeProfileId, setActiveProfileId] = useState<string>(() => loadSharedActiveProfileId());
  const [isHandoffModalOpen, setIsHandoffModalOpen] = useState(false);
  const [unlockedPinProfileKey, setUnlockedPinProfileKey] = useState<string>('');

  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) || profiles[0];

  const isPinLockRequired = Boolean(
    !activeProfile ||
      !isProfileRememberedOnDevice(activeProfile) ||
      (activeProfile.pin &&
        activeProfile.pin.trim() &&
        unlockedPinProfileKey &&
        unlockedPinProfileKey !== `${activeProfile.id}:${activeProfile.pin.trim()}`)
  );

  useEffect(() => {
    // Check if URL has ?profile=p1
    try {
      const params = new URLSearchParams(window.location.search);
      const urlProfile = params.get('profile');
      if (urlProfile && profiles.some((p) => p.id === urlProfile)) {
        saveSharedActiveProfileId(urlProfile);
        setActiveProfileId(urlProfile);
      }
    } catch {
      // ignore
    }

    syncSharedProfilesFromServer()
      .then((merged) => {
        if (Array.isArray(merged) && merged.length > 0) {
          setProfiles(merged);
        }
      })
      .catch(() => {});

    const onProfileChange = (e: Event) => {
      const custom = e as CustomEvent<string | { profileId?: string }>;
      const nextId =
        typeof custom.detail === 'string'
          ? custom.detail
          : custom.detail?.profileId || loadSharedActiveProfileId();
      setActiveProfileId(nextId);
      setProfiles(loadSharedProfiles());
    };
    const onProfilesUpdated = () => {
      setProfiles(loadSharedProfiles());
    };
    window.addEventListener('aether:active-profile-changed', onProfileChange);
    window.addEventListener('aether:profiles-updated', onProfilesUpdated);
    return () => {
      window.removeEventListener('aether:active-profile-changed', onProfileChange);
      window.removeEventListener('aether:profiles-updated', onProfilesUpdated);
    };
  }, []);

  const handleSelectProfile = (id: string) => {
    const latest = loadSharedProfiles();
    const target =
      profiles.find((p) => p.id === id) || latest.find((p) => p.id === id);
    if (target) {
      rememberProfileOnDevice(target);
      if (!profiles.some((p) => p.id === target.id)) {
        setProfiles(latest);
      }
    }
    if (target?.pin && target.pin.trim()) {
      setUnlockedPinProfileKey(`${id}:${target.pin.trim()}`);
    } else {
      setUnlockedPinProfileKey('');
    }
    setActiveProfileId(id);
    saveSharedActiveProfileId(id);
  };

  const showCountrySelector =
    activeTab === 'home' || activeTab === 'tv' || activeTab === 'countries';
  const showRadioStationCount =
    activeTab === 'home' || activeTab === 'countries';

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
    <header className="lg:sticky lg:top-0 z-20 bg-slate-50/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800/80 px-3 sm:px-6 lg:px-8">
      <div className="h-11 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">
        {/* Left: Mobile Logo + Country Trigger */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            aria-label="Filmio Home"
            className="lg:hidden flex items-center gap-1.5 text-left rounded-xl py-0.5 pr-1 shrink-0"
          >
            <SmartCinemaLogo size="sm" />
          </button>

          {/* Country selector pill button (only on Radio / TV / Countries views, hidden on Mediatecă) */}
          {showCountrySelector && (
            <button
              type="button"
              onClick={() => setCountryModalOpen(true)}
              aria-label={`${t.header.changeCountry}: ${selectedCountry.localizedName}`}
              className="min-h-[32px] sm:min-h-[40px] px-2.5 sm:px-4 py-1 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-brand-500/60 dark:hover:border-brand-500/60 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold text-slate-900 dark:text-zinc-100 shadow-2xs transition-colors"
            >
              <Globe
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-600 dark:text-brand-400 shrink-0"
                aria-hidden="true"
              />
              <span className="truncate max-w-[115px] sm:max-w-[200px]">
                {selectedCountry.localizedName}
              </span>
              {showRadioStationCount && selectedCountry.stationcount > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] sm:text-xs font-medium rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                  {selectedCountry.stationcount}
                </span>
              )}
              <ChevronDown
                className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500 dark:text-zinc-400"
                aria-hidden="true"
              />
            </button>
          )}
        </div>

        {/* Right: Profile & Continuity + Smart TV Mode + Language & Theme controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {activeProfile && (
            <button
              type="button"
              onClick={() => setIsHandoffModalOpen(true)}
              title="Conturi, Poză de profil, PIN & Continuitate între Smart TV, iPad și Laptop"
              className="min-h-[32px] sm:min-h-[40px] pl-1.5 pr-2.5 sm:pl-2 sm:pr-3.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[11px] sm:text-xs font-extrabold inline-flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
            >
              {activeProfile.avatarUrl ? (
                <img
                  src={activeProfile.avatarUrl}
                  alt={activeProfile.name}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-emerald-400 shrink-0"
                />
              ) : (
                <span className="text-sm leading-none">
                  {activeProfile.avatarEmoji || activeProfile.avatar || ''}
                </span>
              )}
              <span className="max-w-[78px] sm:max-w-[110px] truncate">
                {activeProfile.name}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              document.documentElement.classList.add('smart-tv-mode');
              window.dispatchEvent(new Event('aether:enter-smart-tv'));
            }}
            title="Comută în Interfața Smart TV (Stil Lampa)"
            className="min-h-[32px] sm:min-h-[40px] px-3 sm:px-4 rounded-full bg-sky-600 hover:bg-sky-500 text-white text-[11px] sm:text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Monitor className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Mod Smart TV</span>
            <span className="sm:hidden">TV</span>
          </button>

          <button
            type="button"
            onClick={() => setLanguage(language === 'ro' ? 'en' : 'ro')}
            aria-label={`${t.settings.language}: ${language.toUpperCase()}`}
            className="min-h-[32px] min-w-[32px] sm:min-h-[40px] sm:min-w-[40px] px-2 sm:px-3.5 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200 transition-colors"
          >
            {language.toUpperCase()}
          </button>

          <button
            type="button"
            onClick={cycleTheme}
            aria-label={`${t.settings.appearance}: ${themeLabel}`}
            title={themeLabel}
            className="min-h-[32px] min-w-[32px] sm:min-h-[40px] sm:min-w-[40px] px-2 sm:px-3.5 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center gap-1.5 text-slate-800 dark:text-zinc-200 transition-colors"
          >
            {themeIcon}
            <span className="hidden md:inline text-xs font-medium">
              {theme === 'system' ? 'Auto' : theme === 'dark' ? 'Dark' : 'Light'}
            </span>
          </button>
        </div>
      </div>

      <CrossDeviceHandoffModal
        isOpen={Boolean(isHandoffModalOpen || isPinLockRequired)}
        isPinLockRequired={Boolean(isPinLockRequired)}
        onClose={() => {
          if (!isPinLockRequired) {
            setIsHandoffModalOpen(false);
          }
        }}
        profiles={profiles}
        activeProfileId={activeProfileId}
        onSelectProfile={handleSelectProfile}
        onProfilesChange={(next) => setProfiles(next)}
        uiLang={language === 'en' ? 'en' : 'ro'}
      />
    </header>
  );
};

