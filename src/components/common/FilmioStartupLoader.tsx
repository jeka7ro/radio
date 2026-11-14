import React, { useId } from 'react';

interface FilmioStartupLoaderProps {
  /** Compact inline mode for section grids (vs full-player overlay). */
  compact?: boolean;
}

/**
 * Pure-black Cinema Startup Loader displaying ONLY the official Filmio icon
 * ("F + Play" monogram with smooth orbiting cinema ring) and zero text.
 */
export const FilmioStartupLoader: React.FC<FilmioStartupLoaderProps> = ({
  compact = false,
}) => {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '');

  const bgId = `filmioBg_${uid}`;
  const borderId = `filmioBorder_${uid}`;
  const auraId = `filmioAura_${uid}`;
  const ringId = `filmioRing_${uid}`;
  const innerRingId = `filmioInnerRing_${uid}`;
  const fStemId = `filmioStem_${uid}`;
  const playId = `filmioPlay_${uid}`;

  if (compact) {
    return (
      <div
        role="status"
        aria-label="Filmio"
        data-filmio-startup-loader="compact"
        className="py-16 w-full flex items-center justify-center pointer-events-none select-none"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 512 512"
          fill="none"
          aria-hidden="true"
          className="w-16 h-16 sm:w-20 sm:h-20 drop-shadow-[0_14px_38px_rgba(14,165,233,0.28)]"
        >
          <rect width="512" height="512" rx="116" fill={`url(#${bgId})`} />
          <rect
            x="10"
            y="10"
            width="492"
            height="492"
            rx="106"
            stroke={`url(#${borderId})`}
            strokeWidth="8"
            strokeOpacity="0.85"
          />
          <circle
            cx="256"
            cy="256"
            r="196"
            fill={`url(#${auraId})`}
            className="animate-pulse"
          />
          <circle
            cx="256"
            cy="256"
            r="178"
            stroke="#38bdf8"
            strokeOpacity="0.18"
            strokeWidth="14"
          />
          <g className="origin-center animate-spin" style={{ animationDuration: '1.35s' }}>
            <circle
              cx="256"
              cy="256"
              r="178"
              stroke={`url(#${ringId})`}
              strokeWidth="18"
              strokeLinecap="round"
              strokeDasharray="370 740"
            />
          </g>
          <circle
            cx="256"
            cy="256"
            r="144"
            fill="#050914"
            stroke={`url(#${innerRingId})`}
            strokeWidth="6"
          />
          <path
            d="M178 184C178 171.85 187.85 162 200 162H316C328.15 162 338 171.85 338 184C338 196.15 328.15 206 316 206H224V336C224 348.703 213.703 359 201 359C188.297 359 178 348.703 178 336V184Z"
            fill={`url(#${fStemId})`}
          />
          <path
            d="M246 238C246 228.5 256.6 222.8 264.6 227.9L338.6 274.9C345.9 279.5 345.9 290.5 338.6 295.1L264.6 342.1C256.6 347.2 246 341.5 246 332V238Z"
            fill={`url(#${playId})`}
          />
          <defs>
            <linearGradient id={bgId} x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
              <stop stopColor="#040711" />
              <stop offset="0.5" stopColor="#091326" />
              <stop offset="1" stopColor="#050A14" />
            </linearGradient>
            <linearGradient id={borderId} x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38bdf8" />
              <stop offset="0.5" stopColor="#2563eb" stopOpacity="0.35" />
              <stop offset="1" stopColor="#6366f1" />
            </linearGradient>
            <radialGradient
              id={auraId}
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(256 256) rotate(90) scale(196)"
            >
              <stop stopColor="#0ea5e9" stopOpacity="0.38" />
              <stop offset="0.6" stopColor="#2563eb" stopOpacity="0.16" />
              <stop offset="1" stopColor="#1d4ed8" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={ringId} x1="84" y1="84" x2="428" y2="428" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7dd3fc" />
              <stop offset="0.5" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#4f46e5" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={innerRingId} x1="120" y1="120" x2="392" y2="392" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38bdf8" stopOpacity="0.55" />
              <stop offset="1" stopColor="#1d4ed8" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id={fStemId} x1="178" y1="162" x2="338" y2="359" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" />
              <stop offset="0.55" stopColor="#DBEAFE" />
              <stop offset="1" stopColor="#60A5FA" />
            </linearGradient>
            <linearGradient id={playId} x1="246" y1="224" x2="346" y2="346" gradientUnits="userSpaceOnUse">
              <stop stopColor="#67E8F9" />
              <stop offset="0.45" stopColor="#38BDF8" />
              <stop offset="1" stopColor="#2563EB" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label="Filmio"
      data-filmio-startup-loader="true"
      className="absolute inset-0 z-20 pointer-events-none select-none flex items-center justify-center bg-black"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        fill="none"
        aria-hidden="true"
        className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 drop-shadow-[0_18px_48px_rgba(14,165,233,0.32)]"
      >
        <rect width="512" height="512" rx="116" fill={`url(#${bgId})`} />
        <rect
          x="10"
          y="10"
          width="492"
          height="492"
          rx="106"
          stroke={`url(#${borderId})`}
          strokeWidth="8"
          strokeOpacity="0.85"
        />
        <circle
          cx="256"
          cy="256"
          r="196"
          fill={`url(#${auraId})`}
          className="animate-pulse"
        />
        <circle
          cx="256"
          cy="256"
          r="178"
          stroke="#38bdf8"
          strokeOpacity="0.18"
          strokeWidth="14"
        />
        <g className="origin-center animate-spin" style={{ animationDuration: '1.35s' }}>
          <circle
            cx="256"
            cy="256"
            r="178"
            stroke={`url(#${ringId})`}
            strokeWidth="18"
            strokeLinecap="round"
            strokeDasharray="370 740"
          />
        </g>
        <circle
          cx="256"
          cy="256"
          r="144"
          fill="#050914"
          stroke={`url(#${innerRingId})`}
          strokeWidth="6"
        />
        <path
          d="M178 184C178 171.85 187.85 162 200 162H316C328.15 162 338 171.85 338 184C338 196.15 328.15 206 316 206H224V336C224 348.703 213.703 359 201 359C188.297 359 178 348.703 178 336V184Z"
          fill={`url(#${fStemId})`}
        />
        <path
          d="M246 238C246 228.5 256.6 222.8 264.6 227.9L338.6 274.9C345.9 279.5 345.9 290.5 338.6 295.1L264.6 342.1C256.6 347.2 246 341.5 246 332V238Z"
          fill={`url(#${playId})`}
        />
        <defs>
          <linearGradient id={bgId} x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
            <stop stopColor="#040711" />
            <stop offset="0.5" stopColor="#091326" />
            <stop offset="1" stopColor="#050A14" />
          </linearGradient>
          <linearGradient id={borderId} x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38bdf8" />
            <stop offset="0.5" stopColor="#2563eb" stopOpacity="0.35" />
            <stop offset="1" stopColor="#6366f1" />
          </linearGradient>
          <radialGradient
            id={auraId}
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(256 256) rotate(90) scale(196)"
          >
            <stop stopColor="#0ea5e9" stopOpacity="0.38" />
            <stop offset="0.6" stopColor="#2563eb" stopOpacity="0.16" />
            <stop offset="1" stopColor="#1d4ed8" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={ringId} x1="84" y1="84" x2="428" y2="428" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7dd3fc" />
            <stop offset="0.5" stopColor="#3b82f6" />
            <stop offset="1" stopColor="#4f46e5" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={innerRingId} x1="120" y1="120" x2="392" y2="392" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38bdf8" stopOpacity="0.55" />
            <stop offset="1" stopColor="#1d4ed8" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id={fStemId} x1="178" y1="162" x2="338" y2="359" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="0.55" stopColor="#DBEAFE" />
            <stop offset="1" stopColor="#60A5FA" />
          </linearGradient>
          <linearGradient id={playId} x1="246" y1="224" x2="346" y2="346" gradientUnits="userSpaceOnUse">
            <stop stopColor="#67E8F9" />
            <stop offset="0.45" stopColor="#38BDF8" />
            <stop offset="1" stopColor="#2563EB" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

