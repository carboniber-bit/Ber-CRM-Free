// src/services/projectRevisionService.ts
import { requireSupabase, throwDbError } from '../lib/db'
import type { ProjectRevision, ProjectRevisionWrite } from '../types/project'

function nullable(value: string): string | null {
  return value.trim() ? value.trim() : null
}

function revisionPayload(input: ProjectRevisionWrite) {
  return {
    description: input.description,
    responsible_name: nullable(input.responsibleName),
    status: input.status,
    notes: nullable(input.notes),
  }
}

function revisionRow(data: unknown): ProjectRevision {
  if (!data || typeof data !== 'object') throw new Error('Resposta inválida ao salvar revisão.')
  return data as ProjectRevision
}

export async function listRevisions(projectId: string): Promise<ProjectRevision[]> {
  const { data, error } = await requireSupabase()
    .from('project_revisions').select('*').eq('project_id', projectId)
    .order('requested_at', { ascending: false })
  throwDbError(error)
  return (data ?? []) as ProjectRevision[]
}

export async function createRevision(projectId: string, input: ProjectRevisionWrite): Promise<ProjectRevision> {
  const { data, error } = await requireSupabase()
    .from('project_revisions').insert({ project_id: projectId, ...revisionPayload(input) })
    .select('*').single()
  throwDbError(error)
  return revisionRow(data)
}

export async function updateRevision(id: string, input: ProjectRevisionWrite): Promise<ProjectRevision> {
  const { data, error } = await requireSupabase()
    .from('project_revisions').update(revisionPayload(input)).eq('id', id).select('*').single()
  throwDbError(error)
  return revisionRow(data)
}
