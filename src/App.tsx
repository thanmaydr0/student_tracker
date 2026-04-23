import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/layout/ProtectedRoute'

// Lazy-loaded pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const SignUpPage = lazy(() => import('./pages/auth/SignUpPage'))
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'))
const TimetablePage = lazy(() => import('./pages/student/TimetablePage'))
const AttendancePage = lazy(() => import('./pages/student/AttendancePage'))
const NotificationsPage = lazy(() => import('./pages/shared/NotificationsPage'))
const MentorDashboard = lazy(() => import('./pages/mentor/MentorDashboard'))
const StudentDetailPage = lazy(() => import('./pages/mentor/StudentDetailPage'))
const BulkAttendancePage = lazy(() => import('./pages/mentor/BulkAttendancePage'))
const TimetableManagePage = lazy(() => import('./pages/mentor/TimetableManagePage'))
const IATMarksPage = lazy(() => import('./pages/mentor/IATMarksPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-300 border-t-brand-800" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Navigate to="/auth/login" replace />} />
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/auth/signup" element={<SignUpPage />} />

              {/* Student routes */}
              <Route element={<ProtectedRoute role="student" />}>
                <Route path="/student/dashboard" element={<StudentDashboard />} />
                <Route path="/student/timetable" element={<TimetablePage />} />
                <Route path="/student/attendance" element={<AttendancePage />} />
                <Route path="/student/notifications" element={<NotificationsPage />} />
              </Route>

              {/* Mentor routes */}
              <Route element={<ProtectedRoute role="mentor" />}>
                <Route path="/mentor/dashboard" element={<MentorDashboard />} />
                <Route path="/mentor/student/:id" element={<StudentDetailPage />} />
                <Route path="/mentor/attendance" element={<BulkAttendancePage />} />
                <Route path="/mentor/timetable" element={<TimetableManagePage />} />
                <Route path="/mentor/iat-marks" element={<IATMarksPage />} />
              </Route>

              {/* Shared protected routes (any authenticated user) */}
              <Route element={<ProtectedRoute />}>
                <Route path="/profile" element={<ProfilePage />} />
              </Route>

              {/* 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>

          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                fontFamily: 'DM Sans, system-ui, sans-serif',
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '14px',
              },
            }}
          />
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}
