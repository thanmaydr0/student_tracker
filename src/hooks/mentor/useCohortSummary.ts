import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export function useCohortSummary(mentorId: string | undefined) {
  return useQuery({
    queryKey: ['cohort-summary', mentorId],
    queryFn: async () => {
      if (!mentorId) throw new Error('Mentor ID is required')
      
      const { data, error } = await supabase.rpc('get_mentor_cohort_summary', { 
        p_mentor_id: mentorId 
      })
      
      if (error) {
        console.error('[Cohort] Fetch failed:', error.message)
        throw error
      }
      
      return data
    },
    enabled: !!mentorId,
  })
}
