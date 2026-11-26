// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLead, findDuplicateCandidates } from '../../services/leadService'
import { emptyLeadDraft, type Lead } from '../../types/lead'
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

describe('LeadForm links', () => {
  it('salva o link exato do Maps e normaliza um usuário do Instagram', async () => {
    vi.mocked(findDuplicateCandidates).mockResolvedValue([])
    vi.mocked(createLead).mockResolvedValue({
      ...emptyLeadDraft(),
      id: '00000000-0000-0000-0000-000000000101',
      owner_id: '00000000-0000-0000-0000-000000000201',
      score: 0,
      priority: 'baixa',
      needs: [],
      score_reasons: [],
      next_contact_at: null,
      last_verified_at: null,
      created_at: '2026-11-22T00:00:00Z',
      updated_at: '2026-11-22T00:00:00Z',
      name: 'Estabelecimento de teste',
    } as Lead)
    renderForm()

    fireEvent.change(screen.getByLabelText('Google Maps (link exato)'), {
      target: { value: 'maps.app.goo.gl/exemplo' },
    })
    fireEvent.change(screen.getByLabelText('Instagram (link ou @usuario)'), {
      target: { value: '@perfil.exemplo' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar lead' }))

    await waitFor(() => expect(createLead).toHaveBeenCalledWith(expect.objectContaining({
      maps_url: 'https://maps.app.goo.gl/exemplo',
      instagram: 'https://www.instagram.com/perfil.exemplo/',
    })))
  })
})

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
