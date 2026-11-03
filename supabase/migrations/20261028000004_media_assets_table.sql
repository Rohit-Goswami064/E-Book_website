-- ==============================================================================
-- HiddenBooks Cloudinary Media Assets Schema & Policies
-- Migration: 20261028000004_media_assets_table.sql
-- ==============================================================================

-- 1. Create media_assets table for Cloudinary public assets
CREATE TABLE IF NOT EXISTS public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL UNIQUE,
  secure_url TEXT NOT NULL,
  url TEXT,
  resource_type TEXT NOT NULL DEFAULT 'image' CHECK (resource_type IN ('image', 'video', 'raw')),
  format TEXT,
  width INTEGER,
  height INTEGER,
  bytes BIGINT CHECK (bytes >= 0),
  duration NUMERIC(10, 2), -- video duration in seconds
  folder TEXT,
  asset_type TEXT NOT NULL DEFAULT 'other' CHECK (asset_type IN ('book_cover', 'blog_cover', 'blog_inline', 'author_avatar', 'homepage_banner', 'promo_video', 'other')),
  publication_id UUID REFERENCES public.books(id) ON DELETE SET NULL,
  blog_post_id UUID REFERENCES public.blog_posts(id) ON DELETE SET NULL,
  author_id UUID REFERENCES public.authors(id) ON DELETE SET NULL,
  homepage_section_id UUID REFERENCES public.homepage_sections(id) ON DELETE SET NULL,
  alt_text TEXT,
  caption TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_media_assets_public_id ON public.media_assets(public_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_asset_type ON public.media_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_media_assets_publication_id ON public.media_assets(publication_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_blog_post_id ON public.media_assets(blog_post_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_author_id ON public.media_assets(author_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON public.media_assets(created_at DESC);

-- 3. Row Level Security
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public can view media assets" ON public.media_assets;
DROP POLICY IF EXISTS "Super admins can insert media assets" ON public.media_assets;
DROP POLICY IF EXISTS "Admins can update media assets" ON public.media_assets;
DROP POLICY IF EXISTS "Admins can delete media assets" ON public.media_assets;

-- Public read access: Anyone can view public media assets
CREATE POLICY "Public can view media assets" ON public.media_assets
  FOR SELECT
  USING (true);

-- Super admin / Admin insert:
CREATE POLICY "Super admins can insert media assets" ON public.media_assets
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR public.is_admin(auth.uid())
  );

-- Admin update:
CREATE POLICY "Admins can update media assets" ON public.media_assets
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Admin delete:
CREATE POLICY "Admins can delete media assets" ON public.media_assets
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 4. Trigger for updated_at
DROP TRIGGER IF EXISTS set_media_assets_updated_at ON public.media_assets;
CREATE TRIGGER set_media_assets_updated_at
  BEFORE UPDATE ON public.media_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
