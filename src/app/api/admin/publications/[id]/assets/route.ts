import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import {
  getR2BucketName,
  generateR2ObjectKey,
  uploadBufferToR2,
  deleteR2Object,
  createPresignedDownloadUrl,
} from "@/lib/storage/r2"
import { validateAssetFile, type PublicationAssetType } from "@/lib/storage/validation"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/publications/[id]/assets
 * Lists all assets attached to a publication with signed preview URLs for admins
 */
export async function GET(
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

    // Verify publication exists
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("id, title")
      .eq("id", publicationId)
      .maybeSingle()

    if (bookError || !book) {
      return NextResponse.json({ error: "Publication not found" }, { status: 404 })
    }

    // Fetch all assets under authenticated session RLS
    const { data: assets, error: assetsError } = await supabase
      .from("publication_assets")
      .select("*")
      .eq("publication_id", publicationId)
      .order("created_at", { ascending: false })

    if (assetsError) {
      return NextResponse.json({ error: assetsError.message }, { status: 500 })
    }

    // Generate short-lived signed preview URLs for completed assets (for admin playback / testing)
    const enrichedAssets = await Promise.all(
      (assets || []).map(async (asset: any) => {
        let previewUrl: string | null = null
        if (asset.upload_status === "completed" && asset.storage_provider === "r2") {
          try {
            previewUrl = await createPresignedDownloadUrl({
              objectKey: asset.object_key,
              expiresInSeconds: 3600, // 1 hour preview for admin
              filename: asset.original_filename,
              inline: true,
            })
          } catch (e) {
            console.error("Error generating admin preview URL:", e)
          }
        }
        return {
          ...asset,
          previewUrl,
        }
      })
    )

    return NextResponse.json({ assets: enrichedAssets })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/admin/publications/[id]/assets
 * Reliable 2-Phase Upload Workflow with Automatic Orphan Reconciliation:
 * 1. Authenticate user & authorize Super Admin
 * 2. Validate publication & file
 * 3. Upload file to Cloudflare R2
 * 4. Persist metadata in Supabase
 * 5. Reconcile / delete orphaned R2 object if database insert fails
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let uploadedObjectKey: string | null = null

  try {
    // 1. Authenticate caller and verify Super Admin / Administrator authorization
    const user = await getCurrentUser()
    const isAdmin = await isCurrentUserAdmin()
    if (!user || !isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized: Super Admin or Administrator privileges required to manage publication assets." },
        { status: 403 }
      )
    }

    const { id: publicationId } = await params
    const supabase = await createClient()

    // 2. Validate publication existence
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("id, title")
      .eq("id", publicationId)
      .maybeSingle()

    if (bookError || !book) {
      return NextResponse.json({ error: "Publication record not found." }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const assetType = formData.get("asset_type") as PublicationAssetType | null
    const isDownloadable = formData.get("is_downloadable") !== "false"
    const metadataRaw = formData.get("metadata") as string | null

    if (!file || !assetType) {
      return NextResponse.json(
        { error: "Missing required fields: 'file' and 'asset_type' are required." },
        { status: 400 }
      )
    }

    // Validate file against asset type rules
    const validation = validateAssetFile({
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      assetType,
    })

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    let parsedMetadata: Record<string, any> = {}
    if (metadataRaw) {
      try {
        parsedMetadata = JSON.parse(metadataRaw)
      } catch {
        // keep empty
      }
    }

    // Generate secure server-controlled object key
    const objectKey = generateR2ObjectKey({
      publicationId,
      assetType,
      originalFilename: file.name,
    })
    const bucketName = getR2BucketName()

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // 3. Phase 1: Upload directly to private Cloudflare R2 bucket
    await uploadBufferToR2({
      objectKey,
      buffer,
      contentType: file.type || "application/octet-stream",
      metadata: {
        publication_id: publicationId,
        asset_type: assetType,
        original_filename: file.name,
      },
    })
    uploadedObjectKey = objectKey

    // 4. Phase 2: Persist asset metadata in Supabase under authenticated RLS policy
    // If this is a singleton document (pdf, epub, audiobook), mark older completed assets as archived
    if (["pdf", "epub", "audiobook"].includes(assetType)) {
      await supabase
        .from("publication_assets")
        .update({ upload_status: "archived" })
        .eq("publication_id", publicationId)
        .eq("asset_type", assetType)
        .eq("upload_status", "completed")
    }

    const { data: assetRecord, error: insertError } = await supabase
      .from("publication_assets")
      .insert({
        publication_id: publicationId,
        asset_type: assetType,
        storage_provider: "r2",
        bucket_name: bucketName,
        object_key: objectKey,
        original_filename: file.name,
        mime_type: file.type || "application/octet-stream",
        file_size: file.size,
        upload_status: "completed",
        is_downloadable: isDownloadable,
        metadata: parsedMetadata,
      } as any)
      .select()
      .single()

    if (insertError) {
      console.error("[Publication Asset Database Persistence Failure]:", insertError)

      // Automatic orphan reconciliation: delete uploaded R2 object to maintain consistency
      try {
        await deleteR2Object(objectKey)
        console.log(`[Reconciliation]: Successfully removed orphaned R2 object: ${objectKey}`)
      } catch (r2CleanErr: any) {
        console.error(`[Reconciliation Error]: Failed to delete orphaned R2 object ${objectKey}:`, r2CleanErr.message)
      }

      return NextResponse.json(
        { error: `Database persistence failed: ${insertError.message}` },
        { status: insertError.code === "42501" ? 403 : 500 }
      )
    }

    // 5. Sync to legacy book_files table for backward compatibility if it's pdf or epub
    if (assetType === "pdf" || assetType === "epub") {
      await supabase.from("book_files").upsert(
        {
          book_id: publicationId,
          file_type: assetType,
          storage_path: objectKey,
          file_size_bytes: file.size,
          mime_type: file.type,
          is_downloadable: isDownloadable,
        } as any,
        { onConflict: "book_id,file_type" }
      )
    }

    // 6. Record administrative audit log
    await supabase.from("audit_logs").insert({
      admin_user_id: user.id,
      action: "UPLOAD_PUBLICATION_ASSET",
      resource_type: "publication_assets",
      resource_id: assetRecord.id,
      details: {
        publication_id: publicationId,
        asset_type: assetType,
        filename: file.name,
        size_bytes: file.size,
        storage_provider: "r2",
        object_key: objectKey,
      },
    } as any)

    // 7. Confirm success only after both operations succeed
    return NextResponse.json({
      success: true,
      message: `${file.name} successfully uploaded to private Cloudflare R2 and registered.`,
      asset: assetRecord,
    })
  } catch (err: any) {
    console.error("[R2 Upload Handler Exception]:", err)

    // Attempt orphan cleanup if error occurred after R2 upload
    if (uploadedObjectKey) {
      try {
        await deleteR2Object(uploadedObjectKey)
        console.log(`[Reconciliation]: Cleaned up orphaned R2 object following handler exception: ${uploadedObjectKey}`)
      } catch (cleanErr: any) {
        console.error(`[Reconciliation Error]: Could not delete orphaned R2 object ${uploadedObjectKey}:`, cleanErr.message)
      }
    }

    return NextResponse.json(
      { error: err?.message || "Internal server error during R2 asset processing." },
      { status: 500 }
    )
  }
}
