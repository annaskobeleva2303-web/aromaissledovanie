ALTER TABLE public.entries ADD COLUMN is_public boolean NOT NULL DEFAULT false;

CREATE POLICY "Users can view public entries for accessible oils"
ON public.entries FOR SELECT TO authenticated
USING (is_public = true AND has_oil_access(auth.uid(), oil_id));