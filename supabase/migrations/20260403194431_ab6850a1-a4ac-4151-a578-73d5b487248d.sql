ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS energy_before integer,
  ADD COLUMN IF NOT EXISTS mood_score_before integer,
  ADD COLUMN IF NOT EXISTS energy_after integer,
  ADD COLUMN IF NOT EXISTS mood_score_after integer,
  ADD COLUMN IF NOT EXISTS oil_body_location text,
  ADD COLUMN IF NOT EXISTS oil_sensation text,
  ADD COLUMN IF NOT EXISTS oil_visual_image text,
  ADD COLUMN IF NOT EXISTS record_type text NOT NULL DEFAULT 'full';