// api/genshin.js
// Vercel serverless function — proxies getGachaLog requests to HoYoverse.
//
// The frontend POSTs { authUrl, gachaType, page, size, endId, lang }.
// We extract auth params from authUrl, add the pagination params, and
// forward to the correct CN or Global endpoint.

const ENDPOINTS = {
  global: 'https://public-operation-hk4e-sg.hoyoverse.com/gacha_info/api/getGachaLog',
  cn:     'https://public-operation-hk4e.mihoyo.com/gacha_info/api/getGachaLog',
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { authUrl, gachaType, page = 1, size = 20, endId = '0', lang } = req.body || {};

  if (!authUrl) {
    return res.status(400).json({ retcode: -1, message: 'authUrl is required' });
  }

  // Parse auth params out of the URL the user pasted
  let authParams;
  try {
    authParams = new URL(authUrl.trim()).searchParams;
  } catch {
    return res.status(400).json({ retcode: -1, message: 'Invalid authUrl — paste the full https:// link.' });
  }

  // Pick CN vs Global from the region param embedded in the auth URL
  const region   = (authParams.get('region') || '').toLowerCase();
  const base     = region.startsWith('cn_') ? ENDPOINTS.cn : ENDPOINTS.global;
  const upstream = new URL(base);

  // Forward every auth param from the pasted URL as-is
  for (const [k, v] of authParams.entries()) {
    upstream.searchParams.set(k, v);
  }

  // Add / override per-request pagination params
  upstream.searchParams.set('gacha_type', gachaType);
  upstream.searchParams.set('page',       String(page));
  upstream.searchParams.set('size',       String(size));
  upstream.searchParams.set('end_id',     String(endId));
  if (lang) upstream.searchParams.set('lang', lang);

  let upstreamRes;
  try {
    upstreamRes = await fetch(upstream.toString(), {
      headers: { 'User-Agent': 'okhttp/4.9.3' },
    });
  } catch (err) {
    return res.status(502).json({ retcode: -1, message: 'Failed to reach HoYoverse: ' + err.message });
  }

  const body = await upstreamRes.text();
  res.setHeader('Content-Type', upstreamRes.headers.get('content-type') ?? 'application/json');
  return res.status(upstreamRes.status).send(body);
};
