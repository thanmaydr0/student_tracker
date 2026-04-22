import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface SubmitAttendancePayload {
  student_id: string
  class_id: string
  date: string
  status: 'Present' | 'Absent' | 'Excused'
}

export function useSubmitAttendance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (records: SubmitAttendancePayload[]) => {
      if (!records || records.length === 0) return

      const { data, error } = await supabase
        .from('attendance')
        .upsert(records, { onConflict: 'student_id,class_id,date' })
        
      if (error) throw new Error(error.message)
      
      return data
    },
    onSuccess: () => {
      toast.success('Attendance updated successfully')
      queryClient.invalidateQueries({ queryKey: ['attendance-log'] })
      queryClient.invalidateQueries({ queryKey: ['cohort-summary'] })
    },
    onError: (error: Error) => {
      toast.error(`Failed to update attendance: ${error.message}`)
    }
  })
}
