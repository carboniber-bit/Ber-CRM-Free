import { cn } from '../../utils/cn'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img
        src="/images/logo-carboni.png"
        alt="Carboni"
        className="h-9 w-9 shrink-0 rounded-lg object-cover"
      />
      <span className="text-lg font-semibold tracking-tight">Ber CRM</span>
    </span>
  )
}