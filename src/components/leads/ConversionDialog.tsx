// src/components/leads/ConversionDialog.tsx
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { convertLeadToClient } from '../../services/clientService'
import type { ConversionInput, ConversionResult } from '../../types/client'
import type { Lead } from '../../types/lead'
import { parseMoneyInput } from '../../lib/money'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'

export interface ConversionDialogProps {
  open: boolean
  lead: Lead
  existingClientId: string | null
  onClose: () => void
  onConverted: (result: ConversionResult) => void
}

interface ConversionForm {
  service: string
  value: string
  contractedAt: string
  paymentMethod: string
  paymentTerms: string
  notes: string
  createProject: boolean
  projectName: string
  projectStartDate: string
  projectDueDate: string
}

type ConversionErrors = Partial<Record<
  'service' | 'value' | 'contractedAt' | 'projectName' | 'projectStartDate' | 'projectDueDate',
  string
>>

const PAYMENT_METHODS = [
  { value: 'pix', label: 'Pix' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'outro', label: 'Outro' },
]

function localToday() {
  const now = new Date()
  return [
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  return !Number.isNaN(date.getTime())
    && date.getFullYear() === Number(value.slice(0, 4))
    && date.getMonth() + 1 === Number(value.slice(5, 7))
    && date.getDate() === Number(value.slice(8, 10))
}

function emptyForm(): ConversionForm {
  return {
    service: '',
    value: '',
    contractedAt: localToday(),
    paymentMethod: '',
    paymentTerms: '',
    notes: '',
    createProject: false,
    projectName: '',
    projectStartDate: '',
    projectDueDate: '',
  }
}

function isConversionResult(value: unknown): value is ConversionResult {
  if (!value || typeof value !== 'object') return false
  const result = value as Partial<ConversionResult>
  const hasId = (id: unknown): id is string => typeof id === 'string' && id.trim().length > 0
  return hasId(result.client_id)
    && hasId(result.link_id)
    && hasId(result.contract_id)
    && (result.project_id === null || hasId(result.project_id))
    && typeof result.already_existed === 'boolean'
}

export function ConversionDialog(props: ConversionDialogProps) {
  return (
    <ConversionDialogContent
      key={`${props.lead.id}:${props.open ? 'open' : 'closed'}`}
      {...props}
    />
  )
}

function ConversionDialogContent({
  open, lead, existingClientId, onClose, onConverted,
}: ConversionDialogProps) {
  const { toast } = useToast()
  const [form, setForm] = useState<ConversionForm>(emptyForm)
  const [errors, setErrors] = useState<ConversionErrors>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)
  const mountedRef = useRef(true)
  const sessionRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      sessionRef.current += 1
    }
  }, [])

  const resetForm = useCallback(() => {
    sessionRef.current += 1
    savingRef.current = false
    setForm(emptyForm())
    setErrors({})
    setSaving(false)
    setError(null)
  }, [])

  const update = <K extends keyof ConversionForm>(field: K, value: ConversionForm[K]) => {
    if (savingRef.current) return
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setError(null)
  }

  const handleClose = () => {
    if (savingRef.current) return
    resetForm()
    onClose()
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (savingRef.current || existingClientId) return

    const nextErrors: ConversionErrors = {}
    const parsedValue = parseMoneyInput(form.value)
    if (!form.service.trim()) nextErrors.service = 'Informe o serviço contratado.'
    if (parsedValue === null) nextErrors.value = 'Informe um valor contratado válido.'
    if (!form.contractedAt) {
      nextErrors.contractedAt = 'Informe a data da contratação.'
    } else if (!isValidDate(form.contractedAt)) {
      nextErrors.contractedAt = 'Data da contratação inválida.'
    }

    if (form.createProject) {
      if (!form.projectName.trim()) nextErrors.projectName = 'Informe o nome do projeto.'
      if (form.projectStartDate && !isValidDate(form.projectStartDate)) {
        nextErrors.projectStartDate = 'Data de início inválida.'
      }
      if (form.projectDueDate && !isValidDate(form.projectDueDate)) {
        nextErrors.projectDueDate = 'Prazo do projeto inválido.'
      }
      if (
        !nextErrors.projectStartDate && !nextErrors.projectDueDate
        && form.projectStartDate && form.projectDueDate
        && form.projectDueDate < form.projectStartDate
      ) {
        nextErrors.projectDueDate = 'O prazo do projeto não pode anteceder o início.'
      }
    }

    setErrors(nextErrors)
    setError(null)
    if (Object.values(nextErrors).some(Boolean) || parsedValue === null) return

    const input: ConversionInput = {
      service: form.service.trim(),
      contractedValueCents: parsedValue,
      contractedAt: form.contractedAt,
      paymentMethod: form.paymentMethod,
      paymentTerms: form.paymentTerms,
      notes: form.notes,
      project: form.createProject
        ? {
            name: form.projectName.trim(),
            startDate: form.projectStartDate || null,
            dueDate: form.projectDueDate || null,
          }
        : null,
    }

    const session = sessionRef.current
    savingRef.current = true
    setSaving(true)
    void convertLeadToClient(lead.id, input).then(
      (result: unknown) => {
        if (!mountedRef.current || session !== sessionRef.current) return
        if (!isConversionResult(result)) {
          setError('Não foi possível converter o lead.')
          return
        }
        if (result.already_existed) {
          toast('Conversão já existente. Os dados anteriores foram preservados.')
        } else {
          toast('Lead convertido em cliente.')
        }
        onConverted(result)
      },
      (cause: unknown) => {
        if (!mountedRef.current || session !== sessionRef.current) return
        setError(cause instanceof Error ? cause.message : 'Erro ao converter o lead.')
      },
    ).finally(() => {
      if (!mountedRef.current || session !== sessionRef.current) return
      savingRef.current = false
      setSaving(false)
    })
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Converter lead em cliente"
      wide
      dismissible={!saving}
    >
      {existingClientId ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted" role="status">Este lead já está vinculado a um cliente.</p>
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={handleClose}>Entendi</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-busy={saving}>
          {saving && <span role="status" className="sr-only">Convertendo lead…</span>}
          <Input
            label="Serviço contratado *"
            value={form.service}
            error={errors.service}
            onChange={(event) => update('service', event.target.value)}
            disabled={saving}
            required
          />
          <Input
            label="Valor contratado *"
            inputMode="decimal"
            placeholder="Ex.: 1.234,56"
            value={form.value}
            error={errors.value}
            onChange={(event) => update('value', event.target.value)}
            disabled={saving}
            required
          />
          <Input
            label="Data da contratação *"
            type="date"
            value={form.contractedAt}
            error={errors.contractedAt}
            onChange={(event) => update('contractedAt', event.target.value)}
            disabled={saving}
            required
          />
          <Select
            label="Forma de pagamento"
            placeholder="Selecione"
            value={form.paymentMethod}
            onChange={(event) => update('paymentMethod', event.target.value)}
            options={PAYMENT_METHODS}
            disabled={saving}
          />
          <Textarea
            label="Condições de pagamento"
            value={form.paymentTerms}
            onChange={(event) => update('paymentTerms', event.target.value)}
            disabled={saving}
          />
          <Textarea
            label="Observações da conversão"
            value={form.notes}
            onChange={(event) => update('notes', event.target.value)}
            disabled={saving}
          />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.createProject}
              onChange={(event) => update('createProject', event.target.checked)}
              disabled={saving}
              className="h-4 w-4 accent-primary"
            />
            Criar projeto inicial
          </label>
          {form.createProject && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Nome do projeto *"
                value={form.projectName}
                error={errors.projectName}
                onChange={(event) => update('projectName', event.target.value)}
                disabled={saving}
                required
              />
              <Input
                label="Início do projeto"
                type="date"
                value={form.projectStartDate}
                error={errors.projectStartDate}
                onChange={(event) => update('projectStartDate', event.target.value)}
                disabled={saving}
              />
              <Input
                label="Prazo do projeto"
                type="date"
                value={form.projectDueDate}
                error={errors.projectDueDate}
                onChange={(event) => update('projectDueDate', event.target.value)}
                disabled={saving}
              />
            </div>
          )}
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" variant="mint" loading={saving}>Confirmar conversão</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
