// Netlify Serverless Function for Cross-Device Account, Photo, PIN & Watch Progress Sync
// Persists via @netlify/blobs (strong consistency across all Lambda instances & cold starts),
// with seamless in-memory fallback when invoked outside a Netlify Blobs runtime.
import { getStore } from '@netlify/blobs';
import {
  SEED_PROFILES,
  SEED_PROGRESS_BY_PROFILE,
  SEED_SAVED_BY_PROFILE,
} from './_seedData.mjs';
import {
  SEED_P1_MUSIC_LIKED_TRACKS,
  P1_SPOTIFY_FAVORITES_UPDATED_AT,
} from './_musicSeedP1.mjs';

const globalStore = globalThis.__aetherCloudSyncStore || {
  profiles: Array.isArray(SEED_PROFILES) ? [...SEED_PROFILES] : [],
  deletedProfileMap: {},
  progressByProfile: { ...(SEED_PROGRESS_BY_PROFILE || {}) },
  progressDeletedByProfile: {},
  savedByProfile: { ...(SEED_SAVED_BY_PROFILE || {}) },
  savedRemovedByProfile: {},
  radioFavsByProfile: {},
  tvFavChannelsByProfile: {},
  musicByProfile: {},
  homeBridge: null,
  blobReadCache: {},
  lastBlobWrittenJson: {},
};
if (!globalStore.savedRemovedByProfile) {
  globalStore.savedRemovedByProfile = {};
}
if (!globalStore.progressDeletedByProfile) {
  globalStore.progressDeletedByProfile = {};
}
if (!globalStore.deletedProfileMap || typeof globalStore.deletedProfileMap !== 'object') {
  globalStore.deletedProfileMap = {};
}
if (!globalStore.radioFavsByProfile) {
  globalStore.radioFavsByProfile = {};
}
if (!globalStore.tvFavChannelsByProfile) {
  globalStore.tvFavChannelsByProfile = {};
}
if (!globalStore.musicByProfile) {
  globalStore.musicByProfile = {};
}
if (!globalStore.blobReadCache) {
  globalStore.blobReadCache = {};
}
if (!globalStore.lastBlobWrittenJson) {
  globalStore.lastBlobWrittenJson = {};
}
globalThis.__aetherCloudSyncStore = globalStore;

const BLOB_READ_CACHE_TTL_MS = 15_000;

function getCloudBlobStore() {
  if (globalThis.__aetherTestBlobStore) {
    return globalThis.__aetherTestBlobStore;
  }
  try {
    return getStore({ name: 'filmio-tv-sync-v1', consistency: 'strong' });
  } catch {
    return null;
  }
}

async function readBlobState(store, key, forceFresh = false) {
  if (!store) return { active: false, data: null };
  const storeScopeKey = `${globalThis.__aetherTestBlobStore ? 'test:' : ''}${key}`;
  const cached = globalStore.blobReadCache[storeScopeKey];
  if (!forceFresh && cached && Date.now() - cached.ts < BLOB_READ_CACHE_TTL_MS) {
    return { active: true, data: cached.data };
  }
  try {
    const data = await store.get(key, { type: 'json' });
    const cleanData = data && typeof data === 'object' ? data : null;
    globalStore.blobReadCache[storeScopeKey] = {
      ts: Date.now(),
      data: cleanData,
    };
    if (cleanData) {
      globalStore.lastBlobWrittenJson[storeScopeKey] = JSON.stringify(cleanData);
    } else {
      delete globalStore.lastBlobWrittenJson[storeScopeKey];
    }
    return { active: true, data: cleanData };
  } catch {
    return { active: false, data: null };
  }
}

async function writeBlobState(store, key, value) {
  if (!store) return false;
  try {
    const nextJson = JSON.stringify(value);
    const storeScopeKey = `${globalThis.__aetherTestBlobStore ? 'test:' : ''}${key}`;
    if (globalStore.lastBlobWrittenJson[storeScopeKey] === nextJson) {
      return false;
    }
    await store.setJSON(key, value);
    globalStore.lastBlobWrittenJson[storeScopeKey] = nextJson;
    globalStore.blobReadCache[storeScopeKey] = {
      ts: Date.now(),
      data: JSON.parse(nextJson),
    };
    return true;
  } catch {
    return false;
  }
}

function mergeTwoProfileRecords(a, b) {
  const tsA = typeof a?.updatedAt === 'number' ? a.updatedAt : 0;
  const tsB = typeof b?.updatedAt === 'number' ? b.updatedAt : 0;
  const primary = tsB >= tsA ? b : a;
  const secondary = tsB >= tsA ? a : b;
  const merged = {
    ...secondary,
    ...primary,
    defaultAudioPref: primary.defaultAudioPref || secondary.defaultAudioPref,
    defaultSubLang: primary.defaultSubLang || secondary.defaultSubLang,
    defaultSubFontSize: primary.defaultSubFontSize || secondary.defaultSubFontSize,
    defaultSubFontPx: primary.defaultSubFontPx || secondary.defaultSubFontPx,
    tvTheme: primary.tvTheme || secondary.tvTheme,
  };
  const maxTs = Math.max(tsA, tsB);
  if (maxTs > 0) merged.updatedAt = maxTs;
  return merged;
}

function normalizeProfileUniqueName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function mergeProfileListsWithTombstones(lists, deletedMap) {
  const byId = new Map();
  const idByNormName = new Map();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const p of list) {
      if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !p.id) continue;
      if (p.id === 'p1' && p.name === 'Eugeniu' && !p.pin) continue;
      const delTs = p.id !== 'p1' ? Number(deletedMap[p.id]) || 0 : 0;
      const pTs = typeof p.updatedAt === 'number' ? p.updatedAt : 0;
      if (delTs > 0 && pTs <= delTs) continue;
      const prev = byId.get(p.id);
      if (!prev) {
        const normName = normalizeProfileUniqueName(p.name);
        if (normName && idByNormName.has(normName) && idByNormName.get(normName) !== p.id) {
          continue;
        }
        byId.set(p.id, p);
        if (normName) {
          idByNormName.set(normName, p.id);
        }
        continue;
      }
      const nextMerged = mergeTwoProfileRecords(prev, p);
      const mergedNormName = normalizeProfileUniqueName(nextMerged.name);
      const ownerId = mergedNormName ? idByNormName.get(mergedNormName) : undefined;
      if (ownerId && ownerId !== p.id) {
        nextMerged.name = prev.name;
      } else {
        const prevNormName = normalizeProfileUniqueName(prev.name);
        if (prevNormName && prevNormName !== mergedNormName && idByNormName.get(prevNormName) === p.id) {
          idByNormName.delete(prevNormName);
        }
        if (mergedNormName) {
          idByNormName.set(mergedNormName, p.id);
        }
      }
      byId.set(p.id, nextMerged);
    }
  }
  return Array.from(byId.values()).slice(0, 32);
}

function dedupeAndMergeSavedLists(lists) {
  const seen = new Set();
  const merged = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (item && item.id && !seen.has(item.id)) {
        seen.add(item.id);
        merged.push(item);
      }
    }
  }
  return merged.slice(0, 300);
}

function dedupeAndMergeProgressMaps(baseMap, incomingMap) {
  const merged = { ...(baseMap || {}) };
  for (const [k, v] of Object.entries(incomingMap || {})) {
    if (!v || typeof v !== 'object') continue;
    const existing = merged[k];
    if (!existing) {
      merged[k] = v;
      continue;
    }
    const vCleared =
      (v.currentTime || 0) === 0 &&
      v.isWatched === false &&
      (!v.episodeProgressMap ||
        Object.values(v.episodeProgressMap).every(
          (ep) => (ep?.currentTime || 0) === 0 && !ep?.isWatched
        ));
    if (vCleared && (v.updatedAt || 0) >= (existing.updatedAt || 0)) {
      merged[k] = v;
      continue;
    }
    const mergedEpMap = { ...(existing.episodeProgressMap || {}) };
    if (v.episodeProgressMap && typeof v.episodeProgressMap === 'object') {
      for (const [epK, epV] of Object.entries(v.episodeProgressMap)) {
        if (!epV || typeof epV !== 'object') continue;
        const prevEp = mergedEpMap[epK];
        if (!prevEp || (epV.updatedAt || 0) >= (prevEp.updatedAt || 0)) {
          mergedEpMap[epK] = epV;
        }
      }
    }
    const hasEpMap =
      Object.keys(mergedEpMap).length > 0 ||
      Boolean(v.episodeProgressMap) ||
      Boolean(existing.episodeProgressMap);
    const preserveAdult18 =
      Boolean(existing.item?.isAdult18) ||
      Boolean(v.item?.isAdult18) ||
      (Array.isArray(existing.item?.genres) &&
        existing.item.genres.some((g) => /^erotic$/i.test(String(g || '').trim()))) ||
      (Array.isArray(v.item?.genres) &&
        v.item.genres.some((g) => /^erotic$/i.test(String(g || '').trim())));
    if ((v.updatedAt || 0) >= (existing.updatedAt || 0)) {
      const mergedItem = v.item
        ? { ...(existing.item || {}), ...v.item, ...(preserveAdult18 ? { isAdult18: true } : {}) }
        : existing.item;
      merged[k] = {
        ...existing,
        ...v,
        ...(mergedItem ? { item: mergedItem } : {}),
        ...(hasEpMap ? { episodeProgressMap: mergedEpMap } : {}),
      };
    } else {
      const mergedItem = existing.item
        ? { ...(v.item || {}), ...existing.item, ...(preserveAdult18 ? { isAdult18: true } : {}) }
        : v.item;
      merged[k] = {
        ...v,
        ...existing,
        ...(mergedItem ? { item: mergedItem } : {}),
        ...(hasEpMap ? { episodeProgressMap: mergedEpMap } : {}),
      };
    }
  }

  const dedupedProgress = {};
  const pGroups = [];
  for (const [pk, pEntry] of Object.entries(merged)) {
    if (!pEntry || typeof pEntry !== 'object' || !pEntry.item) {
      dedupedProgress[pk] = pEntry;
      continue;
    }
    let matched = false;
    for (const g of pGroups) {
      const a = g[0]?.item;
      const b = pEntry.item;
      if (a?.type && b?.type && a.type !== b.type) continue;
      const aId = String(a?.id || '').trim();
      const bId = String(b?.id || '').trim();
      if (aId && bId && aId === bId) { g.push(pEntry); matched = true; break; }
      const aImdb = String(a?.imdbId || a?.imdb_id || (aId.startsWith('tt') ? aId : '')).trim();
      const bImdb = String(b?.imdbId || b?.imdb_id || (bId.startsWith('tt') ? bId : '')).trim();
      if (aImdb.startsWith('tt') && bImdb.startsWith('tt') && aImdb === bImdb) { g.push(pEntry); matched = true; break; }
      const aKp = String(a?.kpId || (aId.startsWith('kp_') ? aId.replace('kp_', '') : '')).trim();
      const bKp = String(b?.kpId || (bId.startsWith('kp_') ? bId.replace('kp_', '') : '')).trim();
      if (aKp && bKp && aKp === bKp) { g.push(pEntry); matched = true; break; }
      if (aImdb.startsWith('tt') && bImdb.startsWith('tt') && aImdb !== bImdb) continue;
      if (aKp && bKp && aKp !== bKp) continue;
      const aT = String(a?.name || a?.title || a?.nameOriginal || '').toLowerCase().trim();
      const bT = String(b?.name || b?.title || b?.nameOriginal || '').toLowerCase().trim();
      if (aT && bT && aT.length > 2 && aT === bT) { g.push(pEntry); matched = true; break; }
    }
    if (!matched) pGroups.push([pEntry]);
  }

  for (const g of pGroups) {
    let fin = g[0];
    if (g.length > 1) {
      for (let i = 1; i < g.length; i++) {
        const other = g[i];
        const fT = fin.updatedAt || 0;
        const oT = other.updatedAt || 0;
        const prim = oT >= fT ? other : fin;
        const sec = oT >= fT ? fin : other;
        const epMap = { ...(sec.episodeProgressMap || {}) };
        for (const [ek, ev] of Object.entries(prim.episodeProgressMap || {})) {
          const prevEv = epMap[ek];
          if (!prevEv || (Number(ev?.updatedAt) || 0) >= (Number(prevEv?.updatedAt) || 0)) {
            epMap[ek] = ev;
          }
        }
        const itm = { ...(sec.item || {}), ...(prim.item || {}) };
        if (prim.item?.isAdult18 || sec.item?.isAdult18) itm.isAdult18 = true;
        if (prim.item?.isAdultKlubnichka || sec.item?.isAdultKlubnichka) itm.isAdultKlubnichka = true;
        const cImdb = prim.item?.imdbId || sec.item?.imdbId || (String(prim.item?.id || '').startsWith('tt') ? prim.item.id : String(sec.item?.id || '').startsWith('tt') ? sec.item.id : undefined);
        if (cImdb) { itm.imdbId = cImdb; itm.id = cImdb; }
        const strictlyNewer = Math.abs(oT - fT) > 1500;
        fin = {
          ...sec,
          ...prim,
          item: itm,
          episodeProgressMap: epMap,
          currentTime: strictlyNewer
            ? prim.currentTime || 0
            : prim.season === sec.season && prim.episode === sec.episode
              ? Math.max(prim.currentTime || 0, sec.currentTime || 0)
              : prim.currentTime,
          isWatched: strictlyNewer
            ? prim.isWatched
            : prim.isWatched ?? sec.isWatched,
          updatedAt: Math.max(fT, oT),
        };
      }
    }
    const cKey = fin.item?.imdbId && String(fin.item.imdbId).startsWith('tt')
      ? fin.item.imdbId
      : String(fin.item?.id || '').startsWith('tt')
      ? fin.item.id
      : fin.item?.kpId
      ? `kp_${fin.item.kpId}`
      : fin.item?.id;
    if (cKey) {
      dedupedProgress[cKey] = fin;
    }
  }
  return dedupedProgress;
}

function normalizeMusicTrackKey(t) {
  const artist = String(t?.artist || '').toLowerCase().trim();
  const title = String(t?.title || '').toLowerCase().trim();
  return artist && title ? `${artist}::${title}` : String(t?.id || '');
}

function mergeMusicProfileData(existing, incoming) {
  const prev = existing && typeof existing === 'object' ? existing : {};
  const next = incoming && typeof incoming === 'object' ? incoming : {};
  const baseTs = Number(next.updatedAt) || Number(prev.updatedAt) || Date.now();

  const removedMap = {
    ...(prev.removedMap && typeof prev.removedMap === 'object' ? prev.removedMap : {}),
    ...(next.removedMap && typeof next.removedMap === 'object' ? next.removedMap : {}),
  };

  const trackCandidates = [
    ...(Array.isArray(next.likedTracks) ? next.likedTracks : []),
    ...(Array.isArray(prev.likedTracks) ? prev.likedTracks : []),
  ];
  const seenIdIdx = new Map();
  const seenKeyIdx = new Map();
  const likedTracks = [];

  for (const raw of trackCandidates) {
    if (!raw || typeof raw !== 'object' || !raw.id || !raw.title) continue;
    const idStr = String(raw.id);
    const key = normalizeMusicTrackKey(raw);
    const likedAt =
      Number(raw.likedAt) ||
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
        likedTracks[existingIdx] = { ...raw, likedAt };
      }
      continue;
    }
    const nextIdx = likedTracks.length;
    seenIdIdx.set(idStr, nextIdx);
    if (key) seenKeyIdx.set(key, nextIdx);
    likedTracks.push({ ...raw, likedAt });
  }

  likedTracks.sort((a, b) => (Number(b.likedAt) || 0) - (Number(a.likedAt) || 0));

  const recentCandidates = [
    ...(Array.isArray(next.recentTracks) ? next.recentTracks : []),
    ...(Array.isArray(prev.recentTracks) ? prev.recentTracks : []),
  ];
  const recentIds = new Set();
  const recentKeys = new Set();
  const recentTracks = [];
  for (const raw of recentCandidates) {
    if (!raw || typeof raw !== 'object' || !raw.id || !raw.title) continue;
    const idStr = String(raw.id);
    const key = normalizeMusicTrackKey(raw);
    if (recentIds.has(idStr) || (key && recentKeys.has(key))) continue;
    recentIds.add(idStr);
    if (key) recentKeys.add(key);
    recentTracks.push({
      ...raw,
      playedAt: Number(raw.playedAt) || 0,
    });
  }
  recentTracks.sort((a, b) => (Number(b.playedAt) || 0) - (Number(a.playedAt) || 0));

  const normalizePb = (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const ts = Number(raw.updatedAt) || 0;
    if (raw.closed || raw.track === null) {
      return ts > 0
        ? { track: null, elapsedSec: 0, durationSec: 0, updatedAt: ts, closed: true }
        : null;
    }
    if (raw.track && typeof raw.track === 'object' && raw.track.id && raw.track.title) {
      return raw;
    }
    return null;
  };
  const prevPb = normalizePb(prev.playbackState);
  const nextPb = normalizePb(next.playbackState);
  const prevPbTs = Number(prevPb?.updatedAt) || 0;
  const nextPbTs = Number(nextPb?.updatedAt) || 0;
  const playbackState =
    nextPb && nextPbTs >= prevPbTs
      ? nextPb
      : prevPb || null;

  return {
    updatedAt: Math.max(Number(prev.updatedAt) || 0, baseTs),
    likedTracks: likedTracks.slice(0, 500),
    removedMap,
    recentTracks: recentTracks.slice(0, 50),
    playbackState,
  };
}

globalStore.musicByProfile.p1 = mergeMusicProfileData(
  {
    updatedAt: P1_SPOTIFY_FAVORITES_UPDATED_AT,
    likedTracks: SEED_P1_MUSIC_LIKED_TRACKS,
    removedMap: {},
    recentTracks: [],
    playbackState: null,
  },
  globalStore.musicByProfile.p1 || null
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Deleted-Profile-Ids, X-Replace-Profiles, X-Removed-Vod-Ids',
  'Access-Control-Expose-Headers': 'X-Server-Deleted-Ids, X-Persistent-Store, X-Server-Removed-Vod-Ids',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-cache, no-store',
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const rawProfileId = (url.searchParams.get('profileId') || 'p1')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 64);
    const profileId =
      !rawProfileId ||
      rawProfileId === '__proto__' ||
      rawProfileId === 'constructor' ||
      rawProfileId === 'prototype'
        ? 'p1'
        : rawProfileId;
    const isMutation = req.method === 'POST' || req.method === 'DELETE' || Boolean(url.searchParams.get('deleteId'));
    const blobStore = getCloudBlobStore();

    // 1. /api/tv-profiles
    if (path.includes('tv-profiles')) {
      const { active: blobActive, data: blobState } = await readBlobState(
        blobStore,
        'profiles_state_v1',
        isMutation
      );
      const deletedMap = {
        ...(globalStore.deletedProfileMap || {}),
        ...(blobState?.deletedMap && typeof blobState.deletedMap === 'object'
          ? blobState.deletedMap
          : {}),
      };
      let currentProfiles = mergeProfileListsWithTombstones(
        [
          SEED_PROFILES,
          globalStore.profiles || [],
          Array.isArray(blobState?.profiles) ? blobState.profiles : [],
        ],
        deletedMap
      );
      globalStore.profiles = currentProfiles;
      globalStore.deletedProfileMap = deletedMap;

      if (req.method === 'POST') {
        const incoming = await req.json().catch(() => null);
        let deletedIds = new Set();
        try {
          const rawDel = req.headers.get('x-deleted-profile-ids') || '[]';
          const parsedDel = JSON.parse(rawDel);
          if (Array.isArray(parsedDel)) {
            deletedIds = new Set(parsedDel.filter((x) => typeof x === 'string' && x));
          }
        } catch {
          // ignore
        }
        const now = Date.now();
        for (const delId of deletedIds) {
          if (delId !== 'p1') {
            deletedMap[delId] = Math.max(Number(deletedMap[delId]) || 0, now);
          }
        }

        const sanitizedIncoming = Array.isArray(incoming)
          ? incoming.filter((p) => {
              if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !p.id) {
                return false;
              }
              if (p.id === 'p1' && p.name === 'Eugeniu' && !p.pin) return false;
              if (p.id !== 'p1') {
                if (deletedIds.has(p.id)) return false;
                const ts = typeof p.updatedAt === 'number' ? p.updatedAt : 0;
                if (deletedMap[p.id] && ts > deletedMap[p.id]) {
                  delete deletedMap[p.id];
                } else if (deletedMap[p.id]) {
                  return false;
                }
              }
              return true;
            })
          : [];

        currentProfiles = mergeProfileListsWithTombstones(
          [currentProfiles, sanitizedIncoming],
          deletedMap
        );
        if (currentProfiles.length > 0) {
          globalStore.profiles = currentProfiles;
          globalStore.deletedProfileMap = deletedMap;
          await writeBlobState(blobStore, 'profiles_state_v1', {
            profiles: currentProfiles,
            deletedMap,
          });
        }
      }

      const deletedList = Object.keys(globalStore.deletedProfileMap || {}).filter(
        (id) => id !== 'p1' && !currentProfiles.some((p) => p?.id === id)
      );
      return new Response(JSON.stringify(currentProfiles), {
        status: 200,
        headers: {
          ...corsHeaders,
          'X-Server-Deleted-Ids': JSON.stringify(deletedList),
          'X-Persistent-Store': blobActive ? 'blobs' : 'memory',
        },
      });
    }

    // 2. /api/tv-saved
    if (path.includes('tv-saved')) {
      const { data: blobSaved } = await readBlobState(blobStore, `saved_v1_${profileId}`, isMutation);
      const blobItems = Array.isArray(blobSaved)
        ? blobSaved
        : Array.isArray(blobSaved?.items)
          ? blobSaved.items
          : [];
      const mergedRemovedMap = {
        ...(globalStore.savedRemovedByProfile[profileId] || {}),
        ...(blobSaved && !Array.isArray(blobSaved) && blobSaved.removedMap && typeof blobSaved.removedMap === 'object'
          ? blobSaved.removedMap
          : {}),
      };
      let incomingRemoved = {};
      try {
        const rawRem = req.headers.get('x-removed-vod-ids');
        if (rawRem) {
          const parsedRem = JSON.parse(rawRem);
          if (parsedRem && typeof parsedRem === 'object') {
            incomingRemoved = parsedRem;
          }
        }
      } catch {
        // ignore
      }
      for (const [rid, rts] of Object.entries(incomingRemoved)) {
        const tsNum = Number(rts) || 0;
        if (rid && tsNum > (Number(mergedRemovedMap[rid]) || 0)) {
          mergedRemovedMap[rid] = tsNum;
        }
      }

      let currentSaved = dedupeAndMergeSavedLists([
        globalStore.savedByProfile[profileId] || [],
        blobItems,
      ]).filter((it) => {
        const remTs = Number(mergedRemovedMap[it.id]) || 0;
        const savedTs = Number(it.savedAt) || 1;
        return remTs === 0 || savedTs > remTs;
      });

      if (req.method === 'POST') {
        const incoming = await req.json().catch(() => null);
        if (Array.isArray(incoming)) {
          const incomingIds = new Set(incoming.map((x) => x?.id).filter(Boolean));
          for (const it of incoming) {
            if (!it?.id) continue;
            const remTs = Number(mergedRemovedMap[it.id]) || 0;
            const incSavedTs = Number(it.savedAt) || 0;
            if (remTs > 0 && incSavedTs > remTs) {
              delete mergedRemovedMap[it.id];
            }
          }
          for (const prevIt of currentSaved) {
            if (prevIt?.id && !incomingIds.has(prevIt.id) && incomingRemoved[prevIt.id]) {
              mergedRemovedMap[prevIt.id] = Math.max(
                Number(mergedRemovedMap[prevIt.id]) || 0,
                Number(incomingRemoved[prevIt.id]) || Date.now()
              );
            }
          }
          currentSaved = dedupeAndMergeSavedLists([incoming, currentSaved]).filter((it) => {
            const remTs = Number(mergedRemovedMap[it.id]) || 0;
            const savedTs = Number(it.savedAt) || 1;
            return remTs === 0 || savedTs > remTs;
          });
          globalStore.savedByProfile[profileId] = currentSaved;
          globalStore.savedRemovedByProfile[profileId] = mergedRemovedMap;
          const payloadToStore =
            Object.keys(mergedRemovedMap).length > 0
              ? { items: currentSaved, removedMap: mergedRemovedMap }
              : currentSaved;
          await writeBlobState(blobStore, `saved_v1_${profileId}`, payloadToStore);
        }
      } else {
        globalStore.savedByProfile[profileId] = currentSaved;
        globalStore.savedRemovedByProfile[profileId] = mergedRemovedMap;
      }

      return new Response(JSON.stringify(currentSaved), {
        status: 200,
        headers: {
          ...corsHeaders,
          'X-Server-Removed-Vod-Ids': JSON.stringify(mergedRemovedMap),
        },
      });
    }

    // 2b. /api/tv-radio-favorites (Per-profile Radio Favorites with timestamped sync)
    if (path.includes('tv-radio-favorites')) {
      const { data: blobRadio } = await readBlobState(blobStore, `radio_v1_${profileId}`, isMutation);
      let currentRadioFavs = globalStore.radioFavsByProfile[profileId] || null;
      if (blobRadio && Array.isArray(blobRadio.stations)) {
        const blobTs = Number(blobRadio.updatedAt) || 0;
        const curTs = Number(currentRadioFavs?.updatedAt) || 0;
        if (!currentRadioFavs || blobTs > curTs) {
          currentRadioFavs = blobRadio;
          globalStore.radioFavsByProfile[profileId] = currentRadioFavs;
        }
      }
      if (req.method === 'POST') {
        const incoming = await req.json().catch(() => null);
        if (
          incoming &&
          typeof incoming === 'object' &&
          Array.isArray(incoming.stations)
        ) {
          const incomingTs = Number(incoming.updatedAt) || Date.now();
          const currentTs = Number(currentRadioFavs?.updatedAt) || 0;
          if (!currentRadioFavs || incomingTs >= currentTs) {
            currentRadioFavs = {
              updatedAt: incomingTs,
              stations: incoming.stations.slice(0, 300),
            };
            globalStore.radioFavsByProfile[profileId] = currentRadioFavs;
            await writeBlobState(blobStore, `radio_v1_${profileId}`, currentRadioFavs);
          }
        }
      }
      return new Response(
        JSON.stringify(
          currentRadioFavs || {
            updatedAt: 0,
            stations: [],
          }
        ),
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // 2c. /api/tv-channel-favorites (Per-profile TV Channel Favorites with timestamped sync)
    if (path.includes('tv-channel-favorites')) {
      const { data: blobTvCh } = await readBlobState(blobStore, `tvch_v1_${profileId}`, isMutation);
      let currentTvFavs = globalStore.tvFavChannelsByProfile[profileId] || null;
      if (blobTvCh && Array.isArray(blobTvCh.channels)) {
        const blobTs = Number(blobTvCh.updatedAt) || 0;
        const curTs = Number(currentTvFavs?.updatedAt) || 0;
        if (!currentTvFavs || blobTs > curTs) {
          currentTvFavs = blobTvCh;
          globalStore.tvFavChannelsByProfile[profileId] = currentTvFavs;
        }
      }
      if (req.method === 'POST') {
        const incoming = await req.json().catch(() => null);
        if (
          incoming &&
          typeof incoming === 'object' &&
          Array.isArray(incoming.channels)
        ) {
          const incomingTs = Number(incoming.updatedAt) || Date.now();
          const currentTs = Number(currentTvFavs?.updatedAt) || 0;
          if (!currentTvFavs || incomingTs >= currentTs) {
            currentTvFavs = {
              updatedAt: incomingTs,
              channels: incoming.channels.slice(0, 300),
            };
            globalStore.tvFavChannelsByProfile[profileId] = currentTvFavs;
            await writeBlobState(blobStore, `tvch_v1_${profileId}`, currentTvFavs);
          }
        }
      }
      return new Response(
        JSON.stringify(
          currentTvFavs || {
            updatedAt: 0,
            channels: [],
          }
        ),
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // 2d. /api/tv-music-sync (Per-profile Music Favorites, Recent Tracks & Playback Progress)
    if (path.includes('tv-music-sync')) {
      const { data: blobMusic } = await readBlobState(blobStore, `music_v1_${profileId}`, isMutation);
      let currentMusic = globalStore.musicByProfile[profileId] || {
        updatedAt: 0,
        likedTracks: [],
        removedMap: {},
        recentTracks: [],
        playbackState: null,
      };
      if (blobMusic && typeof blobMusic === 'object') {
        currentMusic = mergeMusicProfileData(currentMusic, blobMusic);
        globalStore.musicByProfile[profileId] = currentMusic;
      }
      if (req.method === 'POST') {
        const incoming = await req.json().catch(() => null);
        if (incoming && typeof incoming === 'object') {
          currentMusic = mergeMusicProfileData(currentMusic, incoming);
          globalStore.musicByProfile[profileId] = currentMusic;
          await writeBlobState(blobStore, `music_v1_${profileId}`, currentMusic);
        }
      }
      return new Response(JSON.stringify(currentMusic), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // 2e. /api/tv-bridge (Auto-synced HTTPS Home Bridge origin for FileList.io & Apple-native M4A audio)
    if (path.includes('tv-bridge')) {
      const normalizeSafeBridgeOrigin = (raw) => {
        const s = String(raw || '').trim();
        if (!s || s.length > 180 || !s.startsWith('https://')) return '';
        try {
          const parsed = new URL(s);
          if (parsed.protocol !== 'https:' || !parsed.hostname) return '';
          const h = parsed.hostname.toLowerCase();
          const isAllowedBridgeHost =
            h.endsWith('.trycloudflare.com') ||
            h === 'filmio.my' ||
            h.endsWith('.filmio.my');
          if (!isAllowedBridgeHost || h.includes(':')) {
            return '';
          }
          return parsed.origin;
        } catch {
          return '';
        }
      };

      const { data: blobBridge } = await readBlobState(blobStore, 'home_bridge_v1', isMutation);
      let currentBridge = globalStore.homeBridge || null;
      if (blobBridge && typeof blobBridge === 'object' && blobBridge.bridgeUrl) {
        const blobTs = Number(blobBridge.updatedAt) || 0;
        const curTs = Number(currentBridge?.updatedAt) || 0;
        if (!currentBridge || blobTs >= curTs) {
          currentBridge = {
            bridgeUrl: normalizeSafeBridgeOrigin(blobBridge.bridgeUrl),
            updatedAt: blobTs,
          };
          globalStore.homeBridge = currentBridge;
        }
      }

      if (req.method === 'POST') {
        const incoming = await req.json().catch(() => null);
        const nextUrl = normalizeSafeBridgeOrigin(incoming?.bridgeUrl);
        if (nextUrl) {
          const nextRecord = {
            bridgeUrl: nextUrl,
            updatedAt: Date.now(),
          };
          const changed = currentBridge?.bridgeUrl !== nextUrl;
          currentBridge = changed ? nextRecord : currentBridge;
          globalStore.homeBridge = currentBridge;
          if (changed) {
            await writeBlobState(blobStore, 'home_bridge_v1', nextRecord);
          }
        }
      }

      return new Response(
        JSON.stringify({
          ok: true,
          bridgeUrl: currentBridge?.bridgeUrl || '',
          updatedAt: Number(currentBridge?.updatedAt) || 0,
        }),
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // 3. /api/tv-progress
    const { active: progBlobActive, data: blobProgress } = await readBlobState(
      blobStore,
      `progress_v1_${profileId}`,
      isMutation
    );
    const delTombstones = globalStore.progressDeletedByProfile[profileId] || {};
    const baseMemProgress = progBlobActive && blobProgress && typeof blobProgress === 'object'
      ? blobProgress
      : globalStore.progressByProfile[profileId] || {};
    let currentProgress = dedupeAndMergeProgressMaps(
      baseMemProgress,
      blobProgress && typeof blobProgress === 'object' ? blobProgress : {}
    );
    for (const [dk, dts] of Object.entries(delTombstones)) {
      const entry = currentProgress[dk];
      if (entry && (Number(entry.updatedAt) || 0) <= Number(dts)) {
        delete currentProgress[dk];
      }
    }
    globalStore.progressByProfile[profileId] = currentProgress;

    const deleteId = url.searchParams.get('deleteId') || '';
    if (req.method === 'DELETE' || deleteId) {
      let removedAny = false;
      if (deleteId) {
        const nowDel = Date.now();
        delTombstones[deleteId] = nowDel;
        for (const [k, v] of Object.entries(currentProgress)) {
          const itemId = String(v?.item?.id || '');
          const itemImdb = String(v?.item?.imdbId || '');
          if (k === deleteId || itemId === deleteId || itemImdb === deleteId) {
            delete currentProgress[k];
            delTombstones[k] = nowDel;
            removedAny = true;
          }
        }
        globalStore.progressDeletedByProfile[profileId] = delTombstones;
        globalStore.progressByProfile[profileId] = currentProgress;
        if (removedAny) {
          await writeBlobState(blobStore, `progress_v1_${profileId}`, currentProgress);
        }
      }
      return new Response(JSON.stringify(currentProgress), {
        status: 200,
        headers: corsHeaders,
      });
    }
    if (req.method === 'POST') {
      const incoming = await req.json().catch(() => null);
      if (incoming && typeof incoming === 'object') {
        const filteredIncoming = {};
        for (const [ik, iv] of Object.entries(incoming)) {
          const dts = Number(delTombstones[ik]) || 0;
          const incTs = Number(iv?.updatedAt) || 0;
          if (dts > 0 && incTs <= dts) continue;
          if (dts > 0 && incTs > dts) delete delTombstones[ik];
          filteredIncoming[ik] = iv;
        }
        currentProgress = dedupeAndMergeProgressMaps(currentProgress, filteredIncoming);
        globalStore.progressByProfile[profileId] = currentProgress;
        await writeBlobState(blobStore, `progress_v1_${profileId}`, currentProgress);
      }
      return new Response(JSON.stringify(currentProgress), {
        status: 200,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify(currentProgress), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 200,
      headers: corsHeaders,
    });
  }
};
