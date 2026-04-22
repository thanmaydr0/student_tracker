import { supabase } from './supabase'

/**
 * Seed demo data for the currently logged-in student.
 * Uses the SECURITY DEFINER RPC function `seed_demo_data` to bypass RLS.
 * 
 * PREREQUISITE: The `0004_seed_demo_function.sql` migration must be applied.
 * If the RPC function doesn't exist, falls back to the original demo_seed.sql instructions.
 */
export async function seedDemoData(studentId: string): Promise<{ success: boolean; message: string }> {
  try {
    console.log('[Seed] Starting demo data seed for:', studentId)

    // Call the SECURITY DEFINER RPC function that bypasses RLS
    const { data, error } = await supabase.rpc('seed_demo_data', {
      p_student_id: studentId,
    })

    if (error) {
      console.error('[Seed] ✖ RPC seed_demo_data failed:', error.message)
      
      // Check if the function doesn't exist
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        return {
          success: false,
          message: 'The seed function is not deployed yet. Please run the SQL file "supabase/migrations/0004_seed_demo_function.sql" in your Supabase SQL Editor first, then try again.'
        }
      }
      
      return { success: false, message: error.message }
    }

    const resultMessage = typeof data === 'string' ? data : 'Demo data seeded!'
    
    if (resultMessage.startsWith('Error:')) {
      console.error('[Seed] ✖ Seed returned error:', resultMessage)
      return { success: false, message: resultMessage }
    }

    console.log('[Seed] ✅', resultMessage)
    return { success: true, message: resultMessage }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during seeding'
    console.error('[Seed] ✖ Seeding exception:', message)
    return { success: false, message }
  }
}
