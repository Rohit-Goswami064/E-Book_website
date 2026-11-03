import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    const isAdmin = await isCurrentUserAdmin()

    if (!user || !isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized: Super Admin or Admin privileges required." },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const assetType = searchParams.get("asset_type")
    const resourceType = searchParams.get("resource_type")
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100)
    const offset = parseInt(searchParams.get("offset") || "0", 10)

    const supabase = createAdminClient()
    let query = supabase
      .from("media_assets")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (assetType && assetType !== "all") {
      query = query.eq("asset_type", assetType)
    }

    if (resourceType && resourceType !== "all") {
      query = query.eq("resource_type", resourceType)
    }

    const { data: assets, count, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      assets: assets || [],
      total: count || 0,
      limit,
      offset,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch media assets" },
      { status: 500 }
    )
  }
}
