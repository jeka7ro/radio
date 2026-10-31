export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  try {
    const reqUrl = new URL(req.url);
    const targetUrl = reqUrl.searchParams.get('url');
    const customRef = reqUrl.searchParams.get('ref') || '';
    const customUa = reqUrl.searchParams.get('ua') || '';
    const rawMode = reqUrl.searchParams.get('raw') === '1';

    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      return new Response('Invalid or missing url parameter', {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    const parsedTarget = new URL(targetUrl);
    const refererHeader = customRef || `${parsedTarget.origin}/`;
    let originHeader = parsedTarget.origin;
    if (customRef) {
      try {
        originHeader = new URL(customRef).origin;
      } catch {
        // keep parsedTarget.origin
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 11000);

    const upstreamRes = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent':
          customUa ||
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Referer: refererHeader,
        Origin: originHeader,
        Accept: '*/*',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!upstreamRes.ok) {
      return new Response(`Upstream error ${upstreamRes.status}`, {
        status: upstreamRes.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    const finalUrl = upstreamRes.url || targetUrl;
    const contentType = (
      upstreamRes.headers.get('content-type') || ''
    ).toLowerCase();

    const isM3u8 =
      contentType.includes('mpegurl') ||
      contentType.includes('m3u') ||
      /\.m3u8(\?|$)/i.test(finalUrl);

    const extraParams = `${
      customRef ? `&ref=${encodeURIComponent(customRef)}` : ''
    }${customUa ? `&ua=${encodeURIComponent(customUa)}` : ''}`;

    const buildProxyUrl = (rawUri) => {
      try {
        const resolved = new URL(rawUri.trim(), finalUrl).toString();
        return `/api/tv-proxy?url=${encodeURIComponent(resolved)}${extraParams}`;
      } catch {
        return rawUri;
      }
    };

    if (isM3u8) {
      const text = await upstreamRes.text();
      if (rawMode) {
        return new Response(text, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache, no-store',
          },
        });
      }

      const rewritten = text
        .split(/\r?\n/)
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;
          if (trimmed.startsWith('#')) {
            return line.replace(/URI="([^"]+)"/gi, (_m, uri) => {
              return `URI="${buildProxyUrl(uri)}"`;
            });
          }
          return buildProxyUrl(trimmed);
        })
        .join('\n');

      return new Response(rewritten, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
          'Cache-Control': 'no-cache, no-store',
        },
      });
    }

    const arrayBuffer = await upstreamRes.arrayBuffer();
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type':
          upstreamRes.headers.get('content-type') || 'video/mp2t',
        'Cache-Control': 'public, max-age=10',
      },
    });
  } catch (err) {
    return new Response(
      `Proxy error: ${err instanceof Error ? err.message : 'Unknown'}`,
      {
        status: 502,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/plain; charset=utf-8',
        },
      }
    );
  }
};

