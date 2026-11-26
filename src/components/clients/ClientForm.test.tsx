// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Client } from '../../types/client'
import type { Contract } from '../../types/contract'
import { ClientForm } from './ClientForm'
import { ClientNewPage } from '../../pages/ClientNewPage'

const { createClient, updateClient, findClientDuplicateCandidates, toast, useAuth } = vi.hoisted(() => ({
  createClient: vi.fn(),
  updateClient: vi.fn(),
  findClientDuplicateCandidates: vi.fn(),
  toast: vi.fn(),
  useAuth: vi.fn(),
}))
vi.mock('../../services/clientService', () => ({
  createClient, updateClient, findClientDuplicateCandidates,
}))
vi.mock('../../hooks/useToast', () => ({ useToast: () => ({ toast }) }))
vi.mock('../../hooks/useAuth', () => ({ useAuth }))

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

function fillCompleteForm() {
  const fields = [
    ['Nome do cliente *', 'Empresa Nova'],
    ['Nome do responsável', 'Ana Responsável'],
    ['Telefone', '(11) 99999-9999'],
    ['WhatsApp', '(11) 98888-7777'],
    ['E-mail', 'ana@example.com'],
    ['CNPJ', '12.345.678/0001-95'],
    ['Site (link)', 'exemplo.com'],
    ['Instagram (link)', 'instagram.com/exemplo'],
    ['Endereço', 'Rua das Flores, 10'],
    ['Cidade', 'São Paulo'],
    ['Bairro', 'Centro'],
    ['CEP', '01001-000'],
    ['Estado', 'SP'],
    ['Nicho', 'Tecnologia'],
    ['Observações', 'Observação do cliente'],
    ['Serviço contratado *', 'Site institucional'],
    ['Valor contratado *', '1.234,56'],
    ['Data da contratação *', '2026-11-25'],
    ['Vencimento do contrato', '2026-12-01'],
    ['Forma de pagamento', 'Pix'],
    ['Condições de pagamento', '50% na assinatura'],
    ['Observações do contrato', 'Observação do contrato'],
  ] as const
  for (const [label, value] of fields) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'in_project' } })
}

function expectCompleteForm() {
  const fields = [
    ['Nome do cliente *', 'Empresa Nova'],
    ['Nome do responsável', 'Ana Responsável'],
    ['Telefone', '(11) 99999-9999'],
    ['WhatsApp', '(11) 98888-7777'],
    ['E-mail', 'ana@example.com'],
    ['CNPJ', '12.345.678/0001-95'],
    ['Site (link)', 'exemplo.com'],
    ['Instagram (link)', 'instagram.com/exemplo'],
    ['Endereço', 'Rua das Flores, 10'],
    ['Cidade', 'São Paulo'],
    ['Bairro', 'Centro'],
    ['CEP', '01001-000'],
    ['Estado', 'SP'],
    ['Nicho', 'Tecnologia'],
    ['Observações', 'Observação do cliente'],
    ['Serviço contratado *', 'Site institucional'],
    ['Valor contratado *', '1.234,56'],
    ['Data da contratação *', '2026-11-25'],
    ['Vencimento do contrato', '2026-12-01'],
    ['Forma de pagamento', 'Pix'],
    ['Condições de pagamento', '50% na assinatura'],
    ['Observações do contrato', 'Observação do contrato'],
  ] as const
  for (const [label, value] of fields) {
    expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe(value)
  }
  expect((screen.getByLabelText('Status') as HTMLSelectElement).value).toBe('in_project')
}

function draftKey(scope = 'owner-1') {
  return `ber-crm:client-draft:v1:${encodeURIComponent(scope)}`
}

function readDraft(scope = 'owner-1') {
  const raw = sessionStorage.getItem(draftKey(scope))
  expect(raw).not.toBeNull()
  return JSON.parse(raw as string) as {
    version: number
    creationKey: string
    clientDraft: Record<string, unknown>
    contractDraft: Record<string, unknown>
  }
}

function makePersistedDraft() {
  return {
    version: 1,
    creationKey: '00000000-0000-4000-8000-000000000001',
    clientDraft: {
      name: 'Rascunho salvo',
      responsible_name: 'Responsável',
      phone: '(11) 99999-9999',
      whatsapp: '(11) 98888-7777',
      email: 'salvo@example.com',
      cnpj: '12.345.678/0001-95',
      website: 'exemplo.com',
      instagram: 'instagram.com/exemplo',
      address: 'Rua salva, 10',
      city: 'São Paulo',
      district: 'Centro',
      zip_code: '01001-000',
      state: 'SP',
      niche: 'Tecnologia',
      notes: 'Observação salva',
      status: 'awaiting_payment',
    },
    contractDraft: {
      service: 'Site salvo',
      totalValue: '2.000,00',
      contractedAt: '2026-11-20',
      dueDate: '2026-12-20',
      paymentMethod: 'Pix',
      paymentTerms: 'À vista',
      notes: 'Contrato salvo',
    },
  }
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

beforeEach(() => {
  sessionStorage.clear()
  useAuth.mockReset().mockReturnValue({
    user: { id: 'owner-1' },
    session: null,
    loading: false,
    signOut: vi.fn(),
  })
})

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
    render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
    expect((await screen.findByText('Nome do cliente é obrigatório.')).textContent).toBe('Nome do cliente é obrigatório.')
    expect(screen.getByText('Informe o serviço contratado.').textContent).toBe('Informe o serviço contratado.')
    expect(screen.getByText('Informe um valor válido.').textContent).toBe('Informe um valor válido.')
    expect(screen.getByText('Informe a data da contratação.').textContent).toBe('Informe a data da contratação.')
    expect(createClient).not.toHaveBeenCalled()
    expect(findClientDuplicateCandidates).not.toHaveBeenCalled()
  })

  it('rejeita valor negativo e vencimento anterior à contratação', async () => {
    render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={vi.fn()} />)
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
    render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={onSaved} />)
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
    render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={onSaved} />)
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

  it('preserva a creation_key e restaura todos os campos após remount com resposta perdida', async () => {
    const firstMutation = deferred<Client>()
    const saved = makeClient({ id: 'client-saved', name: 'Empresa Nova' })
    createClient.mockReturnValueOnce(firstMutation.promise).mockResolvedValueOnce(saved)
    const firstOnSaved = vi.fn()
    const first = render(
      <ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={firstOnSaved} />,
    )
    fillCompleteForm()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
    await waitFor(() => expect(createClient).toHaveBeenCalledTimes(1))
    const firstCreationKey = createClient.mock.calls[0][0].creationKey as string
    const firstContract = createClient.mock.calls[0][0].initialContract

    first.unmount()
    await act(async () => {
      firstMutation.resolve(saved)
      await firstMutation.promise
    })
    expect(firstOnSaved).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(draftKey())).not.toBeNull()

    const secondOnSaved = vi.fn()
    render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={secondOnSaved} />)
    expectCompleteForm()
    expect(readDraft().creationKey).toBe(firstCreationKey)
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
    await waitFor(() => expect(secondOnSaved).toHaveBeenCalledWith(saved))

    expect(createClient).toHaveBeenCalledTimes(2)
    expect(createClient.mock.calls[1][0].creationKey).toBe(firstCreationKey)
    expect(createClient.mock.calls[1][0].initialContract).toEqual(firstContract)
    expect(sessionStorage.getItem(draftKey())).toBeNull()
  })

  it('isola rascunhos por draftScope e remonta o formulário quando o usuário muda', () => {
    const view = render(
      <ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={vi.fn()} />,
    )
    fireEvent.change(screen.getByLabelText('Nome do cliente *'), { target: { value: 'Cliente do owner 1' } })
    view.rerender(
      <ClientForm mode="create" draftScope="owner-2" onCancel={vi.fn()} onSaved={vi.fn()} />,
    )

    expect((screen.getByLabelText('Nome do cliente *') as HTMLInputElement).value).toBe('')
    const owner1Key = readDraft('owner-1').creationKey
    const owner2Key = readDraft('owner-2').creationKey
    expect(owner2Key).not.toBe(owner1Key)
    expect(readDraft('owner-1').clientDraft.name).toBe('Cliente do owner 1')

    view.rerender(
      <ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={vi.fn()} />,
    )
    expect((screen.getByLabelText('Nome do cliente *') as HTMLInputElement).value).toBe('Cliente do owner 1')
  })

  it('remove o rascunho no cancelamento e cria uma chave nova ao remontar', () => {
    const onCancel = vi.fn()
    const first = render(
      <ClientForm mode="create" draftScope="owner-1" onCancel={onCancel} onSaved={vi.fn()} />,
    )
    fillCompleteForm()
    const firstCreationKey = readDraft().creationKey
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(draftKey())).toBeNull()

    first.unmount()
    render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={vi.fn()} />)
    expect((screen.getByLabelText('Nome do cliente *') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Serviço contratado *') as HTMLInputElement).value).toBe('')
    expect(readDraft().creationKey).not.toBe(firstCreationKey)
  })

  it.each([
    ['JSON malformado', '{'],
    ['versão inválida', JSON.stringify({ ...makePersistedDraft(), version: 2 })],
    ['creationKey não UUID v4', JSON.stringify({ ...makePersistedDraft(), creationKey: 'chave-antiga' })],
    ['campo textual do cliente ausente', JSON.stringify({
      ...makePersistedDraft(),
      clientDraft: { ...makePersistedDraft().clientDraft, notes: undefined },
    })],
    ['campo textual do cliente não string', JSON.stringify({
      ...makePersistedDraft(),
      clientDraft: { ...makePersistedDraft().clientDraft, email: 42 },
    })],
    ['status inválido', JSON.stringify({
      ...makePersistedDraft(),
      clientDraft: { ...makePersistedDraft().clientDraft, status: 'desconhecido' },
    })],
    ['campo textual do contrato não string', JSON.stringify({
      ...makePersistedDraft(),
      contractDraft: { ...makePersistedDraft().contractDraft, totalValue: 123456 },
    })],
  ])('bloqueia cadastro com registro persistido inválido (%s) e permite limpar no cancelamento', async (_case, raw) => {
    sessionStorage.setItem(draftKey(), raw)
    const onCancel = vi.fn()
    render(<ClientForm mode="create" draftScope="owner-1" onCancel={onCancel} onSaved={vi.fn()} />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))

    expect((await screen.findByRole('alert')).textContent).toContain('O rascunho salvo neste navegador é inválido.')
    expect(findClientDuplicateCandidates).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(draftKey())).toBeNull()
  })

  it('bloqueia consulta e gravação quando sessionStorage.setItem falha', async () => {
    render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={vi.fn()} />)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota excedida', 'QuotaExceededError')
    })
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))

    expect((await screen.findByRole('alert')).textContent)
      .toContain('Não foi possível preservar o rascunho neste navegador.')
    expect(findClientDuplicateCandidates).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('bloqueia o cadastro quando a persistência inicial do rascunho falha', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota excedida', 'QuotaExceededError')
    })
    render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={vi.fn()} />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))

    expect((await screen.findByRole('alert')).textContent)
      .toContain('Não foi possível preservar o rascunho neste navegador.')
    expect(findClientDuplicateCandidates).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('bloqueia a gravação se a segunda persistência síncrona antes do create falhar', async () => {
    createClient.mockResolvedValue(makeClient())
    render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={vi.fn()} />)
    fillValidForm()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw new DOMException('Quota excedida', 'QuotaExceededError')
      })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))

    expect((await screen.findByRole('alert')).textContent)
      .toContain('Não foi possível preservar o rascunho neste navegador.')
    await waitFor(() => expect(findClientDuplicateCandidates).toHaveBeenCalledTimes(1))
    expect(setItem).toHaveBeenCalledTimes(2)
    expect(createClient).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Cadastrar cliente' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('restaura um registro válido previamente semeado sem regenerar a chave', async () => {
    const persisted = makePersistedDraft()
    sessionStorage.setItem(draftKey(), JSON.stringify(persisted))
    createClient.mockResolvedValue(makeClient())
    const onSaved = vi.fn()
    render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={onSaved} />)

    expect((screen.getByLabelText('Nome do cliente *') as HTMLInputElement).value).toBe('Rascunho salvo')
    expect((screen.getByLabelText('E-mail') as HTMLInputElement).value).toBe('salvo@example.com')
    expect((screen.getByLabelText('Status') as HTMLSelectElement).value).toBe('awaiting_payment')
    expect((screen.getByLabelText('Serviço contratado *') as HTMLInputElement).value).toBe('Site salvo')
    expect((screen.getByLabelText('Valor contratado *') as HTMLInputElement).value).toBe('2.000,00')
    expect((screen.getByLabelText('Vencimento do contrato') as HTMLInputElement).value).toBe('2026-12-20')
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(createClient).toHaveBeenCalledWith(expect.objectContaining({ creationKey: persisted.creationKey }))
  })

  it('bloqueia cadastro sem substituir registro quando sessionStorage.getItem falha', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Acesso negado', 'SecurityError')
    })
    render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={vi.fn()} />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))

    expect((await screen.findByRole('alert')).textContent)
      .toContain('Não foi possível preservar o rascunho neste navegador.')
    expect(findClientDuplicateCandidates).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('mantém o erro de armazenamento mesmo ao limpar feedback de duplicidade', async () => {
    findClientDuplicateCandidates.mockResolvedValue([
      makeClient({ id: 'existing', name: 'Empresa Parecida', phone: '(11) 99999-9999' }),
    ])
    render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={vi.fn()} />)
    fillValidForm()
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '(11) 99999-9999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
    expect(await screen.findByText('Possível duplicidade: Empresa Parecida. Revise antes de continuar.'))

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota excedida', 'QuotaExceededError')
    })
    fireEvent.change(screen.getByLabelText('Nome do cliente *'), { target: { value: 'Empresa Alterada' } })
    expect(screen.queryByText('Possível duplicidade: Empresa Parecida. Revise antes de continuar.')).toBeNull()
    expect(screen.getByRole('alert').textContent)
      .toContain('Não foi possível preservar o rascunho neste navegador.')
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
    expect(findClientDuplicateCandidates).toHaveBeenCalledTimes(1)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('persiste o schema v1 completo com o estado mais recente antes da consulta', async () => {
    createClient.mockResolvedValue(makeClient())
    const onSaved = vi.fn()
    render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={onSaved} />)
    const initial = readDraft()
    expect(initial.creationKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    fillCompleteForm()
    const latest = readDraft()
    expect(latest).toEqual({
      version: 1,
      creationKey: initial.creationKey,
      clientDraft: {
        name: 'Empresa Nova',
        responsible_name: 'Ana Responsável',
        phone: '(11) 99999-9999',
        whatsapp: '(11) 98888-7777',
        email: 'ana@example.com',
        cnpj: '12.345.678/0001-95',
        website: 'exemplo.com',
        instagram: 'instagram.com/exemplo',
        address: 'Rua das Flores, 10',
        city: 'São Paulo',
        district: 'Centro',
        zip_code: '01001-000',
        state: 'SP',
        niche: 'Tecnologia',
        notes: 'Observação do cliente',
        status: 'in_project',
      },
      contractDraft: {
        service: 'Site institucional',
        totalValue: '1.234,56',
        contractedAt: '2026-11-25',
        dueDate: '2026-12-01',
        paymentMethod: 'Pix',
        paymentTerms: '50% na assinatura',
        notes: 'Observação do contrato',
      },
    })
    findClientDuplicateCandidates.mockImplementation(async () => {
      expect(readDraft()).toEqual(latest)
      return []
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  })

  it('não acessa sessionStorage ao editar e salvar um cliente', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem')
    updateClient.mockResolvedValue(makeClient({ name: 'Empresa Editada' }))
    const onSaved = vi.fn()
    render(
      <ClientForm mode="edit" client={makeClient()} contract={makeContract()} onCancel={vi.fn()} onSaved={onSaved} />,
    )
    fireEvent.change(screen.getByLabelText('Nome do cliente *'), { target: { value: 'Empresa Editada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cliente' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(getItem).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
    expect(removeItem).not.toHaveBeenCalled()
  })

  it('navega com o cliente salvo e mantém a chave quando a remoção do rascunho falha', async () => {
    const saved = makeClient({ id: 'client-saved' })
    createClient.mockResolvedValue(saved)
    const onSaved = vi.fn()
    render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={onSaved} />)
    fillValidForm()
    const creationKey = readDraft().creationKey
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Falha ao remover', 'UnknownError')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved))
    expect(createClient).toHaveBeenCalledTimes(1)
    expect(readDraft().creationKey).toBe(creationKey)
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
    render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={onSaved} />)
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
    render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={onSaved} />)
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
    render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={vi.fn()} />)
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

  it.each([
    'a@b..com',
    '.a@example.com',
    'a.@example.com',
    'a@-example.com',
    'a@example-.com',
    'a@b.c',
    'a@@example.com',
    'a b@example.com',
    'a@exa_mple.com',
    'a@example.123',
    `${'a'.repeat(65)}@example.com`,
    `a@${'b'.repeat(64)}.com`,
    `${'a'.repeat(243)}@example.com`,
  ])('rejeita e-mail estruturalmente inválido (%s) sem consultar ou gravar', async (email) => {
    render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={vi.fn()} />)
    fillValidForm()
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: email } })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))

    expect((await screen.findByText('E-mail inválido.')).textContent).toBe('E-mail inválido.')
    expect(findClientDuplicateCandidates).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })

  it.each([
    '00000000000000',
    '11111111111111',
    '12.345.678/0001-96',
    '12.345.678/0001-95X',
  ])('rejeita CNPJ inválido (%s) sem consultar ou gravar', async (cnpj) => {
    render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={vi.fn()} />)
    fillValidForm()
    fireEvent.change(screen.getByLabelText('CNPJ'), { target: { value: cnpj } })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))

    expect((await screen.findByText('CNPJ inválido.')).textContent).toBe('CNPJ inválido.')
    expect(findClientDuplicateCandidates).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('envia CNPJ válido intacto quando não há duplicata', async () => {
    createClient.mockResolvedValue(makeClient())
    const onSaved = vi.fn()
    render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={onSaved} />)
    fillValidForm()
    fireEvent.change(screen.getByLabelText('CNPJ'), { target: { value: '12.345.678/0001-95' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(createClient).toHaveBeenCalledWith(expect.objectContaining({ cnpj: '12.345.678/0001-95' }))
  })

  it('normaliza URLs e monta CreateClientInput com totalValueCents somente no submit', async () => {
    createClient.mockResolvedValue(makeClient())
    const onSaved = vi.fn()
    render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={onSaved} />)
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
    render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={onSaved} />)
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

  it('descarta update obsoleto ao trocar o cliente editado antes de resolver', async () => {
    const mutation = deferred<Client>()
    updateClient.mockReturnValue(mutation.promise)
    const firstClient = makeClient({ id: 'client-1', name: 'Empresa A' })
    const secondClient = makeClient({ id: 'client-2', name: 'Empresa B' })
    const firstContract = makeContract({ id: 'contract-1', client_id: 'client-1' })
    const secondContract = makeContract({ id: 'contract-2', client_id: 'client-2' })
    const onSaved = vi.fn()
    const view = render(
      <ClientForm mode="edit" client={firstClient} contract={firstContract} onCancel={vi.fn()} onSaved={onSaved} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cliente' }))
    await waitFor(() => expect(updateClient).toHaveBeenCalledTimes(1))

    view.rerender(
      <ClientForm mode="edit" client={secondClient} contract={secondContract} onCancel={vi.fn()} onSaved={onSaved} />,
    )
    await act(async () => {
      mutation.resolve(makeClient({ id: 'client-1', name: 'Empresa A atualizada' }))
      await mutation.promise
    })

    expect(onSaved).not.toHaveBeenCalled()
    expect(updateClient).toHaveBeenCalledTimes(1)
    expect((screen.getByLabelText('Nome do cliente *') as HTMLInputElement).value).toBe('Empresa B')
  })

  it('descarta consulta de duplicados e gravação depois do unmount', async () => {
    const duplicateQuery = deferred<Client[]>()
    findClientDuplicateCandidates.mockReturnValue(duplicateQuery.promise)
    const first = render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={vi.fn()} />)
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
    const second = render(<ClientForm mode="create" draftScope="owner-1" onCancel={vi.fn()} onSaved={onSaved} />)
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

  it('mostra alerta e não renderiza o formulário quando o usuário está ausente', () => {
    useAuth.mockReturnValue({ user: null })
    renderNewPage()
    expect(screen.getByRole('alert').textContent).toContain('Não foi possível identificar o usuário.')
    expect(screen.queryByRole('button', { name: 'Cadastrar cliente' })).toBeNull()
    expect(screen.queryByLabelText('Nome do cliente *')).toBeNull()
    expect(createClient).not.toHaveBeenCalled()
    expect(findClientDuplicateCandidates).not.toHaveBeenCalled()
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
