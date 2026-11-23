import type { HTMLAttributes } from 'react'
import { cn } from '../../utils/cn'
import { StatusDot, type DotColor } from './StatusDot'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  dot?: DotColor
}

export function Card({ title, dot, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn('rounded-2xl border border-line bg-surface p-5', className)}
      {...props}
    >
      {title && (
        <div className="mb-4 flex items-center gap-2.5">
          {dot && <StatusDot color={dot} />}
          <h2 className="font-display text-sm font-semibold text-ink">{title}</h2>
        </div>
      )}
      {children}
    </div>
  )
}