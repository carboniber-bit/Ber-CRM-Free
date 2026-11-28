import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, FolderKanban } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ProjectDeliveryPanel } from '../components/projects/ProjectDeliveryPanel'
import { ProjectForm } from '../components/projects/ProjectForm'
import { ProjectRevisionList } from '../components/projects/ProjectRevisionList'
import { ProjectTaskList } from '../components/projects/ProjectTaskList'
import { PROJECT_PRIORITY_LABELS, ProjectPriorityBadge } from '../components/projects/ProjectPriorityBadge'
import { PROJECT_STATUS_LABELS, ProjectStatusBadge } from '../components/projects/ProjectStatusBadge'
import { formatProjectDate } from '../components/projects/ProjectCard'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../hooks/useToast'
import { formatMoney } from '../lib/money'
import { calculateProjectProgress } from '../lib/projectProgress'
import { getProject, setProjectStatus } from '../services/projectService'
import {
  PROJECT_MOVE_STATUSES, type ProjectDetail, type ProjectMoveStatus, type ProjectTask,
} from '../types/project'
import type { ClientActivity } from '../types/client'

type TabKey = 'overview' | 'tasks' | 'revisions' | 'delivery' | 'history'
type ProjectLoadState =
  | { status: 'loading' }
  | { status: 'ready'; project: ProjectDetail }
  | { status: 'empty' }
  | { status: 'error'; message: string; project: ProjectDetail | null }

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Visão' }, { key: 'tasks', label: 'Tarefas' },
  { key: 'revisions', label: 'Revisões' }, { key: 'delivery', label: 'Entrega' },
  { key: 'history', label: 'Histórico' },
]
const ACTIVITY_LABELS: Record<ClientActivity['type'], string> = {
  conversion: 'Conversão', contact: 'Contato', meeting: 'Reunião', approval: 'Aprovação',
  status_change: 'Mudança de status', delivery: 'Entrega', financial: 'Financeiro', note: 'Nota',
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC',
  }).format(date)
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function isMoveStatus(value: string): value is ProjectMoveStatus {
  return (PROJECT_MOVE_STATUSES as readonly string[]).includes(value)
}

function ProjectNotFound() {
  return (
    <EmptyState
      icon={FolderKanban}
      title="Projeto não encontrado."
      description="O projeto pode ter sido removido ou você não tem acesso a ele."
      action={(
        <Link
          to="/projetos"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Voltar para projetos
        </Link>
      )}
    />
  )
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  if (!id) return <ProjectNotFound />
  return <ProjectDetailContent key={id} projectId={id} />
}

function ProjectDetailContent({ projectId }: { projectId: string }) {
  const { toast } = useToast()
  const [loadState, setLoadState] = useState<ProjectLoadState>({ status: 'loading' })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<ProjectMoveStatus | null>(null)
  const [savingStatus, setSavingStatus] = useState(false)
  const mountedRef = useRef(false)
  const requestRef = useRef(0)
  const statusMutationRef = useRef(0)
  const savingStatusRef = useRef(false)

  useLayoutEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestRef.current += 1
      statusMutationRef.current += 1
    }
  }, [])

  const loadProject = useCallback(async (): Promise<void> => {
    const request = ++requestRef.current
    try {
      const project = await getProject(projectId)
      if (!mountedRef.current || request !== requestRef.current) return
      if (!project) setLoadState({ status: 'empty' })
      else setLoadState({ status: 'ready', project })
    } catch (error) {
      if (!mountedRef.current || request !== requestRef.current) return
      const message = errorMessage(error, 'Não foi possível carregar o projeto. Tente novamente.')
      setLoadState((current) => {
        const retained = current.status === 'ready' || current.status === 'error'
          ? current.project
          : null
        return {
          status: 'error', message,
          project: retained?.id === projectId ? retained : null,
        }
      })
    } finally {
      if (mountedRef.current && request === requestRef.current) setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadProject()
  }, [loadProject])

  const currentProject = (loadState.status === 'ready' || loadState.status === 'error')
    && loadState.project?.id === projectId ? loadState.project : null
  const refresh = () => {
    setLoading(true)
    void loadProject()
  }
  const retry = () => {
    setLoading(true)
    setLoadState({ status: 'loading' })
    void loadProject()
  }
  const childChanged = refresh
  const tasksChanged = (tasks: ProjectTask[]) => {
    if (!mountedRef.current) return
    const confirmedTasks = tasks.filter((task) => task.project_id === projectId)
    setLoadState((current) => {
      if (
        (current.status !== 'ready' && current.status !== 'error')
        || current.project?.id !== projectId
      ) return current
      return {
        status: 'ready',
        project: { ...current.project, tasks: confirmedTasks, ...calculateProjectProgress(confirmedTasks) },
      }
    })
    refresh()
  }

  const confirmStatus = async () => {
    const project = currentProject
    const status = pendingStatus
    if (!project || !status || savingStatusRef.current) return
    const mutationProjectId = project.id
    const request = requestRef.current
    const mutation = ++statusMutationRef.current
    savingStatusRef.current = true
    setSavingStatus(true)
    let confirmed = false
    try {
      const updated = await setProjectStatus(mutationProjectId, status)
      if (
        !mountedRef.current || request !== requestRef.current
        || mutation !== statusMutationRef.current
      ) return
      setLoadState((current) => {
        if (
          (current.status !== 'ready' && current.status !== 'error')
          || current.project?.id !== mutationProjectId
        ) return current
        return { status: 'ready', project: { ...current.project, ...updated } }
      })
      setPendingStatus(null)
      toast('Status do projeto atualizado.')
      confirmed = true
    } catch (error) {
      if (
        mountedRef.current && request === requestRef.current
        && mutation === statusMutationRef.current
      ) {
        toast(errorMessage(error, 'Não foi possível atualizar o status.'), 'error')
      }
    } finally {
      if (mountedRef.current && mutation === statusMutationRef.current) {
        savingStatusRef.current = false
        setSavingStatus(false)
      }
    }
    if (confirmed && mountedRef.current && request === requestRef.current) {
      setLoading(true)
      await loadProject()
    }
  }

  if (loadState.status === 'loading' || (loading && !currentProject)) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-10 w-64" /><Skeleton className="h-40" /><Skeleton className="h-64" />
        <span className="sr-only">Carregando projeto…</span>
      </div>
    )
  }

  if (loadState.status === 'empty' || (!currentProject && loadState.status !== 'error')) {
    return <ProjectNotFound />
  }

  if (!currentProject) {
    return (
      <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
        <p className="text-sm text-danger">{loadState.status === 'error' ? loadState.message : 'Projeto indisponível.'}</p>
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="outline" onClick={retry}>Tentar novamente</Button>
          <Link
            to="/projetos"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-muted transition-colors hover:bg-elevated hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Voltar para projetos
          </Link>
        </div>
      </div>
    )
  }

  const project = currentProject
  const activities = [...project.activities].sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <div className="flex flex-col gap-5" aria-busy={loading}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-primary" to="/projetos">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar para projetos
          </Link>
          <h1 className="font-display text-xl font-bold text-ink">{project.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ProjectStatusBadge status={project.status} />
            <ProjectPriorityBadge priority={project.priority} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" loading={loading} onClick={refresh}>Atualizar</Button>
          {project.status !== 'cancelled' && (
            <Button type="button" variant="mint" onClick={() => setEditOpen(true)}>Editar projeto</Button>
          )}
        </div>
      </header>

      {loadState.status === 'error' && (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
          <p className="text-sm text-danger">{loadState.message}</p>
          <Button type="button" variant="outline" className="mt-3" onClick={refresh}>Tentar novamente</Button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto border-b border-line" role="tablist" aria-label="Seções do projeto">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={`project-tab-${item.key}`}
            aria-controls={`project-panel-${item.key}`}
            aria-selected={tab === item.key}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === item.key ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section role="tabpanel" id={`project-panel-${tab}`} aria-labelledby={`project-tab-${tab}`}>
        {tab === 'overview' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="flex flex-col gap-4 lg:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-ink">Visão geral</h2>
                  <p className="mt-1 text-sm text-muted">{project.description || 'Sem descrição.'}</p>
                </div>
                {project.status !== 'delivered' && (
                  <Select
                    label="Status do projeto"
                    value={project.status}
                    options={PROJECT_MOVE_STATUSES.map((status) => ({ value: status, label: PROJECT_STATUS_LABELS[status] }))}
                    disabled={savingStatus}
                    onChange={(event) => {
                      if (isMoveStatus(event.target.value) && event.target.value !== project.status) {
                        setPendingStatus(event.target.value)
                      }
                    }}
                  />
                )}
              </div>
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-muted">Cliente</dt><dd className="mt-1"><Link className="font-medium text-primary hover:underline" to={`/clientes/${project.client_id}`}>{project.client_name || project.client_id}</Link></dd></div>
                <div><dt className="text-xs text-muted">Contrato</dt><dd className="mt-1 break-all text-ink">{project.contract_id}</dd></div>
                <div><dt className="text-xs text-muted">Serviço</dt><dd className="mt-1 text-ink">{project.service}</dd></div>
                <div><dt className="text-xs text-muted">Responsável</dt><dd className="mt-1 text-ink">{project.responsible_name || 'Não definido'}</dd></div>
                <div><dt className="text-xs text-muted">Início</dt><dd className="mt-1 text-ink">{formatProjectDate(project.start_date)}</dd></div>
                <div><dt className="text-xs text-muted">Prazo</dt><dd className="mt-1 text-ink">{formatProjectDate(project.due_date)}</dd></div>
              </dl>
            </Card>
            <Card className="flex flex-col gap-4">
              <h2 className="font-display text-lg font-bold text-ink">Execução</h2>
              <div><p className="text-xs text-muted">Valor alocado</p><p className="mt-1 text-xl font-bold text-ink">{formatMoney(project.contracted_value_cents)}</p></div>
              <div><p className="text-xs text-muted">Prioridade</p><p className="mt-1 text-ink">{PROJECT_PRIORITY_LABELS[project.priority]}</p></div>
              {project.progressPercent === null ? (
                <p className="text-sm text-muted">Sem tarefas ativas</p>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted">Progresso</span><span className="font-semibold text-ink">{project.progressPercent}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-elevated" role="progressbar" aria-label="Progresso do projeto" aria-valuemin={0} aria-valuemax={100} aria-valuenow={project.progressPercent}>
                    <div className="h-full bg-primary" style={{ width: `${project.progressPercent}%` }} />
                  </div>
                  <p className="text-xs text-muted">{project.completedTasks} de {project.activeTasks} tarefas concluídas</p>
                </>
              )}
              {project.status === 'cancelled' && <p className="text-sm text-muted">Projeto cancelado. O histórico continua disponível e as criações estão desabilitadas.</p>}
            </Card>
          </div>
        )}
        {tab === 'tasks' && <ProjectTaskList projectId={project.id} onChanged={tasksChanged} disabled={project.status === 'cancelled'} />}
        {tab === 'revisions' && <ProjectRevisionList projectId={project.id} onChanged={childChanged} disabled={project.status === 'cancelled'} />}
        {tab === 'delivery' && (
          <ProjectDeliveryPanel
            project={project}
            onDelivered={(delivered) => {
              if (delivered.id === projectId) childChanged()
            }}
          />
        )}
        {tab === 'history' && (
          activities.length === 0 ? (
            <EmptyState icon={FolderKanban} title="Nenhuma atividade registrada." description="As mudanças confirmadas do projeto aparecerão aqui." />
          ) : (
            <ol className="flex flex-col gap-3">
              {activities.map((activity) => (
                <li key={activity.id} className="rounded-xl border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase text-primary">{ACTIVITY_LABELS[activity.type]}</span>
                    <time className="text-xs text-muted" dateTime={activity.created_at}>{formatDateTime(activity.created_at)}</time>
                  </div>
                  <p className="mt-2 text-sm text-ink">{activity.description}</p>
                </li>
              ))}
            </ol>
          )
        )}
      </section>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar projeto" wide>
        <ProjectForm
          project={project}
          onCancel={() => setEditOpen(false)}
          onSaved={(saved) => {
            if (!mountedRef.current || saved.id !== projectId) return
            setEditOpen(false)
            toast('Projeto atualizado.')
            refresh()
          }}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingStatus)}
        title="Confirmar status"
        description={pendingStatus ? `Alterar o status para “${PROJECT_STATUS_LABELS[pendingStatus]}”? Esta ação não modifica contrato, pagamento ou receita.` : ''}
        confirmLabel="Confirmar status"
        loading={savingStatus}
        onConfirm={() => void confirmStatus()}
        onCancel={() => { if (!savingStatusRef.current) setPendingStatus(null) }}
      />
    </div>
  )
}
