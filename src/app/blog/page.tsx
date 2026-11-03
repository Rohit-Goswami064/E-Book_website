import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import { formatDate } from "@/lib/utils"
import { ArrowRight, BookOpen, Clock, ChevronRight } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "The Editorial Desk — Literary Essays & Author Dispatches",
  description:
    "Profound commentary on classic literature, translation philosophies, reading rituals, and author insights.",
}

export default async function BlogIndexPage() {
  const user = await getCurrentUser()
  const isAdmin = await isCurrentUserAdmin()
  const supabase = await createClient()

  // Fetch published blog posts
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("id, title, slug, excerpt, reading_time_minutes, published_at, cover_image_url, authors(name, slug)")
    .eq("status", "published")
    .order("published_at", { ascending: false })

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F5F2]">
      <Header
        user={user ? { id: user.id, email: user.email, name: user.user_metadata?.full_name } : null}
        isAdmin={isAdmin}
      />

      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 py-8 md:py-14">
        {/* Editorial Desk Banner */}
        <div className="border-b border-black/[0.06] pb-8 mb-12">
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-neutral-400 block mb-2">
            The HiddenBooks Dispatch
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold text-[#111111]">
            From the Editorial Desk
          </h1>
          <p className="text-sm sm:text-base text-neutral-600 mt-3 max-w-2xl leading-relaxed">
            Thoughtful essays, reading reflections, translation analyses, and critical commentaries on literary masterworks.
          </p>
        </div>

        {/* Blog Posts Grid */}
        {posts && posts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <article
                key={post.id}
                className="group rounded-[28px] bg-white border border-black/[0.06] p-6 flex flex-col justify-between hover:shadow-lg transition-all duration-300"
              >
                <div>
                  {post.cover_image_url && (
                    <div className="w-full h-48 rounded-[20px] overflow-hidden mb-5 bg-[#E8E0D6]">
                      <img
                        src={post.cover_image_url}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-semibold mb-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {post.reading_time_minutes || 5} min read
                    </span>
                    <span>•</span>
                    <span>{formatDate(post.published_at)}</span>
                  </div>

                  <Link href={`/blog/${post.slug}`}>
                    <h2 className="font-serif text-xl font-bold text-neutral-900 group-hover:underline leading-snug">
                      {post.title}
                    </h2>
                  </Link>

                  {post.excerpt && (
                    <p className="text-xs sm:text-sm text-neutral-600 mt-3 line-clamp-3 leading-relaxed">
                      {post.excerpt}
                    </p>
                  )}
                </div>

                <div className="pt-6 mt-6 border-t border-black/[0.04] flex items-center justify-between text-xs">
                  <span className="text-neutral-500 font-medium">
                    By {(post.authors as any)?.name || "Editorial Desk"}
                  </span>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="font-bold text-neutral-900 flex items-center gap-1 hover:underline"
                  >
                    <span>Read essay</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-[28px] bg-white border border-black/10 p-12 text-center max-w-md mx-auto">
            <BookOpen className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <h3 className="font-serif text-xl font-bold text-neutral-800">
              Essays in Preparation
            </h3>
            <p className="text-xs text-neutral-500 mt-2">
              Our authors and editors are composing essays for upcoming publication.
            </p>
          </div>
        )}
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  )
}
