// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { DndContextProps, DragEndEvent } from '@dnd-kit/core'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PROJECT_MOVE_STATUSES, type ProjectFilters, type ProjectListItem } from '../types/project'

const { listProjects, listProjectsForBoard, setProjectStatus } = vi.hoisted(() => ({
  listProjects: vi.fn(), listProjectsForBoard: vi.fn(), setProjectStatus: vi.fn(),
}))
const { listClients } = vi.hoisted(() => ({ listClients: vi.fn() }))
const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
const dnd = vi.hoisted(() => ({ props: null as DndContextProps | null }))
vi.mock('../services/projectService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/projectService')>()
  return { ...actual, listProjects, listProjectsForBoard, setProjectStatus }
})
vi.mock('../services/clientService', () => ({ listClients }))
vi.mock('../hooks/useToast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useToast')>()
  return { ...actual, useToast: () => ({ toast }) }
})
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  return {
    ...actual,
    DndContext: (props: DndContextProps) => {
      dnd.props = props
      return <actual.DndContext {...props} />
    },
  }
})

import { ProjectsPage } from './ProjectsPage'

const project: ProjectListItem = {
  id: 'p1', owner_id: 'owner-1', client_id: 'client-1', contract_id: 'contract-1', source_link_id: null,
  name: 'Site da Empresa', client_name: 'Empresa A', service: 'Site', contracted_value_cents: 123456,
  description: null, start_date: '2026-11-25', due_date: '2026-12-10', responsible_name: null,
  priority: 'high', status: 'in_development', completed_at: null, delivered_at: null,
  delivery_confirmed_at: null, delivery_url: null, files_url: null, final_notes: null, archived_at: null,
  created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
  progressPercent: 50, activeTasks: 2, completedTasks: 1,
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

afterEach(() => {
  cleanup()
  dnd.props = null
})

describe('ProjectsPage', () => {
  beforeEach(() => {
    listProjects.mockReset().mockResolvedValue({ projects: [project], total: 1 })
    listProjectsForBoard.mockReset().mockResolvedValue({ projects: [project], partial: false })
    setProjectStatus.mockReset().mockResolvedValue({ ...project, status: 'in_review' })
    listClients.mockReset().mockResolvedValue({
      clients: [{ id: 'client-1', name: 'Empresa A' }], total: 1,
    })
    toast.mockReset()
  })

  it('mostra cards com progresso derivado e sem tarefas ativas quando null', async () => {
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    expect((await screen.findByText('Site da Empresa')).textContent).toBe('Site da Empresa')
    expect(screen.getByText('50%').textContent).toBe('50%')
    expect(screen.getByText('1 de 2 tarefas concluídas').textContent).toBe('1 de 2 tarefas concluídas')
    expect(screen.getByText('R$ 1.234,56').textContent?.replace(/\u00a0/g, ' ')).toBe('R$ 1.234,56')
  })

  it('mostra Sem tarefas ativas quando progresso é null', async () => {
    listProjects.mockResolvedValue({ projects: [{ ...project, progressPercent: null }], total: 1 })
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    expect((await screen.findByText('Sem tarefas ativas')).textContent).toBe('Sem tarefas ativas')
  })

  it('entrega estado vazio com link para cadastro', async () => {
    listProjects.mockResolvedValue({ projects: [], total: 0 })
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    expect((await screen.findByText('Nenhum projeto encontrado.')).textContent)
      .toBe('Nenhum projeto encontrado.')
    expect(screen.getByRole('link', { name: 'Criar projeto' }).getAttribute('href')).toBe('/projetos/novo')
  })

  it('usa página de 24 itens e paginação estável', async () => {
    const projects = Array.from({ length: 24 }, (_, index) => ({
      ...project, id: `p${index}`, name: `Projeto ${index}`,
    }))
    listProjects.mockResolvedValue({ projects, total: 25 })
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    expect(await screen.findByRole('link', { name: 'Projeto 0' })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: /^Projeto \d+$/ })).toHaveLength(24)
    expect(listProjects).toHaveBeenCalledWith({}, 'name_asc', 0, 24)
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    await waitFor(() => expect(listProjects).toHaveBeenLastCalledWith({}, 'name_asc', 1, 24))
  })

  it('aplica filtros de busca, cliente, status, prioridade e prazo', async () => {
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    fireEvent.change(await screen.findByLabelText('Buscar projetos'), { target: { value: 'Site' } })
    await screen.findByRole('option', { name: 'Empresa A' })
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'client-1' } })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'in_development' } })
    fireEvent.change(screen.getByLabelText('Prioridade'), { target: { value: 'high' } })
    fireEvent.change(screen.getByLabelText('Prazo inicial'), { target: { value: '2026-12-01' } })
    fireEvent.change(screen.getByLabelText('Prazo final'), { target: { value: '2026-12-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    await waitFor(() => expect(listProjects).toHaveBeenLastCalledWith({
      search: 'Site', clientId: 'client-1', status: 'in_development',
      priority: 'high', dueFrom: '2026-12-01', dueTo: '2026-12-31',
    }, 'name_asc', 0, 24))
  })

  it('descarta respostas obsoletas da lista', async () => {
    const old = deferred<{ projects: ProjectListItem[]; total: number }>()
    listProjects.mockReturnValueOnce(old.promise).mockResolvedValueOnce({
      projects: [{ ...project, id: 'new', name: 'Projeto novo' }], total: 1,
    })
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Buscar projetos'), { target: { value: 'novo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    expect((await screen.findByText('Projeto novo')).textContent).toBe('Projeto novo')
    await act(async () => {
      old.resolve({ projects: [{ ...project, name: 'Projeto antigo' }], total: 1 })
      await old.promise
    })
    expect(screen.queryByText('Projeto antigo')).toBeNull()
    expect(screen.getByText('Projeto novo')).toBeTruthy()
  })

  it('preserva a lista válida e permite retry quando o refresh falha', async () => {
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    await screen.findByText('Site da Empresa')
    listProjects.mockRejectedValueOnce(new Error('Falha ao atualizar projetos.'))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar projetos' }))
    expect((await screen.findByText('Falha ao atualizar projetos.')).textContent)
      .toBe('Falha ao atualizar projetos.')
    expect(screen.getByText('Site da Empresa')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('Kanban carrega até 500 e avisa quando o resultado é parcial', async () => {
    listProjectsForBoard.mockResolvedValue({ projects: [project], partial: true })
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }))
    expect((await screen.findByText(/até 500 projetos/)).textContent).toMatch(/até 500 projetos/)
    expect(listProjectsForBoard).toHaveBeenCalledWith({})
  })

  it('aplica os mesmos filtros da lista ao Kanban e atualiza o recorte ao limpar', async () => {
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    await screen.findByRole('option', { name: 'Empresa A' })
    fireEvent.change(screen.getByLabelText('Buscar projetos'), { target: { value: 'Site' } })
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'client-1' } })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'in_development' } })
    fireEvent.change(screen.getByLabelText('Prioridade'), { target: { value: 'high' } })
    fireEvent.change(screen.getByLabelText('Prazo inicial'), { target: { value: '2026-12-01' } })
    fireEvent.change(screen.getByLabelText('Prazo final'), { target: { value: '2026-12-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }))
    await waitFor(() => expect(listProjectsForBoard).toHaveBeenLastCalledWith({
      search: 'Site', clientId: 'client-1', status: 'in_development',
      priority: 'high', dueFrom: '2026-12-01', dueTo: '2026-12-31',
    }))
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    await waitFor(() => expect(listProjectsForBoard).toHaveBeenLastCalledWith({}))
  })

  it('mantém falha do board distinta de vazio e faz retry por requestRefresh', async () => {
    listProjectsForBoard.mockRejectedValueOnce(new Error('Falha ao carregar o Kanban.'))
      .mockResolvedValueOnce({ projects: [project], partial: false })
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }))
    expect((await screen.findByText('Falha ao carregar o Kanban.')).textContent)
      .toBe('Falha ao carregar o Kanban.')
    expect(screen.queryByText('Nenhum projeto no Kanban.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect((await screen.findByText('Site da Empresa')).textContent).toBe('Site da Empresa')
    expect(listProjectsForBoard).toHaveBeenCalledTimes(2)
    expect(listProjectsForBoard).toHaveBeenLastCalledWith({})
  })

  it('preserve o board anterior em falha de atualização manual', async () => {
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }))
    await screen.findByText('Site da Empresa')
    listProjectsForBoard.mockRejectedValueOnce(new Error('Falha no refresh do Kanban.'))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar Kanban' }))
    expect((await screen.findByText('Falha no refresh do Kanban.')).textContent)
      .toBe('Falha no refresh do Kanban.')
    expect(screen.getByText('Site da Empresa')).toBeTruthy()
  })

  it('adia a leitura do Kanban durante movimentação e aplica os filtros mais recentes', async () => {
    const pendingMove = deferred<ProjectListItem>()
    const pendingBoard = deferred<{ projects: ProjectListItem[]; partial: boolean }>()
    let moveConfirmed = false
    let filteredSnapshot: { projects: ProjectListItem[]; partial: boolean } | undefined
    setProjectStatus.mockReturnValueOnce(pendingMove.promise)
    listProjectsForBoard.mockImplementation((filters: ProjectFilters) => {
      const snapshot: { projects: ProjectListItem[]; partial: boolean } = {
        projects: [{ ...project, status: moveConfirmed ? 'in_review' : 'in_development' }],
        partial: false,
      }
      if (filters.search === 'Site') {
        filteredSnapshot = snapshot
        return pendingBoard.promise
      }
      return Promise.resolve(snapshot)
    })
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }))
    const selector = await screen.findByLabelText('Status do projeto Site da Empresa') as HTMLSelectElement
    expect(selector.value).toBe('in_development')
    fireEvent.change(selector, { target: { value: 'in_review' } })
    await waitFor(() => expect(setProjectStatus).toHaveBeenCalledWith('p1', 'in_review'))
    fireEvent.change(screen.getByLabelText('Buscar projetos'), { target: { value: 'Site' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    expect(listProjectsForBoard).toHaveBeenCalledTimes(1)
    expect(listProjectsForBoard).toHaveBeenLastCalledWith({})
    const pendingSelector = screen.getByLabelText('Status do projeto Site da Empresa') as HTMLSelectElement
    expect(pendingSelector.value).toBe('in_review')
    expect(pendingSelector.disabled).toBe(true)

    await act(async () => {
      moveConfirmed = true
      pendingMove.resolve({ ...project, status: 'in_review' })
      await pendingMove.promise
    })
    await waitFor(() => expect(listProjectsForBoard).toHaveBeenCalledTimes(2))
    expect(listProjectsForBoard).toHaveBeenLastCalledWith({ search: 'Site' })
    expect(filteredSnapshot).toEqual({
      projects: [expect.objectContaining({ status: 'in_review' })], partial: false,
    })
    await act(async () => {
      pendingBoard.resolve(filteredSnapshot!)
      await pendingBoard.promise
    })
    const liveSelector = screen.getByLabelText('Status do projeto Site da Empresa') as HTMLSelectElement
    await waitFor(() => {
      expect(liveSelector.disabled).toBe(false)
      expect(liveSelector.value).toBe('in_review')
    })
  })

  it('seletor mobile usa exatamente PROJECT_MOVE_STATUSES e move otimisticamente', async () => {
    const pending = deferred<ProjectListItem>()
    setProjectStatus.mockReturnValueOnce(pending.promise)
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }))
    const selector = await screen.findByLabelText('Status do projeto Site da Empresa') as HTMLSelectElement
    expect(Array.from(selector.options, (option) => option.value)).toEqual([...PROJECT_MOVE_STATUSES])
    fireEvent.change(selector, { target: { value: 'in_review' } })
    const pendingSelector = await screen.findByLabelText('Status do projeto Site da Empresa') as HTMLSelectElement
    expect(pendingSelector.value).toBe('in_review')
    expect(pendingSelector.disabled).toBe(true)
    await waitFor(() => expect(setProjectStatus).toHaveBeenCalledWith('p1', 'in_review'))
    await act(async () => {
      pending.resolve({ ...project, status: 'in_review' })
      await pending.promise
    })
    await waitFor(() => {
      const liveSelector = screen.getByLabelText('Status do projeto Site da Empresa') as HTMLSelectElement
      expect(liveSelector.disabled).toBe(false)
      expect(liveSelector.value).toBe('in_review')
    })
  })

  it('drag fora do board não move e falha faz rollback com toast', async () => {
    const pending = deferred<ProjectListItem>()
    setProjectStatus.mockReturnValueOnce(pending.promise)
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }))
    await screen.findByText('Site da Empresa')
    const outside = { active: { id: 'project:p1' }, over: null } as unknown as DragEndEvent
    act(() => { dnd.props?.onDragEnd?.(outside) })
    expect(setProjectStatus).not.toHaveBeenCalled()
    const drop = {
      active: { id: 'project:p1' }, over: { id: 'column:in_review' },
    } as unknown as DragEndEvent
    act(() => { dnd.props?.onDragEnd?.(drop) })
    expect(setProjectStatus).toHaveBeenCalledWith('p1', 'in_review')
    await act(async () => {
      pending.reject(new Error('Não foi possível mover o projeto.'))
      await pending.promise.catch(() => undefined)
    })
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Não foi possível mover o projeto.', 'error'))
    const selector = screen.getByLabelText('Status do projeto Site da Empresa') as HTMLSelectElement
    await waitFor(() => expect(selector.value).toBe('in_development'))
  })

  it('mantém delivered visível, read-only e sem seletor de status', async () => {
    listProjectsForBoard.mockResolvedValue({
      projects: [project, { ...project, id: 'delivered', name: 'Projeto entregue', status: 'delivered' }],
      partial: false,
    })
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }))
    expect((await screen.findByRole('link', { name: 'Projeto entregue' })).textContent)
      .toBe('Projeto entregue')
    expect(screen.getByRole('group', { name: 'Entregue' })).toBeTruthy()
    expect(screen.queryByLabelText('Status do projeto Projeto entregue')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Arrastar Projeto entregue' })).toBeNull()
  })
})
