import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

export const dynamic = "force-dynamic"

const validateCouponSchema = z.object({
  code: z.string().min(1),
  bookId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = validateCouponSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid coupon request. Please provide code and book ID." },
        { status: 400 }
      )
    }

    const { code, bookId } = parsed.data
    const cleanCode = code.trim().toUpperCase()
    const supabase = await createClient()

    // 1. Fetch book details for base price calculation
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("id, title, price_cents, is_free, currency")
      .eq("id", bookId)
      .maybeSingle()

    if (bookError || !book) {
      return NextResponse.json({ error: "Book not found." }, { status: 404 })
    }

    if (book.is_free || book.price_cents === 0) {
      return NextResponse.json(
        { error: "Coupons cannot be applied to free books." },
        { status: 400 }
      )
    }

    // 2. Fetch coupon
    const { data: coupon, error: couponError } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", cleanCode)
      .eq("is_active", true)
      .maybeSingle()

    if (couponError || !coupon) {
      return NextResponse.json(
        { error: `Coupon "${cleanCode}" is invalid or does not exist.` },
        { status: 404 }
      )
    }

    // 3. Validation checks
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return NextResponse.json(
        { error: `Coupon "${cleanCode}" has expired.` },
        { status: 400 }
      )
    }

    if (
      coupon.max_redemptions !== null &&
      coupon.current_redemptions >= coupon.max_redemptions
    ) {
      return NextResponse.json(
        { error: `Coupon "${cleanCode}" redemption limit has been reached.` },
        { status: 400 }
      )
    }

    if (book.price_cents < (coupon.min_order_cents || 0)) {
      const minAmount = (coupon.min_order_cents / 100).toFixed(0)
      return NextResponse.json(
        {
          error: `Minimum book price of ₹${minAmount} required to use coupon "${cleanCode}".`,
        },
        { status: 400 }
      )
    }

    // 4. Calculate discount
    let discountCents = 0
    if (coupon.discount_type === "percent") {
      discountCents = Math.round((book.price_cents * coupon.discount_value) / 100)
      if (coupon.max_discount_cents && discountCents > coupon.max_discount_cents) {
        discountCents = coupon.max_discount_cents
      }
    } else {
      discountCents = coupon.discount_value
    }

    discountCents = Math.min(discountCents, book.price_cents)
    const finalPriceCents = Math.max(0, book.price_cents - discountCents)

    return NextResponse.json({
      valid: true,
      code: cleanCode,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      discountCents,
      finalPriceCents,
      savingsFormatted: `₹${(discountCents / 100).toFixed(0)}`,
      message: `Coupon "${cleanCode}" applied successfully! You save ₹${(
        discountCents / 100
      ).toFixed(0)}.`,
    })
  } catch (error: any) {
    console.error("[Validate Coupon Error]:", error)
    return NextResponse.json(
      { error: "Failed to validate coupon code." },
      { status: 500 }
    )
  }
}
