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

    const isPls =
      contentType.includes('scpls') || /\.pls(\?|$)/i.test(finalUrl);
    const isM3u8 =
      contentType.includes('mpegurl') ||
      contentType.includes('m3u') ||
      /\.m3u8?(\?|$)/i.test(finalUrl);

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

    if (isPls) {
      const text = await upstreamRes.text();
      const fileMatch = text.match(/^File\d+=(https?:\/\/[^\r\n]+)/im);
      if (fileMatch?.[1]) {
        return new Response(null, {
          status: 302,
          headers: {
            'Access-Control-Allow-Origin': '*',
            Location: buildProxyUrl(fileMatch[1].trim()),
          },
        });
      }
    }

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
      if (!text.includes('#EXT-X-')) {
        const firstStreamLine = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .find((l) => /^https?:\/\//i.test(l));
        if (firstStreamLine && !/\.m3u8(\?|$)/i.test(firstStreamLine)) {
          return new Response(null, {
            status: 302,
            headers: {
              'Access-Control-Allow-Origin': '*',
              Location: buildProxyUrl(firstStreamLine),
            },
          });
        }
      }

      const rawLines = text.split(/\r?\n/).filter((l) => {
        const t = l.trim();
        if (
          t.startsWith('#EXT-X-MEDIA:') &&
          /TYPE=(SUBTITLES|CLOSED-CAPTIONS)/i.test(t)
        ) {
          return false;
        }
        return true;
      });
      const hasOriginalAudioTrack = rawLines.some(
        (l) =>
          l.trim().startsWith('#EXT-X-MEDIA:') &&
          /TYPE=AUDIO/i.test(l) &&
          (/LANGUAGE="en"/i.test(l) ||
            /NAME="[^"]*(?:eng|orig)[^"]*"/i.test(l))
      );
      let promotedOriginalAudio = false;

      const rewritten = rawLines
        .map((line) => {
          let currentLine = line;
          const trimmed = currentLine.trim();
          if (!trimmed) return currentLine;
          if (
            hasOriginalAudioTrack &&
            trimmed.startsWith('#EXT-X-MEDIA:') &&
            /TYPE=AUDIO/i.test(trimmed)
          ) {
            const isOrig =
              !promotedOriginalAudio &&
              (/LANGUAGE="en"/i.test(trimmed) ||
                /NAME="[^"]*(?:eng|orig)[^"]*"/i.test(trimmed));
            if (isOrig) {
              promotedOriginalAudio = true;
              currentLine = currentLine
                .replace(/DEFAULT=NO/gi, 'DEFAULT=YES')
                .replace(/AUTOSELECT=NO/gi, 'AUTOSELECT=YES');
            } else {
              currentLine = currentLine
                .replace(/DEFAULT=YES/gi, 'DEFAULT=NO')
                .replace(/AUTOSELECT=YES/gi, 'AUTOSELECT=NO');
            }
          }
          if (trimmed.startsWith('#EXT-X-STREAM-INF:')) {
            currentLine = currentLine
              .replace(/,?\s*SUBTITLES="[^"]*"/gi, '')
              .replace(/,?\s*CLOSED-CAPTIONS="[^"]*"/gi, '');
          }
          if (trimmed.startsWith('#')) {
            return currentLine.replace(/URI="([^"]+)"/gi, (_m, uri) => {
              return `URI="${buildProxyUrl(uri)}"`;
            });
          }
          // Resolve HTTPS binary video segments directly when no custom Referer is needed;
          // proxy HTTP segments through /api/tv-proxy so https://filmio.my never hits Mixed Content blocks!
          const isHeavySegment = /\.(ts|m4s|mp4|mkv|webm|aac)(\?|$)/i.test(
            trimmed
          );
          if (isHeavySegment) {
            try {
              const resolvedSegUrl = new URL(trimmed, finalUrl).toString();
              if (resolvedSegUrl.startsWith('https://') && !customRef) {
                return resolvedSegUrl;
              }
            } catch {
              // fall through to proxy URL
            }
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

    // For plain HTTP streams or streams requiring custom Referer, pipe the binary body over HTTPS
    // so https://filmio.my never gets blocked by browser Mixed Content policy.
    if (finalUrl.startsWith('http://') || customRef) {
      return new Response(upstreamRes.body, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': contentType || 'video/mp2t',
          'Cache-Control': 'public, max-age=15',
        },
      });
    }

    return new Response(null, {
      status: 302,
      headers: {
        'Access-Control-Allow-Origin': '*',
        Location: finalUrl,
        'Cache-Control': 'public, max-age=30',
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

