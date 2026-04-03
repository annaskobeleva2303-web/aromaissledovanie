
CREATE OR REPLACE FUNCTION public.send_welcome_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message)
  VALUES (
    NEW.id,
    'Добро пожаловать в Живые Смыслы! ✨',
    'Я рада начать это исследование вместе с вами. Загляните в карточку масла, выберите то, что откликается сегодня, и начните свой путь открытий. Я буду рядом!'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_welcome
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.send_welcome_notification();
