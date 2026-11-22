import { describe, expect, it } from 'vitest'
import { buildWhatsAppLink, normalizeWhatsAppNumber } from './whatsapp'

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