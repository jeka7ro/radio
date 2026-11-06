import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Play,
  Pause,
  Loader2,
  SkipBack,
  SkipForward,
  Heart,
  Volume2,
  VolumeX,
  X,
  Maximize2,
} from 'lucide-react';
import { useRadioStore } from '../../store/useRadioStore';
import { useTranslation } from '../../i18n/useTranslation';
import { StationAvatar } from '../common/StationAvatar';
import { getCountryFlagEmoji } from '../../services/geoLanguageService';
import { buildStationLogoCandidates } from '../../services/stationLogoService';
import { resolveDisplayTrack } from '../../utils/cleanTrackMetadata';

interface DocumentPictureInPicture {
  requestWindow: (options?: {
    width?: number;
    height?: number;
    disallowReturnToOpener?: boolean;
  }) => Promise<Window>;
  window: Window | null;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

let externalToggleRadioPip: (() => Promise<void>) | null = null;

export async function toggleRadioPip(): Promise<void> {
  if (externalToggleRadioPip) {
    await externalToggleRadioPip();
  }
}

function copyStylesToPipWindow(sourceDoc: Document, targetDoc: Document) {
  // Sync dark mode class on root element
  if (sourceDoc.documentElement.classList.contains('dark')) {
    targetDoc.documentElement.classList.add('dark');
  } else {
    targetDoc.documentElement.classList.remove('dark');
  }

  // Copy all <link rel="stylesheet"> and <style> elements
  const styleNodes = sourceDoc.querySelectorAll('link[rel="stylesheet"], style');
  styleNodes.forEach((node) => {
    targetDoc.head.appendChild(node.cloneNode(true));
  });

  targetDoc.body.style.margin = '0';
  targetDoc.body.style.padding = '0';
  targetDoc.body.style.overflow = 'hidden';
  targetDoc.body.style.userSelect = 'none';
}

export const RadioPipPlayer: React.FC = () => {
  const { t, format } = useTranslation();

  const currentStation = useRadioStore((state) => state.currentStation);
  const playerStatus = useRadioStore((state) => state.playerStatus);
  const nowPlayingMeta = useRadioStore((state) => state.nowPlayingMeta);
  const nowPlayingTitle = useRadioStore((state) => state.nowPlayingTitle);
  const volume = useRadioStore((state) => state.volume);
  const isMuted = useRadioStore((state) => state.isMuted);
  const favorites = useRadioStore((state) => state.favorites);
  const theme = useRadioStore((state) => state.theme);
  const setRadioPipOpen = useRadioStore((state) => state.setRadioPipOpen);
  const setExpandedPlayerOpen = useRadioStore(
    (state) => state.setExpandedPlayerOpen
  );

  const displayTrack = currentStation
    ? resolveDisplayTrack(nowPlayingMeta, nowPlayingTitle, currentStation.name)
    : null;

  const playStation = useRadioStore((state) => state.playStation);
  const playNextAvailableStation = useRadioStore(
    (state) => state.playNextAvailableStation
  );
  const playPreviousStation = useRadioStore(
    (state) => state.playPreviousStation
  );
  const setVolume = useRadioStore((state) => state.setVolume);
  const toggleMute = useRadioStore((state) => state.toggleMute);
  const toggleFavorite = useRadioStore((state) => state.toggleFavorite);

  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const coverImageRef = useRef<HTMLImageElement | null>(null);
  const lastLoadedCoverUrlRef = useRef<string>('');

  // Keep dark mode class synced inside Document PiP window when theme changes
  useEffect(() => {
    const pipWin = pipWindowRef.current;
    if (!pipWin || pipWin.closed) return;
    if (document.documentElement.classList.contains('dark')) {
      pipWin.document.documentElement.classList.add('dark');
    } else {
      pipWin.document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Update Document PiP window title when song/station changes
  useEffect(() => {
    const pipWin = pipWindowRef.current;
    if (!pipWin || pipWin.closed || !currentStation) return;
    pipWin.document.title = nowPlayingMeta?.title
      ? `${nowPlayingMeta.title} — ${nowPlayingMeta.artist || currentStation.name}`
      : `${currentStation.name} — AetherRadio`;
  }, [currentStation, nowPlayingMeta]);

  // Draw fallback Canvas for Video-PiP browsers (Safari / Firefox)
  const drawCanvasFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentStation) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#18181b');
    grad.addColorStop(0.5, '#172554');
    grad.addColorStop(1, '#09090b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle accent border at top
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(0, 0, w, 6);

    // Draw cover art or station placeholder box
    const artSize = 180;
    const artX = 36;
    const artY = Math.round((h - artSize) / 2);

    ctx.save();
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(artX, artY, artSize, artSize, 24);
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
      ctx.fillStyle = '#4c1d95';
      ctx.fillRect(artX, artY, artSize, artSize);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 54px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        currentStation.name.slice(0, 2).toUpperCase(),
        artX + artSize / 2,
        artY + artSize / 2
      );
    }
    ctx.restore();

    // Text column
    const textX = artX + artSize + 30;
    const maxTextW = w - textX - 32;

    // Live badge
    ctx.fillStyle = playerStatus === 'playing' ? '#10b981' : '#a1a1aa';
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(
      playerStatus === 'playing'
        ? `● LIVE • ${currentStation.name}`
        : `⏸ ${currentStation.name}`,
      textX,
      artY + 12,
      maxTextW
    );

    // Primary Song Title or Station Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
    const primaryTitle = displayTrack?.title || currentStation.name;
    ctx.fillText(primaryTitle, textX, artY + 52, maxTextW);

    // Artist Name or Subtitle
    ctx.fillStyle = '#c4b5fd';
    ctx.font = '600 23px system-ui, -apple-system, sans-serif';
    const subtitle =
      displayTrack?.artist ||
      currentStation.country ||
      'AetherRadio';
    ctx.fillText(subtitle, textX, artY + 98, maxTextW);

    // Album / Bitrate info
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '500 18px system-ui, -apple-system, sans-serif';
    const metaFooter = displayTrack?.album
      ? displayTrack.album
      : `${currentStation.codec || 'MP3'}${
          currentStation.bitrate ? ` • ${currentStation.bitrate} kbps` : ''
        }`;
    ctx.fillText(metaFooter, textX, artY + 138, maxTextW);
  }, [currentStation, displayTrack, playerStatus]);

  // Load cover art or station logo for fallback Canvas
  useEffect(() => {
    if (!currentStation) return;
    const candidates = buildStationLogoCandidates(
      currentStation.name,
      currentStation.favicon,
      currentStation.homepage
    );
    const targetUrl = nowPlayingMeta?.coverUrl || candidates[0] || '';
    if (!targetUrl) {
      coverImageRef.current = null;
      lastLoadedCoverUrlRef.current = '';
      drawCanvasFrame();
      return;
    }
    if (lastLoadedCoverUrlRef.current === targetUrl) {
      drawCanvasFrame();
      return;
    }

    lastLoadedCoverUrlRef.current = targetUrl;
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
    img.src = targetUrl.startsWith('http')
      ? `/api/tv-proxy?url=${encodeURIComponent(targetUrl)}`
      : targetUrl;
  }, [currentStation, nowPlayingMeta, drawCanvasFrame]);

  const closePip = useCallback(async () => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close();
    }
    pipWindowRef.current = null;
    setPipContainer(null);

    if (document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture();
      } catch {
        // ignore
      }
    }
    setRadioPipOpen(false);
  }, [setRadioPipOpen]);

  const restoreToNormalPlayer = useCallback(async () => {
    await closePip();
    if (typeof window !== 'undefined') {
      window.focus();
    }
    setExpandedPlayerOpen(true);
  }, [closePip, setExpandedPlayerOpen]);

  const handleTogglePip = useCallback(async () => {
    if (!currentStation) return;

    // 1. If already open, close it
    if (
      (pipWindowRef.current && !pipWindowRef.current.closed) ||
      document.pictureInPictureElement
    ) {
      await closePip();
      return;
    }

    // 2. Prefer Chrome/Edge Document Picture-in-Picture API (interactive React MiniPlayer)
    if (
      typeof window !== 'undefined' &&
      window.documentPictureInPicture &&
      typeof window.documentPictureInPicture.requestWindow === 'function'
    ) {
      try {
        const pipWin = await window.documentPictureInPicture.requestWindow({
          width: 380,
          height: 215,
        });
        pipWindowRef.current = pipWin;
        copyStylesToPipWindow(document, pipWin.document);
        pipWin.document.title = `${currentStation.name} — AetherRadio`;

        const container = pipWin.document.createElement('div');
        container.id = 'aether-radio-pip-root';
        container.className = 'w-screen h-screen overflow-hidden';
        pipWin.document.body.appendChild(container);

        pipWin.addEventListener('pagehide', () => {
          pipWindowRef.current = null;
          setPipContainer(null);
          setRadioPipOpen(false);
        });

        setPipContainer(container);
        setRadioPipOpen(true);
        return;
      } catch {
        // Fall through to Canvas+Video PiP if Document PiP fails
      }
    }

    // 3. Fallback: Canvas stream + HTML5 <video> Picture-in-Picture (Safari / Firefox)
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    try {
      drawCanvasFrame();
      const stream = canvas.captureStream(15);
      video.srcObject = stream;
      await video.play();
      if (typeof video.requestPictureInPicture === 'function') {
        await video.requestPictureInPicture();
        setRadioPipOpen(true);
      }
    } catch {
      // Ignore if PiP is not supported
    }
  }, [currentStation, closePip, drawCanvasFrame, setRadioPipOpen]);

  useEffect(() => {
    externalToggleRadioPip = handleTogglePip;
    return () => {
      externalToggleRadioPip = null;
    };
  }, [handleTogglePip]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLeavePip = () => {
      setRadioPipOpen(false);
    };
    video.addEventListener('leavepictureinpicture', onLeavePip);
    return () => {
      video.removeEventListener('leavepictureinpicture', onLeavePip);
    };
  }, [setRadioPipOpen]);

  if (!currentStation) return null;

  const isPlaying = playerStatus === 'playing';
  const isLoading = playerStatus === 'loading';
  const isFavorite = favorites.some(
    (f) => f.stationuuid === currentStation.stationuuid
  );
  const effectiveVolumePercent = Math.round((isMuted ? 0 : volume) * 100);

  return (
    <>
      {/* Hidden Canvas & Video for fallback Video-PiP on Safari/Firefox */}
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

      {/* Interactive Floating MiniPlayer rendered inside Document Picture-in-Picture */}
      {pipContainer &&
        createPortal(
          <div className="w-full h-full flex flex-col justify-between p-3.5 bg-[#090d16] text-zinc-100 select-none">
            {/* Top Strip: Station Logo + Station badge + Restore to Normal Player + Close PiP button */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full bg-[#1e3a8a]/40 border border-[#3b82f6]/40 text-blue-200 text-[11px] font-bold truncate">
                  <StationAvatar
                    name={currentStation.name}
                    favicon={currentStation.favicon}
                    homepage={currentStation.homepage}
                    size="sm"
                    isPlaying={false}
                    className="!w-5 !h-5 !rounded-md shrink-0"
                  />
                  <span>{getCountryFlagEmoji(currentStation.countrycode)}</span>
                  <span className="truncate text-white">{currentStation.name}</span>
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => void restoreToNormalPlayer()}
                  title="Înapoi în playerul normal"
                  className="px-2.5 py-1 rounded-full bg-[#1e3a8a] hover:bg-[#1d4ed8] border border-[#3b82f6]/50 text-white text-[11px] font-semibold inline-flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Player normal</span>
                </button>
                <button
                  type="button"
                  onClick={() => void closePip()}
                  title="Închide fereastra flotantă"
                  className="w-6 h-6 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Middle Row: Original Radio Logo + Song Cover Art + Song Title + Artist Avatar & Name */}
            <button
              type="button"
              onClick={() => void restoreToNormalPlayer()}
              title="Apasă pentru a deschide în playerul normal"
              className="flex items-center gap-2.5 my-1.5 min-w-0 text-left rounded-2xl p-1 -m-1 hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 flex-shrink-0">
                <StationAvatar
                  name={currentStation.name}
                  favicon={currentStation.favicon}
                  homepage={currentStation.homepage}
                  size="md"
                  isPlaying={false}
                  className="!w-14 !h-14 !rounded-2xl shrink-0 shadow-lg border border-white/15"
                />
                {displayTrack?.coverUrl && (
                  <div className="relative w-14 h-14 rounded-2xl overflow-hidden shadow-lg border border-white/20 bg-zinc-900 shrink-0">
                    <img
                      src={displayTrack.coverUrl}
                      alt={displayTrack.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  onClick={(e) => {
                    if (!displayTrack?.title) return;
                    e.stopPropagation();
                    const q = displayTrack.artist
                      ? `${displayTrack.artist} ${displayTrack.title}`
                      : displayTrack.title;
                    window.dispatchEvent(
                      new CustomEvent('smartcinema:open-music-query', {
                        detail: {
                          query: q,
                          label: displayTrack.artist
                            ? `${displayTrack.title} — ${displayTrack.artist}`
                            : displayTrack.title,
                        },
                      })
                    );
                    window.focus();
                  }}
                  title={
                    displayTrack?.title
                      ? `Deschide „${displayTrack.title}” în Muzică`
                      : undefined
                  }
                  className="text-sm font-bold text-white hover:text-amber-300 hover:underline truncate leading-snug cursor-pointer"
                >
                  {displayTrack?.title || currentStation.name}
                </p>

                <div
                  onClick={(e) => {
                    if (!displayTrack?.artist) return;
                    e.stopPropagation();
                    window.dispatchEvent(
                      new CustomEvent('smartcinema:open-music-query', {
                        detail: {
                          query: displayTrack.artist,
                          label: displayTrack.artist,
                        },
                      })
                    );
                    window.focus();
                  }}
                  title={
                    displayTrack?.artist
                      ? `Vezi toate piesele lui „${displayTrack.artist}” în Muzică`
                      : undefined
                  }
                  className="flex items-center gap-1.5 mt-1 min-w-0 cursor-pointer group/pipartist"
                >
                  {displayTrack?.artistAvatarUrl && (
                    <img
                      src={displayTrack.artistAvatarUrl}
                      alt={displayTrack.artist}
                      className="w-5 h-5 rounded-full object-cover flex-shrink-0 ring-1 ring-blue-400/60"
                    />
                  )}
                  <p className="text-xs font-semibold text-blue-300 group-hover/pipartist:text-amber-300 group-hover/pipartist:underline truncate">
                    {displayTrack?.artist ||
                      (isPlaying ? t.player.playing : t.player.paused)}
                  </p>
                </div>

                {displayTrack?.album && (
                  <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                    {displayTrack.album}
                  </p>
                )}
              </div>
            </button>

            {/* Bottom Row: Transport Controls + Favorite + Volume */}
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-zinc-800/80">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={playPreviousStation}
                  aria-label={t.player.prevStation}
                  className="w-9 h-9 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => playStation(currentStation)}
                  aria-label={format(
                    isPlaying ? t.player.pause : t.player.play,
                    { name: currentStation.name }
                  )}
                  className="w-10 h-10 rounded-full bg-[#1e3a8a] hover:bg-[#1d4ed8] border border-[#3b82f6]/50 text-white flex items-center justify-center shadow-md transition-colors cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={playNextAvailableStation}
                  aria-label={t.player.nextStation}
                  className="w-9 h-9 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-200 flex items-center justify-center transition-colors"
                >
                  <SkipForward className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => toggleFavorite(currentStation)}
                  aria-pressed={isFavorite}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    isFavorite
                      ? 'text-rose-400 bg-rose-950/50'
                      : 'text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  <Heart
                    className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`}
                  />
                </button>
              </div>

              {/* Compact Volume Control */}
              <div className="flex items-center gap-1.5 w-28">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="w-8 h-8 rounded-full hover:bg-zinc-800 text-zinc-300 flex items-center justify-center flex-shrink-0"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={effectiveVolumePercent}
                  style={
                    {
                      '--progress': `${effectiveVolumePercent}%`,
                    } as React.CSSProperties
                  }
                  onChange={(e) => setVolume(Number(e.target.value) / 100)}
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

