const IEDEM_VOD_BASE_URL = 'http://895890bd73a7.jmeekos.com/api/v1/';
const IEDEM_VOD_KEY = 'b55f67862ee6fe7-798a6b713ccb40d';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const reqUrl = new URL(req.url);
    const posterUrl = reqUrl.searchParams.get('poster');

    // Proxy HTTP poster images over HTTPS to avoid Mixed Content
    if (posterUrl && /^https?:\/\//i.test(posterUrl)) {
      const imgRes = await fetch(posterUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (SmartTV; Linux; Tizen 6.5) AppleWebKit/537.36',
        },
      });
      if (!imgRes.ok) {
        return new Response('Poster not found', {
          status: imgRes.status,
          headers: CORS_HEADERS,
        });
      }
      const buf = await imgRes.arrayBuffer();
      return new Response(buf, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': imgRes.headers.get('content-type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=604800',
        },
      });
    }

    let payload = { key: IEDEM_VOD_KEY };

    if (req.method === 'POST') {
      try {
        const bodyJson = await req.json();
        if (bodyJson && typeof bodyJson === 'object') {
          payload = { ...bodyJson, key: bodyJson.key || IEDEM_VOD_KEY };
        }
      } catch {
        // fallback to query params
      }
    }

    for (const [k, v] of reqUrl.searchParams.entries()) {
      if (k === 'poster') continue;
      if (k === 'fid' || k === 'offset' || k === 'limit' || k === 'genre' || k === 'vc') {
        payload[k] = Number(v);
      } else {
        payload[k] = v;
      }
    }

    const upstream = await fetch(IEDEM_VOD_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'OTT-Play/1.0',
      },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=120',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'iEdem VOD proxy error',
      }),
      {
        status: 502,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json; charset=utf-8',
        },
      }
    );
  }
};

