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

// game_biz values that HoYoverse requires but some URL-extractors leave blank.
const GAME_BIZ = {
  global: 'hk4e_global',
  cn:     'hk4e_cn',
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

  // Vercel parses JSON bodies automatically; fall back to manual parse just in case.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const { authUrl, gachaType, page = 1, size = 20, endId = '0', lang } = body;

  if (!authUrl) {
    return res.status(400).json({ retcode: -1, message: 'authUrl is required' });
  }

  let authParams;
  try {
    authParams = new URL(authUrl.trim()).searchParams;
  } catch {
    return res.status(400).json({ retcode: -1, message: 'Invalid authUrl — paste the full https:// link.' });
  }

  const region    = (authParams.get('region') || '').toLowerCase();
  const isCN      = region.startsWith('cn_');
  const base      = isCN ? ENDPOINTS.cn : ENDPOINTS.global;
  const upstream  = new URL(base);

  // Copy auth params from the pasted URL
  for (const [k, v] of authParams.entries()) {
    upstream.searchParams.set(k, v);
  }

  // Default game_biz if the URL left it blank — HoYoverse returns empty results without it.
  if (!upstream.searchParams.get('game_biz')) {
    upstream.searchParams.set('game_biz', isCN ? GAME_BIZ.cn : GAME_BIZ.global);
  }

  // Per-request pagination params (override anything in authUrl)
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
    console.error('[genshin] fetch error:', err.message);
    return res.status(502).json({ retcode: -1, message: 'Failed to reach HoYoverse: ' + err.message });
  }

  const text = await upstreamRes.text();

  // Log non-200 or error retcodes so they show up in Vercel function logs.
  if (!upstreamRes.ok) {
    console.error(`[genshin] upstream ${upstreamRes.status}:`, text.slice(0, 200));
  } else {
    try {
      const parsed = JSON.parse(text);
      if (parsed.retcode !== 0) {
        console.error(`[genshin] retcode ${parsed.retcode}:`, parsed.message);
      } else {
        const count = parsed?.data?.list?.length ?? 0;
        console.log(`[genshin] gacha_type=${gachaType} page=${page} → ${count} items`);
      }
    } catch {
      console.error('[genshin] non-JSON upstream response:', text.slice(0, 200));
    }
  }

  res.setHeader('Content-Type', upstreamRes.headers.get('content-type') ?? 'application/json');
  return res.status(upstreamRes.status).send(text);
};
