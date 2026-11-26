// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Logo } from './Logo'

afterEach(cleanup)

describe('Logo', () => {
  it('exibe a marca Carboni e mantém o nome do CRM', () => {
    render(<Logo />)
    expect(screen.getByRole('img', { name: 'Carboni' }).getAttribute('src')).toBe('/images/logo-carboni.png')
    expect(screen.getByText('Ber CRM').textContent).toBe('Ber CRM')
  })
})
