// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { ToastContext } from '../../hooks/useToast'
import { formatDateTime } from '../../lib/format'
import { cancelFollowup, completeFollowup } from '../../services/followupService'
import { FOLLOWUP_STATUS_LABELS, type Followup } from '../../types/followup'
import { FollowupItem } from './FollowupItem'

vi.mock('../../services/followupService', () => ({
  completeFollowup: vi.fn(),
  cancelFollowup: vi.fn(),
}))

const NOW = Date.parse('2026-11-25T18:00:00.000Z')
const LEAD_ID = '00000000-0000-0000-0000-000000000101'
const LEAD_HREF = `/leads/${LEAD_ID}`

function makeFollowup(overrides: Partial<Followup> = {}): Followup {
  return {
    id: '00000000-0000-0000-0000-000000000301',
    lead_id: LEAD_ID,
    owner_id: '00000000-0000-0000-0000-000000000201',
    due_at: '2026-11-25T12:00:00.000Z',
    reason: 'Retornar proposta',
    note: null,
    status: 'pendente',
    completed_at: null,
    result: null,
    created_at: '2026-11-24T12:00:00.000Z',
    updated_at: '2026-11-24T12:00:00.000Z',
    ...overrides,
  }
}

const toast = vi.fn()

interface HarnessProps {
  followup: Followup
  lead?: { name: string; href?: string }
  pending?: boolean
  loadLatest?: () => Promise<Followup[] | null>
  onUpdated?: (followup: Followup) => void
  onChanged: () => void
}

// O item não é dono da lista: quem renderiza pinta a linha confirmada pela RPC (é o que
// LeadFollowups e a página de Follow-ups fazem via onUpdated). O harness reproduz isso.
function Harness({ followup, onUpdated, ...rest }: HarnessProps) {
  const [row, setRow] = useState(followup)
  return (
    <ul>
      <FollowupItem
        {...rest}
        followup={row}
        now={NOW}
        onUpdated={(updated) => {
          setRow(updated)
          onUpdated?.(updated)
        }}
      />
    </ul>
  )
}

function renderItem(props: Partial<Omit<HarnessProps, 'followup' | 'onChanged'>> & { followup?: Followup } = {}) {
  const onChanged = vi.fn()
  const { followup = makeFollowup(), lead = { name: 'Barbearia do Bairro', href: LEAD_HREF }, ...rest } = props
  const view = render(
    <ToastContext.Provider value={{ toast }}>
      <MemoryRouter>
        <Harness followup={followup} lead={lead} onChanged={onChanged} {...rest} />
      </MemoryRouter>
    </ToastContext.Provider>,
  )
  return { ...view, onChanged }
}

function itemRoot(): HTMLElement {
  return screen.getByRole('listitem')
}

function timeElement(): HTMLTimeElement {
  return itemRoot().querySelector('time') as HTMLTimeElement
}

async function openCompletion() {
  fireEvent.click(await screen.findByRole('button', { name: /^Concluir follow-up/ }))
}

function typeResult(value: string) {
  fireEvent.change(screen.getByLabelText('Resultado do follow-up (opcional)'), { target: { value } })
}

let consoleError: ReturnType<typeof vi.spyOn>
let consoleWarn: ReturnType<typeof vi.spyOn>

afterEach(() => {
  cleanup()
  // Nenhum caminho renderizado pode gerar aviso de console (act, estado pós-desmontagem).
  expect(consoleError).not.toHaveBeenCalled()
  expect(consoleWarn).not.toHaveBeenCalled()
  consoleError.mockRestore()
  consoleWarn.mockRestore()
})

beforeEach(() => {
  vi.clearAllMocks()
  consoleError = vi.spyOn(console, 'error')
  consoleWarn = vi.spyOn(console, 'warn')
})

describe('FollowupItem conclusão', () => {
  it('conclui com o resultado aparado, pinta a linha da RPC e notifica o dono da lista', async () => {
    const completed = makeFollowup({ status: 'concluido', result: 'Pediu retorno' })
    vi.mocked(completeFollowup).mockResolvedValue(completed)
    const onUpdated = vi.fn()
    const { onChanged } = renderItem({ onUpdated, loadLatest: async () => [makeFollowup()] })

    await openCompletion()
    // O rótulo shipped: sem ele o campo não é encontrável por leitor de tela.
    typeResult('  Pediu retorno  ')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conclusão' }))

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(completeFollowup).toHaveBeenCalledWith(makeFollowup().id, 'Pediu retorno')
    expect(onUpdated).toHaveBeenCalledWith(completed)
    expect(toast).toHaveBeenCalledWith('Follow-up concluído.')
    expect(toast).not.toHaveBeenCalledWith(
      'Este follow-up não está mais pendente. Nenhuma alteração foi feita.',
      'info',
    )
    expect(screen.getByText(FOLLOWUP_STATUS_LABELS.concluido)).toBeTruthy()
  })

  it('manda resultado nulo quando o campo fica vazio', async () => {
    vi.mocked(completeFollowup).mockResolvedValue(makeFollowup({ status: 'concluido' }))
    const { onChanged } = renderItem()

    await openCompletion()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conclusão' }))

    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(completeFollowup).toHaveBeenCalledWith(makeFollowup().id, null)
  })

  it('não anuncia sucesso quando a RPC devolve null', async () => {
    vi.mocked(completeFollowup).mockResolvedValue(null)
    const onUpdated = vi.fn()
    const { onChanged } = renderItem({ onUpdated })

    await openCompletion()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conclusão' }))

    await waitFor(() => expect(completeFollowup).toHaveBeenCalled())
    expect(toast).toHaveBeenCalledWith(
      'Este follow-up não está mais pendente. Nenhuma alteração foi feita.',
      'info',
    )
    expect(toast).not.toHaveBeenCalledWith('Follow-up concluído.')
    expect(onUpdated).not.toHaveBeenCalled()
    expect(onChanged).not.toHaveBeenCalled()
    expect(screen.getByText(FOLLOWUP_STATUS_LABELS.pendente)).toBeTruthy()
  })

  it('fecha o formulário de conclusão quando a RPC devolve null', async () => {
    vi.mocked(completeFollowup).mockResolvedValue(null)
    renderItem()

    await openCompletion()
    expect(screen.getByLabelText('Resultado do follow-up (opcional)')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conclusão' }))
    await waitFor(() => expect(completeFollowup).toHaveBeenCalled())

    expect(screen.queryByLabelText('Resultado do follow-up (opcional)')).toBeNull()
    expect(screen.getByRole('button', { name: /^Concluir follow-up/ })).toBeTruthy()
  })

  it('não grava quando a recarga de validação falha e diz por quê', async () => {
    const { onChanged } = renderItem({ loadLatest: async () => null })

    await openCompletion()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conclusão' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Não foi possível validar o estado atual do follow-up.')
    expect(completeFollowup).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('trata como obsoleta a linha que a recarga já devolveu resolvida', async () => {
    const { onChanged } = renderItem({ loadLatest: async () => [makeFollowup({ status: 'concluido' })] })

    await openCompletion()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conclusão' }))

    await waitFor(() => expect(toast).toHaveBeenCalledWith(
      'Este follow-up não está mais pendente. Nenhuma alteração foi feita.',
      'info',
    ))
    expect(completeFollowup).not.toHaveBeenCalled()
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('mostra o erro da RPC e repete a conclusão com o mesmo resultado', async () => {
    vi.mocked(completeFollowup)
      .mockRejectedValueOnce(new Error('Não foi possível concluir o follow-up.'))
      .mockResolvedValueOnce(makeFollowup({ status: 'concluido', result: 'Pediu retorno' }))
    const { onChanged } = renderItem()

    await openCompletion()
    typeResult('Pediu retorno')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conclusão' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Não foi possível concluir o follow-up.')
    expect(toast).toHaveBeenCalledWith('Não foi possível concluir o follow-up.', 'error')
    expect(onChanged).not.toHaveBeenCalled()
    // O texto digitado não se perde: repetir parte do mesmo resultado.
    expect((screen.getByLabelText('Resultado do follow-up (opcional)') as HTMLInputElement).value)
      .toBe('Pediu retorno')

    fireEvent.click(within(alert).getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(completeFollowup).toHaveBeenLastCalledWith(makeFollowup().id, 'Pediu retorno')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('não anuncia estado obsoleto depois de desmontar durante a conclusão', async () => {
    let resolveMutation!: (value: Followup | null) => void
    vi.mocked(completeFollowup).mockReturnValue(new Promise((resolve) => { resolveMutation = resolve }))
    const { unmount, onChanged } = renderItem()

    await openCompletion()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conclusão' }))
    await waitFor(() => expect(completeFollowup).toHaveBeenCalled())
    unmount()

    await act(async () => {
      resolveMutation(null)
      await Promise.resolve()
    })

    expect(toast).not.toHaveBeenCalled()
    expect(onChanged).not.toHaveBeenCalled()
  })
})

describe('FollowupItem cancelamento', () => {
  it('cancela depois de confirmar no diálogo e notifica o dono da lista', async () => {
    const canceled = makeFollowup({ status: 'cancelado' })
    vi.mocked(cancelFollowup).mockResolvedValue(canceled)
    const onUpdated = vi.fn()
    const { onChanged } = renderItem({ onUpdated })

    fireEvent.click(await screen.findByRole('button', { name: /^Cancelar follow-up/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar follow-up' }))

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(cancelFollowup).toHaveBeenCalledWith(makeFollowup().id)
    expect(onUpdated).toHaveBeenCalledWith(canceled)
    expect(toast).toHaveBeenCalledWith('Follow-up cancelado.')
    expect(toast).not.toHaveBeenCalledWith(
      'Este follow-up não está mais pendente. Nenhuma alteração foi feita.',
      'info',
    )
    expect(screen.getByText(FOLLOWUP_STATUS_LABELS.cancelado)).toBeTruthy()
  })

  it('não anuncia sucesso quando a RPC devolve null', async () => {
    vi.mocked(cancelFollowup).mockResolvedValue(null)
    const { onChanged } = renderItem()

    fireEvent.click(await screen.findByRole('button', { name: /^Cancelar follow-up/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar follow-up' }))

    await waitFor(() => expect(cancelFollowup).toHaveBeenCalled())
    expect(toast).toHaveBeenCalledWith(
      'Este follow-up não está mais pendente. Nenhuma alteração foi feita.',
      'info',
    )
    expect(toast).not.toHaveBeenCalledWith('Follow-up cancelado.')
    expect(onChanged).not.toHaveBeenCalled()
    expect(screen.getByText(FOLLOWUP_STATUS_LABELS.pendente)).toBeTruthy()
  })

  it('não anuncia estado obsoleto depois de desmontar durante o cancelamento', async () => {
    let resolveMutation!: (value: Followup | null) => void
    vi.mocked(cancelFollowup).mockReturnValue(new Promise((resolve) => { resolveMutation = resolve }))
    const { unmount, onChanged } = renderItem()

    fireEvent.click(await screen.findByRole('button', { name: /^Cancelar follow-up/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar follow-up' }))
    await waitFor(() => expect(cancelFollowup).toHaveBeenCalled())
    unmount()

    await act(async () => {
      resolveMutation(null)
      await Promise.resolve()
    })

    expect(toast).not.toHaveBeenCalled()
    expect(onChanged).not.toHaveBeenCalled()
  })
})

describe('FollowupItem apresentação', () => {
  it('destaca só o pendente com data passada', async () => {
    renderItem()
    await openCompletion()

    expect(itemRoot().className).toContain('border-danger/40')
    expect(itemRoot().textContent).toContain('· atrasado')
    expect(timeElement().getAttribute('datetime')).toBe('2026-11-25T12:00:00.000Z')
  })

  it('não trata como atrasado o pendente futuro nem o concluído passado', () => {
    const { unmount } = renderItem({ followup: makeFollowup({ due_at: '2026-11-26T12:00:00.000Z' }) })
    expect(itemRoot().className).not.toContain('border-danger/40')
    expect(itemRoot().textContent).not.toContain('atrasado')
    unmount()

    renderItem({ followup: makeFollowup({ due_at: '2026-11-20T12:00:00.000Z', status: 'concluido' }) })
    expect(itemRoot().className).not.toContain('border-danger/40')
    expect(itemRoot().textContent).not.toContain('atrasado')
  })

  it('liga o nome do lead à ficha quando há href', async () => {
    renderItem()
    const link = await screen.findByRole('link', { name: 'Barbearia do Bairro' })
    expect(link.getAttribute('href')).toBe(LEAD_HREF)
    expect(link.closest('li')).toBe(itemRoot())
  })

  it('mostra o nome como texto quando a linha já está na ficha do lead', () => {
    renderItem({ lead: { name: 'Barbearia do Bairro' } })

    expect(screen.getByText('Barbearia do Bairro')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
    // Botão nunca aninhado em link.
    expect(itemRoot().querySelectorAll('a button, a a')).toHaveLength(0)
  })

  it('mostra motivo, nota e resultado sem oferecer ação a linha resolvida', () => {
    renderItem({
      followup: makeFollowup({ status: 'concluido', note: 'Ligar no balcão', result: 'Pediu retorno' }),
    })

    expect(screen.getByText('Retornar proposta')).toBeTruthy()
    expect(screen.getByText('Ligar no balcão')).toBeTruthy()
    expect(screen.getByText('Resultado: Pediu retorno')).toBeTruthy()
    expect(screen.getByText(FOLLOWUP_STATUS_LABELS.concluido)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('nome não carregado é rótulo honesto, não afirmação de exclusão', () => {
    renderItem({ lead: { name: 'Lead não carregado nesta lista', href: LEAD_HREF } })

    expect(screen.getByRole('link', { name: 'Lead não carregado nesta lista' })).toBeTruthy()
    expect(itemRoot().textContent).not.toMatch(/removido|excluíd/)
  })

  it('trava os controles enquanto a lista está em trânsito', async () => {
    renderItem({ pending: true })

    const complete = await screen.findByRole('button', { name: /^Concluir follow-up/ })
    const cancel = screen.getByRole('button', { name: /^Cancelar follow-up/ })
    expect((complete as HTMLButtonElement).disabled).toBe(true)
    expect((cancel as HTMLButtonElement).disabled).toBe(true)
    expect(itemRoot().getAttribute('aria-busy')).toBe('true')

    fireEvent.click(complete)
    expect(screen.queryByLabelText('Resultado do follow-up (opcional)')).toBeNull()
  })

  it('anuncia a data no cabeçalho e rotula cada ação por ela', async () => {
    renderItem()
    await screen.findByRole('button', { name: /^Concluir follow-up/ })

    const label = formatDateTime('2026-11-25T12:00:00.000Z')
    expect(screen.getByRole('button', { name: `Concluir follow-up de ${label}` })).toBeTruthy()
    expect(screen.getByRole('button', { name: `Cancelar follow-up de ${label}` })).toBeTruthy()
    expect(timeElement().textContent).toContain(label)
  })
})
