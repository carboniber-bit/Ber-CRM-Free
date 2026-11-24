// Textarea.tsx
import { useId, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
}

export function Textarea({
  label, error, className, id, 'aria-describedby': ariaDescribedBy, ...props
}: TextareaProps) {
  const generatedId = useId()
  const textareaId = id ?? generatedId
  const errorId = `${textareaId}-error`
  const describedBy = [ariaDescribedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={textareaId} className="text-sm font-medium text-muted">{label}</label>
      <textarea
        id={textareaId}
        className={cn(
          'min-h-24 rounded-xl border bg-elevated px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/60',
          'focus:border-primary focus:outline-none',
          error ? 'border-danger' : 'border-line',
          className,
        )}
        aria-invalid={error ? true : undefined}
        {...props}
        aria-describedby={describedBy}
      />
      {error && <p id={errorId} className="text-xs text-danger">{error}</p>}
    </div>
  )
}
