import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { dbQuery } from "@/lib/db"
import { normalizeIndianMobile } from "@/lib/auth/mobile-normalizer"
import { z } from "zod"

export const dynamic = "force-dynamic"

const resolveSchema = z.object({
  identifier: z.string().min(1, "Identifier is required"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = resolveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid identifier provided" }, { status: 400 })
    }

    const { identifier } = parsed.data
    const clean = identifier.trim()

    // 1. If it's already an email
    if (clean.includes("@")) {
      return NextResponse.json({
        email: clean.toLowerCase(),
        isPhone: false,
      })
    }

    // 2. Mobile number resolution with Indian normalization (+91, spaces, 10 digits)
    const normalizedMobile = normalizeIndianMobile(clean)
    const lookupPhone = normalizedMobile || clean.replace(/\D/g, "")

    // Try PostgreSQL RPC first
    try {
      const supabase = await createClient()
      const { data: result } = await supabase.rpc("resolve_user_identifier", {
        p_identifier: lookupPhone,
      })

      if (result && result.found && result.email) {
        return NextResponse.json({
          email: result.email,
          phone: result.phone || lookupPhone,
          isPhone: true,
        })
      }
    } catch (rpcErr) {
      console.warn("[RPC resolve_user_identifier notice]:", rpcErr)
    }

    // Direct database query fallback via pool (searches auth.users and public.profiles)
    if (lookupPhone) {
      const dbRes = await dbQuery<{ email: string; phone: string }>(
        `
        SELECT 
          u.email,
          COALESCE(u.phone, p.phone) as phone
        FROM auth.users u
        LEFT JOIN public.profiles p ON p.id = u.id
        WHERE (
          u.phone = $1
          OR u.phone = '+91' || $1
          OR REGEXP_REPLACE(COALESCE(u.phone, ''), '[^0-9]', '', 'g') = $1
          OR p.phone = $1
          OR p.phone = '+91' || $1
          OR REGEXP_REPLACE(COALESCE(p.phone, ''), '[^0-9]', '', 'g') = $1
        )
        LIMIT 1;
        `,
        [lookupPhone]
      )

      if (dbRes.rows.length > 0 && dbRes.rows[0].email) {
        return NextResponse.json({
          email: dbRes.rows[0].email,
          phone: dbRes.rows[0].phone || lookupPhone,
          isPhone: true,
        })
      }
    }

    return NextResponse.json(
      { error: "No account found matching this mobile number. Please check and retry or register." },
      { status: 404 }
    )
  } catch (error: any) {
    console.error("[Resolve Identifier Error]:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to resolve identifier" },
      { status: 500 }
    )
  }
}
