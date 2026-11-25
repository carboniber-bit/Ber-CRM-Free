import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3, Bell, FolderKanban, LayoutDashboard, LogOut, Menu,
  Settings, Target, Users, Wallet, X, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { countOverdue } from '../services/followupService'
import { Logo } from '../components/ui/Logo'
import { cn } from '../utils/cn'

interface NavItem {
  label: string
  icon: LucideIcon
  to: string
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function getFocusableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
    .filter((element) => element.getClientRects().length > 0)
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { label: 'Leads', icon: Users, to: '/leads' },
  { label: 'Oportunidades', icon: Target, to: '/oportunidades' },
  { label: 'Pipeline', icon: FolderKanban, to: '/pipeline' },
  { label: 'Clientes', icon: Users, to: '/clientes' },
  { label: 'Projetos', icon: FolderKanban, to: '/projetos' },
  { label: 'Financeiro', icon: Wallet, to: '/financeiro' },
  { label: 'Relatórios', icon: BarChart3, to: '/relatorios' },
  { label: 'Configurações', icon: Settings, to: '/configuracoes' },
]

function NavContent({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  return (
    <nav className={cn('flex flex-col gap-1', className)}>
      {navItems.map(({ label, icon: Icon, to }) => (
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
      ))}
    </nav>
  )
}

export function AppLayout() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  // null = ainda sem número confirmado (em trânsito ou consulta falhou): badge só existe com
  // contagem real, porque sino sem badge não afirma que não há atrasado.
  const [overdueCount, setOverdueCount] = useState<number | null>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  // Sem timer nem polling: o contador é relido a cada troca de rota, então sair de /followups
  // depois de concluir um atrasado já devolve o número novo.
  useEffect(() => {
    let active = true
    void countOverdue().then(
      (count) => { if (active) setOverdueCount(count) },
      () => { if (active) setOverdueCount(null) },
    )
    return () => { active = false }
  }, [location.pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const drawer = drawerRef.current
    const hamburger = hamburgerRef.current
    if (!drawer) return

    closeButtonRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDrawer()
        return
      }
      if (event.key !== 'Tab') return

      const focusableElements = getFocusableElements(drawer)
      if (focusableElements.length === 0) {
        event.preventDefault()
        drawer.focus()
        return
      }

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement

      if (event.shiftKey && (activeElement === first || activeElement === drawer || !drawer.contains(activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (activeElement === last || !drawer.contains(activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }

    const desktopQuery = window.matchMedia('(min-width: 1024px)')
    const onDesktopChange = (event: MediaQueryListEvent) => {
      if (event.matches) closeDrawer()
    }

    window.addEventListener('keydown', onKeyDown)
    desktopQuery.addEventListener('change', onDesktopChange)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      desktopQuery.removeEventListener('change', onDesktopChange)
      if (
        hamburger?.isConnected
        && hamburger.getClientRects().length > 0
        && !hamburger.matches(':disabled')
        && !hamburger.closest('[inert]')
      ) {
        hamburger.focus()
      }
    }
  }, [drawerOpen, closeDrawer])

  return (
    <div className="flex min-h-screen bg-bg">
      <aside inert={drawerOpen} className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface p-4 lg:flex">
        <Logo className="mb-8 px-2 text-ink" />
        <NavContent />
        <div className="mt-auto rounded-xl border border-line bg-elevated p-3 text-xs text-muted">
          Etapa 2 — leads, oportunidades, pipeline e prospecção.
        </div>
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={closeDrawer} />
          <aside
            ref={drawerRef}
            id="mobile-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação"
            tabIndex={-1}
            className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-line bg-surface p-4"
          >
            <div className="mb-6 flex shrink-0 items-center justify-between">
              <Logo className="text-ink" />
              <button ref={closeButtonRef} onClick={closeDrawer} aria-label="Fechar menu" className="rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
            <NavContent onNavigate={closeDrawer} className="min-h-0 flex-1 overflow-y-auto" />
          </aside>
        </div>
      )}

      <div inert={drawerOpen} className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-line bg-surface px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              ref={hamburgerRef}
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir menu"
              aria-haspopup="dialog"
              aria-expanded={drawerOpen}
              aria-controls="mobile-navigation-drawer"
              className="rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-ink lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Logo className="text-ink lg:hidden" />
            <span className="hidden text-sm text-muted lg:block">CRM de prospecção comercial</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/followups"
              aria-label={overdueCount === null ? 'Follow-ups atrasados' : `Follow-ups atrasados: ${overdueCount}`}
              className="relative rounded-lg p-1.5 text-muted transition-colors hover:bg-elevated hover:text-ink"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
              {overdueCount !== null && overdueCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-bg">
                  {overdueCount}
                </span>
              )}
            </Link>
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
