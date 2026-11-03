import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
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

    // 2. Mobile number resolution via secure PostgreSQL RPC
    const supabase = await createClient()
    const { data: result, error } = await supabase.rpc("resolve_user_identifier", {
      p_identifier: clean,
    })

    if (error) {
      console.error("[Identifier Resolution DB Error]:", error)
      return NextResponse.json({ error: "Failed to resolve account identifier" }, { status: 500 })
    }

    if (result && result.found && result.email) {
      return NextResponse.json({
        email: result.email,
        phone: result.phone || clean,
        isPhone: true,
      })
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
