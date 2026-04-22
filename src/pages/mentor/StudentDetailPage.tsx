import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, Plus, Calendar, Edit2, Check, X, 
  MessageSquare, UserPlus, FileText, AlertTriangle 
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import AppShell from '../../components/layout/AppShell'
import { useStudentDetail } from '../../hooks/mentor/useStudentDetail'
import { useUpdateGrades } from '../../hooks/mentor/useUpdateGrades'
import { useInterventions } from '../../hooks/mentor/useInterventions'
import { useAddIntervention } from '../../hooks/mentor/useAddIntervention'
import { usePrediction } from '../../hooks/student/usePrediction'
import ProfileCard from '../../components/student/ProfileCard'
import AttendanceChart from '../../components/student/AttendanceChart'
import PredictionWidget from '../../components/student/PredictionWidget'
import ReportGenerator from '../../components/mentor/ReportGenerator'
import MessageComposer from '../../components/mentor/MessageComposer'
import { Skeleton } from '../../components/ui/Skeleton'
import { cn } from '../../lib/utils'
import type { GradeSummary } from '../../types/app.types'
import toast from 'react-hot-toast'

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}
const itemVariants: any = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  // Queries
  const { data: detailData, isLoading: detailLoading, isError: detailError } = useStudentDetail(id)
  const { profile, attendance, grades } = detailData || { profile: null, attendance: [], grades: [] }
  
  const { data: predictionData, isLoading: predictionLoading } = usePrediction({
    userId: id,
    isAttendanceLoaded: !detailLoading && !!attendance,
    isGradesLoaded: !detailLoading && !!grades
  })

  const { data: interventions, isLoading: interventionsLoading } = useInterventions(id)

  // Mutations
  const updateGradesMutation = useUpdateGrades()
  const addInterventionMutation = useAddIntervention()

  // State
  const [editingGradeClassId, setEditingGradeClassId] = useState<string | null>(null)
  const [editInternal, setEditInternal] = useState<number>(0)
  const [editExternal, setEditExternal] = useState<number>(0)

  const [showInterventionModal, setShowInterventionModal] = useState(false)
  const [intDate, setIntDate] = useState(new Date().toISOString().split('T')[0])
  const [intType, setIntType] = useState('Meeting')
  const [intNotes, setIntNotes] = useState('')

  const [showReportGenerator, setShowReportGenerator] = useState(false)
  const [showMessageComposer, setShowMessageComposer] = useState(false)

  // Access Control: Redirect if the student is not assigned to this mentor
  useEffect(() => {
    if (profile && user && profile.mentor_id !== user.id) {
      toast.error("You are not authorized to view this student's details.")
      navigate('/mentor/dashboard', { replace: true })
    }
  }, [profile, user, navigate])

  // Compute Risk
  const riskLevel = useMemo(() => {
    if (!attendance || !grades) return 'Low'
    const totalFails = grades.filter(g => g.grade === 'F').length
    const dOrF = grades.filter(g => g.grade === 'F' || g.grade === 'D').length
    const avgAtt = attendance.length > 0 ? attendance.reduce((s,a) => s + a.percentage, 0) / attendance.length : 100

    if (avgAtt < 60 || totalFails > 1) return 'High'
    if (avgAtt < 75 || dOrF > 0) return 'Medium'
    return 'Low'
  }, [attendance, grades])

  // Grade Edit Handlers
  const handleEditGrade = (grade: GradeSummary) => {
    setEditingGradeClassId(grade.class_id)
    setEditInternal(grade.internal)
    setEditExternal(grade.external)
  }

  const handleSaveGrade = async (classId: string) => {
    if (!id) return
    try {
      await updateGradesMutation.mutateAsync({
        student_id: id,
        class_id: classId,
        internal_marks: editInternal,
        external_marks: editExternal
      })
      setEditingGradeClassId(null)
    } catch(err) {
      // handled by mutation toast
    }
  }

  // Intervention Submission
  const handleSubmitIntervention = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !user) return
    await addInterventionMutation.mutateAsync({
      student_id: id,
      mentor_id: user.id,
      type: intType,
      notes: intNotes.trim(),
      date: intDate
    })
    setShowInterventionModal(false)
    setIntNotes('') // reset for next time
  }

  // Loading / Error
  if (detailLoading) {
    return (
      <AppShell role="mentor">
        <div className="flex items-center justify-center h-full">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-300 border-t-brand-800" />
        </div>
      </AppShell>
    )
  }

  if (detailError || !profile) {
    return (
      <AppShell role="mentor">
        <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500">
          <AlertTriangle size={48} className="text-red-400" />
          <p>Failed to load student tracking data.</p>
          <button onClick={() => navigate('/mentor/dashboard')} className="text-brand-600 hover:underline">Return to Dashboard</button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell role="mentor">
      <motion.div 
        className="flex flex-col gap-6 max-w-7xl mx-auto pb-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <button 
                onClick={() => navigate('/mentor/dashboard')} 
                className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-600 transition-colors"
              >
                <ArrowLeft size={16} /> Back to Cohort
              </button>
              <button 
                onClick={() => setShowReportGenerator(true)} 
                className="flex items-center gap-1.5 text-sm font-bold text-slate-600 border border-slate-200 px-3 py-1 bg-white hover:bg-slate-50 rounded-lg shadow-sm transition-colors"
              >
                <FileText size={16} className="text-slate-500" /> Generate Report
              </button>
              <button 
                onClick={() => setShowMessageComposer(true)} 
                className="flex items-center gap-1.5 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 px-3 py-1 rounded-lg shadow-sm transition-colors"
              >
                <MessageSquare size={16} className="text-brand-200" /> Message
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-white shadow-md bg-brand-100 flex items-center justify-center text-xl font-bold text-brand-700">
                 {profile.avatar_url ? <img src={profile.avatar_url} alt="Profile" className="h-full w-full object-cover" /> : profile.full_name?.charAt(0) || '?'}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{profile.full_name}</h1>
                <p className="text-sm text-slate-500 font-medium">
                  {profile.branch} &bull; Semester {profile.semester}
                </p>
              </div>
            </div>
          </div>
          <div>
            <div className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold border shadow-sm",
              riskLevel === 'High' ? "bg-red-50 text-red-700 border-red-200" :
              riskLevel === 'Medium' ? "bg-amber-50 text-amber-700 border-amber-200" :
              "bg-emerald-50 text-emerald-700 border-emerald-200"
            )}>
              {riskLevel === 'High' && <AlertTriangle size={16} />}
              {riskLevel} Risk Profile
            </div>
          </div>
        </motion.div>

        {/* Top Grid: Profile + Prediction + Attendance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div variants={itemVariants} className="lg:col-span-1">
            <ProfileCard profile={profile} />
          </motion.div>
          <motion.div variants={itemVariants} className="lg:col-span-1 border rounded-2xl overflow-hidden bg-white">
            <AttendanceChart data={attendance} isLoading={detailLoading} />
          </motion.div>
          <motion.div variants={itemVariants} className="lg:col-span-1">
            <PredictionWidget data={predictionData} isLoading={predictionLoading} />
          </motion.div>
        </div>

        {/* Grades Edit Table */}
        <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Academic Standing & Grades</h2>
            <p className="text-sm text-slate-500">Update module scores to revise predictions</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                <tr>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4 text-center">Internal (50)</th>
                  <th className="px-6 py-4 text-center">External (50)</th>
                  <th className="px-6 py-4 text-center">Total</th>
                  <th className="px-6 py-4 text-center">Grade</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grades && grades.length > 0 ? grades.map((g) => {
                  const isEditing = editingGradeClassId === g.class_id
                  return (
                    <tr key={g.class_id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4 font-semibold text-slate-800">{g.subject_name}</td>
                      <td className="px-6 py-4 text-center">
                        {isEditing ? (
                          <input 
                            type="number" min={0} max={50} 
                            value={editInternal} onChange={(e) => setEditInternal(Number(e.target.value))}
                            className="w-16 rounded border-slate-300 text-center text-sm p-1 focus:ring-brand-500 focus:border-brand-500" 
                          />
                        ) : g.internal}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isEditing ? (
                          <input 
                            type="number" min={0} max={50} 
                            value={editExternal} onChange={(e) => setEditExternal(Number(e.target.value))}
                            className="w-16 rounded border-slate-300 text-center text-sm p-1 focus:ring-brand-500 focus:border-brand-500" 
                          />
                        ) : g.external}
                      </td>
                      <td className="px-6 py-4 text-center font-medium">
                         {isEditing ? editInternal + editExternal : g.total}
                      </td>
                      <td className="px-6 py-4 text-center">
                         <span className={cn(
                           "px-2 py-0.5 rounded font-bold text-xs",
                           (g.grade === 'F' || g.grade === 'D') ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                         )}>
                            {g.grade}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                             <button onClick={() => setEditingGradeClassId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded" title="Cancel"><X size={16}/></button>
                             <button onClick={() => handleSaveGrade(g.class_id)} disabled={updateGradesMutation.isPending} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Save"><Check size={16}/></button>
                          </div>
                        ) : (
                          <button onClick={() => handleEditGrade(g)} className="p-1 px-2 flex items-center gap-1.5 text-brand-600 hover:bg-brand-50 font-medium rounded transition ml-auto">
                            <Edit2 size={14} /> Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                }) : (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-medium">No enrolled subjects found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Interventions Log */}
        <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Intervention Log</h2>
              <p className="text-sm text-slate-500">Record of all mentor actions taken for this student.</p>
            </div>
            <button 
              onClick={() => setShowInterventionModal(true)}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
            >
              <Plus size={16} /> Log Action
            </button>
          </div>

          {interventionsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : interventions && interventions.length > 0 ? (
            <div className="space-y-4">
              {interventions.map((intv) => (
                <div key={intv.id} className="flex gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100/50 transition">
                  <div className="shrink-0 mt-1">
                     {intv.type === 'Meeting' ? <MessageSquare size={20} className="text-blue-500" /> :
                      intv.type === 'Postcard' ? <FileText size={20} className="text-amber-500" /> :
                      intv.type === 'Buddy Assignment' ? <UserPlus size={20} className="text-emerald-500" /> :
                      <AlertTriangle size={20} className="text-slate-400" />
                     }
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{intv.type}</span>
                      <span className="text-xs font-medium text-slate-400 px-2 py-0.5 rounded-full border border-slate-200 bg-white">
                        {new Date(intv.date).toLocaleDateString()}
                      </span>
                    </div>
                    {intv.notes && <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{intv.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
              <Calendar size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-600 font-medium">No actions logged yet.</p>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Intervention Modal */}
      <AnimatePresence>
        {showInterventionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Log Intervention</h3>
                <button onClick={() => setShowInterventionModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
              </div>
              <form onSubmit={handleSubmitIntervention} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date</label>
                  <input required type="date" value={intDate} onChange={(e) => setIntDate(e.target.value)} className="w-full rounded-xl border-slate-200 py-2.5 text-sm focus:ring-brand-500 focus:border-brand-500" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Intervention Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Meeting', 'Postcard', 'Buddy Assignment', 'Other'].map(type => (
                      <label key={type} className={cn(
                        "flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition",
                        intType === type ? "bg-brand-50 border-brand-500 text-brand-700 font-medium" : "border-slate-200 hover:bg-slate-50 text-slate-600"
                      )}>
                        <input type="radio" value={type} checked={intType === type} onChange={(e) => setIntType(e.target.value)} className="text-brand-600 focus:ring-brand-500" />
                        <span className="text-sm">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes</label>
                  <textarea rows={4} required value={intNotes} onChange={(e) => setIntNotes(e.target.value)} placeholder="Summary of the meeting or exact details..." className="w-full rounded-xl border-slate-200 py-2.5 text-sm focus:ring-brand-500 focus:border-brand-500 resize-none"></textarea>
                </div>
                <div className="pt-2 flex gap-3">
                  <button type="button" onClick={() => setShowInterventionModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 transition">Cancel</button>
                  <button type="submit" disabled={addInterventionMutation.isPending} className="flex-1 px-4 py-2.5 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition disabled:opacity-50">Save Log</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Report Generator Modal */}
      <ReportGenerator 
        studentId={id || ''} 
        isOpen={showReportGenerator} 
        onClose={() => setShowReportGenerator(false)} 
      />

      {/* Message Composer Modal */}
      <MessageComposer 
        isOpen={showMessageComposer}
        onClose={() => setShowMessageComposer(false)}
        initialRecipients={profile ? [{ id: profile.id, name: profile.full_name }] : []}
      />
    </AppShell>
  )
}
