import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { createLead, findDuplicateCandidates, updateLead } from '../../services/leadService'
import { getSettings } from '../../services/settingsService'
import {
  emptyLeadDraft,
  LEAD_STATUSES,
  NICHES,
  NICHE_LABELS,
  PRESENCE_FIELDS,
  PRESENCE_FIELD_LABELS,
  PRESENCE_LABELS,
  PRESENCE_VALUES,
  STATUS_LABELS,
  type Lead,
  type LeadWrite,
  type Presence,
} from '../../types/lead'
import { SERVICE_LABELS, type ServicePrices } from '../../types/settings'
import {
  normalizeLeadDraftForSave,
  validateLeadDraft,
  type LeadDraftErrors,
} from '../../lib/leadForm'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'

interface LeadFormProps {
  initial?: LeadWrite
  leadId?: string
  onSaved: (lead: Lead) => void
  onCancel: () => void
}

const sectionTitle = 'font-display text-sm font-semibold text-ink'

export function LeadForm({ initial, leadId, onSaved, onCancel }: LeadFormProps) {
  const [draft, setDraft] = useState<LeadWrite>(initial ?? emptyLeadDraft())
  const [errors, setErrors] = useState<LeadDraftErrors>({})
  const [saving, setSaving] = useState(false)
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<Lead[]>([])
  const [duplicateLookupFailed, setDuplicateLookupFailed] = useState(false)
  const [prices, setPrices] = useState<ServicePrices | null>(null)

  useEffect(() => {
    let active = true
    void getSettings().then(
      (settings) => { if (active) setPrices(settings.service_prices) },
      () => { if (active) setPrices(null) },
    )
    return () => { active = false }
  }, [])

  const set = <K extends keyof LeadWrite,>(key: K, value: LeadWrite[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setDuplicates([])
    setDuplicateLookupFailed(false)
  }

  const setText = <K extends keyof LeadWrite,>(key: K) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      set(key, (event.target.value || null) as LeadWrite[K])

  const persist = async (payload: LeadWrite) => {
    setSaving(true)
    setSaveError(null)
    try {
      const lead = leadId ? await updateLead(leadId, payload) : await createLead(payload)
      onSaved(lead)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const save = async (skipDuplicateCheck: boolean) => {
    if (saving || checkingDuplicates) return

    const validation = validateLeadDraft(draft)
    setErrors(validation)
    setSaveError(null)
    if (Object.values(validation).some(Boolean)) return

    const payload = normalizeLeadDraftForSave(draft)
    setDuplicates([])
    setDuplicateLookupFailed(false)

    if (skipDuplicateCheck) {
      await persist(payload)
      return
    }

    setCheckingDuplicates(true)
    try {
      const candidates = await findDuplicateCandidates(
        { phone: payload.phone, whatsapp: payload.whatsapp, cnpj: payload.cnpj, name: payload.name, city: payload.city },
        leadId,
      )
      if (candidates.length > 0) {
        setDuplicates(candidates)
        return
      }
    } catch {
      setDuplicateLookupFailed(true)
      return
    } finally {
      setCheckingDuplicates(false)
    }

    await persist(payload)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void save(false)
  }

  const applyServicePrice = (service: string) => {
    set('offered_service', service || null)
    if (prices && service && service in prices) {
      set('estimated_value', prices[service as keyof ServicePrices])
    }
  }

  const busy = saving || checkingDuplicates

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-6" noValidate aria-busy={busy}>
      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle}>Informações básicas</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input disabled={busy} label="Nome do estabelecimento *" required value={draft.name} error={errors.name} onChange={(event) => set('name', event.target.value)} />
          <Input disabled={busy} label="Nome do responsável" value={draft.responsible_name ?? ''} onChange={setText('responsible_name')} />
          <Select disabled={busy} label="Nicho" placeholder="Selecione" value={draft.niche ?? ''} onChange={setText('niche')} options={NICHES.map((niche) => ({ value: niche, label: NICHE_LABELS[niche] }))} />
          <Input disabled={busy} label="Origem do lead" placeholder="Ex.: indicação, Instagram, visita" value={draft.source ?? ''} onChange={setText('source')} />
          <Input disabled={busy} label="Telefone" type="tel" placeholder="(11) 99999-9999" value={draft.phone ?? ''} error={errors.phone} onChange={setText('phone')} />
          <Input disabled={busy} label="WhatsApp" type="tel" placeholder="(11) 99999-9999" value={draft.whatsapp ?? ''} error={errors.whatsapp} onChange={setText('whatsapp')} />
          <Input disabled={busy} label="E-mail" type="email" value={draft.email ?? ''} error={errors.email} onChange={setText('email')} />
          <Input disabled={busy} label="CNPJ (se público)" inputMode="numeric" placeholder="00.000.000/0000-00" value={draft.cnpj ?? ''} error={errors.cnpj} onChange={setText('cnpj')} />
          <Input disabled={busy} label="Instagram (link)" type="url" placeholder="https://instagram.com/..." value={draft.instagram ?? ''} error={errors.instagram} onChange={setText('instagram')} />
          <Input disabled={busy} label="Facebook (link)" type="url" placeholder="https://facebook.com/..." value={draft.facebook ?? ''} error={errors.facebook} onChange={setText('facebook')} />
          <Input disabled={busy} label="Site (link)" type="url" placeholder="https://exemplo.com.br" value={draft.website ?? ''} error={errors.website} onChange={setText('website')} />
          <Input disabled={busy} label="Cardápio digital (link)" type="url" placeholder="https://exemplo.com.br/cardapio" value={draft.menu_url ?? ''} error={errors.menu_url} onChange={setText('menu_url')} />
          <Input disabled={busy} label="Catálogo digital (link)" type="url" placeholder="https://exemplo.com.br/catalogo" value={draft.catalog_url ?? ''} error={errors.catalog_url} onChange={setText('catalog_url')} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle}>Localização</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input disabled={busy} label="País" value={draft.country ?? ''} onChange={setText('country')} />
          <Input disabled={busy} label="Estado" value={draft.state ?? ''} onChange={setText('state')} />
          <Input disabled={busy} label="Cidade" value={draft.city ?? ''} onChange={setText('city')} />
          <Input disabled={busy} label="Bairro" value={draft.district ?? ''} onChange={setText('district')} />
          <Input disabled={busy} label="Endereço" value={draft.address ?? ''} onChange={setText('address')} />
          <Input disabled={busy} label="CEP" inputMode="numeric" value={draft.zip_code ?? ''} onChange={setText('zip_code')} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle}>Presença digital</h2>
        <p className="text-xs text-muted">"Não verificado" não conta como ausência. Só marque "Não" quando tiver certeza.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRESENCE_FIELDS.map((field) => (
            <Select disabled={busy}
              key={field}
              label={PRESENCE_FIELD_LABELS[field]}
              value={draft[field]}
              onChange={(event) => set(field, event.target.value as Presence)}
              options={PRESENCE_VALUES.map((value) => ({ value, label: PRESENCE_LABELS[value] }))}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle}>Informações comerciais</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select disabled={busy}
            label="Serviço que pode ser oferecido"
            placeholder="Selecione"
            value={draft.offered_service ?? ''}
            onChange={(event) => applyServicePrice(event.target.value)}
            options={Object.entries(SERVICE_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Input disabled={busy} label="Valor potencial estimado (R$)" type="number" min="0" step="0.01" value={String(draft.estimated_value)} error={errors.estimated_value} onChange={(event) => set('estimated_value', Number(event.target.value) || 0)} />
          <Input disabled={busy} label="Valor negociado (R$)" type="number" min="0" step="0.01" value={String(draft.negotiated_value)} error={errors.negotiated_value} onChange={(event) => set('negotiated_value', Number(event.target.value) || 0)} />
          <Input disabled={busy} label="Valor contratado (R$)" type="number" min="0" step="0.01" value={String(draft.contracted_value)} error={errors.contracted_value} onChange={(event) => set('contracted_value', Number(event.target.value) || 0)} />
          <Input disabled={busy} label="Valor recebido (R$)" type="number" min="0" step="0.01" value={String(draft.received_value)} error={errors.received_value} onChange={(event) => set('received_value', Number(event.target.value) || 0)} />
          <Select disabled={busy || Boolean(leadId)} label="Status" value={draft.status} onChange={(event) => set('status', event.target.value as LeadWrite['status'])} options={LEAD_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] }))} />
          {leadId && (
            <p className="text-xs text-muted sm:col-span-2">
              Use a ficha do lead para alterar o status com confirmação. <Link to={`/leads/${leadId}`} className="text-accent hover:underline">Abrir ficha</Link>
            </p>
          )}
        </div>
        <Textarea disabled={busy} label="Observações" value={draft.notes ?? ''} onChange={setText('notes')} />
      </section>

      {duplicateLookupFailed && (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
          <div className="flex items-center gap-2 text-sm font-medium text-danger">
            <AlertTriangle className="h-4 w-4" /> Não foi possível verificar duplicidades
          </div>
          <p className="mt-1 text-xs text-muted">O lead não foi salvo. Tente novamente para manter a proteção contra duplicidades ou cadastre explicitamente sem verificar.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => void save(false)}>Tentar novamente</Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void save(true)}>Cadastrar sem verificar duplicidades</Button>
          </div>
        </div>
      )}

      {duplicates.length > 0 && (
        <div className="rounded-xl border border-lime/40 bg-lime/5 p-4" role="alert">
          <div className="flex items-center gap-2 text-sm font-medium text-lime">
            <AlertTriangle className="h-4 w-4" /> Possível duplicidade
          </div>
          <p className="mt-1 text-xs text-muted">Encontramos registro(s) com telefone, WhatsApp, CNPJ ou nome+localização parecidos. Verifique antes de cadastrar:</p>
          <ul className="mt-2 flex flex-col gap-1">
            {duplicates.map((duplicate) => (
              <li key={duplicate.id}>
                <Link to={`/leads/${duplicate.id}`} className="text-sm text-accent hover:underline">
                  {duplicate.name}{duplicate.city ? ` — ${duplicate.city}` : ''}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => void save(true)}>Cadastrar mesmo assim</Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setDuplicates([])}>Voltar e revisar</Button>
          </div>
        </div>
      )}

      {saveError && <p className="text-sm text-danger" role="alert">{saveError}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancelar</Button>
        <Button type="submit" variant="mint" loading={busy}>
          {checkingDuplicates ? 'Verificando duplicidade…' : leadId ? 'Salvar alterações' : 'Cadastrar lead'}
        </Button>
      </div>
    </form>
  )
}
