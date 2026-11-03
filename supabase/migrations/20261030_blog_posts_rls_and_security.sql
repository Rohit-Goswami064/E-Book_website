-- ==============================================================================
-- HiddenBooks: Granular RLS Policies on blog_posts and Editorial Tables
-- Migration: 20261030_blog_posts_rls_and_security.sql
-- ==============================================================================

-- 1. Ensure RLS is active on blog_posts and related tables
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authors ENABLE ROW LEVEL SECURITY;

-- 2. Drop legacy and obsolete policies
DROP POLICY IF EXISTS "Admins can manage blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Public can view published blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Public can view published blog posts, Admins can view all" ON public.blog_posts;
DROP POLICY IF EXISTS "Super admins can insert blog posts, admins can insert drafts" ON public.blog_posts;
DROP POLICY IF EXISTS "Super admins can update any blog post, admins can update drafts" ON public.blog_posts;
DROP POLICY IF EXISTS "Super admins and admins can delete blog posts" ON public.blog_posts;

-- 3. SELECT policy:
-- Public visitors (anon + authenticated customers) can view ONLY published blog posts.
-- Administrators (admin + super_admin) can view all blog posts (drafts, published, scheduled).
CREATE POLICY "Public can view published blog posts, Admins can view all"
ON public.blog_posts
FOR SELECT
TO public
USING (
  (status = 'published'::post_status_type)
  OR public.is_admin(auth.uid())
);

-- 4. INSERT policy:
-- Super Admins can insert any blog post (draft or published).
-- Admins can insert draft blog posts.
-- Non-admin users (customers, anon) cannot insert any blog posts.
CREATE POLICY "Super admins can insert blog posts, admins can insert drafts"
ON public.blog_posts
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (public.is_admin(auth.uid()) AND status = 'draft'::post_status_type)
);

-- 5. UPDATE policy:
-- Super Admins can update any blog post and publish/unpublish articles.
-- Admins can update blog posts as long as the status remains 'draft'.
-- Non-admin users cannot update any blog post.
CREATE POLICY "Super admins can update any blog post, admins can update drafts"
ON public.blog_posts
FOR UPDATE
TO authenticated
USING (
  public.is_admin(auth.uid())
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (public.is_admin(auth.uid()) AND status = 'draft'::post_status_type)
);

-- 6. DELETE policy:
-- Only administrators (admin and super_admin) can delete blog posts.
CREATE POLICY "Super admins and admins can delete blog posts"
ON public.blog_posts
FOR DELETE
TO authenticated
USING (
  public.is_admin(auth.uid())
);

-- 7. Ensure junction table RLS policies for blog categories and tags
DROP POLICY IF EXISTS "Admins can manage blog post categories" ON public.blog_post_categories;
DROP POLICY IF EXISTS "Public can view blog post categories" ON public.blog_post_categories;

CREATE POLICY "Public can view blog post categories"
ON public.blog_post_categories
FOR SELECT
TO public
USING (true);

CREATE POLICY "Admins can manage blog post categories"
ON public.blog_post_categories
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage blog post tags" ON public.blog_post_tags;
DROP POLICY IF EXISTS "Public can view blog post tags" ON public.blog_post_tags;

CREATE POLICY "Public can view blog post tags"
ON public.blog_post_tags
FOR SELECT
TO public
USING (true);

CREATE POLICY "Admins can manage blog post tags"
ON public.blog_post_tags
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 8. Safe function to increment view count for published articles (prevents public tampering)
CREATE OR REPLACE FUNCTION public.increment_blog_post_view_count(post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.blog_posts
  SET view_count = view_count + 1
  WHERE id = post_id AND status = 'published';
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_blog_post_view_count(uuid) TO anon, authenticated;

-- 9. Explicit grants
GRANT SELECT ON public.blog_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT SELECT ON public.blog_post_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.blog_post_categories TO authenticated;
GRANT SELECT ON public.blog_post_tags TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.blog_post_tags TO authenticated;
GRANT SELECT ON public.blog_categories TO anon, authenticated;
GRANT SELECT ON public.blog_tags TO anon, authenticated;
GRANT SELECT ON public.authors TO anon, authenticated;

-- 10. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
