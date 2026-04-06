import { supabase } from "@/integrations/supabase/client"

export async function getPlayers(sport:string) {
  const { data } = await supabase.functions.invoke("clever-action", {
    body: { operation: "get_players", sport }
  })
  return data?.players || []
}

export async function runFull(sport:string) {
  return await supabase.functions.invoke("clever-action", {
    body: { operation: "full", sport }
  })
}

export async function getTopPicks(sport:string) {
  const { data } = await supabase.functions.invoke("clever-action", {
    body: { operation: "top_picks", sport }
  })
  return data?.picks || []
}
