// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastContext } from '../hooks/useToast'
import { cancelFollowup, completeFollowup, listFollowups } from '../services/followupService'
import { listLeads } from '../services/leadService'
import type { Followup, FollowupList } from '../types/followup'
import type { Lead } from '../types/lead'
import { FollowUpsPage } from './FollowUpsPage'

vi.mock('../services/followupService', () => ({
  listFollowups: vi.fn(),
  completeFollowup: vi.fn(),
  cancelFollowup: vi.fn(),
}))
vi.mock('../services/leadService', () => ({ listLeads: vi.fn() }))

const NAME_WINDOW = 1000
const HOUR = 3_600_000

const toast = vi.fn()

function makeFollowup(overrides: Partial<Followup> = {}): Followup {
  return {
    id: `followup-${overrides.lead_id ?? 'x'}-${overrides.reason ?? 'r'}`,
    lead_id: 'lead-barbearia',
    owner_id: '00000000-0000-0000-0000-000000000201',
    due_at: new Date(Date.now() + HOUR).toISOString(),
    reason: 'Retornar proposta',
    note: null,
    status: 'pendente',
    completed_at: null,
    result: null,
    created_at: '2026-11-20T12:00:00.000Z',
    updated_at: '2026-11-20T12:00:00.000Z',
    ...overrides,
  }
}

const hoje = makeFollowup({ id: 'fu-hoje', lead_id: 'lead-barbearia', reason: 'Contato de hoje' })
const futuro = makeFollowup({ id: 'fu-futuro', lead_id: 'lead-pizzaria', reason: 'Contato futuro', due_at: new Date(Date.now() + 48 * HOUR).toISOString() })
const atrasado = makeFollowup({ id: 'fu-atrasado', lead_id: 'lead-barbearia', reason: 'Contato atrasado', due_at: new Date(Date.now() - 5 * HOUR).toISOString() })

const barbearia = { id: 'lead-barbearia', name: 'Barbearia do Bairro' } as Lead
const pizzaria = { id: 'lead-pizzaria', name: 'Pizzaria Forno a Lenha' } as Lead

function mockLoad(rows: Followup[], leads: Lead[] = [barbearia, pizzaria]) {
  vi.mocked(listFollowups).mockImplementation(async () => rows)
  vi.mocked(listLeads).mockResolvedValue({ leads, total: leads.length })
}

function renderPage() {
  return render(
    <ToastContext.Provider value={{ toast }}>
      <MemoryRouter initialEntries={['/followups']}>
        <Routes>
          <Route path="/followups" element={<FollowUpsPage />} />
          <Route path="/leads/:id" element={<div>Ficha do lead</div>} />
        </Routes>
      </MemoryRouter>
    </ToastContext.Provider>,
  )
}

function listQueries() {
  return vi.mocked(listFollowups).mock.calls.map((call) => call[0])
}

function itemFor(reason: string): HTMLElement {
  return screen.getByText(reason).closest('li') as HTMLElement
}

let consoleError: ReturnType<typeof vi.spyOn>
let consoleWarn: ReturnType<typeof vi.spyOn>

afterEach(() => {
  cleanup()
  // Nenhum caminho renderizado pode gerar aviso de console (act, resposta fora do ato).
  expect(consoleError).not.toHaveBeenCalled()
  expect(consoleWarn).not.toHaveBeenCalled()
  consoleError.mockRestore()
  consoleWarn.mockRestore()
})

beforeEach(() => {
  vi.clearAllMocks()
  consoleError = vi.spyOn(console, 'error')
  consoleWarn = vi.spyOn(console, 'warn')
  mockLoad([hoje, futuro])
})

describe('FollowUpsPage abas e consulta', () => {
  it('abre na aba Hoje pedindo a própria lista e o mapa de nomes dos leads', async () => {
    renderPage()
    await screen.findByText('Contato de hoje')

    expect(listFollowups).toHaveBeenCalledWith('today')
    expect(listLeads).toHaveBeenCalledWith({}, 'created_desc', 0, NAME_WINDOW)
    expect(screen.getByRole('button', { name: 'Hoje' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Atrasados' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('cada aba pede o próprio valor de FollowupList', async () => {
    renderPage()
    await screen.findByText('Contato de hoje')

    const expected: Array<[string, FollowupList]> = [
      ['Atrasados', 'overdue'],
      ['Futuros', 'upcoming'],
      ['Concluídos', 'done'],
      ['Hoje', 'today'],
    ]
    for (const [label, value] of expected) {
      fireEvent.click(screen.getByRole('button', { name: label }))
      await waitFor(() => expect(listQueries()).toContain(value))
      expect(screen.getByRole('button', { name: label }).getAttribute('aria-pressed')).toBe('true')
    }

    // Quatro trocas de aba, quatro consultas: a aba ativa não recarrega sozinha.
    expect(listQueries()).toEqual(['today', 'overdue', 'upcoming', 'done', 'today'])
  })

  it('Atualizar repete a consulta da aba ativa', async () => {
    renderPage()
    await screen.findByText('Contato de hoje')

    fireEvent.click(screen.getByRole('button', { name: 'Atrasados' }))
    await waitFor(() => expect(listQueries()).toEqual(['today', 'overdue']))
    const before = listQueries().length

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    await waitFor(() => expect(listQueries()).toHaveLength(before + 1))
    expect(listQueries().at(-1)).toBe('overdue')
  })
})

describe('FollowUpsPage linhas', () => {
  it('destaca o pendente com data passada e não destaca o futuro', async () => {
    mockLoad([hoje, atrasado, futuro])
    renderPage()
    await screen.findByText('Contato de hoje')

    const atrasadoItem = itemFor('Contato atrasado')
    expect(atrasadoItem.className).toContain('border-danger/40')
    expect(atrasadoItem.textContent).toContain('· atrasado')
    expect(atrasadoItem.textContent).toContain('Barbearia do Bairro')

    const futuroItem = itemFor('Contato futuro')
    expect(futuroItem.className).not.toContain('border-danger/40')
    expect(futuroItem.textContent).not.toContain('atrasado')
    expect(futuroItem.textContent).toContain('Pizzaria Forno a Lenha')
  })

  it('liga cada linha à ficha do lead certo e não aninha controle em link', async () => {
    mockLoad([hoje, futuro])
    const { container } = renderPage()
    await screen.findByText('Contato de hoje')

    expect(within(itemFor('Contato de hoje')).getByRole('link', { name: 'Barbearia do Bairro' }).getAttribute('href'))
      .toBe('/leads/lead-barbearia')
    expect(within(itemFor('Contato futuro')).getByRole('link', { name: 'Pizzaria Forno a Lenha' }).getAttribute('href'))
      .toBe('/leads/lead-pizzaria')
    expect(container.querySelectorAll('a button, a a')).toHaveLength(0)
  })

  it('nome fora da janela carregada não afirma que o lead foi removido', async () => {
    mockLoad([makeFollowup({ id: 'fu-orfao', lead_id: 'lead-fora-da-janela', reason: 'Contato sem nome' })], [barbearia])
    renderPage()
    await screen.findByText('Contato sem nome')

    const item = itemFor('Contato sem nome')
    expect(item.textContent).toContain('Lead não carregado nesta lista')
    expect(item.textContent).not.toMatch(/removido|exclu/i)
    // O link continua apontando para a ficha: o id existe, só o nome não veio.
    expect(item.querySelector('a')?.getAttribute('href')).toBe('/leads/lead-fora-da-janela')
  })

  it('conclui com resultado aparado pela linha e recarrega a aba', async () => {
    vi.mocked(completeFollowup).mockResolvedValue(makeFollowup({ id: 'fu-hoje', status: 'concluido' }))
    renderPage()
    await screen.findByText('Contato de hoje')

    fireEvent.click(within(itemFor('Contato de hoje')).getByRole('button', { name: /^Concluir follow-up/ }))
    fireEvent.change(screen.getByLabelText('Resultado do follow-up (opcional)'), {
      target: { value: '  Ligou de volta  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conclusão' }))

    await waitFor(() => expect(completeFollowup).toHaveBeenCalledWith('fu-hoje', 'Ligou de volta'))
    expect(toast).toHaveBeenCalledWith('Follow-up concluído.')
    await waitFor(() => expect(listQueries().filter((list) => list === 'today').length).toBe(2))
  })

  it('não anuncia conclusão nem recarrega quando a RPC devolve null', async () => {
    vi.mocked(completeFollowup).mockResolvedValue(null)
    renderPage()
    await screen.findByText('Contato de hoje')
    const before = listQueries().length

    fireEvent.click(within(itemFor('Contato de hoje')).getByRole('button', { name: /^Concluir follow-up/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conclusão' }))

    await waitFor(() => expect(completeFollowup).toHaveBeenCalled())
    expect(toast).toHaveBeenCalledWith(
      'Este follow-up não está mais pendente. Nenhuma alteração foi feita.',
      'info',
    )
    expect(toast).not.toHaveBeenCalledWith('Follow-up concluído.')
    expect(listQueries()).toHaveLength(before)
    expect(screen.getByText('Contato de hoje')).toBeTruthy()
  })

  it('cancela depois de confirmar e recarrega a aba', async () => {
    vi.mocked(cancelFollowup).mockResolvedValue(makeFollowup({ id: 'fu-hoje', status: 'cancelado' }))
    renderPage()
    await screen.findByText('Contato de hoje')

    fireEvent.click(within(itemFor('Contato de hoje')).getByRole('button', { name: /^Cancelar follow-up/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar follow-up' }))

    await waitFor(() => expect(cancelFollowup).toHaveBeenCalledWith('fu-hoje'))
    expect(toast).toHaveBeenCalledWith('Follow-up cancelado.')
    await waitFor(() => expect(listQueries().filter((list) => list === 'today').length).toBe(2))
  })

  it('não anuncia cancelamento quando a RPC devolve null', async () => {
    vi.mocked(cancelFollowup).mockResolvedValue(null)
    renderPage()
    await screen.findByText('Contato de hoje')
    const before = listQueries().length

    fireEvent.click(within(itemFor('Contato de hoje')).getByRole('button', { name: /^Cancelar follow-up/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar follow-up' }))

    await waitFor(() => expect(cancelFollowup).toHaveBeenCalled())
    expect(toast).toHaveBeenCalledWith(
      'Este follow-up não está mais pendente. Nenhuma alteração foi feita.',
      'info',
    )
    expect(toast).not.toHaveBeenCalledWith('Follow-up cancelado.')
    expect(listQueries()).toHaveLength(before)
  })
})

describe('FollowUpsPage carregando, erro e vazio', () => {
  it('mostra skeletons enquanto consulta e nunca linhas em trânsito', async () => {
    let resolveList!: (rows: Followup[]) => void
    vi.mocked(listFollowups).mockReturnValue(new Promise((resolve) => { resolveList = resolve }))
    const { container } = renderPage()

    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3)
    expect(screen.getByRole('status').textContent).toContain('Carregando follow-ups')
    expect(screen.queryByText('Contato de hoje')).toBeNull()
    expect(screen.queryByText('Nenhum follow-up aqui')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()

    await act(async () => { resolveList([hoje, futuro]) })
    await screen.findByText('Contato de hoje')
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(0)
  })

  it('trocar de aba com resposta em trânsito não pinta linha da aba anterior', async () => {
    const pending = new Map<FollowupList, { promise: Promise<Followup[]>; resolve: (rows: Followup[]) => void }>()
    vi.mocked(listFollowups).mockImplementation((list) => {
      let resolve!: (rows: Followup[]) => void
      const promise = new Promise<Followup[]>((r) => { resolve = r })
      pending.set(list, { promise, resolve })
      return promise
    })
    renderPage()
    await waitFor(() => expect(listQueries()).toEqual(['today']))

    fireEvent.click(screen.getByRole('button', { name: 'Atrasados' }))
    await waitFor(() => expect(listQueries()).toEqual(['today', 'overdue']))

    // A resposta da aba antiga chega depois da troca: nada dela pode aparecer.
    await act(async () => { pending.get('today')?.resolve([hoje]) })
    expect(screen.queryByText('Contato de hoje')).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('Carregando follow-ups')
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(3)

    await act(async () => { pending.get('overdue')?.resolve([atrasado]) })
    await screen.findByText('Contato atrasado')
    expect(screen.queryByText('Contato de hoje')).toBeNull()
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(0)
  })

  it('mostra o erro da consulta em vez de afirmar que não há follow-up', async () => {
    vi.mocked(listFollowups).mockRejectedValue(new Error('Falha de conexão com o Supabase. Verifique sua internet.'))
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Falha de conexão com o Supabase')
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy()
    expect(screen.queryByText('Nenhum follow-up aqui')).toBeNull()
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(0)

    mockLoad([hoje])
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await screen.findByText('Contato de hoje')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('erro na consulta de nomes também é erro, não lista sem lead', async () => {
    vi.mocked(listLeads).mockRejectedValue(new Error('Falha de conexão com o Supabase.'))
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Falha de conexão com o Supabase')
    expect(screen.queryByText('Nenhum follow-up aqui')).toBeNull()
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(0)
  })

  it('cada aba vazia tem o próprio título orientado', async () => {
    mockLoad([])
    renderPage()
    await screen.findByRole('heading', { name: 'Nenhum follow-up aqui' })
    expect(screen.getByText(/Agende follow-ups na ficha de cada lead/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Atrasados' }))
    await screen.findByRole('heading', { name: 'Nenhum follow-up atrasado' })
    expect(screen.getByText(/Tudo em dia/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Concluídos' }))
    await screen.findByRole('heading', { name: 'Nenhum follow-up concluído' })
  })

  it('nenhum texto de cliente ou receita aparece na página', async () => {
    mockLoad([hoje, atrasado, futuro])
    const { container } = renderPage()
    await screen.findByText('Contato de hoje')

    expect(container.textContent).not.toMatch(/cliente|faturamento|recebido|receita|contratado/i)
  })
})
