import React from "react";
import {
  ChevronLeft,
  X,
  Radio,
  Music,
  Disc,
  SkipBack,
  SkipForward,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Heart,
  PictureInPicture2,
  VolumeX,
  Volume2,
  ArrowLeft,
  Users,
} from "lucide-react";
import { getCountryFlagEmoji } from "../../services/geoLanguageService";
import { resolveAudioTrackIndexByPreference } from "../../services/subtitleSearchService";
import { Station } from "../../types/radio";
import { TrailerItem } from "../../views/smartTvLampaHelpers";
import { StationAvatar } from "../common/StationAvatar";
import { toggleRadioPip } from "../player/RadioPipPlayer";
import { TvPlayerModal } from "./TvPlayerModal";
import { CrossDeviceHandoffModal } from "./CrossDeviceHandoffModal";
import { ActorProfileModal } from "./ActorProfileModal";
import { OnlineSubtitleFinderModal } from "./OnlineSubtitleFinderModal";
import {
  TV_GENRE_PILLS,
  TV_ORIGIN_COUNTRIES,
  LAMPA_FILTER_RATINGS,
  LAMPA_FILTER_YEARS,
  SMART_TV_AUDIO_OPTIONS,
  SMART_TV_SUB_LANG_OPTIONS,
  SMART_TV_SUB_SIZE_OPTIONS,
  SMART_TV_QUALITY_OPTIONS,
  SMART_TV_SERVER_OPTIONS,
  SMART_TV_OSD_OPTIONS,
  DEFAULT_SMART_TV_SETTINGS,
  saveSmartTvSettings,
  saveTvProfiles,
  isAdminJekaProfile,
  canProfileAccessAdult,
  canProfileAccessIedem,
  SmartTvProfile,
} from "../../views/smartTvLampaHelpers";

export const SmartTvDrawersAndModals: React.FC<any> = ({
  setVodPage,
  fetchVodCatalog,
  section,
  activeProfile,
  setEditingProfileId,
  setIsProfilePickerOpen,
  handleClearAllWatchProgress,
  historyList,
  setPreferredSubLang,
  setSelectedAudioTrackIdx,
  handleQuickSubLangSwitch,
  setActiveServer,
  resolvedDirectStream,
  isFilterDrawerOpen,
  filterSubMenu,
  setFilterSubMenu,
  setIsFilterDrawerOpen,
  tr,
  setSection,
  filterMediaType,
  setFilterMediaType,
  filterRating,
  setFilterRating,
  selectedGenre,
  setSelectedGenre,
  originCountry,
  setOriginCountry,
  filterYear,
  setFilterYear,
  isCatalogDrawerOpen,
  setIsCatalogDrawerOpen,
  isSettingsDrawerOpen,
  settingsSubMenu,
  setSettingsSubMenu,
  setIsSettingsDrawerOpen,
  uiLang,
  switchUiLang,
  tvSettings,
  updateTvSetting,
  adultContentEnabled,
  setAdultContentEnabled,
  tvRegionId,
  setTvRegionId,
  tvCategoryId,
  setTvCategoryId,
  setTvSettings,
  activeProfileId,
  onExitTvMode,
  isTvRadioPlayerOpen,
  setIsTvRadioPlayerOpen,
  currentStation,
  activeRadioTrack,
  nowPlayingTitle,
  playPreviousStation,
  playerStatus,
  stopRadio,
  playStation,
  radioStations,
  playNextAvailableStation,
  triggerStreamReload,
  toggleFavorite,
  favorites,
  toggleMute,
  isMuted,
  volume,
  setVolume,
  isTrailerModalOpen,
  setIsTrailerModalOpen,
  activeVodItem,
  trailerList,
  activeTrailerIdx,
  setActiveTrailerIdx,
  isLoadingTrailer,
  isHandoffModalOpen,
  setIsHandoffModalOpen,
  isPinLockRequired,
  tvProfiles,
  handleSelectProfile,
  setTvProfiles,
  selectedSeason,
  selectedEpisode,
  resumeStartSeconds,
  selectedActor,
  setSelectedActor,
  handleOpenVod,
  isSubFinderOpen,
  setIsSubFinderOpen,
  detailedMeta,
  preferredSubLang,
  setActiveSubVttUrl,
  setActiveSubLabel,
  setActiveSubCues,
}) => {
  return (
    <>
{/* APPLE macOS TAHOE FLOATING ROUNDED LIQUID GLASS "Фильтр / Filtru" SHEET */}
      {isFilterDrawerOpen && (
        <div
          style={{
            paddingTop: 'var(--safe-top, env(safe-area-inset-top, 0px))',
            paddingBottom: 'var(--safe-bottom, env(safe-area-inset-bottom, 0px))',
            paddingLeft: 'var(--safe-left, env(safe-area-inset-left, 0px))',
            paddingRight: 'var(--safe-right, env(safe-area-inset-right, 0px))',
          }}
          className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-md"
          onClick={() => {
            if (filterSubMenu) {
              setFilterSubMenu(null);
            } else {
              setIsFilterDrawerOpen(false);
            }
          }}
        >
          <div
            data-filter-drawer="true"
            className="w-80 sm:w-[390px] m-3 sm:m-4 h-[calc(100%-1.5rem)] sm:h-[calc(100%-2rem)] rounded-[32px] tahoe-glass text-zinc-100 shadow-2xl flex flex-col overflow-hidden border border-white/15 p-3"
            onClick={(e) => e.stopPropagation()}
          >
            {filterSubMenu === null ? (
              <>
                <div className="px-4 py-3.5 flex items-center justify-between border-b border-white/10 mb-2">
                  <h2 className="text-[22px] font-bold text-white tracking-tight">
                    {tr('Filtru', 'Filter', 'Фильтр')}
                  </h2>
                  <button
                    type="button"
                    data-drawer-close="true"
                    onClick={() => setIsFilterDrawerOpen(false)}
                    className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.06] text-zinc-300 hover:text-white hover:bg-white/15 focus:bg-white focus:text-[#141414] focus:outline-none cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 px-1">
                  {/* 1. Начать поиск */}
                  <button
                    type="button"
                    data-drawer-initial-focus="true"
                    onClick={() => {
                      setIsFilterDrawerOpen(false);
                      setSection('filter');
                      setVodPage(1);
                      void fetchVodCatalog(1, false);
                    }}
                    className="w-full px-5 py-3.5 rounded-2xl text-left bg-white/10 border border-white/25 text-white hover:bg-white/15 focus:bg-gradient-to-r focus:from-[#e4e4e7] focus:via-[#ffffff] focus:to-[#d4d4d8] focus:text-[#141414] focus:font-bold focus:outline-none transition-all cursor-pointer"
                  >
                    <div className="text-[15px] font-bold">
                      {tr('Aplică filtrul / Caută', 'Apply Filter / Search', 'Начать поиск')}
                    </div>
                  </button>

                  {/* 2. Тип */}
                  <button
                    type="button"
                    onClick={() => setFilterSubMenu('type')}
                    className="w-full px-5 py-3.5 rounded-2xl text-left bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.06] focus:bg-gradient-to-r focus:from-[#e4e4e7] focus:via-[#ffffff] focus:to-[#d4d4d8] focus:text-[#141414] focus:outline-none group transition-all cursor-pointer"
                  >
                    <div className="text-[15px] font-semibold text-white group-focus:text-[#141414]">
                      {tr('Tip conținut', 'Content Type', 'Тип')}
                    </div>
                    <div className="text-[12px] text-zinc-400 group-focus:text-zinc-800 mt-0.5">
                      {filterMediaType === 'series'
                        ? tr('Seriale TV', 'TV Series', 'Сериалы')
                        : tr('Filme', 'Movies', 'Фильмы')}
                    </div>
                  </button>

                  {/* 3. Рейтинг */}
                  <button
                    type="button"
                    onClick={() => setFilterSubMenu('rating')}
                    className="w-full px-5 py-3.5 rounded-2xl text-left bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.06] focus:bg-gradient-to-r focus:from-[#e4e4e7] focus:via-[#ffffff] focus:to-[#d4d4d8] focus:text-[#141414] focus:outline-none group transition-all cursor-pointer"
                  >
                    <div className="text-[15px] font-semibold text-white group-focus:text-[#141414]">
                      {tr('Notă / Rating', 'Rating', 'Рейтинг')}
                    </div>
                    <div className="text-[12px] text-zinc-400 group-focus:text-zinc-800 mt-0.5">
                      {(() => {
                        const found = LAMPA_FILTER_RATINGS.find(
                          (r) => r.id === filterRating
                        );
                        return found
                          ? tr(found.label, found.labelEn, found.labelRu)
                          : tr('Neselectat', 'Any', 'Не выбрано');
                      })()}
                    </div>
                  </button>

                  {/* 4. Жанр */}
                  <button
                    type="button"
                    onClick={() => setFilterSubMenu('genre')}
                    className="w-full px-5 py-3.5 rounded-2xl text-left bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.06] focus:bg-gradient-to-r focus:from-[#e4e4e7] focus:via-[#ffffff] focus:to-[#d4d4d8] focus:text-[#141414] focus:outline-none group transition-all cursor-pointer"
                  >
                    <div className="text-[15px] font-semibold text-white group-focus:text-[#141414]">
                      {tr('Gen', 'Genre', 'Жанр')}
                    </div>
                    <div className="text-[12px] text-zinc-400 group-focus:text-zinc-800 mt-0.5">
                      {(() => {
                        const found = TV_GENRE_PILLS.find(
                          (g) => g.id === selectedGenre
                        );
                        return found
                          ? tr(found.label, found.labelEn, found.labelRu)
                          : tr('Toate genurile', 'All Genres', 'Не выбрано');
                      })()}
                    </div>
                  </button>

                  {/* 5. Язык оригинала */}
                  <button
                    type="button"
                    onClick={() => setFilterSubMenu('lang')}
                    className="w-full px-5 py-3.5 rounded-2xl text-left bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.06] focus:bg-gradient-to-r focus:from-[#e4e4e7] focus:via-[#ffffff] focus:to-[#d4d4d8] focus:text-[#141414] focus:outline-none group transition-all cursor-pointer"
                  >
                    <div className="text-[15px] font-semibold text-white group-focus:text-[#141414]">
                      {tr('Țară / Limba originală', 'Country / Original Language', 'Язык оригинала')}
                    </div>
                    <div className="text-[12px] text-zinc-400 group-focus:text-zinc-800 mt-0.5">
                      {(() => {
                        const found = TV_ORIGIN_COUNTRIES.find(
                          (c) => c.id === originCountry
                        );
                        return found
                          ? tr(found.label, found.labelEn, found.labelRu)
                          : tr('Neselectat', 'Any', 'Не выбрано');
                      })()}
                    </div>
                  </button>

                  {/* 6. Год */}
                  <button
                    type="button"
                    onClick={() => setFilterSubMenu('year')}
                    className="w-full px-5 py-3.5 rounded-2xl text-left bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.06] focus:bg-gradient-to-r focus:from-[#e4e4e7] focus:via-[#ffffff] focus:to-[#d4d4d8] focus:text-[#141414] focus:outline-none group transition-all cursor-pointer"
                  >
                    <div className="text-[15px] font-semibold text-white group-focus:text-[#141414]">
                      {tr('Anul lansării', 'Release Year', 'Год')}
                    </div>
                    <div className="text-[12px] text-zinc-400 group-focus:text-zinc-800 mt-0.5">
                      {(() => {
                        const found = LAMPA_FILTER_YEARS.find(
                          (y) => y.id === filterYear
                        );
                        return found
                          ? tr(found.label, found.labelEn, found.labelRu)
                          : tr('Orice an', 'Any Year', 'Не выбрано');
                      })()}
                    </div>
                  </button>

                  {/* 7. Сбросить фильтр */}
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMediaType('movie');
                      setFilterRating('any');
                      setSelectedGenre('top');
                      setOriginCountry('ALL');
                      setFilterYear('any');
                    }}
                    className="w-full px-5 py-3.5 rounded-2xl text-left text-zinc-400 hover:text-white bg-white/[0.02] hover:bg-white/[0.08] border border-white/[0.05] focus:bg-gradient-to-r focus:from-[#e4e4e7] focus:via-[#ffffff] focus:to-[#d4d4d8] focus:text-[#141414] focus:font-semibold focus:outline-none transition-all cursor-pointer"
                  >
                    <div className="text-[14px]">
                      {tr('Resetează filtrul', 'Reset Filter', 'Сбросить фильтр')}
                    </div>
                  </button>
                </div>
              </>
            ) : (
              /* SUB-MENU WITH CHECKBOXES ON THE RIGHT (Язык оригинала / Жанр / Тип / Рейтинг / Год) */
              <>
                <div className="px-4 py-3.5 flex items-center justify-between border-b border-white/10 mb-2">
                  <button
                    type="button"
                    data-drawer-close="true"
                    onClick={() => setFilterSubMenu(null)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] text-left text-white hover:bg-white/15 focus:bg-white focus:text-[#141414] focus:outline-none cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    <span className="text-[18px] font-bold tracking-tight">
                      {filterSubMenu === 'lang'
                        ? tr('Limba originală', 'Original Language', 'Язык оригинала')
                        : filterSubMenu === 'genre'
                          ? tr('Gen', 'Genre', 'Жанр')
                          : filterSubMenu === 'rating'
                            ? tr('Notă / Rating', 'Rating', 'Рейтинг')
                            : filterSubMenu === 'year'
                              ? tr('Anul lansării', 'Release Year', 'Год')
                              : tr('Tip conținut', 'Content Type', 'Тип')}
                    </span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 px-1">
                  {filterSubMenu === 'type' &&
                    (
                      [
                        {
                          id: 'movie',
                          label: tr('Filme', 'Movies', 'Фильмы'),
                        },
                        {
                          id: 'series',
                          label: tr('Seriale TV', 'TV Series', 'Сериалы'),
                        },
                      ] as const
                    ).map((opt) => {
                      const checked = filterMediaType === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-drawer-initial-focus={checked ? 'true' : undefined}
                          onClick={() => {
                            setFilterMediaType(opt.id);
                            setFilterSubMenu(null);
                          }}
                          className={`w-full px-5 py-3.5 rounded-2xl flex items-center justify-between text-left transition-all focus:bg-gradient-to-r focus:from-[#e4e4e7] focus:via-[#ffffff] focus:to-[#d4d4d8] focus:text-[#141414] focus:outline-none group cursor-pointer ${checked
                              ? 'bg-white/10 border border-white/25'
                              : 'bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.05]'
                            }`}
                        >
                          <span className="text-[15px] text-white group-focus:text-[#141414] font-medium group-focus:font-semibold">
                            {opt.label}
                          </span>
                          <span
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${checked
                                ? 'border-white group-focus:border-[#141414] bg-white group-focus:bg-[#141414] text-[#141414] group-focus:text-white'
                                : 'border-zinc-500 group-focus:border-zinc-800'
                              }`}
                          >
                            {checked && (
                              <span className="text-xs font-black"></span>
                            )}
                          </span>
                        </button>
                      );
                    })}

                  {filterSubMenu === 'lang' &&
                    TV_ORIGIN_COUNTRIES.map((opt) => {
                      const checked = originCountry === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-drawer-initial-focus={checked ? 'true' : undefined}
                          onClick={() => {
                            setOriginCountry(opt.id);
                            setFilterSubMenu(null);
                          }}
                          className={`w-full px-5 py-3.5 rounded-2xl flex items-center justify-between text-left transition-all focus:bg-gradient-to-r focus:from-[#e4e4e7] focus:via-[#ffffff] focus:to-[#d4d4d8] focus:text-[#141414] focus:outline-none group cursor-pointer ${checked
                              ? 'bg-white/10 border border-white/25'
                              : 'bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.05]'
                            }`}
                        >
                          <span className="text-[15px] text-white group-focus:text-[#141414] font-medium group-focus:font-semibold">
                            {tr(opt.label, opt.labelEn, opt.labelRu)}
                          </span>
                          <span
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${checked
                                ? 'border-white group-focus:border-[#141414] bg-white group-focus:bg-[#141414] text-[#141414] group-focus:text-white'
                                : 'border-zinc-500 group-focus:border-zinc-800'
                              }`}
                          >
                            {checked && (
                              <span className="text-xs font-black"></span>
                            )}
                          </span>
                        </button>
                      );
                    })}

                  {filterSubMenu === 'genre' &&
                    TV_GENRE_PILLS.filter(
                      (opt) => adultContentEnabled || opt.id !== 'Adult'
                    ).map((opt) => {
                      const checked = selectedGenre === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-drawer-initial-focus={checked ? 'true' : undefined}
                          onClick={() => {
                            setSelectedGenre(opt.id);
                            setFilterSubMenu(null);
                          }}
                          className={`w-full px-5 py-3.5 rounded-2xl flex items-center justify-between text-left transition-all focus:bg-gradient-to-r focus:from-[#e4e4e7] focus:via-[#ffffff] focus:to-[#d4d4d8] focus:text-[#141414] focus:outline-none group cursor-pointer ${checked
                              ? 'bg-white/10 border border-white/25'
                              : 'bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.05]'
                            }`}
                        >
                          <span className="text-[15px] text-white group-focus:text-[#141414] font-medium group-focus:font-semibold">
                            {tr(opt.label, opt.labelEn, opt.labelRu)}
                          </span>
                          <span
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${checked
                                ? 'border-white group-focus:border-[#141414] bg-white group-focus:bg-[#141414] text-[#141414] group-focus:text-white'
                                : 'border-zinc-500 group-focus:border-zinc-800'
                              }`}
                          >
                            {checked && (
                              <span className="text-xs font-black"></span>
                            )}
                          </span>
                        </button>
                      );
                    })}

                  {filterSubMenu === 'rating' &&
                    LAMPA_FILTER_RATINGS.map((opt) => {
                      const checked = filterRating === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-drawer-initial-focus={checked ? 'true' : undefined}
                          onClick={() => {
                            setFilterRating(opt.id);
                            setFilterSubMenu(null);
                          }}
                          className={`w-full px-5 py-3.5 rounded-2xl flex items-center justify-between text-left transition-all focus:bg-gradient-to-r focus:from-[#e4e4e7] focus:via-[#ffffff] focus:to-[#d4d4d8] focus:text-[#141414] focus:outline-none group cursor-pointer ${checked
                              ? 'bg-white/10 border border-white/25'
                              : 'bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.05]'
                            }`}
                        >
                          <span className="text-[15px] text-white group-focus:text-[#141414] font-medium group-focus:font-semibold">
                            {tr(opt.label, opt.labelEn, opt.labelRu)}
                          </span>
                          <span
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${checked
                                ? 'border-white group-focus:border-[#141414] bg-white group-focus:bg-[#141414] text-[#141414] group-focus:text-white'
                                : 'border-zinc-500 group-focus:border-zinc-800'
                              }`}
                          >
                            {checked && (
                              <span className="text-xs font-black"></span>
                            )}
                          </span>
                        </button>
                      );
                    })}

                  {filterSubMenu === 'year' &&
                    LAMPA_FILTER_YEARS.map((opt) => {
                      const checked = filterYear === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-drawer-initial-focus={checked ? 'true' : undefined}
                          onClick={() => {
                            setFilterYear(opt.id);
                            setFilterSubMenu(null);
                          }}
                          className={`w-full px-5 py-3.5 rounded-2xl flex items-center justify-between text-left transition-all focus:bg-gradient-to-r focus:from-[#e4e4e7] focus:via-[#ffffff] focus:to-[#d4d4d8] focus:text-[#141414] focus:outline-none group cursor-pointer ${checked
                              ? 'bg-white/10 border border-white/25'
                              : 'bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.05]'
                            }`}
                        >
                          <span className="text-[15px] text-white group-focus:text-[#141414] font-medium group-focus:font-semibold">
                            {tr(opt.label, opt.labelEn, opt.labelRu)}
                          </span>
                          <span
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${checked
                                ? 'border-white group-focus:border-[#141414] bg-white group-focus:bg-[#141414] text-[#141414] group-focus:text-white'
                                : 'border-zinc-500 group-focus:border-zinc-800'
                              }`}
                          >
                            {checked && (
                              <span className="text-xs font-black"></span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* APPLE macOS TAHOE FLOATING ROUNDED LIQUID GLASS "Каталог / Catalog" SHEET */}
      {isCatalogDrawerOpen && (
        <div
          style={{
            paddingTop: 'var(--safe-top, env(safe-area-inset-top, 0px))',
            paddingBottom: 'var(--safe-bottom, env(safe-area-inset-bottom, 0px))',
            paddingLeft: 'var(--safe-left, env(safe-area-inset-left, 0px))',
            paddingRight: 'var(--safe-right, env(safe-area-inset-right, 0px))',
          }}
          className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-md"
          onClick={() => setIsCatalogDrawerOpen(false)}
        >
          <div
            data-catalog-drawer="true"
            className="w-80 sm:w-[390px] m-3 sm:m-4 h-[calc(100%-1.5rem)] sm:h-[calc(100%-2rem)] rounded-[32px] tahoe-glass text-zinc-100 shadow-2xl flex flex-col overflow-hidden border border-white/15 p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3.5 flex items-center justify-between border-b border-white/10 mb-2">
              <h2 className="text-[22px] font-bold text-white tracking-tight">
                {tr('Catalog', 'Catalog', 'Каталог')}
              </h2>
              <button
                type="button"
                data-drawer-close="true"
                onClick={() => setIsCatalogDrawerOpen(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.06] text-zinc-300 hover:text-white hover:bg-white/15 focus:bg-white focus:text-[#141414] focus:outline-none cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 px-1">
              {TV_GENRE_PILLS.filter(
                (g) => g.id !== 'top' && (adultContentEnabled || g.id !== 'Adult')
              ).map((g, idx) => {
                const active =
                  section === 'catalog' && selectedGenre === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    data-drawer-initial-focus={active || idx === 0 ? 'true' : undefined}
                    onClick={() => {
                      setOriginCountry('ALL');
                      setSelectedGenre(g.id);
                      setSection('catalog');
                      setIsCatalogDrawerOpen(false);
                    }}
                    className={`w-full px-5 py-3.5 rounded-2xl text-left text-[15px] font-medium transition-all focus:bg-gradient-to-r focus:from-[#e4e4e7] focus:via-[#ffffff] focus:to-[#d4d4d8] focus:text-[#141414] focus:font-bold focus:outline-none cursor-pointer ${active
                        ? 'bg-white/10 border border-white/25 text-white font-bold'
                        : 'bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.05] text-white'
                      }`}
                  >
                    {tr(g.label, g.labelEn, g.labelRu)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* APPLE macOS TAHOE FLOATING ROUNDED LIQUID GLASS "Настройки / Setări Smart TV" SHEET */}
      {isSettingsDrawerOpen && (
        <div
          style={{
            paddingTop: 'var(--safe-top, env(safe-area-inset-top, 0px))',
            paddingBottom: 'var(--safe-bottom, env(safe-area-inset-bottom, 0px))',
            paddingLeft: 'var(--safe-left, env(safe-area-inset-left, 0px))',
            paddingRight: 'var(--safe-right, env(safe-area-inset-right, 0px))',
          }}
          className="fixed inset-0 z-[150] flex justify-end bg-black/55 backdrop-blur-md"
          onClick={() => {
            if (settingsSubMenu) {
              setSettingsSubMenu(null);
            } else {
              setIsSettingsDrawerOpen(false);
            }
          }}
        >
          <div
            data-settings-drawer="true"
            className="w-80 sm:w-[420px] m-3 sm:m-4 h-[calc(100%-1.5rem)] sm:h-[calc(100%-2rem)] rounded-[32px] tahoe-glass text-zinc-100 shadow-2xl flex flex-col overflow-hidden border border-white/15 p-3"
            onClick={(e) => e.stopPropagation()}
          >
            {settingsSubMenu === null ? (
              <>
                <div className="px-4 py-3.5 flex items-center justify-between border-b border-white/10 mb-2">
                  <div>
                    <h2 className="text-[22px] font-bold text-white tracking-tight">
                      {tr('Setări Smart TV', 'Smart TV Settings', 'Настройки')}
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {tr(
                        `Profil activ: ${activeProfile.name}`,
                        `Active profile: ${activeProfile.name}`,
                        `Профиль: ${activeProfile.name}`
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    data-drawer-close="true"
                    onClick={() => setIsSettingsDrawerOpen(false)}
                    title={tr('Închide (Esc)', 'Close (Esc)', 'Закрыть (Esc)')}
                    className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.06] text-zinc-300 hover:text-white hover:bg-white/15 focus:bg-white focus:text-[#141414] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 px-1">
                  {/* 0A. Profil Activ & Schimbare Rapidă Utilizator (Prioritatea #1) */}
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-400/35 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`relative w-9 h-9 rounded-full bg-gradient-to-br ${activeProfile.avatarBg} flex items-center justify-center text-xs font-black text-white shadow overflow-hidden shrink-0 ring-2 ring-emerald-400`}
                        >
                          {activeProfile.avatarUrl ? (
                            <img
                              src={activeProfile.avatarUrl}
                              alt={activeProfile.name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            activeProfile.name.slice(0, 1).toUpperCase() || 'E'
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">
                            {tr('Conectat acum pe:', 'Connected now:', 'Активный профиль:')}
                          </div>
                          <div className="text-base font-black text-white truncate">
                            {activeProfile.name}
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-400 text-zinc-950 text-[10px] font-black uppercase tracking-wider shrink-0 shadow">
                        {tr('ACTIV', 'ACTIVE', 'АКТИВЕН')}
                      </span>
                    </div>

                    {/* Direct 1-Click Profile Switcher Buttons right inside Settings */}
                    {Array.isArray(tvProfiles) && tvProfiles.length > 1 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-bold text-zinc-300">
                          {tr(
                            'Apasă OK pe un profil pentru conectare directă:',
                            'Press OK on a profile to sign in directly:',
                            'Нажмите OK на профиль для быстрого входа:'
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {tvProfiles.map((prof: SmartTvProfile) => {
                            const isCur = prof.id === activeProfileId;
                            const hasPin = Boolean(prof.pin && prof.pin.trim());
                            return (
                              <button
                                key={`quick_switch_${prof.id}`}
                                type="button"
                                data-drawer-initial-focus={isCur ? 'true' : undefined}
                                onClick={() => {
                                  if (hasPin && !isCur) {
                                    setIsSettingsDrawerOpen(false);
                                    setEditingProfileId(null);
                                    setIsHandoffModalOpen(true);
                                    return;
                                  }
                                  handleSelectProfile(prof.id);
                                  setIsSettingsDrawerOpen(false);
                                }}
                                className={`h-11 px-3 rounded-xl flex items-center justify-between gap-2 text-left transition-all focus:outline-none focus:ring-4 focus:ring-white focus:bg-white focus:text-zinc-950 cursor-pointer border ${
                                  isCur
                                    ? 'bg-emerald-400 text-zinc-950 border-emerald-200 font-black shadow'
                                    : 'bg-white/[0.08] hover:bg-white/20 text-white border-white/15 font-bold'
                                }`}
                              >
                                <span className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`w-6 h-6 rounded-full bg-gradient-to-br ${prof.avatarBg} flex items-center justify-center text-[10px] font-black text-white overflow-hidden shrink-0`}
                                  >
                                    {prof.avatarUrl ? (
                                      <img
                                        src={prof.avatarUrl}
                                        alt={prof.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      prof.name.slice(0, 1).toUpperCase()
                                    )}
                                  </span>
                                  <span className="text-xs truncate">{prof.name}</span>
                                </span>
                                <span className="text-[10px] font-extrabold uppercase shrink-0">
                                  {isCur
                                    ? tr('Activ', 'Active', 'Актив')
                                    : hasPin
                                      ? 'PIN'
                                      : tr('Intră', 'Sign In', 'Войти')}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      data-drawer-initial-focus={
                        !Array.isArray(tvProfiles) || tvProfiles.length <= 1
                          ? 'true'
                          : undefined
                      }
                      onClick={() => {
                        setIsSettingsDrawerOpen(false);
                        setEditingProfileId(null);
                        setIsHandoffModalOpen(true);
                      }}
                      className="w-full h-10 px-4 rounded-xl flex items-center justify-between gap-2 bg-white/10 hover:bg-white hover:text-zinc-950 focus:bg-white focus:text-zinc-950 focus:ring-4 focus:ring-white focus:outline-none text-white text-xs font-extrabold transition-all cursor-pointer"
                    >
                      <span>
                        {tr(
                          'Ecran Complet Profiluri (Schimbă / Adaugă / PIN)',
                          'Full Profile Screen (Switch / Add / PIN)',
                          'Все профили (Сменить / Добавить / PIN)'
                        )}
                      </span>
                      <Users className="w-4 h-4 shrink-0" />
                    </button>
                  </div>

                  {/* 0B. Limba Interfeței (EN / RO / RU) */}
                  <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] space-y-2.5">
                    <div className="text-[14px] font-semibold text-white">
                      {tr(
                        'Limba Interfeței / Interface Language',
                        'Interface Language / Limba Interfeței',
                        'Язык интерфейса / Interface Language'
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'en', label: 'EN • English' },
                          { id: 'ro', label: 'RO • Română' },
                          { id: 'ru', label: 'RU • Русский' },
                        ] as const
                      ).map((lOpt) => {
                        const isCur = uiLang === lOpt.id;
                        return (
                          <button
                            key={`settings_lang_${lOpt.id}`}
                            type="button"
                            onClick={() => switchUiLang(lOpt.id)}
                            className={`h-9 rounded-full text-xs font-extrabold transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer ${isCur
                                ? 'bg-white text-zinc-950 shadow'
                                : 'bg-white/[0.06] hover:bg-white/[0.12] focus:bg-white focus:text-[#141414] text-zinc-200'
                              }`}
                          >
                            {lOpt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 0B. Temă Vizuală Smart TV (Cinema Dark vs Ambient Slate TV) */}
                  <button
                    type="button"
                    onClick={() =>
                      updateTvSetting(
                        'tvTheme',
                        tvSettings.tvTheme === 'ambient' ? 'dark' : 'ambient'
                      )
                    }
                    className="w-full px-5 py-3.5 rounded-2xl flex items-center justify-between gap-3 text-left bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.06] focus:bg-gradient-to-r focus:from-[#e4e4e7] focus:via-[#ffffff] focus:to-[#d4d4d8] focus:text-[#141414] focus:outline-none group transition-all cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold text-white group-focus:text-[#141414] flex items-center gap-2">
                        <span>
                          {tr(
                            'Temă Vizuală Smart TV',
                            'Smart TV Visual Theme',
                            'Тема оформления Smart TV'
                          )}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            tvSettings.tvTheme === 'ambient'
                              ? 'bg-amber-400 text-zinc-950'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {tvSettings.tvTheme === 'ambient'
                            ? tr('Ambient Deschis', 'Ambient Light', 'Светлая Ambient')
                            : tr('Cinema Dark', 'Cinema Dark', 'Темная Cinema')}
                        </span>
                      </div>
                      <div className="text-[12px] text-zinc-300 group-focus:text-zinc-800 mt-0.5 font-medium">
                        {tvSettings.tvTheme === 'ambient'
                          ? tr(
                              'Titanium Slate (Deschis confortabil pentru TV, fără alb orbitor)',
                              'Titanium Slate (Soft daylight theme for TV, no harsh white glare)',
                              'Titanium Slate (Мягкая светлая тема для ТВ без резкого белого)'
                            )
                          : tr(
                              'Cinema Dark (Negru profund pentru OLED / QLED)',
                              'Cinema Dark (Deep contrast for OLED / QLED)',
                              'Cinema Dark (Глубокий темный режим для ТВ)'
                            )}
                      </div>
                    </div>
                  </button>

                  {/* 1. Pistă Audio Implicită (Limbă Originală / Dublaj) */}
                  <button
                    type="button"
                    onClick={() => setSettingsSubMenu('audio')}
                    className="w-full px-5 py-3.5 rounded-2xl text-left bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.06] focus:bg-gradient-to-r focus:from-[#e4e4e7] focus:via-[#ffffff] focus:to-[#d4d4d8] focus:text-[#141414] focus:outline-none group transition-all cursor-pointer"
                  >
                    <div className="text-[15px] font-semibold text-white group-focus:text-[#141414]">
                      {tr(
                        'Limbă Audio Implicită',
                        'Default Audio Track',
                        'Аудиодорожка по умолчанию'
                      )}
                    </div>
                    <div className="text-[12px] text-zinc-300 group-focus:text-zinc-800 mt-0.5 font-medium">
                      {SMART_TV_AUDIO_OPTIONS.find(
                        (o) => o.id === tvSettings.defaultAudioPref
                      )?.label || 'Limba Originală'}
                    </div>
                  </button>

                  {/* 2. Subtitrare Automată Implicită (RO / RU / EN / Oprit) */}
                  <button
                    type="button"
                    onClick={() => setSettingsSubMenu('subtitles')}
                    className="w-full px-5 py-3.5 rounded-2xl text-left bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.06] focus:bg-gradient-to-r focus:from-[#e4e4e7] focus:via-[#ffffff] focus:to-[#d4d4d8] focus:text-[#141414] focus:outline-none group transition-all cursor-pointer"
                  >
                    <div className="text-[15px] font-semibold text-white group-focus:text-[#141414]">
                      {tr(
                        'Subtitrare Automată Implicită',
                        'Default Subtitle Language',
                        'Субтитры по умолчанию'
                      )}
                    </div>
                    <div className="text-[12px] text-zinc-200 group-focus:text-zinc-800 mt-0.5 font-medium">
                      {SMART_TV_SUB_LANG_OPTIONS.find(
                        (o) => o.id === tvSettings.defaultSubLang
                      )?.label || 'RO • Română'}
                    </div>
                  </button>

                  {/* 3. Mărime Font Subtitrare TV */}
                  <button
                    type="button"
                    onClick={() => setSettingsSubMenu('subSize')}
                    className="w-full px-5 py-3.5 rounded-2xl text-left bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.06] focus:bg-gradient-to-r focus:from-[#e4e4e7] focus:via-[#ffffff] focus:to-[#d4d4d8] focus:text-[#141414] focus:outline-none group transition-all cursor-pointer"
                  >
                    <div className="text-[15px] font-semibold text-white group-focus:text-[#141414]">
                      {tr(
                        'Mărime Font Subtitrare',
                        'Subtitle Font Size',
                        'Размер субтитров'
                      )}
                    </div>
                    <div className="text-[12px] text-zinc-400 group-focus:text-zinc-800 mt-0.5">
                      {SMART_TV_SUB_SIZE_OPTIONS.find(
                        (o) => o.id === tvSettings.defaultSubFontSize
                      )?.label || 'Mare — Smart TV (125%)'}
                    </div>
                  </button>

                  {/* 4. Calitate Video Implicită (4K / 1080p / 720p / 480p / Auto) */}
                  <button
                    type="button"
                    onClick={() => setSettingsSubMenu('quality')}
                    className="w-full px-5 py-3.5 rounded-2xl text-left bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.06] focus:bg-gradient-to-r focus:from-[#e4e4e7] focus:via-[#ffffff] focus:to-[#d4d4d8] focus:text-[#141414] focus:outline-none group transition-all cursor-pointer"
                  >
                    <div className="text-[15px] font-semibold text-white group-focus:text-[#141414]">
                      {tr(
                        'Calitate Video Implicită',
                        'Default Video Quality',
                        'Качество видео'
                      )}
                    </div>
                    <div className="text-[12px] text-zinc-300 group-focus:text-zinc-800 mt-0.5 font-medium">
                      {SMART_TV_QUALITY_OPTIONS.find(
                        (o) => o.id === tvSettings.defaultVideoQuality
                      )?.label || 'Maximă Disponibilă (4K / 1080p)'}
                    </div>
                  </button>

                  {/* 5. Server / Sursă Video Implicită */}
                  <button
                    type="button"
                    onClick={() => setSettingsSubMenu('server')}
                    className="w-full px-5 py-3.5 rounded-2xl text-left bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.06] focus:bg-gradient-to-r focus:from-[#e4e4e7] focus:via-[#ffffff] focus:to-[#d4d4d8] focus:text-[#141414] focus:outline-none group transition-all cursor-pointer"
                  >
                    <div className="text-[15px] font-semibold text-white group-focus:text-[#141414]">
                      {tr(
                        'Sursă Video Implicită',
                        'Default Video Source / Server',
                        'Источник видео'
                      )}
                    </div>
                    <div className="text-[12px] text-zinc-400 group-focus:text-zinc-800 mt-0.5">
                      {SMART_TV_SERVER_OPTIONS.find(
                        (o) => o.id === tvSettings.defaultVodServer
                      )?.label || 'Automat — Cea mai bună calitate'}
                    </div>
                  </button>

                  {/* 6. Ascundere Automată OSD & Info în Player */}
                  <button
                    type="button"
                    onClick={() => setSettingsSubMenu('osd')}
                    className="w-full px-5 py-3.5 rounded-2xl text-left bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.06] focus:bg-gradient-to-r focus:from-[#e4e4e7] focus:via-[#ffffff] focus:to-[#d4d4d8] focus:text-[#141414] focus:outline-none group transition-all cursor-pointer"
                  >
                    <div className="text-[15px] font-semibold text-white group-focus:text-[#141414]">
                      {tr(
                        'Ascundere Automată Controale Player',
                        'Player Controls Auto-Hide',
                        'Автоскрытие интерфейса'
                      )}
                    </div>
                    <div className="text-[12px] text-zinc-400 group-focus:text-zinc-800 mt-0.5">
                      {SMART_TV_OSD_OPTIONS.find(
                        (o) => o.id === tvSettings.osdAutoHideSec
                      )?.label || 'După 4 secunde'}
                    </div>
                  </button>

                  {/* 7. Toggle Ecran Complet Automat la Play */}
                  <button
                    type="button"
                    onClick={() =>
                      updateTvSetting(
                        'autoFullscreenOnPlay',
                        !tvSettings.autoFullscreenOnPlay
                      )
                    }
                    className="w-full px-5 py-3.5 rounded-2xl flex items-center justify-between text-left bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.06] focus:bg-gradient-to-r focus:from-[#e4e4e7] focus:via-[#ffffff] focus:to-[#d4d4d8] focus:text-[#141414] focus:outline-none group transition-all cursor-pointer"
                  >
                    <div>
                      <div className="text-[15px] font-semibold text-white group-focus:text-[#141414]">
                        {tr(
                          'Fullscreen Automat la Redare',
                          'Auto-Fullscreen on Play',
                          'Полный экран при запуске'
                        )}
                      </div>
                      <div className="text-[12px] text-zinc-400 group-focus:text-zinc-800 mt-0.5">
                        {tvSettings.autoFullscreenOnPlay
                          ? tr(
                            'Activat — intră automat în Fullscreen la Play',
                            'Enabled — enters Fullscreen automatically on Play',
                            'Включено — автопереход в полный экран'
                          )
                          : tr(
                            'Dezactivat — păstrează fereastra curentă',
                            'Disabled — keeps current window size',
                            'Выключено — сохраняет размер окна'
                          )}
                      </div>
                    </div>
                    <span
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${tvSettings.autoFullscreenOnPlay
                          ? 'border-blue-400 bg-blue-400 text-[#141414]'
                          : 'border-zinc-500 group-focus:border-zinc-800'
                        }`}
                    >
                      {tvSettings.autoFullscreenOnPlay && (
                        <span className="text-xs font-black"></span>
                      )}
                    </span>
                  </button>

                  {/* 8. Conținut pentru Adulți (18+) & Mediateca iEdem — VIZIBIL EXCLUSIV PENTRU PROFILUL ADMIN JEKA */}
                  {isAdminJekaProfile(activeProfile) && (
                    <>
                      <div className="w-full p-4 sm:p-5 rounded-2xl bg-white/[0.04] border border-emerald-500/25 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[15px] font-bold text-white flex flex-wrap items-center gap-2">
                              <span>
                                {tr(
                                  'Control Acces Kinozal (Doar JEKA)',
                                  'Kinozal Access Control (JEKA Admin Only)',
                                  'Управление доступом Kinozal (Только JEKA)'
                                )}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                ADMIN JEKA
                              </span>
                            </div>
                            <div className="text-[12px] text-zinc-400 mt-0.5">
                              {tr(
                                'Decizi exclusiv de aici ce profiluri au acces la modulul Kinozal (Filme & Seriale RU) și lista TV iEdem. Implicit este activ doar pentru JEKA.',
                                'Decide exclusively from here which profiles can access Kinozal (RU Movies & Series) & TV. Enabled by default only for JEKA.',
                                'Только вы решаете здесь, у каких профилей есть доступ к Kinozal. По умолчанию включено только для JEKA.'
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 pt-1">
                          {(Array.isArray(tvProfiles) ? tvProfiles : []).map(
                            (prof: SmartTvProfile) => {
                              const isProfKids = Boolean(prof.isKids);
                              const profAllowed = canProfileAccessIedem(prof);
                              const isJeka = isAdminJekaProfile(prof);

                              return (
                                <button
                                  key={`iedem_perm_${prof.id}`}
                                  type="button"
                                  disabled={isProfKids}
                                  onClick={() => {
                                    if (isProfKids) return;
                                    const nextAllowed = !profAllowed;
                                    const nextProfiles = (
                                      Array.isArray(tvProfiles)
                                        ? tvProfiles
                                        : []
                                    ).map((p: SmartTvProfile) =>
                                      p.id === prof.id
                                        ? {
                                            ...p,
                                            allowIedemContent: nextAllowed,
                                            updatedAt: Date.now(),
                                          }
                                        : p
                                    );
                                    setTvProfiles(nextProfiles);
                                    saveTvProfiles(nextProfiles);
                                    if (
                                      prof.id === activeProfile?.id &&
                                      !nextAllowed
                                    ) {
                                      if (section === 'iedem_vod') {
                                        setSection('home');
                                      }
                                      if (tvRegionId === 'IEDEM') {
                                        setTvRegionId('FAV');
                                      }
                                    }
                                  }}
                                  className={`w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 text-left border transition-all focus:outline-none focus:ring-2 focus:ring-white ${
                                    isProfKids
                                      ? 'bg-white/[0.02] border-white/[0.04] opacity-55 cursor-not-allowed'
                                      : profAllowed
                                        ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 cursor-pointer'
                                        : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.07] cursor-pointer'
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    {prof.avatarUrl ? (
                                      <img
                                        src={prof.avatarUrl}
                                        alt={prof.name}
                                        className="w-8 h-8 rounded-lg object-cover shrink-0 border border-white/15"
                                      />
                                    ) : (
                                      <div
                                        className={`w-8 h-8 rounded-lg bg-gradient-to-br ${prof.avatarBg} flex items-center justify-center text-xs font-black text-white shrink-0`}
                                      >
                                        {prof.avatarEmoji ||
                                          prof.name.slice(0, 1)}
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <div className="text-sm font-bold text-white flex items-center gap-1.5 truncate">
                                        <span>{prof.name}</span>
                                        {isJeka && (
                                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-extrabold">
                                            TU (ADMIN)
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-zinc-400 truncate">
                                        {isProfKids
                                          ? tr(
                                              'Profil Copii — Kinozal este blocat permanent',
                                              'Kids Profile — Kinozal permanently blocked',
                                              'Детский профиль — Kinozal заблокирован'
                                            )
                                          : profAllowed
                                            ? tr(
                                                'Kinozal (Filme & Seriale RU) este PERMIS pe acest profil',
                                                'Kinozal (RU Movies & Series) is ALLOWED on this profile',
                                                'Kinozal (Медиатека и ТВ) РАЗРЕШЕН для этого профиля'
                                              )
                                            : tr(
                                                'Kinozal (Filme & Seriale RU) este ASCUNS pe acest profil',
                                                'Kinozal (RU Movies & Series) is HIDDEN on this profile',
                                                'Kinozal (Медиатека и ТВ) СКРЫТ для этого профиля'
                                              )}
                                      </div>
                                    </div>
                                  </div>

                                  <span
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider shrink-0 ${
                                      isProfKids
                                        ? 'bg-zinc-800 text-zinc-500'
                                        : profAllowed
                                          ? 'bg-emerald-600 text-white shadow'
                                          : 'bg-zinc-700 text-zinc-300'
                                    }`}
                                  >
                                    {isProfKids
                                      ? tr('BLOCAT', 'LOCKED', 'БЛОК')
                                      : profAllowed
                                        ? 'Kinozal ON'
                                        : 'OFF'}
                                  </span>
                                </button>
                              );
                            }
                          )}
                        </div>
                      </div>

                      <div className="w-full p-4 sm:p-5 rounded-2xl bg-white/[0.04] border border-rose-500/25 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[15px] font-bold text-white flex flex-wrap items-center gap-2">
                              <span>
                                {tr(
                                  'Control Acces Canale 18+ (Doar JEKA)',
                                  '18+ Channels Access Control (JEKA Admin Only)',
                                  'Управление доступом 18+ (Только JEKA)'
                                )}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                ADMIN JEKA
                              </span>
                            </div>
                            <div className="text-[12px] text-zinc-400 mt-0.5">
                              {tr(
                                'Decizi exclusiv de aici ce profiluri au acces la canalele și filmele pentru adulți (18+). Celelalte profiluri nu văd această setare.',
                                'Decide exclusively from here which profiles can access 18+ adult channels. Other profiles cannot see this setting.',
                                'Только вы решаете здесь, у каких профилей есть доступ к каналам 18+. Другие профили не видят эту настройку.'
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 pt-1">
                          {(Array.isArray(tvProfiles) ? tvProfiles : []).map(
                            (prof: SmartTvProfile) => {
                              const isProfKids = Boolean(prof.isKids);
                              const profAllowed = canProfileAccessAdult(prof);
                              const isJeka = isAdminJekaProfile(prof);

                              return (
                                <button
                                  key={`adult_perm_${prof.id}`}
                                  type="button"
                                  disabled={isProfKids}
                                  onClick={() => {
                                    if (isProfKids) return;
                                    const nextAllowed = !profAllowed;
                                    const nextProfiles = (
                                      Array.isArray(tvProfiles)
                                        ? tvProfiles
                                        : []
                                    ).map((p: SmartTvProfile) =>
                                      p.id === prof.id
                                        ? {
                                            ...p,
                                            allowAdultContent: nextAllowed,
                                            updatedAt: Date.now(),
                                          }
                                        : p
                                    );
                                    setTvProfiles(nextProfiles);
                                    saveTvProfiles(nextProfiles);
                                    if (prof.id === activeProfile?.id) {
                                      setAdultContentEnabled(nextAllowed);
                                      if (!nextAllowed) {
                                        if (tvRegionId === 'ADULT')
                                          setTvRegionId('FAV');
                                        if (tvCategoryId === 'ADULT')
                                          setTvCategoryId('ALL');
                                        if (selectedGenre === 'Adult')
                                          setSelectedGenre('top');
                                      }
                                    }
                                  }}
                                  className={`w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 text-left border transition-all focus:outline-none focus:ring-2 focus:ring-white ${
                                    isProfKids
                                      ? 'bg-white/[0.02] border-white/[0.04] opacity-55 cursor-not-allowed'
                                      : profAllowed
                                        ? 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/40 cursor-pointer'
                                        : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.07] cursor-pointer'
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    {prof.avatarUrl ? (
                                      <img
                                        src={prof.avatarUrl}
                                        alt={prof.name}
                                        className="w-8 h-8 rounded-lg object-cover shrink-0 border border-white/15"
                                      />
                                    ) : (
                                      <div
                                        className={`w-8 h-8 rounded-lg bg-gradient-to-br ${prof.avatarBg} flex items-center justify-center text-xs font-black text-white shrink-0`}
                                      >
                                        {prof.avatarEmoji ||
                                          prof.name.slice(0, 1)}
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <div className="text-sm font-bold text-white flex items-center gap-1.5 truncate">
                                        <span>{prof.name}</span>
                                        {isJeka && (
                                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-extrabold">
                                            TU (ADMIN)
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-zinc-400 truncate">
                                        {isProfKids
                                          ? tr(
                                              'Profil Copii — Canalele 18+ sunt blocate permanent',
                                              'Kids Profile — 18+ channels permanently blocked',
                                              'Детский профиль — каналы 18+ заблокированы'
                                            )
                                          : profAllowed
                                            ? tr(
                                                'Canalele 18+ (Adulți) sunt PERMISE pe acest profil',
                                                '18+ Adult channels are ALLOWED on this profile',
                                                'Каналы 18+ РАЗРЕШЕНЫ для этого профиля'
                                              )
                                            : tr(
                                                'Canalele 18+ (Adulți) sunt ASCUNSE pe acest profil',
                                                '18+ Adult channels are HIDDEN on this profile',
                                                'Каналы 18+ СКРЫТЫ для этого профиля'
                                              )}
                                      </div>
                                    </div>
                                  </div>

                                  <span
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider shrink-0 ${
                                      isProfKids
                                        ? 'bg-zinc-800 text-zinc-500'
                                        : profAllowed
                                          ? 'bg-rose-500 text-white shadow'
                                          : 'bg-zinc-700 text-zinc-300'
                                    }`}
                                  >
                                    {isProfKids
                                      ? tr('BLOCAT', 'LOCKED', 'БЛОК')
                                      : profAllowed
                                        ? '18+ ON'
                                        : 'OFF'}
                                  </span>
                                </button>
                              );
                            }
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* 9. Șterge Istoricul de Vizionare */}
                  <button
                    type="button"
                    onClick={handleClearAllWatchProgress}
                    className="w-full px-5 py-3.5 rounded-2xl text-left bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] focus:bg-gradient-to-r focus:from-[#e4e4e7] focus:via-[#ffffff] focus:to-[#d4d4d8] focus:text-[#141414] focus:outline-none group transition-all cursor-pointer"
                  >
                    <div className="text-[14px] font-medium text-zinc-300 group-focus:text-[#141414]">
                      {tr(
                        `Șterge Istoricul pentru ${activeProfile.name} (${historyList.length})`,
                        `Clear Watch History for ${activeProfile.name} (${historyList.length})`,
                        `Очистить историю (${activeProfile.name}: ${historyList.length})`
                      )}
                    </div>
                  </button>

                  {/* 10. Resetează Setările Smart TV la valorile din fabrică */}
                  <button
                    type="button"
                    onClick={() => {
                      setTvSettings(DEFAULT_SMART_TV_SETTINGS);
                      saveSmartTvSettings(
                        DEFAULT_SMART_TV_SETTINGS,
                        activeProfileId
                      );
                      setPreferredSubLang('ro');
                    }}
                    className="w-full px-5 py-3.5 rounded-2xl text-left bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] focus:bg-gradient-to-r focus:from-[#e4e4e7] focus:via-[#ffffff] focus:to-[#d4d4d8] focus:text-[#141414] focus:outline-none group transition-all cursor-pointer"
                  >
                    <div className="text-[14px] font-medium text-zinc-300 group-focus:text-[#141414]">
                      {tr(
                        'Resetează la Setările Implicite',
                        'Reset to Default Settings',
                        'Сбросить настройки'
                      )}
                    </div>
                  </button>
                </div>
              </>
            ) : (
              /* SUB-MENUS FOR SMART TV SETTINGS */
              <>
                <div className="px-7 py-6 flex items-center justify-between border-b border-white/[0.06]">
                  <button
                    type="button"
                    data-drawer-close="true"
                    onClick={() => setSettingsSubMenu(null)}
                    className="inline-flex items-center gap-2 text-left text-white hover:text-zinc-300 cursor-pointer"
                  >
                    <ChevronLeft className="w-6 h-6" />
                    <span className="text-[22px] font-normal tracking-tight">
                      {settingsSubMenu === 'audio'
                        ? 'Limbă Audio Implicită'
                        : settingsSubMenu === 'subtitles'
                          ? 'Subtitrare Automată'
                          : settingsSubMenu === 'subSize'
                            ? 'Mărime Font Subtitrare'
                            : settingsSubMenu === 'quality'
                              ? 'Calitate Video Implicită'
                              : settingsSubMenu === 'server'
                                ? 'Sursă Video Implicită'
                                : 'Ascundere Controale'}
                    </span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
                  {settingsSubMenu === 'audio' &&
                    SMART_TV_AUDIO_OPTIONS.map((opt) => {
                      const checked = tvSettings.defaultAudioPref === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-drawer-item="true"
                          onClick={() => {
                            updateTvSetting('defaultAudioPref', opt.id);
                            if (resolvedDirectStream?.audioNames?.length) {
                              const nextIdx = resolveAudioTrackIndexByPreference(
                                resolvedDirectStream.audioNames,
                                opt.id
                              );
                              setSelectedAudioTrackIdx(nextIdx);
                            }
                            setSettingsSubMenu(null);
                          }}
                          className={`w-full px-7 py-4 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                            checked
                              ? 'bg-[#2e2e2e]'
                              : 'hover:bg-[#2e2e2e] focus:bg-[#2e2e2e]'
                          }`}
                        >
                          <div>
                            <div className="text-[15px] text-white font-medium">
                              {opt.label}
                            </div>
                            <div className="text-[12px] text-zinc-400 mt-0.5">
                              {opt.desc}
                            </div>
                          </div>
                          <span
                            className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0 ${
                              checked
                                ? 'border-white bg-white text-[#212121]'
                                : 'border-zinc-500'
                            }`}
                          >
                            {checked && (
                              <span className="text-xs font-black"></span>
                            )}
                          </span>
                        </button>
                      );
                    })}

                  {settingsSubMenu === 'subtitles' &&
                    SMART_TV_SUB_LANG_OPTIONS.map((opt) => {
                      const checked = tvSettings.defaultSubLang === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-drawer-item="true"
                          onClick={() => {
                            updateTvSetting('defaultSubLang', opt.id);
                            if (opt.id === 'off') {
                              setActiveSubVttUrl(null);
                              setActiveSubLabel('');
                              setActiveSubCues([]);
                            } else {
                              setPreferredSubLang(opt.id);
                              if (activeVodItem) {
                                void handleQuickSubLangSwitch(opt.id);
                              }
                            }
                            setSettingsSubMenu(null);
                          }}
                          className={`w-full px-7 py-4 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                            checked
                              ? 'bg-[#2e2e2e]'
                              : 'hover:bg-[#2e2e2e] focus:bg-[#2e2e2e]'
                          }`}
                        >
                          <div>
                            <div className="text-[15px] text-white font-medium">
                              {opt.label}
                            </div>
                            <div className="text-[12px] text-zinc-400 mt-0.5">
                              {opt.desc}
                            </div>
                          </div>
                          <span
                            className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0 ${
                              checked
                                ? 'border-white bg-white text-[#212121]'
                                : 'border-zinc-500'
                            }`}
                          >
                            {checked && (
                              <span className="text-xs font-black"></span>
                            )}
                          </span>
                        </button>
                      );
                    })}

                  {settingsSubMenu === 'subSize' &&
                    SMART_TV_SUB_SIZE_OPTIONS.map((opt) => {
                      const checked = tvSettings.defaultSubFontSize === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-drawer-item="true"
                          onClick={() => {
                            updateTvSetting('defaultSubFontSize', opt.id);
                            setSettingsSubMenu(null);
                          }}
                          className={`w-full px-7 py-4 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                            checked
                              ? 'bg-[#2e2e2e]'
                              : 'hover:bg-[#2e2e2e] focus:bg-[#2e2e2e]'
                          }`}
                        >
                          <span className="text-[16px] text-white font-normal">
                            {opt.label}
                          </span>
                          <span
                            className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0 ${
                              checked
                                ? 'border-white bg-white text-[#212121]'
                                : 'border-zinc-500'
                            }`}
                          >
                            {checked && (
                              <span className="text-xs font-black"></span>
                            )}
                          </span>
                        </button>
                      );
                    })}

                  {settingsSubMenu === 'quality' &&
                    SMART_TV_QUALITY_OPTIONS.map((opt) => {
                      const checked = tvSettings.defaultVideoQuality === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-drawer-item="true"
                          onClick={() => {
                            updateTvSetting('defaultVideoQuality', opt.id);
                            setSettingsSubMenu(null);
                          }}
                          className={`w-full px-7 py-4 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                            checked
                              ? 'bg-[#2e2e2e]'
                              : 'hover:bg-[#2e2e2e] focus:bg-[#2e2e2e]'
                          }`}
                        >
                          <div>
                            <div className="text-[15px] text-white font-medium">
                              {opt.label}
                            </div>
                            <div className="text-[12px] text-zinc-400 mt-0.5">
                              {opt.desc}
                            </div>
                          </div>
                          <span
                            className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0 ${
                              checked
                                ? 'border-white bg-white text-[#212121]'
                                : 'border-zinc-500'
                            }`}
                          >
                            {checked && (
                              <span className="text-xs font-black"></span>
                            )}
                          </span>
                        </button>
                      );
                    })}

                  {settingsSubMenu === 'server' &&
                    SMART_TV_SERVER_OPTIONS.map((opt) => {
                      const checked = tvSettings.defaultVodServer === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-drawer-item="true"
                          onClick={() => {
                            updateTvSetting('defaultVodServer', opt.id);
                            if (opt.id !== 'auto_best') {
                              setActiveServer(opt.id);
                            } else if (
                              resolvedDirectStream?.ok &&
                              (resolvedDirectStream.dashUrl ||
                                resolvedDirectStream.hlsUrl)
                            ) {
                              setActiveServer('kinogram_hls');
                            } else if (activeVodItem) {
                              setActiveServer('vidspark');
                            }
                            setSettingsSubMenu(null);
                          }}
                          className={`w-full px-7 py-4 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                            checked
                              ? 'bg-[#2e2e2e]'
                              : 'hover:bg-[#2e2e2e] focus:bg-[#2e2e2e]'
                          }`}
                        >
                          <div>
                            <div className="text-[15px] text-white font-medium">
                              {opt.label}
                            </div>
                            <div className="text-[12px] text-zinc-400 mt-0.5">
                              {opt.desc}
                            </div>
                          </div>
                          <span
                            className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0 ${
                              checked
                                ? 'border-white bg-white text-[#212121]'
                                : 'border-zinc-500'
                            }`}
                          >
                            {checked && (
                              <span className="text-xs font-black"></span>
                            )}
                          </span>
                        </button>
                      );
                    })}

                  {settingsSubMenu === 'osd' &&
                    SMART_TV_OSD_OPTIONS.map((opt) => {
                      const checked = tvSettings.osdAutoHideSec === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-drawer-item="true"
                          onClick={() => {
                            updateTvSetting('osdAutoHideSec', opt.id);
                            setSettingsSubMenu(null);
                          }}
                          className={`w-full px-7 py-4 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                            checked
                              ? 'bg-[#2e2e2e]'
                              : 'hover:bg-[#2e2e2e] focus:bg-[#2e2e2e]'
                          }`}
                        >
                          <span className="text-[16px] text-white font-normal">
                            {opt.label}
                          </span>
                          <span
                            className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0 ${
                              checked
                                ? 'border-white bg-white text-[#212121]'
                                : 'border-zinc-500'
                            }`}
                          >
                            {checked && (
                              <span className="text-xs font-black"></span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* DEDICATED FULLSCREEN SMART TV RADIO PLAYER MODAL ("Плеер Радио — Cu Poză & Info Piesă") */}
      {isTvRadioPlayerOpen && currentStation && (
        <div
          style={{
            paddingTop: 'max(1.25rem, calc(var(--safe-top, env(safe-area-inset-top, 0px)) + 0.5rem))',
            paddingBottom: 'max(1.25rem, calc(var(--safe-bottom, env(safe-area-inset-bottom, 0px)) + 0.5rem))',
            paddingLeft: 'max(1.25rem, var(--safe-left, env(safe-area-inset-left, 0px)))',
            paddingRight: 'max(1.25rem, var(--safe-right, env(safe-area-inset-right, 0px)))',
          }}
          className="fixed inset-0 z-[125] bg-[#101010]/95 backdrop-blur-2xl flex flex-col justify-between p-5 sm:p-10 overflow-y-auto"
          onClick={() => setIsTvRadioPlayerOpen(false)}
        >
          {/* Ambient Blurred Cover Art Background */}
          {activeRadioTrack?.coverUrl && (
            <img
              src={activeRadioTrack.coverUrl}
              alt=""
              aria-hidden="true"
              className="fixed inset-0 w-full h-full object-cover opacity-25 blur-3xl scale-110 pointer-events-none select-none"
            />
          )}

          {/* Top Bar */}
          <div
            className="relative z-10 flex items-center justify-between gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              autoFocus
              onClick={() => setIsTvRadioPlayerOpen(false)}
              className="h-11 px-5 rounded-full bg-white text-[#141414] hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-white/50 font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 shadow-xl cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{tr('Înapoi la Radio', 'Back to Radio', 'Назад к радио')}</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-zinc-200 text-xs font-extrabold uppercase tracking-wider inline-flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    playerStatus === 'playing'
                      ? 'bg-blue-400 animate-ping'
                      : 'bg-amber-400'
                  }`}
                />
                {playerStatus === 'playing'
                  ? tr('RADIO ÎN DIRECT • LIVE', 'LIVE RADIO ON AIR', 'РАДИО В ЭФИРЕ')
                  : playerStatus === 'loading'
                    ? tr('SE CONECTEAZĂ...', 'CONNECTING...', 'ПОДКЛЮЧЕНИЕ...')
                    : tr('PAUZĂ', 'PAUSED', 'ПАУЗА')}
              </span>
            </div>
          </div>

          {/* Center Hero: Dual Giant Artwork (Station Logo + Song/Artist Cover at Equal Size) + Track Metadata + Controls */}
          <div
            className="relative z-10 my-auto py-6 max-w-6xl w-full mx-auto flex flex-col lg:flex-row items-center gap-8 sm:gap-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left: Side-by-Side Equal-Size Giant Station Logo & Giant Song/Artist Cover */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-5 shrink-0">
              {/* 1. Giant Station Logo Box */}
              <div className="relative shrink-0">
                <StationAvatar
                  name={currentStation.name}
                  favicon={currentStation.favicon}
                  homepage={currentStation.homepage}
                  size="xl"
                  isPlaying={false}
                  className="!w-44 !h-44 sm:!w-56 sm:!h-56 !rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] border-2 border-white/20"
                />
                <span className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-[10px] font-black uppercase tracking-wider text-zinc-200">
                  {tr('Post Radio', 'Radio Station', 'Радиостанция')}
                </span>
              </div>

              {/* 2. Giant Song / Artist Cover Box (Same exact size as Station Logo) */}
              {(activeRadioTrack?.coverUrl ||
                activeRadioTrack?.artistAvatarUrl) && (
                <button
                  type="button"
                  onClick={() => {
                    if (!activeRadioTrack) return;
                    const q = activeRadioTrack.artist
                      ? `${activeRadioTrack.artist} ${activeRadioTrack.title}`
                      : activeRadioTrack.title;
                    window.dispatchEvent(
                      new CustomEvent('smartcinema:open-music-query', {
                        detail: {
                          query: q,
                          label: activeRadioTrack.artist
                            ? `${activeRadioTrack.title} — ${activeRadioTrack.artist}`
                            : activeRadioTrack.title,
                        },
                      })
                    );
                  }}
                  title={tr(
                    'Deschide piesa / artistul în Muzică (TIDAL MAX)',
                    'Open song / artist in Music (TIDAL MAX)',
                    'Открыть трек / артиста в Музыке (TIDAL MAX)'
                  )}
                  className="relative w-44 h-44 sm:w-56 sm:h-56 rounded-3xl overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.85)] border-2 border-amber-400/40 shrink-0 group cursor-pointer focus:outline-none focus:ring-4 focus:ring-amber-400"
                >
                  <img
                    src={
                      activeRadioTrack.coverUrl ||
                      activeRadioTrack.artistAvatarUrl
                    }
                    alt={activeRadioTrack.title || activeRadioTrack.artist}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {/* If both coverUrl and a distinct artistAvatarUrl exist, show Artist Photo badge in top-right */}
                  {activeRadioTrack.artistAvatarUrl &&
                    activeRadioTrack.coverUrl &&
                    activeRadioTrack.artistAvatarUrl !==
                      activeRadioTrack.coverUrl && (
                      <img
                        src={activeRadioTrack.artistAvatarUrl}
                        alt={activeRadioTrack.artist || ''}
                        className="absolute top-2.5 right-2.5 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-amber-400 shadow-xl"
                      />
                    )}
                  <span className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/80 backdrop-blur-md border border-amber-400/40 text-[10px] font-black uppercase tracking-wider text-amber-300">
                    {tr('Piesa / Artist', 'Song / Artist', 'Трек / Артист')}
                  </span>
                </button>
              )}
            </div>

            {/* Right: Station & Live Song Info + Full Player Controls */}
            <div className="flex-1 min-w-0 text-center lg:text-left space-y-5 w-full">
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                <span className="px-3 py-1 rounded-full bg-white/10 text-zinc-200 text-xs font-bold inline-flex items-center gap-1.5">
                  <span>{getCountryFlagEmoji(currentStation.countrycode)}</span>
                  <span>
                    {currentStation.country || currentStation.countrycode}
                  </span>
                </span>
                {currentStation.bitrate ? (
                  <span className="px-3 py-1 rounded-full bg-white/20 border border-amber-500/40 text-zinc-200 text-xs font-bold">
                    {currentStation.bitrate} kbps{' '}
                    {currentStation.codec
                      ? `• ${currentStation.codec.toUpperCase()}`
                      : ''}
                  </span>
                ) : null}
              </div>

              <div>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                  {currentStation.name}
                </h2>
                {currentStation.tags && (
                  <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                    {currentStation.tags
                      .split(',')
                      .slice(0, 5)
                      .map((t: string) => t.trim())
                      .filter(Boolean)
                      .join(' • ')}
                  </p>
                )}
              </div>

              {/* Song Info Box (Large Artist Avatar + Title & Artist) */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white/[0.07] border border-white/15 flex items-center gap-4 text-left shadow-xl">
                {activeRadioTrack?.artistAvatarUrl ||
                activeRadioTrack?.coverUrl ? (
                  <img
                    src={
                      activeRadioTrack.artistAvatarUrl ||
                      activeRadioTrack.coverUrl
                    }
                    alt={activeRadioTrack.artist || activeRadioTrack.title}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shrink-0 border-2 border-amber-400/50 shadow-lg"
                  />
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/10 border border-blue-500/30 flex items-center justify-center text-zinc-200 shrink-0">
                    <Music className="w-9 h-9" />
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-white/10 text-zinc-200 text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1.5">
                        {playerStatus === 'playing' ? (
                          <span className="inline-flex items-end gap-0.5 h-3">
                            <span className="w-0.5 h-full bg-amber-400 eq-bar rounded-full" />
                            <span className="w-0.5 h-2 bg-amber-400 eq-bar eq-bar-2 rounded-full" />
                            <span className="w-0.5 h-3 bg-amber-400 eq-bar eq-bar-3 rounded-full" />
                          </span>
                        ) : (
                          <span></span>
                        )}
                        <span>{tr('Acum pe post', 'Now Playing', 'Сейчас играет')}</span>
                      </span>
                      {activeRadioTrack?.album && (
                        <span className="text-xs text-zinc-300 truncate inline-flex items-center gap-1">
                          <Disc className="w-3.5 h-3.5 shrink-0" />
                          {activeRadioTrack.album}
                        </span>
                      )}
                    </div>

                    {/* 20-Bar Animated Audio Equalizer Spectrum */}
                    <div
                      className="flex items-end gap-[3px] h-7 px-3 py-1 rounded-full bg-black/50 border border-white/15 shrink-0"
                      aria-hidden="true"
                    >
                      {Array.from({ length: 20 }).map((_, i) => (
                        <span
                          key={`radio_modal_eq_${i}`}
                          style={{
                            height:
                              playerStatus === 'playing'
                                ? `${Math.max(25, ((i * 37) % 85) + 15)}%`
                                : '22%',
                            animationDelay: `${(i % 7) * 0.11}s`,
                            animationDuration: `${0.52 + (i % 5) * 0.13}s`,
                          }}
                          className={`w-1 rounded-full transition-all ${
                            playerStatus === 'playing'
                              ? 'bg-gradient-to-t from-amber-500 via-amber-400 to-yellow-200 eq-bar'
                              : 'bg-zinc-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {activeRadioTrack ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const q = activeRadioTrack.artist
                            ? `${activeRadioTrack.artist} ${activeRadioTrack.title}`
                            : activeRadioTrack.title;
                          window.dispatchEvent(
                            new CustomEvent('smartcinema:open-music-query', {
                              detail: {
                                query: q,
                                label: activeRadioTrack.artist
                                  ? `${activeRadioTrack.title} — ${activeRadioTrack.artist}`
                                  : activeRadioTrack.title,
                              },
                            })
                          );
                        }}
                        title={tr(
                          `Deschide piesa „${activeRadioTrack.title}” în Muzică`,
                          `Open song "${activeRadioTrack.title}" in Music`,
                          `Открыть трек «${activeRadioTrack.title}» в Музыке`
                        )}
                        className="text-lg sm:text-2xl font-extrabold text-white hover:text-amber-300 hover:underline truncate text-left block w-full cursor-pointer transition-colors"
                      >
                        {activeRadioTrack.title}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const artistQ =
                            activeRadioTrack.artist || activeRadioTrack.title;
                          window.dispatchEvent(
                            new CustomEvent('smartcinema:open-music-query', {
                              detail: {
                                query: artistQ,
                                label: artistQ,
                              },
                            })
                          );
                        }}
                        title={tr(
                          `Vezi toate piesele artistului „${activeRadioTrack.artist || currentStation.name}” în Muzică`,
                          `View all songs by "${activeRadioTrack.artist || currentStation.name}" in Music`,
                          `Все треки «${activeRadioTrack.artist || currentStation.name}» в Музыке`
                        )}
                        className="text-base sm:text-lg font-bold text-amber-300 hover:underline truncate inline-flex items-center gap-2 cursor-pointer"
                      >
                        <span></span>
                        <span className="truncate">
                          {activeRadioTrack.artist || currentStation.name}
                        </span>
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="text-base sm:text-xl font-bold text-white truncate">
                        {nowPlayingTitle ||
                          `Transmisiune Live — ${currentStation.name}`}
                      </div>
                      <div className="text-xs sm:text-sm text-zinc-400 truncate">
                        {currentStation.tags || 'Flux audio în direct'}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Transport & Volume Controls */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-1">
                <button
                  type="button"
                  onClick={playPreviousStation}
                  className="h-12 px-5 rounded-full bg-[#262626] hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] focus:outline-none text-white font-bold text-xs sm:text-sm inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <SkipBack className="w-5 h-5 fill-current" />
                  <span>Anterior</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (playerStatus === 'playing') {
                      stopRadio();
                    } else {
                      playStation(currentStation, radioStations);
                    }
                  }}
                  className="h-14 px-8 rounded-full bg-gradient-to-r from-[#d4d4d4] via-[#ffffff] to-[#c8c8c8] text-[#141414] hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-white/60 font-extrabold text-base inline-flex items-center gap-3 shadow-2xl cursor-pointer"
                >
                  {playerStatus === 'loading' ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : playerStatus === 'playing' ? (
                    <Pause className="w-6 h-6 fill-current" />
                  ) : (
                    <Play className="w-6 h-6 fill-current" />
                  )}
                  <span>
                    {playerStatus === 'playing' ? 'Pauză / Stop' : 'Play Live'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={playNextAvailableStation}
                  className="h-12 px-5 rounded-full bg-[#262626] hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] focus:outline-none text-white font-bold text-xs sm:text-sm inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Următorul</span>
                  <SkipForward className="w-5 h-5 fill-current" />
                </button>

                <button
                  type="button"
                  onClick={() => triggerStreamReload()}
                  title="Reîncarcă fluxul audio"
                  className="w-12 h-12 rounded-full bg-[#262626] hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] focus:outline-none text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => toggleFavorite(currentStation)}
                  className={`h-12 px-5 rounded-full font-bold text-xs sm:text-sm inline-flex items-center gap-2 transition-colors focus:outline-none focus:ring-4 focus:ring-white cursor-pointer ${
                    favorites.some(
                      (f: Station) => f.stationuuid === currentStation.stationuuid
                    )
                      ? 'bg-rose-500 text-white'
                      : 'bg-[#262626] text-zinc-200 hover:bg-white hover:text-[#141414]'
                  }`}
                >
                  <Heart
                    className={`w-5 h-5 ${
                      favorites.some(
                        (f: Station) => f.stationuuid === currentStation.stationuuid
                      )
                        ? 'fill-current'
                        : ''
                    }`}
                  />
                  <span>Favorite</span>
                </button>

                <button
                  type="button"
                  onClick={() => void toggleRadioPip()}
                  title={tr(
                    'MiniPlayer Picture-in-Picture (fereastră flotantă în afara paginii)',
                    'Picture-in-Picture MiniPlayer (floating window outside page)',
                    'Мини-плеер Картинка-в-картинке'
                  )}
                  className="h-12 px-5 rounded-full bg-[#262626] hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] focus:outline-none text-zinc-200 font-bold text-xs sm:text-sm inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <PictureInPicture2 className="w-5 h-5" />
                  <span>PiP Flotant</span>
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Quick Station Switcher Strip */}
          <div
            className="relative z-10 pt-4 border-t border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5">
              Schimbă rapid postul radio ({ (radioStations.length > 0 ? radioStations : favorites).length })
            </div>
            <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
              {(radioStations.length > 0 ? radioStations : favorites)
                .slice(0, 20)
                .map((st: Station) => {
                  const active = currentStation.stationuuid === st.stationuuid;
                  return (
                    <button
                      key={`modal_st_${st.stationuuid}`}
                      type="button"
                      onClick={() =>
                        playStation(
                          st,
                          radioStations.length > 0 ? radioStations : favorites
                        )
                      }
                      className={`px-3.5 py-2 rounded-2xl border flex items-center gap-2.5 shrink-0 transition-all focus:outline-none focus:ring-4 focus:ring-white cursor-pointer ${
                        active
                          ? 'bg-white text-[#141414] border-white font-extrabold shadow-lg'
                          : 'bg-[#1f1f1f]/90 hover:bg-[#2a2a2a] text-zinc-200 border-white/10'
                      }`}
                    >
                      <StationAvatar
                        name={st.name}
                        favicon={st.favicon}
                        homepage={st.homepage}
                        size="sm"
                        isPlaying={active && playerStatus === 'playing'}
                      />
                      <span className="text-xs font-bold max-w-[130px] truncate">
                        {st.name}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Live HLS TV Video Player Modal (when a TV channel is clicked outside the dedicated TV Online section) */}
      {section !== 'tv' && <TvPlayerModal isSmartTvFullMode />}

{/* LAMPA FULLSCREEN TRAILER PLAYER MODAL */}
      {isTrailerModalOpen && activeVodItem && (
        <div
          className="fixed inset-0 z-[130] bg-black/95 backdrop-blur-xl flex flex-col"
          onClick={() => setIsTrailerModalOpen(false)}
        >
          {/* Top Header Bar with Back/Close & Trailer Switcher */}
          <div
            style={{
              paddingTop: 'max(1rem, calc(var(--safe-top, env(safe-area-inset-top, 0px)) + 0.5rem))',
              paddingLeft: 'max(1.25rem, var(--safe-left, env(safe-area-inset-left, 0px)))',
              paddingRight: 'max(1.25rem, var(--safe-right, env(safe-area-inset-right, 0px)))',
            }}
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-gradient-to-b from-black via-black/85 to-transparent z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                autoFocus
                onClick={() => setIsTrailerModalOpen(false)}
                className="h-10 px-5 rounded-full bg-white text-[#141414] hover:brightness-95 font-bold text-xs sm:text-sm inline-flex items-center gap-2 shadow-lg shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{tr('Înapoi / Închide Trailer', 'Back / Close Trailer', 'Назад / Закрыть трейлер')}</span>
              </button>
              <div className="min-w-0">
                <div className="text-sm sm:text-lg font-bold text-white truncate">
                  {activeVodItem.name} — {tr('Trailer Oficial', 'Official Trailer', 'Официальный трейлер')}
                </div>
                {trailerList[activeTrailerIdx]?.title && (
                  <div className="text-xs text-zinc-400 truncate">
                    {trailerList[activeTrailerIdx].title}
                  </div>
                )}
              </div>
            </div>

            {trailerList.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                {trailerList.map((trailerItem: TrailerItem, idx: number) => (
                  <button
                    key={trailerItem.id + idx}
                    type="button"
                    onClick={() => setActiveTrailerIdx(idx)}
                    className={`h-9 px-3.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      activeTrailerIdx === idx
                        ? 'bg-white text-[#141414] font-bold shadow'
                        : 'bg-white/10 hover:bg-white/20 text-zinc-200'
                    }`}
                  >
                    {trailerItem.title || tr(`Trailer #${idx + 1}`, `Trailer #${idx + 1}`, `Трейлер #${idx + 1}`)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Center Trailer Video Player */}
          <div
            className="flex-1 w-full h-full flex items-center justify-center p-3 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {isLoadingTrailer ? (
              <div className="flex flex-col items-center gap-3 text-zinc-300">
                <Loader2 className="w-10 h-10 text-white animate-spin" />
                <span className="text-sm font-semibold">
                  {tr('Se încarcă trailerul...', 'Loading trailer...', 'Загрузка трейлера...')}
                </span>
              </div>
            ) : trailerList[activeTrailerIdx] ? (
              <div className="w-full max-w-6xl aspect-video rounded-2xl overflow-hidden bg-black border border-white/15 shadow-2xl">
                <iframe
                  key={trailerList[activeTrailerIdx].embedUrl}
                  src={trailerList[activeTrailerIdx].embedUrl}
                  title={trailerList[activeTrailerIdx].title}
                  className="w-full h-full border-0"
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Cross-Device Handoff Modal */}
      {(isHandoffModalOpen || isPinLockRequired) && (
        <CrossDeviceHandoffModal
          isOpen={Boolean(isHandoffModalOpen || isPinLockRequired)}
          isPinLockRequired={Boolean(isPinLockRequired)}
          onClose={() => {
            if (!isPinLockRequired) {
              setIsHandoffModalOpen(false);
            }
          }}
          profiles={tvProfiles}
          activeProfileId={activeProfileId}
          onSelectProfile={handleSelectProfile}
          onProfilesChange={(nextProfiles) => {
            setTvProfiles(nextProfiles);
          }}
          activeMedia={
            activeVodItem
              ? {
                  id: activeVodItem.id,
                  name: activeVodItem.name,
                  type: activeVodItem.type,
                  poster: activeVodItem.poster,
                  season: selectedSeason,
                  episode: selectedEpisode,
                  currentTime: resumeStartSeconds,
                }
              : null
          }
          uiLang={uiLang}
        />
      )}

      {/* Actor Filmography Modal */}
      {selectedActor && (
        <ActorProfileModal
          actor={selectedActor}
          uiLang={uiLang}
          onClose={() => setSelectedActor(null)}
          onSelectVodItem={(filmItem) => {
            setSelectedActor(null);
            handleOpenVod({
              id: filmItem.id,
              type: filmItem.type,
              name: filmItem.name,
              poster: filmItem.poster,
              releaseInfo: filmItem.releaseInfo,
              imdbRating: filmItem.imdbRating,
            });
          }}
        />
      )}

      {/* Online Subtitle Finder Modal */}
      <OnlineSubtitleFinderModal
        isOpen={isSubFinderOpen}
        onClose={() => setIsSubFinderOpen(false)}
        initialImdbId={
          activeVodItem?.id.startsWith('tt')
            ? activeVodItem.id
            : detailedMeta?.imdbId || ''
        }
        initialTitle={activeVodItem?.name || ''}
        initialType={activeVodItem?.type || 'movie'}
        initialSeason={selectedSeason}
        initialEpisode={selectedEpisode}
        initialLangFilter={preferredSubLang}
        onApplySubtitle={({ vttBlobUrl, label, cues }) => {
          setActiveSubVttUrl(vttBlobUrl);
          setActiveSubLabel(label);
          setActiveSubCues(cues);
        }}
      />

    </>
  );
};
