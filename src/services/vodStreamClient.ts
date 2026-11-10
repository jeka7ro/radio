import { buildFileListApiUrl } from '../views/smartTvLampaHelpers';
import { hasLocalLoopbackBridge } from './deviceContinuityService';

export interface ResolvedDirectVodStream {
  ok: boolean;
  type?: 'movie' | 'series';
  sourcePath?: string;
  dashUrl?: string;
  dashaUrl?: string;
  hlsUrl?: string;
  proxyHlsUrl?: string;
  rawHlsUrl?: string;
  embedUrl?: string;
  title?: string;
  duration?: number;
  audioNames?: string[];
  vkQualities?: Array<{
    id: string;
    height: number;
    label: string;
    url: string;
  }>;
  seasons?: Array<{
    season: number;
    episodes: Array<{
      episode: number;
      title: string;
      thumbnail?: string;
      duration: number;
      audioNames?: string[];
    }>;
  }>;
}

/**
 * Resolves a direct 4K UHD / 1080p Full HD HLS (.m3u8) stream via `/api/vod-stream`
 * (using iEdem VIP MediaLibrary, VK Video Direct 4K/1080p, RUTUBE Official 1080p, and Alloha VIP).
 */
export async function resolveDirectVodStreamClient(params: {
  kp?: string;
  imdb?: string;
  title?: string;
  type?: string;
  mediaType?: string;
  year?: string;
  season?: number;
  episode?: number;
}): Promise<ResolvedDirectVodStream> {
  const {
    kp = '',
    imdb = '',
    title = '',
    type,
    mediaType = type || '',
    year = '',
    season = 1,
    episode = 1,
  } = params;

  const isLocalLan =
    typeof window !== 'undefined' &&
    (window.location.hostname.startsWith('192.168.') ||
      window.location.hostname.startsWith('10.') ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');

  const qs = new URLSearchParams({
    kp,
    imdb,
    title,
    type: mediaType,
    year,
    season: String(season),
    episode: String(episode),
  });
  const relativePath = `/api/vod-stream?${qs.toString()}`;
  const urlsToTry =
    !isLocalLan && hasLocalLoopbackBridge()
      ? [buildFileListApiUrl(relativePath), relativePath]
      : [relativePath];

  for (const url of urlsToTry) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) {
        const data = (await res.json()) as ResolvedDirectVodStream;
        if (data?.ok && data.hlsUrl) {
          if (isLocalLan && data.proxyHlsUrl) {
            return {
              ...data,
              rawHlsUrl: data.rawHlsUrl || data.hlsUrl,
              hlsUrl: data.proxyHlsUrl,
            };
          }
          return data;
        }
        if (
          data?.embedUrl ||
          (Array.isArray(data?.seasons) && data.seasons.length > 0)
        ) {
          return data;
        }
      }
    } catch {
      // try next URL
    }
  }

  return { ok: false };
}
