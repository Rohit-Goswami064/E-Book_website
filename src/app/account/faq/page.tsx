import { createClient } from "@/lib/supabase/server"
import { FaqSection } from "@/components/home/faq-section"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Reader Help Desk & FAQs — HiddenBooks",
  description: "Find instant answers to reading formats, reader synchronization, and account billing.",
}

export const dynamic = "force-dynamic"

export default async function AccountFaqPage() {
  const supabase = await createClient()

  const { data: faqs } = await supabase
    .from("faqs")
    .select("*")
    .eq("is_published", true)
    .order("display_order", { ascending: true })

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="border-b border-neutral-200/80 pb-3.5">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
          Help Desk & FAQs
        </h1>
        <p className="text-xs text-neutral-500 mt-0.5">
          Everything you need to know about reading digital publications and managing your purchases.
        </p>
      </div>

      <div className="rounded-xl overflow-hidden border border-neutral-200/80 shadow-2xs">
        <FaqSection
          faqs={faqs}
          className="py-12 sm:py-16 bg-white border-none"
          title="Frequently Asked Questions"
          subtitle="Need help? Here are the most common reader inquiries."
        />
      </div>
    </div>
  )
}

