import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Activity } from '../types/activity'
import type {
  Client, ClientActivity, ClientWrite, CreateClientInput, InitialContractInput,
  LeadClientLink,
} from '../types/client'
import type { Contract } from '../types/contract'
import type { Project } from '../types/project'

const { rpc, requireSupabase } = vi.hoisted(() => ({
  rpc: vi.fn(),
  requireSupabase: vi.fn(),
}))

vi.mock('../lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db')>()
  return { ...actual, requireSupabase }
})

import {
  archiveClient, convertLeadToClient, countConvertedLeads, createClient,
  findClientDuplicateCandidates, getClient, getLeadClientLink, listClients,
  listLeadClientLinks, updateClient,
} from './clientService'

type QueryResult = {
  data: unknown
  error: { message: string } | null
  count?: number | null
}

type SelectOptions = { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }

interface QueryCall {
  table: string
  select: string
  selectOptions: SelectOptions | null
  eq: Array<[string, unknown]>
  inFilters: Array<[string, unknown[]]>
  or: string | null
  ilike: Array<[string, string]>
  order: Array<[string, { ascending: boolean }]>
  range: [number, number] | null
  limit: number | null
  maybeSingle: boolean
}

interface MutationCall {
  table: string
  operation: 'insert' | 'update' | 'delete'
  values?: unknown
}

class FakeSupabase {
  readonly fromCalls: string[] = []
  readonly calls: QueryCall[] = []
  readonly mutations: MutationCall[] = []
  private readonly responses = new Map<string, QueryResult[]>()

  from(table: string): FakeQuery {
    this.fromCalls.push(table)
    return new FakeQuery(this, table)
  }

  queue(table: string, result: QueryResult): void {
    const responses = this.responses.get(table) ?? []
    responses.push(result)
    this.responses.set(table, responses)
  }

  nextResult(table: string): QueryResult {
    return this.responses.get(table)?.shift() ?? { data: [], error: null }
  }
}

class FakeQuery implements PromiseLike<QueryResult> {
  private selectColumns = ''
  private selectOptions: SelectOptions | null = null
  private readonly eqFilters: Array<[string, unknown]> = []
  private readonly inFilters: Array<[string, unknown[]]> = []
  private orFilter: string | null = null
  private readonly ilikeFilters: Array<[string, string]> = []
  private readonly orderCalls: Array<[string, { ascending: boolean }]> = []
  private rangeCall: [number, number] | null = null
  private rowLimit: number | null = null
  private singleResult = false
  private result: Promise<QueryResult> | null = null
  private readonly client: FakeSupabase
  private readonly table: string

  constructor(client: FakeSupabase, table: string) {
    this.client = client
    this.table = table
  }

  select(columns: string, options?: SelectOptions): this {
    this.selectColumns = columns
    this.selectOptions = options ?? null
    return this
  }

  eq(column: string, value: unknown): this {
    this.eqFilters.push([column, value])
    return this
  }

  in(column: string, values: readonly unknown[]): this {
    this.inFilters.push([column, [...values]])
    return this
  }

  or(filter: string): this {
    this.orFilter = filter
    return this
  }

  ilike(column: string, pattern: string): this {
    this.ilikeFilters.push([column, pattern])
    return this
  }

  order(column: string, options: { ascending: boolean }): this {
    this.orderCalls.push([column, options])
    return this
  }

  range(from: number, to: number): this {
    this.rangeCall = [from, to]
    return this
  }

  limit(count: number): this {
    this.rowLimit = count
    return this
  }

  maybeSingle(): Promise<QueryResult> {
    this.singleResult = true
    return this.execute()
  }

  insert(values: unknown): this {
    this.client.mutations.push({ table: this.table, operation: 'insert', values })
    return this
  }

  update(values: unknown): this {
    this.client.mutations.push({ table: this.table, operation: 'update', values })
    return this
  }

  delete(): this {
    this.client.mutations.push({ table: this.table, operation: 'delete' })
    return this
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private execute(): Promise<QueryResult> {
    if (this.result) return this.result
    this.client.calls.push({
      table: this.table,
      select: this.selectColumns,
      selectOptions: this.selectOptions,
      eq: [...this.eqFilters],
      inFilters: [...this.inFilters],
      or: this.orFilter,
      ilike: [...this.ilikeFilters],
      order: [...this.orderCalls],
      range: this.rangeCall,
      limit: this.rowLimit,
      maybeSingle: this.singleResult,
    })
    this.result = Promise.resolve(this.client.nextResult(this.table))
    return this.result
  }
}

interface ContractRow extends Omit<Contract, 'total_value_cents'> {
  total_value: string | number
}

interface ProjectRow extends Omit<Project, 'contracted_value_cents'> {
  contracted_value: string | number
}

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    owner_id: 'owner-1',
    creation_key: '00000000-0000-0000-0000-000000000501',
    name: 'Empresa A',
    responsible_name: 'Ana Responsável',
    phone: '(11) 99999-9999',
    whatsapp: null,
    email: 'contato@empresa-a.test',
    cnpj: '12.345.678/0001-95',
    cnpj_digits: '12345678000195',
    phone_canonical: '5511999999999',
    whatsapp_canonical: null,
    website: null,
    instagram: null,
    address: null,
    city: 'São Paulo',
    district: null,
    zip_code: null,
    state: 'SP',
    niche: null,
    notes: null,
    status: 'active',
    source: 'manual',
    converted_at: null,
    archived_at: null,
    created_at: '2026-11-20T12:00:00Z',
    updated_at: '2026-11-20T12:00:00Z',
    ...overrides,
  }
}

function makeContractRow(overrides: Partial<ContractRow> = {}): ContractRow {
  return {
    id: 'contract-1',
    owner_id: 'owner-1',
    client_id: 'client-1',
    source_link_id: null,
    creation_key: '00000000-0000-0000-0000-000000000601',
    service: 'Site',
    total_value: '1234.56',
    contracted_at: '2026-11-20',
    due_date: '2026-12-20',
    payment_method: 'pix',
    payment_terms: 'À vista',
    status: 'active',
    notes: null,
    cancelled_at: null,
    created_at: '2026-11-20T12:00:00Z',
    updated_at: '2026-11-20T12:00:00Z',
    ...overrides,
  }
}

function makeProjectRow(overrides: Partial<ProjectRow> = {}): ProjectRow {
  return {
    id: 'project-1',
    owner_id: 'owner-1',
    client_id: 'client-1',
    contract_id: 'contract-1',
    source_link_id: null,
    name: 'Site da Empresa A',
    service: 'Site',
    contracted_value: '500.00',
    description: null,
    start_date: '2026-11-21',
    due_date: '2026-12-10',
    responsible_name: 'Ana Responsável',
    priority: 'medium',
    status: 'not_started',
    completed_at: null,
    delivered_at: null,
    delivery_confirmed_at: null,
    delivery_url: null,
    files_url: null,
    final_notes: null,
    archived_at: null,
    created_at: '2026-11-20T12:00:00Z',
    updated_at: '2026-11-20T12:00:00Z',
    ...overrides,
  }
}

function makeClientActivity(overrides: Partial<ClientActivity> = {}): ClientActivity {
  return {
    id: 'client-activity-1',
    owner_id: 'owner-1',
    client_id: 'client-1',
    project_id: null,
    contract_id: null,
    type: 'note',
    description: 'Nota do cliente',
    metadata: {},
    created_by: 'owner-1',
    created_at: '2026-11-25T12:00:00Z',
    ...overrides,
  }
}

function makeLink(overrides: Partial<LeadClientLink> = {}): LeadClientLink {
  return {
    id: 'link-1',
    owner_id: 'owner-1',
    lead_id: 'lead-1',
    client_id: 'client-1',
    converted_at: '2026-11-20T12:00:00Z',
    created_at: '2026-11-20T12:00:00Z',
    ...overrides,
  }
}

function makeLeadActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'lead-activity-1',
    lead_id: 'lead-1',
    owner_id: 'owner-1',
    type: 'mensagem',
    description: 'Mensagem do lead',
    user_id: 'owner-1',
    created_at: '2026-11-24T12:00:00Z',
    ...overrides,
  }
}

function makeClientWrite(overrides: Partial<ClientWrite> = {}): ClientWrite {
  return {
    name: 'Empresa A',
    responsible_name: null,
    phone: null,
    whatsapp: null,
    email: null,
    cnpj: null,
    website: null,
    instagram: null,
    address: null,
    city: null,
    district: null,
    zip_code: null,
    state: null,
    niche: null,
    notes: null,
    status: 'active',
    ...overrides,
  }
}

function makeInitialContract(overrides: Partial<InitialContractInput> = {}): InitialContractInput {
  return {
    service: 'Site',
    totalValueCents: 123456,
    contractedAt: '2026-11-25',
    dueDate: null,
    paymentMethod: 'pix',
    paymentTerms: 'À vista',
    notes: '',
    ...overrides,
  }
}

function makeTwoPages<T>(makeRow: (index: number) => T): [T[], T[]] {
  return [
    Array.from({ length: 1000 }, (_, index) => makeRow(index)),
    [makeRow(1000)],
  ]
}

function chunkRows<T>(rows: T[], size = 100): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size))
  }
  return chunks
}

let supabase: FakeSupabase

beforeEach(() => {
  rpc.mockReset()
  requireSupabase.mockReset()
  supabase = new FakeSupabase()
  requireSupabase.mockReturnValue({
    rpc,
    from: (table: string) => supabase.from(table),
  } as unknown as SupabaseClient)
})

describe('clientService', () => {
  it('envia centavos como decimal e normaliza o JSON da conversão', async () => {
    rpc.mockResolvedValue({
      data: {
        client_id: 'client-1', link_id: 'link-1', contract_id: 'contract-1',
        project_id: null, already_existed: false,
      },
      error: null,
    })

    const result = await convertLeadToClient('lead-1', {
      service: 'Site', contractedValueCents: 123456, contractedAt: '2026-11-25',
      paymentMethod: 'pix', paymentTerms: 'À vista', notes: '', project: null,
    })

    expect(rpc).toHaveBeenCalledWith('convert_lead_to_client', {
      p_lead_id: 'lead-1', p_service: 'Site', p_contracted_value: '1234.56',
      p_contracted_at: '2026-11-25', p_payment_method: 'pix',
      p_payment_terms: 'À vista', p_notes: null, p_project_name: null,
      p_project_start_date: null, p_project_due_date: null,
    })
    expect(result).toEqual({
      client_id: 'client-1', link_id: 'link-1', contract_id: 'contract-1',
      project_id: null, already_existed: false,
    })
  })

  it('rejeita JSON vazio da RPC', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await expect(convertLeadToClient('lead-1', {
      service: 'Site', contractedValueCents: 100, contractedAt: '2026-11-25',
      paymentMethod: '', paymentTerms: '', notes: '', project: null,
    })).rejects.toThrow('Não foi possível converter o lead.')
  })

  it('listClients aplica busca, status, cidade, ordenação estável e range', async () => {
    const client = makeClient()
    supabase.queue('clients', { data: [client], error: null, count: 37 })

    const result = await listClients(
      { search: 'Empresa', status: 'active', city: 'São Paulo' },
      'name_asc',
      1,
      20,
    )

    expect(supabase.calls).toHaveLength(1)
    expect(supabase.calls[0]).toEqual({
      table: 'clients',
      select: '*',
      selectOptions: { count: 'exact' },
      eq: [['status', 'active']],
      inFilters: [],
      or: 'name.ilike."%Empresa%",responsible_name.ilike."%Empresa%",email.ilike."%Empresa%"',
      ilike: [['city', '%São Paulo%']],
      order: [['name', { ascending: true }], ['id', { ascending: true }]],
      range: [20, 39],
      limit: null,
      maybeSingle: false,
    })
    expect(result).toEqual({ clients: [client], total: 37 })
  })

  it('listClients pesquisa nome quando o texto contém dígitos que não formam um CNPJ', async () => {
    const client = makeClient({ name: 'Empresa 2' })
    supabase.queue('clients', { data: [client], error: null, count: 1 })

    const result = await listClients({ search: 'Empresa 2', status: '', city: '' }, 'name_asc', 0)

    expect(result.clients).toEqual([client])
    expect(supabase.calls[0].eq).toEqual([])
    expect(supabase.calls[0].or).toBe('name.ilike."%Empresa 2%",responsible_name.ilike."%Empresa 2%",email.ilike."%Empresa 2%"')
  })

  it('listClients aceita CNPJ completo e também mantém a busca textual', async () => {
    const client = makeClient()
    supabase.queue('clients', { data: [client], error: null, count: 1 })

    await listClients({ search: '12.345.678/0001-95', status: '', city: '' }, 'name_asc', 0)

    expect(supabase.calls[0].eq).toEqual([])
    expect(supabase.calls[0].or).toBe('cnpj_digits.eq."12345678000195",name.ilike."%12.345.678/0001-95%",responsible_name.ilike."%12.345.678/0001-95%",email.ilike."%12.345.678/0001-95%"')
  })

  it('listClients retorna total do Supabase, não o tamanho da página', async () => {
    const clients = [makeClient(), makeClient({ id: 'client-2', name: 'Empresa B' })]
    supabase.queue('clients', { data: clients, error: null, count: 37 })

    const result = await listClients({ search: '', status: '', city: '' }, 'created_desc', 0)

    expect(result.clients).toEqual(clients)
    expect(result.total).toBe(37)
    expect(result.total).not.toBe(result.clients.length)
  })

  it('getClient retorna null para cliente inexistente', async () => {
    supabase.queue('clients', { data: null, error: null })

    const result = await getClient('missing-client')

    expect(result).toBeNull()
    expect(supabase.fromCalls).toEqual(['clients'])
    expect(supabase.calls[0]).toMatchObject({
      table: 'clients',
      select: '*',
      eq: [['id', 'missing-client']],
      maybeSingle: true,
    })
  })

  it('getClient normaliza numeric de contrato e projeto para centavos', async () => {
    const client = makeClient()
    supabase.queue('clients', { data: client, error: null })
    supabase.queue('contracts', { data: [makeContractRow({ total_value: '1234.56' })], error: null })
    supabase.queue('projects', { data: [makeProjectRow({ contracted_value: '500.00' })], error: null })
    supabase.queue('client_activities', { data: [], error: null })
    supabase.queue('lead_client_links', { data: [], error: null })

    const detail = await getClient(client.id)

    expect(detail?.client).toEqual(client)
    expect(detail?.contracts[0].total_value_cents).toBe(123456)
    expect(detail?.contracts[0]).not.toHaveProperty('total_value')
    expect(detail?.projects[0].contracted_value_cents).toBe(50000)
    expect(detail?.projects[0]).not.toHaveProperty('contracted_value')
  })

  it('getClient pagina contratos além do limite do PostgREST', async () => {
    const client = makeClient()
    const [firstPage, lastPage] = makeTwoPages((index) => makeContractRow({
      id: `contract-${String(index).padStart(4, '0')}`,
    }))
    const contracts = [...firstPage, ...lastPage]
    supabase.queue('clients', { data: client, error: null })
    supabase.queue('contracts', { data: firstPage, error: null })
    supabase.queue('contracts', { data: lastPage, error: null })
    supabase.queue('projects', { data: [], error: null })
    supabase.queue('client_activities', { data: [], error: null })
    supabase.queue('lead_client_links', { data: [], error: null })

    const detail = await getClient(client.id)

    expect(detail?.contracts).toHaveLength(1001)
    expect(detail?.contracts.map((contract) => contract.id)).toEqual(contracts.map((contract) => contract.id))
    const queries = supabase.calls.filter((call) => call.table === 'contracts')
    expect(queries.map((call) => call.range)).toEqual([[0, 999], [1000, 1999]])
    const expectedOrder = [['contracted_at', { ascending: false }], ['id', { ascending: true }]] as const
    expect(queries.map((call) => call.order)).toEqual([expectedOrder, expectedOrder])
  })

  it('getClient pagina projetos além do limite do PostgREST', async () => {
    const client = makeClient()
    const [firstPage, lastPage] = makeTwoPages((index) => makeProjectRow({
      id: `project-${String(index).padStart(4, '0')}`,
    }))
    const projects = [...firstPage, ...lastPage]
    supabase.queue('clients', { data: client, error: null })
    supabase.queue('contracts', { data: [], error: null })
    supabase.queue('projects', { data: firstPage, error: null })
    supabase.queue('projects', { data: lastPage, error: null })
    supabase.queue('client_activities', { data: [], error: null })
    supabase.queue('lead_client_links', { data: [], error: null })

    const detail = await getClient(client.id)

    expect(detail?.projects).toHaveLength(1001)
    expect(detail?.projects.map((project) => project.id)).toEqual(projects.map((project) => project.id))
    const queries = supabase.calls.filter((call) => call.table === 'projects')
    expect(queries.map((call) => call.range)).toEqual([[0, 999], [1000, 1999]])
    const expectedOrder = [['created_at', { ascending: false }], ['id', { ascending: true }]] as const
    expect(queries.map((call) => call.order)).toEqual([expectedOrder, expectedOrder])
  })

  it('getClient pagina atividades do cliente além do limite do PostgREST', async () => {
    const client = makeClient()
    const [firstPage, lastPage] = makeTwoPages((index) => makeClientActivity({
      id: `client-activity-${String(index).padStart(4, '0')}`,
    }))
    const activities = [...firstPage, ...lastPage]
    supabase.queue('clients', { data: client, error: null })
    supabase.queue('contracts', { data: [], error: null })
    supabase.queue('projects', { data: [], error: null })
    supabase.queue('client_activities', { data: firstPage, error: null })
    supabase.queue('client_activities', { data: lastPage, error: null })
    supabase.queue('lead_client_links', { data: [], error: null })

    const detail = await getClient(client.id)

    expect(detail?.activities).toHaveLength(1001)
    expect(detail?.activities.map((activity) => activity.id)).toEqual(activities.map((activity) => activity.id))
    const queries = supabase.calls.filter((call) => call.table === 'client_activities')
    expect(queries.map((call) => call.range)).toEqual([[0, 999], [1000, 1999]])
    const expectedOrder = [['created_at', { ascending: false }], ['id', { ascending: true }]] as const
    expect(queries.map((call) => call.order)).toEqual([expectedOrder, expectedOrder])
  })

  it('getClient pagina vínculos de leads além do limite do PostgREST', async () => {
    const client = makeClient()
    const [firstPage, lastPage] = makeTwoPages((index) => makeLink({
      id: `link-${String(index).padStart(4, '0')}`,
      lead_id: `lead-${index}`,
    }))
    const links = [...firstPage, ...lastPage]
    supabase.queue('clients', { data: client, error: null })
    supabase.queue('contracts', { data: [], error: null })
    supabase.queue('projects', { data: [], error: null })
    supabase.queue('client_activities', { data: [], error: null })
    supabase.queue('lead_client_links', { data: firstPage, error: null })
    supabase.queue('lead_client_links', { data: lastPage, error: null })
    for (const chunk of chunkRows(links)) {
      supabase.queue('leads', {
        data: chunk.map((link) => ({ id: link.lead_id, name: `Lead ${link.lead_id}` })),
        error: null,
      })
    }

    const detail = await getClient(client.id)

    const queries = supabase.calls.filter((call) => call.table === 'lead_client_links')
    expect(queries.map((call) => call.range)).toEqual([[0, 999], [1000, 1999]])
    const expectedOrder = [['converted_at', { ascending: false }], ['id', { ascending: true }]] as const
    expect(queries.map((call) => call.order)).toEqual([expectedOrder, expectedOrder])
    expect(detail?.linkedLeads).toEqual(links.map((link) => ({
      leadId: link.lead_id,
      leadName: `Lead ${link.lead_id}`,
    })))
  })

  it('getClient pagina atividades dos leads e preserva o histórico combinado', async () => {
    const client = makeClient()
    const [firstPage, lastPage] = makeTwoPages((index) => makeLeadActivity({
      id: `lead-activity-${String(index).padStart(4, '0')}`,
      created_at: new Date(Date.UTC(2026, 10, 1, 0, 0, index)).toISOString(),
    }))
    const activities = [...firstPage, ...lastPage]
    supabase.queue('clients', { data: client, error: null })
    supabase.queue('contracts', { data: [], error: null })
    supabase.queue('projects', { data: [], error: null })
    supabase.queue('client_activities', { data: [], error: null })
    supabase.queue('lead_client_links', { data: [makeLink()], error: null })
    supabase.queue('leads', { data: [{ id: 'lead-1', name: 'Lead Um' }], error: null })
    supabase.queue('lead_activities', { data: firstPage, error: null })
    supabase.queue('lead_activities', { data: lastPage, error: null })

    const detail = await getClient(client.id)

    expect(detail?.history).toHaveLength(1001)
    expect(detail?.history.map((entry) => entry.id)).toEqual(
      [...activities].reverse().map((activity) => activity.id),
    )
    expect(detail?.history.every((entry) => entry.source === 'lead' && entry.leadName === 'Lead Um')).toBe(true)
    const queries = supabase.calls.filter((call) => call.table === 'lead_activities')
    expect(queries.map((call) => call.range)).toEqual([[0, 999], [1000, 1999]])
    const expectedOrder = [['created_at', { ascending: false }], ['id', { ascending: true }]] as const
    expect(queries.map((call) => call.order)).toEqual([expectedOrder, expectedOrder])
  })

  it('getClient agrupa nomes e atividades dos leads em consultas in de até 100 IDs', async () => {
    const client = makeClient()
    const leadIds = Array.from({ length: 101 }, (_, index) => `lead-${index}`)
    const links = leadIds.map((leadId, index) => makeLink({
      id: `link-${String(index).padStart(4, '0')}`,
      lead_id: leadId,
    }))
    const firstChunk = leadIds.slice(0, 100)
    const secondChunk = leadIds.slice(100)
    supabase.queue('clients', { data: client, error: null })
    supabase.queue('contracts', { data: [], error: null })
    supabase.queue('projects', { data: [], error: null })
    supabase.queue('client_activities', { data: [], error: null })
    supabase.queue('lead_client_links', { data: links, error: null })
    supabase.queue('leads', {
      data: [...firstChunk].reverse().map((leadId) => ({ id: leadId, name: `Lead ${leadId}` })),
      error: null,
    })
    supabase.queue('leads', {
      data: secondChunk.map((leadId) => ({ id: leadId, name: `Lead ${leadId}` })),
      error: null,
    })
    supabase.queue('lead_activities', {
      data: [makeLeadActivity({ id: 'activity-first', lead_id: firstChunk[0] })],
      error: null,
    })
    supabase.queue('lead_activities', {
      data: [makeLeadActivity({ id: 'activity-second', lead_id: secondChunk[0] })],
      error: null,
    })

    const detail = await getClient(client.id)

    const leadQueries = supabase.calls.filter((call) => call.table === 'leads')
    expect(leadQueries).toHaveLength(2)
    expect(leadQueries.map((call) => call.inFilters)).toEqual([
      [['id', firstChunk]],
      [['id', secondChunk]],
    ])
    expect(leadQueries.every((call) => call.eq.length === 0 && !call.maybeSingle)).toBe(true)
    const activityQueries = supabase.calls.filter((call) => call.table === 'lead_activities')
    expect(activityQueries).toHaveLength(2)
    expect(activityQueries.map((call) => call.inFilters)).toEqual([
      [['lead_id', firstChunk]],
      [['lead_id', secondChunk]],
    ])
    expect(activityQueries.every((call) => call.eq.length === 0)).toBe(true)
    expect(detail?.linkedLeads).toEqual(leadIds.map((leadId) => ({
      leadId,
      leadName: `Lead ${leadId}`,
    })))
    expect(detail?.history.map((entry) => entry.id).sort()).toEqual(['activity-first', 'activity-second'])
    expect(supabase.mutations).toEqual([])
  })

  it('getClient combina eventos do cliente e dos leads sem copiar no banco', async () => {
    const client = makeClient()
    const firstLink = makeLink()
    const secondLink = makeLink({
      id: 'link-2',
      lead_id: 'lead-2',
      converted_at: '2026-11-21T12:00:00Z',
      created_at: '2026-11-21T12:00:00Z',
    })
    supabase.queue('clients', { data: client, error: null })
    supabase.queue('contracts', { data: [], error: null })
    supabase.queue('projects', { data: [], error: null })
    supabase.queue('client_activities', {
      data: [makeClientActivity({ id: 'client-new', created_at: '2026-11-25T12:00:00Z' })],
      error: null,
    })
    supabase.queue('lead_client_links', { data: [firstLink, secondLink], error: null })
    supabase.queue('leads', {
      data: [
        { id: 'lead-1', name: 'Lead Um' },
        { id: 'lead-2', name: 'Lead Dois' },
      ],
      error: null,
    })
    supabase.queue('lead_activities', {
      data: [
        makeLeadActivity({ id: 'lead-old', created_at: '2026-11-24T12:00:00Z' }),
        makeLeadActivity({
          id: 'lead-new',
          lead_id: 'lead-2',
          description: 'Resposta do lead 2',
          created_at: '2026-11-25T13:00:00Z',
        }),
      ],
      error: null,
    })

    const detail = await getClient(client.id)

    const leadQueries = supabase.calls.filter((call) => call.table === 'leads')
    expect(leadQueries).toHaveLength(1)
    expect(leadQueries[0].inFilters).toEqual([['id', ['lead-1', 'lead-2']]])
    expect(leadQueries[0].maybeSingle).toBe(false)
    const activityQueries = supabase.calls.filter((call) => call.table === 'lead_activities')
    expect(activityQueries).toHaveLength(1)
    expect(activityQueries.map((call) => call.eq)).toEqual([[]])
    expect(activityQueries.map((call) => call.inFilters)).toEqual([
      [['lead_id', ['lead-1', 'lead-2']]],
    ])
    expect(activityQueries.every((call) => call.select === '*')).toBe(true)
    expect(activityQueries.every((call) => (
      JSON.stringify(call.order) === JSON.stringify([
        ['created_at', { ascending: false }],
        ['id', { ascending: true }],
      ])
    ))).toBe(true)
    expect(detail?.linkedLeads).toEqual([
      { leadId: 'lead-1', leadName: 'Lead Um' },
      { leadId: 'lead-2', leadName: 'Lead Dois' },
    ])
    expect(detail?.history).toEqual([
      {
        id: 'lead-new', type: 'mensagem', description: 'Resposta do lead 2',
        created_at: '2026-11-25T13:00:00Z', source: 'lead', leadName: 'Lead Dois',
      },
      {
        id: 'client-new', type: 'note', description: 'Nota do cliente',
        created_at: '2026-11-25T12:00:00Z', source: 'client',
      },
      {
        id: 'lead-old', type: 'mensagem', description: 'Mensagem do lead',
        created_at: '2026-11-24T12:00:00Z', source: 'lead', leadName: 'Lead Um',
      },
    ])
    expect(supabase.mutations).toEqual([])
  })

  it('getClient não duplica a conversão registrada no cliente e no lead vinculado', async () => {
    const client = makeClient()
    supabase.queue('clients', { data: client, error: null })
    supabase.queue('contracts', { data: [], error: null })
    supabase.queue('projects', { data: [], error: null })
    supabase.queue('client_activities', {
      data: [makeClientActivity({
        type: 'conversion',
        description: 'Cliente convertido.',
        metadata: { lead_id: 'lead-1' },
        created_at: '2026-11-23T12:00:00Z',
      })],
      error: null,
    })
    supabase.queue('lead_client_links', { data: [makeLink()], error: null })
    supabase.queue('leads', { data: [{ id: 'lead-1', name: 'Lead Um' }], error: null })
    supabase.queue('lead_activities', {
      data: [
        makeLeadActivity({ id: 'conversao-lead', type: 'conversao', description: 'Lead convertido.' }),
        makeLeadActivity({ id: 'mensagem-lead', description: 'Mensagem após a conversão.' }),
      ],
      error: null,
    })

    const detail = await getClient(client.id)

    expect(detail?.history).toEqual([
      {
        id: 'mensagem-lead', type: 'mensagem', description: 'Mensagem após a conversão.',
        created_at: '2026-11-24T12:00:00Z', source: 'lead', leadName: 'Lead Um',
      },
      {
        id: 'client-activity-1', type: 'conversion', description: 'Cliente convertido.',
        created_at: '2026-11-23T12:00:00Z', source: 'client',
      },
    ])
  })

  it('createClient envia creation_key e contrato inicial', async () => {
    const client = makeClient()
    rpc.mockResolvedValue({ data: { client }, error: null })
    const input: CreateClientInput = {
      ...makeClientWrite({ name: ' Empresa A ', responsible_name: ' Ana Responsável ' }),
      creationKey: client.creation_key,
      initialContract: makeInitialContract({ service: ' Site ' }),
    }

    const result = await createClient(input)

    expect(rpc).toHaveBeenCalledWith('create_client', {
      p_payload: {
        name: 'Empresa A',
        responsible_name: 'Ana Responsável',
        phone: null,
        whatsapp: null,
        email: null,
        cnpj: null,
        website: null,
        instagram: null,
        address: null,
        city: null,
        district: null,
        zip_code: null,
        state: null,
        niche: null,
        status: 'active',
        notes: null,
        creation_key: client.creation_key,
        service: 'Site',
        total_value: '1234.56',
        contracted_at: '2026-11-25',
        due_date: null,
        payment_method: 'pix',
        payment_terms: 'À vista',
        contract_notes: null,
      },
    })
    expect(result).toEqual(client)
  })

  it('createClient traduz CLIENT_CNPJ_DUPLICATE', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'CLIENT_CNPJ_DUPLICATE:Empresa Existente' },
    })

    await expect(createClient({
      ...makeClientWrite({ cnpj: '12.345.678/0001-95' }),
      creationKey: '00000000-0000-0000-0000-000000000502',
      initialContract: makeInitialContract(),
    })).rejects.toThrow('Já existe um cliente com este CNPJ: Empresa Existente.')
  })

  it('updateClient envia p_client_id e payload completo', async () => {
    const client = makeClient({ name: 'Empresa Editada' })
    rpc.mockResolvedValue({ data: { client }, error: null })

    const result = await updateClient(client.id, {
      ...makeClientWrite({ name: ' Empresa Editada ' }),
      contractId: 'contract-1',
      initialContract: makeInitialContract({ service: ' Consultoria ' }),
    })

    expect(rpc).toHaveBeenCalledWith('update_client', {
      p_client_id: 'client-1',
      p_payload: {
        name: 'Empresa Editada',
        responsible_name: null,
        phone: null,
        whatsapp: null,
        email: null,
        cnpj: null,
        website: null,
        instagram: null,
        address: null,
        city: null,
        district: null,
        zip_code: null,
        state: null,
        niche: null,
        status: 'active',
        notes: null,
        contract_id: 'contract-1',
        service: 'Consultoria',
        total_value: '1234.56',
        contracted_at: '2026-11-25',
        due_date: null,
        payment_method: 'pix',
        payment_terms: 'À vista',
        contract_notes: null,
      },
    })
    expect(rpc.mock.calls[0][1].p_payload).not.toHaveProperty('creation_key')
    expect(result).toEqual(client)
  })

  it('archiveClient usa a RPC e não chama delete', async () => {
    const client = makeClient({ status: 'inactive', archived_at: '2026-11-25T12:00:00Z' })
    rpc.mockResolvedValue({ data: client, error: null })

    const result = await archiveClient(client.id)

    expect(rpc).toHaveBeenCalledWith('archive_client', { p_client_id: 'client-1' })
    expect(result).toEqual(client)
    expect(supabase.fromCalls).toEqual([])
    expect(supabase.mutations).toEqual([])
  })

  it('findClientDuplicateCandidates usa cnpj_digits quando há CNPJ', async () => {
    const existing = makeClient()
    supabase.queue('clients', { data: [existing], error: null })

    const result = await findClientDuplicateCandidates({
      name: '', city: null, phone: null, whatsapp: null, cnpj: '12.345.678/0001-95',
    })

    expect(result).toEqual([existing])
    expect(supabase.calls[0].or).toBe('cnpj_digits.eq."12345678000195"')
    expect(supabase.calls[0].ilike).toEqual([])
    expect(supabase.calls[0].order).toEqual([['id', { ascending: true }]])
    expect(supabase.calls[0].limit).toBe(100)
  })

  it('findClientDuplicateCandidates encontra WhatsApp canônico quando informado como telefone', async () => {
    const existing = makeClient({
      phone_canonical: null,
      whatsapp_canonical: '5511999999999',
    })
    supabase.queue('clients', { data: [existing], error: null })

    const result = await findClientDuplicateCandidates({
      name: '', city: null, phone: '(11) 99999-9999', whatsapp: null, cnpj: null,
    })

    expect(result).toEqual([existing])
    expect(supabase.calls[0].or).toBe(
      'phone_canonical.eq."5511999999999",whatsapp_canonical.eq."5511999999999"',
    )
  })

  it('findClientDuplicateCandidates encontra telefone canônico quando informado como WhatsApp', async () => {
    const existing = makeClient({
      phone_canonical: '5511999999999',
      whatsapp_canonical: null,
    })
    supabase.queue('clients', { data: [existing], error: null })

    const result = await findClientDuplicateCandidates({
      name: '', city: null, phone: null, whatsapp: '(11) 99999-9999', cnpj: null,
    })

    expect(result).toEqual([existing])
    expect(supabase.calls[0].or).toBe(
      'phone_canonical.eq."5511999999999",whatsapp_canonical.eq."5511999999999"',
    )
  })

  it('findClientDuplicateCandidates não usa OR com nome digitado', async () => {
    const existing = makeClient()
    supabase.queue('clients', { data: [existing], error: null })

    const result = await findClientDuplicateCandidates({
      name: 'empresa a', city: 'são paulo', phone: null, whatsapp: null, cnpj: null,
    })

    expect(result).toEqual([existing])
    expect(supabase.calls).toHaveLength(1)
    expect(supabase.calls[0].or).toBeNull()
    expect(supabase.calls[0].ilike).toEqual([['name', 'empresa a'], ['city', 'são paulo']])
    expect(supabase.calls[0].order).toEqual([['id', { ascending: true }]])
    expect(supabase.calls[0].limit).toBe(100)
  })

  it('getLeadClientLink retorna null quando maybeSingle não encontra', async () => {
    supabase.queue('lead_client_links', { data: null, error: null })

    const result = await getLeadClientLink('missing-lead')

    expect(result).toBeNull()
    expect(supabase.calls[0]).toMatchObject({
      table: 'lead_client_links',
      select: '*',
      eq: [['lead_id', 'missing-lead']],
      maybeSingle: true,
    })
  })

  it('listLeadClientLinks retorna os vínculos ordenados pela conversão mais recente', async () => {
    const links = [
      makeLink({ id: 'link-1', converted_at: '2026-11-25T12:00:00Z' }),
      makeLink({ id: 'link-2', converted_at: '2026-11-24T12:00:00Z' }),
    ]
    supabase.queue('lead_client_links', { data: links, error: null })

    const result = await listLeadClientLinks()

    expect(result).toEqual(links)
    expect(supabase.calls).toHaveLength(1)
    expect(supabase.calls[0]).toMatchObject({
      table: 'lead_client_links',
      select: '*',
      order: [['converted_at', { ascending: false }], ['id', { ascending: true }]],
      range: [0, 999],
      maybeSingle: false,
    })
  })

  it('listLeadClientLinks pagina além do limite do PostgREST até a última página', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => makeLink({ id: `link-${index}` }))
    const lastPage = [makeLink({ id: 'link-1000' })]
    supabase.queue('lead_client_links', { data: firstPage, error: null })
    supabase.queue('lead_client_links', { data: lastPage, error: null })

    const result = await listLeadClientLinks()

    expect(result).toEqual([...firstPage, ...lastPage])
    expect(supabase.calls).toHaveLength(2)
    expect(supabase.calls.map((call) => call.range)).toEqual([[0, 999], [1000, 1999]])
  })

  it('countConvertedLeads usa count exact com head', async () => {
    supabase.queue('lead_client_links', { data: null, error: null, count: 37 })

    const result = await countConvertedLeads()

    expect(result).toBe(37)
    expect(supabase.fromCalls).toEqual(['lead_client_links'])
    expect(supabase.calls).toHaveLength(1)
    expect(supabase.calls[0]).toMatchObject({
      table: 'lead_client_links',
      select: 'id',
      selectOptions: { count: 'exact', head: true },
      maybeSingle: false,
    })
  })
})
