-- Migration: Create IAT (Internal Assessment Test) Marks table
-- IAT marks are entered by mentors and read-only for students

CREATE TABLE IF NOT EXISTS iat_marks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  iat_number SMALLINT NOT NULL CHECK (iat_number IN (1, 2)),
  marks_obtained NUMERIC(5,2) NOT NULL CHECK (marks_obtained BETWEEN 0 AND 50),
  max_marks NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (max_marks > 0),
  remarks TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, class_id, iat_number)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_iat_marks_student ON iat_marks(student_id);
CREATE INDEX IF NOT EXISTS idx_iat_marks_class ON iat_marks(class_id);

-- Enable RLS
ALTER TABLE iat_marks ENABLE ROW LEVEL SECURITY;

-- RLS: Students can only read their own IAT marks
CREATE POLICY "students_select_own_iat_marks" ON iat_marks
FOR SELECT USING (student_id = auth.uid());

-- RLS: Mentors can read IAT marks of their assigned students
CREATE POLICY "mentors_select_assigned_iat_marks" ON iat_marks
FOR SELECT USING (
  public.user_role() = 'mentor' AND
  student_id IN (SELECT id FROM profiles WHERE mentor_id = auth.uid())
);

-- RLS: Mentors can insert IAT marks for their assigned students
CREATE POLICY "mentors_insert_iat_marks" ON iat_marks
FOR INSERT WITH CHECK (
  public.user_role() = 'mentor' AND
  student_id IN (SELECT id FROM profiles WHERE mentor_id = auth.uid())
);

-- RLS: Mentors can update IAT marks for their assigned students
CREATE POLICY "mentors_update_iat_marks" ON iat_marks
FOR UPDATE USING (
  public.user_role() = 'mentor' AND
  student_id IN (SELECT id FROM profiles WHERE mentor_id = auth.uid())
) WITH CHECK (
  public.user_role() = 'mentor' AND
  student_id IN (SELECT id FROM profiles WHERE mentor_id = auth.uid())
);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS set_iat_marks_updated_at ON iat_marks;
CREATE TRIGGER set_iat_marks_updated_at
  BEFORE UPDATE ON iat_marks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
