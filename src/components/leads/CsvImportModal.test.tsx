// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastContext } from '../../hooks/useToast'
import { createLead, findDuplicateCandidates } from '../../services/leadService'
import type { Lead } from '../../types/lead'
import { CsvImportModal } from './CsvImportModal'

vi.mock('../../services/leadService', () => ({
  createLead: vi.fn(),
  findDuplicateCandidates: vi.fn(),
}))

const toast = vi.fn()
const validCsv = 'nome,cidade\nPadaria A,São Paulo\n'
const headerOnlyCsv = 'nome,cidade\n'

function trackValueWrites(input: HTMLInputElement) {
  const writes: string[] = []
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!
  Object.defineProperty(input, 'value', {
    configurable: true,
    get: () => descriptor.get!.call(input),
    set: (next: string) => {
      writes.push(next)
      descriptor.set!.call(input, next)
    },
  })
  return writes
}

function selectFile(input: HTMLInputElement, name: string, text: string) {
  fireEvent.change(input, { target: { files: [new File([text], name, { type: 'text/csv' })] } })
}

function renderModal() {
  render(
    <ToastContext.Provider value={{ toast }}>
      <CsvImportModal open onClose={vi.fn()} onImported={vi.fn()} />
    </ToastContext.Provider>,
  )
  const input = screen.getByLabelText('Arquivo CSV') as HTMLInputElement
  return { input, valueWrites: trackValueWrites(input) }
}

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(findDuplicateCandidates).mockResolvedValue([])
})

describe('CsvImportModal seleção de arquivo', () => {
  it('libera o campo após a leitura para que o mesmo arquivo possa ser re-selecionado', async () => {
    const { input, valueWrites } = renderModal()

    selectFile(input, 'padarias.csv', validCsv)
    await screen.findByText('Padaria A')

    expect(valueWrites).toContain('')
  })

  it('libera o campo também quando o CSV não produz linhas', async () => {
    const { input, valueWrites } = renderModal()

    selectFile(input, 'vazio.csv', headerOnlyCsv)
    await screen.findByRole('alert')

    expect(valueWrites).toContain('')
    expect(findDuplicateCandidates).not.toHaveBeenCalled()
  })
})

describe('CsvImportModal links do estabelecimento', () => {
  it('normaliza o Maps e o Instagram antes de persistir o lead importado', async () => {
    vi.mocked(createLead).mockResolvedValue({} as Lead)
    const { input } = renderModal()

    selectFile(
      input,
      'links.csv',
      'nome,maps_url,instagram\nEstabelecimento de teste,maps.app.goo.gl/exemplo,@perfil.exemplo\n',
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Importar 1 lead' }))

    await waitFor(() => expect(createLead).toHaveBeenCalledWith(expect.objectContaining({
      maps_url: 'https://maps.app.goo.gl/exemplo',
      instagram: 'https://www.instagram.com/perfil.exemplo/',
    })))
  })
})
