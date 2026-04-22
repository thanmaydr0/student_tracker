import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export interface AttendanceLogEntry {
  student_id: string
  full_name: string
  status: 'Present' | 'Absent' | 'Excused' | null
}

export function useAttendanceLog(classId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: ['attendance-log', classId, date],
    queryFn: async () => {
      if (!classId || !date) throw new Error('Class ID and Date are required')

      // Get enrolled students
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('class_id', classId)

      if (enrollError) throw enrollError
      
      if (!enrollments || enrollments.length === 0) return []

      const studentIds = enrollments.map(e => e.student_id)

      // Get student profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', studentIds)

      if (profileError) throw profileError

      const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]))

      // Get attendance records
      const { data: attendanceRecords, error: attError } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('class_id', classId)
        .eq('date', date)
        
      if (attError) throw attError

      const attendanceMap = new Map((attendanceRecords || []).map(a => [a.student_id, a.status]))

      return studentIds.map(studentId => ({
        student_id: studentId,
        full_name: profileMap.get(studentId) || 'Unknown Student',
        status: (attendanceMap.get(studentId) as 'Present' | 'Absent' | 'Excused') || null
      })) as AttendanceLogEntry[]
    },
    enabled: !!classId && !!date,
  })
}
