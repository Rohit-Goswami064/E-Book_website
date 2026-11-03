import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser, checkBookEntitlement } from "@/lib/auth/roles"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().optional().nullable(),
  review_text: z.string().min(5, "Review must be at least 5 characters"),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookId } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Please sign in to write a review." }, { status: 401 })
    }

    const body = await request.json()
    const parsed = reviewSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid review", details: parsed.error.flatten() }, { status: 400 })
    }

    const admin = createAdminClient()
    const isVerified = await checkBookEntitlement(user.id, bookId)

    const { data, error } = await admin
      .from("reviews")
      .upsert(
        {
          user_id: user.id,
          book_id: bookId,
          rating: parsed.data.rating,
          title: parsed.data.title || null,
          review_text: parsed.data.review_text,
          is_verified_purchase: isVerified,
          is_approved: true, // auto-approve verified customer reviews
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,book_id" }
      )
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Your review has been published.",
      review: data,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
