import type { ProjectStatus } from '../../types/project'

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  not_started: 'Não iniciado', planning: 'Planejamento', in_development: 'Em desenvolvimento',
  awaiting_client_info: 'Aguardando cliente', in_review: 'Em revisão',
  awaiting_approval: 'Aguardando aprovação', changes_requested: 'Alterações solicitadas',
  completed: 'Concluído', delivered: 'Entregue', cancelled: 'Cancelado',
}

const STATUS_CLASSES: Record<ProjectStatus, string> = {
  not_started: 'bg-elevated text-muted',
  planning: 'bg-accent/15 text-accent',
  in_development: 'bg-primary/15 text-primary',
  awaiting_client_info: 'bg-lime/15 text-lime',
  in_review: 'bg-accent/15 text-accent',
  awaiting_approval: 'bg-lime/15 text-lime',
  changes_requested: 'bg-danger/15 text-danger',
  completed: 'bg-mint/15 text-mint',
  delivered: 'bg-primary/15 text-primary',
  cancelled: 'bg-danger/10 text-danger',
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[status]}`}>
      {PROJECT_STATUS_LABELS[status]}
    </span>
  )
}
