import type { ProjectPriority } from '../../types/project'

export const PROJECT_PRIORITY_LABELS: Record<ProjectPriority, string> = {
  very_high: 'Muito alta', high: 'Alta', medium: 'Média', low: 'Baixa',
}

const PRIORITY_CLASSES: Record<ProjectPriority, string> = {
  very_high: 'bg-danger/15 text-danger', high: 'bg-lime/15 text-lime',
  medium: 'bg-accent/15 text-accent', low: 'bg-elevated text-muted',
}

export function ProjectPriorityBadge({ priority }: { priority: ProjectPriority }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_CLASSES[priority]}`}>
      {PROJECT_PRIORITY_LABELS[priority]}
    </span>
  )
}
