import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireSupabase } from '../lib/db'
import * as activityService from './activityService'
import { listRecentActivities } from './activityService'

vi.mock('../lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db')>()
  return { ...actual, requireSupabase: vi.fn() }
})

interface StoredActivity {
  id: string
  lead_id: string
  owner_id: string
  type: string
  description: string
  user_id: string | null
  created_at: string
  // O que o PostgREST devolve do join `leads(name)`: objeto com nome ou null sem linha visível.
  leads: { name: string } | null
}

type QueryResult = { data: StoredActivity[] | null; error: { message: string } | null }

interface QueryCall {
  table: string
  select: string
  eq: Array<[string, string]>
  order: Array<[string, { ascending: boolean }]>
  limit: number | null
}

class FakeSupabase {
  readonly calls: QueryCall[] = []
  readonly rows: StoredActivity[]
  error: { message: string } | null = null

  constructor(rows: StoredActivity[]) {
    this.rows = rows
  }

  from(table: string): FakeQuery {
    if (table !== 'lead_activities') throw new Error(`Tabela inesperada no fake: ${table}`)
    return new FakeQuery(this, table)
  }
}

class FakeQuery implements PromiseLike<QueryResult> {
  private selectColumns = ''
  private eqCalls: Array<[string, string]> = []
  private orderCalls: Array<[string, { ascending: boolean }]> = []
  private rowLimit: number | null = null
  private readonly client: FakeSupabase
  private readonly table: string

  constructor(client: FakeSupabase, table: string) {
    this.client = client
    this.table = table
  }

  select(columns: string): this {
    this.selectColumns = columns
    return this
  }

  eq(column: string, value: string): this {
    this.eqCalls.push([column, value])
    return this
  }

  order(column: string, options: { ascending: boolean }): this {
    this.orderCalls.push([column, options])
    return this
  }

  limit(count: number): this {
    this.rowLimit = count
    return this
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private execute(): Promise<QueryResult> {
    this.client.calls.push({
      table: this.table,
      select: this.selectColumns,
      eq: [...this.eqCalls],
      order: [...this.orderCalls],
      limit: this.rowLimit,
    })
    if (this.client.error) return Promise.resolve({ data: null, error: this.client.error })
    let rows = [...this.client.rows]
    rows = rows.filter((row) => this.eqCalls.every(([column, value]) => (
      String((row as unknown as Record<string, unknown>)[column]) === value
    )))
    if (this.orderCalls.some(([column, options]) => column === 'created_at' && !options.ascending)) {
      rows.sort((a, b) => b.created_at.localeCompare(a.created_at))
    }
    if (this.rowLimit !== null) rows.splice(this.rowLimit)
    return Promise.resolve({ data: rows, error: null })
  }
}

function stored(overrides: Partial<StoredActivity> = {}): StoredActivity {
  return {
    id: '00000000-0000-0000-0000-000000000401',
    lead_id: '00000000-0000-0000-0000-000000000101',
    owner_id: '00000000-0000-0000-0000-000000000201',
    type: 'mudanca_status',
    description: 'Status alterado para Negociando.',
    user_id: null,
    created_at: '2026-11-25T10:00:00.000Z',
    leads: { name: 'Barbearia do Bairro' },
    ...overrides,
  }
}

let client: FakeSupabase
const UNKNOWN_LEAD_NAME = 'Nome do lead não carregado'

beforeEach(() => {
  vi.clearAllMocks()
  client = new FakeSupabase([])
  vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)
})

describe('listRecentActivities', () => {
  it('busca as atividades mais novas já com o nome do lead no join', async () => {
    client = new FakeSupabase([
      stored({ id: 'a-velha', created_at: '2026-11-20T10:00:00.000Z', description: 'Mais velha' }),
      stored({ id: 'a-nova', created_at: '2026-11-25T10:00:00.000Z', description: 'Mais nova' }),
    ])
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)

    const result = await listRecentActivities(12)

    expect(client.calls).toEqual([
      {
        table: 'lead_activities',
        select: '*, leads(name)',
        eq: [],
        order: [['created_at', { ascending: false }]],
        limit: 12,
      },
    ])
    expect(result.map((row) => row.description)).toEqual(['Mais nova', 'Mais velha'])
    expect(result.map((row) => row.leadName)).toEqual(['Barbearia do Bairro', 'Barbearia do Bairro'])
    // A forma é Activity + leadName: o objeto do join não vaza para a página.
    expect(result[0]).not.toHaveProperty('leads')
    expect(result[0]).toHaveProperty('type', 'mudanca_status')
  })

  it('sem linha de lead visível no join informa que o nome não carregou, sem afirmar remoção', async () => {
    client = new FakeSupabase([
      stored({ id: 'a-1', leads: null }),
      stored({ id: 'a-2', leads: { name: 'Pizzaria Forno a Lenha' } }),
    ])
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)

    const result = await listRecentActivities(5)

    expect(result.map((row) => row.leadName)).toEqual([UNKNOWN_LEAD_NAME, 'Pizzaria Forno a Lenha'])
    expect(result).toHaveLength(2)
  })

  it('nenhuma atividade devolve lista vazia, não null', async () => {
    client = new FakeSupabase([])
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)

    await expect(listRecentActivities(12)).resolves.toEqual([])
  })

  it('erro do banco vem com a mensagem traduzida', async () => {
    client = new FakeSupabase([])
    client.error = { message: 'new row violates row-level security policy' }
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)

    await expect(listRecentActivities(12)).rejects.toThrow(
      'Acesso negado pelas regras de segurança (RLS).',
    )
  })
})

describe('listRecentStatusChanges', () => {
  it('filtra mudanças de status antes de ordenar e limitar as mais recentes', async () => {
    client = new FakeSupabase([
      stored({ id: 'status-velho', created_at: '2026-11-24T10:00:00.000Z', description: 'Mudança velha' }),
      stored({ id: 'observacao-nova', type: 'observacao', created_at: '2026-11-25T12:00:00.000Z', description: 'Observação nova' }),
      stored({ id: 'status-novo', created_at: '2026-11-25T11:00:00.000Z', description: 'Mudança nova' }),
      stored({ id: 'ligacao-antiga', type: 'ligacao', created_at: '2026-11-20T10:00:00.000Z', description: 'Ligação antiga' }),
    ])
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)

    const result = await activityService.listRecentStatusChanges(2)

    expect(client.calls).toEqual([
      {
        table: 'lead_activities',
        select: '*, leads(name)',
        eq: [['type', 'mudanca_status']],
        order: [['created_at', { ascending: false }]],
        limit: 2,
      },
    ])
    expect(result.map((row) => row.description)).toEqual(['Mudança nova', 'Mudança velha'])
    expect(result.map((row) => row.leadName)).toEqual(['Barbearia do Bairro', 'Barbearia do Bairro'])
    expect(result[0]).not.toHaveProperty('leads')
  })

  it('usa o mesmo rótulo neutro quando o nome do lead não vem no join', async () => {
    client = new FakeSupabase([stored({ leads: null })])
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)

    const result = await activityService.listRecentStatusChanges(5)

    expect(result[0].leadName).toBe(UNKNOWN_LEAD_NAME)
  })

  it('nenhuma mudança de status devolve lista vazia, não null', async () => {
    client = new FakeSupabase([stored({ type: 'observacao' })])
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)

    await expect(activityService.listRecentStatusChanges(5)).resolves.toEqual([])
  })

  it('erro do banco vem com a mesma mensagem traduzida das atividades', async () => {
    client = new FakeSupabase([])
    client.error = { message: 'new row violates row-level security policy' }
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)

    await expect(activityService.listRecentStatusChanges(5)).rejects.toThrow(
      'Acesso negado pelas regras de segurança (RLS).',
    )
  })
})
