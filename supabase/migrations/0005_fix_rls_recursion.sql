-- Fix infinite recursion in RLS policies
-- The circular dependency is:
--   enrollments SELECT → subquery on classes → classes SELECT → subquery on enrollments → INFINITE LOOP
-- Fix: Use SECURITY DEFINER helper functions that bypass RLS for the subqueries.

-- 1. Create SECURITY DEFINER helper functions that bypass RLS
CREATE OR REPLACE FUNCTION get_student_class_ids(p_student_id UUID)
RETURNS SETOF UUID AS $$
  SELECT class_id FROM enrollments WHERE student_id = p_student_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_mentor_class_ids(p_mentor_id UUID)
RETURNS SETOF UUID AS $$
  SELECT id FROM classes WHERE mentor_id = p_mentor_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_mentor_student_ids(p_mentor_id UUID)
RETURNS SETOF UUID AS $$
  SELECT id FROM profiles WHERE mentor_id = p_mentor_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_student_class_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_mentor_class_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_mentor_student_ids(UUID) TO authenticated;


-- 2. Fix classes policies (break recursion by using helper function)
DROP POLICY IF EXISTS "students_select_enrolled_classes" ON classes;
CREATE POLICY "students_select_enrolled_classes" ON classes
FOR SELECT USING (
  public.user_role() = 'student' AND id IN (SELECT get_student_class_ids(auth.uid()))
);

-- 3. Fix enrollments policies (break recursion by using helper function)
DROP POLICY IF EXISTS "mentors_select_class_enrollments" ON enrollments;
CREATE POLICY "mentors_select_class_enrollments" ON enrollments
FOR SELECT USING (
  public.user_role() = 'mentor' AND
  class_id IN (SELECT get_mentor_class_ids(auth.uid()))
);

DROP POLICY IF EXISTS "mentors_insert_enrollments" ON enrollments;
CREATE POLICY "mentors_insert_enrollments" ON enrollments
FOR INSERT WITH CHECK (
  public.user_role() = 'mentor' AND
  class_id IN (SELECT get_mentor_class_ids(auth.uid()))
);

DROP POLICY IF EXISTS "mentors_delete_enrollments" ON enrollments;
CREATE POLICY "mentors_delete_enrollments" ON enrollments
FOR DELETE USING (
  public.user_role() = 'mentor' AND
  class_id IN (SELECT get_mentor_class_ids(auth.uid()))
);

-- 4. Fix attendance policies (use helper for mentor student lookup)
DROP POLICY IF EXISTS "mentors_select_assigned_students_attendance" ON attendance;
CREATE POLICY "mentors_select_assigned_students_attendance" ON attendance
FOR SELECT USING (
  public.user_role() = 'mentor' AND
  student_id IN (SELECT get_mentor_student_ids(auth.uid()))
);

DROP POLICY IF EXISTS "mentors_insert_attendance_for_assigned_students" ON attendance;
CREATE POLICY "mentors_insert_attendance_for_assigned_students" ON attendance
FOR INSERT WITH CHECK (
  public.user_role() = 'mentor' AND
  student_id IN (SELECT get_mentor_student_ids(auth.uid()))
);

DROP POLICY IF EXISTS "mentors_update_attendance_for_assigned_students" ON attendance;
CREATE POLICY "mentors_update_attendance_for_assigned_students" ON attendance
FOR UPDATE USING (
  public.user_role() = 'mentor' AND
  student_id IN (SELECT get_mentor_student_ids(auth.uid()))
) WITH CHECK (
  public.user_role() = 'mentor' AND
  student_id IN (SELECT get_mentor_student_ids(auth.uid()))
);

-- 5. Fix grades policies (use helper for mentor student lookup)
DROP POLICY IF EXISTS "mentors_select_assigned_students_grades" ON grades;
CREATE POLICY "mentors_select_assigned_students_grades" ON grades
FOR SELECT USING (
  public.user_role() = 'mentor' AND
  student_id IN (SELECT get_mentor_student_ids(auth.uid()))
);

DROP POLICY IF EXISTS "mentors_insert_grades_for_assigned_students" ON grades;
CREATE POLICY "mentors_insert_grades_for_assigned_students" ON grades
FOR INSERT WITH CHECK (
  public.user_role() = 'mentor' AND
  student_id IN (SELECT get_mentor_student_ids(auth.uid()))
);

DROP POLICY IF EXISTS "mentors_update_grades_for_assigned_students" ON grades;
CREATE POLICY "mentors_update_grades_for_assigned_students" ON grades
FOR UPDATE USING (
  public.user_role() = 'mentor' AND
  student_id IN (SELECT get_mentor_student_ids(auth.uid()))
) WITH CHECK (
  public.user_role() = 'mentor' AND
  student_id IN (SELECT get_mentor_student_ids(auth.uid()))
);

-- 6. Fix timetables SELECT policy (use helper for student enrollment lookup)
DROP POLICY IF EXISTS "authenticated_select_timetables" ON timetables;
CREATE POLICY "authenticated_select_timetables" ON timetables
FOR SELECT USING (
  (public.user_role() IN ('mentor', 'admin')) OR 
  (public.user_role() = 'student' AND class_id IN (SELECT get_student_class_ids(auth.uid())))
);
