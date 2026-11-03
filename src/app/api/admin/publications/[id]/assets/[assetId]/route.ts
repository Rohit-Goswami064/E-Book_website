import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"
import { deleteR2Object } from "@/lib/storage/r2"
import { z } from "zod"

export const dynamic = "force-dynamic"

const updateSchema = z.object({
  upload_status: z.enum(["pending", "completed", "failed", "archived"]).optional(),
  is_downloadable: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

/**
 * PATCH /api/admin/publications/[id]/assets/[assetId]
 * Update status (e.g. archive), downloadability, or metadata
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  try {
    const user = await getCurrentUser()
    const isAdmin = await isCurrentUserAdmin()
    if (!user || !isAdmin) {
      return NextResponse.json({ error: "Unauthorized administrative access" }, { status: 403 })
    }

    const { id: publicationId, assetId } = await params
    const supabase = await createClient()

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid update payload", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const updates: Record<string, any> = {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    }

    const { data: updated, error } = await supabase
      .from("publication_assets")
      .update(updates)
      .eq("id", assetId)
      .eq("publication_id", publicationId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      admin_user_id: user.id,
      action: "UPDATE_PUBLICATION_ASSET",
      resource_type: "publication_assets",
      resource_id: assetId,
      details: { publication_id: publicationId, updates },
    } as any)

    return NextResponse.json({ success: true, asset: updated })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/publications/[id]/assets/[assetId]
 * Permanently delete asset from Cloudflare R2 and Supabase
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  try {
    const user = await getCurrentUser()
    const isAdmin = await isCurrentUserAdmin()
    if (!user || !isAdmin) {
      return NextResponse.json({ error: "Unauthorized administrative access" }, { status: 403 })
    }

    const { id: publicationId, assetId } = await params
    const supabase = await createClient()

    // 1. Fetch asset record to obtain object_key
    const { data: asset, error: fetchError } = await supabase
      .from("publication_assets")
      .select("*")
      .eq("id", assetId)
      .eq("publication_id", publicationId)
      .maybeSingle()

    if (fetchError || !asset) {
      return NextResponse.json({ error: "Asset record not found." }, { status: 404 })
    }

    // 2. Delete object from Cloudflare R2
    if (asset.storage_provider === "r2" && asset.object_key) {
      try {
        await deleteR2Object(asset.object_key)
      } catch (r2Err) {
        console.error("Warning: Failed to delete R2 object:", r2Err)
        // Proceed with database removal even if already deleted in R2
      }
    }

    // 3. Delete from Supabase publication_assets
    const { error: deleteError } = await supabase
      .from("publication_assets")
      .delete()
      .eq("id", assetId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // 4. Clean up legacy book_files if it pointed to this object
    await supabase
      .from("book_files")
      .delete()
      .eq("book_id", publicationId)
      .eq("storage_path", asset.object_key)

    // Audit log
    await supabase.from("audit_logs").insert({
      admin_user_id: user.id,
      action: "DELETE_PUBLICATION_ASSET",
      resource_type: "publication_assets",
      resource_id: assetId,
      details: {
        publication_id: publicationId,
        object_key: asset.object_key,
        filename: asset.original_filename,
      },
    } as any)

    return NextResponse.json({
      success: true,
      message: `Asset ${asset.original_filename} successfully deleted from Cloudflare R2 and database.`,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}
