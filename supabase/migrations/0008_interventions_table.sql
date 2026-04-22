CREATE TABLE IF NOT EXISTS public.interventions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    notes TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.interventions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentors can view their own interventions" ON public.interventions
    FOR SELECT USING (auth.uid() = mentor_id);

CREATE POLICY "Mentors can create their own interventions" ON public.interventions
    FOR INSERT WITH CHECK (auth.uid() = mentor_id);

CREATE POLICY "Mentors can update their own interventions" ON public.interventions
    FOR UPDATE USING (auth.uid() = mentor_id);

CREATE POLICY "Mentors can delete their own interventions" ON public.interventions
    FOR DELETE USING (auth.uid() = mentor_id);

-- Add helpful index
CREATE INDEX IF NOT EXISTS interventions_student_id_idx ON public.interventions(student_id);
CREATE INDEX IF NOT EXISTS interventions_mentor_id_idx ON public.interventions(mentor_id);
