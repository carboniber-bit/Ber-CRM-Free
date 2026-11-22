import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { isSupabaseConfigured, supabase, supabaseAnonKey, supabaseUrl } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Logo } from '../components/ui/Logo'
import { StatusDot, type DotColor } from '../components/ui/StatusDot'

type CheckState = 'pending' | 'ok' | 'warn' | 'error'

interface Check {
  id: string
  label: string
  state: CheckState
  detail: string
}

const dotByState: Record<CheckState, DotColor> = {
  pending: 'muted',
  ok: 'mint',
  warn: 'lime',
  error: 'danger',
}

const labelByState: Record<CheckState, string> = {
  pending: 'Verificando…',
  ok: 'OK',
  warn: 'Atenção',
  error: 'Falhou',
}

function initialChecks(): Check[] {
  const skipped: Array<[CheckState, string]> = isSupabaseConfigured
    ? [
        ['pending', 'Aguardando verificação…'],
        ['pending', 'Aguardando verificação…'],
        ['pending', 'Aguardando verificação…'],
      ]
    : [
        ['warn', 'Ignorado: configure URL e chave pública no .env.local e reinicie o dev server.'],
        ['warn', 'Indisponível sem configuração do Supabase.'],
        ['warn', 'Indisponível sem configuração do Supabase.'],
      ]

  return [
    {
      id: 'env-url',
      label: 'Variável VITE_SUPABASE_URL',
      state: supabaseUrl ? 'ok' : 'error',
      detail: supabaseUrl || 'Não definida no .env.local.',
    },
    {
      id: 'env-key',
      label: 'Variável VITE_SUPABASE_ANON_KEY',
      state: supabaseAnonKey ? 'ok' : 'error',
      detail: supabaseAnonKey
        ? 'Chave pública carregada (anon/publishable).'
        : 'Não definida. Copie a chave pública em Supabase → Settings → API Keys.',
    },
    { id: 'connection', label: 'Conexão com o Supabase', state: skipped[0][0], detail: skipped[0][1] },
    { id: 'session', label: 'Sessão de autenticação', state: skipped[1][0], detail: skipped[1][1] },
    { id: 'profiles', label: 'Tabela profiles (RLS)', state: skipped[2][0], detail: skipped[2][1] },
  ]
}

export function StatusPage() {
  const [checks, setChecks] = useState<Check[]>(initialChecks)
  const [running, setRunning] = useState(isSupabaseConfigured)

  const update = useCallback((id: string, state: CheckState, detail: string) => {
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, state, detail } : c)))
  }, [])

  const runChecks = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setChecks(initialChecks())
      setRunning(false)
      return
    }

    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
        headers: { apikey: supabaseAnonKey },
      })
      if (response.ok) {
        update('connection', 'ok', 'Servidor Supabase respondeu com sucesso.')
      } else {
        update('connection', 'error', `Servidor respondeu HTTP ${response.status}. Verifique a URL do projeto.`)
      }
    } catch {
      update('connection', 'error', 'Sem resposta do servidor. Verifique a URL e sua conexão.')
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) {
      update('session', 'error', `Erro ao ler sessão: ${sessionError.message}`)
    } else if (sessionData.session) {
      update('session', 'ok', `Autenticado como ${sessionData.session.user.email}.`)
    } else {
      update('session', 'warn', 'Nenhuma sessão ativa. Faça login para testar a autenticação completa.')
    }

    if (sessionData.session) {
      const { error: profileError } = await supabase.from('profiles').select('id').limit(1)
      if (profileError) {
        update(
          'profiles',
          'error',
          `Erro ao consultar profiles: ${profileError.message}. Execute supabase/migrations/0001_profiles.sql no SQL Editor.`,
        )
      } else {
        update('profiles', 'ok', 'Tabela acessível com RLS ativo (leitura do próprio perfil).')
      }
    } else {
      update('profiles', 'warn', 'Requer login: a política RLS só permite ler o próprio perfil autenticado.')
    }

    setRunning(false)
  }, [update])

  useEffect(() => {
    if (isSupabaseConfigured) void runChecks()
  }, [runChecks])

  return (
    <div className="dot-grid min-h-screen bg-bg p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 py-8">
        <div className="flex items-center justify-between">
          <Logo className="text-ink" />
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Ir para o login
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Verificação do sistema</h1>
          <p className="mt-1 text-sm text-muted">
            Diagnóstico da fundação: variáveis de ambiente, conexão Supabase, autenticação e schema de perfis.
          </p>
        </div>

        <Card>
          <ul className="flex flex-col divide-y divide-line">
            {checks.map((check) => (
              <li key={check.id} className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
                <StatusDot color={dotByState[check.state]} className="mt-1.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink">{check.label}</p>
                    <span className="shrink-0 text-xs text-muted">{labelByState[check.state]}</span>
                  </div>
                  <p className="mt-0.5 break-words text-xs text-muted">{check.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setRunning(true)
              void runChecks()
            }}
            loading={running}
          >
            <RefreshCw className="h-4 w-4" />
            Reverificar
          </Button>
          <p className="text-xs text-muted/70">
            Após editar o <code className="text-lime">.env.local</code>, reinicie o dev server.
          </p>
        </div>
      </div>
    </div>
  )
}