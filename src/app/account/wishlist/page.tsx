import Link from "next/link"
import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { BookCard } from "@/components/books/book-card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import { Bookmark, ChevronRight } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function WishlistPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login?redirect=/account/wishlist")
  }

  const isAdmin = await isCurrentUserAdmin()
  const supabase = await createClient()

  // Fetch wishlisted books
  const { data: wishlistItems } = await supabase
    .from("wishlists")
    .select(
      `
      id, created_at,
      books (
        id, title, slug, subtitle, price_cents, original_price_cents, currency, is_free, format, cover_image_url, audio_duration,
        authors (name)
      )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const books = (wishlistItems || [])
    .map((w: any) => w.books)
    .filter(Boolean)

  const mapBook = (b: any) => ({
    id: b.id,
    title: b.title,
    slug: b.slug,
    subtitle: b.subtitle,
    authorName: b.authors?.name || "HiddenBooks Publishing",
    priceCents: b.price_cents,
    originalPriceCents: b.original_price_cents,
    currency: b.currency,
    isFree: b.is_free,
    format: b.format,
    coverImageUrl: b.cover_image_url,
    audioDuration: b.audio_duration,
  })

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F5F2]">
      <Header
        user={{ id: user.id, email: user.email, name: user.user_metadata?.full_name }}
        isAdmin={isAdmin}
      />

      <main className="flex-1 max-w-[1080px] w-full mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-6">
        <nav className="flex items-center gap-2 text-xs text-neutral-500 mb-2">
          <Link href="/account" className="hover:text-black">Account</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-neutral-900 font-semibold">Saved Wishlist</span>
        </nav>

        <div className="border-b border-black/[0.06] pb-4">
          <h1 className="font-serif text-3xl font-bold text-neutral-900">
            Saved for Later
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            {books.length} publications saved to your reading wishlist.
          </p>
        </div>

        {books.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {books.map((book) => (
              <BookCard key={book.id} book={mapBook(book)} initialWishlisted={true} />
            ))}
          </div>
        ) : (
          <div className="rounded-[28px] bg-white border border-black/10 p-12 text-center max-w-md mx-auto">
            <Bookmark className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <h3 className="font-serif text-xl font-bold text-neutral-800">
              Your Wishlist is Empty
            </h3>
            <p className="text-xs text-neutral-500 mt-2">
              Save books as you browse our catalogue to easily find them when you&apos;re ready to read.
            </p>
            <Link href="/books" className="inline-block mt-4">
              <Button size="sm" className="rounded-full bg-[#111111]">
                Explore Catalogue
              </Button>
            </Link>
          </div>
        )}
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  )
}
