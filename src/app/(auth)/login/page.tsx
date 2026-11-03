"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Lock, Mail } from "lucide-react"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") || "/account"
  const initialIdentifier =
    searchParams.get("identifier") ||
    searchParams.get("phone") ||
    searchParams.get("email") ||
    ""

  const [email, setEmail] = React.useState(initialIdentifier)
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const handleLogin = async (e: React.FormEvent) => {
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      })

      if (error) {
        console.error("[Login Auth Error]:", error.message)
        if (
          error.message.toLowerCase().includes("invalid login credentials") ||
          error.message.toLowerCase().includes("invalid grant")
        ) {
          toast.error("Invalid email/mobile number or password. Please verify your credentials.")
        } else if (error.message.toLowerCase().includes("email not confirmed")) {
          toast.error("Account email is not verified. Please check your inbox.")
        } else {
          toast.error("Unable to sign in. Please verify your credentials or reset your password.")
        }
        setLoading(false)
        return
      }

      if (data.session || data.user) {
        toast.success("Welcome back to HiddenBooks.")
        window.location.href = redirect
        return
      }

      toast.error("Unable to establish session. Please verify your credentials.")
      setLoading(false)
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred.")
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-[420px]">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <Link href="/" className="inline-block mb-3">
          <span className="font-serif text-2xl font-bold tracking-tight text-neutral-900">
            Hidden<span className="italic font-normal">Books</span>
          </span>
        </Link>
        <h1 className="font-serif text-3xl font-bold text-neutral-900 mb-2">
          Reader Sign In
        </h1>
        <p className="text-xs text-neutral-500">
          Access your digital library, saved progress, and purchased titles.
        </p>
      </div>

      {/* Login Card */}
      <div className="rounded-[24px] bg-white border border-black/[0.08] p-5 sm:p-7 md:p-8 shadow-sm">
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
              Email or Mobile Number
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                required
                placeholder="Mobile (e.g. 9876543210) or Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-11 rounded-full bg-[#FAFAFA] border-black/10 text-sm sm:text-xs text-neutral-900"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-[11px] text-neutral-500 hover:text-black hover:underline"
              >
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-11 rounded-full bg-[#FAFAFA] border-black/10 text-sm sm:text-xs text-neutral-900"
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
                Authenticating...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-black/[0.06] text-center text-xs text-neutral-600">
          <span>Don&apos;t have an account yet? </span>
          <Link
            href={`/register?redirect=${encodeURIComponent(redirect)}`}
            className="font-bold text-neutral-900 underline hover:text-black"
          >
            Create Account
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#F6F5F2] flex flex-col justify-between p-4 sm:p-6 md:p-8">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-black transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to bookstore</span>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center py-10">
        <React.Suspense fallback={<div className="text-xs text-neutral-400">Loading sign-in...</div>}>
          <LoginForm />
        </React.Suspense>
      </div>

      <div className="text-center text-[11px] text-neutral-400 py-4">
        Protected by 256-bit SSL encryption. HiddenBooks © {new Date().getFullYear()}
      </div>
    </div>
  )
}
