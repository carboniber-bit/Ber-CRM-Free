export interface ServicePrices {
  site: number
  landing: number
  cardapio: number
  catalogo: number
  outros: number
}

export const SERVICE_LABELS: Record<keyof ServicePrices, string> = {
  site: 'Site',
  landing: 'Landing page',
  cardapio: 'Cardápio digital',
  catalogo: 'Catálogo digital',
  outros: 'Outros serviços',
}

export interface UserSettings {
  owner_id: string
  service_prices: ServicePrices
  whatsapp_template: string
}

export const DEFAULT_SETTINGS: Omit<UserSettings, 'owner_id'> = {
  service_prices: { site: 0, landing: 0, cardapio: 0, catalogo: 0, outros: 0 },
  whatsapp_template: '',
}
