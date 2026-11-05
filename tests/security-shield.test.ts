import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { NextRequest } from "next/server"
import { evaluateBotThreat } from "../src/lib/security/bot-defense"
import { checkRateLimit, RATE_LIMIT_TIERS } from "../src/lib/security/rate-limiter"
import { applySecurityHeaders } from "../src/lib/security/security-headers"
import { NextResponse } from "next/server"

describe("Security Shield & Bot Defense Suite", () => {
  it("Blocks malicious vulnerability scanners (sqlmap, nikto)", () => {
    const req1 = new NextRequest("http://localhost:3000/books", {
      headers: { "user-agent": "sqlmap/1.5#stable" },
    })
    const res1 = evaluateBotThreat(req1)
    assert.equal(res1.isBlocked, true)
    assert.match(res1.reason || "", /scanner/i)

    const req2 = new NextRequest("http://localhost:3000/api/books", {
      headers: { "user-agent": "Mozilla/5.0 nikto/2.1.6" },
    })
    const res2 = evaluateBotThreat(req2)
    assert.equal(res2.isBlocked, true)
  })

  it("Blocks path traversal and sensitive probe paths", () => {
    const reqEnv = new NextRequest("http://localhost:3000/.env", {
      headers: { "user-agent": "Mozilla/5.0" },
    })
    assert.equal(evaluateBotThreat(reqEnv).isBlocked, true)

    const reqTraversal = new NextRequest("http://localhost:3000/api/books/../../etc/passwd", {
      headers: { "user-agent": "Mozilla/5.0" },
    })
    assert.equal(evaluateBotThreat(reqTraversal).isBlocked, true)

    const reqSql = new NextRequest("http://localhost:3000/books?q=1+UNION+SELECT+1,2", {
      headers: { "user-agent": "Mozilla/5.0" },
    })
    assert.equal(evaluateBotThreat(reqSql).isBlocked, true)
  })

  it("Permits legitimate browser traffic", () => {
    const req = new NextRequest("http://localhost:3000/books", {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    })
    const res = evaluateBotThreat(req)
    assert.equal(res.isBlocked, false)
  })

  it("Enforces rate limits by route criticality", () => {
    const testIp = "192.168.100.99"
    // Auth route has 10 requests limit
    for (let i = 0; i < RATE_LIMIT_TIERS.auth.limit; i++) {
      const req = new NextRequest("http://localhost:3000/api/auth/resolve-identifier", {
        headers: { "x-forwarded-for": testIp, "user-agent": "Mozilla/5.0" },
      })
      const result = checkRateLimit(req)
      assert.equal(result.allowed, true)
    }

    // 11th request must be blocked
    const overflowReq = new NextRequest("http://localhost:3000/api/auth/resolve-identifier", {
      headers: { "x-forwarded-for": testIp, "user-agent": "Mozilla/5.0" },
    })
    const overflowResult = checkRateLimit(overflowReq)
    assert.equal(overflowResult.allowed, false)
    assert.equal(overflowResult.remaining, 0)
    assert.ok(overflowResult.resetSeconds > 0)
  })

  it("Applies strict security headers to responses", () => {
    let res = NextResponse.next()
    res = applySecurityHeaders(res)

    assert.equal(res.headers.get("X-Frame-Options"), "SAMEORIGIN")
    assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff")
    assert.equal(res.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin")
    assert.match(res.headers.get("Content-Security-Policy") || "", /default-src 'self'/)
  })
})

