import { requireSupabase, throwDbError } from '../lib/db'
import { fromMoneyDecimal, toMoneyDecimal } from '../lib/money'
import { normalizePhoneForComparison } from '../lib/whatsapp'
import { onlyDigits } from '../lib/format'
import type { Activity } from '../types/activity'
import type { Contract } from '../types/contract'
import type {
  Client, ClientActivity, ClientDetail, ClientHistoryEntry, ClientWrite,
  ConversionInput, ConversionResult, CreateClientInput, InitialContractInput,
  LeadClientLink, UpdateClientInput,
} from '../types/client'
import type { Project } from '../types/project'

export interface ClientFilters {
  search: string
  status: string
  city: string
}

export type ClientSort = 'name_asc' | 'name_desc' | 'created_desc' | 'updated_desc'

export interface ClientDuplicateInput {
  name: string
  city: string | null
  phone: string | null
  whatsapp: string | null
  cnpj: string | null
}

interface ContractRow extends Omit<Contract, 'total_value_cents'> {
  total_value: string | number
}

interface ProjectRow extends Omit<Project, 'contracted_value_cents'> {
  contracted_value: string | number
}

function toContract(row: ContractRow): Contract {
  const { total_value, ...contract } = row
  return { ...contract, total_value_cents: fromMoneyDecimal(total_value) }
}

function toProject(row: ProjectRow): Project {
  const { contracted_value, ...project } = row
  return { ...project, contracted_value_cents: fromMoneyDecimal(contracted_value) }
}

function clientPayload(input: ClientWrite) {
  return {
    name: input.name.trim(),
    responsible_name: input.responsible_name?.trim() || null,
    phone: input.phone?.trim() || null,
    whatsapp: input.whatsapp?.trim() || null,
    email: input.email?.trim() || null,
    cnpj: input.cnpj?.trim() || null,
    website: input.website?.trim() || null,
    instagram: input.instagram?.trim() || null,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    district: input.district?.trim() || null,
    zip_code: input.zip_code?.trim() || null,
    state: input.state?.trim() || null,
    niche: input.niche?.trim() || null,
    status: input.status,
    notes: input.notes?.trim() || null,
  }
}

function contractPayload(input: InitialContractInput) {
  return {
    service: input.service.trim(),
    total_value: toMoneyDecimal(input.totalValueCents),
    contracted_at: input.contractedAt,
    due_date: input.dueDate,
    payment_method: input.paymentMethod.trim() || null,
    payment_terms: input.paymentTerms.trim() || null,
    contract_notes: input.notes.trim() || null,
  }
}

function parseClient(data: unknown): Client {
  const payload = Array.isArray(data) ? data[0] : data
  const candidate = payload as { client?: unknown } | null
  const client = (candidate?.client ?? payload) as Client | undefined
  if (!client?.id) throw new Error('Não foi possível salvar o cliente.')
  return client
}

function parseConversion(data: unknown): ConversionResult {
  const payload = Array.isArray(data) ? data[0] : data
  if (!payload || typeof payload !== 'object') throw new Error('Não foi possível converter o lead.')
  const result = payload as ConversionResult
  if (!result.client_id || !result.link_id || !result.contract_id) {
    throw new Error('Não foi possível converter o lead.')
  }
  return result
}

export async function listClients(
  filters: ClientFilters,
  sort: ClientSort,
  page: number,
  pageSize = 20,
): Promise<{ clients: Client[]; total: number }> {
  const client = requireSupabase()
  let query = client.from('clients').select('*', { count: 'exact' })
  if (filters.search.trim()) {
    const search = filters.search.trim().replace(/[%_]/g, '')
    const digits = search.replace(/\D/g, '')
    const textFilters = ['name', 'responsible_name', 'email']
      .map((column) => `${column}.ilike.${JSON.stringify(`%${search}%`)}`)
    query = query.or(digits.length === 14
      ? [`cnpj_digits.eq.${JSON.stringify(digits)}`, ...textFilters].join(',')
      : textFilters.join(','))
  }
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.city.trim()) query = query.ilike('city', `%${filters.city.trim()}%`)
  const sortColumn = sort.startsWith('name') ? 'name' : sort.startsWith('updated') ? 'updated_at' : 'created_at'
  const ascending = sort.endsWith('_asc')
  query = query.order(sortColumn, { ascending }).order('id', { ascending })
  const from = page * pageSize
  const { data, error, count } = await query.range(from, from + pageSize - 1)
  throwDbError(error)
  return { clients: (data ?? []) as Client[], total: count ?? 0 }
}

export async function getClient(id: string): Promise<ClientDetail | null> {
  const client = requireSupabase()
  const { data, error } = await client.from('clients').select('*').eq('id', id).maybeSingle()
  throwDbError(error)
  if (!data) return null
  const record = data as Client

  const [contractsResult, projectsResult, activitiesResult, linksResult] = await Promise.all([
    client.from('contracts').select('*').eq('client_id', id).order('contracted_at', { ascending: false }),
    client.from('projects').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    client.from('client_activities').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    client.from('lead_client_links').select('*').eq('client_id', id).order('converted_at', { ascending: false }),
  ])
  throwDbError(contractsResult.error)
  throwDbError(projectsResult.error)
  throwDbError(activitiesResult.error)
  throwDbError(linksResult.error)

  const contracts = (contractsResult.data ?? []) as ContractRow[]
  const projects = (projectsResult.data ?? []) as ProjectRow[]
  const activities = (activitiesResult.data ?? []) as ClientActivity[]
  const links = (linksResult.data ?? []) as LeadClientLink[]
  const linkedLeads: ClientDetail['linkedLeads'] = []
  const leadActivities: Activity[] = []

  for (const link of links) {
    const leadResult = await client.from('leads').select('id,name').eq('id', link.lead_id).maybeSingle()
    throwDbError(leadResult.error)
    if (!leadResult.data) continue
    linkedLeads.push({ leadId: link.lead_id, leadName: leadResult.data.name })
    const activityResult = await client.from('lead_activities').select('*').eq('lead_id', link.lead_id).order('created_at', { ascending: false })
    throwDbError(activityResult.error)
    leadActivities.push(...((activityResult.data ?? []) as Activity[]))
  }

  const leadNames = new Map(linkedLeads.map((lead) => [lead.leadId, lead.leadName]))
  const conversionLeadIds = new Set(activities
    .filter((activity) => activity.type === 'conversion' && typeof activity.metadata.lead_id === 'string')
    .map((activity) => activity.metadata.lead_id as string))
  const uniqueLeadActivities = leadActivities.filter((activity) => (
    activity.type !== 'conversao' || !conversionLeadIds.has(activity.lead_id)
  ))
  const history: ClientHistoryEntry[] = [
    ...activities.map((activity) => ({
      id: activity.id, type: activity.type, description: activity.description,
      created_at: activity.created_at, source: 'client' as const,
    })),
    ...uniqueLeadActivities.map((activity) => ({
      id: activity.id, type: activity.type, description: activity.description,
      created_at: activity.created_at, source: 'lead' as const,
      leadName: leadNames.get(activity.lead_id),
    })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at))

  return {
    client: record,
    contracts: contracts.map(toContract),
    projects: projects.map(toProject),
    activities,
    linkedLeads,
    history,
  }
}

export async function createClient(input: CreateClientInput): Promise<Client> {
  const { data, error } = await requireSupabase().rpc('create_client', {
    p_payload: { ...clientPayload(input), creation_key: input.creationKey, ...contractPayload(input.initialContract) },
  })
  if (error?.message.includes('CLIENT_CNPJ_DUPLICATE:')) {
    throw new Error(`Já existe um cliente com este CNPJ: ${error.message.split(':')[1]}.`)
  }
  throwDbError(error)
  return parseClient(data)
}

export async function updateClient(id: string, input: UpdateClientInput): Promise<Client> {
  const { data, error } = await requireSupabase().rpc('update_client', {
    p_client_id: id,
    p_payload: { ...clientPayload(input), contract_id: input.contractId, ...contractPayload(input.initialContract) },
  })
  if (error?.message.includes('CLIENT_CNPJ_DUPLICATE:')) {
    throw new Error(`Já existe um cliente com este CNPJ: ${error.message.split(':')[1]}.`)
  }
  throwDbError(error)
  return parseClient(data)
}

export async function archiveClient(id: string): Promise<Client> {
  const { data, error } = await requireSupabase().rpc('archive_client', { p_client_id: id })
  throwDbError(error)
  return parseClient(data)
}

export async function findClientDuplicateCandidates(
  input: ClientDuplicateInput,
  excludeId?: string,
): Promise<Client[]> {
  const client = requireSupabase()
  const candidates = new Map<string, Client>()
  const cnpj = onlyDigits(input.cnpj ?? '') || null
  const phone = normalizePhoneForComparison(input.phone ?? '')
  const whatsapp = normalizePhoneForComparison(input.whatsapp ?? '')
  const identifierFilters = new Set<string>()
  const addIdentifierFilter = (column: string, value: string | null) => {
    if (value) identifierFilters.add(`${column}.eq.${JSON.stringify(value)}`)
  }
  addIdentifierFilter('cnpj_digits', cnpj)
  addIdentifierFilter('phone_canonical', phone)
  addIdentifierFilter('whatsapp_canonical', whatsapp)

  const merge = (rows: Client[]) => {
    for (const row of rows) if (row.id !== excludeId) candidates.set(row.id, row)
  }
  if (identifierFilters.size > 0) {
    const { data, error } = await client.from('clients').select('*')
      .or([...identifierFilters].join(',')).order('id', { ascending: true }).limit(100)
    throwDbError(error)
    merge((data ?? []) as Client[])
  }

  const name = (input.name ?? '').trim().toLowerCase()
  const city = (input.city ?? '').trim().toLowerCase()
  if (name && city) {
    const { data, error } = await client.from('clients').select('*')
      .ilike('name', name.replace(/[\\%_]/g, '\\$&'))
      .ilike('city', city.replace(/[\\%_]/g, '\\$&'))
      .order('id', { ascending: true }).limit(100)
    throwDbError(error)
    merge((data ?? []) as Client[])
  }

  return [...candidates.values()].filter((row) => {
    if (cnpj && onlyDigits(row.cnpj ?? '') === cnpj) return true
    if (phone && [row.phone_canonical, row.whatsapp_canonical].includes(phone)) return true
    if (whatsapp && [row.phone_canonical, row.whatsapp_canonical].includes(whatsapp)) return true
    return name !== '' && city !== ''
      && row.name.trim().toLowerCase() === name
      && (row.city ?? '').trim().toLowerCase() === city
  })
}

export async function getLeadClientLink(leadId: string): Promise<LeadClientLink | null> {
  const { data, error } = await requireSupabase().from('lead_client_links').select('*').eq('lead_id', leadId).maybeSingle()
  throwDbError(error)
  return (data as LeadClientLink | null) ?? null
}

export async function listLeadClientLinks(): Promise<LeadClientLink[]> {
  const links: LeadClientLink[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await requireSupabase().from('lead_client_links').select('*')
      .order('converted_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    throwDbError(error)
    const page = (data ?? []) as LeadClientLink[]
    links.push(...page)
    if (page.length < pageSize) break
  }
  return links
}

export async function countConvertedLeads(): Promise<number> {
  const { count, error } = await requireSupabase().from('lead_client_links').select('id', { count: 'exact', head: true })
  throwDbError(error)
  return count ?? 0
}

export async function convertLeadToClient(leadId: string, input: ConversionInput): Promise<ConversionResult> {
  const { data, error } = await requireSupabase().rpc('convert_lead_to_client', {
    p_lead_id: leadId,
    p_service: input.service.trim(),
    p_contracted_value: toMoneyDecimal(input.contractedValueCents),
    p_contracted_at: input.contractedAt,
    p_payment_method: input.paymentMethod.trim() || null,
    p_payment_terms: input.paymentTerms.trim() || null,
    p_notes: input.notes.trim() || null,
    p_project_name: input.project?.name.trim() || null,
    p_project_start_date: input.project?.startDate || null,
    p_project_due_date: input.project?.dueDate || null,
  })
  throwDbError(error)
  return parseConversion(data)
}
