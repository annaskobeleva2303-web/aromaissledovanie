CREATE POLICY "Admins can upload oil images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'oil-images' AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update oil images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'oil-images' AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete oil images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'oil-images' AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Anyone can view oil images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'oil-images');