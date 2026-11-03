import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { formatCurrency } from "../src/lib/utils"

interface CouponCalculationInput {
  subtotalCents: number
  coupon: {
    code: string
    discount_type: "percent" | "fixed"
    discount_value: number
    min_order_amount_cents: number
    max_uses: number | null
    current_redemptions: number
    expires_at: string | null
    is_active: boolean
  }
}

function calculateDiscount({ subtotalCents, coupon }: CouponCalculationInput): {
  valid: boolean
  error?: string
  discountCents: number
  finalTotalCents: number
} {
  if (!coupon.is_active) {
    return { valid: false, error: "Coupon is inactive", discountCents: 0, finalTotalCents: subtotalCents }
  }

  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { valid: false, error: "Coupon has expired", discountCents: 0, finalTotalCents: subtotalCents }
  }

  if (coupon.max_uses !== null && coupon.current_redemptions >= coupon.max_uses) {
    return { valid: false, error: "Coupon usage limit reached", discountCents: 0, finalTotalCents: subtotalCents }
  }

  if (subtotalCents < coupon.min_order_amount_cents) {
    return {
      valid: false,
      error: `Minimum order amount of ${formatCurrency(coupon.min_order_amount_cents, "INR")} required`,
      discountCents: 0,
      finalTotalCents: subtotalCents,
    }
  }

  let discountCents = 0
  if (coupon.discount_type === "percent") {
    discountCents = Math.round((subtotalCents * coupon.discount_value) / 100)
  } else {
    discountCents = coupon.discount_value
  }

  discountCents = Math.min(discountCents, subtotalCents)
  const finalTotalCents = Math.max(0, subtotalCents - discountCents)

  return { valid: true, discountCents, finalTotalCents }
}

describe("Commerce, Coupons & Minor Unit Currency", () => {
  it("formats integer minor units (paise) correctly into INR rupees", () => {
    assert.equal(formatCurrency(49900, "INR"), "₹499")
    assert.equal(formatCurrency(0, "INR"), "₹0")
    assert.equal(formatCurrency(19950, "INR"), "₹199.50")
  })

  it("calculates percentage coupon discount correctly without floating point errors", () => {
    // 20% off 49900 paise = 9980 paise discount, final 39920 paise
    const res = calculateDiscount({
      subtotalCents: 49900,
      coupon: {
        code: "READ20",
        discount_type: "percent",
        discount_value: 20,
        min_order_amount_cents: 0,
        max_uses: null,
        current_redemptions: 5,
        expires_at: null,
        is_active: true,
      },
    })

    assert.equal(res.valid, true)
    assert.equal(res.discountCents, 9980)
    assert.equal(res.finalTotalCents, 39920)
  })

  it("calculates fixed amount coupon discount correctly", () => {
    // ₹100 fixed off (10000 paise) on ₹499 (49900 paise) = 39900 paise
    const res = calculateDiscount({
      subtotalCents: 49900,
      coupon: {
        code: "SAVE100",
        discount_type: "fixed",
        discount_value: 10000,
        min_order_amount_cents: 29900,
        max_uses: 100,
        current_redemptions: 12,
        expires_at: null,
        is_active: true,
      },
    })

    assert.equal(res.valid, true)
    assert.equal(res.discountCents, 10000)
    assert.equal(res.finalTotalCents, 39900)
  })

  it("rejects coupon when minimum order requirement is not met", () => {
    const res = calculateDiscount({
      subtotalCents: 19900, // ₹199
      coupon: {
        code: "VIP500",
        discount_type: "fixed",
        discount_value: 10000,
        min_order_amount_cents: 49900, // Minimum ₹499 required
        max_uses: null,
        current_redemptions: 0,
        expires_at: null,
        is_active: true,
      },
    })

    assert.equal(res.valid, false)
    assert.match(res.error || "", /Minimum order amount/)
    assert.equal(res.finalTotalCents, 19900)
  })

  it("rejects expired coupon", () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const res = calculateDiscount({
      subtotalCents: 49900,
      coupon: {
        code: "EXPIRED",
        discount_type: "percent",
        discount_value: 50,
        min_order_amount_cents: 0,
        max_uses: null,
        current_redemptions: 0,
        expires_at: pastDate,
        is_active: true,
      },
    })

    assert.equal(res.valid, false)
    assert.equal(res.error, "Coupon has expired")
  })

  it("rejects coupon when max usage limit is exhausted", () => {
    const res = calculateDiscount({
      subtotalCents: 49900,
      coupon: {
        code: "FIRST50",
        discount_type: "percent",
        discount_value: 50,
        min_order_amount_cents: 0,
        max_uses: 50,
        current_redemptions: 50, // exhausted
        expires_at: null,
        is_active: true,
      },
    })

    assert.equal(res.valid, false)
    assert.equal(res.error, "Coupon usage limit reached")
  })
})
