// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthLayout } from './AuthLayout'

afterEach(cleanup)

describe('AuthLayout', () => {
  it('exibe a marca e um rodapé que não afirma uma etapa concluída', () => {
    render(<MemoryRouter><AuthLayout /></MemoryRouter>)
    expect(screen.getByRole('img', { name: 'Carboni' })).toBeTruthy()
    expect(screen.getByText('CRM de prospecção comercial · Carboni Digital Business').textContent)
      .toBe('CRM de prospecção comercial · Carboni Digital Business')
    expect(screen.queryByText(/Etapa 1 — Fundação/)).toBeNull()
  })
})
