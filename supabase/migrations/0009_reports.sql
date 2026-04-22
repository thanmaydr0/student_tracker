-- 0009_reports.sql
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID DEFAULT auth.uid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL CHECK (report_type IN ('summary', 'detailed', 'parent')),
    content JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fix primary key default if we don't want it exactly bound to auth.uid()
ALTER TABLE public.reports ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Mentors can SELECT their own generated reports
CREATE POLICY "mentors_select_reports"
ON public.reports FOR SELECT
TO authenticated
USING (auth.uid() = mentor_id);

-- Mentors can INSERT their own generated reports
CREATE POLICY "mentors_insert_reports"
ON public.reports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = mentor_id AND public.user_role() = 'mentor');

-- Students can SELECT reports concerning themselves
CREATE POLICY "students_select_reports"
ON public.reports FOR SELECT
TO authenticated
USING (auth.uid() = student_id);
