# Etapa 2 — Plano 3: Oportunidades, Pipeline, Follow-ups, Dashboard, Configurações

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Central de Oportunidades derivada dos leads, Pipeline Kanban com drag & drop, página de Follow-ups, Dashboard com dados reais e gráficos Recharts, Configurações funcionais e placeholders dos módulos futuros — fechando a Etapa 2 com a bateria de testes manual.

**Architecture:** Tudo consulta os mesmos registros de `leads` (sem cópias). Agregações do dashboard em funções puras testadas (`lib/dashboard.ts`) sobre um único fetch leve. Kanban com @dnd-kit (draggable por card, droppable por coluna). Recharts para os 5 gráficos.

**Tech Stack:** React 19, TS, Tailwind v4, @dnd-kit/core, recharts, services do Plano 1.

**Spec:** `docs/superpowers/specs/2026-11-22-etapa2-design.md` · **Depende dos Planos 1 e 2 completos.**

## Global Constraints

(Idênticas ao Plano 1.) Destaques: sem dados fictícios; estimados nunca viram faturamento; oportunidades não são clientes; status só muda com confirmação (no Kanban, o arraste É a confirmação explícita do usuário); pt-BR; build+lint+testes passam a cada tarefa; credenciais de teste nunca em arquivos.

---

### Task 1: Extensões de domínio — filtro de prioridade, elegibilidade, agregações do dashboard (TDD)

**Files:**
- Modify: `src/types/lead.ts` (LeadFilters ganha `priority?: Priority`), `src/services/leadService.ts` (aplicar filtro), `src/lib/opportunity.ts` (elegibilidade)
- Create: `src/lib/dashboard.ts`, `src/lib/dashboard.test.ts`

**Interfaces:**
- Produces:
  - `LeadFilters.priority?: Priority`; `listLeads` aplica `eq('priority', ...)`
  - `isEligibleOpportunity(lead: Pick<Lead,'needs'|'status'>): boolean` (needs.length > 0 e status fora de INELIGIBLE_STATUSES)
  - `DashboardIndicators { totalLeads, novos, contatados, interessados, negociando, convertidos, totalOportunidades, altaPrioridade, followupsPendentes, followupsAtrasados }`
  - `computeIndicators(leads: Lead[], followups: Followup[]): DashboardIndicators`
  - `leadsByMonth(leads: Lead[]): Array<{ month: string; total: number }>` (últimos 6 meses, rótulo `mmm/aa` pt-BR, ordem cronológica)
  - `countBy(leads: Lead[], key: 'niche' | 'status' | 'priority'): Array<{ label: string; total: number }>` (rótulos pt-BR; priority apenas de oportunidades elegíveis)
  - `conversionFunnel(leads: Lead[]): Array<{ label: string; total: number }>` (Novo→Contatado→Interessado→Negociando→Aceitou, usando situação-mapeamento: contatado = contato_realizado+aguardando_resposta+pediu_informacoes)
  - `prospectingQueue(leads: Lead[], followups: Followup[]): Lead[]` (elegíveis para prospectar: status fora de aceitou/perdido/nao_interessado; ordem: prioridade muito_alta→alta→media→baixa, depois follow-up atrasado primeiro, depois score desc, depois não contatados (status novo) primeiro, depois created_at asc)

- [ ] **Step 1: Testes que falham (`src/lib/dashboard.test.ts`)**

```ts
import { describe, expect, it } from 'vitest'
import { computeIndicators, conversionFunnel, countBy, leadsByMonth, prospectingQueue } from './dashboard'
import { emptyLeadDraft, type Lead } from '../types/lead'
import type { Followup } from '../types/followup'

let seq = 0
function lead(overrides: Partial<Lead> = {}): Lead {
  seq += 1
  return {
    ...emptyLeadDraft(),
    id: `id-${seq}`, owner_id: 'owner', score: 0, priority: 'baixa',
    needs: [], score_reasons: [],
    created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z',
    name: `Lead ${seq}`,
    ...overrides,
  } as Lead
}

function followup(overrides: Partial<Followup> = {}): Followup {
  return {
    id: 'f1', lead_id: 'id-1', owner_id: 'owner',
    due_at: '2026-11-22T10:00:00Z', reason: null, note: null,
    status: 'pendente', completed_at: null, result: null,
    created_at: '2026-11-20T00:00:00Z', updated_at: '2026-11-20T00:00:00Z',
    ...overrides,
  }
}

describe('computeIndicators', () => {
  it('conta status e oportunidades reais', () => {
    const leads = [
      lead({ status: 'novo' }),
      lead({ status: 'contato_realizado' }),
      lead({ status: 'interessado', needs: ['site'], score: 50, priority: 'media' }),
      lead({ status: 'negociando', needs: ['site'], score: 85, priority: 'muito_alta' }),
      lead({ status: 'aceitou', needs: ['site'], score: 90, priority: 'muito_alta' }),
      lead({ status: 'perdido', needs: ['site'], score: 90, priority: 'muito_alta' }),
    ]
    const followups = [
      followup({ status: 'pendente', due_at: '2020-01-01T00:00:00Z' }),
      followup({ id: 'f2', status: 'pendente', due_at: '2099-01-01T00:00:00Z' }),
      followup({ id: 'f3', status: 'concluido' }),
    ]
    const i = computeIndicators(leads, followups)
    expect(i.totalLeads).toBe(6)
    expect(i.novos).toBe(1)
    expect(i.contatados).toBe(1)
    expect(i.interessados).toBe(1)
    expect(i.negociando).toBe(1)
    expect(i.convertidos).toBe(1)
    expect(i.totalOportunidades).toBe(2) // aceitou e perdido excluídos
    expect(i.altaPrioridade).toBe(1) // só negociando (muito_alta) entre elegíveis
    expect(i.followupsPendentes).toBe(2)
    expect(i.followupsAtrasados).toBe(1)
  })
})

describe('leadsByMonth', () => {
  it('agrupa por mês e ordena cronologicamente', () => {
    const result = leadsByMonth([
      lead({ created_at: '2026-11-05T00:00:00Z' }),
      lead({ created_at: '2026-11-20T00:00:00Z' }),
      lead({ created_at: '2026-10-01T00:00:00Z' }),
    ])
    expect(result.length).toBeGreaterThanOrEqual(2)
    const nov = result.find((r) => r.month.includes('11'))
    expect(nov?.total).toBe(2)
    expect(result[result.length - 1].month).toMatch(/11/)
  })
})

describe('countBy / conversionFunnel', () => {
  it('conta por nicho com rótulos', () => {
    const result = countBy([lead({ niche: 'barbearia' }), lead({ niche: 'barbearia' })], 'niche')
    expect(result.find((r) => r.label === 'Barbearia')?.total).toBe(2)
  })
  it('funil de conversão tem 5 etapas', () => {
    const result = conversionFunnel([lead({ status: 'novo' }), lead({ status: 'aceitou' })])
    expect(result).toHaveLength(5)
    expect(result[0].total).toBe(1)
    expect(result[4].total).toBe(1)
  })
})

describe('prospectingQueue', () => {
  it('exclui convertidos, perdidos e não interessados; prioriza muito alta', () => {
    const queue = prospectingQueue([
      lead({ status: 'aceitou', score: 100, priority: 'muito_alta', needs: ['site'] }),
      lead({ status: 'perdido', score: 100, priority: 'muito_alta', needs: ['site'] }),
      lead({ status: 'nao_interessado', score: 100, priority: 'muito_alta', needs: ['site'] }),
      lead({ status: 'novo', score: 30, priority: 'baixa' }),
      lead({ status: 'novo', score: 90, priority: 'muito_alta', needs: ['site'] }),
    ], [])
    expect(queue).toHaveLength(2)
    expect(queue[0].score).toBe(90)
  })
  it('follow-up atrasado sobe na fila dentro da mesma prioridade', () => {
    const overdueLead = lead({ status: 'follow_up', score: 50, priority: 'media', needs: ['site'] })
    const queue = prospectingQueue([
      lead({ status: 'novo', score: 55, priority: 'media', needs: ['site'] }),
      overdueLead,
    ], [followup({ lead_id: overdueLead.id, due_at: '2020-01-01T00:00:00Z' })])
    expect(queue[0].id).toBe(overdueLead.id)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `./dashboard` não existe.

- [ ] **Step 3: Implementar `src/lib/dashboard.ts`**

```ts
import {
  INELIGIBLE_STATUSES, NICHE_LABELS, PRIORITY_LABELS, STATUS_LABELS,
  type Lead, type Niche, type Priority,
} from '../types/lead'
import type { Followup } from '../types/followup'
import { isEligibleOpportunity } from './opportunity'

export interface DashboardIndicators {
  totalLeads: number
  novos: number
  contatados: number
  interessados: number
  negociando: number
  convertidos: number
  totalOportunidades: number
  altaPrioridade: number
  followupsPendentes: number
  followupsAtrasados: number
}

const CONTATADOS = ['contato_realizado', 'aguardando_resposta', 'pediu_informacoes']

export function computeIndicators(leads: Lead[], followups: Followup[]): DashboardIndicators {
  const now = Date.now()
  const opportunities = leads.filter(isEligibleOpportunity)
  const pending = followups.filter((f) => f.status === 'pendente')
  return {
    totalLeads: leads.length,
    novos: leads.filter((l) => l.status === 'novo').length,
    contatados: leads.filter((l) => CONTATADOS.includes(l.status)).length,
    interessados: leads.filter((l) => l.status === 'interessado').length,
    negociando: leads.filter((l) => l.status === 'negociando').length,
    convertidos: leads.filter((l) => l.status === 'aceitou').length,
    totalOportunidades: opportunities.length,
    altaPrioridade: opportunities.filter((l) => l.priority === 'alta' || l.priority === 'muito_alta').length,
    followupsPendentes: pending.length,
    followupsAtrasados: pending.filter((f) => new Date(f.due_at).getTime() < now).length,
  }
}

export function leadsByMonth(leads: Lead[]): Array<{ month: string; total: number }> {
  const buckets = new Map<string, { sortKey: number; total: number }>()
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(2)}`
    buckets.set(key, { sortKey: date.getTime(), total: 0 })
  }
  for (const lead of leads) {
    const date = new Date(lead.created_at)
    const key = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(2)}`
    const bucket = buckets.get(key)
    if (bucket) bucket.total += 1
  }
  return [...buckets.entries()]
    .sort((a, b) => a[1].sortKey - b[1].sortKey)
    .map(([month, { total }]) => ({ month, total }))
}

export function countBy(leads: Lead[], key: 'niche' | 'status' | 'priority'): Array<{ label: string; total: number }> {
  const source = key === 'priority' ? leads.filter(isEligibleOpportunity) : leads
  const counts = new Map<string, number>()
  for (const lead of source) {
    const raw = lead[key] ?? 'outros'
    const label =
      key === 'niche' ? (NICHE_LABELS[raw as Niche] ?? raw)
      : key === 'status' ? STATUS_LABELS[lead.status]
      : PRIORITY_LABELS[lead.priority]
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()].map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total)
}

export function conversionFunnel(leads: Lead[]): Array<{ label: string; total: number }> {
  return [
    { label: 'Novo', total: leads.filter((l) => l.status === 'novo').length },
    { label: 'Contatado', total: leads.filter((l) => CONTATADOS.includes(l.status)).length },
    { label: 'Interessado', total: leads.filter((l) => l.status === 'interessado').length },
    { label: 'Negociando', total: leads.filter((l) => l.status === 'negociando').length },
    { label: 'Aceitou', total: leads.filter((l) => l.status === 'aceitou').length },
  ]
}

const PRIORITY_ORDER: Record<Priority, number> = { muito_alta: 0, alta: 1, media: 2, baixa: 3 }

export function prospectingQueue(leads: Lead[], followups: Followup[]): Lead[] {
  const now = Date.now()
  const overdueLeadIds = new Set(
    followups
      .filter((f) => f.status === 'pendente' && new Date(f.due_at).getTime() < now)
      .map((f) => f.lead_id),
  )
  return leads
    .filter((l) => !INELIGIBLE_STATUSES.includes(l.status))
    .sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      if (priorityDiff !== 0) return priorityDiff
      const overdueDiff = Number(overdueLeadIds.has(b.id)) - Number(overdueLeadIds.has(a.id))
      if (overdueDiff !== 0) return overdueDiff
      if (a.score !== b.score) return b.score - a.score
      const newDiff = Number(b.status === 'novo') - Number(a.status === 'novo')
      if (newDiff !== 0) return newDiff
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
}
```

- [ ] **Step 4: Adicionar `isEligibleOpportunity` em `src/lib/opportunity.ts`**

Ao final do arquivo (importar `INELIGIBLE_STATUSES` de types/lead):
```ts
export function isEligibleOpportunity(lead: Pick<Lead, 'needs' | 'status'>): boolean {
  return lead.needs.length > 0 && !INELIGIBLE_STATUSES.includes(lead.status)
}
```

- [ ] **Step 5: Filtro de prioridade**

Em `src/types/lead.ts`, dentro de `LeadFilters`, adicionar `priority?: Priority`. Em `src/services/leadService.ts`, após o bloco `if (filters.status)`:
```ts
if (filters.priority) query = query.eq('priority', filters.priority)
```

- [ ] **Step 6: Rodar testes + build + lint**

Run: `npm test && npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/dashboard.ts src/lib/dashboard.test.ts src/lib/opportunity.ts src/types/lead.ts src/services/leadService.ts
git commit -m "Agregacoes do dashboard, fila de prospeccao e filtro de prioridade (TDD)"
```

---

### Task 2: Página Oportunidades

**Files:**
- Create: `src/pages/OpportunitiesPage.tsx`, `src/components/opportunities/OpportunityCard.tsx`, `src/components/opportunities/OpportunityFilters.tsx`
- Modify: `src/routes/AppRoutes.tsx` (`/oportunidades`), `src/layouts/AppLayout.tsx` (navItems: Oportunidades ganha `to`)

**Interfaces:**
- Consumes: `listLeads` (filters: hasNeeds, excludeStatuses=INELIGIBLE_STATUSES, niche, need, priority, situation, city, district, createdFrom/To, minScore/maxScore, instagramWithoutSite, noSiteNoMenu), `prospectingQueue`, `isEligibleOpportunity`, `WhatsAppDialog` (Plano 2), UI kit, `formatBRL`.
- Produces: rota `/oportunidades`; `OpportunityCard { lead: Lead; onWhatsApp: (lead: Lead) => void }`; total potencial = soma estimated_value dos leads filtrados; seção "Prospectar hoje" (top 5 da fila) + botão "Próxima oportunidade" (navega à ficha do primeiro da fila); "Iniciar prospecção" navega à ficha do lead existente.

- [ ] **Step 1: Criar `src/components/opportunities/OpportunityCard.tsx`**

```tsx
import { Link } from 'react-router-dom'
import { Globe, Instagram, MessageCircle, Phone, Target } from 'lucide-react'
import { NEED_LABELS, NICHE_LABELS, type Lead, type Niche } from '../../types/lead'
import { formatBRL, formatPhone } from '../../lib/format'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { PriorityBadge } from '../ui/PriorityBadge'
import { ScoreBar } from '../ui/ScoreBar'
import { StatusBadge } from '../ui/StatusBadge'

export function OpportunityCard({ lead, onWhatsApp }: { lead: Lead; onWhatsApp: (lead: Lead) => void }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/leads/${lead.id}`} className="font-display text-sm font-semibold text-ink hover:text-primary">{lead.name}</Link>
          <p className="text-xs text-muted">
            {lead.niche ? NICHE_LABELS[lead.niche as Niche] ?? lead.niche : 'Sem nicho'}
            {lead.city ? ` · ${lead.city}` : ''}{lead.district ? ` · ${lead.district}` : ''}
          </p>
        </div>
        <PriorityBadge priority={lead.priority} />
      </div>

      <ScoreBar score={lead.score} />

      <div className="flex flex-wrap gap-1.5">
        {lead.needs.map((need) => (
          <span key={need} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">{NEED_LABELS[need]}</span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {lead.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {formatPhone(lead.phone)}</span>}
        {lead.instagram && <a href={lead.instagram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline"><Instagram className="h-3 w-3" /> Instagram</a>}
        {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline"><Globe className="h-3 w-3" /> Site</a>}
        <span>{formatBRL(lead.estimated_value)}</span>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
        <StatusBadge status={lead.status} />
        <div className="flex gap-1.5">
          <Button variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => onWhatsApp(lead)}><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</Button>
          <Link to={`/leads/${lead.id}`}><Button variant="mint" className="h-8 px-2.5 text-xs"><Target className="h-3.5 w-3.5" /> Prospectar</Button></Link>
        </div>
      </div>
    </Card>
  )
}
```

- [ ] **Step 2: Criar `src/components/opportunities/OpportunityFilters.tsx`**

```tsx
import {
  NEEDS, NEED_LABELS, NICHES, NICHE_LABELS, PRIORITIES, PRIORITY_LABELS,
  SITUATIONS, SITUATION_LABELS, type LeadFilters,
} from '../../types/lead'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'

interface OpportunityFiltersProps {
  filters: LeadFilters
  onChange: (filters: LeadFilters) => void
}

const NEED_FILTER_OPTIONS = [
  ...NEEDS.map((n) => ({ value: n, label: NEED_LABELS[n] })),
  { value: 'instagram_sem_site', label: 'Instagram sem site' },
  { value: 'sem_site_sem_cardapio', label: 'Sem site e sem cardápio' },
]

export function OpportunityFilters({ filters, onChange }: OpportunityFiltersProps) {
  const set = (patch: Partial<LeadFilters>) => onChange({ ...filters, ...patch })
  const needValue = filters.instagramWithoutSite ? 'instagram_sem_site'
    : filters.noSiteNoMenu ? 'sem_site_sem_cardapio'
    : filters.need ?? ''

  const changeNeed = (value: string) => {
    set({
      need: undefined, instagramWithoutSite: undefined, noSiteNoMenu: undefined,
      ...(value === 'instagram_sem_site' ? { instagramWithoutSite: true }
        : value === 'sem_site_sem_cardapio' ? { noSiteNoMenu: true }
        : value ? { need: value as LeadFilters['need'] } : {}),
    })
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Select label="Nicho" placeholder="Todos" value={filters.niche ?? ''} onChange={(e) => set({ niche: e.target.value || undefined })} options={NICHES.map((n) => ({ value: n, label: NICHE_LABELS[n] }))} />
      <Select label="Necessidade" placeholder="Todas" value={needValue} onChange={(e) => changeNeed(e.target.value)} options={NEED_FILTER_OPTIONS} />
      <Select label="Prioridade" placeholder="Todas" value={filters.priority ?? ''} onChange={(e) => set({ priority: (e.target.value || undefined) as LeadFilters['priority'] })} options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))} />
      <Select label="Situação" placeholder="Todas" value={filters.situation ?? ''} onChange={(e) => set({ situation: (e.target.value || undefined) as LeadFilters['situation'] })} options={SITUATIONS.map((s) => ({ value: s, label: SITUATION_LABELS[s] }))} />
      <Input label="Cidade" placeholder="Todas" value={filters.city ?? ''} onChange={(e) => set({ city: e.target.value || undefined })} />
      <Input label="Bairro" placeholder="Todos" value={filters.district ?? ''} onChange={(e) => set({ district: e.target.value || undefined })} />
      <Input label="Cadastrado de" type="date" value={filters.createdFrom ?? ''} onChange={(e) => set({ createdFrom: e.target.value || undefined })} />
      <Input label="Cadastrado até" type="date" value={filters.createdTo ?? ''} onChange={(e) => set({ createdTo: e.target.value || undefined })} />
      <Input label="Pontuação mínima" type="number" min="0" max="100" value={filters.minScore ?? ''} onChange={(e) => set({ minScore: e.target.value === '' ? undefined : Number(e.target.value) })} />
      <Input label="Pontuação máxima" type="number" min="0" max="100" value={filters.maxScore ?? ''} onChange={(e) => set({ maxScore: e.target.value === '' ? undefined : Number(e.target.value) })} />
    </div>
  )
}
```

- [ ] **Step 3: Criar `src/pages/OpportunitiesPage.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, RefreshCw, Target } from 'lucide-react'
import { listLeads } from '../services/leadService'
import { listFollowups } from '../services/followupService'
import { prospectingQueue } from '../lib/dashboard'
import { INELIGIBLE_STATUSES, NICHE_LABELS, type Lead, type LeadFilters, type Niche } from '../types/lead'
import type { Followup } from '../types/followup'
import { formatBRL } from '../lib/format'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { OpportunityCard } from '../components/opportunities/OpportunityCard'
import { OpportunityFilters } from '../components/opportunities/OpportunityFilters'
import { WhatsAppDialog } from '../components/leads/WhatsAppDialog'

export function OpportunitiesPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<LeadFilters>({})
  const [leads, setLeads] = useState<Lead[]>([])
  const [allLeads, setAllLeads] = useState<Lead[]>([])
  const [followups, setFollowups] = useState<Followup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [whatsappLead, setWhatsappLead] = useState<Lead | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [filtered, all, overdue] = await Promise.all([
        listLeads({ ...filters, hasNeeds: true, excludeStatuses: INELIGIBLE_STATUSES }, 'score_desc', 0, 200),
        listLeads({}, 'score_desc', 0, 1000),
        listFollowups('overdue'),
      ])
      setLeads(filtered.leads)
      setAllLeads(all.leads)
      setFollowups(overdue)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar oportunidades.')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { void load() }, [load])

  const queue = useMemo(() => prospectingQueue(allLeads, followups), [allLeads, followups])
  const totalPotential = useMemo(() => leads.reduce((sum, lead) => sum + lead.estimated_value, 0), [leads])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Oportunidades</h1>
          <p className="text-sm text-muted">
            {leads.length} oportunidade(s) · potencial estimado {formatBRL(totalPotential)}
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
      </div>

      {queue.length > 0 && (
        <Card title="Prospectar hoje" dot="mint">
          <div className="flex flex-col gap-2">
            {queue.slice(0, 5).map((lead) => (
              <Link key={lead.id} to={`/leads/${lead.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-elevated px-3 py-2.5 text-sm transition-colors hover:bg-line">
                <span className="min-w-0 truncate text-ink">{lead.name}</span>
                <span className="shrink-0 text-xs text-muted">
                  {lead.niche ? NICHE_LABELS[lead.niche as Niche] ?? lead.niche : ''} · score {lead.score}
                </span>
              </Link>
            ))}
            <Button variant="mint" className="mt-1 self-start" onClick={() => navigate(`/leads/${queue[0].id}`)}>
              Próxima oportunidade <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      <Card><OpportunityFilters filters={filters} onChange={setFilters} /></Card>

      {error && (
        <Card className="border-danger/40">
          <p className="text-sm text-danger">{error}</p>
          <Button variant="outline" className="mt-3" onClick={() => void load()}>Tentar novamente</Button>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}</div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nenhuma oportunidade identificada"
          description="As oportunidades nascem dos leads: cadastre estabelecimentos e confirme a presença digital (marque 'Não' apenas quando verificado). Leads sem dados confirmados não pontuam."
          action={<Link to="/leads/novo"><Button variant="mint">Cadastrar lead</Button></Link>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {leads.map((lead) => <OpportunityCard key={lead.id} lead={lead} onWhatsApp={setWhatsappLead} />)}
        </div>
      )}

      {whatsappLead && (
        <WhatsAppDialog open lead={whatsappLead} onClose={() => setWhatsappLead(null)} onLogged={() => void load()} />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Rota + sidebar**

`AppRoutes.tsx`: `<Route path="/oportunidades" element={<OpportunitiesPage />} />` + import. `AppLayout.tsx` navItems: `{ label: 'Oportunidades', icon: Target, to: '/oportunidades' }`.

- [ ] **Step 5: Build + lint + teste manual**

Run: `npm run build && npm run lint`
Navegador: lead com site='no' aparece como oportunidade; lead todo unverified NÃO aparece; filtros combinados (nicho + necessidade + prioridade + cidade + score) funcionam juntos; total potencial soma estimados; "Prospectar hoje" exclui aceitou/perdido/nao_interessado; "Próxima oportunidade" abre a ficha; WhatsApp do card abre o diálogo; "Prospectar" abre a ficha existente (nenhum lead novo é criado).

- [ ] **Step 6: Commit**

```bash
git add src/pages/OpportunitiesPage.tsx src/components/opportunities src/routes/AppRoutes.tsx src/layouts/AppLayout.tsx
git commit -m "Central de Oportunidades: cards, filtros combinaveis, prospectar hoje e valor potencial"
```

---

### Task 3: Pipeline Kanban

**Files:**
- Create: `src/pages/PipelinePage.tsx`, `src/components/pipeline/KanbanCard.tsx`, `src/components/pipeline/KanbanColumn.tsx`
- Modify: `src/routes/AppRoutes.tsx` (`/pipeline`), `src/layouts/AppLayout.tsx` (navItems: Pipeline ganha `to`)

**Interfaces:**
- Consumes: `listLeads`, `setLeadStatus`, `LEAD_STATUSES/STATUS_LABELS`, `LeadFilters` (niche, city, priority), @dnd-kit/core (`DndContext`, `useDraggable`, `useDroppable`, `closestCenter`, `DragEndEvent`, `PointerSensor`, `useSensor`, `useSensors`), UI kit, `useToast`, `formatBRL`, `formatDate`.
- Produces: rota `/pipeline`; arrastar card → `setLeadStatus` (otimista: move no estado local, reverte em erro) + toast + atividade automática (service já faz); mobile: seletor de coluna + "Mover para" no card.

- [ ] **Step 1: Criar `src/components/pipeline/KanbanCard.tsx`**

```tsx
import { useDraggable } from '@dnd-kit/core'
import { Link } from 'react-router-dom'
import { CalendarClock, Phone } from 'lucide-react'
import { NICHE_LABELS, type Lead, type Niche } from '../../types/lead'
import { formatBRL, formatDate, formatPhone } from '../../lib/format'
import { PriorityBadge } from '../ui/PriorityBadge'
import { cn } from '../../utils/cn'

export function KanbanCard({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id })
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'cursor-grab touch-none rounded-xl border border-line bg-elevated p-3 text-sm transition-shadow active:cursor-grabbing',
        isDragging && 'opacity-60 shadow-lg shadow-black/50',
      )}
    >
      <Link to={`/leads/${lead.id}`} className="font-medium text-ink hover:text-primary" onClick={(e) => e.stopPropagation()}>
        {lead.name}
      </Link>
      <p className="mt-0.5 text-xs text-muted">{lead.niche ? NICHE_LABELS[lead.niche as Niche] ?? lead.niche : 'Sem nicho'}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <PriorityBadge priority={lead.priority} />
        <span className="text-xs text-muted">{formatBRL(lead.estimated_value)}</span>
      </div>
      <div className="mt-2 flex flex-col gap-1 text-xs text-muted">
        {lead.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {formatPhone(lead.phone)}</span>}
        {lead.next_contact_at && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" /> {formatDate(lead.next_contact_at)}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar `src/components/pipeline/KanbanColumn.tsx`**

```tsx
import { useDroppable } from '@dnd-kit/core'
import type { Lead, LeadStatus } from '../../types/lead'
import { STATUS_LABELS } from '../../types/lead'
import { KanbanCard } from './KanbanCard'
import { cn } from '../../utils/cn'

export function KanbanColumn({ status, leads }: { status: LeadStatus; leads: Lead[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-2xl border border-line bg-surface p-3 transition-colors',
        isOver && 'border-primary/60 bg-primary/5',
      )}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="font-display text-xs font-semibold uppercase tracking-wide text-muted">{STATUS_LABELS[status]}</h3>
        <span className="rounded-full bg-elevated px-2 py-0.5 text-xs text-muted">{leads.length}</span>
      </div>
      <div className="flex min-h-24 flex-col gap-2">
        {leads.map((lead) => <KanbanCard key={lead.id} lead={lead} />)}
        {leads.length === 0 && <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-muted/60">Arraste leads para cá</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Criar `src/pages/PipelinePage.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { RefreshCw } from 'lucide-react'
import { listLeads, setLeadStatus } from '../services/leadService'
import {
  LEAD_STATUSES, NICHES, NICHE_LABELS, PRIORITIES, PRIORITY_LABELS,
  STATUS_LABELS, type Lead, type LeadFilters, type LeadStatus,
} from '../types/lead'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Select } from '../components/ui/Select'
import { Skeleton } from '../components/ui/Skeleton'
import { KanbanColumn } from '../components/pipeline/KanbanColumn'
import { KanbanCard } from '../components/pipeline/KanbanCard'
import { useToast } from '../hooks/useToast'

export function PipelinePage() {
  const { toast } = useToast()
  const [filters, setFilters] = useState<LeadFilters>({})
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mobileColumn, setMobileColumn] = useState<LeadStatus>('novo')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listLeads(filters, 'score_desc', 0, 500)
      setLeads(result.leads)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar pipeline.')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { void load() }, [load])

  const byStatus = useMemo(() => {
    const map = new Map<LeadStatus, Lead[]>(LEAD_STATUSES.map((s) => [s, []]))
    for (const lead of leads) map.get(lead.status)?.push(lead)
    return map
  }, [leads])

  const moveLead = async (leadId: string, status: LeadStatus) => {
    const lead = leads.find((l) => l.id === leadId)
    if (!lead || lead.status === status) return
    const previous = lead.status
    setLeads((current) => current.map((l) => (l.id === leadId ? { ...l, status } : l)))
    try {
      await setLeadStatus(leadId, status)
      toast(`"${lead.name}" movido para ${STATUS_LABELS[status]}.`)
    } catch (e) {
      setLeads((current) => current.map((l) => (l.id === leadId ? { ...l, status: previous } : l)))
      toast(e instanceof Error ? e.message : 'Erro ao mover lead.', 'error')
    }
  }

  const onDragEnd = (event: DragEndEvent) => {
    const status = event.over?.id as LeadStatus | undefined
    if (status) void moveLead(String(event.active.id), status)
  }

  const set = (patch: Partial<LeadFilters>) => setFilters((current) => ({ ...current, ...patch }))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Pipeline</h1>
          <p className="text-sm text-muted">Arraste os leads entre as colunas para atualizar o status</p>
        </div>
        <Button variant="outline" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select label="Nicho" placeholder="Todos" value={filters.niche ?? ''} onChange={(e) => set({ niche: e.target.value || undefined })} options={NICHES.map((n) => ({ value: n, label: NICHE_LABELS[n] }))} />
          <input
            className="h-11 rounded-xl border border-line bg-elevated px-3.5 text-sm text-ink placeholder:text-muted/60 focus:border-primary focus:outline-none sm:mt-6"
            placeholder="Cidade"
            value={filters.city ?? ''}
            onChange={(e) => set({ city: e.target.value || undefined })}
            aria-label="Filtrar por cidade"
          />
          <Select label="Prioridade" placeholder="Todas" value={filters.priority ?? ''} onChange={(e) => set({ priority: (e.target.value || undefined) as LeadFilters['priority'] })} options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))} />
        </div>
      </Card>

      {error && (
        <Card className="border-danger/40">
          <p className="text-sm text-danger">{error}</p>
          <Button variant="outline" className="mt-3" onClick={() => void load()}>Tentar novamente</Button>
        </Card>
      )}

      {loading ? (
        <div className="flex gap-4 overflow-hidden">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-96 w-72 shrink-0" />)}</div>
      ) : leads.length === 0 ? (
        <EmptyState icon={RefreshCw} title="Pipeline vazio" description="Cadastre leads para vê-los aqui. Cada coluna representa um status comercial; arrastar um lead atualiza o status e registra no histórico." />
      ) : (
        <>
          {/* Desktop: quadro completo com scroll horizontal */}
          <div className="hidden md:block">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <div className="flex gap-4 overflow-x-auto pb-4">
                {LEAD_STATUSES.map((status) => <KanbanColumn key={status} status={status} leads={byStatus.get(status) ?? []} />)}
              </div>
            </DndContext>
          </div>

          {/* Mobile: uma coluna por vez + mover via select */}
          <div className="flex flex-col gap-3 md:hidden">
            <Select
              label="Coluna"
              value={mobileColumn}
              onChange={(e) => setMobileColumn(e.target.value as LeadStatus)}
              options={LEAD_STATUSES.map((s) => ({ value: s, label: `${STATUS_LABELS[s] } (${byStatus.get(s)?.length ?? 0})` }))}
            />
            {(byStatus.get(mobileColumn) ?? []).map((lead) => (
              <div key={lead.id} className="flex flex-col gap-2">
                <KanbanCard lead={lead} />
                <Select
                  label="Mover para"
                  placeholder="Escolha o novo status"
                  value=""
                  onChange={(e) => { if (e.target.value) void moveLead(lead.id, e.target.value as LeadStatus) }}
                  options={LEAD_STATUSES.filter((s) => s !== lead.status).map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
                />
              </div>
            ))}
            {(byStatus.get(mobileColumn) ?? []).length === 0 && (
              <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-muted">Nenhum lead nesta coluna.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

Nota: no mobile os cards estão fora de um DndContext — `useDraggable` sem contexto funciona (sem arraste), e o select "Mover para" cobre a ação. Confirmar no teste que não há erro de console; se houver, envolver a lista mobile em `<DndContext onDragEnd={onDragEnd}>` também.

- [ ] **Step 4: Rota + sidebar**

`AppRoutes.tsx`: `<Route path="/pipeline" element={<PipelinePage />} />`. `AppLayout.tsx`: `{ label: 'Pipeline', icon: FolderKanban, to: '/pipeline' }`.

- [ ] **Step 5: Build + lint + teste manual**

Run: `npm run build && npm run lint`
Navegador desktop: arrastar lead de "Novo" para "Interessado" → card muda de coluna, toast, status persiste (recarregar página), atividade `mudanca_status` na ficha; filtros nicho/cidade/prioridade; mobile 375px: seletor de coluna + "Mover para" funciona; dashboard (quando existir) reflete.

- [ ] **Step 6: Commit**

```bash
git add src/pages/PipelinePage.tsx src/components/pipeline src/routes/AppRoutes.tsx src/layouts/AppLayout.tsx
git commit -m "Pipeline Kanban com drag and drop, filtros e adaptacao mobile"
```

---

### Task 4: Página Follow-ups

**Files:**
- Create: `src/pages/FollowUpsPage.tsx`
- Modify: `src/routes/AppRoutes.tsx` (`/followups`), `src/layouts/AppLayout.tsx` (topbar: sino com contador de atrasados linkando /followups)

**Interfaces:**
- Consumes: `followupService.listFollowups/completeFollowup/cancelFollowup/countOverdue`, `listLeads` (mapa id→lead), `Lead`/`Followup`, UI kit, `useToast`, `formatDateTime`.
- Produces: rota `/followups` com abas Hoje / Futuros / Atrasados / Concluídos; cada item mostra nome do lead (link à ficha), data, motivo; concluir (resultado inline) e cancelar reutilizam a lógica do Plano 2 (duplicar o padrão de LeadFollowups adaptado, ou extrair — **extrair**: mover a lógica de conclusão/cancelamento para um componente compartilhado `FollowupItem` em `src/components/followups/FollowupItem.tsx` usado pelas duas páginas; refatorar LeadFollowups para usá-lo).

- [ ] **Step 1: Criar `src/components/followups/FollowupItem.tsx`**

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { cancelFollowup, completeFollowup } from '../../services/followupService'
import type { Followup } from '../../types/followup'
import { formatDateTime } from '../../lib/format'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Input } from '../ui/Input'
import { useToast } from '../../hooks/useToast'
import { cn } from '../../utils/cn'

interface FollowupItemProps {
  followup: Followup
  leadName: string
  onChanged: () => void
}

export function FollowupItem({ followup, leadName, onChanged }: FollowupItemProps) {
  const { toast } = useToast()
  const [completing, setCompleting] = useState(false)
  const [result, setResult] = useState('')
  const [canceling, setCanceling] = useState(false)
  const [busy, setBusy] = useState(false)

  const overdue = followup.status === 'pendente' && new Date(followup.due_at).getTime() < Date.now()

  const finish = async () => {
    setBusy(true)
    try {
      await completeFollowup(followup.id, result.trim() || null)
      toast('Follow-up concluído.')
      setCompleting(false); setResult('')
      onChanged()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro ao concluir.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    setBusy(true)
    try {
      await cancelFollowup(followup.id)
      toast('Follow-up cancelado.')
      setCanceling(false)
      onChanged()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro ao cancelar.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={cn('rounded-xl border p-3', overdue ? 'border-danger/40 bg-danger/5' : 'border-line bg-elevated')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to={`/leads/${followup.lead_id}`} className="text-sm font-medium text-ink hover:text-primary">{leadName}</Link>
        <span className={cn('text-xs', overdue ? 'font-medium text-danger' : 'text-muted')}>
          {formatDateTime(followup.due_at)}{overdue && ' · atrasado'}
        </span>
      </div>
      {followup.reason && <p className="mt-1 text-xs text-muted">{followup.reason}</p>}
      {followup.note && <p className="mt-1 text-xs text-muted">{followup.note}</p>}
      {followup.result && <p className="mt-1 text-xs text-muted">Resultado: {followup.result}</p>}
      {followup.status === 'pendente' && (
        <div className="mt-2 flex gap-2">
          <Button variant="outline" className="h-8 px-2.5 text-xs" onClick={() => { setCompleting(true); setResult('') }}><Check className="h-3.5 w-3.5" /> Concluir</Button>
          <Button variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => setCanceling(true)}><X className="h-3.5 w-3.5" /> Cancelar</Button>
        </div>
      )}
      {completing && (
        <div className="mt-2 flex flex-col gap-2">
          <Input label="Resultado (opcional)" value={result} onChange={(e) => setResult(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCompleting(false)} disabled={busy}>Voltar</Button>
            <Button variant="mint" loading={busy} onClick={() => void finish()}>Confirmar conclusão</Button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={canceling}
        title="Cancelar follow-up"
        description="Cancelar este follow-up? Ele deixará de aparecer nas listas de pendentes."
        confirmLabel="Cancelar follow-up"
        loading={busy}
        onConfirm={() => void cancel()}
        onCancel={() => setCanceling(false)}
      />
    </li>
  )
}
```

- [ ] **Step 2: Refatorar `LeadFollowups.tsx` para usar `FollowupItem`**

Substituir o `<li>` interno e os estados de conclusão/cancelamento por:
```tsx
{followups.map((followup) => (
  <FollowupItem key={followup.id} followup={followup} leadName="Este lead" onChanged={() => { void load(); onChanged() }} />
))}
```
(leadName na ficha é redundante — passar o nome do lead via prop nova `leadName: string` em LeadFollowups, fornecida pela ficha). Remover imports/estados agora não usados (Input, ConfirmDialog, Check, X, cn, completing/canceling/result/busy). Manter load/refreshKey.

- [ ] **Step 3: Criar `src/pages/FollowUpsPage.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, RefreshCw } from 'lucide-react'
import { listFollowups } from '../services/followupService'
import { listLeads } from '../services/leadService'
import type { Followup, FollowupList } from '../types/followup'
import type { Lead } from '../types/lead'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { FollowupItem } from '../components/followups/FollowupItem'
import { cn } from '../utils/cn'

const TABS: Array<{ value: FollowupList; label: string }> = [
  { value: 'today', label: 'Hoje' },
  { value: 'upcoming', label: 'Futuros' },
  { value: 'overdue', label: 'Atrasados' },
  { value: 'done', label: 'Concluídos' },
]

export function FollowUpsPage() {
  const [tab, setTab] = useState<FollowupList>('today')
  const [followups, setFollowups] = useState<Followup[]>([])
  const [leadNames, setLeadNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [items, leadsResult] = await Promise.all([
        listFollowups(tab),
        listLeads({}, 'created_desc', 0, 1000),
      ])
      setFollowups(items)
      setLeadNames(new Map(leadsResult.leads.map((lead: Lead) => [lead.id, lead.name])))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar follow-ups.')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { void load() }, [load])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Follow-ups</h1>
          <p className="text-sm text-muted">Acompanhe os próximos contatos e não deixe nenhum esfriar</p>
        </div>
        <Button variant="outline" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
              tab === value ? 'bg-primary/15 text-primary' : 'bg-surface text-muted hover:bg-elevated hover:text-ink',
              value === 'overdue' && tab !== value && 'text-danger',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <Card className="border-danger/40">
          <p className="text-sm text-danger">{error}</p>
          <Button variant="outline" className="mt-3" onClick={() => void load()}>Tentar novamente</Button>
        </Card>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : followups.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={tab === 'overdue' ? 'Nenhum follow-up atrasado' : tab === 'done' ? 'Nenhum follow-up concluído' : 'Nenhum follow-up aqui'}
          description={tab === 'overdue' ? 'Tudo em dia. Continue acompanhando os próximos contatos.' : 'Agende follow-ups na ficha de cada lead para organizar seus próximos contatos.'}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {followups.map((followup) => (
            <FollowupItem key={followup.id} followup={followup} leadName={leadNames.get(followup.lead_id) ?? 'Lead removido'} onChanged={() => void load()} />
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Rota + sino no topbar**

`AppRoutes.tsx`: `<Route path="/followups" element={<FollowUpsPage />} />`. Em `AppLayout.tsx`: estado `overdueCount` + `useEffect(() => { void countOverdue().then(setOverdueCount).catch(() => setOverdueCount(0)) }, [])`; no topbar, antes do e-mail:
```tsx
<Link to="/followups" aria-label="Follow-ups atrasados" className="relative rounded-lg p-1.5 text-muted transition-colors hover:bg-elevated hover:text-ink">
  <Bell className="h-5 w-5" />
  {overdueCount > 0 && (
    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-bg">{overdueCount}</span>
  )}
</Link>
```
Imports: `Bell`, `Link`, `countOverdue`, `useEffect`.

- [ ] **Step 5: Build + lint + teste manual**

Run: `npm run build && npm run lint`
Navegador: abas filtram corretamente (criar follow-up hoje, futuro e passado na ficha de um lead); atrasados destacados em vermelho; concluir com resultado → vai para Concluídos e atividade no lead; sino mostra contador de atrasados e leva à página.

- [ ] **Step 6: Commit**

```bash
git add src/pages/FollowUpsPage.tsx src/components/followups src/components/leads/LeadFollowups.tsx src/pages/LeadDetailPage.tsx src/routes/AppRoutes.tsx src/layouts/AppLayout.tsx
git commit -m "Pagina de Follow-ups com abas, conclusao com resultado e sino de atrasados"
```

---

### Task 5: Dashboard real com Recharts

**Files:**
- Create: `src/services/dashboardService.ts`, `src/components/dashboard/IndicatorCard.tsx`, `src/components/dashboard/ChartCard.tsx`
- Modify: `src/pages/DashboardPage.tsx` (reescrever), `src/services/activityService.ts` (listRecentActivities)

**Interfaces:**
- Consumes: `computeIndicators`, `leadsByMonth`, `countBy`, `conversionFunnel` (lib/dashboard), `listLeads`, `listFollowups('all')`, recharts (`ResponsiveContainer`, `AreaChart`, `Area`, `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `CartesianGrid`, `Cell`), UI kit.
- Produces:
  - `dashboardService.getDashboardData(): Promise<{ leads: Lead[]; followups: Followup[]; recentActivities: Array<Activity & { leadName: string }>; recentLeads: Lead[] }>` — 1 fetch de leads (todas as colunas, volume free), 1 de followups, 1 de atividades com join `leads(name)`, recentes = leads ordenados por created_at desc slice 5.
  - `activityService.listRecentActivities(limit: number): Promise<Array<Activity & { leadName: string }>>` — `select('*, leads(name)')`, mapear `leads?.name`.
  - Dashboard: 10 IndicatorCards, 5 gráficos, atividades recentes, próximos follow-ups (lista today+overdue com link), 4 ações rápidas. Sem dados → EmptyState orientando cadastro. Cores dos gráficos: primary #22c55e, accent #6db5ff, lime #fefa3d, pink #ff5de7; grid #2a2a2a; texto #a3a3a3.

- [ ] **Step 1: `listRecentActivities` em activityService**

```ts
export async function listRecentActivities(limit: number): Promise<Array<Activity & { leadName: string }>> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('lead_activities')
    .select('*, leads(name)')
    .order('created_at', { ascending: false })
    .limit(limit)
  throwDbError(error)
  return (data ?? []).map((row) => {
    const { leads, ...activity } = row as Activity & { leads: { name: string } | null }
    return { ...activity, leadName: leads?.name ?? 'Lead removido' }
  })
}
```

- [ ] **Step 2: Criar `src/services/dashboardService.ts`**

```ts
import { listLeads, listRecentLeads } from './leadService'
import { listFollowups } from './followupService'
import { listRecentActivities } from './activityService'
import type { Activity } from '../types/activity'
import type { Followup } from '../types/followup'
import type { Lead } from '../types/lead'

export interface DashboardData {
  leads: Lead[]
  followups: Followup[]
  recentActivities: Array<Activity & { leadName: string }>
  recentLeads: Lead[]
}

export async function getDashboardData(): Promise<DashboardData> {
  const [leadsResult, followups, recentActivities, recentLeads] = await Promise.all([
    listLeads({}, 'created_desc', 0, 1000),
    listFollowups('all'),
    listRecentActivities(8),
    listRecentLeads(5),
  ])
  return { leads: leadsResult.leads, followups, recentActivities, recentLeads }
}
```

- [ ] **Step 3: Criar componentes de apresentação**

```tsx
// src/components/dashboard/IndicatorCard.tsx
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'

interface IndicatorCardProps {
  label: string
  value: number
  icon: LucideIcon
  tone?: 'default' | 'primary' | 'danger' | 'lime' | 'accent' | 'pink'
}

const tones = {
  default: 'text-ink',
  primary: 'text-primary',
  danger: 'text-danger',
  lime: 'text-lime',
  accent: 'text-accent',
  pink: 'text-pink',
}

export function IndicatorCard({ label, value, icon: Icon, tone = 'default' }: IndicatorCardProps) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{label}</span>
        <Icon className={cn('h-4 w-4', tones[tone])} />
      </div>
      <p className={cn('mt-2 font-display text-2xl font-bold', tones[tone])}>{value}</p>
    </div>
  )
}
```

```tsx
// src/components/dashboard/ChartCard.tsx
import type { ReactNode } from 'react'
import { Card } from '../ui/Card'

export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card title={title} dot="accent">
      <div className="h-56">{children}</div>
    </Card>
  )
}
```

- [ ] **Step 4: Reescrever `src/pages/DashboardPage.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, CalendarClock, CheckCircle2, FolderKanban, Handshake,
  MessageSquare, Plus, RefreshCw, Target, TrendingUp, UserPlus, Users,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { getDashboardData, type DashboardData } from '../services/dashboardService'
import { computeIndicators, conversionFunnel, countBy, leadsByMonth } from '../lib/dashboard'
import { ACTIVITY_LABELS } from '../types/activity'
import { formatDateTime } from '../lib/format'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { IndicatorCard } from '../components/dashboard/IndicatorCard'
import { ChartCard } from '../components/dashboard/ChartCard'

const AXIS = { stroke: '#a3a3a3', fontSize: 11 }
const GRID = '#2a2a2a'
const TOOLTIP_STYLE = { backgroundColor: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 12, color: '#fff', fontSize: 12 }
const PRIORITY_COLORS: Record<string, string> = { 'Muito alta': '#ff5de7', Alta: '#fefa3d', 'Média': '#6db5ff', Baixa: '#a3a3a3' }

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await getDashboardData())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar dashboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const indicators = useMemo(
    () => (data ? computeIndicators(data.leads, data.followups) : null),
    [data],
  )

  if (loading) {
    return <div className="grid grid-cols-2 gap-4 md:grid-cols-5">{Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
  }
  if (error || !data || !indicators) {
    return (
      <Card className="border-danger/40">
        <p className="text-sm text-danger">{error ?? 'Erro ao carregar dashboard.'}</p>
        <Button variant="outline" className="mt-3" onClick={() => void load()}>Tentar novamente</Button>
      </Card>
    )
  }

  const pendingFollowups = data.followups
    .filter((f) => f.status === 'pendente')
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
    .slice(0, 6)
  const leadNameById = new Map(data.leads.map((l) => [l.id, l.name]))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Dashboard</h1>
          <p className="text-sm text-muted">Visão geral da sua prospecção — dados reais do Supabase</p>
        </div>
        <Button variant="outline" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to="/leads/novo"><Button variant="mint"><Plus className="h-4 w-4" /> Novo lead</Button></Link>
        <Link to="/oportunidades"><Button variant="outline"><Target className="h-4 w-4" /> Ver oportunidades</Button></Link>
        <Link to="/pipeline"><Button variant="outline"><FolderKanban className="h-4 w-4" /> Abrir pipeline</Button></Link>
        <Link to="/followups"><Button variant="outline"><CalendarClock className="h-4 w-4" /> Ver follow-ups</Button></Link>
      </div>

      {data.leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Seu CRM está pronto para começar"
          description="Cadastre o primeiro estabelecimento para ver indicadores, gráficos e oportunidades em tempo real. Nenhum dado fictício é exibido aqui."
          action={<Link to="/leads/novo"><Button variant="mint"><Plus className="h-4 w-4" /> Cadastrar primeiro lead</Button></Link>}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <IndicatorCard label="Total de leads" value={indicators.totalLeads} icon={Users} />
            <IndicatorCard label="Novos" value={indicators.novos} icon={UserPlus} tone="accent" />
            <IndicatorCard label="Contatados" value={indicators.contatados} icon={MessageSquare} tone="accent" />
            <IndicatorCard label="Interessados" value={indicators.interessados} icon={TrendingUp} tone="primary" />
            <IndicatorCard label="Em negociação" value={indicators.negociando} icon={Handshake} tone="primary" />
            <IndicatorCard label="Convertidos" value={indicators.convertidos} icon={CheckCircle2} tone="primary" />
            <IndicatorCard label="Oportunidades" value={indicators.totalOportunidades} icon={Target} tone="lime" />
            <IndicatorCard label="Alta prioridade" value={indicators.altaPrioridade} icon={AlertTriangle} tone="pink" />
            <IndicatorCard label="Follow-ups pendentes" value={indicators.followupsPendentes} icon={CalendarClock} tone="lime" />
            <IndicatorCard label="Follow-ups atrasados" value={indicators.followupsAtrasados} icon={AlertTriangle} tone="danger" />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ChartCard title="Leads cadastrados ao longo do tempo">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={leadsByMonth(data.leads)}>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                  <XAxis dataKey="month" {...AXIS} />
                  <YAxis allowDecimals={false} {...AXIS} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="total" name="Leads" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Leads por nicho">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={countBy(data.leads, 'niche')}>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                  <XAxis dataKey="label" {...AXIS} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} {...AXIS} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="total" name="Leads" fill="#6db5ff" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Leads por status">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={countBy(data.leads, 'status')}>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                  <XAxis dataKey="label" {...AXIS} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} {...AXIS} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="total" name="Leads" fill="#22c55e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Oportunidades por prioridade">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={countBy(data.leads, 'priority')}>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                  <XAxis dataKey="label" {...AXIS} />
                  <YAxis allowDecimals={false} {...AXIS} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="total" name="Oportunidades" radius={[6, 6, 0, 0]}>
                    {countBy(data.leads, 'priority').map((entry) => (
                      <Cell key={entry.label} fill={PRIORITY_COLORS[entry.label] ?? '#a3a3a3'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Conversão de leads">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conversionFunnel(data.leads)} layout="vertical">
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} {...AXIS} />
                  <YAxis type="category" dataKey="label" width={90} {...AXIS} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="total" name="Leads" fill="#fefa3d" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <Card title="Próximos follow-ups" dot="lime">
              {pendingFollowups.length === 0 ? (
                <p className="text-sm text-muted">Nenhum follow-up pendente. Agende na ficha de um lead.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {pendingFollowups.map((followup) => {
                    const overdue = new Date(followup.due_at).getTime() < Date.now()
                    return (
                      <li key={followup.id}>
                        <Link to={`/leads/${followup.lead_id}`} className="flex items-center justify-between gap-3 rounded-xl bg-elevated px-3 py-2.5 text-sm hover:bg-line">
                          <span className="min-w-0 truncate text-ink">{leadNameById.get(followup.lead_id) ?? 'Lead'}</span>
                          <span className={overdue ? 'shrink-0 text-xs font-medium text-danger' : 'shrink-0 text-xs text-muted'}>{formatDateTime(followup.due_at)}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card title="Últimos leads cadastrados" dot="mint">
              <ul className="flex flex-col gap-2">
                {data.recentLeads.map((lead) => (
                  <li key={lead.id}>
                    <Link to={`/leads/${lead.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-elevated px-3 py-2.5 text-sm hover:bg-line">
                      <span className="min-w-0 truncate text-ink">{lead.name}</span>
                      <span className="shrink-0 text-xs text-muted">{formatDateTime(lead.created_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Atividades recentes" dot="pink">
              {data.recentActivities.length === 0 ? (
                <p className="text-sm text-muted">Nenhuma atividade registrada ainda.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {data.recentActivities.map((activity) => (
                    <li key={activity.id} className="rounded-xl bg-elevated px-3 py-2.5 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <Link to={`/leads/${activity.lead_id}`} className="min-w-0 truncate font-medium text-ink hover:text-primary">{activity.leadName}</Link>
                        <span className="shrink-0 text-xs text-muted">{formatDateTime(activity.created_at)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">{ACTIVITY_LABELS[activity.type]} — {activity.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Build + lint + teste manual**

Run: `npm run build && npm run lint && npm test`
Navegador: indicadores batem com os leads reais (conferir contagens manualmente); 5 gráficos renderizam com dados reais; cadastrar lead novo → atualizar dashboard → números mudam; mover lead no pipeline → status reflete; atividades recentes mostram mudanças de status; sem leads (conta nova ou excluir todos) → estado vazio, nunca números fictícios; mobile: cards 2 colunas, gráficos empilhados.

- [ ] **Step 6: Commit**

```bash
git add src/pages/DashboardPage.tsx src/services/dashboardService.ts src/services/activityService.ts src/components/dashboard
git commit -m "Dashboard real: 10 indicadores, 5 graficos Recharts, atividades e follow-ups"
```

---

### Task 6: Configurações + placeholders dos módulos futuros

**Files:**
- Create: `src/pages/SettingsPage.tsx`, `src/pages/ModulePlaceholderPage.tsx`
- Modify: `src/services/settingsService.ts` (updateProfileName), `src/routes/AppRoutes.tsx` (rotas /configuracoes, /clientes, /projetos, /financeiro, /relatorios), `src/layouts/AppLayout.tsx` (navItems: todos com `to`)

**Interfaces:**
- Consumes: `getSettings/saveSettings`, `SERVICE_LABELS`, `DEFAULT_SETTINGS`, supabase client (update profiles), UI kit, `useToast`, `useAuth`.
- Produces: `settingsService.updateProfileName(fullName: string): Promise<void>` (update profiles onde id = user.id); SettingsPage com 3 seções (Perfil, Preços de serviços, Mensagem WhatsApp com preview); `ModulePlaceholderPage { title, description, stage, icon }` reutilizado pelas 4 rotas futuras; sidebar 100% navegável.

- [ ] **Step 1: `updateProfileName` em settingsService**

```ts
export async function updateProfileName(fullName: string): Promise<void> {
  const client = requireSupabase()
  const { data: userData } = await client.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('Sessão expirada. Entre novamente.')
  const { error } = await client.from('profiles').update({ full_name: fullName }).eq('id', userId)
  throwDbError(error)
}
```

- [ ] **Step 2: Criar `src/pages/SettingsPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { getSettings, saveSettings, updateProfileName } from '../services/settingsService'
import { SERVICE_LABELS, type ServicePrices } from '../types/settings'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Skeleton } from '../components/ui/Skeleton'
import { Textarea } from '../components/ui/Textarea'
import { formatBRL } from '../lib/format'

export function SettingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [fullName, setFullName] = useState('')
  const [prices, setPrices] = useState<ServicePrices>({ site: 0, landing: 0, cardapio: 0, catalogo: 0, outros: 0 })
  const [template, setTemplate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void getSettings()
      .then((settings) => { setPrices(settings.service_prices); setTemplate(settings.whatsapp_template) })
      .catch((e: unknown) => toast(e instanceof Error ? e.message : 'Erro ao carregar configurações.', 'error'))
      .finally(() => setLoading(false))
  }, [toast])

  const save = async () => {
    setSaving(true)
    try {
      await Promise.all([saveSettings(prices, template), updateProfileName(fullName.trim())])
      toast('Configurações salvas.')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Skeleton className="h-96" />

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <h1 className="font-display text-xl font-bold text-ink">Configurações</h1>

      <Card title="Perfil" dot="mint">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Seu nome" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Como você aparece no CRM" />
          <Input label="E-mail" value={user?.email ?? ''} disabled />
        </div>
      </Card>

      <Card title="Preços padrão por serviço" dot="lime">
        <p className="mb-3 text-xs text-muted">Usados como sugestão de valor estimado ao cadastrar leads. Valores estimados não são faturamento.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(Object.keys(SERVICE_LABELS) as Array<keyof ServicePrices>).map((key) => (
            <Input
              key={key}
              label={`${SERVICE_LABELS[key]} (R$)`}
              type="number"
              min="0"
              step="0.01"
              value={String(prices[key])}
              onChange={(e) => setPrices((current) => ({ ...current, [key]: Math.max(0, Number(e.target.value) || 0) }))}
            />
          ))}
        </div>
      </Card>

      <Card title="Mensagem inicial do WhatsApp" dot="accent">
        <Textarea
          label="Template (editável a cada envio)"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          placeholder="Olá! Sou especializado em sites para negócios locais. Vi que vocês ainda não têm um site e posso ajudar..."
        />
        {template.trim() && (
          <div className="mt-3 rounded-xl border border-line bg-elevated p-3">
            <p className="text-xs text-muted">Preview:</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{template}</p>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">O CRM nunca envia mensagens automaticamente. Você revisa e envia manualmente no WhatsApp. Valor potencial total dos serviços: {formatBRL(Object.values(prices).reduce((a, b) => a + b, 0))} (soma dos preços padrão).</p>
      </Card>

      <div className="flex justify-end">
        <Button variant="mint" loading={saving} onClick={() => void save()}><Save className="h-4 w-4" /> Salvar configurações</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Criar `src/pages/ModulePlaceholderPage.tsx`**

```tsx
import { Link } from 'react-router-dom'
import { BarChart3, FolderKanban, Lock, Users, Wallet, type LucideIcon } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'

const MODULES: Record<string, { title: string; description: string; stage: string; icon: LucideIcon }> = {
  clientes: { title: 'Clientes', description: 'Leads convertidos virão para cá na Etapa 3, com contratos e histórico completo. Nenhum lead é contado como cliente antes da conversão.', stage: 'Etapa 3', icon: Users },
  projetos: { title: 'Projetos', description: 'Acompanhamento dos serviços contratados (site, cardápio, catálogo) chega na Etapa 3.', stage: 'Etapa 3', icon: FolderKanban },
  financeiro: { title: 'Financeiro', description: 'Valores contratados e recebidos, separados dos estimados, chegam na Etapa 4.', stage: 'Etapa 4', icon: Wallet },
  relatorios: { title: 'Relatórios', description: 'Relatórios de conversão, nichos e desempenho chegam na Etapa 4.', stage: 'Etapa 4', icon: BarChart3 },
}

export function ModulePlaceholderPage({ moduleKey }: { moduleKey: keyof typeof MODULES }) {
  const module = MODULES[moduleKey]
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-xl font-bold text-ink">{module.title}</h1>
      <EmptyState
        icon={module.icon}
        title={`${module.title} — disponível na ${module.stage}`}
        description={module.description}
        action={<Link to="/leads"><Button variant="outline"><Lock className="h-4 w-4" /> Voltar para Leads</Button></Link>}
      />
    </div>
  )
}
```

- [ ] **Step 4: Rotas + sidebar completa**

`AppRoutes.tsx` (dentro de AppLayout):
```tsx
<Route path="/configuracoes" element={<SettingsPage />} />
<Route path="/clientes" element={<ModulePlaceholderPage moduleKey="clientes" />} />
<Route path="/projetos" element={<ModulePlaceholderPage moduleKey="projetos" />} />
<Route path="/financeiro" element={<ModulePlaceholderPage moduleKey="financeiro" />} />
<Route path="/relatorios" element={<ModulePlaceholderPage moduleKey="relatorios" />} />
```
`AppLayout.tsx` navItems final:
```ts
const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { label: 'Leads', icon: Users, to: '/leads' },
  { label: 'Oportunidades', icon: Target, to: '/oportunidades' },
  { label: 'Pipeline', icon: FolderKanban, to: '/pipeline' },
  { label: 'Clientes', icon: Users, to: '/clientes' },
  { label: 'Projetos', icon: FolderKanban, to: '/projetos' },
  { label: 'Financeiro', icon: Wallet, to: '/financeiro' },
  { label: 'Relatórios', icon: BarChart3, to: '/relatorios' },
  { label: 'Configurações', icon: Settings, to: '/configuracoes' },
]
```
Remover o campo `stage`/Lock se não usados (oxlint unused). Atualizar o rodapé da sidebar: "Etapa 2 — leads, oportunidades, pipeline e prospecção."

- [ ] **Step 5: Build + lint + teste manual**

Run: `npm run build && npm run lint`
Navegador: salvar nome → persiste em profiles (conferir via ficha/status ou reload); preços salvos → novo lead com serviço "Site" sugere o valor; template salvo → diálogo WhatsApp da ficha abre com ele; 4 placeholders navegam e explicam a etapa; sidebar completa sem itens mortos.

- [ ] **Step 6: Commit + push**

```bash
git add src/pages/SettingsPage.tsx src/pages/ModulePlaceholderPage.tsx src/services/settingsService.ts src/routes/AppRoutes.tsx src/layouts/AppLayout.tsx
git commit -m "Configuracoes funcionais e placeholders de Clientes, Projetos, Financeiro e Relatorios"
git push origin main
```

---

### Task 7: Bateria final de testes + correções + relatório

**Files:**
- Modify: o que os testes revelarem
- Modify: `README.md` (seção Etapa 2: migration 0002, módulos, como usar)

- [ ] **Step 1: Suite automatizada**

Run: `npm run build && npm run lint && npm test`
Expected: tudo PASS, 0 erros de lint.

- [ ] **Step 2: Bateria manual completa (navegador, login real, dados reais)**

Percorrer e registrar resultado de CADA item (spec seção 18):
1. Cadastro de lead (todos os campos, tri-estado)
2. Edição (score recalcula ao mudar presença)
3. Exclusão com confirmação + cascade
4. Validação de campos (nome, email, telefone, CNPJ, URLs, valores)
5. Pesquisa por nome + filtros nicho/cidade/bairro/status/presença/data
6. Ordenação data e pontuação + paginação
7. CSV export + import (preview, validação, duplicidades, relatório)
8. Duplicidade no cadastro manual (aviso + ver existente + prosseguir)
9. Pontuação: conferir manualmente 3 cenários (restaurante sem site/cardápio = 65+; tudo unverified = 0; só WhatsApp)
10. Reclassificação: editar presença → prioridade muda
11. Filtros combinados de oportunidades (3+ simultâneos)
12. Cards e ficha de oportunidade (justificativas só com dados cadastrados)
13. Iniciar prospecção (abre lead existente, nunca cria outro)
14. WhatsApp: número válido/inválido, link wa.me/55..., mensagem editável, envio manual
15. Pipeline: drag & drop desktop + mover mobile
16. Atualização de status reflete em Leads/Oportunidades/Dashboard + histórico
17. Histórico: tipos, datas, mudança automática de status
18. Follow-ups: hoje/futuros/atrasados/concluídos, concluir com resultado, sino
19. Indicadores do dashboard conferidos contra contagem manual
20. Gráficos com dados reais
21. Persistência: reload mantém tudo
22. RLS: criar segundo usuário de teste pelo dashboard Supabase (pedir ao usuário), logar, confirmar que NÃO vê os leads do primeiro usuário; volver ao primeiro
23. Responsividade: 375px (mobile), 768px (tablet), 1280px+ (desktop) em todas as páginas
24. Estados: loading, vazio, erro de conexão (desligar Wi-Fi ou throttling offline no devtools → mensagem pt-BR), confirmações, toasts

- [ ] **Step 3: Corrigir todos os erros encontrados**

Para cada falha: reproduzir → corrigir → re-testar o item → commit da correção. Não marcar concluído com falha pendente.

- [ ] **Step 4: Atualizar README**

Adicionar seção "Etapa 2": executar migration 0002, módulos disponíveis, fluxo recomendado (cadastrar → verificar presença → oportunidades → prospectar → pipeline → follow-ups), limites free.

- [ ] **Step 5: Commit + push final**

```bash
git add -A
git commit -m "Etapa 2 concluida: correcoes dos testes finais e README atualizado"
git push origin main
```

- [ ] **Step 6: Relatório ao usuário (spec seção 20)**

Reportar: funcionalidades implementadas; arquivos criados/modificados; alterações no banco (migration 0002); testes executados (lista da bateria com resultado real); erros encontrados e corrigidos; o que está funcionando; pendências (ex.: deploy Vercel, segundo usuário para teste RLS se não feito); instruções de uso. **Não afirmar teste não executado.** Não avançar à Etapa 3 sem autorização.

---

## Verificação final do Plano 3

- [ ] `npm run build && npm run lint && npm test` PASS
- [ ] Bateria manual da Task 7 integralmente executada e registrada
- [ ] RLS verificado com dois usuários (ou reportado como pendência explícita se o usuário não criar o segundo)
- [ ] Relatório entregue; Etapa 3 aguardando autorização