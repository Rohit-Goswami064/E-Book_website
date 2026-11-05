"use client"

import * as React from "react"
import { Plus, Minus } from "lucide-react"

export interface FAQItem {
  id?: string
  question: string
  answer: string
  is_published?: boolean
  display_order?: number
}

interface FaqSectionProps {
  faqs?: FAQItem[] | null
  className?: string
  title?: string
  subtitle?: string
}

const defaultFaqs: FAQItem[] = [
  {
    id: "faq-1",
    question: "What can I read in HiddenBooks?",
    answer:
      "HiddenBooks offers a meticulously curated digital library featuring rare literary classics, prominent Hindi novels and treatises, timeless philosophical texts, and distraction-free audiobooks. Every edition is verified for typographical precision and comfortable reading across devices.",
  },
  {
    id: "faq-2",
    question: "Can I continue reading on another device?",
    answer:
      "Yes. Your active reading location, bookmarks, highlights, and purchased titles automatically sync to your secure account in real time. Switch effortlessly from your desktop monitor to your tablet or mobile phone without losing your place.",
  },
  {
    id: "faq-3",
    question: "Can I import content from other apps or services?",
    answer:
      "HiddenBooks provides an in-browser streaming reader engineered specifically for our curated catalogue with built-in DRM and authorized access verification. You can also access downloadable PDF formats for offline reading where permitted by editorial licenses.",
  },
  {
    id: "faq-4",
    question: "Do I need an account to use HiddenBooks?",
    answer:
      "You are free to explore our full catalogue, read editorial essays, and view sample chapters without signing in. To acquire books, save progress across devices, or access your permanent library, a simple free reader account is required.",
  },
  {
    id: "faq-5",
    question: "Is HiddenBooks available on mobile and desktop?",
    answer:
      "Yes. HiddenBooks is fully responsive and optimized for mobile phones (iOS & Android browsers), tablets, and desktop web browsers. It requires no heavy third-party app installations—simply open the site and start reading.",
  },
  {
    id: "faq-6",
    question: "Is HiddenBooks free? What's included in the free plan?",
    answer:
      "HiddenBooks maintains a dedicated 100% Free Books collection with complete classic literature and literary essays available to everyone. Curated modern editions can be purchased individually with transparent one-time pricing and no recurring subscriptions.",
  },
]

export function FaqSection({
  faqs,
  className = "",
  title = "Do you still have questions?",
  subtitle = "Here are a few things people usually ask before getting started.",
}: FaqSectionProps) {
  // Use DB faqs if present, otherwise fallback to standard default FAQs
  const faqList = faqs && faqs.length > 0 ? faqs : defaultFaqs
  const [openIndex, setOpenIndex] = React.useState<number | null>(null)

  const toggleItem = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index))
  }

  return (
    <section className={`w-full bg-[#F4F7FB] border-y border-slate-200/80 py-20 sm:py-24 md:py-28 ${className}`}>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12">
        {/* Top Header Row with Asymmetric Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 mb-12 sm:mb-16 md:mb-20 items-start">
          <div className="md:col-span-4 lg:col-span-3">
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal max-w-[220px]">
              {subtitle}
            </p>
          </div>
          <div className="md:col-span-8 lg:col-span-9">
            <h2 className="text-3xl sm:text-4xl md:text-[46px] font-medium tracking-tight text-slate-900 leading-[1.15]">
              {title}
            </h2>
          </div>
        </div>

        {/* Clean Accordion List */}
        <div className="border-t border-slate-200/80">
          {faqList.map((faq, index) => {
            const isOpen = openIndex === index
            const numStr = String(index + 1).padStart(2, "0")

            return (
              <div
                key={faq.id || index}
                className="border-b border-slate-200/80 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleItem(index)}
                  className="w-full py-5 sm:py-6 md:py-7 flex items-start sm:items-center justify-between text-left group cursor-pointer focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-start sm:items-center gap-5 sm:gap-10 md:gap-16 flex-1 pr-4">
                    {/* Numbering: 01, 02, etc. */}
                    <span className="text-sm sm:text-base font-semibold text-slate-900 shrink-0 w-8 sm:w-10 pt-0.5 sm:pt-0">
                      {numStr}
                    </span>

                    {/* Question Headline */}
                    <span className="text-base sm:text-lg md:text-[18px] font-bold text-slate-900 group-hover:text-slate-950 transition-colors leading-snug">
                      {faq.question}
                    </span>
                  </div>

                  {/* Toggle Indicator: Plus / Minus */}
                  <div className="shrink-0 flex items-center justify-center w-6 h-6 text-slate-400 group-hover:text-slate-800 transition-colors ml-3">
                    {isOpen ? (
                      <Minus className="w-4 h-4 sm:w-5 sm:h-5 stroke-[1.5]" />
                    ) : (
                      <Plus className="w-4 h-4 sm:w-5 sm:h-5 stroke-[1.5]" />
                    )}
                  </div>
                </button>

                {/* Smooth Expandable Answer Body */}
                {isOpen && (
                  <div className="pb-6 sm:pb-7 pl-13 sm:pl-20 md:pl-26 pr-4 sm:pr-12 text-sm sm:text-[15px] text-slate-600 leading-relaxed max-w-3xl transition-all">
                    {faq.answer}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

