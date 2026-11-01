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
  Maximize2,
  X,
} from 'lucide-react';
import { useRadioStore } from '../../store/useRadioStore';
import { useTranslation } from '../../i18n/useTranslation';
import { StationAvatar } from '../common/StationAvatar';
import { MAX_AUTO_RETRIES } from '../../hooks/useAudioPlayer';
import { toggleRadioPip } from './RadioPipPlayer';
import { parseRawStreamMetadata } from '../../utils/cleanTrackMetadata';

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

  // Ensure track title & artist are always cleanly formatted (never raw ~ or ISRC strings)
  const displayTrack = React.useMemo(() => {
    if (nowPlayingMeta) {
      if (nowPlayingMeta.title.includes('~')) {
        const parsed = parseRawStreamMetadata(
          nowPlayingMeta.rawTitle || nowPlayingMeta.title,
          currentStation.name
        );
        if (parsed && parsed.title) {
          return {
            title: parsed.title,
            artist: parsed.artist || nowPlayingMeta.artist || currentStation.name,
            album: parsed.album || nowPlayingMeta.album,
            coverUrl: nowPlayingMeta.coverUrl || nowPlayingMeta.artistAvatarUrl,
            artistAvatarUrl:
              nowPlayingMeta.artistAvatarUrl || nowPlayingMeta.coverUrl,
          };
        }
      }
      return {
        title: nowPlayingMeta.title,
        artist: nowPlayingMeta.artist || currentStation.name,
        album: nowPlayingMeta.album,
        coverUrl: nowPlayingMeta.coverUrl || nowPlayingMeta.artistAvatarUrl,
        artistAvatarUrl:
          nowPlayingMeta.artistAvatarUrl || nowPlayingMeta.coverUrl,
      };
    }

    if (nowPlayingTitle) {
      const parsed = parseRawStreamMetadata(nowPlayingTitle, currentStation.name);
      if (parsed && parsed.title) {
        return {
          title: parsed.title,
          artist: parsed.artist || currentStation.name,
          album: parsed.album,
          coverUrl: undefined,
          artistAvatarUrl: undefined,
        };
      }
    }

    return null;
  }, [nowPlayingMeta, nowPlayingTitle, currentStation.name]);

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
    if (displayTrack) {
      return displayTrack.artist
        ? `${displayTrack.artist} — ${displayTrack.title}`
        : displayTrack.title;
    }
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

  const handleOpenNormalPlayer = async () => {
    if (isRadioPipOpen) {
      await toggleRadioPip();
    }
    setExpandedPlayerOpen(true);
  };

  return (
    <div
      role="region"
      aria-label={t.player.nowPlaying}
      className="w-full bg-white dark:bg-zinc-900 border-t-2 border-brand-500/30 dark:border-brand-500/40 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.55)]"
    >
      {/* Error recovery strip when stream fails */}
      {isError && (
        <div
          role="alert"
          className="px-3 sm:px-4 py-1.5 bg-rose-600 text-white text-xs flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex items-center gap-1.5 font-medium min-w-0">
            <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">
              {t.player.error} — <strong>{currentStation.name}</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => triggerStreamReload()}
              className="min-h-[30px] px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white font-semibold inline-flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3 h-3" aria-hidden="true" />
              <span>{t.player.retryStream}</span>
            </button>
            <button
              type="button"
              onClick={playNextAvailableStation}
              className="min-h-[30px] px-2.5 py-1 rounded-full bg-white text-rose-700 hover:bg-rose-50 font-semibold inline-flex items-center gap-1 transition-colors"
            >
              <SkipForward className="w-3 h-3" aria-hidden="true" />
              <span>{t.player.tryAnother}</span>
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-3">
        {/* Station & Live Track Info — Click to open Expanded Player */}
        <button
          type="button"
          onClick={() => void handleOpenNormalPlayer()}
          aria-label={`${t.player.expandPlayer}: ${currentStation.name}`}
          className="flex-1 min-w-0 flex items-center gap-2.5 sm:gap-3 text-left py-1 pr-1 rounded-xl hover:bg-slate-100/70 dark:hover:bg-zinc-800/50 transition-colors"
        >
          <div className="relative flex-shrink-0">
            {displayTrack?.coverUrl ? (
              <div className="relative w-11 h-11 sm:w-14 sm:h-14 rounded-xl overflow-hidden shadow-md border border-slate-200 dark:border-zinc-700 bg-zinc-900">
                <img
                  src={displayTrack.coverUrl}
                  alt={displayTrack.title}
                  className="w-full h-full object-cover"
                />
                {isPlaying && (
                  <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/75 backdrop-blur-sm flex items-end justify-center gap-0.5 shadow-sm">
                    <span className="eq-bar w-0.5 bg-emerald-400 rounded-full h-2" />
                    <span className="eq-bar eq-bar-2 w-0.5 bg-emerald-400 rounded-full h-3" />
                    <span className="eq-bar eq-bar-3 w-0.5 bg-emerald-400 rounded-full h-2.5" />
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
            {displayTrack && !isError && !isLoading ? (
              <>
                <div className="flex items-center gap-2">
                  <p className="text-xs sm:text-base font-bold text-slate-900 dark:text-zinc-100 truncate">
                    {displayTrack.title}
                  </p>
                  <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-brand-100 dark:bg-brand-950 text-brand-800 dark:text-brand-300 border border-brand-200/80 dark:border-brand-800/70 truncate max-w-[170px] shrink-0">
                    {currentStation.name}
                  </span>
                  <ChevronUp
                    aria-hidden="true"
                    className="w-4 h-4 text-slate-400 dark:text-zinc-500 flex-shrink-0"
                  />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                  {displayTrack.artistAvatarUrl && (
                    <img
                      src={displayTrack.artistAvatarUrl}
                      alt={displayTrack.artist}
                      className="w-4 h-4 sm:w-[18px] sm:h-[18px] rounded-full object-cover flex-shrink-0 ring-1 ring-brand-500/60"
                    />
                  )}
                  <p className="text-[11px] sm:text-xs font-semibold text-brand-700 dark:text-brand-400 truncate">
                    {displayTrack.artist}
                    {displayTrack.album ? (
                      <span className="font-normal text-slate-500 dark:text-zinc-400">
                        {` • ${displayTrack.album}`}
                      </span>
                    ) : null}
                    <span className="sm:hidden font-normal text-slate-500 dark:text-zinc-400">
                      {` • ${currentStation.name}`}
                    </span>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs sm:text-base font-semibold text-slate-900 dark:text-zinc-100 truncate">
                    {currentStation.name}
                  </p>
                  <ChevronUp
                    aria-hidden="true"
                    className="w-4 h-4 text-slate-400 dark:text-zinc-500 flex-shrink-0"
                  />
                </div>
                <p
                  className={`text-[11px] sm:text-xs truncate mt-0.5 ${
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
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={playPreviousStation}
            aria-label={t.player.prevStation}
            className="hidden sm:flex min-w-[40px] min-h-[40px] items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => playStation(currentStation)}
            aria-label={format(isPlaying ? t.player.pause : t.player.play, {
              name: currentStation.name,
            })}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-brand-700 hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500 text-white flex items-center justify-center shadow-md shrink-0 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" aria-hidden="true" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-current" aria-hidden="true" />
            ) : (
              <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current ml-0.5" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={playNextAvailableStation}
            aria-label={t.player.nextStation}
            className="w-9 h-9 sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => toggleFavorite(currentStation)}
            aria-pressed={isFavorite}
            aria-label={format(
              isFavorite ? t.favorites.removeFav : t.favorites.addFav,
              { name: currentStation.name }
            )}
            className={`w-9 h-9 sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center rounded-full transition-colors ${
              isFavorite
                ? 'text-rose-600 dark:text-rose-400 bg-rose-100/90 dark:bg-rose-950/60'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
            }`}
          >
            <Heart
              aria-hidden="true"
              className={`w-4 h-4 sm:w-5 sm:h-5 ${isFavorite ? 'fill-current' : ''}`}
            />
          </button>

          <button
            type="button"
            onClick={() => void toggleRadioPip()}
            aria-pressed={isRadioPipOpen}
            title="MiniPlayer Picture-in-Picture (fereastră flotantă)"
            aria-label="MiniPlayer Picture-in-Picture"
            className={`hidden sm:flex min-w-[40px] min-h-[40px] items-center justify-center rounded-full transition-colors ${
              isRadioPipOpen
                ? 'text-brand-700 dark:text-brand-300 bg-brand-100 dark:bg-brand-950/80 ring-1 ring-brand-500/40'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
            }`}
          >
            <PictureInPicture2 className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => void handleOpenNormalPlayer()}
            title="Deschide în playerul normal"
            aria-label={t.player.expandPlayer}
            className="w-9 h-9 sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center rounded-full bg-brand-100/90 dark:bg-brand-950/70 text-brand-700 dark:text-brand-300 hover:bg-brand-200 dark:hover:bg-brand-900/80 transition-colors"
          >
            <Maximize2 className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={stopRadio}
            title="Închide playerul radio"
            aria-label="Închide playerul radio"
            className="w-8 h-8 sm:min-w-[38px] sm:min-h-[38px] flex items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
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
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
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

