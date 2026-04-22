import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks } from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar, AlertTriangle } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import AppShell from '../../components/layout/AppShell'
import MentorClassBlock from '../../components/mentor/MentorClassBlock'
import { useMentorTimetable } from '../../hooks/mentor/useMentorTimetable'
import { Skeleton } from '../../components/ui/Skeleton'
import { cn } from '../../lib/utils'

const START_HOUR = 8 // 8 AM
const END_HOUR = 18 // 6 PM
const HOUR_HEIGHT = 60 // pixels per hour

export default function TimetableManagePage() {
  const { user } = useAuth()
  const [weekOffset, setWeekOffset] = useState(0)
  const [direction, setDirection] = useState(0) // 1 for next, -1 for prev

  const { data: slots, isLoading, isError } = useMentorTimetable(user?.id, weekOffset)

  // Calculate grid layout sizes
  const totalHours = END_HOUR - START_HOUR
  const gridHeight = totalHours * HOUR_HEIGHT
  const timeLabels = Array.from({ length: totalHours + 1 }, (_, i) => START_HOUR + i)

  // Calculate current week dates (Mon-Sat)
  const weekDates = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 })
    const targetStart = addWeeks(start, weekOffset)
    return Array.from({ length: 6 }, (_, i) => addDays(targetStart, i))
  }, [weekOffset])

  const handlePrevWeek = () => {
    setDirection(-1)
    setWeekOffset(prev => prev - 1)
  }

  const handleNextWeek = () => {
    setDirection(1)
    setWeekOffset(prev => prev + 1)
  }

  const handleToday = () => {
    setDirection(weekOffset > 0 ? -1 : 1)
    setWeekOffset(0)
  }

  const isToday = (date: Date) => isSameDay(date, new Date())

  // Framer motion variants for sliding
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 100 : -100,
      opacity: 0,
      position: 'absolute' as const
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      position: 'relative' as const
    },
    exit: (dir: number) => ({
      zIndex: 0,
      x: dir < 0 ? 100 : -100,
      opacity: 0,
      position: 'absolute' as const
    })
  }

  return (
    <AppShell role="mentor">
      <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-10 h-full">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-brand-900 sm:text-3xl flex items-center gap-2">
              <Calendar className="text-brand-600" /> Teaching Schedule
            </h1>
            <p className="mt-1 text-sm font-medium text-brand-500">
              Manage your assigned classes and log attendance across all branches.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-fit">
            <button
              onClick={handlePrevWeek}
              className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={handleToday}
              className={cn(
                "px-4 py-1.5 text-sm font-bold rounded-lg transition",
                weekOffset === 0 ? "bg-brand-100 text-brand-700" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              This Week
            </button>
            <button
              onClick={handleNextWeek}
              className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Error State */}
        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-500 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-red-800">Failed to load schedule</h3>
              <p className="text-sm text-red-700 mt-0.5">There was an error communicating with the database. Please try refreshing the page.</p>
            </div>
          </div>
        )}

        {/* Empty State / Not Assigned */}
        {!isLoading && !isError && slots?.length === 0 && weekOffset === 0 && (
           <div className="bg-brand-50 border border-brand-200 rounded-xl p-6 text-center">
             <Calendar size={32} className="mx-auto text-brand-400 mb-2" />
             <h3 className="font-bold text-brand-900 text-lg">No Classes Assigned</h3>
             <p className="text-brand-600 mt-1">You currently don't have any classes assigned to you for teaching this semester.</p>
           </div>
        )}

        {/* Timetable Grid */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-[600px]">
          
          {/* Days Header */}
          <div className="flex border-b border-slate-200 bg-slate-50">
             <div className="w-16 shrink-0 border-r border-slate-200 bg-slate-50/50" />
             {weekDates.map((date) => {
                const today = isToday(date)
                return (
                  <div key={date.toString()} className="flex-1 border-r border-slate-200 last:border-r-0 py-3 text-center">
                    <div className={cn("text-xs font-bold uppercase tracking-wider", today ? "text-brand-600" : "text-slate-500")}>
                       {format(date, 'EEE')}
                    </div>
                    <div className={cn("mt-0.5 text-lg font-medium", today ? "text-brand-900" : "text-slate-900")}>
                       {format(date, 'd')}
                    </div>
                  </div>
                )
             })}
          </div>

          {/* Grid Area */}
          <div className="flex-1 overflow-y-auto relative w-full border-r border-slate-200" style={{ minHeight: gridHeight }}>
             
             {/* Grid Lines */}
             <div className="absolute inset-0 pl-16 z-0">
               {timeLabels.map(hour => (
                 <div key={hour} className="border-b border-slate-100 flex items-start" style={{ height: HOUR_HEIGHT }}></div>
               ))}
             </div>

             {/* Time Axis */}
             <div className="absolute left-0 top-0 bottom-0 w-16 border-r border-slate-200 bg-white/80 backdrop-blur z-10 flex flex-col">
               {timeLabels.map(hour => (
                 <div key={hour} suppressHydrationWarning className="relative flex items-start justify-center text-[10px] font-semibold text-slate-400 -mt-2" style={{ height: HOUR_HEIGHT }}>
                   {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                 </div>
               ))}
             </div>

             {/* Animated Grid Container */}
             <div className="relative ml-16 overflow-hidden" style={{ height: gridHeight }}>
                {isLoading ? (
                  <div className="absolute inset-0 p-4">
                     <Skeleton className="w-full h-full rounded-xl opacity-30" />
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
                      className="w-full flex" style={{ height: gridHeight }}
                    >
                       {weekDates.map(date => {
                          const isTodayCol = isToday(date)
                          // Filter slots for this specific date
                          const daySlots = slots?.filter(s => isSameDay(new Date(s.date), date)) || []

                          return (
                            <div 
                              key={date.toString()} 
                              className={cn(
                                "flex-1 relative border-r border-slate-100 last:border-r-0 transition-colors",
                                isTodayCol ? "bg-brand-50/20" : ""
                              )}
                            >
                               <AnimatePresence>
                                 {daySlots.map(slot => (
                                   <MentorClassBlock 
                                     key={slot.id} 
                                     slot={slot} 
                                     START_HOUR={START_HOUR} 
                                     HOUR_HEIGHT={HOUR_HEIGHT} 
                                   />
                                 ))}
                               </AnimatePresence>
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
