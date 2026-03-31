
-- ============================================
-- Essence Lab: Full Schema Migration
-- ============================================

-- 1. Role enum & user_roles table
CREATE TYPE public.app_role AS ENUM ('user', 'admin');

-- 2. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. User roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

-- 4. Oils catalog
CREATE TABLE public.oils (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  focus TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. User access to oils
CREATE TABLE public.user_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  oil_id UUID NOT NULL REFERENCES public.oils(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, oil_id)
);

-- 6. Diary entries
CREATE TABLE public.entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  oil_id UUID NOT NULL REFERENCES public.oils(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  content TEXT NOT NULL,
  mood TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Personal AI summaries
CREATE TABLE public.personal_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  oil_id UUID NOT NULL REFERENCES public.oils(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  summary_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Group trends
CREATE TABLE public.group_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oil_id UUID NOT NULL REFERENCES public.oils(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  trend_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Trigger: auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname)
  VALUES (NEW.id, split_part(NEW.email, '@', 1));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Security definer functions
-- ============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_oil_access(_user_id UUID, _oil_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_access
    WHERE user_id = _user_id AND oil_id = _oil_id
  )
$$;

-- ============================================
-- Updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_entries_updated_at
  BEFORE UPDATE ON public.entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.oils ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view active oils" ON public.oils FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins can manage oils" ON public.oils FOR ALL USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own access" ON public.user_access FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage access" ON public.user_access FOR ALL USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own entries" ON public.entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create entries" ON public.entries FOR INSERT WITH CHECK (auth.uid() = user_id AND public.has_oil_access(auth.uid(), oil_id));
CREATE POLICY "Users can update own entries" ON public.entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own entries" ON public.entries FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.personal_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own summaries" ON public.personal_summaries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert summaries" ON public.personal_summaries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.group_trends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view trends" ON public.group_trends FOR SELECT TO authenticated USING (public.has_oil_access(auth.uid(), oil_id));
CREATE POLICY "Admins can manage trends" ON public.group_trends FOR ALL USING (public.has_role(auth.uid(), 'admin'));
