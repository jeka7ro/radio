import { SpotifyTrackItem, INITIAL_SPOTIFY_TRACKS } from '../components/tv/SmartTvMusicSpotifySection';
import {
  P1_SPOTIFY_FAVORITES_LIKED_TRACKS,
  P1_SPOTIFY_FAVORITES_UPDATED_AT,
} from './p1SpotifyFavoritesSeed';

export interface SyncedMusicTrack extends SpotifyTrackItem {
  likedAt?: number;
  playedAt?: number;
}

export interface SyncedMusicPlaybackState {
  track: SyncedMusicTrack | null;
  elapsedSec: number;
  durationSec: number;
  updatedAt: number;
  closed?: boolean;
}

export interface ProfileMusicSyncState {
  updatedAt: number;
  likedTracks: SyncedMusicTrack[];
  removedMap: Record<string, number>;
  recentTracks: SyncedMusicTrack[];
  playbackState: SyncedMusicPlaybackState | null;
  needsInitialCloudPush?: boolean;
}

const LEGACY_LIKED_STORAGE_KEY = 'sc_spotify_liked_tracks_v1';
const LEGACY_RECENT_STORAGE_KEY = 'sc_spotify_recent_tracks_v1';
const PROFILE_MUSIC_STORAGE_PREFIX = 'sc_spotify_music_profile_v2_';

function healTrackCoverUrl(track: SpotifyTrackItem): SyncedMusicTrack {
  let nextCover = track.cover;
  if (nextCover && nextCover.includes('6f6d73f3-f166-28a1-6e2b-905337f91065')) {
    nextCover =
      'https://cdn-images.dzcdn.net/images/cover/fd00ebd6d30d7253f813dba3bb1c66a9/500x500-000000-80-0-0.jpg';
  }
  if (nextCover && nextCover.includes('e261f8c1-73db-9a7a-c89e-1068f19d70e0')) {
    nextCover =
      'https://cdn-images.dzcdn.net/images/cover/134778e4c4f19ea71c82408300925a9a/500x500-000000-80-0-0.jpg';
  }
  return { ...track, cover: nextCover };
}

function normalizeTrackCanonicalKey(track: Partial<SpotifyTrackItem>): string {
  const artist = String(track.artist || '').toLowerCase().trim();
  const title = String(track.title || '').toLowerCase().trim();
  return artist && title ? `${artist}::${title}` : String(track.id || '');
}

function isUntouchedDefaultLikedList(tracks: SpotifyTrackItem[]): boolean {
  const defaults = INITIAL_SPOTIFY_TRACKS.slice(0, 3);
  if (tracks.length !== defaults.length) return false;
  return tracks.every((t, i) => t.id === defaults[i]?.id);
}

function getProfileMusicStorageKey(profileId: string): string {
  const cleanId = (profileId || 'p1').replace(/[^a-zA-Z0-9_-]/g, '') || 'p1';
  return `${PROFILE_MUSIC_STORAGE_PREFIX}${cleanId}`;
}

function getP1SeedState(): ProfileMusicSyncState {
  return {
    updatedAt: P1_SPOTIFY_FAVORITES_UPDATED_AT,
    likedTracks: P1_SPOTIFY_FAVORITES_LIKED_TRACKS,
    removedMap: {},
    recentTracks: [],
    playbackState: null,
  };
}

export function mergeMusicSyncStates(
  a: Partial<ProfileMusicSyncState> | null | undefined,
  b: Partial<ProfileMusicSyncState> | null | undefined
): ProfileMusicSyncState {
  const prev = a && typeof a === 'object' ? a : {};
  const next = b && typeof b === 'object' ? b : {};
  const baseTs = Number(next.updatedAt) || Number(prev.updatedAt) || Date.now();

  const removedMap: Record<string, number> = {
    ...(prev.removedMap && typeof prev.removedMap === 'object' ? prev.removedMap : {}),
    ...(next.removedMap && typeof next.removedMap === 'object' ? next.removedMap : {}),
  };

  const candidates = [
    ...(Array.isArray(next.likedTracks) ? next.likedTracks : []),
    ...(Array.isArray(prev.likedTracks) ? prev.likedTracks : []),
  ];
  const seenIdIdx = new Map<string, number>();
  const seenKeyIdx = new Map<string, number>();
  const likedTracks: SyncedMusicTrack[] = [];

  for (const raw of candidates) {
    if (!raw || typeof raw !== 'object' || !raw.id || !raw.title) continue;
    const healed = healTrackCoverUrl(raw);
    const idStr = String(healed.id);
    const key = normalizeTrackCanonicalKey(healed);
    const likedAt =
      Number(healed.likedAt) ||
      (Array.isArray(next.likedTracks) && next.likedTracks.includes(raw)
        ? baseTs
        : Number(prev.updatedAt) || 1);
    const removedAt = Math.max(
      Number(removedMap[idStr]) || 0,
      key ? Number(removedMap[key]) || 0 : 0
    );
    if (removedAt > 0 && likedAt <= removedAt) continue;
    if (removedAt > 0 && likedAt > removedAt) {
      delete removedMap[idStr];
      if (key) delete removedMap[key];
    }
    const existingIdx = seenIdIdx.has(idStr)
      ? seenIdIdx.get(idStr)
      : key && seenKeyIdx.has(key)
        ? seenKeyIdx.get(key)
        : undefined;
    if (existingIdx !== undefined) {
      if (likedAt > (Number(likedTracks[existingIdx].likedAt) || 0)) {
        likedTracks[existingIdx] = { ...healed, likedAt };
      }
      continue;
    }
    const nextIdx = likedTracks.length;
    seenIdIdx.set(idStr, nextIdx);
    if (key) seenKeyIdx.set(key, nextIdx);
    likedTracks.push({ ...healed, likedAt });
  }

  likedTracks.sort((x, y) => (Number(y.likedAt) || 0) - (Number(x.likedAt) || 0));

  const recentIds = new Set<string>();
  const recentKeys = new Set<string>();
  const recentTracks: SyncedMusicTrack[] = [];
  for (const raw of [
    ...(Array.isArray(next.recentTracks) ? next.recentTracks : []),
    ...(Array.isArray(prev.recentTracks) ? prev.recentTracks : []),
  ]) {
    if (!raw || typeof raw !== 'object' || !raw.id || !raw.title) continue;
    const healed = healTrackCoverUrl(raw);
    const idStr = String(healed.id);
    const key = normalizeTrackCanonicalKey(healed);
    if (recentIds.has(idStr) || (key && recentKeys.has(key))) continue;
    recentIds.add(idStr);
    if (key) recentKeys.add(key);
    recentTracks.push({ ...healed, playedAt: Number(healed.playedAt) || 0 });
  }
  recentTracks.sort((x, y) => (Number(y.playedAt) || 0) - (Number(x.playedAt) || 0));

  const normalizePb = (
    raw: SyncedMusicPlaybackState | null | undefined
  ): SyncedMusicPlaybackState | null => {
    if (!raw || typeof raw !== 'object') return null;
    const ts = Number(raw.updatedAt) || 0;
    if (raw.closed || raw.track === null) {
      return ts > 0
        ? { track: null, elapsedSec: 0, durationSec: 0, updatedAt: ts, closed: true }
        : null;
    }
    if (raw.track && typeof raw.track === 'object' && raw.track.id && raw.track.title) {
      return {
        track: healTrackCoverUrl(raw.track),
        elapsedSec: Number(raw.elapsedSec) || 0,
        durationSec: Number(raw.durationSec) || 0,
        updatedAt: ts,
      };
    }
    return null;
  };
  const prevPb = normalizePb(prev.playbackState);
  const nextPb = normalizePb(next.playbackState);
  const playbackState =
    nextPb && (nextPb.updatedAt || 0) >= (prevPb?.updatedAt || 0)
      ? nextPb
      : prevPb || null;

  return {
    updatedAt: Math.max(Number(prev.updatedAt) || 0, Number(next.updatedAt) || 0),
    likedTracks: likedTracks.slice(0, 500),
    removedMap,
    recentTracks: recentTracks.slice(0, 50),
    playbackState,
  };
}

export function loadLocalProfileMusicState(profileId: string): ProfileMusicSyncState {
  const cleanId = (profileId || 'p1').replace(/[^a-zA-Z0-9_-]/g, '') || 'p1';
  const baseSeed = cleanId === 'p1' ? getP1SeedState() : null;
  if (typeof window === 'undefined') {
    return baseSeed
      ? mergeMusicSyncStates(null, baseSeed)
      : {
          updatedAt: 0,
          likedTracks: [],
          removedMap: {},
          recentTracks: [],
          playbackState: null,
        };
  }

  try {
    const raw = localStorage.getItem(getProfileMusicStorageKey(cleanId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          ...mergeMusicSyncStates(baseSeed, parsed),
          needsInitialCloudPush: Boolean(parsed.needsInitialCloudPush),
        };
      }
    }
  } catch {
    // ignore storage read error
  }

  // Legacy migration for primary profile p1 (Mac desktop or previously saved favorites/recent)
  if (cleanId === 'p1') {
    try {
      const legacyLikedRaw = localStorage.getItem(LEGACY_LIKED_STORAGE_KEY);
      const legacyRecentRaw = localStorage.getItem(LEGACY_RECENT_STORAGE_KEY);
      const parsedLiked: SpotifyTrackItem[] = legacyLikedRaw
        ? JSON.parse(legacyLikedRaw)
        : [];
      const parsedRecent: SpotifyTrackItem[] = legacyRecentRaw
        ? JSON.parse(legacyRecentRaw)
        : [];
      const hasRealLegacyLiked =
        Array.isArray(parsedLiked) &&
        parsedLiked.length > 0 &&
        !isUntouchedDefaultLikedList(parsedLiked);
      const hasLegacyRecent =
        Array.isArray(parsedRecent) && parsedRecent.length > 0;
      if (hasRealLegacyLiked || hasLegacyRecent) {
        const now = Date.now();
        const migratedLocal: ProfileMusicSyncState = {
          updatedAt: now,
          likedTracks: hasRealLegacyLiked
            ? parsedLiked.map((t, idx) => ({
                ...healTrackCoverUrl(t),
                likedAt: (t as SyncedMusicTrack).likedAt || now - idx * 10,
              }))
            : [],
          removedMap: {},
          recentTracks: hasLegacyRecent
            ? parsedRecent.slice(0, 40).map((t, idx) => ({
                ...healTrackCoverUrl(t),
                playedAt: (t as SyncedMusicTrack).playedAt || now - idx * 10,
              }))
            : [],
          playbackState: null,
          needsInitialCloudPush: true,
        };
        const mergedMigrated: ProfileMusicSyncState = {
          ...mergeMusicSyncStates(baseSeed, migratedLocal),
          needsInitialCloudPush: true,
        };
        saveLocalProfileMusicState(cleanId, mergedMigrated);
        return mergedMigrated;
      }
    } catch {
      // ignore migration error
    }
  }

  if (baseSeed) {
    return mergeMusicSyncStates(null, baseSeed);
  }

  return {
    updatedAt: 0,
    likedTracks: [],
    removedMap: {},
    recentTracks: [],
    playbackState: null,
  };
}

export function saveLocalProfileMusicState(
  profileId: string,
  state: ProfileMusicSyncState
): void {
  const cleanId = (profileId || 'p1').replace(/[^a-zA-Z0-9_-]/g, '') || 'p1';
  if (typeof window === 'undefined') return;
  try {
    const cleanPayload: ProfileMusicSyncState = {
      updatedAt: Number(state.updatedAt) || Date.now(),
      likedTracks: (state.likedTracks || []).slice(0, 500),
      removedMap: state.removedMap || {},
      recentTracks: (state.recentTracks || []).slice(0, 50),
      playbackState: state.playbackState || null,
      ...(state.needsInitialCloudPush ? { needsInitialCloudPush: true } : {}),
    };
    localStorage.setItem(
      getProfileMusicStorageKey(cleanId),
      JSON.stringify(cleanPayload)
    );
    if (cleanId === 'p1') {
      localStorage.setItem(
        LEGACY_LIKED_STORAGE_KEY,
        JSON.stringify(cleanPayload.likedTracks)
      );
      localStorage.setItem(
        LEGACY_RECENT_STORAGE_KEY,
        JSON.stringify(cleanPayload.recentTracks)
      );
    }
  } catch {
    // ignore storage quota errors
  }
}

function shouldAlsoMirrorToCloudOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.port === '8769') return false;
  const host = window.location.hostname || '';
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    host.startsWith('100.')
  );
}

const lastRemotePushAtByProf: Record<string, number> = {};
const lastLikedSigByProf: Record<string, string> = {};
const lastClosedByProf: Record<string, boolean | undefined> = {};

export async function pullAndMergeProfileMusicState(
  profileId: string
): Promise<ProfileMusicSyncState | null> {
  const cleanId = (profileId || 'p1').replace(/[^a-zA-Z0-9_-]/g, '') || 'p1';
  const localState = loadLocalProfileMusicState(cleanId);
  try {
    const res = await fetch(
      `/api/tv-music-sync?profileId=${encodeURIComponent(cleanId)}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const remote = (await res.json()) as Partial<ProfileMusicSyncState> | null;
    if (!remote || typeof remote !== 'object') return null;

    const merged = mergeMusicSyncStates(localState, remote);
    const hasLocalRealData =
      localState.needsInitialCloudPush ||
      localState.likedTracks.length > 0 ||
      localState.recentTracks.length > 0 ||
      Boolean(localState.playbackState);
    const remoteHasStaleOpenPlayback = Boolean(
      localState.playbackState?.closed &&
        remote.playbackState?.track &&
        (Number(localState.playbackState.updatedAt) || 0) >=
          (Number(remote.playbackState.updatedAt) || 0)
    );
    const remoteMissingLocalTracks =
      hasLocalRealData &&
      ((localState.likedTracks.length > (remote.likedTracks?.length || 0)) ||
        (localState.recentTracks.length > (remote.recentTracks?.length || 0)) ||
        Boolean(localState.playbackState && !remote.playbackState) ||
        remoteHasStaleOpenPlayback);

    saveLocalProfileMusicState(cleanId, {
      ...merged,
      needsInitialCloudPush: false,
    });

    if (remoteMissingLocalTracks || localState.needsInitialCloudPush) {
      void pushProfileMusicState(
        cleanId,
        {
          ...merged,
          updatedAt: Math.max(merged.updatedAt || 0, Date.now()),
          needsInitialCloudPush: false,
        },
        remoteHasStaleOpenPlayback ? { force: true } : undefined
      );
    }
    return merged;
  } catch {
    return null;
  }
}

export async function pushProfileMusicState(
  profileId: string,
  state: ProfileMusicSyncState,
  options?: { force?: boolean }
): Promise<ProfileMusicSyncState | null> {
  const cleanId = (profileId || 'p1').replace(/[^a-zA-Z0-9_-]/g, '') || 'p1';
  const likedSig = `${(state.likedTracks || []).map((t) => t.id).join(',')}|${Object.keys(state.removedMap || {}).sort().join(',')}`;
  const now = Date.now();
  const likedChanged = likedSig !== lastLikedSigByProf[cleanId];
  const closedFlag = Boolean(state.playbackState?.closed);
  const closedChanged =
    lastClosedByProf[cleanId] !== undefined &&
    closedFlag !== lastClosedByProf[cleanId];
  const lastPushAt = lastRemotePushAtByProf[cleanId] || 0;

  if (!options?.force && !likedChanged && !closedChanged && now - lastPushAt < 180000) {
    return state;
  }
  lastLikedSigByProf[cleanId] = likedSig;
  lastClosedByProf[cleanId] = closedFlag;
  lastRemotePushAtByProf[cleanId] = now;

  const bodyStr = JSON.stringify({
    updatedAt: Number(state.updatedAt) || now,
    likedTracks: (state.likedTracks || []).slice(0, 500),
    removedMap: state.removedMap || {},
    recentTracks: (state.recentTracks || []).slice(0, 50),
    playbackState: state.playbackState || null,
  });

  if (shouldAlsoMirrorToCloudOrigin()) {
    fetch(
      `https://filmio.my/api/tv-music-sync?profileId=${encodeURIComponent(cleanId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
      }
    ).catch(() => {});
  }

  try {
    const res = await fetch(
      `/api/tv-music-sync?profileId=${encodeURIComponent(cleanId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
      }
    );
    if (!res.ok) return null;
    const remoteMerged = (await res.json()) as Partial<ProfileMusicSyncState> | null;
    if (!remoteMerged || typeof remoteMerged !== 'object') return null;
    const finalState = mergeMusicSyncStates(state, remoteMerged);
    saveLocalProfileMusicState(cleanId, {
      ...finalState,
      needsInitialCloudPush: false,
    });
    return finalState;
  } catch {
    return null;
  }
}
