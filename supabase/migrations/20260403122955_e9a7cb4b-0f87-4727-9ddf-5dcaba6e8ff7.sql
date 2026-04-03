CREATE POLICY "Users can insert own access via activation"
ON public.user_access
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);