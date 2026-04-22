-- Allow students to read their assigned mentor's profile
-- This fixes the 406 (Not Acceptable) error when the timetable page
-- tries to display mentor names.

-- Policy 1: Students can read their directly assigned mentor profile
CREATE POLICY "students_select_assigned_mentor" ON profiles
FOR SELECT USING (
  public.user_role() = 'student' AND 
  id = (SELECT mentor_id FROM profiles WHERE id = auth.uid())
);

-- Policy 2: Students can read mentor profiles for their enrolled classes
-- Uses SECURITY DEFINER helper function to avoid RLS recursion
CREATE OR REPLACE FUNCTION get_class_mentor_ids(p_student_id UUID)
RETURNS SETOF UUID AS $$
  SELECT DISTINCT c.mentor_id 
  FROM classes c 
  INNER JOIN enrollments e ON e.class_id = c.id 
  WHERE e.student_id = p_student_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_class_mentor_ids(UUID) TO authenticated;

CREATE POLICY "students_select_class_mentors" ON profiles
FOR SELECT USING (
  public.user_role() = 'student' AND
  id IN (SELECT get_class_mentor_ids(auth.uid()))
);
