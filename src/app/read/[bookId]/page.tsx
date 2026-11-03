import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentUser, isCurrentUserAdmin, checkBookEntitlement } from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"
import { EBookReader } from "@/components/reader/ebook-reader"
import { ShieldAlert, ArrowLeft, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ReaderPageProps {
  params: Promise<{ bookId: string }>
}

export const dynamic = "force-dynamic"

export default async function ReaderPage({ params }: ReaderPageProps) {
  const { bookId } = await params
  const user = await getCurrentUser()

  if (!user) {
    redirect(`/login?redirect=/read/${bookId}`)
  }

  const isAdmin = await isCurrentUserAdmin()
  const isEntitled = await checkBookEntitlement(user.id, bookId)

  const supabase = await createClient()

  // Fetch book details
  const { data: book } = await supabase
    .from("books")
    .select("id, title, subtitle, slug, format, pages, is_free, price_cents, language, table_of_contents, authors(name)")
    .eq("id", bookId)
    .maybeSingle()

  if (!book) {
    redirect("/books")
  }

  // If user is not entitled and not admin, display access denied
  if (!isEntitled && !isAdmin) {
    return (
      <div className="min-h-screen bg-[#F6F5F2] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-[32px] bg-white border border-black/10 p-8 sm:p-10 text-center shadow-lg space-y-4">
          <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-neutral-900">
            Entitlement Required
          </h1>
          <p className="text-xs text-neutral-600 leading-relaxed">
            You do not currently hold an active license or entitlement for <strong className="text-neutral-900">&quot;{book.title}&quot;</strong>.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Link href={`/books/${book.slug}`}>
              <Button className="w-full rounded-full bg-[#111111] font-bold text-xs gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Acquire Book</span>
              </Button>
            </Link>
            <Link href="/account/library">
              <Button variant="outline" className="w-full rounded-full text-xs font-semibold">
                Back to My Library
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Fetch saved reading progress
  const { data: progress } = await supabase
    .from("reading_progress")
    .select("current_page, total_pages, progress_percentage, last_chapter")
    .eq("user_id", user.id)
    .eq("book_id", bookId)
    .maybeSingle()

  // Fetch bookmarks
  const { data: bookmarks } = await supabase
    .from("bookmarks")
    .select("id, page_number, note, color")
    .eq("user_id", user.id)
    .eq("book_id", bookId)
    .order("page_number", { ascending: true })

  // Check verified publication assets in publication_assets
  const { data: assets } = await supabase
    .from("publication_assets")
    .select("id, object_key, original_filename, is_downloadable, storage_provider, asset_type")
    .eq("publication_id", bookId)
    .eq("upload_status", "completed")
    .order("created_at", { ascending: false })

  let pdfAsset = (assets || []).find((a: any) => a.asset_type === "pdf")

  // Fallback to legacy book_files if publication_assets has no pdf
  if (!pdfAsset) {
    const { data: legacyFile } = await supabase
      .from("book_files")
      .select("id, storage_path, file_type, is_downloadable")
      .eq("book_id", bookId)
      .eq("file_type", "pdf")
      .maybeSingle()
    if (legacyFile?.storage_path) {
      pdfAsset = {
        id: legacyFile.id,
        object_key: legacyFile.storage_path,
        original_filename: "document.pdf",
        is_downloadable: legacyFile.is_downloadable,
        storage_provider: legacyFile.storage_path.startsWith("publications/") ? "r2" : "supabase",
        asset_type: "pdf",
      }
    }
  }

  const isPaid = !book.is_free && (book.price_cents || 0) > 0

  // Enforce download policy: paid publications are strictly in-browser reading only
  const isDownloadable = isAdmin ? true : isPaid ? false : Boolean(pdfAsset?.is_downloadable)

  // Use authenticated server-side stream URL
  const pdfStreamUrl = pdfAsset ? `/api/books/${bookId}/pdf-stream` : null

  const userProgress = progress as { current_page?: number; progress_percentage?: number } | null
  const userBookmarks = (bookmarks as any[]) || []

  return (
    <EBookReader
      book={{
        id: book.id,
        title: book.title,
        subtitle: book.subtitle,
        slug: book.slug,
        author: (book.authors as any)?.name || "HiddenBooks Editorial",
        pages: book.pages || 1,
        format: book.format || "PDF",
        isFree: Boolean(book.is_free),
        tableOfContents: Array.isArray(book.table_of_contents) ? book.table_of_contents : [],
      }}
      pdfStreamUrl={pdfStreamUrl}
      isDownloadable={isDownloadable}
      initialPage={userProgress?.current_page || 1}
      initialProgress={userProgress?.progress_percentage || 0}
      initialBookmarks={userBookmarks}
    />
  )
}
