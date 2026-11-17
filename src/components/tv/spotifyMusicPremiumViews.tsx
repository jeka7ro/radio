import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  Award,
  BadgeCheck,
  BookOpen,
  Calendar,
  ChevronDown,
  Clock,
  Disc,
  Globe,
  Heart,
  ListMusic,
  Loader2,
  Mic2,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Repeat,
  RotateCcw,
  RotateCw,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  Tv,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  useOfflineMusicState,
  toggleTrackOffline,
  downloadTrackCollectionOffline,
  cancelCollectionDownload,
} from '../../services/offlineMusicService';
import {
  loadMusicEncyclopedia,
  type MusicEncyclopediaData,
} from '../../services/musicEncyclopediaService';

export const FALLBACK_MUSIC_COVER =
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80';

export type MusicViewMode =
  | 'home'
  | 'playlist'
  | 'search'
  | 'artist'
  | 'album'
  | 'song'
  | 'radio';

export interface SpotifyTrackItem {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  artistAvatar?: string;
  album: string;
  albumId?: string;
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
  likedAt?: number;
  playedAt?: number;
}

export interface SpotifyArtistSummary {
  id: string;
  dzId?: string;
  name: string;
  avatar: string;
  fans?: number;
  albumCount?: number;
}

export interface SpotifyAlbumSummary {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  cover: string;
  year?: number;
  recordType?: string;
  trackCount?: number;
}

export interface MusicAlbumDetailCard {
  id?: string;
  albumTitle: string;
  artistName: string;
  artistId?: string;
  artistAvatar?: string;
  coverUrl: string;
  year: number;
  releaseDateText?: string;
  genre: string;
  label?: string;
  recordType?: string;
  copyright?: string;
  country?: string;
  trackCount: number;
  totalDurationSec: number;
  tracks: SpotifyTrackItem[];
  moreAlbums?: SpotifyAlbumSummary[];
}

export interface SpotifyArtistProfileData {
  artist: SpotifyArtistSummary;
  topTracks: SpotifyTrackItem[];
  albums: SpotifyAlbumSummary[];
  relatedArtists: SpotifyArtistSummary[];
}

export interface SpotifySongRadioData {
  id: string;
  title: string;
  subtitle: string;
  seedTrack: SpotifyTrackItem;
  seedCover: string;
  relatedNames: string[];
  tracks: SpotifyTrackItem[];
}

export interface ParsedLyricLine {
  timeSec: number;
  text: string;
}

export type TrFn = (ro: string, en: string, ru?: string) => string;

export function resolveUiLangFromTr(tr: TrFn): 'ro' | 'en' | 'ru' {
  const code = tr('ro', 'en', 'ru');
  return code === 'en' || code === 'ru' ? code : 'ro';
}

export function formatMusicDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
}

export function normalizeMusicStr(raw?: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    .replace(/[^a-z0-9а-яёăâîșț]/gi, '');
}

/**
 * Direct HTTPS CDN cover loader with dead Apple CDN URL auto-healing and local fallback.
 */
export function proxyMusicCover(url?: string): string {
  if (!url) return FALLBACK_MUSIC_COVER;
  if (url.startsWith('/') || url.startsWith('data:')) return url;
  if (url.includes('6f6d73f3-f166-28a1-6e2b-905337f91065')) {
    return 'https://cdn-images.dzcdn.net/images/cover/fd00ebd6d30d7253f813dba3bb1c66a9/500x500-000000-80-0-0.jpg';
  }
  if (url.includes('e261f8c1-73db-9a7a-c89e-1068f19d70e0')) {
    return 'https://cdn-images.dzcdn.net/images/cover/134778e4c4f19ea71c82408300925a9a/500x500-000000-80-0-0.jpg';
  }
  return url;
}

export function formatFansCount(fans?: number): string {
  if (!fans || fans <= 0) return '';
  if (fans >= 1_000_000) return `${(fans / 1_000_000).toFixed(1)}M`;
  if (fans >= 1_000) return `${Math.round(fans / 1_000)}K`;
  return String(fans);
}

export function parseLrcLyrics(raw?: string | null): ParsedLyricLine[] {
  if (!raw) return [];
  const out: ParsedLyricLine[] = [];
  const lines = raw.split(/\r?\n/);
  const tagRe = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g;
  for (const line of lines) {
    const matches = [...line.matchAll(tagRe)];
    if (matches.length === 0) continue;
    const text = line.replace(tagRe, '').trim();
    for (const m of matches) {
      const mins = parseInt(m[1], 10) || 0;
      const secs = parseInt(m[2], 10) || 0;
      const msRaw = m[3] || '0';
      const ms =
        msRaw.length === 1
          ? Number(msRaw) * 0.1
          : msRaw.length === 2
          ? Number(msRaw) * 0.01
          : Number(msRaw) * 0.001;
      out.push({
        timeSec: mins * 60 + secs + (Number.isFinite(ms) ? ms : 0),
        text: text || '♪',
      });
    }
  }
  return out.sort((a, b) => a.timeSec - b.timeSec);
}

function mapClientItunesTrack(item: any, idx: number): SpotifyTrackItem {
  const rawArt = String(item.artworkUrl100 || '');
  const cover = rawArt
    ? rawArt.replace(/\d+x\d+bb/, '1000x1000bb')
    : FALLBACK_MUSIC_COVER;
  const coverSmall = rawArt ? rawArt.replace(/\d+x\d+bb/, '300x300bb') : cover;
  const artist = String(item.artistName || 'Artist');
  const title = String(item.trackName || 'Track');
  const isHiRes = idx % 3 !== 2;
  return {
    id: `sp_${item.trackId || idx}`,
    title,
    artist,
    artistId: item.artistId ? `it_art_${item.artistId}` : undefined,
    album: String(item.collectionName || title),
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
      `${artist} - ${title} Official Audio`
    )}`,
    videoQuery: `${artist} - ${title}`,
    qualityTier: isHiRes ? 'MAX' : 'HIFI',
    qualityLabel: isHiRes
      ? 'MAX • 24-bit / 192 kHz FLAC'
      : 'HiFi • 16-bit / 44.1 kHz FLAC',
    bitrateKbps: isHiRes ? 9216 : 1411,
  };
}

export async function loadArtistProfileData(
  artistName: string,
  artistId?: string
): Promise<SpotifyArtistProfileData> {
  const cleanName = artistName.trim();
  try {
    const res = await fetch(
      `/api/youtube/artist-profile?name=${encodeURIComponent(cleanName)}${
        artistId ? `&id=${encodeURIComponent(artistId)}` : ''
      }`
    );
    const cType = res.headers.get('content-type') || '';
    if (res.ok && cType.includes('application/json')) {
      const data = await res.json();
      if (data?.ok && data?.artist) {
        return {
          artist: data.artist,
          topTracks: Array.isArray(data.topTracks) ? data.topTracks : [],
          albums: Array.isArray(data.albums) ? data.albums : [],
          relatedArtists: Array.isArray(data.relatedArtists)
            ? data.relatedArtists
            : [],
        };
      }
    }
  } catch {
    // fallback below
  }

  // Client-side CORS fallback via iTunes
  try {
    const [songRes, albRes] = await Promise.all([
      fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(
          cleanName
        )}&country=RO&media=music&entity=song&limit=20`
      ),
      fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(
          cleanName
        )}&country=RO&media=music&entity=album&limit=15`
      ),
    ]);
    const topTracks: SpotifyTrackItem[] = [];
    if (songRes.ok) {
      const sd = await songRes.json();
      for (const [idx, r] of (sd?.results || []).entries()) {
        if (r?.trackName && r?.artistName) {
          topTracks.push(mapClientItunesTrack(r, idx));
        }
      }
    }
    const albums: SpotifyAlbumSummary[] = [];
    if (albRes.ok) {
      const ad = await albRes.json();
      const seen = new Set<string>();
      for (const al of ad?.results || []) {
        if (!al?.collectionName || seen.has(normalizeMusicStr(al.collectionName)))
          continue;
        seen.add(normalizeMusicStr(al.collectionName));
        const rawArt = String(al.artworkUrl100 || '');
        albums.push({
          id: `it_alb_${al.collectionId}`,
          title: String(al.collectionName),
          artist: String(al.artistName || cleanName),
          cover: rawArt
            ? rawArt.replace(/\d+x\d+bb/, '1000x1000bb')
            : FALLBACK_MUSIC_COVER,
          year: al.releaseDate
            ? Number(String(al.releaseDate).slice(0, 4)) || undefined
            : undefined,
          recordType: al.trackCount && al.trackCount <= 4 ? 'single' : 'album',
          trackCount: Number(al.trackCount) || undefined,
        });
      }
    }
    return {
      artist: {
        id: artistId || `it_art_${normalizeMusicStr(cleanName)}`,
        name: cleanName,
        avatar: topTracks[0]?.cover || albums[0]?.cover || FALLBACK_MUSIC_COVER,
        fans: 0,
        albumCount: albums.length,
      },
      topTracks,
      albums,
      relatedArtists: [],
    };
  } catch {
    return {
      artist: {
        id: artistId || `art_${normalizeMusicStr(cleanName)}`,
        name: cleanName,
        avatar: FALLBACK_MUSIC_COVER,
      },
      topTracks: [],
      albums: [],
      relatedArtists: [],
    };
  }
}

export async function loadAlbumDetailData(
  albumTitle: string,
  artistName: string,
  albumId?: string,
  fallbackTrack?: SpotifyTrackItem
): Promise<MusicAlbumDetailCard> {
  const cleanAlbum = (albumTitle || fallbackTrack?.album || '').trim();
  const cleanArtist = (artistName || fallbackTrack?.artist || '').trim();
  try {
    const res = await fetch(
      `/api/youtube/album-details?album=${encodeURIComponent(
        cleanAlbum
      )}&artist=${encodeURIComponent(cleanArtist)}${
        albumId ? `&id=${encodeURIComponent(albumId)}` : ''
      }`
    );
    const cType = res.headers.get('content-type') || '';
    if (res.ok && cType.includes('application/json')) {
      const data = await res.json();
      if (data?.ok && data?.album && Array.isArray(data.album.tracks) && data.album.tracks.length > 0) {
        const a = data.album;
        return {
          id: a.id,
          albumTitle: a.title || cleanAlbum,
          artistName: a.artist || cleanArtist,
          artistId: a.artistId,
          artistAvatar: a.artistAvatar,
          coverUrl: a.cover || fallbackTrack?.cover || FALLBACK_MUSIC_COVER,
          year: a.year || fallbackTrack?.year || 2025,
          releaseDateText: a.releaseDateText || '',
          genre: a.genre || fallbackTrack?.genre || 'Music',
          label: a.label || '',
          recordType: a.recordType || 'album',
          trackCount: a.trackCount || a.tracks.length,
          totalDurationSec: a.totalDurationSec || 0,
          tracks: a.tracks,
          moreAlbums: Array.isArray(a.moreAlbums) ? a.moreAlbums : [],
        };
      }
    }
  } catch {
    // fallback below
  }

  // Client iTunes fallback
  try {
    const searchTerm = `${cleanArtist} ${cleanAlbum}`.trim();
    const albumRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(
        searchTerm
      )}&media=music&entity=album&limit=8`
    );
    let colMeta: any = null;
    let rawSongs: any[] = [];
    if (albumRes.ok) {
      const ad = await albumRes.json();
      const albs = Array.isArray(ad?.results) ? ad.results : [];
      colMeta =
        albs.find((a: any) =>
          normalizeMusicStr(a.collectionName).includes(normalizeMusicStr(cleanAlbum))
        ) || albs[0];
      if (colMeta?.collectionId) {
        const lr = await fetch(
          `https://itunes.apple.com/lookup?id=${encodeURIComponent(
            String(colMeta.collectionId)
          )}&entity=song&limit=100`
        );
        if (lr.ok) {
          const ld = await lr.json();
          const resList = Array.isArray(ld?.results) ? ld.results : [];
          colMeta = resList.find((r: any) => r.wrapperType === 'collection') || colMeta;
          rawSongs = resList.filter((r: any) => r.wrapperType === 'track' && r.trackName);
        }
      }
    }
    const tracks = rawSongs.map((s, idx) => mapClientItunesTrack(s, idx));
    const finalTracks = tracks.length > 0 ? tracks : fallbackTrack ? [fallbackTrack] : [];
    const rawArt = String(colMeta?.artworkUrl100 || rawSongs[0]?.artworkUrl100 || '');
    const relDate = String(colMeta?.releaseDate || '');
    return {
      id: albumId || (colMeta?.collectionId ? `it_alb_${colMeta.collectionId}` : undefined),
      albumTitle: String(colMeta?.collectionName || cleanAlbum || cleanArtist),
      artistName: String(colMeta?.artistName || cleanArtist),
      artistId: colMeta?.artistId ? `it_art_${colMeta.artistId}` : fallbackTrack?.artistId,
      coverUrl: rawArt
        ? rawArt.replace(/\d+x\d+bb/, '1000x1000bb')
        : fallbackTrack?.cover || FALLBACK_MUSIC_COVER,
      year: relDate ? Number(relDate.slice(0, 4)) || 2025 : fallbackTrack?.year || 2025,
      releaseDateText: relDate ? relDate.slice(0, 10).split('-').reverse().join('.') : '',
      genre: String(colMeta?.primaryGenreName || fallbackTrack?.genre || 'Music'),
      copyright: String(colMeta?.copyright || ''),
      trackCount: finalTracks.length,
      totalDurationSec: finalTracks.reduce((s, t) => s + (t.durationSec || 0), 0),
      tracks: finalTracks,
      moreAlbums: [],
    };
  } catch {
    const finalTracks = fallbackTrack ? [fallbackTrack] : [];
    return {
      id: albumId,
      albumTitle: cleanAlbum || cleanArtist,
      artistName: cleanArtist,
      coverUrl: fallbackTrack?.cover || FALLBACK_MUSIC_COVER,
      year: fallbackTrack?.year || 2025,
      genre: fallbackTrack?.genre || 'Music',
      trackCount: finalTracks.length,
      totalDurationSec: fallbackTrack?.durationSec || 200,
      tracks: finalTracks,
      moreAlbums: [],
    };
  }
}

export async function loadSongRadioPlaylist(
  seedTrack: SpotifyTrackItem
): Promise<SpotifySongRadioData> {
  let tracks: SpotifyTrackItem[] = [];
  let relatedNames: string[] = [];

  try {
    const res = await fetch(
      `/api/youtube/song-radio?track=${encodeURIComponent(
        seedTrack.title
      )}&artist=${encodeURIComponent(seedTrack.artist)}${
        seedTrack.artistId ? `&artistId=${encodeURIComponent(seedTrack.artistId)}` : ''
      }&limit=40`
    );
    const cType = res.headers.get('content-type') || '';
    if (res.ok && cType.includes('application/json')) {
      const data = await res.json();
      if (data?.ok && Array.isArray(data.tracks) && data.tracks.length > 0) {
        tracks = data.tracks;
        relatedNames = Array.isArray(data.relatedNames) ? data.relatedNames : [];
      }
    }
  } catch {
    // fallback below
  }

  if (tracks.length === 0) {
    try {
      const q = `${seedTrack.artist}`.split(/[&,]/)[0].trim();
      const itRes = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(
          q
        )}&country=RO&media=music&entity=song&limit=35`
      );
      if (itRes.ok) {
        const itData = await itRes.json();
        tracks = (itData?.results || [])
          .filter((x: any) => x?.trackName && x?.artistName)
          .map((x: any, idx: number) => mapClientItunesTrack(x, idx));
      }
    } catch {
      // ignore
    }
  }

  // Always guarantee seedTrack is at index #1 without immediate duplicate
  const seedKey = `${normalizeMusicStr(seedTrack.artist)}__${normalizeMusicStr(seedTrack.title)}`;
  const filteredRest = tracks.filter(
    (t) =>
      t.id !== seedTrack.id &&
      `${normalizeMusicStr(t.artist)}__${normalizeMusicStr(t.title)}` !== seedKey
  );
  const assembled = [seedTrack, ...filteredRest];

  if (relatedNames.length === 0) {
    const artNorm = normalizeMusicStr(seedTrack.artist);
    for (const t of filteredRest) {
      if (
        relatedNames.length < 4 &&
        normalizeMusicStr(t.artist) !== artNorm &&
        !relatedNames.includes(t.artist)
      ) {
        relatedNames.push(t.artist);
      }
    }
  }

  return {
    id: `radio_${seedTrack.id}`,
    title: `Radio ${seedTrack.title}`,
    subtitle:
      relatedNames.length > 0
        ? `${seedTrack.artist}, ${relatedNames.join(', ')}`
        : `${seedTrack.artist} & Mix Similar`,
    seedTrack,
    seedCover: seedTrack.cover || seedTrack.coverSmall || FALLBACK_MUSIC_COVER,
    relatedNames,
    tracks: assembled,
  };
}

export async function loadSyncedLyrics(track: SpotifyTrackItem): Promise<{
  syncedLyrics: string | null;
  plainLyrics: string | null;
  instrumental: boolean;
}> {
  try {
    const res = await fetch(
      `/api/youtube/lyrics?track=${encodeURIComponent(
        track.title
      )}&artist=${encodeURIComponent(track.artist)}`
    );
    const cType = res.headers.get('content-type') || '';
    if (res.ok && cType.includes('application/json')) {
      const data = await res.json();
      if (data?.syncedLyrics || data?.plainLyrics || data?.instrumental) {
        return {
          syncedLyrics: data.syncedLyrics || null,
          plainLyrics: data.plainLyrics || null,
          instrumental: Boolean(data.instrumental),
        };
      }
    }
  } catch {
    // fallback directly to LRCLIB (CORS *)
  }

  try {
    const cleanTitle = track.title
      .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
      .trim();
    const cleanArtist = track.artist.split(/[&,]/)[0].trim();
    const res = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(
        `${cleanArtist} ${cleanTitle}`
      )}`
    );
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        const best = list.find((x: any) => Boolean(x?.syncedLyrics)) || list[0];
        return {
          syncedLyrics: best?.syncedLyrics || null,
          plainLyrics: best?.plainLyrics || null,
          instrumental: Boolean(best?.instrumental),
        };
      }
    }
  } catch {
    // ignore
  }
  return { syncedLyrics: null, plainLyrics: null, instrumental: false };
}

export const EqualizerBars: React.FC<{ active?: boolean }> = ({ active = true }) => (
  <span
    aria-hidden="true"
    className="inline-flex items-end justify-center gap-[2px] h-3.5 w-3.5"
  >
    <span
      className={`w-[3px] rounded-full bg-[#60a5fa] ${
        active ? 'eq-bar h-3.5' : 'h-1.5 opacity-60'
      }`}
    />
    <span
      className={`w-[3px] rounded-full bg-[#60a5fa] ${
        active ? 'eq-bar eq-bar-2 h-3' : 'h-2 opacity-60'
      }`}
    />
    <span
      className={`w-[3px] rounded-full bg-[#60a5fa] ${
        active ? 'eq-bar eq-bar-3 h-2.5' : 'h-1 opacity-60'
      }`}
    />
  </span>
);

const TRACK_ROW_GRID_WITH_ALBUM =
  'grid-cols-[32px_minmax(0,1fr)_auto] sm:grid-cols-[32px_minmax(0,1fr)_188px] md:grid-cols-[32px_minmax(0,1.5fr)_minmax(0,1fr)_188px]';
const TRACK_ROW_GRID_COMPACT =
  'grid-cols-[32px_minmax(0,1fr)_auto] sm:grid-cols-[32px_minmax(0,1fr)_188px]';

export const MUSIC_TYPOGRAPHY = {
  h1: 'text-xl sm:text-2xl lg:text-[26px] font-extrabold text-white tracking-tight leading-tight',
  h2: 'text-base sm:text-lg font-bold text-white tracking-tight',
  body: 'text-[13px] sm:text-sm font-semibold',
  meta: 'text-xs font-medium text-[#94a3b8]',
} as const;

export const OfflineDownloadedBadgeIcon: React.FC<{ className?: string }> = ({
  className = 'w-3.5 h-3.5',
}) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    className={className}
  >
    <circle cx="8" cy="8" r="7.5" fill="#2563eb" />
    <path
      d="M8 3.8v5.5M5.6 7.3L8 9.8l2.4-2.5M4.8 11.8h6.4"
      stroke="#ffffff"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const TrackOfflineDownloadButton: React.FC<{
  tr: TrFn;
  track: SpotifyTrackItem;
  alwaysVisible?: boolean;
}> = ({ tr, track, alwaysVisible = false }) => {
  const offline = useOfflineMusicState();
  const isSaved = offline.isOffline(track);
  const progress = offline.getProgress(track);
  const isDownloading = progress !== null;

  return (
    <button
      type="button"
      title={
        isSaved
          ? tr('Descărcată offline (apasă pentru eliminare)', 'Downloaded offline (click to remove)', 'Скачано офлайн')
          : isDownloading
          ? tr(`Se descarcă (${progress}%) — apasă pentru anulare`, `Downloading (${progress}%) — click to cancel`, `Загрузка (${progress}%)`)
          : tr('Descarcă piesa offline', 'Download track offline', 'Скачать трек офлайн')
      }
      aria-label={
        isSaved
          ? tr('Descărcată offline', 'Downloaded offline', 'Скачано офлайн')
          : tr('Descarcă piesa offline', 'Download track offline', 'Скачать трек офлайн')
      }
      onClick={(e) => {
        e.stopPropagation();
        void toggleTrackOffline(track);
      }}
      className={`w-8 h-8 rounded-full inline-flex items-center justify-center transition-all cursor-pointer focus:outline-none hover:bg-white/10 ${
        isSaved || isDownloading || alwaysVisible
          ? 'opacity-100'
          : 'text-[#94a3b8] sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 hover:text-white'
      }`}
    >
      {isSaved ? (
        <OfflineDownloadedBadgeIcon className="w-4 h-4" />
      ) : isDownloading ? (
        <Loader2 className="w-4 h-4 animate-spin text-[#60a5fa]" />
      ) : (
        <ArrowDownToLine className="w-4 h-4 text-[#94a3b8] hover:text-white" />
      )}
    </button>
  );
};

export const CollectionOfflineDownloadButton: React.FC<{
  tr: TrFn;
  tracks: SpotifyTrackItem[];
  className?: string;
}> = ({ tr, tracks, className = '' }) => {
  const offline = useOfflineMusicState();
  const validTracks = tracks.filter((t) => Boolean(t && t.id && t.title));
  const total = validTracks.length;
  let downloadedCount = 0;
  let downloadingCount = 0;

  for (const t of validTracks) {
    if (offline.isOffline(t)) downloadedCount += 1;
    else if (offline.getProgress(t) !== null) downloadingCount += 1;
  }

  const allDownloaded = total > 0 && downloadedCount === total;
  const anyDownloading = downloadingCount > 0;

  return (
    <button
      type="button"
      disabled={total === 0}
      onClick={() => {
        if (anyDownloading) {
          cancelCollectionDownload(validTracks);
        } else if (!allDownloaded) {
          downloadTrackCollectionOffline(validTracks);
        }
      }}
      title={
        allDownloaded
          ? tr(`Toate cele ${total} piese sunt descărcate offline`, `All ${total} tracks downloaded offline`, `Все ${total} треков скачаны`)
          : anyDownloading
          ? tr('Apasă pentru a opri descărcarea', 'Click to stop downloading', 'Остановить загрузку')
          : tr(`Descarcă toate cele ${total} piese offline`, `Download all ${total} tracks offline`, `Скачать все ${total} треков`)
      }
      className={`h-10 px-4 rounded-full text-[13px] font-semibold inline-flex items-center gap-2 border transition-colors cursor-pointer disabled:opacity-50 ${
        allDownloaded || anyDownloading
          ? 'bg-[#1e3a8a]/45 border-[#60a5fa]/50 text-[#60a5fa]'
          : 'bg-white/[0.08] border-white/10 text-white hover:bg-white/[0.15]'
      } ${className}`}
    >
      {allDownloaded ? (
        <>
          <OfflineDownloadedBadgeIcon className="w-4 h-4 shrink-0" />
          <span>
            {tr(`Descărcat (${total})`, `Downloaded (${total})`, `Скачано (${total})`)}
          </span>
        </>
      ) : anyDownloading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span className="tabular-nums">
            {tr(`Se descarcă (${downloadedCount}/${total}) • Oprește`, `Downloading (${downloadedCount}/${total}) • Stop`, `Загрузка (${downloadedCount}/${total})`)}
          </span>
        </>
      ) : (
        <>
          <ArrowDownToLine className="w-4 h-4 shrink-0" />
          <span>
            {downloadedCount > 0
              ? tr(`Descarcă (${downloadedCount}/${total})`, `Download (${downloadedCount}/${total})`, `Скачать (${downloadedCount}/${total})`)
              : tr('Descarcă Offline', 'Download Offline', 'Скачать офлайн')}
          </span>
        </>
      )}
    </button>
  );
};

export const ViewBackBar: React.FC<{
  tr: TrFn;
  label: string;
  onBack: () => void;
  rightSlot?: React.ReactNode;
}> = ({ tr, label, onBack, rightSlot }) => (
  <div className="flex items-center justify-between gap-3">
    <button
      type="button"
      onClick={onBack}
      className="min-h-[44px] sm:min-h-[36px] h-11 sm:h-9 pl-3 pr-4 sm:pl-2.5 sm:pr-3.5 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer touch-manipulation focus:outline-none"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      <span>{tr('Înapoi', 'Back', 'Назад')}</span>
      <span className="text-white/40 hidden sm:inline">•</span>
      <span className="text-[#94a3b8] font-medium truncate max-w-[180px] sm:max-w-xs hidden sm:inline">
        {label}
      </span>
    </button>
    {rightSlot}
  </div>
);

export const TrackTableHeader: React.FC<{
  tr: TrFn;
  showAlbum?: boolean;
}> = ({ tr, showAlbum = true }) => (
  <div
    className={`px-3 py-2 border-b border-white/[0.08] grid items-center gap-3 text-xs font-medium text-[#94a3b8] ${
      showAlbum ? TRACK_ROW_GRID_WITH_ALBUM : TRACK_ROW_GRID_COMPACT
    }`}
  >
    <span className="text-center">#</span>
    <span className="truncate">{tr('Titlu', 'Title', 'Название')}</span>
    {showAlbum && (
      <span className="hidden md:block truncate">
        {tr('Album', 'Album', 'Альбом')}
      </span>
    )}
    <span className="flex justify-end pr-2 sm:pr-9">
      <Clock className="w-3.5 h-3.5" />
    </span>
  </div>
);

interface PremiumTrackRowProps {
  tr: TrFn;
  track: SpotifyTrackItem;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  isLiked: boolean;
  showCover?: boolean;
  showAlbum?: boolean;
  onPlay: () => void;
  onToggleLike: () => void;
  onOpenArtist: (name: string, artistId?: string) => void;
  onOpenAlbum: (album: string, artist: string, albumId?: string, track?: SpotifyTrackItem) => void;
  onStartRadio: (track: SpotifyTrackItem) => void;
  onOpenSongStudio: (track: SpotifyTrackItem) => void;
  onOpenTrackMenu: (track: SpotifyTrackItem) => void;
}

export const PremiumTrackRow: React.FC<PremiumTrackRowProps> = ({
  tr,
  track,
  index,
  isCurrent,
  isPlaying,
  isLiked,
  showCover = true,
  showAlbum = true,
  onPlay,
  onToggleLike,
  onOpenArtist,
  onOpenAlbum,
  onStartRadio,
  onOpenSongStudio: _onOpenSongStudio,
  onOpenTrackMenu,
}) => {
  const cleanAlbumTitle =
    track.album && track.album !== track.title ? track.album : 'Single';
  const offlineState = useOfflineMusicState();
  const isOffline = offlineState.isOffline(track);

  return (
    <div
      className={`group px-3 py-1.5 min-h-[52px] rounded-lg grid items-center gap-3 transition-colors ${
        showAlbum ? TRACK_ROW_GRID_WITH_ALBUM : TRACK_ROW_GRID_COMPACT
      } ${isCurrent ? 'bg-[#1e3a8a]/25 ring-1 ring-[#3b82f6]/30' : 'hover:bg-[#161f30]/80'}`}
    >
      {/* Index / Equalizer / Play */}
      <button
        type="button"
        onClick={onPlay}
        title={tr('Redă piesa', 'Play track', 'Слушать')}
        className="w-8 h-8 inline-flex items-center justify-center text-xs font-medium tabular-nums cursor-pointer focus:outline-none rounded-full"
      >
        {isCurrent && isPlaying ? (
          <EqualizerBars active />
        ) : isCurrent ? (
          <Play className="w-4 h-4 text-[#60a5fa] fill-current" />
        ) : (
          <>
            <span className="text-[#94a3b8] group-hover:hidden">{index + 1}</span>
            <Play className="w-4 h-4 text-white fill-current hidden group-hover:block" />
          </>
        )}
      </button>

      {/* Cover + Song Title + Offline Badge + Clickable Artist */}
      <div className="flex items-center gap-3 min-w-0">
        {showCover && (
          <button
            type="button"
            onClick={onPlay}
            className="relative w-10 h-10 rounded-md overflow-hidden shrink-0 bg-[#111726] shadow cursor-pointer focus:outline-none"
          >
            <img
              src={proxyMusicCover(track.coverSmall || track.cover)}
              alt={track.title}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = FALLBACK_MUSIC_COVER;
              }}
              className="w-full h-full object-cover"
            />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onPlay}
            className={`text-left text-[13px] sm:text-sm font-semibold truncate hover:underline block max-w-full cursor-pointer focus:outline-none ${
              isCurrent ? 'text-[#60a5fa]' : 'text-white'
            }`}
          >
            {track.title}
          </button>
          <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
            {isOffline && <OfflineDownloadedBadgeIcon className="w-3.5 h-3.5 shrink-0" />}
            <button
              type="button"
              onClick={() => onOpenArtist(track.artist, track.artistId)}
              className="text-xs font-medium text-[#94a3b8] hover:text-white hover:underline truncate block max-w-full cursor-pointer focus:outline-none text-left"
            >
              {track.artist}
            </button>
          </div>
        </div>
      </div>

      {/* Clickable Album Column (Desktop) */}
      {showAlbum && (
        <div className="hidden md:block min-w-0">
          <button
            type="button"
            onClick={() =>
              onOpenAlbum(track.album || track.title, track.artist, track.albumId, track)
            }
            className="text-xs font-medium text-[#94a3b8] hover:text-white hover:underline truncate block max-w-full text-left cursor-pointer focus:outline-none"
          >
            {cleanAlbumTitle}
          </button>
        </div>
      )}

      {/* Right Cell: Radio (hover) / Offline Download / Heart / Duration / More (•••) */}
      <div className="flex items-center justify-end gap-1 shrink-0">
        <button
          type="button"
          title={tr('Radio Piesă', 'Song Radio', 'Радио трека')}
          onClick={() => onStartRadio(track)}
          className="hidden sm:inline-flex w-8 h-8 rounded-full items-center justify-center text-[#94a3b8] hover:text-[#93c5fd] hover:bg-white/10 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all cursor-pointer focus:outline-none"
        >
          <Radio className="w-4 h-4" />
        </button>

        <TrackOfflineDownloadButton tr={tr} track={track} />

        <button
          type="button"
          title={tr('Adaugă la favorite', 'Save to Liked Songs', 'В Любимые')}
          onClick={onToggleLike}
          className={`w-8 h-8 rounded-full inline-flex items-center justify-center transition-all cursor-pointer focus:outline-none ${
            isLiked
              ? 'text-[#60a5fa]'
              : 'text-[#94a3b8] sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 hover:text-white'
          }`}
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
        </button>

        <span className="hidden sm:inline-block text-xs font-medium text-[#94a3b8] tabular-nums w-10 text-right">
          {formatMusicDuration(track.durationSec)}
        </span>

        <button
          type="button"
          title={tr('Opțiuni piesă', 'More options', 'Ещё')}
          onClick={() => onOpenTrackMenu(track)}
          className="w-8 h-8 rounded-full inline-flex items-center justify-center text-[#94a3b8] hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus:outline-none"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 1. ARTIST PROFILE VIEW
// ============================================================================
export const ArtistProfileView: React.FC<{
  tr: TrFn;
  data: SpotifyArtistProfileData | null;
  isLoading: boolean;
  artistNameFallback: string;
  currentTrack: SpotifyTrackItem | null;
  isPlaying: boolean;
  isShuffle: boolean;
  likedTracks: SpotifyTrackItem[];
  onBack: () => void;
  onPlayTrack: (track: SpotifyTrackItem, list: SpotifyTrackItem[]) => void;
  onToggleShuffle: () => void;
  onToggleLikeTrack: (track: SpotifyTrackItem) => void;
  onOpenArtist: (name: string, artistId?: string) => void;
  onOpenAlbum: (album: string, artist: string, albumId?: string, track?: SpotifyTrackItem) => void;
  onStartRadio: (track: SpotifyTrackItem) => void;
  onOpenSongStudio: (track: SpotifyTrackItem) => void;
  onOpenTrackMenu: (track: SpotifyTrackItem) => void;
}> = ({
  tr,
  data,
  isLoading,
  artistNameFallback,
  currentTrack,
  isPlaying,
  isShuffle,
  likedTracks,
  onPlayTrack,
  onToggleShuffle,
  onToggleLikeTrack,
  onOpenArtist,
  onOpenAlbum,
  onStartRadio,
  onOpenSongStudio,
  onOpenTrackMenu,
}) => {
  const [showAllPopular, setShowAllPopular] = useState(false);
  const [discogFilter, setDiscogFilter] = useState<'all' | 'album' | 'single'>('all');
  const [encyclopedia, setEncyclopedia] = useState<MusicEncyclopediaData | null>(null);
  const [bioExpanded, setBioExpanded] = useState(false);

  const artistName = data?.artist?.name || artistNameFallback;
  const uiLang = resolveUiLangFromTr(tr);

  useEffect(() => {
    if (!artistName) {
      setEncyclopedia(null);
      return;
    }
    let cancelled = false;
    setBioExpanded(false);
    loadMusicEncyclopedia({ artist: artistName, lang: uiLang })
      .then((res) => {
        if (!cancelled) setEncyclopedia(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [artistName, uiLang]);
  const avatar = data?.artist?.avatar || FALLBACK_MUSIC_COVER;
  const fansLabel = formatFansCount(data?.artist?.fans);
  const topTracks = data?.topTracks || [];
  const albums = data?.albums || [];
  const relatedArtists = data?.relatedArtists || [];

  const filteredAlbums = useMemo(() => {
    if (discogFilter === 'all') return albums;
    if (discogFilter === 'single') {
      return albums.filter((a) => a.recordType === 'single' || a.recordType === 'ep');
    }
    return albums.filter((a) => a.recordType !== 'single' && a.recordType !== 'ep');
  }, [albums, discogFilter]);

  const popularSlice = showAllPopular ? topTracks : topTracks.slice(0, 5);

  return (
    <div className="space-y-6 pb-8 w-full max-w-full min-w-0 overflow-x-hidden">
      {/* Compact Horizontal Artist Hero Card */}
      <div className="rounded-xl bg-gradient-to-br from-[#172554]/55 via-[#111622] to-[#0c101b] border border-white/[0.08] p-4 sm:p-5 shadow-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden ring-2 ring-white/15 shadow-xl shrink-0 bg-[#111726]">
            <img
              src={proxyMusicCover(avatar)}
              alt={artistName}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = FALLBACK_MUSIC_COVER;
              }}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400">
              <BadgeCheck className="w-4 h-4 shrink-0" />
              <span>{tr('Artist Verificat', 'Verified Artist', 'Подтвержденный артист')}</span>
            </div>

            <h1 className={`${MUSIC_TYPOGRAPHY.h1} truncate`}>{artistName}</h1>

            <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 ${MUSIC_TYPOGRAPHY.meta}`}>
              {fansLabel && (
                <span>
                  {fansLabel} {tr('ascultători & fani', 'listeners & fans', 'слушателей')}
                </span>
              )}
              {fansLabel && albums.length > 0 && <span>•</span>}
              {albums.length > 0 && (
                <span>
                  {albums.length} {tr('lansări & albume', 'releases', 'релизов')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={topTracks.length === 0}
            onClick={() => topTracks[0] && onPlayTrack(topTracks[0], topTracks)}
            style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
            className="h-10 px-5 rounded-full bg-[#2563eb] hover:scale-[1.03] disabled:opacity-50 text-white text-[13px] font-bold inline-flex items-center gap-2 shadow-lg transition-transform cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current text-white" />
            <span>{tr('Redă', 'Play', 'Слушать')}</span>
          </button>

          <button
            type="button"
            onClick={onToggleShuffle}
            className={`h-10 px-4 rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
              isShuffle
                ? 'bg-[#1e3a8a]/45 border-[#60a5fa]/50 text-[#60a5fa]'
                : 'bg-white/[0.08] border-white/10 text-white hover:bg-white/[0.15]'
            }`}
          >
            <Shuffle className="w-4 h-4" />
            <span>Shuffle</span>
          </button>

          {topTracks[0] && (
            <button
              type="button"
              onClick={() => onStartRadio(topTracks[0])}
              className="h-10 px-4 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Radio className="w-4 h-4" />
              <span>{tr('Radio Artist', 'Artist Radio', 'Радио артиста')}</span>
            </button>
          )}

          <CollectionOfflineDownloadButton tr={tr} tracks={topTracks} />
        </div>
      </div>

      {isLoading ? (
        <div className="py-10 flex items-center justify-center gap-2 text-xs sm:text-sm text-[#94a3b8]">
          <Loader2 className="w-5 h-5 animate-spin text-[#60a5fa]" />
          <span>{tr('Se încarcă profilul artistului...', 'Loading artist profile...', 'Загрузка профиля...')}</span>
        </div>
      ) : (
        <>
          {/* Popular Tracks */}
          {topTracks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className={MUSIC_TYPOGRAPHY.h2}>
                  {tr('Populare', 'Popular', 'Популярные треки')}
                </h2>
                {topTracks.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllPopular((v) => !v)}
                    className="h-8 px-3 rounded-full text-xs font-semibold text-[#94a3b8] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    {showAllPopular
                      ? tr('Mai puțin', 'Show less', 'Свернуть')
                      : `${tr('Vezi toate', 'See all', 'Показать все')} (${topTracks.length})`}
                  </button>
                )}
              </div>

              <div className="rounded-xl bg-[#0e121b]/95 border border-white/[0.09] overflow-hidden">
                <TrackTableHeader tr={tr} showAlbum />
                <div className="p-1.5 space-y-0.5">
                  {popularSlice.map((track, idx) => (
                    <PremiumTrackRow
                      key={`art_tr_${track.id}_${idx}`}
                      tr={tr}
                      track={track}
                      index={idx}
                      isCurrent={currentTrack?.id === track.id}
                      isPlaying={isPlaying}
                      isLiked={likedTracks.some((l) => l.id === track.id)}
                      showCover
                      showAlbum
                      onPlay={() => onPlayTrack(track, topTracks)}
                      onToggleLike={() => onToggleLikeTrack(track)}
                      onOpenArtist={onOpenArtist}
                      onOpenAlbum={onOpenAlbum}
                      onStartRadio={onStartRadio}
                      onOpenSongStudio={onOpenSongStudio}
                      onOpenTrackMenu={onOpenTrackMenu}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Discography */}
          {albums.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className={MUSIC_TYPOGRAPHY.h2}>
                  {tr('Discografie', 'Discography', 'Дискография')}
                </h2>
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      ['all', tr('Toate', 'All', 'Все')],
                      ['album', tr('Albume', 'Albums', 'Альбомы')],
                      ['single', tr('Single & EP', 'Singles & EP', 'Синглы')],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setDiscogFilter(val)}
                      className={`h-8 px-3.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                        discogFilter === val
                          ? 'bg-white text-black'
                          : 'bg-white/[0.08] text-white hover:bg-white/[0.15]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                {filteredAlbums.slice(0, 12).map((alb) => (
                  <button
                    key={alb.id}
                    type="button"
                    onClick={() => onOpenAlbum(alb.title, alb.artist || artistName, alb.id)}
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
                    <div className="text-xs font-medium text-[#94a3b8] truncate mt-0.5 capitalize w-full">
                      {alb.year ? `${alb.year} • ` : ''}
                      {alb.recordType || 'Album'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Artist Biography & Career History */}
          {encyclopedia?.artistBio && (
            <div className="rounded-xl bg-[#0e121b]/95 border border-white/[0.09] p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#60a5fa] shrink-0" />
                  <h2 className={MUSIC_TYPOGRAPHY.h2}>
                    {tr('Biografie & Istoric Carieră', 'Biography & Career History', 'Биография и история')}
                  </h2>
                </div>
                {encyclopedia.artistBio.length > 360 && (
                  <button
                    type="button"
                    onClick={() => setBioExpanded((v) => !v)}
                    className="h-8 px-3 rounded-full text-xs font-semibold text-[#60a5fa] hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    {bioExpanded
                      ? tr('Restrânge', 'Show less', 'Свернуть')
                      : tr('Citește toată biografia', 'Read full biography', 'Читать полностью')}
                  </button>
                )}
              </div>

              {(encyclopedia.artistOrigin ||
                encyclopedia.artistActiveYears ||
                encyclopedia.artistTypeLabel ||
                encyclopedia.artistStyles.length > 0) && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {encyclopedia.artistOrigin && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-slate-200">
                      <Globe className="w-3.5 h-3.5 text-[#60a5fa]" />
                      <span>{encyclopedia.artistOrigin}</span>
                    </span>
                  )}
                  {encyclopedia.artistActiveYears && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-slate-200">
                      <Calendar className="w-3.5 h-3.5 text-[#60a5fa]" />
                      <span>{encyclopedia.artistActiveYears}</span>
                    </span>
                  )}
                  {encyclopedia.artistTypeLabel && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-slate-200">
                      <Users className="w-3.5 h-3.5 text-[#60a5fa]" />
                      <span>{encyclopedia.artistTypeLabel}</span>
                    </span>
                  )}
                  {encyclopedia.artistStyles.slice(0, 3).map((st) => (
                    <span
                      key={st}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1e3a8a]/35 border border-[#3b82f6]/35 text-[#60a5fa] capitalize"
                    >
                      <Award className="w-3 h-3" />
                      <span>{st}</span>
                    </span>
                  ))}
                </div>
              )}

              <p
                className={`whitespace-pre-line text-xs sm:text-sm text-slate-300 leading-relaxed ${
                  bioExpanded ? '' : 'line-clamp-5'
                }`}
              >
                {encyclopedia.artistBio}
              </p>
            </div>
          )}

          {/* Related Artists */}
          {relatedArtists.length > 0 && (
            <div className="space-y-3">
              <h2 className={MUSIC_TYPOGRAPHY.h2}>
                {tr('Fanii mai ascultă și', 'Fans also like', 'Похожие артисты')}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                {relatedArtists.slice(0, 6).map((rel) => (
                  <button
                    key={rel.id}
                    type="button"
                    onClick={() => onOpenArtist(rel.name, rel.id)}
                    className="p-3 rounded-xl bg-[#0e121b]/95 hover:bg-[#161f30] border border-white/[0.09] focus:outline-none transition-colors text-center group cursor-pointer flex flex-col items-center"
                  >
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden mb-2.5 shadow-xl bg-[#111726] ring-1 ring-white/10">
                      <img
                        src={proxyMusicCover(rel.avatar)}
                        alt={rel.name}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = FALLBACK_MUSIC_COVER;
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="text-[13px] sm:text-sm font-semibold text-white truncate w-full">
                      {rel.name}
                    </div>
                    <div className="text-xs font-medium text-[#94a3b8] mt-0.5">
                      {tr('Artist', 'Artist', 'Исполнитель')}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ============================================================================
// 2. ALBUM DETAIL VIEW
// ============================================================================
export const AlbumDetailView: React.FC<{
  tr: TrFn;
  album: MusicAlbumDetailCard | null;
  isLoading: boolean;
  currentTrack: SpotifyTrackItem | null;
  isPlaying: boolean;
  isShuffle: boolean;
  likedTracks: SpotifyTrackItem[];
  onBack: () => void;
  onPlayTrack: (track: SpotifyTrackItem, list: SpotifyTrackItem[]) => void;
  onToggleShuffle: () => void;
  onToggleLikeTrack: (track: SpotifyTrackItem) => void;
  onOpenArtist: (name: string, artistId?: string) => void;
  onOpenAlbum: (album: string, artist: string, albumId?: string, track?: SpotifyTrackItem) => void;
  onStartRadio: (track: SpotifyTrackItem) => void;
  onOpenSongStudio: (track: SpotifyTrackItem) => void;
  onOpenTrackMenu: (track: SpotifyTrackItem) => void;
}> = ({
  tr,
  album,
  isLoading,
  currentTrack,
  isPlaying,
  isShuffle,
  likedTracks,
  onPlayTrack,
  onToggleShuffle,
  onToggleLikeTrack,
  onOpenArtist,
  onOpenAlbum,
  onStartRadio,
  onOpenSongStudio,
  onOpenTrackMenu,
}) => {
  const [encyclopedia, setEncyclopedia] = useState<MusicEncyclopediaData | null>(null);
  const [storyExpanded, setStoryExpanded] = useState(false);
  const uiLang = resolveUiLangFromTr(tr);

  useEffect(() => {
    if (!album?.artistName || !album?.albumTitle) {
      setEncyclopedia(null);
      return;
    }
    let cancelled = false;
    setStoryExpanded(false);
    loadMusicEncyclopedia({
      artist: album.artistName,
      album: album.albumTitle,
      genre: album.genre,
      year: album.year,
      lang: uiLang,
    })
      .then((res) => {
        if (!cancelled) setEncyclopedia(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [album?.artistName, album?.albumTitle, album?.genre, album?.year, uiLang]);

  if (!album) return null;

  return (
    <div className="space-y-6 pb-8 w-full max-w-full min-w-0 overflow-x-hidden">
      {/* Compact Horizontal Album Hero Card */}
      <div className="rounded-xl tahoe-glass p-4 sm:p-5 shadow-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <img
            src={proxyMusicCover(album.coverUrl)}
            alt={album.albumTitle}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = FALLBACK_MUSIC_COVER;
            }}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shadow-xl shrink-0 bg-[#111726]"
          />

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[#60a5fa]">
                {album.recordType === 'single'
                  ? 'Single'
                  : album.recordType === 'ep'
                  ? 'EP'
                  : tr('Album', 'Album', 'Альбом')}
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#1e3a8a]/45 text-[#60a5fa]">
                MAX • 24-bit FLAC
              </span>
            </div>

            <h1 className={`${MUSIC_TYPOGRAPHY.h1} truncate`}>{album.albumTitle}</h1>

            <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 ${MUSIC_TYPOGRAPHY.meta}`}>
              <button
                type="button"
                onClick={() => onOpenArtist(album.artistName, album.artistId)}
                className="inline-flex items-center gap-1.5 font-semibold text-white hover:text-[#93c5fd] hover:underline cursor-pointer"
              >
                {album.artistAvatar && (
                  <img
                    src={proxyMusicCover(album.artistAvatar)}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = FALLBACK_MUSIC_COVER;
                    }}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                )}
                <span>{album.artistName}</span>
              </button>
              <span>•</span>
              <span>{album.releaseDateText || album.year}</span>
              <span>•</span>
              <span>
                {album.trackCount} {tr('melodii', 'songs', 'треков')},{' '}
                {Math.max(1, Math.round(album.totalDurationSec / 60))} min
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={album.tracks.length === 0}
            onClick={() => album.tracks[0] && onPlayTrack(album.tracks[0], album.tracks)}
            style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
            className="h-10 px-5 rounded-full bg-[#2563eb] hover:scale-[1.03] disabled:opacity-50 text-white text-[13px] font-bold inline-flex items-center gap-2 shadow-lg transition-transform cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current text-white" />
            <span>{tr('Redă Albumul', 'Play Album', 'Слушать альбом')}</span>
          </button>

          <button
            type="button"
            onClick={onToggleShuffle}
            className={`h-10 px-4 rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
              isShuffle
                ? 'bg-[#1e3a8a]/45 border-[#60a5fa]/50 text-[#60a5fa]'
                : 'bg-white/[0.08] border-white/10 text-white hover:bg-white/[0.15]'
            }`}
          >
            <Shuffle className="w-4 h-4" />
            <span>Shuffle</span>
          </button>

          {album.tracks[0] && (
            <button
              type="button"
              onClick={() => onStartRadio(album.tracks[0])}
              className="h-10 px-4 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Radio className="w-4 h-4" />
              <span>{tr('Radio Album', 'Album Radio', 'Радио альбома')}</span>
            </button>
          )}

          <CollectionOfflineDownloadButton tr={tr} tracks={album.tracks} />
        </div>
      </div>

      {/* Album Tracklist */}
      <div className="rounded-xl bg-[#0e121b]/95 border border-white/[0.09] overflow-hidden">
        {isLoading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-xs sm:text-sm text-[#94a3b8]">
            <Loader2 className="w-4 h-4 animate-spin text-[#60a5fa]" />
            <span>
              {tr('Se încarcă melodiile albumului...', 'Loading album tracks...', 'Загрузка треков...')}
            </span>
          </div>
        ) : (
          <>
            <TrackTableHeader tr={tr} showAlbum={false} />
            <div className="p-1.5 space-y-0.5">
              {album.tracks.map((track, idx) => (
                <PremiumTrackRow
                  key={`alb_tr_${track.id}_${idx}`}
                  tr={tr}
                  track={track}
                  index={idx}
                  isCurrent={currentTrack?.id === track.id}
                  isPlaying={isPlaying}
                  isLiked={likedTracks.some((t) => t.id === track.id)}
                  showCover={false}
                  showAlbum={false}
                  onPlay={() => onPlayTrack(track, album.tracks)}
                  onToggleLike={() => onToggleLikeTrack(track)}
                  onOpenArtist={onOpenArtist}
                  onOpenAlbum={onOpenAlbum}
                  onStartRadio={onStartRadio}
                  onOpenSongStudio={onOpenSongStudio}
                  onOpenTrackMenu={onOpenTrackMenu}
                />
              ))}
            </div>
          </>
        )}

        {(album.label || album.copyright) && (
          <div className="px-4 py-3 border-t border-white/[0.09] text-xs text-[#64748b] space-y-0.5">
            {album.releaseDateText && <div>{album.releaseDateText}</div>}
            <div>{album.label || album.copyright}</div>
          </div>
        )}
      </div>

      {/* Album History & Context */}
      {encyclopedia?.albumStory && (
        <div className="rounded-xl bg-[#0e121b]/95 border border-white/[0.09] p-4 sm:p-5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#60a5fa] shrink-0" />
              <h2 className={MUSIC_TYPOGRAPHY.h2}>
                {tr('Istoricul & Povestea Albumului', 'Album History & Context', 'История альбома')}
              </h2>
            </div>
            {encyclopedia.albumStory.length > 340 && (
              <button
                type="button"
                onClick={() => setStoryExpanded((v) => !v)}
                className="h-8 px-3 rounded-full text-xs font-semibold text-[#60a5fa] hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                {storyExpanded
                  ? tr('Restrânge', 'Show less', 'Свернуть')
                  : tr('Citește mai mult', 'Read more', 'Подробнее')}
              </button>
            )}
          </div>
          <p
            className={`whitespace-pre-line text-xs sm:text-sm text-slate-300 leading-relaxed ${
              storyExpanded ? '' : 'line-clamp-5'
            }`}
          >
            {encyclopedia.albumStory}
          </p>
        </div>
      )}

      {/* More Albums by Artist */}
      {album.moreAlbums && album.moreAlbums.length > 0 && (
        <div className="space-y-3">
          <h2 className={MUSIC_TYPOGRAPHY.h2}>
            {tr(`Mai multe de la ${album.artistName}`, `More by ${album.artistName}`, `Другие релизы ${album.artistName}`)}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {album.moreAlbums.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onOpenAlbum(m.title, m.artist, m.id)}
                className="p-3 rounded-xl bg-[#0e121b]/95 hover:bg-[#161f30] border border-white/[0.09] focus:outline-none transition-colors text-left group cursor-pointer flex flex-col"
              >
                <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-2.5 bg-[#111726]">
                  <img
                    src={proxyMusicCover(m.cover)}
                    alt={m.title}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = FALLBACK_MUSIC_COVER;
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="text-[13px] sm:text-sm font-semibold text-white truncate w-full">
                  {m.title}
                </div>
                <div className="text-xs font-medium text-[#94a3b8] truncate mt-0.5 w-full">
                  {m.year || ''}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 3. SONG RADIO MIX GENERATOR VIEW
// ============================================================================
export const SongRadioView: React.FC<{
  tr: TrFn;
  radioData: SpotifySongRadioData | null;
  isLoading: boolean;
  currentTrack: SpotifyTrackItem | null;
  isPlaying: boolean;
  isShuffle: boolean;
  likedTracks: SpotifyTrackItem[];
  onBack: () => void;
  onPlayTrack: (track: SpotifyTrackItem, list: SpotifyTrackItem[]) => void;
  onTogglePlayPause: () => void;
  onToggleShuffle: () => void;
  onRegenerateRadio: () => void;
  onToggleLikeTrack: (track: SpotifyTrackItem) => void;
  onOpenArtist: (name: string, artistId?: string) => void;
  onOpenAlbum: (album: string, artist: string, albumId?: string, track?: SpotifyTrackItem) => void;
  onStartRadio: (track: SpotifyTrackItem) => void;
  onOpenSongStudio: (track: SpotifyTrackItem) => void;
  onOpenTrackMenu: (track: SpotifyTrackItem) => void;
}> = ({
  tr,
  radioData,
  isLoading,
  currentTrack,
  isPlaying,
  isShuffle,
  likedTracks,
  onPlayTrack,
  onTogglePlayPause,
  onToggleShuffle,
  onRegenerateRadio,
  onToggleLikeTrack,
  onOpenArtist,
  onOpenAlbum,
  onStartRadio,
  onOpenSongStudio,
  onOpenTrackMenu,
}) => {
  if (!radioData && !isLoading) return null;

  const tracks = radioData?.tracks || [];
  const isPlayingFromThisRadio =
    Boolean(currentTrack) && tracks.some((t) => t.id === currentTrack?.id);

  return (
    <div className="space-y-6 pb-8 w-full max-w-full min-w-0 overflow-x-hidden">
      {/* Compact Horizontal Radio Hero Card */}
      <div className="rounded-xl bg-gradient-to-br from-[#1e3a8a]/45 via-[#111827] to-[#0c101b] border border-[#3b82f6]/25 p-4 sm:p-5 shadow-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <img
            src={proxyMusicCover(radioData?.seedCover)}
            alt={radioData?.seedTrack.title || 'Radio'}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = FALLBACK_MUSIC_COVER;
            }}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shadow-xl shrink-0 bg-[#111726]"
          />

          <div className="flex-1 min-w-0 space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#60a5fa]">
              <Radio className="w-3.5 h-3.5 shrink-0" />
              <span>{tr('Playlist Radio Instant', 'Instant Radio Mix', 'Радио-Микс')}</span>
            </div>

            <h1 className={`${MUSIC_TYPOGRAPHY.h1} truncate`}>
              {radioData?.title || tr('Se generează Radio...', 'Generating Radio...', 'Создание радио...')}
            </h1>

            <p className={`${MUSIC_TYPOGRAPHY.meta} truncate`}>
              {radioData?.subtitle || ''}
              {tracks.length > 0
                ? ` • ${tracks.length} ${tr('melodii similare', 'similar songs', 'похожих треков')}`
                : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={tracks.length === 0}
            onClick={() => {
              if (isPlayingFromThisRadio) {
                onTogglePlayPause();
              } else if (tracks[0]) {
                onPlayTrack(tracks[0], tracks);
              }
            }}
            style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
            className="h-10 px-5 rounded-full bg-[#2563eb] hover:scale-[1.03] disabled:opacity-50 text-white text-[13px] font-bold inline-flex items-center gap-2 shadow-lg transition-transform cursor-pointer"
          >
            {isPlayingFromThisRadio && isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current text-white" />
                <span>{tr('Pauză Mix', 'Pause Mix', 'Пауза')}</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current text-white" />
                <span>{tr('Redă Mixul', 'Play Radio', 'Слушать микс')}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleShuffle}
            className={`h-10 px-4 rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
              isShuffle
                ? 'bg-[#1e3a8a]/45 border-[#60a5fa]/50 text-[#60a5fa]'
                : 'bg-white/[0.08] border-white/10 text-white hover:bg-white/[0.15]'
            }`}
          >
            <Shuffle className="w-4 h-4" />
            <span>Shuffle</span>
          </button>

          <button
            type="button"
            onClick={onRegenerateRadio}
            className="h-10 px-4 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{tr('Regenerează', 'Refresh Mix', 'Обновить')}</span>
          </button>

          <CollectionOfflineDownloadButton tr={tr} tracks={tracks} />
        </div>
      </div>

      {isLoading && tracks.length === 0 ? (
        <div className="py-10 flex items-center justify-center gap-2 text-xs sm:text-sm text-[#94a3b8]">
          <Loader2 className="w-5 h-5 animate-spin text-[#60a5fa]" />
          <span>
            {tr('Construim playlistul tău radio personalizat...', 'Building your personalized song radio...', 'Собираем ваш радио-плейлист...')}
          </span>
        </div>
      ) : (
        <div className="rounded-xl bg-[#0e121b]/95 border border-white/[0.09] overflow-hidden">
          <TrackTableHeader tr={tr} showAlbum />
          <div className="p-1.5 space-y-0.5">
            {tracks.map((track, idx) => (
              <PremiumTrackRow
                key={`rad_tr_${track.id}_${idx}`}
                tr={tr}
                track={track}
                index={idx}
                isCurrent={currentTrack?.id === track.id}
                isPlaying={isPlaying}
                isLiked={likedTracks.some((t) => t.id === track.id)}
                showCover
                showAlbum
                onPlay={() => onPlayTrack(track, tracks)}
                onToggleLike={() => onToggleLikeTrack(track)}
                onOpenArtist={onOpenArtist}
                onOpenAlbum={onOpenAlbum}
                onStartRadio={onStartRadio}
                onOpenSongStudio={onOpenSongStudio}
                onOpenTrackMenu={onOpenTrackMenu}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 4. SHARED STUDIO TABS (Studio / Synced Lyrics / Queue) — INLINE & FULLSCREEN
// ============================================================================
interface StudioTabsProps {
  tr: TrFn;
  track: SpotifyTrackItem;
  currentTrack: SpotifyTrackItem | null;
  isPlaying: boolean;
  elapsedSec: number;
  durationSec: number;
  progressPct: number;
  isShuffle: boolean;
  isRepeat: boolean;
  isLiked: boolean;
  isVideoClipMode: boolean;
  queue: SpotifyTrackItem[];
  initialTab?: 'studio' | 'lyrics' | 'bio' | 'queue';
  compact?: boolean;
  onPlayTrack: (track: SpotifyTrackItem, queueList?: SpotifyTrackItem[]) => void;
  onTogglePlayPause: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onSeek: (sec: number) => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onToggleLikeTrack: (track: SpotifyTrackItem) => void;
  onToggleVideoClip: () => void;
  onOpenArtist: (name: string, artistId?: string) => void;
  onOpenAlbum: (album: string, artist: string, albumId?: string, track?: SpotifyTrackItem) => void;
  onStartRadio: (track: SpotifyTrackItem) => void;
  onRemoveFromQueue?: (trackId: string) => void;
}

export const SongStudioCore: React.FC<StudioTabsProps> = ({
  tr,
  track,
  currentTrack,
  isPlaying,
  elapsedSec,
  durationSec,
  progressPct,
  isShuffle,
  isRepeat,
  isLiked,
  isVideoClipMode,
  queue,
  initialTab = 'studio',
  compact = false,
  onPlayTrack,
  onTogglePlayPause,
  onNextTrack,
  onPrevTrack,
  onSeek,
  onToggleShuffle,
  onToggleRepeat,
  onToggleLikeTrack,
  onToggleVideoClip,
  onOpenArtist,
  onOpenAlbum,
  onStartRadio,
  onRemoveFromQueue,
}) => {
  const [activeTab, setActiveTab] = useState<'studio' | 'lyrics' | 'bio' | 'queue'>(initialTab);
  const [isVinylMode, setIsVinylMode] = useState(false);
  const [encyclopedia, setEncyclopedia] = useState<MusicEncyclopediaData | null>(null);
  const [bioTabLoading, setBioTabLoading] = useState(false);
  const uiLang = resolveUiLangFromTr(tr);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [syncedLines, setSyncedLines] = useState<ParsedLyricLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState<string | null>(null);
  const [instrumental, setInstrumental] = useState(false);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);

  const isThisTrackCurrent = currentTrack?.id === track.id;
  const isActivelyPlayingThis = isThisTrackCurrent && isPlaying;
  const effectiveDuration =
    durationSec > 0 && isThisTrackCurrent ? durationSec : track.durationSec || 200;

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    let cancelled = false;
    setBioTabLoading(true);
    loadMusicEncyclopedia({
      artist: track.artist,
      title: track.title,
      album: track.album,
      genre: track.genre,
      year: track.year,
      lang: uiLang,
    })
      .then((res) => {
        if (!cancelled) setEncyclopedia(res);
      })
      .finally(() => {
        if (!cancelled) setBioTabLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [track.id, track.title, track.artist, track.album, track.genre, track.year, uiLang]);

  useEffect(() => {
    let cancelled = false;
    setLyricsLoading(true);
    setSyncedLines([]);
    setPlainLyrics(null);
    setInstrumental(false);

    loadSyncedLyrics(track)
      .then((res) => {
        if (cancelled) return;
        const parsed = parseLrcLyrics(res.syncedLyrics);
        setSyncedLines(parsed);
        setPlainLyrics(res.plainLyrics);
        setInstrumental(res.instrumental);
      })
      .finally(() => {
        if (!cancelled) setLyricsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [track.id, track.title, track.artist]);

  const activeLyricIndex = useMemo(() => {
    if (!isThisTrackCurrent || syncedLines.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < syncedLines.length; i++) {
      if (syncedLines[i].timeSec <= elapsedSec + 0.35) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [syncedLines, elapsedSec, isThisTrackCurrent]);

  useEffect(() => {
    if (activeTab !== 'lyrics' || activeLyricIndex < 0) return;
    const container = lyricsContainerRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(`[data-lrc-idx="${activeLyricIndex}"]`);
    if (el) {
      const targetTop = Math.max(
        0,
        el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2
      );
      container.scrollTo({ top: targetTop, behavior: 'smooth' });
    }
  }, [activeLyricIndex, activeTab]);

  const renderScrubber = () => (
    <div className="space-y-1.5">
      <div
        role="slider"
        tabIndex={0}
        aria-label="Timeline Scrubber"
        aria-valuemin={0}
        aria-valuemax={effectiveDuration}
        aria-valuenow={Math.floor(isThisTrackCurrent ? elapsedSec : 0)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          const rect = e.currentTarget.getBoundingClientRect();
          if (rect.width > 0) {
            const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
            if (!isThisTrackCurrent) {
              onPlayTrack(track, queue.length > 0 ? queue : [track]);
            }
            onSeek(ratio * effectiveDuration);
          }
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1 || e.currentTarget.hasPointerCapture?.(e.pointerId)) {
            const rect = e.currentTarget.getBoundingClientRect();
            if (rect.width > 0) {
              const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
              onSeek(ratio * effectiveDuration);
            }
          }
        }}
        onPointerUp={(e) => {
          if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
        className="relative h-4 flex items-center cursor-pointer group focus:outline-none touch-none select-none"
      >
        <div className="relative w-full h-1.5 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-white group-hover:bg-[#60a5fa] transition-colors"
            style={{ width: `${isThisTrackCurrent ? progressPct : 0}%` }}
          />
        </div>
        <div
          className="pointer-events-none absolute w-3.5 h-3.5 rounded-full bg-white shadow opacity-90 group-hover:opacity-100 transition-opacity"
          style={{
            left: `clamp(0px, calc(${isThisTrackCurrent ? progressPct : 0}% - 7px), calc(100% - 14px))`,
          }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-[#94a3b8] tabular-nums font-medium">
        <span>{formatMusicDuration(isThisTrackCurrent ? elapsedSec : 0)}</span>
        <span>{formatMusicDuration(effectiveDuration)}</span>
      </div>
    </div>
  );

  const renderTransport = () => (
    <div className="flex items-center justify-between gap-2 pt-1">
      <button
        type="button"
        onClick={onToggleShuffle}
        className={`w-9 h-9 rounded-full inline-flex items-center justify-center cursor-pointer transition-colors hover:bg-white/[0.08] ${
          isShuffle ? 'text-[#60a5fa]' : 'text-white/65 hover:text-white'
        }`}
        title={tr('Amestecare', 'Shuffle', 'Перемешать')}
      >
        <Shuffle className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => onSeek(Math.max(0, elapsedSec - 10))}
          className="hidden sm:inline-flex w-9 h-9 rounded-full items-center justify-center text-white/65 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          title="-10s"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onPrevTrack}
          className="w-9 h-9 rounded-full inline-flex items-center justify-center text-white hover:bg-white/[0.08] active:scale-95 transition-all cursor-pointer"
          title={tr('Piesa anterioară', 'Previous', 'Предыдущий трек')}
        >
          <SkipBack className="w-5 h-5 fill-current" />
        </button>

        <button
          type="button"
          onClick={() => {
            if (!isThisTrackCurrent) {
              onPlayTrack(track, queue.length > 0 ? queue : [track]);
            } else {
              onTogglePlayPause();
            }
          }}
          style={{ backgroundColor: '#ffffff', color: '#000000' }}
          className="w-12 h-12 rounded-full bg-white text-black inline-flex items-center justify-center shadow-xl active:scale-95 hover:scale-105 transition-all cursor-pointer shrink-0"
          title={isActivelyPlayingThis ? 'Pause' : 'Play'}
        >
          {isActivelyPlayingThis ? (
            <Pause className="w-5 h-5 fill-current text-black" />
          ) : (
            <Play className="w-5 h-5 fill-current text-black ml-0.5" />
          )}
        </button>

        <button
          type="button"
          onClick={onNextTrack}
          className="w-9 h-9 rounded-full inline-flex items-center justify-center text-white hover:bg-white/[0.08] active:scale-95 transition-all cursor-pointer"
          title={tr('Piesa următoare', 'Next', 'Следующий трек')}
        >
          <SkipForward className="w-5 h-5 fill-current" />
        </button>

        <button
          type="button"
          onClick={() => onSeek(Math.min(effectiveDuration, elapsedSec + 10))}
          className="hidden sm:inline-flex w-9 h-9 rounded-full items-center justify-center text-white/65 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          title="+10s"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={onToggleRepeat}
        className={`w-9 h-9 rounded-full inline-flex items-center justify-center cursor-pointer transition-colors hover:bg-white/[0.08] ${
          isRepeat ? 'text-[#60a5fa]' : 'text-white/65 hover:text-white'
        }`}
        title={tr('Repetare', 'Repeat', 'Повтор')}
      >
        <Repeat className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div
      className={`flex flex-col w-full max-w-full min-w-0 overflow-x-hidden min-h-0 gap-3.5 ${
        compact ? (activeTab === 'studio' ? 'my-auto' : 'flex-1 h-full') : ''
      }`}
    >
      {/* Studio Tabs Switcher */}
      <div
        role="tablist"
        aria-label={tr('Moduri Player Muzică', 'Music Player Modes', 'Режимы плеера')}
        className="flex items-center justify-between sm:justify-center gap-0.5 sm:gap-1 p-1 rounded-full bg-white/[0.08] border border-white/10 w-full max-w-full sm:w-fit mx-auto shrink-0 overflow-x-auto no-scrollbar"
      >
        {(
          [
            ['studio', Mic2, tr('Studio', 'Studio', 'Студия'), false],
            ['lyrics', Sparkles, tr('Versuri Live', 'Live Lyrics', 'Текст Live'), false],
            ['bio', BookOpen, tr('Istoric & Bio', 'Story & Bio', 'История и Био'), false],
            ['queue', ListMusic, `${tr('Coadă', 'Queue', 'Очередь')} (${queue.length})`, true],
          ] as const
        ).map(([id, Icon, label]) => {
          const selected = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTab(id)}
              className={`h-8 px-2 sm:px-3.5 rounded-full text-[11px] sm:text-xs font-semibold inline-flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap flex-1 sm:flex-initial min-w-0 shrink-0 transition-all cursor-pointer focus:outline-none ${
                selected
                  ? 'bg-white text-black shadow'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <Icon className="hidden min-[390px]:block w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: STUDIO VIEW */}
      {activeTab === 'studio' && (
        <div
          role="tabpanel"
          className="max-w-[420px] mx-auto w-full min-w-0 overflow-x-hidden flex flex-col gap-3.5 min-h-0"
        >
          {/* Artwork / Spinning Vinyl */}
          <div className="flex flex-col items-center justify-center gap-2.5">
            <div className="relative">
              {isVinylMode ? (
                <div
                  className={`relative ${
                    compact
                      ? 'w-[min(70vw,34vh)] h-[min(70vw,34vh)] sm:w-[min(300px,36vh)] sm:h-[min(300px,36vh)]'
                      : 'w-60 h-60 sm:w-72 sm:h-72'
                  } rounded-full bg-gradient-to-br from-[#161f30] via-[#0b0f19] to-[#0e121b] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.85)] border border-white/15 flex items-center justify-center ${
                    isActivelyPlayingThis ? 'animate-[spin_10s_linear_infinite]' : ''
                  }`}
                >
                  <div className="absolute inset-4 rounded-full border border-white/10 pointer-events-none" />
                  <div className="absolute inset-8 rounded-full border border-white/5 pointer-events-none" />
                  <img
                    src={proxyMusicCover(track.cover || track.coverSmall)}
                    alt={track.title}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = FALLBACK_MUSIC_COVER;
                    }}
                    className="w-[58%] h-[58%] rounded-full object-cover ring-4 ring-black shadow-2xl"
                  />
                  <span className="absolute w-4 h-4 rounded-full bg-[#0b0f19] border border-white/30" />
                </div>
              ) : (
                <div
                  className={`relative ${
                    compact
                      ? 'w-[min(70vw,34vh)] h-[min(70vw,34vh)] sm:w-[min(300px,36vh)] sm:h-[min(300px,36vh)]'
                      : 'w-60 h-60 sm:w-72 sm:h-72'
                  } rounded-xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.85)] border border-white/10 bg-[#111726]`}
                >
                  <img
                    src={proxyMusicCover(track.cover || track.coverSmall)}
                    alt={track.title}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = FALLBACK_MUSIC_COVER;
                    }}
                    className="w-full h-full object-cover"
                  />
                  {isActivelyPlayingThis && (
                    <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/75 border border-white/15 inline-flex items-center gap-2">
                      <EqualizerBars active />
                      <span className="text-[11px] font-semibold text-[#60a5fa]">
                        Live
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsVinylMode((v) => !v)}
              className="h-8 px-3 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-xs font-semibold text-white/90 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Disc className={`w-3.5 h-3.5 ${isVinylMode ? 'text-[#60a5fa]' : ''}`} />
              <span>
                {isVinylMode
                  ? tr('Copertă HD', 'Cover Art', 'Обложка HD')
                  : tr('Mod Vinil Rotativ', 'Spinning Vinyl', 'Режим Винила')}
              </span>
            </button>
          </div>

          {/* Track Meta + Clickable Artist/Album + Heart */}
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <h2 className="text-lg sm:text-xl font-extrabold text-white truncate tracking-tight">
                  {track.title}
                </h2>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-[#94a3b8] min-w-0 max-w-full">
                  <button
                    type="button"
                    onClick={() => onOpenArtist(track.artist, track.artistId)}
                    className="font-semibold text-white hover:text-[#93c5fd] hover:underline truncate max-w-full cursor-pointer text-left"
                  >
                    {track.artist}
                  </button>
                  {track.album && (
                    <>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() =>
                          onOpenAlbum(track.album, track.artist, track.albumId, track)
                        }
                        className="hover:text-white hover:underline truncate max-w-full cursor-pointer text-left"
                      >
                        {track.album}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <TrackOfflineDownloadButton tr={tr} track={track} alwaysVisible />
                <button
                  type="button"
                  onClick={() => onToggleLikeTrack(track)}
                  className={`w-9 h-9 rounded-full inline-flex items-center justify-center cursor-pointer hover:bg-white/[0.08] transition-all active:scale-90 shrink-0 ${
                    isLiked ? 'text-[#60a5fa]' : 'text-white/65 hover:text-white'
                  }`}
                  aria-label="Like Track"
                >
                  <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                </button>
              </div>
            </div>

            {renderScrubber()}
            {renderTransport()}

            {/* Action Navigation Chips: Artist / Album / Song Radio / Video Clip / Offline Download */}
            <div className="flex flex-col gap-2 pt-2.5 border-t border-white/10">
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenArtist(track.artist, track.artistId)}
                  className="h-8 px-3 rounded-full bg-white/[0.08] hover:bg-white hover:text-black text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>{tr('Vezi Artistul', 'Artist', 'Исполнитель')}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onOpenAlbum(track.album || track.title, track.artist, track.albumId, track)
                  }
                  className="h-8 px-3 rounded-full bg-white/[0.08] hover:bg-white hover:text-black text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Disc className="w-3.5 h-3.5" />
                  <span>{tr('Vezi Albumul', 'Album', 'Альбом')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onStartRadio(track)}
                  className="h-8 px-3 rounded-full bg-[#2563eb]/15 hover:bg-[#2563eb] text-[#60a5fa] hover:text-white border border-[#60a5fa]/35 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>{tr('Radio Piesă', 'Song Radio', 'Радио трека')}</span>
                </button>

                <button
                  type="button"
                  onClick={onToggleVideoClip}
                  className={`h-8 px-3 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                    isVideoClipMode
                      ? 'bg-[#2563eb] text-white'
                      : 'bg-white/[0.08] hover:bg-white/[0.15] text-white'
                  }`}
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>{isVideoClipMode ? tr('Clip Activ', 'Clip On', 'Клип') : 'Video HD'}</span>
                </button>

                <CollectionOfflineDownloadButton
                  tr={tr}
                  tracks={[track]}
                  className="!h-8 !px-3 !text-xs"
                />
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#94a3b8]">
                <span className="w-2 h-2 rounded-full bg-[#60a5fa]" />
                <span>{track.qualityLabel || 'MAX • 24-bit FLAC'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE SYNCED LYRICS */}
      {activeTab === 'lyrics' && (
        <div
          role="tabpanel"
          className="flex-1 flex flex-col min-h-0 space-y-3"
        >
          <div className="flex items-center justify-between px-1 shrink-0">
            <div className="min-w-0">
              <div className="text-[13px] sm:text-sm font-semibold text-white truncate">{track.title}</div>
              <div className="text-xs font-medium text-[#94a3b8] truncate">{track.artist}</div>
            </div>
            {syncedLines.length > 0 && (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#1e3a8a]/45 text-[#60a5fa] border border-[#60a5fa]/35 shrink-0">
                Karaoke Live
              </span>
            )}
          </div>

          <div
            ref={lyricsContainerRef}
            className={`flex-1 overflow-y-auto overflow-x-hidden rounded-xl bg-gradient-to-b from-[#0f1d3a]/65 via-[#111622] to-[#0b0f19] border border-white/10 p-5 sm:p-6 space-y-3 ${
              compact ? 'min-h-[280px] max-h-[55vh]' : 'min-h-[340px] max-h-[480px]'
            }`}
          >
            {lyricsLoading ? (
              <div className="h-full min-h-[220px] flex flex-col items-center justify-center gap-3 text-xs text-[#94a3b8]">
                <Loader2 className="w-6 h-6 animate-spin text-[#60a5fa]" />
                <span>{tr('Se sincronizează versurile...', 'Syncing live lyrics...', 'Загрузка текста...')}</span>
              </div>
            ) : syncedLines.length > 0 ? (
              syncedLines.map((line, idx) => {
                const isActive = idx === activeLyricIndex;
                const isPast = activeLyricIndex >= 0 && idx < activeLyricIndex;
                return (
                  <button
                    key={`${line.timeSec}_${idx}`}
                    data-lrc-idx={idx}
                    type="button"
                    onClick={() => {
                      if (!isThisTrackCurrent) {
                        onPlayTrack(track, queue.length > 0 ? queue : [track]);
                      }
                      onSeek(line.timeSec);
                    }}
                    className={`block w-full text-left font-bold transition-all duration-300 cursor-pointer rounded-lg px-2.5 py-1.5 focus:outline-none ${
                      isActive
                        ? 'text-lg sm:text-xl text-white bg-white/[0.08]'
                        : isPast
                        ? 'text-sm sm:text-base text-white/45 hover:text-white/80'
                        : 'text-sm sm:text-base text-white/75 hover:text-white'
                    }`}
                  >
                    {line.text}
                  </button>
                );
              })
            ) : plainLyrics ? (
              <div className="whitespace-pre-line text-sm sm:text-base font-medium text-white/85 leading-relaxed">
                {plainLyrics}
              </div>
            ) : (
              <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center gap-2 text-[#94a3b8]">
                <Mic2 className="w-8 h-8 opacity-40" />
                <div className="text-[13px] sm:text-sm font-semibold text-white">
                  {instrumental
                    ? tr('Piesă instrumentală', 'Instrumental track', 'Инструментальный трек')
                    : tr('Versurile nu sunt disponibile pentru această piesă', 'Lyrics not available for this track', 'Текст не найден')}
                </div>
                <p className="text-xs max-w-xs">
                  {tr(
                    'Poți asculta piesa mai departe sau genera un playlist Radio similar.',
                    'Keep listening or generate a similar Song Radio mix.',
                    'Продолжайте слушать или создайте похожий радио-микс.'
                  )}
                </p>
              </div>
            )}
          </div>

          <div className="shrink-0">
            {renderScrubber()}
          </div>
        </div>
      )}

      {/* TAB 3: STORY & ARTIST BIOGRAPHY */}
      {activeTab === 'bio' && (
        <div
          role="tabpanel"
          className="flex-1 flex flex-col min-h-0 space-y-3"
        >
          <div
            className={`flex-1 overflow-y-auto overflow-x-hidden rounded-xl bg-[#0e121b]/95 border border-white/10 p-4 sm:p-5 space-y-4 ${
              compact ? 'min-h-[280px] max-h-[55vh]' : 'min-h-[340px] max-h-[480px]'
            }`}
          >
            {bioTabLoading && !encyclopedia ? (
              <div className="h-full min-h-[200px] flex flex-col items-center justify-center gap-2.5 text-xs text-[#94a3b8]">
                <Loader2 className="w-5 h-5 animate-spin text-[#60a5fa]" />
                <span>{tr('Se încarcă istoricul și biografia...', 'Loading history and biography...', 'Загрузка истории и биографии...')}</span>
              </div>
            ) : (
              <>
                {(encyclopedia?.songStory || encyclopedia?.albumStory) && (
                  <div className="space-y-2 pb-3 border-b border-white/[0.08]">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#60a5fa]">
                      <Disc className="w-4 h-4 shrink-0" />
                      <span>
                        {encyclopedia.songStory
                          ? tr('Istoricul Piesei', 'Song History', 'История трека')
                          : tr('Istoricul Albumului', 'Album History', 'История альбома')}
                      </span>
                    </div>
                    <p className="whitespace-pre-line text-xs sm:text-[13px] text-slate-200 leading-relaxed">
                      {encyclopedia.songStory || encyclopedia.albumStory}
                    </p>
                  </div>
                )}

                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#60a5fa]">
                    <Users className="w-4 h-4 shrink-0" />
                    <span>{tr('Biografie & Carieră', 'Biography & Career', 'Биография артиста')}</span>
                  </div>
                  {(encyclopedia?.artistOrigin ||
                    encyclopedia?.artistActiveYears ||
                    encyclopedia?.artistTypeLabel ||
                    (encyclopedia?.artistStyles?.length || 0) > 0) && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      {encyclopedia?.artistOrigin && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-slate-200">
                          <Globe className="w-3 h-3 text-[#60a5fa]" />
                          <span>{encyclopedia.artistOrigin}</span>
                        </span>
                      )}
                      {encyclopedia?.artistActiveYears && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-slate-200">
                          <Calendar className="w-3 h-3 text-[#60a5fa]" />
                          <span>{encyclopedia.artistActiveYears}</span>
                        </span>
                      )}
                      {encyclopedia?.artistStyles?.slice(0, 3).map((st) => (
                        <span
                          key={st}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1e3a8a]/35 border border-[#3b82f6]/35 text-[#60a5fa] capitalize"
                        >
                          <Award className="w-3 h-3" />
                          <span>{st}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="whitespace-pre-line text-xs sm:text-[13px] text-slate-300 leading-relaxed">
                    {encyclopedia?.artistBio ||
                      `${track.artist} • ${track.genre || 'Music'} (${track.year || 2025})`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => onOpenArtist(track.artist, track.artistId)}
                    className="h-8 px-3.5 rounded-full bg-white text-black text-xs font-bold hover:scale-[1.02] transition-transform cursor-pointer"
                  >
                    {tr('Vezi Artistul', 'Open Artist', 'Профиль артиста')}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenAlbum(track.album || track.title, track.artist, track.albumId, track)
                    }
                    className="h-8 px-3.5 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {tr('Vezi Albumul', 'Open Album', 'Открыть альбом')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: LIVE QUEUE */}
      {activeTab === 'queue' && (
        <div
          role="tabpanel"
          className="flex-1 flex flex-col min-h-0 space-y-3"
        >
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="text-xs font-semibold text-[#94a3b8]">
              {tr('Urmează în redare', 'Playing Next', 'Далее в очереди')} ({queue.length})
            </div>
            <button
              type="button"
              onClick={() => onStartRadio(currentTrack || track)}
              className="h-8 px-3 rounded-full bg-[#2563eb]/15 hover:bg-[#2563eb] text-[#60a5fa] hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{tr('Radio după piesa curentă', 'Radio from current', 'Радио по треку')}</span>
            </button>
          </div>

          <div
            className={`flex-1 overflow-y-auto overflow-x-hidden rounded-xl bg-[#0e121b]/95 border border-white/10 p-2 space-y-1 ${
              compact ? 'min-h-[280px] max-h-[55vh]' : 'min-h-[340px] max-h-[480px]'
            }`}
          >
            {queue.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#94a3b8]">
                {tr('Coada de redare este goală.', 'Queue is empty.', 'Очередь пуста.')}
              </div>
            ) : (
              queue.map((qTrack, idx) => {
                const isCur = currentTrack?.id === qTrack.id;
                return (
                  <div
                    key={`q_${qTrack.id}_${idx}`}
                    className={`px-2.5 py-2 rounded-lg flex items-center justify-between gap-2.5 transition-colors ${
                      isCur ? 'bg-white/[0.12]' : 'hover:bg-white/[0.06]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onPlayTrack(qTrack, queue)}
                      className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer"
                    >
                      <span className="w-5 text-center text-xs font-medium text-[#94a3b8] tabular-nums">
                        {isCur ? <EqualizerBars active={isPlaying} /> : idx + 1}
                      </span>
                      <img
                        src={proxyMusicCover(qTrack.coverSmall || qTrack.cover)}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = FALLBACK_MUSIC_COVER;
                        }}
                        className="w-10 h-10 rounded-md object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-[13px] sm:text-sm font-semibold truncate ${
                            isCur ? 'text-[#60a5fa]' : 'text-white'
                          }`}
                        >
                          {qTrack.title}
                        </div>
                        <div className="text-xs font-medium text-[#94a3b8] truncate">
                          {qTrack.artist}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <TrackOfflineDownloadButton tr={tr} track={qTrack} />
                      <span className="text-xs font-medium text-[#94a3b8] tabular-nums">
                        {formatMusicDuration(qTrack.durationSec)}
                      </span>
                      {onRemoveFromQueue && !isCur && (
                        <button
                          type="button"
                          title={tr('Elimină din coadă', 'Remove from queue', 'Удалить')}
                          onClick={() => onRemoveFromQueue(qTrack.id)}
                          className="w-8 h-8 rounded-full inline-flex items-center justify-center text-[#94a3b8] hover:text-rose-400 hover:bg-white/10 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 5. INLINE SONG STUDIO DETAIL PAGE ('song' ViewMode)
// ============================================================================
export const SongStudioDetailView: React.FC<
  Omit<StudioTabsProps, 'compact'> & {
    onBack: () => void;
    onOpenFullscreen?: () => void;
  }
> = ({ onOpenFullscreen, ...props }) => {
  const { tr, track } = props;
  const uiLang = resolveUiLangFromTr(tr);
  const [encyclopedia, setEncyclopedia] = useState<MusicEncyclopediaData | null>(null);
  const [artistMiniProfile, setArtistMiniProfile] =
    useState<SpotifyArtistProfileData | null>(null);
  const [isMetaLoading, setIsMetaLoading] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [storyExpanded, setStoryExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsMetaLoading(true);
    setBioExpanded(false);
    setStoryExpanded(false);

    Promise.all([
      loadMusicEncyclopedia({
        artist: track.artist,
        title: track.title,
        album: track.album,
        genre: track.genre,
        year: track.year,
        lang: uiLang,
      }).catch(() => null),
      loadArtistProfileData(track.artist, track.artistId).catch(() => null),
    ])
      .then(([encData, profData]) => {
        if (cancelled) return;
        setEncyclopedia(encData);
        setArtistMiniProfile(profData);
      })
      .finally(() => {
        if (!cancelled) setIsMetaLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [track.id, track.artist, track.artistId, track.title, track.album, track.genre, track.year, uiLang]);

  const featuredDiscography = (artistMiniProfile?.albums || []).slice(0, 6);
  const activeStoryText = encyclopedia?.songStory || encyclopedia?.albumStory || '';

  return (
    <div className="space-y-5 pb-8 w-full max-w-full min-w-0 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-[#60a5fa]">
            {tr('Studio Piesă', 'Song Studio', 'Студия трека')}
          </div>
          <h1 className={`${MUSIC_TYPOGRAPHY.h1} truncate`}>{track.title}</h1>
        </div>
        {onOpenFullscreen && (
          <button
            type="button"
            onClick={onOpenFullscreen}
            className="h-10 px-4 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-[13px] font-semibold text-white transition-colors cursor-pointer"
          >
            {tr('Deschide Full-Screen', 'Open Fullscreen', 'Во весь экран')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left/Main Studio Deck */}
        <div className="lg:col-span-7 rounded-xl bg-gradient-to-b from-[#0f1d3a]/65 via-[#111622] to-[#0b0f19] border border-white/[0.08] p-4 sm:p-6 shadow-xl">
          <SongStudioCore {...props} />
        </div>

        {/* Right Side Info Cards: Artist Biography, Bibliography & Song/Album History */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl bg-[#0e121b]/95 border border-white/[0.08] p-4 sm:p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#94a3b8]">
              <span className="inline-flex items-center gap-2">
                <Users className="w-4 h-4 text-[#60a5fa]" />
                <span>{tr('Despre Artist — Biografie & Bibliografie', 'About the Artist — Biography & Works', 'Об артисте — Биография')}</span>
              </span>
              {isMetaLoading && !encyclopedia && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#60a5fa]" />
              )}
            </div>

            <div className="flex items-center gap-3.5">
              <img
                src={proxyMusicCover(
                  artistMiniProfile?.artist?.avatar || track.artistAvatar || track.cover
                )}
                alt={track.artist}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = FALLBACK_MUSIC_COVER;
                }}
                className="w-16 h-16 rounded-full object-cover ring-2 ring-white/15 shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-0.5">
                <h2 className={`${MUSIC_TYPOGRAPHY.h2} truncate`}>{track.artist}</h2>
                <p className={`${MUSIC_TYPOGRAPHY.meta} truncate`}>
                  {encyclopedia?.artistTagline || track.genre || 'Music'}
                </p>
              </div>
            </div>

            {(encyclopedia?.artistOrigin ||
              encyclopedia?.artistActiveYears ||
              encyclopedia?.artistTypeLabel ||
              (encyclopedia?.artistStyles?.length || 0) > 0) && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {encyclopedia?.artistOrigin && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-slate-200">
                    <Globe className="w-3 h-3 text-[#60a5fa]" />
                    <span>{encyclopedia.artistOrigin}</span>
                  </span>
                )}
                {encyclopedia?.artistActiveYears && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-slate-200">
                    <Calendar className="w-3 h-3 text-[#60a5fa]" />
                    <span>{encyclopedia.artistActiveYears}</span>
                  </span>
                )}
                {encyclopedia?.artistTypeLabel && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-slate-200">
                    <Users className="w-3 h-3 text-[#60a5fa]" />
                    <span>{encyclopedia.artistTypeLabel}</span>
                  </span>
                )}
                {encyclopedia?.artistStyles?.slice(0, 3).map((st) => (
                  <span
                    key={st}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1e3a8a]/35 border border-[#3b82f6]/35 text-[#60a5fa] capitalize"
                  >
                    <Award className="w-3 h-3" />
                    <span>{st}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Artist Biography */}
            <div className="space-y-1.5 pt-1 border-t border-white/[0.09]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {tr('Biografie & Istoric', 'Biography & Background', 'Биография')}
              </div>
              {isMetaLoading && !encyclopedia?.artistBio ? (
                <div className="text-xs text-[#94a3b8] py-1">
                  {tr('Se caută biografia și detaliile artistului...', 'Fetching artist biography...', 'Загрузка биографии...')}
                </div>
              ) : (
                <>
                  <p
                    className={`whitespace-pre-line text-xs sm:text-[13px] text-slate-300 leading-relaxed ${
                      bioExpanded ? '' : 'line-clamp-5'
                    }`}
                  >
                    {encyclopedia?.artistBio}
                  </p>
                  {encyclopedia?.artistBio && encyclopedia.artistBio.length > 280 && (
                    <button
                      type="button"
                      onClick={() => setBioExpanded((v) => !v)}
                      className="text-xs font-semibold text-[#60a5fa] hover:underline cursor-pointer"
                    >
                      {bioExpanded
                        ? tr('Restrânge', 'Show less', 'Свернуть')
                        : tr('Citește toată biografia', 'Read full biography', 'Читать полностью')}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Artist Bibliography / Discography */}
            {featuredDiscography.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/[0.09]">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <span>{tr('Bibliografie / Discografie Selectivă', 'Selected Discography', 'Избранная дискография')}</span>
                  {artistMiniProfile?.albums && artistMiniProfile.albums.length > 0 && (
                    <span className="text-slate-500 tabular-nums">
                      {artistMiniProfile.albums.length} {tr('lansări', 'releases', 'релизов')}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {featuredDiscography.map((alb) => (
                    <button
                      key={alb.id}
                      type="button"
                      onClick={() =>
                        props.onOpenAlbum(alb.title, alb.artist || track.artist, alb.id, track)
                      }
                      className="flex items-center gap-2.5 p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.09] text-left transition-colors cursor-pointer group"
                    >
                      <img
                        src={proxyMusicCover(alb.cover)}
                        alt={alb.title}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = FALLBACK_MUSIC_COVER;
                        }}
                        className="w-9 h-9 rounded-md object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-white group-hover:underline truncate">
                          {alb.title}
                        </div>
                        <div className="text-[11px] text-[#94a3b8] truncate capitalize">
                          {alb.year ? `${alb.year} • ` : ''}
                          {alb.recordType || 'Album'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => props.onOpenArtist(track.artist, track.artistId)}
                className="h-10 px-4 rounded-full bg-white text-black text-[13px] font-bold hover:scale-[1.03] transition-transform cursor-pointer"
              >
                {tr('Deschide Profil Artist', 'Open Artist Profile', 'Профиль артиста')}
              </button>
              <button
                type="button"
                onClick={() => props.onStartRadio(track)}
                className="h-10 px-4 rounded-full bg-[#2563eb]/15 hover:bg-[#2563eb] text-[#60a5fa] hover:text-white border border-[#60a5fa]/35 text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Radio className="w-4 h-4" />
                <span>{tr('Creează Radio Piesă', 'Create Song Radio', 'Создать Радио')}</span>
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-[#0e121b]/95 border border-white/[0.08] p-4 sm:p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#94a3b8]">
              <Disc className="w-4 h-4 text-[#60a5fa]" />
              <span>{tr('De pe albumul & Istoricul Piesei', 'From the album & Song History', 'Из альбома и история')}</span>
            </div>
            <button
              type="button"
              onClick={() =>
                props.onOpenAlbum(track.album || track.title, track.artist, track.albumId, track)
              }
              className="w-full flex items-center gap-3.5 text-left group cursor-pointer focus:outline-none rounded-lg p-1"
            >
              <img
                src={proxyMusicCover(track.cover)}
                alt={track.album}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = FALLBACK_MUSIC_COVER;
                }}
                className="w-16 h-16 rounded-lg object-cover shrink-0 shadow-lg group-hover:scale-105 transition-transform"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] sm:text-sm font-semibold text-white group-hover:underline truncate">
                  {track.album || track.title}
                </div>
                <div className="text-xs font-medium text-[#94a3b8] mt-0.5 truncate">
                  {track.year || 2025} • {track.qualityLabel || 'Lossless Audio'}
                </div>
              </div>
            </button>

            <div className="space-y-2 pt-2.5 border-t border-white/[0.09]">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <BookOpen className="w-3.5 h-3.5 text-[#60a5fa]" />
                <span>{tr('Istoricul Piesei & Contextul Lansării', 'Song History & Release Context', 'История релиза')}</span>
              </div>
              {activeStoryText ? (
                <>
                  <p
                    className={`whitespace-pre-line text-xs sm:text-[13px] text-slate-300 leading-relaxed ${
                      storyExpanded ? '' : 'line-clamp-5'
                    }`}
                  >
                    {activeStoryText}
                  </p>
                  {activeStoryText.length > 320 && (
                    <button
                      type="button"
                      onClick={() => setStoryExpanded((v) => !v)}
                      className="text-xs font-semibold text-[#60a5fa] hover:underline cursor-pointer"
                    >
                      {storyExpanded
                        ? tr('Restrânge', 'Show less', 'Свернуть')
                        : tr('Citește mai mult', 'Read more', 'Подробнее')}
                    </button>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs pt-0.5">
                  <div>
                    <span className="text-[#94a3b8]">{tr('Artist:', 'Artist:', 'Артист:')} </span>
                    <span className="text-white font-medium">{track.artist}</span>
                  </div>
                  <div>
                    <span className="text-[#94a3b8]">{tr('An lansare:', 'Released:', 'Год:')} </span>
                    <span className="text-white font-medium tabular-nums">{track.year || 2025}</span>
                  </div>
                  <div>
                    <span className="text-[#94a3b8]">{tr('Album:', 'Album:', 'Альбом:')} </span>
                    <span className="text-white font-medium truncate inline-block align-bottom max-w-[140px]">
                      {track.album || track.title}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#94a3b8]">{tr('Gen:', 'Genre:', 'Жанр:')} </span>
                    <span className="text-white font-medium">{track.genre || 'Music'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 6. PREMIUM FULL-SCREEN PLAYER OVERLAY (WITH STUDIO / LYRICS / QUEUE TABS)
// ============================================================================
export const PremiumFullscreenPlayerModal: React.FC<
  Omit<StudioTabsProps, 'compact'> & {
    sourceLabel: string;
    onClose: () => void;
  }
> = ({ sourceLabel, onClose, ...props }) => {
  const { tr, track } = props;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  return (
    <div
      data-music-root="true"
      role="dialog"
      aria-modal="true"
      aria-label="Spotify Now Playing Studio Fullscreen"
      className="fixed inset-0 z-50 w-full max-w-[100vw] bg-[#080b12] flex flex-col justify-start overflow-y-auto overflow-x-hidden overscroll-x-none touch-pan-y animate-in fade-in slide-in-from-bottom duration-300 select-none"
      style={{
        height: 'var(--ios-pwa-app-height, 100%)',
        paddingTop: 'max(14px, var(--safe-top, env(safe-area-inset-top, 14px)))',
        paddingBottom: 'var(--ios-pwa-nav-pb, max(8px, calc(env(safe-area-inset-bottom, 0px) * 0.3)))',
        paddingLeft: 'var(--safe-left, env(safe-area-inset-left, 0px))',
        paddingRight: 'var(--safe-right, env(safe-area-inset-right, 0px))',
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden -z-10"
      >
        <div
          className="absolute inset-0 opacity-40 blur-3xl transition-all duration-700"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 32%, #1e3a8a 0%, #0b0f19 68%)`,
          }}
        />
      </div>

      {/* Top Header */}
      <div className="w-full max-w-2xl min-w-0 overflow-hidden mx-auto flex items-center justify-between px-4 sm:px-8 pt-1 pb-2 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full inline-flex items-center justify-center shrink-0 text-white/85 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer touch-manipulation focus:outline-none"
          aria-label={tr('Minimizează', 'Minimize', 'Свернуть')}
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center text-center px-3 min-w-0">
          <span className="text-xs font-medium text-[#94a3b8] truncate max-w-[58vw] sm:max-w-xs">
            {sourceLabel}
          </span>
          <button
            type="button"
            onClick={() => {
              onClose();
              props.onOpenAlbum(track.album || track.title, track.artist, track.albumId, track);
            }}
            className="text-[13px] font-semibold text-white hover:underline truncate max-w-[58vw] sm:max-w-xs cursor-pointer"
          >
            {track.album || track.artist}
          </button>
        </div>

        <div className="min-w-[2.5rem] shrink-0 flex items-center justify-end">
          {track.qualityTier && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/15 text-[#60a5fa]">
              {track.qualityTier}
            </span>
          )}
        </div>
      </div>

      {/* Main Studio Body */}
      <div className="flex-1 w-full max-w-xl min-w-0 mx-auto px-3 sm:px-6 py-1 sm:py-2 min-h-0 overflow-x-hidden flex flex-col">
        <SongStudioCore
          {...props}
          compact
          onOpenArtist={(name, artistId) => {
            onClose();
            props.onOpenArtist(name, artistId);
          }}
          onOpenAlbum={(alb, art, albId, trk) => {
            onClose();
            props.onOpenAlbum(alb, art, albId, trk);
          }}
          onStartRadio={(trk) => {
            onClose();
            props.onStartRadio(trk);
          }}
          onToggleVideoClip={() => {
            props.onToggleVideoClip();
            onClose();
          }}
        />
      </div>
    </div>
  );
};

// ============================================================================
// 7. ACCESSIBLE LIGHT-DISMISS TRACK ACTION MENU (<dialog closedby="any">)
// ============================================================================
export const TrackQuickActionsDialog: React.FC<{
  tr: TrFn;
  track: SpotifyTrackItem | null;
  isLiked: boolean;
  onClose: () => void;
  onPlayNow: (track: SpotifyTrackItem) => void;
  onPlayNext: (track: SpotifyTrackItem) => void;
  onStartRadio: (track: SpotifyTrackItem) => void;
  onOpenSongStudio: (track: SpotifyTrackItem) => void;
  onOpenArtist: (name: string, artistId?: string) => void;
  onOpenAlbum: (album: string, artist: string, albumId?: string, track?: SpotifyTrackItem) => void;
  onToggleLike: (track: SpotifyTrackItem) => void;
}> = ({
  tr,
  track,
  isLiked,
  onClose,
  onPlayNow,
  onPlayNext,
  onStartRadio,
  onOpenSongStudio,
  onOpenArtist,
  onOpenAlbum,
  onToggleLike,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (track) {
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          // ignore if already open
        }
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [track]);

  // Mandatory Safari light-dismiss fallback for browsers lacking <dialog closedby="any">
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || 'closedBy' in HTMLDialogElement.prototype) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isDialogContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (!isDialogContent) {
        dialog.close();
      }
    };

    dialog.addEventListener('click', handleClickOutside);
    return () => dialog.removeEventListener('click', handleClickOutside);
  }, []);

  const offline = useOfflineMusicState();
  const isOffline = track ? offline.isOffline(track) : false;
  const isDownloading = track ? offline.getProgress(track) !== null : false;

  if (!track) {
    return (
      <dialog
        ref={dialogRef}
        {...({ closedby: 'any' } as Record<string, string>)}
        aria-labelledby="track-actions-dialog-title"
        className="hidden"
      />
    );
  }

  const actions: Array<{
    label: string;
    icon: React.FC<{ className?: string }>;
    accent?: boolean;
    onClick: () => void;
  }> = [
    {
      label: tr('Redă acum', 'Play now', 'Слушать сейчас'),
      icon: Play,
      accent: true,
      onClick: () => {
        onPlayNow(track);
        onClose();
      },
    },
    {
      label: tr('Redă următoarea în coadă', 'Play next in queue', 'Следующим в очередь'),
      icon: Plus,
      onClick: () => {
        onPlayNext(track);
        onClose();
      },
    },
    {
      label: isOffline
        ? tr('Elimină din descărcări offline', 'Remove offline download', 'Удалить из загрузок')
        : isDownloading
        ? tr('Anulează descărcarea', 'Cancel download', 'Отменить загрузку')
        : tr('Descarcă piesa offline', 'Download track offline', 'Скачать трек офлайн'),
      icon: isOffline ? Trash2 : ArrowDownToLine,
      accent: !isOffline,
      onClick: () => {
        void toggleTrackOffline(track);
        onClose();
      },
    },
    {
      label: tr('Pornește Radio pentru piesă', 'Go to Song Radio', 'Радио по треку'),
      icon: Radio,
      accent: true,
      onClick: () => {
        onStartRadio(track);
        onClose();
      },
    },
    {
      label: tr('Vezi Piesa & Versuri Live', 'Song Studio & Live Lyrics', 'Текст и Студия'),
      icon: Mic2,
      onClick: () => {
        onOpenSongStudio(track);
        onClose();
      },
    },
    {
      label: tr(`Mergi la Artist: ${track.artist}`, `Go to Artist: ${track.artist}`, `К артисту: ${track.artist}`),
      icon: User,
      onClick: () => {
        onOpenArtist(track.artist, track.artistId);
        onClose();
      },
    },
    {
      label: tr(`Mergi la Album: ${track.album || track.title}`, `Go to Album: ${track.album || track.title}`, `К альбому`),
      icon: Disc,
      onClick: () => {
        onOpenAlbum(track.album || track.title, track.artist, track.albumId, track);
        onClose();
      },
    },
    {
      label: isLiked
        ? tr('Elimină din Melodii îndrăgite', 'Remove from Liked Songs', 'Удалить из Любимых')
        : tr('Adaugă la Melodii îndrăgite', 'Save to Liked Songs', 'Добавить в Любимые'),
      icon: Heart,
      onClick: () => {
        onToggleLike(track);
        onClose();
      },
    },
  ];

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as Record<string, string>)}
      aria-labelledby="track-actions-dialog-title"
      onClose={onClose}
      onCancel={(e) => {
        e.stopPropagation();
      }}
      className="m-auto w-[92vw] max-w-md rounded-2xl bg-[#0e1320] text-white border border-white/15 p-0 shadow-[0_24px_64px_rgba(0,0,0,0.9)] backdrop:bg-black/75 backdrop:backdrop-blur-sm overflow-hidden"
    >
      <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3 bg-white/[0.03]">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <img
            src={proxyMusicCover(track.coverSmall || track.cover)}
            alt={track.title}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = FALLBACK_MUSIC_COVER;
            }}
            className="w-12 h-12 rounded-lg object-cover shrink-0 shadow"
          />
          <div className="min-w-0">
            <h3 id="track-actions-dialog-title" className="text-sm font-black text-white truncate">
              {track.title}
            </h3>
            <p className="text-xs text-[#cbd5e1] truncate">{track.artist}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white inline-flex items-center justify-center cursor-pointer shrink-0"
          aria-label={tr('Închide', 'Close', 'Закрыть')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-2 divide-y divide-white/[0.04]">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.label}
              type="button"
              onClick={act.onClick}
              className="w-full px-3.5 py-3 rounded-xl flex items-center gap-3 text-left text-xs sm:text-sm font-semibold hover:bg-white/[0.08] focus:outline-none transition-colors cursor-pointer"
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  act.accent ? 'text-[#60a5fa]' : 'text-[#cbd5e1]'
                }`}
              />
              <span className="truncate">{act.label}</span>
            </button>
          );
        })}
      </div>
    </dialog>
  );
};
