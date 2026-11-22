import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseUrl = url ?? ''
export const supabaseAnonKey = anonKey ?? ''

export const isSupabaseConfigured = Boolean(url && anonKey)

// Somente a chave pública (anon/publishable) é usada no frontend.
// Nunca importe a service_role key aqui.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null