import { NextResponse } from "next/server"
import { isCurrentUserAdmin } from "@/lib/auth/roles"
import { getAdminOrdersList } from "@/lib/db/admin-queries"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const search = searchParams.get("search")
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)))
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10))

    const { orders, total } = await getAdminOrdersList({
      status,
      search,
      limit,
      offset,
    })

    return NextResponse.json({
      orders,
      total,
      limit,
      offset,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    console.error("[Admin Orders API Error]:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
