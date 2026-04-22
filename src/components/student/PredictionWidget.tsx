import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Cpu, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import type { PredictionResult } from '../../types/app.types'
import { cn } from '../../lib/utils'

interface PredictionWidgetProps {
  data: PredictionResult | undefined
  isLoading: boolean
  isError?: boolean
  onRetry?: () => void
}

const gradeColors: Record<string, string> = {
  A: 'text-emerald-400',
  B: 'text-blue-400',
  C: 'text-amber-400',
  D: 'text-orange-400',
  F: 'text-red-400',
}

const riskStyles = {
  Low: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  Medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  High: 'bg-red-500/20 text-red-300 border-red-500/30',
}

export default function PredictionWidget({ data, isLoading, isError, onRetry }: PredictionWidgetProps) {
  const [showAllSuggestions, setShowAllSuggestions] = useState(false)
  const toastFiredRef = useRef(false)

  useEffect(() => {
    if (data?.risk_level === 'High' && !toastFiredRef.current) {
      toast('Your performance prediction shows HIGH risk — check recommendations', {
        icon: '⚠️',
        style: {
          background: '#1e293b',
          color: '#fff',
          border: '1px solid #334155',
        },
      })
      toastFiredRef.current = true
    }
  }, [data?.risk_level])

  // --- Loading State ---
  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-card border border-slate-700">
          
          {/* Shimmer animation for dark card */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent border-t border-transparent" />
          
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs uppercase tracking-widest text-slate-400 font-semibold">AI Performance Prediction</h3>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70 tracking-wide">
              Powered by OpenAI
            </span>
          </div>

          <div className="flex flex-col items-center justify-center py-10 gap-4">
             <Cpu size={32} className="text-indigo-400 animate-pulse" />
             <p className="text-sm font-medium text-white/60">Analyzing your academic profile...</p>
          </div>
        </div>
      </motion.div>
    )
  }

  // --- Error State ---
  if (isError) {
    return (
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-card border border-slate-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs uppercase tracking-widest text-slate-400 font-semibold">AI Performance Prediction</h3>
          </div>
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
             <AlertCircle size={32} className="text-red-400" />
             <p className="text-sm text-white/80">Prediction unavailable — check your connection</p>
             {onRetry && (
               <button 
                 onClick={onRetry}
                 className="mt-2 flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors"
               >
                 <RefreshCw size={16} />
                 Try Again
               </button>
             )}
          </div>
        </div>
      </motion.div>
    )
  }

  // --- Empty State ---
  if (!data) {
    return (
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-card border border-slate-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs uppercase tracking-widest text-slate-400 font-semibold">AI Performance Prediction</h3>
          </div>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm text-white/50 max-w-[200px]">
              Not enough data gathered to generate a prediction yet.
            </p>
          </div>
        </div>
      </motion.div>
    )
  }

  // --- Success State ---
  const gradeColor = gradeColors[data.predicted_grade] || 'text-white'
  const visibleSuggestions = showAllSuggestions ? data.suggestions : data.suggestions.slice(0, 4)

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-card border border-slate-700 text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xs uppercase tracking-widest text-slate-400 font-semibold">AI Performance Prediction</h3>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70 tracking-wide font-medium">
            Powered by OpenAI
          </span>
        </div>

        {/* Main Prediction Row */}
        <div className="flex items-center gap-6">
          <div className="shrink-0 flex items-center justify-center">
             <span className={cn("text-7xl font-bold leading-none", gradeColor)}>
                {data.predicted_grade}
             </span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide", riskStyles[data.risk_level])}>
                 {data.risk_level === 'High' && (
                   <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse shadow-[0_0_8px_rgba(248,113,113,0.8)]" />
                 )}
                 {data.risk_level} Risk
              </div>
            </div>
            {data.confidence_note && (
              <p className="text-sm text-white/60 italic leading-snug">
                "{data.confidence_note}"
              </p>
            )}
          </div>
        </div>

        <div className="my-6 border-t border-white/10" />

        {/* Suggestions Section */}
        <div>
          <h4 className="text-sm font-medium text-white/80 mb-3">Recommendations</h4>
          <AnimatePresence initial={false}>
            <ul className="space-y-3">
              {visibleSuggestions.map((suggestion, idx) => (
                <motion.li 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  key={idx} 
                  className="flex items-start gap-2.5"
                >
                  <ArrowRight className="mt-0.5 shrink-0 text-brand-400" size={16} />
                  <span className="text-sm text-white/70 leading-relaxed">{suggestion}</span>
                </motion.li>
              ))}
            </ul>
          </AnimatePresence>
          
          {data.suggestions.length > 4 && (
            <button
              onClick={() => setShowAllSuggestions(!showAllSuggestions)}
              className="mt-3 text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors"
            >
              {showAllSuggestions ? 'Show less' : `+${data.suggestions.length - 4} more recommendations`}
            </button>
          )}
        </div>

      </div>
    </motion.div>
  )
}
