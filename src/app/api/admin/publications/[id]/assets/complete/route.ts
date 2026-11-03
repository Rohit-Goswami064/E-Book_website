import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"
import { finishMultipartUpload, headR2Object } from "@/lib/storage/r2"
import { z } from "zod"

export const dynamic = "force-dynamic"

const completeSchema = z.object({
  assetId: z.string().uuid(),
  isMultipart: z.boolean().default(false),
  uploadId: z.string().optional(),
  parts: z
    .array(
      z.object({
        ETag: z.string(),
        PartNumber: z.number().int().positive(),
      })
    )
    .optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    const isAdmin = await isCurrentUserAdmin()
    if (!user || !isAdmin) {
      return NextResponse.json({ error: "Unauthorized administrative access" }, { status: 403 })
    }

    const { id: publicationId } = await params
    const supabase = await createClient()

    const body = await request.json()
    const parsed = completeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid completion payload", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { assetId, isMultipart, uploadId, parts } = parsed.data

    // Fetch asset record
    const { data: asset, error: fetchError } = await supabase
      .from("publication_assets")
      .select("*")
      .eq("id", assetId)
      .eq("publication_id", publicationId)
      .maybeSingle()

    if (fetchError || !asset) {
      return NextResponse.json({ error: "Asset record not found." }, { status: 404 })
    }

    // If multipart, finalize the S3 multipart upload
    if (isMultipart && uploadId && parts && parts.length > 0) {
      await finishMultipartUpload({
        objectKey: asset.object_key,
        uploadId,
        parts,
      })
    }

    // Verify object physically exists in Cloudflare R2
    const head = await headR2Object(asset.object_key)
    if (!head.exists) {
      await supabase
        .from("publication_assets")
        .update({ upload_status: "failed" })
        .eq("id", assetId)

      return NextResponse.json(
        {
          error:
            "Physical verification failed: Object was not found in the private Cloudflare R2 bucket.",
        },
        { status: 400 }
      )
    }

    // Update asset record in Supabase
    const { data: updatedAsset, error: updateError } = await supabase
      .from("publication_assets")
      .update({
        upload_status: "completed",
        file_size: head.contentLength || asset.file_size,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assetId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Sync to legacy book_files for backward compatibility
    if (asset.asset_type === "pdf" || asset.asset_type === "epub") {
      await supabase.from("book_files").upsert(
        {
          book_id: publicationId,
          file_type: asset.asset_type,
          storage_path: asset.object_key,
          file_size_bytes: head.contentLength || asset.file_size,
          mime_type: asset.mime_type,
          is_downloadable: asset.is_downloadable,
        } as any,
        { onConflict: "book_id,file_type" }
      )
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      admin_user_id: user.id,
      action: "COMPLETE_PUBLICATION_ASSET",
      resource_type: "publication_assets",
      resource_id: assetId,
      details: {
        publication_id: publicationId,
        asset_type: asset.asset_type,
        object_key: asset.object_key,
        verified_size: head.contentLength,
      },
    } as any)

    return NextResponse.json({
      success: true,
      message: "Asset upload verified and registered in Cloudflare R2 successfully.",
      asset: updatedAsset,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}
