// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Activity } from '../../types/activity'

const { listActivities } = vi.hoisted(() => ({ listActivities: vi.fn() }))
vi.mock('../../services/activityService', () => ({ listActivities }))

import { LeadTimeline } from './LeadTimeline'

afterEach(cleanup)

describe('LeadTimeline — conversão', () => {
  it('renderiza conversão com rótulo e ícone próprios', async () => {
    const activity: Activity = {
      id: 'activity-1', lead_id: 'lead-1', owner_id: 'owner-1', type: 'conversao',
      description: 'Lead convertido em cliente.', user_id: null,
      created_at: '2026-11-25T12:00:00Z',
    }
    listActivities.mockResolvedValue([activity])
    render(<LeadTimeline leadId="lead-1" refreshKey={0} />)

    const list = await screen.findByRole('list', { name: 'Atividades do lead' })
    const item = within(list).getByRole('listitem')
    expect(item.textContent).toContain('Conversão em cliente')
    expect(item.textContent).toContain('Lead convertido em cliente.')
    expect(item.querySelector('svg.lucide-user-check')).not.toBeNull()
  })
})
