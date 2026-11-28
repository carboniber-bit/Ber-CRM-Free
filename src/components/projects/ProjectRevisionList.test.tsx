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
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}
