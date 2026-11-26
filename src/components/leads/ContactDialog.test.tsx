// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../services/activityService', () => ({ addActivity: vi.fn() }))
vi.mock('../../services/leadService', () => ({ setLeadStatus: vi.fn() }))
vi.mock('../../hooks/useToast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

import { ContactDialog } from './ContactDialog'

afterEach(cleanup)

describe('ContactDialog — atividades automáticas', () => {
  it('não oferece conversão como atividade manual', () => {
    render(
      <ContactDialog
        open
        leadId="lead-1"
        currentStatus="novo"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )
    const select = screen.getByLabelText('Tipo de atividade')
    const values = within(select).getAllByRole('option').map((option) => (option as HTMLOptionElement).value)
    expect(values).toContain('primeiro_contato')
    expect(values).not.toContain('conversao')
  })
})
