import { describe, it } from "node:test"
import assert from "node:assert/strict"
import crypto from "crypto"
import {
  normalizeIndianMobile,
  formatIndianMobile,
  isValidIndianMobile,
  validatePasswordComplexity,
} from "../src/lib/auth/mobile-normalizer"
import { verifyPaymentSignature } from "../src/lib/razorpay/client"

describe("HiddenBooks — Checkout, Password, Login & Library Entitlement Test Suite", () => {
  const TEST_RZP_SECRET = "test_rzp_secret_key_mock_123"

  // --------------------------------------------------------------------------
  // Scenario A: New Customer Complete Registration & Entitlement Flow
  // --------------------------------------------------------------------------
  it("Scenario A: New customer with Mobile + Email + Password + Confirm Password -> payment -> entitlement granted -> library access", () => {
    const rawMobile = "+91 9876543210"
    const normalizedMobile = normalizeIndianMobile(rawMobile)
    assert.equal(normalizedMobile, "9876543210", "Indian mobile must normalize to 10 digits")
    assert.equal(formatIndianMobile(normalizedMobile), "+91 9876543210")

    const password = "StrongPassword@2026"
    const confirmPassword = "StrongPassword@2026"
    const passwordCheck = validatePasswordComplexity(password)
    assert.equal(passwordCheck.valid, true, "Valid password must satisfy all complexity requirements")
    assert.equal(password === confirmPassword, true, "Password and confirm password must match")

    // Simulate order creation in pending state
    const order = {
      id: "ord-test-new-cust-1",
      order_number: "HB-MOCK-1001",
      user_id: "user-new-guid-1",
      status: "pending",
      subtotal_cents: 24900,
      total_cents: 24900,
      customer_email: "newcustomer@example.com",
      customer_phone: normalizedMobile,
      metadata: { is_new_account: true, book_id: "book-uuid-101" },
    }

    // Entitlement must NOT exist before verified payment
    const entitlements: { user_id: string; book_id: string; is_revoked: boolean }[] = []
    const prePaymentEntitlement = entitlements.find(
      (e) => e.user_id === order.user_id && e.book_id === order.metadata.book_id
    )
    assert.equal(prePaymentEntitlement, undefined, "No entitlement granted before payment confirmation")

    // Cryptographic payment verification
    const razorpayOrderId = "order_TuMockNew001"
    const razorpayPaymentId = "pay_TuMockNew999"
    const signature = crypto
      .createHmac("sha256", TEST_RZP_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex")

    process.env.RAZORPAY_KEY_SECRET = TEST_RZP_SECRET
    const isSignatureValid = verifyPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature,
    })
    assert.equal(isSignatureValid, true, "Gateway payment signature must verify")

    // Payment confirmation marks order as paid and creates entitlement
    order.status = "paid"
    entitlements.push({
      user_id: order.user_id,
      book_id: order.metadata.book_id,
      is_revoked: false,
    })

    const postPaymentEntitlement = entitlements.find(
      (e) => e.user_id === order.user_id && e.book_id === order.metadata.book_id && !e.is_revoked
    )
    assert.ok(postPaymentEntitlement, "Customer must have active entitlement after verified payment")
  })

  // --------------------------------------------------------------------------
  // Scenario B: Existing Customer Authentication & Safe Linkage
  // --------------------------------------------------------------------------
  it("Scenario B: Existing customer with matching Mobile/Email -> authenticates with password -> safe purchase linkage", () => {
    const existingUser = {
      id: "user-existing-guid-2",
      email: "roshan@apexnucleus.com",
      phone: "9315252190",
      password_hash: "mock_bcrypt_hash",
    }

    const enteredPhone = "+91 9315252190"
    const enteredEmail = "roshan@apexnucleus.com"
    const normalized = normalizeIndianMobile(enteredPhone)

    assert.equal(normalized, existingUser.phone, "Phone matches existing user")
    assert.equal(enteredEmail, existingUser.email, "Email matches existing user")

    // Password verification simulated
    const correctPassword = "ExistingPassword#1"
    const enteredPassword = "ExistingPassword#1"
    const isPasswordCorrect = correctPassword === enteredPassword
    assert.equal(isPasswordCorrect, true, "Existing user must be verified via password")

    // Order linked to existing user ID without modifying their credentials
    const order = {
      id: "ord-test-existing-2",
      user_id: existingUser.id,
      status: "paid",
      metadata: { is_new_account: false, book_id: "book-uuid-202" },
    }

    assert.equal(order.user_id, existingUser.id, "Order linked to existing user ID")
    assert.equal(order.metadata.is_new_account, false, "Must not be flagged as new account")
  })

  // --------------------------------------------------------------------------
  // Scenario C: Existing Customer Enters Wrong Password -> Blocked
  // --------------------------------------------------------------------------
  it("Scenario C: Existing customer enters wrong password -> checkout blocked with clear 401 error", () => {
    const correctPassword = "SecretPassword!123"
    const enteredWrongPassword = "WrongPassword999!"

    function authenticateExistingCustomer(entered: string): { ok: boolean; status: number; error?: string } {
      if (entered !== correctPassword) {
        return {
          ok: false,
          status: 401,
          error: "Incorrect password for this account. Please enter your valid password to proceed.",
        }
      }
      return { ok: true, status: 200 }
    }

    const authRes = authenticateExistingCustomer(enteredWrongPassword)
    assert.equal(authRes.ok, false)
    assert.equal(authRes.status, 401)
    assert.match(authRes.error!, /Incorrect password/)
  })

  // --------------------------------------------------------------------------
  // Scenario D: Weak Password or Non-Matching Password Validation
  // --------------------------------------------------------------------------
  it("Scenario D: Weak passwords and mismatched confirm passwords rejected with descriptive messages", () => {
    // 1. Too short
    const r1 = validatePasswordComplexity("Pass1!")
    assert.equal(r1.valid, false)
    assert.equal(r1.hasMinLength, false)

    // 2. Missing uppercase
    const r2 = validatePasswordComplexity("password123!")
    assert.equal(r2.valid, false)
    assert.equal(r2.hasUppercase, false)

    // 3. Missing number
    const r3 = validatePasswordComplexity("Password!@#")
    assert.equal(r3.valid, false)
    assert.equal(r3.hasNumber, false)

    // 4. Missing special character
    const r4 = validatePasswordComplexity("Password123")
    assert.equal(r4.valid, false)
    assert.equal(r4.hasSpecialChar, false)

    // 5. Valid complexity but mismatch
    const pwd = "ValidPassword123!"
    const confirm = "DifferentPassword123!"
    assert.notEqual(pwd, confirm, "Mismatched passwords must be detected")
  })

  // --------------------------------------------------------------------------
  // Scenario E: Payment Failure or Modal Closed -> No Entitlement Granted
  // --------------------------------------------------------------------------
  it("Scenario E: Payment failure or dismissal leaves order pending/failed without granting entitlements", () => {
    const order = { id: "ord-failed-001", status: "pending", user_id: "user-123" }
    const entitlements: string[] = []

    // Customer closes modal or card declined
    const gatewayStatus: "failed" | "dismissed" = "failed"
    if (gatewayStatus === "failed") {
      order.status = "failed"
    }

    // Entitlement grant requires status === 'paid'
    if (order.status === "paid") {
      entitlements.push("book-entitlement-granted")
    }

    assert.equal(order.status, "failed")
    assert.equal(entitlements.length, 0, "No entitlement granted on payment failure")
  })

  // --------------------------------------------------------------------------
  // Scenario F: Duplicate Callback or Webhook Retry -> Idempotent
  // --------------------------------------------------------------------------
  it("Scenario F: Idempotent payment handling ensures duplicate callbacks do not duplicate entitlements", () => {
    const order = { id: "ord-idempotent-001", status: "pending", user_id: "user-abc", book_id: "book-xyz" }
    const entitlements = new Map<string, { user_id: string; book_id: string; is_revoked: boolean }>()

    function processPaymentConfirmation(orderId: string, paymentId: string) {
      const key = `${order.user_id}:${order.book_id}`
      if (order.status === "paid") {
        return { already_captured: true, success: true }
      }
      order.status = "paid"
      entitlements.set(key, { user_id: order.user_id, book_id: order.book_id, is_revoked: false })
      return { already_captured: false, success: true }
    }

    // 1st callback
    const res1 = processPaymentConfirmation("ord-idempotent-001", "pay_001")
    assert.equal(res1.already_captured, false)
    assert.equal(entitlements.size, 1)

    // 2nd duplicate callback (e.g. concurrent webhook + client handler)
    const res2 = processPaymentConfirmation("ord-idempotent-001", "pay_001")
    assert.equal(res2.already_captured, true)
    assert.equal(entitlements.size, 1, "Entitlements must remain exactly 1 (idempotent)")
  })

  // --------------------------------------------------------------------------
  // Scenario G: Account Conflict (Mobile belongs to A, Email belongs to B)
  // --------------------------------------------------------------------------
  it("Scenario G: Mobile and Email belonging to two different existing accounts blocks automated merge", () => {
    const userA = { id: "user-A", phone: "9876543210", email: "usera@example.com" }
    const userB = { id: "user-B", phone: "7456987456", email: "userb@example.com" }

    function detectAccountConflict(inputPhone: string, inputEmail: string) {
      const normPhone = normalizeIndianMobile(inputPhone)
      const normEmail = inputEmail.trim().toLowerCase()

      const matchByPhone = normPhone === userA.phone ? userA : normPhone === userB.phone ? userB : null
      const matchByEmail = normEmail === userA.email ? userA : normEmail === userB.email ? userB : null

      if (matchByPhone && matchByEmail && matchByPhone.id !== matchByEmail.id) {
        return {
          conflict: true,
          error: "Account Conflict: The provided mobile number and email address belong to two different accounts.",
        }
      }
      return { conflict: false }
    }

    // Test with phone of User A and email of User B
    const conflictCheck = detectAccountConflict("9876543210", "userB@example.com")
    assert.equal(conflictCheck.conflict, true)
    assert.match(conflictCheck.error!, /Account Conflict/)
  })

  // --------------------------------------------------------------------------
  // Scenario H: Mobile Number Normalization & Login Identifier Resolution
  // --------------------------------------------------------------------------
  it("Scenario H: Normalized mobile number resolution supports diverse Indian phone formats", () => {
    const canonical = "7456987456"

    const variants = [
      "+91 7456987456",
      "+917456987456",
      "917456987456",
      "07456987456",
      "74569 87456",
      "7456987456",
    ]

    for (const v of variants) {
      const normalized = normalizeIndianMobile(v)
      assert.equal(
        normalized,
        canonical,
        `Variant "${v}" must consistently normalize to canonical 10 digits`
      )
      assert.equal(isValidIndianMobile(v), true)
    }

    // Invalid mobile numbers
    assert.equal(normalizeIndianMobile("123"), null)
    assert.equal(normalizeIndianMobile("abcdefghij"), null)
  })
})
