import { describe, expect, it } from 'vitest'
import { computeIndicators, conversionFunnel, countBy, leadsByMonth, prospectingQueue } from './dashboard'
import { emptyLeadDraft, type Lead } from '../types/lead'
import type { Followup } from '../types/followup'

let seq = 0
function lead(overrides: Partial<Lead> = {}): Lead {
  seq += 1
  return {
    ...emptyLeadDraft(),
    id: `id-${seq}`, owner_id: 'owner', score: 0, priority: 'baixa',
    needs: [], score_reasons: [],
    created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z',
    name: `Lead ${seq}`,
    ...overrides,
  } as Lead
}

function followup(overrides: Partial<Followup> = {}): Followup {
  return {
    id: 'f1', lead_id: 'id-1', owner_id: 'owner',
    due_at: '2026-11-22T10:00:00Z', reason: null, note: null,
    status: 'pendente', completed_at: null, result: null,
    created_at: '2026-11-20T00:00:00Z', updated_at: '2026-11-20T00:00:00Z',
    ...overrides,
  }
}

describe('computeIndicators', () => {
  it('conta status e oportunidades reais', () => {
    const leads = [
      lead({ status: 'novo' }),
      lead({ status: 'contato_realizado' }),
      lead({ status: 'interessado', needs: ['site'], score: 50, priority: 'media' }),
      lead({ status: 'negociando', needs: ['site'], score: 85, priority: 'muito_alta' }),
      lead({ status: 'aceitou', needs: ['site'], score: 90, priority: 'muito_alta' }),
      lead({ status: 'perdido', needs: ['site'], score: 90, priority: 'muito_alta' }),
    ]
    const followups = [
      followup({ status: 'pendente', due_at: '2020-01-01T00:00:00Z' }),
      followup({ id: 'f2', status: 'pendente', due_at: '2099-01-01T00:00:00Z' }),
      followup({ id: 'f3', status: 'concluido' }),
    ]
    const i = computeIndicators(leads, followups)
    expect(i.totalLeads).toBe(6)
    expect(i.novos).toBe(1)
    expect(i.contatados).toBe(1)
    expect(i.interessados).toBe(1)
    expect(i.negociando).toBe(1)
    expect(i.convertidos).toBe(1)
    expect(i.totalOportunidades).toBe(2) // aceitou e perdido excluídos
    expect(i.altaPrioridade).toBe(1) // só negociando (muito_alta) entre elegíveis
    expect(i.followupsPendentes).toBe(2)
    expect(i.followupsAtrasados).toBe(1)
  })
})

describe('leadsByMonth', () => {
  it('agrupa por mês e ordena cronologicamente', () => {
    // Datas derivadas de new Date() para o teste não quebrar a partir de dezembro.
    const now = new Date()
    const monthKey = (d: Date) =>
      `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const result = leadsByMonth([
      lead({ created_at: new Date(now.getFullYear(), now.getMonth(), 5).toISOString() }),
      lead({ created_at: new Date(now.getFullYear(), now.getMonth(), 20).toISOString() }),
      lead({ created_at: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString() }),
    ])
    expect(result.length).toBeGreaterThanOrEqual(2)
    const atual = result.find((r) => r.month === monthKey(currentMonth))
    expect(atual?.total).toBe(2)
    const anterior = result.find((r) => r.month === monthKey(previousMonth))
    expect(anterior?.total).toBe(1)
    expect(result[result.length - 1].month).toBe(monthKey(currentMonth))
  })
})

describe('countBy / conversionFunnel', () => {
  it('conta por nicho com rótulos', () => {
    const result = countBy([lead({ niche: 'barbearia' }), lead({ niche: 'barbearia' })], 'niche')
    expect(result.find((r) => r.label === 'Barbearia')?.total).toBe(2)
  })
  it('funil de conversão tem 5 etapas', () => {
    const result = conversionFunnel([lead({ status: 'novo' }), lead({ status: 'aceitou' })])
    expect(result).toHaveLength(5)
    expect(result[0].total).toBe(1)
    expect(result[4].total).toBe(1)
  })
})

describe('prospectingQueue', () => {
  it('exclui convertidos, perdidos e não interessados; prioriza muito alta', () => {
    const queue = prospectingQueue([
      lead({ status: 'aceitou', score: 100, priority: 'muito_alta', needs: ['site'] }),
      lead({ status: 'perdido', score: 100, priority: 'muito_alta', needs: ['site'] }),
      lead({ status: 'nao_interessado', score: 100, priority: 'muito_alta', needs: ['site'] }),
      lead({ status: 'novo', score: 30, priority: 'baixa' }),
      lead({ status: 'novo', score: 90, priority: 'muito_alta', needs: ['site'] }),
    ], [])
    expect(queue).toHaveLength(2)
    expect(queue[0].score).toBe(90)
  })
  it('follow-up atrasado sobe na fila dentro da mesma prioridade', () => {
    const overdueLead = lead({ status: 'follow_up', score: 50, priority: 'media', needs: ['site'] })
    const queue = prospectingQueue([
      lead({ status: 'novo', score: 55, priority: 'media', needs: ['site'] }),
      overdueLead,
    ], [followup({ lead_id: overdueLead.id, due_at: '2020-01-01T00:00:00Z' })])
    expect(queue[0].id).toBe(overdueLead.id)
  })
})
