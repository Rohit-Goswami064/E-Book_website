import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/database"

export function createClient() {
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:"

  return createBrowserClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://atmzsbbrycxtducxrelo.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable__v6OmiglRJXtsj0yvalm3A_5qXsR4Di",
    {
      cookieOptions: {
        secure: isHttps,
        sameSite: "lax",
        path: "/",
      },
    }
  )
}
