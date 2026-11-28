import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, ListTodo } from 'lucide-react'
import { calculateProjectProgress } from '../../lib/projectProgress'
import { useToast } from '../../hooks/useToast'
import {
  createTask, deleteTask, listTasks, reorderTasks, updateTask,
} from '../../services/projectTaskService'
import {
  TASK_STATUSES, type ProjectPriority, type ProjectTask, type ProjectTaskWrite, type TaskStatus,
} from '../../types/project'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { EmptyState } from '../ui/EmptyState'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { Skeleton } from '../ui/Skeleton'
import { Textarea } from '../ui/Textarea'
import { formatProjectDate } from './ProjectCard'
import { PROJECT_PRIORITY_LABELS } from './ProjectPriorityBadge'

interface ProjectTaskListProps {
  projectId: string
  onChanged: (tasks: ProjectTask[]) => void
  disabled?: boolean
}

interface TaskDraft {
  title: string
  description: string
  status: TaskStatus
  responsibleName: string
  startDate: string
  dueDate: string
  priority: ProjectPriority
  notes: string
}

type TaskDraftErrors = Partial<Record<keyof TaskDraft, string>>
type TaskLoadState =
  | { status: 'loading'; projectId: string }
  | { status: 'ready'; projectId: string; tasks: ProjectTask[] }
  | { status: 'error'; projectId: string; message: string; tasks: ProjectTask[] | null }

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pendente', in_progress: 'Em andamento', completed: 'Concluída', cancelled: 'Cancelada',
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function emptyDraft(): TaskDraft {
  return {
    title: '', description: '', status: 'pending', responsibleName: '',
    startDate: '', dueDate: '', priority: 'medium', notes: '',
  }
}

function draftFromTask(task: ProjectTask): TaskDraft {
  return {
    title: task.title, description: task.description ?? '', status: task.status,
    responsibleName: task.responsible_name ?? '', startDate: task.start_date ?? '',
    dueDate: task.due_date ?? '', priority: task.priority, notes: task.notes ?? '',
  }
}

function writeFromDraft(draft: TaskDraft): ProjectTaskWrite {
  return {
    title: draft.title.trim(), description: draft.description.trim(), status: draft.status,
    responsibleName: draft.responsibleName.trim(), startDate: draft.startDate || null,
    dueDate: draft.dueDate || null, priority: draft.priority, notes: draft.notes.trim(),
  }
}

function writeFromTask(task: ProjectTask, status = task.status): ProjectTaskWrite {
  return {
    title: task.title, description: task.description ?? '', status,
    responsibleName: task.responsible_name ?? '', startDate: task.start_date,
    dueDate: task.due_date, priority: task.priority, notes: task.notes ?? '',
  }
}

function withTask(tasks: ProjectTask[], task: ProjectTask, projectId: string): ProjectTask[] {
  const current = tasks.filter((item) => item.project_id === projectId)
  if (task.project_id !== projectId) return current
  const index = current.findIndex((item) => item.id === task.id)
  if (index < 0) current.push(task)
  else current[index] = task
  return current
}

function withoutTask(tasks: ProjectTask[], id: string, projectId: string): ProjectTask[] {
  return tasks.filter((task) => task.project_id === projectId && task.id !== id)
}

function orderedTasks(tasks: ProjectTask[], orderedIds: string[], projectId: string): ProjectTask[] {
  const positions = new Map(orderedIds.map((id, index) => [id, index]))
  return tasks
    .filter((task) => task.project_id === projectId)
    .sort((left, right) => (
      (positions.get(left.id) ?? Number.MAX_SAFE_INTEGER)
      - (positions.get(right.id) ?? Number.MAX_SAFE_INTEGER)
    ))
}

function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value)
}

export function ProjectTaskList({ projectId, onChanged, disabled = false }: ProjectTaskListProps) {
  const { toast } = useToast()
  const [loadState, setLoadState] = useState<TaskLoadState>({ status: 'loading', projectId })
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null)
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft)
  const [errors, setErrors] = useState<TaskDraftErrors>({})
  const [deleteCandidate, setDeleteCandidate] = useState<ProjectTask | null>(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const mountedRef = useRef(true)
  const requestRef = useRef(0)
  const projectIdRef = useRef(projectId)
  const loadStateRef = useRef(loadState)
  const onChangedRef = useRef(onChanged)

  useLayoutEffect(() => {
    projectIdRef.current = projectId
    loadStateRef.current = loadState
    onChangedRef.current = onChanged
  }, [projectId, loadState, onChanged])

  const reload = useCallback(async (background = false): Promise<void> => {
    const request = ++requestRef.current
    const previous = loadStateRef.current
    const retained = previous.projectId === projectId
      ? previous.status === 'ready'
        ? previous.tasks
        : previous.status === 'error' ? previous.tasks : null
      : null
    if (!background) setLoadState({ status: 'loading', projectId })
    try {
      const tasks = await listTasks(projectId)
      if (!mountedRef.current || request !== requestRef.current) return
      setLoadState({ status: 'ready', projectId, tasks })
    } catch (error) {
      if (!mountedRef.current || request !== requestRef.current) return
      setLoadState({
        status: 'error',
        projectId,
        message: errorMessage(error, 'Não foi possível carregar as tarefas. Tente novamente.'),
        tasks: retained,
      })
    }
  }, [projectId])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    setLoadState({ status: 'loading', projectId })
    setFormOpen(false)
    setEditingTask(null)
    setDeleteCandidate(null)
    setDraft(emptyDraft())
    setErrors({})
    void reload()
  }, [reload])

  const stateBelongsToProject = loadState.projectId === projectId
  const currentTasks = stateBelongsToProject
    ? loadState.status === 'ready'
      ? loadState.tasks
      : loadState.status === 'error' ? loadState.tasks ?? [] : []
    : []
  const metrics = calculateProjectProgress(currentTasks)
  const showTasks = loadState.status === 'ready'
    || (loadState.status === 'error' && loadState.tasks !== null)
  const actionsDisabled = disabled || saving

  const setField = <K extends keyof TaskDraft,>(key: K, value: TaskDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const perform = async (
    action: (tasks: ProjectTask[]) => Promise<ProjectTask[]>,
    success: string,
  ) => {
    if (savingRef.current || disabled) return
    const current = loadStateRef.current
    if (current.projectId !== projectId || current.status === 'loading') return
    const tasks = (current.status === 'ready' ? current.tasks : current.tasks ?? [])
      .filter((task) => task.project_id === projectId)
    savingRef.current = true
    setSaving(true)
    try {
      const confirmedTasks = await action(tasks)
      if (projectIdRef.current !== projectId) return
      const nextState: TaskLoadState = { status: 'ready', projectId, tasks: confirmedTasks }
      loadStateRef.current = nextState
      if (mountedRef.current) setLoadState(nextState)
      onChangedRef.current(confirmedTasks)
      if (!mountedRef.current) return
      toast(success)
      await reload(true)
    } catch (error) {
      if (mountedRef.current && projectIdRef.current === projectId) {
        toast(errorMessage(error, 'Não foi possível concluir a operação. Tente novamente.'), 'error')
      }
    } finally {
      savingRef.current = false
      if (mountedRef.current) setSaving(false)
    }
  }

  const openCreate = () => {
    setEditingTask(null)
    setDraft(emptyDraft())
    setErrors({})
    setFormOpen(true)
  }

  const openEdit = (task: ProjectTask) => {
    if (task.project_id !== projectId) return
    setEditingTask(task)
    setDraft(draftFromTask(task))
    setErrors({})
    setFormOpen(true)
  }

  const submitTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (actionsDisabled || (editingTask && editingTask.project_id !== projectId)) return
    const nextErrors: TaskDraftErrors = {}
    if (!draft.title.trim()) nextErrors.title = 'Informe o título da tarefa.'
    if (draft.startDate && draft.dueDate && draft.dueDate < draft.startDate) {
      nextErrors.dueDate = 'O prazo não pode anteceder o início.'
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return
    const payload = writeFromDraft(draft)
    void perform(async (tasks) => {
      const saved = editingTask
        ? await updateTask(editingTask.id, payload)
        : await createTask(projectId, payload)
      if (mountedRef.current && projectIdRef.current === projectId) {
        setFormOpen(false)
        setEditingTask(null)
      }
      return withTask(tasks, saved, projectId)
    }, editingTask ? 'Tarefa atualizada.' : 'Tarefa criada.')
  }

  const changeStatus = (task: ProjectTask, value: string) => {
    if (task.project_id !== projectId || !isTaskStatus(value) || value === task.status || actionsDisabled) return
    void perform(
      async (tasks) => withTask(tasks, await updateTask(task.id, writeFromTask(task, value)), projectId),
      'Status da tarefa atualizado.',
    )
  }

  const removeTask = async () => {
    if (!deleteCandidate || deleteCandidate.project_id !== projectId || actionsDisabled) return
    const id = deleteCandidate.id
    await perform(async (tasks) => {
      await deleteTask(id)
      if (mountedRef.current && projectIdRef.current === projectId) setDeleteCandidate(null)
      return withoutTask(tasks, id, projectId)
    }, 'Tarefa excluída.')
  }

  const moveTask = async (task: ProjectTask, direction: -1 | 1) => {
    if (task.project_id !== projectId || actionsDisabled) return
    const index = currentTasks.findIndex((item) => item.id === task.id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= currentTasks.length) return
    const orderedIds = currentTasks.map((item) => item.id)
    const original = orderedIds[index]
    orderedIds[index] = orderedIds[target]
    orderedIds[target] = original
    await perform(async (tasks) => {
      await reorderTasks(projectId, orderedIds)
      return orderedTasks(tasks, orderedIds, projectId)
    }, 'Ordem das tarefas atualizada.')
  }

  if (!stateBelongsToProject || loadState.status === 'loading') {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-24" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <span className="sr-only">Carregando tarefas…</span>
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Tarefas do projeto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Tarefas</h2>
          {showTasks && (
            metrics.progressPercent === null
              ? <p className="text-sm text-muted">Sem tarefas ativas</p>
              : (
                <div className="mt-2 flex items-center gap-3">
                  <div
                    className="h-2 w-40 overflow-hidden rounded-full bg-elevated"
                    role="progressbar"
                    aria-label="Progresso de tarefas"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={metrics.progressPercent}
                  >
                    <div className="h-full bg-primary" style={{ width: `${metrics.progressPercent}%` }} />
                  </div>
                  <span className="text-sm font-semibold text-ink">{metrics.progressPercent}%</span>
                </div>
              )
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" loading={saving} onClick={() => void reload(true)}>Atualizar tarefas</Button>
          <Button type="button" variant="mint" disabled={actionsDisabled} onClick={openCreate}>Nova tarefa</Button>
        </div>
      </div>

      {disabled && (
        <p className="rounded-xl border border-line bg-elevated p-3 text-sm text-muted">
          Projeto cancelado: o histórico de tarefas permanece visível, mas as mutações estão desabilitadas.
        </p>
      )}
      {loadState.status === 'error' && (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
          <p className="text-sm text-danger">{loadState.message}</p>
          <Button type="button" variant="outline" className="mt-3" onClick={() => void reload(true)}>Tentar novamente</Button>
        </div>
      )}
      {showTasks && currentTasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="Nenhuma tarefa cadastrada."
          description="Crie tarefas para acompanhar a execução e calcular o progresso automaticamente."
        />
      ) : currentTasks.length > 0 && (
        <ol className="flex flex-col gap-3">
          {currentTasks.map((task, index) => (
            <li key={task.id} className="rounded-xl border border-line bg-surface p-4" aria-busy={saving}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-ink">{task.title}</h3>
                  <p className="mt-1 text-sm text-muted">
                    {PROJECT_PRIORITY_LABELS[task.priority]} · Início {formatProjectDate(task.start_date)} · Prazo {formatProjectDate(task.due_date)}
                  </p>
                  {task.description && <p className="mt-2 text-sm text-ink">{task.description}</p>}
                  {task.notes && <p className="mt-2 text-sm text-muted">{task.notes}</p>}
                </div>
                <Select
                  label={`Status da tarefa ${task.title}`}
                  value={task.status}
                  options={TASK_STATUSES.map((status) => ({ value: status, label: TASK_STATUS_LABELS[status] }))}
                  disabled={actionsDisabled || task.project_id !== projectId}
                  onChange={(event) => changeStatus(task, event.target.value)}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="ghost" disabled={actionsDisabled || task.project_id !== projectId || index === 0} aria-label={`Mover tarefa ${task.title} para cima`} onClick={() => void moveTask(task, -1)}>
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button type="button" variant="ghost" disabled={actionsDisabled || task.project_id !== projectId || index === currentTasks.length - 1} aria-label={`Mover tarefa ${task.title} para baixo`} onClick={() => void moveTask(task, 1)}>
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button type="button" variant="outline" disabled={actionsDisabled || task.project_id !== projectId} aria-label={`Editar tarefa ${task.title}`} onClick={() => openEdit(task)}>Editar tarefa</Button>
                <Button type="button" variant="danger" disabled={actionsDisabled || task.project_id !== projectId} aria-label={`Excluir tarefa ${task.title}`} onClick={() => setDeleteCandidate(task)}>Excluir</Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Modal
        open={formOpen}
        onClose={() => { if (!saving) { setFormOpen(false); setEditingTask(null) } }}
        title={editingTask ? 'Editar tarefa' : 'Nova tarefa'}
        dismissible={!saving}
      >
        <form className="flex flex-col gap-4" onSubmit={submitTask} noValidate>
          <Input label="Título *" value={draft.title} error={errors.title} disabled={actionsDisabled} onChange={(event) => setField('title', event.target.value)} required />
          <Select label="Status" value={draft.status} options={TASK_STATUSES.map((status) => ({ value: status, label: TASK_STATUS_LABELS[status] }))} disabled={actionsDisabled} onChange={(event) => setField('status', event.target.value as TaskStatus)} />
          <Input label="Responsável" value={draft.responsibleName} disabled={actionsDisabled} onChange={(event) => setField('responsibleName', event.target.value)} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Início" type="date" value={draft.startDate} disabled={actionsDisabled} onChange={(event) => setField('startDate', event.target.value)} />
            <Input label="Prazo" type="date" value={draft.dueDate} error={errors.dueDate} disabled={actionsDisabled} onChange={(event) => setField('dueDate', event.target.value)} />
          </div>
          <Select label="Prioridade" value={draft.priority} options={Object.entries(PROJECT_PRIORITY_LABELS).map(([value, label]) => ({ value, label }))} disabled={actionsDisabled} onChange={(event) => setField('priority', event.target.value as ProjectPriority)} />
          <Textarea label="Descrição" value={draft.description} disabled={actionsDisabled} onChange={(event) => setField('description', event.target.value)} rows={3} />
          <Textarea label="Notas" value={draft.notes} disabled={actionsDisabled} onChange={(event) => setField('notes', event.target.value)} rows={3} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={actionsDisabled} onClick={() => { setFormOpen(false); setEditingTask(null) }}>Cancelar</Button>
            <Button type="submit" variant="mint" loading={saving}>{editingTask ? 'Salvar tarefa' : 'Adicionar tarefa'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteCandidate)}
        title="Excluir tarefa"
        description={`Excluir tarefa ${deleteCandidate?.title ?? ''}? Esta ação não exclui o projeto.`}
        confirmLabel="Confirmar exclusão"
        loading={saving}
        onConfirm={() => void removeTask()}
        onCancel={() => { if (!saving) setDeleteCandidate(null) }}
      />
    </section>
  )
}
