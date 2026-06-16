// netlify/functions/genshin.js
// Forwards ONE page of a Genshin getGachaLog request to HoYoverse and returns the JSON.
// The browser can't call HoYoverse directly (no CORS headers), so this thin forwarder
// stands in the middle. It does NOT store, log, or inspect your authkey.

// Only these hosts are allowed to be contacted. The browser passes the full authkey URL
// (it differs by region, e.g. -sg for SEA/EU, others for America/Asia), and we reuse it
// verbatim, only swapping the paging parameters.
const ALLOWED_HOST_SUFFIXES = ['.hoyoverse.com', '.mihoyo.com'];

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

  const { authUrl, gachaType, page = 1, size = 20, endId = '0', lang = 'en' } = body;
  if (!authUrl || !gachaType) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Missing authUrl or gachaType' }) };
  }

  let target;
  try {
    target = new URL(authUrl);
  } catch {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'authUrl is not a valid URL' }) };
  }

  const hostOk = ALLOWED_HOST_SUFFIXES.some((s) => target.hostname.endsWith(s));
  if (!hostOk) {
    return { statusCode: 403, headers: cors(), body: JSON.stringify({ error: `Host not allowed: ${target.hostname}` }) };
  }

  // Force the endpoint path, keep all of the user's auth params, override paging params.
  target.pathname = '/gacha_info/api/getGachaLog';
  target.searchParams.set('gacha_type', String(gachaType));
  target.searchParams.set('page', String(page));
  target.searchParams.set('size', String(size));
  target.searchParams.set('end_id', String(endId));
  target.searchParams.set('lang', lang);

  try {
    const upstream = await fetch(target.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    });
    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { statusCode: 502, headers: cors(), body: JSON.stringify({ error: 'Upstream returned non-JSON', raw: text.slice(0, 300) }) };
    }
    return { statusCode: 200, headers: cors(), body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 502, headers: cors(), body: JSON.stringify({ error: 'Upstream request failed', detail: String(err) }) };
  }
};
