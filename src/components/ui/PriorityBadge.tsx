// PriorityBadge.tsx
import { PRIORITY_LABELS, type Priority } from '../../types/lead'
import { cn } from '../../utils/cn'

const styles: Record<Priority, string> = {
  muito_alta: 'bg-pink/15 text-pink',
  alta: 'bg-lime/15 text-lime',
  media: 'bg-accent/15 text-accent',
  baixa: 'bg-muted/15 text-muted',
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', styles[priority])}>
      {PRIORITY_LABELS[priority]}
    </span>
  )
}
