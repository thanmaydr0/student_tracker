import type { ReactNode } from 'react'
import { useAuth } from '../../hooks/useAuth'

interface RoleGuardProps {
  allowed: Array<'student' | 'mentor'>
  children: ReactNode
  fallback?: ReactNode
}

export default function RoleGuard({ allowed, children, fallback = null }: RoleGuardProps) {
  const { profile } = useAuth()

  if (!profile || !allowed.includes(profile.role as 'student' | 'mentor')) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
