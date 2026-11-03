import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { BookCard } from "@/components/books/book-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import {
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Gift,
  Headphones,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
} from "lucide-react"

export default async function HomePage() {
  const user = await getCurrentUser()
  const isAdmin = await isCurrentUserAdmin()
  const supabase = await createClient()

  // 1. Fetch enabled homepage sections
  const { data: rawSections } = await supabase
    .from("homepage_sections")
    .select("*")
    .eq("is_enabled", true)
    .order("display_order", { ascending: true })

  const sectionsMap = new Map((rawSections || []).map((s) => [s.section_key, s]))

  // 2. Fetch categories
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("is_published", true)
    .order("display_order", { ascending: true })

  // 3. Fetch Featured books
  const { data: featuredBooks } = await supabase
    .from("books")
    .select("id, title, slug, subtitle, price_cents, original_price_cents, currency, is_free, format, cover_image_url, audio_duration, authors(name)")
    .eq("is_published", true)
    .eq("is_featured", true)
    .limit(6)

  // 4. Fetch Bestsellers
  const { data: bestsellers } = await supabase
    .from("books")
    .select("id, title, slug, subtitle, price_cents, original_price_cents, currency, is_free, format, cover_image_url, audio_duration, authors(name)")
    .eq("is_published", true)
    .order("sales_count", { ascending: false })
    .limit(4)

  // 5. Fetch New Releases
  const { data: newReleases } = await supabase
    .from("books")
    .select("id, title, slug, subtitle, price_cents, original_price_cents, currency, is_free, format, cover_image_url, audio_duration, authors(name)")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(4)

  // 6. Fetch Free Books
  const { data: freeBooks } = await supabase
    .from("books")
    .select("id, title, slug, subtitle, price_cents, original_price_cents, currency, is_free, format, cover_image_url, audio_duration, authors(name)")
    .eq("is_published", true)
    .or("is_free.eq.true,price_cents.eq.0")
    .limit(4)

  // 7. Fetch Latest Blog Posts
  const { data: blogPosts } = await supabase
    .from("blog_posts")
    .select("id, title, slug, excerpt, reading_time_minutes, published_at, cover_image_url, authors(name)")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(3)

  // 8. Fetch FAQs
  const { data: faqs } = await supabase
    .from("faqs")
    .select("*")
    .eq("is_published", true)
    .order("display_order", { ascending: true })

  // Map book data helper
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

  // Hero section config
  const heroConfig = (sectionsMap.get("hero")?.config as any) || {}
  const headline = heroConfig.headline || "Books that shape thought and enrich life."
  const subheadline =
    heroConfig.subheadline ||
    "A calm, intellectual digital sanctuary for discovering valuable eBooks and audiobooks. Instant reading in your browser, permanent personal library, and verified editions."

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F5F2]">
      <Header
        user={user ? { id: user.id, email: user.email, name: user.user_metadata?.full_name } : null}
        isAdmin={isAdmin}
      />

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 border-b border-black/[0.06]">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Left Column: Editorial Headline & Actions */}
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-black/10 text-xs font-semibold text-neutral-800 shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Curated Digital Publishing & Audio Editions</span>
                </div>

                <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[#111111] leading-[1.08]">
                  {headline}
                </h1>

                <p className="text-base sm:text-lg text-neutral-600 leading-relaxed max-w-xl">
                  {subheadline}
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <Link href="/books">
                    <Button size="lg" className="rounded-full h-13 px-8 text-sm font-bold bg-[#111111] shadow-md hover:bg-neutral-800">
                      Browse Full Catalogue
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                  <Link href="/free-books">
                    <Button variant="outline" size="lg" className="rounded-full h-13 px-7 text-sm font-bold">
                      <Gift className="w-4 h-4 mr-2 text-emerald-600" />
                      Free Books Collection
                    </Button>
                  </Link>
                </div>

                {/* Editorial Trust Markers */}
                <div className="pt-6 grid grid-cols-3 gap-2 sm:gap-4 border-t border-black/[0.08] max-w-lg">
                  <div>
                    <div className="font-serif text-lg sm:text-2xl font-bold text-neutral-900">100%</div>
                    <div className="text-[10px] sm:text-xs text-neutral-500 mt-0.5 leading-tight">Ad-Free Reader</div>
                  </div>
                  <div>
                    <div className="font-serif text-lg sm:text-2xl font-bold text-neutral-900">Instant</div>
                    <div className="text-[10px] sm:text-xs text-neutral-500 mt-0.5 leading-tight">Access in Library</div>
                  </div>
                  <div>
                    <div className="font-serif text-lg sm:text-2xl font-bold text-neutral-900">Verified</div>
                    <div className="text-[10px] sm:text-xs text-neutral-500 mt-0.5 leading-tight">Author Royalty</div>
                  </div>
                </div>
              </div>

              {/* Right Column: Visual Highlight Card */}
              <div className="lg:col-span-5 flex justify-center">
                <div className="relative w-full max-w-[380px] rounded-[32px] bg-white border border-black/10 p-5 shadow-[0_24px_50px_rgba(0,0,0,0.06)]">
                  <div className="flex justify-between items-center pb-4 border-b border-black/[0.06]">
                    <span className="text-[11px] font-bold tracking-[0.16em] uppercase text-neutral-400">
                      Editorial Selection
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#E8F5E9] text-[#1B5E20] border border-[#C8E6C9] text-[10px] font-bold">
                      Available Now
                    </span>
                  </div>

                  <div className="my-6 rounded-[24px] bg-[#E8E0D6] p-6 flex flex-col justify-between h-[280px] border border-black/5 relative overflow-hidden">
                    <div>
                      <span className="text-[10px] tracking-[0.18em] uppercase font-bold text-neutral-600">
                        Mindset & Literature
                      </span>
                      <h2 className="font-serif text-3xl font-bold text-neutral-900 mt-2 leading-tight">
                        गोदान & शांत दिमाग
                      </h2>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-700 leading-relaxed">
                        Read timeless classics and self-mastery treatises formatted with modern typography.
                      </p>
                      <div className="mt-4 flex items-center justify-between text-xs font-bold text-neutral-900">
                        <span>Digital PDF + Audio</span>
                        <span className="px-3 py-1 rounded-full bg-white border border-black/10">
                          ₹199
                        </span>
                      </div>
                    </div>
                  </div>

                  <Link href="/books" className="block">
                    <Button variant="secondary" className="w-full rounded-full h-11 text-xs font-bold">
                      Explore All Editions
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BROWSE BY CATEGORY */}
        {categories && categories.length > 0 && (
          <section className="py-16 md:py-20 border-b border-black/[0.06]">
            <div className="max-w-[1360px] mx-auto px-4 sm:px-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                <div>
                  <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-neutral-400 block mb-1">
                    Taxonomy
                  </span>
                  <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#111111]">
                    Browse by Category
                  </h2>
                </div>
                <Link href="/books" className="text-xs font-semibold hover:underline flex items-center gap-1 text-neutral-700">
                  <span>View All Categories</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-4">
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/categories/${cat.slug}`}
                    className="group rounded-[24px] p-5 border border-black/[0.06] hover:border-black/20 transition-all hover:shadow-md flex flex-col justify-between h-[150px]"
                    style={{ backgroundColor: cat.color_code || "#F5F5F5" }}
                  >
                    <div className="w-9 h-9 rounded-full bg-white border border-black/10 flex items-center justify-center text-neutral-900 transition-transform group-hover:scale-110">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-neutral-900 leading-tight">
                        {cat.name}
                      </h3>
                      <p className="text-[11px] text-neutral-500 mt-1 line-clamp-1">
                        Curated collection
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FEATURED EBOOKS */}
        <section className="py-16 md:py-20 border-b border-black/[0.06]">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-neutral-400 block mb-1">
                  Curated Showcase
                </span>
                <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#111111]">
                  Featured eBooks
                </h2>
              </div>
              <Link href="/books?filter=featured" className="text-xs font-semibold hover:underline flex items-center gap-1 text-neutral-700">
                <span>Explore Featured</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {featuredBooks && featuredBooks.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                {featuredBooks.map((book) => (
                  <BookCard key={book.id} book={mapBook(book)} />
                ))}
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-black/15 p-12 text-center bg-white">
                <BookOpen className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-neutral-800">Featured Books Curation Underway</h3>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                  Our editorial desk is preparing the latest featured selection. In the meantime, browse our full catalogue.
                </p>
                <Link href="/books" className="inline-block mt-4">
                  <Button size="sm" variant="outline" className="rounded-full">Browse Catalogue</Button>
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* BESTSELLERS */}
        {bestsellers && bestsellers.length > 0 && (
          <section className="py-16 md:py-20 border-b border-black/[0.06]">
            <div className="max-w-[1360px] mx-auto px-4 sm:px-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                <div>
                  <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-neutral-400 block mb-1">
                    Reader Favorites
                  </span>
                  <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#111111]">
                    Bestselling Editions
                  </h2>
                </div>
                <Link href="/books?sort=popularity" className="text-xs font-semibold hover:underline flex items-center gap-1 text-neutral-700">
                  <span>View All Bestsellers</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                {bestsellers.map((book) => (
                  <BookCard key={book.id} book={mapBook(book)} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FREE BOOKS COLLECTION */}
        <section className="py-16 md:py-20 border-b border-black/[0.06] bg-[#FAFAFA]">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F5E9] text-[#1B5E20] border border-[#C8E6C9] text-[11px] font-bold mb-2">
                  <Gift className="w-3.5 h-3.5" />
                  <span>100% Free • No Subscription Required</span>
                </div>
                <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#111111]">
                  Free Books Collection
                </h2>
              </div>
              <Link href="/free-books" className="text-xs font-semibold hover:underline flex items-center gap-1 text-neutral-700">
                <span>Browse All Free Titles</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {freeBooks && freeBooks.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                {freeBooks.map((book) => (
                  <BookCard key={book.id} book={mapBook(book)} />
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] bg-white border border-black/10 p-8 text-center max-w-lg mx-auto">
                <Gift className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <h3 className="font-bold text-sm text-neutral-900">Complimentary Titles In Review</h3>
                <p className="text-xs text-neutral-500 mt-1">
                  New open-access public domain titles are added weekly.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* WHY HIDDENBOOKS SECTION */}
        <section className="py-16 md:py-24 border-b border-black/[0.06]">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-neutral-400 block mb-1">
                Philosophy
              </span>
              <h2 className="font-serif text-3xl sm:text-5xl font-bold text-[#111111] leading-tight">
                Designed for Readers Who Cherish Depth
              </h2>
              <p className="text-sm sm:text-base text-neutral-600 mt-3 leading-relaxed">
                In an era of noise and fragmented attention, HiddenBooks provides an unhurried, purposeful digital reading atmosphere.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="rounded-[28px] bg-white border border-black/[0.06] p-8 flex flex-col justify-between">
                <div className="w-12 h-12 rounded-full bg-[#E8E0D6] flex items-center justify-center text-neutral-900 mb-6">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-neutral-900">
                    Distraction-Free Reader
                  </h3>
                  <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
                    Read directly inside your browser across mobile, tablet, and desktop with customizable typography, dark mode, chapter navigation, and automatic progress resumption.
                  </p>
                </div>
              </div>

              <div className="rounded-[28px] bg-white border border-black/[0.06] p-8 flex flex-col justify-between">
                <div className="w-12 h-12 rounded-full bg-[#DDE8E2] flex items-center justify-center text-neutral-900 mb-6">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-neutral-900">
                    Permanent Ownership
                  </h3>
                  <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
                    When you purchase a book, it remains in your personal library forever. No recurring monthly subscriptions or disappearing entitlements.
                  </p>
                </div>
              </div>

              <div className="rounded-[28px] bg-white border border-black/[0.06] p-8 flex flex-col justify-between">
                <div className="w-12 h-12 rounded-full bg-[#DBE7FD] flex items-center justify-center text-neutral-900 mb-6">
                  <Headphones className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-neutral-900">
                    Integrated Audiobooks
                  </h3>
                  <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
                    Seamlessly transition between reading and listening. Our audio player includes 15s skipping, speed adjustment (1x–1.5x), and chapter tracking.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* LATEST BLOG POSTS */}
        {blogPosts && blogPosts.length > 0 && (
          <section className="py-16 md:py-20 border-b border-black/[0.06]">
            <div className="max-w-[1360px] mx-auto px-4 sm:px-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                <div>
                  <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-neutral-400 block mb-1">
                    Editorial Desk
                  </span>
                  <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#111111]">
                    Literary Essays & Dispatches
                  </h2>
                </div>
                <Link href="/blog" className="text-xs font-semibold hover:underline flex items-center gap-1 text-neutral-700">
                  <span>Read All Essays</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {blogPosts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/blog/${post.slug}`}
                    className="group rounded-[24px] bg-white border border-black/[0.06] p-5 flex flex-col justify-between hover:shadow-md transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-semibold mb-2">
                        <span>{post.reading_time_minutes || 5} min read</span>
                        <span>•</span>
                        <span>
                          {Array.isArray(post.authors)
                            ? post.authors[0]?.name
                            : (post.authors as any)?.name || "Editorial"}
                        </span>
                      </div>
                      <h3 className="font-serif text-lg font-bold text-neutral-900 group-hover:underline leading-snug">
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className="text-xs text-neutral-600 mt-2 line-clamp-2 leading-relaxed">
                          {post.excerpt}
                        </p>
                      )}
                    </div>
                    <div className="pt-4 mt-4 border-t border-black/[0.04] flex items-center text-xs font-bold text-neutral-900">
                      <span>Read essay</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-1" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FREQUENTLY ASKED QUESTIONS */}
        {faqs && faqs.length > 0 && (
          <section className="py-16 md:py-20 border-b border-black/[0.06]">
            <div className="max-w-[840px] mx-auto px-4 sm:px-6">
              <div className="text-center mb-12">
                <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-neutral-400 block mb-1">
                  Common Inquiries
                </span>
                <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#111111]">
                  Frequently Asked Questions
                </h2>
              </div>

              <div className="space-y-4">
                {faqs.map((faq) => (
                  <div
                    key={faq.id}
                    className="rounded-[20px] bg-white border border-black/[0.06] p-6 shadow-sm"
                  >
                    <h3 className="font-bold text-sm sm:text-base text-neutral-900 flex items-start gap-3">
                      <HelpCircle className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                      <span>{faq.question}</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-600 mt-2 pl-7 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FINAL CALL TO ACTION */}
        <section className="py-20 md:py-28 bg-[#111111] text-white text-center">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-6">
            <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-neutral-400">
              Start Reading Today
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl font-bold leading-tight">
              Expand Your Intellectual Horizons
            </h2>
            <p className="text-sm sm:text-base text-neutral-400 max-w-lg mx-auto">
              Discover profound Hindi literature, thoughtful novels, and self-help guidebooks with verified translations.
            </p>
            <div className="pt-2 flex flex-wrap justify-center gap-3">
              <Link href="/books">
                <Button size="lg" className="rounded-full bg-white text-black hover:bg-neutral-100 font-bold px-8">
                  Browse Catalogue
                </Button>
              </Link>
              <Link href="/free-books">
                <Button variant="outline" size="lg" className="rounded-full border-white/20 text-white hover:bg-white/10 font-bold px-7">
                  Explore Free Titles
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  )
}
