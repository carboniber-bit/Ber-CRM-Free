export type FollowupStatus = 'pendente' | 'concluido' | 'cancelado'

export const FOLLOWUP_STATUS_LABELS: Record<FollowupStatus, string> = {
  pendente: 'Pendente',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

export interface Followup {
  id: string
  lead_id: string
  owner_id: string
  due_at: string
  reason: string | null
  note: string | null
  status: FollowupStatus
  completed_at: string | null
  result: string | null
  created_at: string
  updated_at: string
}

export type FollowupList = 'today' | 'upcoming' | 'overdue' | 'done' | 'all'
