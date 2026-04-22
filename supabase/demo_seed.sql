-- EduPredict Demo Seed Script
-- Instructions: Run this script directly in your Supabase SQL Editor.
-- PREREQUISITE: You MUST sign up via the app and log in at least once so a student profile is created.
-- This script automatically targets the MOST RECENTLY CREATED 'student' profile.

DO $$ 
DECLARE
    v_student_id UUID;
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
    -- 1. Grab the most recently created student
    SELECT id INTO v_student_id FROM profiles WHERE role = 'student' ORDER BY created_at DESC LIMIT 1;
    
    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'No student profile found. Please sign up via the frontend first.';
    END IF;

    -- 2. Ensure a Mentor exists
    SELECT id INTO v_mentor_id FROM profiles WHERE role = 'mentor' LIMIT 1;
    
    IF v_mentor_id IS NULL THEN
       v_mentor_id := gen_random_uuid();
       -- Bypass foreign key locally for demo purposes
       INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
       VALUES (v_mentor_id, 'demo.mentor@edupredict.com', NOW(), '{"role": "mentor", "full_name": "Prof. Alan Turing"}')
       ON CONFLICT DO NOTHING;
       
       INSERT INTO profiles (id, full_name, role, branch, semester)
       VALUES (v_mentor_id, 'Prof. Alan Turing', 'mentor', 'Computer Science', 6)
       ON CONFLICT DO NOTHING;
    END IF;

    -- Assign mentor to the student
    UPDATE profiles SET mentor_id = v_mentor_id WHERE id = v_student_id;

    -- 3. Create Subjects (with ON CONFLICT handling)
    INSERT INTO subjects (name, code, description) VALUES ('Data Structures', 'CS301', 'Core DSA concepts') ON CONFLICT (code) DO NOTHING;
    INSERT INTO subjects (name, code, description) VALUES ('Machine Learning', 'CS405', 'Intro to ML and Neural Networks') ON CONFLICT (code) DO NOTHING;
    INSERT INTO subjects (name, code, description) VALUES ('Operating Systems', 'CS302', 'System kernels and memory management') ON CONFLICT (code) DO NOTHING;
    INSERT INTO subjects (name, code, description) VALUES ('Database Management', 'CS303', 'SQL and NoSQL architecture') ON CONFLICT (code) DO NOTHING;

    -- Fetch subject IDs
    SELECT id INTO v_sub_ds FROM subjects WHERE code = 'CS301';
    SELECT id INTO v_sub_ml FROM subjects WHERE code = 'CS405';
    SELECT id INTO v_sub_os FROM subjects WHERE code = 'CS302';
    SELECT id INTO v_sub_db FROM subjects WHERE code = 'CS303';

    -- 4. Create Classes (Current Semester)
    INSERT INTO classes (subject_id, mentor_id, academic_year, semester) VALUES (v_sub_ds, v_mentor_id, '2025-2026', 6) ON CONFLICT DO NOTHING;
    INSERT INTO classes (subject_id, mentor_id, academic_year, semester) VALUES (v_sub_ml, v_mentor_id, '2025-2026', 6) ON CONFLICT DO NOTHING;
    INSERT INTO classes (subject_id, mentor_id, academic_year, semester) VALUES (v_sub_os, v_mentor_id, '2025-2026', 6) ON CONFLICT DO NOTHING;
    INSERT INTO classes (subject_id, mentor_id, academic_year, semester) VALUES (v_sub_db, v_mentor_id, '2025-2026', 6) ON CONFLICT DO NOTHING;

    -- Fetch class IDs
    SELECT id INTO v_class_ds FROM classes WHERE subject_id = v_sub_ds AND academic_year = '2025-2026' LIMIT 1;
    SELECT id INTO v_class_ml FROM classes WHERE subject_id = v_sub_ml AND academic_year = '2025-2026' LIMIT 1;
    SELECT id INTO v_class_os FROM classes WHERE subject_id = v_sub_os AND academic_year = '2025-2026' LIMIT 1;
    SELECT id INTO v_class_db FROM classes WHERE subject_id = v_sub_db AND academic_year = '2025-2026' LIMIT 1;

    -- 5. Enroll Student
    INSERT INTO enrollments (student_id, class_id) VALUES 
        (v_student_id, v_class_ds),
        (v_student_id, v_class_ml),
        (v_student_id, v_class_os),
        (v_student_id, v_class_db)
    ON CONFLICT DO NOTHING;

    -- 6. Insert Timetables (Monday to Friday)
    -- We can just execute this since we ON CONFLICT DO NOTHING doesn't exist for timetables easily without a unique constraint,
    -- but let's clear student's class timetables to avoid duplicates if re-run
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

    -- 7. Insert Grades
    INSERT INTO grades (student_id, class_id, internal_marks, external_marks) VALUES
        (v_student_id, v_class_ds, 42, 38),
        (v_student_id, v_class_ml, 48, 45),
        (v_student_id, v_class_os, 35, 30),
        (v_student_id, v_class_db, 45, 42)
    ON CONFLICT (student_id, class_id) DO UPDATE SET 
        internal_marks = EXCLUDED.internal_marks,
        external_marks = EXCLUDED.external_marks;

    -- 8. Simulate 30 days of attendance history for the student
    FOR i IN 0..30 LOOP
        sim_date := CURRENT_DATE - i;
        
        -- Generate random 'Present'/'Absent' with 80% Present bias
        IF random() > 0.2 THEN
            rand_status := 'Present';
        ELSE
            rand_status := 'Absent';
        END IF;

        IF extract(isodow from sim_date) < 6 THEN
            INSERT INTO attendance (student_id, class_id, status, date) VALUES
                (v_student_id, v_class_ds, rand_status, sim_date),
                (v_student_id, v_class_ml, rand_status, sim_date),
                (v_student_id, v_class_os, rand_status, sim_date),
                (v_student_id, v_class_db, rand_status, sim_date)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    -- Add a notification securely
    INSERT INTO notification_messages (title, body, type, deep_link)
    VALUES ('Hackathon Setup Complete', 'Your demo account is fully populated with subjects, grades, timetables, and attendance records.', 'info', '/student/timetable')
    RETURNING id INTO v_notif_id;

    INSERT INTO user_notifications (user_id, message_id, is_read)
    VALUES (v_student_id, v_notif_id, false)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Demo Data Simulation Complete for Student ID: %', v_student_id;
END $$;
