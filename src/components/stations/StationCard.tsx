import React from 'react';
import { Heart, Play, Pause, Loader2, ShieldAlert, Disc3 } from 'lucide-react';
import { Station } from '../../types/radio';
import { useRadioStore } from '../../store/useRadioStore';
import { StationAvatar } from '../common/StationAvatar';
import { useTranslation } from '../../i18n/useTranslation';
import { isInsecureHttpStream } from '../../services/radioBrowserApi';
import {
  getCountryFlagEmoji,
  getLocalizedCountryName,
} from '../../services/geoLanguageService';
import { resolveDisplayTrack } from '../../utils/cleanTrackMetadata';

interface StationCardProps {
  station: Station;
  queue?: Station[];
  isDeferred?: boolean;
}

export const StationCard: React.FC<StationCardProps> = React.memo(
  ({ station, queue, isDeferred = false }) => {
    const { t, language, format } = useTranslation();

    const isCurrent = useRadioStore(
      (state) => state.currentStation?.stationuuid === station.stationuuid
    );
    const playerStatus = useRadioStore((state) =>
      state.currentStation?.stationuuid === station.stationuuid
        ? state.playerStatus
        : 'idle'
    );
    const nowPlayingMeta = useRadioStore((state) =>
      state.currentStation?.stationuuid === station.stationuuid
        ? state.nowPlayingMeta
        : null
    );
    const favorites = useRadioStore((state) => state.favorites);
    const playStation = useRadioStore((state) => state.playStation);
    const toggleFavorite = useRadioStore((state) => state.toggleFavorite);

    const isPlaying = isCurrent && playerStatus === 'playing';
    const isLoading = isCurrent && playerStatus === 'loading';
    const isFavorite = favorites.some(
      (f) => f.stationuuid === station.stationuuid
    );

    const tags = station.tags
      ? station.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];

    const streamUrl = station.url_resolved || station.url;
    const isHttp = isInsecureHttpStream(streamUrl);

    const displayTrack =
      isCurrent && nowPlayingMeta
        ? resolveDisplayTrack(nowPlayingMeta, null, station.name)
        : null;

    const handlePlayClick = () => {
      playStation(station, queue);
    };

    const handleFavoriteClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleFavorite(station);
    };

    return (
      <article
        className={`group relative flex items-center gap-2.5 sm:gap-3.5 p-2.5 sm:p-3.5 rounded-2xl border transition-all duration-200 ${
          isDeferred ? 'station-card-deferred' : ''
        } ${
          isCurrent
            ? 'bg-brand-50/90 dark:bg-brand-950/35 border-brand-500/70 dark:border-brand-500/60 shadow-sm'
            : 'bg-white dark:bg-zinc-900/80 border-slate-200/80 dark:border-zinc-800/80 hover:border-brand-400/60 dark:hover:border-brand-700/70 hover:shadow-md'
        }`}
      >
        {/* Primary Play Button wrapping avatar + info for ergonomic mobile tap */}
        <button
          type="button"
          onClick={handlePlayClick}
          aria-label={format(isPlaying ? t.player.pause : t.player.play, {
            name: station.name,
          })}
          className="flex-1 min-w-0 flex items-center gap-2.5 sm:gap-3.5 text-left rounded-xl focus-visible:outline-2"
        >
          <div className="relative flex-shrink-0">
            <StationAvatar
              name={station.name}
              favicon={station.favicon}
              homepage={station.homepage}
              size="md"
              isPlaying={isPlaying}
            />
            <span
              aria-hidden="true"
              className={`absolute inset-0 rounded-xl flex items-center justify-center transition-opacity duration-150 ${
                isLoading
                  ? 'opacity-100 bg-brand-950/65 text-white'
                  : isPlaying
                    ? 'opacity-0 group-hover:opacity-100 bg-brand-950/70 text-white'
                    : 'opacity-0 group-hover:opacity-100 bg-slate-900/60 text-white'
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
              ) : (
                <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current ml-0.5" />
              )}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3
                className={`text-sm sm:text-base font-semibold truncate ${
                  isCurrent
                    ? 'text-brand-800 dark:text-brand-300'
                    : 'text-slate-900 dark:text-zinc-100'
                }`}
              >
                {station.name}
              </h3>
            </div>

            {/* Live Now Playing Song + Artist Avatar (when this station is active) */}
            {isCurrent && displayTrack ? (
              <div className="mt-1 flex items-center gap-1.5 px-2 py-0.5 sm:py-1 rounded-lg bg-brand-100/80 dark:bg-brand-900/40 border border-brand-300/60 dark:border-brand-700/50">
                {displayTrack.coverUrl || displayTrack.artistAvatarUrl ? (
                  <img
                    src={
                      displayTrack.coverUrl ||
                      displayTrack.artistAvatarUrl ||
                      undefined
                    }
                    alt={displayTrack.artist || displayTrack.title}
                    className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover flex-shrink-0 ring-1 ring-brand-500/50"
                  />
                ) : (
                  <Disc3
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-600 dark:text-brand-400 flex-shrink-0 ${
                      isPlaying ? 'animate-spin' : ''
                    }`}
                  />
                )}
                <p className="text-xs font-semibold text-brand-900 dark:text-brand-200 truncate">
                  {displayTrack.artist
                    ? `${displayTrack.artist} — ${displayTrack.title}`
                    : displayTrack.title}
                </p>
              </div>
            ) : (
              /* Desktop Genre / Tags row (merged into single metadata line on mobile to save vertical space) */
              <div className="hidden sm:flex flex-wrap items-center gap-1.5 mt-1">
                {tags.length > 0 ? (
                  tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-block px-2 py-0.5 text-xs font-medium rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 truncate max-w-[110px]"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                    radio
                  </span>
                )}
              </div>
            )}

            {/* Technical quality + Genre badges (Single compact row on mobile) */}
            <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1.5 text-[11px] sm:text-xs text-slate-600 dark:text-zinc-400 overflow-hidden">
              {station.countrycode && (
                <span
                  title={station.country || station.countrycode}
                  className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-zinc-300 truncate max-w-[105px] sm:max-w-[130px] shrink-0"
                >
                  <span aria-hidden="true">
                    {getCountryFlagEmoji(station.countrycode)}
                  </span>
                  <span className="truncate">
                    {getLocalizedCountryName(
                      station.countrycode,
                      station.country || station.countrycode,
                      language
                    )}
                  </span>
                </span>
              )}
              {tags[0] && (
                <span className="sm:hidden inline-block px-1.5 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-medium truncate max-w-[85px]">
                  {tags[0]}
                </span>
              )}
              {station.bitrate > 0 && (
                <span className="font-medium shrink-0">{station.bitrate}k</span>
              )}
              {station.codec && (
                <span className="uppercase shrink-0">{station.codec}</span>
              )}
              {station.hls === 1 && (
                <span className="px-1.5 py-0.2 rounded bg-brand-100 dark:bg-brand-950 text-brand-800 dark:text-brand-300 font-semibold shrink-0">
                  HLS
                </span>
              )}
              {isHttp && (
                <span
                  title={t.player.httpWarningTitle}
                  className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400 font-medium shrink-0"
                >
                  <ShieldAlert className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
                  <span className="hidden xs:inline">HTTP</span>
                </span>
              )}
            </div>
          </div>
        </button>

        {/* Dedicated Favorite Heart button */}
        <button
          type="button"
          onClick={handleFavoriteClick}
          aria-pressed={isFavorite}
          aria-label={format(
            isFavorite ? t.favorites.removeFav : t.favorites.addFav,
            { name: station.name }
          )}
          className={`w-9 h-9 sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center rounded-full shrink-0 transition-colors ${
            isFavorite
              ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/70'
          }`}
        >
          <Heart
            aria-hidden="true"
            className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-150 ${
              isFavorite ? 'fill-current scale-110' : ''
            }`}
          />
        </button>
      </article>
    );
  }
);

StationCard.displayName = 'StationCard';

