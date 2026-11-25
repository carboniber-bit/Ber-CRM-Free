import { requireSupabase, throwDbError } from '../lib/db'
import type { Followup, FollowupList } from '../types/followup'

function toFollowup(data: unknown): Followup | null {
  const payload = Array.isArray(data) ? data[0] : data
  if (!payload || typeof payload !== 'object') return null
  const candidate = payload as Partial<Followup>
  return candidate.id ? candidate as Followup : null
}

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
    .rpc('create_lead_followup', { p_lead_id: leadId, p_due_at: dueAt, p_reason: reason, p_note: note })
  throwDbError(error)
  const created = toFollowup(data)
  if (!created) throw new Error('Não foi possível agendar o follow-up.')
  return created
}

export async function completeFollowup(id: string, result: string | null): Promise<Followup | null> {
  const client = requireSupabase()
  const { data, error } = await client
    .rpc('complete_lead_followup', { p_followup_id: id, p_result: result })
  throwDbError(error)
  return toFollowup(data)
}

export async function cancelFollowup(id: string): Promise<Followup | null> {
  const client = requireSupabase()
  const { data, error } = await client
    .rpc('cancel_lead_followup', { p_followup_id: id })
  throwDbError(error)
  return toFollowup(data)
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
