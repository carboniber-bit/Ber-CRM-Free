import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  DndContext, PointerSensor, pointerWithin, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { FolderKanban, LayoutGrid, List, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useProjectStatusQueue } from '../hooks/useProjectStatusQueue'
import { useToast } from '../hooks/useToast'
import { formatMoney } from '../lib/money'
import { listClients } from '../services/clientService'
import { listProjects, listProjectsForBoard } from '../services/projectService'
import {
  PROJECT_MOVE_STATUSES, PROJECT_STATUSES,
  type ProjectFilters, type ProjectListItem, type ProjectMoveStatus,
  type ProjectPriority, type ProjectSort, type ProjectStatus,
} from '../types/project'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Skeleton } from '../components/ui/Skeleton'
import { ProjectCard, formatProjectDate } from '../components/projects/ProjectCard'
import { ProjectKanbanColumn } from '../components/projects/ProjectKanbanColumn'
import { PROJECT_PRIORITY_LABELS, ProjectPriorityBadge } from '../components/projects/ProjectPriorityBadge'
import { PROJECT_STATUS_LABELS, ProjectStatusBadge } from '../components/projects/ProjectStatusBadge'

type ViewMode = 'cards' | 'list' | 'kanban'
interface FilterDraft {
  search: string
  clientId: string
  status: string
  priority: string
  dueFrom: string
  dueTo: string
}

const EMPTY_FILTERS: FilterDraft = {
  search: '', clientId: '', status: '', priority: '', dueFrom: '', dueTo: '',
}
const SORT_OPTIONS: Array<{ value: ProjectSort; label: string }> = [
  { value: 'name_asc', label: 'Nome: A–Z' },
  { value: 'name_desc', label: 'Nome: Z–A' },
  { value: 'due_asc', label: 'Prazo mais próximo' },
  { value: 'due_desc', label: 'Prazo mais distante' },
  { value: 'created_desc', label: 'Mais recentes' },
]

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function isMoveStatus(value: string): value is ProjectMoveStatus {
  return (PROJECT_MOVE_STATUSES as readonly string[]).includes(value)
}

function ProjectEmptyState() {
  return (
    <EmptyState
      icon={FolderKanban}
      title="Nenhum projeto encontrado."
      description="Cadastre o primeiro projeto ou ajuste os filtros para ver outros resultados."
      action={(
        <Link
          to="/projetos/novo"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-mint px-4 text-sm font-medium text-bg transition-colors hover:bg-mint/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Criar projeto
        </Link>
      )}
    />
  )
}

export function ProjectsPage() {
  const { toast } = useToast()
  const [view, setView] = useState<ViewMode>('cards')
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS)
  const [filters, setFilters] = useState<ProjectFilters>({})
  const [sort, setSort] = useState<ProjectSort>('name_asc')
  const [page, setPage] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [listResult, setListResult] = useState<{ projects: ProjectListItem[]; total: number }>({
    projects: [], total: 0,
  })
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [listHasLoaded, setListHasLoaded] = useState(false)
  const [clientOptions, setClientOptions] = useState<Array<{ value: string; label: string }>>([])
  const [clientLoadError, setClientLoadError] = useState<string | null>(null)
  const [boardProjects, setBoardProjects] = useState<ProjectListItem[]>([])
  const [boardLoading, setBoardLoading] = useState(false)
  const [boardError, setBoardError] = useState<string | null>(null)
  const [boardPartial, setBoardPartial] = useState(false)
  const [boardHasLoaded, setBoardHasLoaded] = useState(false)
  const listRequestRef = useRef(0)
  const boardRequestRef = useRef(0)
  const mountedRef = useRef(true)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    mountedRef.current = true
    let active = true
    void listClients({ search: '', status: '', city: '' }, 'name_asc', 0, 100).then(
      (result) => {
        if (!active) return
        setClientOptions(result.clients.map((client) => ({ value: client.id, label: client.name })))
      },
      () => {
        if (active) setClientLoadError('Não foi possível carregar o filtro de clientes.')
      },
    )
    return () => {
      active = false
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (view === 'kanban') return
    let active = true
    const request = ++listRequestRef.current
    setListLoading(true)
    setListError(null)
    void listProjects(filters, sort, page, 24).then(
      (result) => {
        if (!active || !mountedRef.current || request !== listRequestRef.current) return
        setListResult(result)
        setListHasLoaded(true)
        setListLoading(false)
      },
      (error: unknown) => {
        if (!active || !mountedRef.current || request !== listRequestRef.current) return
        setListError(errorMessage(error, 'Não foi possível carregar os projetos. Tente novamente.'))
        setListLoading(false)
      },
    )
    return () => { active = false }
  }, [view, filters, sort, page, reloadKey])

  const loadBoard = useCallback(async (): Promise<void> => {
    const request = ++boardRequestRef.current
    setBoardLoading(true)
    setBoardError(null)
    try {
      const result = await listProjectsForBoard(filters)
      if (!mountedRef.current || request !== boardRequestRef.current) return
      setBoardProjects(result.projects)
      setBoardPartial(result.partial)
      setBoardHasLoaded(true)
    } catch (error) {
      if (!mountedRef.current || request !== boardRequestRef.current) return
      setBoardError(errorMessage(error, 'Não foi possível carregar o Kanban. Tente novamente.'))
    } finally {
      if (mountedRef.current && request === boardRequestRef.current) setBoardLoading(false)
    }
  }, [filters])

  const queue = useProjectStatusQueue({
    projects: boardProjects,
    onChange: setBoardProjects,
    onRefresh: loadBoard,
  })

  useEffect(() => {
    if (view !== 'kanban') return
    void queue.requestRefresh()
  }, [view, filters, queue.requestRefresh])

  const changeView = (next: ViewMode) => {
    if (next === view) return
    listRequestRef.current += 1
    boardRequestRef.current += 1
    setView(next)
  }

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next: ProjectFilters = {}
    if (draftFilters.search.trim()) next.search = draftFilters.search.trim()
    if (draftFilters.clientId) next.clientId = draftFilters.clientId
    if (draftFilters.status) next.status = draftFilters.status as ProjectStatus
    if (draftFilters.priority) next.priority = draftFilters.priority as ProjectPriority
    if (draftFilters.dueFrom) next.dueFrom = draftFilters.dueFrom
    if (draftFilters.dueTo) next.dueTo = draftFilters.dueTo
    setFilters(next)
    setPage(0)
  }

  const moveProject = useCallback(async (id: string, status: ProjectMoveStatus): Promise<void> => {
    try {
      await queue.moveProject(id, status)
    } catch (error) {
      toast(errorMessage(error, 'Não foi possível mover o projeto. Tente novamente.'), 'error')
    }
  }, [queue.moveProject, toast])

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : ''
    if (!activeId.startsWith('project:') || !overId.startsWith('column:')) return
    const status = overId.slice('column:'.length)
    if (!isMoveStatus(status)) return
    void moveProject(activeId.slice('project:'.length), status)
  }

  const refreshBoard = () => {
    void queue.requestRefresh().catch((error: unknown) => {
      toast(errorMessage(error, 'Não foi possível atualizar o Kanban.'), 'error')
    })
  }
  const totalPages = Math.max(1, Math.ceil(listResult.total / 24))

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Projetos</h1>
          <p className="mt-1 text-sm text-muted">Acompanhe execução, tarefas e entregas sem alterar o financeiro.</p>
        </div>
        <Link
          to="/projetos/novo"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-mint px-4 text-sm font-medium text-bg transition-colors hover:bg-mint/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Novo projeto
        </Link>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" aria-label="Modo de visualização">
          <Button variant={view === 'cards' ? 'primary' : 'outline'} aria-pressed={view === 'cards'} onClick={() => changeView('cards')}>
            <LayoutGrid className="mr-2 h-4 w-4" aria-hidden="true" />Cards
          </Button>
          <Button variant={view === 'list' ? 'primary' : 'outline'} aria-pressed={view === 'list'} onClick={() => changeView('list')}>
            <List className="mr-2 h-4 w-4" aria-hidden="true" />Lista
          </Button>
          <Button variant={view === 'kanban' ? 'primary' : 'outline'} aria-pressed={view === 'kanban'} onClick={() => changeView('kanban')}>
            <FolderKanban className="mr-2 h-4 w-4" aria-hidden="true" />Kanban
          </Button>
        </div>
        {view === 'kanban' ? (
          <Button variant="outline" loading={boardLoading} onClick={refreshBoard}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />Atualizar Kanban
          </Button>
        ) : (
          <Button variant="outline" loading={listLoading} onClick={() => setReloadKey((key) => key + 1)}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />Atualizar projetos
          </Button>
        )}
      </div>

      <Card>
        <form className="flex flex-col gap-4" onSubmit={applyFilters}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input label="Buscar projetos" value={draftFilters.search} onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))} />
            <Select
              label="Cliente"
              value={draftFilters.clientId}
              options={[{ value: '', label: 'Todos os clientes' }, ...clientOptions]}
              onChange={(event) => setDraftFilters((current) => ({ ...current, clientId: event.target.value }))}
            />
            <Select
              label="Status"
              value={draftFilters.status}
              options={[{ value: '', label: 'Todos os status' }, ...PROJECT_STATUSES.map((status) => ({ value: status, label: PROJECT_STATUS_LABELS[status] }))]}
              onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value }))}
            />
            <Select
              label="Prioridade"
              value={draftFilters.priority}
              options={[{ value: '', label: 'Todas as prioridades' }, ...Object.entries(PROJECT_PRIORITY_LABELS).map(([value, label]) => ({ value, label }))]}
              onChange={(event) => setDraftFilters((current) => ({ ...current, priority: event.target.value }))}
            />
            <Input label="Prazo inicial" type="date" value={draftFilters.dueFrom} onChange={(event) => setDraftFilters((current) => ({ ...current, dueFrom: event.target.value }))} />
            <Input label="Prazo final" type="date" value={draftFilters.dueTo} onChange={(event) => setDraftFilters((current) => ({ ...current, dueTo: event.target.value }))} />
            <Select label="Ordenação" value={sort} options={SORT_OPTIONS} onChange={(event) => { setSort(event.target.value as ProjectSort); setPage(0) }} />
          </div>
          {clientLoadError && <p className="text-sm text-danger">{clientLoadError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary">Aplicar filtros</Button>
            <Button type="button" variant="ghost" onClick={() => { setDraftFilters(EMPTY_FILTERS); setFilters({}); setPage(0) }}>Limpar filtros</Button>
          </div>
        </form>
      </Card>

      {view === 'kanban' ? (
        <section className="flex flex-col gap-4" aria-label="Kanban de projetos">
          <p className="text-sm text-muted">Kanban com os filtros aplicados, limitado a 500 projetos não arquivados e não cancelados.</p>
          {boardPartial && (
            <div className="rounded-xl border border-lime/40 bg-lime/5 p-4 text-sm text-lime" role="status">
              Mostrando até 500 projetos. O resultado do Kanban é parcial; use a lista filtrada para localizar projetos fora deste recorte.
            </div>
          )}
          {boardError && (
            <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
              <p className="text-sm text-danger">{boardError}</p>
              <Button type="button" variant="outline" className="mt-3" onClick={refreshBoard}>Tentar novamente</Button>
            </div>
          )}
          {boardLoading && !boardHasLoaded ? (
            <div className="flex gap-4 overflow-x-auto pb-3" aria-busy="true">
              {PROJECT_STATUSES.map((status) => <Skeleton key={status} className="h-80 w-[300px] shrink-0" />)}
              <span className="sr-only">Carregando Kanban…</span>
            </div>
          ) : boardHasLoaded ? (
            queue.projects.length === 0 ? boardError ? null : <ProjectEmptyState /> : (
              <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
                <div className="flex gap-4 overflow-x-auto pb-3">
                  {PROJECT_STATUSES.map((status) => (
                    <ProjectKanbanColumn
                      key={status}
                      status={status}
                      projects={queue.projects.filter((project) => project.status === status)}
                      pendingIds={queue.pendingIds}
                      onMove={moveProject}
                    />
                  ))}
                </div>
              </DndContext>
            )
          ) : null}
        </section>
      ) : (
        <section aria-label="Projetos">
          {listError && (
            <div className="mb-4 rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
              <p className="text-sm text-danger">{listError}</p>
              <Button type="button" variant="outline" className="mt-3" onClick={() => setReloadKey((key) => key + 1)}>Tentar novamente</Button>
            </div>
          )}
          {listLoading && !listHasLoaded ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
              {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-64" />)}
              <span className="sr-only">Carregando projetos…</span>
            </div>
          ) : !listHasLoaded && listError ? null : listHasLoaded && listResult.projects.length === 0 && !listError ? <ProjectEmptyState /> : (
            <>
              {view === 'cards' ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy={listLoading}>
                  {listResult.projects.map((project) => <ProjectCard key={project.id} project={project} />)}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-line bg-surface" aria-busy={listLoading}>
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="border-b border-line text-xs uppercase text-muted">
                      <tr>
                        <th className="px-4 py-3">Projeto</th><th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Prioridade</th><th className="px-4 py-3">Prazo</th>
                        <th className="px-4 py-3">Valor</th><th className="px-4 py-3">Progresso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listResult.projects.map((project) => (
                        <tr key={project.id} className="border-b border-line last:border-0">
                          <td className="px-4 py-3">
                            <Link className="font-semibold text-ink hover:text-primary" to={`/projetos/${project.id}`}>{project.name}</Link>
                            <p className="text-xs text-muted">{project.client_name || project.client_id} · {project.service}</p>
                          </td>
                          <td className="px-4 py-3"><ProjectStatusBadge status={project.status} /></td>
                          <td className="px-4 py-3"><ProjectPriorityBadge priority={project.priority} /></td>
                          <td className="px-4 py-3">{formatProjectDate(project.due_date)}</td>
                          <td className="px-4 py-3">{formatMoney(project.contracted_value_cents)}</td>
                          <td className="px-4 py-3">{project.progressPercent === null ? 'Sem tarefas ativas' : `${project.progressPercent}%`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-sm text-muted">Página {page + 1} de {totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>Página anterior</Button>
                  <Button variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((current) => current + 1)}>Próxima página</Button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}
