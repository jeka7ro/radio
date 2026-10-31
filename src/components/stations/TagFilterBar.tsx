import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';

interface TagFilterBarProps {
  tags: string[];
  selectedTag: string;
  onSelectTag: (tag: string) => void;
}

export const TagFilterBar: React.FC<TagFilterBarProps> = ({
  tags,
  selectedTag,
  onSelectTag,
}) => {
  const { t } = useTranslation();

  if (tags.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={t.home.filterByGenre}
      className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 no-scrollbar"
    >
      <button
        type="button"
        onClick={() => onSelectTag('')}
        aria-pressed={selectedTag === ''}
        className={`min-h-[30px] sm:min-h-[36px] px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
          selectedTag === ''
            ? 'bg-brand-700 text-white dark:bg-brand-600 dark:text-white shadow-xs'
            : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800'
        }`}
      >
        {t.home.allGenres}
      </button>

      {tags.map((tag) => {
        const isActive = selectedTag === tag;
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onSelectTag(isActive ? '' : tag)}
            aria-pressed={isActive}
            className={`min-h-[30px] sm:min-h-[36px] px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap transition-colors ${
              isActive
                ? 'bg-brand-700 text-white dark:bg-brand-600 dark:text-white shadow-xs'
                : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
};

