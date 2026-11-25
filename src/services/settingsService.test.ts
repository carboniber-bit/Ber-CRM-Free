import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { requireSupabase } from '../lib/db'
import { getProfileName, updateProfileName } from './settingsService'

vi.mock('../lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db')>()
  return { ...actual, requireSupabase: vi.fn() }
})

const userId = '00000000-0000-0000-0000-000000000201'
const getUser = vi.fn()
const from = vi.fn()
const select = vi.fn()
const readEq = vi.fn()
const maybeSingle = vi.fn()
const update = vi.fn()
const updateEq = vi.fn()

let consoleError: ReturnType<typeof vi.spyOn>
let consoleWarn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  consoleError = vi.spyOn(console, 'error')
  consoleWarn = vi.spyOn(console, 'warn')
  getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null })
  from.mockReturnValue({ select, update })
  select.mockReturnValue({ eq: readEq })
  readEq.mockReturnValue({ maybeSingle })
  maybeSingle.mockResolvedValue({ data: { full_name: 'Ana Lima' }, error: null })
  update.mockReturnValue({ eq: updateEq })
  updateEq.mockResolvedValue({ data: null, error: null })
  vi.mocked(requireSupabase).mockReturnValue({ auth: { getUser }, from } as unknown as SupabaseClient)
})

afterEach(() => {
  expect(consoleError).not.toHaveBeenCalled()
  expect(consoleWarn).not.toHaveBeenCalled()
  consoleError.mockRestore()
  consoleWarn.mockRestore()
})

describe('getProfileName', () => {
  it('lê somente full_name do perfil do usuário autenticado', async () => {
    await expect(getProfileName()).resolves.toBe('Ana Lima')

    expect(from).toHaveBeenCalledWith('profiles')
    expect(select).toHaveBeenCalledWith('full_name')
    expect(readEq).toHaveBeenCalledWith('id', userId)
    expect(maybeSingle).toHaveBeenCalledTimes(1)
  })

  it('retorna nome neutro quando full_name é nulo', async () => {
    maybeSingle.mockResolvedValue({ data: { full_name: null }, error: null })

    await expect(getProfileName()).resolves.toBe('')
  })

  it('retorna nome neutro quando o perfil ainda não existe', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(getProfileName()).resolves.toBe('')
  })

  it('não consulta profiles sem usuário autenticado', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })

    await expect(getProfileName()).rejects.toThrow('Sua sessão expirou. Entre novamente.')
    expect(from).not.toHaveBeenCalled()
  })

  it('trata falha de autenticação como sessão inválida', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'JWT expirado' } })

    await expect(getProfileName()).rejects.toThrow('Não foi possível validar sua sessão. Entre novamente.')
    expect(from).not.toHaveBeenCalled()
  })

  it('propaga erro de banco traduzido na leitura do perfil', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'permission denied' } })

    await expect(getProfileName()).rejects.toThrow(
      'Sem permissão no banco. Verifique se a migration foi executada (grants/RLS).',
    )
  })
})

describe('updateProfileName', () => {
  it('atualiza full_name somente no perfil do usuário autenticado', async () => {
    await expect(updateProfileName('Ana Silva')).resolves.toBeUndefined()

    expect(from).toHaveBeenCalledWith('profiles')
    expect(update).toHaveBeenCalledWith({ full_name: 'Ana Silva' })
    expect(updateEq).toHaveBeenCalledWith('id', userId)
  })

  it('não atualiza profiles sem usuário autenticado', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })

    await expect(updateProfileName('Ana Silva')).rejects.toThrow('Sessão expirada. Entre novamente.')
    expect(from).not.toHaveBeenCalled()
  })

  it('propaga erro de banco traduzido na atualização do perfil', async () => {
    updateEq.mockResolvedValue({ data: null, error: { message: 'row-level security' } })

    await expect(updateProfileName('Ana Silva')).rejects.toThrow(
      'Acesso negado pelas regras de segurança (RLS).',
    )
  })
})
