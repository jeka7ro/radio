/**
 * Canonical isomorphic continuity & watch-progress sync logic.
 *
 * Zero external dependencies — imported directly by:
 *   - Browser client (`src/views/smartTvLampaHelpers.ts`, `MediatecaView.tsx`, `SmartTvLampaViewCore.tsx`)
 *   - Netlify Serverless Functions (`netlify/functions/tv-sync.mjs`)
 *   - Vite dev middleware (`vite.config.ts`) & QNAP stream server
 */

export function isAdult18VodItem(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.isAdult18 === true || item.isAdultKlubnichka === true) return true;
  if (String(item.id || '').startsWith('klub_')) return true;
  if (
    Array.isArray(item.genres) &&
    item.genres.some((g) => /^erotic$/i.test(String(g || '').trim()))
  ) {
    return true;
  }
  return false;
}

/**
 * Strict denylist compaction: strips heavy Cinemeta catalog bloat (videos, cast,
 * links, trailers, awards, behaviorHints, long descriptions, dirty genres) while
 * preserving ALL playback/routing/badge fields (`iedemFid`, `iedemStreamUrl`,
 * `year`, `flTorrentId`, `qualityBadge`, `klubnichkaRawId`, `isAdult18`, etc.).
 */
export function compactProgressItem(item) {
  if (!item || typeof item !== 'object') return item;
  const clean = { ...item };
  delete clean.videos;
  delete clean.links;
  delete clean.trailers;
  delete clean.trailerStreams;
  delete clean.popularities;
  delete clean.cast;
  delete clean.director;
  delete clean.writer;
  delete clean.awards;
  delete clean.behaviorHints;
  if (typeof clean.description === 'string' && clean.description.length > 320) {
    clean.description = clean.description.slice(0, 320);
  }
  if (Array.isArray(clean.genres)) {
    const cleanGenres = [];
    for (const g of clean.genres) {
      if (typeof g !== 'string') continue;
      const t = g.trim();
      if (!t || t.length > 40 || t.includes('\uFFFD')) continue;
      if (!cleanGenres.includes(t)) cleanGenres.push(t);
      if (cleanGenres.length >= 8) break;
    }
    if (cleanGenres.length > 0) clean.genres = cleanGenres;
    else delete clean.genres;
  }
  return clean;
}

export function areVodItemsSame(a, b) {
  if (!a || !b) return false;
  if (a.type && b.type && a.type !== b.type) return false;

  const aId = String(a.id || '').trim();
  const bId = String(b.id || '').trim();
  if (aId && bId && aId === bId) return true;

  const aImdb = String(a.imdbId || a.imdb_id || (aId.startsWith('tt') ? aId : '')).trim();
  const bImdb = String(b.imdbId || b.imdb_id || (bId.startsWith('tt') ? bId : '')).trim();
  if (aImdb.startsWith('tt') && bImdb.startsWith('tt')) {
    return aImdb === bImdb;
  }

  const aKp = String(a.kpId || (aId.startsWith('kp_') ? aId.replace('kp_', '') : '')).trim();
  const bKp = String(b.kpId || (bId.startsWith('kp_') ? bId.replace('kp_', '') : '')).trim();
  if (aKp && bKp) {
    return aKp === bKp;
  }

  const aTitles = [a.name, a.title, a.nameOriginal]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase().trim());
  const bTitles = [b.name, b.title, b.nameOriginal]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase().trim());
  if (aTitles.some((t1) => bTitles.some((t2) => t1 === t2 && t1.length > 2))) {
    return true;
  }

  return false;
}

export function getVodCanonicalKey(itemOrEntry) {
  if (!itemOrEntry || typeof itemOrEntry !== 'object') return null;
  const item = 'item' in itemOrEntry ? itemOrEntry.item : itemOrEntry;
  if (!item || typeof item !== 'object') return null;

  const rawId = String(item.id || '').trim();
  const rawImdb = String(item.imdbId || item.imdb_id || '').trim();
  if (rawImdb.startsWith('tt')) return rawImdb;
  if (rawId.startsWith('tt')) return rawId;

  const kpId = String(item.kpId || '').trim();
  if (kpId) return `kp_${kpId}`;
  if (rawId.startsWith('kp_')) return rawId;

  return rawId || null;
}

/**
 * True ONLY when an entry represents an explicit user "Reset / Clear progress"
 * (`currentTime === 0`, `isWatched === false`, and no episode has time or watched flag).
 */
export function isProgressEntryCleared(entry) {
  if (!entry || typeof entry !== 'object') return false;
  return (
    (entry.currentTime || 0) === 0 &&
    entry.isWatched === false &&
    (!entry.episodeProgressMap ||
      Object.values(entry.episodeProgressMap).every(
        (ep) => (ep?.currentTime || 0) === 0 && !ep?.isWatched
      ))
  );
}

export function mergeEpisodeProgressMaps(baseEpMap, incomingEpMap) {
  const merged = { ...(baseEpMap || {}) };
  if (incomingEpMap && typeof incomingEpMap === 'object') {
    for (const [epK, epV] of Object.entries(incomingEpMap)) {
      if (!epV || typeof epV !== 'object') continue;
      const prevEp = merged[epK];
      if (!prevEp || (Number(epV.updatedAt) || 0) >= (Number(prevEp.updatedAt) || 0)) {
        merged[epK] = epV;
      }
    }
  }
  return merged;
}

export function mergeTwoProgressEntries(base, incoming) {
  const baseTime = Number(base?.updatedAt) || 0;
  const incTime = Number(incoming?.updatedAt) || 0;

  // Explicit user clear wins symmetrically in BOTH directions so stale snapshots never resurrect wiped episodes
  if (isProgressEntryCleared(incoming) && incTime >= baseTime) {
    return incoming;
  }
  if (isProgressEntryCleared(base) && baseTime > incTime) {
    return base;
  }

  const preferIncoming = incTime >= baseTime;
  const primary = preferIncoming ? incoming : base;
  const secondary = preferIncoming ? base : incoming;

  const mergedEpMap = mergeEpisodeProgressMaps(
    secondary?.episodeProgressMap,
    primary?.episodeProgressMap
  );
  const hasEpMap =
    Object.keys(mergedEpMap).length > 0 ||
    Boolean(primary?.episodeProgressMap) ||
    Boolean(secondary?.episodeProgressMap);

  const pItem = primary?.item || {};
  const sItem = secondary?.item || {};
  const preserveAdult18 = isAdult18VodItem(pItem) || isAdult18VodItem(sItem);
  const preserveAdultKlub = Boolean(pItem.isAdultKlubnichka || sItem.isAdultKlubnichka);

  const resolvedImdb =
    pItem.imdbId ||
    sItem.imdbId ||
    (String(pItem.id || '').startsWith('tt')
      ? pItem.id
      : String(sItem.id || '').startsWith('tt')
        ? sItem.id
        : undefined);
  const resolvedKp = pItem.kpId || sItem.kpId;
  const canonicalId =
    resolvedImdb && String(resolvedImdb).startsWith('tt')
      ? resolvedImdb
      : String(pItem.id || '').startsWith('tt')
        ? pItem.id
        : String(sItem.id || '').startsWith('tt')
          ? sItem.id
          : pItem.id || sItem.id;

  const mergedItem =
    primary?.item || secondary?.item
      ? {
          ...sItem,
          ...pItem,
          ...(preserveAdult18 ? { isAdult18: true } : {}),
          ...(preserveAdultKlub ? { isAdultKlubnichka: true } : {}),
          ...(canonicalId ? { id: canonicalId } : {}),
          ...(resolvedImdb ? { imdbId: resolvedImdb } : {}),
          ...(resolvedKp ? { kpId: resolvedKp } : {}),
          ...(pItem.flTorrentId || sItem.flTorrentId
            ? { flTorrentId: pItem.flTorrentId || sItem.flTorrentId }
            : {}),
          ...(pItem.releaseTitle || sItem.releaseTitle
            ? { releaseTitle: pItem.releaseTitle || sItem.releaseTitle }
            : {}),
          ...(pItem.poster || sItem.poster
            ? { poster: pItem.poster || sItem.poster }
            : {}),
          ...(pItem.background || sItem.background
            ? { background: pItem.background || sItem.background }
            : {}),
        }
      : undefined;

  const sameEp =
    primary?.season === secondary?.season &&
    primary?.episode === secondary?.episode;
  const primaryCur = primary?.currentTime || 0;
  const secondaryCur = secondary?.currentTime || 0;
  const strictlyNewer = Math.abs(incTime - baseTime) > 1500;
  const targetCurrentTime = strictlyNewer
    ? primaryCur
    : sameEp
      ? Math.max(primaryCur, secondaryCur)
      : primaryCur <= 10 && secondaryCur > 10
        ? secondaryCur
        : primaryCur;

  const maxDuration = Math.max(primary?.duration || 0, secondary?.duration || 0);
  const maxSeasons =
    Math.max(primary?.totalSeasons || 0, secondary?.totalSeasons || 0) ||
    primary?.totalSeasons ||
    secondary?.totalSeasons;

  return {
    ...secondary,
    ...primary,
    ...(mergedItem ? { item: mergedItem } : {}),
    currentTime: targetCurrentTime,
    isWatched: strictlyNewer
      ? primary?.isWatched
      : primary?.isWatched ?? secondary?.isWatched,
    ...(maxDuration > 0 || primary?.duration !== undefined || secondary?.duration !== undefined
      ? { duration: maxDuration }
      : {}),
    ...(primary?.totalEpisodesInSeason || secondary?.totalEpisodesInSeason
      ? {
          totalEpisodesInSeason:
            primary?.totalEpisodesInSeason || secondary?.totalEpisodesInSeason,
        }
      : {}),
    ...(maxSeasons ? { totalSeasons: maxSeasons } : {}),
    ...(hasEpMap ? { episodeProgressMap: mergedEpMap } : {}),
    updatedAt: Math.max(baseTime, incTime),
  };
}

export function deduplicateProgressMap(map, options = {}) {
  if (!map || typeof map !== 'object') return {};
  const shouldCompact = options.compact === true;
  const result = {};
  const groups = [];

  for (const [pk, entry] of Object.entries(map)) {
    if (!entry || typeof entry !== 'object' || !entry.item) {
      if (entry && typeof entry === 'object') {
        result[pk] = entry;
      }
      continue;
    }
    let matched = null;
    for (const group of groups) {
      if (areVodItemsSame(group[0]?.item, entry.item)) {
        matched = group;
        break;
      }
    }
    if (matched) {
      matched.push(entry);
    } else {
      groups.push([entry]);
    }
  }

  for (const group of groups) {
    let fin = group[0];
    if (group.length > 1) {
      for (let i = 1; i < group.length; i++) {
        fin = mergeTwoProgressEntries(fin, group[i]);
      }
    } else if (
      fin.item?.imdbId &&
      String(fin.item.imdbId).startsWith('tt') &&
      !String(fin.item.id || '').startsWith('tt')
    ) {
      fin = { ...fin, item: { ...fin.item, id: fin.item.imdbId } };
    }
    const targetKey = getVodCanonicalKey(fin) || fin.item?.id;
    if (targetKey) {
      result[targetKey] =
        shouldCompact && fin.item
          ? { ...fin, item: compactProgressItem(fin.item) }
          : fin;
    }
  }

  return result;
}

export function dedupeAndMergeProgressMaps(baseMap, incomingMap) {
  const merged = { ...(baseMap || {}) };
  for (const [k, v] of Object.entries(incomingMap || {})) {
    if (!v || typeof v !== 'object') continue;
    const existing = merged[k];
    if (!existing) {
      merged[k] = v;
      continue;
    }
    if (isProgressEntryCleared(v) && (Number(v.updatedAt) || 0) >= (Number(existing.updatedAt) || 0)) {
      merged[k] = v;
      continue;
    }
    merged[k] = mergeTwoProgressEntries(existing, v);
  }
  return deduplicateProgressMap(merged, { compact: true });
}

export function mergeTwoProfileRecords(a, b) {
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

export function normalizeProfileUniqueName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function mergeProfileListsWithTombstones(lists, deletedMap = {}) {
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
        if (
          prevNormName &&
          prevNormName !== mergedNormName &&
          idByNormName.get(prevNormName) === p.id
        ) {
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

export function dedupeAndMergeSavedLists(lists) {
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
