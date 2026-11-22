# Etapa 2 — Plano 1: Fundação (banco, libs, services, identidade visual, UI kit)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparar banco, tipos, lógica pura testada, services Supabase, nova identidade visual e kit de UI que os Planos 2 (Leads) e 3 (Oportunidades/Pipeline/Dashboard) consumirão.

**Architecture:** Lógica de oportunidade/WhatsApp/CSV em funções puras TypeScript (TDD com vitest), persistência via services sobre o cliente Supabase existente, pontuação gravada em colunas de `leads` para filtros no servidor. RLS por `owner_id` + grants explícitos.

**Tech Stack:** React 19, TS ~7, Vite 8, Tailwind v4, Supabase Free, vitest (novo, MIT), papaparse (novo, MIT), @fontsource Montserrat/Roboto. recharts e @dnd-kit instalados agora, usados no Plano 3.

**Spec:** `docs/superpowers/specs/2026-11-22-etapa2-design.md`

## Global Constraints

- Somente ferramentas gratuitas/open source; sem APIs pagas, sem billing, sem trials.
- Somente chave publishable no frontend; service role nunca; credenciais nunca em código ou arquivos commitados (`.env.local` apenas, git-ignored).
- RLS `owner_id = auth.uid()` em toda tabela privada + `grant ... to authenticated` explícito; sem grants a `anon`.
- Presença digital tri-estado: `yes | no | unverified`, padrão `unverified`; ausência só confirmada com `no`.
- Interface pt-BR; verde cor principal; Montserrat títulos, Roboto textos; acentos azul/lime/pink mantidos.
- Não recriar o projeto; preservar auth, rotas, ErrorBoundary, página /status.
- Não usar dados fictícios como reais; não afirmar teste não executado.
- Commits frequentes; `npm run build` e `npm run lint` devem passar ao fim de cada tarefa (lint: 0 erros; 1 warning conhecido em StatusPage é aceito).
- Testes unitários: `npm test` (vitest run). Testes de UI: navegador (dev server), login com credenciais de teste fornecidas pelo usuário na sessão (nunca gravá-las em arquivos).

---

### Task 1: Dependências + vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Modify: `src/index.css` (só import de fonte, tokens na Task 9)

**Interfaces:**
- Produces: scripts `npm test`; libs `papaparse`, `recharts`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@fontsource-variable/montserrat`, `@fontsource/roboto`, `vitest` disponíveis.

- [ ] **Step 1: Instalar dependências**

```bash
npm install papaparse recharts @dnd-kit/core @dnd-kit/sortable @fontsource-variable/montserrat @fontsource/roboto
npm install -D vitest @types/papaparse
npm uninstall @fontsource-variable/outfit
```

- [ ] **Step 2: Criar `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Adicionar script de teste em `package.json`**

Em `"scripts"`, adicionar `"test": "vitest run"` (manter dev/build/lint/preview).

- [ ] **Step 4: Verificar que a suite roda (vazia)**

Run: `npm test`
Expected: exit 0, "No test files found" (vitest ≥3 sai 0 com `--passWithNoTests`? se sair 1, adicionar `passWithNoTests: true` ao config e rodar de novo).

- [ ] **Step 5: Build ainda passa (fontes antigas ainda importadas — não quebrar ainda)**

Run: `npm run build`
Expected: PASS (Outfit foi removido do node_modules mas `src/index.css` ainda o importa → se falhar, trocar provisoriamente o import por `@import "@fontsource/roboto/400.css";` — a Task 9 reescreve o CSS inteiro).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/index.css
git commit -m "Adiciona vitest, papaparse, recharts, dnd-kit e fontes Montserrat/Roboto"
```

---

### Task 2: Migration 0002 (usuário executa no SQL Editor)

**Files:**
- Create: `supabase/migrations/0002_etapa2.sql`

**Interfaces:**
- Produces: tabelas `leads`, `lead_activities`, `lead_followups`, `lead_digital_checks`, `user_settings` com RLS+grants; colunas calculadas `score`, `priority`, `needs`, `score_reasons` em leads.

- [ ] **Step 1: Escrever a migration completa**

```sql
-- Etapa 2 — leads, atividades, follow-ups, checklist digital e configurações.
-- Execute este arquivo no Supabase Dashboard → SQL Editor.
-- Não altera a tabela profiles da Etapa 1.

-- ============ LEADS ============
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,

  name text not null,
  responsible_name text,
  niche text,
  phone text,
  whatsapp text,
  email text,
  cnpj text,
  instagram text,
  facebook text,
  website text,
  menu_url text,
  catalog_url text,

  country text default 'Brasil',
  state text,
  city text,
  district text,
  address text,
  zip_code text,

  has_website text not null default 'unverified' check (has_website in ('yes','no','unverified')),
  has_instagram text not null default 'unverified' check (has_instagram in ('yes','no','unverified')),
  has_facebook text not null default 'unverified' check (has_facebook in ('yes','no','unverified')),
  has_digital_menu text not null default 'unverified' check (has_digital_menu in ('yes','no','unverified')),
  has_digital_catalog text not null default 'unverified' check (has_digital_catalog in ('yes','no','unverified')),
  has_landing_page text not null default 'unverified' check (has_landing_page in ('yes','no','unverified')),
  has_business_whatsapp text not null default 'unverified' check (has_business_whatsapp in ('yes','no','unverified')),

  status text not null default 'novo' check (status in (
    'novo','contato_realizado','aguardando_resposta','pediu_informacoes',
    'interessado','negociando','aceitou','ignorou','nao_interessado','follow_up','perdido')),
  offered_service text,
  notes text,
  source text,
  next_contact_at timestamptz,
  last_verified_at timestamptz,

  estimated_value numeric(12,2) not null default 0,
  negotiated_value numeric(12,2) not null default 0,
  contracted_value numeric(12,2) not null default 0,
  received_value numeric(12,2) not null default 0,

  score int not null default 0 check (score between 0 and 100),
  priority text not null default 'baixa' check (priority in ('muito_alta','alta','media','baixa')),
  needs text[] not null default '{}',
  score_reasons jsonb not null default '[]',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_owner_idx on public.leads (owner_id);
create index leads_owner_status_idx on public.leads (owner_id, status);
create index leads_owner_niche_idx on public.leads (owner_id, niche);
create index leads_owner_city_idx on public.leads (owner_id, city);
create index leads_owner_score_idx on public.leads (owner_id, score desc);
create index leads_owner_created_idx on public.leads (owner_id, created_at desc);
create index leads_owner_next_contact_idx on public.leads (owner_id, next_contact_at);

alter table public.leads enable row level security;
grant select, insert, update, delete on public.leads to authenticated;

create policy "leads_select_own" on public.leads for select using (auth.uid() = owner_id);
create policy "leads_insert_own" on public.leads for insert with check (auth.uid() = owner_id);
create policy "leads_update_own" on public.leads for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "leads_delete_own" on public.leads for delete using (auth.uid() = owner_id);

create trigger leads_set_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

-- ============ ATIVIDADES (timeline) ============
create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in (
    'primeiro_contato','mensagem','ligacao','resposta','reuniao',
    'proposta','mudanca_status','observacao','follow_up','outro')),
  description text not null,
  user_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);
create index lead_activities_owner_idx on public.lead_activities (owner_id, created_at desc);

alter table public.lead_activities enable row level security;
grant select, insert, update, delete on public.lead_activities to authenticated;

create policy "activities_select_own" on public.lead_activities for select using (auth.uid() = owner_id);
create policy "activities_insert_own" on public.lead_activities for insert with check (auth.uid() = owner_id);
create policy "activities_update_own" on public.lead_activities for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "activities_delete_own" on public.lead_activities for delete using (auth.uid() = owner_id);

-- ============ FOLLOW-UPS ============
create table public.lead_followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  due_at timestamptz not null,
  reason text,
  note text,
  status text not null default 'pendente' check (status in ('pendente','concluido','cancelado')),
  completed_at timestamptz,
  result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lead_followups_owner_status_due_idx on public.lead_followups (owner_id, status, due_at);
create index lead_followups_lead_idx on public.lead_followups (lead_id, due_at);

alter table public.lead_followups enable row level security;
grant select, insert, update, delete on public.lead_followups to authenticated;

create policy "followups_select_own" on public.lead_followups for select using (auth.uid() = owner_id);
create policy "followups_insert_own" on public.lead_followups for insert with check (auth.uid() = owner_id);
create policy "followups_update_own" on public.lead_followups for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "followups_delete_own" on public.lead_followups for delete using (auth.uid() = owner_id);

create trigger lead_followups_set_updated_at before update on public.lead_followups
  for each row execute function public.set_updated_at();

-- ============ CHECKLIST DE VERIFICAÇÃO DIGITAL ============
create table public.lead_digital_checks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item text not null check (item in ('instagram','website','digital_menu','whatsapp','digital_catalog','business_info')),
  verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (lead_id, item)
);

create index lead_digital_checks_lead_idx on public.lead_digital_checks (lead_id);

alter table public.lead_digital_checks enable row level security;
grant select, insert, update, delete on public.lead_digital_checks to authenticated;

create policy "checks_select_own" on public.lead_digital_checks for select using (auth.uid() = owner_id);
create policy "checks_insert_own" on public.lead_digital_checks for insert with check (auth.uid() = owner_id);
create policy "checks_update_own" on public.lead_digital_checks for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "checks_delete_own" on public.lead_digital_checks for delete using (auth.uid() = owner_id);

-- ============ CONFIGURAÇÕES DO USUÁRIO ============
create table public.user_settings (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  service_prices jsonb not null default '{"site":0,"landing":0,"cardapio":0,"catalogo":0,"outros":0}',
  whatsapp_template text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
grant select, insert, update, delete on public.user_settings to authenticated;

create policy "settings_select_own" on public.user_settings for select using (auth.uid() = owner_id);
create policy "settings_insert_own" on public.user_settings for insert with check (auth.uid() = owner_id);
create policy "settings_update_own" on public.user_settings for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "settings_delete_own" on public.user_settings for delete using (auth.uid() = owner_id);

create trigger user_settings_set_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: Pedir ao usuário para executar a migration**

Mensagem ao usuário: "Execute o conteúdo de `supabase/migrations/0002_etapa2.sql` no SQL Editor do Supabase e me confirme." Aguardar confirmação antes dos testes de integração. Não executar nada no banco por conta própria (sem service role).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_etapa2.sql
git commit -m "Migration 0002: leads, atividades, follow-ups, checklist e settings com RLS"
```

---

### Task 3: Tipos e constantes de domínio

**Files:**
- Create: `src/types/lead.ts`, `src/types/activity.ts`, `src/types/followup.ts`, `src/types/check.ts`, `src/types/settings.ts`

**Interfaces:**
- Produces (consumidos por TODAS as tarefas seguintes):
  - `Lead`, `LeadWrite`, `emptyLeadDraft(): LeadWrite`, `LeadFilters`, `LeadSort`, `PresenceField`
  - `LEAD_STATUSES`, `STATUS_LABELS`, `NICHES`, `NICHE_LABELS`, `PRESENCE_LABELS`, `NEEDS`, `NEED_LABELS`, `PRIORITIES`, `PRIORITY_LABELS`, `SITUATIONS`, `SITUATION_LABELS`, `situationStatuses(s): LeadStatus[]`
  - `Activity`, `ACTIVITY_TYPES`, `ACTIVITY_LABELS`, `ActivityType`
  - `Followup`, `FollowupList`, `FOLLOWUP_STATUS_LABELS`
  - `DigitalCheck`, `CHECK_ITEMS`, `CHECK_LABELS`, `CheckItem`
  - `UserSettings`, `ServicePrices`, `DEFAULT_SETTINGS`

- [ ] **Step 1: Criar `src/types/lead.ts`**

```ts
export const LEAD_STATUSES = [
  'novo', 'contato_realizado', 'aguardando_resposta', 'pediu_informacoes',
  'interessado', 'negociando', 'aceitou', 'ignorou', 'nao_interessado',
  'follow_up', 'perdido',
] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const STATUS_LABELS: Record<LeadStatus, string> = {
  novo: 'Novo',
  contato_realizado: 'Contato realizado',
  aguardando_resposta: 'Aguardando resposta',
  pediu_informacoes: 'Pediu informações',
  interessado: 'Interessado',
  negociando: 'Negociando',
  aceitou: 'Aceitou',
  ignorou: 'Ignorou',
  nao_interessado: 'Não interessado',
  follow_up: 'Follow-up',
  perdido: 'Perdido',
}

export const NICHES = [
  'barbearia', 'manicure', 'nail_designer', 'salao_beleza', 'restaurante',
  'pizzaria', 'hamburgueria', 'lanchonete', 'cafeteria', 'clinica_estetica',
  'comercio', 'outros',
] as const
export type Niche = (typeof NICHES)[number]

export const NICHE_LABELS: Record<Niche, string> = {
  barbearia: 'Barbearia',
  manicure: 'Manicure',
  nail_designer: 'Nail designer',
  salao_beleza: 'Salão de beleza',
  restaurante: 'Restaurante',
  pizzaria: 'Pizzaria',
  hamburgueria: 'Hamburgueria',
  lanchonete: 'Lanchonete',
  cafeteria: 'Cafeteria',
  clinica_estetica: 'Clínica de estética',
  comercio: 'Pequeno comércio',
  outros: 'Outros',
}

export const PRESENCE_VALUES = ['yes', 'no', 'unverified'] as const
export type Presence = (typeof PRESENCE_VALUES)[number]

export const PRESENCE_LABELS: Record<Presence, string> = {
  yes: 'Sim',
  no: 'Não',
  unverified: 'Não verificado',
}

export const PRESENCE_FIELDS = [
  'has_website', 'has_instagram', 'has_facebook', 'has_digital_menu',
  'has_digital_catalog', 'has_landing_page', 'has_business_whatsapp',
] as const
export type PresenceField = (typeof PRESENCE_FIELDS)[number]

export const PRESENCE_FIELD_LABELS: Record<PresenceField, string> = {
  has_website: 'Possui site?',
  has_instagram: 'Possui Instagram?',
  has_facebook: 'Possui Facebook?',
  has_digital_menu: 'Possui cardápio digital?',
  has_digital_catalog: 'Possui catálogo digital?',
  has_landing_page: 'Possui página de apresentação?',
  has_business_whatsapp: 'Possui WhatsApp comercial?',
}

export const NEEDS = ['site', 'cardapio', 'landing', 'catalogo', 'presenca'] as const
export type Need = (typeof NEEDS)[number]

export const NEED_LABELS: Record<Need, string> = {
  site: 'Precisa de site',
  cardapio: 'Precisa de cardápio digital',
  landing: 'Precisa de landing page',
  catalogo: 'Precisa de catálogo digital',
  presenca: 'Precisa melhorar presença digital',
}

export const PRIORITIES = ['muito_alta', 'alta', 'media', 'baixa'] as const
export type Priority = (typeof PRIORITIES)[number]

export const PRIORITY_LABELS: Record<Priority, string> = {
  muito_alta: 'Muito alta',
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
}

export const SITUATIONS = [
  'nao_prospectado', 'pronto_contato', 'contato_realizado',
  'interessado', 'negociando', 'convertido', 'nao_interessado',
] as const
export type Situation = (typeof SITUATIONS)[number]

export const SITUATION_LABELS: Record<Situation, string> = {
  nao_prospectado: 'Não prospectado',
  pronto_contato: 'Pronto para contato',
  contato_realizado: 'Contato realizado',
  interessado: 'Interessado',
  negociando: 'Negociando',
  convertido: 'Convertido',
  nao_interessado: 'Não interessado',
}

export function situationStatuses(s: Situation): LeadStatus[] {
  switch (s) {
    case 'nao_prospectado': return ['novo']
    case 'pronto_contato': return ['novo', 'follow_up']
    case 'contato_realizado': return ['contato_realizado', 'aguardando_resposta', 'pediu_informacoes']
    case 'interessado': return ['interessado']
    case 'negociando': return ['negociando']
    case 'convertido': return ['aceitou']
    case 'nao_interessado': return ['nao_interessado', 'ignorou', 'perdido']
  }
}

export const INELIGIBLE_STATUSES: LeadStatus[] = ['aceitou', 'perdido', 'nao_interessado']

export interface Lead {
  id: string
  owner_id: string
  name: string
  responsible_name: string | null
  niche: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  cnpj: string | null
  instagram: string | null
  facebook: string | null
  website: string | null
  menu_url: string | null
  catalog_url: string | null
  country: string | null
  state: string | null
  city: string | null
  district: string | null
  address: string | null
  zip_code: string | null
  has_website: Presence
  has_instagram: Presence
  has_facebook: Presence
  has_digital_menu: Presence
  has_digital_catalog: Presence
  has_landing_page: Presence
  has_business_whatsapp: Presence
  status: LeadStatus
  offered_service: string | null
  notes: string | null
  source: string | null
  next_contact_at: string | null
  last_verified_at: string | null
  estimated_value: number
  negotiated_value: number
  contracted_value: number
  received_value: number
  score: number
  priority: Priority
  needs: Need[]
  score_reasons: string[]
  created_at: string
  updated_at: string
}

export type LeadWrite = Omit<
  Lead,
  'id' | 'owner_id' | 'created_at' | 'updated_at' | 'score' | 'priority' | 'needs' | 'score_reasons'
>

export function emptyLeadDraft(): LeadWrite {
  return {
    name: '',
    responsible_name: null,
    niche: null,
    phone: null,
    whatsapp: null,
    email: null,
    cnpj: null,
    instagram: null,
    facebook: null,
    website: null,
    menu_url: null,
    catalog_url: null,
    country: 'Brasil',
    state: null,
    city: null,
    district: null,
    address: null,
    zip_code: null,
    has_website: 'unverified',
    has_instagram: 'unverified',
    has_facebook: 'unverified',
    has_digital_menu: 'unverified',
    has_digital_catalog: 'unverified',
    has_landing_page: 'unverified',
    has_business_whatsapp: 'unverified',
    status: 'novo',
    offered_service: null,
    notes: null,
    source: null,
    next_contact_at: null,
    last_verified_at: null,
    estimated_value: 0,
    negotiated_value: 0,
    contracted_value: 0,
    received_value: 0,
  }
}

export interface LeadFilters {
  search?: string
  niche?: string
  city?: string
  district?: string
  status?: LeadStatus
  presenceField?: PresenceField
  presenceValue?: Presence
  createdFrom?: string
  createdTo?: string
  minScore?: number
  maxScore?: number
  need?: Need
  instagramWithoutSite?: boolean
  noSiteNoMenu?: boolean
  situation?: Situation
  excludeStatuses?: LeadStatus[]
  hasNeeds?: boolean
}

export type LeadSort = 'created_desc' | 'created_asc' | 'score_desc' | 'score_asc'
```

- [ ] **Step 2: Criar `src/types/activity.ts`**

```ts
export const ACTIVITY_TYPES = [
  'primeiro_contato', 'mensagem', 'ligacao', 'resposta', 'reuniao',
  'proposta', 'mudanca_status', 'observacao', 'follow_up', 'outro',
] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  primeiro_contato: 'Primeiro contato',
  mensagem: 'Mensagem enviada',
  ligacao: 'Ligação realizada',
  resposta: 'Resposta recebida',
  reuniao: 'Reunião',
  proposta: 'Envio de proposta',
  mudanca_status: 'Mudança de status',
  observacao: 'Observação',
  follow_up: 'Follow-up',
  outro: 'Outro',
}

export interface Activity {
  id: string
  lead_id: string
  owner_id: string
  type: ActivityType
  description: string
  user_id: string | null
  created_at: string
}
```

- [ ] **Step 3: Criar `src/types/followup.ts`**

```ts
export type FollowupStatus = 'pendente' | 'concluido' | 'cancelado'

export const FOLLOWUP_STATUS_LABELS: Record<FollowupStatus, string> = {
  pendente: 'Pendente',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

export interface Followup {
  id: string
  lead_id: string
  owner_id: string
  due_at: string
  reason: string | null
  note: string | null
  status: FollowupStatus
  completed_at: string | null
  result: string | null
  created_at: string
  updated_at: string
}

export type FollowupList = 'today' | 'upcoming' | 'overdue' | 'done' | 'all'
```

- [ ] **Step 4: Criar `src/types/check.ts`**

```ts
export const CHECK_ITEMS = [
  'instagram', 'website', 'digital_menu', 'whatsapp', 'digital_catalog', 'business_info',
] as const
export type CheckItem = (typeof CHECK_ITEMS)[number]

export const CHECK_LABELS: Record<CheckItem, string> = {
  instagram: 'Instagram verificado',
  website: 'Site verificado',
  digital_menu: 'Cardápio digital verificado',
  whatsapp: 'WhatsApp verificado',
  digital_catalog: 'Catálogo verificado',
  business_info: 'Informações comerciais verificadas',
}

export interface DigitalCheck {
  id: string
  lead_id: string
  owner_id: string
  item: CheckItem
  verified: boolean
  verified_at: string | null
  created_at: string
}
```

- [ ] **Step 5: Criar `src/types/settings.ts`**

```ts
export interface ServicePrices {
  site: number
  landing: number
  cardapio: number
  catalogo: number
  outros: number
}

export const SERVICE_LABELS: Record<keyof ServicePrices, string> = {
  site: 'Site',
  landing: 'Landing page',
  cardapio: 'Cardápio digital',
  catalogo: 'Catálogo digital',
  outros: 'Outros serviços',
}

export interface UserSettings {
  owner_id: string
  service_prices: ServicePrices
  whatsapp_template: string
}

export const DEFAULT_SETTINGS: Omit<UserSettings, 'owner_id'> = {
  service_prices: { site: 0, landing: 0, cardapio: 0, catalogo: 0, outros: 0 },
  whatsapp_template: '',
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run build`
Expected: PASS (tipos ainda não usados, mas válidos).

- [ ] **Step 7: Commit**

```bash
git add src/types
git commit -m "Tipos e constantes de dominio da Etapa 2"
```

---

### Task 4: `lib/format.ts` (TDD)

**Files:**
- Create: `src/lib/format.ts`, `src/lib/format.test.ts`

**Interfaces:**
- Produces: `formatBRL(value: number): string`, `formatDate(iso: string | null): string`, `formatDateTime(iso: string | null): string`, `onlyDigits(value: string): string`, `formatPhone(raw: string): string`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/lib/format.test.ts
import { describe, expect, it } from 'vitest'
import { formatBRL, formatDate, formatDateTime, formatPhone, onlyDigits } from './format'

describe('formatBRL', () => {
  it('formata valores em reais', () => {
    expect(formatBRL(1500)).toMatch(/R\$\s?1\.500,00/)
    expect(formatBRL(0)).toMatch(/R\$\s?0,00/)
  })
})

describe('onlyDigits', () => {
  it('remove tudo que não é dígito', () => {
    expect(onlyDigits('(11) 98888-7777')).toBe('11988887777')
    expect(onlyDigits('12.345.678/0001-90')).toBe('12345678000190')
  })
})

describe('formatPhone', () => {
  it('formata celular com DDD', () => {
    expect(formatPhone('11988887777')).toBe('(11) 98888-7777')
  })
  it('formata fixo com DDD', () => {
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444')
  })
  it('devolve o original se não reconhece o formato', () => {
    expect(formatPhone('123')).toBe('123')
  })
})

describe('formatDate / formatDateTime', () => {
  it('retorna traço para nulo', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDateTime(null)).toBe('—')
  })
  it('formata ISO para pt-BR', () => {
    expect(formatDate('2026-11-22T15:00:00Z')).toMatch(/22\/11\/2026/)
    expect(formatDateTime('2026-11-22T15:00:00Z')).toMatch(/22\/11\/2026/)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — módulo `./format` não existe.

- [ ] **Step 3: Implementar `src/lib/format.ts`**

```ts
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatBRL(value: number): string {
  return brl.format(Number.isFinite(value) ? value : 0)
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export function formatPhone(raw: string): string {
  const d = onlyDigits(raw)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return raw
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR')
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "lib/format: moeda BRL, datas pt-BR e telefone (TDD)"
```

---

### Task 5: `lib/opportunity.ts` — pontuação (TDD)

**Files:**
- Create: `src/lib/opportunity.ts`, `src/lib/opportunity.test.ts`

**Interfaces:**
- Consumes: tipos da Task 3 (`Lead`, `Need`, `Priority`, `Niche`).
- Produces:
  - `OpportunityInput` = `Pick<Lead, 'niche' | 'has_website' | 'has_instagram' | 'has_facebook' | 'has_digital_menu' | 'has_digital_catalog' | 'has_landing_page' | 'has_business_whatsapp' | 'phone' | 'whatsapp' | 'email'>`
  - `OpportunityResult { score: number; priority: Priority; needs: Need[]; reasons: string[] }`
  - `computeOpportunity(input: OpportunityInput): OpportunityResult`
  - `priorityFromScore(score: number): Priority`
  - `MENU_NICHES: readonly Niche[]`, `CATALOG_NICHES: readonly Niche[]`

Regras (spec §4): +25 site `no`; +25 cardápio `no` em nicho aplicável; +15 instagram `yes` + site `no`; +10 catálogo `no` em nicho aplicável; +10 somente WhatsApp (whatsapp comercial `yes` e website/instagram/facebook todos `no`); +5 sem nenhum canal de contato (phone, whatsapp, email vazios/nulos); +10 presença limitada (≥3 campos de presença `no`, apenas se "somente WhatsApp" NÃO aplicado). `unverified` nunca pontua. Teto 100. Prioridade: ≥80 muito_alta, ≥60 alta, ≥40 media, senão baixa.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/lib/opportunity.test.ts
import { describe, expect, it } from 'vitest'
import { computeOpportunity, priorityFromScore, type OpportunityInput } from './opportunity'

function base(overrides: Partial<OpportunityInput> = {}): OpportunityInput {
  return {
    niche: 'barbearia',
    has_website: 'unverified',
    has_instagram: 'unverified',
    has_facebook: 'unverified',
    has_digital_menu: 'unverified',
    has_digital_catalog: 'unverified',
    has_landing_page: 'unverified',
    has_business_whatsapp: 'unverified',
    phone: '11988887777',
    whatsapp: null,
    email: null,
    ...overrides,
  }
}

describe('priorityFromScore', () => {
  it('classifica faixas', () => {
    expect(priorityFromScore(100)).toBe('muito_alta')
    expect(priorityFromScore(80)).toBe('muito_alta')
    expect(priorityFromScore(79)).toBe('alta')
    expect(priorityFromScore(60)).toBe('alta')
    expect(priorityFromScore(59)).toBe('media')
    expect(priorityFromScore(40)).toBe('media')
    expect(priorityFromScore(39)).toBe('baixa')
    expect(priorityFromScore(0)).toBe('baixa')
  })
})

describe('computeOpportunity', () => {
  it('não pontua nada quando tudo é não verificado', () => {
    const r = computeOpportunity(base())
    expect(r.score).toBe(0)
    expect(r.needs).toEqual([])
    expect(r.reasons).toEqual([])
    expect(r.priority).toBe('baixa')
  })

  it('site ausente confirmado: +25 e necessidade site', () => {
    const r = computeOpportunity(base({ has_website: 'no' }))
    expect(r.score).toBe(25)
    expect(r.needs).toContain('site')
    expect(r.reasons.length).toBeGreaterThan(0)
  })

  it('instagram sem site: +25 +15 e necessidades site+landing', () => {
    const r = computeOpportunity(base({ has_website: 'no', has_instagram: 'yes' }))
    expect(r.score).toBe(40)
    expect(r.needs).toContain('site')
    expect(r.needs).toContain('landing')
  })

  it('cardápio só pontua em nicho aplicável', () => {
    const pizzaria = computeOpportunity(base({ niche: 'pizzaria', has_digital_menu: 'no' }))
    expect(pizzaria.score).toBe(25)
    expect(pizzaria.needs).toContain('cardapio')
    const barbearia = computeOpportunity(base({ niche: 'barbearia', has_digital_menu: 'no' }))
    expect(barbearia.score).toBe(0)
  })

  it('catálogo pontua em nicho aplicável (comércio)', () => {
    const r = computeOpportunity(base({ niche: 'comercio', has_digital_catalog: 'no' }))
    expect(r.score).toBe(10)
    expect(r.needs).toContain('catalogo')
  })

  it('somente WhatsApp: +10 e não soma presença limitada junto', () => {
    const r = computeOpportunity(base({
      has_website: 'no', has_instagram: 'no', has_facebook: 'no',
      has_business_whatsapp: 'yes',
    }))
    // 25 (site) + 10 (somente whatsapp); presença limitada não soma em duplicidade
    expect(r.score).toBe(35)
    expect(r.needs).toContain('presenca')
  })

  it('presença limitada: 3+ ausências confirmadas sem ser somente WhatsApp', () => {
    const r = computeOpportunity(base({
      has_website: 'no', has_instagram: 'no', has_facebook: 'no',
      has_business_whatsapp: 'no',
    }))
    // 25 (site) + 10 (presença limitada)
    expect(r.score).toBe(35)
  })

  it('sem nenhum canal de contato: +5', () => {
    const r = computeOpportunity(base({ phone: null, whatsapp: null, email: null }))
    expect(r.score).toBe(5)
    expect(r.needs).toContain('presenca')
  })

  it('restaurante sem site e sem cardápio, instagram presente: 25+25+15=65', () => {
    const r = computeOpportunity(base({
      niche: 'restaurante', has_website: 'no', has_digital_menu: 'no', has_instagram: 'yes',
    }))
    expect(r.score).toBe(65)
    expect(r.priority).toBe('alta')
  })

  it('teto de 100 pontos', () => {
    const r = computeOpportunity(base({
      niche: 'restaurante',
      has_website: 'no', has_instagram: 'yes', has_facebook: 'no',
      has_digital_menu: 'no', has_digital_catalog: 'no', has_landing_page: 'no',
      has_business_whatsapp: 'no',
      phone: null, whatsapp: null, email: null,
    }))
    expect(r.score).toBeLessThanOrEqual(100)
  })

  it('justificativas citam apenas dados cadastrados', () => {
    const r = computeOpportunity(base({ has_website: 'no' }))
    expect(r.reasons.join(' ')).toMatch(/site/i)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — módulo `./opportunity` não existe.

- [ ] **Step 3: Implementar `src/lib/opportunity.ts`**

```ts
import type { Lead, Need, Niche, Priority } from '../types/lead'

export type OpportunityInput = Pick<
  Lead,
  | 'niche' | 'has_website' | 'has_instagram' | 'has_facebook'
  | 'has_digital_menu' | 'has_digital_catalog' | 'has_landing_page'
  | 'has_business_whatsapp' | 'phone' | 'whatsapp' | 'email'
>

export interface OpportunityResult {
  score: number
  priority: Priority
  needs: Need[]
  reasons: string[]
}

export const MENU_NICHES: readonly Niche[] = [
  'restaurante', 'pizzaria', 'hamburgueria', 'lanchonete', 'cafeteria',
]

export const CATALOG_NICHES: readonly Niche[] = [...MENU_NICHES, 'comercio', 'outros']

export function priorityFromScore(score: number): Priority {
  if (score >= 80) return 'muito_alta'
  if (score >= 60) return 'alta'
  if (score >= 40) return 'media'
  return 'baixa'
}

export function computeOpportunity(input: OpportunityInput): OpportunityResult {
  let score = 0
  const needs = new Set<Need>()
  const reasons: string[] = []

  const noSite = input.has_website === 'no'
  const menuApplicable = MENU_NICHES.includes((input.niche ?? '') as Niche)
  const catalogApplicable = CATALOG_NICHES.includes((input.niche ?? '') as Niche)

  if (noSite) {
    score += 25
    needs.add('site')
    reasons.push('Não possui site (ausência confirmada).')
  }

  if (menuApplicable && input.has_digital_menu === 'no') {
    score += 25
    needs.add('cardapio')
    reasons.push('Não possui cardápio digital (ausência confirmada), aplicável ao nicho.')
  }

  if (input.has_instagram === 'yes' && noSite) {
    score += 15
    needs.add('landing')
    reasons.push('Possui Instagram, mas não possui site — oportunidade de landing page.')
  }

  if (catalogApplicable && input.has_digital_catalog === 'no') {
    score += 10
    needs.add('catalogo')
    reasons.push('Não possui catálogo digital (ausência confirmada), aplicável ao nicho.')
  }

  const onlyWhatsapp =
    input.has_business_whatsapp === 'yes' &&
    noSite &&
    input.has_instagram === 'no' &&
    input.has_facebook === 'no'

  if (onlyWhatsapp) {
    score += 10
    needs.add('presenca')
    reasons.push('Utiliza somente WhatsApp para apresentar os serviços (canais confirmados).')
  }

  const noContact = !input.phone?.trim() && !input.whatsapp?.trim() && !input.email?.trim()
  if (noContact) {
    score += 5
    needs.add('presenca')
    reasons.push('Informações comerciais incompletas: nenhum canal de contato cadastrado.')
  }

  const presenceFields = [
    input.has_website, input.has_instagram, input.has_facebook,
    input.has_digital_menu, input.has_digital_catalog,
    input.has_landing_page, input.has_business_whatsapp,
  ]
  const confirmedAbsences = presenceFields.filter((v) => v === 'no').length
  if (!onlyWhatsapp && confirmedAbsences >= 3) {
    score += 10
    needs.add('presenca')
    reasons.push(`Presença digital limitada: ${confirmedAbsences} itens confirmados como ausentes.`)
  }

  score = Math.min(100, score)
  return { score, priority: priorityFromScore(score), needs: [...needs], reasons }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS (todos, inclusive os de format).

- [ ] **Step 5: Commit**

```bash
git add src/lib/opportunity.ts src/lib/opportunity.test.ts
git commit -m "lib/opportunity: pontuacao 0-100 com regras tri-estado (TDD)"
```

---

### Task 6: `lib/whatsapp.ts` (TDD)

**Files:**
- Create: `src/lib/whatsapp.ts`, `src/lib/whatsapp.test.ts`

**Interfaces:**
- Produces: `normalizeWhatsAppNumber(raw: string): string | null` (dígitos `55DDDNUMERO`, 12–13 dígitos, ou null), `buildWhatsAppLink(raw: string, message?: string): string | null` (`https://wa.me/<num>` + `?text=` encodeURIComponent quando mensagem não vazia).

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/lib/whatsapp.test.ts
import { describe, expect, it } from 'vitest'
import { buildWhatsAppLink, normalizeWhatsAppNumber } from './whatsapp'

describe('normalizeWhatsAppNumber', () => {
  it('adiciona 55 a celular com DDD (11 dígitos)', () => {
    expect(normalizeWhatsAppNumber('(11) 98888-7777')).toBe('5511988887777')
  })
  it('adiciona 55 a fixo com DDD (10 dígitos)', () => {
    expect(normalizeWhatsAppNumber('1133334444')).toBe('551133334444')
  })
  it('mantém número que já tem 55', () => {
    expect(normalizeWhatsAppNumber('5511988887777')).toBe('5511988887777')
    expect(normalizeWhatsAppNumber('+55 (11) 98888-7777')).toBe('5511988887777')
  })
  it('remove zero inicial de DDD', () => {
    expect(normalizeWhatsAppNumber('011988887777')).toBe('5511988887777')
  })
  it('rejeita números inválidos', () => {
    expect(normalizeWhatsAppNumber('')).toBeNull()
    expect(normalizeWhatsAppNumber('123')).toBeNull()
    expect(normalizeWhatsAppNumber('abcdefghij')).toBeNull()
    expect(normalizeWhatsAppNumber('55119888877779999')).toBeNull()
  })
})

describe('buildWhatsAppLink', () => {
  it('monta link wa.me sem mensagem', () => {
    expect(buildWhatsAppLink('11988887777')).toBe('https://wa.me/5511988887777')
  })
  it('codifica a mensagem', () => {
    expect(buildWhatsAppLink('11988887777', 'Olá, tudo bem?')).toBe(
      'https://wa.me/5511988887777?text=Ol%C3%A1%2C%20tudo%20bem%3F',
    )
  })
  it('ignora mensagem vazia', () => {
    expect(buildWhatsAppLink('11988887777', '   ')).toBe('https://wa.me/5511988887777')
  })
  it('retorna null para número inválido', () => {
    expect(buildWhatsAppLink('123')).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — módulo `./whatsapp` não existe.

- [ ] **Step 3: Implementar `src/lib/whatsapp.ts`**

```ts
import { onlyDigits } from './format'

export function normalizeWhatsAppNumber(raw: string): string | null {
  let digits = onlyDigits(raw).replace(/^0+/, '')
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    // já internacional
  } else if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`
  } else {
    return null
  }
  if (digits.length < 12 || digits.length > 13) return null
  return digits
}

export function buildWhatsAppLink(raw: string, message?: string): string | null {
  const number = normalizeWhatsAppNumber(raw)
  if (!number) return null
  const text = message?.trim()
  return text ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : `https://wa.me/${number}`
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp.ts src/lib/whatsapp.test.ts
git commit -m "lib/whatsapp: normalizacao 55DDDNUMERO e link wa.me manual (TDD)"
```

---

### Task 7: `lib/csv.ts` — export/parse/validação (TDD)

**Files:**
- Create: `src/lib/csv.ts`, `src/lib/csv.test.ts`

**Interfaces:**
- Consumes: `Lead`, `LeadWrite`, `emptyLeadDraft`, `LEAD_STATUSES`, `STATUS_LABELS`, `NICHES`, `NICHE_LABELS`, `Presence` (Task 3); papaparse.
- Produces:
  - `CSV_HEADERS: readonly string[]` (ordem fixa abaixo)
  - `leadsToCsv(leads: Lead[]): string`
  - `CsvParsedRow { line: number; draft: LeadWrite | null; errors: string[] }`
  - `parseLeadsCsv(text: string): CsvParsedRow[]`

Headers (nesta ordem): `nome, responsavel, nicho, telefone, whatsapp, email, cnpj, instagram, facebook, site, cardapio_url, catalogo_url, pais, estado, cidade, bairro, endereco, cep, status, servico, valor_estimado, observacoes, origem, tem_site, tem_instagram, tem_facebook, tem_cardapio, tem_catalogo, tem_landing, tem_whatsapp_comercial`.

Regras de parse: `nome` vazio → erro "Nome é obrigatório"; presença aceita `sim/não/nao/yes/no/não verificado/nao verificado/unverified` (case-insensitive), vazio → `unverified`, valor desconhecido → erro; status aceita valor ou label pt-BR, inválido → erro (vazio → `novo`); nicho aceita valor ou label, desconhecido vira texto livre minúsculo (sem erro); `valor_estimado` aceita `1500`, `1500.50`, `1.500,50`, vazio → 0, inválido → erro. Linha com qualquer erro → `draft: null`. Detecção de duplicidade NÃO acontece aqui (é no service, Plano 2).

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/lib/csv.test.ts
import { describe, expect, it } from 'vitest'
import { CSV_HEADERS, leadsToCsv, parseLeadsCsv } from './csv'
import { emptyLeadDraft, type Lead } from '../types/lead'

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    ...emptyLeadDraft(),
    id: '00000000-0000-0000-0000-000000000001',
    owner_id: '00000000-0000-0000-0000-000000000002',
    score: 0,
    priority: 'baixa',
    needs: [],
    score_reasons: [],
    created_at: '2026-11-22T00:00:00Z',
    updated_at: '2026-11-22T00:00:00Z',
    name: 'Barbearia do João',
    niche: 'barbearia',
    city: 'São Paulo',
    has_website: 'no',
    estimated_value: 1500,
    ...overrides,
  } as Lead
}

describe('leadsToCsv', () => {
  it('gera header + linha com dados', () => {
    const csv = leadsToCsv([makeLead()])
    const lines = csv.trim().split('\n')
    expect(lines[0].replace(/"/g, '')).toBe(CSV_HEADERS.join(','))
    expect(lines[1]).toContain('Barbearia do João')
    expect(lines[1]).toContain('não') // presença no exportada em pt-BR
  })
})

describe('parseLeadsCsv', () => {
  it('importa linha válida', () => {
    const csv = 'nome,cidade,tem_site,valor_estimado\nBarbearia do João,São Paulo,não,"1.500,00"'
    const rows = parseLeadsCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].errors).toEqual([])
    expect(rows[0].draft?.name).toBe('Barbearia do João')
    expect(rows[0].draft?.has_website).toBe('no')
    expect(rows[0].draft?.estimated_value).toBe(1500)
    expect(rows[0].draft?.status).toBe('novo')
  })

  it('acusa nome obrigatório', () => {
    const rows = parseLeadsCsv('nome,cidade\n,São Paulo')
    expect(rows[0].draft).toBeNull()
    expect(rows[0].errors.join(' ')).toMatch(/Nome/)
  })

  it('presença desconhecida vira erro; vazio vira unverified', () => {
    const rows = parseLeadsCsv('nome,tem_site,tem_instagram\nA,talvez,\nB,,sim')
    expect(rows[0].errors.join(' ')).toMatch(/tem_site/)
    expect(rows[1].draft?.has_instagram).toBe('yes')
    expect(rows[1].draft?.has_website).toBe('unverified')
  })

  it('status inválido vira erro; label pt-BR é aceito', () => {
    const rows = parseLeadsCsv('nome,status\nA,xyz\nB,Interessado')
    expect(rows[0].draft).toBeNull()
    expect(rows[1].draft?.status).toBe('interessado')
  })

  it('valor inválido vira erro', () => {
    const rows = parseLeadsCsv('nome,valor_estimado\nA,abc')
    expect(rows[0].errors.join(' ')).toMatch(/valor_estimado/)
  })

  it('roundtrip export → import preserva dados essenciais', () => {
    const original = makeLead()
    const rows = parseLeadsCsv(leadsToCsv([original]))
    expect(rows[0].errors).toEqual([])
    expect(rows[0].draft?.name).toBe(original.name)
    expect(rows[0].draft?.has_website).toBe('no')
    expect(rows[0].draft?.estimated_value).toBe(1500)
    expect(rows[0].draft?.niche).toBe('barbearia')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — módulo `./csv` não existe.

- [ ] **Step 3: Implementar `src/lib/csv.ts`**

```ts
import Papa from 'papaparse'
import {
  emptyLeadDraft,
  LEAD_STATUSES,
  NICHE_LABELS,
  NICHES,
  STATUS_LABELS,
  type Lead,
  type LeadStatus,
  type LeadWrite,
  type Presence,
} from '../types/lead'

export const CSV_HEADERS = [
  'nome', 'responsavel', 'nicho', 'telefone', 'whatsapp', 'email', 'cnpj',
  'instagram', 'facebook', 'site', 'cardapio_url', 'catalogo_url',
  'pais', 'estado', 'cidade', 'bairro', 'endereco', 'cep',
  'status', 'servico', 'valor_estimado', 'observacoes', 'origem',
  'tem_site', 'tem_instagram', 'tem_facebook', 'tem_cardapio',
  'tem_catalogo', 'tem_landing', 'tem_whatsapp_comercial',
] as const

const PRESENCE_EXPORT: Record<Presence, string> = { yes: 'sim', no: 'não', unverified: 'não verificado' }

export function leadsToCsv(leads: Lead[]): string {
  const rows = leads.map((l) => [
    l.name, l.responsible_name ?? '', l.niche ?? '', l.phone ?? '', l.whatsapp ?? '',
    l.email ?? '', l.cnpj ?? '', l.instagram ?? '', l.facebook ?? '', l.website ?? '',
    l.menu_url ?? '', l.catalog_url ?? '', l.country ?? '', l.state ?? '', l.city ?? '',
    l.district ?? '', l.address ?? '', l.zip_code ?? '', STATUS_LABELS[l.status],
    l.offered_service ?? '', String(l.estimated_value), l.notes ?? '', l.source ?? '',
    PRESENCE_EXPORT[l.has_website], PRESENCE_EXPORT[l.has_instagram], PRESENCE_EXPORT[l.has_facebook],
    PRESENCE_EXPORT[l.has_digital_menu], PRESENCE_EXPORT[l.has_digital_catalog],
    PRESENCE_EXPORT[l.has_landing_page], PRESENCE_EXPORT[l.has_business_whatsapp],
  ])
  return Papa.unparse({ fields: [...CSV_HEADERS], data: rows })
}

export interface CsvParsedRow {
  line: number
  draft: LeadWrite | null
  errors: string[]
}

function parsePresence(raw: string): Presence | null {
  const v = raw.trim().toLowerCase()
  if (v === '') return 'unverified'
  if (['sim', 'yes', 's', 'true', '1'].includes(v)) return 'yes'
  if (['não', 'nao', 'no', 'n', 'false', '0'].includes(v)) return 'no'
  if (['não verificado', 'nao verificado', 'unverified', 'desconhecido'].includes(v)) return 'unverified'
  return null
}

function parseStatus(raw: string): LeadStatus | null {
  const v = raw.trim().toLowerCase()
  if (v === '') return 'novo'
  const byValue = LEAD_STATUSES.find((s) => s === v)
  if (byValue) return byValue
  const byLabel = LEAD_STATUSES.find((s) => STATUS_LABELS[s].toLowerCase() === v)
  return byLabel ?? null
}

function parseNiche(raw: string): string | null {
  const v = raw.trim().toLowerCase()
  if (v === '') return null
  const byValue = NICHES.find((n) => n === v)
  if (byValue) return byValue
  const byLabel = NICHES.find((n) => NICHE_LABELS[n].toLowerCase() === v)
  return byLabel ?? v
}

function parseMoney(raw: string): number | null {
  const v = raw.trim()
  if (v === '') return 0
  const normalized = v.includes(',')
    ? v.replace(/\./g, '').replace(',', '.')
    : v
  const n = Number(normalized)
  return Number.isFinite(n) && n >= 0 ? n : null
}

const PRESENCE_COLUMNS: Array<[string, keyof LeadWrite]> = [
  ['tem_site', 'has_website'],
  ['tem_instagram', 'has_instagram'],
  ['tem_facebook', 'has_facebook'],
  ['tem_cardapio', 'has_digital_menu'],
  ['tem_catalogo', 'has_digital_catalog'],
  ['tem_landing', 'has_landing_page'],
  ['tem_whatsapp_comercial', 'has_business_whatsapp'],
]

export function parseLeadsCsv(text: string): CsvParsedRow[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })
  return parsed.data.map((row, i) => {
    const errors: string[] = []
    const draft = emptyLeadDraft()
    const get = (key: string) => (row[key] ?? '').trim()

    draft.name = get('nome')
    if (!draft.name) errors.push('Nome é obrigatório.')

    draft.responsible_name = get('responsavel') || null
    draft.niche = parseNiche(get('nicho'))
    draft.phone = get('telefone') || null
    draft.whatsapp = get('whatsapp') || null
    draft.email = get('email') || null
    draft.cnpj = get('cnpj') || null
    draft.instagram = get('instagram') || null
    draft.facebook = get('facebook') || null
    draft.website = get('site') || null
    draft.menu_url = get('cardapio_url') || null
    draft.catalog_url = get('catalogo_url') || null
    draft.country = get('pais') || 'Brasil'
    draft.state = get('estado') || null
    draft.city = get('cidade') || null
    draft.district = get('bairro') || null
    draft.address = get('endereco') || null
    draft.zip_code = get('cep') || null
    draft.offered_service = get('servico') || null
    draft.notes = get('observacoes') || null
    draft.source = get('origem') || null

    const status = parseStatus(get('status'))
    if (status === null) errors.push(`status inválido: "${get('status')}".`)
    else draft.status = status

    const money = parseMoney(get('valor_estimado'))
    if (money === null) errors.push(`valor_estimado inválido: "${get('valor_estimado')}".`)
    else draft.estimated_value = money

    for (const [column, field] of PRESENCE_COLUMNS) {
      const presence = parsePresence(get(column))
      if (presence === null) errors.push(`${column} inválido: "${get(column)}" (use sim, não ou não verificado).`)
      else (draft as Record<string, unknown>)[field] = presence
    }

    return { line: i + 2, draft: errors.length > 0 ? null : draft, errors }
  })
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/csv.ts src/lib/csv.test.ts
git commit -m "lib/csv: export e import validado de leads com papaparse (TDD)"
```

---

### Task 8: Services Supabase

**Files:**
- Create: `src/lib/db.ts`, `src/services/leadService.ts`, `src/services/activityService.ts`, `src/services/followupService.ts`, `src/services/digitalCheckService.ts`, `src/services/settingsService.ts`

**Interfaces:**
- Consumes: cliente `supabase` (`src/lib/supabase.ts`), tipos da Task 3, `computeOpportunity` (Task 5), `onlyDigits` (Task 4).
- Produces (assinaturas exatas consumidas pelos Planos 2 e 3):
  - `db.ts`: `requireSupabase(): SupabaseClient` (lança `Error(NOT_CONFIGURED)` se null), `translateDbError(message: string): string`, `throwDbError(error: { message: string } | null): void` (no-op se null), `NOT_CONFIGURED: string`
  - `leadService`: `listLeads(filters: LeadFilters, sort: LeadSort, page: number, pageSize?: number): Promise<{ leads: Lead[]; total: number }>`, `getLead(id: string): Promise<Lead>`, `createLead(draft: LeadWrite): Promise<Lead>`, `updateLead(id: string, draft: LeadWrite): Promise<Lead>`, `deleteLead(id: string): Promise<void>`, `setLeadStatus(id: string, status: LeadStatus): Promise<Lead>`, `findDuplicateCandidates(input: { phone: string | null; whatsapp: string | null; cnpj: string | null; name: string; city: string | null }, excludeId?: string): Promise<Lead[]>`, `listRecentLeads(limit: number): Promise<Lead[]>`
  - `activityService`: `listActivities(leadId: string): Promise<Activity[]>`, `addActivity(leadId: string, type: ActivityType, description: string): Promise<Activity>`
  - `followupService`: `listFollowups(list: FollowupList): Promise<Followup[]>`, `listByLead(leadId: string): Promise<Followup[]>`, `createFollowup(leadId: string, dueAt: string, reason: string | null, note: string | null): Promise<Followup>`, `completeFollowup(id: string, result: string | null): Promise<void>`, `cancelFollowup(id: string): Promise<void>`, `countOverdue(): Promise<number>`, `syncNextContact(leadId: string): Promise<void>`
  - `digitalCheckService`: `listChecks(leadId: string): Promise<DigitalCheck[]>`, `setCheck(leadId: string, item: CheckItem, verified: boolean): Promise<void>`
  - `settingsService`: `getSettings(): Promise<UserSettings>`, `saveSettings(prices: ServicePrices, whatsappTemplate: string): Promise<UserSettings>`

Comportamento: `createLead`/`updateLead` normalizam strings vazias → null, recalculam `computeOpportunity(draft)` e gravam `score/priority/needs/score_reasons` junto. `setLeadStatus` busca o lead, atualiza status e grava atividade `mudanca_status` com `De "{label antigo}" para "{label novo}".`. `createFollowup`/`completeFollowup`/`cancelFollowup` chamam `syncNextContact(leadId)` (menor `due_at` pendente → `leads.next_contact_at`, ou null). `completeFollowup` também grava atividade `follow_up` ("Follow-up concluído" + resultado se houver). `setCheck` faz upsert por `(lead_id, item)` com `verified_at = now()` quando verified, e atualiza `leads.last_verified_at = now()`. `getSettings` retorna `DEFAULT_SETTINGS` com owner_id quando não há linha (sem inserir). `listFollowups`: today = pendente e due entre início e fim do dia local; upcoming = pendente e due > fim de hoje; overdue = pendente e due < agora; done = concluido (ordenado por completed_at desc); all = todos. Filtros de `listLeads` aplicam todos os campos de `LeadFilters` (search → `ilike` em name; situation → `in` statuses + minScore 40 quando `pronto_contato`; need → `contains` needs; instagramWithoutSite → has_instagram=yes e has_website=no; noSiteNoMenu → ambos no; hasNeeds → `not('needs', 'eq', '{}')` via `neq` — usar `.not('needs', 'eq', '{}')` não funciona para array; usar `.neq('needs', '{}')`? **usar `.filter('needs', 'neq', '{}')`** — PostgREST aceita `needs=neq.{}` para arrays; validar no teste de integração e, se falhar, alternativa: `.not('needs', 'eq', '{}')` também é aceito pelo supabase-js para arrays. Escolher `.not('needs', 'eq', '{}')` e confirmar no navegador na Task 10/Plano 3).

- [ ] **Step 1: Criar `src/lib/db.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

export const NOT_CONFIGURED =
  'Supabase não configurado. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local.'

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error(NOT_CONFIGURED)
  return supabase
}

export function translateDbError(message: string): string {
  if (message.includes('permission denied')) return 'Sem permissão no banco. Verifique se a migration foi executada (grants/RLS).'
  if (message.includes('Failed to fetch') || message.includes('fetch')) return 'Falha de conexão com o Supabase. Verifique sua internet.'
  if (message.includes('duplicate key')) return 'Registro duplicado.'
  if (message.includes('row-level security')) return 'Acesso negado pelas regras de segurança (RLS).'
  return 'Não foi possível concluir a operação. Tente novamente.'
}

export function throwDbError(error: { message: string } | null): void {
  if (error) throw new Error(translateDbError(error.message))
}
```

- [ ] **Step 2: Criar `src/services/leadService.ts`**

```ts
import { requireSupabase, throwDbError } from '../lib/db'
import { computeOpportunity } from '../lib/opportunity'
import { onlyDigits } from '../lib/format'
import {
  situationStatuses,
  STATUS_LABELS,
  type Lead,
  type LeadFilters,
  type LeadSort,
  type LeadStatus,
  type LeadWrite,
} from '../types/lead'
import { addActivity } from './activityService'

function normalizeDraft(draft: LeadWrite): LeadWrite {
  const cleaned = { ...draft }
  for (const key of Object.keys(cleaned) as Array<keyof LeadWrite>) {
    const value = cleaned[key]
    if (typeof value === 'string' && value.trim() === '' && key !== 'name') {
      (cleaned as Record<string, unknown>)[key] = null
    }
  }
  cleaned.name = cleaned.name.trim()
  return cleaned
}

function withOpportunity(draft: LeadWrite) {
  const normalized = normalizeDraft(draft)
  const { score, priority, needs, reasons } = computeOpportunity(normalized)
  return { ...normalized, score, priority, needs, score_reasons: reasons }
}

const SORTS: Record<LeadSort, { column: string; ascending: boolean }> = {
  created_desc: { column: 'created_at', ascending: false },
  created_asc: { column: 'created_at', ascending: true },
  score_desc: { column: 'score', ascending: false },
  score_asc: { column: 'score', ascending: true },
}

export async function listLeads(
  filters: LeadFilters,
  sort: LeadSort,
  page: number,
  pageSize = 20,
): Promise<{ leads: Lead[]; total: number }> {
  const client = requireSupabase()
  let query = client.from('leads').select('*', { count: 'exact' })

  if (filters.search) query = query.ilike('name', `%${filters.search}%`)
  if (filters.niche) query = query.eq('niche', filters.niche)
  if (filters.city) query = query.ilike('city', filters.city)
  if (filters.district) query = query.ilike('district', filters.district)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.presenceField && filters.presenceValue) {
    query = query.eq(filters.presenceField, filters.presenceValue)
  }
  if (filters.createdFrom) query = query.gte('created_at', filters.createdFrom)
  if (filters.createdTo) query = query.lte('created_at', `${filters.createdTo}T23:59:59`)
  if (filters.minScore !== undefined) query = query.gte('score', filters.minScore)
  if (filters.maxScore !== undefined) query = query.lte('score', filters.maxScore)
  if (filters.need) query = query.contains('needs', [filters.need])
  if (filters.instagramWithoutSite) query = query.eq('has_instagram', 'yes').eq('has_website', 'no')
  if (filters.noSiteNoMenu) query = query.eq('has_website', 'no').eq('has_digital_menu', 'no')
  if (filters.hasNeeds) query = query.not('needs', 'eq', '{}')
  if (filters.excludeStatuses?.length) query = query.not('status', 'in', `(${filters.excludeStatuses.join(',')})`)
  if (filters.situation) {
    query = query.in('status', situationStatuses(filters.situation))
    if (filters.situation === 'pronto_contato') query = query.gte('score', 40)
  }

  const { column, ascending } = SORTS[sort]
  const from = page * pageSize
  const { data, error, count } = await query
    .order(column, { ascending })
    .range(from, from + pageSize - 1)
  throwDbError(error)
  return { leads: (data ?? []) as Lead[], total: count ?? 0 }
}

export async function getLead(id: string): Promise<Lead> {
  const client = requireSupabase()
  const { data, error } = await client.from('leads').select('*').eq('id', id).single()
  throwDbError(error)
  return data as Lead
}

export async function createLead(draft: LeadWrite): Promise<Lead> {
  const client = requireSupabase()
  const { data, error } = await client.from('leads').insert(withOpportunity(draft)).select().single()
  throwDbError(error)
  return data as Lead
}

export async function updateLead(id: string, draft: LeadWrite): Promise<Lead> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('leads')
    .update(withOpportunity(draft))
    .eq('id', id)
    .select()
    .single()
  throwDbError(error)
  return data as Lead
}

export async function deleteLead(id: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('leads').delete().eq('id', id)
  throwDbError(error)
}

export async function setLeadStatus(id: string, status: LeadStatus): Promise<Lead> {
  const client = requireSupabase()
  const current = await getLead(id)
  if (current.status === status) return current
  const { data, error } = await client.from('leads').update({ status }).eq('id', id).select().single()
  throwDbError(error)
  await addActivity(id, 'mudanca_status', `De "${STATUS_LABELS[current.status]}" para "${STATUS_LABELS[status]}".`)
  return data as Lead
}

export async function findDuplicateCandidates(
  input: { phone: string | null; whatsapp: string | null; cnpj: string | null; name: string; city: string | null },
  excludeId?: string,
): Promise<Lead[]> {
  const client = requireSupabase()
  const { data, error } = await client.from('leads').select('*')
  throwDbError(error)
  const leads = (data ?? []) as Lead[]
  const phone = onlyDigits(input.phone ?? '')
  const whatsapp = onlyDigits(input.whatsapp ?? '')
  const cnpj = onlyDigits(input.cnpj ?? '')
  const name = input.name.trim().toLowerCase()
  const city = (input.city ?? '').trim().toLowerCase()

  return leads.filter((lead) => {
    if (excludeId && lead.id === excludeId) return false
    if (phone && onlyDigits(lead.phone ?? '') === phone) return true
    if (whatsapp && onlyDigits(lead.whatsapp ?? '') === whatsapp) return true
    if (cnpj && onlyDigits(lead.cnpj ?? '') === cnpj) return true
    if (name && lead.name.trim().toLowerCase() === name && city && (lead.city ?? '').trim().toLowerCase() === city) return true
    return false
  })
}

export async function listRecentLeads(limit: number): Promise<Lead[]> {
  const client = requireSupabase()
  const { data, error } = await client.from('leads').select('*').order('created_at', { ascending: false }).limit(limit)
  throwDbError(error)
  return (data ?? []) as Lead[]
}
```

Nota de implementação: `findDuplicateCandidates` baixa todos os leads do usuário e compara em memória — aceitável no volume do plano free (centenas/milhares de registros); se o volume crescer, migrar para filtros OR no PostgREST. `normalizeDraft` NÃO converte `country` vazio para null? converte (key !== 'name' apenas protege name) — ok, padrão 'Brasil' vem do draft.

- [ ] **Step 3: Criar `src/services/activityService.ts`**

```ts
import { requireSupabase, throwDbError } from '../lib/db'
import type { Activity, ActivityType } from '../types/activity'

export async function listActivities(leadId: string): Promise<Activity[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('lead_activities')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
  throwDbError(error)
  return (data ?? []) as Activity[]
}

export async function addActivity(leadId: string, type: ActivityType, description: string): Promise<Activity> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('lead_activities')
    .insert({ lead_id: leadId, type, description })
    .select()
    .single()
  throwDbError(error)
  return data as Activity
}
```

- [ ] **Step 4: Criar `src/services/followupService.ts`**

```ts
import { requireSupabase, throwDbError } from '../lib/db'
import type { Followup, FollowupList } from '../types/followup'
import { addActivity } from './activityService'

function dayBounds() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString(), now: new Date().toISOString() }
}

export async function listFollowups(list: FollowupList): Promise<Followup[]> {
  const client = requireSupabase()
  const { start, end, now } = dayBounds()
  let query = client.from('lead_followups').select('*')
  if (list === 'today') query = query.eq('status', 'pendente').gte('due_at', start).lte('due_at', end)
  if (list === 'upcoming') query = query.eq('status', 'pendente').gt('due_at', end)
  if (list === 'overdue') query = query.eq('status', 'pendente').lt('due_at', now)
  if (list === 'done') query = query.eq('status', 'concluido')
  const orderColumn = list === 'done' ? 'completed_at' : 'due_at'
  const { data, error } = await query.order(orderColumn, { ascending: list !== 'done' })
  throwDbError(error)
  return (data ?? []) as Followup[]
}

export async function listByLead(leadId: string): Promise<Followup[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('lead_followups')
    .select('*')
    .eq('lead_id', leadId)
    .order('due_at', { ascending: true })
  throwDbError(error)
  return (data ?? []) as Followup[]
}

export async function createFollowup(
  leadId: string,
  dueAt: string,
  reason: string | null,
  note: string | null,
): Promise<Followup> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('lead_followups')
    .insert({ lead_id: leadId, due_at: dueAt, reason, note })
    .select()
    .single()
  throwDbError(error)
  await syncNextContact(leadId)
  return data as Followup
}

export async function completeFollowup(id: string, result: string | null): Promise<void> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('lead_followups')
    .update({ status: 'concluido', completed_at: new Date().toISOString(), result })
    .eq('id', id)
    .select()
    .single()
  throwDbError(error)
  const followup = data as Followup
  await addActivity(
    followup.lead_id,
    'follow_up',
    result ? `Follow-up concluído: ${result}` : 'Follow-up concluído.',
  )
  await syncNextContact(followup.lead_id)
}

export async function cancelFollowup(id: string): Promise<void> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('lead_followups')
    .update({ status: 'cancelado' })
    .eq('id', id)
    .select()
    .single()
  throwDbError(error)
  await syncNextContact((data as Followup).lead_id)
}

export async function countOverdue(): Promise<number> {
  const client = requireSupabase()
  const { count, error } = await client
    .from('lead_followups')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pendente')
    .lt('due_at', new Date().toISOString())
  throwDbError(error)
  return count ?? 0
}

export async function syncNextContact(leadId: string): Promise<void> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('lead_followups')
    .select('due_at')
    .eq('lead_id', leadId)
    .eq('status', 'pendente')
    .order('due_at', { ascending: true })
    .limit(1)
  throwDbError(error)
  const next = data?.[0]?.due_at ?? null
  const { error: updateError } = await client.from('leads').update({ next_contact_at: next }).eq('id', leadId)
  throwDbError(updateError)
}
```

- [ ] **Step 5: Criar `src/services/digitalCheckService.ts`**

```ts
import { requireSupabase, throwDbError } from '../lib/db'
import type { CheckItem, DigitalCheck } from '../types/check'

export async function listChecks(leadId: string): Promise<DigitalCheck[]> {
  const client = requireSupabase()
  const { data, error } = await client.from('lead_digital_checks').select('*').eq('lead_id', leadId)
  throwDbError(error)
  return (data ?? []) as DigitalCheck[]
}

export async function setCheck(leadId: string, item: CheckItem, verified: boolean): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('lead_digital_checks').upsert(
    {
      lead_id: leadId,
      item,
      verified,
      verified_at: verified ? new Date().toISOString() : null,
    },
    { onConflict: 'lead_id,item' },
  )
  throwDbError(error)
  if (verified) {
    const { error: leadError } = await client
      .from('leads')
      .update({ last_verified_at: new Date().toISOString() })
      .eq('id', leadId)
    throwDbError(leadError)
  }
}
```

- [ ] **Step 6: Criar `src/services/settingsService.ts`**

```ts
import { requireSupabase, throwDbError } from '../lib/db'
import { DEFAULT_SETTINGS, type ServicePrices, type UserSettings } from '../types/settings'

export async function getSettings(): Promise<UserSettings> {
  const client = requireSupabase()
  const { data: sessionData } = await client.auth.getUser()
  const ownerId = sessionData.user?.id ?? ''
  const { data, error } = await client.from('user_settings').select('*').maybeSingle()
  throwDbError(error)
  if (!data) return { owner_id: ownerId, ...DEFAULT_SETTINGS }
  return data as UserSettings
}

export async function saveSettings(prices: ServicePrices, whatsappTemplate: string): Promise<UserSettings> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('user_settings')
    .upsert({ service_prices: prices, whatsapp_template: whatsappTemplate }, { onConflict: 'owner_id' })
    .select()
    .single()
  throwDbError(error)
  return data as UserSettings
}
```

- [ ] **Step 7: Build + lint + testes**

Run: `npm run build && npm run lint && npm test`
Expected: build PASS; lint 0 erros; testes PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/db.ts src/services
git commit -m "Services Supabase: leads, atividades, follow-ups, checklist e settings"
```

---

### Task 9: Identidade visual (verde + Montserrat/Roboto)

**Files:**
- Modify: `src/index.css` (reescrever)
- Modify: `src/components/ui/Button.tsx` (variante primary → verde)
- Modify: `src/components/ui/Card.tsx` (título com font-display)

**Interfaces:**
- Produces: tokens Tailwind `--color-primary: #22c55e`, `--font-display`; classes `bg-primary`, `text-primary`, `font-display` disponíveis em todo o app. Acentos accent/lime/pink/mint/danger inalterados.

- [ ] **Step 1: Reescrever `src/index.css`**

```css
@import "tailwindcss";
@import "@fontsource-variable/montserrat";
@import "@fontsource/roboto/400.css";
@import "@fontsource/roboto/500.css";
@import "@fontsource/roboto/700.css";

@theme {
  --font-sans: "Roboto", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Montserrat Variable", ui-sans-serif, system-ui, sans-serif;

  --color-bg: #0d0d0d;
  --color-surface: #161616;
  --color-elevated: #1e1e1e;
  --color-line: #2a2a2a;
  --color-ink: #ffffff;
  --color-muted: #a3a3a3;

  --color-primary: #22c55e;
  --color-accent: #6db5ff;
  --color-lime: #fefa3d;
  --color-pink: #ff5de7;
  --color-mint: #4ade80;
  --color-danger: #f87171;
}

body {
  @apply bg-bg font-sans text-ink antialiased;
}

h1, h2, h3 {
  @apply font-display;
}

.dot-grid {
  background-image: radial-gradient(circle, #242424 1px, transparent 1px);
  background-size: 24px 24px;
}
```

- [ ] **Step 2: Button primary verde**

Em `src/components/ui/Button.tsx`, trocar a variante:
```ts
primary: 'bg-primary text-bg hover:bg-primary/85',
```
(manter mint/ghost/outline como estão).

- [ ] **Step 3: Card título com font-display**

Em `src/components/ui/Card.tsx`, trocar `<h2 className="text-sm font-medium text-ink">` por `<h2 className="font-display text-sm font-semibold text-ink">`.

- [ ] **Step 4: Verificar no navegador**

Dev server rodando; abrir `/login` e `/` (logado): fontes Montserrat (títulos) e Roboto (texto), botão primário verde, acentos preservados. Verificar console sem erros.

- [ ] **Step 5: Build + lint**

Run: `npm run build && npm run lint`
Expected: PASS, 0 erros.

- [ ] **Step 6: Commit**

```bash
git add src/index.css src/components/ui/Button.tsx src/components/ui/Card.tsx
git commit -m "Identidade Etapa 2: verde principal, Montserrat titulos, Roboto texto"
```

---

### Task 10: Kit de UI (Toast, Modal, ConfirmDialog, Skeleton, EmptyState, badges, Select, Textarea)

**Files:**
- Create: `src/components/ui/Toast.tsx`, `src/hooks/useToast.ts`, `src/components/ui/Modal.tsx`, `src/components/ui/ConfirmDialog.tsx`, `src/components/ui/Skeleton.tsx`, `src/components/ui/EmptyState.tsx`, `src/components/ui/ScoreBar.tsx`, `src/components/ui/PriorityBadge.tsx`, `src/components/ui/PresenceBadge.tsx`, `src/components/ui/StatusBadge.tsx`, `src/components/ui/Select.tsx`, `src/components/ui/Textarea.tsx`
- Modify: `src/main.tsx` (envolver com ToastProvider)

**Interfaces:**
- Produces:
  - `ToastProvider` (componente) + `useToast(): { toast: (message: string, kind?: 'success' | 'error' | 'info') => void }`
  - `Modal { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }`
  - `ConfirmDialog { open: boolean; title: string; description: string; confirmLabel?: string; loading?: boolean; onConfirm: () => void; onCancel: () => void }` (botão confirmar danger)
  - `Skeleton { className?: string }`
  - `EmptyState { icon: LucideIcon; title: string; description: string; action?: ReactNode }`
  - `ScoreBar { score: number; showLabel?: boolean }` (barra 0–100 colorida por prioridade)
  - `PriorityBadge { priority: Priority }`, `PresenceBadge { value: Presence }`, `StatusBadge { status: LeadStatus }`
  - `Select { label: string; error?: string; options: Array<{ value: string; label: string }>; placeholder?: string } & SelectHTMLAttributes`, `Textarea { label: string; error?: string } & TextareaHTMLAttributes`

- [ ] **Step 1: Criar `src/components/ui/Toast.tsx`**

```tsx
import { createContext, useCallback, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '../../utils/cn'

export type ToastKind = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  kind: ToastKind
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 1

const icons: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
}

const styles: Record<ToastKind, string> = {
  success: 'border-primary/40 text-primary',
  error: 'border-danger/40 text-danger',
  info: 'border-accent/40 text-accent',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = nextId++
    setItems((current) => [...current, { id, message, kind }])
    setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id))
    }, 4000)
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        {items.map((item) => {
          const Icon = icons[item.kind]
          return (
            <div
              key={item.id}
              role="status"
              className={cn(
                'pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-elevated p-3.5 text-sm text-ink shadow-lg shadow-black/40',
                styles[item.kind],
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="text-ink">{item.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
```

- [ ] **Step 2: Criar `src/hooks/useToast.ts`**

```ts
import { useContext } from 'react'
import { ToastContext } from '../components/ui/Toast'

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast deve ser usado dentro de ToastProvider.')
  return context
}
```

- [ ] **Step 3: Envolver a árvore em `src/main.tsx`**

Adicionar import `{ ToastProvider } from './components/ui/Toast'` e envolver `<AppRoutes />` (dentro de AuthProvider): `<AuthProvider><ToastProvider><AppRoutes /></ToastProvider></AuthProvider>` (manter StrictMode/ErrorBoundary/BrowserRouter existentes).

- [ ] **Step 4: Criar `src/components/ui/Modal.tsx`**

```tsx
import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../utils/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}

export function Modal({ open, onClose, title, children, wide = false }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 sm:rounded-2xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-muted transition-colors hover:bg-elevated hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Criar `src/components/ui/ConfirmDialog.tsx`**

```tsx
import { Button } from './Button'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open, title, description, confirmLabel = 'Confirmar', loading = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-muted">{description}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
        <Button className="bg-danger text-bg hover:bg-danger/85" onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 6: Criar `src/components/ui/Skeleton.tsx` e `src/components/ui/EmptyState.tsx`**

```tsx
// Skeleton.tsx
import { cn } from '../../utils/cn'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-elevated', className)} aria-hidden="true" />
}
```

```tsx
// EmptyState.tsx
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-surface/50 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-elevated">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
      <p className="max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
```

- [ ] **Step 7: Criar badges e ScoreBar**

```tsx
// PriorityBadge.tsx
import { PRIORITY_LABELS, type Priority } from '../../types/lead'
import { cn } from '../../utils/cn'

const styles: Record<Priority, string> = {
  muito_alta: 'bg-pink/15 text-pink',
  alta: 'bg-lime/15 text-lime',
  media: 'bg-accent/15 text-accent',
  baixa: 'bg-muted/15 text-muted',
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', styles[priority])}>
      {PRIORITY_LABELS[priority]}
    </span>
  )
}
```

```tsx
// PresenceBadge.tsx
import { PRESENCE_LABELS, type Presence } from '../../types/lead'
import { cn } from '../../utils/cn'

const styles: Record<Presence, string> = {
  yes: 'bg-mint/15 text-mint',
  no: 'bg-danger/15 text-danger',
  unverified: 'bg-muted/15 text-muted',
}

export function PresenceBadge({ value }: { value: Presence }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', styles[value])}>
      {PRESENCE_LABELS[value]}
    </span>
  )
}
```

```tsx
// StatusBadge.tsx
import { STATUS_LABELS, type LeadStatus } from '../../types/lead'
import { cn } from '../../utils/cn'

const styles: Record<LeadStatus, string> = {
  novo: 'bg-accent/15 text-accent',
  contato_realizado: 'bg-accent/15 text-accent',
  aguardando_resposta: 'bg-lime/15 text-lime',
  pediu_informacoes: 'bg-lime/15 text-lime',
  interessado: 'bg-primary/15 text-primary',
  negociando: 'bg-primary/15 text-primary',
  aceitou: 'bg-mint/15 text-mint',
  ignorou: 'bg-muted/15 text-muted',
  nao_interessado: 'bg-danger/15 text-danger',
  follow_up: 'bg-pink/15 text-pink',
  perdido: 'bg-danger/15 text-danger',
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', styles[status])}>
      {STATUS_LABELS[status]}
    </span>
  )
}
```

```tsx
// ScoreBar.tsx
import { priorityFromScore } from '../../lib/opportunity'
import { cn } from '../../utils/cn'

const barColors = {
  muito_alta: 'bg-pink',
  alta: 'bg-lime',
  media: 'bg-accent',
  baixa: 'bg-muted',
} as const

export function ScoreBar({ score, showLabel = true }: { score: number; showLabel?: boolean }) {
  const priority = priorityFromScore(score)
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-elevated">
        <div className={cn('h-full rounded-full transition-all', barColors[priority])} style={{ width: `${score}%` }} />
      </div>
      {showLabel && <span className="w-8 shrink-0 text-right text-xs font-medium text-muted">{score}</span>}
    </div>
  )
}
```

- [ ] **Step 8: Criar `src/components/ui/Select.tsx` e `src/components/ui/Textarea.tsx`**

```tsx
// Select.tsx
import { useId, type SelectHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  options: Array<{ value: string; label: string }>
  placeholder?: string
}

export function Select({ label, error, options, placeholder, className, id, ...props }: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-medium text-muted">{label}</label>
      <select
        id={selectId}
        className={cn(
          'h-11 rounded-xl border border-line bg-elevated px-3.5 text-sm text-ink',
          'focus:border-primary focus:outline-none',
          error && 'border-danger',
          className,
        )}
        aria-invalid={error ? true : undefined}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
```

```tsx
// Textarea.tsx
import { useId, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  const generatedId = useId()
  const textareaId = id ?? generatedId
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={textareaId} className="text-sm font-medium text-muted">{label}</label>
      <textarea
        id={textareaId}
        className={cn(
          'min-h-24 rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/60',
          'focus:border-primary focus:outline-none',
          error && 'border-danger',
          className,
        )}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 9: Build + lint + navegador**

Run: `npm run build && npm run lint && npm test`
Expected: PASS. No navegador: login funciona, toast aparece ao sair/entrar? (toast ainda não é chamado por nenhuma página — verificar apenas que a árvore renderiza sem erro de provider e console limpo).

- [ ] **Step 10: Commit**

```bash
git add src/components/ui src/hooks/useToast.ts src/main.tsx
git commit -m "Kit UI Etapa 2: toast, modal, confirmacao, skeleton, empty state, badges, select, textarea"
```

---

### Task 11: Sidebar completa + drawer mobile

**Files:**
- Modify: `src/layouts/AppLayout.tsx` (reescrever)

**Interfaces:**
- Consumes: `useAuth`, `Logo`, `cn`.
- Produces: layout com sidebar de 9 itens (Dashboard ativo; demais bloqueados com cadeado + etiqueta de etapa até os Planos 2/3 ativarem), drawer mobile com botão hambúrguer no topbar, mesmo `<Outlet />`. Os Planos 2/3 vão trocar itens bloqueados por `NavLink` conforme as páginas nascerem — manter o array `navItems` como ponto único de edição.

- [ ] **Step 1: Reescrever `src/layouts/AppLayout.tsx`**

```tsx
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  BarChart3, FolderKanban, LayoutDashboard, Lock, LogOut, Menu,
  Settings, Target, Users, Wallet, X, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { Logo } from '../components/ui/Logo'
import { cn } from '../utils/cn'

interface NavItem {
  label: string
  icon: LucideIcon
  to?: string
  stage?: string
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { label: 'Leads', icon: Users, stage: 'Etapa 2' },
  { label: 'Oportunidades', icon: Target, stage: 'Etapa 2' },
  { label: 'Pipeline', icon: FolderKanban, stage: 'Etapa 2' },
  { label: 'Clientes', icon: Users, stage: 'Etapa 3' },
  { label: 'Projetos', icon: FolderKanban, stage: 'Etapa 3' },
  { label: 'Financeiro', icon: Wallet, stage: 'Etapa 4' },
  { label: 'Relatórios', icon: BarChart3, stage: 'Etapa 4' },
  { label: 'Configurações', icon: Settings, stage: 'Etapa 2' },
]

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map(({ label, icon: Icon, to, stage }) =>
        to ? (
          <NavLink
            key={label}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                isActive ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-elevated hover:text-ink',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ) : (
          <span
            key={label}
            className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted/50"
            title={`Disponível na ${stage}`}
          >
            <Icon className="h-4 w-4" />
            {label}
            <Lock className="ml-auto h-3.5 w-3.5" />
          </span>
        ),
      )}
    </nav>
  )
}

export function AppLayout() {
  const { user, signOut } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface p-4 lg:flex">
        <Logo className="mb-8 px-2 text-ink" />
        <NavContent />
        <div className="mt-auto rounded-xl border border-line bg-elevated p-3 text-xs text-muted">
          Etapa 2 em andamento — leads, oportunidades e pipeline.
        </div>
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-line bg-surface p-4">
            <div className="mb-6 flex items-center justify-between">
              <Logo className="text-ink" />
              <button onClick={() => setDrawerOpen(false)} aria-label="Fechar menu" className="rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
            <NavContent onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-line bg-surface px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setDrawerOpen(true)} aria-label="Abrir menu" className="rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-ink lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <Logo className="text-ink lg:hidden" />
            <span className="hidden text-sm text-muted lg:block">CRM de prospecção comercial</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-48 truncate text-sm text-muted sm:block">{user?.email}</span>
            <button
              onClick={() => void signOut()}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-elevated px-3 text-sm text-ink transition-colors hover:bg-line"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </header>
        <main className="dot-grid flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar no navegador (desktop + mobile)**

Desktop (≥1024px): sidebar fixa com 9 itens, Dashboard ativo em verde, demais com cadeado. Mobile (375px): sidebar some, hambúrguer abre drawer, clicar fora fecha, navegar fecha. Console limpo.

- [ ] **Step 3: Build + lint**

Run: `npm run build && npm run lint`
Expected: PASS, 0 erros.

- [ ] **Step 4: Commit + push**

```bash
git add src/layouts/AppLayout.tsx
git commit -m "Sidebar completa da Etapa 2 com drawer mobile"
git push origin main
```

---

## Verificação final do Plano 1

- [ ] `npm run build && npm run lint && npm test` — tudo PASS
- [ ] Usuário executou a migration 0002 e confirmou
- [ ] Navegador: login real → dashboard com novo visual; sidebar/drawer OK; /status continua funcionando
- [ ] Integração smoke (após migration): no navegador logado, console do devtools → criar lead via service não é possível sem UI; validar tabelas via REST com token do usuário logado (Application → Local Storage → sessão) ou aguardar Plano 2. **Mínimo obrigatório:** `select` em `leads` retorna `[]` sem erro de permissão (usuário logado, via página /status não cobre leads — usar fetch no console do navegador com a sessão atual). Se retornar 42501, migration não foi executada corretamente → pedir ao usuário.