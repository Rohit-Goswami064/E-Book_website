import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

export function createAdminClient(): any {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://atmzsbbrycxtducxrelo.supabase.co"
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_publishable__v6OmiglRJXtsj0yvalm3A_5qXsR4Di"

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }),
    },
  })
}
