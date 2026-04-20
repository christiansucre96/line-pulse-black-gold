// app/api/cron/route.ts
import { NextResponse } from 'next/server'

// ✅ Handle POST (for cron jobs)
export async function POST() {
  try {
    const res = await fetch(
      "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/espn-scraper",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          operation: "scrape_finished", 
          sport: "nba" 
        }),
      }
    )
    const data = await res.json()
    return NextResponse.json({ success: true, ...data })
  } catch (error) {
    console.error("Cron error:", error)
    return NextResponse.json({ error: "Cron failed" }, { status: 500 })
  }
}

// ✅ ALSO export GET to ensure route registers properly
export async function GET() {
  return NextResponse.json({ 
    message: "Cron endpoint active - use POST to trigger",
    timestamp: new Date().toISOString()
  })
}
