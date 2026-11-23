import { requireSupabase, throwDbError } from '../lib/db'
import { computeOpportunity } from '../lib/opportunity'
import { localDayBoundary, onlyDigits } from '../lib/format'
import {
  situationStatuses,
  STATUS_LABELS,
  type Lead,
  type LeadFilters,
  type LeadSort,
  type LeadStatus,
  type LeadWrite,
} from '../types/lead'
import { addActivity } from './activityService'

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
  const { data, error } = await client
    .from('leads')
    .update(withOpportunity(draft))
    .eq('id', id)
    .select()
    .single()
  throwDbError(error)
  return data as Lead
}

export async function deleteLead(id: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('leads').delete().eq('id', id)
  throwDbError(error)
}

export async function setLeadStatus(id: string, status: LeadStatus): Promise<Lead> {
  const client = requireSupabase()
  const current = await getLead(id)
  if (current.status === status) return current
  const { data, error } = await client.from('leads').update({ status }).eq('id', id).select().single()
  throwDbError(error)
  await addActivity(id, 'mudanca_status', `De "${STATUS_LABELS[current.status]}" para "${STATUS_LABELS[status]}".`)
  return data as Lead
}

export async function findDuplicateCandidates(
  input: { phone: string | null; whatsapp: string | null; cnpj: string | null; name: string; city: string | null },
  excludeId?: string,
): Promise<Lead[]> {
  const client = requireSupabase()
  const { data, error } = await client.from('leads').select('*')
  throwDbError(error)
  const leads = (data ?? []) as Lead[]
  const phone = onlyDigits(input.phone ?? '')
  const whatsapp = onlyDigits(input.whatsapp ?? '')
  const cnpj = onlyDigits(input.cnpj ?? '')
  const name = input.name.trim().toLowerCase()
  const city = (input.city ?? '').trim().toLowerCase()

  return leads.filter((lead) => {
    if (excludeId && lead.id === excludeId) return false
    if (phone && onlyDigits(lead.phone ?? '') === phone) return true
    if (whatsapp && onlyDigits(lead.whatsapp ?? '') === whatsapp) return true
    if (cnpj && onlyDigits(lead.cnpj ?? '') === cnpj) return true
    if (name && lead.name.trim().toLowerCase() === name && city && (lead.city ?? '').trim().toLowerCase() === city) return true
    return false
  })
}

export async function listRecentLeads(limit: number): Promise<Lead[]> {
  const client = requireSupabase()
  const { data, error } = await client.from('leads').select('*').order('created_at', { ascending: false }).limit(limit)
  throwDbError(error)
  return (data ?? []) as Lead[]
}
