import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"
import { evaluateBotThreat } from "@/lib/security/bot-defense"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { applySecurityHeaders } from "@/lib/security/security-headers"

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // 0. Binary upload endpoints bypass middleware body buffering so large files (up to 250MB) stream directly
  if (pathname.includes("/publications/") && pathname.endsWith("/assets") && request.method === "POST") {
    return NextResponse.next()
  }

  // 1. Bot & Exploit Threat Defense
  const botThreat = evaluateBotThreat(request)
  if (botThreat.isBlocked) {
    console.warn(`[Security Shield Blocked]: Path ${pathname} | Reason: ${botThreat.reason}`)
    if (pathname.startsWith("/api/")) {
      return new NextResponse(
        JSON.stringify({ error: `Access Forbidden: ${botThreat.reason || "Suspicious traffic detected."}` }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      )
    }
    return new NextResponse("Access Forbidden: Threat signature detected by Security Shield.", { status: 403 })
  }

  // 2. Sliding Window Dynamic Rate Limiting
  const rateLimit = checkRateLimit(request)
  if (!rateLimit.allowed) {
    const isApi = pathname.startsWith("/api/")
    const resHeaders = new Headers({
      "Retry-After": String(rateLimit.resetSeconds),
      "X-RateLimit-Limit": String(rateLimit.limit),
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(rateLimit.resetSeconds),
    })

    if (isApi) {
      resHeaders.set("Content-Type", "application/json")
      return new NextResponse(
        JSON.stringify({
          error: "Too many requests. Please slow down and try again later.",
          retryAfterSeconds: rateLimit.resetSeconds,
        }),
        { status: 429, headers: resHeaders }
      )
    }

    return new NextResponse(
      `<!DOCTYPE html><html><head><title>Too Many Requests</title></head><body style="font-family:sans-serif;text-align:center;padding:60px 20px;"><h2>Too Many Requests</h2><p>You have temporarily exceeded the request limit. Please wait ${rateLimit.resetSeconds} seconds before trying again.</p></body></html>`,
      { status: 429, headers: resHeaders }
    )
  }

  // 3. Fast Edge Gateway Auth Check for Admin Routes
  if (pathname.startsWith("/super-admin") || pathname.startsWith("/api/admin")) {
    const hasAuthCookie = request.cookies
      .getAll()
      .some((c) => c.name.startsWith("sb-") && c.value.length > 10)

    if (!hasAuthCookie) {
      if (pathname.startsWith("/api/admin")) {
        return new NextResponse(
          JSON.stringify({ error: "Authentication required for administrative endpoints." }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        )
      }
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // 4. Supabase Session Sync
  let response = await updateSession(request)

  // 5. Rate Limit Diagnostic Headers
  response.headers.set("X-RateLimit-Limit", String(rateLimit.limit))
  response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining))
  response.headers.set("X-RateLimit-Reset", String(rateLimit.resetSeconds))

  // 6. Comprehensive Defense-in-Depth Security Headers
  response = applySecurityHeaders(response)

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/admin/publications/:id/assets (large binary file streaming bypass)
     * - public assets like .svg, .png, .jpg, .jpeg, .gif, .webp
     */
    "/((?!_next/static|_next/image|favicon.ico|api/admin/publications/[^/]+/assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
