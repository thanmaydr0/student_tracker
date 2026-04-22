import { useQuery } from '@tanstack/react-query'
import { startOfWeek, addWeeks, setDay } from 'date-fns'
import { supabase } from '../../lib/supabase'

export interface ComputedTimetableSlot {
  id: string
  class_id: string
  subject_name: string
  mentor_name: string
  day_of_week: number
  start_time: string
  end_time: string
  location: string | null
  // Computed fields
  date: Date
  duration_minutes: number
}

export function useTimetable(userId: string | undefined, weekOffset: number = 0) {
  return useQuery({
    queryKey: ['timetable', userId, weekOffset],
    queryFn: async () => {
      console.log('[Timetable] ▶ queryFn START, userId:', userId, 'weekOffset:', weekOffset)

      if (!userId) throw new Error('User ID is required')

      // Step 1: Get enrolled class_ids
      console.log('[Timetable] Step 1: Fetching enrollments...')
      const { data: enrollments, error: enrollErr } = await supabase
        .from('enrollments')
        .select('class_id')
        .eq('student_id', userId)

      console.log('[Timetable] Enrollments:', { count: enrollments?.length, error: enrollErr?.message })

      if (enrollErr) {
        console.error('[Timetable] Enrollment fetch FAILED:', enrollErr)
        throw enrollErr
      }

      if (!enrollments || enrollments.length === 0) {
        console.warn('[Timetable] No enrollments — returning empty')
        return [] as ComputedTimetableSlot[]
      }

      const classIds = enrollments.map((e) => e.class_id)
      console.log('[Timetable] Class IDs:', classIds)

      // Step 2: Get timetable slots for those classes
      console.log('[Timetable] Step 2: Fetching timetable slots...')
      const { data: slots, error: slotErr } = await supabase
        .from('timetables')
        .select('id, class_id, day_of_week, start_time, end_time, location')
        .in('class_id', classIds)

      console.log('[Timetable] Slots:', { count: slots?.length, error: slotErr?.message })

      if (slotErr) {
        console.error('[Timetable] Timetable fetch FAILED:', slotErr)
        throw slotErr
      }

      if (!slots || slots.length === 0) {
        console.warn('[Timetable] No timetable slots found')
        return [] as ComputedTimetableSlot[]
      }

      // Step 3: Get class→subject→mentor mapping
      console.log('[Timetable] Step 3: Fetching classes...')
      const { data: classes, error: classErr } = await supabase
        .from('classes')
        .select('id, subject_id, mentor_id')
        .in('id', classIds)

      console.log('[Timetable] Classes:', { count: classes?.length, error: classErr?.message })

      if (classErr) {
        console.error('[Timetable] Classes fetch FAILED:', classErr)
        throw classErr
      }

      // Step 4: Get subjects
      const subjectIds = [...new Set((classes || []).map((c) => c.subject_id))]
      console.log('[Timetable] Step 4: Fetching subjects for IDs:', subjectIds)
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds)

      console.log('[Timetable] Subjects:', subjects?.length)

      // Step 5: Get mentor names
      // NOTE: RLS on profiles only allows reading own profile
      // A student CANNOT read other users' profiles
      // So we graciously handle this with a try/catch
      const mentorIds = [...new Set((classes || []).map((c) => c.mentor_id))]
      let mentorMap = new Map<string, string>()
      
      if (mentorIds.length > 0) {
        console.log('[Timetable] Step 5: Fetching mentor profiles (may fail due to RLS)...')
        try {
          const { data: mentors, error: mentorErr } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', mentorIds)
          
          if (mentorErr) {
            console.warn('[Timetable] Mentor fetch error (expected - RLS blocks cross-user reads):', mentorErr.message)
          } else if (mentors && mentors.length > 0) {
            mentorMap = new Map(mentors.map((m) => [m.id, m.full_name]))
            console.log('[Timetable] Mentors found:', mentors.length)
          } else {
            console.log('[Timetable] No mentor profiles accessible (RLS)')
          }
        } catch (e) {
          console.warn('[Timetable] Mentor fetch exception (handled gracefully):', e)
        }
      }

      // Build lookup maps
      const subjectMap = new Map((subjects || []).map((s) => [s.id, s.name]))
      const classInfoMap = new Map(
        (classes || []).map((c) => [
          c.id,
          {
            subjectName: subjectMap.get(c.subject_id) || 'Unknown Subject',
            mentorName: mentorMap.get(c.mentor_id) || 'Faculty',
          },
        ])
      )

      // Calculate the start of the target week
      const now = new Date()
      const targetWeekStart = startOfWeek(addWeeks(now, weekOffset))

      const result = slots.map((row) => {
        const slotDate = setDay(targetWeekStart, row.day_of_week)
        const info = classInfoMap.get(row.class_id)

        // Calculate duration
        const [startH, startM] = row.start_time.split(':').map(Number)
        const [endH, endM] = row.end_time.split(':').map(Number)
        const durationMinutes = endH * 60 + endM - (startH * 60 + startM)

        return {
          id: row.id,
          class_id: row.class_id,
          subject_name: info?.subjectName || 'Unknown Subject',
          mentor_name: info?.mentorName || 'Faculty',
          day_of_week: row.day_of_week,
          start_time: row.start_time,
          end_time: row.end_time,
          location: row.location,
          date: slotDate,
          duration_minutes: durationMinutes,
        } as ComputedTimetableSlot
      })

      console.log('[Timetable] ✅ Final result:', result.length, 'slots')
      console.log('[Timetable] Day distribution:', result.map(s => `day${s.day_of_week}: ${s.subject_name}`))
      return result
    },
    enabled: !!userId,
  })
}
