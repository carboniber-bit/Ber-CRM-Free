// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientHistoryEntry } from '../../types/client'

const { getClient, updateClient, archiveClient } = vi.hoisted(() => ({
  getClient: vi.fn(),
  updateClient: vi.fn(),
  archiveClient: vi.fn(),
}))
vi.mock('../../services/clientService', () => ({ getClient, updateClient, archiveClient }))

import { ClientHistory } from './ClientHistory'

const entries: ClientHistoryEntry[] = [
  { id: 'lead-1', type: 'mensagem', description: 'Mensagem enviada.', created_at: '2026-11-21T10:00:00Z', source: 'lead', leadName: 'Empresa A' },
  { id: 'client-1', type: 'conversion', description: 'Cliente convertido.', created_at: '2026-11-22T10:00:00Z', source: 'client' },
]

afterEach(() => {
  cleanup()
  expect(getClient).not.toHaveBeenCalled()
  expect(updateClient).not.toHaveBeenCalled()
  expect(archiveClient).not.toHaveBeenCalled()
})

beforeEach(() => {
  getClient.mockReset()
  updateClient.mockReset()
  archiveClient.mockReset()
})

describe('ClientHistory', () => {
  it('ordena uma cópia dos eventos e identifica a origem sem gravar atividades', () => {
    const snapshot = entries.map((entry) => ({ ...entry }))
    render(<ClientHistory entries={entries} />)

    const list = screen.getByRole('list', { name: 'Histórico do cliente' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain('Cliente convertido.')
    expect(items[0].textContent).toContain('Cliente')
    expect(items[1].textContent).toContain('Mensagem enviada.')
    expect(items[1].textContent).toContain('Lead: Empresa A')
    expect(entries).toEqual(snapshot)
  })

  it('exibe um estado vazio sem inventar eventos', () => {
    render(<ClientHistory entries={[]} />)
    expect(screen.getByText('Nenhum evento registrado.').textContent).toBe('Nenhum evento registrado.')
    expect(screen.queryByRole('list')).toBeNull()
  })
})
