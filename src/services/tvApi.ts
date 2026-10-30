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
const SMOLNP_RU_M3U =
  'https://raw.githubusercontent.com/smolnp/IPTVru/master/IPTVru.m3u';
const FREETV_RU_M3U =
  'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_russia.m3u8';
const FREETV_RO_M3U =
  'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_romania.m3u8';
const FREETV_MD_M3U =
  'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_moldova.m3u8';

let globalTvChannelsMemoryCache: TvChannel[] | null = null;
let globalTvChannelsPromise: Promise<TvChannel[]> | null = null;

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
  /nosignal\d*\.antenaplay\.ro|jarvisx1\.cfd|mofta1\.cfd|mangora1\.cfd|freeott\.top|rpprod\.hbbtv\.cdn\.cra\.cz|ucom\.am|strm\.yandex\.ru|15plusmg\.ru|31\.148\.48\.15|45\.153\.24\.78|89\.33\.29\.115|cdn\.ngenix\.net|serv30\.vintera\.tv\/restream\/1_old|vgtrkregion-reg\.cdnvideo\.ru\/vgtrk\/0\/russia24|t\.me\//i;

// Verified high-speed HD CDNs that sort to the top in Quality mode
const PREMIUM_STREAM_HOSTS =
  /cinerama\.uz|stream\.mcquack\.net|mkpnet\.ru|linkintel\.ru|cdn\.ntv\.ru|cdn-dvr\.ntv\.ru|live\.smotrim\.ru|stream\.smotrim\.ru|thestream\.cyou|kinowalk\.hopto\.org|lbgo\.bozztv\.com|tvchannelstream1\.tvzvezda\.ru|176\.118\.197\.101|streaming102\.interskytech\.com|hls\.mirtv\.cdnvideo\.ru|edge-ar\.rcs-rds\.ro|lg\.mncdn\.com|antenaplay\.ro/i;

// Top verified Romanian & Moldovan HD channels placed at the very top of RO / MD & Global lists
const CURATED_ROMANIAN_TOP_HD_M3U = `
#EXTM3U
#EXTINF:-1 tvg-id="PRO.TV.HD.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/pro-tv-hd.jpg" group-title="General",Pro TV HD (1080p)
https://cmero-ott-live.ssl.cdn.cra.cz/channels/cme-ro-voyo-news/playlist.m3u8?offsetSeconds=0&url=0
#EXTINF:-1 tvg-id="Antena.1.HD.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/antena-1-hd.jpg" group-title="General",Antena 1 HD (Romania)
https://live4dai.antenaplay.ro/live2_sdi14/live2_sdi14_600k.m3u8
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
#EXTINF:-1 tvg-id="Antena.Stars.HD.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/antena-stars-hd.jpg" group-title="Entertainment",Antena Stars HD
https://live4dai.antenaplay.ro/live2_sdi07/live2_sdi07_600k.m3u8
#EXTINF:-1 tvg-id="Happy.Channel.HD.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/happy-channel-hd.jpg" group-title="Movies",Happy Channel
https://live4dai.antenaplay.ro/live2_aws4_sdi12/live2_aws4_sdi12_600k.m3u8
#EXTINF:-1 tvg-id="Cinemaraton.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/cinemaraton.jpg" group-title="Movies",Cinemaraton Plus HD (1080p)
https://hls02ns.antenaplay.ro/hls/cinemaraton-plus-hd/index.m3u8
#EXTINF:-1 tvg-id="Kiss.TV.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/kiss-tv.jpg" group-title="Music",Kiss TV HD (1080p)
https://tv.broadcasting.ro/kisstv/a629c031-2170-4ee9-a36d-87a891aa3131.m3u8
#EXTINF:-1 tvg-id="Rock.TV.HD.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/rock-tv-hd.jpg" group-title="Music",Rock TV HD (720p)
https://tv.broadcasting.ro/rocktv/85c83a80-4f71-4f2d-a8d6-43f676896bcb.m3u8
#EXTINF:-1 tvg-id="TraLaLa.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/tralala.jpg" group-title="Kids",TraLaLa TV HD (1080p)
https://hls01ns.antenaplay.ro/hls/tralala-hd/index.m3u8
#EXTINF:-1 tvg-id="TraLaLa.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/tralala.jpg" group-title="Kids",TraLaLa Desene Animate HD (1080p)
https://hls01ns.antenaplay.ro/hls/tralala-desene-animate-hd/index.m3u8
#EXTINF:-1 tvg-id="Travel.Mix.ro" tvg-logo="https://static.cinemagia.ro/img/tv_station/travel-mix.jpg" group-title="Documentary",Travel Mix HD (1080p)
https://hls02ns.antenaplay.ro/hls/travel-mix-hd/index.m3u8
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
#EXTINF:-1 tvg-id="pervy" tvg-logo="https://iptvx.one/picons/pervy.png" group-title="Основные",Первый канал HD / Channel One HD (1080p)
https://stream3.cinerama.uz/1214/mono.m3u8
#EXTINF:-1 tvg-id="pervy" tvg-logo="https://iptvx.one/picons/pervy.png" group-title="Основные",Первый канал / Channel One (Russia) (1080p)
http://flussonic.mkpnet.ru/tv-4f9598ab5f91dca4/video.m3u8
#EXTINF:-1 tvg-id="pervy" tvg-logo="https://iptvx.one/picons/pervy.png" group-title="Основные",Первый канал Европа / Channel One Europe (HD)
https://streaming.thestream.cyou/live/210-req_offset_28000000-req_window_0-3k_v5.m3u8
#EXTINF:-1 tvg-id="rossia1" tvg-logo="https://iptvx.one/picons/rossia1.png" group-title="Основные",Россия 1 HD / Russia 1 HD (1080p)
https://live.smotrim.ru/vgtrk/0/russia1-hd/index.m3u8
#EXTINF:-1 tvg-id="rossia1" tvg-logo="https://iptvx.one/picons/rossia1.png" group-title="Основные",Россия 1 (2) / Russia 1 (1080p)
https://stream8.cinerama.uz/1020/index.m3u8
#EXTINF:-1 tvg-id="ntv" tvg-logo="https://iptvx.one/picons/ntv.png" group-title="Основные",НТВ HD / NTV HD (1080p)
https://cdn.ntv.ru/ntv-msk_hd/index.m3u8
#EXTINF:-1 tvg-id="ntv" tvg-logo="https://iptvx.one/picons/ntv.png" group-title="Основные",НТВ (2) / NTV (HD)
https://cdn.ntv.ru/ntv0/index.m3u8
#EXTINF:-1 tvg-id="sts" tvg-logo="https://iptvx.one/picons/sts.png" group-title="Основные",СТС HD / STS HD (1080p)
http://stream.mcquack.net/138/index.m3u8
#EXTINF:-1 tvg-id="tnt" tvg-logo="https://iptvx.one/picons/tnt.png" group-title="Основные",ТНТ HD / TNT Russia HD (1080p)
http://stream.mcquack.net/135/index.m3u8
#EXTINF:-1 tvg-id="tnt" tvg-logo="https://iptvx.one/picons/tnt.png" group-title="Основные",ТНТ (2) / TNT Russia (Live)
https://bl.rutube.ru/livestream/546602986e6a424d74d594876ddb3f04/index.m3u8?s=K-z3nz49R1oGQ-5yPSd8pg&e=2082157024&scheme=https
#EXTINF:-1 tvg-id="match-tv" tvg-logo="https://iptvx.one/picons/match-tv.png" group-title="Спортивные",Матч! ТВ / Match TV (HD)
http://stream.mcquack.net/169/index.m3u8
#EXTINF:-1 tvg-id="piatnica" tvg-logo="https://iptvx.one/picons/piatnica.png" group-title="Развлекательные",Пятница! / Friday! (HD)
http://stream.mcquack.net/181/index.m3u8
#EXTINF:-1 tvg-id="tv3-ru" tvg-logo="https://iptvx.one/picons/tv3-ru.png" group-title="Развлекательные",ТВ-3 HD / TV-3 HD (1080p)
http://stream.mcquack.net/136/index.m3u8
#EXTINF:-1 tvg-id="subbota" tvg-logo="https://iptvx.one/picons/subbota.png" group-title="Развлекательные",Суббота! HD / Subbota! HD (1080p)
http://stream.mcquack.net/269/index.m3u8
#EXTINF:-1 tvg-id="domashny" tvg-logo="https://iptvx.one/picons/domashny.png" group-title="Развлекательные",Домашний / Domashniy (HD)
http://stream.mcquack.net/227/index.m3u8
#EXTINF:-1 tvg-id="zvezda" tvg-logo="https://iptvx.one/picons/zvezda.png" group-title="Основные",Звезда HD / Zvezda HD (1080p)
https://tvchannelstream1.tvzvezda.ru/cdn/tvzvezda/playlist_hdhigh.m3u8
#EXTINF:-1 tvg-id="rossia-k" tvg-logo="https://iptvx.one/picons/rossia-k.png" group-title="Основные",Россия-Культура HD / Russia-K (1080p)
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
  [/^Первый канал|Channel One/i, 'https://iptvx.one/picons/pervy.png'],
  [/^Россия 1\b|Russia 1/i, 'https://iptvx.one/picons/rossia1.png'],
  [/^Россия 24|Russia 24/i, 'https://iptvx.one/picons/rossia24.png'],
  [/^Россия[ -]?К|Культура/i, 'https://iptvx.one/picons/rossia-k.png'],
  [/^НТВ Сериал|NTV Series/i, 'https://iptvx.one/picons/ntv-serial.png'],
  [/^НТВ Хит/i, 'https://iptvx.one/picons/ntv-hit.png'],
  [/^НТВ Право/i, 'https://iptvx.one/picons/ntv-pravo.png'],
  [/^НТВ Стиль/i, 'https://iptvx.one/picons/ntv-stil.png'],
  [/^НТВ\b|^NTV/i, 'https://iptvx.one/picons/ntv.png'],
  [/^ТНТ4|TNT4/i, 'https://iptvx.one/picons/tnt4.png'],
  [/^ТНТ Music|TNT Music/i, 'https://iptvx.one/picons/tnt-music.png'],
  [/^ТНТ\b|^TNT/i, 'https://iptvx.one/picons/tnt.png'],
  [/^СТС Love|STS Love/i, 'https://iptvx.one/picons/sts-love.png'],
  [/^СТС Kids|STS Kids/i, 'https://iptvx.one/picons/sts-kids.png'],
  [/^СТС\b|^STS/i, 'https://iptvx.one/picons/sts.png'],
  [/^РЕН ТВ|REN TV/i, 'https://iptvx.one/picons/rentv.png'],
  [/^Пятница|Pyatnitsa|Friday!/i, 'https://iptvx.one/picons/piatnica.png'],
  [/^Матч!?\s*Боец|Match!?\s*Boets/i, 'https://iptvx.one/picons/match-boec.png'],
  [/^Матч!?\s*Страна/i, 'https://iptvx.one/picons/match-strana.png'],
  [/^Матч!?\s*Арена/i, 'https://iptvx.one/picons/match-arena.png'],
  [/^Матч!?\s*Игра/i, 'https://iptvx.one/picons/match-igra.png'],
  [/^Матч|Match/i, 'https://iptvx.one/picons/match-tv.png'],
  [/^ТВ[ -]?3\b|TV-3/i, 'https://iptvx.one/picons/tv3-ru.png'],
  [/^Домашний|Domashniy/i, 'https://iptvx.one/picons/domashny.png'],
  [/^Звезда|Zvezda/i, 'https://iptvx.one/picons/zvezda.png'],
  [/^Карусель|Karusel/i, 'https://iptvx.one/picons/karusel.png'],
  [/^ТВ Центр|ТВЦ|TV Center/i, 'https://iptvx.one/picons/tvc.png'],
  [/^Суббота|Subbota/i, 'https://iptvx.one/picons/subbota.png'],
  [/^Муз-ТВ|Muz-TV/i, 'https://iptvx.one/picons/muztv.png'],
  [/^Пятый канал|5 канал/i, 'https://iptvx.one/picons/5kanal.png'],
  [/^ОТР\b/i, 'https://iptvx.one/picons/otr.png'],
  [/^Мир 24/i, 'https://iptvx.one/picons/mir24.png'],
  [/^Мир\b/i, 'https://iptvx.one/picons/mir.png'],
  [/^Спас\b/i, 'https://iptvx.one/picons/spas.png'],
  [/^Ю\b|^Ю-ТВ/i, 'https://iptvx.one/picons/u-tv.png'],
  [/^Че!?$|^Че\b/i, 'https://iptvx.one/picons/che.png'],
  [/^Дом Кино Премиум/i, 'https://iptvx.one/picons/domkino-premium.png'],
  [/^Дом Кино/i, 'https://iptvx.one/picons/domkino.png'],
  [/^Кинопремьера/i, 'https://iptvx.one/picons/kinopremiera.png'],
  [/^Кинохит/i, 'https://iptvx.one/picons/kinohit.png'],
  [/^Киносемья/i, 'https://iptvx.one/picons/kinosemia.png'],
  [/^Киносвидание/i, 'https://iptvx.one/picons/kinosvidanie.png'],
  [/^Кинокомедия/i, 'https://iptvx.one/picons/kinokomedia.png'],
  [/^Киномикс/i, 'https://iptvx.one/picons/kinomix.png'],
  [/^Киноужас/i, 'https://iptvx.one/picons/kinoujas.png'],
  [/^Кинопоказ/i, 'https://iptvx.one/picons/kinopokaz.png'],
  [/^Мужское Кино/i, 'https://iptvx.one/picons/mujskoe-kino.png'],
  [/^Родное Кино/i, 'https://iptvx.one/picons/rodnoe-kino.png'],
  [/^Индийское Кино/i, 'https://iptvx.one/picons/indijskoe-kino.png'],
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
];

function resolveFallbackLogo(channelName: string, existingLogo: string): string {
  for (const [pattern, logoUrl] of FALLBACK_LOGO_RULES) {
    if (pattern.test(channelName)) {
      if (!existingLogo || /imgur\.com|wikia\.nocookie\.net/i.test(existingLogo)) {
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
          DEAD_OR_PLACEHOLDER_PATTERNS.test(streamUrl)
        ) {
          pendingMeta = null;
          continue;
        }
      }

      const countryCode = extractCountryFromTvgId(
        pendingMeta.tvgId,
        fallbackCountryCode || (/[а-яА-ЯёЁ]/.test(pendingMeta.rawTitle) ? 'RU' : '')
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
        /-hd\/|1080|hdhigh|cinerama\.uz/i.test(streamUrl)
      ) {
        resolution = resolution === 'LIVE' ? '1080P' : resolution;
        resolutionHeight = 1080;
      }

      if (PREMIUM_STREAM_HOSTS.test(streamUrl)) {
        resolutionHeight += 2000;
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
        rawPrimaryGroup.toLowerCase() === 'undefined' ||
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
  if (upperCode === 'ALL') {
    const all = await fetchAllGlobalTvChannels(forceRefresh);
    return all.slice(0, 2500);
  }

  const cacheKey = `tv_channels_${upperCode}`;
  if (!forceRefresh) {
    const cached = getCachedData<TvChannel[]>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // For Russia (RU): combine ngrch/iptv (ru.m3u + music.m3u + cartoons.m3u),
  // loganettv/playlists (movie.m3u + mega.m3u + all.m3u + sport.m3u + kids.m3u + leisure.m3u),
  // Free-TV Russia, smolnp/IPTVru, and iptv-org (rus.m3u + ru.m3u)
  if (upperCode === 'RU') {
    const results = await Promise.allSettled([
      fetch(NGRCH_RU_M3U).then((r) => (r.ok ? r.text() : '')),
      fetch(LOGANETTV_MOVIE_M3U).then((r) => (r.ok ? r.text() : '')),
      fetch(LOGANETTV_MEGA_M3U).then((r) => (r.ok ? r.text() : '')),
      fetch(LOGANETTV_ALL_M3U).then((r) => (r.ok ? r.text() : '')),
      fetch(LOGANETTV_SPORT_M3U).then((r) => (r.ok ? r.text() : '')),
      fetch(LOGANETTV_KIDS_M3U).then((r) => (r.ok ? r.text() : '')),
      fetch(LOGANETTV_LEISURE_M3U).then((r) => (r.ok ? r.text() : '')),
      fetch(FREETV_RU_M3U).then((r) => (r.ok ? r.text() : '')),
      fetch(SMOLNP_RU_M3U).then((r) => (r.ok ? r.text() : '')),
      fetch(NGRCH_MUSIC_M3U).then((r) => (r.ok ? r.text() : '')),
      fetch(NGRCH_CARTOONS_M3U).then((r) => (r.ok ? r.text() : '')),
      fetch(`${IPTV_BASE_URL}/languages/rus.m3u`).then((r) =>
        r.ok ? r.text() : ''
      ),
      fetch(`${IPTV_BASE_URL}/countries/ru.m3u`).then((r) =>
        r.ok ? r.text() : ''
      ),
    ]);

    const combinedText = [
      CURATED_RUSSIAN_TOP_HD_M3U,
      ...results.map((r) => (r.status === 'fulfilled' ? r.value : '')),
    ]
      .filter(Boolean)
      .join('\n');

    const parsed = parseM3uPlaylist(combinedText, 'RU');
    setCachedData(cacheKey, parsed, DEFAULT_TTL_MS);
    return parsed;
  }

  // For Romania (RO) and Moldova (MD): combine Curated RO/MD HD + Free-TV Romania/Moldova + iptv-org/languages/ron.m3u + country list
  if (upperCode === 'RO' || upperCode === 'MD') {
    const results = await Promise.allSettled([
      fetch(FREETV_RO_M3U).then((r) => (r.ok ? r.text() : '')),
      fetch(FREETV_MD_M3U).then((r) => (r.ok ? r.text() : '')),
      fetch(`${IPTV_BASE_URL}/languages/ron.m3u`).then((r) =>
        r.ok ? r.text() : ''
      ),
      fetch(`${IPTV_BASE_URL}/countries/${upperCode.toLowerCase()}.m3u`).then(
        (r) => (r.ok ? r.text() : '')
      ),
    ]);

    const combinedText = [
      CURATED_ROMANIAN_TOP_HD_M3U,
      ...results.map((r) => (r.status === 'fulfilled' ? r.value : '')),
    ]
      .filter(Boolean)
      .join('\n');

    const parsed = parseM3uPlaylist(combinedText, upperCode);
    setCachedData(cacheKey, parsed, DEFAULT_TTL_MS);
    return parsed;
  }

  const iptvCode = toIptvCountryCode(upperCode);
  const url = `${IPTV_BASE_URL}/countries/${iptvCode}.m3u`;

  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    throw new Error(`HTTP ${response.status} loading TV channels`);
  }

  const text = await response.text();
  const parsed = parseM3uPlaylist(text, upperCode);
  setCachedData(cacheKey, parsed, DEFAULT_TTL_MS);
  return parsed;
}

/**
 * Loads and caches in-memory the full global IPTV index (~10,000+ channels across all countries).
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
      const [indexRes, ngrchRes, loganMovieRes, loganMegaRes, loganRes] =
        await Promise.allSettled([
          fetch(`${IPTV_BASE_URL}/index.m3u`).then((r) =>
            r.ok ? r.text() : ''
          ),
          fetch(NGRCH_RU_M3U).then((r) => (r.ok ? r.text() : '')),
          fetch(LOGANETTV_MOVIE_M3U).then((r) => (r.ok ? r.text() : '')),
          fetch(LOGANETTV_MEGA_M3U).then((r) => (r.ok ? r.text() : '')),
          fetch(LOGANETTV_ALL_M3U).then((r) => (r.ok ? r.text() : '')),
        ]);

      const indexText =
        indexRes.status === 'fulfilled' ? indexRes.value : '';
      const ngrchText =
        ngrchRes.status === 'fulfilled' ? ngrchRes.value : '';
      const loganMovieText =
        loganMovieRes.status === 'fulfilled' ? loganMovieRes.value : '';
      const loganMegaText =
        loganMegaRes.status === 'fulfilled' ? loganMegaRes.value : '';
      const loganText =
        loganRes.status === 'fulfilled' ? loganRes.value : '';

      const roChannels = parseM3uPlaylist(CURATED_ROMANIAN_TOP_HD_M3U, 'RO');
      const ruChannels = parseM3uPlaylist(
        `${CURATED_RUSSIAN_TOP_HD_M3U}\n${ngrchText}\n${loganMovieText}\n${loganMegaText}\n${loganText}`,
        'RU'
      );
      const worldChannels = parseM3uPlaylist(indexText, '');

      const combined = [...roChannels, ...ruChannels, ...worldChannels];
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
