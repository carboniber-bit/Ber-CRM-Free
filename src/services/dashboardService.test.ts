import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listRecentActivities } from './activityService'
import { listFollowups } from './followupService'
import { listLeads, listRecentLeads } from './leadService'
import { DASHBOARD_LEAD_WINDOW, getDashboardData } from './dashboardService'
import { emptyLeadDraft, type Lead } from '../types/lead'
import type { Followup } from '../types/followup'
import type { Activity } from '../types/activity'

vi.mock('./activityService', () => ({ listRecentActivities: vi.fn() }))
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
  type: 'mudanca_status',
  description: 'Status alterado para Negociando.',
  user_id: null,
  created_at: '2026-11-25T09:00:00.000Z',
  leadName: 'Barbearia do Bairro',
} satisfies Activity & { leadName: string }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listLeads).mockResolvedValue({ leads: [lead('l-1'), lead('l-2')], total: 2 })
  vi.mocked(listFollowups).mockResolvedValue([followup])
  vi.mocked(listRecentActivities).mockResolvedValue([activity])
  vi.mocked(listRecentLeads).mockResolvedValue([lead('l-2')])
})

describe('getDashboardData', () => {
  it('faz as quatro consultas que a página precisa, com os limites da tier free', async () => {
    await getDashboardData()

    // 'all' nos follow-ups: o painel de pendentes/atrasados filtra no cliente (computeIndicators).
    expect(listLeads).toHaveBeenCalledWith({}, 'created_desc', 0, DASHBOARD_LEAD_WINDOW)
    expect(listFollowups).toHaveBeenCalledWith('all')
    expect(listRecentActivities).toHaveBeenCalledWith(12)
    expect(listRecentLeads).toHaveBeenCalledWith(5)
    expect(DASHBOARD_LEAD_WINDOW).toBe(1000)
  })

  it('devolve as quatro fontes juntas na forma que a página lê', async () => {
    await expect(getDashboardData()).resolves.toEqual({
      leads: [lead('l-1'), lead('l-2')],
      totalLeads: 2,
      followups: [followup],
      recentActivities: [activity],
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

  it('falha em qualquer uma das quatro derruba a carga inteira, sem painel pela metade', async () => {
    vi.mocked(listFollowups).mockRejectedValue(new Error('Falha de conexão com o Supabase.'))

    await expect(getDashboardData()).rejects.toThrow('Falha de conexão com o Supabase.')
    expect(listRecentActivities).toHaveBeenCalledTimes(1)
  })

  it('cada chamada é uma carga nova: nada é cacheado entre atualizações', async () => {
    await getDashboardData()
    await getDashboardData()

    expect(listLeads).toHaveBeenCalledTimes(2)
    expect(listRecentActivities).toHaveBeenCalledTimes(2)
  })
})
