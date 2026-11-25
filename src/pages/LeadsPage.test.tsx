// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listLeads } from '../services/leadService'
import { ToastContext } from '../hooks/useToast'
import { emptyLeadDraft, type Lead } from '../types/lead'
import { LeadsPage } from './LeadsPage'

vi.mock('../services/leadService', () => ({
  listLeads: vi.fn(),
  deleteLead: vi.fn(),
}))

const lead: Lead = {
  ...emptyLeadDraft(),
  id: '00000000-0000-0000-0000-000000000401',
  owner_id: '00000000-0000-0000-0000-000000000201',
  name: 'Estabelecimento de teste',
  score: 50,
  priority: 'media',
  needs: [],
  score_reasons: [],
  next_contact_at: null,
  last_verified_at: null,
  created_at: '2026-11-25T12:00:00.000Z',
  updated_at: '2026-11-25T12:00:00.000Z',
}

afterEach(cleanup)

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listLeads).mockResolvedValue({ leads: [lead], total: 1 })
})

describe('LeadsPage tabela responsiva', () => {
  it('mantém a rolagem horizontal da tabela sem o padding do Card', async () => {
    render(
      <ToastContext.Provider value={{ toast: vi.fn() }}>
        <MemoryRouter>
          <LeadsPage />
        </MemoryRouter>
      </ToastContext.Provider>,
    )

    const table = await screen.findByRole('table')
    const container = table.parentElement

    expect(container?.classList.contains('overflow-x-auto')).toBe(true)
    expect(container?.classList.contains('md:block')).toBe(true)
    expect(container?.classList.contains('p-5')).toBe(false)
  })
})
