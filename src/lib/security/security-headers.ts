import { type NextResponse } from "next/server"

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://checkout.razorpay.com https://*.razorpay.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://res.cloudinary.com https://*.supabase.co https://*.r2.cloudflarestorage.com https://images.unsplash.com https://*.razorpay.com",
  "media-src 'self' blob: https://res.cloudinary.com https://*.r2.cloudflarestorage.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com https://lumberjack.razorpay.com https://res.cloudinary.com https://api.cloudinary.com https://*.r2.cloudflarestorage.com",
  "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ")

/**
 * Injects strict security and defense-in-depth headers into HTTP response
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  // Prevent clickjacking via iframes
  response.headers.set("X-Frame-Options", "SAMEORIGIN")

  // Prevent MIME-type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff")

  // Strict referrer policy protecting internal query strings
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  // Legacy XSS filter activation
  response.headers.set("X-XSS-Protection", "1; mode=block")

  // Limit sensor and hardware capabilities
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(self)"
  )

  // Enforce HTTPS
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  )

  // Safe window opener policy allowing Razorpay modal popups
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups")

  // Content Security Policy
  response.headers.set("Content-Security-Policy", CSP_DIRECTIVES)

  return response
}

