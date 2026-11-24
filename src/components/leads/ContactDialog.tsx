import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { addActivity } from '../../services/activityService'
import { setLeadStatus } from '../../services/leadService'
import { ACTIVITY_LABELS, ACTIVITY_TYPES, type ActivityType } from '../../types/activity'
import { LEAD_STATUSES, STATUS_LABELS, type LeadStatus } from '../../types/lead'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'

interface ContactDialogProps {
  open: boolean
  leadId: string
  currentStatus: LeadStatus
  onClose: () => void
  onSaved: () => void
}

export function ContactDialog(props: ContactDialogProps) {
  return (
    <ContactDialogContent
      key={`${props.leadId}:${props.open ? 'open' : 'closed'}`}
      {...props}
    />
  )
}

function ContactDialogContent({ open, leadId, currentStatus, onClose, onSaved }: ContactDialogProps) {
  const { toast } = useToast()
  const [type, setType] = useState<ActivityType>('primeiro_contato')
  const [description, setDescription] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [activityCreated, setActivityCreated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)
  const activityCreatedRef = useRef(false)
  const mountedRef = useRef(true)
  const sessionRef = useRef(0)

  const resetForm = useCallback(() => {
    sessionRef.current += 1
    savingRef.current = false
    activityCreatedRef.current = false
    setType('primeiro_contato')
    setDescription('')
    setNewStatus('')
    setSaving(false)
    setConfirming(false)
    setActivityCreated(false)
    setError(null)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      sessionRef.current += 1
    }
  }, [])

  const saveContact = async () => {
    if (savingRef.current) return
    const session = sessionRef.current
    const contactDescription = description.trim()
    const targetStatus = newStatus as LeadStatus | ''

    savingRef.current = true
    setSaving(true)
    setConfirming(false)
    setError(null)

    try {
      if (!activityCreatedRef.current) {
        await addActivity(leadId, type, contactDescription)
        if (!mountedRef.current || session !== sessionRef.current) return
        activityCreatedRef.current = true
        setActivityCreated(true)
      }

      if (targetStatus && targetStatus !== currentStatus) {
        await setLeadStatus(leadId, targetStatus)
        if (!mountedRef.current || session !== sessionRef.current) return
      }
    } catch (cause) {
      if (!mountedRef.current || session !== sessionRef.current) return
      const message = cause instanceof Error ? cause.message : 'Erro ao registrar.'
      if (activityCreatedRef.current && targetStatus && targetStatus !== currentStatus) {
        setError(
          `O contato foi registrado, mas não foi possível mudar o status. ${message} `
          + 'Use “Repetir mudança de status” para tentar novamente; o contato não será registrado outra vez.',
        )
      } else {
        setError(`Não foi possível registrar o contato. ${message} Nenhuma mudança de status foi aplicada.`)
      }
      return
    } finally {
      savingRef.current = false
      if (mountedRef.current && session === sessionRef.current) setSaving(false)
    }

    toast('Contato registrado.')
    onSaved()
    resetForm()
    onClose()
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (savingRef.current || confirming) return
    if (!description.trim()) {
      setError('Descreva o contato ou observação.')
      return
    }

    if (activityCreatedRef.current) {
      void saveContact()
      return
    }

    if (newStatus && newStatus !== currentStatus) {
      setError(null)
      setConfirming(true)
      return
    }

    void saveContact()
  }

  const handleClose = () => {
    if (savingRef.current) return
    if (activityCreatedRef.current) onSaved()
    resetForm()
    onClose()
  }

  const cancelConfirmation = () => {
    if (savingRef.current) return
    setConfirming(false)
  }

  const fieldsDisabled = saving || confirming || activityCreated
  const statusLabel = newStatus ? STATUS_LABELS[newStatus as LeadStatus] : ''

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Registrar contato"
      dismissible={!saving && !confirming}
    >
      <form onSubmit={submit} className="flex flex-col gap-4" aria-busy={saving}>
        <Select
          label="Tipo de atividade"
          value={type}
          onChange={(event) => setType(event.target.value as ActivityType)}
          options={ACTIVITY_TYPES
            .filter((activityType) => activityType !== 'mudanca_status' && activityType !== 'follow_up')
            .map((activityType) => ({ value: activityType, label: ACTIVITY_LABELS[activityType] }))}
          disabled={fieldsDisabled}
        />
        <div aria-live="polite">
          <Textarea
            label="Descrição *"
            value={description}
            error={error ?? undefined}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="O que foi conversado, enviado ou combinado?"
            disabled={fieldsDisabled}
            rows={5}
          />
        </div>
        <Select
          label="Mudar status para (opcional — confirmação explícita)"
          placeholder="Manter status atual"
          value={newStatus}
          onChange={(event) => setNewStatus(event.target.value)}
          options={LEAD_STATUSES
            .filter((status) => status !== currentStatus)
            .map((status) => ({ value: status, label: STATUS_LABELS[status] }))}
          disabled={fieldsDisabled}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="mint" loading={saving} disabled={confirming}>
            {activityCreated ? 'Repetir mudança de status' : 'Registrar'}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirming}
        title="Confirmar registro e mudança de status"
        description={`Registrar o contato e mudar o status de ${STATUS_LABELS[currentStatus]} para ${statusLabel}?`}
        confirmLabel="Confirmar e registrar"
        loading={saving}
        onConfirm={() => void saveContact()}
        onCancel={cancelConfirmation}
      />
    </Modal>
  )
}
