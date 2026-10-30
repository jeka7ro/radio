import React from 'react';

interface StationSkeletonProps {
  count?: number;
}

export const StationSkeleton: React.FC<StationSkeletonProps> = ({
  count = 12,
}) => {
  return (
    <div
      aria-busy="true"
      aria-live="off"
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-slate-200/70 dark:border-zinc-800/70 bg-white dark:bg-zinc-900/60"
        >
          <div className="w-14 h-14 rounded-xl bg-slate-200 dark:bg-zinc-800 skeleton-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 w-3/4 rounded-md bg-slate-200 dark:bg-zinc-800 skeleton-pulse" />
            <div className="flex gap-1.5">
              <div className="h-4 w-14 rounded-md bg-slate-200 dark:bg-zinc-800 skeleton-pulse" />
              <div className="h-4 w-16 rounded-md bg-slate-200 dark:bg-zinc-800 skeleton-pulse" />
            </div>
            <div className="h-3 w-24 rounded-md bg-slate-200 dark:bg-zinc-800 skeleton-pulse" />
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-200 dark:bg-zinc-800 skeleton-pulse flex-shrink-0" />
        </div>
      ))}
    </div>
  );
};

