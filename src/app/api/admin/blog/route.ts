import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser, isCurrentUserAdmin, isCurrentUserSuperAdmin } from "@/lib/auth/roles"
import { slugify } from "@/lib/utils"

function calculateReadingTime(text: string): number {
  const plainText = (text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  const words = plainText ? plainText.split(/\s+/).length : 0
  return Math.max(1, Math.ceil(words / 200))
}

const VALID_STATUSES = ["draft", "published", "scheduled", "archived"] as const
type PostStatus = (typeof VALID_STATUSES)[number]

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    const isAdmin = await isCurrentUserAdmin()
    if (!user || !isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized access. Administrator privileges required." },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const status = searchParams.get("status")

    // Use cookie-authenticated Supabase client to satisfy RLS with auth.uid()
    const supabase = await createClient()

    if (id) {
      const { data: post, error } = await supabase
        .from("blog_posts")
        .select(`
          *,
          authors(*),
          blog_post_categories(category_id, blog_categories(id, name, slug)),
          blog_post_tags(tag_id, blog_tags(id, name, slug))
        `)
        .eq("id", id)
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }

      const formattedPost = {
        ...post,
        category_ids: (post.blog_post_categories as any[])?.map((c: any) => c.category_id) || [],
        tag_ids: (post.blog_post_tags as any[])?.map((t: any) => t.tag_id) || [],
        categories: (post.blog_post_categories as any[])?.map((c: any) => c.blog_categories).filter(Boolean) || [],
        tags: (post.blog_post_tags as any[])?.map((t: any) => t.blog_tags).filter(Boolean) || [],
      }

      return NextResponse.json({ post: formattedPost })
    }

    let query = supabase
      .from("blog_posts")
      .select("*, authors(id, name)")
      .order("created_at", { ascending: false })

    if (status && status !== "all") {
      query = query.eq("status", status)
    }

    const { data: posts, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ posts: posts || [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate calling administrator
    const user = await getCurrentUser()
    const isAdmin = await isCurrentUserAdmin()
    const isSuperAdmin = await isCurrentUserSuperAdmin()

    if (!user || !isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized: Super Admin or Administrator privileges required to manage editorial blog posts." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      title,
      slug,
      excerpt,
      content,
      featured_image,
      cover_image_url,
      custom_css,
      og_image_url,
      focus_keyword,
      canonical_url,
      author_id,
      status = "draft",
      seo_title,
      seo_description,
      published_at,
      category_ids,
      tag_ids,
    } = body

    // 2. Validate mandatory fields
    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Article title is required and cannot be empty." }, { status: 400 })
    }

    // 3. Validate status & enforce publishing authorization
    const requestedStatus: PostStatus = VALID_STATUSES.includes(status as PostStatus)
      ? (status as PostStatus)
      : "draft"

    if (requestedStatus === "published" && !isSuperAdmin) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Only Super Admins have permission to publish articles directly to the live storefront. You may save your work as a draft.",
        },
        { status: 403 }
      )
    }

    // 4. Sanitize and validate slug
    let finalSlug = slug?.trim() ? slugify(slug) : slugify(title)
    if (!finalSlug) {
      finalSlug = `article-${Date.now().toString(36)}`
    }

    // 5. Initialize user-scoped authenticated Supabase server client
    const supabase = await createClient()

    // 6. Check slug collision and make unique
    const { data: existingSlug } = await supabase
      .from("blog_posts")
      .select("id")
      .eq("slug", finalSlug)
      .maybeSingle()

    if (existingSlug) {
      finalSlug = `${finalSlug}-${Date.now().toString(36).slice(-4)}`
    }

    // 7. Validate author: if not provided or empty, resolve default editorial author
    let validAuthorId = author_id?.trim() || null
    if (validAuthorId) {
      const { data: authorCheck } = await supabase
        .from("authors")
        .select("id")
        .eq("id", validAuthorId)
        .maybeSingle()
      if (!authorCheck) {
        validAuthorId = null
      }
    }
    if (!validAuthorId) {
      // Find fallback editorial author
      const { data: defaultAuthor } = await supabase
        .from("authors")
        .select("id")
        .eq("slug", "hiddenbooks-editorial")
        .maybeSingle()
      if (defaultAuthor?.id) {
        validAuthorId = defaultAuthor.id
      }
    }

    // 8. Normalization
    const resolvedImage = (featured_image?.trim() || cover_image_url?.trim() || null) as string | null
    const readingTime = calculateReadingTime(content || "")
    const resolvedPublishedAt =
      requestedStatus === "published"
        ? (published_at ? new Date(published_at).toISOString() : new Date().toISOString())
        : null

    // 9. Persist blog post via authenticated Supabase client enforcing RLS with auth.uid()
    const { data: post, error } = await supabase
      .from("blog_posts")
      .insert({
        title: title.trim(),
        slug: finalSlug,
        excerpt: excerpt?.trim() || null,
        content: content || "",
        featured_image: resolvedImage,
        cover_image_url: resolvedImage,
        custom_css: custom_css?.trim() || null,
        og_image_url: og_image_url?.trim() || resolvedImage,
        focus_keyword: focus_keyword?.trim() || null,
        canonical_url: canonical_url?.trim() || null,
        reading_time_minutes: readingTime,
        author_id: validAuthorId,
        status: requestedStatus,
        seo_title: seo_title?.trim() || title.trim(),
        seo_description: seo_description?.trim() || excerpt?.trim() || null,
        published_at: resolvedPublishedAt,
      })
      .select()
      .single()

    if (error) {
      console.error("[Blog Save Database Error]:", error)
      const isRls = error.code === "42501" || error.message?.includes("policy")
      const isDuplicate = error.code === "23505" || error.message?.includes("unique")
      const statusCode = isRls ? 403 : isDuplicate ? 409 : 500
      const friendlyMessage = isRls
        ? "Permission denied: Database security policy rejected this article operation. Please check your admin privileges."
        : isDuplicate
        ? "An article with this unique identifier or slug already exists."
        : error.message || "Failed to persist article record."
      return NextResponse.json({ error: friendlyMessage, code: error.code }, { status: statusCode })
    }

    // 10. Sync categories
    if (Array.isArray(category_ids) && category_ids.length > 0) {
      const catInserts = category_ids.map((catId: string) => ({
        post_id: post.id,
        category_id: catId,
      }))
      const { error: catErr } = await supabase.from("blog_post_categories").insert(catInserts)
      if (catErr) {
        console.warn("[Blog Category Sync Warning]:", catErr.message)
      }
    }

    // 11. Sync tags
    if (Array.isArray(tag_ids) && tag_ids.length > 0) {
      const tagInserts = tag_ids.map((tagId: string) => ({
        post_id: post.id,
        tag_id: tagId,
      }))
      const { error: tagErr } = await supabase.from("blog_post_tags").insert(tagInserts)
      if (tagErr) {
        console.warn("[Blog Tag Sync Warning]:", tagErr.message)
      }
    }

    return NextResponse.json({ success: true, post })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    console.error("[Blog POST Unhandled Error]:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    // 1. Authenticate calling administrator
    const user = await getCurrentUser()
    const isAdmin = await isCurrentUserAdmin()
    const isSuperAdmin = await isCurrentUserSuperAdmin()

    if (!user || !isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized: Super Admin or Administrator privileges required to manage editorial blog posts." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      id,
      title,
      slug,
      excerpt,
      content,
      featured_image,
      cover_image_url,
      custom_css,
      og_image_url,
      focus_keyword,
      canonical_url,
      author_id,
      status = "draft",
      seo_title,
      seo_description,
      published_at,
      category_ids,
      tag_ids,
    } = body

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Article ID is required for update." }, { status: 400 })
    }

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Article title is required and cannot be empty." }, { status: 400 })
    }

    // 2. Validate status & enforce publishing authorization
    const requestedStatus: PostStatus = VALID_STATUSES.includes(status as PostStatus)
      ? (status as PostStatus)
      : "draft"

    if (requestedStatus === "published" && !isSuperAdmin) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Only Super Admins have permission to publish or unpublish articles. You may save your work as a draft.",
        },
        { status: 403 }
      )
    }

    // 3. Initialize user-scoped authenticated Supabase server client
    const supabase = await createClient()

    // 4. Sanitize and validate slug
    let finalSlug = slug?.trim() ? slugify(slug) : slugify(title)
    if (!finalSlug) {
      finalSlug = `article-${Date.now().toString(36)}`
    }

    // Check slug collision with other posts
    const { data: existingSlug } = await supabase
      .from("blog_posts")
      .select("id")
      .eq("slug", finalSlug)
      .neq("id", id)
      .maybeSingle()

    if (existingSlug) {
      return NextResponse.json(
        { error: `The URL slug "${finalSlug}" is already in use by another article.` },
        { status: 400 }
      )
    }

    // 5. Validate author
    let validAuthorId = author_id?.trim() || null
    if (validAuthorId) {
      const { data: authorCheck } = await supabase
        .from("authors")
        .select("id")
        .eq("id", validAuthorId)
        .maybeSingle()
      if (!authorCheck) {
        validAuthorId = null
      }
    }

    const resolvedImage = (featured_image?.trim() || cover_image_url?.trim() || null) as string | null
    const readingTime = calculateReadingTime(content || "")

    const updateData: Record<string, unknown> = {
      title: title.trim(),
      slug: finalSlug,
      excerpt: excerpt?.trim() || null,
      content: content || "",
      featured_image: resolvedImage,
      cover_image_url: resolvedImage,
      custom_css: custom_css?.trim() || null,
      og_image_url: og_image_url?.trim() || resolvedImage,
      focus_keyword: focus_keyword?.trim() || null,
      canonical_url: canonical_url?.trim() || null,
      reading_time_minutes: readingTime,
      author_id: validAuthorId,
      status: requestedStatus,
      seo_title: seo_title?.trim() || title.trim(),
      seo_description: seo_description?.trim() || excerpt?.trim() || null,
      updated_at: new Date().toISOString(),
    }

    if (requestedStatus === "published") {
      updateData.published_at = published_at ? new Date(published_at).toISOString() : new Date().toISOString()
    } else if (published_at) {
      updateData.published_at = new Date(published_at).toISOString()
    }

    const { data: post, error } = await supabase
      .from("blog_posts")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[Blog Update Database Error]:", error)
      const isRls = error.code === "42501" || error.message?.includes("policy")
      const statusCode = isRls ? 403 : 500
      const friendlyMessage = isRls
        ? "Permission denied: Database security policy rejected this article update. Please check your admin privileges."
        : error.message || "Failed to update article record."
      return NextResponse.json({ error: friendlyMessage, code: error.code }, { status: statusCode })
    }

    // Update categories
    if (Array.isArray(category_ids)) {
      await supabase.from("blog_post_categories").delete().eq("post_id", id)
      if (category_ids.length > 0) {
        const catInserts = category_ids.map((catId: string) => ({
          post_id: id,
          category_id: catId,
        }))
        await supabase.from("blog_post_categories").insert(catInserts)
      }
    }

    // Update tags
    if (Array.isArray(tag_ids)) {
      await supabase.from("blog_post_tags").delete().eq("post_id", id)
      if (tag_ids.length > 0) {
        const tagInserts = tag_ids.map((tagId: string) => ({
          post_id: id,
          tag_id: tagId,
        }))
        await supabase.from("blog_post_tags").insert(tagInserts)
      }
    }

    return NextResponse.json({ success: true, post })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    console.error("[Blog PUT Unhandled Error]:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
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
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Article ID is required for deletion." }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase.from("blog_posts").delete().eq("id", id)

    if (error) {
      console.error("[Blog DELETE Database Error]:", error)
      const isRls = error.code === "42501" || error.message?.includes("policy")
      return NextResponse.json(
        { error: isRls ? "Permission denied deleting article." : error.message },
        { status: isRls ? 403 : 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
