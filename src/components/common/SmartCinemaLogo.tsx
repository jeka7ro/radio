import React from 'react';

interface SmartCinemaLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  subtitle?: string;
  className?: string;
}

export const SmartCinemaLogo: React.FC<SmartCinemaLogoProps> = ({
  size = 'md',
  showText = true,
  subtitle,
  className = '',
}) => {
  const iconBoxClass =
    size === 'sm'
      ? 'w-8 h-8 rounded-xl'
      : size === 'lg'
        ? 'w-11 h-11 rounded-2xl'
        : 'w-9 h-9 rounded-xl';

  const textClass =
    size === 'sm'
      ? 'text-sm sm:text-base'
      : size === 'lg'
        ? 'text-lg sm:text-xl'
        : 'text-base sm:text-lg';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <div
        aria-hidden="true"
        className={`relative ${iconBoxClass} bg-[#070d19] border border-blue-400/40 shadow-[0_0_22px_rgba(59,130,246,0.32),inset_0_1px_0_rgba(147,197,253,0.28)] flex items-center justify-center overflow-hidden shrink-0`}
      >
        {/* Smoothly breathing navy-blue ambient glow */}
        <span className="sc-logo-aura absolute inset-0 rounded-inherit bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.42),transparent_72%)] pointer-events-none" />

        {/* Animated SVG Emblem */}
        <svg
          viewBox="0 0 64 64"
          fill="none"
          className="relative z-10 w-full h-full p-1"
        >
          {/* Outer subtle track */}
          <circle
            cx="32"
            cy="32"
            r="23"
            stroke="#3B82F6"
            strokeOpacity="0.22"
            strokeWidth="2.4"
          />

          {/* Smooth continuous rotating sapphire-navy orbital arc */}
          <circle
            cx="32"
            cy="32"
            r="23"
            stroke="url(#scOrbitGrad)"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeDasharray="48 96"
            className="sc-logo-orbit"
          />

          {/* Counter-rotating inner cinema lens ring */}
          <circle
            cx="32"
            cy="32"
            r="16.5"
            fill="#060b14"
            stroke="url(#scInnerGrad)"
            strokeWidth="1.8"
            strokeDasharray="24 18"
            className="sc-logo-orbit-reverse"
          />

          {/* Central glowing sapphire Play prism */}
          <path
            d="M27.2 22.4C27.2 21.1 28.6 20.3 29.7 21L43.2 29.6C44.2 30.2 44.2 31.8 43.2 32.4L29.7 41C28.6 41.7 27.2 40.9 27.2 39.6V22.4Z"
            fill="url(#scPlayGrad)"
            className="sc-logo-play"
          />

          <defs>
            <linearGradient
              id="scOrbitGrad"
              x1="8"
              y1="8"
              x2="56"
              y2="56"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#BFDBFE" />
              <stop offset="0.5" stopColor="#60A5FA" />
              <stop offset="1" stopColor="#1D4ED8" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="scInnerGrad"
              x1="15"
              y1="15"
              x2="49"
              y2="49"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#93C5FD" stopOpacity="0.7" />
              <stop offset="1" stopColor="#2563EB" stopOpacity="0.18" />
            </linearGradient>
            <linearGradient
              id="scPlayGrad"
              x1="26"
              y1="20"
              x2="44"
              y2="42"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#EFF6FF" />
              <stop offset="0.45" stopColor="#60A5FA" />
              <stop offset="1" stopColor="#2563EB" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {showText && (
        <div className="min-w-0 leading-none">
          <div className={`${textClass} font-extrabold tracking-tight flex items-center`}>
            <span className="text-white">Smart</span>
            <span className="sc-logo-text-shimmer bg-gradient-to-r from-[#93c5fd] via-[#60a5fa] to-[#bfdbfe] bg-clip-text text-transparent">
              Cinema
            </span>
          </div>
          {subtitle && (
            <span className="text-[11px] text-blue-400/80 font-medium mt-0.5 block truncate">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

