-- SEED 9 MORE STUDENTS WITH DATA
-- Instructions: Run this in your Supabase SQL Editor.
-- It will create 9 students with pre-verified emails, link them to the most recent Mentor,
-- enroll them in the classes created by `hackathon_seed.sql`, and generate grades/attendance.

DO $$ 
DECLARE
    v_mentor_id UUID;
    v_class_ds UUID;
    v_class_ml UUID;
    v_class_os UUID;
    v_class_db UUID;
    v_student_id UUID;
    v_email text;
    v_password text := 'Student123!';
    i INT;
    j INT;
    sim_date DATE;
    rand_status attendance_status;
BEGIN
    -- 1. Grab the most recently logged in Mentor
    SELECT id INTO v_mentor_id FROM public.profiles WHERE role = 'mentor' ORDER BY created_at DESC LIMIT 1;
    
    IF v_mentor_id IS NULL THEN
        RAISE EXCEPTION 'No Mentor profile found! Please create your mentor account first.';
    END IF;

    -- Fetch classes (Assuming they exist from hackathon_seed.sql)
    SELECT c.id INTO v_class_ds FROM public.classes c JOIN public.subjects s ON c.subject_id = s.id WHERE s.code = 'CS301' LIMIT 1;
    SELECT c.id INTO v_class_ml FROM public.classes c JOIN public.subjects s ON c.subject_id = s.id WHERE s.code = 'CS405' LIMIT 1;
    SELECT c.id INTO v_class_os FROM public.classes c JOIN public.subjects s ON c.subject_id = s.id WHERE s.code = 'CS302' LIMIT 1;
    SELECT c.id INTO v_class_db FROM public.classes c JOIN public.subjects s ON c.subject_id = s.id WHERE s.code = 'CS303' LIMIT 1;

    IF v_class_ds IS NULL THEN
        RAISE EXCEPTION 'Classes not found! Please run hackathon_seed.sql first to set up subjects and classes.';
    END IF;

    -- Create 9 students
    FOR i IN 1..9 LOOP
        v_student_id := gen_random_uuid();
        v_email := 'student' || i || '@edupredict.com';

        -- Clean up if exists to prevent errors on re-run
        DELETE FROM auth.users WHERE email = v_email;

        -- 1. Insert directly into auth.users (so email is verified and password is set)
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
            recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, 
            created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', v_student_id, 'authenticated', 'authenticated', v_email, 
            crypt(v_password, gen_salt('bf')), now(), now(), now(), 
            '{"provider":"email","providers":["email"]}', 
            json_build_object('name', 'Student ' || i, 'role', 'student'), 
            now(), now(), '', '', '', ''
        );

        -- 2. Insert into public.profiles 
        -- If a trigger already created the profile, we do ON CONFLICT UPDATE
        INSERT INTO public.profiles (id, full_name, role, mentor_id, branch, semester)
        VALUES (v_student_id, 'Student ' || i, 'student', v_mentor_id, 'Computer Science', 6)
        ON CONFLICT (id) DO UPDATE SET mentor_id = v_mentor_id, branch = 'Computer Science', semester = 6;

        -- 3. Enroll the Student in classes
        INSERT INTO public.enrollments (student_id, class_id) VALUES (v_student_id, v_class_ds) ON CONFLICT DO NOTHING;
        INSERT INTO public.enrollments (student_id, class_id) VALUES (v_student_id, v_class_ml) ON CONFLICT DO NOTHING;
        INSERT INTO public.enrollments (student_id, class_id) VALUES (v_student_id, v_class_os) ON CONFLICT DO NOTHING;
        INSERT INTO public.enrollments (student_id, class_id) VALUES (v_student_id, v_class_db) ON CONFLICT DO NOTHING;

        -- 4. Generate somewhat randomized grades (internal max 50, external max 50)
        INSERT INTO public.grades (student_id, class_id, internal_marks, external_marks)
        VALUES 
          (v_student_id, v_class_ds, floor(random() * 15 + 30)::int, floor(random() * 15 + 30)::int),
          (v_student_id, v_class_ml, floor(random() * 25 + 10)::int, floor(random() * 20 + 15)::int),
          (v_student_id, v_class_os, floor(random() * 15 + 25)::int, floor(random() * 15 + 25)::int),
          (v_student_id, v_class_db, floor(random() * 20 + 15)::int, floor(random() * 20 + 20)::int);

        -- 5. Generate Attendance Data (Last 20 Days)
        FOR j IN 0..20 LOOP
            sim_date := CURRENT_DATE - (20 - j);
            
            INSERT INTO public.attendance (student_id, class_id, date, status)
            VALUES (v_student_id, v_class_ds, sim_date, CASE WHEN random() > 0.15 THEN 'Present'::attendance_status ELSE 'Absent'::attendance_status END);
            
            INSERT INTO public.attendance (student_id, class_id, date, status)
            VALUES (v_student_id, v_class_ml, sim_date, CASE WHEN random() > 0.25 THEN 'Present'::attendance_status ELSE 'Absent'::attendance_status END);

            INSERT INTO public.attendance (student_id, class_id, date, status)
            VALUES (v_student_id, v_class_os, sim_date, CASE WHEN random() > 0.1 THEN 'Present'::attendance_status ELSE 'Absent'::attendance_status END);

            INSERT INTO public.attendance (student_id, class_id, date, status)
            VALUES (v_student_id, v_class_db, sim_date, CASE WHEN random() > 0.2 THEN 'Present'::attendance_status ELSE 'Absent'::attendance_status END);
        END LOOP;

    END LOOP;

END $$;
