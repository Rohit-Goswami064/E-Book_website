"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Loader2, Lock } from "lucide-react"
import { validatePasswordComplexity } from "@/lib/auth/mobile-normalizer"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.")
      return
    }
    const complexity = validatePasswordComplexity(password)
    if (!complexity.valid) {
      toast.error(complexity.errors[0] || "Password must be at least 8 characters with uppercase, lowercase, number, and special character.")
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password,
      })

      if (error) {
        toast.error(error.message || "Failed to update password.")
        setLoading(false)
        return
      }

      toast.success("Password updated successfully! Please sign in.")
      router.push("/login")
    } catch (err: any) {
      toast.error(err?.message || "An error occurred.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F5F2] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 text-center">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
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
        <h2 className="font-serif text-3xl font-bold tracking-tight text-[#111111]">
          Set New Password
        </h2>
        <p className="mt-2 text-xs text-neutral-600">
          Enter your new password below to secure your HiddenBooks account.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-[28px] border border-black/[0.06] shadow-sm">
          <form className="space-y-4" onSubmit={handleUpdate}>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="At least 6 characters"
                  className="pl-10 h-11 text-xs bg-[#FAFAFA]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repeat new password"
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
                  Updating...
                </>
              ) : (
                "Save New Password"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
