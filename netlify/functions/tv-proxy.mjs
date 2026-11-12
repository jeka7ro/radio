// Per-container cache of freshly signed VK Video stream URLs (resolves srcIp mismatch across Netlify AWS Lambda containers)
const vkSignedContainerCache = new Map();
const VK_SIGNED_CACHE_TTL_MS = 20 * 60 * 1000;

async function refreshVkSignedTargetUrl(
  vkId,
  vkQuality,
  originalTargetUrl,
  ua,
  forceRefresh = false
) {
  if (!vkId || !/^-?\d+_\d+$/.test(vkId)) return null;
  let entry = !forceRefresh ? vkSignedContainerCache.get(vkId) : null;
  if (!entry || Date.now() - entry.ts > VK_SIGNED_CACHE_TTL_MS) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6500);
    try {
      const res = await fetch('https://vkvideo.ru/al_video.php?act=show', {
        method: 'POST',
        headers: {
          'User-Agent': ua,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          Origin: 'https://vkvideo.ru',
          Referer: 'https://vkvideo.ru/',
        },
        body: `act=show&al=1&video=${vkId}`,
        signal: ctrl.signal,
      });
      if (!res.ok) return null;
      const text = new TextDecoder('windows-1251').decode(
        await res.arrayBuffer()
      );
      const unescapeUrl = (u) =>
        u ? u.replace(/\\\//g, '/').replace(/\\u0026/g, '&') : '';
      const hlsUrl = unescapeUrl(text.match(/"hls"\s*:\s*"([^"]+)"/)?.[1]);
      const mp4ByHeight = {};
      let maxMp4Url = '';
      let maxMp4Height = 0;
      for (const m of text.matchAll(/"url(\d+)"\s*:\s*"([^"]+)"/g)) {
        const h = Number(m[1]);
        const u = unescapeUrl(m[2]);
        if (h && u) {
          mp4ByHeight[h] = u;
          if (h > maxMp4Height) {
            maxMp4Height = h;
            maxMp4Url = u;
          }
        }
      }
      entry = {
        ts: Date.now(),
        hlsUrl,
        mp4ByHeight,
        maxMp4Url,
        prefixByType: null,
        bestPrefix: '',
      };
      vkSignedContainerCache.set(vkId, entry);
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  const videoTailMatch = originalTargetUrl.match(/\/video\/([^?#]*)/i);
  if (videoTailMatch) {
    const tail = videoTailMatch[1] || '';
    if (!entry.prefixByType && entry.hlsUrl) {
      try {
        const mRes = await fetch(entry.hlsUrl, {
          headers: {
            'User-Agent': ua,
            Referer: 'https://vkvideo.ru/',
            Origin: 'https://vkvideo.ru',
          },
          redirect: 'follow',
        });
        if (mRes.ok) {
          const mTxt = await mRes.text();
          const lines = mTxt.split(/\r?\n/);
          const byType = {};
          let bestH = -1;
          let bestPref = '';
          let pendingH = 0;
          for (const rawLn of lines) {
            const ln = rawLn.trim();
            if (!ln) continue;
            if (ln.startsWith('#EXT-X-STREAM-INF:')) {
              const rm = ln.match(/RESOLUTION=(\d+)x(\d+)/i);
              pendingH = rm ? Math.min(Number(rm[1]), Number(rm[2])) : 0;
              continue;
            }
            if (ln.startsWith('#')) continue;
            const fullVar = new URL(ln, mRes.url || entry.hlsUrl).href;
            const prefMatch = fullVar.match(/^(https?:\/\/[^?#]+\/video\/)/i);
            if (prefMatch) {
              const pref = prefMatch[1];
              const tm = fullVar.match(/\/type\/(\d+)\//i);
              if (tm) byType[tm[1]] = pref;
              if (pendingH > bestH) {
                bestH = pendingH;
                bestPref = pref;
              }
            }
            pendingH = 0;
          }
          entry.prefixByType = byType;
          entry.bestPrefix = bestPref;
        }
      } catch {
        // ignore
      }
    }
    const origType = originalTargetUrl.match(/\/type\/(\d+)\//i)?.[1];
    const targetPrefix =
      (origType && entry.prefixByType?.[origType]) || entry.bestPrefix;
    if (targetPrefix) {
      return `${targetPrefix}${tail}`;
    }
  }

  if (/video\.m3u8/i.test(originalTargetUrl) && entry.hlsUrl) {
    return entry.hlsUrl;
  }
  if (vkQuality && entry.mp4ByHeight[vkQuality]) {
    return entry.mp4ByHeight[vkQuality];
  }
  return entry.maxMp4Url || entry.hlsUrl || null;
}

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
    const rawTargetUrl = reqUrl.searchParams.get('url');
    let targetUrl = rawTargetUrl
      ? rawTargetUrl.replace(
          /\/\/live7digi\.antenaplay\.ro\//gi,
          '//live4ro.antenaplay.ro/'
        )
      : null;
    const customRef = reqUrl.searchParams.get('ref') || '';
    const customUa = reqUrl.searchParams.get('ua') || '';
    const vkParam = (reqUrl.searchParams.get('vk') || '').trim();
    const vkQualityParam = Number(reqUrl.searchParams.get('vkq') || 0);
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

    let parsedTarget = new URL(targetUrl);
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

    const rangeHeader = req.headers.get('range') || '';
    const effectiveUa =
      customUa ||
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    // VK / OK CDN Parallel Byte-Range Accelerator + Signed-IP Self-Healing Proxy:
    // 1) vkuser.net / okcdn.ru binds srcIp + srcAg to the server that called al_video.php and sets Access-Control-Allow-Origin: https://vkvideo.ru (so 302 breaks CORS & IP).
    // 2) On Netlify serverless, different Lambda containers can have different outbound NAT IPs; if okcdn.ru returns 400/403, refreshVkSignedTargetUrl re-signs for THIS container's IP.
    // 3) vkuser.net throttles single HTTP connections (zs=65) to ~220 KB/s; parallel clamped Range slices + ReadableStream deliver 20+ Mbps for segments of any size.
    const isVkThrottledBinary =
      req.method === 'GET' &&
      !rawMode &&
      /(vkuser\.net|okcdn\.ru|mycdn\.me|vkuservideo\.net)/i.test(targetUrl) &&
      !/\.(m3u8?|pls)(\?|$)/i.test(parsedTarget.pathname) &&
      !/\/video\/?$/i.test(parsedTarget.pathname);

    if (isVkThrottledBinary) {
      try {
        const accelCtrl = new AbortController();
        const headTimer = setTimeout(() => accelCtrl.abort(), 5000);
        let headRes = await fetch(targetUrl, {
          method: 'HEAD',
          headers: {
            'User-Agent': effectiveUa,
            Referer: refererHeader,
            Origin: originHeader,
            Accept: '*/*',
          },
          redirect: 'follow',
          signal: accelCtrl.signal,
        });
        clearTimeout(headTimer);

        if (
          !headRes.ok &&
          vkParam &&
          (headRes.status === 400 ||
            headRes.status === 403 ||
            headRes.status === 410)
        ) {
          const healedUrl = await refreshVkSignedTargetUrl(
            vkParam,
            vkQualityParam,
            targetUrl,
            effectiveUa
          );
          if (healedUrl && healedUrl !== targetUrl) {
            targetUrl = healedUrl;
            parsedTarget = new URL(targetUrl);
            headRes = await fetch(targetUrl, {
              method: 'HEAD',
              headers: {
                'User-Agent': effectiveUa,
                Referer: refererHeader,
                Origin: originHeader,
                Accept: '*/*',
              },
              redirect: 'follow',
            });
          }
        }

        let headCt = (headRes.headers.get('content-type') || '').toLowerCase();
        let totalBytes = Number(headRes.headers.get('content-length') || 0);
        let resolvedMediaUrl = headRes.url || targetUrl;

        if ((!headRes.ok || totalBytes <= 0) && headRes.status !== 404) {
          const probeRes = await fetch(targetUrl, {
            method: 'GET',
            headers: {
              'User-Agent': effectiveUa,
              Referer: refererHeader,
              Origin: originHeader,
              Accept: '*/*',
              Range: 'bytes=0-0',
            },
            redirect: 'follow',
          });
          const cr = probeRes.headers.get('content-range') || '';
          const crMatch = cr.match(/\/(\d+)\s*$/);
          if (probeRes.status === 206 && crMatch) {
            totalBytes = Number(crMatch[1]);
            headCt = (probeRes.headers.get('content-type') || '').toLowerCase();
            resolvedMediaUrl = probeRes.url || targetUrl;
          }
          try {
            probeRes.body?.cancel();
          } catch {
            // ignore
          }
        }

        if (
          totalBytes > 0 &&
          !headCt.includes('mpegurl') &&
          !headCt.includes('m3u')
        ) {
          const isTsSeg =
            /\.(ts|m4s|aac)(\?|$)/i.test(parsedTarget.pathname) ||
            headCt.includes('mp2t');
          const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/i);

          const fetchClampedSlice = async (s, e) => {
            for (let attempt = 0; attempt < 2; attempt++) {
              const sr = await fetch(resolvedMediaUrl, {
                method: 'GET',
                headers: {
                  'User-Agent': effectiveUa,
                  Referer: refererHeader,
                  Origin: originHeader,
                  Accept: '*/*',
                  Range: `bytes=${s}-${e}`,
                },
                redirect: 'follow',
              });
              if (sr.ok || sr.status === 206) {
                const u8 = new Uint8Array(await sr.arrayBuffer());
                if (u8.byteLength === e - s + 1) return u8;
              }
            }
            throw new Error('VK slice mismatch');
          };

          const concatUint8 = (arrays) => {
            const sum = arrays.reduce((acc, a) => acc + a.byteLength, 0);
            const merged = new Uint8Array(sum);
            let offset = 0;
            for (const a of arrays) {
              merged.set(a, offset);
              offset += a.byteLength;
            }
            return merged;
          };

          if (isTsSeg && !rangeMatch && totalBytes <= 25 * 1024 * 1024) {
            clearTimeout(timeoutId);
            const sliceSize = 262144;
            const slices = [];
            for (let s = 0; s < totalBytes; s += sliceSize) {
              slices.push([s, Math.min(s + sliceSize - 1, totalBytes - 1)]);
            }
            const maxConc = 8;
            // Fetch the first batch eagerly so any upstream error triggers clean fallback, then stream remaining batches via ReadableStream (bypasses Lambda 6 MB limit!)
            const firstBatch = slices.slice(0, maxConc);
            const firstChunks = await Promise.all(
              firstBatch.map(([s, e]) => fetchClampedSlice(s, e))
            );
            const stream = new ReadableStream({
              async start(streamCtrl) {
                try {
                  for (const chunk of firstChunks) {
                    streamCtrl.enqueue(chunk);
                  }
                  for (let i = maxConc; i < slices.length; i += maxConc) {
                    const batch = slices.slice(i, i + maxConc);
                    const resBatch = await Promise.all(
                      batch.map(([s, e]) => fetchClampedSlice(s, e))
                    );
                    for (const chunk of resBatch) {
                      streamCtrl.enqueue(chunk);
                    }
                  }
                  streamCtrl.close();
                } catch (streamErr) {
                  streamCtrl.error(streamErr);
                }
              },
            });
            return new Response(stream, {
              status: 200,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Expose-Headers':
                  'Content-Length, Content-Type, Accept-Ranges',
                'Content-Type': headCt || 'video/mp2t',
                'Content-Length': String(totalBytes),
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=60',
              },
            });
          }

          // Progressive MP4 / WebM or explicit Range request (capped to 4 MB < Netlify 6 MB limit)
          const maxWindow = 4 * 1024 * 1024;
          const startByte = rangeMatch ? Number(rangeMatch[1]) : 0;
          if (startByte >= totalBytes) {
            return new Response(null, {
              status: 416,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Range': `bytes */${totalBytes}`,
              },
            });
          }
          const requestedEnd =
            rangeMatch && rangeMatch[2]
              ? Number(rangeMatch[2])
              : startByte + maxWindow - 1;
          const endByte = Math.min(
            requestedEnd,
            startByte + maxWindow - 1,
            totalBytes - 1
          );
          const sliceSize = 524288;
          const slices = [];
          for (let s = startByte; s <= endByte; s += sliceSize) {
            slices.push([s, Math.min(s + sliceSize - 1, endByte)]);
          }
          const maxConc = 8;
          const out = new Array(slices.length);
          for (let i = 0; i < slices.length; i += maxConc) {
            const batch = slices.slice(i, i + maxConc);
            const resBatch = await Promise.all(
              batch.map(([s, e]) => fetchClampedSlice(s, e))
            );
            resBatch.forEach((b, idx) => {
              out[i + idx] = b;
            });
          }
          const windowBuf = concatUint8(out);
          return new Response(windowBuf, {
            status: 206,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Expose-Headers':
                'Content-Length, Content-Range, Accept-Ranges, Content-Type',
              'Content-Type': headCt || 'video/mp4',
              'Content-Range': `bytes ${startByte}-${endByte}/${totalBytes}`,
              'Content-Length': String(windowBuf.byteLength),
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'public, max-age=60',
            },
          });
        }
      } catch {
        // Fall through to standard fetch below
      }
    }

    let upstreamRes = await fetch(targetUrl, {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: {
        'User-Agent': effectiveUa,
        Referer: refererHeader,
        Origin: originHeader,
        Accept: '*/*',
        ...(rangeHeader ? { Range: rangeHeader } : {}),
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (
      !upstreamRes.ok &&
      vkParam &&
      (upstreamRes.status === 400 ||
        upstreamRes.status === 403 ||
        upstreamRes.status === 410)
    ) {
      const healedUrl = await refreshVkSignedTargetUrl(
        vkParam,
        vkQualityParam,
        targetUrl,
        effectiveUa
      );
      if (healedUrl && healedUrl !== targetUrl) {
        targetUrl = healedUrl;
        parsedTarget = new URL(targetUrl);
        upstreamRes = await fetch(targetUrl, {
          method: req.method === 'HEAD' ? 'HEAD' : 'GET',
          headers: {
            'User-Agent': effectiveUa,
            Referer: refererHeader,
            Origin: originHeader,
            Accept: '*/*',
            ...(rangeHeader ? { Range: rangeHeader } : {}),
          },
          redirect: 'follow',
          signal: controller.signal,
        });
      }
    }

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
    }${customUa ? `&ua=${encodeURIComponent(customUa)}` : ''}${
      vkParam ? `&vk=${encodeURIComponent(vkParam)}` : ''
    }`;

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

    // Pipe plain HTTP streams (Mixed Content) AND signed-IP/CORS-restricted CDNs (vkuser.net / okcdn.ru); other HTTPS streams use 302 redirect.
    const mustPipeSignedHttps =
      /(okcdn\.ru|vkuser\.net|vkuservideo\.net|mycdn\.me|srcAg=|srcIp=)/i.test(
        finalUrl
      );
    if (finalUrl.startsWith('http://') || mustPipeSignedHttps) {
      const pipeHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers':
          'Content-Length, Content-Range, Accept-Ranges, Content-Type',
        'Content-Type': contentType || 'video/mp2t',
        'Cache-Control': 'public, max-age=15',
      };
      const upLen = upstreamRes.headers.get('content-length');
      const upRange = upstreamRes.headers.get('content-range');
      const upAccept = upstreamRes.headers.get('accept-ranges');
      if (upLen) pipeHeaders['Content-Length'] = upLen;
      if (upRange) pipeHeaders['Content-Range'] = upRange;
      if (upAccept) pipeHeaders['Accept-Ranges'] = upAccept;
      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        headers: pipeHeaders,
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

