import { useEffect, useRef, useState, type FormEvent } from 'react'
import { formatMoney, parseMoneyInput } from '../../lib/money'
import { suggestProjectDueDate } from '../../lib/projectProgress'
import { createProject, listProjectFormOptions, updateProject } from '../../services/projectService'
import type {
  Project,
  ProjectFormClientOption,
  ProjectFormOptions,
  ProjectListItem,
  ProjectPriority,
  ProjectWrite,
} from '../../types/project'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Skeleton } from '../ui/Skeleton'
import { Textarea } from '../ui/Textarea'

export interface ProjectFormProps {
  project?: ProjectListItem
  onCancel: () => void
  onSaved: (project: Project) => void
}

interface ProjectDraft {
  clientId: string
  contractId: string
  name: string
  service: string
  contractedValue: string
  description: string
  startDate: string
  dueDate: string
  responsibleName: string
  priority: ProjectPriority
}

type ProjectDraftErrors = Partial<Record<keyof ProjectDraft, string>>

const PRIORITY_OPTIONS: Array<{ value: ProjectPriority; label: string }> = [
  { value: 'very_high', label: 'Muito alta' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Média' },
  { value: 'low', label: 'Baixa' },
]

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function centsInput(cents: number): string {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`
}

function initialDraft(project?: ProjectListItem): ProjectDraft {
  return {
    clientId: project?.client_id ?? '',
    contractId: project?.contract_id ?? '',
    name: project?.name ?? '',
    service: project?.service ?? '',
    contractedValue: project ? centsInput(project.contracted_value_cents) : '',
    description: project?.description ?? '',
    startDate: project?.start_date ?? '',
    dueDate: project?.due_date ?? '',
    responsibleName: project?.responsible_name ?? '',
    priority: project?.priority ?? 'medium',
  }
}

function withCurrentOption(
  options: ProjectFormClientOption[],
  current?: ProjectFormClientOption,
): ProjectFormClientOption[] {
  return current && !options.some((option) => option.id === current.id)
    ? [current, ...options]
    : options
}

export function ProjectForm({ project, onCancel, onSaved }: ProjectFormProps) {
  const { toast } = useToast()
  const [draft, setDraft] = useState<ProjectDraft>(() => initialDraft(project))
  const [errors, setErrors] = useState<ProjectDraftErrors>({})
  const [options, setOptions] = useState<ProjectFormOptions | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const dueDateEditedRef = useRef(Boolean(project?.due_date))
  const savingRef = useRef(false)
  const savedRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    let active = true
    void listProjectFormOptions().then(
      (result) => {
        if (!active) return
        setOptions(result)
      },
      (error: unknown) => {
        if (!active) return
        setLoadError(errorMessage(error, 'Não foi possível carregar clientes e contratos. Tente novamente.'))
      },
    )
    return () => { active = false }
  }, [reloadKey])

  const setField = <K extends keyof ProjectDraft,>(key: K, value: ProjectDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setSaveError(null)
  }

  const clientOptions = withCurrentOption(
    options?.clients ?? [],
    project ? { id: project.client_id, name: project.client_name ?? project.client_id } : undefined,
  )
  const selectedContract = options?.contracts.find((contract) =>
    contract.id === draft.contractId && contract.client_id === draft.clientId,
  )
  const availableContracts = (options?.contracts ?? []).filter((contract) =>
    contract.client_id === draft.clientId && (!project || contract.id === project.contract_id),
  )
  const currentContractMissing = Boolean(options && project
    && !availableContracts.some((contract) => contract.id === project.contract_id))
  const editBlockedMessage = project?.status === 'cancelled'
    ? 'Projeto cancelado não pode ser editado. Reative o projeto antes de alterar seus dados.'
    : currentContractMissing
      ? 'O contrato atual está cancelado ou indisponível. A edição do projeto está bloqueada.'
      : null
  const allocationLimit = selectedContract
    ? selectedContract.remaining_cents + (project?.contracted_value_cents ?? 0)
    : 0
  const busy = saving

  const changeClient = (clientId: string) => {
    const contractStillValid = (options?.contracts ?? []).some((contract) =>
      contract.id === draft.contractId && contract.client_id === clientId,
    )
    setDraft((current) => ({
      ...current,
      clientId,
      contractId: contractStillValid ? current.contractId : '',
      service: contractStillValid ? current.service : '',
      contractedValue: contractStillValid ? current.contractedValue : '',
    }))
    setErrors((current) => ({
      ...current,
      clientId: undefined,
      contractId: undefined,
      service: undefined,
      contractedValue: undefined,
    }))
    setSaveError(null)
  }

  const changeContract = (contractId: string) => {
    const contract = availableContracts.find((option) => option.id === contractId)
    setDraft((current) => {
      const defaultService = contract?.service ?? ''
      const defaultValue = !project && contract?.allocated_cents === 0
        ? centsInput(contract.remaining_cents)
        : ''
      return {
        ...current,
        contractId,
        service: defaultService,
        contractedValue: project ? current.contractedValue : defaultValue,
        dueDate: dueDateEditedRef.current
          ? current.dueDate
          : suggestProjectDueDate(defaultService, current.startDate || null) ?? '',
      }
    })
    setErrors((current) => ({
      ...current,
      contractId: undefined,
      service: undefined,
      contractedValue: undefined,
      dueDate: undefined,
    }))
    setSaveError(null)
  }

  const changeService = (service: string) => {
    setDraft((current) => ({
      ...current,
      service,
      dueDate: dueDateEditedRef.current
        ? current.dueDate
        : suggestProjectDueDate(service, current.startDate || null) ?? '',
    }))
    setErrors((current) => ({ ...current, service: undefined, dueDate: undefined }))
    setSaveError(null)
  }

  const changeStartDate = (startDate: string) => {
    setDraft((current) => ({
      ...current,
      startDate,
      dueDate: dueDateEditedRef.current
        ? current.dueDate
        : suggestProjectDueDate(current.service, startDate || null) ?? '',
    }))
    setErrors((current) => ({ ...current, startDate: undefined, dueDate: undefined }))
    setSaveError(null)
  }

  const validate = (): ProjectDraftErrors => {
    const nextErrors: ProjectDraftErrors = {}
    if (!draft.clientId) nextErrors.clientId = 'Selecione o cliente.'
    if (!draft.contractId) nextErrors.contractId = 'Selecione o contrato.'
    if (draft.contractId && !selectedContract) {
      nextErrors.contractId = 'Contrato não disponível. Selecione outro contrato.'
    }
    if (!draft.name.trim()) nextErrors.name = 'Nome do projeto é obrigatório.'
    if (!draft.service.trim()) nextErrors.service = 'Informe o serviço.'

    const contractedValueCents = parseMoneyInput(draft.contractedValue)
    if (contractedValueCents === null) {
      nextErrors.contractedValue = 'Informe um valor válido.'
    } else if (selectedContract && contractedValueCents > allocationLimit) {
      nextErrors.contractedValue = `O valor excede o limite disponível de ${formatMoney(allocationLimit)}.`
    }

    if (draft.startDate && draft.dueDate && draft.dueDate < draft.startDate) {
      nextErrors.dueDate = 'O prazo não pode anteceder o início.'
    }
    return nextErrors
  }

  const save = async () => {
    if (savingRef.current || savedRef.current || !options || editBlockedMessage) return

    const nextErrors = validate()
    setErrors(nextErrors)
    setSaveError(null)
    if (Object.values(nextErrors).some(Boolean)) return

    const contractedValueCents = parseMoneyInput(draft.contractedValue)
    if (contractedValueCents === null || !selectedContract) return

    const payload: ProjectWrite = {
      clientId: draft.clientId,
      contractId: draft.contractId,
      name: draft.name.trim(),
      service: draft.service.trim(),
      contractedValueCents,
      description: draft.description.trim(),
      startDate: draft.startDate || null,
      dueDate: draft.dueDate || null,
      responsibleName: draft.responsibleName.trim(),
      priority: draft.priority,
    }

    savingRef.current = true
    setSaving(true)
    let savedProject: Project
    try {
      savedProject = project
        ? await updateProject(project.id, payload)
        : await createProject(payload)
    } catch (error) {
      if (!mountedRef.current) return
      const message = errorMessage(error, 'Não foi possível salvar o projeto. Tente novamente.')
      setSaveError(message)
      toast(message, 'error')
      return
    } finally {
      savingRef.current = false
      if (mountedRef.current) setSaving(false)
    }

    if (!mountedRef.current) return
    savedRef.current = true
    setSaved(true)
    try {
      onSaved(savedProject)
    } catch {
      if (!mountedRef.current) return
      const message = 'Projeto salvo, mas não foi possível concluir a próxima ação.'
      setSaveError(message)
      toast(message, 'error')
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void save()
  }

  if (!options) {
    if (loadError) {
      return (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
          <p className="text-sm text-danger">{loadError}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOptions(null)
                setLoadError(null)
                setReloadKey((key) => key + 1)
              }}
            >
              Tentar novamente
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
          </div>
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-64" />
        <span className="sr-only">Carregando formulário de projeto…</span>
      </div>
    )
  }

  if (editBlockedMessage) {
    return (
      <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
        <p className="text-sm text-danger">{editBlockedMessage}</p>
        <Button type="button" variant="outline" className="mt-3" onClick={onCancel}>Voltar</Button>
      </div>
    )
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-5" aria-busy={busy}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Cliente *"
          value={draft.clientId}
          options={clientOptions.map((client) => ({ value: client.id, label: client.name }))}
          placeholder="Selecione o cliente"
          error={errors.clientId}
          onChange={(event) => changeClient(event.target.value)}
          disabled={busy || Boolean(project)}
          required
        />
        <Select
          label="Contrato *"
          value={draft.contractId}
          options={availableContracts.map((contract) => ({
            value: contract.id,
            label: `${contract.service} · ${formatMoney(contract.remaining_cents)} disponível`,
          }))}
          placeholder={project ? undefined : 'Selecione o contrato'}
          error={errors.contractId}
          onChange={(event) => changeContract(event.target.value)}
          disabled={busy || Boolean(project) || !draft.clientId}
          required
        />
        <Input
          label="Nome do projeto *"
          value={draft.name}
          error={errors.name}
          onChange={(event) => setField('name', event.target.value)}
          disabled={busy}
          required
        />
        <Input
          label="Serviço *"
          value={draft.service}
          error={errors.service}
          onChange={(event) => changeService(event.target.value)}
          disabled={busy}
          required
        />
        <Input
          label="Valor alocado (R$) *"
          inputMode="decimal"
          placeholder="0,00"
          value={draft.contractedValue}
          error={errors.contractedValue}
          onChange={(event) => setField('contractedValue', event.target.value)}
          disabled={busy}
          required
        />
        <Select
          label="Prioridade"
          value={draft.priority}
          options={PRIORITY_OPTIONS}
          onChange={(event) => setField('priority', event.target.value as ProjectPriority)}
          disabled={busy}
        />
        <Input
          label="Início"
          type="date"
          value={draft.startDate}
          error={errors.startDate}
          onChange={(event) => changeStartDate(event.target.value)}
          disabled={busy}
        />
        <Input
          label="Prazo"
          type="date"
          value={draft.dueDate}
          error={errors.dueDate}
          onChange={(event) => {
            dueDateEditedRef.current = true
            setField('dueDate', event.target.value)
          }}
          disabled={busy}
        />
        <Input
          label="Responsável"
          value={draft.responsibleName}
          onChange={(event) => setField('responsibleName', event.target.value)}
          disabled={busy}
        />
      </div>

      {selectedContract && (
        <dl className="grid grid-cols-1 gap-3 rounded-xl border border-line bg-elevated p-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted">Total do contrato</dt>
            <dd className="mt-1 font-medium text-ink">{formatMoney(selectedContract.total_value_cents)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Já alocado</dt>
            <dd className="mt-1 font-medium text-ink">{formatMoney(selectedContract.allocated_cents)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Saldo disponível</dt>
            <dd className="mt-1 font-medium text-ink">{formatMoney(selectedContract.remaining_cents)}</dd>
          </div>
        </dl>
      )}

      {project && (
        <p className="text-xs text-muted">
          Cliente e contrato são fixos na edição.
          {selectedContract && ` O limite deste projeto é ${formatMoney(allocationLimit)}.`}
        </p>
      )}

      <Textarea
        label="Descrição"
        value={draft.description}
        onChange={(event) => setField('description', event.target.value)}
        disabled={busy}
        rows={4}
      />

      {saveError && (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
          <p className="text-sm text-danger">{saveError}</p>
          {!saved && (
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              disabled={busy}
              onClick={() => void save()}
            >
              Tentar novamente
            </Button>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancelar</Button>
        <Button type="submit" variant="mint" loading={busy} disabled={saved}>
          {project ? 'Salvar alterações' : 'Criar projeto'}
        </Button>
      </div>
    </form>
  )
}
