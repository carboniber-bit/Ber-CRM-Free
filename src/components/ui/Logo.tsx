import { cn } from '../../utils/cn'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
        <ellipse
          cx="16"
          cy="16"
          rx="10"
          ry="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          transform="rotate(-25 16 16)"
        />
        <circle cx="25" cy="9" r="3" fill="#4ade80" />
      </svg>
      <span className="text-lg font-semibold tracking-tight">Ber CRM</span>
    </span>
  )
}