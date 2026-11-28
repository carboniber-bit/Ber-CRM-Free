import { useDraggable, useDroppable } from '@dnd-kit/core'
import { GripVertical } from 'lucide-react'
import {
  PROJECT_MOVE_STATUSES,
  type ProjectListItem,
  type ProjectMoveStatus,
  type ProjectStatus,
} from '../../types/project'
import { Select } from '../ui/Select'
import { ProjectCard } from './ProjectCard'
import { PROJECT_STATUS_LABELS } from './ProjectStatusBadge'

interface ProjectKanbanColumnProps {
  status: ProjectStatus
  projects: ProjectListItem[]
  pendingIds: ReadonlySet<string>
  onMove: (id: string, status: ProjectMoveStatus) => Promise<void>
}

function isMoveStatus(status: string): status is ProjectMoveStatus {
  return (PROJECT_MOVE_STATUSES as readonly string[]).includes(status)
}

function ProjectStatusControl({
  project, pending, onMove,
}: {
  project: ProjectListItem
  pending: boolean
  onMove: ProjectKanbanColumnProps['onMove']
}) {
  if (project.status === 'delivered') return null
  return (
    <Select
      label={`Status do projeto ${project.name}`}
      value={project.status}
      options={PROJECT_MOVE_STATUSES.map((status) => ({
        value: status, label: PROJECT_STATUS_LABELS[status],
      }))}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value
        if (pending || !isMoveStatus(next)) return
        void onMove(project.id, next)
      }}
    />
  )
}

function ReadOnlyColumn({ status, projects, pendingIds }: Omit<ProjectKanbanColumnProps, 'onMove'>) {
  return (
    <section className="w-[300px] shrink-0 rounded-2xl border border-line bg-surface p-3" aria-label={PROJECT_STATUS_LABELS[status]} role="group">
      <header className="mb-3 flex items-center justify-between px-1">
        <h2 className="font-display text-sm font-bold text-ink">{PROJECT_STATUS_LABELS[status]}</h2>
        <span className="text-xs text-muted">{projects.length}</span>
      </header>
      <div className="flex flex-col gap-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} pending={pendingIds.has(project.id)} />
        ))}
        {projects.length === 0 && (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
            {status === 'delivered' ? 'Histórico de entregas.' : 'Projetos cancelados não aparecem nesta visão.'}
          </p>
        )}
      </div>
    </section>
  )
}

function MovableColumn({ status, projects, pendingIds, onMove }: ProjectKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}` })
  return (
    <section
      ref={setNodeRef}
      className={`w-[300px] shrink-0 rounded-2xl border p-3 ${isOver ? 'border-primary bg-primary/5' : 'border-line bg-surface'}`}
      aria-label={PROJECT_STATUS_LABELS[status]}
      role="group"
    >
      <header className="mb-3 flex items-center justify-between px-1">
        <h2 className="font-display text-sm font-bold text-ink">{PROJECT_STATUS_LABELS[status]}</h2>
        <span className="text-xs text-muted">{projects.length}</span>
      </header>
      <div className="flex flex-col gap-3">
        {projects.map((project) => (
          <DraggableProjectCard
            key={project.id}
            project={project}
            pending={pendingIds.has(project.id)}
            onMove={onMove}
          />
        ))}
        {projects.length === 0 && (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
            Arraste projetos para cá.
          </p>
        )}
      </div>
    </section>
  )
}

function DraggableProjectCard({
  project, pending, onMove,
}: {
  project: ProjectListItem
  pending: boolean
  onMove: ProjectKanbanColumnProps['onMove']
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `project:${project.id}`,
    disabled: pending || project.status === 'delivered',
  })
  return (
    <div className="flex flex-col gap-2">
      <div ref={setNodeRef} {...attributes}>
        <ProjectCard project={project} pending={pending} />
        <button
          type="button"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Arrastar ${project.name}`}
          disabled={pending}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <ProjectStatusControl project={project} pending={pending} onMove={onMove} />
    </div>
  )
}

export function ProjectKanbanColumn(props: ProjectKanbanColumnProps) {
  return isMoveStatus(props.status) ? <MovableColumn {...props} /> : <ReadOnlyColumn {...props} />
}
