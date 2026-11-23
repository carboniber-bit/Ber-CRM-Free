import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'mint' | 'ghost' | 'outline' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-bg hover:bg-primary/85',
  mint: 'bg-mint text-bg hover:bg-mint/85',
  ghost: 'bg-transparent text-muted hover:bg-elevated hover:text-ink',
  outline: 'border border-line bg-surface text-ink hover:bg-elevated',
  danger: 'bg-danger text-bg hover:bg-danger/85',
}

export function Button({
  variant = 'primary',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4 text-current" />}
      {children}
    </button>
  )
}