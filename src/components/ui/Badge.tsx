import { type HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export type BadgeVariant = 'low' | 'medium' | 'high' | 'info' | 'success'

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant: BadgeVariant
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  low: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  success: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  medium: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
  },
  high: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
  },
  info: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
  },
}

export default function Badge({ variant, className, children, ...props }: BadgeProps) {
  const styles = variantStyles[variant]

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        styles.bg,
        styles.text,
        className
      )}
      {...props}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', styles.dot)} />
      {children}
    </div>
  )
}
