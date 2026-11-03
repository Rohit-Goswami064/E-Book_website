import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyWebhookSignature } from "@/lib/razorpay/client"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-razorpay-signature")
    if (!signature) {
      return NextResponse.json({ error: "Missing webhook signature" }, { status: 400 })
    }

    const rawBody = await request.text()

    // 1. Verify webhook signature cryptographically with raw payload
    const isValid = verifyWebhookSignature({ rawBody, signature })
    if (!isValid) {
      console.warn("[Razorpay Webhook]: Rejected invalid signature.")
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 })
    }

    const event = JSON.parse(rawBody)
    const supabase = createAdminClient()

    switch (event.event) {
      case "payment.captured": {
        const paymentEntity = event.payload?.payment?.entity
        const rzpOrderId = paymentEntity?.order_id
        const rzpPaymentId = paymentEntity?.id

        if (rzpOrderId && rzpPaymentId) {
          console.log(`[Razorpay Webhook]: Processing payment.captured for ${rzpOrderId}`)
          const { data: res, error } = await supabase.rpc("confirm_order_payment", {
            p_razorpay_order_id: rzpOrderId,
            p_razorpay_payment_id: rzpPaymentId,
            p_razorpay_signature: "webhook_signature_verified",
            p_raw_response: paymentEntity,
          })

          if (error) {
            console.error("[Razorpay Webhook confirm_order_payment Error]:", error)
          } else {
            console.log("[Razorpay Webhook]: Payment confirmed:", res)
          }
        }
        break
      }

      case "payment.failed": {
        const paymentEntity = event.payload?.payment?.entity
        const rzpOrderId = paymentEntity?.order_id

        if (rzpOrderId) {
          console.log(`[Razorpay Webhook]: Processing payment.failed for ${rzpOrderId}`)
          await supabase.rpc("mark_order_payment_failed", {
            p_razorpay_order_id: rzpOrderId,
            p_error_code: paymentEntity?.error_code || null,
            p_error_desc: paymentEntity?.error_description || null,
            p_raw_response: paymentEntity,
          })
        }
        break
      }

      case "refund.processed": {
        const refundEntity = event.payload?.refund?.entity
        const rzpPaymentId = refundEntity?.payment_id

        if (rzpPaymentId) {
          console.log(`[Razorpay Webhook]: Processing refund.processed for ${rzpPaymentId}`)
          await supabase.rpc("process_order_refund", {
            p_razorpay_payment_id: rzpPaymentId,
            p_amount_cents: refundEntity?.amount || 0,
            p_currency: refundEntity?.currency || "INR",
            p_refund_id: refundEntity?.id || null,
            p_reason: refundEntity?.notes?.reason || "Customer requested refund",
            p_raw_response: refundEntity,
          })
        }
        break
      }
    }

    return NextResponse.json({ status: "ok" })
  } catch (error: any) {
    console.error("[Razorpay Webhook Handler Error]:", error)
    return NextResponse.json(
      { error: "Webhook processing error" },
      { status: 500 }
    )
  }
}
