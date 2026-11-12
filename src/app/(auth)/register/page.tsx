import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, ShieldCheck } from "lucide-react"
import { SignupForm } from "@/components/signup-form"

export default function RegisterPage() {
  return (
    <div className="min-h-[100dvh] bg-[#F6F5F2] flex flex-col justify-between overflow-x-hidden selection:bg-neutral-900 selection:text-white">
      {/* Top Header with Mobile Safe Area Inset */}
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-[calc(env(safe-area-inset-top,0px)+1rem)] sm:pt-6 pb-2 sm:pb-4 flex items-center justify-between">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 py-2 px-3 -ml-3 rounded-full text-sm font-medium text-neutral-800 hover:text-neutral-950 hover:bg-black/[0.04] active:bg-black/[0.08] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
          aria-label="Back to Bookstore"
        >
          <div className="w-7 h-7 rounded-full bg-white border border-neutral-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center justify-center group-hover:border-neutral-300 group-hover:shadow transition-all shrink-0">
            <ArrowLeft className="w-4 h-4 text-neutral-700 group-hover:text-neutral-950 group-hover:-translate-x-0.5 transition-transform" />
          </div>
          <span className="text-neutral-700 group-hover:text-neutral-950 font-medium">Back to Bookstore</span>
        </Link>
      </header>

      {/* Main Register Experience */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-6 sm:py-10">
        <div className="w-full max-w-[420px] flex flex-col gap-6 sm:gap-7">
          {/* HiddenBooks Branding */}
          <Link
            href="/"
            className="flex items-center gap-2.5 self-center group transition-transform active:scale-[0.98]"
            aria-label="HiddenBooks Home"
          >
            <div className="size-9 rounded-xl overflow-hidden shadow-sm relative bg-white border border-neutral-200/80 shrink-0">
              <Image
                src="/hiddenbook_logo.png"
                alt="HiddenBooks Logo"
                width={36}
                height={36}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <span className="font-serif text-2xl font-bold tracking-tight text-neutral-900">
              Hidden<span className="italic font-normal">Books</span>
            </span>
          </Link>

          {/* Signup Form */}
          <React.Suspense
            fallback={
              <div className="w-full bg-white rounded-2xl border border-neutral-200/80 shadow-sm p-8 text-center text-xs text-neutral-500">
                Loading sign-up...
              </div>
            }
          >
            <SignupForm />
          </React.Suspense>
        </div>
      </main>

      {/* Responsive Footer with Bottom Safe Area */}
      <footer className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] text-center text-xs text-neutral-500">
        <p className="flex items-center justify-center gap-1.5 flex-wrap">
          <ShieldCheck className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <span>Protected by 256-bit SSL encryption. HiddenBooks © 2026</span>
        </p>
      </footer>
    </div>
  )
}
