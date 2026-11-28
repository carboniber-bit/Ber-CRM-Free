// @vitest-environment jsdom
// src/pages/ProjectDetailPage.test.tsx
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectDetail } from '../types/project'

const { getProject, updateProject, setProjectStatus, deliverProject, listProjectFormOptions } = vi.hoisted(() => ({
  getProject: vi.fn(), updateProject: vi.fn(), setProjectStatus: vi.fn(), deliverProject: vi.fn(), listProjectFormOptions: vi.fn(),
}))
const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
const { listTasks } = vi.hoisted(() => ({ listTasks: vi.fn() }))
const { listRevisions } = vi.hoisted(() => ({ listRevisions: vi.fn() }))
vi.mock('../services/projectService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/projectService')>()
  return { ...actual, getProject, updateProject, setProjectStatus, deliverProject, listProjectFormOptions }
})
vi.mock('../hooks/useToast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useToast')>()
  return { ...actual, useToast: () => ({ toast }) }
})
vi.mock('../services/projectTaskService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/projectTaskService')>()
  return { ...actual, listTasks }
})
vi.mock('../services/projectRevisionService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/projectRevisionService')>()
  return { ...actual, listRevisions }
})

import { ProjectDetailPage } from './ProjectDetailPage'

const project: ProjectDetail = {
  id: 'p1', owner_id: 'owner-1', client_id: 'client-1', contract_id: 'contract-1', source_link_id: null,
  name: 'Site da Empresa', client_name: 'Empresa A', service: 'Site', contracted_value_cents: 123456,
  description: null, start_date: '2026-11-25', due_date: '2026-12-10', responsible_name: null,
  priority: 'high', status: 'in_development', completed_at: null, delivered_at: null,
  delivery_confirmed_at: null, delivery_url: null, files_url: null, final_notes: null, archived_at: null,
  created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
  progressPercent: 50, activeTasks: 2, completedTasks: 1, tasks: [], revisions: [], activities: [],
}

function renderPage() {
  return render(<MemoryRouter initialEntries={['/projetos/p1']}><Routes><Route path="/projetos/:id" element={<ProjectDetailPage />} /></Routes></MemoryRouter>)
}

function renderNavigablePage() {
  return render(
    <MemoryRouter initialEntries={['/projetos/p1']}>
      <Routes>
        <Route path="/projetos/:id" element={<><ProjectDetailPage /><RouteNavigator /></>} />
      </Routes>
    </MemoryRouter>,
  )
}

function RouteNavigator() {
  const navigate = useNavigate()
  return <button type="button" onClick={() => navigate('/projetos/p2')}>Abrir p2</button>
}

afterEach(cleanup)

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    getProject.mockReset().mockResolvedValue(project)
    updateProject.mockReset()
    setProjectStatus.mockReset()
    deliverProject.mockReset()
    listProjectFormOptions.mockReset().mockResolvedValue({
      clients: [{ id: 'client-1', name: 'Empresa A' }],
      contracts: [{
        id: 'contract-1', client_id: 'client-1', service: 'Site', total_value_cents: 123456,
        allocated_cents: 123456, remaining_cents: 0, due_date: '2026-12-10',
      }],
    })
    toast.mockReset()
    listTasks.mockReset().mockResolvedValue([])
    listRevisions.mockReset().mockResolvedValue([])
  })

  it('mostra dados, progresso e valor alocado sem receita', async () => {
    renderPage()
    expect((await screen.findByRole('heading', { name: 'Site da Empresa' })).textContent).toBe('Site da Empresa')
    expect(screen.getByText('50%').textContent).toBe('50%')
    expect(screen.getByText('1 de 2 tarefas concluídas').textContent).toBe('1 de 2 tarefas concluídas')
    expect(screen.getByText('R$ 1.234,56').textContent?.replace(/\u00a0/g, ' ')).toBe('R$ 1.234,56')
    expect(screen.queryByText(/recebido/i)).toBeNull()
  })

  it('renderiza tarefas e revisões nas abas com serviços filhos mockados e uma única ação por estado vazio', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('tab', { name: 'Tarefas' }))
    expect((await screen.findByText('Nenhuma tarefa cadastrada.')).textContent).toBe('Nenhuma tarefa cadastrada.')
    expect(screen.getAllByRole('button', { name: 'Nova tarefa' })).toHaveLength(1)
    expect(listTasks).toHaveBeenCalledWith('p1')
    fireEvent.click(screen.getByRole('tab', { name: 'Revisões' }))
    expect((await screen.findByText('Nenhuma revisão registrada.')).textContent).toBe('Nenhuma revisão registrada.')
    expect(screen.getAllByRole('button', { name: 'Nova revisão' })).toHaveLength(1)
    expect(listRevisions).toHaveBeenCalledWith('p1')
  })

  it('mostra histórico do projeto sem copiar eventos', async () => {
    getProject.mockResolvedValue({
      ...project,
      activities: [{
        id: 'a1', owner_id: 'owner-1', client_id: 'client-1', project_id: 'p1', contract_id: 'contract-1',
        type: 'status_change', description: 'Projeto em desenvolvimento.', metadata: {},
        created_by: 'owner-1', created_at: '2026-11-25T10:00:00Z',
      }],
    })
    renderPage()
    fireEvent.click(await screen.findByRole('tab', { name: 'Histórico' }))
    expect((await screen.findByText('Projeto em desenvolvimento.')).textContent).toBe('Projeto em desenvolvimento.')
  })

  it('refresh em erro preserva o último projeto válido', async () => {
    getProject.mockResolvedValueOnce(project).mockRejectedValueOnce(new Error('Falha ao atualizar.'))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Atualizar' }))
    expect((await screen.findByText('Falha ao atualizar.')).textContent).toBe('Falha ao atualizar.')
    expect(screen.getByRole('heading', { name: 'Site da Empresa' }).textContent).toBe('Site da Empresa')
  })

  it('preserva o snapshot durante o refresh e aplica a resposta confirmada', async () => {
    const refresh = deferred<ProjectDetail | null>()
    getProject.mockResolvedValueOnce(project).mockReturnValueOnce(refresh.promise)
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Atualizar' }))
    expect(screen.getByRole('heading', { name: 'Site da Empresa' })).toBeTruthy()
    expect(screen.queryByText('Carregando projeto…')).toBeNull()
    await act(async () => {
      refresh.resolve({ ...project, name: 'Site atualizado' })
      await refresh.promise
    })
    expect((await screen.findByRole('heading', { name: 'Site atualizado' })).textContent).toBe('Site atualizado')
  })

  it('projeto entregue não oferece seletor de status', async () => {
    getProject.mockResolvedValue({ ...project, status: 'delivered' })
    renderPage()
    await screen.findByRole('heading', { name: 'Site da Empresa' })
    expect(screen.queryByLabelText('Status do projeto')).toBeNull()
  })

  it('mudança de status exige ConfirmDialog antes da RPC', async () => {
    setProjectStatus.mockResolvedValue({ ...project, status: 'completed' })
    renderPage()
    fireEvent.change(await screen.findByLabelText('Status do projeto'), { target: { value: 'completed' } })
    expect(setProjectStatus).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog').textContent).toMatch(/Confirmar status/)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar status' }))
    await waitFor(() => expect(setProjectStatus).toHaveBeenCalledWith('p1', 'completed'))
  })

  it('edição retorna Project e atualiza o detalhe completo', async () => {
    updateProject.mockResolvedValue({ ...project, name: 'Site atualizado' })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Editar projeto' }))
    const nameInput = await screen.findByLabelText('Nome do projeto *')
    expect(screen.queryByText('Carregando formulário de projeto…')).toBeNull()
    fireEvent.change(nameInput, { target: { value: 'Site atualizado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(updateProject).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'Site atualizado' })))
    await waitFor(() => expect(getProject).toHaveBeenCalledTimes(2))
  })

  it('projeto cancelado preserva tarefas e revisões sem permitir criações', async () => {
    getProject.mockResolvedValue({ ...project, status: 'cancelled' })
    renderPage()
    await screen.findByRole('heading', { name: 'Site da Empresa' })
    expect(screen.queryByRole('button', { name: 'Editar projeto' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Tarefas' }))
    await screen.findByText('Nenhuma tarefa cadastrada.')
    expect((screen.getByRole('button', { name: 'Nova tarefa' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('tab', { name: 'Revisões' }))
    await screen.findByText('Nenhuma revisão registrada.')
    expect((screen.getByRole('button', { name: 'Nova revisão' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('tab', { name: 'Histórico' }))
    expect(screen.getByText('Nenhuma atividade registrada.')).toBeTruthy()
  })

  it('mostra ausência real com link de volta e descarta resposta de rota antiga', async () => {
    getProject.mockResolvedValueOnce(null)
    const missing = renderPage()
    expect((await screen.findByText('Projeto não encontrado.')).textContent).toBe('Projeto não encontrado.')
    expect(screen.getByRole('link', { name: 'Voltar para projetos' }).getAttribute('href')).toBe('/projetos')
    missing.unmount()

    const old = deferred<ProjectDetail | null>()
    getProject.mockReset().mockReturnValueOnce(old.promise).mockResolvedValueOnce({ ...project, id: 'p2', name: 'Projeto p2' })
    renderNavigablePage()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir p2' }))
    expect((await screen.findByRole('heading', { name: 'Projeto p2' })).textContent).toBe('Projeto p2')
    expect(screen.queryByText('Carregando projeto…')).toBeNull()
    await act(async () => {
      old.resolve({ ...project, name: 'Projeto antigo' })
      await old.promise
    })
    expect(screen.queryByRole('heading', { name: 'Projeto antigo' })).toBeNull()
    expect(screen.queryByText('Carregando projeto…')).toBeNull()
  })

  it('não preserva snapshot de outro ID quando o carregamento da nova rota falha', async () => {
    getProject.mockResolvedValueOnce(project).mockRejectedValueOnce(new Error('Falha ao carregar p2.'))
    renderNavigablePage()
    await screen.findByRole('heading', { name: 'Site da Empresa' })
    fireEvent.click(screen.getByRole('button', { name: 'Abrir p2' }))
    expect((await screen.findByText('Falha ao carregar p2.')).textContent).toBe('Falha ao carregar p2.')
    expect(screen.queryByRole('heading', { name: 'Site da Empresa' })).toBeNull()
    expect(screen.queryByText('Carregando projeto…')).toBeNull()
  })

  it('descarta resposta de status quando a rota e o request mudaram', async () => {
    const status = deferred<ProjectDetail>()
    getProject.mockResolvedValueOnce(project).mockResolvedValueOnce({ ...project, id: 'p2', name: 'Projeto p2' })
    setProjectStatus.mockReturnValueOnce(status.promise)
    renderNavigablePage()
    fireEvent.change(await screen.findByLabelText('Status do projeto'), { target: { value: 'completed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar status' }))
    await waitFor(() => expect(setProjectStatus).toHaveBeenCalledWith('p1', 'completed'))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir p2' }))
    expect((await screen.findByRole('heading', { name: 'Projeto p2' })).textContent).toBe('Projeto p2')
    await act(async () => {
      status.resolve({ ...project, status: 'completed' })
      await status.promise
    })
    expect(screen.getByRole('heading', { name: 'Projeto p2' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Site da Empresa' })).toBeNull()
    expect(toast).not.toHaveBeenCalledWith('Status do projeto atualizado.')
    expect(screen.queryByText('Carregando projeto…')).toBeNull()
  })

  it('descarta aba, edição e confirmação de status sincronicamente na troca de rota', async () => {
    getProject.mockResolvedValueOnce(project).mockResolvedValueOnce({ ...project, id: 'p2', name: 'Projeto p2' })
    renderNavigablePage()
    await screen.findByRole('heading', { name: 'Site da Empresa' })

    fireEvent.click(screen.getByRole('tab', { name: 'Tarefas' }))
    await screen.findByText('Nenhuma tarefa cadastrada.')
    fireEvent.click(screen.getByRole('button', { name: 'Editar projeto' }))
    expect(screen.getByRole('dialog', { name: 'Editar projeto' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Visão' }))
    fireEvent.change(screen.getByLabelText('Status do projeto'), { target: { value: 'completed' } })
    expect(screen.getByRole('dialog', { name: 'Confirmar status' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir p2' }))

    expect((await screen.findByRole('heading', { name: 'Projeto p2' })).textContent).toBe('Projeto p2')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('tab', { name: 'Visão' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Tarefas' }).getAttribute('aria-selected')).toBe('false')
    expect(screen.queryByText('Nenhuma tarefa cadastrada.')).toBeNull()
  })

  it('não libera o saving da rota nova quando o finally de uma mutação antiga termina', async () => {
    const oldStatus = deferred<ProjectDetail>()
    const newStatus = deferred<ProjectDetail>()
    const projectP2: ProjectDetail = { ...project, id: 'p2', name: 'Projeto p2' }
    getProject.mockResolvedValueOnce(project).mockResolvedValueOnce(projectP2).mockResolvedValue(projectP2)
    setProjectStatus.mockReturnValueOnce(oldStatus.promise).mockReturnValueOnce(newStatus.promise)
    renderNavigablePage()

    fireEvent.change(await screen.findByLabelText('Status do projeto'), { target: { value: 'completed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar status' }))
    await waitFor(() => expect(setProjectStatus).toHaveBeenCalledWith('p1', 'completed'))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir p2' }))
    await screen.findByRole('heading', { name: 'Projeto p2' })

    fireEvent.change(screen.getByLabelText('Status do projeto'), { target: { value: 'completed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar status' }))
    await waitFor(() => expect(setProjectStatus).toHaveBeenCalledWith('p2', 'completed'))
    expect((screen.getByLabelText('Status do projeto') as HTMLSelectElement).disabled).toBe(true)

    await act(async () => {
      oldStatus.resolve({ ...project, status: 'completed' })
      await oldStatus.promise
    })
    expect((screen.getByLabelText('Status do projeto') as HTMLSelectElement).disabled).toBe(true)
    expect(toast).not.toHaveBeenCalledWith('Status do projeto atualizado.')

    await act(async () => {
      newStatus.resolve({ ...projectP2, status: 'completed' })
      await newStatus.promise
    })
    await waitFor(() => expect((screen.getByLabelText('Status do projeto') as HTMLSelectElement).disabled).toBe(false))
    expect(screen.getByRole('heading', { name: 'Projeto p2' })).toBeTruthy()
    expect(toast).toHaveBeenCalledWith('Status do projeto atualizado.')
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}
