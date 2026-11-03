import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/roles"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const wishlistSchema = z.object({
  bookId: z.string().uuid(),
})

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ wishlistBookIds: [] })

    const admin = createAdminClient()
    const { data } = await admin
      .from("wishlists")
      .select("book_id")
      .eq("user_id", user.id)

    return NextResponse.json({
      wishlistBookIds: data ? (data as any[]).map((w: any) => w.book_id) : [],
    })
  } catch (error) {
    return NextResponse.json({ wishlistBookIds: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Please log in to save to wishlist." }, { status: 401 })
    }

    const body = await request.json()
    const parsed = wishlistSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid book ID" }, { status: 400 })
    }

    const { bookId } = parsed.data
    const admin = createAdminClient()

    // Check if already in wishlist
    const { data: existing } = await admin
      .from("wishlists")
      .select("id")
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .maybeSingle()

    if (existing) {
      await admin.from("wishlists").delete().eq("id", existing.id)
      return NextResponse.json({ inWishlist: false, message: "Removed from wishlist." })
    } else {
      await admin.from("wishlists").insert({ user_id: user.id, book_id: bookId })
      // Track analytics
      await admin.from("analytics_events").insert({
        event_name: "WISHLIST_ADDED",
        user_id: user.id,
        book_id: bookId,
      })
      return NextResponse.json({ inWishlist: true, message: "Saved to wishlist." })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
