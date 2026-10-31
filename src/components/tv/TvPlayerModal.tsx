import React, { useEffect, useMemo, useRef, useState } from 'react';
import type Hls from 'hls.js';
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
} from 'lucide-react';
import { EpgProgramme, TvChannel } from '../../types/radio';
import { useRadioStore } from '../../store/useRadioStore';
import { StationAvatar } from '../common/StationAvatar';
import { TvOsdChannelList } from './TvOsdChannelList';
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

export const TvPlayerModal: React.FC = () => {
  const { t, language, format } = useTranslation();

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

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const subFileInputRef = useRef<HTMLInputElement | null>(null);

  const [videoStatus, setVideoStatus] = useState<
    'loading' | 'playing' | 'error'
  >('loading');
  const [reloadCount, setReloadCount] = useState(0);
  const [streamIndex, setStreamIndex] = useState(0);
  const [isOsdOverlayOpen, setIsOsdOverlayOpen] = useState(false);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [sidePanelTab, setSidePanelTab] = useState<'channels' | 'archive'>(
    'channels'
  );
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(true);

  const [audioTracks, setAudioTracks] = useState<HlsTrackItem[]>([]);
  const [activeAudioTrack, setActiveAudioTrack] = useState<number>(0);
  const [subtitleTracks, setSubtitleTracks] = useState<HlsTrackItem[]>([]);
  const [activeSubtitleTrack, setActiveSubtitleTrack] = useState<number>(-1);
  const [customSubtitleUrl, setCustomSubtitleUrl] = useState<string | null>(
    null
  );
  const [customSubtitleName, setCustomSubtitleName] = useState<string>('');

  const isOpen = Boolean(currentTvChannel);

  useEffect(() => {
    setStreamIndex(0);
    setAudioTracks([]);
    setActiveAudioTrack(0);
    setSubtitleTracks([]);
    setActiveSubtitleTrack(-1);
    setActiveArchiveProg(currentTvChannel?.archiveProgram || null);
  }, [currentTvChannel?.id, currentTvChannel?.archiveProgram]);

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
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        // ignore if already open
      }
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen, currentTvChannel]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      closeTvPlayer();
    };

    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [isOpen, currentTvChannel, closeTvPlayer]);

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
        await video.play();
        if (!cancelled) setVideoStatus('playing');
      } catch {
        // Browser blocked unmuted autoplay — fallback to muted autoplay so video starts immediately
        if (cancelled) return;
        try {
          video.muted = true;
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

        const HlsModule = await import('hls.js');
        const HlsClass = HlsModule.default;

        if (cancelled) return;

        if (HlsClass.isSupported()) {
          let triedDirectFallback = false;
          let mediaRecoveryCount = 0;

          const hls = new HlsClass({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 30,
            manifestLoadingTimeOut: 12000,
            manifestLoadingMaxRetry: 2,
            levelLoadingTimeOut: 12000,
            fragLoadingTimeOut: 15000,
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

          hls.on(HlsClass.Events.MEDIA_ATTACHED, () => {
            if (cancelled) return;
            // Use local Vite CORS/Referer proxy first so streams like Digi 24 work without CORS blocks
            hls.loadSource(proxiedUrl);
          });

          hls.on(HlsClass.Events.MANIFEST_PARSED, () => {
            if (cancelled) return;
            syncTracks();
            void safeAutoPlay();
          });

          hls.on(HlsClass.Events.AUDIO_TRACKS_UPDATED, syncTracks);
          hls.on(HlsClass.Events.SUBTITLE_TRACKS_UPDATED, syncTracks);

          hls.on(HlsClass.Events.ERROR, (_event, data) => {
            if (cancelled) return;
            if (data.fatal) {
              if (
                data.type === HlsClass.ErrorTypes.NETWORK_ERROR &&
                !triedDirectFallback
              ) {
                triedDirectFallback = true;
                hls.loadSource(directUrl);
                return;
              }
              if (
                data.type === HlsClass.ErrorTypes.MEDIA_ERROR &&
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

        // Native HLS fallback (iOS Safari)
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
  }, [currentTvChannel, candidateStreams, streamIndex, reloadCount]);

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
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-label={currentTvChannel.name}
      onClose={closeTvPlayer}
      onCancel={closeTvPlayer}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          closeTvPlayer();
        }
      }}
      className="mx-auto mt-[max(0.5rem,env(safe-area-inset-top,0px))] mb-auto sm:my-auto w-[98vw] sm:w-[96vw] max-w-[1440px] rounded-2xl sm:rounded-3xl bg-zinc-950 text-zinc-100 border border-zinc-800 shadow-2xl p-0 overflow-hidden backdrop:bg-slate-950/85 backdrop:backdrop-blur-md"
    >
      <div className="flex flex-col max-h-[calc(100dvh-max(1rem,env(safe-area-inset-top,0px)))] sm:max-h-[94vh] overflow-hidden">
        {/* Top bar (Always pinned at top, shrink-0) */}
        <div className="shrink-0 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 px-3 sm:px-6 py-2 sm:py-3 bg-zinc-900/95 border-b border-zinc-800">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
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
                <p className="text-[11px] sm:text-xs text-zinc-400 flex items-center gap-1.5 truncate">
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
                </p>
              </div>
            </div>

            {/* Mobile Favorite + Close buttons (always pinned top-right on mobile) */}
            <div className="flex lg:hidden items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => toggleFavoriteTvChannel(currentTvChannel)}
                aria-pressed={isFavorite}
                aria-label={format(
                  isFavorite ? t.favorites.removeFav : t.favorites.addFav,
                  { name: currentTvChannel.name }
                )}
                className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full transition-colors ${
                  isFavorite
                    ? 'text-rose-400 bg-rose-950/50 hover:bg-rose-950/80'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <Heart
                  aria-hidden="true"
                  className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`}
                />
              </button>

              <button
                type="button"
                onClick={closeTvPlayer}
                aria-label={t.tv.closeTvPlayer}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full text-zinc-300 bg-zinc-800/80 hover:text-white hover:bg-zinc-700 transition-colors"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {/* Button 1: Toggle Translucent Smart TV OSD directly OVER Video (Desktop / Tablet) */}
            <button
              type="button"
              onClick={() => setIsOsdOverlayOpen((v) => !v)}
              aria-pressed={isOsdOverlayOpen}
              title="Afișează OSD-ul transparent direct peste video (stil Smart IPTV)"
              className={`hidden sm:inline-flex min-h-[34px] sm:min-h-[38px] px-3 py-1 rounded-full text-xs font-semibold items-center gap-1.5 shrink-0 transition-colors border ${
                isOsdOverlayOpen
                  ? 'bg-amber-500 text-zinc-950 border-amber-400 font-bold'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-amber-300 border-zinc-700'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" aria-hidden="true" />
              <span>OSD pe Video</span>
            </button>

            {/* Button 2: Toggle Channel List (Canale) */}
            <button
              type="button"
              onClick={() => {
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
              aria-pressed={showSideColumn && sidePanelTab === 'channels'}
              title="Afișează / ascunde lista de canale"
              className={`min-h-[32px] sm:min-h-[38px] px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors border ${
                showSideColumn && sidePanelTab === 'channels'
                  ? 'bg-brand-600 text-white border-brand-500 font-bold'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
              }`}
            >
              <Tv className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Canale ({tvQueue.length || 1})</span>
            </button>

            {/* Button 3: 7-Day TV Archive / Catch-up */}
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
                title="Arhivă TV pe ultimele 7 zile (Catch-up / Timeshift)"
                className={`min-h-[32px] sm:min-h-[38px] px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors border ${
                  (showSideColumn && sidePanelTab === 'archive') ||
                  activeArchiveProg
                    ? 'bg-emerald-500 text-zinc-950 border-emerald-400 font-bold'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-emerald-300 border-zinc-700'
                }`}
              >
                <History className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Arhivă {archiveDays.length} Zile</span>
              </button>
            )}

            {candidateStreams.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setStreamIndex((prev) => (prev + 1) % candidateStreams.length)
                }
                title="Schimbă sursa streamului (Backup)"
                className="min-h-[32px] sm:min-h-[38px] px-2.5 sm:px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors"
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
              className={`hidden lg:flex min-w-[40px] min-h-[40px] items-center justify-center rounded-full transition-colors ${
                isFavorite
                  ? 'text-rose-400 bg-rose-950/50 hover:bg-rose-950/80'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Heart
                aria-hidden="true"
                className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`}
              />
            </button>

            <button
              type="button"
              onClick={closeTvPlayer}
              aria-label={t.tv.closeTvPlayer}
              className="hidden lg:flex min-w-[40px] min-h-[40px] items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Active Catch-up / TV Archive Playback Banner */}
        {activeArchiveProg && (
          <div className="shrink-0 px-3 sm:px-6 py-2 bg-amber-950/90 border-b border-amber-600/60 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-zinc-950 text-[11px] font-extrabold uppercase tracking-wider shrink-0">
                ⏪ ARHIVĂ TV (CATCH-UP)
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
            } flex flex-col shrink-0 lg:shrink lg:min-h-0 lg:overflow-y-auto bg-zinc-950`}
          >
            {/* 16:9 Video Area (shrink-0 guarantees the video NEVER gets squished!) */}
            <div
              ref={videoContainerRef}
              className="group/video relative aspect-video w-full shrink-0 bg-black flex items-center justify-center overflow-hidden"
            >
              <video
                ref={videoRef}
                controls
                playsInline
                autoPlay
                crossOrigin="anonymous"
                onPlaying={() => setVideoStatus('playing')}
                onLoadedData={() => setVideoStatus('playing')}
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

              {/* Quick Floating OSD Channel List Trigger (desktop / tablet hover) */}
              {!isOsdOverlayOpen && (
                <button
                  type="button"
                  onClick={() => setIsOsdOverlayOpen(true)}
                  className="hidden sm:inline-flex absolute top-2.5 left-2.5 z-10 px-3 py-1.5 rounded-full bg-zinc-950/85 hover:bg-zinc-900/95 border border-slate-400/70 text-xs font-bold text-amber-300 items-center gap-1.5 shadow-lg opacity-90 hover:opacity-100 transition-opacity"
                >
                  <ListFilter className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>☰ Canale ({tvQueue.length || 1})</span>
                </button>
              )}

              {/* Floating Smart TV OSD Channel List Overlay (directly over the 16:9 video / fullscreen) */}
              {isOsdOverlayOpen && (
                <div
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      setIsOsdOverlayOpen(false);
                    }
                  }}
                  className="absolute inset-0 z-20 bg-black/25 flex items-center justify-center p-2 sm:p-4 overflow-hidden"
                >
                  <div className="w-full max-w-4xl max-h-full flex flex-col justify-center">
                    <TvOsdChannelList
                      currentChannel={currentTvChannel}
                      channels={tvQueue}
                      isOverlayMode
                      onToggleOverlayMode={() => {
                        setIsOsdOverlayOpen(false);
                        setIsSidePanelOpen(true);
                        setSidePanelTab('channels');
                      }}
                      onCloseOverlay={() => setIsOsdOverlayOpen(false)}
                      onToggleInfoPanel={() => setIsInfoPanelOpen((v) => !v)}
                      isInfoPanelOpen={isInfoPanelOpen}
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

            {/* Controls Bar (Immediately below the 16:9 video, shrink-0) */}
            <div className="shrink-0 flex flex-col gap-1.5 px-3 sm:px-4 py-2 bg-zinc-900 border-t border-b border-zinc-800">
              {/* Row 1: Primary Transport (Prev / Next / Retry) + PiP & FULLSCREEN (always on row 1!) */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={playPreviousTvChannel}
                    aria-label={t.player.prevStation}
                    className="min-h-[34px] sm:min-h-[38px] px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                  >
                    <SkipBack className="w-4 h-4" aria-hidden="true" />
                    <span className="hidden sm:inline">{t.player.prevStation}</span>
                  </button>

                  <button
                    type="button"
                    onClick={playNextTvChannel}
                    aria-label={t.player.nextStation}
                    className="min-h-[34px] sm:min-h-[38px] px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span className="hidden sm:inline">{t.player.nextStation}</span>
                    <SkipForward className="w-4 h-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setReloadCount((c) => c + 1)}
                    aria-label={t.player.retryStream}
                    className="min-h-[34px] sm:min-h-[38px] px-2.5 sm:px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">{t.player.retryStream}</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handlePip}
                    aria-label={t.tv.pip}
                    className="hidden sm:inline-flex min-h-[38px] px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium items-center gap-1.5 transition-colors"
                  >
                    <PictureInPicture2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>PiP</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFullscreen}
                    aria-label={t.tv.fullscreen}
                    className="min-h-[34px] sm:min-h-[38px] px-3.5 sm:px-4 py-1 rounded-full bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md transition-colors"
                  >
                    <Maximize className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
                    <span>{t.tv.fullscreen}</span>
                  </button>
                </div>
              </div>

              {/* Row 2: Compact Side-by-Side Audio & Subtitle Selectors */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5">
                {/* ALWAYS-VISIBLE Audio Track Selector */}
                <div
                  title="Selectează pista audio (dacă streamul transmite mai multe limbi audio)"
                  className="min-h-[32px] sm:min-h-[36px] inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-xs text-zinc-100 min-w-0"
                >
                  <Languages
                    className="w-3.5 h-3.5 text-amber-400 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <span className="text-zinc-400 font-semibold hidden md:inline">
                    Audio:
                  </span>
                  <select
                    aria-label="Selectează pista audio"
                    value={activeAudioTrack}
                    onChange={(e) =>
                      handleAudioTrackChange(Number(e.target.value))
                    }
                    className="bg-transparent text-zinc-100 text-xs font-semibold outline-none cursor-pointer w-full sm:w-auto sm:max-w-[150px] truncate"
                  >
                    {audioTracks.length > 0 ? (
                      audioTracks.map((trk, idx) => (
                        <option
                          key={trk.id}
                          value={trk.id}
                          className="bg-zinc-900 text-zinc-100"
                        >
                          Pista {idx + 1}: {trk.name}
                          {trk.lang ? ` (${trk.lang.toUpperCase()})` : ''}
                        </option>
                      ))
                    ) : (
                      <option value={0} className="bg-zinc-900 text-zinc-100">
                        Audio: Original
                      </option>
                    )}
                  </select>
                </div>

                {/* ALWAYS-VISIBLE Subtitle Track Selector + .SRT Upload */}
                <div
                  title="Selectează subtitrarea din stream sau încarcă un fișier .SRT / .VTT"
                  className="min-h-[32px] sm:min-h-[36px] inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-xs text-zinc-100 min-w-0"
                >
                  <Subtitles
                    className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <span className="text-zinc-400 font-semibold hidden md:inline">
                    Subtitrări:
                  </span>
                  <select
                    aria-label="Selectează subtitrarea"
                    value={activeSubtitleTrack}
                    onChange={(e) =>
                      handleSubtitleTrackChange(Number(e.target.value))
                    }
                    className="bg-transparent text-zinc-100 text-xs font-semibold outline-none cursor-pointer w-full sm:w-auto sm:max-w-[165px] truncate"
                  >
                    <option value={-1} className="bg-zinc-900 text-zinc-100">
                      Subtitrări: Oprit
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
                      <option value={999} className="bg-zinc-900 text-emerald-300">
                        📄 {customSubtitleName || 'Subtitrare .SRT'}
                      </option>
                    )}
                    <option value={-99} className="bg-zinc-900 text-amber-300">
                      📂 + Încarcă .SRT / .VTT...
                    </option>
                  </select>
                </div>

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
                  title="Încarcă fișier subtitrare (.srt / .vtt) de pe dispozitiv"
                  className="hidden sm:inline-flex min-h-[36px] px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold items-center gap-1.5 border border-zinc-700 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-brand-400" aria-hidden="true" />
                  <span>
                    {customSubtitleName ? `Sub: ${customSubtitleName}` : '+ .SRT'}
                  </span>
                </button>
              </div>
            </div>

            {/* Compact Live EPG Program Guide Section (Below Controls) */}
            {isInfoPanelOpen &&
              (epg?.now || (epg?.upcoming && epg.upcoming.length > 0)) && (
                <div className="px-4 py-3 bg-zinc-900/60 space-y-2.5">
                  {epg.now && (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-700/50 text-emerald-300 text-[11px] font-extrabold uppercase tracking-wider shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
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
                        <span className="text-xs font-bold text-emerald-400 tabular-nums">
                          ⏳ {epgStats.remainingShort} ({epgStats.progress}%)
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
                          className="h-full bg-gradient-to-r from-brand-500 to-emerald-400 rounded-full transition-all duration-300"
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
                        {archiveDays.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsOsdOverlayOpen(false);
                              setIsSidePanelOpen(true);
                              setSidePanelTab('archive');
                            }}
                            className="min-h-[26px] px-2.5 py-0.5 rounded-full bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                          >
                            <History className="w-3 h-3" aria-hidden="true" />
                            <span>
                              ⏪ Arhivă {archiveDays.length} Zile (
                              {archiveProgrammes.length})
                            </span>
                          </button>
                        )}
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

          {/* RIGHT COLUMN: Side-by-Side Smart IPTV OSD Channel Switcher OR 7-Day TV Archive */}
          {showSideColumn && (
            <div className="lg:col-span-5 xl:col-span-5 border-t lg:border-t-0 lg:border-l border-zinc-800 bg-gradient-to-b from-[#0f172a] to-[#090d16] flex flex-col shrink-0 lg:shrink min-h-[320px] max-h-[55vh] lg:min-h-0 lg:max-h-none overflow-hidden">
              {/* Side Panel Switcher Tabs (Canale OSD vs Arhivă TV) */}
              <div className="shrink-0 flex items-center justify-between gap-2 px-3 pt-2.5 pb-2 bg-zinc-900/90 border-b border-zinc-800">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSidePanelTab('channels')}
                    className={`min-h-[34px] px-3.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                      sidePanelTab === 'channels'
                        ? 'bg-amber-500 text-zinc-950 shadow-xs'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    <ListFilter className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Canale OSD ({tvQueue.length || 1})</span>
                  </button>

                  {archiveDays.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSidePanelTab('archive')}
                      className={`min-h-[34px] px-3.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                        sidePanelTab === 'archive'
                          ? 'bg-emerald-500 text-zinc-950 shadow-xs'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-emerald-300'
                      }`}
                    >
                      <History className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Arhivă ({archiveDays.length} Zile)</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsSidePanelOpen(false)}
                  title="Ascunde panoul lateral (Mod Cinema 100%)"
                  className="min-h-[30px] px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[11px] font-semibold transition-colors"
                >
                  Ascunde ✕
                </button>
              </div>

              {/* Tab 1: Smart IPTV OSD Channel List docked side-by-side */}
              {sidePanelTab === 'channels' ? (
                <div className="flex-1 min-h-0 p-2.5 sm:p-3 overflow-y-auto">
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
                          className="w-4 h-4 text-emerald-400"
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
                                ? 'bg-emerald-500 text-zinc-950 font-bold shadow-xs'
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
                                ? 'bg-emerald-950/40 border border-emerald-700/50'
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
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold shrink-0">
                                  🟢 ACUM
                                </span>
                              ) : isPast ? (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold shrink-0">
                                  ⏪ ARHIVĂ
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
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
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
    </dialog>
  );
};
