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
  const server = (req.query?.server ?? 'global').toLowerCase();
  const preferred = server === 'cn' ? ENDPOINTS.cn : ENDPOINTS.global;
  const fallback  = server === 'cn' ? ENDPOINTS.global : ENDPOINTS.cn;

  const { playerId, cardPoolType, serverId, recordId } = req.body || {};
  if (!playerId || !cardPoolType || !serverId || !recordId) {
    return res.status(400).json({ error: 'Missing required convene parameters' });
  }

  let lastError = 'No response';
  for (const endpoint of [preferred, fallback]) {
    try {
      const upstreamRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json',
        },
        body: JSON.stringify(req.body),
      });
      const body = await upstreamRes.text();
      let json;
      try { json = JSON.parse(body); } catch { json = null; }

      if (json && typeof json.code !== 'undefined') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).send(JSON.stringify(json));
      }
      lastError = `Unexpected upstream response (HTTP ${upstreamRes.status})`;
    } catch (err) {
      lastError = err.message;
    }
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(502).json({ error: 'Failed to reach Kuro Games API', detail: lastError });
};
