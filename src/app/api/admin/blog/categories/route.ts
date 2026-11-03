import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isCurrentUserAdmin } from "@/lib/auth/roles"

export async function GET() {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 })
    }

    const supabase = await createClient()
    const [categoriesResult, tagsResult] = await Promise.all([
      supabase.from("blog_categories").select("*").order("name", { ascending: true }),
      supabase.from("blog_tags").select("*").order("name", { ascending: true }),
    ])

    if (categoriesResult.error) {
      return NextResponse.json({ error: categoriesResult.error.message }, { status: 500 })
    }

    return NextResponse.json({
      categories: categoriesResult.data || [],
      tags: tagsResult.data || [],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
