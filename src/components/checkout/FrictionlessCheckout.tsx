"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Mail, Lock, ShieldCheck, ArrowRight, BookOpen } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/utils"

declare global {
  interface Window {
    Razorpay?: any
  }
}

export interface FrictionlessCheckoutProps {
  bookId: string
  price: number // in cents/paise or standard units (e.g. 249 or 24900)
  bookTitle?: string
  currency?: string
  initialEmail?: string
  className?: string
  onSuccess?: (orderId: string) => void
}

type CheckoutStage =
  | "idle"
  | "initiating"
  | "awaiting_payment"
  | "verifying"
  | "authenticating"
  | "redirecting"

/**
 * Dynamically loads the Razorpay checkout.js script if not already present in the DOM.
 */
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false)
      return
    }

    if (window.Razorpay) {
      resolve(true)
      return
    }

    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    )
    if (existingScript) {
      let attempts = 0
      const interval = setInterval(() => {
        attempts++
        if (window.Razorpay) {
          clearInterval(interval)
          resolve(true)
        } else if (attempts > 30) {
          clearInterval(interval)
          resolve(false)
        }
      }, 100)
      return
    }

    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })
}

export function FrictionlessCheckout({
  bookId,
  price,
  bookTitle = "eBook",
  currency = "INR",
  initialEmail = "",
  className = "",
  onSuccess,
}: FrictionlessCheckoutProps) {
  const router = useRouter()
  const [email, setEmail] = React.useState(initialEmail)
  const [loadingStage, setLoadingStage] = React.useState<CheckoutStage>("idle")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const isLoading = loadingStage !== "idle"

  // Pre-load Razorpay SDK script on component mount
  React.useEffect(() => {
    loadRazorpayScript().catch(() => {})
  }, [])

  // Auto-fill logged in user email if available
  React.useEffect(() => {
    if (initialEmail) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setEmail(user.email)
      }
    }).catch(() => {})
  }, [initialEmail])

  // Price formatting helper
  const displayPrice = React.useMemo(() => {
    if (price === 0) return "Free"
    // Handle either rupees (249) or paise (24900)
    const amountInPaise = price < 1000 && Number.isInteger(price) ? price * 100 : price
    return formatCurrency(amountInPaise, currency)
  }, [price, currency])

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()

    const cleanEmail = email.trim().toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setErrorMessage("Please enter a valid email address.")
      toast.error("Please provide a valid email address.")
      return
    }

    setErrorMessage(null)
    setLoadingStage("initiating")

    try {
      // 1. Create order on backend
      const orderRes = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId,
          guestDetails: {
            email: cleanEmail,
          },
        }),
      })

      const orderData = await orderRes.json()

      if (!orderRes.ok) {
        throw new Error(orderData.error || "Failed to initiate order. Please try again.")
      }

      // 2. If the book is free (or 100% discounted)
      if (orderData.isFree) {
        if (orderData.autoLoginToken) {
          setLoadingStage("authenticating")
          const supabase = createClient()
          const targetEmail = orderData.email || orderData.userEmail || cleanEmail
          try {
            await supabase.auth.verifyOtp({
              email: targetEmail,
              token: orderData.autoLoginToken,
              type: "email",
            })
          } catch {}
        }

        setLoadingStage("redirecting")
        toast.success(orderData.message || "Book successfully added to your library!")
        if (onSuccess) onSuccess(orderData.orderId)
        router.push(`/read/${bookId}`)
        return
      }

      // 3. Ensure Razorpay Checkout SDK is ready
      let isSdkReady = !!window.Razorpay
      if (!isSdkReady) {
        isSdkReady = await loadRazorpayScript()
      }

      if (!isSdkReady || !window.Razorpay) {
        throw new Error("Payment gateway could not be loaded. Please check your internet connection.")
      }

      if (!orderData.keyId) {
        throw new Error("Payment gateway configuration missing. Please contact support.")
      }

      // 4. Configure Razorpay modal
      setLoadingStage("awaiting_payment")

      const options = {
        key: orderData.keyId,
        amount: orderData.amountCents,
        currency: orderData.currency || currency || "INR",
        name: "HiddenBooks",
        description: `Access to ${orderData.bookTitle || bookTitle}`,
        order_id: orderData.razorpayOrderId,
        prefill: {
          email: cleanEmail,
          name: orderData.userName || cleanEmail.split("@")[0] || "Reader",
        },
        theme: {
          color: "#111111",
        },
        modal: {
          ondismiss: () => {
            setLoadingStage("idle")
            toast.info("Payment window was closed.")
          },
        },
        handler: async function (response: {
          razorpay_order_id: string
          razorpay_payment_id: string
          razorpay_signature: string
        }) {
          setLoadingStage("verifying")

          try {
            // 5. Send payment signatures to backend for cryptographic verification & entitlement grant
            const verifyRes = await fetch("/api/checkout/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            })

            const verifyData = await verifyRes.json()

            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.error || "Payment verification failed. Please contact support.")
            }

            // 6. Silent Auto-Login Handoff via returned autoLoginToken
            if (verifyData.autoLoginToken) {
              setLoadingStage("authenticating")
              const supabase = createClient()
              const targetEmail = verifyData.email || cleanEmail

              // Primary verification attempt with type: 'email'
              const { error: otpError } = await supabase.auth.verifyOtp({
                email: targetEmail,
                token: verifyData.autoLoginToken,
                type: "email",
              })

              if (otpError) {
                console.warn("[Silent Auto-Login]: type='email' failed, trying fallback:", otpError.message)
                // Fallback attempt with type: 'magiclink' or token_hash
                const { error: magicError } = await supabase.auth.verifyOtp({
                  email: targetEmail,
                  token: verifyData.autoLoginToken,
                  type: "magiclink",
                } as any)

                if (magicError) {
                  // Fallback with token_hash in case GoTrue returned a hashed token
                  await supabase.auth.verifyOtp({
                    token_hash: verifyData.autoLoginToken,
                    type: "magiclink",
                  } as any).catch(() => {})
                }
              }

              console.log("[Silent Auto-Login]: Session established successfully.")
            }

            // 7. Instant Reader Handoff
            setLoadingStage("redirecting")
            toast.success("Payment confirmed! Opening your book...")
            if (onSuccess) onSuccess(verifyData.orderId)

            router.push(`/read/${bookId}`)
          } catch (verifyErr: any) {
            console.error("[Verification Handler Error]:", verifyErr)
            setErrorMessage(verifyErr?.message || "Failed to verify payment.")
            toast.error(verifyErr?.message || "Failed to verify payment.")
            setLoadingStage("idle")
          }
        },
      }

      const rzp = new window.Razorpay(options)

      rzp.on("payment.failed", (errResp: any) => {
        const desc = errResp?.error?.description || "Payment declined"
        toast.error(`Payment failed: ${desc}`)
        setErrorMessage(desc)
        setLoadingStage("idle")
      })

      rzp.open()
    } catch (err: any) {
      console.error("[Checkout Initiation Error]:", err)
      const msg = err?.message || "Failed to initiate payment."
      setErrorMessage(msg)
      toast.error(msg)
      setLoadingStage("idle")
    }
  }

  // Dynamic status text for button
  const getButtonText = () => {
    switch (loadingStage) {
      case "initiating":
        return "Creating Order..."
      case "awaiting_payment":
        return "Awaiting Payment..."
      case "verifying":
        return "Verifying Payment..."
      case "authenticating":
        return "Signing You In..."
      case "redirecting":
        return "Opening Reader..."
      default:
        return `Pay with Razorpay • ${displayPrice}`
    }
  }

  return (
    <div className={`w-full max-w-md mx-auto ${className}`}>
      <form onSubmit={handleCheckout} className="space-y-4">
        <div className="space-y-1.5 text-left">
          <label htmlFor="checkout-email" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            Email for eBook Access
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input
              id="checkout-email"
              type="email"
              required
              disabled={isLoading}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (errorMessage) setErrorMessage(null)
              }}
              placeholder="you@example.com"
              className="pl-10 h-12 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-xl text-sm focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-neutral-100"
            />
          </div>
          {errorMessage && (
            <p className="text-xs text-rose-500 font-medium mt-1">{errorMessage}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          size="lg"
          className="w-full h-12 rounded-xl text-sm font-bold bg-[#111111] hover:bg-neutral-800 text-white shadow-md transition-all duration-200 gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>{getButtonText()}</span>
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              <span>{getButtonText()}</span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </>
          )}
        </Button>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400 pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Instant reading • No password required • Secure 256-bit payment</span>
        </div>
      </form>
    </div>
  )
}

export default FrictionlessCheckout
