export interface ProbedAudioTrack {
  index: number;
  lang: string;
  codec: string;
  title: string;
  label: string;
}

export interface MediaProbeInfo {
  durationSec?: number;
  videoCodec?: string;
  audioTracks?: ProbedAudioTrack[];
}

export interface TranscodeHostCaps {
  platform: string;
  vaapiAvailable: boolean;
  vaapiDevicePath: string;
}

export type TranscodeOutputTarget =
  | { format: 'fmp4' }
  | { format: 'hls'; segmentFilename: string; playlistPath: string };

export interface MediaTranscodeInput {
  fileName: string;
  fileLength: number;
  probe?: MediaProbeInfo;
  startSec: number;
  audioIdx: number;
  hasExplicitAudioParam: boolean;
  wantOrigAudio: boolean;
  capTo1080p: boolean;
  forceVideoTranscode: boolean;
  liveSubTrackIndex?: number | null;
  verifiedDiskPath?: string | null;
  rangeUrl?: string | null;
  host: TranscodeHostCaps;
  output: TranscodeOutputTarget;
}

export interface MediaTranscodePlan {
  ffArgs: string[];
  useVaapi: boolean;
  needsVideoTranscode: boolean;
  isHevc: boolean;
  is10BitOrAltCodec: boolean;
  isMpegTsFile: boolean;
  useDirectPipe: boolean;
  directPipeStartByte: number;
  safeAudioIdx: number;
}

export function needsRangeServerForInput(
  fileName: string,
  verifiedDiskPath: string | null | undefined,
  startSec: number
): boolean {
  if (verifiedDiskPath) return false;
  const isMpegTs = /\.ts$/i.test(fileName || '');
  const useDirectPipe = startSec <= 1 || isMpegTs;
  return !useDirectPipe;
}

export function selectSafeAudioTrackIndex(
  audioTracks: ProbedAudioTrack[] | undefined,
  audioIdx: number,
  hasExplicitAudioParam: boolean,
  wantOrigAudio: boolean
): number {
  if (audioTracks && audioTracks.length > 0) {
    const origTrack =
      audioTracks.find((t) => t.label.startsWith('ORIGINAL • ')) ||
      audioTracks.find((t) => !/^(RU|RUS|UK|UKR|BE|BEL)$/i.test(t.lang));
    const origIdx = origTrack ? origTrack.index : 0;

    if (hasExplicitAudioParam) {
      const requestedTrack = audioTracks[audioIdx];
      const isRequestedRussian =
        requestedTrack && /^(RU|RUS|UK|UKR|BE|BEL)$/i.test(requestedTrack.lang);
      if (
        wantOrigAudio &&
        isRequestedRussian &&
        origTrack &&
        origTrack.index !== audioIdx
      ) {
        return origIdx;
      }
      return audioIdx < audioTracks.length ? audioIdx : origIdx;
    }
    if (wantOrigAudio) {
      return origIdx;
    }
    return audioIdx < audioTracks.length ? audioIdx : 0;
  }
  if (wantOrigAudio && hasExplicitAudioParam && audioIdx > 0) {
    return audioIdx;
  }
  return 0;
}

export function planMediaTranscode(
  input: MediaTranscodeInput
): MediaTranscodePlan {
  const {
    fileName,
    fileLength,
    probe,
    startSec,
    audioIdx,
    hasExplicitAudioParam,
    wantOrigAudio,
    capTo1080p,
    forceVideoTranscode,
    liveSubTrackIndex,
    verifiedDiskPath,
    rangeUrl,
    host,
    output,
  } = input;

  const isMpegTsFile = /\.ts$/i.test(fileName || '');
  const is4kSource = /\b(2160p|4k|uhd)\b/i.test(fileName || '');
  const isHevc =
    (probe?.videoCodec ? /hevc|h265/i.test(probe.videoCodec) : false) ||
    /\b(hevc|x265|h\.?265)\b/i.test(fileName || '') ||
    (is4kSource &&
      !(probe?.videoCodec && /h264|avc/i.test(probe.videoCodec)) &&
      !/\b(x264|h\.?264|avc)\b/i.test(fileName || ''));
  const is10BitOrAltCodec =
    (probe?.videoCodec ? /av1|vp9/i.test(probe.videoCodec) : false) ||
    /\b(10bit|hi10p|av1|vp9)\b/i.test(fileName || '');
  const needsVideoTranscode =
    isHevc ||
    forceVideoTranscode ||
    is10BitOrAltCodec ||
    (capTo1080p && is4kSource);

  const safeAudioIdx = selectSafeAudioTrackIndex(
    probe?.audioTracks,
    audioIdx,
    hasExplicitAudioParam,
    wantOrigAudio
  );

  const hasLiveSub = typeof liveSubTrackIndex === 'number' && liveSubTrackIndex >= 0;
  const ffArgs: string[] = ['-hide_banner', '-loglevel', 'error'];
  if (hasLiveSub) {
    ffArgs.push('-copyts');
  }

  const useDirectPipe = !verifiedDiskPath && (startSec <= 1 || isMpegTsFile);
  let directPipeStartByte = 0;
  if (useDirectPipe && isMpegTsFile && startSec > 1) {
    const totalTsBytes = Math.max(0, Number(fileLength || 0));
    const tsEstDur =
      probe?.durationSec && probe.durationSec > 60
        ? probe.durationSec
        : Math.max(startSec + 600, Math.round(totalTsBytes / (720 * 1024)));
    const rawOffset = Math.floor(
      (Math.min(startSec, tsEstDur * 0.96) / Math.max(1, tsEstDur)) * totalTsBytes
    );
    directPipeStartByte = Math.max(0, Math.floor(rawOffset / 188) * 188);
  }

  const useFullVaapiHwPipeline =
    needsVideoTranscode &&
    host.platform !== 'darwin' &&
    host.vaapiAvailable &&
    !is10BitOrAltCodec;

  const hwDecodeArgs =
    needsVideoTranscode && host.platform === 'darwin'
      ? ['-hwaccel', 'videotoolbox']
      : useFullVaapiHwPipeline
        ? [
            '-hwaccel',
            'vaapi',
            '-hwaccel_device',
            host.vaapiDevicePath,
            '-hwaccel_output_format',
            'vaapi',
          ]
        : [];

  const seekSecStr = String(Math.floor(Math.max(0, startSec)));
  if (verifiedDiskPath) {
    if (startSec > 1) {
      ffArgs.push('-noaccurate_seek', '-ss', seekSecStr);
    }
    ffArgs.push(
      '-probesize',
      '1200000',
      '-analyzeduration',
      '1000000',
      ...hwDecodeArgs,
      '-i',
      verifiedDiskPath
    );
  } else if (!useDirectPipe) {
    ffArgs.push(
      '-noaccurate_seek',
      '-ss',
      seekSecStr,
      '-probesize',
      '1200000',
      '-analyzeduration',
      '1000000',
      ...hwDecodeArgs,
      '-i',
      rangeUrl || 'pipe:0'
    );
  } else {
    ffArgs.push(
      '-probesize',
      '1200000',
      '-analyzeduration',
      '1000000',
      '-fflags',
      isMpegTsFile && directPipeStartByte > 0
        ? '+nobuffer+discardcorrupt+genpts'
        : '+nobuffer'
    );
    if (isMpegTsFile) {
      ffArgs.push('-f', 'mpegts');
    }
    ffArgs.push(...hwDecodeArgs, '-i', 'pipe:0');
  }

  ffArgs.push(
    '-map',
    '0:v:0',
    '-map',
    `0:a:${safeAudioIdx}?`,
    '-map_metadata',
    '-1',
    '-map_chapters',
    '-1',
    '-dn',
    '-sn'
  );

  let useVaapi = false;
  if (needsVideoTranscode) {
    const maxScaleW = capTo1080p ? 1920 : is4kSource ? 3840 : 1920;
    const use4kBitrate = !capTo1080p && is4kSource;
    const sdrFilter = `scale='min(${maxScaleW},iw)':trunc(ow/a/2)*2,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709`;
    if (host.platform === 'darwin') {
      ffArgs.push(
        '-c:v',
        'h264_videotoolbox',
        '-profile:v',
        'high',
        '-realtime',
        'true',
        '-g',
        '48',
        '-b:v',
        use4kBitrate ? '15M' : '8M',
        '-maxrate',
        use4kBitrate ? '20M' : '10M',
        '-bufsize',
        use4kBitrate ? '30M' : '16M',
        '-vf',
        sdrFilter,
        '-color_primaries',
        'bt709',
        '-color_trc',
        'bt709',
        '-colorspace',
        'bt709'
      );
    } else if (host.vaapiAvailable) {
      useVaapi = true;
      if (!useFullVaapiHwPipeline) {
        ffArgs.unshift('-vaapi_device', host.vaapiDevicePath);
      }
      ffArgs.push(
        '-c:v',
        'h264_vaapi',
        '-g',
        '48',
        '-b:v',
        use4kBitrate ? '14M' : '8M',
        '-maxrate',
        use4kBitrate ? '18M' : '10M',
        '-bufsize',
        use4kBitrate ? '24M' : '16M',
        '-vf',
        useFullVaapiHwPipeline
          ? `scale_vaapi=w='min(${maxScaleW},iw)':h=-2:format=nv12`
          : `format=nv12,hwupload,scale_vaapi=w='min(${maxScaleW},iw)':h=-2:format=nv12`
      );
    } else {
      ffArgs.push(
        '-c:v',
        'libx264',
        '-profile:v',
        'high',
        ...(maxScaleW <= 1920 ? ['-level:v', '4.1'] : []),
        '-preset',
        'ultrafast',
        '-tune',
        'zerolatency',
        '-g',
        '48',
        '-keyint_min',
        '24',
        '-sc_threshold',
        '0',
        '-crf',
        '21',
        '-vf',
        sdrFilter,
        '-color_primaries',
        'bt709',
        '-color_trc',
        'bt709',
        '-colorspace',
        'bt709',
        '-maxrate',
        use4kBitrate ? '15M' : '8M',
        '-bufsize',
        use4kBitrate ? '30M' : '16M'
      );
    }
  } else if (output.format === 'hls') {
    ffArgs.push('-c:v', 'copy', '-bsf:v', 'h264_mp4toannexb');
  } else {
    ffArgs.push('-c:v', 'copy');
  }

  const selectedAudioMeta = probe?.audioTracks?.[safeAudioIdx];
  const isAacStereo =
    (selectedAudioMeta &&
      selectedAudioMeta.codec.toUpperCase() === 'AAC' &&
      !selectedAudioMeta.label.includes('5.1')) ||
    (!selectedAudioMeta && /\baac2\.?0\b/i.test(fileName || ''));

  if (output.format === 'fmp4' && isAacStereo && !needsVideoTranscode) {
    ffArgs.push('-c:a', 'copy');
  } else {
    ffArgs.push('-c:a', 'aac', '-ac', '2', '-b:a', '192k');
  }

  if (output.format === 'hls') {
    ffArgs.push(
      '-f',
      'hls',
      '-hls_init_time',
      '1',
      '-hls_time',
      '2',
      '-hls_list_size',
      '0',
      '-hls_playlist_type',
      'event',
      '-hls_flags',
      'independent_segments+temp_file',
      '-hls_segment_filename',
      output.segmentFilename,
      output.playlistPath
    );
  } else {
    ffArgs.push(
      '-f',
      'mp4',
      '-brand',
      'isom',
      '-use_editlist',
      '0',
      '-avoid_negative_ts',
      'make_zero',
      '-movflags',
      'frag_keyframe+empty_moov+default_base_moof',
      'pipe:1'
    );
  }

  if (hasLiveSub) {
    ffArgs.push(
      '-map',
      `0:s:${liveSubTrackIndex}`,
      '-c:s',
      'webvtt',
      '-flush_packets',
      '1',
      '-f',
      'webvtt',
      'pipe:3'
    );
  }

  return {
    ffArgs,
    useVaapi,
    needsVideoTranscode,
    isHevc,
    is10BitOrAltCodec,
    isMpegTsFile,
    useDirectPipe,
    directPipeStartByte,
    safeAudioIdx,
  };
}
