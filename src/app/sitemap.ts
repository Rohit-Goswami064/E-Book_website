import { MetadataRoute } from "next"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hiddenbooks.com"
  const adminClient = createAdminClient()

  // 1. Static public indexable routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${siteUrl}/books`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/free-books`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/faq`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/refund-policy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ]

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || supabaseUrl.includes("placeholder")) {
    return staticRoutes
  }

  // 2. Fetch published books
  const { data: books } = await adminClient
    .from("books")
    .select("slug, updated_at")
    .eq("is_published", true)

  const bookUrls: MetadataRoute.Sitemap = ((books as any[]) || []).map((b) => ({
    url: `${siteUrl}/books/${b.slug}`,
    lastModified: b.updated_at ? new Date(b.updated_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }))

  // 3. Fetch published blog posts
  const { data: posts } = await adminClient
    .from("blog_posts")
    .select("slug, updated_at, published_at")
    .eq("status", "published")

  const blogUrls: MetadataRoute.Sitemap = ((posts as any[]) || []).map((p) => ({
    url: `${siteUrl}/blog/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }))

  // 4. Fetch categories
  const { data: categories } = await adminClient
    .from("categories")
    .select("slug")

  const categoryUrls: MetadataRoute.Sitemap = ((categories as any[]) || []).map((c) => ({
    url: `${siteUrl}/categories/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.6,
  }))

  // 5. Fetch authors
  const { data: authors } = await adminClient
    .from("authors")
    .select("slug")

  const authorUrls: MetadataRoute.Sitemap = ((authors as any[]) || []).map((a) => ({
    url: `${siteUrl}/authors/${a.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  }))

  return [...staticRoutes, ...bookUrls, ...blogUrls, ...categoryUrls, ...authorUrls]
}
