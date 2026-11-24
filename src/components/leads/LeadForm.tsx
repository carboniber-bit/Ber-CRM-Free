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
import { onlyDigits } from '../../lib/format'
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

type Errors = Partial<Record<keyof LeadWrite, string>>

const URL_FIELDS = ['website', 'menu_url', 'catalog_url', 'instagram', 'facebook'] as const

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0)
    if (code !== undefined && (code <= 31 || code === 127)) return true
  }
  return false
}

function isValidHostname(hostname: string, requireDomain: boolean): boolean {
  const normalized = hostname.replace(/\.$/, '').toLowerCase()
  if (!normalized) return false
  if (normalized.startsWith('[') && normalized.endsWith(']')) return !requireDomain

  const labels = normalized.split('.')
  if (requireDomain && labels.length < 2) return false
  if (!labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) return false

  const topLevelDomain = labels[labels.length - 1]
  return !requireDomain || (topLevelDomain.length >= 2 && !/^\d+$/.test(topLevelDomain))
}

function normalizeUrl(raw: string): string | null {
  const value = raw.trim()
  if (!value || value.startsWith('/') || value.includes('\\') || /\s/.test(value) || hasControlCharacter(value) || /%(?![0-9a-f]{2})/i.test(value)) return null

  const isHttpUrl = /^https?:\/\//i.test(value)
  if (/^https?:\/\/\//i.test(value)) return null
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(value)
  const isHostWithPort = /^[^/?#@:\\]+:\d+(?:[/?#]|$)/.test(value)
  if (hasScheme && !isHttpUrl && !isHostWithPort) return null

  const candidate = isHttpUrl ? value : `https://${value}`
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (!url.hostname || url.username || url.password) return null
  if (!isValidHostname(url.hostname, !isHttpUrl)) return null
  return candidate
}

function validate(draft: LeadWrite): Errors {
  const errors: Errors = {}
  if (!draft.name.trim()) errors.name = 'Nome do estabelecimento é obrigatório.'

  const email = draft.email?.trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'E-mail inválido.'

  for (const field of ['phone', 'whatsapp'] as const) {
    const value = draft[field]
    if (!value) continue
    const digits = onlyDigits(value)
    const valid = (digits.length === 10 || digits.length === 11)
      || ((digits.length === 12 || digits.length === 13) && digits.startsWith('55'))
    if (!valid) errors[field] = 'Use 10–11 dígitos com DDD ou 12–13 dígitos começando com 55.'
  }

  if (draft.cnpj && onlyDigits(draft.cnpj).length !== 14) errors.cnpj = 'CNPJ deve ter 14 dígitos.'

  for (const field of URL_FIELDS) {
    const value = draft[field]?.trim()
    if (value && !normalizeUrl(value)) errors[field] = 'Informe uma URL válida (http://, https:// ou domínio).'
  }

  for (const field of ['estimated_value', 'negotiated_value', 'contracted_value', 'received_value'] as const) {
    if (!Number.isFinite(draft[field]) || draft[field] < 0) errors[field] = 'Valor inválido.'
  }

  return errors
}

function normalizeUrls(draft: LeadWrite): LeadWrite {
  const normalized = { ...draft }
  for (const field of URL_FIELDS) {
    normalized[field] = normalizeUrl(draft[field] ?? '')
  }
  return normalized
}

const sectionTitle = 'font-display text-sm font-semibold text-ink'

export function LeadForm({ initial, leadId, onSaved, onCancel }: LeadFormProps) {
  const [draft, setDraft] = useState<LeadWrite>(initial ?? emptyLeadDraft())
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<Lead[]>([])
  const [forceSave, setForceSave] = useState(false)
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
      setForceSave(false)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving || checkingDuplicates) return

    const validation = validate(draft)
    setErrors(validation)
    setSaveError(null)
    if (Object.values(validation).some(Boolean)) return

    const payload = normalizeUrls(draft)
    setDuplicates([])

    if (!forceSave) {
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
        // A busca de duplicidade não bloqueia o cadastro quando falha.
      } finally {
        setCheckingDuplicates(false)
      }
    }

    await persist(payload)
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
          <Select disabled={busy} label="Status" value={draft.status} onChange={(event) => set('status', event.target.value as LeadWrite['status'])} options={LEAD_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] }))} />
        </div>
        <Textarea disabled={busy} label="Observações" value={draft.notes ?? ''} onChange={setText('notes')} />
      </section>

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
            <Button type="button" variant="outline" onClick={() => { setDuplicates([]); setForceSave(true) }}>Cadastrar mesmo assim</Button>
            <Button type="button" variant="ghost" onClick={() => setDuplicates([])}>Voltar e revisar</Button>
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
