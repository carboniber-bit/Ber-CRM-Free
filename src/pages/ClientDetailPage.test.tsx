// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Client, ClientDetail } from '../types/client'
import type { Contract } from '../types/contract'
import type { Project } from '../types/project'

const {
  getClient,
  updateClient,
  archiveClient,
  createClient,
  findClientDuplicateCandidates,
  toast,
  stateUpdates,
} = vi.hoisted(() => ({
  getClient: vi.fn(),
  updateClient: vi.fn(),
  archiveClient: vi.fn(),
  createClient: vi.fn(),
  findClientDuplicateCandidates: vi.fn(),
  toast: vi.fn(),
  stateUpdates: vi.fn(),
}))

vi.mock('../services/clientService', () => ({
  getClient,
  updateClient,
  archiveClient,
  createClient,
  findClientDuplicateCandidates,
}))
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ toast }) }))

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

import { ClientDetailPage } from './ClientDetailPage'

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

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 'contract-1',
    owner_id: 'owner-1',
    client_id: 'client-1',
    source_link_id: null,
    creation_key: '00000000-0000-0000-0000-000000000501',
    service: 'Site',
    total_value_cents: 123456,
    contracted_at: '2026-11-21',
    due_date: '2026-12-21',
    payment_method: 'pix',
    payment_terms: 'À vista',
    status: 'active',
    notes: null,
    cancelled_at: null,
    created_at: '2026-11-21T12:00:00Z',
    updated_at: '2026-11-21T12:00:00Z',
    ...overrides,
  }
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    owner_id: 'owner-1',
    client_id: 'client-1',
    contract_id: 'contract-1',
    source_link_id: null,
    name: 'Site institucional',
    service: 'Site',
    contracted_value_cents: 123456,
    description: null,
    start_date: '2026-11-22',
    due_date: '2026-12-10',
    responsible_name: 'Ana Responsável',
    priority: 'medium',
    status: 'in_review',
    completed_at: null,
    delivered_at: null,
    delivery_confirmed_at: null,
    delivery_url: null,
    files_url: null,
    final_notes: null,
    archived_at: null,
    created_at: '2026-11-22T12:00:00Z',
    updated_at: '2026-11-22T12:00:00Z',
    ...overrides,
  }
}

function makeDetail(overrides: Partial<ClientDetail> = {}): ClientDetail {
  return {
    client: makeClient(),
    contracts: [makeContract()],
    projects: [],
    activities: [],
    linkedLeads: [],
    history: [],
    ...overrides,
  }
}

function deferredDetail() {
  let resolve!: (detail: ClientDetail | null) => void
  const promise = new Promise<ClientDetail | null>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

const detail = makeDetail()

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/clientes/client-1']}>
      <Routes>
        <Route path="/clientes" element={<div>Lista de clientes</div>} />
        <Route path="/clientes/:id" element={<ClientDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(cleanup)

beforeEach(() => {
  getClient.mockReset().mockResolvedValue(detail)
  updateClient.mockReset()
  archiveClient.mockReset()
  createClient.mockReset()
  findClientDuplicateCandidates.mockReset().mockResolvedValue([])
  toast.mockReset()
  stateUpdates.mockReset()
})

describe('ClientDetailPage', () => {
  it('mostra cliente e contrato sem confundir com recebimento', async () => {
    renderPage()
    expect((await screen.findByRole('heading', { name: 'Empresa A' })).textContent).toBe('Empresa A')
    expect(screen.getByText('Contrato inicial').textContent).toBe('Contrato inicial')
    expect(screen.getByText('Origem: Cadastro manual')).toBeTruthy()
    expect(screen.getByText('21/11/2026')).toBeTruthy()
    expect(screen.getByText('21/12/2026')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Financeiro' }))
    expect(screen.getByText('Site').textContent).toBe('Site')
    expect(screen.getByText('R$ 1.234,56').textContent).toBe('R$ 1.234,56')
    expect(screen.getByText('Pix')).toBeTruthy()
    expect(screen.getByText('Valor contratado').textContent).toBe('Valor contratado')
    expect(screen.getByText('Pagamentos, estornos e despesas serão exibidos no módulo Financeiro.').textContent)
      .toBe('Pagamentos, estornos e despesas serão exibidos no módulo Financeiro.')
    expect(screen.queryByText('Total recebido')).toBeNull()
  })

  it('combina eventos do cliente e do lead na aba Histórico', async () => {
    getClient.mockResolvedValue(makeDetail({
      history: [
        { id: 'c1', type: 'conversion', description: 'Cliente convertido.', created_at: '2026-11-22T10:00:00Z', source: 'client' },
        { id: 'l1', type: 'mensagem', description: 'Mensagem enviada.', created_at: '2026-11-21T10:00:00Z', source: 'lead', leadName: 'Empresa A' },
      ],
    }))
    renderPage()
    fireEvent.click(await screen.findByRole('tab', { name: 'Histórico' }))

    expect((await screen.findByText('Cliente convertido.')).textContent).toBe('Cliente convertido.')
    expect(screen.getByText('Mensagem enviada.').textContent).toBe('Mensagem enviada.')
    expect(screen.getByText('Lead: Empresa A').textContent).toBe('Lead: Empresa A')
    const history = screen.getByRole('list', { name: 'Histórico do cliente' })
    expect(history.textContent?.indexOf('Cliente convertido.')).toBeLessThan(history.textContent?.indexOf('Mensagem enviada.') ?? -1)
  })

  it('arquiva com confirmação e preserva o contrato na tela', async () => {
    const archived = makeDetail({
      client: makeClient({ status: 'inactive', archived_at: '2026-11-25T12:00:00Z' }),
    })
    getClient.mockResolvedValueOnce(detail).mockResolvedValueOnce(archived)
    archiveClient.mockResolvedValue(archived.client)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Arquivar cliente' }))
    expect(archiveClient).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar arquivamento' }))
    await waitFor(() => expect(archiveClient).toHaveBeenCalledWith('client-1'))
    await waitFor(() => expect(getClient).toHaveBeenCalledTimes(2))
    expect((await screen.findByText('Inativo')).textContent).toBe('Inativo')

    fireEvent.click(screen.getByRole('tab', { name: 'Financeiro' }))
    expect(screen.getByText('R$ 1.234,56').textContent).toBe('R$ 1.234,56')
  })

  it('não arquiva quando a confirmação é cancelada', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Arquivar cliente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog', { name: 'Arquivar cliente' })).toBeNull()
    expect(archiveClient).not.toHaveBeenCalled()
  })

  it('passa o contrato exibido ao formulário de edição', async () => {
    updateClient.mockResolvedValue(detail.client)
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Editar cliente' }))
    fireEvent.change(screen.getByLabelText('Nome do cliente *'), { target: { value: 'Empresa Editada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cliente' }))

    await waitFor(() => expect(updateClient).toHaveBeenCalledWith('client-1', expect.objectContaining({
      contractId: 'contract-1',
      initialContract: expect.objectContaining({ service: 'Site', totalValueCents: 123456 }),
    })))
  })

  it('seleciona o contrato mais recente e edita somente o contrato escolhido', async () => {
    getClient.mockResolvedValue(makeDetail({
      contracts: [
        makeContract({ id: 'contract-1', service: 'Site', contracted_at: '2026-11-01' }),
        makeContract({ id: 'contract-2', service: 'Social media', total_value_cents: 50000, contracted_at: '2026-11-25' }),
      ],
    }))
    updateClient.mockResolvedValue(detail.client)
    renderPage()
    await screen.findByRole('heading', { name: 'Empresa A' })
    fireEvent.click(screen.getByRole('tab', { name: 'Financeiro' }))

    const selector = screen.getByLabelText('Contrato') as HTMLSelectElement
    expect(selector.value).toBe('contract-2')
    fireEvent.change(selector, { target: { value: 'contract-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Editar cliente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cliente' }))

    await waitFor(() => expect(updateClient).toHaveBeenCalledWith('client-1', expect.objectContaining({
      contractId: 'contract-1',
      initialContract: expect.objectContaining({ service: 'Site', totalValueCents: 123456 }),
    })))
  })

  it('preserva o contrato selecionado depois de atualizar o detalhe', async () => {
    const multiple = makeDetail({
      contracts: [
        makeContract({ id: 'contract-1', service: 'Site', contracted_at: '2026-11-01' }),
        makeContract({ id: 'contract-2', service: 'Social media', total_value_cents: 50000, contracted_at: '2026-11-25' }),
      ],
    })
    getClient.mockResolvedValue(multiple)
    renderPage()
    await screen.findByRole('heading', { name: 'Empresa A' })
    fireEvent.click(screen.getByRole('tab', { name: 'Financeiro' }))
    const selector = screen.getByLabelText('Contrato') as HTMLSelectElement
    fireEvent.change(selector, { target: { value: 'contract-1' } })

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    await waitFor(() => expect(getClient).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText('Atualizando…')).toBeNull())
    expect((screen.getByLabelText('Contrato') as HTMLSelectElement).value).toBe('contract-1')
  })

  it('desempata contratos pela id crescente quando as datas são iguais', async () => {
    getClient.mockResolvedValue(makeDetail({
      contracts: [
        makeContract({ id: 'contract-b', service: 'Contrato B', contracted_at: '2026-11-25' }),
        makeContract({ id: 'contract-a', service: 'Contrato A', contracted_at: '2026-11-25' }),
      ],
    }))
    renderPage()
    await screen.findByRole('heading', { name: 'Empresa A' })
    fireEvent.click(screen.getByRole('tab', { name: 'Financeiro' }))
    expect((screen.getByLabelText('Contrato') as HTMLSelectElement).value).toBe('contract-a')
  })

  it('bloqueia edição sem contrato e explica a ausência', async () => {
    getClient.mockResolvedValue(makeDetail({ contracts: [] }))
    renderPage()
    await screen.findByRole('heading', { name: 'Empresa A' })

    expect((screen.getByRole('button', { name: 'Editar cliente' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('tab', { name: 'Financeiro' }))
    expect(screen.getByText('Nenhum contrato cadastrado.').textContent).toBe('Nenhum contrato cadastrado.')
    expect(screen.queryByRole('button', { name: 'Salvar cliente' })).toBeNull()
  })

  it('mostra projetos básicos sem antecipar a rota do Plano 2', async () => {
    getClient.mockResolvedValue(makeDetail({ projects: [makeProject()] }))
    renderPage()
    await screen.findByRole('heading', { name: 'Empresa A' })
    fireEvent.click(screen.getByRole('tab', { name: 'Projetos' }))

    expect(screen.getByText('Site institucional').textContent).toBe('Site institucional')
    expect(screen.getByText('Em revisão').textContent).toBe('Em revisão')
    expect(screen.getByText('R$ 1.234,56').textContent).toBe('R$ 1.234,56')
    expect(screen.queryByRole('link', { name: 'Site institucional' })).toBeNull()
    expect(screen.queryByText(/\/projetos\//)).toBeNull()
  })

  it('preserva o último detalhe válido quando o refresh falha', async () => {
    getClient.mockResolvedValueOnce(detail)
      .mockRejectedValueOnce(new Error('Falha ao atualizar.'))
      .mockResolvedValueOnce(detail)
    renderPage()
    await screen.findByRole('heading', { name: 'Empresa A' })

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Falha ao atualizar.')
    expect(screen.getByRole('heading', { name: 'Empresa A' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Financeiro' }))
    expect(screen.getByText('R$ 1.234,56')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('descarta respostas obsoletas de dois refreshes', async () => {
    const first = deferredDetail()
    const second = deferredDetail()
    getClient.mockResolvedValueOnce(detail)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    renderPage()
    await screen.findByRole('heading', { name: 'Empresa A' })

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    await waitFor(() => expect(getClient).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    await waitFor(() => expect(getClient).toHaveBeenCalledTimes(3))

    await act(async () => {
      second.resolve(makeDetail({ client: makeClient({ name: 'Empresa Nova' }) }))
      await second.promise
    })
    expect((await screen.findByRole('heading', { name: 'Empresa Nova' })).textContent).toBe('Empresa Nova')

    await act(async () => {
      first.resolve(detail)
      await first.promise
    })
    expect(screen.getByRole('heading', { name: 'Empresa Nova' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Empresa A' })).toBeNull()
  })

  it('não atualiza estado depois do unmount', async () => {
    const pending = deferredDetail()
    getClient.mockReturnValue(pending.promise)
    const { unmount } = renderPage()
    await waitFor(() => expect(getClient).toHaveBeenCalledTimes(1))
    unmount()
    stateUpdates.mockClear()

    await act(async () => {
      pending.resolve(detail)
      await pending.promise
    })
    expect(stateUpdates).not.toHaveBeenCalled()
  })

  it('mostra cliente não encontrado e link para a lista', async () => {
    getClient.mockResolvedValue(null)
    renderPage()

    expect((await screen.findByRole('heading', { name: 'Cliente não encontrado.' })).textContent)
      .toBe('Cliente não encontrado.')
    expect(screen.getByRole('link', { name: 'Voltar para clientes' }).getAttribute('href')).toBe('/clientes')
  })
})
