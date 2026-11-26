// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyLeadDraft, type Lead, type LeadWrite } from '../../types/lead'

const { createLead, updateLead, findDuplicateCandidates, getSettings } = vi.hoisted(() => ({
  createLead: vi.fn(),
  updateLead: vi.fn(),
  findDuplicateCandidates: vi.fn(),
  getSettings: vi.fn(),
}))
vi.mock('../../services/leadService', () => ({ createLead, updateLead, findDuplicateCandidates }))
vi.mock('../../services/settingsService', () => ({ getSettings }))

import { LeadForm } from './LeadForm'

const lead: Lead = {
  ...emptyLeadDraft(),
  id: 'lead-1',
  owner_id: 'owner-1',
  name: 'Estabelecimento de teste',
  phone: '11999999999',
  status: 'novo',
  next_contact_at: null,
  last_verified_at: null,
  score: 0,
  priority: 'media',
  needs: [],
  score_reasons: [],
  created_at: '2026-11-25T12:00:00Z',
  updated_at: '2026-11-25T12:00:00Z',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

function renderForm(options: { leadId?: string; financialFieldsLocked?: boolean; initial?: LeadWrite } = {}) {
  const onSaved = vi.fn()
  const view = render(
    <MemoryRouter>
      <LeadForm
        initial={options.initial ?? { ...emptyLeadDraft(), name: lead.name, status: 'novo' }}
        leadId={options.leadId}
        financialFieldsLocked={options.financialFieldsLocked}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />
    </MemoryRouter>,
  )
  return { onSaved, unmount: view.unmount }
}

afterEach(cleanup)

beforeEach(() => {
  createLead.mockReset()
  updateLead.mockReset().mockResolvedValue(lead)
  findDuplicateCandidates.mockReset().mockResolvedValue([])
  getSettings.mockReset().mockResolvedValue({
    owner_id: 'owner-1',
    service_prices: { site: 0, landing: 0, cardapio: 0, catalogo: 0, outros: 0 },
    whatsapp_template: '',
  })
})

describe('LeadForm', () => {
  it('salva o link exato do Maps e normaliza um usuário do Instagram', async () => {
    createLead.mockResolvedValue(lead)
    renderForm()
    fireEvent.change(screen.getByLabelText('Google Maps (link exato)'), {
      target: { value: 'maps.app.goo.gl/exemplo' },
    })
    fireEvent.change(screen.getByLabelText('Instagram (link ou @usuario)'), {
      target: { value: '@perfil.exemplo' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar lead' }))

    await waitFor(() => expect(createLead).toHaveBeenCalledWith(expect.objectContaining({
      maps_url: 'https://maps.app.goo.gl/exemplo',
      instagram: 'https://www.instagram.com/perfil.exemplo/',
    })))
  })

  it('não permite mudar status diretamente ao editar', () => {
    renderForm({ leadId: lead.id })
    expect((screen.getByLabelText('Status') as HTMLSelectElement).disabled).toBe(true)
    expect(screen.getByText(/Use a ficha do lead para alterar o status com confirmação/)).toBeTruthy()
  })

  it('permite escolher o status inicial no cadastro', () => {
    renderForm()
    expect((screen.getByLabelText('Status') as HTMLSelectElement).disabled).toBe(false)
  })

  it('mantém valores financeiros editáveis por padrão', () => {
    renderForm()
    expect((screen.getByLabelText('Valor contratado (R$)') as HTMLInputElement).disabled).toBe(false)
    expect((screen.getByLabelText('Valor recebido (R$)') as HTMLInputElement).disabled).toBe(false)
    expect(screen.queryByText(/Após a conversão, contrato e recebimentos/)).toBeNull()
  })

  it('trava somente contrato e recebimento de lead convertido', () => {
    renderForm({ leadId: lead.id, financialFieldsLocked: true })

    expect((screen.getByLabelText('Valor contratado (R$)') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText('Valor recebido (R$)') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText('Nome do estabelecimento *') as HTMLInputElement).disabled).toBe(false)
    expect((screen.getByLabelText('Telefone') as HTMLInputElement).disabled).toBe(false)
    expect(screen.getByText('Após a conversão, contrato e recebimentos são gerenciados no cliente.')).toBeTruthy()
  })

  it('preserva os valores bloqueados ao salvar alterações não financeiras', async () => {
    renderForm({
      leadId: lead.id,
      financialFieldsLocked: true,
      initial: { ...emptyLeadDraft(), name: lead.name, phone: lead.phone, status: 'novo', contracted_value: 1500, received_value: 500 },
    })
    fireEvent.change(screen.getByLabelText('Nome do estabelecimento *'), { target: { value: 'Nome atualizado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(updateLead).toHaveBeenCalledWith(lead.id, expect.objectContaining({
      name: 'Nome atualizado',
      contracted_value: 1500,
      received_value: 500,
    })))
  })

  it('permite alterar contrato e recebimento quando não estão bloqueados', async () => {
    renderForm({ leadId: lead.id, financialFieldsLocked: false })
    fireEvent.change(screen.getByLabelText('Valor contratado (R$)'), { target: { value: '2500' } })
    fireEvent.change(screen.getByLabelText('Valor recebido (R$)'), { target: { value: '750' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(updateLead).toHaveBeenCalledWith(lead.id, expect.objectContaining({
      contracted_value: 2500,
      received_value: 750,
    })))
  })

  it('não inicia a mutação quando a consulta de duplicidade termina após o unmount', async () => {
    const pending = deferred<Lead[]>()
    findDuplicateCandidates.mockReturnValue(pending.promise)
    const { unmount } = renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar lead' }))
    await waitFor(() => expect(findDuplicateCandidates).toHaveBeenCalledTimes(1))

    unmount()
    await act(async () => {
      pending.resolve([])
      await pending.promise
    })

    expect(createLead).not.toHaveBeenCalled()
    expect(updateLead).not.toHaveBeenCalled()
  })

  it('não chama onSaved quando a mutação termina após o unmount', async () => {
    const pending = deferred<Lead>()
    updateLead.mockReturnValue(pending.promise)
    const { onSaved, unmount } = renderForm({ leadId: lead.id })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(updateLead).toHaveBeenCalledTimes(1))

    unmount()
    await act(async () => {
      pending.resolve(lead)
      await pending.promise
    })

    expect(onSaved).not.toHaveBeenCalled()
  })
})
