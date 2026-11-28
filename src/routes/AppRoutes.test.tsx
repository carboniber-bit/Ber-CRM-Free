// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from './AppRoutes'

const { routeState } = vi.hoisted(() => ({ routeState: { authenticated: true } }))

vi.mock('./ProtectedRoute', async () => {
  const { Navigate, Outlet } = await import('react-router-dom')
  return {
    ProtectedRoute: () => routeState.authenticated ? (
      <>
        <p>Rota protegida</p>
        <Outlet />
      </>
    ) : <Navigate to="/login" replace />,
  }
})

vi.mock('../layouts/AppLayout', async () => {
  const { Outlet } = await import('react-router-dom')
  return { AppLayout: () => <><p>Layout do aplicativo</p><Outlet /></> }
})

vi.mock('../layouts/AuthLayout', async () => {
  const { Outlet } = await import('react-router-dom')
  return { AuthLayout: () => <><p>Layout de autenticação</p><Outlet /></> }
})

vi.mock('../pages/LoginPage', () => ({ LoginPage: () => <h1>Login</h1> }))
vi.mock('../pages/StatusPage', () => ({ StatusPage: () => <h1>Status do Supabase</h1> }))
vi.mock('../pages/DashboardPage', () => ({ DashboardPage: () => <h1>Dashboard</h1> }))
vi.mock('../pages/LeadsPage', () => ({ LeadsPage: () => <h1>Leads</h1> }))
vi.mock('../pages/OpportunitiesPage', () => ({ OpportunitiesPage: () => <h1>Oportunidades</h1> }))
vi.mock('../pages/PipelinePage', () => ({ PipelinePage: () => <h1>Pipeline</h1> }))
vi.mock('../pages/LeadNewPage', () => ({ LeadNewPage: () => <h1>Novo lead</h1> }))
vi.mock('../pages/LeadDetailPage', () => ({ LeadDetailPage: () => <h1>Detalhe do lead</h1> }))
vi.mock('../pages/LeadEditPage', () => ({ LeadEditPage: () => <h1>Editar lead</h1> }))
vi.mock('../pages/FollowUpsPage', () => ({ FollowUpsPage: () => <h1>Follow-ups</h1> }))
vi.mock('../pages/SettingsPage', () => ({ SettingsPage: () => <h1>Configurações</h1> }))
vi.mock('../pages/ClientsPage', () => ({ ClientsPage: () => <h1>Clientes</h1> }))
vi.mock('../pages/ClientNewPage', () => ({ ClientNewPage: () => <h1>Novo cliente</h1> }))
vi.mock('../pages/ClientDetailPage', () => ({ ClientDetailPage: () => <h1>Detalhe do cliente</h1> }))
vi.mock('../pages/ProjectsPage', () => ({ ProjectsPage: () => <h1>Projetos</h1> }))
vi.mock('../pages/ProjectNewPage', () => ({ ProjectNewPage: () => <h1>Novo projeto</h1> }))
vi.mock('../pages/ProjectDetailPage', () => ({ ProjectDetailPage: () => <h1>Detalhe do projeto</h1> }))
vi.mock('../pages/ModulePlaceholderPage', () => ({
  ModulePlaceholderPage: ({ moduleKey }: { moduleKey: string }) => <h1>Módulo {moduleKey}</h1>,
}))
vi.mock('../pages/NotFoundPage', () => ({ NotFoundPage: () => <h1>Página não encontrada</h1> }))

let consoleError: ReturnType<typeof vi.spyOn>
let consoleWarn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  routeState.authenticated = true
  consoleError = vi.spyOn(console, 'error')
  consoleWarn = vi.spyOn(console, 'warn')
})

afterEach(() => {
  cleanup()
  expect(consoleError).not.toHaveBeenCalled()
  expect(consoleWarn).not.toHaveBeenCalled()
  consoleError.mockRestore()
  consoleWarn.mockRestore()
})

function renderPath(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

describe('AppRoutes', () => {
  it.each([
    ['/', 'Dashboard'],
    ['/leads', 'Leads'],
    ['/leads/novo', 'Novo lead'],
    ['/leads/lead-1', 'Detalhe do lead'],
    ['/leads/lead-1/editar', 'Editar lead'],
    ['/oportunidades', 'Oportunidades'],
    ['/pipeline', 'Pipeline'],
    ['/followups', 'Follow-ups'],
    ['/configuracoes', 'Configurações'],
    ['/clientes', 'Clientes'],
    ['/clientes/novo', 'Novo cliente'],
    ['/clientes/cliente-1', 'Detalhe do cliente'],
    ['/projetos', 'Projetos'],
    ['/projetos/novo', 'Novo projeto'],
    ['/projetos/project-1', 'Detalhe do projeto'],
    ['/financeiro', 'Módulo financeiro'],
    ['/relatorios', 'Módulo relatorios'],
  ])('%s renderiza %s dentro do layout protegido', (path, heading) => {
    renderPath(path)

    expect(screen.getByText('Rota protegida')).toBeTruthy()
    expect(screen.getByText('Layout do aplicativo')).toBeTruthy()
    expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Módulo clientes' })).toBeNull()
  })

  it.each([
    ['/login', 'Login'],
    ['/status', 'Status do Supabase'],
  ])('%s é uma rota pública', (path, heading) => {
    renderPath(path)

    expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
    expect(screen.queryByText('Rota protegida')).toBeNull()
  })

  it('redireciona rota protegida para login quando o stub não está autenticado', () => {
    routeState.authenticated = false
    renderPath('/clientes')

    expect(screen.getByRole('heading', { name: 'Login' })).toBeTruthy()
    expect(screen.queryByText('Rota protegida')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Clientes' })).toBeNull()
  })

  it('redireciona rota de projeto para login sem autenticação', () => {
    routeState.authenticated = false
    renderPath('/projetos')

    expect(screen.getByRole('heading', { name: 'Login' })).toBeTruthy()
    expect(screen.queryByText('Rota protegida')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Projetos' })).toBeNull()
  })

  it('usa a página 404 para caminho desconhecido', () => {
    renderPath('/rota-inexistente')
    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeTruthy()
    expect(screen.queryByText('Rota protegida')).toBeNull()
  })

  it('não usa mais placeholders para Clientes ou Projetos', () => {
    renderPath('/projetos')
    expect(screen.queryByRole('heading', { name: 'Módulo projetos' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Módulo clientes' })).toBeNull()
  })

  it('mantém /projetos/novo antes da rota dinâmica de detalhe', () => {
    renderPath('/projetos/novo')
    expect(screen.getByRole('heading', { name: 'Novo projeto' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Detalhe do projeto' })).toBeNull()
  })
})
