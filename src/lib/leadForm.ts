import type { LeadWrite } from '../types/lead'
import { onlyDigits } from './format'
import { normalizeInstagramUrl, normalizeMapsUrl, normalizeUrl } from './url'

export type LeadDraftErrors = Partial<Record<keyof LeadWrite, string>>

const URL_FIELDS = ['website', 'menu_url', 'catalog_url', 'facebook'] as const
const VALUE_FIELDS = ['estimated_value', 'negotiated_value', 'contracted_value', 'received_value'] as const

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
  if (draft.instagram && !normalizeInstagramUrl(draft.instagram)) {
    errors.instagram = 'Informe um usuário (@perfil) ou URL válida do Instagram.'
  }
  if (draft.maps_url && !normalizeMapsUrl(draft.maps_url)) {
    errors.maps_url = 'Informe um link exato do estabelecimento no Google Maps.'
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
  normalized.instagram = normalizeInstagramUrl(draft.instagram ?? '') || null
  normalized.maps_url = normalizeMapsUrl(draft.maps_url ?? '') || null
  return normalized
}
