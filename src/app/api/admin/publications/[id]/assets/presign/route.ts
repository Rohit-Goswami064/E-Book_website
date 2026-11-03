import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import {
  getR2BucketName,
  generateR2ObjectKey,
  createPresignedUploadUrl,
  initiateMultipartUpload,
  createPresignedUploadPartUrl,
} from "@/lib/storage/r2"
import { validateAssetFile, type PublicationAssetType } from "@/lib/storage/validation"
import { z } from "zod"

export const dynamic = "force-dynamic"

const presignSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().default("application/octet-stream"),
  sizeBytes: z.number().positive(),
  assetType: z.enum(["pdf", "epub", "audiobook", "audio_chapter", "video"]),
  isDownloadable: z.boolean().default(true),
  metadata: z.record(z.string(), z.any()).optional().default({}),
  // For multipart part URL requests
  action: z.enum(["init", "part"]).default("init"),
  uploadId: z.string().optional(),
  partNumber: z.number().int().positive().optional(),
  objectKey: z.string().optional(),
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

    // Verify publication exists
    const { data: book } = await supabase
      .from("books")
      .select("id")
      .eq("id", publicationId)
      .maybeSingle()

    if (!book) {
      return NextResponse.json({ error: "Publication record not found." }, { status: 404 })
    }

    const body = await request.json()
    const parsed = presignSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid presign payload", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const {
      filename,
      mimeType,
      sizeBytes,
      assetType,
      isDownloadable,
      metadata,
      action,
      uploadId,
      partNumber,
      objectKey: suppliedObjectKey,
    } = parsed.data

    // If client is requesting a presigned part URL for an active multipart upload
    if (action === "part") {
      if (!uploadId || !partNumber || !suppliedObjectKey) {
        return NextResponse.json(
          { error: "Missing uploadId, partNumber, or objectKey for multipart part URL." },
          { status: 400 }
        )
      }
      const partUrl = await createPresignedUploadPartUrl({
        objectKey: suppliedObjectKey,
        uploadId,
        partNumber,
      })
      return NextResponse.json({ partUrl, partNumber })
    }

    // Validate file
    const validation = validateAssetFile({
      filename,
      mimeType,
      sizeBytes,
      assetType,
    })
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Generate secure server-controlled object key
    const objectKey = generateR2ObjectKey({
      publicationId,
      assetType,
      originalFilename: filename,
    })
    const bucketName = getR2BucketName()

    // 1. Create a pending record in Supabase
    const { data: assetRecord, error: insertError } = await supabase
      .from("publication_assets")
      .insert({
        publication_id: publicationId,
        asset_type: assetType,
        storage_provider: "r2",
        bucket_name: bucketName,
        object_key: objectKey,
        original_filename: filename,
        mime_type: mimeType,
        file_size: sizeBytes,
        upload_status: "pending",
        is_downloadable: isDownloadable,
        metadata,
      } as any)
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // 2. Decide if multipart upload is required (files > 100MB)
    const MULTIPART_THRESHOLD = 100 * 1024 * 1024 // 100MB
    if (sizeBytes > MULTIPART_THRESHOLD) {
      const mp = await initiateMultipartUpload({
        objectKey,
        contentType: mimeType,
      })

      return NextResponse.json({
        isMultipart: true,
        uploadId: mp.uploadId,
        objectKey,
        bucketName,
        assetId: assetRecord.id,
        partSize: 10 * 1024 * 1024, // 10MB chunk recommended
      })
    }

    // 3. Single PUT presigned upload URL
    const presigned = await createPresignedUploadUrl({
      objectKey,
      contentType: mimeType,
      contentLength: sizeBytes,
      expiresInSeconds: 3600,
    })

    return NextResponse.json({
      isMultipart: false,
      uploadUrl: presigned.uploadUrl,
      objectKey,
      bucketName,
      assetId: assetRecord.id,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}
