-- SEED IAT 1 MARKS FOR ALL STUDENTS
-- Run this AFTER creating the iat_marks table (0010_iat_marks.sql)
-- Seeds IAT 1 marks for every student enrolled in each class. IAT 2 is left blank.

DO $$
DECLARE
    v_student RECORD;
    v_enrollment RECORD;
BEGIN
    -- Loop through every student
    FOR v_student IN (SELECT id FROM public.profiles WHERE role = 'student') LOOP
        -- Loop through each enrollment for this student
        FOR v_enrollment IN (SELECT class_id FROM public.enrollments WHERE student_id = v_student.id) LOOP
            -- Insert IAT 1 marks with randomized scores (20-45 out of 50)
            INSERT INTO public.iat_marks (student_id, class_id, iat_number, marks_obtained, max_marks, remarks)
            VALUES (
                v_student.id,
                v_enrollment.class_id,
                1,  -- IAT 1
                floor(random() * 26 + 20)::numeric,  -- 20 to 45
                50,
                'IAT 1 conducted on ' || to_char(CURRENT_DATE - 30, 'DD Mon YYYY')
            )
            ON CONFLICT (student_id, class_id, iat_number) DO UPDATE SET
                marks_obtained = EXCLUDED.marks_obtained,
                remarks = EXCLUDED.remarks;

            -- IAT 2 is intentionally NOT seeded (left blank for mentor to enter later)
        END LOOP;
    END LOOP;

    RAISE NOTICE 'IAT 1 marks seeded for all enrolled students.';
END $$;
