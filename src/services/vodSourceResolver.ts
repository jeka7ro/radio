/**
 * Headless VOD Source Priority Policy & Auto-Failover State Machine.
 *
 * Pure, React-free decision logic extracted from `SmartTvLampaViewCore.tsx` so
 * server routing (RO / RU TV Show / RU Movie-Series / Foreign) and automatic
 * torrent-to-torrent & torrent-to-direct failover are unit-testable and deterministic.
 */

export type ResolvedVodServerChoice = 'filelist_torrent' | 'kinogram_hls';

export interface PreferredVodServerInput {
  userManuallySelectedServer: boolean;
  userSelectedFlTorrentId: number | null;
  canUseLocalTorrent: boolean;
  isRoVod: boolean;
  isForeignVod: boolean;
  isRuTvShow: boolean;
  resumeServer?: string;
  directResolvedOk: boolean;
  directResolvedSourcePath: string;
  directIsVk: boolean;
  directFinished: boolean;
  flResolvedOk: boolean;
  flFinished: boolean;
}

export interface PreferredVodServerDecision {
  server: ResolvedVodServerChoice;
  applyPreferredAudioTrack: boolean;
  reason: string;
}

/**
 * Deterministically picks the optimal active VOD playback server given current
 * content origin (RO / RU TV Show / RU Movie-Series / Foreign), home QNAP server
 * availability, and asynchronous resolution status of Direct vs Torrent sources.
 *
 * Returns `null` when the user manually selected a server or torrent (never overrides).
 */
export function resolvePreferredVodServer(
  input: PreferredVodServerInput
): PreferredVodServerDecision | null {
  if (
    input.userManuallySelectedServer ||
    input.userSelectedFlTorrentId !== null
  ) {
    return null;
  }

  const {
    canUseLocalTorrent,
    isRoVod,
    isForeignVod,
    isRuTvShow,
    resumeServer,
    directResolvedOk,
    directResolvedSourcePath,
    directIsVk,
    directFinished,
    flResolvedOk,
    flFinished,
  } = input;

  if (isRoVod) {
    const directIsFullHdPlus = /1080p|2160p|4k|uhd/i.test(
      directResolvedSourcePath || ''
    );
    const preferFlOnLan =
      canUseLocalTorrent &&
      flResolvedOk &&
      (resumeServer === 'filelist_torrent' ||
        !directResolvedOk ||
        !directIsFullHdPlus);
    if (preferFlOnLan) {
      return {
        server: 'filelist_torrent',
        applyPreferredAudioTrack: false,
        reason: 'ro_lan_filelist_preferred',
      };
    }
    if (directResolvedOk) {
      return {
        server: 'kinogram_hls',
        applyPreferredAudioTrack: false,
        reason: 'ro_cloud_hd_direct',
      };
    }
    if (directFinished && canUseLocalTorrent && (flResolvedOk || !flFinished)) {
      return {
        server: 'filelist_torrent',
        applyPreferredAudioTrack: false,
        reason: 'ro_direct_failed_fallback_filelist',
      };
    }
    return {
      server: 'kinogram_hls',
      applyPreferredAudioTrack: false,
      reason: 'ro_default_direct',
    };
  }

  if (isRuTvShow) {
    // Russian TV Shows: 1) VK Видео Direct (4K/1080p) -> 2) Kinozal VIP Torrent -> 3) iEdem MediaLibrary
    if (directIsVk || !directFinished) {
      return {
        server: 'kinogram_hls',
        applyPreferredAudioTrack: true,
        reason: directIsVk ? 'ru_show_vk_direct' : 'ru_show_waiting_vk',
      };
    }
    if (canUseLocalTorrent && (flResolvedOk || !flFinished)) {
      return {
        server: 'filelist_torrent',
        applyPreferredAudioTrack: false,
        reason: 'ru_show_kinozal_vip_secondary',
      };
    }
    return {
      server: 'kinogram_hls',
      applyPreferredAudioTrack: true,
      reason: 'ru_show_direct_fallback',
    };
  }

  // Foreign content: prefer FileList on LAN Home Server; on Cloud/LTE default to Direct HLS if available
  if (isForeignVod) {
    const server: ResolvedVodServerChoice = canUseLocalTorrent
      ? 'filelist_torrent'
      : directResolvedOk
        ? 'kinogram_hls'
        : 'filelist_torrent';
    return {
      server,
      applyPreferredAudioTrack: false,
      reason: canUseLocalTorrent
        ? 'foreign_lan_filelist'
        : directResolvedOk
          ? 'foreign_cloud_direct'
          : 'foreign_default_filelist',
    };
  }

  // Russian Movies & Series: Kinozal VIP #1 -> Direct/iEdem #2
  if (canUseLocalTorrent && (flResolvedOk || !flFinished)) {
    return {
      server: 'filelist_torrent',
      applyPreferredAudioTrack: false,
      reason: 'ru_movie_series_kinozal_primary',
    };
  }
  if (directResolvedOk) {
    return {
      server: 'kinogram_hls',
      applyPreferredAudioTrack: true,
      reason: 'ru_movie_series_direct_fallback',
    };
  }
  return {
    server: canUseLocalTorrent ? 'filelist_torrent' : 'kinogram_hls',
    applyPreferredAudioTrack: false,
    reason: 'ru_default',
  };
}

export interface FailoverTorrentCandidate {
  id?: number;
  quality?: string;
  releaseTitle?: string;
  seeders?: number;
}

export interface TorrentFailoverState {
  key: string;
  failedIds: Set<number>;
}

export interface TorrentFailoverEvent {
  episodeKey: string;
  failedTorrentId?: number;
  torrents?: FailoverTorrentCandidate[] | null;
  directStreamAvailable: boolean;
  maxTorrentSwitches?: number;
}

export type TorrentFailoverDecision =
  | {
      action: 'switch_torrent';
      torrentId: number;
      nextState: TorrentFailoverState;
    }
  | {
      action: 'fallback_direct';
      server: 'kinogram_hls';
      nextState: TorrentFailoverState;
    }
  | {
      action: 'exhausted';
      nextState: TorrentFailoverState;
    };

const HEVC_OR_DOVI_REGEX = /\b(hevc|x265|h\.?265|dovi)\b/i;

/**
 * Pure failover state machine for broken/stalled torrent streams:
 *  - Resets failure memory whenever `episodeKey` changes.
 *  - Records `failedTorrentId` so a broken release is never tried twice.
 *  - Up to `maxTorrentSwitches` (default 2), picks the fastest seeded `1080p Full HD`
 *    non-HEVC/DoVi release first, falling back to the highest-ranked remaining seeded release.
 *  - Once torrent candidates or switch budget are exhausted, falls back to Direct HLS if available.
 */
export function planTorrentStreamFailover(
  prevState: TorrentFailoverState,
  event: TorrentFailoverEvent
): TorrentFailoverDecision {
  const maxSwitches = event.maxTorrentSwitches ?? 2;
  const nextFailedIds =
    prevState.key === event.episodeKey
      ? new Set<number>(prevState.failedIds)
      : new Set<number>();

  if (typeof event.failedTorrentId === 'number' && event.failedTorrentId !== 0) {
    nextFailedIds.add(event.failedTorrentId);
  }

  const nextState: TorrentFailoverState = {
    key: event.episodeKey,
    failedIds: nextFailedIds,
  };

  if (nextFailedIds.size <= maxSwitches && Array.isArray(event.torrents)) {
    const candidates = event.torrents.filter(
      (t): t is FailoverTorrentCandidate & { id: number } =>
        typeof t?.id === 'number' &&
        t.id !== 0 &&
        !nextFailedIds.has(t.id) &&
        (t.seeders || 0) >= 1
    );
    const nextFast1080 = candidates.find(
      (t) =>
        t.quality === '1080p Full HD' &&
        !HEVC_OR_DOVI_REGEX.test(t.releaseTitle || '')
    );
    const nextTor = nextFast1080 || candidates[0];
    if (nextTor) {
      return {
        action: 'switch_torrent',
        torrentId: nextTor.id,
        nextState,
      };
    }
  }

  if (event.directStreamAvailable) {
    return {
      action: 'fallback_direct',
      server: 'kinogram_hls',
      nextState,
    };
  }

  return {
    action: 'exhausted',
    nextState,
  };
}
