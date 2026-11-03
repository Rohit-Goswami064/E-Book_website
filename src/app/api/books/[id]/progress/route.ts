import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const progressSchema = z.object({
  current_page: z.number().int().min(1),
  total_pages: z.number().int().min(1),
  progress_percentage: z.number().min(0).max(100),
  last_chapter: z.string().optional().nullable(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookId } = await params
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = progressSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from("reading_progress")
      .upsert(
        {
          user_id: user.id,
          book_id: bookId,
          current_page: parsed.data.current_page,
          total_pages: parsed.data.total_pages,
          progress_percentage: parsed.data.progress_percentage,
          last_chapter: parsed.data.last_chapter || null,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: "user_id,book_id" }
      )

    if (error) {
      console.error("[Reading Progress Upsert Error]:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[Reading Progress Exception]:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
