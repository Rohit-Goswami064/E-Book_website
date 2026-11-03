import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import { ChevronRight, HelpCircle } from "lucide-react"
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
    <div className="min-h-screen flex flex-col bg-[#F6F5F2]">
      <Header
        user={user ? { id: user.id, email: user.email, name: user.user_metadata?.full_name } : null}
        isAdmin={isAdmin}
      />

      <main className="flex-1 max-w-[880px] w-full mx-auto px-4 sm:px-6 py-8 md:py-16">
        <nav className="flex items-center gap-2 text-xs text-neutral-500 mb-8">
          <Link href="/" className="hover:text-black">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-neutral-900 font-semibold">Help & FAQs</span>
        </nav>

        <div className="rounded-[32px] bg-white border border-black/[0.06] p-8 sm:p-14 shadow-sm space-y-8">
          <div>
            <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-neutral-400 block mb-2">
              Reader Assistance
            </span>
            <h1 className="font-serif text-3xl sm:text-5xl font-bold text-[#111111]">
              Frequently Asked Questions
            </h1>
            <p className="text-sm sm:text-base text-neutral-600 mt-3 leading-relaxed">
              Find immediate answers regarding digital file formats, reading synchronization, and payment processing.
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-black/[0.06]">
            {faqs && faqs.length > 0 ? (
              faqs.map((faq) => (
                <div
                  key={faq.id}
                  className="rounded-[20px] bg-[#FAFAFA] border border-black/[0.04] p-6 space-y-2"
                >
                  <h3 className="font-bold text-sm sm:text-base text-neutral-900 flex items-start gap-3">
                    <HelpCircle className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                    <span>{faq.question}</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-600 pl-7 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-xs text-neutral-500 italic">No FAQs currently published.</p>
            )}
          </div>
        </div>
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  )
}
