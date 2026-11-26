// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { DndContext, closestCenter, pointerWithin, type CollisionDetection, type DndContextProps, type DragEndEvent, type UniqueIdentifier } from '@dnd-kit/core'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastContext } from '../hooks/useToast'
import { formatBRL } from '../lib/format'
import { LEAD_STATUSES, STATUS_LABELS, emptyLeadDraft, type Lead, type LeadStatus } from '../types/lead'
import { listLeads, setLeadStatus } from '../services/leadService'
import { addActivity } from '../services/activityService'
import type { ConversionDialogProps } from '../components/leads/ConversionDialog'
import type { LeadClientLink } from '../types/client'
import { listLeadClientLinks } from '../services/clientService'
import { KanbanCard, KanbanCardBody } from '../components/pipeline/KanbanCard'
import { PipelinePage } from './PipelinePage'

vi.mock('../services/leadService', () => ({ listLeads: vi.fn(), setLeadStatus: vi.fn() }))
vi.mock('../services/activityService', () => ({ addActivity: vi.fn(), listActivities: vi.fn() }))
vi.mock('../services/clientService', () => ({ listLeadClientLinks: vi.fn() }))
vi.mock('../components/leads/ConversionDialog', () => ({
  ConversionDialog: ({ open, lead, onClose, onConverted }: ConversionDialogProps) => open ? (
    <div role="dialog" aria-label="Converter lead em cliente">
      <p>{lead.name}</p>
      <button type="button" onClick={onClose}>Cancelar</button>
      <button
        type="button"
        onClick={() => onConverted({
          client_id: 'client-1',
          link_id: 'link-1',
          contract_id: 'contract-1',
          project_id: null,
          already_existed: false,
        })}
      >
        Confirmar conversão
      </button>
    </div>
  ) : null,
}))

// Espia as props do `DndContext` do quadro sem substituí-lo (por dentro renderiza o contexto real,
// então `useDraggable`/`useDroppable` seguem funcionando). É o único jeito de provar em jsdom a
// estratégia de colisão efetivamente ligada e o caminho `onDragEnd` → `moveLead`: o arraste em si
// não tem rects mensuráveis aqui.
const dnd = vi.hoisted(() => ({ props: null as DndContextProps | null }))
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  function DndContextSpy(props: DndContextProps) {
    dnd.props = props
    return <actual.DndContext {...props} />
  }
  return { ...actual, DndContext: DndContextSpy }
})

const toast = vi.fn()
const PAGE_SIZE = 500

let seq = 0
function makeLead(overrides: Partial<Lead> = {}): Lead {
  seq += 1
  return {
    ...emptyLeadDraft(),
    id: `lead-${seq}`,
    owner_id: '00000000-0000-0000-0000-000000000201',
    name: `Estabelecimento ${seq}`,
    score: 0,
    priority: 'baixa',
    needs: [],
    score_reasons: [],
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
    ...overrides,
  } as Lead
}

const barbearia = makeLead({
  id: 'lead-barbearia',
  name: 'Barbearia do Bairro',
  niche: 'barbearia',
  city: 'São Paulo',
  status: 'novo',
  score: 85,
  priority: 'muito_alta',
  estimated_value: 800,
  phone: '11999990001',
  next_contact_at: '2026-12-01T12:00:00.000Z',
})
const pizzaria = makeLead({
  id: 'lead-pizzaria',
  name: 'Pizzaria Forno a Lenha',
  niche: 'pizzaria',
  city: 'Campinas',
  status: 'novo',
  score: 62,
  priority: 'alta',
  estimated_value: 400,
})
const salao = makeLead({
  id: 'lead-salao',
  name: 'Salão Novo Olhar',
  niche: 'salao_beleza',
  city: 'São Paulo',
  status: 'interessado',
  score: 70,
  priority: 'media',
  estimated_value: 1200,
})
const clinica = makeLead({
  id: 'lead-clinica',
  name: 'Clínica Sorriso',
  niche: 'clinica_estetica',
  city: 'Curitiba',
  status: 'perdido',
  score: 90,
  priority: 'alta',
  estimated_value: 99999,
})
const doceria = makeLead({
  id: 'lead-doceria',
  name: 'Doceria da Praça',
  city: null,
  status: 'contato_realizado',
  score: 40,
  priority: 'baixa',
})

const PIPELINE_LEADS = [barbearia, pizzaria, salao, clinica, doceria]

// Espelha o que o service faz no Supabase (eq niche, ilike city, eq priority) para que os
// testes provem a consulta de verdade, não só a contagem de chamadas.
function mockLeads(rows: Lead[], total = rows.length) {
  vi.mocked(listLeads).mockImplementation(async (filters) => ({
    leads: rows.filter((lead) => {
      if (filters.niche && lead.niche !== filters.niche) return false
      if (filters.city && (lead.city ?? '').toLowerCase() !== filters.city.toLowerCase()) return false
      if (filters.priority && lead.priority !== filters.priority) return false
      return true
    }),
    total,
  }))
}

function renderPage() {
  return render(
    <ToastContext.Provider value={{ toast }}>
      <MemoryRouter initialEntries={['/pipeline']}>
        <Routes>
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/leads/:id" element={<div>Ficha do lead</div>} />
          <Route path="/clientes/:id" element={<div>Ficha do cliente</div>} />
        </Routes>
      </MemoryRouter>
    </ToastContext.Provider>,
  )
}

function columnFor(status: LeadStatus) {
  return within(screen.getByRole('group', { name: STATUS_LABELS[status] }))
}

// Cards arrastáveis também são `role="group"` (sem rótulo): as colunas do quadro são os groups
// nomeados por STATUS_LABELS.
function columns() {
  return screen.getAllByRole('group').filter((group) => group.getAttribute('aria-label') !== null)
}

// A lista mobile é a única `list` do quadro: sem isso o card duplicado pela ramificação
// desktop/mobile (só CSS) tornaria qualquer consulta de nome ambígua.
function mobileEntries() {
  return screen.queryAllByRole('listitem')
}

function mobileNames() {
  return mobileEntries().map((entry) => {
    const leadLink = within(entry).getAllByRole('link')
      .find((link) => link.getAttribute('href')?.startsWith('/leads/'))
    expect(leadLink).toBeTruthy()
    return leadLink!.textContent
  })
}

function moveSelect(index = 0) {
  return within(mobileEntries()[index]).getByRole('combobox') as HTMLSelectElement
}

function moveSelectLabels(index = 0) {
  return Array.from(moveSelect(index).options).map((option) => option.textContent)
}

function columnSelect() {
  return screen.getByLabelText('Coluna') as HTMLSelectElement
}

function cityInput() {
  return screen.getByLabelText('Cidade') as HTMLInputElement
}

function columnSelectLabels() {
  return Array.from(columnSelect().options).map((option) => option.textContent)
}

function queries() {
  return vi.mocked(listLeads).mock.calls
}

function lastQuery() {
  return queries().at(-1)
}

function columnCount(status: LeadStatus) {
  return Number(columnFor(status).getByText(/^\d+$/).textContent)
}

async function desktopCard(lead: Lead) {
  const column = await screen.findByRole('group', { name: STATUS_LABELS[lead.status] })
  const card = within(column).getByRole('link', { name: lead.name })
    .closest('[aria-roledescription="draggable"]')
  expect(card).toBeTruthy()
  return within(card as HTMLElement)
}

async function mobileEntry(leadName: string) {
  await screen.findAllByRole('listitem')
  const entry = mobileEntries().find((item) => within(item).queryByRole('link', { name: leadName }))
  expect(entry).toBeTruthy()
  return within(entry as HTMLElement)
}

function makeLink(lead: Lead, clientId: string): LeadClientLink {
  return {
    id: `link-${lead.id}`,
    owner_id: lead.owner_id,
    lead_id: lead.id,
    client_id: clientId,
    converted_at: '2026-11-25T12:00:00Z',
    created_at: '2026-11-25T12:00:00Z',
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

// Termina o arraste do quadro exatamente como o dnd-kit o entregaria ao `onDragEnd` da página:
// do evento só `active.id` e `over` participam da decisão.
function endDrag(over: { id: UniqueIdentifier } | null | undefined, activeId = barbearia.id) {
  const onDragEnd = dnd.props?.onDragEnd
  expect(onDragEnd).toBeTruthy()
  act(() => {
    onDragEnd?.({ active: { id: activeId }, over } as unknown as DragEndEvent)
  })
}

// Geometria do quadro desktop: 11 colunas de 288 px lado a lado, com scroll horizontal.
function boardRects(): Parameters<CollisionDetection>[0] {
  const droppableRects = new Map(
    LEAD_STATUSES.map((status, index) => {
      const left = index * 300
      return [status, { width: 288, height: 400, top: 120, left, right: left + 288, bottom: 520 }]
    }),
  )
  return {
    droppableRects,
    droppableContainers: LEAD_STATUSES.map((status) => ({ id: status })),
    // Solto na largura da 5ª coluna, mas muito abaixo do quadro: fundo da página.
    pointerCoordinates: { x: 1300, y: 4000 },
    collisionRect: { width: 260, height: 90, top: 3955, left: 1170, right: 1430, bottom: 4045 },
  } as unknown as Parameters<CollisionDetection>[0]
}

let consoleError: ReturnType<typeof vi.spyOn>
let consoleWarn: ReturnType<typeof vi.spyOn>

afterEach(() => {
  cleanup()
  // Nenhum caminho renderizado pode gerar aviso de console (act, ref, DnD sem contexto).
  expect(consoleError).not.toHaveBeenCalled()
  expect(consoleWarn).not.toHaveBeenCalled()
  consoleError.mockRestore()
  consoleWarn.mockRestore()
})

beforeEach(() => {
  seq = 0
  dnd.props = null
  vi.resetAllMocks()
  consoleError = vi.spyOn(console, 'error')
  consoleWarn = vi.spyOn(console, 'warn')
  mockLeads(PIPELINE_LEADS)
  vi.mocked(listLeadClientLinks).mockResolvedValue([])
  vi.mocked(setLeadStatus).mockImplementation(async () => barbearia)
})

describe('PipelinePage quadro', () => {
  it('rendera as 11 colunas com os rótulos de STATUS_LABELS', async () => {
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    expect(columns()).toHaveLength(LEAD_STATUSES.length)
    for (const status of LEAD_STATUSES) {
      const column = columnFor(status)
      expect(column.getByRole('heading', { name: STATUS_LABELS[status] })).toBeTruthy()
    }
    // Ordem do quadro = ordem de LEAD_STATUSES.
    expect(columns().map((group) => group.getAttribute('aria-label'))).toEqual(
      LEAD_STATUSES.map((status) => STATUS_LABELS[status]),
    )
  })

  it('coloca cada lead na coluna do próprio status com a contagem da coluna', async () => {
    const { container } = renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    expect(columnFor('novo').getByText(barbearia.name)).toBeTruthy()
    expect(columnFor('novo').getByText(pizzaria.name)).toBeTruthy()
    expect(columnFor('interessado').getByText(salao.name)).toBeTruthy()
    expect(columnFor('contato_realizado').getByText(doceria.name)).toBeTruthy()
    expect(columnFor('perdido').getByText(clinica.name)).toBeTruthy()
    expect(columnFor('novo').queryByText(salao.name)).toBeNull()
    expect(columnFor('perdido').queryByText(barbearia.name)).toBeNull()

    expect(columnFor('novo').getByText('2')).toBeTruthy()
    expect(columnFor('interessado').getByText('1')).toBeTruthy()
    // Coluna sem lead continua existindo e vazia.
    expect(columnFor('negociando').getByText('0')).toBeTruthy()
    expect(columnFor('negociando').getByText('Arraste leads para cá')).toBeTruthy()
    // Card não aninha controle interativo dentro de link.
    expect(container.querySelectorAll('a button, a a')).toHaveLength(0)
  })

  it('oferece um seletor nativo focável, identificado pelo lead e fora do nó arrastável', async () => {
    vi.mocked(setLeadStatus).mockResolvedValueOnce({ ...barbearia, status: 'interessado' })
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    const select = columnFor('novo').getByRole('combobox', {
      name: `Mover ${barbearia.name} para`,
    }) as HTMLSelectElement
    expect(select.tagName).toBe('SELECT')
    expect(select.tabIndex).toBe(0)
    expect(select.closest('[aria-roledescription="draggable"]')).toBeNull()
    select.focus()
    expect(document.activeElement).toBe(select)

    fireEvent.change(select, { target: { value: 'interessado' } })

    expect(setLeadStatus).toHaveBeenCalledWith(barbearia.id, 'interessado')
    await waitFor(() => expect(toast).toHaveBeenCalledWith(`"${barbearia.name}" movido para Interessado.`))
    expect(columnFor('interessado').getByText(barbearia.name)).toBeTruthy()
  })

  it('mostra nicho, prioridade, valor estimado e data de próximo contato no card', async () => {
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    const card = columnFor('novo').getByText(barbearia.name).closest('[aria-roledescription]') as HTMLElement
    expect(card.textContent).toContain('Barbearia')
    expect(card.textContent).toContain('Muito alta')
    expect(card.textContent).toContain('R$')
    // O número é potencial, nunca receita: rótulo idêntico ao da Central de Oportunidades.
    expect(card.textContent).toContain('Potencial estimado')
    expect((card.querySelector('a') as HTMLAnchorElement).getAttribute('href')).toBe(`/leads/${barbearia.id}`)
    expect(card.textContent).toContain(formatBRL(barbearia.estimated_value))
    expect(card.textContent).toContain('01/12/2026')
    // Lead sem nicho e sem dados opcionais não inventa valor nem telefone.
    const sparse = columnFor('contato_realizado').getByText(doceria.name).closest('[aria-roledescription]') as HTMLElement
    expect(sparse.textContent).toContain('Sem nicho')
    expect(sparse.textContent).not.toContain('(11)')
    // estimated_value 0 é o default do draft: "ainda não estimado" não pode virar "R$ 0,00".
    expect(sparse.textContent).toContain('Sem valor estimado')
    expect(sparse.textContent).not.toContain('R$')
  })

  it('nunca chama o valor estimado de receita, faturamento ou cliente', async () => {
    const { container } = renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    // O valor aparece no quadro (como valor do lead), mas nenhuma palavra de receita aparece.
    expect(container.textContent).toContain(formatBRL(barbearia.estimated_value))
    expect(container.textContent).not.toMatch(/faturamento|receita|recebido|ganhou/i)
    expect(container.textContent).not.toMatch(/cliente/i)
    expect(container.textContent).not.toMatch(/contratado/i)
  })
})

describe('PipelinePage — conversão', () => {
  it('mostra Ver cliente no desktop e no mobile quando existe vínculo real', async () => {
    const clientLink = makeLink(barbearia, 'client-barbearia')
    vi.mocked(listLeadClientLinks).mockResolvedValue([clientLink])
    renderPage()

    const desktop = await desktopCard(barbearia)
    const desktopLink = await desktop.findByRole('link', { name: 'Ver cliente' })
    const mobile = await mobileEntry(barbearia.name)
    const mobileLink = mobile.getByRole('link', { name: 'Ver cliente' })

    expect(desktopLink.getAttribute('href')).toBe('/clientes/client-barbearia')
    expect(mobileLink.getAttribute('href')).toBe('/clientes/client-barbearia')
    expect(desktop.queryByRole('button', { name: 'Converter' })).toBeNull()
    expect(mobile.queryByRole('button', { name: 'Converter' })).toBeNull()
  })

  it('mostra Converter e abre o diálogo para lead sem vínculo, nas duas ramificações', async () => {
    renderPage()

    const desktop = await desktopCard(barbearia)
    const desktopAction = await desktop.findByRole('button', { name: 'Converter' })
    const mobile = await mobileEntry(barbearia.name)
    expect(mobile.getByRole('button', { name: 'Converter' })).toBeTruthy()

    fireEvent.click(desktopAction)
    const dialog = screen.getByRole('dialog', { name: 'Converter lead em cliente' })
    expect(within(dialog).getByText(barbearia.name)).toBeTruthy()
  })

  it('não inicia arraste nem altera status ao clicar ou pressionar Converter', async () => {
    renderPage()
    const desktop = await desktopCard(barbearia)
    const action = await desktop.findByRole('button', { name: 'Converter' })
    const card = action.closest('[aria-roledescription="draggable"]') as HTMLElement

    fireEvent.pointerDown(action)
    fireEvent.click(action)

    expect(card.getAttribute('aria-pressed')).not.toBe('true')
    expect(card.className).not.toContain('opacity-60')
    expect(setLeadStatus).not.toHaveBeenCalled()
    expect((await desktopCard(barbearia)).getByRole('link', { name: barbearia.name })).toBeTruthy()
    expect(columnCount('novo')).toBe(2)
    expect(screen.getByRole('dialog', { name: 'Converter lead em cliente' })).toBeTruthy()
  })

  it('navega em Ver cliente sem gravar mudança de status', async () => {
    vi.mocked(listLeadClientLinks).mockResolvedValue([makeLink(barbearia, 'client-barbearia')])
    renderPage()
    const desktop = await desktopCard(barbearia)
    const link = await desktop.findByRole('link', { name: 'Ver cliente' })

    fireEvent.pointerDown(link)
    fireEvent.click(link)

    expect(await screen.findByText('Ficha do cliente')).toBeTruthy()
    expect(setLeadStatus).not.toHaveBeenCalled()
  })

  it('preserva leads e vínculos conhecidos e permite retry quando a consulta falha', async () => {
    const clientLink = makeLink(barbearia, 'client-barbearia')
    vi.mocked(listLeadClientLinks)
      .mockResolvedValueOnce([clientLink])
      .mockRejectedValueOnce(new Error('Falha ao listar vínculos.'))
      .mockResolvedValueOnce([clientLink])
    renderPage()
    await (await desktopCard(barbearia)).findByRole('link', { name: 'Ver cliente' })

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    const alert = await screen.findByRole('alert')
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    expect(alert.textContent).toContain('Não foi possível carregar os vínculos de conversão.')
    expect(alert.textContent).toContain('Falha ao listar vínculos.')
    expect(alert.textContent).toContain('A conversão não pode ser verificada; os leads continuam visíveis.')
    expect(alert.textContent).not.toMatch(/não convertido/i)
    const desktop = await desktopCard(barbearia)
    const mobile = await mobileEntry(barbearia.name)
    expect(desktop.getByRole('link', { name: barbearia.name })).toBeTruthy()
    expect(mobile.getByRole('link', { name: barbearia.name })).toBeTruthy()
    expect(desktop.getByRole('link', { name: 'Ver cliente' }).getAttribute('href')).toBe('/clientes/client-barbearia')
    expect(mobile.getByRole('link', { name: 'Ver cliente' }).getAttribute('href')).toBe('/clientes/client-barbearia')
    expect(desktop.queryByRole('button', { name: 'Converter' })).toBeNull()
    expect(mobile.queryByRole('button', { name: 'Converter' })).toBeNull()

    fireEvent.click(within(alert).getByRole('button', { name: 'Tentar novamente' }))
    await (await desktopCard(barbearia)).findByRole('link', { name: 'Ver cliente' })
    expect(listLeadClientLinks).toHaveBeenCalledTimes(3)
    expect(listLeads).toHaveBeenCalledTimes(2)
  })

  it('preserva o snapshot de leads e a fila quando a listagem falha e permite retry', async () => {
    vi.mocked(listLeads)
      .mockResolvedValueOnce({ leads: PIPELINE_LEADS, total: PIPELINE_LEADS.length })
      .mockRejectedValueOnce(new Error('Falha temporária na listagem.'))
      .mockResolvedValueOnce({ leads: PIPELINE_LEADS, total: PIPELINE_LEADS.length })
    renderPage()
    await (await desktopCard(barbearia)).findByRole('link', { name: barbearia.name })

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    const alert = await screen.findByRole('alert')

    expect(alert.textContent).toContain('Falha temporária na listagem.')
    expect(alert.textContent).toContain('último snapshot')
    expect(screen.getByRole('group', { name: STATUS_LABELS.novo })).toBeTruthy()
    expect((await desktopCard(barbearia)).getByRole('link', { name: barbearia.name })).toBeTruthy()
    expect((await mobileEntry(barbearia.name)).getByRole('link', { name: barbearia.name })).toBeTruthy()
    expect(dnd.props?.onDragEnd).toBeTypeOf('function')

    fireEvent.click(within(alert).getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(listLeads).toHaveBeenCalledTimes(3)
    expect((await desktopCard(barbearia)).getByRole('link', { name: barbearia.name })).toBeTruthy()
  })

  it('não reutiliza o snapshot de leads quando uma consulta com filtros diferentes falha', async () => {
    const filtered = PIPELINE_LEADS.filter((lead) => lead.niche === 'pizzaria')
    vi.mocked(listLeads)
      .mockResolvedValueOnce({ leads: PIPELINE_LEADS, total: PIPELINE_LEADS.length })
      .mockRejectedValueOnce(new Error('Falha na consulta filtrada.'))
      .mockResolvedValueOnce({ leads: filtered, total: filtered.length })
    renderPage()
    await (await desktopCard(barbearia)).findByRole('link', { name: barbearia.name })

    fireEvent.change(screen.getByLabelText('Nicho'), { target: { value: 'pizzaria' } })
    const alert = await screen.findByRole('alert')

    expect(alert.textContent).toContain('Falha na consulta filtrada.')
    expect(screen.queryByRole('group', { name: STATUS_LABELS.novo })).toBeNull()
    expect(screen.queryByText(barbearia.name)).toBeNull()
    expect(alert.textContent).not.toContain('último snapshot')

    fireEvent.click(within(alert).getByRole('button', { name: 'Tentar novamente' }))
    await screen.findByRole('group', { name: STATUS_LABELS.novo })
    expect(screen.getAllByText(pizzaria.name)).toHaveLength(2)
    expect(screen.queryByText(barbearia.name)).toBeNull()
  })

  it('mantém o seletor de status e a mesma ação no mobile', async () => {
    const updated = { ...barbearia, status: 'interessado' as const }
    vi.mocked(setLeadStatus).mockResolvedValue(updated)
    renderPage()
    const mobile = await mobileEntry(barbearia.name)
    const selector = mobile.getByRole('combobox', { name: `Mover ${barbearia.name} para` })

    expect(mobile.getByRole('button', { name: 'Converter' })).toBeTruthy()
    fireEvent.click(mobile.getByRole('button', { name: 'Converter' }))
    expect(screen.getByRole('dialog', { name: 'Converter lead em cliente' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.change(selector, { target: { value: 'interessado' } })

    await waitFor(() => expect(setLeadStatus).toHaveBeenCalledWith(barbearia.id, 'interessado'))
    await waitFor(() => expect(mobileNames()).toEqual([pizzaria.name]))
    const remaining = await mobileEntry(pizzaria.name)
    expect(remaining.getByRole('combobox', { name: `Mover ${pizzaria.name} para` })).toBeTruthy()
    expect(remaining.getByRole('button', { name: 'Converter' })).toBeTruthy()
    expect(await (await desktopCard(updated)).findByRole('button', { name: 'Converter' })).toBeTruthy()
  })

  it('fecha o diálogo e atualiza vínculos e leads em background após converter', async () => {
    const pendingLinks = deferred<LeadClientLink[]>()
    const pendingLeads = deferred<{ leads: Lead[]; total: number }>()
    vi.mocked(listLeads)
      .mockResolvedValueOnce({ leads: PIPELINE_LEADS, total: PIPELINE_LEADS.length })
      .mockReturnValueOnce(pendingLeads.promise)
    vi.mocked(listLeadClientLinks)
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(pendingLinks.promise)
    const { container } = renderPage()

    const desktop = await desktopCard(barbearia)
    fireEvent.click(await desktop.findByRole('button', { name: 'Converter' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conversão' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(listLeadClientLinks).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(listLeads).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('group', { name: STATUS_LABELS.novo })).toBeTruthy()
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(0)
    expect(setLeadStatus).not.toHaveBeenCalled()

    const converted = { ...barbearia, status: 'aceitou' as const }
    const clientLink = makeLink(barbearia, 'client-barbearia')
    await act(async () => {
      pendingLinks.resolve([clientLink])
      pendingLeads.resolve({ leads: [converted, pizzaria, salao, clinica, doceria], total: PIPELINE_LEADS.length })
      await Promise.all([pendingLinks.promise, pendingLeads.promise])
    })

    expect(await (await desktopCard(converted)).findByRole('link', { name: 'Ver cliente' })).toBeTruthy()
    await waitFor(() => expect(mobileNames()).toEqual([pizzaria.name]))
  })

  it('descarta resposta de vínculos obsoleta quando Atualizar inicia outro efeito', async () => {
    const first = deferred<LeadClientLink[]>()
    const second = deferred<LeadClientLink[]>()
    vi.mocked(listLeadClientLinks)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    renderPage()
    await waitFor(() => expect(listLeadClientLinks).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    await waitFor(() => expect(listLeadClientLinks).toHaveBeenCalledTimes(2))
    await act(async () => {
      second.resolve([makeLink(barbearia, 'client-atual')])
      await second.promise
    })
    await (await desktopCard(barbearia)).findByRole('link', { name: 'Ver cliente' })

    await act(async () => {
      first.resolve([makeLink(barbearia, 'client-obsoleto')])
      await first.promise
    })
    expect((await desktopCard(barbearia)).getByRole('link', { name: 'Ver cliente' }).getAttribute('href'))
      .toBe('/clientes/client-atual')
  })
})

describe('PipelinePage consulta', () => {
  it('pede até 500 leads ordenados por score sem filtros', async () => {
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    expect(listLeads).toHaveBeenCalledWith({}, 'score_desc', 0, PAGE_SIZE)
    expect(queries().length).toBe(1)
    // Com 5 leads na página nada é apresentado como janela truncada.
    expect(screen.queryByText(/primeiros 500/)).toBeNull()
  })

  it('aplica nicho e prioridade combinados na consulta', async () => {
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    fireEvent.change(screen.getByLabelText('Nicho'), { target: { value: 'pizzaria' } })
    await waitFor(() => expect(lastQuery()).toEqual([{ niche: 'pizzaria' }, 'score_desc', 0, PAGE_SIZE]))
    expect(screen.getByRole('group', { name: STATUS_LABELS.novo }).textContent).toContain(pizzaria.name)
    expect(screen.queryByText(barbearia.name)).toBeNull()

    fireEvent.change(screen.getByLabelText('Prioridade'), { target: { value: 'alta' } })
    await waitFor(() => expect(lastQuery()).toEqual([
      { niche: 'pizzaria', priority: 'alta' }, 'score_desc', 0, PAGE_SIZE,
    ]))
  })

  it('select de nicho consulta na hora: escolha deliberada não espera o debounce', async () => {
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })
    const before = queries().length

    fireEvent.change(screen.getByLabelText('Nicho'), { target: { value: 'pizzaria' } })

    // No mesmo tick do change a consulta já saiu: nenhum skeleton de 300 ms antes de pedir.
    expect(queries().length).toBe(before + 1)
    expect(lastQuery()).toEqual([{ niche: 'pizzaria' }, 'score_desc', 0, PAGE_SIZE])
    expect(screen.queryByText(barbearia.name)).toBeNull()

    fireEvent.change(screen.getByLabelText('Prioridade'), { target: { value: 'alta' } })
    expect(queries().length).toBe(before + 2)
    expect(lastQuery()).toEqual([{ niche: 'pizzaria', priority: 'alta' }, 'score_desc', 0, PAGE_SIZE])
  })

  it('nicho escolhido durante a digitação da cidade consulta na hora e descarta o timer', async () => {
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })
    const before = queries().length

    fireEvent.change(cityInput(), { target: { value: 'Campinas' } })
    // Texto livre continua atrasado: a cidade sozinha não dispara consulta.
    expect(queries().length).toBe(before)

    fireEvent.change(screen.getByLabelText('Nicho'), { target: { value: 'pizzaria' } })
    expect(queries().length).toBe(before + 1)
    expect(lastQuery()).toEqual([{ city: 'Campinas', niche: 'pizzaria' }, 'score_desc', 0, PAGE_SIZE])

    // O timer pendente foi cancelado: a mesma cidade não sai em duas consultas.
    await act(async () => {
      await new Promise((resolve) => { setTimeout(resolve, 400) })
    })
    expect(queries().length).toBe(before + 1)
  })

  it('recarrega a consulta ao clicar em Atualizar', async () => {
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })
    const before = queries().length

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))

    await waitFor(() => expect(queries().length).toBe(before + 1))
  })

  it('não dispara uma consulta por tecla em Cidade: a consulta espera a última', async () => {
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })
    fireEvent.change(screen.getByLabelText('Nicho'), { target: { value: 'barbearia' } })
    await waitFor(() => expect(lastQuery()).toEqual([{ niche: 'barbearia' }, 'score_desc', 0, PAGE_SIZE]))

    const before = queries().length
    const input = cityInput()

    let city = ''
    for (const character of 'São Paulo') {
      city += character
      fireEvent.change(input, { target: { value: city } })
    }

    // O input é controlado e responde na hora; a consulta ainda não saiu.
    expect(input.value).toBe('São Paulo')
    expect(queries().length).toBe(before)

    await waitFor(() => expect(lastQuery()).toEqual([
      { niche: 'barbearia', city: 'São Paulo' }, 'score_desc', 0, PAGE_SIZE,
    ]))

    // Uma única consulta com cidade para 9 teclas, com o valor final e o nicho preservado.
    expect(queries().filter((call) => call[0].city !== undefined)).toHaveLength(1)
    expect(queries().length).toBe(before + 1)
    expect(columnFor('novo').getByText(barbearia.name)).toBeTruthy()
    expect(columnFor('novo').queryByText(pizzaria.name)).toBeNull()
  })

  it('cancela o debounce pendente ao desmontar', async () => {
    const { unmount } = renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })
    const before = queries().length

    fireEvent.change(cityInput(), { target: { value: 'Campinas' } })
    unmount()
    await act(async () => {
      await new Promise((resolve) => { setTimeout(resolve, 400) })
    })

    expect(queries().length).toBe(before)
  })
})

describe('PipelinePage mobile', () => {
  it('lista uma coluna por vez e oferece as 11 colunas com a contagem de cada uma', async () => {
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    expect(columnSelect().value).toBe('novo')
    expect(columnSelectLabels()).toEqual(LEAD_STATUSES.map((status) => {
      const count = PIPELINE_LEADS.filter((lead) => lead.status === status).length
      return `${STATUS_LABELS[status]} (${count})`
    }))
    expect(mobileNames()).toEqual([barbearia.name, pizzaria.name])
    expect(screen.getByRole('list', { name: 'Leads em Novo' })).toBeTruthy()
  })

  it('troca os leads listados quando o seletor de coluna muda', async () => {
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    fireEvent.change(columnSelect(), { target: { value: 'interessado' } })
    expect(mobileNames()).toEqual([salao.name])
    expect(mobileEntries()).toHaveLength(1)

    fireEvent.change(columnSelect(), { target: { value: 'negociando' } })
    expect(mobileEntries()).toHaveLength(0)
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.getByText('Nenhum lead nesta coluna.')).toBeTruthy()

    fireEvent.change(columnSelect(), { target: { value: 'perdido' } })
    expect(mobileNames()).toEqual([clinica.name])
  })

  it('move pelo seletor "Mover para" antes mesmo da resposta e avisa no toast', async () => {
    let resolveMove!: (lead: Lead) => void
    vi.mocked(setLeadStatus).mockReturnValue(new Promise<Lead>((resolve) => { resolveMove = resolve }))
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    expect(moveSelectLabels()).toEqual([
      'Escolha o novo status',
      ...LEAD_STATUSES.map((status) => (status === 'novo' ? 'Novo (atual)' : STATUS_LABELS[status])),
    ])

    fireEvent.change(moveSelect(0), { target: { value: 'interessado' } })

    // Otimista: o card já está em outra coluna do quadro e saiu da lista mobile de Novo.
    expect(setLeadStatus).toHaveBeenCalledWith(barbearia.id, 'interessado')
    expect(columnFor('novo').queryByText(barbearia.name)).toBeNull()
    expect(columnFor('interessado').getByText(barbearia.name)).toBeTruthy()
    expect(columnCount('novo')).toBe(1)
    expect(columnCount('interessado')).toBe(2)
    expect(mobileNames()).toEqual([pizzaria.name])
    expect(columnSelectLabels()).toContain('Interessado (2)')
    // Sem sucesso anunciado antes da confirmação do banco.
    expect(toast).not.toHaveBeenCalled()

    await act(async () => {
      resolveMove({ ...barbearia, status: 'interessado' })
    })

    await waitFor(() => expect(toast).toHaveBeenCalledWith(`"${barbearia.name}" movido para Interessado.`))
    expect(columnFor('interessado').getByText(barbearia.name)).toBeTruthy()
  })

  it('não grava atividade no cliente: o histórico vem do trigger do banco', async () => {
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    fireEvent.change(moveSelect(0), { target: { value: 'negociando' } })

    await waitFor(() => expect(toast).toHaveBeenCalledWith(`"${barbearia.name}" movido para Negociando.`))
    expect(setLeadStatus).toHaveBeenCalledTimes(1)
    expect(addActivity).not.toHaveBeenCalled()
  })

  it('não faz nada quando o status escolhido é o atual do lead', async () => {
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    fireEvent.change(moveSelect(0), { target: { value: 'novo' } })
    await act(async () => { await Promise.resolve() })

    expect(setLeadStatus).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
    expect(columnCount('novo')).toBe(2)
    expect(mobileNames()).toEqual([barbearia.name, pizzaria.name])
  })

  it('reverte o card para a coluna anterior quando a atualização falha', async () => {
    vi.mocked(setLeadStatus).mockRejectedValue(new Error('Não foi possível atualizar o status.'))
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    fireEvent.change(moveSelect(0), { target: { value: 'aceitou' } })
    expect(columnFor('novo').queryByText(barbearia.name)).toBeNull()
    expect(columnFor('aceitou').getByText(barbearia.name)).toBeTruthy()

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Não foi possível atualizar o status.', 'error'))
    expect(columnFor('novo').getByText(barbearia.name)).toBeTruthy()
    expect(columnFor('aceitou').queryByText(barbearia.name)).toBeNull()
    expect(columnCount('novo')).toBe(2)
    expect(columnCount('aceitou')).toBe(0)
    expect(mobileNames()).toEqual([barbearia.name, pizzaria.name])
  })

  it('registra um único card arrastável por lead e nenhum no mobile', async () => {
    // Ramificações desktop e mobile ficam montadas (só o CSS alterna): se o mobile montasse
    // useDraggable, o mesmo id de draggable registraria duas vezes.
    const { container } = renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    expect(container.querySelectorAll('[aria-roledescription="draggable"]')).toHaveLength(PIPELINE_LEADS.length)
    // Card não é botão: `role="button"` sobre conteúdo apresentacional (o Link da ficha) tira do
    // leitor de tela a semântica de link, e `tabIndex=0` sem KeyboardSensor é parada de tab morta.
    expect(container.querySelectorAll('[aria-roledescription="draggable"][role="button"]')).toHaveLength(0)
    for (const node of Array.from(container.querySelectorAll<HTMLElement>('[aria-roledescription="draggable"]'))) {
      expect(node.getAttribute('role')).toBe('group')
      expect(node.getAttribute('tabindex')).toBe('-1')
      expect(node.hasAttribute('aria-pressed')).toBe(false)
      // A navegação para a ficha continua um link de verdade dentro do grupo arrastável.
      expect(within(node).getAllByRole('link')).toHaveLength(1)
    }
    for (const entry of mobileEntries()) {
      expect(entry.querySelector('[aria-roledescription="draggable"]')).toBeNull()
      expect(entry.querySelectorAll('select')).toHaveLength(1)
    }
  })
})

describe('PipelinePage janela de leads', () => {
  function manyLeads(count: number) {
    return Array.from({ length: count }, (_, index) => makeLead({
      id: `muitos-${index}`,
      name: `Estabelecimento ${index + 1}`,
      status: LEAD_STATUSES[index % LEAD_STATUSES.length],
      city: 'São Paulo',
      score: count - index,
    }))
  }

  it('avisa que só os primeiros 500 aparecem quando a consulta enche a página', async () => {
    mockLeads(manyLeads(PAGE_SIZE), 512)
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    // Sem aria-label no parágrafo: o texto É a mensagem, um rótulo o substituiria.
    const hint = screen.getByText(/^Mostrando os primeiros 500 leads/)
    expect(hint.getAttribute('role')).toBe('status')
    expect(hint.getAttribute('aria-label')).toBeNull()
    expect(hint.textContent).toBe('Mostrando os primeiros 500 leads; há 512 no pipeline. Ajuste os filtros para reduzir a lista.')
    // As contagens por coluna somam exatamente o que foi listado, não o total.
    const listed = LEAD_STATUSES.reduce((sum, status) => sum + columnCount(status), 0)
    expect(listed).toBe(PAGE_SIZE)
    expect(screen.getByRole('option', { name: `Novo (${columnCount('novo')})` })).toBeTruthy()
  })

  it('diz apenas que mostra os primeiros 500 quando o total cabe na página', async () => {
    mockLeads(manyLeads(PAGE_SIZE), PAGE_SIZE)
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    const hint = screen.getByText(/^Mostrando os primeiros 500 leads/)
    expect(hint.getAttribute('role')).toBe('status')
    expect(hint.getAttribute('aria-label')).toBeNull()
    // Nada de "há X no pipeline": não há leads além dos listados.
    expect(hint.textContent).toBe('Mostrando os primeiros 500 leads. Ajuste os filtros para reduzir a lista.')
    expect(hint.textContent).not.toMatch(/há\b/)
  })

  it('não fala de janela quando a consulta devolve menos que a página', async () => {
    mockLeads([barbearia, pizzaria], 2)
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    expect(screen.queryByText(/^Mostrando os primeiros/)).toBeNull()
  })
})

describe('PipelinePage arraste', () => {
  it('decide o destino pelo ponteiro: solto fora do quadro não há coluna sob ele', async () => {
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    const strategy = dnd.props?.collisionDetection
    const args = boardRects()
    // A estratégia ligada é a que ignora o vazio (closestCenter sempre devolveria uma coluna).
    expect(strategy).toBe(pointerWithin)
    expect(strategy?.(args)).toEqual([])
    expect(closestCenter(args).length).toBeGreaterThan(0)
    expect(LEAD_STATUSES).toContain(closestCenter(args)[0]?.id)
    // Continue resolvendo a coluna realmente sobre o ponteiro: o arraste normal não quebra.
    expect(strategy?.({
      ...args,
      pointerCoordinates: { x: 4 * 300 + 100, y: 300 },
    }).map((collision) => String(collision.id))).toEqual(['interessado'])
  })

  it('soltar o card sobre outra coluna grava o status da coluna', async () => {
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    endDrag({ id: 'interessado' })

    expect(setLeadStatus).toHaveBeenCalledWith(barbearia.id, 'interessado')
    expect(columnFor('interessado').getByText(barbearia.name)).toBeTruthy()
    await act(async () => { await Promise.resolve() })
    expect(toast).toHaveBeenCalledWith(`"${barbearia.name}" movido para Interessado.`)
  })

  it('serializa mudanças do mesmo lead e ignora rollback de uma mutação antiga', async () => {
    let rejectFirst!: (reason: Error) => void
    let resolveSecond!: (lead: Lead) => void
    const first = new Promise<Lead>((_resolve, reject) => { rejectFirst = reject })
    const second = new Promise<Lead>((resolve) => { resolveSecond = resolve })
    vi.mocked(setLeadStatus).mockReturnValueOnce(first).mockReturnValueOnce(second)
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    endDrag({ id: 'interessado' })
    endDrag({ id: 'negociando' })

    expect(setLeadStatus).toHaveBeenCalledTimes(1)
    expect(setLeadStatus).toHaveBeenNthCalledWith(1, barbearia.id, 'interessado')

    await act(async () => {
      resolveSecond({ ...barbearia, status: 'negociando' })
      rejectFirst(new Error('A primeira atualização falhou.'))
    })

    await waitFor(() => expect(setLeadStatus).toHaveBeenCalledTimes(2))
    expect(setLeadStatus).toHaveBeenNthCalledWith(2, barbearia.id, 'negociando')
    expect(columnFor('negociando').getByText(barbearia.name)).toBeTruthy()
    expect(columnFor('novo').queryByText(barbearia.name)).toBeNull()
  })

  it('volta ao status original quando duas mudanças consecutivas do mesmo lead falham', async () => {
    vi.mocked(setLeadStatus).mockRejectedValue(new Error('Não foi possível atualizar o status.'))
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    endDrag({ id: 'interessado' })
    endDrag({ id: 'negociando' })

    await waitFor(() => expect(setLeadStatus).toHaveBeenCalledTimes(2))
    expect(setLeadStatus).toHaveBeenNthCalledWith(1, barbearia.id, 'interessado')
    expect(setLeadStatus).toHaveBeenNthCalledWith(2, barbearia.id, 'negociando')
    expect(columnFor('novo').getByText(barbearia.name)).toBeTruthy()
    expect(columnFor('interessado').queryByText(barbearia.name)).toBeNull()
    expect(columnFor('negociando').queryByText(barbearia.name)).toBeNull()
  })

  it('não deixa uma recarga iniciada durante a mutação sobrescrever o status confirmado', async () => {
    let resolveMove!: (lead: Lead) => void
    let resolveReload!: (value: { leads: Lead[]; total: number }) => void
    vi.mocked(setLeadStatus).mockReturnValueOnce(new Promise<Lead>((resolve) => { resolveMove = resolve }))
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    const before = queries().length
    vi.mocked(listLeads)
      .mockReturnValueOnce(new Promise((resolve) => { resolveReload = resolve }))
      .mockResolvedValueOnce({
        leads: PIPELINE_LEADS.map((lead) => (
          lead.id === barbearia.id ? { ...lead, status: 'interessado' as const } : lead
        )),
        total: PIPELINE_LEADS.length,
      })
    endDrag({ id: 'interessado' })
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))

    await act(async () => {
      resolveMove({ ...barbearia, status: 'interessado' })
      resolveReload({ leads: PIPELINE_LEADS, total: PIPELINE_LEADS.length })
    })

    await waitFor(() => expect(queries().length).toBe(before + 2))
    expect(columnFor('interessado').getByText(barbearia.name)).toBeTruthy()
    expect(columnFor('novo').queryByText(barbearia.name)).toBeNull()
  })

  it('mantém o status otimista quando a listagem responde antes da gravação', async () => {
    let resolveMove!: (lead: Lead) => void
    let resolveReload!: (value: { leads: Lead[]; total: number }) => void
    const confirmed = {
      leads: PIPELINE_LEADS.map((lead) => (
        lead.id === barbearia.id ? { ...lead, status: 'interessado' as const } : lead
      )),
      total: PIPELINE_LEADS.length,
    }
    vi.mocked(setLeadStatus).mockReturnValueOnce(new Promise<Lead>((resolve) => { resolveMove = resolve }))
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })
    const before = queries().length

    vi.mocked(listLeads)
      .mockReturnValueOnce(new Promise((resolve) => { resolveReload = resolve }))
      .mockResolvedValueOnce(confirmed)
    endDrag({ id: 'interessado' })
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))

    await act(async () => { resolveReload({ leads: PIPELINE_LEADS, total: PIPELINE_LEADS.length }) })

    expect(queries().length).toBe(before + 1)
    expect(screen.queryByRole('group', { name: STATUS_LABELS.novo })).toBeNull()
    expect(screen.queryByText(barbearia.name)).toBeNull()

    await act(async () => { resolveMove({ ...barbearia, status: 'interessado' }) })

    await waitFor(() => expect(queries().length).toBe(before + 2))
    await waitFor(() => expect(columnFor('interessado').getByText(barbearia.name)).toBeTruthy())
    expect(columnFor('novo').queryByText(barbearia.name)).toBeNull()
  })

  it('refaz uma consulta nova descartada pela conclusão de uma mutação em voo', async () => {
    let resolveMove!: (lead: Lead) => void
    let resolveFiltered!: (value: { leads: Lead[]; total: number }) => void
    vi.mocked(setLeadStatus).mockReturnValueOnce(new Promise<Lead>((resolve) => { resolveMove = resolve }))
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })
    const before = queries().length

    vi.mocked(listLeads).mockReturnValueOnce(new Promise((resolve) => { resolveFiltered = resolve }))
    endDrag({ id: 'interessado' })
    fireEvent.change(screen.getByLabelText('Nicho'), { target: { value: 'pizzaria' } })

    await act(async () => {
      resolveMove({ ...barbearia, status: 'interessado' })
      resolveFiltered({ leads: [pizzaria], total: 1 })
    })

    await waitFor(() => expect(queries().length).toBe(before + 2))
    expect(lastQuery()).toEqual([{ niche: 'pizzaria' }, 'score_desc', 0, PAGE_SIZE])
    expect(columnFor('novo').getByText(pizzaria.name)).toBeTruthy()
    expect(screen.queryByText(barbearia.name)).toBeNull()
  })

  it('soltar no vazio não muda status nem escreve histórico', async () => {
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    endDrag(null)
    // `over` ausente do evento é o outro caminho de "nenhum destino".
    endDrag(undefined)
    await act(async () => { await Promise.resolve() })

    expect(setLeadStatus).not.toHaveBeenCalled()
    expect(addActivity).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
    expect(columnCount('novo')).toBe(2)
    expect(columnFor('novo').getByText(barbearia.name)).toBeTruthy()
  })

  it('ignora id de drop que não é coluna do pipeline', async () => {
    renderPage()
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    endDrag({ id: pizzaria.id })
    endDrag({ id: 'droppable-de-outro-contexto' })
    await act(async () => { await Promise.resolve() })

    expect(setLeadStatus).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
    expect(columnCount('novo')).toBe(2)
  })
})

describe('PipelinePage carregando, erro e vazio', () => {
  it('mostra skeletons enquanto consulta e nunca um pipeline vazio em trânsito', async () => {
    let resolveList!: (value: { leads: Lead[]; total: number }) => void
    vi.mocked(listLeads).mockReturnValue(new Promise((resolve) => { resolveList = resolve }))
    const { container } = renderPage()

    expect(screen.queryByRole('group')).toBeNull()
    expect(screen.queryByText('Pipeline vazio')).toBeNull()
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4)

    await act(async () => {
      resolveList({ leads: PIPELINE_LEADS, total: PIPELINE_LEADS.length })
    })

    expect(screen.getByRole('group', { name: STATUS_LABELS.novo })).toBeTruthy()
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(0)
  })

  it('mostra o erro da consulta em vez de afirmar que o pipeline está vazio', async () => {
    vi.mocked(listLeads).mockRejectedValue(new Error('Falha de conexão com o Supabase. Verifique sua internet.'))
    renderPage()
    const alert = await screen.findByRole('alert')

    expect(alert.textContent).toContain('Falha de conexão com o Supabase')
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy()
    expect(screen.queryByText('Pipeline vazio')).toBeNull()
    expect(screen.queryAllByRole('group')).toHaveLength(0)
    expect(queries().length).toBe(1)

    // Recuperar: a mesma consulta sai do erro e o quadro volta.
    mockLeads(PIPELINE_LEADS)
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await screen.findByRole('group', { name: STATUS_LABELS.novo })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(queries().length).toBe(2)
  })

  it('explica o pipeline vazio quando a consulta realmente não devolve lead', async () => {
    mockLeads([])
    const { container } = renderPage()
    await screen.findByRole('heading', { name: 'Pipeline vazio' })

    expect(screen.getByText(/Cada coluna representa um status comercial/)).toBeTruthy()
    expect(screen.queryByText('Nenhum lead com esses filtros')).toBeNull()
    expect(container.querySelectorAll('a button, a a')).toHaveLength(0)
  })

  it('troca para o estado vazio filtrado e limpa os filtros', async () => {
    mockLeads([])
    renderPage()
    await screen.findByRole('heading', { name: 'Pipeline vazio' })

    fireEvent.change(screen.getByLabelText('Nicho'), { target: { value: 'pizzaria' } })
    await screen.findByRole('heading', { name: 'Nenhum lead com esses filtros' })

    // Resultado filtrado vazio não prova que não há leads cadastrados.
    expect(screen.queryByText(/Cada coluna representa um status comercial/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    await waitFor(() => expect(lastQuery()).toEqual([{}, 'score_desc', 0, PAGE_SIZE]))
    expect((screen.getByLabelText('Nicho') as HTMLSelectElement).value).toBe('')
    await screen.findByRole('heading', { name: 'Pipeline vazio' })
  })
})

describe('KanbanCard corpo e wrapper', () => {
  it('o corpo rendera isolado, sem DndContext e sem registrar arraste', () => {
    const { container } = render(
      <MemoryRouter>
        <KanbanCardBody lead={barbearia} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: barbearia.name })).toBeTruthy()
    // NBSP do formatBRL: o texto do card é comparado cru, não pelo normalizador de matcher.
    const root = container.firstElementChild as HTMLElement
    expect(root.textContent).toContain(formatBRL(barbearia.estimated_value))
    expect(root.textContent).toContain('Potencial estimado')
    expect(root.textContent).toContain('(11) 99999-0001')
    expect(root.textContent).toContain('Barbearia')
    expect(container.querySelector('[aria-roledescription]')).toBeNull()
    // Sem contexto de arraste, o card mobile não finge ser arrastável nem bloqueia o scroll.
    expect(root.className).not.toContain('touch-none')
    expect(root.className).not.toContain('cursor-grab')
  })

  it('não apresenta valor estimado inexistente como moeda', () => {
    // formatBRL converte não-finito em 0: sem o guard, "não estimado" viraria "R$ 0,00".
    for (const value of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      const { container, unmount } = render(
        <MemoryRouter>
          <KanbanCardBody lead={{ ...barbearia, estimated_value: value }} />
        </MemoryRouter>,
      )

      expect(container.textContent).toContain('Sem valor estimado')
      expect(container.textContent).not.toContain('R$')
      unmount()
    }
  })

  it('o wrapper dentro de DndContext é o único que anexa os atributos de arraste', () => {
    const { container } = render(
      <MemoryRouter>
        <DndContext>
          <KanbanCard lead={barbearia} />
        </DndContext>
      </MemoryRouter>,
    )

    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute('aria-roledescription')).toBe('draggable')
    expect(root.getAttribute('aria-describedby')).toBeTruthy()
    expect(root.className).toContain('cursor-grab')
    expect(root.className).toContain('touch-none')
    // Grupo (não botão) e fora da ordem de tab: o card tem conteúdo apresentacional e o único
    // destino de teclado dele é o próprio Link da ficha.
    expect(root.getAttribute('role')).toBe('group')
    expect(root.getAttribute('tabindex')).toBe('-1')
    expect(root.hasAttribute('aria-pressed')).toBe(false)
    // Mesma apresentação do corpo: link para a ficha continua lá.
    expect(root.querySelector('a')?.getAttribute('href')).toBe(`/leads/${barbearia.id}`)
  })
})
