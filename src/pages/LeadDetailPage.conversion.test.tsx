// @vitest-environment jsdom
// src/pages/LeadDetailPage.conversion.test.tsx
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyLeadDraft, type Lead } from '../types/lead'
import type { LeadClientLink } from '../types/client'

const {
  getLead, setLeadStatus, getLeadClientLink, convertLeadToClient, listActivities,
  listChecks, setCheck, listByLead, completeFollowup, cancelFollowup, toast,
} = vi.hoisted(() => ({
  getLead: vi.fn(),
  setLeadStatus: vi.fn(),
  getLeadClientLink: vi.fn(),
  convertLeadToClient: vi.fn(),
  listActivities: vi.fn(),
  listChecks: vi.fn(),
  setCheck: vi.fn(),
  listByLead: vi.fn(),
  completeFollowup: vi.fn(),
  cancelFollowup: vi.fn(),
  toast: vi.fn(),
}))
vi.mock('../services/leadService', () => ({ getLead, setLeadStatus }))
vi.mock('../services/clientService', () => ({ getLeadClientLink, convertLeadToClient }))
vi.mock('../services/activityService', () => ({ listActivities }))
vi.mock('../services/digitalCheckService', () => ({ listChecks, setCheck }))
vi.mock('../services/followupService', () => ({ listByLead, completeFollowup, cancelFollowup }))
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ toast }) }))
vi.mock('../components/leads/ContactDialog', () => ({ ContactDialog: () => null }))
vi.mock('../components/leads/FollowupDialog', () => ({ FollowupDialog: () => null }))
vi.mock('../components/leads/WhatsAppDialog', () => ({ WhatsAppDialog: () => null }))
vi.mock('../components/leads/OpportunityPanel', () => ({ OpportunityPanel: () => null }))

import { LeadDetailPage } from './LeadDetailPage'

const lead: Lead = {
  ...emptyLeadDraft(),
  id: 'lead-1',
  owner_id: 'owner-1',
  name: 'Empresa Teste',
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

const clientLink: LeadClientLink = {
  id: 'link-1',
  owner_id: lead.owner_id,
  lead_id: lead.id,
  client_id: 'client-1',
  converted_at: '2026-11-25T12:00:00Z',
  created_at: '2026-11-25T12:00:00Z',
}

function renderLeadDetail() {
  return render(
    <MemoryRouter initialEntries={['/leads/lead-1']}>
      <Routes>
        <Route path="/leads/:id" element={<LeadDetailPage />} />
        <Route path="/clientes/:id" element={<div>Ficha do cliente</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(cleanup)

describe('LeadDetailPage — conversão', () => {
  beforeEach(() => {
    getLead.mockReset().mockResolvedValue(lead)
    setLeadStatus.mockReset()
    getLeadClientLink.mockReset().mockResolvedValue(null)
    convertLeadToClient.mockReset()
    listActivities.mockReset().mockResolvedValue([])
    listChecks.mockReset().mockResolvedValue([])
    setCheck.mockReset().mockResolvedValue(undefined)
    listByLead.mockReset().mockResolvedValue([])
    completeFollowup.mockReset()
    cancelFollowup.mockReset()
    toast.mockReset()
  })

  it('mostra Converter em cliente, abre o diálogo real e preserva o foco ao cancelar', async () => {
    renderLeadDetail()
    const opener = await screen.findByRole('button', { name: 'Converter em cliente' })

    expect(getLead).toHaveBeenCalledTimes(1)
    expect(getLead).toHaveBeenCalledWith(lead.id)
    expect(getLeadClientLink).toHaveBeenCalledTimes(1)
    expect(getLeadClientLink).toHaveBeenCalledWith(lead.id)

    opener.focus()
    fireEvent.click(opener)
    expect(screen.getByRole('dialog', { name: 'Converter lead em cliente' })).toBeTruthy()
    expect((screen.getByLabelText('Status') as HTMLSelectElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(document.activeElement).toBe(opener))
    expect((screen.getByLabelText('Status') as HTMLSelectElement).disabled).toBe(false)
  })

  it('mostra Ver cliente e não repete a conversão quando existe vínculo real', async () => {
    getLeadClientLink.mockResolvedValue(clientLink)
    renderLeadDetail()

    const link = await screen.findByRole('link', { name: 'Ver cliente' })
    expect(link.getAttribute('href')).toBe('/clientes/client-1')
    expect(screen.queryByRole('button', { name: 'Converter em cliente' })).toBeNull()
    expect(convertLeadToClient).not.toHaveBeenCalled()
  })

  it('recarrega lead e vínculo no mesmo ciclo após conversão confirmada', async () => {
    getLead.mockResolvedValueOnce(lead).mockResolvedValueOnce({ ...lead, status: 'aceitou' })
    getLeadClientLink.mockResolvedValueOnce(null).mockResolvedValueOnce(clientLink)
    convertLeadToClient.mockResolvedValue({
      client_id: clientLink.client_id,
      link_id: clientLink.id,
      contract_id: 'contract-1',
      project_id: null,
      already_existed: false,
    })
    listActivities.mockResolvedValueOnce([]).mockResolvedValueOnce([{
      id: 'activity-conversion', lead_id: lead.id, owner_id: lead.owner_id,
      type: 'conversao', description: 'Lead convertido em cliente.', user_id: null, created_at: '2026-11-25T12:00:00Z',
    }])
    renderLeadDetail()

    fireEvent.click(await screen.findByRole('button', { name: 'Converter em cliente' }))
    fireEvent.change(screen.getByLabelText('Serviço contratado *'), { target: { value: 'Site' } })
    fireEvent.change(screen.getByLabelText('Valor contratado *'), { target: { value: '1000,00' } })
    fireEvent.change(screen.getByLabelText('Data da contratação *'), { target: { value: '2026-11-25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conversão' }))

    const convertedLink = await screen.findByRole('link', { name: 'Ver cliente' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('heading', { name: lead.name })).toBeTruthy()
    expect(await screen.findByText('Lead convertido em cliente.')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(convertedLink))
    expect(convertLeadToClient).toHaveBeenCalledWith(lead.id, {
      service: 'Site',
      contractedValueCents: 100000,
      contractedAt: '2026-11-25',
      paymentMethod: '',
      paymentTerms: '',
      notes: '',
      project: null,
    })
    expect(getLead).toHaveBeenCalledTimes(2)
    expect(getLeadClientLink).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(listActivities).toHaveBeenCalledTimes(2))
  })

  it('preserva Ver cliente e o vínculo conhecido quando o refresh em background falha', async () => {
    const updated = { ...lead, status: 'interessado' as const }
    getLead.mockResolvedValueOnce(lead).mockResolvedValueOnce(updated)
    getLeadClientLink.mockResolvedValueOnce(clientLink).mockRejectedValueOnce(new Error('Falha temporária.'))
    setLeadStatus.mockResolvedValue(updated)
    renderLeadDetail()

    const link = await screen.findByRole('link', { name: 'Ver cliente' })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'interessado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mudar status' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Falha temporária.')
    expect(screen.getByRole('link', { name: 'Ver cliente' })).toBe(link)
    expect(screen.queryByRole('button', { name: 'Converter em cliente' })).toBeNull()
  })

  it('bloqueia a conversão quando lead e vínculo falham juntos em background', async () => {
    const updated = { ...lead, status: 'interessado' as const }
    getLead.mockResolvedValueOnce(lead).mockRejectedValueOnce(new Error('Falha ao atualizar lead.'))
    getLeadClientLink.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('Falha ao atualizar vínculo.'))
    setLeadStatus.mockResolvedValue(updated)
    renderLeadDetail()

    const converter = await screen.findByRole('button', { name: 'Converter em cliente' })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'interessado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mudar status' }))

    expect(await screen.findByText('Falha ao atualizar vínculo.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: lead.name })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Converter em cliente' }) as HTMLButtonElement).disabled).toBe(true)
    expect(converter.isConnected).toBe(true)
  })

  it('exibe o vínculo novo mesmo quando o refresh do lead falha', async () => {
    const updated = { ...lead, status: 'interessado' as const }
    getLead.mockResolvedValueOnce(lead).mockRejectedValueOnce(new Error('Falha ao atualizar lead.'))
    getLeadClientLink.mockResolvedValueOnce(null).mockResolvedValueOnce(clientLink)
    setLeadStatus.mockResolvedValue(updated)
    renderLeadDetail()

    await screen.findByRole('button', { name: 'Converter em cliente' })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'interessado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mudar status' }))

    expect(await screen.findByRole('link', { name: 'Ver cliente' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: lead.name })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Converter em cliente' })).toBeNull()
  })

  it('não trata falha do vínculo como não convertido e permite retry do ciclo completo', async () => {
    getLeadClientLink.mockRejectedValueOnce(new Error('Falha ao consultar vínculo.')).mockResolvedValueOnce(clientLink)
    renderLeadDetail()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Não foi possível verificar o vínculo com o cliente.')
    expect(alert.textContent).toContain('Falha ao consultar vínculo.')
    expect((screen.getByRole('button', { name: 'Converter em cliente' }) as HTMLButtonElement).disabled).toBe(true)
    expect(convertLeadToClient).not.toHaveBeenCalled()

    fireEvent.click(within(alert).getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('link', { name: 'Ver cliente' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(getLead).toHaveBeenCalledTimes(2)
    expect(getLeadClientLink).toHaveBeenCalledTimes(2)
  })

  it('atualiza lead, vínculo e histórico juntos em background após mudança de status', async () => {
    const updated = { ...lead, status: 'interessado' as const }
    getLead.mockResolvedValueOnce(lead).mockResolvedValueOnce(updated)
    setLeadStatus.mockResolvedValue(updated)
    listActivities.mockResolvedValueOnce([]).mockResolvedValueOnce([{
      id: 'activity-status', lead_id: lead.id, owner_id: lead.owner_id,
      type: 'mudanca_status', description: 'Status alterado para Interessado.', user_id: null,
      created_at: '2026-11-25T12:01:00Z',
    }])
    renderLeadDetail()
    await screen.findByRole('heading', { name: lead.name })

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'interessado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mudar status' }))

    await waitFor(() => expect(getLead).toHaveBeenCalledTimes(2))
    expect(getLeadClientLink).toHaveBeenCalledTimes(2)
    expect(setLeadStatus).toHaveBeenCalledWith(lead.id, 'interessado')
    expect(await screen.findByText('Status alterado para Interessado.')).toBeTruthy()
    await waitFor(() => expect(listActivities).toHaveBeenCalledTimes(2))
  })

  it('atualiza o histórico e os follow-ups após marcar uma verificação digital', async () => {
    listActivities.mockResolvedValueOnce([]).mockResolvedValueOnce([{
      id: 'activity-check', lead_id: lead.id, owner_id: lead.owner_id,
      type: 'observacao', description: 'Instagram confirmado no checklist.', user_id: null,
      created_at: '2026-11-25T12:02:00Z',
    }])
    renderLeadDetail()

    const check = await screen.findByRole('button', { name: /Instagram verificado/ })
    fireEvent.click(check)

    expect(await screen.findByText('Instagram confirmado no checklist.')).toBeTruthy()
    await waitFor(() => expect(listActivities).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(listByLead).toHaveBeenCalledTimes(2))
    expect(setCheck).toHaveBeenCalledWith(lead.id, 'instagram', true)
  })
})
