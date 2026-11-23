import { requireSupabase, throwDbError } from '../lib/db'
import type { CheckItem, DigitalCheck } from '../types/check'

export async function listChecks(leadId: string): Promise<DigitalCheck[]> {
  const client = requireSupabase()
  const { data, error } = await client.from('lead_digital_checks').select('*').eq('lead_id', leadId)
  throwDbError(error)
  return (data ?? []) as DigitalCheck[]
}

export async function setCheck(leadId: string, item: CheckItem, verified: boolean): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('lead_digital_checks').upsert(
    {
      lead_id: leadId,
      item,
      verified,
      verified_at: verified ? new Date().toISOString() : null,
    },
    { onConflict: 'lead_id,item' },
  )
  throwDbError(error)
  if (verified) {
    const { error: leadError } = await client
      .from('leads')
      .update({ last_verified_at: new Date().toISOString() })
      .eq('id', leadId)
    throwDbError(leadError)
  }
}
