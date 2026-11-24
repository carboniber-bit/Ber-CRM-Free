import { describe, expect, it } from 'vitest'
import { ACTIVITY_LABELS } from './activity'

describe('ACTIVITY_LABELS', () => {
  it('não afirma envio quando o WhatsApp foi apenas aberto', () => {
    expect(ACTIVITY_LABELS.mensagem).toBe('Mensagem registrada')
  })
})
