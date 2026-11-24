import type { LeadWrite } from '../types/lead'
import { onlyDigits } from './format'

export type LeadDraftErrors = Partial<Record<keyof LeadWrite, string>>

const URL_FIELDS = ['website', 'menu_url', 'catalog_url', 'instagram', 'facebook'] as const
const VALUE_FIELDS = ['estimated_value', 'negotiated_value', 'contracted_value', 'received_value'] as const

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0)
    if (code !== undefined && (code <= 31 || (code >= 127 && code <= 159))) return true
  }
  return false
}

function isValidHostname(hostname: string, requireDomain: boolean): boolean {
  const normalized = hostname.replace(/\.$/, '').toLowerCase()
  if (!normalized) return false
  if (normalized.startsWith('[') && normalized.endsWith(']')) return !requireDomain

  const labels = normalized.split('.')
  if (requireDomain && labels.length < 2) return false
  if (!labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) return false

  const topLevelDomain = labels[labels.length - 1]
  return !requireDomain || (topLevelDomain.length >= 2 && !/^\d+$/.test(topLevelDomain))
}

function normalizeUrl(raw: string): string | null {
  if (
    !raw
    || raw.startsWith('/')
    || raw.includes('\\')
    || /\s/.test(raw)
    || hasControlCharacter(raw)
    || /%(?![0-9a-f]{2})/i.test(raw)
  ) return null

  const isHttpUrl = /^https?:\/\//i.test(raw)
  if (/^https?:\/\/\//i.test(raw)) return null
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(raw)
  const isHostWithPort = /^[^/?#@:\\]+:\d+(?:[/?#]|$)/.test(raw)
  if (hasScheme && !isHttpUrl && !isHostWithPort) return null

  const candidate = isHttpUrl ? raw : `https://${raw}`
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (!url.hostname || url.username || url.password) return null
  if (!isValidHostname(url.hostname, !isHttpUrl)) return null
  return candidate
}

export function validateLeadDraft(draft: LeadWrite): LeadDraftErrors {
  const errors: LeadDraftErrors = {}
  if (!draft.name.trim()) errors.name = 'Nome do estabelecimento é obrigatório.'

  const email = draft.email?.trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'E-mail inválido.'

  for (const field of ['phone', 'whatsapp'] as const) {
    const value = draft[field]
    if (!value) continue
    const digits = onlyDigits(value)
    const valid = (digits.length === 10 || digits.length === 11)
      || ((digits.length === 12 || digits.length === 13) && digits.startsWith('55'))
    if (!valid) errors[field] = 'Use 10–11 dígitos com DDD ou 12–13 dígitos começando com 55.'
  }

  if (draft.cnpj && onlyDigits(draft.cnpj).length !== 14) errors.cnpj = 'CNPJ deve ter 14 dígitos.'

  for (const field of URL_FIELDS) {
    const value = draft[field]
    if (value && !normalizeUrl(value)) errors[field] = 'Informe uma URL válida (http://, https:// ou domínio).'
  }

  for (const field of VALUE_FIELDS) {
    if (!Number.isFinite(draft[field]) || draft[field] < 0) errors[field] = 'Valor inválido.'
  }

  return errors
}

export function normalizeLeadDraftForSave(draft: LeadWrite): LeadWrite {
  const normalized = { ...draft }
  for (const field of URL_FIELDS) {
    normalized[field] = normalizeUrl(draft[field] ?? '')
  }
  return normalized
}
