import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  ChevronDown,
  Disc,
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
      className={`w-[3px] rounded-full bg-[#1ed760] ${
        active ? 'eq-bar h-3.5' : 'h-1.5 opacity-60'
      }`}
    />
    <span
      className={`w-[3px] rounded-full bg-[#1ed760] ${
        active ? 'eq-bar eq-bar-2 h-3' : 'h-2 opacity-60'
      }`}
    />
    <span
      className={`w-[3px] rounded-full bg-[#1ed760] ${
        active ? 'eq-bar eq-bar-3 h-2.5' : 'h-1 opacity-60'
      }`}
    />
  </span>
);

export const ViewBackBar: React.FC<{
  tr: TrFn;
  label: string;
  onBack: () => void;
  rightSlot?: React.ReactNode;
}> = ({ tr, label, onBack, rightSlot }) => (
  <div className="flex items-center justify-between gap-3 pb-1">
    <button
      type="button"
      onClick={onBack}
      className="h-9 pl-2.5 pr-4 rounded-full bg-white/[0.08] hover:bg-white/[0.16] focus:bg-white focus:text-black text-white text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-white"
    >
      <ArrowLeft className="w-4 h-4" />
      <span>{tr('Înapoi', 'Back', 'Назад')}</span>
      <span className="text-white/40 hidden sm:inline">•</span>
      <span className="text-[#b3b3b3] font-medium truncate max-w-[180px] sm:max-w-xs hidden sm:inline">
        {label}
      </span>
    </button>
    {rightSlot}
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
  onOpenSongStudio,
  onOpenTrackMenu,
}) => {
  const cleanAlbumTitle =
    track.album && track.album !== track.title ? track.album : 'Single';

  return (
    <div
      className={`group px-2.5 sm:px-4 py-2 rounded-xl grid items-center gap-2 sm:gap-3 transition-colors ${
        showAlbum
          ? 'grid-cols-[26px_1fr_auto] md:grid-cols-[30px_1.6fr_1fr_auto]'
          : 'grid-cols-[26px_1fr_auto]'
      } ${isCurrent ? 'bg-white/[0.11]' : 'hover:bg-white/[0.06]'}`}
    >
      {/* Index / Equalizer / Play */}
      <button
        type="button"
        onClick={onPlay}
        title={tr('Redă piesa', 'Play track', 'Слушать')}
        className="w-7 h-7 inline-flex items-center justify-center text-xs tabular-nums cursor-pointer focus:outline-none focus:ring-2 focus:ring-white rounded"
      >
        {isCurrent && isPlaying ? (
          <EqualizerBars active />
        ) : isCurrent ? (
          <Play className="w-3.5 h-3.5 text-[#1ed760] fill-current" />
        ) : (
          <>
            <span className="text-[#b3b3b3] group-hover:hidden">{index + 1}</span>
            <Play className="w-3.5 h-3.5 text-white fill-current hidden group-hover:block" />
          </>
        )}
      </button>

      {/* Cover + Song Title + Clickable Artist */}
      <div className="flex items-center gap-3 min-w-0">
        {showCover && (
          <button
            type="button"
            onClick={onPlay}
            className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-md overflow-hidden shrink-0 bg-zinc-900 shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-white"
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
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={onPlay}
              className={`text-left text-xs sm:text-sm font-semibold truncate hover:underline cursor-pointer focus:outline-none ${
                isCurrent ? 'text-[#1ed760]' : 'text-white'
              }`}
            >
              {track.title}
            </button>
            {track.qualityTier === 'MAX' && (
              <span className="hidden lg:inline-flex shrink-0 text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded bg-[#1ed760]/15 text-[#1ed760]">
                MAX
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-[#b3b3b3] min-w-0 mt-0.5">
            <button
              type="button"
              onClick={() => onOpenArtist(track.artist, track.artistId)}
              className="hover:text-white hover:underline truncate cursor-pointer focus:outline-none text-left"
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
            className="text-xs text-[#b3b3b3] hover:text-white hover:underline truncate block max-w-full text-left cursor-pointer focus:outline-none"
          >
            {cleanAlbumTitle}
          </button>
        </div>
      )}

      {/* Right Actions: Song Studio / Song Radio / Heart / Duration / More (•••) */}
      <div className="flex items-center justify-end gap-0.5 sm:gap-1.5 shrink-0">
        <button
          type="button"
          title={tr('Radio Piesă', 'Song Radio', 'Радио трека')}
          onClick={() => onStartRadio(track)}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full inline-flex items-center justify-center text-[#b3b3b3] hover:text-[#1ed760] hover:bg-white/10 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-white"
        >
          <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        <button
          type="button"
          title={tr('Versuri & Studio Piesă', 'Song & Live Lyrics', 'Текст и Студия')}
          onClick={() => onOpenSongStudio(track)}
          className="hidden sm:inline-flex w-8 h-8 rounded-full items-center justify-center text-[#b3b3b3] hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-white"
        >
          <Mic2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          title={tr('Adaugă la favorite', 'Save to Liked Songs', 'В Любимые')}
          onClick={onToggleLike}
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full inline-flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-white ${
            isLiked
              ? 'text-[#1ed760]'
              : 'text-[#b3b3b3] sm:opacity-75 group-hover:opacity-100 hover:text-white'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLiked ? 'fill-current' : ''}`} />
        </button>

        <span className="hidden sm:inline-block text-xs text-[#b3b3b3] tabular-nums w-10 text-right">
          {formatMusicDuration(track.durationSec)}
        </span>

        <button
          type="button"
          title={tr('Opțiuni piesă', 'More options', 'Ещё')}
          onClick={() => onOpenTrackMenu(track)}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full inline-flex items-center justify-center text-[#b3b3b3] hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-white"
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
  onBack,
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

  const artistName = data?.artist?.name || artistNameFallback;
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
    <div className="space-y-6 pb-8">
      <ViewBackBar tr={tr} label={artistName} onBack={onBack} />

      {/* Artist Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900/50 via-[#1b1b1f] to-[#121212] border border-white/10 p-5 sm:p-7 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 sm:gap-7">
          <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden ring-4 ring-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.65)] shrink-0 bg-zinc-900">
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

          <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/15 border border-sky-400/30 text-sky-300 text-[11px] font-bold">
              <BadgeCheck className="w-4 h-4 text-sky-400" />
              <span>{tr('Artist Verificat', 'Verified Artist', 'Подтвержденный артист')}</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight truncate">
              {artistName}
            </h1>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-xs sm:text-sm text-[#b3b3b3]">
              {fansLabel && (
                <span>
                  <strong className="text-white">{fansLabel}</strong>{' '}
                  {tr('ascultători & fani', 'listeners & fans', 'слушателей')}
                </span>
              )}
              {albums.length > 0 && (
                <>
                  <span>•</span>
                  <span>
                    {albums.length} {tr('lansări & albume', 'releases', 'релизов')}
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-2">
              <button
                type="button"
                disabled={topTracks.length === 0}
                onClick={() => topTracks[0] && onPlayTrack(topTracks[0], topTracks)}
                style={{ backgroundColor: '#1ed760', color: '#000000' }}
                className="h-11 px-6 rounded-full bg-[#1ed760] hover:scale-105 disabled:opacity-50 text-black font-black text-xs sm:text-sm inline-flex items-center gap-2 shadow-xl transition-transform cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current text-black" />
                <span>{tr('Redă', 'Play', 'Слушать')}</span>
              </button>

              <button
                type="button"
                onClick={onToggleShuffle}
                className={`h-11 px-4 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  isShuffle
                    ? 'bg-[#1ed760]/15 border-[#1ed760]/40 text-[#1ed760]'
                    : 'bg-white/[0.06] border-white/15 text-white hover:bg-white/15'
                }`}
              >
                <Shuffle className="w-4 h-4" />
                <span>Shuffle</span>
              </button>

              {topTracks[0] && (
                <button
                  type="button"
                  onClick={() => onStartRadio(topTracks[0])}
                  className="h-11 px-4 rounded-full bg-white/[0.06] hover:bg-[#1ed760] hover:text-black border border-white/15 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Radio className="w-4 h-4" />
                  <span>{tr('Radio Artist', 'Artist Radio', 'Радио артиста')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="py-10 flex items-center justify-center gap-2 text-sm text-[#b3b3b3]">
          <Loader2 className="w-5 h-5 animate-spin text-[#1ed760]" />
          <span>{tr('Se încarcă profilul artistului...', 'Loading artist profile...', 'Загрузка профиля...')}</span>
        </div>
      ) : (
        <>
          {/* Popular Tracks */}
          {topTracks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight">
                  {tr('Populare', 'Popular', 'Популярные треки')}
                </h2>
                {topTracks.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllPopular((v) => !v)}
                    className="text-xs font-bold text-[#b3b3b3] hover:text-white cursor-pointer"
                  >
                    {showAllPopular
                      ? tr('Afișează mai puțin', 'Show less', 'Свернуть')
                      : `${tr('Vezi toate', 'See all', 'Показать все')} (${topTracks.length})`}
                  </button>
                )}
              </div>

              <div className="rounded-2xl bg-[#181818]/90 border border-white/[0.06] p-2 sm:p-3 space-y-0.5">
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
          )}

          {/* Discography */}
          {albums.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight">
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
                      className={`h-7 px-3 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                        discogFilter === val
                          ? 'bg-white text-black'
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                {filteredAlbums.slice(0, 12).map((alb) => (
                  <button
                    key={alb.id}
                    type="button"
                    onClick={() => onOpenAlbum(alb.title, alb.artist || artistName, alb.id)}
                    className="p-3 rounded-xl bg-[#181818] hover:bg-[#282828] focus:outline-none focus:ring-2 focus:ring-white transition-colors text-left group cursor-pointer flex flex-col"
                  >
                    <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-3 shadow-lg bg-zinc-900">
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
                    <div className="text-xs sm:text-sm font-bold text-white truncate">
                      {alb.title}
                    </div>
                    <div className="text-[11px] text-[#a7a7a7] truncate mt-0.5 capitalize">
                      {alb.year ? `${alb.year} • ` : ''}
                      {alb.recordType || 'Album'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Related Artists */}
          {relatedArtists.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight">
                {tr('Fanii mai ascultă și', 'Fans also like', 'Похожие артисты')}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                {relatedArtists.slice(0, 6).map((rel) => (
                  <button
                    key={rel.id}
                    type="button"
                    onClick={() => onOpenArtist(rel.name, rel.id)}
                    className="p-3 rounded-xl bg-[#181818] hover:bg-[#282828] focus:outline-none focus:ring-2 focus:ring-white transition-colors text-center group cursor-pointer flex flex-col items-center"
                  >
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden mb-3 shadow-xl bg-zinc-900 ring-2 ring-white/5">
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
                    <div className="text-xs sm:text-sm font-bold text-white truncate w-full">
                      {rel.name}
                    </div>
                    <div className="text-[11px] text-[#a7a7a7] mt-0.5">
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
  onBack,
  onPlayTrack,
  onToggleShuffle,
  onToggleLikeTrack,
  onOpenArtist,
  onOpenAlbum,
  onStartRadio,
  onOpenSongStudio,
  onOpenTrackMenu,
}) => {
  if (!album) return null;

  return (
    <div className="space-y-6 pb-8">
      <ViewBackBar tr={tr} label={album.albumTitle} onBack={onBack} />

      <div className="rounded-2xl bg-gradient-to-b from-[#2a2a32] via-[#181818] to-[#121212] p-4 sm:p-6 border border-white/10 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 sm:gap-6">
          <img
            src={proxyMusicCover(album.coverUrl)}
            alt={album.albumTitle}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = FALLBACK_MUSIC_COVER;
            }}
            className="w-36 h-36 sm:w-48 sm:h-48 rounded-xl object-cover shadow-[0_14px_40px_rgba(0,0,0,0.75)] shrink-0 bg-zinc-900"
          />
          <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                {album.recordType === 'single'
                  ? 'Single'
                  : album.recordType === 'ep'
                  ? 'EP'
                  : tr('Album', 'Album', 'Альбом')}
              </span>
              <span className="text-[10px] font-black tracking-wider px-2 py-0.5 rounded-full bg-[#1ed760]/15 text-[#1ed760] border border-[#1ed760]/30">
                MAX • 24-bit / 192 kHz FLAC
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white leading-tight truncate">
              {album.albumTitle}
            </h1>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs sm:text-sm text-[#b3b3b3]">
              <button
                type="button"
                onClick={() => onOpenArtist(album.artistName, album.artistId)}
                className="inline-flex items-center gap-2 font-bold text-white hover:underline cursor-pointer"
              >
                {album.artistAvatar && (
                  <img
                    src={proxyMusicCover(album.artistAvatar)}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = FALLBACK_MUSIC_COVER;
                    }}
                    className="w-6 h-6 rounded-full object-cover"
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

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-2">
              <button
                type="button"
                disabled={album.tracks.length === 0}
                onClick={() => album.tracks[0] && onPlayTrack(album.tracks[0], album.tracks)}
                style={{ backgroundColor: '#1ed760', color: '#000000' }}
                className="h-11 px-6 rounded-full bg-[#1ed760] hover:scale-105 text-black font-black text-xs sm:text-sm inline-flex items-center gap-2 shadow-xl transition-transform cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current text-black" />
                <span>{tr('Redă Albumul', 'Play Album', 'Слушать альбом')}</span>
              </button>

              <button
                type="button"
                onClick={onToggleShuffle}
                className={`h-11 px-4 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  isShuffle
                    ? 'bg-[#1ed760]/15 border-[#1ed760]/40 text-[#1ed760]'
                    : 'bg-white/[0.06] border-white/15 text-white hover:bg-white/15'
                }`}
              >
                <Shuffle className="w-4 h-4" />
                <span>Shuffle</span>
              </button>

              {album.tracks[0] && (
                <button
                  type="button"
                  onClick={() => onStartRadio(album.tracks[0])}
                  className="h-11 px-4 rounded-full bg-white/[0.06] hover:bg-[#1ed760] hover:text-black border border-white/15 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Radio className="w-4 h-4" />
                  <span>{tr('Radio Album', 'Album Radio', 'Радио альбома')}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-[#b3b3b3]">
            <Loader2 className="w-4 h-4 animate-spin text-[#1ed760]" />
            <span>
              {tr('Se încarcă melodiile albumului...', 'Loading album tracks...', 'Загрузка треков...')}
            </span>
          </div>
        ) : (
          <div className="space-y-0.5 pt-2 border-t border-white/10">
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
        )}

        {(album.label || album.copyright) && (
          <div className="pt-3 border-t border-white/5 text-[11px] text-[#7c7c85] space-y-0.5">
            {album.releaseDateText && <div>{album.releaseDateText}</div>}
            <div>{album.label || album.copyright}</div>
          </div>
        )}
      </div>

      {/* More Albums by Artist */}
      {album.moreAlbums && album.moreAlbums.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg sm:text-xl font-extrabold text-white">
            {tr(`Mai multe de la ${album.artistName}`, `More by ${album.artistName}`, `Другие релизы ${album.artistName}`)}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {album.moreAlbums.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onOpenAlbum(m.title, m.artist, m.id)}
                className="p-3 rounded-xl bg-[#181818] hover:bg-[#282828] focus:outline-none focus:ring-2 focus:ring-white transition-colors text-left group cursor-pointer flex flex-col"
              >
                <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-2.5 bg-zinc-900">
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
                <div className="text-xs font-bold text-white truncate">{m.title}</div>
                <div className="text-[11px] text-[#a7a7a7] truncate">
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
  onBack,
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
    <div className="space-y-6 pb-8">
      <ViewBackBar
        tr={tr}
        label={radioData?.title || tr('Radio Piesă', 'Song Radio', 'Радио трека')}
        onBack={onBack}
      />

      {/* Radio Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700/45 via-teal-900/35 to-[#121212] border border-[#1ed760]/25 p-5 sm:p-7 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 sm:gap-6">
          <div className="relative w-32 h-32 sm:w-44 sm:h-44 shrink-0 flex items-center justify-center">
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-2xl border-2 border-[#1ed760]/40 animate-ping opacity-30"
            />
            <img
              src={proxyMusicCover(radioData?.seedCover)}
              alt={radioData?.seedTrack.title || 'Radio'}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = FALLBACK_MUSIC_COVER;
              }}
              className="relative w-full h-full rounded-2xl object-cover shadow-[0_14px_40px_rgba(0,0,0,0.75)] bg-zinc-900"
            />
            <span className="absolute -bottom-2 -right-2 px-2.5 py-1 rounded-full bg-[#1ed760] text-black text-[10px] font-black tracking-wider inline-flex items-center gap-1 shadow-lg">
              <Radio className="w-3 h-3" />
              RADIO
            </span>
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#1ed760]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{tr('Playlist Radio Generat Instant', 'Instant Generated Radio Mix', 'Персональный Радио-Микс')}</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white truncate">
              {radioData?.title || tr('Se generează Radio...', 'Generating Radio...', 'Создание радио...')}
            </h1>

            <p className="text-xs sm:text-sm text-white/80 line-clamp-2">
              {radioData?.subtitle || ''}{' '}
              {tracks.length > 0 && (
                <span className="text-[#b3b3b3]">
                  • {tracks.length} {tr('melodii similare', 'similar songs', 'похожих треков')}
                </span>
              )}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-2">
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
                style={{ backgroundColor: '#1ed760', color: '#000000' }}
                className="h-11 px-6 rounded-full bg-[#1ed760] hover:scale-105 disabled:opacity-50 text-black font-black text-xs sm:text-sm inline-flex items-center gap-2 shadow-xl transition-transform cursor-pointer"
              >
                {isPlayingFromThisRadio && isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-current text-black" />
                    <span>{tr('Pauză Mix', 'Pause Mix', 'Пауза')}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current text-black" />
                    <span>{tr('Redă Mixul', 'Play Radio', 'Слушать микс')}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onToggleShuffle}
                className={`h-11 px-4 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  isShuffle
                    ? 'bg-[#1ed760]/15 border-[#1ed760]/40 text-[#1ed760]'
                    : 'bg-white/[0.06] border-white/15 text-white hover:bg-white/15'
                }`}
              >
                <Shuffle className="w-4 h-4" />
                <span>Shuffle</span>
              </button>

              <button
                type="button"
                onClick={onRegenerateRadio}
                className="h-11 px-4 rounded-full bg-white/[0.06] hover:bg-white/15 border border-white/15 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{tr('Regenerează Mixul', 'Refresh Mix', 'Обновить микс')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {isLoading && tracks.length === 0 ? (
        <div className="py-10 flex items-center justify-center gap-2 text-sm text-[#b3b3b3]">
          <Loader2 className="w-5 h-5 animate-spin text-[#1ed760]" />
          <span>
            {tr('Construim playlistul tău radio personalizat...', 'Building your personalized song radio...', 'Собираем ваш радио-плейлист...')}
          </span>
        </div>
      ) : (
        <div className="rounded-2xl bg-[#181818]/90 border border-white/[0.06] p-2 sm:p-3 space-y-0.5">
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
  initialTab?: 'studio' | 'lyrics' | 'queue';
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
  const [activeTab, setActiveTab] = useState<'studio' | 'lyrics' | 'queue'>(initialTab);
  const [isVinylMode, setIsVinylMode] = useState(false);
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
        className="relative h-4 flex items-center cursor-pointer group focus:outline-none"
      >
        <div className="relative w-full h-1.5 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-white group-hover:bg-[#1ed760] transition-colors"
            style={{ width: `${isThisTrackCurrent ? progressPct : 0}%` }}
          />
        </div>
        <div
          className="pointer-events-none absolute w-3.5 h-3.5 rounded-full bg-white shadow -ml-1.5 opacity-90 group-hover:opacity-100 transition-opacity"
          style={{ left: `${isThisTrackCurrent ? progressPct : 0}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-[#a7a7a7] tabular-nums font-medium">
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
        className={`w-10 h-10 rounded-full inline-flex items-center justify-center cursor-pointer transition-colors ${
          isShuffle ? 'text-[#1ed760]' : 'text-white/60 hover:text-white'
        }`}
        title={tr('Amestecare', 'Shuffle', 'Перемешать')}
      >
        <Shuffle className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={() => onSeek(Math.max(0, elapsedSec - 10))}
          className="hidden sm:inline-flex w-9 h-9 rounded-full items-center justify-center text-white/70 hover:text-white cursor-pointer"
          title="-10s"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onPrevTrack}
          className="w-11 h-11 rounded-full inline-flex items-center justify-center text-white hover:text-white/80 active:scale-95 transition-all cursor-pointer"
          title={tr('Piesa anterioară', 'Previous', 'Предыдущий трек')}
        >
          <SkipBack className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
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
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white text-black inline-flex items-center justify-center shadow-xl active:scale-95 hover:scale-105 transition-all cursor-pointer shrink-0"
          title={isActivelyPlayingThis ? 'Pause' : 'Play'}
        >
          {isActivelyPlayingThis ? (
            <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-current text-black" />
          ) : (
            <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current text-black ml-0.5" />
          )}
        </button>

        <button
          type="button"
          onClick={onNextTrack}
          className="w-11 h-11 rounded-full inline-flex items-center justify-center text-white hover:text-white/80 active:scale-95 transition-all cursor-pointer"
          title={tr('Piesa următoare', 'Next', 'Следующий трек')}
        >
          <SkipForward className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
        </button>

        <button
          type="button"
          onClick={() => onSeek(Math.min(effectiveDuration, elapsedSec + 10))}
          className="hidden sm:inline-flex w-9 h-9 rounded-full items-center justify-center text-white/70 hover:text-white cursor-pointer"
          title="+10s"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={onToggleRepeat}
        className={`w-10 h-10 rounded-full inline-flex items-center justify-center cursor-pointer transition-colors ${
          isRepeat ? 'text-[#1ed760]' : 'text-white/60 hover:text-white'
        }`}
        title={tr('Repetare', 'Repeat', 'Повтор')}
      >
        <Repeat className="w-5 h-5" />
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0 space-y-4">
      {/* Studio Tabs Switcher */}
      <div
        role="tablist"
        aria-label={tr('Moduri Player Muzică', 'Music Player Modes', 'Режимы плеера')}
        className="flex items-center justify-center gap-1.5 p-1 rounded-full bg-white/[0.08] border border-white/10 w-fit mx-auto shrink-0"
      >
        {(
          [
            ['studio', Mic2, tr('Studio', 'Studio', 'Студия'), false],
            ['lyrics', Sparkles, tr('Versuri Live', 'Live Lyrics', 'Текст Live'), false],
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
              className={`h-8 px-3.5 sm:px-4 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-white ${
                selected
                  ? 'bg-white text-black shadow'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: STUDIO VIEW */}
      {activeTab === 'studio' && (
        <div
          role="tabpanel"
          className="flex-1 flex flex-col justify-between space-y-4 min-h-0"
        >
          {/* Artwork / Spinning Vinyl */}
          <div className="flex flex-col items-center justify-center gap-3 py-1">
            <div className="relative">
              {isVinylMode ? (
                <div
                  className={`relative ${
                    compact ? 'w-56 h-56 sm:w-64 sm:h-64' : 'w-60 h-60 sm:w-72 sm:h-72'
                  } rounded-full bg-gradient-to-br from-zinc-800 via-black to-zinc-900 p-3 shadow-[0_24px_60px_rgba(0,0,0,0.85)] border border-white/15 flex items-center justify-center ${
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
                    className="w-36 h-36 sm:w-44 sm:h-44 rounded-full object-cover ring-4 ring-black shadow-2xl"
                  />
                  <span className="absolute w-4 h-4 rounded-full bg-[#121212] border border-white/30" />
                </div>
              ) : (
                <div
                  className={`relative ${
                    compact ? 'w-60 h-60 sm:w-72 sm:h-72' : 'w-64 h-64 sm:w-80 sm:h-80'
                  } rounded-2xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.85)] border border-white/10 bg-zinc-900`}
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
                    <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/15 inline-flex items-center gap-2">
                      <EqualizerBars active />
                      <span className="text-[10px] font-bold text-[#1ed760] tracking-wider uppercase">
                        LIVE STREAM
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsVinylMode((v) => !v)}
              className="h-7 px-3 rounded-full bg-white/[0.07] hover:bg-white/[0.15] text-[11px] font-semibold text-white/85 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Disc className={`w-3.5 h-3.5 ${isVinylMode ? 'text-[#1ed760]' : ''}`} />
              <span>
                {isVinylMode
                  ? tr('Copertă HD', 'Cover Art', 'Обложка HD')
                  : tr('Mod Vinil Rotativ', 'Spinning Vinyl', 'Режим Винила')}
              </span>
            </button>
          </div>

          {/* Track Meta + Clickable Artist/Album + Heart */}
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-white truncate tracking-tight">
                  {track.title}
                </h2>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-[#b3b3b3]">
                  <button
                    type="button"
                    onClick={() => onOpenArtist(track.artist, track.artistId)}
                    className="font-bold text-white hover:text-[#1ed760] hover:underline truncate cursor-pointer text-left"
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
                        className="hover:text-white hover:underline truncate cursor-pointer text-left"
                      >
                        {track.album}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onToggleLikeTrack(track)}
                className={`w-10 h-10 rounded-full inline-flex items-center justify-center cursor-pointer transition-transform active:scale-90 shrink-0 ${
                  isLiked ? 'text-[#1ed760]' : 'text-white/60 hover:text-white'
                }`}
                aria-label="Like Track"
              >
                <Heart className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
              </button>
            </div>

            {renderScrubber()}
            {renderTransport()}

            {/* Action Navigation Chips: Artist / Album / Song Radio / Video Clip */}
            <div className="flex flex-wrap items-center justify-center sm:justify-between gap-2 pt-2 border-t border-white/10">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenArtist(track.artist, track.artistId)}
                  className="h-8 px-3 rounded-full bg-white/[0.08] hover:bg-white hover:text-black text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>{tr('Vezi Artistul', 'Artist', 'Исполнитель')}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onOpenAlbum(track.album || track.title, track.artist, track.albumId, track)
                  }
                  className="h-8 px-3 rounded-full bg-white/[0.08] hover:bg-white hover:text-black text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Disc className="w-3.5 h-3.5" />
                  <span>{tr('Vezi Albumul', 'Album', 'Альбом')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onStartRadio(track)}
                  className="h-8 px-3 rounded-full bg-[#1ed760]/15 hover:bg-[#1ed760] text-[#1ed760] hover:text-black border border-[#1ed760]/30 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>{tr('Radio Piesă', 'Song Radio', 'Радио трека')}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#b3b3b3]">
                  <span className="w-2 h-2 rounded-full bg-[#1ed760]" />
                  {track.qualityLabel || 'MAX • 24-bit FLAC'}
                </span>
                <button
                  type="button"
                  onClick={onToggleVideoClip}
                  className={`h-8 px-3 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                    isVideoClipMode
                      ? 'bg-[#1ed760] text-black'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>{isVideoClipMode ? tr('Clip Activ', 'Clip On', 'Клип') : 'Video HD'}</span>
                </button>
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
              <div className="text-sm font-bold text-white truncate">{track.title}</div>
              <div className="text-xs text-[#b3b3b3] truncate">{track.artist}</div>
            </div>
            {syncedLines.length > 0 && (
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#1ed760]/15 text-[#1ed760] border border-[#1ed760]/30 shrink-0">
                SYNCED KARAOKE
              </span>
            )}
          </div>

          <div
            ref={lyricsContainerRef}
            className={`flex-1 overflow-y-auto rounded-2xl bg-gradient-to-b from-emerald-950/40 via-[#181818] to-[#121212] border border-white/10 p-5 sm:p-7 space-y-3 ${
              compact ? 'min-h-[280px] max-h-[55vh]' : 'min-h-[340px] max-h-[480px]'
            }`}
          >
            {lyricsLoading ? (
              <div className="h-full min-h-[220px] flex flex-col items-center justify-center gap-3 text-xs text-[#b3b3b3]">
                <Loader2 className="w-6 h-6 animate-spin text-[#1ed760]" />
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
                    className={`block w-full text-left font-extrabold transition-all duration-300 cursor-pointer rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white ${
                      isActive
                        ? 'text-xl sm:text-2xl text-white scale-[1.01] bg-white/[0.06]'
                        : isPast
                        ? 'text-base sm:text-lg text-white/45 hover:text-white/80'
                        : 'text-base sm:text-lg text-white/70 hover:text-white'
                    }`}
                  >
                    {line.text}
                  </button>
                );
              })
            ) : plainLyrics ? (
              <div className="whitespace-pre-line text-base sm:text-lg font-bold text-white/85 leading-relaxed">
                {plainLyrics}
              </div>
            ) : (
              <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center gap-2 text-[#b3b3b3]">
                <Mic2 className="w-8 h-8 opacity-40" />
                <div className="text-sm font-bold text-white">
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

      {/* TAB 3: LIVE QUEUE */}
      {activeTab === 'queue' && (
        <div
          role="tabpanel"
          className="flex-1 flex flex-col min-h-0 space-y-3"
        >
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="text-xs font-bold uppercase tracking-wider text-[#b3b3b3]">
              {tr('Urmează în redare', 'Playing Next', 'Далее в очереди')} ({queue.length})
            </div>
            <button
              type="button"
              onClick={() => onStartRadio(currentTrack || track)}
              className="h-7 px-3 rounded-full bg-[#1ed760]/15 hover:bg-[#1ed760] text-[#1ed760] hover:text-black text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Radio className="w-3 h-3" />
              <span>{tr('Radio după piesa curentă', 'Radio from current', 'Радио по треку')}</span>
            </button>
          </div>

          <div
            className={`flex-1 overflow-y-auto rounded-2xl bg-[#181818]/90 border border-white/10 p-2 space-y-1 ${
              compact ? 'min-h-[280px] max-h-[55vh]' : 'min-h-[340px] max-h-[480px]'
            }`}
          >
            {queue.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#b3b3b3]">
                {tr('Coada de redare este goală.', 'Queue is empty.', 'Очередь пуста.')}
              </div>
            ) : (
              queue.map((qTrack, idx) => {
                const isCur = currentTrack?.id === qTrack.id;
                return (
                  <div
                    key={`q_${qTrack.id}_${idx}`}
                    className={`px-2.5 py-2 rounded-xl flex items-center justify-between gap-2.5 transition-colors ${
                      isCur ? 'bg-white/[0.14]' : 'hover:bg-white/[0.06]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onPlayTrack(qTrack, queue)}
                      className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer"
                    >
                      <span className="w-5 text-center text-xs text-[#b3b3b3]">
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
                          className={`text-xs sm:text-sm font-bold truncate ${
                            isCur ? 'text-[#1ed760]' : 'text-white'
                          }`}
                        >
                          {qTrack.title}
                        </div>
                        <div className="text-[11px] text-[#b3b3b3] truncate">
                          {qTrack.artist}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] text-[#b3b3b3] tabular-nums">
                        {formatMusicDuration(qTrack.durationSec)}
                      </span>
                      {onRemoveFromQueue && !isCur && (
                        <button
                          type="button"
                          title={tr('Elimină din coadă', 'Remove from queue', 'Удалить')}
                          onClick={() => onRemoveFromQueue(qTrack.id)}
                          className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[#b3b3b3] hover:text-rose-400 hover:bg-white/10 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
> = ({ onBack, onOpenFullscreen, ...props }) => {
  const { tr, track } = props;
  return (
    <div className="space-y-5 pb-8">
      <ViewBackBar
        tr={tr}
        label={track.title}
        onBack={onBack}
        rightSlot={
          onOpenFullscreen && (
            <button
              type="button"
              onClick={onOpenFullscreen}
              className="h-9 px-3.5 rounded-full bg-white/[0.08] hover:bg-white/15 text-xs font-bold text-white cursor-pointer"
            >
              {tr('Deschide Full-Screen', 'Open Fullscreen', 'Во весь экран')}
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left/Main Studio Deck */}
        <div className="lg:col-span-7 rounded-2xl bg-gradient-to-b from-emerald-950/35 via-[#181818] to-[#121212] border border-white/10 p-4 sm:p-6 shadow-2xl">
          <SongStudioCore {...props} />
        </div>

        {/* Right Side Info Cards: About Artist & About Album */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl bg-[#181818] border border-white/10 p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#b3b3b3]">
              <Users className="w-4 h-4 text-[#1ed760]" />
              <span>{tr('Despre Artist', 'About the Artist', 'Об исполнителе')}</span>
            </div>
            <div className="flex items-center gap-4">
              <img
                src={proxyMusicCover(track.artistAvatar || track.cover)}
                alt={track.artist}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = FALLBACK_MUSIC_COVER;
                }}
                className="w-16 h-16 rounded-full object-cover ring-2 ring-white/15 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-black text-white truncate">{track.artist}</h3>
                <p className="text-xs text-[#b3b3b3] truncate">{track.genre || 'Music'}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => props.onOpenArtist(track.artist, track.artistId)}
                className="h-9 px-4 rounded-full bg-white text-black text-xs font-bold hover:scale-105 transition-transform cursor-pointer"
              >
                {tr('Deschide Profil Artist', 'Open Artist Profile', 'Профиль артиста')}
              </button>
              <button
                type="button"
                onClick={() => props.onStartRadio(track)}
                className="h-9 px-4 rounded-full bg-[#1ed760]/15 hover:bg-[#1ed760] text-[#1ed760] hover:text-black border border-[#1ed760]/30 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>{tr('Creează Radio Piesă', 'Create Song Radio', 'Создать Радио')}</span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-[#181818] border border-white/10 p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#b3b3b3]">
              <Disc className="w-4 h-4 text-[#1ed760]" />
              <span>{tr('De pe albumul', 'From the album', 'Из альбома')}</span>
            </div>
            <button
              type="button"
              onClick={() =>
                props.onOpenAlbum(track.album || track.title, track.artist, track.albumId, track)
              }
              className="w-full flex items-center gap-4 text-left group cursor-pointer focus:outline-none focus:ring-2 focus:ring-white rounded-xl p-1"
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
                <div className="text-base font-extrabold text-white group-hover:underline truncate">
                  {track.album || track.title}
                </div>
                <div className="text-xs text-[#b3b3b3] mt-0.5">
                  {track.year || 2025} • {track.qualityLabel || 'Lossless Audio'}
                </div>
              </div>
            </button>
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
      role="dialog"
      aria-modal="true"
      aria-label="Spotify Now Playing Studio Fullscreen"
      className="fixed inset-0 z-50 bg-[#101014] flex flex-col justify-between overflow-y-auto animate-in fade-in slide-in-from-bottom duration-300 select-none"
      style={{
        paddingTop: 'max(14px, env(safe-area-inset-top, 14px))',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-40 blur-3xl scale-125 transition-all duration-700 -z-10"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 22%, #1db954 0%, #101014 68%)`,
        }}
      />

      {/* Top Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 pt-1 pb-2 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full inline-flex items-center justify-center text-white/85 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-white"
          aria-label={tr('Minimizează', 'Minimize', 'Свернуть')}
        >
          <ChevronDown className="w-7 h-7" />
        </button>

        <div className="flex flex-col items-center text-center px-3 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#b3b3b3] truncate max-w-[220px]">
            {sourceLabel}
          </span>
          <button
            type="button"
            onClick={() => {
              onClose();
              props.onOpenAlbum(track.album || track.title, track.artist, track.albumId, track);
            }}
            className="text-xs font-bold text-white hover:underline truncate max-w-[220px] sm:max-w-xs cursor-pointer"
          >
            {track.album || track.artist}
          </button>
        </div>

        <div className="w-10 flex items-center justify-end">
          {track.qualityTier && (
            <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-white/15 text-[#1ed760] border border-[#1ed760]/30">
              {track.qualityTier}
            </span>
          )}
        </div>
      </div>

      {/* Main Studio Body */}
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-8 py-2 min-h-0 flex flex-col">
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
      className="m-auto w-[92vw] max-w-md rounded-2xl bg-[#1e1e22] text-white border border-white/15 p-0 shadow-[0_24px_64px_rgba(0,0,0,0.9)] backdrop:bg-black/75 backdrop:backdrop-blur-sm overflow-hidden"
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
            <p className="text-xs text-[#b3b3b3] truncate">{track.artist}</p>
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
              className="w-full px-3.5 py-3 rounded-xl flex items-center gap-3 text-left text-xs sm:text-sm font-semibold hover:bg-white/[0.08] focus:bg-white/[0.12] focus:outline-none transition-colors cursor-pointer"
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  act.accent ? 'text-[#1ed760]' : 'text-[#b3b3b3]'
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
