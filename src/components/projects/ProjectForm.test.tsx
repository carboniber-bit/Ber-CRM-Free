// @vitest-environment jsdom
// src/components/projects/ProjectForm.test.tsx
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project, ProjectListItem } from '../../types/project'

const { listProjectFormOptions, createProject, updateProject } = vi.hoisted(() => ({
  listProjectFormOptions: vi.fn(), createProject: vi.fn(), updateProject: vi.fn(),
}))
const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('../../services/projectService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/projectService')>()
  return { ...actual, listProjectFormOptions, createProject, updateProject }
})
vi.mock('../../hooks/useToast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useToast')>()
  return { ...actual, useToast: () => ({ toast }) }
})

import { ProjectForm } from './ProjectForm'

const savedProject: Project = {
  id: 'project-1', owner_id: 'owner-1', client_id: 'client-1', contract_id: 'contract-1',
  source_link_id: null, name: 'Site da Empresa', service: 'Site', contracted_value_cents: 100000,
  description: null, start_date: '2026-11-25', due_date: '2026-12-10', responsible_name: null,
  priority: 'high', status: 'not_started', completed_at: null, delivered_at: null,
  delivery_confirmed_at: null, delivery_url: null, files_url: null, final_notes: null,
  archived_at: null, created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
}

afterEach(cleanup)

describe('ProjectForm', () => {
  beforeEach(() => {
    listProjectFormOptions.mockReset().mockResolvedValue({
      clients: [{ id: 'client-1', name: 'Empresa A' }],
      contracts: [{
        id: 'contract-1', client_id: 'client-1', service: 'Site', total_value_cents: 100000,
        allocated_cents: 0, remaining_cents: 100000, due_date: null,
      }],
    })
    createProject.mockReset().mockResolvedValue(savedProject)
    updateProject.mockReset().mockResolvedValue(savedProject)
    toast.mockReset()
  })

  it('exige cliente, contrato e nome', async () => {
    render(<ProjectForm onCancel={vi.fn()} onSaved={vi.fn()} />)
    await screen.findByLabelText('Cliente *')
    fireEvent.click(screen.getByRole('button', { name: 'Criar projeto' }))
    expect((await screen.findByText('Selecione o cliente.')).textContent).toBe('Selecione o cliente.')
    expect(screen.getByText('Selecione o contrato.').textContent).toBe('Selecione o contrato.')
    expect(screen.getByText('Nome do projeto é obrigatório.').textContent).toBe('Nome do projeto é obrigatório.')
    expect(createProject).not.toHaveBeenCalled()
  })

  it('filtra contratos pelo cliente e envia centavos', async () => {
    const onSaved = vi.fn()
    render(<ProjectForm onCancel={vi.fn()} onSaved={onSaved} />)
    fireEvent.change(await screen.findByLabelText('Cliente *'), { target: { value: 'client-1' } })
    fireEvent.change(screen.getByLabelText('Contrato *'), { target: { value: 'contract-1' } })
    fireEvent.change(screen.getByLabelText('Nome do projeto *'), { target: { value: 'Site da Empresa' } })
    fireEvent.change(screen.getByLabelText('Serviço *'), { target: { value: 'Site' } })
    fireEvent.change(screen.getByLabelText('Valor alocado (R$) *'), { target: { value: '1.000,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar projeto' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(savedProject))
    expect(createProject).toHaveBeenCalledWith(expect.objectContaining({
      clientId: 'client-1', contractId: 'contract-1', contractedValueCents: 100000,
    }))
  })

  it('sugere prazo editável e rejeita prazo anterior ao início', async () => {
    render(<ProjectForm onCancel={vi.fn()} onSaved={vi.fn()} />)
    fireEvent.change(await screen.findByLabelText('Serviço *'), { target: { value: 'Site' } })
    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2026-11-25' } })
    fireEvent.change(screen.getByLabelText('Serviço *'), { target: { value: 'Site' } })
    expect((screen.getByLabelText('Prazo') as HTMLInputElement).value).toBe('2026-12-10')
    fireEvent.change(screen.getByLabelText('Prazo'), { target: { value: '2026-11-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar projeto' }))
    expect((await screen.findByText('O prazo não pode anteceder o início.')).textContent)
      .toBe('O prazo não pode anteceder o início.')
  })

  it('omite o placeholder do contrato em edição e mantém somente a opção atual', async () => {
    const current: ProjectListItem = {
      ...savedProject, client_name: 'Empresa A', progressPercent: null, activeTasks: 0, completedTasks: 0,
    }
    render(<ProjectForm project={current} onCancel={vi.fn()} onSaved={vi.fn()} />)
    const contract = await screen.findByLabelText('Contrato *') as HTMLSelectElement
    expect(contract.value).toBe('contract-1')
    expect(contract.options).toHaveLength(1)
    expect(contract.options[0].textContent).toContain('Site')
  })

  it('bloqueia edição quando o contrato atual está cancelado ou fora das opções', async () => {
    const current: ProjectListItem = {
      ...savedProject, client_name: 'Empresa A', progressPercent: null, activeTasks: 0, completedTasks: 0,
    }
    listProjectFormOptions.mockResolvedValue({ clients: [], contracts: [] })
    render(<ProjectForm project={current} onCancel={vi.fn()} onSaved={vi.fn()} />)
    expect((await screen.findByText(
      'O contrato atual está cancelado ou indisponível. A edição do projeto está bloqueada.',
    )).textContent).toBe('O contrato atual está cancelado ou indisponível. A edição do projeto está bloqueada.')
    expect(screen.queryByLabelText('Contrato *')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Salvar alterações' })).toBeNull()
    expect(updateProject).not.toHaveBeenCalled()
  })

  it('bloqueia edição de projeto cancelado com mensagem clara', async () => {
    const current: ProjectListItem = {
      ...savedProject, client_name: 'Empresa A', status: 'cancelled', archived_at: '2026-11-25T12:00:00Z',
      progressPercent: null, activeTasks: 0, completedTasks: 0,
    }
    render(<ProjectForm project={current} onCancel={vi.fn()} onSaved={vi.fn()} />)
    expect((await screen.findByText(
      'Projeto cancelado não pode ser editado. Reative o projeto antes de alterar seus dados.',
    )).textContent).toBe('Projeto cancelado não pode ser editado. Reative o projeto antes de alterar seus dados.')
    expect(screen.queryByRole('button', { name: 'Salvar alterações' })).toBeNull()
    expect(updateProject).not.toHaveBeenCalled()
  })
})
