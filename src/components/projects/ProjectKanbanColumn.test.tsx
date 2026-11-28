// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PROJECT_MOVE_STATUSES, type ProjectListItem, type ProjectMoveStatus } from '../../types/project'
import { ProjectKanbanColumn } from './ProjectKanbanColumn'

const project: ProjectListItem = {
  id: 'p1', owner_id: 'owner-1', client_id: 'client-1', contract_id: 'contract-1', source_link_id: null,
  name: 'Site da Empresa', client_name: 'Empresa A', service: 'Site', contracted_value_cents: 100000,
  description: null, start_date: null, due_date: null, responsible_name: null, priority: 'high',
  status: 'planning', completed_at: null, delivered_at: null, delivery_confirmed_at: null,
  delivery_url: null, files_url: null, final_notes: null, archived_at: null,
  created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
  progressPercent: null, activeTasks: 0, completedTasks: 0,
}

function Column({ status = 'planning', projects = [project], pendingIds = new Set<string>(), onMove = vi.fn() }: {
  status?: ProjectListItem['status']
  projects?: ProjectListItem[]
  pendingIds?: ReadonlySet<string>
  onMove?: (id: string, status: ProjectMoveStatus) => Promise<void>
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  return (
    <DndContext sensors={sensors}>
      <ProjectKanbanColumn status={status} projects={projects} pendingIds={pendingIds} onMove={onMove} />
    </DndContext>
  )
}

afterEach(cleanup)

describe('ProjectKanbanColumn', () => {
  it('oferece apenas destinos móveis e chama a fila da página', async () => {
    const onMove = vi.fn().mockResolvedValue(undefined)
    render(<Column onMove={onMove} />)
    const select = screen.getByLabelText('Status do projeto Site da Empresa') as HTMLSelectElement
    expect(Array.from(select.options, (option) => option.value)).toEqual([...PROJECT_MOVE_STATUSES])
    fireEvent.change(select, { target: { value: 'in_review' } })
    await waitFor(() => expect(onMove).toHaveBeenCalledWith('p1', 'in_review'))
    expect(screen.getByRole('button', { name: 'Arrastar Site da Empresa' })).toBeTruthy()
  })

  it('desabilita handle e seletor enquanto o projeto está pendente', () => {
    render(<Column pendingIds={new Set(['p1'])} />)
    expect((screen.getByRole('button', { name: 'Arrastar Site da Empresa' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('Status do projeto Site da Empresa') as HTMLSelectElement).disabled).toBe(true)
  })

  it('mantém delivered visível e read-only sem hook de arraste nem seletor', () => {
    render(<Column status="delivered" projects={[{ ...project, status: 'delivered' }]} />)
    expect(screen.getByRole('group', { name: 'Entregue' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Arrastar Site da Empresa' })).toBeNull()
    expect(screen.queryByLabelText('Status do projeto Site da Empresa')).toBeNull()
  })
})
