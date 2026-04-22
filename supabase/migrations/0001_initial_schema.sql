-- 1. Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create ENUM types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('student', 'mentor', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE attendance_status AS ENUM ('Present', 'Absent', 'Excused');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE risk_level AS ENUM ('Low', 'Medium', 'High');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Create all 9 tables with proper constraints, foreign keys, and ON DELETE behavior

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  branch TEXT NOT NULL,
  semester SMALLINT NOT NULL CHECK (semester BETWEEN 1 AND 8),
  mentor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  avatar_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  semester SMALLINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, mentor_id, academic_year, semester)
);

CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, class_id)
);

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  status attendance_status NOT NULL DEFAULT 'Present',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, class_id, date)
);

CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  internal_marks NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (internal_marks BETWEEN 0 AND 50),
  external_marks NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (external_marks BETWEEN 0 AND 50),
  total_score NUMERIC(5,2) GENERATED ALWAYS AS (internal_marks + external_marks) STORED,
  grade TEXT GENERATED ALWAYS AS (
    CASE
      WHEN (internal_marks + external_marks) >= 85 THEN 'A'
      WHEN (internal_marks + external_marks) >= 70 THEN 'B'
      WHEN (internal_marks + external_marks) >= 55 THEN 'C'
      WHEN (internal_marks + external_marks) >= 40 THEN 'D'
      ELSE 'F'
    END
  ) STORED,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, class_id)
);

CREATE TABLE IF NOT EXISTS timetables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL CHECK (end_time > start_time),
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  deep_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES notification_messages(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, message_id)
);

-- 4. Create indexes for query performance
CREATE INDEX IF NOT EXISTS idx_attendance_student_class ON attendance(student_id, class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_class ON enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_read ON user_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_timetables_class_day ON timetables(class_id, day_of_week);

-- 5. Profile creation is handled client-side after signup (see AuthContext.tsx).
-- The trigger approach was removed because it fails in Supabase's managed auth
-- transaction when the enum cast encounters edge cases.
-- The handle_new_user function is kept for reference but NOT attached as a trigger.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role := 'student';
  v_semester smallint := 1;
BEGIN
  BEGIN
    v_role := (NEW.raw_user_meta_data->>'role')::user_role;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'student';
  END;

  BEGIN
    v_semester := (NEW.raw_user_meta_data->>'semester')::smallint;
  EXCEPTION WHEN OTHERS THEN
    v_semester := 1;
  END;

  INSERT INTO public.profiles (id, full_name, role, branch, semester)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(v_role, 'student'::user_role),
    COALESCE(NEW.raw_user_meta_data->>'branch', 'General'),
    COALESCE(v_semester, 1::smallint)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger intentionally NOT created. Profile is created client-side.
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 6. Create updated_at auto-update trigger for grades and profiles
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN 
  NEW.updated_at = NOW(); 
  RETURN NEW; 
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_grades_updated_at ON grades;
CREATE TRIGGER set_grades_updated_at 
  BEFORE UPDATE ON grades
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON profiles;
CREATE TRIGGER set_profiles_updated_at 
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
