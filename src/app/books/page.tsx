import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { BookCard } from "@/components/books/book-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import { Filter, SlidersHorizontal, Search as SearchIcon, X, BookOpen } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Catalogue — All Publications",
  description:
    "Explore our complete catalogue of curated eBooks and audiobooks. Filter by category, author, price, and format.",
}

export const dynamic = "force-dynamic"

interface CataloguePageProps {
  searchParams: Promise<{
    q?: string
    category?: string
    author?: string
    price?: string
    sort?: string
    format?: string
    page?: string
  }>
}

export default async function BooksCataloguePage({ searchParams }: CataloguePageProps) {
  const params = await searchParams
  const user = await getCurrentUser()
  const isAdmin = await isCurrentUserAdmin()
  const supabase = await createClient()

  const q = params.q?.trim() || ""
  const selectedCategory = params.category || ""
  const selectedPrice = params.price || ""
  const selectedSort = params.sort || "newest"
  const selectedFormat = params.format || ""
  const currentPage = parseInt(params.page || "1", 10)
  const pageSize = 12

  // 1. Fetch categories for filters
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("is_published", true)
    .order("display_order", { ascending: true })

  // 2. Fetch authors for filters
  const { data: authors } = await supabase
    .from("authors")
    .select("id, name, slug")
    .eq("is_published", true)
    .order("name", { ascending: true })

  // 3. Build dynamic books query
  let query = supabase
    .from("books")
    .select(
      "id, title, slug, subtitle, price_cents, original_price_cents, currency, is_free, format, cover_image_url, audio_duration, authors(name)",
      { count: "exact" }
    )
    .eq("is_published", true)

  if (q) {
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,subtitle.ilike.%${q}%`)
  }

  if (selectedPrice === "free") {
    query = query.or("is_free.eq.true,price_cents.eq.0")
  } else if (selectedPrice === "under-150") {
    query = query.lte("price_cents", 15000).gt("price_cents", 0)
  } else if (selectedPrice === "under-300") {
    query = query.lte("price_cents", 30000).gt("price_cents", 0)
  }

  if (selectedFormat) {
    query = query.ilike("format", `%${selectedFormat}%`)
  }

  // Sorting
  switch (selectedSort) {
    case "price_asc":
      query = query.order("price_cents", { ascending: true })
      break
    case "price_desc":
      query = query.order("price_cents", { ascending: false })
      break
    case "popularity":
      query = query.order("sales_count", { ascending: false })
      break
    case "title":
      query = query.order("title", { ascending: true })
      break
    case "newest":
    default:
      query = query.order("created_at", { ascending: false })
      break
  }

  // Pagination range
  const from = (currentPage - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data: books, count } = await query
  const totalCount = count || 0
  const totalPages = Math.ceil(totalCount / pageSize)

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

  // Helper to build filter query string
  const createQueryUrl = (overrides: Record<string, string | null>) => {
    const current = new URLSearchParams()
    if (q) current.set("q", q)
    if (selectedCategory) current.set("category", selectedCategory)
    if (selectedPrice) current.set("price", selectedPrice)
    if (selectedSort && selectedSort !== "newest") current.set("sort", selectedSort)
    if (selectedFormat) current.set("format", selectedFormat)

    Object.entries(overrides).forEach(([key, val]) => {
      if (val === null) current.delete(key)
      else current.set(key, val)
    })

    const qs = current.toString()
    return `/books${qs ? `?${qs}` : ""}`
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F5F2]">
      <Header
        user={user ? { id: user.id, email: user.email, name: user.user_metadata?.full_name } : null}
        isAdmin={isAdmin}
      />

      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 py-8 md:py-12">
        {/* Page Header */}
        <div className="border-b border-black/[0.06] pb-6 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-neutral-400 mb-1">
              Catalogue
            </div>
            <h1 className="font-serif text-3xl sm:text-5xl font-bold text-[#111111]">
              All Publications
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              Showing {books?.length || 0} of {totalCount} curated editions
            </p>
          </div>

          {/* Search bar inside catalogue */}
          <form method="GET" action="/books" className="relative w-full md:w-80">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search catalogue..."
              className="pl-10 pr-4 h-11 text-xs bg-white rounded-full border-black/10 shadow-sm"
            />
            {q && (
              <Link
                href="/books"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black"
              >
                <X className="w-4 h-4" />
              </Link>
            )}
          </form>
        </div>

        {/* Filters and Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Desktop Filter Sidebar */}
          <aside className="hidden lg:block space-y-6">
            <div className="rounded-[24px] bg-white border border-black/[0.06] p-6 space-y-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
                <span className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                  <Filter className="w-4 h-4" /> Filters
                </span>
                {(q || selectedCategory || selectedPrice || selectedFormat) && (
                  <Link href="/books" className="text-xs text-neutral-500 hover:underline">
                    Reset all
                  </Link>
                )}
              </div>

              {/* Price filter */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                  Pricing
                </h4>
                <div className="space-y-1.5 text-xs font-medium">
                  {[
                    { label: "All Prices", value: "" },
                    { label: "100% Free", value: "free" },
                    { label: "Under ₹150", value: "under-150" },
                    { label: "Under ₹300", value: "under-300" },
                  ].map((p) => (
                    <Link
                      key={p.label}
                      href={createQueryUrl({ price: p.value || null, page: "1" })}
                      className={`block px-3 py-1.5 rounded-full transition ${
                        selectedPrice === p.value
                          ? "bg-[#111111] text-white font-bold"
                          : "text-neutral-700 hover:bg-neutral-100"
                      }`}
                    >
                      {p.label}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Format Filter */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                  Format
                </h4>
                <div className="space-y-1.5 text-xs font-medium">
                  {[
                    { label: "All Formats", value: "" },
                    { label: "PDF eBooks", value: "PDF" },
                    { label: "Audiobooks", value: "Audio" },
                  ].map((f) => (
                    <Link
                      key={f.label}
                      href={createQueryUrl({ format: f.value || null, page: "1" })}
                      className={`block px-3 py-1.5 rounded-full transition ${
                        selectedFormat === f.value
                          ? "bg-[#111111] text-white font-bold"
                          : "text-neutral-700 hover:bg-neutral-100"
                      }`}
                    >
                      {f.label}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Categories */}
              {categories && categories.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                    Categories
                  </h4>
                  <div className="space-y-1.5 text-xs font-medium">
                    {categories.map((c) => (
                      <Link
                        key={c.id}
                        href={`/categories/${c.slug}`}
                        className="block px-3 py-1.5 rounded-full text-neutral-700 hover:bg-neutral-100 transition truncate"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {/* Quick Horizontal Sort & Mobile Filter Pills */}
            <div className="mb-6 space-y-2.5">
              {/* Mobile Filter Chips (Visible on mobile/tablet) */}
              <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
                {[
                  { label: "All Editions", key: "price", val: null },
                  { label: "100% Free", key: "price", val: "free" },
                  { label: "Under ₹150", key: "price", val: "under-150" },
                  { label: "Under ₹300", key: "price", val: "under-300" },
                  { label: "Audiobooks", key: "format", val: "audio" },
                  { label: "PDF Editions", key: "format", val: "pdf" },
                ].map((f) => {
                  const isActive = f.key === "price" ? selectedPrice === (f.val || "") : selectedFormat === (f.val || "")
                  return (
                    <Link
                      key={f.label}
                      href={createQueryUrl({ [f.key]: f.val, page: "1" })}
                      className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition shrink-0 ${
                        isActive
                          ? "bg-[#111111] text-white shadow-sm"
                          : "bg-white border border-black/10 text-neutral-700 hover:bg-neutral-100"
                      }`}
                    >
                      {f.label}
                    </Link>
                  )
                })}
              </div>

              {/* Sort Pills */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-black/[0.06] p-2 sm:p-3 rounded-[20px] sm:rounded-full shadow-sm">
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none px-1 w-full sm:w-auto">
                  {[
                    { label: "Newest", value: "newest" },
                    { label: "Most Popular", value: "popularity" },
                    { label: "Price: Low to High", value: "price_asc" },
                    { label: "Price: High to Low", value: "price_desc" },
                  ].map((s) => (
                    <Link
                      key={s.label}
                      href={createQueryUrl({ sort: s.value, page: "1" })}
                      className={`whitespace-nowrap px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-medium transition ${
                        selectedSort === s.value
                          ? "bg-[#111111] text-white font-bold"
                          : "text-neutral-600 hover:bg-neutral-100"
                      }`}
                    >
                      {s.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Books Grid */}
            {books && books.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-3 sm:gap-6">
                {books.map((book) => (
                  <BookCard key={book.id} book={mapBook(book)} />
                ))}
              </div>
            ) : (
              /* Empty Results State */
              <div className="rounded-[28px] bg-white border border-black/10 p-12 text-center my-8">
                <BookOpen className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                <h3 className="font-serif text-xl font-bold text-neutral-800">
                  No matching books found
                </h3>
                <p className="text-xs sm:text-sm text-neutral-500 mt-2 max-w-sm mx-auto">
                  {q
                    ? `No publications match "${q}". Try adjusting your keywords or clearing the active filters.`
                    : "No published books currently match the selected criteria."}
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  <Link href="/books">
                    <Button variant="default" size="sm" className="rounded-full">
                      Clear Filters
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Link
                    key={p}
                    href={createQueryUrl({ page: String(p) })}
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition ${
                      p === currentPage
                        ? "bg-[#111111] text-white"
                        : "bg-white border border-black/10 text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    {p}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  )
}
