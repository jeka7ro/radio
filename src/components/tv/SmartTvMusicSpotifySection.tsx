import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Delete,
  Disc,
  Flame,
  Heart,
  Keyboard,
  Loader2,
  Music,
  Pause,
  Play,
  Radio,
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
    cover:
      'https://i.ytimg.com/vi/4NRXx6U8ABQ/hq720.jpg',
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
    subtitleRo: 'Cele mai ascultate 50 de piese din lume chiar acum • TIDAL MAX',
    subtitleEn: 'Top 50 most streamed tracks worldwide right now • TIDAL MAX',
    subtitleRu: 'Топ-50 самых популярных мировых треков прямо сейчас • TIDAL MAX',
    badge: 'TOP 50 GLOBAL',
    accentColor: 'from-amber-500/30 via-zinc-900/40 to-zinc-950',
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
    accentColor: 'from-amber-500/25 via-rose-900/30 to-zinc-950',
    cover:
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80',
    searchTerm:
      "Irina Rimes, Carlas Dreams, Inna, Smiley, The Motans, Delia, Andra, Alternosfera, Zdob si Zdub, 3 Sud Est",
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
    accentColor: 'from-zinc-700/40 via-zinc-900/60 to-zinc-950',
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
    accentColor: 'from-purple-500/25 via-zinc-900/50 to-zinc-950',
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
    accentColor: 'from-rose-500/25 via-zinc-900/50 to-zinc-950',
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
    accentColor: 'from-orange-500/25 via-zinc-900/50 to-zinc-950',
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
    subtitleRo: 'Piesele legendare cu care am crescut',
    subtitleEn: 'Timeless anthems from the 90s and 2000s',
    subtitleRu: 'Легендарные золотые хиты 90-х и 2000-х',
    badge: 'GOLD 90s • 00s',
    accentColor: 'from-amber-500/25 via-zinc-900/50 to-zinc-950',
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
    accentColor: 'from-emerald-500/25 via-zinc-900/50 to-zinc-950',
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
    role: 'Global Pop • R&B',
    avatar:
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80',
    query: 'The Weeknd',
  },
  {
    id: 'art_carlas',
    name: "Carla's Dreams",
    role: 'RO • MD #1 Artist',
    avatar:
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&q=80',
    query: "Carla's Dreams",
  },
  {
    id: 'art_irina',
    name: 'Irina Rimes',
    role: 'Pop • Soul',
    avatar:
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&q=80',
    query: 'Irina Rimes',
  },
  {
    id: 'art_inna',
    name: 'INNA',
    role: 'Dance • Club Queen',
    avatar:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80',
    query: 'Inna',
  },
  {
    id: 'art_eminem',
    name: 'Eminem',
    role: 'Hip-Hop Legend',
    avatar:
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80',
    query: 'Eminem',
  },
  {
    id: 'art_dualipa',
    name: 'Dua Lipa',
    role: 'Pop • Disco',
    avatar:
      'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&q=80',
    query: 'Dua Lipa',
  },
  {
    id: 'art_miyagi',
    name: 'Miyagi & Andy Panda',
    role: 'Vibe • Hip-Hop',
    avatar:
      'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300&q=80',
    query: 'Miyagi Andy Panda',
  },
  {
    id: 'art_guetta',
    name: 'David Guetta',
    role: 'EDM • Festival',
    avatar:
      'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&q=80',
    query: 'David Guetta',
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
      INITIAL_SPOTIFY_TRACKS.slice(2, 8)
    );
    const [isLoadingTracks, setIsLoadingTracks] = useState<boolean>(false);
    const [isVideoClipMode, setIsVideoClipMode] = useState<boolean>(false);
    const [resolvedClipVideoId, setResolvedClipVideoId] = useState<string>('');
    const [activeAlbumCard, setActiveAlbumCard] =
      useState<MusicAlbumDetailCard | null>(null);
    const [isLoadingAlbumCard, setIsLoadingAlbumCard] =
      useState<boolean>(false);

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

    // Load playlist tracks when activePlaylistId changes (50 tracks per playlist with TIDAL MAX metadata)
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

        // Client-side fallback: split artists and query iTunes per artist in parallel to guarantee 50 tracks
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
              const isHiRes = assembled.length % 3 !== 2;
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
                qualityTier: isHiRes ? 'MAX' : 'HIFI',
                qualityLabel: isHiRes
                  ? 'MAX • 24-bit / 192 kHz FLAC'
                  : 'HiFi • 16-bit / 44.1 kHz FLAC',
                bitrateKbps: isHiRes ? 9216 : 1411,
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

    // Dynamically fetch smart suggestions ("Sugestii Pentru Tine") based on the currently playing artist/genre
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
              setSuggestedTracks(filtered.slice(0, 8));
            }
          }
        })
        .catch(() => { });
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
        .catch(() => { });
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
        document
          .querySelector('main')
          ?.scrollTo({ top: 0, behavior: 'smooth' });
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
          // Client-side direct iTunes fallback
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
                const isHiRes = idx % 3 !== 2;
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
                  qualityTier: isHiRes ? 'MAX' : 'HIFI',
                  qualityLabel: isHiRes
                    ? 'MAX • 24-bit / 192 kHz FLAC'
                    : 'HiFi • 16-bit / 44.1 kHz FLAC',
                  bitrateKbps: isHiRes ? 9216 : 1411,
                };
              });
            if (mapped.length > 0) {
              setTracksList(mapped);
            }
          } catch {
            // ignore
          }
        })
        .catch(() => { })
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
      document
        .querySelector('main')
        ?.scrollTo({ top: 0, behavior: 'smooth' });
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

        // Step 1: Search iTunes for the exact Album (entity=album) to get collectionId, releaseDate, copyright, genre
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

        // Step 2: Fallback to song search if lookup returned no tracks
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
              matchingAlbumSongs.length > 0 ? matchingAlbumSongs : allSongs.slice(0, 20);
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
            const isHiRes = idx % 3 !== 2;
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
              qualityTier: isHiRes ? 'MAX' : 'HIFI',
              qualityLabel: isHiRes
                ? 'MAX • 24-bit / 192 kHz FLAC'
                : 'HiFi • 16-bit / 44.1 kHz FLAC',
              bitrateKbps: isHiRes ? 9216 : 1411,
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

    return (
      <div className="space-y-4 pb-12">
        {/* ====================================================================
          1. STICKY SPOTIFY PLAYER + SEARCH + FILTER PILLS (PINNED ON SCROLL)
         ==================================================================== */}
        <div
          data-top-hero-card="true"
          className="sticky top-0 z-30 -mx-3 sm:-mx-4 px-3 sm:px-4 pt-1 pb-2.5 bg-[#090d16]/95 backdrop-blur-2xl border-b border-white/10 shadow-[0_14px_35px_rgba(0,0,0,0.85)] space-y-2"
        >
          {/* 1A-MOBILE: COMPACT SPOTIFY STICKY PLAYER BAR (< 640px) */}
          <div className="sm:hidden relative rounded-2xl overflow-hidden tahoe-emerald-osd p-2.5 shadow-lg border border-white/10">
            <img
              src={proxyMusicCover(heroTrack.cover)}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-20 blur-2xl scale-125"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0c0e14]/95 via-[#11141d]/90 to-[#0c0e14]/95" />

            <div className="relative z-10 space-y-2">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    void handleOpenAlbumCard(
                      heroTrack.album || heroTrack.title,
                      heroTrack.artist,
                      heroTrack
                    )
                  }
                  className="w-11 h-11 rounded-xl overflow-hidden border border-white/15 shadow-md shrink-0 bg-zinc-900 cursor-pointer"
                >
                  <img
                    src={proxyMusicCover(heroTrack.coverSmall || heroTrack.cover)}
                    alt={heroTrack.title}
                    className="w-full h-full object-cover"
                  />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-white truncate leading-tight">
                    {heroTrack.title}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-300 truncate mt-0.5">
                    <button
                      type="button"
                      onClick={() => handleRunSearch(heroTrack.artist)}
                      className="text-amber-300 font-semibold truncate hover:underline cursor-pointer"
                    >
                      {heroTrack.artist}
                    </button>
                    {heroTrack.album && (
                      <>
                        <span className="text-zinc-600">•</span>
                        <button
                          type="button"
                          onClick={() =>
                            void handleOpenAlbumCard(
                              heroTrack.album,
                              heroTrack.artist,
                              heroTrack
                            )
                          }
                          className="text-zinc-400 truncate hover:text-white cursor-pointer"
                        >
                          {tr('Album', 'Album', 'Альбом')}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Mobile Single-Row Spotify Transport Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleLikeTrack(heroTrack)}
                    className={`w-8 h-8 rounded-full inline-flex items-center justify-center cursor-pointer ${
                      isHeroLiked ? 'text-rose-400' : 'text-zinc-300'
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
                    style={{ backgroundColor: '#ffffff', color: '#090d16' }}
                    className="w-9 h-9 rounded-full bg-white text-[#090d16] inline-flex items-center justify-center shadow-md cursor-pointer shrink-0"
                  >
                    {isPlaying && currentTrack?.id === heroTrack.id ? (
                      <Pause className="w-4 h-4 fill-current text-[#090d16]" />
                    ) : (
                      <Play className="w-4 h-4 fill-current text-[#090d16] ml-0.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={onNextTrack}
                    className="w-8 h-8 rounded-full text-white inline-flex items-center justify-center cursor-pointer"
                  >
                    <SkipForward className="w-4 h-4 fill-current" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsVideoClipMode((v) => !v)}
                    className={`w-8 h-8 rounded-full inline-flex items-center justify-center cursor-pointer ${
                      isVideoClipMode
                        ? 'bg-white text-[#090d16]'
                        : 'text-zinc-300'
                    }`}
                  >
                    <Tv className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Mobile Compact Timeline Scrubber */}
              <div className="flex items-center gap-2 w-full">
                <span className="text-[10px] font-medium text-white/70 tabular-nums shrink-0 w-7">
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
                  className="relative flex-1 h-4 cursor-pointer flex items-center"
                >
                  <div className="relative w-full h-1 rounded-full bg-white/20 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-white"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div
                    className="pointer-events-none absolute w-2.5 h-2.5 rounded-full bg-white shadow -ml-1"
                    style={{ left: `${progressPct}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium text-white/60 tabular-nums shrink-0 w-7 text-right">
                  {formatMusicDuration(effectiveDuration)}
                </span>
              </div>
            </div>
          </div>

          {/* 1A-DESKTOP/TV: STUDIO MASTER PLAYER CARD (>= 640px) */}
          <div className="hidden sm:block relative rounded-2xl overflow-hidden tahoe-emerald-osd p-3 sm:p-3.5 lg:p-4 shadow-[0_14px_35px_rgba(0,0,0,0.8)]">
          {/* Dynamic Blurred Album Cover Backdrop */}
          <img
            src={proxyMusicCover(heroTrack.cover)}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-20 blur-3xl scale-125 transition-all duration-700"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0c0e14]/95 via-[#11141d]/90 to-[#0c0e14]/95" />

          <div className="relative z-10 flex flex-row items-center gap-4 lg:gap-5">
            {/* Left: Compact Album Art + Spinning Vinyl Disc (Click to open Album Card) */}
            <button
              type="button"
              onClick={() =>
                void handleOpenAlbumCard(
                  heroTrack.album || heroTrack.title,
                  heroTrack.artist,
                  heroTrack
                )
              }
              title={tr(
                `Deschide Cardul Albumului: ${heroTrack.album || heroTrack.title}`,
                `Open Album Card: ${heroTrack.album || heroTrack.title}`,
                `Открыть карточку альбома: ${heroTrack.album || heroTrack.title}`
              )}
              className="relative flex items-center shrink-0 group cursor-pointer focus:outline-none"
            >
              <div className="relative w-20 h-20 lg:w-24 lg:h-24 rounded-xl overflow-hidden shadow-[0_12px_30px_rgba(0,0,0,0.85)] ring-1 ring-white/20 group-hover:ring-amber-400/70 z-10 bg-zinc-900 transition-all">
                <img
                  src={proxyMusicCover(heroTrack.cover)}
                  alt={heroTrack.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              {/* Compact Spinning Vinyl Record — ONLY the vinyl disc spins, NOT the center cover photo */}
              <div className="hidden sm:flex -ml-8 w-20 h-20 lg:w-24 lg:h-24 rounded-full shadow-[0_10px_28px_rgba(0,0,0,0.9)] items-center justify-center relative shrink-0">
                <div
                  className={`absolute inset-0 rounded-full border-2 border-zinc-800/90 ${
                    isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''
                  }`}
                  style={{
                    background:
                      'conic-gradient(from 0deg, #09090b 0deg, #27272a 45deg, #09090b 90deg, #18181b 135deg, #09090b 180deg, #27272a 225deg, #09090b 270deg, #18181b 315deg, #09090b 360deg)',
                  }}
                >
                  <div className="absolute inset-2 rounded-full border border-white/15 pointer-events-none" />
                  <div className="absolute inset-4 rounded-full border border-dashed border-amber-400/30 pointer-events-none" />
                  <div className="absolute inset-6 rounded-full border border-white/10 pointer-events-none" />
                </div>
                <div className="relative z-10 w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-amber-400/70 shadow-lg bg-zinc-900">
                  <img
                    src={proxyMusicCover(heroTrack.cover)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </button>

            {/* Middle & Right: Track Info, Official Quality Icons, Seekbar & Icon Controls */}
            <div className="flex-1 min-w-0 flex flex-col justify-between space-y-2.5 w-full">
              {/* Top Row: Track Title + Artist on Left, Official Quality Logos + Equalizer on Right */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 text-center md:text-left">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight truncate">
                    {heroTrack.title}
                  </h1>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 text-xs sm:text-sm text-zinc-300 mt-0.5">
                    <button
                      type="button"
                      onClick={() => handleRunSearch(heroTrack.artist)}
                      title={tr(
                        `Vezi toate piesele lui ${heroTrack.artist}`,
                        `View all songs by ${heroTrack.artist}`,
                        `Все треки ${heroTrack.artist}`
                      )}
                      className="text-white hover:text-amber-300 hover:underline font-semibold cursor-pointer transition-colors"
                    >
                      {heroTrack.artist}
                    </button>
                    {heroTrack.album && (
                      <>
                        <span className="text-zinc-600">•</span>
                        <button
                          type="button"
                          onClick={() =>
                            void handleOpenAlbumCard(
                              heroTrack.album,
                              heroTrack.artist,
                              heroTrack
                            )
                          }
                          title={tr(
                            `Vezi Cardul Albumului „${heroTrack.album}” (detalii, anul producției și lista de piese)`,
                            `View Album Card "${heroTrack.album}" (details, release year & tracklist)`,
                            `Открыть карточку альбома «${heroTrack.album}»`
                          )}
                          className="inline-flex items-center gap-1 text-zinc-300 hover:text-amber-300 hover:underline font-medium truncate max-w-[240px] sm:max-w-xs cursor-pointer transition-colors"
                        >
                          <Disc className="w-3.5 h-3.5 text-amber-400/85 shrink-0" />
                          <span className="truncate">
                            {heroTrack.album
                              .replace(/\s*-\s*Single$/i, '')
                              .trim()
                              .toLowerCase() ===
                            heroTrack.title.trim().toLowerCase()
                              ? tr('Vezi Albumul', 'View Album', 'Альбом')
                              : heroTrack.album}
                          </span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Official Hi-Res Audio & Lossless FLAC Vector Logos + Compact Equalizer */}
                <div className="flex items-center gap-2 shrink-0 mx-auto md:mx-0">
                  {/* Official JAS Hi-Res AUDIO Gold/Black Crest SVG */}
                  <svg
                    viewBox="0 0 56 36"
                    className="h-6 w-auto shrink-0 drop-shadow"
                    role="img"
                    aria-label="Hi-Res Audio 24-bit/192kHz"
                  >
                    <title>Hi-Res Audio • 24-bit / 192 kHz Studio Master</title>
                    <rect
                      x="0.75"
                      y="0.75"
                      width="54.5"
                      height="34.5"
                      rx="3.5"
                      fill="#0b0c10"
                      stroke="#d4af37"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M1.5 4C1.5 2.61929 2.61929 1.5 4 1.5H52C53.3807 1.5 54.5 2.61929 54.5 4V18H1.5V4Z"
                      fill="url(#hiresGoldGrad)"
                    />
                    <defs>
                      <linearGradient id="hiresGoldGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#f9e498" />
                        <stop offset="50%" stopColor="#d4af37" />
                        <stop offset="100%" stopColor="#aa821c" />
                      </linearGradient>
                    </defs>
                    <text
                      x="28"
                      y="13"
                      textAnchor="middle"
                      fill="#0b0c10"
                      fontSize="10.5"
                      fontWeight="900"
                      fontFamily="system-ui, -apple-system, sans-serif"
                      letterSpacing="0.3"
                    >
                      Hi-Res
                    </text>
                    <text
                      x="28"
                      y="29.5"
                      textAnchor="middle"
                      fill="#e6c665"
                      fontSize="9.5"
                      fontWeight="800"
                      fontFamily="system-ui, -apple-system, sans-serif"
                      letterSpacing="1.6"
                    >
                      AUDIO
                    </text>
                  </svg>

                  {/* Official Lossless FLAC Waveform Crest SVG */}
                  <svg
                    viewBox="0 0 64 36"
                    className="h-6 w-auto shrink-0 drop-shadow"
                    role="img"
                    aria-label="FLAC Lossless Audio"
                  >
                    <title>FLAC Lossless • 24-Bit / 192 kHz</title>
                    <rect
                      x="0.75"
                      y="0.75"
                      width="62.5"
                      height="34.5"
                      rx="3.5"
                      fill="#10141d"
                      stroke="#38bdf8"
                      strokeOpacity="0.55"
                      strokeWidth="1.5"
                    />
                    {/* Lossless Soundwave Icon */}
                    <g fill="#38bdf8">
                      <rect x="7" y="13" width="2" height="10" rx="1" />
                      <rect x="11" y="8" width="2" height="20" rx="1" />
                      <rect x="15" y="11" width="2" height="14" rx="1" />
                      <rect x="19" y="15" width="2" height="6" rx="1" />
                    </g>
                    <text
                      x="42"
                      y="17"
                      textAnchor="middle"
                      fill="#f8fafc"
                      fontSize="10"
                      fontWeight="900"
                      fontFamily="system-ui, -apple-system, sans-serif"
                      letterSpacing="0.8"
                    >
                      FLAC
                    </text>
                    <text
                      x="42"
                      y="28"
                      textAnchor="middle"
                      fill="#38bdf8"
                      fontSize="7.5"
                      fontWeight="700"
                      fontFamily="system-ui, -apple-system, sans-serif"
                      letterSpacing="0.6"
                    >
                      24-BIT
                    </text>
                  </svg>

                  {/* Symmetrical Acoustic Soundwave Visualizer */}
                  <div
                    className="flex items-center gap-[3px] h-6 px-2"
                    aria-hidden="true"
                  >
                    {[38, 65, 92, 54, 100, 74, 46, 88, 60, 40].map(
                      (peak, i) => (
                        <span
                          key={`viz_${i}`}
                          style={{
                            height: isPlaying ? `${peak}%` : '22%',
                            animationDelay: `${i * 0.09}s`,
                            animationDuration: `${0.48 + (i % 4) * 0.12}s`,
                          }}
                          className={`w-[3px] rounded-full transition-all ${
                            isPlaying
                              ? 'bg-gradient-to-b from-amber-300 via-emerald-400 to-cyan-400 shadow-[0_0_8px_rgba(251,191,36,0.45)] eq-bar'
                              : 'bg-white/15'
                          }`}
                        />
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Apple Liquid Glass Timeline Scrubber (Click + Smooth Drag) */}
              <div className="flex items-center gap-3 w-full">
                <span className="text-[11px] font-medium text-white/75 tabular-nums shrink-0 w-8">
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
                  className="relative flex-1 h-5 cursor-pointer group flex items-center focus:outline-none"
                >
                  <div className="relative w-full h-1.5 group-hover:h-2 rounded-full bg-white/20 backdrop-blur-md overflow-hidden transition-all">
                    <div
                      className="h-full rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.6)]"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div
                    className="pointer-events-none absolute w-3 h-3 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.5)] -ml-1.5 scale-90 group-hover:scale-125 group-focus:scale-125 transition-transform"
                    style={{ left: `${progressPct}%` }}
                  />
                </div>

                <span className="text-[11px] font-medium text-white/60 tabular-nums shrink-0 w-8 text-right">
                  {formatMusicDuration(effectiveDuration)}
                </span>
              </div>

              {/* Bottom Controls Row: Pure Icon-Only Transport Buttons + Apple Volume Slider */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <div className="flex items-center gap-2">
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
                    style={{ backgroundColor: '#ffffff', color: '#090d16' }}
                    className="h-9 w-9 mr-2 rounded-full bg-white hover:bg-white/90 focus:bg-white text-[#090d16] inline-flex items-center justify-center shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-white cursor-pointer shrink-0"
                  >
                    {isPlaying && currentTrack?.id === heroTrack.id ? (
                      <Pause
                        style={{ width: 16, height: 16, color: '#090d16' }}
                        className="w-4 h-4 fill-current text-[#090d16] shrink-0"
                      />
                    ) : (
                      <Play
                        style={{ width: 16, height: 16, color: '#090d16' }}
                        className="w-4 h-4 fill-current text-[#090d16] ml-0.5 shrink-0"
                      />
                    )}
                  </button>

                  <button
                    type="button"
                    title={tr('Piesa anterioară', 'Previous track', 'Предыдущий трек')}
                    onClick={onPrevTrack}
                    className="h-8 w-8 mr-1.5 rounded-full tahoe-emerald-card hover:bg-white/20 focus:bg-white focus:text-[#090d16] text-white inline-flex items-center justify-center transition-all cursor-pointer shrink-0"
                  >
                    <SkipBack
                      style={{ width: 15, height: 15 }}
                      className="w-3.5 h-3.5 fill-current shrink-0"
                    />
                  </button>

                  <button
                    type="button"
                    title={tr('Piesa următoare', 'Next track', 'Следующий трек')}
                    onClick={onNextTrack}
                    className="h-8 w-8 mr-1.5 rounded-full tahoe-emerald-card hover:bg-white/20 focus:bg-white focus:text-[#090d16] text-white inline-flex items-center justify-center transition-all cursor-pointer shrink-0"
                  >
                    <SkipForward
                      style={{ width: 15, height: 15 }}
                      className="w-3.5 h-3.5 fill-current shrink-0"
                    />
                  </button>

                  <button
                    type="button"
                    title={tr('Amestecare (Shuffle)', 'Shuffle', 'Перемешать')}
                    onClick={onToggleShuffle}
                    className={`h-8 w-8 mr-1.5 rounded-full inline-flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                      isShuffle
                        ? 'bg-white text-[#090d16] shadow-sm'
                        : 'tahoe-emerald-card text-white/90 hover:text-white focus:bg-white focus:text-[#090d16]'
                    }`}
                  >
                    <Shuffle
                      style={{ width: 15, height: 15 }}
                      className="w-3.5 h-3.5 shrink-0"
                    />
                  </button>

                  <button
                    type="button"
                    title={tr('Repetare piesă', 'Repeat', 'Повтор')}
                    onClick={onToggleRepeat}
                    className={`h-8 w-8 mr-1.5 rounded-full inline-flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                      isRepeat
                        ? 'bg-white text-[#090d16] shadow-sm'
                        : 'tahoe-emerald-card text-white/90 hover:text-white focus:bg-white focus:text-[#090d16]'
                    }`}
                  >
                    <Repeat
                      style={{ width: 15, height: 15 }}
                      className="w-3.5 h-3.5 shrink-0"
                    />
                  </button>

                  <button
                    type="button"
                    title={tr('Piese Apreciate', 'Save to Liked Songs', 'В Любимые треки')}
                    onClick={() => onToggleLikeTrack(heroTrack)}
                    className={`h-8 w-8 mr-1.5 rounded-full inline-flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                      isHeroLiked
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'tahoe-emerald-card text-white/90 hover:bg-white/20 focus:bg-white focus:text-[#090d16]'
                    }`}
                  >
                    <Heart
                      style={{ width: 15, height: 15 }}
                      className={`w-3.5 h-3.5 shrink-0 ${isHeroLiked ? 'fill-current' : ''}`}
                    />
                  </button>

                  <button
                    type="button"
                    title={
                      isVideoClipMode
                        ? tr('Ascunde Videoclipul', 'Hide Video Clip', 'Скрыть клип')
                        : tr('Videoclip Oficial HD', 'Official Video Clip', 'Видеоклип HD')
                    }
                    onClick={(e) => {
                      const nextMode = !isVideoClipMode;
                      setIsVideoClipMode(nextMode);
                      if (nextMode) {
                        const mainEl = e.currentTarget.closest('main');
                        mainEl?.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                    className={`h-8 w-8 rounded-full inline-flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                      isVideoClipMode
                        ? 'bg-white text-[#090d16]'
                        : 'tahoe-emerald-card text-white/90 hover:bg-white/20 focus:bg-white focus:text-[#090d16]'
                    }`}
                  >
                    <Tv
                      style={{ width: 15, height: 15 }}
                      className="w-3.5 h-3.5 shrink-0"
                    />
                  </button>
                </div>

                {/* Apple macOS Tahoe Draggable Volume Slider */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full tahoe-emerald-card">
                  <button
                    type="button"
                    onClick={onToggleMute}
                    className="text-white/90 hover:text-white focus:outline-none cursor-pointer mr-1.5 shrink-0"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX
                        style={{ width: 15, height: 15 }}
                        className="w-3.5 h-3.5 text-rose-400 shrink-0"
                      />
                    ) : (
                      <Volume2
                        style={{ width: 15, height: 15 }}
                        className="w-3.5 h-3.5 shrink-0"
                      />
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
                    className="relative w-20 h-4 flex items-center cursor-pointer group"
                  >
                    <div className="w-full h-1 group-hover:h-1.5 rounded-full bg-white/20 overflow-hidden transition-all">
                      <div
                        className="h-full bg-white rounded-full"
                        style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                      />
                    </div>
                    <div
                      className="pointer-events-none absolute w-2.5 h-2.5 rounded-full bg-white shadow -ml-1 scale-90 group-hover:scale-125 transition-transform"
                      style={{ left: `${(isMuted ? 0 : volume) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          </div>

          {/* Optional Official HD Music Video Clip Drawer inside Sticky Header */}
          {isVideoClipMode && resolvedClipVideoId && (
            <div className="relative z-10 rounded-xl overflow-hidden border border-white/15 bg-black h-[190px] sm:h-[280px] lg:h-[320px] max-w-3xl mx-auto w-full shadow-2xl">
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

          {/* 1B. SPOTIFY SEARCH BAR + LIKED SONGS PILL (PINNED INSIDE STICKY HEADER) */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                  'Caută piesă, artist sau album...',
                  'Search song, artist, or album...',
                  'Поиск треков, артистов или альбомов...'
                )}
                className="w-full h-9 sm:h-10 pl-9 pr-24 rounded-full tahoe-emerald-card text-xs sm:text-sm text-white placeholder-zinc-400 focus:ring-2 focus:ring-amber-400"
              />
              {searchQuery.trim().length > 0 && (
                <button
                  type="button"
                  title={tr('Șterge căutarea', 'Clear search', 'Очистить поиск')}
                  onClick={() => {
                    setSearchQuery('');
                    setActivePlaylistId('pl_global_hits');
                  }}
                  className="absolute right-[70px] top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/15 hover:bg-white/30 text-zinc-200 inline-flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleRunSearch()}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 sm:h-8 px-3 rounded-full bg-white hover:bg-amber-300 text-[#090d16] text-xs font-bold cursor-pointer"
              >
                {tr('Caută', 'Search', 'Найти')}
              </button>
            </div>

            <button
              type="button"
              title={tr('Tastatură TV', 'TV Keyboard', 'ТВ Клавиатура')}
              onClick={() => setIsTvKeyboardOpen((v) => !v)}
              className="hidden sm:inline-flex h-10 w-10 rounded-full tahoe-emerald-card hover:bg-white hover:text-[#090d16] focus:bg-white focus:text-[#090d16] text-xs font-bold text-zinc-200 items-center justify-center shrink-0 cursor-pointer"
            >
              <Keyboard className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActivePlaylistId('liked_songs');
              }}
              className={`h-9 sm:h-10 px-3.5 rounded-full text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                activePlaylistId === 'liked_songs'
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'tahoe-emerald-card text-zinc-200 hover:bg-white hover:text-[#090d16]'
              }`}
            >
              <Heart className="w-3.5 h-3.5 fill-current text-rose-400" />
              <span>{likedTracks.length}</span>
            </button>
          </div>

          {/* On-Screen Smart TV Keyboard for Remote Search */}
          {isTvKeyboardOpen && (
            <div className="p-2.5 rounded-xl tahoe-emerald-osd space-y-2">
              <div className="flex flex-wrap gap-1">
                {'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('').map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setSearchQuery((prev) => prev + ch)}
                    className="w-8 h-8 rounded-lg tahoe-emerald-card hover:bg-white hover:text-[#090d16] focus:bg-white focus:text-[#090d16] text-xs font-bold text-white inline-flex items-center justify-center cursor-pointer"
                  >
                    {ch}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSearchQuery((prev) => prev + ' ')}
                  className="px-3 h-8 rounded-lg tahoe-emerald-card hover:bg-white hover:text-[#090d16] text-xs font-bold text-white cursor-pointer"
                >
                  SPACE
                </button>
                <button
                  type="button"
                  onClick={() => setSearchQuery((prev) => prev.slice(0, -1))}
                  className="px-2.5 h-8 rounded-lg tahoe-emerald-card hover:bg-rose-500 text-xs font-bold text-white inline-flex items-center justify-center cursor-pointer"
                >
                  <Delete className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRunSearch()}
                  className="px-3 h-8 rounded-lg bg-amber-400 text-[#090d16] text-xs font-bold cursor-pointer"
                >
                  OK
                </button>
              </div>
            </div>
          )}

          {/* 1C. SINGLE-ROW COMPACT SPOTIFY FILTER CHIPS */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {activePlaylistId === 'search_results' && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActivePlaylistId('pl_global_hits');
                }}
                className="h-8 px-3 rounded-full bg-amber-400 text-[#090d16] text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer shadow"
              >
                <Search className="w-3 h-3" />
                <span className="max-w-[140px] truncate">
                  {customSearchHeader || searchQuery}
                </span>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {SPOTIFY_PLAYLISTS.map((pl) => {
              const isSelected = activePlaylistId === pl.id;
              return (
                <button
                  key={`chip_${pl.id}`}
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActivePlaylistId(pl.id);
                  }}
                  className={`h-8 pl-1.5 pr-3 rounded-full flex items-center gap-1.5 shrink-0 text-xs font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/60 ${
                    isSelected
                      ? 'bg-white text-[#090d16] font-bold shadow'
                      : 'bg-white/[0.08] hover:bg-white/[0.16] text-zinc-200'
                  }`}
                >
                  <img
                    src={proxyMusicCover(pl.cover)}
                    alt=""
                    className="w-5 h-5 rounded-full object-cover shrink-0"
                  />
                  <span className="whitespace-nowrap">
                    {tr(pl.titleRo, pl.titleEn, pl.titleRu)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ====================================================================
          2. CARDUL ALBUMULUI (ALBUM DETAIL CARD — SCURTE DETALII, ANUL PRODUCȚIEI & LISTA DE PIESE)
         ==================================================================== */}
        {activeAlbumCard && (
          <div className="relative rounded-2xl overflow-hidden tahoe-emerald-osd p-4 sm:p-5 lg:p-6 shadow-[0_22px_55px_rgba(0,0,0,0.85)] border border-amber-400/25">
            {/* Blurred Album Cover Backdrop */}
            <img
              src={proxyMusicCover(activeAlbumCard.coverUrl)}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-20 blur-3xl scale-125"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0d111a]/90 via-[#0b0e16]/95 to-[#090b11]/98" />

            <div className="relative z-10 space-y-5">
              {/* Top Section: Album Cover + Production Details + Actions */}
              <div className="flex flex-col md:flex-row items-center md:items-start gap-5">
                {/* Album Cover + Vinyl */}
                <div className="relative flex items-center shrink-0">
                  <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-xl overflow-hidden shadow-[0_14px_35px_rgba(0,0,0,0.85)] ring-1 ring-white/20 z-10 bg-zinc-900">
                    <img
                      src={proxyMusicCover(activeAlbumCard.coverUrl)}
                      alt={activeAlbumCard.albumTitle}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="hidden sm:flex -ml-10 w-28 h-28 sm:w-32 sm:h-32 rounded-full shadow-2xl items-center justify-center relative shrink-0">
                    <div
                      className={`absolute inset-0 rounded-full border-2 border-zinc-800/90 ${
                        isPlaying &&
                        activeAlbumCard.tracks.some((t) => t.id === currentTrack?.id)
                          ? 'animate-[spin_4s_linear_infinite]'
                          : ''
                      }`}
                      style={{
                        background:
                          'conic-gradient(from 0deg, #09090b 0deg, #27272a 45deg, #09090b 90deg, #18181b 135deg, #09090b 180deg, #27272a 225deg, #09090b 270deg, #18181b 315deg, #09090b 360deg)',
                      }}
                    >
                      <div className="absolute inset-2 rounded-full border border-white/15 pointer-events-none" />
                      <div className="absolute inset-4 rounded-full border border-dashed border-amber-400/30 pointer-events-none" />
                    </div>
                    <div className="relative z-10 w-16 h-16 sm:w-18 sm:h-18 rounded-full overflow-hidden border-2 border-amber-400/70 shadow-lg bg-zinc-900">
                      <img
                        src={proxyMusicCover(activeAlbumCard.coverUrl)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>

                {/* Album Info, Production Year, Copyright & Action Buttons */}
                <div className="flex-1 min-w-0 text-center md:text-left space-y-2.5 w-full">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/35 text-amber-300 text-[11px] font-bold tracking-wider uppercase mx-auto md:mx-0">
                      <Disc className="w-3.5 h-3.5" />
                      <span>
                        {tr(
                          'Cardul Albumului • Ediție Studio Master',
                          'Album Card • Studio Master Edition',
                          'Карточка альбома • Studio Master'
                        )}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveAlbumCard(null)}
                      title={tr('Închide cardul albumului', 'Close album card', 'Закрыть карточку альбома')}
                      className="h-8 px-3 rounded-full tahoe-emerald-card hover:bg-rose-500/80 hover:text-white text-zinc-300 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>{tr('Închide', 'Close', 'Закрыть')}</span>
                    </button>
                  </div>

                  <div>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                      {activeAlbumCard.albumTitle}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs sm:text-sm">
                      <button
                        type="button"
                        onClick={() => handleRunSearch(activeAlbumCard.artistName)}
                        className="font-bold text-amber-300 hover:underline cursor-pointer"
                      >
                        {activeAlbumCard.artistName}
                      </button>
                      <span className="text-zinc-600">•</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.07] text-zinc-200 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-amber-400" />
                        <span>
                          {tr('Anul producției:', 'Released:', 'Год выпуска:')}{' '}
                          <strong className="text-white">
                            {activeAlbumCard.releaseDateText || activeAlbumCard.year}
                          </strong>
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.07] text-zinc-200 font-medium">
                        <Music className="w-3.5 h-3.5 text-amber-400" />
                        <span>{activeAlbumCard.genre}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.07] text-zinc-200 font-medium">
                        <Disc className="w-3.5 h-3.5 text-amber-400" />
                        <span>
                          {activeAlbumCard.trackCount}{' '}
                          {tr('piese', 'tracks', 'треков')} •{' '}
                          {Math.max(
                            1,
                            Math.round(activeAlbumCard.totalDurationSec / 60)
                          )}{' '}
                          min
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Short Album Summary & Production / Record Label Details */}
                  <p className="text-xs sm:text-sm text-zinc-300/90 leading-relaxed max-w-3xl">
                    {tr(
                      `Albumul „${activeAlbumCard.albumTitle}” semnat de ${activeAlbumCard.artistName}, lansat oficial în anul ${activeAlbumCard.year} (${activeAlbumCard.genre}), conține ${activeAlbumCard.trackCount} piese disponibile pentru audiție imediată în format Lossless Hi-Res 24-bit.`,
                      `Album "${activeAlbumCard.albumTitle}" by ${activeAlbumCard.artistName}, officially released in ${activeAlbumCard.year} (${activeAlbumCard.genre}), featuring ${activeAlbumCard.trackCount} tracks in Lossless Hi-Res 24-bit audio.`,
                      `Альбом «${activeAlbumCard.albumTitle}» исполнителя ${activeAlbumCard.artistName}, выпущенный в ${activeAlbumCard.year} году (${activeAlbumCard.genre}), включает ${activeAlbumCard.trackCount} треков в качестве Lossless Hi-Res.`
                    )}
                    {activeAlbumCard.copyright ? (
                      <span className="block mt-1 text-[11px] text-zinc-400">
                        {tr('Producție & Casă de discuri:', 'Production & Label:', 'Продюсирование и лейбл:')}{' '}
                        <span className="text-zinc-300">{activeAlbumCard.copyright}</span>
                      </span>
                    ) : null}
                  </p>

                  {/* Play All Album Controls */}
                  <div className="pt-1 flex flex-wrap items-center justify-center md:justify-start gap-2.5">
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
                      style={{ backgroundColor: '#ffffff', color: '#090d16' }}
                      className="h-9 px-4 rounded-full bg-white hover:bg-amber-300 text-[#090d16] text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-lg cursor-pointer transition-all"
                    >
                      <Play className="w-4 h-4 fill-current text-[#090d16]" />
                      <span>
                        {tr(
                          'Redă Albumul Integral',
                          'Play Full Album',
                          'Слушать весь альбом'
                        )}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (activeAlbumCard.tracks.length > 0) {
                          const rnd =
                            activeAlbumCard.tracks[
                              Math.floor(
                                Math.random() * activeAlbumCard.tracks.length
                              )
                            ];
                          onPlayTrack(rnd, activeAlbumCard.tracks);
                        }
                      }}
                      className="h-9 px-3.5 rounded-full tahoe-emerald-card hover:bg-white hover:text-[#090d16] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      <span>{tr('Amestecă', 'Shuffle', 'Перемешать')}</span>
                    </button>

                    {isLoadingAlbumCard && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-amber-300">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>
                          {tr(
                            'Se încarcă piesele din album...',
                            'Loading album tracks...',
                            'Загрузка треков альбома...'
                          )}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Album Tracklist Table */}
              <div className="border-t border-white/10 pt-3">
                <div className="flex items-center justify-between mb-2 px-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    {tr(
                      'Lista de piese din album (click pentru redare)',
                      'Album Tracklist (click to play)',
                      'Список треков альбома (нажмите для воспроизведения)'
                    )}
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {activeAlbumCard.tracks.length}{' '}
                    {tr('piese', 'tracks', 'треков')}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-[340px] overflow-y-auto pr-1 no-scrollbar">
                  {activeAlbumCard.tracks.map((albTrack, idx) => {
                    const isCurrentAlbTrack =
                      currentTrack?.id === albTrack.id ||
                      (currentTrack?.title === albTrack.title &&
                        currentTrack?.artist === albTrack.artist);
                    const isAlbLiked = likedTracks.some(
                      (t) => t.id === albTrack.id
                    );

                    return (
                      <div
                        key={`alb_row_${albTrack.id}_${idx}`}
                        className={`px-3 py-2 rounded-xl flex items-center justify-between gap-2.5 transition-colors ${
                          isCurrentAlbTrack
                            ? 'bg-amber-400/15 border border-amber-400/35'
                            : 'bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.05]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            onPlayTrack(albTrack, activeAlbumCard.tracks)
                          }
                          className="flex-1 min-w-0 flex items-center gap-2.5 text-left cursor-pointer focus:outline-none"
                        >
                          <span
                            className={`w-5 text-xs font-bold tabular-nums text-center shrink-0 ${
                              isCurrentAlbTrack
                                ? 'text-amber-300'
                                : 'text-zinc-400'
                            }`}
                          >
                            {isCurrentAlbTrack && isPlaying ? '▶' : idx + 1}
                          </span>
                          <img
                            src={proxyMusicCover(
                              albTrack.coverSmall || albTrack.cover
                            )}
                            alt={albTrack.title}
                            className="w-8 h-8 rounded-md object-cover shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div
                              className={`text-xs sm:text-sm font-semibold truncate ${
                                isCurrentAlbTrack
                                  ? 'text-amber-300'
                                  : 'text-white'
                              }`}
                            >
                              {albTrack.title}
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate">
                              {albTrack.artist} • {albTrack.year}
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => onToggleLikeTrack(albTrack)}
                            className={`w-7 h-7 rounded-full inline-flex items-center justify-center cursor-pointer ${
                              isAlbLiked
                                ? 'text-rose-400'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            <Heart
                              className={`w-3.5 h-3.5 ${
                                isAlbLiked ? 'fill-current' : ''
                              }`}
                            />
                          </button>
                          <span className="text-[11px] text-zinc-400 tabular-nums w-9 text-right">
                            {formatMusicDuration(albTrack.durationSec)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
          3. MAIN SPLIT VIEW (IMMEDIATELY BELOW STICKY PLAYER & SEARCH BAR):
             - LEFT (2/3): ACTIVE PLAYLIST / SEARCH RESULTS TRACKLIST TABLE
             - RIGHT (1/3): SMART SUGGESTIONS + ARTISTS
         ==================================================================== */}
        <div
          id="music-tracklist-section"
          className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:items-stretch"
        >
          {/* LEFT COLUMN (8 cols): Interactive Playlist Tracklist — matched height with Right Column */}
          <div className="lg:col-span-8 flex flex-col">
            <div className="h-full rounded-2xl tahoe-emerald-osd p-3 sm:p-5 flex flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={proxyMusicCover(
                      activePlaylistId === 'search_results'
                        ? tracksList[0]?.cover || activePlaylist.cover
                        : activePlaylist.cover
                    )}
                    alt=""
                    className="w-11 h-11 rounded-lg object-cover border border-white/15 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-bold text-white truncate">
                        {activePlaylistId === 'liked_songs'
                          ? tr('Piese Apreciate', 'Liked Songs', 'Любимые треки')
                          : activePlaylistId === 'search_results'
                            ? customSearchHeader || searchQuery
                            : tr(
                                activePlaylist.titleRo,
                                activePlaylist.titleEn,
                                activePlaylist.titleRu
                              )}
                      </h3>
                      {/* Mini Official Hi-Res Audio Crest */}
                      <svg
                        viewBox="0 0 56 36"
                        className="h-4 w-auto shrink-0"
                        aria-hidden="true"
                      >
                        <rect
                          x="0.75"
                          y="0.75"
                          width="54.5"
                          height="34.5"
                          rx="3.5"
                          fill="#0b0c10"
                          stroke="#d4af37"
                          strokeWidth="1.5"
                        />
                        <path
                          d="M1.5 4C1.5 2.61929 2.61929 1.5 4 1.5H52C53.3807 1.5 54.5 2.61929 54.5 4V18H1.5V4Z"
                          fill="#d4af37"
                        />
                        <text
                          x="28"
                          y="13"
                          textAnchor="middle"
                          fill="#0b0c10"
                          fontSize="10.5"
                          fontWeight="900"
                          fontFamily="system-ui, -apple-system, sans-serif"
                        >
                          Hi-Res
                        </text>
                        <text
                          x="28"
                          y="29.5"
                          textAnchor="middle"
                          fill="#e6c665"
                          fontSize="9.5"
                          fontWeight="800"
                          fontFamily="system-ui, -apple-system, sans-serif"
                          letterSpacing="1.4"
                        >
                          AUDIO
                        </text>
                      </svg>
                    </div>
                    <span className="text-[11px] text-zinc-400">
                      {tracksList.length} {tr('piese', 'tracks', 'треков')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isLoadingTracks && (
                    <span className="text-xs font-medium text-amber-300 animate-pulse">
                      ...
                    </span>
                  )}
                  <button
                    type="button"
                    title={tr('Redă Tot', 'Play All', 'Слушать всё')}
                    onClick={() => {
                      if (tracksList.length > 0) {
                        onPlayTrack(tracksList[0], tracksList);
                      }
                    }}
                    style={{ backgroundColor: '#ffffff', color: '#090d16' }}
                    className="h-9 w-9 rounded-full bg-white hover:bg-amber-300 text-[#090d16] inline-flex items-center justify-center shadow-md cursor-pointer shrink-0"
                  >
                    <Play
                      style={{ width: 16, height: 16, color: '#090d16' }}
                      className="w-4 h-4 fill-current text-[#090d16] ml-0.5 shrink-0"
                    />
                  </button>
                </div>
              </div>

              {/* Tracklist Rows — Compact, Clean, Minimal Text */}
              <div className="mt-3 space-y-0.5 flex-1 min-h-0 sm:max-h-[620px] sm:overflow-y-auto pr-1 no-scrollbar">
                {tracksList.map((track, idx) => {
                  const isCurrent = currentTrack?.id === track.id;
                  const isLiked = likedTracks.some((t) => t.id === track.id);

                  return (
                    <div
                      key={track.id}
                      className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-3 transition-colors ${
                        isCurrent
                          ? 'bg-white/[0.1]'
                          : 'hover:bg-white/[0.06]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onPlayTrack(track, tracksList)}
                        className="flex-1 min-w-0 flex items-center gap-3 text-left focus:outline-none focus:ring-2 focus:ring-white/50 rounded-md cursor-pointer"
                      >
                        <div className="w-5 text-center shrink-0 mr-2">
                          {isCurrent && isPlaying ? (
                            <div className="inline-flex items-end gap-0.5 h-3.5">
                              <span className="w-0.5 h-full bg-amber-400 eq-bar rounded-full" />
                              <span className="w-0.5 h-2.5 bg-amber-400 eq-bar eq-bar-2 rounded-full" />
                              <span className="w-0.5 h-3.5 bg-amber-400 eq-bar eq-bar-3 rounded-full" />
                            </div>
                          ) : (
                            <span
                              className={`text-xs font-medium tabular-nums ${
                                isCurrent ? 'text-amber-300' : 'text-zinc-500'
                              }`}
                            >
                              {idx + 1}
                            </span>
                          )}
                        </div>

                        <img
                          src={proxyMusicCover(track.coverSmall || track.cover)}
                          alt={track.title}
                          className="w-9 h-9 mr-2.5 rounded-md object-cover shrink-0"
                        />

                        <div className="min-w-0 flex-1">
                          <div
                            className={`text-xs sm:text-sm font-semibold truncate ${
                              isCurrent ? 'text-amber-300' : 'text-white'
                            }`}
                          >
                            {track.title}
                          </div>
                          <div className="text-[11px] text-[#a7a7a7] truncate">
                            <span
                              role="link"
                              tabIndex={-1}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRunSearch(track.artist);
                              }}
                              title={tr(
                                `Vezi toate piesele lui ${track.artist}`,
                                `View all songs by ${track.artist}`,
                                `Все треки ${track.artist}`
                              )}
                              className="hover:text-white hover:underline cursor-pointer"
                            >
                              {track.artist}
                            </span>
                            {track.album &&
                              track.album
                                .replace(/\s*-\s*Single$/i, '')
                                .trim()
                                .toLowerCase() !==
                                track.title.trim().toLowerCase() && (
                              <>
                                <span className="mx-1.5 text-zinc-600">•</span>
                                <span
                                  role="link"
                                  tabIndex={-1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleOpenAlbumCard(
                                      track.album,
                                      track.artist,
                                      track
                                    );
                                  }}
                                  title={tr(
                                    `Deschide Cardul Albumului: ${track.album}`,
                                    `Open Album Card: ${track.album}`,
                                    `Открыть карточку альбома: ${track.album}`
                                  )}
                                  className="hover:text-amber-300 hover:underline cursor-pointer"
                                >
                                  {track.album}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {/* Subtle Lossless Wave Icon instead of text */}
                        <svg
                          viewBox="0 0 18 14"
                          className="w-3.5 h-3.5 text-amber-400/75 hidden sm:block shrink-0"
                          aria-label="Lossless Audio"
                        >
                          <title>Hi-Res Lossless FLAC</title>
                          <rect x="1" y="4" width="2" height="6" rx="1" fill="currentColor" />
                          <rect x="5" y="1" width="2" height="12" rx="1" fill="currentColor" />
                          <rect x="9" y="3" width="2" height="8" rx="1" fill="currentColor" />
                          <rect x="13" y="5" width="2" height="4" rx="1" fill="currentColor" />
                        </svg>

                        <button
                          type="button"
                          onClick={() => onToggleLikeTrack(track)}
                          className={`w-7 h-7 rounded-full inline-flex items-center justify-center transition-colors cursor-pointer ${
                            isLiked
                              ? 'text-rose-400 hover:text-rose-300'
                              : 'text-zinc-500 hover:text-white'
                          }`}
                        >
                          <Heart
                            className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`}
                          />
                        </button>

                        <span className="text-[11px] text-[#a7a7a7] w-9 text-right tabular-nums">
                          {formatMusicDuration(track.durationSec)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (4 cols): COMPACT SUGGESTIONS + ARTISTS */}
          <div className="lg:col-span-4 flex flex-col justify-between gap-5">
            {/* Smart Suggestions Box */}
            <div className="rounded-2xl tahoe-emerald-osd p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  {tr(
                    'Sugestii Pentru Tine',
                    'Recommended For You',
                    'Рекомендации для вас'
                  )}
                </h3>
              </div>

              <div className="space-y-1">
                {suggestedTracks.map((sTrack) => {
                  const isPlayingSug = currentTrack?.id === sTrack.id;
                  return (
                    <button
                      key={`sug_${sTrack.id}`}
                      type="button"
                      onClick={() => onPlayTrack(sTrack, suggestedTracks)}
                      className={`w-full p-1.5 rounded-lg flex items-center justify-between gap-2.5 text-left transition-colors cursor-pointer group focus:outline-none focus:ring-2 focus:ring-white/60 ${
                        isPlayingSug
                          ? 'bg-white/[0.14]'
                          : 'bg-white/[0.04] hover:bg-white/[0.1]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={proxyMusicCover(sTrack.coverSmall || sTrack.cover)}
                          alt={sTrack.title}
                          className="w-9 h-9 mr-2.5 rounded-md object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-semibold text-white truncate">
                            {sTrack.title}
                          </div>
                          <div className="text-[11px] text-[#a7a7a7] truncate">
                            {sTrack.artist}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Popular Artists Compact Cards */}
            <div className="rounded-2xl tahoe-emerald-osd p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-amber-400 shrink-0 mr-1.5" />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  {tr(
                    'Artiști Recomandați',
                    'Recommended Artists',
                    'Рекомендуемые артисты'
                  )}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {SPOTIFY_ARTISTS.map((art) => (
                  <button
                    key={art.id}
                    type="button"
                    onClick={() => {
                      setSearchQuery(art.query);
                      handleRunSearch(art.query);
                    }}
                    className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] focus:ring-2 focus:ring-white/60 flex items-center gap-2.5 text-left transition-colors cursor-pointer"
                  >
                    <img
                      src={proxyMusicCover(art.avatar)}
                      alt={art.name}
                      className="w-9 h-9 mr-2 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        {art.name}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

