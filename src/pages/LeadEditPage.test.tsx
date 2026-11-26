// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LeadClientLink } from '../types/client'
import { emptyLeadDraft, type Lead } from '../types/lead'

const { getLead, createLead, updateLead, findDuplicateCandidates, getLeadClientLink, getSettings, toast } = vi.hoisted(() => ({
  getLead: vi.fn(),
  createLead: vi.fn(),
  updateLead: vi.fn(),
  findDuplicateCandidates: vi.fn(),
  getLeadClientLink: vi.fn(),
  getSettings: vi.fn(),
  toast: vi.fn(),
}))
vi.mock('../services/leadService', () => ({ getLead, createLead, updateLead, findDuplicateCandidates }))
vi.mock('../services/clientService', () => ({ getLeadClientLink }))
vi.mock('../services/settingsService', () => ({ getSettings }))
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ toast }) }))

import { LeadEditPage } from './LeadEditPage'

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    ...emptyLeadDraft(),
    id: 'lead-1',
    owner_id: 'owner-1',
    name: 'Empresa Teste',
    responsible_name: 'Ana Responsável',
    phone: '11999999999',
    instagram: 'https://www.instagram.com/empresa.teste/',
    maps_url: 'https://maps.app.goo.gl/exemplo',
    status: 'aceitou',
    next_contact_at: null,
    last_verified_at: null,
    contracted_value: 1500,
    received_value: 500,
    score: 0,
    priority: 'media',
    needs: [],
    score_reasons: [],
    created_at: '2026-11-25T12:00:00Z',
    updated_at: '2026-11-25T12:00:00Z',
    ...overrides,
  }
}

const lead = makeLead()
const link: LeadClientLink = {
  id: 'link-1',
  owner_id: 'owner-1',
  lead_id: 'lead-1',
  client_id: 'client-1',
  converted_at: '2026-11-25T12:00:00Z',
  created_at: '2026-11-25T12:00:00Z',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

function NavigationControl() {
  const navigate = useNavigate()
  return <button type="button" onClick={() => navigate('/leads/lead-2/edit')}>Abrir lead 2</button>
}

function renderEditPage(initialEntry = '/leads/lead-1/edit', routePath = '/leads/:id/edit') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <NavigationControl />
      <Routes>
        <Route path={routePath} element={<LeadEditPage />} />
        <Route path="/leads/:id" element={<div>Ficha do lead</div>} />
        <Route path="/leads" element={<div>Lista de leads</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(cleanup)

beforeEach(() => {
  getLead.mockReset().mockResolvedValue(lead)
  createLead.mockReset()
  updateLead.mockReset().mockResolvedValue(lead)
  findDuplicateCandidates.mockReset().mockResolvedValue([])
  getLeadClientLink.mockReset().mockResolvedValue(null)
  getSettings.mockReset().mockResolvedValue({
    owner_id: 'owner-1',
    service_prices: { site: 0, landing: 0, cardapio: 0, catalogo: 0, outros: 0 },
    whatsapp_template: '',
  })
  toast.mockReset()
})

describe('LeadEditPage', () => {
  it('carrega lead e vínculo juntos e trava valores de lead convertido', async () => {
    const pendingLead = deferred<Lead>()
    const pendingLink = deferred<LeadClientLink | null>()
    getLead.mockReturnValue(pendingLead.promise)
    getLeadClientLink.mockReturnValue(pendingLink.promise)
    renderEditPage()

    expect(getLead).toHaveBeenCalledWith('lead-1')
    expect(getLeadClientLink).toHaveBeenCalledWith('lead-1')
    expect(screen.getByRole('status').textContent).toBe('Carregando lead…')

    await act(async () => {
      pendingLead.resolve(lead)
      pendingLink.resolve(link)
      await Promise.all([pendingLead.promise, pendingLink.promise])
    })

    expect((await screen.findByLabelText('Nome do estabelecimento *') as HTMLInputElement).value).toBe('Empresa Teste')
    expect((screen.getByLabelText('Valor contratado (R$)') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText('Valor recebido (R$)') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText('Telefone') as HTMLInputElement).disabled).toBe(false)
    expect((screen.getByLabelText('Google Maps (link exato)') as HTMLInputElement).value).toBe('https://maps.app.goo.gl/exemplo')
    expect((screen.getByLabelText('Instagram (link ou @usuario)') as HTMLInputElement).value).toBe('https://www.instagram.com/empresa.teste/')
  })

  it('mantém valores financeiros editáveis quando não existe vínculo', async () => {
    renderEditPage()
    await screen.findByLabelText('Nome do estabelecimento *')

    expect((screen.getByLabelText('Valor contratado (R$)') as HTMLInputElement).disabled).toBe(false)
    expect((screen.getByLabelText('Valor recebido (R$)') as HTMLInputElement).disabled).toBe(false)
  })

  it('não presume lead não convertido quando a consulta do vínculo falha', async () => {
    getLeadClientLink.mockRejectedValueOnce(new Error('Falha ao consultar vínculo.'))
      .mockResolvedValueOnce(null)
    renderEditPage()

    expect((await screen.findByRole('alert')).textContent).toContain('Falha ao consultar vínculo.')
    expect(screen.queryByLabelText('Nome do estabelecimento *')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(await screen.findByLabelText('Nome do estabelecimento *')).toBeTruthy()
    expect(getLeadClientLink).toHaveBeenCalledTimes(2)
  })

  it('salva dados não financeiros sem alterar valores bloqueados e volta à ficha', async () => {
    getLeadClientLink.mockResolvedValue(link)
    renderEditPage()
    fireEvent.change(await screen.findByLabelText('Nome do estabelecimento *'), { target: { value: 'Empresa Editada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(updateLead).toHaveBeenCalledWith('lead-1', expect.objectContaining({
      name: 'Empresa Editada',
      instagram: 'https://www.instagram.com/empresa.teste/',
      maps_url: 'https://maps.app.goo.gl/exemplo',
      contracted_value: 1500,
      received_value: 500,
    })))
    expect(await screen.findByText('Ficha do lead')).toBeTruthy()
    expect(toast).toHaveBeenCalledWith('Alterações salvas.')
  })

  it('apresenta erro e retry quando o lead não pode ser carregado', async () => {
    getLead.mockRejectedValueOnce(new Error('Lead indisponível.')).mockResolvedValueOnce(lead)
    renderEditPage()

    expect((await screen.findByRole('alert')).textContent).toContain('Lead indisponível.')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByLabelText('Nome do estabelecimento *')).toBeTruthy()
  })

  it('apresenta estado vazio quando a rota não informa o id do lead', async () => {
    renderEditPage('/leads', '/leads')
    expect((await screen.findByRole('alert')).textContent).toContain('Lead não encontrado.')
    expect(screen.queryByLabelText('Nome do estabelecimento *')).toBeNull()
    expect(getLead).not.toHaveBeenCalled()
  })

  it('não mostra toast nem navega com um salvamento concluído após trocar de lead', async () => {
    const pendingSave = deferred<Lead>()
    const secondLead = makeLead({ id: 'lead-2', name: 'Empresa Dois' })
    getLead.mockResolvedValueOnce(lead).mockResolvedValueOnce(secondLead)
    updateLead.mockReturnValue(pendingSave.promise)
    renderEditPage()
    fireEvent.change(await screen.findByLabelText('Nome do estabelecimento *'), { target: { value: 'Empresa Editada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(updateLead).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: 'Abrir lead 2' }))
    expect((await screen.findByLabelText('Nome do estabelecimento *') as HTMLInputElement).value).toBe('Empresa Dois')
    await act(async () => {
      pendingSave.resolve(lead)
      await pendingSave.promise
    })

    expect(toast).not.toHaveBeenCalled()
    expect((screen.getByLabelText('Nome do estabelecimento *') as HTMLInputElement).value).toBe('Empresa Dois')
  })

  it('descarta lead e vínculo obsoletos após navegar para outro id', async () => {
    const firstLead = deferred<Lead>()
    const firstLink = deferred<LeadClientLink | null>()
    const secondLead = makeLead({ id: 'lead-2', name: 'Empresa Dois' })
    getLead.mockReturnValueOnce(firstLead.promise).mockResolvedValueOnce(secondLead)
    getLeadClientLink.mockReturnValueOnce(firstLink.promise).mockResolvedValueOnce(null)
    renderEditPage()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir lead 2' }))

    expect((await screen.findByLabelText('Nome do estabelecimento *') as HTMLInputElement).value).toBe('Empresa Dois')
    await act(async () => {
      firstLead.resolve(lead)
      firstLink.resolve(link)
      await Promise.all([firstLead.promise, firstLink.promise])
    })
    expect((screen.getByLabelText('Nome do estabelecimento *') as HTMLInputElement).value).toBe('Empresa Dois')
    expect((screen.getByLabelText('Valor contratado (R$)') as HTMLInputElement).disabled).toBe(false)
  })
})
