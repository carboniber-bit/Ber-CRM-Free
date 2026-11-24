import { Lightbulb } from 'lucide-react'
import { NEED_LABELS, PRESENCE_FIELDS, PRIORITY_LABELS, type Lead } from '../../types/lead'
import { Card } from '../ui/Card'
import { PriorityBadge } from '../ui/PriorityBadge'
import { ScoreBar } from '../ui/ScoreBar'

export function OpportunityPanel({ lead }: { lead: Lead }) {
  const hasUnverifiedPresence = PRESENCE_FIELDS.some((field) => lead[field] === 'unverified')

  return (
    <Card title="Oportunidade" dot="lime">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <ScoreBar score={lead.score} />
          </div>
          <PriorityBadge priority={lead.priority} />
        </div>
        {lead.needs.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {lead.needs.map((need) => (
              <span key={need} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {NEED_LABELS[need]}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">
            Nenhuma necessidade confirmada. Verifique a presença digital para identificar oportunidades.
          </p>
        )}
        <div className="rounded-xl border border-line bg-elevated p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <Lightbulb className="h-4 w-4 shrink-0 text-lime" aria-hidden="true" />
            Por que esta empresa é uma oportunidade?
          </div>
          {lead.score_reasons.length > 0 ? (
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
              {lead.score_reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Sem critérios confirmados (pontuação {lead.score}, prioridade {PRIORITY_LABELS[lead.priority].toLowerCase()}).
              As justificativas usam apenas informações cadastradas ou verificadas — nada é presumido.
            </p>
          )}
          {hasUnverifiedPresence && (
            <p className="mt-2 text-xs text-muted">
              Verificação pendente: “Não verificado” é informação desconhecida, não ausência confirmada.
            </p>
          )}
        </div>
        <p className="text-xs text-muted">Pontuação = estimativa de oportunidade comercial, não garantia de contratação.</p>
      </div>
    </Card>
  )
}
