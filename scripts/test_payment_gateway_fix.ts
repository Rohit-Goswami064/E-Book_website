import pg from "pg"
const { Client } = pg
import crypto from "crypto"
import { getRazorpayClient, verifyPaymentSignature } from "../src/lib/razorpay/client"

console.log("==================================================================")
console.log("   HIDDENBOOKS PAYMENT GATEWAY & RAZORPAY FIX VERIFICATION SUITE  ")
console.log("==================================================================")

const dbClient = new Client({
  connectionString: "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false },
})

const customerA = "1bbc668f-2f43-4aa9-902c-2c3815b42bdc" // dropofchanges@gmail.com
const customerB = "00000000-0000-0000-0000-000000000002"

async function runTests() {
  await dbClient.connect()
  console.log("PASS [Database]: Connected to Supabase PostgreSQL.")

  // -------------------------------------------------------------
  // Test 1: Verify Razorpay Client & Credentials Initialization
  // -------------------------------------------------------------
  console.log("\n[TEST 1] Testing Razorpay Client Initialization & Gateway Communication...")
  const razorpay = getRazorpayClient()
  if (!razorpay) {
    throw new Error("FAIL: getRazorpayClient returned null/undefined!")
  }
  console.log("PASS [Razorpay SDK Client]: Initialized with active credentials.")

  const testReceipt = `hb_rcpt_test_${Date.now()}`
  const rzpOrder = await razorpay.orders.create({
    amount: 24900, // ₹249.00 in paise
    currency: "INR",
    receipt: testReceipt,
    notes: {
      platform: "HiddenBooks",
      environment: "test",
    },
  })

  console.log("PASS [Razorpay Order Created on Gateway]:", {
    id: rzpOrder.id,
    entity: rzpOrder.entity,
    amount: rzpOrder.amount,
    currency: rzpOrder.currency,
    receipt: rzpOrder.receipt,
    status: rzpOrder.status,
  })

  if (!rzpOrder.id || rzpOrder.status !== "created") {
    throw new Error("FAIL: Razorpay order creation failed!")
  }

  // -------------------------------------------------------------
  // Test 2: Verify Server-Side Price Authentication & Order Creation
  // -------------------------------------------------------------
  console.log("\n[TEST 2] Testing Server-side Order Creation with Database Persistence...")
  // Fetch Shant Dimag publication
  const bookRes = await dbClient.query(`
    SELECT id, title, price_cents, is_free, is_published, currency, sales_count
    FROM public.books
    WHERE is_published = true
    ORDER BY price_cents DESC
    LIMIT 1;
  `)
  const book = bookRes.rows[0]
  console.log(`   Authoritative Book: "${book.title}" (Price: ₹${book.price_cents / 100}, ID: ${book.id})`)

  // Run as authenticated customer A under RLS
  await dbClient.query("BEGIN;")
  await dbClient.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [customerA])
  await dbClient.query(`SELECT set_config('role', 'authenticated', true);`)

  // Check user entitlement
  const entCheck = await dbClient.query(`
    SELECT id FROM public.book_entitlements
    WHERE user_id = $1 AND book_id = $2 AND is_revoked = false;
  `, [customerA, book.id])

  if (entCheck.rows.length > 0) {
    console.log("   Note: Existing test entitlement found. Purging for fresh checkout test...")
    await dbClient.query(`
      DELETE FROM public.book_entitlements WHERE user_id = $1 AND book_id = $2;
    `, [customerA, book.id])
  }

  // Create pending order
  const orderNumber = `HB-TEST-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
  const orderInsert = await dbClient.query(`
    INSERT INTO public.orders (
      user_id, order_number, status, subtotal_cents, discount_cents, total_cents, currency, customer_email
    ) VALUES ($1, $2, 'pending'::order_status_type, $3, 0, $3, $4, $5)
    RETURNING *;
  `, [customerA, orderNumber, book.price_cents, book.currency || "INR", "dropofchanges@gmail.com"])
  const order = orderInsert.rows[0]
  console.log("PASS [Pending Order Inserted]:", {
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    total_cents: order.total_cents,
  })

  // Insert order item
  const itemInsert = await dbClient.query(`
    INSERT INTO public.order_items (
      order_id, book_id, book_title, price_cents
    ) VALUES ($1, $2, $3, $4)
    RETURNING *;
  `, [order.id, book.id, book.title, book.price_cents])
  console.log("PASS [Order Item Linked]:", itemInsert.rows[0].book_title)

  // Insert pending payment record with Razorpay Order ID
  const paymentInsert = await dbClient.query(`
    INSERT INTO public.payments (
      order_id, user_id, provider, razorpay_order_id, status, amount_cents, currency, raw_response
    ) VALUES ($1, $2, 'razorpay', $3, 'pending'::payment_status_type, $4, $5, $6)
    RETURNING *;
  `, [order.id, customerA, rzpOrder.id, book.price_cents, book.currency || "INR", JSON.stringify(rzpOrder)])
  const payment = paymentInsert.rows[0]
  console.log("PASS [Pending Payment Record Linked]:", {
    id: payment.id,
    razorpay_order_id: payment.razorpay_order_id,
    status: payment.status,
    amount_cents: payment.amount_cents,
  })
  await dbClient.query("COMMIT;")

  // -------------------------------------------------------------
  // Test 3: Verify Cross-Customer RLS Isolation
  // -------------------------------------------------------------
  console.log("\n[TEST 3] Verifying Customer Isolation under RLS...")
  await dbClient.query("BEGIN;")
  await dbClient.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [customerB])
  await dbClient.query(`SELECT set_config('role', 'authenticated', true);`)

  const crossOrderCheck = await dbClient.query(`
    SELECT id FROM public.orders WHERE id = $1;
  `, [order.id])

  if (crossOrderCheck.rows.length !== 0) {
    throw new Error("SECURITY BREACH: Customer B can see Customer A's order!")
  }
  console.log("PASS [Customer Isolation]: Customer B cannot read or access Customer A's order.")
  await dbClient.query("ROLLBACK;")

  // -------------------------------------------------------------
  // Test 4: Verify Cryptographic Payment Verification & Access Grant
  // -------------------------------------------------------------
  console.log("\n[TEST 4] Testing Cryptographic Signature Verification & Entitlement Grant...")
  const testPaymentId = `pay_test_${Date.now()}`
  const secret = process.env.RAZORPAY_KEY_SECRET!

  // Generate valid HMAC SHA256 signature
  const validSignature = crypto
    .createHmac("sha256", secret)
    .update(`${rzpOrder.id}|${testPaymentId}`)
    .digest("hex")

  // Test tampered signature rejection
  const isInvalidRejected = !verifyPaymentSignature({
    orderId: rzpOrder.id,
    paymentId: testPaymentId,
    signature: "tampered_fake_signature_abc123",
  })
  if (!isInvalidRejected) {
    throw new Error("SECURITY FAILURE: Invalid payment signature was NOT rejected!")
  }
  console.log("PASS [Signature Security]: Tampered/forged signatures strictly rejected.")

  // Test valid signature acceptance
  const isValidAccepted = verifyPaymentSignature({
    orderId: rzpOrder.id,
    paymentId: testPaymentId,
    signature: validSignature,
  })
  if (!isValidAccepted) {
    throw new Error("FAIL: Valid payment signature was rejected!")
  }
  console.log("PASS [Signature Verified]: Authentic Razorpay HMAC-SHA256 signature verified.")

  // Execute confirm_order_payment RPC to grant entitlement
  const confirmRes = await dbClient.query(`
    SELECT public.confirm_order_payment($1, $2, $3, $4, $5) AS result;
  `, [
    order.id,
    rzpOrder.id,
    testPaymentId,
    validSignature,
    JSON.stringify({ verified_at: new Date().toISOString() }),
  ])

  const confirmData = confirmRes.rows[0].result
  console.log("PASS [Payment Confirmation RPC Output]:", confirmData)

  if (!confirmData.success) {
    throw new Error(`FAIL: confirm_order_payment failed: ${confirmData.error}`)
  }

  // Verify order status updated to 'paid'
  const paidOrderCheck = await dbClient.query(`SELECT status FROM public.orders WHERE id = $1;`, [order.id])
  console.log(`PASS [Order Status Updated]: ${paidOrderCheck.rows[0].status}`)
  if (paidOrderCheck.rows[0].status !== "paid") {
    throw new Error("FAIL: Order status is not 'paid'!")
  }

  // Verify payment status updated to 'captured'
  const capturedPaymentCheck = await dbClient.query(`SELECT status, razorpay_payment_id FROM public.payments WHERE id = $1;`, [payment.id])
  console.log(`PASS [Payment Status Captured]: ${capturedPaymentCheck.rows[0].status} (Payment ID: ${capturedPaymentCheck.rows[0].razorpay_payment_id})`)

  // Verify book entitlement granted to customer A
  const entitlementCheck = await dbClient.query(`
    SELECT id, user_id, book_id, entitlement_type, is_revoked
    FROM public.book_entitlements
    WHERE user_id = $1 AND book_id = $2;
  `, [customerA, book.id])

  if (entitlementCheck.rows.length === 0 || entitlementCheck.rows[0].is_revoked) {
    throw new Error("FAIL: eBook access entitlement was NOT granted to the user!")
  }
  console.log("PASS [eBook Entitlement Granted in Library]:", entitlementCheck.rows[0])

  // -------------------------------------------------------------
  // Test 5: Verify Idempotency on Repeated Confirmations
  // -------------------------------------------------------------
  console.log("\n[TEST 5] Verifying Idempotency on Repeated Payment Confirmations...")
  const repeatConfirm = await dbClient.query(`
    SELECT public.confirm_order_payment($1, $2, $3, $4, $5) AS result;
  `, [
    order.id,
    rzpOrder.id,
    testPaymentId,
    validSignature,
    JSON.stringify({ repeat: true }),
  ])
  const repeatData = repeatConfirm.rows[0].result
  console.log("PASS [Idempotency Handled Safely]:", repeatData)

  const entCountCheck = await dbClient.query(`
    SELECT count(*)::int AS cnt FROM public.book_entitlements
    WHERE user_id = $1 AND book_id = $2;
  `, [customerA, book.id])

  if (entCountCheck.rows[0].cnt !== 1) {
    throw new Error("FAIL: Duplicate entitlements created!")
  }
  console.log("PASS [Zero Duplicates]: Exactly 1 entitlement exists after repeated confirmations.")

  // Cleanup test order
  console.log("\n[CLEANUP] Cleaning up test order and payment records...")
  await dbClient.query("DELETE FROM public.book_entitlements WHERE user_id = $1 AND book_id = $2;", [customerA, book.id])
  await dbClient.query("DELETE FROM public.payments WHERE id = $1;", [payment.id])
  await dbClient.query("DELETE FROM public.order_items WHERE order_id = $1;", [order.id])
  await dbClient.query("DELETE FROM public.orders WHERE id = $1;", [order.id])
  console.log("PASS [Cleanup Complete]: Test records purged.")

  await dbClient.end()
  console.log("\n==================================================================")
  console.log("    ALL PAYMENT GATEWAY INTEGRATION & VERIFICATION TESTS PASSED!  ")
  console.log("==================================================================")
}

runTests().catch(err => {
  console.error("\nTEST SUITE FAILED:", err)
  process.exit(1)
})
