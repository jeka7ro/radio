import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Heart,
  Maximize2,
  Music,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  FALLBACK_MUSIC_COVER,
  proxyMusicCover,
  type SpotifyTrackItem,
} from '../tv/spotifyMusicPremiumViews';

interface DocumentPipApi {
  requestWindow?: (options?: {
    width?: number;
    height?: number;
    disallowReturnToOpener?: boolean;
  }) => Promise<Window>;
  window?: Window | null;
}

export interface MusicPipPlayerProps {
  track: SpotifyTrackItem | null;
  isPlaying: boolean;
  elapsedSec: number;
  durationSec: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  isRepeat: boolean;
  isLiked: boolean;
  onTogglePlayPause: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onSeek: (sec: number) => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onToggleLike: () => void;
  onChangeVolume: (vol: number) => void;
  onToggleMute: () => void;
  onRestoreNormalPlayer: () => void;
  queueIndex?: number;
  queueTotal?: number;
  tr: (ro: string, en: string, ru?: string) => string;
}

let externalToggleMusicPip: ((overrideTrack?: SpotifyTrackItem) => Promise<void>) | null = null;

/** Toggle the desktop floating Picture-in-Picture window for the active Music track. */
export async function toggleMusicPip(overrideTrack?: SpotifyTrackItem): Promise<void> {
  if (externalToggleMusicPip) {
    await externalToggleMusicPip(overrideTrack);
  }
}

function fmtPipDuration(secVal: number): string {
  const safe = Math.max(0, Math.floor(secVal || 0));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hrs > 0
    ? `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${mins}:${String(secs).padStart(2, '0')}`;
}

function copyStylesToMusicPipWindow(sourceDoc: Document, targetDoc: Document) {
  if (sourceDoc.documentElement.classList.contains('dark')) {
    targetDoc.documentElement.classList.add('dark');
  } else {
    targetDoc.documentElement.classList.remove('dark');
  }
  const styleNodes = sourceDoc.querySelectorAll('link[rel="stylesheet"], style');
  styleNodes.forEach((node) => {
    targetDoc.head.appendChild(node.cloneNode(true));
  });
  targetDoc.body.style.margin = '0';
  targetDoc.body.style.padding = '0';
  targetDoc.body.style.overflow = 'hidden';
  targetDoc.body.style.userSelect = 'none';
  targetDoc.body.style.backgroundColor = '#090d16';
}

export const MusicPipPlayer: React.FC<MusicPipPlayerProps> = ({
  track,
  isPlaying,
  elapsedSec,
  durationSec,
  volume,
  isMuted,
  isShuffle,
  isRepeat,
  isLiked,
  onTogglePlayPause,
  onPrevTrack,
  onNextTrack,
  onSeek,
  onToggleShuffle,
  onToggleRepeat,
  onToggleLike,
  onChangeVolume,
  onToggleMute,
  onRestoreNormalPlayer,
  queueIndex,
  queueTotal,
  tr,
}) => {
  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);
  const [fallbackTrack, setFallbackTrack] = useState<SpotifyTrackItem | null>(null);
  const displayTrack = track || fallbackTrack;
  const trackRef = useRef<SpotifyTrackItem | null>(track);
  trackRef.current = track;
  const pipWindowRef = useRef<Window | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const coverImageRef = useRef<HTMLImageElement | null>(null);
  const lastCoverUrlRef = useRef<string>('');

  const effectiveDuration = Math.max(0, durationSec || displayTrack?.durationSec || 0);
  const clampedElapsed =
    effectiveDuration > 0
      ? Math.min(effectiveDuration, Math.max(0, elapsedSec || 0))
      : Math.max(0, elapsedSec || 0);
  const progressPct =
    effectiveDuration > 0
      ? Math.min(100, Math.max(0, (clampedElapsed / effectiveDuration) * 100))
      : 0;
  const flooredElapsed = Math.floor(clampedElapsed);

  const closePip = useCallback(async () => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close();
    }
    pipWindowRef.current = null;
    setPipContainer(null);

    if (typeof document !== 'undefined' && document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture();
      } catch {
        // ignore
      }
    }
    setFallbackTrack(null);
  }, []);

  useEffect(() => {
    if (track && fallbackTrack) {
      setFallbackTrack(null);
    }
  }, [track, fallbackTrack]);

  // Auto-close PiP cleanly if active music track stops / is closed
  useEffect(() => {
    if (!track && !fallbackTrack) {
      void closePip();
    }
  }, [track, fallbackTrack, closePip]);

  // Keep Document PiP window title synced when track changes
  useEffect(() => {
    const pipWin = pipWindowRef.current;
    if (!pipWin || pipWin.closed || !displayTrack) return;
    pipWin.document.title = `${displayTrack.title} — ${displayTrack.artist} · Filmio`;
  }, [displayTrack]);

  const drawCanvasFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !displayTrack) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.55, '#172554');
    grad.addColorStop(1, '#080b12');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(0, 0, w, 6);

    const artSize = 180;
    const artX = 36;
    const artY = Math.round((h - artSize) / 2);

    ctx.save();
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(artX, artY, artSize, artSize, 20);
    } else {
      ctx.rect(artX, artY, artSize, artSize);
    }
    ctx.clip();

    if (
      coverImageRef.current &&
      coverImageRef.current.complete &&
      coverImageRef.current.naturalWidth > 0
    ) {
      ctx.drawImage(coverImageRef.current, artX, artY, artSize, artSize);
    } else {
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(artX, artY, artSize, artSize);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 54px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        (displayTrack.title || '♪').slice(0, 2).toUpperCase(),
        artX + artSize / 2,
        artY + artSize / 2
      );
    }
    ctx.restore();

    const textX = artX + artSize + 30;
    const maxTextW = w - textX - 32;

    ctx.fillStyle = isPlaying ? '#60a5fa' : '#94a3b8';
    ctx.font = 'bold 17px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(
      isPlaying ? '● FILMIO MUZICĂ' : '⏸ FILMIO MUZICĂ',
      textX,
      artY + 14,
      maxTextW
    );

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
    ctx.fillText(displayTrack.title, textX, artY + 52, maxTextW);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(displayTrack.artist, textX, artY + 96, maxTextW);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 18px system-ui, -apple-system, sans-serif';
    const timeStr =
      effectiveDuration > 0
        ? `${fmtPipDuration(flooredElapsed)} / ${fmtPipDuration(effectiveDuration)}`
        : fmtPipDuration(flooredElapsed);
    ctx.fillText(timeStr, textX, artY + 138, maxTextW);

    // Canvas timeline progress bar
    const barW = maxTextW;
    const barY = artY + artSize - 10;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(textX, barY, barW, 6);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(textX, barY, Math.round((barW * progressPct) / 100), 6);
  }, [displayTrack, isPlaying, flooredElapsed, effectiveDuration, progressPct]);

  // Redraw Safari/Firefox Video-PiP fallback canvas on cover change or second tick
  useEffect(() => {
    if (!displayTrack) return;
    const targetUrl = proxyMusicCover(displayTrack.cover || displayTrack.coverSmall || FALLBACK_MUSIC_COVER);
    if (!targetUrl) {
      coverImageRef.current = null;
      lastCoverUrlRef.current = '';
      drawCanvasFrame();
      return;
    }
    if (lastCoverUrlRef.current === targetUrl) {
      drawCanvasFrame();
      return;
    }

    lastCoverUrlRef.current = targetUrl;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      coverImageRef.current = img;
      drawCanvasFrame();
    };
    img.onerror = () => {
      coverImageRef.current = null;
      drawCanvasFrame();
    };
    img.src = targetUrl;
  }, [displayTrack, drawCanvasFrame]);

  const restoreToNormalPlayer = useCallback(async () => {
    await closePip();
    if (typeof window !== 'undefined') {
      window.focus();
    }
    onRestoreNormalPlayer();
  }, [closePip, onRestoreNormalPlayer]);

  const handleTogglePip = useCallback(async (overrideTrack?: SpotifyTrackItem) => {
    const activeTrack = overrideTrack || trackRef.current;
    if (!activeTrack) return;

    if (
      (pipWindowRef.current && !pipWindowRef.current.closed) ||
      document.pictureInPictureElement
    ) {
      if (overrideTrack && overrideTrack.id !== trackRef.current?.id) {
        setFallbackTrack(overrideTrack);
        return;
      }
      await closePip();
      return;
    }

    const docPip = (
      window as Window & { documentPictureInPicture?: DocumentPipApi }
    ).documentPictureInPicture;

    if (docPip && typeof docPip.requestWindow === 'function') {
      try {
        const pipWin = await docPip.requestWindow({
          width: 390,
          height: 228,
        });
        pipWindowRef.current = pipWin;
        copyStylesToMusicPipWindow(document, pipWin.document);
        pipWin.document.title = `${activeTrack.title} — ${activeTrack.artist} · Filmio`;

        const container = pipWin.document.createElement('div');
        container.id = 'aether-music-pip-root';
        container.className = 'w-screen h-screen overflow-hidden';
        pipWin.document.body.appendChild(container);

        pipWin.addEventListener('pagehide', () => {
          pipWindowRef.current = null;
          setPipContainer(null);
        });

        if (overrideTrack) {
          setFallbackTrack(overrideTrack);
        }
        setPipContainer(container);
        return;
      } catch {
        // Fall through to Canvas + Video PiP on Safari / Firefox
      }
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    try {
      if (overrideTrack) {
        setFallbackTrack(overrideTrack);
      }
      drawCanvasFrame();
      const stream = canvas.captureStream(15);
      video.srcObject = stream;
      await video.play();
      if (typeof video.requestPictureInPicture === 'function') {
        await video.requestPictureInPicture();
      }
    } catch {
      // Ignore if PiP is unsupported in current browser
    }
  }, [closePip, drawCanvasFrame]);

  useEffect(() => {
    externalToggleMusicPip = handleTogglePip;
    return () => {
      externalToggleMusicPip = null;
    };
  }, [handleTogglePip]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLeave = () => {
      // Video PiP exited natively
    };
    video.addEventListener('leavepictureinpicture', onLeave);
    return () => {
      video.removeEventListener('leavepictureinpicture', onLeave);
    };
  }, []);

  if (!displayTrack) return null;

  const effectiveVolPct = Math.round((isMuted ? 0 : volume) * 100);

  return (
    <>
      {/* Hidden Canvas & Video for fallback Video-PiP (Safari / Firefox) */}
      <canvas
        ref={canvasRef}
        width={640}
        height={360}
        className="hidden"
        aria-hidden="true"
      />
      <video
        ref={videoRef}
        muted
        playsInline
        className="hidden"
        aria-hidden="true"
      />

      {/* Interactive Floating Music MiniPlayer inside Document Picture-in-Picture */}
      {pipContainer &&
        createPortal(
          <div className="w-full h-full flex flex-col justify-between p-3.5 bg-[#090d16] text-zinc-100 select-none">
            {/* Top Row: Filmio Muzică Badge + Restore + Close */}
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#1e3a8a]/50 border border-[#3b82f6]/40 text-blue-200 text-[11px] font-bold tabular-nums">
                <Music className="w-3 h-3 text-[#60a5fa]" />
                <span>
                  {queueTotal && queueTotal > 0 && queueIndex !== undefined && queueIndex >= 0
                    ? `Filmio Muzică · ${queueIndex + 1}/${queueTotal}`
                    : 'Filmio Muzică'}
                </span>
              </span>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => void restoreToNormalPlayer()}
                  title={tr('Înapoi în playerul normal', 'Return to full app', 'В обычный плеер')}
                  className="px-2.5 py-1 rounded-full bg-[#1e3a8a] hover:bg-[#1d4ed8] border border-[#3b82f6]/50 text-white text-[11px] font-semibold inline-flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>{tr('Player normal', 'Normal player', 'Обычный')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void closePip()}
                  title={tr('Închide fereastra flotantă', 'Close floating window', 'Закрыть окно')}
                  aria-label={tr('Închide fereastra flotantă', 'Close floating window', 'Закрыть окно')}
                  className="w-6 h-6 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Middle Row: Artwork + Title/Artist + Like */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => void restoreToNormalPlayer()}
                title={tr('Deschide în pagina Muzică', 'Open in Music', 'Открыть в Музыке')}
                className="w-14 h-14 rounded-xl overflow-hidden shadow-lg border border-white/15 bg-[#111726] shrink-0 cursor-pointer"
              >
                <img
                  src={proxyMusicCover(displayTrack.coverSmall || displayTrack.cover)}
                  alt={displayTrack.title}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = FALLBACK_MUSIC_COVER;
                  }}
                  className="w-full h-full object-cover"
                />
              </button>

              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => void restoreToNormalPlayer()}
                  className="text-left text-sm font-bold text-white hover:text-[#93c5fd] hover:underline truncate block w-full cursor-pointer"
                >
                  {displayTrack.title}
                </button>
                <div className="text-xs font-medium text-[#94a3b8] truncate mt-0.5">
                  {displayTrack.artist}
                </div>
              </div>

              <button
                type="button"
                onClick={onToggleLike}
                aria-label={tr('Salvează la favorite', 'Save favorite', 'В избранное')}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                  isLiked
                    ? 'text-[#60a5fa] bg-[#1e3a8a]/40'
                    : 'text-zinc-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* Interactive Timeline Scrubber */}
            <div className="flex items-center gap-2 w-full">
              <span className="text-[11px] font-medium text-[#94a3b8] tabular-nums w-9 text-right shrink-0">
                {fmtPipDuration(clampedElapsed)}
              </span>
              <div
                role="slider"
                tabIndex={0}
                aria-label="Music PiP Timeline"
                aria-valuemin={0}
                aria-valuemax={effectiveDuration}
                aria-valuenow={flooredElapsed}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (rect.width > 0) {
                    const ratio = Math.min(
                      1,
                      Math.max(0, (e.clientX - rect.left) / rect.width)
                    );
                    onSeek(ratio * effectiveDuration);
                  }
                }}
                onPointerMove={(e) => {
                  if (
                    e.buttons === 1 ||
                    e.currentTarget.hasPointerCapture?.(e.pointerId)
                  ) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    if (rect.width > 0) {
                      const ratio = Math.min(
                        1,
                        Math.max(0, (e.clientX - rect.left) / rect.width)
                      );
                      onSeek(ratio * effectiveDuration);
                    }
                  }
                }}
                onPointerUp={(e) => {
                  if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                }}
                className="relative flex-1 h-4 flex items-center cursor-pointer group"
              >
                <div className="w-full h-1.5 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#3b82f6] group-hover:bg-[#60a5fa]"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
              <span className="text-[11px] font-medium text-[#94a3b8] tabular-nums w-9 shrink-0">
                {fmtPipDuration(effectiveDuration)}
              </span>
            </div>

            {/* Bottom Row: Shuffle / Prev / Play-Pause / Next / Repeat + Volume */}
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/10">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onToggleShuffle}
                  aria-label={tr('Amestecare', 'Shuffle', 'Перемешать')}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                    isShuffle ? 'text-[#60a5fa]' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onPrevTrack}
                  aria-label={tr('Piesa anterioară', 'Previous track', 'Предыдущий трек')}
                  className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-100 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <SkipBack className="w-3.5 h-3.5 fill-current" />
                </button>
                <button
                  type="button"
                  onClick={onTogglePlayPause}
                  aria-label={isPlaying ? tr('Pauză', 'Pause', 'Пауза') : tr('Redă', 'Play', 'Играть')}
                  style={{ backgroundColor: '#ffffff', color: '#000000' }}
                  className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-md cursor-pointer shrink-0"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current text-black" />
                  ) : (
                    <Play className="w-4 h-4 fill-current text-black ml-0.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={onNextTrack}
                  aria-label={tr('Următoarea piesă', 'Next track', 'Следующий трек')}
                  className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-100 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <SkipForward className="w-3.5 h-3.5 fill-current" />
                </button>
                <button
                  type="button"
                  onClick={onToggleRepeat}
                  aria-label={tr('Repetare', 'Repeat', 'Повтор')}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                    isRepeat ? 'text-[#60a5fa]' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-1.5 w-24 shrink-0">
                <button
                  type="button"
                  onClick={onToggleMute}
                  aria-label={tr('Mut', 'Mute', 'Без звука')}
                  className="w-7 h-7 rounded-full hover:bg-white/10 text-zinc-300 flex items-center justify-center shrink-0 cursor-pointer"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={effectiveVolPct}
                  onChange={(e) => onChangeVolume(Number(e.target.value) / 100)}
                  className="w-full h-1.5 cursor-pointer"
                />
              </div>
            </div>
          </div>,
          pipContainer
        )}
    </>
  );
};
