import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { BlogForm } from "@/components/admin/blog-form"

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: post, error } = await supabase
    .from("blog_posts")
    .select(`
      *,
      blog_post_categories(category_id),
      blog_post_tags(tag_id)
    `)
    .eq("id", id)
    .single()

  if (error || !post) {
    notFound()
  }

  const initialData = {
    ...post,
    category_ids: (post.blog_post_categories as any[])?.map((c: any) => c.category_id) || [],
    tag_ids: (post.blog_post_tags as any[])?.map((t: any) => t.tag_id) || [],
  }

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      <BlogForm initialData={initialData} />
    </div>
  )
}
