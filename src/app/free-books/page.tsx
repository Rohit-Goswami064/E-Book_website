import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { BookCard } from "@/components/books/book-card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import { Gift, BookOpen, Sparkles, CheckCircle2 } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "100% Free Books — No Subscription Required",
  description:
    "Explore our collection of complimentary and public domain eBooks. Read online in your browser or download PDFs without any subscription fees.",
}

export default async function FreeBooksPage() {
  const user = await getCurrentUser()
  const isAdmin = await isCurrentUserAdmin()
  const supabase = await createClient()

  const { data: books } = await supabase
    .from("books")
    .select(
      "id, title, slug, subtitle, price_cents, original_price_cents, currency, is_free, format, cover_image_url, audio_duration, authors(name)"
    )
    .eq("is_published", true)
    .or("is_free.eq.true,price_cents.eq.0")
    .order("created_at", { ascending: false })

  const mapBook = (b: any) => ({
    id: b.id,
    title: b.title,
    slug: b.slug,
    subtitle: b.subtitle,
    authorName: b.authors?.name || "HiddenBooks Editorial",
    priceCents: 0,
    originalPriceCents: b.original_price_cents,
    currency: b.currency,
    isFree: true,
    format: b.format,
    coverImageUrl: b.cover_image_url,
    audioDuration: b.audio_duration,
  })

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F5F2]">
      <Header
        user={user ? { id: user.id, email: user.email, name: user.user_metadata?.full_name } : null}
        isAdmin={isAdmin}
      />

      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 py-8 md:py-14">
        {/* Editorial Free Books Banner */}
        <div className="rounded-[32px] bg-[#111111] text-white p-8 md:p-12 mb-12 shadow-xl relative overflow-hidden">
          <div className="max-w-2xl relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8F5E9] text-[#1B5E20] border border-[#C8E6C9] text-xs font-bold">
              <Gift className="w-3.5 h-3.5" />
              <span>100% Free Forever</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
              Open-Access Literary Treasures
            </h1>
            <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
              No credit card required, no expiring trial, and no recurring charges. Read high-quality public domain and author-donated editions directly in our in-browser reader or download PDFs.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 text-xs font-medium text-neutral-300">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Complete Full Text
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Synchronized Library
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Offline PDF Download
              </span>
            </div>
          </div>

          <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full border border-white/10 opacity-30 pointer-events-none" />
        </div>

        {/* Free Books Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-black/[0.06] pb-4">
            <div>
              <h2 className="font-serif text-2xl font-bold text-neutral-900">
                Available Free Editions
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                {books?.length || 0} titles ready for immediate reading
              </p>
            </div>
          </div>

          {books && books.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
              {books.map((book) => (
                <BookCard key={book.id} book={mapBook(book)} />
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] bg-white border border-black/10 p-12 text-center max-w-md mx-auto">
              <BookOpen className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <h3 className="font-serif text-xl font-bold text-neutral-900">
                New Free Titles Arriving Soon
              </h3>
              <p className="text-xs text-neutral-500 mt-2">
                Our editorial team is formatting additional public domain classics into clean digital editions.
              </p>
              <Link href="/books" className="inline-block mt-4">
                <Button size="sm" variant="default" className="rounded-full">
                  Browse All Books
                </Button>
              </Link>
            </div>
          )}
        </div>
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  )
}
