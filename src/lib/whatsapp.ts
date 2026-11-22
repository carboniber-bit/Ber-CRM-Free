import { onlyDigits } from './format'

export function normalizeWhatsAppNumber(raw: string): string | null {
  let digits = onlyDigits(raw).replace(/^0+/, '')
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    // já internacional
  } else if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`
  } else {
    return null
  }
  if (digits.length < 12 || digits.length > 13) return null
  return digits
}

export function buildWhatsAppLink(raw: string, message?: string): string | null {
  const number = normalizeWhatsAppNumber(raw)
  if (!number) return null
  const text = message?.trim()
  return text ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : `https://wa.me/${number}`
}