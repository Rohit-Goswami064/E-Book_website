import { NextResponse } from "next/server"
import { isCurrentUserAdmin, getCurrentUser } from "@/lib/auth/roles"
import { executeAdminRefund } from "@/lib/db/admin-queries"

export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 })
    }

    const { id: orderId } = await params
    const currentUser = await getCurrentUser()
    const body = await request.json()
    const { reason, amount_cents } = body

    const result = await executeAdminRefund({
      orderId,
      amountCents: amount_cents,
      reason,
      adminUserId: currentUser?.id,
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    console.error("[Admin Order Refund Error]:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
