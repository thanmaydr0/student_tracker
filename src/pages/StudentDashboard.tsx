import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { format, formatDistanceToNow } from 'date-fns'
import { AlertCircle, CheckCircle2, Loader2, XCircle, Database, RefreshCcw, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import AppShell from '../components/layout/AppShell'
import ProfileCard from '../components/student/ProfileCard'
import AttendanceChart from '../components/student/AttendanceChart'
import MarksTable from '../components/student/MarksTable'
import PredictionWidget from '../components/student/PredictionWidget'
import TimetableAnalyzer from '../components/student/TimetableAnalyzer'
import IATMarksCard from '../components/student/IATMarksCard'
import { seedDemoData } from '../lib/seedDemo'

import { useStudentProfile } from '../hooks/student/useStudentProfile'
import { useAttendanceSummary } from '../hooks/student/useAttendanceSummary'
import { useGradesSummary } from '../hooks/student/useGradesSummary'
import { usePrediction } from '../hooks/student/usePrediction'
import { useQueryClient } from '@tanstack/react-query'

// --- Time of day greeting ---
function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  if (hour >= 17 && hour < 21) return 'Good evening'
  return 'Working late'
}

// --- Framer Motion Animation Variants ---
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.05 },
  },
}

const itemVariants: any = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

// Query status indicator
function QueryStatus({ label, isLoading, isError, hasData }: {
  label: string, isLoading: boolean, isError: boolean, hasData: boolean
}) {
  let icon, color, status
  if (isLoading) {
    icon = <Loader2 size={14} className="animate-spin text-amber-500" />
    color = 'text-amber-700'
    status = 'Loading...'
  } else if (isError) {
    icon = <XCircle size={14} className="text-red-500" />
    color = 'text-red-700'
    status = 'Error'
  } else if (hasData) {
    icon = <CheckCircle2 size={14} className="text-green-500" />
    color = 'text-green-700'
    status = 'OK'
  } else {
    icon = <AlertCircle size={14} className="text-slate-400" />
    color = 'text-slate-500'
    status = 'Empty'
  }

  return (
    <div className="flex items-center gap-1.5 text-xs font-medium">
      {icon}
      <span className={color}>{label}: {status}</span>
    </div>
  )
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [seeding, setSeeding] = useState(false)
  const [loadingTooLong, setLoadingTooLong] = useState(false)
  // const mountTime = useRef(Date.now())
  
  // Data Fetching Hooks
  const profileQuery = useStudentProfile(user?.id)
  const attendanceQuery = useAttendanceSummary(user?.id)
  const gradesQuery = useGradesSummary(user?.id)
  
  const predictionQuery = usePrediction({
    userId: user?.id,
    isAttendanceLoaded: !attendanceQuery.isLoading,
    isGradesLoaded: !gradesQuery.isLoading,
  })

  // Convenience aliases
  const profile = profileQuery.data
  const attendance = attendanceQuery.data
  const grades = gradesQuery.data
  const prediction = predictionQuery.data

  // Detect when loading takes too long (> 8 seconds)
  const anyLoading = profileQuery.isLoading || attendanceQuery.isLoading || gradesQuery.isLoading
  
  useEffect(() => {
    if (!anyLoading) {
      setLoadingTooLong(false)
      return
    }
    
    const timer = setTimeout(() => {
      setLoadingTooLong(true)
    }, 8000)
    
    return () => clearTimeout(timer)
  }, [anyLoading])

  // Show banner when:
  // 1. Queries have errors
  // 2. Queries settled but no data
  // 3. Loading too long (> 8 seconds)
  const allQueriesSettled = !profileQuery.isLoading && !attendanceQuery.isLoading && !gradesQuery.isLoading
  const hasNoData = allQueriesSettled && (
    (!attendance || attendance.length === 0) && 
    (!grades || grades.length === 0)
  )
  const hasErrors = profileQuery.isError || attendanceQuery.isError || gradesQuery.isError
  const showBanner = hasErrors || hasNoData || loadingTooLong

  // Debug logging
  useEffect(() => {
    console.log('[Dashboard] === DATA STATUS ===')
    console.log('[Dashboard] User ID:', user?.id || 'NOT SET')
    console.log('[Dashboard] Profile:', { 
      data: profile ? `${profile.full_name} (${profile.role})` : 'undefined',
      loading: profileQuery.isLoading, 
      error: profileQuery.isError,
      errorMsg: profileQuery.error?.message
    })
    console.log('[Dashboard] Attendance:', { 
      data: attendance ? `${attendance.length} subjects` : 'undefined',
      loading: attendanceQuery.isLoading, 
      error: attendanceQuery.isError,
      errorMsg: attendanceQuery.error?.message
    })
    console.log('[Dashboard] Grades:', { 
      data: grades ? `${grades.length} subjects` : 'undefined',
      loading: gradesQuery.isLoading, 
      error: gradesQuery.isError,
      errorMsg: gradesQuery.error?.message
    })
    console.log('[Dashboard] =================')
  }, [
    user?.id, profile, attendance, grades,
    profileQuery.isLoading, profileQuery.isError,
    attendanceQuery.isLoading, attendanceQuery.isError,
    gradesQuery.isLoading, gradesQuery.isError,
  ])

  // Seed demo data handler
  const handleSeedData = async () => {
    if (!user?.id) return
    setSeeding(true)
    
    const result = await seedDemoData(user.id)
    
    if (result.success) {
      toast.success(result.message, { duration: 5000 })
      // Invalidate all queries to refetch data
      await queryClient.invalidateQueries()
      // Force reload the page to clear any stale query states
      setTimeout(() => window.location.reload(), 1500)
    } else {
      toast.error(`Seed failed: ${result.message}`, { duration: 8000 })
    }
    
    setSeeding(false)
  }

  // --- Dynamic state ---
  const [greeting] = useState(getGreeting())
  const [currentDate] = useState(() => format(new Date(), 'EEEE, MMMM d'))
  const [lastUpdated, setLastUpdated] = useState(() => formatDistanceToNow(new Date(), { addSuffix: true }))

  useEffect(() => {
    const fetchTime = new Date()
    const interval = setInterval(() => {
      setLastUpdated(formatDistanceToNow(fetchTime, { addSuffix: true }))
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <AppShell role="student">
      <motion.div 
        className="flex flex-col gap-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >

        {/* 1. Page Header */}
        <motion.div variants={itemVariants} className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-brand-900 sm:text-3xl">
            {greeting}, {profile?.full_name?.split(' ')[0] || 'Student'}
          </h1>
          <p className="text-sm font-medium text-brand-500">
            {currentDate}
          </p>
        </motion.div>

        {/* Diagnostic Banner + Seed Button */}
        {showBanner && (
          <motion.div variants={itemVariants}>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                {loadingTooLong && anyLoading ? (
                  <Clock size={20} className="mt-0.5 shrink-0 text-amber-600" />
                ) : (
                  <AlertCircle size={20} className="mt-0.5 shrink-0 text-amber-600" />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-amber-800 mb-2">
                    {loadingTooLong && anyLoading
                      ? 'Data is taking too long to load'
                      : hasNoData 
                        ? 'No Academic Data Found'
                        : 'Data Loading Issues'}
                  </h4>
                  
                  <div className="flex flex-wrap gap-3 mb-3">
                    <QueryStatus label="Profile" isLoading={profileQuery.isLoading} isError={profileQuery.isError} hasData={!!profile} />
                    <QueryStatus label="Attendance" isLoading={attendanceQuery.isLoading} isError={attendanceQuery.isError} hasData={!!attendance && attendance.length > 0} />
                    <QueryStatus label="Grades" isLoading={gradesQuery.isLoading} isError={gradesQuery.isError} hasData={!!grades && grades.length > 0} />
                  </div>

                  {hasErrors && (
                    <div className="mb-3 space-y-1">
                      {profileQuery.error && <p className="text-xs text-red-600 font-mono">Profile: {profileQuery.error.message}</p>}
                      {attendanceQuery.error && <p className="text-xs text-red-600 font-mono">Attendance: {attendanceQuery.error.message}</p>}
                      {gradesQuery.error && <p className="text-xs text-red-600 font-mono">Grades: {gradesQuery.error.message}</p>}
                    </div>
                  )}

                  <p className="text-xs text-amber-700 mb-3">
                    {loadingTooLong && anyLoading
                      ? 'Supabase API calls are hanging. Your project may be paused (free tier pauses after inactivity). Check your Supabase dashboard. You can also try seeding demo data below.'
                      : hasNoData 
                        ? 'Your account doesn\'t have any academic data yet. Click "Seed Demo Data" to populate your dashboard.'
                        : 'Some data failed to load. Try seeding demo data or check the browser console.'}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleSeedData}
                      disabled={seeding}
                      className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-700 disabled:opacity-50"
                    >
                      {seeding ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Database size={16} />
                      )}
                      {seeding ? 'Seeding...' : 'Seed Demo Data'}
                    </button>

                    <button
                      onClick={() => window.location.reload()}
                      className="flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-700 shadow-sm transition-colors hover:bg-amber-50"
                    >
                      <RefreshCcw size={16} />
                      Reload Page
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 2. Profile Context */}
        <motion.div variants={itemVariants}>
          <ProfileCard profile={profile} loading={profileQuery.isLoading} />
        </motion.div>

        {/* 3. Overview Grid: Attendance & Marks */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <motion.div variants={itemVariants}>
            <AttendanceChart data={attendance} isLoading={attendanceQuery.isLoading} />
          </motion.div>
          
          <motion.div variants={itemVariants}>
            <MarksTable data={grades} isLoading={gradesQuery.isLoading} />
          </motion.div>
        </div>

        {/* 4. IAT Marks (Read-only) */}
        <motion.div variants={itemVariants}>
          <IATMarksCard userId={user?.id} />
        </motion.div>

        {/* 5. AI Prediction */}
        <motion.div variants={itemVariants}>
          <PredictionWidget 
            data={prediction} 
            isLoading={predictionQuery.isLoading} 
            isError={predictionQuery.isError}
            onRetry={predictionQuery.refetch}
          />
        </motion.div>

        {/* 5. Timetable & Calendar AI Analyzer */}
        <motion.div variants={itemVariants}>
          <TimetableAnalyzer />
        </motion.div>

        {/* 6. Footer */}
        <motion.div variants={itemVariants} className="flex justify-center pb-8 pt-2">
           <p className="text-xs text-brand-400 font-medium">Last updated {lastUpdated}</p>
        </motion.div>

      </motion.div>
    </AppShell>
  )
}
