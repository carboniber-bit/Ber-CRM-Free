import { requireSupabase, throwDbError } from '../lib/db'
import type { Activity, ActivityType } from '../types/activity'

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
 * O FK de `lead_activities.lead_id` é `on delete cascade`, então atividade sem lead nomeado não
 * deveria existir; ainda assim o rótulo diz o que falta ('Lead removido') em vez de inventar nome.
 */
export async function listRecentActivities(limit: number): Promise<Array<Activity & { leadName: string }>> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('lead_activities')
    .select('*, leads(name)')
    .order('created_at', { ascending: false })
    .limit(limit)
  throwDbError(error)
  return (data ?? []).map((row) => {
    const { leads, ...activity } = row as Activity & { leads: { name: string } | null }
    return { ...activity, leadName: leads?.name ?? 'Lead removido' }
  })
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
