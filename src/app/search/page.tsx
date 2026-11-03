import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { BookCard } from "@/components/books/book-card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import { Search as SearchIcon, BookOpen, User, Tag, Sparkles } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Search Publications, Authors & Topics",
  description: "Find curated eBooks, authors, and literary collections on HiddenBooks.",
}

export const dynamic = "force-dynamic"

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams
  const user = await getCurrentUser()
  const isAdmin = await isCurrentUserAdmin()
  const supabase = await createClient()

  const cleanQuery = q.trim()

  let books: any[] = []
  let authors: any[] = []
  let categories: any[] = []

  if (cleanQuery) {
    // 1. Search books
    const { data: bData } = await supabase
      .from("books")
      .select("id, title, slug, subtitle, price_cents, original_price_cents, currency, is_free, format, cover_image_url, audio_duration, authors(name)")
      .eq("is_published", true)
      .or(`title.ilike.%${cleanQuery}%,description.ilike.%${cleanQuery}%,subtitle.ilike.%${cleanQuery}%`)
      .limit(12)

    books = bData || []

    // 2. Search authors
    const { data: aData } = await supabase
      .from("authors")
      .select("id, name, slug, bio, avatar_url")
      .eq("is_published", true)
      .ilike("name", `%${cleanQuery}%`)
      .limit(6)

    authors = aData || []

    // 3. Search categories
    const { data: cData } = await supabase
      .from("categories")
      .select("id, name, slug, description, color_code")
      .eq("is_published", true)
      .ilike("name", `%${cleanQuery}%`)
      .limit(6)

    categories = cData || []
  }

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
  })

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F5F2]">
      <Header
        user={user ? { id: user.id, email: user.email, name: user.user_metadata?.full_name } : null}
        isAdmin={isAdmin}
      />

      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 py-8 md:py-12">
        {/* Search Input Bar */}
        <div className="max-w-2xl mx-auto mb-12 text-center space-y-4">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-neutral-900">
            Search Catalogue
          </h1>
          <form method="GET" action="/search" className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <Input
              name="q"
              defaultValue={cleanQuery}
              placeholder="Search by book title, author name, or topic..."
              className="h-13 pl-12 pr-4 rounded-full bg-white border border-black/10 shadow-md text-sm"
              autoFocus
            />
          </form>

          {/* Quick Suggestions */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-neutral-500 pt-1">
            <span className="font-bold text-neutral-400">Suggestions:</span>
            {["गोदान", "शांत दिमाग", "उपन्यास", "स्व-सहायता", "इतिहास", "Audiobooks"].map((s) => (
              <Link
                key={s}
                href={`/search?q=${encodeURIComponent(s)}`}
                className="px-3 py-1 rounded-full bg-white border border-black/10 hover:bg-neutral-100 text-neutral-700 transition"
              >
                {s}
              </Link>
            ))}
          </div>
        </div>

        {cleanQuery ? (
          <div className="space-y-12">
            {/* Matching Categories */}
            {categories.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Matching Categories</span>
                </h3>
                <div className="flex flex-wrap gap-3">
                  {categories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/categories/${cat.slug}`}
                      className="px-4 py-2 rounded-full border border-black/10 font-bold text-xs hover:bg-white transition"
                      style={{ backgroundColor: cat.color_code || "#FFFFFF" }}
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Matching Authors */}
            {authors.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>Matching Authors</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {authors.map((auth) => (
                    <Link
                      key={auth.id}
                      href={`/authors/${auth.slug}`}
                      className="rounded-[20px] bg-white border border-black/[0.06] p-4 flex items-center gap-3 hover:shadow-sm transition"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#111111] text-white flex items-center justify-center font-bold text-sm font-serif shrink-0">
                        {auth.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-neutral-900">{auth.name}</div>
                        <div className="text-[11px] text-neutral-500">View author bibliography</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Matching Books */}
            <div>
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-3 mb-6">
                <h2 className="font-serif text-2xl font-bold text-neutral-900">
                  Books ({books.length})
                </h2>
                <span className="text-xs text-neutral-500">
                  Results for &quot;{cleanQuery}&quot;
                </span>
              </div>

              {books.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                  {books.map((b) => (
                    <BookCard key={b.id} book={mapBook(b)} />
                  ))}
                </div>
              ) : (
                <div className="rounded-[28px] bg-white border border-black/10 p-12 text-center max-w-md mx-auto">
                  <BookOpen className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                  <h3 className="font-serif text-xl font-bold text-neutral-900">
                    No Books Matched &quot;{cleanQuery}&quot;
                  </h3>
                  <p className="text-xs text-neutral-500 mt-2">
                    Try searching for broader terms such as author names or genre categories.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-[28px] bg-white border border-dashed border-black/15 p-12 text-center max-w-md mx-auto">
            <Sparkles className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
            <p className="text-xs text-neutral-500">
              Type a title, author, or keyword above to search our curated catalogue.
            </p>
          </div>
        )}
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  )
}
