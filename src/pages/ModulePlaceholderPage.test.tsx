// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModulePlaceholderPage } from './ModulePlaceholderPage'

const modules = [
  {
    moduleKey: 'clientes',
    title: 'Clientes',
    stage: 'Etapa 3',
    description: 'Leads convertidos virão para cá na Etapa 3, com contratos e histórico completo. Nenhum lead é contado como cliente antes da conversão.',
  },
  {
    moduleKey: 'projetos',
    title: 'Projetos',
    stage: 'Etapa 3',
    description: 'Acompanhamento dos serviços contratados (site, cardápio, catálogo) chega na Etapa 3.',
  },
  {
    moduleKey: 'financeiro',
    title: 'Financeiro',
    stage: 'Etapa 4',
    description: 'Valores contratados e recebidos, separados dos estimados, chegam na Etapa 4.',
  },
  {
    moduleKey: 'relatorios',
    title: 'Relatórios',
    stage: 'Etapa 4',
    description: 'Relatórios de conversão, nichos e desempenho chegam na Etapa 4.',
  },
] as const

function renderModule(moduleKey: typeof modules[number]['moduleKey']) {
  return render(
    <MemoryRouter initialEntries={[`/${moduleKey}`]}>
      <Routes>
        <Route path="/:moduleKey" element={<ModulePlaceholderPage moduleKey={moduleKey} />} />
        <Route path="/leads" element={<div>Lista de leads</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

let consoleError: ReturnType<typeof vi.spyOn>
let consoleWarn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error')
  consoleWarn = vi.spyOn(console, 'warn')
})

afterEach(() => {
  cleanup()
  expect(consoleError).not.toHaveBeenCalled()
  expect(consoleWarn).not.toHaveBeenCalled()
  consoleError.mockRestore()
  consoleWarn.mockRestore()
})

describe('ModulePlaceholderPage', () => {
  it.each(modules)('$title usa a chave $moduleKey e explica exatamente a $stage', ({ moduleKey, title, stage, description }) => {
    const { container } = renderModule(moduleKey)

    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: `${title} — disponível na ${stage}` })).toBeTruthy()
    expect(screen.getByText(description)).toBeTruthy()

    const link = screen.getByRole('link', { name: 'Voltar para Leads' })
    expect(link.getAttribute('href')).toBe('/leads')
    expect(link.classList.contains('inline-flex')).toBe(true)
    expect(link.classList.contains('h-10')).toBe(true)
    expect(link.classList.contains('rounded-xl')).toBe(true)
    expect(container.querySelectorAll('a button, a a, button a, a input, a select, a textarea')).toHaveLength(0)
  })

  it('o CTA navega para a lista de leads', async () => {
    renderModule('clientes')

    fireEvent.click(screen.getByRole('link', { name: 'Voltar para Leads' }))

    expect(await screen.findByText('Lista de leads')).toBeTruthy()
  })
})
