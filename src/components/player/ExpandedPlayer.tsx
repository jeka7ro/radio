import React, { useEffect, useRef, useId } from 'react';
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
} from 'lucide-react';
import { useRadioStore } from '../../store/useRadioStore';
import { useTranslation } from '../../i18n/useTranslation';
import { StationAvatar } from '../common/StationAvatar';
import { isInsecureHttpStream } from '../../services/radioBrowserApi';
import { getCountryFlagEmoji } from '../../services/geoLanguageService';
import { MAX_AUTO_RETRIES } from '../../hooks/useAudioPlayer';
import { toggleRadioPip } from './RadioPipPlayer';

export const ExpandedPlayer: React.FC = () => {
  const { t, format } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const volumeId = useId();

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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && currentStation) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen, currentStation]);

  // Fallback for browsers without native <dialog closedby="any"> support
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      setExpandedPlayerOpen(false);
    };

    const handleBackdropClick = (event: MouseEvent) => {
      if ('closedBy' in HTMLDialogElement.prototype) return;
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isDialogContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (isDialogContent) return;
      dialog.close();
    };

    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('click', handleBackdropClick);

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [setExpandedPlayerOpen]);

  if (!currentStation) return null;

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

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      aria-labelledby={titleId}
      className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-0 m-0 sm:m-auto mt-auto bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-2xl border border-slate-200 dark:border-zinc-800 backdrop:bg-black/65 backdrop:backdrop-blur-xs max-h-[94vh] overflow-y-auto"
    >
      <div className="p-5 sm:p-7 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-5">
          <button
            type="button"
            onClick={() => setExpandedPlayerOpen(false)}
            aria-label={t.player.collapsePlayer}
            className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ChevronDown className="w-6 h-6" aria-hidden="true" />
          </button>

          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400">
            <Radio className="w-4 h-4" aria-hidden="true" />
            <span>{t.player.nowPlaying}</span>
          </div>

          <div className="flex items-center gap-1.5">
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
              className={`min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition-colors ${
                isRadioPipOpen
                  ? 'text-brand-700 dark:text-brand-300 bg-brand-100 dark:bg-brand-950/70'
                  : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <PictureInPicture2 className="w-5 h-5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => toggleFavorite(currentStation)}
              aria-pressed={isFavorite}
              aria-label={format(
                isFavorite ? t.favorites.removeFav : t.favorites.addFav,
                { name: currentStation.name }
              )}
              className={`min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition-colors ${
                isFavorite
                  ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
                  : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Heart
                aria-hidden="true"
                className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Artwork (Song Cover Art when playing a known song, or Station Logo) */}
        <div className="flex justify-center my-3">
          {nowPlayingMeta?.coverUrl ? (
            <div className="relative w-48 h-48 sm:w-56 sm:h-56">
              <img
                src={nowPlayingMeta.coverUrl}
                alt={nowPlayingMeta.title}
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
        <div className="text-center mt-4 space-y-1.5">
          <h2
            id={titleId}
            className="text-2xl font-bold text-slate-900 dark:text-zinc-100 leading-tight"
          >
            {nowPlayingMeta?.title || currentStation.name}
          </h2>

          <p className="text-sm text-slate-600 dark:text-zinc-400 flex items-center justify-center gap-1.5">
            <span>{getCountryFlagEmoji(currentStation.countrycode)}</span>
            <span>
              {nowPlayingMeta
                ? `${currentStation.name} • ${
                    currentStation.country || currentStation.countrycode
                  }`
                : currentStation.country || currentStation.countrycode}
            </span>
          </p>

          {nowPlayingMeta ? (
            <div className="pt-2">
              <div className="mx-auto max-w-md p-3 rounded-2xl bg-slate-100/90 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700/70 flex items-center gap-3 text-left">
                {nowPlayingMeta.artistAvatarUrl ? (
                  <img
                    src={nowPlayingMeta.artistAvatarUrl}
                    alt={nowPlayingMeta.artist}
                    className="w-12 h-12 rounded-full object-cover flex-shrink-0 ring-2 ring-brand-500/60 shadow-sm"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-brand-700 text-white font-bold flex items-center justify-center flex-shrink-0 text-sm">
                    {(nowPlayingMeta.artist || nowPlayingMeta.title)
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
                    {nowPlayingMeta.album && (
                      <span className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                        • {nowPlayingMeta.album}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate mt-0.5">
                    {nowPlayingMeta.artist || currentStation.name}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-zinc-300 truncate">
                    {nowPlayingMeta.title}
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
            className="mt-5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-sm text-rose-900 dark:text-rose-200 space-y-3"
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
                className="min-h-[44px] flex-1 px-4 py-2 rounded-full bg-white dark:bg-zinc-900 border border-rose-300 dark:border-rose-800 font-semibold text-rose-700 dark:text-rose-300 inline-flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                <span>{t.player.retryStream}</span>
              </button>
              <button
                type="button"
                onClick={playNextAvailableStation}
                className="min-h-[44px] flex-1 px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-semibold inline-flex items-center justify-center gap-2"
              >
                <SkipForward className="w-4 h-4" aria-hidden="true" />
                <span>{t.player.tryAnother}</span>
              </button>
            </div>
          </div>
        )}

        {/* HTTP Mixed-Content Warning Box */}
        {isHttp && (
          <div className="mt-4 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
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
              className="min-h-[40px] px-3.5 py-1.5 rounded-full bg-amber-600 hover:bg-amber-500 text-white font-semibold whitespace-nowrap transition-colors"
            >
              {t.player.tryHttps}
            </button>
          </div>
        )}

        {/* Main Transport Controls */}
        <div className="flex items-center justify-center gap-6 my-6">
          <button
            type="button"
            onClick={playPreviousStation}
            aria-label={t.player.prevStation}
            className="min-w-[52px] min-h-[52px] rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 flex items-center justify-center text-slate-800 dark:text-zinc-200 transition-colors"
          >
            <SkipBack className="w-6 h-6" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => playStation(currentStation)}
            aria-label={format(isPlaying ? t.player.pause : t.player.play, {
              name: currentStation.name,
            })}
            className="w-16 h-16 rounded-full bg-brand-700 hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500 text-white flex items-center justify-center shadow-lg transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-8 h-8 animate-spin" aria-hidden="true" />
            ) : isPlaying ? (
              <Pause className="w-8 h-8 fill-current" aria-hidden="true" />
            ) : (
              <Play className="w-8 h-8 fill-current ml-0.5" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={playNextAvailableStation}
            aria-label={t.player.nextStation}
            className="min-w-[52px] min-h-[52px] rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 flex items-center justify-center text-slate-800 dark:text-zinc-200 transition-colors"
          >
            <SkipForward className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        {/* Volume Slider */}
        <div className="flex items-center gap-3 px-2 py-2 rounded-full bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/70 dark:border-zinc-800/70">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? t.player.unmute : t.player.mute}
            className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-slate-700 dark:text-zinc-300 hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition-colors"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Volume2 className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
          <div className="flex-1 pr-3 flex items-center">
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
        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-zinc-800 space-y-3">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200/60 dark:border-zinc-800/60">
              <span className="text-slate-500 dark:text-zinc-400 block">
                {t.player.codec}
              </span>
              <span className="font-semibold text-slate-900 dark:text-zinc-100 mt-0.5 block">
                {currentStation.codec || 'MP3'}
                {currentStation.hls === 1 ? ' (HLS)' : ''}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200/60 dark:border-zinc-800/60">
              <span className="text-slate-500 dark:text-zinc-400 block">
                {t.player.bitrate}
              </span>
              <span className="font-semibold text-slate-900 dark:text-zinc-100 mt-0.5 block">
                {currentStation.bitrate > 0
                  ? `${currentStation.bitrate} kbps`
                  : 'Auto'}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950/50 border border-slate-200/60 dark:border-zinc-800/60">
              <span className="text-slate-500 dark:text-zinc-400 block">
                {t.player.votes}
              </span>
              <span className="font-semibold text-slate-900 dark:text-zinc-100 mt-0.5 block">
                {currentStation.votes.toLocaleString()}
              </span>
            </div>
          </div>

          {currentStation.homepage && (
            <div className="text-center pt-1">
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
        </div>
      </div>
    </dialog>
  );
};

