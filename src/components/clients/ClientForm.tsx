import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createClient, findClientDuplicateCandidates, updateClient } from '../../services/clientService'
import {
  CLIENT_STATUSES,
  CLIENT_STATUS_LABELS,
  type Client,
  type ClientStatus,
  type ClientWrite,
  type InitialContractInput,
} from '../../types/client'
import type { Contract } from '../../types/contract'
import { onlyDigits } from '../../lib/format'
import { parseMoneyInput, toMoneyDecimal } from '../../lib/money'
import { normalizeClientUrl } from '../../lib/url'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'

interface ClientFormBaseProps {
  onCancel: () => void
  onSaved: (client: Client) => void
}

export type ClientFormProps = ClientFormBaseProps & (
  | { mode: 'create'; draftScope: string; client?: never; contract?: never }
  | { mode: 'edit'; client: Client; contract: Contract }
)

const CLIENT_TEXT_FIELDS = [
  'name', 'responsible_name', 'phone', 'whatsapp', 'email', 'cnpj', 'website',
  'instagram', 'address', 'city', 'district', 'zip_code', 'state', 'niche', 'notes',
] as const

type ClientTextField = typeof CLIENT_TEXT_FIELDS[number]
type ClientDraft = Record<ClientTextField, string> & { status: ClientStatus }
type ClientDraftErrors = Partial<Record<keyof ClientDraft, string>>

interface ContractDraft {
  service: string
  totalValue: string
  contractedAt: string
  dueDate: string
  paymentMethod: string
  paymentTerms: string
  notes: string
}

const CONTRACT_TEXT_FIELDS = [
  'service', 'totalValue', 'contractedAt', 'dueDate', 'paymentMethod', 'paymentTerms', 'notes',
] as const

type ContractDraftErrors = Partial<Record<keyof ContractDraft, string>>

interface PersistedClientDraft {
  version: 1
  creationKey: string
  clientDraft: ClientDraft
  contractDraft: ContractDraft
}

interface DraftInitialization {
  clientDraft: ClientDraft
  contractDraft: ContractDraft
  creationKey: string | null
  storageError: string | null
}

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const STORAGE_ERROR_MESSAGE = 'Não foi possível preservar o rascunho neste navegador. O cadastro foi bloqueado para evitar duplicidade. Libere o armazenamento da sessão e tente novamente.'
const INVALID_DRAFT_MESSAGE = 'O rascunho salvo neste navegador é inválido. O cadastro foi bloqueado para evitar duplicidade. Cancele para limpar o rascunho e começar novamente.'

function emptyClientDraft(): ClientDraft {
  return {
    name: '',
    responsible_name: '',
    phone: '',
    whatsapp: '',
    email: '',
    cnpj: '',
    website: '',
    instagram: '',
    address: '',
    city: '',
    district: '',
    zip_code: '',
    state: '',
    niche: '',
    notes: '',
    status: 'active',
  }
}

function clientDraftFrom(client: Client): ClientDraft {
  return {
    name: client.name,
    responsible_name: client.responsible_name ?? '',
    phone: client.phone ?? '',
    whatsapp: client.whatsapp ?? '',
    email: client.email ?? '',
    cnpj: client.cnpj ?? '',
    website: client.website ?? '',
    instagram: client.instagram ?? '',
    address: client.address ?? '',
    city: client.city ?? '',
    district: client.district ?? '',
    zip_code: client.zip_code ?? '',
    state: client.state ?? '',
    niche: client.niche ?? '',
    notes: client.notes ?? '',
    status: client.status,
  }
}

function emptyContractDraft(): ContractDraft {
  return {
    service: '',
    totalValue: '',
    contractedAt: '',
    dueDate: '',
    paymentMethod: '',
    paymentTerms: '',
    notes: '',
  }
}

function contractDraftFrom(contract: Contract): ContractDraft {
  return {
    service: contract.service,
    totalValue: toMoneyDecimal(contract.total_value_cents),
    contractedAt: contract.contracted_at,
    dueDate: contract.due_date ?? '',
    paymentMethod: contract.payment_method ?? '',
    paymentTerms: contract.payment_terms ?? '',
    notes: contract.notes ?? '',
  }
}

function draftStorageKey(draftScope: string) {
  return `ber-crm:client-draft:v1:${encodeURIComponent(draftScope)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasStringFields<T extends string>(
  value: Record<string, unknown>,
  fields: readonly T[],
): value is Record<string, unknown> & Record<T, string> {
  return fields.every((field) => typeof value[field] === 'string')
}

function isClientStatus(value: unknown): value is ClientStatus {
  return typeof value === 'string' && CLIENT_STATUSES.some((status) => status === value)
}

function parsePersistedClientDraft(raw: string): PersistedClientDraft | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (
    !isRecord(parsed)
    || parsed.version !== 1
    || typeof parsed.creationKey !== 'string'
    || !UUID_V4_PATTERN.test(parsed.creationKey)
    || !isRecord(parsed.clientDraft)
    || !hasStringFields(parsed.clientDraft, CLIENT_TEXT_FIELDS)
    || !isRecord(parsed.contractDraft)
    || !hasStringFields(parsed.contractDraft, CONTRACT_TEXT_FIELDS)
  ) return null

  const clientDraft = parsed.clientDraft
  const contractDraft = parsed.contractDraft
  const status = clientDraft.status
  if (!isClientStatus(status)) return null
  return {
    version: 1,
    creationKey: parsed.creationKey,
    clientDraft: {
      name: clientDraft.name,
      responsible_name: clientDraft.responsible_name,
      phone: clientDraft.phone,
      whatsapp: clientDraft.whatsapp,
      email: clientDraft.email,
      cnpj: clientDraft.cnpj,
      website: clientDraft.website,
      instagram: clientDraft.instagram,
      address: clientDraft.address,
      city: clientDraft.city,
      district: clientDraft.district,
      zip_code: clientDraft.zip_code,
      state: clientDraft.state,
      niche: clientDraft.niche,
      notes: clientDraft.notes,
      status,
    },
    contractDraft: {
      service: contractDraft.service,
      totalValue: contractDraft.totalValue,
      contractedAt: contractDraft.contractedAt,
      dueDate: contractDraft.dueDate,
      paymentMethod: contractDraft.paymentMethod,
      paymentTerms: contractDraft.paymentTerms,
      notes: contractDraft.notes,
    },
  }
}

function writePersistedClientDraft(storageKey: string, draft: PersistedClientDraft) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

function initializeCreateDraft(draftScope: string): DraftInitialization {
  const storageKey = draftStorageKey(draftScope)
  const clientDraft = emptyClientDraft()
  const contractDraft = emptyContractDraft()
  let raw: string | null
  try {
    raw = sessionStorage.getItem(storageKey)
  } catch {
    return { clientDraft, contractDraft, creationKey: null, storageError: STORAGE_ERROR_MESSAGE }
  }
  if (raw !== null) {
    const persisted = parsePersistedClientDraft(raw)
    if (!persisted) {
      return { clientDraft, contractDraft, creationKey: null, storageError: INVALID_DRAFT_MESSAGE }
    }
    return {
      clientDraft: persisted.clientDraft,
      contractDraft: persisted.contractDraft,
      creationKey: persisted.creationKey,
      storageError: null,
    }
  }

  const creationKey = crypto.randomUUID()
  const persisted: PersistedClientDraft = { version: 1, creationKey, clientDraft, contractDraft }
  return {
    clientDraft,
    contractDraft,
    creationKey,
    storageError: writePersistedClientDraft(storageKey, persisted) ? null : STORAGE_ERROR_MESSAGE,
  }
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  return !Number.isNaN(date.getTime())
    && date.getFullYear() === Number(value.slice(0, 4))
    && date.getMonth() + 1 === Number(value.slice(5, 7))
    && date.getDate() === Number(value.slice(8, 10))
}

function isValidEmail(value: string) {
  const email = value.trim()
  if (!email) return true
  if (email.length > 254) return false
  const at = email.indexOf('@')
  if (at <= 0 || at !== email.lastIndexOf('@')) return false

  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (local.length > 64) return false
  const localSegmentPattern = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+$/
  if (!local.split('.').every((segment) => localSegmentPattern.test(segment))) return false

  const labels = domain.split('.')
  if (labels.length < 2) return false
  const labelPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/
  if (!labels.every((label) => label.length <= 63 && labelPattern.test(label))) return false
  const finalLabel = labels[labels.length - 1]
  return finalLabel.length >= 2 && /[A-Za-z]/.test(finalLabel)
}

function cnpjCheckDigit(base: string, weights: readonly number[]) {
  const sum = weights.reduce((total, weight, index) => total + Number(base[index]) * weight, 0)
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

function isValidCnpj(value: string) {
  if (!/^[0-9./-]+$/.test(value)) return false
  const digits = onlyDigits(value)
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false
  const firstCheckDigit = cnpjCheckDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const secondCheckDigit = cnpjCheckDigit(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return digits[12] === String(firstCheckDigit) && digits[13] === String(secondCheckDigit)
}

function validateClientDraft(draft: ClientDraft): ClientDraftErrors {
  const errors: ClientDraftErrors = {}
  if (!draft.name.trim()) errors.name = 'Nome do cliente é obrigatório.'
  const email = draft.email.trim()
  if (!isValidEmail(email)) errors.email = 'E-mail inválido.'
  const cnpj = draft.cnpj.trim()
  if (cnpj) {
    if (onlyDigits(cnpj).length !== 14) {
      errors.cnpj = 'CNPJ deve ter 14 dígitos.'
    } else if (!isValidCnpj(cnpj)) {
      errors.cnpj = 'CNPJ inválido.'
    }
  }
  for (const field of ['website', 'instagram'] as const) {
    if (draft[field].trim() && normalizeClientUrl(draft[field]) === null) {
      errors[field] = 'Informe uma URL válida (http://, https:// ou domínio).'
    }
  }
  return errors
}

function validateContractDraft(draft: ContractDraft): ContractDraftErrors {
  const errors: ContractDraftErrors = {}
  if (!draft.service.trim()) errors.service = 'Informe o serviço contratado.'
  if (parseMoneyInput(draft.totalValue) === null) errors.totalValue = 'Informe um valor válido.'
  if (!draft.contractedAt) {
    errors.contractedAt = 'Informe a data da contratação.'
  } else if (!isValidDate(draft.contractedAt)) {
    errors.contractedAt = 'Data da contratação inválida.'
  }
  if (draft.dueDate && !isValidDate(draft.dueDate)) {
    errors.dueDate = 'Data de vencimento inválida.'
  } else if (
    draft.dueDate && !errors.contractedAt && draft.dueDate < draft.contractedAt
  ) {
    errors.dueDate = 'O vencimento não pode anteceder a contratação.'
  }
  return errors
}

function nullable(value: string) {
  return value.trim() || null
}

function buildClientWrite(draft: ClientDraft): ClientWrite {
  return {
    name: draft.name.trim(),
    responsible_name: nullable(draft.responsible_name),
    phone: nullable(draft.phone),
    whatsapp: nullable(draft.whatsapp),
    email: nullable(draft.email),
    cnpj: nullable(draft.cnpj),
    website: normalizeClientUrl(draft.website) ?? '',
    instagram: normalizeClientUrl(draft.instagram) ?? '',
    address: nullable(draft.address),
    city: nullable(draft.city),
    district: nullable(draft.district),
    zip_code: nullable(draft.zip_code),
    state: nullable(draft.state),
    niche: nullable(draft.niche),
    notes: nullable(draft.notes),
    status: draft.status,
  }
}

function buildInitialContract(draft: ContractDraft, totalValueCents: number): InitialContractInput {
  return {
    service: draft.service.trim(),
    totalValueCents,
    contractedAt: draft.contractedAt,
    dueDate: draft.dueDate || null,
    paymentMethod: draft.paymentMethod.trim(),
    paymentTerms: draft.paymentTerms.trim(),
    notes: draft.notes.trim(),
  }
}

export function ClientForm(props: ClientFormProps) {
  return (
    <ClientFormContent
      key={props.mode === 'create'
        ? `create:${props.draftScope}`
        : `edit:${props.client.id}:${props.contract.id}`}
      {...props}
    />
  )
}

function ClientFormContent(props: ClientFormProps) {
  const { mode, onCancel, onSaved } = props
  const [initialDraft] = useState<DraftInitialization>(() => props.mode === 'edit'
    ? {
        clientDraft: clientDraftFrom(props.client),
        contractDraft: contractDraftFrom(props.contract),
        creationKey: null,
        storageError: null,
      }
    : initializeCreateDraft(props.draftScope))
  const [clientDraft, setClientDraft] = useState<ClientDraft>(initialDraft.clientDraft)
  const [contractDraft, setContractDraft] = useState<ContractDraft>(initialDraft.contractDraft)
  const [clientErrors, setClientErrors] = useState<ClientDraftErrors>({})
  const [contractErrors, setContractErrors] = useState<ContractDraftErrors>({})
  const [saving, setSaving] = useState(false)
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [storageError, setStorageError] = useState<string | null>(initialDraft.storageError)
  const [mutationFailed, setMutationFailed] = useState(false)
  const [duplicates, setDuplicates] = useState<Client[]>([])
  const [duplicateLookupFailed, setDuplicateLookupFailed] = useState(false)
  const [duplicateReviewed, setDuplicateReviewed] = useState(false)
  const clientDraftRef = useRef(clientDraft)
  const contractDraftRef = useRef(contractDraft)
  const creationKeyRef = useRef(initialDraft.creationKey)
  const storageKeyRef = useRef(mode === 'create' ? draftStorageKey(props.draftScope) : null)
  const busyRef = useRef(false)
  const mountedRef = useRef(true)
  const requestRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestRef.current += 1
    }
  }, [])

  const persistCurrentDraft = () => {
    if (mode !== 'create') return null
    const storageKey = storageKeyRef.current
    const creationKey = creationKeyRef.current
    if (!storageKey || !creationKey) return null
    const persisted: PersistedClientDraft = {
      version: 1,
      creationKey,
      clientDraft: clientDraftRef.current,
      contractDraft: contractDraftRef.current,
    }
    if (!writePersistedClientDraft(storageKey, persisted)) {
      setStorageError(STORAGE_ERROR_MESSAGE)
      return null
    }
    setStorageError(null)
    return creationKey
  }

  const clearFeedback = () => {
    setSaveError(null)
    setMutationFailed(false)
    setDuplicates([])
    setDuplicateLookupFailed(false)
    setDuplicateReviewed(false)
  }

  const setClientField = <K extends keyof ClientDraft>(field: K, value: ClientDraft[K]) => {
    if (busyRef.current) return
    const nextClientDraft: ClientDraft = { ...clientDraftRef.current, [field]: value }
    clientDraftRef.current = nextClientDraft
    setClientDraft(nextClientDraft)
    setClientErrors((current) => ({ ...current, [field]: undefined }))
    clearFeedback()
    if (mode === 'create') persistCurrentDraft()
  }

  const setContractField = <K extends keyof ContractDraft>(field: K, value: ContractDraft[K]) => {
    if (busyRef.current) return
    const nextContractDraft: ContractDraft = { ...contractDraftRef.current, [field]: value }
    contractDraftRef.current = nextContractDraft
    setContractDraft(nextContractDraft)
    setContractErrors((current) => ({ ...current, [field]: undefined }))
    clearFeedback()
    if (mode === 'create') persistCurrentDraft()
  }

  const cancel = () => {
    if (busyRef.current) return
    const storageKey = storageKeyRef.current
    if (mode === 'create' && storageKey) {
      try {
        sessionStorage.removeItem(storageKey)
      } catch {
        setStorageError(STORAGE_ERROR_MESSAGE)
        return
      }
    }
    onCancel()
  }

  const persist = async (payload: ClientWrite, initialContract: InitialContractInput, request: number) => {
    const creationKey = mode === 'create' ? persistCurrentDraft() : null
    if (mode === 'create' && creationKey === null) {
      if (mountedRef.current && request === requestRef.current) {
        busyRef.current = false
        setSaving(false)
        setCheckingDuplicates(false)
      }
      return
    }

    setSaving(true)
    setSaveError(null)
    setMutationFailed(false)
    try {
      let saved: Client
      if (mode === 'edit') {
        saved = await updateClient(props.client.id, {
          ...payload,
          contractId: props.contract.id,
          initialContract,
        })
      } else if (creationKey !== null) {
        saved = await createClient({
          ...payload,
          creationKey,
          initialContract,
        })
      } else {
        return
      }
      if (!mountedRef.current || request !== requestRef.current) return
      if (!saved || typeof saved.id !== 'string' || !saved.id) {
        throw new Error('Não foi possível salvar o cliente.')
      }
      if (mode === 'create' && storageKeyRef.current) {
        try {
          sessionStorage.removeItem(storageKeyRef.current)
        } catch {
          // A chave restante continua protegendo a idempotência; o save confirmado não é desfeito.
        }
      }
      onSaved(saved)
    } catch (cause) {
      if (!mountedRef.current || request !== requestRef.current) return
      setSaveError(cause instanceof Error ? cause.message : 'Erro ao salvar o cliente.')
      setMutationFailed(true)
    } finally {
      if (mountedRef.current && request === requestRef.current) {
        busyRef.current = false
        setSaving(false)
      }
    }
  }

  const save = async (skipDuplicateCheck: boolean) => {
    if (busyRef.current) return
    const nextClientErrors = validateClientDraft(clientDraft)
    const nextContractErrors = validateContractDraft(contractDraft)
    setClientErrors(nextClientErrors)
    setContractErrors(nextContractErrors)
    setSaveError(null)
    setMutationFailed(false)
    if (
      Object.values(nextClientErrors).some(Boolean)
      || Object.values(nextContractErrors).some(Boolean)
    ) return

    const totalValueCents = parseMoneyInput(contractDraft.totalValue)
    if (totalValueCents === null) return
    const payload = buildClientWrite(clientDraft)
    const initialContract = buildInitialContract(contractDraft, totalValueCents)
    if (!skipDuplicateCheck && mode === 'create' && persistCurrentDraft() === null) return
    const request = ++requestRef.current
    setDuplicates([])
    setDuplicateLookupFailed(false)
    setDuplicateReviewed(false)

    if (skipDuplicateCheck) {
      busyRef.current = true
      await persist(payload, initialContract, request)
      return
    }

    busyRef.current = true
    setCheckingDuplicates(true)
    let shouldPersist = false
    try {
      const candidates = (await findClientDuplicateCandidates({
        name: payload.name,
        city: payload.city,
        phone: payload.phone,
        whatsapp: payload.whatsapp,
        cnpj: payload.cnpj,
      }, props.mode === 'edit' ? props.client.id : undefined))
        .filter((candidate) => candidate.id !== (props.mode === 'edit' ? props.client.id : undefined))
      if (!mountedRef.current || request !== requestRef.current) return
      const cnpjDigits = onlyDigits(payload.cnpj ?? '')
      const cnpjDuplicate = cnpjDigits
        ? candidates.find((candidate) => onlyDigits(candidate.cnpj ?? '') === cnpjDigits)
        : undefined
      if (cnpjDuplicate) {
        setSaveError(`Já existe um cliente com este CNPJ: ${cnpjDuplicate.name}.`)
        return
      }
      if (candidates.length > 0) {
        setDuplicates(candidates)
        return
      }
      shouldPersist = true
    } catch {
      if (!mountedRef.current || request !== requestRef.current) return
      setDuplicateLookupFailed(true)
      return
    } finally {
      if (mountedRef.current && request === requestRef.current) {
        setCheckingDuplicates(false)
        if (!shouldPersist) busyRef.current = false
      }
    }

    await persist(payload, initialContract, request)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busyRef.current) return
    if (duplicates.length > 0) {
      if (!duplicateReviewed) {
        setSaveError('Revise os possíveis duplicados e marque a confirmação para continuar.')
        setMutationFailed(false)
        return
      }
      void save(true)
      return
    }
    void save(false)
  }

  const busy = saving || checkingDuplicates
  const sectionTitle = 'font-display text-sm font-semibold text-ink'

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6" aria-busy={busy}>
      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle}>Informações básicas</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input disabled={busy} label="Nome do cliente *" required value={clientDraft.name} error={clientErrors.name} onChange={(event) => setClientField('name', event.target.value)} />
          <Input disabled={busy} label="Nome do responsável" value={clientDraft.responsible_name} onChange={(event) => setClientField('responsible_name', event.target.value)} />
          <Input disabled={busy} label="Telefone" type="tel" placeholder="(11) 99999-9999" value={clientDraft.phone} onChange={(event) => setClientField('phone', event.target.value)} />
          <Input disabled={busy} label="WhatsApp" type="tel" placeholder="(11) 99999-9999" value={clientDraft.whatsapp} onChange={(event) => setClientField('whatsapp', event.target.value)} />
          <Input disabled={busy} label="E-mail" type="email" value={clientDraft.email} error={clientErrors.email} onChange={(event) => setClientField('email', event.target.value)} />
          <Input disabled={busy} label="CNPJ" inputMode="numeric" placeholder="00.000.000/0000-00" value={clientDraft.cnpj} error={clientErrors.cnpj} onChange={(event) => setClientField('cnpj', event.target.value)} />
          <Input disabled={busy} label="Site (link)" type="url" placeholder="https://exemplo.com.br" value={clientDraft.website} error={clientErrors.website} onChange={(event) => setClientField('website', event.target.value)} />
          <Input disabled={busy} label="Instagram (link)" type="url" placeholder="https://instagram.com/..." value={clientDraft.instagram} error={clientErrors.instagram} onChange={(event) => setClientField('instagram', event.target.value)} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle}>Localização e perfil</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input disabled={busy} label="Endereço" value={clientDraft.address} onChange={(event) => setClientField('address', event.target.value)} />
          <Input disabled={busy} label="Cidade" value={clientDraft.city} onChange={(event) => setClientField('city', event.target.value)} />
          <Input disabled={busy} label="Bairro" value={clientDraft.district} onChange={(event) => setClientField('district', event.target.value)} />
          <Input disabled={busy} label="CEP" inputMode="numeric" value={clientDraft.zip_code} onChange={(event) => setClientField('zip_code', event.target.value)} />
          <Input disabled={busy} label="Estado" value={clientDraft.state} onChange={(event) => setClientField('state', event.target.value)} />
          <Input disabled={busy} label="Nicho" value={clientDraft.niche} onChange={(event) => setClientField('niche', event.target.value)} />
          <Select
            disabled={busy}
            label="Status"
            value={clientDraft.status}
            onChange={(event) => setClientField('status', event.target.value as ClientStatus)}
            options={CLIENT_STATUSES.map((status) => ({ value: status, label: CLIENT_STATUS_LABELS[status] }))}
          />
        </div>
        <Textarea disabled={busy} label="Observações" value={clientDraft.notes} onChange={(event) => setClientField('notes', event.target.value)} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle}>Contrato inicial</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input disabled={busy} label="Serviço contratado *" required value={contractDraft.service} error={contractErrors.service} onChange={(event) => setContractField('service', event.target.value)} />
          <Input
            disabled={busy}
            label="Valor contratado *"
            inputMode="decimal"
            placeholder="Ex.: 1.234,56"
            value={contractDraft.totalValue}
            error={contractErrors.totalValue}
            onChange={(event) => setContractField('totalValue', event.target.value)}
            readOnly={mode === 'edit'}
            aria-describedby={mode === 'edit' ? 'contract-total-readonly' : undefined}
            required
          />
          <Input disabled={busy} label="Data da contratação *" type="date" required value={contractDraft.contractedAt} error={contractErrors.contractedAt} onChange={(event) => setContractField('contractedAt', event.target.value)} />
          <Input disabled={busy} label="Vencimento do contrato" type="date" value={contractDraft.dueDate} error={contractErrors.dueDate} onChange={(event) => setContractField('dueDate', event.target.value)} />
          <Input disabled={busy} label="Forma de pagamento" placeholder="Ex.: Pix" value={contractDraft.paymentMethod} onChange={(event) => setContractField('paymentMethod', event.target.value)} />
          <Input disabled={busy} label="Condições de pagamento" placeholder="Ex.: 50% na assinatura" value={contractDraft.paymentTerms} onChange={(event) => setContractField('paymentTerms', event.target.value)} />
        </div>
        {mode === 'edit' && (
          <p id="contract-total-readonly" className="text-xs text-muted">
            O valor total do contrato não pode ser alterado no Plano 1. Use o ajuste financeiro do contrato quando essa operação estiver disponível.
          </p>
        )}
        <Textarea disabled={busy} label="Observações do contrato" value={contractDraft.notes} onChange={(event) => setContractField('notes', event.target.value)} />
      </section>

      {storageError && (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
          <p className="text-sm text-danger">{storageError}</p>
        </div>
      )}

      {duplicateLookupFailed && (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
          <p className="text-sm font-medium text-danger">Não foi possível verificar duplicidades.</p>
          <p className="mt-1 text-xs text-muted">O cliente não foi salvo. Tente novamente ou continue explicitamente sem a verificação.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => void save(false)}>Tentar novamente</Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void save(true)}>Continuar sem verificar</Button>
          </div>
        </div>
      )}

      {duplicates.length > 0 && (
        <div className="rounded-xl border border-lime/40 bg-lime/5 p-4" role="alert">
          <p className="text-sm font-medium text-lime">Possível duplicidade</p>
          <ul className="mt-2 flex flex-col gap-1">
            {duplicates.map((duplicate) => (
              <li key={duplicate.id} className="text-sm text-muted">
                Possível duplicidade: {duplicate.name}. Revise antes de continuar.
              </li>
            ))}
          </ul>
          <label className="mt-3 flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={duplicateReviewed}
              onChange={(event) => {
                setDuplicateReviewed(event.target.checked)
                setSaveError(null)
                setMutationFailed(false)
              }}
              disabled={busy}
              className="h-4 w-4 accent-primary"
            />
            Revisei os possíveis duplicados e desejo continuar.
          </label>
        </div>
      )}

      {saveError && (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
          <p className="text-sm text-danger">{saveError}</p>
          {mutationFailed && (
            <Button type="button" variant="outline" className="mt-3" disabled={busy} onClick={() => void save(false)}>
              Tentar novamente
            </Button>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={cancel} disabled={busy}>Cancelar</Button>
        <Button type="submit" variant="mint" loading={busy}>
          {checkingDuplicates ? 'Verificando duplicidade…' : saving ? 'Salvando…' : mode === 'edit' ? 'Salvar cliente' : 'Cadastrar cliente'}
        </Button>
      </div>
    </form>
  )
}
