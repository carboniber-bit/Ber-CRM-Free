// StatusBadge.tsx
import { STATUS_LABELS, type LeadStatus } from '../../types/lead'
import { cn } from '../../utils/cn'

const styles: Record<LeadStatus, string> = {
  novo: 'bg-accent/15 text-accent',
  contato_realizado: 'bg-accent/15 text-accent',
  aguardando_resposta: 'bg-lime/15 text-lime',
  pediu_informacoes: 'bg-lime/15 text-lime',
  interessado: 'bg-primary/15 text-primary',
  negociando: 'bg-primary/15 text-primary',
  aceitou: 'bg-mint/15 text-mint',
  ignorou: 'bg-muted/15 text-muted',
  nao_interessado: 'bg-danger/15 text-danger',
  follow_up: 'bg-pink/15 text-pink',
  perdido: 'bg-danger/15 text-danger',
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', styles[status])}>
      {STATUS_LABELS[status]}
    </span>
  )
}
