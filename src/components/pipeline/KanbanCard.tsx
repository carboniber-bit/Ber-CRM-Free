import { useDraggable } from '@dnd-kit/core'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Phone } from 'lucide-react'
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import { NICHE_LABELS, type Lead, type Niche } from '../../types/lead'
import { formatBRL, formatDate, formatPhone } from '../../lib/format'
import { PriorityBadge } from '../ui/PriorityBadge'
import { cn } from '../../utils/cn'

export interface KanbanCardDrag {
  setNodeRef: (node: HTMLElement | null) => void
  attributes: DraggableAttributes
  listeners: DraggableSyntheticListeners
}

interface KanbanCardBodyProps {
  lead: Lead
  drag?: KanbanCardDrag
  dragging?: boolean
  style?: CSSProperties
}

const cardClasses = 'rounded-xl border border-line bg-elevated p-3 text-sm transition-shadow'
// cursor-grab/touch-none só fazem sentido onde há arraste: no mobile o toque rola a página.
const dragClasses = 'cursor-grab touch-none active:cursor-grabbing'

/**
 * Corpo do card: só apresentação. Vive com ou sem `DndContext` — por isso o arraste
 * (useDraggable) fica no wrapper `KanbanCard`, nunca em quem não tem contexto.
 */
export function KanbanCardBody({ lead, drag, dragging = false, style }: KanbanCardBodyProps) {
  return (
    <div
      ref={drag?.setNodeRef}
      style={style}
      {...drag?.attributes}
      {...drag?.listeners}
      className={cn(cardClasses, drag && dragClasses, dragging && 'opacity-60 shadow-lg shadow-black/50')}
    >
      <Link to={`/leads/${lead.id}`} className="font-medium text-ink hover:text-primary" onClick={(e) => e.stopPropagation()}>
        {lead.name}
      </Link>
      <p className="mt-0.5 text-xs text-muted">{lead.niche ? NICHE_LABELS[lead.niche as Niche] ?? lead.niche : 'Sem nicho'}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <PriorityBadge priority={lead.priority} />
        <span className="text-xs text-muted">{formatBRL(lead.estimated_value)}</span>
      </div>
      <div className="mt-2 flex flex-col gap-1 text-xs text-muted">
        {lead.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {formatPhone(lead.phone)}</span>}
        {lead.next_contact_at && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" /> {formatDate(lead.next_contact_at)}</span>}
      </div>
    </div>
  )
}

/** Card arrastável do quadro: precisa estar dentro de um `DndContext`. */
export function KanbanCard({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id })
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined

  return (
    <KanbanCardBody
      lead={lead}
      dragging={isDragging}
      style={style}
      drag={{ setNodeRef, attributes, listeners }}
    />
  )
}
