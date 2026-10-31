import {
  fetchAndParseXmltvFeed,
  getEpgFeedUrlsForCountry,
  normalizeEpgKey,
} from './_epgUtils.mjs';

export default async (req) => {
  try {
    const reqUrl = new URL(req.url);
    const country = reqUrl.searchParams.get('country') || 'RU';
    const tvgId = (reqUrl.searchParams.get('tvgId') || '').trim();
    const name = (reqUrl.searchParams.get('name') || '').trim();

    const feedUrls = getEpgFeedUrlsForCountry(country);
    const results = await Promise.allSettled(
      feedUrls.map((u) => fetchAndParseXmltvFeed(u))
    );

    const mergedArchive = {};
    const mergedKeyMap = {};

    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      Object.assign(mergedArchive, r.value.archiveChannels);
      for (const [k, v] of Object.entries(r.value.keyMap)) {
        if (!mergedKeyMap[k]) mergedKeyMap[k] = v;
      }
    }

    let matchedEntry;

    if (tvgId) {
      const cleanId = tvgId.replace(/@\w+$/, '');
      matchedEntry =
        mergedArchive[tvgId] ||
        mergedArchive[cleanId] ||
        mergedArchive[mergedKeyMap[normalizeEpgKey(cleanId, false)]] ||
        mergedArchive[mergedKeyMap[normalizeEpgKey(cleanId, true)]];
    }

    if (!matchedEntry && name) {
      const nk1 = normalizeEpgKey(name, false);
      const nk2 = normalizeEpgKey(name, true);
      matchedEntry =
        (nk1 && mergedArchive[mergedKeyMap[nk1]]) ||
        (nk2 && mergedArchive[mergedKeyMap[nk2]]) ||
        undefined;
    }

    return new Response(
      JSON.stringify({
        programmes: matchedEntry ? matchedEntry.programmes : [],
        icon: matchedEntry?.icon || '',
        displayName: matchedEntry?.displayName || name,
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
        error: err instanceof Error ? err.message : 'EPG archive error',
        programmes: [],
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

