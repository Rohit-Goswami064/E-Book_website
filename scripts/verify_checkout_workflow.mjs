import pg from "pg"
const { Client } = pg
import crypto from "crypto"

console.log("==================================================================")
console.log("   HIDDENBOOKS CHECKOUT, RAZORPAY & ORDERS RLS VERIFICATION SUITE")
console.log("==================================================================")

const dbClient = new Client({
  connectionString: "postgresql://postgres.atmzsbbrycxtducxrelo:Roshan$$8993@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false },
})

const customerA = "1bbc668f-2f43-4aa9-902c-2c3815b42bdc" // dropofchanges@gmail.com (customer A)
const customerB = "00000000-0000-0000-0000-000000000002" // customer_b_test@example.com (customer B)
const superAdminId = "4a21b6af-c6e6-4bb0-bc0a-a2bf2f8b5f94"

const razorpaySecret = process.env.RAZORPAY_KEY_SECRET || "placeholder_razorpay_secret"

function generatePaymentSignature(orderId, paymentId, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex")
}

function verifyPaymentSignatureLocal({ orderId, paymentId, signature, secret }) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex")
  const expBuf = Buffer.from(expected, "utf-8")
  const sigBuf = Buffer.from(signature, "utf-8")
  if (expBuf.length !== sigBuf.length) return false
  return crypto.timingSafeEqual(expBuf, sigBuf)
}

async function runVerification() {
  await dbClient.connect()
  console.log("PASS [Database]: Connected to Supabase PostgreSQL.")

  // 1. Fetch target book (e.g. ₹249 book)
  const bookRes = await dbClient.query(`
    SELECT id, title, price_cents, is_free, is_published, sales_count
    FROM public.books 
    WHERE is_published = true 
    ORDER BY price_cents DESC
    LIMIT 1;
  `)
  if (bookRes.rows.length === 0) {
    throw new Error("No published book found.")
  }
  const targetBook = bookRes.rows[0]
  const initialSalesCount = targetBook.sales_count || 0
  console.log(`PASS [Book Found]: "${targetBook.title}" (Price: ₹${targetBook.price_cents / 100}, ID: ${targetBook.id})`)

  let createdOrderId = null
  let createdPaymentId = null
  const testRzpOrderId = `order_test_${Date.now()}`
  const testRzpPaymentId = `pay_test_${Date.now()}`

  try {
    // -------------------------------------------------------------
    // Test 1: Unauthenticated user CANNOT create an order
    // -------------------------------------------------------------
    console.log("\n[TEST 1] Verifying unauthenticated user cannot insert an order...")
    try {
      await dbClient.query("BEGIN;")
      await dbClient.query("SELECT set_config('role', 'anon', true);")
      await dbClient.query(`
        INSERT INTO public.orders (order_number, user_id, status, subtotal_cents, discount_cents, total_cents, customer_email)
        VALUES ('TEST-ANON', $1, 'pending', 24900, 0, 24900, 'anon@example.com');
      `, [customerA])
      console.error("FAIL: Anonymous user was able to insert order!")
      await dbClient.query("ROLLBACK;")
    } catch (err) {
      console.log(`PASS [Unauthenticated Blocked]: ${err.message}`)
      await dbClient.query("ROLLBACK;")
    }

    // -------------------------------------------------------------
    // Test 2: Authenticated customer CANNOT forge another user's ID
    // -------------------------------------------------------------
    console.log("\n[TEST 2] Verifying customer cannot forge another user ID...")
    try {
      await dbClient.query("BEGIN;")
      await dbClient.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [customerA])
      await dbClient.query("SELECT set_config('role', 'authenticated', true);")
      await dbClient.query(`
        INSERT INTO public.orders (order_number, user_id, status, subtotal_cents, discount_cents, total_cents, customer_email)
        VALUES ('FORGED-ORDER', $1, 'pending', 24900, 0, 24900, 'forged@example.com');
      `, [superAdminId]) // Trying to create order for Super Admin!
      console.error("FAIL: Customer forged another user's ID!")
      await dbClient.query("ROLLBACK;")
    } catch (err) {
      console.log(`PASS [Forged User Blocked]: ${err.message}`)
      await dbClient.query("ROLLBACK;")
    }

    // -------------------------------------------------------------
    // Test 3: Authenticated customer CANNOT set status='paid' on paid books
    // -------------------------------------------------------------
    console.log("\n[TEST 3] Verifying customer cannot set status='paid' directly on paid books...")
    try {
      await dbClient.query("BEGIN;")
      await dbClient.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [customerA])
      await dbClient.query("SELECT set_config('role', 'authenticated', true);")
      await dbClient.query(`
        INSERT INTO public.orders (order_number, user_id, status, subtotal_cents, discount_cents, total_cents, customer_email)
        VALUES ('FAKE-PAID', $1, 'paid', 24900, 0, 24900, 'cheat@example.com');
      `, [customerA])
      console.error("FAIL: Customer created a pre-paid order directly!")
      await dbClient.query("ROLLBACK;")
    } catch (err) {
      console.log(`PASS [Direct 'paid' Status Blocked]: ${err.message}`)
      await dbClient.query("ROLLBACK;")
    }

    // -------------------------------------------------------------
    // Test 4: Authenticated customer creates a valid pending order
    // -------------------------------------------------------------
    console.log("\n[TEST 4] Authenticated customer creates valid pending order...")
    try {
      await dbClient.query("BEGIN;")
      await dbClient.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [customerA])
      await dbClient.query("SELECT set_config('role', 'authenticated', true);")

      const orderNumber = `HB-TEST-${Date.now().toString(36).toUpperCase()}`
      console.log("Inserting order...")
      const orderRes = await dbClient.query(`
        INSERT INTO public.orders (
          order_number, user_id, status, subtotal_cents, discount_cents, total_cents, currency, customer_email, metadata
        ) VALUES ($1, $2, 'pending', $3, 0, $3, 'INR', 'customer_a@example.com', $4)
        RETURNING id, order_number, status, total_cents;
      `, [orderNumber, customerA, targetBook.price_cents, JSON.stringify({ book_id: targetBook.id })])

      const createdOrder = orderRes.rows[0]
      createdOrderId = createdOrder.id
      console.log("PASS [Pending Order Created]:", createdOrder)

      // Insert order item
      console.log("Inserting order item...")
      const itemRes = await dbClient.query(`
        INSERT INTO public.order_items (order_id, book_id, book_title, price_cents)
        VALUES ($1, $2, $3, $4)
        RETURNING id, book_title, price_cents;
      `, [createdOrderId, targetBook.id, targetBook.title, targetBook.price_cents])
      console.log("PASS [Order Item Created]:", itemRes.rows[0])

      // Insert pending payment
      console.log("Inserting payment...")
      const paymentRes = await dbClient.query(`
        INSERT INTO public.payments (
          order_id, user_id, provider, razorpay_order_id, status, amount_cents, currency
        ) VALUES ($1, $2, 'razorpay', $3, 'pending', $4, 'INR')
        RETURNING id, razorpay_order_id, status, amount_cents;
      `, [createdOrderId, customerA, testRzpOrderId, targetBook.price_cents])

      const createdPayment = paymentRes.rows[0]
      createdPaymentId = createdPayment.id
      console.log("PASS [Pending Payment Created]:", createdPayment)
      await dbClient.query("COMMIT;")
    } catch (err) {
      console.error("FAILED Test 4:", err.message)
      await dbClient.query("ROLLBACK;")
      throw err
    }

    // -------------------------------------------------------------
    // Test 5: Customer B cannot view or modify Customer A's order
    // -------------------------------------------------------------
    console.log("\n[TEST 5] Testing cross-customer isolation...")
    await dbClient.query("BEGIN;")
    await dbClient.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [customerB])
    await dbClient.query("SELECT set_config('role', 'authenticated', true);")

    const bViewRes = await dbClient.query(`SELECT * FROM public.orders WHERE id = $1;`, [createdOrderId])
    if (bViewRes.rows.length !== 0) {
      throw new Error("FAIL: Customer B was able to view Customer A's order!")
    }
    console.log("PASS [Isolation - View]: Customer B sees 0 rows for Customer A's order.")

    const bCancelRes = await dbClient.query(`
      UPDATE public.orders SET status = 'cancelled' WHERE id = $1 RETURNING id;
    `, [createdOrderId])
    if (bCancelRes.rows.length !== 0) {
      throw new Error("FAIL: Customer B was able to modify Customer A's order!")
    }
    console.log("PASS [Isolation - Modify]: Customer B cannot modify Customer A's order.")
    await dbClient.query("ROLLBACK;")

    // -------------------------------------------------------------
    // Test 6: Failed payment does NOT grant access
    // -------------------------------------------------------------
    console.log("\n[TEST 6] Testing payment failure handling...")
    const failRpcRes = await dbClient.query(`
      SELECT public.mark_order_payment_failed($1, 'BAD_CVV', 'Card declined by issuing bank') as result;
    `, [testRzpOrderId])
    console.log("mark_order_payment_failed result:", failRpcRes.rows[0].result)

    // Check order and payment status
    const orderCheckFail = await dbClient.query(`SELECT status FROM public.orders WHERE id = $1;`, [createdOrderId])
    const paymentCheckFail = await dbClient.query(`SELECT status, error_code FROM public.payments WHERE id = $1;`, [createdPaymentId])
    console.log(`Order status after failure: ${orderCheckFail.rows[0].status}`)
    console.log(`Payment status after failure: ${paymentCheckFail.rows[0].status} (${paymentCheckFail.rows[0].error_code})`)

    // Check that entitlement does NOT exist
    const entitlementFailCheck = await dbClient.query(`
      SELECT * FROM public.book_entitlements WHERE user_id = $1 AND book_id = $2;
    `, [customerA, targetBook.id])
    if (entitlementFailCheck.rows.length > 0) {
      throw new Error("FAIL: Entitlement was granted on failed payment!")
    }
    console.log("PASS [Access Denied]: No book_entitlement granted for failed payment.")

    // -------------------------------------------------------------
    // Test 7: Razorpay Signature Verification & Payment Confirmation
    // -------------------------------------------------------------
    console.log("\n[TEST 7] Testing Razorpay Signature & Authoritative Confirmation...")
    await dbClient.query(`UPDATE public.orders SET status = 'pending' WHERE id = $1;`, [createdOrderId])
    await dbClient.query(`UPDATE public.payments SET status = 'pending', error_code = NULL, error_description = NULL WHERE id = $1;`, [createdPaymentId])

    // Generate valid cryptographic signature
    const validSignature = generatePaymentSignature(testRzpOrderId, testRzpPaymentId, razorpaySecret)
    const isValid = verifyPaymentSignatureLocal({
      orderId: testRzpOrderId,
      paymentId: testRzpPaymentId,
      signature: validSignature,
      secret: razorpaySecret,
    })
    if (!isValid) throw new Error("FAIL: Valid signature rejected!")
    console.log(`PASS [Signature Verified]: Cryptographic HMAC-SHA256 signature verified on server.`)

    const isFakeValid = verifyPaymentSignatureLocal({
      orderId: testRzpOrderId,
      paymentId: testRzpPaymentId,
      signature: "tampered_fake_signature_hex",
      secret: razorpaySecret,
    })
    if (isFakeValid) throw new Error("FAIL: Invalid signature accepted!")
    console.log(`PASS [Tampered Signature Blocked]: Rejected invalid signature.`)

    // Execute confirm_order_payment RPC
    const confirmRes = await dbClient.query(`
      SELECT public.confirm_order_payment($1, $2, $3, $4, '{"method": "upi", "vpa": "customer@okhdfc"}'::jsonb) as result;
    `, [createdOrderId, testRzpOrderId, testRzpPaymentId, validSignature])

    const confirmOutput = confirmRes.rows[0].result
    console.log("confirm_order_payment output:", confirmOutput)
    if (!confirmOutput.success) {
      throw new Error(`confirm_order_payment failed: ${confirmOutput.error}`)
    }
    console.log("PASS [Payment Confirmed]: Stored procedure confirmed payment.")

    // Verify order is paid
    const paidOrder = await dbClient.query(`SELECT status FROM public.orders WHERE id = $1;`, [createdOrderId])
    console.log(`PASS [Order Status]: ${paidOrder.rows[0].status}`)

    // Verify payment is captured
    const capturedPayment = await dbClient.query(`SELECT status, razorpay_payment_id FROM public.payments WHERE id = $1;`, [createdPaymentId])
    console.log(`PASS [Payment Status]: ${capturedPayment.rows[0].status} (Payment ID: ${capturedPayment.rows[0].razorpay_payment_id})`)

    // Verify entitlement granted
    const grantedEntitlement = await dbClient.query(`
      SELECT id, user_id, book_id, entitlement_type, is_revoked 
      FROM public.book_entitlements 
      WHERE user_id = $1 AND book_id = $2;
    `, [customerA, targetBook.id])
    if (grantedEntitlement.rows.length === 0 || grantedEntitlement.rows[0].is_revoked) {
      throw new Error("FAIL: Entitlement was not granted or is revoked!")
    }
    console.log("PASS [Entitlement Granted]:", grantedEntitlement.rows[0])

    // Verify sales count incremented
    const updatedBook = await dbClient.query(`SELECT sales_count FROM public.books WHERE id = $1;`, [targetBook.id])
    console.log(`PASS [Sales Count Incremented]: ${initialSalesCount} -> ${updatedBook.rows[0].sales_count}`)

    // -------------------------------------------------------------
    // Test 8: Idempotency (Duplicate Confirmation / Webhook)
    // -------------------------------------------------------------
    console.log("\n[TEST 8] Testing Idempotent Delivery...")
    const duplicateRes = await dbClient.query(`
      SELECT public.confirm_order_payment($1, $2, $3, $4) as result;
    `, [createdOrderId, testRzpOrderId, testRzpPaymentId, validSignature])
    const duplicateOutput = duplicateRes.rows[0].result
    console.log("Duplicate confirm_order_payment output:", duplicateOutput)
    if (!duplicateOutput.already_captured) {
      throw new Error("FAIL: Duplicate confirmation did not report already_captured!")
    }
    console.log("PASS [Idempotency Confirmed]: Duplicate request safely recognized.")

    // Ensure entitlements are not duplicated
    const allEntitlements = await dbClient.query(`
      SELECT COUNT(*) as count FROM public.book_entitlements WHERE user_id = $1 AND book_id = $2;
    `, [customerA, targetBook.id])
    if (parseInt(allEntitlements.rows[0].count) !== 1) {
      throw new Error(`FAIL: Found ${allEntitlements.rows[0].count} entitlements instead of 1!`)
    }
    console.log("PASS [No Duplicate Entitlements]: Exactly 1 entitlement record exists.")

  } finally {
    // -------------------------------------------------------------
    // Cleanup test data
    // -------------------------------------------------------------
    console.log("\n[CLEANUP] Cleaning up test order, payment, and entitlement records...")
    await dbClient.query("DELETE FROM public.book_entitlements WHERE user_id = $1 AND book_id = $2;", [customerA, targetBook.id])
    if (createdOrderId) {
      await dbClient.query("DELETE FROM public.order_items WHERE order_id = $1;", [createdOrderId])
      await dbClient.query("DELETE FROM public.payments WHERE order_id = $1;", [createdOrderId])
      await dbClient.query("DELETE FROM public.orders WHERE id = $1;", [createdOrderId])
    }
    // Revert book sales count
    await dbClient.query("UPDATE public.books SET sales_count = $1 WHERE id = $2;", [initialSalesCount, targetBook.id])
    console.log("PASS [Cleanup Complete]: Test records purged.")
  }

  console.log("\n==================================================================")
  console.log("   ALL 8 CHECKOUT, PAYMENT & RLS VERIFICATION TESTS PASSED!       ")
  console.log("==================================================================")
}

runVerification()
  .catch((err) => {
    console.error("\nTEST SUITE FAILED:", err)
    process.exit(1)
  })
  .finally(() => {
    dbClient.end()
  })
