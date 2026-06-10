-- 1. Remove direct INSERT on user_access (privilege escalation): access must go through redeem_activation_code
DROP POLICY IF EXISTS "Users can insert own access via activation" ON public.user_access;

-- 2. Replace the broad public read policy on oil-media with an access-verified one
DROP POLICY IF EXISTS "Public can read oil-media" ON storage.objects;

CREATE POLICY "Users with oil access can read oil-media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'oil-media'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.oil_media om
      WHERE om.oil_id IS NOT NULL
        AND om.file_url LIKE '%/oil-media/' || storage.objects.name
        AND public.has_oil_access(auth.uid(), om.oil_id)
    )
  )
);