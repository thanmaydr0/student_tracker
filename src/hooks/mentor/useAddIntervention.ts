import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface AddInterventionPayload {
  student_id: string
  mentor_id: string
  type: string
  notes: string
  date: string
}

export function useAddIntervention() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: AddInterventionPayload) => {
      const { data, error } = await supabase
        .from('interventions')
        .insert([{
          student_id: payload.student_id,
          mentor_id: payload.mentor_id,
          type: payload.type,
          notes: payload.notes,
          date: payload.date
        }])
        .select()
        .single()
        
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: (data) => {
      toast.success('Intervention logged successfully')
      queryClient.invalidateQueries({ queryKey: ['interventions', data.student_id] })
    },
    onError: (error: Error) => {
      toast.error(`Failed to log intervention: ${error.message}`)
    }
  })
}
