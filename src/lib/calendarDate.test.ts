import { describe, expect, it } from 'vitest'
import { formatCalendarDate } from './calendarDate'

describe('formatCalendarDate', () => {
  it('formata datas de calendário sem converter o fuso local', () => {
    expect(formatCalendarDate('2026-11-21')).toBe('21/11/2026')
    expect(formatCalendarDate('2026-01-01')).toBe('01/01/2026')
  })

  it('retorna traço para ausência e rejeita datas inválidas ou timestamps', () => {
    expect(formatCalendarDate(null)).toBe('—')
    expect(formatCalendarDate('2026-02-30')).toBe('—')
    expect(formatCalendarDate('2026-11-21T12:00:00Z')).toBe('—')
  })
})
