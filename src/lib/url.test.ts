import { describe, expect, it } from 'vitest'
import { buildMapsSearchUrl, normalizeClientUrl, normalizeInstagramUrl, normalizeMapsUrl } from './url'

describe('normalizeClientUrl', () => {
  it('normaliza domínio e preserva vazio como string', () => {
    expect(normalizeClientUrl('exemplo.com')).toBe('https://exemplo.com')
    expect(normalizeClientUrl('')).toBe('')
    expect(normalizeClientUrl(null)).toBe('')
  })
  it('rejeita esquema inseguro e URL inválida', () => {
    expect(normalizeClientUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeClientUrl('https://')).toBeNull()
  })
})

describe('normalizeInstagramUrl', () => {
  it.each(['@perfil', '@perfil_123', '@perfil.exemplo'])('converte %s em URL absoluta', (value) => {
    expect(normalizeInstagramUrl(value)).toBe(`https://www.instagram.com/${value.slice(1)}/`)
  })

  it.each(['@', '@.', '@a..b', '@perfil.', '@perfil com espaço', '@perfil/outro', '@perfil?x=1', '@perfil#x'])('rejeita %s', (value) => {
    expect(normalizeInstagramUrl(value)).toBeNull()
  })

  it('preserva uma URL HTTP/HTTPS válida e rejeita esquema inseguro', () => {
    expect(normalizeInstagramUrl('https://instagram.com/perfil')).toBe('https://instagram.com/perfil')
    expect(normalizeInstagramUrl('javascript:alert(1)')).toBeNull()
  })

  it.each([
    'https://example.com/perfil',
    'https://instagram.com.evil.test/perfil',
    'https://www.instagram.com@evil.test/perfil',
  ])('rejeita URL que não pertence ao Instagram: %s', (value) => {
    expect(normalizeInstagramUrl(value)).toBeNull()
  })

  it('preserva vazio como string', () => {
    expect(normalizeInstagramUrl('')).toBe('')
    expect(normalizeInstagramUrl(null)).toBe('')
  })
})

describe('normalizeMapsUrl', () => {
  it.each([
    'https://maps.app.goo.gl/exemplo',
    'maps.app.goo.gl/exemplo',
    'https://www.google.com/maps/place/Studio+Lis',
    'https://maps.google.com/?cid=123',
    'https://goo.gl/maps/exemplo',
    'https://www.google.com/maps?query=placeid:ChIJ-exemplo',
    'https://www.google.com/maps?query_place_id=ChIJ-exemplo',
    'https://maps.google.com/maps?cid=123',
  ])('aceita o link exato do Maps %s', (value) => {
    expect(normalizeMapsUrl(value)).toBe(value.startsWith('http') ? value : `https://${value}`)
  })

  it.each([
    'https://example.com/estabelecimento',
    'http://localhost:5173/lead',
    'https://www.google.com/maps/search/?api=1&query=Studio+Lis',
    'https://www.google.com/maps?api=1&query=Studio+Lis',
    'https://www.google.com/search?q=placeid:ChIJ-exemplo',
    'https://www.google.com/?cid=123',
    'https://www.google.com/maps?q=placeid:',
    'https://www.google.com/maps?query=placeid:%20',
    'https://www.google.com/maps?query_place_id=',
    'https://www.google.com/maps?query_place_id=%20',
    'https://www.google.com/maps?cid=',
    'https://maps.google.com/?cid=abc',
    'https://maps.google.com/?cid=-1',
    'https://maps.app.goo.gl',
    'javascript:alert(1)',
  ])('rejeita URL que não identifica um estabelecimento no Maps: %s', (value) => {
    expect(normalizeMapsUrl(value)).toBeNull()
  })

  it('preserva vazio como string', () => {
    expect(normalizeMapsUrl('')).toBe('')
    expect(normalizeMapsUrl(null)).toBe('')
  })
})

describe('buildMapsSearchUrl', () => {
  it('gera uma busca do Maps com nome e endereço codificados', () => {
    expect(buildMapsSearchUrl(['Studio Lis Nail Design', 'Rua das Flores, 123', 'Osasco', 'SP']))
      .toBe('https://www.google.com/maps/search/?api=1&query=Studio%20Lis%20Nail%20Design%2C%20Rua%20das%20Flores%2C%20123%2C%20Osasco%2C%20SP')
  })

  it('ignora partes vazias e não inventa uma busca sem dados', () => {
    expect(buildMapsSearchUrl([null, '', '  ', 'Osasco']))
      .toBe('https://www.google.com/maps/search/?api=1&query=Osasco')
    expect(buildMapsSearchUrl([null, '', '  '])).toBeNull()
  })
})
