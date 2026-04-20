import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const response = await fetch(
      'https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/espn-scraper',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'scrape_finished', sport: 'nba' }),
      }
    )
    const data = await response.json()
    return res.status(200).json({ success: true, ...data })
  } catch (error) {
    console.error('Cron error:', error)
    return res.status(500).json({ error: 'Cron failed' })
  }
}
