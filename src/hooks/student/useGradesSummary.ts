import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { GradeSummary } from '../../types/app.types'

export function useGradesSummary(userId: string | undefined) {
  return useQuery({
    queryKey: ['grades-summary', userId],
    queryFn: async () => {
      console.log('[Grades] ▶ queryFn START, userId:', userId)

      if (!userId) throw new Error('User ID is required')

      // Step 1: Get enrolled class_ids
      console.log('[Grades] Step 1: Fetching enrollments...')
      const { data: enrollments, error: enrollErr } = await supabase
        .from('enrollments')
        .select('class_id')
        .eq('student_id', userId)

      console.log('[Grades] Enrollments:', { count: enrollments?.length, error: enrollErr?.message })

      if (enrollErr) {
        console.error('[Grades] Enrollment fetch FAILED:', enrollErr)
        throw enrollErr
      }

      if (!enrollments || enrollments.length === 0) {
        console.warn('[Grades] No enrollments — returning empty')
        return [] as GradeSummary[]
      }

      const classIds = enrollments.map((e) => e.class_id)
      console.log('[Grades] Class IDs:', classIds)

      // Step 2: Get grades
      console.log('[Grades] Step 2: Fetching grades...')
      const { data: grades, error: gradesErr } = await supabase
        .from('grades')
        .select('class_id, internal_marks, external_marks, total_score, grade')
        .eq('student_id', userId)
        .in('class_id', classIds)

      console.log('[Grades] Grades:', { count: grades?.length, error: gradesErr?.message })

      if (gradesErr) {
        console.error('[Grades] Grades fetch FAILED:', gradesErr)
        throw gradesErr
      }

      if (!grades || grades.length === 0) {
        console.warn('[Grades] No grades data — returning empty')
        return [] as GradeSummary[]
      }

      // Step 3: Get class→subject mapping
      console.log('[Grades] Step 3: Fetching classes...')
      const { data: classes, error: classErr } = await supabase
        .from('classes')
        .select('id, subject_id')
        .in('id', classIds)

      console.log('[Grades] Classes:', { count: classes?.length, error: classErr?.message })

      if (classErr) {
        console.error('[Grades] Classes fetch FAILED:', classErr)
        throw classErr
      }

      // Step 4: Get subject names
      const subjectIds = [...new Set((classes || []).map((c) => c.subject_id))]
      console.log('[Grades] Step 4: Fetching subjects for IDs:', subjectIds)

      const { data: subjects, error: subErr } = await supabase
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds)

      console.log('[Grades] Subjects:', { count: subjects?.length, error: subErr?.message })

      if (subErr) {
        console.error('[Grades] Subjects fetch FAILED:', subErr)
        throw subErr
      }

      // Build lookup maps
      const subjectMap = new Map((subjects || []).map((s) => [s.id, s.name]))
      const classSubjectMap = new Map(
        (classes || []).map((c) => [c.id, subjectMap.get(c.subject_id) || 'Unknown'])
      )

      // Transform
      const result = grades.map((row) => ({
        class_id: row.class_id,
        subject_name: classSubjectMap.get(row.class_id) || 'Unknown Subject',
        internal: Number(row.internal_marks),
        external: Number(row.external_marks),
        total: Number(row.total_score),
        grade: row.grade,
      })) as GradeSummary[]

      console.log('[Grades] ✅ Final result:', result)
      return result
    },
    enabled: !!userId,
  })
}
