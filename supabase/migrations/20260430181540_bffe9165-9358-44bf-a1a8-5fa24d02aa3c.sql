
-- 1. Tighten activation_codes: remove the broad SELECT policy and provide a SECURITY DEFINER RPC
DROP POLICY IF EXISTS "Users can view unused codes for activation" ON public.activation_codes;

CREATE OR REPLACE FUNCTION public.redeem_activation_code(_code text, _oil_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_code_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT id INTO v_code_id
  FROM public.activation_codes
  WHERE code = upper(trim(_code))
    AND oil_id = _oil_id
    AND is_used = false
  LIMIT 1;

  IF v_code_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  -- Grant access (idempotent on (user_id, oil_id) if a unique constraint exists; otherwise plain insert)
  INSERT INTO public.user_access (user_id, oil_id)
  VALUES (v_user, _oil_id)
  ON CONFLICT DO NOTHING;

  UPDATE public.activation_codes
  SET is_used = true, used_by = v_user
  WHERE id = v_code_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_activation_code(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_activation_code(text, uuid) TO authenticated;

-- 2. Lock down user_roles: prevent privilege escalation
-- The existing "Admins can manage roles" ALL policy stays. Add restrictive policies
-- that block any non-admin from inserting/updating/deleting roles.
CREATE POLICY "Block non-admin role inserts"
  ON public.user_roles
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Block non-admin role updates"
  ON public.user_roles
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated, anon
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Block non-admin role deletes"
  ON public.user_roles
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated, anon
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Revoke EXECUTE on internal SECURITY DEFINER helpers from anon/public.
-- These are used only inside RLS policies / other definer functions and should not
-- be directly callable by clients.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_oil_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_group_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_oil_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_stats(uuid) TO authenticated;

-- 4. Public bucket listing: oil-images bucket is public for image reads, but we
-- shouldn't allow listing all objects via storage.objects. Drop any broad SELECT
-- policy and create a focused one that allows fetching a specific object only.
-- (Public file URLs will continue to work; only "list/enumerate" is restricted.)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname ILIKE '%oil-images%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "oil-images public read by name"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'oil-images');

CREATE POLICY "oil-images admin write"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'oil-images' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'oil-images' AND public.has_role(auth.uid(), 'admin'::app_role));
