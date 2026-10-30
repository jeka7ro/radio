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
      className="flex items-center gap-2 overflow-x-auto pb-2 pt-0.5 no-scrollbar"
    >
      <button
        type="button"
        onClick={() => onSelectTag('')}
        aria-pressed={selectedTag === ''}
        className={`min-h-[44px] px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
          selectedTag === ''
            ? 'bg-brand-700 text-white dark:bg-brand-600 dark:text-white shadow-sm'
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
            className={`min-h-[44px] px-4 py-2 rounded-full text-sm font-medium capitalize whitespace-nowrap transition-colors ${
              isActive
                ? 'bg-brand-700 text-white dark:bg-brand-600 dark:text-white shadow-sm'
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

