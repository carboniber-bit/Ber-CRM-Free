export const CHECK_ITEMS = [
  'instagram', 'website', 'digital_menu', 'whatsapp', 'digital_catalog', 'business_info',
] as const
export type CheckItem = (typeof CHECK_ITEMS)[number]

export const CHECK_LABELS: Record<CheckItem, string> = {
  instagram: 'Instagram verificado',
  website: 'Site verificado',
  digital_menu: 'Cardápio digital verificado',
  whatsapp: 'WhatsApp verificado',
  digital_catalog: 'Catálogo verificado',
  business_info: 'Informações comerciais verificadas',
}

export interface DigitalCheck {
  id: string
  lead_id: string
  owner_id: string
  item: CheckItem
  verified: boolean
  verified_at: string | null
  created_at: string
}
