import { type NextRequest } from "next/server"

// Known hostile security vulnerability scanners and exploit tools
const MALICIOUS_USER_AGENTS = [
  "sqlmap",
  "nikto",
  "masscan",
  "acunetix",
  "dirbuster",
  "gobuster",
  "wpscan",
  "openvas",
  "burpcollaborator",
  "burpsuite",
  "havij",
  "zgrab",
  "censys",
  "shodan",
  "nmap",
  "blackwidow",
  "nuclei",
  "morfeus",
]

// Common exploit probes targeted at web applications
const SUSPICIOUS_PATHS = [
  "/.env",
  "/.git",
  "/wp-login",
  "/wp-admin",
  "/xmlrpc.php",
  "/phpmyadmin",
  "/pma",
  "/eval-stdin.php",
  "/cgi-bin",
  "/.aws",
  "/web.config",
  "/etc/passwd",
  "/proc/self",
]

// Whitelisted legitimate search engine crawlers
const LEGITIMATE_CRAWLERS = [
  "googlebot",
  "bingbot",
  "duckduckbot",
  "yandexbot",
  "baiduspider",
  "slurp",
  "whatsapp",
  "twitterbot",
  "facebookexternalhit",
]

export interface BotDefenseResult {
  isBlocked: boolean
  reason?: string
}

export function evaluateBotThreat(request: NextRequest): BotDefenseResult {
  const userAgent = (request.headers.get("user-agent") || "").toLowerCase().trim()
  const pathname = request.nextUrl.pathname.toLowerCase()
  const search = request.nextUrl.search.toLowerCase()

  // 1. Block empty user-agents attempting to access critical APIs
  if (!userAgent && (pathname.startsWith("/api/checkout") || pathname.startsWith("/api/auth") || pathname.startsWith("/api/admin"))) {
    return { isBlocked: true, reason: "Missing User-Agent on sensitive endpoint" }
  }

  // 2. Allow whitelisted search engines if they are not probing sensitive paths
  const isSearchEngine = LEGITIMATE_CRAWLERS.some((bot) => userAgent.includes(bot))
  if (isSearchEngine) {
    if (pathname.startsWith("/api/") || pathname.startsWith("/super-admin") || pathname.startsWith("/account")) {
      return { isBlocked: true, reason: "Search crawlers not permitted in protected areas" }
    }
    return { isBlocked: false }
  }

  // 3. Block malicious scanners and exploitation tools
  const isHostileScanner = MALICIOUS_USER_AGENTS.some((scanner) => userAgent.includes(scanner))
  if (isHostileScanner) {
    return { isBlocked: true, reason: "Hostile scanner signature detected" }
  }

  // 4. Block path traversal attempts
  if (pathname.includes("..") || pathname.includes("%2e%2e") || search.includes("..") || search.includes("%2e%2e")) {
    return { isBlocked: true, reason: "Path traversal probe detected" }
  }

  // 5. Block null byte injections
  if (pathname.includes("%00") || search.includes("%00") || pathname.includes("\0")) {
    return { isBlocked: true, reason: "Null byte injection detected" }
  }

  // 6. Block common probe targets (e.g. wp-login, .env, phpmyadmin)
  const isSuspiciousPath = SUSPICIOUS_PATHS.some((path) => pathname.startsWith(path) || pathname.includes(path))
  if (isSuspiciousPath) {
    return { isBlocked: true, reason: "Unauthorized exploit path probe" }
  }

  // 7. Check for suspicious SQLi / script injection patterns in query string
  if (
    search.includes("<script") ||
    search.includes("javascript:") ||
    search.includes("union+select") ||
    search.includes("union%20select") ||
    search.includes("drop+table") ||
    search.includes("drop%20table") ||
    search.includes("1=1--")
  ) {
    return { isBlocked: true, reason: "Suspicious injection signature in query parameters" }
  }

  return { isBlocked: false }
}

