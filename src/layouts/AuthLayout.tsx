import { Outlet } from 'react-router-dom'
import { Logo } from '../components/ui/Logo'

export function AuthLayout() {
  return (
    <div className="dot-grid flex min-h-screen flex-col items-center justify-center bg-bg p-6">
      <Logo className="mb-8 text-ink" />
      <main className="w-full max-w-sm">
        <Outlet />
      </main>
      <p className="mt-8 text-xs text-muted/60">CRM de prospecção comercial · Etapa 1 — Fundação</p>
    </div>
  )
}