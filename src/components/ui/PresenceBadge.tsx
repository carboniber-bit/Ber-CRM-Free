// PresenceBadge.tsx
import { PRESENCE_LABELS, type Presence } from '../../types/lead'
import { cn } from '../../utils/cn'

const styles: Record<Presence, string> = {
  yes: 'bg-mint/15 text-mint',
  no: 'bg-danger/15 text-danger',
  unverified: 'bg-muted/15 text-muted',
}

export function PresenceBadge({ value }: { value: Presence }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', styles[value])}>
      {PRESENCE_LABELS[value]}
    </span>
  )
}
