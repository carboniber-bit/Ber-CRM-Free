export const LEAD_STATUSES = [
  'novo', 'contato_realizado', 'aguardando_resposta', 'pediu_informacoes',
  'interessado', 'negociando', 'aceitou', 'ignorou', 'nao_interessado',
  'follow_up', 'perdido',
] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const STATUS_LABELS: Record<LeadStatus, string> = {
  novo: 'Novo',
  contato_realizado: 'Contato realizado',
  aguardando_resposta: 'Aguardando resposta',
  pediu_informacoes: 'Pediu informações',
  interessado: 'Interessado',
  negociando: 'Negociando',
  aceitou: 'Aceitou',
  ignorou: 'Ignorou',
  nao_interessado: 'Não interessado',
  follow_up: 'Follow-up',
  perdido: 'Perdido',
}

export const NICHES = [
  'barbearia', 'manicure', 'nail_designer', 'salao_beleza', 'restaurante',
  'pizzaria', 'hamburgueria', 'lanchonete', 'cafeteria', 'clinica_estetica',
  'comercio', 'outros',
] as const
export type Niche = (typeof NICHES)[number]

export const NICHE_LABELS: Record<Niche, string> = {
  barbearia: 'Barbearia',
  manicure: 'Manicure',
  nail_designer: 'Nail designer',
  salao_beleza: 'Salão de beleza',
  restaurante: 'Restaurante',
  pizzaria: 'Pizzaria',
  hamburgueria: 'Hamburgueria',
  lanchonete: 'Lanchonete',
  cafeteria: 'Cafeteria',
  clinica_estetica: 'Clínica de estética',
  comercio: 'Pequeno comércio',
  outros: 'Outros',
}

export const PRESENCE_VALUES = ['yes', 'no', 'unverified'] as const
export type Presence = (typeof PRESENCE_VALUES)[number]

export const PRESENCE_LABELS: Record<Presence, string> = {
  yes: 'Sim',
  no: 'Não',
  unverified: 'Não verificado',
}

export const PRESENCE_FIELDS = [
  'has_website', 'has_instagram', 'has_facebook', 'has_digital_menu',
  'has_digital_catalog', 'has_landing_page', 'has_business_whatsapp',
] as const
export type PresenceField = (typeof PRESENCE_FIELDS)[number]

export const PRESENCE_FIELD_LABELS: Record<PresenceField, string> = {
  has_website: 'Possui site?',
  has_instagram: 'Possui Instagram?',
  has_facebook: 'Possui Facebook?',
  has_digital_menu: 'Possui cardápio digital?',
  has_digital_catalog: 'Possui catálogo digital?',
  has_landing_page: 'Possui página de apresentação?',
  has_business_whatsapp: 'Possui WhatsApp comercial?',
}

export const NEEDS = ['site', 'cardapio', 'landing', 'catalogo', 'presenca'] as const
export type Need = (typeof NEEDS)[number]

export const NEED_LABELS: Record<Need, string> = {
  site: 'Precisa de site',
  cardapio: 'Precisa de cardápio digital',
  landing: 'Precisa de landing page',
  catalogo: 'Precisa de catálogo digital',
  presenca: 'Precisa melhorar presença digital',
}

export const PRIORITIES = ['muito_alta', 'alta', 'media', 'baixa'] as const
export type Priority = (typeof PRIORITIES)[number]

export const PRIORITY_LABELS: Record<Priority, string> = {
  muito_alta: 'Muito alta',
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
}

export const SITUATIONS = [
  'nao_prospectado', 'pronto_contato', 'contato_realizado',
  'interessado', 'negociando', 'convertido', 'nao_interessado',
] as const
export type Situation = (typeof SITUATIONS)[number]

export const SITUATION_LABELS: Record<Situation, string> = {
  nao_prospectado: 'Não prospectado',
  pronto_contato: 'Pronto para contato',
  contato_realizado: 'Contato realizado',
  interessado: 'Interessado',
  negociando: 'Negociando',
  convertido: 'Convertido',
  nao_interessado: 'Não interessado',
}

export function situationStatuses(s: Situation): LeadStatus[] {
  switch (s) {
    case 'nao_prospectado': return ['novo']
    case 'pronto_contato': return ['novo', 'follow_up']
    case 'contato_realizado': return ['contato_realizado', 'aguardando_resposta', 'pediu_informacoes']
    case 'interessado': return ['interessado']
    case 'negociando': return ['negociando']
    case 'convertido': return ['aceitou']
    case 'nao_interessado': return ['nao_interessado', 'ignorou', 'perdido']
  }
}

export const INELIGIBLE_STATUSES: LeadStatus[] = ['aceitou', 'perdido', 'nao_interessado']

export interface Lead {
  id: string
  owner_id: string
  name: string
  responsible_name: string | null
  niche: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  cnpj: string | null
  instagram: string | null
  facebook: string | null
  website: string | null
  menu_url: string | null
  catalog_url: string | null
  maps_url: string | null
  country: string | null
  state: string | null
  city: string | null
  district: string | null
  address: string | null
  zip_code: string | null
  has_website: Presence
  has_instagram: Presence
  has_facebook: Presence
  has_digital_menu: Presence
  has_digital_catalog: Presence
  has_landing_page: Presence
  has_business_whatsapp: Presence
  status: LeadStatus
  offered_service: string | null
  notes: string | null
  source: string | null
  next_contact_at: string | null
  last_verified_at: string | null
  estimated_value: number
  negotiated_value: number
  contracted_value: number
  received_value: number
  score: number
  priority: Priority
  needs: Need[]
  score_reasons: string[]
  created_at: string
  updated_at: string
}

export type LeadWrite = Omit<
  Lead,
  | 'id' | 'owner_id' | 'created_at' | 'updated_at'
  | 'next_contact_at' | 'last_verified_at'
  | 'score' | 'priority' | 'needs' | 'score_reasons'
>

export function emptyLeadDraft(): LeadWrite {
  return {
    name: '',
    responsible_name: null,
    niche: null,
    phone: null,
    whatsapp: null,
    email: null,
    cnpj: null,
    instagram: null,
    facebook: null,
    website: null,
    menu_url: null,
    catalog_url: null,
    maps_url: null,
    country: 'Brasil',
    state: null,
    city: null,
    district: null,
    address: null,
    zip_code: null,
    has_website: 'unverified',
    has_instagram: 'unverified',
    has_facebook: 'unverified',
    has_digital_menu: 'unverified',
    has_digital_catalog: 'unverified',
    has_landing_page: 'unverified',
    has_business_whatsapp: 'unverified',
    status: 'novo',
    offered_service: null,
    notes: null,
    source: null,
    estimated_value: 0,
    negotiated_value: 0,
    contracted_value: 0,
    received_value: 0,
  }
}

export interface LeadFilters {
  search?: string
  niche?: string
  city?: string
  district?: string
  status?: LeadStatus
  priority?: Priority
  presenceField?: PresenceField
  presenceValue?: Presence
  createdFrom?: string
  createdTo?: string
  minScore?: number
  maxScore?: number
  need?: Need
  instagramWithoutSite?: boolean
  noSiteNoMenu?: boolean
  situation?: Situation
  excludeStatuses?: LeadStatus[]
  hasNeeds?: boolean
}

export type LeadSort = 'created_desc' | 'created_asc' | 'score_desc' | 'score_asc'
