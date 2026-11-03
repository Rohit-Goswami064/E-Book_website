"use client"

import * as React from "react"
import Link from "next/link"
import { Send, ShieldCheck, MessageCircle, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

export function Footer() {
  const [email, setEmail] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Subscribed successfully!")
        setEmail("")
      } else {
        toast.error(data.error || "Failed to subscribe")
      }
    } catch {
      toast.error("An unexpected error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <footer className="w-full bg-[#EFEFEA] border-t border-black/[0.08] text-neutral-800 pt-16 pb-24 lg:pb-16 mt-auto">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 pb-12 border-b border-black/[0.08]">
          {/* Brand & Editorial Mission */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#111111] text-white flex items-center justify-center font-serif text-lg font-bold">
                H
              </div>
              <span className="font-serif text-2xl font-bold tracking-tight text-[#111111]">
                HiddenBooks
              </span>
            </Link>
            <p className="text-sm text-neutral-600 leading-relaxed max-w-sm">
              A premium digital destination for discovering, purchasing, and reading valuable books. Unhurried typography, verified translations, and distraction-free digital reading.
            </p>
            <div className="pt-2 flex items-center gap-3">
              <a
                href="https://wa.me/917383138396"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-black/10 text-xs font-bold text-neutral-900 hover:bg-neutral-50 transition shadow-sm"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>WhatsApp Reader Desk</span>
              </a>
            </div>
          </div>

          {/* Catalogue Links */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">
              Discover
            </h4>
            <ul className="space-y-2 text-xs font-medium text-neutral-600">
              <li>
                <Link href="/books" className="hover:text-black transition">
                  All Publications
                </Link>
              </li>
              <li>
                <Link href="/free-books" className="hover:text-black transition flex items-center gap-1.5">
                  <span>Free Books</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#E8F5E9] text-[#1B5E20] font-bold">
                    100% Free
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/categories/audiobooks" className="hover:text-black transition">
                  Audiobooks Edition
                </Link>
              </li>
              <li>
                <Link href="/categories/hindi-books" className="hover:text-black transition">
                  Hindi Classics & Novels
                </Link>
              </li>
              <li>
                <Link href="/categories/self-help" className="hover:text-black transition">
                  Self-Help & Mindset
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-black transition">
                  Editorial Essays & Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Reader & Support */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">
              Reader Desk
            </h4>
            <ul className="space-y-2 text-xs font-medium text-neutral-600">
              <li>
                <Link href="/account/library" className="hover:text-black transition">
                  My Library
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-black transition">
                  Help & FAQs
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-black transition">
                  About Our Publishing
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-black transition">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter Subscribe */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">
              Reader Dispatch
            </h4>
            <p className="text-xs text-neutral-600 leading-normal">
              Weekly reading recommendations, author commentaries, and exclusive editions.
            </p>
            <form onSubmit={handleSubscribe} className="space-y-2 pt-1">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="reader@example.com"
                required
                className="h-10 text-xs bg-white border-black/10 rounded-full"
              />
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 text-xs rounded-full bg-[#111111] font-bold"
              >
                {isSubmitting ? "Subscribing..." : "Subscribe"}
                <Send className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </form>
          </div>
        </div>

        {/* Bottom Bar: Legal, Security, Copyright */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-[11px]">
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
            <span>•</span>
            <Link href="/terms" className="hover:underline">Terms of Service</Link>
            <span>•</span>
            <Link href="/refund-policy" className="hover:underline">Refund Policy</Link>
            <span>•</span>
            <Link href="/contact" className="hover:underline">Author Licensing</Link>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>256-Bit Encrypted Payments via Razorpay</span>
          </div>

          <div className="text-[11px] text-neutral-400">
            © {new Date().getFullYear()} HiddenBooks. Built with care for readers.
          </div>
        </div>
      </div>
    </footer>
  )
}
