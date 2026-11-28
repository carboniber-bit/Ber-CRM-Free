import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { MessageSquareText } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import {
  createRevision, listRevisions, updateRevision,
} from '../../services/projectRevisionService'
import {
  REVISION_STATUSES, type ProjectRevision, type ProjectRevisionWrite, type RevisionStatus,
} from '../../types/project'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { EmptyState } from '../ui/EmptyState'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { Skeleton } from '../ui/Skeleton'
import { Textarea } from '../ui/Textarea'

interface ProjectRevisionListProps {
  projectId: string
  onChanged: () => void
  disabled?: boolean
}

interface RevisionDraft {
  description: string
  responsibleName: string
  status: RevisionStatus
  notes: string
}

type RevisionLoadState =
  | { status: 'loading'; projectId: string }
  | { status: 'ready'; projectId: string; revisions: ProjectRevision[] }
  | { status: 'error'; projectId: string; message: string; revisions: ProjectRevision[] | null }

const REVISION_STATUS_LABELS: Record<RevisionStatus, string> = {
  requested: 'Solicitada', in_progress: 'Em andamento', completed: 'Concluída', approved: 'Aprovada',
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function emptyDraft(): RevisionDraft {
  return { description: '', responsibleName: '', status: 'requested', notes: '' }
}

function writeFromRevision(revision: ProjectRevision, status = revision.status): ProjectRevisionWrite {
  return {
    description: revision.description, responsibleName: revision.responsible_name ?? '',
    status, notes: revision.notes ?? '',
  }
}

function writeFromDraft(draft: RevisionDraft): ProjectRevisionWrite {
  return {
    description: draft.description.trim(), responsibleName: draft.responsibleName.trim(),
    status: draft.status, notes: draft.notes.trim(),
  }
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Não definido'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC',
  }).format(date)
}

function isRevisionStatus(value: string): value is RevisionStatus {
  return (REVISION_STATUSES as readonly string[]).includes(value)
}

export function ProjectRevisionList({ projectId, onChanged, disabled = false }: ProjectRevisionListProps) {
  const { toast } = useToast()
  const [loadState, setLoadState] = useState<RevisionLoadState>({ status: 'loading', projectId })
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ProjectRevision | null>(null)
  const [draft, setDraft] = useState<RevisionDraft>(emptyDraft)
  const [error, setError] = useState<string | null>(null)
  const [approving, setApproving] = useState<ProjectRevision | null>(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const mountedRef = useRef(true)
  const requestRef = useRef(0)
  const projectIdRef = useRef(projectId)
  projectIdRef.current = projectId
  const loadStateRef = useRef(loadState)
  loadStateRef.current = loadState

  const reload = useCallback(async (background = false): Promise<void> => {
    const request = ++requestRef.current
    const previous = loadStateRef.current
    const retained = previous.projectId === projectId
      ? previous.status === 'ready'
        ? previous.revisions
        : previous.status === 'error' ? previous.revisions : null
      : null
    if (!background) setLoadState({ status: 'loading', projectId })
    try {
      const revisions = await listRevisions(projectId)
      if (!mountedRef.current || projectIdRef.current !== projectId || request !== requestRef.current) return
      setLoadState({ status: 'ready', projectId, revisions })
    } catch (cause) {
      if (!mountedRef.current || projectIdRef.current !== projectId || request !== requestRef.current) return
      setLoadState({
        status: 'error',
        projectId,
        message: errorMessage(cause, 'Não foi possível carregar as revisões. Tente novamente.'),
        revisions: retained,
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
    setEditing(null)
    setApproving(null)
    setDraft(emptyDraft())
    setError(null)
    void reload()
  }, [reload])

  const stateBelongsToProject = loadState.projectId === projectId
  const currentRevisions = stateBelongsToProject
    ? loadState.status === 'ready'
      ? loadState.revisions
      : loadState.status === 'error' ? loadState.revisions ?? [] : []
    : []
  const actionsDisabled = disabled || saving

  const perform = async (action: () => Promise<void>, success: string) => {
    if (savingRef.current || disabled) return
    savingRef.current = true
    setSaving(true)
    try {
      await action()
      if (!mountedRef.current || projectIdRef.current !== projectId) return
      toast(success)
      await reload(true)
      if (mountedRef.current && projectIdRef.current === projectId) onChanged()
    } catch (cause) {
      if (mountedRef.current && projectIdRef.current === projectId) {
        toast(errorMessage(cause, 'Não foi possível concluir a operação. Tente novamente.'), 'error')
      }
    } finally {
      savingRef.current = false
      if (mountedRef.current) setSaving(false)
    }
  }

  const openCreate = () => {
    if (actionsDisabled) return
    setEditing(null)
    setDraft(emptyDraft())
    setError(null)
    setFormOpen(true)
  }

  const openEdit = (revision: ProjectRevision) => {
    if (actionsDisabled || revision.project_id !== projectId || revision.status === 'approved') return
    setEditing(revision)
    setDraft({
      description: revision.description, responsibleName: revision.responsible_name ?? '',
      status: revision.status, notes: revision.notes ?? '',
    })
    setError(null)
    setFormOpen(true)
  }

  const requestApproval = (revision: ProjectRevision) => {
    if (actionsDisabled || revision.project_id !== projectId || revision.status !== 'completed') return
    setError(null)
    setApproving(revision)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (actionsDisabled || draft.status === 'approved') return
    if (editing && (editing.project_id !== projectId || editing.status === 'approved')) return
    if (!draft.description.trim()) {
      setError('Informe a descrição da revisão.')
      return
    }
    setError(null)
    const payload = writeFromDraft(draft)
    void perform(async () => {
      if (editing) await updateRevision(editing.id, payload)
      else await createRevision(projectId, payload)
      setFormOpen(false)
      setEditing(null)
    }, editing ? 'Revisão atualizada.' : 'Revisão registrada.')
  }

  const changeStatus = (revision: ProjectRevision, value: string) => {
    if (
      revision.project_id !== projectId || revision.status === 'approved'
      || !isRevisionStatus(value) || value === 'approved' || value === revision.status || actionsDisabled
    ) return
    void perform(async () => {
      await updateRevision(revision.id, writeFromRevision(revision, value))
    }, 'Status da revisão atualizado.')
  }

  const approve = async () => {
    if (!approving || actionsDisabled || approving.project_id !== projectId || approving.status !== 'completed') return
    const revision = approving
    await perform(async () => {
      await updateRevision(revision.id, writeFromRevision(revision, 'approved'))
      setApproving(null)
    }, 'Revisão aprovada.')
  }

  if (!stateBelongsToProject || loadState.status === 'loading') {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-32" /><Skeleton className="h-32" />
        <span className="sr-only">Carregando revisões…</span>
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Revisões do projeto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-ink">Revisões</h2>
        <div className="flex gap-2">
          <Button type="button" variant="outline" loading={saving} onClick={() => void reload(true)}>Atualizar revisões</Button>
          <Button type="button" variant="mint" disabled={actionsDisabled} onClick={openCreate}>Nova revisão</Button>
        </div>
      </div>
      {disabled && (
        <p className="rounded-xl border border-line bg-elevated p-3 text-sm text-muted">
          Projeto cancelado: o histórico de revisões permanece visível, mas novas revisões e aprovações estão desabilitadas.
        </p>
      )}
      {loadState.status === 'error' && (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
          <p className="text-sm text-danger">{loadState.message}</p>
          <Button type="button" variant="outline" className="mt-3" onClick={() => void reload(true)}>Tentar novamente</Button>
        </div>
      )}
      {loadState.status === 'ready' && currentRevisions.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title="Nenhuma revisão registrada."
          description="Registre ajustes solicitados pelo cliente e aprove cada revisão explicitamente."
        />
      ) : currentRevisions.map((revision) => (
        <Card key={revision.id} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-ink">{revision.description}</p>
              <p className="mt-1 text-xs text-muted">
                Solicitada em {formatDateTime(revision.requested_at)}
                {revision.responsible_name ? ` · ${revision.responsible_name}` : ''}
              </p>
            </div>
            <span className="inline-flex rounded-full bg-elevated px-2.5 py-1 text-xs font-medium text-ink">
              {REVISION_STATUS_LABELS[revision.status]}
            </span>
          </div>
          {revision.status === 'approved' ? (
            <p className="text-xs text-muted">Aprovada em {formatDateTime(revision.approved_at)} · revisão bloqueada para edição.</p>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <Select
                label="Status da revisão"
                value={revision.status}
                options={REVISION_STATUSES.filter((status) => status !== 'approved').map((status) => ({
                  value: status, label: REVISION_STATUS_LABELS[status],
                }))}
                disabled={actionsDisabled || revision.project_id !== projectId}
                onChange={(event) => changeStatus(revision, event.target.value)}
              />
              <Button type="button" variant="outline" disabled={actionsDisabled || revision.project_id !== projectId} onClick={() => openEdit(revision)}>Editar revisão</Button>
              {revision.status === 'completed' && (
                <Button type="button" variant="mint" disabled={actionsDisabled || revision.project_id !== projectId} onClick={() => requestApproval(revision)}>Aprovar revisão</Button>
              )}
            </div>
          )}
          {revision.notes && <p className="text-sm text-muted">{revision.notes}</p>}
          {revision.completed_at && revision.status !== 'approved' && (
            <p className="text-xs text-muted">Concluída em {formatDateTime(revision.completed_at)}</p>
          )}
        </Card>
      ))}

      <Modal
        open={formOpen}
        onClose={() => { if (!saving) { setFormOpen(false); setEditing(null) } }}
        title={editing ? 'Editar revisão' : 'Nova revisão'}
        dismissible={!saving}
      >
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <Textarea label="Descrição *" value={draft.description} error={error ?? undefined} disabled={actionsDisabled} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} required rows={3} />
          <Input label="Responsável" value={draft.responsibleName} disabled={actionsDisabled} onChange={(event) => setDraft((current) => ({ ...current, responsibleName: event.target.value }))} />
          <Select
            label="Status da revisão em edição"
            value={draft.status}
            options={REVISION_STATUSES.filter((status) => status !== 'approved').map((status) => ({ value: status, label: REVISION_STATUS_LABELS[status] }))}
            disabled={actionsDisabled}
            onChange={(event) => {
              const status = event.target.value
              if (isRevisionStatus(status) && status !== 'approved') {
                setDraft((current) => ({ ...current, status }))
              }
            }}
          />
          <Textarea label="Notas" value={draft.notes} disabled={actionsDisabled} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} rows={3} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={actionsDisabled} onClick={() => { setFormOpen(false); setEditing(null) }}>Cancelar</Button>
            <Button type="submit" variant="mint" loading={saving}>{editing ? 'Salvar revisão' : 'Registrar revisão'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(approving)}
        title="Confirmar aprovação"
        description={`Aprovar a revisão “${approving?.description ?? ''}”? A revisão aprovada ficará bloqueada para edição.`}
        confirmLabel="Confirmar aprovação"
        loading={saving}
        onConfirm={() => void approve()}
        onCancel={() => { if (!saving) setApproving(null) }}
      />
    </section>
  )
}
