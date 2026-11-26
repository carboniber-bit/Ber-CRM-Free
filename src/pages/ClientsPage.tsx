// src/pages/ClientsPage.tsx
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, Users } from 'lucide-react'
import { listClients, type ClientFilters, type ClientSort } from '../services/clientService'
import {
  CLIENT_STATUSES,
  CLIENT_STATUS_LABELS,
  type Client,
  type ClientStatus,
} from '../types/client'
import { formatDate, formatPhone } from '../lib/format'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'

const PAGE_SIZE = 20
const EMPTY_FILTERS: ClientFilters = { search: '', status: '', city: '' }

const SORT_OPTIONS: Array<{ value: ClientSort; label: string }> = [
  { value: 'name_asc', label: 'Nome (A–Z)' },
  { value: 'name_desc', label: 'Nome (Z–A)' },
  { value: 'created_desc', label: 'Cadastro mais recente' },
  { value: 'updated_desc', label: 'Atualização mais recente' },
]

const STATUS_STYLES: Record<ClientStatus, string> = {
  active: 'bg-primary/15 text-primary',
  in_project: 'bg-accent/15 text-accent',
  awaiting_payment: 'bg-lime/15 text-lime',
  awaiting_approval: 'bg-pink/15 text-pink',
  project_completed: 'bg-mint/15 text-mint',
  inactive: 'bg-muted/15 text-muted',
}

interface ClientQuery {
  filters: ClientFilters
  sort: ClientSort
  page: number
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; clients: Client[]; total: number; query: ClientQuery }
  | { status: 'error'; message: string }
  | { status: 'refresh-error'; clients: Client[]; total: number; query: ClientQuery; message: string }

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'Erro ao carregar clientes.'
}

export function ClientsPage() {
  const navigate = useNavigate()
  const [draftFilters, setDraftFilters] = useState<ClientFilters>(EMPTY_FILTERS)
  const [filters, setFilters] = useState<ClientFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<ClientSort>('name_asc')
  const [page, setPage] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })
  const [refreshing, setRefreshing] = useState(false)
  const activeRef = useRef(true)
  const requestRef = useRef(0)
  const hasLoadedRef = useRef(false)

  const loadClients = useCallback(async (background: boolean) => {
    if (!activeRef.current) return
    const request = ++requestRef.current
    setRefreshing(background)
    if (!background) setLoadState({ status: 'loading' })

    try {
      const result = await listClients(filters, sort, page, PAGE_SIZE)
      if (!activeRef.current || request !== requestRef.current) return
      hasLoadedRef.current = true
      const lastPage = Math.max(0, Math.ceil(result.total / PAGE_SIZE) - 1)
      if (page > lastPage) {
        setPage(lastPage)
        return
      }
      setLoadState({
        status: 'ready',
        clients: result.clients,
        total: result.total,
        query: { filters: { ...filters }, sort, page },
      })
    } catch (error) {
      if (!activeRef.current || request !== requestRef.current) return
      const message = messageFrom(error)
      setLoadState((current) => {
        if (background && (current.status === 'ready' || current.status === 'refresh-error')) {
          return {
            status: 'refresh-error',
            clients: current.clients,
            total: current.total,
            query: current.query,
            message,
          }
        }
        return { status: 'error', message }
      })
    } finally {
      if (activeRef.current && request === requestRef.current) setRefreshing(false)
    }
  }, [filters, sort, page])

  useEffect(() => {
    activeRef.current = true
    void loadClients(hasLoadedRef.current)
    return () => {
      activeRef.current = false
      requestRef.current += 1
    }
  }, [loadClients, refreshKey])

  const submitFilters = (event: FormEvent) => {
    event.preventDefault()
    setFilters({ ...draftFilters })
    setPage(0)
    setRefreshKey((key) => key + 1)
  }

  const changeSort = (nextSort: ClientSort) => {
    setSort(nextSort)
    setPage(0)
    setRefreshKey((key) => key + 1)
  }

  const clearFilters = () => {
    setDraftFilters(EMPTY_FILTERS)
    setFilters(EMPTY_FILTERS)
    setPage(0)
    setRefreshKey((key) => key + 1)
  }

  const reload = () => setRefreshKey((key) => key + 1)
  const displayedQuery: ClientQuery = loadState.status === 'ready' || loadState.status === 'refresh-error'
    ? loadState.query
    : { filters, sort, page }
  const displayedPage = displayedQuery.page
  const totalPages = Math.max(1, Math.ceil(
    (loadState.status === 'ready' || loadState.status === 'refresh-error' ? loadState.total : 0) / PAGE_SIZE,
  ))
  const hasActiveFilters = Boolean(
    displayedQuery.filters.search || displayedQuery.filters.status || displayedQuery.filters.city,
  )

  const goToPage = (nextPage: number) => {
    setFilters(displayedQuery.filters)
    setSort(displayedQuery.sort)
    setPage(nextPage)
    setRefreshKey((key) => key + 1)
  }

  return (
    <div className="flex flex-col gap-5" aria-busy={refreshing}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Clientes</h1>
          <p className="text-sm text-muted">Busque, filtre e abra o cadastro de cada cliente.</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button type="button" variant="outline" onClick={reload}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Atualizar
          </Button>
          <Button type="button" variant="mint" onClick={() => navigate('/clientes/novo')}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Novo cliente
          </Button>
        </div>
      </div>

      <Card>
        <form onSubmit={submitFilters} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input
            label="Buscar cliente"
            placeholder="Nome, responsável, e-mail ou CNPJ"
            value={draftFilters.search}
            onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))}
          />
          <Select
            label="Status"
            placeholder="Todos os status"
            value={draftFilters.status}
            onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value }))}
            options={CLIENT_STATUSES.map((status) => ({
              value: status,
              label: `Status: ${CLIENT_STATUS_LABELS[status]}`,
            }))}
          />
          <Input
            label="Cidade"
            placeholder="Todas as cidades"
            value={draftFilters.city}
            onChange={(event) => setDraftFilters((current) => ({ ...current, city: event.target.value }))}
          />
          <Select
            label="Ordenar por"
            value={displayedQuery.sort}
            onChange={(event) => changeSort(event.target.value as ClientSort)}
            options={SORT_OPTIONS}
          />
          <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-4">
            <Button type="submit" variant="mint">Aplicar filtros</Button>
            <Button type="button" variant="ghost" onClick={clearFilters} disabled={!hasActiveFilters && !draftFilters.search && !draftFilters.city && !draftFilters.status}>
              Limpar filtros
            </Button>
            {refreshing && <span role="status" className="self-center text-xs text-muted">Atualizando clientes…</span>}
          </div>
        </form>
      </Card>

      {loadState.status === 'loading' ? (
        <Card><p role="status" className="text-sm text-muted">Carregando clientes…</p></Card>
      ) : loadState.status === 'error' ? (
        <Card className="border-danger/40" role="alert">
          <p className="text-sm font-medium text-danger">Não foi possível carregar os clientes.</p>
          <p className="mt-1 text-sm text-muted">{loadState.message}</p>
          <Button type="button" variant="outline" className="mt-3" onClick={reload}>Tentar novamente</Button>
        </Card>
      ) : (
        <>
          {loadState.status === 'refresh-error' && (
            <Card className="border-danger/40" role="alert">
              <p className="text-sm font-medium text-danger">Não foi possível atualizar a lista.</p>
              <p className="mt-1 text-sm text-muted">{loadState.message} Exibindo os últimos clientes carregados.</p>
              <Button type="button" variant="outline" className="mt-3" onClick={reload}>Tentar novamente</Button>
            </Card>
          )}

          {loadState.clients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum cliente encontrado."
              description={hasActiveFilters
                ? 'Ajuste os filtros ou cadastre um novo cliente.'
                : 'Cadastre o primeiro cliente e seu contrato inicial para começar.'}
              action={(
                <Link
                  to="/clientes/novo"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-mint px-4 text-sm font-medium text-bg transition-colors hover:bg-mint/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> Cadastrar cliente
                </Link>
              )}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {loadState.clients.map((client) => (
                  <Card key={client.id} className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="min-w-0 font-display text-base font-semibold text-ink">
                        <Link to={`/clientes/${client.id}`} className="hover:text-primary">
                          {client.name}
                        </Link>
                      </h2>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[client.status]}`}>
                        {CLIENT_STATUS_LABELS[client.status]}
                      </span>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-muted">Cidade</dt>
                        <dd className="text-ink">{client.city || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Telefone</dt>
                        <dd className="text-ink">{client.phone ? formatPhone(client.phone) : '—'}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-xs text-muted">Cadastro</dt>
                        <dd className="text-ink">{formatDate(client.created_at)}</dd>
                      </div>
                    </dl>
                  </Card>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
                <span role="status" aria-live="polite">Página {displayedPage + 1} de {totalPages}</span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" disabled={displayedPage === 0 || refreshing} onClick={() => goToPage(displayedPage - 1)}>Anterior</Button>
                  <Button type="button" variant="outline" disabled={displayedPage + 1 >= totalPages || refreshing} onClick={() => goToPage(displayedPage + 1)}>Próxima</Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
