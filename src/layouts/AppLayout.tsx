import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  BarChart3, FolderKanban, LayoutDashboard, Lock, LogOut, Menu,
  Settings, Target, Users, Wallet, X, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { Logo } from '../components/ui/Logo'
import { cn } from '../utils/cn'

interface NavItem {
  label: string
  icon: LucideIcon
  to?: string
  stage?: string
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { label: 'Leads', icon: Users, stage: 'Etapa 2' },
  { label: 'Oportunidades', icon: Target, stage: 'Etapa 2' },
  { label: 'Pipeline', icon: FolderKanban, stage: 'Etapa 2' },
  { label: 'Clientes', icon: Users, stage: 'Etapa 3' },
  { label: 'Projetos', icon: FolderKanban, stage: 'Etapa 3' },
  { label: 'Financeiro', icon: Wallet, stage: 'Etapa 4' },
  { label: 'Relatórios', icon: BarChart3, stage: 'Etapa 4' },
  { label: 'Configurações', icon: Settings, stage: 'Etapa 2' },
]

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map(({ label, icon: Icon, to, stage }) =>
        to ? (
          <NavLink
            key={label}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                isActive ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-elevated hover:text-ink',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ) : (
          <span
            key={label}
            className="flex cursor-not-allowed items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted/50"
            title={`Disponível na ${stage}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">{label}</span>
            <span className="shrink-0 text-[10px] font-medium leading-none text-muted/70">{stage}</span>
            <Lock className="h-3.5 w-3.5 shrink-0" />
          </span>
        ),
      )}
    </nav>
  )
}

export function AppLayout() {
  const { user, signOut } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface p-4 lg:flex">
        <Logo className="mb-8 px-2 text-ink" />
        <NavContent />
        <div className="mt-auto rounded-xl border border-line bg-elevated p-3 text-xs text-muted">
          Etapa 2 em andamento — leads, oportunidades e pipeline.
        </div>
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-line bg-surface p-4">
            <div className="mb-6 flex items-center justify-between">
              <Logo className="text-ink" />
              <button onClick={() => setDrawerOpen(false)} aria-label="Fechar menu" className="rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
            <NavContent onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-line bg-surface px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setDrawerOpen(true)} aria-label="Abrir menu" className="rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-ink lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <Logo className="text-ink lg:hidden" />
            <span className="hidden text-sm text-muted lg:block">CRM de prospecção comercial</span>
          </div>
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
