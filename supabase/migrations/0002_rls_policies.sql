-- 1. Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- 2. Helper function for role extraction from JWT
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'user_role',
    (SELECT role::text FROM public.profiles WHERE id = auth.uid())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- 3. profiles policies
-- SELECT: Users can view their own profile. Mentors can view profiles of their assigned students.
CREATE POLICY "users_select_own_profile" ON profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "mentors_select_assigned_students" ON profiles
FOR SELECT USING (public.user_role() = 'mentor' AND auth.uid() = mentor_id);

-- UPDATE: Users can only update their own profile (restricted columns is handled in application logic).
CREATE POLICY "users_update_own_profile" ON profiles
FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- INSERT: Users can create their own profile (client-side after signup).
CREATE POLICY "users_insert_own_profile" ON profiles
FOR INSERT WITH CHECK (auth.uid() = id);


-- 4. subjects policies
-- SELECT: All authenticated users can read subjects.
CREATE POLICY "authenticated_select_subjects" ON subjects
FOR SELECT TO authenticated USING (true);

-- INSERT/UPDATE/DELETE: Only mentor role.
CREATE POLICY "mentors_insert_subjects" ON subjects
FOR INSERT WITH CHECK (public.user_role() = 'mentor');

CREATE POLICY "mentors_update_subjects" ON subjects
FOR UPDATE USING (public.user_role() = 'mentor');

CREATE POLICY "mentors_delete_subjects" ON subjects
FOR DELETE USING (public.user_role() = 'mentor');


-- 5. classes policies
-- SELECT: Students can see classes they're enrolled in. Mentors see their own classes.
CREATE POLICY "students_select_enrolled_classes" ON classes
FOR SELECT USING (
  (public.user_role() = 'student' AND id IN (SELECT class_id FROM enrollments WHERE student_id = auth.uid()))
);

CREATE POLICY "mentors_select_own_classes" ON classes
FOR SELECT USING (
  public.user_role() = 'mentor' AND mentor_id = auth.uid()
);

-- INSERT/UPDATE: Only mentors for their own classes.
CREATE POLICY "mentors_insert_own_classes" ON classes
FOR INSERT WITH CHECK (
  public.user_role() = 'mentor' AND mentor_id = auth.uid()
);

CREATE POLICY "mentors_update_own_classes" ON classes
FOR UPDATE USING (
  public.user_role() = 'mentor' AND mentor_id = auth.uid()
) WITH CHECK (
  public.user_role() = 'mentor' AND mentor_id = auth.uid()
);


-- 6. enrollments policies
-- SELECT: Students see their own enrollments. Mentors see enrollments for their classes.
CREATE POLICY "students_select_own_enrollments" ON enrollments
FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "mentors_select_class_enrollments" ON enrollments
FOR SELECT USING (
  public.user_role() = 'mentor' AND
  class_id IN (SELECT id FROM classes WHERE mentor_id = auth.uid())
);

-- INSERT/DELETE: Mentor role only (constrained to their classes for better security).
CREATE POLICY "mentors_insert_enrollments" ON enrollments
FOR INSERT WITH CHECK (
  public.user_role() = 'mentor' AND
  class_id IN (SELECT id FROM classes WHERE mentor_id = auth.uid())
);

CREATE POLICY "mentors_delete_enrollments" ON enrollments
FOR DELETE USING (
  public.user_role() = 'mentor' AND
  class_id IN (SELECT id FROM classes WHERE mentor_id = auth.uid())
);


-- 7. attendance policies
-- SELECT: Students see their own attendance. Mentors see attendance for their students.
CREATE POLICY "students_select_own_attendance" ON attendance
FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "mentors_select_assigned_students_attendance" ON attendance
FOR SELECT USING (
  public.user_role() = 'mentor' AND
  student_id IN (SELECT id FROM profiles WHERE mentor_id = auth.uid())
);

-- INSERT/UPDATE: Mentor role only, restricted to their assigned students.
CREATE POLICY "mentors_insert_attendance_for_assigned_students" ON attendance
FOR INSERT WITH CHECK (
  public.user_role() = 'mentor' AND
  student_id IN (SELECT id FROM profiles WHERE mentor_id = auth.uid())
);

CREATE POLICY "mentors_update_attendance_for_assigned_students" ON attendance
FOR UPDATE USING (
  public.user_role() = 'mentor' AND
  student_id IN (SELECT id FROM profiles WHERE mentor_id = auth.uid())
) WITH CHECK (
  public.user_role() = 'mentor' AND
  student_id IN (SELECT id FROM profiles WHERE mentor_id = auth.uid())
);
-- DELETE: Not permitted for anyone (by not specifying a delete policy).


-- 8. grades policies
-- SELECT: Students see their own grades. Mentors see grades for their students.
CREATE POLICY "students_select_own_grades" ON grades
FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "mentors_select_assigned_students_grades" ON grades
FOR SELECT USING (
  public.user_role() = 'mentor' AND
  student_id IN (SELECT id FROM profiles WHERE mentor_id = auth.uid())
);

-- INSERT/UPDATE: Mentor role only, restricted to their assigned students.
CREATE POLICY "mentors_insert_grades_for_assigned_students" ON grades
FOR INSERT WITH CHECK (
  public.user_role() = 'mentor' AND
  student_id IN (SELECT id FROM profiles WHERE mentor_id = auth.uid())
);

CREATE POLICY "mentors_update_grades_for_assigned_students" ON grades
FOR UPDATE USING (
  public.user_role() = 'mentor' AND
  student_id IN (SELECT id FROM profiles WHERE mentor_id = auth.uid())
) WITH CHECK (
  public.user_role() = 'mentor' AND
  student_id IN (SELECT id FROM profiles WHERE mentor_id = auth.uid())
);
-- DELETE: Not permitted for anyone.


-- 9. timetables policies
-- SELECT: All authenticated users. Students only see timetables for enrolled classes.
CREATE POLICY "authenticated_select_timetables" ON timetables
FOR SELECT USING (
  (public.user_role() IN ('mentor', 'admin')) OR 
  (public.user_role() = 'student' AND class_id IN (SELECT class_id FROM enrollments WHERE student_id = auth.uid()))
);

-- INSERT/UPDATE/DELETE: Mentor role only.
CREATE POLICY "mentors_insert_timetables" ON timetables
FOR INSERT WITH CHECK (public.user_role() = 'mentor');

CREATE POLICY "mentors_update_timetables" ON timetables
FOR UPDATE USING (public.user_role() = 'mentor') WITH CHECK (public.user_role() = 'mentor');

CREATE POLICY "mentors_delete_timetables" ON timetables
FOR DELETE USING (public.user_role() = 'mentor');


-- 10. notification_messages policies
-- SELECT: Allowed for authenticated users (join through user_notifications handles scoping).
CREATE POLICY "authenticated_select_notification_messages" ON notification_messages
FOR SELECT TO authenticated USING (true);

-- INSERT: Service role only (Edge Functions use service role, so they bypass RLS automatically).


-- 11. user_notifications policies
-- SELECT: Users see only their own notification records.
CREATE POLICY "users_select_own_user_notifications" ON user_notifications
FOR SELECT USING (user_id = auth.uid());

-- UPDATE (is_read only): Users can mark their own notifications as read.
CREATE POLICY "users_update_own_user_notifications" ON user_notifications
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- INSERT/DELETE: Service role only.
