import type { FinancialPayment, InstallmentStatus } from '../types/finance'

export type PeriodPreset = 'day' | 'week' | 'month' | 'year' | 'custom'

interface CalendarDate {
  year: number
  month: number
  day: number
}

const saoPauloFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function assertSafeCents(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error('Total financeiro excede o limite de centavos.')
  return value
}

export function calculateContractBalance(totalCents: number, payments: FinancialPayment[]): number {
  assertSafeCents(totalCents)
  let net = 0
  for (const item of payments) {
    assertSafeCents(item.amount_cents)
    net = assertSafeCents(net + (item.type === 'receipt' ? item.amount_cents : -item.amount_cents))
  }
  return Math.max(assertSafeCents(totalCents - net), 0)
}

export function calculateInstallmentFinancial(
  amountCents: number,
  allocatedCents: number,
  dueDate: string,
  today: string,
): { status: InstallmentStatus; remainingCents: number } {
  assertSafeCents(amountCents)
  assertSafeCents(allocatedCents)
  const remainingCents = Math.max(assertSafeCents(amountCents - allocatedCents), 0)
  if (remainingCents === 0) return { status: 'paid', remainingCents }
  if (dueDate < today) return { status: 'overdue', remainingCents }
  return { status: allocatedCents > 0 ? 'partial' : 'pending', remainingCents }
}

export function calculateProfit(receiptsCents: number, refundsCents: number, paidExpensesCents: number): number {
  const net = assertSafeCents(assertSafeCents(receiptsCents) - assertSafeCents(refundsCents))
  return assertSafeCents(net - assertSafeCents(paidExpensesCents))
}

export function getSaoPauloToday(now: Date = new Date()): string {
  const parts = saoPauloFormatter.formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function parseCalendarDate(value: string): CalendarDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error('Data inválida.')
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('Data inválida.')
  }
  return { year, month, day }
}

function formatCalendarDate(date: CalendarDate): string {
  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
}

function addDays(date: CalendarDate, amount: number): CalendarDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + amount))
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() }
}

export function getPeriodRange(
  preset: PeriodPreset,
  referenceDate: string,
  customStart?: string,
  customEnd?: string,
): { start: string; end: string } {
  const reference = parseCalendarDate(referenceDate)
  if (preset === 'custom') {
    if (!customStart || !customEnd) throw new Error('Informe o início e o fim do período.')
    const start = parseCalendarDate(customStart)
    const end = parseCalendarDate(customEnd)
    if (formatCalendarDate(start) > formatCalendarDate(end)) {
      throw new Error('O início do período não pode ser posterior ao fim.')
    }
    return { start: formatCalendarDate(start), end: formatCalendarDate(addDays(end, 1)) }
  }
  if (preset === 'day') {
    return { start: formatCalendarDate(reference), end: formatCalendarDate(addDays(reference, 1)) }
  }
  if (preset === 'week') {
    const weekday = new Date(Date.UTC(reference.year, reference.month - 1, reference.day)).getUTCDay()
    const offset = weekday === 0 ? -6 : 1 - weekday
    const start = addDays(reference, offset)
    return { start: formatCalendarDate(start), end: formatCalendarDate(addDays(start, 7)) }
  }
  if (preset === 'month') {
    const start = { year: reference.year, month: reference.month, day: 1 }
    const end = reference.month === 12
      ? { year: reference.year + 1, month: 1, day: 1 }
      : { year: reference.year, month: reference.month + 1, day: 1 }
    return { start: formatCalendarDate(start), end: formatCalendarDate(end) }
  }
  return {
    start: `${reference.year}-01-01`,
    end: `${reference.year + 1}-01-01`,
  }
}
