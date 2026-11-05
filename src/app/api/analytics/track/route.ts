import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

export const dynamic = "force-dynamic"

const trackEventSchema = z.object({
  event_name: z.string().min(1).max(50),
  book_id: z.string().uuid().optional().nullable(),
  page_url: z.string().max(500).optional().nullable(),
  session_id: z.string().max(100).optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = trackEventSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid tracking payload" }, { status: 400 })
    }

    const { event_name, book_id, page_url, session_id, metadata } = parsed.data
    const user = await getCurrentUser()
    const supabase = await createClient()

    const { error } = await supabase.from("analytics_events").insert({
      event_name,
      user_id: user?.id || null,
      book_id: book_id || null,
      page_url: page_url || null,
      session_id: session_id || null,
      metadata: metadata || {},
    })

    if (error) {
      console.warn("[Analytics Track Insert Warning]:", error.message)
      return NextResponse.json({ success: false }, { status: 200 }) // fail silently for analytics
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
