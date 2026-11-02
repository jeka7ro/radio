import React, { useEffect, useId, useRef } from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Heart,
  Loader2,
  ShieldAlert,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Radio,
  PictureInPicture2,
  X,
} from 'lucide-react';
import { useRadioStore } from '../../store/useRadioStore';
import { useTranslation } from '../../i18n/useTranslation';
import { StationAvatar } from '../common/StationAvatar';
import { isInsecureHttpStream } from '../../services/radioBrowserApi';
import { getCountryFlagEmoji } from '../../services/geoLanguageService';
import { MAX_AUTO_RETRIES } from '../../hooks/useAudioPlayer';
import { toggleRadioPip } from './RadioPipPlayer';
import { resolveDisplayTrack } from '../../utils/cleanTrackMetadata';

export const ExpandedPlayer: React.FC = () => {
  const { t, format } = useTranslation();
  const titleId = useId();
  const volumeId = useId();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const isOpen = useRadioStore((state) => state.isExpandedPlayerOpen);
  const setExpandedPlayerOpen = useRadioStore(
    (state) => state.setExpandedPlayerOpen
  );
  const currentStation = useRadioStore((state) => state.currentStation);
  const playerStatus = useRadioStore((state) => state.playerStatus);
  const retryAttempt = useRadioStore((state) => state.retryAttempt);
  const nowPlayingTitle = useRadioStore((state) => state.nowPlayingTitle);
  const nowPlayingMeta = useRadioStore((state) => state.nowPlayingMeta);
  const usingHttpsUpgrade = useRadioStore((state) => state.usingHttpsUpgrade);
  const volume = useRadioStore((state) => state.volume);
  const isMuted = useRadioStore((state) => state.isMuted);
  const favorites = useRadioStore((state) => state.favorites);
  const isRadioPipOpen = useRadioStore((state) => state.isRadioPipOpen);

  const playStation = useRadioStore((state) => state.playStation);
  const triggerStreamReload = useRadioStore(
    (state) => state.triggerStreamReload
  );
  const playNextAvailableStation = useRadioStore(
    (state) => state.playNextAvailableStation
  );
  const playPreviousStation = useRadioStore(
    (state) => state.playPreviousStation
  );
  const setVolume = useRadioStore((state) => state.setVolume);
  const toggleMute = useRadioStore((state) => state.toggleMute);
  const toggleFavorite = useRadioStore((state) => state.toggleFavorite);

  // Close on Escape key & lock background scroll while open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpandedPlayerOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, setExpandedPlayerOpen]);

  if (!isOpen || !currentStation) return null;

  const isPlaying = playerStatus === 'playing';
  const isLoading = playerStatus === 'loading';
  const isError = playerStatus === 'error';
  const isFavorite = favorites.some(
    (f) => f.stationuuid === currentStation.stationuuid
  );

  const rawUrl = currentStation.url_resolved || currentStation.url;
  const isHttp = isInsecureHttpStream(rawUrl) && !usingHttpsUpgrade;
  const effectiveVolumePercent = Math.round((isMuted ? 0 : volume) * 100);
  const tags = currentStation.tags
    ? currentStation.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];

  const displayTrack = resolveDisplayTrack(
    nowPlayingMeta,
    nowPlayingTitle,
    currentStation.name
  );

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
    if (scrollTop <= 5 && e.touches.length === 1) {
      touchStartYRef.current = e.touches[0].clientY;
    } else {
      touchStartYRef.current = null;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartYRef.current === null || e.changedTouches.length === 0) {
      return;
    }
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    touchStartYRef.current = null;
    if (deltaY > 65) {
      setExpandedPlayerOpen(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => setExpandedPlayerOpen(false)}
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="w-full max-w-lg max-h-[85dvh] sm:max-h-[90dvh] rounded-t-3xl sm:rounded-3xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden"
      >
        {/* Pinned Sticky Header — ALWAYS visible & reachable on mobile */}
        <div className="shrink-0 pt-2.5 pb-2.5 px-4 sm:px-6 border-b border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 z-10">
          {/* Mobile Pull-Down / Tap Pill */}
          <button
            type="button"
            onClick={() => setExpandedPlayerOpen(false)}
            aria-label={t.player.collapsePlayer}
            className="w-full flex justify-center py-1 sm:hidden"
          >
            <span className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-700" />
          </button>

          <div className="flex items-center justify-between gap-2 mt-0.5">
            <button
              type="button"
              onClick={() => setExpandedPlayerOpen(false)}
              aria-label={t.player.collapsePlayer}
              className="min-h-[40px] px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 font-semibold text-xs sm:text-sm inline-flex items-center gap-1.5 transition-colors"
            >
              <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
              <span>Închide</span>
            </button>

            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400 truncate">
              <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{t.player.nowPlaying}</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  await toggleRadioPip();
                  if (!isRadioPipOpen) {
                    setExpandedPlayerOpen(false);
                  }
                }}
                aria-pressed={isRadioPipOpen}
                title="MiniPlayer Picture-in-Picture (fereastră flotantă)"
                aria-label="MiniPlayer Picture-in-Picture"
                className={`hidden sm:flex w-10 h-10 rounded-full items-center justify-center transition-colors ${
                  isRadioPipOpen
                    ? 'text-brand-700 dark:text-brand-300 bg-brand-100 dark:bg-brand-950/70'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                }`}
              >
                <PictureInPicture2 className="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => toggleFavorite(currentStation)}
                aria-pressed={isFavorite}
                aria-label={format(
                  isFavorite ? t.favorites.removeFav : t.favorites.addFav,
                  { name: currentStation.name }
                )}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isFavorite
                    ? 'text-rose-600 dark:text-rose-400 bg-rose-100/90 dark:bg-rose-950/50'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                }`}
              >
                <Heart
                  aria-hidden="true"
                  className={`w-4 h-4 sm:w-5 sm:h-5 ${isFavorite ? 'fill-current' : ''}`}
                />
              </button>

              <button
                type="button"
                onClick={() => setExpandedPlayerOpen(false)}
                aria-label="Închide fereastra"
                title="Închide fereastra"
                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-slate-700 dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-7 sm:py-6 flex flex-col"
        >
          {/* Artwork (Song Cover Art when playing a known song, or Station Logo) */}
          <div className="flex justify-center my-1 sm:my-2">
            {displayTrack?.coverUrl ? (
              <div className="relative w-36 h-36 sm:w-52 sm:h-52">
                <img
                  src={displayTrack.coverUrl}
                  alt={displayTrack.title}
                  className="w-full h-full rounded-3xl object-cover shadow-2xl border border-slate-200/80 dark:border-zinc-700/80"
                />
                <div className="absolute -bottom-2 -right-2 rounded-2xl p-1 bg-white dark:bg-zinc-900 shadow-lg border border-slate-200 dark:border-zinc-800">
                  <StationAvatar
                    name={currentStation.name}
                    favicon={currentStation.favicon}
                    homepage={currentStation.homepage}
                    size="sm"
                    isPlaying={isPlaying}
                  />
                </div>
              </div>
            ) : (
              <StationAvatar
                name={currentStation.name}
                favicon={currentStation.favicon}
                homepage={currentStation.homepage}
                size="xl"
                isPlaying={isPlaying}
                className="shadow-xl"
              />
            )}
          </div>

          {/* Station Name & Now Playing Metadata */}
          <div className="text-center mt-3 sm:mt-4 space-y-1.5">
            <h2
              id={titleId}
              className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-zinc-100 leading-tight line-clamp-2"
            >
              {displayTrack?.title || currentStation.name}
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 flex items-center justify-center gap-1.5">
              <span>{getCountryFlagEmoji(currentStation.countrycode)}</span>
              <span>
                {displayTrack
                  ? `${currentStation.name} • ${
                      currentStation.country || currentStation.countrycode
                    }`
                  : currentStation.country || currentStation.countrycode}
              </span>
            </p>

            {displayTrack ? (
              <div className="pt-1.5">
                <div className="mx-auto max-w-md p-2.5 sm:p-3 rounded-2xl bg-slate-100/90 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700/70 flex items-center gap-3 text-left">
                  {displayTrack.artistAvatarUrl ? (
                    <img
                      src={displayTrack.artistAvatarUrl}
                      alt={displayTrack.artist}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover flex-shrink-0 ring-2 ring-brand-500/60 shadow-sm"
                    />
                  ) : (
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-brand-700 text-white font-bold flex items-center justify-center flex-shrink-0 text-sm">
                      {(displayTrack.artist || displayTrack.title)
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Acum pe post
                      </span>
                      {displayTrack.album && (
                        <span className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                          • {displayTrack.album}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate mt-0.5">
                      {displayTrack.artist || currentStation.name}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-zinc-300 truncate">
                      {displayTrack.title}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="pt-1">
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
                    isError
                      ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300'
                      : isPlaying
                        ? 'bg-brand-100 dark:bg-brand-950/80 text-brand-800 dark:text-brand-300'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                  }`}
                >
                  {isPlaying && (
                    <span className="w-2 h-2 rounded-full bg-brand-600 dark:bg-brand-400 animate-ping" />
                  )}
                  <span>
                    {isError
                      ? t.player.error
                      : isLoading
                        ? retryAttempt > 0
                          ? format(t.player.retrying, {
                              attempt: retryAttempt,
                              max: MAX_AUTO_RETRIES,
                            })
                          : t.player.loading
                        : playerStatus === 'paused'
                          ? t.player.paused
                          : nowPlayingTitle || t.player.liveStream}
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* Error Box with "Try another station" */}
          {isError && (
            <div
              role="alert"
              className="mt-4 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-sm text-rose-900 dark:text-rose-200 space-y-2.5"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle
                  className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-semibold">{t.player.error}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => triggerStreamReload()}
                  className="min-h-[42px] flex-1 px-4 py-2 rounded-full bg-white dark:bg-zinc-900 border border-rose-300 dark:border-rose-800 font-semibold text-rose-700 dark:text-rose-300 inline-flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" aria-hidden="true" />
                  <span>{t.player.retryStream}</span>
                </button>
                <button
                  type="button"
                  onClick={playNextAvailableStation}
                  className="min-h-[42px] flex-1 px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-semibold inline-flex items-center justify-center gap-2"
                >
                  <SkipForward className="w-4 h-4" aria-hidden="true" />
                  <span>{t.player.tryAnother}</span>
                </button>
              </div>
            </div>
          )}

          {/* HTTP Mixed-Content Warning Box */}
          {isHttp && (
            <div className="mt-3 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <ShieldAlert
                  className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-semibold">{t.player.httpWarningTitle}</p>
                  <p className="text-amber-800/90 dark:text-amber-300/80 mt-0.5">
                    {t.player.httpWarningDesc}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => triggerStreamReload(true)}
                className="min-h-[38px] px-3 py-1.5 rounded-full bg-amber-600 hover:bg-amber-500 text-white font-semibold whitespace-nowrap transition-colors"
              >
                {t.player.tryHttps}
              </button>
            </div>
          )}

          {/* Main Transport Controls */}
          <div className="flex items-center justify-center gap-6 my-4 sm:my-6">
            <button
              type="button"
              onClick={playPreviousStation}
              aria-label={t.player.prevStation}
              className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 flex items-center justify-center text-slate-800 dark:text-zinc-200 transition-colors"
            >
              <SkipBack className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => playStation(currentStation)}
              aria-label={format(isPlaying ? t.player.pause : t.player.play, {
                name: currentStation.name,
              })}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-brand-700 hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500 text-white flex items-center justify-center shadow-lg transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin" aria-hidden="true" />
              ) : isPlaying ? (
                <Pause className="w-7 h-7 sm:w-8 sm:h-8 fill-current" aria-hidden="true" />
              ) : (
                <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-current ml-0.5" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={playNextAvailableStation}
              aria-label={t.player.nextStation}
              className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 flex items-center justify-center text-slate-800 dark:text-zinc-200 transition-colors"
            >
              <SkipForward className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
            </button>
          </div>

          {/* Volume Slider */}
          <div className="flex items-center gap-3 px-2 py-1.5 sm:py-2 rounded-full bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/70 dark:border-zinc-800/70">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? t.player.unmute : t.player.mute}
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-700 dark:text-zinc-300 hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-5 h-5" aria-hidden="true" />
              ) : (
                <Volume2 className="w-5 h-5" aria-hidden="true" />
              )}
            </button>
            <div className="flex-1 pr-2 flex items-center">
              <label htmlFor={volumeId} className="visually-hidden">
                {t.player.volume}
              </label>
              <input
                id={volumeId}
                type="range"
                min={0}
                max={100}
                value={effectiveVolumePercent}
                style={
                  {
                    '--progress': `${effectiveVolumePercent}%`,
                  } as React.CSSProperties
                }
                onChange={(e) => setVolume(Number(e.target.value) / 100)}
                className="w-full h-2 cursor-pointer"
              />
            </div>
            <span className="text-xs font-mono text-slate-600 dark:text-zinc-400 w-10 text-right pr-2">
              {effectiveVolumePercent}%
            </span>
          </div>

          {/* Tags & Technical Specs */}
          <div className="mt-4 pt-3.5 border-t border-slate-200 dark:border-zinc-800 space-y-3">
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200/60 dark:border-zinc-800/60">
                <span className="text-slate-500 dark:text-zinc-400 block">
                  {t.player.codec}
                </span>
                <span className="font-semibold text-slate-900 dark:text-zinc-100 mt-0.5 block">
                  {currentStation.codec || 'MP3'}
                  {currentStation.hls === 1 ? ' (HLS)' : ''}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200/60 dark:border-zinc-800/60">
                <span className="text-slate-500 dark:text-zinc-400 block">
                  {t.player.bitrate}
                </span>
                <span className="font-semibold text-slate-900 dark:text-zinc-100 mt-0.5 block">
                  {currentStation.bitrate > 0
                    ? `${currentStation.bitrate} kbps`
                    : 'Auto'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200/60 dark:border-zinc-800/60">
                <span className="text-slate-500 dark:text-zinc-400 block">
                  {t.player.votes}
                </span>
                <span className="font-semibold text-slate-900 dark:text-zinc-100 mt-0.5 block">
                  {currentStation.votes.toLocaleString()}
                </span>
              </div>
            </div>

            {currentStation.homepage && (
              <div className="text-center pt-0.5">
                <a
                  href={currentStation.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 dark:text-brand-400 hover:underline py-1"
                >
                  <span>{t.player.visitWebsite}</span>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </div>
            )}

            {/* Mobile One-Handed Bottom Close Button */}
            <div className="pt-1 pb-2 sm:hidden">
              <button
                type="button"
                onClick={() => setExpandedPlayerOpen(false)}
                className="w-full min-h-[44px] rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
                <span>Închide fereastra</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
