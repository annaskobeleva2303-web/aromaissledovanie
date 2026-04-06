ALTER TABLE public.oils ADD COLUMN IF NOT EXISTS properties text;
ALTER TABLE public.oils ADD COLUMN IF NOT EXISTS usage text;
ALTER TABLE public.oils ADD COLUMN IF NOT EXISTS cautions text;