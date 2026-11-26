import { describe, expect, it } from 'vitest'
import { normalizeClientUrl } from './url'

describe('normalizeClientUrl', () => {
  it('normaliza domínio e preserva vazio como string', () => {
    expect(normalizeClientUrl('exemplo.com')).toBe('https://exemplo.com')
    expect(normalizeClientUrl('')).toBe('')
    expect(normalizeClientUrl(null)).toBe('')
  })
  it('rejeita esquema inseguro e URL inválida', () => {
    expect(normalizeClientUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeClientUrl('https://')).toBeNull()
  })
})
