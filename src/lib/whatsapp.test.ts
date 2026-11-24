import { describe, expect, it } from 'vitest'
import { buildWhatsAppLink, normalizePhoneForComparison, normalizeWhatsAppNumber } from './whatsapp'

describe('normalizeWhatsAppNumber', () => {
  it('adiciona 55 a celular com DDD (11 dígitos)', () => {
    expect(normalizeWhatsAppNumber('(11) 98888-7777')).toBe('5511988887777')
  })
  it('adiciona 55 a fixo com DDD (10 dígitos)', () => {
    expect(normalizeWhatsAppNumber('1133334444')).toBe('551133334444')
  })
  it('mantém número que já tem 55', () => {
    expect(normalizeWhatsAppNumber('5511988887777')).toBe('5511988887777')
    expect(normalizeWhatsAppNumber('+55 (11) 98888-7777')).toBe('5511988887777')
  })
  it('remove zero inicial de DDD', () => {
    expect(normalizeWhatsAppNumber('011988887777')).toBe('5511988887777')
  })
  it('rejeita números inválidos', () => {
    expect(normalizeWhatsAppNumber('')).toBeNull()
    expect(normalizeWhatsAppNumber('123')).toBeNull()
    expect(normalizeWhatsAppNumber('abcdefghij')).toBeNull()
    expect(normalizeWhatsAppNumber('55119888877779999')).toBeNull()
  })
})

describe('normalizePhoneForComparison', () => {
  it.each(['11988887777', '+55 (11) 98888-7777', '011988887777'])(
    'canonicaliza o identificador brasileiro %s',
    (value) => {
      expect(normalizePhoneForComparison(value)).toBe('5511988887777')
    },
  )

  it.each([
    ['123', '123'],
    ['(1) 23', '123'],
    ['abc123', '123'],
  ])('usa apenas dígitos no identificador inválido %s', (value, expected) => {
    expect(normalizePhoneForComparison(value)).toBe(expected)
  })

  it.each(['', '   ', 'abcdefghij'])('não inventa identificador para %j', (value) => {
    expect(normalizePhoneForComparison(value)).toBeNull()
  })
})

describe('buildWhatsAppLink', () => {
  it('monta link wa.me sem mensagem', () => {
    expect(buildWhatsAppLink('11988887777')).toBe('https://wa.me/5511988887777')
  })
  it('codifica a mensagem', () => {
    expect(buildWhatsAppLink('11988887777', 'Olá, tudo bem?')).toBe(
      'https://wa.me/5511988887777?text=Ol%C3%A1%2C%20tudo%20bem%3F',
    )
  })
  it('ignora mensagem vazia', () => {
    expect(buildWhatsAppLink('11988887777', '   ')).toBe('https://wa.me/5511988887777')
  })
  it('retorna null para número inválido', () => {
    expect(buildWhatsAppLink('123')).toBeNull()
  })
})