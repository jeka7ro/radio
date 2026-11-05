import React, { useState, useEffect, useMemo } from 'react';
import { buildStationLogoCandidates } from '../../services/stationLogoService';

interface StationAvatarProps {
  name: string;
  favicon?: string;
  homepage?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isPlaying?: boolean;
  className?: string;
}

const AVATAR_PALETTES = [
  'bg-violet-700 text-white',
  'bg-indigo-700 text-white',
  'bg-purple-700 text-white',
  'bg-fuchsia-700 text-white',
  'bg-rose-700 text-white',
  'bg-teal-700 text-white',
  'bg-cyan-700 text-white',
  'bg-blue-700 text-white',
  'bg-emerald-700 text-white',
];

function getInitials(name: string): string {
  const cleaned = name
    .replace(/[^A-Za-z0-9\u00C0-\u024F\u0400-\u04FF\s]/g, ' ')
    .trim();
  if (!cleaned) return 'FM';
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

function getPaletteClass(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

const SIZE_CLASSES = {
  sm: 'w-11 h-11 text-xs rounded-xl',
  md: 'w-14 h-14 text-sm rounded-xl',
  lg: 'w-20 h-20 text-xl rounded-2xl',
  xl: 'w-48 h-48 sm:w-56 sm:h-56 text-4xl rounded-3xl',
};

export const StationAvatar: React.FC<StationAvatarProps> = ({
  name,
  favicon,
  homepage,
  size = 'md',
  isPlaying = false,
  className = '',
}) => {
  const candidateUrls = useMemo(
    () => buildStationLogoCandidates(name, favicon, homepage),
    [name, favicon, homepage]
  );

  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [candidateUrls]);

  const rawImageUrl =
    candidateIndex < candidateUrls.length ? candidateUrls[candidateIndex] : null;
  const activeImageUrl = useMemo(() => {
    if (!rawImageUrl) return null;
    if (!/^https?:\/\//i.test(rawImageUrl)) return rawImageUrl;
    const isTvOrLan =
      typeof window !== 'undefined' &&
      (document.documentElement.classList.contains('smart-tv-mode') ||
        window.location.pathname.toLowerCase().startsWith('/tv') ||
        /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
          window.location.hostname
        ) ||
        /Web0S|WebOS|NetCast|SmartTV|Tizen|Large Screen|MSX/i.test(
          navigator.userAgent
        ));
    return isTvOrLan
      ? `/api/tv-proxy?url=${encodeURIComponent(rawImageUrl)}`
      : rawImageUrl;
  }, [rawImageUrl]);
  const initials = getInitials(name);
  const palette = getPaletteClass(name);

  return (
    <div
      className={`relative flex-shrink-0 aspect-square overflow-hidden flex items-center justify-center font-bold select-none shadow-sm border border-slate-200/70 dark:border-zinc-800/80 ${SIZE_CLASSES[size]} ${
        activeImageUrl ? 'bg-white' : palette
      } ${className}`}
    >
      {activeImageUrl ? (
        <img
          src={activeImageUrl}
          alt={name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setCandidateIndex((prev) => prev + 1)}
          className="w-full h-full object-contain p-1"
        />
      ) : (
        <span aria-hidden="true" className="tracking-wider">
          {initials}
        </span>
      )}

      {isPlaying && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-brand-950/55 backdrop-blur-[1px] flex items-center justify-center gap-1"
        >
          <span className="eq-bar w-1 bg-white rounded-full h-3" />
          <span className="eq-bar eq-bar-2 w-1 bg-white rounded-full h-5" />
          <span className="eq-bar eq-bar-3 w-1 bg-white rounded-full h-3.5" />
        </div>
      )}
    </div>
  );
};
