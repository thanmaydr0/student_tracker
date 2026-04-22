import { cn } from '../../lib/utils'
import Card from './Card'

interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
}

export function Skeleton({ className, width, height }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-slate-100', className)}
      style={{ width, height }}
    />
  )
}

export function SkeletonCard() {
  return (
    <Card className="flex flex-col gap-4">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
    </Card>
  )
}
