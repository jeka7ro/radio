import React, { useState, useEffect, useRef, memo } from 'react';
import { Play, Flame } from 'lucide-react';
import {
  StreamingPlatformLogo,
  detectStreamingPlatformFromTexts,
  lookupPlatformByImdbId,
} from '../common/StreamingPlatformLogo';
import {
  CinemetaItem,
  STREAMING_PLATFORMS,
  extractVodProductionYear,
} from '../../views/smartTvLampaHelpers';

export interface HomeHeroBillboardProps {
  heroBillboardItems: CinemetaItem[];
  isCarMode: boolean;
  uiLang: string;
  tr: (ro: string, en: string, ru: string) => string;
  handleFocusVodItem: (item: CinemetaItem) => void;
  handleCardPlayKey: (e: React.KeyboardEvent, item: CinemetaItem) => void;
  handleOpenVod: (item: CinemetaItem, autoPlay?: boolean) => void;
  spotlightMetaCacheRef: React.MutableRefObject<
    Record<string, { description?: string; subtitleExtra?: string } | undefined>
  >;
}

export const HomeHeroBillboard: React.FC<HomeHeroBillboardProps> = memo(
  ({
    heroBillboardItems,
    isCarMode,
    uiLang,
    tr,
    handleFocusVodItem,
    handleCardPlayKey,
    handleOpenVod,
    spotlightMetaCacheRef,
  }) => {
    const [activeIdx, setActiveIdx] = useState<number>(0);
    const [failedLogoIds, setFailedLogoIds] = useState<Record<string, boolean>>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const isHoveredRef = useRef<boolean>(false);

    const count = heroBillboardItems.length;
    const safeIdx = count > 0 ? activeIdx % count : 0;

    // Pre-cache all hero billboard backdrops and posters in browser memory immediately
    useEffect(() => {
      if (typeof window === 'undefined' || heroBillboardItems.length === 0) return;
      heroBillboardItems.forEach((item) => {
        const bg =
          item.background ||
          `https://images.metahub.space/background/medium/${item.id}/img`;
        const preImg = new Image();
        preImg.src = bg;
        if (item.poster) {
          const posterImg = new Image();
          posterImg.src = item.poster;
        }
      });
    }, [heroBillboardItems]);

    // Auto-rotate Hero Billboard Banner every 12 seconds with gentle crossfade
    // PAUSES AUTOMATICALLY when user is scrolled down, hovering, or navigating
    useEffect(() => {
      if (count <= 1) return;

      const timer = window.setInterval(() => {
        // 1. Pause auto-rotate if user has scrolled down (banner not at top of viewport)
        if (typeof window !== 'undefined') {
          const mainEl = document.querySelector('main');
          if (mainEl && mainEl.scrollTop > 50) return;
          if (window.scrollY > 50) return;
        }

        // 2. Pause auto-rotate if mouse is hovering over banner
        if (isHoveredRef.current) return;

        // 3. Pause auto-rotate if a button or dot inside banner is focused
        const active = typeof document !== 'undefined' ? document.activeElement : null;
        if (containerRef.current && active && containerRef.current.contains(active)) {
          return;
        }

        setActiveIdx((prev) => (prev + 1) % count);
      }, 12000);

      return () => window.clearInterval(timer);
    }, [count]);

    if (count === 0) return null;

    const bannerHeight = isCarMode ? '220px' : '360px';

    return (
      <div
        ref={containerRef}
        data-top-hero-card="true"
        data-mobile-hide-banner="true"
        onMouseEnter={() => {
          isHoveredRef.current = true;
        }}
        onMouseLeave={() => {
          isHoveredRef.current = false;
        }}
        style={{
          height: bannerHeight,
          minHeight: bannerHeight,
          maxHeight: bannerHeight,
          contain: 'layout paint',
          overflowAnchor: 'none',
        }}
        className="hidden md:block relative w-full rounded-2xl sm:rounded-[28px] overflow-hidden border border-white/15 shadow-[0_24px_60px_rgba(0,0,0,0.85)] bg-[#111318] select-none"
      >
        {/* Render stacked slides with absolute crossfade (ZERO reload, ZERO black flash, ZERO layout shift) */}
        {heroBillboardItems.map((heroItem, idx) => {
          const isCurrent = idx === safeIdx;
          const heroBackdrop =
            heroItem.background ||
            `https://images.metahub.space/background/medium/${heroItem.id}/img`;
          const heroLogoUrl = `https://images.metahub.space/logo/medium/${heroItem.id}/img`;
          const heroYear = extractVodProductionYear(heroItem) || 2026;
          const cachedHeroMeta =
            spotlightMetaCacheRef.current[`${heroItem.id}_${uiLang}`];

          const heroPlatId =
            lookupPlatformByImdbId(heroItem.id) ||
            detectStreamingPlatformFromTexts([heroItem.releaseTitle]) ||
            'netflix';
          const heroPlatLabel =
            STREAMING_PLATFORMS.find((p) => p.id === heroPlatId)?.label || 'Netflix';

          return (
            <div
              key={`hero_slide_${heroItem.id}`}
              aria-hidden={!isCurrent}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out flex flex-col justify-between ${
                isCarMode
                  ? 'p-3 sm:px-6 sm:py-3'
                  : 'p-3 sm:p-5 lg:p-8'
              } ${
                isCurrent
                  ? 'opacity-100 z-10 pointer-events-auto'
                  : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              {/* Full-Bleed Widescreen Backdrop */}
              <img
                src={heroBackdrop}
                alt={heroItem.name}
                loading={idx === 0 ? 'eager' : 'lazy'}
                onError={(e) => {
                  const fallback =
                    heroItem.poster ||
                    `https://images.metahub.space/poster/medium/${heroItem.id}/img`;
                  if (e.currentTarget.src !== fallback) {
                    e.currentTarget.src = fallback;
                  }
                }}
                className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
              />

              {/* Cinematic Ambient Multi-Stop Gradient Overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0e1015] via-[#0e1015]/60 to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0e1015] via-[#0e1015]/80 to-transparent pointer-events-none" />

              {/* Top Bar: Brand Emblem & Label */}
              <div className="relative z-10 flex items-center justify-between gap-3 pr-36 sm:pr-48">
                <div className="flex items-center gap-2 min-w-0">
                  <StreamingPlatformLogo platformId={heroPlatId} size="sm" />
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.12em] sm:tracking-[0.22em] text-zinc-200 drop-shadow truncate">
                    {heroPlatLabel} •{' '}
                    {heroItem.type === 'series'
                      ? tr(
                          'SERIAL RECOMANDAT',
                          'FEATURED SERIES',
                          'СЕРИАЛ • ПРЕМЬЕРА'
                        )
                      : tr(
                          'FILM RECOMANDAT',
                          'FEATURED MOVIE',
                          'ФИЛЬМ • ПРЕМЬЕРА'
                        )}
                  </span>
                </div>
              </div>

              {/* Middle & Bottom: Display Title/Logo + Metadata + Play & More Info */}
              <div
                className={`relative z-10 ${
                  isCarMode ? 'mt-2 sm:mt-3 gap-2' : 'mt-5 sm:mt-10 gap-2.5 sm:gap-3.5'
                } flex flex-col`}
              >
                <div
                  className={`max-w-2xl ${
                    isCarMode ? 'space-y-1' : 'space-y-2 sm:space-y-2.5'
                  }`}
                >
                  <div className="h-[44px] sm:h-[64px] flex items-center overflow-hidden">
                    {!failedLogoIds[heroItem.id] ? (
                      <img
                        src={heroLogoUrl}
                        alt={heroItem.name}
                        onError={() =>
                          setFailedLogoIds((prev) => ({
                            ...prev,
                            [heroItem.id]: true,
                          }))
                        }
                        className="max-h-[44px] sm:max-h-[64px] max-w-[220px] sm:max-w-[420px] w-auto object-contain object-left drop-shadow-[0_8px_24px_rgba(0,0,0,0.95)]"
                      />
                    ) : (
                      <h2 className="text-2xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-white leading-none line-clamp-1 drop-shadow-[0_6px_24px_rgba(0,0,0,0.95)]">
                        {heroItem.name}
                      </h2>
                    )}
                  </div>

                  {/* Metadata Line */}
                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-bold text-zinc-200 drop-shadow">
                    <span className="text-white font-extrabold">
                      {heroItem.type === 'series'
                        ? tr('Serial', 'Series', 'Сериал')
                        : tr('Film', 'Movie', 'Фильм')}
                    </span>
                    {heroItem.genres && heroItem.genres.length > 0 && (
                      <>
                        <span className="text-zinc-500">•</span>
                        <span>{heroItem.genres.slice(0, 2).join(' • ')}</span>
                      </>
                    )}
                    <span className="text-zinc-500">•</span>
                    <span className="text-white font-extrabold">
                      {heroItem.releaseInfo || heroYear}
                    </span>
                    {heroItem.imdbRating && (
                      <>
                        <span className="text-zinc-500">•</span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-400 text-zinc-950 text-xs font-black shadow">
                          IMDb {heroItem.imdbRating}
                        </span>
                      </>
                    )}
                    <span className="text-zinc-500">•</span>
                    <span className="px-2 py-0.5 rounded-md bg-white/15 border border-white/25 text-[11px] font-extrabold text-white">
                      4K UHD
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-white/10 text-[11px] font-bold text-zinc-300">
                      16+
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-zinc-200/90 line-clamp-2 max-w-xl leading-relaxed drop-shadow h-[36px] sm:h-[40px] overflow-hidden">
                    {cachedHeroMeta?.description || heroItem.description || ''}
                  </p>
                </div>

                {/* Bottom Action Bar: Left (Play + More Info) & Right (Recently Added + TOP 10 #1) */}
                <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 pt-1">
                  <div className="flex flex-row items-center gap-2 sm:gap-3">
                    <button
                      type="button"
                      data-vod-card="true"
                      data-vod-id={heroItem.id}
                      tabIndex={isCurrent ? 0 : -1}
                      onFocus={() => handleFocusVodItem(heroItem)}
                      onMouseEnter={() => handleFocusVodItem(heroItem)}
                      onKeyDown={(e) => handleCardPlayKey(e, heroItem)}
                      onClick={() => handleOpenVod(heroItem, true)}
                      className="group/heroplay w-auto shrink-0 h-10 sm:h-12 px-5 sm:px-8 rounded-full bg-white hover:bg-zinc-200 focus:bg-[#1e3a8a] text-[#081220] hover:text-[#081220] focus:text-white border border-white/80 focus:border-[#3b82f6]/50 text-xs sm:text-base font-extrabold inline-flex flex-row items-center justify-center gap-2 sm:gap-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.6)] transition-all focus:outline-none focus:ring-4 focus:ring-white focus:scale-105 cursor-pointer whitespace-nowrap"
                    >
                      <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current text-[#081220] group-focus/heroplay:text-white shrink-0" />
                      <span className="text-[#081220] group-focus/heroplay:text-white font-extrabold">
                        {tr('Redă', 'Play', 'Смотреть')}
                      </span>
                    </button>

                    <button
                      type="button"
                      data-vod-card="true"
                      data-vod-id={heroItem.id}
                      tabIndex={isCurrent ? 0 : -1}
                      onFocus={() => handleFocusVodItem(heroItem)}
                      onMouseEnter={() => handleFocusVodItem(heroItem)}
                      onKeyDown={(e) => handleCardPlayKey(e, heroItem)}
                      onClick={() => handleOpenVod(heroItem, false)}
                      className="w-auto shrink-0 h-10 sm:h-12 px-4 sm:px-7 rounded-full bg-zinc-700/75 hover:bg-zinc-600/85 focus:bg-white focus:text-[#141414] backdrop-blur-xl border border-white/25 text-white text-xs sm:text-base font-extrabold inline-flex flex-row items-center justify-center gap-2 shadow-lg transition-all focus:outline-none focus:ring-4 focus:ring-white cursor-pointer whitespace-nowrap"
                    >
                      <span>
                        {tr('Mai multe detalii', 'More Info', 'Подробнее')}
                      </span>
                    </button>
                  </div>

                  <div className="hidden sm:flex flex-wrap items-center gap-2.5">
                    <span className="h-9 px-3 rounded-xl bg-black/75 backdrop-blur-md border border-white/15 text-xs font-bold text-zinc-200 inline-flex items-center gap-1.5 shadow-lg">
                      <Flame className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>
                        {tr('Adăugat Recent', 'Recently Added', 'Новинка')}
                      </span>
                    </span>

                    <span className="h-9 px-3.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/15 text-xs font-extrabold text-white inline-flex items-center gap-2 shadow-lg">
                      <span className="px-1.5 py-0.5 rounded bg-[#E50914] text-white text-[9px] font-black leading-none uppercase">
                        TOP 10
                      </span>
                      <span>
                        #{idx + 1}{' '}
                        {heroItem.type === 'series'
                          ? tr('în Seriale', 'in Series', 'в Сериалах')
                          : tr('în Filme', 'in Movies', 'в Фильмах')}{' '}
                        {heroItem.imdbRating ? `(${heroItem.imdbRating})` : ''}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Top Spotlight Selector Dots (persistent at z-30, instant click without reload) */}
        {count > 1 && (
          <div className="absolute top-3 sm:top-5 lg:top-8 right-3 sm:right-5 lg:right-8 z-30 flex items-center gap-1 sm:gap-1.5 bg-black/50 backdrop-blur-md px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-white/15">
            {heroBillboardItems.map((hItem, idx) => {
              const isCurrent = idx === safeIdx;
              return (
                <button
                  key={`hero_dot_${hItem.id}`}
                  type="button"
                  title={`${hItem.name} (${hItem.imdbRating || '8.5'})`}
                  onClick={() => setActiveIdx(idx)}
                  className={`h-2 sm:h-2.5 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white cursor-pointer ${
                    isCurrent
                      ? 'w-5 sm:w-7 bg-[#E50914]'
                      : 'w-2 sm:w-2.5 bg-white/35 hover:bg-white/70'
                  }`}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

HomeHeroBillboard.displayName = 'HomeHeroBillboard';
