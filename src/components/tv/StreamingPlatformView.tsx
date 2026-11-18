import React, { useMemo } from 'react';
import {
  Play,
  Info,
  Heart,
  Star,
  ChevronRight,
  Flame,
  Sparkles,
  Check,
  Plus,
} from 'lucide-react';
import {
  CinemetaItem,
  StreamingPlatformId,
  STREAMING_PLATFORMS,
  getVodCardRatingInfo,
  formatSeriesCardBadgeText,
  formatSeriesCardSubtitleText,
  findWatchProgressEntry,
} from '../../views/smartTvLampaHelpers';
import { StreamingPlatformLogo } from '../common/StreamingPlatformLogo';
import { VodCardProducerBadge } from '../common/VodCardProducerBadge';
import { VodPosterWatchedControl } from '../common/VodPosterWatchedControl';

interface StreamingPlatformViewProps {
  section: StreamingPlatformId | string;
  vodItems: CinemetaItem[];
  isVodLoading: boolean;
  savedVodItems: CinemetaItem[];
  watchProgressMap: Record<string, any>;
  seriesEpStatsMap?: Record<string, any>;
  uhdSeriesEpStats?: Record<string, any>;
  platformMediaTab: 'series' | 'movie' | 'all';
  setPlatformMediaTab: (tab: 'series' | 'movie' | 'all') => void;
  setSection: (section: string) => void;
  handleFocusVodItem: (item: CinemetaItem) => void;
  handleOpenVod: (item: CinemetaItem, autoplay?: boolean, s?: number, ep?: number) => void;
  handleCardPlayKey: (e: React.KeyboardEvent, item: CinemetaItem, s?: number, ep?: number) => void;
  toggleSaveVodItem?: (item: CinemetaItem) => void;
  handleToggleWatchedStatus?: (
    item: CinemetaItem,
    season?: number,
    episode?: number,
    options?: { wholeSeries?: boolean }
  ) => void;
  tr: (ro: string, en: string, ru: string) => string;
}

export const StreamingPlatformView: React.FC<StreamingPlatformViewProps> = React.memo(({
  section,
  vodItems,
  isVodLoading,
  savedVodItems,
  watchProgressMap,
  seriesEpStatsMap = {},
  uhdSeriesEpStats = {},
  platformMediaTab,
  setPlatformMediaTab,
  setSection,
  handleFocusVodItem,
  handleOpenVod,
  handleCardPlayKey,
  toggleSaveVodItem,
  handleToggleWatchedStatus,
  tr,
}) => {
  const currentPlat = useMemo(() => {
    return (
      STREAMING_PLATFORMS.find((p) => p.id === section) ||
      STREAMING_PLATFORMS[0]
    );
  }, [section]);

  // Select the featured hero item (prefer top flagship or first high-rated item with backdrop)
  const heroItem = useMemo(() => {
    if (!vodItems || vodItems.length === 0) return null;
    const withBackdrop = vodItems.filter((x) => x.background && x.background.length > 10);
    return withBackdrop[0] || vodItems[0] || null;
  }, [vodItems]);

  const isHeroFav = useMemo(() => {
    if (!heroItem) return false;
    return savedVodItems.some((x) => x.id === heroItem.id);
  }, [heroItem, savedVodItems]);

  // Split catalog into curated shelves
  const { top10Items, originalHits, moreCatalog, moviesList } = useMemo(() => {
    const list = vodItems || [];
    const top10 = list.slice(0, 10);
    const flagships = list.slice(0, 14);
    const movies = list.filter((x) => x.type === 'movie');
    const remaining = list.slice(10);
    return {
      top10Items: top10,
      originalHits: flagships,
      moreCatalog: remaining,
      moviesList: movies,
    };
  }, [vodItems]);

  // Platform specific visual theme tokens
  const theme = useMemo(() => {
    switch (section) {
      case 'netflix':
        return {
          id: 'netflix',
          containerBg: 'bg-[#141414]',
          headerGlow: 'from-[#E50914]/25 via-[#141414] to-[#141414]',
          brandBadge: 'N SERIES',
          brandBadgeColor: 'text-[#E50914]',
          accentColor: '#E50914',
          playBtnClass: 'bg-white hover:bg-zinc-200 text-black font-extrabold',
          detailBtnClass: 'bg-white/25 hover:bg-white/35 text-white backdrop-blur-md border border-white/20',
          cardFocusRing: 'group-focus:ring-2 group-focus:ring-[#E50914] group-focus:border-[#E50914] group-hover:border-[#E50914]/80 shadow-[0_4px_24px_rgba(229,9,20,0.25)]',
          top10Title: tr('Top 10 azi pe Netflix', 'Top 10 on Netflix Today', 'Топ 10 на Netflix сегодня'),
          shelf1Title: tr('Numai pe Netflix • Seriale & Filme Originale', 'Only on Netflix • Originals', 'Только на Netflix • Оригиналы'),
          shelf2Title: tr('Cele mai vizionate pe Netflix', 'Trending on Netflix', 'Популярно на Netflix'),
          showTop10Ranks: true,
          disneyHubs: false,
        };
      case 'apple':
        return {
          id: 'apple',
          containerBg: 'bg-[#000000]',
          headerGlow: 'from-white/10 via-[#0a0a0a] to-[#000000]',
          brandBadge: 'tv+ ORIGINAL',
          brandBadgeColor: 'text-zinc-100',
          accentColor: '#FFFFFF',
          playBtnClass: 'bg-white hover:bg-zinc-200 text-black font-bold rounded-full',
          detailBtnClass: 'bg-white/15 hover:bg-white/25 text-white backdrop-blur-xl border border-white/20 rounded-full',
          cardFocusRing: 'group-focus:ring-2 group-focus:ring-white group-focus:border-white group-hover:border-white/70 shadow-[0_0_28px_rgba(255,255,255,0.22)]',
          top10Title: tr('Originale Apple • Drame & Thrillere Vizionare', 'Apple Originals • Gripping Dramas & Thrillers', 'Оригиналы Apple • Драмы и триллеры'),
          shelf1Title: tr('Seriale Premiate Apple TV+', 'Award-Winning Apple TV+ Series', 'Награжденные сериалы Apple TV+'),
          shelf2Title: tr('Filme & Documentare Exclusive Apple', 'Apple Exclusive Movies & Documentaries', 'Эксклюзивные фильмы Apple'),
          showTop10Ranks: false,
          disneyHubs: false,
        };
      case 'hbo':
        return {
          id: 'hbo',
          containerBg: 'bg-[#060312]',
          headerGlow: 'from-[#6700FF]/35 via-[#1b083c] to-[#060312]',
          brandBadge: 'MAX ORIGINAL',
          brandBadgeColor: 'text-[#c084fc]',
          accentColor: '#9900FF',
          playBtnClass: 'bg-gradient-to-r from-[#9900FF] to-[#002be7] hover:brightness-110 text-white font-extrabold shadow-[0_0_24px_rgba(153,0,255,0.45)]',
          detailBtnClass: 'bg-purple-950/40 hover:bg-purple-900/50 text-purple-100 border border-purple-500/40 backdrop-blur-md',
          cardFocusRing: 'group-focus:ring-2 group-focus:ring-purple-500 group-focus:border-purple-400 group-hover:border-purple-400/80 shadow-[0_0_26px_rgba(153,0,255,0.35)]',
          top10Title: tr('Capodopere HBO • Producții de Calibru Mondial', 'HBO Masterpieces • World-Class Hits', 'Шедевры HBO • Мировые хиты'),
          shelf1Title: tr('Seriale Recomandate Max', 'Recommended Series on Max', 'Рекомендуемые сериалы Max'),
          shelf2Title: tr('Blockbustere Warner Bros. & DC', 'Warner Bros. & DC Blockbusters', 'Блокбастеры Warner Bros. и DC'),
          showTop10Ranks: false,
          disneyHubs: false,
        };
      case 'prime':
        return {
          id: 'prime',
          containerBg: 'bg-[#0B141E]',
          headerGlow: 'from-[#00A8E1]/25 via-[#0F1E2E] to-[#0B141E]',
          brandBadge: 'INCLUS CU PRIME',
          brandBadgeColor: 'text-[#00A8E1]',
          accentColor: '#00A8E1',
          playBtnClass: 'bg-[#00A8E1] hover:bg-[#0092c4] text-[#0B141E] font-extrabold shadow-[0_0_20px_rgba(0,168,225,0.35)]',
          detailBtnClass: 'bg-[#1A2C3D]/80 hover:bg-[#233B52] text-white border border-[#00A8E1]/40 backdrop-blur-md',
          cardFocusRing: 'group-focus:ring-2 group-focus:ring-[#00A8E1] group-focus:border-[#00A8E1] group-hover:border-[#00A8E1]/70 shadow-[0_0_24px_rgba(0,168,225,0.3)]',
          top10Title: tr('Top 10 pe Prime Video azi', 'Top 10 on Prime Video Today', 'Топ 10 на Prime Video сегодня'),
          shelf1Title: tr('Amazon Originals & Exclusivități Prime', 'Amazon Originals & Prime Exclusives', 'Оригиналы Amazon и эксклюзивы Prime'),
          shelf2Title: tr('Hituri Populare pe Prime Video', 'Popular Hits on Prime Video', 'Популярные хиты на Prime Video'),
          showTop10Ranks: true,
          disneyHubs: false,
        };
      case 'disney':
        return {
          id: 'disney',
          containerBg: 'bg-[#040714]',
          headerGlow: 'from-[#113CCF]/35 via-[#081232] to-[#040714]',
          brandBadge: 'DISNEY+ ORIGINAL',
          brandBadgeColor: 'text-sky-300',
          accentColor: '#113CCF',
          playBtnClass: 'bg-[#113CCF] hover:bg-blue-600 text-white font-extrabold shadow-[0_0_24px_rgba(17,60,207,0.5)]',
          detailBtnClass: 'bg-blue-950/50 hover:bg-blue-900/60 text-blue-100 border border-blue-400/40 backdrop-blur-md',
          cardFocusRing: 'group-focus:ring-2 group-focus:ring-blue-500 group-focus:border-blue-400 group-hover:border-blue-400/80 shadow-[0_0_26px_rgba(17,60,207,0.45)]',
          top10Title: tr('Originale Disney+ & Star', 'Disney+ & Star Originals', 'Оригиналы Disney+ и Star'),
          shelf1Title: tr('Universuri Legendare • Marvel & Star Wars', 'Legendary Universes • Marvel & Star Wars', 'Легендарные вселенные • Marvel и Звездные войны'),
          shelf2Title: tr('Hituri de Familie & Producții Populare', 'Family Hits & Popular Titles', 'Семейные хиты и популярное'),
          showTop10Ranks: false,
          disneyHubs: true,
        };
      default:
        return {
          id: 'paramount',
          containerBg: 'bg-[#090C1A]',
          headerGlow: 'from-indigo-600/30 via-[#101432] to-[#090C1A]',
          brandBadge: 'SKYSHOWTIME EXCLUSIV',
          brandBadgeColor: 'text-indigo-300',
          accentColor: '#6366F1',
          playBtnClass: 'bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold shadow-[0_0_22px_rgba(99,102,241,0.4)]',
          detailBtnClass: 'bg-indigo-950/50 hover:bg-indigo-900/60 text-indigo-100 border border-indigo-400/40 backdrop-blur-md',
          cardFocusRing: 'group-focus:ring-2 group-focus:ring-indigo-500 group-focus:border-indigo-400 group-hover:border-indigo-400/80 shadow-[0_0_24px_rgba(99,102,241,0.35)]',
          top10Title: tr('Seriale Exclusive SkyShowtime', 'SkyShowtime Exclusive Series', 'Эксклюзивные сериалы SkyShowtime'),
          shelf1Title: tr('Universul Yellowstone & Drame de Acțiune', 'Yellowstone Universe & Action Dramas', 'Вселенная Йеллоустоун и драмы'),
          shelf2Title: tr('Catalog Complet SkyShowtime', 'SkyShowtime Complete Catalog', 'Полный каталог SkyShowtime'),
          showTop10Ranks: false,
          disneyHubs: false,
        };
    }
  }, [section, tr]);

  // Card render helper with full Favorite heart support & TV remote Red button handling
  const renderCard = (item: CinemetaItem, index?: number, showRankNumber = false) => {
    const isFav = savedVodItems.some((x) => x.id === item.id);
    const posterUrl =
      item.poster ||
      `https://images.metahub.space/poster/medium/${item.id}/img`;
    const rInfo = getVodCardRatingInfo(item);

    return (
      <div
        key={`plat_${section}_${item.id}_${index ?? 0}`}
        className="group relative flex items-center shrink-0 cursor-pointer select-none"
      >
        {/* Netflix / Prime Big Rank Number 1..10 */}
        {showRankNumber && typeof index === 'number' && (
          <div className="relative -mr-4 sm:-mr-6 z-0 flex items-center justify-center shrink-0 select-none pointer-events-none">
            <span
              className="text-[90px] sm:text-[120px] font-black leading-none tracking-tighter"
              style={{
                fontFamily: 'impact, sans-serif',
                WebkitTextStroke: '3px #595959',
                color: theme.id === 'netflix' ? '#141414' : '#0B141E',
                textShadow: '0 4px 18px rgba(0,0,0,0.9)',
              }}
            >
              {index + 1}
            </span>
          </div>
        )}

        {/* Card Poster Box */}
        <div
          data-vod-card="true"
          data-vod-id={item.id}
          tabIndex={0}
          role="button"
          onFocus={() => handleFocusVodItem(item)}
          onMouseEnter={() => handleFocusVodItem(item)}
          onClick={() => handleOpenVod(item)}
          onKeyDown={(e) => handleCardPlayKey(e, item)}
          className={`relative z-10 w-[145px] sm:w-[175px] md:w-[195px] flex flex-col focus:outline-none transition-all duration-200 group-focus:scale-[1.04] group-hover:scale-[1.02]`}
        >
          <div
            className={`aspect-[2/3] w-full rounded-2xl bg-[#1c1c1c] relative overflow-hidden shadow-xl border border-white/10 transition-all ${theme.cardFocusRing}`}
          >
            <img
              src={posterUrl}
              alt={item.name}
              loading="lazy"
              onError={(e) => {
                const fallback = `https://images.metahub.space/poster/medium/${item.id}/img`;
                if (e.currentTarget.src !== fallback) {
                  e.currentTarget.src = fallback;
                }
              }}
              className="w-full h-full object-cover"
            />

            {/* Top-Left Producer Badge */}
            <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 pointer-events-none">
              <VodCardProducerBadge item={item} />
            </div>

            {/* Top-Right: Rating & Format Badges */}
            <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 pointer-events-none">
              <span className="px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-sm border border-white/15 text-white text-[10px] font-extrabold tracking-tight shadow inline-flex items-center gap-1">
                <span className={rInfo.isRussian ? 'text-[#ff5500]' : 'text-amber-400'}>
                  {rInfo.source}
                </span>
                <span>{rInfo.value}</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider shadow whitespace-nowrap truncate ${
                  item.type === 'series'
                    ? 'bg-[#172554]/95 text-white border border-[#2563eb]/50'
                    : 'bg-amber-500/90 text-zinc-950'
                }`}
              >
                {item.type === 'series'
                  ? formatSeriesCardBadgeText(item, seriesEpStatsMap[item.id] || uhdSeriesEpStats[item.id], tr)
                  : tr('FILM', 'MOVIE', 'ФИЛЬМ')}
              </span>
            </div>

            {/* Interactive Favorite Heart Button (PC hover / iPad tap / Remote RED button) */}
            <button
              type="button"
              data-fav-btn="true"
              title={
                isFav
                  ? tr('Elimină din favorite (🔴 / F)', 'Remove from favorites (🔴 / F)', 'Удалить из избранного (🔴 / F)')
                  : tr('Adaugă la favorite (🔴 / F)', 'Add to favorites (🔴 / F)', 'Добавить в избранное (🔴 / F)')
              }
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (toggleSaveVodItem) {
                  toggleSaveVodItem(item);
                }
              }}
              className={`absolute bottom-2.5 right-2.5 z-20 p-2 rounded-full backdrop-blur-md border transition-all cursor-pointer shadow-lg ${
                isFav
                  ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-400 opacity-100 scale-100'
                  : 'bg-black/60 hover:bg-black/90 text-zinc-300 hover:text-white border-white/20 opacity-0 group-hover:opacity-100 group-focus:opacity-100 focus:opacity-100 max-md:opacity-85'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-white text-white' : ''}`} />
            </button>

            <VodPosterWatchedControl
              item={item}
              entry={findWatchProgressEntry(watchProgressMap, item)}
              stats={seriesEpStatsMap[item.id] || uhdSeriesEpStats[item.id]}
              onToggleWatched={handleToggleWatchedStatus}
              tr={tr}
            />
          </div>

          {/* Title & Metadata below card */}
          <div className="mt-2.5 px-0.5">
            <div className="text-sm font-semibold text-zinc-100 group-focus:text-white line-clamp-1 leading-snug">
              {item.name}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5 truncate">
              {formatSeriesCardSubtitleText(item, seriesEpStatsMap[item.id] || uhdSeriesEpStats[item.id], tr)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-8 pb-20 -mx-3 sm:-mx-6 px-3 sm:px-6 pt-2 ${theme.containerBg} min-h-screen transition-colors duration-300`}>
      {/* 1. TOP PLATFORM SWITCHER DOCK */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto py-2 px-2 -mx-2 no-scrollbar">
          {STREAMING_PLATFORMS.map((plat) => {
            const isActive = section === plat.id;
            return (
              <button
                key={plat.id}
                type="button"
                onClick={() => {
                  setPlatformMediaTab('series');
                  setSection(plat.id);
                }}
                className={`h-11 pl-2 pr-4 rounded-full text-xs sm:text-sm font-extrabold inline-flex items-center gap-2.5 shrink-0 transition-all focus:outline-none focus:ring-4 focus:ring-white cursor-pointer ${
                  isActive
                    ? 'bg-white text-black shadow-lg scale-[1.02]'
                    : 'bg-white/[0.08] hover:bg-white/[0.16] text-zinc-200 border border-white/10'
                }`}
              >
                <StreamingPlatformLogo platformId={plat.id} size="sm" />
                <span>{plat.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSection('youtube')}
            className="h-11 pl-2 pr-4 rounded-full text-xs sm:text-sm font-extrabold inline-flex items-center gap-2.5 shrink-0 transition-all bg-white/[0.08] hover:bg-white/[0.16] text-zinc-200 border border-white/10 focus:outline-none focus:ring-4 focus:ring-white cursor-pointer"
          >
            <StreamingPlatformLogo platformId="youtube" size="sm" />
            <span>YouTube Premium</span>
          </button>
        </div>

        {/* SUB-FILTER PILLS (Seriale / Filme / Toate) */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <StreamingPlatformLogo platformId={currentPlat.id} size="md" />
            <div>
              <span className={`text-xs font-black tracking-widest uppercase ${theme.brandBadgeColor}`}>
                {currentPlat.label}
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none">
                {platformMediaTab === 'series'
                  ? tr('Seriale Originale & În Tendințe', 'Original & Trending Series', 'Оригинальные сериалы')
                  : platformMediaTab === 'movie'
                    ? tr('Filme Exclusiv pe Platformă', 'Exclusive Platform Movies', 'Фильмы на платформе')
                    : tr('Catalog Complet', 'Complete Catalog', 'Полный каталог')}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-full bg-white/[0.06] border border-white/10 shrink-0">
            {(
              [
                { id: 'series', label: tr('Seriale', 'Series', 'Сериалы') },
                { id: 'movie', label: tr('Filme', 'Movies', 'Фильмы') },
                { id: 'all', label: tr('Toate', 'All', 'Все') },
              ] as const
            ).map((tab) => {
              const isTabActive = platformMediaTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPlatformMediaTab(tab.id)}
                  className={`h-8 sm:h-9 px-3.5 sm:px-4 rounded-full text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer ${
                    isTabActive
                      ? 'bg-white text-black shadow-md'
                      : 'text-zinc-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. DISNEY+ BRAND HUBS (Only for Disney+) */}
      {theme.disneyHubs && (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 sm:gap-3.5">
          {[
            { name: 'DISNEY', color: 'from-[#001744] to-[#040714]' },
            { name: 'PIXAR', color: 'from-[#001744] to-[#040714]' },
            { name: 'MARVEL', color: 'from-[#420008] to-[#040714]' },
            { name: 'STAR WARS', color: 'from-[#001744] to-[#040714]' },
            { name: 'NAT GEO', color: 'from-[#2b2200] to-[#040714]' },
            { name: 'STAR', color: 'from-[#190024] to-[#040714]' },
          ].map((hub) => (
            <div
              key={hub.name}
              className={`h-16 sm:h-20 rounded-2xl bg-gradient-to-b ${hub.color} border border-white/15 flex items-center justify-center shadow-lg transition-transform hover:scale-105 cursor-pointer`}
            >
              <span className="text-base sm:text-lg font-black tracking-widest text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                {hub.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 3. AUTHENTIC HERO BILLBOARD */}
      {heroItem && (
        <div className="relative w-full rounded-3xl overflow-hidden shadow-2xl border border-white/15 min-h-[360px] sm:min-h-[440px] flex items-end">
          {/* Hero Backdrop Image */}
          <div className="absolute inset-0 z-0">
            <img
              src={
                heroItem.background ||
                heroItem.poster ||
                `https://images.metahub.space/background/medium/${heroItem.id}/img`
              }
              alt={heroItem.name}
              className="w-full h-full object-cover object-center"
            />
            {/* Rich Platform Gradient Overlay */}
            <div className={`absolute inset-0 bg-gradient-to-t ${theme.headerGlow} to-transparent`} />
            <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/60 to-transparent" />
          </div>

          {/* Hero Content Overlay */}
          <div className="relative z-10 p-6 sm:p-10 max-w-2xl space-y-3.5">
            {/* Brand Pill Badge */}
            <div className="flex items-center gap-2.5">
              <span className={`px-2.5 py-1 rounded-md text-xs tracking-widest uppercase ${theme.brandBadgeColor} font-black bg-black/60 backdrop-blur-md border border-white/15 shadow`}>
                {theme.brandBadge}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-md border border-white/15 text-white text-xs font-bold">
                {heroItem.type === 'series'
                  ? tr('SERIAL EXCLUSIV', 'EXCLUSIVE SERIES', 'ЭКСКЛЮЗИВНЫЙ СЕРИАЛ')
                  : tr('FILM DE TOP', 'FEATURE FILM', 'ТОП ФИЛЬМ')}
              </span>
            </div>

            {/* Title */}
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight drop-shadow-md">
              {heroItem.name}
            </h2>

            {/* Metadata (Match, Year, Audio, Rating) */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm text-zinc-200">
              <span className="font-extrabold text-emerald-400">98% {tr('Potrivire', 'Match', 'Совпадение')}</span>
              <span>•</span>
              <span className="px-1.5 py-0.5 rounded bg-white/20 font-bold text-white">4K UHD</span>
              <span>•</span>
              <span className="px-1.5 py-0.5 rounded border border-white/30 text-white font-medium">16+</span>
              <span>•</span>
              <span className="text-zinc-300 font-semibold">{tr('Subtitrare RO • Server 1', 'RO Subtitles • Server 1', 'Рус/Eng')}</span>
            </div>

            {/* Synopsis */}
            {heroItem.description && (
              <p className="text-xs sm:text-sm text-zinc-300 line-clamp-3 leading-relaxed max-w-xl">
                {heroItem.description}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleOpenVod(heroItem, true)}
                className={`h-11 sm:h-12 px-6 sm:px-8 rounded-xl sm:rounded-2xl text-sm sm:text-base font-extrabold inline-flex items-center gap-2.5 transition-all transform hover:scale-105 cursor-pointer ${theme.playBtnClass}`}
              >
                <Play className="w-5 h-5 fill-current" />
                <span>{tr('Redă', 'Play', 'Смотреть')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenVod(heroItem, false)}
                className={`h-11 sm:h-12 px-5 sm:px-6 rounded-xl sm:rounded-2xl text-sm font-semibold inline-flex items-center gap-2 transition-all cursor-pointer ${theme.detailBtnClass}`}
              >
                <Info className="w-4 h-4" />
                <span>{tr('Detalii & Sezoane', 'Details & Seasons', 'Подробнее')}</span>
              </button>

              <button
                type="button"
                title={
                  isHeroFav
                    ? tr('Elimină din Favorite', 'Remove from Favorites', 'Удалить из избранного')
                    : tr('Adaugă la Favorite', 'Add to Favorites', 'В избранное')
                }
                onClick={() => {
                  if (toggleSaveVodItem) {
                    toggleSaveVodItem(heroItem);
                  }
                }}
                className={`h-11 sm:h-12 w-11 sm:w-12 rounded-xl sm:rounded-2xl inline-flex items-center justify-center border transition-all cursor-pointer ${
                  isHeroFav
                    ? 'bg-rose-600 text-white border-rose-400 shadow-lg'
                    : 'bg-black/60 hover:bg-black/90 text-white border-white/20'
                }`}
              >
                <Heart className={`w-5 h-5 ${isHeroFav ? 'fill-white text-white' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. CONTENT SHELVES */}
      {isVodLoading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-zinc-400">
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          <span className="text-sm font-bold tracking-wide">
            {tr('Se încarcă producțiile originale...', 'Loading original titles...', 'Загрузка оригиналов...')}
          </span>
        </div>
      ) : vodItems.length === 0 ? (
        <div className="py-16 px-6 rounded-3xl bg-white/[0.04] border border-white/10 text-center space-y-2">
          <div className="text-base font-bold text-white">
            {tr('Nu s-au găsit titluri', 'No titles found', 'Ничего не найдено')}
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {/* SHELF 1: TOP 10 (With large numbers for Netflix & Prime, or Curated Hits) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  {theme.showTop10Ranks && <Flame className="w-5 h-5 text-rose-500 fill-rose-500" />}
                  <span>{theme.top10Title}</span>
                </h3>
              </div>
            </div>

            <div className="flex items-start gap-4 sm:gap-6 overflow-x-auto pt-2 pb-4 px-3 -mx-3 no-scrollbar">
              {top10Items.map((item, idx) =>
                renderCard(item, idx, theme.showTop10Ranks)
              )}
            </div>
          </div>

          {/* SHELF 2: ORIGINALE & FLAGSHIPS */}
          <div className="space-y-4">
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {theme.shelf1Title}
            </h3>
            <div className="flex items-start gap-3 sm:gap-4 overflow-x-auto pt-2 pb-4 px-3 -mx-3 no-scrollbar">
              {originalHits.map((item, idx) => renderCard(item, idx, false))}
            </div>
          </div>

          {/* SHELF 3: FILME (Dacă sunt filme disponibile) */}
          {moviesList.length > 0 && platformMediaTab !== 'series' && (
            <div className="space-y-4">
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {tr(
                  `Filme Originale & Exclusivități ${currentPlat.label}`,
                  `${currentPlat.label} Original & Exclusive Movies`,
                  `Фильмы ${currentPlat.label}`
                )}
              </h3>
              <div className="flex items-start gap-3 sm:gap-4 overflow-x-auto pt-2 pb-4 px-3 -mx-3 no-scrollbar">
                {moviesList.slice(0, 12).map((item, idx) => renderCard(item, idx, false))}
              </div>
            </div>
          )}

          {/* SHELF 4: CATALOG COMPLET (Grid de carduri) */}
          {moreCatalog.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-white/10">
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {tr(
                  `Mai multe pe ${currentPlat.label} (${moreCatalog.length})`,
                  `More on ${currentPlat.label} (${moreCatalog.length})`,
                  `Ещё на ${currentPlat.label} (${moreCatalog.length})`
                )}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-x-3 sm:gap-x-4 gap-y-6">
                {moreCatalog.map((item, idx) => renderCard(item, idx, false))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

StreamingPlatformView.displayName = 'StreamingPlatformView';
