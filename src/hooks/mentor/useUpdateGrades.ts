import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface UpdateGradesPayload {
  student_id: string
  class_id: string
  internal_marks: number
  external_marks: number
}

export function useUpdateGrades() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (record: UpdateGradesPayload) => {
      const { data, error } = await supabase
        .from('grades')
        .upsert({
          student_id: record.student_id,
          class_id: record.class_id,
          internal_marks: record.internal_marks,
          external_marks: record.external_marks,
          // Handle potential missing created_at by using updated_at only, but usually handled by DB
        }, { onConflict: 'student_id,class_id' })
        
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      toast.success('Grades updated successfully')
      queryClient.invalidateQueries({ queryKey: ['student-detail'] })
    },
    onError: (error: Error) => {
      toast.error(`Failed to update grades: ${error.message}`)
    }
  })
}
