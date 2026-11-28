// @vitest-environment jsdom
// src/components/projects/ProjectRevisionList.test.tsx
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectRevision } from '../../types/project'

const { listRevisions, createRevision, updateRevision } = vi.hoisted(() => ({
  listRevisions: vi.fn(), createRevision: vi.fn(), updateRevision: vi.fn(),
}))
const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('../../services/projectRevisionService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/projectRevisionService')>()
  return { ...actual, listRevisions, createRevision, updateRevision }
})
vi.mock('../../hooks/useToast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useToast')>()
  return { ...actual, useToast: () => ({ toast }) }
})

import { ProjectRevisionList } from './ProjectRevisionList'

function makeRevision(status: ProjectRevision['status'] = 'completed'): ProjectRevision {
  return {
    id: 'r1', owner_id: 'owner-1', project_id: 'p1', requested_at: '2026-11-25T12:00:00Z',
    description: 'Ajustar cores', responsible_name: null, status,
    completed_at: status === 'completed' || status === 'approved' ? '2026-11-25T12:30:00Z' : null,
    approved_at: status === 'approved' ? '2026-11-25T13:00:00Z' : null,
    notes: null, created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
  }
}

afterEach(cleanup)

describe('ProjectRevisionList', () => {
  beforeEach(() => {
    listRevisions.mockReset().mockResolvedValue([])
    createRevision.mockReset()
    updateRevision.mockReset()
    toast.mockReset()
  })

  it('mostra vazio e permite registrar revisão', async () => {
    createRevision.mockResolvedValue(makeRevision('requested'))
    render(<ProjectRevisionList projectId="p1" onChanged={vi.fn()} />)
    await screen.findByText('Nenhuma revisão registrada.')
    fireEvent.click(screen.getByRole('button', { name: 'Nova revisão' }))
    fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Ajustar cores' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar revisão' }))
    await waitFor(() => expect(createRevision).toHaveBeenCalledWith('p1', expect.objectContaining({ description: 'Ajustar cores' })))
  })

  it('aprovação exige confirmação e não oferece delete', async () => {
    listRevisions.mockResolvedValue([makeRevision('completed')])
    updateRevision.mockResolvedValue({ ...makeRevision('completed'), status: 'approved', approved_at: '2026-11-25T13:00:00Z' })
    render(<ProjectRevisionList projectId="p1" onChanged={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar revisão' }))
    expect(updateRevision).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog').textContent).toMatch(/Confirmar aprovação/)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar aprovação' }))
    await waitFor(() => expect(updateRevision).toHaveBeenCalledWith('r1', expect.objectContaining({ status: 'approved' })))
    expect(screen.queryByRole('button', { name: /Excluir revisão/ })).toBeNull()
    expect(updateRevision.mock.calls[0][1]).not.toHaveProperty('approved_at')
    expect(updateRevision.mock.calls[0][1]).not.toHaveProperty('completed_at')
  })

  it('preserva a aprovação local quando o refresh em background falha', async () => {
    const completed = makeRevision('completed')
    const approved = {
      ...completed, status: 'approved' as const,
      approved_at: '2026-11-25T13:00:00Z', updated_at: '2026-11-25T13:00:00Z',
    }
    listRevisions
      .mockResolvedValueOnce([completed])
      .mockRejectedValueOnce(new Error('Falha ao atualizar revisões.'))
    updateRevision.mockResolvedValue(approved)
    render(<ProjectRevisionList projectId="p1" onChanged={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar revisão' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar aprovação' }))

    expect((await screen.findByText('Falha ao atualizar revisões.')).textContent).toBe('Falha ao atualizar revisões.')
    expect(screen.getByText('Aprovada')).toBeTruthy()
    expect(screen.getByText(/Aprovada em/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Editar revisão' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Aprovar revisão' })).toBeNull()
    expect(screen.queryByLabelText('Status da revisão')).toBeNull()
    expect(updateRevision).toHaveBeenCalledTimes(1)
  })

  it.each(['create', 'edit', 'status'] as const)('preserva o resultado local de %s quando o refresh falha', async (operation) => {
    const initial = makeRevision(operation === 'create' ? 'requested' : 'completed')
    const returned = {
      ...initial,
      id: operation === 'create' ? 'r-new' : initial.id,
      description: 'Revisão persistida',
      status: operation === 'status' ? 'in_progress' as const : initial.status,
      notes: 'Nota persistida',
    }
    listRevisions
      .mockResolvedValueOnce(operation === 'create' ? [] : [initial])
      .mockRejectedValueOnce(new Error('Falha ao atualizar revisões.'))
    const mutation = operation === 'create' ? createRevision : updateRevision
    mutation.mockResolvedValue(returned)
    render(<ProjectRevisionList projectId="p1" onChanged={vi.fn()} />)

    if (operation === 'create') {
      await screen.findByText('Nenhuma revisão registrada.')
      fireEvent.click(screen.getByRole('button', { name: 'Nova revisão' }))
      fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Descrição enviada' } })
      fireEvent.click(screen.getByRole('button', { name: 'Registrar revisão' }))
    } else {
      await screen.findByText('Ajustar cores')
      if (operation === 'edit') {
        fireEvent.click(screen.getByRole('button', { name: 'Editar revisão' }))
        fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Descrição editada' } })
        fireEvent.click(screen.getByRole('button', { name: 'Salvar revisão' }))
      } else {
        fireEvent.change(screen.getByLabelText('Status da revisão'), { target: { value: 'in_progress' } })
      }
    }

    expect((await screen.findByText('Falha ao atualizar revisões.')).textContent).toBe('Falha ao atualizar revisões.')
    expect(screen.getByText('Revisão persistida')).toBeTruthy()
    expect(screen.getByText('Nota persistida')).toBeTruthy()
    expect((screen.getByLabelText('Status da revisão') as HTMLSelectElement).value).toBe(returned.status)
    expect(mutation).toHaveBeenCalledTimes(1)
  })

  it('revisão aprovada permanece read-only e edição não oferece approved', async () => {
    listRevisions.mockResolvedValue([makeRevision('approved')])
    render(<ProjectRevisionList projectId="p1" onChanged={vi.fn()} />)
    await screen.findByText('Aprovada')
    expect(screen.queryByRole('button', { name: 'Editar revisão' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Aprovar revisão' })).toBeNull()
    listRevisions.mockResolvedValue([makeRevision('requested')])
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar revisões' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Editar revisão' }))
    const select = screen.getByLabelText('Status da revisão em edição') as HTMLSelectElement
    expect(Array.from(select.options, (option) => option.value)).not.toContain('approved')
  })

  it('preserva histórico em erro e descarta resposta obsoleta', async () => {
    const old = deferred<ProjectRevision[]>()
    listRevisions.mockReturnValueOnce(old.promise).mockResolvedValueOnce([makeRevision()])
    const { rerender } = render(<ProjectRevisionList projectId="p1" onChanged={vi.fn()} />)
    rerender(<ProjectRevisionList projectId="p2" onChanged={vi.fn()} />)
    await screen.findByText('Ajustar cores')
    listRevisions.mockRejectedValueOnce(new Error('Falha ao atualizar revisões.'))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar revisões' }))
    expect((await screen.findByText('Falha ao atualizar revisões.')).textContent).toBe('Falha ao atualizar revisões.')
    expect(screen.getByText('Ajustar cores')).toBeTruthy()
    await act(async () => { old.resolve([{ ...makeRevision(), id: 'old', description: 'Revisão antiga' }]); await old.promise })
    expect(screen.queryByText('Revisão antiga')).toBeNull()
  })

  it('projeto cancelado mantém revisões e bloqueia criação e aprovação', async () => {
    listRevisions.mockResolvedValue([makeRevision('completed')])
    render(<ProjectRevisionList projectId="p1" onChanged={vi.fn()} disabled />)
    await screen.findByText('Ajustar cores')
    expect((screen.getByRole('button', { name: 'Nova revisão' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Aprovar revisão' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('não preserva revisões do projeto anterior quando a carga do novo projeto falha', async () => {
    listRevisions
      .mockResolvedValueOnce([makeRevision()])
      .mockRejectedValueOnce(new Error('Falha ao carregar revisões do novo projeto.'))
    const { rerender } = render(<ProjectRevisionList projectId="p1" onChanged={vi.fn()} />)
    await screen.findByText('Ajustar cores')
    rerender(<ProjectRevisionList projectId="p2" onChanged={vi.fn()} />)
    expect(await screen.findByText('Falha ao carregar revisões do novo projeto.')).toBeTruthy()
    expect(screen.queryByText('Ajustar cores')).toBeNull()
  })

  it('fecha o editor de revisão do projeto anterior após a troca', async () => {
    listRevisions.mockResolvedValueOnce([makeRevision()]).mockResolvedValueOnce([])
    const { rerender } = render(<ProjectRevisionList projectId="p1" onChanged={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Editar revisão' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    rerender(<ProjectRevisionList projectId="p2" onChanged={vi.fn()} />)
    await screen.findByText('Nenhuma revisão registrada.')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(updateRevision).not.toHaveBeenCalled()
  })

  it('fecha a aprovação de revisão do projeto anterior após a troca', async () => {
    listRevisions.mockResolvedValueOnce([makeRevision('completed')]).mockResolvedValueOnce([])
    const { rerender } = render(<ProjectRevisionList projectId="p1" onChanged={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar revisão' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    rerender(<ProjectRevisionList projectId="p2" onChanged={vi.fn()} />)
    await screen.findByText('Nenhuma revisão registrada.')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(updateRevision).not.toHaveBeenCalled()
  })

  it.each([
    { operation: 'create', outcome: 'resolve' },
    { operation: 'create', outcome: 'reject' },
    { operation: 'update', outcome: 'resolve' },
    { operation: 'update', outcome: 'reject' },
  ] as const)('descarta $operation de p1 $outcome após trocar para p2', async ({ operation, outcome }) => {
    const p1 = makeRevision('completed')
    const p2 = { ...makeRevision('completed'), id: 'r2', project_id: 'p2', description: 'Revisão do projeto p2' }
    listRevisions.mockResolvedValueOnce([p1]).mockResolvedValueOnce([p2])
    const pending = deferred<ProjectRevision>()
    const mutation = operation === 'create' ? createRevision : updateRevision
    mutation.mockReturnValueOnce(pending.promise)
    const onChanged = vi.fn()
    const { rerender } = render(<ProjectRevisionList projectId="p1" onChanged={onChanged} />)
    await screen.findByText('Ajustar cores')

    if (operation === 'create') {
      fireEvent.click(screen.getByRole('button', { name: 'Nova revisão' }))
      fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Nova revisão antiga' } })
      fireEvent.click(screen.getByRole('button', { name: 'Registrar revisão' }))
    } else {
      fireEvent.click(screen.getByRole('button', { name: 'Editar revisão' }))
      fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Edição antiga' } })
      fireEvent.click(screen.getByRole('button', { name: 'Salvar revisão' }))
    }
    await waitFor(() => expect(mutation).toHaveBeenCalledTimes(1))

    rerender(<ProjectRevisionList projectId="p2" onChanged={onChanged} />)
    await screen.findByText('Revisão do projeto p2')
    const reloadCalls = listRevisions.mock.calls.length
    await act(async () => {
      if (outcome === 'resolve') {
        pending.resolve({ ...p1, id: operation === 'create' ? 'r-old' : p1.id, description: 'Revisão antiga' })
        await pending.promise
      } else {
        pending.reject(new Error('Falha na mutação anterior.'))
        await pending.promise.catch(() => undefined)
      }
    })

    expect(toast).not.toHaveBeenCalled()
    expect(onChanged).not.toHaveBeenCalled()
    expect(listRevisions).toHaveBeenCalledTimes(reloadCalls)
    expect(screen.queryByText('Revisão antiga')).toBeNull()
    expect(screen.getByText('Revisão do projeto p2')).toBeTruthy()
  })

  it.each(['create', 'update'] as const)('descarta resposta de %s após desmontagem', async (operation) => {
    listRevisions.mockResolvedValueOnce(operation === 'create' ? [] : [makeRevision('completed')])
    const pending = deferred<ProjectRevision>()
    const mutation = operation === 'create' ? createRevision : updateRevision
    mutation.mockReturnValueOnce(pending.promise)
    const onChanged = vi.fn()
    const { unmount } = render(<ProjectRevisionList projectId="p1" onChanged={onChanged} />)

    if (operation === 'create') {
      await screen.findByText('Nenhuma revisão registrada.')
      fireEvent.click(screen.getByRole('button', { name: 'Nova revisão' }))
      fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Revisão pendente' } })
      fireEvent.click(screen.getByRole('button', { name: 'Registrar revisão' }))
    } else {
      await screen.findByText('Ajustar cores')
      fireEvent.click(screen.getByRole('button', { name: 'Editar revisão' }))
      fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Revisão pendente' } })
      fireEvent.click(screen.getByRole('button', { name: 'Salvar revisão' }))
    }
    await waitFor(() => expect(mutation).toHaveBeenCalledTimes(1))
    const reloadCalls = listRevisions.mock.calls.length
    unmount()

    await act(async () => {
      if (operation === 'create') {
        pending.resolve({ ...makeRevision('requested'), id: 'r-new', description: 'Revisão pendente' })
        await pending.promise
      } else {
        pending.reject(new Error('Falha após desmontagem.'))
        await pending.promise.catch(() => undefined)
      }
    })

    expect(toast).not.toHaveBeenCalled()
    expect(onChanged).not.toHaveBeenCalled()
    expect(listRevisions).toHaveBeenCalledTimes(reloadCalls)
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
