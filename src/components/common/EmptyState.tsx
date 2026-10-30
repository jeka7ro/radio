import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 rounded-2xl border border-dashed border-slate-300 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40">
      <div
        aria-hidden="true"
        className="w-14 h-14 rounded-2xl bg-brand-100 dark:bg-brand-950/70 text-brand-700 dark:text-brand-300 flex items-center justify-center mb-4"
      >
        {icon}
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100 mb-1.5">
        {title}
      </h3>
      <p className="text-sm text-slate-600 dark:text-zinc-400 max-w-md mb-5">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="min-h-[44px] px-6 py-2.5 rounded-full bg-brand-700 hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500 text-white text-sm font-medium transition-colors shadow-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

