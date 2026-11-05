import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"
import { getRazorpayClient } from "@/lib/razorpay/client"
import {
  checkCustomerAccount,
  verifyExistingUserPassword,
  updateCustomerPassword,
  provisionNewCustomer,
} from "@/lib/auth/checkout-customer"
import {
  normalizeIndianMobile,
  validatePasswordComplexity,
} from "@/lib/auth/mobile-normalizer"
import { z } from "zod"

export const dynamic = "force-dynamic"

const createOrderSchema = z.object({
  bookId: z.string().uuid("Invalid book identifier"),
  couponCode: z.string().optional().nullable(),
  guestDetails: z
    .object({
      fullName: z.string().min(2, "Please enter your full name (at least 2 characters)"),
      mobile: z.string().min(10, "Please enter a valid 10-digit mobile number"),
      email: z.string().email("Please provide a valid email address"),
      password: z.string().min(1, "Password is required"),
      confirmPassword: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createOrderSchema.safeParse(body)
    if (!parsed.success) {
      const errorMsg =
        parsed.error.issues?.[0]?.message || "Invalid order parameters"
      return NextResponse.json(
        { error: errorMsg, details: parsed.error.format() },
        { status: 400 }
      )
    }

    const { bookId, couponCode, guestDetails } = parsed.data
    const supabase = await createClient()

    // 1. Authoritative User Resolution & Account Authentication
    const user = await getCurrentUser()
    let resolvedUserId: string
    let customerEmail: string
    let customerName: string | null = null
    let customerPhone: string | null = null
    let isNewAccount = false

    if (user) {
      // Authenticated session user
      resolvedUserId = user.id
      customerEmail = user.email || ""
      customerName = user.user_metadata?.full_name || null
      customerPhone = user.user_metadata?.phone || null
      isNewAccount = false
    } else {
      // Instant Checkout Customer Flow
      if (!guestDetails) {
        return NextResponse.json(
          { error: "Customer details including mobile number, email, and password are required." },
          { status: 400 }
        )
      }

      // A. Normalize contact information
      const cleanMobile = normalizeIndianMobile(guestDetails.mobile)
      if (!cleanMobile) {
        return NextResponse.json(
          { error: "Please enter a valid 10-digit Indian mobile number." },
          { status: 400 }
        )
      }

      customerEmail = guestDetails.email.trim().toLowerCase()
      customerName = guestDetails.fullName.trim()
      customerPhone = cleanMobile

      // B. Authoritative check for existing accounts & account conflict detection
      const accountCheck = await checkCustomerAccount(customerEmail, cleanMobile)

      if (accountCheck.conflict) {
        return NextResponse.json(
          {
            error:
              accountCheck.conflictError ||
              "Account Conflict: The provided mobile number and email address belong to two different accounts. Please use matching credentials or sign in before checking out.",
            conflict: true,
          },
          { status: 400 }
        )
      }

      if (accountCheck.exists && accountCheck.userId) {
        // C. Existing Customer Workflow
        if (accountCheck.hasPassword) {
          // Require password verification for existing account ownership
          const isPasswordValid = await verifyExistingUserPassword(
            accountCheck.userId,
            guestDetails.password
          )

          if (!isPasswordValid) {
            return NextResponse.json(
              {
                error:
                  "Incorrect password for this account. Please enter your valid password to authenticate and link this purchase.",
                isExistingAccount: true,
              },
              { status: 401 }
            )
          }

          resolvedUserId = accountCheck.userId
          customerEmail = accountCheck.email || customerEmail
          customerPhone = accountCheck.phone || cleanMobile
          customerName = customerName || accountCheck.fullName || "Customer"
          isNewAccount = false
        } else {
          // Legacy account without password: Set password securely
          const complexity = validatePasswordComplexity(guestDetails.password)
          if (!complexity.valid) {
            return NextResponse.json(
              { error: complexity.errors[0], details: complexity.errors },
              { status: 400 }
            )
          }

          if (
            guestDetails.confirmPassword &&
            guestDetails.password !== guestDetails.confirmPassword
          ) {
            return NextResponse.json(
              { error: "Password and Confirm Password do not match." },
              { status: 400 }
            )
          }

          await updateCustomerPassword(accountCheck.userId, guestDetails.password)
          resolvedUserId = accountCheck.userId
          customerEmail = accountCheck.email || customerEmail
          customerPhone = accountCheck.phone || cleanMobile
          customerName = customerName || accountCheck.fullName || "Customer"
          isNewAccount = false
        }
      } else {
        // D. New Customer Workflow: Validate complexity & confirm match
        const complexity = validatePasswordComplexity(guestDetails.password)
        if (!complexity.valid) {
          return NextResponse.json(
            { error: complexity.errors[0], details: complexity.errors },
            { status: 400 }
          )
        }

        if (guestDetails.password !== guestDetails.confirmPassword) {
          return NextResponse.json(
            { error: "Password and Confirm Password do not match. Please re-enter your confirm password." },
            { status: 400 }
          )
        }

        // Provision new customer in auth.users with bcrypt blowfish hash
        const newCustomer = await provisionNewCustomer({
          email: customerEmail,
          phone: cleanMobile,
          fullName: customerName,
          password: guestDetails.password,
        })

        resolvedUserId = newCustomer.userId
        isNewAccount = true
        customerEmail = newCustomer.email
        customerPhone = newCustomer.phone
      }
    }

    // 2. Fetch authoritative book record from database
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("id, title, price_cents, is_free, is_published, currency")
      .eq("id", bookId)
      .maybeSingle()

    if (bookError || !book) {
      return NextResponse.json({ error: "Book not found." }, { status: 404 })
    }

    if (!book.is_published) {
      return NextResponse.json({ error: "This book is not currently published." }, { status: 400 })
    }

    // 3. Verify user doesn't already own the book
    const { data: existingEntitlement } = await supabase
      .from("book_entitlements")
      .select("id")
      .eq("user_id", resolvedUserId)
      .eq("book_id", bookId)
      .eq("is_revoked", false)
      .maybeSingle()

    if (existingEntitlement) {
      return NextResponse.json(
        {
          error: "You already own this book in your library. Sign in to read anytime.",
          alreadyOwned: true,
        },
        { status: 400 }
      )
    }

    // 4. Calculate Authoritative Price & Validate Coupon on Server
    let subtotalCents = book.price_cents
    let discountCents = 0
    let validCouponId: string | null = null

    if (couponCode && couponCode.trim()) {
      const cleanCode = couponCode.trim().toUpperCase()
      const { data: coupon } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", cleanCode)
        .eq("is_active", true)
        .maybeSingle()

      if (!coupon) {
        return NextResponse.json(
          { error: `Coupon code "${cleanCode}" is invalid.` },
          { status: 400 }
        )
      }

      const notExpired = !coupon.expires_at || new Date(coupon.expires_at) > new Date()
      if (!notExpired) {
        return NextResponse.json(
          { error: `Coupon "${cleanCode}" has expired.` },
          { status: 400 }
        )
      }

      const withinLimits = !coupon.max_redemptions || coupon.current_redemptions < coupon.max_redemptions
      if (!withinLimits) {
        return NextResponse.json(
          { error: `Coupon "${cleanCode}" usage limit reached.` },
          { status: 400 }
        )
      }

      const meetsMinOrder = subtotalCents >= (coupon.min_order_cents || 0)
      if (!meetsMinOrder) {
        return NextResponse.json(
          { error: `Minimum order amount of ₹${((coupon.min_order_cents || 0) / 100).toFixed(0)} required for this coupon.` },
          { status: 400 }
        )
      }

      validCouponId = coupon.id
      if (coupon.discount_type === "percent") {
        discountCents = Math.round((subtotalCents * coupon.discount_value) / 100)
        if (coupon.max_discount_cents && discountCents > coupon.max_discount_cents) {
          discountCents = coupon.max_discount_cents
        }
      } else {
        discountCents = coupon.discount_value
      }
      discountCents = Math.min(discountCents, subtotalCents)
    }

    const finalAmountCents = book.is_free ? 0 : Math.max(0, subtotalCents - discountCents)
    const orderNumber = `HB-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`

    // 5. Handle 100% Free Book Acquisition or 100% Discounted Order
    if (finalAmountCents === 0 || book.is_free) {
      const { data: orderRes, error: orderRpcErr } = await supabase.rpc("create_checkout_order", {
        p_user_id: resolvedUserId,
        p_book_id: book.id,
        p_order_number: orderNumber,
        p_subtotal_cents: subtotalCents,
        p_discount_cents: discountCents,
        p_total_cents: 0,
        p_currency: book.currency || "INR",
        p_coupon_id: validCouponId,
        p_customer_email: customerEmail,
        p_customer_name: customerName,
        p_customer_phone: customerPhone,
        p_metadata: {
          book_id: book.id,
          book_title: book.title,
          is_free_acquisition: true,
          is_guest_checkout: !user,
          is_new_account: isNewAccount,
          customer_phone: customerPhone,
        },
      })

      if (orderRpcErr || !orderRes?.order_id) {
        throw new Error(`Failed to create free order: ${orderRpcErr?.message}`)
      }

      // Mark order paid immediately and grant entitlement
      await supabase.from("orders").update({ status: "paid" }).eq("id", orderRes.order_id)
      await supabase.from("book_entitlements").insert({
        user_id: resolvedUserId,
        book_id: book.id,
        order_id: orderRes.order_id,
        entitlement_type: book.is_free ? "free_claim" : "coupon_claim",
        is_revoked: false,
      })

      if (validCouponId) {
        try {
          await supabase.rpc("increment_coupon_redemption", { p_coupon_id: validCouponId })
        } catch {}
      }

      return NextResponse.json({
        isFree: true,
        orderId: orderRes.order_id,
        orderNumber: orderNumber,
        message: "Book successfully added to your library!",
        isNewAccount,
        isGuestCheckout: !user,
        email: customerEmail,
        userEmail: customerEmail,
        userPhone: customerPhone,
        bookId: book.id,
      })
    }

    // 6. Create internal pending order via atomic RPC
    const { data: orderRes, error: orderRpcErr } = await supabase.rpc("create_checkout_order", {
      p_user_id: resolvedUserId,
      p_book_id: book.id,
      p_order_number: orderNumber,
      p_subtotal_cents: subtotalCents,
      p_discount_cents: discountCents,
      p_total_cents: finalAmountCents,
      p_currency: book.currency || "INR",
      p_coupon_id: validCouponId,
      p_customer_email: customerEmail,
      p_customer_name: customerName,
      p_customer_phone: customerPhone,
      p_metadata: {
        book_id: book.id,
        book_title: book.title,
        is_guest_checkout: !user,
        is_new_account: isNewAccount,
        customer_phone: customerPhone,
      },
    })

    if (orderRpcErr || !orderRes?.order_id) {
      throw new Error(`Failed to create database order: ${orderRpcErr?.message}`)
    }

    const orderId = orderRes.order_id

    // 7. Create Razorpay order using verified server-side amount in paise
    let rzpOrder: any
    try {
      const razorpay = getRazorpayClient()
      rzpOrder = await razorpay.orders.create({
        amount: finalAmountCents, // amount in paise e.g. 24900 for ₹249
        currency: book.currency || "INR",
        receipt: orderNumber,
        notes: {
          order_id: orderId,
          user_id: resolvedUserId,
          book_id: book.id,
          is_guest: !user ? "true" : "false",
        },
      })
    } catch (rzpErr: any) {
      console.error("[Razorpay Order Creation Error]:", rzpErr)
      await supabase.from("orders").update({ status: "cancelled" }).eq("id", orderId)
      const errorMsg =
        rzpErr?.error?.description ||
        rzpErr?.message ||
        "Payment gateway initialization failed. Please retry in a moment."
      return NextResponse.json({ error: errorMsg }, { status: 502 })
    }

    // 8. Store Razorpay order in payments table via secure RPC
    const { error: paymentError } = await supabase.rpc("record_pending_payment", {
      p_order_id: orderId,
      p_user_id: resolvedUserId,
      p_razorpay_order_id: rzpOrder.id,
      p_amount_cents: finalAmountCents,
      p_currency: book.currency || "INR",
      p_raw_response: rzpOrder as any,
    })

    if (paymentError) {
      await supabase.from("orders").update({ status: "cancelled" }).eq("id", orderId)
      throw new Error(`Failed to record payment pending state: ${paymentError.message}`)
    }

    // 9. Return required frontend checkout fields (Never exposing passwords)
    const activeKeyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    return NextResponse.json({
      isFree: false,
      razorpayOrderId: rzpOrder.id,
      orderNumber: orderNumber,
      amountCents: finalAmountCents,
      currency: book.currency || "INR",
      keyId: activeKeyId,
      bookTitle: book.title,
      isNewAccount,
      userEmail: customerEmail,
      userName: customerName,
      userPhone: customerPhone,
    })
  } catch (error: any) {
    console.error("[Checkout Order Creation Error]:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error creating order" },
      { status: 500 }
    )
  }
}
