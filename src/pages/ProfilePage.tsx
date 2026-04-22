import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { User, Mail, BookOpen, Hash, UserCircle, Save, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { useStudentProfile } from '../hooks/student/useStudentProfile'
import { supabase } from '../lib/supabase'
import AppShell from '../components/layout/AppShell'
import Card from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import { Skeleton } from '../components/ui/Skeleton'
import { cn } from '../lib/utils'
import { useQueryClient } from '@tanstack/react-query'

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

export default function ProfilePage() {
  const { user, profile: authProfile } = useAuth()
  const role = authProfile?.role || 'student'
  const { data: profile, isLoading } = useStudentProfile(user?.id)
  const queryClient = useQueryClient()

  const [fullName, setFullName] = useState('')
  const [branch, setBranch] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Initialize form when profile loads
  const initForm = () => {
    if (profile) {
      setFullName(profile.full_name || '')
      setBranch(profile.branch || '')
    }
  }

  const startEditing = () => {
    initForm()
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!user?.id) return

    if (!fullName.trim()) {
      toast.error('Name cannot be empty')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          branch: branch.trim(),
        })
        .eq('id', user.id)

      if (error) throw error

      toast.success('Profile updated successfully')
      setIsEditing(false)
      // Invalidate queries to refetch 
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update profile'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <AppShell role={role as 'student' | 'mentor'}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Card className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </Card>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell role={role as 'student' | 'mentor'}>
      <motion.div
        className="flex flex-col gap-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-brand-900 sm:text-3xl">Profile</h1>
          <p className="text-sm font-medium text-brand-500">Manage your personal information</p>
        </motion.div>

        {/* Profile Card */}
        <motion.div variants={itemVariants}>
          <Card>
            {/* Avatar + Name Banner */}
            <div className="flex flex-col items-center gap-4 pb-6 sm:flex-row sm:items-start">
              <Avatar
                name={profile?.full_name || 'User'}
                url={profile?.avatar_url}
                size="lg"
                userId={profile?.id}
                className="ring-4 ring-brand-50 h-20 w-20 text-xl"
              />
              <div className="flex flex-1 flex-col items-center gap-1 sm:items-start">
                <h2 className="text-xl font-bold text-brand-900">{profile?.full_name || 'User'}</h2>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-brand-700">
                    {profile?.role}
                  </span>
                  <span className="text-sm text-brand-500">
                    Joined {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Unknown'}
                  </span>
                </div>
              </div>

              {!isEditing && (
                <button
                  onClick={startEditing}
                  className="flex items-center gap-2 rounded-lg border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-600 shadow-sm transition-colors hover:bg-brand-50"
                >
                  Edit Profile
                </button>
              )}
            </div>

            <div className="border-t border-slate-100" />

            {/* Info or Edit Form */}
            {isEditing ? (
              <form onSubmit={handleSave} className="mt-6 flex flex-col gap-5">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-brand-400">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-lg border border-brand-200 bg-white px-4 py-2.5 text-sm text-brand-900 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-brand-400">
                    Branch
                  </label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full rounded-lg border border-brand-200 bg-white px-4 py-2.5 text-sm text-brand-900 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-brand-800 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <Save size={16} />
                    )}
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="rounded-lg border border-brand-200 px-5 py-2.5 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <InfoField icon={User} label="Full Name" value={profile?.full_name} />
                <InfoField icon={Mail} label="Email" value={user?.email} />
                <InfoField icon={BookOpen} label="Branch" value={profile?.branch} />
                <InfoField icon={Hash} label="Semester" value={profile?.semester ? `Semester ${profile.semester}` : undefined} />
                <InfoField
                  icon={UserCircle}
                  label="Role"
                  value={profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : undefined}
                />
              </div>
            )}
          </Card>
        </motion.div>

        {/* Account Info Card */}
        <motion.div variants={itemVariants}>
          <Card title="Account Details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-2">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-400 mb-1">User ID</p>
                <p className="text-sm font-mono text-brand-700 break-all">{user?.id || '—'}</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-400 mb-1">Authentication</p>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-500" />
                  <p className="text-sm font-medium text-brand-700">Email verified</p>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </AppShell>
  )
}

// Reusable Info Field component
function InfoField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User
  label: string
  value: string | undefined | null
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50">
        <Icon size={16} className="text-brand-500" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-brand-900">{value || '—'}</p>
      </div>
    </div>
  )
}
