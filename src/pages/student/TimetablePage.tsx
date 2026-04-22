import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle } from 'lucide-react'
import { format, startOfWeek, addWeeks, setDay, isToday } from 'date-fns'
import { useAuth } from '../../hooks/useAuth'
import AppShell from '../../components/layout/AppShell'
import { useTimetable } from '../../hooks/student/useTimetable'
import ClassBlock from '../../components/student/ClassBlock'
import { Skeleton } from '../../components/ui/Skeleton'
import { cn } from '../../lib/utils'

const START_HOUR = 8
const END_HOUR = 18
const HOUR_HEIGHT = 60 // pixels per hour

// Generate 8:00 to 18:00 time axis markers
const TIME_MARKS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)

export default function TimetablePage() {
  const { user } = useAuth()
  
  // Navigation State
  const [weekOffset, setWeekOffset] = useState(0)
  const [direction, setDirection] = useState(0) // -1 for left, 1 for right
  const [now, setNow] = useState(new Date())

  // Update "now" every minute for the red line
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  // Data
  const { data: slots, isLoading, isError, error } = useTimetable(user?.id, weekOffset)

  // Debug logging
  useEffect(() => {
    console.log('[TimetablePage] slots:', slots?.length, '| loading:', isLoading, '| error:', isError, error?.message)
  }, [slots, isLoading, isError, error])

  // Handlers
  const handlePrev = () => {
    setDirection(-1)
    setWeekOffset((p) => p - 1)
  }
  const handleNext = () => {
    setDirection(1)
    setWeekOffset((p) => p + 1)
  }
  const handleToday = () => {
    setDirection(weekOffset > 0 ? -1 : 1)
    setWeekOffset(0)
  }

  // Week Dates Calculation
  const weekDates = useMemo(() => {
    const start = startOfWeek(addWeeks(new Date(), weekOffset)) // defaults to Sunday start
    // If no weekend classes, just 1 to 5 (Mon-Fri). We'll assume a standard 5 day week for this university setting.
    // However, the prompt says "exclude weekends if no classes, otherwise include Sat". 
    // Let's dynamically check if there's any slot on Saturday (day 6) or Sunday (day 0)
    const hasSunday = slots?.some(s => s.day_of_week === 0)
    const hasSaturday = slots?.some(s => s.day_of_week === 6)
    
    const days = []
    const startIdx = hasSunday ? 0 : 1
    const endIdx = hasSaturday ? 6 : 5

    for (let i = startIdx; i <= endIdx; i++) {
        days.push(setDay(start, i))
    }
    return days
  }, [weekOffset, slots])

  // Current Time Line Calculation
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes()
  const currentLineTop = ((currentTotalMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT
  const showCurrentLine = currentTotalMinutes >= START_HOUR * 60 && currentTotalMinutes <= END_HOUR * 60

  // Framer Motion Variants
  const slideVariants: any = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: { duration: 0.3, ease: 'easeOut' }
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 100 : -100,
      opacity: 0,
      transition: { duration: 0.3, ease: 'easeIn' }
    })
  }

  const weekLabel = `${format(weekDates[0], 'MMM d')} – ${format(weekDates[weekDates.length - 1], 'MMM d, yyyy')}`

  return (
    <AppShell role="student">
      <div className="flex h-full flex-col">
        {/* Header Options */}
        <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Weekly Timetable</h1>
            <p className="text-sm font-medium text-slate-500">Manage your upcoming lectures and routines</p>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleToday}
              disabled={weekOffset === 0}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              Today
            </button>
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
              <button 
                onClick={handlePrev}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="flex items-center gap-2 px-3 text-sm font-semibold text-slate-700 min-w-[140px] justify-center">
                <CalendarIcon size={14} className="text-slate-400" />
                {weekLabel}
              </span>
              <button 
                onClick={handleNext}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Error State */}
        {isError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
            <div>
              <h4 className="text-sm font-semibold text-red-800">Timetable failed to load</h4>
              <p className="text-xs text-red-600 font-mono mt-1">{error?.message || 'Unknown error'}</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && (!slots || slots.length === 0) && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
            <CalendarIcon size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No classes scheduled for this week</p>
            <p className="text-xs text-slate-400 mt-1">Try navigating to a different week or check if demo data has been seeded</p>
          </div>
        )}

        {/* Calendar Area */}
        <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card flex flex-col relative bg-clip-border">
          
          {/* Day Headers */}
          <div className="flex border-b border-slate-200 bg-slate-50 relative z-10 w-full pl-16 pr-1">
             {weekDates.map(date => {
                const today = isToday(date)
                return (
                  <div key={date.toISOString()} className={cn("flex-1 px-2 py-3 text-center border-l border-slate-200", today && "bg-brand-50")}>
                    <div className={cn("text-xs font-bold uppercase tracking-wider", today ? "text-brand-600" : "text-slate-500")}>
                       {format(date, 'eee')}
                    </div>
                    <div className={cn("mt-0.5 text-lg font-medium", today ? "text-brand-900" : "text-slate-900")}>
                       {format(date, 'd')}
                    </div>
                  </div>
                )
             })}
          </div>

          <div className="flex-1 overflow-y-auto relative w-full border-r border-slate-200" style={{ minHeight: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
             
             {/* Background Grid Lines (Static via absolute positioning) */}
             <div className="absolute inset-0 pl-16 z-0">
                {TIME_MARKS.slice(0, -1).map((_, i) => (
                   <div key={`grid-${i}`} className="border-b border-slate-100 w-full" style={{ height: HOUR_HEIGHT }} />
                ))}
             </div>

             {/* Time Axis (Left Column) */}
             <div className="absolute top-0 left-0 bottom-0 w-16 bg-white z-20 overflow-hidden pt-2 border-r border-slate-200">
               {TIME_MARKS.map((hour, i) => (
                 <div 
                   key={hour} 
                   className="relative flex justify-end text-xs font-medium text-slate-400 pr-2"
                   style={{ height: i === TIME_MARKS.length - 1 ? 0 : HOUR_HEIGHT }}
                 >
                    <span className="-translate-y-2.5">
                      {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                    </span>
                 </div>
               ))}
             </div>

             {/* Animated Grid Container */}
             <div className="relative ml-16" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
                {isLoading ? (
                  <div className="absolute inset-0 p-4">
                     <Skeleton className="w-full h-[600px] rounded-xl opacity-30" />
                  </div>
                ) : (
                  <AnimatePresence initial={false} custom={direction} mode="popLayout">
                    <motion.div
                      key={weekOffset}
                      custom={direction}
                      variants={slideVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      className="w-full flex" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}
                    >
                       {weekDates.map(date => {
                          const isTodayCol = isToday(date)
                          // Filter slots for this column's day_of_week
                          const daySlots = (slots || []).filter(s => s.day_of_week === parseInt(format(date, 'i'), 10) % 7)

                          return (
                            <div key={date.toISOString()} className={cn("flex-1 relative border-l border-slate-200 first:border-0", isTodayCol && "bg-brand-50/30")}>
                               
                               {/* Current Time Line (Only for today) */}
                               {isTodayCol && showCurrentLine && (
                                  <div 
                                    className="absolute left-0 right-0 z-30 pointer-events-none flex items-center" 
                                    style={{ top: currentLineTop }}
                                  >
                                     <div className="h-2 w-2 rounded-full bg-red-500 -ml-1 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                                     <div className="h-0.5 w-full bg-red-500/50" />
                                  </div>
                               )}

                               {/* Render class blocks */}
                               {daySlots.map(slot => {
                                  const [sh, sm] = slot.start_time.split(':').map(Number)
                                  const totalMins = (sh - START_HOUR) * 60 + sm
                                  const top = (totalMins / 60) * HOUR_HEIGHT
                                  const height = (slot.duration_minutes / 60) * HOUR_HEIGHT

                                  return (
                                     <ClassBlock 
                                        key={slot.id} 
                                        slot={slot} 
                                        style={{ top, height }} 
                                     />
                                  )
                               })}
                            </div>
                          )
                       })}
                    </motion.div>
                  </AnimatePresence>
                )}
             </div>

          </div>
        </div>
      </div>
    </AppShell>
  )
}
