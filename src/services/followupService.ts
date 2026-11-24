import { requireSupabase, throwDbError } from '../lib/db'
import type { Followup, FollowupList } from '../types/followup'
import { addActivity } from './activityService'

function dayBounds() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString(), now: new Date().toISOString() }
}

export async function listFollowups(list: FollowupList): Promise<Followup[]> {
  const client = requireSupabase()
  const { start, end, now } = dayBounds()
  let query = client.from('lead_followups').select('*')
  if (list === 'today') query = query.eq('status', 'pendente').gte('due_at', start).lte('due_at', end)
  if (list === 'upcoming') query = query.eq('status', 'pendente').gt('due_at', end)
  if (list === 'overdue') query = query.eq('status', 'pendente').lt('due_at', now)
  if (list === 'done') query = query.eq('status', 'concluido')
  const orderColumn = list === 'done' ? 'completed_at' : 'due_at'
  const { data, error } = await query.order(orderColumn, { ascending: list !== 'done' })
  throwDbError(error)
  return (data ?? []) as Followup[]
}

export async function listByLead(leadId: string): Promise<Followup[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('lead_followups')
    .select('*')
    .eq('lead_id', leadId)
    .order('due_at', { ascending: true })
  throwDbError(error)
  return (data ?? []) as Followup[]
}

export async function createFollowup(
  leadId: string,
  dueAt: string,
  reason: string | null,
  note: string | null,
): Promise<Followup> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('lead_followups')
    .insert({ lead_id: leadId, due_at: dueAt, reason, note })
    .select()
    .single()
  throwDbError(error)
  await syncNextContact(leadId)
  return data as Followup
}

export async function completeFollowup(id: string, result: string | null): Promise<void> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('lead_followups')
    .update({ status: 'concluido', completed_at: new Date().toISOString(), result })
    .eq('id', id)
    .eq('status', 'pendente')
    .select()
    .maybeSingle()
  throwDbError(error)
  if (!data) return
  const followup = data as Followup
  await addActivity(
    followup.lead_id,
    'follow_up',
    result ? `Follow-up concluído: ${result}` : 'Follow-up concluído.',
  )
  await syncNextContact(followup.lead_id)
}

export async function cancelFollowup(id: string): Promise<void> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('lead_followups')
    .update({ status: 'cancelado' })
    .eq('id', id)
    .eq('status', 'pendente')
    .select()
    .maybeSingle()
  throwDbError(error)
  if (!data) return
  await syncNextContact((data as Followup).lead_id)
}

export async function countOverdue(): Promise<number> {
  const client = requireSupabase()
  const { count, error } = await client
    .from('lead_followups')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pendente')
    .lt('due_at', new Date().toISOString())
  throwDbError(error)
  return count ?? 0
}

export async function syncNextContact(leadId: string): Promise<void> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('lead_followups')
    .select('due_at')
    .eq('lead_id', leadId)
    .eq('status', 'pendente')
    .order('due_at', { ascending: true })
    .limit(1)
  throwDbError(error)
  const next = data?.[0]?.due_at ?? null
  const { error: updateError } = await client.from('leads').update({ next_contact_at: next }).eq('id', leadId)
  throwDbError(updateError)
}
