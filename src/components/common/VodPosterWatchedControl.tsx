import React from 'react';
import { Check } from 'lucide-react';
import {
  type CinemetaItem,
  type SeriesEpisodeStats,
  type VodWatchProgressEntry,
  getSeriesWatchedEpisodesCount,
  isVodEntryWatched,
} from '../../views/smartTvLampaHelpers';

export interface VodPosterWatchedControlProps {
  item: CinemetaItem;
  entry?: VodWatchProgressEntry;
  stats?: SeriesEpisodeStats | null;
  onToggleWatched?: (
    item: CinemetaItem,
    season?: number,
    episode?: number,
    options?: { wholeSeries?: boolean }
  ) => void;
  tr: (ro: string, en: string, ru: string) => string;
  positionClass?: string;
}

export const VodPosterWatchedControl: React.FC<VodPosterWatchedControlProps> = ({
  item,
  entry,
  stats,
  onToggleWatched,
  tr,
  positionClass = 'bottom-2.5 left-2.5',
}) => {
  if (!onToggleWatched) return null;
  const watched = isVodEntryWatched(entry, stats);
  const watchedEps =
    item.type === 'series' ? getSeriesWatchedEpisodesCount(entry) : 0;

  const handleTrigger = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleWatched(item, undefined, undefined, {
      wholeSeries: item.type === 'series',
    });
  };

  if (watched) {
    return (
      <span
        role="button"
        tabIndex={-1}
        data-watched-toggle-btn="true"
        aria-label={tr(
          'Văzut (apasă pentru a anula)',
          'Watched (click to unmark)',
          'Просмотрено (нажмите, чтобы снять)'
        )}
        title={tr(
          'Marcat ca văzut (apasă pentru a anula)',
          'Marked as watched (click to unmark)',
          'Просмотрено (нажмите, чтобы снять)'
        )}
        onClick={handleTrigger}
        className={`absolute ${positionClass} z-20 w-7 h-7 rounded-full bg-emerald-600/95 hover:bg-emerald-500 text-white border border-emerald-300/70 shadow-lg inline-flex items-center justify-center opacity-100 transition-all cursor-pointer`}
      >
        <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
      </span>
    );
  }

  if (watchedEps > 0) {
    return (
      <span
        role="button"
        tabIndex={-1}
        data-watched-toggle-btn="true"
        title={tr(
          `${watchedEps} ep. văzute — apasă pentru a marca tot serialul`,
          `${watchedEps} ep. watched — click to mark entire series`,
          `Просмотрено ${watchedEps} сер. — отметить весь сериал`
        )}
        onClick={handleTrigger}
        className={`absolute ${positionClass} z-20 px-2 py-1 rounded-full bg-[#0d1f38]/92 hover:bg-emerald-600 text-sky-200 hover:text-white border border-sky-400/45 text-[10px] font-extrabold shadow-lg inline-flex items-center gap-1 opacity-100 transition-all cursor-pointer`}
      >
        <Check className="w-3 h-3" />
        <span>{watchedEps} ep.</span>
      </span>
    );
  }

  return (
    <span
      role="button"
      tabIndex={-1}
      data-watched-toggle-btn="true"
      title={tr(
        'Marchează ca văzut',
        'Mark as watched',
        'Отметить просмотренным'
      )}
      onClick={handleTrigger}
      className={`absolute ${positionClass} z-20 p-2 rounded-full backdrop-blur-md bg-black/60 hover:bg-emerald-600 text-zinc-300 hover:text-white border border-white/20 opacity-0 group-hover:opacity-100 group-focus:opacity-100 focus:opacity-100 max-md:opacity-85 transition-all cursor-pointer shadow-lg inline-flex items-center justify-center`}
    >
      <Check className="w-3.5 h-3.5" />
    </span>
  );
};
