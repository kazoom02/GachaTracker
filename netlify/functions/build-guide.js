const { getBuildGuide } = require('../../server/build-guide-core.cjs');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors() };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'Method not allowed' }) };
  try {
    const data = await getBuildGuide(event.queryStringParameters || {});
    return {
      statusCode: 200,
      headers: { ...cors(), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400' },
      body: JSON.stringify(data),
    };
  } catch (error) {
    return { statusCode: 502, headers: { ...cors(), 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ error: 'Could not load build guide', detail: error.message }) };
  }
};

function cors() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
}
