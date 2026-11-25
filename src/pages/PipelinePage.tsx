import { useEffect, useMemo, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { FolderKanban, RefreshCw } from 'lucide-react'
import { listLeads, setLeadStatus } from '../services/leadService'
import {
  LEAD_STATUSES, NICHES, NICHE_LABELS, PRIORITIES, PRIORITY_LABELS,
  STATUS_LABELS, type Lead, type LeadFilters, type LeadStatus,
} from '../types/lead'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Skeleton } from '../components/ui/Skeleton'
import { KanbanCardBody } from '../components/pipeline/KanbanCard'
import { KanbanColumn } from '../components/pipeline/KanbanColumn'
import { useToast } from '../hooks/useToast'

const PIPELINE_PAGE_SIZE = 500
// Cidade é texto livre: tecla não pode virar consulta. Aqui basta um valor atrasado
// (o quadro inteiro depende do mesmo objeto de filtros).
const DEBOUNCE_MS = 300

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => { setDebounced(value) }, delayMs)
    return () => { clearTimeout(timer) }
  }, [value, delayMs])
  return debounced
}

// O quadro desenha apenas a página carregada: quando ela enche, dizer "500" sem dizer que
// há mais seria uma contagem que os próprios dados contradizem.
function windowHint(listed: number, total: number): string | null {
  if (listed < PIPELINE_PAGE_SIZE) return null
  const shown = `Mostrando os primeiros ${listed} leads`
  return total > listed
    ? `${shown}; há ${total} no pipeline. Ajuste os filtros para reduzir a lista.`
    : `${shown}. Ajuste os filtros para reduzir a lista.`
}

export function PipelinePage() {
  const { toast } = useToast()
  const [filters, setFilters] = useState<LeadFilters>({})
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [mobileColumn, setMobileColumn] = useState<LeadStatus>('novo')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const queryFilters = useDebouncedValue(filters, DEBOUNCE_MS)

  useEffect(() => {
    let active = true
    void listLeads(queryFilters, 'score_desc', 0, PIPELINE_PAGE_SIZE).then(
      (result) => {
        if (!active) return
        setLeads(result.leads)
        setTotal(result.total)
        setError(null)
        setLoading(false)
      },
      (e: unknown) => {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Erro ao carregar pipeline.')
        setLoading(false)
      },
    )
    return () => { active = false }
  }, [queryFilters, refreshKey])

  const byStatus = useMemo(() => {
    const map = new Map<LeadStatus, Lead[]>(LEAD_STATUSES.map((s) => [s, []]))
    for (const lead of leads) map.get(lead.status)?.push(lead)
    return map
  }, [leads])

  const mobileLeads = byStatus.get(mobileColumn) ?? []
  const hint = windowHint(leads.length, total)
  const hasActiveFilters = Object.values(queryFilters).some((value) => value !== undefined && value !== '')

  // O arraste é a confirmação do usuário (spec: no Kanban não há diálogo extra).
  const moveLead = async (leadId: string, status: LeadStatus) => {
    const lead = leads.find((l) => l.id === leadId)
    if (!lead || lead.status === status) return
    const previous = lead.status
    setLeads((current) => current.map((l) => (l.id === leadId ? { ...l, status } : l)))
    try {
      await setLeadStatus(leadId, status)
      toast(`"${lead.name}" movido para ${STATUS_LABELS[status]}.`)
    } catch (e) {
      setLeads((current) => current.map((l) => (l.id === leadId ? { ...l, status: previous } : l)))
      toast(e instanceof Error ? e.message : 'Erro ao mover lead.', 'error')
    }
  }

  const onDragEnd = (event: DragEndEvent) => {
    const status = event.over?.id as LeadStatus | undefined
    if (status) void moveLead(String(event.active.id), status)
  }

  const set = (patch: Partial<LeadFilters>) => {
    setLoading(true)
    setError(null)
    setFilters((current) => ({ ...current, ...patch }))
  }
  const reload = () => {
    setLoading(true)
    setError(null)
    setRefreshKey((key) => key + 1)
  }
  const clearFilters = () => {
    setLoading(true)
    setError(null)
    setFilters({})
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Pipeline</h1>
          <p className="text-sm text-muted">Arraste os leads entre as colunas para atualizar o status</p>
        </div>
        <Button variant="outline" onClick={reload}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label="Nicho"
            placeholder="Todos"
            value={filters.niche ?? ''}
            onChange={(e) => set({ niche: e.target.value || undefined })}
            options={NICHES.map((n) => ({ value: n, label: NICHE_LABELS[n] }))}
          />
          <Input
            label="Cidade"
            placeholder="Todas"
            value={filters.city ?? ''}
            onChange={(e) => set({ city: e.target.value || undefined })}
          />
          <Select
            label="Prioridade"
            placeholder="Todas"
            value={filters.priority ?? ''}
            onChange={(e) => set({ priority: (e.target.value || undefined) as LeadFilters['priority'] })}
            options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
          />
        </div>
      </Card>

      {error ? (
        <Card className="border-danger/40" role="alert">
          <p className="text-sm text-danger">{error}</p>
          <Button variant="outline" className="mt-3" onClick={reload}>Tentar novamente</Button>
        </Card>
      ) : loading ? (
        <div className="flex gap-4 overflow-hidden">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-96 w-72 shrink-0" />)}</div>
      ) : leads.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            icon={FolderKanban}
            title="Nenhum lead com esses filtros"
            description="Nenhum lead atende aos filtros aplicados. Limpe os filtros para ver o pipeline completo."
            action={<Button variant="outline" onClick={clearFilters}>Limpar filtros</Button>}
          />
        ) : (
          <EmptyState
            icon={FolderKanban}
            title="Pipeline vazio"
            description="Cadastre leads para vê-los aqui. Cada coluna representa um status comercial; arrastar um lead atualiza o status e registra no histórico."
          />
        )
      ) : (
        <>
          {hint && (
            <p role="status" aria-label="Janela do pipeline" className="text-xs text-muted">{hint}</p>
          )}
          {/* Desktop: quadro completo com scroll horizontal e arraste. */}
          <div className="hidden md:block">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <div className="flex gap-4 overflow-x-auto pb-4">
                {LEAD_STATUSES.map((status) => <KanbanColumn key={status} status={status} leads={byStatus.get(status) ?? []} />)}
              </div>
            </DndContext>
          </div>

          {/* Mobile: uma coluna por vez, sem useDraggable (o card aqui não tem DndContext). */}
          <div className="flex flex-col gap-3 md:hidden">
            <Select
              label="Coluna"
              value={mobileColumn}
              onChange={(e) => setMobileColumn(e.target.value as LeadStatus)}
              options={LEAD_STATUSES.map((s) => ({ value: s, label: `${STATUS_LABELS[s]} (${byStatus.get(s)?.length ?? 0})` }))}
            />
            {mobileLeads.length > 0 ? (
              <div role="list" aria-label={`Leads em ${STATUS_LABELS[mobileColumn]}`} className="flex flex-col gap-3">
                {mobileLeads.map((lead) => (
                  <div key={lead.id} role="listitem" className="flex flex-col gap-2">
                    <KanbanCardBody lead={lead} />
                    <Select
                      label="Mover para"
                      placeholder="Escolha o novo status"
                      value=""
                      onChange={(e) => { if (e.target.value) void moveLead(lead.id, e.target.value as LeadStatus) }}
                      options={LEAD_STATUSES.map((s) => ({
                        value: s,
                        label: s === lead.status ? `${STATUS_LABELS[s]} (atual)` : STATUS_LABELS[s],
                      }))}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-muted">Nenhum lead nesta coluna.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
