import React, { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  X,
  Heart,
  SkipBack,
  SkipForward,
  RotateCcw,
  Maximize,
  PictureInPicture2,
  AlertCircle,
  Loader2,
  Tv,
  Clock,
  Calendar,
  Languages,
  Subtitles,
  Upload,
  ListFilter,
  History,
  Play,
  Globe,
  VolumeX,
} from 'lucide-react';
import { EpgProgramme, TvChannel } from '../../types/radio';
import { useRadioStore } from '../../store/useRadioStore';
import { StationAvatar } from '../common/StationAvatar';
import {
  TvOsdChannelList,
  setActiveTvPlaylistContext,
} from './TvOsdChannelList';
import { OnlineSubtitleFinderModal } from './OnlineSubtitleFinderModal';
import { useTranslation } from '../../i18n/useTranslation';
import {
  getCountryFlagEmoji,
  getLocalizedCountryName,
} from '../../services/geoLanguageService';
import {
  useChannelEpg,
  formatEpgTime,
  getEpgTimingStats,
  normalizeEpgLookupKey,
  fetchChannelEpgArchive,
  getEpgDayKey,
  formatEpgDayLabel,
} from '../../services/epgService';
import {
  buildCatchupStreamCandidates,
  isAdultTvChannel,
} from '../../services/tvApi';
import {
  getActiveProfileMediaPrefs,
  saveActiveProfileMediaPrefs,
} from '../../services/deviceContinuityService';
import {
  resolveAudioTrackIndexByPreference,
  inferAudioPrefFromTrackName,
} from '../../services/subtitleSearchService';

// Map iEdem raw DVB-S2 "orig" / "FHD" streams (which carry MP2 0x04 / AC-3 0x81 audio or HEVC 0x24 that browser MSE/Hls.js cannot demux)
// to their official iEdem H.264 + AAC (0x1b + 0x0f) HD stream IDs on the exact same server & token.
const IEDEM_AAC_COMPATIBLE_CHANNEL_ID_MAP: Record<string, string> = {
  // Первый канал (orig/FHD MP2/AC3 -> HD AAC 204)
  '7253': '204',
  '2402': '204',
  '9201': '204',
  // Россия 1 (FHD/orig MP2/AC3 -> HD AAC 205)
  '2409': '205',
  '7252': '205',
  '9202': '205',
  '15133': '205',
  // РЕН ТВ (HD orig/orig MP2/AC3 -> HD AAC 2024)
  '9002': '2024',
  '9205': '2024',
  // НТВ (orig/HD orig MP2/AC3 -> HD AAC 213)
  '9203': '213',
  '9028': '213',
  // Пятница! HD (orig MP2/AC3 -> HD H.264+AAC 5031)
  '9207': '5031',
  '2006': '5031',
  // Известия (orig MP2 -> HD AAC 18039)
  '9216': '18039',
  // ТНТ (FHD/orig MP2/AC3 -> HD 50 AAC 10024)
  '2417': '10024',
  '7251': '10024',
  '9204': '237',
  '9208': '6370',
  // Pro TV RO (6997 is HEVC 0x24 -> 7055 H.264+AAC)
  '6997': '7055',
  // Кинопремьера (HD orig MP2/AC3 -> HD AAC 224)
  '9020': '224',
  // Viju+ Megahit / Premiere / Serial (HD orig MP2/AC3 -> HD AAC 201 / 202 / 2443)
  '5081': '201',
  '5079': '202',
  '9245': '2443',
  // Amedia Premium / Hit / 1 / 2 (orig/FHD MP2/AC3 -> HD AAC 229 / 6010 / 2046)
  '9233': '229',
  '9022': '229',
  '9070': '6010',
  '9234': '6010',
  '9129': '2046',
  '9069': '554',
  '9137': '554',
  // Кинохит & Остросюжетное (orig MP2/AC3 -> HD AAC 7250 / 904)
  '9128': '7250',
  '9044': '904',
};

function resolveWorkingStreamUrl(rawUrl: string): string {
  const iedemMatch = rawUrl.match(
    /^(https?:\/\/[^/]+\/iptv\/[^/]+\/)(\d+)(\/index\.m3u8.*)$/i
  );
  if (iedemMatch) {
    const mappedCid = IEDEM_AAC_COMPATIBLE_CHANNEL_ID_MAP[iedemMatch[2]];
    if (mappedCid) {
      return `${iedemMatch[1]}${mappedCid}${iedemMatch[3]}`;
    }
  }
  if (/rdsnet\.ro\/.*digi24/i.test(rawUrl)) {
    return 'https://edge-ar.rcs-rds.ro/digi24ar/index.m3u8';
  }
  if (/rpprod\.hbbtv\.cdn\.cra\.cz:8080\/hbbTV\/cme-ro-protv/i.test(rawUrl)) {
    return 'https://cmero-ott-live.ssl.cdn.cra.cz/channels/cme-ro-voyo-news/playlist.m3u8?offsetSeconds=0&url=0';
  }
  if (/31\.148\.48\.15\/Pervii_kanal_HD/i.test(rawUrl)) {
    return 'https://stream3.cinerama.uz/1214/mono.m3u8';
  }
  if (
    /45\.153\.24\.78\/TNT|89\.33\.29\.115:8080\/TNTHD|185\.46\.16\.239:8000\/TNT/i.test(
      rawUrl
    )
  ) {
    return 'http://stream.mcquack.net/135/index.m3u8';
  }
  if (/45\.153\.24\.78\/NTV/i.test(rawUrl)) {
    return 'https://cdn.ntv.ru/ntv-msk_hd/index.m3u8';
  }
  if (/77\.232\.131\.211\/Rossiya24/i.test(rawUrl)) {
    return 'https://streaming.televizor-24-tochka.ru/live/7.m3u8';
  }
  if (/31\.148\.48\.15\/REN-TV/i.test(rawUrl)) {
    return 'https://streaming.televizor-24-tochka.ru/live/14.m3u8';
  }
  if (/31\.148\.48\.15\/Dom_Kino_Premium_HD/i.test(rawUrl)) {
    return 'http://stream.mcquack.net/108/index.m3u8';
  }
  if (/31\.148\.48\.15\/Amedia_Premium_HD/i.test(rawUrl)) {
    return 'http://stream.mcquack.net/162/index.m3u8';
  }
  if (/31\.148\.48\.15\/Karusel_HD/i.test(rawUrl)) {
    return 'https://streaming102.interskytech.com/live/232.m3u8';
  }
  if (/51\.158\.144\.33:2021\/zvezda/i.test(rawUrl)) {
    return 'https://tvchannelstream1.tvzvezda.ru/cdn/tvzvezda/playlist.m3u8';
  }
  if (/\.cfd\/vhis\//i.test(rawUrl)) {
    return 'https://stream8.cinerama.uz/1046/index.m3u8';
  }
  if (/\.cfd\/vexplr\//i.test(rawUrl)) {
    return 'http://stream.mcquack.net/239/index.m3u8';
  }
  if (/\.cfd\/vnature\//i.test(rawUrl)) {
    return 'https://stream3.cinerama.uz/1228/mono.m3u8';
  }

  return rawUrl;
}

const KNOWN_CHANNEL_BACKUPS: Array<[RegExp, string[]]> = [
  [
    /Viasat History|viju\+? History/i,
    [
      'https://stream8.cinerama.uz/1046/index.m3u8',
      'http://stream.mcquack.net/101/index.m3u8',
      'https://flussonic.mkpnet.ru/tv-687ba838ca927b9a/video.m3u8',
    ],
  ],
  [
    /Viasat Explore|viju\+? Explore/i,
    [
      'https://flussonic.mkpnet.ru/tv-7c57a4c3f9a896ea/video.m3u8',
      'http://stream.mcquack.net/239/index.m3u8',
    ],
  ],
  [
    /Viasat Nature|viju\+? Nature/i,
    [
      'https://stream3.cinerama.uz/1228/mono.m3u8',
      'https://flussonic.mkpnet.ru/tv-7a85ea25208f5bf7/video.m3u8',
    ],
  ],
  [
    /National Geographic Wild|Nat Geo Wild/i,
    ['https://stream8.cinerama.uz/1042/index.m3u8'],
  ],
  [
    /^National Geographic|^Nat Geo/i,
    [
      'https://stream8.cinerama.uz/1041/index.m3u8',
      'http://stream.mcquack.net/116/index.m3u8',
    ],
  ],
  [
    /^Discovery/i,
    [
      'https://stream8.cinerama.uz/1039/index.m3u8',
      'http://stream.mcquack.net/177/index.m3u8',
    ],
  ],
  [
    /^Animal Planet/i,
    ['https://stream8.cinerama.uz/1043/index.m3u8'],
  ],
  [
    /^ТНТ\b|^TNT\b/i,
    [
      'https://bl.rutube.ru/livestream/546602986e6a424d74d594876ddb3f04/index.m3u8?s=K-z3nz49R1oGQ-5yPSd8pg&e=2082157024&scheme=https',
      'http://stream.mcquack.net/135/index.m3u8',
    ],
  ],
  [
    /^Первый канал|Channel One/i,
    [
      'https://stream3.cinerama.uz/1214/mono.m3u8',
      'https://flussonic.mkpnet.ru/tv-4f9598ab5f91dca4/video.m3u8',
      'https://streaming.thestream.cyou/live/210-req_offset_28000000-req_window_0-3k_v5.m3u8',
    ],
  ],
  [
    /^Россия 1\b|Russia 1/i,
    [
      'https://live.smotrim.ru/vgtrk/0/russia1-hd/index.m3u8',
      'https://stream8.cinerama.uz/1020/index.m3u8',
    ],
  ],
  [
    /^НТВ\b|^NTV\b/i,
    [
      'https://cdn.ntv.ru/ntv-msk_hd/index.m3u8',
      'https://cdn.ntv.ru/ntv0/index.m3u8',
    ],
  ],
  [
    /^СТС\b|^STS\b/i,
    [
      'https://flussonic.linkintel.ru/sts/index.m3u8',
      'http://stream.mcquack.net/138/index.m3u8',
    ],
  ],
];

function getCandidateStreams(
  channel: TvChannel | null,
  queue: TvChannel[],
  customChannels: TvChannel[] = []
): string[] {
  if (!channel) return [];
  const urls: string[] = [];
  const seen = new Set<string>();

  const add = (u?: string) => {
    if (!u) return;
    const resolved = resolveWorkingStreamUrl(u.trim());
    if (!resolved || seen.has(resolved)) return;
    seen.add(resolved);
    urls.push(resolved);
  };

  add(channel.url);

  const targetKey = normalizeEpgLookupKey(channel.name, true);
  if (targetKey) {
    // Prefer non-orig HD / standard AAC streams from queue & customChannels before external fallbacks
    const combinedPool = [...queue, ...customChannels];
    const nonOrigMatches: string[] = [];
    const otherMatches: string[] = [];
    for (const q of combinedPool) {
      if (q.id === channel.id) continue;
      if (normalizeEpgLookupKey(q.name, true) === targetKey) {
        if (!/\borig\b|\bfhd\b|\buhd\b|\b4k\b/i.test(q.name)) {
          nonOrigMatches.push(q.url);
        } else {
          otherMatches.push(q.url);
        }
      }
    }
    for (const u of nonOrigMatches) add(u);
    for (const u of otherMatches) add(u);
  }

  for (const [pattern, backups] of KNOWN_CHANNEL_BACKUPS) {
    if (pattern.test(channel.name)) {
      for (const b of backups) add(b);
    }
  }

  return urls;
}

function buildProxyStreamUrl(
  rawUrl: string,
  referrer?: string,
  userAgent?: string
): string {
  const params = new URLSearchParams();
  params.set('url', rawUrl);
  if (referrer) params.set('ref', referrer);
  if (userAgent) params.set('ua', userAgent);
  return `/api/tv-proxy?${params.toString()}`;
}

function convertSrtToVtt(srtText: string): string {
  const normalized = srtText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return `WEBVTT\n\n${normalized}`;
}

interface HlsTrackItem {
  id: number;
  name: string;
  lang?: string;
}

interface TvPlayerModalProps {
  isSmartTvFullMode?: boolean;
  inlineEmbeddedMode?: boolean;
}

export const TvPlayerModal: React.FC<TvPlayerModalProps> = ({
  isSmartTvFullMode = false,
  inlineEmbeddedMode = false,
}) => {
  const { t, language, format } = useTranslation();
  const isMobilePhone =
    typeof window !== 'undefined' && window.innerWidth < 640;
  const [isFullModeExpanded, setIsFullModeExpanded] = useState(
    () => !isMobilePhone && isSmartTvFullMode
  );
  const [isSplitFullscreen, setIsSplitFullscreen] = useState(false);
  const effectiveTvFullMode =
    !isMobilePhone &&
    (isFullModeExpanded || (inlineEmbeddedMode ? false : isSmartTvFullMode));

  const storeTvChannel = useRadioStore((state) => state.currentTvChannel);
  const tvQueue = useRadioStore((state) => state.tvQueue);
  const favoriteTvChannels = useRadioStore((state) => state.favoriteTvChannels);
  const customTvChannels = useRadioStore((state) => state.customTvChannels);
  const adultContentEnabled = useRadioStore(
    (state) => state.adultContentEnabled
  );
  const playTvChannel = useRadioStore((state) => state.playTvChannel);
  const closeTvPlayer = useRadioStore((state) => state.closeTvPlayer);
  const playNextTvChannel = useRadioStore((state) => state.playNextTvChannel);
  const playPreviousTvChannel = useRadioStore(
    (state) => state.playPreviousTvChannel
  );
  const toggleFavoriteTvChannel = useRadioStore(
    (state) => state.toggleFavoriteTvChannel
  );

  const currentTvChannel = useMemo(() => {
    if (storeTvChannel) return storeTvChannel;
    if (!inlineEmbeddedMode) return null;
    const favPool = favoriteTvChannels.filter(
      (c) => adultContentEnabled || !isAdultTvChannel(c)
    );
    return favPool[0] || null;
  }, [
    storeTvChannel,
    inlineEmbeddedMode,
    favoriteTvChannels,
    adultContentEnabled,
  ]);

  useEffect(() => {
    if (inlineEmbeddedMode && !storeTvChannel && currentTvChannel) {
      const favPool = favoriteTvChannels.filter(
        (c) => adultContentEnabled || !isAdultTvChannel(c)
      );
      setActiveTvPlaylistContext('FAV', 'FAV');
      playTvChannel(currentTvChannel, favPool);
    }
  }, [
    inlineEmbeddedMode,
    storeTvChannel,
    currentTvChannel,
    favoriteTvChannels,
    adultContentEnabled,
    playTvChannel,
  ]);

  const epg = useChannelEpg(currentTvChannel);
  const epgStats = getEpgTimingStats(epg?.now);

  const [activeArchiveProg, setActiveArchiveProg] =
    useState<EpgProgramme | null>(null);
  const [archiveProgrammes, setArchiveProgrammes] = useState<EpgProgramme[]>(
    []
  );
  const [selectedArchiveDay, setSelectedArchiveDay] = useState<string>('');
  const [archiveSeekOffsetSec, setArchiveSeekOffsetSec] = useState<number>(0);
  const [archiveVideoTimeSec, setArchiveVideoTimeSec] = useState<number>(0);

  useEffect(() => {
    setArchiveSeekOffsetSec(0);
    setArchiveVideoTimeSec(0);
  }, [activeArchiveProg?.start, activeArchiveProg?.stop, currentTvChannel?.id]);

  const archiveTotalSec = activeArchiveProg
    ? Math.max(
        60,
        Math.round((activeArchiveProg.stop - activeArchiveProg.start) / 1000)
      )
    : 0;
  const archiveElapsedSec = activeArchiveProg
    ? Math.min(
        archiveTotalSec,
        Math.max(0, archiveSeekOffsetSec + archiveVideoTimeSec)
      )
    : 0;
  const archiveProgressPct =
    activeArchiveProg && archiveTotalSec > 0
      ? Math.min(
          100,
          Math.max(0, Math.round((archiveElapsedSec / archiveTotalSec) * 100))
        )
      : 0;
  const archiveRemainingMin = activeArchiveProg
    ? Math.max(0, Math.ceil((archiveTotalSec - archiveElapsedSec) / 60))
    : 0;

  const archiveNextProgrammes = useMemo(() => {
    if (!activeArchiveProg || archiveProgrammes.length === 0) return [];
    return archiveProgrammes
      .filter((p) => p.start >= activeArchiveProg.stop)
      .slice(0, 3);
  }, [activeArchiveProg, archiveProgrammes]);

  const formatArchiveClock = (sec: number): string => {
    const s = Math.max(0, Math.floor(sec));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const remSec = s % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
  };

  const handleSeekArchiveProgress = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeArchiveProg || archiveTotalSec <= 0) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(
      0.98,
      Math.max(0, (e.clientX - rect.left) / rect.width)
    );
    const targetSec = Math.floor(ratio * archiveTotalSec);
    const vid = videoRef.current;
    if (
      vid &&
      Number.isFinite(vid.duration) &&
      vid.duration >= archiveTotalSec * 0.85 &&
      archiveSeekOffsetSec === 0
    ) {
      vid.currentTime = targetSec;
      setArchiveVideoTimeSec(targetSec);
    } else {
      setArchiveSeekOffsetSec(targetSec);
      setArchiveVideoTimeSec(0);
      setStreamIndex(0);
    }
  };

  const candidateStreams = useMemo(() => {
    const baseCandidates = getCandidateStreams(
      currentTvChannel,
      tvQueue,
      customTvChannels
    );
    if (!activeArchiveProg || !currentTvChannel) {
      return baseCandidates;
    }
    const effectiveStartMs =
      activeArchiveProg.start + archiveSeekOffsetSec * 1000;
    const catchupUrls: string[] = [];
    for (const baseUrl of baseCandidates) {
      const generated = buildCatchupStreamCandidates(
        baseUrl,
        effectiveStartMs,
        activeArchiveProg.stop,
        currentTvChannel.catchupSource
      );
      for (const u of generated) {
        if (!catchupUrls.includes(u)) {
          catchupUrls.push(u);
        }
      }
    }
    return catchupUrls;
  }, [
    currentTvChannel,
    tvQueue,
    customTvChannels,
    activeArchiveProg,
    archiveSeekOffsetSec,
  ]);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const liveSurfaceBtnRef = useRef<HTMLButtonElement | null>(null);
  const osdClosedAtRef = useRef<number>(0);
  const lastTvBackAtRef = useRef<number>(0);
  const hlsRef = useRef<Hls | null>(null);
  const subFileInputRef = useRef<HTMLInputElement | null>(null);
  const channelGridBtnRef = useRef<HTMLButtonElement | null>(null);
  const osdTimerRef = useRef<number | null>(null);

  const [videoStatus, setVideoStatus] = useState<
    'loading' | 'playing' | 'error'
  >('loading');
  const [isAutoMuted, setIsAutoMuted] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  const [streamIndex, setStreamIndex] = useState(0);
  const [isOsdOverlayOpen, setIsOsdOverlayOpen] = useState(false);
  const [osdViewMode, setOsdViewMode] = useState<
    'channels' | 'groups' | 'epg_detail' | 'epg'
  >('channels');
  const [videoResolution, setVideoResolution] = useState<string>('');
  const [isTvOsdVisible, setIsTvOsdVisible] = useState(true);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(() =>
    isMobilePhone
      ? true
      : effectiveTvFullMode
        ? false
        : inlineEmbeddedMode
          ? true
          : typeof window !== 'undefined'
            ? window.innerWidth >= 1024
            : true
  );
  const [sidePanelTab, setSidePanelTab] = useState<'channels' | 'archive'>(
    'channels'
  );
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(
    () => isMobilePhone || !effectiveTvFullMode
  );

  const wakeTvOsd = () => {
    setIsTvOsdVisible(true);
    if (osdTimerRef.current) {
      window.clearTimeout(osdTimerRef.current);
    }
    osdTimerRef.current = window.setTimeout(() => {
      setIsTvOsdVisible(false);
    }, 4500);
  };

  const enterTvFullMode = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      return;
    }
    setIsFullModeExpanded(true);
    setIsSidePanelOpen(false);
    setIsInfoPanelOpen(false);
    setIsOsdOverlayOpen(false);
    wakeTvOsd();
    window.setTimeout(() => {
      liveSurfaceBtnRef.current?.focus({ preventScroll: true });
    }, 40);
  };

  const exitTvFullMode = () => {
    setIsFullModeExpanded(false);
    setIsSplitFullscreen(false);
    setIsSidePanelOpen(true);
    setIsInfoPanelOpen(true);
    setIsOsdOverlayOpen(false);
    window.setTimeout(() => {
      const selectedRow =
        dialogRef.current?.querySelector<HTMLElement>(
          '[data-osd-channel-row="true"][aria-selected="true"]'
        ) ||
        dialogRef.current?.querySelector<HTMLElement>(
          '[data-osd-channel-row="true"]'
        );
      selectedRow?.focus({ preventScroll: true });
    }, 45);
  };

  useEffect(() => {
    return () => {
      if (osdTimerRef.current) {
        window.clearTimeout(osdTimerRef.current);
      }
    };
  }, []);

  const [audioTracks, setAudioTracks] = useState<HlsTrackItem[]>([]);
  const [activeAudioTrack, setActiveAudioTrack] = useState<number>(0);
  const [subtitleTracks, setSubtitleTracks] = useState<HlsTrackItem[]>([]);
  const [activeSubtitleTrack, setActiveSubtitleTrack] = useState<number>(-1);
  const [customSubtitleUrl, setCustomSubtitleUrl] = useState<string | null>(
    null
  );
  const [customSubtitleName, setCustomSubtitleName] = useState<string>('');
  const [isOnlineSubFinderOpen, setIsOnlineSubFinderOpen] =
    useState<boolean>(false);
  const [profileSubFontPx, setProfileSubFontPx] = useState<number>(
    () => getActiveProfileMediaPrefs().defaultSubFontPx || 24
  );

  useEffect(() => {
    const syncPrefs = () => {
      setProfileSubFontPx(getActiveProfileMediaPrefs().defaultSubFontPx || 24);
    };
    window.addEventListener('aether:active-profile-changed', syncPrefs);
    window.addEventListener('aether:profile-media-prefs-changed', syncPrefs);
    return () => {
      window.removeEventListener('aether:active-profile-changed', syncPrefs);
      window.removeEventListener('aether:profile-media-prefs-changed', syncPrefs);
    };
  }, []);

  const isOpen = Boolean(currentTvChannel);

  useEffect(() => {
    setStreamIndex(0);
    setIsAutoMuted(false);
    setVideoResolution('');
    setAudioTracks([]);
    setActiveAudioTrack(0);
    setSubtitleTracks([]);
    setActiveSubtitleTrack(-1);
    setActiveArchiveProg(currentTvChannel?.archiveProgram || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentTvChannel?.id,
    currentTvChannel?.url,
    currentTvChannel?.archiveProgram?.start,
  ]);

  useEffect(() => {
    const isFull =
      Boolean(currentTvChannel) &&
      (!inlineEmbeddedMode || effectiveTvFullMode || isSplitFullscreen);
    if (typeof document !== 'undefined') {
      if (isFull) {
        document.documentElement.setAttribute('data-tv-full-mode', 'true');
      } else {
        document.documentElement.removeAttribute('data-tv-full-mode');
      }
    }
    window.dispatchEvent(
      new CustomEvent('aether:tv-full-mode-change', {
        detail: { isFullMode: isFull },
      })
    );
    return () => {
      window.setTimeout(() => {
        const stillFull = document.querySelector(
          '#aether-tv-player-modal[data-full-mode="true"]'
        );
        if (!stillFull) {
          if (typeof document !== 'undefined') {
            document.documentElement.removeAttribute('data-tv-full-mode');
          }
          window.dispatchEvent(
            new CustomEvent('aether:tv-full-mode-change', {
              detail: { isFullMode: false },
            })
          );
        }
      }, 0);
    };
  }, [
    currentTvChannel,
    effectiveTvFullMode,
    inlineEmbeddedMode,
    isSplitFullscreen,
  ]);

  useEffect(() => {
    if (effectiveTvFullMode) {
      setIsSidePanelOpen(false);
      setIsInfoPanelOpen(false);
      setIsOsdOverlayOpen(false);
      wakeTvOsd();
      window.setTimeout(() => {
        if (!isOsdOverlayOpen) {
          liveSurfaceBtnRef.current?.focus({ preventScroll: true });
        }
      }, 45);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTvFullMode]);

  useEffect(() => {
    const onEnterFullModeEvent = () => {
      setIsSplitFullscreen(false);
      setIsFullModeExpanded(false);
      setIsSidePanelOpen(true);
      setIsInfoPanelOpen(true);
      setIsOsdOverlayOpen(false);
      window.setTimeout(() => {
        const firstRow =
          dialogRef.current?.querySelector<HTMLElement>(
            '[data-osd-channel-row="true"][aria-selected="true"]'
          ) ||
          dialogRef.current?.querySelector<HTMLElement>(
            '[data-osd-channel-row="true"]'
          );
        firstRow?.focus({ preventScroll: true });
      }, 50);
    };
    window.addEventListener('aether:tv-enter-full-mode', onEnterFullModeEvent);
    return () => {
      window.removeEventListener('aether:tv-enter-full-mode', onEnterFullModeEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Automatically unmute on the very first key press or click anywhere on the page
  useEffect(() => {
    if (!isAutoMuted) return;
    const unlockAudio = () => {
      const v = videoRef.current;
      if (v) {
        v.muted = false;
        if (v.volume === 0) v.volume = 1;
      }
      setIsAutoMuted(false);
    };
    window.addEventListener('keydown', unlockAudio, true);
    window.addEventListener('pointerdown', unlockAudio, true);
    return () => {
      window.removeEventListener('keydown', unlockAudio, true);
      window.removeEventListener('pointerdown', unlockAudio, true);
    };
  }, [isAutoMuted]);

  useEffect(() => {
    if (!currentTvChannel) return;
    const onBackEvent = () => {
      if (document.querySelector('[data-osd-subview="true"]')) {
        return;
      }
      const now = Date.now();
      if (now - lastTvBackAtRef.current < 250) {
        return;
      }
      lastTvBackAtRef.current = now;

      if (isOnlineSubFinderOpen) {
        setIsOnlineSubFinderOpen(false);
        return;
      }
      if (isOsdOverlayOpen) {
        osdClosedAtRef.current = Date.now();
        setIsOsdOverlayOpen(false);
        return;
      }
      if (effectiveTvFullMode || isFullModeExpanded) {
        exitTvFullMode();
        return;
      }
      if (inlineEmbeddedMode) {
        if (isSplitFullscreen) {
          setIsSplitFullscreen(false);
        }
        window.setTimeout(() => {
          const navBtn = document.querySelector<HTMLElement>(
            'aside [data-nav-section="tv"], aside button'
          );
          navBtn?.focus();
        }, 30);
        return;
      }
      closeTvPlayer();
    };
    const onWakeEvent = () => {
      wakeTvOsd();
    };
    const onDirectEscOrBackKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'SELECT' ||
        target?.tagName === 'TEXTAREA';
      const isBackKey =
        e.key === 'Escape' ||
        e.key === 'GoBack' ||
        e.key === 'BrowserBack' ||
        e.keyCode === 27 ||
        e.keyCode === 461 ||
        e.keyCode === 10009 ||
        ((e.key === 'Backspace' || e.keyCode === 8) &&
          !isInput &&
          !document.querySelector('[data-tv-osd-search-open="true"]'));
      if (!isBackKey) return;
      if (document.querySelector('[data-osd-subview="true"]')) {
        return;
      }
      e.preventDefault();
      onBackEvent();
    };
    window.addEventListener('aether:tv-player-back', onBackEvent);
    window.addEventListener('aether:tv-player-wake-osd', onWakeEvent);
    window.addEventListener('keydown', onDirectEscOrBackKey);
    return () => {
      window.removeEventListener('aether:tv-player-back', onBackEvent);
      window.removeEventListener('aether:tv-player-wake-osd', onWakeEvent);
      window.removeEventListener('keydown', onDirectEscOrBackKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentTvChannel,
    isTvOsdVisible,
    isOnlineSubFinderOpen,
    isOsdOverlayOpen,
    isFullModeExpanded,
    isSplitFullscreen,
    effectiveTvFullMode,
    inlineEmbeddedMode,
    isSidePanelOpen,
    isInfoPanelOpen,
    closeTvPlayer,
  ]);

  // Ensure focus moves into TvPlayerModal (and off background SmartTvLampaView cards) whenever watching fullscreen Live TV
  useEffect(() => {
    if (
      !currentTvChannel ||
      isOsdOverlayOpen ||
      isOnlineSubFinderOpen ||
      isSidePanelOpen
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      liveSurfaceBtnRef.current?.focus();
    }, 35);
    return () => window.clearTimeout(timer);
  }, [
    currentTvChannel?.id,
    isOsdOverlayOpen,
    isOnlineSubFinderOpen,
    isSidePanelOpen,
  ]);

  // Smart IPTV Remote Control Listener when watching fullscreen Live TV (OSD closed)
  useEffect(() => {
    if (
      !currentTvChannel ||
      isOsdOverlayOpen ||
      isOnlineSubFinderOpen ||
      isSidePanelOpen
    ) {
      return;
    }
    const onTvRemoteKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'SELECT' ||
        target?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const isOkKey =
        e.key === 'Enter' ||
        e.key === 'Select' ||
        e.key === 'Execute' ||
        e.key === ' ' ||
        e.keyCode === 13 ||
        e.keyCode === 29443;

      // OK (Enter) or ArrowDown or ArrowUp -> Opens Smart IPTV Single-Column Channel List OSD (Photo 1)
      if (isOkKey || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        if (Date.now() - osdClosedAtRef.current < 320) {
          return;
        }
        if (videoRef.current && videoRef.current.muted) {
          videoRef.current.muted = false;
          setIsAutoMuted(false);
        }
        setOsdViewMode('channels');
        setIsOsdOverlayOpen(true);
        return;
      }

      // Green Button (404) -> Opens Detailed EPG Window
      if (e.keyCode === 404) {
        e.preventDefault();
        e.stopPropagation();
        setOsdViewMode('epg_detail');
        setIsOsdOverlayOpen(true);
        return;
      }

      // ArrowRight or Yellow Button (405) -> Opens Catchup Archive Window
      if (e.key === 'ArrowRight' || e.keyCode === 405) {
        e.preventDefault();
        e.stopPropagation();
        setOsdViewMode('epg');
        setIsOsdOverlayOpen(true);
        return;
      }

      // Blue Button (406) -> Opens Groups / Playlists Window
      if (e.keyCode === 406) {
        e.preventDefault();
        e.stopPropagation();
        setOsdViewMode('groups');
        setIsOsdOverlayOpen(true);
        return;
      }

      // ArrowLeft or Info Button (457 / 'i') -> Wakes Smart IPTV Bottom Info Banner (Photo 2)
      if (
        e.key === 'ArrowLeft' ||
        e.key === 'i' ||
        e.key === 'I' ||
        e.keyCode === 457
      ) {
        e.preventDefault();
        e.stopPropagation();
        wakeTvOsd();
        return;
      }

      // ChannelUp / PageUp -> Next TV Channel + Bottom Info Banner
      if (e.key === 'PageUp' || e.keyCode === 33 || e.keyCode === 427) {
        e.preventDefault();
        e.stopPropagation();
        playNextTvChannel();
        wakeTvOsd();
        return;
      }

      // ChannelDown / PageDown -> Previous TV Channel + Bottom Info Banner
      if (e.key === 'PageDown' || e.keyCode === 34 || e.keyCode === 428) {
        e.preventDefault();
        e.stopPropagation();
        playPreviousTvChannel();
        wakeTvOsd();
        return;
      }

      // Red Button (403) -> Toggle Favorite
      if (e.keyCode === 403) {
        e.preventDefault();
        e.stopPropagation();
        toggleFavoriteTvChannel(currentTvChannel);
        wakeTvOsd();
        return;
      }

      // Play / Pause / PlayPause Buttons on Smart TV Remote (415, 19, 179, 250, MediaPlay, MediaPause, MediaPlayPause)
      if (
        e.keyCode === 415 ||
        e.keyCode === 19 ||
        e.keyCode === 179 ||
        e.keyCode === 250 ||
        e.key === 'MediaPlay' ||
        e.key === 'MediaPause' ||
        e.key === 'MediaPlayPause' ||
        e.key === 'Play' ||
        e.key === 'Pause'
      ) {
        e.preventDefault();
        e.stopPropagation();
        const v = videoRef.current;
        if (v) {
          if (v.paused) {
            v.play().catch(() => { });
            setVideoStatus('playing');
          } else {
            v.pause();
          }
        }
        wakeTvOsd();
        return;
      }
    };

    const onTvRemoteWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 1 && Math.abs(e.deltaX) < 1) return;
      if (Date.now() - osdClosedAtRef.current < 320) return;
      e.preventDefault();
      e.stopPropagation();
      setOsdViewMode('channels');
      setIsOsdOverlayOpen(true);
    };

    window.addEventListener('keydown', onTvRemoteKeyDown, true);
    window.addEventListener('wheel', onTvRemoteWheel, {
      passive: false,
      capture: true,
    });
    return () => {
      window.removeEventListener('keydown', onTvRemoteKeyDown, true);
      window.removeEventListener('wheel', onTvRemoteWheel, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentTvChannel,
    isOsdOverlayOpen,
    isOnlineSubFinderOpen,
    isSidePanelOpen,
    playNextTvChannel,
    playPreviousTvChannel,
    toggleFavoriteTvChannel,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!currentTvChannel) {
      setArchiveProgrammes([]);
      return;
    }
    void fetchChannelEpgArchive(currentTvChannel).then((list) => {
      if (cancelled) return;
      setArchiveProgrammes(list);
      const todayKey = getEpgDayKey(Date.now());
      const availableDays = Array.from(
        new Set(list.map((p) => getEpgDayKey(p.start)))
      );
      if (availableDays.includes(todayKey)) {
        setSelectedArchiveDay(todayKey);
      } else if (availableDays.length > 0) {
        setSelectedArchiveDay(availableDays[availableDays.length - 1]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [currentTvChannel]);

  const archiveDays = useMemo(() => {
    const keys = Array.from(
      new Set(archiveProgrammes.map((p) => getEpgDayKey(p.start)))
    );
    return keys.sort();
  }, [archiveProgrammes]);

  const programmesForSelectedDay = useMemo(() => {
    if (!selectedArchiveDay) return [];
    return archiveProgrammes.filter(
      (p) => getEpgDayKey(p.start) === selectedArchiveDay
    );
  }, [archiveProgrammes, selectedArchiveDay]);

  // Attach HLS stream whenever currentTvChannel, streamIndex, or reloadCount changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentTvChannel) return;

    let cancelled = false;
    let frameWatchdogTimer: number | null = null;
    setVideoStatus('loading');

    const clearWatchdog = () => {
      if (frameWatchdogTimer !== null) {
        window.clearTimeout(frameWatchdogTimer);
        frameWatchdogTimer = null;
      }
    };

    const cleanupHls = () => {
      clearWatchdog();
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {
          // ignore
        }
        hlsRef.current = null;
      }
    };

    cleanupHls();
    video.pause();
    video.removeAttribute('src');

    const activeRawUrl =
      candidateStreams[streamIndex] ||
      candidateStreams[0] ||
      currentTvChannel.url;
    const directUrl = resolveWorkingStreamUrl(activeRawUrl);
    const proxiedUrl = buildProxyStreamUrl(
      directUrl,
      currentTvChannel.httpReferrer,
      currentTvChannel.httpUserAgent
    );

    const safeAutoPlay = async () => {
      if (cancelled) return;
      try {
        video.muted = false;
        setIsAutoMuted(false);
        await video.play();
      } catch (err: unknown) {
        if (cancelled) return;
        const errName =
          err && typeof err === 'object' && 'name' in err
            ? String((err as { name?: string }).name)
            : '';
        // Only fall back to muted autoplay if the browser explicitly rejected unmuted playback with NotAllowedError
        if (errName === 'NotAllowedError') {
          try {
            video.muted = true;
            setIsAutoMuted(true);
            await video.play();
          } catch {
            // ignore
          }
        }
      }
    };

    const startPlayback = async () => {
      try {
        // Direct MP4 / WebM / MKV VOD file support
        if (/\.(mp4|webm|mkv|avi|mov)(\?.*)?$/i.test(directUrl)) {
          video.src = directUrl;
          await safeAutoPlay();
          return;
        }

        if (cancelled) return;

        if (Hls.isSupported()) {
          let triedDirectFallback = false;
          let mediaRecoveryCount = 0;

          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            startFragPrefetch: true,
            liveSyncDurationCount: 1.2,
            liveMaxLatencyDurationCount: 4,
            backBufferLength: 8,
            maxBufferLength: 12,
            maxMaxBufferLength: 24,
            maxBufferSize: 18 * 1000 * 1000,
            highBufferWatchdogPeriod: 1,
            nudgeMaxRetry: 5,
            manifestLoadingTimeOut: 10000,
            manifestLoadingMaxRetry: 2,
            levelLoadingTimeOut: 10000,
            fragLoadingTimeOut: 12000,
          });
          hlsRef.current = hls;

          let hasAppliedInitialProfileTracks = false;
          const syncTracks = () => {
            if (cancelled) return;
            const profilePrefs = getActiveProfileMediaPrefs();
            const aTracks = (hls.audioTracks || []).map((trk, idx) => ({
              id: idx,
              name: trk.name || trk.lang || `Audio ${idx + 1}`,
              lang: trk.lang,
            }));
            setAudioTracks(aTracks);
            if (!hasAppliedInitialProfileTracks && aTracks.length > 1) {
              const prefIdx = resolveAudioTrackIndexByPreference(
                aTracks.map((t) => `${t.name} ${t.lang || ''}`),
                profilePrefs.defaultAudioPref
              );
              if (prefIdx >= 0 && prefIdx < aTracks.length) {
                hls.audioTrack = prefIdx;
                setActiveAudioTrack(prefIdx);
              } else if (hls.audioTrack >= 0) {
                setActiveAudioTrack(hls.audioTrack);
              }
            } else if (hls.audioTrack >= 0) {
              setActiveAudioTrack(hls.audioTrack);
            }

            const sTracks = (hls.subtitleTracks || []).map((trk, idx) => ({
              id: idx,
              name: trk.name || trk.lang || `Subtitrare ${idx + 1}`,
              lang: trk.lang,
            }));
            setSubtitleTracks(sTracks);
            if (!hasAppliedInitialProfileTracks && sTracks.length > 0) {
              if (profilePrefs.defaultSubLang === 'off') {
                hls.subtitleDisplay = false;
                hls.subtitleTrack = -1;
                setActiveSubtitleTrack(-1);
              } else {
                const targetLang = profilePrefs.defaultSubLang || 'ro';
                const matchIdx = sTracks.findIndex((t) => {
                  const hay = `${t.name} ${t.lang || ''}`.toLowerCase();
                  if (targetLang === 'ro') return /ro|rum|ron|român/i.test(hay);
                  if (targetLang === 'ru') return /ru|rus|рус/i.test(hay);
                  if (targetLang === 'en') return /en|eng|english/i.test(hay);
                  return hay.includes(targetLang);
                });
                if (matchIdx >= 0) {
                  hls.subtitleDisplay = true;
                  hls.subtitleTrack = matchIdx;
                  setActiveSubtitleTrack(matchIdx);
                } else {
                  setActiveSubtitleTrack(hls.subtitleTrack);
                }
              }
            } else {
              setActiveSubtitleTrack(hls.subtitleTrack);
            }
            if (aTracks.length > 0 || sTracks.length > 0) {
              hasAppliedInitialProfileTracks = true;
            }
          };

          hls.attachMedia(video);

          hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            if (cancelled) return;
            // Use local Vite CORS/Referer proxy first so streams like Digi 24 work without CORS blocks
            hls.loadSource(proxiedUrl);
          });

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (cancelled) return;
            syncTracks();
            void safeAutoPlay();
            clearWatchdog();
            frameWatchdogTimer = window.setTimeout(() => {
              if (cancelled) return;
              if (
                video.videoWidth === 0 &&
                video.readyState < 3 &&
                streamIndex + 1 < candidateStreams.length
              ) {
                cleanupHls();
                setStreamIndex((prev) => prev + 1);
              }
            }, 5500);
          });

          hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, syncTracks);
          hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, syncTracks);

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (cancelled) return;
            if (data.fatal) {
              if (
                data.type === Hls.ErrorTypes.NETWORK_ERROR &&
                !triedDirectFallback
              ) {
                triedDirectFallback = true;
                hls.loadSource(directUrl);
                return;
              }
              if (
                data.type === Hls.ErrorTypes.MEDIA_ERROR &&
                mediaRecoveryCount < 2
              ) {
                mediaRecoveryCount += 1;
                hls.recoverMediaError();
                return;
              }
              cleanupHls();
              // Automatically try the next backup stream candidate if one exists
              if (streamIndex + 1 < candidateStreams.length) {
                setStreamIndex((prev) => prev + 1);
                return;
              }
              setVideoStatus('error');
            }
          });
          return;
        }

        // Native HLS fallback (iOS Safari / Smart TV WebKit)
        video.src = proxiedUrl;
        await safeAutoPlay();
      } catch {
        if (!cancelled) {
          setVideoStatus('error');
        }
      }
    };

    void startPlayback();

    return () => {
      cancelled = true;
      cleanupHls();
      video.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentTvChannel?.id,
    currentTvChannel?.url,
    activeArchiveProg?.start,
    activeArchiveProg?.stop,
    archiveSeekOffsetSec,
    streamIndex,
    reloadCount,
  ]);

  if (!currentTvChannel) return null;

  const isFavorite = favoriteTvChannels.some(
    (c) => c.id === currentTvChannel.id
  );

  const effectiveLogo =
    !currentTvChannel.logo ||
      /imgur\.com|wikia\.nocookie\.net/i.test(currentTvChannel.logo)
      ? epg?.icon || currentTvChannel.logo
      : currentTvChannel.logo;

  const displayGroup =
    currentTvChannel.group &&
      currentTvChannel.group.toLowerCase() !== 'undefined'
      ? currentTvChannel.group
      : 'General';

  const handleFullscreen = () => {
    const container = videoContainerRef.current as
      | (HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void> | void;
        })
      | null;
    const vid = videoRef.current as
      | (HTMLVideoElement & {
          webkitEnterFullscreen?: () => void;
          webkitExitFullscreen?: () => void;
          webkitDisplayingFullscreen?: boolean;
        })
      | null;
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };

    if (
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      vid?.webkitDisplayingFullscreen
    ) {
      if (doc.exitFullscreen) {
        void doc.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        void doc.webkitExitFullscreen();
      } else if (vid?.webkitExitFullscreen) {
        try {
          vid.webkitExitFullscreen();
        } catch {
          // ignore
        }
      }
      exitTvFullMode();
      return;
    }

    const reqFs =
      container?.requestFullscreen?.bind(container) ||
      container?.webkitRequestFullscreen?.bind(container);

    if (reqFs) {
      Promise.resolve(reqFs())
        .then(() => {
          enterTvFullMode();
        })
        .catch(() => {
          if (typeof vid?.webkitEnterFullscreen === 'function') {
            try {
              vid.webkitEnterFullscreen();
              return;
            } catch {
              // ignore
            }
          }
          if (effectiveTvFullMode) {
            exitTvFullMode();
          } else {
            enterTvFullMode();
          }
        });
      return;
    }

    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.matchMedia?.('(display-mode: fullscreen)').matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    if (!isStandalone && typeof vid?.webkitEnterFullscreen === 'function') {
      try {
        vid.webkitEnterFullscreen();
        return;
      } catch {
        // ignore
      }
    }

    if (effectiveTvFullMode) {
      exitTvFullMode();
    } else {
      enterTvFullMode();
    }
  };

  const handlePip = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (video.requestPictureInPicture) {
        await video.requestPictureInPicture();
      }
    } catch {
      // PiP not supported or not ready
    }
  };

  const handleAudioTrackChange = (trackIdx: number) => {
    setActiveAudioTrack(trackIdx);
    const picked = audioTracks[trackIdx];
    if (picked) {
      saveActiveProfileMediaPrefs({
        defaultAudioPref: inferAudioPrefFromTrackName(
          `${picked.name} ${picked.lang || ''}`
        ),
      });
    }
    if (hlsRef.current) {
      hlsRef.current.audioTrack = trackIdx;
    }
    const video = videoRef.current as
      | (HTMLVideoElement & {
        audioTracks?: ArrayLike<{ enabled: boolean }>;
      })
      | null;
    if (video?.audioTracks) {
      for (let i = 0; i < video.audioTracks.length; i += 1) {
        video.audioTracks[i].enabled = i === trackIdx;
      }
    }
  };

  const handleSubtitleTrackChange = (trackIdx: number) => {
    if (trackIdx === -98) {
      setIsOnlineSubFinderOpen(true);
      return;
    }
    if (trackIdx === -99) {
      subFileInputRef.current?.click();
      return;
    }
    setActiveSubtitleTrack(trackIdx);
    if (trackIdx === -1) {
      saveActiveProfileMediaPrefs({ defaultSubLang: 'off' });
    } else if (trackIdx >= 0 && subtitleTracks[trackIdx]) {
      const hay =
        `${subtitleTracks[trackIdx].name} ${subtitleTracks[trackIdx].lang || ''}`.toLowerCase();
      if (/ro|rum|ron|român/i.test(hay)) {
        saveActiveProfileMediaPrefs({ defaultSubLang: 'ro' });
      } else if (/ru|rus|рус/i.test(hay)) {
        saveActiveProfileMediaPrefs({ defaultSubLang: 'ru' });
      } else if (/en|eng|english/i.test(hay)) {
        saveActiveProfileMediaPrefs({ defaultSubLang: 'en' });
      } else if (/es|spa|españ/i.test(hay)) {
        saveActiveProfileMediaPrefs({ defaultSubLang: 'es' });
      } else if (/fr|fra|fre|franç/i.test(hay)) {
        saveActiveProfileMediaPrefs({ defaultSubLang: 'fr' });
      } else if (/de|ger|deu|deutsch/i.test(hay)) {
        saveActiveProfileMediaPrefs({ defaultSubLang: 'de' });
      }
    }
    const video = videoRef.current;

    if (trackIdx === 999) {
      // Custom uploaded .SRT / .VTT track
      if (hlsRef.current) {
        hlsRef.current.subtitleDisplay = false;
        hlsRef.current.subtitleTrack = -1;
      }
      if (video) {
        for (let i = 0; i < video.textTracks.length; i += 1) {
          video.textTracks[i].mode = 'showing';
        }
      }
      return;
    }

    if (hlsRef.current) {
      hlsRef.current.subtitleDisplay = trackIdx >= 0;
      hlsRef.current.subtitleTrack = trackIdx;
    }
    if (video) {
      for (let i = 0; i < video.textTracks.length; i += 1) {
        video.textTracks[i].mode = trackIdx >= 0 ? 'showing' : 'disabled';
      }
    }
  };

  const handleUploadSubtitleFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rawText = await file.text();
      const vttContent = file.name.toLowerCase().endsWith('.srt')
        ? convertSrtToVtt(rawText)
        : rawText;
      if (customSubtitleUrl) {
        URL.revokeObjectURL(customSubtitleUrl);
      }
      const blobUrl = URL.createObjectURL(
        new Blob([vttContent], { type: 'text/vtt;charset=utf-8' })
      );
      setCustomSubtitleUrl(blobUrl);
      setCustomSubtitleName(file.name.replace(/\.(srt|vtt)$/i, ''));
      setActiveSubtitleTrack(999);

      // Enable the custom text track on the <video> element
      setTimeout(() => {
        const video = videoRef.current;
        if (!video) return;
        for (let i = 0; i < video.textTracks.length; i += 1) {
          video.textTracks[i].mode = 'showing';
        }
      }, 150);
    } catch {
      // ignore invalid file
    } finally {
      e.target.value = '';
    }
  };

  const showSideColumn = isMobilePhone
    ? !isOsdOverlayOpen
    : !effectiveTvFullMode && isSidePanelOpen && !isOsdOverlayOpen;

  return (
    <div
      id="aether-tv-player-modal"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      data-full-mode={
        effectiveTvFullMode || (inlineEmbeddedMode && isSplitFullscreen)
          ? 'true'
          : 'false'
      }
      data-osd-visible={isTvOsdVisible ? 'true' : 'false'}
      data-osd-overlay={isOsdOverlayOpen ? 'true' : 'false'}
      aria-label={currentTvChannel.name}
      onMouseMove={() => {
        if (effectiveTvFullMode) wakeTvOsd();
      }}
      onKeyDown={() => {
        if (effectiveTvFullMode) wakeTvOsd();
      }}
      onClick={(e) => {
        if (
          e.target === dialogRef.current &&
          !effectiveTvFullMode &&
          !inlineEmbeddedMode
        ) {
          closeTvPlayer();
        }
      }}
      className={
        effectiveTvFullMode
          ? 'fixed inset-0 z-[190] m-0 w-screen h-screen max-w-none max-h-none rounded-none bg-black text-zinc-100 border-0 shadow-2xl p-0 overflow-hidden'
          : inlineEmbeddedMode && isSplitFullscreen
            ? 'fixed inset-0 z-[190] m-0 w-screen h-screen max-w-none max-h-none rounded-none bg-[#090d16] text-zinc-100 border-0 shadow-2xl p-0 overflow-hidden'
            : inlineEmbeddedMode
              ? 'relative w-full h-[calc(100dvh-7.75rem)] md:h-[calc(100dvh-5.25rem)] min-h-[420px] flex flex-col overflow-hidden rounded-2xl bg-[#090d16] text-zinc-100 border border-white/15 shadow-2xl'
              : 'fixed inset-0 z-[190] bg-slate-950/85 backdrop-blur-md flex items-start sm:items-center justify-center p-0 sm:p-3 overflow-y-auto no-scrollbar'
      }
    >
      <div
        className={
          effectiveTvFullMode
            ? 'relative flex flex-col w-screen h-screen overflow-hidden bg-black'
            : inlineEmbeddedMode && isSplitFullscreen
              ? 'relative flex flex-col w-screen h-screen overflow-hidden bg-[#090d16]'
              : inlineEmbeddedMode
                ? 'relative flex flex-col w-full h-full flex-1 min-h-0 overflow-hidden bg-[#090d16]'
                : 'mx-auto m-0 sm:my-auto w-screen h-[100dvh] sm:h-auto sm:w-[96vw] max-w-[1440px] rounded-none sm:rounded-3xl bg-[#090d16] text-zinc-100 border-0 sm:border sm:border-zinc-800 shadow-2xl flex flex-col max-h-none sm:max-h-[94vh] overflow-hidden'
        }
      >
        {/* Top bar — Normal Web Mode only (Smart TV Full Mode uses authentic Smart IPTV Bottom Info Banner & OK Channel List OSD) */}
        {!effectiveTvFullMode && (
          <div className="shrink-0 flex items-center justify-between gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-[#0b111e] border-b border-white/10">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <StationAvatar
                name={currentTvChannel.name}
                favicon={effectiveLogo}
                size="sm"
                isPlaying={false}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h2 className="text-sm sm:text-lg font-bold text-white truncate">
                    {currentTvChannel.name}
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold rounded-full bg-rose-600 text-white shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    {currentTvChannel.resolution || 'LIVE'}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-zinc-300 flex items-center gap-1.5 truncate">
                  {currentTvChannel.countryCode && (
                    <span className="shrink-0">
                      {getCountryFlagEmoji(currentTvChannel.countryCode)}{' '}
                      {getLocalizedCountryName(
                        currentTvChannel.countryCode,
                        currentTvChannel.countryCode,
                        language
                      )}
                    </span>
                  )}
                  <span>•</span>
                  <span className="truncate">{displayGroup}</span>
                  {(activeArchiveProg?.title || epg?.now?.title) && (
                    <>
                      <span>•</span>
                      <span className="text-amber-300 font-semibold truncate">
                        {activeArchiveProg
                          ? `[ARHIVĂ] ${activeArchiveProg.title}`
                          : epg?.now?.title}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => toggleFavoriteTvChannel(currentTvChannel)}
                aria-pressed={isFavorite}
                aria-label={format(
                  isFavorite ? t.favorites.removeFav : t.favorites.addFav,
                  { name: currentTvChannel.name }
                )}
                className={`min-w-[38px] min-h-[38px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center rounded-full transition-all focus:outline-none focus:ring-4 focus:ring-white ${isFavorite
                  ? 'text-rose-400 bg-rose-950/60 hover:bg-rose-950/90'
                  : 'text-zinc-300 bg-zinc-800/80 hover:text-white hover:bg-zinc-700'
                  }`}
              >
                <Heart
                  aria-hidden="true"
                  className={`w-4 h-4 sm:w-5 sm:h-5 ${isFavorite ? 'fill-current' : ''}`}
                />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (
                    typeof window !== 'undefined' &&
                    (window.innerWidth < 640 ||
                      /iPhone|iPad|iPod/i.test(navigator.userAgent))
                  ) {
                    handleFullscreen();
                    return;
                  }
                  setIsFullModeExpanded(true);
                  setIsSidePanelOpen(false);
                  setIsInfoPanelOpen(false);
                  wakeTvOsd();
                }}
                aria-label="Full Mode TV"
                title="Ecran Complet (Player Nativ pe Mobil / Full Mode pe TV)"
                className="min-w-[38px] min-h-[38px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center rounded-full text-zinc-200 bg-zinc-800/80 hover:text-white hover:bg-blue-600 transition-all focus:outline-none focus:ring-4 focus:ring-white cursor-pointer"
              >
                <Maximize className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
              </button>

              {!inlineEmbeddedMode && (
                <button
                  type="button"
                  onClick={closeTvPlayer}
                  aria-label={t.tv.closeTvPlayer}
                  className="min-w-[38px] min-h-[38px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center rounded-full text-zinc-200 bg-zinc-800/90 hover:text-white hover:bg-rose-600 transition-all focus:outline-none focus:ring-4 focus:ring-white focus:bg-rose-600"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Active Catch-up / TV Archive Playback Banner */}
        {activeArchiveProg && (!effectiveTvFullMode || isTvOsdVisible) && (
          <div className="shrink-0 px-3 sm:px-6 py-2 bg-amber-950/90 border-b border-amber-600/60 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-zinc-950 text-[11px] font-extrabold uppercase tracking-wider shrink-0">
                ARHIVĂ TV (CATCH-UP)
              </span>
              <span className="text-xs sm:text-sm font-bold text-amber-200 truncate">
                {activeArchiveProg.title}
              </span>
              <span className="text-xs text-amber-300/90 tabular-nums shrink-0">
                • {formatEpgDayLabel(getEpgDayKey(activeArchiveProg.start))}{' '}
                ({formatEpgTime(activeArchiveProg.start)} –{' '}
                {formatEpgTime(activeArchiveProg.stop)})
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveArchiveProg(null);
                setStreamIndex(0);
              }}
              className="min-h-[30px] px-3.5 py-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>Înapoi la LIVE</span>
            </button>
          </div>
        )}

        {/* SMART BODY: Sticky Video + Compact EPG on Top + Full-Height Scrollable Channel List on Mobile (<1024px) | Strict 2/3 Left + 1/3 Right Flex-Row on Desktop/TV */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col lg:flex-row h-full">
          {/* LEFT COLUMN (2/3 of screen on Desktop/TV; compact shrink-0 video + EPG header on Mobile): 16:9 Video Player + Controls + EPG Now/Next */}
          <div
            className={`${showSideColumn
              ? 'lg:w-2/3 xl:w-2/3 lg:h-full'
              : 'lg:w-full lg:h-full'
              } flex flex-col shrink-0 lg:flex-1 lg:shrink lg:min-h-0 lg:overflow-hidden no-scrollbar bg-[#090d16]`}
          >
            {/* Video Area (Full height in TV Full Mode, or flex-1 above compact EPG in Split-View so EPG + Upcoming Shows are never pushed off screen) */}
            <div
              ref={videoContainerRef}
              className={`group/video relative w-full bg-black flex items-center justify-center overflow-hidden ${effectiveTvFullMode && !showSideColumn && !isInfoPanelOpen
                ? 'flex-1 min-h-0'
                : 'aspect-video shrink-0 lg:aspect-auto lg:flex-1 lg:min-h-0'
                }`}
            >
              <style>{`
                #aether-tv-player-modal video::cue {
                  font-size: ${profileSubFontPx}px !important;
                  font-weight: 800 !important;
                  color: #ffffff !important;
                  background-color: rgba(0, 0, 0, 0.78) !important;
                  text-shadow: 0 2px 4px rgba(0,0,0,0.95) !important;
                }
              `}</style>
              <video
                ref={videoRef}
                controls={!effectiveTvFullMode}
                playsInline
                autoPlay
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 640) {
                    return;
                  }
                  if (effectiveTvFullMode) {
                    setOsdViewMode('channels');
                    setIsOsdOverlayOpen(true);
                  } else {
                    enterTvFullMode();
                  }
                }}
                onPlaying={(e) => {
                  setVideoStatus('playing');
                  const vid = e.currentTarget;
                  if (vid.videoWidth > 0 && vid.videoHeight > 0) {
                    setVideoResolution(`${vid.videoWidth}x${vid.videoHeight}`);
                  }
                }}
                onLoadedData={(e) => {
                  setVideoStatus('playing');
                  const vid = e.currentTarget;
                  if (vid.videoWidth > 0 && vid.videoHeight > 0) {
                    setVideoResolution(`${vid.videoWidth}x${vid.videoHeight}`);
                  }
                }}
                onVolumeChange={(e) => {
                  if (!e.currentTarget.muted && isAutoMuted) {
                    setIsAutoMuted(false);
                  }
                }}
                onLoadedMetadata={(e) => {
                  const vid = e.currentTarget;
                  if (vid.videoWidth > 0 && vid.videoHeight > 0) {
                    setVideoResolution(`${vid.videoWidth}x${vid.videoHeight}`);
                  }
                  if (!currentTvChannel?.url || !Number.isFinite(vid.duration) || vid.duration <= 90) return;
                  try {
                    const raw = localStorage.getItem('aether_native_video_progress_v1');
                    const map = raw ? JSON.parse(raw) : {};
                    const savedTime = Number(map[currentTvChannel.url]);
                    if (Number.isFinite(savedTime) && savedTime > 5 && savedTime < vid.duration - 15) {
                      vid.currentTime = savedTime;
                    }
                  } catch {
                    // ignore storage errors
                  }
                }}
                onTimeUpdate={(e) => {
                  const vid = e.currentTarget;
                  if (activeArchiveProg) {
                    const cur = Math.max(0, Math.floor(vid.currentTime || 0));
                    setArchiveVideoTimeSec((prev) => (prev !== cur ? cur : prev));
                  }
                  if (!currentTvChannel?.url || !Number.isFinite(vid.duration) || vid.duration <= 90) return;
                  if (vid.currentTime < 5) return;
                  try {
                    const raw = localStorage.getItem('aether_native_video_progress_v1');
                    const map = raw ? JSON.parse(raw) : {};
                    if (vid.currentTime >= vid.duration - 15) {
                      delete map[currentTvChannel.url];
                    } else {
                      map[currentTvChannel.url] = Math.floor(vid.currentTime);
                    }
                    localStorage.setItem('aether_native_video_progress_v1', JSON.stringify(map));
                  } catch {
                    // ignore storage errors
                  }
                }}
                className="w-full h-full object-contain bg-black"
              >
                {customSubtitleUrl && (
                  <track
                    key={customSubtitleUrl}
                    kind="subtitles"
                    src={customSubtitleUrl}
                    srcLang={language}
                    label={customSubtitleName || 'Subtitrare externă'}
                    default
                  />
                )}
              </video>

              {/* Unmute banner ONLY if browser genuinely forced muted autoplay AND video frames are playing */}
              {isAutoMuted && videoStatus === 'playing' && Boolean(videoResolution) && (
                <button
                  type="button"
                  onClick={() => {
                    const v = videoRef.current;
                    if (v) {
                      v.muted = false;
                      v.volume = 1;
                      setIsAutoMuted(false);
                    }
                  }}
                  className="absolute top-14 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 shadow-2xl animate-pulse cursor-pointer"
                >
                  <VolumeX className="w-4 h-4" />
                  <span>Sunet oprit de browser — Apasă OK pentru Sunet</span>
                </button>
              )}

              {/* Focusable TV Remote Surface when watching fullscreen Live TV (captures OK/Enter on all Smart TV browsers) */}
              {effectiveTvFullMode && !isOsdOverlayOpen && (
                <button
                  ref={liveSurfaceBtnRef}
                  type="button"
                  aria-label="Deschide Lista de Canale Smart IPTV (OK)"
                  onClick={() => {
                    if (Date.now() - osdClosedAtRef.current < 320) return;
                    if (videoRef.current && videoRef.current.muted) {
                      videoRef.current.muted = false;
                      setIsAutoMuted(false);
                    }
                    setOsdViewMode('channels');
                    setIsOsdOverlayOpen(true);
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    zIndex: 20,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                />
              )}

              {/* Top-Right Exit Full Mode Pill (shown when OSD is awake in Full Mode) */}
              {effectiveTvFullMode && isTvOsdVisible && !isOsdOverlayOpen && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    exitTvFullMode();
                  }}
                  style={{
                    backgroundColor: 'rgba(10, 15, 28, 0.88)',
                    border: '1px solid rgba(148, 163, 184, 0.28)',
                  }}
                  className="absolute top-5 right-6 z-30 px-4 py-2 rounded-full text-xs sm:text-sm font-bold text-zinc-100 hover:text-white hover:bg-slate-800/95 backdrop-blur-xl shadow-2xl inline-flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span>← Ieșire Full Mode (Back / Esc)</span>
                </button>
              )}

              {/* Smart IPTV Bottom Info Banner (Exact match to Photo 2: Channel No + Name | Current & Next EPG + Mins | Clock + Logo + Resolution) */}
              {effectiveTvFullMode && isTvOsdVisible && !isOsdOverlayOpen && (
                <div
                  onClick={() => {
                    if (Date.now() - osdClosedAtRef.current < 320) return;
                    setOsdViewMode('channels');
                    setIsOsdOverlayOpen(true);
                  }}
                  style={{
                    backgroundColor: 'rgba(10, 15, 28, 0.92)',
                    border: '1px solid rgba(148, 163, 184, 0.22)',
                    borderRadius: '24px',
                    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8)',
                  }}
                  className="absolute bottom-5 inset-x-6 z-30 rounded-3xl backdrop-blur-2xl shadow-2xl overflow-hidden cursor-pointer select-none"
                >
                  {/* Top Edge Full-Width EPG / Archive Progress Line (clickable to seek when playing from Archive) */}
                  <div
                    onClick={
                      activeArchiveProg ? handleSeekArchiveProgress : undefined
                    }
                    title={
                      activeArchiveProg
                        ? 'Click pe bară pentru a derula emisiunea din Arhivă'
                        : undefined
                    }
                    className={`w-full ${
                      activeArchiveProg ? 'h-2 cursor-pointer' : 'h-1'
                    } bg-white/15 overflow-hidden`}
                  >
                    <div
                      className={`h-full transition-all duration-300 ${
                        activeArchiveProg ? 'bg-[#f59e0b]' : 'bg-[#38bdf8]'
                      }`}
                      style={{
                        width: `${
                          activeArchiveProg
                            ? archiveProgressPct
                            : epg?.now
                              ? epgStats.progress
                              : 100
                        }%`,
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'table',
                      tableLayout: 'fixed',
                      width: '100%',
                      padding: '12px 22px',
                    }}
                  >
                    {/* Left (26%): Channel Number + Favorite Star + Channel Name */}
                    <div
                      style={{
                        display: 'table-cell',
                        width: '26%',
                        verticalAlign: 'middle',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        paddingRight: '16px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '22px',
                          fontWeight: 800,
                          color: '#ffffff',
                          marginRight: '10px',
                          verticalAlign: 'middle',
                        }}
                      >
                        {Math.max(
                          1,
                          tvQueue.findIndex(
                            (c) => c.id === currentTvChannel.id
                          ) + 1
                        )}
                      </span>
                      {isFavorite && (
                        <span
                          style={{
                            color: '#fbbf24',
                            fontSize: '18px',
                            marginRight: '8px',
                            verticalAlign: 'middle',
                          }}
                        >
                          ★
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: '20px',
                          fontWeight: 700,
                          color: '#ffffff',
                          verticalAlign: 'middle',
                        }}
                      >
                        {currentTvChannel.name}
                      </span>
                    </div>

                    {/* Center (60%): Now Playing & Next EPG Programmes */}
                    <div
                      style={{
                        display: 'table-cell',
                        width: '60%',
                        verticalAlign: 'middle',
                        paddingRight: '16px',
                      }}
                    >
                      {/* Row 1: Current Programme */}
                      <div
                        style={{
                          display: 'table',
                          tableLayout: 'fixed',
                          width: '100%',
                          marginBottom: '4px',
                        }}
                      >
                        <span
                          style={{
                            display: 'table-cell',
                            width: '135px',
                            fontSize: '16px',
                            color: '#e4e4e7',
                            whiteSpace: 'nowrap',
                            verticalAlign: 'middle',
                          }}
                        >
                          {activeArchiveProg
                            ? `${formatEpgTime(activeArchiveProg.start)} - ${formatEpgTime(activeArchiveProg.stop)}`
                            : epg?.now
                              ? `${formatEpgTime(epg.now.start)} - ${formatEpgTime(epg.now.stop)}`
                              : ''}
                        </span>
                        <span
                          style={{
                            display: 'table-cell',
                            fontSize: '17px',
                            fontWeight: 700,
                            color: '#ffffff',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            verticalAlign: 'middle',
                            paddingRight: '10px',
                          }}
                        >
                          {activeArchiveProg
                            ? `[ARHIVĂ] ${activeArchiveProg.title}`
                            : epg?.now?.title || ''}
                        </span>
                        <span
                          style={{
                            display: 'table-cell',
                            width: '115px',
                            textAlign: 'right',
                            fontSize: '15px',
                            color: activeArchiveProg ? '#fbbf24' : '#e4e4e7',
                            fontWeight: activeArchiveProg ? 700 : 400,
                            whiteSpace: 'nowrap',
                            verticalAlign: 'middle',
                          }}
                        >
                          {activeArchiveProg
                            ? `${formatArchiveClock(archiveElapsedSec)} / ${formatArchiveClock(archiveTotalSec)}`
                            : epg?.now
                              ? `+${epgStats.remainingMin}`
                              : ''}
                        </span>
                      </div>

                      {/* Row 2: Next Programme (from Archive when playing Catchup, or Live Upcoming) */}
                      {(() => {
                        const nextProg = activeArchiveProg
                          ? archiveNextProgrammes[0]
                          : epg?.upcoming?.[0];
                        return (
                          <div
                            style={{
                              display: 'table',
                              tableLayout: 'fixed',
                              width: '100%',
                            }}
                          >
                            <span
                              style={{
                                display: 'table-cell',
                                width: '135px',
                                fontSize: '15px',
                                color: '#a1a1aa',
                                whiteSpace: 'nowrap',
                                verticalAlign: 'middle',
                              }}
                            >
                              {nextProg
                                ? `${formatEpgTime(nextProg.start)} - ${formatEpgTime(nextProg.stop)}`
                                : ''}
                            </span>
                            <span
                              style={{
                                display: 'table-cell',
                                fontSize: '15px',
                                fontWeight: 400,
                                color: '#d4d4d8',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                verticalAlign: 'middle',
                                paddingRight: '10px',
                              }}
                            >
                              {nextProg?.title || ''}
                            </span>
                            <span
                              style={{
                                display: 'table-cell',
                                width: '115px',
                                textAlign: 'right',
                                fontSize: '15px',
                                color: '#a1a1aa',
                                whiteSpace: 'nowrap',
                                verticalAlign: 'middle',
                              }}
                            >
                              {activeArchiveProg
                                ? `-${archiveRemainingMin}m (${archiveProgressPct}%)`
                                : nextProg
                                  ? `+${Math.max(1, Math.round((nextProg.stop - nextProg.start) / 60000))}`
                                  : ''}
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Right (14%): Wall Clock + Channel Logo + Video Resolution */}
                    <div
                      style={{
                        display: 'table-cell',
                        width: '14%',
                        verticalAlign: 'middle',
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '17px',
                          fontWeight: 700,
                          color: '#ffffff',
                          lineHeight: 1.2,
                        }}
                      >
                        {new Date().toLocaleTimeString('ro-RO', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      {effectiveLogo && (
                        <div style={{ margin: '3px 0' }}>
                          <img
                            src={effectiveLogo}
                            alt=""
                            style={{
                              height: '22px',
                              maxWidth: '80px',
                              objectFit: 'contain',
                              display: 'inline-block',
                            }}
                          />
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          color: '#38bdf8',
                          lineHeight: 1.2,
                        }}
                      >
                        {videoResolution ||
                          currentTvChannel.resolution ||
                          '1920x1080'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Floating Smart IPTV OSD Channel List / EPG Overlay (when triggered by OK or Arrows) */}
              {isOsdOverlayOpen && (
                <div
                  id="aether-tv-osd-overlay"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      osdClosedAtRef.current = Date.now();
                      setIsOsdOverlayOpen(false);
                    }
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    zIndex: 45,
                    backgroundColor: 'rgba(0, 0, 0, 0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: '86vw',
                      maxWidth: '880px',
                      height: '78vh',
                      maxHeight: '600px',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                    }}
                  >
                    <TvOsdChannelList
                      currentChannel={currentTvChannel}
                      channels={tvQueue}
                      isOverlayMode
                      initialViewMode={osdViewMode}
                      onToggleOverlayMode={() => {
                        osdClosedAtRef.current = Date.now();
                        setIsOsdOverlayOpen(false);
                        setIsSidePanelOpen(true);
                        setSidePanelTab('channels');
                      }}
                      onCloseOverlay={() => {
                        osdClosedAtRef.current = Date.now();
                        setIsOsdOverlayOpen(false);
                        wakeTvOsd();
                      }}
                      onToggleInfoPanel={() => {
                        osdClosedAtRef.current = Date.now();
                        setIsOsdOverlayOpen(false);
                        wakeTvOsd();
                      }}
                      isInfoPanelOpen={isInfoPanelOpen}
                      onPlayArchiveProgramme={(ch, prog) => {
                        if (ch.id !== currentTvChannel.id) {
                          useRadioStore.getState().playTvChannel(
                            { ...ch, archiveProgram: prog || undefined },
                            tvQueue
                          );
                        } else {
                          setActiveArchiveProg(prog);
                          setStreamIndex(0);
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Loading overlay */}
              {videoStatus === 'loading' && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-[2px]">
                  <Loader2
                    className="w-10 h-10 text-blue-400 animate-spin"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-zinc-200">
                    {t.player.loading}
                  </span>
                </div>
              )}

              {/* Error overlay */}
              {videoStatus === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center bg-zinc-950/95">
                  <div className="w-12 h-12 rounded-2xl bg-rose-950/80 border border-rose-800/60 flex items-center justify-center text-rose-400">
                    <AlertCircle className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <div className="max-w-md space-y-1">
                    <h3 className="text-base font-bold text-white">
                      {t.player.error}
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-400">
                      {t.tv.streamError}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setStreamIndex(0);
                        setReloadCount((c) => c + 1);
                      }}
                      className="min-h-[42px] px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-medium inline-flex items-center gap-2 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" aria-hidden="true" />
                      <span>{t.player.retryStream}</span>
                    </button>
                    <button
                      type="button"
                      onClick={playNextTvChannel}
                      className="min-h-[42px] px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                    >
                      <Tv className="w-4 h-4" aria-hidden="true" />
                      <span>{t.tv.tryAnotherChannel}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Compact EPG / Archive Program Guide & Progress Line Section */}
            {isInfoPanelOpen &&
              (activeArchiveProg ||
                epg?.now ||
                (epg?.upcoming && epg.upcoming.length > 0)) && (
                <div className="shrink-0 flex flex-col justify-start px-3 sm:px-4 py-1.5 sm:py-2.5 bg-[#090d16] border-t border-white/10 gap-1.5 sm:gap-2">
                  {activeArchiveProg ? (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[11px] font-extrabold uppercase tracking-wider shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            ARHIVĂ TV
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-zinc-200 tabular-nums shrink-0">
                            <Clock
                              className="w-3.5 h-3.5 text-amber-400"
                              aria-hidden="true"
                            />
                            {formatEpgTime(activeArchiveProg.start)} –{' '}
                            {formatEpgTime(activeArchiveProg.stop)}
                          </span>
                          {activeArchiveProg.category && (
                            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-[11px] font-medium truncate">
                              {activeArchiveProg.category}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-amber-300 tabular-nums">
                          {formatArchiveClock(archiveElapsedSec)} /{' '}
                          {formatArchiveClock(archiveTotalSec)} • mai sunt{' '}
                          {archiveRemainingMin} min ({archiveProgressPct}%)
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-white truncate">
                          {activeArchiveProg.title}
                        </h3>
                      </div>

                      {/* Interactive Archive Progress Line (click anywhere to seek inside the archive show) */}
                      <div
                        onClick={handleSeekArchiveProgress}
                        title="Click pe bară pentru a derula în emisiunea din Arhivă"
                        className="group/archbar relative w-full h-2.5 rounded-full bg-zinc-800 overflow-hidden shadow-inner cursor-pointer"
                      >
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-sky-400 rounded-full transition-all duration-300"
                          style={{ width: `${archiveProgressPct}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    epg?.now && (
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-950/90 border border-blue-700/50 text-blue-300 text-[11px] font-extrabold uppercase tracking-wider shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                              EPG ACUM
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-zinc-200 tabular-nums shrink-0">
                              <Clock
                                className="w-3.5 h-3.5 text-blue-400"
                                aria-hidden="true"
                              />
                              {formatEpgTime(epg.now.start)} –{' '}
                              {formatEpgTime(epg.now.stop)}
                            </span>
                            {epg.now.category && (
                              <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-[11px] font-medium truncate">
                                {epg.now.category}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-bold text-blue-400 tabular-nums">
                            {epgStats.remainingShort} ({epgStats.progress}%)
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="text-sm sm:text-base font-bold text-white truncate">
                            {epg.now.title}
                          </h3>
                        </div>

                        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden shadow-inner">
                          <div
                            className="h-full bg-gradient-to-r from-[#1e3a8a] via-[#2563eb] to-[#38bdf8] rounded-full transition-all duration-300"
                            style={{ width: `${epgStats.progress}%` }}
                          />
                        </div>
                      </div>
                    )
                  )}

                  {(() => {
                    const nextList = activeArchiveProg
                      ? archiveNextProgrammes
                      : epg?.upcoming?.slice(0, 3) || [];
                    if (nextList.length === 0) return null;
                    return (
                      <div className="hidden lg:block pt-1.5 border-t border-white/10">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                            <Calendar
                              className="w-3.5 h-3.5 text-blue-400"
                              aria-hidden="true"
                            />
                            <span>
                              {activeArchiveProg
                                ? 'Urmează în arhivă'
                                : 'Urmează în program'}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                          {nextList.map((item, idx) => {
                            const canPlayArchiveItem =
                              Boolean(activeArchiveProg) &&
                              item.stop <= Date.now();
                            return (
                              <div
                                key={`${item.start}_${idx}`}
                                onClick={
                                  canPlayArchiveItem
                                    ? () => {
                                        setActiveArchiveProg(item);
                                        setStreamIndex(0);
                                      }
                                    : undefined
                                }
                                className={`px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 flex flex-col min-w-0 ${
                                  canPlayArchiveItem
                                    ? 'hover:border-amber-500/50 hover:bg-white/[0.08] cursor-pointer transition-colors'
                                    : ''
                                }`}
                              >
                                <span
                                  className={`text-[11px] font-bold tabular-nums ${
                                    activeArchiveProg
                                      ? 'text-amber-400'
                                      : 'text-blue-400'
                                  }`}
                                >
                                  {formatEpgTime(item.start)} –{' '}
                                  {formatEpgTime(item.stop)}
                                </span>
                                <span
                                  className="text-xs font-medium text-zinc-200 truncate"
                                  title={item.title}
                                >
                                  {item.title}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
          </div>

          {/* RIGHT COLUMN (1/3 of screen on Desktop/TV; remaining full height below video on Mobile): Side-by-Side Channel Switcher OR Multi-Day TV Archive */}
          {showSideColumn && (
            <div className="flex-1 min-h-0 lg:flex-initial lg:w-1/3 xl:w-1/3 lg:h-full border-t lg:border-t-0 lg:border-l border-white/10 bg-[#090d16] flex flex-col overflow-hidden">
              {/* Tab 1: Clean Channel List */}
              {sidePanelTab === 'channels' ? (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <TvOsdChannelList
                    currentChannel={currentTvChannel}
                    channels={tvQueue}
                    isOverlayMode={false}
                    onToggleOverlayMode={() => setIsOsdOverlayOpen(true)}
                    onToggleInfoPanel={() => setIsInfoPanelOpen((v) => !v)}
                    isInfoPanelOpen={isInfoPanelOpen}
                    onSelectChannel={(selectedCh) => {
                      if (
                        typeof window !== 'undefined' &&
                        window.innerWidth < 640
                      ) {
                        if (selectedCh.id === currentTvChannel.id) {
                          handleFullscreen();
                        }
                        return;
                      }
                      const isMobileViewport =
                        typeof window !== 'undefined' &&
                        window.innerWidth < 1024;
                      if (
                        !isMobileViewport ||
                        selectedCh.id === currentTvChannel.id
                      ) {
                        enterTvFullMode();
                      }
                    }}
                    onPlayArchiveProgramme={(ch, prog) => {
                      if (ch.id !== currentTvChannel.id) {
                        useRadioStore.getState().playTvChannel(
                          { ...ch, archiveProgram: prog || undefined },
                          tvQueue
                        );
                      } else {
                        setActiveArchiveProg(prog);
                        setStreamIndex(0);
                      }
                      enterTvFullMode();
                    }}
                  />
                </div>
              ) : (
                /* Tab 2: Interactive 7-Day TV Archive / Catch-up Browser */
                <div className="flex-1 min-h-0 p-3 sm:p-4 flex flex-col gap-3 overflow-hidden">
                  <div className="shrink-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <History
                          className="w-4 h-4 text-blue-400"
                          aria-hidden="true"
                        />
                        <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                          Arhivă TV — {currentTvChannel.name}
                        </h3>
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        {archiveProgrammes.length} emisiuni
                      </span>
                    </div>

                    {/* Single-row Day Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {archiveDays.map((dayKey) => {
                        const isSelected = dayKey === selectedArchiveDay;
                        return (
                          <button
                            key={dayKey}
                            type="button"
                            onClick={() => setSelectedArchiveDay(dayKey)}
                            className={`min-h-[32px] px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${isSelected
                              ? 'bg-blue-500 text-zinc-950 font-bold shadow-xs'
                              : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
                              }`}
                          >
                            {formatEpgDayLabel(dayKey)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Programmes list for selected day */}
                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1.5 divide-y divide-zinc-900">
                    {programmesForSelectedDay.map((prog, idx) => {
                      const nowMs = Date.now();
                      const isPast = prog.stop <= nowMs;
                      const isLiveNow = prog.start <= nowMs && prog.stop > nowMs;
                      const isSelectedArchive =
                        activeArchiveProg?.start === prog.start &&
                        activeArchiveProg?.title === prog.title;

                      return (
                        <div
                          key={`${prog.start}_${idx}`}
                          className={`py-2 px-2.5 rounded-xl flex items-center justify-between gap-2 transition-colors ${isSelectedArchive
                            ? 'bg-amber-950/60 border border-amber-500/70'
                            : isLiveNow
                              ? 'bg-blue-950/40 border border-blue-700/50'
                              : 'bg-zinc-900/60 hover:bg-zinc-900'
                            }`}
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold tabular-nums text-zinc-300 shrink-0">
                                {formatEpgTime(prog.start)} –{' '}
                                {formatEpgTime(prog.stop)}
                              </span>

                              {isLiveNow ? (
                                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold shrink-0">
                                  ACUM
                                </span>
                              ) : isPast ? (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold shrink-0">
                                  ARHIVĂ
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-medium shrink-0">
                                  URMEAZĂ
                                </span>
                              )}
                            </div>

                            <p className="text-xs font-semibold text-zinc-100 truncate">
                              {prog.title}
                            </p>
                            {prog.desc && (
                              <p className="text-[11px] text-zinc-400 truncate">
                                {prog.desc}
                              </p>
                            )}
                          </div>

                          {(isPast || isLiveNow) && (
                            <button
                              type="button"
                              onClick={() => {
                                if (isLiveNow) {
                                  setActiveArchiveProg(null);
                                } else {
                                  setActiveArchiveProg(prog);
                                }
                                setStreamIndex(0);
                                enterTvFullMode();
                              }}
                              className={`min-h-[30px] px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 shrink-0 transition-colors ${isSelectedArchive
                                ? 'bg-amber-500 text-zinc-950'
                                : isLiveNow
                                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                  : 'bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-amber-300 border border-amber-500/40'
                                }`}
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>
                                {isSelectedArchive
                                  ? 'Activ'
                                  : isLiveNow
                                    ? 'LIVE'
                                    : 'Redă'}
                              </span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <OnlineSubtitleFinderModal
        isOpen={isOnlineSubFinderOpen}
        onClose={() => setIsOnlineSubFinderOpen(false)}
        initialTitle={
          activeArchiveProg?.title ||
          epg?.now?.title ||
          currentTvChannel.name.replace(/\b(HD|FHD|4K|SD|RO|RU|MD)\b/gi, '').trim()
        }
        initialType="movie"
        onApplySubtitle={({ vttBlobUrl, label }) => {
          if (customSubtitleUrl) {
            URL.revokeObjectURL(customSubtitleUrl);
          }
          setCustomSubtitleUrl(vttBlobUrl);
          setCustomSubtitleName(label);
          setActiveSubtitleTrack(999);
          window.setTimeout(() => {
            const video = videoRef.current;
            if (!video) return;
            for (let i = 0; i < video.textTracks.length; i += 1) {
              video.textTracks[i].mode = 'showing';
            }
          }, 150);
        }}
      />
    </div>
  );
};
