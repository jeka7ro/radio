// Netlify Serverless Function for Cross-Device Account, Photo, PIN & Watch Progress Sync
// Works when the user is away from home (on 4G/5G, vacation, laptop, iPad) with smart throttling.
import {
  SEED_PROFILES,
  SEED_PROGRESS_BY_PROFILE,
  SEED_SAVED_BY_PROFILE,
} from './_seedData.mjs';

const globalStore = globalThis.__aetherCloudSyncStore || {
  profiles: Array.isArray(SEED_PROFILES) ? [...SEED_PROFILES] : [],
  progressByProfile: { ...(SEED_PROGRESS_BY_PROFILE || {}) },
  savedByProfile: { ...(SEED_SAVED_BY_PROFILE || {}) },
  radioFavsByProfile: {},
  tvFavChannelsByProfile: {},
};
if (!globalStore.radioFavsByProfile) {
  globalStore.radioFavsByProfile = {};
}
if (!globalStore.tvFavChannelsByProfile) {
  globalStore.tvFavChannelsByProfile = {};
}
globalThis.__aetherCloudSyncStore = globalStore;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Deleted-Profile-Ids',
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
    const profileId = (url.searchParams.get('profileId') || 'p1').replace(
      /[^a-zA-Z0-9_-]/g,
      ''
    );

    // 1. /api/tv-profiles
    if (path.includes('tv-profiles')) {
      if (req.method === 'POST') {
        const incoming = await req.json().catch(() => null);
        if (Array.isArray(incoming) && incoming.length > 0) {
          let deletedIds = new Set();
          try {
            const rawDel = req.headers.get('x-deleted-profile-ids') || '[]';
            const parsedDel = JSON.parse(rawDel);
            if (Array.isArray(parsedDel)) {
              deletedIds = new Set(parsedDel.filter((x) => typeof x === 'string'));
            }
          } catch {
            // ignore
          }
          const byId = new Map();
          for (const p of globalStore.profiles || []) {
            if (p?.id && !deletedIds.has(p.id)) {
              byId.set(p.id, p);
            }
          }
          for (const p of incoming) {
            if (!p?.id || deletedIds.has(p.id)) continue;
            if (p.id === 'p1' && p.name === 'Eugeniu' && !p.pin) continue;
            const prev = byId.get(p.id);
            const prevTs = typeof prev?.updatedAt === 'number' ? prev.updatedAt : 0;
            const nextTs = typeof p?.updatedAt === 'number' ? p.updatedAt : 0;
            if (!prev || nextTs >= prevTs) {
              byId.set(p.id, p);
            }
          }
          const merged = Array.from(byId.values());
          if (merged.length > 0) {
            globalStore.profiles = merged.slice(0, 16);
          }
        }
        return new Response(JSON.stringify(globalStore.profiles), {
          status: 200,
          headers: corsHeaders,
        });
      }
      return new Response(JSON.stringify(globalStore.profiles), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // 2. /api/tv-saved
    if (path.includes('tv-saved')) {
      const currentSaved = globalStore.savedByProfile[profileId] || [];
      if (req.method === 'POST') {
        const incoming = await req.json().catch(() => null);
        if (Array.isArray(incoming) && incoming.length > 0) {
          const seen = new Set(currentSaved.map((x) => x?.id).filter(Boolean));
          const merged = [...currentSaved];
          for (const item of incoming) {
            if (item && item.id && !seen.has(item.id)) {
              seen.add(item.id);
              merged.push(item);
            }
          }
          globalStore.savedByProfile[profileId] = merged.slice(0, 300);
        }
        return new Response(
          JSON.stringify(globalStore.savedByProfile[profileId] || []),
          {
            status: 200,
            headers: corsHeaders,
          }
        );
      }
      return new Response(JSON.stringify(currentSaved), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // 2b. /api/tv-radio-favorites (Per-profile Radio Favorites with timestamped sync)
    if (path.includes('tv-radio-favorites')) {
      const currentRadioFavs = globalStore.radioFavsByProfile[profileId] || null;
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
            globalStore.radioFavsByProfile[profileId] = {
              updatedAt: incomingTs,
              stations: incoming.stations.slice(0, 300),
            };
          }
        }
        return new Response(
          JSON.stringify(
            globalStore.radioFavsByProfile[profileId] || {
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
      const currentTvFavs = globalStore.tvFavChannelsByProfile[profileId] || null;
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
            globalStore.tvFavChannelsByProfile[profileId] = {
              updatedAt: incomingTs,
              channels: incoming.channels.slice(0, 300),
            };
          }
        }
        return new Response(
          JSON.stringify(
            globalStore.tvFavChannelsByProfile[profileId] || {
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

    // 3. /api/tv-progress
    const currentProgress = globalStore.progressByProfile[profileId] || {};
    const deleteId = url.searchParams.get('deleteId') || '';
    if (req.method === 'DELETE' || deleteId) {
      if (deleteId && deleteId in currentProgress) {
        delete currentProgress[deleteId];
        globalStore.progressByProfile[profileId] = currentProgress;
      }
      return new Response(JSON.stringify(currentProgress), {
        status: 200,
        headers: corsHeaders,
      });
    }
    if (req.method === 'POST') {
      const incoming = await req.json().catch(() => null);
      if (incoming && typeof incoming === 'object') {
        const merged = { ...currentProgress };
        for (const [k, v] of Object.entries(incoming)) {
          if (!v || typeof v !== 'object') continue;
          const existing = merged[k];
          if (!existing) {
            merged[k] = v;
            continue;
          }
          const vCleared =
            (v.currentTime || 0) === 0 &&
            (!v.episodeProgressMap ||
              Object.keys(v.episodeProgressMap).length === 0);
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
          if ((v.updatedAt || 0) >= (existing.updatedAt || 0)) {
            merged[k] = {
              ...existing,
              ...v,
              episodeProgressMap: mergedEpMap,
            };
          } else {
            merged[k] = {
              ...v,
              ...existing,
              episodeProgressMap: mergedEpMap,
            };
          }
        }

        // Deduplicate merged progress by canonical IMDb / KP ID / title
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
              const epMap = { ...(sec.episodeProgressMap || {}), ...(prim.episodeProgressMap || {}) };
              const itm = { ...(sec.item || {}), ...(prim.item || {}) };
              const cImdb = prim.item?.imdbId || sec.item?.imdbId || (String(prim.item?.id || '').startsWith('tt') ? prim.item.id : String(sec.item?.id || '').startsWith('tt') ? sec.item.id : undefined);
              if (cImdb) { itm.imdbId = cImdb; itm.id = cImdb; }
              fin = {
                ...sec,
                ...prim,
                item: itm,
                episodeProgressMap: epMap,
                currentTime: prim.season === sec.season && prim.episode === sec.episode ? Math.max(prim.currentTime || 0, sec.currentTime || 0) : prim.currentTime,
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

        globalStore.progressByProfile[profileId] = dedupedProgress;
      }
      return new Response(
        JSON.stringify(globalStore.progressByProfile[profileId] || {}),
        {
          status: 200,
          headers: corsHeaders,
        }
      );
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
