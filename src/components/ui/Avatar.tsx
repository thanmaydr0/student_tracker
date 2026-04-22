import { type HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  name: string
  url?: string | null
  size?: 'sm' | 'md' | 'lg'
  userId?: string // Optional, for generating a deterministic color if name isn't unique enough
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-16 w-16 text-lg',
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

// Generate a deterministic hue based on a string
function getHue(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % 360
}

export default function Avatar({
  name,
  url,
  size = 'md',
  userId = '',
  className,
  ...props
}: AvatarProps) {
  const initials = getInitials(name)
  const hue = getHue(userId || name)
  
  // Use a subtle distinct gradient
  const background = `linear-gradient(135deg, hsl(${hue}, 80%, 75%), hsl(${hue + 40}, 80%, 65%))`

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white shadow-sm',
        sizeClasses[size],
        className
      )}
      style={{ background: url ? undefined : background }}
      {...props}
    >
      {url ? (
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}
