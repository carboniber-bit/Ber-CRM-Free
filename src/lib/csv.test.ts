// src/lib/csv.test.ts
import Papa from 'papaparse'
import { describe, expect, it } from 'vitest'
import { CSV_HEADERS, leadsToCsv, parseLeadsCsv } from './csv'
import { emptyLeadDraft, type Lead } from '../types/lead'

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    ...emptyLeadDraft(),
    id: '00000000-0000-0000-0000-000000000001',
    owner_id: '00000000-0000-0000-0000-000000000002',
    score: 0,
    priority: 'baixa',
    needs: [],
    score_reasons: [],
    created_at: '2026-11-22T00:00:00Z',
    updated_at: '2026-11-22T00:00:00Z',
    name: 'Barbearia do João',
    niche: 'barbearia',
    city: 'São Paulo',
    has_website: 'no',
    estimated_value: 1500,
    ...overrides,
  } as Lead
}

describe('leadsToCsv', () => {
  it('gera header + linha com dados', () => {
    const csv = leadsToCsv([makeLead()])
    const lines = csv.trim().split('\n')
    expect(lines[0].replace(/"/g, '')).toBe(CSV_HEADERS.join(','))
    expect(lines[1]).toContain('Barbearia do João')
    expect(lines[1]).toContain('não') // presença no exportada em pt-BR
  })

  it('mantém os 30 cabeçalhos e a quebra de linha LF', () => {
    const csv = leadsToCsv([makeLead()])
    expect(CSV_HEADERS).toHaveLength(30)
    expect(csv.split('\n')[0]).toBe(CSV_HEADERS.join(','))
    expect(csv).not.toContain('\r')
  })

  it.each([
    ['=1+1', "'=1+1"],
    [' +1', "' +1"],
    ['-1', "'-1"],
    ['@SOMA(A1)', "'@SOMA(A1)"],
    ['\t=1', "'\t=1"],
    ['\r=1', "'\r=1"],
    ['\ttexto', "'\ttexto"],
    ['\rtexto', "'\rtexto"],
    ['  @valor', "'  @valor"],
    ['texto normal', 'texto normal'],
  ])('protege a célula exportada %j contra fórmulas', (value, expected) => {
    const csv = leadsToCsv([makeLead({ name: value, notes: value })])
    const parsed = Papa.parse<string[]>(csv)
    expect(parsed.data[1][0]).toBe(expected)
    expect(parsed.data[1][21]).toBe(expected)
  })
})

describe('parseLeadsCsv', () => {
  it('importa linha válida', () => {
    const csv = 'nome,cidade,tem_site,valor_estimado\nBarbearia do João,São Paulo,não,"1.500,00"'
    const rows = parseLeadsCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].errors).toEqual([])
    expect(rows[0].draft?.name).toBe('Barbearia do João')
    expect(rows[0].draft?.has_website).toBe('no')
    expect(rows[0].draft?.estimated_value).toBe(1500)
    expect(rows[0].draft?.status).toBe('novo')
  })

  it('acusa nome obrigatório', () => {
    const rows = parseLeadsCsv('nome,cidade\n,São Paulo')
    expect(rows[0].draft).toBeNull()
    expect(rows[0].errors.join(' ')).toMatch(/Nome/)
  })

  it('presença desconhecida vira erro; vazio vira unverified', () => {
    const rows = parseLeadsCsv('nome,tem_site,tem_instagram\nA,talvez,\nB,,sim')
    expect(rows[0].errors.join(' ')).toMatch(/tem_site/)
    expect(rows[1].draft?.has_instagram).toBe('yes')
    expect(rows[1].draft?.has_website).toBe('unverified')
  })

  it('status inválido vira erro; label pt-BR é aceito', () => {
    const rows = parseLeadsCsv('nome,status\nA,xyz\nB,Interessado')
    expect(rows[0].draft).toBeNull()
    expect(rows[1].draft?.status).toBe('interessado')
  })

  it('valor inválido vira erro', () => {
    const rows = parseLeadsCsv('nome,valor_estimado\nA,abc')
    expect(rows[0].errors.join(' ')).toMatch(/valor_estimado/)
  })

  it.each([
    ['', 0],
    ['0', 0],
    ['1500', 1500],
    ['1500.50', 1500.5],
    ['1500.5', 1500.5],
    [' 1500.50 ', 1500.5],
    ['1500,50', 1500.5],
    ['1.500,50', 1500.5],
    ['9.999.999.999,99', 9999999999.99],
  ])('aceita a forma monetária documentada %j', (value, expected) => {
    const cell = value.includes(',') ? `"${value}"` : value
    const rows = parseLeadsCsv(`nome,valor_estimado\nA,${cell}`)
    expect(rows[0].errors).toEqual([])
    expect(rows[0].draft?.estimated_value).toBe(expected)
  })

  it.each([
    '1.500', '1.500.00', '1,500.50', '1,2,3', '1.2,3', '12,34,56',
    '1500.', '.50', ',50', '1500.500', '1.500,500', '1e3', '1E3',
    '-1', '+1', 'NaN', 'Infinity', 'abc', '1 500,00', '10000000000',
    '10000000000.00', '9999999999.999',
  ])('rejeita o valor monetário ambíguo, inválido ou fora de escala %j', (value) => {
    const cell = value.includes(',') ? `"${value}"` : value
    const rows = parseLeadsCsv(`nome,valor_estimado\nA,${cell}`)
    expect(rows[0].draft).toBeNull()
    expect(rows[0].errors.join(' ')).toMatch(/valor_estimado/)
  })

  it('não invalida um CSV válido de uma coluna pelo aviso de detecção de delimitador', () => {
    const rows = parseLeadsCsv('nome\nA\nB')
    expect(rows.map((row) => row.draft?.name)).toEqual(['A', 'B'])
    expect(rows.map((row) => row.errors)).toEqual([[], []])
  })

  it('invalida uma linha com campo extra em vez de aceitar o objeto parcial', () => {
    const rows = parseLeadsCsv('nome,cidade\nA,São Paulo,campo_extra\nB,Rio')
    expect(rows).toHaveLength(2)
    expect(rows[0].draft).toBeNull()
    expect(rows[0].errors.join(' ')).toMatch(/TooManyFields/)
    expect(rows[1].draft?.name).toBe('B')
    expect(rows[1].errors).toEqual([])
  })

  it('invalida uma linha com menos campos que o cabeçalho', () => {
    const rows = parseLeadsCsv('nome,cidade,valor_estimado\nA,São Paulo\nB,Rio,10')
    expect(rows[0].draft).toBeNull()
    expect(rows[0].errors.join(' ')).toMatch(/TooFewFields/)
    expect(rows[1].draft?.estimated_value).toBe(10)
  })

  it('expõe uma aspas não fechada como erro estrutural da linha', () => {
    const rows = parseLeadsCsv('nome,cidade\n"A,São Paulo')
    expect(rows).toHaveLength(1)
    expect(rows[0].line).toBe(2)
    expect(rows[0].draft).toBeNull()
    expect(rows[0].errors.join(' ')).toMatch(/MissingQuotes/)
  })

  it('usa a linha física inicial após registros vazios e campos multilinha', () => {
    const csv = [
      'nome,cidade',
      '',
      '"Empresa',
      'Multilinha",São Paulo',
      '',
      ',Rio',
      '',
      'Válida,Curitiba',
    ].join('\n')
    const rows = parseLeadsCsv(csv)
    expect(rows.map((row) => row.line)).toEqual([3, 6, 8])
    expect(rows[0].draft?.name).toBe('Empresa\nMultilinha')
    expect(rows[0].draft?.city).toBe('São Paulo')
    expect(rows[1].draft).toBeNull()
    expect(rows[1].errors.join(' ')).toMatch(/Nome/)
    expect(rows[2].draft?.name).toBe('Válida')
  })

  it('também preserva as linhas físicas em arquivos CRLF', () => {
    const csv = 'nome,cidade\r\n\r\n"A\r\nA2",São Paulo\r\n,Rio\r\nB,Curitiba'
    const rows = parseLeadsCsv(csv)
    expect(rows.map((row) => row.line)).toEqual([3, 5, 6])
  })

  it('preserva país vazio como nulo e não inventa Brasil', () => {
    const rows = parseLeadsCsv('nome,pais\nA,\nB,Argentina\nC,Brasil')
    expect(rows.map((row) => row.draft?.country)).toEqual([null, 'Argentina', 'Brasil'])
    expect(emptyLeadDraft().country).toBe('Brasil')
  })

  it('roundtrip export → import preserva dados essenciais', () => {
    const original = makeLead()
    const rows = parseLeadsCsv(leadsToCsv([original]))
    expect(rows[0].errors).toEqual([])
    expect(rows[0].draft?.name).toBe(original.name)
    expect(rows[0].draft?.has_website).toBe('no')
    expect(rows[0].draft?.estimated_value).toBe(1500)
    expect(rows[0].draft?.niche).toBe('barbearia')
  })
})