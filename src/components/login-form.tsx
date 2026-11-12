"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { normalizeIndianMobile } from "@/lib/auth/mobile-normalizer"

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
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
  const [showPassword, setShowPassword] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let targetEmail = email.trim()
      const normalizedMobile = normalizeIndianMobile(targetEmail)
      const isMobile = !targetEmail.includes("@") && (normalizedMobile !== null || targetEmail.replace(/\D/g, "").length >= 10)

      if (isMobile) {
        try {
          const resolveRes = await fetch("/api/auth/resolve-identifier", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: normalizedMobile || targetEmail }),
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

        let targetRedirect = redirect
        try {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", data.user.id)
            .maybeSingle()
          const role = (roleData as any)?.role
          if (role === "admin" || role === "super_admin") {
            if (!searchParams.get("redirect") || redirect === "/account") {
              targetRedirect = "/super-admin"
            }
          }
        } catch {}

        window.location.href = targetRedirect
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
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="rounded-2xl border border-neutral-200/80 bg-white shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06),0_2px_6px_-2px_rgba(0,0,0,0.04)] overflow-hidden">
        <CardHeader className="px-6 pt-7 pb-4 sm:px-8 sm:pt-8 space-y-1.5">
          <CardTitle className="text-2xl font-bold tracking-tight text-neutral-900">Login</CardTitle>
          <CardDescription className="text-xs sm:text-sm text-neutral-500 leading-relaxed">
            Enter your email or mobile number below to access your account
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-7 sm:px-8 sm:pb-8">
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-5">
              <div className="grid gap-2">
                <Label htmlFor="identifier" className="text-xs sm:text-sm font-medium text-neutral-800">
                  Email or Mobile Number (Login ID)
                </Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="name@example.com or 10-digit mobile (+91)"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl h-11 border-neutral-200 bg-neutral-50/50 hover:bg-white focus:bg-white px-3.5 text-base sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-neutral-900 focus-visible:border-neutral-900 transition-all shadow-none"
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs sm:text-sm font-medium text-neutral-800">
                    Password
                  </Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-neutral-600 hover:text-neutral-950 hover:underline underline-offset-4 transition-colors"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <div className="relative flex items-center">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-xl h-11 border-neutral-200 bg-neutral-50/50 hover:bg-white focus:bg-white pl-3.5 pr-11 text-base sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-neutral-900 focus-visible:border-neutral-900 transition-all shadow-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100/80 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-neutral-900 hover:bg-black text-white font-medium text-sm transition-all shadow-sm active:scale-[0.99] disabled:opacity-70 disabled:pointer-events-none mt-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </div>

            <div className="mt-6 text-center text-xs sm:text-sm text-neutral-600">
              Don&apos;t have an account?{" "}
              <Link
                href={`/register?redirect=${encodeURIComponent(redirect)}`}
                className="text-neutral-950 font-semibold underline underline-offset-4 hover:text-black transition-colors"
              >
                Sign up
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
