import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Archive, ArrowLeft, FileQuestion, Pencil, RefreshCw } from 'lucide-react'
import { archiveClient, getClient } from '../services/clientService'
import { CLIENT_STATUS_LABELS, type ClientDetail } from '../types/client'
import type { Contract } from '../types/contract'
import type { ProjectStatus } from '../types/project'
import { formatMoney } from '../lib/money'
import { formatDate, formatPhone } from '../lib/format'
import { formatCalendarDate } from '../lib/calendarDate'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { Skeleton } from '../components/ui/Skeleton'
import { ClientForm } from '../components/clients/ClientForm'
import { ClientHistory } from '../components/clients/ClientHistory'

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  not_started: 'Não iniciado',
  planning: 'Planejamento',
  in_development: 'Em desenvolvimento',
  awaiting_client_info: 'Aguardando informações do cliente',
  in_review: 'Em revisão',
  awaiting_approval: 'Aguardando aprovação',
  changes_requested: 'Alterações solicitadas',
  completed: 'Concluído',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

const CONTRACT_STATUS_LABELS: Record<Contract['status'], string> = {
  active: 'Ativo',
  cancelled: 'Cancelado',
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Cadastro manual',
  lead: 'Lead convertido',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'Pix',
  boleto: 'Boleto',
  transferencia: 'Transferência bancária',
  cartao: 'Cartão',
}

const TABS = [
  { value: 'overview', label: 'Visão geral' },
  { value: 'projects', label: 'Projetos' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'historico', label: 'Histórico' },
] as const

type Tab = typeof TABS[number]['value']

type DetailState =
  | { status: 'loading' }
  | { status: 'ready'; detail: ClientDetail }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'refresh-error'; detail: ClientDetail; message: string }

function compareContracts(a: Contract, b: Contract) {
  return b.contracted_at.localeCompare(a.contracted_at) || a.id.localeCompare(b.id)
}

function formatMoneyText(value: number): string {
  return formatMoney(value).replace(/\u00a0/g, ' ')
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm text-ink">{value || '—'}</dd>
    </div>
  )
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  if (!id) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Cliente não encontrado."
        description="O endereço não identifica um cliente válido."
        action={<Link to="/clientes" className="text-sm text-accent hover:underline">Voltar para clientes</Link>}
      />
    )
  }
  return <ClientDetailContent key={id} clientId={id} />
}

function ClientDetailContent({ clientId }: { clientId: string }) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [detailState, setDetailState] = useState<DetailState>({ status: 'loading' })
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveSaving, setArchiveSaving] = useState(false)
  const activeRef = useRef(true)
  const requestRef = useRef(0)
  const hasLoadedRef = useRef(false)
  const archiveSavingRef = useRef(false)

  const loadDetail = useCallback(async (background: boolean) => {
    if (!activeRef.current) return
    const request = ++requestRef.current
    setRefreshing(background)
    if (!background) setDetailState({ status: 'loading' })

    try {
      const detail = await getClient(clientId)
      if (!activeRef.current || request !== requestRef.current) return
      if (!detail) {
        hasLoadedRef.current = false
        setSelectedContractId(null)
        setDetailState({ status: 'empty' })
        return
      }

      hasLoadedRef.current = true
      const orderedContracts = [...detail.contracts].sort(compareContracts)
      setSelectedContractId((current) => orderedContracts.some((contract) => contract.id === current)
        ? current
        : orderedContracts[0]?.id ?? null)
      setDetailState({ status: 'ready', detail })
    } catch (error) {
      if (!activeRef.current || request !== requestRef.current) return
      const message = error instanceof Error ? error.message : 'Erro ao carregar cliente.'
      setDetailState((current) => {
        if (background && (current.status === 'ready' || current.status === 'refresh-error')) {
          return { status: 'refresh-error', detail: current.detail, message }
        }
        return { status: 'error', message }
      })
    } finally {
      if (activeRef.current && request === requestRef.current) setRefreshing(false)
    }
  }, [clientId])

  useEffect(() => {
    activeRef.current = true
    void loadDetail(hasLoadedRef.current)
    return () => {
      activeRef.current = false
      requestRef.current += 1
    }
  }, [loadDetail, refreshKey])

  const reload = () => setRefreshKey((key) => key + 1)

  const confirmArchive = async () => {
    if (archiveSavingRef.current) return
    archiveSavingRef.current = true
    setArchiveSaving(true)
    try {
      await archiveClient(clientId)
      if (!activeRef.current) return
      toast('Cliente arquivado.')
      setArchiveOpen(false)
      reload()
    } catch (error) {
      if (!activeRef.current) return
      toast(error instanceof Error ? error.message : 'Erro ao arquivar cliente.', 'error')
    } finally {
      archiveSavingRef.current = false
      if (activeRef.current) setArchiveSaving(false)
    }
  }

  if (detailState.status === 'loading') {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
        <span role="status" className="sr-only">Carregando cliente…</span>
      </div>
    )
  }

  if (detailState.status === 'error') {
    return (
      <Card className="border-danger/40" role="alert">
        <p className="text-sm font-medium text-danger">Não foi possível carregar o cliente.</p>
        <p className="mt-1 text-sm text-muted">{detailState.message}</p>
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="outline" onClick={reload}>Tentar novamente</Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/clientes')}>Voltar para clientes</Button>
        </div>
      </Card>
    )
  }

  if (detailState.status === 'empty') {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Cliente não encontrado."
        description="O registro pode ter sido arquivado ou não está disponível."
        action={<Link to="/clientes" className="text-sm text-accent hover:underline">Voltar para clientes</Link>}
      />
    )
  }

  const detail = detailState.detail
  const contracts = [...detail.contracts].sort(compareContracts)
  const selectedContract = contracts.find((contract) => contract.id === selectedContractId) ?? contracts[0] ?? null
  const initialContract = [...detail.contracts].sort((a, b) =>
    a.contracted_at.localeCompare(b.contracted_at) || a.id.localeCompare(b.id),
  )[0] ?? null

  return (
    <div className="flex flex-col gap-5" aria-busy={refreshing}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/clientes" className="mb-1 inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
            <ArrowLeft className="h-3 w-3" aria-hidden="true" /> Clientes
          </Link>
          <h1 className="font-display text-xl font-bold text-ink">{detail.client.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
              {CLIENT_STATUS_LABELS[detail.client.status]}
            </span>
            <span>Origem: {SOURCE_LABELS[detail.client.source] ?? detail.client.source}</span>
            {refreshing && <span role="status">Atualizando…</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={reload}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Atualizar
          </Button>
          <Button type="button" variant="outline" onClick={() => setEditing(true)} disabled={!selectedContract || refreshing}>
            <Pencil className="h-4 w-4" aria-hidden="true" /> Editar cliente
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => setArchiveOpen(true)}
            disabled={detail.client.status === 'inactive' || refreshing || archiveSaving}
          >
            <Archive className="h-4 w-4" aria-hidden="true" /> Arquivar cliente
          </Button>
        </div>
      </div>

      {detailState.status === 'refresh-error' && (
        <Card className="border-danger/40" role="alert">
          <p className="text-sm font-medium text-danger">Não foi possível atualizar o cliente.</p>
          <p className="mt-1 text-sm text-muted">{detailState.message} Exibindo os últimos dados carregados.</p>
          <Button type="button" variant="outline" className="mt-3" onClick={reload}>Tentar novamente</Button>
        </Card>
      )}

      <div role="tablist" aria-label="Seções do cliente" className="flex flex-wrap gap-2 border-b border-line pb-3">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`client-tab-${tab.value}`}
            aria-selected={activeTab === tab.value}
            aria-controls={`client-panel-${tab.value}`}
            onClick={() => setActiveTab(tab.value)}
            className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${activeTab === tab.value ? 'bg-primary/15 text-primary' : 'text-muted hover:bg-elevated hover:text-ink'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`client-panel-${activeTab}`} aria-labelledby={`client-tab-${activeTab}`}>
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card title="Informações">
              <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                <InfoRow label="Responsável" value={detail.client.responsible_name} />
                <InfoRow label="Telefone" value={detail.client.phone ? formatPhone(detail.client.phone) : null} />
                <InfoRow label="WhatsApp" value={detail.client.whatsapp ? formatPhone(detail.client.whatsapp) : null} />
                <InfoRow label="E-mail" value={detail.client.email} />
                <InfoRow label="CNPJ" value={detail.client.cnpj} />
                <InfoRow label="Site" value={detail.client.website} />
                <InfoRow label="Instagram" value={detail.client.instagram} />
                <InfoRow label="Endereço" value={detail.client.address} />
                <InfoRow label="Cidade" value={detail.client.city} />
                <InfoRow label="Bairro" value={detail.client.district} />
                <InfoRow label="CEP" value={detail.client.zip_code} />
                <InfoRow label="Estado" value={detail.client.state} />
                <InfoRow label="Nicho" value={detail.client.niche} />
                <InfoRow label="Cadastrado em" value={formatDate(detail.client.created_at)} />
                <InfoRow label="Convertido em" value={detail.client.converted_at ? formatDate(detail.client.converted_at) : null} />
              </dl>
              {detail.client.notes && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-elevated p-3 text-sm text-muted">{detail.client.notes}</p>}
            </Card>

            <Card title="Contrato inicial">
              {initialContract ? (
                <dl className="flex flex-col gap-2">
                  <InfoRow label="Serviço" value={initialContract.service} />
                  <InfoRow label="Valor contratado" value={formatMoneyText(initialContract.total_value_cents)} />
                  <InfoRow label="Data da contratação" value={formatCalendarDate(initialContract.contracted_at)} />
                  <InfoRow label="Vencimento" value={formatCalendarDate(initialContract.due_date)} />
                </dl>
              ) : <p className="text-sm text-muted">Nenhum contrato cadastrado.</p>}
            </Card>

            <Card title="Leads vinculados">
              {detail.linkedLeads.length === 0 ? (
                <p className="text-sm text-muted">Nenhum lead vinculado.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {detail.linkedLeads.map((lead) => (
                    <li key={lead.leadId}>
                      <Link to={`/leads/${lead.leadId}`} className="text-sm text-accent hover:underline">{lead.leadName}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="flex flex-col gap-3">
            {detail.projects.length === 0 ? (
              <Card><p className="text-sm text-muted">Nenhum projeto vinculado.</p></Card>
            ) : detail.projects.map((project) => (
              <Card key={project.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-semibold text-ink">{project.name}</h2>
                    <p className="mt-1 text-sm text-muted">{project.service}</p>
                  </div>
                  <span className="rounded-full bg-elevated px-2.5 py-0.5 text-xs text-muted">{PROJECT_STATUS_LABELS[project.status]}</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <InfoRow label="Prazo" value={formatCalendarDate(project.due_date)} />
                  <InfoRow label="Valor alocado" value={formatMoneyText(project.contracted_value_cents)} />
                </dl>
              </Card>
            ))}
            <p className="text-xs text-muted">Tarefas, revisões e entregas serão disponibilizadas no Plano 2 da Etapa 3.</p>
          </div>
        )}

        {activeTab === 'financeiro' && (
          <div className="flex flex-col gap-4">
            {!selectedContract ? (
              <Card><p className="text-sm text-muted">Nenhum contrato cadastrado.</p></Card>
            ) : (
              <>
                {contracts.length > 1 && (
                  <Select
                    label="Contrato"
                    value={selectedContract.id}
                    onChange={(event) => setSelectedContractId(event.target.value)}
                    options={contracts.map((contract) => ({
                      value: contract.id,
                      label: `${contract.service} · ${formatCalendarDate(contract.contracted_at)}`,
                    }))}
                    className="max-w-md"
                  />
                )}
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="font-display text-base font-semibold text-ink">{selectedContract.service}</h2>
                    <span className="rounded-full bg-elevated px-2.5 py-0.5 text-xs text-muted">{CONTRACT_STATUS_LABELS[selectedContract.status]}</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                    <InfoRow label="Valor contratado" value={formatMoneyText(selectedContract.total_value_cents)} />
                    <InfoRow label="Data da contratação" value={formatCalendarDate(selectedContract.contracted_at)} />
                    <InfoRow label="Vencimento" value={formatCalendarDate(selectedContract.due_date)} />
                    <InfoRow label="Forma de pagamento" value={selectedContract.payment_method ? PAYMENT_METHOD_LABELS[selectedContract.payment_method] ?? selectedContract.payment_method : null} />
                    <InfoRow label="Condições de pagamento" value={selectedContract.payment_terms} />
                  </dl>
                  {selectedContract.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{selectedContract.notes}</p>}
                </Card>
                <p className="text-xs text-muted">Pagamentos, estornos e despesas serão exibidos no módulo Financeiro.</p>
              </>
            )}
          </div>
        )}

        {activeTab === 'historico' && <ClientHistory entries={detail.history} />}
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Editar cliente" wide>
        {selectedContract && (
          <ClientForm
            mode="edit"
            client={detail.client}
            contract={selectedContract}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false)
              toast('Cliente atualizado.')
              reload()
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={archiveOpen}
        title="Arquivar cliente"
        description={`Arquivar "${detail.client.name}"? O cliente ficará inativo e seus contratos, projetos e histórico serão preservados.`}
        confirmLabel="Confirmar arquivamento"
        loading={archiveSaving}
        onConfirm={() => void confirmArchive()}
        onCancel={() => {
          if (!archiveSavingRef.current) setArchiveOpen(false)
        }}
      />
    </div>
  )
}
