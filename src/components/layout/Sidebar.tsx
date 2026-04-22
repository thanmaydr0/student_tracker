import { useLocation, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Calendar,
  Bell,
  UserCircle,
  Users,
  ClipboardCheck,
  GraduationCap,
  LogOut,
  X,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useUnreadCount } from '../../hooks/student/useNotifications'
import { cn } from '../../lib/utils'

interface SidebarProps {
  role: 'student' | 'mentor'
  isOpen: boolean
  onClose: () => void
}

interface NavItem {
  label: string
  path: string
  icon: typeof LayoutDashboard
  badge?: boolean
}

const studentNav: NavItem[] = [
  { label: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
  { label: 'Timetable', path: '/student/timetable', icon: Calendar },
  { label: 'Notifications', path: '/student/notifications', icon: Bell, badge: true },
  { label: 'Profile', path: '/profile', icon: UserCircle },
]

const mentorNav: NavItem[] = [
  { label: 'Dashboard', path: '/mentor/dashboard', icon: LayoutDashboard },
  { label: 'Attendance Log', path: '/mentor/attendance', icon: ClipboardCheck },
  { label: 'Timetable', path: '/mentor/timetable', icon: Calendar },
  { label: 'Profile', path: '/profile', icon: UserCircle },
]

export default function Sidebar({ role, isOpen, onClose }: SidebarProps) {
  const { pathname } = useLocation()
  const { user, profile, signOut } = useAuth()

  const { data: unreadCount = 0 } = useUnreadCount(user?.id)
  const links = role === 'student' ? studentNav : mentorNav

  const sidebarContent = (
    <>
      {/* Top: Logo */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-brand-50 px-6">
        <Link to={`/${role}/dashboard`} className="flex items-center gap-2" onClick={onClose}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-800">
            <GraduationCap size={18} className="text-white" strokeWidth={2} />
          </div>
          <span className="text-lg font-semibold tracking-tight text-brand-900">
            EduPredict
          </span>
        </Link>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-brand-400 hover:text-brand-600 md:hidden"
        >
          <X size={20} />
        </button>
      </div>

      {/* Middle: Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
        {links.map((link) => {
          const isActive = pathname === link.path || pathname.startsWith(link.path + '/')
          const Icon = link.icon

          return (
            <Link
              key={link.label}
              to={link.path}
              onClick={onClose}
              className={cn(
                'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'text-brand-900'
                  : 'text-brand-600 hover:bg-slate-100/80 hover:text-brand-900'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-indicator"
                  className="absolute inset-0 rounded-lg border-l-2 border-brand-600 bg-brand-50"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}

              <span className="relative z-10 flex w-full items-center justify-between">
                <span className="flex items-center gap-3">
                  <Icon
                    size={18}
                    className={cn('stroke-[2px]', isActive ? 'text-brand-700' : 'text-brand-400')}
                  />
                  {link.label}
                </span>

                {link.badge && unreadCount > 0 && (
                  <span className="flex h-5 items-center justify-center rounded-full bg-red-100 px-2 text-xs font-semibold text-red-600">
                    {unreadCount}
                  </span>
                )}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom: User Profile */}
      <div className="shrink-0 border-t border-brand-50 p-4">
        <div className="mb-2 flex items-center gap-3 px-2 py-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Profile"
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <span className="font-semibold">
                {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-brand-900">
              {profile?.full_name || 'User'}
            </span>
            <span className="truncate text-xs capitalize text-brand-500">
              {profile?.role || role}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            onClose()
            signOut()
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* ─── Desktop Sidebar (always visible, no animation) ─── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col border-r border-brand-100 bg-white md:flex">
        {sidebarContent}
      </aside>

      {/* ─── Mobile Sidebar (animated drawer) ─── */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm md:hidden"
              onClick={onClose}
            />

            {/* Drawer */}
            <motion.aside
              key="mobile-sidebar"
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col border-r border-brand-100 bg-white shadow-xl md:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
