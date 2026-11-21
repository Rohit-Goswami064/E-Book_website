"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Phone, ArrowRight, BookOpen, Tag, X, User } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/utils"
import { normalizeIndianMobile } from "@/lib/auth/mobile-normalizer"

declare global {
  interface Window {
    Razorpay?: any
  }
}

export interface FrictionlessCheckoutProps {
  bookId: string
  price: number
  bookTitle?: string
  currency?: string
  initialMobile?: string
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
  initialMobile = "",
  className = "",
  onSuccess,
}: FrictionlessCheckoutProps) {
  const router = useRouter()
  const [name, setName] = React.useState("")
  const [mobile, setMobile] = React.useState(initialMobile)
  const [isAuthenticated, setIsAuthenticated] = React.useState(false)
  const [userDisplay, setUserDisplay] = React.useState<string>("")

  const [loadingStage, setLoadingStage] = React.useState<CheckoutStage>("idle")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // Collapsible coupon state
  const [isCouponExpanded, setIsCouponExpanded] = React.useState(false)
  const [couponInput, setCouponInput] = React.useState("")
  const [appliedCoupon, setAppliedCoupon] = React.useState<{
    code: string
    discountCents: number
    finalPriceCents: number
    savingsFormatted: string
  } | null>(null)
  const [validatingCoupon, setValidatingCoupon] = React.useState(false)
  const [couponError, setCouponError] = React.useState<string | null>(null)

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return
    setValidatingCoupon(true)
    setCouponError(null)

    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponInput.trim().toUpperCase(),
          bookId,
        }),
      })

      const data = await res.json()
      if (res.ok && data.valid) {
        setAppliedCoupon({
          code: data.code,
          discountCents: data.discountCents,
          finalPriceCents: data.finalPriceCents,
          savingsFormatted: data.savingsFormatted,
        })
        setCouponInput("")
        setIsCouponExpanded(false)
        toast.success(data.message || `Coupon "${data.code}" applied!`)
      } else {
        setCouponError(data.error || "Invalid coupon code.")
        toast.error(data.error || "Invalid coupon code.")
      }
    } catch {
      setCouponError("Could not validate coupon. Please try again.")
    } finally {
      setValidatingCoupon(false)
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponInput("")
    setCouponError(null)
    toast.info("Coupon removed.")
  }

  const isLoading = loadingStage !== "idle"

  React.useEffect(() => {
    loadRazorpayScript().catch(() => {})
  }, [])

  // Auto-fill logged in user info if available
  React.useEffect(() => {
    const supabase = createClient()
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (user) {
          setIsAuthenticated(true)
          const phone = user.user_metadata?.phone || (user as any).phone
          if (phone) {
            setMobile(phone)
            setUserDisplay(`+91 ${phone}`)
          } else if (user.email) {
            setUserDisplay(user.email)
          }
        }
      })
      .catch(() => {})
  }, [])

  const effectivePrice = appliedCoupon ? appliedCoupon.finalPriceCents : price
  const displayPrice = React.useMemo(() => {
    if (effectivePrice === 0) return "Free"
    const amountInPaise =
      effectivePrice < 1000 && Number.isInteger(effectivePrice) ? effectivePrice * 100 : effectivePrice
    return formatCurrency(amountInPaise, currency)
  }, [effectivePrice, currency])

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()

    const cleanMobile = mobile.replace(/\D/g, "")
    const cleanName = name.trim()
    if (!isAuthenticated) {
      if (!cleanName || cleanName.length < 2) {
        setErrorMessage("Please enter your full name.")
        return
      }
      if (!cleanMobile || cleanMobile.length !== 10) {
        setErrorMessage("Please enter a valid 10-digit Indian mobile number.")
        return
      }
      if (!/^[5-9]\d{9}$/.test(cleanMobile)) {
        setErrorMessage("Please enter a valid mobile number starting with 6, 7, 8, or 9.")
        return
      }
    }

    setErrorMessage(null)
    setLoadingStage("initiating")

    try {
      const orderRes = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId,
          couponCode: appliedCoupon?.code || null,
          customerName: cleanName || undefined,
          customerMobile: cleanMobile || undefined,
        }),
      })

      const orderData = await orderRes.json()

      if (!orderRes.ok) {
        throw new Error(orderData.error || "Failed to initiate order. Please try again.")
      }

      if (orderData.isFree) {
        setLoadingStage("redirecting")
        toast.success(orderData.message || "Book successfully added to your library!")
        if (onSuccess) onSuccess(orderData.orderId)
        router.push(`/read/${bookId}`)
        return
      }

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

      setLoadingStage("awaiting_payment")

      const options = {
        key: orderData.keyId,
        amount: orderData.amountCents,
        currency: orderData.currency || currency || "INR",
        name: "HiddenBooks",
        description: `Access to ${orderData.bookTitle || bookTitle}`,
        order_id: orderData.razorpayOrderId,
        prefill: {
          contact: orderData.userPhone || cleanMobile || "",
          email: orderData.userEmail || (cleanMobile ? `${cleanMobile}@hiddenbooks.in` : ""),
          name: orderData.userName || "",
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

            const phonePassword = cleanMobile || verifyData.customerPhone
            const targetEmail = verifyData.customerEmail || (phonePassword ? `${phonePassword}@hiddenbooks.in` : null)
            let sessionReady = false

            if (targetEmail && phonePassword) {
              try {
                const supabase = createClient()
                const { error: signInErr } = await supabase.auth.signInWithPassword({
                  email: targetEmail,
                  password: phonePassword,
                })
                if (!signInErr) sessionReady = true
              } catch {}
            }

            if (!sessionReady && verifyData.autoLoginToken) {
              try {
                const supabase = createClient()
                await supabase.auth.verifyOtp({
                  token_hash: verifyData.autoLoginToken,
                  type: "magiclink",
                })
              } catch {}
            }

            setLoadingStage("redirecting")
            toast.success("Payment confirmed! Redirecting to your dashboard...")
            if (onSuccess) onSuccess(verifyData.orderId)

            window.location.href = "/account/downloads?setup_password=1"
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
      setErrorMessage(err.message || "An error occurred during checkout")
      toast.error(err.message || "An error occurred during checkout")
      setLoadingStage("idle")
    }
  }

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
        {/* Delivery to Active User or Mobile Number Input */}
        {isAuthenticated ? (
          <div className="p-3 rounded-2xl bg-white border border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0 text-neutral-700">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                  Delivering to
                </p>
                <p className="font-medium text-neutral-900 truncate">{userDisplay}</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200/80 flex-shrink-0">
              Account Active
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Full Name */}
            <div className="space-y-1.5 text-left">
              <label htmlFor="checkout-name" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                <Input
                  id="checkout-name"
                  type="text"
                  required
                  disabled={isLoading}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (errorMessage) setErrorMessage(null)
                  }}
                  placeholder="e.g. Rahul Sharma"
                  className="pl-10 h-11 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-xl text-sm"
                />
              </div>
            </div>

            {/* Mobile Number */}
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="checkout-mobile"
                  className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300"
                >
                  Mobile Number
                </label>
                <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                  No password required
                </span>
              </div>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-xs font-semibold text-neutral-600 select-none flex items-center gap-1.5 pointer-events-none">
                  <Phone className="w-3.5 h-3.5 text-neutral-400" />
                  <span>+91</span>
                  <span className="text-neutral-300">|</span>
                </span>
                <Input
                  id="checkout-mobile"
                  type="tel"
                  maxLength={10}
                  required
                  disabled={isLoading}
                  value={mobile}
                  onChange={(e) => {
                    setMobile(e.target.value.replace(/\D/g, ""))
                    if (errorMessage) setErrorMessage(null)
                  }}
                  placeholder="9876543210"
                  className="pl-18 h-11 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 rounded-xl text-sm font-mono tracking-wider"
                />
              </div>
              <p className="text-[11px] text-neutral-500 pl-1">
                Your purchase receipt and instant eBook library link will be linked to this number.
              </p>
            </div>
          </div>
        )}

        {errorMessage && (
          <p className="text-xs text-rose-500 font-medium text-left">{errorMessage}</p>
        )}

        {/* Collapsible Coupon Code Section */}
        {price > 0 && (
          <div className="space-y-1.5 text-left">
            {appliedCoupon ? (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-300">
                <div className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-bold font-mono uppercase">{appliedCoupon.code}</span>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    applied (-{appliedCoupon.savingsFormatted})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-800 dark:text-rose-400 transition cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ) : !isCouponExpanded ? (
              <button
                type="button"
                onClick={() => setIsCouponExpanded(true)}
                className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 flex items-center gap-1.5 transition-colors group py-1"
              >
                <Tag className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-700 transition" />
                <span className="underline-offset-2 hover:underline">+ Have a coupon code?</span>
              </button>
            ) : (
              <div className="p-3 rounded-2xl bg-white border border-neutral-200 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-neutral-700 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Apply Coupon</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCouponExpanded(false)
                      setCouponError(null)
                    }}
                    className="text-neutral-400 hover:text-neutral-700 p-0.5 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                    <Input
                      type="text"
                      disabled={isLoading}
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value.toUpperCase())
                        if (couponError) setCouponError(null)
                      }}
                      placeholder="Coupon Code"
                      className="pl-9 h-10 rounded-xl bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-xs uppercase font-mono"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleApplyCoupon()}
                    disabled={isLoading || validatingCoupon || !couponInput.trim()}
                    size="sm"
                    className="h-10 px-3.5 rounded-xl text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900"
                  >
                    {validatingCoupon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
                  </Button>
                </div>
                {couponError && (
                  <p className="text-[11px] text-rose-500 font-medium pl-1 mt-1">{couponError}</p>
                )}
              </div>
            )}
          </div>
        )}

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
              <BookOpen className="w-4 h-4" />
              <span>{getButtonText()}</span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </>
          )}
        </Button>
      </form>
    </div>
  )
}

export default FrictionlessCheckout
