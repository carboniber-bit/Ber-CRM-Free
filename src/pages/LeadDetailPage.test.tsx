// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastContext } from '../hooks/useToast'
import { getLead } from '../services/leadService'
import { emptyLeadDraft, type Lead } from '../types/lead'
import { LeadDetailPage } from './LeadDetailPage'

vi.mock('../services/leadService', () => ({
  getLead: vi.fn(),
  setLeadStatus: vi.fn(),
}))

vi.mock('../services/clientService', () => ({ getLeadClientLink: vi.fn().mockResolvedValue(null), convertLeadToClient: vi.fn() }))

vi.mock('../components/leads/LeadTimeline', () => ({ LeadTimeline: () => null }))
vi.mock('../components/leads/LeadChecklist', () => ({ LeadChecklist: () => null }))
vi.mock('../components/leads/LeadFollowups', () => ({ LeadFollowups: () => null }))

const leadId = '00000000-0000-0000-0000-000000000101'

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    ...emptyLeadDraft(),
    id: leadId,
    owner_id: '00000000-0000-0000-0000-000000000201',
    score: 0,
    priority: 'baixa',
    needs: [],
    score_reasons: [],
    next_contact_at: null,
    last_verified_at: null,
    created_at: '2026-11-22T00:00:00Z',
    updated_at: '2026-11-22T00:00:00Z',
    name: 'Studio Lis Nail Design',
    address: 'Rua das Flores, 123',
    city: 'Osasco',
    state: 'SP',
    ...overrides,
  } as Lead
}

function renderPage() {
  return render(
    <ToastContext.Provider value={{ toast: vi.fn() }}>
      <MemoryRouter initialEntries={[`/leads/${leadId}`]}>
        <Routes>
          <Route path="/leads/:id" element={<LeadDetailPage />} />
        </Routes>
      </MemoryRouter>
    </ToastContext.Provider>,
  )
}

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getLead).mockResolvedValue(makeLead())
})

describe('LeadDetailPage links externos', () => {
  it('abre o link exato do Maps e o Instagram em nova aba', async () => {
    vi.mocked(getLead).mockResolvedValue(makeLead({
      maps_url: 'https://maps.app.goo.gl/exemplo',
      instagram: 'https://www.instagram.com/studio.lis/',
    }))
    renderPage()

    const maps = await screen.findByRole('link', { name: 'Abrir no Maps' })
    const instagram = screen.getByRole('link', { name: 'Instagram' })

    expect(maps.getAttribute('href')).toBe('https://maps.app.goo.gl/exemplo')
    expect(instagram.getAttribute('href')).toBe('https://www.instagram.com/studio.lis/')
    expect(maps.getAttribute('target')).toBe('_blank')
    expect(maps.getAttribute('rel')).toBe('noreferrer')
  })

  it('rotula como busca quando não existe link exato do estabelecimento', async () => {
    renderPage()

    const search = await screen.findByRole('link', { name: 'Buscar no Maps' })

    expect(search.getAttribute('href')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Studio%20Lis%20Nail%20Design%2C%20Rua%20das%20Flores%2C%20123%2C%20Osasco%2C%20SP',
    )
    expect(screen.queryByRole('link', { name: 'Abrir no Maps' })).toBeNull()
  })

  it('não trata uma URL comum como link exato do Maps', async () => {
    vi.mocked(getLead).mockResolvedValue(makeLead({ maps_url: 'https://example.com/estabelecimento' }))
    renderPage()

    expect(await screen.findByRole('link', { name: 'Buscar no Maps' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Abrir no Maps' })).toBeNull()
  })

  it('converte um usuário antigo do Instagram em link clicável', async () => {
    vi.mocked(getLead).mockResolvedValue(makeLead({ instagram: '@studio.lis' }))
    renderPage()

    const instagram = await screen.findByRole('link', { name: 'Instagram' })

    expect(instagram.getAttribute('href')).toBe('https://www.instagram.com/studio.lis/')
  })

  it('não renderiza URLs inseguras e usa a busca segura do Maps', async () => {
    vi.mocked(getLead).mockResolvedValue(makeLead({
      maps_url: 'javascript:alert(1)',
      instagram: 'javascript:alert(1)',
      website: 'javascript:alert(1)',
    }))
    renderPage()

    expect(await screen.findByRole('link', { name: 'Buscar no Maps' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Instagram' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Site' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Abrir no Maps' })).toBeNull()
  })
})
