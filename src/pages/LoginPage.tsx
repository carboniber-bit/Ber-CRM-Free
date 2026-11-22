import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { LogIn, TriangleAlert } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'
import { signIn } from '../services/authService'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'

export function LoginPage() {
  const { session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Informe e-mail e senha.')
      return
    }

    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao entrar.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!isSupabaseConfigured && (
        <Card className="border-lime/30">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-lime" />
            <div className="text-sm">
              <p className="font-medium text-ink">Supabase não configurado</p>
              <p className="mt-1 text-muted">
                Preencha as chaves no <code className="text-lime">.env.local</code> para habilitar o login.{' '}
                <Link to="/status" className="text-accent underline-offset-2 hover:underline">
                  Ver diagnóstico
                </Link>
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card title="Entrar" dot="mint">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Senha"
            type="password"
            autoComplete="current-password"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="mint" loading={submitting} disabled={!isSupabaseConfigured}>
            <LogIn className="h-4 w-4" />
            Entrar
          </Button>
        </form>
        <p className="mt-4 text-xs text-muted/70">
          Acesso restrito. Contas são criadas pelo administrador no painel do Supabase.
        </p>
      </Card>
    </div>
  )
}