import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export interface Intervention {
  id: string
  mentor_id: string
  student_id: string
  type: string
  notes: string | null
  date: string
  created_at: string
}

export function useInterventions(studentId: string | undefined) {
  return useQuery({
    queryKey: ['interventions', studentId],
    queryFn: async () => {
      if (!studentId) throw new Error('Student ID is required')

      const { data, error } = await supabase
        .from('interventions')
        .select('*')
        .eq('student_id', studentId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(error.message)
      }

      return data as Intervention[]
    },
    enabled: !!studentId,
  })
}
