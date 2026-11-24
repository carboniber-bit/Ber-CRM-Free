// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyLeadDraft } from '../../types/lead'
import { LeadForm } from './LeadForm'

vi.mock('../../services/leadService', () => ({
  createLead: vi.fn(),
  updateLead: vi.fn(),
  findDuplicateCandidates: vi.fn(),
}))

vi.mock('../../services/settingsService', () => ({
  getSettings: vi.fn().mockResolvedValue({
    owner_id: '00000000-0000-0000-0000-000000000201',
    service_prices: { site: 0, landing: 0, cardapio: 0, catalogo: 0, outros: 0 },
    whatsapp_template: '',
  }),
}))

afterEach(cleanup)
beforeEach(() => vi.clearAllMocks())

function renderForm(leadId?: string) {
  return render(
    <MemoryRouter>
      <LeadForm
        initial={{ ...emptyLeadDraft(), name: 'Estabelecimento de teste', status: 'novo' }}
        leadId={leadId}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />
    </MemoryRouter>,
  )
}

describe('LeadForm status', () => {
  it('não permite mudar status diretamente ao editar', () => {
    renderForm('00000000-0000-0000-0000-000000000101')

    expect((screen.getByLabelText('Status') as HTMLSelectElement).disabled).toBe(true)
    expect(screen.getByText(/Use a ficha do lead para alterar o status com confirmação/)).toBeTruthy()
  })

  it('permite escolher o status inicial no cadastro', () => {
    renderForm()

    expect((screen.getByLabelText('Status') as HTMLSelectElement).disabled).toBe(false)
  })
})
