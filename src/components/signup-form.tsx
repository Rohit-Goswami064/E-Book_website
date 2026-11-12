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
import { Loader2 } from "lucide-react"

export function SignupForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
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
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="rounded-2xl border border-neutral-200/80 bg-white shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06),0_2px_6px_-2px_rgba(0,0,0,0.04)] overflow-hidden">
        <CardHeader className="px-6 pt-7 pb-4 sm:px-8 sm:pt-8 space-y-1.5">
          <CardTitle className="text-2xl font-bold tracking-tight text-neutral-900">
            Create an account
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-neutral-500 leading-relaxed">
            Enter your details below to create your reader account
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-7 sm:px-8 sm:pb-8">
          <form onSubmit={handleRegister}>
            <div className="flex flex-col gap-5">
              <div className="grid gap-2">
                <Label htmlFor="fullName" className="text-xs sm:text-sm font-medium text-neutral-800">
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Roshan Pandey"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="rounded-xl h-11 border-neutral-200 bg-neutral-50/50 hover:bg-white focus:bg-white px-3.5 text-base sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-neutral-900 focus-visible:border-neutral-900 transition-all shadow-none"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email" className="text-xs sm:text-sm font-medium text-neutral-800">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="reader@example.com"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl h-11 border-neutral-200 bg-neutral-50/50 hover:bg-white focus:bg-white px-3.5 text-base sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-neutral-900 focus-visible:border-neutral-900 transition-all shadow-none"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password" className="text-xs sm:text-sm font-medium text-neutral-800">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••••••"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-xl h-11 border-neutral-200 bg-neutral-50/50 hover:bg-white focus:bg-white px-3.5 text-base sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-neutral-900 focus-visible:border-neutral-900 transition-all shadow-none"
                />
                <p className="text-xs text-neutral-500">
                  Must be at least 6 characters long.
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-neutral-900 hover:bg-black text-white font-medium text-sm transition-all shadow-sm active:scale-[0.99] disabled:opacity-70 disabled:pointer-events-none mt-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </div>

            <div className="mt-6 text-center text-xs sm:text-sm text-neutral-600">
              Already have an account?{" "}
              <Link
                href={`/login?redirect=${encodeURIComponent(redirect)}`}
                className="text-neutral-950 font-semibold underline underline-offset-4 hover:text-black transition-colors"
              >
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="text-center text-xs text-neutral-500 text-balance">
        By continuing, you agree to our{" "}
        <Link href="/terms" className="underline underline-offset-4 hover:text-neutral-900 transition-colors">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline underline-offset-4 hover:text-neutral-900 transition-colors">
          Privacy Policy
        </Link>
        .
      </div>
    </div>
  )
}

