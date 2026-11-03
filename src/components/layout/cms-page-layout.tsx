import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import { ChevronRight } from "lucide-react"

interface CMSPageLayoutProps {
  slug: string
  fallbackTitle: string
  fallbackContent: string
}

export async function CMSPageLayout({
  slug,
  fallbackTitle,
  fallbackContent,
}: CMSPageLayoutProps) {
  const user = await getCurrentUser()
  const isAdmin = await isCurrentUserAdmin()
  const supabase = await createClient()

  const { data: page } = await supabase
    .from("pages")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle()

  const typedPage = page as { title?: string; content?: string } | null
  const title = typedPage?.title || fallbackTitle
  const content = typedPage?.content || fallbackContent

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F5F2]">
      <Header
        user={user ? { id: user.id, email: user.email, name: user.user_metadata?.full_name } : null}
        isAdmin={isAdmin}
      />

      <main className="flex-1 max-w-[880px] w-full mx-auto px-4 sm:px-6 py-8 md:py-16">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-neutral-500 mb-8">
          <Link href="/" className="hover:text-black">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-neutral-900 font-semibold">{title}</span>
        </nav>

        <article className="rounded-[32px] bg-white border border-black/[0.06] p-8 sm:p-14 shadow-sm space-y-6">
          <h1 className="font-serif text-3xl sm:text-5xl font-bold text-[#111111] leading-tight border-b border-black/[0.06] pb-6">
            {title}
          </h1>

          <div
            className="prose prose-neutral max-w-none text-sm sm:text-base leading-relaxed text-neutral-700 space-y-4"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </article>
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  )
}
