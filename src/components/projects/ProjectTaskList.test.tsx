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
    createTask.mockResolvedValue(makeTask('t1', 'Layout', 'pending', 0))
    const onChanged = vi.fn()
    render(<ProjectTaskList projectId="p1" onChanged={onChanged} />)
    await screen.findByText('Nenhuma tarefa cadastrada.')
    fireEvent.click(screen.getByRole('button', { name: 'Nova tarefa' }))
    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Layout' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar tarefa' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect((await screen.findByText('50%')).textContent).toBe('50%')
  })

  it('preserva status e métricas confirmados quando o refresh falha', async () => {
    const existing = makeTask('t1', 'Layout')
    const completed = { ...existing, status: 'completed' as const }
    listTasks.mockResolvedValueOnce([existing]).mockRejectedValueOnce(new Error('Falha ao atualizar tarefas.'))
    updateTask.mockResolvedValue(completed)
    const onChanged = vi.fn()
    render(<ProjectTaskList projectId="p1" onChanged={onChanged} />)
    fireEvent.change(await screen.findByLabelText('Status da tarefa Layout'), { target: { value: 'completed' } })

    expect(await screen.findByText('Falha ao atualizar tarefas.')).toBeTruthy()
    expect((screen.getByLabelText('Status da tarefa Layout') as HTMLSelectElement).value).toBe('completed')
    expect(screen.getByRole('progressbar', { name: 'Progresso de tarefas' }).getAttribute('aria-valuenow')).toBe('100')
    expect(screen.getByText('100%')).toBeTruthy()
    expect(onChanged).toHaveBeenCalledWith([completed])
  })

  it('preserva tarefa criada quando o refresh falha', async () => {
    const created = makeTask('t1', 'Nova tarefa')
    listTasks.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('Falha ao atualizar tarefas.'))
    createTask.mockResolvedValue(created)
    const onChanged = vi.fn()
    render(<ProjectTaskList projectId="p1" onChanged={onChanged} />)
    await screen.findByText('Nenhuma tarefa cadastrada.')
    fireEvent.click(screen.getByRole('button', { name: 'Nova tarefa' }))
    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Nova tarefa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar tarefa' }))

    expect(await screen.findByRole('heading', { name: 'Nova tarefa' })).toBeTruthy()
    expect(screen.getByText('Falha ao atualizar tarefas.')).toBeTruthy()
    expect(onChanged).toHaveBeenCalledWith([created])
  })

  it('preserva edição confirmada quando o refresh falha', async () => {
    const existing = makeTask('t1', 'Layout')
    const updated = { ...existing, title: 'Layout atualizado' }
    listTasks.mockResolvedValueOnce([existing]).mockRejectedValueOnce(new Error('Falha ao atualizar tarefas.'))
    updateTask.mockResolvedValue(updated)
    const onChanged = vi.fn()
    render(<ProjectTaskList projectId="p1" onChanged={onChanged} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Editar tarefa Layout' }))
    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Layout atualizado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar tarefa' }))

    expect(await screen.findByRole('heading', { name: 'Layout atualizado' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Layout' })).toBeNull()
    expect(onChanged).toHaveBeenCalledWith([updated])
  })

  it('preserva exclusão confirmada quando o refresh falha', async () => {
    const existing = makeTask('t1', 'Layout')
    listTasks.mockResolvedValueOnce([existing]).mockRejectedValueOnce(new Error('Falha ao atualizar tarefas.'))
    deleteTask.mockResolvedValue({ id: 't1' })
    const onChanged = vi.fn()
    render(<ProjectTaskList projectId="p1" onChanged={onChanged} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir tarefa Layout' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))

    expect(await screen.findByText('Falha ao atualizar tarefas.')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Layout' })).toBeNull()
    expect(screen.getByText('Sem tarefas ativas')).toBeTruthy()
    expect(onChanged).toHaveBeenCalledWith([])
  })

  it('preserva reordenação confirmada quando o refresh falha', async () => {
    const first = makeTask('t1', 'Primeira', 'pending', 0)
    const second = makeTask('t2', 'Segunda', 'pending', 1)
    listTasks.mockResolvedValueOnce([first, second]).mockRejectedValueOnce(new Error('Falha ao atualizar tarefas.'))
    reorderTasks.mockResolvedValue(undefined)
    const onChanged = vi.fn()
    render(<ProjectTaskList projectId="p1" onChanged={onChanged} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Mover tarefa Primeira para baixo' }))

    expect(await screen.findByText('Falha ao atualizar tarefas.')).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Segunda', 'Primeira'])
    expect(onChanged).toHaveBeenCalledWith([second, first])
  })

  it('notifica o detalhe após desmontar apenas a aba durante a mutação', async () => {
    const existing = makeTask('t1', 'Layout')
    const completed = { ...existing, status: 'completed' as const }
    const mutation = deferred<ProjectTask>()
    listTasks.mockResolvedValue([existing])
    updateTask.mockReturnValue(mutation.promise)
    const onChanged = vi.fn()
    const { unmount } = render(<ProjectTaskList projectId="p1" onChanged={onChanged} />)
    fireEvent.change(await screen.findByLabelText('Status da tarefa Layout'), { target: { value: 'completed' } })
    await waitFor(() => expect(updateTask).toHaveBeenCalled())
    unmount()

    await act(async () => {
      mutation.resolve(completed)
      await mutation.promise
    })

    expect(onChanged).toHaveBeenCalledWith([completed])
  })

  it('descarta mutação confirmada de projeto anterior', async () => {
    const existing = makeTask('t1', 'Layout')
    const mutation = deferred<ProjectTask>()
    const newTask = { ...makeTask('t2', 'Tarefa nova'), project_id: 'p2' }
    listTasks.mockResolvedValueOnce([existing]).mockResolvedValueOnce([newTask])
    updateTask.mockReturnValue(mutation.promise)
    const onChanged = vi.fn()
    const { rerender } = render(<ProjectTaskList projectId="p1" onChanged={onChanged} />)
    fireEvent.change(await screen.findByLabelText('Status da tarefa Layout'), { target: { value: 'completed' } })
    await waitFor(() => expect(updateTask).toHaveBeenCalled())
    rerender(<ProjectTaskList projectId="p2" onChanged={onChanged} />)
    await screen.findByLabelText('Status da tarefa Tarefa nova')

    await act(async () => {
      mutation.resolve({ ...existing, status: 'completed' })
      await mutation.promise
    })

    expect((screen.getByLabelText('Status da tarefa Tarefa nova') as HTMLSelectElement).value).toBe('pending')
    expect(onChanged).not.toHaveBeenCalled()
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

  it('exige título antes de criar tarefa', async () => {
    render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    await screen.findByText('Nenhuma tarefa cadastrada.')
    fireEvent.click(screen.getByRole('button', { name: 'Nova tarefa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar tarefa' }))
    expect((await screen.findByText('Informe o título da tarefa.')).textContent)
      .toBe('Informe o título da tarefa.')
    expect(createTask).not.toHaveBeenCalled()
  })

  it('não preserva tarefas do projeto anterior quando a carga do novo projeto falha', async () => {
    listTasks
      .mockResolvedValueOnce([makeTask('t1', 'Tarefa antiga')])
      .mockRejectedValueOnce(new Error('Falha ao carregar tarefas do novo projeto.'))
    const { rerender } = render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    await screen.findByText('Tarefa antiga')
    rerender(<ProjectTaskList projectId="p2" onChanged={vi.fn()} />)
    expect((await screen.findByText('Falha ao carregar tarefas do novo projeto.')).textContent)
      .toBe('Falha ao carregar tarefas do novo projeto.')
    expect(screen.queryByText('Tarefa antiga')).toBeNull()
    expect(screen.queryByLabelText('Status da tarefa Tarefa antiga')).toBeNull()
  })

  it('fecha o editor e não atualiza tarefa do projeto anterior após a troca', async () => {
    listTasks.mockResolvedValueOnce([makeTask('t1', 'Layout')]).mockResolvedValueOnce([])
    const { rerender } = render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    fireEvent.click(await screen.findByText('Editar tarefa'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    rerender(<ProjectTaskList projectId="p2" onChanged={vi.fn()} />)
    await screen.findByText('Nenhuma tarefa cadastrada.')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(updateTask).not.toHaveBeenCalled()
  })

  it('fecha a confirmação de exclusão do projeto anterior após a troca', async () => {
    listTasks.mockResolvedValueOnce([makeTask('t1', 'Layout')]).mockResolvedValueOnce([])
    const { rerender } = render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir tarefa Layout' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    rerender(<ProjectTaskList projectId="p2" onChanged={vi.fn()} />)
    await screen.findByText('Nenhuma tarefa cadastrada.')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(deleteTask).not.toHaveBeenCalled()
  })

  it('identifica o controle de edição pela tarefa', async () => {
    listTasks.mockResolvedValue([makeTask('t1', 'Layout')])
    render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    expect(await screen.findByRole('button', { name: 'Editar tarefa Layout' })).toBeTruthy()
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}
