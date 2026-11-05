import Link from "next/link"
import { redirect } from "next/navigation"
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
    <div className="space-y-4 sm:space-y-5">
      <div className="border-b border-neutral-200/80 pb-3.5">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
          Saved for Later
        </h1>
        <p className="text-xs text-neutral-500 mt-0.5">
          {books.length} publications saved to your reading wishlist.
        </p>
      </div>

      {books.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {books.map((book) => (
            <BookCard key={book.id} book={mapBook(book)} initialWishlisted={true} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-neutral-200/80 p-10 text-center max-w-md mx-auto shadow-2xs">
          <Bookmark className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-neutral-800">
            Your Wishlist is Empty
          </h3>
          <p className="text-xs text-neutral-500 mt-1">
            Save books as you browse our catalogue to easily find them when you&apos;re ready to read.
          </p>
          <Link href="/books" className="inline-block mt-4">
            <Button size="sm" className="rounded-lg text-xs font-semibold h-8 px-3.5 bg-neutral-900 text-white hover:bg-neutral-800">
              Explore Catalogue
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
