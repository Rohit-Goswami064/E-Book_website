"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  ShoppingBag,
  BookOpen,
  Download,
  Loader2,
  Check,
  Tag,
  X,
  Sparkles,
  User,
  Phone,
  Mail,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
} from "lucide-react"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

declare global {
  interface Window {
    Razorpay?: any
  }
}

interface CheckoutButtonProps {
  bookId: string
  slug?: string
  title: string
  priceCents: number
  isFree: boolean
  currency?: string
  isEntitled: boolean
  userEmail?: string | null
  userName?: string | null
}

interface AppliedCoupon {
  code: string
  discountCents: number
  finalPriceCents: number
  savingsFormatted: string
}

interface CompletedOrderInfo {
  orderId: string
  isNewAccount: boolean
  userPhone: string
  userEmail: string
  bookId: string
}

export function CheckoutButton({
  bookId,
  slug,
  title,
  priceCents,
  isFree,
  currency = "INR",
  isEntitled,
  userEmail,
  userName,
}: CheckoutButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)

  // Coupon state
  const [couponInput, setCouponInput] = React.useState("")
  const [appliedCoupon, setAppliedCoupon] = React.useState<AppliedCoupon | null>(null)
  const [validatingCoupon, setValidatingCoupon] = React.useState(false)
  const [couponError, setCouponError] = React.useState<string | null>(null)
  const [isCouponDialogOpen, setIsCouponDialogOpen] = React.useState(false)

  // Guest Checkout state
  const [isGuestDialogOpen, setIsGuestDialogOpen] = React.useState(false)
  const [guestFullName, setGuestFullName] = React.useState(userName || "")
  const [guestMobile, setGuestMobile] = React.useState("")
  const [guestEmail, setGuestEmail] = React.useState(userEmail || "")
  const [guestErrors, setGuestErrors] = React.useState<{
    fullName?: string
    mobile?: string
    email?: string
  }>({})

  // Success / Account Access Dialog state
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = React.useState(false)
  const [completedOrder, setCompletedOrder] = React.useState<CompletedOrderInfo | null>(null)

  // Pre-load Razorpay script safely
  function loadRazorpayCheckoutScript(): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window === "undefined") {
        resolve(false)
        return
      }
      if (window.Razorpay) {
        resolve(true)
        return
      }
      const existing = document.querySelector(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
      )
      if (existing) {
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

  // Preload Razorpay on mount
  React.useEffect(() => {
    loadRazorpayCheckoutScript().catch(() => {})
  }, [])

  // If user is already entitled, render "Read Now" CTA
  if (isEntitled) {
    return (
      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <Button
          onClick={() => {
            window.location.href = `/read/${bookId}`
          }}
          size="lg"
          className="flex-1 rounded-full h-12 text-sm font-bold bg-[#111111] hover:bg-neutral-800 text-white shadow-md gap-2"
        >
          <BookOpen className="w-4 h-4" />
          Read Now in Library
        </Button>
        {isFree && (
          <Button
            onClick={async () => {
              try {
                const res = await fetch(`/api/books/${bookId}/download`)
                const data = await res.json()
                if (res.ok && data.downloadUrl) {
                  window.open(data.downloadUrl, "_blank")
                } else {
                  toast.error(data.error || "Download unavailable")
                }
              } catch {
                toast.error("Failed to generate download link")
              }
            }}
            variant="outline"
            size="lg"
            className="rounded-full h-12 text-sm font-bold gap-2"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
        )}
      </div>
    )
  }

  // Validate coupon via server API
  const handleApplyCoupon = async (codeToValidate?: string) => {
    const targetCode = (codeToValidate || couponInput).trim().toUpperCase()
    if (!targetCode) {
      setCouponError("Please enter a coupon code.")
      return
    }

    setValidatingCoupon(true)
    setCouponError(null)

    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: targetCode,
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
        setIsCouponDialogOpen(false)
        toast.success(data.message || `Coupon "${data.code}" applied!`)
      } else {
        setCouponError(data.error || "Invalid coupon code.")
        toast.error(data.error || "Invalid coupon code.")
      }
    } catch {
      setCouponError("Could not validate coupon. Please try again.")
      toast.error("Failed to validate coupon.")
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

  // Effective price considering active coupon
  const effectivePriceCents = appliedCoupon ? appliedCoupon.finalPriceCents : priceCents

  // Validate guest checkout input fields
  const validateGuestDetails = () => {
    const errors: { fullName?: string; mobile?: string; email?: string } = {}
    if (!guestFullName.trim() || guestFullName.trim().length < 2) {
      errors.fullName = "Please enter your full name (at least 2 characters)."
    }

    const cleanMobile = guestMobile.replace(/[^0-9]/g, "")
    if (!cleanMobile || cleanMobile.length < 10) {
      errors.mobile = "Please enter a valid 10-digit mobile number."
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!guestEmail.trim() || !emailRegex.test(guestEmail.trim())) {
      errors.email = "Please enter a valid email address for ebook access."
    }

    setGuestErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Primary action click: If user is logged in, proceed directly; if not, open guest checkout modal
  const handlePrimaryClick = async () => {
    // Check if user is already logged in
    let activeEmail = userEmail
    if (!activeEmail) {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          activeEmail = user.email
        }
      } catch {}
    }

    if (!activeEmail) {
      // Unauthenticated: Open guest checkout modal directly (No login redirect!)
      setGuestErrors({})
      setIsGuestDialogOpen(true)
    } else {
      // Authenticated: Proceed with existing checkout flow
      handleExecuteOrder(null)
    }
  }

  // Execute Order creation & payment (For both Authenticated & Guest checkouts)
  const handleExecuteOrder = async (
    guestPayload: { fullName: string; mobile: string; email: string } | null
  ) => {
    setLoading(true)
    try {
      // 1. Create order on server (accepts guest details or session auth)
      const res = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId,
          couponCode: appliedCoupon?.code || null,
          guestDetails: guestPayload,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to initiate order")
        setLoading(false)
        return
      }

      // Close guest modal if open
      setIsGuestDialogOpen(false)

      // 2. If book is Free or 100% discounted via coupon
      if (data.isFree) {
        toast.success(data.message || "Book successfully added to your library!")
        if (guestPayload) {
          setCompletedOrder({
            orderId: data.orderId,
            isNewAccount: !!data.isNewAccount,
            userPhone: data.userPhone || guestPayload.mobile,
            userEmail: data.userEmail || guestPayload.email,
            bookId: data.bookId || bookId,
          })
          setIsSuccessDialogOpen(true)
        } else {
          window.location.href = `/read/${bookId}`
        }
        setLoading(false)
        return
      }

      // 3. Ensure Razorpay Checkout Modal is loaded
      let isSdkReady = !!window.Razorpay
      if (!isSdkReady) {
        isSdkReady = await loadRazorpayCheckoutScript()
      }

      if (!isSdkReady || !window.Razorpay) {
        toast.error("Payment SDK could not be loaded. Please check your internet connection and retry.")
        setLoading(false)
        return
      }

      if (!data.keyId) {
        toast.error("Payment gateway configuration error: missing public Key ID.")
        setLoading(false)
        return
      }

      const options = {
        key: data.keyId,
        amount: data.amountCents,
        currency: data.currency,
        name: "HiddenBooks",
        description: `Purchase of ${data.bookTitle}`,
        order_id: data.razorpayOrderId,
        prefill: {
          name: data.userName || guestPayload?.fullName || userName || "",
          email: data.userEmail || guestPayload?.email || userEmail || "",
          contact: data.userPhone || guestPayload?.mobile || "",
        },
        theme: {
          color: "#111111",
        },
        handler: async function (response: any) {
          // 4. Send signatures to server for cryptographic verification
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
            if (verifyRes.ok && verifyData.success) {
              toast.success("Payment verified! Opening your book...")

              if (guestPayload || verifyData.isNewAccount) {
                // Show Guest Account Access & Success Modal
                setCompletedOrder({
                  orderId: verifyData.orderId,
                  isNewAccount: !!verifyData.isNewAccount,
                  userPhone: verifyData.customerPhone || guestPayload?.mobile || "",
                  userEmail: verifyData.customerEmail || guestPayload?.email || "",
                  bookId: verifyData.bookId || bookId,
                })
                setIsSuccessDialogOpen(true)
              } else {
                window.location.href = `/read/${bookId}`
              }
            } else {
              toast.error(verifyData.error || "Payment verification failed.")
            }
          } catch {
            toast.error("Error confirming payment. Please contact support.")
          } finally {
            setLoading(false)
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false)
            toast.info("Payment was cancelled.")
          },
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.on("payment.failed", function (resp: any) {
        toast.error(`Payment failed: ${resp.error?.description || "Declined"}`)
        setLoading(false)
      })
      rzp.open()
    } catch (err: any) {
      toast.error(err?.message || "Failed to initiate payment")
      setLoading(false)
    }
  }

  // Handle Guest Dialog submission
  const handleGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateGuestDetails()) return

    handleExecuteOrder({
      fullName: guestFullName.trim(),
      mobile: guestMobile.trim(),
      email: guestEmail.trim(),
    })
  }

  return (
    <div className="space-y-3 w-full">
      {/* Primary Action Buttons Container - Mobile & Desktop Optimized */}
      <div className="flex flex-col sm:flex-row gap-3 w-full items-stretch">
        <Button
          onClick={handlePrimaryClick}
          disabled={loading}
          size="lg"
          className="w-full flex-1 rounded-full h-12 sm:h-13 text-sm sm:text-base font-bold bg-[#111111] hover:bg-neutral-800 text-white shadow-md gap-2 transition-all active:scale-[0.99]"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing...</span>
            </>
          ) : isFree || priceCents === 0 ? (
            <>
              <BookOpen className="w-4 h-4" />
              <span>Claim & Read for Free</span>
            </>
          ) : appliedCoupon ? (
            <>
              <ShoppingBag className="w-4 h-4" />
              <span>Buy Now • {formatCurrency(effectivePriceCents, currency)}</span>
              <span className="line-through text-neutral-400 text-xs ml-1">
                {formatCurrency(priceCents, currency)}
              </span>
            </>
          ) : (
            <>
              <ShoppingBag className="w-4 h-4" />
              <span>Buy Now • {formatCurrency(priceCents, currency)}</span>
            </>
          )}
        </Button>

        {!isFree && priceCents > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setCouponError(null)
              setIsCouponDialogOpen(true)
            }}
            size="lg"
            className="w-full sm:w-auto rounded-full h-12 sm:h-13 text-xs sm:text-sm font-semibold px-5 gap-2 border-black/15 hover:bg-neutral-100 bg-white shadow-sm"
          >
            <Tag className="w-3.5 h-3.5 text-neutral-600" />
            <span>{appliedCoupon ? "Change Coupon" : "Apply Coupon"}</span>
          </Button>
        )}
      </div>

      {/* Applied Coupon Banner */}
      {appliedCoupon && (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200/80 rounded-[16px] px-3.5 py-2.5 text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
            <div>
              <span className="font-bold tracking-wide font-mono mr-1">
                {appliedCoupon.code}
              </span>
              <span>applied: saved {appliedCoupon.savingsFormatted}!</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemoveCoupon}
            className="p-1 text-emerald-700 hover:text-emerald-950 hover:bg-emerald-100 rounded-full transition-colors"
            title="Remove coupon"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Guest Checkout Modal Dialog */}
      <Dialog open={isGuestDialogOpen} onOpenChange={setIsGuestDialogOpen}>
        <DialogContent className="w-[92vw] max-w-md rounded-[24px] p-5 sm:p-7 bg-[#FBFBFA] border border-black/10 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-bold font-serif text-neutral-900 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-neutral-800" />
              <span>Instant Checkout</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-500 pt-1">
              Enter your contact details to complete your order. An account will be secured automatically so you can access your ebook anytime.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGuestSubmit} className="space-y-4 pt-3">
            {/* Full Name Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-neutral-500" />
                <span>Full Name</span>
              </label>
              <Input
                type="text"
                value={guestFullName}
                onChange={(e) => {
                  setGuestFullName(e.target.value)
                  if (guestErrors.fullName) setGuestErrors({ ...guestErrors, fullName: undefined })
                }}
                placeholder="e.g. Rahul Sharma"
                className="h-11 rounded-xl bg-white border-black/15 text-sm"
                required
              />
              {guestErrors.fullName && (
                <p className="text-[11px] text-red-600 font-medium pl-1">{guestErrors.fullName}</p>
              )}
            </div>

            {/* Mobile Number Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-neutral-500" />
                <span>Mobile Number (Login ID)</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-xs font-semibold text-neutral-500 select-none">
                  +91
                </span>
                <Input
                  type="tel"
                  maxLength={10}
                  value={guestMobile}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "")
                    setGuestMobile(val)
                    if (guestErrors.mobile) setGuestErrors({ ...guestErrors, mobile: undefined })
                  }}
                  placeholder="9876543210"
                  className="pl-12 h-11 rounded-xl bg-white border-black/15 text-sm font-mono tracking-wider"
                  required
                />
              </div>
              {guestErrors.mobile ? (
                <p className="text-[11px] text-red-600 font-medium pl-1">{guestErrors.mobile}</p>
              ) : (
                <p className="text-[10px] text-neutral-400 pl-1">
                  Used as your secure login ID to access this ebook on any device.
                </p>
              )}
            </div>

            {/* Email Address Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-neutral-500" />
                <span>Email Address</span>
              </label>
              <Input
                type="email"
                value={guestEmail}
                onChange={(e) => {
                  setGuestEmail(e.target.value)
                  if (guestErrors.email) setGuestErrors({ ...guestErrors, email: undefined })
                }}
                placeholder="you@example.com"
                className="h-11 rounded-xl bg-white border-black/15 text-sm"
                required
              />
              {guestErrors.email ? (
                <p className="text-[11px] text-red-600 font-medium pl-1">{guestErrors.email}</p>
              ) : (
                <p className="text-[10px] text-neutral-400 pl-1">
                  Payment receipt, order invoice & password setup link will be sent here.
                </p>
              )}
            </div>

            {/* Order Price Summary Box */}
            <div className="p-3.5 rounded-xl bg-neutral-100/80 border border-black/5 flex items-center justify-between text-xs">
              <div>
                <div className="font-bold text-neutral-900 truncate max-w-[200px] sm:max-w-xs">{title}</div>
                <div className="text-[11px] text-neutral-500">Digital eBook Edition • Lifetime Access</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-sm text-neutral-900">
                  {formatCurrency(effectivePriceCents, currency)}
                </div>
                {appliedCoupon && (
                  <div className="text-[10px] text-emerald-700 font-semibold font-mono">
                    {appliedCoupon.code} applied
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-full bg-[#111111] hover:bg-neutral-800 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Initiating Checkout...</span>
                  </>
                ) : isFree || effectivePriceCents === 0 ? (
                  <span>Claim & Read for Free</span>
                ) : (
                  <span>Proceed to Payment • {formatCurrency(effectivePriceCents, currency)}</span>
                )}
              </Button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-500 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>100% Secure Razorpay Checkout • SSL Encrypted</span>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Success & Account Access Confirmation Dialog */}
      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="w-[92vw] max-w-md rounded-[28px] p-6 sm:p-8 bg-[#FBFBFA] border border-black/10 shadow-2xl text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 shadow-sm">
            <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
          </div>

          <DialogHeader className="text-center sm:text-center">
            <DialogTitle className="text-2xl font-serif font-bold text-neutral-900">
              Payment Confirmed!
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-600 pt-1.5 leading-relaxed">
              Your ebook <span className="font-semibold text-neutral-900">&quot;{title}&quot;</span> has been successfully added to your library.
            </DialogDescription>
          </DialogHeader>

          {/* Account Credential Information Box */}
          <div className="my-5 rounded-2xl bg-white border border-black/10 p-4 text-left space-y-2.5 shadow-sm text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-black/5">
              <span className="font-semibold text-neutral-500">Account Access:</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {completedOrder?.isNewAccount ? "Auto-Created & Active" : "Linked to Existing Account"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-neutral-500 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-neutral-400" />
                <span>Mobile Login ID:</span>
              </span>
              <span className="font-mono font-bold text-neutral-900">
                +91 {completedOrder?.userPhone}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-neutral-500 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-neutral-400" />
                <span>Registered Email:</span>
              </span>
              <span className="font-medium text-neutral-800 truncate max-w-[180px]">
                {completedOrder?.userEmail}
              </span>
            </div>

            {completedOrder?.isNewAccount ? (
              <p className="text-[11px] text-neutral-500 pt-1 leading-relaxed border-t border-black/5">
                💡 Your account has been created and you are currently logged in. To access your library from any other device or computer later, simply sign in with your mobile number <strong>{completedOrder?.userPhone}</strong>.
              </p>
            ) : (
              <p className="text-[11px] text-neutral-500 pt-1 leading-relaxed border-t border-black/5">
                💡 This purchase was successfully linked to your existing account. Sign in with your mobile number <strong>{completedOrder?.userPhone}</strong> or email to access your library.
              </p>
            )}
          </div>

          {/* CTA Navigation Buttons */}
          <div className="space-y-2.5">
            <Button
              onClick={() => {
                window.location.href = `/read/${completedOrder?.bookId || bookId}`
              }}
              size="lg"
              className="w-full h-12 rounded-full bg-[#111111] hover:bg-neutral-800 text-white font-bold text-sm shadow-md gap-2"
            >
              <span>Read Now in Library</span>
              <ArrowRight className="w-4 h-4" />
            </Button>

            <Button
              onClick={() => {
                window.location.href = "/account/library"
              }}
              variant="outline"
              size="lg"
              className="w-full h-11 rounded-full text-xs font-semibold border-black/15 bg-white hover:bg-neutral-100"
            >
              View All Books in My Library
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. Coupon Modal Dialog */}
      <Dialog open={isCouponDialogOpen} onOpenChange={setIsCouponDialogOpen}>
        <DialogContent className="w-[92vw] max-w-sm rounded-[24px] p-5 sm:p-6 bg-[#FBFBFA]">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl font-bold font-serif text-neutral-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Have a Coupon Code?
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-500 pt-1">
              Apply a promo code to unlock instant discounts on this edition.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <Input
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value.toUpperCase())
                    setCouponError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleApplyCoupon()
                    }
                  }}
                  placeholder="e.g. WELCOME10"
                  className="uppercase tracking-wider font-mono h-11 text-sm bg-white"
                />
                <Button
                  type="button"
                  onClick={() => handleApplyCoupon()}
                  disabled={validatingCoupon || !couponInput.trim()}
                  className="rounded-xl px-5 h-11 bg-[#111111] hover:bg-neutral-800 font-bold text-xs"
                >
                  {validatingCoupon ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Apply"
                  )}
                </Button>
              </div>

              {couponError && (
                <p className="text-[11px] text-red-600 font-medium pl-1">
                  {couponError}
                </p>
              )}
            </div>

            {/* Popular Promo Suggestions */}
            <div className="pt-2 border-t border-black/[0.06]">
              <div className="text-[11px] font-semibold text-neutral-500 mb-2">
                Available Offers:
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCouponInput("WELCOME10")
                    handleApplyCoupon("WELCOME10")
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-black/10 bg-white hover:border-black/30 text-left text-xs transition-colors flex items-center gap-1.5"
                >
                  <span className="font-mono font-bold text-neutral-900">WELCOME10</span>
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                    10% OFF
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCouponInput("FLAT50")
                    handleApplyCoupon("FLAT50")
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-black/10 bg-white hover:border-black/30 text-left text-xs transition-colors flex items-center gap-1.5"
                >
                  <span className="font-mono font-bold text-neutral-900">FLAT50</span>
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                    ₹50 OFF
                  </span>
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
