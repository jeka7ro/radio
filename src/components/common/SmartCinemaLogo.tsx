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
      ? 'text-base sm:text-lg'
      : size === 'lg'
        ? 'text-xl sm:text-2xl'
        : 'text-lg sm:text-xl';

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <div
        aria-hidden="true"
        className={`relative ${iconBoxClass} ${showText ? 'mr-2.5' : ''} bg-[#060b16] border border-sky-400/45 shadow-[0_0_22px_rgba(56,189,248,0.32),inset_0_1px_0_rgba(186,230,253,0.3)] flex items-center justify-center overflow-hidden shrink-0`}
      >
        {/* Smoothly breathing cyan-sapphire ambient glow */}
        <span className="sc-logo-aura absolute inset-0 rounded-inherit bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.42),transparent_72%)] pointer-events-none" />

        {/* Animated Filmio SVG Emblem ("F + Play") */}
        <svg
          viewBox="0 0 64 64"
          fill="none"
          className="relative z-10 w-full h-full p-0.5"
        >
          {/* Outer subtle track */}
          <circle
            cx="32"
            cy="32"
            r="24.5"
            stroke="#38BDF8"
            strokeOpacity="0.2"
            strokeWidth="2.2"
          />

          {/* Smooth continuous rotating sapphire-cyan orbital arc */}
          <circle
            cx="32"
            cy="32"
            r="24.5"
            stroke="url(#filmioOrbitGrad)"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeDasharray="52 102"
            className="sc-logo-orbit"
          />

          {/* Counter-rotating inner cinema lens ring */}
          <circle
            cx="32"
            cy="32"
            r="19.5"
            fill="#050914"
            stroke="url(#filmioInnerGrad)"
            strokeWidth="1.5"
            strokeDasharray="28 16"
            className="sc-logo-orbit-reverse"
          />

          {/* Filmio "F" Stem + Top Wing */}
          <path
            d="M22.2 22.8C22.2 21.25 23.45 20 25 20H39.5C41.05 20 42.3 21.25 42.3 22.8C42.3 24.35 41.05 25.6 39.5 25.6H28V42C28 43.6 26.7 44.9 25.1 44.9C23.5 44.9 22.2 43.6 22.2 42V22.8Z"
            fill="url(#filmioFStemGrad)"
          />

          {/* Central glowing Play prism forming middle bar of "F" */}
          <path
            d="M30.8 29.6C30.8 28.4 32.1 27.7 33.1 28.3L42.4 34.2C43.3 34.8 43.3 36.2 42.4 36.8L33.1 42.7C32.1 43.3 30.8 42.6 30.8 41.4V29.6Z"
            fill="url(#filmioPlayGrad)"
            className="sc-logo-play"
          />

          <defs>
            <linearGradient
              id="filmioOrbitGrad"
              x1="8"
              y1="8"
              x2="56"
              y2="56"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#BAE6FD" />
              <stop offset="0.5" stopColor="#38BDF8" />
              <stop offset="1" stopColor="#2563EB" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id="filmioInnerGrad"
              x1="13"
              y1="13"
              x2="51"
              y2="51"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#7DD3FC" stopOpacity="0.7" />
              <stop offset="1" stopColor="#2563EB" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient
              id="filmioFStemGrad"
              x1="22"
              y1="20"
              x2="42"
              y2="45"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FFFFFF" />
              <stop offset="0.6" stopColor="#E0F2FE" />
              <stop offset="1" stopColor="#60A5FA" />
            </linearGradient>
            <linearGradient
              id="filmioPlayGrad"
              x1="30.8"
              y1="28"
              x2="43"
              y2="43"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#67E8F9" />
              <stop offset="0.45" stopColor="#38BDF8" />
              <stop offset="1" stopColor="#2563EB" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {showText && (
        <div className="min-w-0 leading-none">
          <div className={`${textClass} font-extrabold tracking-tight flex items-center`}>
            <span className="text-white">Film</span>
            <span className="sc-logo-text-shimmer bg-gradient-to-r from-[#7dd3fc] via-[#38bdf8] to-[#60a5fa] bg-clip-text text-transparent">
              io
            </span>
          </div>
          {subtitle && (
            <span className="text-[11px] text-sky-400/80 font-medium mt-0.5 block truncate">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
