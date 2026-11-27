import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  invokeWebHandlerOnNodeHttp,
  resolveNodeRequestPath,
  type WebFetchHandler,
} from '../server/nodeHttpAdapter.ts';
import tvProxyHandler from '../netlify/functions/tv-proxy.mjs';

async function withServer(
  handler: WebFetchHandler,
  extraHeaders: Record<string, string> = {}
) {
  const server = http.createServer((req, res) => {
    void invokeWebHandlerOnNodeHttp(req, res, handler, { extraHeaders });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;
  const close = () =>
    new Promise<void>((resolve) => server.close(() => resolve()));
  return { baseUrl, close };
}

test('GET forwards query params, request headers, and attaches extraHeaders + CORS', async () => {
  const { baseUrl, close } = await withServer(
    async (req) => {
      const u = new URL(req.url);
      return new Response(
        JSON.stringify({
          path: u.pathname,
          country: u.searchParams.get('country'),
          custom: req.headers.get('x-test-client'),
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }
      );
    },
    { 'X-Filmio-Proxy': 'qnap-local' }
  );

  try {
    const res = await fetch(`${baseUrl}/api/tv-epg?country=RO`, {
      headers: { 'X-Test-Client': 'lg-webos' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-filmio-proxy'), 'qnap-local');
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    const data = (await res.json()) as {
      path: string;
      country: string;
      custom: string;
    };
    assert.deepEqual(data, {
      path: '/api/tv-epg',
      country: 'RO',
      custom: 'lg-webos',
    });
  } finally {
    await close();
  }
});

test('POST forwards JSON body cleanly (iedem-vod style)', async () => {
  const { baseUrl, close } = await withServer(async (req) => {
    const body = (await req.json()) as { action?: string; fid?: number };
    return new Response(
      JSON.stringify({ ok: true, method: req.method, received: body }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  });

  try {
    const res = await fetch(`${baseUrl}/api/iedem-vod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'info', fid: 42 }),
    });
    assert.equal(res.status, 201);
    const data = (await res.json()) as {
      ok: boolean;
      method: string;
      received: { action: string; fid: number };
    };
    assert.deepEqual(data, {
      ok: true,
      method: 'POST',
      received: { action: 'info', fid: 42 },
    });
  } finally {
    await close();
  }
});

test('Streaming ReadableStream response pipes chunks and HEAD omits body', async () => {
  const { baseUrl, close } = await withServer(async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('#EXTM3U\n'));
        controller.enqueue(new TextEncoder().encode('#EXTINF:4.0,\nseg0.ts\n'));
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'application/vnd.apple.mpegurl' },
    });
  });

  try {
    const getRes = await fetch(`${baseUrl}/api/tv-proxy?url=test`);
    assert.equal(getRes.status, 200);
    assert.equal(
      getRes.headers.get('content-type'),
      'application/vnd.apple.mpegurl'
    );
    assert.equal(await getRes.text(), '#EXTM3U\n#EXTINF:4.0,\nseg0.ts\n');

    const headRes = await fetch(`${baseUrl}/api/tv-proxy?url=test`, {
      method: 'HEAD',
    });
    assert.equal(headRes.status, 200);
    assert.equal(await headRes.text(), '');
  } finally {
    await close();
  }
});

test('OPTIONS returns 204 with Private-Network CORS headers', async () => {
  const { baseUrl, close } = await withServer(async () => new Response('nope'));
  try {
    const res = await fetch(`${baseUrl}/api/tv-proxy`, { method: 'OPTIONS' });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    assert.equal(
      res.headers.get('access-control-allow-private-network'),
      'true'
    );
  } finally {
    await close();
  }
});

test('Canonical netlify/functions/tv-proxy.mjs blocks SSRF targets with 403 via adapter', async () => {
  const { baseUrl, close } = await withServer(tvProxyHandler, {
    'X-Filmio-Proxy': 'qnap-local',
  });
  try {
    const loopback = await fetch(
      `${baseUrl}/api/tv-proxy?url=${encodeURIComponent('http://127.0.0.1:80/secret')}`
    );
    assert.equal(loopback.status, 403);
    assert.equal(loopback.headers.get('x-filmio-proxy'), 'qnap-local');

    const metadata = await fetch(
      `${baseUrl}/api/tv-proxy?url=${encodeURIComponent('http://169.254.169.254/latest/meta-data/')}`
    );
    assert.equal(metadata.status, 403);
  } finally {
    await close();
  }
});

test('resolveNodeRequestPath reconstructs Connect/Vite stripped mount paths', () => {
  assert.equal(
    resolveNodeRequestPath({ url: '/?country=RO' } as http.IncomingMessage, '/api/tv-epg'),
    '/api/tv-epg?country=RO'
  );
  assert.equal(
    resolveNodeRequestPath(
      { url: '/?url=abc', originalUrl: '/api/tv-proxy?url=abc' } as http.IncomingMessage & {
        originalUrl?: string;
      },
      '/api/tv-proxy'
    ),
    '/api/tv-proxy?url=abc'
  );
  assert.equal(
    resolveNodeRequestPath({ url: '/api/radio-meta?name=Kiss' } as http.IncomingMessage),
    '/api/radio-meta?name=Kiss'
  );
});

test('Preserves Access-Control-Expose-Headers and converts thrown handler errors into clean 502 JSON', async () => {
  const exposeSrv = await withServer(async () => {
    return new Response('ok', {
      status: 206,
      headers: {
        'Content-Type': 'video/mp4',
        'Access-Control-Expose-Headers':
          'Content-Length, Content-Range, Accept-Ranges, Content-Type',
      },
    });
  });
  const errSrv = await withServer(async () => {
    throw new Error('simulated upstream boom');
  });

  try {
    const res = await fetch(`${exposeSrv.baseUrl}/api/tv-proxy?url=test`);
    assert.equal(res.status, 206);
    assert.equal(
      res.headers.get('access-control-expose-headers'),
      'Content-Length, Content-Range, Accept-Ranges, Content-Type'
    );

    const errRes = await fetch(`${errSrv.baseUrl}/api/tv-epg?country=RO`);
    assert.equal(errRes.status, 502);
    const body = (await errRes.json()) as { ok: boolean; error: string };
    assert.equal(body.ok, false);
    assert.match(body.error, /simulated upstream boom/);
  } finally {
    await exposeSrv.close();
    await errSrv.close();
  }
});
