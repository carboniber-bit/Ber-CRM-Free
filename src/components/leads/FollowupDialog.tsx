import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { createFollowup } from '../../services/followupService'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Textarea } from '../ui/Textarea'

interface FollowupDialogProps {
  open: boolean
  leadId: string
  onClose: () => void
  onSaved: () => void
}

export function FollowupDialog(props: FollowupDialogProps) {
  return (
    <FollowupDialogContent
      key={`${props.leadId}:${props.open ? 'open' : 'closed'}`}
      {...props}
    />
  )
}

function FollowupDialogContent({ open, leadId, onClose, onSaved }: FollowupDialogProps) {
  const { toast } = useToast()
  const [dueAt, setDueAt] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [dateError, setDateError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)
  const mountedRef = useRef(true)
  const sessionRef = useRef(0)

  const resetForm = useCallback(() => {
    sessionRef.current += 1
    savingRef.current = false
    setDueAt('')
    setReason('')
    setNote('')
    setSaving(false)
    setDateError(null)
    setError(null)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      sessionRef.current += 1
    }
  }, [])

  const handleClose = () => {
    if (savingRef.current) return
    resetForm()
    onClose()
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (savingRef.current) return

    setError(null)
    if (!dueAt) {
      setDateError('Informe a data do próximo contato.')
      return
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(dueAt)
    const date = match ? new Date(dueAt) : new Date(Number.NaN)
    if (
      !match || Number.isNaN(date.getTime())
      || date.getFullYear() !== Number(match[1])
      || date.getMonth() + 1 !== Number(match[2])
      || date.getDate() !== Number(match[3])
      || date.getHours() !== Number(match[4])
      || date.getMinutes() !== Number(match[5])
    ) {
      setDateError('Data inválida.')
      return
    }
    if (date.getTime() <= Date.now()) {
      setDateError('A data do próximo contato deve ser futura.')
      return
    }

    const session = sessionRef.current
    savingRef.current = true
    setSaving(true)
    setDateError(null)

    void createFollowup(leadId, date.toISOString(), reason.trim() || null, note.trim() || null).then(
      () => {
        if (!mountedRef.current || session !== sessionRef.current) return
        toast('Follow-up agendado.')
        onSaved()
        resetForm()
        onClose()
      },
      (cause: unknown) => {
        if (!mountedRef.current || session !== sessionRef.current) return
        setError(cause instanceof Error ? cause.message : 'Erro ao agendar follow-up.')
        savingRef.current = false
        setSaving(false)
      },
    )
  }

  return (
    <Modal open={open} onClose={handleClose} title="Agendar follow-up" dismissible={!saving}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-busy={saving}>
        {saving && <span role="status" className="sr-only">Agendando follow-up…</span>}
        <div aria-live="polite">
          <Input
            label="Data e hora do próximo contato *"
            type="datetime-local"
            value={dueAt}
            error={dateError ?? undefined}
            onChange={(event) => {
              setDueAt(event.target.value)
              setDateError(null)
              setError(null)
            }}
            disabled={saving}
            required
          />
        </div>
        <Input
          label="Motivo"
          placeholder="Ex.: retornar proposta"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={saving}
        />
        <Textarea
          label="Observação"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={saving}
        />
        {error && (
          <div role="alert" className="rounded-xl border border-danger/40 bg-danger/5 p-3 text-sm text-danger">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" variant="mint" loading={saving}>Agendar</Button>
        </div>
      </form>
    </Modal>
  )
}
