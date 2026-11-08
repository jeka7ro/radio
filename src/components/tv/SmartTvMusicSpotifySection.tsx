import React, { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  Delete,
  Disc,
  Heart,
  Home,
  Keyboard,
  Loader2,
  Pause,
  Play,
  Repeat,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Tv,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

export interface MusicAlbumDetailCard {
  albumTitle: string;
  artistName: string;
  coverUrl: string;
  year: number;
  releaseDateText?: string;
  genre: string;
  copyright?: string;
  country?: string;
  trackCount: number;
  totalDurationSec: number;
  tracks: SpotifyTrackItem[];
}

export interface SpotifyTrackItem {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  coverSmall?: string;
  durationSec: number;
  year: number;
  genre: string;
  videoId?: string;
  previewUrl?: string;
  fullAudioUrl: string;
  videoQuery?: string;
  qualityTier?: 'MAX' | 'HIFI';
  qualityLabel?: string;
  bitrateKbps?: number;
}

export interface SpotifyPlaylistCard {
  id: string;
  titleRo: string;
  titleEn: string;
  titleRu: string;
  subtitleRo: string;
  subtitleEn: string;
  subtitleRu: string;
  badge: string;
  accentColor: string;
  cover: string;
  searchTerm: string;
  country: string;
}

export const INITIAL_SPOTIFY_TRACKS: SpotifyTrackItem[] = [
  {
    id: 'sp_init_1',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    cover:
      'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/6f/6d/73/6f6d73f3-f166-28a1-6e2b-905337f91065/20UMGIM11048.rgb.jpg/600x600bb.jpg',
    durationSec: 203,
    year: 2020,
    genre: 'Synthwave • Pop',
    videoId: 'fHI8X4OXluQ',
    fullAudioUrl: '/api/youtube/audio?id=fHI8X4OXluQ',
  },
  {
    id: 'sp_init_2',
    title: 'Starboy (feat. Daft Punk)',
    artist: 'The Weeknd',
    album: 'Starboy',
    cover:
      'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e2/61/f8/e261f8c1-73db-9a7a-c89e-1068f19d70e0/16UMGIM67863.rgb.jpg/600x600bb.jpg',
    durationSec: 230,
    year: 2016,
    genre: 'R&B • Electro',
    videoId: '34Na4j8AVgA',
    fullAudioUrl: '/api/youtube/audio?id=34Na4j8AVgA',
  },
  {
    id: 'sp_init_3',
    title: 'Sub Pielea Mea (#eroina)',
    artist: "Carla's Dreams",
    album: 'NGOC',
    cover: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hq720.jpg',
    durationSec: 208,
    year: 2016,
    genre: 'Romanian Pop • Dance',
    videoId: '2fngvQS_PmQ',
    fullAudioUrl:
      '/api/youtube/audio?q=' +
      encodeURIComponent("Carla's Dreams Sub Pielea Mea Official"),
  },
  {
    id: 'sp_init_4',
    title: 'Timeless',
    artist: 'The Weeknd & Playboi Carti',
    album: 'Hurry Up Tomorrow',
    cover:
      'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&q=80',
    durationSec: 256,
    year: 2025,
    genre: 'Hip-Hop • Synth',
    fullAudioUrl:
      '/api/youtube/audio?q=' +
      encodeURIComponent('The Weeknd Playboi Carti Timeless Official Audio'),
  },
  {
    id: 'sp_init_5',
    title: 'Die With A Smile',
    artist: 'Lady Gaga & Bruno Mars',
    album: 'Die With A Smile - Single',
    cover:
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80',
    durationSec: 251,
    year: 2025,
    genre: 'Pop • Soul',
    fullAudioUrl:
      '/api/youtube/audio?q=' +
      encodeURIComponent('Lady Gaga Bruno Mars Die With A Smile Official Audio'),
  },
  {
    id: 'sp_init_6',
    title: 'Houdini',
    artist: 'Dua Lipa',
    album: 'Radical Optimism',
    cover:
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80',
    durationSec: 186,
    year: 2024,
    genre: 'Dance Pop • Nu-Disco',
    fullAudioUrl:
      '/api/youtube/audio?q=' +
      encodeURIComponent('Dua Lipa Houdini Official Audio'),
  },
  {
    id: 'sp_init_7',
    title: "I'm Good (Blue)",
    artist: 'David Guetta & Bebe Rexha',
    album: "I'm Good (Blue)",
    cover:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80',
    durationSec: 175,
    year: 2023,
    genre: 'EDM • Club',
    fullAudioUrl:
      '/api/youtube/audio?q=' +
      encodeURIComponent("David Guetta Bebe Rexha I'm Good Blue Official Audio"),
  },
  {
    id: 'sp_init_8',
    title: 'Lose Control',
    artist: 'Teddy Swims',
    album: "I've Tried Everything But Therapy",
    cover:
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80',
    durationSec: 210,
    year: 2024,
    genre: 'Soul • R&B',
    fullAudioUrl:
      '/api/youtube/audio?q=' +
      encodeURIComponent('Teddy Swims Lose Control Official Audio'),
  },
];

export const SPOTIFY_PLAYLISTS: SpotifyPlaylistCard[] = [
  {
    id: 'pl_global_hits',
    titleRo: 'Top Hits Global 2025–2026',
    titleEn: 'Global Top Hits 2025–2026',
    titleRu: 'Мировые Хиты 2025–2026',
    subtitleRo: 'Cele mai ascultate 50 de piese din lume chiar acum',
    subtitleEn: 'Top 50 most streamed tracks worldwide right now',
    subtitleRu: 'Топ-50 самых популярных мировых треков прямо сейчас',
    badge: 'TOP 50 GLOBAL',
    accentColor: 'from-emerald-600/35 via-[#121212] to-[#121212]',
    cover:
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80',
    searchTerm: '__GLOBAL_TOP_50__',
    country: 'US',
  },
  {
    id: 'pl_ro_md',
    titleRo: 'Hituri România & Moldova',
    titleEn: 'Romania & Moldova Viral Hits',
    titleRu: 'Хиты Румынии и Молдовы',
    subtitleRo: "Carla's Dreams, Irina Rimes, Inna, The Motans, Smiley, Delia",
    subtitleEn: "Carla's Dreams, Irina Rimes, Inna, The Motans, Smiley, Delia",
    subtitleRu: "Carla's Dreams, Irina Rimes, Inna, The Motans, Smiley, Delia",
    badge: 'RO • MD TOP 50',
    accentColor: 'from-blue-600/35 via-[#121212] to-[#121212]',
    cover:
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80',
    searchTerm:
      'Irina Rimes, Carlas Dreams, Inna, Smiley, The Motans, Delia, Andra, Alternosfera, Zdob si Zdub, 3 Sud Est',
    country: 'RO',
  },
  {
    id: 'pl_night_drive',
    titleRo: 'Night Drive & Deep House',
    titleEn: 'Night Drive & Deep House',
    titleRu: 'Ночной Драйв & Deep House',
    subtitleRo: 'Bass profund, club vibes și muzică de mașină noaptea',
    subtitleEn: 'Deep bass, melodic club vibes & late night car music',
    subtitleRu: 'Глубокий бас, клубный вайб и музыка в машину',
    badge: 'CAR BASS • CLUB',
    accentColor: 'from-indigo-600/35 via-[#121212] to-[#121212]',
    cover:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80',
    searchTerm:
      'Tiesto, Topic, Meduza, Alok, Imanbek, Calvin Harris, David Guetta, Lost Frequencies, Alan Walker, Peggy Gou',
    country: 'RO',
  },
  {
    id: 'pl_hiphop_trap',
    titleRo: 'Hip-Hop, Rap & Trap',
    titleEn: 'Hip-Hop, Rap & Trap Caviar',
    titleRu: 'Хип-Хоп, Рэп & Trap',
    subtitleRo: 'Travis Scott, Eminem, Drake, Kendrick Lamar, Metro Boomin',
    subtitleEn: 'Travis Scott, Eminem, Drake, Kendrick Lamar, Metro Boomin',
    subtitleRu: 'Travis Scott, Eminem, Drake, Kendrick Lamar, Metro Boomin',
    badge: 'RAP CAVIAR',
    accentColor: 'from-purple-600/35 via-[#121212] to-[#121212]',
    cover:
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80',
    searchTerm:
      'Travis Scott, Metro Boomin, Eminem, Drake, Kendrick Lamar, Future, 21 Savage, Playboi Carti, Don Toliver, Post Malone',
    country: 'US',
  },
  {
    id: 'pl_ru_hits',
    titleRo: 'Hituri Rusești & Club Mix',
    titleEn: 'Russian & CIS Top Hits',
    titleRu: 'Русские Хиты & Топ Чарт',
    subtitleRo: 'Miyagi & Andy Panda, Macan, Jony, Zivert, Anna Asti',
    subtitleEn: 'Miyagi & Andy Panda, Macan, Jony, Zivert, Anna Asti',
    subtitleRu: 'Miyagi & Andy Panda, Macan, Jony, Zivert, Anna Asti',
    badge: 'RU TOP 50',
    accentColor: 'from-rose-600/35 via-[#121212] to-[#121212]',
    cover:
      'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&q=80',
    searchTerm:
      'Miyagi, Jony, Zivert, Macan, Rauf Faik, Anna Asti, Basta, Jah Khalib, HammAli Navai, Mot',
    country: 'RU',
  },
  {
    id: 'pl_balkan_party',
    titleRo: 'Balkan & Party România',
    titleEn: 'Balkan & Romanian Party',
    titleRu: 'Балканские Вечеринки',
    subtitleRo: 'Cele mai tari piese de petrecere și energie maximă',
    subtitleEn: 'High-energy party anthems & Balkan rhythms',
    subtitleRu: 'Зажигательные хиты для вечеринки',
    badge: 'PARTY HITS',
    accentColor: 'from-amber-600/35 via-[#121212] to-[#121212]',
    cover:
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&q=80',
    searchTerm:
      'Tzanca Uraganu, Bogdan DLP, Luis Gabriel, Costel Biju, Florin Salam, Nicolae Guta, Theo Rose, Jador, Babasha, Alex Velea',
    country: 'RO',
  },
  {
    id: 'pl_retro_90s',
    titleRo: 'Nostalgie 90s & 2000s',
    titleEn: '90s & 2000s Throwback Classics',
    titleRu: 'Супердискотека 90-х и 2000-х',
    subtitleRo: 'Modern Talking, Akcent, O-Zone, Snap, Ace of Base, ABBA',
    subtitleEn: 'Modern Talking, Akcent, O-Zone, Snap, Ace of Base, ABBA',
    subtitleRu: 'Modern Talking, Akcent, O-Zone, Snap, Ace of Base, ABBA',
    badge: 'GOLD 90s • 00s',
    accentColor: 'from-cyan-600/35 via-[#121212] to-[#121212]',
    cover:
      'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&q=80',
    searchTerm:
      'Modern Talking, Snap, Haddaway, Akcent, O-Zone, Dr Alban, Ace of Base, Boney M, ABBA, Scooter',
    country: 'RO',
  },
  {
    id: 'pl_chill_lofi',
    titleRo: 'Chill, Lounge & Relax',
    titleEn: 'Chill Vibes & Late Night Lounge',
    titleRu: 'Чилл, Релакс & Лоу-Фай',
    subtitleRo: 'Muzică ambientală, Billie Eilish, Lana Del Rey, Lo-Fi',
    subtitleEn: 'Billie Eilish, Lana Del Rey, Cigarettes After Sex',
    subtitleRu: 'Billie Eilish, Lana Del Rey, Cigarettes After Sex',
    badge: 'CHILL & LOUNGE',
    accentColor: 'from-teal-600/35 via-[#121212] to-[#121212]',
    cover:
      'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&q=80',
    searchTerm:
      'Lana Del Rey, Billie Eilish, Cigarettes After Sex, Sade, Norah Jones, Joji, Khalid, Frank Ocean, Lorde, Hozier',
    country: 'US',
  },
];

export const SPOTIFY_ARTISTS = [
  {
    id: 'art_weeknd',
    name: 'The Weeknd',
    role: 'Cu Daft Punk, Dua Lipa, Bruno Mars și alții',
    avatar:
      'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/6f/6d/73/6f6d73f3-f166-28a1-6e2b-905337f91065/20UMGIM11048.rgb.jpg/600x600bb.jpg',
    query: 'The Weeknd',
    cardBg: 'from-[#a78bfa] to-[#4c1d95]',
  },
  {
    id: 'art_carlas',
    name: "Carla's Dreams",
    role: 'Cu Irina Rimes, The Motans, INNA și alții',
    avatar: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hq720.jpg',
    query: "Carla's Dreams",
    cardBg: 'from-[#6ee7b7] to-[#065f46]',
  },
  {
    id: 'art_irina',
    name: 'Irina Rimes',
    role: "Cu Carla's Dreams, Smiley, Delia și alții",
    avatar:
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80',
    query: 'Irina Rimes',
    cardBg: 'from-[#bef264] to-[#3f6212]',
  },
  {
    id: 'art_dualipa',
    name: 'Dua Lipa',
    role: 'Cu Calvin Harris, Elton John, Kylie Minogue și alții',
    avatar:
      'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80',
    query: 'Dua Lipa',
    cardBg: 'from-[#93c5fd] to-[#1e3a8a]',
  },
  {
    id: 'art_miyagi',
    name: 'Miyagi & Andy Panda',
    role: 'Cu Jony, Macan, Rauf & Faik și alții',
    avatar:
      'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&q=80',
    query: 'Miyagi Andy Panda',
    cardBg: 'from-[#fdba74] to-[#9a3412]',
  },
  {
    id: 'art_eminem',
    name: 'Eminem',
    role: 'Cu Dr. Dre, 50 Cent, Travis Scott și alții',
    avatar:
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80',
    query: 'Eminem',
    cardBg: 'from-[#f9a8d4] to-[#831843]',
  },
];

function formatMusicDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
}

/**
 * Proxy external HTTPS cover images through local `/api/tv-proxy` so LG webOS Smart TVs
 * (Chrome 68 with outdated 2018 root CA certificates) never fail SSL handshakes on Unsplash/Deezer/Apple CDNs.
 */
function proxyMusicCover(url?: string): string {
  if (!url) return '/icons/icon-192.png';
  if (url.startsWith('/') || url.startsWith('data:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return `/api/tv-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

interface SmartTvMusicSpotifySectionProps {
  tr: (ro: string, en: string, ru?: string) => string;
  currentTrack: SpotifyTrackItem | null;
  isPlaying: boolean;
  elapsedSec: number;
  durationSec: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  isRepeat: boolean;
  likedTracks: SpotifyTrackItem[];
  externalSearchRequest?: {
    query: string;
    label?: string;
    album?: string;
    artist?: string;
    ts: number;
  } | null;
  onPlayTrack: (track: SpotifyTrackItem, queueList?: SpotifyTrackItem[]) => void;
  onTogglePlayPause: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onSeek: (targetSec: number) => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onToggleLikeTrack: (track: SpotifyTrackItem) => void;
  onChangeVolume: (nextVol: number) => void;
  onToggleMute: () => void;
}

export const SmartTvMusicSpotifySection: React.FC<
  SmartTvMusicSpotifySectionProps
> = ({
  tr,
  currentTrack,
  isPlaying,
  elapsedSec,
  durationSec,
  volume,
  isMuted,
  isShuffle,
  isRepeat,
  likedTracks,
  externalSearchRequest,
  onPlayTrack,
  onTogglePlayPause,
  onNextTrack,
  onPrevTrack,
  onSeek,
  onToggleShuffle,
  onToggleRepeat,
  onToggleLikeTrack,
  onChangeVolume,
  onToggleMute,
}) => {
  const [activePlaylistId, setActivePlaylistId] = useState<string>(
    externalSearchRequest?.query ? 'search_results' : 'pl_global_hits'
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    externalSearchRequest?.query || ''
  );
  const [customSearchHeader, setCustomSearchHeader] = useState<string>(
    externalSearchRequest?.label || externalSearchRequest?.query || ''
  );
  const [isTvKeyboardOpen, setIsTvKeyboardOpen] = useState<boolean>(false);
  const [tracksList, setTracksList] = useState<SpotifyTrackItem[]>(
    INITIAL_SPOTIFY_TRACKS
  );
  const [suggestedTracks, setSuggestedTracks] = useState<SpotifyTrackItem[]>(
    INITIAL_SPOTIFY_TRACKS.slice(0, 6)
  );
  const [isLoadingTracks, setIsLoadingTracks] = useState<boolean>(false);
  const [isVideoClipMode, setIsVideoClipMode] = useState<boolean>(false);
  const [resolvedClipVideoId, setResolvedClipVideoId] = useState<string>('');
  const [activeAlbumCard, setActiveAlbumCard] =
    useState<MusicAlbumDetailCard | null>(null);
  const [isLoadingAlbumCard, setIsLoadingAlbumCard] = useState<boolean>(false);

  const activePlaylist = useMemo(
    () =>
      SPOTIFY_PLAYLISTS.find((p) => p.id === activePlaylistId) ||
      SPOTIFY_PLAYLISTS[0],
    [activePlaylistId]
  );

  const heroTrack = currentTrack || tracksList[0] || INITIAL_SPOTIFY_TRACKS[0];
  const effectiveDuration =
    durationSec > 0 ? durationSec : heroTrack.durationSec || 200;
  const progressPct = Math.min(
    100,
    Math.max(0, (elapsedSec / Math.max(1, effectiveDuration)) * 100)
  );

  // Load playlist tracks when activePlaylistId changes (50 tracks per playlist)
  useEffect(() => {
    if (activePlaylistId === 'search_results') {
      return;
    }
    if (activePlaylistId === 'liked_songs') {
      setTracksList(
        likedTracks.length > 0 ? likedTracks : INITIAL_SPOTIFY_TRACKS
      );
      return;
    }
    const pl = SPOTIFY_PLAYLISTS.find((p) => p.id === activePlaylistId);
    if (!pl) return;
    let cancelled = false;
    setIsLoadingTracks(true);

    const loadPlaylist50 = async () => {
      try {
        const res = await fetch(
          `/api/youtube/music-catalog?q=${encodeURIComponent(
            pl.searchTerm
          )}&playlistId=${encodeURIComponent(
            pl.id
          )}&country=${encodeURIComponent(pl.country)}&limit=50`
        );
        if (res.ok) {
          const data = await res.json();
          if (
            !cancelled &&
            data?.ok &&
            Array.isArray(data.tracks) &&
            data.tracks.length >= 10
          ) {
            setTracksList(data.tracks);
            setIsLoadingTracks(false);
            return;
          }
        }
      } catch {
        // Fallback to client-side multi-artist fetch below
      }

      const artistQueries =
        pl.searchTerm === '__GLOBAL_TOP_50__'
          ? [
              'The Weeknd',
              'Dua Lipa',
              'Bruno Mars',
              'Lady Gaga',
              'Billie Eilish',
              'Sabrina Carpenter',
              'Post Malone',
              'Rihanna',
              'Teddy Swims',
              'David Guetta',
            ]
          : pl.searchTerm
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);

      try {
        const buckets = await Promise.all(
          artistQueries.map(async (artist) => {
            try {
              const r = await fetch(
                `https://itunes.apple.com/search?term=${encodeURIComponent(
                  artist
                )}&country=${encodeURIComponent(
                  pl.country || 'RO'
                )}&media=music&entity=song&limit=10`
              );
              if (!r.ok) return [];
              const d = await r.json();
              return Array.isArray(d?.results) ? d.results : [];
            } catch {
              return [];
            }
          })
        );

        if (cancelled) return;
        const seen = new Set<string>();
        const assembled: SpotifyTrackItem[] = [];
        for (let row = 0; row < 12 && assembled.length < 50; row++) {
          for (const bucket of buckets) {
            const item = bucket[row];
            if (!item?.trackName || !item?.artistName) continue;
            const key = `${String(item.artistName).toLowerCase()}__${String(
              item.trackName
            ).toLowerCase()}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const rawArt = String(item.artworkUrl100 || '');
            const cover = rawArt
              ? rawArt.replace(/\d+x\d+bb/, '1000x1000bb')
              : pl.cover;
            const coverSmall = rawArt
              ? rawArt.replace(/\d+x\d+bb/, '300x300bb')
              : pl.cover;
            const audioQuery = `${item.artistName} - ${item.trackName} Official Audio`;
            assembled.push({
              id: `sp_${item.trackId || assembled.length}`,
              title: String(item.trackName),
              artist: String(item.artistName),
              album: String(item.collectionName || item.trackName),
              cover,
              coverSmall,
              durationSec: Math.max(
                45,
                Math.round((Number(item.trackTimeMillis) || 200000) / 1000)
              ),
              year: item.releaseDate
                ? Number(String(item.releaseDate).slice(0, 4)) || 2025
                : 2025,
              genre: String(item.primaryGenreName || 'Music'),
              previewUrl: String(item.previewUrl || ''),
              fullAudioUrl: `/api/youtube/audio?q=${encodeURIComponent(
                audioQuery
              )}`,
              videoQuery: `${item.artistName} - ${item.trackName}`,
            });
            if (assembled.length >= 50) break;
          }
        }
        if (!cancelled && assembled.length > 0) {
          setTracksList(assembled);
        }
      } finally {
        if (!cancelled) setIsLoadingTracks(false);
      }
    };

    loadPlaylist50();
    return () => {
      cancelled = true;
    };
  }, [activePlaylistId, likedTracks]);

  // Dynamically fetch smart suggestions ("Mixurile tale de top") based on currently playing artist
  useEffect(() => {
    const seedArtist =
      currentTrack?.artist || 'The Weeknd, Dua Lipa, Bruno Mars, Lady Gaga';
    let cancelled = false;
    fetch(
      `/api/youtube/music-catalog?q=${encodeURIComponent(
        seedArtist
      )}&country=RO&limit=14`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.ok && Array.isArray(data.tracks) && data.tracks.length > 0) {
          const filtered = data.tracks.filter(
            (t: SpotifyTrackItem) => t.title !== currentTrack?.title
          );
          if (filtered.length > 0) {
            setSuggestedTracks(filtered.slice(0, 6));
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.artist, currentTrack?.title]);

  // Resolve videoId when Video Clip Mode is enabled
  useEffect(() => {
    if (!isVideoClipMode || !heroTrack) return;
    if (heroTrack.videoId) {
      setResolvedClipVideoId(heroTrack.videoId);
      return;
    }
    let cancelled = false;
    const q =
      heroTrack.videoQuery ||
      `${heroTrack.artist} - ${heroTrack.title} Official Video`;
    fetch(`/api/youtube/search?q=${encodeURIComponent(q)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const firstId = data?.items?.[0]?.videoId;
        if (firstId) setResolvedClipVideoId(firstId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isVideoClipMode, heroTrack]);

  const handleRunSearch = (
    customQuery?: string,
    customLabel?: string,
    scrollToTop = true
  ) => {
    const q = (customQuery ?? searchQuery).trim();
    if (!q) {
      setActivePlaylistId('pl_global_hits');
      return;
    }
    if (customQuery !== undefined) {
      setSearchQuery(q);
    }
    setCustomSearchHeader(customLabel || q);
    setActivePlaylistId('search_results');
    setIsLoadingTracks(true);
    if (scrollToTop && typeof document !== 'undefined') {
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
    fetch(
      `/api/youtube/music-catalog?q=${encodeURIComponent(
        q
      )}&country=RO&limit=50`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then(async (data) => {
        if (data?.ok && Array.isArray(data.tracks) && data.tracks.length > 0) {
          setTracksList(data.tracks);
          return;
        }
        try {
          const itRes = await fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(
              q
            )}&country=RO&media=music&entity=song&limit=50`
          );
          if (!itRes.ok) return;
          const itData = await itRes.json();
          const results = Array.isArray(itData?.results) ? itData.results : [];
          const mapped: SpotifyTrackItem[] = results
            .filter((item: any) => item?.trackName && item?.artistName)
            .map((item: any, idx: number) => {
              const rawArt = String(item.artworkUrl100 || '');
              const audioQuery = `${item.artistName} - ${item.trackName} Official Audio`;
              return {
                id: `sp_${item.trackId || idx}`,
                title: String(item.trackName),
                artist: String(item.artistName),
                album: String(item.collectionName || item.trackName),
                cover: rawArt
                  ? rawArt.replace(/\d+x\d+bb/, '1000x1000bb')
                  : INITIAL_SPOTIFY_TRACKS[0].cover,
                coverSmall: rawArt
                  ? rawArt.replace(/\d+x\d+bb/, '300x300bb')
                  : INITIAL_SPOTIFY_TRACKS[0].cover,
                durationSec: Math.max(
                  45,
                  Math.round((Number(item.trackTimeMillis) || 200000) / 1000)
                ),
                year: item.releaseDate
                  ? Number(String(item.releaseDate).slice(0, 4)) || 2025
                  : 2025,
                genre: String(item.primaryGenreName || 'Music'),
                previewUrl: String(item.previewUrl || ''),
                fullAudioUrl: `/api/youtube/audio?q=${encodeURIComponent(
                  audioQuery
                )}`,
                videoQuery: `${item.artistName} - ${item.trackName}`,
              };
            });
          if (mapped.length > 0) {
            setTracksList(mapped);
          }
        } catch {
          // ignore
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsLoadingTracks(false);
      });
  };

  // Live Spotify-style debounced search as the user types
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      if (activePlaylistId === 'search_results') {
        setActivePlaylistId('pl_global_hits');
      }
      return;
    }
    if (trimmed.length < 2) return;
    const timer = window.setTimeout(() => {
      handleRunSearch(trimmed, trimmed, false);
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const handleOpenAlbumCard = async (
    albumName: string,
    artistName: string,
    fallbackTrack?: SpotifyTrackItem
  ) => {
    const cleanAlbum = (albumName || fallbackTrack?.album || '').trim();
    const cleanArtist = (artistName || fallbackTrack?.artist || '').trim();
    if (!cleanAlbum && !cleanArtist) return;

    setIsLoadingAlbumCard(true);
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
    const initialTracks = fallbackTrack ? [fallbackTrack] : [];
    setActiveAlbumCard({
      albumTitle: cleanAlbum || cleanArtist,
      artistName: cleanArtist,
      coverUrl: fallbackTrack?.cover || INITIAL_SPOTIFY_TRACKS[0].cover,
      year: fallbackTrack?.year || 2025,
      genre: fallbackTrack?.genre || 'Music',
      trackCount: initialTracks.length,
      totalDurationSec: fallbackTrack?.durationSec || 200,
      tracks: initialTracks,
    });

    try {
      const searchTerm = `${cleanArtist} ${cleanAlbum}`.trim();
      let collectionMeta: any = null;
      let rawTrackItems: any[] = [];

      const albumSearchRes = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(
          searchTerm
        )}&media=music&entity=album&limit=10`
      );
      if (albumSearchRes.ok) {
        const albumSearchData = await albumSearchRes.json();
        const albums = Array.isArray(albumSearchData?.results)
          ? albumSearchData.results
          : [];
        const normAlbum = cleanAlbum.toLowerCase();
        const normArtist = cleanArtist.toLowerCase();
        collectionMeta =
          albums.find(
            (a: any) =>
              String(a.collectionName || '')
                .toLowerCase()
                .includes(normAlbum) &&
              String(a.artistName || '')
                .toLowerCase()
                .includes(normArtist)
          ) ||
          albums.find((a: any) =>
            String(a.collectionName || '')
              .toLowerCase()
              .includes(normAlbum)
          ) ||
          albums[0];

        if (collectionMeta?.collectionId) {
          const lookupRes = await fetch(
            `https://itunes.apple.com/lookup?id=${encodeURIComponent(
              String(collectionMeta.collectionId)
            )}&entity=song&limit=100`
          );
          if (lookupRes.ok) {
            const lookupData = await lookupRes.json();
            const lookupResults = Array.isArray(lookupData?.results)
              ? lookupData.results
              : [];
            const colEntry = lookupResults.find(
              (r: any) => r.wrapperType === 'collection'
            );
            if (colEntry) collectionMeta = colEntry;
            rawTrackItems = lookupResults.filter(
              (r: any) => r.wrapperType === 'track' && r.trackName
            );
          }
        }
      }

      if (rawTrackItems.length === 0) {
        const songRes = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(
            searchTerm
          )}&media=music&entity=song&limit=40`
        );
        if (songRes.ok) {
          const songData = await songRes.json();
          const allSongs = Array.isArray(songData?.results)
            ? songData.results
            : [];
          const normAlbum = cleanAlbum.toLowerCase();
          const matchingAlbumSongs = allSongs.filter((s: any) =>
            String(s.collectionName || '')
              .toLowerCase()
              .includes(normAlbum)
          );
          rawTrackItems =
            matchingAlbumSongs.length > 0
              ? matchingAlbumSongs
              : allSongs.slice(0, 20);
        }
      }

      const firstItem = collectionMeta || rawTrackItems[0] || {};
      const rawArt = String(
        firstItem.artworkUrl100 ||
          rawTrackItems[0]?.artworkUrl100 ||
          fallbackTrack?.cover ||
          ''
      );
      const hiResCover = rawArt
        ? rawArt.replace(/\d+x\d+bb/, '1000x1000bb')
        : fallbackTrack?.cover || INITIAL_SPOTIFY_TRACKS[0].cover;
      const relDateRaw = String(
        firstItem.releaseDate || rawTrackItems[0]?.releaseDate || ''
      );
      const parsedYear = relDateRaw
        ? Number(relDateRaw.slice(0, 4)) || fallbackTrack?.year || 2025
        : fallbackTrack?.year || 2025;
      const formattedDate = relDateRaw
        ? relDateRaw.slice(0, 10).split('-').reverse().join('.')
        : '';

      const mappedAlbumTracks: SpotifyTrackItem[] = rawTrackItems.map(
        (item: any, idx: number) => {
          const tArt = String(item.artworkUrl100 || '');
          const audioQuery = `${item.artistName || cleanArtist} - ${item.trackName} Official Audio`;
          return {
            id: `alb_sp_${item.trackId || idx}`,
            title: String(item.trackName),
            artist: String(item.artistName || cleanArtist),
            album: String(
              item.collectionName ||
                firstItem.collectionName ||
                cleanAlbum ||
                item.trackName
            ),
            cover: tArt
              ? tArt.replace(/\d+x\d+bb/, '1000x1000bb')
              : hiResCover,
            coverSmall: tArt
              ? tArt.replace(/\d+x\d+bb/, '300x300bb')
              : hiResCover,
            durationSec: Math.max(
              35,
              Math.round((Number(item.trackTimeMillis) || 200000) / 1000)
            ),
            year: item.releaseDate
              ? Number(String(item.releaseDate).slice(0, 4)) || parsedYear
              : parsedYear,
            genre: String(
              item.primaryGenreName ||
                firstItem.primaryGenreName ||
                fallbackTrack?.genre ||
                'Music'
            ),
            previewUrl: String(item.previewUrl || ''),
            fullAudioUrl: `/api/youtube/audio?q=${encodeURIComponent(
              audioQuery
            )}`,
            videoQuery: `${item.artistName || cleanArtist} - ${item.trackName}`,
          };
        }
      );

      const finalTracks =
        mappedAlbumTracks.length > 0 ? mappedAlbumTracks : initialTracks;
      const totalDur = finalTracks.reduce(
        (acc, t) => acc + (t.durationSec || 0),
        0
      );

      setActiveAlbumCard({
        albumTitle: String(
          firstItem.collectionName || cleanAlbum || cleanArtist
        ),
        artistName: String(firstItem.artistName || cleanArtist),
        coverUrl: hiResCover,
        year: parsedYear,
        releaseDateText: formattedDate || undefined,
        genre: String(
          firstItem.primaryGenreName ||
            finalTracks[0]?.genre ||
            fallbackTrack?.genre ||
            'Music'
        ),
        copyright: firstItem.copyright
          ? String(firstItem.copyright)
          : undefined,
        country: firstItem.country ? String(firstItem.country) : undefined,
        trackCount: finalTracks.length,
        totalDurationSec: totalDur,
        tracks: finalTracks,
      });
    } catch {
      // keep fallback album card
    } finally {
      setIsLoadingAlbumCard(false);
    }
  };

  // React to external search requests (e.g. clicking a song, artist, or album in Radio)
  useEffect(() => {
    if (externalSearchRequest?.album) {
      void handleOpenAlbumCard(
        externalSearchRequest.album,
        externalSearchRequest.artist || externalSearchRequest.query
      );
      return;
    }
    if (externalSearchRequest?.query) {
      handleRunSearch(
        externalSearchRequest.query,
        externalSearchRequest.label || externalSearchRequest.query
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    externalSearchRequest?.ts,
    externalSearchRequest?.query,
    externalSearchRequest?.album,
  ]);

  const isHeroLiked = likedTracks.some((t) => t.id === heroTrack.id);
  const isSearchMode =
    activePlaylistId === 'search_results' || searchQuery.trim().length >= 2;

  return (
    <div className="min-h-full flex-1 flex flex-col justify-between bg-[#121212] text-white relative select-none">
      {/* Subtle Spotify Top Ambient Gradient */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b ${
          activePlaylist?.accentColor ||
          'from-emerald-700/30 via-[#121212] to-[#121212]'
        } transition-colors duration-700`}
      />

      {/* ====================================================================
          1. SPOTIFY STICKY TOP BAR (HOME BUTTON + PILL SEARCH + FILTER CHIPS)
         ==================================================================== */}
      <div
        data-top-hero-card="true"
        className="sticky top-0 z-30 w-full px-3 sm:px-6 pt-2.5 pb-2.5 bg-[#121212]/95 backdrop-blur-xl border-b border-white/[0.07] space-y-2.5"
      >
        {/* Optional Official HD Music Video Clip Player inside Top Bar */}
        {isVideoClipMode && resolvedClipVideoId && (
          <div className="relative z-10 rounded-xl overflow-hidden border border-white/15 bg-black h-[190px] sm:h-[260px] lg:h-[300px] max-w-3xl mx-auto w-full shadow-2xl">
            <video
              key={`clip_${resolvedClipVideoId}`}
              src={`/api/youtube/stream?id=${encodeURIComponent(
                resolvedClipVideoId
              )}`}
              controls
              autoPlay
              muted={isPlaying}
              className="w-full h-full object-contain bg-black"
            />
          </div>
        )}

        {/* 1A. SPOTIFY HOME ICON + SEARCH PILL + KEYBOARD + LIKED SONGS */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Spotify Home Circle Button */}
          <button
            type="button"
            title={tr('Acasă Muzică', 'Music Home', 'Главная Музыка')}
            onClick={() => {
              setSearchQuery('');
              setActiveAlbumCard(null);
              setActivePlaylistId('pl_global_hits');
              document
                .querySelector('main')
                ?.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#1f1f1f] hover:bg-[#2a2a2a] focus:bg-white focus:text-black text-white inline-flex items-center justify-center shrink-0 transition-all cursor-pointer focus:outline-none"
          >
            <Home className="w-5 h-5" />
          </button>

          {/* Spotify Search Input Pill */}
          <div className="relative flex-1 max-w-2xl">
            <Search className="w-4 h-4 sm:w-5 sm:h-5 text-[#b3b3b3] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRunSearch();
                }
              }}
              placeholder={tr(
                'Ce dorești să asculți?',
                'What do you want to play?',
                'Что хочешь послушать?'
              )}
              className="w-full h-10 sm:h-11 pl-10 sm:pl-11 pr-24 rounded-full bg-[#1f1f1f] hover:bg-[#2a2a2a] focus:bg-[#242424] text-xs sm:text-sm text-white placeholder-[#b3b3b3] focus:outline-none focus:ring-2 focus:ring-white transition-colors"
            />
            {searchQuery.trim().length > 0 && (
              <button
                type="button"
                title={tr('Șterge căutarea', 'Clear search', 'Очистить поиск')}
                onClick={() => {
                  setSearchQuery('');
                  setActivePlaylistId('pl_global_hits');
                }}
                className="absolute right-[74px] top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-[#b3b3b3] hover:text-white inline-flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <span
              aria-hidden="true"
              className="absolute right-[66px] top-1/2 -translate-y-1/2 h-5 w-px bg-white/15 pointer-events-none"
            />
            <button
              type="button"
              onClick={() => handleRunSearch()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 sm:h-8 px-3 rounded-full bg-white/10 hover:bg-white hover:text-black focus:bg-white focus:text-black text-white text-xs font-bold transition-colors cursor-pointer"
            >
              {tr('Caută', 'Search', 'Найти')}
            </button>
          </div>

          <button
            type="button"
            title={tr('Tastatură TV', 'TV Keyboard', 'ТВ Клавиатура')}
            onClick={() => setIsTvKeyboardOpen((v) => !v)}
            className="hidden sm:inline-flex h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-[#1f1f1f] hover:bg-[#2a2a2a] focus:bg-white focus:text-black text-[#b3b3b3] hover:text-white items-center justify-center shrink-0 transition-colors cursor-pointer"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActiveAlbumCard(null);
              setActivePlaylistId('liked_songs');
            }}
            className={`h-10 sm:h-11 px-3.5 sm:px-4 rounded-full text-xs font-bold inline-flex items-center justify-center gap-2 shrink-0 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-white ${
              activePlaylistId === 'liked_songs'
                ? 'bg-white text-black shadow'
                : 'bg-[#1f1f1f] hover:bg-[#2a2a2a] text-white'
            }`}
          >
            <Heart
              className={`w-4 h-4 ${
                activePlaylistId === 'liked_songs'
                  ? 'fill-[#1ed760] text-[#1ed760]'
                  : 'fill-[#1ed760] text-[#1ed760]'
              }`}
            />
            <span className="hidden md:inline">
              {tr('Melodii îndrăgite', 'Liked Songs', 'Любимые треки')}
            </span>
            <span className="tabular-nums">{likedTracks.length}</span>
          </button>
        </div>

        {/* On-Screen Smart TV Keyboard for Remote Search */}
        {isTvKeyboardOpen && (
          <div className="p-2.5 rounded-xl bg-[#181818] border border-white/10 space-y-2">
            <div className="flex flex-wrap gap-1">
              {'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('').map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setSearchQuery((prev) => prev + ch)}
                  className="w-8 h-8 rounded-lg bg-[#282828] hover:bg-white hover:text-black focus:bg-white focus:text-black text-xs font-bold text-white inline-flex items-center justify-center cursor-pointer"
                >
                  {ch}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSearchQuery((prev) => prev + ' ')}
                className="px-3 h-8 rounded-lg bg-[#282828] hover:bg-white hover:text-black text-xs font-bold text-white cursor-pointer"
              >
                SPACE
              </button>
              <button
                type="button"
                onClick={() => setSearchQuery((prev) => prev.slice(0, -1))}
                className="px-2.5 h-8 rounded-lg bg-[#282828] hover:bg-rose-500 text-xs font-bold text-white inline-flex items-center justify-center cursor-pointer"
              >
                <Delete className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleRunSearch()}
                className="px-3 h-8 rounded-lg bg-[#1ed760] text-black text-xs font-bold cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* 1B. SPOTIFY FILTER PILLS ("Toate", "Muzică", Playlists) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            data-vod-card={
              activePlaylistId === 'pl_global_hits' && !isSearchMode
                ? 'true'
                : undefined
            }
            onClick={() => {
              setSearchQuery('');
              setActiveAlbumCard(null);
              setActivePlaylistId('pl_global_hits');
            }}
            className={`h-8 px-3.5 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-white ${
              activePlaylistId === 'pl_global_hits' && !isSearchMode
                ? 'bg-white text-black font-bold'
                : 'bg-white/[0.08] hover:bg-white/[0.14] text-white'
            }`}
          >
            {tr('Toate', 'All', 'Все')}
          </button>

          {isSearchMode && (
            <button
              type="button"
              data-vod-card="true"
              onClick={() => {
                setSearchQuery('');
                setActivePlaylistId('pl_global_hits');
              }}
              className="h-8 px-3.5 rounded-full bg-[#1ed760] text-black text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Search className="w-3 h-3" />
              <span className="max-w-[160px] truncate">
                {customSearchHeader || searchQuery}
              </span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {SPOTIFY_PLAYLISTS.slice(1).map((pl) => {
            const isSelected = activePlaylistId === pl.id && !isSearchMode;
            return (
              <button
                key={`chip_${pl.id}`}
                type="button"
                data-vod-card={isSelected ? 'true' : undefined}
                onClick={() => {
                  setSearchQuery('');
                  setActiveAlbumCard(null);
                  setActivePlaylistId(pl.id);
                }}
                className={`h-8 px-3.5 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-white ${
                  isSelected
                    ? 'bg-white text-black font-bold'
                    : 'bg-white/[0.08] hover:bg-white/[0.14] text-white'
                }`}
              >
                {tr(pl.titleRo, pl.titleEn, pl.titleRu)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ====================================================================
          2. MAIN SPOTIFY CONTENT AREA
         ==================================================================== */}
      <div className="relative z-10 flex-1 px-3 sm:px-6 pt-3 pb-6 space-y-6">
        {/* 2A. ALBUM DETAIL VIEW (When user clicks an album) */}
        {activeAlbumCard && (
          <div className="rounded-xl bg-gradient-to-b from-[#282828] via-[#181818] to-[#121212] p-4 sm:p-6 border border-white/10 shadow-2xl space-y-5">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5">
              <img
                src={proxyMusicCover(activeAlbumCard.coverUrl)}
                alt={activeAlbumCard.albumTitle}
                className="w-32 h-32 sm:w-44 sm:h-44 rounded-md object-cover shadow-[0_12px_36px_rgba(0,0,0,0.7)] shrink-0"
              />
              <div className="flex-1 min-w-0 text-center sm:text-left space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                  {tr('Album', 'Album', 'Альбом')}
                </div>
                <h2 className="text-xl sm:text-3xl lg:text-4xl font-black text-white leading-tight truncate">
                  {activeAlbumCard.albumTitle}
                </h2>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 text-xs sm:text-sm text-[#b3b3b3]">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveAlbumCard(null);
                      handleRunSearch(activeAlbumCard.artistName);
                    }}
                    className="font-bold text-white hover:underline cursor-pointer"
                  >
                    {activeAlbumCard.artistName}
                  </button>
                  <span>•</span>
                  <span>{activeAlbumCard.year}</span>
                  <span>•</span>
                  <span>
                    {activeAlbumCard.trackCount}{' '}
                    {tr('melodii', 'songs', 'треков')},{' '}
                    {Math.max(
                      1,
                      Math.round(activeAlbumCard.totalDurationSec / 60)
                    )}{' '}
                    min
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (activeAlbumCard.tracks.length > 0) {
                      onPlayTrack(
                        activeAlbumCard.tracks[0],
                        activeAlbumCard.tracks
                      );
                    }
                  }}
                  style={{ backgroundColor: '#1ed760', color: '#000000' }}
                  className="w-12 h-12 rounded-full bg-[#1ed760] hover:scale-105 text-black inline-flex items-center justify-center shadow-xl transition-transform cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current text-black ml-0.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAlbumCard(null)}
                  className="h-9 px-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>{tr('Închide', 'Close', 'Закрыть')}</span>
                </button>
              </div>
            </div>

            {isLoadingAlbumCard ? (
              <div className="py-6 flex items-center justify-center gap-2 text-xs text-[#b3b3b3]">
                <Loader2 className="w-4 h-4 animate-spin text-[#1ed760]" />
                <span>
                  {tr(
                    'Se încarcă melodiile albumului...',
                    'Loading album tracks...',
                    'Загрузка треков альбома...'
                  )}
                </span>
              </div>
            ) : (
              <div className="space-y-0.5">
                {activeAlbumCard.tracks.map((aTrack, aIdx) => {
                  const isCurrent = currentTrack?.id === aTrack.id;
                  const isLiked = likedTracks.some((t) => t.id === aTrack.id);
                  return (
                    <div
                      key={aTrack.id}
                      className={`px-3 py-2 rounded-md flex items-center justify-between gap-3 transition-colors ${
                        isCurrent ? 'bg-white/[0.12]' : 'hover:bg-white/[0.08]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          onPlayTrack(aTrack, activeAlbumCard.tracks)
                        }
                        className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer focus:outline-none"
                      >
                        <span
                          className={`w-6 text-center text-xs tabular-nums ${
                            isCurrent
                              ? 'text-[#1ed760] font-bold'
                              : 'text-[#b3b3b3]'
                          }`}
                        >
                          {aIdx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div
                            className={`text-sm font-medium truncate ${
                              isCurrent ? 'text-[#1ed760]' : 'text-white'
                            }`}
                          >
                            {aTrack.title}
                          </div>
                          <div className="text-xs text-[#b3b3b3] truncate">
                            {aTrack.artist}
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => onToggleLikeTrack(aTrack)}
                          className={`cursor-pointer ${
                            isLiked
                              ? 'text-[#1ed760]'
                              : 'text-[#b3b3b3] hover:text-white'
                          }`}
                        >
                          <Heart
                            className={`w-4 h-4 ${
                              isLiked ? 'fill-current' : ''
                            }`}
                          />
                        </button>
                        <span className="text-xs text-[#b3b3b3] tabular-nums w-10 text-right">
                          {formatMusicDuration(aTrack.durationSec)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 2B. SPOTIFY SEARCH RESULTS VIEW (Shown immediately at the top when searching!) */}
        {isSearchMode && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Top Result Card (Left 5 cols) */}
            {tracksList[0] && (
              <div className="lg:col-span-5 flex flex-col gap-2.5">
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  {tr('Rezultat de top', 'Top result', 'Лучший результат')}
                </h2>
                <div
                  onClick={() => onPlayTrack(tracksList[0], tracksList)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onPlayTrack(tracksList[0], tracksList);
                    }
                  }}
                  className="relative flex-1 rounded-lg bg-[#181818] hover:bg-[#282828] focus:bg-[#282828] focus:outline-none focus:ring-2 focus:ring-white p-5 flex flex-col justify-between gap-4 transition-colors group cursor-pointer"
                >
                  <img
                    src={proxyMusicCover(tracksList[0].cover)}
                    alt={tracksList[0].title}
                    className="w-24 h-24 rounded-md object-cover shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
                  />
                  <div className="space-y-1 pr-14">
                    <div className="text-xl sm:text-2xl font-black text-white truncate">
                      {tracksList[0].title}
                    </div>
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-[#b3b3b3]">
                      <span className="px-2.5 py-0.5 rounded-full bg-black/40 text-white font-bold text-xs">
                        {tr('Melodie', 'Song', 'Трек')}
                      </span>
                      <span className="font-semibold text-white truncate">
                        {tracksList[0].artist}
                      </span>
                    </div>
                  </div>
                  <div
                    style={{ backgroundColor: '#1ed760', color: '#000000' }}
                    className="absolute right-5 bottom-5 w-12 h-12 rounded-full bg-[#1ed760] text-black flex items-center justify-center shadow-[0_8px_16px_rgba(0,0,0,0.4)] group-hover:scale-105 transition-transform"
                  >
                    <Play className="w-5 h-5 fill-current text-black ml-0.5" />
                  </div>
                </div>
              </div>
            )}

            {/* Top 4 Songs (Right 7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-2.5">
              <h2 className="text-lg sm:text-xl font-bold text-white">
                {tr('Melodii', 'Songs', 'Треки')}
              </h2>
              <div className="rounded-lg bg-[#181818]/60 p-2 space-y-1">
                {tracksList.slice(0, 4).map((track) => {
                  const isCurrent = currentTrack?.id === track.id;
                  const isLiked = likedTracks.some((t) => t.id === track.id);
                  return (
                    <div
                      key={`top_sr_${track.id}`}
                      className={`px-2.5 py-1.5 rounded-md flex items-center justify-between gap-3 transition-colors ${
                        isCurrent ? 'bg-white/[0.12]' : 'hover:bg-white/[0.08]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onPlayTrack(track, tracksList)}
                        className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-white rounded"
                      >
                        <img
                          src={proxyMusicCover(track.coverSmall || track.cover)}
                          alt={track.title}
                          className="w-10 h-10 rounded object-cover shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div
                            className={`text-sm font-medium truncate ${
                              isCurrent ? 'text-[#1ed760]' : 'text-white'
                            }`}
                          >
                            {track.title}
                          </div>
                          <div className="text-xs text-[#b3b3b3] truncate">
                            {track.artist}
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => onToggleLikeTrack(track)}
                          className={`cursor-pointer ${
                            isLiked
                              ? 'text-[#1ed760]'
                              : 'text-[#b3b3b3] hover:text-white'
                          }`}
                        >
                          <Heart
                            className={`w-4 h-4 ${
                              isLiked ? 'fill-current' : ''
                            }`}
                          />
                        </button>
                        <span className="text-xs text-[#b3b3b3] tabular-nums w-10 text-right">
                          {formatMusicDuration(track.durationSec)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 2C. SPOTIFY 2x4 QUICK-ACCESS TOP GRID (Just like Spotify Home!) */}
        {!isSearchMode && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {/* Card 1: Melodii îndrăgite (Liked Songs) */}
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActivePlaylistId('liked_songs');
              }}
              className={`h-14 sm:h-16 rounded-md overflow-hidden flex items-center justify-between pr-3 transition-all group cursor-pointer focus:outline-none focus:ring-2 focus:ring-white ${
                activePlaylistId === 'liked_songs'
                  ? 'bg-white/[0.2]'
                  : 'bg-white/[0.07] hover:bg-white/[0.16]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-[#450af5] via-[#7c3aed] to-[#c4efd9] flex items-center justify-center shrink-0 shadow-[4px_0_12px_rgba(0,0,0,0.45)]">
                  <Heart className="w-6 h-6 text-white fill-white" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-white line-clamp-2 text-left">
                  {tr('Melodii îndrăgite', 'Liked Songs', 'Любимые треки')}
                </span>
              </div>
              <div
                style={{ backgroundColor: '#1ed760', color: '#000000' }}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#1ed760] text-black flex items-center justify-center shadow-[0_8px_16px_rgba(0,0,0,0.4)] opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity shrink-0 ml-2"
              >
                <Play className="w-4 h-4 fill-current text-black ml-0.5" />
              </div>
            </button>

            {/* Cards 2–8: Top 7 Playlists */}
            {SPOTIFY_PLAYLISTS.slice(0, 7).map((pl) => {
              const isSelected = activePlaylistId === pl.id;
              return (
                <button
                  key={`quick_${pl.id}`}
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActivePlaylistId(pl.id);
                  }}
                  className={`h-14 sm:h-16 rounded-md overflow-hidden flex items-center justify-between pr-3 transition-all group cursor-pointer focus:outline-none focus:ring-2 focus:ring-white ${
                    isSelected
                      ? 'bg-white/[0.2]'
                      : 'bg-white/[0.07] hover:bg-white/[0.16]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img
                      src={proxyMusicCover(pl.cover)}
                      alt={tr(pl.titleRo, pl.titleEn, pl.titleRu)}
                      className="w-14 h-14 sm:w-16 sm:h-16 object-cover shrink-0 shadow-[4px_0_12px_rgba(0,0,0,0.45)]"
                    />
                    <span className="text-xs sm:text-sm font-bold text-white line-clamp-2 text-left">
                      {tr(pl.titleRo, pl.titleEn, pl.titleRu)}
                    </span>
                  </div>
                  <div
                    style={{ backgroundColor: '#1ed760', color: '#000000' }}
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#1ed760] text-black flex items-center justify-center shadow-[0_8px_16px_rgba(0,0,0,0.4)] transition-opacity shrink-0 ml-2 ${
                      isSelected && isPlaying
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100 group-focus:opacity-100'
                    }`}
                  >
                    <Play className="w-4 h-4 fill-current text-black ml-0.5" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 2D. SPOTIFY "POSTURI RECOMANDATE" (Square Artist Radio Cards Shelf) */}
        {!isSearchMode && (
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-[11px] sm:text-xs text-[#b3b3b3]">
                  {tr(
                    'Opțiuni muzicale nelimitate bazate pe melodiile și artiștii tăi preferați.',
                    'Non-stop music based on your favorite songs and artists.',
                    'Бесконечная музыка на основе ваших любимых треков и артистов.'
                  )}
                </p>
                <h2 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight mt-0.5">
                  {tr(
                    'Posturi recomandate',
                    'Recommended Stations',
                    'Рекомендуемые радиостанции'
                  )}
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {SPOTIFY_ARTISTS.map((art) => (
                <button
                  key={art.id}
                  type="button"
                  onClick={() => {
                    setSearchQuery(art.query);
                    handleRunSearch(art.query, art.name, false);
                  }}
                  className="p-3 rounded-lg bg-[#181818] hover:bg-[#282828] focus:bg-[#282828] focus:outline-none focus:ring-2 focus:ring-white transition-colors text-left group cursor-pointer flex flex-col"
                >
                  <div
                    className={`relative aspect-square w-full rounded-md overflow-hidden mb-3 bg-gradient-to-br ${art.cardBg} p-3 flex flex-col justify-between shadow-[0_8px_24px_rgba(0,0,0,0.5)]`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-black/80">
                      <span className="w-4 h-4 rounded-full bg-black/80 text-white inline-flex items-center justify-center text-[9px]">
                        S
                      </span>
                      <span>RADIO</span>
                    </div>
                    <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full overflow-hidden ring-4 ring-black/20 shadow-xl">
                      <img
                        src={proxyMusicCover(art.avatar)}
                        alt={art.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="text-sm sm:text-base font-black text-black truncate">
                      {art.name}
                    </div>

                    {/* Hover Spotify Green Play Button */}
                    <div
                      style={{ backgroundColor: '#1ed760', color: '#000000' }}
                      className="absolute right-2.5 bottom-2.5 w-11 h-11 rounded-full bg-[#1ed760] text-black flex items-center justify-center shadow-[0_8px_16px_rgba(0,0,0,0.45)] opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-focus:opacity-100 group-focus:translate-y-0 transition-all"
                    >
                      <Play className="w-5 h-5 fill-current text-black ml-0.5" />
                    </div>
                  </div>

                  <div className="text-xs text-[#a7a7a7] line-clamp-2 leading-relaxed">
                    {art.role}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 2E. ACTIVE SPOTIFY PLAYLIST & CLEAN TRACKLIST TABLE */}
        <div className="rounded-xl bg-[#181818]/90 border border-white/[0.06] overflow-hidden shadow-xl">
          {/* Playlist Header Banner */}
          <div className="p-4 sm:p-6 bg-gradient-to-b from-white/[0.07] to-transparent flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {activePlaylistId === 'liked_songs' ? (
                <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-md bg-gradient-to-br from-[#450af5] via-[#7c3aed] to-[#c4efd9] flex items-center justify-center shrink-0 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
                  <Heart className="w-8 h-8 sm:w-10 sm:h-10 text-white fill-white" />
                </div>
              ) : (
                <img
                  src={proxyMusicCover(
                    activePlaylistId === 'search_results'
                      ? heroTrack.cover
                      : activePlaylist.cover
                  )}
                  alt=""
                  className="w-16 h-16 sm:w-24 sm:h-24 rounded-md object-cover shrink-0 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
                />
              )}

              <div className="min-w-0 space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-white/75">
                  {activePlaylistId === 'search_results'
                    ? tr('Rezultate Căutare', 'Search Results', 'Результаты поиска')
                    : tr('Playlist Public', 'Public Playlist', 'Плейлист')}
                </div>
                <h2 className="text-lg sm:text-2xl lg:text-3xl font-black text-white truncate">
                  {activePlaylistId === 'search_results'
                    ? customSearchHeader || searchQuery
                    : activePlaylistId === 'liked_songs'
                      ? tr('Melodii îndrăgite', 'Liked Songs', 'Любимые треки')
                      : tr(
                          activePlaylist.titleRo,
                          activePlaylist.titleEn,
                          activePlaylist.titleRu
                        )}
                </h2>
                <p className="text-xs text-[#b3b3b3] truncate">
                  {activePlaylistId === 'search_results'
                    ? `${tracksList.length} ${tr('melodii găsite', 'songs found', 'треков найдено')}`
                    : activePlaylistId === 'liked_songs'
                      ? `${likedTracks.length} ${tr('melodii salvate', 'saved songs', 'сохраненных треков')}`
                      : `${tr(
                          activePlaylist.subtitleRo,
                          activePlaylist.subtitleEn,
                          activePlaylist.subtitleRu
                        )} • ${tracksList.length} ${tr('melodii', 'songs', 'треков')}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {isLoadingTracks && (
                <Loader2 className="w-5 h-5 text-[#1ed760] animate-spin" />
              )}
              <button
                type="button"
                title={tr('Amestecare', 'Shuffle', 'Перемешать')}
                onClick={onToggleShuffle}
                className={`w-10 h-10 rounded-full inline-flex items-center justify-center transition-colors cursor-pointer ${
                  isShuffle
                    ? 'text-[#1ed760] bg-white/10'
                    : 'text-[#b3b3b3] hover:text-white bg-white/[0.05]'
                }`}
              >
                <Shuffle className="w-4 h-4" />
              </button>
              <button
                type="button"
                title={tr('Redă Tot', 'Play All', 'Слушать всё')}
                onClick={() => {
                  if (tracksList.length > 0) {
                    onPlayTrack(tracksList[0], tracksList);
                  }
                }}
                style={{ backgroundColor: '#1ed760', color: '#000000' }}
                className="w-12 h-12 rounded-full bg-[#1ed760] hover:scale-105 text-black inline-flex items-center justify-center shadow-[0_8px_20px_rgba(0,0,0,0.45)] transition-transform cursor-pointer focus:outline-none focus:ring-2 focus:ring-white"
              >
                <Play className="w-5 h-5 fill-current text-black ml-0.5" />
              </button>
            </div>
          </div>

          {/* Spotify Tracklist Table Header */}
          <div className="px-4 sm:px-6 py-2 border-b border-white/10 grid grid-cols-[28px_1fr_auto] md:grid-cols-[32px_1.6fr_1fr_80px] items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-[#b3b3b3]">
            <span className="text-center">#</span>
            <span>{tr('Titlu', 'Title', 'Название')}</span>
            <span className="hidden md:block">
              {tr('Album', 'Album', 'Альбом')}
            </span>
            <span className="flex justify-end pr-1">
              <Clock className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Spotify Tracklist Rows */}
          <div className="p-2 sm:px-4 sm:py-2 space-y-0.5">
            {tracksList.map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;
              const isLiked = likedTracks.some((t) => t.id === track.id);
              const cleanAlbumTitle =
                track.album
                  ?.replace(/\s*-\s*Single$/i, '')
                  .trim() || track.title;

              return (
                <div
                  key={track.id}
                  className={`px-2 sm:px-3 py-1.5 rounded-md grid grid-cols-[28px_1fr_auto] md:grid-cols-[32px_1.6fr_1fr_80px] items-center gap-3 transition-colors group ${
                    isCurrent ? 'bg-white/[0.12]' : 'hover:bg-white/[0.08]'
                  }`}
                >
                  {/* Column 1: # or Spotify Green Equalizer */}
                  <button
                    type="button"
                    onClick={() => onPlayTrack(track, tracksList)}
                    className="w-full flex items-center justify-center text-center cursor-pointer focus:outline-none"
                  >
                    {isCurrent && isPlaying ? (
                      <div className="inline-flex items-end gap-0.5 h-3.5">
                        <span className="w-0.5 h-full bg-[#1ed760] eq-bar rounded-full" />
                        <span className="w-0.5 h-2.5 bg-[#1ed760] eq-bar eq-bar-2 rounded-full" />
                        <span className="w-0.5 h-3.5 bg-[#1ed760] eq-bar eq-bar-3 rounded-full" />
                      </div>
                    ) : (
                      <span
                        className={`text-xs font-medium tabular-nums ${
                          isCurrent ? 'text-[#1ed760] font-bold' : 'text-[#b3b3b3]'
                        }`}
                      >
                        {idx + 1}
                      </span>
                    )}
                  </button>

                  {/* Column 2: Cover + Song Title + Artist */}
                  <button
                    type="button"
                    onClick={() => onPlayTrack(track, tracksList)}
                    className="min-w-0 flex items-center gap-3 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-white rounded"
                  >
                    <img
                      src={proxyMusicCover(track.coverSmall || track.cover)}
                      alt={track.title}
                      className="w-10 h-10 rounded object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-xs sm:text-sm font-semibold truncate ${
                          isCurrent ? 'text-[#1ed760]' : 'text-white'
                        }`}
                      >
                        {track.title}
                      </div>
                      <div className="text-xs text-[#b3b3b3] truncate">
                        <span
                          role="link"
                          tabIndex={-1}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRunSearch(track.artist);
                          }}
                          className="hover:text-white hover:underline cursor-pointer"
                        >
                          {track.artist}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Column 3: Album (Desktop/TV) */}
                  <div className="hidden md:block min-w-0">
                    <button
                      type="button"
                      onClick={() =>
                        void handleOpenAlbumCard(
                          track.album,
                          track.artist,
                          track
                        )
                      }
                      className="text-xs text-[#b3b3b3] hover:text-white hover:underline truncate block max-w-full text-left cursor-pointer"
                    >
                      {cleanAlbumTitle}
                    </button>
                  </div>

                  {/* Column 4: Heart + Duration */}
                  <div className="flex items-center justify-end gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleLikeTrack(track)}
                      className={`w-7 h-7 rounded-full inline-flex items-center justify-center transition-colors cursor-pointer ${
                        isLiked
                          ? 'text-[#1ed760]'
                          : 'text-[#b3b3b3] opacity-70 group-hover:opacity-100 hover:text-white'
                      }`}
                    >
                      <Heart
                        className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`}
                      />
                    </button>
                    <span className="text-xs text-[#b3b3b3] tabular-nums w-9 text-right">
                      {formatMusicDuration(track.durationSec)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2F. SPOTIFY "MIXURILE TALE DE TOP" (Recommended Tracks Shelf) */}
        {suggestedTracks.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight">
              {tr(
                'Mixurile tale de top',
                'Your Top Mixes',
                'Ваши лучшие миксы'
              )}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {suggestedTracks.slice(0, 6).map((sTrack) => {
                const isCurrentSug = currentTrack?.id === sTrack.id;
                return (
                  <button
                    key={`mix_${sTrack.id}`}
                    type="button"
                    onClick={() => onPlayTrack(sTrack, suggestedTracks)}
                    className="p-3 rounded-lg bg-[#181818] hover:bg-[#282828] focus:bg-[#282828] focus:outline-none focus:ring-2 focus:ring-white transition-colors text-left group cursor-pointer flex flex-col"
                  >
                    <div className="relative aspect-square w-full rounded-md overflow-hidden mb-3 shadow-[0_8px_24px_rgba(0,0,0,0.5)] bg-zinc-900">
                      <img
                        src={proxyMusicCover(sTrack.cover)}
                        alt={sTrack.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div
                        style={{ backgroundColor: '#1ed760', color: '#000000' }}
                        className={`absolute right-2.5 bottom-2.5 w-11 h-11 rounded-full bg-[#1ed760] text-black flex items-center justify-center shadow-[0_8px_16px_rgba(0,0,0,0.45)] transition-all ${
                          isCurrentSug && isPlaying
                            ? 'opacity-100 translate-y-0'
                            : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-focus:opacity-100 group-focus:translate-y-0'
                        }`}
                      >
                        <Play className="w-5 h-5 fill-current text-black ml-0.5" />
                      </div>
                    </div>
                    <div
                      className={`text-sm font-bold truncate ${
                        isCurrentSug ? 'text-[#1ed760]' : 'text-white'
                      }`}
                    >
                      {sTrack.title}
                    </div>
                    <div className="text-xs text-[#a7a7a7] truncate mt-0.5">
                      {sTrack.artist}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ====================================================================
          3. SPOTIFY BOTTOM-DOCKED NOW PLAYING BAR (100% FLUSH & ALIGNED)
         ==================================================================== */}
      <div
        data-bottom-player-bar="true"
        className="sticky bottom-0 left-0 right-0 z-40 w-full m-0 bg-[#000000] border-t border-white/10 px-3 sm:px-5 py-2 sm:py-2.5 shadow-[0_-12px_32px_rgba(0,0,0,0.9)]"
      >
        {/* 3A. MOBILE COMPACT SPOTIFY BAR (< 640px) */}
        <div className="sm:hidden space-y-1.5">
          <div className="flex items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={() =>
                void handleOpenAlbumCard(
                  heroTrack.album || heroTrack.title,
                  heroTrack.artist,
                  heroTrack
                )
              }
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
            >
              <img
                src={proxyMusicCover(heroTrack.coverSmall || heroTrack.cover)}
                alt={heroTrack.title}
                className="w-11 h-11 rounded-md object-cover shrink-0 shadow"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">
                  {heroTrack.title}
                </div>
                <div className="text-[11px] text-[#b3b3b3] truncate">
                  {heroTrack.artist}
                </div>
              </div>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onToggleLikeTrack(heroTrack)}
                className={`w-8 h-8 rounded-full inline-flex items-center justify-center cursor-pointer ${
                  isHeroLiked ? 'text-[#1ed760]' : 'text-[#b3b3b3]'
                }`}
              >
                <Heart
                  className={`w-4 h-4 ${isHeroLiked ? 'fill-current' : ''}`}
                />
              </button>
              <button
                type="button"
                onClick={onPrevTrack}
                className="w-8 h-8 rounded-full text-white inline-flex items-center justify-center cursor-pointer"
              >
                <SkipBack className="w-4 h-4 fill-current" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!currentTrack) {
                    onPlayTrack(heroTrack, tracksList);
                  } else {
                    onTogglePlayPause();
                  }
                }}
                style={{ backgroundColor: '#ffffff', color: '#000000' }}
                className="w-9 h-9 rounded-full bg-white text-black inline-flex items-center justify-center shadow cursor-pointer shrink-0"
              >
                {isPlaying && currentTrack?.id === heroTrack.id ? (
                  <Pause className="w-4 h-4 fill-current text-black" />
                ) : (
                  <Play className="w-4 h-4 fill-current text-black ml-0.5" />
                )}
              </button>
              <button
                type="button"
                onClick={onNextTrack}
                className="w-8 h-8 rounded-full text-white inline-flex items-center justify-center cursor-pointer"
              >
                <SkipForward className="w-4 h-4 fill-current" />
              </button>
            </div>
          </div>

          {/* Mobile Scrubber */}
          <div className="flex items-center gap-2 w-full">
            <span className="text-[10px] text-[#a7a7a7] tabular-nums w-7">
              {formatMusicDuration(elapsedSec)}
            </span>
            <div
              role="slider"
              tabIndex={0}
              aria-label="Music Timeline Mobile"
              aria-valuemin={0}
              aria-valuemax={effectiveDuration}
              aria-valuenow={Math.floor(elapsedSec)}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                const rect = e.currentTarget.getBoundingClientRect();
                if (rect.width > 0) {
                  const ratio = Math.min(
                    1,
                    Math.max(0, (e.clientX - rect.left) / rect.width)
                  );
                  onSeek(ratio * effectiveDuration);
                }
              }}
              onPointerMove={(e) => {
                if (
                  e.buttons === 1 ||
                  e.currentTarget.hasPointerCapture?.(e.pointerId)
                ) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (rect.width > 0) {
                    const ratio = Math.min(
                      1,
                      Math.max(0, (e.clientX - rect.left) / rect.width)
                    );
                    onSeek(ratio * effectiveDuration);
                  }
                }
              }}
              onPointerUp={(e) => {
                if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              }}
              className="relative flex-1 h-3 cursor-pointer flex items-center"
            >
              <div className="relative w-full h-1 rounded-full bg-white/25 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#1ed760]"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
            <span className="text-[10px] text-[#a7a7a7] tabular-nums w-7 text-right">
              {formatMusicDuration(effectiveDuration)}
            </span>
          </div>
        </div>

        {/* 3B. DESKTOP / SMART TV 3-COLUMN SPOTIFY BAR (>= 640px) */}
        <div className="hidden sm:flex items-center justify-between gap-4">
          {/* LEFT: Square Cover + Song Title + Artist + Heart */}
          <div className="flex items-center gap-3.5 min-w-[180px] w-[30%] max-w-[360px]">
            <button
              type="button"
              onClick={() =>
                void handleOpenAlbumCard(
                  heroTrack.album || heroTrack.title,
                  heroTrack.artist,
                  heroTrack
                )
              }
              className="w-14 h-14 rounded-md overflow-hidden shadow-md shrink-0 bg-zinc-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white"
            >
              <img
                src={proxyMusicCover(heroTrack.cover)}
                alt={heroTrack.title}
                className="w-full h-full object-cover"
              />
            </button>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white truncate">
                {heroTrack.title}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#b3b3b3] truncate mt-0.5">
                <button
                  type="button"
                  onClick={() => handleRunSearch(heroTrack.artist)}
                  className="hover:text-white hover:underline truncate cursor-pointer"
                >
                  {heroTrack.artist}
                </button>
                {heroTrack.album && (
                  <>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() =>
                        void handleOpenAlbumCard(
                          heroTrack.album,
                          heroTrack.artist,
                          heroTrack
                        )
                      }
                      className="inline-flex items-center gap-1 hover:text-white hover:underline truncate cursor-pointer"
                    >
                      <Disc className="w-3 h-3 shrink-0" />
                      <span className="truncate">{heroTrack.album}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              title={tr(
                'Salvează în Melodii îndrăgite',
                'Save to Liked Songs',
                'В Любимые треки'
              )}
              onClick={() => onToggleLikeTrack(heroTrack)}
              className={`w-8 h-8 rounded-full inline-flex items-center justify-center transition-colors cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-white ${
                isHeroLiked
                  ? 'text-[#1ed760]'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              <Heart
                className={`w-4 h-4 ${isHeroLiked ? 'fill-current' : ''}`}
              />
            </button>
          </div>

          {/* CENTER: Transport Controls + Spotify Scrubber */}
          <div className="flex-1 max-w-[600px] flex flex-col items-center gap-1.5 px-2">
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                title={tr('Amestecare (Shuffle)', 'Shuffle', 'Перемешать')}
                onClick={onToggleShuffle}
                className={`w-8 h-8 rounded-full inline-flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-white ${
                  isShuffle
                    ? 'text-[#1ed760]'
                    : 'text-[#b3b3b3] hover:text-white'
                }`}
              >
                <Shuffle className="w-4 h-4" />
              </button>

              <button
                type="button"
                title={tr('Piesa anterioară', 'Previous', 'Предыдущий трек')}
                onClick={onPrevTrack}
                className="w-8 h-8 rounded-full text-[#b3b3b3] hover:text-white inline-flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-white"
              >
                <SkipBack className="w-4 h-4 fill-current" />
              </button>

              <button
                type="button"
                title={
                  isPlaying && currentTrack?.id === heroTrack.id
                    ? tr('Pauză', 'Pause', 'Пауза')
                    : tr('Redă', 'Play', 'Слушать')
                }
                onClick={() => {
                  if (!currentTrack) {
                    onPlayTrack(heroTrack, tracksList);
                  } else {
                    onTogglePlayPause();
                  }
                }}
                style={{ backgroundColor: '#ffffff', color: '#000000' }}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white hover:scale-105 text-black inline-flex items-center justify-center shadow transition-transform cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1ed760]"
              >
                {isPlaying && currentTrack?.id === heroTrack.id ? (
                  <Pause className="w-4 h-4 fill-current text-black" />
                ) : (
                  <Play className="w-4 h-4 fill-current text-black ml-0.5" />
                )}
              </button>

              <button
                type="button"
                title={tr('Piesa următoare', 'Next', 'Следующий трек')}
                onClick={onNextTrack}
                className="w-8 h-8 rounded-full text-[#b3b3b3] hover:text-white inline-flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-white"
              >
                <SkipForward className="w-4 h-4 fill-current" />
              </button>

              <button
                type="button"
                title={tr('Repetare', 'Repeat', 'Повтор')}
                onClick={onToggleRepeat}
                className={`w-8 h-8 rounded-full inline-flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-white ${
                  isRepeat
                    ? 'text-[#1ed760]'
                    : 'text-[#b3b3b3] hover:text-white'
                }`}
              >
                <Repeat className="w-4 h-4" />
              </button>
            </div>

            {/* Spotify Timeline Scrubber */}
            <div className="flex items-center gap-2.5 w-full">
              <span className="text-[11px] text-[#a7a7a7] tabular-nums shrink-0 w-8 text-right">
                {formatMusicDuration(elapsedSec)}
              </span>

              <div
                role="slider"
                tabIndex={0}
                aria-label="Music Timeline"
                aria-valuemin={0}
                aria-valuemax={effectiveDuration}
                aria-valuenow={Math.floor(elapsedSec)}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (rect.width > 0) {
                    const ratio = Math.min(
                      1,
                      Math.max(0, (e.clientX - rect.left) / rect.width)
                    );
                    onSeek(ratio * effectiveDuration);
                  }
                }}
                onPointerMove={(e) => {
                  if (
                    e.buttons === 1 ||
                    e.currentTarget.hasPointerCapture?.(e.pointerId)
                  ) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    if (rect.width > 0) {
                      const ratio = Math.min(
                        1,
                        Math.max(0, (e.clientX - rect.left) / rect.width)
                      );
                      onSeek(ratio * effectiveDuration);
                    }
                  }
                }}
                onPointerUp={(e) => {
                  if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    onSeek(Math.min(effectiveDuration, elapsedSec + 10));
                  } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    onSeek(Math.max(0, elapsedSec - 10));
                  }
                }}
                className="relative flex-1 h-4 cursor-pointer group flex items-center focus:outline-none"
              >
                <div className="relative w-full h-1 rounded-full bg-white/25 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-white group-hover:bg-[#1ed760] group-focus:bg-[#1ed760] transition-colors"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div
                  className="pointer-events-none absolute w-3 h-3 rounded-full bg-white shadow -ml-1.5 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity"
                  style={{ left: `${progressPct}%` }}
                />
              </div>

              <span className="text-[11px] text-[#a7a7a7] tabular-nums shrink-0 w-8">
                {formatMusicDuration(effectiveDuration)}
              </span>
            </div>
          </div>

          {/* RIGHT: Video Clip Toggle + Volume Control */}
          <div className="flex items-center justify-end gap-3 min-w-[160px] w-[30%] max-w-[340px]">
            <button
              type="button"
              title={
                isVideoClipMode
                  ? tr('Ascunde Videoclipul', 'Hide Video Clip', 'Скрыть клип')
                  : tr('Videoclip Oficial', 'Official Video Clip', 'Видеоклип')
              }
              onClick={(e) => {
                const nextMode = !isVideoClipMode;
                setIsVideoClipMode(nextMode);
                if (nextMode) {
                  const mainEl = e.currentTarget.closest('main');
                  mainEl?.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className={`w-8 h-8 rounded-full inline-flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-white ${
                isVideoClipMode
                  ? 'text-[#1ed760]'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
            >
              <Tv className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleMute}
                className="text-[#b3b3b3] hover:text-white focus:outline-none cursor-pointer shrink-0"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <div
                role="slider"
                tabIndex={0}
                aria-label="Volume"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((isMuted ? 0 : volume) * 100)}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (rect.width > 0) {
                    const ratio = Math.min(
                      1,
                      Math.max(0, (e.clientX - rect.left) / rect.width)
                    );
                    onChangeVolume(ratio);
                  }
                }}
                onPointerMove={(e) => {
                  if (
                    e.buttons === 1 ||
                    e.currentTarget.hasPointerCapture?.(e.pointerId)
                  ) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    if (rect.width > 0) {
                      const ratio = Math.min(
                        1,
                        Math.max(0, (e.clientX - rect.left) / rect.width)
                      );
                      onChangeVolume(ratio);
                    }
                  }
                }}
                onPointerUp={(e) => {
                  if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    onChangeVolume(Math.min(1, volume + 0.1));
                  } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    onChangeVolume(Math.max(0, volume - 0.1));
                  }
                }}
                className="relative w-24 h-4 flex items-center cursor-pointer group focus:outline-none"
              >
                <div className="w-full h-1 rounded-full bg-white/25 overflow-hidden">
                  <div
                    className="h-full bg-white group-hover:bg-[#1ed760] group-focus:bg-[#1ed760] rounded-full transition-colors"
                    style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                  />
                </div>
                <div
                  className="pointer-events-none absolute w-3 h-3 rounded-full bg-white shadow -ml-1.5 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity"
                  style={{ left: `${(isMuted ? 0 : volume) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
