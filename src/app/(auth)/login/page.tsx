import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft } from "lucide-react"
import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-muted/40 flex flex-col justify-between p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-sm mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to bookstore</span>
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-6">
        <div className="w-full max-w-sm flex flex-col gap-6">
          <Link href="/" className="flex items-center gap-2.5 self-center font-medium">
            <div className="size-8 rounded-lg overflow-hidden shadow-sm relative bg-white border border-border shrink-0">
              <Image
                src="/hiddenbook_logo.png"
                alt="HiddenBooks Logo"
                width={32}
                height={32}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <span className="font-serif text-xl font-bold tracking-tight text-foreground">
              Hidden<span className="italic font-normal">Books</span>
            </span>
          </Link>

          <React.Suspense fallback={<div className="text-center text-xs text-muted-foreground py-8">Loading sign-in...</div>}>
            <LoginForm />
          </React.Suspense>
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground py-4">
        Protected by 256-bit SSL encryption. HiddenBooks © {new Date().getFullYear()}
      </div>
    </div>
  )
}
