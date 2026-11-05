import { NextRequest, NextResponse } from "next/server"
import { checkCustomerAccount } from "@/lib/auth/checkout-customer"
import { normalizeIndianMobile, maskEmail, maskMobile } from "@/lib/auth/mobile-normalizer"
import { z } from "zod"

export const dynamic = "force-dynamic"

const checkAccountSchema = z.object({
  email: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = checkAccountSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 })
    }

    const { email, mobile } = parsed.data
    if (!email && !mobile) {
      return NextResponse.json({
        exists: false,
        conflict: false,
        accountType: "new",
        matchedBy: "none",
      })
    }

    const result = await checkCustomerAccount(email, mobile)

    // Mask sensitive details before sending to client
    return NextResponse.json({
      exists: result.exists,
      conflict: result.conflict,
      conflictError: result.conflictError || null,
      accountType: result.accountType,
      matchedBy: result.matchedBy,
      hasPassword: result.hasPassword ?? false,
      maskedEmail: result.email ? maskEmail(result.email) : null,
      maskedPhone: result.phone ? maskMobile(result.phone) : null,
      normalizedMobile: mobile ? normalizeIndianMobile(mobile) : null,
    })
  } catch (error: any) {
    console.error("[Check Account API Error]:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to check account status" },
      { status: 500 }
    )
  }
}

