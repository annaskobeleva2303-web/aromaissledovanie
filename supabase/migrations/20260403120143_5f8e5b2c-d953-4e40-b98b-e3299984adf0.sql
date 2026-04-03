
CREATE TABLE public.activation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  oil_id uuid NOT NULL REFERENCES public.oils(id) ON DELETE CASCADE,
  is_used boolean NOT NULL DEFAULT false,
  used_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activation_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage codes"
  ON public.activation_codes FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view unused codes for activation"
  ON public.activation_codes FOR SELECT
  TO authenticated
  USING (is_used = false);
