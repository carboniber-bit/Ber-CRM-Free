import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, Trash2, Users } from 'lucide-react'
import { deleteLead, listLeads } from '../services/leadService'
import type { Lead, LeadFilters, LeadSort } from '../types/lead'
import { NICHE_LABELS, type Niche } from '../types/lead'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { ScoreBar } from '../components/ui/ScoreBar'
import { Skeleton } from '../components/ui/Skeleton'
import { StatusBadge } from '../components/ui/StatusBadge'
import { LeadFiltersBar } from '../components/leads/LeadFiltersBar'
import { useToast } from '../hooks/useToast'
import { formatBRL, formatDate } from '../lib/format'

const PAGE_SIZE = 20

export function LeadsPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [filters, setFilters] = useState<LeadFilters>({})
  const [sort, setSort] = useState<LeadSort>('created_desc')
  const [page, setPage] = useState(0)
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Lead | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    let active = true
    void listLeads(filters, sort, page, PAGE_SIZE).then(
      (result) => {
        if (!active) return
        setLeads(result.leads)
        setTotal(result.total)
        setError(null)
        setLoading(false)
      },
      (e: unknown) => {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Erro ao carregar leads.')
        setLoading(false)
      },
    )
    return () => { active = false }
  }, [filters, sort, page, refreshKey])

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
    setPage(0)
  }
  const changeSort = (next: LeadSort) => {
    startLoading()
    setSort(next)
    setPage(0)
  }
  const changePage = (nextPage: number) => {
    startLoading()
    setPage(nextPage)
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await deleteLead(deleting.id)
      toast('Lead excluído.', 'success')
      setDeleting(null)
      startLoading()
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
      if (page > 0 && leads.length === 1 && page + 1 >= totalPages) {
        setPage((currentPage) => Math.max(0, currentPage - 1))
      } else {
        setRefreshKey((key) => key + 1)
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro ao excluir.', 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasActiveFilters = Object.values(filters).some((value) => value !== undefined && value !== '')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Leads</h1>
          <p className="text-sm text-muted">{total} estabelecimento{total === 1 ? '' : 's'} cadastrado{total === 1 ? '' : 's'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reload}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
          <Button variant="mint" onClick={() => navigate('/leads/novo')}><Plus className="h-4 w-4" /> Novo lead</Button>
        </div>
      </div>

      <Card>
        <LeadFiltersBar filters={filters} sort={sort} onChange={changeFilters} onSortChange={changeSort} />
      </Card>

      {error ? (
        <Card className="border-danger/40" role="alert">
          <p className="text-sm text-danger">{error}</p>
          <Button variant="outline" className="mt-3" onClick={reload}>Tentar novamente</Button>
        </Card>
      ) : loading ? (
        <div className="flex flex-col gap-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title={total === 0 && !hasActiveFilters ? 'Nenhum lead cadastrado' : 'Nenhum lead encontrado'}
          description={total === 0 && !hasActiveFilters
            ? 'Cadastre o primeiro estabelecimento para começar a prospectar. Você também pode importar uma planilha CSV.'
            : 'Ajuste os filtros ou a busca para encontrar o que procura.'}
          action={<Button variant="mint" onClick={() => navigate('/leads/novo')}><Plus className="h-4 w-4" /> Cadastrar lead</Button>}
        />
      ) : (
        <>
          {/* Desktop: tabela */}
          <Card className="hidden overflow-x-auto p-0 md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Estabelecimento</th>
                  <th className="px-4 py-3 font-medium">Nicho</th>
                  <th className="px-4 py-3 font-medium">Cidade</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Pontuação</th>
                  <th className="px-4 py-3 font-medium">Valor est.</th>
                  <th className="px-4 py-3 font-medium">Cadastro</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-line/50 transition-colors last:border-0 hover:bg-elevated/50">
                    <td className="px-4 py-3">
                      <Link to={`/leads/${lead.id}`} className="font-medium text-ink hover:text-primary">{lead.name}</Link>
                      {lead.responsible_name && <p className="text-xs text-muted">{lead.responsible_name}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted">{lead.niche ? NICHE_LABELS[lead.niche as Niche] ?? lead.niche : '—'}</td>
                    <td className="px-4 py-3 text-muted">{lead.city ?? '—'}{lead.district ? ` · ${lead.district}` : ''}</td>
                    <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                    <td className="px-4 py-3"><div className="w-28"><ScoreBar score={lead.score} /></div></td>
                    <td className="px-4 py-3 text-muted">{formatBRL(lead.estimated_value)}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(lead.created_at)}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => setDeleting(lead)} aria-label={`Excluir ${lead.name}`} className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile: cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {leads.map((lead) => (
              <Card key={lead.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/leads/${lead.id}`} className="font-medium text-ink hover:text-primary">{lead.name}</Link>
                  <button type="button" onClick={() => setDeleting(lead)} aria-label={`Excluir ${lead.name}`} className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {lead.niche ? NICHE_LABELS[lead.niche as Niche] ?? lead.niche : 'Sem nicho'} · {lead.city ?? 'Sem cidade'}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <StatusBadge status={lead.status} />
                  <span className="text-xs text-muted">{formatBRL(lead.estimated_value)}</span>
                </div>
                <div className="mt-3"><ScoreBar score={lead.score} /></div>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between text-sm text-muted">
            <span>Página {page + 1} de {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page === 0} onClick={() => changePage(page - 1)}>Anterior</Button>
              <Button variant="outline" disabled={page + 1 >= totalPages} onClick={() => changePage(page + 1)}>Próxima</Button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir lead"
        description={`Excluir "${deleting?.name}"? Todas as atividades, follow-ups e verificações deste lead também serão removidos. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleteLoading}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
