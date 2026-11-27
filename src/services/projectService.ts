import { requireSupabase, throwDbError } from '../lib/db'
import { fromMoneyDecimal, sumMoney, toMoneyDecimal } from '../lib/money'
import { calculateProjectProgress } from '../lib/projectProgress'
import type { ClientActivity } from '../types/client'
import type {
  DeliveryInput, Project, ProjectBoardResult, ProjectDetail, ProjectFilters,
  ProjectFormClientOption, ProjectFormContractOption, ProjectFormOptions,
  ProjectListItem, ProjectListResult, ProjectMetrics, ProjectMoveStatus,
  ProjectRevision, ProjectSort, ProjectTask, ProjectWrite,
} from '../types/project'

type ProjectRow = Omit<Project, 'contracted_value_cents'> & {
  contracted_value: string | number
  clients?: { name: string } | Array<{ name: string }> | null
}
type ProjectBase = Omit<ProjectListItem, keyof ProjectMetrics>

const SORTS: Record<ProjectSort, { column: string; ascending: boolean; nullsFirst?: boolean }> = {
  name_asc: { column: 'name', ascending: true },
  name_desc: { column: 'name', ascending: false },
  due_asc: { column: 'due_date', ascending: true, nullsFirst: false },
  due_desc: { column: 'due_date', ascending: false, nullsFirst: false },
  created_desc: { column: 'created_at', ascending: false },
}

function nullable(value: string): string | null {
  return value.trim() ? value.trim() : null
}

function moneyCents(value: string | number): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(String(value))) {
    throw new Error('Valor monetário inválido recebido do banco.')
  }
  return fromMoneyDecimal(value)
}

function projectBase(row: ProjectRow): ProjectBase {
  const { contracted_value, clients, ...project } = row
  const relation = Array.isArray(clients) ? clients[0] : clients
  return {
    ...project,
    contracted_value_cents: moneyCents(contracted_value),
    client_name: relation?.name ?? null,
  }
}

function projectFromRow(row: ProjectRow): Project {
  return projectBase(row)
}

function rpcProject(data: unknown): Project {
  if (!data || typeof data !== 'object' || !('id' in data) || typeof data.id !== 'string') {
    throw new Error('Resposta inválida ao salvar projeto.')
  }
  return projectFromRow(data as ProjectRow)
}

function projectPayload(input: ProjectWrite) {
  return {
    client_id: input.clientId,
    contract_id: input.contractId,
    name: input.name,
    service: input.service,
    contracted_value: toMoneyDecimal(input.contractedValueCents),
    description: nullable(input.description),
    start_date: input.startDate,
    due_date: input.dueDate,
    responsible_name: nullable(input.responsibleName),
    priority: input.priority,
  }
}

async function tasksByProject(projectIds: string[]): Promise<Map<string, ProjectTask[]>> {
  const grouped = new Map<string, ProjectTask[]>()
  if (projectIds.length === 0) return grouped
  const { data, error } = await requireSupabase()
    .from('project_tasks').select('*').in('project_id', projectIds)
  throwDbError(error)
  for (const task of (data ?? []) as ProjectTask[]) {
    const current = grouped.get(task.project_id) ?? []
    current.push(task)
    grouped.set(task.project_id, current)
  }
  return grouped
}

async function attachMetrics(rows: ProjectRow[]): Promise<ProjectListItem[]> {
  const grouped = await tasksByProject(rows.map((row) => row.id))
  return rows.map((row) => ({
    ...projectBase(row),
    ...calculateProjectProgress(grouped.get(row.id) ?? []),
  }))
}

export async function listProjects(
  filters: ProjectFilters,
  sort: ProjectSort,
  page: number,
  pageSize = 24,
): Promise<ProjectListResult> {
  let query = requireSupabase().from('projects').select('*, clients(name)', { count: 'exact' })
  const search = filters.search?.trim()
  if (search) {
    const pattern = JSON.stringify(`%${search}%`)
    query = query.or(['name', 'service', 'description'].map((column) => `${column}.ilike.${pattern}`).join(','))
  }
  if (filters.clientId) query = query.eq('client_id', filters.clientId)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.priority) query = query.eq('priority', filters.priority)
  if (filters.dueFrom) query = query.gte('due_date', filters.dueFrom)
  if (filters.dueTo) query = query.lte('due_date', filters.dueTo)

  const order = SORTS[sort]
  const from = page * pageSize
  const { data, error, count } = await query
    .order(order.column, { ascending: order.ascending, nullsFirst: order.nullsFirst })
    .order('id', { ascending: true })
    .range(from, from + pageSize - 1)
  throwDbError(error)
  return { projects: await attachMetrics((data ?? []) as ProjectRow[]), total: count ?? 0 }
}

export async function listProjectsForBoard(): Promise<ProjectBoardResult> {
  const { data, error } = await requireSupabase()
    .from('projects').select('*, clients(name)')
    .is('archived_at', null).neq('status', 'cancelled')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(500)
  throwDbError(error)
  const projects = await attachMetrics((data ?? []) as ProjectRow[])
  return { projects, partial: projects.length === 500 }
}

export async function getProject(id: string): Promise<ProjectDetail | null> {
  const client = requireSupabase()
  const [projectResult, tasksResult, revisionsResult, activitiesResult] = await Promise.all([
    client.from('projects').select('*, clients(name)').eq('id', id).maybeSingle(),
    client.from('project_tasks').select('*').eq('project_id', id).order('position').order('id'),
    client.from('project_revisions').select('*').eq('project_id', id).order('requested_at', { ascending: false }),
    client.from('client_activities').select('*').eq('project_id', id).order('created_at', { ascending: false }),
  ])
  throwDbError(projectResult.error)
  throwDbError(tasksResult.error)
  throwDbError(revisionsResult.error)
  throwDbError(activitiesResult.error)
  if (!projectResult.data) return null
  const tasks = (tasksResult.data ?? []) as ProjectTask[]
  return {
    ...projectBase(projectResult.data as ProjectRow),
    ...calculateProjectProgress(tasks),
    tasks,
    revisions: (revisionsResult.data ?? []) as ProjectRevision[],
    activities: (activitiesResult.data ?? []) as ClientActivity[],
  }
}

export async function createProject(input: ProjectWrite): Promise<Project> {
  const { data, error } = await requireSupabase().rpc('create_project', { p_payload: projectPayload(input) })
  throwDbError(error)
  return rpcProject(data)
}

export async function updateProject(id: string, input: ProjectWrite): Promise<Project> {
  const { data, error } = await requireSupabase().rpc('update_project', { p_project_id: id, p_payload: projectPayload(input) })
  throwDbError(error)
  return rpcProject(data)
}

export async function setProjectStatus(id: string, status: ProjectMoveStatus): Promise<Project> {
  const { data, error } = await requireSupabase().rpc('set_project_status', { p_project_id: id, p_status: status })
  throwDbError(error)
  return rpcProject(data)
}

export async function deliverProject(id: string, input: DeliveryInput): Promise<Project> {
  const { data, error } = await requireSupabase().rpc('deliver_project', {
    p_project_id: id,
    p_payload: {
      delivery_url: input.deliveryUrl,
      files_url: nullable(input.filesUrl),
      final_notes: nullable(input.finalNotes),
      confirmed: input.confirmed,
    },
  })
  throwDbError(error)
  return rpcProject(data)
}

export async function listProjectFormOptions(): Promise<ProjectFormOptions> {
  const client = requireSupabase()
  const [clientsResult, contractsResult, projectsResult] = await Promise.all([
    client.from('clients').select('id,name,status').eq('status', 'active').order('name'),
    client.from('contracts').select('id,client_id,service,total_value,due_date,status').eq('status', 'active').order('service'),
    client.from('projects').select('contract_id,contracted_value,status').neq('status', 'cancelled').order('contract_id'),
  ])
  throwDbError(clientsResult.error)
  throwDbError(contractsResult.error)
  throwDbError(projectsResult.error)

  const clients = ((clientsResult.data ?? []) as Array<{ id: string; name: string; status: string }>)
    .filter((row) => row.status === 'active')
    .map(({ id, name }): ProjectFormClientOption => ({ id, name }))
  const allocated = new Map<string, number>()
  for (const row of (projectsResult.data ?? []) as Array<{ contract_id: string; contracted_value: string | number; status: string }>) {
    if (row.status === 'cancelled') continue
    allocated.set(row.contract_id, sumMoney(allocated.get(row.contract_id) ?? 0, moneyCents(row.contracted_value)))
  }
  const contracts = ((contractsResult.data ?? []) as Array<{
    id: string; client_id: string; service: string; total_value: string | number
    due_date: string | null; status: string
  }>)
    .filter((row) => row.status === 'active')
    .map((row): ProjectFormContractOption => {
      const totalValueCents = moneyCents(row.total_value)
      const allocatedCents = allocated.get(row.id) ?? 0
      return {
        id: row.id, client_id: row.client_id, service: row.service,
        total_value_cents: totalValueCents, allocated_cents: allocatedCents,
        remaining_cents: totalValueCents - allocatedCents, due_date: row.due_date,
      }
    })
  return { clients, contracts }
}
