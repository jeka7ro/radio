import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Subtitles,
  Search,
  Download,
  Check,
  X,
  Loader2,
  Film,
  Tv,
  Upload,
  Globe,
} from 'lucide-react';
import {
  OnlineSubtitleTrack,
  SubtitleMediaCandidate,
  fetchOnlineSubtitlesByImdb,
  searchMediaForSubtitles,
  downloadSubtitleAsVttBlobUrl,
  saveSubtitleFileToDevice,
  convertSrtToWebVtt,
} from '../../services/subtitleSearchService';

interface OnlineSubtitleFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialImdbId?: string;
  initialTitle?: string;
  initialType?: 'movie' | 'series';
  initialSeason?: number;
  initialEpisode?: number;
  initialLangFilter?: string;
  onApplySubtitle: (payload: {
    vttBlobUrl: string;
    label: string;
    langCode2: string;
    rawSrt: string;
  }) => void;
}

const LANG_FILTER_OPTIONS = [
  { id: 'all', label: 'Toate limbile' },
  { id: 'ro', label: 'Română (RO)' },
  { id: 'ru', label: 'Русский (RU)' },
  { id: 'en', label: 'English (EN)' },
  { id: 'es', label: 'Español (ES)' },
  { id: 'fr', label: 'Français (FR)' },
  { id: 'de', label: 'Deutsch (DE)' },
];

export const OnlineSubtitleFinderModal: React.FC<
  OnlineSubtitleFinderModalProps
> = ({
  isOpen,
  onClose,
  initialImdbId = '',
  initialTitle = '',
  initialType = 'movie',
  initialSeason = 1,
  initialEpisode = 1,
  initialLangFilter = 'all',
  onApplySubtitle,
}) => {
  const [query, setQuery] = useState(initialTitle);
  const [mediaType, setMediaType] = useState<'movie' | 'series'>(initialType);
  const [season, setSeason] = useState<number>(initialSeason || 1);
  const [episode, setEpisode] = useState<number>(initialEpisode || 1);
  const [langFilter, setLangFilter] = useState<string>(initialLangFilter);

  const [activeImdbId, setActiveImdbId] = useState<string>(initialImdbId);
  const [activeMediaTitle, setActiveMediaTitle] = useState<string>(initialTitle);

  const [candidates, setCandidates] = useState<SubtitleMediaCandidate[]>([]);
  const [isSearchingMedia, setIsSearchingMedia] = useState(false);

  const [subtitles, setSubtitles] = useState<OnlineSubtitleTrack[]>([]);
  const [isLoadingSubs, setIsLoadingSubs] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const localFileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync initial props when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setQuery(initialTitle);
    setMediaType(initialType);
    setSeason(initialSeason || 1);
    setEpisode(initialEpisode || 1);
    setActiveImdbId(initialImdbId);
    setActiveMediaTitle(initialTitle);
    setErrorMsg(null);

    // If we have an IMDb ID, fetch subtitles directly; otherwise search by title
    if (initialImdbId && initialImdbId.startsWith('tt')) {
      setCandidates([]);
    } else if (initialTitle.trim().length >= 2) {
      void handleSearchTitle(initialTitle, initialType, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialImdbId, initialTitle, initialType, initialSeason, initialEpisode]);

  // Fetch subtitles whenever activeImdbId, mediaType, season, or episode changes
  useEffect(() => {
    if (!isOpen || !activeImdbId || !activeImdbId.startsWith('tt')) return;

    let cancelled = false;
    setIsLoadingSubs(true);
    setErrorMsg(null);

    void fetchOnlineSubtitlesByImdb({
      imdbId: activeImdbId,
      type: mediaType,
      season,
      episode,
    })
      .then((list) => {
        if (cancelled) return;
        setSubtitles(list);
      })
      .catch(() => {
        if (!cancelled) setSubtitles([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSubs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeImdbId, mediaType, season, episode]);

  const handleSearchTitle = async (
    searchText: string,
    targetType: 'movie' | 'series',
    autoSelectFirst = false
  ) => {
    const clean = searchText.trim();
    if (!clean) return;

    setIsSearchingMedia(true);
    setErrorMsg(null);
    try {
      const results = await searchMediaForSubtitles(clean, targetType);
      setCandidates(results);
      if (results.length > 0 && autoSelectFirst) {
        setActiveImdbId(results[0].imdbId);
        setActiveMediaTitle(
          `${results[0].name}${results[0].year ? ` (${results[0].year})` : ''}`
        );
      } else if (results.length === 0) {
        setErrorMsg(
          'Nu am găsit acest titlu în baza OpenSubtitles. Încearcă titlul în engleză.'
        );
      }
    } finally {
      setIsSearchingMedia(false);
    }
  };

  const filteredSubtitles = useMemo(() => {
    if (langFilter === 'all') return subtitles;
    return subtitles.filter((s) => s.langCode2 === langFilter);
  }, [subtitles, langFilter]);

  const langCounts = useMemo(() => {
    const counts: Record<string, number> = { all: subtitles.length };
    for (const s of subtitles) {
      counts[s.langCode2] = (counts[s.langCode2] || 0) + 1;
    }
    return counts;
  }, [subtitles]);

  const handleApplyTrack = async (track: OnlineSubtitleTrack) => {
    setApplyingId(track.id);
    setErrorMsg(null);
    try {
      const { vttBlobUrl, rawSrt } = await downloadSubtitleAsVttBlobUrl(
        track.url
      );
      onApplySubtitle({
        vttBlobUrl,
        label: `${track.langLabel} (${track.releaseName.slice(0, 28)})`,
        langCode2: track.langCode2,
        rawSrt,
      });
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Nu am putut încărca subtitrarea selectată.'
      );
    } finally {
      setApplyingId(null);
    }
  };

  const handleDownloadTrackFile = async (track: OnlineSubtitleTrack) => {
    setDownloadingId(track.id);
    setErrorMsg(null);
    try {
      await saveSubtitleFileToDevice(track);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Eroare la salvarea fișierului .SRT.'
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const handleLocalFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rawText = await file.text();
      const vttText = convertSrtToWebVtt(rawText);
      const blob = new Blob([vttText], { type: 'text/vtt;charset=utf-8' });
      const vttBlobUrl = URL.createObjectURL(blob);
      onApplySubtitle({
        vttBlobUrl,
        label: file.name.replace(/\.(srt|vtt)$/i, ''),
        langCode2: 'custom',
        rawSrt: rawText,
      });
      onClose();
    } catch {
      setErrorMsg('Nu am putut citi fișierul .SRT / .VTT din dispozitiv.');
    } finally {
      e.target.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] rounded-2xl bg-zinc-900 border border-zinc-700/90 text-zinc-100 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 py-3 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
              <Subtitles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white truncate">
                Descarcă & Aplică Subtitrări de pe Net (OpenSubtitles)
              </h3>
              <p className="text-[11px] text-zinc-400 truncate">
                Caută orice film sau serial • Aplică direct în player sau salvează fișierul .SRT
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Filters Controls */}
        <div className="p-3.5 sm:p-4 bg-zinc-900/90 border-b border-zinc-800 space-y-2.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSearchTitle(query, mediaType, true);
            }}
            className="flex flex-wrap sm:flex-nowrap items-center gap-2"
          >
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Numele filmului sau serialului (ex: Dune, Nocturne, Gladiator)..."
                className="w-full h-9 pl-8 pr-3 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="inline-flex rounded-xl bg-zinc-950 p-0.5 border border-zinc-800 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setMediaType('movie');
                  if (query.trim()) void handleSearchTitle(query, 'movie', true);
                }}
                className={`h-8 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors ${
                  mediaType === 'movie'
                    ? 'bg-emerald-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Film</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMediaType('series');
                  if (query.trim()) void handleSearchTitle(query, 'series', true);
                }}
                className={`h-8 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors ${
                  mediaType === 'series'
                    ? 'bg-emerald-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                <span>Serial</span>
              </button>
            </div>

            {mediaType === 'series' && (
              <div className="inline-flex items-center gap-1.5 shrink-0">
                <label className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                  <span>Sez</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={season}
                    onChange={(e) =>
                      setSeason(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="w-12 h-9 px-1.5 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-center font-bold text-white"
                  />
                </label>
                <label className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                  <span>Ep</span>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={episode}
                    onChange={(e) =>
                      setEpisode(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="w-12 h-9 px-1.5 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-center font-bold text-white"
                  />
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={isSearchingMedia}
              className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
            >
              {isSearchingMedia ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              <span>Caută</span>
            </button>
          </form>

          {/* Candidate Media Selector Pills (when user searches by title) */}
          {candidates.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
              {candidates.map((cand) => {
                const active = cand.imdbId === activeImdbId;
                return (
                  <button
                    key={cand.imdbId}
                    type="button"
                    onClick={() => {
                      setActiveImdbId(cand.imdbId);
                      setActiveMediaTitle(
                        `${cand.name}${cand.year ? ` (${cand.year})` : ''}`
                      );
                    }}
                    className={`min-h-[28px] px-2.5 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 border transition-colors ${
                      active
                        ? 'bg-brand-600 text-white border-brand-500'
                        : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
                    }`}
                  >
                    <span>{cand.name}</span>
                    {cand.year && (
                      <span className="text-[10px] opacity-75">
                        ({cand.year})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Language Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
            {LANG_FILTER_OPTIONS.map((opt) => {
              const count = langCounts[opt.id] || 0;
              const active = langFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLangFilter(opt.id)}
                  className={`min-h-[26px] px-2.5 py-0.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-emerald-500 text-zinc-950 font-bold'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  }`}
                >
                  <Globe className="w-3 h-3 shrink-0" />
                  <span>{opt.label}</span>
                  <span className="opacity-75">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Subtitles Results List */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-2 min-h-[220px]">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/70 text-rose-200 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {isLoadingSubs ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-400">
              <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
              <span className="text-xs font-semibold">
                Se caută subtitrări pe OpenSubtitles pentru{' '}
                {activeMediaTitle || activeImdbId}...
              </span>
            </div>
          ) : filteredSubtitles.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-xs sm:text-sm font-semibold text-zinc-300">
                {subtitles.length > 0
                  ? 'Nu există subtitrări în limba selectată pentru acest episod/film.'
                  : 'Nicio subtitrare găsită încă. Caută titlul filmului în engleză sus!'}
              </p>
              {subtitles.length > 0 && langFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setLangFilter('all')}
                  className="px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-emerald-300 text-xs font-semibold"
                >
                  Arată toate cele {subtitles.length} subtitrări disponibile
                </button>
              )}
            </div>
          ) : (
            filteredSubtitles.map((sub) => (
              <div
                key={sub.id}
                className="p-2.5 sm:p-3 rounded-xl bg-zinc-950/90 hover:bg-zinc-950 border border-zinc-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold uppercase shrink-0">
                      {sub.langCode2}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-white truncate">
                      {sub.langLabel}
                    </span>
                  </div>
                  <p
                    className="text-[11px] text-zinc-400 truncate font-mono"
                    title={sub.fileName}
                  >
                    {sub.fileName}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={applyingId === sub.id}
                    onClick={() => void handleApplyTrack(sub)}
                    className="min-h-[32px] px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {applyingId === sub.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Aplică în Player</span>
                  </button>

                  <button
                    type="button"
                    disabled={downloadingId === sub.id}
                    onClick={() => void handleDownloadTrackFile(sub)}
                    title="Salvează fișierul .SRT în dispozitiv"
                    className="min-h-[32px] px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-60 text-zinc-200 border border-zinc-700 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {downloadingId === sub.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>.SRT</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer: Upload Local .SRT/.VTT from Device */}
        <div className="px-4 py-2.5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between gap-2 text-xs">
          <span className="text-zinc-400 truncate">
            Ai deja un fișier <code className="text-zinc-300">.srt</code> descărcat în telefon/PC?
          </span>
          <input
            ref={localFileInputRef}
            type="file"
            accept=".srt,.vtt"
            onChange={(e) => void handleLocalFileUpload(e)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => localFileInputRef.current?.click()}
            className="min-h-[30px] px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-brand-400" />
            <span>Încarcă .SRT din Dispozitiv</span>
          </button>
        </div>
      </div>
    </div>
  );
};
