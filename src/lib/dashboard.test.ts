import { describe, expect, it, vi } from 'vitest'
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

  it('usa o timestamp explícito para decidir atraso sem ler o relógio interno', () => {
    const dueAt = '2020-01-01T00:00:00.000Z'
    const pending = [followup({ due_at: dueAt })]

    expect(computeIndicators([], pending, Date.parse('2019-12-31T23:59:59.999Z')).followupsAtrasados).toBe(0)
    expect(computeIndicators([], pending, Date.parse(dueAt)).followupsAtrasados).toBe(0)
    expect(computeIndicators([], pending, Date.parse('2020-01-01T00:00:00.001Z')).followupsAtrasados).toBe(1)
  })

  it('trata os três status de contato como contatados', () => {
    const leads = [
      lead({ status: 'contato_realizado' }),
      lead({ status: 'aguardando_resposta' }),
      lead({ status: 'pediu_informacoes' }),
      lead({ status: 'novo' }),
      lead({ status: 'ignorou' }),
    ]
    expect(computeIndicators(leads, []).contatados).toBe(3)
    const funnel = conversionFunnel(leads)
    expect(funnel.map((s) => s.label)).toEqual(['Novo', 'Contatado', 'Interessado', 'Negociando', 'Aceitou'])
    expect(funnel[1].total).toBe(3)
  })
})

describe('leadsByMonth', () => {
  it('agrupa por mês e ordena cronologicamente', () => {
    // Relógio fixo: as chaves esperadas são literais, sem depender do new Date() do teste.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 15, 12, 0, 0)) // 15/11/2026, horário local
    try {
      const localDay = (month: number, day: number) => new Date(2026, month, day).toISOString()
      const result = leadsByMonth([
        lead({ created_at: localDay(10, 5) }),
        lead({ created_at: localDay(10, 20) }),
        lead({ created_at: localDay(9, 1) }),
        lead({ created_at: localDay(7, 14) }),
      ])
      expect(result).toEqual([
        { month: '06/26', total: 0 },
        { month: '07/26', total: 0 },
        { month: '08/26', total: 1 },
        { month: '09/26', total: 0 },
        { month: '10/26', total: 1 },
        { month: '11/26', total: 2 },
      ])
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('countBy / conversionFunnel', () => {
  it('conta por nicho com rótulos', () => {
    const result = countBy([lead({ niche: 'barbearia' }), lead({ niche: 'barbearia' })], 'niche')
    expect(result.find((r) => r.label === 'Barbearia')?.total).toBe(2)
  })
  it('reúne nicho vazio e "outros" num único rótulo Outros', () => {
    const result = countBy([
      lead({ niche: null }),
      lead({ niche: '' }),
      lead({ niche: 'outros' }),
    ], 'niche')
    expect(result).toEqual([{ label: 'Outros', total: 3 }])
  })
  it('usa os rótulos pt-BR de status', () => {
    const result = countBy([
      lead({ status: 'novo' }),
      lead({ status: 'novo' }),
      lead({ status: 'nao_interessado' }),
    ], 'status')
    expect(result).toEqual([
      { label: 'Novo', total: 2 },
      { label: 'Não interessado', total: 1 },
    ])
  })
  it('conta por prioridade apenas oportunidades elegíveis', () => {
    const result = countBy([
      lead({ priority: 'muito_alta', status: 'negociando', needs: ['site'] }),
      lead({ priority: 'muito_alta', status: 'interessado', needs: ['cardapio'] }),
      lead({ priority: 'muito_alta', status: 'aceitou', needs: ['site'] }), // convertida: fora
      lead({ priority: 'muito_alta', status: 'novo', needs: [] }), // sem necessidades: fora
      lead({ priority: 'baixa', status: 'interessado', needs: ['site'] }),
    ], 'priority')
    expect(result).toEqual([
      { label: 'Muito alta', total: 2 },
      { label: 'Baixa', total: 1 },
    ])
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
  it('desempata por score, depois status novo, depois created_at', () => {
    const scored = lead({ status: 'contato_realizado', priority: 'media', score: 80, created_at: '2026-11-10T00:00:00Z' })
    const freshUnscored = lead({ status: 'novo', priority: 'media', score: 40, created_at: '2026-11-11T00:00:00Z' })
    expect(prospectingQueue([freshUnscored, scored], []).map((l) => l.id))
      .toEqual([scored.id, freshUnscored.id]) // maior score vence o status novo

    const contacted = lead({ status: 'contato_realizado', priority: 'media', score: 60, created_at: '2026-11-01T00:00:00Z' })
    const sameScoreNew = lead({ status: 'novo', priority: 'media', score: 60, created_at: '2026-11-12T00:00:00Z' })
    expect(prospectingQueue([contacted, sameScoreNew], []).map((l) => l.id))
      .toEqual([sameScoreNew.id, contacted.id]) // mesmo score: não contatado primeiro

    const later = lead({ status: 'novo', priority: 'media', score: 60, created_at: '2026-11-20T00:00:00Z' })
    const earlier = lead({ status: 'novo', priority: 'media', score: 60, created_at: '2026-11-02T00:00:00Z' })
    expect(prospectingQueue([later, earlier], []).map((l) => l.id))
      .toEqual([earlier.id, later.id]) // mesmo score e status: created_at ascendente
  })
})
