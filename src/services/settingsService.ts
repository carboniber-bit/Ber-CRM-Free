import { requireSupabase, throwDbError } from '../lib/db'
import { DEFAULT_SETTINGS, type ServicePrices, type UserSettings } from '../types/settings'

export async function getSettings(): Promise<UserSettings> {
  const client = requireSupabase()
  const { data: sessionData, error: authError } = await client.auth.getUser()
  if (authError) throw new Error('Não foi possível validar sua sessão. Entre novamente.')
  const ownerId = sessionData.user?.id
  if (!ownerId) throw new Error('Sua sessão expirou. Entre novamente para carregar as configurações.')
  const { data, error } = await client.from('user_settings').select('*').maybeSingle()
  throwDbError(error)
  if (!data) {
    return {
      owner_id: ownerId,
      service_prices: { ...DEFAULT_SETTINGS.service_prices },
      whatsapp_template: DEFAULT_SETTINGS.whatsapp_template,
    }
  }
  return data as UserSettings
}

export async function getProfileName(): Promise<string> {
  const client = requireSupabase()
  const { data: userData, error: authError } = await client.auth.getUser()
  if (authError) throw new Error('Não foi possível validar sua sessão. Entre novamente.')
  const userId = userData.user?.id
  if (!userId) throw new Error('Sua sessão expirou. Entre novamente.')
  const { data, error } = await client.from('profiles').select('full_name').eq('id', userId).maybeSingle()
  throwDbError(error)
  return data?.full_name ?? ''
}

export async function updateProfileName(fullName: string): Promise<void> {
  const client = requireSupabase()
  const { data: userData } = await client.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('Sessão expirada. Entre novamente.')
  const { error } = await client.from('profiles').update({ full_name: fullName }).eq('id', userId)
  throwDbError(error)
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
