import { supabase } from '../lib/supabase'

const NOT_CONFIGURED =
  'Supabase não configurado. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local.'

export function translateAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (message.includes('Email not confirmed')) return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.'
  if (message.includes('rate limit')) return 'Muitas tentativas. Aguarde um momento e tente novamente.'
  if (message.includes('Failed to fetch') || message.includes('fetch')) return 'Falha de conexão com o Supabase. Verifique a URL e sua internet.'
  return 'Não foi possível entrar. Tente novamente.'
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error(NOT_CONFIGURED)
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(translateAuthError(error.message))
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error('Não foi possível sair. Tente novamente.')
}