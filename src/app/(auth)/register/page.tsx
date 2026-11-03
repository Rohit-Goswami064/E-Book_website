"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Lock, Mail, User } from "lucide-react"

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") || "/account"

  const [fullName, setFullName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.")
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      })

      if (error) {
        toast.error(error.message || "Failed to create account.")
        setLoading(false)
        return
      }

      if (data.session) {
        toast.success("Account created successfully! Welcome to HiddenBooks.")
        window.location.href = redirect
      } else {
        toast.info("Registration received. Please check your inbox for verification if enabled.")
        window.location.href = "/login"
      }
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
          Join HiddenBooks
        </h1>
        <p className="text-xs text-neutral-500">
          Create an intellectual digital library that endures across all devices.
        </p>
      </div>

      {/* Form Card */}
      <div className="rounded-[24px] bg-white border border-black/[0.08] p-5 sm:p-7 md:p-8 shadow-sm">
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                required
                placeholder="Marcus Aurelius"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="pl-10 h-11 rounded-full bg-[#FAFAFA] border-black/10 text-sm sm:text-xs text-neutral-900"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                type="email"
                required
                placeholder="reader@hiddenbooks.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-11 rounded-full bg-[#FAFAFA] border-black/10 text-sm sm:text-xs text-neutral-900"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
              Password (min. 6 characters)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                type="password"
                required
                minLength={6}
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
                Creating Account...
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-black/[0.06] text-center text-xs text-neutral-600">
          <span>Already have an account? </span>
          <Link
            href={`/login?redirect=${encodeURIComponent(redirect)}`}
            className="font-bold text-neutral-900 underline hover:text-black"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
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
        <React.Suspense fallback={<div className="text-xs text-neutral-400">Loading registration...</div>}>
          <RegisterForm />
        </React.Suspense>
      </div>

      <div className="text-center text-[11px] text-neutral-400 py-4">
        Protected by 256-bit SSL encryption. HiddenBooks © {new Date().getFullYear()}
      </div>
    </div>
  )
}
