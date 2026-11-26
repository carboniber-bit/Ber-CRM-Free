export const PROJECT_STATUSES = [
  'not_started', 'planning', 'in_development', 'awaiting_client_info',
  'in_review', 'awaiting_approval', 'changes_requested', 'completed',
  'delivered', 'cancelled',
] as const

export type ProjectStatus = typeof PROJECT_STATUSES[number]
export type ProjectPriority = 'very_high' | 'high' | 'medium' | 'low'

export interface Project {
  id: string
  owner_id: string
  client_id: string
  contract_id: string
  source_link_id: string | null
  name: string
  service: string
  contracted_value_cents: number
  description: string | null
  start_date: string | null
  due_date: string | null
  responsible_name: string | null
  priority: ProjectPriority
  status: ProjectStatus
  completed_at: string | null
  delivered_at: string | null
  delivery_confirmed_at: string | null
  delivery_url: string | null
  files_url: string | null
  final_notes: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}
