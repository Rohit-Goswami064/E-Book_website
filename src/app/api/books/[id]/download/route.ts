import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/roles"
import { createAdminClient } from "@/lib/supabase/admin"
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

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required to access publication downloads." },
        { status: 401 }
      )
    }

    // 1. Authoritative server-side publication access verification
    const access = await verifyPublicationAccess(user.id, bookId)
    if (!access.authorized) {
      return NextResponse.json(
        { error: access.reason || "Access denied. Valid purchase entitlement was not found." },
        { status: 403 }
      )
    }

    const admin = createAdminClient()

    // 2. Fetch publication pricing details
    const { data: book, error: bookError } = await admin
      .from("books")
      .select("id, title, is_free, price_cents")
      .eq("id", bookId)
      .maybeSingle()

    if (bookError || !book) {
      return NextResponse.json({ error: "Publication not found." }, { status: 404 })
    }

    // 3. Verified entitlement check: user is authorized to download
    // Customers with valid purchase entitlements or admins are granted download access.

    const { searchParams } = new URL(request.url)
    const requestedAssetId = searchParams.get("assetId")
    const requestedType = searchParams.get("type") || "pdf"

    // 4. Fetch asset from publication_assets (using direct dbQuery to bypass RLS, with admin client fallback)
    let asset: {
      id: string
      object_key: string
      original_filename: string
      mime_type: string
      storage_provider: string
      is_downloadable: boolean
    } | null = null

    try {
      const assetRes = requestedAssetId
        ? await dbQuery<any>(
            `SELECT id, object_key, original_filename, mime_type, storage_provider, is_downloadable
             FROM public.publication_assets
             WHERE publication_id = $1::uuid AND id = $2::uuid AND upload_status = 'completed'
             LIMIT 1;`,
            [bookId, requestedAssetId]
          )
        : await dbQuery<any>(
            `SELECT id, object_key, original_filename, mime_type, storage_provider, is_downloadable
             FROM public.publication_assets
             WHERE publication_id = $1::uuid AND asset_type = $2::text AND upload_status = 'completed'
             ORDER BY created_at DESC
             LIMIT 1;`,
            [bookId, requestedType]
          )

      if (assetRes.rows.length > 0) {
        asset = assetRes.rows[0]
      }
    } catch (dbErr: any) {
      console.warn("[Download Route DB Query Notice]:", dbErr?.message)
    }

    if (!asset) {
      let assetQuery = admin
        .from("publication_assets")
        .select("id, object_key, original_filename, mime_type, storage_provider, is_downloadable")
        .eq("publication_id", bookId)
        .eq("upload_status", "completed")

      if (requestedAssetId) {
        assetQuery = assetQuery.eq("id", requestedAssetId)
      } else {
        assetQuery = assetQuery.eq("asset_type", requestedType)
      }

      const { data: assets } = await assetQuery.order("created_at", { ascending: false }).limit(1)
      if (assets && assets.length > 0) {
        asset = assets[0]
      }
    }

    let downloadUrl: string | null = null

    if (asset) {
      if (asset.storage_provider === "r2") {
        downloadUrl = await createPresignedDownloadUrl({
          objectKey: asset.object_key,
          expiresInSeconds: 300, // 5 minutes secure download authorization
          filename: asset.original_filename || `${book.title}.pdf`,
          inline: false,
        })
      }
    } else {
      // Fallback to legacy book_files
      const { data: file, error: fileError } = await admin
        .from("book_files")
        .select("storage_path, file_type, is_downloadable")
        .eq("book_id", bookId)
        .eq("file_type", requestedType)
        .maybeSingle()

      if (fileError || !file) {
        return NextResponse.json(
          { error: `Downloadable asset (${requestedType.toUpperCase()}) is not currently attached to this publication.` },
          { status: 404 }
        )
      }

      if (!file.is_downloadable && !access.isAdmin) {
        return NextResponse.json(
          { error: "This publication is configured for in-browser reading only and is not downloadable." },
          { status: 403 }
        )
      }

      if (file.storage_path.startsWith("publications/")) {
        downloadUrl = await createPresignedDownloadUrl({
          objectKey: file.storage_path,
          expiresInSeconds: 60,
          inline: false,
        })
      } else {
        const { data: signed } = await admin.storage
          .from("book-files")
          .createSignedUrl(file.storage_path, 60)
        downloadUrl = signed?.signedUrl || null
      }
    }

    if (!downloadUrl) {
      return NextResponse.json(
        { error: "Failed to generate authorized download link." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      downloadUrl,
      filename: asset?.original_filename || "publication.pdf",
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
