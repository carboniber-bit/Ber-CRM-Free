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

  it('listTasks percorre todas as páginas com ordem position e id', async () => {
    const tasks = Array.from({ length: 1001 }, (_, index) => ({
      id: `task-${String(index).padStart(4, '0')}`,
      position: Math.floor(index / 2),
    }))
    const queries = [tasks.slice(0, 1000), tasks.slice(1000)].map((page) => ({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: page, error: null }),
    }))
    from.mockReturnValueOnce(queries[0]).mockReturnValueOnce(queries[1])

    const result = await listTasks('project-1')

    expect(from).toHaveBeenCalledTimes(2)
    expect(from).toHaveBeenNthCalledWith(1, 'project_tasks')
    expect(from).toHaveBeenNthCalledWith(2, 'project_tasks')
    expect(queries[0].range).toHaveBeenCalledWith(0, 999)
    expect(queries[1].range).toHaveBeenCalledWith(1000, 1999)
    for (const query of queries) {
      expect(query.select).toHaveBeenCalledWith('*')
      expect(query.eq).toHaveBeenCalledWith('project_id', 'project-1')
      expect(query.order).toHaveBeenNthCalledWith(1, 'position')
      expect(query.order).toHaveBeenNthCalledWith(2, 'id')
    }
    expect(result).toEqual(tasks)
  })

  it('listTasks mantém a lista completa disponível para reordenação', async () => {
    const tasks = Array.from({ length: 1001 }, (_, index) => ({
      id: `task-${String(index).padStart(4, '0')}`,
      position: index,
    }))
    const queries = [tasks.slice(0, 1000), tasks.slice(1000)].map((page) => ({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: page, error: null }),
    }))
    from.mockReturnValueOnce(queries[0]).mockReturnValueOnce(queries[1])
    rpc.mockResolvedValue({ data: { ok: true }, error: null })

    const result = await listTasks('project-1')
    await reorderTasks('project-1', result.map((task) => task.id))

    expect(rpc).toHaveBeenCalledWith('reorder_project_tasks', {
      p_project_id: 'project-1', p_ordered_ids: tasks.map((task) => task.id),
    })
  })

  it('listTasks propaga falha de qualquer página', async () => {
    const firstPage = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: Array.from({ length: 1000 }, (_, index) => ({ id: `task-${index}` })), error: null }),
    }
    const secondPage = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: null, error: { message: 'falha na segunda página' } }),
    }
    from.mockReturnValueOnce(firstPage).mockReturnValueOnce(secondPage)

    await expect(listTasks('project-1')).rejects.toThrow('Não foi possível concluir a operação. Tente novamente.')
    expect(secondPage.range).toHaveBeenCalledWith(1000, 1999)
  })

  it('listTasks orders by position and id', async () => {
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: [{ id: 'task-1' }], error: null }),
    }
    query.order.mockReturnValueOnce(query).mockReturnValueOnce(query)
    from.mockReturnValue(query)
    const result = await listTasks('project-1')
    expect(query.select).toHaveBeenCalledWith('*')
    expect(query.eq).toHaveBeenCalledWith('project_id', 'project-1')
    expect(query.order).toHaveBeenNthCalledWith(1, 'position')
    expect(query.order).toHaveBeenNthCalledWith(2, 'id')
    expect(query.range).toHaveBeenCalledWith(0, 999)
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
    const query = { delete: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'task-1' }, error: null }) }
    from.mockReturnValue(query)
    await expect(deleteTask('task-1')).resolves.toEqual({ id: 'task-1' })
    expect(query.delete).toHaveBeenCalledOnce()
    expect(query.eq).toHaveBeenCalledWith('id', 'task-1')
    expect(query.maybeSingle).toHaveBeenCalled()
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
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
