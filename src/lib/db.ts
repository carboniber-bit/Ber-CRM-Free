import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

export const NOT_CONFIGURED =
  'Supabase não configurado. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local.'

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error(NOT_CONFIGURED)
  return supabase
}

export function translateDbError(message: string): string {
  if (message.includes('permission denied')) return 'Sem permissão no banco. Verifique se a migration foi executada (grants/RLS).'
  if (message.includes('Failed to fetch') || message.includes('fetch')) return 'Falha de conexão com o Supabase. Verifique sua internet.'
  if (message.includes('duplicate key')) return 'Registro duplicado.'
  if (message.includes('row-level security')) return 'Acesso negado pelas regras de segurança (RLS).'
  return 'Não foi possível concluir a operação. Tente novamente.'
}

export function throwDbError(error: { message: string } | null): void {
  if (error) throw new Error(translateDbError(error.message))
}
