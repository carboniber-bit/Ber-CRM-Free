import { ACTIVITY_LABELS } from '../../types/activity'
import type { ClientHistoryEntry } from '../../types/client'
import { formatDateTime } from '../../lib/format'

const HISTORY_LABELS: Record<ClientHistoryEntry['type'], string> = {
  ...ACTIVITY_LABELS,
  conversion: 'Conversão em cliente',
  contact: 'Contato',
  meeting: 'Reunião',
  approval: 'Aprovação',
  status_change: 'Mudança de status',
  delivery: 'Entrega',
  financial: 'Financeiro',
  note: 'Observação',
}

export function ClientHistory({ entries }: { entries: ClientHistoryEntry[] }) {
  const ordered = [...entries].sort((a, b) =>
    b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id),
  )

  if (ordered.length === 0) {
    return <p className="text-sm text-muted">Nenhum evento registrado.</p>
  }

  return (
    <ol className="flex flex-col" aria-label="Histórico do cliente">
      {ordered.map((entry) => (
        <li key={`${entry.source}:${entry.id}`} className="flex flex-col gap-1 border-b border-line/60 py-3 last:border-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-ink">{HISTORY_LABELS[entry.type]}</span>
            <span className="rounded-full bg-elevated px-2.5 py-0.5 text-xs text-muted">
              {entry.source === 'lead' ? `Lead: ${entry.leadName ?? 'Nome não carregado'}` : 'Cliente'}
            </span>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm text-muted">{entry.description}</p>
          <time dateTime={entry.created_at} className="text-xs text-muted/70">{formatDateTime(entry.created_at)}</time>
        </li>
      ))}
    </ol>
  )
}
