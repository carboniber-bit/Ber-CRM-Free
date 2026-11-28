import { useEffect, useRef, useState, type FormEvent } from 'react'
import { PackageCheck } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import { deliverProject } from '../../services/projectService'
import type { DeliveryInput, Project } from '../../types/project'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'

interface ProjectDeliveryPanelProps {
  project: Project
  onDelivered: (project: Project) => void
}

interface DeliveryDraft {
  deliveryUrl: string
  filesUrl: string
  finalNotes: string
  confirmed: boolean
}

type DeliveryErrors = Partial<Record<'deliveryUrl' | 'filesUrl' | 'confirmed', string>>

function isHttpUrl(value: string): boolean {
  if (/\s/.test(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Não definido'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC',
  }).format(date)
}

function SafeLink({ href, label }: { href: string; label: string }) {
  return isHttpUrl(href)
    ? <a className="font-medium text-primary hover:underline" href={href} target="_blank" rel="noreferrer">{label}</a>
    : <span className="text-sm text-danger">URL inválida no histórico</span>
}

export function ProjectDeliveryPanel({ project, onDelivered }: ProjectDeliveryPanelProps) {
  const { toast } = useToast()
  const [draft, setDraft] = useState<DeliveryDraft>({
    deliveryUrl: project.delivery_url ?? '', filesUrl: project.files_url ?? '',
    finalNotes: project.final_notes ?? '', confirmed: false,
  })
  const [errors, setErrors] = useState<DeliveryErrors>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedDelivery, setSavedDelivery] = useState<Project | null>(null)
  const savingRef = useRef(false)
  const mountedRef = useRef(true)
  const projectIdRef = useRef(project.id)
  projectIdRef.current = project.id

  useEffect(() => {
    mountedRef.current = true
    setConfirmOpen(false)
    setErrors({})
    setSavedDelivery(null)
    setDraft({
      deliveryUrl: project.delivery_url ?? '', filesUrl: project.files_url ?? '',
      finalNotes: project.final_notes ?? '', confirmed: false,
    })
    return () => { mountedRef.current = false }
  }, [project.id])

  const delivered = savedDelivery?.id === project.id
    ? savedDelivery
    : project.status === 'delivered' ? project : null
  if (project.status === 'cancelled') {
    return (
      <Card>
        <h2 className="font-display text-lg font-bold text-ink">Entrega</h2>
        <p className="mt-2 text-sm text-muted">Entrega indisponível para projetos cancelados. O histórico existente permanece preservado.</p>
      </Card>
    )
  }
  if (delivered) {
    return (
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <PackageCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="font-display text-lg font-bold text-ink">Entrega registrada</h2>
        </div>
        <p className="text-sm text-muted">Entregue em {formatDateTime(delivered.delivered_at)}</p>
        <div className="flex flex-wrap gap-4">
          {delivered.delivery_url && <SafeLink href={delivered.delivery_url} label="Abrir entrega" />}
          {delivered.files_url && <SafeLink href={delivered.files_url} label="Abrir arquivos" />}
        </div>
        {delivered.final_notes && <p className="text-sm text-ink">{delivered.final_notes}</p>}
        <p className="text-xs text-muted">Este registro não altera contrato, pagamento ou receita.</p>
      </Card>
    )
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (savingRef.current || project.status === 'cancelled') return
    const next: DeliveryErrors = {}
    if (!draft.deliveryUrl) next.deliveryUrl = 'Informe o link de entrega.'
    else if (!isHttpUrl(draft.deliveryUrl)) next.deliveryUrl = 'Informe uma URL HTTP(S) válida.'
    if (draft.filesUrl && !isHttpUrl(draft.filesUrl)) next.filesUrl = 'Informe uma URL HTTP(S) válida.'
    if (!draft.confirmed) next.confirmed = 'Confirme a entrega com o cliente.'
    setErrors(next)
    if (Object.keys(next).length === 0) setConfirmOpen(true)
  }

  const confirmDelivery = async () => {
    if (savingRef.current || project.status === 'cancelled') return
    const deliveryProjectId = project.id
    const payload: DeliveryInput = {
      deliveryUrl: draft.deliveryUrl.trim(), filesUrl: draft.filesUrl.trim(),
      finalNotes: draft.finalNotes.trim(), confirmed: true,
    }
    savingRef.current = true
    setSaving(true)
    try {
      const saved = await deliverProject(deliveryProjectId, payload)
      if (!mountedRef.current || projectIdRef.current !== deliveryProjectId) return
      setSavedDelivery(saved)
      setConfirmOpen(false)
      onDelivered(saved)
      toast('Entrega registrada com sucesso.')
    } catch (cause) {
      if (mountedRef.current && projectIdRef.current === deliveryProjectId) {
        toast(cause instanceof Error && cause.message ? cause.message : 'Não foi possível registrar a entrega.', 'error')
      }
    } finally {
      savingRef.current = false
      if (mountedRef.current) setSaving(false)
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">Registrar entrega</h2>
        <p className="mt-1 text-sm text-muted">A entrega é explícita e não cria receita nem altera pagamentos.</p>
      </div>
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <Input label="Link de entrega *" type="text" inputMode="url" value={draft.deliveryUrl} error={errors.deliveryUrl} disabled={saving} onChange={(event) => { setDraft((current) => ({ ...current, deliveryUrl: event.target.value })); setErrors((current) => ({ ...current, deliveryUrl: undefined })) }} required />
        <Input label="Link dos arquivos" type="text" inputMode="url" value={draft.filesUrl} error={errors.filesUrl} disabled={saving} onChange={(event) => { setDraft((current) => ({ ...current, filesUrl: event.target.value })); setErrors((current) => ({ ...current, filesUrl: undefined })) }} />
        <Textarea label="Notas finais" value={draft.finalNotes} disabled={saving} onChange={(event) => setDraft((current) => ({ ...current, finalNotes: event.target.value }))} rows={3} />
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" checked={draft.confirmed} disabled={saving} onChange={(event) => { setDraft((current) => ({ ...current, confirmed: event.target.checked })); setErrors((current) => ({ ...current, confirmed: undefined })) }} />
          Entrega confirmada com o cliente
        </label>
        {errors.confirmed && <p className="text-sm text-danger">{errors.confirmed}</p>}
        <div><Button type="submit" variant="mint" loading={saving}>Registrar entrega</Button></div>
      </form>
      <ConfirmDialog
        open={confirmOpen}
        title="Confirmar entrega"
        description="Confirmar a entrega deste projeto? Esta ação registra os links e não altera contrato, pagamento ou receita."
        confirmLabel="Confirmar entrega"
        loading={saving}
        onConfirm={() => void confirmDelivery()}
        onCancel={() => { if (!saving) setConfirmOpen(false) }}
      />
    </Card>
  )
}
