import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import { ChevronRight } from "lucide-react"
import { FaqSection } from "@/components/home/faq-section"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Frequently Asked Questions — Reader Help Desk",
  description: "Common questions regarding formats, downloads, in-browser reader compatibility, and payments.",
}

export const dynamic = "force-dynamic"

export default async function FAQPage() {
  const user = await getCurrentUser()
  const isAdmin = await isCurrentUserAdmin()
  const supabase = await createClient()

  const { data: faqs } = await supabase
    .from("faqs")
    .select("*")
    .eq("is_published", true)
    .order("display_order", { ascending: true })

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F7FB]">
      <Header
        user={user ? { id: user.id, email: user.email, name: user.user_metadata?.full_name } : null}
        isAdmin={isAdmin}
      />

      <main className="flex-1 w-full">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12 pt-8">
          <nav className="flex items-center gap-2 text-xs text-neutral-500">
            <Link href="/" className="hover:text-black">Home</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-neutral-900 font-semibold">Help & FAQs</span>
          </nav>
        </div>

        <FaqSection
          faqs={faqs}
          className="border-t-0"
          title="Do you still have questions?"
          subtitle="Here are a few things people usually ask before getting started."
        />
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  )
}
