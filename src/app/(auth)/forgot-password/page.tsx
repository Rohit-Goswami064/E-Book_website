"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Mail } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let targetEmail = email.trim()
      const cleanDigits = targetEmail.replace(/[^0-9]/g, "")
      const isMobile = !targetEmail.includes("@") && cleanDigits.length >= 10

      if (isMobile) {
        try {
          const resolveRes = await fetch("/api/auth/resolve-identifier", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: cleanDigits }),
          })
          const resolveData = await resolveRes.json()
          if (!resolveRes.ok || !resolveData.email) {
            toast.error(resolveData.error || "No account found matching this mobile number.")
            setLoading(false)
            return
          }
          targetEmail = resolveData.email
        } catch {
          toast.error("Failed to verify mobile number.")
          setLoading(false)
          return
        }
      }

      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        toast.error(error.message || "Failed to send reset link.")
        setLoading(false)
        return
      }

      setSubmitted(true)
      toast.success("Password reset instructions have been dispatched to your email.")
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#F6F5F2] flex flex-col justify-between overflow-x-hidden selection:bg-neutral-900 selection:text-white">
      {/* Top Header with Mobile Safe Area Inset */}
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-[calc(env(safe-area-inset-top,0px)+1rem)] sm:pt-6 pb-2 sm:pb-4 flex items-center justify-between">
        <Link
          href="/login"
          className="group inline-flex items-center gap-2 py-2 px-3 -ml-3 rounded-full text-sm font-medium text-neutral-800 hover:text-neutral-950 hover:bg-black/[0.04] active:bg-black/[0.08] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
          aria-label="Back to Sign In"
        >
          <div className="w-7 h-7 rounded-full bg-white border border-neutral-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center justify-center group-hover:border-neutral-300 group-hover:shadow transition-all shrink-0">
            <ArrowLeft className="w-4 h-4 text-neutral-700 group-hover:text-neutral-950 group-hover:-translate-x-0.5 transition-transform" />
          </div>
          <span className="text-neutral-700 group-hover:text-neutral-950 font-medium">Back to Sign In</span>
        </Link>
      </header>

      {/* Main Experience */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-6 sm:py-10">
        <div className="w-full max-w-[420px] flex flex-col gap-6">
          <div className="text-center sm:text-left space-y-1.5 px-1">
            <h2 className="font-serif text-3xl font-bold tracking-tight text-neutral-900">
              Reset Your Password
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
              Enter your registered mobile number or email address to receive password setup instructions.
            </p>
          </div>

          <div className="bg-white py-7 px-6 sm:px-8 rounded-2xl border border-neutral-200/80 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06),0_2px_6px_-2px_rgba(0,0,0,0.04)]">
            {submitted ? (
              <div className="text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <Mail className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-sm text-neutral-900">Check Your Email</h3>
                <p className="text-xs text-neutral-600">
                  We have sent a secure password reset link to <span className="font-bold text-neutral-800">{email}</span>.
                </p>
                <Link href="/login" className="inline-block pt-2">
                  <Button variant="outline" size="sm" className="rounded-xl">
                    Return to Sign In
                  </Button>
                </Link>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleReset}>
                <div className="grid gap-2">
                  <label htmlFor="reset-id" className="text-xs sm:text-sm font-medium text-neutral-800">
                    Email or Mobile Number
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <Input
                      id="reset-id"
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="Mobile (e.g. 9876543210) or Email"
                      className="rounded-xl pl-10 h-11 border-neutral-200 bg-neutral-50/50 hover:bg-white focus:bg-white text-base sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-neutral-900 focus-visible:border-neutral-900 transition-all shadow-none"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl bg-neutral-900 hover:bg-black text-white font-medium text-sm transition-all shadow-sm active:scale-[0.99] disabled:opacity-70 disabled:pointer-events-none mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending link...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] text-center text-xs text-neutral-500">
        Protected by 256-bit SSL encryption. HiddenBooks © 2026
      </footer>
    </div>
  )
}
