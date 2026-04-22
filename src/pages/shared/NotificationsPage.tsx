import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { isToday, isYesterday, format, formatDistanceToNow } from 'date-fns'
import { Bell, TrendingDown, Info, CheckCircle2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import AppShell from '../../components/layout/AppShell'
import { supabase } from '../../lib/supabase'
import { useNotifications, useMarkNotificationsRead, useUnreadCount } from '../../hooks/student/useNotifications'
import { Skeleton } from '../../components/ui/Skeleton'
import { cn } from '../../lib/utils'
import type { NotificationItem } from '../../types/app.types'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const itemVariants: any = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.2 } }
}

export default function NotificationsPage() {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()

  // Queries & Mutations
  const { data: notifications, isLoading } = useNotifications(user?.id)
  const { data: unreadCount } = useUnreadCount(user?.id)
  const markReadMutation = useMarkNotificationsRead()

  const [hasMarkedRead, setHasMarkedRead] = useState(false)

  // Real-time updates subscription
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Invalidate notifications block immediately to spawn them sequentially live
          queryClient.invalidateQueries({ queryKey: ['notifications', user.id] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, queryClient])

  // Mark all read automatically after 2 seconds
  useEffect(() => {
    if (notifications && notifications.length > 0 && unreadCount && unreadCount > 0 && !hasMarkedRead) {
      const timer = setTimeout(() => {
        if (user?.id) {
          markReadMutation.mutate(user.id)
          setHasMarkedRead(true)
        }
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [notifications, unreadCount, markReadMutation, user?.id, hasMarkedRead])

  // Manual mark all read
  const handleMarkAllRead = () => {
    if (user?.id) markReadMutation.mutate(user.id)
  }

  // Grouping notifications by date
  const groupedNotifications = useMemo(() => {
    if (!notifications) return []

    const groups: { label: string; items: NotificationItem[] }[] = [
      { label: 'Today', items: [] },
      { label: 'Yesterday', items: [] },
      { label: 'Older', items: [] }
    ]

    notifications.forEach(item => {
      const date = new Date(item.created_at)
      if (isToday(date)) {
        groups[0].items.push(item)
      } else if (isYesterday(date)) {
        groups[1].items.push(item)
      } else {
        groups[2].items.push(item)
      }
    })

    return groups.filter(g => g.items.length > 0)
  }, [notifications])

  // Type rendering map
  const renderIcon = (type: string) => {
    switch (type) {
      case 'attendance_risk':
        return <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0"><Bell size={18} className="text-red-500" /></div>
      case 'grade_alert':
        return <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0"><TrendingDown size={18} className="text-orange-500" /></div>
      default:
        return <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0"><Info size={18} className="text-blue-500" /></div>
    }
  }

  const formatItemDate = (dateStr: string, label: string) => {
    const date = new Date(dateStr)
    if (label === 'Today') return format(date, 'h:mm a')
    if (label === 'Yesterday') return `Yesterday at ${format(date, 'h:mm a')}`
    return `${format(date, 'MMM d')} at ${format(date, 'h:mm a')}`
  }

  return (
    <AppShell role={profile?.role as 'student' | 'mentor'}>
      <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-10">

        {/* Header */}
        <div className="flex items-end justify-between border-b border-slate-200 pb-4">
           <div>
             <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <Bell className="text-brand-600" /> Notification Center
             </h1>
             <p className="mt-1 text-sm font-medium text-slate-500 flex items-center gap-2">
               You have <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">{unreadCount || 0}</span> unread messages
             </p>
           </div>
           {unreadCount !== 0 && (
             <button 
               onClick={handleMarkAllRead} 
               disabled={markReadMutation.isPending}
               className="text-sm font-semibold text-brand-600 hover:text-brand-800 hover:underline transition hidden sm:block"
             >
               Mark all as read
             </button>
           )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
             {Array.from({length: 4}).map((_,i) => (
                <div key={i} className="flex gap-4 p-4 rounded-2xl border border-slate-100 bg-white">
                   <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                   <div className="space-y-2 w-full">
                      <Skeleton className="h-5 w-1/3" />
                      <Skeleton className="h-4 w-full" />
                   </div>
                </div>
             ))}
          </div>
        ) : notifications?.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-sm border border-slate-200"
          >
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={32} className="text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">You're all caught up!</h2>
            <p className="text-slate-500 font-medium mt-1">No new notifications to show here.</p>
          </motion.div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            <AnimatePresence>
              {groupedNotifications.map(group => (
                <motion.div key={group.label} layout className="space-y-4">
                   <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 pl-1">{group.label}</h3>
                   <div className="space-y-3">
                     <AnimatePresence>
                       {group.items.map(item => (
                         <motion.div 
                           key={item.id}
                           variants={itemVariants}
                           layout
                           className={cn(
                             "flex sm:items-center items-start gap-4 p-4 rounded-2xl border transition-colors cursor-default relative overflow-hidden",
                             !item.is_read ? "bg-brand-50/50 border-brand-200" : "bg-white border-slate-200 hover:bg-slate-50"
                           )}
                         >
                            {renderIcon(item.type)}
                            
                            <div className="flex-1 w-full pt-0.5">
                               <div className="flex sm:items-center items-start justify-between gap-4 flex-col sm:flex-row">
                                  <h4 className={cn("text-base", !item.is_read ? "font-bold text-slate-900" : "font-semibold text-slate-800")}>
                                    {item.title}
                                  </h4>
                                  <div className="flex items-center gap-2 sm:ml-auto shrink-0">
                                     <span className="text-xs font-semibold text-slate-400">
                                       {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                                     </span>
                                     {!item.is_read && <div className="w-2 h-2 rounded-full bg-brand-500 shadow-sm" />}
                                  </div>
                               </div>
                               <p className="text-sm text-slate-500 mt-1 leading-relaxed pr-6">{item.body}</p>
                               <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-widest mt-2 block sm:hidden">
                                  {formatItemDate(item.created_at, group.label)}
                               </span>
                            </div>
                         </motion.div>
                       ))}
                     </AnimatePresence>
                   </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

      </div>
    </AppShell>
  )
}
