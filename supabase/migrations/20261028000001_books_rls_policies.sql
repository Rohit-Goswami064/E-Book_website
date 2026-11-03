-- ==============================================================================
-- HiddenBooks: Granular RLS Policies on books Table
-- Migration: 20261028000001_books_rls_policies.sql
-- ==============================================================================

-- 1. Ensure RLS is active on books
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

-- 2. Drop legacy generic policy
DROP POLICY IF EXISTS "Admins can manage books" ON public.books;
DROP POLICY IF EXISTS "Super admins can insert books" ON public.books;
DROP POLICY IF EXISTS "Admins can update books" ON public.books;
DROP POLICY IF EXISTS "Admins can delete books" ON public.books;
DROP POLICY IF EXISTS "Public can view published books" ON public.books;

-- 3. Dedicated INSERT policy: Only authenticated Super Admin / Admin users
CREATE POLICY "Super admins can insert books" ON public.books
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR public.is_admin(auth.uid())
  );

-- 4. Dedicated UPDATE policy: Only authenticated Super Admin / Admin users
CREATE POLICY "Admins can update books" ON public.books
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 5. Dedicated DELETE policy: Only authenticated Super Admin / Admin users
CREATE POLICY "Admins can delete books" ON public.books
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 6. Dedicated SELECT policy: Public can view published books, Admins can view all
CREATE POLICY "Public can view published books" ON public.books
  FOR SELECT
  USING (
    (is_published = true) OR public.is_admin(auth.uid())
  );
