import Link from "next/link"
import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
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
    <div className="min-h-screen flex flex-col bg-[#F6F5F2]">
      <Header
        user={{ id: user.id, email: user.email, name: user.user_metadata?.full_name }}
        isAdmin={isAdmin}
      />

      <main className="flex-1 max-w-[1080px] w-full mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-black/[0.06] pb-6">
          <div>
            <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-neutral-400 mb-1">
              Personal Collection
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#111111]">
              My Library
            </h1>
            <p className="text-xs text-neutral-500 mt-1">
              {books.length} publications ready for reading
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/books">
              <Button variant="outline" size="sm" className="rounded-full text-xs font-semibold">
                Explore More Titles
              </Button>
            </Link>
          </div>
        </div>

        {/* Books List (matching Reference 2 Screen 09) */}
        {books.length > 0 ? (
          <div className="space-y-4">
            {books.map(({ book, progress, grantedAt }, idx) => {
              const percent = progress?.progress_percentage || 0
              const bgColor = PALETTE[idx % PALETTE.length]

              return (
                <div
                  key={book.id}
                  className="rounded-[24px] bg-white border border-black/[0.06] p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between transition-all hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    {/* Cover thumbnail */}
                    <Link
                      href={`/read/${book.id}`}
                      className="w-16 h-20 sm:w-20 sm:h-24 rounded-[16px] flex flex-col justify-between p-2.5 shrink-0 border border-black/5 hover:opacity-90 transition relative overflow-hidden select-none"
                      style={{ backgroundColor: bgColor }}
                    >
                      {book.cover_image_url ? (
                        <img src={book.cover_image_url} alt={book.title} className="w-full h-full object-cover rounded-[12px]" />
                      ) : (
                        <>
                          <span className="text-[9px] font-bold tracking-wider uppercase opacity-60">HB</span>
                          <span className="font-serif font-bold text-xs sm:text-sm text-neutral-900 leading-tight line-clamp-2">
                            {book.title}
                          </span>
                          <span className="text-[8px] opacity-60 uppercase">{book.format}</span>
                        </>
                      )}
                    </Link>

                    {/* Metadata & Progress */}
                    <div className="space-y-1.5">
                      <Link href={`/read/${book.id}`} className="hover:underline">
                        <h2 className="font-bold text-base sm:text-lg text-neutral-900 leading-snug">
                          {book.title}
                        </h2>
                      </Link>
                      <p className="text-xs text-neutral-500">
                        {book.authors?.name || "HiddenBooks Publishing"} • Added {formatDate(grantedAt)}
                      </p>

                      {/* Progress Bar matching Reference 2 */}
                      <div className="pt-1 max-w-xs space-y-1">
                        <div className="h-1.5 bg-black/10 rounded-full overflow-hidden w-full max-w-[240px]">
                          <div
                            className="h-full bg-[#111111] rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-neutral-500 font-medium flex items-center justify-between w-full max-w-[240px]">
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
                  <div className="flex items-center gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-black/[0.04]">
                    <Link href={`/read/${book.id}`} className="flex-1 sm:flex-initial">
                      <Button size="sm" className="w-full rounded-full bg-[#111111] text-xs font-bold px-5 gap-1.5">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{percent > 0 ? "Resume Reading" : "Start Reading"}</span>
                      </Button>
                    </Link>
                    <Link href={`/books/${book.slug}`}>
                      <Button variant="outline" size="sm" className="rounded-full text-xs font-semibold px-3">
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
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  )
}
