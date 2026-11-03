import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/roles"
import { slugify } from "@/lib/utils"
import { z } from "zod"

export const dynamic = "force-dynamic"

const bookSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  subtitle: z.string().optional().nullable(),
  author_id: z.string().uuid().optional().nullable(),
  category_ids: z.array(z.string().uuid()).optional().default([]),
  price_inr: z.number().min(0),
  original_price_inr: z.number().min(0).optional().nullable(),
  currency: z.string().default("INR"),
  is_free: z.boolean().default(false),
  is_published: z.boolean().default(false),
  is_featured: z.boolean().default(false),
  is_bestseller: z.boolean().default(false),
  cover_image_url: z.string().optional().nullable(),
  short_description: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  format: z.string().default("PDF"),
  language: z.string().default("Hindi"),
  pages: z.number().int().optional().nullable(),
  isbn: z.string().optional().nullable(),
  publisher: z.string().optional().nullable(),
  publication_date: z.string().optional().nullable(),
  audio_duration: z.string().optional().nullable(),
  audio_sample_url: z.string().optional().nullable(),
  table_of_contents: z.any().optional().nullable(),
  seo_title: z.string().optional().nullable(),
  seo_description: z.string().optional().nullable(),
  canonical_url: z.string().optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    // 1. Authorize calling administrator
    const user = await getCurrentUser()
    const isAdmin = await isCurrentUserAdmin()
    if (!user || !isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized: Super Admin or Administrator privileges required to publish." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = bookSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid publication payload", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data = parsed.data
    // 2. Use user's authenticated Supabase server client to enforce RLS with auth.uid()
    const supabase = await createClient()

    const priceCents = data.is_free ? 0 : Math.round(data.price_inr * 100)
    const origPriceCents = data.original_price_inr ? Math.round(data.original_price_inr * 100) : null
    
    // Prevent duplicate slug collision on retry
    let finalSlug = slugify(data.slug || data.title)
    const { data: existingSlug } = await supabase
      .from("books")
      .select("id")
      .eq("slug", finalSlug)
      .maybeSingle()

    if (existingSlug) {
      finalSlug = `${finalSlug}-${Date.now().toString(36).slice(-4)}`
    }

    // 3. Insert book under authenticated user RLS policy ("Super admins can insert books")
    const { data: book, error } = await supabase
      .from("books")
      .insert({
        title: data.title,
        slug: finalSlug,
        subtitle: data.subtitle || null,
        author_id: data.author_id || null,
        price_cents: priceCents,
        original_price_cents: origPriceCents,
        currency: data.currency,
        is_free: data.is_free,
        is_published: data.is_published,
        is_featured: data.is_featured,
        is_bestseller: data.is_bestseller,
        cover_image_url: data.cover_image_url || null,
        short_description: data.short_description || null,
        description: data.description || null,
        format: data.format,
        language: data.language,
        pages: data.pages || null,
        isbn: data.isbn || null,
        publisher: data.publisher || null,
        publication_date: data.publication_date || null,
        audio_duration: data.audio_duration || null,
        audio_sample_url: data.audio_sample_url || null,
        table_of_contents: data.table_of_contents || [],
        seo_title: data.seo_title || null,
        seo_description: data.seo_description || null,
        canonical_url: data.canonical_url || null,
      } as any)
      .select()
      .single()

    if (error) {
      console.error("[Super Admin Publication Insert Failure]:", error)
      return NextResponse.json(
        { error: error.message || "Failed to create publication record." },
        { status: error.code === "42501" ? 403 : 500 }
      )
    }

    // 4. Attach categories under authenticated RLS policy
    if (data.category_ids && data.category_ids.length > 0) {
      const inserts = data.category_ids.map((catId) => ({
        book_id: (book as any)?.id,
        category_id: catId,
      }))
      const { error: catError } = await supabase.from("book_categories").insert(inserts as any)
      if (catError) {
        console.error("[Book Categories Association Failure]:", catError)
      }
    }

    // 5. Audit log under authenticated RLS policy
    await supabase.from("audit_logs").insert({
      admin_user_id: user.id,
      action: "CREATE_BOOK",
      resource_type: "books",
      resource_id: (book as any)?.id,
      details: { title: (book as any)?.title, slug: (book as any)?.slug },
    } as any)

    return NextResponse.json({ success: true, book })
  } catch (error: any) {
    console.error("[Super Admin Book Create Handler Error]:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error during book publication." },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    const isAdmin = await isCurrentUserAdmin()
    if (!user || !isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized: Super Admin or Administrator privileges required." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = bookSchema.safeParse(body)
    if (!parsed.success || !parsed.data.id) {
      return NextResponse.json({ error: "Missing book ID or invalid payload" }, { status: 400 })
    }

    const data = parsed.data
    const bookId = data.id!
    const supabase = await createClient()

    const priceCents = data.is_free ? 0 : Math.round(data.price_inr * 100)
    const origPriceCents = data.original_price_inr ? Math.round(data.original_price_inr * 100) : null
    const finalSlug = slugify(data.slug || data.title)

    const { data: book, error } = await supabase
      .from("books")
      .update({
        title: data.title,
        slug: finalSlug,
        subtitle: data.subtitle || null,
        author_id: data.author_id || null,
        price_cents: priceCents,
        original_price_cents: origPriceCents,
        currency: data.currency,
        is_free: data.is_free,
        is_published: data.is_published,
        is_featured: data.is_featured,
        is_bestseller: data.is_bestseller,
        cover_image_url: data.cover_image_url || null,
        short_description: data.short_description || null,
        description: data.description || null,
        format: data.format,
        language: data.language,
        pages: data.pages || null,
        isbn: data.isbn || null,
        publisher: data.publisher || null,
        publication_date: data.publication_date || null,
        audio_duration: data.audio_duration || null,
        audio_sample_url: data.audio_sample_url || null,
        table_of_contents: data.table_of_contents || [],
        seo_title: data.seo_title || null,
        seo_description: data.seo_description || null,
        canonical_url: data.canonical_url || null,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", bookId)
      .select()
      .single()

    if (error) {
      console.error("[Super Admin Book Update Failure]:", error)
      return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 500 })
    }

    // Refresh categories
    if (data.category_ids) {
      await supabase.from("book_categories").delete().eq("book_id", bookId)
      if (data.category_ids.length > 0) {
        const inserts = data.category_ids.map((catId) => ({
          book_id: bookId,
          category_id: catId,
        }))
        await supabase.from("book_categories").insert(inserts as any)
      }
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      admin_user_id: user.id,
      action: "UPDATE_BOOK",
      resource_type: "books",
      resource_id: bookId,
      details: { title: (book as any)?.title },
    } as any)

    return NextResponse.json({ success: true, book })
  } catch (error: any) {
    console.error("[Super Admin Book Update Handler Error]:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    const isAdmin = await isCurrentUserAdmin()
    if (!user || !isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized: Super Admin or Administrator privileges required." },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const bookId = searchParams.get("id")
    if (!bookId) {
      return NextResponse.json({ error: "Publication ID required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase.from("books").delete().eq("id", bookId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from("audit_logs").insert({
      admin_user_id: user.id,
      action: "DELETE_BOOK",
      resource_type: "books",
      resource_id: bookId,
    } as any)

    return NextResponse.json({ success: true, message: "Publication successfully deleted." })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
