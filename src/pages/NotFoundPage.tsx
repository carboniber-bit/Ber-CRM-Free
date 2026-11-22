import { Link } from 'react-router-dom'
import { ArrowLeft, Compass } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="dot-grid flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center">
        <Compass className="mx-auto mb-4 h-10 w-10 text-accent" />
        <h1 className="mb-2 text-lg font-semibold text-ink">Página não encontrada</h1>
        <p className="mb-6 text-sm text-muted">O endereço acessado não existe no Ber CRM.</p>
        <Link
          to="/"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-medium text-bg transition-colors hover:bg-ink/85"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}