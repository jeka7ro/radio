import { buildFileListApiUrl } from '../views/smartTvLampaHelpers';
import {
  hasLocalLoopbackBridge,
  isDirectLocalHost,
} from './deviceContinuityService';

export interface ResolvedDirectVodStream {
  ok: boolean;
  type?: 'movie' | 'series';
  sourcePath?: string;
  season?: number;
  episode?: number;
  dashUrl?: string;
  dashaUrl?: string;
  hlsUrl?: string;
  proxyHlsUrl?: string;
  fallbackHlsUrl?: string;
  rawHlsUrl?: string;
  backupHlsUrls?: string[];
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
  ru?: string;
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
    ru = '',
  } = params;

  const isLocalLan = isDirectLocalHost();

  const qs = new URLSearchParams({
    kp,
    imdb,
    title,
    type: mediaType,
    year,
    season: String(season),
    episode: String(episode),
  });
  if (ru !== '') {
    qs.set('ru', ru);
  }
  const relativePath = `/api/vod-stream?${qs.toString()}`;
  const urlsToTry =
    !isLocalLan && hasLocalLoopbackBridge()
      ? [buildFileListApiUrl(relativePath), relativePath]
      : [relativePath];

  for (const url of urlsToTry) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) {
        const rawData = (await res.json()) as ResolvedDirectVodStream;
        const isAbsoluteBridge = /^https?:\/\//i.test(url);
        const bridgeOrigin = isAbsoluteBridge ? new URL(url).origin : '';
        const toBridgeOrigin = (u?: string) =>
          u && bridgeOrigin && u.startsWith('/') ? `${bridgeOrigin}${u}` : u;
        const data: ResolvedDirectVodStream = bridgeOrigin
          ? {
              ...rawData,
              hlsUrl: toBridgeOrigin(rawData.hlsUrl),
              proxyHlsUrl: toBridgeOrigin(rawData.proxyHlsUrl),
              fallbackHlsUrl: toBridgeOrigin(rawData.fallbackHlsUrl),
              dashUrl: toBridgeOrigin(rawData.dashUrl),
              dashaUrl: toBridgeOrigin(rawData.dashaUrl),
              backupHlsUrls: Array.isArray(rawData.backupHlsUrls)
                ? rawData.backupHlsUrls
                    .map((u) => toBridgeOrigin(u) || u)
                    .filter(Boolean)
                : rawData.backupHlsUrls,
              vkQualities: Array.isArray(rawData.vkQualities)
                ? rawData.vkQualities.map((q) => ({
                    ...q,
                    url: toBridgeOrigin(q.url) || q.url,
                  }))
                : rawData.vkQualities,
            }
          : rawData;
        const safeData: ResolvedDirectVodStream = {
          ...data,
          dashUrl:
            data.dashUrl && !/interkh\.com/i.test(String(data.dashUrl))
              ? data.dashUrl
              : undefined,
          dashaUrl:
            data.dashaUrl && !/interkh\.com/i.test(String(data.dashaUrl))
              ? data.dashaUrl
              : undefined,
        };
        if (safeData?.ok && (safeData.hlsUrl || safeData.proxyHlsUrl)) {
          const rawCandidate = String(safeData.rawHlsUrl || safeData.hlsUrl || '');
          const mustUseProxy =
            isLocalLan ||
            Boolean(bridgeOrigin) ||
            /interkh\.com|bl\.rutube\.ru|jmeekos\.com|vidmoly|vmget\.online|vmpx\.online|vmnow\.online|vmeas\.cloud/i.test(rawCandidate) ||
            String(safeData.hlsUrl || '').startsWith('/api/tv-proxy');
          const effectiveHls =
            safeData.proxyHlsUrl && mustUseProxy
              ? safeData.proxyHlsUrl
              : safeData.hlsUrl || safeData.proxyHlsUrl;
          return {
            ...safeData,
            rawHlsUrl: safeData.rawHlsUrl || safeData.hlsUrl,
            hlsUrl: effectiveHls,
            proxyHlsUrl: safeData.proxyHlsUrl || effectiveHls,
            fallbackHlsUrl:
              safeData.fallbackHlsUrl ||
              (safeData.proxyHlsUrl && safeData.proxyHlsUrl !== effectiveHls
                ? safeData.proxyHlsUrl
                : undefined),
          };
        }
        if (Array.isArray(data?.seasons) && data.seasons.length > 0) {
          return { ...data, embedUrl: undefined };
        }
      }
    } catch {
      // try next URL
    }
  }

  return { ok: false };
}
