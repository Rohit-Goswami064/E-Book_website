import Link from "next/link"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import { formatDate } from "@/lib/utils"
import { BookOpen, Download, Library as LibraryIcon, ArrowRight, Star } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function MyLibraryPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login?redirect=/account/library")
  }

  const isAdmin = await isCurrentUserAdmin()
  const supabase = await createClient()

  // 1. Fetch user entitlements
  const { data: entitlements } = await supabase
    .from("book_entitlements")
    .select(
      `
      id, granted_at, entitlement_type,
      books (
        id, title, slug, subtitle, format, pages, audio_duration, cover_image_url,
        authors (name)
      )
    `
    )
    .eq("user_id", user.id)
    .eq("is_revoked", false)
    .order("granted_at", { ascending: false })

  // 2. Fetch user's reading progress across these books
  const { data: progressList } = await supabase
    .from("reading_progress")
    .select("book_id, current_page, total_pages, progress_percentage, last_read_at, last_chapter")
    .eq("user_id", user.id)

  const progressMap = new Map((progressList || []).map((p) => [p.book_id, p]))

  const books = (entitlements || [])
    .map((e: any) => ({
      entitlementId: e.id,
      grantedAt: e.granted_at,
      type: e.entitlement_type,
      book: e.books,
      progress: progressMap.get(e.books?.id),
    }))
    .filter((item) => item.book)

  const PALETTE = ["#E8E0D6", "#DDE8E2", "#E2DFEB", "#FDE9D9", "#DBE7FD"]

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200/80 pb-3.5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
            My Library
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {books.length} publications ready for reading
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/books">
            <Button variant="outline" size="sm" className="rounded-lg text-xs font-medium h-8 px-3 border-neutral-200 hover:bg-neutral-50">
              Explore More Titles
            </Button>
          </Link>
        </div>
      </div>

      {/* Books List */}
      {books.length > 0 ? (
        <div className="space-y-3">
          {books.map(({ book, progress, grantedAt }, idx) => {
            const percent = progress?.progress_percentage || 0
            const bgColor = PALETTE[idx % PALETTE.length]

            return (
              <div
                key={book.id}
                className="rounded-xl bg-white border border-neutral-200/80 p-3.5 sm:p-4 shadow-2xs flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between transition-all hover:shadow-xs hover:border-neutral-300"
              >
                <div className="flex items-center gap-3.5">
                  {/* Cover thumbnail */}
                  <Link
                    href={`/read/${book.id}`}
                    className="w-14 h-18 sm:w-16 sm:h-20 rounded-lg flex flex-col justify-between p-2 shrink-0 border border-black/5 hover:opacity-90 transition relative overflow-hidden select-none shadow-2xs"
                    style={{ backgroundColor: bgColor }}
                  >
                    {book.cover_image_url ? (
                      <img src={book.cover_image_url} alt={book.title} className="w-full h-full object-cover rounded-md" />
                    ) : (
                      <>
                        <span className="text-[8px] font-bold tracking-wider uppercase opacity-60">HB</span>
                        <span className="font-serif font-bold text-[11px] sm:text-xs text-neutral-900 leading-tight line-clamp-2">
                          {book.title}
                        </span>
                        <span className="text-[7px] opacity-60 uppercase">{book.format}</span>
                      </>
                    )}
                  </Link>

                  {/* Metadata & Progress */}
                  <div className="space-y-1">
                    <Link href={`/read/${book.id}`} className="hover:underline">
                      <h2 className="font-bold text-sm sm:text-base text-neutral-900 leading-snug">
                        {book.title}
                      </h2>
                    </Link>
                    <p className="text-[11px] sm:text-xs text-neutral-500">
                      {book.authors?.name || "HiddenBooks Publishing"} • Added {formatDate(grantedAt)}
                    </p>

                    {/* Progress Bar */}
                    <div className="pt-0.5 max-w-xs space-y-1">
                      <div className="h-1 bg-neutral-100 rounded-full overflow-hidden w-full max-w-[220px]">
                        <div
                          className="h-full bg-neutral-900 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-neutral-500 font-medium flex items-center justify-between w-full max-w-[220px]">
                        <span>
                          {percent > 0 ? `${percent}% completed` : "Not started yet"}
                        </span>
                        {progress?.current_page && (
                          <span>Page {progress.current_page} of {book.pages || progress.total_pages}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-neutral-100">
                  <Link href={`/read/${book.id}`} className="flex-1 sm:flex-initial">
                    <Button size="sm" className="w-full rounded-lg bg-neutral-900 text-white text-xs font-semibold h-8 px-3.5 gap-1.5 hover:bg-neutral-800">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{percent > 0 ? "Resume" : "Start Reading"}</span>
                    </Button>
                  </Link>
                  <Link href={`/books/${book.slug}`}>
                    <Button variant="outline" size="sm" className="rounded-lg text-xs font-medium h-8 px-3 border-neutral-200 hover:bg-neutral-50">
                      Details
                    </Button>
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
          <div className="rounded-[32px] bg-white border border-black/10 p-14 text-center max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#F5F5F5] flex items-center justify-center mx-auto text-neutral-400">
              <LibraryIcon className="w-8 h-8" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-neutral-900">
              Your Library is Empty
            </h2>
            <p className="text-xs text-neutral-500 leading-relaxed">
              When you purchase books or claim complimentary editions, they will appear here permanently with synced reading progress.
            </p>
            <div className="pt-2 flex justify-center gap-2">
              <Link href="/books">
                <Button size="sm" className="rounded-full bg-[#111111] text-xs font-bold px-6">
                  Browse Books
                </Button>
              </Link>
              <Link href="/free-books">
                <Button variant="outline" size="sm" className="rounded-full text-xs font-bold">
                  Free Titles
                </Button>
              </Link>
            </div>
          </div>
        )}
    </div>
  )
}
