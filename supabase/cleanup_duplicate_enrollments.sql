-- CLEANUP: Remove duplicate enrollments where a student is enrolled
-- in multiple classes for the same subject (caused by running multiple seeds)
-- This keeps only the most recent enrollment per student+subject.

DO $$
DECLARE
  v_dup RECORD;
BEGIN
  -- Find and delete duplicate enrollments (keeping the latest one per student+subject)
  FOR v_dup IN (
    SELECT e.id AS enrollment_id
    FROM enrollments e
    JOIN classes c ON e.class_id = c.id
    WHERE (e.student_id, c.subject_id) IN (
      SELECT e2.student_id, c2.subject_id
      FROM enrollments e2
      JOIN classes c2 ON e2.class_id = c2.id
      GROUP BY e2.student_id, c2.subject_id
      HAVING COUNT(*) > 1
    )
    AND e.id NOT IN (
      -- Keep only the latest enrollment per student+subject
      SELECT DISTINCT ON (e3.student_id, c3.subject_id) e3.id
      FROM enrollments e3
      JOIN classes c3 ON e3.class_id = c3.id
      ORDER BY e3.student_id, c3.subject_id, e3.created_at DESC
    )
  ) LOOP
    -- Also clean up related grades, attendance, iat_marks for the duplicate enrollment's class
    DELETE FROM iat_marks WHERE student_id IN (
      SELECT student_id FROM enrollments WHERE id = v_dup.enrollment_id
    ) AND class_id IN (
      SELECT class_id FROM enrollments WHERE id = v_dup.enrollment_id
    );
    
    DELETE FROM grades WHERE student_id IN (
      SELECT student_id FROM enrollments WHERE id = v_dup.enrollment_id  
    ) AND class_id IN (
      SELECT class_id FROM enrollments WHERE id = v_dup.enrollment_id
    );

    DELETE FROM attendance WHERE student_id IN (
      SELECT student_id FROM enrollments WHERE id = v_dup.enrollment_id
    ) AND class_id IN (
      SELECT class_id FROM enrollments WHERE id = v_dup.enrollment_id
    );

    DELETE FROM enrollments WHERE id = v_dup.enrollment_id;
  END LOOP;

  RAISE NOTICE 'Duplicate enrollments cleaned up.';
END $$;
