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
  User,
  Phone,
  Mail,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  KeyRound,
} from "lucide-react"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { normalizeIndianMobile } from "@/lib/auth/mobile-normalizer"

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
  userPhone?: string | null
  coverImageUrl?: string | null
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
  userName?: string
  userEmail?: string
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
  userPhone,
  coverImageUrl,
}: CheckoutButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)

  // Express Checkout Modal state: Name & Mobile Number only
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = React.useState(false)
  const [guestName, setGuestName] = React.useState(userName || "")
  const [nameError, setNameError] = React.useState<string | null>(null)
  const [guestMobile, setGuestMobile] = React.useState(userPhone || "")
  const [mobileError, setMobileError] = React.useState<string | null>(null)

  // Collapsible Coupon state (collapsed by default)
  const [isCouponExpanded, setIsCouponExpanded] = React.useState(false)
  const [couponInput, setCouponInput] = React.useState("")
  const [appliedCoupon, setAppliedCoupon] = React.useState<AppliedCoupon | null>(null)
  const [validatingCoupon, setValidatingCoupon] = React.useState(false)
  const [couponError, setCouponError] = React.useState<string | null>(null)

  // Success / Account Access Dialog state
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = React.useState(false)
  const [completedOrder, setCompletedOrder] = React.useState<CompletedOrderInfo | null>(null)

  // Pre-load Razorpay checkout script safely
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

  React.useEffect(() => {
    loadRazorpayCheckoutScript().catch(() => {})
  }, [])

  // If user is already entitled to the book, render "Read Now" CTA directly
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
        setIsCouponExpanded(false)
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

  // Authoritative price on client view
  const effectivePriceCents = appliedCoupon ? appliedCoupon.finalPriceCents : priceCents

  // Validate Name & 10-digit Indian Mobile Number
  const validateInputs = (): boolean => {
    let isValid = true

    const cleanName = guestName.trim()
    if (!cleanName || cleanName.length < 2) {
      setNameError("Please enter your full name (at least 2 characters).")
      isValid = false
    } else {
      setNameError(null)
    }

    const clean = guestMobile.replace(/\D/g, "")
    if (!clean) {
      setMobileError("Please enter your 10-digit mobile number.")
      isValid = false
    } else if (clean.length !== 10) {
      setMobileError("Please enter a valid 10-digit Indian mobile number.")
      isValid = false
    } else if (!/^[5-9]\d{9}$/.test(clean)) {
      setMobileError("Please enter a valid mobile number starting with 6, 7, 8, or 9.")
      isValid = false
    } else {
      setMobileError(null)
    }

    return isValid
  }

  // Primary action click on page
  const handlePrimaryClick = () => {
    setNameError(null)
    setMobileError(null)
    setIsCheckoutDialogOpen(true)
  }

  // Handle redirect from "Read Now in Library" button with guaranteed auto-sign-in
  const handleReadNowClick = async () => {
    setLoading(true)
    const phone = completedOrder?.userPhone || guestMobile || userPhone
    const cleanPhone = phone ? phone.replace(/\D/g, "") : ""
    const email = completedOrder?.userEmail || (cleanPhone ? `${cleanPhone}@hiddenbooks.in` : userEmail)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      // If session not ready yet, perform auto-sign-in with temporary password (mobile number)
      if (!session && email && cleanPhone) {
        await supabase.auth.signInWithPassword({
          email,
          password: cleanPhone,
        })
      }
    } catch (e) {
      console.warn("[Read Now Redirect Auto-sign-in Error]:", e)
    }

    // Redirect to user dashboard with auto-signed-in session
    window.location.href = "/account?setup_password=1"
  }

  // Execute Order creation & payment
  const handleExecuteCheckout = async () => {
    const cleanMobile = (userPhone || guestMobile).replace(/\D/g, "")
    const cleanName = (userName || guestName).trim()

    if (!userPhone && !userEmail) {
      if (!validateInputs()) return
    }

    setLoading(true)

    try {
      // 1. Create order on server (authoritatively resolves user & calculates price)
      const res = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId,
          couponCode: appliedCoupon?.code || null,
          customerName: cleanName || undefined,
          customerMobile: cleanMobile || undefined,
          customerEmail: userEmail || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to initiate order")
        setLoading(false)
        return
      }

      setIsCheckoutDialogOpen(false)

      // 2. If book is Free or 100% discounted
      if (data.isFree) {
        toast.success(data.message || "Book successfully added to your library!")
        setCompletedOrder({
          orderId: data.orderId,
          isNewAccount: !!data.isNewAccount,
          userPhone: data.userPhone || cleanMobile,
          userName: cleanName || userName || "",
          userEmail: data.userEmail,
          bookId: data.bookId || bookId,
        })
        setIsSuccessDialogOpen(true)
        setLoading(false)
        return
      }

      // 3. Ensure Razorpay SDK is ready
      let isSdkReady = !!window.Razorpay
      if (!isSdkReady) {
        isSdkReady = await loadRazorpayCheckoutScript()
      }

      if (!isSdkReady || !window.Razorpay) {
        toast.error("Payment gateway could not be loaded. Please check your connection and retry.")
        setLoading(false)
        return
      }

      if (!data.keyId) {
        toast.error("Payment configuration missing: public Key ID.")
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
          name: data.userName || cleanName || userName || "",
          contact: data.userPhone || cleanMobile || "",
          email: data.userEmail || (cleanMobile ? `${cleanMobile}@hiddenbooks.in` : userEmail || ""),
        },
        theme: {
          color: "#111111",
        },
        handler: async function (response: any) {
          // 4. Verify HMAC-SHA256 signature on server
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
              toast.success("Payment verified! Your eBook has been unlocked.")

              // Establish active customer session using temporary password (mobile number)
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
                  if (!signInErr) {
                    sessionReady = true
                  }
                } catch (authErr) {
                  console.warn("[Password Sign-In Notice]:", authErr)
                }
              }

              // Fallback to magic link token if needed
              if (!sessionReady && verifyData.autoLoginToken) {
                try {
                  const supabase = createClient()
                  await supabase.auth.verifyOtp({
                    token_hash: verifyData.autoLoginToken,
                    type: "magiclink",
                  })
                } catch (authErr) {
                  console.warn("[Auto-Session Notice]:", authErr)
                }
              }

              setCompletedOrder({
                orderId: verifyData.orderId,
                isNewAccount: !!verifyData.isNewAccount,
                userPhone: verifyData.customerPhone || cleanMobile,
                userName: cleanName || userName || "",
                userEmail: verifyData.customerEmail,
                bookId: verifyData.bookId || bookId,
              })
              setIsSuccessDialogOpen(true)
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
            toast.info("Payment cancelled.")
          },
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.on("payment.failed", function (resp: any) {
        toast.error(`Payment failed: ${resp.error?.description || "Transaction declined"}`)
        setLoading(false)
      })
      rzp.open()
    } catch (err: any) {
      toast.error(err?.message || "Failed to initiate payment")
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3 w-full">
      {/* Primary Action Button on Page */}
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
      </div>

      {/* Applied Coupon Banner on Page */}
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

      {/* Express Checkout Modal Dialog */}
      <Dialog open={isCheckoutDialogOpen} onOpenChange={setIsCheckoutDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-[560px] max-h-[92vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden rounded-[24px] sm:rounded-[30px] p-5 sm:p-7 bg-[#FBFBFA] border border-black/10 shadow-2xl space-y-4 sm:space-y-5">
          <DialogHeader className="text-left space-y-1.5 pb-1 border-b border-black/[0.06]">
            <DialogTitle className="text-xl sm:text-2xl font-bold font-serif text-neutral-900 flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-xs shrink-0">
                <ShoppingBag className="w-4 h-4 stroke-[2.2]" />
              </span>
              <span>Express Checkout</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-[13px] text-neutral-500 font-normal leading-relaxed">
              Instant digital delivery • Read on any smartphone, tablet, or browser
            </DialogDescription>
          </DialogHeader>

          {/* Book Summary Card */}
          <div className="flex items-center gap-4 p-3.5 sm:p-4 rounded-2xl bg-white border border-black/[0.08] shadow-2xs">
            <div className="w-16 h-22 sm:w-18 sm:h-26 rounded-xl overflow-hidden bg-neutral-100 flex-shrink-0 shadow-xs border border-black/5 relative flex items-center justify-center">
              {coverImageUrl ? (
                <img
                  src={coverImageUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#E8E0D6] flex flex-col items-center justify-center p-1 text-center">
                  <span className="font-serif font-bold text-xs text-neutral-800">HB</span>
                  <span className="text-[8px] uppercase tracking-wider text-neutral-600 font-semibold mt-0.5">
                    eBook
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 py-0.5">
              <h4 className="font-serif font-bold text-sm sm:text-base text-neutral-900 leading-snug line-clamp-2">
                {title}
              </h4>
              <div className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/70 text-[10px] sm:text-[11px] font-semibold text-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Lifetime Access • PDF eBook</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2.5">
                {appliedCoupon ? (
                  <>
                    <span className="text-lg sm:text-xl font-bold text-neutral-900 font-mono">
                      {formatCurrency(effectivePriceCents, currency)}
                    </span>
                    <span className="text-xs line-through text-neutral-400 font-medium">
                      {formatCurrency(priceCents, currency)}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                      Saved {appliedCoupon.savingsFormatted}
                    </span>
                  </>
                ) : (
                  <span className="text-lg sm:text-xl font-bold text-neutral-900 font-mono">
                    {formatCurrency(priceCents, currency)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Delivery & Account Section: Full Name & Mobile Number */}
          {userPhone || userEmail ? (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-black/[0.08] flex items-center justify-between text-xs shadow-2xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0 text-neutral-700">
                  <User className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                    Delivering to
                  </p>
                  <p className="font-medium text-neutral-900 truncate text-sm">
                    {userName ? `${userName} (+91 ${userPhone || ""})` : userPhone ? `+91 ${userPhone}` : userEmail}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200/80 flex-shrink-0">
                Account Active
              </span>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Full Name Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Full Name</span>
                </label>
                <div className="relative flex items-center">
                  <User className="absolute left-3.5 w-4 h-4 text-neutral-400 pointer-events-none" />
                  <Input
                    type="text"
                    value={guestName}
                    onChange={(e) => {
                      setGuestName(e.target.value)
                      if (nameError) setNameError(null)
                    }}
                    placeholder="e.g. Rahul Sharma"
                    autoFocus
                    autoComplete="name"
                    className="pl-11 h-12 rounded-xl bg-white border border-neutral-200 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 shadow-2xs transition-all hover:border-neutral-300 focus-visible:border-neutral-900 focus-visible:ring-1 focus-visible:ring-neutral-900/30"
                    required
                  />
                </div>
                {nameError && (
                  <p className="text-[11px] text-red-600 font-medium pl-1">{nameError}</p>
                )}
              </div>

              {/* Mobile Number Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Mobile Number</span>
                  </label>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                    No password required
                  </span>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-xs sm:text-sm font-semibold text-neutral-700 select-none flex items-center gap-2 pointer-events-none">
                    <Phone className="w-3.5 h-3.5 text-neutral-400" />
                    <span>+91</span>
                    <span className="text-neutral-300">|</span>
                  </span>
                  <Input
                    type="tel"
                    maxLength={10}
                    value={guestMobile}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "")
                      setGuestMobile(val)
                      if (mobileError) setMobileError(null)
                    }}
                    placeholder="9876543210"
                    autoComplete="tel"
                    className="pl-20 h-12 rounded-xl bg-white border border-neutral-200 text-sm font-mono tracking-wider text-neutral-900 placeholder:text-neutral-400 shadow-2xs transition-all hover:border-neutral-300 focus-visible:border-neutral-900 focus-visible:ring-1 focus-visible:ring-neutral-900/30"
                    required
                  />
                </div>
                {mobileError ? (
                  <p className="text-[11px] text-red-600 font-medium pl-1">{mobileError}</p>
                ) : (
                  <p className="text-[11px] sm:text-xs text-neutral-500 pl-1 leading-relaxed">
                    Your purchase receipt & personal library access will be linked to this number.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Collapsible Coupon Section */}
          {!isFree && priceCents > 0 && (
            <div className="pt-0.5">
              {appliedCoupon ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200/80 text-xs text-emerald-900 shadow-2xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                    <div className="truncate">
                      <span className="font-bold font-mono tracking-wider">{appliedCoupon.code}</span>
                      <span className="text-emerald-700 ml-1.5 font-medium">
                        applied (-{appliedCoupon.savingsFormatted})
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-800 ml-2 px-2 py-0.5 rounded transition hover:bg-rose-50"
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
                <div className="p-3.5 rounded-2xl bg-white border border-black/[0.08] space-y-2.5 shadow-2xs">
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
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value.toUpperCase())
                        if (couponError) setCouponError(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleApplyCoupon()
                        }
                      }}
                      placeholder="PROMO CODE"
                      className="uppercase font-mono text-xs tracking-wider h-11 rounded-xl bg-[#FBFBFA]"
                    />
                    <Button
                      type="button"
                      onClick={() => handleApplyCoupon()}
                      disabled={validatingCoupon || !couponInput.trim()}
                      size="sm"
                      className="h-11 px-5 rounded-xl text-xs font-bold bg-[#111111] hover:bg-neutral-800 text-white shrink-0"
                    >
                      {validatingCoupon ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        "Apply"
                      )}
                    </Button>
                  </div>
                  {couponError && (
                    <p className="text-[11px] text-red-600 font-medium pl-1">{couponError}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-black/5">
                    <span className="text-[10px] text-neutral-400 self-center">Try:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCouponInput("WELCOME10")
                        handleApplyCoupon("WELCOME10")
                      }}
                      className="px-2 py-0.5 rounded-lg border border-black/10 text-[10px] font-mono font-bold bg-neutral-50 hover:bg-neutral-100 text-neutral-800"
                    >
                      WELCOME10
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCouponInput("FLAT50")
                        handleApplyCoupon("FLAT50")
                      }}
                      className="px-2 py-0.5 rounded-lg border border-black/10 text-[10px] font-mono font-bold bg-neutral-50 hover:bg-neutral-100 text-neutral-800"
                    >
                      FLAT50
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action CTA */}
          <div className="pt-2">
            <Button
              type="button"
              onClick={handleExecuteCheckout}
              disabled={loading}
              size="lg"
              className="w-full h-12 sm:h-13.5 rounded-full bg-[#111111] hover:bg-neutral-800 text-white font-bold text-sm sm:text-base shadow-lg transition-all active:scale-[0.99] gap-2.5 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting to Payment...</span>
                </>
              ) : isFree || effectivePriceCents === 0 ? (
                <>
                  <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Claim & Read for Free</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
                  <span>Proceed to Payment • {formatCurrency(effectivePriceCents, currency)}</span>
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success & Account Access Confirmation Dialog */}
      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-[560px] max-h-[92vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden rounded-[24px] sm:rounded-[30px] p-6 sm:p-8 bg-[#FBFBFA] border border-black/10 shadow-2xl text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 shadow-sm">
            <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
          </div>

          <DialogHeader className="text-center sm:text-center">
            <DialogTitle className="text-2xl font-serif font-bold text-neutral-900">
              Payment Confirmed!
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-600 pt-1.5 leading-relaxed">
              Your eBook <span className="font-semibold text-neutral-900">&quot;{title}&quot;</span> has been successfully added to your library.
            </DialogDescription>
          </DialogHeader>

          {/* Account & Delivery Summary Box */}
          <div className="my-5 rounded-2xl bg-white border border-black/10 p-4 text-left space-y-2.5 shadow-sm text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-black/5">
              <span className="font-semibold text-neutral-500">Account Access:</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {completedOrder?.isNewAccount ? "New Account Created" : "Linked to Existing Account"}
              </span>
            </div>

            {completedOrder?.userName && (
              <div className="flex items-center justify-between pb-2 border-b border-black/5">
                <span className="text-neutral-500 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Customer Name:</span>
                </span>
                <span className="font-medium text-neutral-900">
                  {completedOrder.userName}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pb-2 border-b border-black/5">
              <span className="text-neutral-500 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-neutral-400" />
                <span>Mobile Login ID:</span>
              </span>
              <span className="font-mono font-bold text-neutral-900">
                +91 {completedOrder?.userPhone || guestMobile || userPhone}
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-black/5 bg-amber-50/70 -mx-4 px-4 py-2">
              <span className="text-amber-900 font-semibold flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                <span>Temporary Password:</span>
              </span>
              <span className="font-mono font-bold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300">
                {completedOrder?.userPhone || guestMobile || userPhone}
              </span>
            </div>

            {completedOrder?.userEmail && !completedOrder.userEmail.endsWith("@hiddenbooks.in") && (
              <div className="flex items-center justify-between pb-2 border-b border-black/5">
                <span className="text-neutral-500 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Email:</span>
                </span>
                <span className="font-medium text-neutral-800 truncate max-w-[180px]">
                  {completedOrder.userEmail}
                </span>
              </div>
            )}

            <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
              <span className="font-bold block mb-0.5">⚠️ Login Information:</span>
              Aapka temporary password aapka phone number (<strong className="font-mono font-bold">+91 {completedOrder?.userPhone || guestMobile || userPhone}</strong>) hai. Kripya user dashboard me jakar apna password change kar lein.
            </div>
          </div>

          {/* Navigation CTAs */}
          <div className="space-y-2.5">
            <Button
              onClick={handleReadNowClick}
              disabled={loading}
              size="lg"
              className="w-full h-12 rounded-full bg-[#111111] hover:bg-neutral-800 text-white font-bold text-sm shadow-md gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Redirecting to Dashboard...</span>
                </>
              ) : (
                <>
                  <span>Read Now in Library</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>

            <Button
              onClick={() => {
                window.location.href = "/account/library?setup_password=1"
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
    </div>
  )
}
