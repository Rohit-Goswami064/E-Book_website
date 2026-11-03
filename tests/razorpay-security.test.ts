import { describe, it } from "node:test"
import assert from "node:assert/strict"
import crypto from "crypto"
import { verifyPaymentSignature, verifyWebhookSignature } from "../src/lib/razorpay/client"

describe("Razorpay Security & Verification", () => {
  const TEST_SECRET = "test_rzp_secret_key_12345"
  const TEST_WEBHOOK_SECRET = "test_rzp_webhook_secret_98765"

  process.env.RAZORPAY_KEY_SECRET = TEST_SECRET
  process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET

  it("successfully verifies valid Razorpay payment signature", () => {
    const orderId = "order_O4u8q7z1nK9876"
    const paymentId = "pay_P1x2y3z4a5b6c7"

    // Construct valid HMAC-SHA256
    const validSignature = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex")

    const isValid = verifyPaymentSignature({
      orderId,
      paymentId,
      signature: validSignature,
    })

    assert.equal(isValid, true, "Valid HMAC signature must be accepted")
  })

  it("rejects tampered or forged payment signature", () => {
    const orderId = "order_O4u8q7z1nK9876"
    const paymentId = "pay_P1x2y3z4a5b6c7"
    const forgedSignature = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

    const isValid = verifyPaymentSignature({
      orderId,
      paymentId,
      signature: forgedSignature,
    })

    assert.equal(isValid, false, "Forged signature must be rejected")
  })

  it("rejects signature with mismatched length safely without throwing", () => {
    const orderId = "order_O4u8q7z1nK9876"
    const paymentId = "pay_P1x2y3z4a5b6c7"
    const shortSignature = "short_invalid_sig"

    const isValid = verifyPaymentSignature({
      orderId,
      paymentId,
      signature: shortSignature,
    })

    assert.equal(isValid, false, "Malformed signature must safely evaluate to false")
  })

  it("successfully verifies authentic Razorpay webhook event payload", () => {
    const webhookPayload = JSON.stringify({
      entity: "event",
      account_id: "acc_12345",
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_998877",
            order_id: "order_112233",
            amount: 49900,
            status: "captured",
          },
        },
      },
    })

    const validWebhookSig = crypto
      .createHmac("sha256", TEST_WEBHOOK_SECRET)
      .update(webhookPayload)
      .digest("hex")

    const isValid = verifyWebhookSignature({
      rawBody: webhookPayload,
      signature: validWebhookSig,
    })

    assert.equal(isValid, true, "Authentic webhook signature must be verified")
  })

  it("rejects tampered webhook payload", () => {
    const originalPayload = JSON.stringify({ event: "payment.captured", amount: 49900 })
    const tamperedPayload = JSON.stringify({ event: "payment.captured", amount: 100 })

    const signatureOnOriginal = crypto
      .createHmac("sha256", TEST_WEBHOOK_SECRET)
      .update(originalPayload)
      .digest("hex")

    const isValid = verifyWebhookSignature({
      rawBody: tamperedPayload,
      signature: signatureOnOriginal,
    })

    assert.equal(isValid, false, "Tampered webhook payload must be rejected")
  })
})
