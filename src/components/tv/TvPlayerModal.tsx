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
  Layers,
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
import { TvOsdChannelList } from './TvOsdChannelList';
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
import { buildCatchupStreamCandidates } from '../../services/tvApi';

function resolveWorkingStreamUrl(rawUrl: string): string {
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
      'http://flussonic.mkpnet.ru/tv-687ba838ca927b9a/video.m3u8',
    ],
  ],
  [
    /Viasat Explore|viju\+? Explore/i,
    [
      'http://stream.mcquack.net/239/index.m3u8',
      'https://flussonic.mkpnet.ru/tv-7c57a4c3f9a896ea/video.m3u8',
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
      'http://stream.mcquack.net/135/index.m3u8',
      'https://bl.rutube.ru/livestream/546602986e6a424d74d594876ddb3f04/index.m3u8?s=K-z3nz49R1oGQ-5yPSd8pg&e=2082157024&scheme=https',
    ],
  ],
  [
    /^Первый канал|Channel One/i,
    [
      'https://stream3.cinerama.uz/1214/mono.m3u8',
      'http://flussonic.mkpnet.ru/tv-4f9598ab5f91dca4/video.m3u8',
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
      'http://stream.mcquack.net/138/index.m3u8',
      'http://flussonic.linkintel.ru/sts/index.m3u8',
    ],
  ],
];

function getCandidateStreams(
  channel: TvChannel | null,
  queue: TvChannel[]
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

  for (const [pattern, backups] of KNOWN_CHANNEL_BACKUPS) {
    if (pattern.test(channel.name)) {
      for (const b of backups) add(b);
    }
  }

  const targetKey = normalizeEpgLookupKey(channel.name, true);
  if (targetKey) {
    for (const q of queue) {
      if (q.id === channel.id) continue;
      if (normalizeEpgLookupKey(q.name, true) === targetKey) {
        add(q.url);
      }
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
}

export const TvPlayerModal: React.FC<TvPlayerModalProps> = ({
  isSmartTvFullMode = false,
}) => {
  const { t, language, format } = useTranslation();
  const effectiveTvFullMode =
    isSmartTvFullMode ||
    (typeof document !== 'undefined' &&
      document.documentElement.classList.contains('smart-tv-mode'));

  const currentTvChannel = useRadioStore((state) => state.currentTvChannel);
  const tvQueue = useRadioStore((state) => state.tvQueue);
  const favoriteTvChannels = useRadioStore((state) => state.favoriteTvChannels);
  const closeTvPlayer = useRadioStore((state) => state.closeTvPlayer);
  const playNextTvChannel = useRadioStore((state) => state.playNextTvChannel);
  const playPreviousTvChannel = useRadioStore(
    (state) => state.playPreviousTvChannel
  );
  const toggleFavoriteTvChannel = useRadioStore(
    (state) => state.toggleFavoriteTvChannel
  );

  const epg = useChannelEpg(currentTvChannel);
  const epgStats = getEpgTimingStats(epg?.now);

  const [activeArchiveProg, setActiveArchiveProg] =
    useState<EpgProgramme | null>(null);
  const [archiveProgrammes, setArchiveProgrammes] = useState<EpgProgramme[]>(
    []
  );
  const [selectedArchiveDay, setSelectedArchiveDay] = useState<string>('');

  const candidateStreams = useMemo(() => {
    const baseCandidates = getCandidateStreams(currentTvChannel, tvQueue);
    if (!activeArchiveProg || !currentTvChannel) {
      return baseCandidates;
    }
    const catchupUrls: string[] = [];
    for (const baseUrl of baseCandidates) {
      const generated = buildCatchupStreamCandidates(
        baseUrl,
        activeArchiveProg.start,
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
  }, [currentTvChannel, tvQueue, activeArchiveProg]);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const liveSurfaceBtnRef = useRef<HTMLButtonElement | null>(null);
  const osdClosedAtRef = useRef<number>(0);
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
  const [osdViewMode, setOsdViewMode] = useState<'channels' | 'epg'>('channels');
  const [videoResolution, setVideoResolution] = useState<string>('');
  const [isTvOsdVisible, setIsTvOsdVisible] = useState(true);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(() =>
    effectiveTvFullMode
      ? false
      : typeof window !== 'undefined'
        ? window.innerWidth >= 1024
        : true
  );
  const [sidePanelTab, setSidePanelTab] = useState<'channels' | 'archive'>(
    'channels'
  );
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(
    () => !effectiveTvFullMode
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
    if (effectiveTvFullMode) {
      setIsSidePanelOpen(false);
      setIsInfoPanelOpen(false);
      setIsOsdOverlayOpen(false);
      wakeTvOsd();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTvChannel?.id, currentTvChannel?.archiveProgram, effectiveTvFullMode]);

  useEffect(() => {
    if (!currentTvChannel) return;
    const onBackEvent = () => {
      if (isOnlineSubFinderOpen) {
        setIsOnlineSubFinderOpen(false);
        return;
      }
      if (isOsdOverlayOpen) {
        osdClosedAtRef.current = Date.now();
        setIsOsdOverlayOpen(false);
        return;
      }
      if (isSidePanelOpen) {
        setIsSidePanelOpen(false);
        return;
      }
      if (isInfoPanelOpen) {
        setIsInfoPanelOpen(false);
        return;
      }
      if (isTvOsdVisible) {
        if (osdTimerRef.current) {
          window.clearTimeout(osdTimerRef.current);
          osdTimerRef.current = null;
        }
        setIsTvOsdVisible(false);
        return;
      }
      closeTvPlayer();
    };
    const onWakeEvent = () => {
      wakeTvOsd();
    };
    window.addEventListener('aether:tv-player-back', onBackEvent);
    window.addEventListener('aether:tv-player-wake-osd', onWakeEvent);
    return () => {
      window.removeEventListener('aether:tv-player-back', onBackEvent);
      window.removeEventListener('aether:tv-player-wake-osd', onWakeEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentTvChannel,
    isTvOsdVisible,
    isOnlineSubFinderOpen,
    isOsdOverlayOpen,
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

      // ArrowRight or Green Button (404) -> Opens Smart IPTV EPG & Catchup Archive Window (Photo 3)
      if (e.key === 'ArrowRight' || e.keyCode === 404) {
        e.preventDefault();
        e.stopPropagation();
        setOsdViewMode('epg');
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
            v.play().catch(() => {});
            setVideoStatus('playing');
          } else {
            v.pause();
          }
        }
        wakeTvOsd();
        return;
      }
    };

    window.addEventListener('keydown', onTvRemoteKeyDown, true);
    return () => window.removeEventListener('keydown', onTvRemoteKeyDown, true);
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

  useEffect(() => {
    if (!isOpen || effectiveTvFullMode) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeTvPlayer();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, effectiveTvFullMode, closeTvPlayer]);

  // Attach HLS stream whenever currentTvChannel, streamIndex, or reloadCount changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentTvChannel) return;

    let cancelled = false;
    setVideoStatus('loading');

    const cleanupHls = () => {
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
        if (!cancelled) setVideoStatus('playing');
      } catch {
        // Browser blocked unmuted autoplay — fallback to muted autoplay so video starts immediately
        if (cancelled) return;
        try {
          video.muted = true;
          setIsAutoMuted(true);
          await video.play();
          if (!cancelled) setVideoStatus('playing');
        } catch {
          // User can click play on native controls
          if (!cancelled) setVideoStatus('playing');
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
            enableWorker: !effectiveTvFullMode,
            lowLatencyMode: false,
            backBufferLength: 30,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            manifestLoadingTimeOut: 15000,
            manifestLoadingMaxRetry: 3,
            levelLoadingTimeOut: 15000,
            fragLoadingTimeOut: 20000,
          });
          hlsRef.current = hls;

          const syncTracks = () => {
            if (cancelled) return;
            const aTracks = (hls.audioTracks || []).map((trk, idx) => ({
              id: idx,
              name: trk.name || trk.lang || `Audio ${idx + 1}`,
              lang: trk.lang,
            }));
            setAudioTracks(aTracks);
            if (hls.audioTrack >= 0) {
              setActiveAudioTrack(hls.audioTrack);
            }

            const sTracks = (hls.subtitleTracks || []).map((trk, idx) => ({
              id: idx,
              name: trk.name || trk.lang || `Subtitrare ${idx + 1}`,
              lang: trk.lang,
            }));
            setSubtitleTracks(sTracks);
            setActiveSubtitleTrack(hls.subtitleTrack);
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
  }, [
    currentTvChannel,
    candidateStreams,
    streamIndex,
    reloadCount,
    effectiveTvFullMode,
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
    const container = videoContainerRef.current;
    const video = videoRef.current as
      | (HTMLVideoElement & {
          webkitEnterFullscreen?: () => void;
          webkitExitFullscreen?: () => void;
          webkitDisplayingFullscreen?: boolean;
        })
      | null;
    if (!video) return;

    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };

    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      if (doc.exitFullscreen) {
        void doc.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        void doc.webkitExitFullscreen();
      }
      return;
    }

    if (video.webkitDisplayingFullscreen && video.webkitExitFullscreen) {
      video.webkitExitFullscreen();
      return;
    }

    // On iOS / iPhone Safari, container.requestFullscreen is not supported on divs; use video.webkitEnterFullscreen() directly
    const isIos =
      typeof navigator !== 'undefined' &&
      /iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isIos && typeof video.webkitEnterFullscreen === 'function') {
      try {
        video.webkitEnterFullscreen();
        return;
      } catch {
        // fallback below
      }
    }

    if (container && typeof container.requestFullscreen === 'function') {
      container.requestFullscreen().catch(() => {
        if (typeof video.requestFullscreen === 'function') {
          void video.requestFullscreen().catch(() => {
            video.webkitEnterFullscreen?.();
          });
        } else {
          video.webkitEnterFullscreen?.();
        }
      });
    } else if (typeof video.requestFullscreen === 'function') {
      video.requestFullscreen().catch(() => {
        video.webkitEnterFullscreen?.();
      });
    } else if (typeof video.webkitEnterFullscreen === 'function') {
      video.webkitEnterFullscreen();
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

  const showSideColumn = isSidePanelOpen && !isOsdOverlayOpen;

  return (
    <div
      id="aether-tv-player-modal"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
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
        if (e.target === dialogRef.current && !effectiveTvFullMode) {
          closeTvPlayer();
        }
      }}
      className={
        effectiveTvFullMode
          ? 'fixed inset-0 z-[190] m-0 w-screen h-screen max-w-none max-h-none rounded-none bg-black text-zinc-100 border-0 shadow-2xl p-0 overflow-hidden'
          : 'fixed inset-0 z-[190] bg-slate-950/85 backdrop-blur-md flex items-start sm:items-center justify-center p-1 sm:p-3 overflow-y-auto'
      }
    >
      <div
        className={
          effectiveTvFullMode
            ? 'relative flex flex-col w-screen h-screen overflow-hidden bg-black'
            : 'mx-auto mt-10 mb-auto sm:my-auto w-[98vw] sm:w-[96vw] max-w-[1440px] rounded-2xl sm:rounded-3xl bg-zinc-950 text-zinc-100 border border-zinc-800 shadow-2xl flex flex-col max-h-[calc(100dvh-3rem)] sm:max-h-[94vh] overflow-hidden'
        }
      >
        {/* Top bar — Normal Web Mode only (Smart TV Full Mode uses authentic Smart IPTV Bottom Info Banner & OK Channel List OSD) */}
        {!effectiveTvFullMode && (
          <div className="shrink-0 flex items-center justify-between gap-2 px-3 sm:px-5 py-2 sm:py-3 bg-zinc-900/95 border-b border-zinc-800">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <StationAvatar
                name={currentTvChannel.name}
                favicon={effectiveLogo}
                size="sm"
                isPlaying={videoStatus === 'playing'}
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
                  {epg?.now?.title && (
                    <>
                      <span>•</span>
                      <span className="text-amber-300 font-semibold truncate">
                        {epg.now.title}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {candidateStreams.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setStreamIndex((prev) => (prev + 1) % candidateStreams.length)
                  }
                  title="Schimbă sursa streamului (Backup)"
                  className="min-h-[36px] px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-all focus:outline-none focus:ring-4 focus:ring-white focus:bg-amber-500 focus:text-zinc-950"
                >
                  <Layers className="w-3.5 h-3.5 text-brand-400" aria-hidden="true" />
                  <span>
                    Sursa {streamIndex + 1}/{candidateStreams.length}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => toggleFavoriteTvChannel(currentTvChannel)}
                aria-pressed={isFavorite}
                aria-label={format(
                  isFavorite ? t.favorites.removeFav : t.favorites.addFav,
                  { name: currentTvChannel.name }
                )}
                className={`min-w-[38px] min-h-[38px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center rounded-full transition-all focus:outline-none focus:ring-4 focus:ring-white ${
                  isFavorite
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
                onClick={closeTvPlayer}
                aria-label={t.tv.closeTvPlayer}
                className="min-w-[38px] min-h-[38px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center rounded-full text-zinc-200 bg-zinc-800/90 hover:text-white hover:bg-rose-600 transition-all focus:outline-none focus:ring-4 focus:ring-white focus:bg-rose-600"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* Active Catch-up / TV Archive Playback Banner */}
        {activeArchiveProg && (
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

        {/* SMART BODY: Flex-col on Mobile (so Left Column NEVER gets squished/clipped!) | 12-Col Grid on Desktop */}
        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col lg:grid lg:grid-cols-12">
          {/* LEFT COLUMN: 16:9 Video Player + Controls + EPG Now/Next (shrink-0 on mobile so it is ALWAYS 100% visible!) */}
          <div
            className={`${
              showSideColumn
                ? 'lg:col-span-7 xl:col-span-7'
                : 'lg:col-span-12'
            } flex flex-col flex-1 shrink-0 lg:shrink lg:min-h-0 lg:overflow-y-auto bg-zinc-950`}
          >
            {/* Video Area (Full height in TV Full Mode, or 16:9 when side/EPG panels are open) */}
            <div
              ref={videoContainerRef}
              className={`group/video relative w-full bg-black flex items-center justify-center overflow-hidden ${
                effectiveTvFullMode && !showSideColumn && !isInfoPanelOpen
                  ? 'flex-1 min-h-0'
                  : 'aspect-video shrink-0'
              }`}
            >
              <video
                ref={videoRef}
                controls={!effectiveTvFullMode}
                playsInline
                autoPlay
                onClick={() => {
                  if (effectiveTvFullMode) {
                    setOsdViewMode('channels');
                    setIsOsdOverlayOpen(true);
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

              {/* Unmute banner if browser forced muted autoplay */}
              {isAutoMuted && videoStatus === 'playing' && (
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

              {/* Smart IPTV Bottom Info Banner (Exact match to Photo 2: Channel No + Name | Current & Next EPG + Mins | Clock + Logo + Resolution) */}
              {effectiveTvFullMode && isTvOsdVisible && !isOsdOverlayOpen && (
                <div
                  onClick={() => {
                    if (Date.now() - osdClosedAtRef.current < 320) return;
                    setOsdViewMode('channels');
                    setIsOsdOverlayOpen(true);
                  }}
                  style={{
                    backgroundColor: 'rgba(10, 14, 22, 0.94)',
                    border: '2px solid #7dd3fc',
                  }}
                  className="absolute bottom-5 inset-x-6 z-30 bg-black/95 shadow-2xl overflow-hidden cursor-pointer select-none"
                >
                  {/* Top Edge Full-Width EPG Progress Line */}
                  <div className="w-full h-1 bg-white/15 overflow-hidden">
                    <div
                      className="h-full bg-[#38bdf8]"
                      style={{
                        width: `${epg?.now ? epgStats.progress : 100}%`,
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
                            width: '64px',
                            textAlign: 'right',
                            fontSize: '16px',
                            color: '#e4e4e7',
                            whiteSpace: 'nowrap',
                            verticalAlign: 'middle',
                          }}
                        >
                          {epg?.now && !activeArchiveProg
                            ? `+${epgStats.remainingMin}`
                            : ''}
                        </span>
                      </div>

                      {/* Row 2: Next Programme */}
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
                          {epg?.upcoming?.[0]
                            ? `${formatEpgTime(epg.upcoming[0].start)} - ${formatEpgTime(epg.upcoming[0].stop)}`
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
                          {epg?.upcoming?.[0]?.title || ''}
                        </span>
                        <span
                          style={{
                            display: 'table-cell',
                            width: '64px',
                            textAlign: 'right',
                            fontSize: '15px',
                            color: '#a1a1aa',
                            whiteSpace: 'nowrap',
                            verticalAlign: 'middle',
                          }}
                        >
                          {epg?.upcoming?.[0]
                            ? `+${Math.max(1, Math.round((epg.upcoming[0].stop - epg.upcoming[0].start) / 60000))}`
                            : ''}
                        </span>
                      </div>
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
                    className="w-10 h-10 text-brand-400 animate-spin"
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
                      className="min-h-[42px] px-4 py-2 rounded-full bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                    >
                      <Tv className="w-4 h-4" aria-hidden="true" />
                      <span>{t.tv.tryAnotherChannel}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Unified Single-Row Compact Controls Bar — Normal Web Mode only */}
            {!effectiveTvFullMode && (
              <div className="shrink-0 flex items-center justify-between gap-1.5 px-2.5 sm:px-3.5 py-1.5 bg-zinc-900 border-t border-b border-zinc-800 overflow-x-auto no-scrollbar">
                {/* Left Group: Icon Nav + Channels + Archive */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  type="button"
                  onClick={playPreviousTvChannel}
                  aria-label={t.player.prevStation}
                  title={t.player.prevStation}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-800/90 hover:bg-zinc-700 text-zinc-100 inline-flex items-center justify-center shrink-0 transition-all focus:outline-none focus:ring-4 focus:ring-white focus:bg-amber-500 focus:text-zinc-950"
                >
                  <SkipBack className="w-4 h-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={playNextTvChannel}
                  aria-label={t.player.nextStation}
                  title={t.player.nextStation}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-800/90 hover:bg-zinc-700 text-zinc-100 inline-flex items-center justify-center shrink-0 transition-all focus:outline-none focus:ring-4 focus:ring-white focus:bg-amber-500 focus:text-zinc-950"
                >
                  <SkipForward className="w-4 h-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => setReloadCount((c) => c + 1)}
                  aria-label={t.player.retryStream}
                  title={t.player.retryStream}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 inline-flex items-center justify-center shrink-0 transition-all focus:outline-none focus:ring-4 focus:ring-white focus:bg-amber-500 focus:text-zinc-950"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                </button>

                {/* Toggle Channel List / Grid */}
                <button
                  ref={channelGridBtnRef}
                  type="button"
                  onClick={() => {
                    if (effectiveTvFullMode) {
                      setIsOsdOverlayOpen((v) => !v);
                      setIsSidePanelOpen(false);
                      return;
                    }
                    if (isOsdOverlayOpen) {
                      setIsOsdOverlayOpen(false);
                      setIsSidePanelOpen(true);
                      setSidePanelTab('channels');
                    } else if (isSidePanelOpen && sidePanelTab === 'channels') {
                      setIsSidePanelOpen(false);
                    } else {
                      setIsSidePanelOpen(true);
                      setSidePanelTab('channels');
                    }
                  }}
                  aria-pressed={
                    isOsdOverlayOpen ||
                    (showSideColumn && sidePanelTab === 'channels')
                  }
                  title="Deschide / închide grila de canale"
                  className={`h-9 sm:h-10 px-3.5 sm:px-4 rounded-full text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 shrink-0 transition-all border focus:outline-none focus:ring-4 focus:ring-white ${
                    isOsdOverlayOpen ||
                    (showSideColumn && sidePanelTab === 'channels') ||
                    effectiveTvFullMode
                      ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 border-amber-400 shadow-lg'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                  }`}
                >
                  <Tv className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Grilă Canale ({tvQueue.length || 1})</span>
                </button>

                {/* Toggle 7-Day TV Archive */}
                {archiveDays.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOsdOverlayOpen(false);
                      if (isSidePanelOpen && sidePanelTab === 'archive') {
                        setIsSidePanelOpen(false);
                      } else {
                        setIsSidePanelOpen(true);
                        setSidePanelTab('archive');
                      }
                    }}
                    aria-pressed={showSideColumn && sidePanelTab === 'archive'}
                    title={`Deschide / închide Arhiva TV (${archiveDays.length} zile)`}
                    className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors border ${
                      (showSideColumn && sidePanelTab === 'archive') ||
                      activeArchiveProg
                        ? 'bg-blue-500 text-zinc-950 border-blue-400 font-bold'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-blue-300 border-zinc-700'
                    }`}
                  >
                    <History className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Arhivă ({archiveDays.length}z)</span>
                  </button>
                )}
              </div>

              {/* Right Group: Compact Audio + Subtitles + .SRT + PiP + Fullscreen */}
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                {/* Compact Audio Track Selector */}
                <div
                  title="Selectează pista audio"
                  className="h-8 sm:h-9 inline-flex items-center gap-1 px-2.5 rounded-full bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-xs text-zinc-100 shrink-0"
                >
                  <Languages
                    className="w-3.5 h-3.5 text-amber-400 shrink-0"
                    aria-hidden="true"
                  />
                  <select
                    aria-label="Selectează pista audio"
                    value={activeAudioTrack}
                    onChange={(e) =>
                      handleAudioTrackChange(Number(e.target.value))
                    }
                    className="bg-transparent text-zinc-100 text-xs font-semibold outline-none cursor-pointer max-w-[90px] sm:max-w-[115px] truncate"
                  >
                    {audioTracks.length > 0 ? (
                      audioTracks.map((trk, idx) => (
                        <option
                          key={trk.id}
                          value={trk.id}
                          className="bg-zinc-900 text-zinc-100"
                        >
                          {trk.lang
                            ? trk.lang.toUpperCase()
                            : trk.name || `Audio ${idx + 1}`}
                        </option>
                      ))
                    ) : (
                      <option value={0} className="bg-zinc-900 text-zinc-100">
                        Original
                      </option>
                    )}
                  </select>
                </div>

                {/* Compact Subtitle Track Selector */}
                <div
                  title="Selectează subtitrarea sau încarcă un fișier .SRT / .VTT"
                  className="h-8 sm:h-9 inline-flex items-center gap-1 px-2.5 rounded-full bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-xs text-zinc-100 shrink-0"
                >
                  <Subtitles
                    className="w-3.5 h-3.5 text-blue-400 shrink-0"
                    aria-hidden="true"
                  />
                  <select
                    aria-label="Selectează subtitrarea"
                    value={activeSubtitleTrack}
                    onChange={(e) =>
                      handleSubtitleTrackChange(Number(e.target.value))
                    }
                    className="bg-transparent text-zinc-100 text-xs font-semibold outline-none cursor-pointer max-w-[85px] sm:max-w-[115px] truncate"
                  >
                    <option value={-1} className="bg-zinc-900 text-zinc-100">
                      Oprit
                    </option>
                    {subtitleTracks.map((trk) => (
                      <option
                        key={trk.id}
                        value={trk.id}
                        className="bg-zinc-900 text-zinc-100"
                      >
                        {trk.name}
                        {trk.lang ? ` (${trk.lang.toUpperCase()})` : ''}
                      </option>
                    ))}
                    {customSubtitleUrl && (
                      <option value={999} className="bg-zinc-900 text-blue-300">
                        {customSubtitleName || '.SRT'}
                      </option>
                    )}
                    <option value={-98} className="bg-zinc-900 text-blue-300">
                      Caută pe Net (.SRT)...
                    </option>
                    <option value={-99} className="bg-zinc-900 text-amber-300">
                      + .SRT din Dispozitiv...
                    </option>
                  </select>
                </div>

                {/* Search & Download Online Subtitles (OpenSubtitles) */}
                <button
                  type="button"
                  onClick={() => setIsOnlineSubFinderOpen(true)}
                  aria-label="Caută și descarcă subtitrări de pe net (.SRT)"
                  title="Caută și descarcă subtitrări de pe net (OpenSubtitles .SRT)"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 text-blue-400 inline-flex items-center justify-center border border-zinc-700 shrink-0 transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                </button>

                {/* Upload custom .SRT / .VTT subtitle file */}
                <input
                  ref={subFileInputRef}
                  type="file"
                  accept=".srt,.vtt"
                  onChange={(e) => void handleUploadSubtitleFile(e)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => subFileInputRef.current?.click()}
                  aria-label="Încarcă subtitrare (.srt / .vtt)"
                  title={
                    customSubtitleName
                      ? `Subtitrare încărcată: ${customSubtitleName}`
                      : 'Încarcă fișier subtitrare (.srt / .vtt)'
                  }
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 inline-flex items-center justify-center border border-zinc-700 shrink-0 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-brand-400" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={handlePip}
                  aria-label={t.tv.pip}
                  title={t.tv.pip}
                  className="hidden sm:inline-flex w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 items-center justify-center shrink-0 transition-colors"
                >
                  <PictureInPicture2 className="w-4 h-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={handleFullscreen}
                  aria-label={t.tv.fullscreen}
                  title={t.tv.fullscreen}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-brand-600 hover:bg-brand-500 text-white inline-flex items-center justify-center shadow-md shrink-0 transition-colors"
                >
                  <Maximize className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            )}

            {/* Compact Live EPG Program Guide Section (Below Controls) */}
            {isInfoPanelOpen &&
              (epg?.now || (epg?.upcoming && epg.upcoming.length > 0)) && (
                <div className="px-4 py-3 bg-zinc-900/60 space-y-2.5">
                  {epg.now && (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-950/90 border border-blue-700/50 text-blue-300 text-[11px] font-extrabold uppercase tracking-wider shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                            EPG ACUM
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-zinc-200 tabular-nums shrink-0">
                            <Clock
                              className="w-3.5 h-3.5 text-brand-400"
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

                      {epg.now.desc && (
                        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                          {epg.now.desc}
                        </p>
                      )}

                      <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden shadow-inner">
                        <div
                          className="h-full bg-gradient-to-r from-brand-500 to-blue-400 rounded-full transition-all duration-300"
                          style={{ width: `${epgStats.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {epg.upcoming && epg.upcoming.length > 0 && (
                    <div className="pt-2 border-t border-zinc-800/80">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                          <Calendar
                            className="w-3.5 h-3.5 text-brand-400"
                            aria-hidden="true"
                          />
                          <span>Urmează în program</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                        {epg.upcoming.slice(0, 3).map((item, idx) => (
                          <div
                            key={`${item.start}_${idx}`}
                            className="px-2.5 py-1.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col min-w-0"
                          >
                            <span className="text-[11px] font-bold text-brand-400 tabular-nums">
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
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* RIGHT COLUMN: Side-by-Side Channel Switcher OR Multi-Day TV Archive */}
          {showSideColumn && (
            <div className="lg:col-span-5 xl:col-span-5 border-t lg:border-t-0 lg:border-l border-zinc-800 bg-[#0b111e] flex flex-col shrink-0 lg:shrink min-h-[280px] max-h-[52vh] lg:min-h-0 lg:max-h-none overflow-hidden">
              {/* Tab 1: Clean Channel List */}
              {sidePanelTab === 'channels' ? (
                <div className="flex-1 min-h-0 p-2 sm:p-2.5 flex flex-col overflow-hidden">
                  <TvOsdChannelList
                    currentChannel={currentTvChannel}
                    channels={tvQueue}
                    isOverlayMode={false}
                    onToggleOverlayMode={() => setIsOsdOverlayOpen(true)}
                    onToggleInfoPanel={() => setIsInfoPanelOpen((v) => !v)}
                    isInfoPanelOpen={isInfoPanelOpen}
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
                            className={`min-h-[32px] px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                              isSelected
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
                          className={`py-2 px-2.5 rounded-xl flex items-center justify-between gap-2 transition-colors ${
                            isSelectedArchive
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
                              }}
                              className={`min-h-[30px] px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 shrink-0 transition-colors ${
                                isSelectedArchive
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
