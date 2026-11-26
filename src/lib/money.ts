export type Cents = number
export const MAX_MONEY_CENTS = 99_999_999_999_999

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function parseMoneyInput(value: string): Cents | null {
  const input = value.trim()
  if (!input || input.startsWith('-')) return null

  let integerPart = ''
  let decimalPart = ''

  if (/^\d+,\d{1,2}$/.test(input)) {
    const [integer, decimal] = input.split(',')
    integerPart = integer
    decimalPart = decimal
  } else if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(input)) {
    const [integer, decimal = ''] = input.split(',')
    integerPart = integer.replace(/\./g, '')
    decimalPart = decimal
  } else if (/^\d+\.\d{1,2}$/.test(input)) {
    const [integer, decimal] = input.split('.')
    integerPart = integer
    decimalPart = decimal
  } else if (/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(input)) {
    const [integer, decimal] = input.split('.')
    integerPart = integer.replace(/,/g, '')
    decimalPart = decimal
  } else if (/^\d+$/.test(input)) {
    integerPart = input
  } else {
    return null
  }

  const cents = Number(integerPart) * 100 + Number(decimalPart.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents <= MAX_MONEY_CENTS ? cents : null
}

export function fromMoneyDecimal(value: string | number | null): Cents {
  if (value === null) return 0
  const input = String(value)
  if (!/^\d+(?:\.\d{1,2})?$/.test(input)) {
    throw new Error('Valor monetário inválido recebido do banco.')
  }
  const [integer, decimal = ''] = input.split('.')
  const cents = Number(integer) * 100 + Number(decimal.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents > MAX_MONEY_CENTS) {
    throw new Error('Valor monetário inválido recebido do banco.')
  }
  return cents
}

export function toMoneyDecimal(value: Cents): string {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_MONEY_CENTS) {
    throw new Error('Valor monetário inválido.')
  }
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`
}

export function formatMoney(value: Cents): string {
  if (!Number.isSafeInteger(value)) throw new Error('Valor monetário inválido.')
  return brl.format(value / 100)
}

export function sumMoney(...values: Cents[]): Cents {
  let total = 0
  for (const value of values) {
    if (!Number.isSafeInteger(value)) throw new Error('Soma monetária fora do limite seguro.')
    total += value
    if (!Number.isSafeInteger(total)) throw new Error('Soma monetária fora do limite seguro.')
  }
  return total
}
