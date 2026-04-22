-- HACKATHON DEMO SEED SCRIPT
-- Instructions: Run this in your Supabase SQL Editor.
-- It intelligently finds your existing Mentor profile and an existing Student profile,
-- links them perfectly, and generates beautiful, coherent dummy data designed EXACTLY for a live hackathon demo flow.

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
    -- 1. Grab the most recently logged in Mentor
    SELECT id INTO v_mentor_id FROM public.profiles WHERE role = 'mentor' ORDER BY created_at DESC LIMIT 1;
    
    IF v_mentor_id IS NULL THEN
        RAISE EXCEPTION 'No Mentor profile found! Please create your mentor account first.';
    END IF;

    -- 2. Grab the most recently logged in Student
    SELECT id INTO v_student_id FROM public.profiles WHERE role = 'student' ORDER BY created_at DESC LIMIT 1;
    
    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'No Student profile found! Please log out, and sign up a test Student account first.';
    END IF;

    -- 3. LINK THEM PERFECTLY and WIPE LEGACY DATA
    UPDATE public.profiles SET mentor_id = v_mentor_id WHERE id = v_student_id;
    UPDATE public.profiles SET branch = 'Computer Science', semester = 6 WHERE id = v_student_id;
    
    -- CLEAR ALL previous data linking to avoid duplicate UI subjects during the demo!
    DELETE FROM public.enrollments WHERE student_id = v_student_id;
    DELETE FROM public.attendance WHERE student_id = v_student_id;
    DELETE FROM public.grades WHERE student_id = v_student_id;
    DELETE FROM public.interventions WHERE student_id = v_student_id;

    -- 4. Establish Subjects
    INSERT INTO public.subjects (name, code, description) VALUES ('Data Structures', 'CS301', 'Core DSA concepts') ON CONFLICT (code) DO NOTHING;
    INSERT INTO public.subjects (name, code, description) VALUES ('Machine Learning', 'CS405', 'Intro to ML and Neural Networks') ON CONFLICT (code) DO NOTHING;
    INSERT INTO public.subjects (name, code, description) VALUES ('Operating Systems', 'CS302', 'System kernels and memory management') ON CONFLICT (code) DO NOTHING;
    INSERT INTO public.subjects (name, code, description) VALUES ('Database Management', 'CS303', 'SQL and NoSQL architecture') ON CONFLICT (code) DO NOTHING;

    SELECT id INTO v_sub_ds FROM public.subjects WHERE code = 'CS301';
    SELECT id INTO v_sub_ml FROM public.subjects WHERE code = 'CS405';
    SELECT id INTO v_sub_os FROM public.subjects WHERE code = 'CS302';
    SELECT id INTO v_sub_db FROM public.subjects WHERE code = 'CS303';

    -- 5. Establish Mentor's Classes
    INSERT INTO public.classes (subject_id, mentor_id, semester, academic_year) VALUES (v_sub_ds, v_mentor_id, 6, '2023-2024') ON CONFLICT DO NOTHING;
    INSERT INTO public.classes (subject_id, mentor_id, semester, academic_year) VALUES (v_sub_ml, v_mentor_id, 6, '2023-2024') ON CONFLICT DO NOTHING;
    INSERT INTO public.classes (subject_id, mentor_id, semester, academic_year) VALUES (v_sub_os, v_mentor_id, 6, '2023-2024') ON CONFLICT DO NOTHING;
    INSERT INTO public.classes (subject_id, mentor_id, semester, academic_year) VALUES (v_sub_db, v_mentor_id, 6, '2023-2024') ON CONFLICT DO NOTHING;

    SELECT id INTO v_class_ds FROM public.classes WHERE subject_id = v_sub_ds LIMIT 1;
    SELECT id INTO v_class_ml FROM public.classes WHERE subject_id = v_sub_ml LIMIT 1;
    SELECT id INTO v_class_os FROM public.classes WHERE subject_id = v_sub_os LIMIT 1;
    SELECT id INTO v_class_db FROM public.classes WHERE subject_id = v_sub_db LIMIT 1;

    -- 6. Enroll the Student in these classes natively
    INSERT INTO public.enrollments (student_id, class_id) VALUES (v_student_id, v_class_ds) ON CONFLICT DO NOTHING;
    INSERT INTO public.enrollments (student_id, class_id) VALUES (v_student_id, v_class_ml) ON CONFLICT DO NOTHING;
    INSERT INTO public.enrollments (student_id, class_id) VALUES (v_student_id, v_class_os) ON CONFLICT DO NOTHING;
    INSERT INTO public.enrollments (student_id, class_id) VALUES (v_student_id, v_class_db) ON CONFLICT DO NOTHING;

    -- 7. Generate HACKATHON SPECIFIC GRADE DATA
    -- We want the student to show as "High Risk" context for the AI demo!
    -- DS: Good. ML: Failing physically. OS: Avg. DB: Failing.
    INSERT INTO public.grades (student_id, class_id, internal_marks, external_marks)
    VALUES 
      (v_student_id, v_class_ds, 42, 38), -- 80 (B)
      (v_student_id, v_class_ml, 12, 20), -- 32 (F) -> AI Trigger!
      (v_student_id, v_class_os, 35, 30), -- 65 (C)
      (v_student_id, v_class_db, 15, 10); -- 25 (F) -> AI Trigger!

    -- 8. Generate BACKDATED ATTENDANCE TIGHTLY FOR THE CHAT AI (Last 20 Days)
    FOR i IN 0..20 LOOP
        sim_date := CURRENT_DATE - (20 - i);
        
        -- Generate strict lack of attendance perfectly mapped for High Risk AI demonstration
        -- DS: present most times
        -- ML: Absent constantly recently!
        INSERT INTO public.attendance (student_id, class_id, date, status)
        VALUES (v_student_id, v_class_ds, sim_date, CASE WHEN random() > 0.1 THEN 'Present'::attendance_status ELSE 'Absent'::attendance_status END);
        
        IF sim_date > (CURRENT_DATE - 7) THEN
           -- Consistently missed Machine Learning classes this week (Perfect for AI Cohort Chat context!)
           INSERT INTO public.attendance (student_id, class_id, date, status) VALUES (v_student_id, v_class_ml, sim_date, 'Absent');
        ELSE 
           INSERT INTO public.attendance (student_id, class_id, date, status) VALUES (v_student_id, v_class_ml, sim_date, 'Present');
        END IF;

        INSERT INTO public.attendance (student_id, class_id, date, status)
        VALUES (v_student_id, v_class_os, sim_date, 'Present');
    END LOOP;

    -- 9. Inject a Mentor Intervention so the Action History looks populated
    INSERT INTO public.interventions (student_id, mentor_id, type, notes, date)
    VALUES 
      (v_student_id, v_mentor_id, 'Meeting', 'Student is struggling with Machine Learning mathematical concepts negatively impacting attendance.', CURRENT_DATE - 5),
      (v_student_id, v_mentor_id, 'Other', 'Sent warning email regarding Database Management absences.', CURRENT_DATE - 1);

    -- 10. Spark a live Notification to show the Realtime Notification Hub!
    INSERT INTO public.notification_messages (title, body, type, deep_link)
    VALUES ('Urgent: High Absenteeism', 'Student has missed 5 consecutive Machine Learning classes.', 'attendance_risk', '/mentor/student/' || v_student_id)
    RETURNING id INTO v_notif_id;

    INSERT INTO public.user_notifications (user_id, message_id)
    VALUES (v_mentor_id, v_notif_id);

END $$;
