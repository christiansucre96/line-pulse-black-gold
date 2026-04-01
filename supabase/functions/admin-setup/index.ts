import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const { email, operation } = await req.json()

    if (operation === 'make_admin') {
      if (!email) {
        return new Response(JSON.stringify({ error: 'email is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Find user by email via auth admin
      const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers()
      if (listErr) throw listErr

      const user = users.find(u => u.email === email)
      if (!user) {
        return new Response(JSON.stringify({ error: 'User not found. Make sure they have signed up first.' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Check if already admin
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single()

      if (existingRole) {
        return new Response(JSON.stringify({ success: true, message: 'User is already an admin' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Insert admin role
      const { error: insertErr } = await supabase
        .from('user_roles')
        .insert({ user_id: user.id, role: 'admin' })

      if (insertErr) throw insertErr

      return new Response(JSON.stringify({ success: true, message: `${email} is now an admin` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } else if (operation === 'make_first_admin') {
      // Makes the first registered user an admin
      const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers()
      if (listErr) throw listErr

      if (!users.length) {
        return new Response(JSON.stringify({ error: 'No users found. Sign up first.' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const firstUser = users.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )[0]

      await supabase.from('user_roles').upsert(
        { user_id: firstUser.id, role: 'admin' },
        { onConflict: 'user_id,role' }
      )

      return new Response(JSON.stringify({
        success: true,
        message: `${firstUser.email} is now admin`,
        email: firstUser.email,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } else if (operation === 'list_admins') {
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id, profiles(display_name)')
        .eq('role', 'admin')

      return new Response(JSON.stringify({ success: true, admins }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown operation. Use: make_admin, make_first_admin, list_admins' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Admin setup error:', error)
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
