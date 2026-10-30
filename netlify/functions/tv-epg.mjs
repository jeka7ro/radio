import {
  fetchAndParseXmltvFeed,
  getEpgFeedUrlsForCountry,
} from './_epgUtils.mjs';

export default async (req) => {
  try {
    const reqUrl = new URL(req.url);
    const country = reqUrl.searchParams.get('country') || 'RO';
    const feedUrls = getEpgFeedUrlsForCountry(country);

    const results = await Promise.allSettled(
      feedUrls.map((u) => fetchAndParseXmltvFeed(u))
    );

    const mergedChannels = {};
    const mergedKeyMap = {};

    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      Object.assign(mergedChannels, r.value.channels);
      for (const [k, v] of Object.entries(r.value.keyMap)) {
        if (!mergedKeyMap[k]) mergedKeyMap[k] = v;
      }
    }

    return new Response(
      JSON.stringify({
        channels: mergedChannels,
        keyMap: mergedKeyMap,
      }),
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'EPG error',
        channels: {},
        keyMap: {},
      }),
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json; charset=utf-8',
        },
      }
    );
  }
};
