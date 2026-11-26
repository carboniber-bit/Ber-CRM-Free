// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { environment } = vi.hoisted(() => ({
  environment: { configured: true, loading: false, hasSession: false },
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    session: environment.hasSession ? { user: { id: 'user-1' } } : null,
    loading: environment.loading,
  }),
}))
vi.mock('../lib/supabase', () => ({
  get isSupabaseConfigured() { return environment.configured },
}))

import { ProtectedRoute } from './ProtectedRoute'

function renderProtectedRoute(path = '/protegido') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/protegido" element={<h1>Área protegida</h1>} />
        </Route>
        <Route path="/login" element={<h1>Login</h1>} />
        <Route path="/status" element={<h1>Status do Supabase</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(cleanup)

beforeEach(() => {
  environment.configured = true
  environment.loading = false
  environment.hasSession = false
})

describe('ProtectedRoute', () => {
  it('redireciona para status quando o Supabase não está configurado', async () => {
    environment.configured = false
    renderProtectedRoute()

    expect(await screen.findByRole('heading', { name: 'Status do Supabase' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Área protegida' })).toBeNull()
  })

  it('exibe o loader sem redirecionar enquanto a sessão carrega', () => {
    environment.loading = true
    renderProtectedRoute()

    expect(screen.getByLabelText('Carregando')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Login' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Status do Supabase' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Área protegida' })).toBeNull()
  })

  it('redireciona para login quando não há sessão', async () => {
    renderProtectedRoute()

    expect(await screen.findByRole('heading', { name: 'Login' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Área protegida' })).toBeNull()
  })

  it('renderiza o Outlet quando há sessão e a configuração está pronta', () => {
    environment.hasSession = true
    renderProtectedRoute()

    expect(screen.getByRole('heading', { name: 'Área protegida' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Login' })).toBeNull()
  })
})
