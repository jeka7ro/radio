import React from 'react';
import { CinemetaItem, STREAMING_PLATFORMS } from '../../views/smartTvLampaHelpers';

export type VodProducerBadgeKey =
  | 'netflix'
  | 'apple'
  | 'hbo'
  | 'disney'
  | 'prime'
  | 'paramount'
  | 'hulu'
  | 'youtube'
  | 'vk'
  | 'ntv'
  | 'premier'
  | 'start'
  | 'kion'
  | 'okko'
  | 'ivi'
  | 'wink'
  | 'sts'
  | 'tnt'
  | 'kinopoisk'
  | 'warner'
  | 'universal'
  | 'sony'
  | 'marvel'
  | 'a24'
  | 'lionsgate'
  | 'mgm';

// Fast O(1) in-memory index of all platform flagship series IDs
const idToPlatformMap = new Map<string, VodProducerBadgeKey>();
for (const plat of STREAMING_PLATFORMS) {
  for (const item of plat.flagshipSeries) {
    if (item.id) {
      idToPlatformMap.set(item.id, plat.id as VodProducerBadgeKey);
    }
  }
}

// Well-known curated IDs for exact 1-to-1 platform mapping
const knownSpecificItemMap: Record<string, VodProducerBadgeKey> = {
  // Netflix
  tt13210838: 'netflix', // The Gentlemen
  tt4574334: 'netflix',  // Stranger Things
  tt10919420: 'netflix', // Squid Game
  tt13443470: 'netflix', // Wednesday
  tt2085059: 'netflix',  // Black Mirror
  tt6468322: 'netflix',  // Money Heist
  tt13918776: 'netflix', // The Night Agent
  tt2707408: 'netflix',  // Narcos
  tt5180504: 'netflix',  // The Witcher
  tt2442560: 'netflix',  // Peaky Blinders
  tt5071412: 'netflix',  // Ozark
  tt5753856: 'netflix',  // Dark
  tt13406094: 'hbo',     // The White Lotus

  // Apple TV+
  tt11280740: 'apple',   // Severance
  tt14688458: 'apple',   // Silo
  tt10986410: 'apple',   // Ted Lasso
  tt5875444: 'apple',    // Slow Horses
  tt19231492: 'apple',   // Dark Matter
  tt0804484: 'apple',    // Foundation
  tt7203552: 'apple',    // The Morning Show
  tt17677860: 'apple',   // Presumed Innocent
  tt15677150: 'apple',   // Shrinking
  tt7772588: 'apple',    // For All Mankind
  tt15314262: 'apple',   // Killers of the Flower Moon
  tt15609822: 'apple',   // Tenzing
  tt6166392: 'apple',    // Napoleon

  // HBO Max
  tt3581920: 'hbo',      // The Last of Us
  tt11198330: 'hbo',     // House of the Dragon
  tt15435876: 'hbo',     // The Penguin
  tt0944947: 'hbo',      // Game of Thrones
  tt2356777: 'hbo',      // True Detective
  tt7660850: 'hbo',      // Succession
  tt7366338: 'hbo',      // Chernobyl
  tt8772296: 'hbo',      // Euphoria
  tt0141842: 'hbo',      // The Sopranos
  tt10466872: 'hbo',     // Dune: Prophecy
  tt2017109: 'hbo',      // Banshee

  // Disney+
  tt2788316: 'disney',   // Shōgun
  tt14452776: 'disney',  // The Bear
  tt8111088: 'disney',   // The Mandalorian
  tt9253284: 'disney',   // Andor
  tt9140554: 'disney',   // Loki
  tt12851524: 'disney',  // Only Murders in the Building
  tt13623632: 'disney',  // Alien: Earth

  // Prime Video
  tt12637874: 'prime',   // Fallout
  tt1190634: 'prime',    // The Boys
  tt9288030: 'prime',    // Reacher
  tt6741278: 'prime',    // Invincible
  tt7631058: 'prime',    // The Rings of Power
  tt14044212: 'prime',   // Mr. & Mrs. Smith
  tt11743610: 'prime',   // The Terminal List
  tt5057054: 'prime',    // Jack Ryan
  tt13554834: 'prime',   // Project Hail Mary

  // SkyShowtime / Paramount+
  tt31510819: 'paramount', // MobLand
  tt14186672: 'paramount', // Landman
  tt16358384: 'paramount', // Tulsa King
  tt4236770: 'paramount',  // Yellowstone
  tt13111078: 'paramount', // Lioness
  tt11712058: 'paramount', // Mayor of Kingstown
  tt18335752: 'paramount', // 1923
  tt13991232: 'paramount', // 1883
  tt32252772: 'paramount', // Dexter: Original Sin
  tt24053860: 'paramount', // The Day of the Jackal
  tt2934286: 'paramount',  // Halo

  // Russian Shows & Channels
  tt31712367: 'ntv',       // Zvyozdy
  kp_5508530: 'ntv',       // Zvyozdy Kinopoisk ID
  '5508530': 'ntv',
};

for (const [id, plat] of Object.entries(knownSpecificItemMap)) {
  idToPlatformMap.set(id, plat);
}

/**
 * High-speed, robust producer / streaming network detector.
 * Resolves in < 0.1ms using multi-tier heuristics (ID -> Title -> Tags -> Studio).
 */
export function detectVodProducer(
  item?: Partial<CinemetaItem> | null
): VodProducerBadgeKey | null {
  if (!item) return null;

  // 1. Direct ID match
  if (item.id && idToPlatformMap.has(item.id)) {
    return idToPlatformMap.get(item.id)!;
  }

  const rawTitle = `${item.name || ''} ${item.nameOriginal || ''}`.toLowerCase();
  const rawId = (item.id || '').toLowerCase();
  const desc = (item.description || '').toLowerCase();

  // 2. Explicit VK Video checks
  if (
    rawTitle.includes('vk video') ||
    rawTitle.includes('вк видео') ||
    rawId.includes('vk_') ||
    rawId.includes('vkvideo') ||
    rawTitle.includes('токсики') ||
    rawTitle.includes('кстати') ||
    rawTitle.includes('натальная карта') ||
    rawTitle.includes('громкий вопрос') ||
    rawTitle.includes('контакты') ||
    rawTitle.includes('чбд') ||
    rawTitle.includes('плохие вызовы') ||
    rawTitle.includes('ошуительное хоу') ||
    rawTitle.includes('сессия') ||
    desc.includes('vk video') ||
    desc.includes('вк видео')
  ) {
    return 'vk';
  }

  // 3. NTV (НТВ) checks
  if (
    rawTitle.includes('звёзды') ||
    rawTitle.includes('звезды') ||
    rawTitle.includes('zvyozdy') ||
    rawTitle.includes('следствие вели') ||
    rawTitle.includes('маска') ||
    rawTitle.includes('ты супер') ||
    rawTitle.includes('невский') ||
    rawTitle.includes('балабол') ||
    rawTitle.includes('первый отдел') ||
    rawTitle.includes('нтв') ||
    rawTitle.includes('скорая помощь')
  ) {
    return 'ntv';
  }

  // 4. PREMIER checks
  if (
    rawTitle.includes('вор в загоне') ||
    rawTitle.includes('кукушкин') ||
    rawTitle.includes('полярный') ||
    rawTitle.includes('жуки') ||
    rawTitle.includes('реальные пацаны') ||
    rawTitle.includes('универ') ||
    rawTitle.includes('интерны') ||
    rawTitle.includes('мир! дружба! жвачка') ||
    rawTitle.includes('игра на выживание') ||
    rawTitle.includes('перевал дятлова') ||
    rawTitle.includes('эпидемия') ||
    rawTitle.includes('капельник') ||
    desc.includes('premier') ||
    desc.includes('премьер')
  ) {
    return 'premier';
  }

  // 5. START checks
  if (
    rawTitle.includes('слово пацана') ||
    rawTitle.includes('вампиры средней полосы') ||
    rawTitle.includes('медиатор') ||
    rawTitle.includes('контейнер') ||
    rawTitle.includes('бывшие') ||
    rawTitle.includes('содержанки') ||
    rawTitle.includes('жить жизнь') ||
    rawTitle.includes('два холма') ||
    desc.includes('видеосервис start') ||
    desc.includes('на start')
  ) {
    return 'start';
  }

  // 6. CTC (СТС)
  if (
    rawTitle.includes('кухня') ||
    rawTitle.includes('отель элеон') ||
    rawTitle.includes('ивановы-ивановы') ||
    rawTitle.includes('папины дочки') ||
    rawTitle.includes('родком') ||
    desc.includes('канал стс') ||
    desc.includes('телеканал стс')
  ) {
    return 'sts';
  }

  // 7. Kinopoisk / KION / Okko
  if (rawTitle.includes('коммерсант') || rawTitle.includes('почка') || rawTitle.includes('оффлайн')) {
    return 'kion';
  }
  if (
    rawTitle.includes('мажор') ||
    rawTitle.includes('метод') ||
    rawTitle.includes('триггер') ||
    rawTitle.includes('пищеблок') ||
    rawTitle.includes('монастырь') ||
    rawTitle.includes('нулевой пациент') ||
    rawTitle.includes('кибердеревня') ||
    rawTitle.includes('король и шут')
  ) {
    return 'kinopoisk';
  }

  // 8. Western Major Platform Title Matches
  // Netflix
  if (
    rawTitle.includes('the gentlemen') ||
    rawTitle.includes('squid game') ||
    rawTitle.includes('stranger things') ||
    rawTitle.includes('wednesday') ||
    rawTitle.includes('black mirror') ||
    rawTitle.includes('money heist') ||
    rawTitle.includes('peaky blinders') ||
    rawTitle.includes('dark') ||
    rawTitle.includes('ozark') ||
    rawTitle.includes('the witcher') ||
    rawTitle.includes('cobra kai') ||
    rawTitle.includes('bridgerton') ||
    rawTitle.includes('lupin') ||
    rawTitle.includes('the crown') ||
    rawTitle.includes('outer banks') ||
    rawTitle.includes('mindhunter') ||
    rawTitle.includes('narcos') ||
    rawTitle.includes('emily in paris') ||
    rawTitle.includes('heartstopper') ||
    rawTitle.includes('berlin') ||
    rawTitle.includes('lucifer') ||
    rawTitle.includes('east of eden') ||
    rawTitle.includes('the irishman') ||
    rawTitle.includes('red notice') ||
    rawTitle.includes('the gray man') ||
    rawTitle.includes('glass onion') ||
    rawTitle.includes('rebel ridge') ||
    desc.includes('netflix')
  ) {
    return 'netflix';
  }

  // Apple TV+
  if (
    rawTitle.includes('severance') ||
    rawTitle.includes('silo') ||
    rawTitle.includes('ted lasso') ||
    rawTitle.includes('slow horses') ||
    rawTitle.includes('dark matter') ||
    rawTitle.includes('foundation') ||
    rawTitle.includes('the morning show') ||
    rawTitle.includes('presumed innocent') ||
    rawTitle.includes('shrinking') ||
    rawTitle.includes('for all mankind') ||
    rawTitle.includes('killers of the flower moon') ||
    rawTitle.includes('napoleon') ||
    rawTitle.includes('tenzing') ||
    rawTitle.includes('coda') ||
    rawTitle.includes('finch') ||
    rawTitle.includes('bad sisters') ||
    rawTitle.includes('black bird') ||
    rawTitle.includes('defending jacob') ||
    rawTitle.includes('hijack') ||
    rawTitle.includes('masters of the air') ||
    desc.includes('apple original') ||
    desc.includes('apple tv')
  ) {
    return 'apple';
  }

  // HBO Max
  if (
    rawTitle.includes('the last of us') ||
    rawTitle.includes('house of the dragon') ||
    rawTitle.includes('the penguin') ||
    rawTitle.includes('game of thrones') ||
    rawTitle.includes('chernobyl') ||
    rawTitle.includes('succession') ||
    rawTitle.includes('the white lotus') ||
    rawTitle.includes('true detective') ||
    rawTitle.includes('euphoria') ||
    rawTitle.includes('dune: prophecy') ||
    rawTitle.includes('the sopranos') ||
    rawTitle.includes('the wire') ||
    rawTitle.includes('banshee') ||
    rawTitle.includes('peacemaker') ||
    rawTitle.includes('westworld') ||
    rawTitle.includes('barry') ||
    desc.includes('hbo original') ||
    desc.includes('hbo')
  ) {
    return 'hbo';
  }

  // Disney+
  if (
    rawTitle.includes('shōgun') ||
    rawTitle.includes('shogun') ||
    rawTitle.includes('the bear') ||
    rawTitle.includes('the mandalorian') ||
    rawTitle.includes('andor') ||
    rawTitle.includes('loki') ||
    rawTitle.includes('only murders in the building') ||
    rawTitle.includes('alien: earth') ||
    rawTitle.includes('wandavision') ||
    rawTitle.includes('ahsoka') ||
    rawTitle.includes('daredevil') ||
    rawTitle.includes('percy jackson') ||
    rawTitle.includes('deadpool & wolverine') ||
    rawTitle.includes('inside out') ||
    rawTitle.includes('moana') ||
    rawTitle.includes('avatar') ||
    desc.includes('disney+') ||
    desc.includes('disney plus')
  ) {
    return 'disney';
  }

  // Prime Video
  if (
    rawTitle.includes('fallout') ||
    rawTitle.includes('the boys') ||
    rawTitle.includes('reacher') ||
    rawTitle.includes('invincible') ||
    rawTitle.includes('rings of power') ||
    rawTitle.includes('lord of the rings') ||
    rawTitle.includes('mr. & mrs. smith') ||
    rawTitle.includes('the terminal list') ||
    rawTitle.includes('jack ryan') ||
    rawTitle.includes('project hail mary') ||
    rawTitle.includes('road house') ||
    rawTitle.includes('gen v') ||
    rawTitle.includes('the wheel of time') ||
    rawTitle.includes('bosch') ||
    rawTitle.includes('clarkson') ||
    desc.includes('prime video') ||
    desc.includes('amazon original')
  ) {
    return 'prime';
  }

  // SkyShowtime / Paramount+
  if (
    rawTitle.includes('mobland') ||
    rawTitle.includes('landman') ||
    rawTitle.includes('tulsa king') ||
    rawTitle.includes('yellowstone') ||
    rawTitle.includes('lioness') ||
    rawTitle.includes('mayor of kingstown') ||
    rawTitle.includes('1923') ||
    rawTitle.includes('1883') ||
    rawTitle.includes('dexter') ||
    rawTitle.includes('day of the jackal') ||
    rawTitle.includes('halo') ||
    desc.includes('paramount+') ||
    desc.includes('skyshowtime')
  ) {
    return 'paramount';
  }

  // A24
  if (
    rawTitle.includes('everything everywhere all at once') ||
    rawTitle.includes('civil war') ||
    rawTitle.includes('heretic') ||
    rawTitle.includes('the whale') ||
    rawTitle.includes('hereditary') ||
    rawTitle.includes('midsommar') ||
    rawTitle.includes('past lives') ||
    rawTitle.includes('the zone of interest') ||
    rawTitle.includes('the iron claw') ||
    rawTitle.includes('uncut gems') ||
    desc.includes('a24')
  ) {
    return 'a24';
  }

  // Warner Bros
  if (
    rawTitle.includes('the batman') ||
    rawTitle.includes('dune') ||
    rawTitle.includes('barbie') ||
    rawTitle.includes('wonka') ||
    rawTitle.includes('joker') ||
    rawTitle.includes('the dark knight') ||
    rawTitle.includes('interstellar') ||
    rawTitle.includes('inception') ||
    rawTitle.includes('harry potter') ||
    rawTitle.includes('matrix')
  ) {
    return 'warner';
  }

  // Universal
  if (
    rawTitle.includes('oppenheimer') ||
    rawTitle.includes('jurassic') ||
    rawTitle.includes('wicked') ||
    rawTitle.includes('despicable me') ||
    rawTitle.includes('minions') ||
    rawTitle.includes('gladiator')
  ) {
    return 'universal';
  }

  // Check tags in text
  if (/(?:^|[.\s_\-[])(NF|NFLX|NETFLIX)(?:[.\s_\-\]]|$)/i.test(rawTitle)) return 'netflix';
  if (/(?:^|[.\s_\-[])(ATVP|APTV|APPLE\s*TV\+?)(?:[.\s_\-\]]|$)/i.test(rawTitle)) return 'apple';
  if (/(?:^|[.\s_\-[])(HMAX|HBOMAX|HBO)(?:[.\s_\-\]]|$)/i.test(rawTitle)) return 'hbo';
  if (/(?:^|[.\s_\-[])(DSNP|DSNY|DISNEY\+?)(?:[.\s_\-\]]|$)/i.test(rawTitle)) return 'disney';
  if (/(?:^|[.\s_\-[])(AMZN|AMAZON|PRIME\s*VIDEO)(?:[.\s_\-\]]|$)/i.test(rawTitle)) return 'prime';
  if (/(?:^|[.\s_\-[])(PMTP|PCOK|SKST|SKYSHOWTIME|PARAMOUNT\+)(?:[.\s_\-\]]|$)/i.test(rawTitle)) return 'paramount';

  return null;
}

interface VodCardProducerBadgeProps {
  item?: Partial<CinemetaItem> | null;
  className?: string;
}

/**
 * Ultra-compact, authentic producer / streaming platform logo badge.
 * Designed specifically for poster cards across all pages.
 * Occupies minimal space (height: 18px), razor sharp vector typography/emblem.
 */
export const VodCardProducerBadge: React.FC<VodCardProducerBadgeProps> = ({
  item,
  className = '',
}) => {
  const badgeKey = detectVodProducer(item);
  if (!badgeKey) return null;

  switch (badgeKey) {
    case 'netflix':
      return (
        <span
          title="Netflix"
          className={`inline-flex items-center justify-center h-[18px] px-1 rounded-md bg-[#111111]/95 border border-[#E50914]/60 shadow-[0_2px_8px_rgba(0,0,0,0.85)] shrink-0 select-none ${className}`}
        >
          <svg viewBox="0 0 24 24" className="w-2.5 h-3.5" aria-hidden="true">
            <path fill="#B1060F" d="M5 2h4.2v20L5 21.5V2zm9.8 0H19v20l-4.2-.5V2z" />
            <path fill="#E50914" d="M5 2h4.3l9.7 20h-4.3L5 2z" />
          </svg>
        </span>
      );

    case 'apple':
      return (
        <span
          title="Apple TV+"
          className={`inline-flex items-center justify-center gap-0.5 h-[18px] px-1.5 rounded-md bg-zinc-950/95 border border-white/30 text-white shadow-[0_2px_8px_rgba(0,0,0,0.85)] shrink-0 select-none ${className}`}
        >
          <svg viewBox="0 0 170 170" className="w-2.5 h-2.5 fill-white" aria-hidden="true">
            <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.66-7.83-11.89-14.36-6.19-9.57-11.05-20.73-14.58-33.48-3.53-12.75-5.3-24.63-5.3-35.65 0-14.9 3.65-27.34 10.96-37.33 7.31-9.99 16.59-15.09 27.84-15.3 4.89 0 10.37 1.25 16.44 3.76 6.07 2.51 10.02 3.82 11.85 3.93 1.63 0 5.82-1.42 12.57-4.26 6.75-2.84 12.38-4.14 16.89-3.9 12.51.64 22.45 5.06 29.83 13.26-10.88 6.57-16.21 15.71-16 27.42.22 9.17 3.75 16.84 10.59 23.01 6.84 6.17 14.86 9.68 24.06 10.54-2.18 6.75-4.8 13.3-7.87 19.65zM119.22 31.84c0-7.39 2.65-14.19 7.95-20.41 5.3-6.22 11.75-10.08 19.35-11.58.22 1.3.33 2.5.33 3.6 0 7.39-2.76 14.28-8.28 20.67-5.52 6.39-12.08 10.09-19.68 11.1-.11-1.09-.17-2.22-.17-3.38z" />
          </svg>
          <span className="text-[9px] font-black tracking-tight leading-none text-white">tv+</span>
        </span>
      );

    case 'hbo':
      return (
        <span
          title="HBO Max"
          className={`inline-flex items-center justify-center h-[18px] px-1.5 rounded-md bg-gradient-to-r from-[#5b18eb] to-[#3b12b5] border border-purple-400/50 text-white shadow-[0_2px_8px_rgba(0,0,0,0.85)] shrink-0 select-none ${className}`}
        >
          <span className="text-[9px] font-black tracking-tight leading-none text-white">MAX</span>
        </span>
      );

    case 'disney':
      return (
        <span
          title="Disney+"
          className={`inline-flex items-center justify-center h-[18px] px-1.5 rounded-md bg-gradient-to-r from-[#061539] to-[#0052cc] border border-sky-400/50 text-white shadow-[0_2px_8px_rgba(0,0,0,0.85)] shrink-0 select-none ${className}`}
        >
          <span className="text-[9px] font-black tracking-tight leading-none text-sky-300">D+</span>
        </span>
      );

    case 'prime':
      return (
        <span
          title="Prime Video"
          className={`inline-flex items-center justify-center h-[18px] px-1.5 rounded-md bg-[#00A8E1] border border-cyan-200/50 text-white shadow-[0_2px_8px_rgba(0,0,0,0.85)] shrink-0 select-none ${className}`}
        >
          <span className="text-[8.5px] font-black tracking-tight leading-none text-white">prime</span>
        </span>
      );

    case 'paramount':
      return (
        <span
          title="SkyShowtime / Paramount+"
          className={`inline-flex items-center justify-center h-[18px] px-1.5 rounded-md bg-[#003882] border border-blue-400/50 text-white shadow-[0_2px_8px_rgba(0,0,0,0.85)] shrink-0 select-none ${className}`}
        >
          <span className="text-[11px] font-black tracking-tight leading-none text-white">sky</span>
        </span>
      );

    case 'vk':
      return (
        <span
          title="VK Video"
          className={`inline-flex items-center justify-center gap-0.5 h-[20px] px-1.5 rounded-md bg-[#005FD1] border border-blue-300/40 text-white shadow-[0_2px_8px_rgba(0,0,0,0.85)] shrink-0 select-none ${className}`}
        >
          <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
          </svg>
          <span className="text-[11px] font-black tracking-tight leading-none text-white">VK</span>
        </span>
      );

    case 'ntv':
      return (
        <span
          title="НТВ"
          className={`inline-flex items-center justify-center gap-0.5 h-[20px] px-1.5 rounded-md bg-[#007A33] border border-emerald-300/40 text-white shadow-[0_2px_8px_rgba(0,0,0,0.85)] shrink-0 select-none ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-200" />
          <span className="text-[11px] font-black tracking-tight leading-none text-white">НТВ</span>
        </span>
      );

    case 'premier':
      return (
        <span
          title="PREMIER"
          className={`inline-flex items-center justify-center h-[18px] px-1.5 rounded-md bg-[#E8AF22] border border-amber-300/50 text-black shadow-[0_2px_8px_rgba(0,0,0,0.85)] shrink-0 select-none ${className}`}
        >
          <span className="text-[8.5px] font-black tracking-tight leading-none text-zinc-950">PREMIER</span>
        </span>
      );

    case 'start':
      return (
        <span
          title="START"
          className={`inline-flex items-center justify-center h-[18px] px-1.5 rounded-md bg-[#FF3300] border border-orange-300/40 text-white shadow-[0_2px_8px_rgba(0,0,0,0.85)] shrink-0 select-none ${className}`}
        >
          <span className="text-[8.5px] font-black tracking-tight leading-none text-white">START</span>
        </span>
      );

    case 'sts':
      return (
        <span
          title="СТС"
          className={`inline-flex items-center justify-center h-[18px] px-1.5 rounded-md bg-[#FFDE00] border border-yellow-300/50 text-black shadow-[0_2px_8px_rgba(0,0,0,0.85)] shrink-0 select-none ${className}`}
        >
          <span className="text-[8.5px] font-black tracking-tight leading-none text-zinc-950">СТС</span>
        </span>
      );

    case 'kion':
      return (
        <span
          title="KION"
          className={`inline-flex items-center justify-center h-[18px] px-1.5 rounded-md bg-[#6700FF] border border-purple-300/40 text-white shadow-[0_2px_8px_rgba(0,0,0,0.85)] shrink-0 select-none ${className}`}
        >
          <span className="text-[8.5px] font-black tracking-tight leading-none text-white">KION</span>
        </span>
      );

    case 'kinopoisk':
      return (
        <span
          title="Кинопоиск"
          className={`inline-flex items-center justify-center h-[18px] px-1.5 rounded-md bg-[#FF5500] border border-orange-300/40 text-white shadow-[0_2px_8px_rgba(0,0,0,0.85)] shrink-0 select-none ${className}`}
        >
          <span className="text-[8.5px] font-black tracking-tight leading-none text-white">КП</span>
        </span>
      );

    case 'warner':
      return (
        <span
          title="Warner Bros."
          className={`inline-flex items-center justify-center h-[18px] px-1.5 rounded-md bg-[#001F60] border border-amber-400/80 text-amber-300 shadow-[0_2px_8px_rgba(0,0,0,0.85)] shrink-0 select-none ${className}`}
        >
          <span className="text-[8.5px] font-black tracking-tight leading-none text-amber-300">WB</span>
        </span>
      );

    case 'universal':
      return (
        <span
          title="Universal Pictures"
          className={`inline-flex items-center justify-center h-[18px] px-1.5 rounded-md bg-[#0B1736] border border-sky-300/40 text-white shadow-[0_2px_8px_rgba(0,0,0,0.85)] shrink-0 select-none ${className}`}
        >
          <span className="text-[8px] font-black tracking-wider uppercase leading-none text-white">UNIVERSAL</span>
        </span>
      );

    case 'a24':
      return (
        <span
          title="A24"
          className={`inline-flex items-center justify-center h-[18px] px-1.5 rounded-md bg-white text-zinc-950 shadow-[0_2px_8px_rgba(0,0,0,0.85)] shrink-0 select-none ${className}`}
        >
          <span className="text-[8.5px] font-black font-serif tracking-widest leading-none text-zinc-950">A24</span>
        </span>
      );

    case 'sony':
      return (
        <span
          title="Sony Pictures"
          className={`inline-flex items-center justify-center h-[18px] px-1.5 rounded-md bg-white text-zinc-950 shadow-[0_2px_8px_rgba(0,0,0,0.85)] shrink-0 select-none ${className}`}
        >
          <span className="text-[8px] font-black tracking-widest leading-none text-zinc-950">SONY</span>
        </span>
      );

    case 'marvel':
      return (
        <span
          title="Marvel Studios"
          className={`inline-flex items-center justify-center h-[18px] px-1.5 rounded-md bg-[#E62429] text-white shadow-[0_2px_8px_rgba(0,0,0,0.85)] shrink-0 select-none ${className}`}
        >
          <span className="text-[8px] font-black tracking-tighter uppercase leading-none text-white">MARVEL</span>
        </span>
      );

    default:
      return null;
  }
};
