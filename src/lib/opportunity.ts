import type { Lead, Need, Niche, Priority } from '../types/lead'

export type OpportunityInput = Pick<
  Lead,
  | 'niche' | 'has_website' | 'has_instagram' | 'has_facebook'
  | 'has_digital_menu' | 'has_digital_catalog' | 'has_landing_page'
  | 'has_business_whatsapp' | 'phone' | 'whatsapp' | 'email'
>

export interface OpportunityResult {
  score: number
  priority: Priority
  needs: Need[]
  reasons: string[]
}

export const MENU_NICHES: readonly Niche[] = [
  'restaurante', 'pizzaria', 'hamburgueria', 'lanchonete', 'cafeteria',
]

export const CATALOG_NICHES: readonly Niche[] = [...MENU_NICHES, 'comercio', 'outros']

export function priorityFromScore(score: number): Priority {
  if (score >= 80) return 'muito_alta'
  if (score >= 60) return 'alta'
  if (score >= 40) return 'media'
  return 'baixa'
}

export function computeOpportunity(input: OpportunityInput): OpportunityResult {
  let score = 0
  const needs = new Set<Need>()
  const reasons: string[] = []

  const noSite = input.has_website === 'no'
  const menuApplicable = MENU_NICHES.includes((input.niche ?? '') as Niche)
  const catalogApplicable = CATALOG_NICHES.includes((input.niche ?? '') as Niche)

  if (noSite) {
    score += 25
    needs.add('site')
    reasons.push('Não possui site (ausência confirmada).')
  }

  if (menuApplicable && input.has_digital_menu === 'no') {
    score += 25
    needs.add('cardapio')
    reasons.push('Não possui cardápio digital (ausência confirmada), aplicável ao nicho.')
  }

  if (input.has_instagram === 'yes' && noSite) {
    score += 15
    needs.add('landing')
    reasons.push('Possui Instagram, mas não possui site — oportunidade de landing page.')
  }

  if (catalogApplicable && input.has_digital_catalog === 'no') {
    score += 10
    needs.add('catalogo')
    reasons.push('Não possui catálogo digital (ausência confirmada), aplicável ao nicho.')
  }

  const onlyWhatsapp =
    input.has_business_whatsapp === 'yes' &&
    noSite &&
    input.has_instagram === 'no' &&
    input.has_facebook === 'no'

  if (onlyWhatsapp) {
    score += 10
    needs.add('presenca')
    reasons.push('Utiliza somente WhatsApp para apresentar os serviços (canais confirmados).')
  }

  const noContact = !input.phone?.trim() && !input.whatsapp?.trim() && !input.email?.trim()
  if (noContact) {
    score += 5
    needs.add('presenca')
    reasons.push('Informações comerciais incompletas: nenhum canal de contato cadastrado.')
  }

  const presenceFields = [
    input.has_website, input.has_instagram, input.has_facebook,
    input.has_digital_menu, input.has_digital_catalog,
    input.has_landing_page, input.has_business_whatsapp,
  ]
  const confirmedAbsences = presenceFields.filter((v) => v === 'no').length
  if (!onlyWhatsapp && confirmedAbsences >= 3) {
    score += 10
    needs.add('presenca')
    reasons.push(`Presença digital limitada: ${confirmedAbsences} itens confirmados como ausentes.`)
  }

  score = Math.min(100, score)
  return { score, priority: priorityFromScore(score), needs: [...needs], reasons }
}