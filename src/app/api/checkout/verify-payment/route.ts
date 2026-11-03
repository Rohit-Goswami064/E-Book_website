import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyPaymentSignature, getRazorpayClient } from "@/lib/razorpay/client"
import { z } from "zod"

export const dynamic = "force-dynamic"

const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1, "Razorpay Order ID is required"),
  razorpay_payment_id: z.string().min(1, "Razorpay Payment ID is required"),
  razorpay_signature: z.string().min(1, "Razorpay Signature is required"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = verifyPaymentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Missing required payment verification parameters", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data

    console.log(`[Payment Verification Initiated]: Gateway Order ID: ${razorpay_order_id}, Payment ID: ${razorpay_payment_id}`)

    // 1. Cryptographically verify Razorpay HMAC-SHA256 signature on server
    const isValidSignature = verifyPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    })

    if (!isValidSignature) {
      console.warn(`[Payment Verification Failed]: Invalid HMAC signature for gateway order ${razorpay_order_id}`)
      return NextResponse.json(
        { error: "Invalid payment signature. Verification failed." },
        { status: 400 }
      )
    }

    // 2. Official Gateway Verification: Confirm payment status and order linkage directly from Razorpay API
    let rzpPayment: any = null
    try {
      const razorpay = getRazorpayClient()
      rzpPayment = await razorpay.payments.fetch(razorpay_payment_id)

      if (rzpPayment) {
        if (rzpPayment.order_id !== razorpay_order_id) {
          console.error(
            `[Payment Mismatch]: Razorpay payment ${razorpay_payment_id} belongs to order ${rzpPayment.order_id}, expected ${razorpay_order_id}`
          )
          return NextResponse.json(
            { error: "Payment transaction does not match this order." },
            { status: 400 }
          )
        }

        if (rzpPayment.status === "failed") {
          console.error(`[Payment Gateway Failed]: Razorpay payment status is failed`)
          return NextResponse.json(
            { error: "Payment was declined by payment gateway or issuing bank." },
            { status: 400 }
          )
        }

        if (rzpPayment.status !== "captured" && rzpPayment.status !== "authorized") {
          console.warn(`[Payment Pending]: Razorpay payment status is ${rzpPayment.status}`)
          return NextResponse.json(
            { error: `Payment is currently ${rzpPayment.status}. Access will be granted once payment is confirmed.` },
            { status: 400 }
          )
        }
      }
    } catch (rzpErr: any) {
      console.warn("[Razorpay Fetch Note]: Gateway API fetch skipped or errored; proceeding with cryptographic signature verification:", rzpErr?.message)
    }

    // 3. Execute atomic database payment confirmation & entitlement grant via SECURITY DEFINER RPC
    const supabase = await createClient()

    const { data: result, error: rpcError } = await supabase.rpc("confirm_order_payment", {
      p_razorpay_order_id: razorpay_order_id,
      p_razorpay_payment_id: razorpay_payment_id,
      p_razorpay_signature: razorpay_signature,
      p_raw_response: {
        verified_via: "client_checkout_handler",
        verified_at: new Date().toISOString(),
        gateway_payment_status: rzpPayment?.status || "captured",
        gateway_method: rzpPayment?.method || null,
      },
    })

    if (rpcError) {
      console.error("[Database RPC Failure]: Error executing confirm_order_payment:", rpcError.message)
      return NextResponse.json(
        { error: "Database error confirming payment. Please contact support." },
        { status: 500 }
      )
    }

    if (!result?.success) {
      console.warn(`[Payment Record Lookup Failed]: ${result?.error} for gateway order ${razorpay_order_id}`)
      if (result?.error?.includes("Payment record not found")) {
        return NextResponse.json(
          { error: "Payment record not found for this order" },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: result?.error || "Payment verification could not be completed." },
        { status: 400 }
      )
    }

    // Diagnostic logging
    console.log(
      `[Payment Verification Succeeded]: Internal Order ID: ${result.order_id}, Gateway Order ID: ${razorpay_order_id}, Amount: ${result.amount_cents} ${result.currency}, User ID: ${result.user_id}, Already Captured: ${!!result.already_captured}`
    )

    // 4. Verify amount if Razorpay returned it
    if (rzpPayment && rzpPayment.amount && result.amount_cents) {
      if (Number(rzpPayment.amount) !== Number(result.amount_cents)) {
        console.error(
          `[Amount Mismatch]: Razorpay amount ${rzpPayment.amount} does not match order total ${result.amount_cents}`
        )
        return NextResponse.json(
          { error: "Payment amount does not match order total." },
          { status: 400 }
        )
      }
    }

    // 5. Active session check: If a user is already authenticated, verify ownership matches
    const activeUser = await getCurrentUser()
    if (activeUser && activeUser.id !== result.user_id) {
      console.warn(`[Session Mismatch]: Logged in user ${activeUser.id} does not match order user ${result.user_id}`)
      return NextResponse.json(
        { error: "Unauthorized: Payment does not match active user session" },
        { status: 403 }
      )
    }

    // 6. Frictionless Guest Auto-Login Handoff & Magic Link Provisioning
    const isGuestCheckout = !activeUser && Boolean(result.customer_email)
    const guestEmail = result.customer_email
    let autoLoginToken: string | null = null
    let actionLink: string | null = null
    let emailSent = false

    if (isGuestCheckout && guestEmail) {
      try {
        const adminSupabase = createAdminClient()
        const origin = request.nextUrl.origin || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
        const targetBookId = result.book_id
        const redirectUrl = targetBookId
          ? `${origin}/read/${targetBookId}`
          : `${origin}/account/library`

        // 1. Generate magic link via Supabase Service Role Admin API
        const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
          type: "magiclink",
          email: guestEmail,
          options: {
            redirectTo: redirectUrl,
          },
        })

        if (linkError) {
          console.error("[Guest Magic Link Generation Error]:", linkError.message)
        } else if (linkData?.properties) {
          actionLink = linkData.properties.action_link || null

          // 2. Parse returned properties.action_link to extract token (the OTP/hash)
          if (actionLink) {
            try {
              const parsedUrl = new URL(actionLink)
              autoLoginToken = parsedUrl.searchParams.get("token")
            } catch {
              const match = actionLink.match(/[?&]token=([^&]+)/)
              if (match) {
                autoLoginToken = match[1]
              }
            }
          }

          // Fallback to raw email_otp or hashed_token if token param missing in actionLink
          if (!autoLoginToken) {
            autoLoginToken = (linkData.properties as any).email_otp || (linkData.properties as any).hashed_token || null
          }

          console.log(`[Guest Magic Link]: Token successfully extracted for ${guestEmail}`)

          // 3. Send email to user (via Resend or your email provider) with magic link for future logins
          const resendApiKey = process.env.RESEND_API_KEY
          if (actionLink && resendApiKey) {
            try {
              const emailRes = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${resendApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: process.env.EMAIL_FROM || "HiddenBooks <onboarding@resend.dev>",
                  to: [guestEmail],
                  subject: "Your eBook Access Link - HiddenBooks",
                  html: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
                      <h2 style="font-size: 22px; font-weight: 700; margin-bottom: 16px;">Thank you for your purchase!</h2>
                      <p style="font-size: 15px; line-height: 1.6; color: #333;">Your eBook access is now unlocked. You can use your secure magic link anytime to log in and read:</p>
                      <div style="margin: 28px 0;">
                        <a href="${actionLink}" style="display: inline-block; background-color: #111111; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px;">Open Your Book</a>
                      </div>
                      <p style="font-size: 13px; color: #777;">If the button above does not work, copy and paste this link in your browser:</p>
                      <p style="font-size: 12px; color: #555; word-break: break-all;">${actionLink}</p>
                    </div>
                  `,
                }),
              })
              if (emailRes.ok) {
                emailSent = true
                console.log(`[Email Handoff]: Sent magic link to ${guestEmail} via Resend`)
              } else {
                console.warn("[Email Handoff Warning]: Resend API error:", await emailRes.text())
              }
            } catch (emailErr: any) {
              console.warn("[Email Handoff Warning]: Could not send email via Resend:", emailErr?.message)
            }
          } else if (actionLink) {
            console.log(`[Email Provider Notice]: Magic link prepared for ${guestEmail}: ${actionLink}`)
          }
        }
      } catch (handoffErr: any) {
        console.error("[Guest Auto-Login Handoff Error]:", handoffErr)
      }
    }

    return NextResponse.json({
      success: true,
      message: !activeUser
        ? "Payment verified successfully! Instant reader access granted."
        : (result.message || "Payment verified successfully. Ebook is now in your library!"),
      orderId: result.order_id,
      bookId: result.book_id,
      isGuestCheckout,
      isNewAccount: !!result.is_new_account,
      needsVerification: false,
      autoLoginToken: autoLoginToken || undefined,
      email: guestEmail || undefined,
      customerEmail: result.customer_email,
      customerPhone: result.customer_phone,
      emailSent,
    })
  } catch (error: any) {
    console.error("[Payment Verification Error]:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error during payment verification" },
      { status: 500 }
    )
  }
}
