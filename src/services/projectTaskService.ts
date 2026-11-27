// src/services/projectTaskService.ts
import { requireSupabase, throwDbError } from '../lib/db'
import type { ProjectTask, ProjectTaskWrite } from '../types/project'

function nullable(value: string | null): string | null {
  return value?.trim() ? value.trim() : null
}

function taskPayload(input: ProjectTaskWrite) {
  return {
    title: input.title,
    description: nullable(input.description),
    status: input.status,
    responsible_name: nullable(input.responsibleName),
    start_date: input.startDate,
    due_date: input.dueDate,
    priority: input.priority,
    notes: nullable(input.notes),
  }
}

function taskRow<T>(data: T | null): T {
  if (!data) throw new Error('Resposta inválida ao salvar tarefa.')
  return data
}

export async function listTasks(projectId: string): Promise<ProjectTask[]> {
  const { data, error } = await requireSupabase()
    .from('project_tasks').select('*').eq('project_id', projectId)
    .order('position').order('id')
  throwDbError(error)
  return data ?? []
}

export async function createTask(projectId: string, input: ProjectTaskWrite): Promise<ProjectTask> {
  const { data, error } = await requireSupabase()
    .from('project_tasks').insert({ project_id: projectId, ...taskPayload(input) })
    .select('*').single()
  throwDbError(error)
  return taskRow(data) as ProjectTask
}

export async function updateTask(id: string, input: ProjectTaskWrite): Promise<ProjectTask> {
  const { data, error } = await requireSupabase()
    .from('project_tasks').update(taskPayload(input)).eq('id', id).select('*').single()
  throwDbError(error)
  return taskRow(data) as ProjectTask
}

export async function deleteTask(id: string): Promise<{ id: string }> {
  const { data, error } = await requireSupabase()
    .from('project_tasks').delete().eq('id', id).select('id').maybeSingle()
  throwDbError(error)
  if (!data) throw new Error('Tarefa não encontrada ou já excluída.')
  return data
}

export async function reorderTasks(projectId: string, orderedIds: string[]): Promise<void> {
  const { data, error } = await requireSupabase().rpc('reorder_project_tasks', {
    p_project_id: projectId, p_ordered_ids: orderedIds,
  })
  throwDbError(error)
  if (!data || typeof data !== 'object' || !('ok' in data) || data.ok !== true) {
    throw new Error('Resposta inválida ao reordenar tarefas.')
  }
}
