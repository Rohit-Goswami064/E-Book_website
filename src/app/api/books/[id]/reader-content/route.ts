import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/roles"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyPublicationAccess } from "@/lib/auth/entitlements"
import { createPresignedDownloadUrl } from "@/lib/storage/r2"

export const dynamic = "force-dynamic"

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
        { error: access.reason || "Access denied to protected reader content." },
        { status: user ? 403 : 401 }
      )
    }

    const admin = createAdminClient()

    // 2. Fetch book details
    const { data: book, error: bookError } = await admin
      .from("books")
      .select("id, title, subtitle, author_id, format, pages, language, table_of_contents, authors(name)")
      .eq("id", bookId)
      .maybeSingle()

    if (bookError || !book) {
      return NextResponse.json({ error: "Publication not found." }, { status: 404 })
    }

    // 3. Reading progress & bookmarks (if logged in)
    let progress = null
    let bookmarks: any[] = []
    if (user) {
      const { data: p } = await admin
        .from("reading_progress")
        .select("current_page, total_pages, progress_percentage, last_cfi, last_chapter, last_read_at")
        .eq("user_id", user.id)
        .eq("book_id", bookId)
        .maybeSingle()
      progress = p

      const { data: bm } = await admin
        .from("bookmarks")
        .select("id, page_number, note, color, created_at")
        .eq("user_id", user.id)
        .eq("book_id", bookId)
        .order("page_number", { ascending: true })
      bookmarks = bm || []
    }

    // 4. Resolve publication assets from Cloudflare R2
    const { data: assets } = await admin
      .from("publication_assets")
      .select("*")
      .eq("publication_id", bookId)
      .eq("upload_status", "completed")
      .order("created_at", { ascending: false })

    const isPaid = !book.is_free && (book.price_cents || 0) > 0
    let signedReaderUrl: string | null = null
    let primaryAsset: any = null

    // Pick primary document asset (PDF or EPUB)
    const docAsset = (assets as any[] || []).find((a: any) => a.asset_type === "pdf" || a.asset_type === "epub")
    let isDownloadable = access.isAdmin ? true : isPaid ? false : Boolean(docAsset?.is_downloadable)

    if (docAsset) {
      primaryAsset = docAsset
      if (docAsset.asset_type === "pdf") {
        signedReaderUrl = `/api/books/${bookId}/pdf-stream`
      } else if (docAsset.storage_provider === "r2") {
        signedReaderUrl = await createPresignedDownloadUrl({
          objectKey: docAsset.object_key,
          expiresInSeconds: 7200, // 2 hour reader session
          filename: docAsset.original_filename,
          inline: true,
        })
      }
    } else {
      // Fallback to legacy book_files table
      const { data: file } = await admin
        .from("book_files")
        .select("storage_path, file_type, is_downloadable")
        .eq("book_id", bookId)
        .maybeSingle()

      if (file?.storage_path) {
        isDownloadable = file.is_downloadable ?? true
        // Check if storage_path is an R2 key or Supabase bucket path
        if (file.storage_path.startsWith("publications/")) {
          signedReaderUrl = await createPresignedDownloadUrl({
            objectKey: file.storage_path,
            expiresInSeconds: 7200,
            inline: true,
          })
        } else {
          const { data: signed } = await admin.storage
            .from("book-files")
            .createSignedUrl(file.storage_path, 7200)
          signedReaderUrl = signed?.signedUrl || null
        }
      }
    }

    // Also enrich audio chapters & media assets with short-lived playback URLs
    const mediaAssets = await Promise.all(
      (assets as any[] || [])
        .filter((a: any) => ["audiobook", "audio_chapter", "video"].includes(a.asset_type))
        .map(async (a: any) => {
          let streamUrl: string | null = null
          if (a.storage_provider === "r2") {
            streamUrl = await createPresignedDownloadUrl({
              objectKey: a.object_key,
              expiresInSeconds: 7200,
              filename: a.original_filename,
              inline: true,
            })
          }
          return {
            id: a.id,
            assetType: a.asset_type,
            title: a.metadata?.title || a.original_filename,
            duration: a.metadata?.duration || null,
            streamUrl,
            fileSize: a.file_size,
          }
        })
    )

    // Log analytics if user authenticated
    if (user) {
      await admin.from("analytics_events").insert({
        event_name: "READER_OPENED",
        user_id: user.id,
        book_id: bookId,
        metadata: {
          asset_id: primaryAsset?.id || null,
          storage_provider: primaryAsset?.storage_provider || "legacy",
        },
      } as any)
    }

    return NextResponse.json({
      book: {
        id: book.id,
        title: book.title,
        subtitle: book.subtitle,
        author: (book.authors as any)?.name || "Unknown Author",
        pages: book.pages || 1,
        format: book.format,
        language: book.language,
        tableOfContents: book.table_of_contents || [],
      },
      fileUrl: signedReaderUrl,
      isDownloadable,
      mediaAssets,
      progress: progress || {
        current_page: 1,
        total_pages: book.pages || 1,
        progress_percentage: 0,
      },
      bookmarks,
    })
  } catch (error: any) {
    console.error("Reader Content Route Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
