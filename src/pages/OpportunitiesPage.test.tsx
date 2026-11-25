// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastContext } from '../hooks/useToast'
import { formatBRL } from '../lib/format'
import { emptyLeadDraft, INELIGIBLE_STATUSES, type Lead } from '../types/lead'
import type { Followup } from '../types/followup'
import { createLead, listLeads, updateLead } from '../services/leadService'
import { listFollowups } from '../services/followupService'
import { addActivity } from '../services/activityService'
import { getSettings } from '../services/settingsService'
import { OpportunitiesPage } from './OpportunitiesPage'

vi.mock('../services/leadService', () => ({
  listLeads: vi.fn(),
  createLead: vi.fn(),
  updateLead: vi.fn(),
}))
vi.mock('../services/followupService', () => ({ listFollowups: vi.fn() }))
vi.mock('../services/activityService', () => ({ addActivity: vi.fn(), listActivities: vi.fn() }))
vi.mock('../services/settingsService', () => ({ getSettings: vi.fn() }))

const toast = vi.fn()

let seq = 0
function makeLead(overrides: Partial<Lead> = {}): Lead {
  seq += 1
  return {
    ...emptyLeadDraft(),
    id: `lead-${seq}`,
    owner_id: '00000000-0000-0000-0000-000000000201',
    name: `Lead ${seq}`,
    score: 0,
    priority: 'baixa',
    needs: [],
    score_reasons: [],
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
    ...overrides,
  } as Lead
}

function makeFollowup(overrides: Partial<Followup> = {}): Followup {
  return {
    id: `followup-${seq}`,
    lead_id: 'lead-1',
    owner_id: '00000000-0000-0000-0000-000000000201',
    due_at: '2026-11-20T12:00:00.000Z',
    reason: null,
    note: null,
    status: 'pendente',
    completed_at: null,
    result: null,
    created_at: '2026-11-19T00:00:00.000Z',
    updated_at: '2026-11-19T00:00:00.000Z',
    ...overrides,
  }
}

// Oportunidades reais: devolvidas pela consulta com hasNeeds + excludeStatuses.
const barbearia = makeLead({
  id: 'opp-barbearia',
  name: 'Barbearia do Bairro',
  niche: 'barbearia',
  city: 'São Paulo',
  district: 'Centro',
  status: 'novo',
  score: 85,
  priority: 'muito_alta',
  needs: ['site', 'landing'],
  estimated_value: 800,
  phone: '11999990001',
  instagram: 'https://instagram.com/barbearia-do-bairro',
  has_website: 'no',
  has_instagram: 'yes',
})
const pizzaria = makeLead({
  id: 'opp-pizzaria',
  name: 'Pizzaria Forno a Lenha',
  niche: 'pizzaria',
  city: 'Campinas',
  status: 'follow_up',
  score: 62,
  priority: 'alta',
  needs: ['site', 'cardapio'],
  estimated_value: 400,
  whatsapp: '19999990002',
  has_website: 'no',
  has_digital_menu: 'no',
})
// Está na base, mas nunca em uma oportunidade: status inelegível.
const convertida = makeLead({
  id: 'lead-convertida',
  name: 'Clínica Sorriso',
  niche: 'clinica_estetica',
  status: 'aceitou',
  score: 90,
  priority: 'muito_alta',
  needs: ['site'],
  estimated_value: 99999,
})
// Leads sem necessidade confirmada: entram só na fila, nunca nos cards.
const salao = makeLead({
  id: 'fila-salao', name: 'Salão Novo Olhar', niche: 'salao_beleza',
  status: 'novo', score: 78, priority: 'muito_alta',
})
const doceria = makeLead({
  id: 'fila-doceria', name: 'Doceria da Praça', niche: 'lanchonete',
  status: 'contato_realizado', score: 55, priority: 'alta',
})
const petshop = makeLead({
  id: 'fila-petshop', name: 'Pet Shop Amigo', niche: 'comercio',
  status: 'novo', score: 45, priority: 'media',
})

const defaultOpportunities = [barbearia, pizzaria]
const defaultAll = [barbearia, pizzaria, convertida, salao, doceria, petshop]
const defaultFollowups = [makeFollowup({ lead_id: 'fila-doceria', due_at: '2020-01-01T00:00:00.000Z' })]

const ALL_NAMES = [
  barbearia.name, pizzaria.name, convertida.name, salao.name, doceria.name, petshop.name,
]

function mockQueries(
  { opportunities = defaultOpportunities, all = defaultAll, followups = defaultFollowups }: {
    opportunities?: Lead[]
    all?: Lead[]
    followups?: Followup[]
  } = {},
) {
  vi.mocked(listLeads).mockImplementation(async (filters) => {
    const rows = filters.hasNeeds ? opportunities : all
    return { leads: rows, total: rows.length }
  })
  vi.mocked(listFollowups).mockResolvedValue(followups)
}

function renderPage() {
  return render(
    <ToastContext.Provider value={{ toast }}>
      <MemoryRouter initialEntries={['/oportunidades']}>
        <Routes>
          <Route path="/oportunidades" element={<OpportunitiesPage />} />
          <Route path="/leads/novo" element={<div>Rota de cadastro de lead</div>} />
          <Route path="/leads/:id" element={<LeadRouteSpy />} />
        </Routes>
      </MemoryRouter>
    </ToastContext.Provider>,
  )
}

function LeadRouteSpy() {
  const { id } = useParams()
  return <div>Ficha do lead {id}</div>
}

// Renderiza e aguarda o primeiro card: prova que a consulta terminou.
async function renderLoaded() {
  renderPage()
  await screen.findByRole('button', { name: `Prospectar ${barbearia.name}` })
}

// Só os links da fila "Prospectar hoje" trazem o score no texto acessível.
function queueLinks(): HTMLElement[] {
  return screen.getAllByRole('link', { name: /score \d+/ })
}

function queueNames(): string[] {
  return queueLinks().map((link) => {
    const text = link.textContent ?? ''
    const name = ALL_NAMES.find((candidate) => text.includes(candidate))
    if (!name) throw new Error(`Item da fila sem nome conhecido: ${text}`)
    return name
  })
}

function lastOpportunityQuery(): Record<string, unknown> | undefined {
  const calls = vi.mocked(listLeads).mock.calls.filter((call) => call[0].hasNeeds === true)
  const last = calls.at(-1)
  return last ? { ...last[0] } : undefined
}

afterEach(cleanup)

beforeEach(() => {
  seq = 0
  vi.clearAllMocks()
  vi.mocked(getSettings).mockResolvedValue({
    owner_id: '00000000-0000-0000-0000-000000000201',
    service_prices: { site: 0, landing: 0, cardapio: 0, catalogo: 0, outros: 0 },
    whatsapp_template: 'Olá! Vi que vocês ainda não têm site.',
  })
  mockQueries()
})

describe('OpportunitiesPage consulta', () => {
  it('pede apenas leads com necessidade confirmada e status elegível', async () => {
    await renderLoaded()

    expect(listLeads).toHaveBeenCalledWith(
      { hasNeeds: true, excludeStatuses: INELIGIBLE_STATUSES },
      'score_desc',
      0,
      200,
    )
    expect(listFollowups).toHaveBeenCalledWith('overdue')
  })

  it('renderiza somente os leads devolvidos pela consulta de oportunidades', async () => {
    await renderLoaded()

    expect(screen.getByRole('link', { name: barbearia.name }).getAttribute('href')).toBe(`/leads/${barbearia.id}`)
    expect(screen.getByRole('link', { name: pizzaria.name })).toBeTruthy()
    // Um card por oportunidade: os demais leads da base (sem needs ou já convertidos) não viram card.
    expect(screen.getAllByRole('button', { name: /^Prospectar / })).toHaveLength(2)
    expect(screen.queryByText(convertida.name)).toBeNull()
  })

  it('aplica todos os filtros combinados na consulta de oportunidades', async () => {
    await renderLoaded()

    fireEvent.change(screen.getByLabelText('Nicho'), { target: { value: 'pizzaria' } })
    fireEvent.change(screen.getByLabelText('Necessidade'), { target: { value: 'site' } })
    fireEvent.change(screen.getByLabelText('Prioridade'), { target: { value: 'alta' } })
    fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'nao_prospectado' } })
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Campinas' } })
    fireEvent.change(screen.getByLabelText('Bairro'), { target: { value: 'Centro' } })
    fireEvent.change(screen.getByLabelText('Cadastrado de'), { target: { value: '2026-11-01' } })
    fireEvent.change(screen.getByLabelText('Cadastrado até'), { target: { value: '2026-11-30' } })
    fireEvent.change(screen.getByLabelText('Pontuação mínima'), { target: { value: '60' } })
    fireEvent.change(screen.getByLabelText('Pontuação máxima'), { target: { value: '95' } })

    await waitFor(() => expect(lastOpportunityQuery()).toEqual({
      niche: 'pizzaria',
      need: 'site',
      priority: 'alta',
      situation: 'nao_prospectado',
      city: 'Campinas',
      district: 'Centro',
      createdFrom: '2026-11-01',
      createdTo: '2026-11-30',
      minScore: 60,
      maxScore: 95,
      hasNeeds: true,
      excludeStatuses: INELIGIBLE_STATUSES,
    }))
  })

  it('traduz as opções de necessidade para os filtros de presença', async () => {
    await renderLoaded()

    fireEvent.change(screen.getByLabelText('Necessidade'), { target: { value: 'instagram_sem_site' } })
    await waitFor(() => expect(lastOpportunityQuery()).toEqual({
      instagramWithoutSite: true,
      hasNeeds: true,
      excludeStatuses: INELIGIBLE_STATUSES,
    }))

    fireEvent.change(screen.getByLabelText('Necessidade'), { target: { value: 'sem_site_sem_cardapio' } })
    await waitFor(() => expect(lastOpportunityQuery()).toEqual({
      noSiteNoMenu: true,
      hasNeeds: true,
      excludeStatuses: INELIGIBLE_STATUSES,
    }))

    fireEvent.change(screen.getByLabelText('Necessidade'), { target: { value: '' } })
    await waitFor(() => expect(lastOpportunityQuery()).toEqual({
      hasNeeds: true,
      excludeStatuses: INELIGIBLE_STATUSES,
    }))
  })
})

describe('OpportunitiesPage potencial estimado', () => {
  it('soma apenas o valor estimado dos leads devolvidos pela consulta', async () => {
    renderPage()
    const summary = await screen.findByText(/^2 oportunidades · potencial estimado/)

    expect(summary.textContent).toBe(`2 oportunidades · potencial estimado ${formatBRL(800 + 400)}`)
    expect(summary.textContent).not.toContain(formatBRL(convertida.estimated_value))
  })

  it('apresenta o valor como potencial estimado e nunca como receita ou cliente', async () => {
    mockQueries({ opportunities: [pizzaria] })
    renderPage()
    await screen.findByRole('button', { name: `Prospectar ${pizzaria.name}` })

    expect(screen.getByText(/1 oportunidade ·/)).toBeTruthy()
    expect(screen.getByText(/Potencial estimado R\$\s?400,00/)).toBeTruthy()
    expect(screen.queryByText(/cliente/i)).toBeNull()
    expect(screen.queryByText(/faturamento|receita|recebido/i)).toBeNull()
  })
})

describe('OpportunitiesPage fila Prospectar hoje', () => {
  it('ordena por prioridade e atraso e exclui os status inelegíveis', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Prospectar hoje' })

    expect(queueNames()).toEqual([
      barbearia.name,
      salao.name,
      doceria.name,
      pizzaria.name,
      petshop.name,
    ])
    expect(queueNames()).not.toContain(convertida.name)
  })

  it('mostra no máximo cinco leads na fila do dia', async () => {
    const many = Array.from({ length: 7 }, (_, index) => makeLead({
      id: `muitos-${index}`,
      name: `Estabelecimento ${index + 1}`,
      status: 'novo',
      score: 70 - index,
      priority: 'media',
    }))
    mockQueries({ opportunities: [], all: many })
    renderPage()
    await screen.findByRole('heading', { name: 'Prospectar hoje' })

    expect(queueLinks()).toHaveLength(5)
    expect(screen.queryByText('Estabelecimento 7')).toBeNull()
  })

  it('navega para a ficha do primeiro da fila ao usar Próxima oportunidade', async () => {
    renderPage()
    const button = await screen.findByRole('button', { name: /Próxima oportunidade/ })

    fireEvent.click(button)

    expect(await screen.findByText(`Ficha do lead ${barbearia.id}`)).toBeTruthy()
    expect(createLead).not.toHaveBeenCalled()
  })

  it('esconde a fila quando todos os leads estão em status inelegível', async () => {
    mockQueries({ all: [convertida], followups: [] })
    await renderLoaded()

    expect(screen.queryByRole('heading', { name: 'Prospectar hoje' })).toBeNull()
  })
})

describe('OpportunitiesPage estado vazio e erro', () => {
  it('explica a regra de presença confirmada quando não há oportunidade', async () => {
    mockQueries({ opportunities: [], all: [convertida], followups: [] })
    renderPage()
    await screen.findByRole('heading', { name: 'Nenhuma oportunidade identificada' })

    expect(screen.getByText(/marque 'Não' apenas quando verificado/)).toBeTruthy()
    expect(screen.getByText(/Leads sem dados confirmados não pontuam/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Cadastrar lead' }).getAttribute('href')).toBe('/leads/novo')
    expect(screen.queryAllByRole('button', { name: /^Prospectar / })).toHaveLength(0)
  })

  it('mostra o erro da consulta em vez de afirmar que não há oportunidades', async () => {
    vi.mocked(listLeads).mockRejectedValue(new Error('Falha de conexão com o Supabase. Verifique sua internet.'))
    renderPage()
    const alert = await screen.findByRole('alert')

    expect(alert.textContent).toContain('Falha de conexão com o Supabase')
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Nenhuma oportunidade identificada' })).toBeNull()
  })
})

describe('OpportunitiesPage ações do card', () => {
  it('abre o WhatsApp do lead da card sem criar nada', async () => {
    renderPage()
    const whatsAppButton = await screen.findByRole('button', { name: `Abrir WhatsApp de ${barbearia.name}` })

    await act(async () => {
      fireEvent.click(whatsAppButton)
    })

    const dialog = await screen.findByRole('dialog', { name: 'Abrir WhatsApp' })
    expect(dialog.textContent).toContain(barbearia.name)
    expect(dialog.textContent).toContain('5511999990001')
    expect(createLead).not.toHaveBeenCalled()
    expect(updateLead).not.toHaveBeenCalled()
    expect(addActivity).not.toHaveBeenCalled()
  })

  it('leva o Prospectar para a ficha do lead existente', async () => {
    renderPage()
    const link = await screen.findByRole('link', { name: pizzaria.name })

    expect(link.getAttribute('href')).toBe(`/leads/${pizzaria.id}`)
    fireEvent.click(link)

    expect(await screen.findByText(`Ficha do lead ${pizzaria.id}`)).toBeTruthy()
    expect(createLead).not.toHaveBeenCalled()
    expect(updateLead).not.toHaveBeenCalled()
  })
})
