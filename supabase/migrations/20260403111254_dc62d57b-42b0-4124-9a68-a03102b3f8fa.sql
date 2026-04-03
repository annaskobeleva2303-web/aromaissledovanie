
DROP POLICY "System can insert notifications" ON public.notifications;

CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);
