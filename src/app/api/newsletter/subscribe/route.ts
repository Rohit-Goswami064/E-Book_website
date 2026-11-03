import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const subscribeSchema = z.object({
  email: z.string().email(),
  source: z.string().optional().default("homepage_footer"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = subscribeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from("newsletter_subscribers")
      .upsert(
        {
          email: parsed.data.email.toLowerCase().trim(),
          source: parsed.data.source,
          is_active: true,
        },
        { onConflict: "email" }
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Thank you for subscribing to the HiddenBooks Dispatch.",
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
