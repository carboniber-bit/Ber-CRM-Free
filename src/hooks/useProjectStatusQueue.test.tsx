// @vitest-environment jsdom
// src/hooks/useProjectStatusQueue.test.tsx
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project, ProjectListItem } from '../types/project'

const { setProjectStatus } = vi.hoisted(() => ({ setProjectStatus: vi.fn() }))
vi.mock('../services/projectService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/projectService')>()
  return { ...actual, setProjectStatus }
})

import { useProjectStatusQueue } from './useProjectStatusQueue'

const project: ProjectListItem = {
  id: 'p1', owner_id: 'owner-1', client_id: 'client-1', contract_id: 'contract-1', source_link_id: null,
  name: 'Projeto', client_name: 'Cliente', service: 'Site', contracted_value_cents: 100000,
  description: null, start_date: null, due_date: null, responsible_name: null, priority: 'high',
  status: 'not_started', completed_at: null, delivered_at: null, delivery_confirmed_at: null,
  delivery_url: null, files_url: null, final_notes: null, archived_at: null,
  created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
  progressPercent: null, activeTasks: 0, completedTasks: 0,
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

afterEach(cleanup)

describe('useProjectStatusQueue', () => {
  beforeEach(() => { setProjectStatus.mockReset() })

  it('serializa movimentos do mesmo projeto e preserva a última resposta', async () => {
    const first = deferred<Project>()
    const second = deferred<Project>()
    setProjectStatus.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const onChange = vi.fn()
    const { result } = renderHook(() => useProjectStatusQueue({
      projects: [project], onChange, onRefresh: vi.fn(),
    }))

    let firstMove!: Promise<void>
    let secondMove!: Promise<void>
    act(() => {
      firstMove = result.current.moveProject('p1', 'planning')
      secondMove = result.current.moveProject('p1', 'in_development')
    })
    expect(setProjectStatus).toHaveBeenCalledTimes(1)
    expect(result.current.projects[0].status).toBe('in_development')
    expect(result.current.pendingIds.has('p1')).toBe(true)
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: 'p1', status: 'in_development' }),
    ])

    await act(async () => {
      first.resolve({ ...project, status: 'planning' })
      await firstMove
    })
    expect(result.current.projects[0].status).toBe('in_development')
    expect(result.current.pendingIds.has('p1')).toBe(true)
    await act(async () => {
      second.resolve({ ...project, status: 'in_development' })
      await secondMove
    })
    expect(result.current.projects[0].status).toBe('in_development')
    expect(result.current.pendingIds.size).toBe(0)
  })

  it('faz rollback somente se o card ainda está no status otimista que falhou', async () => {
    setProjectStatus.mockRejectedValue(new Error('Falha'))
    const onChange = vi.fn()
    const { result } = renderHook(() => useProjectStatusQueue({
      projects: [project], onChange, onRefresh: vi.fn(),
    }))
    await act(async () => {
      await result.current.moveProject('p1', 'planning').catch(() => undefined)
    })
    expect(result.current.projects[0].status).toBe('not_started')
    expect(result.current.pendingIds.size).toBe(0)
  })

  it('não desfaz uma intenção mais nova quando a movimentação anterior falha', async () => {
    const first = deferred<Project>()
    const second = deferred<Project>()
    setProjectStatus.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result } = renderHook(() => useProjectStatusQueue({
      projects: [project], onChange: vi.fn(), onRefresh: vi.fn(),
    }))
    let firstMove!: Promise<void>
    let secondMove!: Promise<void>
    act(() => {
      firstMove = result.current.moveProject('p1', 'planning')
      secondMove = result.current.moveProject('p1', 'in_development')
    })
    await act(async () => {
      first.reject(new Error('Falha na primeira'))
      await firstMove.catch(() => undefined)
    })
    expect(result.current.projects[0].status).toBe('in_development')
    await act(async () => {
      second.resolve({ ...project, status: 'in_development' })
      await secondMove
    })
    expect(result.current.projects[0].status).toBe('in_development')
  })

  it('adia refresh solicitado durante uma mutação', async () => {
    const pending = deferred<Project>()
    const refresh = vi.fn().mockResolvedValue(undefined)
    setProjectStatus.mockReturnValue(pending.promise)
    const { result } = renderHook(() => useProjectStatusQueue({
      projects: [project], onChange: vi.fn(), onRefresh: refresh,
    }))
    let move!: Promise<void>
    act(() => { move = result.current.moveProject('p1', 'planning') })
    await act(async () => { await result.current.requestRefresh() })
    expect(refresh).not.toHaveBeenCalled()
    await act(async () => {
      pending.resolve({ ...project, status: 'planning' })
      await move
    })
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  it('preserva métricas e client_name ao mesclar o Project retornado pelo RPC sem relação', async () => {
    const { client_name: _clientName, progressPercent: _progressPercent, activeTasks: _activeTasks, completedTasks: _completedTasks, ...projectWithoutBoardFields } = project
    setProjectStatus.mockResolvedValue({ ...projectWithoutBoardFields, status: 'planning' })
    const { result } = renderHook(() => useProjectStatusQueue({
      projects: [project], onChange: vi.fn(), onRefresh: vi.fn(),
    }))
    await act(async () => { await result.current.moveProject('p1', 'planning') })
    expect(result.current.projects[0]).toEqual(expect.objectContaining({
      status: 'planning', progressPercent: null, activeTasks: 0,
      completedTasks: 0, client_name: 'Cliente',
    }))
  })

  it('usa o baseline confirmado quando a segunda intenção falha', async () => {
    const first = deferred<Project>()
    const second = deferred<Project>()
    setProjectStatus.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result } = renderHook(() => useProjectStatusQueue({
      projects: [project], onChange: vi.fn(), onRefresh: vi.fn(),
    }))
    let firstMove!: Promise<void>
    let secondMove!: Promise<void>
    act(() => {
      firstMove = result.current.moveProject('p1', 'planning')
      secondMove = result.current.moveProject('p1', 'in_development')
    })
    await act(async () => {
      first.resolve({ ...project, status: 'planning' })
      await firstMove
    })
    await act(async () => {
      second.reject(new Error('Falha na segunda'))
      await secondMove.catch(() => undefined)
    })
    expect(result.current.projects[0].status).toBe('planning')
    expect(result.current.pendingIds.size).toBe(0)
  })

  it('executa projetos diferentes em paralelo e adia o refresh até ambos terminarem', async () => {
    const other: ProjectListItem = { ...project, id: 'p2', name: 'Outro projeto' }
    const first = deferred<Project>()
    const second = deferred<Project>()
    const refresh = vi.fn().mockResolvedValue(undefined)
    setProjectStatus.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result } = renderHook(() => useProjectStatusQueue({
      projects: [project, other], onChange: vi.fn(), onRefresh: refresh,
    }))
    let firstMove!: Promise<void>
    let secondMove!: Promise<void>
    act(() => {
      firstMove = result.current.moveProject('p1', 'planning')
      secondMove = result.current.moveProject('p2', 'planning')
      void result.current.requestRefresh()
    })
    expect(setProjectStatus).toHaveBeenCalledTimes(2)
    expect(result.current.pendingIds).toEqual(new Set(['p1', 'p2']))
    await act(async () => {
      first.resolve({ ...project, status: 'planning' })
      await firstMove
    })
    expect(refresh).not.toHaveBeenCalled()
    expect(result.current.pendingIds.has('p1')).toBe(false)
    expect(result.current.pendingIds.has('p2')).toBe(true)
    await act(async () => {
      second.resolve({ ...other, status: 'planning' })
      await secondMove
    })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(result.current.pendingIds.size).toBe(0)
  })

  it('sincroniza dados externos sem pendências e não sobrescreve uma intenção pendente', async () => {
    const pending = deferred<Project>()
    setProjectStatus.mockReturnValue(pending.promise)
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = renderHook(
      ({ projects }) => useProjectStatusQueue({ projects, onChange: vi.fn(), onRefresh }),
      { initialProps: { projects: [project] } },
    )
    let move!: Promise<void>
    act(() => { move = result.current.moveProject('p1', 'planning') })
    const external: ProjectListItem = { ...project, name: 'Nome externo', status: 'not_started' }
    rerender({ projects: [external] })
    expect(result.current.projects[0].name).toBe('Projeto')
    expect(result.current.projects[0].status).toBe('planning')
    await act(async () => {
      pending.resolve({ ...project, status: 'planning' })
      await move
    })
    rerender({ projects: [{ ...external, status: 'planning', updated_at: '2026-11-26T10:00:00Z' }] })
    expect(result.current.projects[0].status).toBe('planning')
    expect(result.current.projects[0].updated_at).toBe('2026-11-26T10:00:00Z')
  })

  it('usa o callback de refresh mais recente sem pendências e ignora no-op e entregue', async () => {
    const firstRefresh = vi.fn().mockResolvedValue(undefined)
    const latestRefresh = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = renderHook(
      ({ projects, onRefresh }) => useProjectStatusQueue({ projects, onChange: vi.fn(), onRefresh }),
      { initialProps: { projects: [project], onRefresh: firstRefresh } },
    )
    rerender({ projects: [project], onRefresh: latestRefresh })
    await act(async () => { await result.current.requestRefresh() })
    expect(latestRefresh).toHaveBeenCalledTimes(1)
    expect(firstRefresh).not.toHaveBeenCalled()
    await act(async () => {
      await result.current.moveProject('p1', 'not_started')
      await result.current.moveProject('inexistente', 'planning')
    })
    expect(setProjectStatus).not.toHaveBeenCalled()
    rerender({ projects: [{ ...project, status: 'delivered' }], onRefresh: latestRefresh })
    await act(async () => { await result.current.moveProject('p1', 'planning') })
    expect(setProjectStatus).not.toHaveBeenCalled()
    expect(result.current.projects[0].status).toBe('delivered')
  })
})
