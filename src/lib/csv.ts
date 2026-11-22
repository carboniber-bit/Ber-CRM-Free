import Papa from 'papaparse'
import {
  emptyLeadDraft,
  LEAD_STATUSES,
  NICHE_LABELS,
  NICHES,
  STATUS_LABELS,
  type Lead,
  type LeadStatus,
  type LeadWrite,
  type Presence,
} from '../types/lead'

export const CSV_HEADERS = [
  'nome', 'responsavel', 'nicho', 'telefone', 'whatsapp', 'email', 'cnpj',
  'instagram', 'facebook', 'site', 'cardapio_url', 'catalogo_url',
  'pais', 'estado', 'cidade', 'bairro', 'endereco', 'cep',
  'status', 'servico', 'valor_estimado', 'observacoes', 'origem',
  'tem_site', 'tem_instagram', 'tem_facebook', 'tem_cardapio',
  'tem_catalogo', 'tem_landing', 'tem_whatsapp_comercial',
] as const

const PRESENCE_EXPORT: Record<Presence, string> = { yes: 'sim', no: 'não', unverified: 'não verificado' }

export function leadsToCsv(leads: Lead[]): string {
  const rows = leads.map((l) => [
    l.name, l.responsible_name ?? '', l.niche ?? '', l.phone ?? '', l.whatsapp ?? '',
    l.email ?? '', l.cnpj ?? '', l.instagram ?? '', l.facebook ?? '', l.website ?? '',
    l.menu_url ?? '', l.catalog_url ?? '', l.country ?? '', l.state ?? '', l.city ?? '',
    l.district ?? '', l.address ?? '', l.zip_code ?? '', STATUS_LABELS[l.status],
    l.offered_service ?? '', String(l.estimated_value), l.notes ?? '', l.source ?? '',
    PRESENCE_EXPORT[l.has_website], PRESENCE_EXPORT[l.has_instagram], PRESENCE_EXPORT[l.has_facebook],
    PRESENCE_EXPORT[l.has_digital_menu], PRESENCE_EXPORT[l.has_digital_catalog],
    PRESENCE_EXPORT[l.has_landing_page], PRESENCE_EXPORT[l.has_business_whatsapp],
  ])
  return Papa.unparse({ fields: [...CSV_HEADERS], data: rows }, { newline: '\n' })
}

export interface CsvParsedRow {
  line: number
  draft: LeadWrite | null
  errors: string[]
}

function parsePresence(raw: string): Presence | null {
  const v = raw.trim().toLowerCase()
  if (v === '') return 'unverified'
  if (['sim', 'yes', 's', 'true', '1'].includes(v)) return 'yes'
  if (['não', 'nao', 'no', 'n', 'false', '0'].includes(v)) return 'no'
  if (['não verificado', 'nao verificado', 'unverified', 'desconhecido'].includes(v)) return 'unverified'
  return null
}

function parseStatus(raw: string): LeadStatus | null {
  const v = raw.trim().toLowerCase()
  if (v === '') return 'novo'
  const byValue = LEAD_STATUSES.find((s) => s === v)
  if (byValue) return byValue
  const byLabel = LEAD_STATUSES.find((s) => STATUS_LABELS[s].toLowerCase() === v)
  return byLabel ?? null
}

function parseNiche(raw: string): string | null {
  const v = raw.trim().toLowerCase()
  if (v === '') return null
  const byValue = NICHES.find((n) => n === v)
  if (byValue) return byValue
  const byLabel = NICHES.find((n) => NICHE_LABELS[n].toLowerCase() === v)
  return byLabel ?? v
}

function parseMoney(raw: string): number | null {
  const v = raw.trim()
  if (v === '') return 0
  const normalized = v.includes(',')
    ? v.replace(/\./g, '').replace(',', '.')
    : v
  const n = Number(normalized)
  return Number.isFinite(n) && n >= 0 ? n : null
}

const PRESENCE_COLUMNS: Array<[string, keyof LeadWrite]> = [
  ['tem_site', 'has_website'],
  ['tem_instagram', 'has_instagram'],
  ['tem_facebook', 'has_facebook'],
  ['tem_cardapio', 'has_digital_menu'],
  ['tem_catalogo', 'has_digital_catalog'],
  ['tem_landing', 'has_landing_page'],
  ['tem_whatsapp_comercial', 'has_business_whatsapp'],
]

export function parseLeadsCsv(text: string): CsvParsedRow[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })
  return parsed.data.map((row, i) => {
    const errors: string[] = []
    const draft = emptyLeadDraft()
    const get = (key: string) => (row[key] ?? '').trim()

    draft.name = get('nome')
    if (!draft.name) errors.push('Nome é obrigatório.')

    draft.responsible_name = get('responsavel') || null
    draft.niche = parseNiche(get('nicho'))
    draft.phone = get('telefone') || null
    draft.whatsapp = get('whatsapp') || null
    draft.email = get('email') || null
    draft.cnpj = get('cnpj') || null
    draft.instagram = get('instagram') || null
    draft.facebook = get('facebook') || null
    draft.website = get('site') || null
    draft.menu_url = get('cardapio_url') || null
    draft.catalog_url = get('catalogo_url') || null
    draft.country = get('pais') || 'Brasil'
    draft.state = get('estado') || null
    draft.city = get('cidade') || null
    draft.district = get('bairro') || null
    draft.address = get('endereco') || null
    draft.zip_code = get('cep') || null
    draft.offered_service = get('servico') || null
    draft.notes = get('observacoes') || null
    draft.source = get('origem') || null

    const status = parseStatus(get('status'))
    if (status === null) errors.push(`status inválido: "${get('status')}".`)
    else draft.status = status

    const money = parseMoney(get('valor_estimado'))
    if (money === null) errors.push(`valor_estimado inválido: "${get('valor_estimado')}".`)
    else draft.estimated_value = money

    for (const [column, field] of PRESENCE_COLUMNS) {
      const presence = parsePresence(get(column))
      if (presence === null) errors.push(`${column} inválido: "${get(column)}" (use sim, não ou não verificado).`)
      else (draft as Record<string, unknown>)[field] = presence
    }

    return { line: i + 2, draft: errors.length > 0 ? null : draft, errors }
  })
}