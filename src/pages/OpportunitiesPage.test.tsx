// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastContext } from '../hooks/useToast'
import { formatBRL } from '../lib/format'
import {
  INELIGIBLE_STATUSES, SITUATIONS, SITUATION_LABELS, emptyLeadDraft, situationStatuses,
  type Lead,
} from '../types/lead'
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
// Base da fila: `salao` não tem NENHUMA necessidade confirmada, então não pontua
// e fica fora de "Prospectar hoje"; os demais têm needs e só não saem na consulta
// mockada de oportunidades.
const salao = makeLead({
  id: 'fila-salao', name: 'Salão Novo Olhar', niche: 'salao_beleza',
  status: 'novo', score: 78, priority: 'muito_alta',
})
const doceria = makeLead({
  id: 'fila-doceria', name: 'Doceria da Praça', niche: 'lanchonete',
  status: 'contato_realizado', score: 55, priority: 'alta', needs: ['cardapio'],
})
const petshop = makeLead({
  id: 'fila-petshop', name: 'Pet Shop Amigo', niche: 'comercio',
  status: 'novo', score: 45, priority: 'media', needs: ['site'],
})

const defaultOpportunities = [barbearia, pizzaria]
const defaultAll = [barbearia, pizzaria, convertida, salao, doceria, petshop]
const defaultFollowups = [makeFollowup({ lead_id: 'fila-doceria', due_at: '2020-01-01T00:00:00.000Z' })]

const ALL_NAMES = [
  barbearia.name, pizzaria.name, convertida.name, salao.name, doceria.name, petshop.name,
]

function mockQueries(
  { opportunities = defaultOpportunities, opportunitiesTotal = opportunities.length,
    all = defaultAll, followups = defaultFollowups }: {
    opportunities?: Lead[]
    opportunitiesTotal?: number
    all?: Lead[]
    followups?: Followup[]
  } = {},
) {
  vi.mocked(listLeads).mockImplementation(async (_filters, _sort, _page, pageSize) => {
    const isQueueQuery = pageSize === 1000
    const rows = isQueueQuery ? all : opportunities
    return {
      leads: rows,
      total: isQueueQuery ? rows.length : opportunitiesTotal,
    }
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
  const last = opportunityQueryCalls().at(-1)
  return last ? { ...last[0] } : undefined
}

function opportunityQueryCalls() {
  return vi.mocked(listLeads).mock.calls.filter((call) => call[3] === 200)
}

// A fila usa a mesma elegibilidade, mas paginas de 1000 até completar a base.
function queueBaseQueryCalls() {
  return vi.mocked(listLeads).mock.calls.filter((call) => call[3] === 1000)
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

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

  it('pede a fila base com a consulta fixa e não a recarrega ao filtrar', async () => {
    await renderLoaded()

    // A elegibilidade é aplicada no banco antes da janela; lead ineligível não consome página.
    expect(queueBaseQueryCalls()).toEqual([[
      { hasNeeds: true, excludeStatuses: INELIGIBLE_STATUSES }, 'score_desc', 0, 1000,
    ]])
    expect(vi.mocked(listFollowups).mock.calls).toEqual([['overdue']])

    fireEvent.change(screen.getByLabelText('Nicho'), { target: { value: 'pizzaria' } })
    await waitFor(() => expect(lastOpportunityQuery()?.niche).toBe('pizzaria'))

    expect(queueBaseQueryCalls()).toEqual([[
      { hasNeeds: true, excludeStatuses: INELIGIBLE_STATUSES }, 'score_desc', 0, 1000,
    ]])
    expect(vi.mocked(listFollowups)).toHaveBeenCalledTimes(1)
  })

  it('pagina toda a base elegível antes de montar a fila Prospectar hoje', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => makeLead({
      id: `fila-pagina-1-${index}`,
      name: `Lead da primeira página ${index + 1}`,
      status: 'novo',
      score: 10,
      priority: 'baixa',
      needs: ['site'],
    }))
    const oportunidadeForaDaPrimeiraPagina = makeLead({
      id: 'fila-pagina-2',
      name: 'Oportunidade da segunda página',
      status: 'novo',
      score: 1,
      priority: 'muito_alta',
      needs: ['site'],
    })
    vi.mocked(listLeads).mockImplementation(async (_filters, _sort, page, pageSize) => {
      if (pageSize === 200) return { leads: defaultOpportunities, total: defaultOpportunities.length }
      return page === 0
        ? { leads: firstPage, total: 1001 }
        : { leads: [oportunidadeForaDaPrimeiraPagina], total: 1001 }
    })
    vi.mocked(listFollowups).mockResolvedValue([])
    renderPage()
    await screen.findByRole('heading', { name: 'Prospectar hoje' })

    expect(queueBaseQueryCalls()).toEqual([
      [{ hasNeeds: true, excludeStatuses: INELIGIBLE_STATUSES }, 'score_desc', 0, 1000],
      [{ hasNeeds: true, excludeStatuses: INELIGIBLE_STATUSES }, 'score_desc', 1, 1000],
    ])
    expect(queueLinks()[0]?.textContent).toContain(oportunidadeForaDaPrimeiraPagina.name)
  })

  it('interrompe a paginação da fila quando a consulta de follow-ups falha', async () => {
    let resolveFirstPage!: (value: { leads: Lead[]; total: number }) => void
    const firstPage = Array.from({ length: 1000 }, (_, index) => makeLead({
      id: `fila-falha-followup-${index}`,
      name: `Lead da fila ${index + 1}`,
      status: 'novo',
      score: 10,
      priority: 'baixa',
      needs: ['site'],
    }))
    vi.mocked(listLeads).mockImplementation((_filters, _sort, page, pageSize) => {
      if (pageSize === 200) {
        return Promise.resolve({ leads: defaultOpportunities, total: defaultOpportunities.length })
      }
      if (page === 0) {
        return new Promise((resolve) => { resolveFirstPage = resolve })
      }
      return Promise.resolve({
        leads: [makeLead({ name: 'Lead que não deveria ser consultado', needs: ['site'] })],
        total: 1001,
      })
    })
    vi.mocked(listFollowups).mockRejectedValue(new Error('Falha ao consultar follow-ups.'))
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Falha ao consultar follow-ups')
    expect(queueBaseQueryCalls()).toHaveLength(1)

    await act(async () => {
      resolveFirstPage({ leads: firstPage, total: 1001 })
      await Promise.resolve()
    })

    expect(queueBaseQueryCalls()).toHaveLength(1)
  })

  it('não dispara consulta a cada tecla digitada em Cidade e Bairro', async () => {
    await renderLoaded()
    const callsAfterLoad = vi.mocked(listLeads).mock.calls.length

    const cityInput = screen.getByLabelText('Cidade')
    let city = ''
    for (const character of 'Campinas') {
      city += character
      fireEvent.change(cityInput, { target: { value: city } })
    }
    const districtInput = screen.getByLabelText('Bairro')
    let district = ''
    for (const character of 'Centro') {
      district += character
      fireEvent.change(districtInput, { target: { value: district } })
    }

    // Nada saiu ainda: a mudança de filtro só vira consulta quando o debounce vence.
    expect(vi.mocked(listLeads).mock.calls.length).toBe(callsAfterLoad)
    expect(opportunityQueryCalls().filter((call) => call[0].city !== undefined)).toHaveLength(0)

    await waitFor(() => expect(lastOpportunityQuery()?.city).toBe('Campinas'))
    expect(lastOpportunityQuery()?.district).toBe('Centro')

    // Uma única consulta filtrada para 14 teclas; a fila base não se moveu.
    expect(opportunityQueryCalls()).toHaveLength(2)
    expect(queueBaseQueryCalls()).toHaveLength(1)
    expect(vi.mocked(listFollowups)).toHaveBeenCalledTimes(1)
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

  it('não afirma contagem enquanto a consulta não respondeu nem quando falhou', async () => {
    renderPage()
    expect(screen.getByText('Carregando oportunidades…')).toBeTruthy()
    expect(screen.queryByText(/potencial estimado/i)).toBeNull()

    await screen.findByRole('button', { name: `Prospectar ${barbearia.name}` })
    expect(screen.queryByText('Carregando oportunidades…')).toBeNull()

    vi.mocked(listLeads).mockImplementation(async (_filters, _sort, _page, pageSize) => {
      if (pageSize === 200) throw new Error('Falha ao contar oportunidades.')
      return { leads: defaultAll, total: defaultAll.length }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    await screen.findByRole('alert')

    expect(screen.getByText('Contagem e potencial indisponíveis nesta atualização. Recarregue para tentar de novo.')).toBeTruthy()
    expect(screen.queryByText(/potencial estimado/i)).toBeNull()
  })

  it('conta o total devolvido pela consulta e avisa quando o potencial é parcial', async () => {
    mockQueries({ opportunities: defaultOpportunities, opportunitiesTotal: 7 })
    renderPage()
    const summary = await screen.findByText(/^7 oportunidades · potencial estimado/)

    // A contagem vem do total exato da consulta, não do tamanho da página.
    expect(summary.textContent).toBe(
      `7 oportunidades · potencial estimado ${formatBRL(800 + 400)} · referente às 2 primeiras listadas`,
    )
    // Sem cap, nenhuma sugestão de parcialidade.
    mockQueries({ opportunities: defaultOpportunities, opportunitiesTotal: 2 })
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    const full = await screen.findByText(/^2 oportunidades · potencial estimado/)
    expect(full.textContent).toBe(`2 oportunidades · potencial estimado ${formatBRL(800 + 400)}`)

    // Uma listada em dez: a dica concorda no singular.
    mockQueries({ opportunities: [barbearia], opportunitiesTotal: 10 })
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    const capped = await screen.findByText(/^10 oportunidades · potencial estimado/)
    expect(capped.textContent).toBe(
      `10 oportunidades · potencial estimado ${formatBRL(800)} · referente à 1 primeira listada`,
    )
  })

  it('apresenta o valor como potencial estimado e nunca como receita ou cliente', async () => {
    mockQueries({ opportunities: [pizzaria] })
    const { container } = renderPage()
    await screen.findByRole('button', { name: `Prospectar ${pizzaria.name}` })

    expect(screen.getByText(/1 oportunidade ·/)).toBeTruthy()
    expect(screen.getByText(/Potencial estimado R\$\s?400,00/)).toBeTruthy()
    expect(container.textContent).not.toMatch(/cliente/i)
    expect(container.textContent).not.toMatch(/faturamento|receita|recebido/i)
  })
})

describe('OpportunitiesPage fila Prospectar hoje', () => {
  it('ordena por prioridade e atraso e exclui status inelegível e lead sem necessidade confirmada', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Prospectar hoje' })

    expect(queueNames()).toEqual([
      barbearia.name,
      doceria.name,
      pizzaria.name,
      petshop.name,
    ])
    // Status inelegível e needs vazios não pontuam: nenhum dos dois aparece na fila.
    expect(queueNames()).not.toContain(convertida.name)
    expect(queueNames()).not.toContain(salao.name)
  })

  it('mostra no máximo cinco leads na fila do dia', async () => {
    const many = Array.from({ length: 7 }, (_, index) => makeLead({
      id: `muitos-${index}`,
      name: `Estabelecimento ${index + 1}`,
      status: 'novo',
      score: 70 - index,
      priority: 'media',
      needs: ['site'],
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

  it('mantém o erro da fila ao filtrar e oferece retry independente da lista principal', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Prospectar hoje' })

    vi.mocked(listLeads).mockImplementation(async (_filters, _sort, _page, pageSize) => {
      if (pageSize === 1000) throw new Error('Falha ao atualizar a fila de prospecção.')
      return { leads: defaultOpportunities, total: defaultOpportunities.length }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    const alert = await screen.findByRole('alert')

    expect(alert.textContent).toContain('Falha ao atualizar a fila de prospecção')
    expect(screen.queryByRole('heading', { name: 'Prospectar hoje' })).toBeNull()
    expect(screen.getAllByRole('button', { name: /^Prospectar / })).toHaveLength(2)

    fireEvent.change(screen.getByLabelText('Nicho'), { target: { value: 'pizzaria' } })
    await waitFor(() => expect(lastOpportunityQuery()?.niche).toBe('pizzaria'))
    expect(screen.getByRole('alert').textContent).toContain('Falha ao atualizar a fila de prospecção')

    const opportunityCallsBeforeRetry = opportunityQueryCalls().length
    mockQueries()
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Tentar novamente' }))

    await screen.findByRole('heading', { name: 'Prospectar hoje' })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(opportunityQueryCalls()).toHaveLength(opportunityCallsBeforeRetry)
  })
})

describe('OpportunitiesPage estado vazio e erro', () => {
  it('explica a regra de presença confirmada quando não há oportunidade', async () => {
    mockQueries({ opportunities: [], all: [convertida], followups: [] })
    const { container } = renderPage()
    await screen.findByRole('heading', { name: 'Nenhuma oportunidade identificada' })

    expect(screen.getByText(/marque 'Não' apenas quando verificado/)).toBeTruthy()
    expect(screen.getByText(/Leads sem dados confirmados não pontuam/)).toBeTruthy()
    expect(container.querySelectorAll('a button')).toHaveLength(0)
    expect(screen.queryAllByRole('button', { name: /^Prospectar / })).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar lead' }))
    expect(await screen.findByText('Rota de cadastro de lead')).toBeTruthy()
  })

  it('mantém estado vazio neutro e oferta Limpar filtros quando os filtros esvaziam a lista', async () => {
    mockQueries({ opportunities: [] })
    const { container } = renderPage()
    await screen.findByRole('heading', { name: 'Nenhuma oportunidade identificada' })

    fireEvent.change(screen.getByLabelText('Nicho'), { target: { value: 'pizzaria' } })
    await screen.findByRole('heading', { name: 'Nenhuma oportunidade com esses filtros' })

    // Resultado filtrado vazio não prova que a presença digital não foi verificada.
    expect(screen.queryByText(/marque 'Não' apenas quando verificado/)).toBeNull()
    expect(screen.queryByText(/Leads sem dados confirmados não pontuam/)).toBeNull()
    expect(screen.queryByText('Nenhuma oportunidade identificada')).toBeNull()
    expect(container.querySelectorAll('a button')).toHaveLength(0)

    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Campinas' } })
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))

    await waitFor(() => expect(lastOpportunityQuery()).toEqual({
      hasNeeds: true,
      excludeStatuses: INELIGIBLE_STATUSES,
    }))
    expect((screen.getByLabelText('Nicho') as HTMLSelectElement).value).toBe('')
    expect((screen.getByLabelText('Cidade') as HTMLInputElement).value).toBe('')
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).toBeNull()
    await screen.findByRole('heading', { name: 'Nenhuma oportunidade identificada' })
  })

  it('não oferece situação que não pode gerar oportunidade', async () => {
    await renderLoaded()

    const impossible = SITUATIONS.filter((situation) => situationStatuses(situation)
      .every((status) => INELIGIBLE_STATUSES.includes(status)))
    expect(impossible.length).toBeGreaterThan(0)

    const situationSelect = screen.getByLabelText('Situação') as HTMLSelectElement
    const labels = Array.from(situationSelect.options).map((option) => option.textContent)

    for (const situation of impossible) {
      expect(labels).not.toContain(SITUATION_LABELS[situation])
    }
    for (const situation of SITUATIONS) {
      if (impossible.includes(situation)) continue
      expect(labels).toContain(SITUATION_LABELS[situation])
    }
    // 'nao_interessado' continua na lista: 'ignorou' não está em INELIGIBLE_STATUSES.
    expect(labels).toContain('Não interessado')
    expect(labels).toHaveLength(SITUATIONS.length - impossible.length + 1) // +1: placeholder "Todas"
  })

  it('refaz somente a lista quando o retry da lista falha sem substituir a fila confirmada', async () => {
    let failOpportunities = true
    vi.mocked(listLeads).mockImplementation(async (_filters, _sort, _page, pageSize) => {
      if (pageSize === 1000) return { leads: defaultAll, total: defaultAll.length }
      if (failOpportunities) throw new Error('Falha ao carregar oportunidades.')
      return { leads: defaultOpportunities, total: defaultOpportunities.length }
    })
    renderPage()
    const alert = await screen.findByRole('alert')
    await screen.findByRole('heading', { name: 'Prospectar hoje' })
    const queueCalls = vi.mocked(listLeads).mock.calls.filter((call) => call[3] === 1000).length

    failOpportunities = false
    vi.mocked(listLeads).mockImplementation(async (_filters, _sort, _page, pageSize) => {
      if (pageSize === 1000) throw new Error('A fila confirmada não deveria ser recarregada.')
      return { leads: defaultOpportunities, total: defaultOpportunities.length }
    })
    fireEvent.click(within(alert).getByRole('button', { name: 'Tentar novamente' }))

    await screen.findByRole('button', { name: `Prospectar ${barbearia.name}` })
    expect(screen.getByRole('heading', { name: 'Prospectar hoje' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(vi.mocked(listLeads).mock.calls.filter((call) => call[3] === 1000)).toHaveLength(queueCalls)
  })

  it('mostra o erro da lista sem descartar a fila cuja consulta foi confirmada', async () => {
    vi.mocked(listLeads).mockImplementation(async (_filters, _sort, _page, pageSize) => {
      if (pageSize === 200) throw new Error('Falha de conexão com o Supabase. Verifique sua internet.')
      return { leads: defaultAll, total: defaultAll.length }
    })
    renderPage()
    const alert = await screen.findByRole('alert')

    expect(alert.textContent).toContain('Falha de conexão com o Supabase')
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Nenhuma oportunidade identificada' })).toBeNull()
    expect(await screen.findByRole('heading', { name: 'Prospectar hoje' })).toBeTruthy()
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
    const cta = await screen.findByRole('button', { name: `Prospectar ${pizzaria.name}` })

    fireEvent.click(cta)

    expect(await screen.findByText(`Ficha do lead ${pizzaria.id}`)).toBeTruthy()
    expect(createLead).not.toHaveBeenCalled()
    expect(updateLead).not.toHaveBeenCalled()
  })

  it('não aninha botão dentro de link e não briga com o padding do Card', async () => {
    const { container } = renderPage()
    const cta = await screen.findByRole('button', { name: `Prospectar ${barbearia.name}` })

    expect(container.querySelectorAll('a button, a a')).toHaveLength(0)

    const card = cta.closest('div[class*="rounded-2xl"]') as HTMLElement
    expect(Array.from(card.classList).filter((cls) => /^p-\d+$/.test(cls))).toEqual(['p-5'])
  })

  it('recarrega as duas consultas ao clicar em Atualizar', async () => {
    renderPage()
    await screen.findByRole('button', { name: `Prospectar ${barbearia.name}` })

    const refreshed = makeLead({
      id: 'opp-atualizada', name: 'Estúdio Testeira', niche: 'barbearia', status: 'novo',
      score: 70, priority: 'alta', needs: ['site'], estimated_value: 500,
    })
    mockQueries({ opportunities: [refreshed], all: [refreshed] })
    const callsBefore = vi.mocked(listLeads).mock.calls.length
    const followupsBefore = vi.mocked(listFollowups).mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))

    expect(await screen.findByRole('button', { name: `Prospectar ${refreshed.name}` })).toBeTruthy()
    expect(screen.queryByText(barbearia.name)).toBeNull()
    expect(vi.mocked(listLeads).mock.calls.length).toBe(callsBefore + 2)
    expect(vi.mocked(listFollowups).mock.calls.length).toBe(followupsBefore + 1)
  })

  it('recarrega as consultas quando o WhatsApp é registrado no histórico', async () => {
    vi.stubGlobal('open', vi.fn(() => ({ opener: null, location: { replace: vi.fn() }, close: vi.fn() })))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: `Abrir WhatsApp de ${barbearia.name}` }))
    const dialog = await screen.findByRole('dialog', { name: 'Abrir WhatsApp' })
    const openButton = within(dialog).getByRole('button', { name: 'Abrir WhatsApp' })
    await waitFor(() => expect((openButton as HTMLButtonElement).disabled).toBe(false))

    const callsBefore = vi.mocked(listLeads).mock.calls.length
    const followupsBefore = vi.mocked(listFollowups).mock.calls.length

    await act(async () => {
      fireEvent.click(openButton)
    })

    await waitFor(() => expect(addActivity).toHaveBeenCalledWith(
      barbearia.id, 'mensagem', expect.any(String),
    ))
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(vi.mocked(listLeads).mock.calls.length).toBe(callsBefore + 2))
    expect(vi.mocked(listFollowups).mock.calls.length).toBe(followupsBefore + 1)
  })
})
