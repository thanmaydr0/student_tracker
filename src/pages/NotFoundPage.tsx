import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-50">
      <h1 className="text-6xl font-bold text-brand-800">404</h1>
      <p className="text-lg text-brand-500">The page you're looking for doesn't exist.</p>
      <Link
        to="/"
        className="mt-4 rounded-xl bg-brand-800 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
      >
        Go Home
      </Link>
    </div>
  )
}
