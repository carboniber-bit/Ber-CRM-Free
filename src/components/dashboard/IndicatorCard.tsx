import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'

interface IndicatorCardProps {
  label: string
  value: number
  icon: LucideIcon
  tone?: 'default' | 'primary' | 'danger' | 'lime' | 'accent' | 'pink'
}

const tones = {
  default: 'text-ink',
  primary: 'text-primary',
  danger: 'text-danger',
  lime: 'text-lime',
  accent: 'text-accent',
  pink: 'text-pink',
}

/**
 * Um número real vindo de `computeIndicators`. O cartão é um grupo nomeado pelo rótulo: quem lê
 * com leitor de tela ou consulta em teste obtém rótulo e valor juntos, sem depender de posição.
 */
export function IndicatorCard({ label, value, icon: Icon, tone = 'default' }: IndicatorCardProps) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4" role="group" aria-label={label}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{label}</span>
        <Icon className={cn('h-4 w-4 shrink-0', tones[tone])} />
      </div>
      <p className={cn('mt-2 font-display text-2xl font-bold', tones[tone])}>{value}</p>
    </div>
  )
}
