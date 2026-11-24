import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireSupabase } from '../lib/db'
import type { Followup } from '../types/followup'
import { cancelFollowup, completeFollowup, createFollowup } from './followupService'

vi.mock('../lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db')>()
  return { ...actual, requireSupabase: vi.fn() }
})

const followup: Followup = {
  id: '00000000-0000-0000-0000-000000000301',
  lead_id: '00000000-0000-0000-0000-000000000101',
  owner_id: '00000000-0000-0000-0000-000000000201',
  due_at: '2026-11-25T12:00:00.000Z',
  reason: 'Retornar proposta',
  note: null,
  status: 'pendente',
  completed_at: null,
  result: null,
  created_at: '2026-11-24T12:00:00.000Z',
  updated_at: '2026-11-24T12:00:00.000Z',
}

const rpc = vi.fn()
const from = vi.fn(() => {
  throw new Error('Mutação de follow-up deve usar RPC transacional.')
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireSupabase).mockReturnValue({ rpc, from } as unknown as SupabaseClient)
})

describe('followupService mutations', () => {
  it('cria o follow-up e sincroniza o próximo contato em uma única RPC', async () => {
    rpc.mockResolvedValue({ data: followup, error: null })

    await expect(createFollowup(followup.lead_id, followup.due_at, followup.reason, followup.note))
      .resolves.toEqual(followup)

    expect(rpc).toHaveBeenCalledWith('create_lead_followup', {
      p_lead_id: followup.lead_id,
      p_due_at: followup.due_at,
      p_reason: followup.reason,
      p_note: followup.note,
    })
    expect(from).not.toHaveBeenCalled()
  })

  it('retorna o follow-up concluído pela RPC', async () => {
    const completed = { ...followup, status: 'concluido' as const, result: 'Pediu retorno' }
    rpc.mockResolvedValue({ data: completed, error: null })

    await expect(completeFollowup(followup.id, 'Pediu retorno')).resolves.toEqual(completed)

    expect(rpc).toHaveBeenCalledWith('complete_lead_followup', {
      p_followup_id: followup.id,
      p_result: 'Pediu retorno',
    })
    expect(from).not.toHaveBeenCalled()
  })

  it('retorna null quando outra operação já concluiu o follow-up', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await expect(completeFollowup(followup.id, null)).resolves.toBeNull()
    expect(from).not.toHaveBeenCalled()
  })

  it('retorna o follow-up cancelado pela RPC', async () => {
    const canceled = { ...followup, status: 'cancelado' as const }
    rpc.mockResolvedValue({ data: canceled, error: null })

    await expect(cancelFollowup(followup.id)).resolves.toEqual(canceled)

    expect(rpc).toHaveBeenCalledWith('cancel_lead_followup', { p_followup_id: followup.id })
    expect(from).not.toHaveBeenCalled()
  })

  it('retorna null quando outra operação já cancelou o follow-up', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await expect(cancelFollowup(followup.id)).resolves.toBeNull()
    expect(from).not.toHaveBeenCalled()
  })

  it('propaga erro da RPC sem anunciar sucesso', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } })

    await expect(completeFollowup(followup.id, null))
      .rejects.toThrow('Sem permissão no banco. Verifique se a migration foi executada (grants/RLS).')
    expect(from).not.toHaveBeenCalled()
  })
})
