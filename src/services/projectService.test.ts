import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientActivity } from '../types/client'
import type { ProjectRevision, ProjectTask, ProjectWrite } from '../types/project'

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db')>()
  return { ...actual, requireSupabase: vi.fn(() => ({ rpc, from })) }
})

import {
  createProject, deliverProject, getProject, listProjectFormOptions, listProjects,
  listProjectsForBoard, setProjectStatus, updateProject,
} from './projectService'

const projectRow = {
  id: 'project-1', owner_id: 'owner-1', client_id: 'client-1', contract_id: 'contract-1', source_link_id: null,
  name: 'Site', service: 'Site', contracted_value: '1234.56', description: null,
  start_date: '2026-11-25', due_date: '2026-12-10', responsible_name: null, priority: 'high',
  status: 'not_started', completed_at: null, delivered_at: null, delivery_confirmed_at: null,
  delivery_url: null, files_url: null, final_notes: null, archived_at: null,
  created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
}

const projectWrite: ProjectWrite = {
  clientId: 'client-1', contractId: 'contract-1', name: 'Site', service: 'Site',
  contractedValueCents: 123456, description: '', startDate: '2026-11-25',
  dueDate: '2026-12-10', responsibleName: '', priority: 'high',
}

const requiredProjectFields = [
  'id', 'owner_id', 'client_id', 'contract_id', 'source_link_id', 'name', 'service',
  'contracted_value', 'description', 'start_date', 'due_date', 'responsible_name',
  'priority', 'status', 'completed_at', 'delivered_at', 'delivery_confirmed_at',
  'delivery_url', 'files_url', 'final_notes', 'archived_at', 'created_at', 'updated_at',
] as const

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

function queryMock(rows: unknown[] = []) {
  let filtered = rows
  const query = {
    select: vi.fn(), or: vi.fn(), eq: vi.fn(), neq: vi.fn(), is: vi.fn(), in: vi.fn(),
    gte: vi.fn(), lte: vi.fn(), order: vi.fn(), range: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(),
  }
  for (const method of [query.or, query.gte, query.lte, query.order]) {
    method.mockReturnValue(query)
  }
  query.select.mockImplementation(() => {
    filtered = rows
    return query
  })
  query.eq.mockImplementation((column: string, value: unknown) => {
    filtered = filtered.filter((row) => (row as Record<string, unknown>)[column] === value)
    return query
  })
  query.neq.mockImplementation((column: string, value: unknown) => {
    filtered = filtered.filter((row) => (row as Record<string, unknown>)[column] !== value)
    return query
  })
  query.is.mockImplementation((column: string, value: unknown) => {
    filtered = filtered.filter((row) => (row as Record<string, unknown>)[column] === value)
    return query
  })
  query.in.mockImplementation((_column: string, values: unknown[]) => {
    const allowed = new Set(values)
    filtered = filtered.filter((row) => allowed.has((row as Record<string, unknown>)[_column]))
    return query
  })
  query.range.mockImplementation(async (from: number, to: number) => ({
    data: filtered.slice(from, to + 1), count: filtered.length, error: null,
  }))
  query.limit.mockImplementation(async (limit: number) => ({ data: filtered.slice(0, limit), error: null }))
  query.maybeSingle.mockImplementation(async () => ({ data: filtered[0] ?? null, error: null }))
  return query
}

function listQuery(rows: unknown[], count: number | null = rows.length) {
  const query = queryMock(rows)
  query.range.mockResolvedValue({ data: rows, count, error: null })
  return query
}

function tasksQuery(tasks: Array<Pick<ProjectTask, 'project_id' | 'status'>>) {
  return queryMock(tasks)
}

function uuid(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`
}

function task(index: number, overrides: Partial<ProjectTask> = {}): ProjectTask {
  return {
    id: `task-${String(index).padStart(4, '0')}`, owner_id: 'owner-1', project_id: 'project-1',
    title: `Tarefa ${index}`, description: null, status: 'pending', responsible_name: null,
    start_date: null, due_date: null, priority: 'medium', position: index, notes: null,
    completed_at: null, cancelled_at: null, created_at: '2026-11-25T12:00:00Z',
    updated_at: '2026-11-25T12:00:00Z', ...overrides,
  }
}

function revision(index: number, overrides: Partial<ProjectRevision> = {}): ProjectRevision {
  return {
    id: `revision-${String(index).padStart(4, '0')}`, owner_id: 'owner-1', project_id: 'project-1',
    requested_at: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(), description: `Revisão ${index}`,
    responsible_name: null, status: 'requested', completed_at: null, approved_at: null, notes: null,
    created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z', ...overrides,
  }
}

function activity(index: number, overrides: Partial<ClientActivity> = {}): ClientActivity {
  return {
    id: `activity-${String(index).padStart(4, '0')}`, owner_id: 'owner-1', client_id: 'client-1',
    project_id: 'project-1', contract_id: 'contract-1', type: 'note', description: `Atividade ${index}`,
    metadata: {}, created_by: null,
    created_at: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(), ...overrides,
  }
}

describe('projectService', () => {
  beforeEach(() => {
    rpc.mockReset()
    from.mockReset()
  })

  it('converte centavos e envia projeto para a RPC', async () => {
    rpc.mockResolvedValue({ data: projectRow, error: null })
    const result = await createProject(projectWrite)
    expect(rpc).toHaveBeenCalledWith('create_project', {
      p_payload: {
        client_id: 'client-1', contract_id: 'contract-1', name: 'Site', service: 'Site',
        contracted_value: '1234.56', description: null, start_date: '2026-11-25',
        due_date: '2026-12-10', responsible_name: null, priority: 'high',
      },
    })
    expect(result).toMatchObject({ id: 'project-1', status: 'not_started', contracted_value_cents: 123456 })
  })

  it('updateProject envia id e payload completo para a RPC correta', async () => {
    rpc.mockResolvedValue({ data: { ...projectRow, name: 'Site atualizado' }, error: null })
    const result = await updateProject('project-1', { ...projectWrite, name: 'Site atualizado' })
    expect(rpc).toHaveBeenCalledWith('update_project', {
      p_project_id: 'project-1',
      p_payload: {
        client_id: 'client-1', contract_id: 'contract-1', name: 'Site atualizado', service: 'Site',
        contracted_value: '1234.56', description: null, start_date: '2026-11-25',
        due_date: '2026-12-10', responsible_name: null, priority: 'high',
      },
    })
    expect(result).toMatchObject({ id: 'project-1', name: 'Site atualizado', contracted_value_cents: 123456 })
  })

  it('updateProject rejeita erro da RPC', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } })
    await expect(updateProject('project-1', projectWrite))
      .rejects.toThrow('Sem permissão no banco. Verifique se a migration foi executada (grants/RLS).')
  })

  it.each(requiredProjectFields)('updateProject rejeita resposta RPC sem o campo %s', async (field) => {
    const data: Record<string, unknown> = { ...projectRow }
    delete data[field]
    rpc.mockResolvedValue({ data, error: null })
    await expect(updateProject('project-1', projectWrite)).rejects.toThrow('Resposta inválida ao salvar projeto.')
  })

  it.each([null, {}, { id: 42 }])('updateProject rejeita resposta RPC inválida %#', async (data) => {
    rpc.mockResolvedValue({ data, error: null })
    await expect(updateProject('project-1', projectWrite)).rejects.toThrow('Resposta inválida ao salvar projeto.')
  })

  it('entrega com confirmação explícita e não chama função financeira', async () => {
    rpc.mockResolvedValue({ data: { ...projectRow, status: 'delivered' }, error: null })
    await deliverProject('project-1', {
      deliveryUrl: 'https://example.test/site', filesUrl: '', finalNotes: 'Entregue', confirmed: true,
    })
    expect(rpc).toHaveBeenCalledWith('deliver_project', {
      p_project_id: 'project-1',
      p_payload: { delivery_url: 'https://example.test/site', files_url: null, final_notes: 'Entregue', confirmed: true },
    })
    expect(rpc).not.toHaveBeenCalledWith(expect.stringContaining('payment'), expect.anything())
  })

  it('listProjects attaches progress from one task query', async () => {
    const projects = listQuery([{ ...projectRow, contracts: [{ clients: [{ name: 'Empresa A' }] }] }], 1)
    const tasks = tasksQuery([
      { project_id: 'project-1', status: 'completed' },
      { project_id: 'project-1', status: 'pending' },
    ])
    from.mockImplementation((table: string) => table === 'projects' ? projects : tasks)
    const result = await listProjects({}, 'created_desc', 0)
    expect(projects.select).toHaveBeenCalledWith('*, contracts(clients(name))', { count: 'exact' })
    expect(tasks.select).toHaveBeenCalledOnce()
    expect(tasks.select).toHaveBeenCalledWith('project_id,status')
    expect(tasks.in).toHaveBeenCalledWith('project_id', ['project-1'])
    expect(tasks.range).toHaveBeenCalledWith(0, 999)
    expect(result.projects[0]).toMatchObject({
      client_name: 'Empresa A', contracted_value_cents: 123456,
      activeTasks: 2, completedTasks: 1, progressPercent: 50,
    })
  })

  it('listProjects calcula progresso com páginas de tarefas e múltiplos blocos de projetos', async () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      ...projectRow, id: `project-${index}`, contracts: { clients: { name: `Empresa ${index}` } },
    }))
    const projects = listQuery(rows, rows.length)
    const firstPage = Array.from({ length: 1000 }, (_, index) => ({
      project_id: 'project-0', status: index < 500 ? 'completed' as const : 'pending' as const,
    }))
    const tasks = tasksQuery([
      ...firstPage,
      { project_id: 'project-0', status: 'completed' },
      { project_id: 'project-100', status: 'pending' },
    ])
    from.mockImplementation((table: string) => table === 'projects' ? projects : tasks)

    const result = await listProjects({}, 'created_desc', 0)

    expect(tasks.in.mock.calls.map((call) => call[1])).toEqual([
      rows.slice(0, 100).map((row) => row.id),
      rows.slice(0, 100).map((row) => row.id),
      ['project-100'],
    ])
    expect(tasks.range.mock.calls).toEqual([[0, 999], [1000, 1999], [0, 999]])
    expect(result.projects[0]).toMatchObject({
      activeTasks: 1001, completedTasks: 501, progressPercent: 50,
    })
    expect(result.projects[100]).toMatchObject({
      activeTasks: 1, completedTasks: 0, progressPercent: 0,
    })
  })

  it('listProjects mantém progresso nulo quando não há tarefas ativas', async () => {
    const projects = listQuery([{ ...projectRow, contracts: { clients: { name: 'Empresa A' } } }], 1)
    const tasks = tasksQuery([{ project_id: 'project-1', status: 'cancelled' }])
    from.mockImplementation((table: string) => table === 'projects' ? projects : tasks)
    const result = await listProjects({}, 'created_desc', 0)
    expect(result.projects[0]).toMatchObject({
      activeTasks: 0, completedTasks: 0, progressPercent: null,
    })
  })

  it('listProjects rejeita erro da consulta de projetos', async () => {
    const projects = listQuery([])
    projects.range.mockResolvedValue({ data: null, count: null, error: { message: 'permission denied' } })
    from.mockReturnValue(projects)
    await expect(listProjects({}, 'name_asc', 0))
      .rejects.toThrow('Sem permissão no banco. Verifique se a migration foi executada (grants/RLS).')
  })

  it('listProjects rejeita erro de tarefas em página posterior à primeira', async () => {
    const projects = listQuery([{ ...projectRow, contracts: { clients: { name: 'Empresa A' } } }], 1)
    const tasks = tasksQuery([])
    tasks.range
      .mockResolvedValueOnce({
        data: Array.from({ length: 1000 }, () => ({ project_id: 'project-1', status: 'pending' })),
        count: 1000, error: null,
      })
      .mockResolvedValueOnce({ data: null, count: null, error: { message: 'permission denied' } })
    from.mockImplementation((table: string) => table === 'projects' ? projects : tasks)
    await expect(listProjects({}, 'created_desc', 0))
      .rejects.toThrow('Sem permissão no banco. Verifique se a migration foi executada (grants/RLS).')
    expect(tasks.range).toHaveBeenNthCalledWith(2, 1000, 1999)
  })

  it('listProjects returns total from Supabase count', async () => {
    const projects = listQuery([], 37)
    from.mockReturnValue(projects)
    const result = await listProjects({}, 'name_asc', 1, 24)
    expect(result).toEqual({ projects: [], total: 37 })
    expect(projects.range).toHaveBeenCalledWith(24, 47)
  })

  it('listProjects quotes search values in OR', async () => {
    const projects = listQuery([])
    from.mockReturnValue(projects)
    await listProjects({ search: 'Site, "Alpha"' }, 'name_asc', 0)
    const pattern = `name.ilike.${JSON.stringify('%Site, "Alpha"%')}`
    expect(projects.or).toHaveBeenCalledWith([
      pattern,
      pattern.replace('name.', 'service.'),
      pattern.replace('name.', 'description.'),
    ].join(','))
  })

  it('listProjects escapa busca literal com barra, percentual e sublinhado', async () => {
    const projects = listQuery([])
    from.mockReturnValue(projects)
    await listProjects({ search: String.raw`50\%_off` }, 'name_asc', 0)
    const pattern = `name.ilike.${JSON.stringify(String.raw`%50\\\%\_off%`)}`
    expect(projects.or).toHaveBeenCalledWith([
      pattern,
      pattern.replace('name.', 'service.'),
      pattern.replace('name.', 'description.'),
    ].join(','))
  })

  it('listProjectsForBoard marca 500 linhas como parciais e divide UUIDs em blocos de 100', async () => {
    const ids = Array.from({ length: 500 }, (_, index) => uuid(index))
    const rows = ids.map((id, index) => ({
      ...projectRow, id, contracts: { clients: { name: `Empresa ${index}` } },
    }))
    const projects = queryMock(rows)
    const tasks = tasksQuery([])
    from.mockImplementation((table: string) => table === 'projects' ? projects : tasks)

    const result = await listProjectsForBoard()

    expect(projects.select).toHaveBeenCalledWith('*, contracts(clients(name))')
    expect(projects.is).toHaveBeenCalledWith('archived_at', null)
    expect(projects.neq).toHaveBeenCalledWith('status', 'cancelled')
    expect(projects.limit).toHaveBeenCalledWith(500)
    expect(result.partial).toBe(true)
    expect(result.projects).toHaveLength(500)
    expect(result.projects[0].client_name).toBe('Empresa 0')
    const chunks = tasks.in.mock.calls.map((call) => call[1] as string[])
    expect(chunks).toHaveLength(5)
    expect(chunks.flat()).toEqual(ids)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(100)
      expect(JSON.stringify(chunk).length).toBeLessThan(8192)
    }
    expect(tasks.range.mock.calls).toEqual(Array.from({ length: 5 }, () => [0, 999]))
    expect(tasks.order).toHaveBeenCalledWith('project_id', { ascending: true })
    expect(tasks.order).toHaveBeenCalledWith('id', { ascending: true })
  })

  it('listProjectsForBoard aplica os mesmos filtros da lista', async () => {
    const projects = queryMock([{ ...projectRow, contracts: { clients: { name: 'Empresa A' } } }])
    const tasks = tasksQuery([])
    from.mockImplementation((table: string) => table === 'projects' ? projects : tasks)

    const result = await listProjectsForBoard({
      search: 'Site', clientId: 'client-1', status: 'not_started', priority: 'high',
      dueFrom: '2026-12-01', dueTo: '2026-12-31',
    })

    const pattern = `name.ilike.${JSON.stringify('%Site%')}`
    expect(projects.or).toHaveBeenCalledWith([
      pattern,
      pattern.replace('name.', 'service.'),
      pattern.replace('name.', 'description.'),
    ].join(','))
    expect(projects.eq).toHaveBeenCalledWith('client_id', 'client-1')
    expect(projects.eq).toHaveBeenCalledWith('status', 'not_started')
    expect(projects.eq).toHaveBeenCalledWith('priority', 'high')
    expect(projects.gte).toHaveBeenCalledWith('due_date', '2026-12-01')
    expect(projects.lte).toHaveBeenCalledWith('due_date', '2026-12-31')
    expect(result.projects[0].client_name).toBe('Empresa A')
  })

  it('listProjectsForBoard rejeita erro da consulta de projetos', async () => {
    const projects = queryMock([])
    projects.limit.mockResolvedValue({ data: null, error: { message: 'permission denied' } })
    from.mockReturnValue(projects)
    await expect(listProjectsForBoard())
      .rejects.toThrow('Sem permissão no banco. Verifique se a migration foi executada (grants/RLS).')
  })

  it('getProject returns null for missing project', async () => {
    const projectQuery = queryMock([])
    const taskQuery = queryMock([])
    const revisionQuery = queryMock([])
    const activityQuery = queryMock([])
    from.mockImplementation((table: string) => {
      switch (table) {
        case 'projects': return projectQuery
        case 'project_tasks': return taskQuery
        case 'project_revisions': return revisionQuery
        case 'client_activities': return activityQuery
        default: throw new Error(`Tabela inesperada: ${table}`)
      }
    })
    await expect(getProject('missing')).resolves.toBeNull()
    expect(projectQuery.select).toHaveBeenCalledWith('*, contracts(clients(name))')
  })

  it('getProject loads tasks revisions and activities in parallel', async () => {
    const projectResult = deferred<unknown>()
    const tasksResult = deferred<unknown>()
    const revisionsResult = deferred<unknown>()
    const activitiesResult = deferred<unknown>()
    const projectQuery = queryMock([])
    const taskQuery = queryMock([])
    const revisionQuery = queryMock([])
    const activityQuery = queryMock([])
    projectQuery.maybeSingle.mockReturnValue(projectResult.promise)
    taskQuery.range.mockReturnValueOnce(tasksResult.promise)
    revisionQuery.range.mockReturnValueOnce(revisionsResult.promise)
    activityQuery.range.mockReturnValueOnce(activitiesResult.promise)
    from.mockImplementation((table: string) => {
      switch (table) {
        case 'projects': return projectQuery
        case 'project_tasks': return taskQuery
        case 'project_revisions': return revisionQuery
        case 'client_activities': return activityQuery
        default: throw new Error(`Tabela inesperada: ${table}`)
      }
    })

    const pending = getProject('project-1')
    expect(projectQuery.maybeSingle).toHaveBeenCalledOnce()
    expect(taskQuery.range).toHaveBeenCalledWith(0, 999)
    expect(revisionQuery.range).toHaveBeenCalledWith(0, 999)
    expect(activityQuery.range).toHaveBeenCalledWith(0, 999)
    projectResult.resolve({ data: { ...projectRow, contracts: { clients: { name: 'Empresa A' } } }, error: null })
    tasksResult.resolve({ data: [], count: 0, error: null })
    revisionsResult.resolve({ data: [], count: 0, error: null })
    activitiesResult.resolve({ data: [], count: 0, error: null })
    await expect(pending).resolves.toMatchObject({
      id: 'project-1', client_name: 'Empresa A', tasks: [], revisions: [], activities: [],
    })
  })

  it('getProject pagina todas as coleções e reaplica a ordenação de domínio', async () => {
    const projectQuery = queryMock([{ ...projectRow, contracts: { clients: [{ name: 'Empresa A' }] } }])
    const tasks = Array.from({ length: 1001 }, (_, index) => task(index, {
      position: index === 999 || index === 1000 ? 0 : 1001 - index,
    }))
    const revisions = Array.from({ length: 1001 }, (_, index) => revision(index, {
      requested_at: index === 999 || index === 1000 ? '2099-01-01T00:00:00Z' : revision(index).requested_at,
    }))
    const activities = Array.from({ length: 1001 }, (_, index) => activity(index, {
      created_at: index === 999 || index === 1000 ? '2099-01-01T00:00:00Z' : activity(index).created_at,
    }))
    const taskQuery = queryMock(tasks)
    const revisionQuery = queryMock(revisions)
    const activityQuery = queryMock(activities)
    from.mockImplementation((table: string) => {
      switch (table) {
        case 'projects': return projectQuery
        case 'project_tasks': return taskQuery
        case 'project_revisions': return revisionQuery
        case 'client_activities': return activityQuery
        default: throw new Error(`Tabela inesperada: ${table}`)
      }
    })

    const result = await getProject('project-1')

    expect(result).not.toBeNull()
    expect(result?.client_name).toBe('Empresa A')
    expect(result?.tasks).toHaveLength(1001)
    expect(result?.tasks.slice(0, 3).map((item) => item.id)).toEqual(['task-0999', 'task-1000', 'task-0998'])
    expect(result?.tasks.at(-1)?.id).toBe('task-0000')
    expect(result?.revisions).toHaveLength(1001)
    expect(result?.revisions.slice(0, 3).map((item) => item.id)).toEqual([
      'revision-0999', 'revision-1000', 'revision-0998',
    ])
    expect(result?.activities).toHaveLength(1001)
    expect(result?.activities.slice(0, 3).map((item) => item.id)).toEqual([
      'activity-0999', 'activity-1000', 'activity-0998',
    ])
    expect(result).toMatchObject({ activeTasks: 1001, completedTasks: 0, progressPercent: 0 })
    for (const query of [taskQuery, revisionQuery, activityQuery]) {
      expect(query.range.mock.calls).toEqual([[0, 999], [1000, 1999]])
      expect(query.order).toHaveBeenCalledWith('id', { ascending: true })
    }
  })

  it.each(['projects', 'project_tasks', 'project_revisions', 'client_activities'] as const)(
    'getProject rejeita erro de consulta em %s',
    async (table) => {
      const queries = {
        projects: queryMock([{ ...projectRow, contracts: { clients: { name: 'Empresa A' } } }]),
        project_tasks: queryMock([]),
        project_revisions: queryMock([]),
        client_activities: queryMock([]),
      }
      const error = { message: 'permission denied' }
      if (table === 'projects') queries[table].maybeSingle.mockResolvedValue({ data: null, error })
      else queries[table].range.mockResolvedValue({ data: null, count: null, error })
      from.mockImplementation((name: string) => {
        if (name in queries) return queries[name as keyof typeof queries]
        throw new Error(`Tabela inesperada: ${name}`)
      })
      await expect(getProject('project-1'))
        .rejects.toThrow('Sem permissão no banco. Verifique se a migration foi executada (grants/RLS).')
    },
  )

  it('setProjectStatus sends only project id and status', async () => {
    rpc.mockResolvedValue({ data: { ...projectRow, status: 'in_review' }, error: null })
    await setProjectStatus('project-1', 'in_review')
    expect(rpc).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledWith('set_project_status', {
      p_project_id: 'project-1', p_status: 'in_review',
    })
  })

  it('listProjectFormOptions exclui só clientes inativos e contratos cancelados e mantém saldos reais', async () => {
    const clientsQuery = queryMock([
      { id: 'client-1', name: 'Cliente Ativo', status: 'active' },
      { id: 'client-2', name: 'Cliente Em Projeto', status: 'in_project' },
      { id: 'client-3', name: 'Cliente Inativo', status: 'inactive' },
    ])
    const contractsQuery = queryMock([
      { id: 'contract-1', client_id: 'client-1', service: 'Site', total_value: '1000.00', due_date: '2026-12-31', status: 'active' },
      { id: 'contract-2', client_id: 'client-1', service: 'Cancelado', total_value: '100.00', due_date: null, status: 'cancelled' },
    ])
    const projectsQuery = queryMock([
      { id: 'project-1', contract_id: 'contract-1', contracted_value: '300.00', status: 'in_development' },
      { id: 'project-2', contract_id: 'contract-1', contracted_value: '200.00', status: 'completed' },
      { id: 'project-3', contract_id: 'contract-1', contracted_value: '900.00', status: 'cancelled' },
    ])
    from.mockImplementation((table: string) => {
      if (table === 'clients') return clientsQuery
      if (table === 'contracts') return contractsQuery
      if (table === 'projects') return projectsQuery
      throw new Error(`Tabela inesperada: ${table}`)
    })

    const result = await listProjectFormOptions()

    expect(clientsQuery.neq).toHaveBeenCalledWith('status', 'inactive')
    expect(clientsQuery.eq).not.toHaveBeenCalled()
    expect(contractsQuery.eq).toHaveBeenCalledWith('status', 'active')
    expect(projectsQuery.neq).toHaveBeenCalledWith('status', 'cancelled')
    expect(projectsQuery.select).toHaveBeenCalledWith('id,contract_id,contracted_value,status')
    expect(result).toEqual({
      clients: [
        { id: 'client-1', name: 'Cliente Ativo' },
        { id: 'client-2', name: 'Cliente Em Projeto' },
      ],
      contracts: [{
        id: 'contract-1', client_id: 'client-1', service: 'Site', total_value_cents: 100000,
        allocated_cents: 50000, remaining_cents: 50000, due_date: '2026-12-31',
      }],
    })
  })

  it('listProjectFormOptions pagina clientes, contratos e projetos antes de calcular saldos', async () => {
    const clients = Array.from({ length: 1001 }, (_, index) => ({
      id: `client-${index}`, name: `Cliente ${String(index).padStart(4, '0')}`,
      status: index === 1000 ? 'awaiting_approval' : 'active',
    }))
    const contracts = Array.from({ length: 1001 }, (_, index) => ({
      id: `contract-${index}`, client_id: 'client-1', service: `Serviço ${String(index).padStart(4, '0')}`,
      total_value: '1000.00', due_date: null, status: 'active',
    }))
    const projects = Array.from({ length: 1001 }, (_, index) => ({
      id: `project-${index}`, contract_id: index === 1000 ? 'contract-1000' : 'contract-1',
      contracted_value: '1.00', status: 'completed',
    }))
    const clientsQuery = queryMock(clients)
    const contractsQuery = queryMock(contracts)
    const projectsQuery = queryMock(projects)
    from.mockImplementation((table: string) => {
      if (table === 'clients') return clientsQuery
      if (table === 'contracts') return contractsQuery
      if (table === 'projects') return projectsQuery
      throw new Error(`Tabela inesperada: ${table}`)
    })

    const result = await listProjectFormOptions()

    expect(result.clients).toHaveLength(1001)
    expect(result.clients.at(-1)).toEqual({ id: 'client-1000', name: 'Cliente 1000' })
    expect(result.contracts).toHaveLength(1001)
    expect(result.contracts.find((contract) => contract.id === 'contract-1')).toMatchObject({
      allocated_cents: 100000, remaining_cents: 0,
    })
    expect(result.contracts.find((contract) => contract.id === 'contract-1000')).toMatchObject({
      allocated_cents: 100, remaining_cents: 99900,
    })
    for (const query of [clientsQuery, contractsQuery, projectsQuery]) {
      expect(query.range.mock.calls).toEqual([[0, 999], [1000, 1999]])
      expect(query.order).toHaveBeenCalledWith('id', { ascending: true })
    }
    expect(clientsQuery.order).toHaveBeenCalledWith('name', { ascending: true })
    expect(contractsQuery.order).toHaveBeenCalledWith('service', { ascending: true })
  })

  it.each(['clients', 'contracts', 'projects'] as const)(
    'listProjectFormOptions rejeita erro de consulta em %s',
    async (table) => {
      const queries = {
        clients: queryMock([]), contracts: queryMock([]), projects: queryMock([]),
      }
      queries[table].range.mockResolvedValue({ data: null, count: null, error: { message: 'permission denied' } })
      from.mockImplementation((name: string) => {
        if (name in queries) return queries[name as keyof typeof queries]
        throw new Error(`Tabela inesperada: ${name}`)
      })
      await expect(listProjectFormOptions())
        .rejects.toThrow('Sem permissão no banco. Verifique se a migration foi executada (grants/RLS).')
    },
  )
})
