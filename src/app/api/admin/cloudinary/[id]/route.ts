import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import { createAdminClient } from "@/lib/supabase/admin"
import { deleteCloudinaryAsset } from "@/lib/cloudinary/server"
import type { CloudinaryResourceType } from "@/types/media"

export const dynamic = "force-dynamic"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    const isAdmin = await isCurrentUserAdmin()

    if (!user || !isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized: Super Admin or Admin privileges required." },
        { status: 403 }
      )
    }

    const { id } = await params
    const supabase = createAdminClient()

    // 1. Find asset in database
    const { data: asset, error: findError } = await supabase
      .from("media_assets")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (findError || !asset) {
      return NextResponse.json({ error: "Media asset not found in database" }, { status: 404 })
    }

    // 2. Delete from Cloudinary
    try {
      await deleteCloudinaryAsset(asset.public_id, (asset.resource_type || "image") as CloudinaryResourceType)
    } catch (cldErr: any) {
      console.warn("Cloudinary delete remote warning:", cldErr.message)
      // Continue to delete from DB even if remote is already gone
    }

    // 3. Delete from database
    const { error: deleteError } = await supabase
      .from("media_assets")
      .delete()
      .eq("id", id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // 4. Audit log
    await supabase.from("audit_logs").insert({
      admin_user_id: user.id,
      action: "DELETE_MEDIA_ASSET",
      resource_type: "media_assets",
      resource_id: id,
      details: {
        public_id: asset.public_id,
        secure_url: asset.secure_url,
      },
    })

    return NextResponse.json({ success: true, deletedId: id })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete media asset" },
      { status: 500 }
    )
  }
}
