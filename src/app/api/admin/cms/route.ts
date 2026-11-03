import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isCurrentUserAdmin } from "@/lib/auth/roles"

export async function GET() {
  try {
    const isAdmin = await isCurrentUserAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 })
    }

    const adminClient = createAdminClient()

    const [sectionsRes, settingsRes, pagesRes] = await Promise.all([
      adminClient.from("homepage_sections").select("*").order("display_order", { ascending: true }),
      adminClient.from("site_settings").select("*"),
      adminClient.from("pages").select("*").order("title", { ascending: true }),
    ])

    return NextResponse.json({
      sections: sectionsRes.data || [],
      settings: settingsRes.data || [],
      pages: pagesRes.data || [],
    })
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
    const { type, payload } = body
    const adminClient = createAdminClient()

    if (type === "section") {
      const { id, title, subtitle, is_active, display_order } = payload
      const { data, error } = await adminClient
        .from("homepage_sections")
        .update({
          title,
          subtitle,
          is_active,
          display_order,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, section: data })
    }

    if (type === "setting") {
      const { key, value } = payload
      const { data, error } = await adminClient
        .from("site_settings")
        .upsert({ key, value, updated_at: new Date().toISOString() })
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, setting: data })
    }

    if (type === "page") {
      const { id, title, content, seo_title, seo_description, is_published } = payload
      const { data, error } = await adminClient
        .from("pages")
        .update({
          title,
          content,
          seo_title,
          seo_description,
          is_published,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, page: data })
    }

    return NextResponse.json({ error: "Invalid CMS update type" }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
