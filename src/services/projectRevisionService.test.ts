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

  it('listRevisions orders newest first', async () => {
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: [{ id: 'revision-1' }], error: null }) }
    from.mockReturnValue(query)
    await expect(listRevisions('project-1')).resolves.toEqual([{ id: 'revision-1' }])
    expect(query.order).toHaveBeenCalledWith('requested_at', { ascending: false })
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
