import { describe, expect, it } from 'vitest'
import { computeOpportunity, priorityFromScore, type OpportunityInput } from './opportunity'

function base(overrides: Partial<OpportunityInput> = {}): OpportunityInput {
  return {
    niche: 'barbearia',
    has_website: 'unverified',
    has_instagram: 'unverified',
    has_facebook: 'unverified',
    has_digital_menu: 'unverified',
    has_digital_catalog: 'unverified',
    has_landing_page: 'unverified',
    has_business_whatsapp: 'unverified',
    phone: '11988887777',
    whatsapp: null,
    email: null,
    ...overrides,
  }
}

describe('priorityFromScore', () => {
  it('classifica faixas', () => {
    expect(priorityFromScore(100)).toBe('muito_alta')
    expect(priorityFromScore(80)).toBe('muito_alta')
    expect(priorityFromScore(79)).toBe('alta')
    expect(priorityFromScore(60)).toBe('alta')
    expect(priorityFromScore(59)).toBe('media')
    expect(priorityFromScore(40)).toBe('media')
    expect(priorityFromScore(39)).toBe('baixa')
    expect(priorityFromScore(0)).toBe('baixa')
  })
})

describe('computeOpportunity', () => {
  it('não pontua nada quando tudo é não verificado', () => {
    const r = computeOpportunity(base())
    expect(r.score).toBe(0)
    expect(r.needs).toEqual([])
    expect(r.reasons).toEqual([])
    expect(r.priority).toBe('baixa')
  })

  it('site ausente confirmado: +25 e necessidade site', () => {
    const r = computeOpportunity(base({ has_website: 'no' }))
    expect(r.score).toBe(25)
    expect(r.needs).toContain('site')
    expect(r.reasons.length).toBeGreaterThan(0)
  })

  it('instagram sem site: +25 +15 e necessidades site+landing', () => {
    const r = computeOpportunity(base({ has_website: 'no', has_instagram: 'yes' }))
    expect(r.score).toBe(40)
    expect(r.needs).toContain('site')
    expect(r.needs).toContain('landing')
  })

  it('cardápio só pontua em nicho aplicável', () => {
    const pizzaria = computeOpportunity(base({ niche: 'pizzaria', has_digital_menu: 'no' }))
    expect(pizzaria.score).toBe(25)
    expect(pizzaria.needs).toContain('cardapio')
    const barbearia = computeOpportunity(base({ niche: 'barbearia', has_digital_menu: 'no' }))
    expect(barbearia.score).toBe(0)
  })

  it('catálogo pontua em nicho aplicável (comércio)', () => {
    const r = computeOpportunity(base({ niche: 'comercio', has_digital_catalog: 'no' }))
    expect(r.score).toBe(10)
    expect(r.needs).toContain('catalogo')
  })

  it('somente WhatsApp: +10 e não soma presença limitada junto', () => {
    const r = computeOpportunity(base({
      has_website: 'no', has_instagram: 'no', has_facebook: 'no',
      has_business_whatsapp: 'yes',
    }))
    // 25 (site) + 10 (somente whatsapp); presença limitada não soma em duplicidade
    expect(r.score).toBe(35)
    expect(r.needs).toContain('presenca')
  })

  it('presença limitada: 3+ ausências confirmadas sem ser somente WhatsApp', () => {
    const r = computeOpportunity(base({
      has_website: 'no', has_instagram: 'no', has_facebook: 'no',
      has_business_whatsapp: 'no',
    }))
    // 25 (site) + 10 (presença limitada)
    expect(r.score).toBe(35)
  })

  it('sem nenhum canal de contato: +5', () => {
    const r = computeOpportunity(base({ phone: null, whatsapp: null, email: null }))
    expect(r.score).toBe(5)
    expect(r.needs).toContain('presenca')
  })

  it('restaurante sem site e sem cardápio, instagram presente: 25+25+15=65', () => {
    const r = computeOpportunity(base({
      niche: 'restaurante', has_website: 'no', has_digital_menu: 'no', has_instagram: 'yes',
    }))
    expect(r.score).toBe(65)
    expect(r.priority).toBe('alta')
  })

  it('teto de 100 pontos', () => {
    const r = computeOpportunity(base({
      niche: 'restaurante',
      has_website: 'no', has_instagram: 'yes', has_facebook: 'no',
      has_digital_menu: 'no', has_digital_catalog: 'no', has_landing_page: 'no',
      has_business_whatsapp: 'no',
      phone: null, whatsapp: null, email: null,
    }))
    expect(r.score).toBeLessThanOrEqual(100)
  })

  it('justificativas citam apenas dados cadastrados', () => {
    const r = computeOpportunity(base({ has_website: 'no' }))
    expect(r.reasons.join(' ')).toMatch(/site/i)
  })
})