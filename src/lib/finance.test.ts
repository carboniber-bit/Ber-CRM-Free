import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FinancialPayment } from '../types/finance'
import {
  calculateContractBalance,
  calculateInstallmentFinancial,
  calculateProfit,
  getPeriodRange,
  getSaoPauloToday,
} from './finance'

const payment = (type: FinancialPayment['type'], amountCents: number): FinancialPayment => ({
  id: type,
  owner_id: 'owner',
  contract_id: 'contract',
  idempotency_key: type,
  related_payment_id: null,
  type,
  amount_cents: amountCents,
  received_at: '2026-11-25T12:00:00-03:00',
  payment_method: null,
  notes: null,
  created_by: 'owner',
  created_at: '2026-11-25T12:00:00-03:00',
})

afterEach(() => vi.unstubAllEnvs())

describe('calculateContractBalance', () => {
  it('subtrai recebimentos e soma estornos sem ficar negativo', () => {
    expect(calculateContractBalance(100000, [payment('receipt', 30000), payment('refund', 5000)])).toBe(75000)
    expect(calculateContractBalance(10000, [payment('receipt', 20000)])).toBe(0)
  })

  it('rejeita estouro intermediário mesmo quando estornos posteriores compensam o total', () => {
    const max = Number.MAX_SAFE_INTEGER
    expect(() => calculateContractBalance(10, [
      payment('receipt', max),
      payment('receipt', 1),
      payment('refund', max),
    ])).toThrow('Total financeiro excede o limite de centavos.')
  })
})

describe('calculateInstallmentFinancial', () => {
  it('deriva pago, parcial, pendente e atrasado', () => {
    expect(calculateInstallmentFinancial(10000, 10000, '2026-11-20', '2026-11-25').status).toBe('paid')
    expect(calculateInstallmentFinancial(10000, 4000, '2026-11-20', '2026-11-25').status).toBe('overdue')
    expect(calculateInstallmentFinancial(10000, 4000, '2026-12-01', '2026-11-25').status).toBe('partial')
    expect(calculateInstallmentFinancial(10000, 0, '2026-12-01', '2026-11-25').status).toBe('pending')
  })
})

describe('calculateProfit', () => {
  it('usa somente recebimento líquido e despesa paga', () => {
    expect(calculateProfit(100000, 20000, 30000)).toBe(50000)
  })
})

describe('getPeriodRange', () => {
  it('retorna início inclusivo e fim exclusivo', () => {
    expect(getPeriodRange('month', '2026-11-25')).toEqual({ start: '2026-11-01', end: '2026-12-01' })
    expect(getPeriodRange('day', '2026-11-25')).toEqual({ start: '2026-11-25', end: '2026-11-26' })
    expect(getPeriodRange('week', '2026-11-25')).toEqual({ start: '2026-11-23', end: '2026-11-30' })
    expect(getPeriodRange('year', '2026-11-25')).toEqual({ start: '2026-01-01', end: '2027-01-01' })
  })

  it('converte fim personalizado inclusivo em fim exclusivo', () => {
    expect(getPeriodRange('custom', '2026-11-25', '2026-11-10', '2026-11-20')).toEqual({
      start: '2026-11-10',
      end: '2026-11-21',
    })
    expect(getPeriodRange('custom', '2026-11-25', '2026-11-02', '2026-11-10')).toEqual({
      start: '2026-11-02',
      end: '2026-11-11',
    })
  })

  it('não desloca a meia-noite de São Paulo conforme o fuso do processo', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    expect(getSaoPauloToday(new Date('2026-11-25T03:00:00Z'))).toBe('2026-11-25')
    expect(getPeriodRange('day', '2026-11-25')).toEqual({ start: '2026-11-25', end: '2026-11-26' })
  })

  it('rejeita datas impossíveis e período personalizado invertido', () => {
    expect(() => getPeriodRange('day', '2026-02-30')).toThrow('Data inválida.')
    expect(() => getPeriodRange('custom', '2026-11-25', '2026-11-20', '2026-11-10')).toThrow(
      'O início do período não pode ser posterior ao fim.',
    )
  })
})
