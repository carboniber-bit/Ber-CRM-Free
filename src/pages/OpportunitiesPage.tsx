import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, RefreshCw, Target } from 'lucide-react'
import { listLeads } from '../services/leadService'
import { listFollowups } from '../services/followupService'
import { prospectingQueue } from '../lib/dashboard'
import { isEligibleOpportunity } from '../lib/opportunity'
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
// Cidade/Bairro são texto livre: um caractere não pode virar uma consulta.
const FREE_TEXT_DEBOUNCE_MS = 300
const FREE_TEXT_KEYS: Array<keyof LeadFilters> = ['city', 'district']

function onlyFreeTextChanged(prev: LeadFilters, next: LeadFilters): boolean {
  const prevValues = prev as Record<string, unknown>
  const nextValues = next as Record<string, unknown>
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)])
  let changed = false
  for (const key of keys) {
    if (prevValues[key] === nextValues[key]) continue
    changed = true
    if (!FREE_TEXT_KEYS.some((freeKey) => freeKey === key)) return false
  }
  return changed
}

export function OpportunitiesPage() {
  const navigate = useNavigate()
  // `filters` alimenta o formulário (tecla a tecla); `queryFilters` é o que foi confirmado
  // para a consulta de oportunidades depois do debounce dos campos de texto livre.
  const [filters, setFilters] = useState<LeadFilters>({})
  const [queryFilters, setQueryFilters] = useState<LeadFilters>({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [queueRefreshKey, setQueueRefreshKey] = useState(0)
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [allLeads, setAllLeads] = useState<Lead[]>([])
  const [followups, setFollowups] = useState<Followup[]>([])
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(true)
  const [queueLoading, setQueueLoading] = useState(true)
  const [opportunitiesError, setOpportunitiesError] = useState<string | null>(null)
  const [queueError, setQueueError] = useState<string | null>(null)
  const [whatsappLead, setWhatsappLead] = useState<Lead | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Consulta que depende dos filtros: só roda quando o filtro é confirmado ou se recarrega.
  useEffect(() => {
    let active = true
    void listLeads(
      { ...queryFilters, hasNeeds: true, excludeStatuses: INELIGIBLE_STATUSES },
      'score_desc',
      0,
      OPPORTUNITY_PAGE_SIZE,
    ).then(
      (result) => {
        if (!active) return
        setLeads(result.leads)
        setTotal(result.total)
        setOpportunitiesError(null)
        setOpportunitiesLoading(false)
      },
      (e: unknown) => {
        if (!active) return
        setOpportunitiesError(e instanceof Error ? e.message : 'Erro ao carregar oportunidades.')
        setOpportunitiesLoading(false)
      },
    )
    return () => { active = false }
  }, [queryFilters, refreshKey])

  // Fila "Prospectar hoje": independe dos filtros, então só recarrega junto com a página.
  useEffect(() => {
    let active = true
    let queueFailed = false
    const loadEligibleLeads = async () => {
      const rows: Lead[] = []
      let page = 0
      let result
      do {
        if (!active || queueFailed) return []
        result = await listLeads(
          { hasNeeds: true, excludeStatuses: INELIGIBLE_STATUSES },
          'score_desc',
          page,
          QUEUE_BASE_PAGE_SIZE,
        )
        if (!active || queueFailed) return []
        rows.push(...result.leads)
        page += 1
      } while (rows.length < result.total && result.leads.length > 0)
      return rows
    }
    const overdue = listFollowups('overdue').catch((e: unknown) => {
      queueFailed = true
      throw e
    })
    void Promise.all([loadEligibleLeads(), overdue]).then(
      ([all, overdue]) => {
        if (!active) return
        setAllLeads(all)
        setFollowups(overdue)
        setQueueLoading(false)
      },
      (e: unknown) => {
        if (!active) return
        // Sem dados confirmados da fila, nada antigo pode ser apresentado como atual.
        setAllLeads([])
        setFollowups([])
        setQueueError(e instanceof Error ? e.message : 'Erro ao carregar a fila de prospecção.')
        setQueueLoading(false)
      },
    )
    return () => { active = false }
  }, [queueRefreshKey])

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  const cancelPendingCommit = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }
  const commitQueryFilters = (next: LeadFilters) => {
    setQueryFilters(next)
    setOpportunitiesLoading(true)
    setOpportunitiesError(null)
  }
  const changeFilters = (next: LeadFilters) => {
    setFilters(next)
    cancelPendingCommit()
    if (onlyFreeTextChanged(filters, next)) {
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null
        commitQueryFilters(next)
      }, FREE_TEXT_DEBOUNCE_MS)
      return
    }
    commitQueryFilters(next)
  }
  const clearFilters = () => {
    setFilters({})
    cancelPendingCommit()
    commitQueryFilters({})
  }
  const reload = () => {
    cancelPendingCommit()
    setOpportunitiesLoading(true)
    setQueueLoading(true)
    setOpportunitiesError(null)
    setQueueError(null)
    setQueryFilters(filters)
    setRefreshKey((key) => key + 1)
    setQueueRefreshKey((key) => key + 1)
  }
  const retryOpportunities = () => {
    cancelPendingCommit()
    setOpportunitiesLoading(true)
    setOpportunitiesError(null)
    setQueryFilters(filters)
    setRefreshKey((key) => key + 1)
  }
  const retryQueue = () => {
    setQueueLoading(true)
    setQueueError(null)
    setQueueRefreshKey((key) => key + 1)
  }

  // "Prospectar hoje" desta página é fila de oportunidade: lead sem necessidade confirmada
  // não pontua e não pode aparecer numa lista que se apresenta como oportunidade.
  const queue = useMemo(
    () => prospectingQueue(allLeads.filter(isEligibleOpportunity), followups),
    [allLeads, followups],
  )
  const totalPotential = useMemo(() => leads.reduce((sum, lead) => sum + lead.estimated_value, 0), [leads])
  const countLabel = total === 1 ? '1 oportunidade' : `${total} oportunidades`
  const partialPotential = leads.length > 0 && leads.length < total
  const potentialHint = partialPotential
    ? ` · referente ${leads.length === 1 ? 'à 1 primeira listada' : `às ${leads.length} primeiras listadas`}`
    : ''
  const hasActiveFilters = Object.values(queryFilters).some((value) => value !== undefined && value !== '')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Oportunidades</h1>
          {/* Enquanto a consulta não responde (ou falha), nenhum número é afirmado: zero
              em trânsito não é "nenhuma oportunidade". */}
          <p className="text-sm text-muted">
            {opportunitiesError
              ? 'Contagem e potencial indisponíveis nesta atualização. Recarregue para tentar de novo.'
              : opportunitiesLoading
                ? 'Carregando oportunidades…'
                : `${countLabel} · potencial estimado ${formatBRL(totalPotential)}${potentialHint}`}
          </p>
        </div>
        <Button variant="outline" onClick={reload}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
      </div>

      {!queueLoading && !queueError && queue.length > 0 && (
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

      {queueError && (
        <Card className="border-danger/40" role="alert">
          <p className="text-sm text-danger">Fila “Prospectar hoje”: {queueError}</p>
          <Button variant="outline" className="mt-3" onClick={retryQueue}>Tentar novamente</Button>
        </Card>
      )}

      <Card><OpportunityFilters filters={filters} onChange={changeFilters} /></Card>

      {opportunitiesError ? (
        <Card className="border-danger/40" role="alert">
          <p className="text-sm text-danger">{opportunitiesError}</p>
          <Button variant="outline" className="mt-3" onClick={retryOpportunities}>Tentar novamente</Button>
        </Card>
      ) : opportunitiesLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}</div>
      ) : leads.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            icon={Target}
            title="Nenhuma oportunidade com esses filtros"
            description="Nenhum lead atende a todos os filtros aplicados. Limpe os filtros para ver a lista completa de oportunidades."
            action={<Button variant="outline" onClick={clearFilters}>Limpar filtros</Button>}
          />
        ) : (
          <EmptyState
            icon={Target}
            title="Nenhuma oportunidade identificada"
            description="As oportunidades nascem dos leads: cadastre estabelecimentos e confirme a presença digital (marque 'Não' apenas quando verificado). Leads sem dados confirmados não pontuam."
            action={<Button variant="mint" onClick={() => navigate('/leads/novo')}>Cadastrar lead</Button>}
          />
        )
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
