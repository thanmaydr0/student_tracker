import { useQuery } from '@tanstack/react-query'
import { startOfWeek, addWeeks, setDay } from 'date-fns'
import { supabase } from '../../lib/supabase'

export interface MentorTimetableSlot {
  id: string
  class_id: string
  subject_name: string
  branch: string
  semester: number
  day_of_week: number
  start_time: string
  end_time: string
  location: string | null
  date: Date
  duration_minutes: number
}

export function useMentorTimetable(mentorId: string | undefined, weekOffset: number = 0) {
  return useQuery({
    queryKey: ['mentor-timetable', mentorId, weekOffset],
    queryFn: async () => {
      if (!mentorId) throw new Error('Mentor ID is required')

      // Get mentor's classes
      const { data: classes, error: classError } = await supabase
        .from('classes')
        .select(`
          id, semester, academic_year,
          subjects ( name ),
          enrollments ( profiles!inner(branch) )
        `)
        .eq('mentor_id', mentorId)

      if (classError) throw classError

      if (!classes || classes.length === 0) return []
      
      const classIds = classes.map(c => c.id)

      // We extract branch from the first enrolled student, or assume generic.
      const classesMap = new Map(classes.map(c => {
        const branchMatch = c.enrollments?.[0]?.profiles?.branch || 'General'
        return [c.id, {
          name: (c.subjects as any)?.name || 'Unknown Subject',
          branch: branchMatch,
          semester: c.semester
        }]
      }))

      // Get timetables for these classes
      const { data: timetables, error: ttError } = await supabase
        .from('timetables')
        .select('*')
        .in('class_id', classIds)

      if (ttError) throw ttError

      // Compute dates based on weekOffset
      const now = new Date()
      // start of current week (Monday)
      const weekStart = startOfWeek(now, { weekStartsOn: 1 })
      const targetWeekStart = addWeeks(weekStart, weekOffset)

      return (timetables || []).map(slot => {
        // Map day_of_week (0=Sun, 1=Mon, ..., 6=Sat) to a specific Date in the target week
        // Note: setDay(..., slot.day_of_week) sets the day. If weekStartsOn is 1, setDay uses local week semantics where 0=Sun.
        const slotDate = setDay(targetWeekStart, slot.day_of_week, { weekStartsOn: 1 })

        const [startHours, startMinutes] = slot.start_time.split(':').map(Number)
        const [endHours, endMinutes] = slot.end_time.split(':').map(Number)

        const startTotalMinutes = startHours * 60 + startMinutes
        const endTotalMinutes = endHours * 60 + endMinutes

        const cls = classesMap.get(slot.class_id)

        return {
          id: slot.id,
          class_id: slot.class_id,
          subject_name: cls?.name || '',
          branch: cls?.branch || '',
          semester: cls?.semester || 1,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
          location: slot.location,
          date: slotDate,
          duration_minutes: endTotalMinutes - startTotalMinutes
        }
      }) as MentorTimetableSlot[]
    },
    enabled: !!mentorId,
  })
}
