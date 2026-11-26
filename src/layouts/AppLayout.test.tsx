// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { completeFollowup, countOverdue } from '../services/followupService'
import type { Followup } from '../types/followup'
import { ToastContext } from '../hooks/useToast'
import { FollowupItem } from '../components/followups/FollowupItem'
import { AppLayout } from './AppLayout'

vi.mock('../services/followupService', () => ({
  countOverdue: vi.fn(),
  completeFollowup: vi.fn(),
  cancelFollowup: vi.fn(),
}))
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'teste@exemplo.com' }, signOut: vi.fn() }),
}))

const toast = vi.fn()

function renderLayout(initialEntries = ['/'], followupsPage: ReactNode = <div>Follow-ups</div>) {
  return render(
    <ToastContext.Provider value={{ toast }}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<div>Página inicial</div>} />
            <Route path="/leads" element={<div>Lista de leads</div>} />
            <Route path="/followups" element={followupsPage} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ToastContext.Provider>,
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
  vi.useRealTimers()
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
    // Badge é texto dentro do link: dentro da âncora não há botão nem âncora aninhada.
    expect(bell().querySelectorAll('button, a')).toHaveLength(0)
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

  it('atualiza o sino quando um follow-up vence com a aplicação aberta', async () => {
    vi.useFakeTimers()
    vi.mocked(countOverdue).mockResolvedValueOnce(0).mockResolvedValueOnce(1)
    renderLayout()
    await act(async () => { await Promise.resolve() })
    expect(bell().getAttribute('aria-label')).toBe('Follow-ups atrasados: 0')

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })

    expect(countOverdue).toHaveBeenCalledTimes(2)
    expect(bell().getAttribute('aria-label')).toBe('Follow-ups atrasados: 1')
    expect(within(bell()).getByText('1')).toBeTruthy()
  })

  it('não sobrepõe consultas do sino e agrupa atualizações recebidas durante uma consulta', async () => {
    vi.useFakeTimers()
    let resolveFirst!: (count: number) => void
    vi.mocked(countOverdue)
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve }))
      .mockResolvedValueOnce(1)
    renderLayout()
    await act(async () => { await Promise.resolve() })
    expect(countOverdue).toHaveBeenCalledTimes(1)

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    window.dispatchEvent(new Event('followups:changed'))
    window.dispatchEvent(new Event('followups:changed'))
    expect(countOverdue).toHaveBeenCalledTimes(1)

    await act(async () => { resolveFirst(0) })
    await act(async () => { await Promise.resolve() })

    expect(countOverdue).toHaveBeenCalledTimes(2)
    expect(bell().getAttribute('aria-label')).toBe('Follow-ups atrasados: 1')
    expect(within(bell()).getByText('1')).toBeTruthy()
  })

  it('remove o timer e o listener do sino ao desmontar o layout', async () => {
    vi.useFakeTimers()
    const { unmount } = renderLayout()
    await act(async () => { await Promise.resolve() })
    expect(countOverdue).toHaveBeenCalledTimes(1)

    unmount()
    window.dispatchEvent(new Event('followups:changed'))
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })

    expect(countOverdue).toHaveBeenCalledTimes(1)
  })

  it('atualiza o sino ao concluir o último atrasado sem trocar de rota', async () => {
    const pending: Followup = {
      id: '00000000-0000-0000-0000-000000000301',
      lead_id: '00000000-0000-0000-0000-000000000101',
      owner_id: '00000000-0000-0000-0000-000000000201',
      due_at: '2026-11-24T12:00:00.000Z',
      reason: 'Retornar proposta',
      note: null,
      status: 'pendente',
      completed_at: null,
      result: null,
      created_at: '2026-11-23T12:00:00.000Z',
      updated_at: '2026-11-23T12:00:00.000Z',
    }
    vi.mocked(countOverdue).mockResolvedValueOnce(1).mockResolvedValueOnce(0)
    vi.mocked(completeFollowup).mockResolvedValue({ ...pending, status: 'concluido', result: 'Pediu retorno' })
    renderLayout(['/followups'], (
      <FollowupItem followup={pending} now={Date.parse('2026-11-25T18:00:00.000Z')} onChanged={() => {}} />
    ))
    await waitFor(() => expect(within(bell()).getByText('1')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /^Concluir follow-up/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conclusão' }))

    await waitFor(() => expect(completeFollowup).toHaveBeenCalledWith(pending.id, null))
    await waitFor(() => expect(countOverdue).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(bell().getAttribute('aria-label')).toBe('Follow-ups atrasados: 0'))
    expect(within(bell()).queryByText('1')).toBeNull()
  })

  it('exibe os nove links navegáveis na ordem e mantém Follow-ups apenas no sino', async () => {
    renderLayout()
    await waitFor(() => expect(countOverdue).toHaveBeenCalled())

    const nav = screen.getByRole('navigation')
    const links = within(nav).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([
      'Dashboard', 'Leads', 'Oportunidades', 'Pipeline', 'Clientes', 'Projetos',
      'Financeiro', 'Relatórios', 'Configurações',
    ])
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/', '/leads', '/oportunidades', '/pipeline', '/clientes', '/projetos',
      '/financeiro', '/relatorios', '/configuracoes',
    ])
    expect(within(nav).queryByRole('link', { name: 'Follow-ups' })).toBeNull()
    expect(screen.getByText('Etapa 3 — clientes, projetos e financeiro.')).toBeTruthy()
  })
})
