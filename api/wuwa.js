// api/wuwa.js
// Vercel serverless function — proxies one convene record query to Kuro Games.
// Kuro's API does not send CORS headers, so the frontend calls /api/wuwa
// with a JSON body and we forward it here.
//
// Supports both Global (aki-game2.net) and CN (aki-game2.com) servers.

const ENDPOINTS = {
  global: 'https://gmserver-api.aki-game2.net/gacha/record/query',
  cn:     'https://gmserver-api.aki-game2.com/gacha/record/query',
};

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ?server=cn to hit the CN endpoint, anything else = global
  const server = (req.query.server ?? 'global').toLowerCase();
  const base   = server === 'cn' ? ENDPOINTS.cn : ENDPOINTS.global;

  let upstreamRes;
  try {
    upstreamRes = await fetch(base, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':   'Mozilla/5.0',
      },
      body: JSON.stringify(req.body),
    });
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach Kuro Games API', detail: err.message });
  }

  const body = await upstreamRes.text();

  res.setHeader('Content-Type', upstreamRes.headers.get('content-type') ?? 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(upstreamRes.status).send(body);
};
