-- Create oil_media table
CREATE TABLE public.oil_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  oil_id UUID NOT NULL REFERENCES public.oils(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'meditation',
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_oil_media_oil_id ON public.oil_media(oil_id, order_index);

ALTER TABLE public.oil_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view oil_media"
ON public.oil_media FOR SELECT
TO authenticated
USING (has_oil_access(auth.uid(), oil_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage oil_media"
ON public.oil_media FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create public bucket for oil media (audio meditations etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('oil-media', 'oil-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "Public can read oil-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'oil-media');

CREATE POLICY "Admins can upload oil-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'oil-media' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update oil-media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'oil-media' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete oil-media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'oil-media' AND has_role(auth.uid(), 'admin'::app_role));