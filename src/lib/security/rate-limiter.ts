import { type NextRequest } from "next/server"

interface RateLimitTier {
  limit: number // Max allowed requests
  windowMs: number // Time window in milliseconds
}

// Configurable tier profiles tailored to route criticality
export const RATE_LIMIT_TIERS: Record<string, RateLimitTier> = {
  // Strictest: Credential stuffing & auth brute force defense
  auth: {
    limit: 10,
    windowMs: 60 * 1000, // 10 requests per minute
  },
  // High: Card testing & fake guest order flood defense
  checkout: {
    limit: 20,
    windowMs: 60 * 1000, // 20 requests per minute
  },
  // Medium: DRM PDF stream & asset scraping defense
  streaming: {
    limit: 30,
    windowMs: 60 * 1000, // 30 requests per minute
  },
  // Medium: Coupon enumeration & newsletter spam defense
  promo_newsletter: {
    limit: 20,
    windowMs: 60 * 1000, // 20 requests per minute
  },
  // Administrative: Protects admin APIs while allowing swift dashboard navigation
  admin: {
    limit: 80,
    windowMs: 60 * 1000, // 80 requests per minute
  },
  // Default: General public browsing and catalogue navigation
  general: {
    limit: 150,
    windowMs: 60 * 1000, // 150 requests per minute
  },
}

interface ClientRecord {
  timestamps: number[]
}

// Global in-memory storage for rate tracking
// Survives across requests within the server instance
const ipStore = new Map<string, ClientRecord>()

// Periodically prune stale IP records every 60 seconds to prevent memory leaks
let lastPruneTime = Date.now()
function pruneStaleRecords() {
  const now = Date.now()
  if (now - lastPruneTime < 60 * 1000) return
  lastPruneTime = now

  const oldestAllowedTime = now - 5 * 60 * 1000 // Keep at most 5 minutes of history
  for (const [key, record] of ipStore.entries()) {
    record.timestamps = record.timestamps.filter((t) => t > oldestAllowedTime)
    if (record.timestamps.length === 0) {
      ipStore.delete(key)
    }
  }
}

/**
 * Extracts client IP address accurately behind reverse proxies (Cloudflare, Vercel, Nginx)
 */
export function getClientIp(request: NextRequest): string {
  // 1. Cloudflare True-Client-IP
  const cfIp = request.headers.get("cf-connecting-ip")
  if (cfIp) return cfIp.trim()

  // 2. Standard X-Real-IP
  const realIp = request.headers.get("x-real-ip")
  if (realIp) return realIp.trim()

  // 3. X-Forwarded-For (First IP is the origin client)
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim()
    if (firstIp) return firstIp
  }

  // 4. Fallback from connection
  return (request as any).ip || "127.0.0.1"
}

/**
 * Resolves the appropriate rate limiting tier based on request URL path
 */
export function getRouteTier(pathname: string): { tierName: string; config: RateLimitTier } {
  const path = pathname.toLowerCase()

  if (
    path.startsWith("/api/auth") ||
    path === "/login" ||
    path === "/register" ||
    path === "/reset-password"
  ) {
    return { tierName: "auth", config: RATE_LIMIT_TIERS.auth }
  }

  if (path.startsWith("/api/checkout") || path.startsWith("/api/orders")) {
    return { tierName: "checkout", config: RATE_LIMIT_TIERS.checkout }
  }

  if (
    path.includes("/pdf-stream") ||
    path.includes("/download") ||
    path.includes("/assets") ||
    path.includes("/reader-content")
  ) {
    return { tierName: "streaming", config: RATE_LIMIT_TIERS.streaming }
  }

  if (path.startsWith("/api/coupons") || path.startsWith("/api/newsletter")) {
    return { tierName: "promo_newsletter", config: RATE_LIMIT_TIERS.promo_newsletter }
  }

  if (path.startsWith("/api/admin") || path.startsWith("/super-admin")) {
    return { tierName: "admin", config: RATE_LIMIT_TIERS.admin }
  }

  return { tierName: "general", config: RATE_LIMIT_TIERS.general }
}

export interface RateLimitCheckResult {
  allowed: boolean
  limit: number
  remaining: number
  resetSeconds: number
}

/**
 * Evaluates client request against the sliding window rate limit
 */
export function checkRateLimit(request: NextRequest): RateLimitCheckResult {
  pruneStaleRecords()

  const ip = getClientIp(request)
  const { tierName, config } = getRouteTier(request.nextUrl.pathname)
  const now = Date.now()
  const windowStart = now - config.windowMs

  const storeKey = `${ip}:${tierName}`
  let record = ipStore.get(storeKey)

  if (!record) {
    record = { timestamps: [] }
    ipStore.set(storeKey, record)
  }

  // Filter timestamps outside current window
  record.timestamps = record.timestamps.filter((t) => t > windowStart)

  if (record.timestamps.length >= config.limit) {
    const oldestTimestamp = record.timestamps[0] || now
    const resetSeconds = Math.max(1, Math.ceil((oldestTimestamp + config.windowMs - now) / 1000))

    return {
      allowed: false,
      limit: config.limit,
      remaining: 0,
      resetSeconds,
    }
  }

  // Record this valid request
  record.timestamps.push(now)
  const remaining = Math.max(0, config.limit - record.timestamps.length)
  const resetSeconds = Math.ceil(config.windowMs / 1000)

  return {
    allowed: true,
    limit: config.limit,
    remaining,
    resetSeconds,
  }
}

