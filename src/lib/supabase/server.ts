import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/types/database"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://atmzsbbrycxtducxrelo.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable__v6OmiglRJXtsj0yvalm3A_5qXsR4Di",
    {
      cookieOptions: {
        sameSite: "lax",
        path: "/",
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                sameSite: "lax",
              })
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This is handled by middleware refreshing user sessions.
          }
        },
      },
    }
  )
}
