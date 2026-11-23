import { requireSupabase, throwDbError } from '../lib/db'
import { DEFAULT_SETTINGS, type ServicePrices, type UserSettings } from '../types/settings'

export async function getSettings(): Promise<UserSettings> {
  const client = requireSupabase()
  const { data: sessionData } = await client.auth.getUser()
  const ownerId = sessionData.user?.id ?? ''
  const { data, error } = await client.from('user_settings').select('*').maybeSingle()
  throwDbError(error)
  if (!data) return { owner_id: ownerId, ...DEFAULT_SETTINGS }
  return data as UserSettings
}

export async function saveSettings(prices: ServicePrices, whatsappTemplate: string): Promise<UserSettings> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('user_settings')
    .upsert({ service_prices: prices, whatsapp_template: whatsappTemplate }, { onConflict: 'owner_id' })
    .select()
    .single()
  throwDbError(error)
  return data as UserSettings
}
