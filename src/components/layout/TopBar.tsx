import { useState } from 'react'
import { motion, useScroll, useMotionValueEvent } from 'framer-motion'
import { Menu, Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useUnreadCount } from '../../hooks/student/useNotifications'

interface TopBarProps {
  onMenuClick: () => void
  title: string
}

export default function TopBar({ onMenuClick, title }: TopBarProps) {
  const { scrollY } = useScroll()
  const [hidden, setHidden] = useState(false)
  const { user, profile } = useAuth()
  
  const { data: unreadCount = 0 } = useUnreadCount(user?.id)

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const previous = scrollY.getPrevious() ?? 0
    if (latest > previous && latest > 50) {
      setHidden(true)
    } else {
      setHidden(false)
    }
  })

  return (
    <motion.header
      variants={{
        visible: { y: 0 },
        hidden: { y: '-100%' },
      }}
      animate={hidden ? 'hidden' : 'visible'}
      transition={{ duration: 0.35, ease: 'easeInOut' }}
      className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-brand-100 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-md md:hidden"
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-brand-600 transition-colors hover:bg-brand-50"
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>
        <h1 className="text-lg font-semibold text-brand-900 line-clamp-1">{title}</h1>
      </div>

      <Link
        to={`/${profile?.role || 'student'}/notifications`}
        className="relative rounded-full p-2 text-brand-500 hover:bg-brand-50 hover:text-brand-700"
      >
        <Bell size={22} className="stroke-[1.8]" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />
        )}
      </Link>
    </motion.header>
  )
}
