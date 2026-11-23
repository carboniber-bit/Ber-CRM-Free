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
