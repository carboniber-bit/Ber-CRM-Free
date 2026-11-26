import { describe, expect, it } from 'vitest'
import {
  fromMoneyDecimal,
  MAX_MONEY_CENTS,
  parseMoneyInput,
  sumMoney,
  toMoneyDecimal,
} from './money'

describe('money', () => {
  it('converte entrada pt-BR e decimal do banco para centavos', () => {
    expect(parseMoneyInput('1.234,56')).toBe(123456)
    expect(parseMoneyInput('1.234')).toBe(123400)
    expect(parseMoneyInput('1,234.56')).toBe(123456)
    expect(parseMoneyInput('1234.56')).toBe(123456)
    expect(parseMoneyInput('12')).toBe(1200)
    expect(fromMoneyDecimal('1234.56')).toBe(123456)
    expect(fromMoneyDecimal(null)).toBe(0)
  })

  it('rejeita vazio, negativo, três casas e estouro numérico', () => {
    expect(parseMoneyInput('')).toBeNull()
    expect(parseMoneyInput('-1,00')).toBeNull()
    expect(parseMoneyInput('1,234')).toBeNull()
    expect(parseMoneyInput('999999999999999,99')).toBeNull()
  })

  it('não transforma valor inválido do banco em zero', () => {
    expect(() => fromMoneyDecimal('abc')).toThrow('Valor monetário inválido recebido do banco.')
    expect(() => fromMoneyDecimal('-1.00')).toThrow('Valor monetário inválido recebido do banco.')
    expect(() => fromMoneyDecimal('1000000000000.00')).toThrow('Valor monetário inválido recebido do banco.')
    expect(() => toMoneyDecimal(-1)).toThrow('Valor monetário inválido.')
    expect(() => toMoneyDecimal(Number.NaN)).toThrow('Valor monetário inválido.')
  })

  it('serializa e soma sem ponto flutuante', () => {
    expect(toMoneyDecimal(123456)).toBe('1234.56')
    expect(sumMoney(100, 200, 300)).toBe(600)
    expect(sumMoney(1, 1, 1)).toBe(3)
    expect(Number.isSafeInteger(MAX_MONEY_CENTS)).toBe(true)
    expect(() => sumMoney(Number.MAX_SAFE_INTEGER, 1)).toThrow('Soma monetária fora do limite seguro.')
    expect(() => sumMoney(Number.MAX_SAFE_INTEGER, 1, -1)).toThrow('Soma monetária fora do limite seguro.')
  })
})
