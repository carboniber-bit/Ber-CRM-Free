// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModulePlaceholderPage } from './ModulePlaceholderPage'

const modules = [
  {
    moduleKey: 'financeiro',
    title: 'Financeiro',
    stage: 'Etapa 3',
    description: 'Valores contratados e recebidos, separados dos estimados, chegam na Etapa 3, pelo Plano 3.',
    actionLabel: 'Voltar ao dashboard',
    actionTo: '/',
  },
  {
    moduleKey: 'relatorios',
    title: 'Relatórios',
    stage: 'Etapa 3',
    description: 'Relatórios de conversão, nichos e desempenho chegam na Etapa 3, no plano de finalização.',
    actionLabel: 'Ir para Financeiro',
    actionTo: '/financeiro',
  },
] as const

function renderModule(moduleKey: typeof modules[number]['moduleKey']) {
  return render(
    <MemoryRouter initialEntries={[`/modulos/${moduleKey}`]}>
      <Routes>
        <Route path="/modulos/:moduleKey" element={<ModulePlaceholderPage moduleKey={moduleKey} />} />
        <Route path="/" element={<h1>Dashboard</h1>} />
        <Route path="/financeiro" element={<h1>Módulo financeiro</h1>} />
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
  it.each(modules)('$title usa a chave $moduleKey, explica a $stage e possui o CTA correto', ({ moduleKey, title, stage, description, actionLabel, actionTo }) => {
    const { container } = renderModule(moduleKey)
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: `${title} — disponível na ${stage}` })).toBeTruthy()
    expect(screen.getByText(description)).toBeTruthy()
    const link = screen.getByRole('link', { name: actionLabel })
    expect(link.getAttribute('href')).toBe(actionTo)
    expect(link.classList.contains('inline-flex')).toBe(true)
    expect(link.classList.contains('h-10')).toBe(true)
    expect(link.classList.contains('rounded-xl')).toBe(true)
    expect(container.querySelectorAll('a button, a a, button a, a input, a select, a textarea')).toHaveLength(0)
  })

  it('o CTA financeiro volta ao dashboard em vez de apontar para si mesmo', () => {
    renderModule('financeiro')
    expect(screen.getByRole('link', { name: 'Voltar ao dashboard' }).getAttribute('href')).toBe('/')
    expect(screen.queryByRole('link', { name: 'Ir para Financeiro' })).toBeNull()
  })

  it('o CTA financeiro navega para o dashboard', async () => {
    renderModule('financeiro')
    fireEvent.click(screen.getByRole('link', { name: 'Voltar ao dashboard' }))
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeTruthy()
  })

  it('somente Relatórios possui CTA para o módulo financeiro', async () => {
    renderModule('relatorios')
    fireEvent.click(screen.getByRole('link', { name: 'Ir para Financeiro' }))
    expect(await screen.findByRole('heading', { name: 'Módulo financeiro' })).toBeTruthy()
  })
})
