import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, FileQuestion, MessageCircle, MessageSquare, Pencil } from 'lucide-react'
import { getLead, setLeadStatus } from '../services/leadService'
import { getLeadClientLink } from '../services/clientService'
import {
  LEAD_STATUSES, NICHE_LABELS, PRESENCE_FIELDS, PRESENCE_FIELD_LABELS,
  STATUS_LABELS, type Lead, type LeadStatus, type Niche,
} from '../types/lead'
import type { LeadClientLink } from '../types/client'
import { formatBRL, formatDateTime, formatPhone } from '../lib/format'
import { buildMapsSearchUrl, normalizeInstagramUrl, normalizeMapsUrl, normalizeUrl } from '../lib/url'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { PresenceBadge } from '../components/ui/PresenceBadge'
import { Select } from '../components/ui/Select'
import { Skeleton } from '../components/ui/Skeleton'
import { Spinner } from '../components/ui/Spinner'
import { StatusBadge } from '../components/ui/StatusBadge'
import { ContactDialog } from '../components/leads/ContactDialog'
import { ConversionDialog } from '../components/leads/ConversionDialog'
import { FollowupDialog } from '../components/leads/FollowupDialog'
import { LeadChecklist } from '../components/leads/LeadChecklist'
import { LeadFollowups } from '../components/leads/LeadFollowups'
import { LeadTimeline } from '../components/leads/LeadTimeline'
import { OpportunityPanel } from '../components/leads/OpportunityPanel'
import { WhatsAppDialog } from '../components/leads/WhatsAppDialog'

type LeadLoadState =
  | { status: 'loading' }
  | { status: 'ready'; lead: Lead }
  | { status: 'error'; message: string }
  | { status: 'refresh-error'; lead: Lead; message: string }

type LinkLoadState =
  | { status: 'loading' }
  | { status: 'ready'; link: LeadClientLink | null }
  | { status: 'error'; message: string; link: LeadClientLink | null }

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
  const { toast } = useToast()
  const [loadState, setLoadState] = useState<LeadLoadState | null>(null)
  const [linkLoadState, setLinkLoadState] = useState<LinkLoadState>({ status: 'loading' })
  const [conversionOpen, setConversionOpen] = useState(false)
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [followupOpen, setFollowupOpen] = useState(false)
  const [whatsappOpen, setWhatsappOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [pendingStatus, setPendingStatus] = useState<LeadStatus | null>(null)
  const [statusSaving, setStatusSaving] = useState(false)
  const requestRef = useRef(0)
  const activeRef = useRef(true)
  const statusSavingRef = useRef(false)
  const pendingConversionFocusRef = useRef(false)
  const convertedClientLinkRef = useRef<HTMLAnchorElement | null>(null)
  const focusOpenerRef = useRef<HTMLButtonElement | HTMLSelectElement | HTMLAnchorElement | null>(null)
  const link = linkLoadState.status === 'ready' || linkLoadState.status === 'error'
    ? linkLoadState.link
    : null

  const fetchLeadAndLink = useCallback(async (background = false) => {
    if (!activeRef.current) return
    const request = ++requestRef.current
    if (background) {
      setRefreshing(true)
    } else {
      setRefreshing(false)
      setLoadState({ status: 'loading' })
      setLinkLoadState({ status: 'loading' })
    }

    const [leadResult, linkResult] = await Promise.allSettled([
      getLead(leadId),
      getLeadClientLink(leadId),
    ])
    if (!activeRef.current || request !== requestRef.current) return

    if (leadResult.status === 'rejected') {
      const message = leadResult.reason instanceof Error ? leadResult.reason.message : 'Erro ao carregar lead.'
      setLoadState((current) => {
        if (background && current && (current.status === 'ready' || current.status === 'refresh-error')) {
          return { status: 'refresh-error', lead: current.lead, message }
        }
        return { status: 'error', message }
      })
    } else {
      setLoadState({ status: 'ready', lead: leadResult.value })
    }
    if (linkResult.status === 'rejected') {
      const message = linkResult.reason instanceof Error ? linkResult.reason.message : 'Erro ao consultar vínculo.'
      setLinkLoadState((current) => ({
        status: 'error',
        message,
        link: background && (current.status === 'ready' || current.status === 'error') ? current.link : null,
      }))
    } else {
      setLinkLoadState({ status: 'ready', link: linkResult.value })
    }
    setRefreshing(false)
  }, [leadId])

  const reload = useCallback(async (background = false) => {
    if (!activeRef.current) return
    await fetchLeadAndLink(background)
  }, [fetchLeadAndLink])

  useEffect(() => {
    activeRef.current = true
    void fetchLeadAndLink()
    return () => {
      activeRef.current = false
      requestRef.current += 1
    }
  }, [fetchLeadAndLink])

  useEffect(() => {
    if (contactOpen || followupOpen || whatsappOpen || conversionOpen || pendingStatus !== null || statusSaving || refreshing) return
    const opener = focusOpenerRef.current
    focusOpenerRef.current = null
    if (opener?.isConnected && !('disabled' in opener && opener.disabled)) opener.focus()
  }, [contactOpen, followupOpen, whatsappOpen, conversionOpen, pendingStatus, statusSaving, refreshing])

  useEffect(() => {
    if (!pendingConversionFocusRef.current || conversionOpen || refreshing || !link) return
    pendingConversionFocusRef.current = false
    convertedClientLinkRef.current?.focus()
  }, [conversionOpen, refreshing, link])

  const handleLeadChanged = useCallback(() => {
    setRefreshKey((key) => key + 1)
    setTimelineRefreshKey((key) => key + 1)
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

  const lead = loadState.lead
  const location = [lead.address, lead.district, lead.city, lead.state, lead.zip_code].filter(Boolean).join(', ')
  const statusControlsDisabled = statusSaving || contactOpen || followupOpen || whatsappOpen || conversionOpen || pendingStatus !== null || refreshing

  const requestStatusChange = (status: LeadStatus, opener: HTMLSelectElement) => {
    if (statusControlsDisabled || status === lead.status) return
    focusOpenerRef.current = opener
    setPendingStatus(status)
  }

  const cancelStatusChange = () => {
    if (statusSavingRef.current) return
    setPendingStatus(null)
  }

  const confirmStatusChange = async () => {
    if (!pendingStatus || statusSavingRef.current) return
    const targetStatus = pendingStatus
    statusSavingRef.current = true
    setStatusSaving(true)

    try {
      const updatedLead = await setLeadStatus(leadId, targetStatus)
      if (!activeRef.current) return
      setLoadState({ status: 'ready', lead: updatedLead })
      setPendingStatus(null)
      setRefreshKey((key) => key + 1)
      setTimelineRefreshKey((key) => key + 1)
      toast('Status atualizado.')
      void reload(true)
    } catch (error) {
      if (!activeRef.current) return
      const message = error instanceof Error ? error.message : 'Erro ao atualizar status.'
      toast(message, 'error')
    } finally {
      statusSavingRef.current = false
      if (activeRef.current) setStatusSaving(false)
    }
  }

  const exactMapsUrl = normalizeMapsUrl(lead.maps_url ?? '')
  const mapsSearchUrl = exactMapsUrl ? null : buildMapsSearchUrl([
    lead.name, lead.address, lead.district, lead.city, lead.state, lead.zip_code,
  ])
  const links = [
    { label: exactMapsUrl ? 'Abrir no Maps' : 'Buscar no Maps', url: exactMapsUrl || mapsSearchUrl },
    { label: 'Instagram', url: normalizeInstagramUrl(lead.instagram) },
    { label: 'Facebook', url: normalizeUrl(lead.facebook ?? '') },
    { label: 'Site', url: normalizeUrl(lead.website ?? '') },
    { label: 'Cardápio', url: normalizeUrl(lead.menu_url ?? '') },
    { label: 'Catálogo', url: normalizeUrl(lead.catalog_url ?? '') },
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
          <div className="mt-3 w-full sm:w-56">
            <Select
              label="Status"
              value={pendingStatus ?? lead.status}
              onChange={(event) => requestStatusChange(event.target.value as LeadStatus, event.currentTarget)}
              options={LEAD_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] }))}
              disabled={statusControlsDisabled}
              className="w-full"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {refreshing && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <Spinner className="h-3.5 w-3.5" /> Atualizando…
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={(event) => {
              if (statusControlsDisabled) return
              focusOpenerRef.current = event.currentTarget
              setWhatsappOpen(true)
            }}
            disabled={statusControlsDisabled}
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={(event) => {
              if (statusControlsDisabled) return
              focusOpenerRef.current = event.currentTarget
              setFollowupOpen(true)
            }}
            disabled={statusControlsDisabled}
          >
            <CalendarClock className="h-4 w-4" aria-hidden="true" /> Agendar follow-up
          </Button>
          <Button
            type="button"
            variant="mint"
            onClick={(event) => {
              if (statusControlsDisabled) return
              focusOpenerRef.current = event.currentTarget
              setContactOpen(true)
            }}
            disabled={statusControlsDisabled}
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" /> Registrar contato
          </Button>
          {link ? (
            <Link
              ref={convertedClientLinkRef}
              to={`/clientes/${link.client_id}`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Ver cliente
            </Link>
          ) : (
            <Button
              type="button"
              variant="mint"
              onClick={(event) => {
                if (statusControlsDisabled || linkLoadState.status !== 'ready') return
                focusOpenerRef.current = event.currentTarget
                setConversionOpen(true)
              }}
              disabled={statusControlsDisabled || linkLoadState.status !== 'ready'}
            >
              Converter em cliente
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/leads/${lead.id}/editar`)}
            disabled={statusControlsDisabled}
          >
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

      {linkLoadState.status === 'error' && (
        <Card className="border-danger/40" role="alert">
          <p className="text-sm font-medium text-danger">Não foi possível verificar o vínculo com o cliente.</p>
          <p className="mt-1 text-sm text-muted">{linkLoadState.message}</p>
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

          <LeadTimeline leadId={lead.id} refreshKey={timelineRefreshKey} />
        </div>

        <div className="flex flex-col gap-5">
          <OpportunityPanel lead={lead} />
          <LeadChecklist
            key={lead.id}
            leadId={lead.id}
            onChanged={handleLeadChanged}
          />
          <LeadFollowups
            leadId={lead.id}
            leadName={lead.name}
            refreshKey={refreshKey}
            onChanged={handleLeadChanged}
          />
        </div>
      </div>

      <ConfirmDialog
        open={pendingStatus !== null}
        title="Mudar status"
        description={pendingStatus
          ? `Confirmar mudança de ${STATUS_LABELS[lead.status]} para ${STATUS_LABELS[pendingStatus]}?`
          : ''}
        confirmLabel="Mudar status"
        loading={statusSaving}
        onConfirm={() => void confirmStatusChange()}
        onCancel={cancelStatusChange}
      />
      <ContactDialog
        open={contactOpen}
        leadId={lead.id}
        currentStatus={lead.status}
        onClose={() => setContactOpen(false)}
        onSaved={handleLeadChanged}
      />
      <FollowupDialog
        open={followupOpen}
        leadId={lead.id}
        onClose={() => setFollowupOpen(false)}
        onSaved={handleLeadChanged}
      />
      <WhatsAppDialog
        open={whatsappOpen}
        lead={lead}
        onClose={() => setWhatsappOpen(false)}
        onLogged={handleLeadChanged}
      />
      <ConversionDialog
        open={conversionOpen}
        lead={lead}
        existingClientId={link?.client_id ?? null}
        onClose={() => setConversionOpen(false)}
        onConverted={() => {
          pendingConversionFocusRef.current = true
          setConversionOpen(false)
          setTimelineRefreshKey((key) => key + 1)
          void reload(true)
        }}
      />
    </div>
  )
}
