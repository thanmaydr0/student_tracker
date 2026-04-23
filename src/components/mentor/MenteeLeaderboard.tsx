import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Medal, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Crown, AlertTriangle } from 'lucide-react'
import { cn } from '../../lib/utils'

interface StudentData {
  student_id: string
  full_name: string
  branch: string
  semester: number
  avg_attendance: number | null
  avg_total_score: number | null
  failing_subjects: number
  risk_level: string | null
}

interface LeaderboardProps {
  cohortData: StudentData[] | undefined
  isLoading: boolean
  onStudentClick?: (studentId: string) => void
}

// Compute a composite score (0-100) from attendance, marks, and failing subjects
function computeCompositeScore(s: StudentData): number {
  const att = s.avg_attendance ?? 0
  const score = s.avg_total_score ?? 0
  const failPenalty = s.failing_subjects * 10
  // Weighted: 40% attendance, 50% score, 10% fail penalty
  return Math.max(0, Math.min(100, (att * 0.4) + (score * 0.5) - failPenalty))
}

function getRankStyle(rank: number) {
  if (rank === 1) return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: <Crown size={18} className="text-amber-500" />, medal: '🥇' }
  if (rank === 2) return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', icon: <Medal size={18} className="text-slate-400" />, medal: '🥈' }
  if (rank === 3) return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: <Medal size={18} className="text-orange-400" />, medal: '🥉' }
  return { bg: 'bg-white', border: 'border-slate-100', text: 'text-slate-700', icon: null, medal: '' }
}

function ScoreBar({ value, max = 100, color }: { value: number, max?: number, color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={cn('h-full rounded-full', color)}
      />
    </div>
  )
}

export default function MenteeLeaderboard({ cohortData, isLoading, onStudentClick }: LeaderboardProps) {
  const [expanded, setExpanded] = useState(false)

  const rankedStudents = useMemo(() => {
    if (!cohortData || cohortData.length === 0) return []
    return [...cohortData]
      .map(s => ({ ...s, compositeScore: computeCompositeScore(s) }))
      .sort((a, b) => b.compositeScore - a.compositeScore)
  }, [cohortData])

  const topPerformers = rankedStudents.slice(0, 3)
  const bottomPerformers = rankedStudents.length > 3
    ? rankedStudents.slice(-Math.min(3, rankedStudents.length - 3)).reverse()
    : []
  const middleStudents = rankedStudents.slice(3, expanded ? undefined : 3 + 5)
  const hasMore = rankedStudents.length > 3 + 5

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-slate-100 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-36 bg-slate-100 rounded animate-pulse" />
            <div className="h-3 w-48 bg-slate-50 rounded animate-pulse" />
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <div className="h-8 w-8 rounded-full bg-slate-100 animate-pulse" />
            <div className="flex-1 h-4 bg-slate-100 rounded animate-pulse" />
            <div className="h-4 w-12 bg-slate-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (!rankedStudents.length) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-6 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 shadow-sm">
          <Trophy size={20} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800 tracking-tight">Mentee Leaderboard</h2>
          <p className="text-xs text-slate-500 font-medium">Ranked by composite score (attendance + marks – failures)</p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Top 3 Podium */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {topPerformers.map((student, idx) => {
            const rank = idx + 1
            const style = getRankStyle(rank)
            return (
              <motion.div
                key={student.student_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                onClick={() => onStudentClick?.(student.student_id)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md',
                  style.bg, style.border
                )}
              >
                <span className="text-2xl">{style.medal}</span>
                <span className="text-sm font-bold text-slate-800 text-center leading-tight">{student.full_name}</span>
                <div className="w-full mt-1">
                  <ScoreBar value={student.compositeScore} color={rank === 1 ? 'bg-amber-400' : rank === 2 ? 'bg-slate-400' : 'bg-orange-400'} />
                </div>
                <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
                  <span>Score: <span className={cn('font-bold', style.text)}>{Math.round(student.compositeScore)}</span></span>
                  <span>Att: {student.avg_attendance ?? 0}%</span>
                  <span>Avg: {student.avg_total_score ?? 0}</span>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Full Ranking List */}
        {rankedStudents.length > 3 && (
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} className="text-slate-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Full Ranking</h4>
            </div>
            <div className="divide-y divide-slate-50">
              {(expanded ? rankedStudents.slice(3) : middleStudents).map((student, idx) => {
                const rank = idx + 4
                return (
                  <motion.div
                    key={student.student_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => onStudentClick?.(student.student_id)}
                    className="flex items-center gap-4 py-3 px-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <span className="text-sm font-bold text-slate-400 w-6 text-center">#{rank}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-slate-700 truncate block">{student.full_name}</span>
                      <div className="mt-1">
                        <ScoreBar value={student.compositeScore} color="bg-indigo-400" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-medium text-slate-500 shrink-0">
                      <span className="hidden sm:inline">{student.avg_attendance ?? 0}% att</span>
                      <span className="hidden sm:inline">{student.avg_total_score ?? 0} avg</span>
                      <span className="font-bold text-slate-700">{Math.round(student.compositeScore)}</span>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {hasMore && !expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors py-2"
              >
                <ChevronDown size={14} />
                Show all {rankedStudents.length - 3} students
              </button>
            )}
            {expanded && (
              <button
                onClick={() => setExpanded(false)}
                className="mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors py-2"
              >
                <ChevronUp size={14} />
                Show less
              </button>
            )}
          </div>
        )}

        {/* Bottom Performers Alert */}
        {bottomPerformers.length > 0 && (
          <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-800 mb-3">
              <TrendingDown size={14} />
              Needs Attention
            </h4>
            <div className="space-y-2">
              {bottomPerformers.map((student) => (
                <div
                  key={student.student_id}
                  onClick={() => onStudentClick?.(student.student_id)}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-red-100 cursor-pointer hover:border-red-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-500">
                      <AlertTriangle size={14} />
                    </div>
                    <span className="text-sm font-semibold text-slate-700">{student.full_name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-medium">
                    <span className={cn(
                      (student.avg_attendance ?? 0) < 75 ? 'text-red-600' : 'text-slate-500'
                    )}>
                      {student.avg_attendance ?? 0}% att
                    </span>
                    <span className="text-slate-500">{student.avg_total_score ?? 0} avg</span>
                    {student.failing_subjects > 0 && (
                      <span className="text-red-600 font-bold">{student.failing_subjects}F</span>
                    )}
                    <span className="font-bold text-red-600">{Math.round(student.compositeScore)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
