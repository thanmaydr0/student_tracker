import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { AttendanceSummary } from '../../types/app.types'

export function useAttendanceSummary(userId: string | undefined) {
  return useQuery({
    queryKey: ['attendance-summary', userId],
    queryFn: async () => {
      console.log('[Attendance] ▶ queryFn START, userId:', userId)

      if (!userId) throw new Error('User ID is required')

      // Try RPC first
      try {
        console.log('[Attendance] Trying RPC get_attendance_summary...')
        const { data, error } = await supabase.rpc('get_attendance_summary', {
          p_student_id: userId,
        })

        if (error) {
          console.warn('[Attendance] RPC failed:', error.message, '| Falling back to manual query')
        } else if (data && (data as any[]).length > 0) {
          console.log('[Attendance] RPC returned', (data as any[]).length, 'rows')
          return ((data as any[]) || []).map((row) => ({
            class_id: row.class_id,
            subject_name: row.subject_name,
            present: Number(row.present_count),
            total: Number(row.total_count),
            percentage: Number(row.percentage),
          })) as AttendanceSummary[]
        } else {
          console.log('[Attendance] RPC returned empty/null, falling back...')
        }
      } catch (rpcErr) {
        console.warn('[Attendance] RPC exception:', rpcErr)
      }

      // Fallback: Query tables directly
      console.log('[Attendance] Starting manual fallback query...')

      // Step 1: Get enrollments
      const { data: enrollments, error: enrollErr } = await supabase
        .from('enrollments')
        .select('class_id')
        .eq('student_id', userId)

      console.log('[Attendance] Enrollments:', { count: enrollments?.length, error: enrollErr?.message })

      if (enrollErr) throw enrollErr
      if (!enrollments?.length) {
        console.warn('[Attendance] No enrollments found — returning empty')
        return [] as AttendanceSummary[]
      }

      const classIds = enrollments.map((e) => e.class_id)

      // Step 2: Fetch attendance records
      const { data: records, error: attErr } = await supabase
        .from('attendance')
        .select('class_id, status')
        .eq('student_id', userId)
        .in('class_id', classIds)

      console.log('[Attendance] Records:', { count: records?.length, error: attErr?.message })
      if (attErr) throw attErr

      // Step 3: Get class→subject mapping
      const { data: classes, error: clsErr } = await supabase
        .from('classes')
        .select('id, subject_id')
        .in('id', classIds)

      console.log('[Attendance] Classes:', { count: classes?.length, error: clsErr?.message })

      const subjectIds = [...new Set((classes || []).map((c) => c.subject_id))]
      const { data: subjects, error: subErr } = await supabase
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds)

      console.log('[Attendance] Subjects:', { count: subjects?.length, error: subErr?.message })

      // Build lookup maps
      const subjectMap = new Map((subjects || []).map((s) => [s.id, s.name]))
      const classSubjectMap = new Map(
        (classes || []).map((c) => [c.id, subjectMap.get(c.subject_id) || 'Unknown'])
      )

      // Aggregate
      const summaryMap = new Map<string, { present: number; total: number }>()
      for (const classId of classIds) {
        summaryMap.set(classId, { present: 0, total: 0 })
      }
      for (const record of records || []) {
        const entry = summaryMap.get(record.class_id)
        if (entry) {
          entry.total++
          if (record.status === 'Present') entry.present++
        }
      }

      const result = classIds.map((classId) => {
        const entry = summaryMap.get(classId)!
        return {
          class_id: classId,
          subject_name: classSubjectMap.get(classId) || 'Unknown',
          present: entry.present,
          total: entry.total,
          percentage: entry.total > 0 ? Math.round((entry.present / entry.total) * 10000) / 100 : 0,
        }
      })

      console.log('[Attendance] ✅ Final result:', result.length, 'subjects')
      return result as AttendanceSummary[]
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  })
}
