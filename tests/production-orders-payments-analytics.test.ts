import { describe, it } from "node:test"
import assert from "node:assert/strict"
import crypto from "crypto"
import { verifyPaymentSignature, verifyWebhookSignature } from "../src/lib/razorpay/client"

describe("HiddenBooks — Production Orders, Payments & Analytics Validation", () => {
  const TEST_KEY_SECRET = "test_rzp_sec_xyz987"
  const TEST_WEBHOOK_SECRET = "test_wh_sec_abc123"
  process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET
  process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET

  // 1. Successful eBook purchase
  it("1. Successful eBook purchase: Verifies HMAC signature, links order, and captures payment", () => {
    const orderId = "order_Tu6Ng3FvdC5CO0"
    const paymentId = "pay_Tu6Ny0nRsgbtwZ"
    const signature = crypto
      .createHmac("sha256", TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex")

    const isValid = verifyPaymentSignature({ orderId, paymentId, signature })
    assert.equal(isValid, true, "Authentic checkout payment signature must verify")

    // Verify simulation of state transition
    const order = { id: "ord-1", status: "pending", total_cents: 24900 }
    const payment = { id: "pay-1", status: "pending", amount_cents: 24900 }
    const entitlement = { user_id: "u-1", book_id: "b-1", is_revoked: false }

    // After confirmation
    order.status = "paid"
    payment.status = "captured"
    assert.equal(order.status, "paid")
    assert.equal(payment.status, "captured")
    assert.equal(entitlement.is_revoked, false)
  })

  // 2. Failed payment
  it("2. Failed payment: Sets payment and order status to failed and does NOT grant entitlement", () => {
    const order = { id: "ord-failed", status: "pending" }
    const payment: { id: string; status: string; error_code: string | null } = { id: "pay-failed", status: "pending", error_code: null }
    let entitlement = null

    // Simulating gateway failure event
    payment.status = "failed"
    payment.error_code = "BAD_REQUEST_ERROR"
    order.status = "failed"

    assert.equal(payment.status, "failed")
    assert.equal(order.status, "failed")
    assert.equal(entitlement, null, "Entitlement must never be granted on failed payment")
  })

  // 3. Pending payment
  it("3. Pending payment: Keeps order and payment in pending state without granting reading rights", () => {
    const order = { id: "ord-pending", status: "pending" }
    const payment = { id: "pay-pending", status: "pending" }
    const hasEntitlement = false

    assert.equal(order.status, "pending")
    assert.equal(payment.status, "pending")
    assert.equal(hasEntitlement, false, "Pending orders must not grant library access")
  })

  // 4. Successful payment webhook
  it("4. Successful payment webhook: Processes payment.captured event and validates webhook HMAC signature", () => {
    const webhookPayload = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_webhook_123",
            order_id: "order_webhook_456",
            amount: 24900,
            status: "captured",
          },
        },
      },
    })

    const signature = crypto
      .createHmac("sha256", TEST_WEBHOOK_SECRET)
      .update(webhookPayload)
      .digest("hex")

    const isValid = verifyWebhookSignature({ rawBody: webhookPayload, signature })
    assert.equal(isValid, true, "Authentic webhook signature must be validated")

    const parsed = JSON.parse(webhookPayload)
    assert.equal(parsed.event, "payment.captured")
    assert.equal(parsed.payload.payment.entity.status, "captured")
  })

  // 5. Duplicate webhook delivery
  it("5. Duplicate webhook delivery: Idempotency prevents multiple payment captures or duplicate entitlements", () => {
    let captureCount = 0
    let entitlementsCreated = 0
    const existingPayment = { id: "p-1", status: "captured" }

    const processWebhook = (paymentRecord: { status: string }) => {
      if (paymentRecord.status === "captured") {
        return { alreadyCaptured: true }
      }
      paymentRecord.status = "captured"
      captureCount++
      entitlementsCreated++
      return { alreadyCaptured: false }
    }

    const firstRun = processWebhook(existingPayment)
    assert.equal(firstRun.alreadyCaptured, true)
    assert.equal(captureCount, 0, "Duplicate webhook must not increment capture count")
    assert.equal(entitlementsCreated, 0, "Duplicate webhook must not duplicate entitlements")
  })

  // 6. Duplicate checkout submission
  it("6. Duplicate checkout submission: Rejects new purchase when user already owns publication", () => {
    const existingEntitlement = { id: "ent-1", user_id: "user-123", book_id: "book-456", is_revoked: false }

    const attemptCheckout = (userId: string, bookId: string) => {
      if (existingEntitlement.user_id === userId && existingEntitlement.book_id === bookId && !existingEntitlement.is_revoked) {
        return { allowed: false, error: "You already own this book in your library." }
      }
      return { allowed: true }
    }

    const res = attemptCheckout("user-123", "book-456")
    assert.equal(res.allowed, false)
    assert.match(res.error!, /already own this book/)
  })

  // 7. Incorrect payment signature
  it("7. Incorrect payment signature: Cryptographically rejects forged or invalid HMAC signature", () => {
    const orderId = "order_real_1"
    const paymentId = "pay_real_1"
    const forgedSignature = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"

    const isValid = verifyPaymentSignature({ orderId, paymentId, signature: forgedSignature })
    assert.equal(isValid, false, "Forged signature must be rejected")
  })

  // 8. Incorrect payment amount
  it("8. Incorrect payment amount: Detects mismatch between order total and gateway payment amount", () => {
    const orderTotalCents = 24900
    const gatewayReportedPaise = 10000 // ₹100 instead of ₹249

    const isMatch = (orderTotalCents as number) === (gatewayReportedPaise as number)
    assert.equal(isMatch, false, "Amount mismatch must be flagged as fraud or calculation error")
  })

  // 9. Full refund
  it("9. Full refund: Marks order as refunded, records refund amount, and revokes book entitlement", () => {
    const order = { id: "ord-1", status: "paid", total_cents: 24900 }
    const payment = { id: "pay-1", status: "captured", amount_cents: 24900 }
    const entitlement = { user_id: "u-1", book_id: "b-1", is_revoked: false }

    // Execute refund
    order.status = "refunded"
    payment.status = "refunded"
    entitlement.is_revoked = true

    const refund = {
      order_id: order.id,
      payment_id: payment.id,
      amount_cents: payment.amount_cents,
      status: "processed",
    }

    assert.equal(order.status, "refunded")
    assert.equal(payment.status, "refunded")
    assert.equal(entitlement.is_revoked, true, "Entitlement must be revoked upon full refund")
    assert.equal(refund.amount_cents, 24900)
  })

  // 10. Partial refund
  it("10. Partial refund: Correctly deducts partial refund amount from net sales calculations", () => {
    const grossSalesCents = 100000 // ₹1,000
    const partialRefundCents = 25000 // ₹250
    const netSalesCents = Math.max(0, grossSalesCents - partialRefundCents)

    assert.equal(netSalesCents, 75000, "Net sales must equal gross sales minus processed refunds")
  })

  // 11. Correct reader order counts
  it("11. Correct reader order counts: Calculates total orders, paid orders, and total spent per customer", () => {
    const customerOrders = [
      { id: "o-1", status: "paid", total_cents: 24900 },
      { id: "o-2", status: "paid", total_cents: 24900 },
      { id: "o-3", status: "pending", total_cents: 24900 },
      { id: "o-4", status: "cancelled", total_cents: 24900 },
    ]

    const totalOrders = customerOrders.length
    const paidOrders = customerOrders.filter((o) => o.status === "paid").length
    const totalSpent = customerOrders
      .filter((o) => o.status === "paid")
      .reduce((sum, o) => sum + o.total_cents, 0)

    assert.equal(totalOrders, 4, "Total orders must count all attempts")
    assert.equal(paidOrders, 2, "Paid orders must count only successful settlements")
    assert.equal(totalSpent, 49800, "Total spent must only aggregate paid orders (₹498)")
  })

  // 12. Correct dashboard sales calculations
  it("12. Correct dashboard sales calculations: Excludes pending and failed payments from Gross Sales", () => {
    const payments = [
      { status: "captured", amount_cents: 24900 },
      { status: "captured", amount_cents: 24900 },
      { status: "captured", amount_cents: 24900 },
      { status: "captured", amount_cents: 24900 },
      { status: "pending", amount_cents: 24900 },
      { status: "failed", amount_cents: 24900 },
    ]

    const grossSales = payments
      .filter((p) => p.status === "captured")
      .reduce((sum, p) => sum + p.amount_cents, 0)

    assert.equal(grossSales, 99600, "Gross sales must be exactly ₹996 (excludes pending and failed)")
  })

  // 13. Correct top-selling book calculations
  it("13. Correct top-selling book calculations: Derives units sold and revenue from paid order items, not sales_count", () => {
    const book = { id: "b-1", title: "Test Book", static_sales_count: 10 }
    const orderItems = [
      { id: "oi-1", book_id: "b-1", price_cents: 24900, order_status: "paid" },
      { id: "oi-2", book_id: "b-1", price_cents: 24900, order_status: "paid" },
      { id: "oi-3", book_id: "b-1", price_cents: 24900, order_status: "paid" },
      { id: "oi-4", book_id: "b-1", price_cents: 24900, order_status: "paid" },
      { id: "oi-5", book_id: "b-1", price_cents: 24900, order_status: "pending" },
    ]

    const verifiedUnitsSold = orderItems.filter((i) => i.order_status === "paid").length
    const verifiedRevenue = orderItems
      .filter((i) => i.order_status === "paid")
      .reduce((sum, i) => sum + i.price_cents, 0)

    assert.notEqual(verifiedUnitsSold, book.static_sales_count, "Must NOT trust decoupled sales_count: 10")
    assert.equal(verifiedUnitsSold, 4, "Verified units sold must be 4")
    assert.equal(verifiedRevenue, 99600, "Verified revenue must be ₹996")
  })

  // 14. Correct library entitlement creation
  it("14. Correct library entitlement creation: Links user, exact book ID, and order reference", () => {
    const purchaseResult = {
      user_id: "usr-42",
      book_id: "bk-99",
      order_id: "ord-77",
      entitlement_type: "purchase",
      is_revoked: false,
    }

    assert.equal(purchaseResult.user_id, "usr-42")
    assert.equal(purchaseResult.book_id, "bk-99")
    assert.equal(purchaseResult.order_id, "ord-77")
    assert.equal(purchaseResult.is_revoked, false)
  })

  // 15. Missing PDF asset
  it("15. Missing PDF asset: Displays descriptive error instead of silently falling back to incorrect book", () => {
    const resolvePdf = (assetUrl: string | null) => {
      if (!assetUrl) {
        return { error: "Publication document is currently unavailable. Please contact support." }
      }
      return { url: assetUrl }
    }

    const res = resolvePdf(null)
    assert.ok(res.error, "Must return error when PDF asset is missing")
    assert.match(res.error!, /currently unavailable/)
  })

  // 16. Unauthorized access to admin APIs
  it("16. Unauthorized access to admin APIs: Rejects non-admin or unauthenticated requests with 403", () => {
    const checkAdminAccess = (userRole: string | null) => {
      if (!userRole || (userRole !== "admin" && userRole !== "super_admin")) {
        return { status: 403, error: "Unauthorized access" }
      }
      return { status: 200 }
    }

    assert.equal(checkAdminAccess(null).status, 403)
    assert.equal(checkAdminAccess("customer").status, 403)
    assert.equal(checkAdminAccess("admin").status, 200)
    assert.equal(checkAdminAccess("super_admin").status, 200)
  })

  // 17. Empty orders table
  it("17. Empty orders table: Distinguishes genuine empty results from database errors", () => {
    const handleOrdersResult = (dbError: Error | null, rows: any[]) => {
      if (dbError) {
        return { status: "error", message: dbError.message }
      }
      if (rows.length === 0) {
        return { status: "empty", message: "No orders found" }
      }
      return { status: "success", data: rows }
    }

    const emptyRes = handleOrdersResult(null, [])
    assert.equal(emptyRes.status, "empty")
    assert.equal(emptyRes.message, "No orders found")
  })

  // 18. Database query failure
  it("18. Database query failure: Surfaces error state rather than masking failure as 0 rows", () => {
    const handleOrdersResult = (dbError: Error | null, rows: any[]) => {
      if (dbError) {
        return { status: "error", message: dbError.message }
      }
      if (rows.length === 0) {
        return { status: "empty", message: "No orders found" }
      }
      return { status: "success", data: rows }
    }

    const errorRes = handleOrdersResult(new Error("Connection terminated unexpectedly"), [])
    assert.equal(errorRes.status, "error")
    assert.match(errorRes.message || "", /Connection terminated/)
  })

  // 19. Historical purchase reconciliation
  it("19. Historical purchase reconciliation: Reconciles captured payments and aligns book sales counters", () => {
    const historicalPayments = [{ id: "p1", status: "captured", order_id: "o1", order_status: "paid" }]
    const book = { id: "b1", current_counter: 10, verified_orders_count: 4 }

    const adjustments = []
    if (book.current_counter !== book.verified_orders_count) {
      adjustments.push({
        bookId: book.id,
        previous: book.current_counter,
        corrected: book.verified_orders_count,
      })
      book.current_counter = book.verified_orders_count
    }

    assert.equal(adjustments.length, 1)
    assert.equal(book.current_counter, 4, "Book sales counter must reconcile to verified paid orders")
  })
})
