// api/genshin.js
// Vercel serverless function — proxies one getGachaLog page to HoYoverse.
// The browser cannot call HoYoverse directly (no CORS headers), so the
// frontend calls /api/genshin?<same query string> and we forward it here.
//
// Supports both Global (os_*) and CN (cn_*) regions.

const ENDPOINTS = {
  global: 'https://public-operation-hk4e-sg.hoyoverse.com/gacha_info/api/getGachaLog',
  cn:     'https://public-operation-hk4e.mihoyo.com/gacha_info/api/getGachaLog',
};

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const params = req.query;

  // Pick CN vs Global endpoint from the region param
  const region   = (params.region ?? '').toLowerCase();
  const base     = region.startsWith('cn_') ? ENDPOINTS.cn : ENDPOINTS.global;
  const upstream = new URL(base);

  for (const [k, v] of Object.entries(params)) {
    upstream.searchParams.set(k, v);
  }

  let upstreamRes;
  try {
    upstreamRes = await fetch(upstream.toString(), {
      headers: { 'User-Agent': 'okhttp/4.9.3' },
    });
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach HoYoverse API', detail: err.message });
  }

  const body = await upstreamRes.text();

  res.setHeader('Content-Type', upstreamRes.headers.get('content-type') ?? 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(upstreamRes.status).send(body);
};
