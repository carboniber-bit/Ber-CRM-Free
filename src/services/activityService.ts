import { requireSupabase, throwDbError } from '../lib/db'
import type { Activity, ActivityType } from '../types/activity'

type ActivityWithLeadName = Activity & { leadName: string }
type ActivityRow = Activity & { leads: { name: string } | null }

const UNKNOWN_LEAD_NAME = 'Nome do lead não carregado'

function mapActivityWithLead(row: ActivityRow): ActivityWithLeadName {
  const { leads, ...activity } = row
  return { ...activity, leadName: leads?.name ?? UNKNOWN_LEAD_NAME }
}

export async function listActivities(leadId: string): Promise<Activity[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('lead_activities')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
  throwDbError(error)
  return (data ?? []) as Activity[]
}

/**
 * Atividades mais recentes de todos os leads do usuário, já com o nome do lead vindo pelo join
 * `leads(name)` — o dashboard precisa rotular a linha sem pagar uma segunda consulta de leads.
 * Um join sem nome não confirma exclusão: o rótulo informa apenas que o nome não carregou.
 */
export async function listRecentActivities(limit: number): Promise<Array<Activity & { leadName: string }>> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('lead_activities')
    .select('*, leads(name)')
    .order('created_at', { ascending: false })
    .limit(limit)
  throwDbError(error)
  return (data ?? []).map((row) => mapActivityWithLead(row as ActivityRow))
}

/** Últimas mudanças de status reais, independentes da janela de atividades genéricas. */
export async function listRecentStatusChanges(limit: number): Promise<Array<Activity & { leadName: string }>> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('lead_activities')
    .select('*, leads(name)')
    .eq('type', 'mudanca_status')
    .order('created_at', { ascending: false })
    .limit(limit)
  throwDbError(error)
  return (data ?? []).map((row) => mapActivityWithLead(row as ActivityRow))
}

export async function addActivity(leadId: string, type: ActivityType, description: string): Promise<Activity> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('lead_activities')
    .insert({ lead_id: leadId, type, description })
    .select()
    .single()
  throwDbError(error)
  return data as Activity
}
