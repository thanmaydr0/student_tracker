import { motion } from 'framer-motion'
import { MapPin, Users, CopyPlus } from 'lucide-react'
import type { MentorTimetableSlot } from '../../hooks/mentor/useMentorTimetable'
import { format, parse } from 'date-fns'
import { cn } from '../../lib/utils'
import { useNavigate } from 'react-router-dom'

interface MentorClassBlockProps {
  slot: MentorTimetableSlot
  START_HOUR: number
  HOUR_HEIGHT: number
}

// Generate consistent background color based on class_id
function getSubjectColors(classId: string) {
  const hash = classId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const colors = [
    { bg: 'bg-blue-50/80', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-500', hover: 'hover:bg-blue-100 hover:border-blue-300' },
    { bg: 'bg-emerald-50/80', border: 'border-emerald-200', text: 'text-emerald-700', icon: 'text-emerald-500', hover: 'hover:bg-emerald-100 hover:border-emerald-300' },
    { bg: 'bg-violet-50/80', border: 'border-violet-200', text: 'text-violet-700', icon: 'text-violet-500', hover: 'hover:bg-violet-100 hover:border-violet-300' },
    { bg: 'bg-amber-50/80', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-500', hover: 'hover:bg-amber-100 hover:border-amber-300' },
    { bg: 'bg-rose-50/80', border: 'border-rose-200', text: 'text-rose-700', icon: 'text-rose-500', hover: 'hover:bg-rose-100 hover:border-rose-300' },
    { bg: 'bg-cyan-50/80', border: 'border-cyan-200', text: 'text-cyan-700', icon: 'text-cyan-500', hover: 'hover:bg-cyan-100 hover:border-cyan-300' },
  ]
  return colors[hash % colors.length]
}

export default function MentorClassBlock({ slot, START_HOUR, HOUR_HEIGHT }: MentorClassBlockProps) {
  const navigate = useNavigate()
  
  const [startHour, startMin] = slot.start_time.split(':').map(Number)
  const top = (startHour - START_HOUR) * HOUR_HEIGHT + (startMin / 60) * HOUR_HEIGHT
  const height = (slot.duration_minutes / 60) * HOUR_HEIGHT

  const formatTime = (timeStr: string) => {
    return format(parse(timeStr, 'HH:mm:ss', new Date()), 'h:mm a')
  }

  const colors = getSubjectColors(slot.class_id)

  return (
    <motion.div
      layoutId={`slot-${slot.id}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'absolute left-1 right-1 rounded-xl border p-3 shadow-sm backdrop-blur-sm transition-all sm:p-4 group cursor-pointer',
        colors.bg,
        colors.border,
        colors.text,
        colors.hover
      )}
      style={{ top, height }}
      onClick={() => navigate(`/mentor/attendance?class=${slot.class_id}&date=${format(slot.date, 'yyyy-MM-dd')}`)}
    >
      <div className="flex h-full flex-col overflow-hidden">
        {/* Title & Time */}
        <div className="flex items-start justify-between gap-1">
          <h4 className="line-clamp-2 text-xs font-bold leading-tight sm:text-sm">
            {slot.subject_name}
          </h4>
          <span className="shrink-0 text-[10px] font-semibold opacity-75 sm:text-xs">
            {formatTime(slot.start_time)}
          </span>
        </div>

        <div className="mt-auto pt-2 opacity-90 hidden sm:block">
           <div className="flex items-center gap-1.5 text-xs font-medium">
             <Users size={12} className={colors.icon} />
             <span className="line-clamp-1">{slot.branch} • Sem {slot.semester}</span>
           </div>

           {slot.location && (
             <div className="mt-1 flex items-center gap-1.5 text-[10px] sm:text-xs">
               <MapPin size={12} className={colors.icon} />
               <span className="line-clamp-1">{slot.location}</span>
             </div>
           )}
           
           <div className="mt-2 flex items-center gap-1.5 text-[10px] sm:text-xs text-brand-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
              <CopyPlus size={12} className={colors.icon} /> Take Attendance
           </div>
        </div>
      </div>
    </motion.div>
  )
}
