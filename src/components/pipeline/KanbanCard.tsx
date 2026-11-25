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
  // estimated_value vem 0 do draft: "não estimado" não é "não vale nada" (regra do tri-estado),
  // e formatBRL converte valor não finito em moeda — daí o guard antes de qualquer R$.
  const hasPotentialValue = Number.isFinite(lead.estimated_value) && lead.estimated_value > 0

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
        {hasPotentialValue ? (
          <span className="text-right text-xs text-muted">Potencial estimado {formatBRL(lead.estimated_value)}</span>
        ) : (
          <span className="text-right text-xs text-muted/60">Sem valor estimado</span>
        )}
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
  // Atributos explícitos: o padrão do dnd-kit é `role="button"` + `tabIndex=0`, mas o card tem
  // conteúdo apresentacional (o Link da ficha) — botão faria o leitor de tela engolir o único
  // caminho de navegação — e sem KeyboardSensor a parada de tab extra não levaria a lugar nenhum.
  // `role="group"` mantém o card uma região nomeável; arrastar continua pelo ponteiro (listeners).
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    attributes: { role: 'group', tabIndex: -1 },
  })
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
