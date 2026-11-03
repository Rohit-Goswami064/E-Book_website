import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyCloudinaryAsset } from "@/lib/cloudinary/server"
import type { CloudinaryAssetType, CloudinaryResourceType } from "@/types/media"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    // 1. Authorize calling administrator
    const user = await getCurrentUser()
    const isAdmin = await isCurrentUserAdmin()

    if (!user || !isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized: Super Admin privileges required to register media." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      public_id,
      secure_url,
      url,
      resource_type = "image",
      format,
      width,
      height,
      bytes,
      duration,
      folder,
      asset_type = "other",
      publication_id,
      blog_post_id,
      author_id,
      homepage_section_id,
      alt_text,
      caption,
      tags = [],
      metadata = {},
    } = body

    if (!public_id || !secure_url) {
      return NextResponse.json(
        { error: "Missing required fields: public_id and secure_url are mandatory." },
        { status: 400 }
      )
    }

    // 2. Attempt verification from Cloudinary API if possible
    let verifiedWidth = width ? parseInt(String(width), 10) : null
    let verifiedHeight = height ? parseInt(String(height), 10) : null
    let verifiedBytes = bytes ? parseInt(String(bytes), 10) : null
    let verifiedFormat = format || null
    let verifiedDuration = duration ? parseFloat(String(duration)) : null
    let verifiedSecureUrl = secure_url
    let verifiedUrl = url || secure_url

    try {
      const verified = await verifyCloudinaryAsset(public_id, resource_type as CloudinaryResourceType)
      if (verified) {
        verifiedSecureUrl = verified.secure_url
        verifiedUrl = verified.url || verified.secure_url
        verifiedFormat = verified.format || verifiedFormat
        verifiedWidth = verified.width || verifiedWidth
        verifiedHeight = verified.height || verifiedHeight
        verifiedBytes = verified.bytes || verifiedBytes
        verifiedDuration = verified.duration || verifiedDuration
      }
    } catch (verifyErr: any) {
      console.warn("Cloudinary API verification note:", verifyErr.message)
      // Allow fallback to client-supplied verified payload if verified endpoint fails
    }

    const supabase = createAdminClient()

    // 3. Upsert into public.media_assets table
    const { data: mediaAsset, error: dbError } = await supabase
      .from("media_assets")
      .upsert(
        {
          public_id,
          secure_url: verifiedSecureUrl,
          url: verifiedUrl,
          resource_type,
          format: verifiedFormat,
          width: verifiedWidth,
          height: verifiedHeight,
          bytes: verifiedBytes,
          duration: verifiedDuration,
          folder: folder || null,
          asset_type,
          publication_id: publication_id || null,
          blog_post_id: blog_post_id || null,
          author_id: author_id || null,
          homepage_section_id: homepage_section_id || null,
          alt_text: alt_text || null,
          caption: caption || null,
          tags: Array.isArray(tags) ? tags : [],
          metadata: typeof metadata === "object" ? metadata : {},
          created_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "public_id" }
      )
      .select()
      .single()

    if (dbError) {
      console.error("Database insert error for media_assets:", dbError)
      return NextResponse.json(
        { error: `Database error registering media asset: ${dbError.message}` },
        { status: 500 }
      )
    }

    // 4. Propagate to primary entities if specified
    if (publication_id && (asset_type === "book_cover" || !asset_type)) {
      await supabase
        .from("books")
        .update({ cover_image_url: verifiedSecureUrl })
        .eq("id", publication_id)
    }

    if (author_id && asset_type === "author_avatar") {
      await supabase
        .from("authors")
        .update({ avatar_url: verifiedSecureUrl })
        .eq("id", author_id)
    }

    if (blog_post_id && asset_type === "blog_cover") {
      await supabase
        .from("blog_posts")
        .update({ cover_image_url: verifiedSecureUrl })
        .eq("id", blog_post_id)
    }

    // 5. Create audit log
    await supabase.from("audit_logs").insert({
      admin_user_id: user.id,
      action: "REGISTER_MEDIA_ASSET",
      resource_type: "media_assets",
      resource_id: mediaAsset.id,
      details: {
        public_id,
        secure_url: verifiedSecureUrl,
        asset_type,
        resource_type,
        file_size: verifiedBytes,
      },
    })

    return NextResponse.json({
      success: true,
      asset: mediaAsset,
    })
  } catch (error: any) {
    console.error("Error in register media asset API:", error)
    return NextResponse.json(
      { error: error.message || "Failed to register media asset" },
      { status: 500 }
    )
  }
}
