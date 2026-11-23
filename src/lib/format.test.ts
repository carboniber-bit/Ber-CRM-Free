import { describe, expect, it } from 'vitest'
import { formatBRL, formatDate, formatDateTime, formatPhone, localDayBoundary, onlyDigits } from './format'

describe('formatBRL', () => {
  it('formata valores em reais', () => {
    expect(formatBRL(1500)).toMatch(/R\$\s?1\.500,00/)
    expect(formatBRL(0)).toMatch(/R\$\s?0,00/)
  })
})

describe('onlyDigits', () => {
  it('remove tudo que não é dígito', () => {
    expect(onlyDigits('(11) 98888-7777')).toBe('11988887777')
    expect(onlyDigits('12.345.678/0001-90')).toBe('12345678000190')
  })
})

describe('formatPhone', () => {
  it('formata celular com DDD', () => {
    expect(formatPhone('11988887777')).toBe('(11) 98888-7777')
  })
  it('formata fixo com DDD', () => {
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444')
  })
  it('devolve o original se não reconhece o formato', () => {
    expect(formatPhone('123')).toBe('123')
  })
})

describe('formatDate / formatDateTime', () => {
  it('retorna traço para nulo', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDateTime(null)).toBe('—')
  })
  it('formata ISO para pt-BR', () => {
    expect(formatDate('2026-11-22T15:00:00Z')).toMatch(/22\/11\/2026/)
    expect(formatDateTime('2026-11-22T15:00:00Z')).toMatch(/22\/11\/2026/)
  })
})

describe('localDayBoundary', () => {
  it('converte limites do dia local para ISO UTC', () => {
    const originalTz = process.env.TZ
    process.env.TZ = 'America/Sao_Paulo'
    try {
      expect(localDayBoundary('2026-11-23')).toBe('2026-11-23T03:00:00.000Z')
      expect(localDayBoundary('2026-11-23', true)).toBe('2026-11-24T02:59:59.999Z')
    } finally {
      if (originalTz === undefined) delete process.env.TZ
      else process.env.TZ = originalTz
    }
  })
})