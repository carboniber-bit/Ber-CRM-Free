import { useDroppable } from '@dnd-kit/core'
import { STATUS_LABELS, type Lead, type LeadStatus } from '../../types/lead'
import { KanbanCard } from './KanbanCard'
import { cn } from '../../utils/cn'

export function KanbanColumn({ status, leads }: { status: LeadStatus; leads: Lead[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={STATUS_LABELS[status]}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-2xl border border-line bg-surface p-3 transition-colors',
        isOver && 'border-primary/60 bg-primary/5',
      )}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="font-display text-xs font-semibold uppercase tracking-wide text-muted">{STATUS_LABELS[status]}</h3>
        <span className="rounded-full bg-elevated px-2 py-0.5 text-xs text-muted">{leads.length}</span>
      </div>
      <div className="flex min-h-24 flex-col gap-2">
        {leads.map((lead) => <KanbanCard key={lead.id} lead={lead} />)}
        {leads.length === 0 && (
          <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-muted/60">Arraste leads para cá</p>
        )}
      </div>
    </div>
  )
}
