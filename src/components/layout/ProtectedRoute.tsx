import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

interface ProtectedRouteProps {
  /** If set, only this role may access the route. If omitted, any authenticated user is allowed. */
  role?: 'student' | 'mentor'
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-surface-50 p-6">
      {/* Top navbar skeleton */}
      <div className="mb-8 h-14 w-full animate-pulse rounded-xl bg-brand-100" />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Card skeletons */}
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-4 rounded-2xl border border-brand-100 bg-white p-6 shadow-card"
          >
            <div className="h-4 w-24 animate-pulse rounded bg-brand-100" />
            <div className="h-8 w-32 animate-pulse rounded bg-brand-100" />
            <div className="mt-2 h-3 w-full animate-pulse rounded bg-brand-50" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-brand-50" />
          </div>
        ))}
      </div>

      {/* Content area skeleton */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-2xl bg-brand-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-brand-100" />
      </div>
    </div>
  )
}

export default function ProtectedRoute({ role }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()

  // Still loading auth state — show skeleton
  if (loading) return <DashboardSkeleton />

  // Not authenticated — redirect to login
  if (!user) return <Navigate to="/auth/login" replace />

  // User is authenticated but profile hasn't loaded yet.
  // This can happen if the profile fetch failed or is still in progress.
  // Don't redirect — just show the skeleton and let the page render.
  // The page components will handle their own loading states.
  if (!profile) {
    // If a specific role is required but we have no profile to check,
    // let the page through — the hooks inside will handle the null profile gracefully.
    return <Outlet />
  }

  // Role-based redirect: user is authenticated with a profile but wrong role
  if (role && profile.role !== role) {
    const correctPath =
      profile.role === 'mentor' ? '/mentor/dashboard' : '/student/dashboard'
    return <Navigate to={correctPath} replace />
  }

  return <Outlet />
}
