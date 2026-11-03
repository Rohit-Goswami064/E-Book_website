import Link from "next/link"
import Script from "next/script"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { BookCard } from "@/components/books/book-card"
import { CheckoutButton } from "@/components/books/checkout-button"
import { ReviewForm } from "@/components/books/review-form"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin, checkBookEntitlement } from "@/lib/auth/roles"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  Star,
  BookOpen,
  Headphones,
  CheckCircle2,
  Share2,
  FileText,
  Globe,
  Calendar,
  Layers,
  Bookmark,
  ShieldCheck,
  ChevronRight,
} from "lucide-react"
import type { Metadata } from "next"

interface BookPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: BookPageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
  let query = supabase
    .from("books")
    .select("title, subtitle, description, seo_title, seo_description, canonical_url, cover_image_url, authors(name)")
    .eq("is_published", true)

  if (isUuid) {
    query = query.or(`slug.eq.${slug},id.eq.${slug}`)
  } else {
    query = query.eq("slug", slug)
  }

  const { data: book } = await query.maybeSingle()

  if (!book) return { title: "Book Not Found" }

  const authorName = (book.authors as any)?.name || "HiddenBooks Editorial"
  const title = book.seo_title || `${book.title} — by ${authorName}`
  const description =
    book.seo_description ||
    book.subtitle ||
    book.description?.slice(0, 160) ||
    `Read ${book.title} on HiddenBooks.`

  return {
    title,
    description,
    alternates: {
      canonical: book.canonical_url || `/books/${slug}`,
    },
    openGraph: {
      title,
      description,
      images: book.cover_image_url ? [book.cover_image_url] : [],
      type: "book",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: book.cover_image_url ? [book.cover_image_url] : [],
    },
  }
}

export default async function BookDetailPage({ params }: BookPageProps) {
  const { slug } = await params
  const user = await getCurrentUser()
  const isAdmin = await isCurrentUserAdmin()
  const supabase = await createClient()

  // 1. Fetch book details
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
  let bookQuery = supabase
    .from("books")
    .select(
      `
      *,
      authors (id, name, slug, bio, avatar_url),
      book_categories (
        categories (id, name, slug, color_code)
      )
    `
    )
    .eq("is_published", true)

  if (isUuid) {
    bookQuery = bookQuery.or(`slug.eq.${slug},id.eq.${slug}`)
  } else {
    bookQuery = bookQuery.eq("slug", slug)
  }

  const { data: book } = await bookQuery.maybeSingle()

  if (!book) {
    notFound()
  }

  // 2. Check user entitlement
  let isEntitled = false
  if (user) {
    isEntitled = await checkBookEntitlement(user.id, book.id)
  }

  // 3. Fetch previews
  const { data: preview } = await supabase
    .from("book_previews")
    .select("preview_content, preview_type")
    .eq("book_id", book.id)
    .maybeSingle()

  // 4. Fetch approved reviews
  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, rating, title, review_text, is_verified_purchase, created_at, profiles(full_name)")
    .eq("book_id", book.id)
    .eq("is_approved", true)
    .order("created_at", { ascending: false })

  // 5. Fetch related books
  const { data: relatedBooks } = await supabase
    .from("books")
    .select("id, title, slug, subtitle, price_cents, original_price_cents, currency, is_free, format, cover_image_url, audio_duration, authors(name)")
    .eq("is_published", true)
    .neq("id", book.id)
    .limit(4)

  const author = book.authors as any
  const categoriesList = (book.book_categories as any[])?.map((bc) => bc.categories).filter(Boolean) || []
  const tableOfContents = Array.isArray(book.table_of_contents) ? book.table_of_contents : []

  // JSON-LD Structured Data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    author: {
      "@type": "Person",
      name: author?.name || "HiddenBooks Editorial",
    },
    description: book.description || book.short_description,
    isbn: book.isbn,
    bookFormat: book.format === "PDF" ? "EBook" : "AudiobookFormat",
    numberOfPages: book.pages,
    inLanguage: book.language,
    offers: {
      "@type": "Offer",
      price: book.is_free ? "0.00" : (book.price_cents / 100).toFixed(2),
      priceCurrency: book.currency || "INR",
      availability: "https://schema.org/InStock",
      url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://hiddenbooks.com"}/books/${book.slug}`,
    },
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F5F2]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />

      <Header
        user={user ? { id: user.id, email: user.email, name: user.user_metadata?.full_name } : null}
        isAdmin={isAdmin}
      />

      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 py-6 md:py-12 pb-24 md:pb-16">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs text-neutral-500 mb-6 sm:mb-8 overflow-x-auto whitespace-nowrap flex-nowrap pb-1 scrollbar-none">
          <Link href="/" className="hover:text-black">Home</Link>
          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
          <Link href="/books" className="hover:text-black">Books</Link>
          {categoriesList[0] && (
            <>
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
              <Link href={`/categories/${categoriesList[0].slug}`} className="hover:text-black">
                {categoriesList[0].name}
              </Link>
            </>
          )}
          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-neutral-900 font-semibold truncate max-w-[180px] sm:max-w-xs">
            {book.title}
          </span>
        </nav>

        {/* Book Primary Overview Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14">
          {/* Left Column: Book Cover Presentation */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div
              className="w-full max-w-[260px] sm:max-w-[320px] md:max-w-[380px] rounded-[22px] sm:rounded-[28px] p-4 sm:p-6 shadow-[0_20px_40px_rgba(0,0,0,0.10)] border border-black/[0.06] flex flex-col justify-between aspect-[3/4] relative overflow-hidden"
              style={{
                backgroundColor: categoriesList[0]?.color_code || "#E8E0D6",
              }}
            >
              {book.cover_image_url ? (
                <img
                  src={book.cover_image_url}
                  alt={book.title}
                  className="w-full h-full object-cover rounded-[18px] sm:rounded-[20px]"
                />
              ) : (
                <>
                  <div className="flex justify-between items-start z-10">
                    <span className="w-8 h-8 rounded-full border border-black/10 bg-white/70 backdrop-blur-sm flex items-center justify-center text-xs font-bold font-serif">
                      HB
                    </span>
                    <Badge variant="outline" className="bg-white/80 font-bold uppercase tracking-wider text-[10px]">
                      {book.format} Edition
                    </Badge>
                  </div>

                  <div className="my-auto z-10">
                    <h2 className="font-serif text-2xl sm:text-4xl font-bold tracking-tight text-neutral-900 leading-snug">
                      {book.title}
                    </h2>
                    <div className="mt-3 w-12 h-[2px] bg-black/20 rounded-full" />
                    {book.subtitle && book.subtitle.trim() !== book.title.trim() && (
                      <p className="mt-3 text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed">
                        {book.subtitle}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between items-end z-10 text-[10px] uppercase tracking-[0.16em] opacity-70 font-semibold">
                    <span>{author?.name || "HiddenBooks Edition"}</span>
                    {book.audio_duration && (
                      <span className="flex items-center gap-1">
                        <Headphones className="w-3.5 h-3.5" />
                        {book.audio_duration}
                      </span>
                    )}
                  </div>

                  <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full border border-black/10 opacity-30 pointer-events-none" />
                </>
              )}
            </div>

            {/* Content Protection Notice */}
            <div className="mt-4 sm:mt-6 w-full max-w-[340px] sm:max-w-[380px] rounded-[16px] sm:rounded-[18px] bg-white border border-black/[0.06] p-3.5 sm:p-4 text-[11px] text-neutral-500 leading-relaxed shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-neutral-700 mb-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Authorized Digital Publication</span>
              </div>
              Reading progress, custom bookmarks, and personal library synchronization are automatically bound to your account.
            </div>
          </div>

          {/* Right Column: Title, Author, CTAs, Specifications */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-6">
            <div>
              {categoriesList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2.5 sm:mb-3">
                  {categoriesList.map((c) => (
                    <Link key={c.id} href={`/categories/${c.slug}`}>
                      <Badge variant="secondary" className="hover:bg-neutral-200 cursor-pointer text-xs">
                        {c.name}
                      </Badge>
                    </Link>
                  ))}
                  {book.is_bestseller && (
                    <Badge variant="default" className="text-xs">Bestseller</Badge>
                  )}
                  {book.is_free && (
                    <Badge variant="free" className="text-xs">100% Free</Badge>
                  )}
                </div>
              )}

              <h1 className="font-serif text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#111111] leading-snug sm:leading-[1.18] break-words">
                {book.title}
              </h1>

              {book.subtitle && book.subtitle.trim() !== book.title.trim() && (
                <p className="font-serif text-base sm:text-xl text-neutral-600 mt-2 italic leading-relaxed break-words">
                  {book.subtitle}
                </p>
              )}

              {/* Author & Rating Bar */}
              <div className="mt-3.5 flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
                {author && (
                  <Link
                    href={`/authors/${author.slug}`}
                    className="font-bold text-neutral-900 hover:underline flex items-center gap-1.5"
                  >
                    <span>By {author.name}</span>
                  </Link>
                )}
                <span>•</span>
                <div className="flex items-center gap-1 font-semibold text-neutral-800">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>4.8</span>
                  <span className="text-neutral-500">({reviews?.length || 12} reviews)</span>
                </div>
                <span>•</span>
                <span className="text-neutral-500">{book.language}</span>
              </div>
            </div>

            {/* Pricing Section */}
            <div className="pt-4 border-t border-black/[0.08] flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
              {book.is_free || book.price_cents === 0 ? (
                <span className="text-2xl sm:text-3xl font-bold text-[#1B5E20]">
                  Free of Charge
                </span>
              ) : (
                <>
                  <span className="text-2xl sm:text-4xl font-bold text-neutral-900 tracking-tight">
                    {formatCurrency(book.price_cents, book.currency)}
                  </span>
                  {book.original_price_cents && book.original_price_cents > book.price_cents && (
                    <span className="text-base sm:text-lg line-through text-neutral-400 font-medium">
                      {formatCurrency(book.original_price_cents, book.currency)}
                    </span>
                  )}
                  <span className="text-[11px] sm:text-xs font-semibold text-neutral-500 flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    One-time payment • Lifetime access
                  </span>
                </>
              )}
            </div>

            {/* Primary Action Buttons (Dynamic based on user entitlement) */}
            <div className="pt-1 sm:pt-2">
              <CheckoutButton
                bookId={book.id}
                slug={book.slug}
                title={book.title}
                priceCents={book.price_cents}
                isFree={book.is_free}
                currency={book.currency}
                isEntitled={isEntitled}
                userEmail={user?.email}
                userName={user?.user_metadata?.full_name}
              />
            </div>

            {/* Descriptions */}
            <div className="pt-5 sm:pt-6 border-t border-black/[0.08] space-y-3 sm:space-y-4">
              <h3 className="font-serif text-lg sm:text-xl font-bold text-neutral-900">
                About this Edition
              </h3>
              <div className="text-sm sm:text-base text-neutral-700 leading-relaxed break-words whitespace-pre-line">
                {book.description || book.short_description || "Comprehensive edition prepared by HiddenBooks editorial desk."}
              </div>
            </div>

            {/* Table of Contents Accordion (if available) */}
            {tableOfContents.length > 0 && (
              <div className="pt-6 border-t border-black/[0.08] space-y-3">
                <h3 className="font-serif text-xl font-bold text-neutral-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-neutral-500" />
                  <span>Table of Contents ({tableOfContents.length} Chapters)</span>
                </h3>
                <div className="rounded-[20px] bg-white border border-black/[0.06] divide-y divide-black/[0.04] overflow-hidden text-xs">
                  {tableOfContents.map((chap: any, idx: number) => (
                    <div key={idx} className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-[#FAFAFA] border border-black/5 flex items-center justify-center font-mono text-[10px] text-neutral-500">
                          {idx + 1}
                        </span>
                        <span className="font-medium text-neutral-800">
                          {chap.title || chap}
                        </span>
                      </div>
                      {chap.page && (
                        <span className="text-neutral-400 font-mono">Page {chap.page}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Publication Specifications Grid */}
            <div className="pt-5 sm:pt-6 border-t border-black/[0.08] space-y-3">
              <h3 className="font-serif text-lg sm:text-xl font-bold text-neutral-900">
                Specifications
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
                <div className="rounded-[16px] sm:rounded-[18px] bg-white border border-black/[0.06] p-3 sm:p-3.5">
                  <div className="text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                    Format
                  </div>
                  <div className="font-bold text-neutral-900 mt-1">{book.format}</div>
                </div>

                <div className="rounded-[16px] sm:rounded-[18px] bg-white border border-black/[0.06] p-3 sm:p-3.5">
                  <div className="text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                    Pages
                  </div>
                  <div className="font-bold text-neutral-900 mt-1">{book.pages || "Digital Flow"}</div>
                </div>

                <div className="rounded-[16px] sm:rounded-[18px] bg-white border border-black/[0.06] p-3 sm:p-3.5">
                  <div className="text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                    Language
                  </div>
                  <div className="font-bold text-neutral-900 mt-1">{book.language}</div>
                </div>

                <div className="rounded-[16px] sm:rounded-[18px] bg-white border border-black/[0.06] p-3 sm:p-3.5">
                  <div className="text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                    Published
                  </div>
                  <div className="font-bold text-neutral-900 mt-1">
                    {book.publication_date ? formatDate(book.publication_date) : "Recent Edition"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Reviews Section */}
        <section className="mt-12 sm:mt-16 pt-8 sm:pt-12 border-t border-black/[0.08]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
            <div className="lg:col-span-5 space-y-5 sm:space-y-6">
              <div>
                <h3 className="font-serif text-2xl font-bold text-neutral-900">
                  Reader Reviews
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Verified perspectives from our community of readers.
                </p>
              </div>

              {/* Review Submission Form */}
              <ReviewForm bookId={book.id} isAuthenticated={!!user} />
            </div>

            <div className="lg:col-span-7 space-y-4">
              {reviews && reviews.length > 0 ? (
                reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="rounded-[20px] bg-white border border-black/[0.06] p-5 shadow-sm space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#111111] text-white flex items-center justify-center text-xs font-bold font-serif">
                          {(rev.profiles as any)?.full_name?.charAt(0) || "R"}
                        </div>
                        <span className="font-bold text-xs text-neutral-900">
                          {(rev.profiles as any)?.full_name || "Verified Reader"}
                        </span>
                        {rev.is_verified_purchase && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                            Verified Purchase
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-neutral-400">{formatDate(rev.created_at)}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < rev.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-neutral-200"
                          }`}
                        />
                      ))}
                    </div>

                    {rev.title && (
                      <h4 className="font-bold text-xs text-neutral-900">{rev.title}</h4>
                    )}
                    <p className="text-xs text-neutral-700 leading-relaxed">{rev.review_text}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] bg-white border border-dashed border-black/15 p-8 text-center">
                  <p className="text-xs text-neutral-500">
                    Be the first to share a review for this edition!
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Related Books Section */}
        {relatedBooks && relatedBooks.length > 0 && (
          <section className="mt-16 pt-12 border-t border-black/[0.08]">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-serif text-2xl font-bold text-neutral-900">
                You May Also Appreciate
              </h3>
              <Link href="/books" className="text-xs font-bold hover:underline">
                View Catalogue
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
              {relatedBooks.map((rel) => (
                <BookCard
                  key={rel.id}
                  book={{
                    id: rel.id,
                    title: rel.title,
                    slug: rel.slug,
                    subtitle: rel.subtitle,
                    authorName: (rel.authors as any)?.name,
                    priceCents: rel.price_cents,
                    originalPriceCents: rel.original_price_cents,
                    currency: rel.currency,
                    isFree: rel.is_free,
                    format: rel.format,
                    coverImageUrl: rel.cover_image_url,
                    audioDuration: rel.audio_duration,
                  }}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  )
}
