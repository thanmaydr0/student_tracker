import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Mail, Lock, User, GraduationCap, BookOpen } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { cn } from '../../lib/utils'

const semesters = [1, 2, 3, 4, 5, 6, 7, 8] as const

interface FieldErrors {
  full_name?: string
  email?: string
  password?: string
  confirm?: string
  branch?: string
}

export default function SignUpPage() {
  const { signUp } = useAuth()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [role, setRole] = useState<'student' | 'mentor'>('student')
  const [branch, setBranch] = useState('')
  const [semester, setSemester] = useState(1)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitted, setSubmitted] = useState(false)

  function validate(): boolean {
    const errs: FieldErrors = {}

    if (!fullName.trim()) errs.full_name = 'Full name is required'
    if (!email.trim()) errs.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = 'Enter a valid email address'

    if (!password) errs.password = 'Password is required'
    else if (password.length < 6) errs.password = 'Min 6 characters'

    if (password !== confirm) errs.confirm = 'Passwords don\'t match'

    if (!branch.trim()) errs.branch = 'Branch is required'

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      await signUp(email, password, {
        full_name: fullName.trim(),
        role,
        branch: branch.trim(),
        semester,
      })

      setSubmitted(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign-up failed. Please try again.'
      toast.error(message, {
        style: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' },
      })
    } finally {
      setLoading(false)
    }
  }

  // — Success screen after signup —
  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-surface-50 via-brand-50 to-surface-100 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <div className="rounded-2xl border border-brand-100 bg-white/80 p-8 text-center shadow-card backdrop-blur-sm sm:p-10">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <Mail size={28} className="text-green-600" strokeWidth={1.8} />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-brand-900">Check your email</h2>
            <p className="mb-6 text-sm leading-relaxed text-brand-400">
              We sent a confirmation link to{' '}
              <span className="font-medium text-brand-700">{email}</span>.
              <br />
              Click the link to activate your account.
            </p>
            <Link
              to="/auth/login"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-800 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
            >
              Go to Sign In
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-surface-50 via-brand-50 to-surface-100 px-4 py-10">
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
              Create your account
            </h1>
            <p className="text-sm text-brand-400">
              Join Edu<span className="font-medium text-brand-600">Predict</span> today
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Full Name */}
            <Input
              label="Full Name"
              icon={User}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={errors.full_name}
              autoComplete="name"
            />

            {/* Email */}
            <Input
              label="Email address"
              type="email"
              icon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              autoComplete="email"
            />

            {/* Password */}
            <Input
              label="Password"
              type="password"
              icon={Lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              autoComplete="new-password"
            />

            {/* Confirm Password */}
            <Input
              label="Confirm Password"
              type="password"
              icon={Lock}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={errors.confirm}
              autoComplete="new-password"
            />

            {/* Role Selector */}
            <div>
              <label className="mb-2 block text-xs font-medium text-brand-500">
                I am a
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['student', 'mentor'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200',
                      role === r
                        ? 'border-brand-700 bg-brand-800 text-white shadow-sm'
                        : 'border-brand-200 bg-white text-brand-600 hover:border-brand-300 hover:bg-brand-50'
                    )}
                  >
                    {r === 'student' ? (
                      <BookOpen size={16} strokeWidth={1.8} />
                    ) : (
                      <GraduationCap size={16} strokeWidth={1.8} />
                    )}
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Branch */}
            <Input
              label="Branch (e.g. Computer Science)"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              error={errors.branch}
            />

            {/* Semester pill selector */}
            <div>
              <label className="mb-2 block text-xs font-medium text-brand-500">
                Semester
              </label>
              <div className="flex flex-wrap gap-1.5">
                {semesters.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSemester(s)}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-all duration-150',
                      semester === s
                        ? 'bg-brand-800 text-white shadow-sm'
                        : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              loading={loading}
              fullWidth
              size="lg"
              className="mt-2"
            >
              Create Account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-brand-400">
            Already have an account?{' '}
            <Link
              to="/auth/login"
              className="font-medium text-brand-700 underline-offset-2 transition-colors hover:text-brand-900 hover:underline"
            >
              Sign in
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
