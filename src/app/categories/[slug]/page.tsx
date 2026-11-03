import Link from "next/link"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { BookCard } from "@/components/books/book-card"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import { ChevronRight, BookOpen } from "lucide-react"
import type { Metadata } from "next"

interface CategoryPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: category } = await supabase
    .from("categories")
    .select("name, description")
    .eq("slug", slug)
    .maybeSingle()

  if (!category) return { title: "Category Not Found" }

  return {
    title: `${category.name} Books & Editions`,
    description: category.description || `Discover curated ${category.name} on HiddenBooks.`,
    alternates: {
      canonical: `/categories/${slug}`,
    },
  }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params
  const user = await getCurrentUser()
  const isAdmin = await isCurrentUserAdmin()
  const supabase = await createClient()

  // 1. Fetch category
  const { data: category } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle()

  if (!category) {
    notFound()
  }

  // 2. Fetch books in this category
  const { data: booksData } = await supabase
    .from("book_categories")
    .select(
      `
      books (
        id, title, slug, subtitle, price_cents, original_price_cents, currency, is_free, format, cover_image_url, audio_duration, is_published,
        authors (name)
      )
    `
    )
    .eq("category_id", category.id)

  const books = (booksData || [])
    .map((item: any) => item.books)
    .filter((b: any) => b && b.is_published)

  const mapBook = (b: any) => ({
    id: b.id,
    title: b.title,
    slug: b.slug,
    subtitle: b.subtitle,
    authorName: b.authors?.name || "HiddenBooks Editorial",
    priceCents: b.price_cents,
    originalPriceCents: b.original_price_cents,
    currency: b.currency,
    isFree: b.is_free,
    format: b.format,
    coverImageUrl: b.cover_image_url,
    audioDuration: b.audio_duration,
    categoryName: category.name,
    colorCode: category.color_code,
  })

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F5F2]">
      <Header
        user={user ? { id: user.id, email: user.email, name: user.user_metadata?.full_name } : null}
        isAdmin={isAdmin}
      />

      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 py-8 md:py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-neutral-500 mb-8">
          <Link href="/" className="hover:text-black">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/books" className="hover:text-black">Categories</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-neutral-900 font-semibold">{category.name}</span>
        </nav>

        {/* Category Header */}
        <div
          className="rounded-[32px] p-8 md:p-12 mb-12 border border-black/[0.06] shadow-sm relative overflow-hidden"
          style={{ backgroundColor: category.color_code || "#E8E0D6" }}
        >
          <div className="max-w-2xl">
            <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-neutral-600 block mb-2">
              Category Collection
            </span>
            <h1 className="font-serif text-3xl sm:text-5xl font-bold text-[#111111]">
              {category.name}
            </h1>
            {category.description && (
              <p className="text-sm sm:text-base text-neutral-700 mt-3 leading-relaxed">
                {category.description}
              </p>
            )}
            <div className="mt-4 text-xs font-semibold text-neutral-600">
              {books.length} publications in collection
            </div>
          </div>
        </div>

        {/* Category Books Grid */}
        {books.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {books.map((book: any) => (
              <BookCard key={book.id} book={mapBook(book)} />
            ))}
          </div>
        ) : (
          <div className="rounded-[28px] bg-white border border-black/10 p-12 text-center max-w-md mx-auto">
            <BookOpen className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <h3 className="font-serif text-xl font-bold text-neutral-800">
              No Titles in this Category Yet
            </h3>
            <p className="text-xs text-neutral-500 mt-2">
              Check back soon as we curate new works for {category.name}.
            </p>
            <Link href="/books" className="inline-block mt-4">
              <button className="px-5 py-2.5 rounded-full bg-black text-white text-xs font-bold">
                Browse All Books
              </button>
            </Link>
          </div>
        )}
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  )
}
