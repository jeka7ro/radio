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
    const audioIdxParam = reqUrl.searchParams.get('audioIdx');
    const requestedAudioIdx =
      audioIdxParam !== null && /^\d+$/.test(audioIdxParam)
        ? Number(audioIdxParam)
        : -1;

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

    if (rawMode) {
      const text = await upstreamRes.text();
      return new Response(text, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': contentType.includes('json')
            ? 'application/json; charset=utf-8'
            : 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-store',
        },
      });
    }

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
      let text = await upstreamRes.text();
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

      const hasSegmentOrVariant = (m3uText) =>
        m3uText
          .split(/\r?\n/)
          .some((l) => {
            const t = l.trim();
            return (t && !t.startsWith('#')) || /URI="[^"]+"/i.test(t);
          });
      if (text.includes('#EXT-X-') && !hasSegmentOrVariant(text)) {
        await new Promise((r) => setTimeout(r, 450));
        try {
          const retryRes = await fetch(targetUrl, {
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
          });
          if (retryRes.ok) {
            text = await retryRes.text();
          }
        } catch {
          // ignore retry error
        }
        if (!hasSegmentOrVariant(text)) {
          return new Response('Upstream HLS playlist has 0 active segments', {
            status: 503,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'text/plain; charset=utf-8',
              'Cache-Control': 'no-cache, no-store',
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
      const audioLinesCount = rawLines.filter(
        (l) =>
          l.trim().startsWith('#EXT-X-MEDIA:') && /TYPE=AUDIO/i.test(l)
      ).length;
      const useExplicitAudioIdx =
        requestedAudioIdx >= 0 && requestedAudioIdx < audioLinesCount;
      const hasOriginalAudioTrack = rawLines.some(
        (l) =>
          l.trim().startsWith('#EXT-X-MEDIA:') &&
          /TYPE=AUDIO/i.test(l) &&
          (/LANGUAGE="en"/i.test(l) ||
            /NAME="[^"]*(?:eng|orig)[^"]*"/i.test(l))
      );
      let promotedOriginalAudio = false;
      let currentAudioLineIdx = 0;

      const rewrittenLines = rawLines.map((line) => {
        let currentLine = line;
        const trimmed = currentLine.trim();
        if (!trimmed) return currentLine;
        if (
          (useExplicitAudioIdx || hasOriginalAudioTrack) &&
          trimmed.startsWith('#EXT-X-MEDIA:') &&
          /TYPE=AUDIO/i.test(trimmed)
        ) {
          const thisAudioIdx = currentAudioLineIdx++;
          const shouldPromote = useExplicitAudioIdx
            ? thisAudioIdx === requestedAudioIdx
            : !promotedOriginalAudio &&
              (/LANGUAGE="en"/i.test(trimmed) ||
                /NAME="[^"]*(?:eng|orig)[^"]*"/i.test(trimmed));
          if (shouldPromote) {
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
        // Resolve HTTPS binary video segments directly unless the CDN enforces User-Agent / IP signature binding (e.g. VK Video okcdn.ru / vkuser.net).
        const isHeavySegment = /\.(ts|m4s|mp4|mkv|webm|aac)(\?|$)/i.test(
          trimmed
        );
        if (isHeavySegment) {
          try {
            const resolvedSegUrl = new URL(trimmed, finalUrl).toString();
            const requiresSignedProxy =
              /(okcdn\.ru|vkuser\.net|vkuservideo\.net|mycdn\.me|rtbcdn\.ru|rutube\.ru|srcAg|srcIp)/i.test(
                resolvedSegUrl
              );
            if (resolvedSegUrl.startsWith('https://') && !requiresSignedProxy) {
              return resolvedSegUrl;
            }
          } catch {
            // fall through to proxy URL
          }
        }
        return buildProxyUrl(trimmed);
      });

      let rewritten = rewrittenLines.join('\n');
      if (rewrittenLines.some((l) => l.trim().startsWith('#EXT-X-STREAM-INF:'))) {
        const headerLines = [];
        const variantPairs = [];
        for (let i = 0; i < rewrittenLines.length; i++) {
          const ln = rewrittenLines[i];
          const tr = ln.trim();
          if (tr.startsWith('#EXT-X-STREAM-INF:')) {
            let uriLine = '';
            while (i + 1 < rewrittenLines.length) {
              const nextLn = rewrittenLines[i + 1];
              const nextTr = nextLn.trim();
              i++;
              if (!nextTr) continue;
              uriLine = nextLn;
              break;
            }
            if (uriLine) {
              const resMatch = tr.match(/RESOLUTION=(\d+)x(\d+)/i);
              const bwMatch = tr.match(/(?:^|,)BANDWIDTH=(\d+)/i);
              const w = resMatch ? Number(resMatch[1]) : 0;
              const h = resMatch ? Number(resMatch[2]) : 0;
              const height = w && h ? Math.min(w, h) : h;
              const bandwidth = bwMatch ? Number(bwMatch[1]) : 0;
              variantPairs.push({ infLine: ln, uriLine, height, bandwidth });
            } else {
              headerLines.push(ln);
            }
          } else {
            headerLines.push(ln);
          }
        }
        if (variantPairs.length > 1) {
          variantPairs.sort(
            (a, b) => b.height - a.height || b.bandwidth - a.bandwidth
          );
          rewritten = [
            ...headerLines,
            ...variantPairs.flatMap((p) => [p.infLine, p.uriLine]),
          ].join('\n');
        }
      }

      return new Response(rewritten, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
          'Cache-Control': 'no-cache, no-store',
        },
      });
    }

    // Only pipe plain HTTP streams over HTTPS (for Mixed Content); all HTTPS streams use 302 redirect (0 Netlify bandwidth).
    if (finalUrl.startsWith('http://')) {
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

