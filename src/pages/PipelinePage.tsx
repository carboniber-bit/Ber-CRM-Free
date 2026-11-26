import { useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, PointerSensor, pointerWithin, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { FolderKanban, RefreshCw } from 'lucide-react'
import { listLeads, setLeadStatus } from '../services/leadService'
import { listLeadClientLinks } from '../services/clientService'
import { statusFromDragEnd } from '../lib/pipeline'
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
import { KanbanCardBody, LeadConversionAction } from '../components/pipeline/KanbanCard'
import { KanbanColumn } from '../components/pipeline/KanbanColumn'
import { ConversionDialog } from '../components/leads/ConversionDialog'
import { useToast } from '../hooks/useToast'

const PIPELINE_PAGE_SIZE = 500
// Só Cidade é texto livre: uma tecla não pode virar consulta. Nicho e Prioridade são escolhas
// deliberadas de select — atrasá-las em 300 ms exibe skeletons antes de a consulta sair.
const FREE_TEXT_DEBOUNCE_MS = 300

// O quadro desenha apenas a página carregada: quando ela enche, dizer "500" sem dizer que
// há mais seria uma contagem que os próprios dados contradizem.
function windowHint(listed: number, total: number): string | null {
  if (listed < PIPELINE_PAGE_SIZE) return null
  const shown = `Mostrando os primeiros ${listed} leads`
  return total > listed
    ? `${shown}; há ${total} no pipeline. Ajuste os filtros para reduzir a lista.`
    : `${shown}. Ajuste os filtros para reduzir a lista.`
}

function pipelineQueryKey(filters: LeadFilters): string {
  return JSON.stringify([filters.niche ?? null, filters.city ?? null, filters.priority ?? null])
}

export function PipelinePage() {
  const { toast } = useToast()
  // `filters` alimenta o formulário (tecla a tecla); `queryFilters` é o que foi confirmado para a
  // consulta — os dois só divergem enquanto há digitação em Cidade atrasada.
  const [filters, setFilters] = useState<LeadFilters>({})
  const [queryFilters, setQueryFilters] = useState<LeadFilters>({})
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [mobileColumn, setMobileColumn] = useState<LeadStatus>('novo')
  const [convertedClientIds, setConvertedClientIds] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [linksReady, setLinksReady] = useState(false)
  const [linksError, setLinksError] = useState<string | null>(null)
  const [linksRetryKey, setLinksRetryKey] = useState(0)
  const [conversionLead, setConversionLead] = useState<Lead | null>(null)
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leadsRef = useRef<Lead[]>([])
  const loadedQueryKeyRef = useRef<string | null>(null)
  const mutationVersionRef = useRef(0)
  const pendingMovesRef = useRef(0)
  const refreshAfterMovesRef = useRef(false)
  const moveQueuesRef = useRef(new Map<string, Promise<void>>())
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const updateLeads = (updater: (current: Lead[]) => Lead[]) => {
    const next = updater(leadsRef.current)
    leadsRef.current = next
    setLeads(next)
  }

  const cancelPendingCommit = () => {
    if (commitTimer.current) {
      clearTimeout(commitTimer.current)
      commitTimer.current = null
    }
  }
  // Desmontar com tecla pendente não pode disparar consulta órfã.
  useEffect(() => () => { cancelPendingCommit() }, [])

  useEffect(() => {
    let active = true
    const requestedVersion = mutationVersionRef.current
    const requestedDuringMove = pendingMovesRef.current > 0
    const discardStaleResult = () => {
      if (!requestedDuringMove && requestedVersion === mutationVersionRef.current) return false
      if (pendingMovesRef.current > 0) {
        refreshAfterMovesRef.current = true
      } else {
        setRefreshKey((key) => key + 1)
      }
      return true
    }
    void listLeads(queryFilters, 'score_desc', 0, PIPELINE_PAGE_SIZE).then(
      (result) => {
        if (!active || discardStaleResult()) return
        leadsRef.current = result.leads
        setLeads(result.leads)
        setTotal(result.total)
        setError(null)
        loadedQueryKeyRef.current = pipelineQueryKey(queryFilters)
        setLoading(false)
      },
      (e: unknown) => {
        if (!active || discardStaleResult()) return
        setError(e instanceof Error ? e.message : 'Erro ao carregar pipeline.')
        setLoading(false)
      },
    )
    return () => { active = false }
  }, [queryFilters, refreshKey])

  useEffect(() => {
    let active = true
    setLinksReady(false)
    setLinksError(null)
    void listLeadClientLinks().then(
      (links) => {
        if (!active) return
        const next = new Map<string, string>()
        for (const link of links) next.set(link.lead_id, link.client_id)
        setConvertedClientIds(next)
        setLinksReady(true)
      },
      (cause: unknown) => {
        if (!active) return
        setLinksReady(false)
        setLinksError(cause instanceof Error ? cause.message : 'Erro ao carregar vínculos de conversão.')
      },
    )
    return () => { active = false }
  }, [refreshKey, linksRetryKey])

  const byStatus = useMemo(() => {
    const map = new Map<LeadStatus, Lead[]>(LEAD_STATUSES.map((s) => [s, []]))
    for (const lead of leads) map.get(lead.status)?.push(lead)
    return map
  }, [leads])

  const mobileLeads = byStatus.get(mobileColumn) ?? []
  const hint = windowHint(leads.length, total)
  const hasActiveFilters = Object.values(queryFilters).some((value) => value !== undefined && value !== '')

  // O arraste é a confirmação do usuário (spec: no Kanban não há diálogo extra).
  const moveLead = (leadId: string, status: LeadStatus) => {
    const performMove = async () => {
      const lead = leadsRef.current.find((l) => l.id === leadId)
      if (!lead || lead.status === status) return
      const previous = lead.status
      pendingMovesRef.current += 1
      mutationVersionRef.current += 1
      updateLeads((current) => current.map((l) => (l.id === leadId ? { ...l, status } : l)))
      try {
        const updated = await setLeadStatus(leadId, status)
        mutationVersionRef.current += 1
        updateLeads((current) => current.map((l) => (l.id === leadId ? updated : l)))
        toast(`"${lead.name}" movido para ${STATUS_LABELS[status]}.`)
      } catch (e) {
        mutationVersionRef.current += 1
        updateLeads((current) => current.map((l) => (
          l.id === leadId && l.status === status ? { ...l, status: previous } : l
        )))
        toast(e instanceof Error ? e.message : 'Erro ao mover lead.', 'error')
      } finally {
        pendingMovesRef.current -= 1
        if (pendingMovesRef.current === 0 && refreshAfterMovesRef.current) {
          refreshAfterMovesRef.current = false
          setRefreshKey((key) => key + 1)
        }
      }
    }

    const pending = moveQueuesRef.current.get(leadId)
    const task = pending ? pending.then(performMove, performMove) : performMove()
    moveQueuesRef.current.set(leadId, task)
    const cleanup = () => {
      if (moveQueuesRef.current.get(leadId) === task) moveQueuesRef.current.delete(leadId)
    }
    void task.then(cleanup, cleanup)
    return task
  }

  // O arraste é a confirmação: sem coluna sob o ponteiro não há `over` (pointerWithin) e
  // status algum é gravado — soltar no vazio não reescreve o pipeline.
  const onDragEnd = (event: DragEndEvent) => {
    const status = statusFromDragEnd(event)
    if (status) void moveLead(String(event.active.id), status)
  }

  const handleOpenConversion = (lead: Lead) => {
    if (!linksReady || linksError || convertedClientIds.has(lead.id)) return
    setConversionLead(lead)
  }

  const handleConverted = () => {
    setConversionLead(null)
    setLinksRetryKey((key) => key + 1)
    setRefreshKey((key) => key + 1)
  }

  const commit = (next: LeadFilters) => {
    setQueryFilters(next)
    setLoading(true)
    setError(null)
  }
  const changeFilters = (patch: Partial<LeadFilters>, freeText = false) => {
    const next = { ...filters, ...patch }
    setFilters(next)
    cancelPendingCommit()
    if (!freeText) {
      commit(next)
      return
    }
    commitTimer.current = setTimeout(() => {
      commitTimer.current = null
      commit(next)
    }, FREE_TEXT_DEBOUNCE_MS)
  }
  const reload = () => {
    cancelPendingCommit()
    setLoading(true)
    setError(null)
    // "Atualizar" confirma inclusive a cidade ainda em digitação: recarregar é um pedido explícito.
    setQueryFilters(filters)
    setRefreshKey((key) => key + 1)
  }
  const clearFilters = () => {
    cancelPendingCommit()
    setFilters({})
    commit({})
  }

  const hasLeadSnapshot = loadedQueryKeyRef.current === pipelineQueryKey(queryFilters)

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
            onChange={(e) => changeFilters({ niche: e.target.value || undefined })}
            options={NICHES.map((n) => ({ value: n, label: NICHE_LABELS[n] }))}
          />
          <Input
            label="Cidade"
            placeholder="Todas"
            value={filters.city ?? ''}
            onChange={(e) => changeFilters({ city: e.target.value || undefined }, true)}
          />
          <Select
            label="Prioridade"
            placeholder="Todas"
            value={filters.priority ?? ''}
            onChange={(e) => changeFilters({ priority: (e.target.value || undefined) as LeadFilters['priority'] })}
            options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
          />
        </div>
      </Card>

      {error && hasLeadSnapshot && (
        <Card className="border-danger/40" role="alert">
          <p className="text-sm font-medium text-danger">Não foi possível atualizar o pipeline.</p>
          <p className="mt-1 text-sm text-muted">{error} Exibindo o último snapshot carregado.</p>
          <Button variant="outline" className="mt-3" onClick={reload}>Tentar novamente</Button>
        </Card>
      )}

      {linksError && (
        <Card className="border-danger/40" role="alert">
          <p className="text-sm font-medium text-danger">Não foi possível carregar os vínculos de conversão.</p>
          <p className="mt-1 text-sm text-muted">{linksError} A conversão não pode ser verificada; os leads continuam visíveis.</p>
          <Button variant="outline" className="mt-3" onClick={() => setLinksRetryKey((key) => key + 1)}>
            Tentar novamente
          </Button>
        </Card>
      )}

      {error && !hasLeadSnapshot ? (
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
          {/* Sem aria-label na dica: o texto É a mensagem — um rótulo o substituiria na fala. */}
          {hint && <p role="status" className="text-xs text-muted">{hint}</p>}
          {/* Desktop: quadro completo com scroll horizontal e arraste. */}
          <div className="hidden md:block">
            <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={onDragEnd}>
              <div className="flex gap-4 overflow-x-auto pb-4">
                {LEAD_STATUSES.map((status) => (
                  <KanbanColumn
                    key={status}
                    status={status}
                    leads={byStatus.get(status) ?? []}
                    onMove={moveLead}
                    convertedClientIds={convertedClientIds}
                    onConvert={linksReady && !linksError ? handleOpenConversion : undefined}
                  />
                ))}
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
                    <KanbanCardBody
                      lead={lead}
                      conversionAction={(
                        <LeadConversionAction
                          lead={lead}
                          convertedClientId={convertedClientIds.get(lead.id)}
                          onConvert={linksReady && !linksError ? handleOpenConversion : undefined}
                        />
                      )}
                    />
                    <Select
                      label={`Mover ${lead.name} para`}
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

      {conversionLead && (
        <ConversionDialog
          open
          lead={conversionLead}
          existingClientId={convertedClientIds.get(conversionLead.id) ?? null}
          onClose={() => setConversionLead(null)}
          onConverted={handleConverted}
        />
      )}
    </div>
  )
}
