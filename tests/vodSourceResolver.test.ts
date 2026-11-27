import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RO_EXCLUSIVE_IMDB_IDS,
  isRomanianVodTitleOrImdb,
  isFileListExclusiveRomanianVodItem,
  isRomanianVodItemShared,
  normalizeDiacriticsForOrigin,
} from '../src/shared/vodOriginPolicy.mjs';
import {
  resolvePreferredVodServer,
  planTorrentStreamFailover,
  type TorrentFailoverState,
} from '../src/services/vodSourceResolver.ts';

test('Unified Romanian origin policy covers all 22 merged IMDb IDs and diacritic titles identically on client & server', () => {
  assert.ok(RO_EXCLUSIVE_IMDB_IDS.size >= 22);
  // Previously only in deviceContinuityService.ts (missing in filelistServer.ts!)
  assert.equal(isRomanianVodTitleOrImdb({ imdbId: 'tt26745180' }), true);
  assert.equal(isRomanianVodTitleOrImdb({ imdbId: 'tt31185469' }), true);
  // Previously only in filelistServer.ts / smartTvLampaHelpers.ts (missing in deviceContinuityService.ts!)
  assert.equal(isRomanianVodTitleOrImdb({ imdbId: 'tt21603982' }), true);
  assert.equal(isRomanianVodTitleOrImdb({ imdbId: 'tt28803286' }), true);
  // Diacritics normalized consistently
  assert.equal(normalizeDiacriticsForOrigin('Chefi la Cuțite — Tătuțu'), 'chefi la cutite — tatutu');
  assert.equal(isRomanianVodTitleOrImdb({ query: 'Chefi la Cuțite S14' }), true);
  assert.equal(isRomanianVodTitleOrImdb({ query: 'Las Fierbinți' }), true);
  assert.equal(isRomanianVodTitleOrImdb({ query: 'Tătuțu PROTV.WEB-DL' }), true);
  // Non-Romanian items stay false
  assert.equal(isRomanianVodTitleOrImdb({ imdbId: 'tt0773262', query: 'Dexter' }), false);
  assert.equal(
    isFileListExclusiveRomanianVodItem({
      id: 'fl:123',
      name: 'Film RO',
      country: 'România',
      flTorrentId: 123,
    }),
    true
  );
  assert.equal(
    isRomanianVodItemShared({
      id: 'tt999',
      name: 'Test',
      country: 'Румыния',
    }),
    true
  );
});

test('resolvePreferredVodServer respects manual user override (returns null)', () => {
  const decision = resolvePreferredVodServer({
    userManuallySelectedServer: true,
    userSelectedFlTorrentId: null,
    canUseLocalTorrent: true,
    isRoVod: false,
    isForeignVod: true,
    isRuTvShow: false,
    directResolvedOk: true,
    directResolvedSourcePath: 'vk_video',
    directIsVk: true,
    directFinished: true,
    flResolvedOk: true,
    flFinished: true,
  });
  assert.equal(decision, null);
});

test('resolvePreferredVodServer picks VK Direct first for Russian TV Shows, then Kinozal VIP, then iEdem', () => {
  // 1) VK Direct ready -> kinogram_hls with audio track pref
  const vkReady = resolvePreferredVodServer({
    userManuallySelectedServer: false,
    userSelectedFlTorrentId: null,
    canUseLocalTorrent: true,
    isRoVod: false,
    isForeignVod: false,
    isRuTvShow: true,
    directResolvedOk: true,
    directResolvedSourcePath: 'vk_video:123',
    directIsVk: true,
    directFinished: true,
    flResolvedOk: true,
    flFinished: true,
  });
  assert.equal(vkReady?.server, 'kinogram_hls');
  assert.equal(vkReady?.applyPreferredAudioTrack, true);

  // 2) VK Direct finished without VK -> Kinozal VIP (filelist_torrent) on QNAP
  const kinozalSecond = resolvePreferredVodServer({
    userManuallySelectedServer: false,
    userSelectedFlTorrentId: null,
    canUseLocalTorrent: true,
    isRoVod: false,
    isForeignVod: false,
    isRuTvShow: true,
    directResolvedOk: true,
    directResolvedSourcePath: 'iedem_vod',
    directIsVk: false,
    directFinished: true,
    flResolvedOk: true,
    flFinished: true,
  });
  assert.equal(kinozalSecond?.server, 'filelist_torrent');

  // 3) Both VK and Kinozal unavailable -> iEdem / Direct fallback
  const iedemFallback = resolvePreferredVodServer({
    userManuallySelectedServer: false,
    userSelectedFlTorrentId: null,
    canUseLocalTorrent: true,
    isRoVod: false,
    isForeignVod: false,
    isRuTvShow: true,
    directResolvedOk: true,
    directResolvedSourcePath: 'iedem_vod',
    directIsVk: false,
    directFinished: true,
    flResolvedOk: false,
    flFinished: true,
  });
  assert.equal(iedemFallback?.server, 'kinogram_hls');
});

test('resolvePreferredVodServer picks Kinozal VIP #1 for Russian movies/series and FileList #1 for Foreign on QNAP', () => {
  const ruSeries = resolvePreferredVodServer({
    userManuallySelectedServer: false,
    userSelectedFlTorrentId: null,
    canUseLocalTorrent: true,
    isRoVod: false,
    isForeignVod: false,
    isRuTvShow: false,
    directResolvedOk: true,
    directResolvedSourcePath: 'iedem_vod',
    directIsVk: false,
    directFinished: true,
    flResolvedOk: true,
    flFinished: true,
  });
  assert.equal(ruSeries?.server, 'filelist_torrent');

  const foreignOnCloud = resolvePreferredVodServer({
    userManuallySelectedServer: false,
    userSelectedFlTorrentId: null,
    canUseLocalTorrent: false,
    isRoVod: false,
    isForeignVod: true,
    isRuTvShow: false,
    directResolvedOk: true,
    directResolvedSourcePath: 'kinogram',
    directIsVk: false,
    directFinished: true,
    flResolvedOk: false,
    flFinished: true,
  });
  assert.equal(foreignOnCloud?.server, 'kinogram_hls');
});

test('resolvePreferredVodServer prefers FileList on LAN for Romanian VOD when direct is SD (<1080p)', () => {
  const roOnLan = resolvePreferredVodServer({
    userManuallySelectedServer: false,
    userSelectedFlTorrentId: null,
    canUseLocalTorrent: true,
    isRoVod: true,
    isForeignVod: false,
    isRuTvShow: false,
    directResolvedOk: true,
    directResolvedSourcePath: 'vidmoly_720p',
    directIsVk: false,
    directFinished: true,
    flResolvedOk: true,
    flFinished: true,
  });
  assert.equal(roOnLan?.server, 'filelist_torrent');

  const roFullHdCloud = resolvePreferredVodServer({
    userManuallySelectedServer: false,
    userSelectedFlTorrentId: null,
    canUseLocalTorrent: true,
    isRoVod: true,
    isForeignVod: false,
    isRuTvShow: false,
    directResolvedOk: true,
    directResolvedSourcePath: 'vidmoly_1080p',
    directIsVk: false,
    directFinished: true,
    flResolvedOk: true,
    flFinished: true,
  });
  assert.equal(roFullHdCloud?.server, 'kinogram_hls');
});

test('planTorrentStreamFailover prefers fast 1080p non-HEVC, never repeats IDs, caps at 2 switches, then falls back to direct', () => {
  const torrents = [
    { id: 101, quality: '4K UHD', releaseTitle: 'Movie.2160p.HEVC', seeders: 25 },
    { id: 102, quality: '1080p Full HD', releaseTitle: 'Movie.1080p.x265.HEVC', seeders: 30 },
    { id: 103, quality: '1080p Full HD', releaseTitle: 'Movie.1080p.WEB-DL.H264', seeders: 12 },
    { id: 104, quality: '720p HD', releaseTitle: 'Movie.720p.x264', seeders: 0 }, // 0 seeders ignored!
    { id: 105, quality: '720p HD', releaseTitle: 'Movie.720p.x264', seeders: 8 },
  ];

  let state: TorrentFailoverState = { key: '', failedIds: new Set() };

  // Fail #1 on 4K HEVC (101) -> jumps straight to fast 1080p H.264 (103), skipping 102 HEVC!
  const step1 = planTorrentStreamFailover(state, {
    episodeKey: 'tt0773262_1_1',
    failedTorrentId: 101,
    torrents,
    directStreamAvailable: true,
  });
  assert.equal(step1.action, 'switch_torrent');
  assert.equal(step1.torrentId, 103);
  state = step1.nextState;

  // Fail #2 on 103 -> picks next seeded candidate (102), never repeating 101 or 103
  const step2 = planTorrentStreamFailover(state, {
    episodeKey: 'tt0773262_1_1',
    failedTorrentId: 103,
    torrents,
    directStreamAvailable: true,
  });
  assert.equal(step2.action, 'switch_torrent');
  assert.equal(step2.torrentId, 102);
  state = step2.nextState;

  // Fail #3 on 102 -> failedIds.size becomes 3 (> 2 max switches) -> falls back to kinogram_hls!
  const step3 = planTorrentStreamFailover(state, {
    episodeKey: 'tt0773262_1_1',
    failedTorrentId: 102,
    torrents,
    directStreamAvailable: true,
  });
  assert.equal(step3.action, 'fallback_direct');
  assert.equal(step3.server, 'kinogram_hls');
  state = step3.nextState;

  // Changing to Episode 2 resets failedIds cleanly!
  const stepEp2 = planTorrentStreamFailover(state, {
    episodeKey: 'tt0773262_1_2',
    failedTorrentId: 101,
    torrents,
    directStreamAvailable: false,
  });
  assert.equal(stepEp2.action, 'switch_torrent');
  assert.equal(stepEp2.torrentId, 103);
  assert.equal(stepEp2.nextState.failedIds.size, 1);
});
