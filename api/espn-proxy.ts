// api/espn-proxy.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.espn.com/',
        'Origin': 'https://www.espn.com',
      },
    });
    const data = await response.json();
    // Allow CORS from your frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch ESPN data' });
  }
}
