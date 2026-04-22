import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

const variants = {
  primary:
    'bg-brand-800 text-white hover:bg-brand-700 active:bg-brand-900 focus-visible:ring-brand-600/30',
  secondary:
    'bg-brand-100 text-brand-800 hover:bg-brand-200 active:bg-brand-300 focus-visible:ring-brand-400/30',
  ghost:
    'bg-transparent text-brand-600 hover:bg-brand-50 active:bg-brand-100 focus-visible:ring-brand-400/20',
  danger:
    'bg-red-600 text-white hover:bg-red-500 active:bg-red-700 focus-visible:ring-red-500/30',
} as const

const sizes = {
  sm: 'h-9 px-3.5 text-xs gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
} as const

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  loading?: boolean
  fullWidth?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'relative inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading && (
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        <span className={cn(loading && 'ml-0.5')}>{children}</span>
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
