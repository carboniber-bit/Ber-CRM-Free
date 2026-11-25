import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as activityService from './activityService'
import { listRecentActivities } from './activityService'
import { listFollowups } from './followupService'
import { listLeads, listRecentLeads } from './leadService'
import { DASHBOARD_LEAD_WINDOW, getDashboardData } from './dashboardService'
import { emptyLeadDraft, type Lead } from '../types/lead'
import type { Followup } from '../types/followup'
import type { Activity } from '../types/activity'

vi.mock('./activityService', () => ({
  listRecentActivities: vi.fn(),
  listRecentStatusChanges: vi.fn(),
}))
vi.mock('./followupService', () => ({ listFollowups: vi.fn() }))
vi.mock('./leadService', () => ({ listLeads: vi.fn(), listRecentLeads: vi.fn() }))

function lead(id: string, overrides: Partial<Lead> = {}): Lead {
  return {
    ...emptyLeadDraft(),
    id,
    owner_id: 'owner',
    name: `Lead ${id}`,
    score: 0,
    priority: 'baixa',
    needs: [],
    score_reasons: [],
    created_at: '2026-11-20T00:00:00.000Z',
    updated_at: '2026-11-20T00:00:00.000Z',
    ...overrides,
  } as Lead
}

const followup = {
  id: 'fu-1',
  lead_id: 'l-1',
  owner_id: 'owner',
  due_at: '2026-11-26T09:00:00.000Z',
  reason: null,
  note: null,
  status: 'pendente',
  completed_at: null,
  result: null,
  created_at: '2026-11-24T09:00:00.000Z',
  updated_at: '2026-11-24T09:00:00.000Z',
} satisfies Followup

const activity = {
  id: 'act-1',
  lead_id: 'l-1',
  owner_id: 'owner',
  type: 'observacao',
  description: 'Observação registrada.',
  user_id: null,
  created_at: '2026-11-25T09:00:00.000Z',
  leadName: 'Barbearia do Bairro',
} satisfies Activity & { leadName: string }

const statusChange = {
  ...activity,
  id: 'status-1',
  type: 'mudanca_status',
  description: 'Status alterado para Negociando.',
  created_at: '2026-11-25T10:00:00.000Z',
} satisfies Activity & { leadName: string }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listLeads).mockResolvedValue({ leads: [lead('l-1'), lead('l-2')], total: 2 })
  vi.mocked(listFollowups).mockResolvedValue([followup])
  vi.mocked(listRecentActivities).mockResolvedValue([activity])
  vi.mocked(activityService.listRecentStatusChanges).mockResolvedValue([statusChange])
  vi.mocked(listRecentLeads).mockResolvedValue([lead('l-2')])
})

describe('getDashboardData', () => {
  it('inicia as cinco consultas em paralelo com os limites e a ordem exigidos', async () => {
    const request = getDashboardData()

    // Promise.all inicia todas antes de qualquer resposta: nenhuma consulta espera a anterior.
    expect(listLeads).toHaveBeenCalledTimes(1)
    expect(listFollowups).toHaveBeenCalledTimes(1)
    expect(listRecentActivities).toHaveBeenCalledTimes(1)
    expect(activityService.listRecentStatusChanges).toHaveBeenCalledTimes(1)
    expect(listRecentLeads).toHaveBeenCalledTimes(1)
    // 'all' nos follow-ups: o painel de pendentes/atrasados filtra no cliente (computeIndicators).
    expect(listLeads).toHaveBeenCalledWith({}, 'created_desc', 0, DASHBOARD_LEAD_WINDOW)
    expect(listFollowups).toHaveBeenCalledWith('all')
    expect(listRecentActivities).toHaveBeenCalledWith(8)
    expect(activityService.listRecentStatusChanges).toHaveBeenCalledWith(5)
    expect(listRecentLeads).toHaveBeenCalledWith(5)
    expect(DASHBOARD_LEAD_WINDOW).toBe(1000)
    const startOrder = [
      vi.mocked(listLeads).mock.invocationCallOrder[0],
      vi.mocked(listFollowups).mock.invocationCallOrder[0],
      vi.mocked(listRecentActivities).mock.invocationCallOrder[0],
      vi.mocked(activityService.listRecentStatusChanges).mock.invocationCallOrder[0],
      vi.mocked(listRecentLeads).mock.invocationCallOrder[0],
    ]
    expect(startOrder).toEqual([...startOrder].sort((a, b) => a - b))

    await request
  })

  it('devolve as cinco fontes juntas na forma que a página lê', async () => {
    await expect(getDashboardData()).resolves.toEqual({
      leads: [lead('l-1'), lead('l-2')],
      totalLeads: 2,
      followups: [followup],
      recentActivities: [activity],
      recentStatusChanges: [statusChange],
      recentLeads: [lead('l-2')],
    })
  })

  it('totalLeads vem do count do banco, não do tamanho da janela carregada', async () => {
    vi.mocked(listLeads).mockResolvedValue({
      leads: Array.from({ length: DASHBOARD_LEAD_WINDOW }, (_, index) => lead(`l-${index}`)),
      total: 1042,
    })

    const result = await getDashboardData()

    expect(result.leads).toHaveLength(DASHBOARD_LEAD_WINDOW)
    expect(result.totalLeads).toBe(1042)
  })

  it('falha em qualquer uma das cinco derruba a carga inteira, sem painel pela metade', async () => {
    vi.mocked(listFollowups).mockRejectedValue(new Error('Falha de conexão com o Supabase.'))

    await expect(getDashboardData()).rejects.toThrow('Falha de conexão com o Supabase.')
    expect(listRecentActivities).toHaveBeenCalledTimes(1)
    expect(activityService.listRecentStatusChanges).toHaveBeenCalledTimes(1)
  })

  it('cada chamada é uma carga nova: nada é cacheado entre atualizações', async () => {
    await getDashboardData()
    await getDashboardData()

    expect(listLeads).toHaveBeenCalledTimes(2)
    expect(listRecentActivities).toHaveBeenCalledTimes(2)
    expect(activityService.listRecentStatusChanges).toHaveBeenCalledTimes(2)
  })
})
