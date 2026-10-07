// GET /api/ads?q=nike&country=ALL&limit=60[&page=<facebook page id>]
// Vercel serverless function. The Apify token stays on the server.

import { searchAds, SearchError } from '../lib/ads.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Use GET.' });
  }
  try {
    const result = await searchAds({ q: req.query.q, country: req.query.country, limit: req.query.limit, pageId: req.query.page });
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=3600');
    return res.status(200).json(result);
  } catch (err) {
    const status = err instanceof SearchError ? err.status : 500;
    if (status >= 500) console.error(err);
    return res.status(status).json({ error: err instanceof SearchError ? err.message : 'Something went wrong on our side. Try again.' });
  }
}
