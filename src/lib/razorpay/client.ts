import Razorpay from "razorpay"
import crypto from "crypto"

// Server-only guard: prevent accidental bundling into client components
if (typeof window !== "undefined") {
  throw new Error("CRITICAL SECURITY VIOLATION: Razorpay service cannot be loaded on the client.")
}

export function getRazorpayClient() {
  const key_id = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
  const key_secret = process.env.RAZORPAY_KEY_SECRET

  if (!key_id || !key_secret) {
    throw new Error("Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured.")
  }

  return new Razorpay({
    key_id,
    key_secret,
  })
}

/**
 * Verifies Razorpay payment signature using HMAC SHA256:
 * hmac(razorpay_order_id + "|" + razorpay_payment_id, secret) === razorpay_signature
 */
export function verifyPaymentSignature({
  orderId,
  paymentId,
  signature,
}: {
  orderId: string
  paymentId: string
  signature: string
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!secret) return false

  const generatedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex")

  const genBuf = Buffer.from(generatedSignature, "utf-8")
  const sigBuf = Buffer.from(signature, "utf-8")

  if (genBuf.length !== sigBuf.length) {
    return false
  }

  return crypto.timingSafeEqual(genBuf, sigBuf)
}

/**
 * Verifies Razorpay Webhook signature using HMAC SHA256 on raw body
 */
export function verifyWebhookSignature({
  rawBody,
  signature,
}: {
  rawBody: string
  signature: string
}): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret || !signature) return false

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")

  const expBuf = Buffer.from(expectedSignature, "utf-8")
  const sigBuf = Buffer.from(signature, "utf-8")

  if (expBuf.length !== sigBuf.length) {
    return false
  }

  return crypto.timingSafeEqual(expBuf, sigBuf)
}
