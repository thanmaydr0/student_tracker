import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ClipboardEdit, Save, Loader2, CheckCircle2, Users, BookOpen, ChevronDown } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import AppShell from '../../components/layout/AppShell'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'

interface StudentIAT {
  student_id: string
  full_name: string
  class_id: string
  subject_name: string
  iat1_marks: number | null
  iat2_marks: number | null
  iat1_id: string | null
  iat2_id: string | null
}

export default function IATMarksPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<StudentIAT[]>([])
  const [editedCells, setEditedCells] = useState<Map<string, number | null>>(new Map())
  const [selectedIAT, setSelectedIAT] = useState<1 | 2>(1)
  const [selectedClass, setSelectedClass] = useState<string>('all')

  // Fetch all data
  useEffect(() => {
    if (!user?.id) return
    fetchData()
  }, [user?.id])

  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. Get mentor's assigned students
      const { data: students, error: sErr } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('mentor_id', user!.id)
        .eq('role', 'student')

      if (sErr) throw sErr
      if (!students || students.length === 0) {
        setData([])
        setLoading(false)
        return
      }

      const studentIds = students.map(s => s.id)

      // 2. Get enrollments for these students
      const { data: enrollments, error: eErr } = await supabase
        .from('enrollments')
        .select('student_id, class_id')
        .in('student_id', studentIds)

      if (eErr) throw eErr

      // 3. Get class -> subject mapping
      const classIds = [...new Set((enrollments || []).map(e => e.class_id))]
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

      // 4. Get existing IAT marks
      const { data: iatMarks } = await supabase
        .from('iat_marks')
        .select('id, student_id, class_id, iat_number, marks_obtained')
        .in('student_id', studentIds)

      const iatMap = new Map<string, { id: string, marks: number }>()
      ;(iatMarks || []).forEach(m => {
        iatMap.set(`${m.student_id}-${m.class_id}-${m.iat_number}`, { id: m.id, marks: Number(m.marks_obtained) })
      })

      // 5. Build combined data — deduplicate enrollments by student+subject
      const studentMap = new Map(students.map(s => [s.id, s.full_name]))

      // Build a reverse map: for each class_id, what subject_id does it map to?
      const classToSubjectId = new Map((classes || []).map(c => [c.id, c.subject_id]))

      // Deduplicate: keep only one enrollment per student+subject
      const seen = new Set<string>()
      const uniqueEnrollments = (enrollments || []).filter(e => {
        const subjectId = classToSubjectId.get(e.class_id)
        const dedupeKey = `${e.student_id}::${subjectId}`
        if (seen.has(dedupeKey)) return false
        seen.add(dedupeKey)
        return true
      })

      const rows: StudentIAT[] = uniqueEnrollments.map(e => {
        const iat1 = iatMap.get(`${e.student_id}-${e.class_id}-1`)
        const iat2 = iatMap.get(`${e.student_id}-${e.class_id}-2`)
        return {
          student_id: e.student_id,
          full_name: studentMap.get(e.student_id) || 'Unknown',
          class_id: e.class_id,
          subject_name: classSubjectMap.get(e.class_id) || 'Unknown',
          iat1_marks: iat1?.marks ?? null,
          iat2_marks: iat2?.marks ?? null,
          iat1_id: iat1?.id ?? null,
          iat2_id: iat2?.id ?? null,
        }
      })

      setData(rows.sort((a, b) => a.full_name.localeCompare(b.full_name)))
    } catch (err: any) {
      console.error('Failed to load IAT data:', err)
      toast.error('Failed to load IAT data')
    }
    setLoading(false)
  }

  // Get unique subjects for filter
  const availableClasses = useMemo(() => {
    const map = new Map<string, string>()
    data.forEach(d => map.set(d.class_id, d.subject_name))
    return Array.from(map.entries())
  }, [data])

  // Filter data
  const filteredData = useMemo(() => {
    if (selectedClass === 'all') return data
    return data.filter(d => d.class_id === selectedClass)
  }, [data, selectedClass])

  // Group by student
  const groupedByStudent = useMemo(() => {
    const groups = new Map<string, StudentIAT[]>()
    filteredData.forEach(d => {
      const existing = groups.get(d.student_id) || []
      existing.push(d)
      groups.set(d.student_id, existing)
    })
    return Array.from(groups.entries())
  }, [filteredData])

  const handleMarkChange = (studentId: string, classId: string, iatNum: 1 | 2, value: string) => {
    const key = `${studentId}-${classId}-${iatNum}`
    if (value === '') {
      setEditedCells(prev => { const n = new Map(prev); n.set(key, null); return n })
      return
    }
    const num = parseFloat(value)
    if (!isNaN(num) && num >= 0 && num <= 50) {
      setEditedCells(prev => { const n = new Map(prev); n.set(key, num); return n })
    }
  }

  const getDisplayValue = (row: StudentIAT, iatNum: 1 | 2): string => {
    const key = `${row.student_id}-${row.class_id}-${iatNum}`
    if (editedCells.has(key)) {
      const val = editedCells.get(key)
      return val !== null && val !== undefined ? String(val) : ''
    }
    const existing = iatNum === 1 ? row.iat1_marks : row.iat2_marks
    return existing !== null && existing !== undefined ? String(existing) : ''
  }

  const hasChanges = editedCells.size > 0

  const handleSave = async () => {
    if (!hasChanges) return
    setSaving(true)

    try {
      const upserts: any[] = []
      editedCells.forEach((value, key) => {
        const [studentId, classId, iatNumStr] = key.split('-')
        // key is "uuid-uuid-1" but UUIDs have dashes, so we need a better split
        // Actually the key format is `${studentId}-${classId}-${iatNum}` where studentId and classId are UUIDs
        // Let's use a different approach
      })

      // Better: iterate with proper data
      const operations: Promise<any>[] = []
      for (const [key, value] of editedCells.entries()) {
        // Parse key: last char is iat number, rest is studentId-classId
        const lastDash = key.lastIndexOf('-')
        const iatNum = parseInt(key.substring(lastDash + 1))
        const rest = key.substring(0, lastDash)
        const secondLastDash = rest.lastIndexOf('-')
        // Actually UUIDs have dashes, so this won't work with simple split
        // Let's find the row in data instead
        const row = data.find(d => {
          const k = `${d.student_id}-${d.class_id}-${iatNum}`
          return k === key
        })
        if (!row) continue

        if (value === null) continue // Skip nulls (would need DELETE which we don't support)

        operations.push(
          supabase.from('iat_marks').upsert({
            student_id: row.student_id,
            class_id: row.class_id,
            iat_number: iatNum,
            marks_obtained: value,
            max_marks: 50,
          }, { onConflict: 'student_id,class_id,iat_number' })
        )
      }

      const results = await Promise.all(operations)
      const errors = results.filter(r => r.error)
      if (errors.length > 0) {
        console.error('Some saves failed:', errors)
        toast.error(`${errors.length} mark(s) failed to save`)
      } else {
        toast.success('Marks saved successfully!')
        setEditedCells(new Map())
        await fetchData() // Refresh
      }
    } catch (err: any) {
      toast.error('Failed to save marks')
      console.error(err)
    }
    setSaving(false)
  }

  return (
    <AppShell role="mentor">
      <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full pb-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600 shadow-sm">
                <ClipboardEdit size={20} />
              </div>
              IAT Marks Entry
            </h1>
            <p className="text-sm text-slate-500 mt-1">Enter Internal Assessment Test marks for your mentees</p>
          </div>

          <div className="flex items-center gap-3">
            {/* IAT Toggle */}
            <div className="flex rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <button
                onClick={() => setSelectedIAT(1)}
                className={cn(
                  'px-4 py-2 text-sm font-semibold transition-colors',
                  selectedIAT === 1 ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                IAT 1
              </button>
              <button
                onClick={() => setSelectedIAT(2)}
                className={cn(
                  'px-4 py-2 text-sm font-semibold transition-colors',
                  selectedIAT === 2 ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                IAT 2
              </button>
            </div>

            {/* Subject Filter */}
            <div className="relative">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-9 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              >
                <option value="all">All Subjects</option>
                {availableClasses.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <AnimatePresence>
          {hasChanges && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-between rounded-xl bg-purple-50 border border-purple-200 px-5 py-3"
            >
              <p className="text-sm font-medium text-purple-800">
                {editedCells.size} unsaved change{editedCells.size > 1 ? 's' : ''}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditedCells(new Map())}
                  className="px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-500 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {saving ? 'Saving...' : 'Save All'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-purple-500" />
            </div>
          ) : groupedByStudent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Users size={40} className="mb-3 opacity-50" />
              <p className="text-sm font-medium">No students assigned to you</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500 tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Subject</th>
                    <th className="px-6 py-4 text-center w-32">
                      IAT {selectedIAT} Marks (/50)
                    </th>
                    <th className="px-6 py-4 text-center w-24">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedByStudent.map(([studentId, subjects]) => {
                    const studentName = subjects[0]?.full_name || 'Unknown'
                    return (
                      <tr key={studentId}>
                        <td colSpan={3} className="p-0">
                          {/* Student Header */}
                          <div className="flex items-center gap-3 px-6 py-3 bg-slate-50/80 border-t border-b border-slate-100">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-700 text-xs font-bold shrink-0">
                              {studentName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-bold text-slate-800">{studentName}</span>
                            <span className="text-xs font-medium text-slate-400">{subjects.length} subject{subjects.length !== 1 ? 's' : ''}</span>
                          </div>
                          {/* Subject rows */}
                          <table className="w-full">
                            <tbody className="divide-y divide-slate-50">
                              {subjects.map((row) => {
                                const key = `${row.student_id}-${row.class_id}-${selectedIAT}`
                                const currentValue = getDisplayValue(row, selectedIAT)
                                const isEdited = editedCells.has(key)
                                const existingMark = selectedIAT === 1 ? row.iat1_marks : row.iat2_marks

                                return (
                                  <tr key={`${row.student_id}-${row.class_id}`} className="hover:bg-purple-50/30 transition-colors">
                                    <td className="px-6 py-3.5 pl-[4.25rem]">
                                      <div className="flex items-center gap-2">
                                        <BookOpen size={14} className="text-slate-400" />
                                        <span className="font-medium text-slate-700">{row.subject_name}</span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-3.5 w-32">
                                      <div className="flex justify-center">
                                        <input
                                          type="number"
                                          min={0}
                                          max={50}
                                          step={0.5}
                                          value={currentValue}
                                          onChange={(e) => handleMarkChange(row.student_id, row.class_id, selectedIAT, e.target.value)}
                                          placeholder="—"
                                          className={cn(
                                            'w-20 rounded-lg border px-3 py-1.5 text-center text-sm font-medium transition-all focus:ring-2 focus:ring-purple-500 focus:border-purple-500',
                                            isEdited ? 'border-purple-400 bg-purple-50' : 'border-slate-200 bg-white'
                                          )}
                                        />
                                      </div>
                                    </td>
                                    <td className="px-6 py-3.5 w-24 text-center">
                                      {existingMark !== null ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                                          <CheckCircle2 size={12} /> Entered
                                        </span>
                                      ) : (
                                        <span className="text-xs font-medium text-slate-400">Pending</span>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
