
CREATE TYPE public.report_type AS ENUM ('weekly', 'final');

CREATE TABLE public.group_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oil_id uuid NOT NULL,
  report_type public.report_type NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  report_text text NOT NULL,
  generated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (oil_id, report_type, period_start)
);

CREATE INDEX idx_group_reports_oil_type ON public.group_reports (oil_id, report_type, period_start DESC);

ALTER TABLE public.group_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reports for accessible oils"
ON public.group_reports
FOR SELECT
TO authenticated
USING (public.has_oil_access(auth.uid(), oil_id));

CREATE POLICY "Admins can manage reports"
ON public.group_reports
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
