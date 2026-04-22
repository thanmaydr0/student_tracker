-- FIX: The policies from 0006 caused infinite recursion on the profiles table
-- because they contained subqueries that reference profiles itself.
-- Fix: Drop the broken policies and recreate them with SECURITY DEFINER functions.

-- 1. Drop the broken policies
DROP POLICY IF EXISTS "students_select_assigned_mentor" ON profiles;
DROP POLICY IF EXISTS "students_select_class_mentors" ON profiles;

-- 2. Create SECURITY DEFINER helper to get current user's mentor_id (bypasses RLS)
CREATE OR REPLACE FUNCTION get_my_mentor_id(p_user_id UUID)
RETURNS UUID AS $$
  SELECT mentor_id FROM profiles WHERE id = p_user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_my_mentor_id(UUID) TO authenticated;

-- 3. Recreate policies using SECURITY DEFINER functions (no recursion)
-- Students can read their assigned mentor's profile
CREATE POLICY "students_select_assigned_mentor" ON profiles
FOR SELECT USING (
  public.user_role() = 'student' AND 
  id = get_my_mentor_id(auth.uid())
);

-- Students can read profiles of mentors teaching their classes
-- (get_class_mentor_ids was already created in 0006 as SECURITY DEFINER)
CREATE POLICY "students_select_class_mentors" ON profiles
FOR SELECT USING (
  public.user_role() = 'student' AND
  id IN (SELECT get_class_mentor_ids(auth.uid()))
);
