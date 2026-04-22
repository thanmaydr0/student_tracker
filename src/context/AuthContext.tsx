import { createContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { User, AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

export interface AuthContextValue {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (
    email: string,
    password: string,
    metadata: { full_name: string; role: string; branch: string; semester: number }
  ) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch profile — fully wrapped, can never throw
  const loadProfile = useCallback(async (userId: string) => {
    try {
      console.log('[Auth] Loading profile for:', userId)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.warn('[Auth] Profile fetch error:', error.message, error.code)
        setProfile(null)
      } else {
        console.log('[Auth] Profile loaded:', data?.full_name, data?.role)
        setProfile(data)
      }
    } catch (e: any) {
      console.warn('[Auth] Profile fetch exception:', e?.message || e)
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    console.log('[Auth] Provider mounted, initializing...')
    let isMounted = true

    // ---- 1. Subscribe to auth changes FIRST ----
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] onAuthStateChange:', event, '| hasSession:', !!session)
      
      if (!isMounted) return

      const currentUser = session?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        // Use setTimeout to prevent potential deadlock with auth state
        setTimeout(() => {
          if (isMounted) loadProfile(currentUser.id)
        }, 0)
      } else {
        setProfile(null)
      }

      // Always clear loading when we get an auth state change
      setLoading(false)
    })

    // ---- 2. Initial session check with timeout ----
    const initAuth = async () => {
      try {
        console.log('[Auth] Calling getSession()...')
        
        // Race getSession against a 5-second timeout
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => {
            console.warn('[Auth] getSession() timed out after 5s')
            resolve(null)
          }, 5000)
        })
        
        const result = await Promise.race([sessionPromise, timeoutPromise])
        
        if (!isMounted) return

        if (result && 'data' in result) {
          const { data, error } = result
          console.log('[Auth] getSession result:', { 
            hasSession: !!data.session, 
            error: error?.message,
            userId: data.session?.user?.id?.slice(0, 8)
          })

          if (data.session?.user) {
            setUser(data.session.user)
            await loadProfile(data.session.user.id)
          }
        } else {
          console.warn('[Auth] getSession timed out, relying on onAuthStateChange')
        }
      } catch (e: any) {
        console.error('[Auth] getSession exception:', e?.message || e)
      }
      
      if (isMounted) {
        console.log('[Auth] Setting loading = false (initAuth complete)')
        setLoading(false)
      }
    }

    initAuth()

    // ---- 3. Safety timeout ----
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setLoading((prev) => {
          if (prev) {
            console.warn('[Auth] Safety timeout: forcing loading = false')
            return false
          }
          return prev
        })
      }
    }, 6000)

    return () => {
      isMounted = false
      clearTimeout(safetyTimer)
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error as AuthError
  }, [])

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      metadata: { full_name: string; role: string; branch: string; semester: number }
    ) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
      })

      if (error) throw error as AuthError

      if (data.user) {
        const { error: rpcError } = await supabase.rpc('create_profile', {
          p_user_id: data.user.id,
          p_full_name: metadata.full_name,
          p_role: metadata.role,
          p_branch: metadata.branch,
          p_semester: metadata.semester,
        })

        if (rpcError) {
          console.error('[Auth] Profile creation failed:', rpcError.message)
        }
      }
    },
    []
  )

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error as AuthError
    setUser(null)
    setProfile(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
