import { describe, expect, it } from 'vitest'
import { ACTIVITY_LABELS, ACTIVITY_TYPES } from './activity'

describe('activity types', () => {
  it('inclui conversão como atividade automática rotulada em pt-BR', () => {
    expect(ACTIVITY_TYPES).toContain('conversao')
    expect(ACTIVITY_LABELS.conversao).toBe('Conversão em cliente')
  })

  it('não afirma envio quando o WhatsApp foi apenas aberto', () => {
    expect(ACTIVITY_LABELS.mensagem).toBe('Mensagem registrada')
  })

  it('fornece rótulo não vazio para todo tipo aceito', () => {
    for (const type of ACTIVITY_TYPES) {
      expect(ACTIVITY_LABELS[type].trim().length).toBeGreaterThan(0)
    }
  })
})
