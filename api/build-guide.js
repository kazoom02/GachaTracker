const { getBuildGuide } = require('../server/build-guide-core.cjs');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const result = await getBuildGuide(req.query || {});
    return res.status(200).json(result);
  } catch (error) {
    return res.status(502).json({ error: 'Could not load build guide', detail: error.message });
  }
};
