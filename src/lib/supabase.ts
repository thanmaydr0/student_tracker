import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient<Database>(url, key, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: (input, init) => {
      // Wrap each fetch with a 12-second abort timeout
      // This prevents Supabase REST calls from hanging forever
      // (e.g., when auth token refresh is stuck)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.warn('[Supabase] Fetch timeout (12s):', typeof input === 'string' ? input.split('?')[0] : input)
        controller.abort()
      }, 12000)

      // Merge the abort signal with any existing signal
      const existingSignal = init?.signal
      if (existingSignal) {
        existingSignal.addEventListener('abort', () => controller.abort())
      }

      return fetch(input, {
        ...init,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId))
    },
  },
})

// Debug: Log when supabase client is initialized
console.log('[Supabase] Client initialized for:', url)
