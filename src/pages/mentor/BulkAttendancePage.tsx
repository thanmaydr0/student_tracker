import React, { useState, useEffect, useMemo, KeyboardEvent, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Users, Calendar, Check, X, ClipboardCheck, 
  AlertTriangle, ArrowLeft, Loader2, Info
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import AppShell from '../../components/layout/AppShell'
import { supabase } from '../../lib/supabase'
import { useAttendanceLog } from '../../hooks/mentor/useAttendanceLog'
import { useSubmitAttendance } from '../../hooks/mentor/useSubmitAttendance'
import { Skeleton } from '../../components/ui/Skeleton'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'

interface MentorClass {
  id: string
  semester: number
  subjects: { name: string; code: string }
}

type AttendanceStatus = 'Present' | 'Absent' | 'Excused'

export default function BulkAttendancePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  
  // Step 1 State
  const [classes, setClasses] = useState<MentorClass[]>([])
  const [isLoadingClasses, setIsLoadingClasses] = useState(true)
  
  const [formClassId, setFormClassId] = useState<string>('')
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0])
  
  const [activeQuery, setActiveQuery] = useState<{classId: string, date: string} | null>(null)

  // Step 2 State
  const { data: attendanceData, isLoading: isLoadingAttendance } = useAttendanceLog(activeQuery?.classId, activeQuery?.date)
  const submitMutation = useSubmitAttendance()
  
  const [localAttendance, setLocalAttendance] = useState<Record<string, AttendanceStatus>>({})
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(0)
  
  // Refs for keyboard navigation
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([])

  // Fetch Mentor Classes
  useEffect(() => {
    async function loadClasses() {
      if (!user) return
      setIsLoadingClasses(true)
      const { data, error } = await supabase
        .from('classes')
        .select(`
          id,
          semester,
          subjects ( name, code )
        `)
        .eq('mentor_id', user.id)
        
      if (!error && data) {
        setClasses(data as unknown as MentorClass[])
        // Auto-select first class
        if (data.length > 0) setFormClassId(data[0].id)
      }
      setIsLoadingClasses(false)
    }
    loadClasses()

    // Read query params for pre-selecting class/date (e.g. from Dashboard)
    const params = new URLSearchParams(window.location.search)
    const stdId = params.get('student')
    // We could do something with pre-selected student, but this is bulk page.
    // If they came with a specific class? Not passed yet, but good for future.
  }, [user])

  // Sync loaded attendance to local state
  useEffect(() => {
    if (attendanceData) {
      const newState: Record<string, AttendanceStatus> = {}
      attendanceData.forEach(student => {
        // Default to Present if newly logging, else use existing
        newState[student.student_id] = student.status || 'Present'
      })
      setLocalAttendance(newState)
      setFocusedRowIndex(0)
    }
  }, [attendanceData])

  // Derive warning and stats
  const hasExistingRecords = useMemo(() => {
    if (!attendanceData) return false
    return attendanceData.some(d => d.status !== null)
  }, [attendanceData])

  const stats = useMemo(() => {
    let present = 0, absent = 0, excused = 0
    Object.values(localAttendance).forEach(status => {
      if (status === 'Present') present++
      else if (status === 'Absent') absent++
      else if (status === 'Excused') excused++
    })
    return { present, absent, excused, total: Object.keys(localAttendance).length }
  }, [localAttendance])

  // Handlers
  const handleLoadStudents = () => {
    if (!formClassId || !formDate) {
      toast.error('Please select a class and date.')
      return
    }
    setActiveQuery({ classId: formClassId, date: formDate })
  }

  const setAllStatus = (status: AttendanceStatus) => {
    if (!attendanceData) return
    const newState: Record<string, AttendanceStatus> = {}
    attendanceData.forEach(s => newState[s.student_id] = status)
    setLocalAttendance(newState)
  }

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setLocalAttendance(prev => ({ ...prev, [studentId]: status }))
  }

  const handleSubmit = async () => {
    if (!activeQuery || !attendanceData) return
    
    const payload = attendanceData.map(student => ({
      student_id: student.student_id,
      class_id: activeQuery.classId,
      date: activeQuery.date,
      status: localAttendance[student.student_id]
    }))

    try {
      await submitMutation.mutateAsync(payload)
      // On success, reset grid or show message managed by the hook toast
      // We can drop the active query to return to selection step, but better to just let them see it saved.
      setActiveQuery(null) // return to selection
    } catch(err) {
      // toast managed by mutation
    }
  }

  // Keyboard Shortcuts Handler
  useEffect(() => {
    if (!activeQuery || !attendanceData || attendanceData.length === 0) return

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch(e.key.toLowerCase()) {
        case 'arrowdown':
          e.preventDefault()
          setFocusedRowIndex(prev => Math.min(prev + 1, attendanceData.length - 1))
          break
        case 'arrowup':
          e.preventDefault()
          setFocusedRowIndex(prev => Math.max(prev - 1, 0))
          break
        case 'p':
          // Set focused row to present and move down
          handleStatusChange(attendanceData[focusedRowIndex].student_id, 'Present')
          setFocusedRowIndex(prev => Math.min(prev + 1, attendanceData.length - 1))
          break
        case 'a':
          handleStatusChange(attendanceData[focusedRowIndex].student_id, 'Absent')
          setFocusedRowIndex(prev => Math.min(prev + 1, attendanceData.length - 1))
          break
        case 'e':
          handleStatusChange(attendanceData[focusedRowIndex].student_id, 'Excused')
          setFocusedRowIndex(prev => Math.min(prev + 1, attendanceData.length - 1))
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeQuery, attendanceData, focusedRowIndex])

  // Scroll active row into view
  useEffect(() => {
    if (rowRefs.current[focusedRowIndex]) {
      rowRefs.current[focusedRowIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [focusedRowIndex])

  // Max selectable date (today)
  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <AppShell role="mentor">
      <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-10">
        
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="text-brand-600" /> Bulk Attendance
          </h1>
          <p className="text-sm text-slate-500 mt-1">Quickly log and revise attendance sheets for your assigned classes.</p>
        </div>

        {/* Step 1: Configuration */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
             <div className="w-full sm:w-1/2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Select Class</label>
                {isLoadingClasses ? (
                  <Skeleton className="h-10 w-full rounded-xl" />
                ) : (
                  <select 
                    value={formClassId} 
                    onChange={(e) => setFormClassId(e.target.value)}
                    disabled={!!activeQuery} // Disable if query is active
                    className="w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 text-sm focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60"
                  >
                    <option value="" disabled>Select a subject...</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.subjects?.name} ({c.subjects?.code}) — Semester {c.semester}
                      </option>
                    ))}
                  </select>
                )}
             </div>
             
             <div className="w-full sm:w-1/3">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date</label>
                <input 
                  type="date"
                  max={todayStr}
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  disabled={!!activeQuery}
                  className="w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 text-sm focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60"
                />
             </div>

             <div className="w-full sm:w-auto">
               {activeQuery ? (
                 <button 
                   onClick={() => setActiveQuery(null)}
                   className="w-full py-2.5 px-6 rounded-xl font-semibold border-2 border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                 >
                   Change Selection
                 </button>
               ) : (
                 <button 
                   onClick={handleLoadStudents}
                   disabled={!formClassId || !formDate || isLoadingClasses}
                   className="w-full py-2.5 px-6 rounded-xl font-semibold bg-brand-600 text-white hover:bg-brand-700 transition disabled:opacity-50"
                 >
                   Load Students
                 </button>
               )}
             </div>
          </div>
        </div>

        {/* Step 2: Grid */}
        {activeQuery && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4"
          >
            {hasExistingRecords && (
               <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                 <AlertTriangle size={20} className="text-amber-500 mt-0.5 shrink-0" />
                 <div>
                   <h3 className="font-semibold text-amber-800">Attendance Already Logged</h3>
                   <p className="text-sm text-amber-700 mt-0.5">Records for this class and date already exist. Submitting will overwrite them.</p>
                 </div>
               </div>
            )}

            {/* Bulk Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 rounded-xl p-3 border border-slate-200">
               <div className="flex bg-white rounded-lg border border-slate-200 p-1 shadow-sm w-full sm:w-auto overflow-x-auto">
                  <button onClick={() => setAllStatus('Present')} className="px-4 py-1.5 text-sm font-semibold rounded-md hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition">Mark All Present</button>
                  <button onClick={() => setAllStatus('Absent')} className="px-4 py-1.5 text-sm font-semibold rounded-md hover:bg-red-50 text-slate-600 hover:text-red-700 transition">Mark All Absent</button>
                  <button onClick={() => setAllStatus('Excused')} className="px-4 py-1.5 text-sm font-semibold rounded-md hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition">Mark All Excused</button>
               </div>
               
               <div className="flex items-center gap-4 text-sm font-medium pr-2">
                 <span className="text-emerald-600">{stats.present} P</span>
                 <span className="text-slate-300">|</span>
                 <span className="text-red-500">{stats.absent} A</span>
                 <span className="text-slate-300">|</span>
                 <span className="text-blue-500">{stats.excused} E</span>
                 <span className="text-slate-300">|</span>
                 <span className="text-slate-500">{stats.total} Total</span>
               </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-slate-500 w-12 text-center">#</th>
                    <th className="px-6 py-4 font-semibold text-slate-500">Student Profile</th>
                    <th className="px-6 py-4 font-semibold text-slate-500 text-center w-64">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingAttendance ? (
                    Array.from({length: 5}).map((_,i) => (
                      <tr key={i}>
                        <td className="px-6 py-4"><Skeleton className="h-6 w-6 rounded" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-6 w-48 rounded" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-8 w-full rounded" /></td>
                      </tr>
                    ))
                  ) : attendanceData?.length === 0 ? (
                    <tr><td colSpan={3} className="px-6 py-10 text-center text-slate-500 font-medium">No students enrolled in this class.</td></tr>
                  ) : (
                    attendanceData?.map((student, idx) => {
                      const isFocused = focusedRowIndex === idx
                      const currentStatus = localAttendance[student.student_id]

                      return (
                        <tr 
                          key={student.student_id} 
                          ref={(el) => (rowRefs.current[idx] = el)}
                          onClick={() => setFocusedRowIndex(idx)}
                          className={cn(
                            "transition-colors cursor-pointer",
                            isFocused ? "bg-brand-50" : "hover:bg-slate-50"
                          )}
                        >
                           <td className="px-6 py-4 text-center font-medium text-slate-400">
                             {isFocused && <motion.div layoutId="focusIndicator" className="w-1.5 h-6 bg-brand-500 rounded-r-md absolute left-0" />}
                             {idx + 1}
                           </td>
                           <td className="px-6 py-4">
                             <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0">
                                 {student.full_name?.charAt(0)}
                               </div>
                               <span className="font-semibold text-slate-800">{student.full_name}</span>
                             </div>
                           </td>
                           <td className="px-6 py-4">
                             <div className="flex p-1 bg-slate-100 rounded-lg w-full max-w-[200px] mx-auto gap-1">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleStatusChange(student.student_id, 'Present') }}
                                  className={cn(
                                    "flex-1 py-1 rounded-md font-bold text-xs transition",
                                    currentStatus === 'Present' ? "bg-white text-emerald-600 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"
                                  )}
                                >
                                  P
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleStatusChange(student.student_id, 'Absent') }}
                                  className={cn(
                                    "flex-1 py-1 text-center rounded-md font-bold text-xs transition",
                                    currentStatus === 'Absent' ? "bg-white text-red-600 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"
                                  )}
                                >
                                  A
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleStatusChange(student.student_id, 'Excused') }}
                                  className={cn(
                                    "flex-1 py-1 text-center rounded-md font-bold text-xs transition",
                                    currentStatus === 'Excused' ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"
                                  )}
                                >
                                  E
                                </button>
                             </div>
                           </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Submit Action */}
            {attendanceData && attendanceData.length > 0 && (
              <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4 mt-2">
                 <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1"><Info size={14}/> Shortcuts:</span>
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono">↑</span>
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono">↓</span>
                    <span>Navigate</span>
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono text-emerald-600">P</span>
                    <span>Present</span>
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono text-red-600">A</span>
                    <span>Absent</span>
                 </div>
                 
                 <button 
                   onClick={handleSubmit}
                   disabled={submitMutation.isPending}
                   className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold bg-brand-600 text-white hover:bg-brand-700 shadow flex items-center justify-center gap-2 transition disabled:opacity-70"
                 >
                   {submitMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <ClipboardCheck size={18} />}
                   Submit Attendance
                 </button>
              </div>
            )}
          </motion.div>
        )}

      </div>
    </AppShell>
  )
}
