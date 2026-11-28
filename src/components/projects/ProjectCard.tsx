import { Link, useInRouterContext } from 'react-router-dom'
import { formatMoney } from '../../lib/money'
import type { ProjectListItem } from '../../types/project'
import { Card } from '../ui/Card'
import { ProjectPriorityBadge } from './ProjectPriorityBadge'
import { ProjectStatusBadge } from './ProjectStatusBadge'

export interface ProjectCardProps {
  project: ProjectListItem
  pending?: boolean
}

export function formatProjectDate(value: string | null): string {
  if (!value) return 'Não definido'
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(date)
}

export function ProjectCard({ project, pending = false }: ProjectCardProps) {
  const inRouter = useInRouterContext()
  const titleClassName = 'font-display text-base font-bold text-ink hover:text-primary'
  return (
    <Card className={`flex h-full flex-col gap-4 ${pending ? 'border-lime/50' : ''}`} aria-busy={pending}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {inRouter ? (
            <Link className={titleClassName} to={`/projetos/${project.id}`}>{project.name}</Link>
          ) : (
            <a className={titleClassName} href={`/projetos/${project.id}`}>{project.name}</a>
          )}
          <p className="mt-1 text-sm text-muted">
            {project.client_name ? `${project.client_name} · ` : ''}{project.service}
          </p>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>
      <div className="flex flex-wrap gap-2">
        <ProjectPriorityBadge priority={project.priority} />
        <span className="rounded-full bg-elevated px-2.5 py-1 text-xs font-medium text-ink">
          {formatMoney(project.contracted_value_cents)}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Prazo</dt>
          <dd className="mt-1 text-ink">{formatProjectDate(project.due_date)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Responsável</dt>
          <dd className="mt-1 text-ink">{project.responsible_name || 'Não definido'}</dd>
        </div>
      </dl>
      <div className="mt-auto">
        {project.progressPercent === null ? (
          <p className="text-sm text-muted">Sem tarefas ativas</p>
        ) : (
          <>
            <div className="mb-1 flex items-center justify-between text-xs text-muted">
              <span>Progresso</span>
              <span>{project.progressPercent}%</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-elevated"
              role="progressbar"
              aria-label={`Progresso de ${project.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={project.progressPercent}
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${project.progressPercent}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">
              {project.completedTasks} de {project.activeTasks} tarefas concluídas
            </p>
          </>
        )}
      </div>
      {pending && <span role="status" className="text-xs text-lime">Salvando movimentação…</span>}
    </Card>
  )
}
