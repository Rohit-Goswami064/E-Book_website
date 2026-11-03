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
    <div className="min-h-screen bg-[#F6F5F2] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-black mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Sign In</span>
        </Link>

        <h2 className="font-serif text-3xl font-bold tracking-tight text-[#111111]">
          Reset Your Password
        </h2>
        <p className="mt-2 text-xs text-neutral-600">
          Enter your registered mobile number or email address to receive password setup instructions.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-[28px] border border-black/[0.06] shadow-sm">
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
                <Button variant="outline" size="sm" className="rounded-full">
                  Return to Sign In
                </Button>
              </Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleReset}>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                  Email or Mobile Number
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <Input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="Mobile (e.g. 9876543210) or Email"
                    className="pl-10 h-11 text-xs bg-[#FAFAFA]"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-full bg-[#111111] text-xs font-bold shadow-md hover:bg-neutral-800"
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
    </div>
  )
}
