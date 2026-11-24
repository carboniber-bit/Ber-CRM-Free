import { requireSupabase, throwDbError } from '../lib/db'
import { computeOpportunity } from '../lib/opportunity'
import { localDayBoundary, onlyDigits } from '../lib/format'
import { normalizePhoneForComparison } from '../lib/whatsapp'
import {
  situationStatuses,
  type Lead,
  type LeadFilters,
  type LeadSort,
  type LeadStatus,
  type LeadWrite,
} from '../types/lead'

function normalizeDraft(draft: LeadWrite): LeadWrite {
  const cleaned = { ...draft }
  for (const key of Object.keys(cleaned) as Array<keyof LeadWrite>) {
    const value = cleaned[key]
    if (typeof value === 'string' && value.trim() === '' && key !== 'name') {
      (cleaned as Record<string, unknown>)[key] = null
    }
  }
  cleaned.name = cleaned.name.trim()
  return cleaned
}

function withOpportunity(draft: LeadWrite) {
  const normalized = normalizeDraft(draft)
  const { score, priority, needs, reasons } = computeOpportunity(normalized)
  return { ...normalized, score, priority, needs, score_reasons: reasons }
}

const SORTS: Record<LeadSort, { column: string; ascending: boolean }> = {
  created_desc: { column: 'created_at', ascending: false },
  created_asc: { column: 'created_at', ascending: true },
  score_desc: { column: 'score', ascending: false },
  score_asc: { column: 'score', ascending: true },
}

const DUPLICATE_CANDIDATE_LIMIT = 100

export async function listLeads(
  filters: LeadFilters,
  sort: LeadSort,
  page: number,
  pageSize = 20,
): Promise<{ leads: Lead[]; total: number }> {
  const client = requireSupabase()
  let query = client.from('leads').select('*', { count: 'exact' })

  if (filters.search) query = query.ilike('name', `%${filters.search}%`)
  if (filters.niche) query = query.eq('niche', filters.niche)
  if (filters.city) query = query.ilike('city', filters.city)
  if (filters.district) query = query.ilike('district', filters.district)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.priority) query = query.eq('priority', filters.priority)
  if (filters.presenceField && filters.presenceValue) {
    query = query.eq(filters.presenceField, filters.presenceValue)
  }
  if (filters.createdFrom) query = query.gte('created_at', localDayBoundary(filters.createdFrom))
  if (filters.createdTo) query = query.lte('created_at', localDayBoundary(filters.createdTo, true))
  if (filters.minScore !== undefined) query = query.gte('score', filters.minScore)
  if (filters.maxScore !== undefined) query = query.lte('score', filters.maxScore)
  if (filters.need) query = query.contains('needs', [filters.need])
  if (filters.instagramWithoutSite) query = query.eq('has_instagram', 'yes').eq('has_website', 'no')
  if (filters.noSiteNoMenu) query = query.eq('has_website', 'no').eq('has_digital_menu', 'no')
  if (filters.hasNeeds) query = query.not('needs', 'eq', '{}')
  if (filters.excludeStatuses?.length) query = query.not('status', 'in', `(${filters.excludeStatuses.join(',')})`)
  if (filters.situation) {
    query = query.in('status', situationStatuses(filters.situation))
    if (filters.situation === 'pronto_contato') query = query.gte('score', 40)
  }

  const { column, ascending } = SORTS[sort]
  const from = page * pageSize
  const { data, error, count } = await query
    .order(column, { ascending })
    .order('id', { ascending: true })
    .range(from, from + pageSize - 1)
  throwDbError(error)
  return { leads: (data ?? []) as Lead[], total: count ?? 0 }
}

export async function getLead(id: string): Promise<Lead> {
  const client = requireSupabase()
  const { data, error } = await client.from('leads').select('*').eq('id', id).single()
  throwDbError(error)
  return data as Lead
}

export async function createLead(draft: LeadWrite): Promise<Lead> {
  const client = requireSupabase()
  const { data, error } = await client.from('leads').insert(withOpportunity(draft)).select().single()
  throwDbError(error)
  return data as Lead
}

export async function updateLead(id: string, draft: LeadWrite): Promise<Lead> {
  const client = requireSupabase()
  const payload: Partial<LeadWrite> = withOpportunity(draft)
  // A alteração de status passa pelo fluxo confirmado da ficha.
  delete payload.status
  const { data, error } = await client
    .from('leads')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  throwDbError(error)
  return data as Lead
}

export async function deleteLead(id: string): Promise<void> {
  const client = requireSupabase()
  const { data, error } = await client.from('leads').delete().eq('id', id).select('id').maybeSingle()
  throwDbError(error)
  if (!data) {
    throw new Error('Não foi possível excluir o lead: registro não encontrado ou acesso negado.')
  }
}

export async function setLeadStatus(id: string, status: LeadStatus): Promise<Lead> {
  const client = requireSupabase()
  const { data, error } = await client.from('leads').update({ status }).eq('id', id).select().single()
  throwDbError(error)
  return data as Lead
}

export async function findDuplicateCandidates(
  input: { phone: string | null; whatsapp: string | null; cnpj: string | null; name: string; city: string | null },
  excludeId?: string,
): Promise<Lead[]> {
  const client = requireSupabase()
  const phone = normalizePhoneForComparison(input.phone ?? '')
  const whatsapp = normalizePhoneForComparison(input.whatsapp ?? '')
  const cnpj = onlyDigits(input.cnpj ?? '') || null
  const name = input.name.trim().toLowerCase()
  const city = (input.city ?? '').trim().toLowerCase()
  const identifierFilters = new Set<string>()

  const addIdentifierFilter = (column: string, value: string | null) => {
    if (value) identifierFilters.add(`${column}.eq.${JSON.stringify(value)}`)
  }

  addIdentifierFilter('phone_canonical', phone)
  addIdentifierFilter('whatsapp_canonical', whatsapp)
  addIdentifierFilter('cnpj_digits', cnpj)

  const candidates = new Map<string, Lead>()
  const mergeCandidates = (leads: Lead[]) => {
    for (const lead of leads) {
      if (!excludeId || lead.id !== excludeId) candidates.set(lead.id, lead)
    }
  }

  if (identifierFilters.size > 0) {
    const { data, error } = await client
      .from('leads')
      .select('*')
      .or([...identifierFilters].join(','))
      .order('id', { ascending: true })
      .limit(DUPLICATE_CANDIDATE_LIMIT)
    throwDbError(error)
    mergeCandidates((data ?? []) as Lead[])
  }

  if (name && city) {
    const { data, error } = await client
      .from('leads')
      .select('*')
      .ilike('name', name.replace(/[\\%_]/g, '\\$&'))
      .ilike('city', city.replace(/[\\%_]/g, '\\$&'))
      .order('id', { ascending: true })
      .limit(DUPLICATE_CANDIDATE_LIMIT)
    throwDbError(error)
    mergeCandidates((data ?? []) as Lead[])
  }

  return [...candidates.values()].filter((lead) => {
    if (phone && normalizePhoneForComparison(lead.phone ?? '') === phone) return true
    if (whatsapp && normalizePhoneForComparison(lead.whatsapp ?? '') === whatsapp) return true
    if (cnpj && onlyDigits(lead.cnpj ?? '') === cnpj) return true
    return name !== '' && city !== ''
      && lead.name.trim().toLowerCase() === name
      && (lead.city ?? '').trim().toLowerCase() === city
  })
}

export async function listRecentLeads(limit: number): Promise<Lead[]> {
  const client = requireSupabase()
  const { data, error } = await client.from('leads').select('*').order('created_at', { ascending: false }).limit(limit)
  throwDbError(error)
  return (data ?? []) as Lead[]
}
