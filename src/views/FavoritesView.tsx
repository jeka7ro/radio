import React, { useRef, useState } from 'react';
import {
  Heart,
  Download,
  Upload,
  ArrowUp,
  ArrowDown,
  GripVertical,
  CheckCircle2,
  AlertCircle,
  Radio,
  Tv,
} from 'lucide-react';
import { useRadioStore } from '../store/useRadioStore';
import { useTranslation } from '../i18n/useTranslation';
import { StationCard } from '../components/stations/StationCard';
import { TvChannelCard } from '../components/tv/TvChannelCard';
import { EmptyState } from '../components/common/EmptyState';
import { Station, TvChannel } from '../types/radio';
import {
  exportTvChannelsToM3u,
  exportRadioStationsToM3u,
  downloadM3uFile,
  parseM3uPlaylist,
} from '../services/tvApi';

export const FavoritesView: React.FC = () => {
  const { t, format } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const favorites = useRadioStore((state) => state.favorites);
  const favoriteTvChannels = useRadioStore((state) => state.favoriteTvChannels);
  const favoritesSubTab = useRadioStore((state) => state.favoritesSubTab);
  const setFavoritesSubTab = useRadioStore((state) => state.setFavoritesSubTab);
  const moveFavorite = useRadioStore((state) => state.moveFavorite);
  const moveFavoriteTvChannel = useRadioStore(
    (state) => state.moveFavoriteTvChannel
  );
  const importFavorites = useRadioStore((state) => state.importFavorites);
  const importFavoriteTvChannels = useRadioStore(
    (state) => state.importFavoriteTvChannels
  );
  const setActiveTab = useRadioStore((state) => state.setActiveTab);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedTvIndex, setDraggedTvIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const isTvMode = favoritesSubTab === 'tv';

  const handleExportJson = () => {
    const dataToExport = isTvMode ? favoriteTvChannels : favorites;
    const payload = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isTvMode
      ? `aether-tv-favorites-${new Date().toISOString().slice(0, 10)}.json`
      : `aether-radio-favorites-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportM3u = () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    if (isTvMode) {
      const m3u = exportTvChannelsToM3u(favoriteTvChannels);
      downloadM3uFile(m3u, `aether-tv-favorites-${dateStr}.m3u`);
    } else {
      const m3u = exportRadioStationsToM3u(favorites);
      downloadM3uFile(m3u, `aether-radio-favorites-${dateStr}.m3u`);
    }
  };

  const handleImportFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      if (isTvMode && (file.name.endsWith('.m3u') || file.name.endsWith('.m3u8') || text.trim().startsWith('#EXTM3U'))) {
        const parsedM3u = parseM3uPlaylist(text, 'RU', { isCustomImport: true });
        const count = importFavoriteTvChannels(parsedM3u);
        setFeedback({
          type: count > 0 ? 'success' : 'error',
          message:
            count > 0
              ? format(t.favorites.importSuccess, { count })
              : t.favorites.importError,
        });
        return;
      }
      const parsed = JSON.parse(text);
      const count = isTvMode
        ? importFavoriteTvChannels(parsed as TvChannel[])
        : importFavorites(parsed as Station[]);
      if (count > 0) {
        setFeedback({
          type: 'success',
          message: format(t.favorites.importSuccess, { count }),
        });
      } else {
        setFeedback({
          type: 'error',
          message: t.favorites.importError,
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: t.favorites.importError,
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    moveFavorite(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleTvDragStart = (index: number) => {
    setDraggedTvIndex(index);
  };

  const handleTvDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedTvIndex === null || draggedTvIndex === index) return;
    moveFavoriteTvChannel(draggedTvIndex, index);
    setDraggedTvIndex(index);
  };

  const handleTvDragEnd = () => {
    setDraggedTvIndex(null);
  };

  const activeItemsCount = isTvMode
    ? favoriteTvChannels.length
    : favorites.length;

  return (
    <section aria-labelledby="favorites-page-heading" className="space-y-3 sm:space-y-5">
      {/* Header & Separate Radio / TV Favorites Switcher — Compact on Mobile */}
      <div className="flex flex-col gap-2.5 sm:gap-3.5 bg-white dark:bg-zinc-900/90 p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-zinc-800/80">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1
              id="favorites-page-heading"
              tabIndex={-1}
              className="text-base sm:text-2xl font-bold text-slate-900 dark:text-zinc-100 truncate"
            >
              {isTvMode ? t.tv.favoriteTvTitle : t.favorites.title}
            </h1>
            <p className="hidden sm:block text-sm text-slate-600 dark:text-zinc-400 mt-0.5">
              {t.favorites.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json,.m3u,.m3u8"
              onChange={handleImportFileChange}
              className="visually-hidden"
              aria-label={t.favorites.importJson}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[32px] sm:min-h-[40px] px-2.5 sm:px-3.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Import</span>
            </button>

            {activeItemsCount > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleExportM3u}
                  className="min-h-[32px] sm:min-h-[40px] px-2.5 sm:px-3.5 py-1 rounded-full bg-brand-700 hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>.M3U ({activeItemsCount})</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportJson}
                  className="min-h-[32px] sm:min-h-[40px] px-2.5 sm:px-3.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>JSON</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Dedicated Separate Tabs: Favorite Radio vs Favorite TV */}
        <div
          role="tablist"
          aria-label="Categorii Favorite"
          className="grid grid-cols-2 gap-1.5 p-1 rounded-full bg-slate-100 dark:bg-zinc-950 border border-slate-200/70 dark:border-zinc-800/80"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!isTvMode}
            onClick={() => setFavoritesSubTab('radio')}
            className={`min-h-[36px] sm:min-h-[42px] px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap transition-all ${
              !isTvMode
                ? 'bg-brand-700 text-white dark:bg-brand-600 shadow-sm'
                : 'text-slate-700 dark:text-zinc-300 hover:bg-white/60 dark:hover:bg-zinc-900'
            }`}
          >
            <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
            <span>Radio</span>
            <span
              className={`px-1.5 py-0.5 text-[11px] rounded-full ${
                !isTvMode
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
              }`}
            >
              {favorites.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={isTvMode}
            onClick={() => setFavoritesSubTab('tv')}
            className={`min-h-[36px] sm:min-h-[42px] px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap transition-all ${
              isTvMode
                ? 'bg-brand-700 text-white dark:bg-brand-600 shadow-sm'
                : 'text-slate-700 dark:text-zinc-300 hover:bg-white/60 dark:hover:bg-zinc-900'
            }`}
          >
            <Tv className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
            <span>TV Live</span>
            <span
              className={`px-1.5 py-0.5 text-[11px] rounded-full ${
                isTvMode
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
              }`}
            >
              {favoriteTvChannels.length}
            </span>
          </button>
        </div>
      </div>

      {/* Import feedback banner */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline px-2 py-1"
          >
            OK
          </button>
        </div>
      )}

      {/* Active Tab Content: Radio Favorites OR TV Favorites */}
      {!isTvMode ? (
        favorites.length === 0 ? (
          <EmptyState
            icon={<Heart className="w-7 h-7" />}
            title={t.favorites.emptyTitle}
            description={t.favorites.emptyDesc}
            actionLabel={t.favorites.exploreBtn}
            onAction={() => setActiveTab('home')}
          />
        ) : (
          <div className="space-y-2.5 sm:space-y-3">
            <p className="hidden sm:block text-xs text-slate-600 dark:text-zinc-400 px-1">
              {t.favorites.dragHint}
            </p>

            <div className="space-y-2.5 sm:space-y-3">
              {favorites.map((station, index) => (
                <div
                  key={station.stationuuid}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 sm:gap-3 transition-opacity ${
                    draggedIndex === index ? 'opacity-50' : 'opacity-100'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-center gap-1 bg-white dark:bg-zinc-900/80 p-1.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80">
                    <span
                      aria-hidden="true"
                      className="hidden sm:flex w-8 h-11 items-center justify-center text-slate-400 dark:text-zinc-500 cursor-grab active:cursor-grabbing"
                    >
                      <GripVertical className="w-4 h-4" />
                    </span>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveFavorite(index, index - 1)}
                      aria-label={format(t.favorites.moveUp, {
                        name: station.name,
                      })}
                      className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                      <ArrowUp className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={index === favorites.length - 1}
                      onClick={() => moveFavorite(index, index + 1)}
                      aria-label={format(t.favorites.moveDown, {
                        name: station.name,
                      })}
                      className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                      <ArrowDown className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <StationCard station={station} queue={favorites} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : favoriteTvChannels.length === 0 ? (
        <EmptyState
          icon={<Tv className="w-7 h-7" />}
          title={t.tv.favoriteTvTitle}
          description="Nu ai adăugat încă niciun canal TV la favorite. Apasă pe inimioara de pe orice canal TV pentru a-l salva aici."
          actionLabel={t.nav.tv}
          onAction={() => setActiveTab('tv')}
        />
      ) : (
        <div className="space-y-2.5 sm:space-y-3">
          <p className="hidden sm:block text-xs text-slate-600 dark:text-zinc-400 px-1">
            {t.favorites.dragHint}
          </p>

          <div className="space-y-2.5 sm:space-y-3">
            {favoriteTvChannels.map((channel, index) => (
              <div
                key={channel.id}
                draggable
                onDragStart={() => handleTvDragStart(index)}
                onDragOver={(e) => handleTvDragOver(e, index)}
                onDragEnd={handleTvDragEnd}
                className={`flex items-center gap-2 sm:gap-3 transition-opacity ${
                  draggedTvIndex === index ? 'opacity-50' : 'opacity-100'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-center gap-1 bg-white dark:bg-zinc-900/80 p-1.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80">
                  <span
                    aria-hidden="true"
                    className="hidden sm:flex w-8 h-11 items-center justify-center text-slate-400 dark:text-zinc-500 cursor-grab active:cursor-grabbing"
                  >
                    <GripVertical className="w-4 h-4" />
                  </span>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveFavoriteTvChannel(index, index - 1)}
                    aria-label={format(t.favorites.moveUp, {
                      name: channel.name,
                    })}
                    className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ArrowUp className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={index === favoriteTvChannels.length - 1}
                    onClick={() => moveFavoriteTvChannel(index, index + 1)}
                    aria-label={format(t.favorites.moveDown, {
                      name: channel.name,
                    })}
                    className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ArrowDown className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  <TvChannelCard
                    channel={channel}
                    queue={favoriteTvChannels}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

