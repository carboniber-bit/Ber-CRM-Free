// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Activity } from '../../types/activity'

const { listActivities } = vi.hoisted(() => ({ listActivities: vi.fn() }))
vi.mock('../../services/activityService', () => ({ listActivities }))

import { LeadTimeline } from './LeadTimeline'

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'activity-1',
    lead_id: 'lead-1',
    owner_id: 'owner-1',
    type: 'primeiro_contato',
    description: 'Primeiro contato realizado.',
    user_id: 'user-1',
    created_at: '2026-11-25T12:00:00Z',
    ...overrides,
  }
}

function deferredActivities() {
  let resolve!: (activities: Activity[]) => void
  const promise = new Promise<Activity[]>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

function renderTimeline(leadId = 'lead-1', refreshKey = 0) {
  return render(
    <MemoryRouter>
      <LeadTimeline leadId={leadId} refreshKey={refreshKey} />
    </MemoryRouter>,
  )
}

afterEach(cleanup)

beforeEach(() => {
  listActivities.mockReset().mockResolvedValue([])
})

describe('LeadTimeline', () => {
  it('exibe carregamento acessível antes das atividades', async () => {
    const pending = deferredActivities()
    listActivities.mockReturnValue(pending.promise)
    renderTimeline()

    expect(screen.getByRole('status').textContent).toBe('Carregando histórico de contatos…')
    await act(async () => {
      pending.resolve([])
      await pending.promise
    })
    expect(await screen.findByRole('heading', { name: 'Nenhum contato registrado' })).toBeTruthy()
  })

  it('renderiza conversão com rótulo e ícone próprios', async () => {
    listActivities.mockResolvedValue([
      makeActivity({ type: 'conversao', description: 'Lead convertido em cliente.' }),
    ])
    renderTimeline()

    const list = await screen.findByRole('list', { name: 'Atividades do lead' })
    const item = within(list).getByRole('listitem')
    expect(item.textContent).toContain('Conversão em cliente')
    expect(item.textContent).toContain('Lead convertido em cliente.')
    expect(item.querySelector('svg.lucide-user-check')).not.toBeNull()
    expect(listActivities).toHaveBeenCalledWith('lead-1')
  })

  it('apresenta estado vazio sem criar contatos', async () => {
    renderTimeline()
    expect(await screen.findByRole('heading', { name: 'Nenhum contato registrado' })).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Atividades do lead' })).toBeNull()
  })

  it('mostra erro e permite repetir a leitura', async () => {
    listActivities.mockRejectedValueOnce(new Error('Falha no histórico.'))
      .mockResolvedValueOnce([makeActivity({ description: 'Contato recuperado.' })])
    renderTimeline()

    expect((await screen.findByRole('alert')).textContent).toContain('Falha no histórico.')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Contato recuperado.')).toBeTruthy()
    expect(listActivities).toHaveBeenCalledTimes(2)
  })

  it('recarrega quando refreshKey muda sem remontar nem apagar o histórico válido', async () => {
    const pending = deferredActivities()
    listActivities.mockResolvedValueOnce([makeActivity({ description: 'Versão antiga.' })])
      .mockReturnValueOnce(pending.promise)
    const view = renderTimeline()
    expect(await screen.findByText('Versão antiga.')).toBeTruthy()

    view.rerender(
      <MemoryRouter>
        <LeadTimeline leadId="lead-1" refreshKey={1} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(listActivities).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Versão antiga.')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Atualizando histórico de contatos…')

    await act(async () => {
      pending.resolve([makeActivity({ id: 'activity-2', description: 'Versão nova.' })])
      await pending.promise
    })
    expect(await screen.findByText('Versão nova.')).toBeTruthy()
    expect(screen.queryByText('Versão antiga.')).toBeNull()
  })

  it('preserva o último histórico quando o refresh falha e permite tentar novamente', async () => {
    listActivities.mockResolvedValueOnce([makeActivity({ description: 'Histórico válido.' })])
      .mockRejectedValueOnce(new Error('Falha no refresh.'))
      .mockResolvedValueOnce([makeActivity({ id: 'activity-2', description: 'Histórico atualizado.' })])
    const view = renderTimeline()
    expect(await screen.findByText('Histórico válido.')).toBeTruthy()

    view.rerender(
      <MemoryRouter>
        <LeadTimeline leadId="lead-1" refreshKey={1} />
      </MemoryRouter>,
    )
    expect((await screen.findByRole('alert')).textContent).toContain('Falha no refresh.')
    expect(screen.getByText('Histórico válido.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Histórico atualizado.')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('descarta a resposta de um lead que deixou de ser exibido', async () => {
    const first = deferredActivities()
    const second = deferredActivities()
    listActivities.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const view = renderTimeline('lead-1')
    await waitFor(() => expect(listActivities).toHaveBeenCalledTimes(1))

    view.rerender(
      <MemoryRouter>
        <LeadTimeline leadId="lead-2" refreshKey={0} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(listActivities).toHaveBeenCalledTimes(2))

    await act(async () => {
      second.resolve([makeActivity({ id: 'new', lead_id: 'lead-2', description: 'Atividade do lead 2.' })])
      await second.promise
    })
    expect(await screen.findByText('Atividade do lead 2.')).toBeTruthy()

    await act(async () => {
      first.resolve([makeActivity({ description: 'Atividade obsoleta do lead 1.' })])
      await first.promise
    })
    expect(screen.getByText('Atividade do lead 2.')).toBeTruthy()
    expect(screen.queryByText('Atividade obsoleta do lead 1.')).toBeNull()
  })
})
