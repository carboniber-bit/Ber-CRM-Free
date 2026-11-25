import { Link, useNavigate } from 'react-router-dom'
import { AtSign, Globe, MessageCircle, Phone, Target } from 'lucide-react'
import { NEED_LABELS, NICHE_LABELS, type Lead, type Niche } from '../../types/lead'
import { formatBRL, formatPhone } from '../../lib/format'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { PriorityBadge } from '../ui/PriorityBadge'
import { ScoreBar } from '../ui/ScoreBar'
import { StatusBadge } from '../ui/StatusBadge'

export function OpportunityCard({ lead, onWhatsApp }: { lead: Lead; onWhatsApp: (lead: Lead) => void }) {
  const navigate = useNavigate()
  return (
    // Sem padding próprio: o Card já traz o p-5 do kit (cn concatena, não resolve conflito).
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/leads/${lead.id}`} className="font-display text-sm font-semibold text-ink hover:text-primary">{lead.name}</Link>
          <p className="text-xs text-muted">
            {lead.niche ? NICHE_LABELS[lead.niche as Niche] ?? lead.niche : 'Sem nicho'}
            {lead.city ? ` · ${lead.city}` : ''}{lead.district ? ` · ${lead.district}` : ''}
          </p>
        </div>
        <PriorityBadge priority={lead.priority} />
      </div>

      <ScoreBar score={lead.score} />

      <div className="flex flex-wrap gap-1.5">
        {lead.needs.map((need) => (
          <span key={need} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">{NEED_LABELS[need]}</span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {lead.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {formatPhone(lead.phone)}</span>}
        {lead.instagram && <a href={lead.instagram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline"><AtSign className="h-3 w-3" /> Instagram</a>}
        {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline"><Globe className="h-3 w-3" /> Site</a>}
        <span>Potencial estimado {formatBRL(lead.estimated_value)}</span>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
        <StatusBadge status={lead.status} />
        <div className="flex gap-1.5">
          <Button variant="ghost" className="h-8 px-2.5 text-xs" aria-label={`Abrir WhatsApp de ${lead.name}`} onClick={() => onWhatsApp(lead)}><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</Button>
          {/* CTA como botão irmão do link do título: <button> dentro de <a> é HTML inválido. */}
          <Button variant="mint" className="h-8 px-2.5 text-xs" aria-label={`Prospectar ${lead.name}`} onClick={() => navigate(`/leads/${lead.id}`)}><Target className="h-3.5 w-3.5" /> Prospectar</Button>
        </div>
      </div>
    </Card>
  )
}
