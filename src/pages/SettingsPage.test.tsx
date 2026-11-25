// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../components/auth/authContext'
import { ToastContext } from '../hooks/useToast'
import {
  getProfileName, getSettings, saveSettings, updateProfileName,
} from '../services/settingsService'
import type { UserSettings } from '../types/settings'
import { SettingsPage } from './SettingsPage'

vi.mock('../services/settingsService', () => ({
  getSettings: vi.fn(),
  getProfileName: vi.fn(),
  saveSettings: vi.fn(),
  updateProfileName: vi.fn(),
}))

const settings: UserSettings = {
  owner_id: '00000000-0000-0000-0000-000000000201',
  service_prices: { site: 1200, landing: 750, cardapio: 900, catalogo: 1400, outros: 300 },
  whatsapp_template: 'Olá!\nPodemos conversar?',
}
const user = { id: settings.owner_id, email: 'ana@exemplo.com' } as User
const toast = vi.fn()
const signOut = vi.fn()

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/configuracoes']}>
      <AuthContext.Provider value={{ session: null, user, loading: false, signOut }}>
        <ToastContext.Provider value={{ toast }}>
          <Routes>
            <Route path="/configuracoes" element={<SettingsPage />} />
          </Routes>
        </ToastContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

async function renderLoaded() {
  renderPage()
  await screen.findByRole('heading', { name: 'Configurações' })
}

function saveButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /Salvar configurações/ }) as HTMLButtonElement
}

let consoleError: ReturnType<typeof vi.spyOn>
let consoleWarn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  consoleError = vi.spyOn(console, 'error')
  consoleWarn = vi.spyOn(console, 'warn')
  vi.mocked(getSettings).mockResolvedValue(settings)
  vi.mocked(getProfileName).mockResolvedValue('Ana Lima')
  vi.mocked(saveSettings).mockResolvedValue(settings)
  vi.mocked(updateProfileName).mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  expect(consoleError).not.toHaveBeenCalled()
  expect(consoleWarn).not.toHaveBeenCalled()
  consoleError.mockRestore()
  consoleWarn.mockRestore()
})

describe('SettingsPage carregamento e perfil', () => {
  it('inicia configurações e perfil em paralelo e mantém o skeleton até ambos responderem', async () => {
    const pendingSettings = deferred<UserSettings>()
    const pendingName = deferred<string>()
    vi.mocked(getSettings).mockReturnValue(pendingSettings.promise)
    vi.mocked(getProfileName).mockReturnValue(pendingName.promise)

    const { container } = renderPage()

    expect(getSettings).toHaveBeenCalledTimes(1)
    expect(getProfileName).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
    expect(screen.queryByRole('heading', { name: 'Configurações' })).toBeNull()

    await act(async () => {
      pendingSettings.resolve(settings)
      pendingName.resolve('Ana Lima')
    })

    expect(await screen.findByRole('heading', { name: 'Configurações' })).toBeTruthy()
    expect(container.querySelector('.animate-pulse')).toBeNull()
  })

  it('hidrata o nome real, mantém o e-mail desabilitado e exibe preços e template salvos', async () => {
    await renderLoaded()

    expect((screen.getByLabelText('Seu nome') as HTMLInputElement).value).toBe('Ana Lima')
    const email = screen.getByLabelText('E-mail') as HTMLInputElement
    expect(email.value).toBe('ana@exemplo.com')
    expect(email.disabled).toBe(true)
    expect((screen.getByLabelText('Site (R$)') as HTMLInputElement).value).toBe('1200')
    expect((screen.getByLabelText('Landing page (R$)') as HTMLInputElement).value).toBe('750')
    expect((screen.getByLabelText('Cardápio digital (R$)') as HTMLInputElement).value).toBe('900')
    expect((screen.getByLabelText('Catálogo digital (R$)') as HTMLInputElement).value).toBe('1400')
    expect((screen.getByLabelText('Outros serviços (R$)') as HTMLInputElement).value).toBe('300')
    expect((screen.getByLabelText('Template (editável a cada envio)') as HTMLTextAreaElement).value)
      .toBe(settings.whatsapp_template)
  })

  it('mostra feedback de erro quando as configurações não carregam', async () => {
    vi.mocked(getSettings).mockRejectedValue(new Error('Falha ao carregar configurações.'))

    renderPage()

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Falha ao carregar configurações.', 'error'))
    expect(await screen.findByRole('heading', { name: 'Configurações' })).toBeTruthy()
  })

  it('mostra feedback de erro quando o nome do perfil não carrega', async () => {
    vi.mocked(getProfileName).mockRejectedValue(new Error('Não foi possível ler o perfil.'))

    renderPage()

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Não foi possível ler o perfil.', 'error'))
    expect(await screen.findByRole('heading', { name: 'Configurações' })).toBeTruthy()
  })

  it('não processa erro nem resposta de carregamento após desmontar a página', async () => {
    const pendingSettings = deferred<UserSettings>()
    const pendingName = deferred<string>()
    vi.mocked(getSettings).mockReturnValue(pendingSettings.promise)
    vi.mocked(getProfileName).mockReturnValue(pendingName.promise)

    const { unmount } = renderPage()
    unmount()

    await act(async () => {
      pendingSettings.reject(new Error('Resposta obsoleta.'))
      pendingName.resolve('Ana Lima')
      await Promise.resolve()
    })

    expect(toast).not.toHaveBeenCalled()
  })
})

describe('SettingsPage preços, template e salvamento', () => {
  it('salva os cinco preços e o template com o nome aparado', async () => {
    await renderLoaded()

    fireEvent.change(screen.getByLabelText('Seu nome'), { target: { value: '  Ana Silva  ' } })
    fireEvent.change(screen.getByLabelText('Site (R$)'), { target: { value: '2500.50' } })
    fireEvent.change(screen.getByLabelText('Template (editável a cada envio)'), {
      target: { value: 'Nova mensagem\nPara o lead.' },
    })
    fireEvent.click(saveButton())

    await waitFor(() => expect(saveSettings).toHaveBeenCalledWith(
      { site: 2500.5, landing: 750, cardapio: 900, catalogo: 1400, outros: 300 },
      'Nova mensagem\nPara o lead.',
    ))
    expect(updateProfileName).toHaveBeenCalledWith('Ana Silva')
    expect(toast).toHaveBeenCalledWith('Configurações salvas.')
  })

  it('normaliza preço negativo para zero e mantém atributos de valor não negativo', async () => {
    await renderLoaded()

    const site = screen.getByLabelText('Site (R$)') as HTMLInputElement
    expect(site.min).toBe('0')
    expect(site.step).toBe('0.01')

    fireEvent.change(site, { target: { value: '-80' } })
    expect(site.value).toBe('0')

    fireEvent.change(site, { target: { value: '249.90' } })
    expect(site.value).toBe('249.9')
  })

  it('mostra o preview do template e o oculta quando só há espaços', async () => {
    await renderLoaded()

    expect(screen.getByText('Preview:').nextElementSibling?.textContent).toBe(settings.whatsapp_template)

    fireEvent.change(screen.getByLabelText('Template (editável a cada envio)'), { target: { value: '   ' } })
    expect(screen.queryByText('Preview:')).toBeNull()

    fireEvent.change(screen.getByLabelText('Template (editável a cada envio)'), {
      target: { value: 'Olá,\nTudo bem?' },
    })
    expect(screen.getByText('Preview:').nextElementSibling?.textContent).toBe('Olá,\nTudo bem?')
  })

  it('exibe estado de salvamento e só libera o botão quando as duas gravações terminam', async () => {
    const pendingSave = deferred<UserSettings>()
    vi.mocked(saveSettings).mockReturnValue(pendingSave.promise)
    await renderLoaded()

    fireEvent.click(saveButton())
    expect(saveButton().disabled).toBe(true)
    expect(within(saveButton()).getByLabelText('Carregando')).toBeTruthy()

    await act(async () => { pendingSave.resolve(settings) })

    await waitFor(() => expect(saveButton().disabled).toBe(false))
    expect(within(saveButton()).queryByLabelText('Carregando')).toBeNull()
    expect(toast).toHaveBeenCalledWith('Configurações salvas.')
  })

  it('mostra erro de salvamento sem anunciar sucesso e libera o botão', async () => {
    vi.mocked(updateProfileName).mockRejectedValue(new Error('Não foi possível salvar o perfil.'))
    await renderLoaded()

    fireEvent.click(saveButton())

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Não foi possível salvar o perfil.', 'error'))
    expect(toast).not.toHaveBeenCalledWith('Configurações salvas.')
    expect(saveButton().disabled).toBe(false)
  })

  it('não soma preços alternativos e preserva os avisos de estimativa e envio manual', async () => {
    await renderLoaded()

    expect(screen.getByText(/Valores estimados não são faturamento/)).toBeTruthy()
    expect(screen.getByText(/Você revisa e envia manualmente no WhatsApp/)).toBeTruthy()
    expect(screen.queryByText(/Valor potencial total dos serviços/)).toBeNull()
  })
})
