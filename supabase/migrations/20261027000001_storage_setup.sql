-- ==============================================================================
-- HiddenBooks Supabase Storage Setup & Policies
-- Migration: 20261027000001_storage_setup.sql
-- ==============================================================================

-- 1. Create public buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('book-covers', 'book-covers', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('blog-images', 'blog-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('author-avatars', 'author-avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 2. Create strictly private bucket for digital eBook files (PDF, EPUB, MP3/Audio)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('book-files', 'book-files', false, 104857600, ARRAY['application/pdf', 'application/epub+zip', 'audio/mpeg', 'audio/mp4'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies:
-- Public buckets allow anyone to read
CREATE POLICY "Public read book-covers" ON storage.objects FOR SELECT USING (bucket_id = 'book-covers');
CREATE POLICY "Public read blog-images" ON storage.objects FOR SELECT USING (bucket_id = 'blog-images');
CREATE POLICY "Public read author-avatars" ON storage.objects FOR SELECT USING (bucket_id = 'author-avatars');

-- Admin can upload/manage public buckets
CREATE POLICY "Admin manage book-covers" ON storage.objects FOR ALL USING (bucket_id = 'book-covers' AND public.is_admin(auth.uid()));
CREATE POLICY "Admin manage blog-images" ON storage.objects FOR ALL USING (bucket_id = 'blog-images' AND public.is_admin(auth.uid()));
CREATE POLICY "Admin manage author-avatars" ON storage.objects FOR ALL USING (bucket_id = 'author-avatars' AND public.is_admin(auth.uid()));

-- Private book-files bucket: ONLY Admin or authenticated entitled users via signed url
CREATE POLICY "Admin manage private book-files" ON storage.objects FOR ALL USING (bucket_id = 'book-files' AND public.is_admin(auth.uid()));
CREATE POLICY "Entitled users access private book-files" ON storage.objects FOR SELECT USING (
  bucket_id = 'book-files' AND (
    public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.book_files bf
      JOIN public.book_entitlements be ON be.book_id = bf.book_id
      WHERE bf.storage_path = storage.objects.name
      AND be.user_id = auth.uid()
      AND be.is_revoked = false
    )
  )
);
