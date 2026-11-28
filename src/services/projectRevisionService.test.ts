// src/services/projectRevisionService.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { from } = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db')>()
  return { ...actual, requireSupabase: vi.fn(() => ({ from })) }
})

import { createRevision, listRevisions, updateRevision } from './projectRevisionService'

describe('projectRevisionService', () => {
  beforeEach(() => from.mockReset())

  it('createRevision normaliza responsável e notas vazios', async () => {
    const query = { insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'revision-1' }, error: null }) }
    from.mockReturnValue(query)
    await createRevision('project-1', { description: 'Ajustar banner', responsibleName: '', status: 'requested', notes: '' })
    expect(query.insert).toHaveBeenCalledWith({
      project_id: 'project-1', description: 'Ajustar banner', responsible_name: null,
      status: 'requested', notes: null,
    })
  })

  it('listRevisions percorre todas as páginas com desempate por id', async () => {
    const revisions = Array.from({ length: 1001 }, (_, index) => ({
      id: `revision-${String(index).padStart(4, '0')}`,
      requested_at: `2026-01-${String(Math.floor((1000 - index) / 100) + 1).padStart(2, '0')}T00:00:00Z`,
    }))
    const queries = [revisions.slice(0, 1000), revisions.slice(1000)].map((page) => ({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: page, error: null }),
    }))
    from.mockReturnValueOnce(queries[0]).mockReturnValueOnce(queries[1])

    const result = await listRevisions('project-1')

    expect(from).toHaveBeenCalledTimes(2)
    expect(from).toHaveBeenNthCalledWith(1, 'project_revisions')
    expect(from).toHaveBeenNthCalledWith(2, 'project_revisions')
    expect(queries[0].range).toHaveBeenCalledWith(0, 999)
    expect(queries[1].range).toHaveBeenCalledWith(1000, 1999)
    for (const query of queries) {
      expect(query.select).toHaveBeenCalledWith('*')
      expect(query.eq).toHaveBeenCalledWith('project_id', 'project-1')
      expect(query.order).toHaveBeenNthCalledWith(1, 'requested_at', { ascending: false })
      expect(query.order).toHaveBeenNthCalledWith(2, 'id', { ascending: true })
    }
    expect(result).toEqual(revisions)
  })

  it('listRevisions propaga falha de qualquer página', async () => {
    const firstPage = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: Array.from({ length: 1000 }, (_, index) => ({ id: `revision-${index}` })), error: null }),
    }
    const secondPage = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: null, error: { message: 'falha na segunda página' } }),
    }
    from.mockReturnValueOnce(firstPage).mockReturnValueOnce(secondPage)

    await expect(listRevisions('project-1')).rejects.toThrow('Não foi possível concluir a operação. Tente novamente.')
    expect(secondPage.range).toHaveBeenCalledWith(1000, 1999)
  })

  it('listRevisions orders newest first with deterministic id tie-breaker', async () => {
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: [{ id: 'revision-1' }], error: null }),
    }
    query.order.mockReturnValueOnce(query).mockReturnValueOnce(query)
    from.mockReturnValue(query)
    await expect(listRevisions('project-1')).resolves.toEqual([{ id: 'revision-1' }])
    expect(query.order).toHaveBeenNthCalledWith(1, 'requested_at', { ascending: false })
    expect(query.order).toHaveBeenNthCalledWith(2, 'id', { ascending: true })
    expect(query.range).toHaveBeenCalledWith(0, 999)
  })

  it('aprova por update sem escrever approved_at', async () => {
    const query = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'revision-1', status: 'approved' }, error: null }) }
    from.mockReturnValue(query)
    const result = await updateRevision('revision-1', {
      description: 'Ajustar banner', responsibleName: '', status: 'approved', notes: '',
    })
    expect(query.update).toHaveBeenCalledWith({
      description: 'Ajustar banner', responsible_name: null, status: 'approved', notes: null,
    })
    expect(query.eq).toHaveBeenCalledWith('id', 'revision-1')
    expect(JSON.stringify(query.update.mock.calls[0][0])).not.toContain('approved_at')
    expect(result.status).toBe('approved')
  })
})
