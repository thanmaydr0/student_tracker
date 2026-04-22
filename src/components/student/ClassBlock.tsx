import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Clock, UserCircle } from 'lucide-react'
import type { ComputedTimetableSlot } from '../../hooks/student/useTimetable'
import { cn } from '../../lib/utils'

interface ClassBlockProps {
  slot: ComputedTimetableSlot
  style: React.CSSProperties
}

// Preset pastel color palette
const PRESET_COLORS = [
  'bg-blue-100/80 text-blue-900 border-blue-200',
  'bg-teal-100/80 text-teal-900 border-teal-200',
  'bg-purple-100/80 text-purple-900 border-purple-200',
  'bg-orange-100/80 text-orange-900 border-orange-200',
  'bg-emerald-100/80 text-emerald-900 border-emerald-200',
  'bg-rose-100/80 text-rose-900 border-rose-200',
]

// Deterministic color via string hash
function getSlotColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % PRESET_COLORS.length
  return PRESET_COLORS[index]
}

// Format 24h string "HH:MM:SS" to "h:mm a"
function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':')
  const date = new Date()
  date.setHours(parseInt(h, 10))
  date.setMinutes(parseInt(m, 10))
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function ClassBlock({ slot, style }: ClassBlockProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  const hParts = typeof style.height === 'string' ? parseFloat(style.height) : (style.height || 0)
  const isShortText = hParts < 60

  return (
    <>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(true)}
        className={cn(
          'absolute left-1 right-1 cursor-pointer overflow-hidden rounded-md border p-2 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md z-10',
          getSlotColor(slot.class_id)
        )}
        style={style}
      >
        <div className="flex flex-col h-full overflow-hidden">
          <p className="whitespace-nowrap font-bold text-xs truncate leading-tight">
            {slot.subject_name}
          </p>
          
          {!isShortText && (
            <div className="mt-1 flex flex-col gap-0.5 text-[10px] font-medium opacity-80">
              <span className="truncate">{formatTime(slot.start_time)} - {formatTime(slot.end_time)}</span>
              {slot.location && <span className="truncate flex items-center gap-1"><MapPin size={10} /> {slot.location}</span>}
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            >
              <div className="mb-4">
                <span className="mb-2 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Class Details
                </span>
                <h3 className="text-xl font-bold text-slate-900">{slot.subject_name}</h3>
              </div>

              <div className="flex flex-col gap-4 text-sm text-slate-600">
                <div className="flex items-center gap-3">
                  <Clock size={18} className="text-brand-500" />
                  <div>
                    <p className="font-semibold text-slate-900">Time</p>
                    <p>{formatTime(slot.start_time)} – {formatTime(slot.end_time)}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <UserCircle size={18} className="text-blue-500" />
                  <div>
                    <p className="font-semibold text-slate-900">Mentor</p>
                    <p>{slot.mentor_name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <MapPin size={18} className="text-emerald-500" />
                  <div>
                    <p className="font-semibold text-slate-900">Location</p>
                    <p>{slot.location || 'Not Assigned'}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
