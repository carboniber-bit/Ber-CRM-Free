// @vitest-environment jsdom
// src/components/projects/ProjectTaskList.test.tsx
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectTask } from '../../types/project'

const { listTasks, createTask, updateTask, deleteTask, reorderTasks } = vi.hoisted(() => ({
  listTasks: vi.fn(), createTask: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn(), reorderTasks: vi.fn(),
}))
const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('../../services/projectTaskService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/projectTaskService')>()
  return { ...actual, listTasks, createTask, updateTask, deleteTask, reorderTasks }
})
vi.mock('../../hooks/useToast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useToast')>()
  return { ...actual, useToast: () => ({ toast }) }
})

import { ProjectTaskList } from './ProjectTaskList'

function makeTask(
  id: string,
  title: string,
  status: ProjectTask['status'] = 'pending',
  position = 0,
): ProjectTask {
  return {
    id, owner_id: 'owner-1', project_id: 'p1', title, description: null, status,
    responsible_name: null, start_date: null, due_date: null, priority: 'medium', position,
    notes: null, completed_at: null, cancelled_at: null,
    created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
  }
}

afterEach(cleanup)

describe('ProjectTaskList', () => {
  beforeEach(() => {
    listTasks.mockReset().mockResolvedValue([])
    createTask.mockReset()
    updateTask.mockReset()
    deleteTask.mockReset()
    reorderTasks.mockReset()
    toast.mockReset()
  })

  it('mostra estado vazio e Sem tarefas ativas sem inventar progresso', async () => {
    render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    expect((await screen.findByText('Nenhuma tarefa cadastrada.')).textContent).toBe('Nenhuma tarefa cadastrada.')
    expect(screen.getByText('Sem tarefas ativas').textContent).toBe('Sem tarefas ativas')
  })

  it('cria tarefa e recalcula progresso pelos dados confirmados', async () => {
    listTasks.mockResolvedValueOnce([]).mockResolvedValueOnce([
      makeTask('t1', 'Layout', 'completed', 0),
      makeTask('t2', 'Conteúdo', 'pending', 1),
    ])
    createTask.mockResolvedValue({ id: 't1' })
    const onChanged = vi.fn()
    render(<ProjectTaskList projectId="p1" onChanged={onChanged} />)
    await screen.findByText('Nenhuma tarefa cadastrada.')
    fireEvent.click(screen.getByRole('button', { name: 'Nova tarefa' }))
    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Layout' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar tarefa' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect((await screen.findByText('50%')).textContent).toBe('50%')
  })

  it('exige confirmação antes de excluir tarefa', async () => {
    listTasks.mockResolvedValue([makeTask('t1', 'Layout')])
    deleteTask.mockResolvedValue({ id: 't1' })
    render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir tarefa Layout' }))
    expect(deleteTask).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog').textContent).toMatch(/Excluir tarefa Layout/)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))
    await waitFor(() => expect(deleteTask).toHaveBeenCalledWith('t1'))
  })

  it('bloqueia prazo anterior ao início', async () => {
    render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    await screen.findByText('Nenhuma tarefa cadastrada.')
    fireEvent.click(screen.getByRole('button', { name: 'Nova tarefa' }))
    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Tarefa' } })
    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2026-11-25' } })
    fireEvent.change(screen.getByLabelText('Prazo'), { target: { value: '2026-11-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar tarefa' }))
    expect((await screen.findByText('O prazo não pode anteceder o início.')).textContent)
      .toBe('O prazo não pode anteceder o início.')
    expect(createTask).not.toHaveBeenCalled()
  })

  it('atualiza status com payload integral sem enviar timestamps', async () => {
    const existing = makeTask('t1', 'Layout')
    listTasks.mockResolvedValue([existing])
    updateTask.mockResolvedValue({ ...existing, status: 'completed' })
    render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    fireEvent.change(await screen.findByLabelText('Status da tarefa Layout'), { target: { value: 'completed' } })
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith('t1', {
      title: 'Layout', description: '', status: 'completed', responsibleName: '',
      startDate: null, dueDate: null, priority: 'medium', notes: '',
    }))
    const payload = updateTask.mock.calls[0][1] as Record<string, unknown>
    expect(payload).not.toHaveProperty('completed_at')
    expect(payload).not.toHaveProperty('cancelled_at')
  })

  it('reordena enviando todos os IDs na nova ordem', async () => {
    listTasks.mockResolvedValue([makeTask('t1', 'Primeira', 'pending', 0), makeTask('t2', 'Segunda', 'pending', 1)])
    reorderTasks.mockResolvedValue(undefined)
    render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Mover tarefa Primeira para baixo' }))
    await waitFor(() => expect(reorderTasks).toHaveBeenCalledWith('p1', ['t2', 't1']))
  })

  it('preserva a última lista e permite retry após falha de refresh', async () => {
    listTasks.mockResolvedValue([makeTask('t1', 'Layout')])
    render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    await screen.findByText('Layout')
    listTasks.mockRejectedValueOnce(new Error('Falha ao atualizar tarefas.'))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar tarefas' }))
    expect((await screen.findByText('Falha ao atualizar tarefas.')).textContent).toBe('Falha ao atualizar tarefas.')
    expect(screen.getByText('Layout')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('descarta resposta de um projeto anterior', async () => {
    const old = deferred<ProjectTask[]>()
    listTasks.mockReturnValueOnce(old.promise).mockResolvedValueOnce([makeTask('t2', 'Tarefa nova')])
    const { rerender } = render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    rerender(<ProjectTaskList projectId="p2" onChanged={vi.fn()} />)
    expect((await screen.findByText('Tarefa nova')).textContent).toBe('Tarefa nova')
    await act(async () => {
      old.resolve([makeTask('t1', 'Tarefa antiga')])
      await old.promise
    })
    expect(screen.queryByText('Tarefa antiga')).toBeNull()
  })

  it('projeto cancelado preserva histórico e desabilita mutações', async () => {
    listTasks.mockResolvedValue([makeTask('t1', 'Layout')])
    render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} disabled />)
    await screen.findByText('Layout')
    expect(screen.getByText(/Projeto cancelado/).textContent).toMatch(/Projeto cancelado/)
    expect((screen.getByRole('button', { name: 'Nova tarefa' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('Status da tarefa Layout') as HTMLSelectElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Excluir tarefa Layout' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}
