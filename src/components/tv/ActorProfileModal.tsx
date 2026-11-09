import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Film,
  Tv,
  Loader2,
  Sparkles,
  User,
  Calendar,
  MapPin,
  Play,
  X,
} from 'lucide-react';
import {
  ActorFilmographyItem,
  ActorFullProfile,
  CastMemberCard,
  RelatedVodSuggestionItem,
  fetchActorFullProfile,
  fetchRelatedVodSuggestions,
} from '../../services/actorService';

interface CastCardsSectionProps {
  castList: CastMemberCard[];
  isLoading: boolean;
  uiLang?: 'ro' | 'en' | 'ru';
  onSelectActor: (actor: CastMemberCard) => void;
}

export const CastCardsSection: React.FC<CastCardsSectionProps> = ({
  castList,
  isLoading,
  uiLang = 'ro',
  onSelectActor,
}) => {
  const tr = (ro: string, en: string, ru: string) =>
    uiLang === 'en' ? en : uiLang === 'ru' ? ru : ro;

  if (!isLoading && castList.length === 0) {
    return null;
  }

  const directors = castList.filter((c) => c.professionKey === 'DIRECTOR');
  const actors = castList.filter((c) => c.professionKey !== 'DIRECTOR');

  const renderPersonCard = (actor: CastMemberCard, idx: number) => {
    const initials = (actor.name || 'A')
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    const subtitle =
      actor.professionKey === 'DIRECTOR'
        ? 'Director'
        : actor.role || tr('Actor', 'Actor', 'Актер');

    return (
      <button
        key={`cast_member_${actor.staffId || actor.name}_${idx}`}
        type="button"
        onFocus={(e) =>
          e.currentTarget.scrollIntoView({
            block: 'nearest',
            inline: 'nearest',
            behavior: 'smooth',
          })
        }
        onClick={() => onSelectActor(actor)}
        className="cast-person-card group shrink-0 inline-flex items-center w-[285px] h-[112px] sm:h-[122px] rounded-[20px] bg-white/[0.04] border border-white/10 hover:bg-white focus:bg-white text-white hover:text-[#141414] focus:text-[#141414] hover:shadow-2xl focus:shadow-2xl focus:outline-none transition-all duration-200 cursor-pointer text-left pr-4"
      >
        {/* Rounded Portrait Photo */}
        <div className="w-[100px] sm:w-[108px] h-[112px] sm:h-[122px] rounded-[20px] bg-zinc-800/80 overflow-hidden shrink-0 relative flex items-center justify-center shadow-md">
          <span className="text-base font-bold text-zinc-300 select-none">
            {initials}
          </span>
          {actor.photoUrl && (
            <img
              src={actor.photoUrl}
              alt={actor.name}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
        </div>

        {/* Name & Role */}
        <div className="pl-3.5 min-w-0 flex-1 flex flex-col justify-center py-1.5">
          <div className="text-[15px] sm:text-[16px] font-medium text-white group-hover:text-[#141414] group-focus:text-[#141414] leading-snug whitespace-normal break-words line-clamp-3">
            {actor.name}
          </div>
          {subtitle && (
            <div className="text-xs sm:text-[13px] font-normal text-white/80 group-hover:text-zinc-600 group-focus:text-zinc-600 mt-1 leading-tight whitespace-normal break-words line-clamp-2">
              {subtitle}
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-7 pt-2">
      {isLoading && castList.length === 0 ? (
        <div className="space-y-3">
          <div className="h-6 w-32 bg-white/10 rounded animate-pulse" />
          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-1">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="shrink-0 w-[265px] sm:w-[295px] h-[112px] sm:h-[122px] rounded-[20px] flex items-center gap-4 animate-pulse"
              >
                <div className="w-[100px] sm:w-[108px] h-full rounded-[20px] bg-white/10 shrink-0" />
                <div className="flex-1 space-y-2 pr-4">
                  <div className="h-4 w-3/4 bg-white/10 rounded" />
                  <div className="h-3 w-1/2 bg-white/10 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {directors.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xl sm:text-[22px] font-normal text-white/95 tracking-normal">
                {tr('Regizor', 'Director', 'Режиссер')}
              </h3>
              <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-1">
                {directors.map((dir, idx) => renderPersonCard(dir, idx))}
              </div>
            </div>
          )}

          {actors.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xl sm:text-[22px] font-normal text-white/95 tracking-normal">
                {tr('Actori', 'Actors', 'Актеры')}
              </h3>
              <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-1">
                {actors.map((act, idx) => renderPersonCard(act, idx))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

interface RelatedVodSuggestionsSectionProps {
  vodId: string;
  kpId?: string;
  type: 'movie' | 'series';
  name: string;
  nameOriginal?: string;
  genres?: string[];
  director?: string[];
  cast?: string[];
  uiLang?: 'ro' | 'en' | 'ru';
  onSelectVodItem: (item: RelatedVodSuggestionItem) => void;
}

export const RelatedVodSuggestionsSection: React.FC<
  RelatedVodSuggestionsSectionProps
> = ({
  vodId,
  kpId,
  type,
  name,
  nameOriginal,
  genres,
  director,
  cast,
  uiLang = 'ro',
  onSelectVodItem,
}) => {
  const [suggestions, setSuggestions] = useState<RelatedVodSuggestionItem[]>(
    []
  );
  const [brokenPosterIds, setBrokenPosterIds] = useState<
    Record<string, boolean>
  >({});
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const tr = (ro: string, en: string, ru: string) =>
    uiLang === 'en' ? en : uiLang === 'ru' ? ru : ro;

  useEffect(() => {
    if (!vodId || vodId.startsWith('yt_')) {
      setSuggestions([]);
      setBrokenPosterIds({});
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setBrokenPosterIds({});

    fetchRelatedVodSuggestions({
      id: vodId,
      kpId,
      type,
      name,
      nameOriginal,
      genres,
      director,
      cast,
      lang: uiLang,
    })
      .then((list) => {
        if (!cancelled) {
          setSuggestions(list);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    vodId,
    kpId,
    type,
    name,
    nameOriginal,
    genres?.join(','),
    director?.join(','),
    cast?.slice(0, 3).join(','),
    uiLang,
  ]);

  const visibleSuggestions = suggestions.filter(
    (s) =>
      Boolean(s.poster) &&
      !s.poster!.includes('no-poster') &&
      !brokenPosterIds[s.id]
  );

  if (!isLoading && visibleSuggestions.length === 0) {
    return null;
  }

  const hasFranchiseItems = visibleSuggestions.some(
    (s) =>
      s.relationKind === 'SEQUEL' ||
      s.relationKind === 'PREQUEL' ||
      s.relationKind === 'FRANCHISE'
  );

  const sectionHeading = hasFranchiseItems
    ? type === 'series'
      ? tr(
          'Univers, Spin-off & Seriale Similare',
          'Universe, Spin-offs & Similar Series',
          'Вселенная, Спин-оффы и Похожие сериалы'
        )
      : tr(
          'Colecție, Trilogie & Filme Similare',
          'Collection, Trilogy & Similar Movies',
          'Коллекция, Трилогия и Похожие фильмы'
        )
    : type === 'series'
      ? tr(
          'Seriale & Filme Similare Recomandate',
          'Recommended Similar Series & Movies',
          'Рекомендуемые похожие сериалы и фильмы'
        )
      : tr(
          'Filme & Seriale Similare Recomandate',
          'Recommended Similar Movies & Series',
          'Рекомендуемые похожие фильмы и сериалы'
        );

  const getRelationBadge = (item: RelatedVodSuggestionItem) => {
    if (item.relationKind === 'SEQUEL') {
      return {
        label: tr('CONTINUARE', 'SEQUEL', 'СИКВЕЛ'),
        className: 'bg-[#1e3a8a] text-white border-blue-300',
      };
    }
    if (item.relationKind === 'PREQUEL') {
      return {
        label: tr('PREQUEL', 'PREQUEL', 'ПРИКВЕЛ'),
        className: 'bg-amber-400 text-zinc-950 border-amber-300',
      };
    }
    if (item.relationKind === 'FRANCHISE') {
      return {
        label:
          item.type === 'series'
            ? tr('UNIVERS', 'UNIVERSE', 'ВСЕЛЕННАЯ')
            : tr('TRILOGIE • COLECȚIE', 'COLLECTION', 'КОЛЛЕКЦИЯ'),
        className: 'bg-[#1e3a8a] text-white border-blue-300',
      };
    }
    return {
      label: tr('SIMILAR', 'SIMILAR', 'ПОХОЖЕЕ'),
      className: 'bg-black/80 text-zinc-200 border-white/15',
    };
  };

  return (
    <div className="space-y-4 pt-4 border-t border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xl sm:text-[22px] font-normal text-white/95 tracking-normal">
          {sectionHeading}
        </h3>
        {hasFranchiseItems && (
          <span className="px-3 py-1 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-bold">
            {type === 'series'
              ? tr(
                  'Include universul comun & seriale înrudite',
                  'Includes shared universe & related series',
                  'Включает общую вселенную и похожие сериалы'
                )
              : tr(
                  'Include trilogia / colecția & filme similare',
                  'Includes trilogy / collection & similar movies',
                  'Включает трилогию / коллекцию и похожие фильмы'
                )}
          </span>
        )}
      </div>

      {isLoading && visibleSuggestions.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="space-y-2 animate-pulse">
              <div className="aspect-[2/3] w-full rounded-2xl bg-white/10" />
              <div className="h-4 w-3/4 bg-white/10 rounded" />
              <div className="h-3 w-1/3 bg-white/10 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
          {visibleSuggestions.map((item, idx) => {
            const relBadge = getRelationBadge(item);
            return (
              <button
                key={`sug_${item.id}_${idx}`}
                type="button"
                data-vod-card="true"
                onFocus={(e) =>
                  e.currentTarget.scrollIntoView({
                    block: 'nearest',
                    inline: 'nearest',
                    behavior: 'smooth',
                  })
                }
                onClick={() => onSelectVodItem(item)}
                className="group w-full block text-left focus:outline-none cursor-pointer"
              >
                <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg border border-white/10 group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
                  {item.poster && (
                    <img
                      src={item.poster}
                      alt={item.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        if (
                          item.fallbackPoster &&
                          !item.fallbackPoster.includes('no-poster') &&
                          e.currentTarget.src !== item.fallbackPoster
                        ) {
                          e.currentTarget.src = item.fallbackPoster;
                        } else {
                          setBrokenPosterIds((prev) => ({
                            ...prev,
                            [item.id]: true,
                          }));
                        }
                      }}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}

                  {/* Top-Left Relation Logic Badge (Trilogy / Sequel / Prequel / Universe / Similar) */}
                  <span
                    className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider shadow ${relBadge.className}`}
                  >
                    {relBadge.label}
                  </span>

                  {/* Top-Right Media Type Badge */}
                  <span
                    className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shadow ${
                      item.type === 'series'
                        ? 'bg-[#1e3a8a] text-white border border-[#3b82f6]/50'
                        : 'bg-black/80 text-white border border-white/15'
                    }`}
                  >
                    {item.type === 'series'
                      ? tr('SERIAL', 'SERIES', 'СЕРИАЛ')
                      : tr('FILM', 'MOVIE', 'ФИЛЬМ')}
                  </span>

                  {/* Bottom-Right IMDb Rating */}
                  {item.imdbRating && (
                    <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/85 backdrop-blur-sm text-white text-xs font-extrabold shadow-md">
                      {item.imdbRating}
                    </span>
                  )}

                  {/* Hover / Focus Play Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="px-4 py-2 rounded-full bg-white text-[#141414] font-extrabold text-xs inline-flex items-center gap-1.5 shadow-xl">
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{tr('Deschide', 'Open', 'Открыть')}</span>
                    </span>
                  </div>
                </div>

                <div className="mt-2 px-0.5">
                  <div className="text-sm font-semibold text-zinc-100 group-focus:text-white group-hover:text-white leading-snug line-clamp-1">
                    {item.name}
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    {item.releaseInfo || (item.type === 'series' ? 'TV' : 'HD')}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface ActorProfileModalProps {
  actor: CastMemberCard | null;
  uiLang?: 'ro' | 'en' | 'ru';
  onClose: () => void;
  onSelectVodItem: (item: ActorFilmographyItem) => void;
}

export const ActorProfileModal: React.FC<ActorProfileModalProps> = ({
  actor,
  uiLang = 'ro',
  onClose,
  onSelectVodItem,
}) => {
  const [profile, setProfile] = useState<ActorFullProfile | null>(null);
  const [brokenActorPosterIds, setBrokenActorPosterIds] = useState<
    Record<string, boolean>
  >({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'all' | 'movies' | 'series'>(
    'all'
  );

  const tr = (ro: string, en: string, ru: string) =>
    uiLang === 'en' ? en : uiLang === 'ru' ? ru : ro;

  useEffect(() => {
    if (!actor) {
      setProfile(null);
      setBrokenActorPosterIds({});
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setBrokenActorPosterIds({});
    setActiveTab('all');

    fetchActorFullProfile(actor, uiLang)
      .then((res) => {
        if (!cancelled) {
          setProfile(res);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [actor, uiLang]);

  if (!actor) return null;

  const displayPhoto = profile?.photoUrl || actor.photoUrl;
  const movies = (profile?.movies || []).filter(
    (m) => Boolean(m.poster) && !brokenActorPosterIds[m.id]
  );
  const series = (profile?.series || []).filter(
    (s) => Boolean(s.poster) && !brokenActorPosterIds[s.id]
  );

  const renderMediaGrid = (
    items: ActorFilmographyItem[],
    badgeType: 'movie' | 'series'
  ) => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(155px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-x-4 gap-y-6">
      {items.map((item, idx) => (
        <button
          key={`${badgeType}_${item.id}_${idx}`}
          type="button"
          data-vod-card="true"
          onClick={() => onSelectVodItem(item)}
          className="group w-full block text-left focus:outline-none cursor-pointer"
        >
          <div className="aspect-[2/3] w-full rounded-2xl bg-[#242424] relative overflow-hidden shadow-lg border border-white/10 group-focus:ring-4 group-focus:ring-white group-hover:ring-2 group-hover:ring-white/80 group-focus:scale-[1.03] transition-all duration-200">
            {item.poster && (
              <img
                src={item.poster}
                alt={item.name}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  if (
                    item.fallbackPoster &&
                    e.currentTarget.src !== item.fallbackPoster
                  ) {
                    e.currentTarget.src = item.fallbackPoster;
                  } else {
                    setBrokenActorPosterIds((prev) => ({
                      ...prev,
                      [item.id]: true,
                    }));
                  }
                }}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            {/* Top Right Type Badge */}
            <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-black/80 backdrop-blur-md border border-white/15 text-white text-[10px] font-bold uppercase tracking-wider shadow">
              {badgeType === 'series'
                ? tr('SERIAL TV', 'TV SERIES', 'СЕРИАЛ')
                : tr('FILM', 'MOVIE', 'ФИЛЬМ')}
            </span>

            {/* Rating Badge */}
            {item.imdbRating && (
              <span className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-lg bg-black/80 backdrop-blur-sm text-white text-xs font-bold shadow-md">
                {item.imdbRating}
              </span>
            )}

            {/* Hover/Focus Play Overlay */}
            <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity flex items-center justify-center">
              <span className="px-4 py-2 rounded-full bg-white text-[#141414] font-bold text-xs inline-flex items-center gap-1.5 shadow-xl">
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{tr('Vezi acum', 'Watch Now', 'Смотреть')}</span>
              </span>
            </div>
          </div>

          <div className="mt-2 px-0.5">
            <div className="text-sm font-semibold text-zinc-100 group-focus:text-white group-hover:text-white leading-snug line-clamp-2">
              {item.name}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>{item.releaseInfo || 'HD'}</span>
              {item.role && (
                <>
                  <span>•</span>
                  <span className="text-zinc-300 truncate max-w-[120px]">
                    {item.role}
                  </span>
                </>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <div
      data-actor-profile-modal="true"
      className="fixed inset-0 z-[185] bg-[#121212]/98 backdrop-blur-2xl flex flex-col overflow-hidden text-zinc-100"
    >
      {/* Top Sticky Bar */}
      <div className="shrink-0 px-5 sm:px-8 py-4 bg-[#181818] border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="h-10 px-4 rounded-full bg-white/10 hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] focus:outline-none border border-white/15 text-white font-semibold text-xs sm:text-sm inline-flex items-center gap-2 transition-colors shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{tr('Înapoi', 'Back', 'Назад')}</span>
          </button>

          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-bold text-white truncate">
              {profile?.name || actor.name}
            </h2>
            <p className="text-xs text-zinc-400 truncate">
              {tr(
                'Biografie completă, Filme și Seriale TV',
                'Full Biography, Movies & TV Series',
                'Полная биография, Фильмы и Сериалы'
              )}
            </p>
          </div>
        </div>

        {/* Category Filter Tabs: All | Movies | TV Series */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`h-9 px-4 rounded-full text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white text-[#141414] shadow'
                : 'bg-white/10 hover:bg-white/20 text-zinc-200 border border-white/10'
            }`}
          >
            {tr('Toate', 'All', 'Все')} ({movies.length + series.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('movies')}
            className={`h-9 px-4 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer ${
              activeTab === 'movies'
                ? 'bg-white text-[#141414] shadow'
                : 'bg-white/10 hover:bg-white/20 text-zinc-200 border border-white/10'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>
              {tr('Filme', 'Movies', 'Фильмы')} ({movies.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('series')}
            className={`h-9 px-4 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer ${
              activeTab === 'series'
                ? 'bg-white text-[#141414] shadow'
                : 'bg-white/10 hover:bg-white/20 text-zinc-200 border border-white/10'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>
              {tr('Seriale TV', 'TV Series', 'Сериалы')} ({series.length})
            </span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white hover:text-[#141414] focus:bg-white focus:text-[#141414] focus:outline-none text-zinc-200 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 space-y-8">
        {/* Actor Hero Biography Card */}
        <div className="p-5 sm:p-7 rounded-3xl bg-[#1b1b1b] border border-white/15 shadow-2xl flex flex-col md:flex-row items-start gap-6">
          {/* Portrait */}
          <div className="w-36 h-48 sm:w-44 sm:h-60 rounded-2xl bg-zinc-900 border border-white/15 overflow-hidden shrink-0 relative flex items-center justify-center shadow-xl">
            <User className="w-14 h-14 text-zinc-700" />
            {displayPhoto && (
              <img
                src={displayPhoto}
                alt={profile?.name || actor.name}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
          </div>

          {/* Bio Details */}
          <div className="flex-1 min-w-0 space-y-3.5">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
                  {profile?.name || actor.name}
                </h1>
                {actor.role && (
                  <span className="px-3.5 py-1 rounded-full bg-white/10 border border-white/15 text-zinc-200 text-xs font-semibold">
                    {actor.role}
                  </span>
                )}
              </div>

              {uiLang === 'ru' &&
                profile?.nameEn &&
                profile?.nameRu &&
                profile.nameEn !== profile.nameRu && (
                  <div className="text-xs sm:text-sm text-zinc-400 font-medium mt-0.5">
                    {profile.nameEn}
                  </div>
                )}
            </div>

            {/* Metadata Pills: Birthday, Age, Birthplace, Height */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {profile?.birthday && (
                <span className="px-3.5 py-1 rounded-full bg-white/10 border border-white/10 text-zinc-200 font-medium inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                  <span>
                    {profile.birthday}
                    {profile.age
                      ? ` (${profile.age} ${tr('ani', 'years', 'лет')})`
                      : ''}
                  </span>
                </span>
              )}
              {profile?.birthplace && (
                <span className="px-3.5 py-1 rounded-full bg-white/10 border border-white/10 text-zinc-200 font-medium inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{profile.birthplace}</span>
                </span>
              )}
              {profile?.growth && (
                <span className="px-3.5 py-1 rounded-full bg-white/10 border border-white/10 text-zinc-200 font-medium">
                  {profile.growth} cm
                </span>
              )}
              {profile?.profession && (
                <span className="px-3.5 py-1 rounded-full bg-white/10 border border-white/10 text-zinc-200 font-medium">
                  {profile.profession}
                </span>
              )}
            </div>

            {/* Full Biography Text */}
            <div className="space-y-2 pt-1">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                {tr('Biografie', 'Biography', 'Биография')}
              </div>
              <p className="text-sm sm:text-[15px] text-zinc-200 leading-relaxed whitespace-pre-line">
                {profile?.biography ||
                  actor.shortBio ||
                  tr(
                    'Se încarcă biografia actorului...',
                    'Loading actor biography...',
                    'Загрузка биографии...'
                  )}
              </p>
            </div>

            {/* Interesting Facts / Trivia */}
            {profile?.facts && profile.facts.length > 0 && (
              <div className="pt-2 space-y-1.5 border-t border-white/10">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {tr(
                      'Informații & Curiozități',
                      'Trivia & Facts',
                      'Интересные факты'
                    )}
                  </span>
                </div>
                <ul className="space-y-1 text-xs sm:text-sm text-zinc-300 list-disc list-inside">
                  {profile.facts.slice(0, 3).map((fact, i) => (
                    <li key={i} className="leading-snug">
                      {fact}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-zinc-300">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
            <span className="text-sm font-semibold">
              {tr(
                'Se încarcă filmele și serialele actorului...',
                "Loading actor's movies and TV series...",
                'Загрузка фильмов и сериалов актера...'
              )}
            </span>
          </div>
        ) : (
          <div className="space-y-10 pb-12">
            {/* SECTION 1: MOVIES (FILME) */}
            {(activeTab === 'all' || activeTab === 'movies') && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-white/10 text-white border border-white/15">
                      <Film className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold text-white">
                        {tr(
                          `Filme cu ${profile?.name || actor.name}`,
                          `Movies with ${profile?.name || actor.name}`,
                          `Фильмы с участием: ${profile?.name || actor.name}`
                        )}{' '}
                        <span className="text-zinc-400">
                          ({movies.length})
                        </span>
                      </h3>
                    </div>
                  </div>
                </div>

                {movies.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 text-sm text-zinc-400">
                    {tr(
                      'Nu am găsit filme artistice pentru acest actor.',
                      'No feature movies found for this actor.',
                      'Фильмы не найдены.'
                    )}
                  </div>
                ) : (
                  renderMediaGrid(movies, 'movie')
                )}
              </div>
            )}

            {/* SECTION 2: TV SERIES (SERIALE TV - SEPARAT) */}
            {(activeTab === 'all' || activeTab === 'series') && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-white/10 text-white border border-white/15">
                      <Tv className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold text-white">
                        {tr(
                          `Seriale TV cu ${profile?.name || actor.name}`,
                          `TV Series with ${profile?.name || actor.name}`,
                          `Сериалы с участием: ${profile?.name || actor.name}`
                        )}{' '}
                        <span className="text-zinc-400">
                          ({series.length})
                        </span>
                      </h3>
                    </div>
                  </div>
                </div>

                {series.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 text-sm text-zinc-400">
                    {tr(
                      'Nu am găsit seriale TV pentru acest actor.',
                      'No TV series found for this actor.',
                      'Сериалы не найдены.'
                    )}
                  </div>
                ) : (
                  renderMediaGrid(series, 'series')
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

