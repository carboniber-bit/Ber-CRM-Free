// src/lib/csv.test.ts
import { describe, expect, it } from 'vitest'
import { CSV_HEADERS, leadsToCsv, parseLeadsCsv } from './csv'
import { emptyLeadDraft, type Lead } from '../types/lead'

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    ...emptyLeadDraft(),
    id: '00000000-0000-0000-0000-000000000001',
    owner_id: '00000000-0000-0000-0000-000000000002',
    score: 0,
    priority: 'baixa',
    needs: [],
    score_reasons: [],
    created_at: '2026-11-22T00:00:00Z',
    updated_at: '2026-11-22T00:00:00Z',
    name: 'Barbearia do João',
    niche: 'barbearia',
    city: 'São Paulo',
    has_website: 'no',
    estimated_value: 1500,
    ...overrides,
  } as Lead
}

describe('leadsToCsv', () => {
  it('gera header + linha com dados', () => {
    const csv = leadsToCsv([makeLead()])
    const lines = csv.trim().split('\n')
    expect(lines[0].replace(/"/g, '')).toBe(CSV_HEADERS.join(','))
    expect(lines[1]).toContain('Barbearia do João')
    expect(lines[1]).toContain('não') // presença no exportada em pt-BR
  })
})

describe('parseLeadsCsv', () => {
  it('importa linha válida', () => {
    const csv = 'nome,cidade,tem_site,valor_estimado\nBarbearia do João,São Paulo,não,"1.500,00"'
    const rows = parseLeadsCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].errors).toEqual([])
    expect(rows[0].draft?.name).toBe('Barbearia do João')
    expect(rows[0].draft?.has_website).toBe('no')
    expect(rows[0].draft?.estimated_value).toBe(1500)
    expect(rows[0].draft?.status).toBe('novo')
  })

  it('acusa nome obrigatório', () => {
    const rows = parseLeadsCsv('nome,cidade\n,São Paulo')
    expect(rows[0].draft).toBeNull()
    expect(rows[0].errors.join(' ')).toMatch(/Nome/)
  })

  it('presença desconhecida vira erro; vazio vira unverified', () => {
    const rows = parseLeadsCsv('nome,tem_site,tem_instagram\nA,talvez,\nB,,sim')
    expect(rows[0].errors.join(' ')).toMatch(/tem_site/)
    expect(rows[1].draft?.has_instagram).toBe('yes')
    expect(rows[1].draft?.has_website).toBe('unverified')
  })

  it('status inválido vira erro; label pt-BR é aceito', () => {
    const rows = parseLeadsCsv('nome,status\nA,xyz\nB,Interessado')
    expect(rows[0].draft).toBeNull()
    expect(rows[1].draft?.status).toBe('interessado')
  })

  it('valor inválido vira erro', () => {
    const rows = parseLeadsCsv('nome,valor_estimado\nA,abc')
    expect(rows[0].errors.join(' ')).toMatch(/valor_estimado/)
  })

  it('roundtrip export → import preserva dados essenciais', () => {
    const original = makeLead()
    const rows = parseLeadsCsv(leadsToCsv([original]))
    expect(rows[0].errors).toEqual([])
    expect(rows[0].draft?.name).toBe(original.name)
    expect(rows[0].draft?.has_website).toBe('no')
    expect(rows[0].draft?.estimated_value).toBe(1500)
    expect(rows[0].draft?.niche).toBe('barbearia')
  })
})