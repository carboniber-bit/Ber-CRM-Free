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

export const PROJECT_MOVE_STATUSES = [
  'not_started', 'planning', 'in_development', 'awaiting_client_info',
  'in_review', 'awaiting_approval', 'changes_requested', 'completed', 'cancelled',
] as const
export type ProjectMoveStatus = typeof PROJECT_MOVE_STATUSES[number]

export const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'] as const
export type TaskStatus = typeof TASK_STATUSES[number]

export const REVISION_STATUSES = ['requested', 'in_progress', 'completed', 'approved'] as const
export type RevisionStatus = typeof REVISION_STATUSES[number]

export interface ProjectTask {
  id: string
  owner_id: string
  project_id: string
  title: string
  description: string | null
  status: TaskStatus
  responsible_name: string | null
  start_date: string | null
  due_date: string | null
  priority: ProjectPriority
  position: number
  notes: string | null
  completed_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export interface ProjectRevision {
  id: string
  owner_id: string
  project_id: string
  requested_at: string
  description: string
  responsible_name: string | null
  status: RevisionStatus
  completed_at: string | null
  approved_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ProjectMetrics {
  progressPercent: number | null
  activeTasks: number
  completedTasks: number
}

export interface ProjectFilters {
  search?: string
  clientId?: string
  status?: ProjectStatus
  priority?: ProjectPriority
  dueFrom?: string
  dueTo?: string
}

export type ProjectSort = 'name_asc' | 'name_desc' | 'due_asc' | 'due_desc' | 'created_desc'

export interface ProjectListResult {
  projects: ProjectListItem[]
  total: number
}

export interface ProjectBoardResult {
  projects: ProjectListItem[]
  partial: boolean
}

export interface ProjectFormClientOption {
  id: string
  name: string
}

export interface ProjectFormContractOption {
  id: string
  client_id: string
  service: string
  total_value_cents: number
  allocated_cents: number
  remaining_cents: number
  due_date: string | null
}

export interface ProjectFormOptions {
  clients: ProjectFormClientOption[]
  contracts: ProjectFormContractOption[]
}

export interface ProjectListItem extends Project, ProjectMetrics {
  client_name: string | null
}

export interface ProjectDetail extends ProjectListItem {
  tasks: ProjectTask[]
  revisions: ProjectRevision[]
  activities: import('./client').ClientActivity[]
}

export interface ProjectWrite {
  clientId: string
  contractId: string
  name: string
  service: string
  contractedValueCents: number
  description: string
  startDate: string | null
  dueDate: string | null
  responsibleName: string
  priority: ProjectPriority
}

export interface ProjectTaskWrite {
  title: string
  description: string
  status: TaskStatus
  responsibleName: string
  startDate: string | null
  dueDate: string | null
  priority: ProjectPriority
  notes: string
}

export interface ProjectRevisionWrite {
  description: string
  responsibleName: string
  status: RevisionStatus
  notes: string
}

export interface DeliveryInput {
  deliveryUrl: string
  filesUrl: string
  finalNotes: string
  confirmed: boolean
}
