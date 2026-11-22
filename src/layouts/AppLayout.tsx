import { NavLink, Outlet } from 'react-router-dom'
import { FolderKanban, LayoutDashboard, Lock, LogOut, Users, Wallet } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { Logo } from '../components/ui/Logo'
import { StatusDot } from '../components/ui/StatusDot'
import { cn } from '../utils/cn'

const futureModules = [
  { label: 'Leads', icon: Users, stage: 'Etapa 2' },
  { label: 'Projetos', icon: FolderKanban, stage: 'Etapa 3' },
  { label: 'Financeiro', icon: Wallet, stage: 'Etapa 4' },
]

export function AppLayout() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface p-4 md:flex">
        <Logo className="mb-8 px-2 text-ink" />
        <nav className="flex flex-col gap-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                isActive ? 'bg-elevated text-ink' : 'text-muted hover:bg-elevated hover:text-ink',
              )
            }
          >
            <LayoutDashboard className="h-4 w-4" />
            Visão geral
            <StatusDot color="mint" className="ml-auto" />
          </NavLink>
          {futureModules.map(({ label, icon: Icon, stage }) => (
            <span
              key={label}
              className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted/50"
              title={`Disponível na ${stage}`}
            >
              <Icon className="h-4 w-4" />
              {label}
              <Lock className="ml-auto h-3.5 w-3.5" />
            </span>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-line bg-elevated p-3 text-xs text-muted">
          Etapa 1 concluída — fundação, autenticação e conexão Supabase.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-line bg-surface px-4 md:px-6">
          <Logo className="text-ink md:hidden" />
          <span className="hidden text-sm text-muted md:block">CRM de prospecção comercial</span>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-48 truncate text-sm text-muted sm:block">{user?.email}</span>
            <button
              onClick={() => void signOut()}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-elevated px-3 text-sm text-ink transition-colors hover:bg-line"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </header>
        <main className="dot-grid flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}