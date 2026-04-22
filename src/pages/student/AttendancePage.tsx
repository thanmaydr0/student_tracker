import { motion } from 'framer-motion'
import { BookOpen, CheckCircle2, XCircle, AlertTriangle, TrendingUp } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import AppShell from '../../components/layout/AppShell'
import { useAttendanceSummary } from '../../hooks/student/useAttendanceSummary'
import { Skeleton } from '../../components/ui/Skeleton'
import { cn } from '../../lib/utils'

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}
const itemVariants: any = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
}

function getStatusBadge(pct: number) {
  if (pct >= 85) return { label: 'Excellent', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 }
  if (pct >= 75) return { label: 'Good', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: TrendingUp }
  if (pct >= 60) return { label: 'At Risk', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertTriangle }
  return { label: 'Critical', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle }
}

export default function AttendancePage() {
  const { user } = useAuth()
  const { data: attendance, isLoading } = useAttendanceSummary(user?.id)

  // Compute overall stats
  const totalPresent = attendance?.reduce((sum, s) => sum + s.present, 0) ?? 0
  const totalClasses = attendance?.reduce((sum, s) => sum + s.total, 0) ?? 0
  const overallPct = totalClasses > 0 ? Math.round((totalPresent / totalClasses) * 100) : 0

  return (
    <AppShell role="student">
      <motion.div 
        className="flex flex-col gap-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Page Header */}
        <motion.div variants={itemVariants}>
          <h1 className="text-2xl font-bold tracking-tight text-brand-900 sm:text-3xl">
            Attendance Details
          </h1>
          <p className="mt-1 text-sm font-medium text-brand-500">
            Track your attendance across all enrolled subjects
          </p>
        </motion.div>

        {/* Overall Summary Cards */}
        {isLoading ? (
          <motion.div variants={itemVariants} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </motion.div>
        ) : (
          <motion.div variants={itemVariants} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Overall Attendance</p>
              <p className={cn(
                "mt-2 text-3xl font-bold",
                overallPct >= 75 ? "text-emerald-600" : overallPct >= 60 ? "text-amber-600" : "text-red-600"
              )}>
                {overallPct}%
              </p>
              <p className="mt-1 text-xs text-slate-500">{totalPresent} / {totalClasses} classes attended</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Subjects Enrolled</p>
              <p className="mt-2 text-3xl font-bold text-brand-700">{attendance?.length ?? 0}</p>
              <p className="mt-1 text-xs text-slate-500">Active this semester</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Below 75% Threshold</p>
              <p className={cn(
                "mt-2 text-3xl font-bold",
                (attendance?.filter(s => s.percentage < 75).length ?? 0) > 0 ? "text-red-600" : "text-emerald-600"
              )}>
                {attendance?.filter(s => s.percentage < 75).length ?? 0}
              </p>
              <p className="mt-1 text-xs text-slate-500">Subject(s) need attention</p>
            </div>
          </motion.div>
        )}

        {/* Subject-wise Breakdown */}
        <motion.div variants={itemVariants}>
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Subject Breakdown</h2>
          
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : !attendance || attendance.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-10 text-center">
              <BookOpen size={40} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No attendance records found</p>
              <p className="mt-1 text-xs text-slate-400">Attendance will appear here once you're enrolled and classes begin</p>
            </div>
          ) : (
            <div className="space-y-3">
              {attendance
                .sort((a, b) => a.percentage - b.percentage) // Show lowest first
                .map((subject) => {
                  const status = getStatusBadge(subject.percentage)
                  const StatusIcon = status.icon
                  const absent = subject.total - subject.present
                  const progressWidth = Math.min(100, Math.max(0, subject.percentage))

                  return (
                    <motion.div
                      key={subject.class_id}
                      whileHover={{ scale: 1.005 }}
                      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {/* Left: Subject info */}
                        <div className="flex items-start gap-3">
                          <div className={cn("mt-0.5 rounded-lg p-2 border", status.color)}>
                            <StatusIcon size={18} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900">{subject.subject_name}</h3>
                            <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <CheckCircle2 size={12} className="text-emerald-500" />
                                {subject.present} present
                              </span>
                              <span className="flex items-center gap-1">
                                <XCircle size={12} className="text-red-400" />
                                {absent} absent
                              </span>
                              <span className="text-slate-400">
                                {subject.total} total
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Percentage + badge */}
                        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                          <span className={cn(
                            "text-2xl font-bold tabular-nums",
                            subject.percentage >= 75 ? "text-emerald-600" : subject.percentage >= 60 ? "text-amber-600" : "text-red-600"
                          )}>
                            {Math.round(subject.percentage)}%
                          </span>
                          <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", status.color)}>
                            {status.label}
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progressWidth}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                          className={cn(
                            "h-full rounded-full",
                            subject.percentage >= 85 ? "bg-emerald-500" :
                            subject.percentage >= 75 ? "bg-blue-500" :
                            subject.percentage >= 60 ? "bg-amber-500" : "bg-red-500"
                          )}
                        />
                      </div>
                    </motion.div>
                  )
                })}
            </div>
          )}
        </motion.div>

      </motion.div>
    </AppShell>
  )
}
