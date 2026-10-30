import React, { useId } from 'react';
import {
  Play,
  Pause,
  Loader2,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Heart,
  ChevronUp,
  AlertCircle,
  RefreshCw,
  PictureInPicture2,
  X,
} from 'lucide-react';
import { useRadioStore } from '../../store/useRadioStore';
import { useTranslation } from '../../i18n/useTranslation';
import { StationAvatar } from '../common/StationAvatar';
import { MAX_AUTO_RETRIES } from '../../hooks/useAudioPlayer';
import { toggleRadioPip } from './RadioPipPlayer';

export const MiniPlayer: React.FC = () => {
  const { t, format } = useTranslation();
  const volumeSliderId = useId();

  const currentStation = useRadioStore((state) => state.currentStation);
  const currentTvChannel = useRadioStore((state) => state.currentTvChannel);
  const activeTab = useRadioStore((state) => state.activeTab);
  const playerStatus = useRadioStore((state) => state.playerStatus);
  const retryAttempt = useRadioStore((state) => state.retryAttempt);
  const nowPlayingTitle = useRadioStore((state) => state.nowPlayingTitle);
  const nowPlayingMeta = useRadioStore((state) => state.nowPlayingMeta);
  const volume = useRadioStore((state) => state.volume);
  const isMuted = useRadioStore((state) => state.isMuted);
  const favorites = useRadioStore((state) => state.favorites);
  const isRadioPipOpen = useRadioStore((state) => state.isRadioPipOpen);

  const playStation = useRadioStore((state) => state.playStation);
  const stopRadio = useRadioStore((state) => state.stopRadio);
  const triggerStreamReload = useRadioStore((state) => state.triggerStreamReload);
  const playNextAvailableStation = useRadioStore(
    (state) => state.playNextAvailableStation
  );
  const playPreviousStation = useRadioStore(
    (state) => state.playPreviousStation
  );
  const setVolume = useRadioStore((state) => state.setVolume);
  const toggleMute = useRadioStore((state) => state.toggleMute);
  const toggleFavorite = useRadioStore((state) => state.toggleFavorite);
  const setExpandedPlayerOpen = useRadioStore(
    (state) => state.setExpandedPlayerOpen
  );

  if (!currentStation || currentTvChannel) return null;
  if (
    activeTab === 'tv' &&
    playerStatus !== 'playing' &&
    playerStatus !== 'loading'
  ) {
    return null;
  }

  const isPlaying = playerStatus === 'playing';
  const isLoading = playerStatus === 'loading';
  const isError = playerStatus === 'error';
  const isFavorite = favorites.some(
    (f) => f.stationuuid === currentStation.stationuuid
  );

  const statusSubtitle = () => {
    if (isError) return t.player.error;
    if (isLoading) {
      return retryAttempt > 0
        ? format(t.player.retrying, {
            attempt: retryAttempt,
            max: MAX_AUTO_RETRIES,
          })
        : t.player.loading;
    }
    if (playerStatus === 'paused') return t.player.paused;
    if (nowPlayingTitle) return nowPlayingTitle;
    const tagList = currentStation.tags
      ? currentStation.tags
          .split(',')
          .slice(0, 2)
          .map((tag) => tag.trim())
          .filter(Boolean)
          .join(' • ')
      : '';
    return tagList
      ? `${t.player.playing} • ${tagList}`
      : t.player.playing;
  };

  const effectiveVolumePercent = Math.round((isMuted ? 0 : volume) * 100);

  return (
    <div
      role="region"
      aria-label={t.player.nowPlaying}
      className="fixed bottom-[57px] lg:bottom-0 inset-x-0 lg:left-64 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border-t border-slate-200/90 dark:border-zinc-800/90 shadow-lg"
    >
      {/* Error recovery strip when stream fails */}
      {isError && (
        <div
          role="alert"
          className="px-4 py-2 bg-rose-600 text-white text-xs sm:text-sm flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>
              {t.player.error} — <strong>{currentStation.name}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => triggerStreamReload()}
              className="min-h-[34px] px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.player.retryStream}</span>
            </button>
            <button
              type="button"
              onClick={playNextAvailableStation}
              className="min-h-[34px] px-3 py-1 rounded-lg bg-white text-rose-700 hover:bg-rose-50 font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.player.tryAnother}</span>
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-20 flex items-center justify-between gap-3">
        {/* Station & Live Track Info — Click to open Expanded Player */}
        <button
          type="button"
          onClick={() => setExpandedPlayerOpen(true)}
          aria-label={`${t.player.expandPlayer}: ${currentStation.name}`}
          className="flex-1 min-w-0 flex items-center gap-3 text-left py-1.5 pr-2 rounded-xl hover:bg-slate-100/70 dark:hover:bg-zinc-800/50 transition-colors"
        >
          <div className="relative flex-shrink-0">
            {nowPlayingMeta?.coverUrl ? (
              <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-md border border-slate-200/80 dark:border-zinc-700/80 bg-zinc-900">
                <img
                  src={nowPlayingMeta.coverUrl}
                  alt={nowPlayingMeta.title}
                  className="w-full h-full object-cover"
                />
                {isPlaying && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center gap-0.5">
                    <span className="eq-bar w-0.5 bg-white rounded-full h-2.5" />
                    <span className="eq-bar eq-bar-2 w-0.5 bg-white rounded-full h-4" />
                    <span className="eq-bar eq-bar-3 w-0.5 bg-white rounded-full h-3" />
                  </div>
                )}
              </div>
            ) : (
              <StationAvatar
                name={currentStation.name}
                favicon={currentStation.favicon}
                homepage={currentStation.homepage}
                size="sm"
                isPlaying={isPlaying}
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            {nowPlayingMeta && !isError && !isLoading ? (
              <>
                <div className="flex items-center gap-2">
                  <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100 truncate">
                    {nowPlayingMeta.title}
                  </p>
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-brand-100 dark:bg-brand-950/80 text-brand-800 dark:text-brand-300 truncate max-w-[160px]">
                    {currentStation.name}
                  </span>
                  <ChevronUp
                    aria-hidden="true"
                    className="w-4 h-4 text-slate-400 dark:text-zinc-500 flex-shrink-0 lg:hidden"
                  />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                  {nowPlayingMeta.artistAvatarUrl && (
                    <img
                      src={nowPlayingMeta.artistAvatarUrl}
                      alt={nowPlayingMeta.artist}
                      className="w-4 h-4 rounded-full object-cover flex-shrink-0 ring-1 ring-brand-500/50"
                    />
                  )}
                  <p className="text-xs font-medium text-brand-700 dark:text-brand-400 truncate">
                    {nowPlayingMeta.artist || currentStation.name}
                    {nowPlayingMeta.album ? ` • ${nowPlayingMeta.album}` : ''}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-zinc-100 truncate">
                    {currentStation.name}
                  </p>
                  <ChevronUp
                    aria-hidden="true"
                    className="w-4 h-4 text-slate-400 dark:text-zinc-500 flex-shrink-0 lg:hidden"
                  />
                </div>
                <p
                  className={`text-xs truncate mt-0.5 ${
                    isError
                      ? 'text-rose-600 dark:text-rose-400 font-medium'
                      : isPlaying
                        ? 'text-brand-700 dark:text-brand-400 font-medium'
                        : 'text-slate-600 dark:text-zinc-400'
                  }`}
                >
                  {statusSubtitle()}
                </p>
              </>
            )}
          </div>
        </button>

        {/* Center Playback Controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={playPreviousStation}
            aria-label={t.player.prevStation}
            className="hidden sm:flex min-w-[44px] min-h-[44px] items-center justify-center rounded-full text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <SkipBack className="w-5 h-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => playStation(currentStation)}
            aria-label={format(isPlaying ? t.player.pause : t.player.play, {
              name: currentStation.name,
            })}
            className="min-w-[48px] min-h-[48px] rounded-full bg-brand-700 hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500 text-white flex items-center justify-center shadow-md transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
            ) : isPlaying ? (
              <Pause className="w-6 h-6 fill-current" aria-hidden="true" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-0.5" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={playNextAvailableStation}
            aria-label={t.player.nextStation}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <SkipForward className="w-5 h-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => toggleFavorite(currentStation)}
            aria-pressed={isFavorite}
            aria-label={format(
              isFavorite ? t.favorites.removeFav : t.favorites.addFav,
              { name: currentStation.name }
            )}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-colors ${
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

          <button
            type="button"
            onClick={() => void toggleRadioPip()}
            aria-pressed={isRadioPipOpen}
            title="MiniPlayer Picture-in-Picture (fereastră flotantă)"
            aria-label="MiniPlayer Picture-in-Picture"
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-colors ${
              isRadioPipOpen
                ? 'text-brand-700 dark:text-brand-300 bg-brand-100 dark:bg-brand-950/70 ring-1 ring-brand-500/40'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            <PictureInPicture2 className="w-5 h-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={stopRadio}
            title="Închide playerul radio"
            aria-label="Închide playerul radio"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full text-slate-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Right Desktop Volume & Expand Controls */}
        <div className="hidden md:flex items-center gap-2.5 w-44">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? t.player.unmute : t.player.mute}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Volume2 className="w-5 h-5" aria-hidden="true" />
            )}
          </button>

          <div className="flex-1 flex items-center">
            <label htmlFor={volumeSliderId} className="visually-hidden">
              {t.player.volume}
            </label>
            <input
              id={volumeSliderId}
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
        </div>
      </div>
    </div>
  );
};

