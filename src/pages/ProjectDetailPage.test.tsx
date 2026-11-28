// @vitest-environment jsdom
// src/pages/ProjectDetailPage.test.tsx
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project, ProjectDetail } from '../types/project'

const { getProject, updateProject, setProjectStatus, deliverProject, listProjectFormOptions } = vi.hoisted(() => ({
  getProject: vi.fn(), updateProject: vi.fn(), setProjectStatus: vi.fn(), deliverProject: vi.fn(), listProjectFormOptions: vi.fn(),
}))
const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
const { listTasks, updateTask } = vi.hoisted(() => ({ listTasks: vi.fn(), updateTask: vi.fn() }))
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
  return { ...actual, listTasks, updateTask }
})
vi.mock('../services/projectRevisionService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/projectRevisionService')>()
  return { ...actual, listRevisions }
})

import { ProjectDetailPage } from './ProjectDetailPage'

const projectRecord: Project = {
  id: 'p1', owner_id: 'owner-1', client_id: 'client-1', contract_id: 'contract-1', source_link_id: null,
  name: 'Site da Empresa', service: 'Site', contracted_value_cents: 123456,
  description: null, start_date: '2026-11-25', due_date: '2026-12-10', responsible_name: null,
  priority: 'high', status: 'in_development', completed_at: null, delivered_at: null,
  delivery_confirmed_at: null, delivery_url: null, files_url: null, final_notes: null, archived_at: null,
  created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
}

const project: ProjectDetail = {
  ...projectRecord, client_name: 'Empresa A',
  progressPercent: 50, activeTasks: 2, completedTasks: 1, tasks: [], revisions: [], activities: [],
}

function makeTask(id: string, status: ProjectDetail['tasks'][number]['status'] = 'pending') {
  return {
    id, owner_id: 'owner-1', project_id: 'p1', title: 'Layout', description: null, status,
    responsible_name: null, start_date: null, due_date: null, priority: 'medium' as const, position: 0,
    notes: null, completed_at: null, cancelled_at: null,
    created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
  }
}

function makeRevision(): ProjectDetail['revisions'][number] {
  return {
    id: 'r1', owner_id: 'owner-1', project_id: 'p1', requested_at: '2026-11-25T12:00:00Z',
    description: 'Revisar página inicial', responsible_name: null, status: 'requested',
    completed_at: null, approved_at: null, notes: null,
    created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
  }
}

function makeActivity(): ProjectDetail['activities'][number] {
  return {
    id: 'a1', owner_id: 'owner-1', client_id: 'client-1', project_id: 'p1', contract_id: 'contract-1',
    type: 'status_change', description: 'Projeto em desenvolvimento.', metadata: {},
    created_by: 'owner-1', created_at: '2026-11-25T10:00:00Z',
  }
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
    updateTask.mockReset()
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

  it('preserva tarefa confirmada e métricas do detalhe quando os refreshes falham', async () => {
    const pending = makeTask('t1')
    const completed = { ...pending, status: 'completed' as const }
    getProject.mockResolvedValueOnce({
      ...project, tasks: [pending], progressPercent: 0, activeTasks: 1, completedTasks: 0,
    }).mockRejectedValue(new Error('Falha ao atualizar projeto.'))
    listTasks.mockResolvedValueOnce([pending]).mockRejectedValue(new Error('Falha ao atualizar tarefas.'))
    updateTask.mockResolvedValue(completed)
    renderPage()

    fireEvent.click(await screen.findByRole('tab', { name: 'Tarefas' }))
    fireEvent.change(await screen.findByLabelText('Status da tarefa Layout'), { target: { value: 'completed' } })
    expect(await screen.findByText('Falha ao atualizar tarefas.')).toBeTruthy()
    expect((screen.getByLabelText('Status da tarefa Layout') as HTMLSelectElement).value).toBe('completed')
    expect(screen.getByRole('progressbar', { name: 'Progresso de tarefas' }).getAttribute('aria-valuenow')).toBe('100')

    fireEvent.click(screen.getByRole('tab', { name: 'Visão' }))
    expect(await screen.findByText('Falha ao atualizar projeto.')).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Progresso do projeto' }).getAttribute('aria-valuenow')).toBe('100')
    expect(screen.getByText('1 de 1 tarefas concluídas')).toBeTruthy()
  })

  it('mescla tarefa confirmada no detalhe após trocar de aba durante a mutação', async () => {
    const pending = makeTask('t1')
    const completed = { ...pending, status: 'completed' as const }
    const mutation = deferred<typeof completed>()
    getProject.mockResolvedValueOnce({
      ...project, tasks: [pending], progressPercent: 0, activeTasks: 1, completedTasks: 0,
    }).mockRejectedValue(new Error('Falha ao atualizar projeto.'))
    listTasks.mockResolvedValue([pending])
    updateTask.mockReturnValue(mutation.promise)
    renderPage()

    fireEvent.click(await screen.findByRole('tab', { name: 'Tarefas' }))
    fireEvent.change(await screen.findByLabelText('Status da tarefa Layout'), { target: { value: 'completed' } })
    await waitFor(() => expect(updateTask).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('tab', { name: 'Visão' }))
    await act(async () => {
      mutation.resolve(completed)
      await mutation.promise
    })

    expect(await screen.findByText('Falha ao atualizar projeto.')).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Progresso do projeto' }).getAttribute('aria-valuenow')).toBe('100')
    expect(screen.getByText('1 de 1 tarefas concluídas')).toBeTruthy()
  })

  it('descarta tarefa confirmada de rota antiga', async () => {
    const pending = makeTask('t1')
    const mutation = deferred<ProjectDetail['tasks'][number]>()
    const projectP2: ProjectDetail = { ...project, id: 'p2', name: 'Projeto p2' }
    getProject.mockResolvedValueOnce({
      ...project, tasks: [pending], progressPercent: 0, activeTasks: 1, completedTasks: 0,
    }).mockResolvedValue(projectP2)
    listTasks.mockResolvedValue([pending])
    updateTask.mockReturnValue(mutation.promise)
    renderNavigablePage()

    fireEvent.click(await screen.findByRole('tab', { name: 'Tarefas' }))
    fireEvent.change(await screen.findByLabelText('Status da tarefa Layout'), { target: { value: 'completed' } })
    await waitFor(() => expect(updateTask).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Abrir p2' }))
    await screen.findByRole('heading', { name: 'Projeto p2' })
    await act(async () => {
      mutation.resolve({ ...pending, status: 'completed' })
      await mutation.promise
    })

    expect(screen.getByRole('heading', { name: 'Projeto p2' })).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Progresso do projeto' }).getAttribute('aria-valuenow')).toBe('50')
    expect(screen.queryByRole('heading', { name: 'Site da Empresa' })).toBeNull()
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

  it('preserva edição confirmada e dados do detalhe quando o refresh falha', async () => {
    getProject.mockResolvedValueOnce({
      ...project, tasks: [makeTask('t1'), makeTask('t2', 'completed')],
      revisions: [makeRevision()], activities: [makeActivity()],
    }).mockRejectedValue(new Error('Falha ao atualizar projeto.'))
    updateProject.mockResolvedValue({
      ...projectRecord, name: 'Site atualizado', contracted_value_cents: 100000,
    })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Editar projeto' }))
    const nameInput = await screen.findByLabelText('Nome do projeto *')
    fireEvent.change(nameInput, { target: { value: 'Site atualizado' } })
    fireEvent.change(screen.getByLabelText('Valor alocado (R$) *'), { target: { value: '1.000,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Falha ao atualizar projeto.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Site atualizado' })).toBeTruthy()
    expect(screen.getByText('R$ 1.000,00').textContent?.replace(/\u00a0/g, ' ')).toBe('R$ 1.000,00')
    expect(screen.getByRole('link', { name: 'Empresa A' }).getAttribute('href')).toBe('/clientes/client-1')
    expect(screen.getByRole('progressbar', { name: 'Progresso do projeto' }).getAttribute('aria-valuenow')).toBe('50')
    expect(screen.getByText('1 de 2 tarefas concluídas')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Histórico' }))
    expect(screen.getByText('Projeto em desenvolvimento.')).toBeTruthy()
  })

  it('preserva entrega confirmada e não reapresenta o formulário quando o refresh falha', async () => {
    const delivered: Project = {
      ...projectRecord, status: 'delivered', delivered_at: '2026-11-26T12:00:00Z',
      delivery_confirmed_at: '2026-11-26T12:00:00Z', delivery_url: 'https://example.test/entrega',
      files_url: 'https://example.test/arquivos', final_notes: 'Concluído',
    }
    getProject.mockResolvedValueOnce({ ...project, status: 'completed' })
      .mockRejectedValue(new Error('Falha ao atualizar projeto.'))
    deliverProject.mockResolvedValue(delivered)
    renderPage()
    fireEvent.click(await screen.findByRole('tab', { name: 'Entrega' }))
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega' } })
    fireEvent.change(screen.getByLabelText('Link dos arquivos'), { target: { value: 'https://example.test/arquivos' } })
    fireEvent.change(screen.getByLabelText('Notas finais'), { target: { value: 'Concluído' } })
    fireEvent.click(screen.getByLabelText('Entrega confirmada com o cliente'))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))

    expect(await screen.findByText('Falha ao atualizar projeto.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Entrega registrada' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Abrir entrega' }).getAttribute('href')).toBe('https://example.test/entrega')
    expect(screen.getByText('Entregue')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Visão' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Entrega' }))
    expect(screen.getByRole('heading', { name: 'Entrega registrada' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Registrar entrega' })).toBeNull()
  })

  it('mescla entrega confirmada no detalhe após trocar de aba durante a mutação', async () => {
    const pending = deferred<Project>()
    const delivered: Project = {
      ...projectRecord, status: 'delivered', delivered_at: '2026-11-26T12:00:00Z',
      delivery_confirmed_at: '2026-11-26T12:00:00Z', delivery_url: 'https://example.test/entrega',
    }
    getProject.mockResolvedValueOnce({ ...project, status: 'completed' })
      .mockRejectedValue(new Error('Falha ao atualizar projeto.'))
    deliverProject.mockReturnValueOnce(pending.promise)
    renderPage()
    fireEvent.click(await screen.findByRole('tab', { name: 'Entrega' }))
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega' } })
    fireEvent.click(screen.getByLabelText('Entrega confirmada com o cliente'))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar entrega' }))
    await waitFor(() => expect(deliverProject).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('tab', { name: 'Visão' }))

    await act(async () => {
      pending.resolve(delivered)
      await pending.promise
    })

    expect(await screen.findByText('Falha ao atualizar projeto.')).toBeTruthy()
    expect(screen.getByText('Entregue')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Entrega' }))
    expect(screen.getByRole('heading', { name: 'Entrega registrada' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Registrar entrega' })).toBeNull()
  })

  it('descarta entrega confirmada de rota antiga', async () => {
    const pending = deferred<Project>()
    const projectP2: ProjectDetail = { ...project, id: 'p2', name: 'Projeto p2', status: 'completed' }
    getProject.mockResolvedValueOnce({ ...project, status: 'completed' }).mockResolvedValue(projectP2)
    deliverProject.mockReturnValueOnce(pending.promise)
    renderNavigablePage()
    fireEvent.click(await screen.findByRole('tab', { name: 'Entrega' }))
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega' } })
    fireEvent.click(screen.getByLabelText('Entrega confirmada com o cliente'))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar entrega' }))
    await waitFor(() => expect(deliverProject).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir p2' }))
    await screen.findByRole('heading', { name: 'Projeto p2' })

    await act(async () => {
      pending.resolve({
        ...projectRecord, status: 'delivered', delivered_at: '2026-11-26T12:00:00Z',
        delivery_url: 'https://example.test/entrega',
      })
      await pending.promise
    })

    expect(screen.getByRole('heading', { name: 'Projeto p2' })).toBeTruthy()
    expect((screen.getByLabelText('Status do projeto') as HTMLSelectElement).value).toBe('completed')
    expect(screen.queryByText('Entregue')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Site da Empresa' })).toBeNull()
    expect(toast).not.toHaveBeenCalledWith('Entrega registrada com sucesso.')
  })

  it.each(['Escape', 'backdrop'] as const)('bloqueia %s do modal de edição durante o saving', async (action) => {
    const pending = deferred<Project>()
    getProject.mockResolvedValueOnce(project).mockRejectedValue(new Error('Falha ao atualizar projeto.'))
    updateProject.mockReturnValueOnce(pending.promise)
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Editar projeto' }))
    await screen.findByLabelText('Nome do projeto *')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1))
    const dialog = screen.getByRole('dialog', { name: 'Editar projeto' })

    if (action === 'Escape') fireEvent.keyDown(window, { key: 'Escape' })
    else fireEvent.click(dialog.parentElement as HTMLElement)

    expect(screen.getByRole('dialog', { name: 'Editar projeto' })).toBe(dialog)
    expect(screen.queryByRole('button', { name: 'Fechar' })).toBeNull()

    await act(async () => {
      pending.resolve({ ...projectRecord, name: 'Site atualizado' })
      await pending.promise
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await screen.findByRole('heading', { name: 'Site atualizado' })).toBeTruthy()
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
