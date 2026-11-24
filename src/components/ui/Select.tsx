// Select.tsx
import { useId, type SelectHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  options: Array<{ value: string; label: string }>
  placeholder?: string
}

export function Select({
  label, error, options, placeholder, className, id, 'aria-describedby': ariaDescribedBy, ...props
}: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const errorId = `${selectId}-error`
  const describedBy = [ariaDescribedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-medium text-muted">{label}</label>
      <select
        id={selectId}
        className={cn(
          'h-11 rounded-xl border bg-elevated px-3.5 text-sm text-ink',
          'focus:border-primary focus:outline-none',
          error ? 'border-danger' : 'border-line',
          className,
        )}
        aria-invalid={error ? true : undefined}
        {...props}
        aria-describedby={describedBy}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {error && <p id={errorId} className="text-xs text-danger">{error}</p>}
    </div>
  )
}
