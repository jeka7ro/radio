const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function parseDurationTextToSeconds(raw = '') {
  if (!raw) return 0;
  const parts = String(raw)
    .trim()
    .split(':')
    .map((p) => parseInt(p.replace(/\D/g, ''), 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] || 0;
}

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=180',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const params = event.queryStringParameters || {};
  const cleanQuery = String(params.q || '').trim() || 'trending romania';

  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(
      cleanQuery
    )}&hl=ro&gl=RO`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': DESKTOP_UA,
        'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
        Cookie: 'CONSENT=YES+cb.20210328-17-p0.en+FX+410',
      },
    });

    if (!res.ok) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: false, items: [] }),
      };
    }

    const html = await res.text();
    const match = html.match(/var ytInitialData = (\{.+?\});<\/script>/);
    if (!match?.[1]) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, items: [] }),
      };
    }

    const data = JSON.parse(match[1]);
    const items = [];
    const seen = new Set();

    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (node.videoRenderer && node.videoRenderer.videoId) {
        const vr = node.videoRenderer;
        const videoId = String(vr.videoId);
        if (!seen.has(videoId)) {
          seen.add(videoId);
          const title =
            vr.title?.runs?.map((r) => r.text || '').join('') ||
            vr.title?.simpleText ||
            '';
          const channel =
            vr.ownerText?.runs?.[0]?.text ||
            vr.longBylineText?.runs?.[0]?.text ||
            'YouTube';
          const duration = vr.lengthText?.simpleText || '';
          const isLive =
            !duration &&
            Array.isArray(vr.badges) &&
            vr.badges.some((b) =>
              String(b?.metadataBadgeRenderer?.style || '').includes('LIVE')
            );
          const views =
            vr.shortViewCountText?.simpleText ||
            vr.viewCountText?.simpleText ||
            vr.viewCountText?.runs?.map((r) => r.text || '').join('') ||
            '';
          const published = vr.publishedTimeText?.simpleText || '';
          if (title) {
            items.push({
              videoId,
              title,
              channel,
              duration: isLive ? 'LIVE' : duration || 'HD',
              durationSec: parseDurationTextToSeconds(duration),
              views,
              published,
              thumb: `https://i.ytimg.com/vi/${videoId}/hq720.jpg`,
              isLive,
            });
          }
        }
        return;
      }
      for (const val of Object.values(node)) {
        if (items.length < 36) {
          walk(val);
        }
      }
    }

    walk(data);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, items }),
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: false, items: [], error: String(err) }),
    };
  }
}

