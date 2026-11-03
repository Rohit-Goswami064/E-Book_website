import { NextResponse } from "next/server"
import { isCurrentUserSuperAdmin } from "@/lib/auth/roles"
import { reconcileHistoricalPurchases } from "@/lib/db/admin-queries"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const isSuperAdmin = await isCurrentUserSuperAdmin()
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: "Only Super Administrators can perform historical reconciliation" },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const dryRun = body.dryRun !== false // Default to safe dry-run unless dryRun is explicitly false

    const report = await reconcileHistoricalPurchases({ dryRun })

    return NextResponse.json({
      success: true,
      mode: dryRun ? "dry-run (no changes applied)" : "live-execution (changes persisted)",
      report,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    console.error("[Reconciliation Error]:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
