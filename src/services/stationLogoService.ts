/**
 * Resolves high-resolution official station artwork for stations whose
 * Radio Browser entry is missing a favicon or only has a low-res .ico file.
 */

const RMC_MAIN_LOGO =
  'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly9yYWRpbzMub21ueXMuY29tL3dwLWNvbnRlbnQvdXBsb2Fkcy8yMDI1LzA2L2RlZmF1bHQtMS5qcGc/-/0/0?r=91587740ec678bd2765cf54837744f04';

const RMC_CHANNEL_LOGOS: Array<{ match: RegExp; url: string }> = [
  {
    match: /\b(rmc|monte\s*carlo)\s*80\b/i,
    url: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfODBfV2ViUmFkaW8tMTYwMTUyNzczNjc2My0yLmpwZy1ybWNfODAtMi5qcGc/-/0/0?r=9aea69577e5f16f5c2f315fa43f89832',
  },
  {
    match: /\b(rmc|monte\s*carlo)\s*90\b/i,
    url: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfOTBfV2ViUmFkaW8tMTYwMTUyNzgwNDM5My0yLmpwZy1ybWNfOTAtMi5qcGc/-/0/0?r=f0b7e3e3fbb974ecf8efc50d592191f8',
  },
  {
    match: /\b(cool\s*radio\s*monte\s*carlo|rmc\s*cool)\b/i,
    url: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfQ09PTF9XZWJSYWRpby0xNjAxNTI3OTYzMDE1LTIuanBnLXJtY19jb29sLTIuanBn/-/0/0?r=d19f9da37b774c754b093306a3286f49',
  },
  {
    match: /\b(rmc|monte\s*carlo)\s*acoustic\b/i,
    url: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfQUNPVVNUSUNfV2ViUmFkaW8tMTYwMTUyOTMxODkwNy0yLmpwZy1yYWRpb19tb250ZV9jYXJsb19hY291c3RpYy0yLmpwZw/-/0/0?r=7c8c561b274f7cf9b0e567ee3f5e655b',
  },
  {
    match: /\b(rmc|monte\s*carlo)\s*blue\s*moon\b/i,
    url: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfQkxVRU1PT05fV2ViUmFkaW8tMTY2Njg1NjkzMTkyMi0zLmpwZy1ibHVlbW9vbi0zLmpwZw/-/0/0?r=c65d9167ecb6ef31c78faa5842b03b12',
  },
  {
    match: /\b(rmc|monte\s*carlo)\s*buddha/i,
    url: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfQnVkZGhhLUJhcl9NQ19XZWJSYWRpby0xNjYzNTc2NjI5NDI2LTIuanBnLXJtY19idWRkaGFfYmFyX21vbnRlX2NhcmxvX19fcmFkaW8tMi5qcGc/-/0/0?r=69c342c93c72a467bc4a4d4d21dc45a5',
  },
  {
    match: /\b(rmc|monte\s*carlo)\s*great\s*artists\b/i,
    url: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfR1JFQVRTX1dlYlJhZGlvLTE2MDE1MjgxNDU2OTAtMi5qcGctcm1jX2dyZWF0X2FydGlzdHMtMi5qcGc/-/0/0?r=f1b88deae26714235095a3eab161dd04',
  },
  {
    match: /\b(rmc|monte\s*carlo)\s*disco\s*funk\b/i,
    url: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfRElTQ09GVU5LX1dlYlJhZGlvLTE2MDE1MjgwMjc0NTAtMi5qcGctcmFkaW9fbW9udGVfY2FybG9fZGlzY29fZnVuay0yLmpwZw/-/0/0?r=06eb2ddffdb97e7152e23ab50f34765f',
  },
  {
    match: /\b(rmc\s*fitness|gym\s*radio)\b/i,
    url: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfRklUTkVTU19XZWJSYWRpby0xNjAxNTI4MDg3MTQzLTIuanBnLWd5bV9yYWRpby0yLmpwZw/-/0/0?r=1d44cc9a71f5846bc86c0660ce00df94',
  },
  {
    match: /\b(rmc|monte\s*carlo)\s*hits\b/i,
    url: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfSElUU19XZWJSYWRpby0xNjAxNTI4MjA4MzE4LTMuanBnLXJtY19oaXRzLTMuanBn/-/0/0?r=e03719966665665d902cd409e6162b62',
  },
  {
    match: /\brmc\s*italia\b/i,
    url: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfSVRBTElBX1dlYlJhZGlvLTE2MDE1MjgzMTIyNDktMi5qcGctcm1jX2l0YWxpYS0yLmpwZw/-/0/0?r=469f231ef9b39dceec5c7a35416bf7db',
  },
  {
    match: /\b(rmc|monte\s*carlo)\s*jazz\b/i,
    url: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfSkFaWl9XZWJSYWRpby0xNjQxMjkxMTg2MjIzLTIuanBnLXJhZGlvX21vbnRlX2NhcmxvX2phenotMi5qcGc/-/0/0?r=0734ac952c658baffc80b6d66b3c7a46',
  },
  {
    match: /\b(rmc|monte\s*carlo)\s*love\s*songs?\b/i,
    url: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfTE9WRVNPTkdfV2ViUmFkaW8tMTYwMTUyODM3MjA5MS0yLmpwZy1ybWNfbG92ZV9zb25ncy0yLmpwZw/-/0/0?r=9be45394807c9a67d7dbeeac76938cf8',
  },
  {
    match: /\b(rmc|monte\s*carlo)\s*marine\b/i,
    url: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfTUFSSU5FX1dlYlJhZGlvLTE2MDE1Mjg0NDM3MDktMi5qcGctcm1jX21hcmluZS0yLmpwZw/-/0/0?r=2005faa852aaaf29d177d9a608ad28a4',
  },
  {
    match: /\b(rmc|monte\s*carlo)\s*nights?\s*story\b/i,
    url: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfTUNTdG9yeV9XZWJSYWRpby0xNjAxNTI4NTMzMzk3LTIuanBnLW1vbnRlX2NhcmxvX25pZ2h0c19zdG9yeS0yLmpwZw/-/0/0?r=74847a5d03b0d5ae4ab5a1b8514ba7fb',
  },
  {
    match: /\b(rmc|monte\s*carlo)\s*new\s*classics?\b/i,
    url: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfTkVXQ0xBU1NJQ19XZWJSYWRpby0xNjAxNTI4NjE0MDk4LTIuanBnLXJtY19uZXdfY2xhc3NpY3MtMi5qcGc/-/0/0?r=266543f853714796d3a116265433a94f',
  },
  {
    match: /\b(rmc|monte\s*carlo)\s*party\b/i,
    url: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfUEFSVFlfV2ViUmFkaW8tMTYwMTUyODY5MTI1NS0yLmpwZy1ybWNfcGFydHktMi5qcGc/-/0/0?r=43e3ce305664a9cb9110e7898ed8f996',
  },
  {
    match: /\b(rmc|monte\s*carlo)\s*planet\b/i,
    url: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfUExBTkVUX1dlYlJhZGlvX3NwZWNpYWwtMTY1MDQ0NzIyMzA4Mi0yLmpwZy1wbGFuZXQtMi5qcGc/-/0/0?r=9e150cdc4f8f972a0aa3ea1d63eb0afe',
  },
  {
    match: /\b(rmc|monte\s*carlo)\s*romantic\s*rock\b/i,
    url: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfUk9NQU5USUNfUk9DS19XZWJSYWRpby0xNjAxNTI4ODU5NTY5LTIuanBnLXJvbWFudGljX3JvY2stMi5qcGc/-/0/0?r=176c4f962c5d461cf6e8da30c2780ab3',
  },
  {
    match: /\b(rmc|monte\s*carlo)\s*r\s*&\s*b\b/i,
    url: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfUkJfV2ViUmFkaW8tMTYwMTUyODc4MjI5Ni0yLmpwZy1yYWRpb19tb250ZV9jYXJsb19yX2ItMi5qcGc/-/0/0?r=e23f3b85bd59e30b94b5f03ea46eee30',
  },
  {
    match: /\b(rmc\s*running|running\s*radio)\b/i,
    url: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfUlVOTklOR19XZWJSYWRpby0xNjAxNTI4OTE4Mzc3LTIuanBnLXJ1bm5pbmdfcmFkaW8tMi5qcGc/-/0/0?r=8b6e38f6090c5230243cf633925b02a7',
  },
  {
    match: /\b(rmc|monte\s*carlo)\s*voyage\b/i,
    url: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfVk9ZQUdFX1dlYlJhZGlvLTE2MDE1MjkwMzU4ODktMi5qcGctcmFkaW9fbW9udGVfY2FybG9fdm95YWdlX3ZveWFnZS0yLmpwZw/-/0/0?r=2eec13da498095d056ab92a8b9d39e19',
  },
  {
    match: /\b(rmc|monte\s*carlo)\s*vip\s*lounge\b/i,
    url: 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucmFkaW9tb250ZWNhcmxvLm5ldC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMC9STUNfVklQTG91bmdlX1dlYlJhZGlvLTE2MDE1Mjg5ODMxNDUtMi5qcGctcm1jX3ZpcF9sb3VuZ2UtMi5qcGc/-/0/0?r=82da301ef23346551bbc47a6b87360c0',
  },
];

export function extractDomainFromUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  try {
    const withProto = /^https?:\/\//i.test(rawUrl.trim())
      ? rawUrl.trim()
      : `https://${rawUrl.trim()}`;
    const parsed = new URL(withProto);
    if (!parsed.hostname || /^\d+\.\d+\.\d+\.\d+$/.test(parsed.hostname)) {
      return null;
    }
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isLowResIcoUrl(url?: string): boolean {
  if (!url) return true;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed) return true;
  return (
    /\.ico(\?|$)/i.test(trimmed) ||
    trimmed.includes('google.com/s2/favicons') ||
    trimmed.includes('icons.duckduckgo.com')
  );
}

/**
 * Returns the exact high-resolution official logo URL when a station belongs to a known broadcaster
 * whose Radio Browser entry either lacks a favicon or only has a tiny .ico file.
 */
export function getHighResOfficialLogo(
  name: string,
  homepage?: string
): string | null {
  const n = (name || '').trim();
  const h = (homepage || '').toLowerCase();
  const domain = extractDomainFromUrl(homepage) || '';

  // 1. Specific RMC / Radio Monte Carlo thematic channels
  for (const item of RMC_CHANNEL_LOGOS) {
    if (item.match.test(n)) {
      return item.url;
    }
  }

  // 2. Main Radio Monte Carlo (Italy / Monaco)
  if (
    domain.includes('radiomontecarlo.net') ||
    /\b(rmc|radio\s*monte\s*carlo|radio\s*montecarlo)\b/i.test(n)
  ) {
    if (domain.includes('montecarlo.ru') || /[а-яА-Я]/.test(n)) {
      return 'https://montecarlo.ru/uploads/c3/bf/7f1e845364f1656b13c402e6e8ee.png';
    }
    if (domain.includes('mc-doualiya.com') || /doualiya/i.test(n)) {
      return 'https://www.mc-doualiya.com/apple-touch-icon.png';
    }
    if (domain.includes('bfmtv.com')) {
      return 'https://rmc.bfmtv.com/apple-icon-228x228.png';
    }
    return RMC_MAIN_LOGO;
  }

  // 3. Magic FM (Romania)
  if (domain.includes('magicfm.ro') || /\bmagic\s*fm\b/i.test(n)) {
    return 'https://www.magicfm.ro/apple-touch-icon.png';
  }

  // 4. Kiss FM (Romania)
  if (domain.includes('kissfm.ro') || /\bkiss\s*fm\b/i.test(n)) {
    return 'https://www.kissfm.ro/apple-touch-icon.png';
  }

  // 5. Rock FM (Romania)
  if (domain.includes('rockfm.ro') || /\brock\s*fm\b/i.test(n)) {
    return 'https://www.rockfm.ro/apple-touch-icon.png';
  }

  // 6. Europa FM (Romania)
  if (domain.includes('europafm.ro') || /\beuropa\s*fm\b/i.test(n)) {
    return 'https://www.europafm.ro/icons/apple-touch-icon.png';
  }

  // 7. Virgin Radio (Italy vs Romania)
  if (domain.includes('virginradio.ro') || /\bvirgin\s*radio\s*romania\b/i.test(n)) {
    return 'https://virginradio.ro/icons/apple-touch-icon.png';
  }
  if (domain.includes('virginradio.it') || /\bvirgin\s*radio\b/i.test(n)) {
    return 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cudmlyZ2lucmFkaW8uaXQvd3AtY29udGVudC91cGxvYWRzLzIwMjUvMDMvdGh1bWIuanBn/-/0/0?r=a3d823a20cb249bf66cbd5863ec1fbd2';
  }

  // 8. Radio 105 (Italy)
  if (domain.includes('105.net') || /\bradio\s*105\b/i.test(n)) {
    return 'https://upload.wikimedia.org/wikipedia/it/0/01/105.png';
  }

  // 9. R101 (Italy)
  if (domain.includes('r101.it') || /\br101\b/i.test(n)) {
    return 'https://img-api.cloud.mediaset.net/api/images/rd/v1/ita/aHR0cHM6Ly93d3cucjEwMS5pdC93cC1jb250ZW50L3VwbG9hZHMvMjAyNS8xMS9wbGFjZWhvbGRlci5qcGc/-/0/0?r=863e67cdc671724934e5c8acccae5137';
  }

  // 10. Radio România Actualități
  if (
    domain.includes('romania-actualitati.ro') ||
    /rom[aâ]nia\s*actualit/i.test(n)
  ) {
    return 'https://www.romania-actualitati.ro/templates/favicon/apple-touch-icon.png';
  }

  // 11. Digi FM & ProFM
  if (domain.includes('digi-fm.ro') || /\bdigi\s*fm\b/i.test(n)) {
    return 'https://www.digi-fm.ro/static/theme-repo/apple-touch-icon.png';
  }
  if (domain.includes('profm.ro') || /\bpro\s*fm\b/i.test(n)) {
    return 'https://www.profm.ro/static/theme-repo/apple-touch-icon.png';
  }
  if (domain.includes('radiozu.ro') || /\bradio\s*zu\b/i.test(n)) {
    return 'https://radiozu.ro/favicon-96x96.png';
  }
  if (domain.includes('dfm.ru') || /\bdfm\b/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/radio-dfm.webp';
  }

  // 12. Major Russian Radio Stations (Радио 7 на семи холмах, Радио Ваня, Русское Радио, Европа Плюс, Ретро FM, etc.)
  if (
    domain.includes('radio7.ru') ||
    /радио\s*7|на\s*семи\s*холмах|radio\s*7\b/i.test(n)
  ) {
    return 'https://top-radio.ru/assets/image/radio/180/radio7-na7holmah.png';
  }
  if (domain.includes('radiovanya.ru') || /радио\s*ваня|radio\s*vanya/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/radio-vanya.png';
  }
  if (domain.includes('rusradio.ru') || /русское\s*радио|russkoe\s*radio/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/rusradio.png';
  }
  if (domain.includes('europaplus.ru') || /европа\s*плюс|europa\s*plus/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/europa-plus.png';
  }
  if (domain.includes('retrofm.ru') || /ретро\s*fm|ретро\s*фм|retro\s*fm/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/retro_fm.png';
  }
  if (domain.includes('dorognoe.ru') || /дорожное\s*радио|dorozhnoe/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/dorojnoe.png';
  }
  if (domain.includes('avtoradio.ru') || /авторадио|avtoradio/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/auto.png';
  }
  if (/дискотека\s*90|супердискотека\s*90|superdiskoteka/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/radiorecod.png';
  }
  if (domain.includes('radiorecord.ru') || /радио\s*рекорд|radio\s*record/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/radiorecod.png';
  }
  if (domain.includes('radiodacha.ru') || /радио\s*дача|radio\s*dacha/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/radio-dacha.png';
  }
  if (domain.includes('novoeradio.ru') || /новое\s*радио|novoe\s*radio/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/novoe-v2.png';
  }
  if (domain.includes('loveradio.ru') || /love\s*radio|лав\s*радио/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/loveradio2.png';
  }
  if (domain.includes('veseloeradio.ru') || /юмор\s*fm|юмор\s*фм|yumor\s*fm/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/yumor-fm.png';
  }
  if (domain.includes('radioshanson.ru') || /радио\s*шансон|shanson/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/shanson.png';
  }
  if (domain.includes('hitfm.ru') || /хит\s*fm|хит\s*фм/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/hit-fm.png';
  }
  if (domain.includes('energyfm.ru') || /радио\s*энерджи|energy\s*fm|\bnrg\b/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/nrg-energy.webp';
  }
  if (domain.includes('comedy-radio.ru') || /comedy\s*radio|камеди\s*радио/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/comedyradio.png';
  }
  if (domain.includes('relax-fm.ru') || /relax\s*fm|релакс\s*фм/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/relaxfmru.png';
  }
  if (domain.includes('nashe.ru') || /наше\s*радио|nashe\s*radio/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/nase-radio.png';
  }
  if (domain.includes('radiomayak.ru') || /радио\s*маяк|mayak/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/radiomayak.png';
  }
  if (domain.includes('maximum.ru') || /радио\s*maximum|радио\s*максимум/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/mamimum2.jpg';
  }
  if (domain.includes('zharafm.ru') || /жара\s*fm|zhara\s*fm/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/Zhara-fm.jpg';
  }
  if (domain.includes('russkijhit.ru') || /русский\s*хит/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/ruhitnew.png';
  }
  if (domain.includes('likefm.ru') || /\blike\s*fm\b|лайк\s*фм/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/likefm.png';
  }
  if (/калина\s*красная/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/kalina-krasnaya.png';
  }
  if (/милицейская\s*волна/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/radiomv.jpg';
  }
  if (/эльдорадио|eldoradio/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/eldo-radio.jpg';
  }
  if (/питер\s*fm|piter\s*fm/i.test(n)) {
    return 'https://top-radio.ru/assets/image/radio/180/piterfm.png';
  }

  void h;
  return null;
}

/**
 * Builds an ordered list of candidate logo URLs for a station, prioritizing
 * high-resolution artwork over low-res browser .ico favicons.
 */
export function buildStationLogoCandidates(
  name: string,
  favicon?: string,
  homepage?: string
): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const add = (url?: string | null) => {
    const trimmed = url?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    candidates.push(trimmed);
  };

  const trimmedFav = favicon?.trim() || '';
  const hasHighResFavicon = trimmedFav && !isLowResIcoUrl(trimmedFav);

  // 1. Check our verified high-res official station/channel logo registry FIRST
  const officialHighRes = getHighResOfficialLogo(name, homepage);
  if (officialHighRes) {
    add(officialHighRes);
    if (/^https?:\/\//i.test(officialHighRes)) {
      add(`/api/tv-proxy?url=${encodeURIComponent(officialHighRes)}`);
    }
  }

  // 2. If the station already has a specific high-res artwork URL in Radio Browser or M3U, use it next
  if (hasHighResFavicon) {
    add(trimmedFav);
    if (trimmedFav.startsWith('http://')) {
      add(trimmedFav.replace(/^http:\/\//i, 'https://'));
    }
    if (/^https?:\/\//i.test(trimmedFav)) {
      add(`/api/tv-proxy?url=${encodeURIComponent(trimmedFav)}`);
    }
  }

  // 3. If the station has a homepage domain, try its high-res apple-touch-icon.png / apple-icon.png before any .ico
  const domain = extractDomainFromUrl(homepage);
  if (domain) {
    add(`https://${domain}/apple-touch-icon.png`);
    add(`https://${domain}/apple-icon.png`);
    add(`https://${domain}/icon.png`);
  }

  // 4. Fallback to original .ico favicon if present
  if (trimmedFav) {
    add(trimmedFav);
    if (trimmedFav.startsWith('http://')) {
      add(trimmedFav.replace(/^http:\/\//i, 'https://'));
    }
  }

  return candidates;
}

