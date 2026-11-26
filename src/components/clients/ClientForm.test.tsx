// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Client } from '../../types/client'
import type { Contract } from '../../types/contract'
import { ClientForm } from './ClientForm'
import { ClientNewPage } from '../../pages/ClientNewPage'

const { createClient, updateClient, findClientDuplicateCandidates, toast } = vi.hoisted(() => ({
  createClient: vi.fn(),
  updateClient: vi.fn(),
  findClientDuplicateCandidates: vi.fn(),
  toast: vi.fn(),
}))
vi.mock('../../services/clientService', () => ({
  createClient, updateClient, findClientDuplicateCandidates,
}))
vi.mock('../../hooks/useToast', () => ({ useToast: () => ({ toast }) }))

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    owner_id: 'owner-1',
    creation_key: '00000000-0000-4000-8000-000000000001',
    name: 'Empresa Nova',
    responsible_name: null,
    phone: null,
    whatsapp: null,
    email: null,
    cnpj: null,
    cnpj_digits: null,
    phone_canonical: null,
    whatsapp_canonical: null,
    website: null,
    instagram: null,
    address: null,
    city: null,
    district: null,
    zip_code: null,
    state: null,
    niche: null,
    notes: null,
    status: 'active',
    source: 'manual',
    converted_at: null,
    archived_at: null,
    created_at: '2026-11-25T12:00:00Z',
    updated_at: '2026-11-25T12:00:00Z',
    ...overrides,
  }
}

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 'contract-1',
    owner_id: 'owner-1',
    client_id: 'client-1',
    source_link_id: null,
    creation_key: null,
    service: 'Site',
    total_value_cents: 100000,
    contracted_at: '2026-11-20',
    due_date: '2026-12-01',
    payment_method: 'pix',
    payment_terms: '50% na assinatura',
    status: 'active',
    notes: 'Observações do contrato',
    cancelled_at: null,
    created_at: '2026-11-20T12:00:00Z',
    updated_at: '2026-11-20T12:00:00Z',
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Nome do cliente *'), { target: { value: 'Empresa Nova' } })
  fireEvent.change(screen.getByLabelText('Serviço contratado *'), { target: { value: 'Site' } })
  fireEvent.change(screen.getByLabelText('Valor contratado *'), { target: { value: '1.234,56' } })
  fireEvent.change(screen.getByLabelText('Data da contratação *'), { target: { value: '2026-11-25' } })
}

function ClientDestination() {
  const { id } = useParams<{ id: string }>()
  return <h1>Cliente {id}</h1>
}

function renderNewPage() {
  return render(
    <MemoryRouter initialEntries={['/clientes/novo']}>
      <Routes>
        <Route path="/clientes/novo" element={<ClientNewPage />} />
        <Route path="/clientes" element={<h1>Lista de clientes</h1>} />
        <Route path="/clientes/:id" element={<ClientDestination />} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ClientForm', () => {
  beforeEach(() => {
    createClient.mockReset()
    updateClient.mockReset()
    findClientDuplicateCandidates.mockReset().mockResolvedValue([])
    toast.mockReset()
  })

  it('exige nome, serviço, valor e data da contratação', async () => {
    render(<ClientForm mode="create" onCancel={vi.fn()} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
    expect((await screen.findByText('Nome do cliente é obrigatório.')).textContent).toBe('Nome do cliente é obrigatório.')
    expect(screen.getByText('Informe o serviço contratado.').textContent).toBe('Informe o serviço contratado.')
    expect(screen.getByText('Informe um valor válido.').textContent).toBe('Informe um valor válido.')
    expect(screen.getByText('Informe a data da contratação.').textContent).toBe('Informe a data da contratação.')
    expect(createClient).not.toHaveBeenCalled()
    expect(findClientDuplicateCandidates).not.toHaveBeenCalled()
  })

  it('rejeita valor negativo e vencimento anterior à contratação', async () => {
    render(<ClientForm mode="create" onCancel={vi.fn()} onSaved={vi.fn()} />)
    fillValidForm()
    fireEvent.change(screen.getByLabelText('Valor contratado *'), { target: { value: '-1,00' } })
    fireEvent.change(screen.getByLabelText('Vencimento do contrato'), { target: { value: '2026-11-24' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))

    expect((await screen.findByText('Informe um valor válido.')).textContent).toBe('Informe um valor válido.')
    expect(screen.getByText('O vencimento não pode anteceder a contratação.').textContent)
      .toBe('O vencimento não pode anteceder a contratação.')
    expect(findClientDuplicateCandidates).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('bloqueia CNPJ duplicado e informa o cliente existente', async () => {
    findClientDuplicateCandidates.mockResolvedValue([
      makeClient({ id: 'existing', name: 'Empresa Existente', cnpj: '12.345.678/0001-95' }),
    ])
    const onSaved = vi.fn()
    render(<ClientForm mode="create" onCancel={vi.fn()} onSaved={onSaved} />)
    fillValidForm()
    fireEvent.change(screen.getByLabelText('CNPJ'), { target: { value: '12.345.678/0001-95' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))

    expect((await screen.findByText('Já existe um cliente com este CNPJ: Empresa Existente.')).textContent)
      .toBe('Já existe um cliente com este CNPJ: Empresa Existente.')
    expect(createClient).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(findClientDuplicateCandidates).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Empresa Nova', cnpj: '12.345.678/0001-95',
    }), undefined)
  })

  it('mantém a mesma creation_key e os dados após falha e permite nova tentativa', async () => {
    const saved = makeClient()
    createClient.mockRejectedValueOnce(new Error('Falha temporária.')).mockResolvedValueOnce(saved)
    const onSaved = vi.fn()
    render(<ClientForm mode="create" onCancel={vi.fn()} onSaved={onSaved} />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))

    expect((await screen.findByText('Falha temporária.')).textContent).toBe('Falha temporária.')
    expect((screen.getByLabelText('Nome do cliente *') as HTMLInputElement).value).toBe('Empresa Nova')
    expect((screen.getByLabelText('Valor contratado *') as HTMLInputElement).value).toBe('1.234,56')
    expect((screen.getByLabelText('Data da contratação *') as HTMLInputElement).value).toBe('2026-11-25')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved))
    expect(createClient).toHaveBeenCalledTimes(2)
    expect(createClient.mock.calls[0][0].creationKey).toBe(createClient.mock.calls[1][0].creationKey)
    expect(createClient.mock.calls[0][0].creationKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('edita com contractId explícito, initialContract completo e total readOnly', async () => {
    const client = makeClient({ name: 'Empresa A' })
    const contract = makeContract()
    const saved = makeClient({ name: 'Empresa Editada' })
    updateClient.mockResolvedValue(saved)
    const onSaved = vi.fn()
    render(<ClientForm mode="edit" client={client} contract={contract} onCancel={vi.fn()} onSaved={onSaved} />)

    const total = screen.getByLabelText('Valor contratado *') as HTMLInputElement
    expect(total.readOnly).toBe(true)
    expect(total.value).toBe('1000.00')
    fireEvent.change(screen.getByLabelText('Nome do cliente *'), { target: { value: 'Empresa Editada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cliente' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved))
    expect(updateClient).toHaveBeenCalledWith('client-1', expect.objectContaining({
      name: 'Empresa Editada',
      contractId: 'contract-1',
      initialContract: {
        service: 'Site',
        totalValueCents: 100000,
        contractedAt: '2026-11-20',
        dueDate: '2026-12-01',
        paymentMethod: 'pix',
        paymentTerms: '50% na assinatura',
        notes: 'Observações do contrato',
      },
    }))
    expect(createClient).not.toHaveBeenCalled()
  })

  it('exige revisão explícita antes de salvar outros possíveis duplicados', async () => {
    const candidate = makeClient({ id: 'existing', name: 'Empresa Parecida', phone: '(11) 99999-9999' })
    findClientDuplicateCandidates.mockResolvedValue([candidate])
    createClient.mockResolvedValue(makeClient())
    const onSaved = vi.fn()
    render(<ClientForm mode="create" onCancel={vi.fn()} onSaved={onSaved} />)
    fillValidForm()
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '(11) 99999-9999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))

    expect((await screen.findByText('Possível duplicidade: Empresa Parecida. Revise antes de continuar.')).textContent)
      .toBe('Possível duplicidade: Empresa Parecida. Revise antes de continuar.')
    expect(createClient).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
    expect(screen.getByText('Revise os possíveis duplicados e marque a confirmação para continuar.').textContent)
      .toBe('Revise os possíveis duplicados e marque a confirmação para continuar.')
    expect(createClient).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText('Revisei os possíveis duplicados e desejo continuar.'))
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(makeClient()))
    expect(findClientDuplicateCandidates).toHaveBeenCalledTimes(1)
    expect(createClient).toHaveBeenCalledTimes(1)
  })

  it('mostra falha da consulta e só salva após Continuar sem verificar', async () => {
    findClientDuplicateCandidates.mockRejectedValue(new Error('Falha de rede.'))
    createClient.mockResolvedValue(makeClient())
    const onSaved = vi.fn()
    render(<ClientForm mode="create" onCancel={vi.fn()} onSaved={onSaved} />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))

    expect((await screen.findByText('Não foi possível verificar duplicidades.')).textContent)
      .toBe('Não foi possível verificar duplicidades.')
    expect(createClient).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar sem verificar' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(makeClient()))
    expect(createClient).toHaveBeenCalledTimes(1)
  })

  it('valida e-mail, CNPJ e URLs com os helpers existentes', async () => {
    render(<ClientForm mode="create" onCancel={vi.fn()} onSaved={vi.fn()} />)
    fillValidForm()
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'email-invalido' } })
    fireEvent.change(screen.getByLabelText('CNPJ'), { target: { value: '123' } })
    fireEvent.change(screen.getByLabelText('Site (link)'), { target: { value: 'javascript:alert(1)' } })
    fireEvent.change(screen.getByLabelText('Instagram (link)'), { target: { value: 'ftp://exemplo.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))

    expect((await screen.findByText('E-mail inválido.')).textContent).toBe('E-mail inválido.')
    expect(screen.getByText('CNPJ deve ter 14 dígitos.').textContent).toBe('CNPJ deve ter 14 dígitos.')
    expect(screen.getAllByText('Informe uma URL válida (http://, https:// ou domínio).')).toHaveLength(2)
    expect(findClientDuplicateCandidates).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('normaliza URLs e monta CreateClientInput com totalValueCents somente no submit', async () => {
    createClient.mockResolvedValue(makeClient())
    const onSaved = vi.fn()
    render(<ClientForm mode="create" onCancel={vi.fn()} onSaved={onSaved} />)
    fillValidForm()
    fireEvent.change(screen.getByLabelText('Site (link)'), { target: { value: 'exemplo.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(makeClient()))

    expect(createClient).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Empresa Nova',
      website: 'https://exemplo.com',
      instagram: '',
      creationKey: expect.any(String),
      initialContract: {
        service: 'Site',
        totalValueCents: 123456,
        contractedAt: '2026-11-25',
        dueDate: null,
        paymentMethod: '',
        paymentTerms: '',
        notes: '',
      },
    }))
    expect(createClient.mock.calls[0][0]).toHaveProperty('initialContract.totalValueCents', 123456)
  })

  it('impede envio duplicado enquanto a consulta e a gravação estão pendentes', async () => {
    const duplicateQuery = deferred<Client[]>()
    const mutation = deferred<Client>()
    findClientDuplicateCandidates.mockReturnValue(duplicateQuery.promise)
    createClient.mockReturnValue(mutation.promise)
    const onSaved = vi.fn()
    render(<ClientForm mode="create" onCancel={vi.fn()} onSaved={onSaved} />)
    fillValidForm()
    const submit = screen.getByRole('button', { name: 'Cadastrar cliente' })
    fireEvent.click(submit)
    fireEvent.click(submit)
    await waitFor(() => expect(findClientDuplicateCandidates).toHaveBeenCalledTimes(1))

    await act(async () => {
      duplicateQuery.resolve([])
      await duplicateQuery.promise
    })
    await waitFor(() => expect(createClient).toHaveBeenCalledTimes(1))
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(submit)
    expect(createClient).toHaveBeenCalledTimes(1)

    await act(async () => {
      mutation.resolve(makeClient())
      await mutation.promise
    })
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  })

  it('descarta a consulta obsoleta quando outro cliente entra em edição', async () => {
    const duplicateQuery = deferred<Client[]>()
    findClientDuplicateCandidates.mockReturnValue(duplicateQuery.promise)
    const firstClient = makeClient({ id: 'client-1', name: 'Empresa A' })
    const secondClient = makeClient({ id: 'client-2', name: 'Empresa B' })
    const firstContract = makeContract({ id: 'contract-1', client_id: 'client-1' })
    const secondContract = makeContract({ id: 'contract-2', client_id: 'client-2' })
    const onSaved = vi.fn()
    const view = render(
      <ClientForm mode="edit" client={firstClient} contract={firstContract} onCancel={vi.fn()} onSaved={onSaved} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cliente' }))
    await waitFor(() => expect(findClientDuplicateCandidates).toHaveBeenCalledTimes(1))

    view.rerender(
      <ClientForm mode="edit" client={secondClient} contract={secondContract} onCancel={vi.fn()} onSaved={onSaved} />,
    )
    await act(async () => {
      duplicateQuery.resolve([])
      await duplicateQuery.promise
    })

    expect(updateClient).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect((screen.getByLabelText('Nome do cliente *') as HTMLInputElement).value).toBe('Empresa B')
  })

  it('descarta consulta de duplicados e gravação depois do unmount', async () => {
    const duplicateQuery = deferred<Client[]>()
    findClientDuplicateCandidates.mockReturnValue(duplicateQuery.promise)
    const first = render(<ClientForm mode="create" onCancel={vi.fn()} onSaved={vi.fn()} />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
    await waitFor(() => expect(findClientDuplicateCandidates).toHaveBeenCalledTimes(1))
    first.unmount()
    await act(async () => {
      duplicateQuery.resolve([])
      await duplicateQuery.promise
    })
    expect(createClient).not.toHaveBeenCalled()

    const mutation = deferred<Client>()
    createClient.mockReturnValue(mutation.promise)
    const onSaved = vi.fn()
    const second = render(<ClientForm mode="create" onCancel={vi.fn()} onSaved={onSaved} />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
    await waitFor(() => expect(createClient).toHaveBeenCalledTimes(1))
    second.unmount()
    await act(async () => {
      mutation.resolve(makeClient())
      await mutation.promise
    })
    expect(onSaved).not.toHaveBeenCalled()
  })
})

describe('ClientNewPage', () => {
  beforeEach(() => {
    createClient.mockReset().mockResolvedValue(makeClient())
    updateClient.mockReset()
    findClientDuplicateCandidates.mockReset().mockResolvedValue([])
    toast.mockReset()
  })

  it('volta para a lista ao cancelar', async () => {
    renderNewPage()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect((await screen.findByRole('heading', { name: 'Lista de clientes' })).textContent)
      .toBe('Lista de clientes')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('navega para /clientes/:id e mostra toast após o cadastro', async () => {
    renderNewPage()
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))

    expect((await screen.findByRole('heading', { name: 'Cliente client-1' })).textContent)
      .toBe('Cliente client-1')
    expect(toast).toHaveBeenCalledWith('Cliente cadastrado.')
  })
})
