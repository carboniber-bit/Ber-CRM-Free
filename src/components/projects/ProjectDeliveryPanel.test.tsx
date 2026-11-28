// @vitest-environment jsdom
// src/components/projects/ProjectDeliveryPanel.test.tsx
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useLayoutEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '../../types/project'

const { deliverProject } = vi.hoisted(() => ({ deliverProject: vi.fn() }))
const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('../../services/projectService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/projectService')>()
  return { ...actual, deliverProject }
})
vi.mock('../../hooks/useToast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useToast')>()
  return { ...actual, useToast: () => ({ toast }) }
})

import { ProjectDeliveryPanel } from './ProjectDeliveryPanel'

const project: Project = {
  id: 'p1', owner_id: 'owner-1', client_id: 'client-1', contract_id: 'contract-1',
  source_link_id: null, name: 'Site', service: 'Site', contracted_value_cents: 100000,
  description: null, start_date: null, due_date: null, responsible_name: null,
  priority: 'high', status: 'completed', completed_at: '2026-11-25T12:00:00Z', delivered_at: null,
  delivery_confirmed_at: null, delivery_url: null, files_url: null, final_notes: null,
  archived_at: null, created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
}

afterEach(cleanup)

describe('ProjectDeliveryPanel', () => {
  beforeEach(() => {
    deliverProject.mockReset()
    toast.mockReset()
  })

  it('exige link de entrega e confirmação explícita', async () => {
    const onDelivered = vi.fn()
    render(<ProjectDeliveryPanel project={project} onDelivered={onDelivered} />)
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    expect((await screen.findByText('Informe o link de entrega.')).textContent).toBe('Informe o link de entrega.')
    expect(deliverProject).not.toHaveBeenCalled()
  })

  it('envia links, notas e confirmação somente após ConfirmDialog', async () => {
    const delivered = {
      ...project, status: 'delivered' as const, delivered_at: '2026-11-26T12:00:00Z',
      delivery_confirmed_at: '2026-11-26T12:00:00Z', delivery_url: 'https://example.test/entrega',
      files_url: 'https://example.test/arquivos', final_notes: 'Concluído',
    }
    deliverProject.mockResolvedValue(delivered)
    const onDelivered = vi.fn()
    render(<ProjectDeliveryPanel project={project} onDelivered={onDelivered} />)
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega' } })
    fireEvent.change(screen.getByLabelText('Link dos arquivos'), { target: { value: 'https://example.test/arquivos' } })
    fireEvent.change(screen.getByLabelText('Notas finais'), { target: { value: 'Concluído' } })
    fireEvent.click(screen.getByLabelText('Entrega confirmada com o cliente'))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    expect(deliverProject).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog').textContent).toMatch(/Confirmar entrega/)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
    await waitFor(() => expect(onDelivered).toHaveBeenCalledWith(delivered))
    expect(deliverProject).toHaveBeenCalledWith('p1', {
      deliveryUrl: 'https://example.test/entrega', filesUrl: 'https://example.test/arquivos',
      finalNotes: 'Concluído', confirmed: true,
    })
    expect(screen.getByRole('link', { name: 'Abrir entrega' }).getAttribute('href')).toBe('https://example.test/entrega')
    expect(screen.getByRole('link', { name: 'Abrir arquivos' }).getAttribute('href')).toBe('https://example.test/arquivos')
    expect(screen.queryByRole('button', { name: 'Registrar entrega' })).toBeNull()
  })

  it.each([
    'javascript:alert(1)',
    'ftp://example.test/arquivo',
    'https://example.test/com espaco',
    ' https://example.test/entrega',
  ])('rejeita link de entrega inválido: %s', async (value) => {
    render(<ProjectDeliveryPanel project={project} onDelivered={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    expect((await screen.findByText('Informe uma URL HTTP(S) válida.')).textContent).toBe('Informe uma URL HTTP(S) válida.')
    expect(deliverProject).not.toHaveBeenCalled()
  })

  it('rejeita link de arquivos com espaço', async () => {
    render(<ProjectDeliveryPanel project={project} onDelivered={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega' } })
    fireEvent.change(screen.getByLabelText('Link dos arquivos'), { target: { value: 'https://example.test/com espaco' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    expect((await screen.findByText('Informe uma URL HTTP(S) válida.')).textContent).toBe('Informe uma URL HTTP(S) válida.')
    expect(deliverProject).not.toHaveBeenCalled()
  })

  it('preserva whitespace inicial em input de URL até a validação explícita', async () => {
    render(<ProjectDeliveryPanel project={project} onDelivered={vi.fn()} />)
    const input = screen.getByLabelText('Link de entrega *') as HTMLInputElement
    expect(input.type).toBe('text')
    expect(input.inputMode).toBe('url')
    fireEvent.change(input, { target: { value: ' https://example.test/entrega' } })
    expect(input.value).toBe(' https://example.test/entrega')
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    expect((await screen.findByText('Informe uma URL HTTP(S) válida.')).textContent).toBe('Informe uma URL HTTP(S) válida.')
    expect(deliverProject).not.toHaveBeenCalled()
  })

  it('preserva whitespace inicial no input de arquivos até a validação explícita', async () => {
    render(<ProjectDeliveryPanel project={project} onDelivered={vi.fn()} />)
    const input = screen.getByLabelText('Link dos arquivos') as HTMLInputElement
    expect(input.type).toBe('text')
    expect(input.inputMode).toBe('url')
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega' } })
    fireEvent.change(input, { target: { value: ' https://example.test/arquivos' } })
    expect(input.value).toBe(' https://example.test/arquivos')
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    expect((await screen.findByText('Informe uma URL HTTP(S) válida.')).textContent).toBe('Informe uma URL HTTP(S) válida.')
    expect(deliverProject).not.toHaveBeenCalled()
  })

  it('não permite entregar projeto cancelado', () => {
    render(<ProjectDeliveryPanel project={{ ...project, status: 'cancelled' }} onDelivered={vi.fn()} />)
    expect(screen.getByText(/Entrega indisponível/).textContent).toMatch(/Entrega indisponível/)
    expect(screen.queryByRole('button', { name: 'Registrar entrega' })).toBeNull()
    expect(deliverProject).not.toHaveBeenCalled()
  })

  it('exibe entrega persistida sem formulário ou seletor de status', () => {
    render(<ProjectDeliveryPanel project={{
      ...project, status: 'delivered', delivered_at: '2026-11-26T12:00:00Z',
      delivery_url: 'https://example.test/entrega', files_url: null, final_notes: 'Concluído',
    }} onDelivered={vi.fn()} />)
    expect(screen.getByRole('link', { name: 'Abrir entrega' })).toBeTruthy()
    expect(screen.getByText('Concluído').textContent).toBe('Concluído')
    expect(screen.queryByRole('button', { name: 'Registrar entrega' })).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('não confirma entrega anterior no primeiro commit da troca de projeto', () => {
    deliverProject.mockResolvedValue({
      ...project, status: 'delivered', delivered_at: '2026-11-26T12:00:00Z',
      delivery_url: 'https://example.test/entrega',
    })
    const onDelivered = vi.fn()
    const { rerender } = render(<SwitchProbe project={project} onDelivered={onDelivered} />)
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega' } })
    fireEvent.click(screen.getByLabelText('Entrega confirmada com o cliente'))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    expect(screen.getByRole('dialog').textContent).toMatch(/Confirmar entrega/)

    rerender(<SwitchProbe project={{ ...project, id: 'p2', name: 'Outro projeto' }} onDelivered={onDelivered} />)

    expect(deliverProject).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Abrir entrega' })).toBeNull()
  })

  it('confirma o snapshot validado mesmo se o rascunho mudar com o diálogo aberto', async () => {
    const delivered = {
      ...project, status: 'delivered' as const, delivered_at: '2026-11-26T12:00:00Z',
      delivery_url: 'https://example.test/entrega', files_url: 'https://example.test/arquivos',
      final_notes: 'Notas validadas',
    }
    deliverProject.mockResolvedValue(delivered)
    const onDelivered = vi.fn()
    render(<ProjectDeliveryPanel project={project} onDelivered={onDelivered} />)
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega' } })
    fireEvent.change(screen.getByLabelText('Link dos arquivos'), { target: { value: 'https://example.test/arquivos' } })
    fireEvent.change(screen.getByLabelText('Notas finais'), { target: { value: 'Notas validadas' } })
    fireEvent.click(screen.getByLabelText('Entrega confirmada com o cliente'))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))

    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/alterado' } })
    fireEvent.change(screen.getByLabelText('Notas finais'), { target: { value: 'Notas alteradas' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))

    await waitFor(() => expect(onDelivered).toHaveBeenCalledWith(delivered))
    expect(deliverProject).toHaveBeenCalledWith('p1', {
      deliveryUrl: 'https://example.test/entrega', filesUrl: 'https://example.test/arquivos',
      finalNotes: 'Notas validadas', confirmed: true,
    })
  })

  it('mantém a guarda global de saving bloqueada até a entrega anterior terminar', async () => {
    const pending = deferred<Project>()
    const deliveredP2 = {
      ...project, id: 'p2', status: 'delivered' as const, delivered_at: '2026-11-26T12:00:00Z',
      delivery_url: 'https://example.test/entrega-p2',
    }
    deliverProject.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(deliveredP2)
    const onDelivered = vi.fn()
    const { rerender } = render(<ProjectDeliveryPanel project={project} onDelivered={onDelivered} />)
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega-p1' } })
    fireEvent.click(screen.getByLabelText('Entrega confirmada com o cliente'))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar entrega' }))
    await waitFor(() => expect(deliverProject).toHaveBeenCalledTimes(1))

    rerender(<ProjectDeliveryPanel project={{ ...project, id: 'p2', name: 'Outro projeto' }} onDelivered={onDelivered} />)
    const submitP2 = screen.getByRole('button', { name: /Registrar entrega/ }) as HTMLButtonElement
    expect(submitP2.disabled).toBe(true)
    fireEvent.click(submitP2)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(deliverProject).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve({
        ...project, status: 'delivered', delivered_at: '2026-11-26T12:00:00Z',
        delivery_url: 'https://example.test/entrega-p1',
      })
      await pending.promise
    })
    await waitFor(() => expect(submitP2.disabled).toBe(false))

    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega-p2' } })
    fireEvent.click(screen.getByLabelText('Entrega confirmada com o cliente'))
    fireEvent.click(submitP2)
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar entrega' }))
    await waitFor(() => expect(deliverProject).toHaveBeenCalledTimes(2))
    expect(deliverProject).toHaveBeenLastCalledWith('p2', {
      deliveryUrl: 'https://example.test/entrega-p2', filesUrl: '', finalNotes: '', confirmed: true,
    })
  })

  it('descarta entrega do projeto anterior e fecha a confirmação após a troca', async () => {
    const pending = deferred<Project>()
    deliverProject.mockReturnValueOnce(pending.promise)
    const onDelivered = vi.fn()
    const { rerender } = render(<ProjectDeliveryPanel project={project} onDelivered={onDelivered} />)
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega' } })
    fireEvent.click(screen.getByLabelText('Entrega confirmada com o cliente'))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar entrega' }))
    await waitFor(() => expect(deliverProject).toHaveBeenCalledWith('p1', expect.any(Object)))
    rerender(<ProjectDeliveryPanel project={{ ...project, id: 'p2', name: 'Outro projeto' }} onDelivered={onDelivered} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    await act(async () => {
      pending.resolve({ ...project, status: 'delivered', delivered_at: '2026-11-26T12:00:00Z', delivery_url: 'https://example.test/entrega' })
      await pending.promise
    })
    expect(onDelivered).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: 'Abrir entrega' })).toBeNull()
  })

  it('descarta erro de entrega anterior após a troca de projeto', async () => {
    const pending = deferred<Project>()
    deliverProject.mockReturnValueOnce(pending.promise)
    const onDelivered = vi.fn()
    const { rerender } = render(<ProjectDeliveryPanel project={project} onDelivered={onDelivered} />)
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega-p1' } })
    fireEvent.click(screen.getByLabelText('Entrega confirmada com o cliente'))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar entrega' }))
    await waitFor(() => expect(deliverProject).toHaveBeenCalledTimes(1))

    rerender(<ProjectDeliveryPanel project={{ ...project, id: 'p2', name: 'Outro projeto' }} onDelivered={onDelivered} />)
    await act(async () => {
      pending.reject(new Error('Falha na entrega anterior.'))
      await pending.promise.catch(() => undefined)
    })

    expect(toast).not.toHaveBeenCalled()
    expect(onDelivered).not.toHaveBeenCalled()
    expect(screen.queryByText('Falha na entrega anterior.')).toBeNull()
    expect((screen.getByRole('button', { name: 'Registrar entrega' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('libera a guarda global após rejeição e permite entregar o projeto atual', async () => {
    const pending = deferred<Project>()
    const deliveredP2 = {
      ...project, id: 'p2', status: 'delivered' as const, delivered_at: '2026-11-26T12:00:00Z',
      delivery_url: 'https://example.test/entrega-p2',
    }
    deliverProject.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(deliveredP2)
    const onDelivered = vi.fn()
    const { rerender } = render(<ProjectDeliveryPanel project={project} onDelivered={onDelivered} />)
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega-p1' } })
    fireEvent.click(screen.getByLabelText('Entrega confirmada com o cliente'))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar entrega' }))
    await waitFor(() => expect(deliverProject).toHaveBeenCalledTimes(1))

    rerender(<ProjectDeliveryPanel project={{ ...project, id: 'p2', name: 'Outro projeto' }} onDelivered={onDelivered} />)
    expect((screen.getByRole('button', { name: /Registrar entrega/ }) as HTMLButtonElement).disabled).toBe(true)
    await act(async () => {
      pending.reject(new Error('Falha na entrega anterior.'))
      await pending.promise.catch(() => undefined)
    })
    await waitFor(() => expect((screen.getByRole('button', { name: 'Registrar entrega' }) as HTMLButtonElement).disabled).toBe(false))

    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega-p2' } })
    fireEvent.click(screen.getByLabelText('Entrega confirmada com o cliente'))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar entrega' }))
    await waitFor(() => expect(deliverProject).toHaveBeenCalledTimes(2))
    expect(deliverProject).toHaveBeenLastCalledWith('p2', {
      deliveryUrl: 'https://example.test/entrega-p2', filesUrl: '', finalNotes: '', confirmed: true,
    })
  })

  it.each(['resolve', 'reject'] as const)('descarta resposta de entrega após desmontagem: %s', async (outcome) => {
    const pending = deferred<Project>()
    deliverProject.mockReturnValueOnce(pending.promise)
    const onDelivered = vi.fn()
    const { unmount } = render(<ProjectDeliveryPanel project={project} onDelivered={onDelivered} />)
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega' } })
    fireEvent.click(screen.getByLabelText('Entrega confirmada com o cliente'))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar entrega' }))
    await waitFor(() => expect(deliverProject).toHaveBeenCalledTimes(1))
    unmount()
    render(<ProjectDeliveryPanel project={{ ...project, id: 'p2' }} onDelivered={onDelivered} />)
    expect((screen.getByRole('button', { name: 'Registrar entrega' }) as HTMLButtonElement).disabled).toBe(false)

    await act(async () => {
      if (outcome === 'resolve') {
        pending.resolve({
          ...project, status: 'delivered', delivered_at: '2026-11-26T12:00:00Z',
          delivery_url: 'https://example.test/entrega',
        })
        await pending.promise
      } else {
        pending.reject(new Error('Falha após desmontagem.'))
        await pending.promise.catch(() => undefined)
      }
    })

    expect(toast).not.toHaveBeenCalled()
    expect(onDelivered).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Registrar entrega' }) as HTMLButtonElement).disabled).toBe(false)
  })
})

function SwitchProbe({ project: currentProject, onDelivered }: {
  project: Project
  onDelivered: (project: Project) => void
}) {
  useLayoutEffect(() => {
    if (currentProject.id !== 'p2') return
    screen.queryByRole('button', { name: 'Confirmar entrega' })?.click()
  }, [currentProject.id])
  return <ProjectDeliveryPanel project={currentProject} onDelivered={onDelivered} />
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
