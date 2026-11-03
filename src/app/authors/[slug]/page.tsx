import Link from "next/link"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { BookCard } from "@/components/books/book-card"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import { ChevronRight, Globe, Share2, AtSign, BookOpen } from "lucide-react"
import type { Metadata } from "next"

interface AuthorPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: AuthorPageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: author } = await supabase
    .from("authors")
    .select("name, bio")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle()

  if (!author) return { title: "Author Not Found" }

  return {
    title: `${author.name} — Author Biography & Books`,
    description: author.bio || `Read publications by ${author.name} on HiddenBooks.`,
    alternates: {
      canonical: `/authors/${slug}`,
    },
  }
}

export default async function AuthorDetailPage({ params }: AuthorPageProps) {
  const { slug } = await params
  const user = await getCurrentUser()
  const isAdmin = await isCurrentUserAdmin()
  const supabase = await createClient()

  const { data: author } = await supabase
    .from("authors")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle()

  if (!author) {
    notFound()
  }

  // Fetch published books by this author
  const { data: books } = await supabase
    .from("books")
    .select("id, title, slug, subtitle, price_cents, original_price_cents, currency, is_free, format, cover_image_url, audio_duration")
    .eq("author_id", author.id)
    .eq("is_published", true)
    .order("created_at", { ascending: false })

  const mapBook = (b: any) => ({
    id: b.id,
    title: b.title,
    slug: b.slug,
    subtitle: b.subtitle,
    authorName: author.name,
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
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-neutral-500 mb-8">
          <Link href="/" className="hover:text-black">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/books" className="hover:text-black">Authors</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-neutral-900 font-semibold">{author.name}</span>
        </nav>

        {/* Author Profile Header */}
        <div className="rounded-[32px] bg-white border border-black/[0.06] p-8 md:p-12 mb-12 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-[#111111] text-white flex items-center justify-center font-serif text-3xl sm:text-4xl font-bold shrink-0 shadow-md">
              {author.avatar_url ? (
                <img src={author.avatar_url} alt={author.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                author.name.charAt(0)
              )}
            </div>

            <div className="space-y-3">
              <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-neutral-400 block">
                Featured Author
              </span>
              <h1 className="font-serif text-3xl sm:text-5xl font-bold text-neutral-900 leading-tight">
                {author.name}
              </h1>
              {author.bio && (
                <p className="text-sm sm:text-base text-neutral-600 leading-relaxed max-w-2xl">
                  {author.bio}
                </p>
              )}

              {/* Social Links */}
              <div className="pt-2 flex items-center gap-3">
                {author.website_url && (
                  <a
                    href={author.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full border border-black/10 hover:bg-neutral-100 text-neutral-700 transition"
                    title="Website"
                  >
                    <Globe className="w-4 h-4" />
                  </a>
                )}
                {author.twitter_handle && (
                  <a
                    href={`https://twitter.com/${author.twitter_handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full border border-black/10 hover:bg-neutral-100 text-neutral-700 transition"
                    title={`@${author.twitter_handle}`}
                  >
                    <AtSign className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Author Works Grid */}
        <div className="space-y-6">
          <div className="border-b border-black/[0.06] pb-4">
            <h2 className="font-serif text-2xl font-bold text-neutral-900">
              Publications by {author.name}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {books?.length || 0} works published
            </p>
          </div>

          {books && books.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {books.map((book) => (
                <BookCard key={book.id} book={mapBook(book)} />
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] bg-white border border-black/10 p-12 text-center max-w-md mx-auto">
              <BookOpen className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <h3 className="font-serif text-xl font-bold text-neutral-800">
                No Publications Currently Available
              </h3>
              <p className="text-xs text-neutral-500 mt-2">
                Works by this author are in preparation.
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  )
}
