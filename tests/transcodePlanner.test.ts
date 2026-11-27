import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planMediaTranscode,
  needsRangeServerForInput,
} from '../src/server/transcodePlanner.ts';

const QNAP_HOST = {
  platform: 'linux',
  vaapiAvailable: true,
  vaapiDevicePath: '/dev/dri/renderD128',
};

const MAC_HOST = {
  platform: 'darwin',
  vaapiAvailable: false,
  vaapiDevicePath: '/dev/dri/renderD128',
};

const CPU_HOST = {
  platform: 'linux',
  vaapiAvailable: false,
  vaapiDevicePath: '/dev/dri/renderD128',
};

test('1080p H.264 uses zero-CPU direct copy for both fMP4 and Safari HLS', () => {
  const fmp4 = planMediaTranscode({
    fileName: 'Movie.2026.1080p.WEB-DL.DDP5.1.H.264.mkv',
    fileLength: 4_000_000_000,
    startSec: 0,
    audioIdx: 0,
    hasExplicitAudioParam: false,
    wantOrigAudio: true,
    capTo1080p: true,
    forceVideoTranscode: false,
    host: QNAP_HOST,
    output: { format: 'fmp4' },
  });
  assert.equal(fmp4.needsVideoTranscode, false);
  assert.equal(fmp4.useVaapi, false);
  assert.equal(fmp4.useDirectPipe, true);
  assert.ok(fmp4.ffArgs.includes('-c:v') && fmp4.ffArgs[fmp4.ffArgs.indexOf('-c:v') + 1] === 'copy');
  assert.ok(fmp4.ffArgs.includes('pipe:0'));
  assert.ok(fmp4.ffArgs.includes('frag_keyframe+empty_moov+default_base_moof'));

  const hls = planMediaTranscode({
    fileName: 'Movie.2026.1080p.WEB-DL.DDP5.1.H.264.mkv',
    fileLength: 4_000_000_000,
    startSec: 0,
    audioIdx: 0,
    hasExplicitAudioParam: false,
    wantOrigAudio: true,
    capTo1080p: true,
    forceVideoTranscode: false,
    host: QNAP_HOST,
    output: {
      format: 'hls',
      segmentFilename: '/tmp/hls/seg_%05d.ts',
      playlistPath: '/tmp/hls/stream.m3u8',
    },
  });
  assert.equal(hls.needsVideoTranscode, false);
  assert.equal(hls.useVaapi, false);
  assert.ok(hls.ffArgs.includes('h264_mp4toannexb'));
  assert.ok(hls.ffArgs.includes('/tmp/hls/stream.m3u8'));
});

test('4K HEVC on QNAP uses full GPU VA-API decode+scale+encode without CPU hwupload', () => {
  const plan = planMediaTranscode({
    fileName: 'Dexter.Resurrection.S01E05.2160p.WEB-DL.DD+5.1.H.265.mkv',
    fileLength: 5_400_000_000,
    startSec: 0,
    audioIdx: 0,
    hasExplicitAudioParam: false,
    wantOrigAudio: true,
    capTo1080p: true,
    forceVideoTranscode: false,
    host: QNAP_HOST,
    output: { format: 'fmp4' },
  });
  assert.equal(plan.isHevc, true);
  assert.equal(plan.useVaapi, true);
  assert.ok(plan.ffArgs.includes('-hwaccel'));
  assert.ok(plan.ffArgs.includes('vaapi'));
  assert.ok(plan.ffArgs.includes('-hwaccel_output_format'));
  assert.equal(plan.ffArgs.includes('-vaapi_device'), false);
  const vf = plan.ffArgs[plan.ffArgs.indexOf('-vf') + 1];
  assert.equal(vf, "scale_vaapi=w='min(1920,iw)':h=-2:format=nv12");
  assert.equal(vf.includes('hwupload'), false);
});

test('HLS drift bug #1 fixed: 10-bit/AV1/VP9 on QNAP HLS falls back to safe hwupload instead of crashing VA-API decode', () => {
  const plan = planMediaTranscode({
    fileName: 'Anime.2026.1080p.10bit.AV1.mkv',
    fileLength: 2_000_000_000,
    probe: { durationSec: 1500, videoCodec: 'av1', audioTracks: [] },
    startSec: 0,
    audioIdx: 0,
    hasExplicitAudioParam: false,
    wantOrigAudio: true,
    capTo1080p: true,
    forceVideoTranscode: false,
    host: QNAP_HOST,
    output: {
      format: 'hls',
      segmentFilename: '/tmp/hls/seg_%05d.ts',
      playlistPath: '/tmp/hls/stream.m3u8',
    },
  });
  assert.equal(plan.is10BitOrAltCodec, true);
  assert.equal(plan.needsVideoTranscode, true);
  assert.equal(plan.useVaapi, true);
  assert.equal(plan.ffArgs.includes('-hwaccel_output_format'), false);
  assert.ok(plan.ffArgs.includes('-vaapi_device'));
  const vf = plan.ffArgs[plan.ffArgs.indexOf('-vf') + 1];
  assert.ok(vf.startsWith('format=nv12,hwupload,scale_vaapi='));
});

test('HLS drift bug #2 fixed: 4K video probed as H.264 is not misclassified as HEVC', () => {
  const plan = planMediaTranscode({
    fileName: 'Documentary.2160p.WEB-DL.mkv',
    fileLength: 8_000_000_000,
    probe: { durationSec: 3600, videoCodec: 'h264', audioTracks: [] },
    startSec: 0,
    audioIdx: 0,
    hasExplicitAudioParam: false,
    wantOrigAudio: true,
    capTo1080p: false,
    forceVideoTranscode: false,
    host: QNAP_HOST,
    output: {
      format: 'hls',
      segmentFilename: '/tmp/hls/seg_%05d.ts',
      playlistPath: '/tmp/hls/stream.m3u8',
    },
  });
  assert.equal(plan.isHevc, false);
  assert.equal(plan.needsVideoTranscode, false);
  assert.ok(plan.ffArgs.includes('-c:v') && plan.ffArgs[plan.ffArgs.indexOf('-c:v') + 1] === 'copy');
});

test('HLS drift bug #3 fixed: wantOrigAudio selects original EN track over RU dub on Safari HLS', () => {
  const plan = planMediaTranscode({
    fileName: 'Movie.2026.1080p.MVO.RU.ENG.mkv',
    fileLength: 6_000_000_000,
    probe: {
      durationSec: 6400,
      videoCodec: 'h264',
      audioTracks: [
        { index: 0, lang: 'RUS', codec: 'AC3', title: 'Дубляж', label: 'RUS (AC3 5.1) — Дубляж' },
        { index: 1, lang: 'ENG', codec: 'EAC3', title: 'Original', label: 'ORIGINAL • ENG (EAC3 5.1)' },
      ],
    },
    startSec: 0,
    audioIdx: 0,
    hasExplicitAudioParam: false,
    wantOrigAudio: true,
    capTo1080p: false,
    forceVideoTranscode: false,
    host: QNAP_HOST,
    output: {
      format: 'hls',
      segmentFilename: '/tmp/hls/seg_%05d.ts',
      playlistPath: '/tmp/hls/stream.m3u8',
    },
  });
  assert.equal(plan.safeAudioIdx, 1);
  assert.ok(plan.ffArgs.includes('0:a:1?'));
});

test('HLS drift bug #4 fixed: capTo1080p caps 4K HEVC scale to 1920 on HLS', () => {
  const plan = planMediaTranscode({
    fileName: 'Movie.2026.2160p.HEVC.mkv',
    fileLength: 14_000_000_000,
    startSec: 0,
    audioIdx: 0,
    hasExplicitAudioParam: false,
    wantOrigAudio: true,
    capTo1080p: true,
    forceVideoTranscode: false,
    host: QNAP_HOST,
    output: {
      format: 'hls',
      segmentFilename: '/tmp/hls/seg_%05d.ts',
      playlistPath: '/tmp/hls/stream.m3u8',
    },
  });
  const vf = plan.ffArgs[plan.ffArgs.indexOf('-vf') + 1];
  assert.equal(vf, "scale_vaapi=w='min(1920,iw)':h=-2:format=nv12");
  assert.equal(plan.ffArgs[plan.ffArgs.indexOf('-b:v') + 1], '8M');
});

test('Seek on uncached MKV requires range server; seek on uncached MPEG-TS uses 188-byte aligned direct pipe', () => {
  assert.equal(needsRangeServerForInput('Movie.mkv', null, 120), true);
  assert.equal(needsRangeServerForInput('Movie.mkv', '/ssd/Movie.mkv', 120), false);
  assert.equal(needsRangeServerForInput('Show.ts', null, 120), false);

  const mkvSeek = planMediaTranscode({
    fileName: 'Movie.mkv',
    fileLength: 4_000_000_000,
    startSec: 125.7,
    audioIdx: 0,
    hasExplicitAudioParam: false,
    wantOrigAudio: true,
    capTo1080p: false,
    forceVideoTranscode: false,
    rangeUrl: 'http://127.0.0.1:45555/raw?id=1&fileIdx=0',
    host: MAC_HOST,
    output: { format: 'fmp4' },
  });
  assert.equal(mkvSeek.useDirectPipe, false);
  assert.ok(mkvSeek.ffArgs.includes('-noaccurate_seek'));
  assert.equal(mkvSeek.ffArgs[mkvSeek.ffArgs.indexOf('-ss') + 1], '125');
  assert.ok(mkvSeek.ffArgs.includes('http://127.0.0.1:45555/raw?id=1&fileIdx=0'));

  const tsSeek = planMediaTranscode({
    fileName: 'Show.ts',
    fileLength: 1_880_000_000,
    probe: { durationSec: 2000, videoCodec: 'h264', audioTracks: [] },
    startSec: 200,
    audioIdx: 0,
    hasExplicitAudioParam: false,
    wantOrigAudio: false,
    capTo1080p: false,
    forceVideoTranscode: false,
    host: CPU_HOST,
    output: { format: 'fmp4' },
  });
  assert.equal(tsSeek.useDirectPipe, true);
  assert.equal(tsSeek.directPipeStartByte % 188, 0);
  assert.ok(tsSeek.directPipeStartByte > 0);
});

test('Embedded live subtitle track enables -copyts and pipe:3 WebVTT stream', () => {
  const plan = planMediaTranscode({
    fileName: 'Movie.1080p.mkv',
    fileLength: 3_000_000_000,
    startSec: 0,
    audioIdx: 0,
    hasExplicitAudioParam: false,
    wantOrigAudio: true,
    capTo1080p: false,
    forceVideoTranscode: false,
    liveSubTrackIndex: 2,
    host: MAC_HOST,
    output: { format: 'fmp4' },
  });
  assert.ok(plan.ffArgs.includes('-copyts'));
  assert.ok(plan.ffArgs.includes('0:s:2'));
  assert.ok(plan.ffArgs.includes('pipe:3'));
});
