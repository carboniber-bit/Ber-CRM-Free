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

type Embedded<T> = T | T[] | null
type ProjectRow = Omit<Project, 'contracted_value_cents'> & {
  contracted_value: string | number
  contracts?: Embedded<{ clients?: Embedded<{ name: string }> }>
}
type ProjectBase = Omit<ProjectListItem, keyof ProjectMetrics>
type ProjectTaskMetrics = Pick<ProjectTask, 'project_id' | 'status'>

interface ProjectFilterQuery {
  or(filters: string): this
  eq(column: string, value: unknown): this
  gte(column: string, value: unknown): this
  lte(column: string, value: unknown): this
}

const PAGE_SIZE = 1000
const ID_CHUNK_SIZE = 100
const REQUIRED_PROJECT_FIELDS = [
  'id', 'owner_id', 'client_id', 'contract_id', 'source_link_id', 'name', 'service',
  'contracted_value', 'description', 'start_date', 'due_date', 'responsible_name',
  'priority', 'status', 'completed_at', 'delivered_at', 'delivery_confirmed_at',
  'delivery_url', 'files_url', 'final_notes', 'archived_at', 'created_at', 'updated_at',
] as const

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

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
    throwDbError(error)
    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return rows
}

function firstRelation<T>(value: Embedded<T> | undefined): T | null {
  return (Array.isArray(value) ? value[0] : value) ?? null
}

function projectBase(row: ProjectRow): ProjectBase {
  const { contracted_value, contracts, ...project } = row
  const client = firstRelation(firstRelation(contracts)?.clients)
  return {
    ...project,
    contracted_value_cents: moneyCents(contracted_value),
    client_name: client?.name ?? null,
  }
}

function projectFromRow(row: ProjectRow): Project {
  return projectBase(row)
}

function rpcProject(data: unknown): Project {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Resposta inválida ao salvar projeto.')
  }
  const candidate = data as Record<string, unknown>
  if (typeof candidate.id !== 'string' || REQUIRED_PROJECT_FIELDS.some(
    (field) => !(field in candidate) || candidate[field] === undefined,
  )) {
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

function applyProjectFilters<T extends ProjectFilterQuery>(query: T, filters: ProjectFilters): T {
  const search = filters.search?.trim()
  if (search) {
    const literal = search.replace(/[\\%_]/g, (character) => `\\${character}`)
    const pattern = JSON.stringify(`%${literal}%`)
    query = query.or(['name', 'service', 'description']
      .map((column) => `${column}.ilike.${pattern}`).join(','))
  }
  if (filters.clientId) query = query.eq('client_id', filters.clientId)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.priority) query = query.eq('priority', filters.priority)
  if (filters.dueFrom) query = query.gte('due_date', filters.dueFrom)
  if (filters.dueTo) query = query.lte('due_date', filters.dueTo)
  return query
}

async function tasksByProject(projectIds: string[]): Promise<Map<string, ProjectTaskMetrics[]>> {
  const grouped = new Map<string, ProjectTaskMetrics[]>()
  if (projectIds.length === 0) return grouped
  const client = requireSupabase()
  for (let index = 0; index < projectIds.length; index += ID_CHUNK_SIZE) {
    const projectIdChunk = projectIds.slice(index, index + ID_CHUNK_SIZE)
    const tasks = await fetchAllPages<ProjectTaskMetrics>((from, to) => client
      .from('project_tasks').select('project_id,status')
      .in('project_id', projectIdChunk)
      .order('project_id', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to))
    for (const task of tasks) {
      const current = grouped.get(task.project_id) ?? []
      current.push(task)
      grouped.set(task.project_id, current)
    }
  }
  return grouped
}

async function attachMetrics(rows: ProjectRow[]): Promise<ProjectListItem[]> {
  const grouped = await tasksByProject(rows.map((row) => row.id))
  return rows.map((row) => ({
    ...projectBase(row),
    ...calculateProjectProgress((grouped.get(row.id) ?? []) as ProjectTask[]),
  }))
}

export async function listProjects(
  filters: ProjectFilters,
  sort: ProjectSort,
  page: number,
  pageSize = 24,
): Promise<ProjectListResult> {
  let query = requireSupabase().from('projects').select('*, contracts(clients(name))', { count: 'exact' })
  query = applyProjectFilters(query, filters)

  const order = SORTS[sort]
  const from = page * pageSize
  const { data, error, count } = await query
    .order(order.column, { ascending: order.ascending, nullsFirst: order.nullsFirst })
    .order('id', { ascending: true })
    .range(from, from + pageSize - 1)
  throwDbError(error)
  return { projects: await attachMetrics((data ?? []) as ProjectRow[]), total: count ?? 0 }
}

export async function listProjectsForBoard(filters: ProjectFilters = {}): Promise<ProjectBoardResult> {
  let query = requireSupabase()
    .from('projects').select('*, contracts(clients(name))')
    .is('archived_at', null).neq('status', 'cancelled')
  query = applyProjectFilters(query, filters)
  const { data, error } = await query
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
  const [projectResult, tasks, revisions, activities] = await Promise.all([
    client.from('projects').select('*, contracts(clients(name))').eq('id', id).maybeSingle(),
    fetchAllPages<ProjectTask>((from, to) => client.from('project_tasks').select('*')
      .eq('project_id', id).order('id', { ascending: true }).range(from, to)),
    fetchAllPages<ProjectRevision>((from, to) => client.from('project_revisions').select('*')
      .eq('project_id', id).order('id', { ascending: true }).range(from, to)),
    fetchAllPages<ClientActivity>((from, to) => client.from('client_activities').select('*')
      .eq('project_id', id).order('id', { ascending: true }).range(from, to)),
  ])
  throwDbError(projectResult.error)
  if (!projectResult.data) return null
  tasks.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
  revisions.sort((a, b) => b.requested_at.localeCompare(a.requested_at) || a.id.localeCompare(b.id))
  activities.sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id))
  return {
    ...projectBase(projectResult.data as ProjectRow),
    ...calculateProjectProgress(tasks),
    tasks,
    revisions,
    activities,
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
  const [clientRows, contractRows, projectRows] = await Promise.all([
    fetchAllPages<{ id: string; name: string; status: string }>((from, to) => client
      .from('clients').select('id,name,status').neq('status', 'inactive')
      .order('name', { ascending: true }).order('id', { ascending: true }).range(from, to)),
    fetchAllPages<{
      id: string; client_id: string; service: string; total_value: string | number
      due_date: string | null; status: string
    }>((from, to) => client.from('contracts').select('id,client_id,service,total_value,due_date,status')
      .eq('status', 'active')
      .order('service', { ascending: true }).order('id', { ascending: true }).range(from, to)),
    fetchAllPages<{ id: string; contract_id: string; contracted_value: string | number; status: string }>(
      (from, to) => client.from('projects').select('id,contract_id,contracted_value,status')
        .neq('status', 'cancelled').order('id', { ascending: true }).range(from, to),
    ),
  ])

  const clients = clientRows.map(({ id, name }): ProjectFormClientOption => ({ id, name }))
  const allocated = new Map<string, number>()
  for (const row of projectRows) {
    if (row.status === 'cancelled') continue
    allocated.set(row.contract_id, sumMoney(allocated.get(row.contract_id) ?? 0, moneyCents(row.contracted_value)))
  }
  const contracts = contractRows
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
