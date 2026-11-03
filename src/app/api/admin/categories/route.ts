import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isCurrentUserAdmin } from "@/lib/auth/roles"
import { slugify } from "@/lib/utils"

export async function GET() {
  try {
    const adminClient: any = createAdminClient()
    const { data: categories, error } = await adminClient
      .from("categories")
      .select("*, book_categories(count)")
      .order("display_order", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const formatted = (categories as any[])?.map((cat: any) => ({
      ...cat,
      book_count: cat.book_categories?.[0]?.count || 0,
    }))

    return NextResponse.json({ categories: formatted || [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 })
    }

    const body = await request.json()
    const { name, slug, description, color_code, display_order } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const finalSlug = slug?.trim() ? slugify(slug) : slugify(name)
    const adminClient: any = createAdminClient()

    const { data: created, error } = await adminClient
      .from("categories")
      .insert({
        name: name.trim(),
        slug: finalSlug,
        description: description?.trim() || null,
        color_code: color_code || "#E8E0D6",
        display_order: display_order || 0,
      } as any)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, category: created })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 })
    }

    const body = await request.json()
    const { id, name, slug, description, color_code, display_order } = body

    if (!id || !name?.trim()) {
      return NextResponse.json({ error: "ID and name are required" }, { status: 400 })
    }

    const finalSlug = slug?.trim() ? slugify(slug) : slugify(name)
    const adminClient: any = createAdminClient()

    const { data: updated, error } = await adminClient
      .from("categories")
      .update({
        name: name.trim(),
        slug: finalSlug,
        description: description?.trim() || null,
        color_code: color_code || "#E8E0D6",
        display_order: display_order || 0,
      } as any)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, category: updated })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }

    const adminClient: any = createAdminClient()

    // Check if books are attached
    const { count } = await adminClient
      .from("book_categories")
      .select("*", { count: "exact", head: true })
      .eq("category_id", id)

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete category: ${count} book(s) are assigned to it.` },
        { status: 400 }
      )
    }

    const { error } = await adminClient.from("categories").delete().eq("id", id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
