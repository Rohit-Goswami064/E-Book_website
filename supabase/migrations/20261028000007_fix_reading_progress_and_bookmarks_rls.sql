-- ==============================================================================
-- Fix reading_progress and bookmarks RLS policies with explicit WITH CHECK
-- Migration: 20261028000007_fix_reading_progress_and_bookmarks_rls.sql
-- ==============================================================================

-- 1. READING PROGRESS
ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reading progress" ON public.reading_progress;
DROP POLICY IF EXISTS "Users can upsert own reading progress" ON public.reading_progress;
DROP POLICY IF EXISTS "Users and admins can view reading progress" ON public.reading_progress;
DROP POLICY IF EXISTS "Users and admins can upsert reading progress" ON public.reading_progress;

CREATE POLICY "Users and admins can view reading progress" ON public.reading_progress
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users and admins can upsert reading progress" ON public.reading_progress
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));


-- 2. BOOKMARKS
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can manage own bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Users and admins can view bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Users and admins can manage bookmarks" ON public.bookmarks;

CREATE POLICY "Users and admins can view bookmarks" ON public.bookmarks
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users and admins can manage bookmarks" ON public.bookmarks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
