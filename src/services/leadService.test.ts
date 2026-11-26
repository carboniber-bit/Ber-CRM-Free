import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireSupabase } from '../lib/db'
import { emptyLeadDraft, NICHES, NICHE_LABELS, type Lead } from '../types/lead'
import { findDuplicateCandidates, listLeads, updateLead } from './leadService'

vi.mock('../lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db')>()
  return { ...actual, requireSupabase: vi.fn() }
})

type StoredLead = Lead & {
  phone_canonical: string | null
  whatsapp_canonical: string | null
  cnpj_digits: string | null
}

function matchesIlike(value: string, pattern: string): boolean {
  const regex = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/%/g, '.*')
    .replace(/_/g, '.')
  return new RegExp(`^${regex}$`, 'i').test(value)
}

type QueryResult = { data: StoredLead[] | null; count: number | null; error: { message: string } | null }

interface QueryCall {
  select: string
  or: string | null
  ilike: Array<[string, string]>
  order: Array<[string, { ascending: boolean }]>
  limit: number | null
  range: [number, number] | null
}

class FakeSupabase {
  readonly calls: QueryCall[] = []
  readonly leads: StoredLead[]
  readonly updates: Array<Record<string, unknown>> = []
  error: { message: string } | null = null

  constructor(leads: StoredLead[]) {
    this.leads = leads
  }

  from(table: string): FakeQuery {
    if (table !== 'leads') throw new Error(`Tabela inesperada no fake: ${table}`)
    return new FakeQuery(this)
  }
}

class FakeQuery implements PromiseLike<QueryResult> {
  private selectColumns = ''
  private orFilter: string | null = null
  private ilikeFilters: Array<[string, string]> = []
  private eqFilters: Array<[string, unknown]> = []
  private orderCalls: Array<[string, { ascending: boolean }]> = []
  private rowLimit: number | null = null
  private rowRange: [number, number] | null = null
  private exactCount = false
  private readonly client: FakeSupabase

  constructor(client: FakeSupabase) {
    this.client = client
  }

  select(columns: string, options?: { count?: string }): this {
    this.selectColumns = columns
    this.exactCount = options?.count === 'exact'
    return this
  }

  update(values: Record<string, unknown>): this {
    this.client.updates.push(values)
    return this
  }

  eq(column: string, value: unknown): this {
    this.eqFilters.push([column, value])
    return this
  }

  single(): Promise<QueryResult> {
    if (this.client.error) return Promise.resolve({ data: null, count: null, error: this.client.error })
    return Promise.resolve({ data: this.client.leads.slice(0, 1), count: null, error: null })
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

  limit(count: number): this {
    this.rowLimit = count
    return this
  }

  range(from: number, to: number): this {
    this.rowRange = [from, to]
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
      select: this.selectColumns,
      or: this.orFilter,
      ilike: [...this.ilikeFilters],
      order: [...this.orderCalls],
      limit: this.rowLimit,
      range: this.rowRange,
    })

    if (this.client.error) return Promise.resolve({ data: null, count: null, error: this.client.error })
    if (!this.orFilter && this.ilikeFilters.length === 0 && this.rowRange === null) {
      return Promise.resolve({ data: [], count: this.exactCount ? 0 : null, error: null })
    }

    let rows = [...this.client.leads]
    rows = rows.filter((row) => this.eqFilters.every(([column, value]) => (
      (row as unknown as Record<string, unknown>)[column] === value
    )))
    if (this.orFilter) {
      const filters = this.orFilter.split(',').map((part) => {
        const match = /^(\w+)\.(eq|ilike)\.(.*)$/.exec(part)
        if (!match) throw new Error(`Filtro OR não suportado pelo fake: ${part}`)
        const [, column, operator, rawValue] = match
        const value = operator === 'eq' ? JSON.parse(rawValue) as string : rawValue
        return { column, operator, value }
      })
      rows = rows.filter((row) => filters.some(({ column, operator, value }) => {
        const stored = String((row as unknown as Record<string, unknown>)[column] ?? '')
        return operator === 'eq' ? stored === value : matchesIlike(stored, value)
      }))
    }
    rows = rows.filter((row) => this.ilikeFilters.every(([column, pattern]) => (
      String((row as unknown as Record<string, unknown>)[column] ?? '').toLowerCase()
      === pattern.toLowerCase()
    )))
    if (this.orderCalls.some(([column, options]) => column === 'id' && options.ascending)) {
      rows.sort((a, b) => a.id.localeCompare(b.id))
    }
    const count = this.exactCount ? rows.length : null
    if (this.rowLimit !== null) rows = rows.slice(0, this.rowLimit)
    if (this.rowRange) rows = rows.slice(this.rowRange[0], this.rowRange[1] + 1)
    return Promise.resolve({ data: rows, count, error: null })
  }
}

let client: FakeSupabase

beforeEach(() => {
  vi.clearAllMocks()
  client = new FakeSupabase([])
  vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)
})

function makeStoredLead(overrides: Partial<StoredLead>): StoredLead {
  return {
    ...emptyLeadDraft(),
    id: '00000000-0000-0000-0000-000000000101',
    owner_id: '00000000-0000-0000-0000-000000000201',
    score: 0,
    priority: 'baixa',
    needs: [],
    score_reasons: [],
    created_at: '2026-11-22T00:00:00Z',
    updated_at: '2026-11-22T00:00:00Z',
    name: 'Fixture de duplicidade',
    phone: null,
    whatsapp: null,
    cnpj: null,
    phone_canonical: null,
    whatsapp_canonical: null,
    cnpj_digits: null,
    ...overrides,
  } as StoredLead
}

const noIdentifiers = {
  phone: null,
  whatsapp: null,
  cnpj: null,
  name: '',
  city: null,
}

describe('listLeads', () => {
  it.each(NICHES)('encontra o nicho canônico %s sem trazer os demais', async (niche) => {
    const matching = makeStoredLead({ id: `match-${niche}`, niche })
    const other = makeStoredLead({ id: `other-${niche}`, niche: null })
    client = new FakeSupabase([matching, other])
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)

    const result = await listLeads({ niche }, 'created_desc', 0, 20)

    expect(result.leads.map((lead) => lead.id)).toEqual([matching.id])
    expect(result.total).toBe(1)
  })

  it.each(NICHES)('encontra o rótulo pt-BR de %s com variações de caixa e acento', async (niche) => {
    const label = NICHE_LABELS[niche]
    const stored = makeStoredLead({ id: `label-${niche}`, niche: label.toUpperCase() })
    client = new FakeSupabase([stored])
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)

    const result = await listLeads({ niche }, 'created_desc', 0, 20)

    expect(result.leads.map((lead) => lead.id)).toEqual([stored.id])
  })

  it.each([
    ['manicure', 'manicure / nail designer'],
    ['manicure', 'manicure/nail designer'],
    ['manicure', 'manicure - nail designer'],
    ['nail_designer', 'manicure / nail designer'],
    ['salao_beleza', 'salao de beleza'],
    ['salao_beleza', 'Salão de Beleza'],
    ['salao_beleza', 'estúdio de beleza'],
    ['salao_beleza', 'Estúdio de Beleza'],
    ['clinica_estetica', 'Clínica de Estética'],
    ['clinica_estetica', 'Clínica estetica'],
    ['clinica_estetica', 'Clinica estética'],
    ['comercio', 'Pequeno Comércio'],
    ['comercio', 'Comércio'],
  ])('encontra %s quando o texto armazenado é %s', async (niche, storedNiche) => {
    const stored = makeStoredLead({ id: `combined-${niche}`, niche: storedNiche })
    client = new FakeSupabase([stored])
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)

    const result = await listLeads({ niche }, 'created_desc', 0, 20)

    expect(result.leads.map((lead) => lead.id)).toEqual([stored.id])
  })

  it.each(NICHES)('isola o nicho %s dos demais valores canônicos', async (niche) => {
    const stored = NICHES.map((value) => makeStoredLead({ id: `matrix-${value}`, niche: value }))
    client = new FakeSupabase(stored)
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)

    const result = await listLeads({ niche }, 'created_desc', 0, 20)

    expect(result.leads.map((lead) => lead.id)).toEqual([`matrix-${niche}`])
    expect(result.total).toBe(1)
  })

  it.each(NICHES)('mantém o filtro de %s compacto para o PostgREST', async (niche) => {
    await listLeads({ niche }, 'created_desc', 0, 20)

    expect(client.calls[0].or?.length ?? 0).toBeLessThan(7000)
  })

  it.each([
    ['manicure', 'manicureiro'],
    ['barbearia', 'barbeariaia'],
    ['comercio', 'comercioexterior'],
    ['nail_designer', 'nailprodesigner'],
    ['nail_designer', 'nail sem designer'],
    ['salao_beleza', 'salaoXYZdeXYZbeleza'],
  ])('não confunde o filtro de %s com %s', async (niche, storedNiche) => {
    const stored = makeStoredLead({ id: 'substring', niche: storedNiche })
    client = new FakeSupabase([stored])
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)

    const result = await listLeads({ niche }, 'created_desc', 0, 20)

    expect(result.leads).toEqual([])
    expect(result.total).toBe(0)
  })

  it('não confunde o filtro de manicure com nail designer puro', async () => {
    const nailDesigner = makeStoredLead({ id: 'nail-only', niche: 'nail designer' })
    client = new FakeSupabase([nailDesigner])
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)

    const result = await listLeads({ niche: 'manicure' }, 'created_desc', 0, 20)

    expect(result.leads).toEqual([])
    expect(result.total).toBe(0)
  })
})

describe('updateLead', () => {
  it('não envia status ao salvar os demais campos do formulário', async () => {
    const stored = makeStoredLead({ status: 'negociando' })
    client = new FakeSupabase([stored])
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)

    await updateLead(stored.id, { ...emptyLeadDraft(), name: stored.name, status: 'novo' })

    expect(client.updates).toHaveLength(1)
    expect(client.updates[0]).not.toHaveProperty('status')
    expect(client.updates[0]).toHaveProperty('score')
  })

  it('persiste o link exato do Maps ao editar um lead', async () => {
    const stored = makeStoredLead({})
    client = new FakeSupabase([stored])
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)
    const mapsUrl = 'https://maps.app.goo.gl/exemplo'

    await updateLead(stored.id, { ...emptyLeadDraft(), name: stored.name, maps_url: mapsUrl })

    expect(client.updates[0]).toHaveProperty('maps_url', mapsUrl)
  })
})

describe('findDuplicateCandidates', () => {
  it.each([
    ['(11) 98888-7777', '+55 (11) 98888-7777'],
    ['+55 (11) 98888-7777', '+55 11 98888-7777'],
  ])('encontra telefone bruto %s mesmo com a grafia armazenada %s', async (phone, storedPhone) => {
    const stored = makeStoredLead({ phone: storedPhone, phone_canonical: '5511988887777' })
    client = new FakeSupabase([stored])
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)

    const result = await findDuplicateCandidates({ ...noIdentifiers, phone })

    expect(result.map((lead) => lead.id)).toEqual([stored.id])
  })

  it('encontra WhatsApp com grafia bruta distinta', async () => {
    const stored = makeStoredLead({
      whatsapp: '+55 21 99999-8888',
      whatsapp_canonical: '5521999998888',
    })
    client = new FakeSupabase([stored])
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)

    const result = await findDuplicateCandidates({ ...noIdentifiers, whatsapp: '(21) 99999-8888' })

    expect(result.map((lead) => lead.id)).toEqual([stored.id])
  })

  it('encontra CNPJ com pontuação bruta distinta', async () => {
    const stored = makeStoredLead({ cnpj: '12 345 678 0001 90', cnpj_digits: '12345678000190' })
    client = new FakeSupabase([stored])
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)

    const result = await findDuplicateCandidates({ ...noIdentifiers, cnpj: '12.345.678/0001-90' })

    expect(result.map((lead) => lead.id)).toEqual([stored.id])
  })

  it('continua excluindo excludeId', async () => {
    const stored = makeStoredLead({ phone: '+55 (11) 98888-7777', phone_canonical: '5511988887777' })
    client = new FakeSupabase([stored])
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)

    const result = await findDuplicateCandidates(
      { ...noIdentifiers, phone: '(11) 98888-7777' },
      stored.id,
    )

    expect(result).toEqual([])
  })

  it('consulta colunas canônicas com limite de 100 e sem scan irrestrito', async () => {
    const stored = makeStoredLead({
      phone: '+55 (11) 98888-7777',
      phone_canonical: '5511988887777',
      whatsapp: '+55 21 99999-8888',
      whatsapp_canonical: '5521999998888',
      cnpj: '12.345.678/0001-90',
      cnpj_digits: '12345678000190',
    })
    client = new FakeSupabase([stored])
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)

    const result = await findDuplicateCandidates({
      phone: '(11) 98888-7777',
      whatsapp: '(21) 99999-8888',
      cnpj: '12345678000190',
      name: '',
      city: null,
    })

    expect(result.map((lead) => lead.id)).toEqual([stored.id])
    expect(client.calls).toHaveLength(1)
    expect(client.calls[0].select).toBe('*')
    expect(client.calls[0].or).toBe(
      'phone_canonical.eq."5511988887777",whatsapp_canonical.eq."5521999998888",cnpj_digits.eq."12345678000190"',
    )
    expect(client.calls[0].ilike).toEqual([])
    expect(client.calls[0].order).toEqual([['id', { ascending: true }]])
    expect(client.calls[0].limit).toBe(100)
  })

  it('mantém a consulta separada de nome e cidade', async () => {
    const stored = makeStoredLead({ name: 'Fixture Nome', city: 'São Paulo' })
    client = new FakeSupabase([stored])
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)

    const result = await findDuplicateCandidates({ ...noIdentifiers, name: 'fixture nome', city: 'são paulo' })

    expect(result.map((lead) => lead.id)).toEqual([stored.id])
    expect(client.calls).toHaveLength(1)
    expect(client.calls[0].or).toBeNull()
    expect(client.calls[0].ilike).toEqual([['name', 'fixture nome'], ['city', 'são paulo']])
    expect(client.calls[0].limit).toBe(100)
  })

  it('deduplica por ID quando o mesmo lead vem das duas consultas', async () => {
    const stored = makeStoredLead({
      name: 'Fixture Nome',
      city: 'São Paulo',
      phone: '+55 (11) 98888-7777',
      phone_canonical: '5511988887777',
    })
    client = new FakeSupabase([stored])
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)

    const result = await findDuplicateCandidates({
      phone: '(11) 98888-7777',
      whatsapp: null,
      cnpj: null,
      name: 'fixture nome',
      city: 'são paulo',
    })

    expect(result.map((lead) => lead.id)).toEqual([stored.id])
    expect(client.calls).toHaveLength(2)
  })

  it('preserva o filtro canônico final em memória', async () => {
    const stored = makeStoredLead({
      phone: '+55 (11) 97777-6666',
      phone_canonical: '5511988887777',
    })
    client = new FakeSupabase([stored])
    vi.mocked(requireSupabase).mockReturnValue(client as unknown as SupabaseClient)

    const result = await findDuplicateCandidates({ ...noIdentifiers, phone: '(11) 98888-7777' })

    expect(result).toEqual([])
  })

  it('preserva o tratamento de erro da consulta', async () => {
    client.error = { message: 'permission denied' }

    await expect(findDuplicateCandidates({ ...noIdentifiers, phone: '(11) 98888-7777' }))
      .rejects.toThrow('Sem permissão no banco. Verifique se a migration foi executada (grants/RLS).')
  })
})
