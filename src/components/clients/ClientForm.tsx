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
  | { mode: 'create'; client?: never; contract?: never }
  | { mode: 'edit'; client: Client; contract: Contract }
)

type ClientTextField = Exclude<keyof ClientWrite, 'status'>
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

type ContractDraftErrors = Partial<Record<keyof ContractDraft, string>>

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

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  return !Number.isNaN(date.getTime())
    && date.getFullYear() === Number(value.slice(0, 4))
    && date.getMonth() + 1 === Number(value.slice(5, 7))
    && date.getDate() === Number(value.slice(8, 10))
}

function validateClientDraft(draft: ClientDraft): ClientDraftErrors {
  const errors: ClientDraftErrors = {}
  if (!draft.name.trim()) errors.name = 'Nome do cliente é obrigatório.'
  const email = draft.email.trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'E-mail inválido.'
  if (draft.cnpj.trim() && onlyDigits(draft.cnpj).length !== 14) {
    errors.cnpj = 'CNPJ deve ter 14 dígitos.'
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
      key={`${props.mode}:${props.client?.id ?? 'new'}:${props.contract?.id ?? 'initial'}`}
      {...props}
    />
  )
}

function ClientFormContent(props: ClientFormProps) {
  const { mode, onCancel, onSaved } = props
  const [clientDraft, setClientDraft] = useState<ClientDraft>(() =>
    props.mode === 'edit' ? clientDraftFrom(props.client) : emptyClientDraft(),
  )
  const [contractDraft, setContractDraft] = useState<ContractDraft>(() =>
    props.mode === 'edit' ? contractDraftFrom(props.contract) : emptyContractDraft(),
  )
  const [clientErrors, setClientErrors] = useState<ClientDraftErrors>({})
  const [contractErrors, setContractErrors] = useState<ContractDraftErrors>({})
  const [saving, setSaving] = useState(false)
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [mutationFailed, setMutationFailed] = useState(false)
  const [duplicates, setDuplicates] = useState<Client[]>([])
  const [duplicateLookupFailed, setDuplicateLookupFailed] = useState(false)
  const [duplicateReviewed, setDuplicateReviewed] = useState(false)
  const creationKeyRef = useRef(crypto.randomUUID())
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

  const clearFeedback = () => {
    setSaveError(null)
    setMutationFailed(false)
    setDuplicates([])
    setDuplicateLookupFailed(false)
    setDuplicateReviewed(false)
  }

  const setClientField = <K extends keyof ClientDraft>(field: K, value: ClientDraft[K]) => {
    if (busyRef.current) return
    setClientDraft((current) => ({ ...current, [field]: value }))
    setClientErrors((current) => ({ ...current, [field]: undefined }))
    clearFeedback()
  }

  const setContractField = <K extends keyof ContractDraft>(field: K, value: ContractDraft[K]) => {
    if (busyRef.current) return
    setContractDraft((current) => ({ ...current, [field]: value }))
    setContractErrors((current) => ({ ...current, [field]: undefined }))
    clearFeedback()
  }

  const persist = async (payload: ClientWrite, initialContract: InitialContractInput, request: number) => {
    setSaving(true)
    setSaveError(null)
    setMutationFailed(false)
    try {
      const saved = props.mode === 'edit'
        ? await updateClient(props.client.id, {
            ...payload,
            contractId: props.contract.id,
            initialContract,
          })
        : await createClient({
            ...payload,
            creationKey: creationKeyRef.current,
            initialContract,
          })
      if (!mountedRef.current || request !== requestRef.current) return
      if (!saved || typeof saved.id !== 'string' || !saved.id) {
        throw new Error('Não foi possível salvar o cliente.')
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
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancelar</Button>
        <Button type="submit" variant="mint" loading={busy}>
          {checkingDuplicates ? 'Verificando duplicidade…' : saving ? 'Salvando…' : mode === 'edit' ? 'Salvar cliente' : 'Cadastrar cliente'}
        </Button>
      </div>
    </form>
  )
}
