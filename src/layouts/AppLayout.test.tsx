// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { countOverdue } from '../services/followupService'
import { AppLayout } from './AppLayout'

vi.mock('../services/followupService', () => ({ countOverdue: vi.fn() }))
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'teste@exemplo.com' }, signOut: vi.fn() }),
}))

function renderLayout(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<div>Página inicial</div>} />
          <Route path="/leads" element={<div>Lista de leads</div>} />
          <Route path="/followups" element={<div>Follow-ups</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function bell(): HTMLAnchorElement {
  return screen.getByRole('link', { name: /Follow-ups atrasados/ })
}

let consoleError: ReturnType<typeof vi.spyOn>
let consoleWarn: ReturnType<typeof vi.spyOn>

afterEach(() => {
  cleanup()
  expect(consoleError).not.toHaveBeenCalled()
  expect(consoleWarn).not.toHaveBeenCalled()
  consoleError.mockRestore()
  consoleWarn.mockRestore()
})

beforeEach(() => {
  vi.clearAllMocks()
  consoleError = vi.spyOn(console, 'error')
  consoleWarn = vi.spyOn(console, 'warn')
  vi.mocked(countOverdue).mockResolvedValue(0)
})

describe('AppLayout sino de atrasados', () => {
  it('mostra o contador de atrasados e leva à página de follow-ups', async () => {
    vi.mocked(countOverdue).mockResolvedValue(3)
    renderLayout()
    await waitFor(() => expect(within(bell()).getByText('3')).toBeTruthy())

    expect(bell().getAttribute('href')).toBe('/followups')
    expect(bell().getAttribute('aria-label')).toBe('Follow-ups atrasados: 3')
    // Badge é texto dentro do link: nenhum botão aninhado em âncora.
    expect(bell().querySelectorAll('a button, a a, button')).toHaveLength(0)
  })

  it('não mostra badge quando o contador confirmado é zero', async () => {
    vi.mocked(countOverdue).mockResolvedValue(0)
    renderLayout()
    await waitFor(() => expect(countOverdue).toHaveBeenCalled())
    await act(async () => { await Promise.resolve() })

    expect(bell().textContent).not.toMatch(/\d/)
    expect(bell().getAttribute('aria-label')).toBe('Follow-ups atrasados: 0')
  })

  it('sem resposta do contador nenhum número é afirmado', async () => {
    vi.mocked(countOverdue).mockRejectedValue(new Error('Falha de conexão com o Supabase.'))
    renderLayout()
    await waitFor(() => expect(countOverdue).toHaveBeenCalled())
    await act(async () => { await Promise.resolve() })

    expect(bell().textContent).not.toMatch(/\d/)
    expect(bell().getAttribute('aria-label')).toBe('Follow-ups atrasados')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('recarrega o contador quando a rota muda', async () => {
    vi.mocked(countOverdue).mockResolvedValue(2)
    renderLayout()
    await waitFor(() => expect(countOverdue).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('link', { name: 'Leads' }))
    await waitFor(() => expect(countOverdue).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Lista de leads')).toBeTruthy()
    await waitFor(() => expect(within(bell()).getByText('2')).toBeTruthy())
  })

  it('Follow-ups não entra na sidebar: o acesso é pelo sino', async () => {
    renderLayout()
    await waitFor(() => expect(countOverdue).toHaveBeenCalled())

    const nav = screen.getByRole('navigation')
    expect(within(nav).queryByRole('link', { name: 'Follow-ups' })).toBeNull()
    expect(within(nav).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/', '/leads', '/oportunidades', '/pipeline',
    ])
  })
})
