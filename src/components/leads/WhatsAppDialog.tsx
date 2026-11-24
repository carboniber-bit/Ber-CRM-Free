import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { addActivity } from '../../services/activityService'
import { getSettings } from '../../services/settingsService'
import { buildWhatsAppLink, normalizeWhatsAppNumber } from '../../lib/whatsapp'
import type { Lead } from '../../types/lead'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Textarea } from '../ui/Textarea'

const WHATSAPP_HISTORY_TEXT = 'WhatsApp aberto com mensagem preparada; envio manual.'

interface WhatsAppDialogProps {
  open: boolean
  lead: Lead
  onClose: () => void
  onLogged: () => void
}

export function WhatsAppDialog(props: WhatsAppDialogProps) {
  return (
    <WhatsAppDialogContent
      key={`${props.lead.id}:${props.open ? 'open' : 'closed'}`}
      {...props}
    />
  )
}

function WhatsAppDialogContent({ open, lead, onClose, onLogged }: WhatsAppDialogProps) {
  const { toast } = useToast()
  const normalizedNumber = normalizeWhatsAppNumber(lead.whatsapp ?? '')
    ?? normalizeWhatsAppNumber(lead.phone ?? '')
  const [message, setMessage] = useState('')
  const [logContact, setLogContact] = useState(true)
  const [templateLoading, setTemplateLoading] = useState(Boolean(normalizedNumber))
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [opened, setOpened] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submittingRef = useRef(false)
  const openedRef = useRef(false)
  const mountedRef = useRef(true)
  const requestRef = useRef(0)
  const sessionRef = useRef(0)

  const resetForm = useCallback(() => {
    sessionRef.current += 1
    requestRef.current += 1
    submittingRef.current = false
    openedRef.current = false
    setMessage('')
    setLogContact(true)
    setTemplateLoading(false)
    setTemplateError(null)
    setSubmitting(false)
    setOpened(false)
    setError(null)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestRef.current += 1
      sessionRef.current += 1
    }
  }, [])

  const handleTemplateSuccess = useCallback((
    request: number,
    settings: Awaited<ReturnType<typeof getSettings>>,
  ) => {
    if (!mountedRef.current || request !== requestRef.current) return
    setMessage((current) => current || settings.whatsapp_template)
    setTemplateLoading(false)
  }, [])

  const handleTemplateError = useCallback((request: number, cause: unknown) => {
    if (!mountedRef.current || request !== requestRef.current) return
    setTemplateError(cause instanceof Error ? cause.message : 'Erro ao carregar o modelo de mensagem.')
    setTemplateLoading(false)
  }, [])

  const loadTemplate = () => {
    const request = ++requestRef.current
    setTemplateLoading(true)
    setTemplateError(null)
    void getSettings().then(
      (settings) => handleTemplateSuccess(request, settings),
      (cause: unknown) => handleTemplateError(request, cause),
    )
  }

  useEffect(() => {
    if (!open || !normalizedNumber) return
    const request = ++requestRef.current
    void getSettings().then(
      (settings) => handleTemplateSuccess(request, settings),
      (cause: unknown) => handleTemplateError(request, cause),
    )
  }, [handleTemplateError, handleTemplateSuccess, normalizedNumber, open])

  const handleClose = () => {
    if (submittingRef.current) return
    resetForm()
    onClose()
  }

  const openWhatsApp = async () => {
    const link = buildWhatsAppLink(normalizedNumber ?? '', message)
    if (!link || templateLoading || submittingRef.current) return

    const session = sessionRef.current
    submittingRef.current = true
    setSubmitting(true)
    setError(null)

    try {
      if (!openedRef.current) {
        let popup: Window | null = null
        try {
          popup = window.open(link, '_blank', 'noopener')
        } catch {
          popup = null
        }

        if (!popup) {
          setError('O navegador bloqueou a abertura do WhatsApp. Permita pop-ups e tente novamente.')
          return
        }

        openedRef.current = true
        setOpened(true)
      }

      if (logContact) {
        try {
          await addActivity(lead.id, 'mensagem', WHATSAPP_HISTORY_TEXT)
        } catch (cause) {
          if (!mountedRef.current || session !== sessionRef.current) return
          const messageError = cause instanceof Error ? cause.message : 'Erro ao registrar atividade.'
          setError(
            `Não foi possível registrar a mensagem no histórico. ${messageError} `
            + 'O WhatsApp já foi aberto; tente registrar novamente sem abrir outra aba.',
          )
          return
        }
      }

      if (!mountedRef.current || session !== sessionRef.current) return
      if (logContact) onLogged()
      toast(WHATSAPP_HISTORY_TEXT, 'info')
      resetForm()
      onClose()
    } finally {
      submittingRef.current = false
      if (mountedRef.current && session === sessionRef.current) setSubmitting(false)
    }
  }

  const primaryLabel = !opened
    ? 'Abrir WhatsApp'
    : logContact
      ? error ? 'Tentar registrar no histórico' : 'Registrar no histórico'
      : 'Concluir'

  return (
    <Modal open={open} onClose={handleClose} title="Abrir WhatsApp" dismissible={!submitting}>
      <div className="flex flex-col gap-4" aria-busy={submitting || templateLoading}>
        {submitting && <span role="status" className="sr-only">Registrando mensagem no histórico…</span>}
        {!normalizedNumber ? (
          <div role="alert" className="rounded-xl border border-danger/40 bg-danger/5 p-4 text-sm text-danger">
            <p className="font-medium">Número inválido ou ausente.</p>
            <p className="mt-1">
              Cadastre um WhatsApp ou telefone com DDD no lead (10 ou 11 dígitos) para abrir a conversa.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted">
              Conversa com <span className="text-ink">{lead.name}</span> · {normalizedNumber}
            </p>

            {templateLoading && (
              <span role="status" className="text-sm text-muted">Carregando modelo de mensagem…</span>
            )}

            {templateError && (
              <div role="alert" className="rounded-xl border border-danger/40 bg-danger/5 p-3">
                <p className="text-sm font-medium text-danger">Não foi possível carregar o modelo de mensagem.</p>
                <p className="mt-1 text-sm text-muted">{templateError}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  disabled={templateLoading || submitting}
                  onClick={loadTemplate}
                >
                  Tentar novamente
                </Button>
              </div>
            )}

            <Textarea
              label="Mensagem inicial (editável)"
              value={message}
              onChange={(event) => {
                setMessage(event.target.value)
                setError(null)
              }}
              placeholder={templateLoading ? 'Carregando mensagem…' : 'Escreva a mensagem que será preparada no WhatsApp.'}
              disabled={templateLoading || submitting || opened}
            />

            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={logContact}
                onChange={(event) => setLogContact(event.target.checked)}
                disabled={submitting}
                className="h-4 w-4 accent-[#22c55e]"
              />
              Registrar mensagem no histórico
            </label>

            <p className="text-xs text-muted">
              O WhatsApp abre em nova aba com a mensagem pronta. Você revisa e faz o envio manual — o CRM nunca envia sozinho.
            </p>

            {opened && (
              <p role="status" className="rounded-xl border border-line bg-elevated p-3 text-sm text-muted">
                {WHATSAPP_HISTORY_TEXT} Se o registro falhar, repita somente o histórico sem abrir outra aba.
              </p>
            )}

            {error && (
              <div role="alert" className="rounded-xl border border-danger/40 bg-danger/5 p-3 text-sm text-danger">
                {error}
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>Fechar</Button>
          {normalizedNumber && (
            <Button
              type="button"
              variant="mint"
              loading={submitting}
              disabled={templateLoading}
              onClick={() => void openWhatsApp()}
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> {primaryLabel}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
