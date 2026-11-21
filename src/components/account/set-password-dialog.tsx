"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { KeyRound, Eye, EyeOff, Loader2, CheckCircle2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

interface SetPasswordDialogProps {
  isTempPassword?: boolean
  userPhone?: string | null
}

export function SetPasswordDialog({
  isTempPassword = false,
  userPhone,
}: SetPasswordDialogProps) {
  const searchParams = useSearchParams()
  const forceOpen = searchParams?.get("setup_password") === "1"

  const [open, setOpen] = React.useState(false)
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    // Check if user previously dismissed in this browser session
    const isDismissed = sessionStorage.getItem("hb_dismiss_temp_pass") === "true"

    if (forceOpen || (isTempPassword && !isDismissed)) {
      setOpen(true)
    }
  }, [forceOpen, isTempPassword])

  const handleDismiss = () => {
    sessionStorage.setItem("hb_dismiss_temp_pass", "true")
    setOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!password || password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.")
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.")
      return
    }

    setLoading(true)

    try {
      // 1. Update password via API
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password.")
      }

      // 2. Sync client Supabase session
      try {
        const supabase = createClient()
        await supabase.auth.updateUser({
          password,
          data: { is_temp_password: false },
        })
      } catch (clientErr) {
        console.warn("[Client Session Update Notice]:", clientErr)
      }

      toast.success("Password created successfully! You can now use this password to sign in.")
      sessionStorage.setItem("hb_dismiss_temp_pass", "true")
      setOpen(false)
    } catch (err: any) {
      setErrorMessage(err?.message || "An error occurred while setting your password.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) handleDismiss()
      else setOpen(val)
    }}>
      <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-[520px] max-h-[92vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden rounded-[24px] sm:rounded-[30px] p-6 sm:p-8 bg-[#FBFBFA] border border-black/10 shadow-2xl">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-neutral-900 text-white flex items-center justify-center mb-1 shadow-sm">
          <KeyRound className="w-6 h-6 stroke-[2]" />
        </div>

        <DialogHeader className="text-center sm:text-center space-y-1.5">
          <DialogTitle className="text-xl sm:text-2xl font-serif font-bold text-neutral-900">
            Create Your Password
          </DialogTitle>
          <DialogDescription className="text-xs text-neutral-600 leading-relaxed max-w-sm mx-auto">
            Set a personal password so you can easily sign in to your library and download your eBooks from any device.
          </DialogDescription>
        </DialogHeader>

        {/* Temporary password info card */}
        {userPhone && (
          <div className="rounded-2xl bg-amber-50/80 border border-amber-200 p-3.5 space-y-1.5 text-xs shadow-xs text-amber-950">
            <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              Temporary Password Alert
            </div>
            <div className="flex items-center justify-between">
              <span className="text-amber-900 font-medium">Temporary Password:</span>
              <span className="font-mono font-bold text-amber-950 bg-amber-100/90 px-2.5 py-0.5 rounded-full border border-amber-300">
                +91 {userPhone}
              </span>
            </div>
            <p className="text-[11px] text-amber-800/90 pt-0.5 leading-relaxed">
              Aapka temporary password aapka phone number hai. Kripya naya secure password create kar ke save karein.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* New Password */}
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-semibold text-neutral-700">
              New Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                required
                disabled={loading}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (errorMessage) setErrorMessage(null)
                }}
                placeholder="At least 6 characters"
                className="pr-10 h-11 bg-white border-neutral-200 rounded-xl text-sm"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-semibold text-neutral-700">
              Confirm Password
            </label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                required
                disabled={loading}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (errorMessage) setErrorMessage(null)
                }}
                placeholder="Re-enter your password"
                className="pr-10 h-11 bg-white border-neutral-200 rounded-xl text-sm"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMessage && (
            <p className="text-xs text-rose-500 font-medium text-left">
              {errorMessage}
            </p>
          )}

          <div className="pt-2 space-y-2">
            <Button
              type="submit"
              disabled={loading}
              size="lg"
              className="w-full h-12 rounded-full bg-[#111111] hover:bg-neutral-800 text-white font-bold text-sm shadow-md gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Password...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Password</span>
                </>
              )}
            </Button>

            <button
              type="button"
              onClick={handleDismiss}
              className="w-full text-center text-xs font-semibold text-neutral-500 hover:text-neutral-800 py-1 transition-colors"
            >
              Keep Mobile Number as Password for Now
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

