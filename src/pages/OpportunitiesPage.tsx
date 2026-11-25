import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, RefreshCw, Target } from 'lucide-react'
import { listLeads } from '../services/leadService'
import { listFollowups } from '../services/followupService'
import { prospectingQueue } from '../lib/dashboard'
import { INELIGIBLE_STATUSES, NICHE_LABELS, type Lead, type LeadFilters, type Niche } from '../types/lead'
import type { Followup } from '../types/followup'
import { formatBRL } from '../lib/format'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { OpportunityCard } from '../components/opportunities/OpportunityCard'
import { OpportunityFilters } from '../components/opportunities/OpportunityFilters'
import { WhatsAppDialog } from '../components/leads/WhatsAppDialog'

const OPPORTUNITY_PAGE_SIZE = 200
const QUEUE_BASE_PAGE_SIZE = 1000
const QUEUE_PREVIEW_SIZE = 5

export function OpportunitiesPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<LeadFilters>({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [leads, setLeads] = useState<Lead[]>([])
  const [allLeads, setAllLeads] = useState<Lead[]>([])
  const [followups, setFollowups] = useState<Followup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [whatsappLead, setWhatsappLead] = useState<Lead | null>(null)

  useEffect(() => {
    let active = true
    void Promise.all([
      listLeads({ ...filters, hasNeeds: true, excludeStatuses: INELIGIBLE_STATUSES }, 'score_desc', 0, OPPORTUNITY_PAGE_SIZE),
      listLeads({}, 'score_desc', 0, QUEUE_BASE_PAGE_SIZE),
      listFollowups('overdue'),
    ]).then(
      ([filtered, all, overdue]) => {
        if (!active) return
        setLeads(filtered.leads)
        setAllLeads(all.leads)
        setFollowups(overdue)
        setError(null)
        setLoading(false)
      },
      (e: unknown) => {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Erro ao carregar oportunidades.')
        setLoading(false)
      },
    )
    return () => { active = false }
  }, [filters, refreshKey])

  const startLoading = () => {
    setLoading(true)
    setError(null)
  }
  const reload = () => {
    startLoading()
    setRefreshKey((key) => key + 1)
  }
  const changeFilters = (next: LeadFilters) => {
    startLoading()
    setFilters(next)
  }

  const queue = useMemo(() => prospectingQueue(allLeads, followups), [allLeads, followups])
  const totalPotential = useMemo(() => leads.reduce((sum, lead) => sum + lead.estimated_value, 0), [leads])
  const countLabel = leads.length === 1 ? '1 oportunidade' : `${leads.length} oportunidades`

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Oportunidades</h1>
          <p className="text-sm text-muted">
            {countLabel} · potencial estimado {formatBRL(totalPotential)}
          </p>
        </div>
        <Button variant="outline" onClick={reload}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
      </div>

      {queue.length > 0 && (
        <Card title="Prospectar hoje" dot="mint">
          <div className="flex flex-col gap-2">
            {queue.slice(0, QUEUE_PREVIEW_SIZE).map((lead) => (
              <Link key={lead.id} to={`/leads/${lead.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-elevated px-3 py-2.5 text-sm transition-colors hover:bg-line">
                <span className="min-w-0 truncate text-ink">{lead.name}</span>
                <span className="shrink-0 text-xs text-muted">
                  {lead.niche ? `${NICHE_LABELS[lead.niche as Niche] ?? lead.niche} · ` : ''}score {lead.score}
                </span>
              </Link>
            ))}
            <Button variant="mint" className="mt-1 self-start" onClick={() => navigate(`/leads/${queue[0].id}`)}>
              Próxima oportunidade <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      <Card><OpportunityFilters filters={filters} onChange={changeFilters} /></Card>

      {error ? (
        <Card className="border-danger/40" role="alert">
          <p className="text-sm text-danger">{error}</p>
          <Button variant="outline" className="mt-3" onClick={reload}>Tentar novamente</Button>
        </Card>
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}</div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nenhuma oportunidade identificada"
          description="As oportunidades nascem dos leads: cadastre estabelecimentos e confirme a presença digital (marque 'Não' apenas quando verificado). Leads sem dados confirmados não pontuam."
          action={<Link to="/leads/novo"><Button variant="mint">Cadastrar lead</Button></Link>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {leads.map((lead) => <OpportunityCard key={lead.id} lead={lead} onWhatsApp={setWhatsappLead} />)}
        </div>
      )}

      {whatsappLead && (
        <WhatsAppDialog open lead={whatsappLead} onClose={() => setWhatsappLead(null)} onLogged={reload} />
      )}
    </div>
  )
}
