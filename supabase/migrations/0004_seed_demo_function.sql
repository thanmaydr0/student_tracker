-- Seed Demo Data Function
-- This SECURITY DEFINER function bypasses RLS to seed demo data for a student.
-- It should be called from the client after they sign up and log in.

CREATE OR REPLACE FUNCTION seed_demo_data(p_student_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_mentor_id UUID;
    v_sub_ds UUID;
    v_sub_ml UUID;
    v_sub_os UUID;
    v_sub_db UUID;
    v_class_ds UUID;
    v_class_ml UUID;
    v_class_os UUID;
    v_class_db UUID;
    v_notif_id UUID;
    i INT;
    sim_date DATE;
    rand_status attendance_status;
BEGIN
    -- Verify the student exists
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_student_id AND role = 'student') THEN
        RETURN 'Error: Student profile not found';
    END IF;

    -- Ensure a Mentor exists
    SELECT id INTO v_mentor_id FROM profiles WHERE role = 'mentor' LIMIT 1;
    
    IF v_mentor_id IS NULL THEN
       v_mentor_id := gen_random_uuid();
       -- Create mentor in auth.users
       INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at)
       VALUES (
         v_mentor_id, 
         '00000000-0000-0000-0000-000000000000',
         'demo.mentor@edupredict.com', 
         crypt('mentor123', gen_salt('bf')),
         NOW(), 
         '{"role": "mentor", "full_name": "Prof. Alan Turing"}'::jsonb,
         'authenticated',
         'authenticated',
         NOW(),
         NOW()
       )
       ON CONFLICT (id) DO NOTHING;
       
       INSERT INTO profiles (id, full_name, role, branch, semester)
       VALUES (v_mentor_id, 'Prof. Alan Turing', 'mentor', 'Computer Science', 6)
       ON CONFLICT (id) DO NOTHING;
    END IF;

    -- Assign mentor to the student
    UPDATE profiles SET mentor_id = v_mentor_id WHERE id = p_student_id;

    -- Create Subjects
    INSERT INTO subjects (name, code, description) VALUES ('Data Structures', 'CS301', 'Core DSA concepts') ON CONFLICT (code) DO NOTHING;
    INSERT INTO subjects (name, code, description) VALUES ('Machine Learning', 'CS405', 'Intro to ML and Neural Networks') ON CONFLICT (code) DO NOTHING;
    INSERT INTO subjects (name, code, description) VALUES ('Operating Systems', 'CS302', 'System kernels and memory management') ON CONFLICT (code) DO NOTHING;
    INSERT INTO subjects (name, code, description) VALUES ('Database Management', 'CS303', 'SQL and NoSQL architecture') ON CONFLICT (code) DO NOTHING;

    -- Fetch subject IDs
    SELECT id INTO v_sub_ds FROM subjects WHERE code = 'CS301';
    SELECT id INTO v_sub_ml FROM subjects WHERE code = 'CS405';
    SELECT id INTO v_sub_os FROM subjects WHERE code = 'CS302';
    SELECT id INTO v_sub_db FROM subjects WHERE code = 'CS303';

    -- Create Classes (Current Semester)
    INSERT INTO classes (subject_id, mentor_id, academic_year, semester) VALUES (v_sub_ds, v_mentor_id, '2025-2026', 6) ON CONFLICT DO NOTHING;
    INSERT INTO classes (subject_id, mentor_id, academic_year, semester) VALUES (v_sub_ml, v_mentor_id, '2025-2026', 6) ON CONFLICT DO NOTHING;
    INSERT INTO classes (subject_id, mentor_id, academic_year, semester) VALUES (v_sub_os, v_mentor_id, '2025-2026', 6) ON CONFLICT DO NOTHING;
    INSERT INTO classes (subject_id, mentor_id, academic_year, semester) VALUES (v_sub_db, v_mentor_id, '2025-2026', 6) ON CONFLICT DO NOTHING;

    -- Fetch class IDs
    SELECT id INTO v_class_ds FROM classes WHERE subject_id = v_sub_ds AND academic_year = '2025-2026' LIMIT 1;
    SELECT id INTO v_class_ml FROM classes WHERE subject_id = v_sub_ml AND academic_year = '2025-2026' LIMIT 1;
    SELECT id INTO v_class_os FROM classes WHERE subject_id = v_sub_os AND academic_year = '2025-2026' LIMIT 1;
    SELECT id INTO v_class_db FROM classes WHERE subject_id = v_sub_db AND academic_year = '2025-2026' LIMIT 1;

    -- Enroll Student
    INSERT INTO enrollments (student_id, class_id) VALUES 
        (p_student_id, v_class_ds),
        (p_student_id, v_class_ml),
        (p_student_id, v_class_os),
        (p_student_id, v_class_db)
    ON CONFLICT DO NOTHING;

    -- Insert Timetables (clear first to avoid duplicates on re-run)
    DELETE FROM timetables WHERE class_id IN (v_class_ds, v_class_ml, v_class_os, v_class_db);
    
    INSERT INTO timetables (class_id, day_of_week, start_time, end_time, location) VALUES
        (v_class_ds, 1, '09:00:00', '10:30:00', 'Room 304'),
        (v_class_ml, 1, '11:00:00', '12:30:00', 'Lab A'),
        (v_class_os, 2, '10:00:00', '11:30:00', 'Room 201'),
        (v_class_db, 2, '14:00:00', '15:30:00', 'Lab B'),
        (v_class_ds, 3, '09:00:00', '10:30:00', 'Room 304'),
        (v_class_ml, 3, '13:00:00', '15:00:00', 'Lab A'),
        (v_class_os, 4, '09:00:00', '11:00:00', 'Room 201'),
        (v_class_db, 4, '11:30:00', '13:00:00', 'Lab B'),
        (v_class_ml, 5, '10:00:00', '12:00:00', 'Lab A');

    -- Insert Grades
    INSERT INTO grades (student_id, class_id, internal_marks, external_marks) VALUES
        (p_student_id, v_class_ds, 42, 38),
        (p_student_id, v_class_ml, 48, 45),
        (p_student_id, v_class_os, 35, 30),
        (p_student_id, v_class_db, 45, 42)
    ON CONFLICT (student_id, class_id) DO UPDATE SET 
        internal_marks = EXCLUDED.internal_marks,
        external_marks = EXCLUDED.external_marks;

    -- Simulate 30 days of attendance (clear first)
    DELETE FROM attendance 
    WHERE student_id = p_student_id 
    AND class_id IN (v_class_ds, v_class_ml, v_class_os, v_class_db);

    FOR i IN 0..30 LOOP
        sim_date := CURRENT_DATE - i;
        
        IF random() > 0.2 THEN
            rand_status := 'Present';
        ELSE
            rand_status := 'Absent';
        END IF;

        IF extract(isodow from sim_date) < 6 THEN
            INSERT INTO attendance (student_id, class_id, status, date) VALUES
                (p_student_id, v_class_ds, rand_status, sim_date),
                (p_student_id, v_class_ml, rand_status, sim_date),
                (p_student_id, v_class_os, rand_status, sim_date),
                (p_student_id, v_class_db, rand_status, sim_date)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    -- Create notification
    INSERT INTO notification_messages (title, body, type, deep_link)
    VALUES ('🎉 Demo Setup Complete', 'Your account is now populated with subjects, grades, timetables, and 30 days of attendance records.', 'info', '/student/timetable')
    RETURNING id INTO v_notif_id;

    INSERT INTO user_notifications (user_id, message_id, is_read)
    VALUES (p_student_id, v_notif_id, false)
    ON CONFLICT DO NOTHING;

    RETURN 'Success: Demo data seeded for student ' || p_student_id::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION seed_demo_data(UUID) TO authenticated;
