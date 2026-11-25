import { describe, expect, it } from 'vitest'
import type { UniqueIdentifier } from '@dnd-kit/core'
import { LEAD_STATUSES } from '../types/lead'
import { statusFromDragEnd } from './pipeline'

// O evento real carrega muito mais; a decisão usa só o destino.
function dropOver(over: { id: UniqueIdentifier } | null | undefined) {
  return { over }
}

describe('statusFromDragEnd', () => {
  it('devolve o status da coluna quando o card é solto sobre uma coluna do quadro', () => {
    for (const status of LEAD_STATUSES) {
      expect(statusFromDragEnd(dropOver({ id: status }))).toBe(status)
    }
  })

  it('devolve null quando nada está sob o ponteiro: soltar no vazio não muda status', () => {
    // pointerWithin não resolve coluna fora do quadro → over null (drag terminado) ou undefined.
    expect(statusFromDragEnd(dropOver(null))).toBeNull()
    expect(statusFromDragEnd(dropOver(undefined))).toBeNull()
    expect(statusFromDragEnd({})).toBeNull()
  })

  it('ignora id que não é uma coluna do pipeline', () => {
    // Id de outro registro (um lead, um handle de arraste de outro contexto) nunca vira status.
    expect(statusFromDragEnd(dropOver({ id: 'lead-barbearia' }))).toBeNull()
    expect(statusFromDragEnd(dropOver({ id: 'qualquer-coisa' }))).toBeNull()
    expect(statusFromDragEnd(dropOver({ id: 12 }))).toBeNull()
    expect(statusFromDragEnd(dropOver({ id: '' }))).toBeNull()
  })
})
