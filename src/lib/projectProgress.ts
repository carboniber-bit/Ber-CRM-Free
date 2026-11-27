import type { ProjectMetrics, ProjectTask } from '../types/project'

export function calculateProjectProgress(tasks: ProjectTask[]): ProjectMetrics {
  const activeTasks = tasks.filter((task) => task.status !== 'cancelled')
  const completedTasks = activeTasks.filter((task) => task.status === 'completed').length
  return {
    progressPercent: activeTasks.length === 0 ? null : Math.round((completedTasks / activeTasks.length) * 100),
    activeTasks: activeTasks.length,
    completedTasks,
  }
}

export function suggestProjectDueDate(service: string, startDate: string | null): string | null {
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null

  const [year, month, day] = startDate.split('-').map(Number)
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null

  const normalized = service.toLocaleLowerCase('pt-BR')
  const days = normalized.includes('social') ? 7 : normalized.includes('design') ? 10 : 15
  date.setUTCDate(date.getUTCDate() + days)

  if (date.getUTCFullYear() < 0 || date.getUTCFullYear() > 9999) return null
  return date.toISOString().slice(0, 10)
}
