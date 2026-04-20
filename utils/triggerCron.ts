// utils/triggerCron.ts
export async function triggerCron(sport = 'nba') {
  try {
    const res = await fetch(
      "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/espn-scraper",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          operation: "scrape_finished", 
          sport 
        }),
      }
    )
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    
    const data = await res.json()
    console.log("✅ Cron triggered:", data)
    return { success: true, data }
  } catch (error) {
    console.error("❌ Cron failed:", error)
    return { success: false, error }
  }
}
