import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ChevronRight,
  Delete,
  Disc,
  Heart,
  Home,
  Keyboard,
  ListMusic,
  Loader2,
  Maximize2,
  Mic2,
  Pause,
  Play,
  Radio,
  Repeat,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Tv,
  User,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';
import {
  AlbumDetailView,
  ArtistProfileView,
  CollectionOfflineDownloadButton,
  EqualizerBars,
  FALLBACK_MUSIC_COVER,
  MUSIC_TYPOGRAPHY,
  MusicAlbumDetailCard,
  MusicViewMode,
  OfflineDownloadedBadgeIcon,
  PremiumFullscreenPlayerModal,
  PremiumTrackRow,
  SongRadioView,
  SongStudioDetailView,
  SpotifyAlbumSummary,
  SpotifyArtistProfileData,
  SpotifyArtistSummary,
  SpotifySongRadioData,
  SpotifyTrackItem,
  TrackOfflineDownloadButton,
  TrackQuickActionsDialog,
  TrackTableHeader,
  formatFansCount,
  formatMusicDuration,
  loadAlbumDetailData,
  loadArtistProfileData,
  loadSongRadioPlaylist,
  normalizeMusicStr,
  proxyMusicCover,
} from './spotifyMusicPremiumViews';
import {
  clearAllOfflineMusic,
  formatOfflineMusicBytes,
  useOfflineMusicState,
} from '../../services/offlineMusicService';

export type { SpotifyTrackItem, MusicAlbumDetailCard };
export { FALLBACK_MUSIC_COVER, proxyMusicCover };

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
    artistId: 'dz_art_4050205',
    album: 'After Hours',
    cover:
      'https://cdn-images.dzcdn.net/images/cover/fd00ebd6d30d7253f813dba3bb1c66a9/500x500-000000-80-0-0.jpg',
    coverSmall:
      'https://cdn-images.dzcdn.net/images/cover/fd00ebd6d30d7253f813dba3bb1c66a9/250x250-000000-80-0-0.jpg',
    durationSec: 200,
    year: 2020,
    genre: 'Synthwave • Pop',
    videoId: 'fHI8X4OXluQ',
    previewUrl:
      'https://cdnt-preview.dzcdn.net/api/1/1/1/b/2/0/1b27825bf63c36edcdc7fac9f920214e.mp3',
    fullAudioUrl: '/api/youtube/audio?id=fHI8X4OXluQ',
    qualityTier: 'MAX',
    qualityLabel: 'MAX • 24-bit / 192 kHz FLAC',
    bitrateKbps: 9216,
  },
  {
    id: 'sp_init_2',
    title: 'Starboy (feat. Daft Punk)',
    artist: 'The Weeknd',
    artistId: 'dz_art_4050205',
    album: 'Starboy',
    cover:
      'https://cdn-images.dzcdn.net/images/cover/134778e4c4f19ea71c82408300925a9a/500x500-000000-80-0-0.jpg',
    coverSmall:
      'https://cdn-images.dzcdn.net/images/cover/134778e4c4f19ea71c82408300925a9a/250x250-000000-80-0-0.jpg',
    durationSec: 230,
    year: 2016,
    genre: 'R&B • Electro',
    videoId: '34Na4j8AVgA',
    previewUrl:
      'https://cdnt-preview.dzcdn.net/api/1/1/3/c/1/0/3c19a82aeffd2f6f6adb63c4d8548e06.mp3',
    fullAudioUrl: '/api/youtube/audio?id=34Na4j8AVgA',
    qualityTier: 'MAX',
    qualityLabel: 'MAX • 24-bit / 192 kHz FLAC',
    bitrateKbps: 9216,
  },
  {
    id: 'sp_init_3',
    title: 'Sub Pielea Mea (#eroina)',
    artist: "Carla's Dreams",
    album: 'NGOC',
    cover:
      'https://cdn-images.dzcdn.net/images/cover/3718ba12e25f7e77d81ada11221e81d3/1000x1000-000000-80-0-0.jpg',
    coverSmall:
      'https://cdn-images.dzcdn.net/images/cover/3718ba12e25f7e77d81ada11221e81d3/250x250-000000-80-0-0.jpg',
    durationSec: 208,
    year: 2016,
    genre: 'Romanian Pop • Dance',
    videoId: '2fngvQS_PmQ',
    previewUrl:
      'https://cdnt-preview.dzcdn.net/api/1/1/4/e/c/0/4ec22701a3882ca4de613ae4e7c0681c.mp3',
    fullAudioUrl:
      '/api/youtube/audio?q=' +
      encodeURIComponent("Carla's Dreams Sub Pielea Mea Official"),
    qualityTier: 'HIFI',
    qualityLabel: 'HiFi • 16-bit / 44.1 kHz FLAC',
    bitrateKbps: 1411,
  },
  {
    id: 'sp_init_4',
    title: 'Timeless',
    artist: 'The Weeknd & Playboi Carti',
    artistId: 'dz_art_4050205',
    album: 'Hurry Up Tomorrow',
    cover:
      'https://cdn-images.dzcdn.net/images/cover/e4b16c1afe136140bba34368357e8f05/1000x1000-000000-80-0-0.jpg',
    coverSmall:
      'https://cdn-images.dzcdn.net/images/cover/e4b16c1afe136140bba34368357e8f05/250x250-000000-80-0-0.jpg',
    durationSec: 256,
    year: 2025,
    genre: 'Hip-Hop • Synth',
    previewUrl:
      'https://cdnt-preview.dzcdn.net/api/1/1/d/1/d/0/d1d0f32d011c2139bcff3bf9b591cf67.mp3',
    fullAudioUrl:
      '/api/youtube/audio?q=' +
      encodeURIComponent('The Weeknd Playboi Carti Timeless Official Audio'),
    qualityTier: 'MAX',
    qualityLabel: 'MAX • 24-bit / 192 kHz FLAC',
    bitrateKbps: 9216,
  },
  {
    id: 'sp_init_5',
    title: 'Die With A Smile',
    artist: 'Lady Gaga & Bruno Mars',
    album: 'Die With A Smile - Single',
    cover:
      'https://cdn-images.dzcdn.net/images/cover/0eac10f8441c4652b7fd50e228ae9c8c/1000x1000-000000-80-0-0.jpg',
    coverSmall:
      'https://cdn-images.dzcdn.net/images/cover/0eac10f8441c4652b7fd50e228ae9c8c/250x250-000000-80-0-0.jpg',
    durationSec: 251,
    year: 2025,
    genre: 'Pop • Soul',
    previewUrl:
      'https://cdnt-preview.dzcdn.net/api/1/1/e/0/d/0/e0dec52ed72e6e9ef6a8397145bd4cc5.mp3',
    fullAudioUrl:
      '/api/youtube/audio?q=' +
      encodeURIComponent('Lady Gaga Bruno Mars Die With A Smile Official Audio'),
    qualityTier: 'MAX',
    qualityLabel: 'MAX • 24-bit / 192 kHz FLAC',
    bitrateKbps: 9216,
  },
  {
    id: 'sp_init_6',
    title: 'Houdini',
    artist: 'Dua Lipa',
    album: 'Radical Optimism',
    cover:
      'https://cdn-images.dzcdn.net/images/cover/12c05200e9097af48e0ad4fc259cee25/1000x1000-000000-80-0-0.jpg',
    coverSmall:
      'https://cdn-images.dzcdn.net/images/cover/12c05200e9097af48e0ad4fc259cee25/250x250-000000-80-0-0.jpg',
    durationSec: 186,
    year: 2024,
    genre: 'Dance Pop • Nu-Disco',
    previewUrl:
      'https://cdnt-preview.dzcdn.net/api/1/1/3/6/7/0/367e45ecbf07a341e248b400f51fc544.mp3',
    fullAudioUrl:
      '/api/youtube/audio?q=' +
      encodeURIComponent('Dua Lipa Houdini Official Audio'),
    qualityTier: 'MAX',
    qualityLabel: 'MAX • 24-bit / 192 kHz FLAC',
    bitrateKbps: 9216,
  },
  {
    id: 'sp_init_7',
    title: 'Lose Control',
    artist: 'Teddy Swims',
    album: "I've Tried Everything But Therapy",
    cover:
      'https://cdn-images.dzcdn.net/images/cover/fb2f549900acdfaefeee8c718e42037b/1000x1000-000000-80-0-0.jpg',
    coverSmall:
      'https://cdn-images.dzcdn.net/images/cover/fb2f549900acdfaefeee8c718e42037b/250x250-000000-80-0-0.jpg',
    durationSec: 210,
    year: 2024,
    genre: 'Soul • R&B',
    previewUrl:
      'https://cdnt-preview.dzcdn.net/api/1/1/b/a/c/0/bac060c52788568fc01f5a1f5574b148.mp3',
    fullAudioUrl:
      '/api/youtube/audio?q=' +
      encodeURIComponent('Teddy Swims Lose Control Official Audio'),
    qualityTier: 'HIFI',
    qualityLabel: 'HiFi • 16-bit / 44.1 kHz FLAC',
    bitrateKbps: 1411,
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
    accentColor: 'from-[#1e3a8a]/35 via-[#0d1220] to-[#080b12]',
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
    accentColor: 'from-[#1e3a8a]/35 via-[#0d1220] to-[#080b12]',
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
    accentColor: 'from-[#172554]/45 via-[#0c111d] to-[#080b12]',
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
    accentColor: 'from-[#1e3a8a]/35 via-[#0d1220] to-[#080b12]',
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
    accentColor: 'from-[#172554]/45 via-[#0c111d] to-[#080b12]',
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
    accentColor: 'from-[#1e3a8a]/35 via-[#0d1220] to-[#080b12]',
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
    accentColor: 'from-[#172554]/45 via-[#0c111d] to-[#080b12]',
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
    accentColor: 'from-[#172554]/45 via-[#0c111d] to-[#080b12]',
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
      'https://cdn-images.dzcdn.net/images/artist/581693b4724a7fcfa754455101e13a44/500x500-000000-80-0-0.jpg',
    query: 'The Weeknd',
    cardBg: 'from-[#2563eb] to-[#0f172a]',
  },
  {
    id: 'art_carlas',
    name: "Carla's Dreams",
    role: 'Cu Irina Rimes, The Motans, INNA și alții',
    avatar:
      'https://cdn-images.dzcdn.net/images/cover/3718ba12e25f7e77d81ada11221e81d3/500x500-000000-80-0-0.jpg',
    query: "Carla's Dreams",
    cardBg: 'from-[#3b82f6] to-[#172554]',
  },
  {
    id: 'art_irina',
    name: 'Irina Rimes',
    role: "Cu Carla's Dreams, Smiley, Delia și alții",
    avatar:
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80',
    query: 'Irina Rimes',
    cardBg: 'from-[#60a5fa] to-[#1e3a8a]',
  },
  {
    id: 'art_dualipa',
    name: 'Dua Lipa',
    role: 'Cu Calvin Harris, Elton John, Kylie Minogue și alții',
    avatar:
      'https://cdn-images.dzcdn.net/images/cover/12c05200e9097af48e0ad4fc259cee25/500x500-000000-80-0-0.jpg',
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
    cardBg: 'from-[#1d4ed8] to-[#0b0f19]',
  },
  {
    id: 'art_eminem',
    name: 'Eminem',
    role: 'Cu Dr. Dre, 50 Cent, Travis Scott și alții',
    avatar:
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80',
    query: 'Eminem',
    cardBg: 'from-[#3b82f6] to-[#0f172a]',
  },
];

const RECENT_TRACKS_STORAGE_KEY = 'sc_spotify_recent_tracks_v1';

interface ViewHistorySnapshot {
  viewMode: MusicViewMode;
  activePlaylistId: string;
  activeSearchTerm: string;
  customSearchHeader: string;
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
  queue?: SpotifyTrackItem[];
  onUpdateQueue?: (nextQueue: SpotifyTrackItem[]) => void;
  likedTracks: SpotifyTrackItem[];
  recentTracksProp?: SpotifyTrackItem[];
  onRecordRecentTrack?: (track: SpotifyTrackItem) => void;
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
  queue,
  onUpdateQueue,
  likedTracks,
  recentTracksProp,
  onRecordRecentTrack,
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
    const [viewMode, setViewMode] = useState<MusicViewMode>(() =>
      externalSearchRequest?.album
        ? 'album'
        : externalSearchRequest?.query
          ? 'search'
          : 'home'
    );
    const [navHistory, setNavHistory] = useState<ViewHistorySnapshot[]>([]);
    const [activePlaylistId, setActivePlaylistId] = useState<string>(
      externalSearchRequest?.query ? 'search_results' : 'pl_global_hits'
    );
    const [playlistFilterQuery, setPlaylistFilterQuery] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>(
      externalSearchRequest?.query || ''
    );
    const searchQueryRef = useRef(searchQuery);
    searchQueryRef.current = searchQuery;

    const [activeSearchTerm, setActiveSearchTerm] = useState<string>(
      externalSearchRequest?.query || ''
    );
    const [customSearchHeader, setCustomSearchHeader] = useState<string>(
      externalSearchRequest?.label || externalSearchRequest?.query || ''
    );
    const [searchResults, setSearchResults] = useState<SpotifyTrackItem[]>([]);
    const [searchArtists, setSearchArtists] = useState<SpotifyArtistSummary[]>([]);
    const [searchAlbums, setSearchAlbums] = useState<SpotifyAlbumSummary[]>([]);
    const [searchSubTab, setSearchSubTab] = useState<
      'all' | 'tracks' | 'artists' | 'albums'
    >('all');
    const [isSearching, setIsSearching] = useState<boolean>(false);

    const [isFullScreenPlayerOpen, setIsFullScreenPlayerOpen] =
      useState<boolean>(false);
    const [fullscreenInitialTab, setFullscreenInitialTab] = useState<
      'studio' | 'lyrics' | 'queue'
    >('studio');
    const [songViewInitialTab, setSongViewInitialTab] = useState<
      'studio' | 'lyrics' | 'queue'
    >('studio');
    const [studioTrack, setStudioTrack] = useState<SpotifyTrackItem | null>(null);
    const [menuTrack, setMenuTrack] = useState<SpotifyTrackItem | null>(null);

    const [isTvKeyboardOpen, setIsTvKeyboardOpen] = useState<boolean>(false);
    const [tracksList, setTracksList] = useState<SpotifyTrackItem[]>(
      INITIAL_SPOTIFY_TRACKS
    );
    const [suggestedTracks, setSuggestedTracks] = useState<SpotifyTrackItem[]>(
      INITIAL_SPOTIFY_TRACKS.slice(0, 6)
    );
    const [localRecentTracks, setLocalRecentTracks] = useState<SpotifyTrackItem[]>(() => {
      try {
        const raw = localStorage.getItem(RECENT_TRACKS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed.slice(0, 18);
        }
      } catch {
        // ignore
      }
      return [];
    });
    const recentTracks = recentTracksProp ?? localRecentTracks;
    const [isLoadingTracks, setIsLoadingTracks] = useState<boolean>(false);
    const [isVideoClipMode, setIsVideoClipMode] = useState<boolean>(false);
    const [resolvedClipVideoId, setResolvedClipVideoId] = useState<string>('');

    const [activeArtistProfile, setActiveArtistProfile] =
      useState<SpotifyArtistProfileData | null>(null);
    const [artistNameFallback, setArtistNameFallback] = useState<string>('');
    const [isLoadingArtist, setIsLoadingArtist] = useState<boolean>(false);

    const [activeAlbumCard, setActiveAlbumCard] =
      useState<MusicAlbumDetailCard | null>(null);
    const [isLoadingAlbumCard, setIsLoadingAlbumCard] = useState<boolean>(false);

    const [activeRadioData, setActiveRadioData] =
      useState<SpotifySongRadioData | null>(null);
    const [isLoadingRadio, setIsLoadingRadio] = useState<boolean>(false);

    const viewStateRef = useRef({
      viewMode,
      activePlaylistId,
      activeSearchTerm,
      customSearchHeader,
    });
    viewStateRef.current = {
      viewMode,
      activePlaylistId,
      activeSearchTerm,
      customSearchHeader,
    };

    const scrollMusicToTop = useCallback(() => {
      if (typeof document !== 'undefined') {
        document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, []);

    const pushView = useCallback(
      (nextMode: MusicViewMode, shouldScrollTop = true) => {
        const cur = viewStateRef.current;
        if (cur.viewMode !== nextMode || nextMode === 'artist' || nextMode === 'album' || nextMode === 'radio') {
          setNavHistory((prev) => {
            const last = prev[prev.length - 1];
            if (
              last &&
              last.viewMode === cur.viewMode &&
              last.activePlaylistId === cur.activePlaylistId &&
              last.activeSearchTerm === cur.activeSearchTerm
            ) {
              return prev;
            }
            return [...prev.slice(-14), { ...cur }];
          });
        }
        setViewMode(nextMode);
        if (shouldScrollTop) scrollMusicToTop();
      },
      [scrollMusicToTop]
    );

    const handleGoBack = useCallback(() => {
      setNavHistory((prev) => {
        if (prev.length === 0) {
          setViewMode('home');
          setActivePlaylistId('pl_global_hits');
          return [];
        }
        const target = prev[prev.length - 1];
        setViewMode(target.viewMode);
        if (target.activePlaylistId) setActivePlaylistId(target.activePlaylistId);
        setActiveSearchTerm(target.activeSearchTerm);
        setCustomSearchHeader(target.customSearchHeader);
        return prev.slice(0, -1);
      });
      scrollMusicToTop();
    }, [scrollMusicToTop]);

    const activePlaylist = useMemo(
      () =>
        SPOTIFY_PLAYLISTS.find((p) => p.id === activePlaylistId) ||
        SPOTIFY_PLAYLISTS[0],
      [activePlaylistId]
    );

    const offlineMusic = useOfflineMusicState();
    const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(() =>
      typeof navigator !== 'undefined' ? navigator.onLine !== false : true
    );
    useEffect(() => {
      if (typeof window === 'undefined') return;
      const syncOnline = () => setIsBrowserOnline(navigator.onLine !== false);
      window.addEventListener('online', syncOnline);
      window.addEventListener('offline', syncOnline);
      return () => {
        window.removeEventListener('online', syncOnline);
        window.removeEventListener('offline', syncOnline);
      };
    }, []);

    const heroTrack = currentTrack || tracksList[0] || INITIAL_SPOTIFY_TRACKS[0];
    const effectiveDuration =
      durationSec > 0 ? durationSec : heroTrack.durationSec || 200;
    const progressPct = Math.min(
      100,
      Math.max(0, (elapsedSec / Math.max(1, effectiveDuration)) * 100)
    );
    const effectiveQueue =
      queue && queue.length > 0 ? queue : tracksList.length > 0 ? tracksList : INITIAL_SPOTIFY_TRACKS;

    // Record recently played tracks to make Home shelves dynamically reflect listening history
    useEffect(() => {
      if (!currentTrack) return;
      if (onRecordRecentTrack) {
        return;
      }
      setLocalRecentTracks((prev) => {
        const filtered = prev.filter((t) => t.id !== currentTrack.id);
        const next = [currentTrack, ...filtered].slice(0, 18);
        try {
          localStorage.setItem(RECENT_TRACKS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    }, [currentTrack, onRecordRecentTrack]);

    // Listen for Top Header Music Pill click & global Descărcate shortcut
    useEffect(() => {
      const onOpenSongEvent = () => {
        const target = currentTrack || tracksList[0] || INITIAL_SPOTIFY_TRACKS[0];
        if (!target) return;
        setStudioTrack(target);
        setSongViewInitialTab('studio');
        pushView('song');
      };
      const onOpenOfflineEvent = () => {
        setActivePlaylistId('offline_downloads');
        pushView('playlist');
      };
      window.addEventListener('filmio:open-music-song-view', onOpenSongEvent);
      window.addEventListener('filmio:open-music-offline-view', onOpenOfflineEvent);
      try {
        if (window.sessionStorage.getItem('filmio_open_music_offline') === '1') {
          window.sessionStorage.removeItem('filmio_open_music_offline');
          onOpenOfflineEvent();
        }
      } catch {
        // ignore storage access errors
      }
      return () => {
        window.removeEventListener('filmio:open-music-song-view', onOpenSongEvent);
        window.removeEventListener('filmio:open-music-offline-view', onOpenOfflineEvent);
      };
    }, [currentTrack, tracksList, pushView]);

    // Keep Liked / Offline playlists synced without re-fetching network playlists
    useEffect(() => {
      if (activePlaylistId === 'liked_songs') {
        setTracksList(likedTracks);
      } else if (activePlaylistId === 'offline_downloads') {
        setTracksList(offlineMusic.recordsList.map((r) => r.track));
      }
    }, [activePlaylistId, likedTracks, offlineMusic.recordsList]);

    // Load playlist tracks when activePlaylistId changes (50 tracks per playlist)
    useEffect(() => {
      if (
        activePlaylistId === 'search_results' ||
        activePlaylistId === 'liked_songs' ||
        activePlaylistId === 'offline_downloads'
      ) {
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
                artistId: item.artistId ? `it_art_${item.artistId}` : undefined,
                album: String(item.collectionName || item.trackName),
                albumId: item.collectionId ? `it_alb_${item.collectionId}` : undefined,
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
    }, [activePlaylistId]);

    // Dynamically fetch smart suggestions ("Mixurile tale de top") based on current or liked artists
    useEffect(() => {
      const seedArtist =
        currentTrack?.artist ||
        likedTracks[0]?.artist ||
        'The Weeknd, Dua Lipa, Bruno Mars, Lady Gaga';
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
        .catch(() => { });
      return () => {
        cancelled = true;
      };
    }, [currentTrack?.artist, currentTrack?.title, likedTracks]);

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

    // ============================================================================
    // NAVIGATION HANDLERS: Search, Home, Playlist, Artist, Album, Song, Radio
    // ============================================================================
    const handleSelectHome = useCallback(() => {
      setSearchQuery('');
      setActiveSearchTerm('');
      setCustomSearchHeader('');
      setSearchResults([]);
      setSearchArtists([]);
      setSearchAlbums([]);
      setPlaylistFilterQuery('');
      setActiveAlbumCard(null);
      setActivePlaylistId('pl_global_hits');
      setViewMode('home');
      setNavHistory([]);
      scrollMusicToTop();
    }, [scrollMusicToTop]);

    const handleSelectPlaylist = useCallback(
      (playlistId: string) => {
        setSearchQuery('');
        setActiveSearchTerm('');
        setCustomSearchHeader('');
        setPlaylistFilterQuery('');
        setActivePlaylistId(playlistId);
        pushView('playlist');
      },
      [pushView]
    );

    const handleOpenArtist = useCallback(
      async (artistName: string, artistId?: string) => {
        const clean = (artistName || '').split(/[&,]/)[0].trim() || artistName.trim();
        if (!clean) return;
        setArtistNameFallback(clean);
        setIsLoadingArtist(true);
        setActiveArtistProfile(null);
        pushView('artist');
        const profile = await loadArtistProfileData(clean, artistId);
        setActiveArtistProfile(profile);
        setIsLoadingArtist(false);
      },
      [pushView]
    );

    const handleOpenAlbumCard = useCallback(
      async (
        albumName: string,
        artistName: string,
        albumId?: string,
        fallbackTrack?: SpotifyTrackItem
      ) => {
        const cleanAlbum = (albumName || fallbackTrack?.album || '').trim();
        const cleanArtist = (artistName || fallbackTrack?.artist || '').trim();
        if (!cleanAlbum && !cleanArtist) return;

        const initialTracks = fallbackTrack ? [fallbackTrack] : [];
        setActiveAlbumCard({
          id: albumId,
          albumTitle: cleanAlbum || cleanArtist,
          artistName: cleanArtist,
          artistId: fallbackTrack?.artistId,
          coverUrl: fallbackTrack?.cover || INITIAL_SPOTIFY_TRACKS[0].cover,
          year: fallbackTrack?.year || 2025,
          genre: fallbackTrack?.genre || 'Music',
          trackCount: initialTracks.length,
          totalDurationSec: fallbackTrack?.durationSec || 200,
          tracks: initialTracks,
        });
        setIsLoadingAlbumCard(true);
        pushView('album');

        const card = await loadAlbumDetailData(
          cleanAlbum,
          cleanArtist,
          albumId,
          fallbackTrack
        );
        setActiveAlbumCard(card);
        setIsLoadingAlbumCard(false);
      },
      [pushView]
    );

    const handleOpenSongStudio = useCallback(
      (track: SpotifyTrackItem, tab: 'studio' | 'lyrics' | 'queue' = 'studio') => {
        setStudioTrack(track);
        setSongViewInitialTab(tab);
        pushView('song');
      },
      [pushView]
    );

    const handleStartSongRadio = useCallback(
      async (seedTrack: SpotifyTrackItem, forceRefresh = false) => {
        setIsLoadingRadio(true);
        setActiveRadioData((prev) =>
          !forceRefresh && prev?.id === `radio_${seedTrack.id}`
            ? prev
            : {
              id: `radio_${seedTrack.id}`,
              title: `Radio ${seedTrack.title}`,
              subtitle: `${seedTrack.artist} & Artiști similari`,
              seedTrack,
              seedCover: seedTrack.cover || seedTrack.coverSmall || FALLBACK_MUSIC_COVER,
              relatedNames: [],
              tracks: [seedTrack],
            }
        );
        if (!forceRefresh) {
          pushView('radio');
        }

        const data = await loadSongRadioPlaylist(seedTrack);
        const finalTracks =
          forceRefresh && data.tracks.length > 2
            ? [
              data.seedTrack,
              ...data.tracks.slice(1).sort(() => Math.random() - 0.5),
            ]
            : data.tracks;
        const updated = { ...data, tracks: finalTracks };
        setActiveRadioData(updated);
        setIsLoadingRadio(false);

        if (finalTracks.length > 0) {
          // Keep playing seamlessly if the seed track is already playing; otherwise start Track #1 immediately
          if (currentTrack?.id === seedTrack.id && isPlaying && onUpdateQueue && !forceRefresh) {
            onUpdateQueue(finalTracks);
          } else {
            onPlayTrack(finalTracks[0], finalTracks);
          }
        }
      },
      [currentTrack?.id, isPlaying, onPlayTrack, onUpdateQueue, pushView]
    );

    const handleRunSearch = useCallback(
      async (
        customQuery?: string,
        customLabel?: string,
        scrollToTop = true
      ) => {
        const q = (customQuery ?? searchQueryRef.current).trim();
        if (!q) {
          handleSelectHome();
          return;
        }
        if (customQuery !== undefined) {
          setSearchQuery(q);
        }
        setActiveSearchTerm(q);
        setCustomSearchHeader(customLabel || q);
        setActivePlaylistId('search_results');
        setSearchSubTab('all');
        setIsSearching(true);
        setViewMode('search');
        if (scrollToTop) scrollMusicToTop();

        let finalTracks: SpotifyTrackItem[] = [];
        let finalArtists: SpotifyArtistSummary[] = [];
        let finalAlbums: SpotifyAlbumSummary[] = [];

        // 1. Primary multi-entity catalog fetch (tracks + artists + albums)
        try {
          const res = await fetch(
            `/api/youtube/music-catalog?q=${encodeURIComponent(
              q
            )}&country=RO&limit=50`
          );
          const cType = res.headers.get('content-type') || '';
          if (res.ok && cType.includes('application/json')) {
            const data = await res.json();
            if (data?.ok) {
              if (Array.isArray(data.tracks)) finalTracks = data.tracks;
              if (Array.isArray(data.artists)) finalArtists = data.artists;
              if (Array.isArray(data.albums)) finalAlbums = data.albums;
            }
          }
        } catch (err) {
          console.warn('[Music] Catalog fetch failed, trying iTunes fallback:', err);
        }

        // 2. Direct browser iTunes Search fallback if serverless failed
        if (finalTracks.length === 0) {
          try {
            const [itRes, itAlbRes] = await Promise.all([
              fetch(
                `https://itunes.apple.com/search?term=${encodeURIComponent(
                  q
                )}&country=RO&media=music&entity=song&limit=50`
              ),
              fetch(
                `https://itunes.apple.com/search?term=${encodeURIComponent(
                  q
                )}&country=RO&media=music&entity=album&limit=10`
              ),
            ]);
            if (itRes.ok) {
              const itData = await itRes.json();
              const results = Array.isArray(itData?.results) ? itData.results : [];
              finalTracks = results
                .filter((item: any) => item?.trackName && item?.artistName)
                .map((item: any, idx: number) => {
                  const rawArt = String(item.artworkUrl100 || '');
                  const cover = rawArt
                    ? rawArt.replace(/\d+x\d+bb/, '1000x1000bb')
                    : FALLBACK_MUSIC_COVER;
                  const coverSmall = rawArt
                    ? rawArt.replace(/\d+x\d+bb/, '300x300bb')
                    : cover;
                  const audioQuery = `${item.artistName} - ${item.trackName} Official Audio`;
                  const isHiRes = idx % 3 !== 2;
                  return {
                    id: `sp_${item.trackId || idx}`,
                    title: String(item.trackName),
                    artist: String(item.artistName),
                    artistId: item.artistId ? `it_art_${item.artistId}` : undefined,
                    album: String(item.collectionName || item.trackName),
                    albumId: item.collectionId ? `it_alb_${item.collectionId}` : undefined,
                    cover,
                    coverSmall,
                    durationSec: Math.max(
                      45,
                      Math.round((Number(item.trackTimeMillis) || 200000) / 1000)
                    ),
                    year: item.releaseDate
                      ? Number(String(item.releaseDate).slice(0, 4)) || 2025
                      : 2025,
                    genre: String(item.primaryGenreName || 'Pop'),
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
            }
            if (itAlbRes.ok && finalAlbums.length === 0) {
              const ad = await itAlbRes.json();
              finalAlbums = (ad?.results || [])
                .filter((a: any) => a?.collectionName)
                .map((a: any) => ({
                  id: `it_alb_${a.collectionId}`,
                  title: String(a.collectionName),
                  artist: String(a.artistName || ''),
                  artistId: a.artistId ? `it_art_${a.artistId}` : undefined,
                  cover: String(a.artworkUrl100 || '').replace(/\d+x\d+bb/, '1000x1000bb') || FALLBACK_MUSIC_COVER,
                  year: a.releaseDate ? Number(String(a.releaseDate).slice(0, 4)) || undefined : undefined,
                  recordType: 'album',
                }));
            }
          } catch (itErr) {
            console.warn('[Music] iTunes fallback search error:', itErr);
          }
        }

        // Derive artists from tracks if searchArtists returned empty
        if (finalArtists.length === 0 && finalTracks.length > 0) {
          const seenArt = new Set<string>();
          for (const t of finalTracks) {
            const clean = t.artist.split(/[&,]/)[0].trim();
            const key = normalizeMusicStr(clean);
            if (!key || seenArt.has(key)) continue;
            seenArt.add(key);
            finalArtists.push({
              id: t.artistId || `art_${key}`,
              name: clean,
              avatar: t.artistAvatar || t.cover,
            });
            if (finalArtists.length >= 6) break;
          }
        }

        setSearchResults(finalTracks);
        setSearchArtists(finalArtists);
        setSearchAlbums(finalAlbums);
        if (finalTracks.length > 0) {
          setTracksList(finalTracks);
        }
        setIsSearching(false);
      },
      [handleSelectHome, scrollMusicToTop]
    );

    // Live Spotify-style debounced search as the user types
    useEffect(() => {
      const trimmed = searchQuery.trim();
      if (!trimmed) {
        if (viewMode === 'search') {
          handleSelectHome();
        }
        return;
      }
      if (trimmed.length < 2) return;
      const timer = window.setTimeout(() => {
        void handleRunSearch(trimmed, trimmed, false);
      }, 450);
      return () => clearTimeout(timer);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery]);

    // React to external search requests (e.g. clicking a song, artist, or album in Radio)
    useEffect(() => {
      if (externalSearchRequest?.album) {
        void handleOpenAlbumCard(
          externalSearchRequest.album,
          externalSearchRequest.artist || externalSearchRequest.query
        );
        return;
      }
      if (externalSearchRequest?.artist && !externalSearchRequest?.query) {
        void handleOpenArtist(externalSearchRequest.artist);
        return;
      }
      if (externalSearchRequest?.query) {
        void handleRunSearch(
          externalSearchRequest.query,
          externalSearchRequest.label || externalSearchRequest.query
        );
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      externalSearchRequest?.ts,
      externalSearchRequest?.query,
      externalSearchRequest?.album,
      externalSearchRequest?.artist,
    ]);

    const handlePlayNextInQueue = (track: SpotifyTrackItem) => {
      if (!onUpdateQueue) return;
      const base = effectiveQueue.filter((t) => t.id !== track.id);
      const curIdx = currentTrack
        ? base.findIndex((t) => t.id === currentTrack.id)
        : -1;
      const insertAt = curIdx >= 0 ? curIdx + 1 : 0;
      const next = [...base.slice(0, insertAt), track, ...base.slice(insertAt)];
      onUpdateQueue(next);
    };

    const handleRemoveFromQueue = (trackId: string) => {
      if (!onUpdateQueue) return;
      onUpdateQueue(effectiveQueue.filter((t) => t.id !== trackId));
    };

    // Build Dynamic Personalized Radio Stations ("Posturi recomandate")
    const dynamicStations = useMemo(() => {
      const palettes = [
        'from-[#2563eb] to-[#0f172a]',
        'from-[#3b82f6] to-[#172554]',
        'from-[#60a5fa] to-[#1e3a8a]',
        'from-[#93c5fd] to-[#1e3a8a]',
        'from-[#1d4ed8] to-[#0b0f19]',
        'from-[#3b82f6] to-[#0f172a]',
      ];
      const items: Array<{
        id: string;
        name: string;
        role: string;
        avatar: string;
        cardBg: string;
        seedTrack?: SpotifyTrackItem;
        artistId?: string;
      }> = [];
      const seenArt = new Set<string>();

      // First inject dynamic stations from user's Liked & Recent tracks
      for (const t of [...recentTracks, ...likedTracks]) {
        const cleanName = t.artist.split(/[&,]/)[0].trim();
        const key = normalizeMusicStr(cleanName);
        if (!key || seenArt.has(key)) continue;
        seenArt.add(key);
        items.push({
          id: `dyn_art_${t.id}`,
          name: cleanName,
          role: tr(
            `Radio dinamic după «${t.title}»`,
            `Dynamic radio based on "${t.title}"`,
            `Персональное радио по «${t.title}»`
          ),
          avatar: t.artistAvatar || t.cover,
          cardBg: palettes[items.length % palettes.length],
          seedTrack: t,
          artistId: t.artistId,
        });
        if (items.length >= 3) break;
      }

      // Fill remainder up to 6 with curated Spotify Radio Stations
      for (const art of SPOTIFY_ARTISTS) {
        const key = normalizeMusicStr(art.name);
        if (seenArt.has(key)) continue;
        seenArt.add(key);
        items.push({
          id: art.id,
          name: art.name,
          role: art.role,
          avatar: art.avatar,
          cardBg: art.cardBg,
          seedTrack: {
            id: `seed_${art.id}`,
            title: art.name,
            artist: art.name,
            album: `Radio ${art.name}`,
            cover: art.avatar,
            coverSmall: art.avatar,
            durationSec: 210,
            year: 2025,
            genre: 'Spotify Radio Mix',
            fullAudioUrl: `/api/youtube/audio?q=${encodeURIComponent(
              `${art.name} Official Audio`
            )}`,
          },
        });
        if (items.length >= 6) break;
      }
      return items;
    }, [recentTracks, likedTracks, tr]);

    const offlineTracksList = useMemo(
      () => offlineMusic.recordsList.map((r) => r.track),
      [offlineMusic.recordsList]
    );

    const activePlaylistTracks = useMemo(() => {
      const base =
        activePlaylistId === 'liked_songs'
          ? likedTracks
          : activePlaylistId === 'offline_downloads'
            ? offlineTracksList
            : tracksList;
      const q = playlistFilterQuery.trim().toLowerCase();
      if (!q) return base;
      return base.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q)
      );
    }, [activePlaylistId, likedTracks, offlineTracksList, tracksList, playlistFilterQuery]);

    const playlistTotalDurationMin = useMemo(() => {
      const sec = activePlaylistTracks.reduce((acc, t) => acc + (t.durationSec || 0), 0);
      return Math.max(1, Math.round(sec / 60));
    }, [activePlaylistTracks]);

    const isHeroLiked = likedTracks.some((t) => t.id === heroTrack.id);
    const topArtistMatch = useMemo(() => {
      if (searchArtists.length === 0) return null;
      const nq = normalizeMusicStr(activeSearchTerm);
      return (
        searchArtists.find((a) => normalizeMusicStr(a.name).includes(nq) || nq.includes(normalizeMusicStr(a.name))) ||
        searchArtists[0]
      );
    }, [searchArtists, activeSearchTerm]);

    const currentSourceLabel = useMemo(() => {
      if (viewMode === 'radio' && activeRadioData) return activeRadioData.title;
      if (viewMode === 'search') return tr('Redare din căutare', 'Playing from search', 'Из поиска');
      if (activePlaylistId === 'liked_songs') return tr('Melodii îndrăgite', 'Liked Songs', 'Любимые треки');
      if (activePlaylistId === 'offline_downloads') return tr('Descărcate Offline', 'Offline Downloads', 'Скачанное офлайн');
      return tr(activePlaylist.titleRo, activePlaylist.titleEn, activePlaylist.titleRu);
    }, [viewMode, activeRadioData, activePlaylistId, activePlaylist, tr]);

    return (
      <div
        data-music-root="true"
        className="min-h-full flex-1 flex flex-col bg-[#080b12] text-white relative select-none"
      >
        {/* Subtle Spotify Top Ambient Gradient */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b ${viewMode === 'radio'
            ? 'from-[#172554]/45 via-[#0c111d] to-[#080b12]'
            : activePlaylistId === 'liked_songs' && viewMode === 'playlist'
              ? 'from-[#1e3a8a]/35 via-[#0d1220] to-[#080b12]'
              : activePlaylist?.accentColor ||
              'from-[#172554]/45 via-[#0c111d] to-[#080b12]'
            } transition-colors duration-700`}
        />

        {/* ====================================================================
          1. UNIFIED STICKY MUSIC TOP BAR (BACK + HOME + SEARCH + QUEUE + LIKED)
         ==================================================================== */}
        <div
          data-music-top-bar="true"
          className="sticky top-0 z-30 w-full px-3 sm:px-5 py-2.5 tahoe-glass !border-x-0 !border-t-0 border-b border-white/[0.12] space-y-2"
        >
          {/* Optional Official HD Music Video Clip Player inside Top Bar */}
          {isVideoClipMode && resolvedClipVideoId && (
            <div className="relative z-10 rounded-xl overflow-hidden border border-white/15 bg-black h-[190px] sm:h-[260px] lg:h-[300px] max-w-3xl mx-auto w-full shadow-2xl">
              <button
                type="button"
                onClick={() => setIsVideoClipMode(false)}
                title={tr('Închide clipul video', 'Close video clip', 'Закрыть клип')}
                className="absolute top-2.5 right-2.5 z-20 w-8 h-8 rounded-full bg-black/75 hover:bg-black text-white inline-flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
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

          {/* 1A. ROW 1: UNIFORM h-10 (40px) TOOLBAR */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {viewMode !== 'home' && (
              <button
                type="button"
                onClick={handleGoBack}
                className="h-10 px-3.5 rounded-full bg-[#141926] hover:bg-[#1c2436] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer focus:outline-none"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span>{tr('Înapoi', 'Back', 'Назад')}</span>
              </button>
            )}

            <button
              type="button"
              title={tr('Acasă Muzică', 'Music Home', 'Главная Музыка')}
              onClick={handleSelectHome}
              className={`h-10 w-10 sm:w-auto sm:px-3.5 rounded-full text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors cursor-pointer focus:outline-none ${viewMode === 'home'
                ? 'bg-white text-black shadow'
                : 'bg-[#141926] hover:bg-[#1c2436] text-white'
                }`}
            >
              <Home className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{tr('Acasă', 'Home', 'Главная')}</span>
            </button>

            {/* Search Pill */}
            <div className="relative flex-1 max-w-xl min-w-0">
              <Search className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleRunSearch();
                  }
                }}
                placeholder={tr(
                  'Ce dorești să asculți? (piesă, artist, album)',
                  'What do you want to play? (song, artist, album)',
                  'Что хочешь послушать?'
                )}
                className="w-full h-10 pl-10 pr-24 rounded-full bg-[#141926] hover:bg-[#1c2436] focus:bg-[#182032] border border-white/[0.09] focus:border-white/25 text-[13px] sm:text-sm text-white placeholder-[#94a3b8] focus:outline-none transition-colors"
              />
              {searchQuery.trim().length > 0 && (
                <button
                  type="button"
                  title={tr('Șterge căutarea', 'Clear search', 'Очистить поиск')}
                  onClick={handleSelectHome}
                  className="absolute right-[70px] top-1/2 -translate-y-1/2 w-7 h-7 rounded-full text-[#94a3b8] hover:text-white inline-flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleRunSearch()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-3 rounded-full bg-white/10 hover:bg-white hover:text-black text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {tr('Caută', 'Search', 'Найти')}
              </button>
            </div>

            <div className="ml-auto flex items-center gap-2 shrink-0">
              <button
                type="button"
                title={tr('Tastatură TV', 'TV Keyboard', 'ТВ Клавиатура')}
                onClick={() => setIsTvKeyboardOpen((v) => !v)}
                className={`hidden sm:inline-flex h-10 w-10 rounded-full items-center justify-center shrink-0 transition-colors cursor-pointer focus:outline-none ${isTvKeyboardOpen
                  ? 'bg-white text-black'
                  : 'bg-[#141926] hover:bg-[#1c2436] text-[#94a3b8] hover:text-white'
                  }`}
              >
                <Keyboard className="w-4 h-4" />
              </button>

              <button
                type="button"
                title={tr('Coada de redare', 'Play Queue', 'Очередь')}
                onClick={() => {
                  setFullscreenInitialTab('queue');
                  setIsFullScreenPlayerOpen(true);
                }}
                className="hidden md:inline-flex h-10 px-3.5 rounded-full bg-[#141926] hover:bg-[#1c2436] text-white text-[13px] font-semibold items-center gap-1.5 shrink-0 transition-colors cursor-pointer focus:outline-none"
              >
                <ListMusic className="w-4 h-4 text-[#94a3b8]" />
                <span>{tr('Coadă', 'Queue', 'Очередь')}</span>
                <span className="text-xs font-medium text-[#94a3b8] tabular-nums">
                  ({effectiveQueue.length})
                </span>
              </button>

              <button
                type="button"
                title={tr('Melodii descărcate offline (fără internet)', 'Offline Downloaded Music', 'Скачанная музыка')}
                onClick={() => handleSelectPlaylist('offline_downloads')}
                className={`h-10 px-3.5 rounded-full text-[13px] font-semibold inline-flex items-center justify-center gap-2 shrink-0 transition-colors cursor-pointer focus:outline-none ${viewMode === 'playlist' && activePlaylistId === 'offline_downloads'
                  ? 'bg-white text-black shadow'
                  : 'bg-[#141926] hover:bg-[#1c2436] text-white'
                  }`}
              >
                {offlineMusic.batchStats.active ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#60a5fa]" />
                ) : offlineMusic.recordsCount > 0 ? (
                  <OfflineDownloadedBadgeIcon className="w-4 h-4 shrink-0" />
                ) : (
                  <ArrowDownToLine className="w-4 h-4 text-[#94a3b8]" />
                )}
                <span className="hidden lg:inline">
                  {tr('Descărcate', 'Downloads', 'Скачанное')}
                </span>
                <span className="tabular-nums">{offlineMusic.recordsCount}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPlaylist('liked_songs')}
                className={`h-10 px-3.5 rounded-full text-[13px] font-semibold inline-flex items-center justify-center gap-2 shrink-0 transition-colors cursor-pointer focus:outline-none ${viewMode === 'playlist' && activePlaylistId === 'liked_songs'
                  ? 'bg-white text-black shadow'
                  : 'bg-[#141926] hover:bg-[#1c2436] text-white'
                  }`}
              >
                <Heart className="w-4 h-4 fill-[#60a5fa] text-[#60a5fa]" />
                <span className="hidden md:inline">
                  {tr('Melodii îndrăgite', 'Liked Songs', 'Любимые треки')}
                </span>
                <span className="tabular-nums">{likedTracks.length}</span>
              </button>
            </div>
          </div>

          {/* On-Screen Smart TV Keyboard for Remote Search */}
          {isTvKeyboardOpen && (
            <div className="p-2.5 rounded-xl bg-[#0e121b] border border-white/10 space-y-2">
              <div className="flex flex-wrap gap-1">
                {'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('').map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setSearchQuery((prev) => prev + ch)}
                    className="w-8 h-8 rounded-lg bg-[#161e2e] hover:bg-white hover:text-black active:scale-95 text-xs font-semibold text-white inline-flex items-center justify-center cursor-pointer"
                  >
                    {ch}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSearchQuery((prev) => prev + ' ')}
                  className="px-3 h-8 rounded-lg bg-[#161e2e] hover:bg-white hover:text-black text-xs font-semibold text-white cursor-pointer"
                >
                  SPACE
                </button>
                <button
                  type="button"
                  onClick={() => setSearchQuery((prev) => prev.slice(0, -1))}
                  className="px-2.5 h-8 rounded-lg bg-[#161e2e] hover:bg-rose-500 text-xs font-semibold text-white inline-flex items-center justify-center cursor-pointer"
                >
                  <Delete className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleRunSearch()}
                  className="px-3 h-8 rounded-lg bg-[#2563eb] text-white text-xs font-bold cursor-pointer"
                >
                  OK
                </button>
              </div>
            </div>
          )}

          {!isBrowserOnline && (
            <div className="px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 text-xs font-semibold text-amber-200">
                <WifiOff className="w-4 h-4 shrink-0 text-amber-300" />
                <span className="truncate">
                  {tr(
                    `Mod fără internet — ${offlineMusic.recordsCount} piese descărcate disponibile offline`,
                    `Offline mode — ${offlineMusic.recordsCount} downloaded tracks ready`,
                    `Офлайн-режим — доступно ${offlineMusic.recordsCount} треков`
                  )}
                </span>
              </div>
              {offlineMusic.recordsCount > 0 && activePlaylistId !== 'offline_downloads' && (
                <button
                  type="button"
                  onClick={() => handleSelectPlaylist('offline_downloads')}
                  className="h-7 px-3 rounded-full bg-amber-300 text-black text-xs font-bold shrink-0 cursor-pointer"
                >
                  {tr('Ascultă Offline', 'Open Offline', 'Открыть')}
                </button>
              )}
            </div>
          )}

          {/* 1B. ROW 2: FILTER CHIPS (h-8 / 32px) — ONLY ON HOME & PLAYLIST */}
          {(viewMode === 'home' || viewMode === 'playlist') && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
              <button
                type="button"
                onClick={handleSelectHome}
                className={`h-8 px-3.5 rounded-full text-xs font-semibold shrink-0 transition-colors cursor-pointer focus:outline-none ${viewMode === 'home'
                  ? 'bg-white text-[#0b0f19]'
                  : 'bg-[#141926] hover:bg-[#1c2436] border border-white/[0.08] text-white'
                  }`}
              >
                {tr('Toate', 'All', 'Все')}
              </button>

              {(offlineMusic.recordsCount > 0 || !isBrowserOnline) && (
                <button
                  type="button"
                  onClick={() => handleSelectPlaylist('offline_downloads')}
                  className={`h-8 px-3.5 rounded-full text-xs font-semibold shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer focus:outline-none ${viewMode === 'playlist' && activePlaylistId === 'offline_downloads'
                    ? 'bg-white text-black'
                    : 'bg-[#1e3a8a]/45 hover:bg-[#1e3a8a]/65 border border-[#60a5fa]/35 text-[#60a5fa]'
                    }`}
                >
                  <OfflineDownloadedBadgeIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tr('Descărcate Offline', 'Offline Downloads', 'Скачанное')}</span>
                </button>
              )}

              {SPOTIFY_PLAYLISTS.slice(1).map((pl) => {
                const isSelected = viewMode === 'playlist' && activePlaylistId === pl.id;
                return (
                  <button
                    key={`chip_${pl.id}`}
                    type="button"
                    onClick={() => handleSelectPlaylist(pl.id)}
                    className={`h-8 px-3.5 rounded-full text-xs font-semibold shrink-0 transition-colors cursor-pointer focus:outline-none ${isSelected
                      ? 'bg-white text-[#0b0f19]'
                      : 'bg-[#141926] hover:bg-[#1c2436] border border-white/[0.08] text-white'
                      }`}
                  >
                    {tr(pl.titleRo, pl.titleEn, pl.titleRu)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ====================================================================
          2. DYNAMIC PAGE ROUTER (ONLY ACTIVE VIEW IS RENDERED AT TOP!)
         ==================================================================== */}
        <div className="relative z-10 flex-1 px-3 sm:px-5 pt-4 pb-6">
          {/* VIEW 1: ARTIST PROFILE PAGE */}
          {viewMode === 'artist' && (
            <ArtistProfileView
              tr={tr}
              data={activeArtistProfile}
              isLoading={isLoadingArtist}
              artistNameFallback={artistNameFallback}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              isShuffle={isShuffle}
              likedTracks={likedTracks}
              onBack={handleGoBack}
              onPlayTrack={onPlayTrack}
              onToggleShuffle={onToggleShuffle}
              onToggleLikeTrack={onToggleLikeTrack}
              onOpenArtist={handleOpenArtist}
              onOpenAlbum={handleOpenAlbumCard}
              onStartRadio={(track) => void handleStartSongRadio(track)}
              onOpenSongStudio={(track) => handleOpenSongStudio(track, 'studio')}
              onOpenTrackMenu={setMenuTrack}
            />
          )}

          {/* VIEW 2: ALBUM DETAIL PAGE */}
          {viewMode === 'album' && (
            <AlbumDetailView
              tr={tr}
              album={activeAlbumCard}
              isLoading={isLoadingAlbumCard}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              isShuffle={isShuffle}
              likedTracks={likedTracks}
              onBack={handleGoBack}
              onPlayTrack={onPlayTrack}
              onToggleShuffle={onToggleShuffle}
              onToggleLikeTrack={onToggleLikeTrack}
              onOpenArtist={handleOpenArtist}
              onOpenAlbum={handleOpenAlbumCard}
              onStartRadio={(track) => void handleStartSongRadio(track)}
              onOpenSongStudio={(track) => handleOpenSongStudio(track, 'studio')}
              onOpenTrackMenu={setMenuTrack}
            />
          )}

          {/* VIEW 3: SONG RADIO GENERATED MIX PAGE */}
          {viewMode === 'radio' && (
            <SongRadioView
              tr={tr}
              radioData={activeRadioData}
              isLoading={isLoadingRadio}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              isShuffle={isShuffle}
              likedTracks={likedTracks}
              onBack={handleGoBack}
              onPlayTrack={onPlayTrack}
              onTogglePlayPause={onTogglePlayPause}
              onToggleShuffle={onToggleShuffle}
              onRegenerateRadio={() => {
                if (activeRadioData?.seedTrack) {
                  void handleStartSongRadio(activeRadioData.seedTrack, true);
                }
              }}
              onToggleLikeTrack={onToggleLikeTrack}
              onOpenArtist={handleOpenArtist}
              onOpenAlbum={handleOpenAlbumCard}
              onStartRadio={(track) => void handleStartSongRadio(track)}
              onOpenSongStudio={(track) => handleOpenSongStudio(track, 'studio')}
              onOpenTrackMenu={setMenuTrack}
            />
          )}

          {/* VIEW 4: SONG STUDIO & LIVE LYRICS DETAIL PAGE */}
          {viewMode === 'song' && (
            <SongStudioDetailView
              tr={tr}
              track={studioTrack || heroTrack}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              elapsedSec={elapsedSec}
              durationSec={effectiveDuration}
              progressPct={progressPct}
              isShuffle={isShuffle}
              isRepeat={isRepeat}
              isLiked={likedTracks.some((t) => t.id === (studioTrack || heroTrack).id)}
              isVideoClipMode={isVideoClipMode}
              queue={effectiveQueue}
              initialTab={songViewInitialTab}
              onBack={handleGoBack}
              onOpenFullscreen={() => {
                setFullscreenInitialTab(songViewInitialTab);
                setIsFullScreenPlayerOpen(true);
              }}
              onPlayTrack={onPlayTrack}
              onTogglePlayPause={onTogglePlayPause}
              onNextTrack={onNextTrack}
              onPrevTrack={onPrevTrack}
              onSeek={onSeek}
              onToggleShuffle={onToggleShuffle}
              onToggleRepeat={onToggleRepeat}
              onToggleLikeTrack={onToggleLikeTrack}
              onToggleVideoClip={() => setIsVideoClipMode((v) => !v)}
              onOpenArtist={handleOpenArtist}
              onOpenAlbum={handleOpenAlbumCard}
              onStartRadio={(track) => void handleStartSongRadio(track)}
              onRemoveFromQueue={handleRemoveFromQueue}
            />
          )}

          {/* VIEW 5: RICH SEARCH RESULTS VIEW */}
          {viewMode === 'search' && (
            <div className="space-y-6 pb-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className={`${MUSIC_TYPOGRAPHY.h1} truncate`}>
                  {tr('Rezultate pentru', 'Results for', 'Результаты')}: «{customSearchHeader || activeSearchTerm || searchQuery}»
                </h1>
                {/* Search Sub-Filter Tabs */}
                {!isSearching && (searchResults.length > 0 || searchArtists.length > 0 || searchAlbums.length > 0) && (
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {(
                      [
                        ['all', tr('Toate', 'All', 'Все')],
                        ['tracks', `${tr('Melodii', 'Songs', 'Треки')} (${searchResults.length})`],
                        ['artists', `${tr('Artiști', 'Artists', 'Артисты')} (${searchArtists.length})`],
                        ['albums', `${tr('Albume', 'Albums', 'Альбомы')} (${searchAlbums.length})`],
                      ] as const
                    ).map(([tabId, label]) => (
                      <button
                        key={tabId}
                        type="button"
                        onClick={() => setSearchSubTab(tabId)}
                        className={`h-8 px-3.5 rounded-full text-xs font-semibold shrink-0 transition-colors cursor-pointer ${searchSubTab === tabId
                          ? 'bg-white text-black'
                          : 'bg-white/[0.08] hover:bg-white/[0.15] text-white'
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isSearching ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-pulse">
                  <div className="lg:col-span-5 rounded-xl bg-[#0e121b] p-5 flex flex-col justify-between gap-4 min-h-[200px] border border-white/[0.09] shadow-xl">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-[#60a5fa] animate-spin" />
                      <span className="text-[13px] sm:text-sm font-semibold text-[#94a3b8]">
                        {tr(
                          `Căutăm «${activeSearchTerm || searchQuery}»...`,
                          `Searching for "${activeSearchTerm || searchQuery}"...`,
                          `Поиск «${activeSearchTerm || searchQuery}»...`
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-xl bg-white/10 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-5 w-40 rounded bg-white/10" />
                        <div className="h-3.5 w-28 rounded bg-white/5" />
                      </div>
                    </div>
                  </div>
                  <div className="lg:col-span-7 rounded-xl bg-[#0e121b]/90 p-3 space-y-2 border border-white/[0.09]">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center gap-3 py-1.5">
                        <div className="w-10 h-10 rounded-md bg-white/10 shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-4 w-40 rounded bg-white/10" />
                          <div className="h-3 w-24 rounded bg-white/5" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : searchResults.length > 0 || searchArtists.length > 0 || searchAlbums.length > 0 ? (
                <div className="space-y-6">
                  {/* ALL TAB: Top Result + Top 5 Songs */}
                  {(searchSubTab === 'all' || searchSubTab === 'tracks') &&
                    searchResults.length > 0 && (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                        {/* Compact Premium Top Result Card (zero dead space) */}
                        {searchSubTab === 'all' && (
                          <div className="lg:col-span-5 flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                              <h2 className={MUSIC_TYPOGRAPHY.h2}>
                                {tr('Rezultat de top', 'Top result', 'Лучший результат')}
                              </h2>
                              <span className="text-[11px] font-semibold text-[#60a5fa] bg-[#1e3a8a]/35 px-2.5 py-0.5 rounded-full">
                                {tr('Potrivire exactă', 'Exact match', 'Точное совпадение')}
                              </span>
                            </div>

                            <div className="flex-1 rounded-xl tahoe-glass hover:border-[#60a5fa]/35 p-4 sm:p-5 flex flex-col justify-between gap-4 border border-white/[0.08] shadow-xl transition-colors">
                              {/* Top Row: Cover + Title + Play Pill */}
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                  <img
                                    src={proxyMusicCover(searchResults[0].cover)}
                                    alt={searchResults[0].title}
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.src = FALLBACK_MUSIC_COVER;
                                    }}
                                    className="w-20 h-20 rounded-xl object-cover shadow-lg shrink-0 bg-[#111726]"
                                  />
                                  <div className="min-w-0 space-y-1">
                                    <button
                                      type="button"
                                      onClick={() => onPlayTrack(searchResults[0], searchResults)}
                                      className="text-left text-lg sm:text-xl font-extrabold text-white hover:underline truncate block max-w-full cursor-pointer"
                                    >
                                      {searchResults[0].title}
                                    </button>
                                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-[#94a3b8]">
                                      <span className="px-2 py-0.5 rounded-full bg-black/50 text-white font-semibold">
                                        {tr('Melodie', 'Song', 'Трек')}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handleOpenArtist(
                                            searchResults[0].artist,
                                            searchResults[0].artistId
                                          )
                                        }
                                        className="font-semibold text-white hover:text-[#93c5fd] hover:underline truncate cursor-pointer"
                                      >
                                        {searchResults[0].artist}
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  title={tr('Redă piesa', 'Play song', 'Слушать')}
                                  onClick={() => onPlayTrack(searchResults[0], searchResults)}
                                  style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                                  className="h-10 px-4 rounded-full bg-[#2563eb] text-white text-[13px] font-bold inline-flex items-center gap-1.5 shadow-lg hover:scale-[1.03] active:scale-95 transition-transform shrink-0 cursor-pointer"
                                >
                                  <Play className="w-4 h-4 fill-current text-white" />
                                  <span>{tr('Redă', 'Play', 'Слушать')}</span>
                                </button>
                              </div>

                              {/* Quick Action Pills: Artist / Album / Song Radio / Lyrics */}
                              <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-white/10">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleOpenArtist(
                                      topArtistMatch?.name || searchResults[0].artist,
                                      topArtistMatch?.id || searchResults[0].artistId
                                    )
                                  }
                                  className="h-8 px-3 rounded-full bg-white/[0.08] hover:bg-white hover:text-black text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <User className="w-3.5 h-3.5" />
                                  <span>{topArtistMatch?.name || searchResults[0].artist}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleOpenAlbumCard(
                                      searchResults[0].album || searchResults[0].title,
                                      searchResults[0].artist,
                                      searchResults[0].albumId,
                                      searchResults[0]
                                    )
                                  }
                                  className="h-8 px-3 rounded-full bg-white/[0.08] hover:bg-white hover:text-black text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer max-w-[180px]"
                                >
                                  <Disc className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">{searchResults[0].album}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => void handleStartSongRadio(searchResults[0])}
                                  className="h-8 px-3 rounded-full bg-[#2563eb]/15 hover:bg-[#2563eb] text-[#60a5fa] hover:text-white border border-[#60a5fa]/35 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <Radio className="w-3.5 h-3.5" />
                                  <span>{tr('Radio Piesă', 'Song Radio', 'Радио')}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenSongStudio(searchResults[0], 'lyrics')}
                                  className="h-8 px-3 rounded-full bg-white/[0.08] hover:bg-white hover:text-black text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <Mic2 className="w-3.5 h-3.5" />
                                  <span>{tr('Versuri', 'Lyrics', 'Текст')}</span>
                                </button>

                                <CollectionOfflineDownloadButton
                                  tr={tr}
                                  tracks={[searchResults[0]]}
                                  className="!h-8 !px-3 !text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Melodii (Top 5 or All when on Tracks tab) */}
                        <div
                          className={`${searchSubTab === 'all' ? 'lg:col-span-7' : 'lg:col-span-12'
                            } flex flex-col gap-3`}
                        >
                          <h2 className={MUSIC_TYPOGRAPHY.h2}>
                            {tr('Melodii', 'Songs', 'Треки')}
                          </h2>
                          <div className="rounded-xl bg-[#0e121b]/95 border border-white/[0.09] overflow-hidden">
                            {searchSubTab === 'tracks' && <TrackTableHeader tr={tr} showAlbum />}
                            <div className="p-1.5 space-y-0.5">
                              {(searchSubTab === 'tracks'
                                ? searchResults
                                : searchResults.slice(0, 5)
                              ).map((track, idx) => (
                                <PremiumTrackRow
                                  key={`sr_${track.id}_${idx}`}
                                  tr={tr}
                                  track={track}
                                  index={idx}
                                  isCurrent={currentTrack?.id === track.id}
                                  isPlaying={isPlaying}
                                  isLiked={likedTracks.some((t) => t.id === track.id)}
                                  showCover
                                  showAlbum={searchSubTab === 'tracks'}
                                  onPlay={() => onPlayTrack(track, searchResults)}
                                  onToggleLike={() => onToggleLikeTrack(track)}
                                  onOpenArtist={handleOpenArtist}
                                  onOpenAlbum={handleOpenAlbumCard}
                                  onStartRadio={(t) => void handleStartSongRadio(t)}
                                  onOpenSongStudio={(t) => handleOpenSongStudio(t, 'studio')}
                                  onOpenTrackMenu={setMenuTrack}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                  {/* MATCHING ARTISTS SHELF */}
                  {(searchSubTab === 'all' || searchSubTab === 'artists') &&
                    searchArtists.length > 0 && (
                      <div className="space-y-3">
                        <h2 className={MUSIC_TYPOGRAPHY.h2}>
                          {tr('Artiști', 'Artists', 'Исполнители')}
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                          {(searchSubTab === 'artists'
                            ? searchArtists
                            : searchArtists.slice(0, 6)
                          ).map((art) => (
                            <div
                              key={art.id}
                              className="relative group p-3 rounded-xl bg-[#0e121b]/95 hover:bg-[#161f30] border border-white/[0.09] transition-colors flex flex-col items-center text-center"
                            >
                              <button
                                type="button"
                                onClick={() => void handleOpenArtist(art.name, art.id)}
                                className="w-full flex flex-col items-center cursor-pointer focus:outline-none rounded-xl"
                              >
                                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden mb-2.5 shadow-xl bg-[#111726] ring-1 ring-white/10">
                                  <img
                                    src={proxyMusicCover(art.avatar)}
                                    alt={art.name}
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.src = FALLBACK_MUSIC_COVER;
                                    }}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                </div>
                                <div className="text-[13px] sm:text-sm font-semibold text-white truncate w-full">
                                  {art.name}
                                </div>
                                <div className="text-xs font-medium text-[#94a3b8] mt-0.5 truncate w-full">
                                  {art.fans
                                    ? `${formatFansCount(art.fans)} ${tr('fani', 'fans', 'фан.')}`
                                    : tr('Artist', 'Artist', 'Артист')}
                                </div>
                              </button>

                              <button
                                type="button"
                                title={tr('Radio Artist', 'Artist Radio', 'Радио артиста')}
                                onClick={() =>
                                  void handleStartSongRadio({
                                    id: `seed_${art.id}`,
                                    title: art.name,
                                    artist: art.name,
                                    artistId: art.id,
                                    album: `Radio ${art.name}`,
                                    cover: art.avatar,
                                    durationSec: 210,
                                    year: 2025,
                                    genre: 'Radio Mix',
                                    fullAudioUrl: `/api/youtube/audio?q=${encodeURIComponent(
                                      `${art.name} Official Audio`
                                    )}`,
                                  })
                                }
                                style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                                className="absolute right-4 bottom-14 w-10 h-10 rounded-full bg-[#2563eb] text-white flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all cursor-pointer"
                              >
                                <Play className="w-4 h-4 fill-current text-white ml-0.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* MATCHING ALBUMS SHELF */}
                  {(searchSubTab === 'all' || searchSubTab === 'albums') &&
                    searchAlbums.length > 0 && (
                      <div className="space-y-3">
                        <h2 className={MUSIC_TYPOGRAPHY.h2}>
                          {tr('Albume', 'Albums', 'Альбомы')}
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                          {(searchSubTab === 'albums'
                            ? searchAlbums
                            : searchAlbums.slice(0, 6)
                          ).map((alb) => (
                            <button
                              key={alb.id}
                              type="button"
                              onClick={() =>
                                void handleOpenAlbumCard(alb.title, alb.artist, alb.id)
                              }
                              className="p-3 rounded-xl bg-[#0e121b]/95 hover:bg-[#161f30] border border-white/[0.09] focus:outline-none transition-colors text-left group cursor-pointer flex flex-col"
                            >
                              <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-2.5 shadow-lg bg-[#111726]">
                                <img
                                  src={proxyMusicCover(alb.cover)}
                                  alt={alb.title}
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = FALLBACK_MUSIC_COVER;
                                  }}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              </div>
                              <div className="text-[13px] sm:text-sm font-semibold text-white truncate w-full">
                                {alb.title}
                              </div>
                              <div className="text-xs font-medium text-[#94a3b8] truncate mt-0.5 w-full">
                                {alb.year ? `${alb.year} • ` : ''}
                                {alb.artist}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* REMAINING SONGS (when on 'all' tab) */}
                  {searchSubTab === 'all' && searchResults.length > 5 && (
                    <div className="space-y-3">
                      <h2 className={MUSIC_TYPOGRAPHY.h2}>
                        {tr('Alte melodii găsite', 'More matching songs', 'Другие найденные треки')} (
                        {searchResults.length - 5})
                      </h2>
                      <div className="rounded-xl bg-[#0e121b]/95 border border-white/[0.09] overflow-hidden">
                        <TrackTableHeader tr={tr} showAlbum />
                        <div className="p-1.5 space-y-0.5">
                          {searchResults.slice(5).map((track, idx) => (
                            <PremiumTrackRow
                              key={`sr_rem_${track.id}_${idx}`}
                              tr={tr}
                              track={track}
                              index={idx + 5}
                              isCurrent={currentTrack?.id === track.id}
                              isPlaying={isPlaying}
                              isLiked={likedTracks.some((t) => t.id === track.id)}
                              showCover
                              showAlbum
                              onPlay={() => onPlayTrack(track, searchResults)}
                              onToggleLike={() => onToggleLikeTrack(track)}
                              onOpenArtist={handleOpenArtist}
                              onOpenAlbum={handleOpenAlbumCard}
                              onStartRadio={(t) => void handleStartSongRadio(t)}
                              onOpenSongStudio={(t) => handleOpenSongStudio(t, 'studio')}
                              onOpenTrackMenu={setMenuTrack}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Friendly Empty State */
                <div className="rounded-xl bg-[#0e121b] p-8 text-center space-y-4 max-w-lg mx-auto border border-white/[0.08] shadow-xl">
                  <Search className="w-10 h-10 text-[#94a3b8] mx-auto opacity-50" />
                  <div className="space-y-1">
                    <h2 className={MUSIC_TYPOGRAPHY.h2}>
                      {tr(
                        `Nu am găsit rezultate pentru «${activeSearchTerm || searchQuery}»`,
                        `No results found for "${activeSearchTerm || searchQuery}"`,
                        `Ничего не найдено по запросу «${activeSearchTerm || searchQuery}»`
                      )}
                    </h2>
                    <p className={MUSIC_TYPOGRAPHY.meta}>
                      {tr(
                        'Verifică ortografia sau încearcă una dintre căutările populare de mai jos:',
                        'Check spelling or try one of the popular suggestions below:',
                        'Проверьте написание или попробуйте популярные запросы:'
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    {[
                      'Achille Lauro',
                      'Smiley',
                      "Carla's Dreams",
                      'The Weeknd',
                      'Dua Lipa',
                      'Andra',
                    ].map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => void handleRunSearch(term, term)}
                        className="h-8 px-3.5 rounded-full bg-white/[0.08] hover:bg-[#2563eb] hover:text-white text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW 6: DEDICATED PLAYLIST, MELODII ÎNDRĂGITE OR OFFLINE DOWNLOADS VIEW */}
          {viewMode === 'playlist' && (
            <div className="space-y-5 pb-8">
              {/* Unified Compact Horizontal Hero Card */}
              <div className="rounded-xl tahoe-glass p-4 sm:p-5 shadow-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  {activePlaylistId === 'liked_songs' ? (
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gradient-to-br from-[#0f172a] via-[#1e3a8a] to-[#60a5fa] flex items-center justify-center shrink-0 shadow-xl">
                      <Heart className="w-9 h-9 text-white fill-white" />
                    </div>
                  ) : activePlaylistId === 'offline_downloads' ? (
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gradient-to-br from-[#0f172a] via-[#1e3a8a] to-[#3b82f6] flex items-center justify-center shrink-0 shadow-xl">
                      <ArrowDownToLine className="w-9 h-9 text-white" />
                    </div>
                  ) : (
                    <img
                      src={proxyMusicCover(activePlaylist.cover)}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = FALLBACK_MUSIC_COVER;
                      }}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0 shadow-xl bg-[#111726]"
                    />
                  )}

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-xs font-semibold text-[#60a5fa]">
                      {activePlaylistId === 'liked_songs'
                        ? tr('Playlistul Tău Favorit', 'Your Favorite Playlist', 'Любимые треки')
                        : activePlaylistId === 'offline_downloads'
                          ? tr('Bibliotecă Offline pe Dispozitiv', 'On-Device Offline Music', 'Музыка без интернета')
                          : activePlaylist.badge || tr('Playlist Public', 'Public Playlist', 'Плейлист')}
                    </div>
                    <h1 className={`${MUSIC_TYPOGRAPHY.h1} truncate`}>
                      {activePlaylistId === 'liked_songs'
                        ? tr('Melodii îndrăgite', 'Liked Songs', 'Любимые треки')
                        : activePlaylistId === 'offline_downloads'
                          ? tr('Melodii Descărcate Offline', 'Offline Downloads', 'Скачанная музыка')
                          : tr(
                            activePlaylist.titleRo,
                            activePlaylist.titleEn,
                            activePlaylist.titleRu
                          )}
                    </h1>
                    <p className={`${MUSIC_TYPOGRAPHY.meta} truncate`}>
                      {activePlaylistId === 'liked_songs'
                        ? `${likedTracks.length} ${tr('melodii salvate', 'saved songs', 'сохраненных треков')} • ~${playlistTotalDurationMin} min`
                        : activePlaylistId === 'offline_downloads'
                          ? `${offlineMusic.recordsCount} ${tr('melodii salvate offline', 'tracks saved offline', 'треков офлайн')} • ${formatOfflineMusicBytes(offlineMusic.totalBytes)} • ~${playlistTotalDurationMin} min`
                          : `${tr(
                            activePlaylist.subtitleRo,
                            activePlaylist.subtitleEn,
                            activePlaylist.subtitleRu
                          )} • ${activePlaylistTracks.length} ${tr('melodii', 'songs', 'треков')} • ~${playlistTotalDurationMin} min`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto justify-between lg:justify-end">
                  {/* Quick in-playlist search filter (h-10) */}
                  <div className="relative flex-1 sm:flex-none sm:w-52">
                    <Search className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={playlistFilterQuery}
                      onChange={(e) => setPlaylistFilterQuery(e.target.value)}
                      placeholder={tr('Filtrează piese...', 'Filter songs...', 'Фильтр...')}
                      className="w-full h-10 pl-9 pr-3 rounded-full bg-white/[0.08] hover:bg-white/[0.12] focus:bg-white/[0.15] border border-white/[0.09] focus:border-white/25 text-[13px] text-white placeholder-[#94a3b8] focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {isLoadingTracks && (
                      <Loader2 className="w-5 h-5 text-[#60a5fa] animate-spin" />
                    )}

                    {activePlaylistId === 'offline_downloads' ? (
                      offlineMusic.recordsCount > 0 && (
                        <button
                          type="button"
                          onClick={() => void clearAllOfflineMusic()}
                          className="h-10 px-4 rounded-full bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-200 text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="hidden sm:inline">
                            {tr('Șterge tot', 'Clear Offline', 'Очистить')}
                          </span>
                        </button>
                      )
                    ) : (
                      <CollectionOfflineDownloadButton
                        tr={tr}
                        tracks={activePlaylistTracks}
                      />
                    )}

                    {activePlaylistTracks[0] && isBrowserOnline && (
                      <button
                        type="button"
                        title={tr('Radio după acest playlist', 'Playlist Radio', 'Радио плейлиста')}
                        onClick={() => void handleStartSongRadio(activePlaylistTracks[0])}
                        className="h-10 px-4 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Radio className="w-4 h-4" />
                        <span className="hidden sm:inline">{tr('Radio Mix', 'Radio Mix', 'Радио')}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      title={tr('Amestecare', 'Shuffle', 'Перемешать')}
                      onClick={onToggleShuffle}
                      className={`h-10 w-10 rounded-full inline-flex items-center justify-center border transition-colors cursor-pointer ${isShuffle
                        ? 'text-[#60a5fa] bg-[#1e3a8a]/45 border-[#60a5fa]/50'
                        : 'text-[#94a3b8] hover:text-white bg-white/[0.08] border-white/10'
                        }`}
                    >
                      <Shuffle className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      title={tr('Redă Tot', 'Play All', 'Слушать всё')}
                      onClick={() => {
                        if (activePlaylistTracks.length > 0) {
                          onPlayTrack(activePlaylistTracks[0], activePlaylistTracks);
                        }
                      }}
                      style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                      className="h-10 px-5 rounded-full bg-[#2563eb] hover:scale-[1.03] text-white text-[13px] font-bold inline-flex items-center gap-2 shadow-lg transition-transform cursor-pointer focus:outline-none"
                    >
                      <Play className="w-4 h-4 fill-current text-white" />
                      <span>{tr('Redă Tot', 'Play All', 'Слушать')}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-[#0e121b]/95 border border-white/[0.09] overflow-hidden shadow-xl">
                {activePlaylistId === 'offline_downloads' && offlineMusic.recordsCount === 0 ? (
                  <div className="p-8 sm:p-12 text-center space-y-4">
                    <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto text-[#60a5fa]">
                      <ArrowDownToLine className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <h2 className={MUSIC_TYPOGRAPHY.h2}>
                        {tr(
                          'Nu ai nicio melodie descărcată încă',
                          'No downloaded tracks yet',
                          'Нет скачанных треков'
                        )}
                      </h2>
                      <p className={MUSIC_TYPOGRAPHY.meta}>
                        {tr(
                          'Apasă butonul de descărcare de pe orice melodie, album, playlist, Radio sau din Melodii îndrăgite ca să le asculți fără internet.',
                          'Tap the download icon on any track, album, playlist, radio mix, or Liked Songs to listen without internet.',
                          'Нажмите кнопку скачивания на любом треке, альбоме или плейлисте для прослушивания без интернета.'
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectPlaylist('liked_songs')}
                      className="h-10 px-5 rounded-full bg-white text-black text-[13px] font-bold hover:scale-[1.03] transition-transform cursor-pointer"
                    >
                      {tr('Mergi la Melodii îndrăgite', 'Go to Liked Songs', 'К Любимым трекам')}
                    </button>
                  </div>
                ) : activePlaylistId === 'liked_songs' && likedTracks.length === 0 ? (
                  <div className="p-8 sm:p-12 text-center space-y-4">
                    <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto text-[#60a5fa]">
                      <Heart className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <h2 className={MUSIC_TYPOGRAPHY.h2}>
                        {tr(
                          'Melodiile pe care le apreciezi vor apărea aici',
                          'Songs you like will appear here',
                          'Треки, которые вам нравятся, появятся здесь'
                        )}
                      </h2>
                      <p className={MUSIC_TYPOGRAPHY.meta}>
                        {tr(
                          'Apasă pe pictograma inimă de pe orice piesă pentru a o adăuga la favorite.',
                          'Save songs you like by tapping the heart icon on any track.',
                          'Сохраняйте любимые треки, нажимая на иконку сердечка.'
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectPlaylist('pl_global_hits')}
                      className="h-10 px-5 rounded-full bg-white text-black text-[13px] font-bold hover:scale-[1.03] transition-transform cursor-pointer"
                    >
                      {tr('Explorează Top Hits', 'Explore Top Hits', 'Смотреть Топ Хиты')}
                    </button>
                  </div>
                ) : (
                  <>
                    <TrackTableHeader tr={tr} showAlbum />
                    <div className="p-1.5 space-y-0.5">
                      {activePlaylistTracks.map((track, idx) => (
                        <PremiumTrackRow
                          key={`pl_tr_${track.id}_${idx}`}
                          tr={tr}
                          track={track}
                          index={idx}
                          isCurrent={currentTrack?.id === track.id}
                          isPlaying={isPlaying}
                          isLiked={likedTracks.some((t) => t.id === track.id)}
                          showCover
                          showAlbum
                          onPlay={() => onPlayTrack(track, activePlaylistTracks)}
                          onToggleLike={() => onToggleLikeTrack(track)}
                          onOpenArtist={handleOpenArtist}
                          onOpenAlbum={handleOpenAlbumCard}
                          onStartRadio={(t) => void handleStartSongRadio(t)}
                          onOpenSongStudio={(t) => handleOpenSongStudio(t, 'studio')}
                          onOpenTrackMenu={setMenuTrack}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* VIEW 7: DYNAMIC MUSIC HOME DASHBOARD ('home') */}
          {viewMode === 'home' && (
            <div className="space-y-6 pb-6">
              {/* 7A. 2x4 Dynamic Quick-Pick Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                {/* Card 1: Melodii îndrăgite */}
                <div className="relative group h-14 sm:h-[60px] rounded-xl overflow-hidden bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.09] transition-colors">
                  <button
                    type="button"
                    onClick={() => handleSelectPlaylist('liked_songs')}
                    className="w-full h-full flex items-center gap-3 pr-12 text-left cursor-pointer focus:outline-none"
                  >
                    <div className="w-14 sm:w-[60px] h-full bg-gradient-to-br from-[#0f172a] via-[#1e3a8a] to-[#60a5fa] flex items-center justify-center shrink-0">
                      <Heart className="w-5 h-5 text-white fill-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] sm:text-sm font-semibold text-white truncate">
                        {tr('Melodii îndrăgite', 'Liked Songs', 'Любимые треки')}
                      </div>
                      <div className="text-xs font-medium text-[#94a3b8] truncate">
                        {likedTracks.length} {tr('melodii', 'songs', 'треков')}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    title={tr('Redă Favorite', 'Play Liked Songs', 'Слушать Любимые')}
                    onClick={() => {
                      if (likedTracks.length > 0) {
                        onPlayTrack(likedTracks[0], likedTracks);
                      } else {
                        handleSelectPlaylist('liked_songs');
                      }
                    }}
                    style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#2563eb] text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current text-white ml-0.5" />
                  </button>
                </div>

                {/* Cards 2–8: Top 7 Playlists */}
                {SPOTIFY_PLAYLISTS.slice(0, 7).map((pl) => {
                  const isThisPlPlaying =
                    isPlaying && activePlaylistId === pl.id && currentTrack !== null;
                  return (
                    <div
                      key={`quick_${pl.id}`}
                      className="relative group h-14 sm:h-[60px] rounded-xl overflow-hidden bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.09] transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectPlaylist(pl.id)}
                        className="w-full h-full flex items-center gap-3 pr-12 text-left cursor-pointer focus:outline-none"
                      >
                        <img
                          src={proxyMusicCover(pl.cover)}
                          alt={tr(pl.titleRo, pl.titleEn, pl.titleRu)}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = FALLBACK_MUSIC_COVER;
                          }}
                          className="w-14 sm:w-[60px] h-full object-cover shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] sm:text-sm font-semibold text-white truncate">
                            {tr(pl.titleRo, pl.titleEn, pl.titleRu)}
                          </div>
                          <div className="text-xs font-medium text-[#94a3b8] truncate">
                            {pl.badge}
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        title={tr('Deschide Playlist', 'Open Playlist', 'Открыть')}
                        onClick={() => handleSelectPlaylist(pl.id)}
                        style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                        className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#2563eb] text-white flex items-center justify-center shadow-lg transition-opacity cursor-pointer ${
                          isThisPlPlaying
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                        }`}
                      >
                        <Play className="w-4 h-4 fill-current text-white ml-0.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* 7B. ASCULTATE RECENT (Dynamic Shelf from Listening History) */}
              {recentTracks.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className={MUSIC_TYPOGRAPHY.h2}>
                      {tr('Ascultate recent', 'Recently Played', 'Недавно прослушано')}
                    </h2>
                    {currentTrack && (
                      <button
                        type="button"
                        onClick={() => handleOpenSongStudio(currentTrack, 'studio')}
                        className="h-8 px-3 rounded-full text-xs font-semibold text-[#60a5fa] hover:bg-[#1e3a8a]/35 inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>
                          {tr('Vezi Studio Piesă Curentă', 'Open Now Playing Studio', 'Открыть студию')}
                        </span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                    {recentTracks.slice(0, 6).map((rTrack) => {
                      const isCur = currentTrack?.id === rTrack.id;
                      return (
                        <div
                          key={`rec_${rTrack.id}`}
                          className="relative p-3 rounded-xl bg-[#0e121b]/95 hover:bg-[#161f30] border border-white/[0.09] transition-colors group flex flex-col"
                        >
                          <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-2.5 shadow-lg bg-[#111726]">
                            <button
                              type="button"
                              data-cover-fill="true"
                              onClick={() => onPlayTrack(rTrack, recentTracks)}
                              className="absolute inset-0 w-full h-full block cursor-pointer focus:outline-none"
                            >
                              <img
                                src={proxyMusicCover(rTrack.cover)}
                                alt={rTrack.title}
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = FALLBACK_MUSIC_COVER;
                                }}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </button>

                            <button
                              type="button"
                              title={tr('Radio Piesă', 'Song Radio', 'Радио трека')}
                              onClick={() => void handleStartSongRadio(rTrack)}
                              className="absolute left-2 bottom-2 w-8 h-8 rounded-full bg-black/75 hover:bg-[#2563eb] text-white hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                            >
                              <Radio className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              title={tr('Redă', 'Play', 'Слушать')}
                              onClick={() => onPlayTrack(rTrack, recentTracks)}
                              style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                              className={`absolute right-2 bottom-2 w-10 h-10 rounded-full bg-[#2563eb] text-white flex items-center justify-center shadow-lg transition-all cursor-pointer ${
                                isCur && isPlaying
                                  ? 'opacity-100 translate-y-0'
                                  : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0'
                              }`}
                            >
                              {isCur && isPlaying ? (
                                <Pause className="w-4 h-4 fill-current text-white" />
                              ) : (
                                <Play className="w-4 h-4 fill-current text-white ml-0.5" />
                              )}
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenSongStudio(rTrack, 'studio')}
                            className={`text-left text-[13px] sm:text-sm font-semibold truncate hover:underline cursor-pointer ${
                              isCur ? 'text-[#60a5fa]' : 'text-white'
                            }`}
                          >
                            {rTrack.title}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handleOpenArtist(rTrack.artist, rTrack.artistId)
                            }
                            className="text-left text-xs font-medium text-[#94a3b8] hover:text-white hover:underline truncate mt-0.5 cursor-pointer"
                          >
                            {rTrack.artist}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 7C. DYNAMIC RECOMMENDED ARTIST RADIO STATIONS */}
              <div className="space-y-3">
                <h2 className={MUSIC_TYPOGRAPHY.h2}>
                  {tr('Posturi recomandate', 'Recommended Stations', 'Рекомендуемые радиостанции')}
                </h2>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                  {dynamicStations.map((art) => (
                    <div
                      key={art.id}
                      className="relative group p-3 rounded-xl bg-[#0e121b]/95 hover:bg-[#161f30] border border-white/[0.09] transition-colors flex flex-col"
                    >
                      <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-2.5 shadow-lg bg-[#111726]">
                        <button
                          type="button"
                          data-cover-fill="true"
                          onClick={() => {
                            if (art.seedTrack) {
                              void handleStartSongRadio(art.seedTrack);
                            } else {
                              void handleOpenArtist(art.name, art.artistId);
                            }
                          }}
                          className="absolute inset-0 w-full h-full block cursor-pointer focus:outline-none"
                        >
                          <img
                            src={proxyMusicCover(art.avatar)}
                            alt={art.name}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = FALLBACK_MUSIC_COVER;
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </button>

                        <span className="pointer-events-none absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/75 text-[#60a5fa] text-[10px] font-bold">
                          RADIO
                        </span>

                        <button
                          type="button"
                          title={tr(`Profil ${art.name}`, `${art.name} Profile`, 'Профиль')}
                          onClick={() => void handleOpenArtist(art.name, art.artistId)}
                          className="absolute left-2 bottom-2 w-8 h-8 rounded-full bg-black/75 hover:bg-white text-white hover:text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        >
                          <User className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          title={tr(`Pornește Radio ${art.name}`, `Start ${art.name} Radio`, 'Включить радио')}
                          onClick={() => {
                            if (art.seedTrack) {
                              void handleStartSongRadio(art.seedTrack);
                            }
                          }}
                          style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                          className="absolute right-2 bottom-2 w-10 h-10 rounded-full bg-[#2563eb] text-white flex items-center justify-center shadow-lg opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all cursor-pointer"
                        >
                          <Play className="w-4 h-4 fill-current text-white ml-0.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (art.seedTrack) {
                            void handleStartSongRadio(art.seedTrack);
                          } else {
                            void handleOpenArtist(art.name, art.artistId);
                          }
                        }}
                        className="text-left text-[13px] sm:text-sm font-semibold text-white truncate hover:underline cursor-pointer"
                      >
                        {art.name}
                      </button>
                      <div className="text-xs font-medium text-[#94a3b8] truncate mt-0.5">
                        {art.role}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 7D. MIXURILE TALE DE TOP (Personalized Recommended Tracks Shelf) */}
              {suggestedTracks.length > 0 && (
                <div className="space-y-3">
                  <h2 className={MUSIC_TYPOGRAPHY.h2}>
                    {tr('Mixurile tale de top', 'Your Top Mixes', 'Ваши лучшие миксы')}
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                    {suggestedTracks.slice(0, 6).map((sTrack) => {
                      const isCurrentSug = currentTrack?.id === sTrack.id;
                      return (
                        <div
                          key={`mix_${sTrack.id}`}
                          className="relative p-3 rounded-xl bg-[#0e121b]/95 hover:bg-[#161f30] border border-white/[0.09] transition-colors group flex flex-col"
                        >
                          <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-2.5 shadow-lg bg-[#111726]">
                            <button
                              type="button"
                              data-cover-fill="true"
                              onClick={() => onPlayTrack(sTrack, suggestedTracks)}
                              className="absolute inset-0 w-full h-full block cursor-pointer focus:outline-none"
                            >
                              <img
                                src={proxyMusicCover(sTrack.cover)}
                                alt={sTrack.title}
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = FALLBACK_MUSIC_COVER;
                                }}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </button>

                            <button
                              type="button"
                              title={tr('Radio Piesă', 'Song Radio', 'Радио трека')}
                              onClick={() => void handleStartSongRadio(sTrack)}
                              className="absolute left-2 bottom-2 w-8 h-8 rounded-full bg-black/75 hover:bg-[#2563eb] text-white hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                            >
                              <Radio className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              title={tr('Redă', 'Play', 'Слушать')}
                              onClick={() => onPlayTrack(sTrack, suggestedTracks)}
                              style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                              className={`absolute right-2 bottom-2 w-10 h-10 rounded-full bg-[#2563eb] text-white flex items-center justify-center shadow-lg transition-all cursor-pointer ${
                                isCurrentSug && isPlaying
                                  ? 'opacity-100 translate-y-0'
                                  : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0'
                              }`}
                            >
                              {isCurrentSug && isPlaying ? (
                                <Pause className="w-4 h-4 fill-current text-white" />
                              ) : (
                                <Play className="w-4 h-4 fill-current text-white ml-0.5" />
                              )}
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenSongStudio(sTrack, 'studio')}
                            className={`text-left text-[13px] sm:text-sm font-semibold truncate hover:underline cursor-pointer ${
                              isCurrentSug ? 'text-[#60a5fa]' : 'text-white'
                            }`}
                          >
                            {sTrack.title}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handleOpenArtist(sTrack.artist, sTrack.artistId)
                            }
                            className="text-left text-xs font-medium text-[#94a3b8] hover:text-white hover:underline truncate mt-0.5 cursor-pointer"
                          >
                            {sTrack.artist}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ====================================================================
            3. SPOTIFY BOTTOM-DOCKED PREMIUM NOW PLAYING BAR
           ==================================================================== */}
        <div
          data-bottom-player-bar="true"
          className="sticky bottom-0 left-0 right-0 z-40 w-full m-0 tahoe-glass !border-x-0 !border-b-0 border-t border-white/[0.14] px-3 sm:px-5 py-2 shadow-[0_-12px_32px_rgba(0,0,0,0.9)]"
        >
          {/* 3A. MOBILE COMPACT SPOTIFY BAR (< 640px) */}
          <div className="sm:hidden space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setFullscreenInitialTab('studio');
                  setIsFullScreenPlayerOpen(true);
                }}
                className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer active:opacity-80 transition-opacity"
              >
                <img
                  src={proxyMusicCover(heroTrack.coverSmall || heroTrack.cover)}
                  alt={heroTrack.title}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = FALLBACK_MUSIC_COVER;
                  }}
                  className="w-11 h-11 rounded-lg object-cover shrink-0 shadow bg-[#111726]"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-white truncate flex items-center gap-1.5">
                    {isPlaying && currentTrack?.id === heroTrack.id && (
                      <EqualizerBars active />
                    )}
                    <span className="truncate">{heroTrack.title}</span>
                  </div>
                  <div className="text-xs font-medium text-[#94a3b8] truncate">
                    {heroTrack.artist}
                  </div>
                </div>
              </button>

              <div className="flex items-center gap-1 shrink-0">
                <TrackOfflineDownloadButton tr={tr} track={heroTrack} alwaysVisible />
                <button
                  type="button"
                  title={tr('Radio Piesă', 'Song Radio', 'Радио')}
                  onClick={() => void handleStartSongRadio(heroTrack)}
                  className="w-8 h-8 rounded-full text-[#94a3b8] hover:text-[#93c5fd] hover:bg-white/10 inline-flex items-center justify-center cursor-pointer"
                >
                  <Radio className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onToggleLikeTrack(heroTrack)}
                  className={`w-8 h-8 rounded-full hover:bg-white/10 inline-flex items-center justify-center cursor-pointer ${
                    isHeroLiked ? 'text-[#60a5fa]' : 'text-[#94a3b8]'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isHeroLiked ? 'fill-current' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={onPrevTrack}
                  className="w-8 h-8 rounded-full text-white hover:bg-white/10 inline-flex items-center justify-center cursor-pointer"
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
                  className="w-8 h-8 rounded-full text-white hover:bg-white/10 inline-flex items-center justify-center cursor-pointer"
                >
                  <SkipForward className="w-4 h-4 fill-current" />
                </button>
              </div>
            </div>

            {/* Mobile Scrubber */}
            <div className="flex items-center gap-2 w-full">
              <span className="text-xs font-medium text-[#94a3b8] tabular-nums w-9">
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
                    className="h-full rounded-full bg-[#3b82f6]"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
              <span className="text-xs font-medium text-[#94a3b8] tabular-nums w-9 text-right">
                {formatMusicDuration(effectiveDuration)}
              </span>
            </div>
          </div>

          {/* 3B. DESKTOP / SMART TV 3-COLUMN BALANCED GRID BAR (>= 640px) */}
          <div
            data-music-player-grid="true"
            className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(280px,540px)_minmax(0,1fr)] items-center gap-4 w-full"
          >
            {/* LEFT: Clickable Cover + Title + Artist/Album + Adjacent Heart */}
            <div className="flex items-center gap-3 min-w-0 justify-self-start max-w-full">
              <button
                type="button"
                title={tr('Deschide Player Studio Full-Screen', 'Open Studio Player', 'Открыть студию')}
                onClick={() => {
                  setFullscreenInitialTab('studio');
                  setIsFullScreenPlayerOpen(true);
                }}
                className="relative w-12 h-12 rounded-lg overflow-hidden shadow-md shrink-0 bg-[#111726] cursor-pointer group focus:outline-none"
              >
                <img
                  src={proxyMusicCover(heroTrack.cover)}
                  alt={heroTrack.title}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = FALLBACK_MUSIC_COVER;
                  }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </button>

              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => handleOpenSongStudio(heroTrack, 'studio')}
                  className="text-left text-[13px] sm:text-sm font-semibold text-white hover:text-[#93c5fd] hover:underline truncate block max-w-full cursor-pointer focus:outline-none"
                >
                  {heroTrack.title}
                </button>

                <div className="flex items-center gap-1.5 text-xs font-medium text-[#94a3b8] truncate mt-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      void handleOpenArtist(heroTrack.artist, heroTrack.artistId)
                    }
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
                            heroTrack.albumId,
                            heroTrack
                          )
                        }
                        className="inline-flex items-center gap-1 hover:text-white hover:underline truncate cursor-pointer min-w-0"
                      >
                        <span className="truncate">{heroTrack.album}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              <TrackOfflineDownloadButton tr={tr} track={heroTrack} alwaysVisible />

              <button
                type="button"
                title={tr(
                  'Salvează în Melodii îndrăgite',
                  'Save to Liked Songs',
                  'В Любимые треки'
                )}
                onClick={() => onToggleLikeTrack(heroTrack)}
                className={`w-8 h-8 rounded-full inline-flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer shrink-0 focus:outline-none ${
                  isHeroLiked
                    ? 'text-[#60a5fa]'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                <Heart className={`w-4 h-4 ${isHeroLiked ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* CENTER: Clean 5-Button Transport + Scrubber */}
            <div className="flex flex-col items-center gap-1 w-full">
              <div className="flex items-center justify-center gap-2.5">
                <button
                  type="button"
                  title={tr('Amestecare (Shuffle)', 'Shuffle', 'Перемешать')}
                  onClick={onToggleShuffle}
                  className={`w-8 h-8 rounded-full inline-flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all cursor-pointer focus:outline-none ${
                    isShuffle
                      ? 'text-[#60a5fa]'
                      : 'text-[#94a3b8] hover:text-white'
                  }`}
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  title={tr('Piesa anterioară', 'Previous', 'Предыдущий трек')}
                  onClick={onPrevTrack}
                  className="w-8 h-8 rounded-full text-[#94a3b8] hover:text-white hover:bg-white/10 active:scale-90 inline-flex items-center justify-center transition-all cursor-pointer focus:outline-none"
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
                  className="w-9 h-9 rounded-full bg-white hover:scale-105 active:scale-95 text-black inline-flex items-center justify-center shadow transition-transform cursor-pointer focus:outline-none"
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
                  className="w-8 h-8 rounded-full text-[#94a3b8] hover:text-white hover:bg-white/10 active:scale-90 inline-flex items-center justify-center transition-all cursor-pointer focus:outline-none"
                >
                  <SkipForward className="w-4 h-4 fill-current" />
                </button>

                <button
                  type="button"
                  title={tr('Repetare', 'Repeat', 'Повтор')}
                  onClick={onToggleRepeat}
                  className={`w-8 h-8 rounded-full inline-flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all cursor-pointer focus:outline-none ${
                    isRepeat
                      ? 'text-[#60a5fa]'
                      : 'text-[#94a3b8] hover:text-white'
                  }`}
                >
                  <Repeat className="w-4 h-4" />
                </button>
              </div>

              {/* Scrubber */}
              <div className="flex items-center gap-2.5 w-full">
                <span className="text-xs font-medium text-[#94a3b8] tabular-nums shrink-0 w-9 text-right">
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
                      className="h-full rounded-full bg-white group-hover:bg-[#60a5fa] group-focus:bg-[#60a5fa] transition-colors"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div
                    className="pointer-events-none absolute w-3 h-3 rounded-full bg-white shadow -ml-1.5 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity"
                    style={{ left: `${progressPct}%` }}
                  />
                </div>

                <span className="text-xs font-medium text-[#94a3b8] tabular-nums shrink-0 w-9">
                  {formatMusicDuration(effectiveDuration)}
                </span>
              </div>
            </div>

            {/* RIGHT: Song Radio / Live Lyrics / Queue / Video Clip / Volume / Fullscreen */}
            <div className="flex items-center justify-end gap-1 min-w-0 justify-self-end">
              <button
                type="button"
                title={tr('Pornește Radio pentru această piesă', 'Song Radio', 'Радио трека')}
                onClick={() => void handleStartSongRadio(heroTrack)}
                className={`w-8 h-8 rounded-full hover:bg-white/10 inline-flex items-center justify-center transition-colors cursor-pointer focus:outline-none ${
                  viewMode === 'radio'
                    ? 'text-[#60a5fa] bg-[#1e3a8a]/45'
                    : 'text-[#94a3b8] hover:text-[#93c5fd]'
                }`}
              >
                <Radio className="w-4 h-4" />
              </button>

              <button
                type="button"
                title={tr('Versuri Live Synced', 'Live Lyrics', 'Текст Live')}
                onClick={() => {
                  setFullscreenInitialTab('lyrics');
                  setIsFullScreenPlayerOpen(true);
                }}
                className="w-8 h-8 rounded-full hover:bg-white/10 inline-flex items-center justify-center text-[#94a3b8] hover:text-white transition-colors cursor-pointer focus:outline-none"
              >
                <Mic2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                title={tr('Coada de redare', 'Play Queue', 'Очередь')}
                onClick={() => {
                  setFullscreenInitialTab('queue');
                  setIsFullScreenPlayerOpen(true);
                }}
                className="hidden md:inline-flex w-8 h-8 rounded-full hover:bg-white/10 items-center justify-center text-[#94a3b8] hover:text-white transition-colors cursor-pointer focus:outline-none"
              >
                <ListMusic className="w-4 h-4" />
              </button>

              <button
                type="button"
                title={
                  isVideoClipMode
                    ? tr('Ascunde Videoclipul', 'Hide Video Clip', 'Скрыть клип')
                    : tr('Videoclip Oficial HD', 'Official Video Clip', 'Видеоклип')
                }
                onClick={(e) => {
                  const nextMode = !isVideoClipMode;
                  setIsVideoClipMode(nextMode);
                  if (nextMode) {
                    const mainEl = e.currentTarget.closest('main');
                    mainEl?.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className={`w-8 h-8 rounded-full hover:bg-white/10 inline-flex items-center justify-center transition-colors cursor-pointer focus:outline-none ${
                  isVideoClipMode
                    ? 'text-[#60a5fa]'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                <Tv className="w-4 h-4" />
              </button>

              <div className="hidden xl:flex items-center gap-1.5 pl-1">
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="w-8 h-8 rounded-full hover:bg-white/10 inline-flex items-center justify-center text-[#94a3b8] hover:text-white focus:outline-none cursor-pointer shrink-0"
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
                  className="relative w-20 h-4 flex items-center cursor-pointer group focus:outline-none"
                >
                  <div className="w-full h-1 rounded-full bg-white/25 overflow-hidden">
                    <div
                      className="h-full bg-white group-hover:bg-[#60a5fa] group-focus:bg-[#60a5fa] rounded-full transition-colors"
                      style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                    />
                  </div>
                  <div
                    className="pointer-events-none absolute w-3 h-3 rounded-full bg-white shadow -ml-1.5 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity"
                    style={{ left: `${(isMuted ? 0 : volume) * 100}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                title={tr('Ecran complet Studio', 'Fullscreen Studio', 'Во весь экран')}
                onClick={() => {
                  setFullscreenInitialTab('studio');
                  setIsFullScreenPlayerOpen(true);
                }}
                className="w-8 h-8 rounded-full hover:bg-white/10 inline-flex items-center justify-center text-[#94a3b8] hover:text-white transition-colors cursor-pointer focus:outline-none"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ====================================================================
            4. PREMIUM STUDIO FULL-SCREEN PLAYER OVERLAY (Mobile & Desktop)
           ==================================================================== */}
        {isFullScreenPlayerOpen && heroTrack && (
          <PremiumFullscreenPlayerModal
            tr={tr}
            track={heroTrack}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            elapsedSec={elapsedSec}
            durationSec={effectiveDuration}
            progressPct={progressPct}
            isShuffle={isShuffle}
            isRepeat={isRepeat}
            isLiked={isHeroLiked}
            isVideoClipMode={isVideoClipMode}
            queue={effectiveQueue}
            initialTab={fullscreenInitialTab}
            sourceLabel={currentSourceLabel}
            onClose={() => setIsFullScreenPlayerOpen(false)}
            onPlayTrack={onPlayTrack}
            onTogglePlayPause={onTogglePlayPause}
            onNextTrack={onNextTrack}
            onPrevTrack={onPrevTrack}
            onSeek={onSeek}
            onToggleShuffle={onToggleShuffle}
            onToggleRepeat={onToggleRepeat}
            onToggleLikeTrack={onToggleLikeTrack}
            onToggleVideoClip={() => setIsVideoClipMode((v) => !v)}
            onOpenArtist={(name, artId) => void handleOpenArtist(name, artId)}
            onOpenAlbum={(alb, art, albId, trk) =>
              void handleOpenAlbumCard(alb, art, albId, trk)
            }
            onStartRadio={(trk) => void handleStartSongRadio(trk)}
            onRemoveFromQueue={handleRemoveFromQueue}
          />
        )}

        {/* ====================================================================
            5. ACCESSIBLE LIGHT-DISMISS TRACK ACTION DIALOG (•••)
           ==================================================================== */}
        <TrackQuickActionsDialog
          tr={tr}
          track={menuTrack}
          isLiked={
            menuTrack ? likedTracks.some((t) => t.id === menuTrack.id) : false
          }
          onClose={() => setMenuTrack(null)}
          onPlayNow={(t) => onPlayTrack(t, effectiveQueue)}
          onPlayNext={handlePlayNextInQueue}
          onStartRadio={(t) => void handleStartSongRadio(t)}
          onOpenSongStudio={(t) => handleOpenSongStudio(t, 'lyrics')}
          onOpenArtist={(name, artId) => void handleOpenArtist(name, artId)}
          onOpenAlbum={(alb, art, albId, trk) =>
            void handleOpenAlbumCard(alb, art, albId, trk)
          }
          onToggleLike={onToggleLikeTrack}
        />
      </div>
    );
  };
