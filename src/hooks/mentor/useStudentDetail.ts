import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { AttendanceSummary, GradeSummary } from '../../types/app.types'

export function useStudentDetail(studentId: string | undefined) {
  return useQuery({
    queryKey: ['student-detail', studentId],
    queryFn: async () => {
      if (!studentId) throw new Error('Student ID is required')

      // Fetch Profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', studentId)
        .single()

      if (profileError) throw profileError

      // Fetch Attendance via RPC
      const { data: attendanceData, error: attendanceError } = await supabase.rpc(
        'get_attendance_summary',
        { p_student_id: studentId }
      )

      if (attendanceError) throw attendanceError

      const attendance = ((attendanceData as any[]) || []).map((row) => ({
        class_id: row.class_id,
        subject_name: row.subject_name,
        present: Number(row.present_count),
        total: Number(row.total_count),
        percentage: Number(row.percentage),
      })) as AttendanceSummary[]

      // Fetch Grades
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('class_id')
        .eq('student_id', studentId)
        
      let grades: GradeSummary[] = []
      
      if (!enrollError && enrollments && enrollments.length > 0) {
        const classIds = enrollments.map(e => e.class_id)
        
        // Fetch grades for classes
        const { data: gradesData, error: gradesError } = await supabase
          .from('grades')
          .select('class_id, internal_marks, external_marks')
          .eq('student_id', studentId)
          .in('class_id', classIds)
          
        if (!gradesError) {
          const { data: classesData } = await supabase
            .from('classes')
            .select('id, subject_id')
            .in('id', classIds)
            
          if (classesData) {
            const subjectIds = [...new Set(classesData.map(c => c.subject_id))]
            const { data: subjectsData } = await supabase
              .from('subjects')
              .select('id, name')
              .in('id', subjectIds)
              
            const subjectMap = new Map((subjectsData || []).map(s => [s.id, s.name]))
            const classSubjectMap = new Map(classesData.map(c => [c.id, subjectMap.get(c.subject_id) || 'Unknown']))

            grades = (gradesData || []).map(g => {
              const internal = g.internal_marks || 0
              const external = g.external_marks || 0
              const total = internal + external
              
              let grade = 'F'
              if (total >= 90) grade = 'O'
              else if (total >= 80) grade = 'A+'
              else if (total >= 70) grade = 'A'
              else if (total >= 60) grade = 'B+'
              else if (total >= 50) grade = 'B'
              else if (total >= 40) grade = 'C'

              return {
                class_id: g.class_id,
                subject_name: classSubjectMap.get(g.class_id) || 'Unknown Subject',
                internal,
                external,
                total,
                grade
              }
            })
          }
        }
      }

      return {
        profile,
        attendance,
        grades
      }
    },
    enabled: !!studentId,
  })
}
