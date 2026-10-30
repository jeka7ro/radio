import { LanguageCode } from '../types/radio';

const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  'Europe/Bucharest': 'RO',
  'Europe/Chisinau': 'MD',
  'Europe/London': 'GB',
  'Europe/Berlin': 'DE',
  'Europe/Paris': 'FR',
  'Europe/Rome': 'IT',
  'Europe/Madrid': 'ES',
  'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE',
  'Europe/Vienna': 'AT',
  'Europe/Zurich': 'CH',
  'Europe/Warsaw': 'PL',
  'Europe/Prague': 'CZ',
  'Europe/Budapest': 'HU',
  'Europe/Sofia': 'BG',
  'Europe/Athens': 'GR',
  'Europe/Lisbon': 'PT',
  'Europe/Dublin': 'IE',
  'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO',
  'Europe/Copenhagen': 'DK',
  'Europe/Helsinki': 'FI',
  'Europe/Kyiv': 'UA',
  'Europe/Kiev': 'UA',
  'Europe/Istanbul': 'TR',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Mexico_City': 'MX',
  'America/Sao_Paulo': 'BR',
  'America/Argentina/Buenos_Aires': 'AR',
  'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR',
  'Asia/Singapore': 'SG',
  'Asia/Dubai': 'AE',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Pacific/Auckland': 'NZ',
};

const LANGUAGE_TO_DEFAULT_COUNTRY: Record<string, string> = {
  ro: 'RO',
  de: 'DE',
  fr: 'FR',
  es: 'ES',
  it: 'IT',
  pt: 'PT',
  nl: 'NL',
  pl: 'PL',
  hu: 'HU',
  bg: 'BG',
  el: 'GR',
  sv: 'SE',
  no: 'NO',
  da: 'DK',
  fi: 'FI',
  cs: 'CZ',
  uk: 'UA',
  tr: 'TR',
  ja: 'JP',
  ko: 'KR',
};

/**
 * Automatically detects the user's country ISO 3166-1 alpha-2 code
 * from their system timezone and browser language settings.
 */
export function detectUserCountryCode(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_TO_COUNTRY[tz]) {
      return TIMEZONE_TO_COUNTRY[tz];
    }
  } catch {
    // Ignore Intl errors
  }

  try {
    if (typeof navigator !== 'undefined') {
      const locales = navigator.languages?.length ? navigator.languages : [navigator.language];
      for (const locale of locales) {
        if (!locale) continue;
        // Check region subtag first, e.g., "ro-RO", "en-GB", "de-AT"
        const parts = locale.replace('_', '-').split('-');
        if (parts.length >= 2) {
          const region = parts[parts.length - 1].toUpperCase();
          if (/^[A-Z]{2}$/.test(region)) {
            return region;
          }
        }
        const lang = parts[0].toLowerCase();
        if (LANGUAGE_TO_DEFAULT_COUNTRY[lang]) {
          return LANGUAGE_TO_DEFAULT_COUNTRY[lang];
        }
      }
    }
  } catch {
    // Ignore navigator errors
  }

  return 'RO';
}

/**
 * Converts a 2-letter ISO 3166-1 code (e.g. "RO") into its Unicode flag emoji.
 */
export function getCountryFlagEmoji(isoCode: string): string {
  if (!isoCode || isoCode.length !== 2) return '🌐';
  const upper = isoCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return '🌐';
  const codePoints = [...upper].map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

const displayNamesCache: Partial<Record<LanguageCode, Intl.DisplayNames>> = {};

export function getLocalizedCountryName(
  isoCode: string,
  fallbackName: string,
  language: LanguageCode
): string {
  if (!isoCode || isoCode.length !== 2) return fallbackName;
  try {
    if (!displayNamesCache[language]) {
      displayNamesCache[language] = new Intl.DisplayNames([language], { type: 'region' });
    }
    const localized = displayNamesCache[language]?.of(isoCode.toUpperCase());
    if (localized && localized !== isoCode.toUpperCase()) {
      return localized;
    }
  } catch {
    // Fallback to API name
  }
  return fallbackName;
}

