export type ContractStatus = 'active' | 'cancelled'

export interface Contract {
  id: string
  owner_id: string
  client_id: string
  source_link_id: string | null
  creation_key: string | null
  service: string
  total_value_cents: number
  contracted_at: string
  due_date: string | null
  payment_method: string | null
  payment_terms: string | null
  status: ContractStatus
  notes: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}
