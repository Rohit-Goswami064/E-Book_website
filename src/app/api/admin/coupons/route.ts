import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isCurrentUserAdmin } from "@/lib/auth/roles"

export async function GET() {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 })
    }

    const adminClient = createAdminClient()
    const { data: coupons, error } = await adminClient
      .from("coupons")
      .select("*, coupon_redemptions(count)")
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const formatted = (coupons as any[])?.map((c: any) => ({
      ...c,
      redemptions_count: c.coupon_redemptions?.[0]?.count || 0,
    }))

    return NextResponse.json({ coupons: formatted || [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 })
    }

    const body = await request.json()
    const {
      code,
      discount_type,
      discount_value,
      min_order_amount_cents,
      max_uses,
      expires_at,
      is_active,
    } = body

    if (!code?.trim() || discount_value === undefined) {
      return NextResponse.json({ error: "Code and discount value are required" }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { data: coupon, error } = await adminClient
      .from("coupons")
      .insert({
        code: code.trim().toUpperCase(),
        discount_type: discount_type || "percent",
        discount_value: Number(discount_value),
        min_order_amount_cents: Number(min_order_amount_cents) || 0,
        max_uses: max_uses ? Number(max_uses) : null,
        expires_at: expires_at || null,
        is_active: is_active ?? true,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, coupon })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 })
    }

    const body = await request.json()
    const {
      id,
      code,
      discount_type,
      discount_value,
      min_order_amount_cents,
      max_uses,
      expires_at,
      is_active,
    } = body

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { data: coupon, error } = await adminClient
      .from("coupons")
      .update({
        code: code.trim().toUpperCase(),
        discount_type: discount_type || "percent",
        discount_value: Number(discount_value),
        min_order_amount_cents: Number(min_order_amount_cents) || 0,
        max_uses: max_uses ? Number(max_uses) : null,
        expires_at: expires_at || null,
        is_active: is_active ?? true,
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, coupon })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { error } = await adminClient.from("coupons").delete().eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
