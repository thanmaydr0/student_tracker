import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ClipboardList, CheckCircle2, Clock, TrendingUp, TrendingDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import { Skeleton } from '../ui/Skeleton'

interface IATRow {
  subject_name: string
  iat1_marks: number | null
  iat2_marks: number | null
  max_marks: number
}

function useStudentIATMarks(userId: string | undefined) {
  return useQuery({
    queryKey: ['student-iat-marks', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID required')

      // 1. Get enrollments
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('class_id')
        .eq('student_id', userId)

      if (!enrollments || enrollments.length === 0) return []

      const classIds = enrollments.map(e => e.class_id)

      // 2. Get class -> subject mapping
      const { data: classes } = await supabase
        .from('classes')
        .select('id, subject_id')
        .in('id', classIds)

      const subjectIds = [...new Set((classes || []).map(c => c.subject_id))]
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds)

      const subjectMap = new Map((subjects || []).map(s => [s.id, s.name]))
      const classSubjectMap = new Map((classes || []).map(c => [c.id, subjectMap.get(c.subject_id) || 'Unknown']))

      // 3. Get IAT marks
      const { data: iatMarks } = await supabase
        .from('iat_marks')
        .select('class_id, iat_number, marks_obtained, max_marks')
        .eq('student_id', userId)

      // 4. Deduplicate class IDs per subject (in case of multiple classes for same subject)
      const classToSubjectId = new Map((classes || []).map(c => [c.id, c.subject_id]))
      const seenSubjects = new Set<string>()
      const uniqueClassIds = classIds.filter(cid => {
        const subjectId = classToSubjectId.get(cid)
        if (!subjectId || seenSubjects.has(subjectId)) return false
        seenSubjects.add(subjectId)
        return true
      })

      // 5. Build IAT marks map
      const iatMap = new Map<string, { iat1: number | null, iat2: number | null, max: number }>()
      uniqueClassIds.forEach(cid => {
        iatMap.set(cid, { iat1: null, iat2: null, max: 50 })
      })
      ;(iatMarks || []).forEach(m => {
        const entry = iatMap.get(m.class_id)
        if (entry) {
          if (m.iat_number === 1) entry.iat1 = Number(m.marks_obtained)
          if (m.iat_number === 2) entry.iat2 = Number(m.marks_obtained)
          entry.max = Number(m.max_marks)
        }
      })

      const rows: IATRow[] = uniqueClassIds.map(cid => ({
        subject_name: classSubjectMap.get(cid) || 'Unknown',
        iat1_marks: iatMap.get(cid)?.iat1 ?? null,
        iat2_marks: iatMap.get(cid)?.iat2 ?? null,
        max_marks: iatMap.get(cid)?.max ?? 50,
      }))

      return rows
    },
    enabled: !!userId,
  })
}

function MarkBadge({ marks, max }: { marks: number | null, max: number }) {
  if (marks === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
        <Clock size={12} />
        Pending
      </span>
    )
  }
  const pct = (marks / max) * 100
  const color = pct >= 70 ? 'bg-green-100 text-green-700' :
                pct >= 50 ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold', color)}>
      {marks}/{max}
    </span>
  )
}

function ScoreBar({ value, max }: { value: number | null, max: number }) {
  if (value === null) return <div className="h-1.5 w-full rounded-full bg-slate-100" />
  const pct = Math.min(100, (value / max) * 100)
  const color = pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={cn('h-full rounded-full', color)}
      />
    </div>
  )
}

export default function IATMarksCard({ userId }: { userId: string | undefined }) {
  const { data, isLoading } = useStudentIATMarks(userId)

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-3 w-52 rounded" />
          </div>
        </div>
        <div className="p-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) return null

  // Calculate improvement/decline between IAT1 and IAT2
  const bothAvailable = data.filter(d => d.iat1_marks !== null && d.iat2_marks !== null)
  const avgChange = bothAvailable.length > 0
    ? bothAvailable.reduce((sum, d) => sum + (d.iat2_marks! - d.iat1_marks!), 0) / bothAvailable.length
    : null

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600 shadow-sm">
          <ClipboardList size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-slate-800 tracking-tight">IAT Marks</h2>
          <p className="text-xs text-slate-500 font-medium">Internal Assessment Test scores (read-only)</p>
        </div>
        {avgChange !== null && (
          <div className={cn(
            'flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold',
            avgChange >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          )}>
            {avgChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(1)} avg
          </div>
        )}
      </div>

      <div className="p-5">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 font-semibold">Subject</th>
                <th className="px-4 py-3 font-semibold text-center">IAT 1</th>
                <th className="px-4 py-3 font-semibold text-center">IAT 2</th>
                <th className="px-4 py-3 font-semibold text-center">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 bg-white">
              {data.map((row, idx) => {
                const trend = row.iat1_marks !== null && row.iat2_marks !== null
                  ? row.iat2_marks - row.iat1_marks
                  : null
                return (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3.5 font-medium text-slate-800">{row.subject_name}</td>
                    <td className="px-4 py-3.5 text-center">
                      <MarkBadge marks={row.iat1_marks} max={row.max_marks} />
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <MarkBadge marks={row.iat2_marks} max={row.max_marks} />
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {trend !== null ? (
                        <span className={cn(
                          'inline-flex items-center gap-1 text-xs font-bold',
                          trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-slate-400'
                        )}>
                          {trend > 0 ? <TrendingUp size={14} /> : trend < 0 ? <TrendingDown size={14} /> : null}
                          {trend > 0 ? '+' : ''}{trend}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="flex flex-col gap-3 md:hidden">
          {data.map((row, idx) => (
            <div key={idx} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <h4 className="font-semibold text-slate-800 mb-3">{row.subject_name}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-slate-400 font-medium">IAT 1</span>
                  <div className="mt-1"><MarkBadge marks={row.iat1_marks} max={row.max_marks} /></div>
                  <div className="mt-1.5"><ScoreBar value={row.iat1_marks} max={row.max_marks} /></div>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium">IAT 2</span>
                  <div className="mt-1"><MarkBadge marks={row.iat2_marks} max={row.max_marks} /></div>
                  <div className="mt-1.5"><ScoreBar value={row.iat2_marks} max={row.max_marks} /></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
