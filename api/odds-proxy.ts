import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const API_KEY = process.env.ODDS_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'Missing ODDS_API_KEY' });
  }

  const { path } = req.query;
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  // Build the target URL to odds-api.io
  const targetUrl = `https://api.odds-api.io/v3/${path}?apiKey=${API_KEY}`;
  
  // Forward additional query parameters (except 'path')
  const params = new URLSearchParams(req.url?.split('?')[1] || '');
  params.delete('path');
  const finalUrl = targetUrl + (params.toString() ? `&${params.toString()}` : '');

  try {
    const response = await fetch(finalUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LinePulse/1.0',
      },
    });
    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Proxy failed' });
  }
}
