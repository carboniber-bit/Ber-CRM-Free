// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from './AppRoutes'

vi.mock('./ProtectedRoute', async () => {
  const { Outlet } = await import('react-router-dom')
  return {
    ProtectedRoute: () => (
      <>
        <p>Rota protegida</p>
        <Outlet />
      </>
    ),
  }
})

vi.mock('../layouts/AppLayout', async () => {
  const { Outlet } = await import('react-router-dom')
  return {
    AppLayout: () => (
      <>
        <p>Layout do aplicativo</p>
        <Outlet />
      </>
    ),
  }
})

vi.mock('../pages/SettingsPage', () => ({
  SettingsPage: () => <h1>Página de configurações</h1>,
}))

vi.mock('../pages/ModulePlaceholderPage', () => ({
  ModulePlaceholderPage: ({ moduleKey }: { moduleKey: string }) => <h1>Módulo {moduleKey}</h1>,
}))

let consoleError: ReturnType<typeof vi.spyOn>
let consoleWarn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
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

describe('AppRoutes módulos da Etapa 2', () => {
  it.each([
    ['/configuracoes', 'Página de configurações'],
    ['/clientes', 'Módulo clientes'],
    ['/projetos', 'Módulo projetos'],
    ['/financeiro', 'Módulo financeiro'],
    ['/relatorios', 'Módulo relatorios'],
  ])('%s renderiza a página esperada dentro do layout protegido', (path, heading) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>,
    )

    expect(screen.getByText('Rota protegida')).toBeTruthy()
    expect(screen.getByText('Layout do aplicativo')).toBeTruthy()
    expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
  })
})
