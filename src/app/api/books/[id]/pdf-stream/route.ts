import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"
import { verifyPublicationAccess } from "@/lib/auth/entitlements"
import { getR2Client, getR2BucketName, headR2Object } from "@/lib/storage/r2"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import crypto from "crypto"

export const dynamic = "force-dynamic"

// Secret DRM salt shared with client reader for XOR key derivation
const DRM_SALT = "HB_DRM_V2_2026_XOR_SALT"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookId } = await params
    const user = await getCurrentUser()

    // 1. Authoritative server-side publication access verification
    const access = await verifyPublicationAccess(user?.id || null, bookId)
    if (!access.authorized) {
      return NextResponse.json(
        {
          error: access.reason || "Access denied. Valid purchase entitlement was not found for this publication.",
        },
        { status: user ? 403 : 401 }
      )
    }

    // 2. Strict Origin & Referer Validation: Reject standalone requests or unauthorized referrers
    const referer = request.headers.get("referer") || ""
    const secFetchDest = request.headers.get("sec-fetch-dest")
    const readerHeader = request.headers.get("x-reader-request")

    // Block direct browser navigation (typing stream URL directly in address bar or downloading via iframe)
    if (secFetchDest === "document" || secFetchDest === "iframe") {
      return NextResponse.json(
        { error: "Direct document navigation is disabled. Please view inside the HiddenBooks reader." },
        { status: 403 }
      )
    }

    // Enforce authorized referer path (/read/<bookId>)
    const expectedPath = `/read/${bookId}`
    let isAuthorizedReferer = false
    if (referer) {
      try {
        const refUrl = new URL(referer)
        if (refUrl.pathname === expectedPath || refUrl.pathname.startsWith(`${expectedPath}/`)) {
          isAuthorizedReferer = true
        }
      } catch {
        isAuthorizedReferer = false
      }
    }

    // In production, referer must strictly match reader page
    if (!isAuthorizedReferer && process.env.NODE_ENV !== "test") {
      return NextResponse.json(
        { error: "Access Forbidden: Stream can only be initiated from the authorized reader view." },
        { status: 403 }
      )
    }

    // Require the custom reader verification header
    if (!readerHeader && process.env.NODE_ENV !== "test") {
      return NextResponse.json(
        { error: "Missing required client reader verification header." },
        { status: 403 }
      )
    }

    const supabase = await createClient()

    // 3. Fetch the verified PDF asset for this publication
    const { data: assets } = await supabase
      .from("publication_assets")
      .select("id, object_key, original_filename, mime_type, file_size, storage_provider, upload_status")
      .eq("publication_id", bookId)
      .eq("asset_type", "pdf")
      .eq("upload_status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)

    let objectKey: string | null = null

    if (assets && assets.length > 0) {
      objectKey = assets[0].object_key
    } else {
      // Fallback to legacy book_files table
      const { data: file } = await supabase
        .from("book_files")
        .select("storage_path")
        .eq("book_id", bookId)
        .eq("file_type", "pdf")
        .maybeSingle()

      if (file?.storage_path) {
        objectKey = file.storage_path
      }
    }

    if (!objectKey) {
      return NextResponse.json(
        {
          error: "Original PDF document has not been uploaded or is currently unavailable for this publication.",
        },
        { status: 404 }
      )
    }

    // 4. Verify object exists in Cloudflare R2
    const head = await headR2Object(objectKey)
    if (!head.exists) {
      console.error(`[PDF Stream] Object missing in R2: ${objectKey}`)
      return NextResponse.json(
        { error: "The requested PDF file could not be located in secure storage." },
        { status: 404 }
      )
    }

    // 5. Fetch raw manuscript buffer from Cloudflare R2
    const r2Client = getR2Client()
    const bucketName = getR2BucketName()

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    })

    const s3Response = await r2Client.send(command)

    if (!s3Response.Body) {
      return NextResponse.json(
        { error: "Failed to establish stream from storage provider." },
        { status: 502 }
      )
    }

    const rawBytes = await s3Response.Body.transformToByteArray()

    // 6. Generate Dynamic Ephemeral XOR Session Key
    const dynamicBytes = crypto.randomBytes(16)
    const keyHex = dynamicBytes.toString("hex")
    const saltBuffer = Buffer.from(DRM_SALT, "utf-8")
    const xorKey = new Uint8Array(16)
    for (let i = 0; i < 16; i++) {
      xorKey[i] = dynamicBytes[i] ^ (saltBuffer[i % saltBuffer.length] || 0x5a)
    }

    // 7. High-Performance Stream Obfuscation
    // Applies fast in-memory XOR transform across binary buffer
    const obfuscatedBytes = new Uint8Array(rawBytes.length)
    for (let i = 0; i < rawBytes.length; i++) {
      obfuscatedBytes[i] = rawBytes[i] ^ xorKey[i % 16]
    }

    // 8. Aggressive Anti-Caching & Content-Masking Headers
    const headers = new Headers()
    headers.set("Content-Type", "application/octet-stream") // Masquerade as raw binary stream
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0")
    headers.set("Pragma", "no-cache")
    headers.set("Expires", "0")
    headers.set("Surrogate-Control", "no-store")
    headers.set("X-Content-Type-Options", "nosniff")
    headers.set("Content-Disposition", 'attachment; filename="encrypted-stream.bin"')
    headers.set("X-Stream-Key", keyHex)
    headers.set("Access-Control-Expose-Headers", "X-Stream-Key, Content-Length")
    headers.set("Content-Length", obfuscatedBytes.length.toString())

    return new Response(Buffer.from(obfuscatedBytes), {
      status: 200,
      headers,
    })
  } catch (error: any) {
    console.error("[PDF Stream Route Error]:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error streaming document." },
      { status: 500 }
    )
  }
}
