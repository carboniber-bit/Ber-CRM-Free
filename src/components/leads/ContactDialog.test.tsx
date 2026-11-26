// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STATUS_LABELS, type LeadStatus } from '../../types/lead'

const { addActivity, setLeadStatus, toast } = vi.hoisted(() => ({
  addActivity: vi.fn(),
  setLeadStatus: vi.fn(),
  toast: vi.fn(),
}))
vi.mock('../../services/activityService', () => ({ addActivity }))
vi.mock('../../services/leadService', () => ({ setLeadStatus }))
vi.mock('../../hooks/useToast', () => ({ useToast: () => ({ toast }) }))

import { ContactDialog } from './ContactDialog'

function renderDialog(currentStatus: LeadStatus = 'novo') {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  render(
    <MemoryRouter>
      <ContactDialog
        open
        leadId="lead-1"
        currentStatus={currentStatus}
        onClose={onClose}
        onSaved={onSaved}
      />
    </MemoryRouter>,
  )
  return { onClose, onSaved }
}

afterEach(cleanup)

beforeEach(() => {
  addActivity.mockReset().mockResolvedValue({})
  setLeadStatus.mockReset().mockResolvedValue({})
  toast.mockReset()
})

describe('ContactDialog', () => {
  it('não oferece conversão, mudança de status ou follow-up como atividade manual', () => {
    renderDialog()
    const select = screen.getByLabelText('Tipo de atividade')
    const values = within(select).getAllByRole('option').map((option) => (option as HTMLOptionElement).value)

    expect(values).toContain('primeiro_contato')
    expect(values).not.toContain('conversao')
    expect(values).not.toContain('mudanca_status')
    expect(values).not.toContain('follow_up')
  })

  it('exige descrição antes de registrar', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))

    expect(screen.getByText('Descreva o contato ou observação.')).toBeTruthy()
    expect(addActivity).not.toHaveBeenCalled()
  })

  it('registra o contato sem mudar o status quando nenhum status é escolhido', async () => {
    const { onClose, onSaved } = renderDialog()
    fireEvent.change(screen.getByLabelText('Tipo de atividade'), { target: { value: 'mensagem' } })
    fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Mensagem combinada.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))

    await waitFor(() => expect(addActivity).toHaveBeenCalledWith('lead-1', 'mensagem', 'Mensagem combinada.'))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(setLeadStatus).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('Contato registrado.')
  })

  it('confirma explicitamente a mudança de status antes de gravar', async () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Cliente pediu proposta.' } })
    fireEvent.change(screen.getByLabelText('Mudar status para (opcional — confirmação explícita)'), {
      target: { value: 'negociando' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))

    const confirmation = screen.getByRole('dialog', { name: 'Confirmar registro e mudança de status' })
    expect(confirmation.textContent).toContain(`${STATUS_LABELS.novo} para ${STATUS_LABELS.negociando}`)
    expect(addActivity).not.toHaveBeenCalled()
    expect(setLeadStatus).not.toHaveBeenCalled()

    fireEvent.click(within(confirmation).getByRole('button', { name: 'Confirmar e registrar' }))
    await waitFor(() => expect(addActivity).toHaveBeenCalledWith('lead-1', 'primeiro_contato', 'Cliente pediu proposta.'))
    await waitFor(() => expect(setLeadStatus).toHaveBeenCalledWith('lead-1', 'negociando'))
  })

  it('não grava quando a confirmação de status é cancelada', () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Conversa registrada.' } })
    fireEvent.change(screen.getByLabelText('Mudar status para (opcional — confirmação explícita)'), {
      target: { value: 'interessado' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    const confirmation = screen.getByRole('dialog', { name: 'Confirmar registro e mudança de status' })
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog', { name: 'Confirmar registro e mudança de status' })).toBeNull()
    expect(addActivity).not.toHaveBeenCalled()
    expect(setLeadStatus).not.toHaveBeenCalled()
  })

  it('repete somente a mudança de status quando o contato já foi gravado', async () => {
    const { onSaved } = renderDialog()
    setLeadStatus.mockRejectedValueOnce(new Error('Status indisponível.')).mockResolvedValueOnce({})
    fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Contato já registrado.' } })
    fireEvent.change(screen.getByLabelText('Mudar status para (opcional — confirmação explícita)'), {
      target: { value: 'negociando' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e registrar' }))

    expect((await screen.findByText(/O contato foi registrado, mas não foi possível mudar o status/)).textContent)
      .toContain('O contato foi registrado, mas não foi possível mudar o status.')
    expect(addActivity).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Repetir mudança de status' }))

    await waitFor(() => expect(setLeadStatus).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(addActivity).toHaveBeenCalledTimes(1)
  })
})
