import type http from 'node:http';
import { Readable } from 'node:stream';

export type WebFetchHandler = (req: Request) => Promise<Response> | Response;

export interface NodeHttpAdapterOptions {
  urlPath?: string;
  mountPrefix?: string;
  extraHeaders?: Record<string, string>;
  defaultPort?: number;
}

export function getRequestPublicOrigin(
  req: http.IncomingMessage,
  defaultPort = 8769
): string {
  const host = String(req.headers.host || `127.0.0.1:${defaultPort}`).trim();
  const xfProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim();
  const proto =
    xfProto === 'https' ||
    host.endsWith('.filmio.my') ||
    host.endsWith('.trycloudflare.com')
      ? 'https'
      : 'http';
  return `${proto}://${host}`;
}

export function resolveNodeRequestPath(
  req: http.IncomingMessage & { originalUrl?: string },
  mountPrefix?: string
): string {
  if (
    typeof req.originalUrl === 'string' &&
    req.originalUrl.startsWith('/')
  ) {
    return req.originalUrl;
  }
  const raw = req.url || '/';
  if (!mountPrefix) {
    return raw.startsWith('/') ? raw : `/${raw}`;
  }
  const cleanPrefix = mountPrefix.replace(/\/+$/, '');
  if (raw === cleanPrefix || raw.startsWith(`${cleanPrefix}?`) || raw.startsWith(`${cleanPrefix}/`)) {
    return raw;
  }
  if (raw.startsWith('/?')) {
    return `${cleanPrefix}${raw.slice(1)}`;
  }
  if (raw === '/' || raw === '') {
    return cleanPrefix;
  }
  return `${cleanPrefix}${raw.startsWith('/') ? raw : `/${raw}`}`;
}

/**
 * Universal Node HTTP (`IncomingMessage`/`ServerResponse`) <-> Web Fetch (`Request`/`Response`)
 * adapter shared by QNAP `server/stream-server.ts` and Vite dev middleware (`vite.config.ts`).
 * Allows canonical `netlify/functions/*.mjs` handlers to execute identically on Netlify,
 * QNAP Docker, and local Vite dev without duplicating handler code.
 */
export async function invokeWebHandlerOnNodeHttp(
  req: http.IncomingMessage & { originalUrl?: string },
  res: http.ServerResponse,
  handler: WebFetchHandler,
  options: NodeHttpAdapterOptions = {}
): Promise<void> {
  try {
    if ((req.method || 'GET').toUpperCase() === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Private-Network': 'true',
        ...(options.extraHeaders || {}),
      });
      res.end();
      return;
    }

    const origin = getRequestPublicOrigin(req, options.defaultPort || 8769);
    const rawPath =
      options.urlPath || resolveNodeRequestPath(req, options.mountPrefix);
    const fullUrl = `${origin}${rawPath.startsWith('/') ? rawPath : `/${rawPath}`}`;

    const webHeaders = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      const lk = k.toLowerCase();
      if (lk === 'connection' || lk === 'transfer-encoding') continue;
      if (typeof v === 'string') webHeaders.set(k, v);
      else if (Array.isArray(v)) webHeaders.set(k, v.join(', '));
    }

    const method = (req.method || 'GET').toUpperCase();
    let bodyBuf: Buffer | undefined;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      if (chunks.length > 0) {
        bodyBuf = Buffer.concat(chunks);
      }
    }

    const ac = new AbortController();
    const abortUpstream = () => {
      if (!ac.signal.aborted) {
        try {
          ac.abort();
        } catch {
          // ignore
        }
      }
    };
    req.once('aborted', abortUpstream);
    res.once('close', () => {
      if (!res.writableEnded) abortUpstream();
    });

    const webReq = new Request(fullUrl, {
      method,
      headers: webHeaders,
      signal: ac.signal,
      ...(bodyBuf ? { body: new Uint8Array(bodyBuf) } : {}),
    });

    const webRes: Response = await handler(webReq);
    if (res.destroyed || res.writableEnded) {
      try {
        webRes.body?.cancel();
      } catch {
        // ignore
      }
      return;
    }

    const outHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Private-Network': 'true',
      ...(options.extraHeaders || {}),
    };
    webRes.headers.forEach((val, key) => {
      const lk = key.toLowerCase();
      if (
        lk === 'transfer-encoding' ||
        lk === 'connection' ||
        lk.startsWith('access-control-allow-')
      ) {
        return;
      }
      outHeaders[key] = val;
    });

    res.writeHead(webRes.status, outHeaders);
    if (method === 'HEAD' || !webRes.body) {
      res.end();
      return;
    }

    const nodeStream = Readable.fromWeb(webRes.body as any);
    const cleanupStream = () => {
      try {
        nodeStream.destroy();
      } catch {
        // ignore
      }
      if (!res.writableEnded && !res.destroyed) {
        try {
          res.end();
        } catch {
          // ignore
        }
      }
    };
    nodeStream.on('error', cleanupStream);
    res.once('close', cleanupStream);
    nodeStream.pipe(res);
  } catch (err) {
    if (!res.headersSent && !res.destroyed) {
      res.writeHead(502, {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json; charset=utf-8',
        ...(options.extraHeaders || {}),
      });
      res.end(
        JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : 'Handler execution failed',
        })
      );
    } else if (!res.writableEnded && !res.destroyed) {
      try {
        res.end();
      } catch {
        // ignore
      }
    }
  }
}
