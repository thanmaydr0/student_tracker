import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { NotificationItem } from '../../types/app.types'

export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required')

      // Fetch user_notifications and join with notification_messages
      const { data, error } = await supabase
        .from('user_notifications')
        .select('*, notification_messages!inner(*)')
        .eq('user_id', userId)
        // We order by the message creation date, so we sort on the joined table
        .order('created_at', { referencedTable: 'notification_messages', ascending: false })
        .limit(20)

      if (error) throw error

      // Transform to match NotificationItem interface
      return (data || []).map((row: any) => ({
        id: row.id,
        message_id: row.message_id,
        title: row.notification_messages.title,
        body: row.notification_messages.body,
        type: row.notification_messages.type,
        deep_link: row.notification_messages.deep_link,
        is_read: row.is_read,
        created_at: row.notification_messages.created_at, // Use message date
      })) as NotificationItem[]
    },
    enabled: !!userId,
  })
}

export function useUnreadCount(userId: string | undefined) {
  return useQuery({
    queryKey: ['notifications', userId, 'unread-count'],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required')

      const { count, error } = await supabase
        .from('user_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false)

      if (error) throw error

      return count || 0
    },
    enabled: !!userId,
  })
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('mark_notifications_read', {
        p_user_id: userId,
      })
      if (error) throw error
    },
    onSuccess: (_, userId) => {
      // Invalidate both the list and the unread count
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
    },
  })
}
