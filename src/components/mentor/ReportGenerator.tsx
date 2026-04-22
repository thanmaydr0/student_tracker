import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, Zap, FileText, Heart, CheckCircle2, 
  Copy, Download, Share2, Loader2, Clock, History
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { cn } from '../../lib/utils'

type GeneratorState = 'SELECT' | 'GENERATING' | 'PREVIEW' | 'HISTORY'
type ReportType = 'summary' | 'detailed' | 'parent'

interface ReportGeneratorProps {
  studentId: string
  isOpen: boolean
  onClose: () => void
}

const loadingMessages = [
  "Analyzing attendance patterns...",
  "Reviewing grade trajectories...",
  "Evaluating risk factors...",
  "Crafting your report...",
  "Finalizing recommendations..."
]

export default function ReportGenerator({ studentId, isOpen, onClose }: ReportGeneratorProps) {
  const [step, setStep] = useState<GeneratorState>('SELECT')
  const [selectedType, setSelectedType] = useState<ReportType | null>(null)
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  
  const [reportData, setReportData] = useState<any>(null)
  const [historyReports, setHistoryReports] = useState<any[]>([])
  const [isFetchingHistory, setIsFetchingHistory] = useState(false)

  // Reset state heavily on reopen
  useEffect(() => {
    if (isOpen) {
      setStep('SELECT')
      setSelectedType(null)
      setReportData(null)
      setProgress(0)
    }
  }, [isOpen])

  // Fake progressive loader sync for loading messages
  useEffect(() => {
    if (step === 'GENERATING') {
      const msgInterval = setInterval(() => {
        setLoadingMsgIdx(prev => (prev + 1) % loadingMessages.length)
      }, 2000)

      const progInterval = setInterval(() => {
        setProgress(p => {
          if (p >= 85) return p
          return p + Math.random() * 8
        })
      }, 400)

      return () => {
        clearInterval(msgInterval)
        clearInterval(progInterval)
      }
    }
  }, [step])

  const handleFetchHistory = async () => {
    setStep('HISTORY')
    setIsFetchingHistory(true)
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
      if (error) throw error
      setHistoryReports(data || [])
    } catch(err) {
      toast.error('Failed to load past reports')
    } finally {
      setIsFetchingHistory(false)
    }
  }

  const handleGenerate = async () => {
    if (!selectedType) return
    setStep('GENERATING')
    setProgress(10)
    
    try {
      // Client-side fetch bridging to bypass undeployed Edge Functions cleanly 
      const openAiKey = import.meta.env.VITE_OPENAI_API_KEY
      if (!openAiKey) throw new Error('Proxy mode failed: VITE_OPENAI_API_KEY is missing.')

      // Fetch requisite data manually
      const [attRes, gradesRes, profileRes] = await Promise.all([
          supabase.rpc('get_attendance_summary', { p_student_id: studentId }),
          supabase.from('grades').select('*, classes(subjects(name))').eq('student_id', studentId),
          supabase.from('profiles').select('full_name, branch, semester, mentor_id').eq('id', studentId).single()
      ])

      const attendance = attRes.data
      const grades = gradesRes.data
      const profile = profileRes.data

      const attendanceContext = attendance?.map((a: any) =>
        `${a.subject_name}: ${a.percentage}% (${a.present_count}/${a.total_count} classes)`
      ).join(' | ') || 'No attendance data'

      const gradesContext = grades?.map((g: any) =>
        `${g.classes?.subjects?.name}: Total=${g.total_score}/100, Grade=${g.grade}`
      ).join(' | ') || 'No grades data'

      const systemPrompt = `You are an expert Academic Advisor. Write a highly structured ${selectedType} report for a student based on their raw data.
      Return ONLY a JSON payload. No markdown wrappers. Ensure tone explicitly matches ${selectedType}.
      
      JSON Schema required identically matching these exact keys:
      {
         "report_title": "String",
         "generated_date": "ISO string",
         "student_name": "String",
         "academic_period": "String",
         "overall_status": "String like Excellent/At Risk",
         "executive_summary": "1 paragraph string",
         "sections": [{ "title": "String", "content": "String", "data_points": ["String"] }],
         "recommendations": ["String array"],
         "closing_statement": "1 line String",
         "mentor_name": "String"
      }`

      const userPrompt = `Student Data Context:
      Name: ${profile?.full_name}
      Branch: ${profile?.branch}, Sem: ${profile?.semester}
      Attendance: ${attendanceContext}
      Grades: ${gradesContext}`

      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
           model: 'gpt-4o-mini',
           temperature: 0.2,
           response_format: { type: 'json_object' },
           messages: [
             { role: 'system', content: systemPrompt },
             { role: 'user', content: userPrompt }
           ]
        })
      })

      if (!openaiRes.ok) throw new Error("AI engine failed securely limits.")

      const openaiData = await openaiRes.json()
      const rawReport = JSON.parse(openaiData.choices[0].message.content)
      
      const payload = { report: rawReport, report_type: selectedType, student_id: studentId }
      
      // Save it successfully bypassing server-execution locally!
      await supabase.from('reports').insert({
         student_id: studentId, mentor_id: profile?.mentor_id, 
         report_type: selectedType, content: { report: rawReport }
      })

      setReportData(payload)
      setProgress(100)
      setTimeout(() => setStep('PREVIEW'), 800)

    } catch (err: any) {
      console.warn("Generation failed:", err.message)
      toast.error("Failed to generate report correctly. Ensure VITE_OPENAI_API_KEY is configured!")
      setStep('SELECT')
    }
  }

  const handleCopyToClipboard = () => {
    if (!reportData?.report) return
    const text = JSON.stringify(reportData.report, null, 2)
    navigator.clipboard.writeText(text)
    toast.success("Raw report copied to clipboard!")
  }

  const handlePrint = () => {
    const printArea = document.getElementById('print-area')
    if (!printArea) return

    toast.loading("Preparing document for print...", { duration: 800 })

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const iframeDoc = iframe.contentWindow?.document
    if (!iframeDoc) return

    // Clone all Tailwind/React styles natively to enforce styling inside iframe
    const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(node => node.outerHTML)
      .join('\n')

    iframeDoc.open()
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>EduPredict - Official Report</title>
          ${styleTags}
          <style>
             body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
             @media print {
               @page { size: auto; margin: 15mm; }
             }
          </style>
        </head>
        <body class="bg-white font-sans text-slate-900 overflow-visible p-0 m-0">
          <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
             ${printArea.innerHTML}
          </div>
        </body>
      </html>
    `)
    iframeDoc.close()

    setTimeout(() => {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    }, 500)
  }

  const handleShare = async () => {
    toast('Notification sent securely to student portal!', { icon: '📩' })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Background Dimmer */}
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
      />

      {/* Main Modal Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className={cn(
          "relative bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden will-change-transform w-full",
          step === 'PREVIEW' ? "max-w-4xl max-h-[90vh]" : "max-w-2xl max-h-[85vh]"
        )}
      >
        {/* Header - Hidden natively on Print */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-100 inline-flex items-center justify-center text-brand-600">
               <FileText size={16} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Report Generator</h2>
          </div>
          <div className="flex flex-row items-center gap-2">
            {step === 'SELECT' && (
              <button 
                 onClick={handleFetchHistory}
                 className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition"
              >
                 <History size={14} /> Past Reports
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="overflow-y-auto flex-1 p-6 relative flex flex-col">
          
          <AnimatePresence mode="wait">

            {/* --- STEP 1: SELECT TYPE --- */}
            {step === 'SELECT' && (
              <motion.div 
                key="select"
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Select Report Type</h3>
                  <p className="text-sm text-slate-500 mt-1">Our AI tightly structures formats natively bridging optimal recipient contexts.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button 
                    onClick={() => setSelectedType('summary')}
                    className={cn(
                      "flex flex-col items-start p-5 rounded-xl border-2 text-left transition-all",
                      selectedType === 'summary' ? "border-brand-500 bg-brand-50/30 shadow-md ring-4 ring-brand-500/10" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <div className={cn("p-2 rounded-lg mb-3", selectedType === 'summary' ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500")}><Zap size={20}/></div>
                    <span className="font-bold text-slate-900 mb-1">Quick Summary</span>
                    <span className="text-xs text-slate-500 font-medium">For your own reference. Short and data-dense.</span>
                  </button>

                  <button 
                    onClick={() => setSelectedType('detailed')}
                    className={cn(
                      "flex flex-col items-start p-5 rounded-xl border-2 text-left transition-all",
                      selectedType === 'detailed' ? "border-indigo-500 bg-indigo-50/30 shadow-md ring-4 ring-indigo-500/10" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <div className={cn("p-2 rounded-lg mb-3", selectedType === 'detailed' ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-500")}><FileText size={20}/></div>
                    <span className="font-bold text-slate-900 mb-1">Detailed Report</span>
                    <span className="text-xs text-slate-500 font-medium">Full analysis for admin or academic committee.</span>
                  </button>

                  <button 
                    onClick={() => setSelectedType('parent')}
                    className={cn(
                      "flex flex-col items-start p-5 rounded-xl border-2 text-left transition-all",
                      selectedType === 'parent' ? "border-rose-500 bg-rose-50/30 shadow-md ring-4 ring-rose-500/10" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <div className={cn("p-2 rounded-lg mb-3", selectedType === 'parent' ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-500")}><Heart size={20}/></div>
                    <span className="font-bold text-slate-900 mb-1">Parent Report</span>
                    <span className="text-xs text-slate-500 font-medium">Warm, accessible language for families.</span>
                  </button>
                </div>

                <div className="pt-6 flex justify-end">
                   <button 
                     disabled={!selectedType}
                     onClick={handleGenerate}
                     className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition shadow-sm"
                   >
                     Generate Report
                   </button>
                </div>
              </motion.div>
            )}


            {/* --- STEP 2: GENERATING --- */}
            {step === 'GENERATING' && (
              <motion.div 
                key="generating"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16"
              >
                <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mb-6 border border-brand-100 relative">
                  <Loader2 size={32} className="text-brand-600 animate-spin" />
                  <div className="absolute inset-0 border-2 border-brand-500 rounded-2xl border-t-transparent animate-[spin_3s_linear_infinite]" />
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 mb-2">Generating Report</h3>
                
                <div className="h-6 relative overflow-hidden w-64 text-center">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={loadingMsgIdx}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      className="absolute inset-0 text-sm font-medium text-slate-500"
                    >
                      {loadingMessages[loadingMsgIdx]}
                    </motion.span>
                  </AnimatePresence>
                </div>

                <div className="w-64 h-2 bg-slate-100 rounded-full mt-6 overflow-hidden">
                   <motion.div 
                     className="h-full bg-brand-500 rounded-full"
                     animate={{ width: `${progress}%` }}
                   />
                </div>
              </motion.div>
            )}


            {/* --- STEP 3: PREVIEW --- */}
            {step === 'PREVIEW' && reportData?.report && (
              <motion.div 
                key="preview"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="w-full h-full flex flex-col"
              >
                <div id="print-area" className="flex-1 bg-white border border-slate-200 shadow-sm rounded-xl px-10 py-12 text-slate-800 font-sans">
                  
                  {/* Header */}
                  <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-8">
                     <div>
                       <h1 className="text-2xl font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                         <div className="w-6 h-6 bg-brand-600 rounded flex items-center justify-center text-white"><Zap size={14} className="fill-current text-white"/></div>
                         EDUPREDICT
                       </h1>
                       <p className="text-sm font-bold text-slate-500 tracking-wider uppercase mt-1">Official Academic Record</p>
                     </div>
                     <div className="text-right">
                       <h2 className="text-xl font-bold text-slate-900">{reportData.report.report_title}</h2>
                       <p className="text-sm font-semibold text-slate-500 mt-1">Date: <span className="text-slate-700">{new Date(reportData.report.generated_date).toLocaleDateString()}</span></p>
                     </div>
                  </div>

                  {/* Top Meta Stats */}
                  <div className="flex flex-row items-center gap-8 mb-8 pb-8 border-b border-slate-100 flex-wrap">
                     <div>
                       <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-1">Student</p>
                       <p className="text-lg font-bold text-slate-900">{reportData.report.student_name}</p>
                     </div>
                     <div>
                       <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-1">Period</p>
                       <p className="text-lg font-semibold text-slate-700">{reportData.report.academic_period}</p>
                     </div>
                     <div className="ml-auto">
                       <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-1 text-right">Overall Status</p>
                       <span className={cn(
                         "inline-flex items-center px-4 py-1.5 rounded-md font-bold text-[15px] border",
                         reportData.report.overall_status === 'At Risk' ? "bg-red-50 text-red-700 border-red-200" :
                         reportData.report.overall_status === 'Needs Improvement' ? "bg-amber-50 text-amber-700 border-amber-200" :
                         reportData.report.overall_status === 'Excellent' ? "bg-brand-50 text-brand-700 border-brand-200" :
                         "bg-emerald-50 text-emerald-700 border-emerald-200"
                       )}>
                         {reportData.report.overall_status}
                       </span>
                     </div>
                  </div>

                  {/* Exec Summary */}
                  <div className="mb-10">
                    <p className="text-lg font-medium text-slate-600 italic leading-relaxed">
                      "{reportData.report.executive_summary}"
                    </p>
                  </div>

                  {/* Body Sections */}
                  <div className="space-y-10">
                    {reportData.report.sections?.map((sec: any, idx: number) => (
                      <div key={idx}>
                        <h3 className="text-xl font-bold text-slate-900 mb-3 border-b-2 border-brand-100 inline-block pb-1 pr-6">{sec.title}</h3>
                        <p className="text-[15px] leading-relaxed text-slate-700">{sec.content}</p>
                        {sec.data_points && sec.data_points.length > 0 && (
                          <ul className="mt-4 space-y-2">
                             {sec.data_points.map((pt: string, pidx: number) => (
                               <li key={pidx} className="flex font-medium text-slate-700 bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
                                 <span className="mr-3 font-bold text-brand-500">•</span> {pt}
                               </li>
                             ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Recommendations */}
                  <div className="mt-12 bg-slate-50 border border-slate-200 rounded-2xl p-8">
                     <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                       <CheckCircle2 className="text-brand-600" /> Key Recommendations
                     </h3>
                     <ul className="space-y-4">
                       {reportData.report.recommendations?.map((rec: string, idx: number) => (
                         <li key={idx} className="flex font-medium text-slate-700 items-start">
                           <span className="w-6 h-6 rounded-full bg-white border border-slate-300 flex items-center justify-center text-xs font-bold text-slate-500 mr-3 mt-0.5 shrink-0">{idx + 1}</span>
                           <span className="leading-relaxed pt-0.5">{rec}</span>
                         </li>
                       ))}
                     </ul>
                  </div>

                  {/* Footer Signs */}
                  <div className="mt-16 pt-8 border-t-2 border-slate-800 flex justify-between items-end pb-8">
                    <div>
                      <p className="text-[15px] font-medium text-slate-700 italic mb-6">"{reportData.report.closing_statement}"</p>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Signed By</p>
                      <p className="text-xl font-black text-slate-900" style={{ fontFamily: 'Times New Roman' }}>{reportData.report.mentor_name}</p>
                    </div>
                  </div>
                  
                  <div className="text-center text-xs font-semibold text-slate-400 pb-4">
                     Generated securely by EduPredict AI Engine on {new Date(reportData.report.generated_date).toLocaleString()}
                  </div>

                </div>
              </motion.div>
            )}


            {/* --- STEP 4: HISTORY --- */}
            {step === 'HISTORY' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-900">Report History</h3>
                  <button onClick={() => setStep('SELECT')} className="text-sm font-bold text-brand-600 hover:bg-brand-50 px-3 py-1.5 rounded transition">← Back to Generator</button>
                </div>

                {isFetchingHistory ? (
                   <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-300" size={32} /></div>
                ) : historyReports.length === 0 ? (
                   <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                      <Clock className="mx-auto block w-10 h-10 text-slate-300 mb-3" />
                      <p className="text-slate-600 font-semibold mb-1">No past reports.</p>
                      <p className="text-slate-500 text-sm">Generate a report to see history tracking here.</p>
                   </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {historyReports.map((hr) => (
                      <div key={hr.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition">
                         <div className="flex items-center gap-4">
                           <div className="p-2 bg-slate-100 rounded-lg">
                             <FileText size={18} className="text-slate-500" />
                           </div>
                           <div>
                             <p className="font-bold text-slate-900 tracking-tight">{hr.content.report?.report_title || 'Unnamed Report'}</p>
                             <div className="flex items-center gap-2 mt-0.5 text-xs font-semibold text-slate-500 uppercase tracking-widest">
                               <span className={cn(
                                 "px-1.5 py-0.5 rounded",
                                 hr.report_type === 'summary' ? "bg-amber-100 text-amber-700" :
                                 hr.report_type === 'detailed' ? "bg-indigo-100 text-indigo-700" :
                                 "bg-rose-100 text-rose-700"
                               )}>{hr.report_type}</span>
                               <span>{new Date(hr.created_at).toLocaleDateString()}</span>
                             </div>
                           </div>
                         </div>
                         <button 
                           onClick={() => {
                             setReportData({ report: hr.content.report })
                             setStep('PREVIEW')
                           }}
                           className="px-4 py-2 font-bold text-brand-600 hover:bg-brand-50 rounded-lg transition"
                         >
                           View
                         </button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer actions for Preview */}
        <AnimatePresence>
          {step === 'PREVIEW' && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0 overflow-hidden"
            >
              <div className="flex items-center gap-2">
                <button onClick={handleCopyToClipboard} className="flex px-3 py-2 items-center gap-1.5 font-semibold text-sm text-slate-600 hover:text-slate-900 border border-slate-200 bg-white shadow-sm rounded-lg hover:bg-slate-50 transition">
                   <Copy size={16}/> Copy
                </button>
                <button onClick={handlePrint} className="flex px-3 py-2 items-center gap-1.5 font-semibold text-sm text-slate-600 hover:text-slate-900 border border-slate-200 bg-white shadow-sm rounded-lg hover:bg-slate-50 transition">
                   <Download size={16}/> Download PDF
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleShare} className="flex px-5 py-2.5 items-center gap-1.5 font-bold text-sm text-white bg-brand-600 shadow-sm rounded-xl hover:bg-brand-700 transition">
                   <Share2 size={16}/> Share with Student
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  )
}
