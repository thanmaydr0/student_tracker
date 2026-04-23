import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Calendar, Sparkles, Loader2, AlertCircle, BookOpen, Clock, CalendarDays, Upload, Image, X, FileUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface ParsedSubject {
  name: string
  hours_per_week: number
  lectures_per_month: number
}

interface AnalysisResult {
  subjects: ParsedSubject[]
  total_monthly_lectures: number
  attendance_strategy: string
  holidays_accounted: string[]
}

interface UploadedFile {
  name: string
  type: string
  preview?: string     // data URL for image previews
  base64: string       // raw base64 data (no prefix)
  mime_type: string
  isImage: boolean
  textContent?: string // extracted text for text/csv files
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ACCEPTED_DOC_TYPES = ['text/plain', 'text/csv', 'application/pdf']
const ALL_ACCEPTED = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_DOC_TYPES].join(',')
const MAX_FILES = 5

export default function TimetableAnalyzer() {
  const [timetableText, setTimetableText] = useState('')
  const [calendarText, setCalendarText] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File): Promise<UploadedFile | null> => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error(`${file.name} is too large (max 10 MB)`)
      return null
    }

    const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type)

    return new Promise((resolve) => {
      const reader = new FileReader()

      if (file.type === 'text/plain' || file.type === 'text/csv') {
        // Read text files as text
        const textReader = new FileReader()
        textReader.onload = (e) => {
          const textContent = e.target?.result as string
          // Also read as base64 for consistency
          const b64Reader = new FileReader()
          b64Reader.onload = (e2) => {
            const dataUrl = e2.target?.result as string
            const base64 = dataUrl.split(',')[1]
            resolve({
              name: file.name,
              type: file.type,
              base64,
              mime_type: file.type,
              isImage: false,
              textContent,
            })
          }
          b64Reader.readAsDataURL(file)
        }
        textReader.readAsText(file)
        return
      }

      // Read images and PDFs as base64
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        const base64 = dataUrl.split(',')[1]
        resolve({
          name: file.name,
          type: file.type,
          preview: isImage ? dataUrl : undefined,
          base64,
          mime_type: file.type,
          isImage,
        })
      }
      reader.readAsDataURL(file)
    })
  }, [])

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const remaining = MAX_FILES - uploadedFiles.length
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_FILES} files allowed`)
      return
    }
    const toProcess = fileArray.slice(0, remaining)

    const results = await Promise.all(toProcess.map(processFile))
    const valid = results.filter(Boolean) as UploadedFile[]
    setUploadedFiles(prev => [...prev, ...valid])
  }, [uploadedFiles.length, processFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleAnalyze = async () => {
    if (!timetableText.trim() && uploadedFiles.length === 0) {
      toast.error('Please paste your timetable or upload an image/document.')
      return
    }

    setIsAnalyzing(true)
    setResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      // Build combined timetable text (include text from uploaded text files)
      let combinedText = timetableText
      for (const f of uploadedFiles) {
        if (f.textContent) {
          combinedText += `\n\n--- Content from ${f.name} ---\n${f.textContent}`
        }
      }

      // Collect image files (images + PDFs rendered as images)
      const imagePayloads = uploadedFiles
        .filter(f => f.isImage)
        .map(f => ({ data: f.base64, mime_type: f.mime_type }))

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-timetable`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            timetable_text: combinedText || undefined,
            calendar_text: calendarText || undefined,
            images: imagePayloads.length > 0 ? imagePayloads : undefined,
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to analyze')
      }

      const data = await response.json()
      setResult(data)
      toast.success('Analysis complete!')
    } catch (error: any) {
      console.error('Analysis error:', error)
      toast.error(error.message || 'Failed to analyze timetable')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const hasInput = timetableText.trim().length > 0 || uploadedFiles.length > 0

  return (
    <div className="flex flex-col rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 shadow-sm">
          <CalendarDays size={20} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800 tracking-tight">AI Timetable & Calendar Analyzer</h2>
          <p className="text-xs text-slate-500 font-medium">Upload images, documents, or paste text — plan your 75% strategy</p>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {!result ? (
          <>
            {/* File Upload Zone */}
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Upload size={16} className="text-slate-400" />
                Upload Timetable / Calendar (Images & Documents)
              </label>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/30'
                }`}
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
                  isDragOver ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  <FileUp size={24} />
                </div>
                <p className="text-sm font-medium text-slate-600">
                  {isDragOver ? 'Drop files here' : 'Drag & drop or click to upload'}
                </p>
                <p className="text-xs text-slate-400">
                  Images (JPG, PNG, WebP) • Documents (PDF, TXT, CSV) • Max {MAX_FILES} files, 10 MB each
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ALL_ACCEPTED}
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                  className="hidden"
                />
              </div>

              {/* File Preview Grid */}
              {uploadedFiles.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {uploadedFiles.map((file, idx) => (
                    <div key={idx} className="group relative flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                      {file.isImage && file.preview ? (
                        <img src={file.preview} alt={file.name} className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-100">
                          <FileText size={16} className="text-slate-500" />
                        </div>
                      )}
                      <span className="max-w-[120px] truncate text-xs font-medium text-slate-700">{file.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(idx) }}
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-100 hover:text-red-500"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">or paste text</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {/* Text Input Areas */}
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <FileText size={16} className="text-slate-400" />
                  Paste Timetable / Schedule
                </label>
                <textarea
                  value={timetableText}
                  onChange={(e) => setTimetableText(e.target.value)}
                  placeholder="e.g. Monday: CS301 (9am-10am), Math (11am-12pm)..."
                  className="w-full min-h-[100px] rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-y"
                />
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Calendar size={16} className="text-slate-400" />
                  Paste Academic Calendar / Holidays (Optional)
                </label>
                <textarea
                  value={calendarText}
                  onChange={(e) => setCalendarText(e.target.value)}
                  placeholder="e.g. Oct 2: Gandhi Jayanti (Holiday), Oct 15-20: Midterms..."
                  className="w-full min-h-[70px] rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-y"
                />
              </div>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !hasInput}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Analyzing Documents...
                </>
              ) : (
                <>
                  <Sparkles size={18} className="transition-transform group-hover:scale-110 group-hover:rotate-12" />
                  Generate Attendance Strategy
                </>
              )}
            </button>
          </>
        ) : (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-5"
            >
              {/* Strategy Alert */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/80 p-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Sparkles size={64} />
                </div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-indigo-900 mb-2">
                  <Sparkles size={16} className="text-indigo-600" />
                  Your AI Strategy for 75%
                </h3>
                <p className="text-sm text-indigo-800 leading-relaxed relative z-10">
                  {result.attendance_strategy}
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 flex flex-col items-center justify-center text-center">
                  <BookOpen size={20} className="text-blue-500 mb-1.5" />
                  <span className="text-2xl font-black text-slate-800">{result.subjects.length}</span>
                  <span className="text-xs font-medium text-slate-500">Subjects Detected</span>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 flex flex-col items-center justify-center text-center">
                  <CalendarDays size={20} className="text-emerald-500 mb-1.5" />
                  <span className="text-2xl font-black text-slate-800">{result.total_monthly_lectures}</span>
                  <span className="text-xs font-medium text-slate-500">Lectures/Month</span>
                </div>
              </div>

              {/* Subject Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Subject Breakdown</h4>
                <div className="flex flex-col gap-2">
                  {result.subjects.map((sub, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-bold text-xs">
                          {sub.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-slate-700">{sub.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                          <Clock size={14} className="text-slate-400" />
                          {sub.hours_per_week} hrs/wk
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                          <Calendar size={14} className="text-slate-400" />
                          {sub.lectures_per_month} /mo
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Holidays */}
              {result.holidays_accounted && result.holidays_accounted.length > 0 && result.holidays_accounted[0] !== 'None' && (
                <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3.5">
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800 mb-2">
                    <AlertCircle size={14} />
                    Holidays Accounted For
                  </h4>
                  <ul className="list-disc list-inside text-sm font-medium text-amber-700 space-y-1">
                    {result.holidays_accounted.map((h, i) => <li key={i}>{h}</li>)}
                  </ul>
                </div>
              )}

              <button
                onClick={() => { setResult(null); setUploadedFiles([]) }}
                className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                ← Analyze another schedule
              </button>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
