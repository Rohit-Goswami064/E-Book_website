-- ==============================================================================
-- HiddenBooks Cloudflare R2 Publication Assets Schema & Policies
-- Migration: 20261028000000_cloudflare_r2_assets.sql
-- ==============================================================================

-- 1. Create publication_assets table
CREATE TABLE IF NOT EXISTS public.publication_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('pdf', 'epub', 'audiobook', 'audio_chapter', 'video')),
  storage_provider TEXT NOT NULL DEFAULT 'r2',
  bucket_name TEXT NOT NULL,
  object_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size >= 0),
  upload_status TEXT NOT NULL DEFAULT 'pending' CHECK (upload_status IN ('pending', 'completed', 'failed', 'archived')),
  is_downloadable BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_publication_assets_pub_type ON public.publication_assets(publication_id, asset_type);
CREATE INDEX IF NOT EXISTS idx_publication_assets_status ON public.publication_assets(upload_status);
CREATE INDEX IF NOT EXISTS idx_publication_assets_object_key ON public.publication_assets(object_key);

-- 3. Row Level Security
ALTER TABLE public.publication_assets ENABLE ROW LEVEL SECURITY;

-- Admins and super admins can manage publication assets
DROP POLICY IF EXISTS "Admins manage publication assets" ON public.publication_assets;
CREATE POLICY "Admins manage publication assets" ON public.publication_assets
  FOR ALL USING (public.is_admin(auth.uid()));

-- Entitled readers or viewers of free publications can read completed assets
DROP POLICY IF EXISTS "Entitled users access publication assets" ON public.publication_assets;
CREATE POLICY "Entitled users access publication assets" ON public.publication_assets
  FOR SELECT USING (
    upload_status = 'completed' AND (
      public.is_admin(auth.uid()) OR EXISTS (
        SELECT 1 FROM public.book_entitlements be
        WHERE be.book_id = publication_assets.publication_id
          AND be.user_id = auth.uid()
          AND be.is_revoked = false
      ) OR EXISTS (
        SELECT 1 FROM public.books b
        WHERE b.id = publication_assets.publication_id
          AND b.is_free = true
          AND b.is_published = true
      )
    )
  );

-- 4. Trigger for updated_at
DROP TRIGGER IF EXISTS set_publication_assets_updated_at ON public.publication_assets;
CREATE TRIGGER set_publication_assets_updated_at
  BEFORE UPDATE ON public.publication_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
