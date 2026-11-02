import React from 'react';
import { Clock, Heart, Play, Tv } from 'lucide-react';
import { TvChannel } from '../../types/radio';
import { useRadioStore } from '../../store/useRadioStore';
import { StationAvatar } from '../common/StationAvatar';
import { useTranslation } from '../../i18n/useTranslation';
import {
  getCountryFlagEmoji,
  getLocalizedCountryName,
} from '../../services/geoLanguageService';
import {
  useChannelEpg,
  formatEpgTime,
  getEpgTimingStats,
} from '../../services/epgService';

interface TvChannelCardProps {
  channel: TvChannel;
  queue?: TvChannel[];
  isDeferred?: boolean;
}

export const TvChannelCard: React.FC<TvChannelCardProps> = React.memo(
  ({ channel, queue, isDeferred = false }) => {
    const { t, language, format } = useTranslation();

    const currentTvChannel = useRadioStore((state) => state.currentTvChannel);
    const favoriteTvChannels = useRadioStore(
      (state) => state.favoriteTvChannels
    );
    const playTvChannel = useRadioStore((state) => state.playTvChannel);
    const toggleFavoriteTvChannel = useRadioStore(
      (state) => state.toggleFavoriteTvChannel
    );

    const isCurrent = currentTvChannel?.id === channel.id;
    const isFavorite = favoriteTvChannels.some((c) => c.id === channel.id);
    const epg = useChannelEpg(channel);

    const effectiveLogo =
      !channel.logo || /imgur\.com|wikia\.nocookie\.net/i.test(channel.logo)
        ? epg?.icon || channel.logo
        : channel.logo;

    const epgStats = getEpgTimingStats(epg?.now);

    const categories = channel.group
      ? channel.group
          .split(';')
          .map((cat) => cat.trim())
          .map((cat) => (cat.toLowerCase() === 'undefined' ? 'General' : cat))
          .filter(Boolean)
          .slice(0, 2)
      : ['General'];

    const handleWatchClick = () => {
      playTvChannel(channel, queue);
    };

    const handleFavoriteClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleFavoriteTvChannel(channel);
    };

    return (
      <article
        className={`group relative flex items-start gap-2.5 sm:gap-3.5 p-2.5 sm:p-3.5 rounded-2xl border transition-all duration-200 ${
          isDeferred ? 'station-card-deferred' : ''
        } ${
          isCurrent
            ? 'bg-brand-50/90 dark:bg-brand-950/35 border-brand-500/70 dark:border-brand-500/60 shadow-sm'
            : 'bg-white dark:bg-zinc-900/80 border-slate-200/80 dark:border-zinc-800/80 hover:border-brand-400/60 dark:hover:border-brand-700/70 hover:shadow-md'
        }`}
      >
        <button
          type="button"
          onClick={handleWatchClick}
          aria-label={format(t.tv.watchChannel, { name: channel.name })}
          className="flex-1 min-w-0 flex items-start gap-2.5 sm:gap-3.5 text-left rounded-xl focus-visible:outline-2"
        >
          <div className="relative flex-shrink-0 mt-0.5">
            <StationAvatar
              name={channel.name}
              favicon={effectiveLogo}
              size="md"
              isPlaying={isCurrent}
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 bg-slate-900/65 text-white transition-opacity duration-150"
            >
              <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current ml-0.5" />
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
                {channel.name}
              </h3>
            </div>

            {/* Single-row Category + Country + Resolution badges */}
            <div className="flex items-center gap-1.5 mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-slate-600 dark:text-zinc-400 overflow-hidden">
              {categories.slice(0, 1).map((cat) => (
                <span
                  key={cat}
                  className="inline-block px-2 py-0.2 sm:py-0.5 text-[10px] sm:text-[11px] font-medium rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 truncate max-w-[100px] shrink-0"
                >
                  {cat}
                </span>
              ))}

              {channel.countryCode && (
                <span
                  title={channel.countryCode}
                  className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-zinc-300 truncate shrink-0"
                >
                  <span aria-hidden="true">
                    {getCountryFlagEmoji(channel.countryCode)}
                  </span>
                  <span className="truncate">
                    {getLocalizedCountryName(
                      channel.countryCode,
                      channel.countryCode,
                      language
                    )}
                  </span>
                </span>
              )}

              <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-800 dark:text-brand-300 text-[10px] sm:text-[11px] font-semibold shrink-0">
                <Tv className="w-2.5 h-2.5 sm:w-3 sm:h-3" aria-hidden="true" />
                {channel.resolution || 'LIVE'}
              </span>
            </div>

            {/* Live EPG Guide (Current & Next Programme) — Compact on mobile, rich on desktop */}
            {epg?.now && (
              <div className="mt-1.5 sm:mt-2.5 p-2 sm:p-2.5 rounded-xl bg-slate-50/95 dark:bg-zinc-800/65 border border-slate-200/90 dark:border-zinc-700/70 space-y-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 text-[10px] sm:text-xs font-extrabold uppercase tracking-wide shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    ACUM
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs text-slate-700 dark:text-zinc-200 font-bold tabular-nums shrink-0">
                    <Clock className="w-3 h-3 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                    {formatEpgTime(epg.now.start)}–{formatEpgTime(epg.now.stop)}
                  </span>
                  <span className="text-[11px] font-bold text-brand-700 dark:text-brand-300 tabular-nums shrink-0">
                    {epgStats.remainingShort}
                  </span>
                </div>

                <p
                  className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug line-clamp-1 sm:line-clamp-2"
                  title={epg.now.title}
                >
                  {epg.now.title}
                </p>

                {/* Progress Bar */}
                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-zinc-700 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-600 to-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${epgStats.progress}%` }}
                  />
                </div>

                {epg.next && (
                  <p
                    className="hidden sm:block pt-1 border-t border-slate-200/70 dark:border-zinc-700/60 text-xs text-slate-600 dark:text-zinc-300 truncate"
                    title={epg.next.title}
                  >
                    <span className="font-bold text-slate-800 dark:text-zinc-100">
                      Urmează {formatEpgTime(epg.next.start)}:
                    </span>{' '}
                    {epg.next.title}
                  </p>
                )}
              </div>
            )}
          </div>
        </button>

        {/* Favorite Heart button */}
        <button
          type="button"
          onClick={handleFavoriteClick}
          aria-pressed={isFavorite}
          aria-label={format(
            isFavorite ? t.favorites.removeFav : t.favorites.addFav,
            { name: channel.name }
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

TvChannelCard.displayName = 'TvChannelCard';

