export const ACTIVITY_TYPES = [
  'primeiro_contato', 'mensagem', 'ligacao', 'resposta', 'reuniao',
  'proposta', 'mudanca_status', 'observacao', 'follow_up', 'outro',
] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  primeiro_contato: 'Primeiro contato',
  mensagem: 'Mensagem registrada',
  ligacao: 'Ligação realizada',
  resposta: 'Resposta recebida',
  reuniao: 'Reunião',
  proposta: 'Envio de proposta',
  mudanca_status: 'Mudança de status',
  observacao: 'Observação',
  follow_up: 'Follow-up',
  outro: 'Outro',
}

export interface Activity {
  id: string
  lead_id: string
  owner_id: string
  type: ActivityType
  description: string
  user_id: string | null
  created_at: string
}
