// src/services/projectTaskService.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db')>()
  return { ...actual, requireSupabase: vi.fn(() => ({ rpc, from })) }
})

import { createTask, deleteTask, listTasks, reorderTasks, updateTask } from './projectTaskService'

const taskInput = {
  title: 'Criar layout', description: '', status: 'pending' as const, responsibleName: '',
  startDate: null, dueDate: null, priority: 'high' as const, notes: '',
}

describe('projectTaskService', () => {
  beforeEach(() => {
    rpc.mockReset()
    from.mockReset()
  })

  it('cria tarefa com payload normalizado', async () => {
    const query = { insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'task-1' }, error: null }) }
    from.mockReturnValue(query)
    const result = await createTask('project-1', taskInput)
    expect(query.insert).toHaveBeenCalledWith({
      project_id: 'project-1', title: 'Criar layout', description: null,
      status: 'pending', responsible_name: null, start_date: null, due_date: null,
      priority: 'high', notes: null,
    })
    expect(result.id).toBe('task-1')
  })

  it('listTasks orders by position and id', async () => {
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    }
    query.order.mockReturnValueOnce(query).mockResolvedValueOnce({ data: [{ id: 'task-1' }], error: null })
    from.mockReturnValue(query)
    const result = await listTasks('project-1')
    expect(query.select).toHaveBeenCalledWith('*')
    expect(query.eq).toHaveBeenCalledWith('project_id', 'project-1')
    expect(query.order).toHaveBeenNthCalledWith(1, 'position')
    expect(query.order).toHaveBeenNthCalledWith(2, 'id')
    expect(result).toEqual([{ id: 'task-1' }])
  })

  it('updateTask envia o payload completo sem timestamps', async () => {
    const query = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'task-1' }, error: null }) }
    from.mockReturnValue(query)
    await updateTask('task-1', { ...taskInput, status: 'completed', description: 'Pronto' })
    expect(query.update).toHaveBeenCalledWith({
      title: 'Criar layout', description: 'Pronto', status: 'completed', responsible_name: null,
      start_date: null, due_date: null, priority: 'high', notes: null,
    })
    expect(query.eq).toHaveBeenCalledWith('id', 'task-1')
    expect(JSON.stringify(query.update.mock.calls[0][0])).not.toContain('completed_at')
  })

  it('deleteTask usa delete e informa linha ausente', async () => {
    const query = { delete: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'task-1' }, error: null }) }
    from.mockReturnValue(query)
    await expect(deleteTask('task-1')).resolves.toEqual({ id: 'task-1' })
    expect(query.delete).toHaveBeenCalledOnce()
    expect(query.eq).toHaveBeenCalledWith('id', 'task-1')
    query.single.mockResolvedValueOnce({ data: null, error: null })
    await expect(deleteTask('task-1')).rejects.toThrow('Tarefa não encontrada ou já excluída.')
  })

  it('reorderTasks envia a lista completa sem filtrar ou ordenar', async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null })
    await reorderTasks('project-1', ['task-cancelled', 'task-2', 'task-1'])
    expect(rpc).toHaveBeenCalledWith('reorder_project_tasks', {
      p_project_id: 'project-1', p_ordered_ids: ['task-cancelled', 'task-2', 'task-1'],
    })
    rpc.mockResolvedValueOnce({ data: null, error: null })
    await expect(reorderTasks('project-1', [])).rejects.toThrow('Resposta inválida ao reordenar tarefas.')
  })
})
