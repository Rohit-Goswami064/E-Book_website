import { NextResponse } from "next/server"
import { isCurrentUserAdmin } from "@/lib/auth/roles"
import { getAdminAnalyticsMetrics } from "@/lib/db/admin-queries"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const range = searchParams.get("range") || "30d"

    const data = await getAdminAnalyticsMetrics(range)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    console.error("[Admin Analytics API Error]:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
