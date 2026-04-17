ALTER TABLE public.meeting_archive
ADD COLUMN oil_id UUID REFERENCES public.oils(id) ON DELETE SET NULL;

CREATE INDEX idx_meeting_archive_oil_id ON public.meeting_archive(oil_id);

DROP POLICY IF EXISTS "Authenticated can view meetings" ON public.meeting_archive;

CREATE POLICY "Users can view accessible meetings"
ON public.meeting_archive
FOR SELECT
TO authenticated
USING (
  oil_id IS NULL OR has_oil_access(auth.uid(), oil_id)
);