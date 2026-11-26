import { describe, expect, it } from 'vitest'
import { emptyLeadDraft, type LeadWrite } from '../types/lead'
import { normalizeLeadDraftForSave, validateLeadDraft } from './leadForm'

const URL_FIELDS = ['website', 'menu_url', 'catalog_url', 'instagram', 'facebook'] as const
const VALUE_FIELDS = ['estimated_value', 'negotiated_value', 'contracted_value', 'received_value'] as const
const PHONE_FIELDS = ['phone', 'whatsapp'] as const

function makeDraft(overrides: Partial<LeadWrite> = {}): LeadWrite {
  return { ...emptyLeadDraft(), name: 'Estabelecimento de teste', ...overrides }
}

describe('validateLeadDraft', () => {
  it.each(['', '   '])('exige um nome não vazio: %j', (name) => {
    expect(validateLeadDraft(makeDraft({ name })).name).toBeDefined()
  })

  it('aceita um nome preenchido', () => {
    expect(validateLeadDraft(makeDraft()).name).toBeUndefined()
  })

  it('valida o formato básico do e-mail quando preenchido', () => {
    expect(validateLeadDraft(makeDraft({ email: 'contato@example.com' })).email).toBeUndefined()
    expect(validateLeadDraft(makeDraft({ email: 'contato@' })).email).toBeDefined()
    expect(validateLeadDraft(makeDraft({ email: 'contato example.com' })).email).toBeDefined()
  })

  describe.each(PHONE_FIELDS)('%s', (field) => {
    it.each([
      ['1133334444', true],
      ['(11) 3333-4444', true],
      ['11988887777', true],
      ['(11) 98888-7777', true],
      ['551133334444', true],
      ['+55 (11) 3333-4444', true],
      ['5511998887777', true],
      ['+55 (11) 98888-7777', true],
      ['113333444', false],
      ['119888877777', false],
      ['55119988877777', false],
      ['121234567890', false],
      ['1212345678901', false],
      ['sem número', false],
      [null, true],
      ['', true],
    ] as const)('valida o limite de %j como %s', (value, valid) => {
      const error = validateLeadDraft(makeDraft({ [field]: value }))[field]
      if (valid) expect(error).toBeUndefined()
      else expect(error).toBeDefined()
    })
  })

  it('aceita CNPJ com 14 dígitos, com ou sem formatação', () => {
    expect(validateLeadDraft(makeDraft({ cnpj: '12345678000190' })).cnpj).toBeUndefined()
    expect(validateLeadDraft(makeDraft({ cnpj: '12.345.678/0001-90' })).cnpj).toBeUndefined()
  })

  it.each(['1234567800019', '123456780001900', 'sem cnpj'])('rejeita CNPJ sem 14 dígitos: %j', (cnpj) => {
    expect(validateLeadDraft(makeDraft({ cnpj })).cnpj).toBeDefined()
  })

  describe.each(VALUE_FIELDS)('%s', (field) => {
    it('aceita zero e valores positivos finitos', () => {
      expect(validateLeadDraft(makeDraft({ [field]: 0 }))[field]).toBeUndefined()
      expect(validateLeadDraft(makeDraft({ [field]: 0.01 }))[field]).toBeUndefined()
    })

    it.each([-0.01, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
      'rejeita valor negativo ou não finito: %s',
      (value) => {
        expect(validateLeadDraft(makeDraft({ [field]: value }))[field]).toBeDefined()
      },
    )
  })

  it.each([
    'http://example.com',
    'https://example.com/path?query=1#section',
    'example.com',
    'www.example.com/path',
    'example.com:8080/path',
    'http://localhost:5173/lead',
    'http://127.0.0.1:5173/lead',
  ])('aceita uma URL HTTP/HTTPS ou domínio sem esquema: %s', (value) => {
    for (const field of URL_FIELDS) {
      expect(validateLeadDraft(makeDraft({ [field]: value }))[field]).toBeUndefined()
    }
  })

  it.each([
    'javascript:alert(1)',
    'data:text/html,<h1>exemplo</h1>',
    'ftp://example.com',
    '//example.com',
    'https:///example.com',
    'https://user:pass@example.com',
    'user@example.com',
    ' example.com ',
    '   ',
    'https://exa mple.com',
    'https://example.com/\npath',
    'https://example.com/\tpath',
    'https://example.com/\u0000path',
    'https://',
    'https://example..com',
    'https://-example.com',
    'https://example-.com',
    'https://exa_mple.com',
    'example.c',
    'https://example.com:bad',
    'https://example.com/%ZZ',
    'https://example.com\\path',
  ])('rejeita URL insegura ou malformada: %j', (value) => {
    for (const field of URL_FIELDS) {
      expect(validateLeadDraft(makeDraft({ [field]: value }))[field]).toBeDefined()
    }
  })

  it('aceita campos de URL nulos ou vazios', () => {
    for (const field of URL_FIELDS) {
      expect(validateLeadDraft(makeDraft({ [field]: null }))[field]).toBeUndefined()
      expect(validateLeadDraft(makeDraft({ [field]: '' }))[field]).toBeUndefined()
    }
    expect(validateLeadDraft(makeDraft({ maps_url: null })).maps_url).toBeUndefined()
    expect(validateLeadDraft(makeDraft({ maps_url: '' })).maps_url).toBeUndefined()
  })

  it.each([
    'https://maps.app.goo.gl/exemplo',
    'maps.app.goo.gl/exemplo',
    'https://www.google.com/maps/place/Studio+Lis',
  ])('aceita um link exato do Google Maps: %s', (mapsUrl) => {
    expect(validateLeadDraft(makeDraft({ maps_url: mapsUrl })).maps_url).toBeUndefined()
  })

  it.each([
    'https://example.com/estabelecimento',
    'http://localhost:5173/lead',
    'https://www.google.com/maps/search/?api=1&query=Studio+Lis',
    'https://www.google.com/maps?api=1&query=Studio+Lis',
  ])('rejeita um link que não é o Maps exato do estabelecimento: %s', (mapsUrl) => {
    expect(validateLeadDraft(makeDraft({ maps_url: mapsUrl })).maps_url).toBeDefined()
  })

  it.each(['@perfil', '@perfil_123', '@perfil.exemplo'])('aceita o usuário do Instagram %s', (instagram) => {
    expect(validateLeadDraft(makeDraft({ instagram })).instagram).toBeUndefined()
  })

  it.each(['@', '@.', '@a..b', '@perfil.', '@perfil com espaço', '@perfil/outro', '@perfil?x=1', '@perfil#x'])('rejeita o usuário inválido do Instagram %s', (instagram) => {
    expect(validateLeadDraft(makeDraft({ instagram })).instagram).toBeDefined()
  })
})

describe('normalizeLeadDraftForSave', () => {
  it('normaliza todos os campos de URL sem esquema para HTTPS', () => {
    const normalized = normalizeLeadDraftForSave(makeDraft({
      website: 'example.com',
      menu_url: 'www.example.com/cardapio',
      catalog_url: 'example.com:8080/catalogo',
      instagram: 'instagram.com/exemplo',
      facebook: 'facebook.com/exemplo',
      maps_url: 'maps.app.goo.gl/exemplo',
    }))

    expect(normalized.website).toBe('https://example.com')
    expect(normalized.menu_url).toBe('https://www.example.com/cardapio')
    expect(normalized.catalog_url).toBe('https://example.com:8080/catalogo')
    expect(normalized.instagram).toBe('https://instagram.com/exemplo')
    expect(normalized.facebook).toBe('https://facebook.com/exemplo')
    expect(normalized.maps_url).toBe('https://maps.app.goo.gl/exemplo')
  })

  it('preserva URLs HTTP/HTTPS já informadas', () => {
    const normalized = normalizeLeadDraftForSave(makeDraft({
      website: 'http://example.com',
      menu_url: 'https://example.com/cardapio',
    }))

    expect(normalized.website).toBe('http://example.com')
    expect(normalized.menu_url).toBe('https://example.com/cardapio')
  })

  it('mantém campos de URL nulos e vazios como null', () => {
    const normalized = normalizeLeadDraftForSave(makeDraft({
      website: null,
      menu_url: '',
      catalog_url: null,
      instagram: null,
      facebook: '',
      maps_url: '',
    }))

    for (const field of URL_FIELDS) expect(normalized[field]).toBeNull()
  })

  it('converte um usuário antigo do Instagram em link absoluto', () => {
    const normalized = normalizeLeadDraftForSave(makeDraft({ instagram: '@perfil.exemplo' }))

    expect(normalized.instagram).toBe('https://www.instagram.com/perfil.exemplo/')
  })

  it('descarta um Maps que não seja um link exato válido', () => {
    const normalized = normalizeLeadDraftForSave(makeDraft({ maps_url: 'https://example.com/estabelecimento' }))

    expect(normalized.maps_url).toBeNull()
  })

  it('não muta o rascunho recebido', () => {
    const draft = makeDraft({
      website: 'example.com',
      menu_url: 'http://example.com/cardapio',
      catalog_url: null,
      instagram: 'instagram.com/exemplo',
      facebook: null,
      estimated_value: 125.5,
    })
    const original = structuredClone(draft)

    const normalized = normalizeLeadDraftForSave(draft)

    expect(draft).toEqual(original)
    expect(normalized).not.toBe(draft)
    expect(normalized).toEqual({
      ...original,
      website: 'https://example.com',
      instagram: 'https://instagram.com/exemplo',
    })
  })
})
