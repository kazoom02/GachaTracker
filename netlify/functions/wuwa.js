// netlify/functions/wuwa.js
// Forwards ONE convene-pool query to Kuro Games' official API and returns the JSON.
// Same purpose as the Genshin forwarder: get around the missing CORS headers.
// It does NOT store, log, or inspect your recordId.

// The global API has lived on a couple of host spellings over time; we try each in order.
const HOSTS = [
  'https://gmserver-api.aki-game2.net',
  'https://gmserver-api.aki-game2.com',
];
const PATH = '/gacha/record/query';

function cors(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    ...extra,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'Use POST' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { playerId, cardPoolId, cardPoolType, serverId, languageCode = 'en', recordId } = body;
  if (!playerId || !cardPoolType || !serverId || !recordId) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Missing required convene parameters' }) };
  }

  const payload = JSON.stringify({
    playerId: String(playerId),
    cardPoolId: String(cardPoolId || ''),
    cardPoolType: Number(cardPoolType),
    serverId: String(serverId),
    languageCode: String(languageCode),
    recordId: String(recordId),
  });

  let lastErr = null;
  for (const host of HOSTS) {
    try {
      const upstream = await fetch(host + PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        body: payload,
      });
      const text = await upstream.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        lastErr = 'non-JSON response';
        continue;
      }
      // Kuro returns { code: 0, ... } on success. Any defined code means we reached them.
      if (data && typeof data.code !== 'undefined') {
        return { statusCode: 200, headers: cors(), body: JSON.stringify(data) };
      }
      lastErr = 'unexpected response shape';
    } catch (err) {
      lastErr = String(err);
    }
  }

  return { statusCode: 502, headers: cors(), body: JSON.stringify({ error: 'All upstream hosts failed', detail: lastErr }) };
};
