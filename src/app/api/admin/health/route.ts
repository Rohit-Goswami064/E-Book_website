import { NextResponse } from "next/server"
import { isCurrentUserAdmin } from "@/lib/auth/roles"
import { checkDatabaseHealth } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 })
    }

    const health = await checkDatabaseHealth()

    if (!health.connected) {
      return NextResponse.json(
        {
          status: "degraded",
          database: "disconnected",
          latencyMs: health.latencyMs,
          correlationId: health.correlationId,
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      )
    }

    return NextResponse.json({
      status: "healthy",
      database: "connected",
      latencyMs: health.latencyMs,
      correlationId: health.correlationId,
      timestamp: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
