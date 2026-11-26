import type { ActivityType } from './activity'
import type { Contract } from './contract'
import type { Project } from './project'

export const CLIENT_STATUSES = [
  'active', 'in_project', 'awaiting_payment', 'awaiting_approval',
  'project_completed', 'inactive',
] as const

export type ClientStatus = typeof CLIENT_STATUSES[number]

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: 'Ativo',
  in_project: 'Em projeto',
  awaiting_payment: 'Aguardando pagamento',
  awaiting_approval: 'Aguardando aprovação',
  project_completed: 'Projeto concluído',
  inactive: 'Inativo',
}

export interface ClientWrite {
  name: string
  responsible_name: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  cnpj: string | null
  website: string | null
  instagram: string | null
  address: string | null
  city: string | null
  district: string | null
  zip_code: string | null
  state: string | null
  niche: string | null
  notes: string | null
  status: ClientStatus
}

export interface Client extends ClientWrite {
  id: string
  owner_id: string
  creation_key: string
  cnpj_digits: string | null
  phone_canonical: string | null
  whatsapp_canonical: string | null
  source: string
  converted_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface InitialContractInput {
  service: string
  totalValueCents: number
  contractedAt: string
  dueDate: string | null
  paymentMethod: string
  paymentTerms: string
  notes: string
}

export interface CreateClientInput extends ClientWrite {
  creationKey: string
  initialContract: InitialContractInput
}

export interface UpdateClientInput extends ClientWrite {
  contractId: string
  initialContract: InitialContractInput
}

export interface ConversionInput {
  service: string
  contractedValueCents: number
  contractedAt: string
  paymentMethod: string
  paymentTerms: string
  notes: string
  project: {
    name: string
    startDate: string | null
    dueDate: string | null
  } | null
}

export interface ConversionResult {
  client_id: string
  link_id: string
  contract_id: string
  project_id: string | null
  already_existed: boolean
}

export interface LeadClientLink {
  id: string
  owner_id: string
  lead_id: string
  client_id: string
  converted_at: string
  created_at: string
}

export interface ClientActivity {
  id: string
  owner_id: string
  client_id: string
  project_id: string | null
  contract_id: string | null
  type: 'conversion' | 'contact' | 'meeting' | 'approval' | 'status_change' | 'delivery' | 'financial' | 'note'
  description: string
  metadata: Record<string, unknown>
  created_by: string | null
  created_at: string
}

export interface ClientHistoryEntry {
  id: string
  type: ActivityType | ClientActivity['type']
  description: string
  created_at: string
  source: 'client' | 'lead'
  leadName?: string
}

export interface ClientDetail {
  client: Client
  contracts: Contract[]
  projects: Project[]
  activities: ClientActivity[]
  linkedLeads: Array<{ leadId: string; leadName: string }>
  history: ClientHistoryEntry[]
}
