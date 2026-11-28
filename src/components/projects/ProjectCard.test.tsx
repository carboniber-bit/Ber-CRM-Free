// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import type { ProjectListItem } from '../../types/project'
import { ProjectCard } from './ProjectCard'

const project: ProjectListItem = {
  id: 'p1', owner_id: 'owner-1', client_id: 'client-1', contract_id: 'contract-1', source_link_id: null,
  name: 'Site da Empresa', client_name: 'Empresa A', service: 'Site', contracted_value_cents: 123456,
  description: null, start_date: '2026-11-25', due_date: '2026-12-10', responsible_name: 'Ana',
  priority: 'high', status: 'in_development', completed_at: null, delivered_at: null,
  delivery_confirmed_at: null, delivery_url: null, files_url: null, final_notes: null, archived_at: null,
  created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
  progressPercent: 50, activeTasks: 2, completedTasks: 1,
}

afterEach(cleanup)

describe('ProjectCard', () => {
  it('mostra vínculo, prazo, valor e progresso derivado', () => {
    render(<MemoryRouter><ProjectCard project={project} /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Site da Empresa' }).getAttribute('href')).toBe('/projetos/p1')
    expect(screen.getByText('Empresa A · Site').textContent).toBe('Empresa A · Site')
    expect(screen.getByText('10 de dez. de 2026').textContent).toBe('10 de dez. de 2026')
    expect(screen.getByText('R$ 1.234,56').textContent?.replace(/\u00a0/g, ' ')).toBe('R$ 1.234,56')
    const progress = screen.getByRole('progressbar', { name: 'Progresso de Site da Empresa' })
    expect(progress.getAttribute('aria-valuenow')).toBe('50')
    expect(screen.getByText('50%').textContent).toBe('50%')
    expect(screen.getByText('1 de 2 tarefas concluídas').textContent).toBe('1 de 2 tarefas concluídas')
  })

  it('não inventa progresso sem tarefas ativas e sinaliza mutação pendente', () => {
    render(<MemoryRouter><ProjectCard project={{ ...project, progressPercent: null, activeTasks: 0 }} pending /></MemoryRouter>)
    expect(screen.getByText('Sem tarefas ativas').textContent).toBe('Sem tarefas ativas')
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Salvando movimentação…')
  })
})
