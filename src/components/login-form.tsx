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
      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight">Login</CardTitle>
          <CardDescription>
            Enter your email or mobile number below to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-5">
              <div className="grid gap-2">
                <Label htmlFor="identifier" className="text-sm font-medium">
                  Email or Mobile Number
                </Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="name@example.com or 10-digit mobile"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-lg h-10 border-input bg-background px-3 text-sm focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password
                  </Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-lg h-10 border-input bg-background px-3 text-sm focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all shadow-sm"
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

            <div className="mt-5 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href={`/register?redirect=${encodeURIComponent(redirect)}`}
                className="text-foreground font-medium underline underline-offset-4 hover:text-primary transition-colors"
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
