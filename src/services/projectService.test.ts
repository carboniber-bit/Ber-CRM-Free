import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db')>()
  return { ...actual, requireSupabase: vi.fn(() => ({ rpc, from })) }
})

import {
  createProject, deliverProject, getProject, listProjectFormOptions, listProjects,
  listProjectsForBoard, setProjectStatus,
} from './projectService'

const projectRow = {
  id: 'project-1', owner_id: 'owner-1', client_id: 'client-1', contract_id: 'contract-1', source_link_id: null,
  name: 'Site', service: 'Site', contracted_value: '1234.56', description: null,
  start_date: '2026-11-25', due_date: '2026-12-10', responsible_name: null, priority: 'high',
  status: 'not_started', completed_at: null, delivered_at: null, delivery_confirmed_at: null,
  delivery_url: null, files_url: null, final_notes: null, archived_at: null,
  created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

function listQuery(rows: unknown[], count: number | null = rows.length) {
  const query = {
    select: vi.fn(), or: vi.fn(), eq: vi.fn(), gte: vi.fn(), lte: vi.fn(),
    order: vi.fn(), range: vi.fn(),
  }
  for (const method of [query.select, query.or, query.eq, query.gte, query.lte, query.order]) {
    method.mockReturnValue(query)
  }
  query.range.mockResolvedValue({ data: rows, count, error: null })
  return query
}

function tasksQuery(tasks: Array<{ project_id: string; status: string }>) {
  const query = { select: vi.fn(), in: vi.fn() }
  query.select.mockReturnValue(query)
  query.in.mockResolvedValue({ data: tasks, error: null })
  return query
}

describe('projectService', () => {
  beforeEach(() => {
    rpc.mockReset()
    from.mockReset()
  })

  it('converte centavos e envia projeto para a RPC', async () => {
    rpc.mockResolvedValue({ data: projectRow, error: null })
    const result = await createProject({
      clientId: 'client-1', contractId: 'contract-1', name: 'Site', service: 'Site',
      contractedValueCents: 123456, description: '', startDate: '2026-11-25',
      dueDate: '2026-12-10', responsibleName: '', priority: 'high',
    })
    expect(rpc).toHaveBeenCalledWith('create_project', {
      p_payload: {
        client_id: 'client-1', contract_id: 'contract-1', name: 'Site', service: 'Site',
        contracted_value: '1234.56', description: null, start_date: '2026-11-25',
        due_date: '2026-12-10', responsible_name: null, priority: 'high',
      },
    })
    expect(result).toMatchObject({ id: 'project-1', status: 'not_started', contracted_value_cents: 123456 })
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
    const projects = listQuery([{ ...projectRow, clients: [{ name: 'Empresa A' }] }], 1)
    const tasks = tasksQuery([
      { project_id: 'project-1', status: 'completed' },
      { project_id: 'project-1', status: 'pending' },
    ])
    from.mockImplementation((table: string) => table === 'projects' ? projects : tasks)
    const result = await listProjects({}, 'created_desc', 0)
    expect(tasks.select).toHaveBeenCalledOnce()
    expect(tasks.in).toHaveBeenCalledWith('project_id', ['project-1'])
    expect(result.projects[0]).toMatchObject({
      client_name: 'Empresa A', contracted_value_cents: 123456,
      activeTasks: 2, completedTasks: 1, progressPercent: 50,
    })
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

  it('listProjectsForBoard marks 500 rows as partial', async () => {
    const rows = Array.from({ length: 500 }, (_, index) => ({ ...projectRow, id: `project-${index}` }))
    const projects = {
      select: vi.fn(), is: vi.fn(), neq: vi.fn(), order: vi.fn(), limit: vi.fn(),
    }
    for (const method of [projects.select, projects.is, projects.neq, projects.order]) {
      method.mockReturnValue(projects)
    }
    projects.limit.mockResolvedValue({ data: rows, error: null })
    const tasks = tasksQuery([])
    from.mockImplementation((table: string) => table === 'projects' ? projects : tasks)
    const result = await listProjectsForBoard()
    expect(projects.is).toHaveBeenCalledWith('archived_at', null)
    expect(projects.neq).toHaveBeenCalledWith('status', 'cancelled')
    expect(projects.limit).toHaveBeenCalledWith(500)
    expect(result.partial).toBe(true)
    expect(result.projects).toHaveLength(500)
  })

  it('getProject returns null for missing project', async () => {
    const projectQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }
    const taskQuery = { select: vi.fn(), eq: vi.fn(), order: vi.fn() }
    const revisionQuery = { select: vi.fn(), eq: vi.fn(), order: vi.fn() }
    const activityQuery = { select: vi.fn(), eq: vi.fn(), order: vi.fn() }
    for (const query of [projectQuery, taskQuery, revisionQuery, activityQuery]) {
      query.select.mockReturnValue(query)
      query.eq.mockReturnValue(query)
    }
    projectQuery.maybeSingle.mockResolvedValue({ data: null, error: null })
    taskQuery.order.mockReturnValueOnce(taskQuery).mockResolvedValueOnce({ data: [], error: null })
    revisionQuery.order.mockResolvedValue({ data: [], error: null })
    activityQuery.order.mockResolvedValue({ data: [], error: null })
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
  })

  it('getProject loads tasks revisions and activities in parallel', async () => {
    const projectResult = deferred<unknown>()
    const tasksResult = deferred<unknown>()
    const revisionsResult = deferred<unknown>()
    const activitiesResult = deferred<unknown>()
    const projectQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }
    const taskQuery = { select: vi.fn(), eq: vi.fn(), order: vi.fn() }
    const revisionQuery = { select: vi.fn(), eq: vi.fn(), order: vi.fn() }
    const activityQuery = { select: vi.fn(), eq: vi.fn(), order: vi.fn() }
    for (const query of [projectQuery, taskQuery, revisionQuery, activityQuery]) {
      query.select.mockReturnValue(query)
      query.eq.mockReturnValue(query)
    }
    projectQuery.maybeSingle.mockReturnValue(projectResult.promise)
    taskQuery.order.mockReturnValueOnce(taskQuery).mockReturnValueOnce(tasksResult.promise)
    revisionQuery.order.mockReturnValue(revisionsResult.promise)
    activityQuery.order.mockReturnValue(activitiesResult.promise)
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
    expect(taskQuery.order).toHaveBeenCalledTimes(2)
    expect(revisionQuery.order).toHaveBeenCalledOnce()
    expect(activityQuery.order).toHaveBeenCalledOnce()
    projectResult.resolve({ data: { ...projectRow, clients: { name: 'Empresa A' } }, error: null })
    tasksResult.resolve({ data: [], error: null })
    revisionsResult.resolve({ data: [], error: null })
    activitiesResult.resolve({ data: [], error: null })
    await expect(pending).resolves.toMatchObject({
      id: 'project-1', client_name: 'Empresa A', tasks: [], revisions: [], activities: [],
    })
  })

  it('setProjectStatus sends only project id and status', async () => {
    rpc.mockResolvedValue({ data: { ...projectRow, status: 'in_review' }, error: null })
    await setProjectStatus('project-1', 'in_review')
    expect(rpc).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledWith('set_project_status', {
      p_project_id: 'project-1', p_status: 'in_review',
    })
  })

  it('listProjectFormOptions excludes inactive clients and cancelled contracts and returns real balances', async () => {
    const clientsQuery = {
      select: vi.fn(), eq: vi.fn(), order: vi.fn(),
    }
    const contractsQuery = {
      select: vi.fn(), eq: vi.fn(), order: vi.fn(),
    }
    const projectsQuery = {
      select: vi.fn(), neq: vi.fn(), order: vi.fn(),
    }
    for (const query of [clientsQuery, contractsQuery, projectsQuery]) {
      query.select.mockReturnValue(query)
      query.order.mockResolvedValue({ data: [], error: null })
    }
    clientsQuery.eq.mockReturnValue(clientsQuery)
    contractsQuery.eq.mockReturnValue(contractsQuery)
    projectsQuery.neq.mockReturnValue(projectsQuery)
    clientsQuery.order.mockResolvedValue({
      data: [
        { id: 'client-1', name: 'Cliente Ativo', status: 'active' },
        { id: 'client-2', name: 'Cliente Arquivado', status: 'inactive', archived_at: '2026-11-01T00:00:00Z' },
      ],
      error: null,
    })
    contractsQuery.order.mockResolvedValue({
      data: [
        { id: 'contract-1', client_id: 'client-1', service: 'Site', total_value: '1000.00', due_date: '2026-12-31', status: 'active' },
        { id: 'contract-2', client_id: 'client-1', service: 'Cancelado', total_value: '100.00', due_date: null, status: 'cancelled' },
      ],
      error: null,
    })
    projectsQuery.order.mockResolvedValue({
      data: [
        { contract_id: 'contract-1', contracted_value: '300.00', status: 'in_development' },
        { contract_id: 'contract-1', contracted_value: '200.00', status: 'completed' },
        { contract_id: 'contract-1', contracted_value: '900.00', status: 'cancelled' },
      ],
      error: null,
    })
    from.mockImplementation((table: string) => {
      if (table === 'clients') return clientsQuery
      if (table === 'contracts') return contractsQuery
      if (table === 'projects') return projectsQuery
      throw new Error(`Tabela inesperada: ${table}`)
    })

    const result = await listProjectFormOptions()

    expect(clientsQuery.eq).toHaveBeenCalledWith('status', 'active')
    expect(contractsQuery.eq).toHaveBeenCalledWith('status', 'active')
    expect(projectsQuery.neq).toHaveBeenCalledWith('status', 'cancelled')
    expect(result).toEqual({
      clients: [{ id: 'client-1', name: 'Cliente Ativo' }],
      contracts: [{
        id: 'contract-1', client_id: 'client-1', service: 'Site', total_value_cents: 100000,
        allocated_cents: 50000, remaining_cents: 50000, due_date: '2026-12-31',
      }],
    })
  })
})
