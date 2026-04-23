import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, Eye, ClipboardCheck, MessageSquare, 
  AlertTriangle, Users, GraduationCap, BookOpen, 
  ArrowUpDown, ArrowDown, ArrowUp, UserX, Sparkles, X
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import AppShell from '../../components/layout/AppShell'
import { useCohortSummary } from '../../hooks/mentor/useCohortSummary'
import { Skeleton } from '../../components/ui/Skeleton'
import { cn } from '../../lib/utils'
import CohortChatPanel from '../../components/mentor/CohortChatPanel'
import MenteeLeaderboard from '../../components/mentor/MenteeLeaderboard'
import MessageComposer from '../../components/mentor/MessageComposer'

// Risk Level specific Badge mapping
function RiskBadge({ level }: { level: string | null }) {
  const normalizedLevel = level || 'Low'
  if (normalizedLevel === 'High') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 border border-red-200"><AlertTriangle size={12} /> High Risk</span>
  }
  if (normalizedLevel === 'Medium') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 border border-amber-200">Medium</span>
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">Low</span>
}

type SortField = 'full_name' | 'branch' | 'semester' | 'avg_attendance' | 'avg_total_score' | 'failing_subjects' | 'risk_level'
type SortOrder = 'asc' | 'desc'
const riskWeight: Record<string, number> = { High: 3, Medium: 2, Low: 1 }

export default function MentorDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: cohortData, isLoading } = useCohortSummary(user?.id)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSemesters, setSelectedSemesters] = useState<number[]>([])
  const [activeTab, setActiveTab] = useState<'All' | 'High Risk' | 'Medium Risk' | 'Low Risk'>('All')
  
  const [sortField, setSortField] = useState<SortField>('risk_level')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc') // High risk first

  const [isChatOpen, setIsChatOpen] = useState(false)
  const aiButtonRef = useRef<HTMLButtonElement>(null)

  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [showMessageComposer, setShowMessageComposer] = useState(false)

  // One time pulse animation
  useEffect(() => {
    const btn = aiButtonRef.current
    if (btn) {
      btn.animate([
        { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(79, 70, 229, 0.7)' },
        { transform: 'scale(1.05)', boxShadow: '0 0 0 10px rgba(79, 70, 229, 0)' },
        { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(79, 70, 229, 0)' }
      ], { duration: 1500, easing: 'ease-out', delay: 500 })
    }
  }, [])

  // Unique semesters available in cohort
  const availableSemesters = useMemo(() => {
    if (!cohortData) return []
    const sems = new Set(cohortData.map((s: any) => s.semester))
    return Array.from(sems).sort((a, b) => a - b)
  }, [cohortData])

  const toggleSemester = (sem: number) => {
    setSelectedSemesters(prev => 
      prev.includes(sem) ? prev.filter(s => s !== sem) : [...prev, sem]
    )
  }

  // Handle Sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc') // default to desc on new field
    }
  }

  const RenderSortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={14} className="text-slate-300 group-hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    return sortOrder === 'asc' ? <ArrowUp size={14} className="text-brand-600" /> : <ArrowDown size={14} className="text-brand-600" />
  }

  // Filter and sort Data
  const filteredAndSortedData = useMemo(() => {
    if (!cohortData) return []

    let result = cohortData.filter((student: any) => {
      // 1. Search Query
      if (searchQuery && !student.full_name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      // 2. Semesters
      if (selectedSemesters.length > 0 && !selectedSemesters.includes(student.semester)) return false
      // 3. Tab State
      const risk = student.risk_level || 'Low'
      if (activeTab === 'High Risk' && risk !== 'High') return false
      if (activeTab === 'Medium Risk' && risk !== 'Medium') return false
      if (activeTab === 'Low Risk' && risk !== 'Low') return false
      return true
    })

    // Sort
    result = result.sort((a: any, b: any) => {
      let aVal = a[sortField]
      let bVal = b[sortField]

      if (sortField === 'risk_level') {
        aVal = riskWeight[a.risk_level || 'Low'] || 0
        bVal = riskWeight[b.risk_level || 'Low'] || 0
      }

      if (aVal == null) aVal = aVal === null ? -Infinity : aVal
      if (bVal == null) bVal = bVal === null ? -Infinity : bVal

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [cohortData, searchQuery, selectedSemesters, activeTab, sortField, sortOrder])

  // Select Handlers
  const toggleSelectAll = () => {
    if (selectedStudents.size === filteredAndSortedData.length) {
      setSelectedStudents(new Set())
    } else {
      setSelectedStudents(new Set(filteredAndSortedData.map((s: any) => s.student_id)))
    }
  }

  const toggleSelectStudent = (id: string) => {
    const next = new Set(selectedStudents)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedStudents(next)
  }

  const handleComposeForSelected = () => {
    setShowMessageComposer(true)
  }

  // Aggregated Stats
  const stats = useMemo(() => {
    if (!cohortData || cohortData.length === 0) return { total: 0, highRisk: 0, avgAtt: 0, avgScore: 0 }
    
    const total = cohortData.length
    const highRisk = cohortData.filter((s: any) => s.risk_level === 'High').length
    
    const validAtts = cohortData.filter((s: any) => s.avg_attendance != null)
    const avgAtt = validAtts.length ? validAtts.reduce((sum: number, s: any) => sum + Number(s.avg_attendance), 0) / validAtts.length : 0
    
    const validScores = cohortData.filter((s: any) => s.avg_total_score != null)
    const avgScore = validScores.length ? validScores.reduce((sum: number, s: any) => sum + Number(s.avg_total_score), 0) / validScores.length : 0

    return { total, highRisk, avgAtt: Math.round(avgAtt), avgScore: Math.round(avgScore) }
  }, [cohortData])

  return (
    <AppShell role="mentor">
      <div className="flex flex-col gap-8 max-w-7xl mx-auto w-full pb-10">
        
        {/* Header Section */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Your Cohort</h1>
              <p className="text-sm text-slate-500 mt-1">Manage and track your assigned students</p>
            </div>
            
            <div className="relative w-full sm:w-72">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search size={16} className="text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full rounded-xl border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-brand-500 shadow-sm"
              />
            </div>
          </div>

          {/* Semester Filter Pills */}
          {availableSemesters.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="text-slate-500 font-medium mr-2">Filters:</span>
              {availableSemesters.map(sem => (
                <button
                  key={sem}
                  onClick={() => toggleSemester(sem as number)}
                  className={cn(
                    "px-3 py-1 rounded-full font-medium transition-colors border",
                    selectedSemesters.includes(sem as number) 
                      ? "bg-brand-100 text-brand-700 border-brand-200"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  Sem {sem}
                </button>
              ))}
              {selectedSemesters.length > 0 && (
                <button onClick={() => setSelectedSemesters([])} className="text-xs text-brand-600 hover:text-brand-700 ml-2 font-medium underline-offset-2 hover:underline">
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.0 }} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start">
               <div>
                 <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Students</p>
                 <p className="text-3xl font-bold text-slate-900 mt-2">{isLoading ? '-' : stats.total}</p>
               </div>
               <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users size={20} /></div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start">
               <div>
                 <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">High Risk</p>
                 <div className="flex items-center gap-2 mt-2">
                    <p className="text-3xl font-bold text-slate-900">{isLoading ? '-' : stats.highRisk}</p>
                    {!isLoading && stats.highRisk > 0 && <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle size={10} /> Action Req</span>}
                 </div>
               </div>
               <div className="p-2 bg-red-50 text-red-600 rounded-lg"><UserX size={20} /></div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start">
               <div>
                 <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Attendance</p>
                 <p className="text-3xl font-bold text-slate-900 mt-2">{isLoading ? '-' : `${stats.avgAtt}%`}</p>
               </div>
               <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><BookOpen size={20} /></div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start">
               <div>
                 <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Score</p>
                 <p className="text-3xl font-bold text-slate-900 mt-2">{isLoading ? '-' : stats.avgScore}</p>
               </div>
               <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><GraduationCap size={20} /></div>
            </div>
          </motion.div>
        </div>

        {/* Mentee Leaderboard */}
        <MenteeLeaderboard 
          cohortData={cohortData} 
          isLoading={isLoading}
          onStudentClick={(id) => navigate(`/mentor/student/${id}`)}
        />

        {/* Tab Filters */}
        <div className="flex gap-6 border-b border-slate-200 relative">
          {(['All', 'High Risk', 'Medium Risk', 'Low Risk'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "pb-3 text-sm font-semibold transition-colors relative",
                activeTab === tab ? "text-brand-600" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {tab}
              {activeTab === tab && (
                <motion.div
                  layoutId="activeTabUnderline"
                  className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-brand-600"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Cohort Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
           <div className="overflow-x-auto">
             <table className="w-full text-left text-sm whitespace-nowrap">
               <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500 tracking-wider">
                 <tr>
                   <th className="px-6 py-4 w-12">
                     <input 
                       type="checkbox" 
                       className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                       checked={filteredAndSortedData.length > 0 && selectedStudents.size === filteredAndSortedData.length}
                       onChange={toggleSelectAll}
                     />
                   </th>
                   <th className="px-6 py-4 cursor-pointer group hover:bg-slate-100 transition" onClick={() => handleSort('full_name')}>
                     <div className="flex items-center gap-2">Name <RenderSortIcon field="full_name" /></div>
                   </th>
                   <th className="px-6 py-4 cursor-pointer group hover:bg-slate-100 transition hidden sm:table-cell" onClick={() => handleSort('branch')}>
                     <div className="flex items-center gap-2">Branch & Sem <RenderSortIcon field="branch" /></div>
                   </th>
                   <th className="px-6 py-4 cursor-pointer group hover:bg-slate-100 transition" onClick={() => handleSort('avg_attendance')}>
                     <div className="flex items-center gap-2">Attendance <RenderSortIcon field="avg_attendance" /></div>
                   </th>
                   <th className="px-6 py-4 cursor-pointer group hover:bg-slate-100 transition hidden md:table-cell" onClick={() => handleSort('avg_total_score')}>
                     <div className="flex items-center gap-2">Avg Score <RenderSortIcon field="avg_total_score" /></div>
                   </th>
                   <th className="px-6 py-4 cursor-pointer group hover:bg-slate-100 transition" onClick={() => handleSort('failing_subjects')}>
                     <div className="flex items-center gap-2">Failing <RenderSortIcon field="failing_subjects" /></div>
                   </th>
                   <th className="px-6 py-4 cursor-pointer group hover:bg-slate-100 transition" onClick={() => handleSort('risk_level')}>
                     <div className="flex items-center gap-2">Risk Level <RenderSortIcon field="risk_level" /></div>
                   </th>
                   <th className="px-6 py-4 text-right">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {isLoading ? (
                   Array.from({ length: 5 }).map((_, i) => (
                     <tr key={i}>
                       <td className="px-6 py-4"><Skeleton className="h-5 w-32 rounded" /></td>
                       <td className="px-6 py-4 hidden sm:table-cell"><Skeleton className="h-5 w-24 rounded" /></td>
                       <td className="px-6 py-4"><Skeleton className="h-5 w-16 rounded" /></td>
                       <td className="px-6 py-4 hidden md:table-cell"><Skeleton className="h-5 w-12 rounded" /></td>
                       <td className="px-6 py-4"><Skeleton className="h-5 w-10 rounded" /></td>
                       <td className="px-6 py-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
                       <td className="px-6 py-4"><div className="flex justify-end gap-2"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-8 w-8 rounded-full" /></div></td>
                     </tr>
                   ))
                 ) : filteredAndSortedData.length === 0 ? (
                   <tr>
                     <td colSpan={7} className="px-6 py-10 text-center">
                        <Users size={32} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-slate-600 font-medium">No students match your filters</p>
                        <p className="text-sm text-slate-400 mt-1">Try clearing your search or semester filters.</p>
                     </td>
                   </tr>
                 ) : (
                   <AnimatePresence>
                     {filteredAndSortedData.map((student: any) => (
                       <motion.tr 
                          key={student.student_id}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => navigate(`/mentor/student/${student.student_id}`)}
                          className="hover:bg-brand-50/30 cursor-pointer transition-colors group"
                       >
                          <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                              checked={selectedStudents.has(student.student_id)}
                              onChange={() => toggleSelectStudent(student.student_id)}
                            />
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-900 group-hover:text-brand-700 transition">
                            {student.full_name}
                          </td>
                          <td className="px-6 py-4 hidden sm:table-cell">
                             <div className="flex flex-col">
                                <span className="font-medium text-slate-700">{student.branch}</span>
                                <span className="text-xs text-slate-500 mt-0.5">Semester {student.semester}</span>
                             </div>
                          </td>
                          <td className="px-6 py-4">
                             <span className={cn("font-semibold", 
                               (student.avg_attendance ?? 100) < 75 ? "text-amber-600" : "text-slate-700"
                             )}>
                                {student.avg_attendance ?? '-'}%
                             </span>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-700 hidden md:table-cell">
                             {student.avg_total_score ?? '-'}
                          </td>
                          <td className="px-6 py-4 font-bold">
                             <span className={student.failing_subjects > 0 ? "text-red-500 bg-red-50 px-2 py-0.5 rounded" : "text-slate-400"}>
                               {student.failing_subjects}
                             </span>
                          </td>
                          <td className="px-6 py-4">
                             <RiskBadge level={student.risk_level} />
                          </td>
                          <td className="px-6 py-4">
                             <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                               <button 
                                 onClick={() => navigate(`/mentor/student/${student.student_id}`)}
                                 className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition"
                                 title="View Details"
                               >
                                 <Eye size={18} />
                               </button>
                               <button 
                                 onClick={() => navigate(`/mentor/attendance?student=${student.student_id}`)}
                                 className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                 title="Log Attendance"
                               >
                                 <ClipboardCheck size={18} />
                               </button>
                               <button 
                                 onClick={() => {
                                   setSelectedStudents(new Set([student.student_id]))
                                   setShowMessageComposer(true)
                                 }}
                                 className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition"
                                 title="Message"
                               >
                                 <MessageSquare size={18} />
                               </button>
                             </div>
                          </td>
                       </motion.tr>
                     ))}
                   </AnimatePresence>
                 )}
               </tbody>
             </table>
           </div>
        </div>
      </div>

      {/* Floating Ask AI Button */}
      <button
        ref={aiButtonRef}
        onClick={() => setIsChatOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-3 rounded-full shadow-lg shadow-brand-500/20 text-white font-semibold tracking-wide transition-all",
          "bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 hover:scale-105 active:scale-95 border border-brand-500/50"
        )}
      >
        <span className="text-brand-200">✦</span> Ask AI
      </button>

      {/* Floating Bulk Action Bar */}
      <AnimatePresence>
        {selectedStudents.size > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 border border-slate-700 font-sans"
          >
            <div className="flex items-center gap-3 font-semibold text-sm">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs">
                {selectedStudents.size}
              </span> 
              students selected
            </div>
            <div className="h-6 w-px bg-slate-700"></div>
            <div className="flex items-center gap-3">
               <button onClick={handleComposeForSelected} className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-bold shadow-sm transition">
                  <Sparkles size={16}/> Compose AI Message
               </button>
               <button onClick={() => setSelectedStudents(new Set())} className="px-3 py-2 text-slate-400 hover:text-white transition flex items-center gap-2 text-sm font-medium">
                  <X size={16}/> Clear selection
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Integrated Chat Panel */}
      <CohortChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      
      {/* Integrated Message Composer Payload Contexts dynamically generated */}
      {filteredAndSortedData && (
        <MessageComposer 
          isOpen={showMessageComposer}
          onClose={() => setShowMessageComposer(false)}
          initialRecipients={Array.from(selectedStudents).map(id => {
            const s = (filteredAndSortedData as any[]).find((r: any) => r.student_id === id)
            return { id: id, name: s?.full_name || 'Unknown' }
          })}
        />
      )}
    </AppShell>
  )
}
