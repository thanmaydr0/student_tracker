import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { StudentProfile } from '../../types/app.types'

export function useStudentProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      console.log('[Profile] ▶ queryFn START, userId:', userId)

      if (!userId) throw new Error('User ID is required')

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('[Profile] ✖ Fetch FAILED:', error.message, '| code:', error.code, '| details:', error.details)
        throw error
      }

      console.log('[Profile] ✅ Got profile:', {
        name: data?.full_name,
        role: data?.role,
        branch: data?.branch,
        semester: data?.semester,
        mentor_id: data?.mentor_id,
      })

      return data as StudentProfile
    },
    enabled: !!userId,
  })
}
