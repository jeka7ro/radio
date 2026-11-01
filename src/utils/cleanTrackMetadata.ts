export interface ParsedTrackFields {
  artist: string;
  title: string;
  album?: string;
}

const ISRC_REGEX = /\b[A-Z]{2}[A-Z0-9]{3}\d{7}\b/gi;
const ISO_TIMESTAMP_REGEX = /\b\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?\b/g;
const ID3_GARBAGE_REGEX = /\b(?:ID3|TIT2|TPE1|TPE2|TALB|TXXX|TRCK|TYER|TDRC|TCON|TCOP|TSSE|PRIV|APIC|WXXX|COMM|USLT|StreamTitle)\b/g;

/**
 * Parses raw ICY / Shoutcast / Icecast / Mediaset (~) / Adswizz / ID3 metadata
 * into clean { artist, title, album } fields, stripping technical codes (ISRC, timestamps, durations).
 */
export function parseRawStreamMetadata(
  rawInput: string | null | undefined,
  stationName = ''
): ParsedTrackFields | null {
  if (!rawInput) return null;

  let raw = rawInput
    .replace(/\0+/g, ' ')
    .replace(ID3_GARBAGE_REGEX, ' ')
    .replace(/StreamUrl='[^']*';?/gi, ' ')
    .replace(/StreamTitle='([^']*)';?/gi, '$1')
    .trim();

  if (!raw || raw.length < 2) return null;

  // Ignore Apple HLS transport stream private timestamps
  if (/com\.apple\.streaming\.transportStreamTimestamp/i.test(raw)) {
    return null;
  }

  // 1. Handle JSON payloads if any station sends {"title":"...","artist":"..."}
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const t = String(parsed.title || parsed.song || parsed.track || '').trim();
      const a = String(parsed.artist || parsed.performer || '').trim();
      if (t) {
        return { artist: a, title: t };
      }
    } catch {
      // fall through
    }
  }

  // 2. Handle Adswizz / Triton key="value" metadata e.g. title="Song" artist="Artist"
  if (/\b(?:title|artist|text)\s*=\s*["']/i.test(raw)) {
    const titleMatch =
      raw.match(/\btitle\s*=\s*["']([^"']+)["']/i) ||
      raw.match(/\btext\s*=\s*["']([^"']+)["']/i);
    const artistMatch = raw.match(/\bartist\s*=\s*["']([^"']+)["']/i);
    if (titleMatch || artistMatch) {
      const extractedTitle = (titleMatch?.[1] || '').trim();
      const extractedArtist = (artistMatch?.[1] || '').trim();
      if (extractedTitle) {
        return { artist: extractedArtist, title: extractedTitle };
      }
    }
  }

  // 3. Handle Mediaset / RMC / Virgin Radio / Radio 105 tilde-delimited format:
  // "Long As I Live~Toni Braxton~~2018~USUM71800544~276~2026-10-31T08:48:00"
  // Format: Title ~ Artist ~ Album ~ Year ~ ISRC ~ Duration ~ Timestamp
  if (raw.includes('~')) {
    const tildeParts = raw.split('~').map((part) =>
      part
        .replace(ISO_TIMESTAMP_REGEX, '')
        .replace(ISRC_REGEX, '')
        .trim()
    );

    const isTechnicalToken = (val: string): boolean => {
      if (!val) return true;
      if (/^\d+$/.test(val)) return true; // year or duration in seconds
      if (/^\d{4}-\d{2}/.test(val)) return true; // partial ISO date
      if (/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i.test(val)) return true; // ISRC
      if (/^(?:MUS|HIT|JNG|COM| ADV|SPOT|LIN|SIG|ids|NWS)$/i.test(val)) return true;
      return false;
    };

    const candidateTitle = !isTechnicalToken(tildeParts[0] || '') ? tildeParts[0] : '';
    const candidateArtist = !isTechnicalToken(tildeParts[1] || '') ? tildeParts[1] : '';
    const candidateAlbum =
      tildeParts[2] && !isTechnicalToken(tildeParts[2]) && tildeParts[2].length > 1
        ? tildeParts[2]
        : undefined;

    if (candidateTitle && candidateArtist) {
      // Check if both fields are just the station name
      const normStation = stationName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normTitle = candidateTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normArtist = candidateArtist.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normStation && normTitle === normStation && normArtist === normStation) {
        return null;
      }
      return {
        artist: candidateArtist,
        title: candidateTitle,
        album: candidateAlbum,
      };
    }

    if (candidateTitle || candidateArtist) {
      const single = candidateTitle || candidateArtist;
      return parseRawStreamMetadata(single, stationName);
    }
    return null;
  }

  // 4. Clean remaining technical artifacts from standard strings
  let cleaned = raw
    .replace(ISO_TIMESTAMP_REGEX, ' ')
    .replace(ISRC_REGEX, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(
      /\(\s*(?:live|bonus|remix|radio edit|edit|extended|version|ost|from|official|video|audio|hd|hq|\d{4})[^)]*\)/gi,
      ' '
    )
    .replace(/\s+[-|]\s+\d{1,2}:\d{2}\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 2) return null;

  // Normalize pipe "|" or slash " / " separators to " - " if no standard dash separator exists
  if (!/\s+[-–—]\s+/.test(cleaned)) {
    if (/\s+\|\s+/.test(cleaned)) {
      cleaned = cleaned.replace(/\s+\|\s+/g, ' - ');
    } else if (/\s+\/\s+/.test(cleaned)) {
      cleaned = cleaned.replace(/\s+\/\s+/g, ' - ');
    }
  }

  // Strip 3-part station prefix like "KissFM - Sak Noel - Trumpets" -> "Sak Noel - Trumpets"
  const rawParts = cleaned.split(/\s+[-–—]\s+/);
  if (
    rawParts.length >= 3 &&
    /fm|radio|rmc|virgin|zu|kiss|magic|rock|pro|digi|europa|dfm|retro|hit/i.test(
      rawParts[0]
    )
  ) {
    cleaned = rawParts.slice(1).join(' - ');
  }

  const parts = cleaned
    .split(/\s+[-–—]\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    const artist = parts[0];
    const title = parts.slice(1).join(' - ');
    return { artist, title };
  }

  return { artist: '', title: cleaned };
}

/**
 * Extracts clean text from a raw HLS ID3v2 Uint8Array sample payload,
 * ignoring binary headers and transport stream timestamp PRIV frames.
 */
export function extractTextFromHlsId3Sample(data: Uint8Array): string | null {
  try {
    const rawLatin = new TextDecoder('iso-8859-1').decode(data);
    if (rawLatin.includes('com.apple.streaming.transportStreamTimestamp')) {
      return null;
    }

    const utf8 = new TextDecoder('utf-8', { fatal: false })
      .decode(data)
      .replace(/[^\x20-\x7E\u00A0-\u024F\u0400-\u04FF]/g, ' ')
      .replace(ID3_GARBAGE_REGEX, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!utf8 || utf8.length < 3) return null;
    return utf8.slice(0, 180);
  } catch {
    return null;
  }
}
