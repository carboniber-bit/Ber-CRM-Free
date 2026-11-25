// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDashboardData, type DashboardData } from '../services/dashboardService'
import { emptyLeadDraft, type Lead } from '../types/lead'
import type { Activity } from '../types/activity'
import type { Followup } from '../types/followup'
import { DashboardPage } from './DashboardPage'

const { stateUpdates } = vi.hoisted(() => ({ stateUpdates: vi.fn() }))

// React 19 não emite mais aviso ao chamar setState depois do unmount. O wrapper preserva o hook
// real e apenas registra setters para que a proteção contra atualização após o unmount seja testável.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  const realUseState = actual.useState
  return {
    ...actual,
    useState: ((...args: Parameters<typeof actual.useState>) => {
      const [state, setState] = (realUseState as (...values: unknown[]) => [
        unknown, (value: unknown) => void,
      ])(...args)
      return [state, (value: unknown) => {
        stateUpdates(value)
        return setState(value)
      }]
    }) as typeof actual.useState,
  }
})

vi.mock('../services/dashboardService', () => ({
  // A página lê o limite da janela do service para escrever o aviso: o mock precisa expor a chave.
  DASHBOARD_LEAD_WINDOW: 1000,
  getDashboardData: vi.fn(),
}))

// Recharts mede layout no DOM e jsdom não mede: o stub devolve exatamente as linhas que cada
// gráfico recebeu. É a fiação que se testa aqui — a matemática da agregação já tem
// src/lib/dashboard.test.ts.
vi.mock('recharts', () => {
  interface StubProps {
    children?: ReactNode
    data?: unknown
    layout?: string
    name?: string
    dataKey?: string
    fill?: string
    stroke?: string
    strokeDasharray?: string
    fontSize?: number
    type?: string
    allowDecimals?: boolean
    contentStyle?: Record<string, unknown>
  }
  function Container({ children }: StubProps) {
    return <div className="chart-box">{children}</div>
  }
  function Chart({ data, layout, children }: StubProps) {
    return (
      <div data-testid="chart" data-layout={layout ?? 'horizontal'} data-rows={JSON.stringify(data ?? [])}>
        {children}
      </div>
    )
  }
  function Series({ name, dataKey, fill, stroke, children }: StubProps) {
    return (
      <span data-testid="series" data-name={name} data-datakey={dataKey} data-fill={fill} data-stroke={stroke}>
        {children}
      </span>
    )
  }
  function CellStub({ fill }: StubProps) {
    return <i data-testid="cell" data-fill={fill} />
  }
  function GridStub({ stroke, strokeDasharray }: StubProps) {
    return <span data-testid="grid" data-stroke={stroke} data-stroke-dasharray={strokeDasharray} />
  }
  function AxisStub({ axis, stroke, fontSize, type, dataKey, allowDecimals }: StubProps & { axis: 'x' | 'y' }) {
    return (
      <span
        data-testid={`${axis}-axis`}
        data-stroke={stroke}
        data-fontsize={fontSize}
        data-type={type}
        data-datakey={dataKey}
        data-allow-decimals={allowDecimals}
      />
    )
  }
  function XAxisStub(props: StubProps) {
    return <AxisStub {...props} axis="x" />
  }
  function YAxisStub(props: StubProps) {
    return <AxisStub {...props} axis="y" />
  }
  function TooltipStub({ contentStyle }: StubProps) {
    return <span data-testid="tooltip" data-content-style={JSON.stringify(contentStyle)} />
  }
  return {
    ResponsiveContainer: Container,
    AreaChart: Chart,
    Area: Series,
    BarChart: Chart,
    Bar: Series,
    Cell: CellStub,
    CartesianGrid: GridStub,
    Tooltip: TooltipStub,
    XAxis: XAxisStub,
    YAxis: YAxisStub,
  }
})

// Relógio fixo: as chaves "MM/AA" de leadsByMonth e o flag de atrasado saem daqui, não do
// `new Date()` da máquina que roda o teste.
const NOW = new Date(2026, 10, 25, 12, 0, 0)
const HOUR = 3_600_000
const DAY = 24 * HOUR
const LEAD_WINDOW = 1000
const UNKNOWN_LEAD_NAME = 'Nome do lead não carregado'

const at = (month: number, day: number, hour = 9) => new Date(2026, month, day, hour, 0, 0).toISOString()
const offset = (ms: number) => new Date(NOW.getTime() + ms).toISOString()

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
    created_at: at(10, 15),
    updated_at: at(10, 15),
    ...overrides,
  } as Lead
}

function makeFollowup(overrides: Partial<Followup> = {}): Followup {
  return {
    id: `followup-${overrides.lead_id ?? 'x'}-${overrides.due_at ?? 'd'}`,
    lead_id: 'lead-1',
    owner_id: '00000000-0000-0000-0000-000000000201',
    due_at: offset(HOUR),
    reason: null,
    note: null,
    status: 'pendente',
    completed_at: null,
    result: null,
    created_at: at(10, 20),
    updated_at: at(10, 20),
    ...overrides,
  }
}

function makeActivity(
  overrides: Partial<Activity> & { leadName?: string } = {},
): Activity & { leadName: string } {
  return {
    id: `activity-${overrides.description ?? 'a'}`,
    lead_id: 'lead-1',
    owner_id: '00000000-0000-0000-0000-000000000201',
    type: 'observacao',
    description: 'Registro',
    user_id: null,
    created_at: at(10, 24, 18),
    leadName: 'Barbearia do Bairro',
    ...overrides,
  }
}

// 6 leads: 4 oportunidades elegíveis (needs confirmadas + status elegível), a clínica perdida com
// needs e a barbearia sem needs. Nascidos em outubro (2) e novembro (4) para o gráfico de período.
const barbearia = makeLead({
  id: 'lead-1', name: 'Barbearia do Bairro', niche: 'barbearia', status: 'novo',
  priority: 'muito_alta', needs: ['site'], created_at: at(10, 15),
})
const pizzaria = makeLead({
  id: 'lead-2', name: 'Pizzaria Forno a Lenha', niche: 'pizzaria', status: 'contato_realizado',
  priority: 'alta', needs: ['cardapio'], created_at: at(10, 12),
})
const salao = makeLead({
  id: 'lead-3', name: 'Salão Novo Olhar', niche: 'salao_beleza', status: 'interessado',
  priority: 'media', needs: ['site'], created_at: at(10, 10),
})
const clinica = makeLead({
  id: 'lead-4', name: 'Clínica Sorriso', niche: 'clinica_estetica', status: 'perdido',
  priority: 'alta', needs: ['site'], created_at: at(9, 8),
})
// Mesmo nicho da primeira barbearia e mesma prioridade do salão: dá vencedor claro nos dois gráficos.
const barbearia2 = makeLead({
  id: 'lead-5', name: 'Barbearia da Esquina', niche: 'barbearia', status: 'novo',
  priority: 'media', needs: [], created_at: at(9, 20),
})
const cafeteria = makeLead({
  id: 'lead-6', name: 'Cafeteria Central', niche: 'cafeteria', status: 'negociando',
  priority: 'media', needs: ['landing'], created_at: at(10, 3),
})

const LEADS = [barbearia, pizzaria, salao, clinica, barbearia2, cafeteria]

// 7 pendentes + 1 concluído: a lista mostra os 6 mais próximos e o concluído nunca.
const FOLLOWUPS = [
  makeFollowup({ id: 'fu-4', lead_id: 'lead-2', due_at: offset(3 * DAY) }),
  makeFollowup({ id: 'fu-1', lead_id: 'lead-1', due_at: offset(-5 * HOUR) }),
  makeFollowup({ id: 'fu-9', lead_id: 'lead-4', due_at: offset(6 * DAY) }),
  makeFollowup({ id: 'fu-2', lead_id: 'lead-3', due_at: offset(DAY) }),
  makeFollowup({ id: 'fu-3', lead_id: 'lead-fora-da-janela', due_at: offset(2 * DAY) }),
  makeFollowup({ id: 'fu-5', lead_id: 'lead-5', due_at: offset(4 * DAY) }),
  makeFollowup({ id: 'fu-6', lead_id: 'lead-6', due_at: offset(5 * DAY) }),
  makeFollowup({ id: 'fu-7', lead_id: 'lead-1', due_at: offset(-2 * DAY), status: 'concluido' }),
]

// 12 atividades no fixture para provar o corte defensivo em 8 linhas. As mudanças de status do
// painel próprio vêm de uma fonte independente, com descrições que não existem neste payload.
const ACTIVITIES: Array<Activity & { leadName: string }> = [
  makeActivity({ id: 'act-1', type: 'mudanca_status', description: 'Mudança 1', lead_id: 'lead-1', leadName: barbearia.name }),
  makeActivity({ id: 'act-2', type: 'ligacao', description: 'Ligação 1', lead_id: 'lead-2', leadName: pizzaria.name }),
  makeActivity({ id: 'act-3', type: 'mudanca_status', description: 'Mudança 2', lead_id: 'lead-3', leadName: salao.name }),
  makeActivity({ id: 'act-4', type: 'mensagem', description: 'Mensagem 1', lead_id: 'lead-1', leadName: barbearia.name }),
  makeActivity({ id: 'act-5', type: 'mudanca_status', description: 'Mudança 3', lead_id: 'lead-6', leadName: cafeteria.name }),
  makeActivity({ id: 'act-6', type: 'reuniao', description: 'Reunião 1', lead_id: 'lead-2', leadName: pizzaria.name }),
  makeActivity({ id: 'act-7', type: 'mudanca_status', description: 'Mudança 4', lead_id: 'lead-4', leadName: clinica.name }),
  makeActivity({ id: 'act-8', type: 'observacao', description: 'Observação 1', lead_id: 'lead-5', leadName: barbearia2.name }),
  makeActivity({ id: 'act-9', type: 'mudanca_status', description: 'Mudança 5', lead_id: 'lead-1', leadName: barbearia.name }),
  makeActivity({ id: 'act-10', type: 'mudanca_status', description: 'Mudança 6', lead_id: 'lead-3', leadName: salao.name }),
  makeActivity({ id: 'act-11', type: 'mudanca_status', description: 'Mudança 7', lead_id: 'lead-2', leadName: pizzaria.name }),
  makeActivity({ id: 'act-12', type: 'proposta', description: 'Proposta 1', lead_id: 'lead-6', leadName: cafeteria.name }),
]

const STATUS_CHANGES: Array<Activity & { leadName: string }> = Array.from({ length: 7 }, (_, index) => (
  makeActivity({
    id: `status-${index + 1}`,
    type: 'mudanca_status',
    description: `Mudança dedicada ${index + 1}`,
    lead_id: barbearia.id,
    leadName: barbearia.name,
    created_at: new Date(NOW.getTime() - index * HOUR).toISOString(),
  })
))

const RECENT_LEADS = [cafeteria, barbearia2, barbearia, pizzaria, salao]

function dashboardData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    leads: LEADS,
    totalLeads: LEADS.length,
    followups: FOLLOWUPS,
    recentActivities: ACTIVITIES,
    recentStatusChanges: STATUS_CHANGES,
    recentLeads: RECENT_LEADS,
    ...overrides,
  }
}

function mockData(overrides: Partial<DashboardData> = {}) {
  vi.mocked(getDashboardData).mockResolvedValue(dashboardData(overrides))
}

async function settle() {
  // A carga mockada resolve em microtarefas; sob `vi.useFakeTimers()` é assim que o `await load()`
  // da página termina sem depender de relógio adiantado.
  for (let i = 0; i < 8; i += 1) {
    await act(async () => { await Promise.resolve() })
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/leads/:id" element={<div>Ficha do lead</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function renderLoaded(overrides: Partial<DashboardData> = {}) {
  mockData(overrides)
  const utils = renderPage()
  await settle()
  return utils
}

// Card do kit: h2 → div do cabeçalho → raiz do card. Escopo de consulta pelo título do painel.
function card(title: string): HTMLElement {
  const heading = screen.getByRole('heading', { name: title })
  const root = heading.parentElement?.parentElement as HTMLElement
  expect(root).toBeTruthy()
  return root
}

function chartOf(title: string): HTMLElement {
  return within(card(title)).getByTestId('chart')
}

function chartRows(title: string): Array<Record<string, unknown>> {
  return JSON.parse(chartOf(title).getAttribute('data-rows') ?? '[]') as Array<Record<string, unknown>>
}

function seriesOf(title: string): HTMLElement {
  return within(chartOf(title)).getByTestId('series')
}

function indicatorValue(label: string): string {
  return within(screen.getByRole('group', { name: label })).getByText(/^\d+$/).textContent ?? ''
}

function followupRows(): HTMLElement[] {
  return within(card('Próximos follow-ups')).getAllByRole('link')
}

function rowName(row: HTMLElement): string {
  return (row.firstElementChild as HTMLElement).textContent ?? ''
}

let consoleError: ReturnType<typeof vi.spyOn>
let consoleWarn: ReturnType<typeof vi.spyOn>

afterEach(() => {
  cleanup()
  // Nenhum caminho renderizado pode gerar aviso de console (act aninhado, chave faltando,
  // controle interativo aninhado em link).
  expect(consoleError).not.toHaveBeenCalled()
  expect(consoleWarn).not.toHaveBeenCalled()
  consoleError.mockRestore()
  consoleWarn.mockRestore()
  vi.useRealTimers()
})

beforeEach(() => {
  seq = 0
  // Também descarta promessas/reações deixadas por um teste que falhou antes de consumir o mock.
  vi.resetAllMocks()
  stateUpdates.mockClear()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  consoleError = vi.spyOn(console, 'error')
  consoleWarn = vi.spyOn(console, 'warn')
  mockData()
})

describe('DashboardPage estados da carga', () => {
  it('mostra 10 skeletons e nenhum número enquanto a carga não responde', () => {
    vi.mocked(getDashboardData).mockReturnValue(new Promise<DashboardData>(() => {}))
    const { container } = renderPage()

    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(10)
    expect(screen.getByRole('status').textContent).toContain('Carregando dashboard')
    expect(screen.queryByRole('group', { name: 'Total de leads' })).toBeNull()
    expect(screen.queryAllByTestId('chart')).toHaveLength(0)
    expect(screen.queryByText('Seu CRM está pronto para começar')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('carrega uma única vez na montagem', async () => {
    await renderLoaded()

    expect(getDashboardData).toHaveBeenCalledTimes(1)
  })

  it('sincroniza o relógio quando uma carga lenta termina', async () => {
    const request = deferred<DashboardData>()
    vi.mocked(getDashboardData).mockReturnValue(request.promise)
    renderPage()

    // setSystemTime simula o tempo passando sem disparar o intervalo de 60 s.
    vi.setSystemTime(new Date(NOW.getTime() + 2 * HOUR))
    await act(async () => {
      request.resolve(dashboardData({
        followups: [makeFollowup({ id: 'fu-carga-lenta', lead_id: 'lead-1', due_at: offset(HOUR / 2) })],
      }))
    })
    await settle()

    expect(indicatorValue('Follow-ups atrasados')).toBe('1')
    expect(followupRows()[0].querySelector('time')?.textContent).toContain('· atrasado')
  })

  it('carga B resolve antes de A e a resposta obsoleta não sobrescreve B', async () => {
    const loadA = deferred<DashboardData>()
    const loadB = deferred<DashboardData>()
    vi.mocked(getDashboardData)
      .mockReturnValueOnce(loadA.promise)
      .mockReturnValueOnce(loadB.promise)
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    expect(getDashboardData).toHaveBeenCalledTimes(2)

    const dataB = dashboardData({
      leads: [barbearia, pizzaria], totalLeads: 2, followups: [], recentActivities: [],
      recentStatusChanges: [], recentLeads: [barbearia, pizzaria],
    })
    await act(async () => { loadB.resolve(dataB) })
    await settle()
    expect(indicatorValue('Total de leads')).toBe('2')

    const dataA = dashboardData({
      leads: [salao], totalLeads: 1, followups: [], recentActivities: [],
      recentStatusChanges: [], recentLeads: [salao],
    })
    await act(async () => { loadA.resolve(dataA) })
    await settle()

    expect(indicatorValue('Total de leads')).toBe('2')
    expect(screen.getByText(barbearia.name)).toBeTruthy()
    expect(screen.queryByText(salao.name)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('rejeição de uma carga antiga não derruba a carga nova já resolvida', async () => {
    const loadA = deferred<DashboardData>()
    const loadB = deferred<DashboardData>()
    vi.mocked(getDashboardData)
      .mockReturnValueOnce(loadA.promise)
      .mockReturnValueOnce(loadB.promise)
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    await act(async () => { loadB.resolve(dashboardData({ totalLeads: 42 })) })
    await settle()
    expect(indicatorValue('Total de leads')).toBe('42')

    await act(async () => { loadA.reject(new Error('Falha obsoleta')) })
    await settle()

    expect(indicatorValue('Total de leads')).toBe('42')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('resolução após unmount não atualiza estado nem emite aviso de console', async () => {
    const request = deferred<DashboardData>()
    vi.mocked(getDashboardData).mockReturnValue(request.promise)
    const { unmount } = renderPage()
    unmount()
    stateUpdates.mockClear()

    await act(async () => { request.resolve(dashboardData()) })
    await settle()

    expect(getDashboardData).toHaveBeenCalledTimes(1)
    expect(stateUpdates).not.toHaveBeenCalled()
    expect(consoleError).not.toHaveBeenCalled()
    expect(consoleWarn).not.toHaveBeenCalled()
  })

  it('mostra o erro em vez de afirmar dashboard vazio e o retry chama o service de novo', async () => {
    vi.mocked(getDashboardData).mockRejectedValueOnce(
      new Error('Falha de conexão com o Supabase. Verifique sua internet.'),
    )
    const { container } = renderPage()
    await settle()

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Falha de conexão com o Supabase')
    expect(screen.queryAllByTestId('chart')).toHaveLength(0)
    expect(screen.queryByRole('group', { name: 'Total de leads' })).toBeNull()
    expect(screen.queryByText('Seu CRM está pronto para começar')).toBeNull()
    expect(getDashboardData).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await settle()

    expect(getDashboardData).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(indicatorValue('Total de leads')).toBe('6')
    expect(container.querySelectorAll('a button, a a')).toHaveLength(0)
  })

  it('rejeição que não é Error cai na copy genérica, nunca em número vazio', async () => {
    vi.mocked(getDashboardData).mockRejectedValueOnce('boom')
    renderPage()
    await settle()

    expect(screen.getByRole('alert').textContent).toContain('Erro ao carregar dashboard.')
  })

  it('Atualizar refaz a carga inteira', async () => {
    await renderLoaded()
    expect(getDashboardData).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    await settle()

    expect(getDashboardData).toHaveBeenCalledTimes(2)
    expect(indicatorValue('Total de leads')).toBe('6')
  })

  it('só mostra o estado global quando todas as cinco fontes estão vazias', async () => {
    const { container } = await renderLoaded({
      leads: [],
      totalLeads: 0,
      followups: [],
      recentActivities: [],
      recentStatusChanges: [],
      recentLeads: [],
    })

    expect(screen.getByRole('heading', { name: 'Seu CRM está pronto para começar' })).toBeTruthy()
    expect(screen.getByText(/Nenhum dado fictício é exibido aqui/)).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Total de leads' })).toBeNull()
    expect(screen.queryAllByTestId('chart')).toHaveLength(0)
    expect(screen.queryByText('Atividades recentes')).toBeNull()
    // Nenhum indicador aparece sem nenhuma fonte: sem dado, sem número na tela.
    expect(screen.queryAllByRole('group')).toHaveLength(0)
    expect(container.textContent).not.toMatch(/lorem/i)
    expect(container.textContent).not.toContain('R$')
    // O CTA é link estilizado: nenhum botão dentro de link.
    const cta = screen.getByRole('link', { name: /Cadastrar primeiro lead/ })
    expect(cta.getAttribute('href')).toBe('/leads/novo')
    expect(cta.className).toContain('focus-visible:outline-2')
    expect(cta.className).toContain('focus-visible:outline-offset-2')
    expect(cta.className).toContain('focus-visible:outline-accent')
    expect(container.querySelectorAll('a button, a a')).toHaveLength(0)
  })

  const nonEmptySources: Array<[string, Partial<DashboardData>, string]> = [
    ['follow-ups', { followups: [makeFollowup({ lead_id: 'lead-fora-da-janela' })] }, UNKNOWN_LEAD_NAME],
    ['atividades', { recentActivities: [makeActivity({ description: 'Atividade carregada' })] }, 'Observação — Atividade carregada'],
    ['mudanças de status', { recentStatusChanges: [makeActivity({ type: 'mudanca_status', description: 'Status carregado' })] }, 'Status carregado'],
    ['leads recentes', { recentLeads: [barbearia] }, barbearia.name],
  ]

  it.each(nonEmptySources)('mantém o dashboard quando só %s tem dados', async (_source, override, visibleText) => {
    const { container } = await renderLoaded({
      leads: [], totalLeads: 0, followups: [], recentActivities: [], recentStatusChanges: [], recentLeads: [],
      ...override,
    })

    expect(screen.queryByRole('heading', { name: 'Seu CRM está pronto para começar' })).toBeNull()
    expect(indicatorValue('Total de leads')).toBe('0')
    expect(container.querySelectorAll('[data-testid="chart"]')).toHaveLength(5)
    expect(screen.getByText(visibleText)).toBeTruthy()
    expect(container.textContent).not.toMatch(/Nenhum dado fictício é exibido aqui/)
  })
})

describe('DashboardPage indicadores', () => {
  it('rendera os 10 indicadores com os números calculados sobre os leads carregados', async () => {
    await renderLoaded()

    expect(indicatorValue('Total de leads')).toBe('6')
    expect(indicatorValue('Novos')).toBe('2')
    expect(indicatorValue('Contatados')).toBe('1')
    expect(indicatorValue('Interessados')).toBe('1')
    expect(indicatorValue('Em negociação')).toBe('1')
    // Nenhum lead com status 'aceitou' na carga: zero real, não número decorativo.
    expect(indicatorValue('Convertidos')).toBe('0')
    // Elegível = needs não vazio e status elegível: ficam fora a clínica perdida e a barbearia sem needs.
    expect(indicatorValue('Oportunidades')).toBe('4')
    expect(indicatorValue('Alta prioridade')).toBe('2')
    expect(indicatorValue('Follow-ups pendentes')).toBe('7')
    expect(indicatorValue('Follow-ups atrasados')).toBe('1')
    expect(screen.getAllByRole('group')).toHaveLength(10)
  })

  it('não apresenta o dashboard como receita, faturamento ou cliente', async () => {
    const { container } = await renderLoaded()

    expect(container.textContent).not.toMatch(/faturamento|receita|recebido|contratado|cliente/i)
    expect(container.textContent).not.toContain('R$')
  })
})

describe('DashboardPage janela de leads', () => {
  it('avisa o recorte dos indicadores de leads e gráficos sem esconder o total exato', async () => {
    const windowed = Array.from({ length: LEAD_WINDOW }, (_, index) => makeLead({
      id: `janela-${index}`,
      name: `Lead da janela ${index + 1}`,
      status: 'novo',
      created_at: at(10, 15),
    }))
    await renderLoaded({ leads: windowed, totalLeads: 1042 })

    const hint = screen.getByRole('status')
    expect(hint.textContent).toBe(
      'Os indicadores de leads (exceto o total) e os gráficos são calculados sobre os 1000 leads '
      + 'mais recentes; há 1042 leads no total. As contagens de follow-ups usam todos os follow-ups '
      + 'carregados. Afine a lista nas páginas de Leads e de Oportunidades.',
    )
    // O cartão usa o count exato do banco; apenas os derivados de leads usam a janela.
    expect(indicatorValue('Total de leads')).toBe('1042')
    expect(indicatorValue('Follow-ups pendentes')).toBe('7')
    expect(indicatorValue('Follow-ups atrasados')).toBe('1')
    expect(chartRows('Leads cadastrados ao longo do tempo').at(-1)).toEqual({ month: '11/26', total: 1000 })
  })

  it('omite o total quando a janela é o banco inteiro', async () => {
    const windowed = Array.from({ length: LEAD_WINDOW }, (_, index) => makeLead({
      id: `janela-cheia-${index}`,
      name: `Lead da janela ${index + 1}`,
      status: 'novo',
      created_at: at(10, 15),
    }))
    await renderLoaded({ leads: windowed, totalLeads: LEAD_WINDOW })

    expect(screen.getByRole('status').textContent).toBe(
      'Os indicadores de leads (exceto o total) e os gráficos são calculados sobre os 1000 leads '
      + 'mais recentes. As contagens de follow-ups usam todos os follow-ups carregados. '
      + 'Afine a lista nas páginas de Leads e de Oportunidades.',
    )
  })

  it('não fala de janela quando os leads cabem na carga', async () => {
    await renderLoaded()

    expect(screen.queryByRole('status')).toBeNull()
    expect(document.body.textContent).not.toMatch(/mais recentes/)
    expect(document.body.textContent).not.toMatch(/há \d+ leads no total/)
  })
})

describe('DashboardPage gráficos', () => {
  it('aplica grid, texto dos eixos e tooltip com o estilo mandado em todos os gráficos', async () => {
    await renderLoaded()

    const titles = [
      'Leads cadastrados ao longo do tempo',
      'Leads por nicho',
      'Leads por status',
      'Oportunidades por prioridade',
      'Conversão de leads',
    ]
    for (const title of titles) {
      const chart = chartOf(title)
      const grid = within(chart).getByTestId('grid')
      expect(grid.getAttribute('data-stroke')).toBe('#2a2a2a')
      expect(grid.getAttribute('data-stroke-dasharray')).toBe('3 3')
      for (const axis of ['x', 'y']) {
        const element = within(chart).getByTestId(`${axis}-axis`)
        expect(element.getAttribute('data-stroke')).toBe('#a3a3a3')
        expect(element.getAttribute('data-fontsize')).toBe('11')
      }
      expect(JSON.parse(within(chart).getByTestId('tooltip').getAttribute('data-content-style') ?? '{}')).toEqual({
        backgroundColor: '#1e1e1e',
        border: '1px solid #2a2a2a',
        borderRadius: 12,
        color: '#fff',
        fontSize: 12,
      })
    }
  })

  it('plota os 6 meses relativos a hoje com os leads de cada mês', async () => {
    await renderLoaded()

    expect(chartRows('Leads cadastrados ao longo do tempo')).toEqual([
      { month: '06/26', total: 0 },
      { month: '07/26', total: 0 },
      { month: '08/26', total: 0 },
      { month: '09/26', total: 0 },
      { month: '10/26', total: 2 },
      { month: '11/26', total: 4 },
    ])
    const area = seriesOf('Leads cadastrados ao longo do tempo')
    expect(area.getAttribute('data-datakey')).toBe('total')
    expect(area.getAttribute('data-stroke')).toBe('#22c55e')
    expect(area.getAttribute('data-fill')).toBe('#22c55e')
  })

  it('mostra leads por nicho com rótulo traduzido, ordenado do maior para o menor', async () => {
    await renderLoaded()

    expect(chartRows('Leads por nicho')).toEqual([
      { label: 'Barbearia', total: 2 },
      { label: 'Pizzaria', total: 1 },
      { label: 'Salão de beleza', total: 1 },
      { label: 'Clínica de estética', total: 1 },
      { label: 'Cafeteria', total: 1 },
    ])
    expect(seriesOf('Leads por nicho').getAttribute('data-fill')).toBe('#6db5ff')
  })

  it('reúne lead sem nicho em Outros em vez de inventar nicho', async () => {
    await renderLoaded({
      leads: [barbearia, barbearia2, makeLead({ id: 'lead-sem-nicho', name: 'Sem Nicho', niche: null })],
      totalLeads: 3,
    })

    expect(chartRows('Leads por nicho')).toEqual([
      { label: 'Barbearia', total: 2 },
      { label: 'Outros', total: 1 },
    ])
  })

  it('gráfico de status inclui perdido: é a régua de status, não de oportunidades', async () => {
    await renderLoaded()

    expect(chartRows('Leads por status')).toEqual([
      { label: 'Novo', total: 2 },
      { label: 'Contato realizado', total: 1 },
      { label: 'Interessado', total: 1 },
      { label: 'Perdido', total: 1 },
      { label: 'Negociando', total: 1 },
    ])
    expect(seriesOf('Leads por status').getAttribute('data-fill')).toBe('#22c55e')
  })

  it('prioridade conta só oportunidades e cada barra recebe a cor do próprio rótulo', async () => {
    await renderLoaded()

    // Clínica (alta) tem needs mas status perdido; Barbearia da Esquina (media) não tem needs:
    // as duas ficam fora — o gráfico é de oportunidades, e o título diz isso.
    expect(chartRows('Oportunidades por prioridade')).toEqual([
      { label: 'Média', total: 2 },
      { label: 'Muito alta', total: 1 },
      { label: 'Alta', total: 1 },
    ])
    const series = seriesOf('Oportunidades por prioridade')
    expect(series.getAttribute('data-name')).toBe('Oportunidades')
    expect(series.getAttribute('data-fill')).toBeNull()
    const cells = within(chartOf('Oportunidades por prioridade')).getAllByTestId('cell')
    expect(cells).toHaveLength(3)
    // A ordem das Cells vem do MESMO countBy das barras: 'Média' tem que sair azul, não cinza.
    expect(cells.map((cell) => cell.getAttribute('data-fill'))).toEqual(['#6db5ff', '#ff5de7', '#fefa3d'])
  })

  it('funil de conversão traz as 5 etapas fixas, em barras horizontais', async () => {
    await renderLoaded()

    expect(chartOf('Conversão de leads').getAttribute('data-layout')).toBe('vertical')
    expect(chartRows('Conversão de leads')).toEqual([
      { label: 'Novo', total: 2 },
      { label: 'Contatado', total: 1 },
      { label: 'Interessado', total: 1 },
      { label: 'Negociando', total: 1 },
      { label: 'Aceitou', total: 0 },
    ])
    expect(seriesOf('Conversão de leads').getAttribute('data-fill')).toBe('#fefa3d')
  })
})

describe('DashboardPage próximos follow-ups', () => {
  it('ordena do vencimento mais cedo para o mais tarde e mostra no máximo 6 pendentes', async () => {
    await renderLoaded()

    const rows = followupRows()
    expect(rows).toHaveLength(6)
    expect(rows.map(rowName)).toEqual([
      barbearia.name,
      salao.name,
      UNKNOWN_LEAD_NAME,
      pizzaria.name,
      barbearia2.name,
      cafeteria.name,
    ])
    // O atrasado abre a lista; o 7º pendente (mais distante) e o concluído ficam fora.
    const times = rows.map((row) => row.querySelector('time')?.textContent ?? '')
    expect(times[0]).toContain('· atrasado')
    for (const time of times.slice(1)) expect(time).not.toContain('atrasado')
    expect(within(card('Próximos follow-ups')).queryByText(clinica.name)).toBeNull()
  })

  it('marca o vencido com o tratamento de atrasado e liga cada linha à ficha do lead', async () => {
    await renderLoaded()

    const rows = followupRows()
    const overdue = rows[0]
    const future = rows[1]
    expect(overdue.className).toContain('border-danger/40')
    const time = overdue.querySelector('time') as HTMLElement
    expect(time.className).toContain('text-danger')
    expect(time.getAttribute('datetime')).toBe(offset(-5 * HOUR))
    expect(time.textContent).toContain('· atrasado')
    expect(future.className).not.toContain('border-danger/40')
    expect((future.querySelector('time') as HTMLElement).className).not.toContain('text-danger')
    expect(future.querySelector('time')?.textContent).not.toContain('atrasado')

    expect(overdue.getAttribute('href')).toBe('/leads/lead-1')
    expect(rows[2].getAttribute('href')).toBe('/leads/lead-fora-da-janela')
  })

  it('nome fora da janela de leads carregada não afirma que o lead foi removido', async () => {
    await renderLoaded()

    const row = followupRows()[2]
    expect(rowName(row)).toBe(UNKNOWN_LEAD_NAME)
    expect(row.textContent).not.toMatch(/removido|exclu/i)
  })

  it('atualiza KPI e marcador quando um pendente vence sem refetchar os dados', async () => {
    await renderLoaded({
      // Vence um segundo antes do tick de 60 s: o relógio compartilhado já passou do vencimento
      // quando a página renderiza de novo, sem depender de uma nova consulta.
      followups: [makeFollowup({ id: 'fu-relogio', lead_id: 'lead-1', due_at: offset(HOUR - 1000) })],
    })

    expect(indicatorValue('Follow-ups atrasados')).toBe('0')
    expect(followupRows()[0].querySelector('time')?.textContent).not.toContain('atrasado')

    await act(async () => { vi.advanceTimersByTime(HOUR) })

    expect(indicatorValue('Follow-ups atrasados')).toBe('1')
    expect(followupRows()[0].querySelector('time')?.textContent).toContain('· atrasado')
    expect(getDashboardData).toHaveBeenCalledTimes(1)
  })

  it('sem follow-up pendente orienta agendar em vez de sumir com o painel', async () => {
    await renderLoaded({ followups: [makeFollowup({ lead_id: 'lead-2', due_at: offset(DAY), status: 'concluido' })] })

    expect(within(card('Próximos follow-ups')).getByText(/Nenhum follow-up pendente/)).toBeTruthy()
    expect(within(card('Próximos follow-ups')).queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.getByRole('link', { name: 'Agende um contato' }).getAttribute('href')).toBe('/followups')
    expect(indicatorValue('Follow-ups pendentes')).toBe('0')
    expect(indicatorValue('Follow-ups atrasados')).toBe('0')
  })
})

describe('DashboardPage atividades e mudanças de status', () => {
  it('lista os últimos leads cadastrados na ordem recebida', async () => {
    await renderLoaded()

    const rows = within(card('Últimos leads cadastrados')).getAllByRole('link')
    expect(rows.map(rowName)).toEqual([
      cafeteria.name, barbearia2.name, barbearia.name, pizzaria.name, salao.name,
    ])
    expect(rows[0].getAttribute('href')).toBe(`/leads/${cafeteria.id}`)
  })

  it('painel de últimos leads não fica em branco nem nega leads quando só a consulta recente vem vazia', async () => {
    const { container } = await renderLoaded({ recentLeads: [] })

    const panel = card('Últimos leads cadastrados')
    expect(within(panel).getByText('Nenhum lead recente carregado.')).toBeTruthy()
    expect(within(panel).queryAllByRole('listitem')).toHaveLength(0)
    // Os demais painéis seguem com os dados carregados: o painel vazio não derruba a página.
    expect(container.querySelectorAll('a button, a a')).toHaveLength(0)
    expect(indicatorValue('Total de leads')).toBe('6')
  })

  it('mostra no máximo 8 atividades e rotula cada tipo', async () => {
    await renderLoaded()

    const panel = card('Atividades recentes')
    expect(within(panel).getAllByRole('listitem')).toHaveLength(8)
    expect(within(panel).getByText('Ligação realizada — Ligação 1')).toBeTruthy()
    expect(within(panel).getByText('Mudança de status — Mudança 1')).toBeTruthy()
    expect(within(panel).queryByText('Mudança de status — Mudança 5')).toBeNull()
    expect(within(panel).queryByText('Envio de proposta — Proposta 1')).toBeNull()
    // O nome vem do join do service, não do mapa de leads da página.
    expect(within(panel).getByText(clinica.name)).toBeTruthy()
  })

  it('renderiza a fonte dedicada de mudanças de status, com no máximo 5 linhas', async () => {
    const { container } = await renderLoaded()

    const panel = card('Mudanças de status recentes')
    const items = within(panel).getAllByRole('listitem')
    expect(items.map((item) => (item.lastElementChild as HTMLElement).textContent)).toEqual([
      'Mudança dedicada 1', 'Mudança dedicada 2', 'Mudança dedicada 3',
      'Mudança dedicada 4', 'Mudança dedicada 5',
    ])
    // A 6ª e a 7ª mudanças existem na fonte dedicada, mas não cabem no painel.
    expect(within(panel).queryByText('Mudança dedicada 6')).toBeNull()
    expect(within(panel).queryByText('Mudança dedicada 7')).toBeNull()
    // O painel não deriva mudanças do payload genérico de atividades.
    expect(within(panel).queryByText('Mudança 1')).toBeNull()
    expect(within(panel).queryByText('Ligação 1')).toBeNull()
    expect(getDashboardData).toHaveBeenCalledTimes(1)
    expect(container.querySelectorAll('a button, a a')).toHaveLength(0)
  })

  it('fontes de atividade vazias têm copy neutra e independem uma da outra', async () => {
    await renderLoaded({ recentActivities: [], recentStatusChanges: [] })

    expect(within(card('Atividades recentes')).getByText('Nenhuma atividade recente carregada.')).toBeTruthy()
    expect(within(card('Mudanças de status recentes')).getByText('Nenhuma mudança de status recente carregada.')).toBeTruthy()
  })

  it('atividade sem lead no join informa que o nome não carregou, sem inventar nome', async () => {
    const orphan = makeActivity({
      id: 'act-orfa', type: 'mudanca_status', description: 'Mudança órfã', leadName: UNKNOWN_LEAD_NAME,
    })
    await renderLoaded({ recentActivities: [orphan], recentStatusChanges: [orphan] })

    expect(within(card('Atividades recentes')).getByRole('link', { name: UNKNOWN_LEAD_NAME }).getAttribute('href'))
      .toBe('/leads/lead-1')
    expect(within(card('Mudanças de status recentes')).getByRole('link', { name: UNKNOWN_LEAD_NAME })).toBeTruthy()
    expect(within(card('Mudanças de status recentes')).getByText('Mudança órfã')).toBeTruthy()
  })
})

describe('DashboardPage navegação', () => {
  it('as 4 ações rápidas são links e nenhum botão aninha dentro deles', async () => {
    const { container } = await renderLoaded()

    const actions = within(screen.getByRole('navigation', { name: 'Ações rápidas' })).getAllByRole('link')
    expect(actions.map((link) => [link.textContent?.trim(), link.getAttribute('href')])).toEqual([
      ['Novo lead', '/leads/novo'],
      ['Ver oportunidades', '/oportunidades'],
      ['Abrir pipeline', '/pipeline'],
      ['Ver follow-ups', '/followups'],
    ])
    for (const link of actions) {
      expect(link.className).toContain('focus-visible:outline-2')
      expect(link.className).toContain('focus-visible:outline-offset-2')
      expect(link.className).toContain('focus-visible:outline-accent')
    }
    expect(container.querySelectorAll('a button, a a')).toHaveLength(0)
    expect(container.querySelectorAll('nav button')).toHaveLength(0)
  })
})
