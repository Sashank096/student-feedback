-- Campus Feedback Analyzer — final text-first schema
-- Run only after the UI/flow has been reviewed.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('student','admin')) DEFAULT 'student',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(COALESCE(NEW.email,''),'@',1)),
    NEW.email,
    CASE WHEN lower(COALESCE(NEW.email,'')) = 'admin@studentfeedback.in' THEN 'admin' ELSE 'student' END
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE IF NOT EXISTS feedbacks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  student_name TEXT,
  text TEXT NOT NULL CHECK (length(trim(text)) > 0),
  -- The following are system-derived fields; students never select them.
  aspect TEXT,
  detected_aspect TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive','neutral','negative','pending')) DEFAULT 'pending',
  confidence DOUBLE PRECISION,
  sentiment_scores JSONB,
  priority TEXT CHECK (priority IN ('High','Medium','Low')),
  ml_pipeline_stages TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feedback_id UUID REFERENCES feedbacks(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  admin_name TEXT,
  action_note TEXT NOT NULL,
  status TEXT CHECK (status IN ('Assigned','In Progress','Resolved')) DEFAULT 'Assigned',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own student profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Students can view own feedback" ON feedbacks;
DROP POLICY IF EXISTS "Admins can view all feedback" ON feedbacks;
DROP POLICY IF EXISTS "Students can insert feedback" ON feedbacks;
DROP POLICY IF EXISTS "Admins can view all actions" ON actions;
DROP POLICY IF EXISTS "Admins can insert actions" ON actions;
DROP POLICY IF EXISTS "Admins can update actions" ON actions;

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT
USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can insert own student profile" ON profiles FOR INSERT
WITH CHECK (auth.uid() = id AND role = 'student');

CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (
  (auth.uid() = id AND role = 'student') OR public.is_admin()
);

CREATE POLICY "Students can view own feedback" ON feedbacks FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Admins can view all feedback" ON feedbacks FOR SELECT
USING (public.is_admin());

CREATE POLICY "Students can insert feedback" ON feedbacks FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Admins can view all actions" ON actions FOR SELECT
USING (public.is_admin());

CREATE POLICY "Admins can insert actions" ON actions FOR INSERT
WITH CHECK (public.is_admin() AND auth.uid() = admin_id);

CREATE POLICY "Admins can update actions" ON actions FOR UPDATE
USING (public.is_admin() AND auth.uid() = admin_id)
WITH CHECK (public.is_admin() AND auth.uid() = admin_id);

-- Admin account to create in Supabase Auth:
-- Email: admin@studentfeedback.in
-- Set a strong password privately in Supabase Auth. Do not commit it here.
-- Students have no admin-registration path in the application.
