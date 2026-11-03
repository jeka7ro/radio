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
  Film,
  Radio,
  Popcorn,
  Maximize2,
  Settings,
  LayoutGrid,
} from 'lucide-react';
import { useRadioStore } from '../../store/useRadioStore';

interface SmartTvMsxModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SmartTvMsxModal: React.FC<SmartTvMsxModalProps> = ({
  isOpen,
  onClose,
}) => {
  const setActiveTab = useRadioStore((state) => state.setActiveTab);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [modalSection, setModalSection] = useState<'portal' | 'setup'>('portal');

  if (!isOpen) return null;

  const hostDomain = 'radiotv-jk.netlify.app';
  const fullAppUrl = `https://${hostDomain}/?tvmode=1`;

  const handleCopy = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 2500);
  };

  const enterSmartTvTab = (tab: 'mediateca' | 'tv' | 'home' | 'favorites' | 'settings') => {
    document.documentElement.classList.add('smart-tv-mode');
    setActiveTab(tab);
    onClose();
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="smart-tv-msx-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92dvh] overflow-y-auto rounded-[28px] bg-zinc-900 border border-white/15 text-zinc-100 shadow-2xl p-4 sm:p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-brand-600/25 shrink-0">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="smart-tv-msx-title"
                className="text-base sm:text-lg font-bold text-white flex items-center gap-2"
              >
                AetherRadio Smart TV — Portal TV LG & Media Station X
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Interfață Smart TV pentru telecomandă LG + Configurare Media Station X
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Switch between Live TV Hub & Setup Instructions */}
            <button
              type="button"
              onClick={() => setModalSection('portal')}
              className={`h-9 px-3.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                modalSection === 'portal'
                  ? 'bg-brand-600 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Portal Smart TV
            </button>

            <button
              type="button"
              onClick={() => setModalSection('setup')}
              className={`h-9 px-3.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                modalSection === 'setup'
                  ? 'bg-brand-600 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Instalare pe TV LG
            </button>

            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5 border border-white/10 transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Închide
            </button>
          </div>
        </div>

        {modalSection === 'portal' ? (
          /* LIVE IN-APP SMART TV / MSX PORTAL LAUNCHER (No broken external msx.benzac.de link!) */
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="text-xs text-zinc-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  Selectează secțiunea cu telecomanda (Săgeți + OK) sau click pentru a porni în <strong>Mod Smart TV Fullscreen</strong>:
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  document.documentElement.classList.add('smart-tv-mode');
                  if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(() => {});
                  }
                  onClose();
                }}
                className="h-8 px-3.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Activează Ecran Complet TV
              </button>
            </div>

            {/* Big Smart TV Launcher Tiles (Exact Media Station X Layout) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Tile 1: Mediateca */}
              <button
                type="button"
                onClick={() => enterSmartTvTab('mediateca')}
                className="group text-left p-5 rounded-3xl bg-gradient-to-br from-purple-900/70 via-zinc-900 to-zinc-950 hover:from-purple-800/80 border border-purple-500/30 hover:border-purple-400 transition-all shadow-lg flex items-start gap-4 cursor-pointer"
              >
                <div className="w-14 h-14 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform">
                  <Film className="w-7 h-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-extrabold text-white group-hover:text-purple-200">
                    Mediatecă — Filme & Seriale
                  </div>
                  <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                    Catalog Global, Rusia, România & SUA cu subtitrări și reluare automată
                  </p>
                  <span className="inline-flex items-center gap-1 mt-2.5 text-[11px] font-bold text-purple-300">
                    <Play className="w-3 h-3 fill-current" /> Deschide pe TV
                  </span>
                </div>
              </button>

              {/* Tile 2: TV Online Live */}
              <button
                type="button"
                onClick={() => enterSmartTvTab('tv')}
                className="group text-left p-5 rounded-3xl bg-gradient-to-br from-indigo-900/70 via-zinc-900 to-zinc-950 hover:from-indigo-800/80 border border-indigo-500/30 hover:border-indigo-400 transition-all shadow-lg flex items-start gap-4 cursor-pointer"
              >
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform">
                  <Tv className="w-7 h-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-extrabold text-white group-hover:text-indigo-200">
                    TV Online Live (RO / MD / RU)
                  </div>
                  <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                    Canale TV în direct cu ghid EPG, Catchup și schimbare rapidă din telecomandă
                  </p>
                  <span className="inline-flex items-center gap-1 mt-2.5 text-[11px] font-bold text-indigo-300">
                    <Play className="w-3 h-3 fill-current" /> Deschide Grila TV
                  </span>
                </div>
              </button>

              {/* Tile 3: Posturi Radio Online */}
              <button
                type="button"
                onClick={() => enterSmartTvTab('home')}
                className="group text-left p-5 rounded-3xl bg-gradient-to-br from-teal-900/70 via-zinc-900 to-zinc-950 hover:from-teal-800/80 border border-teal-500/30 hover:border-teal-400 transition-all shadow-lg flex items-start gap-4 cursor-pointer"
              >
                <div className="w-14 h-14 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform">
                  <Radio className="w-7 h-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-extrabold text-white group-hover:text-teal-200">
                    Posturi Radio Online
                  </div>
                  <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                    1000+ posturi din România, Moldova și internaționale cu afișare piesă live
                  </p>
                  <span className="inline-flex items-center gap-1 mt-2.5 text-[11px] font-bold text-teal-300">
                    <Play className="w-3 h-3 fill-current" /> Ascultă Radio pe TV
                  </span>
                </div>
              </button>

              {/* Tile 4: Lampa Smart TV */}
              <a
                href="https://yumata.github.io/lampa/"
                target="_blank"
                rel="noopener noreferrer"
                className="group text-left p-5 rounded-3xl bg-gradient-to-br from-amber-900/70 via-zinc-900 to-zinc-950 hover:from-amber-800/80 border border-amber-500/30 hover:border-amber-400 transition-all shadow-lg flex items-start gap-4 cursor-pointer"
              >
                <div className="w-14 h-14 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform">
                  <Popcorn className="w-7 h-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-extrabold text-white group-hover:text-amber-200">
                    Lampa Smart TV (Ecran Complet)
                  </div>
                  <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                    Interfață TV dedicată 100% pentru săgețile telecomenzii LG Smart TV
                  </p>
                  <span className="inline-flex items-center gap-1 mt-2.5 text-[11px] font-bold text-amber-300">
                    <ExternalLink className="w-3 h-3" /> Lansează Lampa TV
                  </span>
                </div>
              </a>
            </div>

            {/* Quick Bar with Start Parameter for Media Station X on LG TV */}
            <div className="p-4 rounded-2xl bg-zinc-950 border border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                  Adresa Start Parameter pentru aplicația Media Station X pe televizorul LG:
                </div>
                <div className="text-sm font-mono font-bold text-emerald-400 select-all mt-0.5">
                  {hostDomain}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopy(hostDomain, 'msx-host')}
                  className="h-9 px-4 rounded-full bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
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
                <button
                  type="button"
                  onClick={() => setModalSection('setup')}
                  className="h-9 px-4 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
                >
                  Cum configurez pe TV LG?
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* SETUP INSTRUCTIONS FOR LG TV */
          <div className="space-y-4">
            {/* Method 1: Media Station X */}
            <div className="rounded-3xl bg-zinc-950/90 border border-brand-500/30 p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-600/20 border border-brand-500/40 text-brand-300 text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  Metoda 1: Aplicația Media Station X (pe televizorul LG)
                </span>
                <span className="text-[11px] font-medium text-emerald-400 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Fișier /msx/start.json Activ
                </span>
              </div>

              <ol className="space-y-2.5 text-xs sm:text-sm text-zinc-300 list-decimal list-inside">
                <li>
                  Pe televizorul tău <strong>LG Smart TV</strong>, deschide{' '}
                  <strong className="text-white">LG Content Store (Apps)</strong> și instalează gratuit aplicația{' '}
                  <strong className="text-amber-400">Media Station X</strong>.
                </li>
                <li>
                  Deschide <strong>Media Station X</strong> pe televizor și mergi la:{' '}
                  <strong className="text-white">Settings → Start Parameter → Setup</strong>.
                </li>
                <li>
                  Tastează exact adresa de mai jos și apasă pe butonul de confirmare (Bifă / OK):
                </li>
              </ol>

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
                    className="h-9 px-4 rounded-full bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md shadow-brand-600/25 transition-all cursor-pointer"
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
                </div>
              </div>
            </div>

            {/* Method 2: LG Web Browser */}
            <div className="rounded-3xl bg-zinc-950/60 border border-white/10 p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  Metoda 2: Direct în Browserul Web LG (recomandat pentru toată aplicația completă)
                </h3>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                Deschide aplicația <strong>Web Browser</strong> de pe televizorul LG, intră pe adresa de mai jos și apasă pe steluța <strong>Adaugă la Favorite / Fixează pe ecranul Home</strong>:
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-zinc-900 border border-white/10">
                <span className="text-xs sm:text-sm font-mono font-semibold text-sky-400 px-2 truncate select-all">
                  {fullAppUrl}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(fullAppUrl, 'tv-url')}
                    className="h-9 px-4 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
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
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
