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

  it('isola rejeição do refresh adiado após RPC bem-sucedida', async () => {
    const refreshError = new Error('Falha no refresh')
    const refresh = vi.fn().mockRejectedValue(refreshError)
    setProjectStatus.mockResolvedValue({ ...project, status: 'planning' })
    const { result } = renderHook(() => useProjectStatusQueue({
      projects: [project], onChange: vi.fn(), onRefresh: refresh,
    }))

    let move!: Promise<void>
    act(() => {
      move = result.current.moveProject('p1', 'planning')
      void result.current.requestRefresh()
    })
    await act(async () => {
      await expect(move).resolves.toBeUndefined()
    })
    expect(result.current.projects[0].status).toBe('planning')
    expect(result.current.pendingIds.size).toBe(0)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('preserva o erro da RPC quando o refresh adiado também rejeita', async () => {
    const pending = deferred<Project>()
    const rpcError = new Error('Falha na movimentação')
    const refreshError = new Error('Falha no refresh')
    const refresh = vi.fn().mockRejectedValue(refreshError)
    setProjectStatus.mockReturnValue(pending.promise)
    const { result } = renderHook(() => useProjectStatusQueue({
      projects: [project], onChange: vi.fn(), onRefresh: refresh,
    }))

    let move!: Promise<void>
    act(() => {
      move = result.current.moveProject('p1', 'planning')
      void result.current.requestRefresh()
    })
    await act(async () => {
      pending.reject(rpcError)
      await expect(move).rejects.toBe(rpcError)
    })
    expect(result.current.projects[0].status).toBe('not_started')
    expect(result.current.pendingIds.size).toBe(0)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('propaga rejeição de refresh imediato sem mutações pendentes', async () => {
    const refreshError = new Error('Falha no refresh')
    const refresh = vi.fn().mockRejectedValue(refreshError)
    const { result } = renderHook(() => useProjectStatusQueue({
      projects: [project], onChange: vi.fn(), onRefresh: refresh,
    }))

    await act(async () => {
      await expect(result.current.requestRefresh()).rejects.toBe(refreshError)
    })
    expect(refresh).toHaveBeenCalledTimes(1)
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

  it('reconcilia snapshots externos por projeto sem novo rerender nem onChange', async () => {
    const pending = deferred<Project>()
    const other: ProjectListItem = { ...project, id: 'p2', name: 'Outro projeto' }
    const onChange = vi.fn()
    setProjectStatus.mockReturnValue(pending.promise)
    const { result, rerender } = renderHook(
      ({ projects }) => useProjectStatusQueue({ projects, onChange, onRefresh: vi.fn() }),
      { initialProps: { projects: [project, other] } },
    )

    let move!: Promise<void>
    act(() => { move = result.current.moveProject('p1', 'planning') })
    expect(onChange).toHaveBeenCalledTimes(1)

    const external: ProjectListItem = {
      ...project,
      name: 'Nome externo',
      description: 'Descrição externa',
      updated_at: '2026-11-26T10:00:00Z',
    }
    const externalOther: ProjectListItem = {
      ...other,
      name: 'Outro externo',
      status: 'in_development',
    }
    rerender({ projects: [external, externalOther] })
    expect(result.current.projects).toEqual([
      expect.objectContaining({ id: 'p1', name: 'Projeto', description: null, status: 'planning' }),
      expect.objectContaining({ id: 'p2', name: 'Outro externo', status: 'in_development' }),
    ])
    expect(onChange).toHaveBeenCalledTimes(1)

    const latestExternal = { ...external, name: 'Nome mais recente' }
    const latestExternalOther = { ...externalOther, name: 'Outro mais recente' }
    rerender({ projects: [latestExternal, latestExternalOther] })
    expect(result.current.projects[0]).toEqual(expect.objectContaining({
      id: 'p1', name: 'Projeto', status: 'planning',
    }))
    expect(result.current.projects[1]).toEqual(expect.objectContaining({
      id: 'p2', name: 'Outro mais recente', status: 'in_development',
    }))
    expect(onChange).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve({ ...project, status: 'planning' })
      await move
    })
    expect(result.current.projects).toEqual([
      expect.objectContaining({
        id: 'p1', name: 'Nome mais recente', description: 'Descrição externa',
        updated_at: '2026-11-26T10:00:00Z', status: 'planning',
      }),
      expect.objectContaining({ id: 'p2', name: 'Outro mais recente', status: 'in_development' }),
    ])
    expect(result.current.pendingIds.size).toBe(0)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it.each(['resolve', 'reject'] as const)('faz delivered externo vencer a reconciliação quando a RPC %s, sem refresh posterior', async (outcome) => {
    const pending = deferred<Project>()
    const onChange = vi.fn()
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    setProjectStatus.mockReturnValue(pending.promise)
    const { result, rerender } = renderHook(
      ({ projects }) => useProjectStatusQueue({ projects, onChange, onRefresh }),
      { initialProps: { projects: [project] } },
    )

    let move!: Promise<void>
    act(() => { move = result.current.moveProject('p1', 'planning') })
    const external: ProjectListItem = {
      ...project,
      name: 'Nome externo',
      client_name: 'Cliente externo',
      description: 'Descrição externa',
      status: 'delivered',
      delivered_at: '2026-11-26T12:00:00Z',
      delivery_confirmed_at: '2026-11-26T12:00:00Z',
      delivery_url: 'https://example.test/entrega',
      files_url: 'https://example.test/arquivos',
      final_notes: 'Concluído',
      updated_at: '2026-11-26T10:00:00Z',
    }
    rerender({ projects: [external] })
    expect(result.current.projects[0]).toEqual(expect.objectContaining({
      id: 'p1', name: 'Projeto', description: null, status: 'planning',
    }))
    expect(onChange).toHaveBeenCalledTimes(1)

    if (outcome === 'resolve') {
      await act(async () => {
        pending.resolve({ ...project, status: 'planning', name: 'Retorno da RPC' })
        await move
      })
    } else {
      const rpcError = new Error('Falha na movimentação')
      await act(async () => {
        pending.reject(rpcError)
        await expect(move).rejects.toBe(rpcError)
      })
    }

    expect(result.current.projects[0]).toEqual(expect.objectContaining({
      id: 'p1', name: 'Nome externo', client_name: 'Cliente externo',
      description: 'Descrição externa', updated_at: '2026-11-26T10:00:00Z',
      delivered_at: '2026-11-26T12:00:00Z', delivery_url: 'https://example.test/entrega',
      files_url: 'https://example.test/arquivos', final_notes: 'Concluído', status: 'delivered',
    }))
    expect(result.current.pendingIds.size).toBe(0)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onRefresh).not.toHaveBeenCalled()

    await act(async () => { await result.current.moveProject('p1', 'in_development') })
    expect(result.current.projects[0].status).toBe('delivered')
    expect(setProjectStatus).toHaveBeenCalledTimes(1)
  })

  it('reconcilia campos externos sem substituir o baseline quando a mutação não entregue falha', async () => {
    const pending = deferred<Project>()
    const onChange = vi.fn()
    setProjectStatus.mockReturnValue(pending.promise)
    const { result, rerender } = renderHook(
      ({ projects }) => useProjectStatusQueue({ projects, onChange, onRefresh: vi.fn() }),
      { initialProps: { projects: [project] } },
    )

    let move!: Promise<void>
    act(() => { move = result.current.moveProject('p1', 'planning') })
    const external: ProjectListItem = {
      ...project,
      name: 'Nome externo',
      description: 'Descrição externa',
      status: 'in_review',
      updated_at: '2026-11-26T10:00:00Z',
    }
    rerender({ projects: [external] })
    expect(result.current.projects[0]).toEqual(expect.objectContaining({
      id: 'p1', name: 'Projeto', description: null, status: 'planning',
    }))
    expect(onChange).toHaveBeenCalledTimes(1)

    const rpcError = new Error('Falha na movimentação')
    await act(async () => {
      pending.reject(rpcError)
      await expect(move).rejects.toBe(rpcError)
    })
    expect(result.current.projects[0]).toEqual(expect.objectContaining({
      id: 'p1', name: 'Nome externo', description: 'Descrição externa',
      updated_at: '2026-11-26T10:00:00Z', status: 'not_started',
    }))
    expect(result.current.pendingIds.size).toBe(0)
    expect(onChange).toHaveBeenCalledTimes(2)
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
