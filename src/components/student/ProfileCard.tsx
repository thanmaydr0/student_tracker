import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { UserCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { StudentProfile } from '../../types/app.types'
import Card from '../ui/Card'
import { SkeletonCard } from '../ui/Skeleton'
import Badge from '../ui/Badge'
import Avatar from '../ui/Avatar'

interface ProfileCardProps {
  profile: StudentProfile | null | undefined
  loading?: boolean
}

export default function ProfileCard({ profile, loading }: ProfileCardProps) {
  // Query for mentor's name if the student has a mentor assigned
  const { data: mentorName, isLoading: mentorLoading } = useQuery({
    queryKey: ['mentor', profile?.mentor_id],
    queryFn: async () => {
      if (!profile?.mentor_id) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', profile.mentor_id)
        .single()
      
      if (error) throw error
      return data.full_name
    },
    enabled: !!profile?.mentor_id,
  })

  // Show skeleton if the main profile is explicitly marked loading or hasn't arrived
  if (loading || !profile) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <SkeletonCard />
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar
          name={profile.full_name}
          url={profile.avatar_url}
          size="lg"
          userId={profile.id}
          className="ring-4 ring-brand-50"
        />

        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-brand-900">{profile.full_name}</h2>
            <Badge variant="info">Student</Badge>
          </div>

          <div className="flex flex-wrap items-center text-sm font-medium text-brand-500">
            <span>{profile.branch}</span>
            <span className="mx-2 h-1 w-1 rounded-full bg-slate-300" />
            <span>Semester {profile.semester}</span>
          </div>

          <div className="mt-1 flex items-center gap-1.5 text-sm text-brand-600">
            <UserCircle size={16} className="text-brand-400" />
            <span className="font-medium text-brand-500">Mentor:</span>
            {mentorLoading ? (
              <span className="h-4 w-24 animate-pulse rounded bg-slate-100" />
            ) : (
              <span className="font-semibold text-brand-700">
                {mentorName || 'Unassigned'}
              </span>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
