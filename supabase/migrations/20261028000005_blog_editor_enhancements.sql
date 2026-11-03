-- ==============================================================================
-- HiddenBooks Blog Posts Schema Enhancements: featured_image & Custom CSS
-- Migration: 20261028000005_blog_editor_enhancements.sql
-- ==============================================================================

-- 1. Add featured_image, custom_css, og_image_url, and focus_keyword columns
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS featured_image TEXT,
  ADD COLUMN IF NOT EXISTS custom_css TEXT,
  ADD COLUMN IF NOT EXISTS og_image_url TEXT,
  ADD COLUMN IF NOT EXISTS focus_keyword TEXT;

-- 2. Populate featured_image from existing cover_image_url if present
UPDATE public.blog_posts
SET featured_image = cover_image_url
WHERE featured_image IS NULL AND cover_image_url IS NOT NULL;

-- 3. Trigger function to ensure cover_image_url and featured_image stay in sync
CREATE OR REPLACE FUNCTION public.sync_blog_post_image_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.featured_image IS NOT NULL AND NEW.cover_image_url IS NULL THEN
    NEW.cover_image_url := NEW.featured_image;
  ELSIF NEW.cover_image_url IS NOT NULL AND NEW.featured_image IS NULL THEN
    NEW.featured_image := NEW.cover_image_url;
  ELSIF NEW.featured_image IS NOT NULL AND NEW.cover_image_url IS NOT NULL AND NEW.featured_image <> OLD.featured_image THEN
    NEW.cover_image_url := NEW.featured_image;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_blog_post_image_fields ON public.blog_posts;
CREATE TRIGGER trg_sync_blog_post_image_fields
  BEFORE INSERT OR UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.sync_blog_post_image_fields();

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
