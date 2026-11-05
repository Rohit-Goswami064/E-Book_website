import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"
import { verifyPublicationAccess } from "@/lib/auth/entitlements"
import { createPresignedDownloadUrl } from "@/lib/storage/r2"
import { dbQuery } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookId } = await params
    const user = await getCurrentUser()

    // 1. Authoritative entitlement verification
    const access = await verifyPublicationAccess(user?.id || null, bookId)
    if (!access.authorized) {
      return NextResponse.json(
        {
          error: access.reason || "Access denied. Valid entitlement required to stream audiobook content.",
        },
        { status: user ? 403 : 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get("mode")
    const requestedAssetId = searchParams.get("assetId")

    const supabase = await createClient()

    // 2. Fetch all completed audio assets for this publication
    const { data: assets } = await supabase
      .from("publication_assets")
      .select("id, object_key, original_filename, mime_type, file_size, storage_provider, asset_type, metadata, created_at")
      .eq("publication_id", bookId)
      .in("asset_type", ["audio", "audio_chapter"])
      .eq("upload_status", "completed")
      .order("created_at", { ascending: true })

    let audioAssets = assets || []

    // Fallback if RLS masked assets
    if (audioAssets.length === 0) {
      const direct = await dbQuery<{
        id: string
        object_key: string
        original_filename: string
        mime_type: string
        file_size: number
        storage_provider: string
        asset_type: string
        metadata: any
        created_at: string
      }>(
        `SELECT id, object_key, original_filename, mime_type, file_size, storage_provider, asset_type, metadata, created_at
         FROM public.publication_assets
         WHERE publication_id = $1 AND asset_type IN ('audio', 'audio_chapter') AND upload_status = 'completed'
         ORDER BY created_at ASC;`,
        [bookId]
      )
      audioAssets = direct.rows
    }

    // 3. Return chapters / metadata if requested
    if (mode === "metadata" || mode === "chapters") {
      const chapters = audioAssets.map((a, idx) => ({
        id: a.id,
        chapterNumber: idx + 1,
        title: a.metadata?.chapter_title || a.original_filename.replace(/\.[^/.]+$/, ""),
        duration: a.metadata?.duration_seconds || null,
        fileSize: a.file_size,
        streamEndpoint: `/api/books/${bookId}/audio-stream?assetId=${a.id}`,
      }))

      return NextResponse.json({
        totalChapters: chapters.length,
        chapters,
      })
    }

    // 4. Resolve the target audio asset to stream
    let selectedAsset = audioAssets[0]
    if (requestedAssetId) {
      const found = audioAssets.find((a) => a.id === requestedAssetId)
      if (found) selectedAsset = found
    }

    if (!selectedAsset) {
      return NextResponse.json(
        { error: "No active audio assets found for this publication." },
        { status: 404 }
      )
    }

    // 5. Generate secure, short-lived signed R2 streaming URL (inline disposition)
    const streamUrl = await createPresignedDownloadUrl({
      objectKey: selectedAsset.object_key,
      expiresInSeconds: 3600, // 1 hour playback session
      filename: selectedAsset.original_filename,
      inline: true,
    })

    // If client requested JSON payload
    if (searchParams.get("format") === "json") {
      return NextResponse.json({
        assetId: selectedAsset.id,
        filename: selectedAsset.original_filename,
        streamUrl,
      })
    }

    // Direct redirect to the presigned stream URL for native <audio> element
    return NextResponse.redirect(streamUrl, 307)
  } catch (error: any) {
    console.error("[Audio Stream API Error]:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to initialize audiobook audio stream." },
      { status: 500 }
    )
  }
}

