import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  Languages,
  Loader2,
  AlertCircle,
  SlidersHorizontal,
} from 'lucide-react';
import {
  OfflineMediaItem,
  createOfflineAwareHlsLoader,
  getBlobChunk,
} from '../../services/offlineMediaService';

interface VodNativeHlsPlayerProps {
  hlsUrl?: string;
  offlineItem?: OfflineMediaItem | null;
  audioTrackLabels?: string[];
  startAtSeconds?: number;
  poster?: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onStreamError?: () => void;
}

export const VodNativeHlsPlayer: React.FC<VodNativeHlsPlayerProps> = ({
  hlsUrl,
  offlineItem,
  audioTrackLabels = [],
  startAtSeconds = 0,
  poster,
  onTimeUpdate,
  onStreamError,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const appliedStartRef = useRef<boolean>(false);

  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>(
    'loading'
  );
  const [audioTracks, setAudioTracks] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [activeAudioTrack, setActiveAudioTrack] = useState<number>(0);
  const [qualityLevels, setQualityLevels] = useState<
    Array<{ index: number; height: number }>
  >([]);
  const [activeQuality, setActiveQuality] = useState<number>(-1);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    appliedStartRef.current = false;
    setStatus('loading');
    setAudioTracks([]);
    setQualityLevels([]);
    setActiveQuality(-1);

    let objectUrlToRevoke: string | null = null;
    let cancelled = false;

    const cleanup = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
        objectUrlToRevoke = null;
      }
    };

    const applyInitialSeek = () => {
      if (
        !appliedStartRef.current &&
        startAtSeconds > 5 &&
        video &&
        Number.isFinite(video.duration) &&
        startAtSeconds < video.duration - 15
      ) {
        appliedStartRef.current = true;
        video.currentTime = startAtSeconds;
      }
    };

    const init = async () => {
      cleanup();

      // Case 1: Offline Blob file (.mp4 / .mkv / .webm)
      if (offlineItem && offlineItem.mediaType === 'blob') {
        const chunk = await getBlobChunk(`${offlineItem.id}::file`);
        if (cancelled) return;
        if (!chunk) {
          setStatus('error');
          return;
        }
        const blob =
          chunk instanceof Blob
            ? chunk
            : new Blob([chunk], { type: offlineItem.mimeType || 'video/mp4' });
        objectUrlToRevoke = URL.createObjectURL(blob);
        video.src = objectUrlToRevoke;
        video.onloadedmetadata = () => {
          applyInitialSeek();
          void video.play().catch(() => {});
          setStatus('playing');
        };
        return;
      }

      // Case 2: Offline HLS item or Live/Online HLS URL
      const targetUrl = offlineItem
        ? `https://offline.local/${encodeURIComponent(offlineItem.id)}/master.m3u8`
        : hlsUrl || '';

      if (!targetUrl) {
        setStatus('error');
        return;
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
          loader: createOfflineAwareHlsLoader(),
          enableWorker: true,
          startPosition: startAtSeconds > 5 ? startAtSeconds : -1,
          maxBufferLength: 45,
          maxMaxBufferLength: 90,
        });
        hlsRef.current = hls;

        hls.loadSource(targetUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (_ev, data) => {
          if (cancelled) return;
          appliedStartRef.current = true;

          // Populate quality levels
          const uniqueLevels: Array<{ index: number; height: number }> = [];
          const seenHeights = new Set<number>();
          data.levels.forEach((lvl, idx) => {
            if (lvl.height && !seenHeights.has(lvl.height)) {
              seenHeights.add(lvl.height);
              uniqueLevels.push({ index: idx, height: lvl.height });
            }
          });
          setQualityLevels(uniqueLevels.sort((a, b) => b.height - a.height));

          void video.play().catch(() => {});
          setStatus('playing');
        });

        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_ev, data) => {
          if (cancelled) return;
          const nonFailover = data.audioTracks.filter(
            (t) => !t.groupId?.startsWith('failover-')
          );
          const list = (nonFailover.length > 0 ? nonFailover : data.audioTracks).map(
            (trk, idx) => ({
              id: trk.id,
              name:
                audioTrackLabels[idx] ||
                (trk.name && trk.name !== 'default'
                  ? trk.name
                  : `Pista Audio ${idx + 1} (${(trk.lang || 'RU').toUpperCase()})`),
            })
          );
          setAudioTracks(list);
          setActiveAudioTrack(hls.audioTrack >= 0 ? hls.audioTrack : 0);
        });

        hls.on(Hls.Events.ERROR, (_ev, data) => {
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            } else {
              setStatus('error');
              onStreamError?.();
            }
          }
        });
      } else if (
        !offlineItem &&
        video.canPlayType('application/vnd.apple.mpegurl')
      ) {
        video.src = targetUrl;
        video.onloadedmetadata = () => {
          applyInitialSeek();
          void video.play().catch(() => {});
          setStatus('playing');
        };
      } else {
        setStatus('error');
      }
    };

    void init();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [hlsUrl, offlineItem?.id]);

  return (
    <div className="relative w-full h-full bg-black flex flex-col">
      <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          controls
          playsInline
          autoPlay
          poster={poster}
          onPlaying={() => setStatus('playing')}
          onTimeUpdate={(e) => {
            const vid = e.currentTarget;
            if (vid.currentTime > 1 && Number.isFinite(vid.duration)) {
              onTimeUpdate?.(
                Math.floor(vid.currentTime),
                Math.floor(vid.duration)
              );
            }
          }}
          className="w-full h-full object-contain bg-black"
        />

        {status === 'loading' && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-2 bg-black/60">
            <Loader2 className="w-9 h-9 text-brand-400 animate-spin" />
            <span className="text-xs font-semibold text-zinc-200">
              {offlineItem
                ? 'Se încarcă filmul din memoria Offline a dispozitivului...'
                : 'Se încarcă streamul direct HLS (Fără reclame)...'}
            </span>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center bg-zinc-950/90">
            <AlertCircle className="w-8 h-8 text-rose-400" />
            <p className="text-xs sm:text-sm font-semibold text-zinc-200">
              Acest titlu nu are stream direct pe acest server. Selectează Server 2, 3 sau 4 din bara de sus!
            </p>
          </div>
        )}

        {/* Floating Audio & Quality Selector Overlay (Top-Right of Video) */}
        {(audioTracks.length > 1 || qualityLevels.length > 1) && (
          <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
            {audioTracks.length > 1 && (
              <div className="h-7 px-2.5 rounded-full bg-zinc-900/90 border border-zinc-700 text-[11px] text-zinc-100 inline-flex items-center gap-1 backdrop-blur-xs">
                <Languages className="w-3 h-3 text-amber-400 shrink-0" />
                <select
                  aria-label="Pista audio"
                  value={activeAudioTrack}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setActiveAudioTrack(id);
                    if (hlsRef.current) {
                      hlsRef.current.audioTrack = id;
                    }
                  }}
                  className="bg-transparent text-zinc-100 font-semibold outline-none cursor-pointer max-w-[130px] truncate"
                >
                  {audioTracks.map((trk) => (
                    <option
                      key={trk.id}
                      value={trk.id}
                      className="bg-zinc-900 text-zinc-100"
                    >
                      {trk.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {qualityLevels.length > 1 && (
              <div className="h-7 px-2.5 rounded-full bg-zinc-900/90 border border-zinc-700 text-[11px] text-zinc-100 inline-flex items-center gap-1 backdrop-blur-xs">
                <SlidersHorizontal className="w-3 h-3 text-emerald-400 shrink-0" />
                <select
                  aria-label="Calitate video"
                  value={activeQuality}
                  onChange={(e) => {
                    const lvl = Number(e.target.value);
                    setActiveQuality(lvl);
                    if (hlsRef.current) {
                      hlsRef.current.currentLevel = lvl;
                    }
                  }}
                  className="bg-transparent text-zinc-100 font-semibold outline-none cursor-pointer"
                >
                  <option value={-1} className="bg-zinc-900 text-zinc-100">
                    Auto HD
                  </option>
                  {qualityLevels.map((q) => (
                    <option
                      key={q.index}
                      value={q.index}
                      className="bg-zinc-900 text-zinc-100"
                    >
                      {q.height}p
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

