import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Mail, Lock, GraduationCap } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

export default function LoginPage() {
  const { signIn, user, profile } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Redirect when user is authenticated AND profile is loaded
  useEffect(() => {
    if (user && profile) {
      const dashPath = profile.role === 'mentor' ? '/mentor/dashboard' : '/student/dashboard'
      navigate(dashPath, { replace: true })
    }
  }, [user, profile, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please fill in all fields.')
      return
    }

    setLoading(true)
    try {
      await signIn(email, password)
      // onAuthStateChange will set user + profile,
      // then the useEffect above will handle the redirect
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.'
      toast.error(message, {
        style: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' },
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-surface-50 via-brand-50 to-surface-100 px-4">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 40L40 0M-10 10L10 -10M30 50L50 30' stroke='%23334155' stroke-width='1'/%3E%3C/svg%3E")`,
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <div className="rounded-2xl border border-brand-100 bg-white/80 p-8 shadow-card backdrop-blur-sm sm:p-10">
          {/* Logo */}
          <div className="mb-8 flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-800">
              <GraduationCap size={24} className="text-white" strokeWidth={1.8} />
            </div>
            <h1 className="text-xl font-semibold text-brand-900">
              Edu<span className="text-brand-600">Predict</span>
            </h1>
            <p className="text-sm text-brand-400">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email address"
              type="email"
              icon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <Input
              label="Password"
              type="password"
              icon={Lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            <Button
              type="submit"
              loading={loading}
              fullWidth
              size="lg"
              className="mt-2"
            >
              Sign In
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-brand-400">
            Don&apos;t have an account?{' '}
            <Link
              to="/auth/signup"
              className="font-medium text-brand-700 underline-offset-2 transition-colors hover:text-brand-900 hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-brand-300">
          © {new Date().getFullYear()} EduPredict · Academic Intelligence
        </p>
      </motion.div>
    </div>
  )
}
