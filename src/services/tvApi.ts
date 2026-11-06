import { TvChannel, Station } from '../types/radio';
import { getCachedData, setCachedData, DEFAULT_TTL_MS } from './cacheService';

const IPTV_BASE_URL = 'https://iptv-org.github.io/iptv';
const NGRCH_RU_M3U = 'https://raw.githubusercontent.com/ngrch/iptv/main/ru.m3u';
const NGRCH_MUSIC_M3U =
  'https://raw.githubusercontent.com/ngrch/iptv/main/music.m3u';
const NGRCH_CARTOONS_M3U =
  'https://raw.githubusercontent.com/ngrch/iptv/main/cartoons.m3u';
const LOGANETTV_ALL_M3U =
  'https://raw.githubusercontent.com/loganettv/playlists/main/all.m3u';
const LOGANETTV_MEGA_M3U =
  'https://raw.githubusercontent.com/loganettv/playlists/main/mega.m3u';
const LOGANETTV_MOVIE_M3U =
  'https://raw.githubusercontent.com/loganettv/playlists/main/movie.m3u';
const LOGANETTV_SPORT_M3U =
  'https://raw.githubusercontent.com/loganettv/playlists/main/sport.m3u';
const LOGANETTV_KIDS_M3U =
  'https://raw.githubusercontent.com/loganettv/playlists/main/kids.m3u';
const LOGANETTV_LEISURE_M3U =
  'https://raw.githubusercontent.com/loganettv/playlists/main/leisure.m3u';
const LOGANETTV_STRAWBERRY_M3U =
  'https://raw.githubusercontent.com/loganettv/playlists/main/strawberry.m3u';
const SMOLNP_RU_M3U =
  'https://raw.githubusercontent.com/smolnp/IPTVru/master/IPTVru.m3u';
const FREETV_RU_M3U =
  'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_russia.m3u8';
const FREETV_RO_M3U =
  'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_romania.m3u8';
const FREETV_MD_M3U =
  'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_moldova.m3u8';
export const PAID_IEDEM_M3U_URL =
  'http://8b1c7520acc0.iedem.com/playlists/uplist/c614dffd67daf4de92e47cf6d1c9f447/playlist.m3u8';
const BUNDLED_PAID_IEDEM_M3U_PATH = '/iedem-paid.m3u8';

let globalTvChannelsMemoryCache: TvChannel[] | null = null;
let globalTvChannelsPromise: Promise<TvChannel[]> | null = null;
let paidIedemPlaylistTextCache: string | null = null;
let paidIedemPlaylistPromise: Promise<string> | null = null;

/**
 * Loads the paid iEdem M3U8 playlist (valid until 27.10.2027), using the bundled
 * /iedem-paid.m3u8 first for instant loading and falling back to the live iEdem URL via tv-proxy.
 */
export async function fetchPaidIedemPlaylistText(
  forceLive = false
): Promise<string> {
  if (!forceLive && paidIedemPlaylistTextCache) {
    return paidIedemPlaylistTextCache;
  }
  if (!forceLive && paidIedemPlaylistPromise) {
    return paidIedemPlaylistPromise;
  }

  paidIedemPlaylistPromise = (async () => {
    try {
      if (!forceLive) {
        const bundledRes = await fetch(BUNDLED_PAID_IEDEM_M3U_PATH);
        if (bundledRes.ok) {
          const text = await bundledRes.text();
          if (text.includes('#EXTM3U') && text.length > 1000) {
            paidIedemPlaylistTextCache = text;
            return text;
          }
        }
      }
      const proxyUrl = `/api/tv-proxy?url=${encodeURIComponent(PAID_IEDEM_M3U_URL)}&raw=1`;
      const liveRes = await fetch(proxyUrl);
      if (liveRes.ok) {
        const text = await liveRes.text();
        if (text.includes('#EXTM3U') && text.length > 1000) {
          paidIedemPlaylistTextCache = text;
          return text;
        }
      }
      return paidIedemPlaylistTextCache || '';
    } catch {
      return paidIedemPlaylistTextCache || '';
    } finally {
      paidIedemPlaylistPromise = null;
    }
  })();

  return paidIedemPlaylistPromise;
}

const EXCLUDED_IEDEM_GROUPS_REGEX =
  /^(?:українські|USA|беларускія|беларусь|қазақстан|казахстан|o'zbek|узбекистан|հայկական|армения|ქართული|грузия|azərbaycan|азербайджан|точик|таджикистан|ישראלי|израиль|türk|турция|polska)$/i;

/**
 * Extracts a subset of channels from the full iEdem M3U text matching a group/title predicate.
 */
function extractIedemSubsetM3u(
  fullText: string,
  predicate: (group: string, title: string) => boolean
): string {
  if (!fullText) return '';
  const lines = fullText.split(/\r?\n/);
  const out: string[] = ['#EXTM3U'];
  let curInf = '';
  let curTitle = '';
  let curGrp = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF:')) {
      curInf = line;
      const comma = line.lastIndexOf(',');
      curTitle = comma >= 0 ? line.slice(comma + 1).trim() : '';
      const grpAttr = line.match(/group-title="([^"]*)"/i);
      curGrp = grpAttr?.[1]?.trim() || '';
    } else if (line.startsWith('#EXTGRP:')) {
      curGrp = line.slice('#EXTGRP:'.length).trim();
    } else if (/^https?:\/\//i.test(line) && curInf) {
      if (!EXCLUDED_IEDEM_GROUPS_REGEX.test(curGrp) && predicate(curGrp, curTitle)) {
        out.push(curInf);
        if (curGrp) out.push(`#EXTGRP:${curGrp}`);
        out.push(line);
      }
      curInf = '';
      curTitle = '';
      curGrp = '';
    }
  }

  return out.length > 1 ? out.join('\n') : '';
}

function toIptvCountryCode(isoCode: string): string {
  const lower = isoCode.trim().toLowerCase();
  if (lower === 'gb') return 'uk';
  return lower;
}

function normalizeIsoCountryCode(code: string): string {
  const upper = code.trim().toUpperCase();
  if (upper === 'UK') return 'GB';
  return upper;
}

const REGION_TAG_TO_ISO: Record<string, string> = {
  russia: 'RU',
  romania: 'RO',
  moldova: 'MD',
  italy: 'IT',
  france: 'FR',
  germany: 'DE',
  spain: 'ES',
  uk: 'GB',
  eurasia: 'RU',
};

function extractCountryFromTvgId(
  tvgId: string,
  fallbackCountryCode: string
): string {
  if (fallbackCountryCode) {
    return normalizeIsoCountryCode(fallbackCountryCode);
  }

  const regionMatch = tvgId.match(/@([a-zA-Z]+)/);
  if (regionMatch && regionMatch[1]) {
    const mapped = REGION_TAG_TO_ISO[regionMatch[1].toLowerCase()];
    if (mapped) return mapped;
  }

  const match = tvgId.match(/\.([a-zA-Z]{2})(?:@|$)/);
  if (match && match[1]) {
    return normalizeIsoCountryCode(match[1]);
  }
  return 'XX';
}

// Dead or geo-blocked streams that redirect to block screens outside Russia
const DEAD_OR_PLACEHOLDER_PATTERNS =
  /nosignal\d*\.antenaplay\.ro|live4dai\.antenaplay\.ro|[a-z0-9-]+\.cfd\/|freeott\.top|rpprod\.hbbtv\.cdn\.cra\.cz|ucom\.am|strm\.yandex\.ru|15plusmg\.ru|31\.148\.48\.15|45\.153\.24\.78|89\.33\.29\.115|cdn\.ngenix\.net|serv30\.vintera\.tv\/restream\/1_old|vgtrkregion-reg\.cdnvideo\.ru\/vgtrk\/0\/russia24|t\.me\//i;

// Verified high-speed HD CDNs that sort to the top in Quality mode
const PREMIUM_STREAM_HOSTS =
  /rossteleccom\.net|iedem\.com|cinerama\.uz|stream\.mcquack\.net|mkpnet\.ru|linkintel\.ru|cdn\.ntv\.ru|cdn-dvr\.ntv\.ru|live\.smotrim\.ru|stream\.smotrim\.ru|thestream\.cyou|kinowalk\.hopto\.org|lbgo\.bozztv\.com|tvchannelstream1\.tvzvezda\.ru|176\.118\.197\.101|streaming102\.interskytech\.com|hls\.mirtv\.cdnvideo\.ru|edge-ar\.rcs-rds\.ro|lg\.mncdn\.com|antenaplay\.ro/i;

// Top verified Romanian & Moldovan HD channels placed at the very top of RO / MD & Global lists
const CURATED_ROMANIAN_TOP_HD_M3U = `
#EXTM3U
#EXTINF:-1 tvg-id="PRO.TV.HD.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/pro-tv-hd.jpg" group-title="General",Pro TV HD (1080p)
https://cmero-ott-live.ssl.cdn.cra.cz/channels/cme-ro-voyo-news/playlist.m3u8?offsetSeconds=0&url=0
#EXTINF:-1 tvg-id="Antena.3.CNN.HD.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/antena-3-cnn-hd.jpg" group-title="News",Antena 3 CNN (1080p)
https://live3vox.antenaplay.ro/a3free/a3free.m3u8
#EXTINF:-1 tvg-id="Digi.24.HD.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/digi-24-hd.jpg" group-title="News",Digi 24 HD (720p)
https://edge-ar.rcs-rds.ro/digi24ar/index.m3u8
#EXTINF:-1 tvg-id="TVR.1.HD.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/tvr-1-hd.jpg" group-title="General",TVR 1 HD (1080p)
https://tvr-1.lg.mncdn.com/tvr1/smil:tvr1.smil/playlist.m3u8
#EXTINF:-1 tvg-id="TVR.2.HD.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/tvr-2-hd.jpg" group-title="General",TVR 2 HD (1080p)
https://tvr-2.lg.mncdn.com/tvr2/smil:tvr2.smil/playlist.m3u8
#EXTINF:-1 tvg-id="TVR.Info.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/tvr-info.jpg" group-title="News",TVR Info HD (1080p)
https://tvr-info.lg.mncdn.com/tvrinfo/smil:tvrinfo.smil/playlist.m3u8
#EXTINF:-1 tvg-id="TVR.3.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/tvr-3.jpg" group-title="General",TVR 3 HD
https://tvr-3.lg.mncdn.com/tvr3/smil:tvr3.smil/playlist.m3u8
#EXTINF:-1 tvg-id="TVR.International.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/tvr-international.jpg" group-title="General",TVR Internațional HD
https://tvr-international.lg.mncdn.com/tvrinternational/smil:tvrinternational.smil/playlist.m3u8
#EXTINF:-1 tvg-id="Kanal.D.HD.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/kanal-d-hd.jpg" group-title="General",Kanal D România
https://stream1.kanald.ro/iphone/knd-live.m3u8
#EXTINF:-1 tvg-id="B1.TV.HD.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/b1-tv-hd.jpg" group-title="News",B1 TV HD (1080p)
https://hls02ns.antenaplay.ro/hls/b1-tv-hd/index.m3u8
#EXTINF:-1 tvg-id="Romania.TV.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/romania-tv.jpg" group-title="News",România TV
https://hls01ns.antenaplay.ro/hls/romania-tv-sd/index.m3u8
#EXTINF:-1 tvg-id="Realitatea.Plus.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/realitatea-plus.jpg" group-title="News",Realitatea Plus HD (720p)
https://stream.realitatea.net/realitatea/plus_md/ts:playlist.m3u8
#EXTINF:-1 tvg-id="Prima.News.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/prima-news.jpg" group-title="News",Prima News HD (1080p)
https://hls02ns.antenaplay.ro/hls/prima-news-hd/index.m3u8
#EXTINF:-1 tvg-id="Euronews.Romania.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/euronews-romania.jpg" group-title="News",Euronews România
https://hls02ns.antenaplay.ro/hls/euronews-ro-sd/index.m3u8
#EXTINF:-1 tvg-id="AntenaMonden.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/antena-stars-hd.jpg" group-title="Entertainment",Antena Monden HD (720p)
https://stream1.antenaplay.ro/live/AntenaMonden/playlist.m3u8
#EXTINF:-1 tvg-id="AntenaSport.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/antena-1-hd.jpg" group-title="Sports",Antena Sport HD
https://stream1.antenaplay.ro/as/AS.ro/chunklist.m3u8
#EXTINF:-1 tvg-id="Cinemaraton.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/cinemaraton.jpg" group-title="Movies",Cinemaraton Plus HD (1080p)
https://hls02ns.antenaplay.ro/hls/cinemaraton-plus-hd/index.m3u8
#EXTINF:-1 tvg-id="Kiss.TV.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/kiss-tv.jpg" group-title="Music",Kiss TV HD (1080p)
https://tv.broadcasting.ro/kisstv/a629c031-2170-4ee9-a36d-87a891aa3131.m3u8
#EXTINF:-1 tvg-id="TraLaLa.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/tralala.jpg" group-title="Kids",TraLaLa TV HD (1080p)
https://hls01ns.antenaplay.ro/hls/tralala-hd/index.m3u8
#EXTINF:-1 tvg-id="TraLaLa.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/tralala.jpg" group-title="Kids",TraLaLa Desene Animate HD (1080p)
https://hls01ns.antenaplay.ro/hls/tralala-desene-animate-hd/index.m3u8
#EXTINF:-1 tvg-id="Travel.Mix.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/travel-mix.jpg" group-title="Documentary",Travel Mix HD (1080p)
https://hls02ns.antenaplay.ro/hls/travel-mix-hd/index.m3u8
#EXTINF:-1 tvg-id="ViasatHistory.ro" tvg-logo="https://ngrch.github.io/iptv/logos/viju_history.png" group-title="Documentary",Viasat History HD
https://stream8.cinerama.uz/1046/index.m3u8
#EXTINF:-1 tvg-id="ViasatExplore.ro" tvg-logo="https://ngrch.github.io/iptv/logos/viju_explore.png" group-title="Documentary",Viasat Explore HD
https://flussonic.mkpnet.ru/tv-7c57a4c3f9a896ea/video.m3u8
#EXTINF:-1 tvg-id="ViasatNature.ro" tvg-logo="https://ngrch.github.io/iptv/logos/viju_nature.png" group-title="Documentary",Viasat Nature HD
https://stream3.cinerama.uz/1228/mono.m3u8
#EXTINF:-1 tvg-id="NationalGeographic.ro" tvg-logo="https://ngrch.github.io/iptv/logos/discovery.png" group-title="Documentary",National Geographic HD (1080p)
https://stream8.cinerama.uz/1041/index.m3u8
#EXTINF:-1 tvg-id="NatGeoWild.ro" tvg-logo="https://ngrch.github.io/iptv/logos/viju_nature.png" group-title="Documentary",National Geographic Wild HD (1080p)
https://stream8.cinerama.uz/1042/index.m3u8
#EXTINF:-1 tvg-id="DiscoveryChannel.ro" tvg-logo="https://ngrch.github.io/iptv/logos/discovery.png" group-title="Documentary",Discovery Channel HD (1080p)
https://stream8.cinerama.uz/1039/index.m3u8
#EXTINF:-1 tvg-id="AnimalPlanet.ro" tvg-logo="https://ngrch.github.io/iptv/logos/viju_nature.png" group-title="Documentary",Animal Planet HD (1080p)
https://stream8.cinerama.uz/1043/index.m3u8
#EXTINF:-1 tvg-id="Aleph.News.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/aleph-news.jpg" group-title="News",Aleph News HD (720p)
https://stream-aleph.m.ro/Aleph/ngrp:Alephnewsmain.stream_all/playlist.m3u8
#EXTINF:-1 tvg-id="Aleph.Business.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/aleph-news.jpg" group-title="Business",Aleph Business HD (1080p)
https://streamw.m.ro/Aleph/ngrp:Alephbiz.stream_all/playlist.m3u8
#EXTINF:-1 tvg-id="Moldova1.md" tvg-logo="https://trm.md/favicon.ico" group-title="General",Moldova 1 HD (1080p)
https://v0.trm.md/static/streaming-playlists/hls/9b79338b-1870-4cd7-91d4-0f6ce5cac7ca/master.m3u8
#EXTINF:-1 tvg-id="Moldova2.md" tvg-logo="https://trm.md/favicon.ico" group-title="General",Moldova 2 HD (1080p)
https://v0.trm.md/static/streaming-playlists/hls/d5fafab0-9c37-4746-9e7a-b2d6c0427015/master.m3u8
#EXTINF:-1 tvg-id="TVR.Moldova.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/tvr-moldova.jpg" group-title="General",TVR Moldova HD (1080p)
https://tvr-moldova.lg.mncdn.com/tvrmoldova/smil:tvrmoldova.smil/chunklist.m3u8
`;

// Top verified Russian Full HD federal channels placed at the very top of RU & Global lists
const CURATED_RUSSIAN_TOP_HD_M3U = `
#EXTM3U
#EXTINF:-1 tvg-id="pervy" tvg-logo="https://ngrch.github.io/iptv/logos/perviy.png" group-title="Основные",Первый канал HD / Channel One HD (1080p)
https://stream3.cinerama.uz/1214/mono.m3u8
#EXTINF:-1 tvg-id="pervy" tvg-logo="https://ngrch.github.io/iptv/logos/perviy.png" group-title="Основные",Первый канал / Channel One (Russia) (1080p)
https://flussonic.mkpnet.ru/tv-4f9598ab5f91dca4/video.m3u8
#EXTINF:-1 tvg-id="pervy" tvg-logo="https://ngrch.github.io/iptv/logos/perviy.png" group-title="Основные",Первый канал Европа / Channel One Europe (HD)
https://streaming.thestream.cyou/live/210-req_offset_28000000-req_window_0-3k_v5.m3u8
#EXTINF:-1 tvg-id="rossia1" tvg-logo="https://ngrch.github.io/iptv/logos/rossiya_1.png" group-title="Основные",Россия 1 HD / Russia 1 HD (1080p)
https://live.smotrim.ru/vgtrk/0/russia1-hd/index.m3u8
#EXTINF:-1 tvg-id="rossia1" tvg-logo="https://ngrch.github.io/iptv/logos/rossiya_1.png" group-title="Основные",Россия 1 (2) / Russia 1 (1080p)
https://stream8.cinerama.uz/1020/index.m3u8
#EXTINF:-1 tvg-id="ntv" tvg-logo="https://ngrch.github.io/iptv/logos/ntv.png" group-title="Основные",НТВ HD / NTV HD (1080p)
https://cdn.ntv.ru/ntv-msk_hd/index.m3u8
#EXTINF:-1 tvg-id="ntv" tvg-logo="https://ngrch.github.io/iptv/logos/ntv.png" group-title="Основные",НТВ (2) / NTV (HD)
https://cdn.ntv.ru/ntv0/index.m3u8
#EXTINF:-1 tvg-id="sts" tvg-logo="https://ngrch.github.io/iptv/logos/sts.png" group-title="Основные",СТС HD / STS HD (1080p)
https://flussonic.linkintel.ru/sts/index.m3u8
#EXTINF:-1 tvg-id="tnt" tvg-logo="https://ngrch.github.io/iptv/logos/tnt.png" group-title="Основные",ТНТ HD / TNT Russia HD (1080p)
https://bl.rutube.ru/livestream/546602986e6a424d74d594876ddb3f04/index.m3u8?s=K-z3nz49R1oGQ-5yPSd8pg&e=2082157024&scheme=https
#EXTINF:-1 tvg-id="tnt" tvg-logo="https://ngrch.github.io/iptv/logos/tnt.png" group-title="Основные",ТНТ (2) / TNT Russia (Live)
http://stream.mcquack.net/135/index.m3u8
#EXTINF:-1 tvg-id="match-tv" tvg-logo="https://ngrch.github.io/iptv/logos/match.png" group-title="Спортивные",Матч! ТВ / Match TV (HD)
http://stream.mcquack.net/169/index.m3u8
#EXTINF:-1 tvg-id="piatnica" tvg-logo="https://ngrch.github.io/iptv/logos/pyatnica.png" group-title="Развлекательные",Пятница! / Friday! (HD)
http://stream.mcquack.net/181/index.m3u8
#EXTINF:-1 tvg-id="tv3-ru" tvg-logo="https://ngrch.github.io/iptv/logos/tv3.png" group-title="Развлекательные",ТВ-3 HD / TV-3 HD (1080p)
http://stream.mcquack.net/136/index.m3u8
#EXTINF:-1 tvg-id="subbota" tvg-logo="https://ngrch.github.io/iptv/logos/subbota.png" group-title="Развлекательные",Суббота! HD / Subbota! HD (1080p)
http://stream.mcquack.net/269/index.m3u8
#EXTINF:-1 tvg-id="domashny" tvg-logo="https://ngrch.github.io/iptv/logos/domashniy.png" group-title="Развлекательные",Домашний / Domashniy (HD)
http://stream.mcquack.net/227/index.m3u8
#EXTINF:-1 tvg-id="zvezda" tvg-logo="https://ngrch.github.io/iptv/logos/zvezda.png" group-title="Основные",Звезда HD / Zvezda HD (1080p)
https://tvchannelstream1.tvzvezda.ru/cdn/tvzvezda/playlist_hdhigh.m3u8
#EXTINF:-1 tvg-id="rossia-k" tvg-logo="https://ngrch.github.io/iptv/logos/rossiya_k.png" group-title="Основные",Россия-Культура HD / Russia-K (1080p)
https://live.smotrim.ru/vgtrk/0/kultura-hd/index.m3u8
`;

// Bilingual Cyrillic names for popular Russian channels so both Cyrillic and Latin searches match
const RUSSIAN_BILINGUAL_NAMES: Record<string, string> = {
  'STS HD': 'СТС HD (STS HD)',
  'TNT (Russia)': 'ТНТ (TNT Russia)',
  'TNT (Russia) HD': 'ТНТ HD (TNT Russia HD)',
  'TV-3 HD': 'ТВ-3 HD (TV-3)',
  'Subbota! HD': 'Суббота! HD (Subbota)',
  'Friday!': 'Пятница! (Friday!)',
  Domashniy: 'Домашний (Domashniy)',
  'Dom kino Premium HD': 'Дом Кино Премиум HD (Dom Kino)',
  'Dom kino': 'Дом Кино (Dom Kino)',
  'Amedia Hit': 'Амедиа Хит HD (Amedia Hit)',
  'Amedia Premium': 'Амедиа Премиум HD (Amedia Premium)',
  'viju+ Megahit HD': 'viju+ Мегахит HD (Megahit)',
  'viju+ Premiere HD': 'viju+ Премьера HD (Premiere)',
  'viju+ Comedy HD': 'viju+ Комедия HD (Comedy)',
  'viju+ Planet HD': 'viju+ Планета HD (Planet)',
  'viju+ Serial HD': 'viju+ Сериал HD (Serial)',
  'viju TV1000': 'viju TV1000 (ТВ1000)',
  'viju TV1000 action': 'viju TV1000 Action (Экшн)',
  'Discovery Channel (Russia)': 'Discovery Channel Россия HD',
  'Animal Planet (Russia)': 'Animal Planet Россия HD',
  'Investigation Discovery (Russia)': 'Investigation Discovery Россия HD',
  'TLC (Russia)': 'TLC Россия HD',
  'Eurosport 1 Russia': 'Eurosport 1 Россия HD',
  'Eurosport 2 Russia': 'Eurosport 2 Россия HD',
  'Setanta Sports 1 Eurasia': 'Setanta Sports 1 Евразия HD',
  'Setanta Sports 2 Eurasia': 'Setanta Sports 2 Евразия HD',
  'Okko Prajm Sport': 'Okko Прайм Спорт HD',
  'Match! Boets': 'Матч! Боец (Match Boets)',
  'NTV Series': 'НТВ Сериал (NTV Series)',
  'NTV Svoya igra': 'НТВ Своя Игра HD',
  'Perviy otdel': 'НТВ Первый отдел HD',
  Nevskiy: 'НТВ Невский HD',
  'Skoraya pomoshch': 'НТВ Скорая помощь HD',
  Shef: 'НТВ Шеф HD',
  Pes: 'НТВ Пёс HD',
  Balabol: 'НТВ Балабол HD',
  '5 minut tishiny': 'НТВ 5 минут тишины HD',
  Kinokomedija: 'Кинокомедия (Kinokomedia)',
  Kinopokaz: 'Кинопоказ (Kinopokaz)',
  Kinosemja: 'Киносемья (Kinosemya)',
  KinoHit: 'Кинохит (Kinohit)',
  Kinouzhas: 'Киноужас (Kinouzhas)',
  'Komediynoe HD': 'Комедийное HD',
  'Ostrosyuzhetnoye HD': 'Остросюжетное HD',
  'Premialnoe HD': 'Премиальное HD',
  'Hit HD': 'Хит HD (Hit HD)',
  'Blokbaster HD': 'Блокбастер HD (Blockbuster)',
  'Evrokino HD': 'Еврокино HD (Evrokino)',
  'Dorama HD': 'Дорама HD (Dorama)',
  'Russkiy Bestseller': 'Русский Бестселлер',
  'Russkiy Detektiv': 'Русский Детектив',
  'Rodnoe Kino': 'Родное Кино',
  'Muzhskoe kino': 'Мужское Кино',
  'Nashe muzhskoe HD': 'Наше Мужское HD',
  'Muzyka Pervogo': 'Музыка Первого',
  '1HD Music Television': '1HD Music Television (Музыка HD)',
};

const FALLBACK_LOGO_RULES: Array<[RegExp, string]> = [
  [/^Первый канал|^Первый\b|Channel One/i, 'https://ngrch.github.io/iptv/logos/perviy.png'],
  [/^Россия 1\b|Russia 1/i, 'https://ngrch.github.io/iptv/logos/rossiya_1.png'],
  [/^Россия 24|Russia 24/i, 'https://ngrch.github.io/iptv/logos/rossiya_24.png'],
  [/^Россия[ -]?К|Культура/i, 'https://ngrch.github.io/iptv/logos/rossiya_k.png'],
  [/^НТВ Хит/i, 'https://ngrch.github.io/iptv/logos/ntv_hit.png'],
  [/^НТВ\b|^NTV/i, 'https://ngrch.github.io/iptv/logos/ntv.png'],
  [/^ТНТ4|TNT4/i, 'https://ngrch.github.io/iptv/logos/tnt4.png'],
  [/^ТНТ\b|^TNT/i, 'https://ngrch.github.io/iptv/logos/tnt.png'],
  [/^СТС Love|STS Love/i, 'https://ngrch.github.io/iptv/logos/sts_love.png'],
  [/^СТС\b|^STS/i, 'https://ngrch.github.io/iptv/logos/sts.png'],
  [/^РЕН ТВ|REN TV/i, 'https://ngrch.github.io/iptv/logos/ren_tv.png'],
  [/^Пятница|Pyatnitsa|Friday!/i, 'https://ngrch.github.io/iptv/logos/pyatnica.png'],
  [/^Матч|Match/i, 'https://ngrch.github.io/iptv/logos/match.png'],
  [/^ТВ[ -]?3\b|TV-3/i, 'https://ngrch.github.io/iptv/logos/tv3.png'],
  [/^Домашний|Domashniy/i, 'https://ngrch.github.io/iptv/logos/domashniy.png'],
  [/^Звезда|Zvezda/i, 'https://ngrch.github.io/iptv/logos/zvezda.png'],
  [/^Карусель|Karusel/i, 'https://ngrch.github.io/iptv/logos/karusel.png'],
  [/^ТВ Центр|ТВЦ|TV Center/i, 'https://ngrch.github.io/iptv/logos/tv_tsentr.png'],
  [/^Суббота|Subbota/i, 'https://ngrch.github.io/iptv/logos/subbota.png'],
  [/^Муз[ -]?ТВ|Muz-TV/i, 'https://ngrch.github.io/iptv/logos/muz_tv.png'],
  [/^Пятый|5 канал/i, 'https://ngrch.github.io/iptv/logos/pyatiy.png'],
  [/^ОТР\b/i, 'https://ngrch.github.io/iptv/logos/otr.png'],
  [/^Мир\b|^Мир 24/i, 'https://ngrch.github.io/iptv/logos/mir.png'],
  [/^Спас\b/i, 'https://ngrch.github.io/iptv/logos/spas.png'],
  [/^Ю\b|^Ю-ТВ/i, 'https://ngrch.github.io/iptv/logos/you.png'],
  [/^Че!?$|^Че\b/i, 'https://ngrch.github.io/iptv/logos/che.png'],
  [/^Дом Кино Премиум/i, 'https://ngrch.github.io/iptv/logos/dom_premium.png'],
  [/^Дом Кино/i, 'https://ngrch.github.io/iptv/logos/dom_kino.png'],
  [/^Кинопремьера/i, 'https://ngrch.github.io/iptv/logos/kinopremiera.png'],
  [/^Кинохит/i, 'https://ngrch.github.io/iptv/logos/kinohit.png'],
  [/^Киносемья/i, 'https://ngrch.github.io/iptv/logos/kinoseria.png'],
  [/^Кинокомедия/i, 'https://ngrch.github.io/iptv/logos/kinokomedia.png'],
  [/^Мужское Кино/i, 'https://ngrch.github.io/iptv/logos/muzhskoe.png'],
  [/^Русский Детектив/i, 'https://ngrch.github.io/iptv/logos/ru_detectiv.png'],
  [/^2x2|2х2/i, 'https://ngrch.github.io/iptv/logos/2x2.png'],
  [/^Мосфильм/i, 'https://ngrch.github.io/iptv/logos/mosfilm.png'],
  [/^Победа/i, 'https://ngrch.github.io/iptv/logos/pobeda.png'],
  [/^Солнце/i, 'https://ngrch.github.io/iptv/logos/solnce.png'],
  [/^viju TV1000 Action/i, 'https://ngrch.github.io/iptv/logos/viju_action.png'],
  [/^viju TV1000 Русское/i, 'https://ngrch.github.io/iptv/logos/viju_russkoe.png'],
  [/^viju TV1000/i, 'https://ngrch.github.io/iptv/logos/viju_tv1000.png'],
  [/^viju Explore/i, 'https://ngrch.github.io/iptv/logos/viju_explore.png'],
  [/^viju History/i, 'https://ngrch.github.io/iptv/logos/viju_history.png'],
  [/^viju Nature/i, 'https://ngrch.github.io/iptv/logos/viju_nature.png'],
  [/^Discovery/i, 'https://ngrch.github.io/iptv/logos/discovery.png'],
  [/^Pro\s*TV\b/i, 'https://static.cinemagia.ro/img/tv_station/pro-tv-hd.jpg'],
  [/^Antena\s*1\b/i, 'https://static.cinemagia.ro/img/tv_station/antena-1-hd.jpg'],
  [/^Antena\s*3\b/i, 'https://static.cinemagia.ro/img/tv_station/antena-3-cnn-hd.jpg'],
  [/^Antena\s*Stars/i, 'https://static.cinemagia.ro/img/tv_station/antena-stars-hd.jpg'],
  [/^Digi\s*24/i, 'https://static.cinemagia.ro/img/tv_station/digi-24-hd.jpg'],
  [/^TVR\s*1\b/i, 'https://static.cinemagia.ro/img/tv_station/tvr-1-hd.jpg'],
  [/^TVR\s*2\b/i, 'https://static.cinemagia.ro/img/tv_station/tvr-2-hd.jpg'],
  [/^TVR\s*3\b/i, 'https://static.cinemagia.ro/img/tv_station/tvr-3.jpg'],
  [/^TVR\s*Info/i, 'https://static.cinemagia.ro/img/tv_station/tvr-info.jpg'],
  [/^TVR\s*Moldova/i, 'https://static.cinemagia.ro/img/tv_station/tvr-moldova.jpg'],
  [/^Kanal\s*D\b/i, 'https://static.cinemagia.ro/img/tv_station/kanal-d-hd.jpg'],
  [/^B1\s*TV/i, 'https://static.cinemagia.ro/img/tv_station/b1-tv-hd.jpg'],
  [/^Rom[aâ]nia\s*TV/i, 'https://static.cinemagia.ro/img/tv_station/romania-tv.jpg'],
  [/^Realitatea\s*Plus/i, 'https://static.cinemagia.ro/img/tv_station/realitatea-plus.jpg'],
  [/^Prima\s*TV/i, 'https://static.cinemagia.ro/img/tv_station/prima-tv-hd.jpg'],
  [/^Prima\s*News/i, 'https://static.cinemagia.ro/img/tv_station/prima-news.jpg'],
  [/^Happy\s*Channel/i, 'https://static.cinemagia.ro/img/tv_station/happy-channel-hd.jpg'],
  [/^Kiss\s*TV/i, 'https://static.cinemagia.ro/img/tv_station/kiss-tv.jpg'],
  [/^Rock\s*TV/i, 'https://static.cinemagia.ro/img/tv_station/rock-tv-hd.jpg'],
  [/^Cinemaraton/i, 'https://static.cinemagia.ro/img/tv_station/cinemaraton.jpg'],
  [/^HBO\s*2/i, 'https://static.cinemagia.ro/img/tv_station/hbo-2-hd.jpg'],
  [/^HBO\s*3/i, 'https://static.cinemagia.ro/img/tv_station/hbo-3-hd.jpg'],
  [/^HBO\b/i, 'https://static.cinemagia.ro/img/tv_station/hbo-hd.jpg'],
  [/^Cinemax/i, 'https://static.cinemagia.ro/img/tv_station/cinemax-hd.jpg'],
  [/^Pro\s*Cinema/i, 'https://static.cinemagia.ro/img/tv_station/pro-cinema.jpg'],
  [/^AMC\b/i, 'https://static.cinemagia.ro/img/tv_station/amc.jpg'],
  [/^AXN/i, 'https://static.cinemagia.ro/img/tv_station/axn-hd.jpg'],
  [/^Prima\s*Sport/i, 'https://static.cinemagia.ro/img/tv_station/look-sport-plus.jpg'],
  [/^DIGI\s*World/i, 'https://static.cinemagia.ro/img/tv_station/digi-world-hd.jpg'],
  [/^DIGI\s*Life/i, 'https://static.cinemagia.ro/img/tv_station/digi-life-hd.jpg'],
  [/^DIGI\s*Animal/i, 'https://static.cinemagia.ro/img/tv_station/digi-animal-world-hd.jpg'],
  [/^Moldova\s*1/i, 'https://trm.md/favicon.ico'],
  [/^Moldova\s*2/i, 'https://trm.md/favicon.ico'],
  [/^Viasat\s*History/i, 'https://ngrch.github.io/iptv/logos/viju_history.png'],
  [/^Viasat\s*Nature/i, 'https://ngrch.github.io/iptv/logos/viju_nature.png'],
  [/^Viasat\s*Kino/i, 'https://ngrch.github.io/iptv/logos/viju_tv1000.png'],
  [/^Viasat\s*Epic/i, 'https://ngrch.github.io/iptv/logos/viju_tv1000.png'],
  [/^Euronews/i, 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Euronews._2016_alternative_logo.png/240px-Euronews._2016_alternative_logo.png'],
  [/^Известия/i, 'https://ngrch.github.io/iptv/logos/izvestia.png'],
  [/^РБК/i, 'https://ngrch.github.io/iptv/logos/rbk.png'],
  [/^National\s*Geographic/i, 'https://ngrch.github.io/iptv/logos/discovery.png'],
];

/**
 * 30 Smart Favorite TV channels for the user's paid iEdem playlist:
 * - #1 to #15: Exact 15 channels from the user's Favourites screenshot in exact order
 * - #16 to #30: Top 15 most popular Russian channels in maximum quality (HD orig / FHD, no +2/+4 timezones)
 */
export const DEFAULT_SMART_FAVORITE_TV_CHANNELS: TvChannel[] = [
  {
    id: 'Первый канал HD orig_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/7253/index.m3u8',
    name: 'Первый канал HD orig',
    logo: 'https://ngrch.github.io/iptv/logos/perviy.png',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/204/index.m3u8',
    group: 'HD Orig',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 15000,
    tvgRec: 7,
  },
  {
    id: 'Россия 1 FHD_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/2409/index.m3u8',
    name: 'Россия 1 FHD',
    logo: 'https://ngrch.github.io/iptv/logos/rossiya_1.png',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/205/index.m3u8',
    group: 'HD Orig',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 14990,
    tvgRec: 7,
  },
  {
    id: 'РЕН ТВ HD orig_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/9002/index.m3u8',
    name: 'РЕН ТВ HD orig',
    logo: 'https://ngrch.github.io/iptv/logos/ren_tv.png',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/2024/index.m3u8',
    group: 'HD Orig',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 14980,
    tvgRec: 7,
  },
  {
    id: 'НТВ orig_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/9203/index.m3u8',
    name: 'НТВ orig',
    logo: 'https://ngrch.github.io/iptv/logos/ntv.png',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/213/index.m3u8',
    group: 'HD Orig',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 14970,
    tvgRec: 7,
  },
  {
    id: 'Пятница! HD_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/5031/index.m3u8',
    name: 'Пятница! HD',
    logo: 'https://ngrch.github.io/iptv/logos/pyatnica.png',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/5031/index.m3u8',
    group: 'HD',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 14960,
    tvgRec: 3,
  },
  {
    id: 'Euronews Россия orig_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/9215/index.m3u8',
    name: 'Euronews Россия orig',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Euronews._2016_alternative_logo.png/240px-Euronews._2016_alternative_logo.png',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/9215/index.m3u8',
    group: 'HD Orig',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 14950,
    tvgRec: 7,
  },
  {
    id: 'Известия orig_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/9216/index.m3u8',
    name: 'Известия orig',
    logo: 'https://ngrch.github.io/iptv/logos/izvestia.png',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/18039/index.m3u8',
    group: 'HD Orig',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 14940,
    tvgRec: 7,
  },
  {
    id: 'РБК FHD_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/2404/index.m3u8',
    name: 'РБК FHD',
    logo: 'https://ngrch.github.io/iptv/logos/rbk.png',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/2404/index.m3u8',
    group: 'HD Orig',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 14930,
    tvgRec: 7,
  },
  {
    id: 'СТС HD orig_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/9000/index.m3u8',
    name: 'СТС HD orig',
    logo: 'https://ngrch.github.io/iptv/logos/sts.png',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/9000/index.m3u8',
    group: 'HD Orig',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 14920,
    tvgRec: 7,
  },
  {
    id: 'Известия HD_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/18039/index.m3u8',
    name: 'Известия HD',
    logo: 'https://ngrch.github.io/iptv/logos/izvestia.png',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/18039/index.m3u8',
    group: 'новости',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 14910,
    tvgRec: 7,
  },
  {
    id: 'ТНТ FHD_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/2417/index.m3u8',
    name: 'ТНТ FHD',
    logo: 'https://ngrch.github.io/iptv/logos/tnt.png',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/10024/index.m3u8',
    group: 'HD Orig',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 14900,
    tvgRec: 7,
  },
  {
    id: 'ТНТ4_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/104/index.m3u8',
    name: 'ТНТ4',
    logo: 'https://ngrch.github.io/iptv/logos/tnt4.png',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/104/index.m3u8',
    group: 'развлекательные',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 14890,
    tvgRec: 7,
  },
  {
    id: 'VF Орел и решка_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/31476/index.m3u8',
    name: 'VF Орел и решка',
    logo: '',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/31476/index.m3u8',
    group: 'развлекательные',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 14880,
    tvgRec: 3,
  },
  {
    id: 'Кухня HD_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/15132/index.m3u8',
    name: 'Кухня HD',
    logo: '',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/15132/index.m3u8',
    group: 'развлекательные',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 14870,
    tvgRec: 3,
  },
  {
    id: 'VF Юмор 18+_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/16137/index.m3u8',
    name: 'VF Юмор 18+',
    logo: '',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/16137/index.m3u8',
    group: 'развлекательные',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 14860,
    tvgRec: 3,
  },
  {
    id: 'Pro TV Chisinau HD MD_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/19452/index.m3u8',
    name: 'Pro TV Chisinau HD MD',
    logo: 'https://static.cinemagia.ro/img/tv_station/pro-tv-hd.jpg',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/19452/index.m3u8',
    group: 'moldovenească',
    countryCode: 'MD',
    resolution: '1080P',
    resolutionHeight: 14850,
    tvgRec: 7,
  },
  {
    id: 'Pro TV RO_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/6997/index.m3u8',
    name: 'Pro TV RO',
    logo: 'https://static.cinemagia.ro/img/tv_station/pro-tv-hd.jpg',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/7055/index.m3u8',
    group: 'moldovenească',
    countryCode: 'RO',
    resolution: '1080P',
    resolutionHeight: 14840,
    tvgRec: 7,
  },
  {
    id: 'DIGI 24 HD RO_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/7009/index.m3u8',
    name: 'DIGI 24 HD RO',
    logo: 'https://static.cinemagia.ro/img/tv_station/digi-24-hd.jpg',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/7009/index.m3u8',
    group: 'moldovenească',
    countryCode: 'RO',
    resolution: '1080P',
    resolutionHeight: 14830,
    tvgRec: 7,
  },
  {
    id: 'Antena 1 HD RO_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/7002/index.m3u8',
    name: 'Antena 1 HD RO',
    logo: 'https://static.cinemagia.ro/img/tv_station/antena-1-hd.jpg',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/7002/index.m3u8',
    group: 'moldovenească',
    countryCode: 'RO',
    resolution: '1080P',
    resolutionHeight: 14820,
    tvgRec: 7,
  },
  {
    id: 'HBO HD RO_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/6986/index.m3u8',
    name: 'HBO HD RO',
    logo: 'https://static.cinemagia.ro/img/tv_station/hbo-hd.jpg',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/6986/index.m3u8',
    group: 'moldovenească',
    countryCode: 'RO',
    resolution: '1080P',
    resolutionHeight: 14810,
    tvgRec: 7,
  },
  {
    id: 'Кинопремьера HD orig_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/9020/index.m3u8',
    name: 'Кинопремьера HD orig',
    logo: 'https://ngrch.github.io/iptv/logos/kinopremiera.png',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/224/index.m3u8',
    group: 'HD Orig',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 14800,
    tvgRec: 7,
  },
  {
    id: 'Viju+ Megahit HD orig_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/5081/index.m3u8',
    name: 'Viju+ Megahit HD orig',
    logo: 'https://ngrch.github.io/iptv/logos/viju_megahit.png',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/201/index.m3u8',
    group: 'HD Orig',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 14790,
    tvgRec: 7,
  },
  {
    id: 'Viju+ Premiere HD orig_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/5079/index.m3u8',
    name: 'Viju+ Premiere HD orig',
    logo: 'https://ngrch.github.io/iptv/logos/viju_premiere.png',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/202/index.m3u8',
    group: 'HD Orig',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 14780,
    tvgRec: 7,
  },
  {
    id: 'Viju+ Serial HD orig_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/9245/index.m3u8',
    name: 'Viju+ Serial HD orig',
    logo: 'https://ngrch.github.io/iptv/logos/viju_serial.png',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/2443/index.m3u8',
    group: 'HD Orig',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 14770,
    tvgRec: 7,
  },
  {
    id: 'Amedia Premium FHD orig_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/9233/index.m3u8',
    name: 'Amedia Premium FHD orig',
    logo: 'https://ngrch.github.io/iptv/logos/amedia_premium.png',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/229/index.m3u8',
    group: 'HD Orig',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 14760,
    tvgRec: 7,
  },
  {
    id: 'Amedia Hit HD orig_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/9070/index.m3u8',
    name: 'Amedia Hit HD orig',
    logo: 'https://ngrch.github.io/iptv/logos/amedia_hit.png',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/6010/index.m3u8',
    group: 'HD Orig',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 14750,
    tvgRec: 7,
  },
  {
    id: 'Кинохит orig_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/9128/index.m3u8',
    name: 'Кинохит orig',
    logo: 'https://ngrch.github.io/iptv/logos/kinohit.png',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/7250/index.m3u8',
    group: 'HD Orig',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 14740,
    tvgRec: 7,
  },
  {
    id: 'Остросюжетное HD orig_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/9044/index.m3u8',
    name: 'Остросюжетное HD orig',
    logo: 'https://ngrch.github.io/iptv/logos/ostrosyuzhetnoe.png',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/904/index.m3u8',
    group: 'HD Orig',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 14730,
    tvgRec: 7,
  },
  {
    id: 'VF Netflix_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/19427/index.m3u8',
    name: 'VF Netflix',
    logo: '',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/19427/index.m3u8',
    group: 'кино',
    countryCode: 'RU',
    resolution: '1080P',
    resolutionHeight: 14720,
    tvgRec: 3,
  },
  {
    id: 'VF Кино 4K_http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/11114/index.m3u8',
    name: 'VF Кино 4K',
    logo: '',
    url: 'http://f88e89c9.rossteleccom.net/iptv/5FSQ7FGUKA3FRZ/11114/index.m3u8',
    group: '4K',
    countryCode: 'RU',
    resolution: '4K',
    resolutionHeight: 14710,
    tvgRec: 3,
  },
];

const SMART_FAVORITE_URL_SCORE = new Map<string, number>(
  DEFAULT_SMART_FAVORITE_TV_CHANNELS.map((ch, idx) => [
    ch.url,
    15000 - idx * 10,
  ])
);

function classifyMoldoveneascaGroup(rawTitle: string): string {
  const t = rawTitle.toLowerCase();
  if (
    /\b(hbo|cinemax|pro cinema|amc|axn|filmbox|viasat kino|epic drama|cinema 1|bollywood|kinokomed|nostalgia|acasa|happy)\b/i.test(
      t
    )
  ) {
    return 'Movies';
  }
  if (/\b(sport|setanta|premier liga|la liga|eurosport|fight|we sport)\b/i.test(t)) {
    return 'Sports';
  }
  if (
    /\b(discovery|viasat nature|viasat history|viasat explore|digi world|digi life|digi animal|bbc earth|history|love nature|docubox|agro|travel)\b/i.test(
      t
    )
  ) {
    return 'Documentary';
  }
  if (/\b(digi 24|euronews|news|moldova 24|global 24|cotidianul|privesc|info)\b/i.test(t)) {
    return 'News';
  }
  if (
    /\b(duck tv|da vinci|nickelodeon|nick|cartoon|minimax|jimjam|gurinel|boing|trala)\b/i.test(
      t
    )
  ) {
    return 'Kids';
  }
  if (
    /\b(music|u tv|utv|balkanika|hora tv|noroc|tezaur|inedit|busuioc|etno|taraf|favorit|zutv|kiss)\b/i.test(
      t
    )
  ) {
    return 'Music';
  }
  if (/\b(tlc|e!|fashion|comedy|exclusiv|zona m)\b/i.test(t)) {
    return 'Entertainment';
  }
  return 'General';
}

function resolveFallbackLogo(channelName: string, existingLogo: string): string {
  for (const [pattern, logoUrl] of FALLBACK_LOGO_RULES) {
    if (pattern.test(channelName)) {
      if (
        !existingLogo ||
        /iptvx\.one|imgur\.com|wikia\.nocookie\.net/i.test(existingLogo)
      ) {
        return logoUrl;
      }
    }
  }
  return existingLogo || '';
}

export function parseM3uPlaylist(
  m3uText: string,
  fallbackCountryCode = '',
  options?: { isCustomImport?: boolean }
): TvChannel[] {
  const isCustomImport = Boolean(options?.isCustomImport);
  const lines = m3uText.split(/\r?\n/);
  const channels: TvChannel[] = [];
  const seenUrls = new Set<string>();

  let pendingMeta: {
    tvgId: string;
    logo: string;
    group: string;
    rawTitle: string;
    httpReferrer: string;
    httpUserAgent: string;
    tvgRec: number;
    catchup: string;
    catchupSource: string;
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/i);
      const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
      const groupMatch = line.match(/group-title="([^"]*)"/i);
      const refMatch = line.match(/http-referrer="([^"]*)"/i);
      const uaMatch = line.match(/http-user-agent="([^"]*)"/i);
      const recMatch = line.match(
        /(?:tvg-rec|catchup-days|timeshift)="?(\d+)"?/i
      );
      const catchupMatch = line.match(/catchup="([^"]*)"/i);
      const catchupSourceMatch = line.match(/catchup-source="([^"]*)"/i);
      const commaIndex = line.lastIndexOf(',');
      const rawTitle =
        commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : 'TV Channel';

      pendingMeta = {
        tvgId: tvgIdMatch?.[1]?.trim() || '',
        logo: logoMatch?.[1]?.trim() || '',
        group: groupMatch?.[1]?.trim() || '',
        rawTitle,
        httpReferrer: refMatch?.[1]?.trim() || '',
        httpUserAgent: uaMatch?.[1]?.trim() || '',
        tvgRec: recMatch?.[1] ? parseInt(recMatch[1], 10) : 7,
        catchup: catchupMatch?.[1]?.trim() || '',
        catchupSource: catchupSourceMatch?.[1]?.trim() || '',
      };
      continue;
    }

    // iEdem.TV / Edem playlists specify category via #EXTGRP:<CategoryName>
    if (line.startsWith('#EXTGRP:') && pendingMeta) {
      const extGrp = line.slice('#EXTGRP:'.length).trim();
      if (extGrp && !pendingMeta.group) {
        pendingMeta.group = extGrp;
      }
      continue;
    }

    if (line.startsWith('#EXTVLCOPT:') && pendingMeta) {
      const opt = line.slice('#EXTVLCOPT:'.length).trim();
      if (opt.toLowerCase().startsWith('http-referrer=')) {
        pendingMeta.httpReferrer = opt.slice('http-referrer='.length).trim();
      } else if (opt.toLowerCase().startsWith('http-user-agent=')) {
        pendingMeta.httpUserAgent = opt.slice('http-user-agent='.length).trim();
      }
      continue;
    }

    if (line.startsWith('#')) {
      continue;
    }

    if (pendingMeta && /^https?:\/\//i.test(line)) {
      let streamUrl = line;

      // Upgrade dead Channel One IP in global index.m3u to working Full HD stream
      if (/31\.148\.48\.15\/Pervii_kanal_HD/i.test(streamUrl)) {
        streamUrl = 'https://stream3.cinerama.uz/1214/mono.m3u8';
      }

      if (!isCustomImport) {
        if (
          !/\.m3u8(\?|$)/i.test(streamUrl) ||
          DEAD_OR_PLACEHOLDER_PATTERNS.test(streamUrl) ||
          EXCLUDED_IEDEM_GROUPS_REGEX.test(pendingMeta.group.trim())
        ) {
          pendingMeta = null;
          continue;
        }
      }

      const isMoldoveneasca =
        pendingMeta.group.trim().toLowerCase() === 'moldovenească';
      const isMdChannelTitle =
        /\b(MD|Moldova|Chisinau|Jurnal|TV8|Rlive|N4|Gurinel|Busuioc|Noroc|Basarab|Privesc|Gagauz)\b/i.test(
          pendingMeta.rawTitle
        );

      let inferredFallback = fallbackCountryCode;
      if (!inferredFallback) {
        if (isMoldoveneasca) {
          inferredFallback = isMdChannelTitle ? 'MD' : 'RO';
        } else if (pendingMeta.group.trim().toLowerCase() === 'українські') {
          inferredFallback = 'UA';
        } else if (pendingMeta.group.trim().toUpperCase() === 'USA') {
          inferredFallback = 'US';
        } else if (pendingMeta.group.trim().toLowerCase() === 'турция') {
          inferredFallback = 'TR';
        } else if (pendingMeta.group.trim().toLowerCase() === 'polska') {
          inferredFallback = 'PL';
        } else if (/[а-яА-ЯёЁ]/.test(pendingMeta.rawTitle)) {
          inferredFallback = 'RU';
        }
      }

      const countryCode = extractCountryFromTvgId(
        pendingMeta.tvgId,
        inferredFallback
      );

      const resMatch = pendingMeta.rawTitle.match(
        /\((\d{3,4}[pi]?|4K|UHD|HD|SD)\)/i
      );
      let resolution = resMatch ? resMatch[1].toUpperCase() : 'LIVE';
      let resolutionHeight = 576;
      if (
        resolution === '4K' ||
        resolution === 'UHD' ||
        resolution === '2160P' ||
        /\b(4K|UHD)\b/i.test(pendingMeta.rawTitle)
      ) {
        resolution = '4K';
        resolutionHeight = 2160;
      } else if (/^\d{3,4}[PI]?$/.test(resolution)) {
        resolutionHeight = parseInt(resolution, 10) || 576;
      } else if (
        resolution === 'HD' ||
        /\b(HD|FHD|50\s*fps|orig)\b/i.test(pendingMeta.rawTitle) ||
        /-hd\/|1080|hdhigh|cinerama\.uz|rossteleccom\.net/i.test(streamUrl)
      ) {
        resolution = resolution === 'LIVE' ? '1080P' : resolution;
        resolutionHeight = 1080;
      }

      if (PREMIUM_STREAM_HOSTS.test(streamUrl)) {
        resolutionHeight += 2000;
      }
      if (/rossteleccom\.net|iedem\.com/i.test(streamUrl)) {
        resolutionHeight += 3500;
        if (/\b(orig|FHD)\b/i.test(pendingMeta.rawTitle)) {
          resolutionHeight += 900;
        }
        // Demote time-shifted (+2, +4, +6, +7) variants so main Moscow (0) channels always appear first
        if (/\(\s*[+-]\d+\s*\)|(?:^|\s)\+\d+(?:\s|$)/i.test(pendingMeta.rawTitle)) {
          resolutionHeight -= 2500;
        }
        if (isMoldoveneasca) {
          if (fallbackCountryCode === 'MD' && isMdChannelTitle) {
            resolutionHeight += 600;
          } else if (fallbackCountryCode === 'RO' && !isMdChannelTitle) {
            resolutionHeight += 600;
          }
        }
      }
      if (SMART_FAVORITE_URL_SCORE.has(streamUrl)) {
        resolutionHeight = SMART_FAVORITE_URL_SCORE.get(streamUrl)!;
      }
      if (isCustomImport) {
        resolutionHeight += 5000;
      }

      let cleanName = pendingMeta.rawTitle
        .replace(/\(\d{3,4}[pi]?\)/gi, '')
        .replace(/\[[^\]]*\]/g, '')
        .replace(/[ⓈⓋⓄⒼⓎ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (RUSSIAN_BILINGUAL_NAMES[cleanName]) {
        cleanName = RUSSIAN_BILINGUAL_NAMES[cleanName];
      }

      const rawPrimaryGroup =
        (pendingMeta.group || 'General')
          .split(';')
          .map((g) => g.trim())
          .filter(Boolean)[0] || 'General';

      const primaryGroup =
        isMoldoveneasca &&
        (fallbackCountryCode === 'RO' || fallbackCountryCode === 'MD')
          ? classifyMoldoveneascaGroup(cleanName)
          : rawPrimaryGroup.toLowerCase() === 'undefined' ||
              rawPrimaryGroup.toLowerCase() === 'russia'
            ? 'General'
            : rawPrimaryGroup;

      if (!seenUrls.has(streamUrl) && cleanName) {
        seenUrls.add(streamUrl);
        channels.push({
          id: `${pendingMeta.tvgId || cleanName}_${streamUrl}`,
          tvgId: pendingMeta.tvgId || undefined,
          name: cleanName,
          logo: resolveFallbackLogo(cleanName, pendingMeta.logo),
          url: streamUrl,
          group: primaryGroup,
          countryCode,
          resolution,
          resolutionHeight,
          httpReferrer: pendingMeta.httpReferrer || undefined,
          httpUserAgent: pendingMeta.httpUserAgent || undefined,
          tvgRec: pendingMeta.tvgRec || 7,
          catchup: pendingMeta.catchup || undefined,
          catchupSource: pendingMeta.catchupSource || undefined,
        });
      }

      pendingMeta = null;
    } else if (pendingMeta && !line.startsWith('#')) {
      pendingMeta = null;
    }
  }

  return channels;
}

/**
 * Generates ordered Catch-up / TV Archive stream URLs for a past programme
 * supporting iEdem.TV (?utc=&lutc=), Flussonic (index-START-DUR.m3u8 / archive-START-DUR.m3u8),
 * CRA/Voyo (?offsetSeconds=), and custom M3U catchup-source templates.
 */
export function buildCatchupStreamCandidates(
  baseStreamUrl: string,
  startMs: number,
  stopMs: number,
  catchupSource?: string
): string[] {
  const startUnix = Math.floor(startMs / 1000);
  const stopUnix = Math.floor(stopMs / 1000);
  const nowUnix = Math.floor(Date.now() / 1000);
  const durationSec = Math.max(300, Math.min(14400, stopUnix - startUnix));
  const offsetSec = Math.max(60, nowUnix - startUnix);

  const candidates: string[] = [];
  const addCandidate = (u: string) => {
    if (u && !candidates.includes(u)) {
      candidates.push(u);
    }
  };

  // 1. Custom catchup-source template from M3U if provided
  if (catchupSource) {
    const formatted = catchupSource
      .replace(/\$\{start\}|\{start\}|\$\{utc\}|\{utc\}|\$\{timestamp\}/gi, String(startUnix))
      .replace(/\$\{end\}|\{end\}/gi, String(stopUnix))
      .replace(/\$\{duration\}|\{duration\}/gi, String(durationSec))
      .replace(/\$\{offset\}|\{offset\}/gi, String(offsetSec))
      .replace(/\$\{lutc\}|\{lutc\}/gi, String(nowUnix));

    if (/^https?:\/\//i.test(formatted)) {
      addCandidate(formatted);
    } else {
      addCandidate(`${baseStreamUrl}${formatted}`);
    }
  }

  // 2. CRA / Pro TV / Voyo offsetSeconds parameter
  if (/offsetSeconds=/i.test(baseStreamUrl)) {
    addCandidate(
      baseStreamUrl.replace(/offsetSeconds=\d+/i, `offsetSeconds=${offsetSec}`)
    );
  }

  // 3. Standard iEdem.TV / Edem / Flussonic / IPTV query (?utc=START&lutc=NOW)
  const sep = baseStreamUrl.includes('?') ? '&' : '?';
  addCandidate(`${baseStreamUrl}${sep}utc=${startUnix}&lutc=${nowUnix}`);

  // 4. Flussonic archive / index path rewrite
  if (/\/(index|mono|playlist|live)\.m3u8(\?.*)?$/i.test(baseStreamUrl)) {
    addCandidate(
      baseStreamUrl.replace(
        /\/(index|mono|playlist|live)\.m3u8(\?.*)?$/i,
        `/index-${startUnix}-${durationSec}.m3u8$2`
      )
    );
    addCandidate(
      baseStreamUrl.replace(
        /\/(index|mono|playlist|live)\.m3u8(\?.*)?$/i,
        `/archive-${startUnix}-${durationSec}.m3u8$2`
      )
    );
  }

  // 5. Fallback to base stream URL if server doesn't expose DVR archive
  addCandidate(baseStreamUrl);

  return candidates;
}

/**
 * Fetches live TV channels for a specific country ISO code, or from the global catalog if countryCode === 'ALL'.
 */
export async function fetchTvChannelsByCountry(
  countryCode: string,
  forceRefresh = false
): Promise<TvChannel[]> {
  const upperCode = countryCode.trim().toUpperCase();
  if (upperCode === 'ALL' || upperCode === 'IEDEM') {
    const all = await fetchAllGlobalTvChannels(forceRefresh);
    return all.slice(0, 4500);
  }

  const cacheKey = `tv_channels_v11_PAID_IEDEM_${upperCode}`;
  if (!forceRefresh) {
    const cached = getCachedData<TvChannel[]>(cacheKey);
    if (cached && cached.length > 0) {
      return cached;
    }
  }

  const iedemText = await fetchPaidIedemPlaylistText(forceRefresh);

  // For Russia (RU) / iEdem full catalog: ONLY the paid iEdem playlist (4,192 channels)
  if (upperCode === 'RU') {
    const parsed = parseM3uPlaylist(iedemText, '');
    setCachedData(cacheKey, parsed, DEFAULT_TTL_MS);
    return parsed;
  }

  // For Romania (RO) and Moldova (MD): ONLY Paid iEdem #EXTGRP:moldovenească (155 RO/MD channels)
  if (upperCode === 'RO' || upperCode === 'MD') {
    const iedemRoMdM3u = extractIedemSubsetM3u(
      iedemText,
      (grp) => grp.trim().toLowerCase() === 'moldovenească'
    );
    const parsed = parseM3uPlaylist(iedemRoMdM3u || iedemText, upperCode);
    setCachedData(cacheKey, parsed, DEFAULT_TTL_MS);
    return parsed;
  }

  const iedemCountryGroupMap: Record<string, (grp: string) => boolean> = {
    UA: (g) => g.trim().toLowerCase() === 'українські',
    US: (g) => g.trim().toUpperCase() === 'USA',
    TR: (g) => /^(турция|türk)$/i.test(g.trim()),
    PL: (g) => g.trim().toLowerCase() === 'polska',
    BY: (g) => /^(беларусь|беларускія)$/i.test(g.trim()),
    KZ: (g) => /^(казахстан|қазақстан)$/i.test(g.trim()),
    UZ: (g) => /^(узбекистан|o'zbek)$/i.test(g.trim()),
    AM: (g) => /^(армения|հայկական)$/i.test(g.trim()),
    GE: (g) => /^(грузия|ქართული)$/i.test(g.trim()),
    AZ: (g) => /^(азербайджан|azərbaycan)$/i.test(g.trim()),
    TJ: (g) => /^(таджикистан|точик)$/i.test(g.trim()),
    IL: (g) => /^(израиль|ישראלי)$/i.test(g.trim()),
  };

  const iedemSubset = iedemCountryGroupMap[upperCode]
    ? extractIedemSubsetM3u(iedemText, (g) => iedemCountryGroupMap[upperCode](g))
    : '';

  const parsed = parseM3uPlaylist(iedemSubset || iedemText, upperCode);
  setCachedData(cacheKey, parsed, DEFAULT_TTL_MS);
  return parsed;
}

/**
 * Loads and caches in-memory the full paid iEdem IPTV catalog (4,192 channels across all 25 groups).
 */
export async function fetchAllGlobalTvChannels(
  forceRefresh = false
): Promise<TvChannel[]> {
  if (!forceRefresh && globalTvChannelsMemoryCache) {
    return globalTvChannelsMemoryCache;
  }

  if (!forceRefresh && globalTvChannelsPromise) {
    return globalTvChannelsPromise;
  }

  globalTvChannelsPromise = (async () => {
    try {
      const iedemText = await fetchPaidIedemPlaylistText(forceRefresh);
      const combined = parseM3uPlaylist(iedemText, '');
      globalTvChannelsMemoryCache = combined;
      return combined;
    } finally {
      globalTvChannelsPromise = null;
    }
  })();

  return globalTvChannelsPromise;
}

/**
 * Generates a standard M3U playlist string from an array of TvChannel items,
 * compatible with Smart TVs, TiviMate, OTT Navigator, VLC, Kodi, and iEdem players.
 */
export function exportTvChannelsToM3u(channels: TvChannel[]): string {
  const lines: string[] = ['#EXTM3U'];

  for (const ch of channels) {
    if (!ch.url) continue;
    const safeName = (ch.name || 'TV Channel').replace(/\r?\n/g, ' ').trim();
    const safeGroup = (ch.group || 'General').replace(/"/g, "'").trim();
    const safeLogo = (ch.logo || '').replace(/"/g, '').trim();
    const safeCountry = (ch.countryCode || '').replace(/"/g, '').trim();
    const safeTvgId = (ch.tvgId || '').replace(/"/g, '').trim();

    const attrs: string[] = [];
    if (safeTvgId) attrs.push(`tvg-id="${safeTvgId}"`);
    if (safeCountry) attrs.push(`tvg-country="${safeCountry}"`);
    if (safeLogo) attrs.push(`tvg-logo="${safeLogo}"`);
    if (safeGroup) attrs.push(`group-title="${safeGroup}"`);

    const attrString = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
    lines.push(`#EXTINF:-1${attrString},${safeName}`);
    if (safeGroup) {
      lines.push(`#EXTGRP:${safeGroup}`);
    }
    if (ch.httpReferrer) {
      lines.push(`#EXTVLCOPT:http-referrer=${ch.httpReferrer}`);
    }
    if (ch.httpUserAgent) {
      lines.push(`#EXTVLCOPT:http-user-agent=${ch.httpUserAgent}`);
    }
    lines.push(ch.url);
  }

  return lines.join('\n') + '\n';
}

/**
 * Generates a standard M3U playlist string from an array of Radio Station items.
 */
export function exportRadioStationsToM3u(stations: Station[]): string {
  const lines: string[] = ['#EXTM3U'];

  for (const st of stations) {
    const streamUrl = st.url_resolved || st.url;
    if (!streamUrl) continue;
    const safeName = (st.name || 'Radio Station').replace(/\r?\n/g, ' ').trim();
    const safeGroup = (st.country || st.countrycode || 'Radio')
      .replace(/"/g, "'")
      .trim();
    const safeLogo = (st.favicon || '').replace(/"/g, '').trim();

    const attrs: string[] = [];
    if (safeLogo) attrs.push(`tvg-logo="${safeLogo}"`);
    if (safeGroup) attrs.push(`group-title="${safeGroup}"`);

    const attrString = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
    lines.push(`#EXTINF:-1${attrString},${safeName}`);
    lines.push(streamUrl);
  }

  return lines.join('\n') + '\n';
}

/**
 * Triggers a browser download of an .m3u playlist file.
 */
export function downloadM3uFile(content: string, filename: string): void {
  const cleanName = filename.endsWith('.m3u') || filename.endsWith('.m3u8')
    ? filename
    : `${filename}.m3u`;
  const blob = new Blob([content], {
    type: 'audio/x-mpegurl;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = cleanName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Curated verified working 18+ / Adult / iEdem "Для взрослых / Эротика" HD channels.
 */
const CURATED_ADULT_18_M3U = `
#EXTM3U
#EXTINF:-1 group-title="Для взрослых (18+)",Brazzers TV Europe HD (1080p)
http://193.239.187.102/BRAZZERS/index.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Brazzers TV Europe (2)
http://185.23.80.23:8080/BrazzersTV/index.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Русская Ночь / Russian Night HD
http://stream.mcquack.net/60/index.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Русская Ночь (2) / Russkaya Noch
http://185.23.80.23:8080/RusskayaNoch/index.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Babes TV HD (1080p)
http://stream.mcquack.net/55/index.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Redlight HD (1080p)
http://stream.mcquack.net/56/index.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Exxxotica HD (1080p)
http://stream.mcquack.net/57/index.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Erox HD (1080p)
http://stream.mcquack.net/58/index.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Hustler HD (1080p)
http://stream.mcquack.net/59/index.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Vivid Red HD (1080p)
http://stream.mcquack.net/284/index.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Blue Hustler
http://185.23.80.23:8080/BlueHustler/index.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Barely Legal
http://185.23.80.23:8080/BarelyLegal/index.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Playboy TV
http://185.23.80.23:8080/PlayboyTV/index.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Porn Classic
http://200.194.238.229:8383/live/pornclassic/playlist.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Russian / Русское 18+ HD
http://cdn.adultiptv.net/russian.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Russian (2) HD
http://live.redtraffic.xyz/russian.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Pornstar HD
http://cdn.adultiptv.net/pornstar.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Pornstar (2) HD
http://live.redtraffic.xyz/pornstar.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Hardcore HD
http://live.redtraffic.xyz/hardcore.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Big Tits HD
http://live.redtraffic.xyz/bigtits.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Big Ass HD
http://cdn.adultiptv.net/bigass.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Big Ass (2) HD
http://live.redtraffic.xyz/bigass.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Blonde HD
http://cdn.adultiptv.net/blonde.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Brunette HD
http://cdn.adultiptv.net/brunette.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Latina HD
http://cdn.adultiptv.net/latina.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Milf HD
http://cdn.adultiptv.net/milf.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Teen 18+ HD
http://cdn.adultiptv.net/teen.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Amateur HD
http://cdn.adultiptv.net/amateur.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Lesbian HD
http://cdn.adultiptv.net/lesbian.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Threesome HD
http://cdn.adultiptv.net/threesome.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Anal HD
http://cdn.adultiptv.net/anal.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Blowjob HD
http://cdn.adultiptv.net/blowjob.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV POV HD
http://cdn.adultiptv.net/pov.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Asian HD
http://cdn.adultiptv.net/asian.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Interracial HD
http://cdn.adultiptv.net/interracial.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Cuckold HD
http://live.redtraffic.xyz/cuckold.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Fetish HD
http://cdn.adultiptv.net/fetish.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Rough HD
http://cdn.adultiptv.net/rough.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Gangbang HD
http://cdn.adultiptv.net/gangbang.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Compilation HD
http://cdn.adultiptv.net/compilation.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Live Cams HD
http://cdn.adultiptv.net/livecams.m3u8
#EXTINF:-1 group-title="Для взрослых (18+)",Adult IPTV Big Dick HD
http://cdn.adultiptv.net/bigdick.m3u8
`;

/**
 * Checks whether a TV channel belongs to the 18+ / Adult / iEdem "Для взрослых" / "взрослые" / "Эротика" category.
 */
export function isAdultTvChannel(ch: TvChannel): boolean {
  const combined = `${ch.group || ''} ${ch.name || ''}`;
  if (
    /юмор\s*18\+|adult\s*swim|stingray\s*pop\s*adult|adult\s*animation/i.test(
      combined
    )
  ) {
    return false;
  }
  return /(?:взросл|для взрослых|эротик|клубнич|шалун|русская ночь|искушение|ночной клуб|brazzers|hustler|redlight|dorcel|penthouse|playboy|private\s*tv|vivid|babes|barely\s*legal|extasy|exxxotica|passion\s*xxx|pink\s*o|blue\s*hustler|erox|cento\s*x\s*cento|superone|babestation|visit-x|porn|milf|fetish|lesbian|hardcore|blowjob|cuckold|threesome|gangbang|interracial|candyman|o-la-la|olala|nuart|xxx|\badult\b|\b18\+)/i.test(
    combined
  );
}

/**
 * Fetches 18+ Adult TV channels from Curated iEdem 18+, loganettv/strawberry.m3u, and mega.m3u.
 */
export async function fetchAdultTvChannels(): Promise<TvChannel[]> {
  const cacheKey = 'tv_channels_v9_PAID_IEDEM_ADULT_XXX';
  const cached = getCachedData<TvChannel[]>(cacheKey);
  if (cached && cached.length > 5) {
    return cached;
  }
  try {
    const iedemText = await fetchPaidIedemPlaylistText();
    const iedemAdultM3u = extractIedemSubsetM3u(iedemText, (grp, title) =>
      /взросл|adult|xxx|18\+|эротик/i.test(`${grp} ${title}`)
    );
    const iedemAdultList = parseM3uPlaylist(iedemAdultM3u, 'RU');

    const seen = new Set<string>();
    const merged: TvChannel[] = [];
    for (const ch of iedemAdultList) {
      if (!ch.url || seen.has(ch.url)) continue;
      seen.add(ch.url);
      merged.push({
        ...ch,
        group: 'взрослые (18+)',
      });
    }

    if (merged.length > 0) {
      setCachedData(cacheKey, merged, DEFAULT_TTL_MS);
    }
    return merged;
  } catch {
    return [];
  }
}

