export const handler = async (event) => {
  const headers = event.headers || {};
  const host = headers['x-forwarded-host'] || headers.host || 'filmio.my';
  const proto = headers['x-forwarded-proto'] || 'http';
  const baseOrigin = `${proto}://${host}`;

  const body = {
    name: 'Filmio',
    version: '1.1.0',
    parameter: `content:${baseOrigin}/msx/start.json`,
    action: `link:${baseOrigin}/tv`,
    headline: 'Filmio',
    icon: 'msx-blue:play-circle-filled',
    image: `${baseOrigin}/msx/logo.png`,
    launcher: {
      type: 'default',
      title: 'Filmio',
      icon: 'blank',
      image: `${baseOrigin}/msx/logo.png`,
      color: 'msx-black',
    },
    template: {
      type: 'separate',
      layout: '0,0,4,3',
      color: 'msx-glass',
    },
    items: [
      {
        title: 'Filmio',
        titleFooter: 'Filme 4K, Seriale, TV Live & Muzică',
        image: `${baseOrigin}/msx/logo.png`,
        imageFiller: 'height-center',
        color: 'msx-black',
        action: `link:${baseOrigin}/tv`,
      },
    ],
  };

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
    body: JSON.stringify(body, null, 2),
  };
};

