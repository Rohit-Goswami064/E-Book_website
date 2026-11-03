import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isCurrentUserAdmin } from "@/lib/auth/roles"
import { slugify } from "@/lib/utils"

export async function GET() {
  try {
    const adminClient: any = createAdminClient()
    const { data: authors, error } = await adminClient
      .from("authors")
      .select("*, books(count)")
      .order("name", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const formatted = (authors as any[])?.map((a: any) => ({
      ...a,
      book_count: a.books?.[0]?.count || 0,
    }))

    return NextResponse.json({ authors: formatted || [] })
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
    const { name, slug, bio, avatar_url, website_url, twitter_handle } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "Author name is required" }, { status: 400 })
    }

    const finalSlug = slug?.trim() ? slugify(slug) : slugify(name)
    const adminClient: any = createAdminClient()

    const { data: created, error } = await adminClient
      .from("authors")
      .insert({
        name: name.trim(),
        slug: finalSlug,
        bio: bio?.trim() || null,
        avatar_url: avatar_url?.trim() || null,
        website: website_url?.trim() || null,
        twitter: twitter_handle?.trim() || null,
      } as any)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, author: created })
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
    const { id, name, slug, bio, avatar_url, website_url, twitter_handle } = body

    if (!id || !name?.trim()) {
      return NextResponse.json({ error: "ID and name are required" }, { status: 400 })
    }

    const finalSlug = slug?.trim() ? slugify(slug) : slugify(name)
    const adminClient: any = createAdminClient()

    const { data: updated, error } = await adminClient
      .from("authors")
      .update({
        name: name.trim(),
        slug: finalSlug,
        bio: bio?.trim() || null,
        avatar_url: avatar_url?.trim() || null,
        website: website_url?.trim() || null,
        twitter: twitter_handle?.trim() || null,
      } as any)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, author: updated })
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
      .from("books")
      .select("*", { count: "exact", head: true })
      .eq("author_id", id)

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete author: ${count} book(s) belong to this author.` },
        { status: 400 }
      )
    }

    const { error } = await adminClient.from("authors").delete().eq("id", id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
