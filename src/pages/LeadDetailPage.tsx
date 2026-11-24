import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileQuestion, Pencil } from 'lucide-react'
import { getLead } from '../services/leadService'
import { NICHE_LABELS, PRESENCE_FIELDS, PRESENCE_FIELD_LABELS, type Lead, type Niche } from '../types/lead'
import { formatBRL, formatDateTime, formatPhone } from '../lib/format'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { PresenceBadge } from '../components/ui/PresenceBadge'
import { Skeleton } from '../components/ui/Skeleton'
import { Spinner } from '../components/ui/Spinner'
import { StatusBadge } from '../components/ui/StatusBadge'
import { LeadChecklist } from '../components/leads/LeadChecklist'
import { OpportunityPanel } from '../components/leads/OpportunityPanel'

type LeadLoadState =
  | { status: 'loading' }
  | { status: 'ready'; lead: Lead }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'refresh-error'; lead: Lead; message: string }

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm text-ink">{value || '—'}</span>
    </div>
  )
}

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  if (!id) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Lead não encontrado"
        description="O endereço não identifica um lead válido."
        action={<Button variant="outline" onClick={() => navigate('/leads')}>Voltar para leads</Button>}
      />
    )
  }

  return <LeadDetailContent key={id} leadId={id} />
}

function LeadDetailContent({ leadId }: { leadId: string }) {
  const navigate = useNavigate()
  const [loadState, setLoadState] = useState<LeadLoadState | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const requestRef = useRef(0)
  const activeRef = useRef(true)

  const fetchLead = useCallback(async (background = false) => {
    if (!activeRef.current) return
    const request = ++requestRef.current

    try {
      const lead = await getLead(leadId)
      if (!activeRef.current || request !== requestRef.current) return
      if (!lead) {
        setLoadState({ status: 'empty' })
        return
      }
      setLoadState({ status: 'ready', lead })
    } catch (error) {
      if (!activeRef.current || request !== requestRef.current) return
      const message = error instanceof Error ? error.message : 'Erro ao carregar lead.'
      setLoadState((current) => {
        if (background && current && (current.status === 'ready' || current.status === 'refresh-error')) {
          return { status: 'refresh-error', lead: current.lead, message }
        }
        return { status: 'error', message }
      })
    } finally {
      if (activeRef.current && request === requestRef.current) setRefreshing(false)
    }
  }, [leadId])

  const reload = useCallback(async (background = false) => {
    if (!activeRef.current) return
    if (background) {
      setRefreshing(true)
    } else {
      setRefreshing(false)
      setLoadState({ status: 'loading' })
    }
    await fetchLead(background)
  }, [fetchLead])

  useEffect(() => {
    activeRef.current = true
    const request = ++requestRef.current
    void getLead(leadId).then(
      (lead) => {
        if (!activeRef.current || request !== requestRef.current) return
        setRefreshing(false)
        setLoadState(lead ? { status: 'ready', lead } : { status: 'empty' })
      },
      (error: unknown) => {
        if (!activeRef.current || request !== requestRef.current) return
        setRefreshing(false)
        setLoadState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Erro ao carregar lead.',
        })
      },
    )
    return () => {
      activeRef.current = false
      requestRef.current += 1
    }
  }, [leadId])

  const handleChecklistChanged = useCallback(() => {
    void reload(true)
  }, [reload])

  if (!loadState || loadState.status === 'loading') {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
        <span role="status" className="sr-only">Carregando ficha do lead…</span>
      </div>
    )
  }

  if (loadState.status === 'error') {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <Link to="/leads" className="inline-flex w-fit items-center gap-1 text-xs text-muted hover:text-ink">
          <ArrowLeft className="h-3 w-3" aria-hidden="true" /> Leads
        </Link>
        <Card className="border-danger/40" role="alert">
          <p className="text-sm font-medium text-danger">Não foi possível carregar a ficha do lead.</p>
          <p className="mt-1 text-sm text-muted">{loadState.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void reload()}>Tentar novamente</Button>
            <Button variant="ghost" onClick={() => navigate('/leads')}>Voltar para leads</Button>
          </div>
        </Card>
      </div>
    )
  }

  if (loadState.status === 'empty') {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Lead não encontrado"
        description="O registro pode ter sido excluído ou não está disponível."
        action={<Button variant="outline" onClick={() => navigate('/leads')}>Voltar para leads</Button>}
      />
    )
  }

  const lead = loadState.lead
  const location = [lead.address, lead.district, lead.city, lead.state, lead.zip_code].filter(Boolean).join(', ')
  const links = [
    { label: 'Instagram', url: lead.instagram },
    { label: 'Facebook', url: lead.facebook },
    { label: 'Site', url: lead.website },
    { label: 'Cardápio', url: lead.menu_url },
    { label: 'Catálogo', url: lead.catalog_url },
  ]

  return (
    <div className="flex flex-col gap-5" aria-busy={refreshing}>
      {refreshing && <span role="status" className="sr-only">Atualizando ficha do lead…</span>}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/leads" className="mb-1 inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
            <ArrowLeft className="h-3 w-3" aria-hidden="true" /> Leads
          </Link>
          <h1 className="font-display text-xl font-bold text-ink">{lead.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <StatusBadge status={lead.status} />
            <span>{lead.niche ? NICHE_LABELS[lead.niche as Niche] ?? lead.niche : 'Sem nicho'}</span>
            {lead.city && <span>· {lead.city}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {refreshing && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <Spinner className="h-3.5 w-3.5" /> Atualizando…
            </span>
          )}
          <Button type="button" variant="outline" onClick={() => navigate(`/leads/${lead.id}/editar`)}>
            <Pencil className="h-4 w-4" aria-hidden="true" /> Editar
          </Button>
        </div>
      </div>

      {loadState.status === 'refresh-error' && (
        <Card className="border-danger/40" role="alert">
          <p className="text-sm font-medium text-danger">Não foi possível atualizar a ficha.</p>
          <p className="mt-1 text-sm text-muted">
            {loadState.message} Exibindo os últimos dados carregados.
          </p>
          <Button variant="outline" className="mt-3" disabled={refreshing} onClick={() => void reload(true)}>
            Tentar novamente
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card title="Informações" dot="mint">
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              <InfoRow label="Responsável" value={lead.responsible_name} />
              <InfoRow label="Telefone" value={lead.phone ? formatPhone(lead.phone) : null} />
              <InfoRow label="WhatsApp" value={lead.whatsapp ? formatPhone(lead.whatsapp) : null} />
              <InfoRow label="E-mail" value={lead.email} />
              <InfoRow label="CNPJ" value={lead.cnpj} />
              <InfoRow label="Origem" value={lead.source} />
              <InfoRow label="Localização" value={location || null} />
              <InfoRow label="Serviço oferecido" value={lead.offered_service} />
              <InfoRow label="Cadastrado em" value={formatDateTime(lead.created_at)} />
              <InfoRow label="Última verificação" value={formatDateTime(lead.last_verified_at)} />
              <InfoRow label="Próximo contato" value={formatDateTime(lead.next_contact_at)} />
            </div>
            {links.some((link) => link.url) && (
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                {links.map((link) => link.url && (
                  <a key={link.label} href={link.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    {link.label}
                  </a>
                ))}
              </div>
            )}
            {lead.notes && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-elevated p-3 text-sm text-muted">{lead.notes}</p>}
          </Card>

          <Card title="Presença digital" dot="accent">
            <p className="mb-3 text-xs text-muted">
              “Não verificado” indica dado desconhecido, não ausência confirmada. A pontuação só trata ausência quando o valor for “Não”.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PRESENCE_FIELDS.map((field) => (
                <div key={field} className="flex items-center justify-between gap-3 rounded-xl bg-elevated px-3 py-2">
                  <span className="text-sm text-muted">{PRESENCE_FIELD_LABELS[field]}</span>
                  <PresenceBadge value={lead[field]} />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Valores" dot="pink">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted">Estimado</dt>
                <dd className="font-display text-base font-semibold text-ink">{formatBRL(lead.estimated_value)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Negociado</dt>
                <dd className="font-display text-base font-semibold text-ink">{formatBRL(lead.negotiated_value)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Contratado</dt>
                <dd className="font-display text-base font-semibold text-ink">{formatBRL(lead.contracted_value)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Recebido</dt>
                <dd className="font-display text-base font-semibold text-primary">{formatBRL(lead.received_value)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted">Valores estimados não são faturamento nem dinheiro recebido.</p>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <OpportunityPanel lead={lead} />
          <LeadChecklist
            key={lead.id}
            leadId={lead.id}
            onChanged={handleChecklistChanged}
          />
        </div>
      </div>
    </div>
  )
}
