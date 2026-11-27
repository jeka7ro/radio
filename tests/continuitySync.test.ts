import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compactProgressItem,
  areVodItemsSame,
  getVodCanonicalKey,
  isProgressEntryCleared,
  mergeTwoProgressEntries,
  deduplicateProgressMap,
  dedupeAndMergeProgressMaps,
  mergeProfileListsWithTombstones,
  dedupeAndMergeSavedLists,
} from '../src/shared/continuitySync.mjs';

test('compactProgressItem strips heavy Cinemeta bloat while preserving playback routing fields', () => {
  const bloated = {
    id: 'tt1234567',
    type: 'series',
    name: 'Dexter',
    year: 2024,
    imdbId: 'tt1234567',
    iedemFid: '987654',
    iedemStreamUrl: 'https://cdn.example/stream.m3u8',
    flTorrentId: 931746,
    qualityBadge: '4K HDR',
    description: 'A'.repeat(500),
    genres: ['Drama', 'Crime', 'Drama', 'Bad\uFFFDGenre', 'X'.repeat(50), 'Thriller'],
    videos: [{ id: 'ep1' }],
    links: [{ name: 'IMDb' }],
    trailers: [{ source: 'yt' }],
    trailerStreams: [{ title: 't' }],
    popularities: { trakt: 99 },
    cast: ['Actor 1', 'Actor 2'],
    director: ['Dir'],
    writer: ['Wri'],
    awards: '10 wins',
    behaviorHints: { defaultVideoId: 'tt1' },
  };

  const compact = compactProgressItem(bloated);
  assert.equal(compact.videos, undefined);
  assert.equal(compact.links, undefined);
  assert.equal(compact.cast, undefined);
  assert.equal(compact.behaviorHints, undefined);
  assert.equal(compact.description.length, 320);
  assert.deepEqual(compact.genres, ['Drama', 'Crime', 'Thriller']);
  // Preserved critical fields:
  assert.equal(compact.iedemFid, '987654');
  assert.equal(compact.iedemStreamUrl, 'https://cdn.example/stream.m3u8');
  assert.equal(compact.flTorrentId, 931746);
  assert.equal(compact.qualityBadge, '4K HDR');
  assert.equal(compact.year, 2024);
});

test('dedupeAndMergeProgressMaps merges episodeProgressMap by newest updatedAt per episode', () => {
  const base = {
    tt0773262: {
      item: { id: 'tt0773262', type: 'series', name: 'Dexter' },
      season: 1,
      episode: 1,
      currentTime: 600,
      duration: 3000,
      updatedAt: 10_000,
      episodeProgressMap: {
        S1E1: { currentTime: 600, duration: 3000, isWatched: false, updatedAt: 10_000 },
        S1E2: { currentTime: 1800, duration: 3000, isWatched: false, updatedAt: 20_000 },
      },
    },
  };
  const incoming = {
    tt0773262: {
      item: { id: 'tt0773262', type: 'series', name: 'Dexter' },
      season: 1,
      episode: 1,
      currentTime: 2900,
      duration: 3000,
      updatedAt: 30_000,
      episodeProgressMap: {
        S1E1: { currentTime: 2900, duration: 3000, isWatched: true, updatedAt: 30_000 },
        S1E2: { currentTime: 100, duration: 3000, isWatched: false, updatedAt: 5_000 },
      },
    },
  };

  const merged = dedupeAndMergeProgressMaps(base, incoming);
  assert.equal(merged.tt0773262.episodeProgressMap.S1E1.currentTime, 2900);
  assert.equal(merged.tt0773262.episodeProgressMap.S1E1.isWatched, true);
  // S1E2 in base (updatedAt 20_000) beats older incoming S1E2 (updatedAt 5_000)
  assert.equal(merged.tt0773262.episodeProgressMap.S1E2.currentTime, 1800);
});

test('isProgressEntryCleared requires isWatched === false so newly-marked-watched item does not wipe episodes', () => {
  const explicitlyCleared = {
    item: { id: 'tt111', type: 'series', name: 'Show' },
    currentTime: 0,
    isWatched: false,
    episodeProgressMap: {},
    updatedAt: 50_000,
  };
  const markedWatchedAtZero = {
    item: { id: 'tt111', type: 'series', name: 'Show' },
    currentTime: 0,
    isWatched: true,
    episodeProgressMap: {},
    updatedAt: 50_000,
  };
  assert.equal(isProgressEntryCleared(explicitlyCleared), true);
  assert.equal(isProgressEntryCleared(markedWatchedAtZero), false);

  const base = {
    tt111: {
      item: { id: 'tt111', type: 'series', name: 'Show' },
      currentTime: 1200,
      isWatched: false,
      updatedAt: 10_000,
      episodeProgressMap: {
        S1E1: { currentTime: 1200, duration: 2400, isWatched: false, updatedAt: 10_000 },
      },
    },
  };
  const clearedMerged = dedupeAndMergeProgressMaps(base, { tt111: explicitlyCleared });
  assert.equal(clearedMerged.tt111.currentTime, 0);
  assert.deepEqual(clearedMerged.tt111.episodeProgressMap, {});

  const watchedMerged = dedupeAndMergeProgressMaps(base, { tt111: markedWatchedAtZero });
  assert.equal(watchedMerged.tt111.isWatched, true);
  assert.equal(watchedMerged.tt111.episodeProgressMap.S1E1.currentTime, 1200);

  // Symmetric check: newer cleared base must NEVER be resurrected by stale incoming progress
  const staleIncoming = {
    tt111: {
      item: { id: 'tt111', type: 'series', name: 'Show' },
      currentTime: 1200,
      isWatched: false,
      updatedAt: 10_000,
      episodeProgressMap: {
        S1E1: { currentTime: 1200, duration: 2400, isWatched: false, updatedAt: 10_000 },
      },
    },
  };
  const symmetricMerged = dedupeAndMergeProgressMaps(
    { tt111: explicitlyCleared },
    staleIncoming
  );
  assert.equal(symmetricMerged.tt111.currentTime, 0);
  assert.deepEqual(symmetricMerged.tt111.episodeProgressMap, {});
});

test('deduplicateProgressMap merges duplicate kp_ and tt_ entries into single canonical IMDb key', () => {
  const map = {
    kp_12345: {
      item: { id: 'kp_12345', kpId: '12345', imdbId: 'tt0903747', type: 'series', name: 'Breaking Bad' },
      season: 1,
      episode: 2,
      currentTime: 500,
      duration: 2800,
      updatedAt: 10_000,
      episodeProgressMap: {
        S1E2: { currentTime: 500, duration: 2800, isWatched: false, updatedAt: 10_000 },
      },
    },
    tt0903747: {
      item: { id: 'tt0903747', type: 'series', name: 'Breaking Bad', flTorrentId: 777 },
      season: 1,
      episode: 3,
      currentTime: 1200,
      duration: 2800,
      updatedAt: 25_000,
      episodeProgressMap: {
        S1E3: { currentTime: 1200, duration: 2800, isWatched: false, updatedAt: 25_000 },
      },
    },
  };

  const deduped = deduplicateProgressMap(map);
  assert.deepEqual(Object.keys(deduped), ['tt0903747']);
  assert.equal(deduped.tt0903747.episode, 3);
  assert.equal(deduped.tt0903747.item.kpId, '12345');
  assert.equal(deduped.tt0903747.item.flTorrentId, 777);
  assert.equal(deduped.tt0903747.episodeProgressMap.S1E2.currentTime, 500);
  assert.equal(deduped.tt0903747.episodeProgressMap.S1E3.currentTime, 1200);
  assert.equal(getVodCanonicalKey(deduped.tt0903747), 'tt0903747');
  assert.equal(areVodItemsSame(map.kp_12345.item, map.tt0903747.item), true);
});

test('mergeTwoProgressEntries preserves isAdult18 flag across merge even if newer entry lacks it', () => {
  const base = {
    item: { id: 'tt9999999', type: 'movie', name: 'Late Night', isAdult18: true },
    currentTime: 100,
    updatedAt: 1000,
  };
  const incoming = {
    item: { id: 'tt9999999', type: 'movie', name: 'Late Night' },
    currentTime: 500,
    updatedAt: 5000,
  };
  const merged = mergeTwoProgressEntries(base, incoming);
  assert.equal(merged.item.isAdult18, true);
  assert.equal(merged.currentTime, 500);
});

test('mergeProfileListsWithTombstones respects deletion tombstones while protecting admin p1', () => {
  const listA = [
    { id: 'p1', name: 'Jeka', updatedAt: 1000 },
    { id: 'p2', name: 'DeletedGuest', updatedAt: 1000 },
    { id: 'p3', name: 'Kids', updatedAt: 1000 },
  ];
  const listB = [
    { id: 'p1', name: 'Jeka', defaultSubLang: 'ro', updatedAt: 2000 },
    { id: 'p2', name: 'DeletedGuest', updatedAt: 1500 },
    { id: 'p4', name: 'kids', updatedAt: 2000 }, // duplicate normalized name should be skipped
  ];
  const deletedMap = { p1: 99999, p2: 2000 };

  const merged = mergeProfileListsWithTombstones([listA, listB], deletedMap);
  const ids = merged.map((p) => p.id);
  assert.deepEqual(ids, ['p1', 'p3']);
  assert.equal(merged[0].defaultSubLang, 'ro');
});

test('dedupeAndMergeSavedLists preserves first-seen order and removes duplicate IDs', () => {
  const merged = dedupeAndMergeSavedLists([
    [{ id: 'tt1', name: 'A' }, { id: 'tt2', name: 'B' }],
    [{ id: 'tt2', name: 'B dup' }, { id: 'tt3', name: 'C' }],
  ]);
  assert.deepEqual(
    merged.map((x) => x.id),
    ['tt1', 'tt2', 'tt3']
  );
});
