-- =============================================================================
-- 0. Profile creation RPC (called client-side after signup, works without session)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_profile(
  p_user_id UUID,
  p_full_name TEXT,
  p_role user_role,
  p_branch TEXT,
  p_semester SMALLINT
)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User does not exist';
  END IF;

  INSERT INTO public.profiles (id, full_name, role, branch, semester)
  VALUES (p_user_id, p_full_name, p_role, p_branch, p_semester)
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_profile TO anon, authenticated;


-- =============================================================================
-- 1. Attendance percentage aggregation function
-- =============================================================================
CREATE OR REPLACE FUNCTION get_attendance_summary(p_student_id UUID)
RETURNS TABLE (
  class_id UUID, subject_name TEXT, present_count BIGINT,
  total_count BIGINT, percentage NUMERIC
) AS $$
  SELECT
    e.class_id,
    s.name AS subject_name,
    COUNT(a.id) FILTER (WHERE a.status = 'Present') AS present_count,
    COUNT(a.id) AS total_count,
    ROUND(
      COUNT(a.id) FILTER (WHERE a.status = 'Present')::NUMERIC /
      NULLIF(COUNT(a.id), 0) * 100, 2
    ) AS percentage
  FROM enrollments e
  JOIN classes c ON c.id = e.class_id
  JOIN subjects s ON s.id = c.subject_id
  LEFT JOIN attendance a ON a.class_id = e.class_id AND a.student_id = e.student_id
  WHERE e.student_id = p_student_id
  GROUP BY e.class_id, s.name;
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- =============================================================================
-- 2. Attendance risk notification trigger
-- =============================================================================
CREATE OR REPLACE FUNCTION notify_attendance_risk()
RETURNS TRIGGER AS $$
DECLARE
  v_percentage NUMERIC;
  v_subject_name TEXT;
  v_msg_id UUID;
BEGIN
  SELECT percentage, subject_name
  INTO v_percentage, v_subject_name
  FROM get_attendance_summary(NEW.student_id)
  WHERE class_id = NEW.class_id;

  IF v_percentage IS NOT NULL AND v_percentage < 75 THEN
    INSERT INTO notification_messages (title, body, type, deep_link)
    VALUES (
      'Attendance Alert: ' || v_subject_name,
      'Your attendance in ' || v_subject_name || ' has dropped to ' ||
      ROUND(v_percentage, 1) || '%. Minimum required is 75%.',
      'attendance_risk',
      '/dashboard/attendance'
    )
    RETURNING id INTO v_msg_id;

    INSERT INTO user_notifications (user_id, message_id)
    VALUES (NEW.student_id, v_msg_id)
    ON CONFLICT (user_id, message_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_attendance_risk_notify ON attendance;
CREATE TRIGGER trigger_attendance_risk_notify
  AFTER INSERT OR UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION notify_attendance_risk();


-- =============================================================================
-- 3. Grade change notification trigger
-- =============================================================================
CREATE OR REPLACE FUNCTION notify_grade_risk()
RETURNS TRIGGER AS $$
DECLARE
  v_subject_name TEXT;
  v_new_grade TEXT;
  v_msg_id UUID;
BEGIN
  -- Compute the grade from the new marks (mirrors the generated column logic)
  v_new_grade := CASE
    WHEN (NEW.internal_marks + NEW.external_marks) >= 85 THEN 'A'
    WHEN (NEW.internal_marks + NEW.external_marks) >= 70 THEN 'B'
    WHEN (NEW.internal_marks + NEW.external_marks) >= 55 THEN 'C'
    WHEN (NEW.internal_marks + NEW.external_marks) >= 40 THEN 'D'
    ELSE 'F'
  END;

  IF v_new_grade IN ('D', 'F') THEN
    SELECT s.name INTO v_subject_name
    FROM classes c
    JOIN subjects s ON s.id = c.subject_id
    WHERE c.id = NEW.class_id;

    INSERT INTO notification_messages (title, body, type, deep_link)
    VALUES (
      'Grade Alert: ' || v_subject_name,
      'Your grade in ' || v_subject_name || ' has dropped to ' || v_new_grade ||
      ' (Total: ' || ROUND(NEW.internal_marks + NEW.external_marks, 1) ||
      '/100). Please consult your mentor.',
      'grade_risk',
      '/dashboard/grades'
    )
    RETURNING id INTO v_msg_id;

    INSERT INTO user_notifications (user_id, message_id)
    VALUES (NEW.student_id, v_msg_id)
    ON CONFLICT (user_id, message_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_grade_risk_notify ON grades;
CREATE TRIGGER trigger_grade_risk_notify
  AFTER UPDATE ON grades
  FOR EACH ROW EXECUTE FUNCTION notify_grade_risk();


-- =============================================================================
-- 4. Mentor cohort summary function (used by Mentor Dashboard)
-- =============================================================================
CREATE OR REPLACE FUNCTION get_mentor_cohort_summary(p_mentor_id UUID)
RETURNS TABLE (
  student_id UUID, full_name TEXT, branch TEXT, semester SMALLINT,
  avg_attendance NUMERIC, avg_total_score NUMERIC,
  failing_subjects BIGINT, risk_level TEXT
) AS $$
  SELECT
    p.id AS student_id, p.full_name, p.branch, p.semester,
    ROUND(AVG(att.percentage), 2) AS avg_attendance,
    ROUND(AVG(g.total_score), 2) AS avg_total_score,
    COUNT(g.id) FILTER (WHERE g.grade = 'F') AS failing_subjects,
    CASE
      WHEN AVG(att.percentage) < 60 OR COUNT(g.id) FILTER (WHERE g.grade = 'F') > 1 THEN 'High'
      WHEN AVG(att.percentage) < 75 OR COUNT(g.id) FILTER (WHERE g.grade IN ('D','F')) > 0 THEN 'Medium'
      ELSE 'Low'
    END AS risk_level
  FROM profiles p
  LEFT JOIN LATERAL get_attendance_summary(p.id) att ON TRUE
  LEFT JOIN grades g ON g.student_id = p.id
  WHERE p.mentor_id = p_mentor_id AND p.role = 'student'
  GROUP BY p.id, p.full_name, p.branch, p.semester;
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- =============================================================================
-- 5. Mark unread notifications as read
-- =============================================================================
CREATE OR REPLACE FUNCTION mark_notifications_read(p_user_id UUID)
RETURNS VOID AS $$
  UPDATE user_notifications
  SET is_read = TRUE
  WHERE user_id = p_user_id AND is_read = FALSE;
$$ LANGUAGE sql SECURITY DEFINER;
