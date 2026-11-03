import Link from "next/link"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import { formatDate } from "@/lib/utils"
import { Clock, ChevronRight, Calendar, ArrowLeft } from "lucide-react"
import type { Metadata } from "next"

interface BlogPostProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: BlogPostProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, excerpt, seo_title, seo_description, canonical_url, cover_image_url, featured_image, og_image_url")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle()

  if (!post) return { title: "Post Not Found" }

  const effectiveImage = (post as any)?.og_image_url || (post as any)?.featured_image || post.cover_image_url

  return {
    title: post.seo_title || post.title,
    description: post.seo_description || post.excerpt,
    alternates: {
      canonical: post.canonical_url || `/blog/${slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.excerpt || "",
      images: effectiveImage ? [effectiveImage] : [],
      type: "article",
    },
  }
}

export default async function BlogPostPage({ params }: BlogPostProps) {
  const { slug } = await params
  const user = await getCurrentUser()
  const isAdmin = await isCurrentUserAdmin()
  const supabase = await createClient()

  const { data: post } = await supabase
    .from("blog_posts")
    .select(`
      *,
      authors(name, slug, bio, avatar_url),
      blog_post_categories(blog_categories(name, slug)),
      blog_post_tags(blog_tags(name, slug))
    `)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle()

  if (!post) {
    notFound()
  }

  // Increment view count safely via security definer RPC
  try {
    await supabase.rpc("increment_blog_post_view_count", { post_id: post.id })
  } catch {
    // Non-fatal telemetry ignore
  }

  const author = post.authors as any
  const categories = (post.blog_post_categories as any[])?.map((c: any) => c.blog_categories).filter(Boolean) || []
  const tags = (post.blog_post_tags as any[])?.map((t: any) => t.blog_tags).filter(Boolean) || []
  const displayImage = (post as any)?.featured_image || post.cover_image_url

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    image: displayImage ? [displayImage] : [],
    datePublished: post.published_at,
    author: {
      "@type": "Person",
      name: author?.name || "HiddenBooks Editorial",
    },
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F5F2]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Scoped Custom CSS if article has specific styles */}
      {(post as any)?.custom_css && (
        <style dangerouslySetInnerHTML={{ __html: (post as any).custom_css }} />
      )}

      <Header
        user={user ? { id: user.id, email: user.email, name: user.user_metadata?.full_name } : null}
        isAdmin={isAdmin}
      />

      <main className="flex-1 max-w-[840px] w-full mx-auto px-4 sm:px-6 py-8 md:py-14">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-neutral-500 mb-8">
          <Link href="/" className="hover:text-black">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/blog" className="hover:text-black">Blog</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-neutral-900 font-semibold truncate max-w-xs">{post.title}</span>
        </nav>

        <article className="space-y-8">
          {/* Article Header */}
          <header className="space-y-4">
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {categories.map((cat: any) => (
                  <span
                    key={cat.slug}
                    className="text-[11px] font-mono uppercase tracking-wider font-semibold bg-[#E8E0D6] text-neutral-900 px-2.5 py-0.5 rounded-full"
                  >
                    {cat.name}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 text-xs text-neutral-500 font-medium">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {post.reading_time_minutes || 5} min read
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {formatDate(post.published_at || post.created_at)}
              </span>
            </div>

            <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-[#111111] leading-[1.15]">
              {post.title}
            </h1>

            {post.excerpt && (
              <p className="font-serif text-lg sm:text-xl text-neutral-600 leading-relaxed italic border-l-2 border-black/20 pl-4 py-1">
                {post.excerpt}
              </p>
            )}

            {/* Author Byline */}
            {author && (
              <div className="flex items-center gap-3 pt-4 border-t border-black/[0.06]">
                <div className="w-10 h-10 rounded-full bg-[#111111] text-white flex items-center justify-center font-serif font-bold text-sm overflow-hidden">
                  {author.avatar_url ? (
                    <img src={author.avatar_url} alt={author.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    author.name.charAt(0)
                  )}
                </div>
                <div>
                  <Link href={`/authors/${author.slug}`} className="font-bold text-sm text-neutral-900 hover:underline">
                    {author.name}
                  </Link>
                  <p className="text-[11px] text-neutral-500">Author & Editorial Contributor</p>
                </div>
              </div>
            )}
          </header>

          {/* Featured Image */}
          {displayImage && (
            <div className="w-full rounded-[28px] overflow-hidden bg-[#E8E0D6] shadow-sm">
              <img src={displayImage} alt={post.title} className="w-full h-auto object-cover max-h-[480px]" />
            </div>
          )}

          {/* Main Article Content */}
          <div className="rounded-[28px] bg-white border border-black/[0.06] p-8 sm:p-12 shadow-sm text-neutral-800 leading-[1.8] text-base sm:text-lg">
            <div
              className="editorial-article-body prose prose-neutral max-w-none space-y-6"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="pt-2 flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-neutral-400 font-mono">Tags:</span>
              {tags.map((t: any) => (
                <span
                  key={t.slug}
                  className="text-[11px] font-mono bg-neutral-200/60 text-neutral-700 px-2 py-0.5 rounded-full"
                >
                  #{t.name}
                </span>
              ))}
            </div>
          )}

          {/* Back to Essays CTA */}
          <div className="pt-6 border-t border-black/[0.08] flex items-center justify-between">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-xs font-bold text-neutral-900 hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Editorial Dispatches</span>
            </Link>
          </div>
        </article>
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  )
}
