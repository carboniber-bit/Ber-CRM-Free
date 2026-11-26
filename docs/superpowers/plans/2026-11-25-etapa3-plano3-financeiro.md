# Contratos e Financeiro — Plano de Implementação

> **Execução futura:** usar `superpowers:executing-plans` para implementar este plano tarefa por tarefa. As etapas usam caixas (`- [ ]`) apenas para acompanhamento futuro; nenhuma deve ser marcada antes da execução real.

**Objetivo:** Entregar contratos adicionais, edição segura do cliente e do contrato inicial, parcelas, recebimentos parciais, estornos, despesas, categorias, resumo, fluxo de caixa e lucro realizado com dados reais, idempotência e RLS.

**Arquitetura:** A migration `0008` mantém as tabelas financeiras somente leitura para o cliente e concentra escrita em RPCs `security definer` com locks, idempotência e validação de saldo. As leituras agregadas usam `security invoker` e RLS. O frontend usa centavos inteiros, deriva status de parcelas e consome agregações no fuso `America/Sao_Paulo`.

**Stack:** React 19, TypeScript, Vite 8, Tailwind CSS v4, React Router 7, Supabase Free/PostgreSQL, Recharts, Vitest 5, Testing Library e Lucide.

**Spec:** `docs/superpowers/specs/2026-11-25-etapa3-design.md`

**Depende de:** Planos 1 e 2 concluídos, incluindo `src/lib/money.ts`, `src/types/contract.ts`, `src/types/client.ts`, `src/types/project.ts`, migrations `0006` e `0007` e as rotas já protegidas.

## Restrições globais

- “ATENÇÃO: NÃO RECRIE O PROJETO.”
- Stack mantida: React 19, TypeScript, Vite 8, Tailwind CSS v4, React Router 7, Supabase Free, Recharts, `@dnd-kit` e Lucide.
- Interface em pt-BR, dark mode grafite, verde principal, Montserrat/Roboto e acentos azul/lime/rosa.
- Somente ferramentas gratuitas e free tiers; nenhuma cobrança, trial, upgrade, API paga ou automação de mensagens.
- Credenciais reais somente em `.env.local`; `.env.example` permanece sem credenciais. Nunca usar `service_role` no frontend.
- Nenhuma tabela privada sem RLS; cada usuário acessa somente os próprios registros.
- Nenhum número fictício apresentado como dado real.
- Valores estimados, negociados, contratados, recebidos e pendentes permanecem semanticamente separados.
- Contratado ativo exclui contratos cancelados; recebido líquido histórico inclui recebimentos e estornos de contratos cancelados.
- Pendente é calculado por contrato e nunca negativo; conclusão/entrega de projeto não gera receita.
- Caixa usa `received_at` e `paid_at`; lucro do período usa recebimentos líquidos menos despesas pagas.
- Datas de agrupamento usam `America/Sao_Paulo`; período tem início inclusivo e fim exclusivo. Nunca usar `current_date` nos testes ou agregações.
- Registros financeiros com dependências são cancelados/estornados, nunca excluídos.
- Dinheiro no frontend usa centavos inteiros; PostgreSQL usa `numeric(14,2)` nas colunas e `numeric` irrestrito nos acumuladores.
- Toda RPC que altera um contrato existente adquire a advisory `:contract:<id>` antes de `FOR UPDATE`; pagamentos mantêm sua advisory `:payment:<key>` e depois bloqueiam contrato/parcelas. Nenhuma RPC segura uma linha para esperar uma advisory.
- TDD RED/GREEN em cada comportamento novo; commits pequenos e frequentes somente durante a execução futura deste plano.
- Não afirmar que migration, RLS entre dois usuários ou validação autenticada foi executada sem evidência real.
- A Etapa 4 não começa sem autorização explícita.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
| ---- | ---------------- |
| `src/types/finance.ts` | Contratos de tipos de parcelas, pagamentos, despesas, entradas e agregações. |
| `src/lib/finance.ts` | Saldos, status de parcela, hoje em São Paulo e períodos determinísticos. |
| `supabase/migrations/0008_etapa3_finance.sql` | Categorias, parcelas, pagamentos, despesas, RLS, RPCs e agregações. |
| `supabase/tests/etapa3_finance.sql` | Idempotência, estorno, saldo, imutabilidade, limites, savepoint e isolamento. |
| `src/services/contractService.ts` | Contratos, parcelas, pagamentos, estornos e filtro por cliente. |
| `src/services/expenseService.ts` | Despesas, categorias, notas e coleção de vencidas. |
| `src/services/financialService.ts` | Resumo e fluxo de caixa. |
| `src/components/finance/ContractPanel.tsx` | Contratos do cliente e ações financeiras. |
| `src/components/finance/InstallmentEditor.tsx` | Parcelas antes do primeiro pagamento. |
| `src/components/finance/PaymentDialog.tsx` | Recebimento/estorno com chave congelada e alocações estornáveis. |
| `src/components/finance/ExpenseForm.tsx` | Formulário de despesa e edição restrita de notas. |
| `src/components/finance/ExpensePanel.tsx` | Lista, filtros e ações de despesas. |
| `src/components/finance/CategoryManager.tsx` | Categorias personalizadas e sugestões. |
| `src/components/clients/ClientFinancePanel.tsx` | Integração na aba Financeiro do cliente. |
| `src/components/finance/FinancialCharts.tsx` | Gráficos Recharts e alternativas acessíveis com dados reais. |
| `src/pages/FinancePage.tsx` | Visão geral, receitas, despesas e fluxo de caixa. |

---

### Tarefa 1: Criar tipos financeiros e regras puras de saldo/período

**Arquivos:**
- Criar: `src/types/finance.ts`
- Criar: `src/lib/finance.ts`
- Criar: `src/lib/finance.test.ts`

**Interfaces:**
- Consome: `Contract`, `ClientActivity` e `Cents` do Plano 1; `DeliveryInput` permanece nos tipos de projeto do Plano 2.
- Produz: `Installment`, `FinancialPayment`, `PaymentAllocation`, `InstallmentFinancial`, `ContractListItem`, `ContractFinancials`, `FinancialExpense`, `ExpenseCategory`, `ExpenseWrite`, `ExpenseNotesInput`, `PaymentInput`, `PaymentResult`, `CreateContractInput`, `InstallmentWrite`, `UpcomingPayment`, `FinancialSummary`, `CashFlowBucket`, `CashFlowGranularity` e `ExpenseCategoryTotal`.
- Produz: `calculateContractBalance`, `calculateInstallmentFinancial`, `calculateProfit`, `getPeriodRange` e `getSaoPauloToday`.

- [ ] **Etapa 1: Escrever os testes que falham**

```ts
// src/lib/finance.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FinancialPayment } from '../types/finance'
import {
  calculateContractBalance,
  calculateInstallmentFinancial,
  calculateProfit,
  getPeriodRange,
  getSaoPauloToday,
} from './finance'

const payment = (type: FinancialPayment['type'], amountCents: number): FinancialPayment => ({
  id: type,
  owner_id: 'owner',
  contract_id: 'contract',
  idempotency_key: type,
  related_payment_id: null,
  type,
  amount_cents: amountCents,
  received_at: '2026-11-25T12:00:00-03:00',
  payment_method: null,
  notes: null,
  created_by: 'owner',
  created_at: '2026-11-25T12:00:00-03:00',
})

afterEach(() => vi.unstubAllEnvs())

describe('calculateContractBalance', () => {
  it('subtrai recebimentos e soma estornos sem ficar negativo', () => {
    expect(calculateContractBalance(100000, [payment('receipt', 30000), payment('refund', 5000)])).toBe(75000)
    expect(calculateContractBalance(10000, [payment('receipt', 20000)])).toBe(0)
  })

  it('rejeita estouro intermediário mesmo quando estornos posteriores compensam o total', () => {
    const max = Number.MAX_SAFE_INTEGER
    expect(() => calculateContractBalance(10, [
      payment('receipt', max),
      payment('receipt', 1),
      payment('refund', max),
    ])).toThrow('Total financeiro excede o limite de centavos.')
  })
})

describe('calculateInstallmentFinancial', () => {
  it('deriva pago, parcial, pendente e atrasado', () => {
    expect(calculateInstallmentFinancial(10000, 10000, '2026-11-20', '2026-11-25').status).toBe('paid')
    expect(calculateInstallmentFinancial(10000, 4000, '2026-11-20', '2026-11-25').status).toBe('overdue')
    expect(calculateInstallmentFinancial(10000, 4000, '2026-12-01', '2026-11-25').status).toBe('partial')
    expect(calculateInstallmentFinancial(10000, 0, '2026-12-01', '2026-11-25').status).toBe('pending')
  })
})

describe('calculateProfit', () => {
  it('usa somente recebimento líquido e despesa paga', () => {
    expect(calculateProfit(100000, 20000, 30000)).toBe(50000)
  })
})

describe('getPeriodRange', () => {
  it('retorna início inclusivo e fim exclusivo', () => {
    expect(getPeriodRange('month', '2026-11-25')).toEqual({ start: '2026-11-01', end: '2026-12-01' })
    expect(getPeriodRange('day', '2026-11-25')).toEqual({ start: '2026-11-25', end: '2026-11-26' })
    expect(getPeriodRange('week', '2026-11-25')).toEqual({ start: '2026-11-23', end: '2026-11-30' })
    expect(getPeriodRange('year', '2026-11-25')).toEqual({ start: '2026-01-01', end: '2027-01-01' })
  })

  it('converte fim personalizado inclusivo em fim exclusivo', () => {
    expect(getPeriodRange('custom', '2026-11-25', '2026-11-10', '2026-11-20')).toEqual({
      start: '2026-11-10',
      end: '2026-11-21',
    })
    expect(getPeriodRange('custom', '2026-11-25', '2026-11-02', '2026-11-10')).toEqual({
      start: '2026-11-02',
      end: '2026-11-11',
    })
  })

  it('não desloca a meia-noite de São Paulo conforme o fuso do processo', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    expect(getSaoPauloToday(new Date('2026-11-25T03:00:00Z'))).toBe('2026-11-25')
    expect(getPeriodRange('day', '2026-11-25')).toEqual({ start: '2026-11-25', end: '2026-11-26' })
  })

  it('rejeita datas impossíveis e período personalizado invertido', () => {
    expect(() => getPeriodRange('day', '2026-02-30')).toThrow('Data inválida.')
    expect(() => getPeriodRange('custom', '2026-11-25', '2026-11-20', '2026-11-10')).toThrow(
      'O início do período não pode ser posterior ao fim.',
    )
  })
})
```

- [ ] **Etapa 2: Executar os testes e confirmar o vermelho**

Comando: `npm test -- src/lib/finance.test.ts`
Esperado: falha porque `src/types/finance.ts` e `src/lib/finance.ts` não existem.

- [ ] **Etapa 3: Implementar tipos e funções puras**

```ts
// src/types/finance.ts
import type { Contract } from './contract'
import type { Cents } from '../lib/money'

export type InstallmentStatus = 'pending' | 'partial' | 'paid' | 'overdue'

export interface Installment {
  id: string
  owner_id: string
  contract_id: string
  position: number
  amount_cents: number
  due_date: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface FinancialPayment {
  id: string
  owner_id: string
  contract_id: string
  idempotency_key: string
  related_payment_id: string | null
  type: 'receipt' | 'refund'
  amount_cents: number
  received_at: string
  payment_method: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface PaymentAllocation {
  id: string
  owner_id: string
  contract_id: string
  payment_id: string
  installment_id: string
  amount_cents: number
  created_at: string
}

export interface InstallmentFinancial extends Installment {
  allocated_cents: number
  remaining_cents: number
  status: InstallmentStatus
}

export interface ContractListItem extends Contract {
  client_name: string
}

export interface ContractFinancials {
  contract: ContractListItem
  installments: InstallmentFinancial[]
  payments: FinancialPayment[]
  allocations: PaymentAllocation[]
  receivedCents: number
  pendingCents: number
}

export type ExpenseStatus = 'pending' | 'paid' | 'cancelled'

export interface ExpenseCategory {
  id: string
  owner_id: string
  name: string
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface FinancialExpense {
  id: string
  owner_id: string
  description: string
  category_id: string | null
  amount_cents: number
  expense_date: string
  due_date: string | null
  paid_at: string | null
  payment_method: string | null
  status: ExpenseStatus
  project_id: string | null
  contract_id: string | null
  notes: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export interface ExpenseWrite {
  description: string
  categoryId: string | null
  amountCents: number
  expenseDate: string
  dueDate: string | null
  projectId: string | null
  contractId: string | null
  notes: string
}

export interface ExpenseNotesInput {
  notes: string
}

export interface PaymentInput {
  idempotencyKey: string
  type: FinancialPayment['type']
  amountCents: number
  receivedAt: string
  paymentMethod: string
  notes: string
  relatedPaymentId: string | null
  allocations: Array<{ installmentId: string; amountCents: number }>
}

export interface PaymentResult extends FinancialPayment {
  allocations: PaymentAllocation[]
  already_existed: boolean
}

export interface CreateContractInput {
  creationKey: string
  clientId: string
  service: string
  totalValueCents: Cents
  contractedAt: string
  dueDate: string | null
  paymentMethod: string
  paymentTerms: string
  notes: string
}

export interface InstallmentWrite {
  amountCents: Cents
  dueDate: string
  notes: string
}

export interface UpcomingPayment {
  contract_id: string
  client_id: string
  description: string
  due_date: string
  amount_cents: number
}

export interface FinancialSummary {
  contractedCents: number
  receivedHistoricalCents: number
  pendingCents: number
  periodReceiptsCents: number
  periodExpensesCents: number
  periodProfitCents: number
  overdueCents: number
  overdue: UpcomingPayment[]
  upcoming: UpcomingPayment[]
}

export interface CashFlowBucket {
  label: string
  receiptsCents: number
  expensesCents: number
  netCents: number
  balanceCents: number
}

export type CashFlowGranularity = 'day' | 'week' | 'month' | 'year'

export interface ExpenseCategoryTotal {
  categoryId: string | null
  name: string
  amountCents: number
}
```

```ts
// src/lib/finance.ts
import type { FinancialPayment, InstallmentStatus } from '../types/finance'

export type PeriodPreset = 'day' | 'week' | 'month' | 'year' | 'custom'

interface CalendarDate {
  year: number
  month: number
  day: number
}

const saoPauloFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function assertSafeCents(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error('Total financeiro excede o limite de centavos.')
  return value
}

export function calculateContractBalance(totalCents: number, payments: FinancialPayment[]): number {
  assertSafeCents(totalCents)
  let net = 0
  for (const item of payments) {
    assertSafeCents(item.amount_cents)
    net = assertSafeCents(net + (item.type === 'receipt' ? item.amount_cents : -item.amount_cents))
  }
  return Math.max(assertSafeCents(totalCents - net), 0)
}

export function calculateInstallmentFinancial(
  amountCents: number,
  allocatedCents: number,
  dueDate: string,
  today: string,
): { status: InstallmentStatus; remainingCents: number } {
  assertSafeCents(amountCents)
  assertSafeCents(allocatedCents)
  const remainingCents = Math.max(assertSafeCents(amountCents - allocatedCents), 0)
  if (remainingCents === 0) return { status: 'paid', remainingCents }
  if (dueDate < today) return { status: 'overdue', remainingCents }
  return { status: allocatedCents > 0 ? 'partial' : 'pending', remainingCents }
}

export function calculateProfit(receiptsCents: number, refundsCents: number, paidExpensesCents: number): number {
  const net = assertSafeCents(assertSafeCents(receiptsCents) - assertSafeCents(refundsCents))
  return assertSafeCents(net - assertSafeCents(paidExpensesCents))
}

export function getSaoPauloToday(now: Date = new Date()): string {
  const parts = saoPauloFormatter.formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function parseCalendarDate(value: string): CalendarDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error('Data inválida.')
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('Data inválida.')
  }
  return { year, month, day }
}

function formatCalendarDate(date: CalendarDate): string {
  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
}

function addDays(date: CalendarDate, amount: number): CalendarDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + amount))
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() }
}

export function getPeriodRange(
  preset: PeriodPreset,
  referenceDate: string,
  customStart?: string,
  customEnd?: string,
): { start: string; end: string } {
  const reference = parseCalendarDate(referenceDate)
  if (preset === 'custom') {
    if (!customStart || !customEnd) throw new Error('Informe o início e o fim do período.')
    const start = parseCalendarDate(customStart)
    const end = parseCalendarDate(customEnd)
    if (formatCalendarDate(start) > formatCalendarDate(end)) {
      throw new Error('O início do período não pode ser posterior ao fim.')
    }
    return { start: formatCalendarDate(start), end: formatCalendarDate(addDays(end, 1)) }
  }
  if (preset === 'day') {
    return { start: formatCalendarDate(reference), end: formatCalendarDate(addDays(reference, 1)) }
  }
  if (preset === 'week') {
    const weekday = new Date(Date.UTC(reference.year, reference.month - 1, reference.day)).getUTCDay()
    const offset = weekday === 0 ? -6 : 1 - weekday
    const start = addDays(reference, offset)
    return { start: formatCalendarDate(start), end: formatCalendarDate(addDays(start, 7)) }
  }
  if (preset === 'month') {
    const start = { year: reference.year, month: reference.month, day: 1 }
    const end = reference.month === 12
      ? { year: reference.year + 1, month: 1, day: 1 }
      : { year: reference.year, month: reference.month + 1, day: 1 }
    return { start: formatCalendarDate(start), end: formatCalendarDate(end) }
  }
  return {
    start: `${reference.year}-01-01`,
    end: `${reference.year + 1}-01-01`,
  }
}
```

- [ ] **Etapa 4: Executar testes e build**

Comando: `npm test -- src/lib/finance.test.ts && npm run build`
Esperado: testes passam e build termina com código 0.

- [ ] **Etapa 5: Criar commit**

```bash
git add src/types/finance.ts src/lib/finance.ts src/lib/finance.test.ts
git commit -m "feat: adicionar dominio financeiro e periodos"
```

---

### Tarefa 2: Criar schema financeiro 0008 e bloquear escrita direta

**Arquivos:**
- Criar: `supabase/migrations/0008_etapa3_finance.sql`

**Interfaces:**
- Consome: `public.contracts`, `public.projects`, `public.clients`, `public.client_activities` e `public.set_updated_at()`.
- Produz: `expense_categories`, `contract_installments`, `financial_payments`, `financial_payment_allocations` e `financial_expenses`.
- Mantém: `public.contracts` somente com `SELECT` para `authenticated`; toda escrita estrutural passa pelas RPCs das Tarefas 3 e 4.

- [ ] **Etapa 1: Escrever a migration completa**

```sql
-- supabase/migrations/0008_etapa3_finance.sql
begin;

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(pg_catalog.btrim(name)) > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expense_categories_owner_id_id_key unique (owner_id, id)
);

create unique index expense_categories_owner_name_key
  on public.expense_categories (owner_id, lower(name));

create index expense_categories_owner_active_idx
  on public.expense_categories (owner_id, name)
  where archived_at is null;

create table public.contract_installments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contract_id uuid not null,
  position integer not null default 0 check (position >= 0),
  amount numeric(14,2) not null check (amount > 0),
  due_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contract_installments_owner_contract_id_key unique (owner_id, contract_id, id),
  constraint contract_installments_contract_position_key unique (contract_id, position),
  constraint contract_installments_contract_owner_fk foreign key (owner_id, contract_id)
    references public.contracts (owner_id, id) on delete cascade
);

create index contract_installments_owner_due_idx
  on public.contract_installments (owner_id, due_date);

create table public.financial_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contract_id uuid not null,
  idempotency_key uuid not null unique,
  related_payment_id uuid,
  type text not null check (type in ('receipt','refund')),
  amount numeric(14,2) not null check (amount > 0),
  received_at timestamptz not null,
  payment_method text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint financial_payments_owner_contract_id_key unique (owner_id, contract_id, id),
  constraint financial_payments_contract_owner_fk foreign key (owner_id, contract_id)
    references public.contracts (owner_id, id) on delete restrict,
  constraint financial_payments_related_owner_fk foreign key (owner_id, contract_id, related_payment_id)
    references public.financial_payments (owner_id, contract_id, id) on delete restrict,
  constraint financial_payments_type_relation_check check (
    (type = 'receipt' and related_payment_id is null)
    or (type = 'refund' and related_payment_id is not null)
  ),
  constraint financial_payments_created_by_check check (created_by is null or created_by = auth.uid())
);

create index financial_payments_owner_contract_idx
  on public.financial_payments (owner_id, contract_id, received_at desc);
create index financial_payments_owner_received_idx
  on public.financial_payments (owner_id, received_at desc);
-- As agregações filtram a data local de São Paulo; estes índices usam exatamente a mesma expressão.
create index financial_payments_owner_received_sp_idx
  on public.financial_payments (owner_id, ((received_at at time zone 'America/Sao_Paulo')));
create index financial_payments_related_idx
  on public.financial_payments (related_payment_id);

create table public.financial_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contract_id uuid not null,
  payment_id uuid not null,
  installment_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  constraint financial_payment_allocations_payment_installment_key unique (payment_id, installment_id),
  constraint financial_payment_allocations_payment_owner_fk foreign key (owner_id, contract_id, payment_id)
    references public.financial_payments (owner_id, contract_id, id) on delete cascade,
  constraint financial_payment_allocations_installment_owner_fk foreign key (owner_id, contract_id, installment_id)
    references public.contract_installments (owner_id, contract_id, id) on delete restrict
);

create index financial_payment_allocations_owner_contract_idx
  on public.financial_payment_allocations (owner_id, contract_id);
create index financial_payment_allocations_installment_idx
  on public.financial_payment_allocations (installment_id);

create table public.financial_expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  description text not null check (length(pg_catalog.btrim(description)) > 0),
  category_id uuid,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  expense_date date not null,
  due_date date,
  paid_at timestamptz,
  payment_method text,
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  project_id uuid,
  contract_id uuid,
  notes text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_expenses_category_owner_fk foreign key (owner_id, category_id)
    references public.expense_categories (owner_id, id) on delete restrict,
  constraint financial_expenses_project_owner_fk foreign key (owner_id, project_id)
    references public.projects (owner_id, id) on delete restrict,
  constraint financial_expenses_contract_owner_fk foreign key (owner_id, contract_id)
    references public.contracts (owner_id, id) on delete restrict,
  constraint financial_expenses_paid_check check (
    (status = 'paid' and paid_at is not null)
    or (status <> 'paid' and paid_at is null)
  ),
  constraint financial_expenses_cancelled_check check (
    (status = 'cancelled' and cancelled_at is not null)
    or (status <> 'cancelled' and cancelled_at is null)
  )
);

create index financial_expenses_owner_status_idx
  on public.financial_expenses (owner_id, status);
create index financial_expenses_owner_paid_idx
  on public.financial_expenses (owner_id, paid_at desc);
create index financial_expenses_owner_paid_sp_idx
  on public.financial_expenses (owner_id, ((paid_at at time zone 'America/Sao_Paulo')))
  where status = 'paid';
create index financial_expenses_owner_due_idx
  on public.financial_expenses (owner_id, due_date);
create index financial_expenses_owner_category_idx
  on public.financial_expenses (owner_id, category_id);
create index financial_expenses_owner_project_idx
  on public.financial_expenses (owner_id, project_id);
create index financial_expenses_owner_contract_idx
  on public.financial_expenses (owner_id, contract_id);

alter table public.expense_categories enable row level security;
alter table public.contract_installments enable row level security;
alter table public.financial_payments enable row level security;
alter table public.financial_payment_allocations enable row level security;
alter table public.financial_expenses enable row level security;

revoke all on public.expense_categories from public, anon, authenticated;
revoke all on public.contract_installments from public, anon, authenticated;
revoke all on public.financial_payments from public, anon, authenticated;
revoke all on public.financial_payment_allocations from public, anon, authenticated;
revoke all on public.financial_expenses from public, anon, authenticated;

grant select on public.expense_categories to authenticated;
grant select on public.contract_installments to authenticated;
grant select on public.financial_payments to authenticated;
grant select on public.financial_payment_allocations to authenticated;
grant select on public.financial_expenses to authenticated;

create policy expense_categories_select_own on public.expense_categories
  for select using (auth.uid() = owner_id);
create policy contract_installments_select_own on public.contract_installments
  for select using (auth.uid() = owner_id);
create policy financial_payments_select_own on public.financial_payments
  for select using (auth.uid() = owner_id);
create policy financial_payment_allocations_select_own on public.financial_payment_allocations
  for select using (auth.uid() = owner_id);
create policy financial_expenses_select_own on public.financial_expenses
  for select using (auth.uid() = owner_id);

create trigger expense_categories_set_updated_at
  before update on public.expense_categories
  for each row execute function public.set_updated_at();
create trigger contract_installments_set_updated_at
  before update on public.contract_installments
  for each row execute function public.set_updated_at();
create trigger financial_expenses_set_updated_at
  before update on public.financial_expenses
  for each row execute function public.set_updated_at();

commit;
```

- [ ] **Etapa 2: Revisar a fronteira de segurança**

Comando: `git diff --check && git diff -- supabase/migrations/0008_etapa3_finance.sql`
Esperado: as cinco tabelas têm RLS e somente `select` para `authenticated`; `contracts` permanece somente com `SELECT` para `authenticated`; as FKs incluem `owner_id`; o índice único de categoria usa expressão; `numeric(14,2)` limita cada registro a `999999999999.99`; os índices de data de São Paulo correspondem às expressões usadas nas agregações; as verificações de pagamento/despesa estão presentes; não existe proteção por GUC nem trigger de ajuste de total.

- [ ] **Etapa 3: Criar commit**

```bash
git add supabase/migrations/0008_etapa3_finance.sql
git commit -m "feat: criar schema financeiro com escrita restrita"
```

---

### Tarefa 3: Implementar contratos adicionais, parcelas e ajuste de total

**Arquivos:**
- Criar: `supabase/tests/etapa3_finance.sql`
- Modificar: `supabase/migrations/0008_etapa3_finance.sql`

**Interfaces:**
- Produz: `create_contract(jsonb)`, `replace_contract_installments(uuid,jsonb)`, `adjust_contract(uuid,numeric)` e `cancel_contract(uuid)`.
- Consome: os privilégios `SELECT`-only de `public.contracts` e a trigger `contracts_enforce_project_allocation` do Plano 2.
- `replace_contract_installments` aceita `[]` como “sem parcelas”. A UI da Tarefa 9 permite remover a última linha e envia o array vazio sem exigir soma igual ao total.
- `replace_contract_installments` valida textualmente todos os `amount` antes de qualquer cast; a regex e o limite estrutural de 12 dígitos inteiros/2 casas precedem a soma e a conversão.
- `adjust_contract` adquire a advisory `:contract:<id>` antes de bloquear a linha do contrato; projetos não são bloqueados porque não são alterados. A soma de alocação é serializada pelo mesmo lock consultivo usado pelas RPCs do Plano 2.

- [ ] **Etapa 1: Escrever o teste de contrato SQL**

```sql
-- supabase/tests/etapa3_finance.sql
begin;

do $$
declare
  v_owner uuid;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_client jsonb;
  v_contract jsonb;
  v_contract_id uuid;
  v_repeat jsonb;
  v_project_contract_id uuid;
  v_empty_contract_id uuid;
  v_empty_installments jsonb;
  v_invalid_amount text;
  v_sum numeric;
  v_last_amount numeric;
  v_state text;
begin
  select id into v_owner from auth.users order by created_at limit 1;
  if v_owner is null then raise exception 'Crie ao menos um usuário autenticado.'; end if;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  set local role authenticated;

  v_client := public.create_client(jsonb_build_object(
    'creation_key', gen_random_uuid(),
    'name', 'Cliente financeiro',
    'service', 'Site',
    'total_value', '1000.00',
    'contracted_at', v_today
  ));

  v_contract := public.create_contract(jsonb_build_object(
    'creation_key', gen_random_uuid(),
    'client_id', (v_client ->> 'client')::jsonb ->> 'id',
    'service', 'Consultoria',
    'total_value', '1000.00',
    'contracted_at', v_today,
    'due_date', v_today + 30,
    'payment_method', 'pix',
    'payment_terms', 'À vista',
    'notes', null
  ));
  v_contract_id := (v_contract ->> 'id')::uuid;

  if not has_table_privilege('authenticated', 'public.contracts', 'SELECT')
    or has_table_privilege('authenticated', 'public.contracts', 'UPDATE')
    or has_table_privilege('authenticated', 'public.contracts', 'INSERT')
    or has_table_privilege('authenticated', 'public.contracts', 'DELETE') then
    raise exception 'Privilégios de contracts não estão restritos a SELECT.';
  end if;
  begin
    update public.contracts
      set total_value = 1.00
      where id = v_contract_id and owner_id = v_owner;
    raise exception 'UPDATE direto em contracts.total_value foi aceito.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '42501' then raise; end if;
  end;
  select total_value into v_sum from public.contracts where id = v_contract_id;
  if v_sum <> 1000.00 then raise exception 'UPDATE negado alterou o total do contrato.'; end if;

  v_repeat := public.create_contract(jsonb_build_object(
    'creation_key', v_contract ->> 'creation_key',
    'client_id', (v_client ->> 'client')::jsonb ->> 'id',
    'service', 'Outro serviço',
    'total_value', '9999.00',
    'contracted_at', v_today - 1
  ));
  if (v_contract ->> 'id') is distinct from (v_repeat ->> 'id') then
    raise exception 'create_contract repetido alterou o contrato.';
  end if;

  perform public.replace_contract_installments(v_contract_id, jsonb_build_array(
    jsonb_build_object('amount', '600.00', 'due_date', v_today + 7, 'notes', null),
    jsonb_build_object('amount', '400.00', 'due_date', v_today + 30, 'notes', null)
  ));
  select sum(amount) into v_sum
    from public.contract_installments
    where contract_id = v_contract_id;
  if v_sum <> 1000.00 then raise exception 'Soma das parcelas difere do contrato.'; end if;

  perform public.adjust_contract(v_contract_id, 900.00);
  select amount into v_last_amount
    from public.contract_installments
    where contract_id = v_contract_id
    order by position desc
    limit 1;
  if v_last_amount <> 300.00 then raise exception 'Ajuste não reduziu a última parcela corretamente.'; end if;

  v_project_contract_id := (public.create_contract(jsonb_build_object(
    'creation_key', gen_random_uuid(),
    'client_id', (v_client ->> 'client')::jsonb ->> 'id',
    'service', 'Projeto reservado',
    'total_value', '1000.00',
    'contracted_at', v_today,
    'due_date', v_today + 30
  )) ->> 'id')::uuid;
  perform public.create_project(jsonb_build_object(
    'client_id', (v_client ->> 'client')::jsonb ->> 'id',
    'contract_id', v_project_contract_id,
    'name', 'Projeto com valor alocado',
    'service', 'Site',
    'contracted_value', '800.00',
    'description', null,
    'start_date', v_today,
    'due_date', v_today + 7,
    'responsible_name', null,
    'priority', 'medium'
  ));

  begin
    perform public.adjust_contract(v_project_contract_id, 700.00);
    raise exception 'Total abaixo dos projetos foi aceito.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '23514'
      or sqlerrm not like 'PROJECT_ALLOCATION_EXCEEDS_CONTRACT:%' then
      raise;
    end if;
  end;

  v_empty_contract_id := (public.create_contract(jsonb_build_object(
    'creation_key', gen_random_uuid(),
    'client_id', (v_client ->> 'client')::jsonb ->> 'id',
    'service', 'Contrato sem parcelas',
    'total_value', '250.00',
    'contracted_at', v_today,
    'due_date', v_today + 45
  )) ->> 'id')::uuid;
  perform public.replace_contract_installments(v_empty_contract_id, jsonb_build_array(
    jsonb_build_object('amount', '250.00', 'due_date', v_today + 45, 'notes', null)
  ));
  v_empty_installments := public.replace_contract_installments(v_empty_contract_id, '[]'::jsonb);
  if jsonb_array_length(v_empty_installments) <> 0
    or exists (
      select 1 from public.contract_installments
      where contract_id = v_empty_contract_id and owner_id = v_owner
    ) then
    raise exception 'Array vazio não removeu todas as parcelas.';
  end if;

  foreach v_invalid_amount in array array[
    'abc', '1e3', 'NaN', 'Infinity', '1.234', '1000000000000.00'
  ] loop
    begin
      perform public.replace_contract_installments(v_empty_contract_id, jsonb_build_array(
        jsonb_build_object('amount', v_invalid_amount, 'due_date', v_today + 45, 'notes', null)
      ));
      raise exception 'Parcela com amount textual inválido foi aceita: %.', v_invalid_amount;
    exception when others then
      if sqlerrm like 'Parcela com amount textual inválido foi aceita:%' then raise; end if;
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '22023'
        or sqlerrm <> 'Cada parcela exige valor positivo com duas casas e vencimento.' then
        raise;
      end if;
    end;
  end loop;
  if exists (
    select 1 from public.contract_installments
    where contract_id = v_empty_contract_id and owner_id = v_owner
  ) then
    raise exception 'Uma parcela inválida persistiu após a validação textual.';
  end if;

  reset role;
  raise notice 'Contrato SQL de contratos, parcelas e validação textual aprovado.';
end
$$;

rollback;
```

- [ ] **Etapa 2: Confirmar o vermelho**

Esperado: `public.create_contract(jsonb)` não existe. A execução real exige migrations 0001–0008 aplicadas pelo usuário.

- [ ] **Etapa 3: Inserir as RPCs de contrato antes de `commit;`**

```sql
create or replace function public.create_contract(p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_key uuid;
  v_client_id uuid;
  v_total numeric;
  v_total_text text;
  v_contracted_at date;
  v_due date;
  v_contract public.contracts;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Dados do contrato inválidos.' using errcode = '22023';
  end if;
  v_key := (p_payload ->> 'creation_key')::uuid;
  if v_key is null then raise exception 'Chave de idempotência inválida.' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':contract:' || v_key::text, 0)
  );
  select * into v_contract
    from public.contracts
    where owner_id = v_owner and creation_key = v_key;
  if found then return to_jsonb(v_contract); end if;

  v_client_id := (p_payload ->> 'client_id')::uuid;
  v_total_text := nullif(pg_catalog.btrim(p_payload ->> 'total_value'), '');
  v_contracted_at := (p_payload ->> 'contracted_at')::date;
  v_due := nullif(p_payload ->> 'due_date', '')::date;
  if v_client_id is null
    or nullif(pg_catalog.btrim(p_payload ->> 'service'), '') is null
    or v_total_text is null or v_total_text !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$'
    or v_contracted_at is null then
    raise exception 'Informe cliente, serviço, valor e data da contratação.' using errcode = '22023';
  end if;
  v_total := v_total_text::numeric(14,2);
  if v_due is not null and v_due < v_contracted_at then
    raise exception 'O vencimento não pode anteceder a contratação.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.clients where id = v_client_id and owner_id = v_owner
  ) then
    raise exception 'Cliente não encontrado ou acesso negado.' using errcode = '42501';
  end if;

  insert into public.contracts (
    owner_id, client_id, creation_key, service, total_value, contracted_at,
    due_date, payment_method, payment_terms, notes
  ) values (
    v_owner, v_client_id, v_key, pg_catalog.btrim(p_payload ->> 'service'), v_total,
    v_contracted_at, v_due, nullif(pg_catalog.btrim(p_payload ->> 'payment_method'), ''),
    nullif(pg_catalog.btrim(p_payload ->> 'payment_terms'), ''), nullif(p_payload ->> 'notes', '')
  ) on conflict (creation_key) do nothing
  returning * into v_contract;

  if not found then
    select * into v_contract
      from public.contracts
      where owner_id = v_owner and creation_key = v_key;
    if not found then
      raise exception 'Chave de idempotência já utilizada.' using errcode = '23505';
    end if;
    return to_jsonb(v_contract);
  end if;

  insert into public.client_activities (
    owner_id, client_id, contract_id, type, description, metadata
  ) values (
    v_owner, v_client_id, v_contract.id, 'financial',
    'Contrato criado: ' || v_contract.service || '.',
    jsonb_build_object('total_value', v_total)
  );
  return to_jsonb(v_contract);
end;
$$;

create or replace function public.replace_contract_installments(
  p_contract_id uuid,
  p_installments jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_contract public.contracts;
  v_sum numeric;
  v_count int;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  if p_installments is not null and jsonb_typeof(p_installments) <> 'array' then
    raise exception 'Parcelas devem ser uma lista.' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':contract:' || p_contract_id::text, 0)
  );
  select * into v_contract
    from public.contracts
    where id = p_contract_id and owner_id = v_owner
    for update;
  if not found then raise exception 'Contrato não encontrado ou acesso negado.' using errcode = '42501'; end if;
  if exists (
    select 1 from public.financial_payments
    where contract_id = p_contract_id and owner_id = v_owner
  ) then
    raise exception 'Parcelas não podem ser reescritas após o primeiro pagamento.' using errcode = '23514';
  end if;

  -- Primeiro validação textual: nenhum cast pode ocorrer antes de todos os elementos passarem.
  -- Doze dígitos inteiros e no máximo duas casas já limitam cada valor a 999999999999.99.
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_installments, '[]'::jsonb)) as a(value)
    where jsonb_typeof(a.value) <> 'object'
      or nullif(a.value ->> 'amount', '') is null
      or (a.value ->> 'amount') !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$'
      or (a.value ->> 'amount') ~ '^0+(\.0{1,2})?$'
      or nullif(a.value ->> 'due_date', '') is null
  ) then
    raise exception 'Cada parcela exige valor positivo com duas casas e vencimento.' using errcode = '22023';
  end if;

  -- Somente após a validação textual é seguro converter e somar.
  select coalesce(sum((value ->> 'amount')::numeric), 0), count(*)
    into v_sum, v_count
    from jsonb_array_elements(coalesce(p_installments, '[]'::jsonb));
  -- Uma lista vazia representa um contrato sem parcelas; não existe soma para comparar.
  if v_count > 0 and v_sum <> v_contract.total_value then
    raise exception 'A soma das parcelas deve ser igual ao valor do contrato.' using errcode = '23514';
  end if;

  delete from public.contract_installments
    where contract_id = p_contract_id and owner_id = v_owner;
  insert into public.contract_installments (
    owner_id, contract_id, position, amount, due_date, notes
  )
  select v_owner, p_contract_id, ordinality - 1, (value ->> 'amount')::numeric,
    (value ->> 'due_date')::date, nullif(value ->> 'notes', '')
  from jsonb_array_elements(coalesce(p_installments, '[]'::jsonb)) with ordinality;

  insert into public.client_activities (
    owner_id, client_id, contract_id, type, description, metadata
  ) values (
    v_owner, v_contract.client_id, v_contract.id, 'financial',
    'Parcelas do contrato atualizadas.',
    jsonb_build_object('installment_count', v_count)
  );
  return coalesce((
    select jsonb_agg(to_jsonb(i) order by i.position)
    from public.contract_installments i
    where i.contract_id = p_contract_id and i.owner_id = v_owner
  ), '[]'::jsonb);
end;
$$;

create or replace function public.adjust_contract(p_contract_id uuid, p_new_total numeric)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_contract public.contracts;
  v_received numeric;
  v_projects numeric;
  v_delta numeric;
  v_remaining numeric;
  v_installment public.contract_installments;
  v_allocated numeric;
  v_reducible numeric;
  v_reduce numeric;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  if p_new_total is null or p_new_total < 0 or p_new_total <> round(p_new_total, 2)
    or p_new_total > 999999999999.99 then
    raise exception 'Novo total inválido.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':contract:' || p_contract_id::text, 0)
  );
  select * into v_contract
    from public.contracts
    where id = p_contract_id and owner_id = v_owner
    for update;
  if not found then raise exception 'Contrato não encontrado ou acesso negado.' using errcode = '42501'; end if;

  -- A advisory precede todas as linhas compartilhadas com pagamentos e projetos.
  -- Não travar projetos aqui: adjust_contract não os altera.
  select coalesce(sum(p.contracted_value), 0) into v_projects
    from public.projects p
    where p.contract_id = p_contract_id and p.owner_id = v_owner and p.status <> 'cancelled';

  select coalesce(sum(case when p.type = 'receipt' then p.amount else -p.amount end), 0)
    into v_received
    from public.financial_payments p
    where p.contract_id = p_contract_id and p.owner_id = v_owner;
  if p_new_total < v_received then
    raise exception 'O novo total não pode ser menor que o recebido líquido.' using errcode = '23514';
  end if;
  if p_new_total < v_projects then
    raise exception 'PROJECT_ALLOCATION_EXCEEDS_CONTRACT: total % menor que projetos alocados %.',
      p_new_total, v_projects using errcode = '23514';
  end if;

  perform i.id
    from public.contract_installments i
    where i.contract_id = p_contract_id and i.owner_id = v_owner
    order by i.position, i.id
    for update;

  v_delta := p_new_total - v_contract.total_value;
  if exists (
    select 1 from public.contract_installments
    where contract_id = p_contract_id and owner_id = v_owner
  ) then
    if v_delta > 0 then
      update public.contract_installments
        set amount = amount + v_delta
        where id = (
          select id from public.contract_installments
          where contract_id = p_contract_id and owner_id = v_owner
          order by position desc
          limit 1
        );
    elsif v_delta < 0 then
      v_remaining := -v_delta;
      for v_installment in
        select * from public.contract_installments
        where contract_id = p_contract_id and owner_id = v_owner
        order by position desc
      loop
        select coalesce(sum(case when p.type = 'receipt' then a.amount else -a.amount end), 0)
          into v_allocated
          from public.financial_payment_allocations a
          join public.financial_payments p on p.id = a.payment_id
          where a.installment_id = v_installment.id and a.owner_id = v_owner;
        v_reducible := greatest(v_installment.amount - v_allocated, 0);
        v_reduce := least(v_reducible, v_remaining);
        if v_reduce > 0 then
          if v_reduce = v_installment.amount then
            if exists (
              select 1 from public.financial_payment_allocations a
              where a.installment_id = v_installment.id and a.owner_id = v_owner
            ) then
              -- Alocações são históricas mesmo após estorno integral. Preserve a parcela
              -- e tente reduzir outras; se não houver capacidade, a exceção 23514 abaixo
              -- desfaz toda a operação, inclusive exclusões já realizadas neste bloco.
              continue;
            end if;
            delete from public.contract_installments where id = v_installment.id;
          else
            update public.contract_installments
              set amount = amount - v_reduce
              where id = v_installment.id;
          end if;
          v_remaining := v_remaining - v_reduce;
        end if;
        exit when v_remaining = 0;
      end loop;
      if v_remaining > 0 then
        raise exception 'INSTALLMENT_HAS_ALLOCATIONS: não é possível eliminar parcelas com alocações históricas nem reduzir outras o suficiente.'
          using errcode = '23514';
      end if;
    end if;
  end if;

  update public.contracts
    set total_value = p_new_total
    where id = p_contract_id and owner_id = v_owner
    returning * into v_contract;

  if v_delta <> 0 then
    insert into public.client_activities (
      owner_id, client_id, contract_id, type, description, metadata
    ) values (
      v_owner, v_contract.client_id, v_contract.id, 'financial',
      'Valor do contrato ajustado.',
      jsonb_build_object('new_total', p_new_total)
    );
  end if;
  return to_jsonb(v_contract);
end;
$$;

create or replace function public.cancel_contract(p_contract_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_contract public.contracts;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  select * into v_contract
    from public.contracts
    where id = p_contract_id and owner_id = v_owner
    for update;
  if not found then raise exception 'Contrato não encontrado ou acesso negado.' using errcode = '42501'; end if;
  if v_contract.status = 'cancelled' then return to_jsonb(v_contract); end if;
  update public.contracts
    set status = 'cancelled', cancelled_at = now()
    where id = p_contract_id and owner_id = v_owner
    returning * into v_contract;
  insert into public.client_activities (
    owner_id, client_id, contract_id, type, description
  ) values (
    v_owner, v_contract.client_id, v_contract.id, 'financial',
    'Contrato cancelado. Movimentações históricas preservadas.'
  );
  return to_jsonb(v_contract);
end;
$$;

revoke all on function public.create_contract(jsonb) from public, anon, authenticated;
revoke all on function public.replace_contract_installments(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.adjust_contract(uuid, numeric) from public, anon, authenticated;
revoke all on function public.cancel_contract(uuid) from public, anon, authenticated;
grant execute on function public.create_contract(jsonb) to authenticated;
grant execute on function public.replace_contract_installments(uuid, jsonb) to authenticated;
grant execute on function public.adjust_contract(uuid, numeric) to authenticated;
grant execute on function public.cancel_contract(uuid) to authenticated;
```

- [ ] **Etapa 4: Revisar o ajuste**

Comando: `git diff --check`
Esperado: `contracts` permanece somente com `SELECT` para `authenticated` e o `UPDATE` direto do total falha com `42501`; parcelas só são reescritas antes de pagamento; `[]` remove todas as parcelas e não exige soma; `abc`, exponencial, `NaN`, `Infinity`, mais de duas casas e estouro falham com `22023` antes de qualquer cast, sem persistir parcela; aumento vai para a última parcela; redução usa saldos não alocados e nunca exclui parcela com `financial_payment_allocations`, mesmo após estorno integral; se não for possível reduzir outras, levanta `23514` com `INSTALLMENT_HAS_ALLOCATIONS:`; total não fica abaixo do recebido líquido nem dos projetos não cancelados; a advisory `:contract:<id>` precede o bloqueio da linha e serializa a alocação com o Plano 2.

- [ ] **Etapa 5: Criar commit**

```bash
git add supabase/migrations/0008_etapa3_finance.sql supabase/tests/etapa3_finance.sql
git commit -m "feat: adicionar contratos e parcelas financeiras"
```

### Tarefa 4: Substituir `update_client` e liberar o total antes de dependências financeiras

**Arquivos:**
- Modificar: `supabase/migrations/0008_etapa3_finance.sql`
- Modificar: `supabase/tests/etapa3_finance.sql`
- Modificar: `supabase/tests/etapa3_clients.sql`
- Modificar: `src/services/clientService.ts`
- Modificar: `src/services/clientService.test.ts`
- Modificar: `src/components/clients/ClientForm.tsx`
- Modificar: `src/components/clients/ClientForm.test.tsx`

**Interfaces:**
- Produz: `update_client(uuid,jsonb) returns jsonb`, preservando a assinatura, o `contract_id` explícito e o retorno `{ client, contract }` do Plano 1.
- Consome: `contract_installments`, `financial_payments`, `projects` e a trigger `contracts_enforce_project_allocation` do Plano 2.
- A ordem de locks é `:clients` → `:contract:<id>` → linhas; nenhuma linha é bloqueada antes das duas advisories.
- Qualquer parcela ou pagamento do contrato, inclusive histórico, impede mudança de total; nesse caso, a não alteração do total ainda permite editar cliente e demais campos do contrato.
- Sem dependências, o total textual válido pode mudar, mas nunca pode ficar abaixo da soma de projetos não cancelados. Essa validação ocorre antes de qualquer escrita em todos os caminhos aceitos.
- Esta tarefa substitui integralmente a restrição temporária do Plano 1. O documento do Plano 1 não é alterado; seus testes aplicáveis são ajustados durante a execução desta tarefa.

- [ ] **Etapa 1: Escrever o teste SQL RED antes de `rollback;`**

Acrescentar o bloco abaixo a `supabase/tests/etapa3_finance.sql`. O pagamento de fixture é inserido somente pelo dono das tabelas, fora do papel `authenticated`, para testar a dependência sem antecipar a RPC `record_payment` da Tarefa 5.

```sql
do $$
declare
  v_owner uuid;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_client jsonb;
  v_payment_client jsonb;
  v_updated jsonb;
  v_client_id uuid;
  v_contract_id uuid;
  v_payment_client_id uuid;
  v_payment_contract_id uuid;
  v_project_id uuid;
  v_payload jsonb;
  v_invalid_total text;
  v_state text;
begin
  select id into v_owner from auth.users order by created_at, id limit 1;
  if v_owner is null then raise exception 'Crie ao menos um usuário autenticado.'; end if;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  set local role authenticated;

  v_client := public.create_client(jsonb_build_object(
    'creation_key', gen_random_uuid(), 'name', 'Cliente editável',
    'service', 'Site', 'total_value', '1000.00', 'contracted_at', v_today
  ));
  v_client_id := ((v_client ->> 'client')::jsonb ->> 'id')::uuid;
  v_contract_id := ((v_client ->> 'contract')::jsonb ->> 'id')::uuid;

  -- Sem parcelas nem pagamentos, cliente e contrato inicial mudam atomicamente.
  v_payload := jsonb_build_object(
    'contract_id', v_contract_id, 'name', 'Cliente editável',
    'service', 'Consultoria', 'total_value', '1250.50',
    'contracted_at', v_today, 'due_date', v_today + 30
  );
  v_updated := public.update_client(v_client_id, v_payload);
  if (v_updated ->> 'client')::jsonb ->> 'name' <> 'Cliente editável'
    or ((v_updated ->> 'contract')::jsonb ->> 'total_value')::numeric <> 1250.50
    or (v_updated ->> 'contract')::jsonb ->> 'service' <> 'Consultoria' then
    raise exception 'update_client não alterou cliente e contrato antes das dependências.';
  end if;

  v_payload := jsonb_build_object(
    'client_id', v_client_id, 'contract_id', v_contract_id,
    'name', 'Projeto alocado', 'service', 'Site', 'contracted_value', '800.00',
    'description', null, 'start_date', v_today, 'due_date', v_today + 7,
    'responsible_name', null, 'priority', 'medium'
  );
  v_project_id := (public.create_project(v_payload) ->> 'id')::uuid;

  -- Projeto ativo não bloqueia um total válido que ainda cobre a alocação.
  v_updated := public.update_client(v_client_id, jsonb_build_object(
    'contract_id', v_contract_id, 'name', 'Cliente com projeto ativo',
    'service', 'Consultoria', 'total_value', '1000.00', 'contracted_at', v_today
  ));
  if (v_updated ->> 'client')::jsonb ->> 'name' <> 'Cliente com projeto ativo'
    or ((v_updated ->> 'contract')::jsonb ->> 'total_value')::numeric <> 1000.00 then
    raise exception 'update_client bloqueou um total válido com projeto ativo.';
  end if;

  begin
    perform public.update_client(v_client_id, jsonb_build_object(
      'contract_id', v_contract_id, 'name', 'Nome que não deve persistir',
      'service', 'Consultoria', 'total_value', '700.00', 'contracted_at', v_today
    ));
    raise exception 'update_client aceitou total abaixo dos projetos não cancelados.';
  exception when others then
    if sqlerrm = 'update_client aceitou total abaixo dos projetos não cancelados.' then raise; end if;
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '23514'
      or sqlerrm not like 'PROJECT_ALLOCATION_EXCEEDS_CONTRACT:%' then
      raise;
    end if;
  end;
  if (select name from public.clients where id = v_client_id) <> 'Cliente com projeto ativo'
    or (select total_value from public.contracts where id = v_contract_id) <> 1000.00 then
    raise exception 'A falha de alocação não reverteu cliente e contrato.';
  end if;

  -- Projeto cancelado não consome capacidade e não impede reduzir o total.
  perform public.set_project_status(v_project_id, 'cancelled');
  v_updated := public.update_client(v_client_id, jsonb_build_object(
    'contract_id', v_contract_id, 'name', 'Cliente sem projeto ativo',
    'service', 'Consultoria', 'total_value', '100.00', 'contracted_at', v_today
  ));
  if ((v_updated ->> 'contract')::jsonb ->> 'total_value')::numeric <> 100.00 then
    raise exception 'Projeto cancelado continuou bloqueando a redução do total.';
  end if;

  perform public.replace_contract_installments(v_contract_id, jsonb_build_array(
    jsonb_build_object('amount', '100.00', 'due_date', v_today + 30, 'notes', null)
  ));
  begin
    perform public.update_client(v_client_id, jsonb_build_object(
      'contract_id', v_contract_id, 'name', 'Nome com parcela que não deve persistir',
      'service', 'Consultoria', 'total_value', '90.00', 'contracted_at', v_today
    ));
    raise exception 'update_client alterou o total após a primeira parcela.';
  exception when others then
    if sqlerrm = 'update_client alterou o total após a primeira parcela.' then raise; end if;
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '23514' or sqlerrm not like 'CONTRACT_ADJUST_REQUIRED:%' then raise; end if;
  end;
  if (select name from public.clients where id = v_client_id) <> 'Cliente sem projeto ativo' then
    raise exception 'A falha por parcela não reverteu a edição do cliente.';
  end if;
  v_updated := public.update_client(v_client_id, jsonb_build_object(
    'contract_id', v_contract_id, 'name', 'Cliente com parcela',
    'service', 'Consultoria', 'total_value', '100.00', 'contracted_at', v_today
  ));
  if (v_updated ->> 'client')::jsonb ->> 'name' <> 'Cliente com parcela' then
    raise exception 'Total inalterado não permitiu editar cliente com parcela.';
  end if;

  v_payment_client := public.create_client(jsonb_build_object(
    'creation_key', gen_random_uuid(), 'name', 'Cliente com pagamento',
    'service', 'Site', 'total_value', '300.00', 'contracted_at', v_today
  ));
  v_payment_client_id := ((v_payment_client ->> 'client')::jsonb ->> 'id')::uuid;
  v_payment_contract_id := ((v_payment_client ->> 'contract')::jsonb ->> 'id')::uuid;
  reset role;
  insert into public.financial_payments (
    owner_id, contract_id, idempotency_key, type, amount, received_at
  ) values (
    v_owner, v_payment_contract_id, gen_random_uuid(), 'receipt', 50.00, now()
  );
  set local role authenticated;

  begin
    perform public.update_client(v_payment_client_id, jsonb_build_object(
      'contract_id', v_payment_contract_id, 'name', 'Nome com pagamento que não deve persistir',
      'service', 'Site', 'total_value', '250.00', 'contracted_at', v_today
    ));
    raise exception 'update_client alterou o total após o primeiro pagamento.';
  exception when others then
    if sqlerrm = 'update_client alterou o total após o primeiro pagamento.' then raise; end if;
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '23514' or sqlerrm not like 'CONTRACT_ADJUST_REQUIRED:%' then raise; end if;
  end;
  if (select name from public.clients where id = v_payment_client_id) <> 'Cliente com pagamento' then
    raise exception 'A falha por pagamento não reverteu a edição do cliente.';
  end if;
  v_updated := public.update_client(v_payment_client_id, jsonb_build_object(
    'contract_id', v_payment_contract_id, 'name', 'Cliente com pagamento editado',
    'service', 'Site', 'total_value', '300.00', 'contracted_at', v_today
  ));
  if (v_updated ->> 'client')::jsonb ->> 'name' <> 'Cliente com pagamento editado' then
    raise exception 'Total inalterado não permitiu editar cliente com pagamento.';
  end if;

  foreach v_invalid_total in array array[
    'abc', '1e3', 'NaN', 'Infinity', '750.501', '1000000000000.00'
  ] loop
    begin
      perform public.update_client(v_payment_client_id, jsonb_build_object(
        'contract_id', v_payment_contract_id, 'name', 'Nome com total inválido',
        'service', 'Site', 'total_value', v_invalid_total, 'contracted_at', v_today
      ));
      raise exception 'update_client aceitou total textual inválido: %.', v_invalid_total;
    exception when others then
      if sqlerrm like 'update_client aceitou total textual inválido:%' then raise; end if;
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '22023' then raise; end if;
    end;
  end loop;
  if (select name from public.clients where id = v_payment_client_id) <> 'Cliente com pagamento editado' then
    raise exception 'Uma falha monetária persistiu a edição do cliente.';
  end if;

  reset role;
  raise notice 'update_client com dependências, alocação e validação textual aprovado.';
end
$$;
```

- [ ] **Etapa 2: Confirmar o vermelho**

Aplicar as migrations 0001–0008 e executar o teste SQL. Esperado: RED no primeiro aumento sem dependências, pois a função do Plano 1 sempre exige `CONTRACT_ADJUST_REQUIRED` quando o total muda.

- [ ] **Etapa 3: Substituir integralmente a RPC antes de `commit;`**

```sql
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
  v_contract_id_text text;
  v_cnpj text;
  v_cnpj_name text;
  v_service text;
  v_total numeric(14,2);
  v_total_text text;
  v_contracted_at date;
  v_due_date date;
  v_has_installments boolean;
  v_has_payments boolean;
  v_projects numeric;
begin
  if v_owner is null then
    raise exception 'Sessão autenticada necessária.' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Dados do cliente inválidos.' using errcode = '22023';
  end if;

  v_contract_id_text := nullif(pg_catalog.btrim(p_payload ->> 'contract_id'), '');
  if v_contract_id_text is null then
    raise exception 'Contrato do cliente não encontrado ou acesso negado.' using errcode = '42501';
  end if;
  begin
    v_contract_id := v_contract_id_text::uuid;
  exception when invalid_text_representation then
    raise exception 'Contrato do cliente não encontrado ou acesso negado.' using errcode = '42501';
  end;

  -- Ordem obrigatória: advisory de cliente, advisory de contrato e somente então linhas.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':clients', 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':contract:' || v_contract_id::text, 0)
  );

  select * into v_client
    from public.clients
    where id = p_client_id and owner_id = v_owner
    for update;
  if not found then
    raise exception 'Cliente não encontrado ou acesso negado.' using errcode = '42501';
  end if;
  select * into v_contract
    from public.contracts
    where owner_id = v_owner and client_id = p_client_id and id = v_contract_id
    for update;
  if not found then
    raise exception 'Contrato do cliente não encontrado ou acesso negado.' using errcode = '42501';
  end if;

  v_old_status := v_client.status;
  v_service := nullif(pg_catalog.btrim(p_payload ->> 'service'), '');
  v_total_text := nullif(pg_catalog.btrim(p_payload ->> 'total_value'), '');
  v_contracted_at := (p_payload ->> 'contracted_at')::date;
  v_due_date := nullif(p_payload ->> 'due_date', '')::date;
  if nullif(pg_catalog.btrim(p_payload ->> 'name'), '') is null
    or v_service is null or v_total_text is null
    or v_total_text !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$'
    or v_contracted_at is null then
    raise exception 'Informe nome, serviço, valor e data da contratação.' using errcode = '22023';
  end if;
  -- O cast só ocorre depois que a forma textual e o limite estrutural foram aceitos.
  v_total := v_total_text::numeric(14,2);
  if v_due_date is not null and v_due_date < v_contracted_at then
    raise exception 'O vencimento não pode anteceder a contratação.' using errcode = '22023';
  end if;

  select exists (
    select 1 from public.contract_installments i
    where i.contract_id = v_contract_id and i.owner_id = v_owner
  ) into v_has_installments;
  select exists (
    select 1 from public.financial_payments p
    where p.contract_id = v_contract_id and p.owner_id = v_owner
  ) into v_has_payments;
  if (v_has_installments or v_has_payments)
    and v_total is distinct from v_contract.total_value then
    raise exception 'CONTRACT_ADJUST_REQUIRED: use o ajuste financeiro do contrato.'
      using errcode = '23514';
  end if;

  -- Todo caminho que chega à escrita revalida a alocação, inclusive com total inalterado.
  select coalesce(sum(p.contracted_value), 0) into v_projects
    from public.projects p
    where p.contract_id = v_contract_id
      and p.owner_id = v_owner
      and p.status <> 'cancelled';
  if v_total < v_projects then
    raise exception 'PROJECT_ALLOCATION_EXCEEDS_CONTRACT: total % menor que projetos alocados %.',
      v_total, v_projects using errcode = '23514';
  end if;

  v_cnpj := nullif(pg_catalog.regexp_replace(p_payload ->> 'cnpj', '[^0-9]', '', 'g'), '');
  if v_cnpj is not null and exists (
    select 1 from public.clients
    where owner_id = v_owner and cnpj_digits = v_cnpj and id <> p_client_id
  ) then
    select name into v_cnpj_name from public.clients
    where owner_id = v_owner and cnpj_digits = v_cnpj limit 1;
    raise exception 'CLIENT_CNPJ_DUPLICATE:%', v_cnpj_name using errcode = '23505';
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

revoke all on function public.update_client(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.update_client(uuid, jsonb) to authenticated;
```

- [ ] **Etapa 4: Escrever os testes RED de UI e serviço**

Em `src/components/clients/ClientForm.test.tsx`, substituir o teste `edita com contractId explícito, initialContract completo e total readOnly` por:

```tsx
it('edita com contractId explícito, initialContract completo e total alterado', async () => {
  const client = makeClient({ name: 'Empresa A' })
  const contract = makeContract()
  const saved = makeClient({ name: 'Empresa Editada' })
  updateClient.mockResolvedValue(saved)
  const onSaved = vi.fn()
  render(<ClientForm mode="edit" client={client} contract={contract} onCancel={vi.fn()} onSaved={onSaved} />)

  const total = screen.getByLabelText('Valor contratado *') as HTMLInputElement
  expect(total.readOnly).toBe(false)
  expect(total.value).toBe('1000.00')
  fireEvent.change(total, { target: { value: '1.250,50' } })
  fireEvent.change(screen.getByLabelText('Nome do cliente *'), { target: { value: 'Empresa Editada' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cliente' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved))
  expect(updateClient).toHaveBeenCalledWith('client-1', expect.objectContaining({
    name: 'Empresa Editada',
    contractId: 'contract-1',
    initialContract: {
      service: 'Site',
      totalValueCents: 125050,
      contractedAt: '2026-11-20',
      dueDate: '2026-12-01',
      paymentMethod: 'pix',
      paymentTerms: '50% na assinatura',
      notes: 'Observações do contrato',
    },
  }))
  expect(createClient).not.toHaveBeenCalled()
})

it('preserva o valor e mostra a orientação quando dependências exigem ajuste financeiro', async () => {
  updateClient.mockRejectedValue(new Error(
    'O total do contrato não pode ser alterado após a primeira parcela ou pagamento. Use o ajuste financeiro do contrato.',
  ))
  const onSaved = vi.fn()
  render(<ClientForm mode="edit" client={makeClient()} contract={makeContract()} onCancel={vi.fn()} onSaved={onSaved} />)

  fireEvent.change(screen.getByLabelText('Valor contratado *'), { target: { value: '900,00' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar cliente' }))

  expect((await screen.findByText(
    'O total do contrato não pode ser alterado após a primeira parcela ou pagamento. Use o ajuste financeiro do contrato.',
  )).textContent).toContain('Use o ajuste financeiro do contrato.')
  expect((screen.getByLabelText('Valor contratado *') as HTMLInputElement).value).toBe('900,00')
  expect(onSaved).not.toHaveBeenCalled()
})
```

Em `src/services/clientService.test.ts`, acrescentar:

```ts
it('updateClient traduz CONTRACT_ADJUST_REQUIRED e preserva a orientação financeira', async () => {
  rpc.mockResolvedValue({
    data: null,
    error: { message: 'CONTRACT_ADJUST_REQUIRED: use o ajuste financeiro do contrato.' },
  })

  await expect(updateClient('client-1', {
    ...makeClientWrite(),
    contractId: 'contract-1',
    initialContract: makeInitialContract(),
  })).rejects.toThrow(
    'O total do contrato não pode ser alterado após a primeira parcela ou pagamento. Use o ajuste financeiro do contrato.',
  )
})

it('updateClient traduz PROJECT_ALLOCATION_EXCEEDS_CONTRACT', async () => {
  rpc.mockResolvedValue({
    data: null,
    error: { message: 'PROJECT_ALLOCATION_EXCEEDS_CONTRACT: total 700 menor que projetos alocados 800.' },
  })

  await expect(updateClient('client-1', {
    ...makeClientWrite(),
    contractId: 'contract-1',
    initialContract: makeInitialContract(),
  })).rejects.toThrow('O valor do contrato não pode ser menor que a soma dos projetos não cancelados.')
})
```

No teste SQL do Plano 1, imediatamente antes do bloco que tenta reduzir o total para `749.99`, criar uma parcela de `750.50` com `replace_contract_installments`. Assim, a expectativa `CONTRACT_ADJUST_REQUIRED` continua válida, agora porque existe dependência financeira, e não representa mais a restrição provisória de total readonly.

- [ ] **Etapa 5: Confirmar o vermelho de UI e serviço**

Comando: `npm test -- src/services/clientService.test.ts src/components/clients/ClientForm.test.tsx`
Esperado: o campo ainda está readonly, o payload não envia `125050` e os novos erros não são traduzidos.

- [ ] **Etapa 6: Implementar serviço e UI**

Substituir `updateClient` em `src/services/clientService.ts` por:

```ts
export async function updateClient(id: string, input: UpdateClientInput): Promise<Client> {
  const { data, error } = await requireSupabase().rpc('update_client', {
    p_client_id: id,
    p_payload: {
      ...clientPayload(input),
      contract_id: input.contractId,
      ...contractPayload(input.initialContract),
    },
  })
  if (error?.message.includes('CLIENT_CNPJ_DUPLICATE:')) {
    throw new Error(`Já existe um cliente com este CNPJ: ${error.message.split(':')[1]}.`)
  }
  if (error?.message.includes('CONTRACT_ADJUST_REQUIRED:')) {
    throw new Error('O total do contrato não pode ser alterado após a primeira parcela ou pagamento. Use o ajuste financeiro do contrato.')
  }
  if (error?.message.includes('PROJECT_ALLOCATION_EXCEEDS_CONTRACT:')) {
    throw new Error('O valor do contrato não pode ser menor que a soma dos projetos não cancelados.')
  }
  throwDbError(error)
  return parseClient(data)
}
```

Em `ClientForm.tsx`, remover `readOnly` do campo total, trocar `aria-describedby="contract-total-readonly"` por `aria-describedby="contract-total-rule"` e substituir o texto auxiliar readonly por:

```tsx
<p id="contract-total-rule" className="text-xs text-muted">
  O total pode ser alterado antes da primeira parcela ou pagamento. Depois, use o ajuste financeiro do contrato.
</p>
```

Renderizar o texto auxiliar nos dois modos, sem a condicional `mode === 'edit'`, e usar `aria-describedby="contract-total-rule"` no campo. A UI não tenta adivinhar dependências: a RPC é a autoridade e o serviço traduz a rejeição para orientação em pt-BR.

- [ ] **Etapa 7: Confirmar o verde e revisar**

Executar o teste SQL e o comando:

```bash
npm test -- src/services/clientService.test.ts src/components/clients/ClientForm.test.tsx
```

Esperado: aumento sem dependências passa; projeto cancelado é excluído da soma; parcela/pagamento bloqueiam somente mudança de total; valores textuais inválidos retornam `22023`; UI envia centavos inteiros e preserva o valor após erro. Comando de revisão: `git diff --check`.

- [ ] **Etapa 8: Criar commit**

```bash
git add supabase/migrations/0008_etapa3_finance.sql supabase/tests/etapa3_finance.sql supabase/tests/etapa3_clients.sql src/services/clientService.ts src/services/clientService.test.ts src/components/clients/ClientForm.tsx src/components/clients/ClientForm.test.tsx
git commit -m "feat: liberar ajuste inicial de contrato pelo cliente"
```

---

### Tarefa 5: Implementar recebimentos, alocações e estornos idempotentes

**Arquivos:**
- Modificar: `supabase/migrations/0008_etapa3_finance.sql`
- Modificar: `supabase/tests/etapa3_finance.sql`

**Interfaces:**
- Produz: `record_payment(jsonb) returns jsonb`.
- Consome: `financial_payments`, `financial_payment_allocations`, `contract_installments`, `projects` e as RPCs `create_project`, `update_project` e `set_project_status` do Plano 2 para os probes de concorrência.
- Consome: `update_client` da Tarefa 4 para o probe isolado da advisory `:contract:<id>`.

- [ ] **Etapa 1: Estender o teste SQL antes de `rollback;`**

```sql
do $$
declare
  v_owner uuid;
  v_other uuid;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_client jsonb;
  v_other_client jsonb;
  v_contract_id uuid;
  v_other_contract_id uuid;
  v_installment_ids uuid[];
  v_payment jsonb;
  v_repeat jsonb;
  v_refund jsonb;
  v_count int;
  v_net numeric;
  v_total numeric;
  v_last_amount numeric;
  v_state text;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    (
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'finance-owner@example.test', '', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Financeiro Owner"}'::jsonb, now(), now()
    ),
    (
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'finance-other@example.test', '', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Financeiro Other"}'::jsonb, now(), now()
    );
  select id into v_owner from auth.users where id = '00000000-0000-4000-8000-000000000001';
  select id into v_other from auth.users where id = '00000000-0000-4000-8000-000000000002';
  if v_owner is null or v_other is null then raise exception 'Fixtures de auth.users não foram criadas.'; end if;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  set local role authenticated;
  v_client := public.create_client(jsonb_build_object(
    'creation_key', gen_random_uuid(),
    'name', 'Cliente de pagamento',
    'service', 'Site',
    'total_value', '1000.00',
    'contracted_at', v_today
  ));
  v_contract_id := ((v_client ->> 'contract')::jsonb ->> 'id')::uuid;
  perform public.replace_contract_installments(v_contract_id, jsonb_build_array(
    jsonb_build_object('amount', '600.00', 'due_date', v_today + 7, 'notes', null),
    jsonb_build_object('amount', '400.00', 'due_date', v_today + 30, 'notes', null)
  ));
  select array_agg(id order by position) into v_installment_ids
    from public.contract_installments
    where contract_id = v_contract_id;

  v_payment := public.record_payment(jsonb_build_object(
    'contract_id', v_contract_id,
    'idempotency_key', gen_random_uuid(),
    'type', 'receipt',
    'amount', '300.00',
    'received_at', now(),
    'payment_method', 'pix',
    'notes', 'Entrada',
    'related_payment_id', null,
    'allocations', jsonb_build_array(
      jsonb_build_object('installment_id', v_installment_ids[1], 'amount', '200.00'),
      jsonb_build_object('installment_id', v_installment_ids[2], 'amount', '100.00')
    )
  ));
  v_repeat := public.record_payment(jsonb_build_object(
    'contract_id', v_contract_id,
    'idempotency_key', v_payment ->> 'idempotency_key',
    'type', 'receipt',
    'amount', '999.00',
    'received_at', now(),
    'payment_method', 'cartao',
    'notes', 'Different',
    'related_payment_id', null,
    'allocations', '[]'::jsonb
  ));
  if (v_payment ->> 'id') is distinct from (v_repeat ->> 'id')
    or (v_repeat ->> 'already_existed') is distinct from 'true' then
    raise exception 'Pagamento idempotente não retornou o existente.';
  end if;
  select count(*) into v_count
    from public.financial_payments
    where contract_id = v_contract_id;
  if v_count <> 1 then raise exception 'Pagamento duplicado.'; end if;

  v_refund := public.record_payment(jsonb_build_object(
    'contract_id', v_contract_id,
    'idempotency_key', gen_random_uuid(),
    'type', 'refund',
    'amount', '50.00',
    'received_at', now(),
    'payment_method', 'pix',
    'notes', 'Estorno',
    'related_payment_id', (v_payment ->> 'id')::uuid,
    'allocations', jsonb_build_array(
      jsonb_build_object('installment_id', v_installment_ids[1], 'amount', '50.00')
    )
  ));
  select coalesce(sum(case when type = 'receipt' then amount else -amount end), 0)
    into v_net
    from public.financial_payments
    where contract_id = v_contract_id;
  if v_net <> 250.00 then raise exception 'Recebido líquido incorreto após estorno.'; end if;

  perform public.adjust_contract(v_contract_id, 900.00);
  select total_value into v_total from public.contracts where id = v_contract_id;
  if v_total <> 900.00 then raise exception 'Ajuste após pagamento falhou.'; end if;

  begin
    perform public.adjust_contract(v_contract_id, 200.00);
    raise exception 'Total abaixo do recebido foi aceito.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '23514' or sqlerrm <> 'O novo total não pode ser menor que o recebido líquido.' then
      raise;
    end if;
  end;

  perform public.record_payment(jsonb_build_object(
    'contract_id', v_contract_id,
    'idempotency_key', gen_random_uuid(),
    'type', 'refund',
    'amount', '250.00',
    'received_at', now(),
    'payment_method', 'pix',
    'notes', 'Estorno integral do saldo restante',
    'related_payment_id', (v_payment ->> 'id')::uuid,
    'allocations', jsonb_build_array(
      jsonb_build_object('installment_id', v_installment_ids[1], 'amount', '150.00'),
      jsonb_build_object('installment_id', v_installment_ids[2], 'amount', '100.00')
    )
  ));
  select coalesce(sum(case when type = 'receipt' then amount else -amount end), 0)
    into v_net
    from public.financial_payments
    where contract_id = v_contract_id;
  if v_net <> 0 then raise exception 'Estorno integral não zerou o recebido líquido.'; end if;

  -- A última parcela possui alocações históricas e não pode ser excluída, embora seu
  -- saldo líquido seja zero; a redução deve recuar e reduzir a outra parcela.
  perform public.adjust_contract(v_contract_id, 400.00);
  select count(*) into v_count from public.contract_installments where contract_id = v_contract_id;
  if v_count <> 2 then raise exception 'Ajuste excluiu parcela com alocação histórica.'; end if;
  select amount into v_last_amount from public.contract_installments
    where contract_id = v_contract_id and position = 0;
  if v_last_amount <> 100.00 then raise exception 'Redução não preservou a parcela alocada.'; end if;
  select amount into v_last_amount from public.contract_installments
    where contract_id = v_contract_id and position = 1;
  if v_last_amount <> 300.00 then raise exception 'Redução eliminou a última parcela alocada.'; end if;
  select count(*) into v_count from public.financial_payment_allocations
    where contract_id = v_contract_id;
  if v_count <> 5 then raise exception 'Alocações históricas não foram preservadas.'; end if;

  begin
    perform public.adjust_contract(v_contract_id, 0);
    raise exception 'Ajuste eliminou todas as parcelas com alocações.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '23514' or sqlerrm not like 'INSTALLMENT_HAS_ALLOCATIONS:%' then
      raise;
    end if;
  end;
  select total_value into v_total from public.contracts where id = v_contract_id;
  if v_total <> 400.00 then raise exception 'Falha de ajuste não preservou o total.'; end if;

  begin
    perform public.record_payment(jsonb_build_object(
      'contract_id', v_contract_id,
      'idempotency_key', gen_random_uuid(),
      'type', 'receipt',
      'amount', '100.00',
      'received_at', now(),
      'related_payment_id', null,
      'allocations', jsonb_build_array(
        jsonb_build_object('installment_id', v_installment_ids[1], 'amount', '50.00'),
        jsonb_build_object('installment_id', v_installment_ids[1], 'amount', '50.00')
      )
    ));
    raise exception 'Alocação duplicada foi aceita.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '23514' or sqlerrm <> 'Há parcelas duplicadas nas alocações.' then
      raise;
    end if;
  end;

  begin
    perform public.record_payment(jsonb_build_object(
      'contract_id', v_contract_id,
      'idempotency_key', gen_random_uuid(),
      'type', 'receipt',
      'amount', '800.00',
      'received_at', now(),
      'related_payment_id', null,
      'allocations', '[]'::jsonb
    ));
    raise exception 'Recebimento acima do saldo foi aceito.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '23514' or sqlerrm <> 'O recebimento excede o saldo contratado.' then
      raise;
    end if;
  end;

  begin
    perform public.record_payment(jsonb_build_object(
      'contract_id', v_contract_id,
      'idempotency_key', gen_random_uuid(),
      'type', 'refund',
      'amount', '300.00',
      'received_at', now(),
      'related_payment_id', (v_payment ->> 'id')::uuid,
      'allocations', '[]'::jsonb
    ));
    raise exception 'Estorno excessivo foi aceito.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '23514' or sqlerrm <> 'O estorno excede o recebimento original.' then
      raise;
    end if;
  end;

  -- O segundo proprietário é um usuário real de auth.users, não apenas um claim.
  perform set_config('request.jwt.claim.sub', v_other::text, true);
  v_other_client := public.create_client(jsonb_build_object(
    'creation_key', gen_random_uuid(),
    'name', 'Cliente do segundo proprietário',
    'service', 'Consultoria',
    'total_value', '500.00',
    'contracted_at', v_today
  ));
  v_other_contract_id := ((v_other_client ->> 'contract')::jsonb ->> 'id')::uuid;
  perform public.replace_contract_installments(v_other_contract_id, jsonb_build_array(
    jsonb_build_object('amount', '500.00', 'due_date', v_today + 30, 'notes', null)
  ));
  perform public.record_payment(jsonb_build_object(
    'contract_id', v_other_contract_id,
    'idempotency_key', gen_random_uuid(),
    'type', 'receipt',
    'amount', '100.00',
    'received_at', now(),
    'payment_method', 'pix',
    'notes', 'Recebimento do segundo proprietário',
    'related_payment_id', null,
    'allocations', jsonb_build_array(
      jsonb_build_object(
        'installment_id', (select id from public.contract_installments where contract_id = v_other_contract_id),
        'amount', '100.00'
      )
    )
  ));

  if exists (select 1 from public.clients where owner_id = v_owner)
    or exists (select 1 from public.contracts where owner_id = v_owner)
    or exists (select 1 from public.contract_installments where owner_id = v_owner)
    or exists (select 1 from public.financial_payments where owner_id = v_owner)
    or exists (select 1 from public.financial_payment_allocations where owner_id = v_owner) then
    raise exception 'O segundo proprietário conseguiu ler dados do primeiro.';
  end if;
  select count(*) into v_count from public.clients where owner_id = v_other;
  if v_count <> 1 then raise exception 'O segundo proprietário não lê o próprio cliente.'; end if;
  select count(*) into v_count from public.contracts where owner_id = v_other;
  if v_count <> 1 then raise exception 'O segundo proprietário não lê o próprio contrato.'; end if;
  select count(*) into v_count from public.contract_installments where owner_id = v_other;
  if v_count <> 1 then raise exception 'O segundo proprietário não lê a própria parcela.'; end if;
  select count(*) into v_count from public.financial_payments where owner_id = v_other;
  if v_count <> 1 then raise exception 'O segundo proprietário não lê o próprio pagamento.'; end if;
  select count(*) into v_count from public.financial_payment_allocations where owner_id = v_other;
  if v_count <> 1 then raise exception 'O segundo proprietário não lê a própria alocação.'; end if;

  begin
    perform public.create_contract(jsonb_build_object(
      'creation_key', gen_random_uuid(),
      'client_id', ((v_client ->> 'client')::jsonb ->> 'id')::uuid,
      'service', 'Acesso indevido',
      'total_value', '1.00',
      'contracted_at', v_today
    ));
    raise exception 'create_foreign_contract';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '42501' or sqlerrm <> 'Cliente não encontrado ou acesso negado.' then raise; end if;
  end;
  begin
    perform public.replace_contract_installments(v_contract_id, '[]'::jsonb);
    raise exception 'replace_foreign_installments';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '42501' or sqlerrm <> 'Contrato não encontrado ou acesso negado.' then raise; end if;
  end;
  begin
    perform public.adjust_contract(v_contract_id, 1.00);
    raise exception 'adjust_foreign_contract';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '42501' or sqlerrm <> 'Contrato não encontrado ou acesso negado.' then raise; end if;
  end;
  begin
    perform public.cancel_contract(v_contract_id);
    raise exception 'cancel_foreign_contract';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '42501' or sqlerrm <> 'Contrato não encontrado ou acesso negado.' then raise; end if;
  end;
  begin
    perform public.record_payment(jsonb_build_object(
      'contract_id', v_contract_id,
      'idempotency_key', gen_random_uuid(),
      'type', 'receipt',
      'amount', '1.00',
      'received_at', now(),
      'related_payment_id', null,
      'allocations', '[]'::jsonb
    ));
    raise exception 'pay_foreign_contract';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '42501' or sqlerrm <> 'Contrato não encontrado ou acesso negado.' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  if exists (select 1 from public.clients where owner_id = v_other)
    or exists (select 1 from public.contracts where owner_id = v_other)
    or exists (select 1 from public.contract_installments where owner_id = v_other)
    or exists (select 1 from public.financial_payments where owner_id = v_other)
    or exists (select 1 from public.financial_payment_allocations where owner_id = v_other) then
    raise exception 'O primeiro proprietário conseguiu ler dados do segundo.';
  end if;
  select count(*) into v_count from public.contracts where owner_id = v_owner;
  if v_count <> 1 then raise exception 'Chamadas cross-owner alteraram os contratos do proprietário.'; end if;
  select count(*) into v_count from public.financial_payments where owner_id = v_owner;
  if v_count <> 3 then raise exception 'Chamadas cross-owner alteraram os pagamentos do proprietário.'; end if;
  select total_value into v_total from public.contracts where id = v_contract_id;
  if v_total <> 400.00 then raise exception 'Chamadas cross-owner alteraram o total do contrato.'; end if;

  reset role;
  raise notice 'Contrato SQL de pagamentos, estornos e isolamento entre proprietários aprovado.';
end
$$;
```

- [ ] **Etapa 2: Confirmar o vermelho**

Esperado: `public.record_payment(jsonb)` não existe.

- [ ] **Etapa 3: Inserir a RPC de pagamento antes de `commit;`**

```sql
create or replace function public.record_payment(p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_contract_id uuid;
  v_key uuid;
  v_type text;
  v_amount numeric;
  v_amount_text text;
  v_received_at timestamptz;
  v_related_id uuid;
  v_payment public.financial_payments;
  v_related public.financial_payments;
  v_contract public.contracts;
  v_net numeric;
  v_related_refunded numeric;
  v_installment_count int;
  v_allocation_sum numeric;
  v_allocation jsonb;
  v_installment public.contract_installments;
  v_installment_net numeric;
  v_related_allocation numeric;
  v_related_refund_allocation numeric;
  v_allocation_amount numeric;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Dados do pagamento inválidos.' using errcode = '22023';
  end if;
  v_key := (p_payload ->> 'idempotency_key')::uuid;
  if v_key is null then raise exception 'Chave de idempotência inválida.' using errcode = '22023'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':payment:' || v_key::text, 0)
  );
  select * into v_payment
    from public.financial_payments
    where owner_id = v_owner and idempotency_key = v_key;
  if found then
    return to_jsonb(v_payment) || jsonb_build_object(
      'allocations', coalesce((
        select jsonb_agg(to_jsonb(a) order by a.created_at, a.id)
        from public.financial_payment_allocations a
        where a.payment_id = v_payment.id and a.owner_id = v_owner
      ), '[]'::jsonb),
      'already_existed', true
    );
  end if;

  v_contract_id := (p_payload ->> 'contract_id')::uuid;
  v_type := p_payload ->> 'type';
  v_amount_text := nullif(pg_catalog.btrim(p_payload ->> 'amount'), '');
  v_received_at := (p_payload ->> 'received_at')::timestamptz;
  v_related_id := nullif(p_payload ->> 'related_payment_id', '')::uuid;
  if v_contract_id is null or v_type not in ('receipt','refund')
    or v_amount_text is null or v_amount_text !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$'
    or v_amount_text ~ '^0+(\.0{1,2})?$' or v_received_at is null then
    raise exception 'Dados do pagamento inválidos.' using errcode = '22023';
  end if;
  v_amount := v_amount_text::numeric(14,2);
  if v_type = 'receipt' and v_related_id is not null then
    raise exception 'Recebimento não pode ter pagamento relacionado.' using errcode = '22023';
  end if;
  if v_type = 'refund' and v_related_id is null then
    raise exception 'Estorno exige o recebimento original.' using errcode = '22023';
  end if;
  if p_payload -> 'allocations' is not null and jsonb_typeof(p_payload -> 'allocations') <> 'array' then
    raise exception 'Alocações devem ser uma lista.' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_payload -> 'allocations', '[]'::jsonb)) as a(value)
    where jsonb_typeof(a.value) <> 'object'
      or nullif(a.value ->> 'amount', '') is null
      or (a.value ->> 'amount') !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$'
      or (a.value ->> 'amount') ~ '^0+(\.0{1,2})?$'
      or nullif(a.value ->> 'installment_id', '') is null
  ) then
    raise exception 'Alocação inválida.' using errcode = '22023';
  end if;

  select * into v_contract
    from public.contracts
    where id = v_contract_id and owner_id = v_owner
    for update;
  if not found then raise exception 'Contrato não encontrado ou acesso negado.' using errcode = '42501'; end if;
  if v_type = 'receipt' and v_contract.status <> 'active' then
    raise exception 'Não é possível receber em contrato cancelado.' using errcode = '23514';
  end if;
  select coalesce(sum(case when p.type = 'receipt' then p.amount else -p.amount end), 0)
    into v_net
    from public.financial_payments p
    where p.contract_id = v_contract_id and p.owner_id = v_owner;

  if v_type = 'receipt' then
    if v_net + v_amount > v_contract.total_value then
      raise exception 'O recebimento excede o saldo contratado.' using errcode = '23514';
    end if;
  else
    select * into v_related
      from public.financial_payments p
      where p.id = v_related_id and p.contract_id = v_contract_id
        and p.owner_id = v_owner and p.type = 'receipt'
      for update;
    if not found then raise exception 'Recebimento original não encontrado.' using errcode = '42501'; end if;
    select coalesce(sum(p.amount), 0) into v_related_refunded
      from public.financial_payments p
      where p.owner_id = v_owner and p.related_payment_id = v_related.id and p.type = 'refund';
    if v_related_refunded + v_amount > v_related.amount then
      raise exception 'O estorno excede o recebimento original.' using errcode = '23514';
    end if;
    if v_net - v_amount < 0 then
      raise exception 'O estorno tornaria o recebido líquido negativo.' using errcode = '23514';
    end if;
  end if;

  select count(*) into v_installment_count
    from public.contract_installments
    where contract_id = v_contract_id and owner_id = v_owner;
  select coalesce(sum((value ->> 'amount')::numeric), 0) into v_allocation_sum
    from jsonb_array_elements(coalesce(p_payload -> 'allocations', '[]'::jsonb));

  if v_installment_count > 0 then
    if v_allocation_sum <> v_amount then
      raise exception 'A soma das alocações deve ser igual ao valor do pagamento.' using errcode = '23514';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(coalesce(p_payload -> 'allocations','[]'::jsonb)) as a(value)
      group by a.value ->> 'installment_id'
      having count(*) > 1
    ) then
      raise exception 'Há parcelas duplicadas nas alocações.' using errcode = '23514';
    end if;

    for v_allocation in
      select value from jsonb_array_elements(coalesce(p_payload -> 'allocations', '[]'::jsonb))
    loop
      v_allocation_amount := (v_allocation ->> 'amount')::numeric;
      select * into v_installment
        from public.contract_installments i
        where i.id = (v_allocation ->> 'installment_id')::uuid
          and i.contract_id = v_contract_id and i.owner_id = v_owner
        for update;
      if not found then raise exception 'Parcela não encontrada neste contrato.' using errcode = '42501'; end if;
      select coalesce(sum(case when p.type = 'receipt' then a.amount else -a.amount end), 0)
        into v_installment_net
        from public.financial_payment_allocations a
        join public.financial_payments p on p.id = a.payment_id
        where a.installment_id = v_installment.id and a.owner_id = v_owner;

      if v_type = 'receipt' then
        if v_installment_net + v_allocation_amount > v_installment.amount then
          raise exception 'A alocação excede o saldo da parcela.' using errcode = '23514';
        end if;
      else
        select coalesce(sum(a.amount), 0) into v_related_allocation
          from public.financial_payment_allocations a
          where a.payment_id = v_related.id
            and a.installment_id = v_installment.id and a.owner_id = v_owner;
        select coalesce(sum(a.amount), 0) into v_related_refund_allocation
          from public.financial_payment_allocations a
          join public.financial_payments p on p.id = a.payment_id
          where p.type = 'refund' and p.related_payment_id = v_related.id
            and a.installment_id = v_installment.id and a.owner_id = v_owner;
        if v_related_allocation = 0
          or v_allocation_amount > v_related_allocation - v_related_refund_allocation
          or v_allocation_amount > v_installment_net then
          raise exception 'O estorno excede o valor alocado à parcela.' using errcode = '23514';
        end if;
      end if;
    end loop;
  elsif coalesce(jsonb_array_length(coalesce(p_payload -> 'allocations', '[]'::jsonb)), 0) <> 0 then
    raise exception 'Contrato sem parcelas não aceita alocações.' using errcode = '23514';
  end if;

  insert into public.financial_payments (
    owner_id, contract_id, idempotency_key, related_payment_id, type, amount,
    received_at, payment_method, notes
  ) values (
    v_owner, v_contract_id, v_key, v_related_id, v_type, v_amount, v_received_at,
    nullif(pg_catalog.btrim(p_payload ->> 'payment_method'), ''), nullif(p_payload ->> 'notes', '')
  ) on conflict (idempotency_key) do nothing
  returning * into v_payment;

  if not found then
    select * into v_payment
      from public.financial_payments
      where owner_id = v_owner and idempotency_key = v_key;
    if not found then
      raise exception 'Chave de idempotência já utilizada.' using errcode = '23505';
    end if;
    return to_jsonb(v_payment) || jsonb_build_object(
      'allocations', coalesce((
        select jsonb_agg(to_jsonb(a) order by a.created_at, a.id)
        from public.financial_payment_allocations a
        where a.payment_id = v_payment.id and a.owner_id = v_owner
      ), '[]'::jsonb),
      'already_existed', true
    );
  end if;

  insert into public.financial_payment_allocations (
    owner_id, contract_id, payment_id, installment_id, amount
  )
  select v_owner, v_contract_id, v_payment.id,
    (value ->> 'installment_id')::uuid, (value ->> 'amount')::numeric
  from jsonb_array_elements(coalesce(p_payload -> 'allocations', '[]'::jsonb));

  insert into public.client_activities (
    owner_id, client_id, contract_id, type, description, metadata
  ) values (
    v_owner, v_contract.client_id, v_contract_id, 'financial',
    case when v_type = 'receipt' then 'Recebimento registrado.' else 'Estorno registrado.' end,
    jsonb_build_object('payment_id', v_payment.id, 'amount', v_amount, 'payment_type', v_type)
  );
  return to_jsonb(v_payment) || jsonb_build_object(
    'allocations', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at, a.id)
      from public.financial_payment_allocations a
      where a.payment_id = v_payment.id and a.owner_id = v_owner
    ), '[]'::jsonb),
    'already_existed', false
  );
end;
$$;

revoke all on function public.record_payment(jsonb) from public, anon, authenticated;
grant execute on function public.record_payment(jsonb) to authenticated;
```

- [ ] **Etapa 4: Revisar invariantes de pagamento**

Comando: `git diff --check`
Esperado: lock consultivo por proprietário/chave antes da consulta de idempotência; contrato bloqueado; recebimento limitado ao saldo ativo; estorno limitado ao recebimento original e à alocação líquida; valores por pagamento/alocação limitados a `999999999999.99`; duplicidades de parcelas rejeitadas; nenhuma exclusão financeira é exposta; dois usuários reais de `auth.users` leem somente os próprios dados e chamadas cross-owner às RPCs financeiras falham com `42501`; o harness concorrente prova serialização de `creation_key`/`idempotency_key`, bloqueio de `create_client`, `update_client`, `archive_client` e `convert_lead_to_client` pela advisory `:clients`, um probe isolado de `update_client` contra somente `:contract:<id>`, os locks entre contrato, parcelas e pagamento e os seis probes bidirecionais entre `adjust_contract` e `create_project`/`update_project`/`set_project_status`, todos com `55P03` e nunca `40P01`.

- [ ] **Etapa 5: Provar idempotência e serialização de contratos/pagamentos**

Execute o bloco abaixo no SQL Editor com as migrations 0001–0008 aplicadas, a extensão `dblink` disponível e ao menos um usuário já commitado em `auth.users`. A conexão `dblink` usa o socket local com o banco e o usuário atuais; ela precisa ser aceita pela configuração de autenticação do banco de teste. Não há `psql`, loop de sincronização nem `pg_sleep`: a sessão remota primeiro confirma os locks e somente depois a sessão local faz probes com `lock_timeout`. O timeout é apenas uma proteção contra bloqueio infinito; como cada lock conflitante já está comprovadamente adquirido, o resultado esperado é sempre `55P03`, nunca `40P01`. Além dos locks de cliente/contrato/parcela/pagamento, o harness isola uma única advisory `:contract:<id>` para `update_client` e mantém advisories de contrato separadas para cada RPC de projeto. O cleanup dos fixtures, incluindo projetos, é tentado em transação remota mesmo quando uma asserção falha; rollback, cleanup e disconnect são tentados individualmente nos caminhos normal e de exceção.

```sql
create extension if not exists dblink;

do $$
declare
  v_conn text := 'finance_concurrency';
  v_owner uuid;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_client_id uuid;
  v_lead_id uuid;
  v_contract_id uuid;
  v_created_contract_id uuid;
  v_payment_contract_id uuid;
  v_adjust_contract_id uuid;
  v_adjust_payment_contract_id uuid;
  v_create_project_contract_id uuid;
  v_update_project_contract_id uuid;
  v_status_contract_id uuid;
  v_adjust_project_id uuid;
  v_update_project_id uuid;
  v_status_project_id uuid;
  v_installment_id uuid;
  v_creation_key uuid := gen_random_uuid();
  v_payment_key uuid := gen_random_uuid();
  v_base_payload jsonb;
  v_payload jsonb;
  v_client jsonb;
  v_project jsonb;
  v_created jsonb;
  v_repeat jsonb;
  v_payment jsonb;
  v_payment_repeat jsonb;
  v_result text;
  v_cleanup_sql text;
  v_setup_committed boolean := false;
  v_state text;
begin
  select id into v_owner from auth.users order by created_at, id limit 1;
  if v_owner is null then raise exception 'Crie ao menos um usuário autenticado antes do teste.'; end if;
  perform dblink_connect(v_conn, format('dbname=%L user=%L', current_database(), current_user));

  begin
    -- Fixtures visíveis às duas sessões; a transação de locks abaixo não os cria.
    perform dblink_exec(v_conn, 'begin');
    perform dblink_exec(v_conn, 'set local role authenticated');
    perform dblink_exec(v_conn, format('select set_config(''request.jwt.claim.sub'', %L, true)', v_owner::text));
    v_payload := jsonb_build_object(
      'creation_key', gen_random_uuid(), 'name', 'Fixture de concorrência financeira',
      'service', 'Site', 'total_value', '1000.00', 'contracted_at', v_today
    );
    select dblink_eval(v_conn, 'select public.create_client(' || quote_literal(v_payload::text) || '::jsonb)') into v_result;
    v_client := v_result::jsonb;
    v_client_id := ((v_client ->> 'client')::jsonb ->> 'id')::uuid;
    v_contract_id := ((v_client ->> 'contract')::jsonb ->> 'id')::uuid;
    select dblink_eval(v_conn, format(
      'insert into public.leads (owner_id, name, status) values (%L::uuid, %L, %L) returning id',
      v_owner::text, 'Lead de concorrência de cliente', 'novo'
    )) into v_result;
    v_lead_id := v_result::uuid;
    v_base_payload := jsonb_build_object(
      'client_id', v_client_id, 'total_value', '1000.00', 'contracted_at', v_today
    );

    v_payload := v_base_payload || jsonb_build_object('creation_key', gen_random_uuid(), 'service', 'Contrato de pagamento');
    select dblink_eval(v_conn, 'select public.create_contract(' || quote_literal(v_payload::text) || '::jsonb)') into v_result;
    v_payment_contract_id := (v_result::jsonb ->> 'id')::uuid;
    v_payload := v_base_payload || jsonb_build_object('creation_key', gen_random_uuid(), 'service', 'Contrato de ajuste');
    select dblink_eval(v_conn, 'select public.create_contract(' || quote_literal(v_payload::text) || '::jsonb)') into v_result;
    v_adjust_contract_id := (v_result::jsonb ->> 'id')::uuid;
    v_payload := v_base_payload || jsonb_build_object('creation_key', gen_random_uuid(), 'service', 'Contrato de pagamento e ajuste');
    select dblink_eval(v_conn, 'select public.create_contract(' || quote_literal(v_payload::text) || '::jsonb)') into v_result;
    v_adjust_payment_contract_id := (v_result::jsonb ->> 'id')::uuid;

    v_payload := v_base_payload || jsonb_build_object('creation_key', gen_random_uuid(), 'service', 'Contrato do probe create_project');
    select dblink_eval(v_conn, 'select public.create_contract(' || quote_literal(v_payload::text) || '::jsonb)') into v_result;
    v_create_project_contract_id := (v_result::jsonb ->> 'id')::uuid;
    v_payload := v_base_payload || jsonb_build_object('creation_key', gen_random_uuid(), 'service', 'Contrato do probe update_project');
    select dblink_eval(v_conn, 'select public.create_contract(' || quote_literal(v_payload::text) || '::jsonb)') into v_result;
    v_update_project_contract_id := (v_result::jsonb ->> 'id')::uuid;
    v_payload := v_base_payload || jsonb_build_object('creation_key', gen_random_uuid(), 'service', 'Contrato do probe set_project_status');
    select dblink_eval(v_conn, 'select public.create_contract(' || quote_literal(v_payload::text) || '::jsonb)') into v_result;
    v_status_contract_id := (v_result::jsonb ->> 'id')::uuid;

    v_payload := jsonb_build_object(
      'client_id', v_client_id, 'contract_id', v_adjust_contract_id,
      'name', 'Projeto sob ajuste', 'service', 'Site', 'contracted_value', '100.00',
      'description', null, 'start_date', v_today, 'due_date', v_today + 7,
      'responsible_name', null, 'priority', 'medium'
    );
    select dblink_eval(v_conn, 'select public.create_project(' || quote_literal(v_payload::text) || '::jsonb)') into v_result;
    v_project := v_result::jsonb;
    v_adjust_project_id := (v_project ->> 'id')::uuid;

    v_payload := jsonb_build_object(
      'client_id', v_client_id, 'contract_id', v_update_project_contract_id,
      'name', 'Projeto editável sob lock', 'service', 'Site', 'contracted_value', '100.00',
      'description', null, 'start_date', v_today, 'due_date', v_today + 7,
      'responsible_name', null, 'priority', 'medium'
    );
    select dblink_eval(v_conn, 'select public.create_project(' || quote_literal(v_payload::text) || '::jsonb)') into v_result;
    v_project := v_result::jsonb;
    v_update_project_id := (v_project ->> 'id')::uuid;

    v_payload := jsonb_build_object(
      'client_id', v_client_id, 'contract_id', v_status_contract_id,
      'name', 'Projeto de status sob lock', 'service', 'Site', 'contracted_value', '100.00',
      'description', null, 'start_date', v_today, 'due_date', v_today + 7,
      'responsible_name', null, 'priority', 'medium'
    );
    select dblink_eval(v_conn, 'select public.create_project(' || quote_literal(v_payload::text) || '::jsonb)') into v_result;
    v_project := v_result::jsonb;
    v_status_project_id := (v_project ->> 'id')::uuid;

    v_payload := jsonb_build_array(
      jsonb_build_object('amount', '600.00', 'due_date', v_today + 7, 'notes', null),
      jsonb_build_object('amount', '400.00', 'due_date', v_today + 30, 'notes', null)
    );
    perform dblink_exec(v_conn, 'select public.replace_contract_installments('
      || quote_literal(v_contract_id::text) || '::uuid, ' || quote_literal(v_payload::text) || '::jsonb)');
    select dblink_eval(v_conn, 'select id from public.contract_installments where contract_id = '
      || quote_literal(v_contract_id::text) || '::uuid order by position limit 1') into v_result;
    v_installment_id := v_result::uuid;

    v_cleanup_sql := format($cleanup$
      begin;
      delete from public.financial_payment_allocations a
        using public.financial_payments p, public.contracts c
        where a.payment_id = p.id and p.contract_id = c.id and c.client_id = %1$L::uuid;
      delete from public.financial_payments p
        using public.contracts c
        where p.contract_id = c.id and c.client_id = %1$L::uuid;
      delete from public.client_activities where client_id = %1$L::uuid;
      delete from public.project_revisions where project_id in (select id from public.projects where client_id = %1$L::uuid);
      delete from public.project_tasks where project_id in (select id from public.projects where client_id = %1$L::uuid);
      delete from public.projects where client_id = %1$L::uuid;
      delete from public.leads where id = %2$L::uuid;
      delete from public.contract_installments i
        using public.contracts c
        where i.contract_id = c.id and c.client_id = %1$L::uuid;
      delete from public.contracts where client_id = %1$L::uuid;
      delete from public.clients where id = %1$L::uuid;
      commit;
    $cleanup$, v_client_id::text, v_lead_id::text);
    perform dblink_exec(v_conn, 'commit');
    v_setup_committed := true;

    -- Uma transação remota mantém todos os locks conflitantes até o fim dos probes.
    perform dblink_exec(v_conn, 'begin');
    perform dblink_exec(v_conn, 'set local role authenticated');
    perform dblink_exec(v_conn, format('select set_config(''request.jwt.claim.sub'', %L, true)', v_owner::text));
    v_payload := jsonb_build_object(
      'creation_key', gen_random_uuid(), 'name', 'Cliente que mantém a advisory',
      'service', 'Site', 'total_value', '100.00', 'contracted_at', v_today
    );
    perform dblink_exec(v_conn, 'select public.create_client(' || quote_literal(v_payload::text) || '::jsonb)');
    v_payload := v_base_payload || jsonb_build_object('creation_key', v_creation_key, 'service', 'Contrato idempotente');
    select dblink_eval(v_conn, 'select public.create_contract(' || quote_literal(v_payload::text) || '::jsonb)') into v_result;
    v_created := v_result::jsonb;
    v_created_contract_id := (v_created ->> 'id')::uuid;

    v_payload := jsonb_build_object(
      'contract_id', v_payment_contract_id, 'idempotency_key', v_payment_key,
      'type', 'receipt', 'amount', '100.00', 'received_at', now(),
      'payment_method', 'pix', 'notes', 'Primeiro payload', 'related_payment_id', null,
      'allocations', '[]'::jsonb
    );
    select dblink_eval(v_conn, 'select public.record_payment(' || quote_literal(v_payload::text) || '::jsonb)') into v_result;
    v_payment := v_result::jsonb;
    v_payload := jsonb_build_array(
      jsonb_build_object('amount', '600.00', 'due_date', v_today + 7, 'notes', null),
      jsonb_build_object('amount', '400.00', 'due_date', v_today + 30, 'notes', null)
    );
    perform dblink_exec(v_conn, 'select public.replace_contract_installments('
      || quote_literal(v_contract_id::text) || '::uuid, ' || quote_literal(v_payload::text) || '::jsonb)');
    perform dblink_exec(v_conn, format('select public.adjust_contract(%L::uuid, 900.00)', v_adjust_contract_id::text));

    -- Cada RPC de projeto mantém a advisory do seu contrato na transação remota.
    v_payload := jsonb_build_object(
      'client_id', v_client_id, 'contract_id', v_create_project_contract_id,
      'name', 'Projeto criado sob lock', 'service', 'Site', 'contracted_value', '100.00',
      'description', null, 'start_date', v_today, 'due_date', v_today + 7,
      'responsible_name', null, 'priority', 'medium'
    );
    perform dblink_exec(v_conn, 'select public.create_project(' || quote_literal(v_payload::text) || '::jsonb)');
    v_payload := jsonb_build_object(
      'name', 'Projeto atualizado sob lock', 'service', 'Consultoria', 'contracted_value', '100.00',
      'description', null, 'start_date', v_today, 'due_date', v_today + 7,
      'responsible_name', null, 'priority', 'high'
    );
    perform dblink_exec(v_conn, 'select public.update_project('
      || quote_literal(v_update_project_id::text) || '::uuid, '
      || quote_literal(v_payload::text) || '::jsonb)');
    perform dblink_exec(v_conn, format(
      'select public.set_project_status(%L::uuid, ''cancelled'')', v_status_project_id::text
    ));

    v_payload := jsonb_build_object(
      'contract_id', v_adjust_payment_contract_id, 'idempotency_key', gen_random_uuid(),
      'type', 'receipt', 'amount', '100.00', 'received_at', now(),
      'payment_method', 'pix', 'notes', null, 'related_payment_id', null,
      'allocations', '[]'::jsonb
    );
    perform dblink_exec(v_conn, 'select public.record_payment(' || quote_literal(v_payload::text) || '::jsonb)');

    perform set_config('request.jwt.claim.sub', v_owner::text, true);
    set local role authenticated;
    set local lock_timeout = '1s';

    begin
      perform public.create_client(jsonb_build_object(
        'creation_key', gen_random_uuid(), 'name', 'Probe de create_client',
        'service', 'Site', 'total_value', '100.00', 'contracted_at', v_today
      ));
      raise exception 'create_client ignorou a advisory :clients.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '55P03' then raise; end if;
    end;

    begin
      perform public.update_client(v_client_id, jsonb_build_object(
        'contract_id', v_contract_id, 'name', 'Probe de update_client',
        'service', 'Site', 'total_value', '1000.00', 'contracted_at', v_today
      ));
      raise exception 'update_client ignorou a advisory :clients.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '55P03' then raise; end if;
    end;

    begin
      perform public.archive_client(v_client_id);
      raise exception 'archive_client ignorou a advisory :clients.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '55P03' then raise; end if;
    end;

    begin
      perform public.convert_lead_to_client(v_lead_id, 'Site', 100.00, v_today);
      raise exception 'convert_lead_to_client ignorou a advisory :clients.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '55P03' then raise; end if;
    end;

    begin
      perform public.create_contract(v_base_payload || jsonb_build_object(
        'creation_key', v_creation_key, 'service', 'Payload concorrente', 'total_value', '2000.00'
      ));
      raise exception 'create_contract com a mesma creation_key não serializou.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '55P03' then raise; end if;
    end;

    begin
      perform public.record_payment(jsonb_build_object(
        'contract_id', v_payment_contract_id, 'idempotency_key', v_payment_key,
        'type', 'receipt', 'amount', '200.00', 'received_at', now(),
        'payment_method', 'cartao', 'notes', 'Segundo payload', 'related_payment_id', null,
        'allocations', '[]'::jsonb
      ));
      raise exception 'record_payment com a mesma idempotency_key não serializou.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '55P03' then raise; end if;
    end;

    begin
      perform public.record_payment(jsonb_build_object(
        'contract_id', v_contract_id, 'idempotency_key', gen_random_uuid(),
        'type', 'receipt', 'amount', '100.00', 'received_at', now(),
        'payment_method', 'pix', 'notes', null, 'related_payment_id', null,
        'allocations', jsonb_build_array(jsonb_build_object('installment_id', v_installment_id, 'amount', '100.00'))
      ));
      raise exception 'record_payment ignorou o lock de replace_contract_installments.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '55P03' then raise; end if;
    end;

    begin
      perform public.replace_contract_installments(v_payment_contract_id, jsonb_build_array(
        jsonb_build_object('amount', '1000.00', 'due_date', v_today + 30, 'notes', null)
      ));
      raise exception 'replace_contract_installments ignorou o lock de record_payment.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '55P03' then raise; end if;
    end;

    begin
      perform public.record_payment(jsonb_build_object(
        'contract_id', v_adjust_contract_id, 'idempotency_key', gen_random_uuid(),
        'type', 'receipt', 'amount', '100.00', 'received_at', now(),
        'payment_method', 'pix', 'notes', null, 'related_payment_id', null,
        'allocations', '[]'::jsonb
      ));
      raise exception 'record_payment ignorou o lock de adjust_contract.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '55P03' then raise; end if;
    end;

    begin
      perform public.adjust_contract(v_adjust_payment_contract_id, 900.00);
      raise exception 'adjust_contract ignorou o lock de record_payment.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '55P03' then raise; end if;
    end;

    -- Probes bidirecionais: 55P03 é o resultado esperado; 40P01 é falha.
    begin
      perform public.create_project(jsonb_build_object(
        'client_id', v_client_id, 'contract_id', v_adjust_contract_id,
        'name', 'Probe create_project sob adjust_contract', 'service', 'Site',
        'contracted_value', '100.00', 'description', null,
        'start_date', v_today, 'due_date', v_today + 7,
        'responsible_name', null, 'priority', 'medium'
      ));
      raise exception 'create_project ignorou a advisory de adjust_contract.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '55P03' then raise; end if;
    end;

    begin
      perform public.adjust_contract(v_create_project_contract_id, 900.00);
      raise exception 'adjust_contract ignorou a advisory de create_project.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '55P03' then raise; end if;
    end;

    begin
      perform public.update_project(v_adjust_project_id, jsonb_build_object(
        'name', 'Probe update_project sob adjust_contract', 'service', 'Site',
        'contracted_value', '100.00', 'description', null,
        'start_date', v_today, 'due_date', v_today + 7,
        'responsible_name', null, 'priority', 'medium'
      ));
      raise exception 'update_project ignorou a advisory de adjust_contract.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '55P03' then raise; end if;
    end;

    begin
      perform public.adjust_contract(v_update_project_contract_id, 900.00);
      raise exception 'adjust_contract ignorou a advisory de update_project.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '55P03' then raise; end if;
    end;

    begin
      perform public.set_project_status(v_adjust_project_id, 'cancelled');
      raise exception 'set_project_status ignorou a advisory de adjust_contract.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '55P03' then raise; end if;
    end;

    begin
      perform public.adjust_contract(v_status_contract_id, 900.00);
      raise exception 'adjust_contract ignorou a advisory de set_project_status.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '55P03' then raise; end if;
    end;

    reset role;
    set local lock_timeout = 0;

    -- Repetições na sessão vencedora devem devolver o mesmo registro, sem duplicar evento.
    v_payload := v_base_payload || jsonb_build_object('creation_key', v_creation_key, 'service', 'Payload repetido');
    select dblink_eval(v_conn, 'select public.create_contract(' || quote_literal(v_payload::text) || '::jsonb)') into v_result;
    v_repeat := v_result::jsonb;
    if (v_repeat ->> 'id') is distinct from (v_created ->> 'id')
      or (v_repeat ->> 'service') is distinct from (v_created ->> 'service') then
      raise exception 'create_contract não preservou o vencedor da mesma creation_key.';
    end if;
    v_payload := jsonb_build_object(
      'contract_id', v_payment_contract_id, 'idempotency_key', v_payment_key,
      'type', 'receipt', 'amount', '200.00', 'received_at', now(),
      'payment_method', 'cartao', 'notes', 'Payload repetido', 'related_payment_id', null,
      'allocations', '[]'::jsonb
    );
    select dblink_eval(v_conn, 'select public.record_payment(' || quote_literal(v_payload::text) || '::jsonb)') into v_result;
    v_payment_repeat := v_result::jsonb;
    if (v_payment_repeat ->> 'id') is distinct from (v_payment ->> 'id')
      or (v_payment_repeat ->> 'already_existed') is distinct from 'true'
      or (v_payment_repeat ->> 'amount') is distinct from (v_payment ->> 'amount') then
      raise exception 'record_payment não preservou o vencedor da mesma idempotency_key.';
    end if;
    select dblink_eval(v_conn, format(
      'select count(*) from public.financial_payments where contract_id = %L::uuid and idempotency_key = %L::uuid',
      v_payment_contract_id::text, v_payment_key::text
    )) into v_result;
    if v_result <> '1' then raise exception 'Pagamento duplicado na sessão vencedora.'; end if;
    select dblink_eval(v_conn, format(
      'select count(*) from public.client_activities where contract_id = %L::uuid and metadata ->> ''payment_id'' = %L',
      v_payment_contract_id::text, (v_payment ->> 'id')
    )) into v_result;
    if v_result <> '1' then raise exception 'Evento financeiro duplicado na sessão vencedora.'; end if;

    -- Encerra a transação anterior e isola uma única advisory :contract:<id>.
    -- Não há :clients nem lock de linha nesta sessão remota.
    perform dblink_exec(v_conn, 'rollback');
    perform dblink_exec(v_conn, 'begin');
    perform dblink_exec(v_conn, 'set local role authenticated');
    perform dblink_exec(v_conn, format('select set_config(''request.jwt.claim.sub'', %L, true)', v_owner::text));
    perform dblink_exec(v_conn, 'select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('
      || quote_literal(v_owner::text || ':contract:' || v_contract_id::text) || ', 0))');
    select dblink_eval(v_conn, 'select count(*) from pg_catalog.pg_locks'
      || ' where pid = pg_catalog.pg_backend_pid() and locktype = ''advisory'' and granted') into v_result;
    if v_result <> '1' then
      raise exception 'O probe isolado de update_client mantém advisories além de :contract:<id>.';
    end if;

    perform set_config('request.jwt.claim.sub', v_owner::text, true);
    set local role authenticated;
    set local lock_timeout = '1s';
    begin
      perform public.update_client(v_client_id, jsonb_build_object(
        'contract_id', v_contract_id, 'name', 'Probe isolado de update_client',
        'service', 'Site', 'total_value', '1000.00', 'contracted_at', v_today
      ));
      raise exception 'update_client ignorou a advisory isolada :contract:<id>.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '55P03' then raise; end if;
    end;
    reset role;
    set local lock_timeout = 0;
    perform dblink_exec(v_conn, 'rollback');
  exception when others then
    if v_conn = any(dblink_get_connections()) then
      begin
        perform dblink_exec(v_conn, 'rollback');
      exception when others then
        raise notice 'Falha no rollback dblink: %', sqlerrm;
      end;
      if v_setup_committed and v_cleanup_sql is not null then
        begin
          perform dblink_exec(v_conn, v_cleanup_sql);
        exception when others then
          raise notice 'Falha no cleanup dblink: %', sqlerrm;
        end;
      end if;
      begin
        perform dblink_disconnect(v_conn);
      exception when others then
        raise notice 'Falha no disconnect dblink: %', sqlerrm;
      end;
    end if;
    raise;
  end;

  if v_conn = any(dblink_get_connections()) then
    begin
      perform dblink_exec(v_conn, 'rollback');
    exception when others then
      raise notice 'Falha no rollback dblink: %', sqlerrm;
    end;
    if v_setup_committed and v_cleanup_sql is not null then
      begin
        perform dblink_exec(v_conn, v_cleanup_sql);
      exception when others then
        raise notice 'Falha no cleanup dblink: %', sqlerrm;
      end;
    end if;
    begin
      perform dblink_disconnect(v_conn);
    exception when others then
      raise notice 'Falha no disconnect dblink: %', sqlerrm;
    end;
  end if;
  raise notice 'Concorrência de clientes, update_client, creation_key, idempotency_key, locks cliente/contrato/parcela/pagamento e ajuste/projetos aprovada.';
end
$$;
```

- [ ] **Etapa 6: Criar commit**

```bash
git add supabase/migrations/0008_etapa3_finance.sql supabase/tests/etapa3_finance.sql
git commit -m "feat: adicionar recebimentos e estornos idempotentes"
```

---

### Tarefa 6: Implementar despesas e categorias

**Arquivos:**
- Modificar: `supabase/migrations/0008_etapa3_finance.sql`
- Modificar: `supabase/tests/etapa3_finance.sql`

**Interfaces:**
- Produz: `create_expense_category(text)`, `archive_expense_category(uuid)`, `create_expense(jsonb)`, `update_expense(uuid,jsonb)`, `pay_expense(uuid,jsonb)` e `cancel_expense(uuid)`.
- Produz internamente: `resolve_expense_client_id(uuid,uuid,uuid)`, sem grant para clientes.
- Consome: `projects` e `set_project_status` do Plano 2 para o harness de locks entre projeto e despesa vinculada.

- [ ] **Etapa 1: Estender o teste SQL antes de `rollback;`**

```sql
do $$
declare
  v_owner uuid;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_client jsonb;
  v_other_client jsonb;
  v_contract_id uuid;
  v_other_contract_id uuid;
  v_project_id uuid;
  v_category jsonb;
  v_category_repeat jsonb;
  v_expense jsonb;
  v_linked_expense jsonb;
  v_pending_expense jsonb;
  v_paid jsonb;
  v_unlinked_paid jsonb;
  v_unlinked_offset jsonb;
  v_unlinked_cancelled jsonb;
  v_events int;
  v_state text;
begin
  select id into v_owner from auth.users order by created_at limit 1;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_client := public.create_client(jsonb_build_object(
    'creation_key', gen_random_uuid(),
    'name', 'Cliente de despesas',
    'service', 'Site',
    'total_value', '1000.00',
    'contracted_at', v_today
  ));
  v_contract_id := ((v_client ->> 'contract')::jsonb ->> 'id')::uuid;
  v_other_client := public.create_client(jsonb_build_object(
    'creation_key', gen_random_uuid(),
    'name', 'Outro cliente de despesas',
    'service', 'Site',
    'total_value', '1000.00',
    'contracted_at', v_today
  ));
  v_other_contract_id := ((v_other_client ->> 'contract')::jsonb ->> 'id')::uuid;
  v_project_id := (public.create_project(jsonb_build_object(
    'client_id', (v_client ->> 'client')::jsonb ->> 'id',
    'contract_id', v_contract_id,
    'name', 'Projeto da despesa',
    'service', 'Site',
    'contracted_value', '1000.00',
    'description', null,
    'start_date', v_today,
    'due_date', v_today + 7,
    'responsible_name', null,
    'priority', 'medium'
  )) ->> 'id')::uuid;

  v_category := public.create_expense_category('Hospedagem');
  v_category_repeat := public.create_expense_category('  hospedagem  ');
  if (v_category ->> 'id') is distinct from (v_category_repeat ->> 'id') then
    raise exception 'Categoria duplicada foi criada.';
  end if;

  v_expense := public.create_expense(jsonb_build_object(
    'description', 'Hospedagem do site',
    'category_id', (v_category ->> 'id')::uuid,
    'amount', '120.00',
    'expense_date', v_today,
    'due_date', v_today + 5,
    'project_id', null,
    'contract_id', null,
    'notes', null
  ));
  select count(*) into v_events
    from public.client_activities
    where metadata ->> 'expense_id' = v_expense ->> 'id';
  if v_events <> 0 then raise exception 'Despesa sem vínculo criou atividade.'; end if;

  v_linked_expense := public.create_expense(jsonb_build_object(
    'description', 'Despesa vinculada',
    'category_id', (v_category ->> 'id')::uuid,
    'amount', '100.00',
    'expense_date', v_today,
    'due_date', v_today + 5,
    'project_id', v_project_id,
    'contract_id', v_contract_id,
    'notes', null
  ));
  select count(*) into v_events
    from public.client_activities
    where metadata ->> 'expense_id' = v_linked_expense ->> 'id';
  if v_events <> 1 then raise exception 'Despesa vinculada não registrou atividade.'; end if;

  begin
    perform public.create_expense(jsonb_build_object(
      'description', 'Vínculos incompatíveis',
      'amount', '10.00',
      'expense_date', v_today,
      'project_id', v_project_id,
      'contract_id', v_other_contract_id
    ));
    raise exception 'Projeto e contrato de clientes diferentes foram aceitos.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '22023' or sqlerrm <> 'Projeto e contrato pertencem a clientes diferentes.' then
      raise;
    end if;
  end;

  v_paid := public.pay_expense((v_linked_expense ->> 'id')::uuid, jsonb_build_object(
    'paid_at', now(),
    'payment_method', 'pix'
  ));
  if (v_paid ->> 'status') <> 'paid' or (v_paid ->> 'paid_at') is null then
    raise exception 'Despesa não foi marcada como paga.';
  end if;
  v_paid := public.update_expense((v_linked_expense ->> 'id')::uuid, jsonb_build_object(
    'notes', 'Nota complementar'
  ));
  if (v_paid ->> 'notes') <> 'Nota complementar' then raise exception 'Nota da despesa paga não foi salva.'; end if;
  v_paid := public.update_expense((v_linked_expense ->> 'id')::uuid, '{}'::jsonb);
  if (v_paid ->> 'notes') <> 'Nota complementar' then
    raise exception 'update_expense({}) apagou notas de despesa paga.';
  end if;

  begin
    perform public.update_expense((v_linked_expense ->> 'id')::uuid, jsonb_build_object(
      'description', 'Alterar paga',
      'category_id', (v_category ->> 'id')::uuid,
      'amount', '999.00',
      'expense_date', v_today,
      'due_date', v_today + 5,
      'project_id', v_project_id,
      'contract_id', v_contract_id,
      'notes', 'Alteração indevida'
    ));
    raise exception 'Despesa paga foi alterada.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '23514' or sqlerrm <> 'Despesa paga ou cancelada só permite atualizar notas.' then
      raise;
    end if;
  end;

  v_pending_expense := public.create_expense(jsonb_build_object(
    'description', 'Despesa pendente vinculada',
    'category_id', (v_category ->> 'id')::uuid,
    'amount', '100.00',
    'expense_date', v_today,
    'due_date', v_today + 5,
    'project_id', v_project_id,
    'contract_id', v_contract_id,
    'notes', null
  ));
  select count(*) into v_events
    from public.client_activities
    where metadata ->> 'expense_id' = v_pending_expense ->> 'id';
  perform public.update_expense((v_pending_expense ->> 'id')::uuid, jsonb_build_object(
    'description', 'Despesa pendente vinculada',
    'category_id', (v_category ->> 'id')::uuid,
    'amount', '150.00',
    'expense_date', v_today + 1,
    'due_date', v_today + 6,
    'project_id', v_project_id,
    'contract_id', v_contract_id,
    'notes', null
  ));
  select count(*) into v_events
    from public.client_activities
    where metadata ->> 'expense_id' = v_pending_expense ->> 'id';
  if v_events <> 2 then raise exception 'Alteração financeira da despesa não registrou evento.'; end if;

  perform public.archive_expense_category((v_category ->> 'id')::uuid);
  begin
    perform public.create_expense(jsonb_build_object(
      'description', 'Despesa com categoria arquivada',
      'category_id', (v_category ->> 'id')::uuid,
      'amount', '10.00',
      'expense_date', v_today
    ));
    raise exception 'Categoria arquivada foi aceita na criação.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '42501' or sqlerrm <> 'Categoria inválida ou arquivada.' then
      raise;
    end if;
  end;
  begin
    perform public.update_expense((v_pending_expense ->> 'id')::uuid, jsonb_build_object(
      'description', 'Despesa pendente vinculada',
      'category_id', (v_category ->> 'id')::uuid,
      'amount', '150.00',
      'expense_date', v_today + 1,
      'due_date', v_today + 6,
      'project_id', v_project_id,
      'contract_id', v_contract_id,
      'notes', null
    ));
    raise exception 'Categoria arquivada foi aceita na edição.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '42501' or sqlerrm <> 'Categoria inválida ou arquivada.' then
      raise;
    end if;
  end;

  v_unlinked_paid := public.create_expense(jsonb_build_object(
    'description', 'Despesa paga sem cliente',
    'amount', '20.00',
    'expense_date', v_today,
    'due_date', v_today + 1,
    'notes', null
  ));
  set local timezone = 'Pacific/Kiritimati';
  perform public.pay_expense((v_unlinked_paid ->> 'id')::uuid, jsonb_build_object(
    'paid_at', v_today::text,
    'payment_method', 'pix'
  ));
  if (select (paid_at at time zone 'America/Sao_Paulo')::date
      from public.financial_expenses where id = (v_unlinked_paid ->> 'id')::uuid) <> v_today
    or (select (paid_at at time zone 'America/Sao_Paulo')::time
      from public.financial_expenses where id = (v_unlinked_paid ->> 'id')::uuid) <> '00:00:00'::time then
    raise exception 'paid_at sem offset não foi normalizado em America/Sao_Paulo.';
  end if;

  set local timezone = 'UTC';
  v_unlinked_offset := public.create_expense(jsonb_build_object(
    'description', 'Despesa paga com offset',
    'amount', '25.00',
    'expense_date', v_today,
    'due_date', v_today + 1,
    'notes', null
  ));
  perform public.pay_expense((v_unlinked_offset ->> 'id')::uuid, jsonb_build_object(
    'paid_at', v_today::text || 'T12:00:00-03:00',
    'payment_method', 'pix'
  ));
  if (select paid_at from public.financial_expenses where id = (v_unlinked_offset ->> 'id')::uuid)
      <> (v_today::text || 'T15:00:00Z')::timestamptz then
    raise exception 'paid_at com ISO offset foi reinterpretado no fuso da sessão.';
  end if;

  v_unlinked_cancelled := public.create_expense(jsonb_build_object(
    'description', 'Despesa cancelada sem cliente',
    'amount', '30.00',
    'expense_date', v_today,
    'due_date', v_today + 1,
    'notes', null
  ));
  perform public.cancel_expense((v_unlinked_cancelled ->> 'id')::uuid);
  perform public.update_expense((v_unlinked_cancelled ->> 'id')::uuid, jsonb_build_object(
    'notes', 'Cancelada com observação'
  ));
  v_unlinked_cancelled := public.update_expense(
    (v_unlinked_cancelled ->> 'id')::uuid, '{}'::jsonb
  );
  if (v_unlinked_cancelled ->> 'notes') <> 'Cancelada com observação' then
    raise exception 'update_expense({}) apagou notas de despesa cancelada.';
  end if;
  if (select count(*) from public.client_activities
      where metadata ->> 'expense_id' in (
        v_unlinked_paid ->> 'id', v_unlinked_offset ->> 'id', v_unlinked_cancelled ->> 'id'
      )) <> 0 then
    raise exception 'Despesa sem vínculo registrou atividade ao pagar/cancelar.';
  end if;

  begin
    perform public.cancel_expense((v_linked_expense ->> 'id')::uuid);
    raise exception 'Despesa paga foi cancelada.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '23514' or sqlerrm <> 'Somente despesas pendentes podem ser canceladas.' then
      raise;
    end if;
  end;

  raise notice 'Contrato SQL de despesas e categorias aprovado.';
end
$$;
```

- [ ] **Etapa 2: Confirmar o vermelho**

Esperado: `public.create_expense_category(text)` não existe.

- [ ] **Etapa 3: Inserir as RPCs de despesa antes de `commit;`**

```sql
create or replace function public.resolve_expense_client_id(
  p_owner uuid,
  p_project_id uuid,
  p_contract_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_contract_client uuid;
  v_project_client uuid;
begin
  -- Helper de leitura: não adquirir locks de projeto/contrato. Os vínculos client_id e
  -- contract_id de projeto são imutáveis nas RPCs do Plano 2; travar aqui inverteria
  -- a ordem projeto→contrato e poderia morrer contra update_project/set_project_status.
  if p_contract_id is not null then
    select c.client_id into v_contract_client
      from public.contracts c
      where c.id = p_contract_id and c.owner_id = p_owner;
    if not found then raise exception 'Contrato inválido.' using errcode = '42501'; end if;
  end if;
  if p_project_id is not null then
    select p.client_id into v_project_client
      from public.projects p
      where p.id = p_project_id and p.owner_id = p_owner;
    if not found then raise exception 'Projeto inválido.' using errcode = '42501'; end if;
  end if;
  if v_contract_client is not null and v_project_client is not null
    and v_contract_client is distinct from v_project_client then
    raise exception 'Projeto e contrato pertencem a clientes diferentes.' using errcode = '22023';
  end if;
  return coalesce(v_project_client, v_contract_client);
end;
$$;

create or replace function public.create_expense_category(p_name text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_category public.expense_categories;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  if nullif(pg_catalog.btrim(p_name), '') is null then
    raise exception 'Informe o nome da categoria.' using errcode = '22023';
  end if;
  insert into public.expense_categories (owner_id, name)
    values (v_owner, pg_catalog.btrim(p_name))
    on conflict do nothing
    returning * into v_category;
  if not found then
    select * into v_category
      from public.expense_categories
      where owner_id = v_owner and lower(name) = lower(pg_catalog.btrim(p_name));
  end if;
  return to_jsonb(v_category);
end;
$$;

create or replace function public.archive_expense_category(p_category_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_category public.expense_categories;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  select * into v_category
    from public.expense_categories
    where id = p_category_id and owner_id = v_owner
    for update;
  if not found then raise exception 'Categoria não encontrada ou acesso negado.' using errcode = '42501'; end if;
  update public.expense_categories
    set archived_at = now()
    where id = p_category_id and owner_id = v_owner
    returning * into v_category;
  return to_jsonb(v_category);
end;
$$;

create or replace function public.create_expense(p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_expense public.financial_expenses;
  v_amount numeric;
  v_amount_text text;
  v_category uuid;
  v_project uuid;
  v_contract uuid;
  v_client_id uuid;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Dados da despesa inválidos.' using errcode = '22023';
  end if;
  v_amount_text := nullif(pg_catalog.btrim(p_payload ->> 'amount'), '');
  v_category := nullif(p_payload ->> 'category_id', '')::uuid;
  v_project := nullif(p_payload ->> 'project_id', '')::uuid;
  v_contract := nullif(p_payload ->> 'contract_id', '')::uuid;
  if nullif(pg_catalog.btrim(p_payload ->> 'description'), '') is null
    or v_amount_text is null or v_amount_text !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$'
    or nullif(p_payload ->> 'expense_date', '') is null then
    raise exception 'Informe descrição, valor e data da despesa.' using errcode = '22023';
  end if;
  v_amount := v_amount_text::numeric(14,2);
  if v_category is not null then
    perform c.id from public.expense_categories c
      where c.id = v_category and c.owner_id = v_owner and c.archived_at is null
      for update;
    if not found then raise exception 'Categoria inválida ou arquivada.' using errcode = '42501'; end if;
  end if;
  v_client_id := public.resolve_expense_client_id(v_owner, v_project, v_contract);

  insert into public.financial_expenses (
    owner_id, description, category_id, amount, expense_date, due_date,
    project_id, contract_id, notes
  ) values (
    v_owner, pg_catalog.btrim(p_payload ->> 'description'), v_category, v_amount,
    (p_payload ->> 'expense_date')::date, nullif(p_payload ->> 'due_date', '')::date,
    v_project, v_contract, nullif(p_payload ->> 'notes', '')
  ) returning * into v_expense;

  if v_client_id is not null then
    insert into public.client_activities (
      owner_id, client_id, contract_id, project_id, type, description, metadata
    ) values (
      v_owner, v_client_id, v_contract, v_project, 'financial',
      'Despesa registrada: ' || v_expense.description || '.',
      jsonb_build_object('expense_id', v_expense.id, 'amount', v_amount)
    );
  end if;
  return to_jsonb(v_expense);
end;
$$;

create or replace function public.update_expense(p_expense_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_expense public.financial_expenses;
  v_before jsonb;
  v_amount numeric;
  v_amount_text text;
  v_category uuid;
  v_project uuid;
  v_contract uuid;
  v_client_id uuid;
  v_description text;
  v_expense_date date;
  v_due_date date;
  v_changed boolean;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Dados da despesa inválidos.' using errcode = '22023';
  end if;
  select * into v_expense
    from public.financial_expenses
    where id = p_expense_id and owner_id = v_owner
    for update;
  if not found then raise exception 'Despesa não encontrada ou acesso negado.' using errcode = '42501'; end if;

  if v_expense.status <> 'pending' then
    if exists (select 1 from jsonb_object_keys(p_payload) where key <> 'notes') then
      raise exception 'Despesa paga ou cancelada só permite atualizar notas.' using errcode = '23514';
    end if;
    -- Ausência de notes significa não alterar; somente uma chave notes explícita substitui o valor.
    if p_payload ? 'notes' then
      update public.financial_expenses
        set notes = nullif(p_payload ->> 'notes', '')
        where id = p_expense_id and owner_id = v_owner
        returning * into v_expense;
    end if;
    return to_jsonb(v_expense);
  end if;

  v_amount_text := nullif(pg_catalog.btrim(p_payload ->> 'amount'), '');
  v_category := nullif(p_payload ->> 'category_id', '')::uuid;
  v_project := nullif(p_payload ->> 'project_id', '')::uuid;
  v_contract := nullif(p_payload ->> 'contract_id', '')::uuid;
  v_description := pg_catalog.btrim(p_payload ->> 'description');
  v_expense_date := nullif(p_payload ->> 'expense_date', '')::date;
  v_due_date := nullif(p_payload ->> 'due_date', '')::date;
  if nullif(v_description, '') is null or v_amount_text is null
    or v_amount_text !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' or v_expense_date is null then
    raise exception 'Informe descrição e valor válidos.' using errcode = '22023';
  end if;
  v_amount := v_amount_text::numeric(14,2);
  if v_category is not null then
    perform c.id from public.expense_categories c
      where c.id = v_category and c.owner_id = v_owner and c.archived_at is null
      for update;
    if not found then raise exception 'Categoria inválida ou arquivada.' using errcode = '42501'; end if;
  end if;
  v_client_id := public.resolve_expense_client_id(v_owner, v_project, v_contract);
  v_before := to_jsonb(v_expense);
  v_changed := v_description is distinct from v_expense.description
    or v_category is distinct from v_expense.category_id
    or v_amount is distinct from v_expense.amount
    or v_expense_date is distinct from v_expense.expense_date
    or v_due_date is distinct from v_expense.due_date
    or v_project is distinct from v_expense.project_id
    or v_contract is distinct from v_expense.contract_id;

  update public.financial_expenses set
    description = v_description,
    category_id = v_category,
    amount = v_amount,
    expense_date = v_expense_date,
    due_date = v_due_date,
    project_id = v_project,
    contract_id = v_contract,
    notes = nullif(p_payload ->> 'notes', '')
  where id = p_expense_id and owner_id = v_owner
  returning * into v_expense;

  if v_changed and v_client_id is not null then
    insert into public.client_activities (
      owner_id, client_id, contract_id, project_id, type, description, metadata
    ) values (
      v_owner, v_client_id, v_contract, v_project, 'financial',
      'Despesa atualizada: ' || v_expense.description || '.',
      jsonb_build_object(
        'expense_id', v_expense.id,
        'previous_amount', v_before ->> 'amount',
        'amount', v_amount,
        'previous_expense_date', v_before ->> 'expense_date',
        'expense_date', v_expense_date,
        'previous_due_date', v_before ->> 'due_date',
        'due_date', v_due_date,
        'previous_project_id', v_before ->> 'project_id',
        'project_id', v_project,
        'previous_contract_id', v_before ->> 'contract_id',
        'contract_id', v_contract
      )
    );
  end if;
  return to_jsonb(v_expense);
end;
$$;

create or replace function public.pay_expense(p_expense_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_expense public.financial_expenses;
  v_client_id uuid;
  v_paid_at_text text;
  v_paid_at timestamptz;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Dados da baixa inválidos.' using errcode = '22023';
  end if;
  select * into v_expense
    from public.financial_expenses
    where id = p_expense_id and owner_id = v_owner
    for update;
  if not found then raise exception 'Despesa não encontrada ou acesso negado.' using errcode = '42501'; end if;
  if v_expense.status <> 'pending' then
    raise exception 'Somente despesas pendentes podem ser pagas.' using errcode = '23514';
  end if;
  v_paid_at_text := nullif(pg_catalog.btrim(p_payload ->> 'paid_at'), '');
  v_paid_at := case
    when v_paid_at_text is null then now()
    when v_paid_at_text ~* '^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]+)?)?(z|[+-][0-9]{2}(:?[0-9]{2})?)$'
      then v_paid_at_text::timestamptz
    else (v_paid_at_text::timestamp at time zone 'America/Sao_Paulo')
  end;
  v_client_id := public.resolve_expense_client_id(v_owner, v_expense.project_id, v_expense.contract_id);
  update public.financial_expenses set
    status = 'paid',
    paid_at = v_paid_at,
    payment_method = nullif(pg_catalog.btrim(p_payload ->> 'payment_method'), '')
  where id = p_expense_id and owner_id = v_owner
  returning * into v_expense;
  if v_client_id is not null then
    insert into public.client_activities (
      owner_id, client_id, contract_id, project_id, type, description, metadata
    ) values (
      v_owner, v_client_id, v_expense.contract_id, v_expense.project_id, 'financial',
      'Despesa paga: ' || v_expense.description || '.',
      jsonb_build_object('expense_id', v_expense.id, 'amount', v_expense.amount)
    );
  end if;
  return to_jsonb(v_expense);
end;
$$;

create or replace function public.cancel_expense(p_expense_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_expense public.financial_expenses;
  v_client_id uuid;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  select * into v_expense
    from public.financial_expenses
    where id = p_expense_id and owner_id = v_owner
    for update;
  if not found then raise exception 'Despesa não encontrada ou acesso negado.' using errcode = '42501'; end if;
  if v_expense.status <> 'pending' then
    raise exception 'Somente despesas pendentes podem ser canceladas.' using errcode = '23514';
  end if;
  v_client_id := public.resolve_expense_client_id(v_owner, v_expense.project_id, v_expense.contract_id);
  update public.financial_expenses
    set status = 'cancelled', cancelled_at = now()
    where id = p_expense_id and owner_id = v_owner
    returning * into v_expense;
  if v_client_id is not null then
    insert into public.client_activities (
      owner_id, client_id, contract_id, project_id, type, description, metadata
    ) values (
      v_owner, v_client_id, v_expense.contract_id, v_expense.project_id, 'financial',
      'Despesa cancelada: ' || v_expense.description || '.',
      jsonb_build_object('expense_id', v_expense.id, 'amount', v_expense.amount)
    );
  end if;
  return to_jsonb(v_expense);
end;
$$;

revoke all on function public.resolve_expense_client_id(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_expense_category(text) from public, anon, authenticated;
revoke all on function public.archive_expense_category(uuid) from public, anon, authenticated;
revoke all on function public.create_expense(jsonb) from public, anon, authenticated;
revoke all on function public.update_expense(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.pay_expense(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.cancel_expense(uuid) from public, anon, authenticated;
grant execute on function public.create_expense_category(text) to authenticated;
grant execute on function public.archive_expense_category(uuid) to authenticated;
grant execute on function public.create_expense(jsonb) to authenticated;
grant execute on function public.update_expense(uuid, jsonb) to authenticated;
grant execute on function public.pay_expense(uuid, jsonb) to authenticated;
grant execute on function public.cancel_expense(uuid) to authenticated;
```

- [ ] **Etapa 4: Revisar invariantes de despesa**

Comando: `git diff --check`
Esperado: categoria única por proprietário/nome em minúsculas; criação/edição pendente travam a categoria ativa `FOR UPDATE` antes de validar vínculos do proprietário; projeto e contrato devem apontar para o mesmo cliente; `update_expense({})` preserva notas de despesa paga/cancelada e somente uma chave `notes` explícita as altera; `paid_at` sem offset é interpretado em `America/Sao_Paulo` e ISO com offset é preservado; evento financeiro só é gravado com cliente resolvido; o helper não cria locks inversos; o harness prova `create_expense` contra os locks de `set_project_status` e a direção inversa contra os locks FK da despesa, ambas com `55P03`; não existe RPC de exclusão.

- [ ] **Etapa 5: Provar serialização entre `set_project_status` e despesa vinculada**

Execute o bloco abaixo no SQL Editor após as migrations 0001–0008, com `dblink` disponível e ao menos um usuário já commitado em `auth.users`. Assim como no harness anterior, a conexão remota usa o socket local e depende da autenticação configurada no banco. O fixture é commitado para que as duas sessões o vejam; em seguida, locks já confirmados são usados em probes determinísticos com `lock_timeout`. `set_project_status(project_id,status)` adquire `:contract:<id>` antes de travar projeto e contrato; a despesa criada carrega ambos os vínculos. O teste cobre a criação da despesa durante o status, a criação normal após a liberação e a direção inversa contra os locks FK; os dois probes de bloqueio esperam `55P03`, sem loops, `pg_sleep`, `psql` ou comandos meta. Rollback, cleanup e disconnect são tentados individualmente também no caminho normal.

```sql
create extension if not exists dblink;

do $$
declare
  v_conn text := 'finance_project_expense';
  v_owner uuid;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_client_id uuid;
  v_contract_id uuid;
  v_project_id uuid;
  v_payload jsonb;
  v_client jsonb;
  v_project jsonb;
  v_expense jsonb;
  v_result text;
  v_cleanup_sql text;
  v_setup_committed boolean := false;
  v_state text;
begin
  select id into v_owner from auth.users order by created_at, id limit 1;
  if v_owner is null then raise exception 'Crie ao menos um usuário autenticado antes do teste.'; end if;
  perform dblink_connect(v_conn, format('dbname=%L user=%L', current_database(), current_user));

  begin
    perform dblink_exec(v_conn, 'begin');
    perform dblink_exec(v_conn, 'set local role authenticated');
    perform dblink_exec(v_conn, format('select set_config(''request.jwt.claim.sub'', %L, true)', v_owner::text));
    v_payload := jsonb_build_object(
      'creation_key', gen_random_uuid(), 'name', 'Fixture de lock projeto/despesa',
      'service', 'Site', 'total_value', '1000.00', 'contracted_at', v_today
    );
    select dblink_eval(v_conn, 'select public.create_client(' || quote_literal(v_payload::text) || '::jsonb)') into v_result;
    v_client := v_result::jsonb;
    v_client_id := ((v_client ->> 'client')::jsonb ->> 'id')::uuid;
    v_contract_id := ((v_client ->> 'contract')::jsonb ->> 'id')::uuid;
    v_payload := jsonb_build_object(
      'client_id', v_client_id, 'contract_id', v_contract_id,
      'name', 'Projeto do teste de lock', 'service', 'Site', 'contracted_value', '800.00',
      'description', null, 'start_date', v_today, 'due_date', v_today + 7,
      'responsible_name', null, 'priority', 'medium'
    );
    select dblink_eval(v_conn, 'select public.create_project(' || quote_literal(v_payload::text) || '::jsonb)') into v_result;
    v_project := v_result::jsonb;
    v_project_id := (v_project ->> 'id')::uuid;

    v_cleanup_sql := format($cleanup$
      begin;
      delete from public.financial_expenses
        where project_id in (select id from public.projects where client_id = %1$L::uuid)
           or contract_id in (select id from public.contracts where client_id = %1$L::uuid);
      delete from public.project_revisions where project_id in (select id from public.projects where client_id = %1$L::uuid);
      delete from public.project_tasks where project_id in (select id from public.projects where client_id = %1$L::uuid);
      delete from public.client_activities where client_id = %1$L::uuid;
      delete from public.projects where client_id = %1$L::uuid;
      delete from public.contract_installments i
        using public.contracts c
        where i.contract_id = c.id and c.client_id = %1$L::uuid;
      delete from public.contracts where client_id = %1$L::uuid;
      delete from public.clients where id = %1$L::uuid;
      commit;
    $cleanup$, v_client_id::text);
    perform dblink_exec(v_conn, 'commit');
    v_setup_committed := true;

    -- Cancelamento segue a ordem advisory :contract:<id> → projeto → contrato.
    perform dblink_exec(v_conn, 'begin');
    perform dblink_exec(v_conn, 'set local role authenticated');
    perform dblink_exec(v_conn, format('select set_config(''request.jwt.claim.sub'', %L, true)', v_owner::text));
    perform dblink_exec(v_conn, format(
      'select public.set_project_status(%L::uuid, ''cancelled'')', v_project_id::text
    ));

    perform set_config('request.jwt.claim.sub', v_owner::text, true);
    set local role authenticated;
    set local lock_timeout = '1s';
    begin
      perform public.create_expense(jsonb_build_object(
        'description', 'Despesa durante set_project_status', 'category_id', null,
        'amount', '10.00', 'expense_date', v_today, 'due_date', null,
        'project_id', v_project_id, 'contract_id', v_contract_id, 'notes', null
      ));
      raise exception 'Despesa vinculada ignorou os locks de set_project_status.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '55P03' then raise; end if;
    end;
    reset role;
    set local lock_timeout = 0;

    -- Depois do commit do status, a mesma despesa deve ser criada normalmente.
    perform dblink_exec(v_conn, 'commit');
    perform dblink_exec(v_conn, 'begin');
    perform dblink_exec(v_conn, 'set local role authenticated');
    perform dblink_exec(v_conn, format('select set_config(''request.jwt.claim.sub'', %L, true)', v_owner::text));
    v_payload := jsonb_build_object(
      'description', 'Despesa após set_project_status', 'category_id', null,
      'amount', '10.00', 'expense_date', v_today, 'due_date', null,
      'project_id', v_project_id, 'contract_id', v_contract_id, 'notes', null
    );
    select dblink_eval(v_conn, 'select public.create_expense(' || quote_literal(v_payload::text) || '::jsonb)') into v_result;
    v_expense := v_result::jsonb;
    if (v_expense ->> 'project_id') is distinct from v_project_id::text
      or (v_expense ->> 'contract_id') is distinct from v_contract_id::text then
      raise exception 'Despesa não preservou os dois vínculos após a liberação do status.';
    end if;

    -- A direção inversa também serializa: o INSERT retém KEY SHARE em projeto/contrato.
    perform set_config('request.jwt.claim.sub', v_owner::text, true);
    set local role authenticated;
    set local lock_timeout = '1s';
    begin
      perform public.set_project_status(v_project_id, 'not_started');
      raise exception 'set_project_status ignorou os locks FK da despesa vinculada.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '55P03' then raise; end if;
    end;
    reset role;
    set local lock_timeout = 0;
  exception when others then
    if v_conn = any(dblink_get_connections()) then
      begin
        perform dblink_exec(v_conn, 'rollback');
      exception when others then
        raise notice 'Falha no rollback dblink: %', sqlerrm;
      end;
      if v_setup_committed and v_cleanup_sql is not null then
        begin
          perform dblink_exec(v_conn, v_cleanup_sql);
        exception when others then
          raise notice 'Falha no cleanup dblink: %', sqlerrm;
        end;
      end if;
      begin
        perform dblink_disconnect(v_conn);
      exception when others then
        raise notice 'Falha no disconnect dblink: %', sqlerrm;
      end;
    end if;
    raise;
  end;

  if v_conn = any(dblink_get_connections()) then
    begin
      perform dblink_exec(v_conn, 'rollback');
    exception when others then
      raise notice 'Falha no rollback dblink: %', sqlerrm;
    end;
    if v_setup_committed and v_cleanup_sql is not null then
      begin
        perform dblink_exec(v_conn, v_cleanup_sql);
      exception when others then
        raise notice 'Falha no cleanup dblink: %', sqlerrm;
      end;
    end if;
    begin
      perform dblink_disconnect(v_conn);
    exception when others then
      raise notice 'Falha no disconnect dblink: %', sqlerrm;
    end;
  end if;
  raise notice 'Serialização entre set_project_status e locks FK de despesa vinculada aprovada nas duas direções.';
end
$$;

```

- [ ] **Etapa 6: Criar commit**

```bash
git add supabase/migrations/0008_etapa3_finance.sql supabase/tests/etapa3_finance.sql
git commit -m "feat: adicionar despesas e categorias"
```

### Tarefa 7: Implementar resumo e fluxo de caixa

**Arquivos:**
- Modificar: `supabase/migrations/0008_etapa3_finance.sql`
- Modificar: `supabase/tests/etapa3_finance.sql`

**Interfaces:**
- Produz: `get_financial_summary(date,date) returns jsonb`, `get_cash_flow(date,date,text) returns jsonb` e `get_expense_category_totals(date,date) returns jsonb`.
- Produz internamente: `financial_to_cents(numeric) returns bigint`.
- Consome: datas efetivas em `America/Sao_Paulo`, RLS das tabelas e grants da Tarefa 2.
- Decisão de limite: cada registro aceita até `999999999999.99`; agregações continuam como `number` no TypeScript e são rejeitadas com `22023` quando excedem `Number.MAX_SAFE_INTEGER` em centavos. Não se retorna texto nem se trunca precisão.
- `upcoming` inclui todos os vencimentos futuros, inclusive após 30 dias; o rótulo da UI permanece “Próximos vencimentos”.

- [ ] **Etapa 1: Estender o teste SQL com savepoint, deltas e isolamento**

```sql
do $$
declare
  v_owner uuid;
  v_other uuid;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_client jsonb;
  v_contract_id uuid;
  v_future_contract_id uuid;
  v_expense_id uuid;
  v_paid_at timestamptz;
  v_i integer;
  v_invalid_amount text;
  v_baseline jsonb;
  v_baseline_flow jsonb;
  v_baseline_categories jsonb;
  v_other_baseline jsonb;
  v_other_baseline_flow jsonb;
  v_other_baseline_categories jsonb;
  v_categories jsonb;
  v_summary jsonb;
  v_flow jsonb;
  v_state text;
begin
  select id into v_owner from auth.users where id = '00000000-0000-4000-8000-000000000001';
  select id into v_other from auth.users where id = '00000000-0000-4000-8000-000000000002';
  if v_owner is null or v_other is null then
    raise exception 'Usuários reais da Tarefa 5 não estão disponíveis para o teste de isolamento.';
  end if;
  perform set_config('request.jwt.claim.sub', v_other::text, true);
  set local role authenticated;
  v_other_baseline := public.get_financial_summary(v_today, v_today + 1);
  v_other_baseline_flow := public.get_cash_flow(v_today, v_today + 1, 'day');
  v_other_baseline_categories := public.get_expense_category_totals(v_today, v_today + 1);

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  savepoint aggregation_case;

  v_baseline := public.get_financial_summary(v_today, v_today + 1);
  v_baseline_flow := public.get_cash_flow(v_today, v_today + 1, 'day');
  v_baseline_categories := public.get_expense_category_totals(v_today, v_today + 1);
  v_client := public.create_client(jsonb_build_object(
    'creation_key', gen_random_uuid(),
    'name', 'Cliente do resumo',
    'service', 'Site',
    'total_value', '1000.00',
    'contracted_at', v_today
  ));
  v_contract_id := ((v_client ->> 'contract')::jsonb ->> 'id')::uuid;
  v_future_contract_id := (public.create_contract(jsonb_build_object(
    'creation_key', gen_random_uuid(),
    'client_id', ((v_client ->> 'client')::jsonb ->> 'id'),
    'service', 'Vencimento após 30 dias',
    'total_value', '75.00',
    'contracted_at', v_today,
    'due_date', v_today + 45
  )) ->> 'id')::uuid;
  v_paid_at := (v_today + interval '12 hours') at time zone 'America/Sao_Paulo';
  perform public.record_payment(jsonb_build_object(
    'contract_id', v_contract_id,
    'idempotency_key', gen_random_uuid(),
    'type', 'receipt',
    'amount', '300.00',
    'received_at', v_paid_at,
    'payment_method', 'pix',
    'notes', null,
    'related_payment_id', null,
    'allocations', '[]'::jsonb
  ));
  v_expense_id := (public.create_expense(jsonb_build_object(
    'description', 'Despesa paga do resumo',
    'amount', '120.00',
    'expense_date', v_today,
    'due_date', v_today + 5,
    'notes', null
  )) ->> 'id')::uuid;
  perform public.pay_expense(v_expense_id, jsonb_build_object(
    'paid_at', v_paid_at,
    'payment_method', 'pix'
  ));

  v_summary := public.get_financial_summary(v_today, v_today + 1);
  if ((v_summary ->> 'contracted_cents')::bigint - (v_baseline ->> 'contracted_cents')::bigint) <> 100075
    or ((v_summary ->> 'received_historical_cents')::bigint - (v_baseline ->> 'received_historical_cents')::bigint) <> 30000
    or ((v_summary ->> 'pending_cents')::bigint - (v_baseline ->> 'pending_cents')::bigint) <> 70075
    or ((v_summary ->> 'period_receipts_cents')::bigint - (v_baseline ->> 'period_receipts_cents')::bigint) <> 30000
    or ((v_summary ->> 'period_expenses_cents')::bigint - (v_baseline ->> 'period_expenses_cents')::bigint) <> 12000
    or ((v_summary ->> 'period_profit_cents')::bigint - (v_baseline ->> 'period_profit_cents')::bigint) <> 18000
    or ((v_summary ->> 'overdue_cents')::bigint - (v_baseline ->> 'overdue_cents')::bigint) <> 0 then
    raise exception 'Deltas do resumo financeiro incorretos.';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(v_summary -> 'upcoming') as item(value)
    where value ->> 'contract_id' = v_future_contract_id::text
      and (value ->> 'due_date')::date = v_today + 45
  ) then
    raise exception 'Vencimento após 30 dias foi omitido de upcoming.';
  end if;

  v_flow := public.get_cash_flow(v_today, v_today + 1, 'day');
  if jsonb_array_length(v_flow) <> 1
    or ((v_flow -> 0 ->> 'receipts_cents')::bigint - (v_baseline_flow -> 0 ->> 'receipts_cents')::bigint) <> 30000
    or ((v_flow -> 0 ->> 'expenses_cents')::bigint - (v_baseline_flow -> 0 ->> 'expenses_cents')::bigint) <> 12000
    or ((v_flow -> 0 ->> 'net_cents')::bigint - (v_baseline_flow -> 0 ->> 'net_cents')::bigint) <> 18000
    or ((v_flow -> 0 ->> 'balance_cents')::bigint - (v_baseline_flow -> 0 ->> 'balance_cents')::bigint) <> 18000 then
    raise exception 'Deltas do fluxo de caixa incorretos.';
  end if;

  v_categories := public.get_expense_category_totals(v_today, v_today + 1);
  if coalesce((
    select (value ->> 'amount_cents')::bigint from jsonb_array_elements(v_categories) as item(value)
    where value ->> 'category_id' is null and value ->> 'name' = 'Sem categoria'
  ), 0) - coalesce((
    select (value ->> 'amount_cents')::bigint from jsonb_array_elements(v_baseline_categories) as item(value)
    where value ->> 'category_id' is null and value ->> 'name' = 'Sem categoria'
  ), 0) <> 12000 then
    raise exception 'Deltas das despesas por categoria incorretos.';
  end if;

  begin
    perform public.get_cash_flow(v_today, v_today + 1096, 'day');
    raise exception 'Duração excessiva foi aceita.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '22023' or sqlerrm <> 'O período do fluxo de caixa não pode exceder 1095 dias.' then
      raise;
    end if;
  end;

  begin
    perform public.get_cash_flow(v_today, v_today + 1, 'invalid');
    raise exception 'Agrupamento inválido foi aceito.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '22023' or sqlerrm <> 'Agrupamento inválido.' then
      raise;
    end if;
  end;

  begin
    perform public.get_cash_flow(v_today, v_today + 1, null);
    raise exception 'Bucket NULL foi aceito.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '22023' or sqlerrm <> 'Agrupamento inválido.' then
      raise;
    end if;
  end;

  begin
    perform public.financial_to_cents(0.001);
    raise exception 'Conversão com três casas foi aceita.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '22023' or sqlerrm <> 'Valor financeiro não pode ser convertido em centavos inteiros.' then
      raise;
    end if;
  end;
  if public.financial_to_cents(999999999999.99) <> 99999999999999
    or public.financial_to_cents(90071992547409.91) <> 9007199254740991 then
    raise exception 'Limite por registro ou MAX_SAFE_INTEGER foi convertido incorretamente.';
  end if;
  begin
    perform public.financial_to_cents(90071992547409.92);
    raise exception 'Agregação acima de MAX_SAFE_INTEGER foi aceita.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '22023' or sqlerrm <> 'Valor financeiro excede o limite seguro de centavos.' then
      raise;
    end if;
  end;

  if not exists (
    select 1 from pg_catalog.pg_indexes
    where schemaname = 'public' and indexname = 'financial_payments_owner_received_sp_idx'
      and indexdef like '%America/Sao_Paulo%'
  ) or not exists (
    select 1 from pg_catalog.pg_indexes
    where schemaname = 'public' and indexname = 'financial_expenses_owner_paid_sp_idx'
      and indexdef like '%America/Sao_Paulo%'
  ) then
    raise exception 'Índice de data não corresponde à expressão de São Paulo usada nas agregações.';
  end if;

  -- Limite por registro: numeric(14,2) = 999999999999.99.
  v_contract_id := (public.create_contract(jsonb_build_object(
    'creation_key', gen_random_uuid(),
    'client_id', (v_client ->> 'client')::jsonb ->> 'id',
    'service', 'Contrato no limite',
    'total_value', '999999999999.99',
    'contracted_at', v_today,
    'due_date', v_today + 1
  )) ->> 'id')::uuid;
  begin
    perform public.create_contract(jsonb_build_object(
      'creation_key', gen_random_uuid(),
      'client_id', (v_client ->> 'client')::jsonb ->> 'id',
      'service', 'Contrato acima do limite',
      'total_value', '1000000000000.00',
      'contracted_at', v_today
    ));
    raise exception 'Contrato acima do limite por registro foi aceito.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '22023' or sqlerrm <> 'Informe cliente, serviço, valor e data da contratação.' then raise; end if;
  end;
  for v_invalid_amount in select unnest(array[
    'abc', '1e3', 'NaN', 'Infinity', '1,23', '750.501', '-1.00'
  ]) loop
    begin
      perform public.create_contract(jsonb_build_object(
        'creation_key', gen_random_uuid(),
        'client_id', (v_client ->> 'client')::jsonb ->> 'id',
        'service', 'Contrato com valor textual inválido',
        'total_value', v_invalid_amount,
        'contracted_at', v_today
      ));
      raise exception 'Contrato com formato monetário inválido foi aceito.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '22023' or sqlerrm <> 'Informe cliente, serviço, valor e data da contratação.' then raise; end if;
    end;
    begin
      perform public.record_payment(jsonb_build_object(
        'contract_id', v_contract_id, 'idempotency_key', gen_random_uuid(),
        'type', 'receipt', 'amount', v_invalid_amount, 'received_at', now(),
        'related_payment_id', null, 'allocations', '[]'::jsonb
      ));
      raise exception 'Pagamento com formato monetário inválido foi aceito.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '22023' or sqlerrm <> 'Dados do pagamento inválidos.' then raise; end if;
    end;
    begin
      perform public.record_payment(jsonb_build_object(
        'contract_id', v_contract_id, 'idempotency_key', gen_random_uuid(),
        'type', 'receipt', 'amount', '1.00', 'received_at', now(),
        'related_payment_id', null,
        'allocations', jsonb_build_array(jsonb_build_object(
          'installment_id', gen_random_uuid(), 'amount', v_invalid_amount
        ))
      ));
      raise exception 'Alocação com formato monetário inválido foi aceita.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '22023' or sqlerrm <> 'Alocação inválida.' then raise; end if;
    end;
    begin
      perform public.create_expense(jsonb_build_object(
        'description', 'Despesa com valor textual inválido',
        'amount', v_invalid_amount,
        'expense_date', v_today
      ));
      raise exception 'Despesa com formato monetário inválido foi aceita.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '22023' or sqlerrm <> 'Informe descrição, valor e data da despesa.' then raise; end if;
    end;
  end loop;
  begin
    perform public.replace_contract_installments(v_contract_id, jsonb_build_array(
      jsonb_build_object('amount', '1000000000000.00', 'due_date', v_today + 1, 'notes', null)
    ));
    raise exception 'Parcela acima do limite por registro foi aceita.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '22023' or sqlerrm <> 'Cada parcela exige valor positivo com duas casas e vencimento.' then raise; end if;
  end;
  perform public.replace_contract_installments(v_contract_id, jsonb_build_array(
    jsonb_build_object('amount', '999999999999.99', 'due_date', v_today + 1, 'notes', null)
  ));
  begin
    perform public.record_payment(jsonb_build_object(
      'contract_id', v_contract_id, 'idempotency_key', gen_random_uuid(),
      'type', 'receipt', 'amount', '1000000000000.00', 'received_at', now(),
      'related_payment_id', null, 'allocations', '[]'::jsonb
    ));
    raise exception 'Pagamento acima do limite por registro foi aceito.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '22023' or sqlerrm <> 'Dados do pagamento inválido.' then raise; end if;
  end;
  begin
    perform public.record_payment(jsonb_build_object(
      'contract_id', v_contract_id, 'idempotency_key', gen_random_uuid(),
      'type', 'receipt', 'amount', '999999999999.99', 'received_at', now(),
      'related_payment_id', null,
      'allocations', jsonb_build_array(jsonb_build_object(
        'installment_id', (select id from public.contract_installments where contract_id = v_contract_id),
        'amount', '1000000000000.00'
      ))
    ));
    raise exception 'Alocação acima do limite por registro foi aceita.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '22023' or sqlerrm <> 'Alocação inválida.' then raise; end if;
  end;
  perform public.record_payment(jsonb_build_object(
    'contract_id', v_contract_id, 'idempotency_key', gen_random_uuid(),
    'type', 'receipt', 'amount', '999999999999.99', 'received_at', now(),
    'related_payment_id', null,
    'allocations', jsonb_build_array(jsonb_build_object(
      'installment_id', (select id from public.contract_installments where contract_id = v_contract_id),
      'amount', '999999999999.99'
    ))
  ));
  perform public.adjust_contract(v_contract_id, 999999999999.99);
  begin
    perform public.adjust_contract(v_contract_id, 1000000000000.00);
    raise exception 'Ajuste acima do limite por registro foi aceito.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '22023' or sqlerrm <> 'Novo total inválido.' then raise; end if;
  end;

  v_expense_id := (public.create_expense(jsonb_build_object(
    'description', 'Despesa no limite',
    'category_id', null,
    'amount', '999999999999.99',
    'expense_date', v_today,
    'due_date', v_today + 1,
    'project_id', null,
    'contract_id', null,
    'notes', null
  )) ->> 'id')::uuid;
  perform public.update_expense(v_expense_id, jsonb_build_object(
    'description', 'Despesa no limite',
    'category_id', null,
    'amount', '999999999999.99',
    'expense_date', v_today,
    'due_date', v_today + 1,
    'project_id', null,
    'contract_id', null,
    'notes', null
  ));
  for v_invalid_amount in select unnest(array[
    'abc', '1e3', 'NaN', 'Infinity', '1,23', '750.501', '-1.00'
  ]) loop
    begin
      perform public.update_expense(v_expense_id, jsonb_build_object(
        'description', 'Despesa com valor textual inválido',
        'category_id', null,
        'amount', v_invalid_amount,
        'expense_date', v_today,
        'due_date', v_today + 1,
        'project_id', null,
        'contract_id', null,
        'notes', null
      ));
      raise exception 'Edição de despesa com formato monetário inválido foi aceita.';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '22023' or sqlerrm <> 'Informe descrição e valor válidos.' then raise; end if;
    end;
  end loop;
  begin
    perform public.create_expense(jsonb_build_object(
      'description', 'Despesa acima do limite',
      'amount', '1000000000000.00',
      'expense_date', v_today
    ));
    raise exception 'Despesa acima do limite por registro foi aceita.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '22023' or sqlerrm <> 'Informe descrição, valor e data da despesa.' then raise; end if;
  end;
  begin
    perform public.update_expense(v_expense_id, jsonb_build_object(
      'description', 'Despesa acima do limite',
      'category_id', null,
      'amount', '1000000000000.00',
      'expense_date', v_today,
      'due_date', v_today + 1,
      'project_id', null,
      'contract_id', null,
      'notes', null
    ));
    raise exception 'Edição de despesa acima do limite por registro foi aceita.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '22023' or sqlerrm <> 'Informe descrição e valor válidos.' then raise; end if;
  end;

  -- Noventa e um registros no limite excedem MAX_SAFE_INTEGER em centavos.
  for v_i in 2..91 loop
    v_contract_id := (public.create_contract(jsonb_build_object(
      'creation_key', gen_random_uuid(),
      'client_id', (v_client ->> 'client')::jsonb ->> 'id',
      'service', 'Contrato de agregação ' || v_i,
      'total_value', '999999999999.99',
      'contracted_at', v_today
    )) ->> 'id')::uuid;
    perform public.record_payment(jsonb_build_object(
      'contract_id', v_contract_id, 'idempotency_key', gen_random_uuid(),
      'type', 'receipt', 'amount', '999999999999.99', 'received_at', now(),
      'related_payment_id', null, 'allocations', '[]'::jsonb
    ));
  end loop;
  begin
    perform public.get_financial_summary(v_today, v_today + 1);
    raise exception 'Agregação real acima de MAX_SAFE_INTEGER foi aceita.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '22023' or sqlerrm <> 'Valor financeiro excede o limite seguro de centavos.' then raise; end if;
  end;

  rollback to savepoint aggregation_case;
  release savepoint aggregation_case;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  v_summary := public.get_financial_summary(v_today, v_today + 1);
  v_flow := public.get_cash_flow(v_today, v_today + 1, 'day');
  v_categories := public.get_expense_category_totals(v_today, v_today + 1);
  if v_summary is distinct from v_other_baseline then
    raise exception 'Resumo do segundo proprietário mudou após mutações do primeiro.';
  end if;
  if v_flow is distinct from v_other_baseline_flow then
    raise exception 'Fluxo de caixa do segundo proprietário mudou após mutações do primeiro.';
  end if;
  if v_categories is distinct from v_other_baseline_categories then
    raise exception 'Despesas por categoria do segundo proprietário mudaram após mutações do primeiro.';
  end if;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);

  if exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid in (
      'public.get_financial_summary(date,date)'::regprocedure,
      'public.get_cash_flow(date,date,text)'::regprocedure,
      'public.get_expense_category_totals(date,date)'::regprocedure
    ) and p.prosecdef
  ) then
    raise exception 'RPC de leitura não está security invoker.';
  end if;

  reset role;
  raise notice 'Contrato SQL de resumo, fluxo, limites e RLS aprovado.';
end
$$;

rollback;
```

- [ ] **Etapa 2: Confirmar o vermelho**

Esperado: `public.get_financial_summary(date,date)`, `public.get_cash_flow(date,date,text)` e `public.get_expense_category_totals(date,date)` não existem.

- [ ] **Etapa 3: Inserir as agregações antes de `commit;`**

```sql
create or replace function public.financial_to_cents(p_value numeric)
returns bigint
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if p_value is null
    or p_value = 'NaN'::numeric
    or p_value = 'Infinity'::numeric
    or p_value = '-Infinity'::numeric then
    raise exception 'Valor financeiro não pode ser convertido em centavos inteiros.' using errcode = '22023';
  end if;
  if p_value <> round(p_value, 2) then
    raise exception 'Valor financeiro não pode ser convertido em centavos inteiros.' using errcode = '22023';
  end if;
  -- Os tipos TypeScript usam number; toda agregação deve caber em MAX_SAFE_INTEGER.
  if pg_catalog.abs(p_value * 100) > 9007199254740991::numeric then
    raise exception 'Valor financeiro excede o limite seguro de centavos.' using errcode = '22023';
  end if;
  return round(p_value * 100)::bigint;
end;
$$;

create or replace function public.get_financial_summary(p_start date, p_end date)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_today date;
  v_contracted numeric;
  v_received numeric;
  v_pending numeric;
  v_period_receipts numeric;
  v_period_expenses numeric;
  v_overdue numeric;
  v_due jsonb;
  v_overdue_items jsonb;
  v_upcoming jsonb;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'Período inválido.' using errcode = '22023';
  end if;
  v_today := (now() at time zone 'America/Sao_Paulo')::date;

  select coalesce(sum(c.total_value), 0) into v_contracted
    from public.contracts c
    where c.status = 'active';
  select coalesce(sum(case when p.type = 'receipt' then p.amount else -p.amount end), 0)
    into v_received
    from public.financial_payments p;
  select coalesce(sum(greatest(c.total_value - coalesce(n.net_received, 0), 0)), 0)
    into v_pending
    from public.contracts c
    left join lateral (
      select coalesce(sum(case when p.type = 'receipt' then p.amount else -p.amount end), 0) as net_received
      from public.financial_payments p
      where p.contract_id = c.id
    ) n on true
    where c.status = 'active';
  select coalesce(sum(case when p.type = 'receipt' then p.amount else -p.amount end), 0)
    into v_period_receipts
    from public.financial_payments p
    where (p.received_at at time zone 'America/Sao_Paulo') >= p_start::timestamp
      and (p.received_at at time zone 'America/Sao_Paulo') < p_end::timestamp;
  select coalesce(sum(e.amount), 0) into v_period_expenses
    from public.financial_expenses e
    where e.status = 'paid'
      and (e.paid_at at time zone 'America/Sao_Paulo') >= p_start::timestamp
      and (e.paid_at at time zone 'America/Sao_Paulo') < p_end::timestamp;

  select coalesce(jsonb_agg(jsonb_build_object(
    'contract_id', q.contract_id,
    'client_id', q.client_id,
    'description', q.description,
    'due_date', q.due_date,
    'amount', q.amount
  ) order by q.due_date, q.contract_id, q.description), '[]'::jsonb) into v_due
  from (
    select i.contract_id, c.client_id, 'Parcela ' || (i.position + 1)::text as description,
      i.due_date, greatest(i.amount - coalesce(n.allocated, 0), 0) as amount
    from public.contract_installments i
    join public.contracts c on c.id = i.contract_id and c.owner_id = i.owner_id
    left join lateral (
      select coalesce(sum(case when p.type = 'receipt' then a.amount else -a.amount end), 0) as allocated
      from public.financial_payment_allocations a
      join public.financial_payments p on p.id = a.payment_id
      where a.installment_id = i.id
    ) n on true
    where c.status = 'active'
    union all
    select c.id, c.client_id, c.service, c.due_date,
      greatest(c.total_value - coalesce(n.net_received, 0), 0)
    from public.contracts c
    left join lateral (
      select coalesce(sum(case when p.type = 'receipt' then p.amount else -p.amount end), 0) as net_received
      from public.financial_payments p
      where p.contract_id = c.id
    ) n on true
    where c.status = 'active'
      and not exists (
        select 1 from public.contract_installments i where i.contract_id = c.id
      )
  ) q
  where q.amount > 0 and q.due_date is not null;

  select coalesce(sum((d.value ->> 'amount')::numeric), 0) into v_overdue
    from jsonb_array_elements(v_due) as d(value)
    where (d.value ->> 'due_date')::date < v_today;
  select coalesce(jsonb_agg(jsonb_build_object(
    'contract_id', d.value ->> 'contract_id',
    'client_id', d.value ->> 'client_id',
    'description', d.value ->> 'description',
    'due_date', d.value ->> 'due_date',
    'amount_cents', public.financial_to_cents((d.value ->> 'amount')::numeric)
  ) order by (d.value ->> 'due_date')::date, d.value ->> 'contract_id'), '[]'::jsonb)
    into v_overdue_items
    from jsonb_array_elements(v_due) as d(value)
    where (d.value ->> 'due_date')::date < v_today;
  select coalesce(jsonb_agg(jsonb_build_object(
    'contract_id', d.value ->> 'contract_id',
    'client_id', d.value ->> 'client_id',
    'description', d.value ->> 'description',
    'due_date', d.value ->> 'due_date',
    'amount_cents', public.financial_to_cents((d.value ->> 'amount')::numeric)
  ) order by (d.value ->> 'due_date')::date, d.value ->> 'contract_id'), '[]'::jsonb)
    into v_upcoming
    from jsonb_array_elements(v_due) as d(value)
    where (d.value ->> 'due_date')::date >= v_today;

  return jsonb_build_object(
    'contracted_cents', public.financial_to_cents(v_contracted),
    'received_historical_cents', public.financial_to_cents(v_received),
    'pending_cents', public.financial_to_cents(v_pending),
    'period_receipts_cents', public.financial_to_cents(v_period_receipts),
    'period_expenses_cents', public.financial_to_cents(v_period_expenses),
    'period_profit_cents', public.financial_to_cents(v_period_receipts - v_period_expenses),
    'overdue_cents', public.financial_to_cents(v_overdue),
    'overdue', v_overdue_items,
    'upcoming', v_upcoming
  );
end;
$$;

create or replace function public.get_cash_flow(p_start date, p_end date, p_bucket text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_bucket_start timestamp;
  v_bucket_end timestamp;
  v_range_start timestamp;
  v_range_end timestamp;
  v_receipts numeric;
  v_expenses numeric;
  v_balance numeric;
  v_bucket_count int := 0;
  v_result jsonb := '[]'::jsonb;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'Período inválido.' using errcode = '22023';
  end if;
  if p_bucket is null or p_bucket not in ('day','week','month','year') then
    raise exception 'Agrupamento inválido.' using errcode = '22023';
  end if;
  if p_end - p_start > 1095 then
    raise exception 'O período do fluxo de caixa não pode exceder 1095 dias.' using errcode = '22023';
  end if;

  select coalesce(sum(case when p.type = 'receipt' then p.amount else -p.amount end), 0)
    - coalesce((
      select sum(e.amount) from public.financial_expenses e
      where e.status = 'paid'
        and (e.paid_at at time zone 'America/Sao_Paulo') < p_start::timestamp
    ), 0)
    into v_balance
    from public.financial_payments p
    where (p.received_at at time zone 'America/Sao_Paulo') < p_start::timestamp;

  v_bucket_start := date_trunc(p_bucket, p_start::timestamp);
  while v_bucket_start < p_end::timestamp loop
    if v_bucket_count >= 1095 then
      raise exception 'O período do fluxo de caixa excede o limite de 1095 buckets.' using errcode = '22023';
    end if;
    v_bucket_count := v_bucket_count + 1;
    v_bucket_end := case p_bucket
      when 'day' then v_bucket_start + interval '1 day'
      when 'week' then v_bucket_start + interval '7 days'
      when 'month' then date_trunc('month', v_bucket_start + interval '1 month')
      else date_trunc('year', v_bucket_start + interval '1 year')
    end;
    v_range_start := greatest(v_bucket_start, p_start::timestamp);
    v_range_end := least(v_bucket_end, p_end::timestamp);
    if v_range_start < v_range_end then
      select coalesce(sum(case when p.type = 'receipt' then p.amount else -p.amount end), 0)
        into v_receipts
        from public.financial_payments p
        where (p.received_at at time zone 'America/Sao_Paulo') >= v_range_start
          and (p.received_at at time zone 'America/Sao_Paulo') < v_range_end;
      select coalesce(sum(e.amount), 0) into v_expenses
        from public.financial_expenses e
        where e.status = 'paid'
          and (e.paid_at at time zone 'America/Sao_Paulo') >= v_range_start
          and (e.paid_at at time zone 'America/Sao_Paulo') < v_range_end;
      v_balance := v_balance + v_receipts - v_expenses;
      v_result := v_result || jsonb_build_array(jsonb_build_object(
        'label', to_char(v_bucket_start, 'YYYY-MM-DD'),
        'receipts_cents', public.financial_to_cents(v_receipts),
        'expenses_cents', public.financial_to_cents(v_expenses),
        'net_cents', public.financial_to_cents(v_receipts - v_expenses),
        'balance_cents', public.financial_to_cents(v_balance)
      ));
    end if;
    v_bucket_start := v_bucket_end;
  end loop;
  return v_result;
end;
$$;

create or replace function public.get_expense_category_totals(p_start date, p_end date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'category_id', category_id,
    'name', name,
    'amount_cents', amount_cents
  ) order by amount_cents desc, name), '[]'::jsonb)
  from (
    select e.category_id, coalesce(c.name, 'Sem categoria') as name,
      public.financial_to_cents(sum(e.amount)) as amount_cents
    from public.financial_expenses e
    left join public.expense_categories c on c.id = e.category_id
    where e.status = 'paid'
      and e.paid_at is not null
      and (e.paid_at at time zone 'America/Sao_Paulo') >= p_start::timestamp
      and (e.paid_at at time zone 'America/Sao_Paulo') < p_end::timestamp
    group by e.category_id, coalesce(c.name, 'Sem categoria')
  ) as totals
$$;

revoke all on function public.financial_to_cents(numeric) from public, anon, authenticated;
grant execute on function public.financial_to_cents(numeric) to authenticated;
revoke all on function public.get_financial_summary(date, date) from public, anon, authenticated;
revoke all on function public.get_cash_flow(date, date, text) from public, anon, authenticated;
revoke all on function public.get_expense_category_totals(date, date) from public, anon, authenticated;
grant execute on function public.get_financial_summary(date, date) to authenticated;
grant execute on function public.get_cash_flow(date, date, text) to authenticated;
grant execute on function public.get_expense_category_totals(date, date) to authenticated;
```

- [ ] **Etapa 4: Revisar período, fuso e segurança**

Comando: `git diff --check`
Esperado: contrato cancelado sai apenas dos totais ativos; recebido histórico permanece; caixa usa datas efetivas; primeiro/último bucket são limitados ao intervalo; saldo acumulado inclui movimentos anteriores; duração máxima de 1095 dias e 1095 buckets; bucket `NULL` é rejeitado; sem `generate_series`; acumuladores `numeric`; conversão final respeita `MAX_SAFE_INTEGER`; índices de data correspondem às expressões de São Paulo; `upcoming` inclui vencimentos após 30 dias; RPCs de leitura `security invoker` com proprietário filtrado por RLS.

- [ ] **Etapa 5: Executar o teste SQL completo**

Comando: aplicar `supabase/tests/etapa3_finance.sql` no SQL Editor com as migrations 0001–0008 já aplicadas.
Esperado: notices de `update_client`, contratos/parcelas e validação textual, pagamentos/estornos, despesas/categorias e resumo/fluxo/RLS; término em `ROLLBACK`, sem dados persistidos. Os notices dos dois harnesses de concorrência pertencem às execuções separadas das Tarefas 5 e 6.

- [ ] **Etapa 6: Criar commit**

```bash
git add supabase/migrations/0008_etapa3_finance.sql supabase/tests/etapa3_finance.sql
git commit -m "feat: adicionar resumo e fluxo de caixa"
```

### Tarefa 8: Criar serviços financeiros e testes de contrato

**Arquivos:**
- Criar: `src/services/contractService.ts`
- Criar: `src/services/contractService.test.ts`
- Criar: `src/services/expenseService.ts`
- Criar: `src/services/expenseService.test.ts`
- Criar: `src/services/financialService.ts`
- Criar: `src/services/financialService.test.ts`

**Interfaces:**
- Consome: tipos da Tarefa 1, `fromMoneyDecimal`, `toMoneyDecimal`, `calculateContractBalance`, `calculateInstallmentFinancial`, `getSaoPauloToday`, `requireSupabase` e `throwDbError`.
- Produz:
  - `listContracts(filters?)`, `listPayments(contractId?)`, `getContractFinancials(id)`, `createContract(input)`, `replaceInstallments(id,installments)`, `adjustContract(id,totalCents)`, `cancelContract(id)` e `recordPayment(id,input)`.
  - `listExpenses(filters?)`, `listOverdueExpenses(today?)`, `listExpensesForClient(clientId,filters?)`, `createExpense(input)`, `updateExpense(id,input)`, `updateExpenseNotes(id,input)`, `payExpense(id,paidAt,method)`, `cancelExpense(id)`, `listCategories(includeArchived?)`, `createCategory(name)` e `archiveCategory(id)`.
  - `getFinancialSummary(start,end)`, `getCashFlow(start,end,granularity)` e `getExpenseCategoryTotals(start,end)`.
- Os valores de registro usam `fromMoneyDecimal`/`toMoneyDecimal`; agregações permanecem `number` e `cents()` exige `Number.isSafeInteger`, alinhado à rejeição SQL de valores acima de `MAX_SAFE_INTEGER`.

- [ ] **Etapa 1: Escrever os testes de serviço que falham**

```ts
// src/services/contractService.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db')>()
  return { ...actual, requireSupabase: vi.fn(() => ({ rpc: db.rpc, from: db.from })) }
})

import {
  cancelContract,
  createContract,
  getContractFinancials,
  listContracts,
  listPayments,
  recordPayment,
  replaceInstallments,
} from './contractService'

function query<T>(data: T, error: unknown = null) {
  const result = { data, error }
  const chain = Promise.resolve(result) as Promise<typeof result> & {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
  }
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(() => chain)
  return chain
}

const contractRow = {
  id: 'contract-1', owner_id: 'owner', client_id: 'client-1', source_link_id: null,
  creation_key: '11111111-1111-4111-8111-111111111111', service: 'Site', total_value: '1000.00',
  contracted_at: '2026-11-01', due_date: '2026-12-01', payment_method: 'pix', payment_terms: null,
  status: 'active', notes: null, cancelled_at: null, created_at: '', updated_at: '',
}

beforeEach(() => {
  db.rpc.mockReset()
  db.from.mockReset()
})

describe('contractService', () => {
  it('envia centavos e alocações como decimal e preserva idempotency_key', async () => {
    db.rpc.mockResolvedValue({
      data: { ...contractRow, id: 'payment-1', amount: '300.00', allocations: [], already_existed: false },
      error: null,
    })
    const result = await recordPayment('contract-1', {
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      type: 'receipt', amountCents: 30000, receivedAt: '2026-11-25T12:00:00-03:00',
      paymentMethod: 'pix', notes: '', relatedPaymentId: null,
      allocations: [{ installmentId: 'installment-1', amountCents: 30000 }],
    })
    expect(db.rpc).toHaveBeenCalledWith('record_payment', {
      p_payload: {
        contract_id: 'contract-1', idempotency_key: '11111111-1111-4111-8111-111111111111',
        type: 'receipt', amount: '300.00', received_at: '2026-11-25T12:00:00-03:00',
        payment_method: 'pix', notes: null, related_payment_id: null,
        allocations: [{ installment_id: 'installment-1', amount: '300.00' }],
      },
    })
    expect(result.amount_cents).toBe(30000)
  })

  it('rejeita JSON inválido da RPC', async () => {
    db.rpc.mockResolvedValue({ data: null, error: null })
    await expect(recordPayment('contract-1', {
      idempotencyKey: '11111111-1111-4111-8111-111111111111', type: 'receipt',
      amountCents: 100, receivedAt: '2026-11-25T12:00:00-03:00', paymentMethod: '',
      notes: '', relatedPaymentId: null, allocations: [],
    })).rejects.toThrow('Não foi possível registrar o pagamento.')
  })

  it('filtra contratos por clientId e normaliza o valor', async () => {
    const contracts = query([{ ...contractRow, clients: { name: 'Empresa A' } }])
    db.from.mockReturnValue(contracts)
    const result = await listContracts({ clientId: 'client-1' })
    expect(contracts.eq).toHaveBeenCalledWith('client_id', 'client-1')
    expect(result[0].client_name).toBe('Empresa A')
    expect(result[0].total_value_cents).toBe(100000)
  })

  it('lista pagamentos de um contrato sem consultar tabelas deletadas', async () => {
    const payments = query([{
      ...contractRow, id: 'payment-1', idempotency_key: '11111111-1111-4111-8111-111111111111',
      related_payment_id: null, type: 'receipt', amount: '300.00',
      received_at: '2026-11-25T12:00:00-03:00', created_by: 'owner', created_at: '',
    }])
    db.from.mockReturnValue(payments)
    const result = await listPayments('contract-1')
    expect(db.from).toHaveBeenCalledWith('financial_payments')
    expect(payments.eq).toHaveBeenCalledWith('contract_id', 'contract-1')
    expect(result[0].amount_cents).toBe(30000)
  })

  it('calcula saldo do contrato e status líquido das parcelas em uma única consulta', async () => {
    const embedded = query({
      ...contractRow,
      clients: [{ name: 'Empresa A' }],
      contract_installments: [
        { id: 'i1', owner_id: 'owner', contract_id: 'contract-1', position: 0, amount: '600.00', due_date: '2000-01-01', notes: null, created_at: '', updated_at: '' },
        { id: 'i2', owner_id: 'owner', contract_id: 'contract-1', position: 1, amount: '400.00', due_date: '2999-01-01', notes: null, created_at: '', updated_at: '' },
      ],
      financial_payments: [
        {
          id: 'p1', owner_id: 'owner', contract_id: 'contract-1', idempotency_key: 'key-1',
          related_payment_id: null, type: 'receipt', amount: '300.00', received_at: '',
          payment_method: null, notes: null, created_by: null, created_at: '',
          financial_payment_allocations: [
            { id: 'a1', owner_id: 'owner', contract_id: 'contract-1', payment_id: 'p1', installment_id: 'i1', amount: '200.00', created_at: '' },
            { id: 'a2', owner_id: 'owner', contract_id: 'contract-1', payment_id: 'p1', installment_id: 'i2', amount: '100.00', created_at: '' },
          ],
        },
        {
          id: 'p2', owner_id: 'owner', contract_id: 'contract-1', idempotency_key: 'key-2',
          related_payment_id: 'p1', type: 'refund', amount: '50.00', received_at: '',
          payment_method: null, notes: null, created_by: null, created_at: '',
          financial_payment_allocations: [
            { id: 'a3', owner_id: 'owner', contract_id: 'contract-1', payment_id: 'p2', installment_id: 'i1', amount: '50.00', created_at: '' },
          ],
        },
      ],
    })
    db.from.mockReturnValue(embedded)
    const result = await getContractFinancials('contract-1')
    expect(db.from).toHaveBeenCalledTimes(1)
    expect(db.from).toHaveBeenCalledWith('contracts')
    expect(embedded.select).toHaveBeenCalledWith('*, clients(name), contract_installments(*), financial_payments(*, financial_payment_allocations(*))')
    expect(embedded.eq).toHaveBeenCalledWith('id', 'contract-1')
    expect(embedded.maybeSingle).toHaveBeenCalledTimes(1)
    expect(result?.receivedCents).toBe(25000)
    expect(result?.pendingCents).toBe(75000)
    expect(result?.installments[0]).toMatchObject({ allocated_cents: 15000, remaining_cents: 45000, status: 'overdue' })
    expect(result?.installments[1]).toMatchObject({ allocated_cents: 10000, remaining_cents: 30000, status: 'pending' })
  })

  it('rejeita soma de alocações acima do limite seguro', async () => {
    const limit = '999999999999.99'
    const payments = Array.from({ length: 91 }, (_, index) => {
      const id = `p${index + 1}`
      return {
        id, owner_id: 'owner', contract_id: 'contract-1', type: 'receipt', amount: limit, received_at: '',
        financial_payment_allocations: [{
          id: `a-${id}`, owner_id: 'owner', contract_id: 'contract-1',
          payment_id: id, installment_id: 'i1', amount: limit, created_at: '',
        }],
      }
    })
    const embedded = query({
      ...contractRow, total_value: limit, clients: [],
      contract_installments: [{
        id: 'i1', owner_id: 'owner', contract_id: 'contract-1', position: 0,
        amount: limit, due_date: '2026-12-01', notes: null, created_at: '', updated_at: '',
      }],
      financial_payments: payments,
    })
    db.from.mockReturnValue(embedded)
    await expect(getContractFinancials('contract-1')).rejects.toThrow('Total financeiro excede o limite de centavos.')
    expect(db.from).toHaveBeenCalledTimes(1)
  })

  it('mantém a chave fornecida ao criar contrato', async () => {
    db.rpc.mockResolvedValue({ data: contractRow, error: null })
    await createContract({
      creationKey: '11111111-1111-4111-8111-111111111111', clientId: 'client-1', service: 'Site',
      totalValueCents: 100000, contractedAt: '2026-11-01', dueDate: '2026-12-01',
      paymentMethod: 'pix', paymentTerms: '', notes: '',
    })
    expect(db.rpc).toHaveBeenCalledWith('create_contract', {
      p_payload: expect.objectContaining({
        creation_key: '11111111-1111-4111-8111-111111111111', total_value: '1000.00',
      }),
    })
  })

  it('envia parcelas na ordem do array', async () => {
    db.rpc.mockResolvedValue({ data: [], error: null })
    await replaceInstallments('contract-1', [
      { amountCents: 60000, dueDate: '2026-12-01', notes: '' },
      { amountCents: 40000, dueDate: '2026-12-15', notes: '' },
    ])
    expect(db.rpc).toHaveBeenCalledWith('replace_contract_installments', {
      p_contract_id: 'contract-1',
      p_installments: [
        { amount: '600.00', due_date: '2026-12-01', notes: null },
        { amount: '400.00', due_date: '2026-12-15', notes: null },
      ],
    })
  })

  it('envia array vazio para representar contrato sem parcelas', async () => {
    db.rpc.mockResolvedValue({ data: [], error: null })
    await expect(replaceInstallments('contract-1', [])).resolves.toEqual([])
    expect(db.rpc).toHaveBeenCalledWith('replace_contract_installments', {
      p_contract_id: 'contract-1', p_installments: [],
    })
  })

  it('cancela contrato por RPC e nunca chama delete', async () => {
    db.rpc.mockResolvedValue({ data: { ...contractRow, status: 'cancelled' }, error: null })
    await cancelContract('contract-1')
    expect(db.rpc).toHaveBeenCalledWith('cancel_contract', { p_contract_id: 'contract-1' })
    expect(db.from).not.toHaveBeenCalled()
  })
})
```

```ts
// src/services/expenseService.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db')>()
  return { ...actual, requireSupabase: vi.fn(() => ({ rpc: db.rpc, from: db.from })) }
})

import {
  createExpense,
  listCategories,
  listExpenses,
  listExpensesForClient,
  listOverdueExpenses,
  payExpense,
  updateExpense,
  updateExpenseNotes,
} from './expenseService'

function query<T>(data: T, error: unknown = null) {
  const result = { data, error }
  const chain = Promise.resolve(result) as Promise<typeof result> & {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    is: ReturnType<typeof vi.fn>
    gte: ReturnType<typeof vi.fn>
    lte: ReturnType<typeof vi.fn>
    lt: ReturnType<typeof vi.fn>
    or: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
  }
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.is = vi.fn(() => chain)
  chain.gte = vi.fn(() => chain)
  chain.lte = vi.fn(() => chain)
  chain.lt = vi.fn(() => chain)
  chain.or = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  return chain
}

const expense = {
  id: 'expense-1', owner_id: 'owner', description: 'Hospedagem', category_id: null,
  amount: '120.00', expense_date: '2026-11-25', due_date: '2026-11-20', paid_at: null,
  payment_method: null, status: 'pending', project_id: null, contract_id: null,
  notes: null, cancelled_at: null, created_at: '', updated_at: '',
}

beforeEach(() => {
  db.rpc.mockReset()
  db.from.mockReset()
})

describe('expenseService', () => {
  it('cria despesa pendente em centavos', async () => {
    db.rpc.mockResolvedValue({ data: expense, error: null })
    const result = await createExpense({
      description: 'Hospedagem', categoryId: null, amountCents: 12000,
      expenseDate: '2026-11-25', dueDate: '2026-11-20', projectId: null,
      contractId: null, notes: '',
    })
    expect(db.rpc).toHaveBeenCalledWith('create_expense', {
      p_payload: {
        description: 'Hospedagem', category_id: null, amount: '120.00',
        expense_date: '2026-11-25', due_date: '2026-11-20', project_id: null,
        contract_id: null, notes: null,
      },
    })
    expect(result.status).toBe('pending')
    expect(result.amount_cents).toBe(12000)
  })

  it('edição pendente envia todos os campos financeiros', async () => {
    db.rpc.mockResolvedValue({ data: expense, error: null })
    await updateExpense('expense-1', {
      description: 'Hospedagem', categoryId: null, amountCents: 15000,
      expenseDate: '2026-11-26', dueDate: '2026-11-30', projectId: null,
      contractId: null, notes: '',
    })
    expect(db.rpc).toHaveBeenCalledWith('update_expense', {
      p_expense_id: 'expense-1',
      p_payload: expect.objectContaining({ amount: '150.00', expense_date: '2026-11-26' }),
    })
  })

  it('despesa paga envia somente ExpenseNotesInput', async () => {
    db.rpc.mockResolvedValue({ data: { ...expense, status: 'paid' }, error: null })
    await updateExpenseNotes('expense-1', { notes: 'Complemento' })
    expect(db.rpc).toHaveBeenCalledWith('update_expense', {
      p_expense_id: 'expense-1', p_payload: { notes: 'Complemento' },
    })
  })

  it('envia paid_at sem reinterpretar data no cliente', async () => {
    db.rpc.mockResolvedValue({ data: { ...expense, status: 'paid', paid_at: '2026-11-25T03:00:00Z' }, error: null })
    await payExpense('expense-1', '2026-11-25', 'pix')
    expect(db.rpc).toHaveBeenCalledWith('pay_expense', {
      p_expense_id: 'expense-1', p_payload: { paid_at: '2026-11-25', payment_method: 'pix' },
    })
  })

  it('aplica filtros de despesas com gte/lte no mock', async () => {
    const expenses = query([expense])
    db.from.mockReturnValue(expenses)
    await listExpenses({ status: 'pending', startDate: '2026-11-01', endDate: '2026-11-30' })
    expect(expenses.eq).toHaveBeenCalledWith('status', 'pending')
    expect(expenses.gte).toHaveBeenCalledWith('expense_date', '2026-11-01')
    expect(expenses.lte).toHaveBeenCalledWith('expense_date', '2026-11-30')
  })

  it('filtra categorias ativas com is e permite incluir arquivadas', async () => {
    const active = query([])
    db.from.mockReturnValueOnce(active)
    await listCategories()
    expect(active.is).toHaveBeenCalledWith('archived_at', null)

    const all = query([])
    db.from.mockReturnValueOnce(all)
    await listCategories(true)
    expect(all.is).not.toHaveBeenCalled()
  })

  it('busca despesas do cliente com or, aplica filtros e não consulta sem vínculos', async () => {
    const projects = query([{ id: 'project-1' }])
    const contracts = query([{ id: 'contract-1' }])
    const expenses = query([])
    db.from.mockImplementation((table: string) => ({
      projects, contracts, financial_expenses: expenses,
    })[table as 'projects'])
    await listExpensesForClient('client-1', { status: 'paid', startDate: '2026-11-01', endDate: '2026-11-30' })
    expect(expenses.or).toHaveBeenCalledWith('contract_id.in.(contract-1),project_id.in.(project-1)')
    expect(expenses.eq).toHaveBeenCalledWith('status', 'paid')
    expect(expenses.gte).toHaveBeenCalledWith('expense_date', '2026-11-01')
    expect(expenses.lte).toHaveBeenCalledWith('expense_date', '2026-11-30')

    db.from.mockImplementation((table: string) => ({
      projects: query([]), contracts: query([]),
    })[table as 'projects'])
    await expect(listExpensesForClient('client-2')).resolves.toEqual([])
  })

  it('lista coleção overdue com pendentes e vencimento anterior', async () => {
    const overdue = query([expense])
    db.from.mockReturnValue(overdue)
    const result = await listOverdueExpenses('2026-11-25')
    expect(overdue.eq).toHaveBeenCalledWith('status', 'pending')
    expect(overdue.lt).toHaveBeenCalledWith('due_date', '2026-11-25')
    expect(result[0].id).toBe('expense-1')
  })
})
```

```ts
// src/services/financialService.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db')>()
  return { ...actual, requireSupabase: vi.fn(() => ({ rpc: db.rpc, from: db.from })) }
})

import { getCashFlow, getExpenseCategoryTotals, getFinancialSummary } from './financialService'

beforeEach(() => db.rpc.mockReset())

describe('financialService', () => {
  it('normaliza resumo, overdue e próximos vencimentos para centavos', async () => {
    db.rpc.mockResolvedValue({
      data: {
        contracted_cents: 100000, received_historical_cents: 30000, pending_cents: 70000,
        period_receipts_cents: 30000, period_expenses_cents: 12000, period_profit_cents: 18000,
        overdue_cents: 0,
        overdue: [],
        upcoming: [{ contract_id: 'c1', client_id: 'client-1', description: 'Parcela 1', due_date: '2026-12-01', amount_cents: 70000 }],
      },
      error: null,
    })
    const result = await getFinancialSummary('2026-11-01', '2026-12-01')
    expect(result.pendingCents).toBe(70000)
    expect(result.overdue).toEqual([])
    expect(result.upcoming[0].amount_cents).toBe(70000)
    expect(db.rpc).toHaveBeenCalledWith('get_financial_summary', { p_start: '2026-11-01', p_end: '2026-12-01' })
  })

  it('normaliza buckets do fluxo de caixa', async () => {
    db.rpc.mockResolvedValue({
      data: [{ label: '2026-11-25', receipts_cents: 30000, expenses_cents: 12000, net_cents: 18000, balance_cents: 18000 }],
      error: null,
    })
    await expect(getCashFlow('2026-11-25', '2026-11-26', 'day')).resolves.toEqual([{
      label: '2026-11-25', receiptsCents: 30000, expensesCents: 12000, netCents: 18000, balanceCents: 18000,
    }])
  })

  it('normaliza despesas pagas por categoria', async () => {
    db.rpc.mockResolvedValue({
      data: [{ category_id: null, name: 'Sem categoria', amount_cents: 12000 }],
      error: null,
    })
    await expect(getExpenseCategoryTotals('2026-11-01', '2026-12-01')).resolves.toEqual([
      { categoryId: null, name: 'Sem categoria', amountCents: 12000 },
    ])
    expect(db.rpc).toHaveBeenCalledWith('get_expense_category_totals', { p_start: '2026-11-01', p_end: '2026-12-01' })
  })

  it('aceita agregação no limite seguro de number', async () => {
    db.rpc.mockResolvedValue({
      data: [{ label: '2026-11-25', receipts_cents: '9007199254740991', expenses_cents: 0, net_cents: '9007199254740991', balance_cents: '9007199254740991' }],
      error: null,
    })
    const result = await getCashFlow('2026-11-25', '2026-11-26', 'day')
    expect(result[0].balanceCents).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('rejeita agregação acima de MAX_SAFE_INTEGER', async () => {
    db.rpc.mockResolvedValue({
      data: [{ label: '2026-11-25', receipts_cents: '9007199254740992', expenses_cents: 0, net_cents: '9007199254740992', balance_cents: '9007199254740992' }],
      error: null,
    })
    await expect(getCashFlow('2026-11-25', '2026-11-26', 'day')).rejects.toThrow('Resposta financeira inválida.')
  })

  it('rejeita payload nulo, bucket NULL e agrupamento inválido', async () => {
    db.rpc.mockResolvedValue({ data: null, error: null })
    await expect(getFinancialSummary('2026-11-01', '2026-12-01')).rejects.toThrow('Não foi possível carregar o resumo financeiro.')
    await expect(getCashFlow('2026-11-01', '2026-12-01', null as never)).rejects.toThrow('Agrupamento de fluxo de caixa inválido.')
    await expect(getCashFlow('2026-11-01', '2026-12-01', 'hour' as never)).rejects.toThrow('Agrupamento de fluxo de caixa inválido.')
    expect(db.rpc).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Etapa 2: Executar os testes e confirmar o vermelho**

Comando: `npm test -- src/services/contractService.test.ts src/services/expenseService.test.ts src/services/financialService.test.ts`
Esperado: falha porque os três serviços não existem.

- [ ] **Etapa 3: Implementar os serviços completos**

```ts
// src/services/contractService.ts
import { requireSupabase, throwDbError } from '../lib/db'
import { fromMoneyDecimal, toMoneyDecimal } from '../lib/money'
import { calculateContractBalance, calculateInstallmentFinancial, getSaoPauloToday } from '../lib/finance'
import type { Contract, ContractStatus } from '../types/contract'
import type {
  ContractFinancials, ContractListItem, CreateContractInput, FinancialPayment,
  Installment, InstallmentFinancial, PaymentAllocation, PaymentInput, PaymentResult,
} from '../types/finance'

type ContractRow = Omit<Contract, 'total_value_cents'> & { total_value: string | number }
type JoinedContractRow = ContractRow & { clients: { name: string } | Array<{ name: string }> | null }
type InstallmentRow = Omit<Installment, 'amount_cents'> & { amount: string | number }
type PaymentRow = Omit<FinancialPayment, 'amount_cents'> & { amount: string | number }
type AllocationRow = Omit<PaymentAllocation, 'amount_cents'> & { amount: string | number }
type EmbeddedPaymentRow = PaymentRow & { financial_payment_allocations: AllocationRow[] }
type EmbeddedContractRow = JoinedContractRow & {
  contract_installments: InstallmentRow[]
  financial_payments: EmbeddedPaymentRow[]
}

export interface ContractFilters {
  clientId?: string
  status?: ContractStatus
}

function objectData<T>(data: unknown, message: string): T {
  const value = Array.isArray(data) ? data[0] : data
  if (!value || typeof value !== 'object') throw new Error(message)
  return value as T
}

function arrayData<T>(data: unknown, message: string): T[] {
  if (!Array.isArray(data)) throw new Error(message)
  return data as T[]
}

function clientName(row: JoinedContractRow): string {
  if (Array.isArray(row.clients)) return row.clients[0]?.name ?? 'Cliente sem nome'
  return row.clients?.name ?? 'Cliente sem nome'
}

function toBaseContract(row: ContractRow): Contract {
  const { total_value, ...rest } = row
  return { ...rest, total_value_cents: fromMoneyDecimal(total_value) }
}

function toContract(row: JoinedContractRow): ContractListItem {
  return { ...toBaseContract(row), client_name: clientName(row) }
}

function toInstallment(row: InstallmentRow): Installment {
  const { amount, ...rest } = row
  return { ...rest, amount_cents: fromMoneyDecimal(amount) }
}

function toPayment(row: PaymentRow): FinancialPayment {
  const { amount, ...rest } = row
  return { ...rest, amount_cents: fromMoneyDecimal(amount) }
}

function toAllocation(row: AllocationRow): PaymentAllocation {
  const { amount, ...rest } = row
  return { ...rest, amount_cents: fromMoneyDecimal(amount) }
}

export async function listContracts(filters: ContractFilters = {}): Promise<ContractListItem[]> {
  let query = requireSupabase().from('contracts').select('*, clients(name)').order('contracted_at', { ascending: false }).order('id')
  if (filters.clientId) query = query.eq('client_id', filters.clientId)
  if (filters.status) query = query.eq('status', filters.status)
  const { data, error } = await query
  throwDbError(error)
  return arrayData<JoinedContractRow>(data, 'Não foi possível carregar os contratos.').map(toContract)
}

export async function listPayments(contractId?: string): Promise<FinancialPayment[]> {
  let query = requireSupabase().from('financial_payments').select('*').order('received_at', { ascending: false }).order('id')
  if (contractId) query = query.eq('contract_id', contractId)
  const { data, error } = await query
  throwDbError(error)
  return arrayData<PaymentRow>(data, 'Não foi possível carregar os pagamentos.').map(toPayment)
}

export async function getContractFinancials(id: string): Promise<ContractFinancials | null> {
  const contractResult = await requireSupabase()
    .from('contracts')
    .select('*, clients(name), contract_installments(*), financial_payments(*, financial_payment_allocations(*))')
    .eq('id', id)
    .maybeSingle()
  throwDbError(contractResult.error)
  if (!contractResult.data) return null
  const { contract_installments: installmentRows, financial_payments: paymentRows, ...joinedContract } =
    contractResult.data as unknown as EmbeddedContractRow
  const contract = toContract(joinedContract)
  const installments = arrayData<InstallmentRow>(installmentRows, 'Não foi possível carregar as parcelas.')
    .map(toInstallment)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
  const embeddedPayments = arrayData<EmbeddedPaymentRow>(paymentRows, 'Não foi possível carregar os pagamentos.')
  const payments = embeddedPayments
    .map(({ financial_payment_allocations: _allocations, ...payment }) => toPayment(payment))
    .sort((a, b) => b.received_at.localeCompare(a.received_at) || a.id.localeCompare(b.id))
  const allocations = embeddedPayments
    .flatMap((payment) => arrayData<AllocationRow>(
      payment.financial_payment_allocations, 'Não foi possível carregar as alocações.',
    ).map(toAllocation))
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
  const paymentById = new Map(payments.map((payment) => [payment.id, payment]))
  const allocated = new Map<string, number>()
  for (const allocation of allocations) {
    const payment = paymentById.get(allocation.payment_id)
    if (!payment) continue
    const signed = payment.type === 'receipt' ? allocation.amount_cents : -allocation.amount_cents
    const nextAllocated = (allocated.get(allocation.installment_id) ?? 0) + signed
    if (!Number.isSafeInteger(nextAllocated)) {
      throw new Error('Total financeiro excede o limite de centavos.')
    }
    allocated.set(allocation.installment_id, nextAllocated)
  }
  const today = getSaoPauloToday()
  const financialInstallments: InstallmentFinancial[] = installments.map((installment) => {
    const allocatedCents = allocated.get(installment.id) ?? 0
    return { ...installment, allocated_cents: allocatedCents, ...calculateInstallmentFinancial(
      installment.amount_cents, allocatedCents, installment.due_date, today,
    ) }
  })
  const pendingCents = calculateContractBalance(contract.total_value_cents, payments)
  return {
    contract, installments: financialInstallments, payments, allocations,
    receivedCents: contract.total_value_cents - pendingCents, pendingCents,
  }
}

export async function createContract(input: CreateContractInput): Promise<Contract> {
  const { data, error } = await requireSupabase().rpc('create_contract', {
    p_payload: {
      creation_key: input.creationKey, client_id: input.clientId, service: input.service.trim(),
      total_value: toMoneyDecimal(input.totalValueCents), contracted_at: input.contractedAt,
      due_date: input.dueDate, payment_method: input.paymentMethod.trim() || null,
      payment_terms: input.paymentTerms.trim() || null, notes: input.notes.trim() || null,
    },
  })
  throwDbError(error)
  const row = objectData<ContractRow>(data, 'Não foi possível salvar o contrato.')
  return toBaseContract(row)
}

export async function replaceInstallments(
  contractId: string,
  installments: Array<{ amountCents: number; dueDate: string; notes: string }>,
): Promise<Installment[]> {
  const { data, error } = await requireSupabase().rpc('replace_contract_installments', {
    p_contract_id: contractId,
    p_installments: installments.map((installment) => ({
      amount: toMoneyDecimal(installment.amountCents), due_date: installment.dueDate,
      notes: installment.notes.trim() || null,
    })),
  })
  throwDbError(error)
  return arrayData<InstallmentRow>(data, 'Não foi possível salvar as parcelas.').map(toInstallment)
}

export async function adjustContract(id: string, totalCents: number): Promise<Contract> {
  const { data, error } = await requireSupabase().rpc('adjust_contract', {
    p_contract_id: id, p_new_total: toMoneyDecimal(totalCents),
  })
  throwDbError(error)
  const row = objectData<ContractRow>(data, 'Não foi possível ajustar o contrato.')
  return toBaseContract(row)
}

export async function cancelContract(id: string): Promise<Contract> {
  const { data, error } = await requireSupabase().rpc('cancel_contract', { p_contract_id: id })
  throwDbError(error)
  const row = objectData<ContractRow>(data, 'Não foi possível cancelar o contrato.')
  return toBaseContract(row)
}

export async function recordPayment(contractId: string, input: PaymentInput): Promise<PaymentResult> {
  const { data, error } = await requireSupabase().rpc('record_payment', {
    p_payload: {
      contract_id: contractId, idempotency_key: input.idempotencyKey, type: input.type,
      amount: toMoneyDecimal(input.amountCents), received_at: input.receivedAt,
      payment_method: input.paymentMethod.trim() || null, notes: input.notes.trim() || null,
      related_payment_id: input.relatedPaymentId,
      allocations: input.allocations.map((allocation) => ({
        installment_id: allocation.installmentId, amount: toMoneyDecimal(allocation.amountCents),
      })),
    },
  })
  throwDbError(error)
  const row = objectData<PaymentRow & { allocations: AllocationRow[]; already_existed: boolean }>(
    data, 'Não foi possível registrar o pagamento.',
  )
  return {
    ...toPayment(row), allocations: arrayData<AllocationRow>(row.allocations, 'Não foi possível ler as alocações.').map(toAllocation),
    already_existed: row.already_existed === true,
  }
}
```

```ts
// src/services/expenseService.ts
import { requireSupabase, throwDbError } from '../lib/db'
import { fromMoneyDecimal, toMoneyDecimal } from '../lib/money'
import { getSaoPauloToday } from '../lib/finance'
import type {
  ExpenseCategory, ExpenseNotesInput, ExpenseStatus, ExpenseWrite, FinancialExpense,
} from '../types/finance'

type ExpenseRow = Omit<FinancialExpense, 'amount_cents'> & { amount: string | number }

export interface ExpenseFilters {
  status?: ExpenseStatus
  categoryId?: string
  projectId?: string
  contractId?: string
  startDate?: string
  endDate?: string
}

function arrayData<T>(data: unknown, message: string): T[] {
  if (!Array.isArray(data)) throw new Error(message)
  return data as T[]
}

function objectData<T>(data: unknown, message: string): T {
  const value = Array.isArray(data) ? data[0] : data
  if (!value || typeof value !== 'object') throw new Error(message)
  return value as T
}

function toExpense(row: ExpenseRow): FinancialExpense {
  const { amount, ...rest } = row
  return { ...rest, amount_cents: fromMoneyDecimal(amount) }
}

function payload(input: ExpenseWrite) {
  return {
    description: input.description.trim(), category_id: input.categoryId,
    amount: toMoneyDecimal(input.amountCents), expense_date: input.expenseDate,
    due_date: input.dueDate, project_id: input.projectId, contract_id: input.contractId,
    notes: input.notes.trim() || null,
  }
}

export async function listExpenses(filters: ExpenseFilters = {}): Promise<FinancialExpense[]> {
  let query = requireSupabase().from('financial_expenses').select('*').order('expense_date', { ascending: false }).order('id')
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.projectId) query = query.eq('project_id', filters.projectId)
  if (filters.contractId) query = query.eq('contract_id', filters.contractId)
  if (filters.startDate) query = query.gte('expense_date', filters.startDate)
  if (filters.endDate) query = query.lte('expense_date', filters.endDate)
  const { data, error } = await query
  throwDbError(error)
  return arrayData<ExpenseRow>(data, 'Não foi possível carregar as despesas.').map(toExpense)
}

export async function listOverdueExpenses(today = getSaoPauloToday()): Promise<FinancialExpense[]> {
  const { data, error } = await requireSupabase()
    .from('financial_expenses').select('*')
    .eq('status', 'pending').lt('due_date', today)
    .order('due_date').order('id')
  throwDbError(error)
  return arrayData<ExpenseRow>(data, 'Não foi possível carregar as despesas vencidas.').map(toExpense)
}

export async function listExpensesForClient(
  clientId: string,
  filters: ExpenseFilters = {},
): Promise<FinancialExpense[]> {
  const [projects, contracts] = await Promise.all([
    requireSupabase().from('projects').select('id').eq('client_id', clientId),
    requireSupabase().from('contracts').select('id').eq('client_id', clientId),
  ])
  throwDbError(projects.error)
  throwDbError(contracts.error)
  const projectIds = arrayData<{ id: string }>(projects.data, 'Não foi possível carregar os projetos.').map((row) => row.id)
  const contractIds = arrayData<{ id: string }>(contracts.data, 'Não foi possível carregar os contratos.').map((row) => row.id)
  const relations: string[] = []
  if (contractIds.length) relations.push(`contract_id.in.(${contractIds.join(',')})`)
  if (projectIds.length) relations.push(`project_id.in.(${projectIds.join(',')})`)
  if (!relations.length) return []
  let query = requireSupabase().from('financial_expenses').select('*').or(relations.join(','))
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.projectId) query = query.eq('project_id', filters.projectId)
  if (filters.contractId) query = query.eq('contract_id', filters.contractId)
  if (filters.startDate) query = query.gte('expense_date', filters.startDate)
  if (filters.endDate) query = query.lte('expense_date', filters.endDate)
  const { data, error } = await query.order('expense_date', { ascending: false }).order('id')
  throwDbError(error)
  return arrayData<ExpenseRow>(data, 'Não foi possível carregar as despesas do cliente.').map(toExpense)
}

export async function createExpense(input: ExpenseWrite): Promise<FinancialExpense> {
  const { data, error } = await requireSupabase().rpc('create_expense', { p_payload: payload(input) })
  throwDbError(error)
  return toExpense(objectData<ExpenseRow>(data, 'Não foi possível salvar a despesa.'))
}

export async function updateExpense(id: string, input: ExpenseWrite): Promise<FinancialExpense> {
  const { data, error } = await requireSupabase().rpc('update_expense', { p_expense_id: id, p_payload: payload(input) })
  throwDbError(error)
  return toExpense(objectData<ExpenseRow>(data, 'Não foi possível atualizar a despesa.'))
}

export async function updateExpenseNotes(id: string, input: ExpenseNotesInput): Promise<FinancialExpense> {
  const { data, error } = await requireSupabase().rpc('update_expense', {
    p_expense_id: id, p_payload: { notes: input.notes.trim() || null },
  })
  throwDbError(error)
  return toExpense(objectData<ExpenseRow>(data, 'Não foi possível atualizar as notas.'))
}

export async function payExpense(id: string, paidAt: string, method: string): Promise<FinancialExpense> {
  const { data, error } = await requireSupabase().rpc('pay_expense', {
    p_expense_id: id, p_payload: { paid_at: paidAt, payment_method: method.trim() || null },
  })
  throwDbError(error)
  return toExpense(objectData<ExpenseRow>(data, 'Não foi possível pagar a despesa.'))
}

export async function cancelExpense(id: string): Promise<FinancialExpense> {
  const { data, error } = await requireSupabase().rpc('cancel_expense', { p_expense_id: id })
  throwDbError(error)
  return toExpense(objectData<ExpenseRow>(data, 'Não foi possível cancelar a despesa.'))
}

export async function listCategories(includeArchived = false): Promise<ExpenseCategory[]> {
  let query = requireSupabase().from('expense_categories').select('*').order('name')
  if (!includeArchived) query = query.is('archived_at', null)
  const { data, error } = await query
  throwDbError(error)
  return arrayData<ExpenseCategory>(data, 'Não foi possível carregar as categorias.')
}

export async function createCategory(name: string): Promise<ExpenseCategory> {
  const { data, error } = await requireSupabase().rpc('create_expense_category', { p_name: name.trim() })
  throwDbError(error)
  return objectData<ExpenseCategory>(data, 'Não foi possível salvar a categoria.')
}

export async function archiveCategory(id: string): Promise<ExpenseCategory> {
  const { data, error } = await requireSupabase().rpc('archive_expense_category', { p_category_id: id })
  throwDbError(error)
  return objectData<ExpenseCategory>(data, 'Não foi possível arquivar a categoria.')
}
```

```ts
// src/services/financialService.ts
import { requireSupabase, throwDbError } from '../lib/db'
import type { CashFlowBucket, CashFlowGranularity, ExpenseCategoryTotal, FinancialSummary, UpcomingPayment } from '../types/finance'

const granularities: CashFlowGranularity[] = ['day', 'week', 'month', 'year']

function recordData(data: unknown, message: string): Record<string, unknown> {
  const value = Array.isArray(data) ? data[0] : data
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message)
  return value as Record<string, unknown>
}

function cents(value: unknown): number {
  // A RPC já retorna bigint; number só é aceito se representar exatamente o agregado.
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : Number.NaN
  if (!Number.isSafeInteger(parsed)) throw new Error('Resposta financeira inválida.')
  return parsed
}

function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Resposta financeira inválida.')
  return value
}

function dueItem(value: unknown): UpcomingPayment {
  const row = recordData(value, 'Vencimento financeiro inválido.')
  return {
    contract_id: text(row.contract_id), client_id: text(row.client_id),
    description: text(row.description), due_date: text(row.due_date), amount_cents: cents(row.amount_cents),
  }
}

function dueItems(value: unknown): UpcomingPayment[] {
  if (!Array.isArray(value)) throw new Error('Resposta financeira inválida.')
  return value.map(dueItem)
}

export async function getFinancialSummary(start: string, end: string): Promise<FinancialSummary> {
  const { data, error } = await requireSupabase().rpc('get_financial_summary', { p_start: start, p_end: end })
  throwDbError(error)
  const row = recordData(data, 'Não foi possível carregar o resumo financeiro.')
  return {
    contractedCents: cents(row.contracted_cents),
    receivedHistoricalCents: cents(row.received_historical_cents),
    pendingCents: cents(row.pending_cents),
    periodReceiptsCents: cents(row.period_receipts_cents),
    periodExpensesCents: cents(row.period_expenses_cents),
    periodProfitCents: cents(row.period_profit_cents),
    overdueCents: cents(row.overdue_cents),
    overdue: dueItems(row.overdue),
    upcoming: dueItems(row.upcoming),
  }
}

export async function getCashFlow(
  start: string,
  end: string,
  granularity: CashFlowGranularity,
): Promise<CashFlowBucket[]> {
  if (!granularities.includes(granularity)) throw new Error('Agrupamento de fluxo de caixa inválido.')
  const { data, error } = await requireSupabase().rpc('get_cash_flow', {
    p_start: start, p_end: end, p_bucket: granularity,
  })
  throwDbError(error)
  if (!Array.isArray(data)) throw new Error('Não foi possível carregar o fluxo de caixa.')
  return data.map((value) => {
    const row = recordData(value, 'Fluxo de caixa inválido.')
    return {
      label: text(row.label), receiptsCents: cents(row.receipts_cents),
      expensesCents: cents(row.expenses_cents), netCents: cents(row.net_cents),
      balanceCents: cents(row.balance_cents),
    }
  })
}

export async function getExpenseCategoryTotals(start: string, end: string): Promise<ExpenseCategoryTotal[]> {
  const { data, error } = await requireSupabase().rpc('get_expense_category_totals', { p_start: start, p_end: end })
  throwDbError(error)
  if (!Array.isArray(data)) throw new Error('Não foi possível carregar as despesas por categoria.')
  return data.map((value) => {
    const row = recordData(value, 'Despesa por categoria inválida.')
    return {
      categoryId: row.category_id === null ? null : text(row.category_id),
      name: text(row.name), amountCents: cents(row.amount_cents),
    }
  })
}
```

- [ ] **Etapa 4: Executar testes e build**

Comando: `npm test -- src/services/contractService.test.ts src/services/expenseService.test.ts src/services/financialService.test.ts && npm run build`
Esperado: testes passam e build termina com código 0.

- [ ] **Etapa 5: Criar commit**

```bash
git add src/services/contractService.ts src/services/contractService.test.ts src/services/expenseService.ts src/services/expenseService.test.ts src/services/financialService.ts src/services/financialService.test.ts
git commit -m "feat: adicionar servicos financeiros"
```

### Tarefa 9: Criar painel de contratos, parcelas e pagamento/estorno

**Arquivos:**
- Criar: `src/components/finance/PaymentDialog.tsx`
- Criar: `src/components/finance/PaymentDialog.test.tsx`
- Criar: `src/components/finance/InstallmentEditor.tsx`
- Criar: `src/components/finance/InstallmentEditor.test.tsx`
- Criar: `src/components/finance/ContractPanel.tsx`
- Criar: `src/components/finance/ContractPanel.test.tsx`

**Interfaces:**
- Consome: serviços de contrato, `ContractFinancials`, `ContractListItem`, `PaymentInput`, `PaymentResult`, `InstallmentFinancial`, `parseMoneyInput`, `toMoneyDecimal` e `formatMoney`.
- Produz: `PaymentDialog`, `InstallmentEditor` e `ContractPanel`.

- [ ] **Etapa 1: Escrever os testes de pagamento/estorno que falham**

```tsx
// src/components/finance/PaymentDialog.test.tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContractFinancials, ContractListItem, InstallmentFinancial } from '../../types/finance'

const mocks = vi.hoisted(() => ({ recordPayment: vi.fn() }))
vi.mock('../../services/contractService', () => ({ recordPayment: mocks.recordPayment }))

import { PaymentDialog } from './PaymentDialog'

const contract: ContractListItem = {
  id: 'contract-1', owner_id: 'owner', client_id: 'client-1', source_link_id: null,
  creation_key: null, service: 'Site', total_value_cents: 100000, contracted_at: '2026-11-01',
  due_date: '2026-12-01', payment_method: null, payment_terms: null, status: 'active',
  notes: null, cancelled_at: null, created_at: '', updated_at: '', client_name: 'Empresa A',
}

const installment = (id: string, position: number, amountCents: number, dueDate: string): InstallmentFinancial => ({
  id, owner_id: 'owner', contract_id: 'contract-1', position, amount_cents: amountCents,
  due_date: dueDate, notes: null, created_at: '', updated_at: '', allocated_cents: 0,
  remaining_cents: amountCents, status: 'pending',
})

const financials: ContractFinancials = {
  contract,
  installments: [installment('i1', 0, 60000, '2026-12-01'), installment('i2', 1, 40000, '2026-12-15')],
  payments: [], allocations: [], receivedCents: 0, pendingCents: 100000,
}

afterEach(cleanup)

describe('PaymentDialog', () => {
  beforeEach(() => mocks.recordPayment.mockReset())

  it('exige valor e não registra sem payload válido', async () => {
    render(<PaymentDialog open financials={financials} onClose={vi.fn()} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Registrar recebimento' }))
    expect((await screen.findByText('Informe um valor válido.')).textContent).toBe('Informe um valor válido.')
    expect(mocks.recordPayment).not.toHaveBeenCalled()
  })

  it('exige que as alocações somem o recebimento', async () => {
    render(<PaymentDialog open financials={financials} onClose={vi.fn()} onSaved={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Valor (R$) *'), { target: { value: '300,00' } })
    fireEvent.change(screen.getByLabelText('Alocação parcela 1'), { target: { value: '200,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar recebimento' }))
    expect((await screen.findByText('A soma das alocações deve ser igual ao valor do pagamento.')).textContent)
      .toBe('A soma das alocações deve ser igual ao valor do pagamento.')
    expect(mocks.recordPayment).not.toHaveBeenCalled()
  })

  it('congela payload e idempotency_key após falha e reutiliza no retry', async () => {
    mocks.recordPayment.mockRejectedValueOnce(new Error('Falha temporária.')).mockResolvedValueOnce({ id: 'payment-1' })
    const onSaved = vi.fn()
    const view = render(<PaymentDialog open financials={financials} onClose={vi.fn()} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText('Valor (R$) *'), { target: { value: '300,00' } })
    fireEvent.change(screen.getByLabelText('Alocação parcela 1'), { target: { value: '300,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar recebimento' }))
    expect((await screen.findByText('Falha temporária.')).textContent).toBe('Falha temporária.')
    expect((screen.getByLabelText('Valor (R$) *') as HTMLInputElement).disabled).toBe(true)
    view.rerender(<PaymentDialog open financials={financials} initialType="refund" onClose={vi.fn()} onSaved={onSaved} />)
    expect((screen.getByLabelText('Valor (R$) *') as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(mocks.recordPayment.mock.calls[0][1]).toEqual(mocks.recordPayment.mock.calls[1][1])
    expect(mocks.recordPayment.mock.calls[0][1].idempotencyKey).toBe(mocks.recordPayment.mock.calls[1][1].idempotencyKey)
  })

  it('renova a chave ao abrir nova ação', async () => {
    mocks.recordPayment.mockRejectedValueOnce(new Error('Falha temporária.')).mockResolvedValueOnce({ id: 'payment-2' })
    const view = render(<PaymentDialog open financials={financials} onClose={vi.fn()} onSaved={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Valor (R$) *'), { target: { value: '100,00' } })
    fireEvent.change(screen.getByLabelText('Alocação parcela 1'), { target: { value: '100,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar recebimento' }))
    await screen.findByText('Falha temporária.')
    const firstKey = mocks.recordPayment.mock.calls[0][1].idempotencyKey
    view.rerender(<PaymentDialog open={false} financials={financials} onClose={vi.fn()} onSaved={vi.fn()} />)
    view.rerender(<PaymentDialog open financials={financials} initialType="refund" onClose={vi.fn()} onSaved={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Valor (R$) *'), { target: { value: '100,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar estorno' }))
    await screen.findByText('Selecione o recebimento original.')
    expect(mocks.recordPayment).toHaveBeenCalledTimes(1)
    view.rerender(<PaymentDialog open={false} financials={financials} onClose={vi.fn()} onSaved={vi.fn()} />)
    view.rerender(<PaymentDialog open financials={financials} onClose={vi.fn()} onSaved={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Valor (R$) *'), { target: { value: '100,00' } })
    fireEvent.change(screen.getByLabelText('Alocação parcela 1'), { target: { value: '100,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar recebimento' }))
    await waitFor(() => expect(mocks.recordPayment).toHaveBeenCalledTimes(2))
    expect(mocks.recordPayment.mock.calls[1][1].idempotencyKey).not.toBe(firstKey)
  })

  it('estorno exige recebimento original e limita o valor', async () => {
    const withReceipt: ContractFinancials = {
      ...financials,
      payments: [{
        id: 'receipt-1', owner_id: 'owner', contract_id: 'contract-1', idempotency_key: 'key',
        related_payment_id: null, type: 'receipt', amount_cents: 30000,
        received_at: '2026-11-25T12:00:00-03:00', payment_method: 'pix', notes: null,
        created_by: 'owner', created_at: '',
      }],
      allocations: [{
        id: 'a1', owner_id: 'owner', contract_id: 'contract-1', payment_id: 'receipt-1',
        installment_id: 'i1', amount_cents: 30000, created_at: '',
      }],
    }
    render(<PaymentDialog open financials={withReceipt} initialType="refund" onClose={vi.fn()} onSaved={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Valor (R$) *'), { target: { value: '400,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar estorno' }))
    expect((await screen.findByText('O estorno não pode exceder o recebimento original.')).textContent)
      .toBe('O estorno não pode exceder o recebimento original.')
    expect(mocks.recordPayment).not.toHaveBeenCalled()
  })

  it('oferece no estorno a alocação líquida de parcela já quitada', async () => {
    const paidInstallment = { ...installment('i1', 0, 60000, '2026-11-20'), allocated_cents: 60000, remaining_cents: 0, status: 'paid' as const }
    const withReceipt: ContractFinancials = {
      ...financials,
      installments: [paidInstallment],
      payments: [{
        id: 'receipt-1', owner_id: 'owner', contract_id: 'contract-1', idempotency_key: 'key',
        related_payment_id: null, type: 'receipt', amount_cents: 60000,
        received_at: '2026-11-25T12:00:00-03:00', payment_method: 'pix', notes: null,
        created_by: 'owner', created_at: '',
      }],
      allocations: [{
        id: 'a1', owner_id: 'owner', contract_id: 'contract-1', payment_id: 'receipt-1',
        installment_id: 'i1', amount_cents: 60000, created_at: '',
      }],
    }
    render(<PaymentDialog open financials={withReceipt} initialType="refund" onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.queryByLabelText('Alocação parcela 1')).not.toBeNull()
  })
})
```

- [ ] **Etapa 2: Escrever os testes do editor de parcelas**

```tsx
// src/components/finance/InstallmentEditor.test.tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContractListItem, InstallmentFinancial } from '../../types/finance'

const mocks = vi.hoisted(() => ({ replaceInstallments: vi.fn() }))
vi.mock('../../services/contractService', () => ({ replaceInstallments: mocks.replaceInstallments }))

import { InstallmentEditor } from './InstallmentEditor'

const contract: ContractListItem = {
  id: 'contract-1', owner_id: 'owner', client_id: 'client-1', source_link_id: null,
  creation_key: null, service: 'Site', total_value_cents: 100000, contracted_at: '2026-11-01',
  due_date: '2026-12-01', payment_method: null, payment_terms: null, status: 'active',
  notes: null, cancelled_at: null, created_at: '', updated_at: '', client_name: 'Empresa A',
}
const installments: InstallmentFinancial[] = [{
  id: 'i1', owner_id: 'owner', contract_id: 'contract-1', position: 0, amount_cents: 100000,
  due_date: '2026-12-01', notes: null, created_at: '', updated_at: '', allocated_cents: 0,
  remaining_cents: 100000, status: 'pending',
}]

afterEach(cleanup)

describe('InstallmentEditor', () => {
  beforeEach(() => mocks.replaceInstallments.mockReset())

  it('bloqueia soma diferente do total', async () => {
    render(<InstallmentEditor open contract={contract} installments={installments} onClose={vi.fn()} onSaved={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Valor da parcela 1 (R$) *'), { target: { value: '900,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar parcelas' }))
    expect((await screen.findByText('A soma das parcelas deve ser igual ao valor do contrato.')).textContent)
      .toBe('A soma das parcelas deve ser igual ao valor do contrato.')
    const dialog = screen.getByRole('dialog', { name: 'Editar parcelas' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-describedby')).toBe('installment-editor-description installment-editor-error')
    expect(document.getElementById('installment-editor-description')?.textContent).toContain('Total:')
    expect(document.getElementById('installment-editor-error')).toBe(screen.getByRole('alert'))
    expect(mocks.replaceInstallments).not.toHaveBeenCalled()
  })

  it('salva valores em centavos e preserva erros do servidor', async () => {
    mocks.replaceInstallments.mockResolvedValue(installments)
    const onSaved = vi.fn()
    render(<InstallmentEditor open contract={contract} installments={installments} onClose={vi.fn()} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole('button', { name: 'Salvar parcelas' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(mocks.replaceInstallments).toHaveBeenCalledWith('contract-1', [
      { amountCents: 100000, dueDate: '2026-12-01', notes: '' },
    ])
  })

  it('remove a última parcela e envia array vazio', async () => {
    mocks.replaceInstallments.mockResolvedValue([])
    const onSaved = vi.fn()
    render(<InstallmentEditor open contract={contract} installments={installments} onClose={vi.fn()} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }))
    expect(screen.queryByLabelText('Valor da parcela 1 (R$) *')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar parcelas' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(mocks.replaceInstallments).toHaveBeenCalledWith('contract-1', [])
  })
})
```

- [ ] **Etapa 3: Executar os testes e confirmar o vermelho**

Comando: `npm test -- src/components/finance/PaymentDialog.test.tsx src/components/finance/InstallmentEditor.test.tsx`
Esperado: falha porque os componentes não existem.

- [ ] **Etapa 4: Implementar o diálogo de pagamento/estorno**

```tsx
// src/components/finance/PaymentDialog.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { recordPayment } from '../../services/contractService'
import { formatMoney, parseMoneyInput } from '../../lib/money'
import type { ContractFinancials, PaymentInput, PaymentResult } from '../../types/finance'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'

export interface PaymentDialogProps {
  open: boolean
  financials: ContractFinancials
  initialType?: PaymentInput['type']
  onClose: () => void
  onSaved: (payment: PaymentResult) => void
}

const receiptDateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' })

const saoPauloDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

function dateParts(date: Date): Record<string, string> {
  return Object.fromEntries(saoPauloDateTimeFormatter.formatToParts(date).map((part) => [part.type, part.value]))
}

function localDateTime(date: Date): string {
  const parts = dateParts(date)
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

function saoPauloDateTimeToIso(value: string): string {
  const naive = Date.parse(`${value}:00Z`)
  if (Number.isNaN(naive)) throw new Error('Informe uma data e hora válidas.')
  const parts = dateParts(new Date(naive))
  const represented = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`)
  return new Date(naive - (represented - naive)).toISOString()
}

function sumCents(values: number[]): number {
  let total = 0
  for (const value of values) {
    if (!Number.isSafeInteger(value)) throw new Error('Total financeiro excede o limite de centavos.')
    total += value
    if (!Number.isSafeInteger(total)) throw new Error('Total financeiro excede o limite de centavos.')
  }
  return total
}

export function PaymentDialog({ open, financials, initialType = 'receipt', onClose, onSaved }: PaymentDialogProps) {
  const [type, setType] = useState<PaymentInput['type']>(initialType)
  const [amount, setAmount] = useState('')
  const [receivedAt, setReceivedAt] = useState(() => localDateTime(new Date()))
  const [paymentMethod, setPaymentMethod] = useState('pix')
  const [notes, setNotes] = useState('')
  const [relatedPaymentId, setRelatedPaymentId] = useState('')
  const [allocationValues, setAllocationValues] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const idempotencyKeyRef = useRef('')
  const attemptRef = useRef<PaymentInput | null>(null)
  const actionContractRef = useRef('')
  const savingRef = useRef(false)
  const paymentsRef = useRef(financials.payments)
  paymentsRef.current = financials.payments

  useEffect(() => {
    if (!open) {
      attemptRef.current = null
      idempotencyKeyRef.current = ''
      actionContractRef.current = ''
      return
    }
    if (attemptRef.current && actionContractRef.current === financials.contract.id) return
    const receipts = paymentsRef.current.filter((payment) => payment.type === 'receipt')
    actionContractRef.current = financials.contract.id
    idempotencyKeyRef.current = crypto.randomUUID()
    attemptRef.current = null
    savingRef.current = false
    setType(initialType)
    setAmount('')
    setReceivedAt(localDateTime(new Date()))
    setPaymentMethod('pix')
    setNotes('')
    setRelatedPaymentId(initialType === 'refund' ? receipts[0]?.id ?? '' : '')
    setAllocationValues({})
    setError('')
    setSaving(false)
    setAttempted(false)
  }, [open, initialType, financials.contract.id])

  const receipts = useMemo(() => financials.payments.filter((payment) => payment.type === 'receipt'), [financials.payments])
  const paymentById = useMemo(() => new Map(financials.payments.map((payment) => [payment.id, payment])), [financials.payments])
  const selectedReceipt = receipts.find((payment) => payment.id === relatedPaymentId)
  const refundedTotal = selectedReceipt
    ? sumCents(financials.payments.filter((payment) => payment.type === 'refund' && payment.related_payment_id === selectedReceipt.id).map((payment) => payment.amount_cents))
    : 0
  const refundableByInstallment = useMemo(() => {
    const result = new Map<string, number>()
    if (!selectedReceipt) return result
    for (const allocation of financials.allocations) {
      if (allocation.payment_id !== selectedReceipt.id) continue
      result.set(allocation.installment_id, sumCents([result.get(allocation.installment_id) ?? 0, allocation.amount_cents]))
    }
    for (const allocation of financials.allocations) {
      const payment = paymentById.get(allocation.payment_id)
      if (payment?.type === 'refund' && payment.related_payment_id === selectedReceipt.id) {
        result.set(allocation.installment_id, sumCents([result.get(allocation.installment_id) ?? 0, -allocation.amount_cents]))
      }
    }
    return result
  }, [financials.allocations, paymentById, selectedReceipt])
  const availableInstallments = type === 'receipt'
    ? financials.installments.filter((installment) => installment.remaining_cents > 0)
    : financials.installments.filter((installment) => (refundableByInstallment.get(installment.id) ?? 0) > 0)

  function changeType(nextType: PaymentInput['type']) {
    if (attempted || saving) return
    idempotencyKeyRef.current = crypto.randomUUID()
    attemptRef.current = null
    setType(nextType)
    setAmount('')
    setRelatedPaymentId(nextType === 'refund' ? receipts[0]?.id ?? '' : '')
    setAllocationValues({})
    setError('')
  }

  function buildPayload(): PaymentInput {
    const amountCents = parseMoneyInput(amount)
    if (amountCents === null || amountCents <= 0) throw new Error('Informe um valor válido.')
    const receivedAtIso = saoPauloDateTimeToIso(receivedAt)
    if (type === 'receipt' && amountCents > financials.pendingCents) throw new Error('O recebimento excede o saldo contratado.')
    if (type === 'refund') {
      if (!selectedReceipt) throw new Error('Selecione o recebimento original.')
      if (amountCents > selectedReceipt.amount_cents - refundedTotal) {
        throw new Error('O estorno não pode exceder o recebimento original.')
      }
    }
    const allocations: PaymentInput['allocations'] = []
    if (financials.installments.length > 0) {
      const allocationAmounts: number[] = []
      for (const installment of availableInstallments) {
        const raw = allocationValues[installment.id] ?? ''
        const allocated = raw.trim() ? parseMoneyInput(raw) : 0
        if (allocated === null || allocated < 0) throw new Error('Alocação inválida.')
        const limit = type === 'receipt' ? installment.remaining_cents : refundableByInstallment.get(installment.id) ?? 0
        if (allocated > limit) {
          throw new Error(type === 'receipt' ? 'A alocação excede o saldo da parcela.' : 'O estorno excede o valor alocado à parcela.')
        }
        allocationAmounts.push(allocated)
        if (allocated > 0) allocations.push({ installmentId: installment.id, amountCents: allocated })
      }
      if (sumCents(allocationAmounts) !== amountCents) throw new Error('A soma das alocações deve ser igual ao valor do pagamento.')
    }
    return {
      idempotencyKey: idempotencyKeyRef.current, type, amountCents,
      receivedAt: receivedAtIso, paymentMethod, notes,
      relatedPaymentId: type === 'refund' ? relatedPaymentId : null, allocations,
    }
  }

  async function execute(payload: PaymentInput) {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      const result = await recordPayment(financials.contract.id, payload)
      onSaved(result)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registrar o pagamento.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  async function submit() {
    if (savingRef.current) return
    if (attemptRef.current) {
      await execute(attemptRef.current)
      return
    }
    try {
      const payload = buildPayload()
      attemptRef.current = payload
      setAttempted(true)
      await execute(payload)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registrar o pagamento.')
    }
  }

  if (!open) return null
  const disabled = saving || attempted
  const title = type === 'receipt' ? 'Registrar recebimento' : 'Registrar estorno'
  return (
    <Modal open onClose={onClose} title={title} wide dismissible={!saving}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <Select
          label="Tipo"
          value={type}
          disabled={disabled}
          onChange={(event) => changeType(event.target.value as PaymentInput['type'])}
          options={[
            { value: 'receipt', label: 'Recebimento' },
            { value: 'refund', label: 'Estorno' },
          ]}
        />
        {type === 'refund' && <Select
          label="Recebimento original"
          placeholder="Selecione"
          value={relatedPaymentId}
          disabled={disabled}
          onChange={(event) => { setRelatedPaymentId(event.target.value); setAllocationValues({}); setError('') }}
          options={receipts.map((payment) => ({
            value: payment.id,
            label: `${receiptDateFormatter.format(new Date(payment.received_at))} — ${formatMoney(payment.amount_cents)}`,
          }))}
        />}
        <Input label="Valor (R$) *" inputMode="decimal" value={amount} disabled={disabled} onChange={(event) => setAmount(event.target.value)} />
        <Input label="Data e hora *" type="datetime-local" value={receivedAt} disabled={disabled} onChange={(event) => setReceivedAt(event.target.value)} />
        <Select
          label="Forma de pagamento"
          value={paymentMethod}
          disabled={disabled}
          onChange={(event) => setPaymentMethod(event.target.value)}
          options={[
            { value: 'pix', label: 'Pix' },
            { value: 'cartao', label: 'Cartão' },
            { value: 'dinheiro', label: 'Dinheiro' },
            { value: 'transferencia', label: 'Transferência' },
          ]}
        />
        {availableInstallments.map((installment) => {
          const helpId = `payment-allocation-${installment.id}-help`
          const limit = type === 'receipt' ? installment.remaining_cents : refundableByInstallment.get(installment.id) ?? 0
          return <div key={installment.id}>
            <Input
              label={`Alocação parcela ${installment.position + 1}`}
              inputMode="decimal"
              value={allocationValues[installment.id] ?? ''}
              disabled={disabled}
              aria-describedby={helpId}
              onChange={(event) => setAllocationValues((current) => ({ ...current, [installment.id]: event.target.value }))}
            />
            <p id={helpId} className="mt-1 text-xs text-muted">
              {type === 'receipt' ? 'Saldo disponível' : 'Estornável'}: {formatMoney(limit)}
            </p>
          </div>
        })}
        <Textarea label="Notas" value={notes} disabled={disabled} onChange={(event) => setNotes(event.target.value)} />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            {saving ? 'Salvando...' : attempted ? 'Tentar novamente' : title}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Etapa 5: Implementar o editor de parcelas**

```tsx
// src/components/finance/InstallmentEditor.tsx
import { useEffect, useState } from 'react'
import { replaceInstallments } from '../../services/contractService'
import { parseMoneyInput, toMoneyDecimal } from '../../lib/money'
import { getSaoPauloToday } from '../../lib/finance'
import type { ContractListItem, InstallmentFinancial } from '../../types/finance'

export interface InstallmentEditorProps {
  open: boolean
  contract: ContractListItem
  installments: InstallmentFinancial[]
  onClose: () => void
  onSaved: () => void
}

interface Row { amount: string; dueDate: string; notes: string }
const fieldClass = 'w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-ink'

export function InstallmentEditor({ open, contract, installments, onClose, onSaved }: InstallmentEditorProps) {
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setRows(installments.length ? installments.map((installment) => ({
      amount: toMoneyDecimal(installment.amount_cents).replace('.', ','),
      dueDate: installment.due_date, notes: installment.notes ?? '',
    })) : [{ amount: toMoneyDecimal(contract.total_value_cents).replace('.', ','), dueDate: contract.due_date ?? getSaoPauloToday(), notes: '' }])
    setError('')
  }, [open, contract.id, contract.due_date, contract.total_value_cents, installments])

  function update(index: number, patch: Partial<Row>) {
    setRows((current) => current.map((row, position) => position === index ? { ...row, ...patch } : row))
  }

  async function save() {
    if (saving) return
    const parsed = rows.map((row) => ({ ...row, cents: parseMoneyInput(row.amount) }))
    if (parsed.some((row) => row.cents === null || row.cents <= 0 || !row.dueDate)) {
      setError('Informe valor positivo e vencimento em cada parcela.')
      return
    }
    if (parsed.length > 0 && parsed.reduce((total, row) => total + (row.cents ?? 0), 0) !== contract.total_value_cents) {
      setError('A soma das parcelas deve ser igual ao valor do contrato.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await replaceInstallments(contract.id, parsed.map((row) => ({ amountCents: row.cents ?? 0, dueDate: row.dueDate, notes: row.notes })))
      onSaved()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar as parcelas.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4">
      <form role="dialog" aria-modal="true" aria-label="Editar parcelas"
        aria-describedby={error ? 'installment-editor-description installment-editor-error' : 'installment-editor-description'}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-line bg-surface p-6"
        onSubmit={(event) => { event.preventDefault(); void save() }}>
        <h2 className="text-lg font-semibold text-ink">Parcelas de {contract.service}</h2>
        <p id="installment-editor-description" className="mt-1 text-sm text-muted">Total: R$ {(contract.total_value_cents / 100).toFixed(2).replace('.', ',')}</p>
        <div className="mt-4 space-y-3">
          {rows.map((row, index) => <div key={index} className="grid gap-2 rounded-lg border border-line p-3 md:grid-cols-[1fr_1fr_2fr_auto]">
            <label className="text-xs text-muted">Valor da parcela {index + 1} (R$) *
              <input className={fieldClass} inputMode="decimal" value={row.amount} onChange={(event) => update(index, { amount: event.target.value })} />
            </label>
            <label className="text-xs text-muted">Vencimento *
              <input type="date" className={fieldClass} value={row.dueDate} onChange={(event) => update(index, { dueDate: event.target.value })} />
            </label>
            <label className="text-xs text-muted">Notas
              <input className={fieldClass} value={row.notes} onChange={(event) => update(index, { notes: event.target.value })} />
            </label>
            <button type="button" className="self-end rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger"
              onClick={() => setRows((current) => current.filter((_, position) => position !== index))}>Remover</button>
          </div>)}
        </div>
        <button type="button" className="mt-3 rounded-lg border border-line px-3 py-2 text-sm text-ink"
          onClick={() => setRows((current) => [...current, { amount: '', dueDate: contract.due_date ?? getSaoPauloToday(), notes: '' }])}>Adicionar parcela</button>
        {error && <p id="installment-editor-error" role="alert" className="mt-4 text-sm text-danger">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="rounded-lg border border-line px-4 py-2 text-sm" onClick={onClose}>Fechar</button>
          <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-bg" disabled={saving}>{saving ? 'Salvando...' : 'Salvar parcelas'}</button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Etapa 6: Escrever o teste do painel de contratos**

```tsx
// src/components/finance/ContractPanel.test.tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContractFinancials, ContractListItem } from '../../types/finance'

const mocks = vi.hoisted(() => ({
  listContracts: vi.fn(), getContractFinancials: vi.fn(), createContract: vi.fn(),
  adjustContract: vi.fn(), cancelContract: vi.fn(), recordPayment: vi.fn(), replaceInstallments: vi.fn(),
}))
vi.mock('../../services/contractService', () => mocks)

import { ContractPanel } from './ContractPanel'

const contract: ContractListItem = {
  id: 'contract-1', owner_id: 'owner', client_id: 'client-1', source_link_id: null,
  creation_key: null, service: 'Site', total_value_cents: 100000, contracted_at: '2026-11-01',
  due_date: '2026-12-01', payment_method: null, payment_terms: null, status: 'active',
  notes: null, cancelled_at: null, created_at: '', updated_at: '', client_name: 'Empresa A',
}
const financials: ContractFinancials = {
  contract, installments: [], payments: [], allocations: [], receivedCents: 30000, pendingCents: 70000,
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise })
  return { promise, resolve, reject }
}

afterEach(cleanup)

describe('ContractPanel', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.getContractFinancials.mockResolvedValue(financials)
  })

  it('mostra contratado, recebido e pendente separadamente', async () => {
    render(<ContractPanel contracts={[contract]} />)
    await screen.findByText('R$ 300,00')
    expect(screen.getByText('Site').textContent).toBe('Site')
    expect(screen.getByText('R$ 1.000,00').textContent).toBe('R$ 1.000,00')
    expect(screen.getByText('R$ 700,00').textContent).toBe('R$ 700,00')
    expect(mocks.getContractFinancials).toHaveBeenCalledWith('contract-1')
  })

  it('contrato cancelado permanece leitura e sem ações de recebimento', async () => {
    render(<ContractPanel contracts={[{ ...contract, status: 'cancelled' }]} />)
    await screen.findByText('Cancelado')
    expect(screen.queryByRole('button', { name: 'Receber' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancelar contrato' })).toBeNull()
  })

  it('preserva o último snapshot e exibe erro inline quando o refresh falha', async () => {
    mocks.getContractFinancials.mockResolvedValueOnce(financials).mockRejectedValueOnce(new Error('Falha de refresh'))
    const view = render(<ContractPanel contracts={[contract]} />)
    await screen.findByText('R$ 300,00')
    view.rerender(<ContractPanel contracts={[contract]} />)
    expect((await screen.findByRole('alert')).textContent).toContain('Falha de refresh')
    expect(screen.getByText('Site')).not.toBeNull()
    expect(screen.getByText('R$ 300,00')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(screen.getByText('R$ 300,00')).not.toBeNull()
  })

  it('descarta resposta obsoleta de contrato anterior', async () => {
    const other = { ...contract, id: 'contract-2', service: 'Outro', client_name: 'Empresa B' }
    const otherFinancials = { ...financials, contract: other }
    const first = deferred<ContractFinancials | null>()
    const second = deferred<ContractFinancials | null>()
    mocks.getContractFinancials.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const view = render(<ContractPanel contracts={[contract]} />)
    await waitFor(() => expect(mocks.getContractFinancials).toHaveBeenCalledWith('contract-1'))
    view.rerender(<ContractPanel contracts={[other]} />)
    await waitFor(() => expect(mocks.getContractFinancials).toHaveBeenCalledWith('contract-2'))
    await act(async () => { second.resolve(otherFinancials); await second.promise })
    expect(await screen.findByText('Outro')).not.toBeNull()
    await act(async () => { first.resolve(financials); await first.promise })
    expect(screen.queryByText('Site')).toBeNull()
    expect(screen.getByText('Outro')).not.toBeNull()
  })

  it('vincula descrições e alertas dos diálogos de contrato', async () => {
    render(<ContractPanel contracts={[contract]} clientId="client-1" clientName="Empresa A" />)
    await screen.findByText('R$ 300,00')

    fireEvent.click(screen.getByRole('button', { name: 'Ajustar total' }))
    fireEvent.change(screen.getByLabelText('Novo total (R$) *'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar ajuste' }))
    let dialog = screen.getByRole('dialog', { name: 'Ajustar total do contrato' })
    expect(dialog.getAttribute('aria-describedby')).toBe('adjust-contract-description adjust-contract-error')
    expect(document.getElementById('adjust-contract-description')?.textContent).toContain('Recebido líquido atual:')
    expect(document.getElementById('adjust-contract-error')).toBe(screen.getByRole('alert'))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar contrato' }))
    dialog = screen.getByRole('dialog', { name: 'Cancelar contrato' })
    expect(dialog.getAttribute('aria-describedby')).toBe('cancel-contract-description')
    expect(document.getElementById('cancel-contract-description')?.textContent).toContain('Recebimentos e estornos históricos permanecem.')
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))

    fireEvent.click(screen.getByRole('button', { name: 'Novo contrato' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar contrato' }))
    dialog = screen.getByRole('dialog', { name: 'Novo contrato' })
    expect(dialog.getAttribute('aria-describedby')).toBe('new-contract-error')
    expect(document.getElementById('new-contract-error')).toBe(screen.getByRole('alert'))
  })
})
```

- [ ] **Etapa 7: Implementar o painel de contratos**

```tsx
// src/components/finance/ContractPanel.tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { requireSupabase, throwDbError } from '../../lib/db'
import { formatMoney, parseMoneyInput, toMoneyDecimal } from '../../lib/money'
import { getSaoPauloToday } from '../../lib/finance'
import {
  adjustContract, cancelContract, createContract, getContractFinancials, listContracts,
} from '../../services/contractService'
import type { ContractFinancials, ContractListItem, CreateContractInput, PaymentInput } from '../../types/finance'
import { InstallmentEditor } from './InstallmentEditor'
import { PaymentDialog } from './PaymentDialog'

export interface ContractPanelProps {
  clientId?: string
  clientName?: string
  contracts?: ContractListItem[]
  onChanged?: () => void | Promise<void>
}

const fieldClass = 'w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-ink'

export function ContractPanel({ clientId, clientName, contracts, onChanged }: ContractPanelProps) {
  const [items, setItems] = useState<ContractListItem[]>(contracts ?? [])
  const [financials, setFinancials] = useState<Record<string, ContractFinancials>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [editorId, setEditorId] = useState<string | null>(null)
  const [adjusting, setAdjusting] = useState<ContractFinancials | null>(null)
  const [cancelling, setCancelling] = useState<ContractFinancials | null>(null)
  const [payment, setPayment] = useState<{ financials: ContractFinancials; type: PaymentInput['type'] } | null>(null)
  const requestVersion = useRef(0)
  const activeRef = useRef(true)

  const load = useCallback(async () => {
    const version = ++requestVersion.current
    setLoading(true)
    setError('')
    try {
      const next = contracts ?? await listContracts(clientId ? { clientId } : {})
      const entries = await Promise.all(next.map(async (contract) => [contract.id, await getContractFinancials(contract.id)] as const))
      if (!activeRef.current || version !== requestVersion.current) return
      setItems(next)
      setFinancials(Object.fromEntries(entries.filter((entry): entry is readonly [string, ContractFinancials] => entry[1] !== null)))
    } catch (cause) {
      if (!activeRef.current || version !== requestVersion.current) return
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os contratos.')
    } finally {
      if (activeRef.current && version === requestVersion.current) setLoading(false)
    }
  }, [clientId, contracts])

  useEffect(() => {
    activeRef.current = true
    void load()
    return () => {
      activeRef.current = false
      requestVersion.current += 1
    }
  }, [load])

  async function refresh() {
    await load()
    await onChanged?.()
  }

  if (loading && !items.length) return <p className="py-6 text-sm text-muted">Carregando contratos...</p>
  return (
    <section className="space-y-4" aria-busy={loading}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Contratos</h2>
        <button type="button" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-bg" onClick={() => setNewOpen(true)}>Novo contrato</button>
      </div>
      {loading && items.length > 0 && <p role="status" className="text-sm text-muted">Atualizando contratos...</p>}
      {error && <div role="alert" className="rounded-lg border border-danger/40 p-4 text-sm text-danger">{error}<button type="button" className="ml-3 underline" onClick={() => void load()}>Tentar novamente</button></div>}
      {!loading && !error && !items.length && <p className="rounded-lg border border-line p-6 text-sm text-muted">Nenhum contrato cadastrado.</p>}
      {items.map((contract) => {
        const detail = financials[contract.id]
        return <article key={contract.id} className="rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="font-semibold text-ink">{contract.service}</h3><p className="text-sm text-muted">{contract.client_name} · {contract.status === 'active' ? 'Ativo' : 'Cancelado'}</p></div>
            <span className="text-sm text-muted">Vencimento: {contract.due_date ?? 'Sem vencimento geral'}</span>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div><dt className="text-xs text-muted">Contratado</dt><dd className="text-ink">{formatMoney(contract.total_value_cents)}</dd></div>
            <div><dt className="text-xs text-muted">Recebido líquido</dt><dd className="text-ink">{formatMoney(detail?.receivedCents ?? 0)}</dd></div>
            <div><dt className="text-xs text-muted">Pendente</dt><dd className="text-ink">{formatMoney(detail?.pendingCents ?? 0)}</dd></div>
          </dl>
          {detail && detail.installments.length > 0 && <div className="mt-4 space-y-2">
            {detail.installments.map((installment) => <div key={installment.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-elevated/60 px-3 py-2 text-sm">
              <span>Parcela {installment.position + 1} · {installment.due_date}</span>
              <span className="text-muted">{formatMoney(installment.remaining_cents)} · {installment.status === 'paid' ? 'Paga' : installment.status === 'overdue' ? 'Atrasada' : installment.status === 'partial' ? 'Parcial' : 'Pendente'}</span>
            </div>)}
          </div>}
          {detail && detail.payments.length > 0 && <div className="mt-4 space-y-2">
            <h4 className="text-sm font-semibold text-muted">Pagamentos</h4>
            {detail.payments.map((item) => <div key={item.id} className="flex justify-between gap-3 text-sm text-muted">
              <span>{new Date(item.received_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · {item.type === 'receipt' ? 'Recebimento' : 'Estorno'}</span>
              <span>{item.type === 'receipt' ? '+' : '−'}{formatMoney(item.amount_cents)}</span>
            </div>)}
          </div>}
          {contract.status === 'active' && detail && <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => setEditorId(contract.id)}>Parcelas</button>
            <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => setAdjusting(detail)}>Ajustar total</button>
            <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => setPayment({ financials: detail, type: 'receipt' })}>Receber</button>
            <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => setPayment({ financials: detail, type: 'refund' })}>Estornar</button>
            <button type="button" className="rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger" onClick={() => setCancelling(detail)}>Cancelar contrato</button>
          </div>}
        </article>
      })}
      <NewContractDialog open={newOpen} clientId={clientId} clientName={clientName} onClose={() => setNewOpen(false)} onSaved={() => void refresh()} />
      {editorId && financials[editorId] && <InstallmentEditor open contract={financials[editorId].contract} installments={financials[editorId].installments}
        onClose={() => setEditorId(null)} onSaved={() => void refresh()} />}
      {adjusting && <AdjustContractDialog financials={adjusting} onClose={() => setAdjusting(null)} onSaved={() => void refresh()} />}
      {cancelling && <ConfirmContractCancel financials={cancelling} onClose={() => setCancelling(null)} onSaved={() => void refresh()} />}
      {payment && <PaymentDialog open financials={payment.financials} initialType={payment.type} onClose={() => setPayment(null)} onSaved={() => void refresh()} />}
    </section>
  )
}

function AdjustContractDialog({ financials, onClose, onSaved }: { financials: ContractFinancials; onClose: () => void; onSaved: () => void }) {
  const [total, setTotal] = useState(toMoneyDecimal(financials.contract.total_value_cents).replace('.', ','))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function save() {
    const cents = parseMoneyInput(total)
    if (cents === null) { setError('Informe um valor válido.'); return }
    setSaving(true)
    setError('')
    try { await adjustContract(financials.contract.id, cents); onSaved(); onClose() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível ajustar o contrato.') }
    finally { setSaving(false) }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4">
    <form role="dialog" aria-modal="true" aria-label="Ajustar total do contrato"
      aria-describedby={error ? 'adjust-contract-description adjust-contract-error' : 'adjust-contract-description'}
      className="w-full max-w-md rounded-xl border border-line bg-surface p-6"
      onSubmit={(event) => { event.preventDefault(); void save() }}>
      <h2 className="text-lg font-semibold">Ajustar total do contrato</h2>
      <label className="mt-4 block text-sm text-muted">Novo total (R$) *
        <input className={fieldClass} inputMode="decimal" value={total} onChange={(event) => setTotal(event.target.value)} />
      </label>
      <p id="adjust-contract-description" className="mt-2 text-xs text-muted">Recebido líquido atual: {formatMoney(financials.receivedCents)}</p>
      {error && <p id="adjust-contract-error" role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-6 flex justify-end gap-2"><button type="button" className="rounded-lg border border-line px-4 py-2 text-sm" onClick={onClose}>Fechar</button>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-bg" disabled={saving}>{saving ? 'Salvando...' : 'Salvar ajuste'}</button></div>
    </form>
  </div>
}

function ConfirmContractCancel({ financials, onClose, onSaved }: { financials: ContractFinancials; onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function confirm() {
    setSaving(true)
    setError('')
    try { await cancelContract(financials.contract.id); onSaved(); onClose() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível cancelar o contrato.') }
    finally { setSaving(false) }
  }
  return <div role="dialog" aria-modal="true" aria-label="Cancelar contrato"
    aria-describedby={error ? 'cancel-contract-description cancel-contract-error' : 'cancel-contract-description'}
    className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4">
    <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold">Cancelar contrato</h2>
      <p id="cancel-contract-description" className="mt-2 text-sm text-muted">O contrato sai dos totais ativos. Recebimentos e estornos históricos permanecem.</p>
      {error && <p id="cancel-contract-error" role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-6 flex justify-end gap-2"><button type="button" className="rounded-lg border border-line px-4 py-2 text-sm" onClick={onClose}>Voltar</button>
        <button type="button" className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-bg" disabled={saving} onClick={() => void confirm()}>{saving ? 'Cancelando...' : 'Confirmar cancelamento'}</button></div>
    </div>
  </div>
}

function NewContractDialog({ open, clientId, clientName, onClose, onSaved }: { open: boolean; clientId?: string; clientName?: string; onClose: () => void; onSaved: () => void }) {
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([])
  const [selectedClient, setSelectedClient] = useState(clientId ?? '')
  const [service, setService] = useState('')
  const [total, setTotal] = useState('')
  const [contractedAt, setContractedAt] = useState(getSaoPauloToday())
  const [dueDate, setDueDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('pix')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const creationKeyRef = useRef('')

  useEffect(() => {
    if (!open) return
    creationKeyRef.current = crypto.randomUUID()
    setSelectedClient(clientId ?? '')
    setService(''); setTotal(''); setContractedAt(getSaoPauloToday()); setDueDate('')
    setPaymentMethod('pix'); setPaymentTerms(''); setNotes(''); setError('')
    if (clientId && clientName) { setClients([{ id: clientId, name: clientName }]); return }
    void requireSupabase().from('clients').select('id,name').eq('status', 'active').order('name').then(({ data, error: cause }) => {
      throwDbError(cause)
      if (!Array.isArray(data)) throw new Error('Não foi possível carregar os clientes.')
      setClients(data as Array<{ id: string; name: string }>)
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os clientes.'))
  }, [open, clientId])

  async function save() {
    const cents = parseMoneyInput(total)
    if (!selectedClient || !service.trim() || cents === null || !contractedAt) { setError('Informe cliente, serviço, valor e data da contratação.'); return }
    if (dueDate && dueDate < contractedAt) { setError('O vencimento não pode anteceder a contratação.'); return }
    setSaving(true); setError('')
    const input: CreateContractInput = {
      creationKey: creationKeyRef.current, clientId: selectedClient, service, totalValueCents: cents,
      contractedAt, dueDate: dueDate || null, paymentMethod, paymentTerms, notes,
    }
    try { await createContract(input); onSaved(); onClose() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o contrato.') }
    finally { setSaving(false) }
  }

  if (!open) return null
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4">
    <form role="dialog" aria-modal="true" aria-label="Novo contrato" aria-describedby={error ? 'new-contract-error' : undefined}
      className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-line bg-surface p-6"
      onSubmit={(event) => { event.preventDefault(); void save() }}>
      <h2 className="text-lg font-semibold">Novo contrato</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm text-muted">Cliente *
          <select className={fieldClass} value={selectedClient} disabled={Boolean(clientId)} onChange={(event) => setSelectedClient(event.target.value)}>
            <option value="">Selecione</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-muted">Serviço *<input className={fieldClass} value={service} onChange={(event) => setService(event.target.value)} /></label>
        <label className="text-sm text-muted">Valor total (R$) *<input className={fieldClass} inputMode="decimal" value={total} onChange={(event) => setTotal(event.target.value)} /></label>
        <label className="text-sm text-muted">Data da contratação *<input type="date" className={fieldClass} value={contractedAt} onChange={(event) => setContractedAt(event.target.value)} /></label>
        <label className="text-sm text-muted">Vencimento geral<input type="date" className={fieldClass} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
        <label className="text-sm text-muted">Forma de pagamento<select className={fieldClass} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="pix">Pix</option><option value="cartao">Cartão</option><option value="transferencia">Transferência</option></select></label>
        <label className="text-sm text-muted">Condições de pagamento<input className={fieldClass} value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} /></label>
        <label className="text-sm text-muted md:col-span-2">Notas<textarea className={fieldClass} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      </div>
      {error && <p id="new-contract-error" role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-6 flex justify-end gap-2"><button type="button" className="rounded-lg border border-line px-4 py-2 text-sm" onClick={onClose}>Fechar</button>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-bg" disabled={saving}>{saving ? 'Salvando...' : 'Salvar contrato'}</button></div>
    </form>
  </div>
}
```

- [ ] **Etapa 8: Executar testes e build**

Comando: `npm test -- src/components/finance/PaymentDialog.test.tsx src/components/finance/InstallmentEditor.test.tsx src/components/finance/ContractPanel.test.tsx && npm run build`
Esperado: testes passam e build termina com código 0.

- [ ] **Etapa 9: Criar commit**

```bash
git add src/components/finance/ContractPanel.tsx src/components/finance/ContractPanel.test.tsx src/components/finance/InstallmentEditor.tsx src/components/finance/InstallmentEditor.test.tsx src/components/finance/PaymentDialog.tsx src/components/finance/PaymentDialog.test.tsx
git commit -m "feat: adicionar painel de contratos e pagamentos"
```

---

### Tarefa 10: Despesas, categorias e ações de baixa

**Arquivos:**
- Criar: `src/components/finance/ExpenseForm.tsx`
- Criar: `src/components/finance/ExpenseForm.test.tsx`
- Criar: `src/components/finance/ExpensePanel.tsx`
- Criar: `src/components/finance/ExpensePanel.test.tsx`
- Criar: `src/components/finance/CategoryManager.tsx`
- Criar: `src/components/finance/CategoryManager.test.tsx`

**Interfaces:**
- Consome: `ExpenseCategory`, `ExpenseNotesInput`, `ExpenseWrite`, `FinancialExpense`, `ExpenseStatus`, `parseMoneyInput`, `toMoneyDecimal`, `getSaoPauloToday`, serviços da Tarefa 8, `requireSupabase`/`throwDbError` para as opções de projetos e `listContracts`.
- Produz: `ExpenseProjectOption`, `ExpenseContractOption`, `ExpenseFormProps`, `ExpensePanelProps` e `CategoryManagerProps`.
- Não permite editar valor/data/status de despesa paga ou cancelada; a única ação desses registros é salvar notas complementares.

- [ ] **Etapa 1: Escrever testes que falham**

```tsx
// src/components/finance/ExpenseForm.test.tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExpenseCategory, FinancialExpense } from '../../types/finance'

const mocks = vi.hoisted(() => ({ createExpense: vi.fn(), updateExpense: vi.fn(), updateExpenseNotes: vi.fn() }))
vi.mock('../../services/expenseService', () => mocks)
import { ExpenseForm } from './ExpenseForm'

const category: ExpenseCategory = { id: 'cat-1', owner_id: 'owner', name: 'Hospedagem', archived_at: null, created_at: '', updated_at: '' }
const paid: FinancialExpense = {
  id: 'expense-1', owner_id: 'owner', description: 'Servidor', category_id: 'cat-1', amount_cents: 1250,
  expense_date: '2026-11-01', due_date: '2026-11-02', paid_at: '2026-11-02', payment_method: 'pix', status: 'paid',
  project_id: null, contract_id: null, notes: '', cancelled_at: null, created_at: '', updated_at: '',
}
afterEach(cleanup)

describe('ExpenseForm', () => {
  beforeEach(() => Object.values(mocks).forEach((mock) => mock.mockReset()))

  it('cria despesa pendente com categoria e valor em centavos', async () => {
    mocks.createExpense.mockResolvedValue({ ...paid, status: 'pending' })
    render(<ExpenseForm open categories={[category]} projects={[]} contracts={[]} onClose={vi.fn()} onSaved={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Domínio' } })
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'cat-1' } })
    fireEvent.change(screen.getByLabelText('Valor (R$) *'), { target: { value: '12,50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar despesa' }))
    await waitFor(() => expect(mocks.createExpense).toHaveBeenCalledWith(expect.objectContaining({ description: 'Domínio', categoryId: 'cat-1', amountCents: 1250 })))
  })

  it('despesa paga expõe somente notas e chama updateExpenseNotes', async () => {
    mocks.updateExpenseNotes.mockResolvedValue({ ...paid, notes: 'Nota fiscal recebida' })
    render(<ExpenseForm open expense={paid} categories={[category]} projects={[]} contracts={[]} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.queryByLabelText('Valor (R$) *')).toBeNull()
    expect(screen.queryByLabelText('Data da despesa *')).toBeNull()
    fireEvent.change(screen.getByLabelText('Notas complementares'), { target: { value: 'Nota fiscal recebida' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar notas' }))
    await waitFor(() => expect(mocks.updateExpenseNotes).toHaveBeenCalledWith('expense-1', { notes: 'Nota fiscal recebida' }))
    expect(mocks.updateExpense).not.toHaveBeenCalled()
  })

  it('vincula a descrição e o alerta do formulário de despesa paga', async () => {
    mocks.updateExpenseNotes.mockRejectedValue(new Error('Falha ao salvar notas'))
    render(<ExpenseForm open expense={paid} categories={[category]} projects={[]} contracts={[]} onClose={vi.fn()} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Salvar notas' }))
    const alert = await screen.findByRole('alert')
    const dialog = screen.getByRole('dialog', { name: 'Editar despesa' })
    expect(dialog.getAttribute('aria-describedby')).toBe('expense-form-description expense-form-error')
    expect(document.getElementById('expense-form-description')?.textContent).toContain('Valor, data e status estão imutáveis.')
    expect(document.getElementById('expense-form-error')).toBe(alert)
  })
})
```

```tsx
// src/components/finance/ExpensePanel.test.tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExpenseCategory, FinancialExpense } from '../../types/finance'

const mocks = vi.hoisted(() => ({
  listExpenses: vi.fn(), listExpensesForClient: vi.fn(), listCategories: vi.fn(), payExpense: vi.fn(), cancelExpense: vi.fn(),
}))
vi.mock('../../services/expenseService', () => mocks)
import { ExpensePanel } from './ExpensePanel'

const category: ExpenseCategory = { id: 'cat-1', owner_id: 'owner', name: 'Hospedagem', archived_at: null, created_at: '', updated_at: '' }
const expense: FinancialExpense = {
  id: 'expense-1', owner_id: 'owner', description: 'Servidor', category_id: 'cat-1', amount_cents: 1250,
  expense_date: '2026-11-01', due_date: '2026-10-31', paid_at: null, payment_method: null, status: 'pending',
  project_id: null, contract_id: null, notes: null, cancelled_at: null, created_at: '', updated_at: '',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

afterEach(cleanup)

describe('ExpensePanel', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.listExpenses.mockResolvedValue([expense])
    mocks.listCategories.mockResolvedValue([category])
  })

  it('marca vencimento e oferece edição, baixa e cancelamento da pendente', async () => {
    render(<ExpensePanel projects={[]} contracts={[]} />)
    expect((await screen.findByText('Servidor')).textContent).toBe('Servidor')
    expect(screen.getByText('Vencida').textContent).toBe('Vencida')
    expect(screen.getByRole('button', { name: 'Editar despesa' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Pagar despesa' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Cancelar despesa' })).not.toBeNull()
  })

  it('painel do cliente usa a coleção restrita por vínculos', async () => {
    mocks.listExpensesForClient.mockResolvedValue([])
    render(<ExpensePanel clientId="client-1" projects={[]} contracts={[]} />)
    await screen.findByText('Nenhuma despesa cadastrada.')
    expect(mocks.listExpensesForClient).toHaveBeenCalledWith('client-1', {})
    expect(mocks.listExpenses).not.toHaveBeenCalled()
  })

  it('filtro de status usa a coleção sem apagar dados exibidos', async () => {
    render(<ExpensePanel projects={[]} contracts={[]} />)
    await screen.findByText('Servidor')
    fireEvent.change(screen.getByLabelText('Status das despesas'), { target: { value: 'paid' } })
    expect(mocks.listExpenses).toHaveBeenCalledWith({ status: 'paid' })
  })

  it('descarta resposta obsoleta do filtro anterior', async () => {
    const pending = deferred<FinancialExpense[]>()
    const paid = deferred<FinancialExpense[]>()
    mocks.listExpenses.mockReturnValueOnce(pending.promise).mockReturnValueOnce(paid.promise)
    render(<ExpensePanel projects={[]} contracts={[]} />)
    await waitFor(() => expect(mocks.listExpenses).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByLabelText('Status das despesas'), { target: { value: 'paid' } })
    await waitFor(() => expect(mocks.listExpenses).toHaveBeenCalledTimes(2))
    await act(async () => { paid.resolve([{ ...expense, status: 'paid', paid_at: '2026-11-25T03:00:00Z' }]); await paid.promise })
    expect(await screen.findByText('Paga')).not.toBeNull()
    await act(async () => { pending.resolve([expense]); await pending.promise })
    expect(screen.queryByText('Vencida')).toBeNull()
    expect(screen.getByText('Paga')).not.toBeNull()
  })

  it('descarta resposta obsoleta de cliente anterior', async () => {
    const first = deferred<FinancialExpense[]>()
    const second = deferred<FinancialExpense[]>()
    mocks.listExpensesForClient.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const view = render(<ExpensePanel clientId="client-1" projects={[]} contracts={[]} />)
    await waitFor(() => expect(mocks.listExpensesForClient).toHaveBeenCalledWith('client-1', {}))
    view.rerender(<ExpensePanel clientId="client-2" projects={[]} contracts={[]} />)
    await waitFor(() => expect(mocks.listExpensesForClient).toHaveBeenCalledWith('client-2', {}))
    await act(async () => { second.resolve([{ ...expense, id: 'expense-2', description: 'Despesa B' }]); await second.promise })
    expect(await screen.findByText('Despesa B')).not.toBeNull()
    await act(async () => { first.resolve([{ ...expense, description: 'Despesa A' }]); await first.promise })
    expect(screen.queryByText('Despesa A')).toBeNull()
    expect(screen.getByText('Despesa B')).not.toBeNull()
  })

  it('vincula a descrição do cancelamento de despesa', async () => {
    render(<ExpensePanel projects={[]} contracts={[]} />)
    await screen.findByText('Servidor')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar despesa' }))
    const dialog = screen.getByRole('dialog', { name: 'Cancelar despesa' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-describedby')).toBe('cancel-expense-description')
    expect(document.getElementById('cancel-expense-description')?.textContent).toContain('O registro será preservado.')
  })

  it.each([
    ['2026-11-25', '2026-11-25T03:00:00.000Z'],
    ['2027-01-01', '2027-01-01T03:00:00.000Z'],
    ['2018-11-05', '2018-11-05T02:00:00.000Z'],
  ])('converte %s para meia-noite de São Paulo', async (date, expectedIso) => {
    render(<ExpensePanel projects={[]} contracts={[]} />)
    await screen.findByText('Servidor')
    fireEvent.click(screen.getByRole('button', { name: 'Pagar despesa' }))
    fireEvent.change(screen.getByLabelText('Data do pagamento'), { target: { value: date } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }))
    await waitFor(() => expect(mocks.payExpense).toHaveBeenCalledWith('expense-1', expectedIso, 'pix'))
  })

  it('rejeita data sem meia-noite válida em São Paulo', async () => {
    render(<ExpensePanel projects={[]} contracts={[]} />)
    await screen.findByText('Servidor')
    fireEvent.click(screen.getByRole('button', { name: 'Pagar despesa' }))
    fireEvent.change(screen.getByLabelText('Data do pagamento'), { target: { value: '2018-11-04' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }))
    expect(await screen.findByRole('alert')).not.toBeNull()
    expect(screen.getByRole('alert').textContent).toContain('Não existe meia-noite')
    const dialog = screen.getByRole('dialog', { name: 'Pagar despesa' })
    expect(dialog.getAttribute('aria-describedby')).toBe('pay-expense-description pay-expense-error')
    expect(document.getElementById('pay-expense-description')?.textContent).toContain('Servidor')
    expect(document.getElementById('pay-expense-error')).toBe(screen.getByRole('alert'))
    expect(mocks.payExpense).not.toHaveBeenCalled()
  })
})
```

```tsx
// src/components/finance/CategoryManager.test.tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ listCategories: vi.fn(), createCategory: vi.fn(), archiveCategory: vi.fn() }))
vi.mock('../../services/expenseService', () => mocks)
import { CategoryManager } from './CategoryManager'

afterEach(cleanup)
describe('CategoryManager', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.listCategories.mockResolvedValue([{ id: 'cat-1', owner_id: 'owner', name: 'Hospedagem', archived_at: null, created_at: '', updated_at: '' }])
  })

  it('cria categoria personalizada sem persistir sugestões automaticamente', async () => {
    mocks.createCategory.mockResolvedValue({ id: 'cat-2', owner_id: 'owner', name: 'Marketing', archived_at: null, created_at: '', updated_at: '' })
    render(<CategoryManager onChanged={vi.fn()} />)
    await screen.findByText('Hospedagem')
    fireEvent.change(screen.getByLabelText('Nova categoria'), { target: { value: 'Marketing' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar categoria' }))
    await waitFor(() => expect(mocks.createCategory).toHaveBeenCalledWith('Marketing'))
    expect(mocks.createCategory).toHaveBeenCalledTimes(1)
  })

  it('oferece nove sugestões e apenas preenche o nome sem persistir', async () => {
    render(<CategoryManager onChanged={vi.fn()} />)
    await screen.findByText('Hospedagem')
    for (const name of [
      'Hospedagem', 'Domínio', 'Ferramentas', 'Software', 'Marketing',
      'Publicidade', 'Serviços terceirizados', 'Equipamentos', 'Outros',
    ]) {
      expect(screen.getByRole('button', { name })).not.toBeNull()
    }
    expect(mocks.createCategory).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Marketing' }))
    expect((screen.getByLabelText('Nova categoria') as HTMLInputElement).value).toBe('Marketing')
    expect(mocks.createCategory).not.toHaveBeenCalled()
  })

  it('arquiva em vez de excluir', async () => {
    mocks.archiveCategory.mockResolvedValue({ id: 'cat-1', archived_at: '2026-11-25T12:00:00Z' })
    render(<CategoryManager onChanged={vi.fn()} />)
    await screen.findByText('Hospedagem')
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar Hospedagem' }))
    await waitFor(() => expect(mocks.archiveCategory).toHaveBeenCalledWith('cat-1'))
  })
})
```

- [ ] **Etapa 2: Implementar o formulário de despesa**

```tsx
// src/components/finance/ExpenseForm.tsx
import { useEffect, useState } from 'react'
import { formatMoney, parseMoneyInput, toMoneyDecimal } from '../../lib/money'
import { getSaoPauloToday } from '../../lib/finance'
import { createExpense, updateExpense, updateExpenseNotes } from '../../services/expenseService'
import type { ExpenseCategory, ExpenseWrite, FinancialExpense } from '../../types/finance'

export interface ExpenseProjectOption { id: string; name: string; client_id: string }
export interface ExpenseContractOption { id: string; service: string; client_id: string }
export interface ExpenseFormProps {
  open: boolean
  expense?: FinancialExpense
  categories: ExpenseCategory[]
  projects: ExpenseProjectOption[]
  contracts: ExpenseContractOption[]
  onClose: () => void
  onSaved: () => void | Promise<void>
}

const fieldClass = 'w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-ink'

export function ExpenseForm({ open, expense, categories, projects, contracts, onClose, onSaved }: ExpenseFormProps) {
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(getSaoPauloToday())
  const [dueDate, setDueDate] = useState('')
  const [projectId, setProjectId] = useState('')
  const [contractId, setContractId] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const notesOnly = Boolean(expense && expense.status !== 'pending')

  useEffect(() => {
    if (!open) return
    setDescription(expense?.description ?? '')
    setCategoryId(expense?.category_id ?? '')
    setAmount(expense ? toMoneyDecimal(expense.amount_cents).replace('.', ',') : '')
    setExpenseDate(expense?.expense_date ?? getSaoPauloToday())
    setDueDate(expense?.due_date ?? '')
    setProjectId(expense?.project_id ?? '')
    setContractId(expense?.contract_id ?? '')
    setNotes(expense?.notes ?? '')
    setError('')
  }, [open, expense])

  function changeProject(next: string) {
    setProjectId(next)
    const project = projects.find((item) => item.id === next)
    const contract = contracts.find((item) => item.id === contractId)
    if (project && contract && project.client_id !== contract.client_id) setContractId('')
  }

  function changeContract(next: string) {
    setContractId(next)
    const contract = contracts.find((item) => item.id === next)
    const project = projects.find((item) => item.id === projectId)
    if (contract && project && contract.client_id !== project.client_id) setProjectId('')
  }

  async function save() {
    if (notesOnly && expense) {
      setSaving(true); setError('')
      try { await updateExpenseNotes(expense.id, { notes }); await onSaved(); onClose() }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar as notas.') }
      finally { setSaving(false) }
      return
    }
    const cents = parseMoneyInput(amount)
    const project = projects.find((item) => item.id === projectId)
    const contract = contracts.find((item) => item.id === contractId)
    if (!description.trim() || cents === null || !expenseDate) { setError('Informe descrição, valor e data da despesa.'); return }
    if (project && contract && project.client_id !== contract.client_id) { setError('Projeto e contrato devem pertencer ao mesmo cliente.'); return }
    if (dueDate && dueDate < expenseDate) { setError('O vencimento não pode anteceder a data da despesa.'); return }
    const input: ExpenseWrite = {
      description, categoryId: categoryId || null, amountCents: cents, expenseDate,
      dueDate: dueDate || null, projectId: projectId || null, contractId: contractId || null, notes,
    }
    setSaving(true); setError('')
    try {
      if (expense) await updateExpense(expense.id, input)
      else await createExpense(input)
      await onSaved(); onClose()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a despesa.') }
    finally { setSaving(false) }
  }

  if (!open) return null
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4">
    <form role="dialog" aria-modal="true" aria-label={expense ? 'Editar despesa' : 'Nova despesa'}
      aria-describedby={notesOnly && expense ? (error ? 'expense-form-description expense-form-error' : 'expense-form-description') : (error ? 'expense-form-error' : undefined)}
      className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-line bg-surface p-6"
      onSubmit={(event) => { event.preventDefault(); void save() }}>
      <h2 className="text-lg font-semibold">{notesOnly ? 'Notas complementares' : expense ? 'Editar despesa' : 'Nova despesa'}</h2>
      {notesOnly && expense && <p id="expense-form-description" className="mt-2 text-sm text-muted">{expense.description} · {formatMoney(expense.amount_cents)}. Valor, data e status estão imutáveis.</p>}
      {!notesOnly && <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm text-muted">Descrição *<input className={fieldClass} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <label className="text-sm text-muted">Categoria<select className={fieldClass} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Sem categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label className="text-sm text-muted">Valor (R$) *<input className={fieldClass} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <label className="text-sm text-muted">Data da despesa *<input type="date" className={fieldClass} value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} /></label>
        <label className="text-sm text-muted">Vencimento<input type="date" className={fieldClass} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
        <label className="text-sm text-muted">Projeto<select className={fieldClass} value={projectId} onChange={(event) => changeProject(event.target.value)}><option value="">Sem projeto</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        <label className="text-sm text-muted">Contrato<select className={fieldClass} value={contractId} onChange={(event) => changeContract(event.target.value)}><option value="">Sem contrato</option>{contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.service}</option>)}</select></label>
        <label className="text-sm text-muted md:col-span-2">Notas<textarea className={fieldClass} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      </div>}
      {notesOnly && <label className="mt-4 block text-sm text-muted">Notas complementares<textarea className={fieldClass} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>}
      {error && <p id="expense-form-error" role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-6 flex justify-end gap-2"><button type="button" className="rounded-lg border border-line px-4 py-2 text-sm" onClick={onClose}>Fechar</button>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-bg" disabled={saving}>{saving ? 'Salvando...' : notesOnly ? 'Salvar notas' : 'Salvar despesa'}</button></div>
    </form>
  </div>
}
```

- [ ] **Etapa 3: Implementar o gerenciador de categorias**

```tsx
// src/components/finance/CategoryManager.tsx
import { useEffect, useState } from 'react'
import { archiveCategory, createCategory, listCategories } from '../../services/expenseService'
import type { ExpenseCategory } from '../../types/finance'

export interface CategoryManagerProps { onChanged: () => void | Promise<void> }
const CATEGORY_SUGGESTIONS = [
  'Hospedagem', 'Domínio', 'Ferramentas', 'Software', 'Marketing',
  'Publicidade', 'Serviços terceirizados', 'Equipamentos', 'Outros',
]
const fieldClass = 'w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-ink'

export function CategoryManager({ onChanged }: CategoryManagerProps) {
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function load() {
    setLoading(true)
    try { setCategories(await listCategories(true)); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as categorias.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  async function create() {
    if (!name.trim()) { setError('Informe o nome da categoria.'); return }
    setSaving(true); setError('')
    try { await createCategory(name); setName(''); await load(); await onChanged() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível criar a categoria.') }
    finally { setSaving(false) }
  }
  async function archive(category: ExpenseCategory) {
    setSaving(true); setError('')
    try { await archiveCategory(category.id); await load(); await onChanged() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível arquivar a categoria.') }
    finally { setSaving(false) }
  }
  return <section aria-label="Categorias de despesas" className="rounded-xl border border-line bg-surface p-4">
    <h2 className="font-semibold text-ink">Categorias</h2>
    <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void create() }}>
      <label className="sr-only" htmlFor="new-category">Nova categoria</label><input id="new-category" className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} />
      <button type="submit" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-bg" disabled={saving}>Criar categoria</button>
    </form>
    <div className="mt-3">
      <p className="text-xs text-muted">Sugestões: selecione um nome para preencher o campo; a categoria só é criada ao confirmar.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {CATEGORY_SUGGESTIONS.map((suggestion) => <button
          key={suggestion}
          type="button"
          className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:text-ink disabled:opacity-50"
          disabled={saving || categories.some((category) => !category.archived_at && category.name.toLowerCase() === suggestion.toLowerCase())}
          onClick={() => { setName(suggestion); setError('') }}
        >{suggestion}</button>)}
      </div>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    {loading ? <p className="mt-3 text-sm text-muted">Carregando categorias...</p> : <ul className="mt-3 space-y-2">
      {categories.map((category) => <li key={category.id} className="flex items-center justify-between gap-3 rounded-lg bg-elevated/60 px-3 py-2 text-sm">
        <span>{category.name}{category.archived_at && <span className="ml-2 text-xs text-muted">Arquivada</span>}</span>
        {!category.archived_at && <button type="button" aria-label={`Arquivar ${category.name}`} className="text-xs text-danger" disabled={saving} onClick={() => void archive(category)}>Arquivar</button>}
      </li>)}
    </ul>}
    <p className="mt-3 text-xs text-muted">Categorias arquivadas deixam de aparecer em novos lançamentos e preservam o histórico.</p>
  </section>
}
```

- [ ] **Etapa 4: Implementar a lista e as ações de despesa**

```tsx
// src/components/finance/ExpensePanel.tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { requireSupabase, throwDbError } from '../../lib/db'
import { formatMoney } from '../../lib/money'
import { getSaoPauloToday } from '../../lib/finance'
import { listContracts } from '../../services/contractService'
import {
  cancelExpense, listCategories, listExpenses, listExpensesForClient, payExpense,
} from '../../services/expenseService'
import type { ExpenseFilters } from '../../services/expenseService'
import type { ContractListItem } from '../../types/finance'
import type { ExpenseCategory, ExpenseStatus, FinancialExpense } from '../../types/finance'
import { CategoryManager } from './CategoryManager'
import { ExpenseForm } from './ExpenseForm'
import type { ExpenseContractOption, ExpenseProjectOption } from './ExpenseForm'

export interface ExpensePanelProps {
  clientId?: string
  projects?: ExpenseProjectOption[]
  contracts?: ExpenseContractOption[]
  showForm?: boolean
  onChanged?: () => void | Promise<void>
}
const fieldClass = 'w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-ink'
const saoPauloDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

function saoPauloDateToIso(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error('Informe uma data válida.')
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const midnightUtc = Date.UTC(year, month - 1, day)
  const date = new Date(midnightUtc)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('Informe uma data válida.')
  }

  const readLocalParts = (instant: Date) => Object.fromEntries(
    saoPauloDateTimeFormatter.formatToParts(instant).map((part) => [part.type, part.value]),
  )
  const localPartsAsUtc = (parts: Record<string, string>) => Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  )

  const probe = new Date(Date.UTC(year, month - 1, day, 12))
  const offset = localPartsAsUtc(readLocalParts(probe)) - probe.getTime()
  const result = new Date(midnightUtc - offset)
  const resultParts = readLocalParts(result)
  if (
    Number(resultParts.year) !== year
    || Number(resultParts.month) !== month
    || Number(resultParts.day) !== day
    || Number(resultParts.hour) !== 0
    || Number(resultParts.minute) !== 0
    || Number(resultParts.second) !== 0
  ) {
    throw new Error('Não existe meia-noite em São Paulo nesta data.')
  }
  return result.toISOString()
}

export function ExpensePanel({ clientId, projects, contracts, showForm = true, onChanged }: ExpensePanelProps) {
  const [expenses, setExpenses] = useState<FinancialExpense[]>([])
  const [allCategories, setAllCategories] = useState<ExpenseCategory[]>([])
  const [projectOptions, setProjectOptions] = useState<ExpenseProjectOption[]>(projects ?? [])
  const [contractOptions, setContractOptions] = useState<ExpenseContractOption[]>(contracts ?? [])
  const [status, setStatus] = useState<ExpenseStatus | 'overdue' | ''>('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<FinancialExpense | undefined>()
  const [paying, setPaying] = useState<FinancialExpense | null>(null)
  const [cancelling, setCancelling] = useState<FinancialExpense | null>(null)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestVersion = useRef(0)
  const activeRef = useRef(true)
  const today = getSaoPauloToday()

  const load = useCallback(async () => {
    const version = ++requestVersion.current
    setLoading(true); setError('')
    try {
      const filters: ExpenseFilters = status === 'overdue'
        ? { status: 'pending' }
        : status ? { status } : {}
      const [nextExpenses, nextCategories] = await Promise.all([
        clientId ? listExpensesForClient(clientId, filters) : listExpenses(filters),
        listCategories(true),
      ])
      let nextProjectOptions = projects ?? []
      let nextContractOptions = contracts ?? []
      if (projects === undefined) {
        let projectQuery = requireSupabase().from('projects').select('id,name,client_id').neq('status', 'cancelled').order('name')
        if (clientId) projectQuery = projectQuery.eq('client_id', clientId)
        const { data, error: cause } = await projectQuery
        throwDbError(cause)
        if (!Array.isArray(data)) throw new Error('Não foi possível carregar os projetos.')
        nextProjectOptions = data as ExpenseProjectOption[]
      }
      if (contracts === undefined) {
        const nextContracts = await listContracts(clientId ? { clientId, status: 'active' } : { status: 'active' })
        nextContractOptions = nextContracts.map((contract: ContractListItem) => ({ id: contract.id, service: contract.service, client_id: contract.client_id }))
      }
      if (!activeRef.current || version !== requestVersion.current) return
      setProjectOptions(nextProjectOptions)
      setContractOptions(nextContractOptions)
      setExpenses(status === 'overdue' ? nextExpenses.filter((expense) => expense.status === 'pending' && expense.due_date !== null && expense.due_date < today) : nextExpenses)
      setAllCategories(nextCategories)
    } catch (cause) {
      if (!activeRef.current || version !== requestVersion.current) return
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as despesas.')
    } finally {
      if (activeRef.current && version === requestVersion.current) setLoading(false)
    }
  }, [clientId, projects, contracts, status, today])

  useEffect(() => {
    activeRef.current = true
    void load()
    return () => {
      activeRef.current = false
      requestVersion.current += 1
    }
  }, [load])

  async function changed() {
    await load()
    await onChanged?.()
  }

  return <section className="space-y-4" aria-busy={loading}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-ink">Despesas</h2>
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="expense-status">Status das despesas</label><select id="expense-status" className="rounded-lg border border-line bg-elevated px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value as ExpenseStatus | 'overdue' | '')}>
          <option value="">Todas</option><option value="pending">Pendentes</option><option value="paid">Pagas</option><option value="cancelled">Canceladas</option><option value="overdue">Vencidas</option>
        </select>
        {showForm && <button type="button" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-bg" onClick={() => { setEditing(undefined); setFormOpen(true) }}>Nova despesa</button>}
        <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => setCategoriesOpen((value) => !value)}>Categorias</button>
      </div>
    </div>
    {error && <div role="alert" className="rounded-lg border border-danger/40 p-4 text-sm text-danger">{error}<button type="button" className="ml-3 underline" onClick={() => void load()}>Tentar novamente</button></div>}
    {loading && !expenses.length && <p className="text-sm text-muted">Carregando despesas...</p>}
    {loading && expenses.length > 0 && <p role="status" className="text-sm text-muted">Atualizando despesas...</p>}
    {!loading && !error && !expenses.length && <p className="rounded-lg border border-line p-6 text-sm text-muted">Nenhuma despesa cadastrada.</p>}
    {expenses.length > 0 && <div className="space-y-3">
      {expenses.map((expense) => {
        const category = allCategories.find((item) => item.id === expense.category_id)
        const overdue = expense.status === 'pending' && expense.due_date !== null && expense.due_date < today
        return <article key={expense.id} className="rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold text-ink">{expense.description}</h3><p className="text-sm text-muted">{category?.name ?? 'Sem categoria'} · {expense.expense_date}</p></div>
            <div className="text-right"><p className="font-semibold text-ink">{formatMoney(expense.amount_cents)}</p><p className={`text-xs ${overdue ? 'text-danger' : 'text-muted'}`}>{overdue ? 'Vencida' : expense.status === 'paid' ? 'Paga' : expense.status === 'cancelled' ? 'Cancelada' : 'Pendente'}</p></div></div>
          {expense.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{expense.notes}</p>}
          {expense.status !== 'pending' ? <div className="mt-3"><button type="button" aria-label="Editar notas" className="text-sm text-muted underline" onClick={() => { setEditing(expense); setFormOpen(true) }}>Editar notas</button></div>
            : <div className="mt-3 flex flex-wrap gap-2"><button type="button" aria-label="Editar despesa" className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => { setEditing(expense); setFormOpen(true) }}>Editar</button>
              <button type="button" aria-label="Pagar despesa" className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => setPaying(expense)}>Pagar</button>
              <button type="button" aria-label="Cancelar despesa" className="rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger" onClick={() => setCancelling(expense)}>Cancelar</button></div>}
        </article>
      })}
    </div>}
    <ExpenseForm open={formOpen} expense={editing} categories={allCategories.filter((category) => !category.archived_at)} projects={projectOptions} contracts={contractOptions}
      onClose={() => { setFormOpen(false); setEditing(undefined) }} onSaved={() => void changed()} />
    {paying && <PayExpenseDialog expense={paying} onClose={() => setPaying(null)} onSaved={() => void changed()} />}
    {cancelling && <CancelExpenseDialog expense={cancelling} onClose={() => setCancelling(null)} onSaved={() => void changed()} />}
    {categoriesOpen && <CategoryManager onChanged={() => void load()} />}
  </section>
}

function PayExpenseDialog({ expense, onClose, onSaved }: { expense: FinancialExpense; onClose: () => void; onSaved: () => void }) {
  const [paidAt, setPaidAt] = useState(getSaoPauloToday())
  const [method, setMethod] = useState('pix')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function pay() {
    if (!paidAt) { setError('Informe a data do pagamento.'); return }
    setSaving(true); setError('')
    try { await payExpense(expense.id, saoPauloDateToIso(paidAt), method); onSaved(); onClose() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível pagar a despesa.') }
    finally { setSaving(false) }
  }
  return <div role="dialog" aria-modal="true" aria-label="Pagar despesa"
    aria-describedby={error ? 'pay-expense-description pay-expense-error' : 'pay-expense-description'}
    className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4"><form className="w-full max-w-md rounded-xl border border-line bg-surface p-6" onSubmit={(event) => { event.preventDefault(); void pay() }}>
    <h2 className="text-lg font-semibold">Pagar despesa</h2><p id="pay-expense-description" className="mt-2 text-sm text-muted">{expense.description} · {formatMoney(expense.amount_cents)}</p>
    <label className="mt-4 block text-sm">Data do pagamento<input type="date" className={fieldClass} value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /></label>
    <label className="mt-3 block text-sm">Forma de pagamento<select className={fieldClass} value={method} onChange={(event) => setMethod(event.target.value)}><option value="pix">Pix</option><option value="cartao">Cartão</option><option value="transferencia">Transferência</option><option value="dinheiro">Dinheiro</option></select></label>
    {error && <p id="pay-expense-error" role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    <div className="mt-6 flex justify-end gap-2"><button type="button" className="rounded-lg border border-line px-4 py-2 text-sm" onClick={onClose}>Fechar</button><button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-bg" disabled={saving}>{saving ? 'Salvando...' : 'Confirmar pagamento'}</button></div>
  </form></div>
}

function CancelExpenseDialog({ expense, onClose, onSaved }: { expense: FinancialExpense; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function cancel() {
    setSaving(true); setError('')
    try { await cancelExpense(expense.id); onSaved(); onClose() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível cancelar a despesa.') }
    finally { setSaving(false) }
  }
  return <div role="dialog" aria-modal="true" aria-label="Cancelar despesa"
    aria-describedby={error ? 'cancel-expense-description cancel-expense-error' : 'cancel-expense-description'}
    className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4"><div className="w-full max-w-md rounded-xl border border-line bg-surface p-6">
    <h2 className="text-lg font-semibold">Cancelar despesa</h2><p id="cancel-expense-description" className="mt-2 text-sm text-muted">A despesa pendente será cancelada e não entrará no caixa. O registro será preservado.</p>
    {error && <p id="cancel-expense-error" role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    <div className="mt-6 flex justify-end gap-2"><button type="button" className="rounded-lg border border-line px-4 py-2 text-sm" onClick={onClose}>Voltar</button><button type="button" className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-bg" disabled={saving} onClick={() => void cancel()}>{saving ? 'Cancelando...' : 'Confirmar cancelamento'}</button></div>
  </div></div>
}
```

- [ ] **Etapa 5: Executar testes e build**

Comando: `npm test -- src/components/finance/ExpenseForm.test.tsx src/components/finance/ExpensePanel.test.tsx src/components/finance/CategoryManager.test.tsx && npm run build`
Esperado: testes passam e build termina com código 0.

- [ ] **Etapa 6: Criar commit**

```bash
git add src/components/finance/ExpenseForm.tsx src/components/finance/ExpenseForm.test.tsx src/components/finance/ExpensePanel.tsx src/components/finance/ExpensePanel.test.tsx src/components/finance/CategoryManager.tsx src/components/finance/CategoryManager.test.tsx
git commit -m "feat: adicionar despesas e categorias financeiras"
```

---

### Tarefa 11: Dashboard financeiro, gráficos e snapshot válido

**Arquivos:**
- Criar: `src/components/finance/FinancialCharts.tsx`
- Criar: `src/components/finance/FinancialCharts.test.tsx`
- Criar: `src/pages/FinancePage.tsx`
- Criar: `src/pages/FinancePage.test.tsx`

**Interfaces:**
- Consome: `FinancialSummary`, `CashFlowBucket`, `ExpenseCategoryTotal`, `ContractListItem`, `getPeriodRange`, `getSaoPauloToday`, `formatMoney`, serviços das Tarefas 7/8/9 e `recharts` já instalado no projeto.
- Produz: `FinancialSnapshot`, `FinancialChartsProps` e `FinancePage`.
- A carga inicial sem snapshot é um erro integral; uma falha de atualização preserva atomicamente o último snapshot válido, identifica o período exibido e oferece repetição.
- Respostas de filtros anteriores são descartadas por versão da requisição e flag de componente ativo.

- [ ] **Etapa 1: Escrever testes que falham**

```tsx
// src/components/finance/FinancialCharts.test.tsx
// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FinancialSummary } from '../../types/finance'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null,
  Legend: () => null, Area: () => null, Line: () => null, Bar: () => null, Pie: () => null, Cell: () => null,
}))
import { FinancialCharts } from './FinancialCharts'

const summary: FinancialSummary = {
  contractedCents: 0, receivedHistoricalCents: 0, pendingCents: 0,
  periodReceiptsCents: 0, periodExpensesCents: 0, periodProfitCents: 0,
  overdueCents: 0, overdue: [], upcoming: [],
}
afterEach(cleanup)

describe('FinancialCharts', () => {
  it('exibe estado vazio específico para cada gráfico sem inventar dados', () => {
    render(<FinancialCharts summary={summary} cashFlow={[]} monthlyFlow={[]} categoryTotals={[]} />)
    expect(screen.getByText('Sem movimentos mensais no período.').textContent).toBe('Sem movimentos mensais no período.')
    expect(screen.getByText('Sem valores contratados ou recebidos.').textContent).toBe('Sem valores contratados ou recebidos.')
    expect(screen.getByText('Sem despesas pagas por categoria.').textContent).toBe('Sem despesas pagas por categoria.')
    expect(screen.getByText('Sem pagamentos pendentes.').textContent).toBe('Sem pagamentos pendentes.')
    expect(screen.getByText('Sem buckets no período selecionado.').textContent).toBe('Sem buckets no período selecionado.')
  })

  it('usa dados reais quando existem movimentos e vencimentos', () => {
    render(<FinancialCharts
      summary={{ ...summary, contractedCents: 100000, receivedHistoricalCents: 30000,
        upcoming: [{ contract_id: 'c1', client_id: 'client-1', description: 'Parcela 1', due_date: '2026-12-01', amount_cents: 70000 }] }}
      cashFlow={[{ label: '2026-11-01', receiptsCents: 30000, expensesCents: 12000, netCents: 18000, balanceCents: 18000 }]}
      monthlyFlow={[{ label: '2026-11-01', receiptsCents: 30000, expensesCents: 12000, netCents: 18000, balanceCents: 18000 }]}
      categoryTotals={[{ categoryId: null, name: 'Sem categoria', amountCents: 12000 }]}
    />)
    expect(screen.queryByText('Sem movimentos mensais no período.')).toBeNull()
    expect(screen.queryByText('Sem pagamentos pendentes.')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Pagamentos pendentes' })).not.toBeNull()
  })
})
```

```tsx
// src/pages/FinancePage.test.tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FinancialSummary } from '../types/finance'

const mocks = vi.hoisted(() => ({
  getFinancialSummary: vi.fn(), getCashFlow: vi.fn(), getExpenseCategoryTotals: vi.fn(), listContracts: vi.fn(),
}))
vi.mock('../services/financialService', () => mocks)
vi.mock('../services/contractService', () => ({ listContracts: mocks.listContracts }))
vi.mock('../components/finance/FinancialCharts', () => ({ FinancialCharts: () => <div>Gráficos financeiros</div> }))
vi.mock('../components/finance/ContractPanel', () => ({ ContractPanel: () => <div>Painel de contratos</div> }))
vi.mock('../components/finance/ExpensePanel', () => ({ ExpensePanel: () => <div>Painel de despesas</div> }))
import { FinancePage } from './FinancePage'

const summary: FinancialSummary = {
  contractedCents: 100000, receivedHistoricalCents: 30000, pendingCents: 70000,
  periodReceiptsCents: 30000, periodExpensesCents: 12000, periodProfitCents: 18000,
  overdueCents: 0, overdue: [], upcoming: [],
}
const flow = [{ label: '2026-11-01', receiptsCents: 30000, expensesCents: 12000, netCents: 18000, balanceCents: 18000 }]

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

afterEach(cleanup)
describe('FinancePage', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.getFinancialSummary.mockResolvedValue(summary)
    mocks.getCashFlow.mockResolvedValue(flow)
    mocks.getExpenseCategoryTotals.mockResolvedValue([])
    mocks.listContracts.mockResolvedValue([])
  })

  it('falha inicial continua erro integral com opção de repetição', async () => {
    mocks.getFinancialSummary.mockRejectedValue(new Error('Falha de rede'))
    render(<FinancePage />)
    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível carregar os dados financeiros.')
    expect(screen.queryByText('R$ 1.000,00')).toBeNull()
    expect(screen.queryByText('Painel de contratos')).toBeNull()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).not.toBeNull()
  })

  it('falha de refresh preserva o último snapshot e permite retry', async () => {
    render(<FinancePage />)
    await screen.findByText('R$ 1.000,00')
    const displayedPeriod = screen.getByText(/Período exibido:/).textContent
    mocks.getFinancialSummary.mockRejectedValue(new Error('Falha de rede'))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Último snapshot válido preservado.')
    expect(screen.getByText('R$ 1.000,00').textContent).toBe('R$ 1.000,00')
    expect(screen.getByText(/Período exibido:/).textContent).toBe(displayedPeriod)
    mocks.getFinancialSummary.mockResolvedValue(summary)
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(screen.getByText('R$ 1.000,00')).not.toBeNull()
  })

  it('descarta resposta obsoleta de um filtro anterior', async () => {
    render(<FinancePage />)
    await screen.findByText('R$ 1.000,00')
    const older = deferred<FinancialSummary>()
    const newer = deferred<FinancialSummary>()
    mocks.getFinancialSummary.mockImplementationOnce(() => older.promise).mockImplementationOnce(() => newer.promise)
    fireEvent.change(screen.getByLabelText('Período'), { target: { value: 'year' } })
    await waitFor(() => expect(mocks.getFinancialSummary).toHaveBeenCalledTimes(2))
    fireEvent.change(screen.getByLabelText('Período'), { target: { value: 'day' } })
    await waitFor(() => expect(mocks.getFinancialSummary).toHaveBeenCalledTimes(3))
    await act(async () => { newer.resolve({ ...summary, contractedCents: 200000 }); await newer.promise })
    expect(await screen.findByText('R$ 2.000,00')).not.toBeNull()
    await act(async () => { older.resolve({ ...summary, contractedCents: 50000 }); await older.promise })
    expect(screen.queryByText('R$ 500,00')).toBeNull()
    expect(screen.getByText('R$ 2.000,00')).not.toBeNull()
  })

  it('navega entre visão geral, receitas, despesas e fluxo', async () => {
    render(<FinancePage />)
    await screen.findByText('R$ 1.000,00')
    fireEvent.click(screen.getByRole('button', { name: 'Receitas' }))
    expect(await screen.findByText('Painel de contratos')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Despesas' }))
    expect(await screen.findByText('Painel de despesas')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Fluxo de caixa' }))
    expect(screen.getByText('Gráficos financeiros')).not.toBeNull()
  })
})
```

- [ ] **Etapa 2: Implementar os gráficos com dados reais**

```tsx
// src/components/finance/FinancialCharts.tsx
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Card } from '../ui/Card'
import { ChartCard } from '../dashboard/ChartCard'
import { formatMoney } from '../../lib/money'
import type { CashFlowBucket, ExpenseCategoryTotal, FinancialSummary } from '../../types/finance'

export interface FinancialChartsProps {
  summary: FinancialSummary
  cashFlow: CashFlowBucket[]
  monthlyFlow: CashFlowBucket[]
  categoryTotals: ExpenseCategoryTotal[]
}

const axis = { stroke: '#a3a3a3', fontSize: 11 }
const tooltipStyle = { backgroundColor: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 12, color: '#fff', fontSize: 12 }
const colors = ['#00e091', '#6db5ff', '#fefa3d', '#ff5de7', '#ff7a7a', '#a3a3a3']
const moneyTick = (value: unknown) => formatMoney(Number(value ?? 0))

function EmptyChart({ children }: { children: string }) {
  return <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-line px-4 text-center text-sm text-muted">{children}</div>
}

export function FinancialCharts({ summary, cashFlow, monthlyFlow, categoryTotals }: FinancialChartsProps) {
  const monthlyData = monthlyFlow.map((bucket) => ({
    label: bucket.label.slice(0, 7), receipts: bucket.receiptsCents,
    expenses: bucket.expensesCents, profit: bucket.netCents,
  }))
  const contractedData = [
    { name: 'Contratado ativo', value: summary.contractedCents },
    { name: 'Recebido líquido histórico', value: summary.receivedHistoricalCents },
  ]
  const categoryData = categoryTotals.map((category) => ({ name: category.name, value: category.amountCents }))
  const pendingData = [...summary.overdue, ...summary.upcoming].map((item, index) => ({
    name: item.description || `Vencimento ${index + 1}`, value: item.amount_cents,
  }))
  const flowData = cashFlow.map((bucket) => ({
    label: bucket.label, balance: bucket.balanceCents, net: bucket.netCents,
  }))
  return <div className="grid gap-4 xl:grid-cols-2">
    <Card title="Receitas, despesas e lucro por mês">
      {!monthlyData.length ? <EmptyChart>Sem movimentos mensais no período.</EmptyChart> : <div className="h-56"><ResponsiveContainer width="100%" height="100%">
        <LineChart data={monthlyData}><CartesianGrid stroke="#2a2a2a" vertical={false} /><XAxis dataKey="label" tick={axis} /><YAxis tick={axis} tickFormatter={moneyTick} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => formatMoney(Number(value ?? 0))} />
          <Line type="monotone" dataKey="receipts" name="Receitas" stroke="#00e091" strokeWidth={2} />
          <Line type="monotone" dataKey="expenses" name="Despesas" stroke="#ff7a7a" strokeWidth={2} />
          <Line type="monotone" dataKey="profit" name="Lucro" stroke="#fefa3d" strokeWidth={2} />
        </LineChart></ResponsiveContainer></div>}
    </Card>
    <Card title="Contratado versus recebido">
      {!contractedData.some((item) => item.value !== 0) ? <EmptyChart>Sem valores contratados ou recebidos.</EmptyChart> : <div className="h-56"><ResponsiveContainer width="100%" height="100%">
        <BarChart data={contractedData}><CartesianGrid stroke="#2a2a2a" vertical={false} /><XAxis dataKey="name" tick={axis} /><YAxis tick={axis} tickFormatter={moneyTick} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => formatMoney(Number(value ?? 0))} />
          <Bar dataKey="value" name="Valor" fill="#00e091" radius={[8, 8, 0, 0]} />
        </BarChart></ResponsiveContainer></div>}
    </Card>
    <Card title="Despesas por categoria">
      {!categoryData.length ? <EmptyChart>Sem despesas pagas por categoria.</EmptyChart> : <div className="h-56"><ResponsiveContainer width="100%" height="100%">
        <PieChart><Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ value }) => formatMoney(Number(value ?? 0))}>
          {categoryData.map((entry, index) => <Cell key={`${entry.name}-${index}`} fill={colors[index % colors.length]} />)}
        </Pie><Tooltip contentStyle={tooltipStyle} formatter={(value) => formatMoney(Number(value ?? 0))} /></PieChart></ResponsiveContainer></div>}
    </Card>
    <Card title="Pagamentos pendentes">
      {!pendingData.length ? <EmptyChart>Sem pagamentos pendentes.</EmptyChart> : <div className="h-56"><ResponsiveContainer width="100%" height="100%">
        <BarChart data={pendingData} layout="vertical" margin={{ left: 24 }}><CartesianGrid stroke="#2a2a2a" horizontal={false} /><XAxis type="number" tick={axis} tickFormatter={moneyTick} /><YAxis type="category" dataKey="name" tick={axis} width={110} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => formatMoney(Number(value ?? 0))} />
          <Bar dataKey="value" name="Pendente" fill="#6db5ff" radius={[0, 8, 8, 0]} />
        </BarChart></ResponsiveContainer></div>}
    </Card>
    <div className="xl:col-span-2"><ChartCard title="Saldo acumulado do período">
      {!flowData.length ? <EmptyChart>Sem buckets no período selecionado.</EmptyChart> : <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={flowData}><defs><linearGradient id="finance-balance" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00e091" stopOpacity={0.35} /><stop offset="95%" stopColor="#00e091" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid stroke="#2a2a2a" vertical={false} /><XAxis dataKey="label" tick={axis} /><YAxis tick={axis} tickFormatter={moneyTick} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => formatMoney(Number(value ?? 0))} />
          <Area type="monotone" dataKey="balance" name="Saldo acumulado" stroke="#00e091" fill="url(#finance-balance)" />
        </AreaChart></ResponsiveContainer>}
    </ChartCard></div>
  </div>
}
```

- [ ] **Etapa 3: Implementar a página com snapshot atômico**

```tsx
// src/pages/FinancePage.tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, WalletCards } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { ContractPanel } from '../components/finance/ContractPanel'
import { ExpensePanel } from '../components/finance/ExpensePanel'
import { FinancialCharts } from '../components/finance/FinancialCharts'
import { getCashFlow, getExpenseCategoryTotals, getFinancialSummary } from '../services/financialService'
import { listContracts } from '../services/contractService'
import { formatMoney } from '../lib/money'
import { getPeriodRange, getSaoPauloToday, type PeriodPreset } from '../lib/finance'
import type { CashFlowBucket, CashFlowGranularity, ContractListItem, ExpenseCategoryTotal, FinancialSummary } from '../types/finance'

export interface FinancialSnapshot {
  summary: FinancialSummary
  cashFlow: CashFlowBucket[]
  monthlyFlow: CashFlowBucket[]
  categoryTotals: ExpenseCategoryTotal[]
  contracts: ContractListItem[]
  start: string
  end: string
}

type Section = 'overview' | 'contracts' | 'expenses' | 'cashflow'
const selectClass = 'h-11 rounded-xl border border-line bg-elevated px-3 text-sm text-ink'

export function FinancePage() {
  const [today] = useState(getSaoPauloToday)
  const [preset, setPreset] = useState<PeriodPreset>('month')
  const [granularity, setGranularity] = useState<CashFlowGranularity>('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [section, setSection] = useState<Section>('overview')
  const [snapshot, setSnapshot] = useState<FinancialSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const requestVersion = useRef(0)

  const refresh = useCallback(() => setReloadToken((value) => value + 1), [])

  useEffect(() => {
    const version = ++requestVersion.current
    let active = true
    setLoading(true)
    setError('')
    async function load() {
      const range = getPeriodRange(preset, today, customStart, customEnd)
      const cashFlowPromise = getCashFlow(range.start, range.end, granularity)
      const monthlyFlowPromise = granularity === 'month' ? cashFlowPromise : getCashFlow(range.start, range.end, 'month')
      const [summary, cashFlow, monthlyFlow, categoryTotals, contracts] = await Promise.all([
        getFinancialSummary(range.start, range.end), cashFlowPromise, monthlyFlowPromise,
        getExpenseCategoryTotals(range.start, range.end), listContracts(),
      ])
      if (!active || version !== requestVersion.current) return
      setSnapshot({ summary, cashFlow, monthlyFlow, categoryTotals, contracts, ...range })
      setLoading(false)
    }
    void load().catch((cause: unknown) => {
      if (!active || version !== requestVersion.current) return
      const detail = cause instanceof Error && cause.message ? ` ${cause.message}` : ''
      setError(snapshot
        ? `Não foi possível atualizar os dados financeiros. Último snapshot válido preservado.${detail}`
        : `Não foi possível carregar os dados financeiros.${detail}`)
      setLoading(false)
    })
    return () => { active = false }
  }, [preset, granularity, customStart, customEnd, today, reloadToken])

  function changePreset(value: PeriodPreset) {
    if (value === 'custom' && !customStart && !customEnd) {
      setCustomStart(`${today.slice(0, 8)}01`)
      setCustomEnd(today)
    }
    setPreset(value)
  }

  if (loading && !snapshot) return <main className="space-y-4"><Skeleton className="h-10 w-64" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-28" />)}</div></main>
  if (!snapshot) return <main><div role="alert"><EmptyState icon={WalletCards} title="Financeiro indisponível" description={error || 'Não foi possível carregar os dados financeiros.'} action={<Button onClick={refresh}>Tentar novamente</Button>} /></div></main>

  const summary = snapshot.summary
  const period = `${snapshot.start} ≤ data < ${snapshot.end}`
  const indicators: Array<{ label: string; value: number; tone?: 'primary' | 'danger' | 'lime' | 'accent' }> = [
    { label: 'Contratado ativo', value: summary.contractedCents, tone: 'primary' },
    { label: 'Recebido líquido histórico', value: summary.receivedHistoricalCents, tone: 'lime' },
    { label: 'Pendente', value: summary.pendingCents, tone: 'accent' },
    { label: 'Recebimentos do período', value: summary.periodReceiptsCents, tone: 'primary' },
    { label: 'Despesas pagas do período', value: summary.periodExpensesCents, tone: 'danger' },
    { label: 'Lucro do período', value: summary.periodProfitCents, tone: summary.periodProfitCents < 0 ? 'danger' : 'lime' },
    { label: 'Vencido', value: summary.overdueCents, tone: 'danger' },
  ]

  return <main className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-medium uppercase tracking-wider text-muted">Financeiro</p><h1 className="font-display text-2xl font-bold text-ink">Visão financeira</h1><p className="mt-1 text-sm text-muted">Período exibido: {period} (fim exclusivo)</p></div>
      <Button variant="outline" onClick={refresh} loading={loading}><RefreshCw className="h-4 w-4" />Atualizar</Button>
    </header>
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/40 bg-surface p-4 text-sm text-danger"><span>{error}</span><Button variant="outline" onClick={refresh}>Tentar novamente</Button></div>}
    <section aria-label="Filtros financeiros" className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">Período<select className={selectClass} value={preset} onChange={(event) => changePreset(event.target.value as PeriodPreset)}><option value="day">Diário</option><option value="week">Semanal</option><option value="month">Mensal</option><option value="year">Anual</option><option value="custom">Personalizado</option></select></label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">Agrupamento do caixa<select className={selectClass} value={granularity} onChange={(event) => setGranularity(event.target.value as CashFlowGranularity)}><option value="day">Dia</option><option value="week">Semana</option><option value="month">Mês</option><option value="year">Ano</option></select></label>
      {preset === 'custom' && <><label className="flex flex-col gap-1.5 text-sm font-medium text-muted">Início inclusivo<input type="date" className={selectClass} value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">Fim inclusivo<input type="date" className={selectClass} value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label></>}
      <span className="pb-3 text-xs text-muted">Datas de caixa e vencimentos em America/Sao_Paulo.</span>
    </section>
    <nav aria-label="Seções financeiras" className="flex flex-wrap gap-2">
      {([['overview', 'Visão geral'], ['contracts', 'Receitas'], ['expenses', 'Despesas'], ['cashflow', 'Fluxo de caixa']] as const).map(([value, label]) => <Button key={value} variant={section === value ? 'primary' : 'outline'} aria-pressed={section === value} onClick={() => setSection(value)}>{label}</Button>)}
    </nav>
    {section === 'overview' && <>
      <section aria-label="Indicadores financeiros" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {indicators.map((indicator) => <Card key={indicator.label} role="group" aria-label={indicator.label}><p className="text-xs text-muted">{indicator.label}</p><p className={`mt-2 font-display text-2xl font-bold ${indicator.tone === 'danger' ? 'text-danger' : indicator.tone === 'primary' ? 'text-primary' : indicator.tone === 'lime' ? 'text-lime' : indicator.tone === 'accent' ? 'text-accent' : 'text-ink'}`}>{formatMoney(indicator.value)}</p></Card>)}
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Vencidos"><DueList items={summary.overdue} empty="Nenhum recebimento vencido." /></Card>
        <Card title="Próximos vencimentos"><DueList items={summary.upcoming} empty="Nenhum vencimento próximo." /></Card>
      </div>
      <FinancialCharts summary={summary} cashFlow={snapshot.cashFlow} monthlyFlow={snapshot.monthlyFlow} categoryTotals={snapshot.categoryTotals} />
    </>}
    {section === 'contracts' && <ContractPanel contracts={snapshot.contracts} onChanged={refresh} />}
    {section === 'expenses' && <ExpensePanel onChanged={refresh} />}
    {section === 'cashflow' && <><Card title="Fluxo do período"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted"><th className="py-2">Período</th><th className="py-2">Recebimentos</th><th className="py-2">Despesas</th><th className="py-2">Saldo do período</th><th className="py-2">Acumulado</th></tr></thead><tbody>
      {snapshot.cashFlow.map((bucket) => <tr key={bucket.label} className="border-t border-line"><td className="py-2">{bucket.label}</td><td>{formatMoney(bucket.receiptsCents)}</td><td>{formatMoney(bucket.expensesCents)}</td><td>{formatMoney(bucket.netCents)}</td><td>{formatMoney(bucket.balanceCents)}</td></tr>)}
    </tbody></table>{!snapshot.cashFlow.length && <p className="py-6 text-sm text-muted">Nenhum movimento no período.</p>}</div></Card>
      <FinancialCharts summary={summary} cashFlow={snapshot.cashFlow} monthlyFlow={snapshot.monthlyFlow} categoryTotals={snapshot.categoryTotals} /></>}
  </main>
}

function DueList({ items, empty }: { items: FinancialSummary['upcoming']; empty: string }) {
  if (!items.length) return <p className="py-6 text-sm text-muted">{empty}</p>
  return <ul className="space-y-2">{items.map((item, index) => <li key={`${item.contract_id}-${item.due_date}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-elevated px-3 py-2 text-sm"><span>{item.description}<span className="ml-2 text-xs text-muted">{item.due_date}</span></span><span>{formatMoney(item.amount_cents)}</span></li>)}</ul>
}
```

- [ ] **Etapa 4: Executar testes e build**

Comando: `npm test -- src/components/finance/FinancialCharts.test.tsx src/pages/FinancePage.test.tsx && npm run build`
Esperado: estado inicial com erro integral; refresh com snapshot preservado; resposta obsoleta descartada; gráficos vazios sem dados fictícios; build com código 0.

- [ ] **Etapa 5: Criar commit**

```bash
git add src/components/finance/FinancialCharts.tsx src/components/finance/FinancialCharts.test.tsx src/pages/FinancePage.tsx src/pages/FinancePage.test.tsx
git commit -m "feat: adicionar dashboard financeiro com snapshot valido"
```

---

### Tarefa 12: Integrar financeiro ao cliente, rota e verificações finais

**Arquivos:**
- Criar: `src/components/clients/ClientFinancePanel.tsx`
- Criar: `src/components/clients/ClientFinancePanel.test.tsx`
- Modificar: `src/pages/ClientDetailPage.tsx`
- Modificar: `src/pages/ClientDetailPage.test.tsx`
- Modificar: `src/routes/AppRoutes.tsx`
- Modificar: `src/routes/AppRoutes.test.tsx`
- Modificar: `src/pages/ModulePlaceholderPage.tsx`
- Modificar: `src/pages/ModulePlaceholderPage.test.tsx`
- Modificar: `README.md`

**Interfaces:**
- Consome: `ClientDetail.client`, `ContractPanel`, `ExpensePanel`, `listContracts`, `getContractFinancials`, `listExpensesForClient`, `formatMoney` e `getSaoPauloToday`.
- Produz: `ClientFinancePanelProps` e a rota protegida `/financeiro` renderizando `FinancePage`.
- Remove o texto provisório da aba Financeiro do Plano 1 e a entrada `financeiro` de `MODULES`; Relatórios continua na Etapa 4.

- [ ] **Etapa 1: Escrever o teste do painel financeiro do cliente**

```tsx
// src/components/clients/ClientFinancePanel.test.tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContractFinancials, ContractListItem } from '../../types/finance'

const mocks = vi.hoisted(() => ({ listContracts: vi.fn(), getContractFinancials: vi.fn(), listExpensesForClient: vi.fn() }))
vi.mock('../../services/contractService', () => mocks)
vi.mock('../../services/expenseService', () => ({ listExpensesForClient: mocks.listExpensesForClient }))
vi.mock('../finance/ContractPanel', () => ({ ContractPanel: ({ clientId }: { clientId?: string }) => <div>Contratos do cliente {clientId}</div> }))
vi.mock('../finance/ExpensePanel', () => ({ ExpensePanel: ({ clientId }: { clientId?: string }) => <div>Despesas do cliente {clientId}</div> }))
import { ClientFinancePanel } from './ClientFinancePanel'

const contract: ContractListItem = {
  id: 'contract-1', owner_id: 'owner', client_id: 'client-1', source_link_id: null, creation_key: null,
  service: 'Site', total_value_cents: 100000, contracted_at: '2026-11-01', due_date: '2026-12-01',
  payment_method: null, payment_terms: null, status: 'active', notes: null, cancelled_at: null,
  created_at: '', updated_at: '', client_name: 'Empresa A',
}
const detail: ContractFinancials = { contract, installments: [], payments: [], allocations: [], receivedCents: 30000, pendingCents: 70000 }
function renderPanel() {
  return render(<MemoryRouter><ClientFinancePanel clientId="client-1" clientName="Empresa A" /></MemoryRouter>)
}
afterEach(cleanup)

describe('ClientFinancePanel', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.listContracts.mockResolvedValue([contract])
    mocks.getContractFinancials.mockResolvedValue(detail)
    mocks.listExpensesForClient.mockResolvedValue([])
  })

  it('soma contratado ativo, recebido líquido e pendente somente do cliente', async () => {
    renderPanel()
    await screen.findByText('Contratos do cliente client-1')
    expect(screen.getByText('R$ 1.000,00').textContent).toBe('R$ 1.000,00')
    expect(screen.getByText('R$ 300,00').textContent).toBe('R$ 300,00')
    expect(screen.getByText('R$ 700,00').textContent).toBe('R$ 700,00')
    expect(mocks.listContracts).toHaveBeenCalledWith({ clientId: 'client-1' })
    expect(mocks.listExpensesForClient).toHaveBeenCalledWith('client-1', {})
  })

  it('falha de atualização preserva os últimos valores e oferece retry', async () => {
    renderPanel()
    await screen.findByText('R$ 1.000,00')
    mocks.listContracts.mockRejectedValue(new Error('Falha de rede'))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar financeiro' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Últimos valores válidos preservados.')
    expect(screen.getByText('R$ 1.000,00')).not.toBeNull()
    mocks.listContracts.mockResolvedValue([contract])
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('não reaproveita o snapshot de outro cliente quando a troca falha', async () => {
    const { rerender } = renderPanel()
    await screen.findByText('R$ 1.000,00')
    mocks.listContracts.mockRejectedValue(new Error('Falha de rede'))
    rerender(<MemoryRouter><ClientFinancePanel clientId="client-2" clientName="Empresa B" /></MemoryRouter>)
    await screen.findByText(/Falha de rede/)
    expect(screen.queryByText('R$ 1.000,00')).toBeNull()
    expect(screen.queryByText('Financeiro de Empresa A')).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain('Não foi possível carregar')
  })
})
```

Em `src/pages/ClientDetailPage.test.tsx`, adicionar o mock antes do import da página:

```tsx
vi.mock('../components/clients/ClientFinancePanel', () => ({
  ClientFinancePanel: ({ clientId, clientName }: { clientId: string; clientName: string }) => (
    <div>Financeiro de {clientName} ({clientId})</div>
  ),
}))
```

Substituir o teste do Plano 1 `mostra cliente e contrato sem confundir com recebimento` por:

```tsx
it('mostra cliente e contrato sem confundir com recebimento', async () => {
  renderPage()
  expect((await screen.findByRole('heading', { name: 'Empresa A' })).textContent).toBe('Empresa A')
  expect(screen.getByText('Contrato inicial').textContent).toBe('Contrato inicial')

  fireEvent.click(screen.getByRole('tab', { name: 'Financeiro' }))
  expect(screen.getByText('Site').textContent).toBe('Site')
  expect(screen.getByText('R$ 1.234,56').textContent).toBe('R$ 1.234,56')
  expect(screen.getByText('Valor contratado').textContent).toBe('Valor contratado')
  expect(screen.queryByText('Pagamentos, estornos e despesas serão exibidos no módulo Financeiro.')).toBeNull()
  expect(await screen.findByText('Financeiro de Empresa A (client-1)')).toBeTruthy()
  expect(screen.queryByText('Total recebido')).toBeNull()
})
```

Em `src/routes/AppRoutes.test.tsx`, adicionar:

```tsx
vi.mock('../pages/FinancePage', () => ({ FinancePage: () => <h1>Página financeira</h1> }))
```

Remover `['/financeiro', 'Módulo financeiro']` da tabela existente e acrescentar:

```tsx
it('/financeiro renderiza FinancePage dentro do layout protegido', () => {
  render(<MemoryRouter initialEntries={['/financeiro']}><AppRoutes /></MemoryRouter>)
  expect(screen.getByText('Rota protegida')).toBeTruthy()
  expect(screen.getByText('Layout do aplicativo')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Página financeira' })).toBeTruthy()
})
```

Substituir integralmente `src/pages/ModulePlaceholderPage.test.tsx`. Financeiro deixa de ser placeholder; Relatórios permanece na Etapa 4.

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModulePlaceholderPage } from './ModulePlaceholderPage'

const modules = [
  {
    moduleKey: 'relatorios',
    title: 'Relatórios',
    stage: 'Etapa 4',
    description: 'Relatórios de conversão, nichos e desempenho chegam na Etapa 4.',
    actionLabel: 'Ir para Financeiro',
    actionTo: '/financeiro',
  },
] as const

function renderModule() {
  return render(
    <MemoryRouter initialEntries={['/modulos/relatorios']}>
      <Routes>
        <Route path="/modulos/:moduleKey" element={<ModulePlaceholderPage moduleKey="relatorios" />} />
        <Route path="/financeiro" element={<h1>Módulo financeiro</h1>} />
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
  it.each(modules)('$title usa a chave $moduleKey, explica a $stage e possui o CTA correto', ({ title, stage, description, actionLabel, actionTo }) => {
    const { container } = renderModule()
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: `${title} — disponível na ${stage}` })).toBeTruthy()
    expect(screen.getByText(description)).toBeTruthy()
    const link = screen.getByRole('link', { name: actionLabel })
    expect(link.getAttribute('href')).toBe(actionTo)
    expect(link.classList.contains('inline-flex')).toBe(true)
    expect(link.classList.contains('h-10')).toBe(true)
    expect(link.classList.contains('rounded-xl')).toBe(true)
    expect(container.querySelectorAll('a button, a a, button a, a input, a select, a textarea')).toHaveLength(0)
  })

  it('somente Relatórios possui CTA para o módulo financeiro', async () => {
    renderModule()
    fireEvent.click(screen.getByRole('link', { name: 'Ir para Financeiro' }))
    expect(await screen.findByRole('heading', { name: 'Módulo financeiro' })).toBeTruthy()
  })
})
```

- [ ] **Etapa 2: Executar os testes e confirmar o vermelho**

Run: `npm test -- src/components/clients/ClientFinancePanel.test.tsx src/pages/ClientDetailPage.test.tsx src/routes/AppRoutes.test.tsx src/pages/ModulePlaceholderPage.test.tsx`
Expected: FAIL porque `ClientFinancePanel` ainda não existe, a aba do cliente ainda mostra o texto provisório e `/financeiro` ainda aponta para o placeholder. Os testes de Relatórios são regressão e podem já passar; as falhas novas precisam ocorrer nas asserções de integração, não por erros de sintaxe ou mocks.

- [ ] **Etapa 3: Implementar o painel do cliente**

```tsx
// src/components/clients/ClientFinancePanel.tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { ContractPanel } from '../finance/ContractPanel'
import { ExpensePanel } from '../finance/ExpensePanel'
import { getContractFinancials, listContracts } from '../../services/contractService'
import { listExpensesForClient } from '../../services/expenseService'
import { formatMoney } from '../../lib/money'
import type { ContractFinancials, ContractListItem, FinancialExpense, InstallmentFinancial } from '../../types/finance'

export interface ClientFinancePanelProps { clientId: string; clientName: string }
interface ClientFinanceSnapshot {
  contracts: ContractListItem[]
  financials: Record<string, ContractFinancials>
  expenses: FinancialExpense[]
}

function sumCents(values: number[]): number {
  let total = 0
  for (const value of values) {
    if (!Number.isSafeInteger(value)) throw new Error('Total financeiro excede o limite de centavos.')
    total += value
    if (!Number.isSafeInteger(total)) throw new Error('Total financeiro excede o limite de centavos.')
  }
  return total
}

export function ClientFinancePanel({ clientId, clientName }: ClientFinancePanelProps) {
  return <ClientFinancePanelContent key={clientId} clientId={clientId} clientName={clientName} />
}

function ClientFinancePanelContent({ clientId, clientName }: ClientFinancePanelProps) {
  const [snapshot, setSnapshot] = useState<ClientFinanceSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const version = useRef(0)
  const refresh = useCallback(() => setReloadToken((value) => value + 1), [])

  useEffect(() => {
    const current = ++version.current
    let active = true
    setLoading(true); setError('')
    async function load() {
      const contracts = await listContracts({ clientId })
      const entries = await Promise.all(contracts.map(async (contract) => [contract.id, await getContractFinancials(contract.id)] as const))
      const expenses = await listExpensesForClient(clientId, {})
      if (!active || current !== version.current) return
      setSnapshot({
        contracts, expenses,
        financials: Object.fromEntries(entries.filter((entry): entry is readonly [string, ContractFinancials] => entry[1] !== null)),
      })
      setLoading(false)
    }
    void load().catch((cause: unknown) => {
      if (!active || current !== version.current) return
      setError(`Não foi possível ${snapshot ? 'atualizar' : 'carregar'} o financeiro do cliente.${snapshot ? ' Últimos valores válidos preservados.' : ''}${cause instanceof Error ? ` ${cause.message}` : ''}`)
      setLoading(false)
    })
    return () => { active = false }
  }, [clientId, reloadToken])

  if (!snapshot) return <Card><p role="alert" className="text-sm text-danger">{error || 'Carregando financeiro do cliente...'}</p>{error && <Button className="mt-3" variant="outline" onClick={refresh}>Tentar novamente</Button>}</Card>
  const active = snapshot.contracts.filter((contract) => contract.status === 'active')
  const details = Object.values(snapshot.financials)
  const overdue: Array<{ installment: InstallmentFinancial; contract: ContractListItem }> = []
  for (const detail of details) {
    if (detail.contract.status !== 'active') continue
    for (const installment of detail.installments) if (installment.status === 'overdue') overdue.push({ installment, contract: detail.contract })
  }
  const paidExpenses = snapshot.expenses.filter((expense) => expense.status === 'paid')
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-ink">Financeiro de {clientName}</h2><Link className="text-sm text-primary underline" to="/financeiro">Abrir módulo financeiro</Link></div>
      <Button variant="outline" loading={loading} onClick={refresh}><RefreshCw className="h-4 w-4" />Atualizar financeiro</Button></div>
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/40 p-4 text-sm text-danger"><span>{error}</span><Button variant="outline" onClick={refresh}>Tentar novamente</Button></div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ['Contratado ativo', sumCents(active.map((contract) => contract.total_value_cents))],
        ['Recebido líquido histórico', sumCents(details.map((detail) => detail.receivedCents))],
        ['Pendente ativo', sumCents(active.map((contract) => snapshot.financials[contract.id]?.pendingCents ?? 0))],
        ['Despesas pagas', sumCents(paidExpenses.map((expense) => expense.amount_cents))],
      ].map(([label, value]) => <Card key={label}><p className="text-xs text-muted">{label}</p><p className="mt-2 font-display text-2xl font-bold text-ink">{formatMoney(value as number)}</p></Card>)}
    </div>
    <Card title="Parcelas vencidas">{!overdue.length ? <p className="py-4 text-sm text-muted">Nenhuma parcela vencida.</p> : <ul className="space-y-2">{overdue.map(({ installment, contract }) => <li key={installment.id} className="flex justify-between gap-3 rounded-xl bg-elevated px-3 py-2 text-sm"><span>{contract.service} · parcela {installment.position + 1} · {installment.due_date}</span><span>{formatMoney(installment.remaining_cents)}</span></li>)}</ul>}</Card>
    <ContractPanel clientId={clientId} clientName={clientName} contracts={snapshot.contracts} onChanged={refresh} />
    <ExpensePanel clientId={clientId} onChanged={refresh} />
  </section>
}
```

- [ ] **Etapa 4: Confirmar o verde do painel**

Run: `npm test -- src/components/clients/ClientFinancePanel.test.tsx`
Expected: PASS dos três casos, incluindo preservação do snapshot somente no refresh do mesmo cliente e descarte imediato do snapshot quando `clientId` muda.

- [ ] **Etapa 5: Preservar o contrato selecionado e integrar o painel financeiro**

Em `src/pages/ClientDetailPage.tsx`, adicionar:

```ts
import { ClientFinancePanel } from '../components/clients/ClientFinancePanel'
```

Substituir somente o bloco `activeTab === 'financeiro' && (...)` do Plano 1 por:

```tsx
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
      </>
    )}
    <ClientFinancePanel clientId={detail.client.id} clientName={detail.client.name} />
  </div>
)}
```

Os testes do Plano 1 para `Select label="Contrato"`, desempate, edição do contrato escolhido e preservação de `selectedContractId` após refresh permanecem inalterados. A única exceção é o antigo teste de total readonly de `ClientForm`, substituído na Tarefa 4 pelo envio do total editado e pela orientação quando há dependência financeira.

- [ ] **Etapa 6: Substituir a rota protegida e remover o placeholder financeiro**

Em `src/routes/AppRoutes.tsx`, adicionar o import e trocar somente a rota financeira:

```ts
import { FinancePage } from '../pages/FinancePage'
```

```tsx
<Route path="/financeiro" element={<FinancePage />} />
```

A rota permanece dentro de `<ProtectedRoute />` e `<AppLayout />`. Não acrescentar rota pública.

Substituir integralmente `src/pages/ModulePlaceholderPage.tsx`. Somente Relatórios permanece como placeholder; não criar um módulo financeiro vazio.

```tsx
import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, type LucideIcon } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'

const MODULES = {
  relatorios: {
    title: 'Relatórios',
    description: 'Relatórios de conversão, nichos e desempenho chegam na Etapa 4.',
    stage: 'Etapa 4',
    icon: BarChart3,
    actionLabel: 'Ir para Financeiro',
    actionTo: '/financeiro',
  },
} as const satisfies Record<string, {
  title: string; description: string; stage: string; icon: LucideIcon; actionLabel: string; actionTo: string
}>

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
            to={selectedModule.actionTo}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-5 text-sm font-medium text-ink transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {selectedModule.actionLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      />
    </div>
  )
}
```

- [ ] **Etapa 7: Confirmar o verde das integrações e atualizar o README**

Run: `npm test -- src/components/clients/ClientFinancePanel.test.tsx src/pages/ClientDetailPage.test.tsx src/routes/AppRoutes.test.tsx src/pages/ModulePlaceholderPage.test.tsx`
Expected: PASS dos quatro arquivos; `/financeiro` usa `FinancePage`, a aba do cliente mostra o painel e o snapshot não vaza entre clientes.

No `README.md`, atualizar o estado atual para:
- Clientes, Projetos e Financeiro implementados após a execução deste plano;
- rotas `/clientes`, `/clientes/novo`, `/clientes/:id`, `/projetos`, `/projetos/novo`, `/projetos/:id` e `/financeiro`;
- migrations `0006_etapa3_clients.sql`, `0007_etapa3_projects.sql` e `0008_etapa3_finance.sql` e seus testes SQL;
- contratos ativos, recebido líquido histórico, pendente, despesas pagas, fluxo e lucro possuem semânticas distintas;
- conclusão/entrega de projeto não cria receita;
- validação autenticada da migration e RLS entre dois usuários continuam pendentes até execução real, com evidência registrada.

- [ ] **Etapa 8: Auditoria estática completa**

Executar:

```bash
rg -n "current_date|generate_series" src supabase/migrations/0008_etapa3_finance.sql supabase/tests/etapa3_finance.sql
rg -n "financial_expenses\.client_id" src supabase/migrations/0008_etapa3_finance.sql supabase/tests/etapa3_finance.sql
rg -n "CONTINUACAO|corrigir depois|TODO|FIXME|Cliente'" src supabase
rg -n "zinc-|rose-|emerald-|border-white|bg-black|text-white|bg-white|text-black" src/components/finance src/components/clients/ClientFinancePanel.tsx src/pages/FinancePage.tsx
rg -n "toISOString" src/lib/finance.ts src/pages/FinancePage.tsx src/components/clients/ClientFinancePanel.tsx
rg -n "toISOString" src/components/finance/PaymentDialog.tsx src/components/finance/ExpensePanel.tsx
rg -n "^- \[[xX]\]" docs/superpowers/plans/2026-11-25-etapa3-plano3-financeiro.md
git diff --check
git diff --no-index --check /dev/null docs/superpowers/plans/2026-11-25-etapa3-plano3-financeiro.md || test $? -eq 1
```

Esperado: nenhum `current_date`/`generate_series` no SQL financeiro, nenhuma referência inexistente a `financial_expenses.client_id`, nenhum marcador de continuação, TODO/FIXME, nome fictício persistido, classe fora dos tokens ou checkbox marcado. A primeira busca por `toISOString` não retorna ocorrências; a segunda retorna somente as conversões explícitas de data/hora já validadas em `PaymentDialog` e `ExpensePanel`, nunca no cálculo do período. O `--no-index` cobre o plano ainda não rastreado sem mascarar erros de whitespace. Revisar manualmente tipos, nomes de RPC/serviço, imports, rotas e props contra a spec e os Planos 1/2.

- [ ] **Etapa 9: Executar a bateria final**

```bash
npm test
npm run build
npm run lint
```

Esperado: testes, build e lint com código 0. Corrigir qualquer falha antes do commit; não marcar validações não executadas.

- [ ] **Etapa 10: Validação SQL e autenticada real**

Aplicar as migrations 0001–0008 em um projeto Supabase de teste e executar `supabase/tests/etapa3_finance.sql` no SQL Editor. Esperado: todas as asserções passam e o script termina em `ROLLBACK`.

Depois, com duas contas reais e distintas:
1. autenticar a conta A e criar cliente, contrato, parcela, recebimento, estorno, despesa paga e categoria;
2. autenticar a conta B e confirmar que listagens, contratos, despesas, categorias, resumo, fluxo e totais por categoria retornam vazios/zero;
3. tentar ler e alterar IDs da conta A diretamente e por RPC com a conta B; esperar negação por RLS/owner;
4. repetir um recebimento e uma criação de contrato com a mesma chave e confirmar uma única gravação;
5. verificar `/financeiro` e a aba Financeiro do cliente no navegador, incluindo refresh falho, retry, estado vazio, pagamento parcial e estorno de parcela quitada;
6. registrar data, ambiente e resultado reais. Sem essa execução, não afirmar que RLS entre dois usuários ou migration autenticada foi validada.

- [ ] **Etapa 11: Criar commit final**

```bash
git add src/components/clients/ClientFinancePanel.tsx src/components/clients/ClientFinancePanel.test.tsx src/pages/ClientDetailPage.tsx src/pages/ClientDetailPage.test.tsx src/routes/AppRoutes.tsx src/routes/AppRoutes.test.tsx src/pages/ModulePlaceholderPage.tsx src/pages/ModulePlaceholderPage.test.tsx src/pages/FinancePage.tsx src/pages/FinancePage.test.tsx src/components/finance
git commit -m "feat: integrar financeiro ao cliente e concluir etapa 3"
```

---

### Critérios finais de aceite

- Contrato, parcelas, recebimentos e estornos usam centavos no frontend e `numeric` validado no SQL; cada `amount` de parcela passa pela regex textual e pelo limite antes de qualquer cast.
- Idempotência resiste a corrida; `update_client` e `adjust_contract` não ficam abaixo de projetos não cancelados, e ajustes financeiros também não ficam abaixo do recebido líquido; mudança de total pelo cliente exige ausência de parcelas/pagamentos.
- Probes de concorrência exigem `55P03`, nunca `40P01`, incluindo `update_client` isolado em `:contract:<id>` e as direções entre `adjust_contract` e RPCs de projeto.
- Despesas pagas/canceladas só recebem notas; vínculos resolvem um único cliente e eventos são registrados.
- Agregações são `security invoker`, isoladas por RLS, limitadas e sem `generate_series`.
- Datas de período e caixa usam `America/Sao_Paulo`; cálculo do período é determinístico.
- Falha de refresh preserva snapshot; falha inicial é integral; retries de pagamento mantêm payload e chave congelados.
- Estornos exibem alocações líquidas, inclusive de parcelas quitadas.
- `/financeiro` e a aba do cliente estão integradas; gráficos usam dados reais e têm vazios explícitos.
- Testes SQL verificam SQLSTATE/mensagem e isolam agregações; testes TSX usam jsdom, cleanup e asserções DOM nativas.
- Nenhuma caixa é marcada neste plano. Validação autenticada e RLS entre dois usuários só são dadas como concluídas após evidência real.
