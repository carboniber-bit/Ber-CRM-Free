// src/pages/ClientsPage.test.tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Client } from '../types/client'

const { listClients, stateUpdates } = vi.hoisted(() => ({
  listClients: vi.fn(),
  stateUpdates: vi.fn(),
}))

vi.mock('../services/clientService', () => ({ listClients }))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  const realUseState = actual.useState
  return {
    ...actual,
    useState: ((...args: Parameters<typeof actual.useState>) => {
      const [state, setState] = (realUseState as (...values: unknown[]) => [
        unknown, (value: unknown) => void,
      ])(...args)
      return [state, (value: unknown) => {
        stateUpdates(value)
        return setState(value)
      }]
    }) as typeof actual.useState,
  }
})

import { ClientsPage } from './ClientsPage'

interface ListResult { clients: Client[]; total: number }

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    owner_id: 'owner-1',
    creation_key: '00000000-0000-0000-0000-000000000501',
    name: 'Empresa A',
    responsible_name: 'Ana Responsável',
    phone: '(11) 99999-9999',
    whatsapp: null,
    email: 'contato@empresa-a.test',
    cnpj: null,
    cnpj_digits: null,
    phone_canonical: '5511999999999',
    whatsapp_canonical: null,
    website: null,
    instagram: null,
    address: null,
    city: 'São Paulo',
    district: null,
    zip_code: null,
    state: 'SP',
    niche: null,
    notes: null,
    status: 'active',
    source: 'manual',
    converted_at: null,
    archived_at: null,
    created_at: '2026-11-20T12:00:00Z',
    updated_at: '2026-11-20T12:00:00Z',
    ...overrides,
  }
}

function deferredList() {
  let resolve!: (result: ListResult) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<ListResult>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const clientA = makeClient()
const clientB = makeClient({ id: 'client-2', name: 'Empresa B', city: 'Campinas' })

afterEach(cleanup)

beforeEach(() => {
  listClients.mockReset().mockResolvedValue({ clients: [clientA], total: 1 })
  stateUpdates.mockReset()
})

describe('ClientsPage', () => {
  it('mostra loading e depois os clientes reais', async () => {
    render(<MemoryRouter><ClientsPage /></MemoryRouter>)

    expect(screen.getByText('Carregando clientes…').textContent).toBe('Carregando clientes…')
    expect((await screen.findByText('Empresa A')).textContent).toBe('Empresa A')
    expect(screen.getByText('Ativo').textContent).toBe('Ativo')
    expect(screen.getByText('São Paulo').textContent).toBe('São Paulo')
    expect(screen.getByText('(11) 99999-9999').textContent).toBe('(11) 99999-9999')
    expect(screen.getByRole('link', { name: 'Empresa A' }).getAttribute('href')).toBe('/clientes/client-1')
    expect(screen.queryByText(/Total recebido/i)).toBeNull()
    expect(listClients).toHaveBeenCalledWith({ search: '', status: '', city: '' }, 'name_asc', 0, 20)
  })

  it('aplica busca, status e cidade somente quando os filtros são submetidos', async () => {
    render(<MemoryRouter><ClientsPage /></MemoryRouter>)
    await screen.findByText('Empresa A')

    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'Empresa' } })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'active' } })
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'São Paulo' } })
    expect(listClients).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    await waitFor(() => expect(listClients).toHaveBeenCalledWith(
      { search: 'Empresa', status: 'active', city: 'São Paulo' }, 'name_asc', 0, 20,
    ))
  })

  it('usa o total do Supabase para habilitar e executar a próxima página', async () => {
    listClients.mockResolvedValue({ clients: [clientA], total: 41 })
    render(<MemoryRouter><ClientsPage /></MemoryRouter>)
    await screen.findByText('Empresa A')

    const next = screen.getByRole('button', { name: 'Próxima' }) as HTMLButtonElement
    expect(next.disabled).toBe(false)
    expect(screen.getByRole('status').textContent).toBe('Página 1 de 3')
    fireEvent.click(next)

    await waitFor(() => expect(listClients).toHaveBeenLastCalledWith(
      { search: '', status: '', city: '' }, 'name_asc', 1, 20,
    ))
    expect((await screen.findByText('Página 2 de 3')).textContent).toBe('Página 2 de 3')
  })

  it('volta à página zero ao submeter novos filtros', async () => {
    listClients.mockResolvedValue({ clients: [clientA], total: 41 })
    render(<MemoryRouter><ClientsPage /></MemoryRouter>)
    await screen.findByText('Empresa A')
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    await waitFor(() => expect(listClients).toHaveBeenLastCalledWith(
      { search: '', status: '', city: '' }, 'name_asc', 1, 20,
    ))

    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'Empresa B' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    await waitFor(() => expect(listClients).toHaveBeenLastCalledWith(
      { search: 'Empresa B', status: '', city: '' }, 'name_asc', 0, 20,
    ))
  })

  it('oferece as quatro ordenações e submete a ordenação escolhida', async () => {
    render(<MemoryRouter><ClientsPage /></MemoryRouter>)
    await screen.findByText('Empresa A')

    const sort = screen.getByLabelText('Ordenar por') as HTMLSelectElement
    expect(Array.from(sort.options).map((option) => option.value)).toEqual([
      'name_asc', 'name_desc', 'created_desc', 'updated_desc',
    ])
    fireEvent.change(sort, { target: { value: 'updated_desc' } })
    await waitFor(() => expect(listClients).toHaveBeenLastCalledWith(
      { search: '', status: '', city: '' }, 'updated_desc', 0, 20,
    ))
  })

  it('mostra estado vazio sem inventar clientes e oferece cadastro', async () => {
    listClients.mockResolvedValue({ clients: [], total: 0 })
    render(<MemoryRouter><ClientsPage /></MemoryRouter>)

    expect((await screen.findByText('Nenhum cliente encontrado.')).textContent).toBe('Nenhum cliente encontrado.')
    expect(screen.getByRole('link', { name: 'Cadastrar cliente' }).getAttribute('href')).toBe('/clientes/novo')
    expect(screen.queryByText('Empresa A')).toBeNull()
  })

  it('preserva erro e oferece nova tentativa', async () => {
    listClients.mockRejectedValueOnce(new Error('Falha de conexão.')).mockResolvedValueOnce({ clients: [], total: 0 })
    render(<MemoryRouter><ClientsPage /></MemoryRouter>)

    expect((await screen.findByRole('alert')).textContent).toContain('Falha de conexão.')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(listClients).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Nenhum cliente encontrado.')).toBeTruthy()
  })

  it('mantém a última lista válida quando a atualização falha', async () => {
    listClients.mockResolvedValueOnce({ clients: [clientA], total: 1 })
      .mockRejectedValueOnce(new Error('Falha ao atualizar.'))
      .mockResolvedValueOnce({ clients: [clientA], total: 1 })
    render(<MemoryRouter><ClientsPage /></MemoryRouter>)
    await screen.findByText('Empresa A')

    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'Empresa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Falha ao atualizar.')
    expect(screen.getByText('Empresa A').textContent).toBe('Empresa A')

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(screen.getByText('Empresa A')).toBeTruthy()
  })

  it('mantém a página de origem quando uma consulta de outra página falha', async () => {
    listClients.mockResolvedValueOnce({ clients: [clientA], total: 41 })
      .mockResolvedValueOnce({ clients: [clientB], total: 41 })
      .mockRejectedValueOnce(new Error('Falha na página 1.'))
    render(<MemoryRouter><ClientsPage /></MemoryRouter>)
    await screen.findByText('Empresa A')
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    expect(await screen.findByText('Página 2 de 3')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'Campinas' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Falha na página 1.')
    expect(screen.getByText('Empresa B')).toBeTruthy()
    expect(screen.queryByText('Empresa A')).toBeNull()
    expect(screen.getByText('Página 2 de 3')).toBeTruthy()
  })

  it('volta para a última página válida quando o total diminui', async () => {
    listClients.mockResolvedValueOnce({ clients: [clientA], total: 41 })
      .mockResolvedValueOnce({ clients: [clientB], total: 1 })
      .mockResolvedValueOnce({ clients: [clientA], total: 1 })
    render(<MemoryRouter><ClientsPage /></MemoryRouter>)
    await screen.findByText('Empresa A')
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))

    await waitFor(() => expect(listClients).toHaveBeenLastCalledWith(
      { search: '', status: '', city: '' }, 'name_asc', 0, 20,
    ))
    expect(await screen.findByText('Página 1 de 1')).toBeTruthy()
    expect(screen.getByText('Empresa A')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Próxima' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('descarta a resposta antiga quando dois filtros são submetidos em sequência', async () => {
    const first = deferredList()
    const second = deferredList()
    listClients.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    render(<MemoryRouter><ClientsPage /></MemoryRouter>)
    await waitFor(() => expect(listClients).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'Empresa B' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    await waitFor(() => expect(listClients).toHaveBeenCalledTimes(2))

    await act(async () => {
      second.resolve({ clients: [clientB], total: 1 })
      await second.promise
    })
    expect((await screen.findByText('Empresa B')).textContent).toBe('Empresa B')

    await act(async () => {
      first.resolve({ clients: [clientA], total: 1 })
      await first.promise
    })
    expect(screen.getByText('Empresa B')).toBeTruthy()
    expect(screen.queryByText('Empresa A')).toBeNull()
  })

  it('não atualiza estado depois do unmount quando a consulta termina', async () => {
    const pending = deferredList()
    listClients.mockReturnValue(pending.promise)
    const { unmount } = render(<MemoryRouter><ClientsPage /></MemoryRouter>)
    await waitFor(() => expect(listClients).toHaveBeenCalledTimes(1))
    unmount()
    stateUpdates.mockClear()

    await act(async () => {
      pending.resolve({ clients: [clientA], total: 1 })
      await pending.promise
    })

    expect(stateUpdates).not.toHaveBeenCalled()
  })
})
