// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastContext } from '../../hooks/useToast'
import { listByLead } from '../../services/followupService'
import type { Followup } from '../../types/followup'
import { LeadFollowups } from './LeadFollowups'

vi.mock('../../services/followupService', () => ({
  listByLead: vi.fn(),
  completeFollowup: vi.fn(),
  cancelFollowup: vi.fn(),
}))

const followup: Followup = {
  id: '00000000-0000-0000-0000-000000000301',
  lead_id: '00000000-0000-0000-0000-000000000101',
  owner_id: '00000000-0000-0000-0000-000000000201',
  due_at: '2026-11-25T12:00:00.000Z',
  reason: 'Retornar proposta',
  note: null,
  status: 'pendente',
  completed_at: null,
  result: null,
  created_at: '2026-11-24T12:00:00.000Z',
  updated_at: '2026-11-24T12:00:00.000Z',
}

const toast = vi.fn()

function renderSheet(leadName?: string) {
  return render(
    <ToastContext.Provider value={{ toast }}>
      <MemoryRouter>
        <LeadFollowups leadId={followup.lead_id} refreshKey={0} onChanged={vi.fn()} leadName={leadName} />
      </MemoryRouter>
    </ToastContext.Provider>,
  )
}

let consoleError: ReturnType<typeof vi.spyOn>
let consoleWarn: ReturnType<typeof vi.spyOn>

afterEach(() => {
  cleanup()
  expect(consoleError).not.toHaveBeenCalled()
  expect(consoleWarn).not.toHaveBeenCalled()
  consoleError.mockRestore()
  consoleWarn.mockRestore()
})

beforeEach(() => {
  vi.clearAllMocks()
  consoleError = vi.spyOn(console, 'error')
  consoleWarn = vi.spyOn(console, 'warn')
  vi.mocked(listByLead).mockResolvedValue([followup])
})

describe('LeadFollowups nome do lead', () => {
  it('mostra o nome real recebido na linha, como texto e não como substituto', async () => {
    renderSheet('Barbearia do Bairro')

    const name = await screen.findByText('Barbearia do Bairro')
    expect(name.tagName).toBe('SPAN')
    // Dentro da própria ficha o nome não vira link para a página atual.
    expect(screen.queryByRole('link')).toBeNull()
    // Nada de rótulo genérico no lugar do nome real.
    expect(document.querySelector('li')?.textContent).not.toMatch(/este lead|não carregado/i)
    expect(document.querySelector('li')?.textContent).toContain('Retornar proposta')
  })

  it('sem nome informado a linha não inventa identificação para o lead', async () => {
    renderSheet()

    await screen.findByText('Retornar proposta')
    expect(document.querySelector('li')?.textContent).not.toMatch(/lead|este/i)
    expect(screen.queryByRole('link')).toBeNull()
  })
})
