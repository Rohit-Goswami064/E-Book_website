-- ==============================================================================
-- HiddenBooks: Granular RLS Policies on publication_assets Table
-- Migration: 20261028000002_publication_assets_rls.sql
-- ==============================================================================

-- 1. Ensure RLS is active on publication_assets
ALTER TABLE public.publication_assets ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to refine them
DROP POLICY IF EXISTS "Admins manage publication assets" ON public.publication_assets;
DROP POLICY IF EXISTS "Super admins can insert publication assets" ON public.publication_assets;
DROP POLICY IF EXISTS "Admins can update publication assets" ON public.publication_assets;
DROP POLICY IF EXISTS "Admins can delete publication assets" ON public.publication_assets;
DROP POLICY IF EXISTS "Entitled users access publication assets" ON public.publication_assets;

-- 3. Dedicated INSERT policy: Only authenticated Super Admin / Admin users, verifying publication exists
CREATE POLICY "Super admins can insert publication assets" ON public.publication_assets
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_super_admin(auth.uid()) OR public.is_admin(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.books b
      WHERE b.id = publication_assets.publication_id
    )
  );

-- 4. Dedicated UPDATE policy: Only authenticated Super Admin / Admin users
CREATE POLICY "Admins can update publication assets" ON public.publication_assets
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 5. Dedicated DELETE policy: Only authenticated Super Admin / Admin users
CREATE POLICY "Admins can delete publication assets" ON public.publication_assets
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 6. Dedicated SELECT policy: Super Admins can see all; Entitled users see completed assets
CREATE POLICY "Entitled users access publication assets" ON public.publication_assets
  FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR (
      upload_status = 'completed'
      AND (
        EXISTS (
          SELECT 1 FROM public.book_entitlements be
          WHERE be.book_id = publication_assets.publication_id
            AND be.user_id = auth.uid()
            AND be.is_revoked = false
        )
        OR EXISTS (
          SELECT 1 FROM public.books b
          WHERE b.id = publication_assets.publication_id
            AND b.is_free = true
            AND b.is_published = true
        )
      )
    )
  );
