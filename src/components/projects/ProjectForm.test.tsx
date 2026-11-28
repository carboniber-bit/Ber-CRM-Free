// @vitest-environment jsdom
// src/components/projects/ProjectForm.test.tsx
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
      clients: [{ id: 'client-1', name: 'Empresa A' }, { id: 'client-2', name: 'Empresa B' }],
      contracts: [{
        id: 'contract-1', client_id: 'client-1', service: 'Site', total_value_cents: 100000,
        allocated_cents: 0, remaining_cents: 100000, due_date: null,
      }, {
        id: 'contract-2', client_id: 'client-2', service: 'Landing page', total_value_cents: 200000,
        allocated_cents: 0, remaining_cents: 200000, due_date: null,
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
    const client = await screen.findByLabelText('Cliente *')
    const contract = screen.getByLabelText('Contrato *') as HTMLSelectElement

    fireEvent.change(client, { target: { value: 'client-1' } })
    expect(Array.from(contract.options, (option) => option.value)).toEqual(['', 'contract-1'])
    fireEvent.change(client, { target: { value: 'client-2' } })
    expect(Array.from(contract.options, (option) => option.value)).toEqual(['', 'contract-2'])
    fireEvent.change(client, { target: { value: 'client-1' } })
    expect(Array.from(contract.options, (option) => option.value)).toEqual(['', 'contract-1'])

    fireEvent.change(contract, { target: { value: 'contract-1' } })
    fireEvent.change(screen.getByLabelText('Nome do projeto *'), { target: { value: 'Site da Empresa' } })
    fireEvent.change(screen.getByLabelText('Serviço *'), { target: { value: 'Site' } })
    fireEvent.change(screen.getByLabelText('Valor alocado (R$) *'), { target: { value: '1.000,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar projeto' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(savedProject))
    expect(createProject).toHaveBeenCalledWith(expect.objectContaining({
      clientId: 'client-1', contractId: 'contract-1', contractedValueCents: 100000,
    }))
  })

  it('rejeita alocação acima do saldo disponível do contrato', async () => {
    render(<ProjectForm onCancel={vi.fn()} onSaved={vi.fn()} />)
    fireEvent.change(await screen.findByLabelText('Cliente *'), { target: { value: 'client-1' } })
    fireEvent.change(screen.getByLabelText('Contrato *'), { target: { value: 'contract-1' } })
    fireEvent.change(screen.getByLabelText('Nome do projeto *'), { target: { value: 'Site da Empresa' } })
    fireEvent.change(screen.getByLabelText('Serviço *'), { target: { value: 'Site' } })
    fireEvent.change(screen.getByLabelText('Valor alocado (R$) *'), { target: { value: '1.000,01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar projeto' }))

    expect((await screen.findByText(/O valor excede o limite disponível/)).textContent)
      .toContain('O valor excede o limite disponível')
    expect(createProject).not.toHaveBeenCalled()
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
    listProjectFormOptions.mockResolvedValue({
      clients: [{ id: 'client-1', name: 'Empresa A' }, { id: 'client-2', name: 'Empresa B' }],
      contracts: [{
        id: 'contract-1', client_id: 'client-1', service: 'Site', total_value_cents: 100000,
        allocated_cents: 0, remaining_cents: 100000, due_date: null,
      }, {
        id: 'contract-1b', client_id: 'client-1', service: 'Landing page', total_value_cents: 200000,
        allocated_cents: 0, remaining_cents: 200000, due_date: null,
      }, {
        id: 'contract-2', client_id: 'client-2', service: 'Consultoria', total_value_cents: 300000,
        allocated_cents: 0, remaining_cents: 300000, due_date: null,
      }],
    })
    render(<ProjectForm project={current} onCancel={vi.fn()} onSaved={vi.fn()} />)
    const contract = await screen.findByLabelText('Contrato *') as HTMLSelectElement
    expect(contract.options).toHaveLength(1)
    expect(contract.value).toBe('contract-1')
    expect(contract.options[0].textContent).toContain('Site')
  })

  it('edita projeto usando o saldo disponível mais o valor já contratado como limite', async () => {
    const current: ProjectListItem = {
      ...savedProject, contracted_value_cents: 100000, client_name: 'Empresa A',
      progressPercent: null, activeTasks: 0, completedTasks: 0,
    }
    const updatedProject: Project = { ...savedProject, contracted_value_cents: 150000 }
    const onSaved = vi.fn()
    listProjectFormOptions.mockResolvedValue({
      clients: [{ id: 'client-1', name: 'Empresa A' }],
      contracts: [{
        id: 'contract-1', client_id: 'client-1', service: 'Site', total_value_cents: 200000,
        allocated_cents: 150000, remaining_cents: 50000, due_date: null,
      }],
    })
    updateProject.mockResolvedValue(updatedProject)
    render(<ProjectForm project={current} onCancel={vi.fn()} onSaved={onSaved} />)
    await screen.findByLabelText('Contrato *')
    fireEvent.change(screen.getByLabelText('Valor alocado (R$) *'), { target: { value: '1.500,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updatedProject))
    expect(updateProject).toHaveBeenCalledTimes(1)
    expect(updateProject).toHaveBeenCalledWith('project-1', expect.objectContaining({
      contractedValueCents: 150000,
    }))
  })

  it('comunica edição confirmada após desmontar o formulário', async () => {
    const current: ProjectListItem = {
      ...savedProject, client_name: 'Empresa A', progressPercent: null, activeTasks: 0, completedTasks: 0,
    }
    const updated: Project = { ...savedProject, name: 'Site atualizado' }
    const pending = deferred<Project>()
    updateProject.mockReturnValueOnce(pending.promise)
    const onSaved = vi.fn()
    const { unmount } = render(<ProjectForm project={current} onCancel={vi.fn()} onSaved={onSaved} />)
    await screen.findByLabelText('Contrato *')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1))
    unmount()

    await act(async () => {
      pending.resolve(updated)
      await pending.promise
    })

    expect(onSaved).toHaveBeenCalledWith(updated)
  })

  it('descarta edição confirmada de projeto anterior', async () => {
    const current: ProjectListItem = {
      ...savedProject, client_name: 'Empresa A', progressPercent: null, activeTasks: 0, completedTasks: 0,
    }
    const pending = deferred<Project>()
    updateProject.mockReturnValueOnce(pending.promise)
    const onSaved = vi.fn()
    const { rerender } = render(<ProjectForm project={current} onCancel={vi.fn()} onSaved={onSaved} />)
    await screen.findByLabelText('Contrato *')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1))
    rerender(<ProjectForm project={{ ...current, id: 'project-2' }} onCancel={vi.fn()} onSaved={onSaved} />)

    await act(async () => {
      pending.resolve(savedProject)
      await pending.promise
    })

    expect(onSaved).not.toHaveBeenCalled()
  })

  it('não comunica criação confirmada após o usuário sair da página', async () => {
    const pending = deferred<Project>()
    createProject.mockReturnValueOnce(pending.promise)
    const onSaved = vi.fn()
    const { unmount } = render(<ProjectForm onCancel={vi.fn()} onSaved={onSaved} />)
    fireEvent.change(await screen.findByLabelText('Cliente *'), { target: { value: 'client-1' } })
    fireEvent.change(screen.getByLabelText('Contrato *'), { target: { value: 'contract-1' } })
    fireEvent.change(screen.getByLabelText('Nome do projeto *'), { target: { value: 'Site da Empresa' } })
    fireEvent.change(screen.getByLabelText('Serviço *'), { target: { value: 'Site' } })
    fireEvent.change(screen.getByLabelText('Valor alocado (R$) *'), { target: { value: '1.000,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar projeto' }))
    await waitFor(() => expect(createProject).toHaveBeenCalledTimes(1))
    unmount()

    await act(async () => {
      pending.resolve(savedProject)
      await pending.promise
    })

    expect(onSaved).not.toHaveBeenCalled()
  })

  it('não repete a criação nem oferece retry quando onSaved falha após persistir', async () => {
    const onSaved = vi.fn(() => { throw new Error('Falha na navegação') })
    render(<ProjectForm onCancel={vi.fn()} onSaved={onSaved} />)
    fireEvent.change(await screen.findByLabelText('Cliente *'), { target: { value: 'client-1' } })
    fireEvent.change(screen.getByLabelText('Contrato *'), { target: { value: 'contract-1' } })
    fireEvent.change(screen.getByLabelText('Nome do projeto *'), { target: { value: 'Site da Empresa' } })
    fireEvent.change(screen.getByLabelText('Serviço *'), { target: { value: 'Site' } })
    fireEvent.change(screen.getByLabelText('Valor alocado (R$) *'), { target: { value: '1.000,00' } })
    const submitButton = screen.getByRole('button', { name: 'Criar projeto' })
    fireEvent.click(submitButton)

    await waitFor(() => expect(toast).toHaveBeenCalled())
    expect(createProject).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).toBeNull()
    expect((submitButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.submit(submitButton.closest('form') as HTMLFormElement)
    expect(createProject).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith(
      'Projeto salvo, mas não foi possível concluir a próxima ação.', 'error',
    )
  })

  it('mantém mensagem, toast e retry quando a persistência falha', async () => {
    const onSaved = vi.fn()
    createProject.mockRejectedValueOnce(new Error('Falha ao persistir')).mockResolvedValueOnce(savedProject)
    render(<ProjectForm onCancel={vi.fn()} onSaved={onSaved} />)
    fireEvent.change(await screen.findByLabelText('Cliente *'), { target: { value: 'client-1' } })
    fireEvent.change(screen.getByLabelText('Contrato *'), { target: { value: 'contract-1' } })
    fireEvent.change(screen.getByLabelText('Nome do projeto *'), { target: { value: 'Site da Empresa' } })
    fireEvent.change(screen.getByLabelText('Serviço *'), { target: { value: 'Site' } })
    fireEvent.change(screen.getByLabelText('Valor alocado (R$) *'), { target: { value: '1.000,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar projeto' }))

    expect((await screen.findByText('Falha ao persistir')).textContent).toBe('Falha ao persistir')
    expect(toast).toHaveBeenCalledWith('Falha ao persistir', 'error')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(savedProject))
    expect(createProject).toHaveBeenCalledTimes(2)
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

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}
