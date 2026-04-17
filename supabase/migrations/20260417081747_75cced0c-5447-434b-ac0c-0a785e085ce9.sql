CREATE TABLE public.meeting_archive (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  video_url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view meetings"
ON public.meeting_archive
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage meetings"
ON public.meeting_archive
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_meeting_archive_updated_at
BEFORE UPDATE ON public.meeting_archive
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();