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
        className={`group relative flex items-start gap-3.5 p-3.5 rounded-2xl border transition-all duration-200 ${
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
          className="flex-1 min-w-0 flex items-start gap-3.5 text-left rounded-xl focus-visible:outline-2"
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
              <Play className="w-6 h-6 fill-current ml-0.5" />
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3
                className={`text-base font-semibold truncate ${
                  isCurrent
                    ? 'text-brand-800 dark:text-brand-300'
                    : 'text-slate-900 dark:text-zinc-100'
                }`}
              >
                {channel.name}
              </h3>
            </div>

            {/* Single-row Category + Country + Resolution badges */}
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-600 dark:text-zinc-400 overflow-hidden">
              {categories.slice(0, 1).map((cat) => (
                <span
                  key={cat}
                  className="inline-block px-2 py-0.5 text-[11px] font-medium rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 truncate max-w-[110px] shrink-0"
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

              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-800 dark:text-brand-300 text-[11px] font-semibold shrink-0">
                <Tv className="w-3 h-3" aria-hidden="true" />
                {channel.resolution || 'LIVE'}
              </span>
            </div>

            {/* Live EPG Guide (Current & Next Programme) — Prominent & Larger */}
            {epg?.now && (
              <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50/95 dark:bg-zinc-800/65 border border-slate-200/90 dark:border-zinc-700/70 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold uppercase tracking-wide shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    EPG ACUM
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-700 dark:text-zinc-200 font-bold tabular-nums shrink-0">
                    <Clock className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                    {formatEpgTime(epg.now.start)} – {formatEpgTime(epg.now.stop)}
                  </span>
                </div>

                <p
                  className="text-sm sm:text-[15px] font-bold text-slate-900 dark:text-white leading-snug line-clamp-2"
                  title={epg.now.title}
                >
                  {epg.now.title}
                </p>

                {/* Progress Bar + Time Remaining */}
                <div className="space-y-1 pt-0.5">
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-zinc-700 overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-brand-600 to-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${epgStats.progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-600 dark:text-zinc-300 tabular-nums">
                      {epgStats.elapsedMin} / {epgStats.totalMin} min ({epgStats.progress}%)
                    </span>
                    <span className="font-bold text-brand-700 dark:text-brand-300 tabular-nums">
                      ⏳ {epgStats.remainingShort}
                    </span>
                  </div>
                </div>

                {epg.next && (
                  <p
                    className="pt-1 border-t border-slate-200/70 dark:border-zinc-700/60 text-xs text-slate-600 dark:text-zinc-300 truncate"
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

        {/* Favorite Heart button (44x44px minimum touch target) */}
        <button
          type="button"
          onClick={handleFavoriteClick}
          aria-pressed={isFavorite}
          aria-label={format(
            isFavorite ? t.favorites.removeFav : t.favorites.addFav,
            { name: channel.name }
          )}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-colors ${
            isFavorite
              ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/70'
          }`}
        >
          <Heart
            aria-hidden="true"
            className={`w-5 h-5 transition-transform duration-150 ${
              isFavorite ? 'fill-current scale-110' : ''
            }`}
          />
        </button>
      </article>
    );
  }
);

TvChannelCard.displayName = 'TvChannelCard';

