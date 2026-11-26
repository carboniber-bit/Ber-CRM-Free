// @vitest-environment jsdom
// src/components/leads/ConversionDialog.test.tsx
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyLeadDraft, type Lead } from '../../types/lead'
import type { ConversionResult } from '../../types/client'
import { ConversionDialog } from './ConversionDialog'

const { convertLeadToClient, toast } = vi.hoisted(() => ({
  convertLeadToClient: vi.fn(),
  toast: vi.fn(),
}))
vi.mock('../../services/clientService', () => ({ convertLeadToClient }))
vi.mock('../../hooks/useToast', () => ({ useToast: () => ({ toast }) }))

const lead: Lead = {
  ...emptyLeadDraft(),
  id: 'lead-1',
  owner_id: 'owner-1',
  name: 'Empresa Teste',
  source: 'Indicação',
  status: 'negociando',
  score: 0,
  priority: 'media',
  needs: [],
  score_reasons: [],
  next_contact_at: null,
  last_verified_at: null,
  created_at: '2026-11-25T12:00:00Z',
  updated_at: '2026-11-25T12:00:00Z',
}

const validResult: ConversionResult = {
  client_id: 'client-1',
  link_id: 'link-1',
  contract_id: 'contract-1',
  project_id: 'project-1',
  already_existed: false,
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function renderDialog(existingClientId: string | null = null) {
  const onClose = vi.fn()
  const onConverted = vi.fn()
  const view = render(
    <ConversionDialog
      open
      lead={lead}
      existingClientId={existingClientId}
      onClose={onClose}
      onConverted={onConverted}
    />,
  )
  return { ...view, onClose, onConverted }
}

function fillConversion() {
  fireEvent.change(screen.getByLabelText('Serviço contratado *'), { target: { value: 'Site institucional' } })
  fireEvent.change(screen.getByLabelText('Valor contratado *'), { target: { value: '1.234,56' } })
  fireEvent.change(screen.getByLabelText('Data da contratação *'), { target: { value: '2026-11-25' } })
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('ConversionDialog', () => {
  beforeEach(() => {
    convertLeadToClient.mockReset()
    toast.mockReset()
  })

  it('usa a data local atual como padrão da contratação', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 25, 23, 45))
    renderDialog()

    expect((screen.getByLabelText('Data da contratação *') as HTMLInputElement).value)
      .toBe('2026-11-25')
  })

  it('bloqueia serviço, valor e data vazios sem chamar a RPC', async () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText('Data da contratação *'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conversão' }))

    expect((await screen.findByText('Informe o serviço contratado.')).textContent)
      .toBe('Informe o serviço contratado.')
    expect(screen.getByText('Informe um valor contratado válido.').textContent)
      .toBe('Informe um valor contratado válido.')
    expect(screen.getByText('Informe a data da contratação.').textContent)
      .toBe('Informe a data da contratação.')
    expect(convertLeadToClient).not.toHaveBeenCalled()
  })

  it('rejeita valor negativo e prazo do projeto anterior ao início', async () => {
    renderDialog()
    fillConversion()
    fireEvent.change(screen.getByLabelText('Valor contratado *'), { target: { value: '-1,00' } })
    fireEvent.click(screen.getByLabelText('Criar projeto inicial'))
    fireEvent.change(screen.getByLabelText('Nome do projeto *'), { target: { value: 'Site da Empresa' } })
    fireEvent.change(screen.getByLabelText('Início do projeto'), { target: { value: '2026-11-26' } })
    fireEvent.change(screen.getByLabelText('Prazo do projeto'), { target: { value: '2026-11-25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conversão' }))

    expect((await screen.findByText('Informe um valor contratado válido.')).textContent)
      .toBe('Informe um valor contratado válido.')
    expect(screen.getByText('O prazo do projeto não pode anteceder o início.').textContent)
      .toBe('O prazo do projeto não pode anteceder o início.')
    expect(convertLeadToClient).not.toHaveBeenCalled()
  })

  it('converte com centavos e projeto opcional sem alterar o lead localmente', async () => {
    convertLeadToClient.mockResolvedValue(validResult)
    const { onConverted } = renderDialog()

    fillConversion()
    fireEvent.change(screen.getByLabelText('Forma de pagamento'), { target: { value: 'pix' } })
    fireEvent.change(screen.getByLabelText('Condições de pagamento'), { target: { value: '50% na assinatura' } })
    fireEvent.change(screen.getByLabelText('Observações da conversão'), { target: { value: 'Contrato confirmado.' } })
    fireEvent.click(screen.getByLabelText('Criar projeto inicial'))
    fireEvent.change(screen.getByLabelText('Nome do projeto *'), { target: { value: 'Site da Empresa' } })
    fireEvent.change(screen.getByLabelText('Início do projeto'), { target: { value: '2026-11-26' } })
    fireEvent.change(screen.getByLabelText('Prazo do projeto'), { target: { value: '2026-12-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conversão' }))

    await waitFor(() => expect(onConverted).toHaveBeenCalledWith(validResult))
    expect(convertLeadToClient).toHaveBeenCalledWith('lead-1', {
      service: 'Site institucional',
      contractedValueCents: 123456,
      contractedAt: '2026-11-25',
      paymentMethod: 'pix',
      paymentTerms: '50% na assinatura',
      notes: 'Contrato confirmado.',
      project: {
        name: 'Site da Empresa',
        startDate: '2026-11-26',
        dueDate: '2026-12-10',
      },
    })
    expect(lead.status).toBe('negociando')
  })

  it('aceita valor zero e envia projeto nulo quando a opção não é marcada', async () => {
    const result = { ...validResult, project_id: null }
    convertLeadToClient.mockResolvedValue(result)
    const { onConverted } = renderDialog()
    fireEvent.change(screen.getByLabelText('Serviço contratado *'), { target: { value: 'Consultoria' } })
    fireEvent.change(screen.getByLabelText('Valor contratado *'), { target: { value: '0,00' } })
    fireEvent.change(screen.getByLabelText('Data da contratação *'), { target: { value: '2026-11-25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conversão' }))

    await waitFor(() => expect(onConverted).toHaveBeenCalledWith(result))
    expect(convertLeadToClient).toHaveBeenCalledWith('lead-1', {
      service: 'Consultoria',
      contractedValueCents: 0,
      contractedAt: '2026-11-25',
      paymentMethod: '',
      paymentTerms: '',
      notes: '',
      project: null,
    })
  })

  it('mostra a mensagem exata quando a RPC retorna uma conversão já existente', async () => {
    const existingResult = { ...validResult, already_existed: true }
    convertLeadToClient.mockResolvedValue(existingResult)
    const { onConverted } = renderDialog()
    fillConversion()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conversão' }))

    await waitFor(() => expect(toast).toHaveBeenCalledWith(
      'Conversão já existente. Os dados anteriores foram preservados.',
    ))
    expect(onConverted).toHaveBeenCalledWith(existingResult)
  })

  it('não confirma um resultado inválido retornado pelo serviço', async () => {
    convertLeadToClient.mockResolvedValue({ ...validResult, link_id: '' })
    const { onConverted } = renderDialog()
    fillConversion()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conversão' }))

    expect((await screen.findByText('Não foi possível converter o lead.')).textContent)
      .toBe('Não foi possível converter o lead.')
    expect(onConverted).not.toHaveBeenCalled()
  })

  it('desabilita campos e fechamento e impede envio duplicado durante o salvamento', async () => {
    const pending = deferred<ConversionResult>()
    convertLeadToClient.mockReturnValue(pending.promise)
    const { onClose, onConverted } = renderDialog()
    fillConversion()
    fireEvent.click(screen.getByLabelText('Criar projeto inicial'))
    fireEvent.change(screen.getByLabelText('Nome do projeto *'), { target: { value: 'Site da Empresa' } })
    const submit = screen.getByRole('button', { name: 'Confirmar conversão' })
    fireEvent.click(submit)
    fireEvent.click(submit)

    await waitFor(() => expect(convertLeadToClient).toHaveBeenCalledTimes(1))
    for (const label of [
      'Serviço contratado *', 'Valor contratado *', 'Data da contratação *',
      'Forma de pagamento', 'Condições de pagamento', 'Observações da conversão',
      'Criar projeto inicial', 'Nome do projeto *', 'Início do projeto', 'Prazo do projeto',
    ]) {
      expect((screen.getByLabelText(label) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).disabled)
        .toBe(true)
    }
    expect((screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true)
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Fechar' })).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).not.toHaveBeenCalled()
    expect(convertLeadToClient).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve(validResult)
      await pending.promise
    })
    await waitFor(() => expect(onConverted).toHaveBeenCalledWith(validResult))
  })

  it('preserva os dados digitados após falha e permite tentar novamente', async () => {
    convertLeadToClient.mockRejectedValueOnce(new Error('Falha temporária.')).mockResolvedValueOnce(validResult)
    const { onConverted } = renderDialog()
    fillConversion()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conversão' }))

    expect((await screen.findByText('Falha temporária.')).textContent).toBe('Falha temporária.')
    expect((screen.getByLabelText('Serviço contratado *') as HTMLInputElement).value)
      .toBe('Site institucional')
    expect((screen.getByLabelText('Valor contratado *') as HTMLInputElement).value).toBe('1.234,56')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conversão' }))
    await waitFor(() => expect(onConverted).toHaveBeenCalledWith(validResult))
    expect(convertLeadToClient).toHaveBeenCalledTimes(2)
  })

  it('descarta a resposta depois do unmount', async () => {
    const pending = deferred<ConversionResult>()
    convertLeadToClient.mockReturnValue(pending.promise)
    const { unmount, onConverted } = renderDialog()
    fillConversion()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conversão' }))
    await waitFor(() => expect(convertLeadToClient).toHaveBeenCalledTimes(1))
    unmount()

    await act(async () => {
      pending.resolve(validResult)
      await pending.promise
    })
    expect(onConverted).not.toHaveBeenCalled()
  })

  it('mostra vínculo existente e não permite nova conversão', () => {
    const { onClose } = renderDialog('client-1')
    expect(screen.getByText('Este lead já está vinculado a um cliente.').textContent)
      .toBe('Este lead já está vinculado a um cliente.')
    expect(screen.queryByRole('button', { name: 'Confirmar conversão' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
