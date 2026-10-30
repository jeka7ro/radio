export default async (req) => {
  try {
    const reqUrl = new URL(req.url);
    const rawTitle = (reqUrl.searchParams.get('rawTitle') || '').trim();
    if (!rawTitle) {
      return new Response(JSON.stringify({ track: null }), {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json; charset=utf-8',
        },
      });
    }

    const parts = rawTitle.split(/\s+[-–—]\s+/);
    let artist = parts.length >= 2 ? parts[0].trim() : '';
    let title = parts.length >= 2 ? parts.slice(1).join(' - ').trim() : rawTitle;
    let album = '';
    let coverUrl = '';
    let artistAvatarUrl = '';

    try {
      const r = await fetch(
        `https://api.deezer.com/search?q=${encodeURIComponent(rawTitle)}&limit=1`
      );
      if (r.ok) {
        const j = await r.json();
        const item = j?.data?.[0];
        if (item) {
          artist = item.artist?.name || artist;
          title = item.title || title;
          album = item.album?.title || '';
          coverUrl = item.album?.cover_big || item.album?.cover_medium || '';
          artistAvatarUrl =
            item.artist?.picture_big || item.artist?.picture_medium || '';
        }
      }
    } catch {
      // ignore
    }

    return new Response(
      JSON.stringify({
        track: {
          rawTitle,
          artist,
          title,
          album: album || undefined,
          coverUrl: coverUrl || undefined,
          artistAvatarUrl: artistAvatarUrl || undefined,
          updatedAt: Date.now(),
        },
      }),
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json; charset=utf-8',
        },
      }
    );
  } catch {
    return new Response(JSON.stringify({ track: null }), {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }
};
