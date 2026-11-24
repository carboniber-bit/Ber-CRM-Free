// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastContext } from '../../hooks/useToast'
import { cancelFollowup, completeFollowup, listByLead } from '../../services/followupService'
import type { Followup } from '../../types/followup'
import { LeadFollowups } from './LeadFollowups'

vi.mock('../../services/followupService', () => ({
  listByLead: vi.fn(),
  completeFollowup: vi.fn(),
  cancelFollowup: vi.fn(),
}))

const followup: Followup = {
  id: '00000000-0000-0000-0000-000000000301',
  lead_id: '00000000-0000-0000-0000-000000000101',
  owner_id: '00000000-0000-0000-0000-000000000201',
  due_at: '2026-11-25T12:00:00.000Z',
  reason: 'Retornar proposta',
  note: null,
  status: 'pendente',
  completed_at: null,
  result: null,
  created_at: '2026-11-24T12:00:00.000Z',
  updated_at: '2026-11-24T12:00:00.000Z',
}

const toast = vi.fn()

function renderFollowups() {
  const onChanged = vi.fn()
  const { unmount } = render(
    <ToastContext.Provider value={{ toast }}>
      <LeadFollowups leadId={followup.lead_id} refreshKey={0} onChanged={onChanged} />
    </ToastContext.Provider>,
  )
  return { onChanged, unmount }
}

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listByLead).mockResolvedValue([followup])
})

describe('LeadFollowups mutation results', () => {
  it('não anuncia sucesso quando outra operação já concluiu o follow-up', async () => {
    vi.mocked(completeFollowup).mockResolvedValue(null)
    const { onChanged } = renderFollowups()

    fireEvent.click(await screen.findByRole('button', { name: /Concluir follow-up/ }))
    fireEvent.change(screen.getByLabelText('Resultado do follow-up (opcional)'), {
      target: { value: 'Pediu retorno' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conclusão' }))

    await waitFor(() => expect(completeFollowup).toHaveBeenCalledWith(followup.id, 'Pediu retorno'))
    expect(toast).toHaveBeenCalledWith('Este follow-up não está mais pendente. Nenhuma alteração foi feita.', 'info')
    expect(toast).not.toHaveBeenCalledWith('Follow-up concluído.')
    expect(onChanged).not.toHaveBeenCalled()
    expect(screen.getByText('Pendente')).toBeTruthy()
  })

  it('usa o registro retornado pela RPC após concluir', async () => {
    const completed = {
      ...followup,
      status: 'concluido' as const,
      completed_at: '2026-11-24T12:30:00.000Z',
      result: 'Pediu retorno',
    }
    vi.mocked(completeFollowup).mockResolvedValue(completed)
    const { onChanged } = renderFollowups()

    fireEvent.click(await screen.findByRole('button', { name: /Concluir follow-up/ }))
    fireEvent.change(screen.getByLabelText('Resultado do follow-up (opcional)'), {
      target: { value: 'Pediu retorno' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conclusão' }))

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(toast).toHaveBeenCalledWith('Follow-up concluído.')
    expect(screen.getByText('Concluído')).toBeTruthy()
  })

  it('não anuncia sucesso quando outra operação já cancelou o follow-up', async () => {
    vi.mocked(cancelFollowup).mockResolvedValue(null)
    const { onChanged } = renderFollowups()

    fireEvent.click(await screen.findByRole('button', { name: /Cancelar follow-up/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar follow-up' }))

    await waitFor(() => expect(cancelFollowup).toHaveBeenCalledWith(followup.id))
    expect(toast).toHaveBeenCalledWith('Este follow-up não está mais pendente. Nenhuma alteração foi feita.', 'info')
    expect(toast).not.toHaveBeenCalledWith('Follow-up cancelado.')
    expect(onChanged).not.toHaveBeenCalled()
    expect(screen.getByText('Pendente')).toBeTruthy()
  })

  it('não notifica estado obsoleto após unmount durante a conclusão', async () => {
    let resolveMutation!: (value: Followup | null) => void
    vi.mocked(completeFollowup).mockReturnValue(new Promise((resolve) => { resolveMutation = resolve }))
    const { onChanged, unmount } = renderFollowups()

    fireEvent.click(await screen.findByRole('button', { name: /Concluir follow-up/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conclusão' }))
    await waitFor(() => expect(completeFollowup).toHaveBeenCalled())
    unmount()

    await act(async () => {
      resolveMutation(null)
      await Promise.resolve()
    })

    expect(toast).not.toHaveBeenCalledWith('Este follow-up não está mais pendente. Nenhuma alteração foi feita.', 'info')
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('não notifica estado obsoleto após unmount durante o cancelamento', async () => {
    let resolveMutation!: (value: Followup | null) => void
    vi.mocked(cancelFollowup).mockReturnValue(new Promise((resolve) => { resolveMutation = resolve }))
    const { onChanged, unmount } = renderFollowups()

    fireEvent.click(await screen.findByRole('button', { name: /Cancelar follow-up/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar follow-up' }))
    await waitFor(() => expect(cancelFollowup).toHaveBeenCalled())
    unmount()

    await act(async () => {
      resolveMutation(null)
      await Promise.resolve()
    })

    expect(toast).not.toHaveBeenCalledWith('Este follow-up não está mais pendente. Nenhuma alteração foi feita.', 'info')
    expect(onChanged).not.toHaveBeenCalled()
  })
})
