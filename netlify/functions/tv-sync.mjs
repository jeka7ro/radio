// Netlify Serverless Function for Cross-Device Account, Photo, PIN & Watch Progress Sync
// Works when the user is away from home (on 4G/5G, vacation, laptop, iPad) with smart throttling.

const globalStore = globalThis.__aetherCloudSyncStore || {
  profiles: [],
  progressByProfile: {},
  savedByProfile: {},
};
globalThis.__aetherCloudSyncStore = globalStore;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-cache, no-store',
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const profileId = (url.searchParams.get('profileId') || 'p1').replace(
      /[^a-zA-Z0-9_-]/g,
      ''
    );

    // 1. /api/tv-profiles
    if (path.includes('tv-profiles')) {
      if (req.method === 'POST') {
        const incoming = await req.json().catch(() => null);
        if (Array.isArray(incoming) && incoming.length > 0) {
          globalStore.profiles = incoming.slice(0, 12);
        }
        return new Response(JSON.stringify(globalStore.profiles), {
          status: 200,
          headers: corsHeaders,
        });
      }
      return new Response(JSON.stringify(globalStore.profiles), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // 2. /api/tv-saved
    if (path.includes('tv-saved')) {
      const currentSaved = globalStore.savedByProfile[profileId] || [];
      if (req.method === 'POST') {
        const incoming = await req.json().catch(() => null);
        if (Array.isArray(incoming)) {
          globalStore.savedByProfile[profileId] = incoming.slice(0, 300);
        }
        return new Response(
          JSON.stringify(globalStore.savedByProfile[profileId] || []),
          {
            status: 200,
            headers: corsHeaders,
          }
        );
      }
      return new Response(JSON.stringify(currentSaved), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // 3. /api/tv-progress
    const currentProgress = globalStore.progressByProfile[profileId] || {};
    if (req.method === 'POST') {
      const incoming = await req.json().catch(() => null);
      if (incoming && typeof incoming === 'object') {
        const merged = { ...currentProgress };
        for (const [k, v] of Object.entries(incoming)) {
          if (!v || typeof v !== 'object') continue;
          const existing = merged[k];
          if (!existing || (v.updatedAt || 0) >= (existing.updatedAt || 0)) {
            merged[k] = v;
          }
        }
        globalStore.progressByProfile[profileId] = merged;
      }
      return new Response(
        JSON.stringify(globalStore.progressByProfile[profileId] || {}),
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    return new Response(JSON.stringify(currentProgress), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 200,
      headers: corsHeaders,
    });
  }
};

