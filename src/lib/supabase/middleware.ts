import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const isHttps = request.nextUrl.protocol === "https:"

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://atmzsbbrycxtducxrelo.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable__v6OmiglRJXtsj0yvalm3A_5qXsR4Di",
    {
      cookieOptions: {
        secure: isHttps,
        sameSite: "lax",
        path: "/",
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              secure: isHttps,
              sameSite: "lax",
            })
          )
        },
      },
    }
  )

  // IMPORTANT: Keep getUser() to ensure token refresh and session persistence
  await supabase.auth.getUser()

  return supabaseResponse
}
