# Etapa 2 — Plano 2: Módulo de Leads (CRUD, ficha, prospecção, CSV)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página Leads completa (lista, filtros, CRUD, duplicidades, CSV) e ficha do lead com presença digital, checklist, oportunidade, valores, timeline, follow-ups e ações de prospecção (WhatsApp manual).

**Architecture:** Páginas com estado local de dados (fetch via services do Plano 1), componentes focados por responsabilidade em `components/leads/`, reutilização do kit de UI. Um único registro de lead compartilhado por todos os módulos.

**Tech Stack:** React 19, TS, Tailwind v4, services Supabase (Plano 1), papaparse via `lib/csv`.

**Spec:** `docs/superpowers/specs/2026-11-22-etapa2-design.md` · **Depende do Plano 1 completo** (migration executada, tipos, libs, services, UI kit, sidebar).

## Global Constraints

(Idênticas ao Plano 1 — reler o header de `2026-11-22-etapa2-plano1-fundacao.md`.) Destaques: pt-BR; tri-estado `unverified` padrão; ausência só com `no`; WhatsApp nunca envia automaticamente; status só muda com confirmação explícita; nada de dados fictícios; confirmação antes de excluir; credenciais de teste nunca em arquivos; `npm run build && npm run lint` passam a cada tarefa.

---

### Task 1: Página Leads — lista, filtros, ordenação, paginação, exclusão

**Files:**
- Create: `src/pages/LeadsPage.tsx`, `src/components/leads/LeadFiltersBar.tsx`
- Modify: `src/routes/AppRoutes.tsx` (rota `/leads`), `src/layouts/AppLayout.tsx` (navItems: Leads ganha `to: '/leads'`, remove `stage`)

**Interfaces:**
- Consumes: `listLeads`, `deleteLead` (leadService); `Lead`, `LeadFilters`, `LeadSort`, `NICHES`, `NICHE_LABELS`, `LEAD_STATUSES`, `STATUS_LABELS`, `PRESENCE_FIELDS`, `PRESENCE_FIELD_LABELS`, `PRESENCE_VALUES`, `PRESENCE_LABELS`; UI kit (Button, Input, Select, Card, Skeleton, EmptyState, ConfirmDialog, ScoreBar, PriorityBadge, StatusBadge); `useToast`; `formatBRL`, `formatDate`.
- Produces: rota `/leads` funcional; `LeadFiltersBar { filters: LeadFilters; sort: LeadSort; onChange: (filters: LeadFilters) => void; onSortChange: (sort: LeadSort) => void }`.

- [ ] **Step 1: Criar `src/components/leads/LeadFiltersBar.tsx`**

```tsx
import { Search } from 'lucide-react'
import {
  LEAD_STATUSES, NICHES, NICHE_LABELS, PRESENCE_FIELDS, PRESENCE_FIELD_LABELS,
  PRESENCE_LABELS, PRESENCE_VALUES, STATUS_LABELS,
  type LeadFilters, type LeadSort, type Presence, type PresenceField,
} from '../../types/lead'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'

interface LeadFiltersBarProps {
  filters: LeadFilters
  sort: LeadSort
  onChange: (filters: LeadFilters) => void
  onSortChange: (sort: LeadSort) => void
}

const sortOptions = [
  { value: 'created_desc', label: 'Mais recentes' },
  { value: 'created_asc', label: 'Mais antigos' },
  { value: 'score_desc', label: 'Maior pontuação' },
  { value: 'score_asc', label: 'Menor pontuação' },
]

export function LeadFiltersBar({ filters, sort, onChange, onSortChange }: LeadFiltersBarProps) {
  const set = (patch: Partial<LeadFilters>) => onChange({ ...filters, ...patch })

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="relative sm:col-span-2 lg:col-span-1">
        <Input
          label="Buscar por nome"
          placeholder="Nome do estabelecimento"
          value={filters.search ?? ''}
          onChange={(e) => set({ search: e.target.value || undefined })}
        />
        <Search className="pointer-events-none absolute right-3 top-9 h-4 w-4 text-muted" />
      </div>
      <Select
        label="Nicho"
        placeholder="Todos"
        value={filters.niche ?? ''}
        onChange={(e) => set({ niche: e.target.value || undefined })}
        options={NICHES.map((n) => ({ value: n, label: NICHE_LABELS[n] }))}
      />
      <Input label="Cidade" placeholder="Todas" value={filters.city ?? ''} onChange={(e) => set({ city: e.target.value || undefined })} />
      <Input label="Bairro" placeholder="Todos" value={filters.district ?? ''} onChange={(e) => set({ district: e.target.value || undefined })} />
      <Select
        label="Status"
        placeholder="Todos"
        value={filters.status ?? ''}
        onChange={(e) => set({ status: (e.target.value || undefined) as LeadFilters['status'] })}
        options={LEAD_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
      />
      <Select
        label="Presença digital"
        placeholder="Qualquer"
        value={filters.presenceField ?? ''}
        onChange={(e) => set({ presenceField: (e.target.value || undefined) as PresenceField | undefined, presenceValue: e.target.value ? filters.presenceValue ?? 'no' : undefined })}
        options={PRESENCE_FIELDS.map((f) => ({ value: f, label: PRESENCE_FIELD_LABELS[f] }))}
      />
      <Select
        label="Valor da presença"
        placeholder="—"
        value={filters.presenceValue ?? ''}
        disabled={!filters.presenceField}
        onChange={(e) => set({ presenceValue: (e.target.value || undefined) as Presence | undefined })}
        options={PRESENCE_VALUES.map((v) => ({ value: v, label: PRESENCE_LABELS[v] }))}
      />
      <Select label="Ordenar por" value={sort} onChange={(e) => onSortChange(e.target.value as LeadSort)} options={sortOptions} />
      <Input label="Cadastrado de" type="date" value={filters.createdFrom ?? ''} onChange={(e) => set({ createdFrom: e.target.value || undefined })} />
      <Input label="Cadastrado até" type="date" value={filters.createdTo ?? ''} onChange={(e) => set({ createdTo: e.target.value || undefined })} />
    </div>
  )
}
```

- [ ] **Step 2: Criar `src/pages/LeadsPage.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { Plus, RefreshCw, Trash2, Users } from 'lucide-react'
import { deleteLead, listLeads } from '../services/leadService'
import type { Lead, LeadFilters, LeadSort } from '../types/lead'
import { NICHE_LABELS, type Niche } from '../types/lead'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { ScoreBar } from '../components/ui/ScoreBar'
import { Skeleton } from '../components/ui/Skeleton'
import { StatusBadge } from '../components/ui/StatusBadge'
import { LeadFiltersBar } from '../components/leads/LeadFiltersBar'
import { useToast } from '../hooks/useToast'
import { formatBRL, formatDate } from '../lib/format'

const PAGE_SIZE = 20

export function LeadsPage() {
  const { toast } = useToast()
  const [filters, setFilters] = useState<LeadFilters>({})
  const [sort, setSort] = useState<LeadSort>('created_desc')
  const [page, setPage] = useState(0)
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Lead | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listLeads(filters, sort, page, PAGE_SIZE)
      setLeads(result.leads)
      setTotal(result.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar leads.')
    } finally {
      setLoading(false)
    }
  }, [filters, sort, page])

  useEffect(() => { void load() }, [load])

  const changeFilters = (next: LeadFilters) => { setFilters(next); setPage(0) }
  const changeSort = (next: LeadSort) => { setSort(next); setPage(0) }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await deleteLead(deleting.id)
      toast('Lead excluído.', 'success')
      setDeleting(null)
      void load()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro ao excluir.', 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Leads</h1>
          <p className="text-sm text-muted">{total} estabelecimento{total === 1 ? '' : 's'} cadastrado{total === 1 ? '' : 's'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
          <Button variant="mint" disabled title="Formulário chega na Task 2"><Plus className="h-4 w-4" /> Novo lead</Button>
        </div>
      </div>

      <Card>
        <LeadFiltersBar filters={filters} sort={sort} onChange={changeFilters} onSortChange={changeSort} />
      </Card>

      {error && (
        <Card className="border-danger/40">
          <p className="text-sm text-danger">{error}</p>
          <Button variant="outline" className="mt-3" onClick={() => void load()}>Tentar novamente</Button>
        </Card>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title={total === 0 && !filters.search ? 'Nenhum lead cadastrado' : 'Nenhum lead encontrado'}
          description={total === 0 && !filters.search
            ? 'Cadastre o primeiro estabelecimento para começar a prospectar. Você também pode importar uma planilha CSV.'
            : 'Ajuste os filtros ou a busca para encontrar o que procura.'}
          action={<Button variant="mint" disabled title="Formulário chega na Task 2"><Plus className="h-4 w-4" /> Cadastrar lead</Button>}
        />
      ) : (
        <>
          {/* Desktop: tabela */}
          <Card className="hidden overflow-x-auto p-0 md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Estabelecimento</th>
                  <th className="px-4 py-3 font-medium">Nicho</th>
                  <th className="px-4 py-3 font-medium">Cidade</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Pontuação</th>
                  <th className="px-4 py-3 font-medium">Valor est.</th>
                  <th className="px-4 py-3 font-medium">Cadastro</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-line/50 transition-colors last:border-0 hover:bg-elevated/50">
                    <td className="px-4 py-3">
                      <Link to={`/leads/${lead.id}`} className="font-medium text-ink hover:text-primary">{lead.name}</Link>
                      {lead.responsible_name && <p className="text-xs text-muted">{lead.responsible_name}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted">{lead.niche ? NICHE_LABELS[lead.niche as Niche] ?? lead.niche : '—'}</td>
                    <td className="px-4 py-3 text-muted">{lead.city ?? '—'}{lead.district ? ` · ${lead.district}` : ''}</td>
                    <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                    <td className="px-4 py-3"><div className="w-28"><ScoreBar score={lead.score} /></div></td>
                    <td className="px-4 py-3 text-muted">{formatBRL(lead.estimated_value)}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(lead.created_at)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setDeleting(lead)} aria-label={`Excluir ${lead.name}`} className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile: cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {leads.map((lead) => (
              <Card key={lead.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/leads/${lead.id}`} className="font-medium text-ink hover:text-primary">{lead.name}</Link>
                  <button onClick={() => setDeleting(lead)} aria-label={`Excluir ${lead.name}`} className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {lead.niche ? NICHE_LABELS[lead.niche as Niche] ?? lead.niche : 'Sem nicho'} · {lead.city ?? 'Sem cidade'}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <StatusBadge status={lead.status} />
                  <span className="text-xs text-muted">{formatBRL(lead.estimated_value)}</span>
                </div>
                <div className="mt-3"><ScoreBar score={lead.score} /></div>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between text-sm text-muted">
            <span>Página {page + 1} de {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir lead"
        description={`Excluir "${deleting?.name}"? Todas as atividades, follow-ups e verificações deste lead também serão removidos. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleteLoading}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
```

Nota: o botão "Novo lead" nasce disabled nesta task (sem rota ainda) e é ativado na Task 2, que cria `/leads/novo` e troca os dois botões disabled por `<Link to="/leads/novo">` (cabeçalho e EmptyState), reintroduzindo o import de `Link`. Nenhum botão leva a rota inexistente.

- [ ] **Step 3: Registrar rota e ativar item da sidebar**

Em `src/routes/AppRoutes.tsx`, dentro do bloco `<Route element={<AppLayout />}>`:
```tsx
<Route path="/leads" element={<LeadsPage />} />
```
+ import `{ LeadsPage } from '../pages/LeadsPage'`.

Em `src/layouts/AppLayout.tsx`, no array `navItems`, trocar `{ label: 'Leads', icon: Users, stage: 'Etapa 2' }` por `{ label: 'Leads', icon: Users, to: '/leads' }`.

- [ ] **Step 4: Build + lint + navegador**

Run: `npm run build && npm run lint`
Expected: PASS. Navegador logado: `/leads` mostra estado vazio orientando cadastro; filtros renderizam; sidebar leva a Leads; mobile mostra cards em vez de tabela.

- [ ] **Step 5: Commit**

```bash
git add src/pages/LeadsPage.tsx src/components/leads/LeadFiltersBar.tsx src/routes/AppRoutes.tsx src/layouts/AppLayout.tsx
git commit -m "Pagina Leads: lista, filtros, ordenacao, paginacao e exclusao com confirmacao"
```

---

### Task 2: Formulário de lead (criar/editar) com validação e aviso de duplicidade

**Files:**
- Create: `src/components/leads/LeadForm.tsx`, `src/pages/LeadNewPage.tsx`, `src/pages/LeadEditPage.tsx`
- Modify: `src/routes/AppRoutes.tsx` (`/leads/novo`, `/leads/:id/editar`), `src/pages/LeadsPage.tsx` (ativar botão Novo lead)

**Interfaces:**
- Consumes: `createLead`, `updateLead`, `getLead`, `findDuplicateCandidates`; `emptyLeadDraft`, `LeadWrite`, `Lead`, constantes de domínio; `settingsService.getSettings` (sugestão de valor por serviço); UI kit; `useToast`; `onlyDigits`.
- Produces: `LeadForm { initial: LeadWrite; leadId?: string; onSaved: (lead: Lead) => void; onCancel: () => void }` — formulário completo em seções; validação; aviso de duplicidade com "ver existente" e "cadastrar mesmo assim".

Validação (pt-BR, inline por campo): nome obrigatório; e-mail formato básico se preenchido; telefone/whatsapp 10–11 dígitos se preenchidos; CNPJ 14 dígitos se preenchido; URLs (site, cardápio, catálogo, instagram, facebook) devem começar com `http://`/`https://` ou conter `.` se preenchidas; valores ≥ 0.

- [ ] **Step 1: Criar `src/components/leads/LeadForm.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { createLead, findDuplicateCandidates, updateLead } from '../../services/leadService'
import { getSettings } from '../../services/settingsService'
import {
  emptyLeadDraft, LEAD_STATUSES, NICHES, NICHE_LABELS, PRESENCE_FIELDS,
  PRESENCE_FIELD_LABELS, PRESENCE_LABELS, PRESENCE_VALUES, STATUS_LABELS,
  type Lead, type LeadWrite, type Presence,
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

type Errors = Partial<Record<string, string>>

function validate(draft: LeadWrite): Errors {
  const errors: Errors = {}
  if (!draft.name.trim()) errors.name = 'Nome do estabelecimento é obrigatório.'
  if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) errors.email = 'E-mail inválido.'
  for (const field of ['phone', 'whatsapp'] as const) {
    const value = draft[field]
    if (value && (onlyDigits(value).length < 10 || onlyDigits(value).length > 11)) {
      errors[field] = 'Use DDD + número (10 ou 11 dígitos).'
    }
  }
  if (draft.cnpj && onlyDigits(draft.cnpj).length !== 14) errors.cnpj = 'CNPJ deve ter 14 dígitos.'
  for (const field of ['website', 'menu_url', 'catalog_url', 'instagram', 'facebook'] as const) {
    const value = draft[field]
    if (value && !/^https?:\/\//.test(value) && !value.includes('.')) {
      errors[field] = 'Informe um link válido (https://...).'
    }
  }
  for (const field of ['estimated_value', 'negotiated_value', 'contracted_value', 'received_value'] as const) {
    if (draft[field] < 0 || !Number.isFinite(draft[field])) errors[field] = 'Valor inválido.'
  }
  return errors
}

const sectionTitle = 'font-display text-sm font-semibold text-ink'

export function LeadForm({ initial, leadId, onSaved, onCancel }: LeadFormProps) {
  const [draft, setDraft] = useState<LeadWrite>(initial ?? emptyLeadDraft())
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<Lead[]>([])
  const [forceSave, setForceSave] = useState(false)
  const [prices, setPrices] = useState<ServicePrices | null>(null)

  useEffect(() => {
    void getSettings().then((s) => setPrices(s.service_prices)).catch(() => setPrices(null))
  }, [])

  const set = <K extends keyof LeadWrite>(key: K, value: LeadWrite[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }
  const setText = (key: keyof LeadWrite) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    set(key, (e.target.value || null) as LeadWrite[typeof key])

  const persist = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const lead = leadId ? await updateLead(leadId, draft) : await createLead(draft)
      onSaved(lead)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validation = validate(draft)
    setErrors(validation)
    if (Object.keys(validation).some((k) => validation[k])) return
    if (!forceSave) {
      try {
        const candidates = await findDuplicateCandidates(
          { phone: draft.phone, whatsapp: draft.whatsapp, cnpj: draft.cnpj, name: draft.name, city: draft.city },
          leadId,
        )
        if (candidates.length > 0) {
          setDuplicates(candidates)
          return
        }
      } catch {
        // busca de duplicidade falhou: não bloqueia o cadastro
      }
    }
    await persist()
  }

  const applyServicePrice = (service: string) => {
    set('offered_service', service || null)
    if (prices && service && service in prices) {
      set('estimated_value', prices[service as keyof ServicePrices])
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-6" noValidate>
      <section className="flex flex-col gap-3">
        <h3 className={sectionTitle}>Informações básicas</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Nome do estabelecimento *" value={draft.name} error={errors.name} onChange={(e) => set('name', e.target.value)} />
          <Input label="Nome do responsável" value={draft.responsible_name ?? ''} onChange={setText('responsible_name')} />
          <Select label="Nicho" placeholder="Selecione" value={draft.niche ?? ''} onChange={setText('niche')} options={NICHES.map((n) => ({ value: n, label: NICHE_LABELS[n] }))} />
          <Input label="Origem do lead" placeholder="Ex.: indicação, Instagram, visita" value={draft.source ?? ''} onChange={setText('source')} />
          <Input label="Telefone" value={draft.phone ?? ''} error={errors.phone} onChange={setText('phone')} />
          <Input label="WhatsApp" value={draft.whatsapp ?? ''} error={errors.whatsapp} onChange={setText('whatsapp')} />
          <Input label="E-mail" type="email" value={draft.email ?? ''} error={errors.email} onChange={setText('email')} />
          <Input label="CNPJ (se público)" value={draft.cnpj ?? ''} error={errors.cnpj} onChange={setText('cnpj')} />
          <Input label="Instagram (link)" value={draft.instagram ?? ''} error={errors.instagram} onChange={setText('instagram')} />
          <Input label="Facebook (link)" value={draft.facebook ?? ''} error={errors.facebook} onChange={setText('facebook')} />
          <Input label="Site (link)" value={draft.website ?? ''} error={errors.website} onChange={setText('website')} />
          <Input label="Cardápio digital (link)" value={draft.menu_url ?? ''} error={errors.menu_url} onChange={setText('menu_url')} />
          <Input label="Catálogo digital (link)" value={draft.catalog_url ?? ''} error={errors.catalog_url} onChange={setText('catalog_url')} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className={sectionTitle}>Localização</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="País" value={draft.country ?? ''} onChange={setText('country')} />
          <Input label="Estado" value={draft.state ?? ''} onChange={setText('state')} />
          <Input label="Cidade" value={draft.city ?? ''} onChange={setText('city')} />
          <Input label="Bairro" value={draft.district ?? ''} onChange={setText('district')} />
          <Input label="Endereço" value={draft.address ?? ''} onChange={setText('address')} />
          <Input label="CEP" value={draft.zip_code ?? ''} onChange={setText('zip_code')} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className={sectionTitle}>Presença digital</h3>
        <p className="text-xs text-muted">"Não verificado" não conta como ausência. Só marque "Não" quando tiver certeza.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRESENCE_FIELDS.map((field) => (
            <Select
              key={field}
              label={PRESENCE_FIELD_LABELS[field]}
              value={draft[field]}
              onChange={(e) => set(field, e.target.value as Presence)}
              options={PRESENCE_VALUES.map((v) => ({ value: v, label: PRESENCE_LABELS[v] }))}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className={sectionTitle}>Informações comerciais</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Serviço que pode ser oferecido"
            placeholder="Selecione"
            value={draft.offered_service ?? ''}
            onChange={(e) => applyServicePrice(e.target.value)}
            options={Object.entries(SERVICE_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Input label="Valor potencial estimado (R$)" type="number" min="0" step="0.01" value={String(draft.estimated_value)} error={errors.estimated_value} onChange={(e) => set('estimated_value', Number(e.target.value) || 0)} />
          <Select label="Status" value={draft.status} onChange={(e) => set('status', e.target.value as LeadWrite['status'])} options={LEAD_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))} />
          <Input label="Próxima data de contato" type="datetime-local" value={draft.next_contact_at ? draft.next_contact_at.slice(0, 16) : ''} onChange={(e) => set('next_contact_at', e.target.value ? new Date(e.target.value).toISOString() : null)} />
        </div>
        <Textarea label="Observações" value={draft.notes ?? ''} onChange={setText('notes')} />
      </section>

      {duplicates.length > 0 && (
        <div className="rounded-xl border border-lime/40 bg-lime/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-lime">
            <AlertTriangle className="h-4 w-4" /> Possível duplicidade
          </div>
          <p className="mt-1 text-xs text-muted">Encontramos registro(s) com telefone, WhatsApp, CNPJ ou nome+localização parecidos. Verifique antes de cadastrar:</p>
          <ul className="mt-2 flex flex-col gap-1">
            {duplicates.map((dup) => (
              <li key={dup.id}>
                <Link to={`/leads/${dup.id}`} className="text-sm text-accent hover:underline">{dup.name}{dup.city ? ` — ${dup.city}` : ''}</Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="outline" onClick={() => { setDuplicates([]); setForceSave(true) }}>Cadastrar mesmo assim</Button>
            <Button type="button" variant="ghost" onClick={() => setDuplicates([])}>Voltar e revisar</Button>
          </div>
        </div>
      )}

      {saveError && <p className="text-sm text-danger">{saveError}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button type="submit" variant="mint" loading={saving}>{leadId ? 'Salvar alterações' : 'Cadastrar lead'}</Button>
      </div>
    </form>
  )
}
```

**Atenção na implementação:** `forceSave` deve resetar para false após persist bem-sucedido — adicionar `setForceSave(false)` no `finally` de `persist`. Após `setForceSave(true)`, o próximo submit pula a checagem de duplicidade uma vez.

- [ ] **Step 2: Criar páginas `LeadNewPage` e `LeadEditPage`**

```tsx
// src/pages/LeadNewPage.tsx
import { useNavigate } from 'react-router-dom'
import { LeadForm } from '../components/leads/LeadForm'
import { Card } from '../components/ui/Card'
import { useToast } from '../hooks/useToast'

export function LeadNewPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <h1 className="font-display text-xl font-bold text-ink">Novo lead</h1>
      <Card>
        <LeadForm
          onSaved={(lead) => { toast('Lead cadastrado com sucesso.'); navigate(`/leads/${lead.id}`) }}
          onCancel={() => navigate('/leads')}
        />
      </Card>
    </div>
  )
}
```

```tsx
// src/pages/LeadEditPage.tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getLead } from '../services/leadService'
import type { Lead, LeadWrite } from '../types/lead'
import { LeadForm } from '../components/leads/LeadForm'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../hooks/useToast'

export function LeadEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [lead, setLead] = useState<Lead | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    void getLead(id).then(setLead).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erro ao carregar lead.'))
  }, [id])

  if (error) return <Card className="border-danger/40"><p className="text-sm text-danger">{error}</p></Card>
  if (!lead) return <Skeleton className="h-96" />

  const initial: LeadWrite = { ...lead }
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <h1 className="font-display text-xl font-bold text-ink">Editar lead</h1>
      <Card>
        <LeadForm
          initial={initial}
          leadId={lead.id}
          onSaved={() => { toast('Alterações salvas.'); navigate(`/leads/${lead.id}`) }}
          onCancel={() => navigate(`/leads/${lead.id}`)}
        />
      </Card>
    </div>
  )
}
```

Nota: `LeadWrite` é `Omit<Lead, ...>` — `{ ...lead }` tem campos extras; TS aceita excesso via spread? Não em atribuição direta de objeto literal com propriedades conhecidas — spread de tipo mais largo para mais estreito É permitido (excess property check não se aplica a spreads). OK.

- [ ] **Step 3: Rotas + ativar botão**

Em `AppRoutes.tsx` (dentro de AppLayout):
```tsx
<Route path="/leads/novo" element={<LeadNewPage />} />
<Route path="/leads/:id/editar" element={<LeadEditPage />} />
```
+ imports. Em `LeadsPage.tsx`, trocar o botão disabled provisório por `<Link to="/leads/novo"><Button variant="mint"><Plus .../> Novo lead</Button></Link>` (e no EmptyState idem).

- [ ] **Step 4: Build + lint + teste manual no navegador**

Run: `npm run build && npm run lint`
Testar logado: cadastrar lead com nome vazio → erro inline; telefone inválido → erro; cadastrar "Barbearia Teste" com cidade → salva e redireciona à ficha (ficha ainda não existe → 404 até Task 3; **por enquanto onSaved navega para `/leads`** — trocar temporariamente para `navigate('/leads')` nas duas páginas e restaurar na Task 3). Cadastrar segundo lead com mesmo telefone → aviso de duplicidade com link; "Cadastrar mesmo assim" funciona. Editar lead → valores persistem.

- [ ] **Step 5: Commit**

```bash
git add src/components/leads/LeadForm.tsx src/pages/LeadNewPage.tsx src/pages/LeadEditPage.tsx src/routes/AppRoutes.tsx src/pages/LeadsPage.tsx
git commit -m "Formulario de lead com validacao, tri-estado e aviso de duplicidade"
```

---

### Task 3: Ficha do lead — dados, presença, checklist, oportunidade, valores

**Files:**
- Create: `src/pages/LeadDetailPage.tsx`, `src/components/leads/LeadChecklist.tsx`, `src/components/leads/OpportunityPanel.tsx`
- Modify: `src/routes/AppRoutes.tsx` (`/leads/:id`), `src/pages/LeadNewPage.tsx` e `LeadEditPage.tsx` (restaurar navegação para a ficha)

**Interfaces:**
- Consumes: `getLead`, `digitalCheckService.listChecks/setCheck`, `CHECK_ITEMS/CHECK_LABELS`, UI kit, `useToast`, formatadores, `NEED_LABELS`, `PRIORITY_LABELS`.
- Produces: rota `/leads/:id`; `LeadChecklist { leadId: string; onChanged: () => void }`; `OpportunityPanel { lead: Lead }` (barra, prioridade, necessidades, seção "Por que esta empresa é uma oportunidade?" com `score_reasons`; se vazio, mensagem de verificação pendente). A ficha expõe `reload()` usado pelas Tasks 4–5.

- [ ] **Step 1: Criar `src/components/leads/OpportunityPanel.tsx`**

```tsx
import { Lightbulb } from 'lucide-react'
import { NEED_LABELS, PRIORITY_LABELS, type Lead } from '../../types/lead'
import { Card } from '../ui/Card'
import { PriorityBadge } from '../ui/PriorityBadge'
import { ScoreBar } from '../ui/ScoreBar'

export function OpportunityPanel({ lead }: { lead: Lead }) {
  return (
    <Card title="Oportunidade" dot="lime">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <ScoreBar score={lead.score} />
          <PriorityBadge priority={lead.priority} />
        </div>
        {lead.needs.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {lead.needs.map((need) => (
              <span key={need} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{NEED_LABELS[need]}</span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Nenhuma necessidade confirmada. Verifique a presença digital para identificar oportunidades.</p>
        )}
        <div className="rounded-xl border border-line bg-elevated p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <Lightbulb className="h-4 w-4 text-lime" />
            Por que esta empresa é uma oportunidade?
          </div>
          {lead.score_reasons.length > 0 ? (
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
              {lead.score_reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Sem critérios confirmados (pontuação {lead.score}, prioridade {PRIORITY_LABELS[lead.priority].toLowerCase()}).
              As justificativas usam apenas informações cadastradas ou verificadas — nada é presumido.
            </p>
          )}
        </div>
        <p className="text-xs text-muted">Pontuação = estimativa de oportunidade comercial, não garantia de contratação.</p>
      </div>
    </Card>
  )
}
```

- [ ] **Step 2: Criar `src/components/leads/LeadChecklist.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { listChecks, setCheck } from '../../services/digitalCheckService'
import { CHECK_ITEMS, CHECK_LABELS, type CheckItem, type DigitalCheck } from '../../types/check'
import { formatDateTime } from '../../lib/format'
import { Card } from '../ui/Card'
import { Skeleton } from '../ui/Skeleton'
import { useToast } from '../../hooks/useToast'
import { cn } from '../../utils/cn'

export function LeadChecklist({ leadId, onChanged }: { leadId: string; onChanged: () => void }) {
  const { toast } = useToast()
  const [checks, setChecks] = useState<DigitalCheck[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<CheckItem | null>(null)

  const load = useCallback(async () => {
    try {
      setChecks(await listChecks(leadId))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro ao carregar checklist.', 'error')
    } finally {
      setLoading(false)
    }
  }, [leadId, toast])

  useEffect(() => { void load() }, [load])

  const toggle = async (item: CheckItem, verified: boolean) => {
    setBusy(item)
    try {
      await setCheck(leadId, item, verified)
      await load()
      onChanged()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro ao atualizar verificação.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const byItem = new Map(checks.map((c) => [c.item, c]))

  return (
    <Card title="Checklist de verificação digital" dot="accent">
      {loading ? (
        <Skeleton className="h-40" />
      ) : (
        <ul className="flex flex-col gap-1">
          {CHECK_ITEMS.map((item) => {
            const check = byItem.get(item)
            const verified = check?.verified ?? false
            return (
              <li key={item}>
                <button
                  onClick={() => void toggle(item, !verified)}
                  disabled={busy === item}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-elevated',
                    verified ? 'text-ink' : 'text-muted',
                  )}
                >
                  {verified ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> : <Circle className="h-4 w-4 shrink-0" />}
                  <span className="flex-1">{CHECK_LABELS[item]}</span>
                  {verified && check?.verified_at && (
                    <span className="text-xs text-muted">{formatDateTime(check.verified_at)}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
```

- [ ] **Step 3: Criar `src/pages/LeadDetailPage.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil } from 'lucide-react'
import { getLead } from '../services/leadService'
import { NICHE_LABELS, PRESENCE_FIELDS, PRESENCE_FIELD_LABELS, type Lead, type Niche } from '../types/lead'
import { formatBRL, formatDate, formatDateTime, formatPhone } from '../lib/format'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { PresenceBadge } from '../components/ui/PresenceBadge'
import { Skeleton } from '../components/ui/Skeleton'
import { StatusBadge } from '../components/ui/StatusBadge'
import { LeadChecklist } from '../components/leads/LeadChecklist'
import { OpportunityPanel } from '../components/leads/OpportunityPanel'

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm text-ink">{value || '—'}</span>
    </div>
  )
}

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!id) return
    try {
      setLead(await getLead(id))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar lead.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void reload() }, [reload])

  if (loading) return <div className="flex flex-col gap-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>
  if (error || !lead) {
    return (
      <Card className="border-danger/40">
        <p className="text-sm text-danger">{error ?? 'Lead não encontrado.'}</p>
        <Link to="/leads" className="mt-3 inline-block text-sm text-accent hover:underline">Voltar para Leads</Link>
      </Card>
    )
  }

  const location = [lead.address, lead.district, lead.city, lead.state, lead.zip_code].filter(Boolean).join(', ')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/leads" className="mb-1 inline-flex items-center gap-1 text-xs text-muted hover:text-ink"><ArrowLeft className="h-3 w-3" /> Leads</Link>
          <h1 className="font-display text-xl font-bold text-ink">{lead.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <StatusBadge status={lead.status} />
            <span>{lead.niche ? NICHE_LABELS[lead.niche as Niche] ?? lead.niche : 'Sem nicho'}</span>
            {lead.city && <span>· {lead.city}</span>}
          </div>
        </div>
        <Link to={`/leads/${lead.id}/editar`}><Button variant="outline"><Pencil className="h-4 w-4" /> Editar</Button></Link>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card title="Informações" dot="mint">
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              <InfoRow label="Responsável" value={lead.responsible_name} />
              <InfoRow label="Telefone" value={lead.phone ? formatPhone(lead.phone) : null} />
              <InfoRow label="WhatsApp" value={lead.whatsapp ? formatPhone(lead.whatsapp) : null} />
              <InfoRow label="E-mail" value={lead.email} />
              <InfoRow label="CNPJ" value={lead.cnpj} />
              <InfoRow label="Origem" value={lead.source} />
              <InfoRow label="Localização" value={location || null} />
              <InfoRow label="Serviço oferecido" value={lead.offered_service} />
              <InfoRow label="Cadastrado em" value={formatDateTime(lead.created_at)} />
              <InfoRow label="Última verificação" value={formatDateTime(lead.last_verified_at)} />
              <InfoRow label="Próximo contato" value={formatDateTime(lead.next_contact_at)} />
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {lead.instagram && <a href={lead.instagram} target="_blank" rel="noreferrer" className="text-accent hover:underline">Instagram</a>}
              {lead.facebook && <a href={lead.facebook} target="_blank" rel="noreferrer" className="text-accent hover:underline">Facebook</a>}
              {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" className="text-accent hover:underline">Site</a>}
              {lead.menu_url && <a href={lead.menu_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">Cardápio</a>}
              {lead.catalog_url && <a href={lead.catalog_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">Catálogo</a>}
            </div>
            {lead.notes && <p className="mt-3 rounded-xl bg-elevated p-3 text-sm text-muted">{lead.notes}</p>}
          </Card>

          <Card title="Presença digital" dot="accent">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PRESENCE_FIELDS.map((field) => (
                <div key={field} className="flex items-center justify-between gap-3 rounded-xl bg-elevated px-3 py-2">
                  <span className="text-sm text-muted">{PRESENCE_FIELD_LABELS[field]}</span>
                  <PresenceBadge value={lead[field]} />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Valores" dot="pink">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><p className="text-xs text-muted">Estimado</p><p className="font-display text-base font-semibold text-ink">{formatBRL(lead.estimated_value)}</p></div>
              <div><p className="text-xs text-muted">Negociado</p><p className="font-display text-base font-semibold text-ink">{formatBRL(lead.negotiated_value)}</p></div>
              <div><p className="text-xs text-muted">Contratado</p><p className="font-display text-base font-semibold text-ink">{formatBRL(lead.contracted_value)}</p></div>
              <div><p className="text-xs text-muted">Recebido</p><p className="font-display text-base font-semibold text-primary">{formatBRL(lead.received_value)}</p></div>
            </div>
            <p className="mt-3 text-xs text-muted">Valores estimados não são faturamento nem dinheiro recebido.</p>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <OpportunityPanel lead={lead} />
          <LeadChecklist leadId={lead.id} onChanged={() => void reload()} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rota + restaurar navegação pós-save**

`AppRoutes.tsx`: `<Route path="/leads/:id" element={<LeadDetailPage />} />` + import. Em `LeadNewPage`/`LeadEditPage`, restaurar `navigate(\`/leads/${lead.id}\`)` no onSaved.

- [ ] **Step 5: Build + lint + teste manual**

Run: `npm run build && npm run lint`
Navegador: abrir lead criado na Task 2 → dados, presença tri-estado, valores; marcar 2 itens do checklist → datas aparecem, `last_verified_at` atualiza; editar presença para "Não" no formulário → score recalculado e justificativas aparecem no painel; lead sem dados confirmados → mensagem de verificação pendente.

- [ ] **Step 6: Commit**

```bash
git add src/pages/LeadDetailPage.tsx src/components/leads/LeadChecklist.tsx src/components/leads/OpportunityPanel.tsx src/routes/AppRoutes.tsx src/pages/LeadNewPage.tsx src/pages/LeadEditPage.tsx
git commit -m "Ficha do lead: dados, presenca digital, checklist, oportunidade e valores"
```

---

### Task 4: Timeline de atividades + registro de contato + mudança de status

**Files:**
- Create: `src/components/leads/LeadTimeline.tsx`, `src/components/leads/ContactDialog.tsx`
- Modify: `src/pages/LeadDetailPage.tsx` (adicionar timeline + botão "Registrar contato" + select de status com confirmação)

**Interfaces:**
- Consumes: `activityService.listActivities/addActivity`, `leadService.setLeadStatus`, `ACTIVITY_TYPES/ACTIVITY_LABELS`, `LEAD_STATUSES/STATUS_LABELS`, Modal/ConfirmDialog, `useToast`, `formatDateTime`.
- Produces: `LeadTimeline { leadId: string; refreshKey: number }` (lista atividades com ícone por tipo + data); `ContactDialog { open: boolean; leadId: string; currentStatus: LeadStatus; onClose: () => void; onSaved: () => void }` (tipo + descrição + mudança opcional de status explícita).

- [ ] **Step 1: Criar `src/components/leads/ContactDialog.tsx`**

```tsx
import { useState } from 'react'
import { addActivity } from '../../services/activityService'
import { setLeadStatus } from '../../services/leadService'
import { ACTIVITY_LABELS, ACTIVITY_TYPES, type ActivityType } from '../../types/activity'
import { LEAD_STATUSES, STATUS_LABELS, type LeadStatus } from '../../types/lead'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { useToast } from '../../hooks/useToast'

interface ContactDialogProps {
  open: boolean
  leadId: string
  currentStatus: LeadStatus
  onClose: () => void
  onSaved: () => void
}

export function ContactDialog({ open, leadId, currentStatus, onClose, onSaved }: ContactDialogProps) {
  const { toast } = useToast()
  const [type, setType] = useState<ActivityType>('primeiro_contato')
  const [description, setDescription] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) { setError('Descreva o contato ou observação.'); return }
    setSaving(true)
    setError(null)
    try {
      await addActivity(leadId, type, description.trim())
      if (newStatus && newStatus !== currentStatus) {
        await setLeadStatus(leadId, newStatus as LeadStatus)
      }
      toast('Contato registrado.')
      setDescription('')
      setNewStatus('')
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar contato">
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <Select label="Tipo de atividade" value={type} onChange={(e) => setType(e.target.value as ActivityType)} options={ACTIVITY_TYPES.filter((t) => t !== 'mudanca_status' && t !== 'follow_up').map((t) => ({ value: t, label: ACTIVITY_LABELS[t] }))} />
        <Textarea label="Descrição *" value={description} error={error ?? undefined} onChange={(e) => setDescription(e.target.value)} placeholder="O que foi conversado, enviado ou combinado?" />
        <Select
          label="Mudar status para (opcional — confirmação explícita)"
          placeholder="Manter status atual"
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value)}
          options={LEAD_STATUSES.filter((s) => s !== currentStatus).map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" variant="mint" loading={saving}>Registrar</Button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: Criar `src/components/leads/LeadTimeline.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react'
import {
  ArrowRightLeft, CalendarClock, FileText, MessageSquare, Phone,
  PhoneIncoming, StickyNote, UserCheck, Users, type LucideIcon,
} from 'lucide-react'
import { listActivities } from '../../services/activityService'
import { ACTIVITY_LABELS, type Activity, type ActivityType } from '../../types/activity'
import { formatDateTime } from '../../lib/format'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { Skeleton } from '../ui/Skeleton'

const icons: Record<ActivityType, LucideIcon> = {
  primeiro_contato: UserCheck,
  mensagem: MessageSquare,
  ligacao: Phone,
  resposta: PhoneIncoming,
  reuniao: Users,
  proposta: FileText,
  mudanca_status: ArrowRightLeft,
  observacao: StickyNote,
  follow_up: CalendarClock,
  outro: StickyNote,
}

export function LeadTimeline({ leadId, refreshKey }: { leadId: string; refreshKey: number }) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setActivities(await listActivities(leadId))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar histórico.')
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => { void load() }, [load, refreshKey])

  return (
    <Card title="Histórico de contatos" dot="pink">
      {loading ? (
        <Skeleton className="h-32" />
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : activities.length === 0 ? (
        <EmptyState icon={MessageSquare} title="Nenhum contato registrado" description="Registre o primeiro contato, ligação ou observação para começar o histórico deste lead." />
      ) : (
        <ol className="flex flex-col">
          {activities.map((activity, index) => {
            const Icon = icons[activity.type]
            return (
              <li key={activity.id} className="relative flex gap-3 pb-5 last:pb-0">
                {index < activities.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-line" aria-hidden="true" />}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-elevated">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{ACTIVITY_LABELS[activity.type]}</p>
                  <p className="text-sm text-muted">{activity.description}</p>
                  <p className="mt-0.5 text-xs text-muted/70">{formatDateTime(activity.created_at)}</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}
```

- [ ] **Step 3: Integrar na ficha**

Em `LeadDetailPage.tsx`: adicionar estado `const [contactOpen, setContactOpen] = useState(false)` e `const [refreshKey, setRefreshKey] = useState(0)`; botão "Registrar contato" (ícone MessageSquare, variant mint) no cabeçalho ao lado de Editar; na coluna esquerda, após Valores, `<LeadTimeline leadId={lead.id} refreshKey={refreshKey} />`; ao final, `<ContactDialog open={contactOpen} leadId={lead.id} currentStatus={lead.status} onClose={() => setContactOpen(false)} onSaved={() => { setRefreshKey((k) => k + 1); void reload() }} />`. Adicionar também mudança rápida de status no cabeçalho: `<Select>` sem label? — usar um Select com label "Status" e ao escolher um valor diferente abrir `ConfirmDialog` "Mudar status" ("Confirmar mudança de X para Y?") → `setLeadStatus` + toast + reload + refreshKey. (Select de status no cabeçalho pode ficar abaixo do título, largura ~14rem.)

- [ ] **Step 4: Build + lint + teste manual**

Run: `npm run build && npm run lint`
Navegador: registrar contato com descrição vazia → erro; registrar "Ligação realizada" → aparece na timeline com data; mudar status via diálogo → atividade `mudanca_status` automática "De ... para ..."; mudar status pelo select do cabeçalho → pede confirmação; cancelar → nada muda.

- [ ] **Step 5: Commit**

```bash
git add src/components/leads/LeadTimeline.tsx src/components/leads/ContactDialog.tsx src/pages/LeadDetailPage.tsx
git commit -m "Timeline de atividades, registro de contato e mudanca de status confirmada"
```

---

### Task 5: Follow-ups do lead + WhatsApp manual

**Files:**
- Create: `src/components/leads/FollowupDialog.tsx`, `src/components/leads/LeadFollowups.tsx`, `src/components/leads/WhatsAppDialog.tsx`
- Modify: `src/pages/LeadDetailPage.tsx` (botões "Agendar follow-up" e "WhatsApp", painel de follow-ups)

**Interfaces:**
- Consumes: `followupService.listByLead/createFollowup/completeFollowup/cancelFollowup`, `settingsService.getSettings`, `buildWhatsAppLink`, `normalizeWhatsAppNumber`, UI kit, `useToast`, `formatDateTime`.
- Produces:
  - `FollowupDialog { open: boolean; leadId: string; onClose: () => void; onSaved: () => void }` (datetime-local obrigatório futuro, motivo, observação)
  - `LeadFollowups { leadId: string; refreshKey: number; onChanged: () => void }` (lista pendentes/concluídos; concluir pede resultado inline; cancelar com confirmação)
  - `WhatsAppDialog { open: boolean; lead: Lead; onClose: () => void; onLogged: () => void }` (número validado, mensagem editável vinda do template, checkbox "Registrar mensagem no histórico" padrão true, botão "Abrir WhatsApp" → window.open + addActivity('mensagem') se marcado; número inválido → mensagem de erro, sem botão)

- [ ] **Step 1: Criar `src/components/leads/FollowupDialog.tsx`**

```tsx
import { useState } from 'react'
import { createFollowup } from '../../services/followupService'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Textarea } from '../ui/Textarea'
import { useToast } from '../../hooks/useToast'

interface FollowupDialogProps {
  open: boolean
  leadId: string
  onClose: () => void
  onSaved: () => void
}

export function FollowupDialog({ open, leadId, onClose, onSaved }: FollowupDialogProps) {
  const { toast } = useToast()
  const [dueAt, setDueAt] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dueAt) { setError('Informe a data do próximo contato.'); return }
    const date = new Date(dueAt)
    if (Number.isNaN(date.getTime())) { setError('Data inválida.'); return }
    setSaving(true)
    setError(null)
    try {
      await createFollowup(leadId, date.toISOString(), reason.trim() || null, note.trim() || null)
      toast('Follow-up agendado.')
      setDueAt(''); setReason(''); setNote('')
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao agendar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Agendar follow-up">
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <Input label="Data e hora do próximo contato *" type="datetime-local" value={dueAt} error={error ?? undefined} onChange={(e) => setDueAt(e.target.value)} />
        <Input label="Motivo" placeholder="Ex.: retornar proposta" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Textarea label="Observação" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" variant="mint" loading={saving}>Agendar</Button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: Criar `src/components/leads/LeadFollowups.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Check, X } from 'lucide-react'
import { cancelFollowup, completeFollowup, listByLead } from '../../services/followupService'
import type { Followup } from '../../types/followup'
import { formatDateTime } from '../../lib/format'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Input } from '../ui/Input'
import { Skeleton } from '../ui/Skeleton'
import { useToast } from '../../hooks/useToast'
import { cn } from '../../utils/cn'

export function LeadFollowups({ leadId, refreshKey, onChanged }: { leadId: string; refreshKey: number; onChanged: () => void }) {
  const { toast } = useToast()
  const [followups, setFollowups] = useState<Followup[]>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<Followup | null>(null)
  const [result, setResult] = useState('')
  const [canceling, setCanceling] = useState<Followup | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setFollowups(await listByLead(leadId))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro ao carregar follow-ups.', 'error')
    } finally {
      setLoading(false)
    }
  }, [leadId, toast])

  useEffect(() => { void load() }, [load, refreshKey])

  const finish = async () => {
    if (!completing) return
    setBusy(true)
    try {
      await completeFollowup(completing.id, result.trim() || null)
      toast('Follow-up concluído.')
      setCompleting(null); setResult('')
      await load(); onChanged()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro ao concluir.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    if (!canceling) return
    setBusy(true)
    try {
      await cancelFollowup(canceling.id)
      toast('Follow-up cancelado.')
      setCanceling(null)
      await load(); onChanged()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro ao cancelar.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const now = Date.now()

  return (
    <Card title="Follow-ups" dot="lime">
      {loading ? (
        <Skeleton className="h-24" />
      ) : followups.length === 0 ? (
        <p className="text-sm text-muted">Nenhum follow-up agendado. Use "Agendar follow-up" para combinar o próximo contato.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {followups.map((followup) => {
            const overdue = followup.status === 'pendente' && new Date(followup.due_at).getTime() < now
            return (
              <li key={followup.id} className={cn('rounded-xl border p-3', overdue ? 'border-danger/40 bg-danger/5' : 'border-line bg-elevated')}>
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('text-sm font-medium', overdue ? 'text-danger' : 'text-ink')}>
                    {formatDateTime(followup.due_at)} {overdue && '· atrasado'}
                  </span>
                  <span className="text-xs text-muted">{followup.status === 'pendente' ? 'Pendente' : followup.status === 'concluido' ? 'Concluído' : 'Cancelado'}</span>
                </div>
                {followup.reason && <p className="mt-1 text-xs text-muted">{followup.reason}</p>}
                {followup.result && <p className="mt-1 text-xs text-muted">Resultado: {followup.result}</p>}
                {followup.status === 'pendente' && (
                  <div className="mt-2 flex gap-2">
                    <Button variant="outline" className="h-8 px-2.5 text-xs" onClick={() => { setCompleting(followup); setResult('') }}><Check className="h-3.5 w-3.5" /> Concluir</Button>
                    <Button variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => setCanceling(followup)}><X className="h-3.5 w-3.5" /> Cancelar</Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {completing && (
        <div className="mt-3 rounded-xl border border-line bg-elevated p-3">
          <Input label="Resultado do follow-up (opcional)" value={result} onChange={(e) => setResult(e.target.value)} placeholder="Ex.: pediu para retornar sexta" />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCompleting(null)} disabled={busy}>Voltar</Button>
            <Button variant="mint" loading={busy} onClick={() => void finish()}>Confirmar conclusão</Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={canceling !== null}
        title="Cancelar follow-up"
        description="Cancelar este follow-up? Ele deixará de aparecer nas listas de pendentes."
        confirmLabel="Cancelar follow-up"
        loading={busy}
        onConfirm={() => void cancel()}
        onCancel={() => setCanceling(null)}
      />
    </Card>
  )
}
```

- [ ] **Step 3: Criar `src/components/leads/WhatsAppDialog.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { addActivity } from '../../services/activityService'
import { getSettings } from '../../services/settingsService'
import { buildWhatsAppLink, normalizeWhatsAppNumber } from '../../lib/whatsapp'
import type { Lead } from '../../types/lead'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Textarea } from '../ui/Textarea'
import { useToast } from '../../hooks/useToast'

interface WhatsAppDialogProps {
  open: boolean
  lead: Lead
  onClose: () => void
  onLogged: () => void
}

export function WhatsAppDialog({ open, lead, onClose, onLogged }: WhatsAppDialogProps) {
  const { toast } = useToast()
  const [message, setMessage] = useState('')
  const [logContact, setLogContact] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    void getSettings()
      .then((settings) => setMessage(settings.whatsapp_template))
      .catch(() => setMessage(''))
  }, [open])

  const rawNumber = lead.whatsapp ?? lead.phone ?? ''
  const link = buildWhatsAppLink(rawNumber, message)
  const valid = normalizeWhatsAppNumber(rawNumber) !== null

  const openWhatsApp = async () => {
    if (!link) return
    setSending(true)
    try {
      window.open(link, '_blank', 'noopener')
      if (logContact) {
        await addActivity(lead.id, 'mensagem', 'Mensagem preparada e enviada manualmente pelo WhatsApp.')
        onLogged()
      }
      toast('WhatsApp aberto. O envio é manual — nada foi enviado automaticamente.', 'info')
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro ao registrar contato.', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Abrir WhatsApp">
      <div className="flex flex-col gap-4">
        {!valid ? (
          <p className="text-sm text-danger">
            Número inválido ou ausente ({rawNumber || 'vazio'}). Cadastre um WhatsApp ou telefone com DDD no lead (10 ou 11 dígitos).
          </p>
        ) : (
          <>
            <p className="text-sm text-muted">Conversa com <span className="text-ink">{lead.name}</span> · {normalizeWhatsAppNumber(rawNumber)}</p>
            <Textarea label="Mensagem inicial (editável)" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Olá! Vi que vocês ainda não têm um site..." />
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={logContact} onChange={(e) => setLogContact(e.target.checked)} className="h-4 w-4 accent-[#22c55e]" />
              Registrar mensagem no histórico ao abrir
            </label>
            <p className="text-xs text-muted">O WhatsApp abre em nova aba com a mensagem pronta. Você revisa e envia manualmente — o CRM nunca envia sozinho.</p>
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          {valid && <Button variant="mint" loading={sending} onClick={() => void openWhatsApp()}><MessageCircle className="h-4 w-4" /> Abrir WhatsApp</Button>}
        </div>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 4: Integrar na ficha**

Em `LeadDetailPage.tsx`: estados `followupOpen`, `whatsappOpen`; botões no cabeçalho: "WhatsApp" (variant outline, ícone MessageCircle) e "Agendar follow-up" (variant outline, ícone CalendarClock); na coluna direita, após Checklist, `<LeadFollowups leadId={lead.id} refreshKey={refreshKey} onChanged={() => void reload()} />`; diálogos ao final com `onSaved/onLogged` incrementando refreshKey + reload.

- [ ] **Step 5: Build + lint + teste manual**

Run: `npm run build && npm run lint`
Navegador: agendar follow-up sem data → erro; com data futura → aparece na lista e `next_contact_at` do lead atualiza; concluir com resultado → atividade no histórico; criar follow-up com data passada → destaque "atrasado"; WhatsApp com número válido → link wa.me correto (conferir URL), mensagem do template editável, abre nova aba, atividade registrada; lead sem número → mensagem de erro sem botão.

- [ ] **Step 6: Commit**

```bash
git add src/components/leads/FollowupDialog.tsx src/components/leads/LeadFollowups.tsx src/components/leads/WhatsAppDialog.tsx src/pages/LeadDetailPage.tsx
git commit -m "Follow-ups do lead e WhatsApp manual com mensagem editavel"
```

---

### Task 6: Importação e exportação CSV

**Files:**
- Create: `src/components/leads/CsvImportModal.tsx`
- Modify: `src/pages/LeadsPage.tsx` (botões Exportar CSV + Importar CSV)

**Interfaces:**
- Consumes: `leadsToCsv`, `parseLeadsCsv`, `CsvParsedRow` (lib/csv), `createLead`, `findDuplicateCandidates`, `listLeads`, Modal/Button, `useToast`.
- Produces: `CsvImportModal { open: boolean; onClose: () => void; onImported: () => void }`. Fluxo: escolher arquivo → parse → preview com status por linha (OK / duplicado / erro + motivos) → checkbox "Incluir duplicados" (padrão false) → importar linhas válidas → relatório (importados, ignorados, erros). Export: baixa CSV da view filtrada atual (até 1000 registros) via Blob + anchor download.

- [ ] **Step 1: Criar `src/components/leads/CsvImportModal.tsx`**

```tsx
import { useRef, useState } from 'react'
import { FileUp } from 'lucide-react'
import { parseLeadsCsv, type CsvParsedRow } from '../../lib/csv'
import { createLead, findDuplicateCandidates } from '../../services/leadService'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { useToast } from '../../hooks/useToast'
import { cn } from '../../utils/cn'

interface CsvImportModalProps {
  open: boolean
  onClose: () => void
  onImported: () => void
}

interface RowState extends CsvParsedRow {
  duplicateName?: string
}

export function CsvImportModal({ open, onClose, onImported }: CsvImportModalProps) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<RowState[]>([])
  const [fileName, setFileName] = useState('')
  const [includeDuplicates, setIncludeDuplicates] = useState(false)
  const [importing, setImporting] = useState(false)
  const [report, setReport] = useState<{ imported: number; skipped: number; failed: number } | null>(null)

  const reset = () => {
    setRows([]); setFileName(''); setReport(null); setIncludeDuplicates(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleFile = async (file: File) => {
    setReport(null)
    setFileName(file.name)
    const text = await file.text()
    const parsed = parseLeadsCsv(text)
    const withDuplicates: RowState[] = []
    for (const row of parsed) {
      if (!row.draft) { withDuplicates.push(row); continue }
      try {
        const candidates = await findDuplicateCandidates({
          phone: row.draft.phone, whatsapp: row.draft.whatsapp, cnpj: row.draft.cnpj,
          name: row.draft.name, city: row.draft.city,
        })
        withDuplicates.push({ ...row, duplicateName: candidates[0]?.name })
      } catch {
        withDuplicates.push(row)
      }
    }
    setRows(withDuplicates)
  }

  const runImport = async () => {
    setImporting(true)
    let imported = 0, skipped = 0, failed = 0
    for (const row of rows) {
      if (!row.draft) { failed++; continue }
      if (row.duplicateName && !includeDuplicates) { skipped++; continue }
      try {
        await createLead(row.draft)
        imported++
      } catch {
        failed++
      }
    }
    setReport({ imported, skipped, failed })
    setImporting(false)
    if (imported > 0) { toast(`${imported} lead(s) importado(s).`); onImported() }
  }

  const validCount = rows.filter((r) => r.draft && (!r.duplicateName || includeDuplicates)).length

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Importar leads por CSV" wide>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Colunas aceitas: nome (obrigatória), responsavel, nicho, telefone, whatsapp, email, cnpj, instagram, facebook, site, cardapio_url, catalogo_url, pais, estado, cidade, bairro, endereco, cep, status, servico, valor_estimado, observacoes, origem, tem_site, tem_instagram, tem_facebook, tem_cardapio, tem_catalogo, tem_landing, tem_whatsapp_comercial. Presença: sim / não / não verificado.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="text-sm text-muted file:mr-3 file:rounded-xl file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-bg"
          onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleFile(file) }}
        />
        {fileName && <p className="text-xs text-muted">Arquivo: {fileName} · {rows.length} linha(s)</p>}

        {rows.length > 0 && !report && (
          <>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-line">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-elevated text-muted">
                  <tr>
                    <th className="px-3 py-2">Linha</th>
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.line} className="border-t border-line/50">
                      <td className="px-3 py-2 text-muted">{row.line}</td>
                      <td className="px-3 py-2 text-ink">{row.draft?.name ?? '—'}</td>
                      <td className={cn('px-3 py-2', row.errors.length > 0 ? 'text-danger' : row.duplicateName ? 'text-lime' : 'text-primary')}>
                        {row.errors.length > 0
                          ? row.errors.join(' ')
                          : row.duplicateName
                            ? `Possível duplicado de "${row.duplicateName}"`
                            : 'OK'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={includeDuplicates} onChange={(e) => setIncludeDuplicates(e.target.checked)} className="h-4 w-4 accent-[#22c55e]" />
              Incluir possíveis duplicados na importação
            </label>
          </>
        )}

        {report && (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm">
            <p className="font-medium text-primary">Importação concluída</p>
            <p className="mt-1 text-muted">{report.imported} importado(s) · {report.skipped} duplicado(s) ignorado(s) · {report.failed} com erro.</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { reset(); onClose() }}>{report ? 'Fechar' : 'Cancelar'}</Button>
          {rows.length > 0 && !report && (
            <Button variant="mint" loading={importing} disabled={validCount === 0} onClick={() => void runImport()}>
              <FileUp className="h-4 w-4" /> Importar {validCount} lead(s)
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Botões na LeadsPage**

Adicionar estado `importOpen`; função `exportCsv`:
```tsx
const exportCsv = async () => {
  try {
    const { leads: all } = await listLeads(filters, sort, 0, 1000)
    if (all.length === 0) { toast('Nenhum lead para exportar.', 'info'); return }
    const blob = new Blob([leadsToCsv(all)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'leads.csv'
    anchor.click()
    URL.revokeObjectURL(url)
    toast(`${all.length} lead(s) exportado(s).`)
  } catch (e) {
    toast(e instanceof Error ? e.message : 'Erro ao exportar.', 'error')
  }
}
```
Botões no cabeçalho: `<Button variant="outline" onClick={() => void exportCsv()}><Download .../> Exportar CSV</Button>` e `<Button variant="outline" onClick={() => setImportOpen(true)}><Upload .../> Importar CSV</Button>`; `<CsvImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={() => void load()} />` ao final. Imports: `Download, Upload` do lucide, `leadsToCsv` de lib/csv.

- [ ] **Step 3: Build + lint + teste manual**

Run: `npm run build && npm run lint`
Navegador: exportar → arquivo baixa com headers corretos; importar o mesmo arquivo → todas as linhas marcadas como duplicadas, ignoradas por padrão; importar CSV novo com 1 linha sem nome → erro reportado; linha válida → importada e aparece na lista; checkbox incluir duplicados → importa.

- [ ] **Step 4: Commit + push**

```bash
git add src/components/leads/CsvImportModal.tsx src/pages/LeadsPage.tsx
git commit -m "Importacao CSV com preview, validacao e duplicidades; exportacao da view filtrada"
git push origin main
```

---

## Verificação final do Plano 2 (manual, navegador, login real)

- [ ] CRUD completo: criar, editar, excluir com confirmação (cascade verificado: atividades/followups somem)
- [ ] Validação: nome, e-mail, telefone, CNPJ, URLs, valores
- [ ] Busca por nome + filtros nicho/cidade/bairro/status/presença/data + ordenações + paginação
- [ ] Duplicidade: aviso com link, não bloqueia; nomes parecidos sem telefone/cnpj iguais não acusam
- [ ] Tri-estado: unverified não pontua; mudar para "Não" recalcula score e justificativas
- [ ] Checklist individual com datas; last_verified_at atualiza
- [ ] Timeline: contato manual, mudança de status automática com de→para
- [ ] Status só muda com confirmação (diálogo ou select confirmado)
- [ ] Follow-up: agendar, atrasado destacado, concluir com resultado, cancelar; next_contact_at sincronizado
- [ ] WhatsApp: número validado, link wa.me/55..., mensagem editável, nova aba, nada automático, histórico registrado
- [ ] CSV: export, import com preview/validação/duplicidades/relatório
- [ ] Responsividade: tabela→cards no mobile; formulários utilizáveis em 375px
- [ ] Persistência: recarregar página mantém tudo (dados no Supabase)
- [ ] `npm run build && npm run lint && npm test` PASS