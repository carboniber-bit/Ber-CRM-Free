# Clientes e Conversão de Leads — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o módulo de Clientes e a conversão explícita, transacional e idempotente de leads, incluindo a logo Carboni, sem alterar o significado dos módulos da Etapa 2.

**Architecture:** A migration `0006` cria a fundação relacional com RLS e escrita assistida por RPC. O frontend usa dinheiro em centavos, serviços Supabase com normalização na fronteira e telas que preservam os padrões de loading, erro, refresh e bloqueio de duplo clique já existentes.

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind CSS v4, React Router v7, Supabase Free/PostgreSQL, Vitest 5, Testing Library, Lucide.

**Spec:** `docs/superpowers/specs/2026-11-25-etapa3-design.md`

## Global Constraints

- “ATENÇÃO: NÃO RECRIE O PROJETO.”
- Stack mantida: React 19, TypeScript, Vite 8, Tailwind CSS v4, React Router v7, Supabase Free, Recharts, `@dnd-kit`, Lucide.
- Interface em pt-BR, dark mode grafite, verde principal, Montserrat/Roboto e acentos azul/lime/rosa.
- Somente ferramentas gratuitas e free tiers; nenhuma cobrança, trial, upgrade, API paga ou automação de mensagens.
- Credenciais reais somente em `.env.local`; `.env.example` permanece sem credenciais. Nunca usar `service_role` no frontend.
- Nenhuma tabela privada sem RLS; cada usuário acessa somente os próprios registros.
- Nenhum número fictício apresentado como dado real.
- Valores estimados, negociados, contratados, recebidos e pendentes permanecem semanticamente separados.
- Registros com dependências são arquivados/cancelados, não excluídos definitivamente.
- Dinheiro no frontend usa centavos inteiros; PostgreSQL usa `numeric(14,2)`.
- Todas as RPCs de cliente adquirem a advisory `:clients` antes de qualquer `FOR UPDATE`; depois bloqueiam lead/vínculo/cliente/contrato na ordem usada pela RPC. Nunca segurar uma linha para esperar essa advisory.
- TDD RED/GREEN em cada comportamento novo; commits pequenos e frequentes.
- Não afirmar que migration, RLS entre dois usuários ou validação autenticada foi executada sem evidência real.
- A Etapa 4 não começa sem autorização explícita.

## Test Conventions

- Todo arquivo `.test.tsx` começa com `// @vitest-environment jsdom`; o ambiente global é `node` e não há matchers jest-dom instalados.
- Todo teste de componente importa `cleanup` de `@testing-library/react` e executa `afterEach(cleanup)`.
- Asserções DOM usam propriedades nativas (`getAttribute`, `hasAttribute`, `textContent`, `(element as HTMLInputElement).disabled`), nunca `toBeInTheDocument`, `toBeDisabled` ou `toHaveAttribute`.
- Mocks que capturam variáveis externas usam `vi.hoisted`; mocks parciais preservam o módulo real com `importOriginal`.
- Componentes que usam `useToast` são envolvidos em `ToastContext.Provider` ou têm o hook explicitamente mockado; provedores reais não são substituídos silenciosamente.

## File Structure

| File | Responsabilidade |
| ---- | ---------------- |
| `public/images/logo-carboni.png` | Asset fornecido pelo usuário, servido localmente. |
| `src/components/ui/Logo.tsx` | Marca Carboni + nome Ber CRM. |
| `src/types/client.ts` | Cliente, contrato, projeto básico, conversão e histórico. |
| `src/types/project.ts` | Contrato base de projeto compartilhado com o Plano 2. |
| `src/types/contract.ts` | Contrato base compartilhado com o Plano 3. |
| `src/lib/money.ts` | Conversão e soma de dinheiro em centavos. |
| `src/lib/url.ts` | Validação e normalização de URLs compartilhadas por lead e cliente. |
| `supabase/migrations/0006_etapa3_clients.sql` | Schema fundacional, RLS e RPCs de cliente/conversão. |
| `supabase/tests/etapa3_clients.sql` | Contratos SQL de idempotência, rollback e isolamento. |
| `src/services/clientService.ts` | Fronteira Supabase do módulo de clientes. |
| `src/components/leads/ConversionDialog.tsx` | Conversão explícita de lead. |
| `src/components/clients/ClientForm.tsx` | Cadastro/edição de cliente e contrato inicial. |
| `src/components/clients/ClientHistory.tsx` | Timeline combinada sem copiar eventos. |
| `src/pages/ClientsPage.tsx` | Busca, filtros, ordenação e paginação. |
| `src/pages/ClientNewPage.tsx` | Criação manual. |
| `src/pages/ClientDetailPage.tsx` | Visão geral, projetos, contratos e histórico. |

---

### Task 1: Integrar a logo Carboni e remover rodapés obsoletos

**Files:**
- Create: `public/images/logo-carboni.png`
- Create: `src/components/ui/Logo.test.tsx`
- Create: `src/layouts/AuthLayout.test.tsx`
- Modify: `src/components/ui/Logo.tsx`
- Modify: `src/layouts/AuthLayout.tsx`
- Modify: `src/layouts/AppLayout.tsx`
- Modify: `src/layouts/AppLayout.test.tsx`

**Interfaces:**
- Consumes: asset em `C:\Users\berna\.qoder\tmp\C--Users-berna-Documents-Qoder-2026-11-22-56ca893f\images\56ca893f-f607-4c16-9fb5-6afe7b5bb532\ef395d07-202e-49b6-b121-293aaa4c05ff.png`.
- Produces: `Logo({ className?: string })` com imagem acessível e texto “Ber CRM”.

- [ ] **Step 1: Write the failing tests**

```tsx
// @vitest-environment jsdom
// src/components/ui/Logo.test.tsx
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Logo } from './Logo'

afterEach(cleanup)

describe('Logo', () => {
  it('exibe a marca Carboni e mantém o nome do CRM', () => {
    render(<Logo />)
    expect(screen.getByRole('img', { name: 'Carboni' }).getAttribute('src')).toBe('/images/logo-carboni.png')
    expect(screen.getByText('Ber CRM').textContent).toBe('Ber CRM')
  })
})
```

```tsx
// @vitest-environment jsdom
// src/layouts/AuthLayout.test.tsx
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthLayout } from './AuthLayout'

afterEach(cleanup)

describe('AuthLayout', () => {
  it('exibe a marca e um rodapé que não afirma uma etapa concluída', () => {
    render(<MemoryRouter><AuthLayout /></MemoryRouter>)
    expect(screen.getByRole('img', { name: 'Carboni' })).toBeTruthy()
    expect(screen.getByText('CRM de prospecção comercial · Carboni Digital Business').textContent)
      .toBe('CRM de prospecção comercial · Carboni Digital Business')
    expect(screen.queryByText(/Etapa 1 — Fundação/)).toBeNull()
  })
})
```

In `src/layouts/AppLayout.test.tsx`, replace only the final footer assertion inside `exibe os nove links navegáveis na ordem e mantém Follow-ups apenas no sino` with this exact line:

```tsx
expect(screen.getByText('Etapa 3 — clientes, projetos e financeiro.')).toBeTruthy()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/ui/Logo.test.tsx src/layouts/AuthLayout.test.tsx src/layouts/AppLayout.test.tsx`
Expected: FAIL because the Carboni image/accessible name and both new footers do not exist yet. The three test files must reach their assertions and fail for those reasons, not for setup or syntax errors.

- [ ] **Step 3: Copy the provided asset and implement the logo**

```bash
mkdir -p public/images
cp "/c/Users/berna/.qoder/tmp/C--Users-berna-Documents-Qoder-2026-11-22-56ca893f/images/56ca893f-f607-4c16-9fb5-6afe7b5bb532/ef395d07-202e-49b6-b121-293aaa4c05ff.png" public/images/logo-carboni.png
```

```tsx
// src/components/ui/Logo.tsx
import { cn } from '../../utils/cn'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img
        src="/images/logo-carboni.png"
        alt="Carboni"
        className="h-9 w-9 shrink-0 rounded-lg object-cover"
      />
      <span className="text-lg font-semibold tracking-tight">Ber CRM</span>
    </span>
  )
}
```

Replace the AuthLayout footer with:

```tsx
<p className="mt-8 text-xs text-muted/60">CRM de prospecção comercial · Carboni Digital Business</p>
```

Replace the AppLayout footer with:

```tsx
<p className="px-3 text-[11px] leading-relaxed text-muted/60">Etapa 3 — clientes, projetos e financeiro.</p>
```

- [ ] **Step 4: Run tests and inspect both layouts**

Run: `npm test -- src/components/ui/Logo.test.tsx src/layouts/AuthLayout.test.tsx src/layouts/AppLayout.test.tsx`
Expected: PASS. Start `npm run dev` and verify `/login` and the authenticated sidebar at 375 px and 1280 px; the image must not distort or overflow.

- [ ] **Step 5: Commit**

```bash
git add public/images/logo-carboni.png src/components/ui/Logo.tsx src/components/ui/Logo.test.tsx src/layouts/AuthLayout.tsx src/layouts/AuthLayout.test.tsx src/layouts/AppLayout.tsx src/layouts/AppLayout.test.tsx
git commit -m "feat: integrar marca Carboni ao CRM"
```

---

### Task 2: Criar tipos de cliente/projeto/contrato e biblioteca de dinheiro

**Files:**
- Create: `src/types/client.ts`
- Create: `src/types/contract.ts`
- Create: `src/types/project.ts`
- Create: `src/lib/money.ts`
- Create: `src/lib/money.test.ts`
- Create: `src/lib/url.ts`
- Create: `src/lib/url.test.ts`
- Modify: `src/lib/leadForm.ts`

**Interfaces:**
- Produces: `ClientStatus`, `ClientWrite`, `Client`, `InitialContractInput`, `CreateClientInput`, `UpdateClientInput`, `ConversionInput`, `ConversionResult`, `ClientDetail`, `ClientHistoryEntry`.
- Produces: `Contract`, `Project`, `ProjectStatus`, `ProjectPriority`.
- Produces: `parseMoneyInput`, `fromMoneyDecimal`, `toMoneyDecimal`, `formatMoney`, `sumMoney`, `MAX_MONEY_CENTS`.

- [ ] **Step 1: Write the failing money tests**

```ts
// src/lib/money.test.ts
import { describe, expect, it } from 'vitest'
import {
  fromMoneyDecimal,
  MAX_MONEY_CENTS,
  parseMoneyInput,
  sumMoney,
  toMoneyDecimal,
} from './money'

describe('money', () => {
  it('converte entrada pt-BR e decimal do banco para centavos', () => {
    expect(parseMoneyInput('1.234,56')).toBe(123456)
    expect(parseMoneyInput('1.234')).toBe(123400)
    expect(parseMoneyInput('1,234.56')).toBe(123456)
    expect(parseMoneyInput('1234.56')).toBe(123456)
    expect(parseMoneyInput('12')).toBe(1200)
    expect(fromMoneyDecimal('1234.56')).toBe(123456)
    expect(fromMoneyDecimal(null)).toBe(0)
  })

  it('rejeita vazio, negativo, três casas e estouro numérico', () => {
    expect(parseMoneyInput('')).toBeNull()
    expect(parseMoneyInput('-1,00')).toBeNull()
    expect(parseMoneyInput('1,234')).toBeNull()
    expect(parseMoneyInput('999999999999999,99')).toBeNull()
  })

  it('não transforma valor inválido do banco em zero', () => {
    expect(() => fromMoneyDecimal('abc')).toThrow('Valor monetário inválido recebido do banco.')
    expect(() => fromMoneyDecimal('-1.00')).toThrow('Valor monetário inválido recebido do banco.')
    expect(() => fromMoneyDecimal('1000000000000.00')).toThrow('Valor monetário inválido recebido do banco.')
    expect(() => toMoneyDecimal(-1)).toThrow('Valor monetário inválido.')
    expect(() => toMoneyDecimal(Number.NaN)).toThrow('Valor monetário inválido.')
  })

  it('serializa e soma sem ponto flutuante', () => {
    expect(toMoneyDecimal(123456)).toBe('1234.56')
    expect(sumMoney(100, 200, 300)).toBe(600)
    expect(sumMoney(1, 1, 1)).toBe(3)
    expect(Number.isSafeInteger(MAX_MONEY_CENTS)).toBe(true)
    expect(() => sumMoney(Number.MAX_SAFE_INTEGER, 1)).toThrow('Soma monetária fora do limite seguro.')
    expect(() => sumMoney(Number.MAX_SAFE_INTEGER, 1, -1)).toThrow('Soma monetária fora do limite seguro.')
  })
})
```

```ts
// src/lib/url.test.ts
import { describe, expect, it } from 'vitest'
import { normalizeClientUrl } from './url'

describe('normalizeClientUrl', () => {
  it('normaliza domínio e preserva vazio como string', () => {
    expect(normalizeClientUrl('exemplo.com')).toBe('https://exemplo.com')
    expect(normalizeClientUrl('')).toBe('')
    expect(normalizeClientUrl(null)).toBe('')
  })
  it('rejeita esquema inseguro e URL inválida', () => {
    expect(normalizeClientUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeClientUrl('https://')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/money.test.ts src/lib/url.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement types and money conversion**

```ts
// src/types/client.ts
import type { ActivityType } from './activity'
import type { Contract } from './contract'
import type { Project } from './project'

export const CLIENT_STATUSES = [
  'active', 'in_project', 'awaiting_payment', 'awaiting_approval',
  'project_completed', 'inactive',
] as const

export type ClientStatus = typeof CLIENT_STATUSES[number]

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: 'Ativo',
  in_project: 'Em projeto',
  awaiting_payment: 'Aguardando pagamento',
  awaiting_approval: 'Aguardando aprovação',
  project_completed: 'Projeto concluído',
  inactive: 'Inativo',
}

export interface ClientWrite {
  name: string
  responsible_name: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  cnpj: string | null
  website: string | null
  instagram: string | null
  address: string | null
  city: string | null
  district: string | null
  zip_code: string | null
  state: string | null
  niche: string | null
  notes: string | null
  status: ClientStatus
}

export interface Client extends ClientWrite {
  id: string
  owner_id: string
  creation_key: string
  cnpj_digits: string | null
  phone_canonical: string | null
  whatsapp_canonical: string | null
  source: string
  converted_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface InitialContractInput {
  service: string
  totalValueCents: number
  contractedAt: string
  dueDate: string | null
  paymentMethod: string
  paymentTerms: string
  notes: string
}

export interface CreateClientInput extends ClientWrite {
  creationKey: string
  initialContract: InitialContractInput
}

export interface UpdateClientInput extends ClientWrite {
  contractId: string
  initialContract: InitialContractInput
}

export interface ConversionInput {
  service: string
  contractedValueCents: number
  contractedAt: string
  paymentMethod: string
  paymentTerms: string
  notes: string
  project: {
    name: string
    startDate: string | null
    dueDate: string | null
  } | null
}

export interface ConversionResult {
  client_id: string
  link_id: string
  contract_id: string
  project_id: string | null
  already_existed: boolean
}

export interface LeadClientLink {
  id: string
  owner_id: string
  lead_id: string
  client_id: string
  converted_at: string
  created_at: string
}

export interface ClientActivity {
  id: string
  owner_id: string
  client_id: string
  project_id: string | null
  contract_id: string | null
  type: 'conversion' | 'contact' | 'meeting' | 'approval' | 'status_change' | 'delivery' | 'financial' | 'note'
  description: string
  metadata: Record<string, unknown>
  created_by: string | null
  created_at: string
}

export interface ClientHistoryEntry {
  id: string
  type: ActivityType | ClientActivity['type']
  description: string
  created_at: string
  source: 'client' | 'lead'
  leadName?: string
}

export interface ClientDetail {
  client: Client
  contracts: Contract[]
  projects: Project[]
  activities: ClientActivity[]
  linkedLeads: Array<{ leadId: string; leadName: string }>
  history: ClientHistoryEntry[]
}
```

```ts
// src/types/contract.ts
export type ContractStatus = 'active' | 'cancelled'

export interface Contract {
  id: string
  owner_id: string
  client_id: string
  source_link_id: string | null
  creation_key: string | null
  service: string
  total_value_cents: number
  contracted_at: string
  due_date: string | null
  payment_method: string | null
  payment_terms: string | null
  status: ContractStatus
  notes: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}
```

```ts
// src/types/project.ts
export const PROJECT_STATUSES = [
  'not_started', 'planning', 'in_development', 'awaiting_client_info',
  'in_review', 'awaiting_approval', 'changes_requested', 'completed',
  'delivered', 'cancelled',
] as const

export type ProjectStatus = typeof PROJECT_STATUSES[number]
export type ProjectPriority = 'very_high' | 'high' | 'medium' | 'low'

export interface Project {
  id: string
  owner_id: string
  client_id: string
  contract_id: string
  source_link_id: string | null
  name: string
  service: string
  contracted_value_cents: number
  description: string | null
  start_date: string | null
  due_date: string | null
  responsible_name: string | null
  priority: ProjectPriority
  status: ProjectStatus
  completed_at: string | null
  delivered_at: string | null
  delivery_confirmed_at: string | null
  delivery_url: string | null
  files_url: string | null
  final_notes: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}
```

```ts
// src/lib/url.ts
function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0)
    if (code !== undefined && (code <= 31 || (code >= 127 && code <= 159))) return true
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

export function normalizeUrl(raw: string): string | null {
  if (
    !raw
    || raw.startsWith('/')
    || raw.includes('\\')
    || /\s/.test(raw)
    || hasControlCharacter(raw)
    || /%(?![0-9a-f]{2})/i.test(raw)
  ) return null

  const isHttpUrl = /^https?:\/\//i.test(raw)
  if (/^https?:\/\/\//i.test(raw)) return null
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(raw)
  const isHostWithPort = /^[^/?#@:\\]+:\d+(?:[/?#]|$)/.test(raw)
  if (hasScheme && !isHttpUrl && !isHostWithPort) return null

  const candidate = isHttpUrl ? raw : `https://${raw}`
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname || url.username || url.password) return null
    if (!isValidHostname(url.hostname, !isHttpUrl)) return null
    return candidate
  } catch {
    return null
  }
}

export function normalizeClientUrl(raw: string | null): string | null {
  if (!raw?.trim()) return ''
  return normalizeUrl(raw)
}
```

Replace `src/lib/leadForm.ts` with this complete file so both forms share the same URL rules:

```ts
import type { LeadWrite } from '../types/lead'
import { onlyDigits } from './format'
import { normalizeUrl } from './url'

export type LeadDraftErrors = Partial<Record<keyof LeadWrite, string>>

const URL_FIELDS = ['website', 'menu_url', 'catalog_url', 'instagram', 'facebook'] as const
const VALUE_FIELDS = ['estimated_value', 'negotiated_value', 'contracted_value', 'received_value'] as const

export function validateLeadDraft(draft: LeadWrite): LeadDraftErrors {
  const errors: LeadDraftErrors = {}
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
    const value = draft[field]
    if (value && !normalizeUrl(value)) errors[field] = 'Informe uma URL válida (http://, https:// ou domínio).'
  }

  for (const field of VALUE_FIELDS) {
    if (!Number.isFinite(draft[field]) || draft[field] < 0) errors[field] = 'Valor inválido.'
  }

  return errors
}

export function normalizeLeadDraftForSave(draft: LeadWrite): LeadWrite {
  const normalized = { ...draft }
  for (const field of URL_FIELDS) {
    normalized[field] = normalizeUrl(draft[field] ?? '')
  }
  return normalized
}
```

```ts
// src/lib/money.ts
export type Cents = number
export const MAX_MONEY_CENTS = 99_999_999_999_999

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function parseMoneyInput(value: string): Cents | null {
  const input = value.trim()
  if (!input || input.startsWith('-')) return null

  let integerPart = ''
  let decimalPart = ''

  if (/^\d+,\d{1,2}$/.test(input)) {
    const [integer, decimal] = input.split(',')
    integerPart = integer
    decimalPart = decimal
  } else if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(input)) {
    const [integer, decimal = ''] = input.split(',')
    integerPart = integer.replace(/\./g, '')
    decimalPart = decimal
  } else if (/^\d+\.\d{1,2}$/.test(input)) {
    const [integer, decimal] = input.split('.')
    integerPart = integer
    decimalPart = decimal
  } else if (/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(input)) {
    const [integer, decimal] = input.split('.')
    integerPart = integer.replace(/,/g, '')
    decimalPart = decimal
  } else if (/^\d+$/.test(input)) {
    integerPart = input
  } else {
    return null
  }

  const cents = Number(integerPart) * 100 + Number(decimalPart.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents <= MAX_MONEY_CENTS ? cents : null
}

export function fromMoneyDecimal(value: string | number | null): Cents {
  if (value === null || value === '') return 0
  const input = String(value)
  if (!/^\d+(?:\.\d{1,2})?$/.test(input)) {
    throw new Error('Valor monetário inválido recebido do banco.')
  }
  const [integer, decimal = ''] = input.split('.')
  const cents = Number(integer) * 100 + Number(decimal.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents > MAX_MONEY_CENTS) {
    throw new Error('Valor monetário inválido recebido do banco.')
  }
  return cents
}

export function toMoneyDecimal(value: Cents): string {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_MONEY_CENTS) {
    throw new Error('Valor monetário inválido.')
  }
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`
}

export function formatMoney(value: Cents): string {
  if (!Number.isSafeInteger(value)) throw new Error('Valor monetário inválido.')
  return brl.format(value / 100)
}

export function sumMoney(...values: Cents[]): Cents {
  let total = 0
  for (const value of values) {
    if (!Number.isSafeInteger(value)) throw new Error('Soma monetária fora do limite seguro.')
    total += value
    if (!Number.isSafeInteger(total)) throw new Error('Soma monetária fora do limite seguro.')
  }
  return total
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- src/lib/money.test.ts src/lib/url.test.ts src/lib/leadForm.test.ts && npm run build`
Expected: PASS and build exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/types/client.ts src/types/contract.ts src/types/project.ts src/lib/money.ts src/lib/money.test.ts src/lib/url.ts src/lib/url.test.ts src/lib/leadForm.ts
git commit -m "feat: adicionar tipos e centavos da etapa 3"
```

---

### Task 3: Criar a migration fundacional 0006 com RLS

**Files:**
- Create: `supabase/migrations/0006_etapa3_clients.sql`

**Interfaces:**
- Produces: tables `clients`, `lead_client_links`, `contracts`, `projects`, `client_activities`.
- Produces: support constraints `leads(owner_id,id)`, `clients(owner_id,id)`, `lead_client_links(owner_id,id)`, `contracts(owner_id,id)`, `contracts(owner_id,client_id,id)`, `projects(owner_id,id)`, `projects(owner_id,client_id,id)`.
- Consumes: `public.canonical_phone(text)` and `public.set_updated_at()` from migrations 0001/0003.

- [ ] **Step 1: Write the complete migration**

```sql
-- supabase/migrations/0006_etapa3_clients.sql
begin;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.leads'::regclass and conname = 'leads_owner_id_id_key') then
    alter table public.leads add constraint leads_owner_id_id_key unique (owner_id, id);
  end if;
end
$$;

alter table public.leads
  alter column estimated_value type numeric(14,2) using estimated_value::numeric(14,2),
  alter column negotiated_value type numeric(14,2) using negotiated_value::numeric(14,2),
  alter column contracted_value type numeric(14,2) using contracted_value::numeric(14,2),
  alter column received_value type numeric(14,2) using received_value::numeric(14,2);

create or replace function public.guard_converted_lead_financials()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.lead_client_links where lead_id = old.id and owner_id = old.owner_id) then
    if new.contracted_value is distinct from old.contracted_value then
      raise exception 'CONVERTED_LEAD_CONTRACT_LOCKED' using errcode = '23514';
    end if;
    if new.received_value is distinct from old.received_value then
      raise exception 'CONVERTED_LEAD_RECEIVED_LOCKED' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

alter table public.lead_activities drop constraint if exists lead_activities_type_check;
alter table public.lead_activities add constraint lead_activities_type_check check (type in (
  'primeiro_contato','mensagem','ligacao','resposta','reuniao',
  'proposta','mudanca_status','observacao','follow_up','conversao','outro'
));

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  creation_key uuid not null unique,
  name text not null,
  responsible_name text,
  phone text,
  whatsapp text,
  email text,
  cnpj text,
  cnpj_digits text generated always as (
    nullif(pg_catalog.regexp_replace(cnpj, '[^0-9]', '', 'g'), '')
  ) stored,
  phone_canonical text generated always as (public.canonical_phone(phone)) stored,
  whatsapp_canonical text generated always as (public.canonical_phone(whatsapp)) stored,
  website text,
  instagram text,
  address text,
  city text,
  district text,
  zip_code text,
  state text,
  niche text,
  status text not null default 'active' check (status in (
    'active','in_project','awaiting_payment','awaiting_approval','project_completed','inactive'
  )),
  source text not null default 'manual',
  converted_at timestamptz,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_owner_id_id_key unique (owner_id, id)
);

create unique index clients_owner_cnpj_idx
  on public.clients (owner_id, cnpj_digits)
  where cnpj_digits is not null;
create index clients_owner_status_idx on public.clients (owner_id, status);
create index clients_owner_name_idx on public.clients (owner_id, name);
create index clients_owner_city_idx on public.clients (owner_id, city);
create index clients_phone_canonical_idx on public.clients (phone_canonical);
create index clients_whatsapp_canonical_idx on public.clients (whatsapp_canonical);
create index clients_created_idx on public.clients (owner_id, created_at desc);

create table public.lead_client_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lead_id uuid not null,
  client_id uuid not null,
  converted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint lead_client_links_lead_key unique (lead_id),
  constraint lead_client_links_owner_id_id_key unique (owner_id, id),
  constraint lead_client_links_lead_owner_fk foreign key (owner_id, lead_id)
    references public.leads (owner_id, id) on delete cascade,
  constraint lead_client_links_client_owner_fk foreign key (owner_id, client_id)
    references public.clients (owner_id, id) on delete restrict
);

create trigger leads_guard_converted_financials before update of contracted_value, received_value
  on public.leads for each row execute function public.guard_converted_lead_financials();
revoke all on function public.guard_converted_lead_financials() from public, anon;

create index lead_client_links_client_idx on public.lead_client_links (owner_id, client_id);
create index lead_client_links_created_idx on public.lead_client_links (owner_id, converted_at desc);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null,
  source_link_id uuid,
  creation_key uuid unique,
  service text not null,
  total_value numeric(14,2) not null default 0 check (total_value >= 0),
  contracted_at date not null,
  due_date date,
  payment_method text,
  payment_terms text,
  status text not null default 'active' check (status in ('active','cancelled')),
  notes text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contracts_owner_id_id_key unique (owner_id, id),
  constraint contracts_owner_client_id_key unique (owner_id, client_id, id),
  constraint contracts_source_link_key unique (source_link_id),
  constraint contracts_client_owner_fk foreign key (owner_id, client_id)
    references public.clients (owner_id, id) on delete restrict,
  constraint contracts_source_link_owner_fk foreign key (owner_id, source_link_id)
    references public.lead_client_links (owner_id, id) on delete restrict,
  constraint contracts_due_date_check check (due_date is null or due_date >= contracted_at)
);

create index contracts_owner_status_idx on public.contracts (owner_id, status);
create index contracts_client_idx on public.contracts (owner_id, client_id);
create index contracts_due_idx on public.contracts (owner_id, due_date);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null,
  contract_id uuid not null,
  source_link_id uuid,
  name text not null,
  service text not null,
  contracted_value numeric(14,2) not null default 0 check (contracted_value >= 0),
  description text,
  start_date date,
  due_date date,
  responsible_name text,
  priority text not null default 'medium' check (priority in ('very_high','high','medium','low')),
  status text not null default 'not_started' check (status in (
    'not_started','planning','in_development','awaiting_client_info','in_review',
    'awaiting_approval','changes_requested','completed','delivered','cancelled'
  )),
  completed_at timestamptz,
  delivered_at timestamptz,
  delivery_confirmed_at timestamptz,
  delivery_url text,
  files_url text,
  final_notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_owner_id_id_key unique (owner_id, id),
  constraint projects_owner_client_id_key unique (owner_id, client_id, id),
  constraint projects_source_link_key unique (source_link_id),
  constraint projects_contract_owner_fk foreign key (owner_id, client_id, contract_id)
    references public.contracts (owner_id, client_id, id) on delete restrict,
  constraint projects_source_link_owner_fk foreign key (owner_id, source_link_id)
    references public.lead_client_links (owner_id, id) on delete restrict,
  constraint projects_dates_check check (start_date is null or due_date is null or due_date >= start_date)
);

create index projects_owner_status_idx on public.projects (owner_id, status);
create index projects_client_idx on public.projects (owner_id, client_id);
create index projects_contract_idx on public.projects (owner_id, contract_id);
create index projects_due_idx on public.projects (owner_id, due_date);

create table public.client_activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null,
  project_id uuid,
  contract_id uuid,
  type text not null check (type in (
    'conversion','contact','meeting','approval','status_change','delivery','financial','note'
  )),
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint client_activities_client_owner_fk foreign key (owner_id, client_id)
    references public.clients (owner_id, id) on delete cascade,
  constraint client_activities_project_owner_fk foreign key (owner_id, client_id, project_id)
    references public.projects (owner_id, client_id, id) on delete restrict,
  constraint client_activities_contract_owner_fk foreign key (owner_id, client_id, contract_id)
    references public.contracts (owner_id, client_id, id) on delete restrict,
  constraint client_activities_created_by_check check (created_by is null or created_by = auth.uid())
);

create index client_activities_client_idx on public.client_activities (owner_id, client_id, created_at desc);
create index client_activities_project_idx on public.client_activities (owner_id, project_id, created_at desc);
create index client_activities_contract_idx on public.client_activities (owner_id, contract_id, created_at desc);

alter table public.clients enable row level security;
alter table public.lead_client_links enable row level security;
alter table public.contracts enable row level security;
alter table public.projects enable row level security;
alter table public.client_activities enable row level security;

revoke all on public.clients from anon, authenticated;
revoke all on public.lead_client_links from anon, authenticated;
revoke all on public.contracts from anon, authenticated;
revoke all on public.projects from anon, authenticated;
revoke all on public.client_activities from anon, authenticated;

grant select on public.clients to authenticated;
grant select on public.lead_client_links to authenticated;
grant select on public.contracts to authenticated;
grant select on public.projects to authenticated;
grant select on public.client_activities to authenticated;

create policy clients_select_own on public.clients for select using (auth.uid() = owner_id);
create policy lead_client_links_select_own on public.lead_client_links for select using (auth.uid() = owner_id);
create policy contracts_select_own on public.contracts for select using (auth.uid() = owner_id);
create policy projects_select_own on public.projects for select using (auth.uid() = owner_id);
create policy client_activities_select_own on public.client_activities for select using (auth.uid() = owner_id);

create trigger clients_set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger contracts_set_updated_at before update on public.contracts
  for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

commit;
```

- [ ] **Step 2: Review security and idempotence of the DDL**

Run: `git diff --check && git diff -- supabase/migrations/0006_etapa3_clients.sql`
Expected: no whitespace errors; every new table has RLS, owner policy, only `select` granted to `authenticated`, composite owner FKs and the support unique constraints required by later migrations.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0006_etapa3_clients.sql
git commit -m "feat: criar fundacao relacional de clientes"
```

---

### Task 4: Implementar conversão idempotente e seu contrato SQL

**Files:**
- Create: `supabase/tests/etapa3_clients.sql`
- Modify: `supabase/migrations/0006_etapa3_clients.sql`

**Interfaces:**
- Produces: `public.convert_lead_to_client(uuid,text,numeric,date,text,text,text,text,date,date) returns jsonb`.
- Produces: `ConversionResult` with `client_id`, `link_id`, `contract_id`, `project_id`, `already_existed`.

- [ ] **Step 1: Write the SQL contract test before the function**

```sql
-- supabase/tests/etapa3_clients.sql
create extension if not exists dblink;

begin;

do $$
declare
  v_owner uuid;
  v_other uuid := gen_random_uuid();
  v_lead uuid;
  v_second_lead uuid;
  v_cnpj_lead uuid;
  v_invalid_value numeric;
  v_first jsonb;
  v_repeat jsonb;
  v_manual jsonb;
  v_manual_repeat jsonb;
  v_extra_contract_id uuid;
  v_client_count int;
  v_contract_count int;
  v_project_count int;
  v_conversion_count int;
begin
  select id into v_owner from auth.users order by created_at limit 1;
  if v_owner is null then
    raise exception 'Crie ao menos um usuário autenticado antes de executar este teste.';
  end if;

  insert into auth.users (id, email)
  values (v_other, 'etapa3-' || v_other::text || '@example.test');

  insert into public.leads (
    owner_id, name, cnpj, status, source,
    estimated_value, negotiated_value, received_value
  )
  values (
    v_owner, 'Lead de teste transacional', '12.345.678/0001-95', 'negociando', 'teste',
    100.00, 200.00, 50.00
  )
  returning id into v_lead;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_first := public.convert_lead_to_client(
    v_lead, 'Site institucional', 1500.00, current_date,
    'pix', '50% na assinatura', null, 'Site do cliente', current_date, current_date + 14
  );

  v_repeat := public.convert_lead_to_client(
    v_lead, 'Payload diferente', 9999.99, current_date - 1,
    'cartao', 'Outra condição', 'Não sobrescrever', 'Outro projeto', null, null
  );

  if (v_first ->> 'already_existed') is distinct from 'false' then
    raise exception 'A primeira conversão não foi marcada como already_existed=false.';
  end if;
  if (v_first ->> 'client_id') is distinct from (v_repeat ->> 'client_id')
    or (v_first ->> 'link_id') is distinct from (v_repeat ->> 'link_id')
    or (v_first ->> 'contract_id') is distinct from (v_repeat ->> 'contract_id')
    or (v_first ->> 'project_id') is distinct from (v_repeat ->> 'project_id') then
    raise exception 'A repetição da conversão alterou os identificadores.';
  end if;
  if (v_repeat ->> 'already_existed') is distinct from 'true' then
    raise exception 'A repetição não foi marcada como already_existed.';
  end if;

  select count(*) into v_client_count from public.clients where id = (v_first ->> 'client_id')::uuid;
  select count(*) into v_contract_count from public.contracts where source_link_id = (v_first ->> 'link_id')::uuid;
  select count(*) into v_project_count from public.projects where source_link_id = (v_first ->> 'link_id')::uuid;
  select count(*) into v_conversion_count from public.lead_activities
    where lead_id = v_lead and type = 'conversao';

  if v_client_count <> 1 or v_contract_count <> 1 or v_project_count <> 1 or v_conversion_count <> 1 then
    raise exception 'A conversão criou duplicidades ou não registrou a atividade.';
  end if;

  if (select total_value from public.contracts where id = (v_first ->> 'contract_id')::uuid) <> 1500.00 then
    raise exception 'A repetição sobrescreveu o valor do contrato.';
  end if;
  if not exists (
    select 1 from public.leads
    where id = v_lead and owner_id = v_owner
      and status = 'aceitou' and contracted_value = 1500.00
      and estimated_value = 100.00 and negotiated_value = 200.00 and received_value = 50.00
  ) then
    raise exception 'A conversão não preservou o snapshot financeiro esperado do lead.';
  end if;

  insert into public.leads (owner_id, name, cnpj, status)
  values (v_owner, 'Lead adicional com mesmo CNPJ', '12345678000195', 'negociando')
  returning id into v_cnpj_lead;

  v_manual := public.convert_lead_to_client(
    v_cnpj_lead, 'Serviço adicional', 250.00, current_date
  );
  v_manual_repeat := public.convert_lead_to_client(
    v_cnpj_lead, 'Payload diferente', 999.99, current_date - 1,
    'cartao', 'Outra condição', 'Não sobrescrever', 'Projeto indevido', null, null
  );

  if (v_manual ->> 'client_id') is distinct from (v_first ->> 'client_id')
    or (v_manual ->> 'link_id') is not distinct from (v_first ->> 'link_id')
    or (v_manual ->> 'contract_id') is not distinct from (v_first ->> 'contract_id') then
    raise exception 'A conversão por CNPJ não reutilizou somente o cliente esperado.';
  end if;
  if (v_manual ->> 'project_id') is not null
    or (v_manual_repeat ->> 'project_id') is not null then
    raise exception 'A conversão sem projeto criou ou alterou um projeto.';
  end if;
  if (v_manual ->> 'already_existed') is distinct from 'false'
    or (v_manual_repeat ->> 'already_existed') is distinct from 'true'
    or (v_manual_repeat ->> 'link_id') is distinct from (v_manual ->> 'link_id')
    or (v_manual_repeat ->> 'contract_id') is distinct from (v_manual ->> 'contract_id') then
    raise exception 'A repetição da conversão por CNPJ não preservou o vínculo e o contrato.';
  end if;

  select id into v_extra_contract_id from public.contracts
    where source_link_id = (v_manual ->> 'link_id')::uuid;
  select count(*) into v_contract_count from public.contracts
    where source_link_id = (v_manual ->> 'link_id')::uuid;
  select count(*) into v_project_count from public.projects
    where source_link_id = (v_manual ->> 'link_id')::uuid;
  select count(*) into v_conversion_count from public.client_activities
    where client_id = (v_first ->> 'client_id')::uuid and type = 'conversion';

  if v_extra_contract_id is null or v_contract_count <> 1 or v_project_count <> 0
    or v_conversion_count <> 2
    or (select total_value from public.contracts where id = v_extra_contract_id) <> 250.00 then
    raise exception 'A reutilização de CNPJ duplicou registros ou sobrescreveu o payload.';
  end if;

  insert into public.leads (owner_id, name, status)
  values (v_owner, 'Lead para rollback', 'novo')
  returning id into v_second_lead;

  foreach v_invalid_value in array array[0.001::numeric, 1000000000000.00::numeric] loop
    begin
      perform public.convert_lead_to_client(
        v_second_lead, 'Site inválido', v_invalid_value, current_date
      );
      raise exception 'A conversão aceitou valor com escala ou limite inválido.';
    exception when others then
      if sqlerrm = 'A conversão aceitou valor com escala ou limite inválido.' then raise; end if;
      if sqlstate <> '22023' then raise; end if;
    end;
  end loop;

  create function public.test_force_project_failure() returns trigger
  language plpgsql as $test_force_project_failure$ begin raise exception 'FORCE_ROLLBACK'; end; $test_force_project_failure$;
  create trigger test_force_project_failure before insert on public.projects
    for each row execute function public.test_force_project_failure();
  begin
    perform public.convert_lead_to_client(
      v_second_lead, 'Site para rollback', 100.00, current_date,
      null, null, null, 'Projeto para rollback', null, null
    );
    raise exception 'A exceção tardia não foi provocada.';
  exception when others then
    if sqlerrm <> 'FORCE_ROLLBACK' then raise; end if;
  end;
  drop trigger test_force_project_failure on public.projects;
  drop function public.test_force_project_failure();

  if exists (select 1 from public.lead_client_links where lead_id = v_second_lead)
    or exists (select 1 from public.clients where name = 'Lead para rollback')
    or exists (select 1 from public.contracts where service = 'Site para rollback')
    or exists (select 1 from public.projects where name = 'Projeto para rollback')
    or exists (select 1 from public.lead_activities where lead_id = v_second_lead and type = 'conversao')
    or exists (
      select 1 from public.leads
      where id = v_second_lead and owner_id = v_owner
        and (status <> 'novo' or contracted_value <> 0 or received_value <> 0)
    ) then
    raise exception 'A exceção tardia não reverteu cliente, vínculo, contrato, projeto, atividade e snapshot.';
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  begin
    update public.leads set contracted_value = 1.00 where id = v_lead;
    raise exception 'Lead convertido permitiu alterar o valor contratado.';
  exception when others then
    if sqlerrm = 'Lead convertido permitiu alterar o valor contratado.' then raise; end if;
    if sqlstate <> '23514' then raise; end if;
  end;
  begin
    update public.leads set received_value = 1.00 where id = v_lead;
    raise exception 'Lead convertido permitiu alterar o valor recebido.';
  exception when others then
    if sqlerrm = 'Lead convertido permitiu alterar o valor recebido.' then raise; end if;
    if sqlstate <> '23514' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', v_other::text, true);
  if exists (select 1 from public.leads where id = v_lead) then
    raise exception 'RLS permitiu leitura de lead de outro proprietário.';
  end if;
  if exists (select 1 from public.clients where id = (v_first ->> 'client_id')::uuid) then
    raise exception 'RLS permitiu leitura de cliente de outro proprietário.';
  end if;
  if exists (select 1 from public.lead_client_links where id = (v_first ->> 'link_id')::uuid)
    or exists (select 1 from public.contracts where id = (v_first ->> 'contract_id')::uuid)
    or exists (select 1 from public.projects where id = (v_first ->> 'project_id')::uuid)
    or exists (select 1 from public.lead_activities where lead_id = v_lead)
    or exists (select 1 from public.client_activities where client_id = (v_first ->> 'client_id')::uuid) then
    raise exception 'RLS permitiu leitura de vínculo, contrato, projeto ou atividade de outro proprietário.';
  end if;
  begin
    perform public.convert_lead_to_client(
      v_lead, 'Acesso negado', 1.00, current_date
    );
    raise exception 'RPC permitiu converter lead de outro proprietário.';
  exception when others then
    if sqlerrm = 'RPC permitiu converter lead de outro proprietário.' then raise; end if;
    if sqlstate <> '42501' then raise; end if;
  end;
  reset role;

  raise notice 'Contrato SQL de clientes aprovado.';
end
$$;

rollback;
```

- [ ] **Step 2: Escrever o teste RED de conversão paralela com `dblink`**

Acrescente o bloco abaixo ao final de `supabase/tests/etapa3_clients.sql`, depois do `rollback;` do teste sequencial. Execute-o em autocommit, em uma instância PostgreSQL com a extensão `dblink` habilitada e conexões independentes permitidas ao mesmo banco (`current_database()`). Em ambiente hospedado, configure essa conexão sem gravar senha no repositório; caso não seja possível, execute o harness em PostgreSQL local com as migrations aplicadas. A fixture é criada pela sessão autenticada A e fica visível às duas sessões independentes. Os nomes de conexão são fixos e o disconnect preventivo remove conexões residuais. A conexão `etapa3_convert_admin` serve exclusivamente ao cleanup. O role e o claim do owner são configurados uma vez por sessão; cada consulta assíncrona contém apenas o SELECT, e `dblink_get_result` usa a definição explícita de coluna `result jsonb`, com uma segunda leitura para confirmar o conjunto vazio.

```sql
do $$
declare
  v_owner uuid;
  v_lead uuid := gen_random_uuid();
  v_lock_key bigint;
  v_probe_locked boolean := false;
  v_context text;
  v_call text;
  v_cleanup text;
  v_result_a jsonb;
  v_result_b jsonb;
  v_client_count int;
  v_link_count int;
  v_contract_count int;
  v_project_count int;
begin
  select id into v_owner from auth.users order by created_at limit 1;
  if v_owner is null then
    raise exception 'Crie ao menos um usuário autenticado antes de executar o teste paralelo.';
  end if;

  if 'etapa3_convert_admin' = any(dblink_get_connections()) then
    perform dblink_disconnect('etapa3_convert_admin');
  end if;
  if 'etapa3_convert_holder' = any(dblink_get_connections()) then
    perform dblink_disconnect('etapa3_convert_holder');
  end if;
  if 'etapa3_convert_a' = any(dblink_get_connections()) then
    perform dblink_disconnect('etapa3_convert_a');
  end if;
  if 'etapa3_convert_b' = any(dblink_get_connections()) then
    perform dblink_disconnect('etapa3_convert_b');
  end if;

  perform dblink_connect('etapa3_convert_admin', format('dbname=%L user=%L', current_database(), current_user));
  perform dblink_connect('etapa3_convert_holder', format('dbname=%L user=%L', current_database(), current_user));
  perform dblink_connect('etapa3_convert_a', format('dbname=%L user=%L', current_database(), current_user));
  perform dblink_connect('etapa3_convert_b', format('dbname=%L user=%L', current_database(), current_user));

  v_context := format(
    'set role authenticated; do $context$ begin perform set_config(''request.jwt.claim.sub'', %L, false); end $context$;',
    v_owner::text
  );
  perform dblink_exec('etapa3_convert_a', v_context);
  perform dblink_exec('etapa3_convert_b', v_context);
  perform dblink_exec('etapa3_convert_holder', v_context);

  v_cleanup := format(
    'delete from public.client_activities where client_id in (select id from public.clients where creation_key = %L); '
    'delete from public.projects where source_link_id in (select id from public.lead_client_links where lead_id = %L); '
    'delete from public.contracts where source_link_id in (select id from public.lead_client_links where lead_id = %L); '
    'delete from public.lead_activities where lead_id = %L; '
    'delete from public.lead_client_links where lead_id = %L; '
    'delete from public.clients where creation_key = %L; '
    'delete from public.leads where id = %L;',
    v_lead, v_lead, v_lead, v_lead, v_lead, v_lead, v_lead
  );

  perform dblink_exec('etapa3_convert_a', format(
    'insert into public.leads (id, owner_id, name, cnpj, status, source) '
    'values (%L, %L, %L, null, %L, %L);',
    v_lead, v_owner, 'Lead de conversão paralela', 'negociando', 'teste'
  ));

  v_lock_key := pg_catalog.hashtextextended(v_owner::text || ':clients', 0);
  perform dblink_exec('etapa3_convert_holder', format(
    'begin; do $hold_lock$ begin perform pg_catalog.pg_advisory_xact_lock(%s); end $hold_lock$;',
    v_lock_key
  ));

  perform dblink_exec('etapa3_convert_b', format(
    'do $try_lock$ begin '
    'if pg_catalog.pg_try_advisory_xact_lock(%s) then '
    'raise exception ''A segunda sessão adquiriu a advisory :clients.''; '
    'end if; end $try_lock$;',
    v_lock_key
  ));

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  set local lock_timeout = '250ms';
  begin
    perform public.convert_lead_to_client(
      v_lead, 'Site institucional', 1500.00, current_date,
      'pix', '50% na assinatura', null, 'Projeto paralelo', current_date, current_date + 14
    );
  exception
    when lock_not_available then v_probe_locked := true;
    when deadlock_detected then raise exception 'O probe local retornou 40P01 em vez de 55P03.';
  end;
  set local lock_timeout = 0;
  reset role;
  if not v_probe_locked then
    raise exception 'O probe local da conversão não foi bloqueado pela advisory :clients.';
  end if;

  perform dblink_exec('etapa3_convert_holder', format(
    'do $unlock$ begin '
    'if not pg_catalog.pg_advisory_xact_unlock(%s) then '
    'raise exception ''A advisory :clients não foi liberada.''; '
    'end if; end $unlock$;',
    v_lock_key
  ));
  perform dblink_exec('etapa3_convert_holder', 'commit;');

  v_call := format(
    'select public.convert_lead_to_client(%L::uuid, %L, %s, current_date, %L, %L, null, %L, current_date, current_date + 14);',
    v_lead, 'Site institucional', 1500.00,
    'pix', '50% na assinatura', 'Projeto paralelo'
  );
  if dblink_send_query('etapa3_convert_a', v_call) <> 1 then
    raise exception 'Não foi possível enviar a conversão paralela para a sessão A.';
  end if;
  if dblink_send_query('etapa3_convert_b', v_call) <> 1 then
    raise exception 'Não foi possível enviar a conversão paralela para a sessão B.';
  end if;

  begin
    select result into strict v_result_a
    from dblink_get_result('etapa3_convert_a', 'result jsonb') as t(result jsonb);
  exception when deadlock_detected then
    raise exception 'A conversão paralela retornou deadlock 40P01.';
  end;
  begin
    select result into strict v_result_b
    from dblink_get_result('etapa3_convert_b', 'result jsonb') as t(result jsonb);
  exception when deadlock_detected then
    raise exception 'A conversão paralela retornou deadlock 40P01.';
  end;
  if exists (select 1 from dblink_get_result('etapa3_convert_a', 'result jsonb') as t(result jsonb))
    or exists (select 1 from dblink_get_result('etapa3_convert_b', 'result jsonb') as t(result jsonb)) then
    raise exception 'As conversões paralelas deixaram resultados adicionais não consumidos.';
  end if;

  if (v_result_a ->> 'client_id') is distinct from (v_result_b ->> 'client_id')
    or (v_result_a ->> 'link_id') is distinct from (v_result_b ->> 'link_id')
    or (v_result_a ->> 'contract_id') is distinct from (v_result_b ->> 'contract_id')
    or (v_result_a ->> 'project_id') is distinct from (v_result_b ->> 'project_id') then
    raise exception 'As conversões paralelas retornaram identificadores diferentes.';
  end if;
  if not (
    ((v_result_a ->> 'already_existed') is not distinct from 'true'
      and (v_result_b ->> 'already_existed') is not distinct from 'false')
    or ((v_result_a ->> 'already_existed') is not distinct from 'false'
      and (v_result_b ->> 'already_existed') is not distinct from 'true')
  ) then
    raise exception 'As conversões paralelas não marcaram exatamente um already_existed=true.';
  end if;

  select count(*) into v_client_count from public.clients
    where owner_id = v_owner and creation_key = v_lead;
  select count(*) into v_link_count from public.lead_client_links where id = (v_result_a ->> 'link_id')::uuid;
  select count(*) into v_contract_count from public.contracts where source_link_id = (v_result_a ->> 'link_id')::uuid;
  select count(*) into v_project_count from public.projects where source_link_id = (v_result_a ->> 'link_id')::uuid;
  if v_client_count <> 1 or v_link_count <> 1 or v_contract_count <> 1 or v_project_count <> 1 then
    raise exception 'A conversão paralela duplicou cliente, vínculo, contrato ou projeto.';
  end if;

  perform dblink_exec('etapa3_convert_admin', v_cleanup);
  perform dblink_disconnect('etapa3_convert_a');
  perform dblink_disconnect('etapa3_convert_b');
  perform dblink_disconnect('etapa3_convert_holder');
  perform dblink_disconnect('etapa3_convert_admin');
  raise notice 'Harness de conversão paralela aprovado sem 40P01.';
exception
  when others then
    begin
      reset role;
      set local lock_timeout = 0;
    exception when others then
      raise notice 'Falha ao restaurar o contexto local: % (%).', sqlerrm, sqlstate;
    end;
    begin
      if 'etapa3_convert_holder' = any(dblink_get_connections()) then
        perform dblink_disconnect('etapa3_convert_holder');
      end if;
    exception when others then
      raise notice 'Falha ao desconectar etapa3_convert_holder: % (%).', sqlerrm, sqlstate;
    end;
    begin
      if 'etapa3_convert_a' = any(dblink_get_connections()) then
        perform dblink_disconnect('etapa3_convert_a');
      end if;
    exception when others then
      raise notice 'Falha ao desconectar etapa3_convert_a: % (%).', sqlerrm, sqlstate;
    end;
    begin
      if 'etapa3_convert_b' = any(dblink_get_connections()) then
        perform dblink_disconnect('etapa3_convert_b');
      end if;
    exception when others then
      raise notice 'Falha ao desconectar etapa3_convert_b: % (%).', sqlerrm, sqlstate;
    end;
    begin
      if 'etapa3_convert_admin' = any(dblink_get_connections()) then
        perform dblink_disconnect('etapa3_convert_admin');
      end if;
      perform dblink_connect('etapa3_convert_admin', format('dbname=%L user=%L', current_database(), current_user));
      perform dblink_exec('etapa3_convert_admin', v_cleanup);
    exception when others then
      raise notice 'Falha ao limpar a fixture de conversão paralela: % (%). O erro original será preservado.', sqlerrm, sqlstate;
    end;
    begin
      if 'etapa3_convert_admin' = any(dblink_get_connections()) then
        perform dblink_disconnect('etapa3_convert_admin');
      end if;
    exception when others then
      raise notice 'Falha ao desconectar etapa3_convert_admin: % (%).', sqlerrm, sqlstate;
    end;
    raise;
end
$$;
```

- [ ] **Step 3: Confirm the test is red**

Expected before implementation: execution fails because `public.convert_lead_to_client(uuid,text,numeric,date,text,text,text,text,date,date)` does not exist. O teste sequencial e o harness `etapa3_convert_*` devem falhar nessa condição, sem aprovar o gate sem saída real. Database execution requires migrations 0001–0006 applied by the user.

- [ ] **Step 4: Insert the conversion RPC before `commit;`**

```sql
create or replace function public.convert_lead_to_client(
  p_lead_id uuid,
  p_service text,
  p_contracted_value numeric,
  p_contracted_at date,
  p_payment_method text default null,
  p_payment_terms text default null,
  p_notes text default null,
  p_project_name text default null,
  p_project_start_date date default null,
  p_project_due_date date default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_lead public.leads;
  v_link public.lead_client_links;
  v_client public.clients;
  v_contract public.contracts;
  v_project public.projects;
  v_cnpj text;
  v_contracted_value numeric(14,2);
begin
  if v_owner is null then
    raise exception 'Sessão autenticada necessária.' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':clients', 0)
  );
  select * into v_lead
  from public.leads
  where id = p_lead_id and owner_id = v_owner
  for update;
  if not found then
    raise exception 'Lead não encontrado ou acesso negado.' using errcode = '42501';
  end if;

  select * into v_link
  from public.lead_client_links
  where lead_id = p_lead_id and owner_id = v_owner
  for update;
  if found then
    select * into v_contract from public.contracts
      where source_link_id = v_link.id and owner_id = v_owner;
    select * into v_project from public.projects
      where source_link_id = v_link.id and owner_id = v_owner;
    return jsonb_build_object(
      'client_id', v_link.client_id,
      'link_id', v_link.id,
      'contract_id', v_contract.id,
      'project_id', v_project.id,
      'already_existed', true
    );
  end if;

  if p_service is null or pg_catalog.btrim(p_service) = '' then
    raise exception 'Informe o serviço contratado.' using errcode = '22023';
  end if;
  if p_contracted_value is null
    or p_contracted_value::text !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' then
    raise exception 'Valor contratado inválido.' using errcode = '22023';
  end if;
  v_contracted_value := p_contracted_value::numeric(14,2);
  if p_contracted_at is null then
    raise exception 'Informe a data da contratação.' using errcode = '22023';
  end if;
  if p_project_start_date is not null and p_project_due_date is not null
    and p_project_due_date < p_project_start_date then
    raise exception 'O prazo do projeto não pode anteceder o início.' using errcode = '22023';
  end if;

  v_cnpj := nullif(pg_catalog.regexp_replace(v_lead.cnpj, '[^0-9]', '', 'g'), '');
  if v_cnpj is not null then
    select * into v_client
    from public.clients
    where owner_id = v_owner and cnpj_digits = v_cnpj
    for update;
  end if;

  if not found then
    begin
      insert into public.clients (
        owner_id, creation_key, name, responsible_name, phone, whatsapp,
        email, cnpj, website, instagram, address, city, district, zip_code,
        state, niche, status, source, converted_at, notes
      ) values (
        v_owner, p_lead_id, v_lead.name, v_lead.responsible_name, v_lead.phone,
        v_lead.whatsapp, v_lead.email, v_lead.cnpj, v_lead.website,
        v_lead.instagram, v_lead.address, v_lead.city, v_lead.district,
        v_lead.zip_code, v_lead.state, v_lead.niche, 'active',
        coalesce(nullif(v_lead.source, ''), 'lead'), now(), p_notes
      )
      on conflict (creation_key) do nothing
      returning * into v_client;
    exception when unique_violation then
      select * into v_client from public.clients
        where owner_id = v_owner and cnpj_digits = v_cnpj for update;
      if not found then raise; end if;
    end;

    if not found then
      select * into v_client from public.clients
        where owner_id = v_owner and creation_key = p_lead_id for update;
    end if;
  end if;

  update public.leads
  set status = 'aceitou', contracted_value = v_contracted_value
  where id = p_lead_id and owner_id = v_owner;

  insert into public.lead_client_links (owner_id, lead_id, client_id)
  values (v_owner, p_lead_id, v_client.id)
  returning * into v_link;

  insert into public.contracts (
    owner_id, client_id, source_link_id, service, total_value,
    contracted_at, payment_method, payment_terms, notes
  ) values (
    v_owner, v_client.id, v_link.id, pg_catalog.btrim(p_service),
    v_contracted_value, p_contracted_at, nullif(pg_catalog.btrim(p_payment_method), ''),
    nullif(pg_catalog.btrim(p_payment_terms), ''), nullif(pg_catalog.btrim(p_notes), '')
  )
  returning * into v_contract;

  if nullif(pg_catalog.btrim(p_project_name), '') is not null then
    insert into public.projects (
      owner_id, client_id, contract_id, source_link_id, name, service,
      contracted_value, start_date, due_date
    ) values (
      v_owner, v_client.id, v_contract.id, v_link.id,
      pg_catalog.btrim(p_project_name), pg_catalog.btrim(p_service),
      v_contracted_value, p_project_start_date, p_project_due_date
    )
    returning * into v_project;
  end if;

  insert into public.lead_activities (owner_id, lead_id, type, description)
  values (
    v_owner, p_lead_id, 'conversao',
    'Lead convertido em cliente: ' || pg_catalog.btrim(p_service) || '.'
  );

  insert into public.client_activities (
    owner_id, client_id, contract_id, project_id, type, description, metadata
  ) values (
    v_owner, v_client.id, v_contract.id, v_project.id, 'conversion',
    'Cliente originado da conversão do lead ' || v_lead.name || '.',
    jsonb_build_object('lead_id', p_lead_id, 'link_id', v_link.id)
  );

  return jsonb_build_object(
    'client_id', v_client.id,
    'link_id', v_link.id,
    'contract_id', v_contract.id,
    'project_id', v_project.id,
    'already_existed', false
  );
end;
$$;

revoke all on function public.convert_lead_to_client(uuid, text, numeric, date, text, text, text, text, date, date) from public, anon;
grant execute on function public.convert_lead_to_client(uuid, text, numeric, date, text, text, text, text, date, date) to authenticated;
```

- [ ] **Step 5: Review the transaction against the acceptance criteria**

Run: `git diff --check`
Expected: o lead é bloqueado antes da busca do vínculo; repetições retornam os mesmos IDs; correspondência de CNPJ reutiliza cliente; projeto opcional permanece nulo; inserções e atualização do lead ficam em uma transação; a função é `security definer`, usa `search_path` vazio, tem execução revogada de `public` e concedida somente a `authenticated`. O harness `etapa3_convert_*` comprova duas sessões autenticadas independentes, conflito `pg_try_advisory_xact_lock=false`, probe local `55P03`, chamadas assíncronas quase simultâneas, mesmos `client_id/link_id/contract_id/project_id`, exatamente um `already_existed=true` e uma única linha de cliente/vínculo/contrato/projeto, sem `40P01` e com cleanup nos caminhos normal e de exceção.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0006_etapa3_clients.sql supabase/tests/etapa3_clients.sql
git commit -m "feat: adicionar conversao idempotente de lead"
```

---

### Task 5: Implementar criação, edição e arquivamento de cliente por RPC

**Files:**
- Modify: `supabase/migrations/0006_etapa3_clients.sql`
- Modify: `supabase/tests/etapa3_clients.sql`

**Interfaces:**
- Produces: `create_client(p_payload jsonb) returns jsonb`.
- Produces: `update_client(p_client_id uuid, p_payload jsonb) returns jsonb`.
- Produces: `archive_client(p_client_id uuid) returns jsonb`.
- Consumes: `toMoneyDecimal` at the frontend boundary; `p_payload.total_value` is a decimal string.
- Restrição desta etapa: `update_client` preserva o total do contrato e a UI mantém o campo readonly. A liberação condicional antes da primeira parcela/pagamento será implementada pela substituição de `update_client` no Plano 3, conforme a spec.

- [ ] **Step 1: Extend the SQL contract test for manual idempotence**

Move this block to immediately before `set local role authenticated;`, while `auth.uid()` still identifies the test owner. Do not execute it after switching to the second-user isolation check:

```sql
  v_manual := public.create_client(jsonb_build_object(
    'creation_key', gen_random_uuid(),
    'name', 'Cliente manual de teste',
    'responsible_name', 'Responsável de teste',
    'phone', '(11) 99999-9999',
    'whatsapp', '',
    'email', 'cliente@example.test',
    'cnpj', '98.765.432/0001-10',
    'website', '',
    'instagram', '',
    'address', '',
    'city', 'São Paulo',
    'district', '',
    'zip_code', '',
    'state', 'SP',
    'niche', 'Teste',
    'status', 'active',
    'notes', '',
    'service', 'Consultoria',
    'total_value', '750.50',
    'contracted_at', current_date,
    'due_date', current_date + 30,
    'payment_method', 'pix',
    'payment_terms', 'À vista',
    'contract_notes', ''
  ));

  v_manual_repeat := public.create_client(jsonb_build_object(
    'creation_key', (v_manual ->> 'client')::jsonb ->> 'creation_key',
    'name', 'Nome diferente',
    'service', 'Serviço diferente',
    'total_value', '9999.99',
    'contracted_at', current_date - 1
  ));

  if ((v_manual ->> 'client')::jsonb ->> 'id') is distinct from ((v_manual_repeat ->> 'client')::jsonb ->> 'id') then
    raise exception 'create_client repetido não retornou o cliente existente.';
  end if;
  if (select name from public.clients where id = ((v_manual ->> 'client')::jsonb ->> 'id')::uuid) <> 'Cliente manual de teste' then
    raise exception 'create_client repetido sobrescreveu o cadastro.';
  end if;
  if (select count(*) from public.contracts where client_id = ((v_manual ->> 'client')::jsonb ->> 'id')::uuid) <> 1 then
    raise exception 'create_client não criou exatamente um contrato inicial.';
  end if;

  foreach v_invalid_total in array array['750.501'::text, '1000000000000.00'::text] loop
    begin
      perform public.create_client(jsonb_build_object(
        'creation_key', gen_random_uuid(), 'name', 'Cliente com valor inválido',
        'service', 'Consultoria', 'total_value', v_invalid_total,
        'contracted_at', current_date
      ));
      raise exception 'create_client aceitou valor com escala ou limite inválido.';
    exception when others then
      if sqlerrm = 'create_client aceitou valor com escala ou limite inválido.' then raise; end if;
      if sqlstate <> '22023' then raise; end if;
    end;
  end loop;
  if exists (select 1 from public.clients where owner_id = v_owner and name = 'Cliente com valor inválido') then
    raise exception 'create_client persistiu cliente com valor inválido.';
  end if;

  begin
    perform public.create_client(jsonb_build_object(
      'creation_key', gen_random_uuid(), 'name', 'Outro cliente',
      'cnpj', '98.765.432/0001-10', 'service', 'Outro serviço',
      'total_value', '10.00', 'contracted_at', current_date
    ));
    raise exception 'create_client aceitou CNPJ duplicado.';
  exception when others then
    if sqlerrm = 'create_client aceitou CNPJ duplicado.' then raise; end if;
    if sqlstate <> '23505' or sqlerrm not like 'CLIENT_CNPJ_DUPLICATE:%' then raise; end if;
  end;

  v_updated := public.update_client(
    ((v_manual ->> 'client')::jsonb ->> 'id')::uuid,
    (v_manual ->> 'client')::jsonb || (v_manual ->> 'contract')::jsonb || jsonb_build_object(
      'contract_id', (v_manual ->> 'contract')::jsonb ->> 'id',
      'name', 'Cliente manual editado', 'service', 'Consultoria editada',
      'total_value', '750.50'
    )
  );
  if (v_updated ->> 'client')::jsonb ->> 'name' <> 'Cliente manual editado'
    or (v_updated ->> 'contract')::jsonb ->> 'service' <> 'Consultoria editada' then
    raise exception 'update_client não atualizou cliente e contrato explicitamente selecionados.';
  end if;

  v_updated := public.update_client(
    (v_first ->> 'client_id')::uuid,
    to_jsonb((select row_to_json(c) from public.clients c where c.id = (v_first ->> 'client_id')::uuid))
      || to_jsonb((select row_to_json(k) from public.contracts k where k.id = (v_first ->> 'contract_id')::uuid))
      || jsonb_build_object(
        'contract_id', v_first ->> 'contract_id', 'name', 'Cliente convertido editado',
        'service', 'Site editado', 'total_value', '1500.00'
      )
  );
  if (select contracted_value from public.leads where id = v_lead) <> 1500.00 then
    raise exception 'Editar cliente convertido alterou o snapshot financeiro do lead.';
  end if;

  begin
    perform public.update_client(
      ((v_manual ->> 'client')::jsonb ->> 'id')::uuid,
      (v_manual ->> 'client')::jsonb || (v_manual ->> 'contract')::jsonb || jsonb_build_object(
        'contract_id', (v_manual ->> 'contract')::jsonb ->> 'id',
        'name', 'Nome que deve ser revertido', 'total_value', '749.99'
      )
    );
    raise exception 'update_client reduziu o total sem ajuste financeiro.';
  exception when others then
    if sqlerrm = 'update_client reduziu o total sem ajuste financeiro.' then raise; end if;
    if sqlstate <> '23514' or sqlerrm not like 'CONTRACT_ADJUST_REQUIRED:%' then raise; end if;
  end;
  if (select name from public.clients where id = ((v_manual ->> 'client')::jsonb ->> 'id')::uuid) <> 'Cliente manual editado' then
    raise exception 'A falha de ajuste não reverteu a edição do cliente.';
  end if;

  foreach v_invalid_total in array array['750.501'::text, '1000000000000.00'::text] loop
    begin
      perform public.update_client(
        ((v_manual ->> 'client')::jsonb ->> 'id')::uuid,
        (v_manual ->> 'client')::jsonb || (v_manual ->> 'contract')::jsonb || jsonb_build_object(
          'contract_id', (v_manual ->> 'contract')::jsonb ->> 'id',
          'name', 'Nome com valor inválido', 'total_value', v_invalid_total
        )
      );
      raise exception 'update_client aceitou valor com escala ou limite inválido.';
    exception when others then
      if sqlerrm = 'update_client aceitou valor com escala ou limite inválido.' then raise; end if;
      if sqlstate <> '22023' then raise; end if;
    end;
  end loop;
  if (select name from public.clients where id = ((v_manual ->> 'client')::jsonb ->> 'id')::uuid) <> 'Cliente manual editado' then
    raise exception 'A falha monetária não reverteu a edição do cliente.';
  end if;

  insert into public.contracts (owner_id, client_id, creation_key, service, total_value, contracted_at)
  values (
    v_owner, ((v_manual ->> 'client')::jsonb ->> 'id')::uuid, gen_random_uuid(),
    'Segundo contrato', 400.00, current_date
  ) returning id into v_extra_contract_id;

  v_updated := public.update_client(
    ((v_manual ->> 'client')::jsonb ->> 'id')::uuid,
    (v_manual ->> 'client')::jsonb || (v_manual ->> 'contract')::jsonb || jsonb_build_object(
      'contract_id', v_extra_contract_id, 'service', 'Segundo contrato editado',
      'total_value', '400.00'
    )
  );
  if (v_updated ->> 'contract')::jsonb ->> 'id' <> v_extra_contract_id::text
    or (select total_value from public.contracts where id = ((v_manual ->> 'contract')::jsonb ->> 'id')::uuid) <> 750.50 then
    raise exception 'update_client alterou o contrato errado em cliente com múltiplos contratos.';
  end if;

  begin
    perform public.update_client(
      ((v_manual ->> 'client')::jsonb ->> 'id')::uuid,
      (v_manual ->> 'client')::jsonb || jsonb_build_object(
        'contract_id', gen_random_uuid(), 'service', 'Site', 'total_value', '750.50',
        'contracted_at', current_date
      )
    );
    raise exception 'update_client aceitou contrato de outro cliente.';
  exception when others then
    if sqlerrm = 'update_client aceitou contrato de outro cliente.' then raise; end if;
    if sqlstate <> '42501' then raise; end if;
  end;

  begin
    perform public.update_client(
      ((v_manual ->> 'client')::jsonb ->> 'id')::uuid,
      (v_manual ->> 'client')::jsonb || (v_manual ->> 'contract')::jsonb || jsonb_build_object(
        'contract_id', (v_manual ->> 'contract')::jsonb ->> 'id',
        'cnpj', '12.345.678/0001-95', 'total_value', '750.50'
      )
    );
    raise exception 'update_client aceitou CNPJ de outro cliente.';
  exception when others then
    if sqlerrm = 'update_client aceitou CNPJ de outro cliente.' then raise; end if;
    if sqlstate <> '23505' or sqlerrm not like 'CLIENT_CNPJ_DUPLICATE:%' then raise; end if;
  end;

  v_updated := public.archive_client(((v_manual ->> 'client')::jsonb ->> 'id')::uuid);
  v_manual_archive := public.archive_client(((v_manual ->> 'client')::jsonb ->> 'id')::uuid);
  if (v_updated ->> 'status') <> 'inactive' or (v_manual_archive ->> 'status') <> 'inactive'
    or (select count(*) from public.client_activities
      where client_id = ((v_manual ->> 'client')::jsonb ->> 'id')::uuid
        and description = 'Cliente arquivado. Contratos e projetos foram preservados.') <> 1
    or (select count(*) from public.contracts where client_id = ((v_manual ->> 'client')::jsonb ->> 'id')::uuid) <> 2 then
    raise exception 'Arquivar repetidamente duplicou evento ou apagou contratos.';
  end if;

  update public.clients set archived_at = '2026-11-20T12:00:00Z'::timestamptz
    where id = ((v_manual ->> 'client')::jsonb ->> 'id')::uuid;
  select archived_at into v_archived_at from public.clients
    where id = ((v_manual ->> 'client')::jsonb ->> 'id')::uuid;
  v_updated := public.update_client(
    ((v_manual ->> 'client')::jsonb ->> 'id')::uuid,
    to_jsonb((select row_to_json(c) from public.clients c where c.id = ((v_manual ->> 'client')::jsonb ->> 'id')::uuid))
      || to_jsonb((select row_to_json(k) from public.contracts k where k.id = ((v_manual ->> 'contract')::jsonb ->> 'id')::uuid))
      || jsonb_build_object(
        'contract_id', (v_manual ->> 'contract')::jsonb ->> 'id',
        'name', 'Cliente arquivado editado', 'status', 'inactive', 'total_value', '750.50'
      )
  );
  if (v_updated ->> 'archived_at')::timestamptz is distinct from v_archived_at then
    raise exception 'Editar cliente inativo alterou a data original de arquivamento.';
  end if;
```

- [ ] **Step 2: Escrever o teste RED de criação paralela com `dblink`**

Acrescente o bloco abaixo ao final de `supabase/tests/etapa3_clients.sql`, depois do harness de conversão da Task 4 e fora das transações dos testes sequenciais. Ele usa duas sessões autenticadas independentes e o mesmo `creation_key`, com o mesmo pré-requisito de `dblink` e conexões independentes da Task 4. Os nomes de conexão são fixos, com disconnect preventivo; a conexão `etapa3_create_admin` é usada somente no cleanup. O role e o claim do owner são configurados uma vez por sessão; cada consulta assíncrona contém apenas o SELECT, e `dblink_get_result` usa a definição explícita de coluna `result jsonb`, com uma segunda leitura para confirmar o conjunto vazio.

```sql
do $$
declare
  v_owner uuid;
  v_key uuid := gen_random_uuid();
  v_lock_key bigint;
  v_probe_locked boolean := false;
  v_context text;
  v_payload jsonb;
  v_call text;
  v_cleanup text;
  v_result_a jsonb;
  v_result_b jsonb;
  v_client_count int;
  v_contract_count int;
begin
  select id into v_owner from auth.users order by created_at limit 1;
  if v_owner is null then
    raise exception 'Crie ao menos um usuário autenticado antes de executar o teste paralelo.';
  end if;

  if 'etapa3_create_admin' = any(dblink_get_connections()) then
    perform dblink_disconnect('etapa3_create_admin');
  end if;
  if 'etapa3_create_holder' = any(dblink_get_connections()) then
    perform dblink_disconnect('etapa3_create_holder');
  end if;
  if 'etapa3_create_a' = any(dblink_get_connections()) then
    perform dblink_disconnect('etapa3_create_a');
  end if;
  if 'etapa3_create_b' = any(dblink_get_connections()) then
    perform dblink_disconnect('etapa3_create_b');
  end if;

  perform dblink_connect('etapa3_create_admin', format('dbname=%L user=%L', current_database(), current_user));
  perform dblink_connect('etapa3_create_holder', format('dbname=%L user=%L', current_database(), current_user));
  perform dblink_connect('etapa3_create_a', format('dbname=%L user=%L', current_database(), current_user));
  perform dblink_connect('etapa3_create_b', format('dbname=%L user=%L', current_database(), current_user));

  v_context := format(
    'set role authenticated; do $context$ begin perform set_config(''request.jwt.claim.sub'', %L, false); end $context$;',
    v_owner::text
  );
  perform dblink_exec('etapa3_create_a', v_context);
  perform dblink_exec('etapa3_create_b', v_context);
  perform dblink_exec('etapa3_create_holder', v_context);

  v_payload := jsonb_build_object(
    'creation_key', v_key,
    'name', 'Cliente de criação paralela',
    'service', 'Consultoria',
    'total_value', '750.50',
    'contracted_at', current_date
  );
  v_cleanup := format(
    'delete from public.client_activities where client_id in (select id from public.clients where creation_key = %L); '
    'delete from public.contracts where creation_key = %L; '
    'delete from public.clients where creation_key = %L;',
    v_key, v_key, v_key
  );

  v_lock_key := pg_catalog.hashtextextended(v_owner::text || ':clients', 0);
  perform dblink_exec('etapa3_create_holder', format(
    'begin; do $hold_lock$ begin perform pg_catalog.pg_advisory_xact_lock(%s); end $hold_lock$;',
    v_lock_key
  ));

  perform dblink_exec('etapa3_create_b', format(
    'do $try_lock$ begin '
    'if pg_catalog.pg_try_advisory_xact_lock(%s) then '
    'raise exception ''A segunda sessão adquiriu a advisory :clients.''; '
    'end if; end $try_lock$;',
    v_lock_key
  ));

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  set local lock_timeout = '250ms';
  begin
    perform public.create_client(v_payload);
  exception
    when lock_not_available then v_probe_locked := true;
    when deadlock_detected then raise exception 'O probe local retornou 40P01 em vez de 55P03.';
  end;
  set local lock_timeout = 0;
  reset role;
  if not v_probe_locked then
    raise exception 'O probe local de create_client não foi bloqueado pela advisory :clients.';
  end if;

  perform dblink_exec('etapa3_create_holder', format(
    'do $unlock$ begin '
    'if not pg_catalog.pg_advisory_xact_unlock(%s) then '
    'raise exception ''A advisory :clients não foi liberada.''; '
    'end if; end $unlock$;',
    v_lock_key
  ));
  perform dblink_exec('etapa3_create_holder', 'commit;');

  v_call := format('select public.create_client(%L::jsonb);', v_payload::text);
  if dblink_send_query('etapa3_create_a', v_call) <> 1 then
    raise exception 'Não foi possível enviar a criação paralela para a sessão A.';
  end if;
  if dblink_send_query('etapa3_create_b', v_call) <> 1 then
    raise exception 'Não foi possível enviar a criação paralela para a sessão B.';
  end if;

  begin
    select result into strict v_result_a
    from dblink_get_result('etapa3_create_a', 'result jsonb') as t(result jsonb);
  exception when deadlock_detected then
    raise exception 'A criação paralela retornou deadlock 40P01.';
  end;
  begin
    select result into strict v_result_b
    from dblink_get_result('etapa3_create_b', 'result jsonb') as t(result jsonb);
  exception when deadlock_detected then
    raise exception 'A criação paralela retornou deadlock 40P01.';
  end;
  if exists (select 1 from dblink_get_result('etapa3_create_a', 'result jsonb') as t(result jsonb))
    or exists (select 1 from dblink_get_result('etapa3_create_b', 'result jsonb') as t(result jsonb)) then
    raise exception 'As criações paralelas deixaram resultados adicionais não consumidos.';
  end if;

  if (v_result_a -> 'client' ->> 'id') is distinct from (v_result_b -> 'client' ->> 'id')
    or (v_result_a -> 'contract' ->> 'id') is distinct from (v_result_b -> 'contract' ->> 'id') then
    raise exception 'As criações paralelas retornaram identificadores diferentes.';
  end if;
  if not (
    ((v_result_a ->> 'already_existed') is not distinct from 'true'
      and (v_result_b ->> 'already_existed') is not distinct from 'false')
    or ((v_result_a ->> 'already_existed') is not distinct from 'false'
      and (v_result_b ->> 'already_existed') is not distinct from 'true')
  ) then
    raise exception 'As criações paralelas não marcaram exatamente um already_existed=true.';
  end if;

  select count(*) into v_client_count from public.clients where creation_key = v_key;
  select count(*) into v_contract_count from public.contracts where creation_key = v_key;
  if v_client_count <> 1 or v_contract_count <> 1 then
    raise exception 'A criação paralela duplicou cliente ou contrato.';
  end if;

  perform dblink_exec('etapa3_create_admin', v_cleanup);
  perform dblink_disconnect('etapa3_create_a');
  perform dblink_disconnect('etapa3_create_b');
  perform dblink_disconnect('etapa3_create_holder');
  perform dblink_disconnect('etapa3_create_admin');
  raise notice 'Harness de criação paralela aprovado sem 40P01.';
exception
  when others then
    begin
      reset role;
      set local lock_timeout = 0;
    exception when others then
      raise notice 'Falha ao restaurar o contexto local: % (%).', sqlerrm, sqlstate;
    end;
    begin
      if 'etapa3_create_holder' = any(dblink_get_connections()) then
        perform dblink_disconnect('etapa3_create_holder');
      end if;
    exception when others then
      raise notice 'Falha ao desconectar etapa3_create_holder: % (%).', sqlerrm, sqlstate;
    end;
    begin
      if 'etapa3_create_a' = any(dblink_get_connections()) then
        perform dblink_disconnect('etapa3_create_a');
      end if;
    exception when others then
      raise notice 'Falha ao desconectar etapa3_create_a: % (%).', sqlerrm, sqlstate;
    end;
    begin
      if 'etapa3_create_b' = any(dblink_get_connections()) then
        perform dblink_disconnect('etapa3_create_b');
      end if;
    exception when others then
      raise notice 'Falha ao desconectar etapa3_create_b: % (%).', sqlerrm, sqlstate;
    end;
    begin
      if 'etapa3_create_admin' = any(dblink_get_connections()) then
        perform dblink_disconnect('etapa3_create_admin');
      end if;
      perform dblink_connect('etapa3_create_admin', format('dbname=%L user=%L', current_database(), current_user));
      perform dblink_exec('etapa3_create_admin', v_cleanup);
    exception when others then
      raise notice 'Falha ao limpar a fixture de criação paralela: % (%). O erro original será preservado.', sqlerrm, sqlstate;
    end;
    begin
      if 'etapa3_create_admin' = any(dblink_get_connections()) then
        perform dblink_disconnect('etapa3_create_admin');
      end if;
    exception when others then
      raise notice 'Falha ao desconectar etapa3_create_admin: % (%).', sqlerrm, sqlstate;
    end;
    raise;
end
$$;
```

- [ ] **Step 3: Confirm the test is red**

Expected: o teste sequencial e o harness `etapa3_create_*` referenciam `public.create_client(jsonb)`, que ainda não existe até a implementação desta task. Não marque o gate RED/GREEN como concluído sem saída real.

- [ ] **Step 4: Insert the client RPCs before `commit;`**

```sql
create or replace function public.create_client(p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_key uuid;
  v_client public.clients;
  v_contract public.contracts;
  v_cnpj text;
  v_service text;
  v_total numeric(14,2);
  v_total_text text;
  v_contracted_at date;
  v_due_date date;
begin
  if v_owner is null then
    raise exception 'Sessão autenticada necessária.' using errcode = '42501';
  end if;

  v_key := (p_payload ->> 'creation_key')::uuid;
  v_service := nullif(pg_catalog.btrim(p_payload ->> 'service'), '');
  v_total_text := nullif(pg_catalog.btrim(p_payload ->> 'total_value'), '');
  v_contracted_at := (p_payload ->> 'contracted_at')::date;
  v_due_date := nullif(p_payload ->> 'due_date', '')::date;

  if v_key is null or nullif(pg_catalog.btrim(p_payload ->> 'name'), '') is null then
    raise exception 'Informe a chave de cadastro e o nome do cliente.' using errcode = '22023';
  end if;
  if v_service is null or v_total_text is null
    or v_total_text !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' or v_contracted_at is null then
    raise exception 'Informe serviço, valor e data da contratação.' using errcode = '22023';
  end if;
  v_total := v_total_text::numeric(14,2);
  if v_due_date is not null and v_due_date < v_contracted_at then
    raise exception 'O vencimento não pode anteceder a contratação.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':clients', 0));
  select * into v_client from public.clients
    where owner_id = v_owner and creation_key = v_key for update;
  if found then
    select * into v_contract from public.contracts
      where owner_id = v_owner and client_id = v_client.id and creation_key = v_key;
    return jsonb_build_object(
      'client', to_jsonb(v_client), 'contract', to_jsonb(v_contract), 'already_existed', true
    );
  end if;

  v_cnpj := nullif(pg_catalog.regexp_replace(p_payload ->> 'cnpj', '[^0-9]', '', 'g'), '');
  if v_cnpj is not null then
    select * into v_client from public.clients
      where owner_id = v_owner and cnpj_digits = v_cnpj for update;
    if found then
      raise exception 'CLIENT_CNPJ_DUPLICATE:%', v_client.name using errcode = '23505';
    end if;
  end if;

  begin
    insert into public.clients (
      owner_id, creation_key, name, responsible_name, phone, whatsapp, email,
      cnpj, website, instagram, address, city, district, zip_code, state, niche,
      status, source, notes
    ) values (
    v_owner, v_key, pg_catalog.btrim(p_payload ->> 'name'),
    nullif(pg_catalog.btrim(p_payload ->> 'responsible_name'), ''),
    nullif(pg_catalog.btrim(p_payload ->> 'phone'), ''),
    nullif(pg_catalog.btrim(p_payload ->> 'whatsapp'), ''),
    nullif(pg_catalog.btrim(p_payload ->> 'email'), ''),
    nullif(pg_catalog.btrim(p_payload ->> 'cnpj'), ''),
    nullif(pg_catalog.btrim(p_payload ->> 'website'), ''),
    nullif(pg_catalog.btrim(p_payload ->> 'instagram'), ''),
    nullif(pg_catalog.btrim(p_payload ->> 'address'), ''),
    nullif(pg_catalog.btrim(p_payload ->> 'city'), ''),
    nullif(pg_catalog.btrim(p_payload ->> 'district'), ''),
    nullif(pg_catalog.btrim(p_payload ->> 'zip_code'), ''),
    nullif(pg_catalog.btrim(p_payload ->> 'state'), ''),
    nullif(pg_catalog.btrim(p_payload ->> 'niche'), ''),
    coalesce(nullif(p_payload ->> 'status', ''), 'active'),
    'manual', nullif(p_payload ->> 'notes', '')
    ) returning * into v_client;
  exception when unique_violation then
    if v_cnpj is not null then
      select * into v_client from public.clients
        where owner_id = v_owner and cnpj_digits = v_cnpj for update;
      if found then
        raise exception 'CLIENT_CNPJ_DUPLICATE:%', v_client.name using errcode = '23505';
      end if;
    end if;
    raise;
  end;

  insert into public.contracts (
    owner_id, client_id, creation_key, service, total_value, contracted_at,
    due_date, payment_method, payment_terms, notes
  ) values (
    v_owner, v_client.id, v_key, v_service, v_total, v_contracted_at,
    v_due_date, nullif(pg_catalog.btrim(p_payload ->> 'payment_method'), ''),
    nullif(pg_catalog.btrim(p_payload ->> 'payment_terms'), ''),
    nullif(p_payload ->> 'contract_notes', '')
  ) returning * into v_contract;

  insert into public.client_activities (owner_id, client_id, contract_id, type, description)
  values (v_owner, v_client.id, v_contract.id, 'note', 'Cliente e contrato inicial cadastrados.');

  return jsonb_build_object(
    'client', to_jsonb(v_client), 'contract', to_jsonb(v_contract), 'already_existed', false
  );
end;
$$;

create or replace function public.update_client(p_client_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_client public.clients;
  v_contract public.contracts;
  v_old_status text;
  v_contract_id uuid;
  v_cnpj text;
  v_service text;
  v_total numeric(14,2);
  v_total_text text;
  v_contracted_at date;
  v_due_date date;
begin
  if v_owner is null then
    raise exception 'Sessão autenticada necessária.' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':clients', 0)
  );
  select * into v_client from public.clients
    where id = p_client_id and owner_id = v_owner for update;
  if not found then
    raise exception 'Cliente não encontrado ou acesso negado.' using errcode = '42501';
  end if;

  v_old_status := v_client.status;
  v_contract_id := nullif(p_payload ->> 'contract_id', '')::uuid;
  select * into v_contract from public.contracts
    where owner_id = v_owner and client_id = p_client_id and id = v_contract_id
    for update;
  if not found then
    raise exception 'Contrato do cliente não encontrado ou acesso negado.' using errcode = '42501';
  end if;

  v_service := nullif(pg_catalog.btrim(p_payload ->> 'service'), '');
  v_total_text := nullif(pg_catalog.btrim(p_payload ->> 'total_value'), '');
  v_contracted_at := (p_payload ->> 'contracted_at')::date;
  v_due_date := nullif(p_payload ->> 'due_date', '')::date;
  if nullif(pg_catalog.btrim(p_payload ->> 'name'), '') is null
    or v_service is null or v_total_text is null
    or v_total_text !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' or v_contracted_at is null then
    raise exception 'Informe nome, serviço, valor e data da contratação.' using errcode = '22023';
  end if;
  v_total := v_total_text::numeric(14,2);
  if v_due_date is not null and v_due_date < v_contracted_at then
    raise exception 'O vencimento não pode anteceder a contratação.' using errcode = '22023';
  end if;

  v_cnpj := nullif(pg_catalog.regexp_replace(p_payload ->> 'cnpj', '[^0-9]', '', 'g'), '');
  if v_cnpj is not null and exists (
    select 1 from public.clients where owner_id = v_owner and cnpj_digits = v_cnpj and id <> p_client_id
  ) then
    select name into v_service from public.clients where owner_id = v_owner and cnpj_digits = v_cnpj limit 1;
    raise exception 'CLIENT_CNPJ_DUPLICATE:%', v_service using errcode = '23505';
  end if;

  update public.clients set
    name = pg_catalog.btrim(p_payload ->> 'name'),
    responsible_name = nullif(pg_catalog.btrim(p_payload ->> 'responsible_name'), ''),
    phone = nullif(pg_catalog.btrim(p_payload ->> 'phone'), ''),
    whatsapp = nullif(pg_catalog.btrim(p_payload ->> 'whatsapp'), ''),
    email = nullif(pg_catalog.btrim(p_payload ->> 'email'), ''),
    cnpj = nullif(pg_catalog.btrim(p_payload ->> 'cnpj'), ''),
    website = nullif(pg_catalog.btrim(p_payload ->> 'website'), ''),
    instagram = nullif(pg_catalog.btrim(p_payload ->> 'instagram'), ''),
    address = nullif(pg_catalog.btrim(p_payload ->> 'address'), ''),
    city = nullif(pg_catalog.btrim(p_payload ->> 'city'), ''),
    district = nullif(pg_catalog.btrim(p_payload ->> 'district'), ''),
    zip_code = nullif(pg_catalog.btrim(p_payload ->> 'zip_code'), ''),
    state = nullif(pg_catalog.btrim(p_payload ->> 'state'), ''),
    niche = nullif(pg_catalog.btrim(p_payload ->> 'niche'), ''),
    status = coalesce(nullif(p_payload ->> 'status', ''), v_client.status),
    notes = nullif(p_payload ->> 'notes', ''),
    archived_at = case
      when coalesce(nullif(p_payload ->> 'status', ''), v_client.status) = 'inactive'
        then coalesce(v_client.archived_at, now())
      else null
    end
  where id = p_client_id and owner_id = v_owner
  returning * into v_client;

  if v_total is distinct from v_contract.total_value then
    raise exception 'CONTRACT_ADJUST_REQUIRED: use o ajuste financeiro do contrato.' using errcode = '23514';
  end if;

  update public.contracts set
    service = v_service,
    total_value = v_total,
    contracted_at = v_contracted_at,
    due_date = v_due_date,
    payment_method = nullif(pg_catalog.btrim(p_payload ->> 'payment_method'), ''),
    payment_terms = nullif(pg_catalog.btrim(p_payload ->> 'payment_terms'), ''),
    notes = nullif(p_payload ->> 'contract_notes', '')
  where id = v_contract.id and owner_id = v_owner
  returning * into v_contract;

  if v_old_status is distinct from v_client.status then
    insert into public.client_activities (owner_id, client_id, type, description, metadata)
    values (
      v_owner, v_client.id, 'status_change',
      'Status alterado de ' || v_old_status || ' para ' || v_client.status || '.',
      jsonb_build_object('previous_status', v_old_status, 'new_status', v_client.status)
    );
  end if;

  return jsonb_build_object('client', to_jsonb(v_client), 'contract', to_jsonb(v_contract));
end;
$$;

create or replace function public.archive_client(p_client_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_client public.clients;
begin
  if v_owner is null then
    raise exception 'Sessão autenticada necessária.' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':clients', 0));
  select * into v_client from public.clients
    where id = p_client_id and owner_id = v_owner for update;
  if not found then
    raise exception 'Cliente não encontrado ou acesso negado.' using errcode = '42501';
  end if;
  if v_client.status = 'inactive' and v_client.archived_at is not null then
    return to_jsonb(v_client);
  end if;
  update public.clients set status = 'inactive', archived_at = now()
    where id = p_client_id and owner_id = v_owner returning * into v_client;
  insert into public.client_activities (owner_id, client_id, type, description)
  values (v_owner, v_client.id, 'note', 'Cliente arquivado. Contratos e projetos foram preservados.');
  return to_jsonb(v_client);
end;
$$;

revoke all on function public.create_client(jsonb) from public, anon;
revoke all on function public.update_client(uuid, jsonb) from public, anon;
revoke all on function public.archive_client(uuid) from public, anon;
grant execute on function public.create_client(jsonb) to authenticated;
grant execute on function public.update_client(uuid, jsonb) to authenticated;
grant execute on function public.archive_client(uuid) to authenticated;
```

- [ ] **Step 5: Review the SQL test and security**

Run: `git diff --check`
Expected: `creation_key` repetido retorna os registros existentes; chave diferente com o mesmo CNPJ levanta `23505` com `CLIENT_CNPJ_DUPLICATE`; cliente e contrato explicitamente selecionado são atualizados atomicamente; editar cliente convertido preserva o snapshot financeiro do lead; total reduzido levanta `23514` com `CONTRACT_ADJUST_REQUIRED` e reverte a edição; contratos múltiplos permanecem independentes; contrato de outro cliente levanta `42501`; edição com CNPJ duplicado levanta `23505`; arquivamento repetido cria um único evento e preserva os dois contratos; todas as funções verificam owner, usam `search_path` vazio, revogam `public` e concedem execução a `authenticated`. O harness `etapa3_create_*` comprova duas sessões autenticadas independentes com o mesmo `creation_key`, conflito `pg_try_advisory_xact_lock=false`, probe local `55P03`, chamadas assíncronas quase simultâneas, mesmos IDs de cliente/contrato, exatamente um `already_existed=true` e uma única linha de cliente/contrato, sem `40P01` e com cleanup nos caminhos normal e de exceção. O harness `etapa3_convert_*` da Task 4 cobre a mesma exigência para `convert_lead_to_client`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0006_etapa3_clients.sql supabase/tests/etapa3_clients.sql
git commit -m "feat: adicionar RPCs de cadastro de cliente"
```

---

### Task 6: Criar `clientService` e testes de contrato

**Files:**
- Create: `src/services/clientService.ts`
- Create: `src/services/clientService.test.ts`
- Modify: `src/types/activity.ts`
- Modify: `src/types/activity.test.ts`
- Modify: `src/components/leads/LeadTimeline.tsx`
- Create: `src/components/leads/LeadTimeline.test.tsx`
- Modify: `src/components/leads/ContactDialog.tsx`
- Create: `src/components/leads/ContactDialog.test.tsx`

**Interfaces:**
- Consumes: types from Task 2; `requireSupabase`, `throwDbError` from `src/lib/db.ts`; money helpers from Task 2; atividade lead `conversao` já persistida pela migration 0006.
- Produces: catálogo `ActivityType` com `conversao`, antecipado da Task 11 para que o histórico combinado compile sem casts; a Task 11 mantém os mesmos valores e acrescenta refresh/trava financeira.
- Produces:
  - `listClients(filters: ClientFilters, sort: ClientSort, page: number, pageSize?: number): Promise<{ clients: Client[]; total: number }>`
  - `getClient(id: string): Promise<ClientDetail | null>`
  - `createClient(input: CreateClientInput): Promise<Client>`
  - `updateClient(id: string, input: UpdateClientInput): Promise<Client>`
  - `archiveClient(id: string): Promise<Client>`
  - `findClientDuplicateCandidates(input: ClientDuplicateInput, excludeId?: string): Promise<Client[]>`
  - `getLeadClientLink(leadId: string): Promise<LeadClientLink | null>`
  - `listLeadClientLinks(): Promise<LeadClientLink[]>`
  - `countConvertedLeads(): Promise<number>`
  - `convertLeadToClient(leadId: string, input: ConversionInput): Promise<ConversionResult>`

- [ ] **Step 1: Write all failing service contract tests**

Create the complete test file below before writing the service. The fake records the real PostgREST chain and is thenable, so `await query`, `await query.maybeSingle()` and every chained filter execute through the same path.

```ts
// src/services/clientService.test.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Activity } from '../types/activity'
import type {
  Client, ClientActivity, ClientWrite, CreateClientInput, InitialContractInput,
  LeadClientLink,
} from '../types/client'
import type { Contract } from '../types/contract'
import type { Project } from '../types/project'

const { rpc, requireSupabase } = vi.hoisted(() => ({
  rpc: vi.fn(),
  requireSupabase: vi.fn(),
}))

vi.mock('../lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db')>()
  return { ...actual, requireSupabase }
})

import {
  archiveClient, convertLeadToClient, countConvertedLeads, createClient,
  findClientDuplicateCandidates, getClient, getLeadClientLink, listClients,
  listLeadClientLinks, updateClient,
} from './clientService'

type QueryResult = {
  data: unknown
  error: { message: string } | null
  count?: number | null
}

type SelectOptions = { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }

interface QueryCall {
  table: string
  select: string
  selectOptions: SelectOptions | null
  eq: Array<[string, unknown]>
  or: string | null
  ilike: Array<[string, string]>
  order: Array<[string, { ascending: boolean }]>
  range: [number, number] | null
  limit: number | null
  maybeSingle: boolean
}

interface MutationCall {
  table: string
  operation: 'insert' | 'update' | 'delete'
  values?: unknown
}

class FakeSupabase {
  readonly fromCalls: string[] = []
  readonly calls: QueryCall[] = []
  readonly mutations: MutationCall[] = []
  private readonly responses = new Map<string, QueryResult[]>()

  from(table: string): FakeQuery {
    this.fromCalls.push(table)
    return new FakeQuery(this, table)
  }

  queue(table: string, result: QueryResult): void {
    const responses = this.responses.get(table) ?? []
    responses.push(result)
    this.responses.set(table, responses)
  }

  nextResult(table: string): QueryResult {
    return this.responses.get(table)?.shift() ?? { data: [], error: null }
  }
}

class FakeQuery implements PromiseLike<QueryResult> {
  private selectColumns = ''
  private selectOptions: SelectOptions | null = null
  private readonly eqFilters: Array<[string, unknown]> = []
  private orFilter: string | null = null
  private readonly ilikeFilters: Array<[string, string]> = []
  private readonly orderCalls: Array<[string, { ascending: boolean }]> = []
  private rangeCall: [number, number] | null = null
  private rowLimit: number | null = null
  private singleResult = false
  private result: Promise<QueryResult> | null = null
  private readonly client: FakeSupabase
  private readonly table: string

  constructor(client: FakeSupabase, table: string) {
    this.client = client
    this.table = table
  }

  select(columns: string, options?: SelectOptions): this {
    this.selectColumns = columns
    this.selectOptions = options ?? null
    return this
  }

  eq(column: string, value: unknown): this {
    this.eqFilters.push([column, value])
    return this
  }

  or(filter: string): this {
    this.orFilter = filter
    return this
  }

  ilike(column: string, pattern: string): this {
    this.ilikeFilters.push([column, pattern])
    return this
  }

  order(column: string, options: { ascending: boolean }): this {
    this.orderCalls.push([column, options])
    return this
  }

  range(from: number, to: number): this {
    this.rangeCall = [from, to]
    return this
  }

  limit(count: number): this {
    this.rowLimit = count
    return this
  }

  maybeSingle(): Promise<QueryResult> {
    this.singleResult = true
    return this.execute()
  }

  insert(values: unknown): this {
    this.client.mutations.push({ table: this.table, operation: 'insert', values })
    return this
  }

  update(values: unknown): this {
    this.client.mutations.push({ table: this.table, operation: 'update', values })
    return this
  }

  delete(): this {
    this.client.mutations.push({ table: this.table, operation: 'delete' })
    return this
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private execute(): Promise<QueryResult> {
    if (this.result) return this.result
    this.client.calls.push({
      table: this.table,
      select: this.selectColumns,
      selectOptions: this.selectOptions,
      eq: [...this.eqFilters],
      or: this.orFilter,
      ilike: [...this.ilikeFilters],
      order: [...this.orderCalls],
      range: this.rangeCall,
      limit: this.rowLimit,
      maybeSingle: this.singleResult,
    })
    this.result = Promise.resolve(this.client.nextResult(this.table))
    return this.result
  }
}

interface ContractRow extends Omit<Contract, 'total_value_cents'> {
  total_value: string | number
}

interface ProjectRow extends Omit<Project, 'contracted_value_cents'> {
  contracted_value: string | number
}

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    owner_id: 'owner-1',
    creation_key: '00000000-0000-0000-0000-000000000501',
    name: 'Empresa A',
    responsible_name: 'Ana Responsável',
    phone: '(11) 99999-9999',
    whatsapp: null,
    email: 'contato@empresa-a.test',
    cnpj: '12.345.678/0001-95',
    cnpj_digits: '12345678000195',
    phone_canonical: '5511999999999',
    whatsapp_canonical: null,
    website: null,
    instagram: null,
    address: null,
    city: 'São Paulo',
    district: null,
    zip_code: null,
    state: 'SP',
    niche: null,
    notes: null,
    status: 'active',
    source: 'manual',
    converted_at: null,
    archived_at: null,
    created_at: '2026-11-20T12:00:00Z',
    updated_at: '2026-11-20T12:00:00Z',
    ...overrides,
  }
}

function makeContractRow(overrides: Partial<ContractRow> = {}): ContractRow {
  return {
    id: 'contract-1',
    owner_id: 'owner-1',
    client_id: 'client-1',
    source_link_id: null,
    creation_key: '00000000-0000-0000-0000-000000000601',
    service: 'Site',
    total_value: '1234.56',
    contracted_at: '2026-11-20',
    due_date: '2026-12-20',
    payment_method: 'pix',
    payment_terms: 'À vista',
    status: 'active',
    notes: null,
    cancelled_at: null,
    created_at: '2026-11-20T12:00:00Z',
    updated_at: '2026-11-20T12:00:00Z',
    ...overrides,
  }
}

function makeProjectRow(overrides: Partial<ProjectRow> = {}): ProjectRow {
  return {
    id: 'project-1',
    owner_id: 'owner-1',
    client_id: 'client-1',
    contract_id: 'contract-1',
    source_link_id: null,
    name: 'Site da Empresa A',
    service: 'Site',
    contracted_value: '500.00',
    description: null,
    start_date: '2026-11-21',
    due_date: '2026-12-10',
    responsible_name: 'Ana Responsável',
    priority: 'medium',
    status: 'not_started',
    completed_at: null,
    delivered_at: null,
    delivery_confirmed_at: null,
    delivery_url: null,
    files_url: null,
    final_notes: null,
    archived_at: null,
    created_at: '2026-11-20T12:00:00Z',
    updated_at: '2026-11-20T12:00:00Z',
    ...overrides,
  }
}

function makeClientActivity(overrides: Partial<ClientActivity> = {}): ClientActivity {
  return {
    id: 'client-activity-1',
    owner_id: 'owner-1',
    client_id: 'client-1',
    project_id: null,
    contract_id: null,
    type: 'note',
    description: 'Nota do cliente',
    metadata: {},
    created_by: 'owner-1',
    created_at: '2026-11-25T12:00:00Z',
    ...overrides,
  }
}

function makeLink(overrides: Partial<LeadClientLink> = {}): LeadClientLink {
  return {
    id: 'link-1',
    owner_id: 'owner-1',
    lead_id: 'lead-1',
    client_id: 'client-1',
    converted_at: '2026-11-20T12:00:00Z',
    created_at: '2026-11-20T12:00:00Z',
    ...overrides,
  }
}

function makeLeadActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'lead-activity-1',
    lead_id: 'lead-1',
    owner_id: 'owner-1',
    type: 'mensagem',
    description: 'Mensagem do lead',
    user_id: 'owner-1',
    created_at: '2026-11-24T12:00:00Z',
    ...overrides,
  }
}

function makeClientWrite(overrides: Partial<ClientWrite> = {}): ClientWrite {
  return {
    name: 'Empresa A',
    responsible_name: null,
    phone: null,
    whatsapp: null,
    email: null,
    cnpj: null,
    website: null,
    instagram: null,
    address: null,
    city: null,
    district: null,
    zip_code: null,
    state: null,
    niche: null,
    notes: null,
    status: 'active',
    ...overrides,
  }
}

function makeInitialContract(overrides: Partial<InitialContractInput> = {}): InitialContractInput {
  return {
    service: 'Site',
    totalValueCents: 123456,
    contractedAt: '2026-11-25',
    dueDate: null,
    paymentMethod: 'pix',
    paymentTerms: 'À vista',
    notes: '',
    ...overrides,
  }
}

let supabase: FakeSupabase

beforeEach(() => {
  rpc.mockReset()
  requireSupabase.mockReset()
  supabase = new FakeSupabase()
  requireSupabase.mockReturnValue({
    rpc,
    from: (table: string) => supabase.from(table),
  } as unknown as SupabaseClient)
})

describe('clientService', () => {
  it('envia centavos como decimal e normaliza o JSON da conversão', async () => {
    rpc.mockResolvedValue({
      data: {
        client_id: 'client-1', link_id: 'link-1', contract_id: 'contract-1',
        project_id: null, already_existed: false,
      },
      error: null,
    })

    const result = await convertLeadToClient('lead-1', {
      service: 'Site', contractedValueCents: 123456, contractedAt: '2026-11-25',
      paymentMethod: 'pix', paymentTerms: 'À vista', notes: '', project: null,
    })

    expect(rpc).toHaveBeenCalledWith('convert_lead_to_client', {
      p_lead_id: 'lead-1', p_service: 'Site', p_contracted_value: '1234.56',
      p_contracted_at: '2026-11-25', p_payment_method: 'pix',
      p_payment_terms: 'À vista', p_notes: null, p_project_name: null,
      p_project_start_date: null, p_project_due_date: null,
    })
    expect(result).toEqual({
      client_id: 'client-1', link_id: 'link-1', contract_id: 'contract-1',
      project_id: null, already_existed: false,
    })
  })

  it('rejeita JSON vazio da RPC', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await expect(convertLeadToClient('lead-1', {
      service: 'Site', contractedValueCents: 100, contractedAt: '2026-11-25',
      paymentMethod: '', paymentTerms: '', notes: '', project: null,
    })).rejects.toThrow('Não foi possível converter o lead.')
  })

  it('listClients aplica busca, status, cidade, ordenação estável e range', async () => {
    const client = makeClient()
    supabase.queue('clients', { data: [client], error: null, count: 37 })

    const result = await listClients(
      { search: 'Empresa', status: 'active', city: 'São Paulo' },
      'name_asc',
      1,
      20,
    )

    expect(supabase.calls).toHaveLength(1)
    expect(supabase.calls[0]).toEqual({
      table: 'clients',
      select: '*',
      selectOptions: { count: 'exact' },
      eq: [['status', 'active']],
      or: 'name.ilike."%Empresa%",responsible_name.ilike."%Empresa%",email.ilike."%Empresa%"',
      ilike: [['city', '%São Paulo%']],
      order: [['name', { ascending: true }], ['id', { ascending: true }]],
      range: [20, 39],
      limit: null,
      maybeSingle: false,
    })
    expect(result).toEqual({ clients: [client], total: 37 })
  })

  it('listClients pesquisa nome quando o texto contém dígitos que não formam um CNPJ', async () => {
    const client = makeClient({ name: 'Empresa 2' })
    supabase.queue('clients', { data: [client], error: null, count: 1 })

    const result = await listClients({ search: 'Empresa 2', status: '', city: '' }, 'name_asc', 0)

    expect(result.clients).toEqual([client])
    expect(supabase.calls[0].eq).toEqual([])
    expect(supabase.calls[0].or).toBe('name.ilike."%Empresa 2%",responsible_name.ilike."%Empresa 2%",email.ilike."%Empresa 2%"')
  })

  it('listClients aceita CNPJ completo e também mantém a busca textual', async () => {
    const client = makeClient()
    supabase.queue('clients', { data: [client], error: null, count: 1 })

    await listClients({ search: '12.345.678/0001-95', status: '', city: '' }, 'name_asc', 0)

    expect(supabase.calls[0].eq).toEqual([])
    expect(supabase.calls[0].or).toBe('cnpj_digits.eq."12345678000195",name.ilike."%12.345.678/0001-95%",responsible_name.ilike."%12.345.678/0001-95%",email.ilike."%12.345.678/0001-95%"')
  })

  it('listClients retorna total do Supabase, não o tamanho da página', async () => {
    const clients = [makeClient(), makeClient({ id: 'client-2', name: 'Empresa B' })]
    supabase.queue('clients', { data: clients, error: null, count: 37 })

    const result = await listClients({ search: '', status: '', city: '' }, 'created_desc', 0)

    expect(result.clients).toEqual(clients)
    expect(result.total).toBe(37)
    expect(result.total).not.toBe(result.clients.length)
  })

  it('getClient retorna null para cliente inexistente', async () => {
    supabase.queue('clients', { data: null, error: null })

    const result = await getClient('missing-client')

    expect(result).toBeNull()
    expect(supabase.fromCalls).toEqual(['clients'])
    expect(supabase.calls[0]).toMatchObject({
      table: 'clients',
      select: '*',
      eq: [['id', 'missing-client']],
      maybeSingle: true,
    })
  })

  it('getClient normaliza numeric de contrato e projeto para centavos', async () => {
    const client = makeClient()
    supabase.queue('clients', { data: client, error: null })
    supabase.queue('contracts', { data: [makeContractRow({ total_value: '1234.56' })], error: null })
    supabase.queue('projects', { data: [makeProjectRow({ contracted_value: '500.00' })], error: null })
    supabase.queue('client_activities', { data: [], error: null })
    supabase.queue('lead_client_links', { data: [], error: null })

    const detail = await getClient(client.id)

    expect(detail?.client).toEqual(client)
    expect(detail?.contracts[0].total_value_cents).toBe(123456)
    expect(detail?.contracts[0]).not.toHaveProperty('total_value')
    expect(detail?.projects[0].contracted_value_cents).toBe(50000)
    expect(detail?.projects[0]).not.toHaveProperty('contracted_value')
  })

  it('getClient combina eventos do cliente e dos leads sem copiar no banco', async () => {
    const client = makeClient()
    const firstLink = makeLink()
    const secondLink = makeLink({
      id: 'link-2',
      lead_id: 'lead-2',
      converted_at: '2026-11-21T12:00:00Z',
      created_at: '2026-11-21T12:00:00Z',
    })
    supabase.queue('clients', { data: client, error: null })
    supabase.queue('contracts', { data: [], error: null })
    supabase.queue('projects', { data: [], error: null })
    supabase.queue('client_activities', {
      data: [makeClientActivity({ id: 'client-new', created_at: '2026-11-25T12:00:00Z' })],
      error: null,
    })
    supabase.queue('lead_client_links', { data: [firstLink, secondLink], error: null })
    supabase.queue('leads', { data: { id: 'lead-1', name: 'Lead Um' }, error: null })
    supabase.queue('leads', { data: { id: 'lead-2', name: 'Lead Dois' }, error: null })
    supabase.queue('lead_activities', {
      data: [makeLeadActivity({ id: 'lead-old', created_at: '2026-11-24T12:00:00Z' })],
      error: null,
    })
    supabase.queue('lead_activities', {
      data: [makeLeadActivity({
        id: 'lead-new',
        lead_id: 'lead-2',
        description: 'Resposta do lead 2',
        created_at: '2026-11-25T13:00:00Z',
      })],
      error: null,
    })

    const detail = await getClient(client.id)

    const activityQueries = supabase.calls.filter((call) => call.table === 'lead_activities')
    expect(activityQueries).toHaveLength(2)
    expect(activityQueries.map((call) => call.eq)).toEqual([
      [['lead_id', 'lead-1']],
      [['lead_id', 'lead-2']],
    ])
    expect(activityQueries.every((call) => call.select === '*')).toBe(true)
    expect(activityQueries.every((call) => (
      JSON.stringify(call.order) === JSON.stringify([['created_at', { ascending: false }]])
    ))).toBe(true)
    expect(detail?.linkedLeads).toEqual([
      { leadId: 'lead-1', leadName: 'Lead Um' },
      { leadId: 'lead-2', leadName: 'Lead Dois' },
    ])
    expect(detail?.history).toEqual([
      {
        id: 'lead-new', type: 'mensagem', description: 'Resposta do lead 2',
        created_at: '2026-11-25T13:00:00Z', source: 'lead', leadName: 'Lead Dois',
      },
      {
        id: 'client-new', type: 'note', description: 'Nota do cliente',
        created_at: '2026-11-25T12:00:00Z', source: 'client',
      },
      {
        id: 'lead-old', type: 'mensagem', description: 'Mensagem do lead',
        created_at: '2026-11-24T12:00:00Z', source: 'lead', leadName: 'Lead Um',
      },
    ])
    expect(supabase.mutations).toEqual([])
  })

  it('getClient não duplica a conversão registrada no cliente e no lead vinculado', async () => {
    const client = makeClient()
    supabase.queue('clients', { data: client, error: null })
    supabase.queue('contracts', { data: [], error: null })
    supabase.queue('projects', { data: [], error: null })
    supabase.queue('client_activities', {
      data: [makeClientActivity({
        type: 'conversion',
        description: 'Cliente convertido.',
        metadata: { lead_id: 'lead-1' },
        created_at: '2026-11-23T12:00:00Z',
      })],
      error: null,
    })
    supabase.queue('lead_client_links', { data: [makeLink()], error: null })
    supabase.queue('leads', { data: { id: 'lead-1', name: 'Lead Um' }, error: null })
    supabase.queue('lead_activities', {
      data: [
        makeLeadActivity({ id: 'conversao-lead', type: 'conversao', description: 'Lead convertido.' }),
        makeLeadActivity({ id: 'mensagem-lead', description: 'Mensagem após a conversão.' }),
      ],
      error: null,
    })

    const detail = await getClient(client.id)

    expect(detail?.history).toEqual([
      {
        id: 'mensagem-lead', type: 'mensagem', description: 'Mensagem após a conversão.',
        created_at: '2026-11-24T12:00:00Z', source: 'lead', leadName: 'Lead Um',
      },
      {
        id: 'client-activity-1', type: 'conversion', description: 'Cliente convertido.',
        created_at: '2026-11-23T12:00:00Z', source: 'client',
      },
    ])
  })

  it('createClient envia creation_key e contrato inicial', async () => {
    const client = makeClient()
    rpc.mockResolvedValue({ data: { client }, error: null })
    const input: CreateClientInput = {
      ...makeClientWrite({ name: ' Empresa A ', responsible_name: ' Ana Responsável ' }),
      creationKey: client.creation_key,
      initialContract: makeInitialContract({ service: ' Site ' }),
    }

    const result = await createClient(input)

    expect(rpc).toHaveBeenCalledWith('create_client', {
      p_payload: {
        name: 'Empresa A',
        responsible_name: 'Ana Responsável',
        phone: null,
        whatsapp: null,
        email: null,
        cnpj: null,
        website: null,
        instagram: null,
        address: null,
        city: null,
        district: null,
        zip_code: null,
        state: null,
        niche: null,
        status: 'active',
        notes: null,
        creation_key: client.creation_key,
        service: 'Site',
        total_value: '1234.56',
        contracted_at: '2026-11-25',
        due_date: null,
        payment_method: 'pix',
        payment_terms: 'À vista',
        contract_notes: null,
      },
    })
    expect(result).toEqual(client)
  })

  it('createClient traduz CLIENT_CNPJ_DUPLICATE', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'CLIENT_CNPJ_DUPLICATE:Empresa Existente' },
    })

    await expect(createClient({
      ...makeClientWrite({ cnpj: '12.345.678/0001-95' }),
      creationKey: '00000000-0000-0000-0000-000000000502',
      initialContract: makeInitialContract(),
    })).rejects.toThrow('Já existe um cliente com este CNPJ: Empresa Existente.')
  })

  it('updateClient envia p_client_id e payload completo', async () => {
    const client = makeClient({ name: 'Empresa Editada' })
    rpc.mockResolvedValue({ data: { client }, error: null })

    const result = await updateClient(client.id, {
      ...makeClientWrite({ name: ' Empresa Editada ' }),
      contractId: 'contract-1',
      initialContract: makeInitialContract({ service: ' Consultoria ' }),
    })

    expect(rpc).toHaveBeenCalledWith('update_client', {
      p_client_id: 'client-1',
      p_payload: {
        name: 'Empresa Editada',
        responsible_name: null,
        phone: null,
        whatsapp: null,
        email: null,
        cnpj: null,
        website: null,
        instagram: null,
        address: null,
        city: null,
        district: null,
        zip_code: null,
        state: null,
        niche: null,
        status: 'active',
        notes: null,
        contract_id: 'contract-1',
        service: 'Consultoria',
        total_value: '1234.56',
        contracted_at: '2026-11-25',
        due_date: null,
        payment_method: 'pix',
        payment_terms: 'À vista',
        contract_notes: null,
      },
    })
    expect(rpc.mock.calls[0][1].p_payload).not.toHaveProperty('creation_key')
    expect(result).toEqual(client)
  })

  it('archiveClient usa a RPC e não chama delete', async () => {
    const client = makeClient({ status: 'inactive', archived_at: '2026-11-25T12:00:00Z' })
    rpc.mockResolvedValue({ data: client, error: null })

    const result = await archiveClient(client.id)

    expect(rpc).toHaveBeenCalledWith('archive_client', { p_client_id: 'client-1' })
    expect(result).toEqual(client)
    expect(supabase.fromCalls).toEqual([])
    expect(supabase.mutations).toEqual([])
  })

  it('findClientDuplicateCandidates usa cnpj_digits quando há CNPJ', async () => {
    const existing = makeClient()
    supabase.queue('clients', { data: [existing], error: null })

    const result = await findClientDuplicateCandidates({
      name: '', city: null, phone: null, whatsapp: null, cnpj: '12.345.678/0001-95',
    })

    expect(result).toEqual([existing])
    expect(supabase.calls[0].or).toBe('cnpj_digits.eq."12345678000195"')
    expect(supabase.calls[0].ilike).toEqual([])
    expect(supabase.calls[0].order).toEqual([['id', { ascending: true }]])
    expect(supabase.calls[0].limit).toBe(100)
  })

  it('findClientDuplicateCandidates não usa OR com nome digitado', async () => {
    const existing = makeClient()
    supabase.queue('clients', { data: [existing], error: null })

    const result = await findClientDuplicateCandidates({
      name: 'empresa a', city: 'são paulo', phone: null, whatsapp: null, cnpj: null,
    })

    expect(result).toEqual([existing])
    expect(supabase.calls).toHaveLength(1)
    expect(supabase.calls[0].or).toBeNull()
    expect(supabase.calls[0].ilike).toEqual([['name', 'empresa a'], ['city', 'são paulo']])
    expect(supabase.calls[0].order).toEqual([['id', { ascending: true }]])
    expect(supabase.calls[0].limit).toBe(100)
  })

  it('getLeadClientLink retorna null quando maybeSingle não encontra', async () => {
    supabase.queue('lead_client_links', { data: null, error: null })

    const result = await getLeadClientLink('missing-lead')

    expect(result).toBeNull()
    expect(supabase.calls[0]).toMatchObject({
      table: 'lead_client_links',
      select: '*',
      eq: [['lead_id', 'missing-lead']],
      maybeSingle: true,
    })
  })

  it('listLeadClientLinks retorna os vínculos ordenados pela conversão mais recente', async () => {
    const links = [
      makeLink({ id: 'link-1', converted_at: '2026-11-25T12:00:00Z' }),
      makeLink({ id: 'link-2', converted_at: '2026-11-24T12:00:00Z' }),
    ]
    supabase.queue('lead_client_links', { data: links, error: null })

    const result = await listLeadClientLinks()

    expect(result).toEqual(links)
    expect(supabase.calls).toHaveLength(1)
    expect(supabase.calls[0]).toMatchObject({
      table: 'lead_client_links',
      select: '*',
      order: [['converted_at', { ascending: false }], ['id', { ascending: true }]],
      range: [0, 999],
      maybeSingle: false,
    })
  })

  it('listLeadClientLinks pagina além do limite do PostgREST até a última página', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => makeLink({ id: `link-${index}` }))
    const lastPage = [makeLink({ id: 'link-1000' })]
    supabase.queue('lead_client_links', { data: firstPage, error: null })
    supabase.queue('lead_client_links', { data: lastPage, error: null })

    const result = await listLeadClientLinks()

    expect(result).toEqual([...firstPage, ...lastPage])
    expect(supabase.calls).toHaveLength(2)
    expect(supabase.calls.map((call) => call.range)).toEqual([[0, 999], [1000, 1999]])
  })

  it('countConvertedLeads usa count exact com head', async () => {
    supabase.queue('lead_client_links', { data: null, error: null, count: 37 })

    const result = await countConvertedLeads()

    expect(result).toBe(37)
    expect(supabase.fromCalls).toEqual(['lead_client_links'])
    expect(supabase.calls).toHaveLength(1)
    expect(supabase.calls[0]).toMatchObject({
      table: 'lead_client_links',
      select: 'id',
      selectOptions: { count: 'exact', head: true },
      maybeSingle: false,
    })
  })
})
```

Também escreva os testes de conversão antes de alterar o catálogo ou os componentes. O teste do diálogo é uma guarda: passa antes de `conversao` entrar no catálogo e deve falhar depois dessa inclusão, até que a exclusão manual seja aplicada.

```ts
// src/types/activity.test.ts
import { describe, expect, it } from 'vitest'
import { ACTIVITY_LABELS, ACTIVITY_TYPES } from './activity'

describe('activity types', () => {
  it('inclui conversão como atividade automática rotulada em pt-BR', () => {
    expect(ACTIVITY_TYPES).toContain('conversao')
    expect(ACTIVITY_LABELS.conversao).toBe('Conversão em cliente')
  })

  it('não afirma envio quando o WhatsApp foi apenas aberto', () => {
    expect(ACTIVITY_LABELS.mensagem).toBe('Mensagem registrada')
  })

  it('fornece rótulo não vazio para todo tipo aceito', () => {
    for (const type of ACTIVITY_TYPES) {
      expect(ACTIVITY_LABELS[type].trim().length).toBeGreaterThan(0)
    }
  })
})
```

```tsx
// src/components/leads/LeadTimeline.test.tsx
// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Activity } from '../../types/activity'

const { listActivities } = vi.hoisted(() => ({ listActivities: vi.fn() }))
vi.mock('../../services/activityService', () => ({ listActivities }))

import { LeadTimeline } from './LeadTimeline'

afterEach(cleanup)

describe('LeadTimeline — conversão', () => {
  it('renderiza conversão com rótulo e ícone próprios', async () => {
    const activity: Activity = {
      id: 'activity-1', lead_id: 'lead-1', owner_id: 'owner-1', type: 'conversao',
      description: 'Lead convertido em cliente.', user_id: null,
      created_at: '2026-11-25T12:00:00Z',
    }
    listActivities.mockResolvedValue([activity])
    render(<LeadTimeline leadId="lead-1" refreshKey={0} />)

    const list = await screen.findByRole('list', { name: 'Atividades do lead' })
    const item = within(list).getByRole('listitem')
    expect(item.textContent).toContain('Conversão em cliente')
    expect(item.textContent).toContain('Lead convertido em cliente.')
    expect(item.querySelector('svg.lucide-user-check')).not.toBeNull()
  })
})
```

```tsx
// src/components/leads/ContactDialog.test.tsx
// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../services/activityService', () => ({ addActivity: vi.fn() }))
vi.mock('../../services/leadService', () => ({ setLeadStatus: vi.fn() }))
vi.mock('../../hooks/useToast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

import { ContactDialog } from './ContactDialog'

afterEach(cleanup)

describe('ContactDialog — atividades automáticas', () => {
  it('não oferece conversão como atividade manual', () => {
    render(
      <ContactDialog
        open
        leadId="lead-1"
        currentStatus="novo"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )
    const select = screen.getByLabelText('Tipo de atividade')
    const values = within(select).getAllByRole('option').map((option) => (option as HTMLOptionElement).value)
    expect(values).toContain('primeiro_contato')
    expect(values).not.toContain('conversao')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/services/clientService.test.ts src/types/activity.test.ts src/components/leads/LeadTimeline.test.tsx src/components/leads/ContactDialog.test.tsx`
Expected: FAIL before implementation. On a clean Task 6 checkout the service module is missing and the conversion type/timeline assertions fail; the dialog guard may pass until `conversao` is added to the catalog. Failures must identify missing behavior, not errors in the fake query chain.

- [ ] **Step 3: Implement the service and conversion-type prerequisites**

Substitua `src/types/activity.ts` pelo arquivo abaixo. O valor já é persistido pela migration 0006 e deve existir no catálogo antes de o serviço combinar o histórico.

```ts
// src/types/activity.ts
export const ACTIVITY_TYPES = [
  'primeiro_contato', 'mensagem', 'ligacao', 'resposta', 'reuniao',
  'proposta', 'mudanca_status', 'observacao', 'follow_up', 'conversao', 'outro',
] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  primeiro_contato: 'Primeiro contato',
  mensagem: 'Mensagem registrada',
  ligacao: 'Ligação realizada',
  resposta: 'Resposta recebida',
  reuniao: 'Reunião',
  proposta: 'Envio de proposta',
  mudanca_status: 'Mudança de status',
  observacao: 'Observação',
  follow_up: 'Follow-up',
  conversao: 'Conversão em cliente',
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

Em `src/components/leads/LeadTimeline.tsx`, acrescente `conversao: UserCheck` ao mapa `icons`, imediatamente após `follow_up`. O import de `UserCheck` já existe.

Depois de incluir `conversao` no catálogo, execute `npm test -- src/components/leads/ContactDialog.test.tsx` e confirme RED porque a opção automática aparece no seletor. Em seguida, altere o filtro de `src/components/leads/ContactDialog.tsx` para:

```tsx
.filter((activityType) => (
  activityType !== 'mudanca_status'
  && activityType !== 'follow_up'
  && activityType !== 'conversao'
))
```

Por fim, crie o serviço abaixo. Não altere o comparador decrescente do histórico: a fixture de conversão já foi corrigida para ocorrer antes da mensagem.

```ts
// src/services/clientService.ts
import { requireSupabase, throwDbError } from '../lib/db'
import { fromMoneyDecimal, toMoneyDecimal } from '../lib/money'
import { normalizePhoneForComparison } from '../lib/whatsapp'
import { onlyDigits } from '../lib/format'
import type { Activity } from '../types/activity'
import type { Contract } from '../types/contract'
import type {
  Client, ClientActivity, ClientDetail, ClientHistoryEntry, ClientWrite,
  ConversionInput, ConversionResult, CreateClientInput, InitialContractInput,
  LeadClientLink, UpdateClientInput,
} from '../types/client'
import type { Project } from '../types/project'

export interface ClientFilters {
  search: string
  status: string
  city: string
}

export type ClientSort = 'name_asc' | 'name_desc' | 'created_desc' | 'updated_desc'

export interface ClientDuplicateInput {
  name: string
  city: string | null
  phone: string | null
  whatsapp: string | null
  cnpj: string | null
}

interface ContractRow extends Omit<Contract, 'total_value_cents'> {
  total_value: string | number
}

interface ProjectRow extends Omit<Project, 'contracted_value_cents'> {
  contracted_value: string | number
}

function toContract(row: ContractRow): Contract {
  const { total_value, ...contract } = row
  return { ...contract, total_value_cents: fromMoneyDecimal(total_value) }
}

function toProject(row: ProjectRow): Project {
  const { contracted_value, ...project } = row
  return { ...project, contracted_value_cents: fromMoneyDecimal(contracted_value) }
}

function clientPayload(input: ClientWrite) {
  return {
    name: input.name.trim(),
    responsible_name: input.responsible_name?.trim() || null,
    phone: input.phone?.trim() || null,
    whatsapp: input.whatsapp?.trim() || null,
    email: input.email?.trim() || null,
    cnpj: input.cnpj?.trim() || null,
    website: input.website?.trim() || null,
    instagram: input.instagram?.trim() || null,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    district: input.district?.trim() || null,
    zip_code: input.zip_code?.trim() || null,
    state: input.state?.trim() || null,
    niche: input.niche?.trim() || null,
    status: input.status,
    notes: input.notes?.trim() || null,
  }
}

function contractPayload(input: InitialContractInput) {
  return {
    service: input.service.trim(),
    total_value: toMoneyDecimal(input.totalValueCents),
    contracted_at: input.contractedAt,
    due_date: input.dueDate,
    payment_method: input.paymentMethod.trim() || null,
    payment_terms: input.paymentTerms.trim() || null,
    contract_notes: input.notes.trim() || null,
  }
}

function parseClient(data: unknown): Client {
  const payload = Array.isArray(data) ? data[0] : data
  const candidate = payload as { client?: unknown } | null
  const client = (candidate?.client ?? payload) as Client | undefined
  if (!client?.id) throw new Error('Não foi possível salvar o cliente.')
  return client
}

function parseConversion(data: unknown): ConversionResult {
  const payload = Array.isArray(data) ? data[0] : data
  if (!payload || typeof payload !== 'object') throw new Error('Não foi possível converter o lead.')
  const result = payload as ConversionResult
  if (!result.client_id || !result.link_id || !result.contract_id) {
    throw new Error('Não foi possível converter o lead.')
  }
  return result
}

export async function listClients(
  filters: ClientFilters,
  sort: ClientSort,
  page: number,
  pageSize = 20,
): Promise<{ clients: Client[]; total: number }> {
  const client = requireSupabase()
  let query = client.from('clients').select('*', { count: 'exact' })
  if (filters.search.trim()) {
    const search = filters.search.trim().replace(/[%_]/g, '')
    const digits = search.replace(/\D/g, '')
    const textFilters = ['name', 'responsible_name', 'email']
      .map((column) => `${column}.ilike.${JSON.stringify(`%${search}%`)}`)
    query = query.or(digits.length === 14
      ? [`cnpj_digits.eq.${JSON.stringify(digits)}`, ...textFilters].join(',')
      : textFilters.join(','))
  }
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.city.trim()) query = query.ilike('city', `%${filters.city.trim()}%`)
  const sortColumn = sort.startsWith('name') ? 'name' : sort.startsWith('updated') ? 'updated_at' : 'created_at'
  const ascending = sort.endsWith('_asc')
  query = query.order(sortColumn, { ascending }).order('id', { ascending })
  const from = page * pageSize
  const { data, error, count } = await query.range(from, from + pageSize - 1)
  throwDbError(error)
  return { clients: (data ?? []) as Client[], total: count ?? 0 }
}

export async function getClient(id: string): Promise<ClientDetail | null> {
  const client = requireSupabase()
  const { data, error } = await client.from('clients').select('*').eq('id', id).maybeSingle()
  throwDbError(error)
  if (!data) return null
  const record = data as Client

  const [contractsResult, projectsResult, activitiesResult, linksResult] = await Promise.all([
    client.from('contracts').select('*').eq('client_id', id).order('contracted_at', { ascending: false }),
    client.from('projects').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    client.from('client_activities').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    client.from('lead_client_links').select('*').eq('client_id', id).order('converted_at', { ascending: false }),
  ])
  throwDbError(contractsResult.error)
  throwDbError(projectsResult.error)
  throwDbError(activitiesResult.error)
  throwDbError(linksResult.error)

  const contracts = (contractsResult.data ?? []) as ContractRow[]
  const projects = (projectsResult.data ?? []) as ProjectRow[]
  const activities = (activitiesResult.data ?? []) as ClientActivity[]
  const links = (linksResult.data ?? []) as LeadClientLink[]
  const linkedLeads: ClientDetail['linkedLeads'] = []
  const leadActivities: Activity[] = []

  for (const link of links) {
    const leadResult = await client.from('leads').select('id,name').eq('id', link.lead_id).maybeSingle()
    throwDbError(leadResult.error)
    if (!leadResult.data) continue
    linkedLeads.push({ leadId: link.lead_id, leadName: leadResult.data.name })
    const activityResult = await client.from('lead_activities').select('*').eq('lead_id', link.lead_id).order('created_at', { ascending: false })
    throwDbError(activityResult.error)
    leadActivities.push(...((activityResult.data ?? []) as Activity[]))
  }

  const leadNames = new Map(linkedLeads.map((lead) => [lead.leadId, lead.leadName]))
  const conversionLeadIds = new Set(activities
    .filter((activity) => activity.type === 'conversion' && typeof activity.metadata.lead_id === 'string')
    .map((activity) => activity.metadata.lead_id as string))
  const uniqueLeadActivities = leadActivities.filter((activity) => (
    activity.type !== 'conversao' || !conversionLeadIds.has(activity.lead_id)
  ))
  const history: ClientHistoryEntry[] = [
    ...activities.map((activity) => ({
      id: activity.id, type: activity.type, description: activity.description,
      created_at: activity.created_at, source: 'client' as const,
    })),
    ...uniqueLeadActivities.map((activity) => ({
      id: activity.id, type: activity.type, description: activity.description,
      created_at: activity.created_at, source: 'lead' as const,
      leadName: leadNames.get(activity.lead_id),
    })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at))

  return {
    client: record,
    contracts: contracts.map(toContract),
    projects: projects.map(toProject),
    activities,
    linkedLeads,
    history,
  }
}

export async function createClient(input: CreateClientInput): Promise<Client> {
  const { data, error } = await requireSupabase().rpc('create_client', {
    p_payload: { ...clientPayload(input), creation_key: input.creationKey, ...contractPayload(input.initialContract) },
  })
  if (error?.message.includes('CLIENT_CNPJ_DUPLICATE:')) {
    throw new Error(`Já existe um cliente com este CNPJ: ${error.message.split(':')[1]}.`)
  }
  throwDbError(error)
  return parseClient(data)
}

export async function updateClient(id: string, input: UpdateClientInput): Promise<Client> {
  const { data, error } = await requireSupabase().rpc('update_client', {
    p_client_id: id,
    p_payload: { ...clientPayload(input), contract_id: input.contractId, ...contractPayload(input.initialContract) },
  })
  if (error?.message.includes('CLIENT_CNPJ_DUPLICATE:')) {
    throw new Error(`Já existe um cliente com este CNPJ: ${error.message.split(':')[1]}.`)
  }
  throwDbError(error)
  return parseClient(data)
}

export async function archiveClient(id: string): Promise<Client> {
  const { data, error } = await requireSupabase().rpc('archive_client', { p_client_id: id })
  throwDbError(error)
  return parseClient(data)
}

export async function findClientDuplicateCandidates(
  input: ClientDuplicateInput,
  excludeId?: string,
): Promise<Client[]> {
  const client = requireSupabase()
  const candidates = new Map<string, Client>()
  const cnpj = onlyDigits(input.cnpj ?? '') || null
  const phone = normalizePhoneForComparison(input.phone ?? '')
  const whatsapp = normalizePhoneForComparison(input.whatsapp ?? '')
  const identifierFilters = new Set<string>()
  const addIdentifierFilter = (column: string, value: string | null) => {
    if (value) identifierFilters.add(`${column}.eq.${JSON.stringify(value)}`)
  }
  addIdentifierFilter('cnpj_digits', cnpj)
  addIdentifierFilter('phone_canonical', phone)
  addIdentifierFilter('whatsapp_canonical', whatsapp)

  const merge = (rows: Client[]) => {
    for (const row of rows) if (row.id !== excludeId) candidates.set(row.id, row)
  }
  if (identifierFilters.size > 0) {
    const { data, error } = await client.from('clients').select('*')
      .or([...identifierFilters].join(',')).order('id', { ascending: true }).limit(100)
    throwDbError(error)
    merge((data ?? []) as Client[])
  }

  const name = (input.name ?? '').trim().toLowerCase()
  const city = (input.city ?? '').trim().toLowerCase()
  if (name && city) {
    const { data, error } = await client.from('clients').select('*')
      .ilike('name', name.replace(/[\\%_]/g, '\\$&'))
      .ilike('city', city.replace(/[\\%_]/g, '\\$&'))
      .order('id', { ascending: true }).limit(100)
    throwDbError(error)
    merge((data ?? []) as Client[])
  }

  return [...candidates.values()].filter((row) => {
    if (cnpj && onlyDigits(row.cnpj ?? '') === cnpj) return true
    if (phone && [row.phone_canonical, row.whatsapp_canonical].includes(phone)) return true
    if (whatsapp && [row.phone_canonical, row.whatsapp_canonical].includes(whatsapp)) return true
    return name !== '' && city !== ''
      && row.name.trim().toLowerCase() === name
      && (row.city ?? '').trim().toLowerCase() === city
  })
}

export async function getLeadClientLink(leadId: string): Promise<LeadClientLink | null> {
  const { data, error } = await requireSupabase().from('lead_client_links').select('*').eq('lead_id', leadId).maybeSingle()
  throwDbError(error)
  return (data as LeadClientLink | null) ?? null
}

export async function listLeadClientLinks(): Promise<LeadClientLink[]> {
  const links: LeadClientLink[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await requireSupabase().from('lead_client_links').select('*')
      .order('converted_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    throwDbError(error)
    const page = (data ?? []) as LeadClientLink[]
    links.push(...page)
    if (page.length < pageSize) break
  }
  return links
}

export async function countConvertedLeads(): Promise<number> {
  const { count, error } = await requireSupabase().from('lead_client_links').select('id', { count: 'exact', head: true })
  throwDbError(error)
  return count ?? 0
}

export async function convertLeadToClient(leadId: string, input: ConversionInput): Promise<ConversionResult> {
  const { data, error } = await requireSupabase().rpc('convert_lead_to_client', {
    p_lead_id: leadId,
    p_service: input.service.trim(),
    p_contracted_value: toMoneyDecimal(input.contractedValueCents),
    p_contracted_at: input.contractedAt,
    p_payment_method: input.paymentMethod.trim() || null,
    p_payment_terms: input.paymentTerms.trim() || null,
    p_notes: input.notes.trim() || null,
    p_project_name: input.project?.name.trim() || null,
    p_project_start_date: input.project?.startDate || null,
    p_project_due_date: input.project?.dueDate || null,
  })
  throwDbError(error)
  return parseConversion(data)
}
```

- [ ] **Step 4: Run all focused tests and build**

Run: `npm test -- src/services/clientService.test.ts src/types/activity.test.ts src/components/leads/LeadTimeline.test.tsx src/components/leads/ContactDialog.test.tsx && npm run build`
Expected: all 20 service tests plus the conversion type/timeline/dialog regressions PASS and build exit 0. The service suite includes the two conversion tests plus the 18 query, normalization, mutation and duplicate-detection contracts written in Step 1.

- [ ] **Step 5: Commit**

```bash
git add src/services/clientService.ts src/services/clientService.test.ts src/types/activity.ts src/types/activity.test.ts src/components/leads/LeadTimeline.tsx src/components/leads/LeadTimeline.test.tsx src/components/leads/ContactDialog.tsx src/components/leads/ContactDialog.test.tsx
git commit -m "feat: adicionar servico de clientes"
```

---

### Task 7: Criar o diálogo de conversão

**Files:**
- Create: `src/components/leads/ConversionDialog.tsx`
- Create: `src/components/leads/ConversionDialog.test.tsx`

**Interfaces:**
- Consumes: `convertLeadToClient`, `ConversionInput`, `ConversionResult`, `parseMoneyInput`; real `Modal`, `Input`, `Select`, `Textarea` and `Button` props.
- Produces:

```ts
export interface ConversionDialogProps {
  open: boolean
  lead: Lead
  existingClientId: string | null
  onClose: () => void
  onConverted: (result: ConversionResult) => void
}
```

- [ ] **Step 1: Write failing UI tests**

```tsx
// @vitest-environment jsdom
// src/components/leads/ConversionDialog.test.tsx
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyLeadDraft, type Lead } from '../../types/lead'
import type { ConversionResult } from '../../types/client'
import { ConversionDialog } from './ConversionDialog'

const { convertLeadToClient, toast } = vi.hoisted(() => ({
  convertLeadToClient: vi.fn(),
  toast: vi.fn(),
}))
vi.mock('../../services/clientService', () => ({ convertLeadToClient }))
vi.mock('../../hooks/useToast', () => ({ useToast: () => ({ toast }) }))

const lead: Lead = {
  ...emptyLeadDraft(),
  id: 'lead-1',
  owner_id: 'owner-1',
  name: 'Empresa Teste',
  source: 'Indicação',
  status: 'negociando',
  created_at: '2026-11-25T12:00:00Z',
  updated_at: '2026-11-25T12:00:00Z',
}

const validResult: ConversionResult = {
  client_id: 'client-1',
  link_id: 'link-1',
  contract_id: 'contract-1',
  project_id: 'project-1',
  already_existed: false,
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function renderDialog(existingClientId: string | null = null) {
  const onClose = vi.fn()
  const onConverted = vi.fn()
  const view = render(
    <ConversionDialog
      open
      lead={lead}
      existingClientId={existingClientId}
      onClose={onClose}
      onConverted={onConverted}
    />,
  )
  return { ...view, onClose, onConverted }
}

function fillConversion() {
  fireEvent.change(screen.getByLabelText('Serviço contratado *'), { target: { value: 'Site institucional' } })
  fireEvent.change(screen.getByLabelText('Valor contratado *'), { target: { value: '1.234,56' } })
  fireEvent.change(screen.getByLabelText('Data da contratação *'), { target: { value: '2026-11-25' } })
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('ConversionDialog', () => {
  beforeEach(() => {
    convertLeadToClient.mockReset()
    toast.mockReset()
  })

  it('usa a data local atual como padrão da contratação', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 25, 23, 45))
    renderDialog()

    expect((screen.getByLabelText('Data da contratação *') as HTMLInputElement).value)
      .toBe('2026-11-25')
  })

  it('bloqueia serviço, valor e data vazios sem chamar a RPC', async () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText('Data da contratação *'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conversão' }))

    expect((await screen.findByText('Informe o serviço contratado.')).textContent)
      .toBe('Informe o serviço contratado.')
    expect(screen.getByText('Informe um valor contratado válido.').textContent)
      .toBe('Informe um valor contratado válido.')
    expect(screen.getByText('Informe a data da contratação.').textContent)
      .toBe('Informe a data da contratação.')
    expect(convertLeadToClient).not.toHaveBeenCalled()
  })

  it('rejeita valor negativo e prazo do projeto anterior ao início', async () => {
    renderDialog()
    fillConversion()
    fireEvent.change(screen.getByLabelText('Valor contratado *'), { target: { value: '-1,00' } })
    fireEvent.click(screen.getByLabelText('Criar projeto inicial'))
    fireEvent.change(screen.getByLabelText('Nome do projeto *'), { target: { value: 'Site da Empresa' } })
    fireEvent.change(screen.getByLabelText('Início do projeto'), { target: { value: '2026-11-26' } })
    fireEvent.change(screen.getByLabelText('Prazo do projeto'), { target: { value: '2026-11-25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conversão' }))

    expect((await screen.findByText('Informe um valor contratado válido.')).textContent)
      .toBe('Informe um valor contratado válido.')
    expect(screen.getByText('O prazo do projeto não pode anteceder o início.').textContent)
      .toBe('O prazo do projeto não pode anteceder o início.')
    expect(convertLeadToClient).not.toHaveBeenCalled()
  })

  it('converte com centavos e projeto opcional sem alterar o lead localmente', async () => {
    convertLeadToClient.mockResolvedValue(validResult)
    const { onConverted } = renderDialog()

    fillConversion()
    fireEvent.change(screen.getByLabelText('Forma de pagamento'), { target: { value: 'pix' } })
    fireEvent.change(screen.getByLabelText('Condições de pagamento'), { target: { value: '50% na assinatura' } })
    fireEvent.change(screen.getByLabelText('Observações da conversão'), { target: { value: 'Contrato confirmado.' } })
    fireEvent.click(screen.getByLabelText('Criar projeto inicial'))
    fireEvent.change(screen.getByLabelText('Nome do projeto *'), { target: { value: 'Site da Empresa' } })
    fireEvent.change(screen.getByLabelText('Início do projeto'), { target: { value: '2026-11-26' } })
    fireEvent.change(screen.getByLabelText('Prazo do projeto'), { target: { value: '2026-12-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conversão' }))

    await waitFor(() => expect(onConverted).toHaveBeenCalledWith(validResult))
    expect(convertLeadToClient).toHaveBeenCalledWith('lead-1', {
      service: 'Site institucional',
      contractedValueCents: 123456,
      contractedAt: '2026-11-25',
      paymentMethod: 'pix',
      paymentTerms: '50% na assinatura',
      notes: 'Contrato confirmado.',
      project: {
        name: 'Site da Empresa',
        startDate: '2026-11-26',
        dueDate: '2026-12-10',
      },
    })
    expect(lead.status).toBe('negociando')
  })

  it('aceita valor zero e envia projeto nulo quando a opção não é marcada', async () => {
    const result = { ...validResult, project_id: null }
    convertLeadToClient.mockResolvedValue(result)
    const { onConverted } = renderDialog()
    fireEvent.change(screen.getByLabelText('Serviço contratado *'), { target: { value: 'Consultoria' } })
    fireEvent.change(screen.getByLabelText('Valor contratado *'), { target: { value: '0,00' } })
    fireEvent.change(screen.getByLabelText('Data da contratação *'), { target: { value: '2026-11-25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conversão' }))

    await waitFor(() => expect(onConverted).toHaveBeenCalledWith(result))
    expect(convertLeadToClient).toHaveBeenCalledWith('lead-1', {
      service: 'Consultoria',
      contractedValueCents: 0,
      contractedAt: '2026-11-25',
      paymentMethod: '',
      paymentTerms: '',
      notes: '',
      project: null,
    })
  })

  it('mostra a mensagem exata quando a RPC retorna uma conversão já existente', async () => {
    const existingResult = { ...validResult, already_existed: true }
    convertLeadToClient.mockResolvedValue(existingResult)
    const { onConverted } = renderDialog()
    fillConversion()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conversão' }))

    await waitFor(() => expect(toast).toHaveBeenCalledWith(
      'Conversão já existente. Os dados anteriores foram preservados.',
    ))
    expect(onConverted).toHaveBeenCalledWith(existingResult)
  })

  it('não confirma um resultado inválido retornado pelo serviço', async () => {
    convertLeadToClient.mockResolvedValue({ ...validResult, link_id: '' })
    const { onConverted } = renderDialog()
    fillConversion()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conversão' }))

    expect((await screen.findByText('Não foi possível converter o lead.')).textContent)
      .toBe('Não foi possível converter o lead.')
    expect(onConverted).not.toHaveBeenCalled()
  })

  it('desabilita campos e fechamento e impede envio duplicado durante o salvamento', async () => {
    const pending = deferred<ConversionResult>()
    convertLeadToClient.mockReturnValue(pending.promise)
    const { onClose, onConverted } = renderDialog()
    fillConversion()
    fireEvent.click(screen.getByLabelText('Criar projeto inicial'))
    fireEvent.change(screen.getByLabelText('Nome do projeto *'), { target: { value: 'Site da Empresa' } })
    const submit = screen.getByRole('button', { name: 'Confirmar conversão' })
    fireEvent.click(submit)
    fireEvent.click(submit)

    await waitFor(() => expect(convertLeadToClient).toHaveBeenCalledTimes(1))
    for (const label of [
      'Serviço contratado *', 'Valor contratado *', 'Data da contratação *',
      'Forma de pagamento', 'Condições de pagamento', 'Observações da conversão',
      'Criar projeto inicial', 'Nome do projeto *', 'Início do projeto', 'Prazo do projeto',
    ]) {
      expect((screen.getByLabelText(label) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).disabled)
        .toBe(true)
    }
    expect((screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true)
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Fechar' })).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).not.toHaveBeenCalled()
    expect(convertLeadToClient).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve(validResult)
      await pending.promise
    })
    await waitFor(() => expect(onConverted).toHaveBeenCalledWith(validResult))
  })

  it('preserva os dados digitados após falha e permite tentar novamente', async () => {
    convertLeadToClient.mockRejectedValueOnce(new Error('Falha temporária.')).mockResolvedValueOnce(validResult)
    const { onConverted } = renderDialog()
    fillConversion()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conversão' }))

    expect((await screen.findByText('Falha temporária.')).textContent).toBe('Falha temporária.')
    expect((screen.getByLabelText('Serviço contratado *') as HTMLInputElement).value)
      .toBe('Site institucional')
    expect((screen.getByLabelText('Valor contratado *') as HTMLInputElement).value).toBe('1.234,56')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conversão' }))
    await waitFor(() => expect(onConverted).toHaveBeenCalledWith(validResult))
    expect(convertLeadToClient).toHaveBeenCalledTimes(2)
  })

  it('descarta a resposta depois do unmount', async () => {
    const pending = deferred<ConversionResult>()
    convertLeadToClient.mockReturnValue(pending.promise)
    const { unmount, onConverted } = renderDialog()
    fillConversion()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conversão' }))
    await waitFor(() => expect(convertLeadToClient).toHaveBeenCalledTimes(1))
    unmount()

    await act(async () => {
      pending.resolve(validResult)
      await pending.promise
    })
    expect(onConverted).not.toHaveBeenCalled()
  })

  it('mostra vínculo existente e não permite nova conversão', () => {
    const { onClose } = renderDialog('client-1')
    expect(screen.getByText('Este lead já está vinculado a um cliente.').textContent)
      .toBe('Este lead já está vinculado a um cliente.')
    expect(screen.queryByRole('button', { name: 'Confirmar conversão' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/leads/ConversionDialog.test.tsx`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement the dialog**

```tsx
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
```

- [ ] **Step 4: Run tests and build**

Run: `npm test -- src/components/leads/ConversionDialog.test.tsx && npm run build`
Expected: PASS and build exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/leads/ConversionDialog.tsx src/components/leads/ConversionDialog.test.tsx
git commit -m "feat: adicionar dialogo de conversao de lead"
```

---

### Task 8: Criar formulário e página de novo cliente

**Files:**
- Create: `src/components/clients/ClientForm.tsx`
- Create: `src/components/clients/ClientForm.test.tsx`
- Create: `src/pages/ClientNewPage.tsx`

**Interfaces:**
- Consumes: `createClient`, `updateClient`, `findClientDuplicateCandidates`, `InitialContractInput`, `ClientWrite`, `Client`, `Contract`; imports client types from `src/types/client.ts` and `Contract` from `src/types/contract.ts`.
- Produces:

```ts
interface ClientFormBaseProps {
  onCancel: () => void
  onSaved: (client: Client) => void
}

export type ClientFormProps = ClientFormBaseProps & (
  | { mode: 'create'; client?: never; contract?: never }
  | { mode: 'edit'; client: Client; contract: Contract }
)
```

- [ ] **Step 1: Write failing form tests**

```tsx
// @vitest-environment jsdom
// src/components/clients/ClientForm.test.tsx
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Client } from '../../types/client'
import type { Contract } from '../../types/contract'
import { ClientForm } from './ClientForm'
import { ClientNewPage } from '../../pages/ClientNewPage'

const { createClient, updateClient, findClientDuplicateCandidates, toast } = vi.hoisted(() => ({
  createClient: vi.fn(),
  updateClient: vi.fn(),
  findClientDuplicateCandidates: vi.fn(),
  toast: vi.fn(),
}))
vi.mock('../../services/clientService', () => ({
  createClient, updateClient, findClientDuplicateCandidates,
}))
vi.mock('../../hooks/useToast', () => ({ useToast: () => ({ toast }) }))

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    owner_id: 'owner-1',
    creation_key: '00000000-0000-4000-8000-000000000001',
    name: 'Empresa Nova',
    responsible_name: null,
    phone: null,
    whatsapp: null,
    email: null,
    cnpj: null,
    cnpj_digits: null,
    phone_canonical: null,
    whatsapp_canonical: null,
    website: null,
    instagram: null,
    address: null,
    city: null,
    district: null,
    zip_code: null,
    state: null,
    niche: null,
    notes: null,
    status: 'active',
    source: 'manual',
    converted_at: null,
    archived_at: null,
    created_at: '2026-11-25T12:00:00Z',
    updated_at: '2026-11-25T12:00:00Z',
    ...overrides,
  }
}

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 'contract-1',
    owner_id: 'owner-1',
    client_id: 'client-1',
    source_link_id: null,
    creation_key: null,
    service: 'Site',
    total_value_cents: 100000,
    contracted_at: '2026-11-20',
    due_date: '2026-12-01',
    payment_method: 'pix',
    payment_terms: '50% na assinatura',
    status: 'active',
    notes: 'Observações do contrato',
    cancelled_at: null,
    created_at: '2026-11-20T12:00:00Z',
    updated_at: '2026-11-20T12:00:00Z',
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Nome do cliente *'), { target: { value: 'Empresa Nova' } })
  fireEvent.change(screen.getByLabelText('Serviço contratado *'), { target: { value: 'Site' } })
  fireEvent.change(screen.getByLabelText('Valor contratado *'), { target: { value: '1.234,56' } })
  fireEvent.change(screen.getByLabelText('Data da contratação *'), { target: { value: '2026-11-25' } })
}

function ClientDestination() {
  const { id } = useParams<{ id: string }>()
  return <h1>Cliente {id}</h1>
}

function renderNewPage() {
  return render(
    <MemoryRouter initialEntries={['/clientes/novo']}>
      <Routes>
        <Route path="/clientes/novo" element={<ClientNewPage />} />
        <Route path="/clientes" element={<h1>Lista de clientes</h1>} />
        <Route path="/clientes/:id" element={<ClientDestination />} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ClientForm', () => {
  beforeEach(() => {
    createClient.mockReset()
    updateClient.mockReset()
    findClientDuplicateCandidates.mockReset().mockResolvedValue([])
    toast.mockReset()
  })

  it('exige nome, serviço, valor e data da contratação', async () => {
    render(<ClientForm mode="create" onCancel={vi.fn()} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
    expect((await screen.findByText('Nome do cliente é obrigatório.')).textContent).toBe('Nome do cliente é obrigatório.')
    expect(screen.getByText('Informe o serviço contratado.').textContent).toBe('Informe o serviço contratado.')
    expect(screen.getByText('Informe um valor válido.').textContent).toBe('Informe um valor válido.')
    expect(screen.getByText('Informe a data da contratação.').textContent).toBe('Informe a data da contratação.')
    expect(createClient).not.toHaveBeenCalled()
    expect(findClientDuplicateCandidates).not.toHaveBeenCalled()
  })

  it('rejeita valor negativo e vencimento anterior à contratação', async () => {
    render(<ClientForm mode="create" onCancel={vi.fn()} onSaved={vi.fn()} />)
    fillValidForm()
    fireEvent.change(screen.getByLabelText('Valor contratado *'), { target: { value: '-1,00' } })
    fireEvent.change(screen.getByLabelText('Vencimento do contrato'), { target: { value: '2026-11-24' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))

    expect((await screen.findByText('Informe um valor válido.')).textContent).toBe('Informe um valor válido.')
    expect(screen.getByText('O vencimento não pode anteceder a contratação.').textContent)
      .toBe('O vencimento não pode anteceder a contratação.')
    expect(findClientDuplicateCandidates).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('bloqueia CNPJ duplicado e informa o cliente existente', async () => {
    findClientDuplicateCandidates.mockResolvedValue([
      makeClient({ id: 'existing', name: 'Empresa Existente', cnpj: '12.345.678/0001-95' }),
    ])
    const onSaved = vi.fn()
    render(<ClientForm mode="create" onCancel={vi.fn()} onSaved={onSaved} />)
    fillValidForm()
    fireEvent.change(screen.getByLabelText('CNPJ'), { target: { value: '12.345.678/0001-95' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))

    expect((await screen.findByText('Já existe um cliente com este CNPJ: Empresa Existente.')).textContent)
      .toBe('Já existe um cliente com este CNPJ: Empresa Existente.')
    expect(createClient).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(findClientDuplicateCandidates).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Empresa Nova', cnpj: '12.345.678/0001-95',
    }), undefined)
  })

  it('mantém a mesma creation_key e os dados após falha e permite nova tentativa', async () => {
    const saved = makeClient()
    createClient.mockRejectedValueOnce(new Error('Falha temporária.')).mockResolvedValueOnce(saved)
    const onSaved = vi.fn()
    render(<ClientForm mode="create" onCancel={vi.fn()} onSaved={onSaved} />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))

    expect((await screen.findByText('Falha temporária.')).textContent).toBe('Falha temporária.')
    expect((screen.getByLabelText('Nome do cliente *') as HTMLInputElement).value).toBe('Empresa Nova')
    expect((screen.getByLabelText('Valor contratado *') as HTMLInputElement).value).toBe('1.234,56')
    expect((screen.getByLabelText('Data da contratação *') as HTMLInputElement).value).toBe('2026-11-25')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved))
    expect(createClient).toHaveBeenCalledTimes(2)
    expect(createClient.mock.calls[0][0].creationKey).toBe(createClient.mock.calls[1][0].creationKey)
    expect(createClient.mock.calls[0][0].creationKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('edita com contractId explícito, initialContract completo e total readOnly', async () => {
    const client = makeClient({ name: 'Empresa A' })
    const contract = makeContract()
    const saved = makeClient({ name: 'Empresa Editada' })
    updateClient.mockResolvedValue(saved)
    const onSaved = vi.fn()
    render(<ClientForm mode="edit" client={client} contract={contract} onCancel={vi.fn()} onSaved={onSaved} />)

    const total = screen.getByLabelText('Valor contratado *') as HTMLInputElement
    expect(total.readOnly).toBe(true)
    expect(total.value).toBe('1000.00')
    fireEvent.change(screen.getByLabelText('Nome do cliente *'), { target: { value: 'Empresa Editada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cliente' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved))
    expect(updateClient).toHaveBeenCalledWith('client-1', expect.objectContaining({
      name: 'Empresa Editada',
      contractId: 'contract-1',
      initialContract: {
        service: 'Site',
        totalValueCents: 100000,
        contractedAt: '2026-11-20',
        dueDate: '2026-12-01',
        paymentMethod: 'pix',
        paymentTerms: '50% na assinatura',
        notes: 'Observações do contrato',
      },
    }))
    expect(createClient).not.toHaveBeenCalled()
  })

  it('exige revisão explícita antes de salvar outros possíveis duplicados', async () => {
    const candidate = makeClient({ id: 'existing', name: 'Empresa Parecida', phone: '(11) 99999-9999' })
    findClientDuplicateCandidates.mockResolvedValue([candidate])
    createClient.mockResolvedValue(makeClient())
    const onSaved = vi.fn()
    render(<ClientForm mode="create" onCancel={vi.fn()} onSaved={onSaved} />)
    fillValidForm()
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '(11) 99999-9999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))

    expect((await screen.findByText('Possível duplicidade: Empresa Parecida. Revise antes de continuar.')).textContent)
      .toBe('Possível duplicidade: Empresa Parecida. Revise antes de continuar.')
    expect(createClient).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
    expect(screen.getByText('Revise os possíveis duplicados e marque a confirmação para continuar.').textContent)
      .toBe('Revise os possíveis duplicados e marque a confirmação para continuar.')
    expect(createClient).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText('Revisei os possíveis duplicados e desejo continuar.'))
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(makeClient()))
    expect(findClientDuplicateCandidates).toHaveBeenCalledTimes(1)
    expect(createClient).toHaveBeenCalledTimes(1)
  })

  it('mostra falha da consulta e só salva após Continuar sem verificar', async () => {
    findClientDuplicateCandidates.mockRejectedValue(new Error('Falha de rede.'))
    createClient.mockResolvedValue(makeClient())
    const onSaved = vi.fn()
    render(<ClientForm mode="create" onCancel={vi.fn()} onSaved={onSaved} />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))

    expect((await screen.findByText('Não foi possível verificar duplicidades.')).textContent)
      .toBe('Não foi possível verificar duplicidades.')
    expect(createClient).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar sem verificar' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(makeClient()))
    expect(createClient).toHaveBeenCalledTimes(1)
  })

  it('valida e-mail, CNPJ e URLs com os helpers existentes', async () => {
    render(<ClientForm mode="create" onCancel={vi.fn()} onSaved={vi.fn()} />)
    fillValidForm()
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'email-invalido' } })
    fireEvent.change(screen.getByLabelText('CNPJ'), { target: { value: '123' } })
    fireEvent.change(screen.getByLabelText('Site (link)'), { target: { value: 'javascript:alert(1)' } })
    fireEvent.change(screen.getByLabelText('Instagram (link)'), { target: { value: 'ftp://exemplo.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))

    expect((await screen.findByText('E-mail inválido.')).textContent).toBe('E-mail inválido.')
    expect(screen.getByText('CNPJ deve ter 14 dígitos.').textContent).toBe('CNPJ deve ter 14 dígitos.')
    expect(screen.getAllByText('Informe uma URL válida (http://, https:// ou domínio).')).toHaveLength(2)
    expect(findClientDuplicateCandidates).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('normaliza URLs e monta CreateClientInput com totalValueCents somente no submit', async () => {
    createClient.mockResolvedValue(makeClient())
    const onSaved = vi.fn()
    render(<ClientForm mode="create" onCancel={vi.fn()} onSaved={onSaved} />)
    fillValidForm()
    fireEvent.change(screen.getByLabelText('Site (link)'), { target: { value: 'exemplo.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(makeClient()))

    expect(createClient).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Empresa Nova',
      website: 'https://exemplo.com',
      instagram: '',
      creationKey: expect.any(String),
      initialContract: {
        service: 'Site',
        totalValueCents: 123456,
        contractedAt: '2026-11-25',
        dueDate: null,
        paymentMethod: '',
        paymentTerms: '',
        notes: '',
      },
    }))
    expect(createClient.mock.calls[0][0]).toHaveProperty('initialContract.totalValueCents', 123456)
  })

  it('impede envio duplicado enquanto a consulta e a gravação estão pendentes', async () => {
    const duplicateQuery = deferred<Client[]>()
    const mutation = deferred<Client>()
    findClientDuplicateCandidates.mockReturnValue(duplicateQuery.promise)
    createClient.mockReturnValue(mutation.promise)
    const onSaved = vi.fn()
    render(<ClientForm mode="create" onCancel={vi.fn()} onSaved={onSaved} />)
    fillValidForm()
    const submit = screen.getByRole('button', { name: 'Cadastrar cliente' })
    fireEvent.click(submit)
    fireEvent.click(submit)
    await waitFor(() => expect(findClientDuplicateCandidates).toHaveBeenCalledTimes(1))

    await act(async () => {
      duplicateQuery.resolve([])
      await duplicateQuery.promise
    })
    await waitFor(() => expect(createClient).toHaveBeenCalledTimes(1))
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(submit)
    expect(createClient).toHaveBeenCalledTimes(1)

    await act(async () => {
      mutation.resolve(makeClient())
      await mutation.promise
    })
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  })

  it('descarta a consulta obsoleta quando outro cliente entra em edição', async () => {
    const duplicateQuery = deferred<Client[]>()
    findClientDuplicateCandidates.mockReturnValue(duplicateQuery.promise)
    const firstClient = makeClient({ id: 'client-1', name: 'Empresa A' })
    const secondClient = makeClient({ id: 'client-2', name: 'Empresa B' })
    const firstContract = makeContract({ id: 'contract-1', client_id: 'client-1' })
    const secondContract = makeContract({ id: 'contract-2', client_id: 'client-2' })
    const onSaved = vi.fn()
    const view = render(
      <ClientForm mode="edit" client={firstClient} contract={firstContract} onCancel={vi.fn()} onSaved={onSaved} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cliente' }))
    await waitFor(() => expect(findClientDuplicateCandidates).toHaveBeenCalledTimes(1))

    view.rerender(
      <ClientForm mode="edit" client={secondClient} contract={secondContract} onCancel={vi.fn()} onSaved={onSaved} />,
    )
    await act(async () => {
      duplicateQuery.resolve([])
      await duplicateQuery.promise
    })

    expect(updateClient).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect((screen.getByLabelText('Nome do cliente *') as HTMLInputElement).value).toBe('Empresa B')
  })

  it('descarta consulta de duplicados e gravação depois do unmount', async () => {
    const duplicateQuery = deferred<Client[]>()
    findClientDuplicateCandidates.mockReturnValue(duplicateQuery.promise)
    const first = render(<ClientForm mode="create" onCancel={vi.fn()} onSaved={vi.fn()} />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
    await waitFor(() => expect(findClientDuplicateCandidates).toHaveBeenCalledTimes(1))
    first.unmount()
    await act(async () => {
      duplicateQuery.resolve([])
      await duplicateQuery.promise
    })
    expect(createClient).not.toHaveBeenCalled()

    const mutation = deferred<Client>()
    createClient.mockReturnValue(mutation.promise)
    const onSaved = vi.fn()
    const second = render(<ClientForm mode="create" onCancel={vi.fn()} onSaved={onSaved} />)
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
    await waitFor(() => expect(createClient).toHaveBeenCalledTimes(1))
    second.unmount()
    await act(async () => {
      mutation.resolve(makeClient())
      await mutation.promise
    })
    expect(onSaved).not.toHaveBeenCalled()
  })
})

describe('ClientNewPage', () => {
  beforeEach(() => {
    createClient.mockReset().mockResolvedValue(makeClient())
    updateClient.mockReset()
    findClientDuplicateCandidates.mockReset().mockResolvedValue([])
    toast.mockReset()
  })

  it('volta para a lista ao cancelar', async () => {
    renderNewPage()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect((await screen.findByRole('heading', { name: 'Lista de clientes' })).textContent)
      .toBe('Lista de clientes')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('navega para /clientes/:id e mostra toast após o cadastro', async () => {
    renderNewPage()
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))

    expect((await screen.findByRole('heading', { name: 'Cliente client-1' })).textContent)
      .toBe('Cliente client-1')
    expect(toast).toHaveBeenCalledWith('Cliente cadastrado.')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/clients/ClientForm.test.tsx`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement form and page**

```tsx
// src/components/clients/ClientForm.tsx
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
      if (!mountedRef.current || request !== requestRef.current) return
      busyRef.current = false
      setSaving(false)
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
      if (!mountedRef.current || request !== requestRef.current) return
      setCheckingDuplicates(false)
      if (!shouldPersist) busyRef.current = false
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
```

```tsx
// src/pages/ClientNewPage.tsx
import { useNavigate } from 'react-router-dom'
import { ClientForm } from '../components/clients/ClientForm'
import { Card } from '../components/ui/Card'
import { useToast } from '../hooks/useToast'
import type { Client } from '../types/client'

export function ClientNewPage() {
  const navigate = useNavigate()
  const { toast } = useToast()

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Novo cliente</h1>
        <p className="mt-1 text-sm text-muted">Cadastre o cliente e o contrato inicial na mesma operação.</p>
      </div>
      <Card>
        <ClientForm
          mode="create"
          onCancel={() => navigate('/clientes')}
          onSaved={(client: Client) => {
            toast('Cliente cadastrado.')
            navigate(`/clientes/${client.id}`)
          }}
        />
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Run tests and build**

Run: `npm test -- src/components/clients/ClientForm.test.tsx && npm run build`
Expected: PASS and build exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/clients/ClientForm.tsx src/components/clients/ClientForm.test.tsx src/pages/ClientNewPage.tsx
git commit -m "feat: adicionar cadastro manual de cliente"
```

---

### Task 9: Criar lista de clientes com filtros e paginação

**Files:**
- Create: `src/pages/ClientsPage.tsx`
- Create: `src/pages/ClientsPage.test.tsx`

**Interfaces:**
- Consumes: `listClients`, `ClientFilters`, `ClientSort`, `CLIENT_STATUSES`, `CLIENT_STATUS_LABELS`, `formatPhone`.
- Produces: route `/clientes`.

- [ ] **Step 1: Write failing page tests**

Substitua integralmente `src/pages/ClientsPage.test.tsx` por este arquivo. O mock de `useState` apenas registra setters para tornar observável a proteção contra atualização depois do unmount; a implementação real de `ClientesPage` é executada.

```tsx
// src/pages/ClientsPage.test.tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Client } from '../types/client'

const { listClients, stateUpdates } = vi.hoisted(() => ({
  listClients: vi.fn(),
  stateUpdates: vi.fn(),
}))

vi.mock('../services/clientService', () => ({ listClients }))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  const realUseState = actual.useState
  return {
    ...actual,
    useState: ((...args: Parameters<typeof actual.useState>) => {
      const [state, setState] = (realUseState as (...values: unknown[]) => [
        unknown, (value: unknown) => void,
      ])(...args)
      return [state, (value: unknown) => {
        stateUpdates(value)
        return setState(value)
      }]
    }) as typeof actual.useState,
  }
})

import { ClientsPage } from './ClientsPage'

interface ListResult { clients: Client[]; total: number }

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    owner_id: 'owner-1',
    creation_key: '00000000-0000-0000-0000-000000000501',
    name: 'Empresa A',
    responsible_name: 'Ana Responsável',
    phone: '(11) 99999-9999',
    whatsapp: null,
    email: 'contato@empresa-a.test',
    cnpj: null,
    cnpj_digits: null,
    phone_canonical: '5511999999999',
    whatsapp_canonical: null,
    website: null,
    instagram: null,
    address: null,
    city: 'São Paulo',
    district: null,
    zip_code: null,
    state: 'SP',
    niche: null,
    notes: null,
    status: 'active',
    source: 'manual',
    converted_at: null,
    archived_at: null,
    created_at: '2026-11-20T12:00:00Z',
    updated_at: '2026-11-20T12:00:00Z',
    ...overrides,
  }
}

function deferredList() {
  let resolve!: (result: ListResult) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<ListResult>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const clientA = makeClient()
const clientB = makeClient({ id: 'client-2', name: 'Empresa B', city: 'Campinas' })

afterEach(cleanup)

beforeEach(() => {
  listClients.mockReset().mockResolvedValue({ clients: [clientA], total: 1 })
  stateUpdates.mockReset()
})

describe('ClientsPage', () => {
  it('mostra loading e depois os clientes reais', async () => {
    render(<MemoryRouter><ClientsPage /></MemoryRouter>)

    expect(screen.getByText('Carregando clientes…').textContent).toBe('Carregando clientes…')
    expect((await screen.findByText('Empresa A')).textContent).toBe('Empresa A')
    expect(screen.getByText('Ativo').textContent).toBe('Ativo')
    expect(screen.getByText('São Paulo').textContent).toBe('São Paulo')
    expect(screen.getByText('(11) 99999-9999').textContent).toBe('(11) 99999-9999')
    expect(screen.getByRole('link', { name: 'Empresa A' }).getAttribute('href')).toBe('/clientes/client-1')
    expect(screen.queryByText(/Total recebido/i)).toBeNull()
    expect(listClients).toHaveBeenCalledWith({ search: '', status: '', city: '' }, 'name_asc', 0, 20)
  })

  it('aplica busca, status e cidade somente quando os filtros são submetidos', async () => {
    render(<MemoryRouter><ClientsPage /></MemoryRouter>)
    await screen.findByText('Empresa A')

    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'Empresa' } })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'active' } })
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'São Paulo' } })
    expect(listClients).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    await waitFor(() => expect(listClients).toHaveBeenCalledWith(
      { search: 'Empresa', status: 'active', city: 'São Paulo' }, 'name_asc', 0, 20,
    ))
  })

  it('usa o total do Supabase para habilitar e executar a próxima página', async () => {
    listClients.mockResolvedValue({ clients: [clientA], total: 41 })
    render(<MemoryRouter><ClientsPage /></MemoryRouter>)
    await screen.findByText('Empresa A')

    const next = screen.getByRole('button', { name: 'Próxima' }) as HTMLButtonElement
    expect(next.disabled).toBe(false)
    expect(screen.getByRole('status').textContent).toBe('Página 1 de 3')
    fireEvent.click(next)

    await waitFor(() => expect(listClients).toHaveBeenLastCalledWith(
      { search: '', status: '', city: '' }, 'name_asc', 1, 20,
    ))
    expect((await screen.findByText('Página 2 de 3')).textContent).toBe('Página 2 de 3')
  })

  it('volta à página zero ao submeter novos filtros', async () => {
    listClients.mockResolvedValue({ clients: [clientA], total: 41 })
    render(<MemoryRouter><ClientsPage /></MemoryRouter>)
    await screen.findByText('Empresa A')
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    await waitFor(() => expect(listClients).toHaveBeenLastCalledWith(
      { search: '', status: '', city: '' }, 'name_asc', 1, 20,
    ))

    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'Empresa B' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    await waitFor(() => expect(listClients).toHaveBeenLastCalledWith(
      { search: 'Empresa B', status: '', city: '' }, 'name_asc', 0, 20,
    ))
  })

  it('oferece as quatro ordenações e submete a ordenação escolhida', async () => {
    render(<MemoryRouter><ClientsPage /></MemoryRouter>)
    await screen.findByText('Empresa A')

    const sort = screen.getByLabelText('Ordenar por') as HTMLSelectElement
    expect(Array.from(sort.options).map((option) => option.value)).toEqual([
      'name_asc', 'name_desc', 'created_desc', 'updated_desc',
    ])
    fireEvent.change(sort, { target: { value: 'updated_desc' } })
    await waitFor(() => expect(listClients).toHaveBeenLastCalledWith(
      { search: '', status: '', city: '' }, 'updated_desc', 0, 20,
    ))
  })

  it('mostra estado vazio sem inventar clientes e oferece cadastro', async () => {
    listClients.mockResolvedValue({ clients: [], total: 0 })
    render(<MemoryRouter><ClientsPage /></MemoryRouter>)

    expect((await screen.findByText('Nenhum cliente encontrado.')).textContent).toBe('Nenhum cliente encontrado.')
    expect(screen.getByRole('link', { name: 'Cadastrar cliente' }).getAttribute('href')).toBe('/clientes/novo')
    expect(screen.queryByText('Empresa A')).toBeNull()
  })

  it('preserva erro e oferece nova tentativa', async () => {
    listClients.mockRejectedValueOnce(new Error('Falha de conexão.')).mockResolvedValueOnce({ clients: [], total: 0 })
    render(<MemoryRouter><ClientsPage /></MemoryRouter>)

    expect((await screen.findByRole('alert')).textContent).toContain('Falha de conexão.')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(listClients).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Nenhum cliente encontrado.')).toBeTruthy()
  })

  it('mantém a última lista válida quando a atualização falha', async () => {
    listClients.mockResolvedValueOnce({ clients: [clientA], total: 1 })
      .mockRejectedValueOnce(new Error('Falha ao atualizar.'))
      .mockResolvedValueOnce({ clients: [clientA], total: 1 })
    render(<MemoryRouter><ClientsPage /></MemoryRouter>)
    await screen.findByText('Empresa A')

    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'Empresa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Falha ao atualizar.')
    expect(screen.getByText('Empresa A').textContent).toBe('Empresa A')

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(screen.getByText('Empresa A')).toBeTruthy()
  })

  it('mantém a página de origem quando uma consulta de outra página falha', async () => {
    listClients.mockResolvedValueOnce({ clients: [clientA], total: 41 })
      .mockResolvedValueOnce({ clients: [clientB], total: 41 })
      .mockRejectedValueOnce(new Error('Falha na página 1.'))
    render(<MemoryRouter><ClientsPage /></MemoryRouter>)
    await screen.findByText('Empresa A')
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    expect(await screen.findByText('Página 2 de 3')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'Campinas' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Falha na página 1.')
    expect(screen.getByText('Empresa B')).toBeTruthy()
    expect(screen.queryByText('Empresa A')).toBeNull()
    expect(screen.getByText('Página 2 de 3')).toBeTruthy()
  })

  it('volta para a última página válida quando o total diminui', async () => {
    listClients.mockResolvedValueOnce({ clients: [clientA], total: 41 })
      .mockResolvedValueOnce({ clients: [clientB], total: 1 })
      .mockResolvedValueOnce({ clients: [clientA], total: 1 })
    render(<MemoryRouter><ClientsPage /></MemoryRouter>)
    await screen.findByText('Empresa A')
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))

    await waitFor(() => expect(listClients).toHaveBeenLastCalledWith(
      { search: '', status: '', city: '' }, 'name_asc', 0, 20,
    ))
    expect(await screen.findByText('Página 1 de 1')).toBeTruthy()
    expect(screen.getByText('Empresa A')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Próxima' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('descarta a resposta antiga quando dois filtros são submetidos em sequência', async () => {
    const first = deferredList()
    const second = deferredList()
    listClients.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    render(<MemoryRouter><ClientsPage /></MemoryRouter>)
    await waitFor(() => expect(listClients).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'Empresa B' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    await waitFor(() => expect(listClients).toHaveBeenCalledTimes(2))

    await act(async () => {
      second.resolve({ clients: [clientB], total: 1 })
      await second.promise
    })
    expect((await screen.findByText('Empresa B')).textContent).toBe('Empresa B')

    await act(async () => {
      first.resolve({ clients: [clientA], total: 1 })
      await first.promise
    })
    expect(screen.getByText('Empresa B')).toBeTruthy()
    expect(screen.queryByText('Empresa A')).toBeNull()
  })

  it('não atualiza estado depois do unmount quando a consulta termina', async () => {
    const pending = deferredList()
    listClients.mockReturnValue(pending.promise)
    const { unmount } = render(<MemoryRouter><ClientsPage /></MemoryRouter>)
    await waitFor(() => expect(listClients).toHaveBeenCalledTimes(1))
    unmount()
    stateUpdates.mockClear()

    await act(async () => {
      pending.resolve({ clients: [clientA], total: 1 })
      await pending.promise
    })

    expect(stateUpdates).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/pages/ClientsPage.test.tsx`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement the page**

Substitua integralmente `src/pages/ClientsPage.tsx` pelo código abaixo. `draftFilters` representa o formulário; somente `filters` é enviado ao serviço. `hasLoadedRef` diferencia a carga inicial de um refresh, preservando a última lista durante o segundo caso.

```tsx
// src/pages/ClientsPage.tsx
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, Users } from 'lucide-react'
import { listClients, type ClientFilters, type ClientSort } from '../services/clientService'
import {
  CLIENT_STATUSES,
  CLIENT_STATUS_LABELS,
  type Client,
  type ClientStatus,
} from '../types/client'
import { formatDate, formatPhone } from '../lib/format'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'

const PAGE_SIZE = 20
const EMPTY_FILTERS: ClientFilters = { search: '', status: '', city: '' }

const SORT_OPTIONS: Array<{ value: ClientSort; label: string }> = [
  { value: 'name_asc', label: 'Nome (A–Z)' },
  { value: 'name_desc', label: 'Nome (Z–A)' },
  { value: 'created_desc', label: 'Cadastro mais recente' },
  { value: 'updated_desc', label: 'Atualização mais recente' },
]

const STATUS_STYLES: Record<ClientStatus, string> = {
  active: 'bg-primary/15 text-primary',
  in_project: 'bg-accent/15 text-accent',
  awaiting_payment: 'bg-lime/15 text-lime',
  awaiting_approval: 'bg-pink/15 text-pink',
  project_completed: 'bg-mint/15 text-mint',
  inactive: 'bg-muted/15 text-muted',
}

interface ClientQuery {
  filters: ClientFilters
  sort: ClientSort
  page: number
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; clients: Client[]; total: number; query: ClientQuery }
  | { status: 'error'; message: string }
  | { status: 'refresh-error'; clients: Client[]; total: number; query: ClientQuery; message: string }

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'Erro ao carregar clientes.'
}

export function ClientsPage() {
  const navigate = useNavigate()
  const [draftFilters, setDraftFilters] = useState<ClientFilters>(EMPTY_FILTERS)
  const [filters, setFilters] = useState<ClientFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<ClientSort>('name_asc')
  const [page, setPage] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })
  const [refreshing, setRefreshing] = useState(false)
  const activeRef = useRef(true)
  const requestRef = useRef(0)
  const hasLoadedRef = useRef(false)

  const loadClients = useCallback(async (background: boolean) => {
    if (!activeRef.current) return
    const request = ++requestRef.current
    setRefreshing(background)
    if (!background) setLoadState({ status: 'loading' })

    try {
      const result = await listClients(filters, sort, page, PAGE_SIZE)
      if (!activeRef.current || request !== requestRef.current) return
      hasLoadedRef.current = true
      const lastPage = Math.max(0, Math.ceil(result.total / PAGE_SIZE) - 1)
      if (page > lastPage) {
        setPage(lastPage)
        return
      }
      setLoadState({
        status: 'ready',
        clients: result.clients,
        total: result.total,
        query: { filters: { ...filters }, sort, page },
      })
    } catch (error) {
      if (!activeRef.current || request !== requestRef.current) return
      const message = messageFrom(error)
      setLoadState((current) => {
        if (background && (current.status === 'ready' || current.status === 'refresh-error')) {
          return {
            status: 'refresh-error',
            clients: current.clients,
            total: current.total,
            query: current.query,
            message,
          }
        }
        return { status: 'error', message }
      })
    } finally {
      if (activeRef.current && request === requestRef.current) setRefreshing(false)
    }
  }, [filters, sort, page])

  useEffect(() => {
    activeRef.current = true
    void loadClients(hasLoadedRef.current)
    return () => {
      activeRef.current = false
      requestRef.current += 1
    }
  }, [loadClients, refreshKey])

  const submitFilters = (event: FormEvent) => {
    event.preventDefault()
    setFilters({ ...draftFilters })
    setPage(0)
    setRefreshKey((key) => key + 1)
  }

  const changeSort = (nextSort: ClientSort) => {
    setSort(nextSort)
    setPage(0)
    setRefreshKey((key) => key + 1)
  }

  const clearFilters = () => {
    setDraftFilters(EMPTY_FILTERS)
    setFilters(EMPTY_FILTERS)
    setPage(0)
    setRefreshKey((key) => key + 1)
  }

  const reload = () => setRefreshKey((key) => key + 1)
  const displayedQuery: ClientQuery = loadState.status === 'ready' || loadState.status === 'refresh-error'
    ? loadState.query
    : { filters, sort, page }
  const displayedPage = displayedQuery.page
  const totalPages = Math.max(1, Math.ceil(
    (loadState.status === 'ready' || loadState.status === 'refresh-error' ? loadState.total : 0) / PAGE_SIZE,
  ))
  const hasActiveFilters = Boolean(
    displayedQuery.filters.search || displayedQuery.filters.status || displayedQuery.filters.city,
  )

  const goToPage = (nextPage: number) => {
    setFilters(displayedQuery.filters)
    setSort(displayedQuery.sort)
    setPage(nextPage)
    setRefreshKey((key) => key + 1)
  }

  return (
    <div className="flex flex-col gap-5" aria-busy={refreshing}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Clientes</h1>
          <p className="text-sm text-muted">Busque, filtre e abra o cadastro de cada cliente.</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button type="button" variant="outline" onClick={reload}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Atualizar
          </Button>
          <Button type="button" variant="mint" onClick={() => navigate('/clientes/novo')}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Novo cliente
          </Button>
        </div>
      </div>

      <Card>
        <form onSubmit={submitFilters} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input
            label="Buscar cliente"
            placeholder="Nome, responsável, e-mail ou CNPJ"
            value={draftFilters.search}
            onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))}
          />
          <Select
            label="Status"
            placeholder="Todos os status"
            value={draftFilters.status}
            onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value }))}
            options={CLIENT_STATUSES.map((status) => ({ value: status, label: CLIENT_STATUS_LABELS[status] }))}
          />
          <Input
            label="Cidade"
            placeholder="Todas as cidades"
            value={draftFilters.city}
            onChange={(event) => setDraftFilters((current) => ({ ...current, city: event.target.value }))}
          />
          <Select
            label="Ordenar por"
            value={displayedQuery.sort}
            onChange={(event) => changeSort(event.target.value as ClientSort)}
            options={SORT_OPTIONS}
          />
          <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-4">
            <Button type="submit" variant="mint">Aplicar filtros</Button>
            <Button type="button" variant="ghost" onClick={clearFilters} disabled={!hasActiveFilters && !draftFilters.search && !draftFilters.city && !draftFilters.status}>
              Limpar filtros
            </Button>
            {refreshing && <span role="status" className="self-center text-xs text-muted">Atualizando clientes…</span>}
          </div>
        </form>
      </Card>

      {loadState.status === 'loading' ? (
        <Card><p role="status" className="text-sm text-muted">Carregando clientes…</p></Card>
      ) : loadState.status === 'error' ? (
        <Card className="border-danger/40" role="alert">
          <p className="text-sm font-medium text-danger">Não foi possível carregar os clientes.</p>
          <p className="mt-1 text-sm text-muted">{loadState.message}</p>
          <Button type="button" variant="outline" className="mt-3" onClick={reload}>Tentar novamente</Button>
        </Card>
      ) : (
        <>
          {loadState.status === 'refresh-error' && (
            <Card className="border-danger/40" role="alert">
              <p className="text-sm font-medium text-danger">Não foi possível atualizar a lista.</p>
              <p className="mt-1 text-sm text-muted">{loadState.message} Exibindo os últimos clientes carregados.</p>
              <Button type="button" variant="outline" className="mt-3" onClick={reload}>Tentar novamente</Button>
            </Card>
          )}

          {loadState.clients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum cliente encontrado."
              description={hasActiveFilters
                ? 'Ajuste os filtros ou cadastre um novo cliente.'
                : 'Cadastre o primeiro cliente e seu contrato inicial para começar.'}
              action={(
                <Link
                  to="/clientes/novo"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-mint px-4 text-sm font-medium text-bg transition-colors hover:bg-mint/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> Cadastrar cliente
                </Link>
              )}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {loadState.clients.map((client) => (
                  <Card key={client.id} className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="min-w-0 font-display text-base font-semibold text-ink">
                        <Link to={`/clientes/${client.id}`} className="hover:text-primary">
                          {client.name}
                        </Link>
                      </h2>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[client.status]}`}>
                        {CLIENT_STATUS_LABELS[client.status]}
                      </span>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-muted">Cidade</dt>
                        <dd className="text-ink">{client.city || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Telefone</dt>
                        <dd className="text-ink">{client.phone ? formatPhone(client.phone) : '—'}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-xs text-muted">Cadastro</dt>
                        <dd className="text-ink">{formatDate(client.created_at)}</dd>
                      </div>
                    </dl>
                  </Card>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
                <span role="status" aria-live="polite">Página {displayedPage + 1} de {totalPages}</span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" disabled={displayedPage === 0 || refreshing} onClick={() => goToPage(displayedPage - 1)}>Anterior</Button>
                  <Button type="button" variant="outline" disabled={displayedPage + 1 >= totalPages || refreshing} onClick={() => goToPage(displayedPage + 1)}>Próxima</Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests and build**

Run: `npm test -- src/pages/ClientsPage.test.tsx && npm run build`
Expected: PASS and build exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ClientsPage.tsx src/pages/ClientsPage.test.tsx
git commit -m "feat: adicionar lista de clientes"
```

---

### Task 10: Criar detalhe do cliente e histórico combinado

**Files:**
- Create: `src/components/clients/ClientHistory.tsx`
- Create: `src/components/clients/ClientHistory.test.tsx`
- Create: `src/lib/calendarDate.ts`
- Create: `src/lib/calendarDate.test.ts`
- Create: `src/pages/ClientDetailPage.tsx`
- Create: `src/pages/ClientDetailPage.test.tsx`

**Interfaces:**
- Consumes: `getClient`, `updateClient`, `archiveClient`, `ClientDetail`, `ClientHistoryEntry`, `ClientForm`.
- Produces: `ClientHistory({ entries }: { entries: ClientHistoryEntry[] })` and tabs “Visão geral”, “Projetos”, “Financeiro” and “Histórico”.

- [ ] **Step 1: Write failing detail and history tests**

Substitua integralmente `src/pages/ClientDetailPage.test.tsx` e crie `src/components/clients/ClientHistory.test.tsx`. As fixtures cobrem todos os campos de `Client`, `Contract` e `Project`; não há casts parciais de tipos do domínio.

```tsx
// src/pages/ClientDetailPage.test.tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Client, ClientDetail } from '../types/client'
import type { Contract } from '../types/contract'
import type { Project } from '../types/project'

const {
  getClient,
  updateClient,
  archiveClient,
  createClient,
  findClientDuplicateCandidates,
  toast,
  stateUpdates,
} = vi.hoisted(() => ({
  getClient: vi.fn(),
  updateClient: vi.fn(),
  archiveClient: vi.fn(),
  createClient: vi.fn(),
  findClientDuplicateCandidates: vi.fn(),
  toast: vi.fn(),
  stateUpdates: vi.fn(),
}))

vi.mock('../services/clientService', () => ({
  getClient,
  updateClient,
  archiveClient,
  createClient,
  findClientDuplicateCandidates,
}))
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ toast }) }))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  const realUseState = actual.useState
  return {
    ...actual,
    useState: ((...args: Parameters<typeof actual.useState>) => {
      const [state, setState] = (realUseState as (...values: unknown[]) => [
        unknown, (value: unknown) => void,
      ])(...args)
      return [state, (value: unknown) => {
        stateUpdates(value)
        return setState(value)
      }]
    }) as typeof actual.useState,
  }
})

import { ClientDetailPage } from './ClientDetailPage'

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    owner_id: 'owner-1',
    creation_key: '00000000-0000-0000-0000-000000000501',
    name: 'Empresa A',
    responsible_name: 'Ana Responsável',
    phone: '(11) 99999-9999',
    whatsapp: null,
    email: 'contato@empresa-a.test',
    cnpj: null,
    cnpj_digits: null,
    phone_canonical: '5511999999999',
    whatsapp_canonical: null,
    website: null,
    instagram: null,
    address: null,
    city: 'São Paulo',
    district: null,
    zip_code: null,
    state: 'SP',
    niche: null,
    notes: null,
    status: 'active',
    source: 'manual',
    converted_at: null,
    archived_at: null,
    created_at: '2026-11-20T12:00:00Z',
    updated_at: '2026-11-20T12:00:00Z',
    ...overrides,
  }
}

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 'contract-1',
    owner_id: 'owner-1',
    client_id: 'client-1',
    source_link_id: null,
    creation_key: '00000000-0000-0000-0000-000000000501',
    service: 'Site',
    total_value_cents: 123456,
    contracted_at: '2026-11-21',
    due_date: '2026-12-21',
    payment_method: 'pix',
    payment_terms: 'À vista',
    status: 'active',
    notes: null,
    cancelled_at: null,
    created_at: '2026-11-21T12:00:00Z',
    updated_at: '2026-11-21T12:00:00Z',
    ...overrides,
  }
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    owner_id: 'owner-1',
    client_id: 'client-1',
    contract_id: 'contract-1',
    source_link_id: null,
    name: 'Site institucional',
    service: 'Site',
    contracted_value_cents: 123456,
    description: null,
    start_date: '2026-11-22',
    due_date: '2026-12-10',
    responsible_name: 'Ana Responsável',
    priority: 'medium',
    status: 'in_review',
    completed_at: null,
    delivered_at: null,
    delivery_confirmed_at: null,
    delivery_url: null,
    files_url: null,
    final_notes: null,
    archived_at: null,
    created_at: '2026-11-22T12:00:00Z',
    updated_at: '2026-11-22T12:00:00Z',
    ...overrides,
  }
}

function makeDetail(overrides: Partial<ClientDetail> = {}): ClientDetail {
  return {
    client: makeClient(),
    contracts: [makeContract()],
    projects: [],
    activities: [],
    linkedLeads: [],
    history: [],
    ...overrides,
  }
}

function deferredDetail() {
  let resolve!: (detail: ClientDetail | null) => void
  const promise = new Promise<ClientDetail | null>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

const detail = makeDetail()

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/clientes/client-1']}>
      <Routes>
        <Route path="/clientes" element={<div>Lista de clientes</div>} />
        <Route path="/clientes/:id" element={<ClientDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(cleanup)

beforeEach(() => {
  getClient.mockReset().mockResolvedValue(detail)
  updateClient.mockReset()
  archiveClient.mockReset()
  createClient.mockReset()
  findClientDuplicateCandidates.mockReset().mockResolvedValue([])
  toast.mockReset()
  stateUpdates.mockReset()
})

describe('ClientDetailPage', () => {
  it('mostra cliente e contrato sem confundir com recebimento', async () => {
    renderPage()
    expect((await screen.findByRole('heading', { name: 'Empresa A' })).textContent).toBe('Empresa A')
    expect(screen.getByText('Contrato inicial').textContent).toBe('Contrato inicial')
    expect(screen.getByText('Origem: Cadastro manual')).toBeTruthy()
    expect(screen.getByText('21/11/2026')).toBeTruthy()
    expect(screen.getByText('21/12/2026')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Financeiro' }))
    expect(screen.getByText('Site').textContent).toBe('Site')
    expect(screen.getByText('R$ 1.234,56').textContent).toBe('R$ 1.234,56')
    expect(screen.getByText('Pix')).toBeTruthy()
    expect(screen.getByText('Valor contratado').textContent).toBe('Valor contratado')
    expect(screen.getByText('Pagamentos, estornos e despesas serão exibidos no módulo Financeiro.').textContent)
      .toBe('Pagamentos, estornos e despesas serão exibidos no módulo Financeiro.')
    expect(screen.queryByText('Total recebido')).toBeNull()
  })

  it('combina eventos do cliente e do lead na aba Histórico', async () => {
    getClient.mockResolvedValue(makeDetail({
      history: [
        { id: 'c1', type: 'conversion', description: 'Cliente convertido.', created_at: '2026-11-22T10:00:00Z', source: 'client' },
        { id: 'l1', type: 'mensagem', description: 'Mensagem enviada.', created_at: '2026-11-21T10:00:00Z', source: 'lead', leadName: 'Empresa A' },
      ],
    }))
    renderPage()
    fireEvent.click(await screen.findByRole('tab', { name: 'Histórico' }))

    expect((await screen.findByText('Cliente convertido.')).textContent).toBe('Cliente convertido.')
    expect(screen.getByText('Mensagem enviada.').textContent).toBe('Mensagem enviada.')
    expect(screen.getByText('Lead: Empresa A').textContent).toBe('Lead: Empresa A')
    const history = screen.getByRole('list', { name: 'Histórico do cliente' })
    expect(history.textContent?.indexOf('Cliente convertido.')).toBeLessThan(history.textContent?.indexOf('Mensagem enviada.') ?? -1)
  })

  it('arquiva com confirmação e preserva o contrato na tela', async () => {
    const archived = makeDetail({
      client: makeClient({ status: 'inactive', archived_at: '2026-11-25T12:00:00Z' }),
    })
    getClient.mockResolvedValueOnce(detail).mockResolvedValueOnce(archived)
    archiveClient.mockResolvedValue(archived.client)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Arquivar cliente' }))
    expect(archiveClient).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar arquivamento' }))
    await waitFor(() => expect(archiveClient).toHaveBeenCalledWith('client-1'))
    await waitFor(() => expect(getClient).toHaveBeenCalledTimes(2))
    expect((await screen.findByText('Inativo')).textContent).toBe('Inativo')

    fireEvent.click(screen.getByRole('tab', { name: 'Financeiro' }))
    expect(screen.getByText('R$ 1.234,56').textContent).toBe('R$ 1.234,56')
  })

  it('não arquiva quando a confirmação é cancelada', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Arquivar cliente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog', { name: 'Arquivar cliente' })).toBeNull()
    expect(archiveClient).not.toHaveBeenCalled()
  })

  it('passa o contrato exibido ao formulário de edição', async () => {
    updateClient.mockResolvedValue(detail.client)
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Editar cliente' }))
    fireEvent.change(screen.getByLabelText('Nome do cliente *'), { target: { value: 'Empresa Editada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cliente' }))

    await waitFor(() => expect(updateClient).toHaveBeenCalledWith('client-1', expect.objectContaining({
      contractId: 'contract-1',
      initialContract: expect.objectContaining({ service: 'Site', totalValueCents: 123456 }),
    })))
  })

  it('seleciona o contrato mais recente e edita somente o contrato escolhido', async () => {
    getClient.mockResolvedValue(makeDetail({
      contracts: [
        makeContract({ id: 'contract-1', service: 'Site', contracted_at: '2026-11-01' }),
        makeContract({ id: 'contract-2', service: 'Social media', total_value_cents: 50000, contracted_at: '2026-11-25' }),
      ],
    }))
    updateClient.mockResolvedValue(detail.client)
    renderPage()
    await screen.findByRole('heading', { name: 'Empresa A' })
    fireEvent.click(screen.getByRole('tab', { name: 'Financeiro' }))

    const selector = screen.getByLabelText('Contrato') as HTMLSelectElement
    expect(selector.value).toBe('contract-2')
    fireEvent.change(selector, { target: { value: 'contract-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Editar cliente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cliente' }))

    await waitFor(() => expect(updateClient).toHaveBeenCalledWith('client-1', expect.objectContaining({
      contractId: 'contract-1',
      initialContract: expect.objectContaining({ service: 'Site', totalValueCents: 123456 }),
    })))
  })

  it('preserva o contrato selecionado depois de atualizar o detalhe', async () => {
    const multiple = makeDetail({
      contracts: [
        makeContract({ id: 'contract-1', service: 'Site', contracted_at: '2026-11-01' }),
        makeContract({ id: 'contract-2', service: 'Social media', contracted_at: '2026-11-25' }),
      ],
    })
    getClient.mockResolvedValue(multiple)
    renderPage()
    await screen.findByRole('heading', { name: 'Empresa A' })
    fireEvent.click(screen.getByRole('tab', { name: 'Financeiro' }))
    const selector = screen.getByLabelText('Contrato') as HTMLSelectElement
    fireEvent.change(selector, { target: { value: 'contract-1' } })

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    await waitFor(() => expect(getClient).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText('Atualizando…')).toBeNull())
    expect((screen.getByLabelText('Contrato') as HTMLSelectElement).value).toBe('contract-1')
  })

  it('desempata contratos pela id crescente quando as datas são iguais', async () => {
    getClient.mockResolvedValue(makeDetail({
      contracts: [
        makeContract({ id: 'contract-b', service: 'Contrato B', contracted_at: '2026-11-25' }),
        makeContract({ id: 'contract-a', service: 'Contrato A', contracted_at: '2026-11-25' }),
      ],
    }))
    renderPage()
    await screen.findByRole('heading', { name: 'Empresa A' })
    fireEvent.click(screen.getByRole('tab', { name: 'Financeiro' }))
    expect((screen.getByLabelText('Contrato') as HTMLSelectElement).value).toBe('contract-a')
  })

  it('bloqueia edição sem contrato e explica a ausência', async () => {
    getClient.mockResolvedValue(makeDetail({ contracts: [] }))
    renderPage()
    await screen.findByRole('heading', { name: 'Empresa A' })

    expect((screen.getByRole('button', { name: 'Editar cliente' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('tab', { name: 'Financeiro' }))
    expect(screen.getByText('Nenhum contrato cadastrado.').textContent).toBe('Nenhum contrato cadastrado.')
    expect(screen.queryByRole('button', { name: 'Salvar cliente' })).toBeNull()
  })

  it('mostra projetos básicos sem antecipar a rota do Plano 2', async () => {
    getClient.mockResolvedValue(makeDetail({ projects: [makeProject()] }))
    renderPage()
    await screen.findByRole('heading', { name: 'Empresa A' })
    fireEvent.click(screen.getByRole('tab', { name: 'Projetos' }))

    expect(screen.getByText('Site institucional').textContent).toBe('Site institucional')
    expect(screen.getByText('Em revisão').textContent).toBe('Em revisão')
    expect(screen.getByText('R$ 1.234,56').textContent).toBe('R$ 1.234,56')
    expect(screen.queryByRole('link', { name: 'Site institucional' })).toBeNull()
    expect(screen.queryByText(/\/projetos\//)).toBeNull()
  })

  it('preserva o último detalhe válido quando o refresh falha', async () => {
    getClient.mockResolvedValueOnce(detail)
      .mockRejectedValueOnce(new Error('Falha ao atualizar.'))
      .mockResolvedValueOnce(detail)
    renderPage()
    await screen.findByRole('heading', { name: 'Empresa A' })

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Falha ao atualizar.')
    expect(screen.getByRole('heading', { name: 'Empresa A' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Financeiro' }))
    expect(screen.getByText('R$ 1.234,56')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('descarta respostas obsoletas de dois refreshes', async () => {
    const first = deferredDetail()
    const second = deferredDetail()
    getClient.mockResolvedValueOnce(detail)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    renderPage()
    await screen.findByRole('heading', { name: 'Empresa A' })

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    await waitFor(() => expect(getClient).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    await waitFor(() => expect(getClient).toHaveBeenCalledTimes(3))

    await act(async () => {
      second.resolve(makeDetail({ client: makeClient({ name: 'Empresa Nova' }) }))
      await second.promise
    })
    expect((await screen.findByRole('heading', { name: 'Empresa Nova' })).textContent).toBe('Empresa Nova')

    await act(async () => {
      first.resolve(detail)
      await first.promise
    })
    expect(screen.getByRole('heading', { name: 'Empresa Nova' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Empresa A' })).toBeNull()
  })

  it('não atualiza estado depois do unmount', async () => {
    const pending = deferredDetail()
    getClient.mockReturnValue(pending.promise)
    const { unmount } = renderPage()
    await waitFor(() => expect(getClient).toHaveBeenCalledTimes(1))
    unmount()
    stateUpdates.mockClear()

    await act(async () => {
      pending.resolve(detail)
      await pending.promise
    })
    expect(stateUpdates).not.toHaveBeenCalled()
  })

  it('mostra cliente não encontrado e link para a lista', async () => {
    getClient.mockResolvedValue(null)
    renderPage()

    expect((await screen.findByRole('heading', { name: 'Cliente não encontrado.' })).textContent)
      .toBe('Cliente não encontrado.')
    expect(screen.getByRole('link', { name: 'Voltar para clientes' }).getAttribute('href')).toBe('/clientes')
  })
})
```

```ts
// src/lib/calendarDate.test.ts
import { describe, expect, it } from 'vitest'
import { formatCalendarDate } from './calendarDate'

describe('formatCalendarDate', () => {
  it('formata datas de calendário sem converter o fuso local', () => {
    expect(formatCalendarDate('2026-11-21')).toBe('21/11/2026')
    expect(formatCalendarDate('2026-01-01')).toBe('01/01/2026')
  })

  it('retorna traço para ausência e rejeita datas inválidas ou timestamps', () => {
    expect(formatCalendarDate(null)).toBe('—')
    expect(formatCalendarDate('2026-02-30')).toBe('—')
    expect(formatCalendarDate('2026-11-21T12:00:00Z')).toBe('—')
  })
})
```

```tsx
// src/components/clients/ClientHistory.test.tsx
// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientHistoryEntry } from '../../types/client'

const { getClient, updateClient, archiveClient } = vi.hoisted(() => ({
  getClient: vi.fn(),
  updateClient: vi.fn(),
  archiveClient: vi.fn(),
}))
vi.mock('../../services/clientService', () => ({ getClient, updateClient, archiveClient }))

import { ClientHistory } from './ClientHistory'

const entries: ClientHistoryEntry[] = [
  { id: 'lead-1', type: 'mensagem', description: 'Mensagem enviada.', created_at: '2026-11-21T10:00:00Z', source: 'lead', leadName: 'Empresa A' },
  { id: 'client-1', type: 'conversion', description: 'Cliente convertido.', created_at: '2026-11-22T10:00:00Z', source: 'client' },
]

afterEach(() => {
  cleanup()
  expect(getClient).not.toHaveBeenCalled()
  expect(updateClient).not.toHaveBeenCalled()
  expect(archiveClient).not.toHaveBeenCalled()
})

beforeEach(() => {
  getClient.mockReset()
  updateClient.mockReset()
  archiveClient.mockReset()
})

describe('ClientHistory', () => {
  it('ordena uma cópia dos eventos e identifica a origem sem gravar atividades', () => {
    const snapshot = entries.map((entry) => ({ ...entry }))
    render(<ClientHistory entries={entries} />)

    const list = screen.getByRole('list', { name: 'Histórico do cliente' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain('Cliente convertido.')
    expect(items[0].textContent).toContain('Cliente')
    expect(items[1].textContent).toContain('Mensagem enviada.')
    expect(items[1].textContent).toContain('Lead: Empresa A')
    expect(entries).toEqual(snapshot)
  })

  it('exibe um estado vazio sem inventar eventos', () => {
    render(<ClientHistory entries={[]} />)
    expect(screen.getByText('Nenhum evento registrado.').textContent).toBe('Nenhum evento registrado.')
    expect(screen.queryByRole('list')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/calendarDate.test.ts src/pages/ClientDetailPage.test.tsx src/components/clients/ClientHistory.test.tsx`
Expected: FAIL with module not found and missing pt-BR labels/calendar formatting.

- [ ] **Step 3: Implement detail and history**

Crie `src/lib/calendarDate.ts`. O formato aceita somente `YYYY-MM-DD`; timestamps continuam usando `formatDate`.

```ts
// src/lib/calendarDate.ts
const calendarFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatCalendarDate(value: string | null): string {
  if (!value) return '—'
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return '—'
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return '—'
  }
  return calendarFormatter.format(date)
}
```

Crie `src/components/clients/ClientHistory.tsx`. O componente apenas ordena uma cópia da lista recebida; não consulta nem grava serviços.

```tsx
// src/components/clients/ClientHistory.tsx
import { ACTIVITY_LABELS } from '../../types/activity'
import type { ClientHistoryEntry } from '../../types/client'
import { formatDateTime } from '../../lib/format'

const HISTORY_LABELS: Record<ClientHistoryEntry['type'], string> = {
  ...ACTIVITY_LABELS,
  conversion: 'Conversão em cliente',
  contact: 'Contato',
  meeting: 'Reunião',
  approval: 'Aprovação',
  status_change: 'Mudança de status',
  delivery: 'Entrega',
  financial: 'Financeiro',
  note: 'Observação',
}

export function ClientHistory({ entries }: { entries: ClientHistoryEntry[] }) {
  const ordered = [...entries].sort((a, b) =>
    b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id),
  )

  if (ordered.length === 0) {
    return <p className="text-sm text-muted">Nenhum evento registrado.</p>
  }

  return (
    <ol className="flex flex-col" aria-label="Histórico do cliente">
      {ordered.map((entry) => (
        <li key={`${entry.source}:${entry.id}`} className="flex flex-col gap-1 border-b border-line/60 py-3 last:border-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-ink">{HISTORY_LABELS[entry.type]}</span>
            <span className="rounded-full bg-elevated px-2.5 py-0.5 text-xs text-muted">
              {entry.source === 'lead' ? `Lead: ${entry.leadName ?? 'Nome não carregado'}` : 'Cliente'}
            </span>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm text-muted">{entry.description}</p>
          <time dateTime={entry.created_at} className="text-xs text-muted/70">{formatDateTime(entry.created_at)}</time>
        </li>
      ))}
    </ol>
  )
}
```

Substitua integralmente `src/pages/ClientDetailPage.tsx` pelo código abaixo. A seleção é recalculada somente quando o contrato atual desaparece; um contrato ainda existente sobrevive a atualizações e à reabertura da aba.

```tsx
// src/pages/ClientDetailPage.tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Archive, ArrowLeft, FileQuestion, Pencil, RefreshCw } from 'lucide-react'
import { archiveClient, getClient } from '../services/clientService'
import { CLIENT_STATUS_LABELS, type ClientDetail } from '../types/client'
import type { Contract } from '../types/contract'
import type { ProjectStatus } from '../types/project'
import { formatMoney } from '../lib/money'
import { formatDate, formatPhone } from '../lib/format'
import { formatCalendarDate } from '../lib/calendarDate'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { Skeleton } from '../components/ui/Skeleton'
import { ClientForm } from '../components/clients/ClientForm'
import { ClientHistory } from '../components/clients/ClientHistory'

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  not_started: 'Não iniciado',
  planning: 'Planejamento',
  in_development: 'Em desenvolvimento',
  awaiting_client_info: 'Aguardando informações do cliente',
  in_review: 'Em revisão',
  awaiting_approval: 'Aguardando aprovação',
  changes_requested: 'Alterações solicitadas',
  completed: 'Concluído',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

const CONTRACT_STATUS_LABELS: Record<Contract['status'], string> = {
  active: 'Ativo',
  cancelled: 'Cancelado',
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Cadastro manual',
  lead: 'Lead convertido',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'Pix',
  boleto: 'Boleto',
  transferencia: 'Transferência bancária',
  cartao: 'Cartão',
}

const TABS = [
  { value: 'overview', label: 'Visão geral' },
  { value: 'projects', label: 'Projetos' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'historico', label: 'Histórico' },
] as const

type Tab = typeof TABS[number]['value']

type DetailState =
  | { status: 'loading' }
  | { status: 'ready'; detail: ClientDetail }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'refresh-error'; detail: ClientDetail; message: string }

function compareContracts(a: Contract, b: Contract) {
  return b.contracted_at.localeCompare(a.contracted_at) || a.id.localeCompare(b.id)
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm text-ink">{value || '—'}</dd>
    </div>
  )
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  if (!id) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Cliente não encontrado."
        description="O endereço não identifica um cliente válido."
        action={<Link to="/clientes" className="text-sm text-accent hover:underline">Voltar para clientes</Link>}
      />
    )
  }
  return <ClientDetailContent key={id} clientId={id} />
}

function ClientDetailContent({ clientId }: { clientId: string }) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [detailState, setDetailState] = useState<DetailState>({ status: 'loading' })
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveSaving, setArchiveSaving] = useState(false)
  const activeRef = useRef(true)
  const requestRef = useRef(0)
  const hasLoadedRef = useRef(false)
  const archiveSavingRef = useRef(false)

  const loadDetail = useCallback(async (background: boolean) => {
    if (!activeRef.current) return
    const request = ++requestRef.current
    setRefreshing(background)
    if (!background) setDetailState({ status: 'loading' })

    try {
      const detail = await getClient(clientId)
      if (!activeRef.current || request !== requestRef.current) return
      if (!detail) {
        hasLoadedRef.current = false
        setSelectedContractId(null)
        setDetailState({ status: 'empty' })
        return
      }

      hasLoadedRef.current = true
      const orderedContracts = [...detail.contracts].sort(compareContracts)
      setSelectedContractId((current) => orderedContracts.some((contract) => contract.id === current)
        ? current
        : orderedContracts[0]?.id ?? null)
      setDetailState({ status: 'ready', detail })
    } catch (error) {
      if (!activeRef.current || request !== requestRef.current) return
      const message = error instanceof Error ? error.message : 'Erro ao carregar cliente.'
      setDetailState((current) => {
        if (background && (current.status === 'ready' || current.status === 'refresh-error')) {
          return { status: 'refresh-error', detail: current.detail, message }
        }
        return { status: 'error', message }
      })
    } finally {
      if (activeRef.current && request === requestRef.current) setRefreshing(false)
    }
  }, [clientId])

  useEffect(() => {
    activeRef.current = true
    void loadDetail(hasLoadedRef.current)
    return () => {
      activeRef.current = false
      requestRef.current += 1
    }
  }, [loadDetail, refreshKey])

  const reload = () => setRefreshKey((key) => key + 1)

  const confirmArchive = async () => {
    if (archiveSavingRef.current) return
    archiveSavingRef.current = true
    setArchiveSaving(true)
    try {
      await archiveClient(clientId)
      if (!activeRef.current) return
      toast('Cliente arquivado.')
      setArchiveOpen(false)
      reload()
    } catch (error) {
      if (!activeRef.current) return
      toast(error instanceof Error ? error.message : 'Erro ao arquivar cliente.', 'error')
    } finally {
      archiveSavingRef.current = false
      if (activeRef.current) setArchiveSaving(false)
    }
  }

  if (detailState.status === 'loading') {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
        <span role="status" className="sr-only">Carregando cliente…</span>
      </div>
    )
  }

  if (detailState.status === 'error') {
    return (
      <Card className="border-danger/40" role="alert">
        <p className="text-sm font-medium text-danger">Não foi possível carregar o cliente.</p>
        <p className="mt-1 text-sm text-muted">{detailState.message}</p>
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="outline" onClick={reload}>Tentar novamente</Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/clientes')}>Voltar para clientes</Button>
        </div>
      </Card>
    )
  }

  if (detailState.status === 'empty') {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Cliente não encontrado."
        description="O registro pode ter sido arquivado ou não está disponível."
        action={<Link to="/clientes" className="text-sm text-accent hover:underline">Voltar para clientes</Link>}
      />
    )
  }

  const detail = detailState.detail
  const contracts = [...detail.contracts].sort(compareContracts)
  const selectedContract = contracts.find((contract) => contract.id === selectedContractId) ?? contracts[0] ?? null
  const initialContract = [...detail.contracts].sort((a, b) =>
    a.contracted_at.localeCompare(b.contracted_at) || a.id.localeCompare(b.id),
  )[0] ?? null

  return (
    <div className="flex flex-col gap-5" aria-busy={refreshing}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/clientes" className="mb-1 inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
            <ArrowLeft className="h-3 w-3" aria-hidden="true" /> Clientes
          </Link>
          <h1 className="font-display text-xl font-bold text-ink">{detail.client.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
              {CLIENT_STATUS_LABELS[detail.client.status]}
            </span>
            <span>Origem: {SOURCE_LABELS[detail.client.source] ?? detail.client.source}</span>
            {refreshing && <span role="status">Atualizando…</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={reload}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Atualizar
          </Button>
          <Button type="button" variant="outline" onClick={() => setEditing(true)} disabled={!selectedContract || refreshing}>
            <Pencil className="h-4 w-4" aria-hidden="true" /> Editar cliente
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => setArchiveOpen(true)}
            disabled={detail.client.status === 'inactive' || refreshing || archiveSaving}
          >
            <Archive className="h-4 w-4" aria-hidden="true" /> Arquivar cliente
          </Button>
        </div>
      </div>

      {detailState.status === 'refresh-error' && (
        <Card className="border-danger/40" role="alert">
          <p className="text-sm font-medium text-danger">Não foi possível atualizar o cliente.</p>
          <p className="mt-1 text-sm text-muted">{detailState.message} Exibindo os últimos dados carregados.</p>
          <Button type="button" variant="outline" className="mt-3" onClick={reload}>Tentar novamente</Button>
        </Card>
      )}

      <div role="tablist" aria-label="Seções do cliente" className="flex flex-wrap gap-2 border-b border-line pb-3">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`client-tab-${tab.value}`}
            aria-selected={activeTab === tab.value}
            aria-controls={`client-panel-${tab.value}`}
            onClick={() => setActiveTab(tab.value)}
            className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${activeTab === tab.value ? 'bg-primary/15 text-primary' : 'text-muted hover:bg-elevated hover:text-ink'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`client-panel-${activeTab}`} aria-labelledby={`client-tab-${activeTab}`}>
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card title="Informações">
              <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                <InfoRow label="Responsável" value={detail.client.responsible_name} />
                <InfoRow label="Telefone" value={detail.client.phone ? formatPhone(detail.client.phone) : null} />
                <InfoRow label="WhatsApp" value={detail.client.whatsapp ? formatPhone(detail.client.whatsapp) : null} />
                <InfoRow label="E-mail" value={detail.client.email} />
                <InfoRow label="CNPJ" value={detail.client.cnpj} />
                <InfoRow label="Site" value={detail.client.website} />
                <InfoRow label="Instagram" value={detail.client.instagram} />
                <InfoRow label="Endereço" value={detail.client.address} />
                <InfoRow label="Cidade" value={detail.client.city} />
                <InfoRow label="Bairro" value={detail.client.district} />
                <InfoRow label="CEP" value={detail.client.zip_code} />
                <InfoRow label="Estado" value={detail.client.state} />
                <InfoRow label="Nicho" value={detail.client.niche} />
                <InfoRow label="Cadastrado em" value={formatDate(detail.client.created_at)} />
                <InfoRow label="Convertido em" value={detail.client.converted_at ? formatDate(detail.client.converted_at) : null} />
              </dl>
              {detail.client.notes && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-elevated p-3 text-sm text-muted">{detail.client.notes}</p>}
            </Card>

            <Card title="Contrato inicial">
              {initialContract ? (
                <dl className="flex flex-col gap-2">
                  <InfoRow label="Serviço" value={initialContract.service} />
                  <InfoRow label="Valor contratado" value={formatMoney(initialContract.total_value_cents)} />
                  <InfoRow label="Data da contratação" value={formatCalendarDate(initialContract.contracted_at)} />
                  <InfoRow label="Vencimento" value={formatCalendarDate(initialContract.due_date)} />
                </dl>
              ) : <p className="text-sm text-muted">Nenhum contrato cadastrado.</p>}
            </Card>

            <Card title="Leads vinculados">
              {detail.linkedLeads.length === 0 ? (
                <p className="text-sm text-muted">Nenhum lead vinculado.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {detail.linkedLeads.map((lead) => (
                    <li key={lead.leadId}>
                      <Link to={`/leads/${lead.leadId}`} className="text-sm text-accent hover:underline">{lead.leadName}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="flex flex-col gap-3">
            {detail.projects.length === 0 ? (
              <Card><p className="text-sm text-muted">Nenhum projeto vinculado.</p></Card>
            ) : detail.projects.map((project) => (
              <Card key={project.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-semibold text-ink">{project.name}</h2>
                    <p className="mt-1 text-sm text-muted">{project.service}</p>
                  </div>
                  <span className="rounded-full bg-elevated px-2.5 py-0.5 text-xs text-muted">{PROJECT_STATUS_LABELS[project.status]}</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <InfoRow label="Prazo" value={formatCalendarDate(project.due_date)} />
                  <InfoRow label="Valor alocado" value={formatMoney(project.contracted_value_cents)} />
                </dl>
              </Card>
            ))}
            <p className="text-xs text-muted">Tarefas, revisões e entregas serão disponibilizadas no Plano 2 da Etapa 3.</p>
          </div>
        )}

        {activeTab === 'financeiro' && (
          <div className="flex flex-col gap-4">
            {!selectedContract ? (
              <Card><p className="text-sm text-muted">Nenhum contrato cadastrado.</p></Card>
            ) : (
              <>
                {contracts.length > 1 && (
                  <Select
                    label="Contrato"
                    value={selectedContract.id}
                    onChange={(event) => setSelectedContractId(event.target.value)}
                    options={contracts.map((contract) => ({
                      value: contract.id,
                      label: `${contract.service} · ${formatCalendarDate(contract.contracted_at)}`,
                    }))}
                    className="max-w-md"
                  />
                )}
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="font-display text-base font-semibold text-ink">{selectedContract.service}</h2>
                    <span className="rounded-full bg-elevated px-2.5 py-0.5 text-xs text-muted">{CONTRACT_STATUS_LABELS[selectedContract.status]}</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                    <InfoRow label="Valor contratado" value={formatMoney(selectedContract.total_value_cents)} />
                    <InfoRow label="Data da contratação" value={formatCalendarDate(selectedContract.contracted_at)} />
                    <InfoRow label="Vencimento" value={formatCalendarDate(selectedContract.due_date)} />
                    <InfoRow label="Forma de pagamento" value={selectedContract.payment_method ? PAYMENT_METHOD_LABELS[selectedContract.payment_method] ?? selectedContract.payment_method : null} />
                    <InfoRow label="Condições de pagamento" value={selectedContract.payment_terms} />
                  </dl>
                  {selectedContract.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{selectedContract.notes}</p>}
                </Card>
                <p className="text-xs text-muted">Pagamentos, estornos e despesas serão exibidos no módulo Financeiro.</p>
              </>
            )}
          </div>
        )}

        {activeTab === 'historico' && <ClientHistory entries={detail.history} />}
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Editar cliente" wide>
        {selectedContract && (
          <ClientForm
            mode="edit"
            client={detail.client}
            contract={selectedContract}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false)
              toast('Cliente atualizado.')
              reload()
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={archiveOpen}
        title="Arquivar cliente"
        description={`Arquivar "${detail.client.name}"? O cliente ficará inativo e seus contratos, projetos e histórico serão preservados.`}
        confirmLabel="Confirmar arquivamento"
        loading={archiveSaving}
        onConfirm={() => void confirmArchive()}
        onCancel={() => {
          if (!archiveSavingRef.current) setArchiveOpen(false)
        }}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run tests and build**

Run: `npm test -- src/lib/calendarDate.test.ts src/pages/ClientDetailPage.test.tsx src/components/clients/ClientHistory.test.tsx && npm run build`
Expected: PASS and build exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/clients/ClientHistory.tsx src/components/clients/ClientHistory.test.tsx src/lib/calendarDate.ts src/lib/calendarDate.test.ts src/pages/ClientDetailPage.tsx src/pages/ClientDetailPage.test.tsx
git commit -m "feat: adicionar detalhe e historico do cliente"
```

---

### Task 11: Exibir conversão no histórico e travar valores financeiros do lead

**Files:**
- Modify: `src/types/activity.ts`
- Modify: `src/types/activity.test.ts`
- Modify: `src/components/leads/LeadTimeline.tsx`
- Modify: `src/components/leads/LeadTimeline.test.tsx`
- Modify: `src/components/leads/ContactDialog.tsx`
- Modify: `src/components/leads/ContactDialog.test.tsx`
- Modify: `src/components/leads/LeadForm.tsx`
- Modify: `src/components/leads/LeadForm.test.tsx`
- Modify: `src/pages/LeadEditPage.tsx`
- Create: `src/pages/LeadEditPage.test.tsx`

**Interfaces:**
- Consumes: `getLeadClientLink`; activity type `conversao` already brought forward by Task 6.
- Produces: `LeadForm` prop `financialFieldsLocked?: boolean`; refresh em background sem apagar o último histórico válido.

- [ ] **Step 1: Add failing regression tests**

Substitua os testes existentes de tipos, `LeadTimeline`, `ContactDialog` e `LeadForm` pelos arquivos completos abaixo e crie somente `LeadEditPage.test.tsx`, que continua ausente. As fixtures de lead e vínculo são completas; os únicos casts são os de elementos DOM necessários às asserções nativas.

```ts
// src/types/activity.test.ts
import { describe, expect, it } from 'vitest'
import { ACTIVITY_LABELS, ACTIVITY_TYPES } from './activity'

describe('activity types', () => {
  it('inclui conversão como atividade automática rotulada em pt-BR', () => {
    expect(ACTIVITY_TYPES).toContain('conversao')
    expect(ACTIVITY_LABELS.conversao).toBe('Conversão em cliente')
  })

  it('não afirma envio quando o WhatsApp foi apenas aberto', () => {
    expect(ACTIVITY_LABELS.mensagem).toBe('Mensagem registrada')
  })

  it('fornece rótulo não vazio para todo tipo aceito', () => {
    for (const type of ACTIVITY_TYPES) {
      expect(ACTIVITY_LABELS[type].trim().length).toBeGreaterThan(0)
    }
  })
})
```

```tsx
// src/components/leads/LeadTimeline.test.tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Activity } from '../../types/activity'

const { listActivities } = vi.hoisted(() => ({ listActivities: vi.fn() }))
vi.mock('../../services/activityService', () => ({ listActivities }))

import { LeadTimeline } from './LeadTimeline'

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'activity-1',
    lead_id: 'lead-1',
    owner_id: 'owner-1',
    type: 'primeiro_contato',
    description: 'Primeiro contato realizado.',
    user_id: 'user-1',
    created_at: '2026-11-25T12:00:00Z',
    ...overrides,
  }
}

function deferredActivities() {
  let resolve!: (activities: Activity[]) => void
  const promise = new Promise<Activity[]>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

function renderTimeline(leadId = 'lead-1', refreshKey = 0) {
  return render(
    <MemoryRouter>
      <LeadTimeline leadId={leadId} refreshKey={refreshKey} />
    </MemoryRouter>,
  )
}

afterEach(cleanup)

beforeEach(() => {
  listActivities.mockReset().mockResolvedValue([])
})

describe('LeadTimeline', () => {
  it('exibe carregamento acessível antes das atividades', async () => {
    const pending = deferredActivities()
    listActivities.mockReturnValue(pending.promise)
    renderTimeline()

    expect(screen.getByRole('status').textContent).toBe('Carregando histórico de contatos…')
    await act(async () => {
      pending.resolve([])
      await pending.promise
    })
    expect(await screen.findByRole('heading', { name: 'Nenhum contato registrado' })).toBeTruthy()
  })

  it('renderiza conversão com rótulo e ícone próprios', async () => {
    listActivities.mockResolvedValue([
      makeActivity({ type: 'conversao', description: 'Lead convertido em cliente.' }),
    ])
    renderTimeline()

    const list = await screen.findByRole('list', { name: 'Atividades do lead' })
    const item = within(list).getByRole('listitem')
    expect(item.textContent).toContain('Conversão em cliente')
    expect(item.textContent).toContain('Lead convertido em cliente.')
    expect(item.querySelector('svg.lucide-user-check')).not.toBeNull()
    expect(listActivities).toHaveBeenCalledWith('lead-1')
  })

  it('apresenta estado vazio sem criar contatos', async () => {
    renderTimeline()
    expect(await screen.findByRole('heading', { name: 'Nenhum contato registrado' })).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Atividades do lead' })).toBeNull()
  })

  it('mostra erro e permite repetir a leitura', async () => {
    listActivities.mockRejectedValueOnce(new Error('Falha no histórico.'))
      .mockResolvedValueOnce([makeActivity({ description: 'Contato recuperado.' })])
    renderTimeline()

    expect((await screen.findByRole('alert')).textContent).toContain('Falha no histórico.')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Contato recuperado.')).toBeTruthy()
    expect(listActivities).toHaveBeenCalledTimes(2)
  })

  it('recarrega quando refreshKey muda sem remontar nem apagar o histórico válido', async () => {
    const pending = deferredActivities()
    listActivities.mockResolvedValueOnce([makeActivity({ description: 'Versão antiga.' })])
      .mockReturnValueOnce(pending.promise)
    const view = renderTimeline()
    expect(await screen.findByText('Versão antiga.')).toBeTruthy()

    view.rerender(
      <MemoryRouter>
        <LeadTimeline leadId="lead-1" refreshKey={1} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(listActivities).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Versão antiga.')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Atualizando histórico de contatos…')

    await act(async () => {
      pending.resolve([makeActivity({ id: 'activity-2', description: 'Versão nova.' })])
      await pending.promise
    })
    expect(await screen.findByText('Versão nova.')).toBeTruthy()
    expect(screen.queryByText('Versão antiga.')).toBeNull()
  })

  it('preserva o último histórico quando o refresh falha e permite tentar novamente', async () => {
    listActivities.mockResolvedValueOnce([makeActivity({ description: 'Histórico válido.' })])
      .mockRejectedValueOnce(new Error('Falha no refresh.'))
      .mockResolvedValueOnce([makeActivity({ id: 'activity-2', description: 'Histórico atualizado.' })])
    const view = renderTimeline()
    expect(await screen.findByText('Histórico válido.')).toBeTruthy()

    view.rerender(
      <MemoryRouter>
        <LeadTimeline leadId="lead-1" refreshKey={1} />
      </MemoryRouter>,
    )
    expect((await screen.findByRole('alert')).textContent).toContain('Falha no refresh.')
    expect(screen.getByText('Histórico válido.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Histórico atualizado.')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('descarta a resposta de um lead que deixou de ser exibido', async () => {
    const first = deferredActivities()
    const second = deferredActivities()
    listActivities.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const view = renderTimeline('lead-1')
    await waitFor(() => expect(listActivities).toHaveBeenCalledTimes(1))

    view.rerender(
      <MemoryRouter>
        <LeadTimeline leadId="lead-2" refreshKey={0} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(listActivities).toHaveBeenCalledTimes(2))

    await act(async () => {
      second.resolve([makeActivity({ id: 'new', lead_id: 'lead-2', description: 'Atividade do lead 2.' })])
      await second.promise
    })
    expect(await screen.findByText('Atividade do lead 2.')).toBeTruthy()

    await act(async () => {
      first.resolve([makeActivity({ description: 'Atividade obsoleta do lead 1.' })])
      await first.promise
    })
    expect(screen.getByText('Atividade do lead 2.')).toBeTruthy()
    expect(screen.queryByText('Atividade obsoleta do lead 1.')).toBeNull()
  })
})
```

```tsx
// src/components/leads/ContactDialog.test.tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STATUS_LABELS, type LeadStatus } from '../../types/lead'

const { addActivity, setLeadStatus, toast } = vi.hoisted(() => ({
  addActivity: vi.fn(),
  setLeadStatus: vi.fn(),
  toast: vi.fn(),
}))
vi.mock('../../services/activityService', () => ({ addActivity }))
vi.mock('../../services/leadService', () => ({ setLeadStatus }))
vi.mock('../../hooks/useToast', () => ({ useToast: () => ({ toast }) }))

import { ContactDialog } from './ContactDialog'

function renderDialog(currentStatus: LeadStatus = 'novo') {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  render(
    <MemoryRouter>
      <ContactDialog
        open
        leadId="lead-1"
        currentStatus={currentStatus}
        onClose={onClose}
        onSaved={onSaved}
      />
    </MemoryRouter>,
  )
  return { onClose, onSaved }
}

afterEach(cleanup)

beforeEach(() => {
  addActivity.mockReset().mockResolvedValue({})
  setLeadStatus.mockReset().mockResolvedValue({})
  toast.mockReset()
})

describe('ContactDialog', () => {
  it('não oferece conversão, mudança de status ou follow-up como atividade manual', () => {
    renderDialog()
    const select = screen.getByLabelText('Tipo de atividade')
    const values = within(select).getAllByRole('option').map((option) => (option as HTMLOptionElement).value)

    expect(values).toContain('primeiro_contato')
    expect(values).not.toContain('conversao')
    expect(values).not.toContain('mudanca_status')
    expect(values).not.toContain('follow_up')
  })

  it('exige descrição antes de registrar', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))

    expect(screen.getByText('Descreva o contato ou observação.')).toBeTruthy()
    expect(addActivity).not.toHaveBeenCalled()
  })

  it('registra o contato sem mudar o status quando nenhum status é escolhido', async () => {
    const { onClose, onSaved } = renderDialog()
    fireEvent.change(screen.getByLabelText('Tipo de atividade'), { target: { value: 'mensagem' } })
    fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Mensagem combinada.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))

    await waitFor(() => expect(addActivity).toHaveBeenCalledWith('lead-1', 'mensagem', 'Mensagem combinada.'))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(setLeadStatus).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('Contato registrado.')
  })

  it('confirma explicitamente a mudança de status antes de gravar', async () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Cliente pediu proposta.' } })
    fireEvent.change(screen.getByLabelText('Mudar status para (opcional — confirmação explícita)'), {
      target: { value: 'negociando' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))

    const confirmation = screen.getByRole('dialog', { name: 'Confirmar registro e mudança de status' })
    expect(confirmation.textContent).toContain(`${STATUS_LABELS.novo} para ${STATUS_LABELS.negociando}`)
    expect(addActivity).not.toHaveBeenCalled()
    expect(setLeadStatus).not.toHaveBeenCalled()

    fireEvent.click(within(confirmation).getByRole('button', { name: 'Confirmar e registrar' }))
    await waitFor(() => expect(addActivity).toHaveBeenCalledWith('lead-1', 'primeiro_contato', 'Cliente pediu proposta.'))
    await waitFor(() => expect(setLeadStatus).toHaveBeenCalledWith('lead-1', 'negociando'))
  })

  it('não grava quando a confirmação de status é cancelada', () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Conversa registrada.' } })
    fireEvent.change(screen.getByLabelText('Mudar status para (opcional — confirmação explícita)'), {
      target: { value: 'interessado' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    const confirmation = screen.getByRole('dialog', { name: 'Confirmar registro e mudança de status' })
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog', { name: 'Confirmar registro e mudança de status' })).toBeNull()
    expect(addActivity).not.toHaveBeenCalled()
    expect(setLeadStatus).not.toHaveBeenCalled()
  })

  it('repete somente a mudança de status quando o contato já foi gravado', async () => {
    const { onSaved } = renderDialog()
    setLeadStatus.mockRejectedValueOnce(new Error('Status indisponível.')).mockResolvedValueOnce({})
    fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Contato já registrado.' } })
    fireEvent.change(screen.getByLabelText('Mudar status para (opcional — confirmação explícita)'), {
      target: { value: 'negociando' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e registrar' }))

    expect((await screen.findByText(/O contato foi registrado, mas não foi possível mudar o status/)).textContent)
      .toContain('O contato foi registrado, mas não foi possível mudar o status.')
    expect(addActivity).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Repetir mudança de status' }))

    await waitFor(() => expect(setLeadStatus).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(addActivity).toHaveBeenCalledTimes(1)
  })
})
```

```tsx
// src/components/leads/LeadForm.test.tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyLeadDraft, type Lead, type LeadWrite } from '../../types/lead'

const { createLead, updateLead, findDuplicateCandidates, getSettings } = vi.hoisted(() => ({
  createLead: vi.fn(),
  updateLead: vi.fn(),
  findDuplicateCandidates: vi.fn(),
  getSettings: vi.fn(),
}))
vi.mock('../../services/leadService', () => ({ createLead, updateLead, findDuplicateCandidates }))
vi.mock('../../services/settingsService', () => ({ getSettings }))

import { LeadForm } from './LeadForm'

const lead: Lead = {
  ...emptyLeadDraft(),
  id: 'lead-1',
  owner_id: 'owner-1',
  name: 'Estabelecimento de teste',
  phone: '11999999999',
  status: 'novo',
  next_contact_at: null,
  last_verified_at: null,
  score: 0,
  priority: 'media',
  needs: [],
  score_reasons: [],
  created_at: '2026-11-25T12:00:00Z',
  updated_at: '2026-11-25T12:00:00Z',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

function renderForm(options: { leadId?: string; financialFieldsLocked?: boolean; initial?: LeadWrite } = {}) {
  const onSaved = vi.fn()
  const view = render(
    <MemoryRouter>
      <LeadForm
        initial={options.initial ?? { ...emptyLeadDraft(), name: lead.name, status: 'novo' }}
        leadId={options.leadId}
        financialFieldsLocked={options.financialFieldsLocked}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />
    </MemoryRouter>,
  )
  return { onSaved, unmount: view.unmount }
}

afterEach(cleanup)

beforeEach(() => {
  createLead.mockReset()
  updateLead.mockReset().mockResolvedValue(lead)
  findDuplicateCandidates.mockReset().mockResolvedValue([])
  getSettings.mockReset().mockResolvedValue({
    owner_id: 'owner-1',
    service_prices: { site: 0, landing: 0, cardapio: 0, catalogo: 0, outros: 0 },
    whatsapp_template: '',
  })
})

describe('LeadForm', () => {
  it('não permite mudar status diretamente ao editar', () => {
    renderForm({ leadId: lead.id })
    expect((screen.getByLabelText('Status') as HTMLSelectElement).disabled).toBe(true)
    expect(screen.getByText(/Use a ficha do lead para alterar o status com confirmação/)).toBeTruthy()
  })

  it('permite escolher o status inicial no cadastro', () => {
    renderForm()
    expect((screen.getByLabelText('Status') as HTMLSelectElement).disabled).toBe(false)
  })

  it('mantém valores financeiros editáveis por padrão', () => {
    renderForm()
    expect((screen.getByLabelText('Valor contratado (R$)') as HTMLInputElement).disabled).toBe(false)
    expect((screen.getByLabelText('Valor recebido (R$)') as HTMLInputElement).disabled).toBe(false)
    expect(screen.queryByText(/Após a conversão, contrato e recebimentos/)).toBeNull()
  })

  it('trava somente contrato e recebimento de lead convertido', () => {
    renderForm({ leadId: lead.id, financialFieldsLocked: true })

    expect((screen.getByLabelText('Valor contratado (R$)') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText('Valor recebido (R$)') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText('Nome do estabelecimento *') as HTMLInputElement).disabled).toBe(false)
    expect((screen.getByLabelText('Telefone') as HTMLInputElement).disabled).toBe(false)
    expect(screen.getByText('Após a conversão, contrato e recebimentos são gerenciados no cliente.')).toBeTruthy()
  })

  it('preserva os valores bloqueados ao salvar alterações não financeiras', async () => {
    renderForm({
      leadId: lead.id,
      financialFieldsLocked: true,
      initial: { ...emptyLeadDraft(), name: lead.name, phone: lead.phone, status: 'novo', contracted_value: 1500, received_value: 500 },
    })
    fireEvent.change(screen.getByLabelText('Nome do estabelecimento *'), { target: { value: 'Nome atualizado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(updateLead).toHaveBeenCalledWith(lead.id, expect.objectContaining({
      name: 'Nome atualizado',
      contracted_value: 1500,
      received_value: 500,
    })))
  })

  it('permite alterar contrato e recebimento quando não estão bloqueados', async () => {
    renderForm({ leadId: lead.id, financialFieldsLocked: false })
    fireEvent.change(screen.getByLabelText('Valor contratado (R$)'), { target: { value: '2500' } })
    fireEvent.change(screen.getByLabelText('Valor recebido (R$)'), { target: { value: '750' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(updateLead).toHaveBeenCalledWith(lead.id, expect.objectContaining({
      contracted_value: 2500,
      received_value: 750,
    })))
  })

  it('não inicia a mutação quando a consulta de duplicidade termina após o unmount', async () => {
    const pending = deferred<Lead[]>()
    findDuplicateCandidates.mockReturnValue(pending.promise)
    const { unmount } = renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar lead' }))
    await waitFor(() => expect(findDuplicateCandidates).toHaveBeenCalledTimes(1))

    unmount()
    await act(async () => {
      pending.resolve([])
      await pending.promise
    })

    expect(createLead).not.toHaveBeenCalled()
    expect(updateLead).not.toHaveBeenCalled()
  })

  it('não chama onSaved quando a mutação termina após o unmount', async () => {
    const pending = deferred<Lead>()
    updateLead.mockReturnValue(pending.promise)
    const { onSaved, unmount } = renderForm({ leadId: lead.id })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(updateLead).toHaveBeenCalledTimes(1))

    unmount()
    await act(async () => {
      pending.resolve(lead)
      await pending.promise
    })

    expect(onSaved).not.toHaveBeenCalled()
  })
})
```

```tsx
// src/pages/LeadEditPage.test.tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LeadClientLink } from '../types/client'
import { emptyLeadDraft, type Lead } from '../types/lead'

const { getLead, createLead, updateLead, findDuplicateCandidates, getLeadClientLink, getSettings, toast } = vi.hoisted(() => ({
  getLead: vi.fn(),
  createLead: vi.fn(),
  updateLead: vi.fn(),
  findDuplicateCandidates: vi.fn(),
  getLeadClientLink: vi.fn(),
  getSettings: vi.fn(),
  toast: vi.fn(),
}))
vi.mock('../services/leadService', () => ({ getLead, createLead, updateLead, findDuplicateCandidates }))
vi.mock('../services/clientService', () => ({ getLeadClientLink }))
vi.mock('../services/settingsService', () => ({ getSettings }))
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ toast }) }))

import { LeadEditPage } from './LeadEditPage'

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    ...emptyLeadDraft(),
    id: 'lead-1',
    owner_id: 'owner-1',
    name: 'Empresa Teste',
    responsible_name: 'Ana Responsável',
    phone: '11999999999',
    status: 'aceitou',
    next_contact_at: null,
    last_verified_at: null,
    contracted_value: 1500,
    received_value: 500,
    score: 0,
    priority: 'media',
    needs: [],
    score_reasons: [],
    created_at: '2026-11-25T12:00:00Z',
    updated_at: '2026-11-25T12:00:00Z',
    ...overrides,
  }
}

const lead = makeLead()
const link: LeadClientLink = {
  id: 'link-1',
  owner_id: 'owner-1',
  lead_id: 'lead-1',
  client_id: 'client-1',
  converted_at: '2026-11-25T12:00:00Z',
  created_at: '2026-11-25T12:00:00Z',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

function NavigationControl() {
  const navigate = useNavigate()
  return <button type="button" onClick={() => navigate('/leads/lead-2/edit')}>Abrir lead 2</button>
}

function renderEditPage() {
  return render(
    <MemoryRouter initialEntries={['/leads/lead-1/edit']}>
      <NavigationControl />
      <Routes>
        <Route path="/leads/:id/edit" element={<LeadEditPage />} />
        <Route path="/leads/:id" element={<div>Ficha do lead</div>} />
        <Route path="/leads" element={<div>Lista de leads</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(cleanup)

beforeEach(() => {
  getLead.mockReset().mockResolvedValue(lead)
  createLead.mockReset()
  updateLead.mockReset().mockResolvedValue(lead)
  findDuplicateCandidates.mockReset().mockResolvedValue([])
  getLeadClientLink.mockReset().mockResolvedValue(null)
  getSettings.mockReset().mockResolvedValue({
    owner_id: 'owner-1',
    service_prices: { site: 0, landing: 0, cardapio: 0, catalogo: 0, outros: 0 },
    whatsapp_template: '',
  })
  toast.mockReset()
})

describe('LeadEditPage', () => {
  it('carrega lead e vínculo juntos e trava valores de lead convertido', async () => {
    const pendingLead = deferred<Lead>()
    const pendingLink = deferred<LeadClientLink | null>()
    getLead.mockReturnValue(pendingLead.promise)
    getLeadClientLink.mockReturnValue(pendingLink.promise)
    renderEditPage()

    expect(getLead).toHaveBeenCalledWith('lead-1')
    expect(getLeadClientLink).toHaveBeenCalledWith('lead-1')
    expect(screen.getByRole('status').textContent).toBe('Carregando lead…')

    await act(async () => {
      pendingLead.resolve(lead)
      pendingLink.resolve(link)
      await Promise.all([pendingLead.promise, pendingLink.promise])
    })

    expect((await screen.findByLabelText('Nome do estabelecimento *') as HTMLInputElement).value).toBe('Empresa Teste')
    expect((screen.getByLabelText('Valor contratado (R$)') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText('Valor recebido (R$)') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText('Telefone') as HTMLInputElement).disabled).toBe(false)
  })

  it('mantém valores financeiros editáveis quando não existe vínculo', async () => {
    renderEditPage()
    await screen.findByLabelText('Nome do estabelecimento *')

    expect((screen.getByLabelText('Valor contratado (R$)') as HTMLInputElement).disabled).toBe(false)
    expect((screen.getByLabelText('Valor recebido (R$)') as HTMLInputElement).disabled).toBe(false)
  })

  it('não presume lead não convertido quando a consulta do vínculo falha', async () => {
    getLeadClientLink.mockRejectedValueOnce(new Error('Falha ao consultar vínculo.'))
      .mockResolvedValueOnce(null)
    renderEditPage()

    expect((await screen.findByRole('alert')).textContent).toContain('Falha ao consultar vínculo.')
    expect(screen.queryByLabelText('Nome do estabelecimento *')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(await screen.findByLabelText('Nome do estabelecimento *')).toBeTruthy()
    expect(getLeadClientLink).toHaveBeenCalledTimes(2)
  })

  it('salva dados não financeiros sem alterar valores bloqueados e volta à ficha', async () => {
    getLeadClientLink.mockResolvedValue(link)
    renderEditPage()
    fireEvent.change(await screen.findByLabelText('Nome do estabelecimento *'), { target: { value: 'Empresa Editada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(updateLead).toHaveBeenCalledWith('lead-1', expect.objectContaining({
      name: 'Empresa Editada',
      contracted_value: 1500,
      received_value: 500,
    })))
    expect(await screen.findByText('Ficha do lead')).toBeTruthy()
    expect(toast).toHaveBeenCalledWith('Alterações salvas.')
  })

  it('apresenta erro e retry quando o lead não pode ser carregado', async () => {
    getLead.mockRejectedValueOnce(new Error('Lead indisponível.')).mockResolvedValueOnce(lead)
    renderEditPage()

    expect((await screen.findByRole('alert')).textContent).toContain('Lead indisponível.')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByLabelText('Nome do estabelecimento *')).toBeTruthy()
  })

  it('apresenta estado vazio quando o lead não existe', async () => {
    getLead.mockResolvedValue(null)
    renderEditPage()
    expect((await screen.findByRole('alert')).textContent).toContain('Lead não encontrado.')
    expect(screen.queryByLabelText('Nome do estabelecimento *')).toBeNull()
  })

  it('não mostra toast nem navega com um salvamento concluído após trocar de lead', async () => {
    const pendingSave = deferred<Lead>()
    const secondLead = makeLead({ id: 'lead-2', name: 'Empresa Dois' })
    getLead.mockResolvedValueOnce(lead).mockResolvedValueOnce(secondLead)
    updateLead.mockReturnValue(pendingSave.promise)
    renderEditPage()
    fireEvent.change(await screen.findByLabelText('Nome do estabelecimento *'), { target: { value: 'Empresa Editada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(updateLead).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: 'Abrir lead 2' }))
    expect((await screen.findByLabelText('Nome do estabelecimento *') as HTMLInputElement).value).toBe('Empresa Dois')
    await act(async () => {
      pendingSave.resolve(lead)
      await pendingSave.promise
    })

    expect(toast).not.toHaveBeenCalled()
    expect((screen.getByLabelText('Nome do estabelecimento *') as HTMLInputElement).value).toBe('Empresa Dois')
  })

  it('descarta lead e vínculo obsoletos após navegar para outro id', async () => {
    const firstLead = deferred<Lead>()
    const firstLink = deferred<LeadClientLink | null>()
    const secondLead = makeLead({ id: 'lead-2', name: 'Empresa Dois' })
    getLead.mockReturnValueOnce(firstLead.promise).mockResolvedValueOnce(secondLead)
    getLeadClientLink.mockReturnValueOnce(firstLink.promise).mockResolvedValueOnce(null)
    renderEditPage()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir lead 2' }))

    expect((await screen.findByLabelText('Nome do estabelecimento *') as HTMLInputElement).value).toBe('Empresa Dois')
    await act(async () => {
      firstLead.resolve(lead)
      firstLink.resolve(link)
      await Promise.all([firstLead.promise, firstLink.promise])
    })
    expect((screen.getByLabelText('Nome do estabelecimento *') as HTMLInputElement).value).toBe('Empresa Dois')
    expect((screen.getByLabelText('Valor contratado (R$)') as HTMLInputElement).disabled).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/types/activity.test.ts src/components/leads/LeadTimeline.test.tsx src/components/leads/ContactDialog.test.tsx src/components/leads/LeadForm.test.tsx src/pages/LeadEditPage.test.tsx`
Expected: FAIL because the lock prop, link lookup and background-refresh behavior do not exist yet; `conversao` and its basic rendering/filter regressions were brought forward by Task 6.

- [ ] **Step 3: Implement the changes**

Substitua `src/types/activity.ts` pelo arquivo abaixo. A conversão passa a ser um tipo persistível, mas o diálogo de contato continua impedindo sua seleção manual.

```ts
// src/types/activity.ts
export const ACTIVITY_TYPES = [
  'primeiro_contato', 'mensagem', 'ligacao', 'resposta', 'reuniao',
  'proposta', 'mudanca_status', 'observacao', 'follow_up', 'conversao', 'outro',
] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  primeiro_contato: 'Primeiro contato',
  mensagem: 'Mensagem registrada',
  ligacao: 'Ligação realizada',
  resposta: 'Resposta recebida',
  reuniao: 'Reunião',
  proposta: 'Envio de proposta',
  mudanca_status: 'Mudança de status',
  observacao: 'Observação',
  follow_up: 'Follow-up',
  conversao: 'Conversão em cliente',
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

Substitua `src/components/leads/LeadTimeline.tsx` pelo arquivo abaixo, preservando a chave somente por lead e os guards de resposta obsoleta.

```tsx
// src/components/leads/LeadTimeline.tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowRightLeft, CalendarClock, FileText, MessageSquare, Phone,
  PhoneIncoming, StickyNote, UserCheck, Users, type LucideIcon,
} from 'lucide-react'
import { listActivities } from '../../services/activityService'
import { ACTIVITY_LABELS, type Activity, type ActivityType } from '../../types/activity'
import { formatDateTime } from '../../lib/format'
import { Button } from '../ui/Button'
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
  conversao: UserCheck,
  outro: StickyNote,
}

export function LeadTimeline({ leadId, refreshKey }: { leadId: string; refreshKey: number }) {
  return <LeadTimelineContent key={leadId} leadId={leadId} refreshKey={refreshKey} />
}

function LeadTimelineContent({ leadId, refreshKey }: { leadId: string; refreshKey: number }) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef(0)
  const mountedRef = useRef(true)
  const hasLoadedRef = useRef(false)

  const loadActivities = useCallback(async (background: boolean) => {
    if (!mountedRef.current) return
    const request = ++requestRef.current
    setRefreshing(background)
    if (!background) {
      setActivities([])
      setLoading(true)
      setError(null)
    }

    try {
      const nextActivities = await listActivities(leadId)
      if (!mountedRef.current || request !== requestRef.current) return
      hasLoadedRef.current = true
      setActivities(nextActivities)
      setError(null)
    } catch (cause) {
      if (!mountedRef.current || request !== requestRef.current) return
      setError(cause instanceof Error ? cause.message : 'Erro ao carregar histórico.')
    } finally {
      if (mountedRef.current && request === requestRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [leadId])

  useEffect(() => {
    mountedRef.current = true
    void loadActivities(hasLoadedRef.current)
    return () => {
      mountedRef.current = false
      requestRef.current += 1
    }
  }, [loadActivities, refreshKey])

  const retry = () => void loadActivities(hasLoadedRef.current)

  return (
    <Card title="Histórico de contatos" dot="pink" aria-busy={loading || refreshing}>
      {loading && <span role="status" className="sr-only">Carregando histórico de contatos…</span>}
      {refreshing && <span role="status" className="sr-only">Atualizando histórico de contatos…</span>}
      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
          <p className="text-sm font-medium text-danger">Não foi possível carregar o histórico.</p>
          <p className="mt-1 text-sm text-muted">{error}</p>
          <Button type="button" variant="outline" className="mt-3" onClick={retry} disabled={refreshing}>
            Tentar novamente
          </Button>
        </div>
      )}
      {loading ? (
        <Skeleton className="h-32" />
      ) : activities.length === 0 ? (
        !error && (
          <EmptyState
            icon={MessageSquare}
            title="Nenhum contato registrado"
            description="Registre o primeiro contato, ligação ou observação para começar o histórico deste lead."
          />
        )
      ) : (
        <ol className="flex flex-col" aria-label="Atividades do lead">
          {activities.map((activity, index) => {
            const Icon = icons[activity.type]
            return (
              <li key={activity.id} className="relative flex gap-3 pb-5 last:pb-0">
                {index < activities.length - 1 && (
                  <span
                    className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-line"
                    aria-hidden="true"
                  />
                )}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-elevated">
                  <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{ACTIVITY_LABELS[activity.type]}</p>
                  <p className="whitespace-pre-wrap break-words text-sm text-muted">{activity.description}</p>
                  <time dateTime={activity.created_at} className="mt-0.5 block text-xs text-muted/70">
                    {formatDateTime(activity.created_at)}
                  </time>
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

Substitua `src/components/leads/ContactDialog.tsx` pelo arquivo abaixo. A única mudança de catálogo é excluir também `conversao`; a confirmação de status e a repetição sem duplicar a atividade permanecem intactas.

```tsx
// src/components/leads/ContactDialog.tsx
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { addActivity } from '../../services/activityService'
import { setLeadStatus } from '../../services/leadService'
import { ACTIVITY_LABELS, ACTIVITY_TYPES, type ActivityType } from '../../types/activity'
import { LEAD_STATUSES, STATUS_LABELS, type LeadStatus } from '../../types/lead'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'

interface ContactDialogProps {
  open: boolean
  leadId: string
  currentStatus: LeadStatus
  onClose: () => void
  onSaved: () => void
}

export function ContactDialog(props: ContactDialogProps) {
  return (
    <ContactDialogContent
      key={`${props.leadId}:${props.open ? 'open' : 'closed'}`}
      {...props}
    />
  )
}

function ContactDialogContent({ open, leadId, currentStatus, onClose, onSaved }: ContactDialogProps) {
  const { toast } = useToast()
  const [type, setType] = useState<ActivityType>('primeiro_contato')
  const [description, setDescription] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [activityCreated, setActivityCreated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)
  const activityCreatedRef = useRef(false)
  const mountedRef = useRef(true)
  const sessionRef = useRef(0)

  const resetForm = useCallback(() => {
    sessionRef.current += 1
    savingRef.current = false
    activityCreatedRef.current = false
    setType('primeiro_contato')
    setDescription('')
    setNewStatus('')
    setSaving(false)
    setConfirming(false)
    setActivityCreated(false)
    setError(null)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      sessionRef.current += 1
    }
  }, [])

  const saveContact = async () => {
    if (savingRef.current) return
    const session = sessionRef.current
    const contactDescription = description.trim()
    const targetStatus = newStatus as LeadStatus | ''

    savingRef.current = true
    setSaving(true)
    setConfirming(false)
    setError(null)

    try {
      if (!activityCreatedRef.current) {
        await addActivity(leadId, type, contactDescription)
        if (!mountedRef.current || session !== sessionRef.current) return
        activityCreatedRef.current = true
        setActivityCreated(true)
      }

      if (targetStatus && targetStatus !== currentStatus) {
        await setLeadStatus(leadId, targetStatus)
        if (!mountedRef.current || session !== sessionRef.current) return
      }
    } catch (cause) {
      if (!mountedRef.current || session !== sessionRef.current) return
      const message = cause instanceof Error ? cause.message : 'Erro ao registrar.'
      if (activityCreatedRef.current && targetStatus && targetStatus !== currentStatus) {
        setError(
          `O contato foi registrado, mas não foi possível mudar o status. ${message} `
          + 'Use “Repetir mudança de status” para tentar novamente; o contato não será registrado outra vez.',
        )
      } else {
        setError(`Não foi possível registrar o contato. ${message} Nenhuma mudança de status foi aplicada.`)
      }
      return
    } finally {
      savingRef.current = false
      if (mountedRef.current && session === sessionRef.current) setSaving(false)
    }

    toast('Contato registrado.')
    onSaved()
    resetForm()
    onClose()
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (savingRef.current || confirming) return
    if (!description.trim()) {
      setError('Descreva o contato ou observação.')
      return
    }

    if (activityCreatedRef.current) {
      void saveContact()
      return
    }

    if (newStatus && newStatus !== currentStatus) {
      setError(null)
      setConfirming(true)
      return
    }

    void saveContact()
  }

  const handleClose = () => {
    if (savingRef.current) return
    if (activityCreatedRef.current) onSaved()
    resetForm()
    onClose()
  }

  const cancelConfirmation = () => {
    if (savingRef.current) return
    setConfirming(false)
  }

  const fieldsDisabled = saving || confirming || activityCreated
  const statusLabel = newStatus ? STATUS_LABELS[newStatus as LeadStatus] : ''

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Registrar contato"
      dismissible={!saving && !confirming}
    >
      <form onSubmit={submit} className="flex flex-col gap-4" aria-busy={saving}>
        <Select
          label="Tipo de atividade"
          value={type}
          onChange={(event) => setType(event.target.value as ActivityType)}
          options={ACTIVITY_TYPES
            .filter((activityType) => activityType !== 'mudanca_status' && activityType !== 'follow_up' && activityType !== 'conversao')
            .map((activityType) => ({ value: activityType, label: ACTIVITY_LABELS[activityType] }))}
          disabled={fieldsDisabled}
        />
        <div aria-live="polite">
          <Textarea
            label="Descrição *"
            value={description}
            error={error ?? undefined}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="O que foi conversado, enviado ou combinado?"
            disabled={fieldsDisabled}
            rows={5}
          />
        </div>
        <Select
          label="Mudar status para (opcional — confirmação explícita)"
          placeholder="Manter status atual"
          value={newStatus}
          onChange={(event) => setNewStatus(event.target.value)}
          options={LEAD_STATUSES
            .filter((status) => status !== currentStatus)
            .map((status) => ({ value: status, label: STATUS_LABELS[status] }))}
          disabled={fieldsDisabled}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" variant="mint" loading={saving} disabled={confirming}>
            {activityCreated ? 'Repetir mudança de status' : 'Registrar'}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirming}
        title="Confirmar registro e mudança de status"
        description={`Registrar o contato e mudar o status de ${STATUS_LABELS[currentStatus]} para ${statusLabel}?`}
        confirmLabel="Confirmar e registrar"
        loading={saving}
        onConfirm={() => void saveContact()}
        onCancel={cancelConfirmation}
      />
    </Modal>
  )
}
```

Substitua `src/components/leads/LeadForm.tsx` pelo arquivo abaixo. `financialFieldsLocked` é opcional para preservar todos os chamadores atuais e se soma ao estado de salvamento/duplicidade, sem trancar nome, telefone ou status além das regras existentes.

```tsx
// src/components/leads/LeadForm.tsx
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
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
  financialFieldsLocked?: boolean
  onSaved: (lead: Lead) => void
  onCancel: () => void
}

const sectionTitle = 'font-display text-sm font-semibold text-ink'

export function LeadForm({ initial, leadId, financialFieldsLocked = false, onSaved, onCancel }: LeadFormProps) {
  const [draft, setDraft] = useState<LeadWrite>(initial ?? emptyLeadDraft())
  const [errors, setErrors] = useState<LeadDraftErrors>({})
  const [saving, setSaving] = useState(false)
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<Lead[]>([])
  const [duplicateLookupFailed, setDuplicateLookupFailed] = useState(false)
  const [prices, setPrices] = useState<ServicePrices | null>(null)
  const mountedRef = useRef(true)
  const requestRef = useRef(0)
  const busyRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestRef.current += 1
    }
  }, [])

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

  const persist = async (payload: LeadWrite, request: number) => {
    if (!mountedRef.current || request !== requestRef.current || busyRef.current) return
    busyRef.current = true
    setSaving(true)
    setSaveError(null)
    try {
      const lead = leadId ? await updateLead(leadId, payload) : await createLead(payload)
      if (!mountedRef.current || request !== requestRef.current) return
      onSaved(lead)
    } catch (error) {
      if (!mountedRef.current || request !== requestRef.current) return
      setSaveError(error instanceof Error ? error.message : 'Erro ao salvar.')
    } finally {
      if (mountedRef.current && request === requestRef.current) {
        busyRef.current = false
        setSaving(false)
      }
    }
  }

  const save = async (skipDuplicateCheck: boolean) => {
    if (busyRef.current || !mountedRef.current) return

    const validation = validateLeadDraft(draft)
    setErrors(validation)
    setSaveError(null)
    if (Object.values(validation).some(Boolean)) return

    const payload = normalizeLeadDraftForSave(draft)
    const request = ++requestRef.current
    setDuplicates([])
    setDuplicateLookupFailed(false)

    if (skipDuplicateCheck) {
      await persist(payload, request)
      return
    }

    busyRef.current = true
    setCheckingDuplicates(true)
    let shouldPersist = false
    try {
      const candidates = await findDuplicateCandidates(
        { phone: payload.phone, whatsapp: payload.whatsapp, cnpj: payload.cnpj, name: payload.name, city: payload.city },
        leadId,
      )
      if (!mountedRef.current || request !== requestRef.current) return
      if (candidates.length > 0) {
        setDuplicates(candidates)
      } else {
        shouldPersist = true
      }
    } catch {
      if (!mountedRef.current || request !== requestRef.current) return
      setDuplicateLookupFailed(true)
    } finally {
      if (mountedRef.current && request === requestRef.current) {
        busyRef.current = false
        setCheckingDuplicates(false)
      }
    }

    if (shouldPersist && mountedRef.current && request === requestRef.current) {
      await persist(payload, request)
    }
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
          <Input disabled={busy || financialFieldsLocked} label="Valor contratado (R$)" type="number" min="0" step="0.01" value={String(draft.contracted_value)} error={errors.contracted_value} onChange={(event) => set('contracted_value', Number(event.target.value) || 0)} />
          <Input disabled={busy || financialFieldsLocked} label="Valor recebido (R$)" type="number" min="0" step="0.01" value={String(draft.received_value)} error={errors.received_value} onChange={(event) => set('received_value', Number(event.target.value) || 0)} />
          {financialFieldsLocked && (
            <p className="text-xs text-muted sm:col-span-2">Após a conversão, contrato e recebimentos são gerenciados no cliente.</p>
          )}
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
          <p className="mt-1 text-xs text-muted">Encontramos {duplicates.length === 1 ? 'um registro' : `${duplicates.length} registros`} com telefone, WhatsApp, CNPJ ou nome+localização parecidos. Verifique antes de cadastrar:</p>
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
```

Substitua `src/pages/LeadEditPage.tsx` pelo arquivo abaixo. O formulário somente aparece depois que lead e vínculo foram resolvidos; uma falha no vínculo produz erro/retry, nunca campos financeiros liberados por suposição.

```tsx
// src/pages/LeadEditPage.tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getLead } from '../services/leadService'
import { getLeadClientLink } from '../services/clientService'
import type { LeadClientLink } from '../types/client'
import type { Lead, LeadWrite } from '../types/lead'
import { LeadForm } from '../components/leads/LeadForm'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../hooks/useToast'

type EditLoadState =
  | { status: 'loading'; id: string }
  | { status: 'ready'; id: string; lead: Lead; link: LeadClientLink | null }
  | { status: 'error'; id: string; message: string }
  | { status: 'empty'; id: string }

export function LeadEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [loadState, setLoadState] = useState<EditLoadState | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const activeRef = useRef(true)
  const requestRef = useRef(0)

  const loadLeadAndLink = useCallback(async () => {
    if (!id || !activeRef.current) return
    const request = ++requestRef.current
    setLoadState({ status: 'loading', id })

    const [leadResult, linkResult] = await Promise.allSettled([
      getLead(id),
      getLeadClientLink(id),
    ])
    if (!activeRef.current || request !== requestRef.current) return

    if (leadResult.status === 'rejected') {
      setLoadState({
        status: 'error',
        id,
        message: leadResult.reason instanceof Error ? leadResult.reason.message : 'Erro ao carregar lead.',
      })
      return
    }
    if (!leadResult.value) {
      setLoadState({ status: 'empty', id })
      return
    }
    if (linkResult.status === 'rejected') {
      const message = linkResult.reason instanceof Error ? linkResult.reason.message : 'Erro ao consultar vínculo.'
      setLoadState({ status: 'error', id, message: `Não foi possível verificar o vínculo com o cliente. ${message}` })
      return
    }

    setLoadState({ status: 'ready', id, lead: leadResult.value, link: linkResult.value })
  }, [id, reloadKey])

  useEffect(() => {
    activeRef.current = true
    void loadLeadAndLink()
    return () => {
      activeRef.current = false
      requestRef.current += 1
    }
  }, [loadLeadAndLink])

  const retry = () => {
    setLoadState(null)
    setReloadKey((key) => key + 1)
  }

  if (!id) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <h1 className="font-display text-xl font-bold text-ink">Editar lead</h1>
        <Card className="border-danger/40" role="alert">
          <p className="text-sm text-danger">Lead não encontrado.</p>
          <Button variant="outline" className="mt-3" onClick={() => navigate('/leads')}>Voltar para leads</Button>
        </Card>
      </div>
    )
  }

  if (!loadState || loadState.id !== id || loadState.status === 'loading') {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-5" aria-busy="true">
        <h1 className="font-display text-xl font-bold text-ink">Editar lead</h1>
        <Skeleton className="h-96" />
        <span role="status" className="sr-only">Carregando lead…</span>
      </div>
    )
  }

  if (loadState.status === 'error') {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <h1 className="font-display text-xl font-bold text-ink">Editar lead</h1>
        <Card className="border-danger/40" role="alert">
          <p className="text-sm text-danger">{loadState.message}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={retry}>Tentar novamente</Button>
            <Button variant="ghost" onClick={() => navigate('/leads')}>Voltar para leads</Button>
          </div>
        </Card>
      </div>
    )
  }

  if (loadState.status === 'empty') {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <h1 className="font-display text-xl font-bold text-ink">Editar lead</h1>
        <Card className="border-danger/40" role="alert">
          <p className="text-sm text-danger">Lead não encontrado.</p>
          <Button variant="outline" className="mt-3" onClick={() => navigate('/leads')}>Voltar para leads</Button>
        </Card>
      </div>
    )
  }

  const lead = loadState.lead
  const {
    id: _id,
    owner_id: _ownerId,
    created_at: _createdAt,
    updated_at: _updatedAt,
    next_contact_at: _nextContactAt,
    last_verified_at: _lastVerifiedAt,
    score: _score,
    priority: _priority,
    needs: _needs,
    score_reasons: _scoreReasons,
    ...editable
  } = lead
  const initial: LeadWrite = {
    name: editable.name,
    responsible_name: editable.responsible_name,
    niche: editable.niche,
    phone: editable.phone,
    whatsapp: editable.whatsapp,
    email: editable.email,
    cnpj: editable.cnpj,
    instagram: editable.instagram,
    facebook: editable.facebook,
    website: editable.website,
    menu_url: editable.menu_url,
    catalog_url: editable.catalog_url,
    country: editable.country,
    state: editable.state,
    city: editable.city,
    district: editable.district,
    address: editable.address,
    zip_code: editable.zip_code,
    has_website: editable.has_website,
    has_instagram: editable.has_instagram,
    has_facebook: editable.has_facebook,
    has_digital_menu: editable.has_digital_menu,
    has_digital_catalog: editable.has_digital_catalog,
    has_landing_page: editable.has_landing_page,
    has_business_whatsapp: editable.has_business_whatsapp,
    status: editable.status,
    offered_service: editable.offered_service,
    notes: editable.notes,
    source: editable.source,
    estimated_value: editable.estimated_value,
    negotiated_value: editable.negotiated_value,
    contracted_value: editable.contracted_value,
    received_value: editable.received_value,
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <h1 className="font-display text-xl font-bold text-ink">Editar lead</h1>
      <Card>
        <LeadForm
          initial={initial}
          leadId={lead.id}
          financialFieldsLocked={Boolean(loadState.link)}
          onSaved={(savedLead) => {
            toast('Alterações salvas.')
            navigate(`/leads/${savedLead.id}`)
          }}
          onCancel={() => navigate('/leads')}
        />
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Run tests and build**

Run: `npm test -- src/types/activity.test.ts src/components/leads/LeadTimeline.test.tsx src/components/leads/ContactDialog.test.tsx src/components/leads/LeadForm.test.tsx src/pages/LeadEditPage.test.tsx && npm run build`
Expected: PASS and build exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/types/activity.ts src/types/activity.test.ts src/components/leads/LeadTimeline.tsx src/components/leads/LeadTimeline.test.tsx src/components/leads/ContactDialog.tsx src/components/leads/ContactDialog.test.tsx src/components/leads/LeadForm.tsx src/components/leads/LeadForm.test.tsx src/pages/LeadEditPage.tsx src/pages/LeadEditPage.test.tsx
git commit -m "feat: registrar conversao e travar valores do lead"
```

---

### Task 12: Integrar conversão à ficha do lead

**Files:**
- Modify: `src/pages/LeadDetailPage.tsx`
- Create: `src/pages/LeadDetailPage.test.tsx`

**Interfaces:**
- Consumes: `getLeadClientLink(leadId: string): Promise<LeadClientLink | null>` from `src/services/clientService.ts`; `LeadClientLink` from `src/types/client.ts`; `ConversionDialog` from Task 7.
- Produces: ação “Converter em cliente”, link “Ver cliente” para `/clientes/:id` e `ConversionDialog` controlado por `conversionOpen`.

- [ ] **Step 1: Write the failing integration tests**

Create the complete file below. O `ConversionDialog` real usa os labels “Converter lead em cliente”, “Serviço contratado *”, “Valor contratado *”, “Data da contratação *” e “Confirmar conversão”. O mock de `clientService` precisa exportar tanto `getLeadClientLink` usado pela página quanto `convertLeadToClient` usado pelo diálogo. Não use matchers jest-dom.

```tsx
// @vitest-environment jsdom
// src/pages/LeadDetailPage.test.tsx
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyLeadDraft, type Lead } from '../types/lead'
import type { LeadClientLink } from '../types/client'

const { getLead, setLeadStatus, getLeadClientLink, convertLeadToClient, listActivities, toast } = vi.hoisted(() => ({
  getLead: vi.fn(),
  setLeadStatus: vi.fn(),
  getLeadClientLink: vi.fn(),
  convertLeadToClient: vi.fn(),
  listActivities: vi.fn(),
  toast: vi.fn(),
}))
vi.mock('../services/leadService', () => ({ getLead, setLeadStatus }))
vi.mock('../services/clientService', () => ({ getLeadClientLink, convertLeadToClient }))
vi.mock('../services/activityService', () => ({ listActivities }))
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ toast }) }))
vi.mock('../components/leads/ContactDialog', () => ({ ContactDialog: () => null }))
vi.mock('../components/leads/FollowupDialog', () => ({ FollowupDialog: () => null }))
vi.mock('../components/leads/WhatsAppDialog', () => ({ WhatsAppDialog: () => null }))
vi.mock('../components/leads/LeadChecklist', () => ({ LeadChecklist: () => null }))
vi.mock('../components/leads/LeadFollowups', () => ({ LeadFollowups: () => null }))
vi.mock('../components/leads/OpportunityPanel', () => ({ OpportunityPanel: () => null }))

import { LeadDetailPage } from './LeadDetailPage'

const lead: Lead = {
  ...emptyLeadDraft(),
  id: 'lead-1',
  owner_id: 'owner-1',
  name: 'Empresa Teste',
  status: 'negociando',
  score: 0,
  priority: 'media',
  needs: [],
  score_reasons: [],
  next_contact_at: null,
  last_verified_at: null,
  created_at: '2026-11-25T12:00:00Z',
  updated_at: '2026-11-25T12:00:00Z',
}

const clientLink: LeadClientLink = {
  id: 'link-1',
  owner_id: lead.owner_id,
  lead_id: lead.id,
  client_id: 'client-1',
  converted_at: '2026-11-25T12:00:00Z',
  created_at: '2026-11-25T12:00:00Z',
}

function renderLeadDetail() {
  return render(
    <MemoryRouter initialEntries={['/leads/lead-1']}>
      <Routes>
        <Route path="/leads/:id" element={<LeadDetailPage />} />
        <Route path="/clientes/:id" element={<div>Ficha do cliente</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(cleanup)

describe('LeadDetailPage — conversão', () => {
  beforeEach(() => {
    getLead.mockReset().mockResolvedValue(lead)
    setLeadStatus.mockReset()
    getLeadClientLink.mockReset().mockResolvedValue(null)
    convertLeadToClient.mockReset()
    listActivities.mockReset().mockResolvedValue([])
    toast.mockReset()
  })

  it('mostra Converter em cliente, abre o diálogo real e preserva o foco ao cancelar', async () => {
    renderLeadDetail()
    const opener = await screen.findByRole('button', { name: 'Converter em cliente' })

    expect(getLead).toHaveBeenCalledTimes(1)
    expect(getLead).toHaveBeenCalledWith(lead.id)
    expect(getLeadClientLink).toHaveBeenCalledTimes(1)
    expect(getLeadClientLink).toHaveBeenCalledWith(lead.id)

    opener.focus()
    fireEvent.click(opener)
    expect(screen.getByRole('dialog', { name: 'Converter lead em cliente' })).toBeTruthy()
    expect((screen.getByLabelText('Status') as HTMLSelectElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(document.activeElement).toBe(opener))
    expect((screen.getByLabelText('Status') as HTMLSelectElement).disabled).toBe(false)
  })

  it('mostra Ver cliente e não repete a conversão quando existe vínculo real', async () => {
    getLeadClientLink.mockResolvedValue(clientLink)
    renderLeadDetail()

    const link = await screen.findByRole('link', { name: 'Ver cliente' })
    expect(link.getAttribute('href')).toBe('/clientes/client-1')
    expect(screen.queryByRole('button', { name: 'Converter em cliente' })).toBeNull()
    expect(convertLeadToClient).not.toHaveBeenCalled()
  })

  it('recarrega lead e vínculo no mesmo ciclo após conversão confirmada', async () => {
    getLead.mockResolvedValueOnce(lead).mockResolvedValueOnce({ ...lead, status: 'aceitou' })
    getLeadClientLink.mockResolvedValueOnce(null).mockResolvedValueOnce(clientLink)
    convertLeadToClient.mockResolvedValue({
      client_id: clientLink.client_id,
      link_id: clientLink.id,
      contract_id: 'contract-1',
      project_id: null,
      already_existed: false,
    })
    listActivities.mockResolvedValueOnce([]).mockResolvedValueOnce([{
      id: 'activity-conversion', lead_id: lead.id, owner_id: lead.owner_id,
      type: 'conversao', description: 'Lead convertido em cliente.', user_id: null, created_at: '2026-11-25T12:00:00Z',
    }])
    renderLeadDetail()

    fireEvent.click(await screen.findByRole('button', { name: 'Converter em cliente' }))
    fireEvent.change(screen.getByLabelText('Serviço contratado *'), { target: { value: 'Site' } })
    fireEvent.change(screen.getByLabelText('Valor contratado *'), { target: { value: '1000,00' } })
    fireEvent.change(screen.getByLabelText('Data da contratação *'), { target: { value: '2026-11-25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conversão' }))

    const convertedLink = await screen.findByRole('link', { name: 'Ver cliente' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('heading', { name: lead.name })).toBeTruthy()
    expect(await screen.findByText('Lead convertido em cliente.')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(convertedLink))
    expect(convertLeadToClient).toHaveBeenCalledWith(lead.id, {
      service: 'Site',
      contractedValueCents: 100000,
      contractedAt: '2026-11-25',
      paymentMethod: '',
      paymentTerms: '',
      notes: '',
      project: null,
    })
    expect(getLead).toHaveBeenCalledTimes(2)
    expect(getLeadClientLink).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(listActivities).toHaveBeenCalledTimes(2))
  })

  it('preserva Ver cliente e o vínculo conhecido quando o refresh em background falha', async () => {
    const updated = { ...lead, status: 'interessado' as const }
    getLead.mockResolvedValueOnce(lead).mockResolvedValueOnce(updated)
    getLeadClientLink.mockResolvedValueOnce(clientLink).mockRejectedValueOnce(new Error('Falha temporária.'))
    setLeadStatus.mockResolvedValue(updated)
    renderLeadDetail()

    const link = await screen.findByRole('link', { name: 'Ver cliente' })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'interessado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mudar status' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Falha temporária.')
    expect(screen.getByRole('link', { name: 'Ver cliente' })).toBe(link)
    expect(screen.queryByRole('button', { name: 'Converter em cliente' })).toBeNull()
  })

  it('não trata falha do vínculo como não convertido e permite retry do ciclo completo', async () => {
    getLeadClientLink.mockRejectedValueOnce(new Error('Falha ao consultar vínculo.')).mockResolvedValueOnce(clientLink)
    renderLeadDetail()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Não foi possível verificar o vínculo com o cliente.')
    expect(alert.textContent).toContain('Falha ao consultar vínculo.')
    expect((screen.getByRole('button', { name: 'Converter em cliente' }) as HTMLButtonElement).disabled).toBe(true)
    expect(convertLeadToClient).not.toHaveBeenCalled()

    fireEvent.click(within(alert).getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('link', { name: 'Ver cliente' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(getLead).toHaveBeenCalledTimes(2)
    expect(getLeadClientLink).toHaveBeenCalledTimes(2)
  })

  it('atualiza lead e vínculo juntos em background após mudança de status', async () => {
    const updated = { ...lead, status: 'interessado' as const }
    getLead.mockResolvedValueOnce(lead).mockResolvedValueOnce(updated)
    setLeadStatus.mockResolvedValue(updated)
    renderLeadDetail()
    await screen.findByRole('heading', { name: lead.name })

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'interessado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mudar status' }))

    await waitFor(() => expect(getLead).toHaveBeenCalledTimes(2))
    expect(getLeadClientLink).toHaveBeenCalledTimes(2)
    expect(setLeadStatus).toHaveBeenCalledWith(lead.id, 'interessado')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/pages/LeadDetailPage.test.tsx`
Expected: FAIL porque `LinkLoadState`, `fetchLeadAndLink`, a ação “Converter em cliente”, o link “Ver cliente” e o alerta de retry ainda não existem.

- [ ] **Step 3: Implement the integration**

Adicione exatamente estes imports em `src/pages/LeadDetailPage.tsx`:

```tsx
import { getLeadClientLink } from '../services/clientService'
import type { LeadClientLink } from '../types/client'
import { ConversionDialog } from '../components/leads/ConversionDialog'
```

Mantenha `LeadLoadState` e declare `LinkLoadState` imediatamente depois dele:

```tsx
type LinkLoadState =
  | { status: 'loading' }
  | { status: 'ready'; link: LeadClientLink | null }
  | { status: 'error'; message: string; link: LeadClientLink | null }
```

Em `LeadDetailContent`, adicione os estados após `loadState`:

```tsx
const [linkLoadState, setLinkLoadState] = useState<LinkLoadState>({ status: 'loading' })
const [conversionOpen, setConversionOpen] = useState(false)
const [timelineRefreshKey, setTimelineRefreshKey] = useState(0)
const pendingConversionFocusRef = useRef(false)
const convertedClientLinkRef = useRef<HTMLAnchorElement | null>(null)
const link = linkLoadState.status === 'ready' || linkLoadState.status === 'error'
  ? linkLoadState.link
  : null
```

Substitua a declaração de `focusOpenerRef` por:

```tsx
const focusOpenerRef = useRef<HTMLButtonElement | HTMLSelectElement | HTMLAnchorElement | null>(null)
```

Substitua integralmente o bloco `fetchLead`, `reload` e o efeito de montagem `[leadId]` pelo ciclo único abaixo. `Promise.allSettled` inicia lead e vínculo juntos; `requestRef` descarta respostas obsoletas e `activeRef` impede atualização após desmontagem:

```tsx
const fetchLeadAndLink = useCallback(async (background = false) => {
  if (!activeRef.current) return
  const request = ++requestRef.current
  if (background) {
    setRefreshing(true)
  } else {
    setRefreshing(false)
    setLoadState({ status: 'loading' })
    setLinkLoadState({ status: 'loading' })
  }

  const [leadResult, linkResult] = await Promise.allSettled([
    getLead(leadId),
    getLeadClientLink(leadId),
  ])
  if (!activeRef.current || request !== requestRef.current) return

  if (leadResult.status === 'rejected') {
    const message = leadResult.reason instanceof Error ? leadResult.reason.message : 'Erro ao carregar lead.'
    setLoadState((current) => {
      if (background && current && (current.status === 'ready' || current.status === 'refresh-error')) {
        return { status: 'refresh-error', lead: current.lead, message }
      }
      return { status: 'error', message }
    })
    setRefreshing(false)
    return
  }
  if (!leadResult.value) {
    setLoadState({ status: 'empty' })
    setRefreshing(false)
    return
  }

  setLoadState({ status: 'ready', lead: leadResult.value })
  if (linkResult.status === 'rejected') {
    const message = linkResult.reason instanceof Error ? linkResult.reason.message : 'Erro ao consultar vínculo.'
    setLinkLoadState((current) => ({
      status: 'error',
      message,
      link: background && (current.status === 'ready' || current.status === 'error') ? current.link : null,
    }))
  } else {
    setLinkLoadState({ status: 'ready', link: linkResult.value })
  }
  setRefreshing(false)
}, [leadId])

const reload = useCallback(async (background = false) => {
  if (!activeRef.current) return
  await fetchLeadAndLink(background)
}, [fetchLeadAndLink])

useEffect(() => {
  activeRef.current = true
  void fetchLeadAndLink()
  return () => {
    activeRef.current = false
    requestRef.current += 1
  }
}, [fetchLeadAndLink])
```

Mantenha `handleLeadChanged` e o caminho de sucesso de `confirmStatusChange` chamando `reload(true)`. Substitua o efeito de restauração de foco por:

```tsx
useEffect(() => {
  if (contactOpen || followupOpen || whatsappOpen || conversionOpen || pendingStatus !== null || statusSaving || refreshing) return
  const opener = focusOpenerRef.current
  focusOpenerRef.current = null
  if (opener?.isConnected && !('disabled' in opener && opener.disabled)) opener.focus()
}, [contactOpen, followupOpen, whatsappOpen, conversionOpen, pendingStatus, statusSaving, refreshing])

useEffect(() => {
  if (!pendingConversionFocusRef.current || conversionOpen || refreshing || !link) return
  pendingConversionFocusRef.current = false
  convertedClientLinkRef.current?.focus()
}, [conversionOpen, refreshing, link])
```

Substitua a definição de `statusControlsDisabled` por:

```tsx
const statusControlsDisabled = statusSaving || contactOpen || followupOpen || whatsappOpen || conversionOpen || pendingStatus !== null || refreshing
```

Insira o alerta de vínculo imediatamente após o `Card` de `loadState.status === 'refresh-error'`:

```tsx
{linkLoadState.status === 'error' && (
  <Card className="border-danger/40" role="alert">
    <p className="text-sm font-medium text-danger">Não foi possível verificar o vínculo com o cliente.</p>
    <p className="mt-1 text-sm text-muted">{linkLoadState.message}</p>
    <Button variant="outline" className="mt-3" disabled={refreshing} onClick={() => void reload(true)}>
      Tentar novamente
    </Button>
  </Card>
)}
```

Insira a ação abaixo imediatamente antes do botão “Editar”, na região de ações existente:

```tsx
{link ? (
  <Link
    ref={convertedClientLinkRef}
    to={`/clientes/${link.client_id}`}
    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
  >
    Ver cliente
  </Link>
) : (
  <Button
    type="button"
    variant="mint"
    onClick={(event) => {
      if (statusControlsDisabled || linkLoadState.status !== 'ready') return
      focusOpenerRef.current = event.currentTarget
      setConversionOpen(true)
    }}
    disabled={statusControlsDisabled || linkLoadState.status !== 'ready'}
  >
    Converter em cliente
  </Button>
)}
```

Troque o refresh da timeline para um contador independente, sem substituir o refresh usado por `LeadFollowups`:

```tsx
<LeadTimeline leadId={lead.id} refreshKey={timelineRefreshKey} />
```

Renderize o diálogo depois de `WhatsAppDialog`:

```tsx
<ConversionDialog
  open={conversionOpen}
  lead={lead}
  existingClientId={link?.client_id ?? null}
  onClose={() => setConversionOpen(false)}
  onConverted={() => {
    pendingConversionFocusRef.current = true
    setConversionOpen(false)
    setTimelineRefreshKey((key) => key + 1)
    void reload(true)
  }}
/>
```

`onConverted` não navega para o cliente: o refresh em background exibe “Ver cliente”, direciona o foco a esse novo link e atualiza o histórico com a atividade `conversao`; a navegação continua sendo uma ação explícita. Falha do vínculo fica em `status: 'error'` e preserva o último `link` conhecido: um refresh malsucedido não transforma um cliente já vinculado em lead não convertido. Sem snapshot, o botão permanece desabilitado até o retry.

- [ ] **Step 4: Run tests and build**

Run: `npm test -- src/pages/LeadDetailPage.test.tsx && npm run build`
Expected: PASS dos seis testes e build exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/pages/LeadDetailPage.tsx src/pages/LeadDetailPage.test.tsx
git commit -m "feat: integrar conversao na ficha do lead"
```

---

### Task 13: Integrar conversão ao Pipeline sem alterar o arraste

**Files:**
- Modify: `src/components/pipeline/KanbanCard.tsx`
- Modify: `src/components/pipeline/KanbanColumn.tsx`
- Modify: `src/pages/PipelinePage.tsx`
- Modify: `src/pages/PipelinePage.test.tsx`

Todos os testes novos desta task ficam exclusivamente no arquivo existente `src/pages/PipelinePage.test.tsx`; não crie arquivos de teste para os componentes.

**Interfaces:**
- Consumes: `listLeadClientLinks(): Promise<LeadClientLink[]>` de `src/services/clientService.ts`; `ConversionDialog` da Task 7; `LeadClientLink` de `src/types/client.ts`.
- Produces: `LeadConversionAction` apresentacional exportada de `KanbanCard.tsx`; mapa global de `lead_id → client_id`; estados `linksReady`, `linksError` e `linksRetryKey`; abertura da conversão por lead.

- [ ] **Step 1: Write the failing integration tests in the existing Pipeline test file**

Faça estas alterações exatas em `src/pages/PipelinePage.test.tsx`.

Adicione os imports:

```tsx
import type { ConversionDialogProps } from '../components/leads/ConversionDialog'
import type { LeadClientLink } from '../types/client'
import { listLeadClientLinks } from '../services/clientService'
```

Adicione os mocks depois dos mocks de serviços existentes. O diálogo é mockado para testar a orquestração da página; os labels do mock são os mesmos do diálogo real:

```tsx
vi.mock('../services/clientService', () => ({ listLeadClientLinks: vi.fn() }))
vi.mock('../components/leads/ConversionDialog', () => ({
  ConversionDialog: ({ open, lead, onClose, onConverted }: ConversionDialogProps) => open ? (
    <div role="dialog" aria-label="Converter lead em cliente">
      <p>{lead.name}</p>
      <button type="button" onClick={onClose}>Cancelar</button>
      <button
        type="button"
        onClick={() => onConverted({
          client_id: 'client-1',
          link_id: 'link-1',
          contract_id: 'contract-1',
          project_id: null,
          already_existed: false,
        })}
      >
        Confirmar conversão
      </button>
    </div>
  ) : null,
}))
```

Adicione a rota de destino dentro de `renderPage`:

```tsx
<Route path="/clientes/:id" element={<div>Ficha do cliente</div>} />
```

No `beforeEach`, depois de `mockLeads(PIPELINE_LEADS)`, restaure o default do serviço de vínculos:

```tsx
vi.mocked(listLeadClientLinks).mockResolvedValue([])
```

Substitua `mobileNames` para não assumir que o link do lead é o único link do card convertido:

```tsx
function mobileNames() {
  return mobileEntries().map((entry) => {
    const leadLink = within(entry).getAllByRole('link')
      .find((link) => link.getAttribute('href')?.startsWith('/leads/'))
    expect(leadLink).toBeTruthy()
    return leadLink!.textContent
  })
}
```

Adicione os helpers abaixo. Desktop e mobile estão ambos montados via CSS; por isso cada query de card/action é feita dentro da coluna ou do `listitem` correspondente:

```tsx
async function desktopCard(lead: Lead) {
  const column = await screen.findByRole('group', { name: STATUS_LABELS[lead.status] })
  const card = within(column).getByRole('link', { name: lead.name })
    .closest('[aria-roledescription="draggable"]')
  expect(card).toBeTruthy()
  return within(card as HTMLElement)
}

async function mobileEntry(leadName: string) {
  await screen.findByRole('listitem')
  const entry = mobileEntries().find((item) => within(item).queryByRole('link', { name: leadName }))
  expect(entry).toBeTruthy()
  return within(entry as HTMLElement)
}

function makeLink(lead: Lead, clientId: string): LeadClientLink {
  return {
    id: `link-${lead.id}`,
    owner_id: lead.owner_id,
    lead_id: lead.id,
    client_id: clientId,
    converted_at: '2026-11-25T12:00:00Z',
    created_at: '2026-11-25T12:00:00Z',
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
```

Insira o bloco de testes abaixo imediatamente antes de `describe('PipelinePage consulta', () => {`:

```tsx
describe('PipelinePage — conversão', () => {
  it('mostra Ver cliente no desktop e no mobile quando existe vínculo real', async () => {
    const clientLink = makeLink(barbearia, 'client-barbearia')
    vi.mocked(listLeadClientLinks).mockResolvedValue([clientLink])
    renderPage()

    const desktop = await desktopCard(barbearia)
    const desktopLink = await desktop.findByRole('link', { name: 'Ver cliente' })
    const mobile = await mobileEntry(barbearia.name)
    const mobileLink = mobile.getByRole('link', { name: 'Ver cliente' })

    expect(desktopLink.getAttribute('href')).toBe('/clientes/client-barbearia')
    expect(mobileLink.getAttribute('href')).toBe('/clientes/client-barbearia')
    expect(desktop.queryByRole('button', { name: 'Converter' })).toBeNull()
    expect(mobile.queryByRole('button', { name: 'Converter' })).toBeNull()
  })

  it('mostra Converter e abre o diálogo para lead sem vínculo, nas duas ramificações', async () => {
    renderPage()

    const desktop = await desktopCard(barbearia)
    const desktopAction = await desktop.findByRole('button', { name: 'Converter' })
    const mobile = await mobileEntry(barbearia.name)
    expect(mobile.getByRole('button', { name: 'Converter' })).toBeTruthy()

    fireEvent.click(desktopAction)
    const dialog = screen.getByRole('dialog', { name: 'Converter lead em cliente' })
    expect(within(dialog).getByText(barbearia.name)).toBeTruthy()
  })

  it('não inicia arraste nem altera status ao clicar ou pressionar Converter', async () => {
    renderPage()
    const desktop = await desktopCard(barbearia)
    const action = await desktop.findByRole('button', { name: 'Converter' })
    const card = action.closest('[aria-roledescription="draggable"]') as HTMLElement

    fireEvent.pointerDown(action)
    fireEvent.click(action)

    expect(card.getAttribute('aria-pressed')).not.toBe('true')
    expect(card.className).not.toContain('opacity-60')
    expect(setLeadStatus).not.toHaveBeenCalled()
    expect((await desktopCard(barbearia)).getByRole('link', { name: barbearia.name })).toBeTruthy()
    expect(columnCount('novo')).toBe(2)
    expect(screen.getByRole('dialog', { name: 'Converter lead em cliente' })).toBeTruthy()
  })

  it('navega em Ver cliente sem gravar mudança de status', async () => {
    vi.mocked(listLeadClientLinks).mockResolvedValue([makeLink(barbearia, 'client-barbearia')])
    renderPage()
    const desktop = await desktopCard(barbearia)
    const link = await desktop.findByRole('link', { name: 'Ver cliente' })

    fireEvent.pointerDown(link)
    fireEvent.click(link)

    expect(await screen.findByText('Ficha do cliente')).toBeTruthy()
    expect(setLeadStatus).not.toHaveBeenCalled()
  })

  it('preserva leads e vínculos conhecidos e permite retry quando a consulta falha', async () => {
    const clientLink = makeLink(barbearia, 'client-barbearia')
    vi.mocked(listLeadClientLinks)
      .mockResolvedValueOnce([clientLink])
      .mockRejectedValueOnce(new Error('Falha ao listar vínculos.'))
      .mockResolvedValueOnce([clientLink])
    renderPage()
    await (await desktopCard(barbearia)).findByRole('link', { name: 'Ver cliente' })

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    const alert = await screen.findByRole('alert')
    await screen.findByRole('group', { name: STATUS_LABELS.novo })

    expect(alert.textContent).toContain('Não foi possível carregar os vínculos de conversão.')
    expect(alert.textContent).toContain('Falha ao listar vínculos.')
    expect(alert.textContent).toContain('A conversão não pode ser verificada; os leads continuam visíveis.')
    expect(alert.textContent).not.toMatch(/não convertido/i)
    const desktop = await desktopCard(barbearia)
    const mobile = await mobileEntry(barbearia.name)
    expect(desktop.getByRole('link', { name: barbearia.name })).toBeTruthy()
    expect(mobile.getByRole('link', { name: barbearia.name })).toBeTruthy()
    expect(desktop.getByRole('link', { name: 'Ver cliente' }).getAttribute('href')).toBe('/clientes/client-barbearia')
    expect(mobile.getByRole('link', { name: 'Ver cliente' }).getAttribute('href')).toBe('/clientes/client-barbearia')
    expect(desktop.queryByRole('button', { name: 'Converter' })).toBeNull()
    expect(mobile.queryByRole('button', { name: 'Converter' })).toBeNull()

    fireEvent.click(within(alert).getByRole('button', { name: 'Tentar novamente' }))
    await (await desktopCard(barbearia)).findByRole('link', { name: 'Ver cliente' })
    expect(listLeadClientLinks).toHaveBeenCalledTimes(3)
    expect(listLeads).toHaveBeenCalledTimes(2)
  })

  it('preserva o snapshot de leads e a fila quando a listagem falha e permite retry', async () => {
    vi.mocked(listLeads)
      .mockResolvedValueOnce({ leads: PIPELINE_LEADS, total: PIPELINE_LEADS.length })
      .mockRejectedValueOnce(new Error('Falha temporária na listagem.'))
      .mockResolvedValueOnce({ leads: PIPELINE_LEADS, total: PIPELINE_LEADS.length })
    renderPage()
    await (await desktopCard(barbearia)).findByRole('link', { name: barbearia.name })

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    const alert = await screen.findByRole('alert')

    expect(alert.textContent).toContain('Falha temporária na listagem.')
    expect(alert.textContent).toContain('último snapshot')
    expect(screen.getByRole('group', { name: STATUS_LABELS.novo })).toBeTruthy()
    expect((await desktopCard(barbearia)).getByRole('link', { name: barbearia.name })).toBeTruthy()
    expect((await mobileEntry(barbearia.name)).getByRole('link', { name: barbearia.name })).toBeTruthy()
    expect(dnd.props?.onDragEnd).toBeTypeOf('function')

    fireEvent.click(within(alert).getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(listLeads).toHaveBeenCalledTimes(3)
    expect((await desktopCard(barbearia)).getByRole('link', { name: barbearia.name })).toBeTruthy()
  })

  it('não reutiliza o snapshot de leads quando uma consulta com filtros diferentes falha', async () => {
    const filtered = PIPELINE_LEADS.filter((lead) => lead.niche === 'pizzaria')
    vi.mocked(listLeads)
      .mockResolvedValueOnce({ leads: PIPELINE_LEADS, total: PIPELINE_LEADS.length })
      .mockRejectedValueOnce(new Error('Falha na consulta filtrada.'))
      .mockResolvedValueOnce({ leads: filtered, total: filtered.length })
    renderPage()
    await (await desktopCard(barbearia)).findByRole('link', { name: barbearia.name })

    fireEvent.change(screen.getByLabelText('Nicho'), { target: { value: 'pizzaria' } })
    const alert = await screen.findByRole('alert')

    expect(alert.textContent).toContain('Falha na consulta filtrada.')
    expect(screen.queryByRole('group', { name: STATUS_LABELS.novo })).toBeNull()
    expect(screen.queryByText(barbearia.name)).toBeNull()
    expect(alert.textContent).not.toContain('último snapshot')

    fireEvent.click(within(alert).getByRole('button', { name: 'Tentar novamente' }))
    await screen.findByRole('group', { name: STATUS_LABELS.novo })
    expect(screen.getByText(pizzaria.name)).toBeTruthy()
    expect(screen.queryByText(barbearia.name)).toBeNull()
  })

  it('mantém o seletor de status e a mesma ação no mobile', async () => {
    const updated = { ...barbearia, status: 'interessado' as const }
    vi.mocked(setLeadStatus).mockResolvedValue(updated)
    renderPage()
    const mobile = await mobileEntry(barbearia.name)
    const selector = mobile.getByRole('combobox', { name: `Mover ${barbearia.name} para` })

    expect(mobile.getByRole('button', { name: 'Converter' })).toBeTruthy()
    fireEvent.click(mobile.getByRole('button', { name: 'Converter' }))
    expect(screen.getByRole('dialog', { name: 'Converter lead em cliente' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.change(selector, { target: { value: 'interessado' } })

    await waitFor(() => expect(setLeadStatus).toHaveBeenCalledWith(barbearia.id, 'interessado'))
    await waitFor(() => expect(mobileNames()).toEqual([pizzaria.name]))
    const remaining = await mobileEntry(pizzaria.name)
    expect(remaining.getByRole('combobox', { name: `Mover ${pizzaria.name} para` })).toBeTruthy()
    expect(remaining.getByRole('button', { name: 'Converter' })).toBeTruthy()
    expect(await (await desktopCard(updated)).findByRole('button', { name: 'Converter' })).toBeTruthy()
  })

  it('fecha o diálogo e atualiza vínculos e leads em background após converter', async () => {
    const pendingLinks = deferred<LeadClientLink[]>()
    const pendingLeads = deferred<{ leads: Lead[]; total: number }>()
    vi.mocked(listLeads)
      .mockResolvedValueOnce({ leads: PIPELINE_LEADS, total: PIPELINE_LEADS.length })
      .mockReturnValueOnce(pendingLeads.promise)
    vi.mocked(listLeadClientLinks)
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(pendingLinks.promise)
    const { container } = renderPage()

    const desktop = await desktopCard(barbearia)
    fireEvent.click(await desktop.findByRole('button', { name: 'Converter' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conversão' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(listLeadClientLinks).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(listLeads).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('group', { name: STATUS_LABELS.novo })).toBeTruthy()
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(0)
    expect(setLeadStatus).not.toHaveBeenCalled()

    const converted = { ...barbearia, status: 'aceitou' as const }
    const clientLink = makeLink(barbearia, 'client-barbearia')
    await act(async () => {
      pendingLinks.resolve([clientLink])
      pendingLeads.resolve({ leads: [converted, pizzaria, salao, clinica, doceria], total: PIPELINE_LEADS.length })
      await Promise.all([pendingLinks.promise, pendingLeads.promise])
    })

    expect(await (await desktopCard(converted)).findByRole('link', { name: 'Ver cliente' })).toBeTruthy()
    await waitFor(() => expect(mobileNames()).toEqual([pizzaria.name]))
  })

  it('descarta resposta de vínculos obsoleta quando Atualizar inicia outro efeito', async () => {
    const first = deferred<LeadClientLink[]>()
    const second = deferred<LeadClientLink[]>()
    vi.mocked(listLeadClientLinks)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    renderPage()
    await waitFor(() => expect(listLeadClientLinks).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    await waitFor(() => expect(listLeadClientLinks).toHaveBeenCalledTimes(2))
    await act(async () => {
      second.resolve([makeLink(barbearia, 'client-atual')])
      await second.promise
    })
    await (await desktopCard(barbearia)).findByRole('link', { name: 'Ver cliente' })

    await act(async () => {
      first.resolve([makeLink(barbearia, 'client-obsoleto')])
      await first.promise
    })
    expect((await desktopCard(barbearia)).getByRole('link', { name: 'Ver cliente' }).getAttribute('href'))
      .toBe('/clientes/client-atual')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/pages/PipelinePage.test.tsx`
Expected: FAIL porque `LeadConversionAction`, as props de conversão, o mapa de vínculos, o banner de retry e os dois refreshes ainda não existem.

- [ ] **Step 3: Implement the shared presentational action**

Substitua integralmente `src/components/pipeline/KanbanCard.tsx` pelo arquivo abaixo. `useDraggable` continua somente no wrapper `KanbanCard`; `KanbanCardBody` recebe `conversionAction?: ReactNode` e continua apresentacional. A ação para `onPointerDown` e `onClick` para não ativar o sensor de arraste:

```tsx
import { useDraggable } from '@dnd-kit/core'
import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Phone } from 'lucide-react'
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import { LEAD_STATUSES, NICHE_LABELS, STATUS_LABELS, type Lead, type LeadStatus, type Niche } from '../../types/lead'
import { formatBRL, formatDate, formatPhone } from '../../lib/format'
import { PriorityBadge } from '../ui/PriorityBadge'
import { Select } from '../ui/Select'
import { cn } from '../../utils/cn'

export interface KanbanCardDrag {
  setNodeRef: (node: HTMLElement | null) => void
  attributes: DraggableAttributes
  listeners: DraggableSyntheticListeners
}

interface KanbanCardBodyProps {
  lead: Lead
  drag?: KanbanCardDrag
  dragging?: boolean
  style?: CSSProperties
  conversionAction?: ReactNode
}

interface LeadConversionActionProps {
  lead: Lead
  convertedClientId?: string
  onConvert?: (lead: Lead) => void
}

const cardClasses = 'rounded-xl border border-line bg-elevated p-3 text-sm transition-shadow'
// cursor-grab/touch-none só fazem sentido onde há arraste: no mobile o toque rola a página.
const dragClasses = 'cursor-grab touch-none active:cursor-grabbing'
const conversionClasses = 'inline-flex h-8 items-center justify-center rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** Ação apresentacional compartilhada pelo card arrastável e pelo card mobile. */
export function LeadConversionAction({ lead, convertedClientId, onConvert }: LeadConversionActionProps) {
  if (!convertedClientId && !onConvert) return null

  if (convertedClientId) {
    return (
      <Link
        to={`/clientes/${convertedClientId}`}
        className={conversionClasses}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        Ver cliente
      </Link>
    )
  }

  return (
    <button
      type="button"
      className={conversionClasses}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onConvert?.(lead)
      }}
    >
      Converter
    </button>
  )
}

/**
 * Corpo do card: só apresentação. Vive com ou sem `DndContext` — por isso o arraste
 * (useDraggable) fica no wrapper `KanbanCard`, nunca em quem não tem contexto.
 */
export function KanbanCardBody({ lead, drag, dragging = false, style, conversionAction }: KanbanCardBodyProps) {
  // estimated_value vem 0 do draft: "não estimado" não é "não vale nada" (regra do tri-estado),
  // e formatBRL converte valor não finito em moeda — daí o guard antes de qualquer R$.
  const hasPotentialValue = Number.isFinite(lead.estimated_value) && lead.estimated_value > 0

  return (
    <div
      ref={drag?.setNodeRef}
      style={style}
      {...drag?.attributes}
      {...drag?.listeners}
      className={cn(cardClasses, drag && dragClasses, dragging && 'opacity-60 shadow-lg shadow-black/50')}
    >
      <Link to={`/leads/${lead.id}`} className="font-medium text-ink hover:text-primary" onClick={(e) => e.stopPropagation()}>
        {lead.name}
      </Link>
      <p className="mt-0.5 text-xs text-muted">{lead.niche ? NICHE_LABELS[lead.niche as Niche] ?? lead.niche : 'Sem nicho'}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <PriorityBadge priority={lead.priority} />
        {hasPotentialValue ? (
          <span className="text-right text-xs text-muted">Potencial estimado {formatBRL(lead.estimated_value)}</span>
        ) : (
          <span className="text-right text-xs text-muted/60">Sem valor estimado</span>
        )}
      </div>
      <div className="mt-2 flex flex-col gap-1 text-xs text-muted">
        {lead.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {formatPhone(lead.phone)}</span>}
        {lead.next_contact_at && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" /> {formatDate(lead.next_contact_at)}</span>}
      </div>
      {conversionAction && <div className="mt-2 flex justify-end">{conversionAction}</div>}
    </div>
  )
}

interface KanbanCardProps {
  lead: Lead
  onMove?: (leadId: string, status: LeadStatus) => void
  convertedClientId?: string
  onConvert?: (lead: Lead) => void
}

/** Card arrastável do quadro: precisa estar dentro de um `DndContext`. */
export function KanbanCard({ lead, onMove, convertedClientId, onConvert }: KanbanCardProps) {
  // Atributos explícitos: o padrão do dnd-kit é `role="button"` + `tabIndex=0`, mas o card tem
  // conteúdo apresentacional (o Link da ficha) — botão faria o leitor de tela engolir o único
  // caminho de navegação — e sem KeyboardSensor a parada de tab extra não levaria a lugar nenhum.
  // `role="group"` mantém o card uma região nomeável; arrastar continua pelo ponteiro (listeners).
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    attributes: { role: 'group', tabIndex: -1 },
  })
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined

  return (
    <>
      <KanbanCardBody
        lead={lead}
        dragging={isDragging}
        style={style}
        drag={{ setNodeRef, attributes, listeners }}
        conversionAction={(
          <LeadConversionAction lead={lead} convertedClientId={convertedClientId} onConvert={onConvert} />
        )}
      />
      {onMove && (
        <Select
          label={`Mover ${lead.name} para`}
          placeholder="Escolha o novo status"
          value=""
          onChange={(e) => { if (e.target.value) onMove(lead.id, e.target.value as LeadStatus) }}
          options={LEAD_STATUSES.map((status) => ({
            value: status,
            label: status === lead.status ? `${STATUS_LABELS[status]} (atual)` : STATUS_LABELS[status],
          }))}
        />
      )}
    </>
  )
}
```

- [ ] **Step 4: Propagate conversion props through the column**

Substitua `src/components/pipeline/KanbanColumn.tsx` pelo arquivo abaixo:

```tsx
import { useDroppable } from '@dnd-kit/core'
import { STATUS_LABELS, type Lead, type LeadStatus } from '../../types/lead'
import { KanbanCard } from './KanbanCard'
import { cn } from '../../utils/cn'

interface KanbanColumnProps {
  status: LeadStatus
  leads: Lead[]
  onMove?: (leadId: string, status: LeadStatus) => void
  convertedClientIds?: ReadonlyMap<string, string>
  onConvert?: (lead: Lead) => void
}

export function KanbanColumn({ status, leads, onMove, convertedClientIds, onConvert }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={STATUS_LABELS[status]}
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
        {leads.map((lead) => (
          <KanbanCard
            key={lead.id}
            lead={lead}
            onMove={onMove}
            convertedClientId={convertedClientIds?.get(lead.id)}
            onConvert={onConvert}
          />
        ))}
        {leads.length === 0 && (
          <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-muted/60">Arraste leads para cá</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Load links, preserve the lead snapshot and wire conversion into PipelinePage**

Adicione os imports:

```tsx
import { listLeadClientLinks } from '../services/clientService'
import { KanbanCardBody, LeadConversionAction } from '../components/pipeline/KanbanCard'
import { ConversionDialog } from '../components/leads/ConversionDialog'
```

Substitua o import antigo de `KanbanCardBody` pelo import conjunto acima. Fora do componente, ao lado de `windowHint`, adicione a chave normalizada da consulta; ela impede reutilizar o snapshot de filtros diferentes:

```tsx
function pipelineQueryKey(filters: LeadFilters): string {
  return JSON.stringify([filters.niche ?? null, filters.city ?? null, filters.priority ?? null])
}
```

Adicione a referência da última consulta válida junto aos refs de mutação e os estados de conversão depois de `mobileColumn`:

```tsx
const [convertedClientIds, setConvertedClientIds] = useState<ReadonlyMap<string, string>>(() => new Map())
const [linksReady, setLinksReady] = useState(false)
const [linksError, setLinksError] = useState<string | null>(null)
const [linksRetryKey, setLinksRetryKey] = useState(0)
const [conversionLead, setConversionLead] = useState<Lead | null>(null)
const loadedQueryKeyRef = useRef<string | null>(null)
```

No efeito de leads, registre a chave somente no sucesso:

```tsx
loadedQueryKeyRef.current = pipelineQueryKey(queryFilters)
```

Insira este efeito próprio imediatamente após o efeito de carregamento de leads. A dependência é exatamente `[refreshKey, linksRetryKey]`; o cleanup `active` descarta respostas de refreshes anteriores:

```tsx
useEffect(() => {
  let active = true
  setLinksReady(false)
  setLinksError(null)
  void listLeadClientLinks().then(
    (links) => {
      if (!active) return
      const next = new Map<string, string>()
      for (const link of links) next.set(link.lead_id, link.client_id)
      setConvertedClientIds(next)
      setLinksReady(true)
    },
    (cause: unknown) => {
      if (!active) return
      setLinksReady(false)
      setLinksError(cause instanceof Error ? cause.message : 'Erro ao carregar vínculos de conversão.')
    },
  )
  return () => { active = false }
}, [refreshKey, linksRetryKey])
```

Adicione os handlers depois de `onDragEnd`:

```tsx
const handleOpenConversion = (lead: Lead) => {
  if (!linksReady || linksError || convertedClientIds.has(lead.id)) return
  setConversionLead(lead)
}

const handleConverted = () => {
  setConversionLead(null)
  setLinksRetryKey((key) => key + 1)
  setRefreshKey((key) => key + 1)
}
```

Não altere `moveLead`, `onDragEnd`, `mutationVersionRef`, `pendingMovesRef`, `refreshAfterMovesRef` ou `moveQueuesRef`. Em particular, preserve a fila `pending.then(performMove, performMove)`, o rollback condicional `l.status === status` e o refresh adiado até `pendingMovesRef.current === 0`. O drop continua gravando somente `status`; conversão não usa `setLeadStatus`.

Antes do `return`, derive se o snapshot pertence aos filtros atuais:

```tsx
const hasLeadSnapshot = loadedQueryKeyRef.current === pipelineQueryKey(queryFilters)
```

Insira os banners de falha entre o `Card` de filtros e o bloco condicional `error/loading/leads`. O snapshot só é reutilizado para a mesma consulta; uma falha ao trocar filtros não apresenta leads antigos como se atendessem aos novos:

```tsx
{error && hasLeadSnapshot && (
  <Card className="border-danger/40" role="alert">
    <p className="text-sm font-medium text-danger">Não foi possível atualizar o pipeline.</p>
    <p className="mt-1 text-sm text-muted">{error} Exibindo o último snapshot carregado.</p>
    <Button variant="outline" className="mt-3" onClick={reload}>Tentar novamente</Button>
  </Card>
)}

{linksError && (
  <Card className="border-danger/40" role="alert">
    <p className="text-sm font-medium text-danger">Não foi possível carregar os vínculos de conversão.</p>
    <p className="mt-1 text-sm text-muted">{linksError} A conversão não pode ser verificada; os leads continuam visíveis.</p>
    <Button variant="outline" className="mt-3" onClick={() => setLinksRetryKey((key) => key + 1)}>
      Tentar novamente
    </Button>
  </Card>
)}
```

Substitua a renderização de `KanbanColumn` no desktop por:

```tsx
<KanbanColumn
  key={status}
  status={status}
  leads={byStatus.get(status) ?? []}
  onMove={moveLead}
  convertedClientIds={convertedClientIds}
  onConvert={linksReady && !linksError ? handleOpenConversion : undefined}
/>
```

Substitua somente `<KanbanCardBody lead={lead} />` no mobile por:

```tsx
<KanbanCardBody
  lead={lead}
  conversionAction={(
    <LeadConversionAction
      lead={lead}
      convertedClientId={convertedClientIds.get(lead.id)}
      onConvert={linksReady && !linksError ? handleOpenConversion : undefined}
    />
  )}
/>
```

No bloco condicional do quadro, substitua somente as duas aberturas de ramo por:

```tsx
{error && !hasLeadSnapshot ? (
```

```tsx
) : loading && !hasLeadSnapshot ? (
```

Mantenha o restante de cada ramo e os estados vazios inalterados. Assim, a falha de uma atualização da mesma consulta devolve a fila com `total`, vínculos e capacidade de arraste; durante a espera, o comportamento anterior de loading continua valendo. Mudança de filtros sem sucesso continua mostrando somente o erro, nunca o snapshot de outra consulta.

Mantenha o `Select` de status mobile exatamente como está. Enquanto `linksReady` for false, `onConvert` é `undefined`; o último mapa conhecido continua preservado, inclusive em falha, para não transformar um cliente já vinculado em lead aparentemente não convertido. Somente a ação de nova conversão fica bloqueada até o retry.

Renderize o diálogo antes do fechamento do `div` principal, fora da condicional de carregamento:

```tsx
{conversionLead && (
  <ConversionDialog
    open
    lead={conversionLead}
    existingClientId={convertedClientIds.get(conversionLead.id) ?? null}
    onClose={() => setConversionLead(null)}
    onConverted={handleConverted}
  />
)}
```

Depois da conversão, `linksRetryKey` refaz os vínculos e `refreshKey` refaz os leads. Nenhum dos dois efeitos coloca `loading` como `true` nesse caminho: a fila permanece visível durante o refresh. O efeito de leads existente continua protegendo respostas com `mutationVersionRef`, rollback condicional e refresh adiado.

- [ ] **Step 6: Run tests and build**

Run: `npm test -- src/pages/PipelinePage.test.tsx && npm run build`
Expected: PASS dos testes existentes e dos dez novos testes; build exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/pipeline/KanbanCard.tsx src/components/pipeline/KanbanColumn.tsx src/pages/PipelinePage.tsx src/pages/PipelinePage.test.tsx
git commit -m "feat: integrar conversao ao pipeline"
```

---

### Task 14: Contar convertidos pelo total global exato no dashboard

**Files:**
- Modify: `src/services/dashboardService.ts`
- Modify: `src/lib/dashboard.ts`
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/services/dashboardService.test.ts`
- Modify: `src/lib/dashboard.test.ts`
- Modify: `src/pages/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `countConvertedLeads(): Promise<number>` de `src/services/clientService.ts`, que faz `select('id', { count: 'exact', head: true })` em `lead_client_links`.
- Produces: `DashboardData.convertedCount: number` com o total global de conversões; `computeIndicators(leads, followups, convertedCount, now?)`; KPI “Convertidos” igual a `convertedCount`.
- Preserva: `conversionFunnel(leads)` continua baseado em `status`; a janela de 1.000 leads continua alimentando os demais indicadores e gráficos derivados de leads.

A contagem global é um escalar exato. Não carregue a lista de vínculos e não tente deduzir conversões dos leads da janela: uma conversão fora dos 1.000 leads mais recentes continua sendo dado real.

- [ ] **Step 1: Write the failing service, lib and page tests**

Substitua integralmente `src/services/dashboardService.test.ts` pelo arquivo abaixo. Ele cobre as seis fontes paralelas, o total global fora da janela, a rejeição da contagem e cargas repetidas:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as activityService from './activityService'
import { listRecentActivities } from './activityService'
import { countConvertedLeads } from './clientService'
import { listFollowups } from './followupService'
import { listLeads, listRecentLeads } from './leadService'
import { DASHBOARD_LEAD_WINDOW, getDashboardData } from './dashboardService'
import { emptyLeadDraft, type Lead } from '../types/lead'
import type { Followup } from '../types/followup'
import type { Activity } from '../types/activity'

vi.mock('./activityService', () => ({
  listRecentActivities: vi.fn(),
  listRecentStatusChanges: vi.fn(),
}))
vi.mock('./clientService', () => ({ countConvertedLeads: vi.fn() }))
vi.mock('./followupService', () => ({ listFollowups: vi.fn() }))
vi.mock('./leadService', () => ({ listLeads: vi.fn(), listRecentLeads: vi.fn() }))

function lead(id: string, overrides: Partial<Lead> = {}): Lead {
  return {
    ...emptyLeadDraft(),
    id,
    owner_id: 'owner',
    name: `Lead ${id}`,
    score: 0,
    priority: 'baixa',
    needs: [],
    score_reasons: [],
    created_at: '2026-11-20T00:00:00.000Z',
    updated_at: '2026-11-20T00:00:00.000Z',
    ...overrides,
  } as Lead
}

const followup = {
  id: 'fu-1',
  lead_id: 'l-1',
  owner_id: 'owner',
  due_at: '2026-11-26T09:00:00.000Z',
  reason: null,
  note: null,
  status: 'pendente',
  completed_at: null,
  result: null,
  created_at: '2026-11-24T09:00:00.000Z',
  updated_at: '2026-11-24T09:00:00.000Z',
} satisfies Followup

const activity = {
  id: 'act-1',
  lead_id: 'l-1',
  owner_id: 'owner',
  type: 'observacao',
  description: 'Observação registrada.',
  user_id: null,
  created_at: '2026-11-25T09:00:00.000Z',
  leadName: 'Barbearia do Bairro',
} satisfies Activity & { leadName: string }

const statusChange = {
  ...activity,
  id: 'status-1',
  type: 'mudanca_status',
  description: 'Status alterado para Negociando.',
  created_at: '2026-11-25T10:00:00.000Z',
} satisfies Activity & { leadName: string }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listLeads).mockResolvedValue({ leads: [lead('l-1'), lead('l-2')], total: 2 })
  vi.mocked(listFollowups).mockResolvedValue([followup])
  vi.mocked(listRecentActivities).mockResolvedValue([activity])
  vi.mocked(activityService.listRecentStatusChanges).mockResolvedValue([statusChange])
  vi.mocked(listRecentLeads).mockResolvedValue([lead('l-2')])
  vi.mocked(countConvertedLeads).mockResolvedValue(0)
})

describe('getDashboardData', () => {
  it('inicia as seis consultas em paralelo com os limites e a ordem exigidos', async () => {
    const request = getDashboardData()

    // Promise.all inicia todas antes de qualquer resposta: nenhuma consulta espera a anterior.
    expect(listLeads).toHaveBeenCalledTimes(1)
    expect(listFollowups).toHaveBeenCalledTimes(1)
    expect(listRecentActivities).toHaveBeenCalledTimes(1)
    expect(activityService.listRecentStatusChanges).toHaveBeenCalledTimes(1)
    expect(listRecentLeads).toHaveBeenCalledTimes(1)
    expect(countConvertedLeads).toHaveBeenCalledTimes(1)
    // 'all' nos follow-ups: o painel de pendentes/atrasados filtra no cliente (computeIndicators).
    expect(listLeads).toHaveBeenCalledWith({}, 'created_desc', 0, DASHBOARD_LEAD_WINDOW)
    expect(listFollowups).toHaveBeenCalledWith('all')
    expect(listRecentActivities).toHaveBeenCalledWith(8)
    expect(activityService.listRecentStatusChanges).toHaveBeenCalledWith(5)
    expect(listRecentLeads).toHaveBeenCalledWith(5)
    expect(countConvertedLeads).toHaveBeenCalledWith()
    expect(DASHBOARD_LEAD_WINDOW).toBe(1000)
    const startOrder = [
      vi.mocked(listLeads).mock.invocationCallOrder[0],
      vi.mocked(countConvertedLeads).mock.invocationCallOrder[0],
      vi.mocked(listFollowups).mock.invocationCallOrder[0],
      vi.mocked(listRecentActivities).mock.invocationCallOrder[0],
      vi.mocked(activityService.listRecentStatusChanges).mock.invocationCallOrder[0],
      vi.mocked(listRecentLeads).mock.invocationCallOrder[0],
    ]
    expect(startOrder).toEqual([...startOrder].sort((a, b) => a - b))

    await request
  })

  it('devolve as seis fontes juntas na forma que a página lê', async () => {
    await expect(getDashboardData()).resolves.toEqual({
      leads: [lead('l-1'), lead('l-2')],
      totalLeads: 2,
      convertedCount: 0,
      followups: [followup],
      recentActivities: [activity],
      recentStatusChanges: [statusChange],
      recentLeads: [lead('l-2')],
    })
  })

  it('totalLeads vem do count do banco, não do tamanho da janela carregada', async () => {
    vi.mocked(listLeads).mockResolvedValue({
      leads: Array.from({ length: DASHBOARD_LEAD_WINDOW }, (_, index) => lead(`l-${index}`)),
      total: 1042,
    })

    const result = await getDashboardData()

    expect(result.leads).toHaveLength(DASHBOARD_LEAD_WINDOW)
    expect(result.totalLeads).toBe(1042)
  })

  it('convertedCount é global e inclui conversões fora da janela de leads', async () => {
    vi.mocked(listLeads).mockResolvedValue({
      leads: Array.from({ length: DASHBOARD_LEAD_WINDOW }, (_, index) => lead(`l-${index}`, { status: 'novo' })),
      total: 1042,
    })
    vi.mocked(countConvertedLeads).mockResolvedValue(37)

    const result = await getDashboardData()

    expect(result.leads).toHaveLength(DASHBOARD_LEAD_WINDOW)
    expect(result.leads.some((item) => item.status === 'aceitou')).toBe(false)
    expect(result.convertedCount).toBe(37)
    expect(countConvertedLeads).toHaveBeenCalledTimes(1)
  })

  it('falha em qualquer uma das seis derruba a carga inteira, sem painel pela metade', async () => {
    vi.mocked(listFollowups).mockRejectedValue(new Error('Falha de conexão com o Supabase.'))

    await expect(getDashboardData()).rejects.toThrow('Falha de conexão com o Supabase.')
    expect(listRecentActivities).toHaveBeenCalledTimes(1)
    expect(activityService.listRecentStatusChanges).toHaveBeenCalledTimes(1)
    expect(countConvertedLeads).toHaveBeenCalledTimes(1)
  })

  it('rejeição da contagem global de convertidos derruba a carga inteira', async () => {
    vi.mocked(countConvertedLeads).mockRejectedValue(new Error('Falha na contagem de convertidos.'))

    await expect(getDashboardData()).rejects.toThrow('Falha na contagem de convertidos.')
    expect(listLeads).toHaveBeenCalledTimes(1)
    expect(listFollowups).toHaveBeenCalledTimes(1)
  })

  it('cada chamada é uma carga nova: nada é cacheado entre atualizações', async () => {
    await getDashboardData()
    await getDashboardData()

    expect(listLeads).toHaveBeenCalledTimes(2)
    expect(listRecentActivities).toHaveBeenCalledTimes(2)
    expect(activityService.listRecentStatusChanges).toHaveBeenCalledTimes(2)
    expect(countConvertedLeads).toHaveBeenCalledTimes(2)
  })
})
```

Em `src/lib/dashboard.test.ts`, faça as substituições exatas:

```ts
const i = computeIndicators(leads, followups, 1)
```

```ts
expect(computeIndicators([], pending, 0, Date.parse('2019-12-31T23:59:59.999Z')).followupsAtrasados).toBe(0)
expect(computeIndicators([], pending, 0, Date.parse(dueAt)).followupsAtrasados).toBe(0)
expect(computeIndicators([], pending, 0, Date.parse('2020-01-01T00:00:00.001Z')).followupsAtrasados).toBe(1)
```

```ts
expect(computeIndicators(leads, [], 0).contatados).toBe(3)
```

Insira este teste dentro de `describe('computeIndicators', () => {`, imediatamente depois do teste de status e oportunidades:

```ts
it('usa convertedCount global e não deriva o KPI do status aceitou', () => {
  const now = Date.parse('2026-11-25T12:00:00Z')
  const accepted = lead({ status: 'aceitou' })

  expect(computeIndicators([accepted], [], 42, now).convertidos).toBe(42)
  expect(computeIndicators([accepted], [], 0, now).convertidos).toBe(0)
  // O funil continua sendo a régua de status, independente da contagem global de vínculos.
  expect(conversionFunnel([accepted]).at(-1)).toEqual({ label: 'Aceitou', total: 1 })
})
```

Em `src/pages/DashboardPage.test.tsx`, faça estas alterações exatas.

1. Adicione `convertedCount` ao fixture central:

```tsx
function dashboardData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    leads: LEADS,
    totalLeads: LEADS.length,
    convertedCount: 0,
    followups: FOLLOWUPS,
    recentActivities: ACTIVITIES,
    recentStatusChanges: STATUS_CHANGES,
    recentLeads: RECENT_LEADS,
    ...overrides,
  }
}
```

2. Renomeie o teste de vazio para “só mostra o estado global quando todas as seis fontes estão vazias” e inclua `convertedCount: 0` no fixture:

```tsx
it('só mostra o estado global quando todas as seis fontes estão vazias', async () => {
  const { container } = await renderLoaded({
    leads: [],
    totalLeads: 0,
    convertedCount: 0,
    followups: [],
    recentActivities: [],
    recentStatusChanges: [],
    recentLeads: [],
  })
```

3. Inclua a contagem global como fonte independente em `nonEmptySources` e no reset de cada caso:

```tsx
const nonEmptySources: Array<[string, Partial<DashboardData>, string]> = [
  ['follow-ups', { followups: [makeFollowup({ lead_id: 'lead-fora-da-janela' })] }, UNKNOWN_LEAD_NAME],
  ['atividades', { recentActivities: [makeActivity({ description: 'Atividade carregada' })] }, 'Observação — Atividade carregada'],
  ['mudanças de status', { recentStatusChanges: [makeActivity({ type: 'mudanca_status', description: 'Status carregado' })] }, 'Status carregado'],
  ['leads recentes', { recentLeads: [barbearia] }, barbearia.name],
  ['convertidos', { convertedCount: 7 }, '7'],
]

it.each(nonEmptySources)('mantém o dashboard quando só %s tem dados', async (_source, override, visibleText) => {
  const { container } = await renderLoaded({
    leads: [],
    totalLeads: 0,
    convertedCount: 0,
    followups: [],
    recentActivities: [],
    recentStatusChanges: [],
    recentLeads: [],
    ...override,
  })
```

4. Renomeie o teste dos indicadores para “rendera os 10 indicadores e Convertidos usa a contagem global”. Mantenha a asserção de zero e atualize o comentário:

```tsx
it('rendera os 10 indicadores e Convertidos usa a contagem global', async () => {
  await renderLoaded()

  expect(indicatorValue('Total de leads')).toBe('6')
```

```tsx
// A fixture global tem convertedCount 0: nenhum vínculo real, independente do status na janela.
expect(indicatorValue('Convertidos')).toBe('0')
```

5. Renomeie o teste da janela para “avisa o recorte dos indicadores de leads e gráficos sem esconder total exato nem Convertidos” e substitua as duas strings esperadas:

```tsx
it('avisa o recorte dos indicadores de leads e gráficos sem esconder total exato nem Convertidos', async () => {
```

```tsx
'Os indicadores de leads (exceto o total e Convertidos) e os gráficos são calculados sobre os 1000 leads '
+ 'mais recentes; há 1042 leads no total. As contagens de follow-ups usam todos os follow-ups '
+ 'carregados. Afine a lista nas páginas de Leads e de Oportunidades.',
```

```tsx
'Os indicadores de leads (exceto o total e Convertidos) e os gráficos são calculados sobre os 1000 leads '
+ 'mais recentes. As contagens de follow-ups usam todos os follow-ups carregados. '
+ 'Afine a lista nas páginas de Leads e de Oportunidades.',
```

Substitua também o comentário do cartão de total por:

```tsx
// Total de leads e Convertidos vêm de counts exatos; apenas os demais derivados usam a janela.
```

6. Insira a regressão fora da janela dentro de `describe('DashboardPage janela de leads', () => {`:

```tsx
it('KPI Convertidos usa o total global fora da janela e o funil continua por status', async () => {
  const windowed = Array.from({ length: LEAD_WINDOW }, (_, index) => makeLead({
    id: `janela-convertida-${index}`,
    name: `Lead da janela ${index + 1}`,
    status: 'novo',
    created_at: at(10, 15),
  }))
  await renderLoaded({ leads: windowed, totalLeads: 1042, convertedCount: 42 })

  expect(indicatorValue('Convertidos')).toBe('42')
  expect(chartRows('Conversão de leads').at(-1)).toEqual({ label: 'Aceitou', total: 0 })
})
```

7. Insira a regressão de snapshot depois do teste `Atualizar refaz a carga inteira`:

```tsx
it('preserva o último dashboard e permite retry quando a atualização falha', async () => {
  vi.mocked(getDashboardData)
    .mockResolvedValueOnce(dashboardData())
    .mockRejectedValueOnce(new Error('Falha temporária no dashboard.'))
  renderPage()
  await settle()
  expect(indicatorValue('Total de leads')).toBe('6')

  fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
  await settle()

  const alert = screen.getByRole('alert')
  expect(alert.textContent).toContain('Falha temporária no dashboard.')
  expect(alert.textContent).toContain('último snapshot')
  expect(indicatorValue('Total de leads')).toBe('6')
  expect(screen.getAllByTestId('chart').length).toBeGreaterThan(0)

  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await settle()

  expect(getDashboardData).toHaveBeenCalledTimes(3)
  expect(screen.queryByRole('alert')).toBeNull()
  expect(indicatorValue('Total de leads')).toBe('6')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/dashboard.test.ts src/services/dashboardService.test.ts src/pages/DashboardPage.test.tsx`
Expected: FAIL porque `DashboardData` ainda não tem `convertedCount`, `computeIndicators` ainda usa `status === 'aceitou'` e a página ainda não executa a sexta fonte.

- [ ] **Step 3: Load the exact global count in the service**

Substitua integralmente `src/services/dashboardService.ts` pelo arquivo abaixo:

```ts
import { listRecentActivities, listRecentStatusChanges } from './activityService'
import { countConvertedLeads } from './clientService'
import { listFollowups } from './followupService'
import { listLeads, listRecentLeads } from './leadService'
import type { Activity } from '../types/activity'
import type { Followup } from '../types/followup'
import type { Lead } from '../types/lead'

// O dashboard agrega no cliente (lib/dashboard.ts), então a janela lida é o limite do que ele
// pode afirmar sobre séries derivadas de leads. Totais exatos vêm de counts independentes.
export const DASHBOARD_LEAD_WINDOW = 1000
const ACTIVITY_WINDOW = 8
const STATUS_CHANGE_WINDOW = 5
const RECENT_LEADS = 5

export interface DashboardData {
  leads: Lead[]
  /** Total real de leads (count do Supabase), não o tamanho da janela carregada. */
  totalLeads: number
  /** Total global real de conversões (count de lead_client_links), inclusive fora da janela. */
  convertedCount: number
  followups: Followup[]
  recentActivities: Array<Activity & { leadName: string }>
  recentStatusChanges: Array<Activity & { leadName: string }>
  recentLeads: Lead[]
}

/**
 * Uma carga do dashboard: leads (janela), total exato de leads, total global de convertidos,
 * follow-ups de todos os status, atividades recentes, mudanças de status recentes e últimos leads.
 * As seis consultas rodam em paralelo; falha em qualquer uma derruba a carga inteira — painel pela
 * metade afirmaria um estado que não se sabe.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const [leadsResult, convertedCount, followups, recentActivities, recentStatusChanges, recentLeads] = await Promise.all([
    listLeads({}, 'created_desc', 0, DASHBOARD_LEAD_WINDOW),
    countConvertedLeads(),
    listFollowups('all'),
    listRecentActivities(ACTIVITY_WINDOW),
    listRecentStatusChanges(STATUS_CHANGE_WINDOW),
    listRecentLeads(RECENT_LEADS),
  ])
  return {
    leads: leadsResult.leads,
    totalLeads: leadsResult.total,
    convertedCount,
    followups,
    recentActivities,
    recentStatusChanges,
    recentLeads,
  }
}
```

- [ ] **Step 4: Use convertedCount in indicators without changing the status funnel**

Em `src/lib/dashboard.ts`, substitua a assinatura e o campo `convertidos` exatamente por:

```ts
export function computeIndicators(
  leads: Lead[],
  followups: Followup[],
  convertedCount: number,
  now = Date.now(),
): DashboardIndicators {
```

```ts
convertidos: convertedCount,
```

Não altere `conversionFunnel`. O KPI “Convertidos” usa a contagem global de vínculos; a etapa “Aceitou” do funil continua contando `lead.status === 'aceitou'` na janela carregada.

- [ ] **Step 5: Wire the page, empty state, refresh snapshot and window disclaimer**

Em `src/pages/DashboardPage.tsx`, altere o import de `react` para incluir `useRef` e adicione o marcador de snapshot logo depois de `reloadKey`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
```

```tsx
const hasLoadedRef = useRef(false)
```

No manipulador de sucesso do efeito de carga, marque o snapshot antes de gravá-lo. Na falha, limpe os dados somente se nunca houve uma carga válida:

```tsx
setData(result)
hasLoadedRef.current = true
```

```tsx
if (!hasLoadedRef.current) setData(null)
setError(cause instanceof Error ? cause.message : 'Erro ao carregar dashboard.')
setLoading(false)
```

O skeleton inicial continua valendo, mas uma atualização com snapshot não pode apagar os cartões:

```tsx
if (loading && !data) {
```

A tela de erro integral é somente para falha sem snapshot:

```tsx
if ((error && !data) || !data || !indicators || !charts) {
```

No JSX do dashboard, logo após os retornos de skeleton/erro e antes dos cartões, renderize o aviso de refresh sem substituir o dashboard:

```tsx
{error && (
  <Card className="border-danger/40" role="alert">
    <p className="text-sm text-danger">
      Não foi possível atualizar. Exibindo o último snapshot carregado: {error}
    </p>
    <Button variant="outline" className="mt-3" onClick={reload}>Tentar novamente</Button>
  </Card>
)}
```

Substitua o `useMemo` dos indicadores por:

```tsx
const indicators = useMemo(
  () => (data ? computeIndicators(data.leads, data.followups, data.convertedCount, now) : null),
  [data, now],
)
```

Substitua `hasAnyData` para que uma conversão global fora da janela também impeça o estado vazio:

```tsx
const hasAnyData = data.convertedCount > 0
  || data.leads.length > 0
  || data.followups.length > 0
  || data.recentActivities.length > 0
  || data.recentStatusChanges.length > 0
  || data.recentLeads.length > 0
```

Substitua o aviso da janela para excluir “Convertidos” da limitação:

```tsx
const windowNote = data.leads.length === DASHBOARD_LEAD_WINDOW
  ? `Os indicadores de leads (exceto o total e Convertidos) e os gráficos são calculados sobre os ${DASHBOARD_LEAD_WINDOW} leads mais recentes${
      data.totalLeads > DASHBOARD_LEAD_WINDOW ? `; há ${data.totalLeads} leads no total` : ''
    }. As contagens de follow-ups usam todos os follow-ups carregados. Afine a lista nas páginas de Leads e de Oportunidades.`
  : null
```

Mantenha `funnel: conversionFunnel(data.leads)` e a linha `<IndicatorCard label="Convertidos" value={indicators.convertidos} icon={CheckCircle2} tone="primary" />` inalterados. Não derive `convertedCount` de `data.leads` nem aplique a janela a essa contagem.

- [ ] **Step 6: Run tests and build**

Run: `npm test -- src/lib/dashboard.test.ts src/services/dashboardService.test.ts src/pages/DashboardPage.test.tsx && npm run build`
Expected: PASS dos testes existentes e das regressões de total global, fora da janela e rejeição da contagem; build exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/services/dashboardService.ts src/lib/dashboard.ts src/pages/DashboardPage.tsx src/services/dashboardService.test.ts src/lib/dashboard.test.ts src/pages/DashboardPage.test.tsx
git commit -m "fix: contar conversoes pelo total global"
```

---

### Task 15: Registrar rotas, placeholders, documentação e verificação final do Plano 1

**Files:**
- Modify: `src/routes/AppRoutes.tsx`
- Modify: `src/routes/AppRoutes.test.tsx`
- Create: `src/routes/ProtectedRoute.test.tsx`
- Modify: `src/pages/ModulePlaceholderPage.tsx`
- Modify: `src/pages/ModulePlaceholderPage.test.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: `ClientsPage`, `ClientNewPage`, `ClientDetailPage`.
- Produces: protected routes `/clientes`, `/clientes/novo`, `/clientes/:id`.

- [ ] **Step 1: Write failing route/documentation tests**

Substitua integralmente `src/routes/AppRoutes.test.tsx`. Os stubs distinguem `/clientes/novo` de `/clientes/:id` e mantêm as verificações das rotas protegidas e dos placeholders restantes.

```tsx
// src/routes/AppRoutes.test.tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from './AppRoutes'

const { routeState } = vi.hoisted(() => ({ routeState: { authenticated: true } }))

vi.mock('./ProtectedRoute', async () => {
  const { Navigate, Outlet } = await import('react-router-dom')
  return {
    ProtectedRoute: () => routeState.authenticated ? (
      <>
        <p>Rota protegida</p>
        <Outlet />
      </>
    ) : <Navigate to="/login" replace />,
  }
})

vi.mock('../layouts/AppLayout', async () => {
  const { Outlet } = await import('react-router-dom')
  return { AppLayout: () => <><p>Layout do aplicativo</p><Outlet /></> }
})

vi.mock('../layouts/AuthLayout', async () => {
  const { Outlet } = await import('react-router-dom')
  return { AuthLayout: () => <><p>Layout de autenticação</p><Outlet /></> }
})

vi.mock('../pages/LoginPage', () => ({ LoginPage: () => <h1>Login</h1> }))
vi.mock('../pages/StatusPage', () => ({ StatusPage: () => <h1>Status do Supabase</h1> }))
vi.mock('../pages/DashboardPage', () => ({ DashboardPage: () => <h1>Dashboard</h1> }))
vi.mock('../pages/LeadsPage', () => ({ LeadsPage: () => <h1>Leads</h1> }))
vi.mock('../pages/OpportunitiesPage', () => ({ OpportunitiesPage: () => <h1>Oportunidades</h1> }))
vi.mock('../pages/PipelinePage', () => ({ PipelinePage: () => <h1>Pipeline</h1> }))
vi.mock('../pages/LeadNewPage', () => ({ LeadNewPage: () => <h1>Novo lead</h1> }))
vi.mock('../pages/LeadDetailPage', () => ({ LeadDetailPage: () => <h1>Detalhe do lead</h1> }))
vi.mock('../pages/LeadEditPage', () => ({ LeadEditPage: () => <h1>Editar lead</h1> }))
vi.mock('../pages/FollowUpsPage', () => ({ FollowUpsPage: () => <h1>Follow-ups</h1> }))
vi.mock('../pages/SettingsPage', () => ({ SettingsPage: () => <h1>Configurações</h1> }))
vi.mock('../pages/ClientsPage', () => ({ ClientsPage: () => <h1>Clientes</h1> }))
vi.mock('../pages/ClientNewPage', () => ({ ClientNewPage: () => <h1>Novo cliente</h1> }))
vi.mock('../pages/ClientDetailPage', () => ({ ClientDetailPage: () => <h1>Detalhe do cliente</h1> }))
vi.mock('../pages/ModulePlaceholderPage', () => ({
  ModulePlaceholderPage: ({ moduleKey }: { moduleKey: string }) => <h1>Módulo {moduleKey}</h1>,
}))
vi.mock('../pages/NotFoundPage', () => ({ NotFoundPage: () => <h1>Página não encontrada</h1> }))

let consoleError: ReturnType<typeof vi.spyOn>
let consoleWarn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  routeState.authenticated = true
  consoleError = vi.spyOn(console, 'error')
  consoleWarn = vi.spyOn(console, 'warn')
})

afterEach(() => {
  cleanup()
  expect(consoleError).not.toHaveBeenCalled()
  expect(consoleWarn).not.toHaveBeenCalled()
  consoleError.mockRestore()
  consoleWarn.mockRestore()
})

function renderPath(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

describe('AppRoutes', () => {
  it.each([
    ['/', 'Dashboard'],
    ['/leads', 'Leads'],
    ['/leads/novo', 'Novo lead'],
    ['/leads/lead-1', 'Detalhe do lead'],
    ['/leads/lead-1/editar', 'Editar lead'],
    ['/oportunidades', 'Oportunidades'],
    ['/pipeline', 'Pipeline'],
    ['/followups', 'Follow-ups'],
    ['/configuracoes', 'Configurações'],
    ['/clientes', 'Clientes'],
    ['/clientes/novo', 'Novo cliente'],
    ['/clientes/cliente-1', 'Detalhe do cliente'],
    ['/projetos', 'Módulo projetos'],
    ['/financeiro', 'Módulo financeiro'],
    ['/relatorios', 'Módulo relatorios'],
  ])('%s renderiza %s dentro do layout protegido', (path, heading) => {
    renderPath(path)

    expect(screen.getByText('Rota protegida')).toBeTruthy()
    expect(screen.getByText('Layout do aplicativo')).toBeTruthy()
    expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Módulo clientes' })).toBeNull()
  })

  it.each([
    ['/login', 'Login'],
    ['/status', 'Status do Supabase'],
  ])('%s é uma rota pública', (path, heading) => {
    renderPath(path)

    expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
    expect(screen.queryByText('Rota protegida')).toBeNull()
  })

  it('redireciona rota protegida para login quando o stub não está autenticado', () => {
    routeState.authenticated = false
    renderPath('/clientes')

    expect(screen.getByRole('heading', { name: 'Login' })).toBeTruthy()
    expect(screen.queryByText('Rota protegida')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Clientes' })).toBeNull()
  })

  it('usa a página 404 para caminho desconhecido', () => {
    renderPath('/rota-inexistente')
    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeTruthy()
    expect(screen.queryByText('Rota protegida')).toBeNull()
  })
})
```

Crie `src/routes/ProtectedRoute.test.tsx` para testar o componente real, sem substituir sua lógica.

```tsx
// src/routes/ProtectedRoute.test.tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { environment } = vi.hoisted(() => ({
  environment: { configured: true, loading: false, hasSession: false },
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    session: environment.hasSession ? { user: { id: 'user-1' } } : null,
    loading: environment.loading,
  }),
}))
vi.mock('../lib/supabase', () => ({
  get isSupabaseConfigured() { return environment.configured },
}))

import { ProtectedRoute } from './ProtectedRoute'

function renderProtectedRoute(path = '/protegido') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/protegido" element={<h1>Área protegida</h1>} />
        </Route>
        <Route path="/login" element={<h1>Login</h1>} />
        <Route path="/status" element={<h1>Status do Supabase</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(cleanup)

beforeEach(() => {
  environment.configured = true
  environment.loading = false
  environment.hasSession = false
})

describe('ProtectedRoute', () => {
  it('redireciona para status quando o Supabase não está configurado', async () => {
    environment.configured = false
    renderProtectedRoute()

    expect(await screen.findByRole('heading', { name: 'Status do Supabase' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Área protegida' })).toBeNull()
  })

  it('exibe o loader sem redirecionar enquanto a sessão carrega', () => {
    environment.loading = true
    renderProtectedRoute()

    expect(screen.getByLabelText('Carregando')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Login' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Status do Supabase' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Área protegida' })).toBeNull()
  })

  it('redireciona para login quando não há sessão', async () => {
    renderProtectedRoute()

    expect(await screen.findByRole('heading', { name: 'Login' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Área protegida' })).toBeNull()
  })

  it('renderiza o Outlet quando há sessão e a configuração está pronta', () => {
    environment.hasSession = true
    renderProtectedRoute()

    expect(screen.getByRole('heading', { name: 'Área protegida' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Login' })).toBeNull()
  })
})
```

Substitua integralmente `src/pages/ModulePlaceholderPage.test.tsx`. Clientes deixa de ser placeholder; Projetos continua placeholder até o Plano 2; Financeiro usa exatamente a cópia esperada pelo Plano 2.

```tsx
// src/pages/ModulePlaceholderPage.test.tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModulePlaceholderPage } from './ModulePlaceholderPage'

const modules = [
  {
    moduleKey: 'projetos',
    title: 'Projetos',
    stage: 'Etapa 3',
    description: 'O módulo Projetos será implementado no Plano 2 da Etapa 3. Até lá, os projetos básicos permanecem na ficha do cliente.',
  },
  {
    moduleKey: 'financeiro',
    title: 'Financeiro',
    stage: 'Etapa 3',
    description: 'Valores contratados e recebidos, separados dos estimados, chegam na Etapa 3, pelo Plano 3.',
  },
  {
    moduleKey: 'relatorios',
    title: 'Relatórios',
    stage: 'Etapa 4',
    description: 'Relatórios de conversão, nichos e desempenho chegam na Etapa 4.',
  },
] as const

type ModuleKey = typeof modules[number]['moduleKey']

function renderModule(moduleKey: ModuleKey) {
  return render(
    <MemoryRouter initialEntries={[`/${moduleKey}`]}>
      <Routes>
        <Route path="/:moduleKey" element={<ModulePlaceholderPage moduleKey={moduleKey} />} />
        <Route path="/leads" element={<div>Lista de leads</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

let consoleError: ReturnType<typeof vi.spyOn>
let consoleWarn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error')
  consoleWarn = vi.spyOn(console, 'warn')
})

afterEach(() => {
  cleanup()
  expect(consoleError).not.toHaveBeenCalled()
  expect(consoleWarn).not.toHaveBeenCalled()
  consoleError.mockRestore()
  consoleWarn.mockRestore()
})

describe('ModulePlaceholderPage', () => {
  it.each(modules)('$title usa a chave $moduleKey e explica exatamente a $stage', ({ moduleKey, title, stage, description }) => {
    const { container } = renderModule(moduleKey)

    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: `${title} — disponível na ${stage}` })).toBeTruthy()
    expect(screen.getByText(description)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Clientes' })).toBeNull()

    const link = screen.getByRole('link', { name: 'Voltar para Leads' })
    expect(link.getAttribute('href')).toBe('/leads')
    expect(link.classList.contains('inline-flex')).toBe(true)
    expect(link.classList.contains('h-10')).toBe(true)
    expect(link.classList.contains('rounded-xl')).toBe(true)
    expect(container.querySelectorAll('a button, a a, button a, a input, a select, a textarea')).toHaveLength(0)
  })

  it('o CTA de Projetos navega para a lista de leads', async () => {
    renderModule('projetos')
    fireEvent.click(screen.getByRole('link', { name: 'Voltar para Leads' }))
    expect(await screen.findByText('Lista de leads')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/routes/AppRoutes.test.tsx src/routes/ProtectedRoute.test.tsx src/pages/ModulePlaceholderPage.test.tsx`
Expected: FAIL because Clientes is still a placeholder and Financeiro still points to Etapa 4.

- [ ] **Step 3: Implement routes and documentation**

Substitua integralmente `src/routes/AppRoutes.tsx`. As rotas estáticas `/clientes/novo` e `/clientes/:id` permanecem dentro de `ProtectedRoute` e `AppLayout`; Projetos, Financeiro e Relatórios continuam placeholders.

```tsx
// src/routes/AppRoutes.tsx
import { Route, Routes } from 'react-router-dom'
import { AuthLayout } from '../layouts/AuthLayout'
import { AppLayout } from '../layouts/AppLayout'
import { ProtectedRoute } from './ProtectedRoute'
import { LoginPage } from '../pages/LoginPage'
import { DashboardPage } from '../pages/DashboardPage'
import { LeadsPage } from '../pages/LeadsPage'
import { OpportunitiesPage } from '../pages/OpportunitiesPage'
import { PipelinePage } from '../pages/PipelinePage'
import { LeadNewPage } from '../pages/LeadNewPage'
import { LeadDetailPage } from '../pages/LeadDetailPage'
import { LeadEditPage } from '../pages/LeadEditPage'
import { FollowUpsPage } from '../pages/FollowUpsPage'
import { StatusPage } from '../pages/StatusPage'
import { SettingsPage } from '../pages/SettingsPage'
import { ClientsPage } from '../pages/ClientsPage'
import { ClientNewPage } from '../pages/ClientNewPage'
import { ClientDetailPage } from '../pages/ClientDetailPage'
import { ModulePlaceholderPage } from '../pages/ModulePlaceholderPage'
import { NotFoundPage } from '../pages/NotFoundPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route path="/status" element={<StatusPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/oportunidades" element={<OpportunitiesPage />} />
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/clientes" element={<ClientsPage />} />
          <Route path="/clientes/novo" element={<ClientNewPage />} />
          <Route path="/clientes/:id" element={<ClientDetailPage />} />
          <Route path="/projetos" element={<ModulePlaceholderPage moduleKey="projetos" />} />
          <Route path="/financeiro" element={<ModulePlaceholderPage moduleKey="financeiro" />} />
          <Route path="/relatorios" element={<ModulePlaceholderPage moduleKey="relatorios" />} />
          <Route path="/configuracoes" element={<SettingsPage />} />
          <Route path="/followups" element={<FollowUpsPage />} />
          <Route path="/leads/novo" element={<LeadNewPage />} />
          <Route path="/leads/:id" element={<LeadDetailPage />} />
          <Route path="/leads/:id/editar" element={<LeadEditPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
```

Substitua integralmente `src/pages/ModulePlaceholderPage.tsx`. A chave `clientes` não existe mais. Projetos explicita que o módulo chega pelo Plano 2, e Financeiro usa a descrição exata que o Plano 2 espera encontrar.

```tsx
// src/pages/ModulePlaceholderPage.tsx
import { Link } from 'react-router-dom'
import { ArrowLeft, BarChart3, FolderKanban, Wallet, type LucideIcon } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'

const MODULES = {
  projetos: {
    title: 'Projetos',
    description: 'O módulo Projetos será implementado no Plano 2 da Etapa 3. Até lá, os projetos básicos permanecem na ficha do cliente.',
    stage: 'Etapa 3',
    icon: FolderKanban,
  },
  financeiro: {
    title: 'Financeiro',
    description: 'Valores contratados e recebidos, separados dos estimados, chegam na Etapa 3, pelo Plano 3.',
    stage: 'Etapa 3',
    icon: Wallet,
  },
  relatorios: {
    title: 'Relatórios',
    description: 'Relatórios de conversão, nichos e desempenho chegam na Etapa 4.',
    stage: 'Etapa 4',
    icon: BarChart3,
  },
} as const satisfies Record<string, { title: string; description: string; stage: string; icon: LucideIcon }>

export function ModulePlaceholderPage({ moduleKey }: { moduleKey: keyof typeof MODULES }) {
  const selectedModule = MODULES[moduleKey]

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-xl font-bold text-ink">{selectedModule.title}</h1>
      <EmptyState
        icon={selectedModule.icon}
        title={`${selectedModule.title} — disponível na ${selectedModule.stage}`}
        description={selectedModule.description}
        action={(
          <Link
            to="/leads"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-5 text-sm font-medium text-ink transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar para Leads
          </Link>
        )}
      />
    </div>
  )
}
```

No `README.md`, faça estas substituições exatas, sem afirmar que migrations, testes SQL, pagamentos ou dashboards financeiros já foram executados.

1. Substitua o bloco inicial atual:

```md
**Etapa atual: 2 — Planos 1, 2 e 3 implementados.** O CRM inclui Leads / Prospecção
(lista com filtros e paginação, ficha, checklist de presença digital, oportunidade e valores,
timeline, follow-ups, WhatsApp manual e importação/exportação CSV), além de Oportunidades,
Pipeline Kanban, página de Follow-ups, Dashboard com gráficos e Configurações.
A validação final foi executada com dados reais; o teste de isolamento RLS entre dois
usuários permanece pendente até existir uma segunda conta temporária de teste.
Módulos de Clientes, Projetos, Financeiro e Relatórios estão preparados como placeholders
e serão implementados nas próximas etapas.
```

por:

```md
**Etapa atual: 3 — Plano 1 (Clientes) implementado; Projetos e Financeiro nos próximos planos.**
O CRM inclui Leads / Prospecção, Oportunidades, Pipeline Kanban, Follow-ups, Dashboard,
Configurações e Clientes. O módulo Clientes possui lista com filtros e paginação,
cadastro com contrato inicial, ficha com projetos básicos, contratos e histórico combinado,
arquivamento confirmado e conversão de leads por vínculo real.
A aplicação da migration `0006` e do teste SQL da Etapa 3 deve ser executada pelo usuário.
O teste de isolamento RLS entre dois usuários permanece pendente até existir uma segunda
conta temporária de teste. Projetos, Financeiro e Relatórios continuam como placeholders
até seus respectivos planos.
```

2. Substitua o item 3 de configuração do Supabase:

```md
3. **Execute o schema**: abra o [SQL Editor](https://supabase.com/dashboard/project/nuzjlizqdldhygsliwwc/sql/new)
   e execute, nesta ordem, [`0001_profiles.sql`](supabase/migrations/0001_profiles.sql),
   [`0002_etapa2.sql`](supabase/migrations/0002_etapa2.sql),
   [`0003_duplicate_canonical.sql`](supabase/migrations/0003_duplicate_canonical.sql),
   [`0004_followup_atomic.sql`](supabase/migrations/0004_followup_atomic.sql) e
   [`0005_followup_rpc_json.sql`](supabase/migrations/0005_followup_rpc_json.sql).
   As migrations criam as tabelas privadas, os índices, as políticas RLS e as
   RPCs e triggers transacionais de follow-up.
```

por:

```md
3. **Execute o schema**: abra o [SQL Editor](https://supabase.com/dashboard/project/nuzjlizqdldhygsliwwc/sql/new)
   e execute, nesta ordem, [`0001_profiles.sql`](supabase/migrations/0001_profiles.sql),
   [`0002_etapa2.sql`](supabase/migrations/0002_etapa2.sql),
   [`0003_duplicate_canonical.sql`](supabase/migrations/0003_duplicate_canonical.sql),
   [`0004_followup_atomic.sql`](supabase/migrations/0004_followup_atomic.sql),
   [`0005_followup_rpc_json.sql`](supabase/migrations/0005_followup_rpc_json.sql) e
   [`0006_etapa3_clients.sql`](supabase/migrations/0006_etapa3_clients.sql).
   As migrations criam as tabelas privadas, os índices, as políticas RLS e as
   RPCs e triggers transacionais. Depois aplique
   [`supabase/tests/etapa3_clients.sql`](supabase/tests/etapa3_clients.sql) para a
   validação SQL da Etapa 3. A aplicação das migrations e a execução desse teste SQL
   são responsabilidade do usuário; o frontend não as executa automaticamente.
```

4. Na estrutura do projeto, substitua o bloco de `components/` até `types/`:

```md
  components/
    ui/           Button, Input, Card, Modal, Toast, StatusBadge, PresenceBadge, ScoreBar…
    auth/         telas de autenticação
    leads/        LeadForm, LeadFiltersBar, LeadChecklist, OpportunityPanel, LeadTimeline,
                  LeadFollowups, FollowupDialog, ContactDialog, WhatsAppDialog, CsvImportModal
    pipeline/     KanbanCard e KanbanColumn
    followups/    FollowupItem
  pages/          LoginPage, DashboardPage, StatusPage, NotFoundPage, LeadsPage,
                  LeadNewPage, LeadDetailPage, LeadEditPage, OpportunitiesPage,
                  PipelinePage, FollowUpsPage, SettingsPage, ModulePlaceholderPage
  layouts/        AuthLayout (login) e AppLayout (app autenticado, sidebar + drawer mobile)
  hooks/          useAuth, useToast
  services/       authService, leadService, activityService, followupService,
                  digitalCheckService, dashboardService, settingsService
  lib/            supabase.ts (cliente único), db.ts, csv.ts, format.ts, leadForm.ts,
                  opportunity.ts, whatsapp.ts, dashboard.ts, pipeline.ts (+ testes próprios)
  types/          Profile, Lead, Activity, Followup, Check, Settings
  utils/          helpers
  routes/         AppRoutes + ProtectedRoute
supabase/
  migrations/   0001–0005 (profiles, leads, CRM, duplicidades e follow-ups atômicos)
```

por:

```md
  components/
    ui/           Button, Input, Card, Modal, Toast, StatusBadge, PresenceBadge, ScoreBar…
    auth/         telas de autenticação
    leads/        LeadForm, LeadFiltersBar, LeadChecklist, OpportunityPanel, LeadTimeline,
                  LeadFollowups, FollowupDialog, ContactDialog, WhatsAppDialog, CsvImportModal,
                  ConversionDialog
    clients/      ClientForm, ClientHistory
    pipeline/     KanbanCard e KanbanColumn
    followups/    FollowupItem
  pages/          LoginPage, DashboardPage, StatusPage, NotFoundPage, LeadsPage,
                  LeadNewPage, LeadDetailPage, LeadEditPage, OpportunitiesPage,
                  PipelinePage, FollowUpsPage, SettingsPage, ClientsPage, ClientNewPage,
                  ClientDetailPage, ModulePlaceholderPage
  layouts/        AuthLayout (login) e AppLayout (app autenticado, sidebar + drawer mobile)
  hooks/          useAuth, useToast
  services/       authService, leadService, activityService, followupService,
                  digitalCheckService, dashboardService, settingsService, clientService
  lib/            supabase.ts (cliente único), db.ts, csv.ts, format.ts, leadForm.ts,
                  money.ts, url.ts, opportunity.ts, whatsapp.ts, dashboard.ts, pipeline.ts
  types/          Profile, Lead, Activity, Followup, Check, Settings, Client, Contract,
                  Project, ClientHistoryEntry, LeadClientLink
  utils/          helpers
  routes/         AppRoutes + ProtectedRoute
supabase/
  migrations/   0001–0006 (profiles, leads, CRM, duplicidades, follow-ups e clientes)
  tests/        etapa3_clients.sql (validação SQL executada pelo usuário)
```

5. Substitua a lista de rotas protegidas:

```md
Rotas protegidas: `/` (dashboard) · `/leads` · `/leads/novo` · `/leads/:id` ·
`/leads/:id/editar` · `/oportunidades` · `/pipeline` · `/followups` · `/configuracoes` ·
`/clientes` · `/projetos` · `/financeiro` · `/relatorios`. `/login` e `/status` são públicas;
rotas desconhecidas exibem a página 404.
```

por:

```md
Rotas protegidas: `/` (dashboard) · `/leads` · `/leads/novo` · `/leads/:id` ·
`/leads/:id/editar` · `/oportunidades` · `/pipeline` · `/followups` · `/configuracoes` ·
`/clientes` · `/clientes/novo` · `/clientes/:id` · `/projetos` · `/financeiro` ·
`/relatorios`. `/login` e `/status` são públicas; rotas desconhecidas exibem a página 404.
```

6. Substitua a observação final dos limites:

```md
- Valores estimados não são faturamento nem dinheiro recebido. Projetos e Financeiro
  ainda não foram implementados.
```

por:

```md
- Valores estimados não são faturamento nem dinheiro recebido. A ficha do cliente mostra
  projetos básicos e valores contratados; os módulos Projetos, Financeiro e Relatórios
  ainda não foram implementados.
```

7. Substitua a tabela final do roadmap, da linha `| Etapa | Escopo | Status |` até a linha `| 4 | Financeiro | planejada |`, por:

```md
| Etapa | Escopo | Status |
| ----- | ------ | ------ |
| 1 | Fundação, auth, Supabase, deploy | concluída |
| 2 · Plano 1 | Fundação do CRM: vitest, migration `0002`, types, services, kit UI, sidebar | concluída |
| 2 · Plano 2 | Leads / prospecção: lista, ficha, follow-ups, WhatsApp, CSV | concluída |
| 2 · Plano 3 | Oportunidades, pipeline Kanban, follow-ups, dashboard, configurações | implementado; validação RLS entre 2 usuários pendente |
| 3 · Plano 1 | Clientes, contratos, histórico e conversão de leads | implementado; migration e validação SQL pendentes de execução pelo usuário |
| 3 · Plano 2 | Projetos | planejado |
| 3 · Plano 3 | Financeiro | planejado |
| 4 | Relatórios | planejada |
```

- [ ] **Step 4: Run the complete verification gate**

Run in this order:

```bash
npm run build
npm run lint
npm test -- --maxWorkers=4
git diff --check
```

Expected: build exit 0; lint exit 0; complete Vitest suite exit 0; no whitespace errors. Fix every regression before proceeding.

- [ ] **Step 5: Browser verification**

Start `npm run dev`. With a real authenticated session, verify:
1. Carboni logo appears on `/login`, sidebar desktop and mobile drawer.
2. `/clientes` loads real rows, combined filters, pagination and empty/error states.
3. `/clientes/novo` creates one client and one initial contract.
4. `/clientes/:id` shows overview, projects, contracts and combined history.
5. A lead without link exposes “Converter em cliente”; repeated conversion returns the same client.
6. A converted lead shows “Ver cliente” and locked contracted/received fields.
7. Pipeline conversion button does not move the card.
8. Dashboard “Convertidos” ignores `aceitou` without link.
9. Layouts work at 375, 768 and 1280 px without horizontal overflow.

If the user has not applied migration 0006, report the database steps as pending and do not claim authenticated persistence.

- [ ] **Step 6: Commit**

```bash
git add src/routes/AppRoutes.tsx src/routes/AppRoutes.test.tsx src/routes/ProtectedRoute.test.tsx src/pages/ModulePlaceholderPage.tsx src/pages/ModulePlaceholderPage.test.tsx README.md
git commit -m "feat: concluir modulo de clientes da etapa 3"
```

- [ ] **Step 7: Handoff**

Report exact commands/output, browser checks actually performed, migration status and remaining RLS gate. Do not push or deploy unless the user explicitly authorizes it. Plan 2 starts only after this plan is reviewed and accepted.
