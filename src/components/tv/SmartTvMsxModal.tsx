import React, { useState } from 'react';
import {
  Tv,
  X,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Compass,
  CheckCircle2,
  Play,
} from 'lucide-react';

interface SmartTvMsxModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SmartTvMsxModal: React.FC<SmartTvMsxModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const hostDomain =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
      ? window.location.host
      : 'radiotv-jk.netlify.app';

  const fullAppUrl = `https://${hostDomain}/?tvmode=1`;
  const msxTestSimulatorUrl = `https://msx.benzac.de/?start=menu:https://${hostDomain}/msx/menu.json`;

  const handleCopy = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="smart-tv-msx-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-[28px] bg-zinc-900 border border-white/15 text-zinc-100 shadow-2xl p-4 sm:p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-brand-600/25 shrink-0">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="smart-tv-msx-title"
                className="text-base sm:text-lg font-bold text-white flex items-center gap-2"
              >
                Conectare pe TV LG (Media Station X & webOS)
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Vezi toată aplicația (Mediatecă, TV Live, Radio & Lampa) direct pe televizorul tău LG
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5 border border-white/10 transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            Închide
          </button>
        </div>

        {/* Method 1: Media Station X (Recommended) */}
        <div className="rounded-3xl bg-zinc-950/90 border border-brand-500/30 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-600/20 border border-brand-500/40 text-brand-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              Metoda 1 (Recomandat): Aplicația Media Station X
            </span>
            <span className="text-[11px] font-medium text-emerald-400 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Portal MSX Activ (/msx/start.json)
            </span>
          </div>

          <ol className="space-y-2.5 text-xs sm:text-sm text-zinc-300 list-decimal list-inside">
            <li>
              Pe televizorul tău <strong>LG Smart TV</strong>, deschide magazinul oficial{' '}
              <strong className="text-white">LG Content Store (Apps)</strong> și instalează gratuit aplicația{' '}
              <strong className="text-amber-400">Media Station X</strong>.
            </li>
            <li>
              Deschide <strong>Media Station X</strong> pe televizor și mergi în meniul din stânga la:{' '}
              <strong className="text-white">Settings → Start Parameter → Setup</strong>.
            </li>
            <li>
              Introdu exact adresa de mai jos și apasă pe butonul de confirmare (Bifă / OK):
            </li>
          </ol>

          {/* Start Parameter Box */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-zinc-900 border border-white/10">
            <div className="px-2">
              <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                Start Parameter în Media Station X:
              </div>
              <div className="text-sm sm:text-base font-mono font-bold text-emerald-400 select-all mt-0.5">
                {hostDomain}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleCopy(hostDomain, 'msx-host')}
                className="h-9 px-4 rounded-full bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md shadow-brand-600/25 transition-all"
              >
                {copiedKey === 'msx-host' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copiat!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copiază adresa
                  </>
                )}
              </button>

              <a
                href={msxTestSimulatorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-4 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold inline-flex items-center gap-1.5 border border-white/10 transition-all"
              >
                <Play className="w-3.5 h-3.5 text-amber-400" />
                Previzualizează MSX
              </a>
            </div>
          </div>

          <p className="text-[11px] text-zinc-400 leading-relaxed">
            După confirmare, Media Station X încarcă automat portalul{' '}
            <strong className="text-zinc-200">AetherRadio Smart TV</strong> cu acces direct la{' '}
            <strong>Mediatecă (Filme & Seriale)</strong>, <strong>TV Online Live</strong>,{' '}
            <strong>Radio Online</strong> și <strong>Lampa Smart TV</strong>.
          </p>
        </div>

        {/* Method 2: LG Web Browser */}
        <div className="rounded-3xl bg-zinc-950/60 border border-white/10 p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs sm:text-sm font-bold text-white">
              Metoda 2: Direct în Browserul Web LG (cu telecomanda Magic Remote)
            </h3>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed">
            Poți deschide aplicația și direct din <strong>Web Browser</strong>-ul televizorului LG la adresa de mai jos. Apasă pe iconița <strong>Adaugă la Favorite / Fixează pe ecranul Home</strong> pentru a o deschide cu 1 singur click de pe telecomandă:
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-zinc-900 border border-white/10">
            <span className="text-xs sm:text-sm font-mono font-semibold text-sky-400 px-2 truncate select-all">
              {fullAppUrl}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleCopy(fullAppUrl, 'tv-url')}
                className="h-9 px-4 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 border border-white/10 transition-colors"
              >
                {copiedKey === 'tv-url' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Copiat!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copiază Link TV
                  </>
                )}
              </button>
              <a
                href={fullAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-4 rounded-full bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Deschide Mod TV
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
